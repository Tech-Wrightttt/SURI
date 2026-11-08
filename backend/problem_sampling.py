"""Difficulty-aware sampling shared by the quiz and standard practice modes."""

import json
import random

RECENT_SESSIONS = 5   # quiz sessions looked back over
RECENT_ATTEMPTS = 50  # practice attempts looked back over


def sample_mixed(rows, total: int = 5, challenge: int = 2, rng=random, exclude_ids=()) -> list:
    """Pick `total` rows: up to `challenge` challenge rows, the rest standard.

    Rows whose "id" is in `exclude_ids` (problems the student already saw) are used
    only when there are not enough unseen ones. Falls back to the other pool when
    one runs short. Rows are mappings with a "difficulty" key; a missing key counts
    as standard. The result is shuffled.
    """
    rows = list(rows)
    seen = set(exclude_ids)
    fresh = [r for r in rows if r.get("id") not in seen]
    old = [r for r in rows if r.get("id") in seen]

    picked = []
    for pool in (fresh, old):  # unseen first; seen ones only top up what is missing
        picked += _pick(pool, total - len(picked), challenge - _count_hard(picked), rng, picked)
        if len(picked) >= total:
            break
    rng.shuffle(picked)
    return picked


def _count_hard(rows) -> int:
    return sum(1 for r in rows if r.get("difficulty", "standard") == "challenge")


def _pick(pool, total, challenge, rng, already) -> list:
    hard = [r for r in pool if r.get("difficulty", "standard") == "challenge"]
    easy = [r for r in pool if r.get("difficulty", "standard") != "challenge"]
    picked_hard = rng.sample(hard, max(min(challenge, len(hard), total), 0))
    picked_easy = rng.sample(easy, max(min(total - len(picked_hard), len(easy)), 0))
    picked = picked_hard + picked_easy
    short = total - len(picked)
    if short > 0:
        left = [r for r in hard if r not in picked_hard]
        picked += rng.sample(left, min(short, len(left)))
    return picked


async def recent_served_ids(conn, student_id: str, node_id: str) -> set:
    """Practice-problem ids this student was served lately for a node (quiz sessions + practice attempts)."""
    seen = set()
    quiz = await conn.fetch(
        "SELECT problems_json FROM quiz_sessions WHERE student_id = $1 AND node_id = $2 "
        "ORDER BY started_at DESC LIMIT $3", student_id, node_id, RECENT_SESSIONS)
    for r in quiz:
        try:
            seen.update(json.loads(r["problems_json"]))
        except (TypeError, ValueError):
            pass
    attempts = await conn.fetch(
        "SELECT pa.problem_id FROM practice_attempts pa JOIN sessions s ON s.id = pa.session_id "
        "WHERE s.student_id = $1 AND pa.node_id = $2 ORDER BY pa.attempted_at DESC LIMIT $3",
        student_id, node_id, RECENT_ATTEMPTS)
    seen.update(r["problem_id"] for r in attempts)
    return seen
