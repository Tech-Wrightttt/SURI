"""
Template-level duplicate finder shared by every question source (CU-14ypx6259ur).

Two items are the same template when their text is identical once numbers are masked, variables are
collapsed and whitespace is normalised, so `x^2-9` and `x^2-16` collide. It compares, per node:
  - quiz/practice rows  (scripts/seed_supabase.sql standard rows + challenge_practice_problems.json)
  - diagnostic probes   (backend/data/diagnostic_probes.json)
  - playground problems (knowledge_base/playground/playground_problems.json)

  python knowledge_base/challenge/dedupe.py --report            # duplicate groups per node (exit 1 if any)
  python knowledge_base/challenge/dedupe.py --report --nodes QE

The generators import `known_keys(node)` and `template_key` so new candidates are rejected against every source.
"""

import argparse
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))

PROBES_PATH = os.path.join(ROOT, "backend", "data", "diagnostic_probes.json")
PLAYGROUND_PATH = os.path.join(ROOT, "knowledge_base", "playground", "playground_problems.json")
CHALLENGE_PATH = os.path.join(HERE, "challenge_practice_problems.json")
STANDARD_SQL = os.path.join(ROOT, "scripts", "seed_supabase.sql")
REMOVALS_PATH = os.path.join(HERE, "dedupe_removals.json")  # {"practice": [ids], "diagnostic": [question_text], ...}

# higher = kept first when a template group has to lose members
PRIORITY = {"practice-challenge": 4, "practice-standard": 3, "playground": 2, "diagnostic": 1}


def template_key(text: str) -> str:
    """Mask numbers, collapse variables, drop LaTeX noise and spacing: x^2-9 and x^2-16 share a key."""
    s = str(text or "").lower()
    s = s.replace("÷", "/").replace("\\div", "/").replace("\\cdot", "*").replace("\\times", "*").replace("×", "*")
    s = s.replace("−", "-").replace("\\left", "").replace("\\right", "").replace("$", "")
    s = re.sub(r"\\text\{([^}]*)\}", r"\1", s)
    for _ in range(4):  # nested \frac
        s = re.sub(r"\\d?frac\{([^{}]*)\}\{([^{}]*)\}", r"(\1)/(\2)", s)
    s = re.sub(r"\\sqrt\{([^{}]*)\}", r"sqrt(\1)", s).replace("{", "(").replace("}", ")")
    s = re.sub(r"\d+(?:[.,]\d+)*", "N", s)
    s = re.sub(r"(?<![a-z\\])[a-z](?![a-z])", "V", s)
    s = re.sub(r"\s+", "", s)
    return re.sub(r"\(([NV])\)", r"\1", s)  # frac{1}{2} -> (N)/(N) -> N/N


# --- loaders ----------------------------------------------------------------------------------

def _sql_values(line: str) -> list:
    """The values of one `INSERT ... VALUES (...)` line: quoted strings ('' escapes), NULL and numbers."""
    body = line.split("VALUES (", 1)[1]
    out, i = [], 0
    while i < len(body):
        c = body[i]
        if c == "'":
            j, buf = i + 1, []
            while True:
                if body[j] == "'":
                    if body[j + 1:j + 2] == "'":
                        buf.append("'")
                        j += 2
                        continue
                    break
                buf.append(body[j])
                j += 1
            out.append("".join(buf))
            i = j + 1
        elif c in ",) ;":
            i += 1
        else:
            j = i
            while j < len(body) and body[j] not in ",)":
                j += 1
            out.append(body[i:j].strip())
            i = j
    return out


def standard_rows() -> list:
    """Standard practice rows from the seed SQL: dicts with id, node_id, problem_expr, word_problem_text."""
    rows = []
    with open(STANDARD_SQL, encoding="utf-8") as f:
        for line in f:
            if not line.startswith("INSERT INTO practice_problems"):
                continue
            cols = [c.strip() for c in line.split("(", 2)[1].split(")", 1)[0].split(",")]
            vals = _sql_values(line)
            row = dict(zip(cols, vals))
            row["difficulty"] = row.get("difficulty", "standard")
            rows.append(row)
    return rows


def load_items() -> list:
    """Every item as {source, node, ref, text, key}. `ref` identifies it for the removal plan."""
    removed = removals()
    items = []
    for r in standard_rows():
        items.append(("practice-standard", r["node_id"], r["id"], r["problem_expr"] or r.get("word_problem_text", "")))
    with open(CHALLENGE_PATH, encoding="utf-8") as f:
        for r in json.load(f):
            items.append(("practice-challenge", r["node_id"], r["id"], r["problem_expr"]))
    with open(PROBES_PATH, encoding="utf-8") as f:
        for node, probes in json.load(f).items():
            for p in probes:
                items.append(("diagnostic", node, p["question_text"], p["question_text"]))
    with open(PLAYGROUND_PATH, encoding="utf-8") as f:
        for p in json.load(f)["problems"]:
            items.append(("playground", p["node_id"], p["id"], p["prompt"]))
    return [{"source": s, "node": n, "ref": ref, "text": t, "key": template_key(t)}
            for s, n, ref, t in items if ref not in removed]


def removals() -> set:
    if not os.path.exists(REMOVALS_PATH):
        return set()
    with open(REMOVALS_PATH, encoding="utf-8") as f:
        return {ref for refs in json.load(f).values() for ref in refs}


def known_keys(node_id: str) -> set:
    """Template keys of everything already stored for a node (used by the generators)."""
    return {i["key"] for i in load_items() if i["node"] == node_id}


def known_texts(node_id: str) -> list:
    """Display text of everything stored for a node (shown to generators so they vary the shape)."""
    return [i["text"] for i in load_items() if i["node"] == node_id]


# --- grouping ---------------------------------------------------------------------------------

def groups(items: list, nodes=None) -> dict:
    """{node: [[item, ...], ...]} for every key shared by two or more items of the node."""
    by = {}
    for it in items:
        if nodes and it["node"] not in nodes:
            continue
        by.setdefault((it["node"], it["key"]), []).append(it)
    out = {}
    for (node, _), members in by.items():
        if len(members) > 1:
            out.setdefault(node, []).append(members)
    return out


def best_first(members: list) -> list:
    return sorted(members, key=lambda m: -PRIORITY[m["source"]])


def plan_removals(items: list) -> dict:
    """Keep the best item of each template group, mark the rest. -> {source: [refs]}."""
    plan = {}
    for per_node in groups(items).values():
        for members in per_node:
            for m in best_first(members)[1:]:
                plan.setdefault(m["source"].split("-")[0], []).append(m["ref"])
    return plan


def apply_plan(plan: dict):
    """Drop planned diagnostic probes and standard seed rows. Playground rows go in the playground rebuild."""
    drop_q = set(plan.get("diagnostic", []))
    with open(PROBES_PATH, encoding="utf-8") as f:
        probes = json.load(f)
    for node in probes:
        probes[node] = [p for p in probes[node] if p["question_text"] not in drop_q]
    with open(PROBES_PATH, "w", encoding="utf-8", newline="\n") as f:
        json.dump(probes, f, indent=2, ensure_ascii=False)
        f.write("\n")
    drop_ids = set(plan.get("practice", []))
    with open(STANDARD_SQL, encoding="utf-8", newline="") as f:
        lines = f.read().split("\n")
    kept = [ln for ln in lines
            if not (ln.startswith("INSERT INTO practice_problems") and _sql_values(ln)[0] in drop_ids)]
    with open(STANDARD_SQL, "w", encoding="utf-8", newline="") as f:
        f.write("\n".join(kept))
    print(f"dropped {len(lines) - len(kept)} seed rows and {len(drop_q)} probes")


def main():
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--report", action="store_true", help="print duplicate groups per node")
    ap.add_argument("--nodes", help="comma-separated node ids")
    ap.add_argument("--plan", action="store_true", help="write dedupe_removals.json (keep the best of each group)")
    ap.add_argument("--apply", action="store_true", help="--plan, then drop the marked probes and seed rows from the repo files")
    args = ap.parse_args()
    nodes = set(args.nodes.split(",")) if args.nodes else None
    items = load_items()
    found = groups(items, nodes)
    total = sum(len(g) for g in found.values())
    if args.plan or args.apply:
        plan = plan_removals(items)
        with open(REMOVALS_PATH, "w", encoding="utf-8", newline="\n") as f:
            json.dump(plan, f, indent=2, ensure_ascii=False)
            f.write("\n")
        print(f"wrote {REMOVALS_PATH}: " + ", ".join(f"{k} {len(v)}" for k, v in plan.items()))
        if args.apply:
            apply_plan(plan)
        return
    for node in sorted(found):
        print(f"\n== {node}: {len(found[node])} duplicate group(s)")
        for members in found[node]:
            print(f"  key {members[0]['key'][:70]}")
            for m in best_first(members):
                print(f"    [{m['source']}] {m['ref'][:36]:36} {m['text'][:80]!r}")
    print(f"\n{total} duplicate group(s) across {len(items)} items")
    sys.exit(1 if total else 0)


if __name__ == "__main__":
    main()
