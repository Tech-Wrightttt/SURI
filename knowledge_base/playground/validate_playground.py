"""
validate_playground.py -- independently re-verify every generated candidate.

Run with the system Python (needs google-genai for the blind re-solve) and Node on PATH:
  C:\\Python314\\python.exe knowledge_base/playground/validate_playground.py
  C:\\Python314\\python.exe knowledge_base/playground/validate_playground.py --no-blind --only QE,FP

For every candidate in work/raw/*.json:
  1. check_answer(answer) must accept the stored answer (and every accepted variant);
  2. the answer is recomputed from `compute_expr` with mathjs / mathsteps (verify.js) -- never from
     the answer itself -- using the method for its answer_type;
  3. if a form is required, typing the original `compute_expr` back must be rejected;
  4. word problems also pass a blind re-solve: a second Gemini call sees only the prompt and unit.

Status per candidate: validated | needs_review | rejected | approved (by review) | rejected_by_review.
Outputs: work/validated/<tag>.json, work/needs_review.json, work/validation_report.json.
"""

import argparse
import hashlib
import json
import math
import os
import random
import re
import subprocess
import sys
from fractions import Fraction

HERE = os.path.dirname(os.path.abspath(__file__))
if HERE not in sys.path:
    sys.path.insert(0, HERE)

from pg_common import (  # noqa: E402
    BLIND_CACHE, BLIND_MODEL, DECISIONS, NEEDS_REVIEW, RAW_DIR, REPORT, ROOT, VALIDATED_DIR,
    ascii_to_latex, ascii_variables, content_hash, load_json, save_json,
)

from backend.playground_checker import check_answer  # noqa: E402
from backend.playground_checker.algebra import (  # noqa: E402
    EvalError, _has_rational_root, _to_int_coeffs, evaluate, needs_positive_points, sample_points, to_poly, univariate_coeffs, values_equal,
)
from backend.playground_checker.checker import _elements_with_values, _pair_values  # noqa: E402
from backend.playground_checker.latex import free_vars, parse  # noqa: E402

VERIFY_JS = os.path.join(HERE, "verify.js")


class Reject(Exception):
    """The verifier disagrees with the candidate, or the candidate is broken."""


class Review(Exception):
    """Cannot be confirmed automatically; a human should look."""


class Verifier:
    def __init__(self):
        self.proc = subprocess.Popen(
            ["node", VERIFY_JS], stdin=subprocess.PIPE, stdout=subprocess.PIPE,
            text=True, encoding="utf-8", bufsize=1,
        )
        self.n = 0

    def call(self, **req):
        self.n += 1
        req["id"] = self.n
        self.proc.stdin.write(json.dumps(req) + "\n")
        self.proc.stdin.flush()
        line = self.proc.stdout.readline()
        if not line:
            raise RuntimeError("verify.js exited unexpectedly")
        return json.loads(line)

    def eval(self, expr, scope=None):
        r = self.call(op="eval", expr=expr, scope=scope or {})
        if not r["ok"]:
            raise EvalError(r["error"])
        return r["result"]

    def residual(self, eq, scope):
        r = self.call(op="residual", eq=eq, scope=scope)
        if not r["ok"]:
            raise EvalError(r["error"])
        return r["result"]

    def solve(self, eq):
        r = self.call(op="solve", eq=eq)
        return r["result"] if r["ok"] else None

    def close(self):
        try:
            self.proc.stdin.close()
            self.proc.wait(timeout=5)
        except Exception:
            self.proc.kill()


def close_enough(a, b) -> bool:
    return math.isclose(float(a), float(b), rel_tol=1e-6, abs_tol=1e-9)


def val(latex: str):
    ast = parse(latex)
    return ast, evaluate(ast, {})


def clean_candidate(c: dict) -> bool:
    """Fix common Gemini quirks in place. Returns True if the candidate changed."""
    changed = False
    m = re.fullmatch(r"\s*\\(?:text|mathrm)\{([^{}]*)\}\s*", c["answer"])
    if m:
        c["answer"], changed = m.group(1).strip(), True
    stripped = c["answer"].strip().strip("$").strip()
    if stripped != c["answer"]:
        c["answer"], changed = stripped, True
    if "$$" not in c["prompt"]:
        wrapped = re.sub(r"(\\begin\{align\*?\}.*?\\end\{align\*?\})", r"$$\1$$", c["prompt"], flags=re.S)
        wrapped = wrapped.replace("{align*}", "{aligned}").replace("{align}", "{aligned}")
        if wrapped != c["prompt"]:
            c["prompt"], changed = wrapped, True
    if c.get("unit") and c["answer_type"] != "number":
        c["unit"], changed = None, True  # units are display-only suffixes for number answers
    return changed


# --- shared checks --------------------------------------------------------------------

_NOT_ENGLISH = re.compile(r"\b(ang|ay|si|ni|kay|ng|mga|kung|taong|siya|nagbayad|bumili|na|sa)\b", re.I)


def universal_checks(c: dict):
    if len(_NOT_ENGLISH.findall(re.sub(r"\$[^$]*\$", " ", c["prompt"]))) >= 3:
        raise Reject("prompt does not look like English")
    unit, atype = c.get("unit"), c["answer_type"]
    if unit == "%" and atype != "number":
        raise Reject("unit % requires answer_type number")
    if unit and atype != "number":
        raise Reject("a unit is only allowed on number answers")
    res = check_answer(c["answer"], c)
    if not res.correct:
        raise Reject(f"checker rejects its own answer ({res.reason}: {res.message})")
    for v in c.get("accepted_variants") or []:
        if not check_answer(v, c).correct:
            raise Reject(f"accepted variant {v!r} is not accepted by the checker")


def typed_back_check(c: dict):
    """If a form is required, the original compute_expr must NOT be accepted."""
    # Number answers are skipped: a bare arithmetic expression such as 1/2+1/4 is a legitimate way to
    # type a number, so only symbolic expressions are held to this test.
    if c["required_form"] == "none" or c["answer_type"] != "expression":
        return ""
    try:
        latex = ascii_to_latex(c["compute_expr"])
    except ValueError:
        return " (typed-back test skipped: compute_expr not convertible)"
    res = check_answer(latex, c)
    if res.correct:
        raise Review("typing the original expression back is accepted as correct")
    return ""


# --- per-type verification ------------------------------------------------------------

def v_number_equation(c, v, ans_val):
    """compute_expr is an equation such as 2*x+3=11 whose solution is the numeric answer."""
    ce = c["compute_expr"]
    names = ascii_variables(ce)
    if ce.count("=") != 1 or len(names) != 1:
        raise Review("number answer with an equation needs exactly one variable")
    try:
        res = v.residual(ce, {names[0]: float(ans_val)})
    except EvalError as exc:
        raise Review(f"mathjs could not evaluate: {exc}")
    if abs(res) > 1e-6:
        raise Reject(f"{names[0]}={float(ans_val):g} does not satisfy {ce} (residual {res:g})")
    notes = "answer satisfies the equation"
    solved = v.solve(ce.replace(" ", ""))
    if solved and solved["ascii"].split("=")[0].strip() == names[0]:
        if not any(close_enough(r, ans_val) for r in solved["roots"]) or len(solved["roots"]) != 1:
            raise Reject(f"mathsteps solves {ce} as {solved['ascii']}")
        notes += "; mathsteps agrees"
    return "residual", notes


def v_number(c, v):
    ans_ast, ans_val = val(c["answer"])
    if free_vars(ans_ast):
        raise Reject("number answer contains variables")
    if "=" in c["compute_expr"]:
        return v_number_equation(c, v, ans_val)
    try:
        got = v.eval(c["compute_expr"])
    except EvalError as exc:
        raise Review(f"mathjs could not evaluate compute_expr: {exc}")
    if not close_enough(got, ans_val):
        raise Reject(f"mathjs computes {got} but the answer is {float(ans_val)}")
    notes = f"mathjs {got:g}"
    if needs_positive_points(ans_ast):
        notes += "; radical form judged by the checker only"
    notes += typed_back_check(c)
    return "mathjs_eval", notes


def v_expression(c, v):
    ce = c["compute_expr"]
    ans_ast = parse(c["answer"])
    names = ascii_variables(ce)
    if free_vars(ans_ast) - set(names):
        raise Review("answer uses variables that compute_expr does not")
    positive = needs_positive_points(ans_ast) or "sqrt(" in ce or "nthRoot(" in ce or "^(" in ce
    rng = random.Random(77)
    good = 0
    for pt in sample_points(set(names), rng, 6, positive):
        try:
            got = v.eval(ce, {k: float(x) for k, x in pt.items()})
            want = evaluate(ans_ast, pt)
        except EvalError:
            continue
        if not close_enough(got, want):
            raise Reject(f"at {dict((k, str(x)) for k, x in pt.items())} mathjs gives {got} but the answer gives {float(want)}")
        good += 1
        if good >= 6:
            break
    if good < 3:
        raise Review("too few valid sample points")
    return "mathjs_points", "checked at %d points%s" % (good, typed_back_check(c))


def _answer_rhs_for_y(c):
    ast = parse(c["answer"])
    if ast[0] != "eq" or ast[1] != ("var", "y"):
        raise Review("equation answer is not of the form y = ...")
    return ast[2]


def v_equation(c, v):
    rhs = _answer_rhs_for_y(c)
    items = [s.strip() for s in c["compute_expr"].split(";") if s.strip()]
    if not items:
        raise Review("no checks given for the equation")
    checked = 0
    for item in items:
        m = re.fullmatch(r"pt\(\s*([^,]+?)\s*,\s*([^)]+?)\s*\)", item)
        if m:
            x, y = Fraction(m.group(1)), Fraction(m.group(2))
            if not values_equal(evaluate(rhs, {"x": x}), y):
                raise Reject(f"line does not pass through ({x}, {y})")
            checked += 1
        elif "=" in item:
            for x in (Fraction(1), Fraction(2), Fraction(-3), Fraction(5, 2)):
                y = evaluate(rhs, {"x": x})
                try:
                    r = v.residual(item, {"x": float(x), "y": float(y)})
                except EvalError as exc:
                    raise Review(f"mathjs could not evaluate {item!r}: {exc}")
                if abs(r) > 1e-6:
                    raise Reject(f"points on the answer line do not satisfy {item!r} (residual {r:g})")
            checked += 1
        else:
            raise Review(f"unrecognised check {item!r}")
    return "substitution", f"{checked} check(s) passed"


def _deflate(coeffs, root: Fraction):
    """Divide an ascending-coefficient polynomial by (x - root). Returns quotient or None."""
    desc = list(reversed(coeffs))
    out, carry = [], Fraction(0)
    for c in desc:
        carry = carry * root + c
        out.append(carry)
    if out[-1] != 0:
        return None
    return list(reversed(out[:-1]))


def v_solution_set(c, v):
    ce = c["compute_expr"]
    if ce.count("=") != 1:
        raise Review("compute_expr must be one equation")
    names = ascii_variables(ce)
    if len(names) != 1:
        raise Review("solution_set needs a single-variable equation")
    var = names[0]
    _, items = _elements_with_values(c["answer"], "solution_set")
    roots = []
    for _, r in items:
        if not any(values_equal(r, q) for q in roots):
            roots.append(r)
    for r in roots:
        try:
            res = v.residual(ce, {var: float(r)})
        except EvalError as exc:
            raise Review(f"mathjs could not evaluate: {exc}")
        if abs(res) > 1e-6:
            raise Reject(f"{var}={float(r):g} does not satisfy {ce} (residual {res:g})")
    notes = [f"{len(roots)} root(s) satisfy the equation"]
    if not all(isinstance(r, Fraction) for r in roots):
        raise Review("irrational roots: completeness not provable automatically")
    left, right = ce.split("=")
    try:
        poly = to_poly(parse(f"({ascii_to_latex(left)})-({ascii_to_latex(right)})"))
    except ValueError:
        poly = None
    if not poly:
        raise Review("compute_expr is not a polynomial equation")
    coeffs = univariate_coeffs(poly, var)
    for r in roots:
        while len(coeffs) > 1:
            q = _deflate(coeffs, r)
            if q is None:
                break
            coeffs = q
    deg = len(coeffs) - 1
    if deg == 0:
        notes.append("all roots accounted for (deflation)")
    elif deg == 2 and coeffs[1] ** 2 - 4 * coeffs[0] * coeffs[2] < 0:
        notes.append("remaining factor has no real roots")
    else:
        ints = _to_int_coeffs(coeffs)
        if deg >= 1 and _has_rational_root(ints):
            raise Reject("answer is missing a root of the equation")
        raise Review(f"roots are incomplete or unproven (remaining degree {deg})")
    if len(poly) and max(len(univariate_coeffs(poly, var)) - 1, 0) <= 2:
        solved = v.solve(ce.replace(" ", ""))
        if solved and solved["ascii"].split("=")[0].strip() == var:
            want = sorted(float(r) for r in roots)
            got = sorted(set(round(x, 9) for x in solved["roots"]))
            if len(want) != len(got) or any(abs(a - b) > 1e-6 for a, b in zip(want, got)):
                raise Reject(f"mathsteps solves {ce} as {solved['ascii']}")
            notes.append("mathsteps agrees")
    return "residual+identity", "; ".join(notes)


def v_ordered_pair(c, v):
    eqs = [s.strip() for s in c["compute_expr"].split(";") if s.strip()]
    names = sorted(set(n for e in eqs for n in ascii_variables(e)))
    if len(names) != 2 or not eqs:
        raise Review("ordered_pair needs equations in exactly two variables")
    pair = _pair_values(c["answer"])
    scope = {names[0]: float(pair[0][1]), names[1]: float(pair[1][1])}
    for e in eqs:
        try:
            r = v.residual(e, scope)
        except EvalError as exc:
            raise Review(f"mathjs could not evaluate {e!r}: {exc}")
        if abs(r) > 1e-6:
            raise Reject(f"point does not satisfy {e!r} (residual {r:g})")
    notes = [f"{len(eqs)} equation(s) satisfied"]
    if len(eqs) == 2:
        rows = []
        for e in eqs:
            r00 = v.residual(e, {names[0]: 0, names[1]: 0})
            rows.append((v.residual(e, {names[0]: 1, names[1]: 0}) - r00,
                         v.residual(e, {names[0]: 0, names[1]: 1}) - r00))
        det = rows[0][0] * rows[1][1] - rows[1][0] * rows[0][1]
        if abs(det) < 1e-9:
            raise Reject("system has no unique solution (determinant 0)")
        notes.append("unique solution (determinant != 0)")
    return "substitution", "; ".join(notes)


VERIFIERS = {
    "number": v_number, "expression": v_expression, "equation": v_equation,
    "solution_set": v_solution_set, "ordered_pair": v_ordered_pair,
}


def node_check(c, v):
    """-> (status, method, notes)."""
    try:
        universal_checks(c)
        method, notes = VERIFIERS[c["answer_type"]](c, v)
        return "validated", method, notes
    except Reject as exc:
        return "rejected", "node_check", str(exc)
    except Review as exc:
        return "needs_review", "node_check", str(exc)
    except Exception as exc:  # parse errors on malformed candidates
        return "rejected", "node_check", f"{exc.__class__.__name__}: {exc}"


# --- blind re-solve -------------------------------------------------------------------

FORMAT_HINT = {
    "number": "a single number (no units, no % sign)",
    "expression": "an algebraic expression",
    "equation": "an equation such as y=2x+3",
    "solution_set": "all solutions separated by commas, e.g. 2, 3",
    "ordered_pair": "an ordered pair such as (6, 4)",
}


def blind_prompt(batch) -> str:
    lines = []
    for c in batch:
        unit = f' (the unit "{c["unit"]}" is shown separately; do not include it)' if c.get("unit") else ""
        lines.append(f'- id "{c["cand_id"]}" | answer format: {FORMAT_HINT[c["answer_type"]]}{unit}\n  {c["prompt"]}')
    return (
        "Solve each of these math problems carefully. Give ONLY the final answer for each, written in LaTeX "
        "the way a student would type it.\n\n" + "\n".join(lines) +
        '\n\nReturn ONLY a JSON array of objects {"id": "...", "answer": "..."}. '
        "Escape every backslash in the JSON (write \\\\frac for \\frac)."
    )


def blind_resolve(client, batch, cache) -> dict:
    """-> {cand_id: answer string} using the cache and one Gemini call for the misses."""
    from generate_playground import call_with_retry, parse_gemini_json
    from google.genai import types as gtypes

    def key(c):
        return c["cand_id"] + ":" + hashlib.sha256(c["prompt"].encode("utf-8")).hexdigest()[:12]

    todo = [c for c in batch if key(c) not in cache]
    if todo:
        resp = call_with_retry(
            client, model=BLIND_MODEL, contents=blind_prompt(todo),
            config=gtypes.GenerateContentConfig(response_mime_type="application/json", temperature=0.0),
        )
        data = parse_gemini_json(resp.text)
        by_id = {str(d.get("id")): str(d.get("answer", "")) for d in data}
        for c in todo:
            if c["cand_id"] in by_id:
                cache[key(c)] = by_id[c["cand_id"]]
    return {c["cand_id"]: cache.get(key(c)) for c in batch}


def compare_blind(c, blind_answer):
    if not blind_answer:
        return False, "no blind answer returned"
    probe = dict(c, required_form="none", accepted_variants=[])
    res = check_answer(blind_answer, probe)
    if res.correct:
        return True, f"blind answer {blind_answer!r} matches"
    return False, f"blind answer {blind_answer!r} differs from stored {c['answer']!r} ({res.reason})"


# --- driver ---------------------------------------------------------------------------

def main():
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--only", help="comma-separated node ids")
    ap.add_argument("--difficulty", default=None, help="only this difficulty (default: all raw files)")
    ap.add_argument("--no-blind", action="store_true", help="skip the Gemini blind re-solve for word problems")
    args = ap.parse_args()

    only = set(args.only.split(",")) if args.only else None
    files = sorted(f for f in os.listdir(RAW_DIR) if f.endswith(".json")) if os.path.isdir(RAW_DIR) else []
    decisions = load_json(DECISIONS, {})
    cache = load_json(BLIND_CACHE, {})
    client = None
    if not args.no_blind:
        from dotenv import load_dotenv
        from google import genai

        load_dotenv(os.path.join(ROOT, ".env"))
        key = os.environ.get("GEMINI_API_KEY")
        if not key:
            sys.exit("ERROR: GEMINI_API_KEY not found (or pass --no-blind).")
        client = genai.Client(api_key=key)

    verifier = Verifier()
    report = load_json(REPORT, {})
    old_queue = load_json(NEEDS_REVIEW, [])
    review_queue, processed = [], set()
    try:
        for name in files:
            node_id, difficulty = name[:-5].split("-", 1)
            if (only and node_id not in only) or (args.difficulty and difficulty != args.difficulty):
                continue
            raw_path = os.path.join(RAW_DIR, name)
            cands = load_json(raw_path)
            if any([clean_candidate(c) for c in cands]):
                save_json(raw_path, cands)
            results = []
            for c in cands:
                h = content_hash(c)
                decided = decisions.get(h)
                if decided == "rejected":
                    results.append((c, "rejected_by_review", "review", "rejected during review"))
                    continue
                status, method, notes = node_check(c, verifier)
                if decided == "approved":
                    status, method, notes = "approved", "review", "approved by reviewer; " + notes
                results.append((c, status, method, notes))

            if client is not None:
                words = [r[0] for r in results if r[1] == "validated" and r[0]["style"] == "word"]
                if words:
                    print(f"{name}: blind re-solving {len(words)} word problem(s)")
                    try:
                        answers = blind_resolve(client, words, cache)
                        save_json(BLIND_CACHE, cache)
                    except Exception as exc:
                        print(f"  blind re-solve failed: {exc}")
                        answers = {}
                    fixed = []
                    for c, status, method, notes in results:
                        if status == "validated" and c["style"] == "word":
                            ok, msg = compare_blind(c, answers.get(c["cand_id"]))
                            if ok:
                                status, method, notes = "validated", "blind_resolve", notes + "; " + msg
                            else:
                                status, notes = "needs_review", notes + "; " + msg
                        fixed.append((c, status, method, notes))
                    results = fixed
            else:
                results = [(c, "needs_review" if (s == "validated" and c["style"] == "word") else s, m,
                            n + ("; blind re-solve skipped" if (s == "validated" and c["style"] == "word") else ""))
                           for c, s, m, n in results]

            good = []
            for c, status, method, notes in results:
                processed.add(c["cand_id"])
                c["validation"] = {"status": status, "method": method, "notes": notes}
                report[c["cand_id"]] = dict(c["validation"], content_hash=content_hash(c))
                if status in ("validated", "approved"):
                    good.append(c)
                elif status == "needs_review":
                    review_queue.append(c)
            save_json(os.path.join(VALIDATED_DIR, name), good)
            counts = {}
            for _, status, _, _ in results:
                counts[status] = counts.get(status, 0) + 1
            print(f"{name}: {counts}")
    finally:
        verifier.close()

    review_queue = [c for c in old_queue if c["cand_id"] not in processed] + review_queue
    save_json(NEEDS_REVIEW, review_queue)
    save_json(REPORT, report)
    print(f"\n{len(report)} candidates, {len(review_queue)} in work/needs_review.json")


if __name__ == "__main__":
    main()
