"""
Database connection pool for SURI using asyncpg (PostgreSQL / Supabase).

Replaces the previous aiosqlite SQLite implementation.
The pool is initialized once on app startup and shared across all requests.
"""

import os
import asyncio
import asyncpg

DATABASE_URL = (
    os.getenv("DATABASE_URL")
    or os.getenv("POSTGRES_URL")
    or os.getenv("POSTGRES_PRISMA_URL")
    or os.getenv("SUPABASE_DATABASE_URL")
    or ""
)

_pool: asyncpg.Pool | None = None
_init_lock: asyncio.Lock | None = None


def _get_lock() -> asyncio.Lock:
    global _init_lock
    if _init_lock is None:
        _init_lock = asyncio.Lock()
    return _init_lock


async def init_pool():
    """Create the asyncpg connection pool. Safe to call multiple times."""
    global _pool
    if not DATABASE_URL:
        raise RuntimeError(
            "Database connection string not found. Please set DATABASE_URL or POSTGRES_URL in environment variables."
        )
    if _pool is None:
        _pool = await asyncpg.create_pool(
            dsn=DATABASE_URL,
            min_size=1,
            max_size=5,
            statement_cache_size=0,  # Required for Supabase transaction pooler (PgBouncer)
        )


async def close_pool():
    """Close the connection pool. Called on app shutdown."""
    global _pool
    if _pool:
        await _pool.close()
        _pool = None


async def get_db() -> asyncpg.Connection:
    """
    Acquire a connection from the pool.

    Lazily initializes the pool if it hasn't been initialized yet —
    required for Vercel serverless where ASGI lifespan events are not
    guaranteed to run before the first request.
    """
    global _pool
    if _pool is None:
        async with _get_lock():
            if _pool is None:
                await init_pool()
    return await _pool.acquire()


async def release_db(conn: asyncpg.Connection):
    """Return a connection back to the pool."""
    if _pool and conn:
        await _pool.release(conn)
