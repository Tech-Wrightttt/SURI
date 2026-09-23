"use client";

import { useRouter } from "next/navigation";
import MainPage from "@/components/mainpage";
import { useLearningData } from "@/components/navigation/LearningShell";

export default function TopicsPage() {
  const router = useRouter();
  const { data, error: loadError } = useLearningData();
  const topics = data?.topics ?? [];
  const activeTopics = Object.fromEntries((data?.progress.active_sessions ?? []).map(session => [session.topic_entry_node, session.id]));
  const completedTopics = new Set((data?.progress.completed_sessions ?? []).map(session => session.topic_entry_node));
  const nodeStatuses = data?.statuses ?? {};
  const topicChains = data?.chains ?? {};
  const loading = !data && !loadError;
  const error = loadError?.message ?? null;

  const openTopic = (nodeId: string) => router.push(`/topics/${nodeId}`);
  const resumeTopic = (sessionId: string) => router.push(`/session/${sessionId}/lesson`);

  return <MainPage immersive>
    <div className="topics-library-page">
      <header className="topics-library-header">
        <button type="button" className="topics-library-back" onClick={() => router.back()} aria-label="Go back to the previous page"><span aria-hidden="true">←</span> Go back</button>
        <div className="topics-library-kicker"><span /> THE SURI ACADEMY ARCHIVES <span /></div>
        <h1>Grand <em>Library</em></h1>
        <p>Choose a volume from the living collection and continue your learning journey.</p>
        <div className="topics-library-stats" aria-label="Topics overview">
          <div><b>{loading ? "--" : String(topics.length).padStart(2, "0")}</b><span>Volumes mapped</span></div>
          <div><b>{loading ? "--" : String(Object.keys(activeTopics).length).padStart(2, "0")}</b><span>Journeys active</span></div>
        </div>
      </header>

      {error && <div className="topics-library-error" role="alert"><img src="/suri-snake-sad.png" alt="Sad Suri" /><div><strong>The archive lantern has dimmed.</strong><p>{error}</p></div></div>}

      <section className="topics-library-collection" aria-label="Topic library">
        <div className="topics-library-collection-title"><span>✦</span><div><small>CURATED FOR YOUR PATH</small><h2>The Learning Stacks</h2></div><span>✦</span></div>
        {loading ? <div className="topics-library-loading"><i /><p>Consulting the academy catalogue…</p></div> : <div className="topics-book-stacks">
          {topics.map((topic, index) => {
            const isActive = topic.node_id in activeTopics;
            const isCompleted = completedTopics.has(topic.node_id);
            const chain = topicChains[topic.node_id] || [];
            const trackTotal = chain.length;
            const trackMastered = chain.filter(node => nodeStatuses[node.node_id] === "mastered").length;
            const trackPct = trackTotal > 0 ? Math.round((trackMastered / trackTotal) * 100) : 0;
            const statusText = trackPct === 100 ? "Mastered" : trackPct > 0 || isActive ? "In Progress" : "Not Attempted";
            const action = () => isActive ? resumeTopic(activeTopics[topic.node_id]) : openTopic(topic.node_id);
            return <article key={topic.node_id} className={`topics-library-book ${isActive ? "is-active" : ""} ${isCompleted ? "is-completed" : ""}`}>
              <div className="topics-library-book-cover">
                <span className="topics-library-book-number">{String(index + 1).padStart(2, "0")}</span>
                <span className="topics-library-book-status">{isCompleted ? "✦" : isActive ? "●" : "○"} {statusText}</span>
                <div className="topics-library-book-crest">{isCompleted ? "✦" : isActive ? "✧" : "⌁"}</div>
                <small>TRAIL · {topic.node_id}</small><h3>{topic.label}</h3><p>Grade {topic.grade} curriculum volume</p>
                <div className="topics-library-book-progress"><span>Mastery</span><b>{String(trackPct).padStart(2, "0")}%</b><i><em style={{ width: `${trackPct}%` }} /></i></div>
                <button type="button" className="topics-library-book-action" onClick={action}>{isActive ? "Resume quest" : isCompleted ? "Review again" : "Open volume"}<span>→</span></button>
              </div>
            </article>;
          })}
        </div>}
      </section>
    </div>
  </MainPage>;
}
