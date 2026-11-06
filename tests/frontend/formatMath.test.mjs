import test from "node:test";
import assert from "node:assert/strict";
import { formatMath, blankToBox } from "../../frontend/lib/formatMath.ts";

const both = "\\frac{10}{x} = \\frac{25}{?}";
test("slash proportion", () => assert.equal(formatMath("10/x = 25/?"), both));
test("obelus matches slash", () => assert.equal(formatMath("10 ÷ x = 25 ÷ ?"), both));
test("\\div with negative", () => assert.equal(formatMath("-48 \\div 6 + 3"), "\\frac{-48}{6} + 3"));
test("parenthesised numerator", () => assert.equal(formatMath("(a+b)/5"), "\\frac{a+b}{5}"));
test("exponent stays with base", () => assert.equal(formatMath("(a+b)^2/5"), "\\frac{(a+b)^2}{5}"));
test("existing frac unchanged", () => assert.equal(formatMath("$\\frac{1}{2} + x$"), "$\\frac{1}{2} + x$"));
test("prose outside math untouched", () =>
  assert.equal(formatMath("$x/2$ is 1/2 of the total"), "$\\frac{x}{2}$ is 1/2 of the total"));
test("bare prose untouched", () => assert.equal(formatMath("Use and/or 3/4 of the pie"), "Use and/or 3/4 of the pie"));
test("text unit keeps slash", () => assert.equal(formatMath("$\\text{km/h} / 2$"), "$\\frac{\\text{km/h}}{2}$"));
test("blank in denominator", () =>
  assert.equal(formatMath(blankToBox("5/___ = 10/14")), "\\frac{5}{\\boxed{\\;?\\;}} = \\frac{10}{14}"));
test("idempotent", () => {
  for (const x of ["10/x = 25/?", "10 ÷ x = 25 ÷ ?", "-48 \\div 6 + 3", "$a/b/c$ and 1/2", "(a+b)^2/5"]) {
    assert.equal(formatMath(formatMath(x)), formatMath(x));
  }
});
test("adjacent groups multiply", () =>
  assert.equal(formatMath("(x + 1)(x + 2) / (x + 1) = ?"), "\\frac{(x + 1)(x + 2)}{x + 1} = ?"));
test("power over power", () => assert.equal(formatMath("x^5 / x^2 = x^(?)"), "\\frac{x^5}{x^2} = x^{?}"));
test("mixed number is one operand", () =>
  assert.equal(formatMath("$5 \\frac{1}{3} \\div 4$"), "$\\frac{5 \\frac{1}{3}}{4}$"));
