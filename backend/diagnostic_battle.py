"""Diagnostic battle rewards; hearts mirror the graded node counts, so spells never change assessment."""

from fastapi import HTTPException

from backend.practice_battle import cast_spell, resolve_spell_hit

DIAGNOSTIC_BATTLE_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS diagnostic_battles (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    state_json TEXT NOT NULL,
    last_request_id TEXT,
    last_response_json TEXT
)
"""

# Bloom is left out: Suri's hearts are the node's remaining allowed misses, which a spell cannot restore.
DIAGNOSTIC_SPELLS = ("flame", "ward")


def new_diagnostic_battle(enemy_hearts, hearts):
    return {
        "hearts": hearts, "enemy_hearts": enemy_hearts, "used": [],
        "flame_ready": False, "ward_ready": False,
        "score": 0, "streak": 0, "finished": False,
    }


def battle_snapshot(state, correct=None, blocked=False, bonus=0):
    return {
        **{key: list(state[key]) if key == "used" else state[key]
           for key in ("hearts", "enemy_hearts", "used", "flame_ready", "ward_ready", "score")},
        "correct": correct, "blocked": blocked, "bonus": bonus,
    }


def resolve_diagnostic_spell(state, spell):
    if spell not in DIAGNOSTIC_SPELLS:
        raise HTTPException(status_code=409, detail="This spell is not available in the diagnostic.")
    cast_spell(state, spell, state["hearts"])
    return battle_snapshot(state)


def resolve_diagnostic_hit(state, grading, enemy_max, suri_max):
    """Apply score rewards, then copy hearts from the graded result of this node."""
    streak = state["streak"]
    blocked, bonus = resolve_spell_hit(state, grading["correct"])
    if blocked:
        # Ward cannot undo a graded miss; it keeps the streak instead.
        state["streak"] = streak
    state["enemy_hearts"] = max(0, enemy_max - grading["correct_count"])
    state["hearts"] = max(0, suri_max - grading["wrong_count"])
    result = battle_snapshot(state, grading["correct"], blocked, bonus)
    state["finished"] = grading["next_action"] == "complete"
    if grading["node_complete"] and not state["finished"]:
        # The node passed: the next node brings a fresh enemy and full spell charges.
        state.update(enemy_hearts=enemy_max, hearts=suri_max, used=[], flame_ready=False, ward_ready=False)
    return result
