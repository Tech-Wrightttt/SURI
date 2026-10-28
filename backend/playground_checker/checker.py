"""
Public API of the Playground answer checker.

    check_answer(submitted_latex, problem) -> CheckResult

`problem` needs: answer, answer_type, accepted_variants, required_form, unit.
Pure standard-library code; no imports from backend.*.
"""

import math
import random
import re
from dataclasses import dataclass
from fractions import Fraction
from typing import Mapping

from .algebra import (
    FORM_CHECKS, EvalError, evaluate, needs_positive_points, sample_points, values_equal,
)
from .latex import ParseError, free_vars, has_text, normalize, parse


@dataclass(frozen=True)
class CheckResult:
    correct: bool
    reason: str  # "correct" | "not_equivalent" | "wrong_form" | "unparseable" | "empty"
    message: str


_OK = CheckResult(True, "correct", "Correct!")

_FORM_MESSAGES = {
    "factored": "That's equal to the answer, but it isn't fully factored yet.",
    "expanded": "That's equal to the answer, but it isn't fully expanded and simplified yet.",
    "lowest_terms": "That's equal to the answer, but the fraction isn't in lowest terms yet.",
    "simplest_radical": "That's equal to the answer, but the radical isn't fully simplified yet.",
    "positive_exponents": "That's equal to the answer, but it still has a negative or unsimplified exponent.",
    "slope_intercept": "That's equal to the answer, but it isn't in slope-intercept form (y = mx + b).",
}
_UNIT_MESSAGE = "Type just the number; the unit is already shown."
_FORMAT_HINTS = {
    "number": "Enter a single number.",
    "expression": "Enter an expression.",
    "equation": "Enter the full equation, e.g. y = ...",
    "solution_set": "Separate solutions with commas.",
    "ordered_pair": "Enter as (x, y).",
}


def _unparseable(answer_type: str, extra: str = "") -> CheckResult:
    base = "I couldn't read that answer. " + _FORMAT_HINTS.get(answer_type, "")
    return CheckResult(False, "unparseable", (extra or base).strip())


_NOT_EQUIVALENT = CheckResult(False, "not_equivalent", "Not quite. Try again.")


# --- helpers --------------------------------------------------------------------------

def _decimal_places(node):
    """Number of typed decimal places if node is a plain (optionally negative) decimal literal."""
    if node[0] == "neg":
        return _decimal_places(node[1])
    if node[0] == "num":
        return node[2]
    return None


def _number_match(sub_ast, sub_val, ans_val) -> bool:
    if values_equal(sub_val, ans_val):
        return True
    k = _decimal_places(sub_ast)
    if k is None or k < 2 or not isinstance(sub_val, Fraction):
        return False
    scale = 10 ** k
    x = Fraction(ans_val)
    mag = abs(x) * scale
    sign = -1 if x < 0 else 1
    rounded = Fraction(sign * math.floor(mag + Fraction(1, 2)), scale)
    truncated = Fraction(sign * math.floor(mag), scale)
    return sub_val in (rounded, truncated)


def _split_top(s: str) -> list:
    parts, depth, cur = [], 0, []
    i = 0
    while i < len(s):
        c = s[i]
        if s.startswith("\\{", i):
            depth += 1
            cur.append("\\{")
            i += 2
            continue
        if s.startswith("\\}", i):
            depth -= 1
            cur.append("\\}")
            i += 2
            continue
        if c in "([{":
            depth += 1
        elif c in ")]}":
            depth -= 1
        if c == "," and depth == 0:
            parts.append("".join(cur))
            cur = []
        else:
            cur.append(c)
        i += 1
    parts.append("".join(cur))
    return [p.strip() for p in parts]


_PREFIX = re.compile(r"^([A-Za-z])(?:_\{?\w+\}?)?\s*=(?!=)")


def _strip_prefix(elem: str):
    m = _PREFIX.match(elem)
    if m:
        return m.group(1), elem[m.end():].strip()
    return None, elem


def _expand_pm(elem: str) -> list:
    if "\\pm" not in elem:
        return [elem]
    out = []
    for sign in ("+", "-"):
        out.extend(_expand_pm(elem.replace("\\pm", sign, 1)))
    return out


def _outer_paren_strip(s: str) -> str:
    s = s.strip()
    if len(s) >= 2 and s[0] == "(" and s[-1] == ")":
        depth = 0
        for i, c in enumerate(s):
            if c == "(":
                depth += 1
            elif c == ")":
                depth -= 1
                if depth == 0 and i != len(s) - 1:
                    return s
        return s[1:-1]
    return s


class _Bad(Exception):
    def __init__(self, result):
        self.result = result


def _const_value(text: str, answer_type: str):
    """Parse a constant-valued element. Returns (ast, value). Raises _Bad."""
    try:
        ast = parse(text)
    except ParseError:
        raise _Bad(_unparseable(answer_type))
    if ast[0] == "eq" or has_text(ast):
        raise _Bad(_unparseable(answer_type))
    if free_vars(ast):
        raise _Bad(_NOT_EQUIVALENT)
    try:
        return ast, evaluate(ast, {})
    except EvalError:
        raise _Bad(_unparseable(answer_type))


def _form_ok(form: str, asts) -> bool:
    if form in ("none", "", None):
        return True
    check = FORM_CHECKS.get(form)
    return True if check is None else all(check(a) for a in asts)


def _finish(form: str, asts) -> CheckResult:
    if _form_ok(form, asts):
        return _OK
    return CheckResult(False, "wrong_form", _FORM_MESSAGES.get(form, "Right value, wrong form."))


def _list_elements(text: str, answer_type: str):
    """Split a solution-set / pair string into (prefix_letter, element_text) pairs."""
    s = normalize(text)
    s = re.sub(r"\\text\{\s*(?:or|and)\s*\}", ",", s)
    s = re.sub(r"(?<![A-Za-z\\])\s(?:or|and)\s", ",", " " + s + " ")
    s = s.strip()
    if s.startswith("\\{") and s.endswith("\\}"):
        s = s[2:-2].strip()
    if answer_type == "ordered_pair":
        s = _outer_paren_strip(s)
    return [_strip_prefix(e) for e in _split_top(s)]


# --- per-type checks ------------------------------------------------------------------

def _check_number(sub, ans, problem):
    try:
        sub_ast = parse(sub)
    except ParseError:
        return _unparseable("number")
    if sub_ast[0] == "eq":
        return _unparseable("number")
    unit = problem.get("unit")
    if has_text(sub_ast) or free_vars(sub_ast):
        if unit and unit != "%":
            return CheckResult(False, "unparseable", _UNIT_MESSAGE)
        if has_text(sub_ast):
            return _unparseable("number")
        return _NOT_EQUIVALENT
    try:
        sub_val = evaluate(sub_ast, {})
        ans_val = evaluate(parse(ans), {})
    except (EvalError, ParseError):
        return _unparseable("number")
    if not _number_match(sub_ast, sub_val, ans_val):
        return _NOT_EQUIVALENT
    return _finish(problem.get("required_form", "none"), [sub_ast])


def _agree_at_points(a_fn, b_fn, variables, positive, mode):
    """Compare two callables(env) over random rational points.
    mode 'value': values must be equal. mode 'ratio': a/b must be a nonzero constant."""
    rng = random.Random(20260511)
    good = 0
    ratio = None
    for pt in sample_points(variables, rng, 6, positive):
        try:
            a, b = a_fn(pt), b_fn(pt)
        except EvalError:
            continue
        if mode == "value":
            if not values_equal(a, b):
                return False
            good += 1
        else:
            a_zero = a == 0 if isinstance(a, Fraction) else abs(a) < 1e-12
            b_zero = b == 0 if isinstance(b, Fraction) else abs(b) < 1e-12
            if a_zero:
                if not b_zero:
                    return False
                good += 1
                continue
            if b_zero:
                return False
            r = b / a
            if ratio is None:
                ratio = r
            elif not values_equal(ratio, r):
                return False
            good += 1
        if good >= 6:
            break
    return good >= 3


def _check_expression(sub, ans, problem):
    try:
        sub_ast = parse(sub)
    except ParseError:
        return _unparseable("expression")
    if sub_ast[0] == "eq" or has_text(sub_ast):
        return _unparseable("expression")
    ans_ast = parse(ans)
    variables = free_vars(sub_ast) | free_vars(ans_ast)
    positive = needs_positive_points(sub_ast) or needs_positive_points(ans_ast)
    same = _agree_at_points(lambda e: evaluate(sub_ast, e), lambda e: evaluate(ans_ast, e),
                            variables, positive, "value")
    if not same:
        return _NOT_EQUIVALENT
    return _finish(problem.get("required_form", "none"), [sub_ast])


def _check_equation(sub, ans, problem):
    try:
        sub_ast = parse(sub)
    except ParseError:
        return _unparseable("equation")
    if sub_ast[0] != "eq" or has_text(sub_ast):
        return _unparseable("equation")
    ans_ast = parse(ans)
    if ans_ast[0] != "eq":
        return _NOT_EQUIVALENT

    def diff(ast):
        return lambda e: evaluate(ast[1], e) - evaluate(ast[2], e)

    variables = free_vars(sub_ast) | free_vars(ans_ast)
    positive = needs_positive_points(sub_ast) or needs_positive_points(ans_ast)
    if not _agree_at_points(diff(ans_ast), diff(sub_ast), variables, positive, "ratio"):
        return _NOT_EQUIVALENT
    return _finish(problem.get("required_form", "none"), [sub_ast])


def _elements_with_values(text, answer_type):
    """-> (prefix letters set, [(ast, value)]) with \\pm expanded. Raises _Bad."""
    letters = set()
    items = []
    for prefix, elem in _list_elements(text, answer_type):
        if prefix:
            letters.add(prefix)
        if not elem or "=" in elem:
            raise _Bad(_unparseable(answer_type))
        for e in _expand_pm(elem):
            items.append(_const_value(e, answer_type))
    return letters, items


def _check_solution_set(sub, ans, problem):
    try:
        letters, items = _elements_with_values(sub, "solution_set")
    except _Bad as bad:
        return bad.result
    if len(letters) > 1:
        return _NOT_EQUIVALENT
    _, ans_items = _elements_with_values(ans, "solution_set")

    def dedupe(pairs):
        out = []
        for ast, val in pairs:
            if not any(values_equal(val, v) for _, v in out):
                out.append((ast, val))
        return out

    items, ans_items = dedupe(items), dedupe(ans_items)
    if len(items) != len(ans_items):
        return _NOT_EQUIVALENT
    used = set()
    for _, av in ans_items:
        for i, (sast, sv) in enumerate(items):
            if i not in used and _number_match(sast, sv, av):
                used.add(i)
                break
        else:
            return _NOT_EQUIVALENT
    return _finish(problem.get("required_form", "none"), [a for a, _ in items])


def _pair_values(text):
    parts = _list_elements(text, "ordered_pair")
    if len(parts) != 2:
        raise _Bad(_unparseable("ordered_pair"))
    named = [p for p, _ in parts]
    if all(named):
        if named[0] == named[1]:
            raise _Bad(_unparseable("ordered_pair"))
        parts = sorted(parts, key=lambda pe: pe[0])
    elif any(named):
        raise _Bad(_unparseable("ordered_pair"))
    return [_const_value(e, "ordered_pair") for _, e in parts]


def _check_ordered_pair(sub, ans, problem):
    try:
        got = _pair_values(sub)
    except _Bad as bad:
        return bad.result
    want = _pair_values(ans)
    for (sast, sv), (_, av) in zip(got, want):
        if not _number_match(sast, sv, av):
            return _NOT_EQUIVALENT
    return _finish(problem.get("required_form", "none"), [a for a, _ in got])


_CHECKERS = {
    "number": _check_number,
    "expression": _check_expression,
    "equation": _check_equation,
    "solution_set": _check_solution_set,
    "ordered_pair": _check_ordered_pair,
}

_REASON_RANK = {"wrong_form": 3, "not_equivalent": 2, "unparseable": 1}


def check_answer(submitted_latex: str, problem: Mapping) -> CheckResult:
    text = (submitted_latex or "").strip()
    if problem.get("unit") == "%":
        text = re.sub(r"\s*\\?%\s*$", "", text)
    if not normalize(text):
        return CheckResult(False, "empty", "Type your answer first.")
    answer_type = problem["answer_type"]
    checker = _CHECKERS.get(answer_type)
    if checker is None:
        raise ValueError("unknown answer_type: " + str(answer_type))
    candidates = [problem["answer"]] + list(problem.get("accepted_variants") or [])
    best = None
    for cand in candidates:
        res = checker(text, cand, problem)
        if res.correct:
            return res
        if best is None or _REASON_RANK.get(res.reason, 0) > _REASON_RANK.get(best.reason, 0):
            best = res
    return best
