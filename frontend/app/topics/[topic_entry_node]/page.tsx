 "use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import MainPage from "@/components/mainpage";
import {
  getTopicIntro,
  getGraphChain,
  createSession,
  skipDiagnostic,
} from "../../../lib/api";

const TOPIC_DESCRIPTIONS: Record<string, string> = {
  QE: "Solve quadratic equations using factoring, completing the square, and the quadratic formula. Builds on factoring and polynomial operations.",
  SLE: "Solve systems of two linear equations using graphing, substitution, and elimination. Builds on linear equations and algebraic expressions.",
  RER: "Simplify and operate on radical expressions and rational exponents. Builds on laws of exponents.",
  PE: "Solve polynomial equations of degree 3 and higher using factoring and the Factor Theorem. Builds on factoring and polynomial division.",
};

interface ChainNode {
  node_id: string;
  node_label: string;
  grade: number;
}

const ENTRY_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Bree+Serif&family=Nunito:wght@400;600;700;800;900&display=swap');

.topic-entry {
  position: relative;
  width: 100%;
  min-height: 100vh;
  min-height: 100dvh;
  box-sizing: border-box;
  padding: clamp(12px, 2vw, 26px);
  color: #fff4d5;
  font-family: Georgia, 'Times New Roman', serif;
  isolation: isolate;

  background-color: #1b0e12;
  background-image: url('/login/study.png');
  background-position: center top;
  background-size: cover;
  background-repeat: no-repeat;
  background-attachment: fixed;
}

.topic-entry::before {
  content: "";
  position: absolute;
  inset: 0;
  z-index: -1;
  pointer-events: none;
  background:
    linear-gradient(
      180deg,
      rgba(20, 9, 8, .56),
      rgba(23, 10, 9, .78)
    ),
    radial-gradient(
      circle at 50% 0%,
      rgba(255, 205, 95, .2),
      transparent 42%
    );
}
.topic-entry-shell { position: relative; z-index: 1; width: min(1120px, 100%); margin: 0 auto; }
.topic-entry-hud {
  display: grid; grid-template-columns: minmax(0,1fr) auto; align-items: center; gap: 18px;
  padding: 20px clamp(16px,3vw,34px); margin-bottom: 16px;
  border: 4px solid #3b1d13; border-radius: 0 0 24px 24px;
  background: linear-gradient(180deg,rgba(255,240,191,.98),rgba(222,177,94,.98));
  color: #3a2111; box-shadow: 0 10px 0 rgba(39,18,10,.8), 0 22px 38px rgba(0,0,0,.35), inset 0 0 0 5px rgba(255,198,92,.2);
}
.topic-entry-brand { display:flex; align-items:center; gap:16px; min-width:0; }
.topic-entry-suri {
  width:74px;height:74px; flex-shrink:0; display:grid;place-items:center;border-radius:50%;
  border:3px solid #6d411c;background:linear-gradient(180deg,#2f4022,#182716);
  box-shadow:0 4px 0 rgba(72,34,16,.6);
}
.topic-entry-suri img { width:58px;height:58px;object-fit:contain; }
.topic-entry-eyebrow { display:block;font:900 11px 'Nunito',sans-serif;letter-spacing:1.7px;text-transform:uppercase;color:#6c278e;margin-bottom:5px; }
.topic-entry-title { margin:0;font:900 clamp(25px,4vw,42px)/1.05 'Bree Serif',Georgia,serif;color:#3a2111;text-shadow:0 2px rgba(255,255,255,.4);overflow-wrap:anywhere; }
.topic-entry-subtitle { margin-top:7px;font:900 11px 'Nunito',sans-serif;letter-spacing:.8px;text-transform:uppercase;color:#4e3477; }
.topic-entry-button {
  min-height:46px;padding:0 18px;border:3px solid #6d411c;border-radius:8px;
  background:linear-gradient(180deg,#fff6aa,#ffd35c 58%,#c7832e);color:#321008;
  font:900 14px 'Bree Serif',Georgia,serif;box-shadow:0 5px 0 rgba(72,34,16,.72);
  cursor:pointer;transition:transform .12s ease,filter .12s ease;white-space:nowrap;
}
.topic-entry-button:hover:not(:disabled) { transform:translateY(-2px);filter:brightness(1.05); }
.topic-entry-button:disabled { opacity:.55;cursor:not-allowed; }
.topic-entry-speech {
  display:flex;align-items:center;gap:13px;padding:14px 18px;margin:16px 0;
  border:3px solid #2c160d;border-radius:18px 18px 18px 6px;
  background:linear-gradient(180deg,#fff2c8,#e5bf73);color:#341c11;
  box-shadow:0 5px 0 rgba(43,22,10,.74),0 0 20px rgba(255,207,89,.2);
}
.topic-entry-speech img { width:54px;height:54px;object-fit:contain;flex-shrink:0; }
.topic-entry-speech p { margin:0;font:900 13px/1.6 'Nunito',sans-serif; }
.topic-entry-panel {
  border:5px solid #5e3619;padding:14px;margin-top:16px;
  background:linear-gradient(90deg,rgba(25,12,8,.94),rgba(83,46,24,.95),rgba(25,12,8,.94));
  box-shadow:0 9px 0 #160b07,inset 0 0 0 3px rgba(245,199,93,.25);
}
.topic-entry-paper {
  padding:clamp(18px,3vw,30px);border:3px solid #9c672b;
  background:radial-gradient(circle at 18% 12%,rgba(255,255,255,.28),transparent 26%),linear-gradient(180deg,#fff0bf,#dec07b);
  color:#2b170d;box-shadow:inset 0 0 0 2px rgba(89,48,18,.14);
}
.topic-entry-section-label { margin:0 0 12px;font:900 11px 'Nunito',sans-serif;letter-spacing:1.5px;text-transform:uppercase;color:#6c278e; }
.topic-entry-description { margin:0;font:700 clamp(16px,2vw,20px)/1.8 'Nunito',sans-serif;color:#2b170d; }
.topic-entry-meta { display:flex;flex-wrap:wrap;gap:10px;margin-top:18px; }
.topic-entry-chip { padding:7px 12px;border:2px solid rgba(89,48,18,.35);border-radius:999px;background:rgba(255,255,255,.38);font:900 11px 'Nunito',sans-serif;color:#4b2b13; }
.topic-entry-chain { display:grid;gap:12px; }
.topic-entry-node {
  position:relative;display:flex;align-items:center;gap:14px;padding:14px 16px;
  border:3px solid #6d411c;background:linear-gradient(180deg,#fff3cb,#e4c17a);
  box-shadow:0 5px 0 rgba(39,18,10,.5);color:#2b170d;
}
.topic-entry-node-index {
  width:38px;height:38px;display:grid;place-items:center;flex-shrink:0;border-radius:50%;
  border:3px solid #3e2412;background:radial-gradient(circle at 35% 25%,#fff1ad,#d69a32 58%,#7b491d);
  font:900 13px 'Nunito',sans-serif;color:#2b170d;
}
.topic-entry-node-name { margin:0;font:900 16px 'Bree Serif',Georgia,serif; }
.topic-entry-node-meta { margin:4px 0 0;font:800 10px 'Nunito',sans-serif;color:#75552c;letter-spacing:.3px; }
.topic-entry-actions { display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px;margin-top:18px; }
.topic-entry-action {
  display:flex;flex-direction:column;align-items:flex-start;justify-content:space-between;gap:18px;
  min-height:178px;padding:22px;text-align:left;border:4px solid #6d411c;border-radius:10px;
  cursor:pointer;transition:transform .12s ease,filter .12s ease;
}
.topic-entry-action:hover:not(:disabled) { transform:translateY(-3px);filter:brightness(1.05); }
.topic-entry-action:disabled { opacity:.55;cursor:not-allowed; }
.topic-entry-action.primary { background:linear-gradient(180deg,#9df2a7 0%,#31a85e 55%,#176235 100%);color:#071d0f;border-color:#ffe288;box-shadow:0 7px 0 #12361e,0 0 24px rgba(88,255,138,.22); }
.topic-entry-action.secondary { background:linear-gradient(180deg,#ffe596,#b8792d);color:#2a160d;box-shadow:0 6px 0 #28150c; }
.topic-entry-action-tag { font:900 10px 'Nunito',sans-serif;letter-spacing:1.2px;text-transform:uppercase; }
.topic-entry-action-title { margin:10px 0 7px;font:900 23px 'Bree Serif',Georgia,serif; }
.topic-entry-action-copy { margin:0;font:800 12px/1.6 'Nunito',sans-serif; }
.topic-entry-action-cta { font:900 12px 'Nunito',sans-serif;letter-spacing:.6px;text-transform:uppercase; }
.topic-entry-error { margin:16px 0;padding:15px 18px;border:3px solid #6b251d;background:#ffe0d5;color:#641b13;font:900 12px/1.6 'Nunito',sans-serif; }
.topic-entry-loading { min-height:100vh;display:grid;place-items:center;background:#24130d;color:#ffe288; }
.topic-entry-spinner { width:48px;height:48px;border:5px solid rgba(255,226,136,.25);border-top-color:#ffe288;border-right-color:#8749b7;border-radius:50%;animation:entry-spin .8s linear infinite; }
@keyframes entry-spin { to { transform:rotate(360deg); } }
@media(max-width:680px) {
 .topic-entry-hud { grid-template-columns:1fr; }
 .topic-entry-hud .topic-entry-button { justify-self:start; }
 .topic-entry-suri { width:60px;height:60px; }
 .topic-entry-suri img { width:46px;height:46px; }
 .topic-entry-actions { grid-template-columns:1fr; }
 .topic-entry-action { min-height:150px; }
}
`;

export default function TopicIntroPage() {
  const router = useRouter();
  const params = useParams();
  const topicEntryNode = params.topic_entry_node as string;

  const [label, setLabel] = useState("");
  const [grade, setGrade] = useState(0);
  const [chain, setChain] = useState<ChainNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const [intro, chainData] = await Promise.all([
          getTopicIntro(topicEntryNode),
          getGraphChain(topicEntryNode),
        ]);
        setLabel(intro.label);
        setGrade(intro.grade);
        setChain(chainData.chain);
      } catch (err: any) {
        setError(err.detail || err.message || "Failed to load topic information.");
      } finally {
        setLoading(false);
      }
    };
    if (topicEntryNode) load();
  }, [topicEntryNode]);

  const handleCreateSession = async (mode: "diagnostic" | "skip") => {
    setActionLoading(true);
    setError(null);
    let sessionId = "";

    try {
      const session = await createSession({ topic_entry_node: topicEntryNode });
      sessionId = session.id;
    } catch (err: any) {
      if (err.status === 409 && err.detail?.session_id) {
        sessionId = err.detail.session_id;
      } else {
        setError(err.detail || "Failed to create learning session.");
        setActionLoading(false);
        return;
      }
    }

    try {
      if (mode === "diagnostic") {
        router.push(`/session/${sessionId}/diagnostic`);
      } else {
        await skipDiagnostic(sessionId);
        router.push(`/session/${sessionId}/lesson`);
      }
    } catch (err: any) {
      setError(err.detail || "Failed to navigate to session.");
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <>
        <style>{ENTRY_CSS}</style>
        <div className="topic-entry-loading"><div className="topic-entry-spinner" /></div>
      </>
    );
  }

  const description = TOPIC_DESCRIPTIONS[topicEntryNode] || `Learn about ${label}.`;

  return (
    <MainPage immersive>
      <style>{ENTRY_CSS}</style>
      <main className="topic-entry">
        <div className="topic-entry-shell">
          <header className="topic-entry-hud">
            <div className="topic-entry-brand">
              <div className="topic-entry-suri">
                <img src="/suri-snake-right.png" alt="SURI mascot" />
              </div>
              <div>
                <span className="topic-entry-eyebrow">Your next adventure</span>
                <h1 className="topic-entry-title">{label || "Topic Adventure"}</h1>
                <p className="topic-entry-subtitle">Grade {grade} · Topic Entry</p>
              </div>
            </div>
            <button className="topic-entry-button" onClick={() => router.push("/topics")}>← Back to Library</button>
          </header>

          <div className="topic-entry-speech">
            <img src="/suri-snake-right.png" alt="" />
            <p>Sss-ready, Ranger? Before we enter this chapter, let’s check the skills you’ve gathered along the trail. You can take a diagnostic or head straight into the lesson!</p>
          </div>

          {error && <div className="topic-entry-error" role="alert">A thorny problem! {error}</div>}

          <section className="topic-entry-panel">
            <div className="topic-entry-paper">
              <h2 className="topic-entry-section-label">Chapter Overview</h2>
              <p className="topic-entry-description">{description}</p>
              <div className="topic-entry-meta">
                <span className="topic-entry-chip">TOPIC · {topicEntryNode}</span>
                <span className="topic-entry-chip">GRADE {grade}</span>
                <span className="topic-entry-chip">{chain.length} PREREQUISITE {chain.length === 1 ? "STEP" : "STEPS"}</span>
              </div>
            </div>
          </section>

          <section className="topic-entry-panel">
            <div className="topic-entry-paper">
              <h2 className="topic-entry-section-label">Prerequisite Trail</h2>
              {chain.length ? (
                <div className="topic-entry-chain">
                  {chain.map((node, index) => (
                    <div className="topic-entry-node" key={node.node_id}>
                      <div className="topic-entry-node-index">{String(index + 1).padStart(2, "0")}</div>
                      <div>
                        <p className="topic-entry-node-name">{node.node_label}</p>
                        <p className="topic-entry-node-meta">GRADE {node.grade} · NODE {node.node_id}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="topic-entry-description">No prerequisite steps are listed for this topic. You’re ready to begin!</p>
              )}
            </div>
          </section>

          <div className="topic-entry-actions">
            <button className="topic-entry-action primary" onClick={() => handleCreateSession("diagnostic")} disabled={actionLoading}>
              <div>
                <span className="topic-entry-action-tag">Recommended · Check your skills</span>
                <h3 className="topic-entry-action-title">Diagnostic Assessment</h3>
                <p className="topic-entry-action-copy">Find out which prerequisite skills you already know and let your learning path adapt to you.</p>
              </div>
              <span className="topic-entry-action-cta">{actionLoading ? "Preparing your quest…" : "Begin assessment →"}</span>
            </button>
            <button className="topic-entry-action secondary" onClick={() => handleCreateSession("skip")} disabled={actionLoading}>
              <div>
                <span className="topic-entry-action-tag">Fast track</span>
                <h3 className="topic-entry-action-title">Skip to Lessons</h3>
                <p className="topic-entry-action-copy">Already confident? Bypass the diagnostic and jump straight into the lesson.</p>
              </div>
              <span className="topic-entry-action-cta">{actionLoading ? "Preparing your quest…" : "Go to lesson →"}</span>
            </button>
          </div>
        </div>
      </main>
    </MainPage>
  );
}
