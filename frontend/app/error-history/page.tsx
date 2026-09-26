"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { BookOpen, CalendarDays, CheckCircle2, Loader2, Sparkles } from "lucide-react";
import MainPage from "@/components/mainpage";
import BackToTopButton from "@/components/navigation/BackToTopButton";
import { useLearningData, useWorldNavigation } from "@/components/navigation/LearningShell";
import { createSession, skipDiagnostic } from "@/lib/api";

const REVIEW_TIPS: Record<string, string> = {
  QE: "Quadratic equations require isolating variables or factoring trinomials. Remember that quadratics can have up to two solutions. If factoring is difficult, try using the Quadratic Formula.",
  FP: "Factoring polynomials is about breaking complex expressions down into simpler multiplying components. Always check if there is a Greatest Common Factor (GCF) you can factor out first.",
  SP: "Polynomial multiplication relies heavily on distribution. When multiplying binomials, use FOIL (First, Outer, Inner, Last) and watch exponent addition rules carefully.",
  LE: "When working with exponents, remember: when multiplying like bases, add the powers ($x^a \\cdot x^b = x^{a+b}$). When raising a power to a power, multiply them ($(x^a)^b = x^{ab}$).",
  OI: "Be extra mindful of negative signs! Subtracting a negative is equivalent to adding a positive value ($a - (-b) = a + b$). Re-verify sign distributions at each intermediate step.",
  FD: "Fractions and decimals require common denominators before adding or subtracting. When dividing fractions, remember the reciprocal rule: multiply by the flipped second term.",
  SLE: "Systems of Linear Equations find the common point where two equations overlap. You can systematically solve them using substitution, elimination, or graphing.",
  L2V: "When graphing linear equations in two variables, identify the y-intercept first to plot your starting point, then use the slope (rise over run) to locate your second coordinate.",
  L1V: "Linear equations in one variable require isolating the variable on one side. Whatever algebraic operations you apply to the left side must also be applied identically to the right side.",
  AE: "Evaluating algebraic expressions simply means substituting given constant numbers in place of the variables. Complete calculations following strict order of operations (PEMDAS).",
  RER: "Rational exponents can be rewritten directly as radicals: $x^{a/b} = \\sqrt[b]{x^a}$. Radical terms can only be combined if they share identical base radicands.",
  PE: "Higher-degree polynomial equations require finding roots. Try grouping terms or utilizing the Factor Theorem to find at least one linear divisor.",
  PD: "Polynomial division can be solved using long division or synthetic division. Keep placeholder terms (like $0x^2$) visible so columns align correctly.",
  PO: "When combining polynomials, remember you can only add or subtract like terms. Terms with different variable degrees (like $x^3$ and $x^2$) cannot be merged.",
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function ErrorHistoryContent() {
  const router = useRouter();
  const { navigate } = useWorldNavigation();
  const { data, error: loadError } = useLearningData();
  const misconceptions = data?.progress.misconception_history ?? [];
  const activeSessions = data?.progress.active_sessions ?? [];
  const loading = !data && !loadError;
  const [actionError, setActionError] = useState<string | null>(null);
  const [loadingNodeId, setLoadingNodeId] = useState<string | null>(null);
  const errorMsg = actionError ?? loadError?.message ?? null;

  const handleReviewNode = async (nodeId: string) => {
    setLoadingNodeId(nodeId);
    setActionError(null);
    try {
      const existingSession = activeSessions.find((session) => session.topic_entry_node === nodeId);
      if (existingSession) {
        router.push(`/session/${existingSession.id}/lesson`);
        return;
      }

      const newSession = await createSession({ topic_entry_node: nodeId });
      await skipDiagnostic(newSession.id);
      router.push(`/session/${newSession.id}/lesson`);
    } catch {
      setActionError("Could not load the lesson. Please try again.");
    } finally {
      setLoadingNodeId(null);
    }
  };

  const displayCount = loading ? "--" : String(misconceptions.length).padStart(2, "0");
  const activeCount = loading ? "--" : String(activeSessions.length).padStart(2, "0");

  return <MainPage immersive>
    <div className="error-history-page">
      <div className="error-history-back-row">
        <button type="button" className="topics-library-back" onClick={() => navigate("/dashboard")} aria-label="Go back to the previous page"><span aria-hidden="true">←</span> Go back</button>
      </div>

      <header className="error-history-header">
        <div className="error-history-kicker"><span /> SURI&apos;S REVIEW ARCHIVE <span /></div>
        <h1>Learn From Your <em>Mistakes</em></h1>
        <p>Return to the steps that caused trouble, read Suri&apos;s guidance, and continue the lesson when you&apos;re ready.</p>
        <div className="error-history-stats" aria-label="Error history overview">
          <div><b>{displayCount}</b><span>Errors recorded</span></div>
          <div><b>{activeCount}</b><span>Lessons active</span></div>
        </div>
      </header>

      {errorMsg && <div className="topics-library-error error-history-error" role="alert">
        <Image src="/suri-snake-sad.png" alt="Sad Suri" width={42} height={42} />
        <div><strong>The review archive could not be opened.</strong><p>{errorMsg}</p></div>
      </div>}

      <section className="error-history-collection" aria-labelledby="error-history-list-heading">
        <header className="error-history-collection-title">
          <div>
            <span>REVIEW QUEUE</span>
            <h2 id="error-history-list-heading">Steps to revisit</h2>
            <p>Each record keeps the original trouble spot and a focused reminder for your next attempt.</p>
          </div>
          <div className="error-history-count" aria-label={`${misconceptions.length} errors recorded`}><b>{displayCount}</b><span>RECORDS</span></div>
        </header>

        {loading ? <div className="error-history-loading" role="status"><i /><p>Reading your review notes…</p></div>
          : misconceptions.length === 0 ? <div className="error-history-empty">
            <span><CheckCircle2 size={23} aria-hidden="true" /></span>
            <div><b>Your review queue is clear.</b><p>No misconceptions have been recorded yet. Keep following your learning trail.</p></div>
          </div>
          : <ol className="error-history-list">
            {misconceptions.map((item, index) => {
              const isNodeLoading = loadingNodeId === item.node_id;
              const reviewTip = REVIEW_TIPS[item.node_id] || "Review variables, factors, and coordinate signs related to this section.";
              const recordNumber = String(index + 1).padStart(2, "0");

              return <li key={`${item.node_id}-${item.logged_at}-${index}`} className="error-history-record">
                <span className="error-history-marker" aria-hidden="true">{recordNumber}</span>
                <article className="error-history-card">
                  <header className="error-history-card-header">
                    <div className="error-history-card-heading">
                      <small>RECORD {recordNumber} · COMPETENCY {item.node_id}</small>
                      <h3>{item.node_label}</h3>
                    </div>
                    <span className="error-history-status"><span aria-hidden="true">!</span> Needs review</span>
                  </header>

                  <div className="error-history-detail">
                    <span>WHAT TO REVISIT</span>
                    <p>{item.step_description}</p>
                  </div>

                  <div className="error-history-guidance">
                    <span className="error-history-guidance-icon"><Sparkles size={16} aria-hidden="true" /></span>
                    <div><b>Suri&apos;s recovery note</b><p>{reviewTip}</p></div>
                  </div>

                  <footer className="error-history-card-footer">
                    <div className="error-history-date"><CalendarDays size={15} aria-hidden="true" /><span>Recorded {formatDate(item.logged_at)}</span></div>
                    <button type="button" onClick={() => handleReviewNode(item.node_id)} disabled={loadingNodeId !== null} className="error-history-action">
                      {isNodeLoading ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : <BookOpen size={15} aria-hidden="true" />}
                      {isNodeLoading ? "Opening…" : "Review lesson"}
                    </button>
                  </footer>
                </article>
              </li>;
            })}
          </ol>}
      </section>

      <div className="error-history-top"><BackToTopButton className="topics-library-back" /></div>
    </div>
  </MainPage>;
}

export default function ErrorHistoryPage() {
  return <ErrorHistoryContent />;
}
