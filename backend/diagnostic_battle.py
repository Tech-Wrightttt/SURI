"""Diagnostic battle rewards; spells change Suri's hearts and score, never the graded logs."""

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


def resolve_diagnostic_spell(state, spell, suri_max):
    cast_spell(state, spell, suri_max)
    return battle_snapshot(state)


def resolve_diagnostic_hit(state, grading, enemy_max, suri_max):
    """Apply spell rewards to Suri's hearts; the enemy's hearts follow the graded correct count."""
    blocked, bonus = resolve_spell_hit(state, grading["correct"])
    state["enemy_hearts"] = max(0, enemy_max - grading["correct_count"])
    result = battle_snapshot(state, grading["correct"], blocked, bonus)
    state["finished"] = grading["next_action"] == "complete"
    if grading["node_complete"] and not state["finished"]:
        # The node passed: the next node brings a fresh enemy, full hearts and spell charges.
        state.update(enemy_hearts=enemy_max, hearts=suri_max, used=[], flame_ready=False, ward_ready=False)
    return result
