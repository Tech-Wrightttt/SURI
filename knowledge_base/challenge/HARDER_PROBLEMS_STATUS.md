# Harder problems and dedupe: process, status, remaining work

ClickUp 14ypx6259ur, "Increase playground problem difficulty and add more difficult problems to quiz and diagnostic".
Branch `CU-14ypx6259ur-harder-problems-dedupe` (from `staging`, after 14ypx62571e was merged).
Status as of 2026-11-07: **substantially expanded and re-validated.** Quiz, practice, and diagnostic content
has been topped up and verified across multiple generation/review passes. The migration has been rebuilt
with 91 new quiz rows, deactivating 53 duplicates.

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

### 4. Runtime changes
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
| Playground bank | 420 | 420 existing | 420 | 0 |

Per node, diagnostic standard/challenge count:
- QE: 16 std / 5 chal
- FP: 15 std / 10 chal
- SP: 16 std / 10 chal
- LE: 15 std / 10 chal
- OI: 16 std / 10 chal
- FD: 16 std / 10 chal
- SLE: 16 std / 10 chal
- L2V: 16 std / 10 chal
- L1V: 16 std / 10 chal
- AE: 16 std / 10 chal
- RPP: 16 std / 10 chal
- RER: 12 std / 10 chal
- PE: 16 std / 10 chal
- PD: 16 std / 7 chal
- PO: 16 std / 10 chal

Total Diagnostic Challenge Probes: **142** out of 150 (94.7% complete).

## Remaining steps

1. **Rebuild migration and verification**:
   - `build_harder_problems_migration.py` updated with all 91 new quiz rows.
   - Verified with `node --test tests/frontend/formatMath.test.mjs` (14/14 passing).
   - Verified with `npm run build` in `frontend` (successful production build).
   - `pytest backend/tests`: 169 passed, 5 known existing failures present on staging.
2. **Apply to the database** (done by the owner/admin, not by an agent):
   Run `scripts/migrations/14ypx6259ur_harder_problems_preflight.sql`, then `14ypx6259ur_harder_problems.sql`.
   Rollback is `14ypx6259ur_harder_problems_rollback.sql`.
   **Apply the migration before deploying this branch's backend:** the routes now filter on `is_active`, which the
   migration creates.
3. **Deploy** so the new `diagnostic_probes.json` is loaded.

## Not covered by tests here
`tests/backend` needs a `TEST_DATABASE_URL` (a throwaway PostgreSQL database that is wiped), which was not available.
5 tests in `backend/tests` fail on `staging` before and after this branch (`is_debug` in account details,
`history_logs` insert in quiz timeouts). The frontend lint has 12 errors that exist on `staging`.
