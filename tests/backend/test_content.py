"""Module 5 — Content Delivery & AI Simplification (backend/routes/content_routes.py)."""

import json

import pytest

import backend.routes.content_routes as content_routes
from helpers import FakeModel, get_status, make_content, make_student, set_status


@pytest.fixture
def fake_gemini(monkeypatch):
    """Route Gemini calls to FakeModel; returns a setter for the reply text."""
    reply = {"text": ""}
    FakeModel.calls = 0
    monkeypatch.setenv("GEMINI_API_KEY", "test-key")
    monkeypatch.setattr(content_routes.genai, "configure", lambda **_: None)
    monkeypatch.setattr(content_routes.genai, "GenerativeModel",
                        lambda _name: FakeModel(reply["text"]))
    return reply


async def test_TC25_content_for_unknown_node(client, db):
    student = await make_student(db)

    res = await client.get("/api/content/UNKNOWN_NODE", headers=student["headers"])

    assert res.status_code == 400
    assert res.json()["detail"] == "Invalid node_id: 'UNKNOWN_NODE'"


async def test_TC26_content_missing_from_database(client, db):
    student = await make_student(db)

    res = await client.get("/api/content/QE", headers=student["headers"])

    assert res.status_code == 400
    assert res.json() == {"error": "no_content", "node_id": "QE"}


async def test_TC27_content_for_unresolved_node_keeps_status(client, db):
    student = await make_student(db)
    await make_content(db, "QE")
    await set_status(db, student["id"], "QE", "unresolved", "diagnostic")

    res = await client.get("/api/content/QE", headers=student["headers"])

    body = res.json()
    assert res.status_code == 200
    assert body["lesson"] == "Lesson for QE"
    assert body["worked_example"] == "Worked example for QE"
    assert body["guided_explanation"] == "Guided explanation for QE"
    assert body["competency_status"] == {"status": "unresolved", "source": "diagnostic"}
    assert tuple(await get_status(db, student["id"], "QE")) == ("unresolved", "diagnostic")


async def test_TC27b_content_without_any_status_returns_null_competency(client, db):
    student = await make_student(db)
    await make_content(db, "QE")

    res = await client.get("/api/content/QE", headers=student["headers"])

    assert res.status_code == 200
    assert res.json()["competency_status"] is None


async def test_TC28_revisiting_diagnostic_mastered_node_keeps_mastered(client, db):
    student = await make_student(db)
    await make_content(db, "QE")
    await set_status(db, student["id"], "QE", "mastered", "diagnostic")

    res = await client.get("/api/content/QE", headers=student["headers"])

    assert res.status_code == 200
    assert res.json()["lesson"] == "Lesson for QE"
    # Mastery is never taken away by reading a lesson again.
    assert tuple(await get_status(db, student["id"], "QE")) == ("mastered", "diagnostic")
    assert res.json()["competency_status"] == {"status": "mastered", "source": "diagnostic"}


async def test_TC29_cached_simplified_lesson_skips_llm(client, db, monkeypatch):
    student = await make_student(db)
    cached = {"lesson": "Simple lesson", "worked_example": "1 + 1 = 2",
              "guided_explanation": "Add them."}
    await make_content(db, "QE", simplified=json.dumps(cached))

    def boom(*_args, **_kwargs):
        raise AssertionError("Gemini must not be called when a cached version exists")

    monkeypatch.setattr(content_routes.genai, "GenerativeModel", boom)

    res = await client.post("/api/content/QE/simplify", headers=student["headers"])

    assert res.status_code == 200
    assert res.json() == cached


async def test_TC61_simplify_generates_strips_fences_and_caches(client, db, fake_gemini):
    student = await make_student(db)
    await make_content(db, "QE")
    generated = {"lesson": "Easier", "worked_example": "x = 1", "guided_explanation": "Step"}
    fake_gemini["text"] = "```json\n" + json.dumps(generated) + "\n```"

    first = await client.post("/api/content/QE/simplify", headers=student["headers"])
    second = await client.post("/api/content/QE/simplify", headers=student["headers"])

    assert first.status_code == 200 and first.json() == generated
    assert second.json() == generated
    assert FakeModel.calls == 1
    stored = await db.fetchval(
        "SELECT simplified_lesson_text FROM content_records WHERE node_id = 'QE'")
    assert json.loads(stored) == generated
    assert content_routes._parse_simplified_payload("plain text") == {
        "simplified_lesson_text": "plain text"}


async def test_TC62_simplify_error_paths(client, db, fake_gemini, monkeypatch):
    student = await make_student(db)
    await make_content(db, "QE")

    unknown = await client.post("/api/content/NOPE/simplify", headers=student["headers"])
    no_row = await client.post("/api/content/FP/simplify", headers=student["headers"])
    fake_gemini["text"] = "not json at all"
    bad_json = await client.post("/api/content/QE/simplify", headers=student["headers"])
    monkeypatch.delenv("GEMINI_API_KEY")
    no_key = await client.post("/api/content/QE/simplify", headers=student["headers"])

    assert unknown.status_code == 400
    assert no_row.status_code == 400 and no_row.json()["error"] == "no_content"
    assert bad_json.status_code == 500
    assert bad_json.json()["detail"].startswith("Failed to parse JSON from Gemini response")
    assert no_key.status_code == 500
    assert no_key.json()["detail"] == "GEMINI_API_KEY environment variable is missing"
