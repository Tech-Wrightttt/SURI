# Playground hand-off

## 1. What's ready and who owns what

**Ready (Rainne):** the problem data (`playground_problems.json`, `seed_playground.sql`), the answer
checker (`backend/playground_checker`, signature frozen in `API_SPEC.md`), and the frontend page with a
mock client.

**Yours (backend developer):** the tables, the loader, the routes, and caching.

**Out of scope:** scores, mastery writes, and the Mistakes view. Nothing is written there.

**Current drop: hard** (`MANIFEST.json` has `"drop": "hard"` and `"complete": false`). It has 350 problems
for all 14 topics: easy (5 per topic, ids `<NODE>-E-01..05`), medium (10 per topic, `<NODE>-M-01..10`) and hard
(10 per topic, `<NODE>-H-01..10`). Medium and hard are already seeded in the shared database; re-running
`seed_playground.sql` only inserts rows that are missing. Easy slots 06-10 are the only part still to come, and
they use the same format.

## 2. Setup

1. Run `schema.sql` in the Supabase SQL editor.
2. Load the seed: run `seed_playground.sql`, **or** load `playground_problems.json` with a small loader
   modelled on `knowledge_base/load_content_seed.py`.
3. `from backend.playground_checker import check_answer` (stub it with the frozen signature until the
   checker PR lands).
4. Implement the 4 routes in `backend/routes/playground_routes.py` according to `API_SPEC.md`, and
   register the router in `backend/main.py`.
5. Point the frontend at the routes (next section).

## 3. The exact frontend switch

In `frontend/lib/playground/client.ts`, change

```ts
const USE_MOCK = true;
```

to `false`. Nothing else changes.

## 4. Caching

The data is static seed data generated offline, with no Gemini at runtime. It is safe to cache
`playground_problems` in process memory keyed by id, and invalidate on deploy or re-seed. Only
`playground_solved` is per-student and live. **Never send `answer`, `accepted_variants`, or
`solution_steps` before `/reveal`.**

## 5. Re-seeding when problems are updated

1. Pull `dev`.
2. For brand-new ids, run `seed_playground.sql`. For changed ids, run `update_playground.sql` (only
   present when something changed; the ids are listed in `MANIFEST.json` under `changed_ids`).
3. Check the counts against `MANIFEST.json`:
   `SELECT node_id, difficulty, style, count(*) FROM playground_problems GROUP BY 1,2,3;`
4. Clear the cache.
5. Optionally `DELETE FROM playground_solved WHERE problem_id IN (<changed_ids>);` so stale checkmarks
   do not stay on edited problems.

Ids are stable slots (`<NODE>-<E|M|H>-<01..10>`) and are never reused for unrelated content.

## 6. Who to ask

- **Rainne:** problem content, answers, checker behaviour, the frontend, `MANIFEST.json` questions.
- **Backend developer:** tables, routes, caching, deployment.
