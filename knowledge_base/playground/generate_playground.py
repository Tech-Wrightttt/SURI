"""
generate_playground.py -- offline candidate generator for the Playground.

One Gemini call per node x difficulty. Each call over-generates word + plain candidates that the
validator then filters. Never called at runtime.

Run with the system Python (it has google-genai, pypdf, python-dotenv):
  C:\\Python314\\python.exe knowledge_base/playground/generate_playground.py
  C:\\Python314\\python.exe knowledge_base/playground/generate_playground.py --only QE,FP
  C:\\Python314\\python.exe knowledge_base/playground/generate_playground.py --force QE-easy
  C:\\Python314\\python.exe knowledge_base/playground/generate_playground.py --dry-run --only QE

Output: work/raw/<NODE>-<difficulty>.json. Runs are resumable: existing files are skipped
unless --force NODE-difficulty is given.
"""

import argparse
import json
import os
import re
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)
if HERE not in sys.path:
    sys.path.insert(0, HERE)

from backend.graph import GRAPH  # noqa: E402
from pdf_text import grounding_text  # noqa: E402
from topic_specs import GLOBAL_RULES, load_seed, pdfs_for, spec_for  # noqa: E402

RAW_DIR = os.path.join(HERE, "work", "raw")
from pg_common import GEMINI_MODEL  # noqa: E402
SLEEP_SECONDS = 10

NODES = ["QE", "FP", "SP", "LE", "OI", "FD", "SLE", "L2V", "L1V", "AE", "RPP", "RER", "PE", "PO"]
ANSWER_TYPES = ["number", "expression", "equation", "solution_set", "ordered_pair"]

COMPUTE_EXPR_HELP = """\
`compute_expr` is an ASCII string that lets a program independently re-check the answer. It must come
from the PROBLEM DATA, not from your answer. Use mathjs syntax: explicit `*` for multiplication, `^` for
powers, `sqrt(x)`, `nthRoot(x, n)`, `/` for division. Variables are single letters.
  - number:       the arithmetic that computes the answer from the givens, e.g. "45/60*100".
  - expression:   the ORIGINAL expression to simplify / factor / expand, written as in the prompt,
                  e.g. "(x+3)*(x-5)" or "x^2+7*x+12" or "sqrt(18*x^2)". Variables are assumed >= 0.
  - solution_set: ONE equation in x, e.g. "x^2-5*x+6=0" (use x unless the prompt uses another letter).
  - ordered_pair: equations separated by ";" in x and y, e.g. "x+y=10; x-y=2".
  - equation:     ";"-separated: source equations the answer line must satisfy, e.g. "2*x+y=10",
                  and/or points the line passes through written pt(x,y), e.g. "pt(0,3); pt(2,7)".
"""

ANSWER_HELP = """\
`answer` is canonical LaTeX exactly as a student would type it:
  - number: "\\\\frac{3}{4}", "75", "6\\\\sqrt{2}", "2.5"   (no units, no % sign)
  - expression: "(x+3)(x+4)", "x^2-2x-15"
  - equation: "y=-2x+10"
  - solution_set: "2, 3"   or  "-6, 5"   (roots separated by commas, any order)
  - ordered_pair: "(6, 4)"
`solution_steps` is a list of {"explanation": "...", "latex": "..."} (2 to 4 steps) shown after reveal.
"""


def parse_gemini_json(raw_text: str):
    """Robustly parse Gemini's JSON response (copied from generate_practice.py, not imported)."""
    cleaned = raw_text.strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?\n?", "", cleaned)
        cleaned = re.sub(r"\n?```$", "", cleaned)
        cleaned = cleaned.strip()
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        pass
    repaired = re.sub(r'\\(?![n"\\/brtu])', r"\\\\", cleaned)
    try:
        return json.loads(repaired)
    except json.JSONDecodeError:
        pass
    match = re.search(r"(\[.*\]|\{.*\})", repaired, re.DOTALL)
    if match:
        return json.loads(match.group(1))
    raise ValueError("Could not parse Gemini response as JSON.")


def call_with_retry(client, attempts: int = 5, **kwargs):
    """generate_content with exponential backoff for transient 429/5xx errors."""
    delay = 15
    for attempt in range(1, attempts + 1):
        try:
            return client.models.generate_content(**kwargs)
        except Exception as exc:
            transient = any(t in str(exc) for t in ("503", "429", "UNAVAILABLE", "RESOURCE_EXHAUSTED", "500"))
            if attempt == attempts or not transient:
                raise
            print(f"    transient error, retrying in {delay}s ({attempt}/{attempts - 1})")
            time.sleep(delay)
            delay = min(delay * 2, 120)


def build_prompt(node_id: str, difficulty: str, n_word: int, n_plain: int) -> str:
    spec = spec_for(node_id, difficulty)
    seed = load_seed().get(node_id, {})
    label = GRAPH[node_id]["label"]
    grade = GRAPH[node_id]["grade"]
    types = "\n".join(
        f'  - answer_type "{t}" with required_form one of {forms}' for t, forms in spec["answer_types"].items()
    )
    excerpts = grounding_text(pdfs_for(node_id))
    return f"""You are writing math practice problems for Filipino students (grade {grade}).
Topic: {label} ({node_id}), difficulty: {difficulty}.

LESSON (reference)
{seed.get('lesson', '')}

WORKED EXAMPLE (reference)
{seed.get('worked_example', '')}

SOURCE EXCERPTS
{excerpts}

TASK
Write {n_word} WORD problems (style "word": a short real-life story that needs this skill) and
{n_plain} PLAIN problems (style "plain": a direct math instruction such as "Solve ...", "Factor ...").
The student types ONLY the final answer, so every problem needs exactly one well-defined final answer.

Allowed problem kinds (tag each candidate with one in "kind"): {json.dumps(spec['kinds'])}
Word-problem contexts: {spec['word']}
Allowed answer types:
{types}
Notes: {spec['notes']}

RULES
{GLOBAL_RULES}
- Prompts are Markdown with LaTeX in $...$ (inline). English only.
- Vary the kinds across the batch and make every problem different.

{ANSWER_HELP}
{COMPUTE_EXPR_HELP}
OUTPUT
Return ONLY a JSON array (no markdown fences) of {n_word + n_plain} objects with exactly these keys:
"style", "kind", "prompt", "answer_type", "answer", "required_form", "unit" (string or null),
"solution_steps", "compute_expr".
Because LaTeX uses backslashes, escape every backslash in the JSON (write \\\\frac for \\frac).
"""


def schema_errors(c: dict, spec: dict) -> list:
    errs = []
    for k in ("style", "kind", "prompt", "answer_type", "answer", "required_form", "solution_steps", "compute_expr"):
        if k not in c or c[k] in (None, ""):
            errs.append(f"missing {k}")
    if errs:
        return errs
    if c["style"] not in ("word", "plain"):
        errs.append("bad style")
    if c["answer_type"] not in ANSWER_TYPES:
        errs.append("bad answer_type")
    elif c["answer_type"] not in spec["answer_types"]:
        errs.append(f"answer_type {c['answer_type']} not allowed for this node")
    elif c["required_form"] not in spec["answer_types"][c["answer_type"]]:
        errs.append(f"required_form {c['required_form']} not allowed for {c['answer_type']}")
    steps = c["solution_steps"]
    if not isinstance(steps, list) or not steps or not all(
            isinstance(s, dict) and s.get("explanation") and s.get("latex") for s in steps):
        errs.append("bad solution_steps")
    if not isinstance(c["answer"], str) or not isinstance(c["compute_expr"], str):
        errs.append("answer/compute_expr must be strings")
    if c.get("unit") is not None and not isinstance(c["unit"], str):
        errs.append("bad unit")
    return errs


def norm_expr(s: str) -> str:
    return re.sub(r"\s+", "", s).lower()


def existing_exprs() -> set:
    seen = set()
    if os.path.isdir(RAW_DIR):
        for name in os.listdir(RAW_DIR):
            if name.endswith(".json"):
                with open(os.path.join(RAW_DIR, name), encoding="utf-8") as f:
                    for c in json.load(f):
                        seen.add(norm_expr(c["compute_expr"]))
    return seen


def generate_one(client, node_id: str, difficulty: str, n_word: int, n_plain: int, seen: set) -> list:
    prompt = build_prompt(node_id, difficulty, n_word, n_plain)
    spec = spec_for(node_id, difficulty)
    from google.genai import types as gtypes

    response = call_with_retry(
        client,
        model=GEMINI_MODEL,
        contents=prompt,
        config=gtypes.GenerateContentConfig(response_mime_type="application/json", temperature=0.9),
    )
    data = parse_gemini_json(response.text)
    if isinstance(data, dict):
        data = data.get("problems") or data.get("candidates") or []
    kept, counts = [], {"word": 0, "plain": 0}
    for c in data:
        errs = schema_errors(c, spec)
        if errs:
            print(f"    drop ({'; '.join(errs)})")
            continue
        key = norm_expr(c["compute_expr"])
        if key in seen:
            print("    drop (duplicate compute_expr)")
            continue
        seen.add(key)
        counts[c["style"]] += 1
        c = {k: c.get(k) for k in ("style", "kind", "prompt", "answer_type", "answer", "required_form",
                                   "unit", "solution_steps", "compute_expr")}
        c["unit"] = c["unit"] or None
        c["node_id"] = node_id
        c["difficulty"] = difficulty
        c["cand_id"] = f"{node_id}-{difficulty}-{c['style'][0]}{counts[c['style']]}"
        c["source_doc"] = ", ".join(pdfs_for(node_id)[:1]) or "content_seed.json"
        kept.append(c)
    return kept


def main():
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--difficulty", default="easy", choices=["easy", "medium", "hard"])
    ap.add_argument("--only", help="comma-separated node ids")
    ap.add_argument("--force", action="append", default=[], help="NODE-difficulty to regenerate")
    ap.add_argument("--word", type=int, default=5, help="word candidates per call")
    ap.add_argument("--plain", type=int, default=6, help="plain candidates per call")
    ap.add_argument("--dry-run", action="store_true", help="print the prompt and exit")
    args = ap.parse_args()

    nodes = args.only.split(",") if args.only else NODES
    if args.dry_run:
        print(build_prompt(nodes[0], args.difficulty, args.word, args.plain))
        return

    from dotenv import load_dotenv
    from google import genai

    load_dotenv(os.path.join(ROOT, ".env"))
    key = os.environ.get("GEMINI_API_KEY")
    if not key:
        sys.exit("ERROR: GEMINI_API_KEY not found in environment variables.")
    client = genai.Client(api_key=key)
    os.makedirs(RAW_DIR, exist_ok=True)
    seen = existing_exprs()

    first = True
    for node_id in nodes:
        tag = f"{node_id}-{args.difficulty}"
        path = os.path.join(RAW_DIR, tag + ".json")
        if os.path.exists(path) and tag not in args.force:
            print(f"skip {tag} (exists)")
            continue
        if tag in args.force and os.path.exists(path):
            with open(path, encoding="utf-8") as f:
                for c in json.load(f):
                    seen.discard(norm_expr(c["compute_expr"]))
        if not first:
            time.sleep(SLEEP_SECONDS)
        first = False
        print(f"generating {tag} ...")
        try:
            kept = generate_one(client, node_id, args.difficulty, args.word, args.plain, seen)
        except Exception as exc:
            print(f"  FAILED {tag}: {exc}")
            continue
        with open(path, "w", encoding="utf-8") as f:
            json.dump(kept, f, indent=2, ensure_ascii=False)
        words = sum(1 for c in kept if c["style"] == "word")
        print(f"  saved {len(kept)} candidates ({words} word, {len(kept) - words} plain)")


if __name__ == "__main__":
    main()
