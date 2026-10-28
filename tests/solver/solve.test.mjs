// Module 10 — Mathematical Solver Engine (frontend/app/api/solve/route.ts).
import { test } from "node:test";
import assert from "node:assert/strict";

const { POST } = await import("../../frontend/app/api/solve/route.ts");

async function solve(expression) {
  const res = await POST(new Request("http://localhost/api/solve", {
    method: "POST",
    body: JSON.stringify({ expression }),
  }));
  return { status: res.status, body: await res.json() };
}

test("TC47 rejects empty or whitespace expression with HTTP 400", async () => {
  for (const expression of ["   ", "", 42]) {
    const { status, body } = await solve(expression);
    assert.equal(status, 400);
    assert.deepEqual(body, { error: "Enter a complete expression before solving." });
  }
});

test("TC48 rejects unmatched parentheses with HTTP 422", async () => {
  const { status, body } = await solve("2*x + (3*y");
  assert.equal(status, 422);
  assert.equal(body.error,
    "We couldn't understand this expression. Check that your parentheses and operators are complete.");
});

test("TC49 simplifies a valid expression into serialized steps", async () => {
  const { status, body } = await solve("2*x + 3*x");
  assert.equal(status, 200);
  assert.ok(Array.isArray(body.steps) && body.steps.length > 0);
  const last = body.steps.at(-1);
  assert.equal(last.changeType, "ADD_POLYNOMIAL_TERMS");
  assert.equal(last.newNode, "5 x");
  for (const step of body.steps) {
    assert.equal(typeof step.changeType, "string");
    assert.ok(Array.isArray(step.substeps));
  }
  assert.ok(last.substeps.length > 0, "nested substeps are serialized recursively");
});
