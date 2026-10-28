/**
 * verify.js -- independent numeric/symbolic verifier for the Playground validator.
 *
 * Reads JSON lines on stdin, writes one JSON line per request on stdout:
 *   in : {"id": "...", "op": "eval|residual|solve|factor", ...}
 *   out: {"id": "...", "ok": true, "result": ...}  or  {"id": "...", "ok": false, "error": "..."}
 *
 * Ops:
 *   eval     {expr, scope}            -> number           (mathjs)
 *   residual {eq: "lhs=rhs", scope}   -> lhs - rhs        (mathjs)
 *   solve    {eq, variable}           -> {roots: [number], ascii}   (mathsteps solveEquation)
 *   factor   {expr}                   -> {ascii}          (mathsteps factor)
 *
 * mathsteps 0.2.0 and mathjs 3.11.2 are resolved from frontend/node_modules; nothing is installed.
 */

const path = require('path');
const readline = require('readline');

const modules = path.join(__dirname, '..', '..', 'frontend', 'node_modules');
const math = require(path.join(modules, 'mathjs'));
const mathsteps = require(path.join(modules, 'mathsteps'));

function num(v) {
  if (typeof v === 'number' && isFinite(v)) return v;
  if (v && typeof v.valueOf === 'function' && typeof v.valueOf() === 'number' && isFinite(v.valueOf())) {
    return v.valueOf();
  }
  throw new Error('non-numeric result: ' + String(v));
}

function evalExpr(expr, scope) {
  return num(math.eval(expr, Object.assign({}, scope || {})));
}

function splitEq(eq) {
  const parts = eq.split('=');
  if (parts.length !== 2) throw new Error('expected exactly one "=": ' + eq);
  return parts;
}

const ops = {
  eval: (r) => evalExpr(r.expr, r.scope),
  residual: (r) => {
    const [l, rt] = splitEq(r.eq);
    return evalExpr(l, r.scope) - evalExpr(rt, r.scope);
  },
  solve: (r) => {
    const steps = mathsteps.solveEquation(r.eq);
    if (!steps || steps.length === 0) throw new Error('mathsteps could not solve');
    const last = steps[steps.length - 1].newEquation.ascii();
    const rhs = last.split('=')[1].trim();
    let roots;
    if (rhs.startsWith('[')) {
      roots = rhs.slice(1, -1).split(',').map((t) => evalExpr(t.trim(), {}));
    } else {
      roots = [evalExpr(rhs, {})];
    }
    return { roots, ascii: last };
  },
  factor: (r) => {
    const steps = mathsteps.factor(r.expr);
    if (!steps || steps.length === 0) throw new Error('mathsteps could not factor');
    return { ascii: steps[steps.length - 1].newNode.toString() };
  },
};

const rl = readline.createInterface({ input: process.stdin, terminal: false });
rl.on('line', (line) => {
  if (!line.trim()) return;
  let req;
  try {
    req = JSON.parse(line);
  } catch (e) {
    process.stdout.write(JSON.stringify({ id: null, ok: false, error: 'bad json' }) + '\n');
    return;
  }
  try {
    const fn = ops[req.op];
    if (!fn) throw new Error('unknown op ' + req.op);
    process.stdout.write(JSON.stringify({ id: req.id, ok: true, result: fn(req) }) + '\n');
  } catch (e) {
    process.stdout.write(JSON.stringify({ id: req.id, ok: false, error: String(e.message || e) }) + '\n');
  }
});
