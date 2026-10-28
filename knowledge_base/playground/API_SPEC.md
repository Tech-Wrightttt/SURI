# Playground API (proposed)

All routes live under `APIRouter(prefix="/api/playground")` and use `Depends(get_current_student)`.
**Answers are never returned before Reveal.** The frontend mock (`frontend/lib/playground/mock.ts`)
and the real client use exactly these shapes.

| Method & path | Request | Response |
|---|---|---|
| `GET /topics` | none | `{chains:[{entry_node_id, label, nodes:[{node_id, label, grade, difficulties:{easy:{total,solved}, medium:{...}, hard:{...}}}]}]}` |
| `GET /sitting?node_id=QE&difficulty=easy` | query params | `{node_id, difficulty, problems:[{id, style, prompt, answer_type, required_form, unit, solved}]}` |
| `POST /check` | `{problem_id, answer_latex}` | `{correct, reason, message, solved}` |
| `POST /reveal` | `{problem_id}` | `{answer, unit, solution_steps}` |

## Notes

- **/topics**: chains come from `ENTRY_NODES` + `get_chain()` (`backend/graph.py`,
  `backend/competency_utils.py`): QE>FP>SP>LE>OI>FD, SLE>L2V>L1V>AE>RPP>FD, RER>LE>OI>FD, PE>PO.
  PD is not included. Shared nodes (FD, OI, LE) appear under every chain that contains them, with the
  same counts. `solved` is counted from `playground_solved` for the current student.
- **/sitting**: the server shuffles all 10 problems once so there are no repeats. There is no sitting
  table; the client keeps the order. `solved` is per problem for the current student. Never include
  `answer`, `accepted_variants`, or `solution_steps`.
- **/check**: calls `check_answer()` (below). If `correct`, the route runs
  `INSERT INTO playground_solved (student_id, problem_id, solved_at) ... ON CONFLICT DO NOTHING`
  and returns `solved: true`. "Mark solved" is folded into `/check` on purpose: only server-verified
  answers count, so a client cannot fake a solve.
- **/reveal**: returns the answer, unit and steps. It also marks the problem solved for the student (inserted into `playground_solved`), so revealed problems count as done.
- Out of scope: scores, streaks, mastery writes, `misconception_logs` writes.
- Errors: `404` for an unknown `problem_id` / `node_id`, `422` for a bad `difficulty`.

## Frozen checker signature

The checker is a pure Python function (standard library only), landing in `backend/playground_checker/`:

```python
from backend.playground_checker import check_answer, CheckResult

check_answer(submitted_latex: str, problem: Mapping) -> CheckResult
# `problem` needs: answer, answer_type, accepted_variants, required_form, unit
# (the row's accepted_variants_json must be json.loads()-ed into `accepted_variants` first)

CheckResult(
    correct: bool,
    reason: "correct" | "not_equivalent" | "wrong_form" | "unparseable" | "empty",
    message: str,          # student-friendly, safe to show as-is
)
```

Until the real module lands you can stub it with this signature. `/check` returns `correct`,
`reason`, and `message` straight from the result.
