import json
import os
import unittest

from backend.playground_checker import check_answer

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
SAMPLE = os.path.join(ROOT, "knowledge_base", "playground", "samples", "playground_sample.json")


def prob(answer, answer_type="number", form="none", unit=None, variants=()):
    return {"answer": answer, "answer_type": answer_type, "required_form": form,
            "unit": unit, "accepted_variants": list(variants)}


class CheckerCase(unittest.TestCase):
    def ok(self, sub, p):
        r = check_answer(sub, p)
        self.assertTrue(r.correct, f"{sub!r} should be correct, got {r}")

    def bad(self, sub, p, reason=None):
        r = check_answer(sub, p)
        self.assertFalse(r.correct, f"{sub!r} should be wrong, got {r}")
        if reason:
            self.assertEqual(r.reason, reason, f"{sub!r}: {r}")


class NumberTests(CheckerCase):
    def test_equivalent_rationals(self):
        p = prob("\\frac{1}{2}")
        for s in ("0.5", "1/2", "\\frac{2}{4}", "\\frac12", "\\dfrac{1}{2}", "0.50"):
            self.ok(s, p)
        self.bad("0.6", p, "not_equivalent")

    def test_decimal_tolerance(self):
        p = prob("\\frac{1}{3}")
        for s in ("0.33", "0.333", "0.3333"):
            self.ok(s, p)
        self.bad("0.3", p, "not_equivalent")
        self.bad("0.34", p, "not_equivalent")
        q = prob("\\frac{2}{3}")
        self.ok("0.67", q)
        self.ok("0.66", q)

    def test_exact_integers_not_loosened(self):
        self.bad("3.004", prob("3"), "not_equivalent")
        self.ok("3", prob("3"))
        self.ok("3.00", prob("3"))

    def test_radicals(self):
        p = prob("2\\sqrt{2}")
        self.ok("\\sqrt{8}", p)
        self.ok("2\\sqrt2", p)
        self.ok("2.83", p)
        self.ok("2.8284", p)
        self.bad("2.8", p)

    def test_mixed_numbers(self):
        self.ok("2\\frac{1}{2}", prob("\\frac{5}{2}"))
        self.ok("2\\frac12", prob("2.5"))
        self.bad("2\\frac{1}{3}", prob("\\frac{5}{2}"))

    def test_negative(self):
        self.ok("-\\frac{1}{2}", prob("-0.5"))
        self.ok("\\frac{-1}{2}", prob("-0.5"))

    def test_mathlive_artefacts(self):
        p = prob("12")
        self.ok("\\left(12\\right)", p)
        self.ok("12\\placeholder{}", p)
        self.ok("$12$", p)
        self.ok("1{,}2", prob("1.2"))

    def test_percent_unit(self):
        p = prob("75", unit="%")
        self.ok("75", p)
        self.ok("75\\%", p)
        self.bad("70", p)

    def test_other_unit_rejected(self):
        p = prob("60", unit="km/h")
        self.ok("60", p)
        r = check_answer("60 km/h", p)
        self.assertEqual(r.reason, "unparseable")
        self.assertIn("unit", r.message)
        self.assertEqual(check_answer("60\\text{km/h}", p).reason, "unparseable")

    def test_empty_and_garbage(self):
        p = prob("5")
        self.assertEqual(check_answer("", p).reason, "empty")
        self.assertEqual(check_answer("   ", p).reason, "empty")
        self.assertEqual(check_answer("\\placeholder{}", p).reason, "empty")
        self.assertEqual(check_answer("5+", p).reason, "unparseable")
        self.assertEqual(check_answer("\\foo{3}", p).reason, "unparseable")
        self.assertEqual(check_answer("((5", p).reason, "unparseable")

    def test_lowest_terms(self):
        p = prob("\\frac{3}{4}", form="lowest_terms")
        self.ok("\\frac{3}{4}", p)
        self.ok("0.75", p)
        self.bad("\\frac{6}{8}", p, "wrong_form")
        self.bad("\\frac{2}{3}", p, "not_equivalent")
        self.bad("\\frac{3}{1}", prob("3", form="lowest_terms"), "wrong_form")
        self.ok("3", prob("3", form="lowest_terms"))
        self.bad("\\frac{9}{6}", prob("1\\frac12", form="lowest_terms"), "wrong_form")

    def test_variants(self):
        p = prob("\\frac{1}{2}", variants=["50\\%"])
        self.ok("0.5", p)

    def test_simplest_radical(self):
        p = prob("6\\sqrt{2}", form="simplest_radical")
        self.ok("6\\sqrt{2}", p)
        self.bad("\\sqrt{72}", p, "wrong_form")
        self.bad("3\\sqrt{8}", p, "wrong_form")
        q = prob("\\frac{\\sqrt{2}}{2}", form="simplest_radical")
        self.ok("\\frac{\\sqrt2}{2}", q)
        self.bad("\\frac{1}{\\sqrt{2}}", q, "wrong_form")


class ExpressionTests(CheckerCase):
    def test_order_independent(self):
        p = prob("x^2-2x-15", "expression")
        self.ok("-15-2x+x^2", p)
        self.ok("x^{2}-2x-15", p)
        self.bad("x^2-2x+15", p, "not_equivalent")

    def test_implicit_multiplication(self):
        p = prob("(x+3)(x+4)", "expression")
        self.ok("(x+4)(x+3)", p)
        self.ok("x^2+7x+12", p)
        self.ok("(x+3)\\cdot(x+4)", p)
        self.bad("(x+3)(x+5)", p)

    def test_multivariable(self):
        p = prob("2xy+3", "expression")
        self.ok("3+2yx", p)
        self.ok("3+2 x y", p)

    def test_factored_form(self):
        p = prob("(x+3)(x+4)", "expression", form="factored")
        self.ok("(x+4)(x+3)", p)
        self.bad("x^2+7x+12", p, "wrong_form")
        q = prob("2x(x+2)", "expression", form="factored")
        self.ok("2x(x+2)", q)
        self.ok("(x+2)(2x)", q)
        self.bad("2x^2+4x", q, "wrong_form")
        self.bad("x(2x+4)", q, "wrong_form")        # non-primitive factor
        self.bad("2(x^2+2x)", q, "wrong_form")      # partially factored
        r = prob("(x-1)(x+1)(x+2)", "expression", form="factored")
        self.ok("(x+1)(x-1)(x+2)", r)
        self.bad("(x^2-1)(x+2)", r, "wrong_form")
        s = prob("(x^2+1)(x+2)", "expression", form="factored")
        self.ok("(x+2)(x^2+1)", s)
        self.ok("-(x+1)(x+2)", prob("-(x+1)(x+2)", "expression", form="factored"))

    def test_difference_of_squares_factored(self):
        p = prob("(a-b)(a+b)", "expression", form="factored")
        self.ok("(a+b)(a-b)", p)
        self.bad("a^2-b^2", p, "wrong_form")

    def test_expanded_form(self):
        p = prob("x^2-2x-15", "expression", form="expanded")
        self.ok("x^2-2x-15", p)
        self.ok("-15-2x+x^2", p)
        self.bad("(x+3)(x-5)", p, "wrong_form")
        self.bad("x^2-5x+3x-15", p, "wrong_form")   # like terms not combined
        self.bad("x^2-2x-15+0", p, "wrong_form")

    def test_radical_expression(self):
        p = prob("3x\\sqrt{2}", "expression", form="simplest_radical")
        self.ok("3x\\sqrt{2}", p)
        self.ok("3\\sqrt{2}x", p)
        self.bad("\\sqrt{18x^2}", p, "wrong_form")
        self.bad("3\\sqrt{2x^2}", p, "wrong_form")

    def test_positive_exponents(self):
        p = prob("\\frac{1}{x^2}", "expression", form="positive_exponents")
        self.ok("\\frac{1}{x^{2}}", p)
        self.bad("x^{-2}", p, "wrong_form")
        q = prob("x^5", "expression", form="positive_exponents")
        self.bad("x^2\\cdot x^3", q, "wrong_form")
        self.ok("x^{5}", q)

    def test_factored_rejects_multivariate_sum_with_hidden_common_factor(self):
        p = prob("(x+2)(y+3)", "expression", form="factored")
        self.ok("(x+2)(y+3)", p)
        self.bad("xy+3x+2y+6", p, "wrong_form")
        q = prob("(x+y)(x+z)", "expression", form="factored")
        self.ok("(x+y)(x+z)", q)
        self.bad("x^2+xy+xz+yz", q, "wrong_form")

    def test_positive_exponents_rejects_undistributed_powers(self):
        p = prob("27x^3y^6", "expression", form="positive_exponents")
        self.ok("27x^3y^6", p)
        self.bad("(3xy^2)^3", p, "wrong_form")
        q = prob("\\frac{x^9}{y^{15}}", "expression", form="positive_exponents")
        self.ok("\\frac{x^9}{y^{15}}", q)
        self.bad("\\left(\\frac{x^3}{y^5}\\right)^3", q, "wrong_form")
        self.bad("(x^3)^3y^{-15}", q, "wrong_form")

    def test_rational_exponents(self):
        p = prob("4", "expression")
        self.ok("8^{\\frac{2}{3}}", p)
        self.ok("\\sqrt[3]{64}", p)
        self.bad("8^{\\frac{1}{3}}", p)

    def test_poles_do_not_break_equivalence(self):
        p = prob("\\frac{x^2-1}{x-1}", "expression")
        self.ok("x+1", p)


class EquationTests(CheckerCase):
    def test_rearranged(self):
        p = prob("y=2x+1", "equation")
        self.ok("2x-y+1=0", p)
        self.ok("y=1+2x", p)
        self.ok("2y=4x+2", p)
        self.bad("y=2x+2", p, "not_equivalent")
        self.bad("2x+1", p, "unparseable")

    def test_slope_intercept(self):
        p = prob("y=-2x+10", "equation", form="slope_intercept")
        self.ok("y=-2x+10", p)
        self.ok("y=10-2x", p)
        self.bad("2x+y=10", p, "wrong_form")
        self.bad("-2x+10=y", p, "wrong_form")
        self.bad("2y=-4x+20", p, "wrong_form")
        q = prob("y=\\frac{1}{2}x-4", "equation", form="slope_intercept")
        self.ok("y=\\frac{1}{2}x-4", q)
        self.ok("y=0.5x-4", q)
        self.ok("y=\\frac{x}{2}-4", q)
        self.bad("y=\\frac{1}{2}(x-8)", q, "wrong_form")


class SolutionSetTests(CheckerCase):
    def test_order_free_and_prefixes(self):
        p = prob("2, 3", "solution_set")
        for s in ("3, 2", "2,3", "x=2, x=3", "x=3 \\text{ or } x=2", "x_1=2, x_2=3",
                  "\\{2,3\\}", "2 or 3"):
            self.ok(s, p)
        self.bad("2", p, "not_equivalent")
        self.bad("2, 4", p, "not_equivalent")
        self.bad("2, 3, 4", p, "not_equivalent")
        self.bad("x=2, y=3", p, "not_equivalent")

    def test_double_root(self):
        p = prob("3", "solution_set")
        self.ok("3", p)
        self.ok("3, 3", p)
        q = prob("3, 3", "solution_set")
        self.ok("3", q)

    def test_pm(self):
        p = prob("-3, 3", "solution_set")
        self.ok("\\pm 3", p)
        self.ok("\\pm3", p)
        q = prob("1+\\sqrt{2}, 1-\\sqrt{2}", "solution_set")
        self.ok("1\\pm\\sqrt{2}", q)

    def test_fractions_and_decimals(self):
        p = prob("-2, \\frac{3}{2}", "solution_set")
        self.ok("1.5, -2", p)
        self.ok("\\frac{3}{2}, -2", p)

    def test_cubic(self):
        self.ok("3, 1, 2", prob("1, 2, 3", "solution_set"))

    def test_garbage(self):
        p = prob("2, 3", "solution_set")
        self.assertEqual(check_answer("2,,3", p).reason, "unparseable")
        self.assertEqual(check_answer("x", p).reason, "not_equivalent")


class OrderedPairTests(CheckerCase):
    def test_forms(self):
        p = prob("(6, 4)", "ordered_pair")
        for s in ("(6,4)", "6, 4", "x=6, y=4", "y=4, x=6", "\\left(6,4\\right)",
                  "(\\frac{12}{2}, 4.0)"):
            self.ok(s, p)
        self.bad("(4, 6)", p, "not_equivalent")
        self.bad("x=4, y=6", p, "not_equivalent")
        self.bad("(6, 4, 1)", p, "unparseable")
        self.bad("6", p, "unparseable")
        self.bad("x=6, 4", p, "unparseable")

    def test_fraction_coordinates(self):
        p = prob("(\\frac{1}{3}, -2)", "ordered_pair")
        self.ok("(0.33, -2)", p)
        self.ok("(\\frac{2}{6}, -2)", p)
        self.bad("(0.3, -2)", p)


class SampleProblemTests(unittest.TestCase):
    def test_every_sample_answer_checks_against_itself(self):
        with open(SAMPLE, encoding="utf-8") as f:
            problems = json.load(f)["problems"]
        self.assertEqual(len(problems), 15)
        for p in problems:
            r = check_answer(p["answer"], p)
            self.assertTrue(r.correct, f"{p['id']}: {r}")
            for v in p["accepted_variants"]:
                self.assertTrue(check_answer(v, p).correct, p["id"])

    def test_typing_the_problem_back_fails_where_a_form_is_required(self):
        by_id = {}
        with open(SAMPLE, encoding="utf-8") as f:
            for p in json.load(f)["problems"]:
                by_id[p["id"]] = p
        self.assertEqual(check_answer("x^2+7x+12", by_id["FP-E-01"]).reason, "wrong_form")
        self.assertEqual(check_answer("\\frac{18}{24}", by_id["FD-E-01"]).reason, "wrong_form")
        self.assertEqual(check_answer("\\sqrt{18x^2}", by_id["RER-M-01"]).reason, "wrong_form")
        self.assertEqual(check_answer("(x+3)(x-5)", by_id["SP-E-01"]).reason, "wrong_form")
        self.assertEqual(check_answer("2x+y=10", by_id["L2V-E-02"]).reason, "wrong_form")


if __name__ == "__main__":
    unittest.main()
