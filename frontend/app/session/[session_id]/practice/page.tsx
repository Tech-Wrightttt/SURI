"use client";
import "mathlive";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { 
  getSession, 
  startPractice, 
  submitPracticeStep, 
  PracticeProblem, 
  PracticeSubmitStepResponse,
} from "../../../../lib/api";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import React from "react";
import confetti from "canvas-confetti";
import { 
  Flame, 
  ShieldAlert, 
  Sparkles, 
  ArrowRight, 
  BookOpen, 
} from "lucide-react";

type MathFieldProps = {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
};

type MathFieldElement = HTMLElement & {
  value: string;
};

function MathField({
  value,
  onChange,
  disabled = false,
}: MathFieldProps) {
  const mathFieldRef = useRef<MathFieldElement | null>(null);

  useEffect(() => {
    if (mathFieldRef.current && mathFieldRef.current.value !== value) {
      mathFieldRef.current.value = value;
    }
  }, [value]);

  useEffect(() => {
    const mf = mathFieldRef.current;

    if (!mf) return;

    const handleInput = () => {
      onChange(mf.value);
    };

    mf.addEventListener("input", handleInput);

    return () => {
      mf.removeEventListener("input", handleInput);
    };
  }, [onChange]);

  return React.createElement("math-field", {
    ref: mathFieldRef,
    disabled,
    "virtual-keyboard-mode": "onfocus",
    style: {
      width: "100%",
      minWidth: "180px",
      minHeight: "48px",
      padding: "10px 14px",
      border: "3px solid #6d411c",
      borderRadius: "8px",
      background: "linear-gradient(180deg, #fff4ca, #e7c67d)",
      fontSize: "0.95rem",
      fontWeight: "bold",
      boxShadow: "0 5px 0 #28150c, inset 0 0 0 2px rgba(255,255,255,0.24)",
      outline: "none",
    },
  });
}

const PRACTICE_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Bree+Serif&family=Nunito:wght@400;600;700;800;900&display=swap');

  .practice-forge {
    min-height: 100vh;
    padding: clamp(10px, 1.5vw, 18px);
    background:
      radial-gradient(circle at 50% 0%, rgba(250,204,96,0.18), transparent 28%),
      linear-gradient(135deg, #1b0e12 0%, #392016 42%, #151025 100%);
    color: #fff4d5;
    font-family: Georgia, 'Times New Roman', serif;
    position: relative;
    overflow-x: hidden;
  }
  .practice-forge::before {
    content: "";
    position: fixed;
    inset: 8px;
    z-index: 0;
    pointer-events: none;
    background: rgba(0,0,0,0.36);
  }
  .practice-forge::after {
    content: "";
    position: fixed;
    inset: 0;
    z-index: 0;
    pointer-events: none;
    background:
      radial-gradient(circle at 16% 22%, rgba(255,211,92,0.12), transparent 24%),
      radial-gradient(circle at 84% 18%, rgba(155,67,207,0.16), transparent 26%),
      url('/login/arena.png') center bottom / cover no-repeat;
    opacity: .38;
    mix-blend-mode: screen;
  }
  .forge-shell {
    position: relative;
    z-index: 1;
    width: min(1180px, 100%);
    margin: 0 auto;
  }
  .forge-hud {
    position: relative;
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 18px;
    align-items: center;
    min-height: 120px;
    margin-bottom: 18px;
    padding: 18px clamp(16px, 3vw, 34px);
    border-radius: 0 0 26px 26px;
    background:
      linear-gradient(90deg, #70411f 0 16px, transparent 16px calc(100% - 16px), #70411f calc(100% - 16px)),
      linear-gradient(180deg, #8b5527 0 14px, transparent 14px calc(100% - 14px), #8b5527 calc(100% - 14px)),
      linear-gradient(180deg, rgba(252,229,177,0.97), rgba(235,189,105,0.97));
    box-shadow: 0 12px 0 rgba(39,18,10,0.84), 0 24px 42px rgba(0,0,0,0.38), inset 0 0 0 4px #3b1d13, inset 0 0 0 10px rgba(255,198,92,0.18);
  }
  .forge-hud::before {
    content: "";
    position: absolute;
    inset: 13px;
    border: 2px solid rgba(111,61,28,0.18);
    border-radius: 0 0 18px 18px;
    pointer-events: none;
  }
  .forge-title-block {
    position: relative;
    z-index: 1;
    display: flex;
    align-items: center;
    gap: 16px;
    min-width: 0;
  }
  .forge-suri {
    height: 74px;
    width: auto;
    object-fit: contain;
    filter: drop-shadow(3px 0 0 #17100a) drop-shadow(-3px 0 0 #17100a) drop-shadow(0 10px 18px rgba(76,194,117,0.44));
  }
  .forge-eyebrow {
    display: block;
    color: #6c278e;
    font-family: 'Nunito', sans-serif;
    font-size: 11px;
    font-weight: 900;
    letter-spacing: 1.8px;
    text-transform: uppercase;
  }
  .forge-title {
    color: #3a2111;
    font-family: "Bree Serif", Georgia, serif;
    font-size: clamp(28px, 4vw, 46px);
    font-weight: 900;
    line-height: 1;
    text-shadow: 0 2px 0 rgba(255,255,255,0.45);
  }
  .forge-subtitle {
    margin-top: 6px;
    color: #4e3477;
    font-family: 'Nunito', sans-serif;
    font-size: 13px;
    font-weight: 900;
    text-transform: uppercase;
    letter-spacing: .8px;
  }
  .forge-exit {
    position: relative;
    z-index: 1;
    min-height: 46px;
    padding: 0 20px;
    border: 3px solid #6d411c;
    border-radius: 8px;
    background: linear-gradient(180deg,#fff6aa,#ffd35c 58%,#c7832e);
    color: #321008;
    font-family: "Bree Serif", Georgia, serif;
    font-size: 16px;
    font-weight: 900;
    box-shadow: 0 5px 0 rgba(72,34,16,0.72);
    transition: transform .12s ease, filter .12s ease;
  }
  .forge-exit:hover { transform: translateY(-2px); filter: brightness(1.04); }
  .forge-grid {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(270px, 330px);
    gap: 16px;
    align-items: start;
  }
  .forge-card {
    position: relative;   /* add */
    z-index: 1;   
    border: 5px solid #5e3619;
    background: linear-gradient(90deg, rgba(25,12,8,0.92), rgba(83,46,24,0.94), rgba(25,12,8,0.92)), repeating-linear-gradient(90deg, rgba(255,255,255,0.035) 0 2px, transparent 2px 66px);
    box-shadow: 0 9px 0 #160b07, inset 0 0 0 3px rgba(245,199,93,0.28);
    padding: 14px;
  }
  .forge-panel {
    border: 3px solid #8e5b20;
    border-radius: 0;
    background: linear-gradient(180deg, #57321d, #24130d);
    box-shadow: inset 0 0 0 3px rgba(20,9,5,0.55), inset 0 1px 0 rgba(255,255,255,0.12);
    padding: clamp(14px, 2vw, 20px);
  }
  .forge-panel + .forge-panel { margin-top: 14px; }
  .forge-panel-title {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    margin-bottom: 10px;
    color: #ffe8a2;
    font-family: 'Nunito', sans-serif;
    font-size: 12px;
    font-weight: 900;
    letter-spacing: 1.3px;
    text-transform: uppercase;
  }
  .forge-scroll {
    border: 2px solid #9c672b;
    background: radial-gradient(circle at 18% 12%, rgba(255,255,255,0.32), transparent 26%), linear-gradient(180deg, #fff0bf, #dec07b);
    color: #2b170d;
    box-shadow: inset 0 0 0 2px rgba(89,48,18,0.14);
    padding: clamp(14px, 2vw, 22px);
  }
  .forge-expression {
    display: flex;
    justify-content: center;
    color: #28150c;
    font-family: Georgia, 'Times New Roman', serif;
    font-size: clamp(22px, 3vw, 34px);
    font-weight: 900;
  }
  .rune-board {
    position: sticky;
    top: 16px;
    border: 5px solid #5e3619;
    background: linear-gradient(180deg, rgba(38,15,54,.96), rgba(25,12,8,.96));
    box-shadow: 0 9px 0 #160b07, inset 0 0 0 3px rgba(245,199,93,0.24);
    padding: 16px;
  }
  .rune-circle {
    position: relative;
    min-height: 310px;
    display: grid;
    place-items: center;
    border: 2px solid rgba(255,226,136,0.35);
    background: radial-gradient(circle at 50% 50%, rgba(155,67,207,0.24), transparent 52%), rgba(26,8,12,0.72);
    overflow: hidden;
  }
  .rune-circle::before {
    content: "";
    position: absolute;
    width: 210px;
    height: 210px;
    border: 2px dashed rgba(255,226,136,0.45);
    border-radius: 50%;
    box-shadow: 0 0 26px rgba(155,67,207,0.24);
  }
  .rune-core {
    position: relative;
    z-index: 1;
    width: 116px;
    height: 116px;
    display: grid;
    place-items: center;
    border-radius: 50%;
    border: 3px solid #8749b7;
    background: radial-gradient(circle at 35% 25%, #fff6aa, #ffd35c 42%, #7f2cad);
    box-shadow: 0 0 24px rgba(255,211,92,0.45), inset 0 0 0 5px rgba(50,16,77,0.2);
    color: #32104d;
  }
  .rune-node {
    position: absolute;
    z-index: 2;
    width: 48px;
    height: 48px;
    display: grid;
    place-items: center;
    border: 3px solid #725131;
    border-radius: 12px;
    background: linear-gradient(180deg, #69574a, #33271f);
    color: #fff6dc;
    box-shadow: 0 5px 0 #1b0f0a, inset 0 1px 0 rgba(255,255,255,0.18);
    transform: translate(-50%, -50%);
    font-family: "Bree Serif", Georgia, serif;
    font-size: 18px;
  }
  .rune-node.is-lit {
    border-color: #ffe288;
    background: linear-gradient(180deg,#9df2a7 0%,#31a85e 55%,#176235 100%);
    color: #071d0f;
    box-shadow: 0 5px 0 #12361e, 0 0 24px rgba(88,255,138,0.36);
  }
  .rune-node.is-cracked {
    border-color: #ff8e7c;
    background: linear-gradient(180deg, #7b2630, #351017);
    color: #ffd9d4;
    animation: runeFlicker .9s ease-in-out infinite;
  }
  @keyframes runeFlicker {
    0%, 100% { filter: brightness(1); transform: translate(-50%, -50%) rotate(0); }
    45% { filter: brightness(1.45); transform: translate(-50%, -50%) rotate(-2deg); }
    70% { filter: brightness(.75); transform: translate(-50%, -50%) rotate(2deg); }
  }
  .rune-copy {
    margin-top: 13px;
    color: #f7dfad;
    font-family: 'Nunito', sans-serif;
    font-size: 13px;
    font-weight: 800;
    line-height: 1.45;
  }
  .step-card {
    position: relative;
    display: grid;
    grid-template-columns: 54px minmax(0, 1fr);
    gap: 14px;
    margin-top: 14px;
    border: 3px solid #8e5b20;
    background: linear-gradient(180deg, #57321d, #24130d);
    box-shadow: 0 6px 0 #160b07, inset 0 0 0 3px rgba(20,9,5,0.55), inset 0 1px 0 rgba(255,255,255,0.12);
    padding: 14px;
  }
  .step-card.is-correct { border-color: #ffe288; }
  .step-card.is-wrong { border-color: #ff8e7c; }
  .step-rune {
    width: 48px;
    height: 48px;
    display: grid;
    place-items: center;
    border: 3px solid #725131;
    border-radius: 12px;
    background: linear-gradient(180deg, #69574a, #33271f);
    color: #fff6dc;
    box-shadow: 0 5px 0 #1b0f0a;
    font-family: "Bree Serif", Georgia, serif;
    font-size: 20px;
  }
  .step-card.is-correct .step-rune {
    border-color: #ffe288;
    background: linear-gradient(180deg,#9df2a7 0%,#31a85e 55%,#176235 100%);
    color: #071d0f;
    box-shadow: 0 5px 0 #12361e, 0 0 24px rgba(88,255,138,0.33);
  }
  .step-card.is-wrong .step-rune {
    border-color: #ff8e7c;
    background: linear-gradient(180deg, #7b2630, #351017);
    color: #ffd9d4;
    animation: runeFlicker .9s ease-in-out infinite;
  }
  .step-header {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    padding-bottom: 10px;
    border-bottom: 2px solid rgba(255,226,136,0.18);
  }
  .step-title {
    color: #ffe8a2;
    font-family: 'Nunito', sans-serif;
    font-size: 13px;
    font-weight: 900;
    letter-spacing: 1px;
    text-transform: uppercase;
  }
  .forge-badge {
    display: inline-flex;
    align-items: center;
    min-height: 28px;
    padding: 5px 9px;
    border: 2px solid #6d411c;
    border-radius: 7px;
    background: linear-gradient(180deg,#fff6aa,#ffd35c 58%,#c7832e);
    color: #321008;
    font-family: 'Nunito', sans-serif;
    font-size: 10px;
    font-weight: 900;
    text-transform: uppercase;
  }
  .step-instruction {
    margin-top: 12px;
    color: #fff6dc;
    font-family: 'Nunito', sans-serif;
    font-size: clamp(14px, 1.25vw, 16px);
    font-weight: 900;
    line-height: 1.55;
  }
  .rune-input-row {
    margin-top: 12px;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    border: 2px solid #9c672b;
    background: radial-gradient(circle at 18% 12%, rgba(255,255,255,0.26), transparent 26%), linear-gradient(180deg, #fff0bf, #dec07b);
    color: #28150c;
    box-shadow: inset 0 0 0 2px rgba(89,48,18,0.14);
    padding: 12px;
  }
  .rune-text-input {
    width: min(260px, 100%);
    min-height: 48px;
    border: 3px solid #6d411c;
    border-radius: 8px;
    background: linear-gradient(180deg, #fff4ca, #e7c67d);
    padding: 10px 14px;
    color: #28150c;
    font-family: 'Nunito', sans-serif;
    font-weight: 900;
    text-align: center;
    box-shadow: 0 5px 0 #28150c, inset 0 0 0 2px rgba(255,255,255,0.24);
    outline: none;
  }
  .submitted-value {
    display: inline-flex;
    align-items: center;
    min-height: 38px;
    padding: 5px 10px;
    border: 2px solid #6d411c;
    border-radius: 8px;
    font-weight: 900;
  }
  .submitted-value.is-correct { color: #08351a; background: #dff5c8; }
  .submitted-value.is-wrong { color: #87221f; background: #ffd9d4; }
  .feedback-rune {
    margin-top: 12px;
    border-left: 5px solid #ff8e7c;
    background: rgba(34,10,16,0.72);
    border-top: 2px solid rgba(255,216,116,0.45);
    border-right: 2px solid rgba(255,216,116,0.45);
    border-bottom: 2px solid rgba(255,216,116,0.45);
    color: #f7dfad;
    padding: 13px;
    font-family: 'Nunito', sans-serif;
    font-size: 13px;
    font-weight: 800;
  }
  .forge-action {
    width: 100%;
    min-height: 62px;
    border: 3px solid #6d411c;
    border-radius: 8px;
    background: linear-gradient(180deg,#9df2a7 0%,#31a85e 55%,#176235 100%);
    color: #071d0f;
    font-family: "Bree Serif", Georgia, serif;
    font-size: clamp(18px, 2vw, 24px);
    font-weight: 900;
    box-shadow: 0 7px 0 #12361e, 0 0 28px rgba(88,255,138,0.25), inset 0 1px 0 rgba(255,255,255,0.42);
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    transition: transform .12s ease, filter .12s ease;
  }
  .forge-action:hover:not(:disabled) { transform: translateY(-2px); filter: brightness(1.08); }
  .forge-action:disabled {
    cursor: not-allowed;
    color: rgba(255,246,220,0.38);
    background: linear-gradient(180deg, #69574a, #33271f);
    box-shadow: none;
  }
  .forge-action.secondary {
    background: linear-gradient(180deg,#ffe596,#b8792d);
    color: #2a160d;
    box-shadow: 0 6px 0 #28150c, inset 0 1px 0 rgba(255,255,255,0.35);
  }
  .completion-card {
    width: min(760px, 100%);
    margin: 0 auto;
    text-align: center;
  }
  .completion-rune {
    width: 128px;
    height: 128px;
    margin: 0 auto 18px;
    display: grid;
    place-items: center;
    border-radius: 50%;
    border: 4px solid #8749b7;
    background: radial-gradient(circle at 35% 25%, #fff6aa, #ffd35c 42%, #7f2cad);
    box-shadow: 0 0 38px rgba(255,211,92,0.62), 0 0 48px rgba(155,67,207,0.42);
    color: #32104d;
    animation: completePulse 1.3s ease-in-out infinite;
  }
  @keyframes completePulse {
    0%,100% { transform: scale(1); }
    50% { transform: scale(1.05); }
  }
  .summary-row {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    padding: 12px;
    border: 2px solid #8749b7;
    background: rgba(255,255,255,.58);
    color: #3b1766;
    font-family: 'Nunito', sans-serif;
    font-weight: 900;
  }
  .markdown-content p { margin: 0; }
  .markdown-content .katex {
    font-weight: 900 !important;
    color: inherit !important;
  }
  .markdown-content .katex-display { margin: .8rem 0 !important; }
  @media (max-width: 900px) {
    .forge-hud, .forge-grid { grid-template-columns: 1fr; }
    .rune-board { position: relative; top: auto; }
  }
  @media (max-width: 640px) {
    .practice-forge { padding: 8px; }
    .forge-hud { padding: 16px 12px; }
    .forge-title-block { align-items: flex-start; }
    .forge-suri { height: 58px; }
    .step-card { grid-template-columns: 1fr; }
    .step-rune { width: 44px; height: 44px; }
  }
`;

function ForgeRuneIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <path d="M32 5 50 15v20L32 59 14 35V15L32 5Z" fill="currentColor" opacity=".18" />
      <path d="M32 5 50 15v20L32 59 14 35V15L32 5Z" fill="none" stroke="currentColor" strokeWidth="4" strokeLinejoin="round" />
      <path d="M32 15v34M22 24h20L24 42h18" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function PracticePage() {
  const router = useRouter();
  const params = useParams();
  const sessionId = params.session_id as string;

  const [loading, setLoading] = useState<boolean>(true);
  const [loadingText, setLoadingText] = useState<string>("Loading practice problems...");
  const [nodeId, setNodeId] = useState<string>("");
  const [problems, setProblems] = useState<PracticeProblem[]>([]);
  const [currentProblemIdx, setCurrentProblemIdx] = useState<number>(0);
  
  // Inputs for current problem: step_index -> student value
  const [inputs, setInputs] = useState<Record<number, string>>({});
  
  // Results of submitted problems
  const [submittedResults, setSubmittedResults] = useState<Record<number, PracticeSubmitStepResponse>>({});
  const [problemCompleted, setProblemCompleted] = useState<boolean>(false);
  
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Load the session and practice set
  const loadPracticeData = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    setLoadingText("Loading practice problems...");

    try {
      const session = await getSession(sessionId);
      const currentNode = session.current_node;
      setNodeId(currentNode);

      const practiceData = await startPractice({
        session_id: sessionId,
        node_id: currentNode,
      });

      setProblems(practiceData.problems);
      setLoading(false);
    } catch (err: unknown) {
      console.error(err);
      const message = err instanceof Error ? err.message : "Failed to load practice problems. Please try again.";
      setErrorMsg(message);
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    if (sessionId) {
      void Promise.resolve().then(loadPracticeData);
    }
  }, [sessionId, loadPracticeData]);

  // Handle value change for step inputs
  const handleInputChange = (stepIdx: number, val: string) => {
    setInputs(prev => ({
      ...prev,
      [stepIdx]: val
    }));
  };

  const currentProblem = problems[currentProblemIdx];
  const allInputsFilled = currentProblem 
    ? currentProblem.steps.every(step => (inputs[step.step_index] || "").trim() !== "")
    : false;

  const handleSubmitProblem = async () => {
    if (!currentProblem || !allInputsFilled || isSubmitting) return;

    setIsSubmitting(true);
    setErrorMsg(null);

    const submissionPayload = currentProblem.steps.map(step => ({
      step_index: step.step_index,
      submitted_value: (inputs[step.step_index] || "").trim()
    }));

    try {
      const response = await submitPracticeStep({
        session_id: sessionId,
        node_id: nodeId,
        problem_id: currentProblem.id,
        student_steps: submissionPayload
      });

      setSubmittedResults(prev => ({
        ...prev,
        [currentProblemIdx]: response
      }));
      setProblemCompleted(true);

      // Instantly celebrate a perfectly completed problem [2]
      const allCorrect = response.step_results.every(r => r.correct);
      if (allCorrect) {
        confetti({ particleCount: 100, spread: 80, origin: { y: 0.75 } });
      }
    } catch (err: unknown) {
      console.error(err);
      const message = err instanceof Error ? err.message : "Failed to submit answers. Please try again.";
      setErrorMsg(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleNextProblem = () => {
    setInputs({});
    setProblemCompleted(false);
    setCurrentProblemIdx(prev => prev + 1);
  };

  const handleGetResults = () => {
    router.push(`/session/${sessionId}/results`);
  };

  const handleBackToTopics = () => {
    router.push(`/session/${sessionId}/lesson`);
  };

  const cleanMathExpr = (expr: string) => {
    return expr.replace(/(\d)\s*\*\s*([a-zA-Z])/g, '$1$2').replace(/([a-zA-Z])\s*\*\s*([a-zA-Z])/g, '$1$2');
  };

  if (loading) {
    return (
      <div className="practice-forge flex flex-col items-center justify-center">
        <style dangerouslySetInnerHTML={{ __html: PRACTICE_CSS }} />
        <div className="forge-card max-w-sm w-full text-center">
          <div className="forge-panel">
          <div className="relative w-12 h-12 mx-auto mb-4">
            <div className="absolute inset-0 border-4 border-[#6d411c] rounded-full" />
            <div className="absolute inset-0 border-4 border-[#ffe288] border-t-[#8749b7] rounded-full animate-spin" />
          </div>
          <p className="forge-panel-title justify-center w-full animate-pulse">{loadingText}</p>
          <p className="rune-copy">Suri is heating the forge and laying out the counter-runes.</p>
          </div>
        </div>
      </div>
    );
  }

  if (errorMsg && problems.length === 0) {
    return (
      <div className="practice-forge flex flex-col justify-center items-center">
        <style dangerouslySetInnerHTML={{ __html: PRACTICE_CSS }} />
        <div className="forge-card w-full max-w-xl text-center">
          <div className="forge-panel">
          <span className="forge-badge">Rune Forge Fault</span>
          <h2 className="forge-title mt-4 mb-2">Error</h2>
          <p className="feedback-rune break-all text-left">[FAULT_LOG] {errorMsg}</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center mt-6">
            <button
              onClick={loadPracticeData}
              className="forge-action secondary"
            >
              Rekindle Forge
            </button>
            <button
              onClick={handleBackToTopics}
              className="forge-action"
            >
              Back to Lesson
            </button>
          </div>
          </div>
        </div>
      </div>
    );
  }

  const isPracticeOver = currentProblemIdx >= problems.length;

  if (isPracticeOver) {
    const fullyCorrectCount = Object.values(submittedResults).reduce((count, result) => {
      const allCorrect = result.step_results.every(r => r.correct);
      return count + (allCorrect ? 1 : 0);
    }, 0);

    const isHighestResult = fullyCorrectCount === problems.length;

    return (
      <div className="practice-forge flex items-center justify-center">
        <style dangerouslySetInnerHTML={{ __html: PRACTICE_CSS }} />
        <div className="forge-card completion-card space-y-6">
          <span className="forge-badge">Counter-Spell Forged</span>
          
          <div className="flex flex-col items-center justify-center gap-3">
            <div className="completion-rune">
              <ForgeRuneIcon className="w-16 h-16" />
            </div>
            <img 
              src={isHighestResult ? "/suri-snake-happy.png" : "/suri-snake-sad.png"} 
              alt={isHighestResult ? "Suri Happy" : "Suri Supportive"} 
              className="h-24 w-auto object-contain select-none" 
            />
            <p className="speech-bubble mx-auto">
              {isHighestResult 
                ? "Sss-pectacular! Every rune in the chain is stable." 
                : "The spell holds, but a few runes need another polish."}
            </p>
          </div>

          <h1 className="forge-title">Practice Complete!</h1>
          
          <div className="forge-scroll">
            <p className="forge-panel-title justify-center w-full">Stable Runes</p>
            <p className="text-5xl font-black mt-1 text-[#3a2111]">
              {fullyCorrectCount} <span className="text-slate-300">/</span> {problems.length}
            </p>
            <p className="text-sm font-black mt-2.5 text-[#4e3477]">
              Problems forged perfectly without unstable steps
            </p>
          </div>

          {/* Results Summary Logs */}
          <div className="text-left space-y-3 max-w-md mx-auto">
            {problems.map((prob, idx) => {
              const res = submittedResults[idx];
              const allCorrect = res?.step_results.every(r => r.correct);
              return (
                <div key={prob.id} className="summary-row">
                  <span className="truncate max-w-[240px]">Problem {idx + 1}: {cleanMathExpr(prob.problem_expr)}</span>
                  <span className={`text-[9px] font-black px-2.5 py-1 rounded-md border-2 ${
                    allCorrect 
                      ? "bg-green-100 text-green-900 border-[#1F2720]" 
                      : "bg-red-100 text-red-900 border-[#1F2720]"
                  }`}>
                    {allCorrect ? "✓ ALL CORRECT" : "✗ INCORRECT"}
                  </span>
                </div>
              );
            })}
          </div>

          <button
            onClick={handleGetResults}
            className="forge-action secondary"
          >
            Get Session Summary <ArrowRight className="w-5 h-5 stroke-[3px]" />
          </button>
        </div>
      </div>
    );
  }

  const problem = problems[currentProblemIdx];
  const submissionResult = submittedResults[currentProblemIdx];

  const requiresTextInput = (val: string) => {
    const withoutLatex = val.replace(/\\[a-zA-Z]+/g, "");
    return /[a-zA-Z]{2,}/.test(withoutLatex) || withoutLatex.includes(",");
  };

  const fixUnbalancedMath = (before: string, after: string) => {
    const doubleDollarsBefore = (before.match(/\$\$/g) || []).length;
    if (doubleDollarsBefore % 2 !== 0) {
      return { fixedBefore: before + "$$", fixedAfter: "$$" + after };
    }
    
    const singleBefore = before.replace(/\$\$/g, "");
    const singleDollarsBefore = (singleBefore.match(/\$/g) || []).length;
    if (singleDollarsBefore % 2 !== 0) {
      return { fixedBefore: before + "$", fixedAfter: "$" + after };
    }
    
    return { fixedBefore: before, fixedAfter: after };
  };

  const runeAngles = problem.steps.map((_, idx) => {
    const total = Math.max(problem.steps.length, 1);
    return -90 + (idx * 360) / total;
  });
  const stableRuneCount = submissionResult
    ? submissionResult.step_results.filter(r => r.correct).length
    : 0;
  const unstableRuneCount = submissionResult
    ? submissionResult.step_results.filter(r => !r.correct).length
    : 0;

  return (
    <div className="practice-forge">
      <style dangerouslySetInnerHTML={{ __html: PRACTICE_CSS }} />
      <div className="forge-shell">

        {/* Dynamic header banner */}
        <header className="forge-hud">
          <div className="forge-title-block">
            <img src="/suri-snake-left.png" alt="Suri Guide" className="forge-suri select-none shrink-0" />
            <div>
              <span className="forge-eyebrow">Scaffolded Practice</span>
              <h1 className="forge-title">Rune Forging Workspace</h1>
              <p className="forge-subtitle">
                Problem <span>{currentProblemIdx + 1}</span> of {problems.length} | Build Suri&apos;s counter-spell one rune at a time
              </p>
            </div>
          </div>
          <button onClick={handleBackToTopics} className="forge-exit">Exit</button>
        </header>

        <main className="forge-grid">
          <div className="forge-card">
          
          {/* Word Problem Card */}
          {problem.word_problem_text && (
            <section className="forge-panel">
              <span className="forge-panel-title"><BookOpen className="w-4 h-4" /> Quest Context</span>
              <div className="forge-scroll text-sm md:text-base leading-relaxed markdown-content">
                <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                  {problem.word_problem_text}
                </ReactMarkdown>
              </div>
            </section>
          )}

          {/* Expression Focus Panel */}
          <div className="forge-panel">
            <p className="forge-panel-title"><Sparkles className="w-4 h-4" /> Target Expression</p>
            <div className="forge-scroll forge-expression markdown-content select-none">
              <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                {cleanMathExpr(problem.problem_expr).startsWith("$") ? cleanMathExpr(problem.problem_expr) : `$${cleanMathExpr(problem.problem_expr)}$`}
              </ReactMarkdown>
            </div>
          </div>

          {/* Scaffold Steps */}
          <section>
            <h2 className="forge-panel-title">
              <Flame className="w-4 h-4" /> Rune Chain Steps
            </h2>

            {problem.steps.map((step, idx) => {
              const stepResult = submissionResult?.step_results.find(
                r => r.step_index === step.step_index
              );

              const isCorrect = stepResult?.correct;
              const hasSubmitted = !!submissionResult;
              const isTextStep = requiresTextInput(step.correct_value);

              const cleanBlankExpr = cleanMathExpr(step.blank_expression).replace("?", "___");
              const exprParts = cleanBlankExpr.split("___");
              const rawBefore = exprParts[0];
              const rawAfter = exprParts[1] || "";
              const { fixedBefore: beforeBlank, fixedAfter: afterBlank } = fixUnbalancedMath(rawBefore, rawAfter);

              const isMisconceptionStep =
                submissionResult?.misconception_found &&
                submissionResult?.misconception_step_index === step.step_index;

              let stateClass = "";

              if (hasSubmitted) {
                if (isCorrect) {
                  stateClass = "is-correct";
                } else if (isMisconceptionStep) {
                  stateClass = "is-wrong";
                } else {
                  stateClass = "is-wrong";
                }
              }

              const formatMathValue = (val: string) => {
                const trimmed = val.trim();
                return trimmed.startsWith("$") ? trimmed : `$${trimmed}$`;
              };

              return (
                <div
                  key={step.step_index}
                  className={`step-card ${stateClass}`}
                >
                  <div className="step-rune">
                    <ForgeRuneIcon className="w-7 h-7" />
                  </div>

                  <div className="flex-1 space-y-3">
                    <div className="step-header">
                      <div className="flex items-center gap-2">
                        <span className="step-title">Rune {idx + 1}</span>
                        <span className="forge-badge">
                          {step.step_type === "variable_identification" ? "Concept Setup" : "Algebraic Step"}
                        </span>
                      </div>

                      {hasSubmitted && (
                        <span className={`forge-badge ${
                          isCorrect ? "bg-green-100 text-green-900" : "bg-red-100 text-red-900"
                        }`}>
                          {isCorrect ? "Stable Rune" : "Unstable Rune"}
                        </span>
                      )}
                    </div>

                    <div className="step-instruction markdown-content">
                      <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                        {step.instruction}
                      </ReactMarkdown>
                    </div>

                    {/* Checkpoint equation input blocks */}
                    <div className="rune-input-row font-mono text-sm md:text-base">
                      <ReactMarkdown
                        remarkPlugins={[remarkMath]}
                        rehypePlugins={[rehypeKatex]}
                        components={{ p: (props) => <span {...props} /> }}
                      >
                        {beforeBlank}
                      </ReactMarkdown>

                      {!hasSubmitted ? (
                        isTextStep ? (
                          <input
                            type="text"
                            value={inputs[step.step_index] || ""}
                            onChange={(e) => handleInputChange(step.step_index, e.target.value)}
                            disabled={isSubmitting}
                            placeholder="..."
                            className="rune-text-input text-sm font-mono"
                          />
                        ) : (
                          <div className="w-64 max-w-full">
                            <MathField
                              value={inputs[step.step_index] || ""}
                              onChange={(value) => handleInputChange(step.step_index, value)}
                              disabled={isSubmitting}
                            />
                          </div>
                        )
                      ) : (
                        <span className={`submitted-value text-sm md:text-base ${
                          isCorrect
                            ? "is-correct"
                            : "is-wrong"
                        }`}>
                          {stepResult?.submitted_value ? (
                            <ReactMarkdown
                              remarkPlugins={[remarkMath]}
                              rehypePlugins={[rehypeKatex]}
                              components={{ p: (props) => <span {...props} /> }}
                            >
                              {isTextStep
                                ? stepResult.submitted_value
                                : formatMathValue(stepResult.submitted_value)}
                            </ReactMarkdown>
                          ) : (
                            "—"
                          )}
                        </span>
                      )}

                      <ReactMarkdown
                        remarkPlugins={[remarkMath]}
                        rehypePlugins={[rehypeKatex]}
                        components={{ p: (props) => <span {...props} /> }}
                      >
                        {afterBlank}
                      </ReactMarkdown>
                    </div>

                    {hasSubmitted && !isCorrect && (
                      <p className="rune-copy flex flex-wrap items-center gap-1.5 mt-2">
                        Stable pattern:
                        <span className="submitted-value is-correct">
                          <ReactMarkdown
                            remarkPlugins={[remarkMath]}
                            rehypePlugins={[rehypeKatex]}
                            components={{ p: (props) => <span {...props} /> }}
                          >
                            {formatMathValue(cleanMathExpr(step.correct_value))}
                          </ReactMarkdown>
                        </span>
                      </p>
                    )}

                    {/* SURI's targeted feedback layout block */}
                    {isMisconceptionStep && submissionResult?.feedback_text && (
                      <div className="feedback-rune">
                        <div className="flex items-center gap-2 mb-2">
                          <img src="/suri-snake-sad.png" alt="Suri sad" className="w-9 h-auto shrink-0" />
                          <p className="forge-panel-title mb-0">
                            Rune Stabilizing Hint
                          </p>
                        </div>
                        <div className="text-xs leading-relaxed markdown-content">
                          <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                            {submissionResult.feedback_text}
                          </ReactMarkdown>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </section>
          </div>

          <aside className="rune-board" aria-label="Rune forging progress">
            <div className="rune-circle">
              <div className="rune-core">
                <ForgeRuneIcon className="w-16 h-16" />
              </div>
              {problem.steps.map((step, idx) => {
                const stepResult = submissionResult?.step_results.find(r => r.step_index === step.step_index);
                const angle = runeAngles[idx] * (Math.PI / 180);
                const radius = 105;
                const left = 50 + (Math.cos(angle) * radius) / 3.1;
                const top = 50 + (Math.sin(angle) * radius) / 3.1;
                const nodeClass = !submissionResult
                  ? ""
                  : stepResult?.correct
                    ? "is-lit"
                    : "is-cracked";
                return (
                  <div
                    key={step.step_index}
                    className={`rune-node ${nodeClass}`}
                    style={{ left: `${left}%`, top: `${top}%` }}
                    aria-label={`Rune ${idx + 1}${nodeClass === "is-lit" ? " stable" : nodeClass === "is-cracked" ? " unstable" : " pending"}`}
                  >
                    {idx + 1}
                  </div>
                );
              })}
            </div>
            <p className="rune-copy">
              Each algebra step forges one rune in Suri&apos;s counter-spell. Stable runes lock into the chain; unstable runes flicker so you can retry without losing your path.
            </p>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="forge-scroll text-center">
                <p className="forge-panel-title justify-center w-full">Stable</p>
                <p className="text-3xl font-black text-[#17633a]">{stableRuneCount}</p>
              </div>
              <div className="forge-scroll text-center">
                <p className="forge-panel-title justify-center w-full">Unstable</p>
                <p className="text-3xl font-black text-[#87221f]">{unstableRuneCount}</p>
              </div>
            </div>
          </aside>
        </main>

        {errorMsg && (
          <div className="feedback-rune mt-6 flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 shrink-0" />
            <span>[ERROR EXCEPTION] {errorMsg}</span>
          </div>
        )}

        {/* Action Bottom Nav */}
        <footer className="mt-8">
          {!problemCompleted ? (
            <button
              onClick={handleSubmitProblem}
              disabled={!allInputsFilled || isSubmitting}
              className="forge-action"
            >
              {isSubmitting ? "Testing rune stability..." : "Forge Counter-Rune"}
            </button>
          ) : (
            <button
              onClick={handleNextProblem}
              className="forge-action secondary"
            >
              {currentProblemIdx + 1 === problems.length ? "Unleash Final Spell" : "Forge Next Chain"} <ArrowRight className="w-5 h-5 stroke-[3px]" />
            </button>
          )}
        </footer>

      </div>
    </div>
  );
}
