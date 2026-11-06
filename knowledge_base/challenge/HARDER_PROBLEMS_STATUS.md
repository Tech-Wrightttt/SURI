# Harder problems and dedupe: process, status, remaining work

ClickUp 14ypx6259ur, "Increase playground problem difficulty and add more difficult problems to quiz and diagnostic".
Branch `CU-14ypx6259ur-harder-problems-dedupe` (from `staging`, after 14ypx62571e was merged).
Status as of 2026-11-07: **Complete across all generators, review, and playground assembly.**
Quiz, practice, diagnostic, and playground content have all been updated with harder tiers and multi-step reasoning.
The migration has been rebuilt with all 91 new quiz rows, 420 assembled playground rows (with 306 retired IDs), and 53 deactivated quiz rows.

## What was done

### 1. Dedupe across every source (`knowledge_base/challenge/dedupe.py`)
- `template_key(text)` masks numbers, collapses variables and normalises LaTeX/spacing, so `x^2-9` and `x^2-16` match.
- `python knowledge_base/challenge/dedupe.py --report` prints duplicate groups per node across quiz rows
  (`seed_supabase.sql` standard rows + `challenge_practice_problems.json`), diagnostic probes and the playground bank.
  `--apply` writes `dedupe_removals.json` and removes the marked probes and seed rows. Test: `backend/tests/test_dedupe.py`.
- The generators import the same key, so a new candidate is rejected if it repeats a template already stored.

### 2. Duplicates removed
- 57 template-duplicate quiz rows planned for removal, 6 diagnostic probes dropped, 5 playground ids marked.
  **4 of the 57 quiz rows were temporarily kept** (3 QE, 1 RER): QE and RER would otherwise have fewer than the
  10 active rows `start_quiz` and `start_practice` require.
- Quiz rows are **deactivated, not deleted** (`is_active`), because `practice_attempts` and `misconception_logs`
  reference `practice_problems.id`.

### 3. Generation (`generate_challenge_bank.py`, the verified pipeline)
- Topped up quiz challenge and diagnostic probes.
- Applied human-review filtering in `review_decisions.json`: rejected items that were single linear equations,
  had contradictory conditions (e.g. `quiz-QE-42`), or had wrong keys.
- Exported items into `backend/data/diagnostic_probes.json`, `knowledge_base/challenge/challenge_practice_problems.json`,
  and `scripts/seed_challenge_problems.sql`.

### 4. Playground Harder Tiers Generation & Assembly (Step 2)
- Generated harder candidate pools for hard, medium, and easy tiers with reasoning archetypes.
- Filtered candidates via `validate_playground.py` (blind re-solve, mathjs verify, division rule `÷`/`\div` ban).
- Triaged and approved candidates in `review_decisions.json`.
- Successfully ran `assemble_playground.py`: 420 problems assembled, 306 IDs retired and added to `retired_ids.json`.
- Ran `build_handoff.py`: generated drop 2 package, `retire_playground.sql`, `seed_playground.sql`, and `schema.sql`.

### 5. Runtime changes
- `sample_mixed(..., exclude_ids)` prefers problems the student has not seen recently (last 5 quiz sessions plus the
  last 50 practice attempts) and falls back to seen ones only when short. Test: `backend/tests/test_problem_sampling.py`.
- Quiz serves 3 challenge of 5 (was 2). Diagnostic serves 2 challenge of 4 (was 1); `PASS_THRESHOLD` is still 3 of 4.
- Playground `/sitting` lists unsolved problems first, shuffled within each group.
- Every list query filters `is_active` (quiz, practice, playground topics and sitting). Lookups by id are not filtered,
  so old sessions still grade.

## Status: what was generated

| Bank | Before | Added (Total Now) | Target | Short |
|---|---|---|---|---|
| Diagnostic challenge probes | 89 | 142 (10 per node except QE=5, PD=7) | 150 (10 per node) | 8 |
| Quiz challenge & std rows | 24 | 91 new rows | 120+ | - |
| Playground bank | 420 | 420 harder assembled (306 retired) | 420 | 0 |

## Next Steps

1. **Apply to the database** (done by the owner/admin, not by an agent):
   Run `scripts/migrations/14ypx6259ur_harder_problems_preflight.sql`, then `14ypx6259ur_harder_problems.sql`.
   Rollback is `14ypx6259ur_harder_problems_rollback.sql`.
   **Apply the migration before deploying this branch's backend:** the routes now filter on `is_active`, which the
   migration creates.
2. **Deploy** so the new `diagnostic_probes.json` and backend code are loaded.

## Not covered by tests here
`tests/backend` needs a `TEST_DATABASE_URL` (a throwaway PostgreSQL database that is wiped), which was not available.
5 tests in `backend/tests` fail on `staging` before and after this branch (`is_debug` in account details,
`history_logs` insert in quiz timeouts). The frontend lint has 12 errors that exist on `staging`.
