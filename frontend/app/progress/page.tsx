"use client";

import { useMemo, useState, type CSSProperties } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import MainPage from "@/components/mainpage";
import BackToTopButton from "@/components/navigation/BackToTopButton";
import { useLearningData, useWorldNavigation } from "@/components/navigation/LearningShell";
import { createSession, skipDiagnostic } from "@/lib/api";
import { BookOpen, Loader2, Lock } from "lucide-react";

type NodeStatus = "mastered" | "in_progress" | "unresolved" | "not_attempted";
type ChainNode = { node_id: string; node_label: string; grade: number };
type Topic = { node_id: string; label: string; grade: number };
type LearningSession = { id: string; topic_entry_node: string };

const EMPTY_TOPICS: Topic[] = [];
const EMPTY_SESSIONS: LearningSession[] = [];
const EMPTY_CHAINS: Record<string, ChainNode[]> = {};
const EMPTY_NODE_STATUSES: Record<string, NodeStatus> = {};

function isSessionConflict(error: unknown): error is { status: number; detail?: { session_id?: string } } {
  return typeof error === "object" && error !== null && "status" in error && (error as { status?: unknown }).status === 409;
}

function getStatusBadge(status: NodeStatus | undefined) {
  switch (status) {
    case "mastered": return { text: "Mastered", tone: "mastered", symbol: "✦" };
    case "unresolved": return { text: "Needs work", tone: "needs-work", symbol: "!" };
    case "in_progress": return { text: "In progress", tone: "in-progress", symbol: "●" };
    default: return { text: "Not attempted", tone: "not-attempted", symbol: "○" };
  }
}

function getGradeSubtitle(grade: number) {
  switch (grade) {
    case 6:
    case 7: return "Foundations & prerequisites";
    case 8: return "Building algebraic fluency";
    case 9: return "Expanding algebraic thinking";
    default: return "Advanced problem solving";
  }
}

export default function ProgressPage() {
  const router = useRouter();
  const { navigate } = useWorldNavigation();
  const { data, error: loadError } = useLearningData();
  const [launchingNodeId, setLaunchingNodeId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const topics = data?.topics ?? EMPTY_TOPICS;
  const activeSessions = data?.progress.active_sessions ?? EMPTY_SESSIONS;
  const topicChains = data?.chains ?? EMPTY_CHAINS;
  const nodeStatuses = data?.statuses ?? EMPTY_NODE_STATUSES;
  const loading = !data && !loadError;
  const error = actionError ?? loadError?.message ?? null;

  const summary = useMemo(() => {
    const nodeIds = new Set(Object.values(topicChains).flatMap((chain) => chain.map((node) => node.node_id)));
    let mastered = 0;
    let needsReview = 0;

    nodeIds.forEach((nodeId) => {
      if (nodeStatuses[nodeId] === "mastered") mastered += 1;
      if (nodeStatuses[nodeId] === "unresolved") needsReview += 1;
    });

    return { mastered, needsReview };
  }, [nodeStatuses, topicChains]);

  // A competency can belong to more than one topic trail. It is deliberately
  // rendered once here so the student sees one complete mastery route by grade.
  const conceptTrail = useMemo(() => {
    const renderedNodeIds = new Set<string>();

    return topics.flatMap((topic) => {
      const orderedChain = [...(topicChains[topic.node_id] ?? [])].reverse();
      const mastered = orderedChain.filter((node) => nodeStatuses[node.node_id] === "mastered").length;
      const topicMastery = orderedChain.length ? Math.round((mastered / orderedChain.length) * 100) : 0;

      return orderedChain.flatMap((node, pathIndex) => {
        if (renderedNodeIds.has(node.node_id)) return [];
        renderedNodeIds.add(node.node_id);

        return [{
          node,
          topic,
          topicMastery,
          priorNodeIds: orderedChain.slice(0, pathIndex).map((priorNode) => priorNode.node_id),
          previousNodeId: pathIndex ? orderedChain[pathIndex - 1].node_id : null,
        }];
      });
    });
  }, [nodeStatuses, topicChains, topics]);

  const gradeGroups = useMemo(() => {
    const groups = new Map<number, typeof conceptTrail>();
    conceptTrail.forEach((concept) => {
      const gradeConcepts = groups.get(concept.node.grade) ?? [];
      gradeConcepts.push(concept);
      groups.set(concept.node.grade, gradeConcepts);
    });
    return [...groups.entries()].sort(([firstGrade], [secondGrade]) => firstGrade - secondGrade);
  }, [conceptTrail]);

  const conceptLabels = useMemo(() => new Map(conceptTrail.map((concept) => [concept.node.node_id, concept.node.node_label])), [conceptTrail]);

  const handleStudyNode = async (nodeId: string) => {
    setLaunchingNodeId(nodeId);
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
    } catch (cause: unknown) {
      if (isSessionConflict(cause) && cause.detail?.session_id) {
        router.push(`/session/${cause.detail.session_id}/lesson`);
      } else {
        setActionError("Failed to launch lesson path. Please try again.");
      }
    } finally {
      setLaunchingNodeId(null);
    }
  };

  const displayCount = (value: number) => loading ? "--" : String(value).padStart(2, "0");

  return <MainPage immersive>
    <div className="progress-library-page">
      <div className="progress-library-back-row">
        <button type="button" className="topics-library-back" onClick={() => navigate("/dashboard")} aria-label="Go back to the previous page"><span aria-hidden="true">←</span> Go back</button>
      </div>

      <header className="progress-library-header">
        <div className="progress-library-kicker"><span /> SURI&apos;S MASTERY ARCHIVE <span /></div>
        <h1>Your <em>Mastery Trail</em></h1>
        <p>See the concepts you&apos;ve mastered from Grade 6 through Grade 10, and continue from the next skill on your path.</p>
        <div className="progress-library-stats" aria-label="Progress overview">
          <div><b>{displayCount(summary.mastered)}</b><span>Skills mastered</span></div>
          <div><b>{displayCount(activeSessions.length)}</b><span>Quests active</span></div>
          <div><b>{displayCount(summary.needsReview)}</b><span>Skills to revisit</span></div>
        </div>
      </header>

      {error && <div className="topics-library-error progress-library-error" role="alert"><Image src="/suri-snake-sad.png" alt="Sad Suri" width={42} height={42} /><div><strong>The trail lantern has dimmed.</strong><p>{error}</p></div></div>}

      <section className="progress-grade-collections" aria-label="Mastery by grade">
        {loading ? <div className="progress-library-loading"><i /><p>Reading the academy trail markers…</p></div> : conceptTrail.length === 0 ? <div className="progress-library-empty"><b>No trail markers are ready yet.</b><p>Return after your next lesson to see your learning path here.</p></div> : gradeGroups.map(([grade, concepts]) => {
          const gradeMastery = concepts.length ? Math.round((concepts.filter((concept) => nodeStatuses[concept.node.node_id] === "mastered").length / concepts.length) * 100) : 0;

          return <section key={grade} className="progress-grade-collection" aria-labelledby={`grade-path-${grade}`} style={{ "--grade-path-mastery": `${gradeMastery}%` } as CSSProperties}>
            <header className="progress-grade-collection-title">
              <div>
                <span>GRADE {grade} CONCEPTS</span>
                <h2 id={`grade-path-${grade}`}>Grade {grade} mastery</h2>
                <p>{getGradeSubtitle(grade)}</p>
              </div>
              <div className="progress-grade-collection-mastery"><b>{String(gradeMastery).padStart(2, "0")}%</b><span>MASTERED</span></div>
            </header>
            <div className="progress-grade-progress" role="progressbar" aria-label={`Grade ${grade} path mastery`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={gradeMastery}><i><em /></i></div>
            <ol className="progress-grade-path">
              {concepts.map((concept, pathIndex) => {
                const { node, topic, topicMastery, priorNodeIds, previousNodeId } = concept;
                const status = nodeStatuses[node.node_id];
                const badge = getStatusBadge(status);
                const isNodeLoading = launchingNodeId === node.node_id;
                const isAccessible = priorNodeIds.every((nodeId) => nodeStatuses[nodeId] === "mastered");
                const canOpen = status === "mastered" || isAccessible;
                const previousLabel = previousNodeId ? conceptLabels.get(previousNodeId) : null;
                const stepNumber = String(pathIndex + 1).padStart(2, "0");
                const stepTotal = String(concepts.length).padStart(2, "0");

                return <li key={node.node_id} className={`progress-grade-step ${badge.tone} ${!canOpen ? "is-locked" : ""}`}>
                  <span className="progress-grade-marker" aria-hidden="true">{stepNumber}</span>
                  <article className="progress-grade-chapter">
                    <div className="progress-grade-chapter-copy"><small>STEP {stepNumber} OF {stepTotal} · {topic.label}</small><h3>{node.node_label}</h3><p>Grade {node.grade} competency · {node.node_id}</p></div>
                    <div className="progress-grade-chapter-meta"><span className={`progress-grade-status ${badge.tone}`}>{badge.symbol} {badge.text}</span></div>
                    {previousLabel && <p className={`progress-grade-prerequisite ${canOpen ? "is-cleared" : ""}`}>{canOpen ? `Trail opened after ${previousLabel}.` : `Master ${previousLabel} first.`}</p>}
                    <div className="progress-grade-chapter-footer">
                      <div className="progress-grade-mastery" aria-label={`${topicMastery}% mastery for ${topic.label}`}><span>Topic mastery <b>{String(topicMastery).padStart(2, "0")}%</b></span><i><em style={{ width: `${topicMastery}%` }} /></i></div>
                      <button type="button" onClick={() => canOpen && handleStudyNode(node.node_id)} disabled={!canOpen || launchingNodeId !== null} className={`progress-grade-action ${status === "mastered" ? "is-review" : ""} ${!canOpen ? "is-locked" : ""}`}>
                        {isNodeLoading ? <Loader2 size={13} className="animate-spin" /> : !canOpen ? <Lock size={13} /> : <BookOpen size={15} />}
                        {status === "mastered" ? "Review" : canOpen ? "Study" : "Locked"}
                      </button>
                    </div>
                  </article>
                </li>;
              })}
            </ol>
          </section>;
        })}
      </section>

      <div className="progress-library-top">
        <BackToTopButton className="topics-library-back" />
      </div>
    </div>
  </MainPage>;
}
