"""
review_playground.py -- command-line review queue for candidates the validator could not confirm.

  C:\\Python314\\python.exe knowledge_base/playground/review_playground.py

For each item in work/needs_review.json it shows the prompt, answer, steps and verifier notes, then asks:
  [a]pprove   accept as-is
  [r]eject    drop it
  [e]dit      open the candidate JSON in $EDITOR (notepad on Windows); the edit is written back to
              work/raw/ and the item is re-validated the next time validate_playground.py runs
  [s]kip      decide later
  [q]uit

Decisions are stored in work/review_decisions.json keyed by the candidate's content hash. That file is
committed, so re-running generation or validation keeps earlier decisions.
"""

import json
import os
import subprocess
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
if HERE not in sys.path:
    sys.path.insert(0, HERE)

from pg_common import DECISIONS, NEEDS_REVIEW, RAW_DIR, content_hash, load_json, save_json  # noqa: E402

EDITABLE = ["prompt", "answer_type", "answer", "required_form", "unit", "solution_steps", "compute_expr", "style"]


def show(c, i, total):
    print("\n" + "=" * 72)
    print(f"[{i}/{total}] {c['cand_id']}  ({c['style']}, {c['answer_type']}, form={c['required_form']}, unit={c['unit']})")
    print(f"\nPROMPT : {c['prompt']}")
    print(f"ANSWER : {c['answer']}")
    print(f"CHECK  : {c['compute_expr']}")
    for n, s in enumerate(c["solution_steps"], 1):
        print(f"  {n}. {s['explanation']}   {s['latex']}")
    print(f"\nVERIFIER: {c['validation']['status']} -- {c['validation']['notes']}")


def edit_candidate(c) -> bool:
    snippet = {k: c[k] for k in EDITABLE}
    with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False, encoding="utf-8") as f:
        json.dump(snippet, f, indent=2, ensure_ascii=False)
        path = f.name
    editor = os.environ.get("EDITOR") or ("notepad" if os.name == "nt" else "vi")
    subprocess.call([editor, path])
    try:
        with open(path, encoding="utf-8") as f:
            edited = json.load(f)
    except json.JSONDecodeError as exc:
        print(f"  edit not saved: invalid JSON ({exc})")
        return False
    finally:
        os.unlink(path)
    raw_path = os.path.join(RAW_DIR, f"{c['node_id']}-{c['difficulty']}.json")
    raw = load_json(raw_path, [])
    for r in raw:
        if r["cand_id"] == c["cand_id"]:
            r.update({k: edited[k] for k in EDITABLE if k in edited})
    save_json(raw_path, raw)
    print("  edit saved to work/raw; re-run validate_playground.py to re-validate it")
    return True


def main():
    queue = load_json(NEEDS_REVIEW, [])
    decisions = load_json(DECISIONS, {})
    pending = [c for c in queue if content_hash(c) not in decisions]
    if not pending:
        print("Nothing to review.")
        return
    for i, c in enumerate(pending, 1):
        show(c, i, len(pending))
        while True:
            choice = input("[a]pprove  [r]eject  [e]dit  [s]kip  [q]uit > ").strip().lower()[:1]
            if choice == "a":
                decisions[content_hash(c)] = "approved"
            elif choice == "r":
                decisions[content_hash(c)] = "rejected"
            elif choice == "e":
                if not edit_candidate(c):
                    continue
            elif choice in ("s", ""):
                pass
            elif choice == "q":
                save_json(DECISIONS, decisions)
                return
            else:
                continue
            save_json(DECISIONS, decisions)
            break
    print("\nDone. Re-run validate_playground.py, then assemble_playground.py.")


if __name__ == "__main__":
    main()
