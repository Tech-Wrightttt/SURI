"""Battle-only rewards; academic grading remains in the practice submission route."""

from fastapi import HTTPException


BATTLE_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS practice_battles (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    problem_ids_json TEXT NOT NULL,
    state_json TEXT NOT NULL,
    last_request_id TEXT,
    last_response_json TEXT
)
"""


def new_battle_state():
    return {
        "problem_index": 0, "step_position": 0, "hearts": 3,
        "used": [], "flame_ready": False, "ward_ready": False,
        "score": 0, "streak": 0,
    }


def resolve_action(state, action, steps, correct=None):
    """Mutate a locked battle state, never skipping a required answer step."""
    blocked, bonus = False, 0
    if action != "answer":
        if action in state["used"]:
            raise HTTPException(status_code=409, detail="Spell already used against this enemy.")
        if action == "bloom" and state["hearts"] >= 3:
            raise HTTPException(status_code=409, detail="Hearts are already full.")
        state["used"].append(action)
        if action == "flame":
            state["flame_ready"] = True
        elif action == "ward":
            state["ward_ready"] = True
        elif action == "bloom":
            state["hearts"] = min(3, state["hearts"] + 1)
    elif correct:
        bonus = 25 if state["flame_ready"] else 0
        state["flame_ready"] = False
        state["score"] += 10 + state["streak"] * 5 + bonus
        state["streak"] += 1
        state["step_position"] += 1
    else:
        state["streak"] = 0
        blocked = state["ward_ready"]
        state["ward_ready"] = False
        if not blocked:
            state["hearts"] = max(0, state["hearts"] - 1)

    result = {
        key: list(state[key]) if key == "used" else state[key]
        for key in ("hearts", "used", "flame_ready", "ward_ready", "score")
    }
    result.update(correct=correct, blocked=blocked, bonus=bonus)

    if action == "answer" and state["hearts"] == 0:
        checkpoint = len(steps) // 2 if len(steps) > 3 else 0
        state["step_position"] = checkpoint if state["step_position"] >= checkpoint else 0
        state["hearts"] = 3
    if state["step_position"] >= len(steps):
        next_index, score, streak = state["problem_index"] + 1, state["score"], state["streak"]
        state.update(new_battle_state())
        state.update(problem_index=next_index, score=score, streak=streak)
    return result
