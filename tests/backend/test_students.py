"""Module 9 — Student Progress & Topic Catalog (backend/routes/student_routes.py)."""

import uuid

from helpers import add_attempts, make_session, make_student, now_iso, set_status


async def test_TC50_progress_of_other_student_is_forbidden(client, db):
    student_a = await make_student(db)
    student_b = await make_student(db)

    res = await client.get(f"/api/students/{student_b['id']}/progress", headers=student_a["headers"])

    assert res.status_code == 403
    assert res.json()["detail"] == "Cannot view another student's progress"


async def test_TC73_topic_catalog_chain_and_intro(client, db):
    student = await make_student(db)
    h = student["headers"]

    topics = await client.get("/api/topics", headers=h)
    catalog = await client.get("/api/topics/catalog", headers=h)
    chain = await client.get("/api/topics/RER/chain", headers=h)
    intro = await client.get("/api/topics/QE/intro", headers=h)
    bad_chain = await client.get("/api/topics/NOPE/chain", headers=h)
    bad_intro = await client.get("/api/topics/NOPE/intro", headers=h)

    assert [t["node_id"] for t in topics.json()] == ["SLE", "RER", "QE", "PE"]
    assert set(catalog.json()["chains"]) == {"SLE", "RER", "QE", "PE"}
    assert [n["node_id"] for n in catalog.json()["chains"]["PE"]] == ["PE", "PO"]
    assert chain.json() == {"chain": ["RER", "LE", "OI", "FD"]}
    assert intro.json()["label"] == "Quadratic Equations" and intro.json()["grade"] == 9
    assert bad_chain.status_code == 404 and bad_intro.status_code == 404


async def test_TC74_own_progress_aggregates_sessions_and_misconceptions(client, db):
    student = await make_student(db)
    active = await make_session(db, student["id"], topic="RER", current_node="OI")
    done = await make_session(db, student["id"], topic="PE", current_node="PE", completed=1)
    await set_status(db, student["id"], "FD", "mastered", "diagnostic")
    await set_status(db, student["id"], "OI", "in_progress", "practice")
    await set_status(db, student["id"], "PO", "mastered", "practice")
    await set_status(db, student["id"], "PE", "mastered", "implied")
    attempt_id = (await add_attempts(db, active, "OI", [0]))[0]
    problem_id = await db.fetchval("SELECT problem_id FROM practice_attempts WHERE id = $1", attempt_id)
    await db.execute(
        "INSERT INTO misconception_logs (id, session_id, practice_attempt_id, problem_id, step_index, "
        "step_description, mapped_node_id, logged_at) VALUES ($1, $2, $3, $4, 0, 'Sign rules', 'OI', $5)",
        str(uuid.uuid4()), active, attempt_id, problem_id, now_iso(),
    )

    res = await client.get(f"/api/students/{student['id']}/progress", headers=student["headers"])

    body = res.json()
    assert res.status_code == 200
    [rer] = body["active_sessions"]
    assert rer["id"] == active and rer["topic_label"] == "Rational Exponents & Radicals"
    assert rer["total_in_chain"] == 4 and rer["mastered_count"] == 1
    assert rer["diagnostic_count"] == 1 and rer["completion_percentage"] == 25.0
    assert [n["node_id"] for n in rer["in_progress_nodes"]] == ["OI"]
    [pe] = body["completed_sessions"]
    assert pe["id"] == done and pe["completion_percentage"] == 100.0 and pe["practice_count"] == 2
    assert body["misconception_history"] == [{
        "node_id": "OI", "node_label": "Operations on Integers",
        "step_description": "Sign rules", "logged_at": body["misconception_history"][0]["logged_at"],
    }]
