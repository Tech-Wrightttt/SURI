import copy
import importlib.util
import json
import os
import tempfile
import unittest
from types import SimpleNamespace

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
_spec = importlib.util.spec_from_file_location(
    "build_handoff", os.path.join(ROOT, "knowledge_base", "playground", "build_handoff.py")
)
bh = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(bh)


def _always_correct(submitted, problem):
    return SimpleNamespace(correct=True, reason="correct", message="")


def _sample():
    with open(bh.SAMPLE_PATH, encoding="utf-8") as f:
        return json.load(f)["problems"]


class HandoffTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.out = os.path.join(self.tmp.name, "handoff")
        self.mock = os.path.join(self.tmp.name, "mock", "mockProblems.json")

    def _write(self, problems, name="in.json"):
        path = os.path.join(self.tmp.name, name)
        with open(path, "w", encoding="utf-8") as f:
            json.dump({"problems": problems}, f)
        return path

    def _build(self, problems, sample=True, **kw):
        return bh.build(sample, out_dir=self.out, mock_path=self.mock,
                        source_path=self._write(problems), checker=_always_correct,
                        report_path=os.path.join(self.tmp.name, "none.json"),
                        decisions_path=os.path.join(self.tmp.name, "none2.json"), **kw)

    def test_sample_builds(self):
        problems = _sample()
        self.assertEqual(len(problems), 15)
        manifest = self._build(problems)
        self.assertEqual(manifest["drop"], 1)
        self.assertTrue(manifest["sample"])
        self.assertEqual(manifest["totals"]["problems"], 15)
        for name in ("playground_problems.json", "schema.sql", "seed_playground.sql", "MANIFEST.json"):
            self.assertTrue(os.path.exists(os.path.join(self.out, name)), name)
        self.assertTrue(os.path.exists(self.mock))
        with open(os.path.join(self.out, "playground_problems.json"), encoding="utf-8") as f:
            built = json.load(f)["problems"]
        self.assertTrue(all("validation" not in p and "compute_expr" not in p for p in built))
        self.assertTrue(all(p["content_hash"].startswith("sha256:") for p in built))

    def test_sample_has_three_per_answer_type(self):
        counts = {}
        for p in _sample():
            counts[p["answer_type"]] = counts.get(p["answer_type"], 0) + 1
        self.assertEqual(counts, {t: 3 for t in bh.ANSWER_TYPES})

    def test_set_of_nine_refused_in_full_mode(self):
        problems = []
        for node in bh.NODES:
            for diff in bh.DIFFICULTIES:
                for i in range(1, 11):
                    problems.append(self._fake(node, diff, i, "word" if i <= 5 else "plain"))
        problems.pop()
        with self.assertRaises(bh.BuildError) as ctx:
            self._build_full(problems)
        self.assertIn("got 9", str(ctx.exception))

    def test_six_four_split_refused(self):
        problems = []
        for node in bh.NODES:
            for diff in bh.DIFFICULTIES:
                for i in range(1, 11):
                    problems.append(self._fake(node, diff, i, "word" if i <= 6 else "plain"))
        with self.assertRaises(bh.BuildError) as ctx:
            self._build_full(problems)
        self.assertIn("6 word + 4 plain", str(ctx.exception))

    def test_unvalidated_item_refused(self):
        problems = _sample()
        problems[0]["validation"]["status"] = "needs_review"
        with self.assertRaises(bh.BuildError) as ctx:
            self._build(problems)
        self.assertIn("needs_review", str(ctx.exception))

    def test_duplicate_id_refused(self):
        problems = _sample()
        problems.append(copy.deepcopy(problems[0]))
        with self.assertRaises(bh.BuildError) as ctx:
            self._build(problems)
        self.assertIn("duplicate id", str(ctx.exception))

    def test_checker_rejection_refused(self):
        def reject(submitted, problem):
            return SimpleNamespace(correct=False, reason="not_equivalent", message="no")
        with self.assertRaises(bh.BuildError):
            bh.build(True, out_dir=self.out, mock_path=self.mock,
                     source_path=self._write(_sample()), checker=reject)

    def test_seed_sql_escapes_quotes(self):
        problems = _sample()
        problems[0]["prompt"] = "Maria's score isn't ''quoted''"
        self._build(problems)
        with open(os.path.join(self.out, "seed_playground.sql"), encoding="utf-8") as f:
            sql = f.read()
        self.assertIn("Maria''s score isn''t ''''quoted''''", sql)
        self.assertEqual(sql.count("ON CONFLICT DO NOTHING;"), 15)

    def test_changed_ids_produce_update_sql(self):
        self._build(_sample())
        problems = _sample()
        problems[1]["answer"] = "80"
        manifest = self._build(problems)
        self.assertEqual(manifest["changed_ids"], [problems[1]["id"]])
        with open(os.path.join(self.out, "update_playground.sql"), encoding="utf-8") as f:
            self.assertIn("ON CONFLICT (id) DO UPDATE SET", f.read())

    def test_slice_requires_easy_five_per_node(self):
        def slice_set(n_per_node=5):
            out = []
            for node in bh.NODES:
                for i in range(1, n_per_node + 1):
                    out.append(self._fake(node, "easy", i, "word" if i <= 2 else "plain"))
            return out

        report = lambda ps: {p["id"]: {"status": "validated", "method": "x"} for p in ps}

        def run(ps):
            rpath = os.path.join(self.tmp.name, "r.json")
            with open(rpath, "w", encoding="utf-8") as f:
                json.dump(report(ps), f)
            return bh.build(False, out_dir=self.out, mock_path=self.mock, source_path=self._write(ps),
                            checker=_always_correct, report_path=rpath,
                            decisions_path=os.path.join(self.tmp.name, "d.json"), slice_mode=True)

        manifest = run(slice_set())
        self.assertEqual(manifest["drop"], "slice")
        self.assertFalse(manifest["complete"])
        self.assertEqual(manifest["totals"]["problems"], 70)
        short = slice_set()[:-1]
        with self.assertRaises(bh.BuildError):
            run(short)
        hard = slice_set()
        hard[0] = self._fake("QE", "hard", 1, "word")
        with self.assertRaises(bh.BuildError):
            run(hard)

    # -- helpers for full-mode tests -------------------------------------------------
    def _fake(self, node, diff, i, style):
        return {
            "id": f"{node}-{bh.DIFF_CODE[diff]}-{i:02d}", "node_id": node, "difficulty": diff,
            "style": style, "prompt": "p", "answer_type": "number", "answer": "1",
            "accepted_variants": [], "required_form": "none", "unit": None,
            "solution_steps": [{"explanation": "e", "latex": "1"}], "source_doc": "x.pdf",
        }

    def _build_full(self, problems):
        report = {p["id"]: {"status": "validated", "method": "mathsteps"} for p in problems}
        rpath = os.path.join(self.tmp.name, "report.json")
        with open(rpath, "w", encoding="utf-8") as f:
            json.dump(report, f)
        return bh.build(False, out_dir=self.out, mock_path=self.mock,
                        source_path=self._write(problems), checker=_always_correct,
                        report_path=rpath, decisions_path=os.path.join(self.tmp.name, "d.json"))


if __name__ == "__main__":
    unittest.main()
