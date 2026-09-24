import { NextResponse } from "next/server";
import { parse } from "mathjs";
import mathsteps from "mathsteps";

type SolverNode = { toString: () => string };
type SolverStep = {
  changeType: string;
  oldNode?: SolverNode | null;
  newNode?: SolverNode | null;
  substeps?: SolverStep[];
  subSteps?: SolverStep[];
};
type SerializedSolverStep = {
  changeType: string;
  oldNode: string | null;
  newNode: string | null;
  substeps: SerializedSolverStep[];
};

// Recursive helper to format steps and substeps into JSON-safe strings.
function formatStep(step: SolverStep): SerializedSolverStep {
  return {
    changeType: step.changeType,
    oldNode: step.oldNode ? step.oldNode.toString() : null,
    newNode: step.newNode ? step.newNode.toString() : null,
    // Recursively format nested sub-steps if they exist
    substeps: Array.isArray(step.substeps) 
      ? step.substeps.map(formatStep) 
      : Array.isArray(step.subSteps)
        ? step.subSteps.map(formatStep)
        : []
  };
}

// 2. In your POST API handler:
export async function POST(req: Request) {
  try {
    const { expression } = await req.json();
    if (typeof expression !== "string" || !expression.trim()) {
      return NextResponse.json({ error: "Enter a complete expression before solving." }, { status: 400 });
    }

    const normalizedExpression = expression.trim();
    // mathsteps intentionally returns an empty array when its parser rejects an
    // expression. Parse once first so a malformed expression receives helpful
    // feedback instead of looking like an already-simplified answer.
    parse(normalizedExpression);

    // Solve expression using the existing mathsteps engine.
    const steps = mathsteps.simplifyExpression(normalizedExpression);

    // Format all steps (and substeps) recursively before returning
    const formattedSteps = steps.map(formatStep);

    return NextResponse.json({ steps: formattedSteps });
  } catch (error: unknown) {
    // Keep parser details in server logs for debugging, but never send compiler-
    // style errors to a student-facing screen.
    console.error("Calculator expression could not be simplified.", error);
    return NextResponse.json({
      error: "We couldn't understand this expression. Check that your parentheses and operators are complete.",
    }, { status: 422 });
  }
}
