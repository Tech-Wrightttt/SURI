"""Module 2 — Session Orchestration (backend/routes/session_routes.py, backend/progress_utils.py)."""

from helpers import make_session, make_student, set_status


async def test_TC07_create_session_invalid_topic(client, db):
    student = await make_student(db)

    res = await client.post("/api/sessions", json={"topic_entry_node": "NON_EXISTENT_NODE"},
                            headers=student["headers"])

    assert res.status_code == 400
    assert res.json()["detail"] == "Invalid topic_entry_node: 'NON_EXISTENT_NODE'"


async def test_TC08_create_session_rejects_duplicate_active(client, db):
    student = await make_student(db)
    existing = await make_session(db, student["id"], topic="QE", current_node="FD")

    res = await client.post("/api/sessions", json={"topic_entry_node": "QE"},
                            headers=student["headers"])

    assert res.status_code == 409
    assert res.json()["detail"] == {
        "error": "session_exists", "session_id": existing, "current_node": "FD",
    }


async def test_TC09_create_session_starts_at_chain_floor(client, db):
    student = await make_student(db)

    res = await client.post("/api/sessions", json={"topic_entry_node": "QE"},
                            headers=student["headers"])

    assert res.status_code == 200
    body = res.json()
    assert body["topic_entry_node"] == "QE" and body["current_node"] == "FD"
    row = await db.fetchrow("SELECT * FROM sessions WHERE id = $1", body["session_id"])
    assert row["current_node"] == "FD"
    assert row["completed"] == 0 and row["completion_percentage"] == 0.0
    assert row["current_probe_index"] is None


async def test_TC10_get_session_of_other_student_is_404(client, db):
    owner = await make_student(db)
    intruder = await make_student(db)
    session_id = await make_session(db, owner["id"])

    res = await client.get(f"/api/sessions/{session_id}", headers=intruder["headers"])
    own = await client.get(f"/api/sessions/{session_id}", headers=owner["headers"])

    assert res.status_code == 404
    assert res.json()["detail"] == "Session not found"
    assert own.status_code == 200 and own.json()["id"] == session_id


async def test_TC59_patch_session_validates_and_updates(client, db):
    student = await make_student(db)
    session_id = await make_session(db, student["id"], current_node="FD")
    url = f"/api/sessions/{session_id}"

    invalid = await client.patch(url, json={"current_node": "NOPE"}, headers=student["headers"])
    empty = await client.patch(url, json={}, headers=student["headers"])
    missing = await client.patch("/api/sessions/unknown", json={"completed": 1},
                                 headers=student["headers"])
    ok = await client.patch(url, json={"current_node": "OI", "completed": 1},
                            headers=student["headers"])

    assert invalid.status_code == 400
    assert invalid.json()["detail"] == "Invalid current_node: 'NOPE'"
    assert empty.status_code == 400 and empty.json()["detail"] == "No fields to update"
    assert missing.status_code == 404
    assert ok.status_code == 200
    assert ok.json()["current_node"] == "OI" and ok.json()["completed"] == 1


async def test_TC60_progress_recomputes_completion_percentage(client, db):
    student = await make_student(db)
    session_id = await make_session(db, student["id"], topic="QE", current_node="SP")
    for node in ("FD", "OI", "LE"):
        await set_status(db, student["id"], node, "mastered", "practice")
    await set_status(db, student["id"], "SP", "in_progress", "practice")

    res = await client.patch(f"/api/sessions/{session_id}/progress", headers=student["headers"])
    missing = await client.patch("/api/sessions/unknown/progress", headers=student["headers"])

    assert res.status_code == 200
    assert res.json() == {"success": True, "completion_percentage": 50.0,
                          "mastered_in_chain": 3, "total_in_chain": 6}
    stored = await db.fetchval("SELECT completion_percentage FROM sessions WHERE id = $1", session_id)
    assert stored == 50.0
    assert missing.status_code == 404
