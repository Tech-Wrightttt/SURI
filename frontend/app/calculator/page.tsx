"use client";

import { ArrowDown, Calculator, CheckCircle2, ChevronRight, Loader2, RefreshCw, Sparkles } from "lucide-react";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import React from "react";
import "mathlive";
import MainPage from "@/components/mainpage";
import BackToTopButton from "@/components/navigation/BackToTopButton";
import { useWorldNavigation } from "@/components/navigation/LearningShell";

if (typeof customElements !== "undefined") {
  const MFE = customElements.get("math-field");
  if (MFE) (MFE as { fontsDirectory?: string }).fontsDirectory = "https://cdn.jsdelivr.net/npm/mathlive@0.109.2/fonts";
}

interface MathStep {
  changeType: string;
  oldNode: string | null;
  newNode: string | null;
  substeps?: MathStep[];
  subSteps?: MathStep[];
}

const SAMPLE_PROBLEMS = [
  { label: "Combine terms", expression: "2x + 3x" },
  { label: "Like powers", expression: "x^2 + 2x + x^2" },
  { label: "Simplify", expression: "4x - 2x + 6" },
  { label: "Polynomials", expression: "3x^2 + 2x^2 - x" },
];

const STEP_COPY: Record<string, { title: string; explanation: string }> = {
  SIMPLIFY_BASICS: {
    title: "Simplify the basics",
    explanation: "Use basic rules such as x⁰ = 1 and multiplying by 1 leaves a value unchanged.",
  },
  EVALUATE_ARITHMETIC: {
    title: "Calculate the numbers",
    explanation: "Work out the number part first. This does not change the variables in the expression.",
  },
  SIMPLIFY_ARITHMETIC: {
    title: "Calculate the numbers",
    explanation: "Combine the numbers that can be evaluated to make the expression simpler.",
  },
  GROUP_LIKE_TERMS: {
    title: "Identify like terms",
    explanation: "Terms with the same variable and exponent are like terms, so they can be grouped together.",
  },
  COLLECT_LIKE_TERMS: {
    title: "Identify like terms",
    explanation: "Terms with matching variable parts belong together. Grouping them prepares us to combine them.",
  },
  COLLECT_AND_COMBINE_LIKE_TERMS: {
    title: "Combine like terms",
    explanation: "Add or subtract the coefficients of terms with the same variable and exponent.",
  },
  ADD_POLYNOMIAL_TERMS: {
    title: "Combine like terms",
    explanation: "The matching terms have the same variable part, so their coefficients can be added.",
  },
  ADD_COEFFICIENTS: {
    title: "Add the coefficients",
    explanation: "Add the numbers in front while keeping the shared variable part the same.",
  },
  ADD_COEFFICIENT_OF_ONE: {
    title: "Show the hidden coefficient",
    explanation: "A variable written by itself has a coefficient of 1. Showing it makes the addition clear.",
  },
  GROUP_COEFFICIENTS: {
    title: "Group the coefficients",
    explanation: "Factor out the shared variable so the numbers that need to be combined are easy to see.",
  },
  SUBTRACT_COEFFICIENTS: {
    title: "Subtract the coefficients",
    explanation: "Subtract the numbers in front while keeping the matching variable part unchanged.",
  },
  MULTIPLY_COEFFICIENTS: {
    title: "Multiply the coefficients",
    explanation: "Multiply the numerical factors, then keep the variable factors with the product.",
  },
  DISTRIBUTE: {
    title: "Distribute through the parentheses",
    explanation: "Multiply the outside term by every term inside the parentheses.",
  },
  EXPAND_EXPRESSION: {
    title: "Expand the expression",
    explanation: "Multiply the factors so the expression is written as a sum of terms.",
  },
  REMOVE_PARENTHESES: {
    title: "Remove the parentheses",
    explanation: "Apply the sign outside the parentheses to every term inside before removing the brackets.",
  },
  FACTOR_QUADRATIC: {
    title: "Factor the quadratic",
    explanation: "Rewrite the quadratic as factors that multiply back to the original expression.",
  },
  FACTOR_COMMON: {
    title: "Factor out a common term",
    explanation: "Take out the factor shared by every term. Multiplying it back gives the original expression.",
  },
  CANCEL_TERMS: {
    title: "Cancel matching terms",
    explanation: "Opposite terms add to zero, so removing them keeps the expression equal.",
  },
};

function getSubsteps(step: MathStep): MathStep[] {
  if (Array.isArray(step.substeps)) return step.substeps;
  if (Array.isArray(step.subSteps)) return step.subSteps;
  return [];
}

function flattenMathSteps(steps: MathStep[]): MathStep[] {
  const result: MathStep[] = [];
  const addStep = (step: MathStep) => {
    const substeps = getSubsteps(step);
    if (substeps.length > 0) substeps.forEach(addStep);
    else result.push(step);
  };
  steps.forEach(addStep);
  return result;
}

function getStepCopy(changeType: string) {
  return STEP_COPY[changeType.toUpperCase()] ?? {
    title: "Simplify the expression",
    explanation: "Make this part of the expression simpler while keeping its value the same.",
  };
}

function isWrappedInParentheses(value: string) {
  if (!value.startsWith("(") || !value.endsWith(")")) return false;
  let depth = 0;
  for (let index = 0; index < value.length; index += 1) {
    if (value[index] === "(") depth += 1;
    if (value[index] === ")") depth -= 1;
    if (depth === 0 && index < value.length - 1) return false;
  }
  return depth === 0;
}

function stripRedundantGrouping(value: string) {
  let formatted = value.trim();
  while (isWrappedInParentheses(formatted)) formatted = formatted.slice(1, -1).trim();

  let previous = "";
  while (formatted !== previous) {
    previous = formatted;
    formatted = formatted.replace(/\(\s*([^()]+?)\s*\)/g, (whole, inner: string, offset: number, full: string) => {
      const before = full.slice(0, offset).trimEnd().at(-1);
      const after = full.slice(offset + whole.length).trimStart().at(0);
      const isAdditiveGroup = (!before || before === "+" || before === "-") && (!after || after === "+" || after === "-");
      return isAdditiveGroup ? inner : whole;
    });
    while (isWrappedInParentheses(formatted)) formatted = formatted.slice(1, -1).trim();
  }
  return formatted;
}

function formatStudentMath(value: string) {
  return stripRedundantGrouping(value)
    .replace(/\s*\^\s*/g, "^")
    .replace(/\+\s*-/g, "- ")
    .replace(/-\s*-/g, "+ ")
    .replace(/\s+/g, " ")
    .trim();
}

function getStudentError(message: string) {
  const normalized = message.toLowerCase();
  if (normalized.includes("parenth") || normalized.includes("token") || normalized.includes("parse") || normalized.includes("understand")) {
    return "Check that every parenthesis is closed and each mathematical operation is complete.";
  }
  if (normalized.includes("expression") || normalized.includes("empty")) {
    return "Enter a complete expression, then try solving it again.";
  }
  return "Try checking the expression and solving it again. You can also start with one of the examples below.";
}

type MathFieldProps = {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  onEnter?: () => void;
};

type MathFieldElement = HTMLElement & {
  value: string;
  getValue: (format: "ascii-math") => string;
  focus: () => void;
};

function MathField({ value, onChange, disabled = false, onEnter }: MathFieldProps) {
  const mathFieldRef = useRef<MathFieldElement | null>(null);

  useEffect(() => {
    const mathField = mathFieldRef.current;
    if (!mathField || mathField.getValue("ascii-math") === value) return;
    mathField.value = value;
  }, [value]);

  useEffect(() => {
    const mathField = mathFieldRef.current;
    if (!mathField) return;
    const handleInput = () => onChange(mathField.getValue("ascii-math"));
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      event.stopPropagation();
      onEnter?.();
    };
    mathField.addEventListener("input", handleInput);
    mathField.addEventListener("keydown", handleKeyDown);
    return () => {
      mathField.removeEventListener("input", handleInput);
      mathField.removeEventListener("keydown", handleKeyDown);
    };
  }, [onChange, onEnter]);

  useEffect(() => {
    if (disabled || !mathFieldRef.current) return;
    const focusTimer = window.setTimeout(() => mathFieldRef.current?.focus(), 100);
    return () => window.clearTimeout(focusTimer);
  }, [disabled]);

  return React.createElement("math-field", {
    ref: mathFieldRef,
    className: "calculator-math-field",
    disabled,
    suppressHydrationWarning: true,
    "aria-label": "Mathematical expression",
    placeholder: "For  example, x^2 + 2x + x^2",
    "virtual-keyboard-mode": "onfocus",
    "virtual-keyboards": "all",
  });
}

function MathDisplay({ value, className = "" }: { value: string; className?: string }) {
  return React.createElement("math-div", {
    className: `calculator-math-display ${className}`,
    format: "ascii-math",
    suppressHydrationWarning: true,
  }, formatStudentMath(value));
}

function MathInline({ value }: { value: string }) {
  return React.createElement("math-span", {
    className: "calculator-math-inline",
    format: "ascii-math",
    suppressHydrationWarning: true,
  }, formatStudentMath(value));
}

export default function AlgebraCalculatorPage() {
  const { navigate } = useWorldNavigation();
  const [expression, setExpression] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [steps, setSteps] = useState<MathStep[]>([]);
  const [solvedExpression, setSolvedExpression] = useState("");
  const [hasResult, setHasResult] = useState(false);

  const finalExpression = steps.at(-1)?.newNode ?? solvedExpression;

  async function handleSolve(nextExpression?: string) {
    const target = (nextExpression ?? expression).trim();
    if (!target || loading) return;

    setLoading(true);
    setError(null);
    setSteps([]);
    setSolvedExpression(target);
    setHasResult(false);

    try {
      const response = await fetch("/api/solve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expression: target }),
      });
      const data = await response.json();

      if (!response.ok || data.error) {
        setError(getStudentError(data.error ?? ""));
        return;
      }

      const detailedSteps = Array.isArray(data.steps) ? flattenMathSteps(data.steps) : [];
      setSteps(detailedSteps);
      setHasResult(true);
    } catch {
      setError("We couldn't reach the solver right now. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  function handleReset() {
    setExpression("");
    setSteps([]);
    setError(null);
    setSolvedExpression("");
    setHasResult(false);
  }

  return <MainPage immersive>
    <div className="calculator-route-page">
      <header className="calculator-route-header">
        <button type="button" className="calculator-route-back" onClick={() => navigate("/dashboard")} aria-label="Go back to the previous page"><span aria-hidden="true">←</span> Go back</button>
        <div className="calculator-route-kicker"><span /> THE SURI ACADEMY WORKSHOP <span /></div>
        <h1>Algebra <em>Workshop</em></h1>
        <p>Write an expression, then follow each small change until the answer is clear.</p>
      </header>

      <section className="calculator-route-collection calculator-input-card" aria-labelledby="calculator-input-heading">
        <div className="calculator-section-heading">
          <span className="calculator-section-icon"><Calculator size={20} aria-hidden="true" /></span>
          <div><small>START HERE</small><h2 id="calculator-input-heading">What would you like to simplify?</h2></div>
        </div>
        <div className="calculator-input-row">
          <MathField value={expression} disabled={loading} onChange={setExpression} onEnter={() => handleSolve()} />
          <button type="button" className="calculator-reset-button" onClick={handleReset} disabled={loading || (!expression && !hasResult && !error)}>
            <RefreshCw size={16} aria-hidden="true" />
            Reset
          </button>
          <button type="button" className="calculator-solve-button" onClick={() => handleSolve()} disabled={loading || !expression.trim()}>
            {loading ? <Loader2 size={17} className="animate-spin" /> : <ChevronRight size={18} />}
            {loading ? "Solving…" : "Show steps"}
          </button>
        </div>
        <div className="calculator-input-footer">
          <p>Use the math keyboard for powers, roots, fractions, and parentheses. Press Enter to solve.</p>
          <div className="calculator-samples" aria-label="Example expressions">
            {SAMPLE_PROBLEMS.map(problem => <button key={problem.expression} type="button" disabled={loading} onClick={() => { setExpression(problem.expression); void handleSolve(problem.expression); }}>
              <span>{problem.label}</span><MathInline value={problem.expression} />
            </button>)}
          </div>
        </div>
      </section>

      {error && <section className="calculator-route-error" role="alert">
        <Image src="/suri-snake-sad.png" alt="Sad Suri" width={45} height={45} />
        <div><strong>We couldn&apos;t understand that expression.</strong><p>{error}</p></div>
      </section>}

      {!hasResult && !error && !loading && <section className="calculator-route-collection calculator-empty-state" aria-live="polite">
        <span className="calculator-empty-icon"><Sparkles size={22} aria-hidden="true" /></span>
        <div><b>Your working will appear here.</b><p>Enter an expression above to see the solution and a step-by-step explanation.</p></div>
      </section>}

      {hasResult && <div className="calculator-results" aria-live="polite">
        <section className="calculator-route-collection calculator-result-overview" aria-labelledby="calculator-result-heading">
          <div className="calculator-result-copy"><small>YOUR EXPRESSION</small><h2 id="calculator-result-heading">Here is the path through your problem.</h2><p>{steps.length > 0 ? `${steps.length} clear ${steps.length === 1 ? "step" : "steps"} will take you to the simplified expression.` : "This expression is already in its simplest form."}</p></div>
          <div className="calculator-problem-math"><span>Start with</span><MathDisplay value={solvedExpression} /></div>
        </section>

        {steps.length > 0 && <section className="calculator-route-collection calculator-solution-section" aria-labelledby="calculator-steps-heading">
          <div className="calculator-collection-title"><span>✦</span><div><small>FOLLOW THE CHANGE</small><h2 id="calculator-steps-heading">Step-by-step solution</h2></div><span>✦</span></div>
          <ol className="calculator-solution-list">
            {steps.map((step, index) => {
              const copy = getStepCopy(step.changeType);
              const before = step.oldNode ?? (index === 0 ? solvedExpression : steps[index - 1].newNode ?? solvedExpression);
              const after = step.newNode ?? before;
              return <li key={`${step.changeType}-${index}`} className="calculator-solution-step" style={{ "--step-delay": `${Math.min(index * 70, 350)}ms` } as React.CSSProperties}>
                <span className="calculator-step-marker" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
                <article className="calculator-step-card">
                  <header><small>STEP {String(index + 1).padStart(2, "0")}</small><h3>{copy.title}</h3></header>
                  <div className="calculator-transformation">
                    <div className="calculator-expression-panel"><span>Before</span><MathDisplay value={before} /></div>
                    <ArrowDown className="calculator-arrow" size={24} aria-hidden="true" />
                    <div className="calculator-expression-panel calculator-expression-after"><span>Now</span><MathDisplay value={after} /></div>
                  </div>
                  <div className="calculator-step-explanation"><Image src="/suri-snake-happy.png" alt="" width={36} height={36} /><div><b>Why this works</b><p>{copy.explanation}</p></div></div>
                </article>
              </li>;
            })}
          </ol>
        </section>}

        <section className="calculator-final-answer" aria-labelledby="calculator-final-answer-heading">
          <div className="calculator-final-badge"><CheckCircle2 size={19} aria-hidden="true" /><span>COMPLETE</span></div>
          <div className="calculator-final-answer-copy"><small id="calculator-final-answer-heading">FINAL ANSWER</small><MathDisplay value={finalExpression} className="calculator-final-math" /></div>
        </section>
      </div>}
      <div className="calculator-route-top">
        <BackToTopButton className="calculator-route-back" />
      </div>
    </div>
  </MainPage>;
}
