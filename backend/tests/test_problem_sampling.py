import random
import unittest

from backend.problem_sampling import sample_mixed


def _rows(n_std=8, n_hard=6):
    return ([{"id": f"s{i}", "difficulty": "standard"} for i in range(n_std)]
            + [{"id": f"c{i}", "difficulty": "challenge"} for i in range(n_hard)])


class ExcludeTests(unittest.TestCase):
    def test_unseen_are_preferred(self):
        rows = _rows()
        seen = {"s0", "s1", "s2", "s3", "c0", "c1", "c2"}
        for n in range(50):
            ids = {r["id"] for r in sample_mixed(rows, 5, 3, random.Random(n), seen)}
            self.assertFalse(ids & seen)

    def test_keeps_challenge_count_when_unseen_suffice(self):
        for n in range(30):
            got = sample_mixed(_rows(), 5, 3, random.Random(n), {"s0", "c0"})
            self.assertEqual(sum(r["difficulty"] == "challenge" for r in got), 3)

    def test_falls_back_to_seen_when_short(self):
        rows = _rows(3, 2)
        seen = {r["id"] for r in rows[:4]}  # only one unseen row left
        got = sample_mixed(rows, 5, 2, random.Random(1), seen)
        self.assertEqual(len(got), 5)
        self.assertEqual(len({r["id"] for r in got}), 5)
        self.assertIn(rows[4]["id"], {r["id"] for r in got})  # the unseen one is always in

    def test_no_exclude_matches_old_behaviour(self):
        got = sample_mixed(_rows(), 5, 2, random.Random(3))
        self.assertEqual(len(got), 5)
        self.assertEqual(sum(r["difficulty"] == "challenge" for r in got), 2)


if __name__ == "__main__":
    unittest.main()
