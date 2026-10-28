// Dev-only stand-in for the /api/playground routes (see knowledge_base/playground/API_SPEC.md).
// Backed by the hand-verified sample problems only, so the real problem bank never ships to the browser.
import type {
  PlaygroundAnswerType,
  PlaygroundCheckReason,
  PlaygroundCheckResult,
  PlaygroundDifficulty,
  PlaygroundReveal,
  PlaygroundSitting,
  PlaygroundSolutionStep,
  PlaygroundTopics,
} from "../api";
import type { PlaygroundClient } from "./client";
import mockProblems from "./mockProblems.json";

type MockProblem = {
  id: string;
  node_id: string;
  difficulty: PlaygroundDifficulty;
  style: "word" | "plain";
  prompt: string;
  answer_type: PlaygroundAnswerType;
  answer: string;
  accepted_variants: string[];
  required_form: string;
  unit: string | null;
  solution_steps: PlaygroundSolutionStep[];
};

const PROBLEMS = mockProblems as MockProblem[];
const DIFFICULTIES: PlaygroundDifficulty[] = ["easy", "medium", "hard"];

// Static mirror of backend/graph.py (labels, grades) and the four chains from ENTRY_NODES + get_chain().
const NODE_INFO: Record<string, { label: string; grade: number }> = {
  QE: { label: "Quadratic Equations", grade: 9 },
  FP: { label: "Factoring Polynomials", grade: 8 },
  SP: { label: "Special Products", grade: 7 },
  LE: { label: "Laws of Exponents", grade: 7 },
  OI: { label: "Operations on Integers", grade: 7 },
  FD: { label: "Fractions & Decimals", grade: 6 },
  SLE: { label: "Systems of Linear Equations", grade: 8 },
  L2V: { label: "Linear Equations in 2 Variables", grade: 8 },
  L1V: { label: "Linear Equations in 1 Variable", grade: 7 },
  AE: { label: "Algebraic Expressions", grade: 7 },
  RPP: { label: "Ratio, Proportion, Percent", grade: 6 },
  RER: { label: "Rational Exponents & Radicals", grade: 9 },
  PE: { label: "Polynomial Equations", grade: 10 },
  PO: { label: "Polynomial Operations", grade: 8 },
};
const CHAINS: { entry: string; nodes: string[] }[] = [
  { entry: "QE", nodes: ["QE", "FP", "SP", "LE", "OI", "FD"] },
  { entry: "SLE", nodes: ["SLE", "L2V", "L1V", "AE", "RPP", "FD"] },
  { entry: "RER", nodes: ["RER", "LE", "OI", "FD"] },
  { entry: "PE", nodes: ["PE", "PO"] },
];

const solved = new Set<string>(); // in memory only; resets on reload

function delay<T>(value: T): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), 120));
}

function shuffle<T>(items: T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function counts(nodeId: string, difficulty: PlaygroundDifficulty) {
  const group = PROBLEMS.filter((p) => p.node_id === nodeId && p.difficulty === difficulty);
  return { total: group.length, solved: group.filter((p) => solved.has(p.id)).length };
}

// ---- dev-only answer comparison (the real checker is backend/playground_checker) ----------

function normalize(latex: string): string {
  return latex
    .replace(/\$/g, "")
    .replace(/\\left|\\right|\\,|\\;|\\!|\\ /g, "")
    .replace(/\\dfrac|\\tfrac/g, "\\frac")
    .replace(/\\cdot|\\times/g, "*")
    .replace(/\\%|%/g, "")
    .replace(/\s+/g, "")
    .toLowerCase();
}

function numericValue(latex: string): number | null {
  const s = normalize(latex)
    .replace(/\\frac\{(-?[\d.]+)\}\{(-?[\d.]+)\}/g, "($1/$2)")
    .replace(/\\frac(\d)(\d)/g, "($1/$2)");
  if (!/^[-+*/().\d]+$/.test(s)) return null;
  try {
    const value = Function(`"use strict"; return (${s});`)() as number;
    return Number.isFinite(value) ? value : null;
  } catch {
    return null;
  }
}

function sameAnswer(
  sub: string,
  expected: string,
  type: PlaygroundAnswerType
): { equal: boolean; exact: boolean } {
  if (type === "solution_set") {
    const split = (v: string) => normalize(v).replace(/x=|\\\{|\\\}/g, "").split(",").filter(Boolean).sort();
    const a = split(sub);
    const b = split(expected);
    const equal = a.length === b.length && a.every((v, i) => v === b[i]);
    return { equal, exact: equal };
  }
  const exact = normalize(sub) === normalize(expected);
  if (exact) return { equal: true, exact: true };
  const a = numericValue(sub);
  const b = numericValue(expected);
  return { equal: a !== null && b !== null && Math.abs(a - b) < 1e-9, exact: false };
}

function checkOne(
  problem: MockProblem,
  answerLatex: string
): { correct: boolean; reason: PlaygroundCheckReason; message: string } {
  if (!normalize(answerLatex)) return { correct: false, reason: "empty", message: "Type your answer first." };
  for (const candidate of [problem.answer, ...problem.accepted_variants]) {
    const { equal, exact } = sameAnswer(answerLatex, candidate, problem.answer_type);
    if (equal && (exact || problem.required_form === "none")) {
      return { correct: true, reason: "correct", message: "Correct!" };
    }
    if (equal) {
      return {
        correct: false,
        reason: "wrong_form",
        message: "That's equal to the answer, but it isn't in the form the problem asks for yet.",
      };
    }
  }
  return { correct: false, reason: "not_equivalent", message: "Not quite. Try again." };
}

export const mockPlayground: PlaygroundClient = {
  getTopics(): Promise<PlaygroundTopics> {
    return delay({
      chains: CHAINS.map((chain) => ({
        entry_node_id: chain.entry,
        label: NODE_INFO[chain.entry].label,
        nodes: chain.nodes.map((nodeId) => ({
          node_id: nodeId,
          label: NODE_INFO[nodeId].label,
          grade: NODE_INFO[nodeId].grade,
          difficulties: {
            easy: counts(nodeId, "easy"),
            medium: counts(nodeId, "medium"),
            hard: counts(nodeId, "hard"),
          },
        })),
      })),
    });
  },

  getSitting(nodeId, difficulty): Promise<PlaygroundSitting> {
    if (!NODE_INFO[nodeId]) return Promise.reject(new Error("Unknown topic"));
    if (!DIFFICULTIES.includes(difficulty)) return Promise.reject(new Error("Bad difficulty"));
    const group = PROBLEMS.filter((p) => p.node_id === nodeId && p.difficulty === difficulty);
    return delay({
      node_id: nodeId,
      difficulty,
      problems: shuffle(group).map((p) => ({
        id: p.id,
        style: p.style,
        prompt: p.prompt,
        answer_type: p.answer_type,
        required_form: p.required_form,
        unit: p.unit,
        solved: solved.has(p.id),
      })),
    });
  },

  check(problemId, answerLatex): Promise<PlaygroundCheckResult> {
    const problem = PROBLEMS.find((p) => p.id === problemId);
    if (!problem) return Promise.reject(new Error("Unknown problem"));
    const result = checkOne(problem, answerLatex);
    if (result.correct) solved.add(problem.id);
    return delay({ ...result, solved: solved.has(problem.id) });
  },

  reveal(problemId): Promise<PlaygroundReveal> {
    const problem = PROBLEMS.find((p) => p.id === problemId);
    if (!problem) return Promise.reject(new Error("Unknown problem"));
    return delay({ answer: problem.answer, unit: problem.unit, solution_steps: problem.solution_steps });
  },
};
