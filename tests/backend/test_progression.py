"""Module 7 — Mastery Progression Decision Engine (backend/routes/progression_routes.py)."""

import uuid

import pytest

from helpers import add_attempts, get_status, make_session, make_student, now_iso


async def decide(client, student, session_id, node_id):
    return await client.post("/api/progression/decide",
                             json={"session_id": session_id, "node_id": node_id},
                             headers=student["headers"])


async def add_misconception(db, session_id, attempt_id, node_id):
    problem_id = await db.fetchval("SELECT problem_id FROM practice_attempts WHERE id = $1", attempt_id)
    log_id = str(uuid.uuid4())
    await db.execute(
        """
        INSERT INTO misconception_logs (id, session_id, practice_attempt_id, problem_id,
            step_index, step_description, mapped_node_id, logged_at)
        VALUES ($1, $2, $3, $4, 0, 'Operation', $5, $6)
        """,
        log_id, session_id, attempt_id, problem_id, node_id, now_iso(),
    )
    return log_id


async def test_TC36_decide_rejects_unknown_node(client, db):
    student = await make_student(db)
    session_id = await make_session(db, student["id"])

    res = await decide(client, student, session_id, "INVALID")
    missing = await decide(client, student, "unknown-session", "QE")

    assert res.status_code == 400
    assert res.json()["detail"] == "Invalid node_id: 'INVALID'"
    assert missing.status_code == 404


async def test_TC37_four_of_five_advances_to_next_node(client, db):
    student = await make_student(db)
    session_id = await make_session(db, student["id"], topic="QE", current_node="FD")
    await add_attempts(db, session_id, "FD", [1, 1, 1, 1, 0])

    res = await decide(client, student, session_id, "FD")

    body = res.json()
    assert res.status_code == 200
    assert body["decision"] == "advance" and body["mastery_score"] == 0.8
    assert body["passed_count"] == 4
    assert body["next_node_id"] == "OI" and body["topic_complete"] is False
    assert tuple(await get_status(db, student["id"], "FD")) == ("mastered", "practice")
    assert tuple(await get_status(db, student["id"], "OI")) == ("in_progress", "practice")
    assert await db.fetchval("SELECT current_node FROM sessions WHERE id = $1", session_id) == "OI"


async def test_TC38_three_of_five_remediates_with_go_deeper(client, db):
    student = await make_student(db)
    session_id = await make_session(db, student["id"], topic="QE", current_node="SP")
    attempt_ids = await add_attempts(db, session_id, "SP", [1, 1, 1, 0, 0])
    await add_misconception(db, session_id, attempt_ids[3], "OI")

    res = await decide(client, student, session_id, "SP")

    body = res.json()
    assert body["decision"] == "remediate" and body["mastery_score"] == 0.6
    assert body["go_deeper_available"] is True
    assert body["go_deeper_node"] == {"node_id": "LE", "node_label": "Laws of Exponents"}
    assert body["misconception_nodes"] == [{"node_id": "OI", "node_label": "Operations on Integers"}]
    assert tuple(await get_status(db, student["id"], "SP")) == ("unresolved", "practice")
    assert tuple(await get_status(db, student["id"], "LE")) == ("in_progress", "practice")
    logged = await db.fetchrow("SELECT decision, mastery_score FROM progression_logs")
    assert logged["decision"] == "remediate" and logged["mastery_score"] == pytest.approx(0.6)


async def test_TC39_passing_entry_node_completes_topic(client, db):
    student = await make_student(db)
    session_id = await make_session(db, student["id"], topic="QE", current_node="QE")
    await add_attempts(db, session_id, "QE", [1, 1, 1, 1, 1])

    res = await decide(client, student, session_id, "QE")

    body = res.json()
    assert body["decision"] == "advance" and body["mastery_score"] == 1.0
    assert body["topic_complete"] is True
    row = await db.fetchrow("SELECT completed, completion_percentage FROM sessions WHERE id = $1",
                            session_id)
    assert row["completed"] == 1 and row["completion_percentage"] == 100.0
    assert tuple(await get_status(db, student["id"], "FD")) == ("mastered", "implied")


async def test_TC40_problem_misconceptions_relinked_to_batch_attempt(client, db):
    student = await make_student(db)
    session_id = await make_session(db, student["id"], topic="QE", current_node="FD")
    attempt_ids = await add_attempts(db, session_id, "FD", [1, 0, 1, 0, 1])
    log_ids = [await add_misconception(db, session_id, attempt_ids[1], "FD"),
               await add_misconception(db, session_id, attempt_ids[3], "FD")]

    res = await decide(client, student, session_id, "FD")

    assert res.json()["decision"] == "remediate"
    batch_id = await db.fetchval(
        "SELECT id FROM practice_attempts WHERE session_id = $1 AND problem_id = 'batch'", session_id)
    linked = await db.fetch("SELECT practice_attempt_id FROM misconception_logs WHERE id = ANY($1)",
                            log_ids)
    assert batch_id and {r["practice_attempt_id"] for r in linked} == {batch_id}
    # FD is a floor node, so there is no deeper prerequisite to unlock.
    assert res.json()["go_deeper_available"] is False and res.json()["go_deeper_node"] is None


async def test_TC65_advance_when_everything_above_is_mastered_completes_topic(client, db):
    student = await make_student(db)
    session_id = await make_session(db, student["id"], topic="RER", current_node="OI")
    for node in ("RER", "LE"):
        await db.execute(
            "INSERT INTO competency_status (id, student_id, node_id, status, source, updated_at) "
            "VALUES ($1, $2, $3, 'mastered', 'diagnostic', $4)",
            str(uuid.uuid4()), student["id"], node, now_iso(),
        )
    await add_attempts(db, session_id, "OI", [1, 1, 1, 1, 1])

    res = await decide(client, student, session_id, "OI")

    assert res.json()["decision"] == "advance" and res.json()["topic_complete"] is True
    assert await db.fetchval("SELECT completed FROM sessions WHERE id = $1", session_id) == 1
