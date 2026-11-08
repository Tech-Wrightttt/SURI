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

from pg_common import ROOT, VALIDATED_DIR, content_hash, load_json, save_json  # noqa: E402

sys.path.insert(0, os.path.join(ROOT, "knowledge_base", "challenge"))
from dedupe import load_items, template_key  # noqa: E402

NODES = ["QE", "FP", "SP", "LE", "OI", "FD", "SLE", "L2V", "L1V", "AE", "RPP", "RER", "PE", "PO"]
DIFFS = ["easy", "medium", "hard"]
CODE = {"easy": "E", "medium": "M", "hard": "H"}
OUT = os.path.join(HERE, "playground_problems.json")
RETIRED = os.path.join(HERE, "retired_ids.json")  # ids replaced by newer problems; the migration sets is_active=false
AGE_RE = re.compile(r"\b(years? old|ages?|aged|older than|younger than)\b", re.I)
ARCHETYPE_CAP, MAX_AGE = 2, 1  # per node x tier of 10 (20%)

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


def operators(p) -> int:
    t = re.sub(r"\\left|\\right|\$", "", p["prompt"])
    return len(re.findall(r"(?<=[\w)}])\s*(?:[-+*/]|\\times|\\div|\\cdot)\s*(?=[\w(\\-])", t))


def trivial_easy(p) -> bool:
    """A single-operation drill (-23 + 30, 3/5 + 1/10, 15% of 300) is too easy for the tier."""
    return p["style"] == "plain" and p["answer_type"] == "number" and operators(p) <= 1


def number_of(pid: str) -> int:
    return int(pid.rsplit("-", 1)[1])


def choose(pool, n, taken_keys, chosen_keys, archetypes, hard):
    """Greedy pick preferring unused kinds; enforces template uniqueness, the archetype cap and one age problem."""
    out, kinds, ages = [], set(), 0
    remaining = list(pool)
    while remaining and len(out) < n:
        ok = []
        for c in remaining:
            key = template_key(c["prompt"])
            arch = str(c.get("archetype") or c.get("kind") or "").lower().strip()
            is_age = bool(AGE_RE.search(c["prompt"]))
            if key in taken_keys or key in chosen_keys:
                continue
            if hard and (archetypes.get(arch, 0) >= ARCHETYPE_CAP or (is_age and ages >= MAX_AGE)):
                continue
            ok.append((c, key, arch, is_age))
        if not ok:
            break
        fresh = [t for t in ok if t[0].get("kind") not in kinds]
        c, key, arch, is_age = (fresh or ok)[0]
        remaining.remove(c)
        out.append(c)
        kinds.add(c.get("kind"))
        chosen_keys.add(key)
        archetypes[arch] = archetypes.get(arch, 0) + 1
        ages += is_age
    return out


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.parse_args()
    previous = {p["id"]: p for p in (load_json(OUT, {}) or {}).get("problems", [])}
    retired = set(load_json(RETIRED, []) or [])
    foreign = {}
    for it in load_items():
        if it["source"] != "playground":
            foreign.setdefault(it["node"], set()).add(it["key"])

    final, short, new_retired = [], [], set()
    for node in NODES:
        for diff in DIFFS:
            old = [p for p in previous.values() if p["node_id"] == node and p["difficulty"] == diff]
            taken = foreign.get(node, set())
            chosen_keys, archetypes = set(), {}
            # easy keeps the old problems that are not single-operation drills and not duplicates
            keep = []
            if diff == "easy":
                for p in old:
                    key = template_key(p["prompt"])
                    if not trivial_easy(p) and key not in taken and key not in chosen_keys:
                        keep.append(p)
                        chosen_keys.add(key)
            pool = load_json(os.path.join(VALIDATED_DIR, f"{node}-{diff}.json"), [])
            need_plain = 5 - sum(p["style"] == "plain" for p in keep)
            need_word = 5 - sum(p["style"] == "word" for p in keep)
            hard = diff == "hard"
            plain = choose([c for c in pool if c["style"] == "plain"], need_plain, taken, chosen_keys, archetypes, hard)
            word = choose([c for c in pool if c["style"] == "word"], need_word, taken, chosen_keys, archetypes, hard)
            if len(plain) < need_plain or len(word) < need_word:
                short.append((node, diff, len(plain), need_plain, len(word), need_word))
                final += [{k: p.get(k) for k in PUBLIC} for p in old]  # leave the tier untouched while short
                continue
            top = max([number_of(i) for i in list(previous) + list(retired) if i.startswith(f"{node}-{CODE[diff]}-")] or [0])
            for c in slot_order(plain, word, len(plain) + len(word)):
                top += 1
                c["id"] = f"{node}-{CODE[diff]}-{top:02d}"
                c["accepted_variants"] = c.get("accepted_variants") or []
                c["prompt"] = tidy_prompt(c["prompt"])
                final.append({k: c.get(k) for k in PUBLIC})
            final += [{k: p.get(k) for k in PUBLIC} for p in keep]
            new_retired |= {p["id"] for p in old} - {p["id"] for p in keep}

    if short:
        print("Not enough validated candidates (those tiers were left unchanged):")
        for node, diff, p, np_, w, nw in short:
            print(f"  {node}-{diff}: {p}/{np_} plain, {w}/{nw} word  ->  generate_playground.py --difficulty {diff} --only {node} --suffix b")
        print("Top up, validate, then re-run.")
        sys.exit(1)

    final.sort(key=lambda p: (NODES.index(p["node_id"]), DIFFS.index(p["difficulty"]), number_of(p["id"])))
    save_json(OUT, {"problems": final})
    save_json(RETIRED, sorted(retired | new_retired))
    print(f"Wrote {len(final)} problems to {OUT}; {len(new_retired)} ids retired")


if __name__ == "__main__":
    main()
