"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import MainPage from "@/components/mainpage";
import TopicsLibraryWorld from "@/components/WorldMap/TopicsLibraryWorld";
import { TopicInfo } from "../../lib/api";
import { ensureLearningData } from "@/lib/learningData";

export default function TopicsPage() {
  const router = useRouter();
  const [topics, setTopics] = useState<TopicInfo[]>([]);
  const [activeTopics, setActiveTopics] = useState<Record<string, string>>({});
  const [completedTopics, setCompletedTopics] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nodeStatuses, setNodeStatuses] = useState<Record<string, string>>({});
  const [topicChains, setTopicChains] = useState<Record<string, { node_id: string }[]>>({});

  useEffect(() => {
    const load = async () => {
      try {
        // Reuses the shell cache; API, authentication, session, and progress
        // behavior remain on the exact same code path as before the redesign.
        const data = await ensureLearningData();
        const activeMap: Record<string, string> = {};
        for (const session of data.progress.active_sessions || []) activeMap[session.topic_entry_node] = session.id;
        setActiveTopics(activeMap);
        setCompletedTopics(new Set((data.progress.completed_sessions || []).map(session => session.topic_entry_node)));
        setTopics(data.topics);
        setNodeStatuses(data.statuses);
        setTopicChains(data.chains);
      } catch (cause: unknown) {
        const detail = cause && typeof cause === "object" && "detail" in cause ? (cause as { detail?: unknown }).detail : undefined;
        const message = cause instanceof Error ? cause.message : undefined;
        setError(typeof detail === "string" ? detail : message || "Failed to load topics. Are you logged in?");
      } finally { setLoading(false); }
    };
    void load();
  }, []);

  const openTopic = (nodeId: string) => router.push(`/topics/${nodeId}`);
  const resumeTopic = (sessionId: string) => router.push(`/session/${sessionId}/lesson`);

  return <MainPage immersive>
    <TopicsLibraryWorld />
    <div className="topics-library-page">
      <header className="topics-library-header">
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
              </div>
              <div className="topics-library-book-details">
                <p>{isCompleted ? "This volume is fully mastered. Return whenever you wish to review its lessons." : isActive ? "Your bookmark is waiting here. Continue where your current learning journey left off." : "An unopened academy volume. Begin this trail whenever you are ready."}</p>
                <button onClick={action}>{isActive ? "Resume quest" : isCompleted ? "Review again" : "Open volume"}<span>→</span></button>
              </div>
            </article>;
          })}
        </div>}
      </section>
    </div>
  </MainPage>;
}
