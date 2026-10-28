"""Seeding helpers shared by the backend tests."""

import json
import uuid
from datetime import datetime, timedelta, timezone

from backend.auth import create_access_token, hash_password

DEFAULT_PASSWORD = "SecurePassword123"


def now_iso(offset_seconds: int = 0) -> str:
    return (datetime.now(timezone.utc) + timedelta(seconds=offset_seconds)).isoformat()


async def make_student(db, name="Juan Dela Cruz", email=None, grade_level=7,
                       password=DEFAULT_PASSWORD) -> dict:
    """Insert a student and return {id, email, token, headers}."""
    student_id = str(uuid.uuid4())
    email = email or f"{student_id[:8]}@cit.edu"
    await db.execute(
        "INSERT INTO students (id, name, email, grade_level, password_hash, created_at) "
        "VALUES ($1, $2, $3, $4, $5, $6)",
        student_id, name, email, grade_level, hash_password(password), now_iso(),
    )
    token = create_access_token(student_id, name)
    return {
        "id": student_id,
        "email": email,
        "token": token,
        "headers": {"Authorization": f"Bearer {token}"},
    }


async def make_session(db, student_id, topic="QE", current_node=None,
                       probe_index=None, completed=0) -> str:
    session_id = str(uuid.uuid4())
    ts = now_iso()
    await db.execute(
        """
        INSERT INTO sessions (id, student_id, topic_entry_node, current_node,
            current_probe_index, started_at, last_active_at, completed, completion_percentage)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 0.0)
        """,
        session_id, student_id, topic, current_node or topic, probe_index, ts, ts, completed,
    )
    return session_id


async def add_diagnostic_logs(db, session_id, node_id, results):
    """results: iterable of 1/0 probe results, inserted in order."""
    for i, r in enumerate(results):
        await db.execute(
            "INSERT INTO diagnostic_logs (id, session_id, node_id, probe_result, logged_at) "
            "VALUES ($1, $2, $3, $4, $5)",
            str(uuid.uuid4()), session_id, node_id, r, now_iso(-100 + i),
        )


async def set_status(db, student_id, node_id, status, source):
    await db.execute(
        "INSERT INTO competency_status (id, student_id, node_id, status, source, updated_at) "
        "VALUES ($1, $2, $3, $4, $5, $6)",
        str(uuid.uuid4()), student_id, node_id, status, source, now_iso(),
    )


async def get_status(db, student_id, node_id):
    return await db.fetchrow(
        "SELECT status, source FROM competency_status WHERE student_id = $1 AND node_id = $2",
        student_id, node_id,
    )


async def make_content(db, node_id="QE", simplified=None):
    await db.execute(
        """
        INSERT INTO content_records (id, node_id, lesson_text, worked_example,
            guided_explanation, source_doc, source_chunk_id, generated_at, simplified_lesson_text)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        """,
        str(uuid.uuid4()), node_id, f"Lesson for {node_id}", f"Worked example for {node_id}",
        f"Guided explanation for {node_id}", "grade9_quadratic_equations_intro.pdf",
        "chunk-1", now_iso(), simplified,
    )


def step(index, correct_value, step_type="algebra", mapped_node_id="FD",
         operation="Simplify"):
    return {
        "step_index": index,
        "step_type": step_type,
        "instruction": f"Step {index + 1} instruction",
        "blank_expression": "x = ___",
        "correct_value": correct_value,
        "mapped_node_id": mapped_node_id,
        "operation_description": operation,
    }


async def make_problem(db, node_id="FD", steps=None, extras=None) -> str:
    problem_id = str(uuid.uuid4())
    steps = steps if steps is not None else [step(0, "6")]
    await db.execute(
        """
        INSERT INTO practice_problems (id, node_id, problem_expr, steps_json,
            word_problem_text, created_at, step_extras_json)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        """,
        problem_id, node_id, "1/2 + 1/4", json.dumps(steps), "A short word problem.",
        now_iso(), json.dumps(extras) if extras is not None else None,
    )
    return problem_id


async def make_problems(db, node_id, count, **kwargs) -> list[str]:
    return [await make_problem(db, node_id, **kwargs) for _ in range(count)]


async def add_attempts(db, session_id, node_id, results, problem_id=None) -> list[str]:
    """Insert practice attempts with passed flags `results`; returns attempt ids."""
    problem_id = problem_id or await make_problem(db, node_id)
    ids = []
    for i, passed in enumerate(results):
        attempt_id = str(uuid.uuid4())
        await db.execute(
            """
            INSERT INTO practice_attempts (id, session_id, node_id, problem_id,
                student_steps_json, score, passed, attempted_at)
            VALUES ($1, $2, $3, $4, '[]', $5, $6, $7)
            """,
            attempt_id, session_id, node_id, problem_id, 100 if passed else 0, passed,
            now_iso(-50 + i),
        )
        ids.append(attempt_id)
    return ids


async def make_quiz_session(db, session_id, student_id, node_id="FD", total_points=0,
                            streak=0, problem_ids=None, errors=None) -> str:
    quiz_id = str(uuid.uuid4())
    await db.execute(
        """
        INSERT INTO quiz_sessions (id, session_id, node_id, student_id, total_points,
            problems_json, step_errors_json, started_at, current_streak)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        """,
        quiz_id, session_id, node_id, student_id, total_points,
        json.dumps(problem_ids or []), json.dumps(errors or []), now_iso(), streak,
    )
    return quiz_id


class FakeModel:
    """Stand-in for google.generativeai.GenerativeModel."""

    calls = 0

    def __init__(self, text):
        self._text = text

    async def generate_content_async(self, prompt):
        FakeModel.calls += 1

        class _Resp:
            text = self._text

        return _Resp()
