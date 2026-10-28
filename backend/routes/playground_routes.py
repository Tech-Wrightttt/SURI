
import json
import random
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from backend.auth import get_current_student
from backend.competency_utils import get_chain
from backend.database import get_db, release_db
from backend.graph import ENTRY_NODES, GRAPH
from backend.playground_checker.checker import check_answer


router = APIRouter(prefix="/api/playground", tags=["playground"])

DIFFICULTIES = ("easy", "medium", "hard")
SITTING_LIMIT = 10


class CheckRequest(BaseModel):
    problem_id: str
    answer_latex: str


class RevealRequest(BaseModel):
    problem_id: str


@router.get("/topics")
async def get_playground_topics(
    student=Depends(get_current_student),
):
    student_id = student["id"]

    conn = await get_db()
    try:
        rows = await conn.fetch(
            """
            SELECT
                p.node_id,
                p.difficulty,
                COUNT(*) AS total,
                COUNT(s.problem_id) AS solved
            FROM playground_problems p
            LEFT JOIN playground_solved s
                ON s.problem_id = p.id
                AND s.student_id = $1
            GROUP BY p.node_id, p.difficulty
            """,
            student_id,
        )
    finally:
        await release_db(conn)

    counts = {}

    for row in rows:
        counts[(row["node_id"], row["difficulty"])] = {
            "total": row["total"],
            "solved": row["solved"],
        }

    chains = []

    for entry_node_id in ENTRY_NODES:
        nodes = []

        for node_id in get_chain(entry_node_id):
            node = GRAPH[node_id]

            difficulties = {
                difficulty: counts.get(
                    (node_id, difficulty),
                    {"total": 0, "solved": 0},
                )
                for difficulty in DIFFICULTIES
            }

            nodes.append(
                {
                    "node_id": node_id,
                    "label": node["label"],
                    "grade": node["grade"],
                    "difficulties": difficulties,
                }
            )

        chains.append(
            {
                "entry_node_id": entry_node_id,
                "label": GRAPH[entry_node_id]["label"],
                "nodes": nodes,
            }
        )

    return {"chains": chains}


@router.get("/sitting")
async def get_playground_sitting(
    node_id: str,
    difficulty: str,
    student=Depends(get_current_student),
):
    if node_id not in GRAPH:
        raise HTTPException(
            status_code=404,
            detail=f"Unknown node_id: {node_id}",
        )

    if difficulty not in DIFFICULTIES:
        raise HTTPException(
            status_code=422,
            detail="difficulty must be easy, medium, or hard",
        )

    student_id = student["id"]

    conn = await get_db()
    try:
        rows = await conn.fetch(
            """
            SELECT
                p.id,
                p.style,
                p.prompt,
                p.answer_type,
                p.required_form,
                p.unit,
                (s.problem_id IS NOT NULL) AS solved
            FROM playground_problems p
            LEFT JOIN playground_solved s
                ON s.problem_id = p.id
                AND s.student_id = $3
            WHERE p.node_id = $1
              AND p.difficulty = $2
            """,
            node_id,
            difficulty,
            student_id,
        )
    finally:
        await release_db(conn)

    problems = [dict(row) for row in rows]
    random.shuffle(problems)

    return {
        "node_id": node_id,
        "difficulty": difficulty,
        "problems": problems[:SITTING_LIMIT],
    }


@router.post("/check")
async def check_playground_answer(
    request: CheckRequest,
    student=Depends(get_current_student),
):
    student_id = student["id"]

    conn = await get_db()
    try:
        row = await conn.fetchrow(
            """
            SELECT
                p.id,
                p.answer,
                p.answer_type,
                p.accepted_variants_json,
                p.required_form,
                p.unit,
                (s.problem_id IS NOT NULL) AS already_solved
            FROM playground_problems p
            LEFT JOIN playground_solved s
                ON s.problem_id = p.id
                AND s.student_id = $2
            WHERE p.id = $1
            """,
            request.problem_id,
            student_id,
        )

        if row is None:
            raise HTTPException(
                status_code=404,
                detail="Unknown problem_id",
            )

        problem = {
            "answer": row["answer"],
            "answer_type": row["answer_type"],
            "accepted_variants": json.loads(
                row["accepted_variants_json"]
            ),
            "required_form": row["required_form"],
            "unit": row["unit"],
        }

        result = check_answer(request.answer_latex, problem)
        solved = row["already_solved"]

        if result.correct:
            await conn.execute(
                """
                INSERT INTO playground_solved
                    (student_id, problem_id, solved_at)
                VALUES ($1, $2, $3)
                ON CONFLICT (student_id, problem_id) DO NOTHING
                """,
                student_id,
                request.problem_id,
                datetime.now(timezone.utc).isoformat(),
            )
            solved = True

        return {
            "correct": result.correct,
            "reason": result.reason,
            "message": result.message,
            "solved": solved,
        }
    finally:
        await release_db(conn)


@router.post("/reveal")
async def reveal_playground_answer(
    request: RevealRequest,
    student=Depends(get_current_student),
):
    conn = await get_db()
    try:
        row = await conn.fetchrow(
            """
            SELECT answer, unit, solution_steps_json
            FROM playground_problems
            WHERE id = $1
            """,
            request.problem_id,
        )

        if row is None:
            raise HTTPException(
                status_code=404,
                detail="Unknown problem_id",
            )

        return {
            "answer": row["answer"],
            "unit": row["unit"],
            "solution_steps": json.loads(
                row["solution_steps_json"]
            ),
        }
    finally:
        await release_db(conn)
