"""
Shared pytest fixtures for the SURI backend test suite.

The suite runs the real FastAPI app (backend.main:app) in-process through
httpx's ASGI transport against a real PostgreSQL database. Point it at an
empty, disposable database with TEST_DATABASE_URL, e.g.

    TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/suri_test

Every test gets freshly truncated tables, so tests are independent and can
run in any order. Gemini is never called: GEMINI_API_KEY is removed so the
routes take their documented offline fallbacks, and tests that exercise the
LLM branch inject a fake model.
"""

import asyncio
import os
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
SCHEMA_SQL = Path(__file__).with_name("schema.sql")

TEST_DATABASE_URL = os.getenv("TEST_DATABASE_URL")
if not TEST_DATABASE_URL:
    raise pytest.UsageError(
        "TEST_DATABASE_URL is not set. Point it at an empty PostgreSQL database "
        "(it is wiped before every test)."
    )

# backend.database reads DATABASE_URL at import time, so set it first.
os.environ["DATABASE_URL"] = TEST_DATABASE_URL
os.environ["JWT_SECRET"] = "suri-test-secret"
os.environ.pop("GEMINI_API_KEY", None)
sys.path.insert(0, str(ROOT))

import asyncpg  # noqa: E402
import httpx  # noqa: E402

import backend.database as database  # noqa: E402
from backend.main import app  # noqa: E402

TABLES = (
    "quiz_sessions, progression_logs, misconception_logs, practice_attempts, "
    "practice_problems, content_records, competency_status, diagnostic_logs, "
    "sessions, students"
)


@pytest.fixture(scope="session", autouse=True)
def _schema():
    """Create the test schema once per test run."""

    async def create():
        conn = await asyncpg.connect(TEST_DATABASE_URL)
        try:
            await conn.execute(SCHEMA_SQL.read_text(encoding="utf-8"))
        finally:
            await conn.close()

    asyncio.run(create())


@pytest.fixture
async def db():
    """Empty database plus a direct connection for seeding and assertions."""
    conn = await asyncpg.connect(TEST_DATABASE_URL)
    await conn.execute(f"TRUNCATE {TABLES} CASCADE")
    # progression_routes.py stores the round summary with problem_id='batch'.
    await conn.execute(
        "INSERT INTO practice_problems (id, node_id, problem_expr, steps_json, created_at) "
        "VALUES ('batch', '_system', 'practice round summary', '[]', '1970-01-01T00:00:00+00:00')"
    )
    # The app's pool is bound to the event loop that created it; each test
    # has its own loop, so start every test with a fresh lazily-created pool.
    database._pool = None
    database._init_lock = None
    try:
        yield conn
    finally:
        await conn.close()
        await database.close_pool()


@pytest.fixture
async def client(db):
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as c:
        yield c
