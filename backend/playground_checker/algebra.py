"""
Evaluation, polynomial canonical forms, and required-form predicates over latex.py ASTs.

Exact Fraction arithmetic is used wherever possible; results fall back to float only when a
radical or fractional power has no exact rational value. Standard library only.
"""

import math
from fractions import Fraction
from itertools import product

from .latex import free_vars


class EvalError(ArithmeticError):
    """A point where the expression is undefined (pole, even root of a negative, overflow)."""


# --- evaluation -----------------------------------------------------------------------

def _iroot(n: int, k: int):
    """Exact integer k-th root of n >= 0, or None."""
    if n < 0:
        return None
    if n in (0, 1):
        return n
    r = round(n ** (1.0 / k)) if n < 2 ** 1000 else None
    if r is None:
        return None
    for cand in (r - 1, r, r + 1):
        if cand >= 0 and cand ** k == n:
            return cand
    return None


def _frac_root(x: Fraction, k: int):
    """Exact rational k-th root of x, or None."""
    if x < 0:
        if k % 2 == 0:
            return None
        r = _frac_root(-x, k)
        return None if r is None else -r
    a = _iroot(x.numerator, k)
    b = _iroot(x.denominator, k)
    if a is None or b is None:
        return None
    return Fraction(a, b)


def _root(x, k: int):
    if isinstance(x, Fraction):
        r = _frac_root(x, k)
        if r is not None:
            return r
        x = float(x)
    if x < 0:
        if k % 2 == 0:
            raise EvalError("even root of a negative")
        return -((-x) ** (1.0 / k))
    return x ** (1.0 / k)


def _power(base, exp):
    if isinstance(exp, Fraction) and exp.denominator == 1:
        e = exp.numerator
        if isinstance(base, Fraction):
            if base == 0 and e < 0:
                raise EvalError("zero to a negative power")
            if abs(e) > 64:
                raise EvalError("exponent too large")
            return base ** e
        try:
            return base ** e
        except (OverflowError, ZeroDivisionError):
            raise EvalError("bad power")
    if isinstance(exp, Fraction):
        r = _root(base, exp.denominator)
        return _power(r, Fraction(exp.numerator))
    try:
        if base < 0:
            raise EvalError("negative base with non-integer exponent")
        return float(base) ** float(exp)
    except (OverflowError, ZeroDivisionError):
        raise EvalError("bad power")


def evaluate(node, env: dict):
    """Evaluate an AST at the variable values in env. Returns Fraction or float."""
    tag = node[0]
    if tag == "num":
        return node[1]
    if tag == "var":
        if node[1] not in env:
            raise EvalError("unbound variable " + node[1])
        return env[node[1]]
    if tag == "pi":
        return math.pi
    if tag == "text":
        raise EvalError("text in expression")
    if tag == "neg":
        return -evaluate(node[1], env)
    if tag == "add":
        total = Fraction(0)
        for t in node[1]:
            total = total + evaluate(t, env)
        return total
    if tag == "mul":
        total = Fraction(1)
        for t in node[1]:
            total = total * evaluate(t, env)
        return total
    if tag == "div":
        d = evaluate(node[2], env)
        if d == 0:
            raise EvalError("division by zero")
        return evaluate(node[1], env) / d
    if tag == "pow":
        return _power(evaluate(node[1], env), evaluate(node[2], env))
    if tag == "sqrt":
        k = 2
        if node[2] is not None:
            kv = evaluate(node[2], env)
            if not (isinstance(kv, Fraction) and kv.denominator == 1 and kv >= 1):
                raise EvalError("bad root index")
            k = kv.numerator
        return _root(evaluate(node[1], env), k)
    if tag == "mixed":
        return node[1] + node[2] / node[3]
    raise EvalError("cannot evaluate " + tag)


def values_equal(a, b, rel: float = 1e-9) -> bool:
    if isinstance(a, Fraction) and isinstance(b, Fraction):
        return a == b
    a, b = float(a), float(b)
    return math.isclose(a, b, rel_tol=rel, abs_tol=1e-12)


def needs_positive_points(node) -> bool:
    """True when the expression has radicals or fractional powers (variables are assumed >= 0)."""
    tag = node[0]
    if tag == "sqrt":
        return True
    if tag == "pow":
        e = node[2]
        if not (e[0] == "num" and e[1].denominator == 1) and not (
                e[0] == "neg" and e[1][0] == "num" and e[1][1].denominator == 1):
            return True
    if tag in ("add", "mul"):
        return any(needs_positive_points(c) for c in node[1])
    if tag == "neg":
        return needs_positive_points(node[1])
    if tag in ("div", "pow", "eq"):
        return needs_positive_points(node[1]) or needs_positive_points(node[2])
    return False


def sample_points(variables, rng, count: int = 6, positive: bool = False):
    """Yield dicts of random rational values for the given variables."""
    names = sorted(variables)
    for _ in range(count * 12):
        pt = {}
        for v in names:
            n = rng.randint(1, 13)
            d = rng.randint(1, 4)
            sign = 1 if positive or rng.random() < 0.6 else -1
            pt[v] = Fraction(sign * n, d)
        yield pt


# --- polynomial canonical form --------------------------------------------------------

def _padd(a, b):
    out = dict(a)
    for m, c in b.items():
        out[m] = out.get(m, 0) + c
        if out[m] == 0:
            del out[m]
    return out


def _pmul(a, b):
    out = {}
    for m1, c1 in a.items():
        for m2, c2 in b.items():
            d = dict(m1)
            for v, e in m2:
                d[v] = d.get(v, 0) + e
            m = tuple(sorted(d.items()))
            out[m] = out.get(m, 0) + c1 * c2
            if out[m] == 0:
                del out[m]
    return out


def to_poly(node):
    """AST -> {monomial: Fraction} (monomial = sorted tuple of (var, exp)), or None if not a polynomial."""
    tag = node[0]
    if tag == "num":
        return {(): node[1]} if node[1] != 0 else {}
    if tag == "mixed":
        v = node[1] + node[2] / node[3]
        return {(): v} if v != 0 else {}
    if tag == "var":
        return {((node[1], 1),): Fraction(1)}
    if tag == "neg":
        p = to_poly(node[1])
        return None if p is None else {m: -c for m, c in p.items()}
    if tag == "add":
        out = {}
        for t in node[1]:
            p = to_poly(t)
            if p is None:
                return None
            out = _padd(out, p)
        return out
    if tag == "mul":
        out = {(): Fraction(1)}
        for t in node[1]:
            p = to_poly(t)
            if p is None:
                return None
            out = _pmul(out, p)
        return out
    if tag == "div":
        num = to_poly(node[1])
        den = to_poly(node[2])
        if num is None or den is None or set(den) - {()} or not den:
            return None
        d = den[()]
        return {m: c / d for m, c in num.items()}
    if tag == "pow":
        base = to_poly(node[1])
        e = node[2]
        if base is None or e[0] != "num" or e[1].denominator != 1 or not (0 <= e[1] <= 12):
            return None
        out = {(): Fraction(1)}
        for _ in range(int(e[1])):
            out = _pmul(out, base)
        return out
    return None


def poly_degree_vars(poly):
    vs = set()
    for m in poly:
        for v, _ in m:
            vs.add(v)
    return vs


def univariate_coeffs(poly, var):
    """Ascending coefficient list for a polynomial in a single variable."""
    deg = max((dict(m).get(var, 0) for m in poly), default=0)
    out = [Fraction(0)] * (deg + 1)
    for m, c in poly.items():
        out[dict(m).get(var, 0)] = c
    return out


# --- irreducibility over Q ------------------------------------------------------------

def _divisors(n: int):
    n = abs(n)
    if n == 0:
        return [0]
    out = []
    i = 1
    while i * i <= n:
        if n % i == 0:
            out.append(i)
            if i != n // i:
                out.append(n // i)
        i += 1
    return sorted(out)


def _to_int_coeffs(coeffs):
    lcm = 1
    for c in coeffs:
        lcm = lcm * c.denominator // math.gcd(lcm, c.denominator)
    ints = [int(c * lcm) for c in coeffs]
    g = 0
    for c in ints:
        g = math.gcd(g, abs(c))
    return [c // g for c in ints] if g else ints


def _eval_int_poly(coeffs, x: Fraction):
    r = Fraction(0)
    for c in reversed(coeffs):
        r = r * x + c
    return r


def _has_rational_root(ints):
    if ints[0] == 0:
        return True
    for p in _divisors(ints[0]):
        for q in _divisors(ints[-1]):
            for sign in (1, -1):
                if _eval_int_poly(ints, Fraction(sign * p, q)) == 0:
                    return True
    return False


def _divides_exactly(ints, quad):
    """Does the integer quadratic (c, b, a ascending) divide the integer polynomial exactly?"""
    rem = [Fraction(c) for c in ints]
    a = Fraction(quad[2])
    for i in range(len(rem) - 1, 1, -1):
        q = rem[i] / a
        if q:
            rem[i] -= q * quad[2]
            rem[i - 1] -= q * quad[1]
            rem[i - 2] -= q * quad[0]
    return rem[0] == 0 and rem[1] == 0


def _has_quadratic_factor(ints):
    bound = min(sum(abs(c) for c in ints), 200)
    for a in _divisors(ints[-1]):
        for c in _divisors(ints[0]):
            for sc in (1, -1):
                for b in range(-bound, bound + 1):
                    quad = (sc * c, b, a)
                    if quad[0] == 0:
                        continue
                    if _divides_exactly(ints, quad):
                        return True
    return False


def univariate_irreducible(coeffs) -> bool:
    """Irreducible over Q? Exact for degree <= 5; for higher degrees only linear and
    quadratic factors are searched."""
    while coeffs and coeffs[-1] == 0:
        coeffs = coeffs[:-1]
    deg = len(coeffs) - 1
    if deg <= 0:
        return False
    if deg == 1:
        return True
    ints = _to_int_coeffs(coeffs)
    if _has_rational_root(ints):
        return False
    if deg <= 3:
        return True
    return not _has_quadratic_factor(ints)


def poly_irreducible(poly) -> bool:
    vs = sorted(poly_degree_vars(poly))
    if not vs:
        return False
    total = max(sum(e for _, e in m) for m in poly)
    if total == 1:
        return True
    if len(vs) == 1:
        return univariate_irreducible(univariate_coeffs(poly, vs[0]))
    # multivariate: monomial content means a variable factors out
    common = None
    for m in poly:
        s = {v for v, _ in m}
        common = s if common is None else common & s
    if common:
        return False
    # Hilbert-style check: substitute integers for all but one variable
    for v in vs:
        others = [o for o in vs if o != v]
        for vals in product([1, 2, 3, 5], repeat=len(others)):
            env = dict(zip(others, vals))
            degv = max(dict(m).get(v, 0) for m in poly)
            coeffs = [Fraction(0)] * (degv + 1)
            for m, c in poly.items():
                d = dict(m)
                term = c
                for o in others:
                    term *= Fraction(env[o]) ** d.get(o, 0)
                coeffs[d.get(v, 0)] += term
            if len(coeffs) - 1 == degv and coeffs[-1] != 0 and univariate_irreducible(coeffs):
                return True
        # no substitution kept the degree irreducible for this variable
    return False


# --- monomials and form predicates ----------------------------------------------------

def monomial_info(node):
    """If node is a single monomial with no parentheses, return (coef, {var: exp}); else None."""
    tag = node[0]
    if tag == "num":
        return node[1], {}
    if tag == "var":
        return Fraction(1), {node[1]: 1}
    if tag == "neg":
        r = monomial_info(node[1])
        return None if r is None else (-r[0], r[1])
    if tag == "pow":
        b, e = node[1], node[2]
        if b[0] == "var" and e[0] == "num" and e[1].denominator == 1 and e[1] >= 1:
            return Fraction(1), {b[1]: int(e[1])}
        return None
    if tag == "div":
        top = monomial_info(node[1])
        bot = node[2]
        if top is None or bot[0] != "num" or bot[1] == 0:
            return None
        return top[0] / bot[1], top[1]
    if tag == "mul":
        coef = Fraction(1)
        vars_ = {}
        for f in node[1]:
            r = monomial_info(f)
            if r is None:
                return None
            coef *= r[0]
            for v, e in r[1].items():
                vars_[v] = vars_.get(v, 0) + e
        return coef, vars_
    return None


def is_expanded(node) -> bool:
    terms = node[1] if node[0] == "add" else [node]
    seen = set()
    for t in terms:
        info = monomial_info(t)
        if info is None:
            return False
        key = tuple(sorted(info[1].items()))
        if key in seen:
            return False
        seen.add(key)
    return True


def _collect_factors(node, consts, factors):
    tag = node[0]
    if tag == "neg":
        consts.append(Fraction(-1))
        _collect_factors(node[1], consts, factors)
    elif tag == "mul":
        for f in node[1]:
            _collect_factors(f, consts, factors)
    elif tag == "num":
        consts.append(node[1])
    elif tag == "pow" and node[2][0] == "num" and node[2][1].denominator == 1 and node[2][1] >= 1:
        factors.append(node[1])
    else:
        factors.append(node)


def is_factored(node) -> bool:
    consts, factors = [], []
    _collect_factors(node, consts, factors)
    k = Fraction(1)
    for c in consts:
        k *= c
    if k.denominator != 1:
        return False
    if not factors:
        return False
    for f in factors:
        poly = to_poly(f)
        if poly is None or not poly:
            return False
        if all(c.denominator == 1 for c in poly.values()):
            g = 0
            for c in poly.values():
                g = math.gcd(g, abs(int(c)))
            if g != 1:
                return False
        else:
            return False
        if not poly_irreducible(poly):
            return False
    return True


def _int_literal_value(node):
    if node[0] == "num" and node[1].denominator == 1:
        return int(node[1])
    if node[0] == "neg":
        v = _int_literal_value(node[1])
        return None if v is None else -v
    return None


def is_lowest_terms(node) -> bool:
    tag = node[0]
    if tag == "mixed":
        n, d = int(node[2]), int(node[3])
        return d != 0 and math.gcd(n, d) == 1 and 0 < n < d
    if tag == "div":
        a, b = _int_literal_value(node[1]), _int_literal_value(node[2])
        if a is not None and b is not None:
            if b in (0, 1, -1) or math.gcd(a, b) != 1:
                return False
            return True
        for sub in (node[1], node[2]):
            if _contains_div(sub):
                return False
        return is_lowest_terms(node[1]) and is_lowest_terms(node[2])
    if tag in ("add", "mul"):
        return all(is_lowest_terms(c) for c in node[1])
    if tag == "neg":
        return is_lowest_terms(node[1])
    if tag in ("pow", "eq"):
        return is_lowest_terms(node[1]) and is_lowest_terms(node[2])
    if tag == "sqrt":
        return is_lowest_terms(node[1])
    return True


def _contains_div(node) -> bool:
    if node[0] == "div":
        return True
    if node[0] in ("add", "mul"):
        return any(_contains_div(c) for c in node[1])
    if node[0] == "neg":
        return _contains_div(node[1])
    if node[0] in ("pow", "eq"):
        return _contains_div(node[1]) or _contains_div(node[2])
    if node[0] == "sqrt":
        return _contains_div(node[1])
    return False


def _contains_sqrt(node) -> bool:
    if node[0] == "sqrt":
        return True
    if node[0] in ("add", "mul"):
        return any(_contains_sqrt(c) for c in node[1])
    if node[0] == "neg":
        return _contains_sqrt(node[1])
    if node[0] in ("div", "pow", "eq"):
        return _contains_sqrt(node[1]) or _contains_sqrt(node[2])
    return False


def _power_free(n: int, k: int) -> bool:
    """n has no prime factor with multiplicity >= k."""
    if n < 1:
        return False
    p = 2
    while p * p <= n:
        e = 0
        while n % p == 0:
            n //= p
            e += 1
        if e >= k:
            return False
        p += 1
    return True  # leftover prime has multiplicity 1 (k >= 2)


def is_simplest_radical(node) -> bool:
    tag = node[0]
    if tag == "sqrt":
        k = 2
        if node[2] is not None:
            kv = _int_literal_value(node[2])
            if kv is None or kv < 2:
                return False
            k = kv
        rad = node[1]
        if _contains_sqrt(rad):
            return False
        info = monomial_info(rad)
        if info is not None:
            coef, vars_ = info
            if coef.denominator != 1 or coef < 1 or not _power_free(int(coef), k):
                return False
            if any(e >= k for e in vars_.values()):
                return False
            return True
        if _contains_div(rad):
            return False
        return True
    if tag == "div":
        if _contains_sqrt(node[2]):
            return False
        a, b = _int_literal_value(node[1]), _int_literal_value(node[2])
        if a is not None and b is not None and (b in (0, 1, -1) or math.gcd(a, b) != 1):
            return False
        return is_simplest_radical(node[1]) and is_simplest_radical(node[2])
    if tag in ("add", "mul"):
        return all(is_simplest_radical(c) for c in node[1])
    if tag == "neg":
        return is_simplest_radical(node[1])
    if tag in ("pow", "eq"):
        return is_simplest_radical(node[1]) and is_simplest_radical(node[2])
    return True


def _term_bases(node, out):
    """Collect the base keys of a product term; returns False on a non-positive exponent."""
    tag = node[0]
    if tag == "neg":
        return _term_bases(node[1], out)
    if tag == "mul":
        return all(_term_bases(f, out) for f in node[1])
    if tag == "div":
        return _term_bases(node[1], out) and _term_bases(node[2], out)
    if tag == "pow":
        e = node[2]
        try:
            ev = evaluate(e, {})
        except EvalError:
            return False
        if ev <= 0:
            return False
        if node[1][0] in ("mul", "div", "pow"):
            return False  # a power of a product, quotient or power still has to be distributed
        out.append(repr(node[1]))
        return _term_bases(node[1], []) if node[1][0] == "add" else True
    if tag == "var":
        out.append(repr(node))
        return True
    if tag == "add":
        return all(is_positive_exponents(t) for t in node[1])
    if tag == "sqrt":
        return True
    return True


def is_positive_exponents(node) -> bool:
    if node[0] == "eq":
        return is_positive_exponents(node[1]) and is_positive_exponents(node[2])
    terms = node[1] if node[0] == "add" else [node]
    for t in terms:
        bases = []
        if not _term_bases(t, bases):
            return False
        if len(bases) != len(set(bases)):
            return False
    return True


def is_slope_intercept(node) -> bool:
    if node[0] != "eq":
        return False
    left, right = node[1], node[2]
    if left != ("var", "y"):
        return False
    if "y" in free_vars(right):
        return False
    poly = to_poly(right)
    if poly is None:
        return False
    for m in poly:
        if m not in ((), (("x", 1),)):
            return False
    return is_expanded(right)


FORM_CHECKS = {
    "factored": is_factored,
    "expanded": is_expanded,
    "lowest_terms": is_lowest_terms,
    "simplest_radical": is_simplest_radical,
    "positive_exponents": is_positive_exponents,
    "slope_intercept": is_slope_intercept,
}
