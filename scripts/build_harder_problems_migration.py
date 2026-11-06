"""
Build scripts/migrations/14ypx6259ur_harder_problems.sql (+ preflight and rollback) from the repo's generated files.

  python scripts/build_harder_problems_migration.py

Inputs: knowledge_base/challenge/dedupe_removals.json (quiz rows to deactivate),
        scripts/seed_challenge_problems.sql (new quiz rows), knowledge_base/playground/handoff/seed_playground.sql
        and retire_playground.sql, knowledge_base/playground/retired_ids.json.
The migration is one transaction and idempotent. It deactivates (is_active = FALSE) instead of deleting because
practice_attempts / misconception_logs reference practice_problems and playground_solved references playground_problems.
Nothing here touches a database.
"""

import json
import os
import re

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
OUT_DIR = os.path.join(ROOT, "scripts", "migrations")
NAME = "14ypx6259ur_harder_problems"


def read(*parts):
    with open(os.path.join(ROOT, *parts), encoding="utf-8") as f:
        return f.read()


def git_show(path):
    import subprocess

    return subprocess.run(["git", "show", "origin/staging:" + path], cwd=ROOT, capture_output=True, text=True,
                          encoding="utf-8", check=True).stdout


def ids_sql(ids):
    return ", ".join("'" + i.replace("'", "''") + "'" for i in sorted(ids))


def main():
    removals = json.loads(read("knowledge_base", "challenge", "dedupe_removals.json"))
    old_quiz = removals.get("practice", [])
    new_rows = [ln for ln in read("scripts", "seed_challenge_problems.sql").splitlines()
                if ln.startswith("INSERT INTO practice_problems")]
    new_quiz = re.findall(r"VALUES \('([^']+)'", "\n".join(new_rows))
    # ids shipped by the first challenge release are already in the database; the rollback must not hide them
    shipped = set(re.findall(r"VALUES \('([^']+)'", git_show("scripts/seed_challenge_problems.sql")))
    new_quiz = [i for i in new_quiz if i not in shipped]
    # the playground part exists only once assemble_playground.py has produced retired_ids.json
    has_pg = os.path.exists(os.path.join(ROOT, "knowledge_base", "playground", "retired_ids.json"))
    pg_seed = [ln for ln in read("knowledge_base", "playground", "handoff", "seed_playground.sql").splitlines()
               if ln.startswith("INSERT INTO playground_problems")] if has_pg else []
    retired = json.loads(read("knowledge_base", "playground", "retired_ids.json")) if has_pg else []
    live_pg = re.findall(r"VALUES \('([^']+)'", "\n".join(pg_seed))

    mig = [f"-- {NAME}: dedupe + harder quiz, diagnostic-adjacent practice rows and playground (CU-14ypx6259ur).",
           "-- Idempotent, one transaction. Deactivates instead of deleting (attempt/solved tables reference the ids).",
           "BEGIN;", "",
           "ALTER TABLE practice_problems ADD COLUMN IF NOT EXISTS difficulty TEXT NOT NULL DEFAULT 'standard';",
           "ALTER TABLE practice_problems ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;",
           "ALTER TABLE playground_problems ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;", "",
           f"-- {len(old_quiz)} template-duplicate quiz rows",
           f"UPDATE practice_problems SET is_active = FALSE WHERE id IN ({ids_sql(old_quiz)});", "",
           f"-- {len(new_rows)} quiz rows (challenge + standard; ids that already exist are skipped)", *new_rows, "",
           *([f"-- {len(pg_seed)} playground rows (existing ids are skipped)", *pg_seed, "",
              f"-- {len(retired)} playground problems replaced by harder ones",
              f"UPDATE playground_problems SET is_active = FALSE WHERE id IN ({ids_sql(retired)});", ""] if has_pg else
             ["-- playground: not part of this build (harder playground problems are not generated yet)", ""]),
           "COMMIT;", ""]

    old_bank = {p["id"] for p in json.loads(git_show("knowledge_base/playground/playground_problems.json"))["problems"]}
    new_pg = [i for i in live_pg if i not in old_bank]

    pre = ["-- Pre-flight: what " + NAME + ".sql will change. Read-only; run before the migration.",
           "SELECT 'practice_problems total' AS what, COUNT(*) AS n FROM practice_problems",
           f"UNION ALL SELECT 'quiz rows to deactivate (present)', COUNT(*) FROM practice_problems WHERE id IN ({ids_sql(old_quiz)})",
           f"UNION ALL SELECT 'quiz rows to deactivate that students already attempted', COUNT(*) FROM practice_attempts WHERE problem_id IN ({ids_sql(old_quiz)})",
           f"UNION ALL SELECT 'new quiz rows already present (of {len(new_quiz)})', COUNT(*) FROM practice_problems WHERE id IN ({ids_sql(new_quiz)})",
           "UNION ALL SELECT 'playground_problems total', COUNT(*) FROM playground_problems",
           f"UNION ALL SELECT 'playground rows to retire (present)', COUNT(*) FROM playground_problems WHERE id IN ({ids_sql(retired)})",
           f"UNION ALL SELECT 'playground rows to retire that students solved', COUNT(*) FROM playground_solved WHERE problem_id IN ({ids_sql(retired)})",
           f"UNION ALL SELECT 'new playground rows already present (of {len(new_pg)})', COUNT(*) FROM playground_problems WHERE id IN ({ids_sql(new_pg)});", ""]

    rollback = ["-- Rollback for " + NAME + ".sql. Rows are hidden, not deleted, so attempt and solved history stays intact.",
                "BEGIN;",
                f"UPDATE practice_problems SET is_active = TRUE WHERE id IN ({ids_sql(old_quiz)});",
                f"UPDATE practice_problems SET is_active = FALSE WHERE id IN ({ids_sql(new_quiz)});",
                f"UPDATE playground_problems SET is_active = TRUE WHERE id IN ({ids_sql(retired)});",
                f"UPDATE playground_problems SET is_active = FALSE WHERE id IN ({ids_sql(new_pg)});",
                "COMMIT;", ""]

    # a statement over an empty id list is invalid SQL (the playground part may not exist yet)
    pre = [ln for ln in pre if "IN ()" not in ln]
    rollback = [ln for ln in rollback if "IN ()" not in ln]
    last = max(i for i, ln in enumerate(pre) if ln.strip())
    pre[last] = pre[last].rstrip(";") + ";"
    os.makedirs(OUT_DIR, exist_ok=True)
    for suffix, lines in (("", mig), ("_preflight", pre), ("_rollback", rollback)):
        path = os.path.join(OUT_DIR, NAME + suffix + ".sql")
        with open(path, "w", encoding="utf-8", newline="\n") as f:
            f.write("\n".join(lines))
        print("wrote", path)
    print(f"{len(old_quiz)} deactivated, {len(new_rows)} new quiz rows, {len(pg_seed)} playground rows, {len(retired)} retired")


if __name__ == "__main__":
    main()
