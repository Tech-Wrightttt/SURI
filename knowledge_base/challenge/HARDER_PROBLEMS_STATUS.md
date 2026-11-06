# Harder problems and dedupe: process, status, remaining work

ClickUp 14ypx6259ur, "Increase playground problem difficulty and add more difficult problems to quiz and diagnostic".
Branch `CU-14ypx6259ur-harder-problems-dedupe` (from `staging`, after 14ypx62571e was merged).
Status as of 2026-11-06: **partly done.** Quiz, practice and diagnostic content is generated, reviewed and exported
at roughly half of the targets. **The playground has not been started.** The migration is built but not applied.

## What was done

### 1. Dedupe across every source (`knowledge_base/challenge/dedupe.py`)
- `template_key(text)` masks numbers, collapses variables and normalises LaTeX/spacing, so `x^2-9` and `x^2-16` match.
- `python knowledge_base/challenge/dedupe.py --report` prints duplicate groups per node across quiz rows
  (`seed_supabase.sql` standard rows + `challenge_practice_problems.json`), diagnostic probes and the playground bank.
  `--apply` writes `dedupe_removals.json` and removes the marked probes and seed rows. Test: `backend/tests/test_dedupe.py`.
- The generators import the same key, so a new candidate is rejected if it repeats a template already stored.

### 2. Duplicates removed
- 57 template-duplicate quiz rows planned for removal, 6 diagnostic probes dropped, 5 playground ids marked
  (those go with the playground rebuild). **4 of the 57 quiz rows were put back** (3 QE, 1 RER): QE and RER would
  otherwise have fewer than the 10 active rows `start_quiz` and `start_practice` require. See "Known exceptions".
- Quiz rows are **deactivated, not deleted** (`is_active`), because `practice_attempts` and `misconception_logs`
  reference `practice_problems.id`.

### 3. Generation (`generate_challenge_bank.py`, the verified pipeline)
Changes to the pipeline: PD is now in scope (grounded on `grade10_polynomial_roots.pdf` and `grade10_polynomial_graphs.pdf`;
the file named `..._polynomial_division.pdf` is really Geometric Sequences); 9+ distinct problem kinds per node
(digit puzzles, work and time, geometry, find-the-parameter, break-even, ...); a `standard` mode for replacement rows;
per-node needs (`generate_challenge_bank.py needs`); the division rule in every prompt plus a check that rejects `÷`
and `\div`; repair of two common slips (`x = 5` style distractors, hints that leak the answer).

### 4. Runtime changes
- `sample_mixed(..., exclude_ids)` prefers problems the student has not seen recently (last 5 quiz sessions plus the
  last 50 practice attempts) and falls back to seen ones only when short. Test: `backend/tests/test_problem_sampling.py`.
- Quiz serves 3 challenge of 5 (was 2). Diagnostic serves 2 challenge of 4 (was 1); `PASS_THRESHOLD` is still 3 of 4.
- Playground `/sitting` lists unsolved problems first, shuffled within each group.
- Every list query filters `is_active` (quiz, practice, playground topics and sitting). Lookups by id are not filtered,
  so old sessions still grade.
- Diagnostic repeat avoidance was **skipped**: `diagnostic_logs` does not record which probe was served, and no schema
  was added for it.

### 5. Playground tooling (built, not run)
`topic_specs.py` has the new tiers (easy = old medium with no single-operation drills, medium = old hard, hard =
multi-step reasoning from the challenge kinds, at most 2 per archetype and 1 age problem). `generate_playground.py` and
`validate_playground.py` now go through the shared Gemini limiter, daily budget and response cache.
`assemble_playground.py` keeps non-trivial easy problems (26 are single-operation drills and get replaced), replaces
medium and hard, numbers new ids after the highest existing one (for example `QE-H-11`), enforces template uniqueness and
the archetype cap, and writes `retired_ids.json`. `build_handoff.py` writes `retire_playground.sql`.

## Status: what was generated

Reviewed by hand: every exported diagnostic probe and quiz row was read, and the answers were recomputed.

| Bank | Before | Added | Now | Target | Short |
|---|---|---|---|---|---|
| Diagnostic challenge probes | 89 | 49 | 138 | 150 (10 per node) | 12 |
| Quiz challenge rows | 24 | 33 | 57 | 120 (8 per node) | 63 |
| Quiz standard rows | 155 | 10 new, 53 net removed | 112 | 8+ per node | RPP 4, others 6-10 |

Per node, quiz standard/challenge and diagnostic standard/challenge (playground unchanged, 10 per tier):

| Node | Quiz std/chal | Diag std/chal | Node | Quiz std/chal | Diag std/chal |
|---|---|---|---|---|---|
| QE | 8/2 | 16/5 | L1V | 7/6 | 16/10 |
| FP | 6/4 | 15/10 | AE | 9/4 | 16/6 |
| SP | 6/4 | 16/10 | RPP | 4/6 | 16/10 |
| LE | 8/3 | 15/10 | RER | 8/2 | 12/10 |
| OI | 9/6 | 16/10 | PE | 9/4 | 16/10 |
| FD | 6/5 | 16/10 | PD | 7/4 | 16/7 |
| SLE | 7/4 | 16/10 | PO | 10/0 | 16/10 |
| L2V | 8/3 | 16/10 | | | |

Targets missed: quiz challenge is under 8 in every node (PO has 0, QE and RER 2; the best is OI and L1V with 6);
diagnostic challenge is under 10 for QE (5), AE (6) and PD (7); standard quiz is under 8 for RPP (4), FD, FP, SP (6)
and L1V, SLE, PD (7).

### Review outcomes
- 23 candidates rejected by hand: 20 quiz items that were not harder than a standard row (single linear equation or
  one-step arithmetic, for example `5x + 25 = 150`), 1 diagnostic probe with a wrong key (`diag-PD-02`), and 2 standard
  rows that repeated a challenge template. Reasons are in `review_decisions.json`.
- **Lesson:** a candidate whose `check` is `{"kind": "expr", ...}` written by the model can restate its own (wrong) answer, so
  the machine check proves nothing and only the blind re-solve guards it, and that missed `diag-PD-02`. Treat `expr`
  checks as unverified and recompute them by hand.
- Typical yield was 15-40% of candidates after validation. Most drops were mechanical (blank placement, distractor
  format, hints, step counts).

### Gemini usage
985 calls on 2026-11-06: about 494 on `gemini-3.1-flash-lite` and about 491 on `gemini-3.5-flash-lite`. **Each model has a
daily cap of roughly 490 calls** and the run stops cleanly when it is hit. The daily quota resets at midnight Pacific
time, which is 4:00 PM Philippine time. Both models are used up for 2026-11-06.

## Known exceptions
- `dedupe.py --report` shows **4 duplicate groups** (QE and RER): the 4 restored template clones above. They are kept
  only so QE and RER stay at 10 active quiz rows. Remove them (add their ids back to `dedupe_removals.json`, delete the
  seed lines) once QE and RER have enough new rows.
- In-flight diagnostics: `sessions.current_probe_index` indexes into a node's probe list. Dropping 6 probes shifts the
  order for a student who is mid-diagnostic at deploy time. New probes were appended at the end.

## Remaining steps

1. **Resume generation after the quota resets** (4:00 PM PHT). Set `CHALLENGE_DAILY_CALL_BUDGET` high enough and keep
   per-model usage under about 490 calls a day. A second Gemini key from your own separate project, or a different model
   for the blind re-solve, raises the ceiling. From the repo root, with `PLAYGROUND_GEMINI_MODEL` set if needed:
   ```
   python knowledge_base/challenge/generate_challenge_bank.py validate      # validates the cached round-4 candidates
   python knowledge_base/challenge/generate_challenge_bank.py quiz --topup
   python knowledge_base/challenge/generate_challenge_bank.py standard --topup
   python knowledge_base/challenge/generate_challenge_bank.py diagnostic --topup
   python knowledge_base/challenge/generate_challenge_bank.py validate
   python knowledge_base/challenge/generate_challenge_bank.py review        # then read work/review.md
   ```
   Reject weak items in `review_decisions.json` (trivial single-equation items, wrong keys) and run `export`. Prefer
   rejecting items whose problem is one linear equation; also tighten the quiz prompt toward multi-constraint setups.
   Remaining need: about 12 diagnostic, 63 quiz challenge, QE/RER standard rows.
2. **Playground** (about 100-150 calls): `generate_playground.py --difficulty medium`, `--difficulty hard`, and `--difficulty easy`
   for the 8 nodes with trivial easy items (LE, OI, FD, L2V, L1V, AE, RPP, RER); then `validate_playground.py`,
   `review_playground.py` (triage `needs_review`), `assemble_playground.py`, `build_handoff.py`. Keep 10 per tier
   (5 word + 5 plain). Review the hard tier by hand for real reasoning.
3. `python scripts/build_harder_problems_migration.py` to rebuild the migration, preflight and rollback with the
   playground included, then re-run the checks: `pytest backend/tests`, `node --test tests/frontend/formatMath.test.mjs`,
   `cd frontend && npm run lint && npm run build`, and `dedupe.py --report` (target 0 groups).
4. **Apply to the database** (done by the owner, not by an agent): run
   `scripts/migrations/14ypx6259ur_harder_problems_preflight.sql`, then `14ypx6259ur_harder_problems.sql`
   (one idempotent transaction). Rollback is `14ypx6259ur_harder_problems_rollback.sql`.
   **Apply the migration before deploying this branch's backend:** the routes now filter on `is_active`, which the
   migration creates.
5. Deploy so the new `diagnostic_probes.json` is loaded, then run the visual test guide in the final report.

## Not covered by tests here
`tests/backend` needs a `TEST_DATABASE_URL` (a throwaway PostgreSQL database that is wiped), which was not available.
5 tests in `backend/tests` fail on `staging` before and after this branch (`is_debug` in account details,
`history_logs` insert in quiz timeouts). The frontend lint has 12 errors that exist on `staging`.
