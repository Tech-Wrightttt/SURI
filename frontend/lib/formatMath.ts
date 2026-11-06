/**
 * One rule for division everywhere: inside math, `A / B`, `A ÷ B` and `A \div B`
 * render as a stacked `\frac{A}{B}`. Prose outside math is left untouched.
 */

const DIV_OP = /\s*(?:\/|÷|\\div(?![a-zA-Z]))\s*/;
//  delimits placeholders for protected \text{...} chunks, so they count as operand characters
const TERM = "[A-Za-z0-9.?\\uE000]+";

/** Index of the bracket matching the one at `i` (open or close), or -1. */
function matchBracket(s: string, i: number): number {
  const open = s[i] === "(" || s[i] === "{";
  const [o, c] = s[i] === "(" || s[i] === ")" ? ["(", ")"] : ["{", "}"];
  let depth = 0;
  for (let k = i; open ? k < s.length : k >= 0; k += open ? 1 : -1) {
    if (s[k] === o) depth += open ? 1 : -1;
    else if (s[k] === c) depth += open ? -1 : 1;
    if (depth === 0) return k;
  }
  return -1;
}

/** Start index of the operand that ends just before `end`, or -1. */
function operandStart(s: string, end: number): number {
  let e = end;
  while (e > 0 && /\s/.test(s[e - 1])) e--;
  if (e === 0) return -1;
  let start = -1;
  const last = s[e - 1];
  if (last === ")" || last === "}") {
    start = matchBracket(s, e - 1);
    if (start < 0) return -1;
    if (last === "}") {
      if (s[start - 1] === "}") { // \frac{a}{b}
        const first = matchBracket(s, start - 1);
        if (first >= 0) start = first;
      }
      const cmd = /\\[a-zA-Z]+$/.exec(s.slice(0, start));
      if (cmd) start -= cmd[0].length;
    }
  } else {
    const m = new RegExp(`\\\\[a-zA-Z]+$|${TERM}$`).exec(s.slice(0, e));
    if (!m) return -1;
    start = m.index;
  }
  // exponent / subscript belongs to its base: (a+b)^2 / 5
  const before = start - 1;
  if (before > 0 && (s[before] === "^" || s[before] === "_")) {
    const base = operandStart(s, before);
    if (base >= 0) start = base;
  }
  // unary minus: -48 \div 6 -> \frac{-48}{6}
  if (s[start - 1] === "-" && /(?:^|[=+\-*/(,^])\s*$/.test(s.slice(0, start - 1))) start--;
  return start;
}

/** End index (exclusive) of the operand that begins at/after `from`, or -1. */
function operandEnd(s: string, from: number): number {
  let b = from;
  while (b < s.length && /\s/.test(s[b])) b++;
  if (b >= s.length) return -1;
  if (s[b] === "-") b++;
  let end = b;
  if (s[b] === "(" || s[b] === "{") {
    end = matchBracket(s, b) + 1;
    if (end === 0) return -1;
  } else if (s[b] === "\\") {
    const cmd = /^\\[a-zA-Z]+/.exec(s.slice(b));
    if (!cmd) return -1;
    end = b + cmd[0].length;
    for (let g = 0; g < 2 && s[end] === "{"; g++) end = matchBracket(s, end) + 1;
  } else {
    const m = new RegExp(`^${TERM}`).exec(s.slice(b));
    if (!m) return -1;
    end = b + m[0].length;
  }
  if (s[end] === "^" || s[end] === "_") {
    const more = operandEnd(s, end + 1);
    if (more >= 0) end = more;
  }
  return end;
}

const stripParens = (x: string) => {
  const t = x.trim();
  return t[0] === "(" && matchBracket(t, 0) === t.length - 1 ? t.slice(1, -1).trim() : t;
};

function formatSpan(span: string): string {
  // \text{km/h} etc. must keep its slash
  const kept: string[] = [];
  let s = span.replace(/\\(?:text|mathrm|textbf)\{[^}]*\}/g, (m) => `${kept.push(m) - 1}`);
  let from = 0;
  for (;;) {
    const m = DIV_OP.exec(s.slice(from));
    if (!m) break;
    const opStart = from + m.index;
    const opEnd = opStart + m[0].length;
    const a = operandStart(s, opStart);
    const b = operandEnd(s, opEnd);
    if (a < 0 || b < 0) { from = opEnd; continue; }
    const frac = `\\frac{${stripParens(s.slice(a, opStart))}}{${stripParens(s.slice(opEnd, b))}}`;
    s = s.slice(0, a) + frac + s.slice(b);
    from = a;
  }
  return s.replace(/(\d+)/g, (_m, i) => kept[+i]);
}

// bare strings with words/commas are prose or text answers, not math
const isProse = (t: string) => {
  const w = t.replace(/\\[a-zA-Z]+|\\,/g, "");
  return /[a-zA-Z]{2,}/.test(w) || w.includes(",");
};

export function formatMath(text: string): string {
  if (!text) return text ?? "";
  if (!text.includes("$")) return isProse(text) ? text : formatSpan(text);
  return text.replace(/\$\$([\s\S]+?)\$\$|\$([^$]+?)\$/g, (m, block?: string, inline?: string) =>
    block !== undefined ? `$$${formatSpan(block)}$$` : `$${formatSpan(inline as string)}$`
  );
}

/** Show a blank (`___` or `?`) as a boxed question mark, wherever it sits, even inside a fraction. */
export const blankToBox = (expr: string) => expr.replace(/_{2,}|\?/g, "\\boxed{\\;?\\;}");

/** Markdown for KaTeX: formats delimited math, and wraps bare math-only strings (e.g. an option "3/4") in $...$. */
export const mathMarkdown = (text: string) =>
  !text || text.includes("$") || isProse(text) ? formatMath(text) : `$${formatSpan(text)}$`;
