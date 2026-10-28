"""
assemble_playground.py -- pick the final problems from the validated pool.

  C:\\Python314\\python.exe knowledge_base/playground/assemble_playground.py --slice   # easy, 5 per node
  C:\\Python314\\python.exe knowledge_base/playground/assemble_playground.py            # full, 10 per set

Takes the validated / approved candidates in work/validated/, picks 5 word + 5 plain per node x
difficulty (slice: 3 plain + 2 word, easy only), preferring variety of problem `kind`, and assigns
stable slot ids (QE-E-01 ...). Existing slot ids keep their content unless that content is no longer
in the validated pool. Writes knowledge_base/playground/playground_problems.json.

If a set is short it prints the regenerate command and exits non-zero.
"""

import argparse
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
if HERE not in sys.path:
    sys.path.insert(0, HERE)

from pg_common import VALIDATED_DIR, content_hash, load_json, save_json  # noqa: E402

NODES = ["QE", "FP", "SP", "LE", "OI", "FD", "SLE", "L2V", "L1V", "AE", "RPP", "RER", "PE", "PO"]
DIFFS = ["easy", "medium", "hard"]
CODE = {"easy": "E", "medium": "M", "hard": "H"}
OUT = os.path.join(HERE, "playground_problems.json")

PUBLIC = ["id", "node_id", "difficulty", "style", "prompt", "answer_type", "answer", "accepted_variants",
          "required_form", "unit", "solution_steps", "source_doc", "validation", "kind"]


def tidy_prompt(text: str) -> str:
    """Display-only cleanup: money written as math-mode "P40" becomes "40 pesos"."""
    pat = r"\$\\text\{P\}(\d[\d,.]*)\$"
    return re.sub(pat, lambda m: m.group(1) + " pesos", text)


def pick(pool, n):
    """Greedy pick of n candidates, preferring kinds not chosen yet (stable order otherwise)."""
    chosen, kinds = [], set()
    remaining = list(pool)
    while remaining and len(chosen) < n:
        fresh = [c for c in remaining if c.get("kind") not in kinds]
        c = (fresh or remaining)[0]
        remaining.remove(c)
        chosen.append(c)
        kinds.add(c.get("kind"))
    return chosen


def slot_order(plain, word, total):
    """Interleave so word and plain problems alternate across slot ids."""
    out, p, w = [], list(plain), list(word)
    while p or w:
        if p:
            out.append(p.pop(0))
        if w:
            out.append(w.pop(0))
    return out[:total]


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--slice", action="store_true", help="easy only: 3 plain + 2 word per node")
    args = ap.parse_args()

    diffs = ["easy"] if args.slice else DIFFS
    n_plain, n_word = (3, 2) if args.slice else (5, 5)
    previous = {p["id"]: p for p in (load_json(OUT, {}) or {}).get("problems", [])}
    prev_hash = {content_hash(p): p["id"] for p in previous.values()}

    final, short = [], []
    for node in NODES:
        for diff in diffs:
            pool = load_json(os.path.join(VALIDATED_DIR, f"{node}-{diff}.json"), [])
            plain = pick([c for c in pool if c["style"] == "plain"], n_plain)
            word = pick([c for c in pool if c["style"] == "word"], n_word)
            if len(plain) < n_plain or len(word) < n_word:
                short.append((node, diff, len(plain), n_plain, len(word), n_word))
                continue
            chosen = slot_order(plain, word, n_plain + n_word)
            # keep existing slot ids for content that was already assigned
            taken = {prev_hash[content_hash(c)] for c in chosen if content_hash(c) in prev_hash}
            free = [f"{node}-{CODE[diff]}-{i:02d}" for i in range(1, n_plain + n_word + 1)
                    if f"{node}-{CODE[diff]}-{i:02d}" not in taken]
            for c in chosen:
                h = content_hash(c)
                c["id"] = prev_hash[h] if h in prev_hash else free.pop(0)
                c["accepted_variants"] = c.get("accepted_variants") or []
                c["prompt"] = tidy_prompt(c["prompt"])
                final.append({k: c.get(k) for k in PUBLIC})

    if short:
        print("Not enough validated candidates:")
        for node, diff, p, np_, w, nw in short:
            print(f"  {node}-{diff}: {p}/{np_} plain, {w}/{nw} word  ->  generate --force {node}-{diff}")
        print("Regenerate (generate_playground.py --force NODE-difficulty), validate, review, then re-run.")
        sys.exit(1)

    final.sort(key=lambda p: (NODES.index(p["node_id"]), DIFFS.index(p["difficulty"]), p["id"]))
    save_json(OUT, {"problems": final})
    print(f"Wrote {len(final)} problems to {OUT}")


if __name__ == "__main__":
    main()
