import os
import sys
import unittest

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
CHALLENGE = os.path.join(ROOT, "knowledge_base", "challenge")
if CHALLENGE not in sys.path:
    sys.path.insert(0, CHALLENGE)

from dedupe import groups, template_key  # noqa: E402


class TemplateKeyTests(unittest.TestCase):
    def test_numbers_are_masked(self):
        self.assertEqual(template_key("x^2-9"), template_key("x^2-16"))
        self.assertEqual(template_key("1/2 + 1/4"), template_key("1/4+3/8"))

    def test_latex_and_ascii_match(self):
        self.assertEqual(template_key(r"$\frac{1}{2} + \frac{1}{4}$"), template_key("3/4 + 1/8"))

    def test_variables_are_collapsed(self):
        self.assertEqual(template_key("Solve $2x + 3 = 11$"), template_key("solve 5y+1=16"))

    def test_different_structure_differs(self):
        self.assertNotEqual(template_key("x^2-9"), template_key("x^2+9"))
        self.assertNotEqual(template_key("x^2-9"), template_key("x^2-9x"))

    def test_groups_are_per_node(self):
        a = {"source": "playground", "node": "QE", "ref": "1", "text": "x^2-9", "key": template_key("x^2-9")}
        b = dict(a, ref="2", text="x^2-16", key=template_key("x^2-16"))
        c = dict(a, ref="3", node="FP")
        self.assertEqual(len(groups([a, b, c])["QE"]), 1)
        self.assertNotIn("FP", groups([a, b, c]))


if __name__ == "__main__":
    unittest.main()
