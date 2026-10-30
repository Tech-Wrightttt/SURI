"""Diagnostic spells cannot change grading; retries cannot add extra assessment logs."""

import json
import unittest
from unittest.mock import AsyncMock, patch

from fastapi import HTTPException

from backend.diagnostic_battle import new_diagnostic_battle, resolve_diagnostic_hit, resolve_diagnostic_spell
from backend.models.schemas import DiagnosticAnswerRequest, DiagnosticSpellRequest
from backend.routes import diagnostic_routes


class DiagnosticBattleDatabase:
    def __init__(self):
        self.session = {"id": "session", "student_id": "student", "current_node": "FD",
                        "topic_entry_node": "FD", "completed": 0, "current_probe_index": 0}
        self.battle = {"id": "battle", "session_id": "session", "state_json": json.dumps(new_diagnostic_battle(3, 2)),
                       "last_request_id": None, "last_response_json": None}
        self.logs = []
        self.writes = 0

    async def fetchrow(self, query, *args):
        if "FROM diagnostic_battles" in query:
            assert "FOR UPDATE OF b" in query
            if args != (self.battle["id"], "session", "student"):
                return None
            return {**self.battle, "session_completed": self.session["completed"],
                    "current_probe_index": self.session["current_probe_index"]}
        if "FROM sessions" in query:
            return dict(self.session) if args == ("session", "student") else None
        if "FROM diagnostic_logs" in query:
            return {"cnt": len(self.logs), "correct": sum(self.logs)}
        raise AssertionError(query)

    async def execute(self, query, *args):
        self.writes += 1
        if "CREATE TABLE" in query:
            return
        if "INSERT INTO diagnostic_battles" in query:
            self.battle.update(id=args[0], session_id=args[1], state_json=args[2], last_request_id=None, last_response_json=None)
        elif "UPDATE diagnostic_battles" in query:
            self.battle.update(state_json=args[0], last_request_id=args[1], last_response_json=args[2])
        elif "INSERT INTO diagnostic_logs" in query:
            self.logs.append(args[3])
        elif "UPDATE sessions" in query:
            self.session["current_probe_index"] = None
        else:
            raise AssertionError(query)

    def transaction(self):
        return self

    async def __aenter__(self):
        return self

    async def __aexit__(self, *args):
        return False


class DiagnosticPowerupTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.db = DiagnosticBattleDatabase()
        for name, value in {
            "get_db": AsyncMock(return_value=self.db), "release_db": AsyncMock(),
            "PROBES": {"FD": [{"correct_option_index": 0}]},
            "get_chain": lambda node: ["FD"], "get_prerequisite_path": lambda *args: [],
        }.items():
            patcher = patch.object(diagnostic_routes, name, value)
            patcher.start()
            self.addCleanup(patcher.stop)

    async def cast(self, spell, request_id=None, student="student"):
        return await diagnostic_routes.cast_diagnostic_spell("session", DiagnosticSpellRequest(
            battle_id="battle", request_id=request_id or spell, spell=spell,
        ), student={"id": student})

    async def answer(self, correct, request_id="answer", legacy=False):
        return await diagnostic_routes.submit_diagnostic_answer("session", DiagnosticAnswerRequest(
            node_id="FD", selected_option_index=0 if correct else 1,
            **({} if legacy else {"battle_id": "battle", "request_id": request_id}),
        ), student={"id": "student"})

    async def test_flame_bonus_never_skips_questions_or_inflates_correct_counts(self):
        await self.cast("flame")
        result = await self.answer(True)
        self.assertTrue(result["correct"])
        self.assertEqual((result["battle"]["bonus"], result["battle"]["score"]), (25, 35))
        self.assertEqual(result["battle"]["enemy_hearts"], 2)
        self.assertEqual(result["next_action"], "next_probe")
        self.assertEqual(self.db.logs, [1])

    async def test_blocked_wrong_answer_keeps_heart_but_is_still_logged_incorrect(self):
        await self.cast("ward")
        result = await self.answer(False)
        self.assertFalse(result["correct"])
        self.assertTrue(result["battle"]["blocked"])
        self.assertEqual((result["battle"]["hearts"], result["battle"]["score"]), (2, 0))
        self.assertEqual(self.db.logs, [0])
        self.db.session["current_probe_index"] = 0
        next_result = await self.answer(False, "second")
        self.assertEqual(next_result["battle"]["hearts"], 1)
        # Grading still fails the node at 2 wrong, whatever Ward saved.
        self.assertEqual(next_result["next_action"], "complete")

    async def test_cast_and_answer_retries_are_idempotent_even_after_probe_clears(self):
        first = await self.cast("flame")
        self.assertEqual(first, await self.cast("flame"))
        result = await self.answer(True)
        self.assertIsNone(self.db.session["current_probe_index"])
        self.assertEqual(result, await self.answer(True))
        self.assertEqual(self.db.logs, [1])
        self.assertEqual(json.loads(self.db.battle["state_json"])["score"], 35)

    async def test_full_health_does_not_spend_heal_and_healing_uses_two_heart_cap(self):
        with self.assertRaises(HTTPException):
            await self.cast("bloom")
        self.assertEqual(json.loads(self.db.battle["state_json"])["used"], [])
        await self.answer(False)
        self.db.session["current_probe_index"] = 0
        self.assertEqual((await self.cast("bloom"))["hearts"], 2)
        with self.assertRaises(HTTPException):
            await self.cast("bloom", "second-heal")
        self.assertEqual(self.db.logs, [0])

    async def test_three_correct_answers_pass_the_node_and_end_a_single_node_chain(self):
        for i in range(3):
            self.db.session["current_probe_index"] = 0
            result = await self.answer(True, f"answer-{i}")
        self.assertEqual(result["next_action"], "complete")
        self.assertEqual(result["battle"]["enemy_hearts"], 0)
        self.assertEqual(self.db.logs, [1, 1, 1])
        with self.assertRaises(HTTPException):
            await self.cast("flame")

    async def test_two_wrong_answers_fail_the_node_and_empty_suri_hearts(self):
        for i in range(2):
            self.db.session["current_probe_index"] = 0
            result = await self.answer(False, f"answer-{i}")
        self.assertEqual(result["next_action"], "complete")
        self.assertEqual(result["battle"]["hearts"], 0)
        self.assertTrue(json.loads(self.db.battle["state_json"])["finished"])

    async def test_legacy_answer_payload_still_uses_original_grading(self):
        result = await self.answer(False, legacy=True)
        self.assertFalse(result["correct"])
        self.assertNotIn("battle", result)
        self.assertEqual(self.db.logs, [0])

    async def test_other_students_cannot_cast_or_start_battles(self):
        with self.assertRaises(HTTPException) as error:
            await self.cast("ward", student="other")
        self.assertEqual(error.exception.status_code, 404)
        with self.assertRaises(HTTPException):
            await diagnostic_routes.start_diagnostic_battle("session", student={"id": "other"})
        self.assertEqual(self.db.writes, 0)

    async def test_new_battle_resumes_node_hearts_without_deleting_assessment_logs(self):
        await self.answer(False)
        result = await diagnostic_routes.start_diagnostic_battle("session", student={"id": "student"})
        self.assertEqual((result["battle"]["hearts"], result["battle"]["enemy_hearts"]), (1, 3))
        self.assertEqual(result["battle"]["used"], [])
        self.assertEqual(self.db.logs, [0])


class DiagnosticEnemyCycleTests(unittest.TestCase):
    def grading(self, correct, correct_count, wrong_count, next_action="next_probe", node_complete=False):
        return {"correct": correct, "correct_count": correct_count, "wrong_count": wrong_count,
                "next_action": next_action, "node_complete": node_complete}

    def test_passed_node_brings_fresh_enemy_hearts_and_spells_and_keeps_score(self):
        state = new_diagnostic_battle(3, 2)
        resolve_diagnostic_hit(state, self.grading(False, 0, 1), 3, 2)
        resolve_diagnostic_spell(state, "flame", 2)
        resolve_diagnostic_spell(state, "ward", 2)
        resolve_diagnostic_hit(state, self.grading(True, 1, 1), 3, 2)
        resolve_diagnostic_hit(state, self.grading(True, 2, 1), 3, 2)
        result = resolve_diagnostic_hit(state, self.grading(True, 3, 1, node_complete=True), 3, 2)
        self.assertEqual(result["enemy_hearts"], 0)
        self.assertEqual((state["enemy_hearts"], state["hearts"]), (3, 2))
        self.assertEqual(state["used"], [])
        self.assertFalse(state["ward_ready"])
        self.assertEqual(state["score"], result["score"])

    def test_failed_node_finishes_without_refilling_spells(self):
        state = new_diagnostic_battle(3, 2)
        resolve_diagnostic_spell(state, "flame", 2)
        resolve_diagnostic_hit(state, self.grading(False, 0, 1), 3, 2)
        result = resolve_diagnostic_hit(state, self.grading(False, 0, 2, "complete", True), 3, 2)
        self.assertEqual(result["hearts"], 0)
        self.assertTrue(state["finished"])
        self.assertIn("flame", state["used"])


if __name__ == "__main__":
    unittest.main()
