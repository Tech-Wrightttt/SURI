"""
Build the Playground hand-off package for the backend.

Usage (from project root):
  python knowledge_base/playground/build_handoff.py --sample   # Drop 1: 15 hand-verified samples
  python knowledge_base/playground/build_handoff.py --slice    # early slice: 14 topics x easy x 5
  python knowledge_base/playground/build_handoff.py            # Drop 2: full 420-problem bank

Reads  samples/playground_sample.json  (--sample)
   or  playground_problems.json + work/validation_report.json + work/review_decisions.json
Writes handoff/ (problems JSON, schema.sql, seed_playground.sql, update_playground.sql,
        API_SPEC.md, HANDOFF_BACKEND.md, MANIFEST.json) and frontend/lib/playground/mockProblems.json
        (sample items only; the full bank never ships to the browser).

Refuses to build (exit 1) on any schema/coverage/validation problem.
Standard library only.
"""

import argparse
import hashlib
import json
import os
import shutil
import sys
from datetime import datetime, timezone

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

SAMPLE_PATH = os.path.join(HERE, "samples", "playground_sample.json")
FULL_PATH = os.path.join(HERE, "playground_problems.json")
REPORT_PATH = os.path.join(HERE, "work", "validation_report.json")
DECISIONS_PATH = os.path.join(HERE, "work", "review_decisions.json")
HANDOFF_DIR = os.path.join(HERE, "handoff")
MOCK_PATH = os.path.join(ROOT, "frontend", "lib", "playground", "mockProblems.json")

NODES = ["QE", "FP", "SP", "LE", "OI", "FD", "SLE", "L2V", "L1V", "AE", "RPP", "RER", "PE", "PO"]
DIFFICULTIES = ["easy", "medium", "hard"]
DIFF_CODE = {"easy": "E", "medium": "M", "hard": "H"}
STYLES = ["word", "plain"]
ANSWER_TYPES = ["number", "expression", "equation", "solution_set", "ordered_pair"]
REQUIRED_FORMS = [
    "none", "factored", "expanded", "lowest_terms",
    "simplest_radical", "positive_exponents", "slope_intercept",
]
OK_STATUSES = {"validated", "approved"}
SAMPLE_STATUSES = OK_STATUSES | {"hand_verified"}

PUBLIC_FIELDS = [
    "id", "node_id", "difficulty", "style", "prompt", "answer_type", "answer",
    "accepted_variants", "required_form", "unit", "solution_steps", "source_doc", "content_hash",
]

SCHEMA_SQL = """\
-- Playground tables. Run in the Supabase SQL editor (after the base schema, which defines students).

CREATE TABLE IF NOT EXISTS playground_problems (
    id TEXT PRIMARY KEY,
    node_id TEXT NOT NULL,
    difficulty TEXT NOT NULL CHECK (difficulty IN ('easy','medium','hard')),
    style TEXT NOT NULL CHECK (style IN ('word','plain')),
    prompt TEXT NOT NULL,
    answer_type TEXT NOT NULL CHECK (answer_type IN ('number','expression','equation','solution_set','ordered_pair')),
    answer TEXT NOT NULL,
    accepted_variants_json TEXT NOT NULL DEFAULT '[]',
    required_form TEXT NOT NULL DEFAULT 'none',
    unit TEXT,
    solution_steps_json TEXT NOT NULL,
    source_doc TEXT NOT NULL,
    content_hash TEXT NOT NULL,
    created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_playground_problems_node_diff ON playground_problems(node_id, difficulty);

CREATE TABLE IF NOT EXISTS playground_solved (
    student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    problem_id TEXT NOT NULL REFERENCES playground_problems(id) ON DELETE CASCADE,
    solved_at TEXT NOT NULL,
    PRIMARY KEY (student_id, problem_id)
);
"""

COLUMNS = [
    "id", "node_id", "difficulty", "style", "prompt", "answer_type", "answer",
    "accepted_variants_json", "required_form", "unit", "solution_steps_json",
    "source_doc", "content_hash", "created_at",
]


class BuildError(Exception):
    pass


def canonical(obj) -> str:
    return json.dumps(obj, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def content_hash(p: dict) -> str:
    body = {
        "prompt": p["prompt"],
        "answer": p["answer"],
        "answer_type": p["answer_type"],
        "required_form": p["required_form"],
        "unit": p.get("unit"),
        "solution_steps": p["solution_steps"],
    }
    return "sha256:" + hashlib.sha256(canonical(body).encode("utf-8")).hexdigest()


def sql_quote(value) -> str:
    if value is None:
        return "NULL"
    return "'" + str(value).replace("'", "''") + "'"


def row_values(p: dict, created_at: str) -> list:
    return [
        p["id"], p["node_id"], p["difficulty"], p["style"], p["prompt"],
        p["answer_type"], p["answer"],
        json.dumps(p["accepted_variants"], ensure_ascii=False),
        p["required_form"], p.get("unit"),
        json.dumps(p["solution_steps"], ensure_ascii=False),
        p["source_doc"], p["content_hash"], created_at,
    ]


def seed_sql(problems: list, created_at: str) -> str:
    lines = [
        "-- Playground seed data. Run AFTER schema.sql. Safe to re-run (existing ids are skipped).",
        "",
    ]
    for p in problems:
        vals = ", ".join(sql_quote(v) for v in row_values(p, created_at))
        lines.append(
            f"INSERT INTO playground_problems ({', '.join(COLUMNS)}) VALUES ({vals}) ON CONFLICT DO NOTHING;"
        )
    return "\n".join(lines) + "\n"


def update_sql(problems: list, changed_ids: list, created_at: str) -> str:
    by_id = {p["id"]: p for p in problems}
    updatable = [c for c in COLUMNS if c not in ("id", "created_at")]
    lines = ["-- Playground content updates for ids whose content changed. Run AFTER seed_playground.sql.", ""]
    for pid in changed_ids:
        p = by_id[pid]
        vals = ", ".join(sql_quote(v) for v in row_values(p, created_at))
        sets = ", ".join(f"{c} = EXCLUDED.{c}" for c in updatable)
        lines.append(
            f"INSERT INTO playground_problems ({', '.join(COLUMNS)}) VALUES ({vals}) "
            f"ON CONFLICT (id) DO UPDATE SET {sets};"
        )
    return "\n".join(lines) + "\n"


def validate_schema(p: dict) -> list:
    errs = []
    pid = p.get("id", "<no id>")
    for field in ("id", "node_id", "difficulty", "style", "prompt", "answer_type", "answer",
                  "accepted_variants", "required_form", "solution_steps", "source_doc"):
        if field not in p:
            errs.append(f"{pid}: missing field '{field}'")
    if errs:
        return errs
    if p["node_id"] not in NODES:
        errs.append(f"{pid}: unknown node_id '{p['node_id']}'")
    if p["difficulty"] not in DIFFICULTIES:
        errs.append(f"{pid}: bad difficulty '{p['difficulty']}'")
    if p["style"] not in STYLES:
        errs.append(f"{pid}: bad style '{p['style']}'")
    if p["answer_type"] not in ANSWER_TYPES:
        errs.append(f"{pid}: bad answer_type '{p['answer_type']}'")
    if p["required_form"] not in REQUIRED_FORMS:
        errs.append(f"{pid}: bad required_form '{p['required_form']}'")
    if not isinstance(p["accepted_variants"], list):
        errs.append(f"{pid}: accepted_variants must be a list")
    if not p["prompt"].strip() or not p["answer"].strip():
        errs.append(f"{pid}: empty prompt or answer")
    steps = p["solution_steps"]
    if not isinstance(steps, list) or not steps or not all(
        isinstance(s, dict) and "explanation" in s and "latex" in s for s in steps
    ):
        errs.append(f"{pid}: solution_steps must be a non-empty list of {{explanation, latex}}")
    unit = p.get("unit")
    if unit is not None and not isinstance(unit, str):
        errs.append(f"{pid}: unit must be a string or null")
    parts = p["id"].split("-")
    if len(parts) != 3 or parts[0] != p["node_id"] or parts[1] != DIFF_CODE.get(p["difficulty"]) \
            or not (parts[2].isdigit() and 1 <= int(parts[2]) <= 10):
        errs.append(f"{pid}: id must look like <NODE>-<E|M|H>-<01..10> matching node_id/difficulty")
    return errs


def load_checker():
    try:
        from backend.playground_checker import check_answer
        return check_answer
    except ImportError:
        return None


def load_json(path):
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def status_of(p: dict, sample: bool, report: dict, decisions: dict) -> str:
    if sample:
        return p.get("validation", {}).get("status", "missing")
    h = p.get("content_hash")
    if decisions.get(h) == "approved":
        return "approved"
    if p.get("validation", {}).get("status"):  # stamped by assemble_playground.py
        return p["validation"]["status"]
    entry = report.get(p["id"], {})
    return entry.get("status", "missing")


def check_slice_coverage(problems: list) -> list:
    """Early slice: every node, easy only, exactly 5 problems (3 plain + 2 word), slots 01..05."""
    errs = []
    for p in problems:
        if p["node_id"] == "PD":
            errs.append(f"{p['id']}: PD is not part of the playground")
        elif p["difficulty"] != "easy":
            errs.append(f"{p['id']}: slice contains only easy problems")
    for node in NODES:
        group = [p for p in problems if p["node_id"] == node and p["difficulty"] == "easy"]
        word = sum(1 for p in group if p["style"] == "word")
        plain = sum(1 for p in group if p["style"] == "plain")
        if len(group) != 5 or word != 2 or plain != 3:
            errs.append(f"{node}/easy: expected 5 problems (3 plain + 2 word), "
                        f"got {len(group)} ({word} word + {plain} plain)")
        for p in group:
            if int(p["id"].split("-")[2]) > 5:
                errs.append(f"{p['id']}: slice uses slots 01..05 only")
    return errs


def check_coverage(problems: list) -> list:
    errs = []
    for p in problems:
        if p["node_id"] == "PD":
            errs.append(f"{p['id']}: PD is not part of the playground")
    for node in NODES:
        for diff in DIFFICULTIES:
            group = [p for p in problems if p["node_id"] == node and p["difficulty"] == diff]
            word = sum(1 for p in group if p["style"] == "word")
            plain = sum(1 for p in group if p["style"] == "plain")
            if len(group) != 10 or word != 5 or plain != 5:
                errs.append(f"{node}/{diff}: expected 10 problems (5 word + 5 plain), "
                            f"got {len(group)} ({word} word + {plain} plain)")
    return errs


def build(sample: bool, out_dir: str = HANDOFF_DIR, mock_path: str = MOCK_PATH,
          source_path: str = None, report_path: str = REPORT_PATH,
          decisions_path: str = DECISIONS_PATH, checker=None, allow_missing_checker: bool = None,
          slice_mode: bool = False) -> dict:
    """Build the hand-off. Raises BuildError listing every problem found."""
    source_path = source_path or (SAMPLE_PATH if sample else FULL_PATH)
    if not os.path.exists(source_path):
        raise BuildError(f"input not found: {source_path}")
    data = load_json(source_path)
    problems = data["problems"] if isinstance(data, dict) else data

    report = load_json(report_path) if (not sample and os.path.exists(report_path)) else {}
    decisions = load_json(decisions_path) if (not sample and os.path.exists(decisions_path)) else {}

    errors = []
    seen = set()
    for p in problems:
        errors.extend(validate_schema(p))
        if p.get("id") in seen:
            errors.append(f"{p.get('id')}: duplicate id")
        seen.add(p.get("id"))
    if errors:
        raise BuildError("\n".join(errors))

    for p in problems:
        p.setdefault("unit", None)
        p["content_hash"] = content_hash(p)

    allowed = SAMPLE_STATUSES if sample else OK_STATUSES
    for p in problems:
        st = status_of(p, sample, report, decisions)
        if st not in allowed:
            errors.append(f"{p['id']}: validation status '{st}' is not one of {sorted(allowed)}")

    if checker is None:
        checker = load_checker()
    if allow_missing_checker is None:
        allow_missing_checker = sample
    if checker is None:
        if not allow_missing_checker:
            errors.append("backend.playground_checker is not importable; cannot verify answers")
        else:
            print("WARNING: backend.playground_checker not found; skipping self-check of answers "
                  "(it lands in PR-2).", file=sys.stderr)
    else:
        for p in problems:
            res = checker(p["answer"], p)
            if not res.correct:
                errors.append(f"{p['id']}: checker rejects its own answer ({res.reason}: {res.message})")
            for v in p["accepted_variants"]:
                if not checker(v, p).correct:
                    errors.append(f"{p['id']}: accepted variant '{v}' is not accepted by the checker")

    if slice_mode:
        errors.extend(check_slice_coverage(problems))
    elif not sample:
        errors.extend(check_coverage(problems))
    if errors:
        raise BuildError("\n".join(errors))

    problems.sort(key=lambda p: (NODES.index(p["node_id"]), DIFFICULTIES.index(p["difficulty"]), p["id"]))
    public = [{k: p.get(k) for k in PUBLIC_FIELDS} for p in problems]

    os.makedirs(out_dir, exist_ok=True)
    prev_path = os.path.join(out_dir, "playground_problems.json")
    prev_hashes = {}
    if os.path.exists(prev_path):
        try:
            prev_hashes = {p["id"]: p["content_hash"] for p in load_json(prev_path)["problems"]}
        except (KeyError, TypeError, ValueError):
            prev_hashes = {}
    changed_ids = sorted(p["id"] for p in public if p["id"] in prev_hashes and prev_hashes[p["id"]] != p["content_hash"])

    generated_at = datetime.now(timezone.utc).isoformat()

    counts = {}
    for p in public:
        c = counts.setdefault(p["node_id"], {}).setdefault(p["difficulty"], {"word": 0, "plain": 0, "total": 0})
        c[p["style"]] += 1
        c["total"] += 1
    statuses = [status_of(p, sample, report, decisions) for p in problems]
    manifest = {
        "drop": "slice" if slice_mode else (1 if sample else 2),
        "sample": sample,
        "complete": not (sample or slice_mode),
        "generated_at": generated_at,
        "counts": counts,
        "totals": {"problems": len(public), "word": sum(1 for p in public if p["style"] == "word"),
                   "plain": sum(1 for p in public if p["style"] == "plain")},
        "validator": {
            "validated": statuses.count("validated"),
            "blind_resolve": sum(1 for p in problems
                                 if report.get(p["id"], {}).get("method") == "blind_resolve"),
            "approved": statuses.count("approved"),
            "hand_verified": statuses.count("hand_verified"),
            "rejected": sum(1 for v in decisions.values() if v == "rejected"),
            "needs_review_remaining": sum(1 for p in problems
                                          if report.get(p["id"], {}).get("status") == "needs_review"
                                          and status_of(p, sample, report, decisions) not in OK_STATUSES),
        },
        "content_sha256": hashlib.sha256(canonical(public).encode("utf-8")).hexdigest(),
        "changed_ids": changed_ids,
    }

    def write(name, text):
        with open(os.path.join(out_dir, name), "w", encoding="utf-8", newline="\n") as f:
            f.write(text)

    write("playground_problems.json",
          json.dumps({"drop": manifest["drop"], "problems": public}, indent=2, ensure_ascii=False) + "\n")
    write("schema.sql", SCHEMA_SQL)
    write("seed_playground.sql", seed_sql(public, generated_at))
    update_path = os.path.join(out_dir, "update_playground.sql")
    if changed_ids:
        write("update_playground.sql", update_sql(public, changed_ids, generated_at))
    elif os.path.exists(update_path):
        os.remove(update_path)
    for doc in ("API_SPEC.md", "HANDOFF_BACKEND.md"):
        src = os.path.join(HERE, doc)
        if os.path.exists(src):
            shutil.copyfile(src, os.path.join(out_dir, doc))
    write("MANIFEST.json", json.dumps(manifest, indent=2) + "\n")

    if sample:
        os.makedirs(os.path.dirname(mock_path), exist_ok=True)
        with open(mock_path, "w", encoding="utf-8", newline="\n") as f:
            json.dump(public, f, indent=2, ensure_ascii=False)
            f.write("\n")

    return manifest


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--sample", action="store_true", help="build Drop 1 from the 15 sample problems")
    ap.add_argument("--slice", action="store_true", help="build the early slice (14 topics x easy x 5)")
    args = ap.parse_args()
    if args.sample and args.slice:
        ap.error("--sample and --slice are mutually exclusive")
    try:
        manifest = build(args.sample, slice_mode=args.slice)
    except BuildError as e:
        print("BUILD REFUSED:\n" + str(e), file=sys.stderr)
        sys.exit(1)
    print(f"Built drop {manifest['drop']}: {manifest['totals']['problems']} problems -> {HANDOFF_DIR}")


if __name__ == "__main__":
    main()
