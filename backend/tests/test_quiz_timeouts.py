"""Quiz grading regressions; database and external services stay in memory."""

import json
import unittest
from unittest.mock import AsyncMock, patch

from backend.models.schemas import (
    QuizFinishRequest,
    QuizFinishResponse,
    QuizSubmitStepRequest,
    QuizSubmitStepResponse,
)
from backend.routes import quiz_routes


class QuizDatabase:
    def __init__(self):
        self.problem_ids = [f"p{i}" for i in range(5)]
        self.session = {
            "id": "quiz",
            "session_id": "session",
            "node_id": "QE",
            "student_id": "student",
            "total_points": 0,
            "current_streak": 0,
            "problems_json": json.dumps(self.problem_ids),
            "step_errors_json": "[]",
            "completed_at": None,
        }
        self.steps_json = json.dumps([
            {
                "step_index": i,
                "step_type": "algebra",
                "operation_description": "Add both sides",
                "correct_value": "42",
            }
            for i in range(2)
        ])
        self.attempts = []
        self.misconceptions = []

    async def fetchrow(self, query, *args):
        if "FROM quiz_sessions" in query:
            return dict(self.session)
        if "FROM practice_problems" in query:
            return {"steps_json": self.steps_json}
        if "FROM sessions" in query:
            return {"topic_entry_node": "QE"}
        raise AssertionError(query)

    async def fetch(self, query, *args):
        if "FROM practice_problems" not in query:
            raise AssertionError(query)
        return [{"id": pid, "steps_json": self.steps_json} for pid in args[0]]

    async def execute(self, query, *args):
        if "INSERT INTO practice_attempts" in query:
            self.attempts.append({
                "problem_id": args[3], "score": args[5], "passed": args[6],
            })
        elif "INSERT INTO misconception_logs" in query:
            self.misconceptions.append({"problem_id": args[3], "step_index": args[4]})
        elif "step_errors_json = $2" in query:
            self.session.update(
                total_points=args[0], step_errors_json=args[1], current_streak=args[2],
            )
        elif "current_streak = 0" in query:
            self.session.update(total_points=args[0], current_streak=0)
        elif "completed_at = $1" in query:
            self.session["completed_at"] = args[0]
        else:
            raise AssertionError(query)

    def transaction(self):
        return self

    async def __aenter__(self):
        return self

    async def __aexit__(self, *args):
        return False


class QuizTimeoutTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.db = QuizDatabase()
        self.feedback = AsyncMock(return_value="Review the missed steps.")
        self.progression = AsyncMock(side_effect=lambda *args: {
            "decision": "advance" if args[5] else "remediate",
            "passed_count": args[6],
            "mastery_score": args[7],
        })
        for name, replacement in {
            "get_db": AsyncMock(return_value=self.db),
            "release_db": AsyncMock(),
            "_generate_feedback": self.feedback,
            "_run_progression": self.progression,
        }.items():
            patcher = patch.object(quiz_routes, name, replacement)
            patcher.start()
            self.addCleanup(patcher.stop)

    async def submit(self, pid, step_index, value, save_streak=False):
        result = await quiz_routes.submit_step(QuizSubmitStepRequest(
            quiz_session_id="quiz", problem_id=pid, step_index=step_index,
            submitted_value=value, time_remaining_ms=0 if value is None else 15000,
            save_streak=save_streak,
        ), student={"id": "student"})
        return QuizSubmitStepResponse(**result)

    async def finish(self):
        result = await quiz_routes.finish_quiz(
            QuizFinishRequest(quiz_session_id="quiz"), student={"id": "student"},
        )
        # Exercise the response contract as FastAPI does, including null answers.
        return QuizFinishResponse(**result)

    async def test_timeout_records_error_and_resets_streak_without_charging(self):
        self.db.session.update(total_points=2000, current_streak=4)
        result = await self.submit("p0", 0, None, save_streak=True)
        self.assertFalse(result.correct)
        self.assertEqual(result.points_earned, 0)
        self.assertEqual(result.total_points, 2000)
        self.assertEqual(result.current_streak, 0)
        self.assertEqual(result.streak_multiplier, 1.0)
        errors = json.loads(self.db.session["step_errors_json"])
        self.assertEqual(len(errors), 1)
        self.assertEqual((errors[0]["problem_id"], errors[0]["step_index"]), ("p0", 0))
        self.assertIsNone(errors[0]["submitted_value"])

    async def test_all_timeouts_fail_final_grading_and_saved_attempts(self):
        for pid in self.db.problem_ids:
            for step_index in range(2):
                await self.submit(pid, step_index, None)
        result = await self.finish()
        self.assertEqual((result.total_correct, result.total_steps), (0, 10))
        self.assertEqual(result.total_points, 0)
        self.assertEqual(result.passed_count, 0)
        self.assertEqual(len(result.step_errors), 10)
        self.assertEqual(result.progression.decision, "remediate")
        self.assertEqual(result.progression.mastery_score, 0.0)
        self.assertEqual(len(self.db.attempts), 5)
        self.assertTrue(all(a["score"] == 0 and a["passed"] == 0 for a in self.db.attempts))
        self.assertEqual(len(self.feedback.call_args.args[1]), 10)
        self.assertFalse(self.feedback.call_args.args[2])

    async def test_one_timeout_lowers_score_but_four_passed_problems_advance(self):
        for pid in self.db.problem_ids:
            for step_index in range(2):
                value = None if (pid, step_index) == ("p0", 1) else "42"
                await self.submit(pid, step_index, value)
        result = await self.finish()
        self.assertEqual((result.total_correct, result.total_steps), (9, 10))
        self.assertEqual(result.passed_count, 4)
        self.assertEqual(result.progression.mastery_score, 0.8)
        self.assertEqual(result.progression.decision, "advance")
        self.assertEqual(self.db.attempts[0], {"problem_id": "p0", "score": 50, "passed": 0})
        self.assertTrue(all(a["score"] == 100 and a["passed"] == 1 for a in self.db.attempts[1:]))

    async def test_wrong_answers_still_fail(self):
        for pid in self.db.problem_ids:
            for step_index in range(2):
                await self.submit(pid, step_index, "wrong")
        result = await self.finish()
        self.assertEqual(result.total_correct, 0)
        self.assertEqual(result.passed_count, 0)
        self.assertEqual(result.progression.decision, "remediate")

    async def test_correct_answers_still_pass(self):
        for pid in self.db.problem_ids:
            for step_index in range(2):
                await self.submit(pid, step_index, "42")
        result = await self.finish()
        self.assertEqual(result.total_correct, 10)
        self.assertEqual(result.passed_count, 5)
        self.assertEqual(result.step_errors, [])
        self.assertGreater(result.total_points, 0)
        self.assertEqual(result.progression.decision, "advance")


if __name__ == "__main__":
    unittest.main()
