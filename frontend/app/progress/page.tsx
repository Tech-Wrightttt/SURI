"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import MainPage from "@/components/mainpage";
import { ensureLearningData } from "@/lib/learningData";
import { createSession, skipDiagnostic } from "@/lib/api";
import { BookOpen, Loader2, Lock } from "lucide-react";

interface ChainNode {
  node_id: string;
  node_label: string;
  grade: number;
}

interface Topic {
  node_id: string;
  label: string;
  grade: number;
}

interface LearningSession {
  id: string;
  topic_entry_node: string;
}

type NodeStatus = "mastered" | "in_progress" | "unresolved" | "not_attempted";

function isSessionConflict(error: unknown): error is { status: number; detail?: { session_id?: string } } {
  return typeof error === "object" && error !== null && "status" in error && (error as { status?: unknown }).status === 409;
}

export default function ProgressPage() {
  return <ProgressContent />;
}

function ProgressContent() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [activeSessions, setActiveSessions] = useState<LearningSession[]>([]);
  const [nodeStatuses, setNodeStatuses] = useState<Record<string, NodeStatus>>({});
  const [topicChains, setTopicChains] = useState<Record<string, ChainNode[]>>({});
  const [launchingNodeId, setLaunchingNodeId] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        // Reuse the root-shell prefetch so data and the island arrival begin together.
        const data = await ensureLearningData();
        setActiveSessions(data.progress.active_sessions || []);
        setNodeStatuses(data.statuses);
        setTopics(data.topics);
        setTopicChains(data.chains);
      } catch (error: unknown) {
        setErrorMsg(error instanceof Error ? error.message : "Failed to load progress metrics.");
      } finally {
        setLoading(false);
      }
    };

    void loadData();
  }, []);

  const summary = useMemo(() => {
    const nodeIds = new Set(Object.values(topicChains).flatMap((chain) => chain.map((node) => node.node_id)));
    let mastered = 0;
    let inProgress = 0;
    let needsReview = 0;

    nodeIds.forEach((nodeId) => {
      if (nodeStatuses[nodeId] === "mastered") mastered += 1;
      if (nodeStatuses[nodeId] === "in_progress") inProgress += 1;
      if (nodeStatuses[nodeId] === "unresolved") needsReview += 1;
    });

    return { mastered, inProgress, needsReview };
  }, [nodeStatuses, topicChains]);

  // A chapter is a mapped node, not the whole prerequisite chain. Rendering
  // these independently prevents one long chain from collapsing into a single,
  // cramped shelf when a topic has several prerequisite chapters.
  const chapterShelves = useMemo(() => {
    const renderedNodes = new Set<string>();

    return topics.flatMap((topic) => {
      const orderedChain = [...(topicChains[topic.node_id] || [])].reverse();
      const total = orderedChain.length;
      const mastered = orderedChain.filter((node) => nodeStatuses[node.node_id] === "mastered").length;
      const trackPct = total > 0 ? Math.round((mastered / total) * 100) : 0;

      return orderedChain.flatMap((node, stage) => {
        if (renderedNodes.has(node.node_id)) return [];
        renderedNodes.add(node.node_id);
        return [{
          node,
          topic,
          trackPct,
          priorNodeIds: orderedChain.slice(0, stage).map((previousNode) => previousNode.node_id),
          previousNodeId: stage > 0 ? orderedChain[stage - 1].node_id : null,
        }];
      });
    });
  }, [nodeStatuses, topicChains, topics]);

  const gradeGroups = useMemo(() => {
    const groups = new Map<number, typeof chapterShelves>();
    chapterShelves.forEach((chapter) => {
      const chapters = groups.get(chapter.node.grade) || [];
      chapters.push(chapter);
      groups.set(chapter.node.grade, chapters);
    });
    return [...groups.entries()].sort(([firstGrade], [secondGrade]) => firstGrade - secondGrade);
  }, [chapterShelves]);

  const chapterLabels = useMemo(() => new Map(chapterShelves.map((chapter) => [chapter.node.node_id, chapter.node.node_label])), [chapterShelves]);

  const handleStudyNode = async (nodeId: string) => {
    setLaunchingNodeId(nodeId);
    setErrorMsg(null);

    try {
      const existingSession = activeSessions.find((session) => session.topic_entry_node === nodeId);
      if (existingSession) {
        router.push(`/session/${existingSession.id}/lesson`);
        return;
      }

      const newSession = await createSession({ topic_entry_node: nodeId });
      await skipDiagnostic(newSession.id);
      router.push(`/session/${newSession.id}/lesson`);
    } catch (error: unknown) {
      if (isSessionConflict(error) && error.detail?.session_id) {
        router.push(`/session/${error.detail.session_id}/lesson`);
      } else {
        setErrorMsg("Failed to launch lesson path. Please try again.");
      }
    } finally {
      setLaunchingNodeId(null);
    }
  };

  const getStatusBadge = (status: NodeStatus | undefined) => {
    switch (status) {
      case "mastered": return { text: "Mastered", tone: "mastered" };
      case "unresolved": return { text: "Needs Work", tone: "needs-work" };
      case "in_progress": return { text: "In Progress", tone: "in-progress" };
      default: return { text: "Not Attempted", tone: "not-attempted" };
    }
  };

  const getGradeShelfSubtitle = (grade: number) => {
    switch (grade) {
      case 6: return "Foundations & prerequisites";
      case 7: return "Foundations & prerequisites";
      case 8: return "Building algebraic fluency";
      case 9: return "Expanding algebraic thinking";
      default: return "Advanced problem solving";
    }
  };

  const displayCount = (value: number) => loading ? "--" : String(value).padStart(2, "0");

  return <MainPage immersive>
    <div className="progress-route-page">
      <header className="progress-route-header">
        <button type="button" className="progress-route-back" onClick={() => router.back()} aria-label="Go back to the previous page"><span aria-hidden="true">←</span> Go back</button>
        <div className="progress-route-kicker"><span /> THE SURI ACADEMY PATHFINDER <span /></div>
        <h1>Mastery <em>Trail</em></h1>
        <p>Follow each grade-level path in order, completing every prerequisite before the next chapter unlocks.</p>
        <div className="progress-route-stats" aria-label="Progress overview">
          <div><b>{displayCount(summary.mastered)}</b><span>Skills mastered</span></div>
          <div><b>{displayCount(activeSessions.length)}</b><span>Journeys active</span></div>
          <div><b>{displayCount(summary.needsReview)}</b><span>Skills to revisit</span></div>
        </div>
      </header>

      {errorMsg && <div className="progress-route-error" role="alert"><img src="/suri-snake-sad.png" alt="Sad Suri" /><div><strong>The trail lantern has dimmed.</strong><p>{errorMsg}</p></div></div>}

      <section className="progress-route-collections" aria-label="Learning progress">
        {loading ? <div className="progress-route-collection"><div className="progress-route-loading" role="status"><i /><p>Reading the academy trail markers…</p></div></div> : chapterShelves.length === 0 ? <div className="progress-route-collection"><div className="progress-route-empty"><b>No trail markers are ready yet.</b><p>Return after your next lesson to see your learning path here.</p></div></div> : <div className="progress-grade-containers">
          {gradeGroups.map(([grade, chapters]) => {
            const gradeMastery = chapters.length === 0 ? 0 : Math.round((chapters.filter((chapter) => nodeStatuses[chapter.node.node_id] === "mastered").length / chapters.length) * 100);

            return <section key={grade} className="progress-route-collection progress-grade-shelf" aria-labelledby={`grade-path-${grade}`} style={{ "--grade-path-mastery": `${gradeMastery}%` } as CSSProperties}>
            <header className="progress-route-collection-title"><span>✦</span><div className="progress-grade-shelf-heading"><h2 id={`grade-path-${grade}`}>Grade {grade}</h2><p>{getGradeShelfSubtitle(grade)}</p></div><span>✦</span></header>
            <div className="progress-grade-progress" role="progressbar" aria-label={`Grade ${grade} path mastery`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={gradeMastery} />
            <ol className="progress-grade-path">
              {chapters.map((chapter, pathIndex) => {
                const { node, topic, trackPct, priorNodeIds, previousNodeId } = chapter;
                const status = nodeStatuses[node.node_id];
                const badge = getStatusBadge(status);
                const isNodeLoading = launchingNodeId === node.node_id;
                const isAccessible = priorNodeIds.every((nodeId) => nodeStatuses[nodeId] === "mastered");
                const canOpen = status === "mastered" || isAccessible;
                const previousLabel = previousNodeId ? chapterLabels.get(previousNodeId) : null;
                const stepNumber = String(pathIndex + 1).padStart(2, "0");
                const stepTotal = String(chapters.length).padStart(2, "0");

                return <li key={node.node_id} className={`progress-grade-step ${badge.tone} ${!canOpen ? "is-locked" : ""}`}>
                  <span className="progress-grade-marker" aria-hidden="true">{stepNumber}</span>
                  <article className="progress-grade-chapter">
                    <div className="progress-grade-chapter-copy"><small>STEP {stepNumber} OF {stepTotal} · {topic.label}</small><h4>{node.node_label}</h4><p>Grade {node.grade} prerequisite · {node.node_id}</p></div>
                    <div className="progress-grade-chapter-meta"><span className={`progress-grade-status ${badge.tone}`}>{status === "mastered" ? "✦" : status === "in_progress" ? "●" : status === "unresolved" ? "!" : "○"} {badge.text}</span></div>
                    {previousLabel && <p className={`progress-grade-prerequisite ${canOpen ? "is-cleared" : ""}`}>{canOpen ? `Path opened after ${previousLabel}.` : `Pass ${previousLabel} first.`}</p>}
                    <div className="progress-grade-chapter-footer">
                      <div className="progress-grade-mastery" aria-label={`${trackPct}% mastery for ${topic.label}`}><span>Path mastery <b>{String(trackPct).padStart(2, "0")}%</b></span><i><em style={{ width: `${trackPct}%` }} /></i></div>
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
        </div>}
      </section>
    </div>
  </MainPage>;
}
