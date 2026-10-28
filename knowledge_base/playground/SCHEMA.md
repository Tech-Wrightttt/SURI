# Playground problem format (authoritative)

One problem = one JSON object. 14 nodes x 3 difficulties x 10 problems = 420 in the full bank
(PD is excluded). Every node x difficulty set is exactly 5 `word` + 5 `plain` problems.

```jsonc
{
  "id": "QE-E-01",              // <NODE>-<E|M|H>-<01..10>; stable slot id, never reused for different content
  "node_id": "QE",              // one of: QE FP SP LE OI FD SLE L2V L1V AE RPP RER PE PO
  "difficulty": "easy",         // easy | medium | hard
  "style": "plain",             // word | plain
  "prompt": "Solve $x^2-5x+6=0$.",   // Markdown with $inline$ / $$block$$ LaTeX, English
  "answer_type": "solution_set",     // number | expression | equation | solution_set | ordered_pair
  "answer": "2, 3",             // canonical LaTeX (what Reveal shows)
  "accepted_variants": [],      // extra LaTeX strings accepted as correct (rarely needed)
  "required_form": "none",      // see table below
  "unit": null,                 // display-only suffix, e.g. "km/h", "%"; null if none
  "solution_steps": [           // shown on Reveal only
    {"explanation": "Factor the trinomial.", "latex": "(x-2)(x-3)=0"},
    {"explanation": "Set each factor to zero.", "latex": "x=2 \\text{ or } x=3"}
  ],
  "source_doc": "grade9_quadratic_equations_intro.pdf",
  "content_hash": "sha256:..."  // filled by build_handoff.py
}
```

## `answer_type`

| answer_type | Meaning | Format hint the frontend shows |
|---|---|---|
| `number` | a single value | none |
| `expression` | an algebraic expression | none |
| `equation` | a full equation | "Enter the full equation, e.g. y = ..." |
| `solution_set` | one or more solutions, order-free | "Separate solutions with commas" |
| `ordered_pair` | `(x, y)` | "Enter as (x, y)" |

## `required_form`

The answer must be equivalent **and** in this form; equivalent-but-wrong-form is reported as `wrong_form`.

| required_form | Meaning |
|---|---|
| `none` | any equivalent answer |
| `factored` | fully factored over the rationals, each factor primitive and irreducible |
| `expanded` | flat sum of monomials, like terms combined |
| `lowest_terms` | every fraction reduced |
| `simplest_radical` | square-free radicands, no radical in a denominator |
| `positive_exponents` | no negative or zero exponents |
| `slope_intercept` | literally `y = mx + b` |

## `unit`

Display-only suffix shown next to the input (`[ ___ ] km/h`). Students type just the number. For
percent problems the answer is the number and `unit` is `"%"`. Ratios are never answered as `a:b`.

## JSON field to DB column mapping

Columns follow the repo's TEXT / `_json` / ISO-timestamp conventions (see `handoff/schema.sql`).

| JSON field | Column |
|---|---|
| `accepted_variants` | `accepted_variants_json` (JSON text) |
| `solution_steps` | `solution_steps_json` (JSON text) |
| (none) | `created_at` (ISO string, set by the loader/seed) |
| everything else | same name |

## Internal-only fields (never handed off)

`compute_expr` (ASCII expression for the verifier) and `validation` (`{status, method, notes}`)
live in `work/` and the sample file only. `build_handoff.py` strips them.
