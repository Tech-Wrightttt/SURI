"""Module 6 — Scaffolded Practice & Misconception Analysis (backend/routes/practice_routes.py)."""

import pytest

from backend.routes.practice_routes import normalize_val
from helpers import make_problem, make_problems, make_session, make_student, step


async def submit(client, student, session_id, problem_id, values, node_id="FD"):
    return await client.post(
        "/api/practice/submit-step",
        json={
            "session_id": session_id,
            "node_id": node_id,
            "problem_id": problem_id,
            "student_steps": [{"step_index": i, "submitted_value": v} for i, v in enumerate(values)],
        },
        headers=student["headers"],
    )


async def test_TC30_practice_start_rejects_pool_of_nine(client, db):
    student = await make_student(db)
    session_id = await make_session(db, student["id"], current_node="FD")
    await make_problems(db, "FD", 9)

    res = await client.post("/api/practice/start", json={"session_id": session_id, "node_id": "FD"},
                            headers=student["headers"])

    assert res.status_code == 400
    assert res.json()["detail"] == {"error": "no_practice_content", "node_id": "FD"}


async def test_TC31_practice_start_samples_five_distinct_problems(client, db):
    student = await make_student(db)
    session_id = await make_session(db, student["id"], current_node="FD")
    ids = await make_problems(db, "FD", 10)
    unknown = await client.post("/api/practice/start",
                                json={"session_id": session_id, "node_id": "NOPE"},
                                headers=student["headers"])

    res = await client.post("/api/practice/start", json={"session_id": session_id, "node_id": "FD"},
                            headers=student["headers"])

    problems = res.json()["problems"]
    assert res.status_code == 200
    assert len(problems) == 5
    assert len({p["id"] for p in problems}) == 5 and {p["id"] for p in problems} <= set(ids)
    assert problems[0]["steps"][0]["step_type"] == "algebra"
    assert unknown.status_code == 400


async def test_TC32_float_answer_at_tolerance_boundary_is_correct(client, db):
    student = await make_student(db)
    session_id = await make_session(db, student["id"], current_node="FD")
    problem_id = await make_problem(db, "FD", steps=[step(0, "3.14")])

    res = await submit(client, student, session_id, problem_id, ["3.15"])

    body = res.json()
    assert res.status_code == 200
    assert body["step_results"][0]["correct"] is True
    assert body["misconception_found"] is False and body["feedback_text"] is None


async def test_TC33_float_answer_beyond_tolerance_is_incorrect(client, db):
    student = await make_student(db)
    session_id = await make_session(db, student["id"], current_node="FD")
    problem_id = await make_problem(db, "FD", steps=[step(0, "3.14")])

    res = await submit(client, student, session_id, problem_id, ["3.151"])

    body = res.json()
    assert body["step_results"][0]["correct"] is False
    assert body["misconception_found"] is True and body["misconception_step_index"] == 0


async def test_TC34_submit_step_for_unknown_problem(client, db):
    student = await make_student(db)
    session_id = await make_session(db, student["id"], current_node="FD")

    res = await submit(client, student, session_id, "00000000-0000-0000-0000-000000000000", ["1"])

    assert res.status_code == 404
    assert res.json()["detail"] == "Problem not found"


async def test_TC35_first_wrong_step_logs_misconception_and_feedback(client, db):
    student = await make_student(db)
    session_id = await make_session(db, student["id"], current_node="FD")
    problem_id = await make_problem(db, "FD", steps=[
        step(0, "2", mapped_node_id="FD"),
        step(1, "4", mapped_node_id="OI", operation="Factoring"),
        step(2, "6", mapped_node_id="FD"),
    ])

    res = await submit(client, student, session_id, problem_id, ["2", "5", "7"])

    body = res.json()
    assert [r["correct"] for r in body["step_results"]] == [True, False, False]
    assert body["misconception_found"] is True
    assert body["misconception_step_index"] == 1
    assert body["misconception_node_id"] == "OI"
    assert body["misconception_node_label"] == "Operations on Integers"
    assert "Operations on Integers" in body["feedback_text"]
    logs = await db.fetch("SELECT step_index, step_description, mapped_node_id FROM misconception_logs")
    assert [tuple(r) for r in logs] == [(1, "Factoring", "OI")]
    attempt = await db.fetchrow("SELECT score, passed FROM practice_attempts WHERE problem_id = $1",
                                problem_id)
    assert attempt["score"] == 33 and attempt["passed"] == 0


async def test_TC63_float_answer_at_negative_tolerance_boundary_is_correct(client, db):
    student = await make_student(db)
    session_id = await make_session(db, student["id"], current_node="FD")
    problem_id = await make_problem(db, "FD", steps=[step(0, "3.14")])

    res = await submit(client, student, session_id, problem_id, ["3.13"])

    assert res.json()["step_results"][0]["correct"] is True


@pytest.mark.parametrize("submitted, key", [
    (r"\frac{1}{2}", "1/2"),
    ("$x^{2}$", "x^2"),
    (r"\left(x+1\right)", "(x+1)"),
    ("2*x  +  3", "2x+3"),
    (r"\sqrt 9", r"\sqrt{9}"),
    ("  X = 5 ", "x=5"),
])
def test_TC64_latex_and_spacing_normalization(submitted, key):
    assert normalize_val(submitted) == normalize_val(key)


async def test_TC78_retry_of_a_step_does_not_overwrite_first_attempt(client, db):
    student = await make_student(db)
    session_id = await make_session(db, student["id"], current_node="FD")
    problem_id = await make_problem(db, "FD", steps=[step(0, "6")])

    res = await client.post(
        "/api/practice/submit-step",
        json={"session_id": session_id, "node_id": "FD", "problem_id": problem_id,
              "student_steps": [{"step_index": 0, "submitted_value": "5"},
                                {"step_index": 0, "submitted_value": "6"}]},
        headers=student["headers"],
    )

    body = res.json()
    assert res.status_code == 200
    assert [r["correct"] for r in body["step_results"]] == [False]
    assert body["misconception_found"] is True


async def test_TC79_practice_rejects_another_students_session(client, db):
    owner = await make_student(db)
    intruder = await make_student(db)
    session_id = await make_session(db, owner["id"], current_node="FD")
    problem_id = await make_problem(db, "FD", steps=[step(0, "6")])
    await make_problems(db, "FD", 10)

    start = await client.post("/api/practice/start", json={"session_id": session_id, "node_id": "FD"},
                              headers=intruder["headers"])
    submitted = await submit(client, intruder, session_id, problem_id, ["5"])

    assert start.status_code == 404 and start.json()["detail"] == "Session not found"
    assert submitted.status_code == 404 and submitted.json()["detail"] == "Session not found"
    assert await db.fetchval("SELECT COUNT(*) FROM practice_attempts WHERE session_id = $1",
                             session_id) == 0
