"""
Tokenizer and recursive-descent parser for the LaTeX subset MathLive emits.

AST nodes are tuples whose first element is the tag:
  ("num", Fraction, places)   places = decimal digits typed (0 for an integer literal)
  ("var", name)               single letter, or letter with subscript ("x_1")
  ("add", [terms])            subtraction is an ("neg", t) term; a nested ("add", ...) means parentheses
  ("neg", x)
  ("mul", [factors])
  ("div", a, b)
  ("pow", base, exp)
  ("sqrt", radicand, index)   index is None for a square root
  ("mixed", whole, num, den)  mixed number such as 2\\frac{1}{2}
  ("pi",)
  ("text", s)
  ("eq", left, right)

Standard library only.
"""

import re
from decimal import Decimal
from fractions import Fraction


class ParseError(ValueError):
    pass


_STRIP_COMMANDS = [
    r"\\left", r"\\right", r"\\displaystyle", r"\\qquad", r"\\quad",
    r"\\,", r"\\;", r"\\!", r"\\:", r"\\ ",
]


def _drop_placeholders(s: str) -> str:
    """Remove \\placeholder[...]{...} (MathLive's empty-slot marker), including nested braces."""
    out = []
    i = 0
    while i < len(s):
        if s.startswith("\\placeholder", i):
            i += len("\\placeholder")
            if i < len(s) and s[i] == "[":
                j = s.find("]", i)
                i = len(s) if j < 0 else j + 1
            if i < len(s) and s[i] == "{":
                depth = 0
                while i < len(s):
                    if s[i] == "{":
                        depth += 1
                    elif s[i] == "}":
                        depth -= 1
                        if depth == 0:
                            i += 1
                            break
                    i += 1
            continue
        out.append(s[i])
        i += 1
    return "".join(out)


def normalize(s: str) -> str:
    """Strip MathLive/LaTeX decoration and unify operators. Does not tokenize."""
    s = s.replace("$", "")
    s = _drop_placeholders(s)
    for cmd in _STRIP_COMMANDS:
        s = re.sub(cmd + r"(?![A-Za-z])" if cmd[-1].isalpha() else cmd, " ", s)
    s = s.replace("−", "-").replace("×", "*").replace("·", "*").replace("÷", "/")
    s = re.sub(r"\\(?:cdot|times)(?![A-Za-z])", "*", s)
    s = re.sub(r"\\div(?![A-Za-z])", "/", s)
    s = re.sub(r"\\[dt]frac(?![A-Za-z])", r"\\frac", s)
    s = s.replace("\\lbrace", "\\{").replace("\\rbrace", "\\}")
    # MathLive writes a decimal comma as {,}
    s = re.sub(r"(?<=\d)\{,\}(?=\d)", ".", s)
    s = s.replace("{,}", ",")
    return s.strip()


def _read_arg(s: str, i: int):
    """Read one LaTeX argument starting at i: a {...} group, a command, or a single character."""
    while i < len(s) and s[i] == " ":
        i += 1
    if i >= len(s):
        raise ParseError("missing argument")
    if s[i] == "{":
        depth = 0
        j = i
        while j < len(s):
            if s[j] == "{":
                depth += 1
            elif s[j] == "}":
                depth -= 1
                if depth == 0:
                    return s[i + 1:j], j + 1
            j += 1
        raise ParseError("unbalanced braces")
    if s[i] == "\\":
        m = re.match(r"\\[A-Za-z]+|\\.", s[i:])
        return m.group(0), i + len(m.group(0))
    return s[i], i + 1


def fix_args(s: str) -> str:
    """Brace every argument of \\frac, \\sqrt, ^ and _ so the parser only sees {...} groups."""
    out = []
    i = 0
    while i < len(s):
        if s.startswith("\\frac", i) and not s[i + 5:i + 6].isalpha():
            a1, i = _read_arg(s, i + 5)
            a2, i = _read_arg(s, i)
            out.append("\\frac{" + fix_args(a1) + "}{" + fix_args(a2) + "}")
        elif s.startswith("\\sqrt", i) and not s[i + 5:i + 6].isalpha():
            i += 5
            while i < len(s) and s[i] == " ":
                i += 1
            opt = ""
            if i < len(s) and s[i] == "[":
                j = s.find("]", i)
                if j < 0:
                    raise ParseError("unbalanced bracket")
                opt = "[" + fix_args(s[i + 1:j]) + "]"
                i = j + 1
            a, i = _read_arg(s, i)
            out.append("\\sqrt" + opt + "{" + fix_args(a) + "}")
        elif s[i] in "^_":
            a, i2 = _read_arg(s, i + 1)
            out.append(s[i] + "{" + fix_args(a) + "}")
            i = i2
        else:
            out.append(s[i])
            i += 1
    return "".join(out)


# --- tokenizer ------------------------------------------------------------------------

_SIMPLE = set("+-*/^=(){}[],")


def tokenize(s: str) -> list:
    toks = []
    i = 0
    n = len(s)
    while i < n:
        c = s[i]
        if c.isspace():
            i += 1
        elif c.isdigit() or (c == "." and i + 1 < n and s[i + 1].isdigit()):
            m = re.match(r"\d*\.?\d*", s[i:])
            lit = m.group(0)
            places = len(lit.split(".")[1]) if "." in lit else 0
            toks.append(("num", Fraction(Decimal(lit)), places))
            i += len(lit)
        elif c.isalpha() and c.isascii():
            name = c
            i += 1
            if i < n and s[i] == "_":
                if i + 1 < n and s[i + 1] == "{":
                    j = s.find("}", i)
                    if j < 0:
                        raise ParseError("unbalanced braces")
                    name += "_" + s[i + 2:j]
                    i = j + 1
                else:
                    raise ParseError("bad subscript")
            toks.append(("var", name))
        elif c == "\\":
            m = re.match(r"\\([A-Za-z]+)", s[i:])
            if m:
                cmd = m.group(1)
                i += len(m.group(0))
                if cmd == "frac":
                    toks.append(("frac",))
                elif cmd == "sqrt":
                    toks.append(("sqrt",))
                elif cmd == "pi":
                    toks.append(("pi",))
                elif cmd == "pm":
                    toks.append(("pm",))
                elif cmd in ("text", "mathrm", "textbf", "mathbf"):
                    while i < n and s[i] == " ":
                        i += 1
                    if i >= n or s[i] != "{":
                        raise ParseError("bad \\text")
                    j = s.find("}", i)
                    if j < 0:
                        raise ParseError("unbalanced braces")
                    toks.append(("text", s[i + 1:j].strip()))
                    i = j + 1
                else:
                    raise ParseError("unknown command \\" + cmd)
            elif i + 1 < n and s[i + 1] == "%":
                toks.append(("text", "%"))
                i += 2
            elif i + 1 < n and s[i + 1] in "{}":
                toks.append(("lbrace",) if s[i + 1] == "{" else ("rbrace",))
                i += 2
            else:
                raise ParseError("unknown escape")
        elif c in _SIMPLE:
            toks.append((c,))
            i += 1
        elif c == "%":
            toks.append(("text", "%"))
            i += 1
        else:
            raise ParseError("unexpected character " + repr(c))
    return toks


# --- parser ---------------------------------------------------------------------------

_FACTOR_START = {"num", "var", "(", "frac", "sqrt", "pi", "text", "{"}


class _Parser:
    def __init__(self, toks):
        self.toks = toks
        self.pos = 0

    def peek(self):
        return self.toks[self.pos] if self.pos < len(self.toks) else None

    def next(self):
        t = self.peek()
        if t is None:
            raise ParseError("unexpected end")
        self.pos += 1
        return t

    def expect(self, kind):
        t = self.next()
        if t[0] != kind:
            raise ParseError("expected " + kind)
        return t

    def parse_equation(self):
        left = self.parse_expr()
        t = self.peek()
        if t is not None and t[0] == "=":
            self.next()
            right = self.parse_expr()
            node = ("eq", left, right)
        else:
            node = left
        if self.peek() is not None:
            raise ParseError("unexpected trailing input")
        return node

    def parse_expr(self):
        terms = [self.parse_term()]
        while True:
            t = self.peek()
            if t is not None and t[0] == "+":
                self.next()
                terms.append(self.parse_term())
            elif t is not None and t[0] == "-":
                self.next()
                terms.append(("neg", self.parse_term()))
            else:
                break
        return terms[0] if len(terms) == 1 else ("add", terms)

    def parse_term(self):
        acc = [self.parse_unary()]
        while True:
            t = self.peek()
            if t is None:
                break
            if t[0] == "*":
                self.next()
                acc.append(self.parse_unary())
            elif t[0] == "/":
                self.next()
                left = acc[0] if len(acc) == 1 else ("mul", acc)
                acc = [("div", left, self.parse_unary())]
            elif t[0] in _FACTOR_START:
                is_frac = t[0] == "frac"
                f = self.parse_unary()
                if (is_frac and len(acc) == 1 and _is_int_literal(acc[0]) and f[0] == "div"
                        and _is_int_literal(f[1]) and _is_int_literal(f[2])):
                    acc = [("mixed", acc[0][1], f[1][1], f[2][1])]
                else:
                    acc.append(f)
            else:
                break
        return acc[0] if len(acc) == 1 else ("mul", acc)

    def parse_unary(self):
        t = self.peek()
        if t is not None and t[0] == "-":
            self.next()
            return ("neg", self.parse_unary())
        if t is not None and t[0] == "+":
            self.next()
            return self.parse_unary()
        return self.parse_power()

    def parse_power(self):
        base = self.parse_atom()
        t = self.peek()
        if t is not None and t[0] == "^":
            self.next()
            self.expect("{")
            exp = self.parse_expr()
            self.expect("}")
            return ("pow", base, exp)
        return base

    def parse_atom(self):
        t = self.next()
        k = t[0]
        if k == "num":
            return ("num", t[1], t[2])
        if k == "var":
            return ("var", t[1])
        if k == "pi":
            return ("pi",)
        if k == "text":
            return ("text", t[1])
        if k == "(":
            e = self.parse_expr()
            self.expect(")")
            return e
        if k == "{":
            e = self.parse_expr()
            self.expect("}")
            return e
        if k == "frac":
            self.expect("{")
            a = self.parse_expr()
            self.expect("}")
            self.expect("{")
            b = self.parse_expr()
            self.expect("}")
            return ("div", a, b)
        if k == "sqrt":
            index = None
            if self.peek() is not None and self.peek()[0] == "[":
                self.next()
                index = self.parse_expr()
                self.expect("]")
            self.expect("{")
            r = self.parse_expr()
            self.expect("}")
            return ("sqrt", r, index)
        raise ParseError("unexpected token " + k)


def _is_int_literal(node) -> bool:
    return node[0] == "num" and node[1].denominator == 1 and node[2] == 0


def parse(s: str):
    """Parse a LaTeX string into an AST. Raises ParseError."""
    s = normalize(s)
    if not s:
        raise ParseError("empty")
    toks = tokenize(fix_args(s))
    if not toks:
        raise ParseError("empty")
    return _Parser(toks).parse_equation()


def free_vars(node) -> set:
    tag = node[0]
    if tag == "var":
        return {node[1]}
    if tag in ("num", "pi", "text", "mixed"):
        return set()
    out = set()
    if tag in ("add", "mul"):
        for c in node[1]:
            out |= free_vars(c)
    elif tag == "neg":
        out |= free_vars(node[1])
    elif tag in ("div", "pow", "eq"):
        out |= free_vars(node[1]) | free_vars(node[2])
    elif tag == "sqrt":
        out |= free_vars(node[1])
        if node[2] is not None:
            out |= free_vars(node[2])
    return out


def has_text(node) -> bool:
    if node[0] == "text":
        return True
    if node[0] in ("add", "mul"):
        return any(has_text(c) for c in node[1])
    if node[0] == "neg":
        return has_text(node[1])
    if node[0] in ("div", "pow", "eq"):
        return has_text(node[1]) or has_text(node[2])
    if node[0] == "sqrt":
        return has_text(node[1])
    return False
