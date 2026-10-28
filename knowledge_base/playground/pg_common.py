"""Shared helpers for the offline Playground scripts (validator, review queue, assembler)."""

import hashlib
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

WORK = os.path.join(HERE, "work")
RAW_DIR = os.path.join(WORK, "raw")
VALIDATED_DIR = os.path.join(WORK, "validated")
NEEDS_REVIEW = os.path.join(WORK, "needs_review.json")
REPORT = os.path.join(WORK, "validation_report.json")
DECISIONS = os.path.join(WORK, "review_decisions.json")
BLIND_CACHE = os.path.join(WORK, "blind_cache.json")

# Same model as the rest of the repo; override with PLAYGROUND_GEMINI_MODEL when it is overloaded.
GEMINI_MODEL = os.environ.get("PLAYGROUND_GEMINI_MODEL", "gemini-3.1-flash-lite")

# The blind re-solve may use a different model (separate quota): PLAYGROUND_BLIND_MODEL.
BLIND_MODEL = os.environ.get("PLAYGROUND_BLIND_MODEL", GEMINI_MODEL)


def canonical(obj) -> str:
    return json.dumps(obj, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def content_hash(p: dict) -> str:
    """Same formula as build_handoff.content_hash."""
    body = {
        "prompt": p["prompt"],
        "answer": p["answer"],
        "answer_type": p["answer_type"],
        "required_form": p["required_form"],
        "unit": p.get("unit"),
        "solution_steps": p["solution_steps"],
    }
    return "sha256:" + hashlib.sha256(canonical(body).encode("utf-8")).hexdigest()


def load_json(path, default=None):
    if not os.path.exists(path):
        return default
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def save_json(path, obj):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8", newline="\n") as f:
        json.dump(obj, f, indent=2, ensure_ascii=False)
        f.write("\n")


def ascii_to_latex(s: str) -> str:
    """Convert the small mathjs ASCII subset used in compute_expr into LaTeX the checker parses."""
    s = re.sub(r"\^(\d+)", r"^{\1}", s)
    if "nthRoot" in s:
        raise ValueError("nthRoot not supported")
    out, stack, i = [], [], 0
    while i < len(s):
        if s.startswith("sqrt(", i):
            out.append("\\sqrt{")
            stack.append("}")
            i += 5
        elif s.startswith("^(", i):
            out.append("^{")
            stack.append("}")
            i += 2
        elif s[i] == "(":
            out.append("(")
            stack.append(")")
            i += 1
        elif s[i] == ")":
            if not stack:
                raise ValueError("unbalanced )")
            out.append(stack.pop())
            i += 1
        else:
            out.append(s[i])
            i += 1
    if stack:
        raise ValueError("unbalanced (")
    return "".join(out)


def ascii_variables(s: str) -> list:
    """Single-letter variables in a mathjs ASCII string (function names and pt( are ignored)."""
    cleaned = re.sub(r"(sqrt|nthRoot|pt)\(", "(", s)
    return sorted(set(re.findall(r"(?<![A-Za-z])[a-zA-Z](?![A-Za-z])", cleaned)))
