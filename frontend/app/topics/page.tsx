"use client";

import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import MainPage from "@/components/mainpage";
import TopicBookCarousel, { type CarouselBook } from "@/components/TopicBookCarousel";
import { useLearningData, useWorldNavigation } from "@/components/navigation/LearningShell";

export default function TopicsPage() {
  const router = useRouter();
  const { navigate } = useWorldNavigation();
  const { data, error: loadError } = useLearningData();
  const topics = useMemo(() => data?.topics ?? [], [data]);
  const activeTopics = useMemo(() => Object.fromEntries((data?.progress.active_sessions ?? []).map(session => [session.topic_entry_node, session.id])), [data]);
  const completedTopics = useMemo(() => new Set((data?.progress.completed_sessions ?? []).map(session => session.topic_entry_node)), [data]);
  const nodeStatuses = useMemo(() => data?.statuses ?? {}, [data]);
  const topicChains = useMemo(() => data?.chains ?? {}, [data]);
  const loading = !data && !loadError;
  const error = loadError?.message ?? null;
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const openTopic = useCallback((nodeId: string) => router.push(`/topics/${nodeId}`), [router]);
  const resumeTopic = useCallback((sessionId: string) => router.push(`/session/${sessionId}/lesson`), [router]);
  const carouselBooks = useMemo(() => topics.map((topic, index) => {
    const isActive = topic.node_id in activeTopics;
    const isCompleted = completedTopics.has(topic.node_id);
    const chain = topicChains[topic.node_id] || [];
    const trackTotal = chain.length;
    const trackMastered = chain.filter(node => nodeStatuses[node.node_id] === "mastered").length;
    const mastery = trackTotal > 0 ? Math.round((trackMastered / trackTotal) * 100) : 0;
    const hasProgress = mastery > 0 || isActive;
    const status = mastery === 100 ? "Mastered" : hasProgress ? "In Progress" : "Not Attempted";
    return {
      nodeId: topic.node_id,
      label: topic.label,
      grade: topic.grade,
      ordinal: index + 1,
      mastery,
      status,
      hasProgress,
      completed: isCompleted,
    } satisfies CarouselBook;
  }), [activeTopics, completedTopics, nodeStatuses, topicChains, topics]);
  const defaultSelectedNodeId = carouselBooks.find(book => book.nodeId in activeTopics)?.nodeId ?? carouselBooks[0]?.nodeId ?? null;
  const resolvedSelectedNodeId = selectedNodeId && carouselBooks.some(book => book.nodeId === selectedNodeId)
    ? selectedNodeId
    : defaultSelectedNodeId;
  const selectedIndex = Math.max(0, carouselBooks.findIndex(book => book.nodeId === resolvedSelectedNodeId));
  const selectedBook = carouselBooks[selectedIndex];
  const moveSelection = (direction: -1 | 1) => {
    if (!carouselBooks.length) return;
    const nextIndex = (selectedIndex + direction + carouselBooks.length) % carouselBooks.length;
    setSelectedNodeId(carouselBooks[nextIndex].nodeId);
  };
  const preloadTopic = useCallback((nodeId?: string) => {
    if (!nodeId) return;
    const sessionId = activeTopics[nodeId];
    router.prefetch(sessionId ? `/session/${sessionId}/lesson` : `/topics/${nodeId}`);
  }, [activeTopics, router]);
  const enterTopic = useCallback((nodeId: string) => {
    const sessionId = activeTopics[nodeId];
    if (sessionId) resumeTopic(sessionId);
    else openTopic(nodeId);
  }, [activeTopics, openTopic, resumeTopic]);
  const handleBookClick = useCallback((index: number) => {
    const book = carouselBooks[index];
    if (!book) return;
    if (book.nodeId === resolvedSelectedNodeId) enterTopic(book.nodeId);
    else setSelectedNodeId(book.nodeId);
  }, [carouselBooks, enterTopic, resolvedSelectedNodeId]);
  const handleBookIntent = useCallback((index: number) => preloadTopic(carouselBooks[index]?.nodeId), [carouselBooks, preloadTopic]);
  return <MainPage immersive>
    <div className="topics-library-page">
      <div className="topics-library-back-row">
        <button type="button" className="topics-library-back" onClick={() => navigate("/dashboard")} aria-label="Go back to the previous page"><span aria-hidden="true">←</span> Go back</button>
      </div>
      <header className="topics-library-header">
        <div className="topics-library-kicker"><span /> SURI&apos;S SPELLBOOK ARCHIVE <span /></div>
        <h1>Choose Your <em>Spellbook</em></h1>
        <p>Pick a volume to bring it forward, then begin its learning quest.</p>
        <div className="topics-library-stats" aria-label="Topics overview">
          <div><b>{loading ? "--" : String(topics.length).padStart(2, "0")}</b><span>Spellbooks ready</span></div>
          <div><b>{loading ? "--" : String(Object.keys(activeTopics).length).padStart(2, "0")}</b><span>Quests active</span></div>
        </div>
      </header>

      {error && <div className="topics-library-error" role="alert"><img src="/suri-snake-sad.png" alt="Sad Suri" /><div><strong>The archive lantern has dimmed.</strong><p>{error}</p></div></div>}

      <section className="topics-carousel-experience" aria-label="Topic volume carousel">
        {loading ? <div className="topics-library-loading"><i /><p>Consulting the academy catalogue…</p></div> : selectedBook && <>
          <div className="topics-carousel-stage" aria-label="Select a spellbook to bring it into focus">
            <TopicBookCarousel
              books={carouselBooks}
              activeIndex={selectedIndex}
              onBookClick={handleBookClick}
              onBookIntent={handleBookIntent}
            />
          </div>

          <nav className="topics-carousel-controls" aria-label="Choose a topic volume">
            <button type="button" className="topics-carousel-arrow" onClick={() => moveSelection(-1)} onPointerEnter={() => preloadTopic(carouselBooks[(selectedIndex - 1 + carouselBooks.length) % carouselBooks.length]?.nodeId)} onFocus={() => preloadTopic(carouselBooks[(selectedIndex - 1 + carouselBooks.length) % carouselBooks.length]?.nodeId)} aria-label="Focus previous topic">←</button>
            <div className="topics-carousel-dots">{carouselBooks.map((book, index) => <button key={book.nodeId} type="button" className={index === selectedIndex ? "is-selected" : ""} onClick={() => setSelectedNodeId(book.nodeId)} onPointerEnter={() => preloadTopic(book.nodeId)} onFocus={() => preloadTopic(book.nodeId)} aria-label={`Focus topic ${book.ordinal}: ${book.label}`} aria-current={index === selectedIndex ? "true" : undefined}>{String(book.ordinal).padStart(2, "0")}</button>)}</div>
            <button type="button" className="topics-carousel-arrow" onClick={() => moveSelection(1)} onPointerEnter={() => preloadTopic(carouselBooks[(selectedIndex + 1) % carouselBooks.length]?.nodeId)} onFocus={() => preloadTopic(carouselBooks[(selectedIndex + 1) % carouselBooks.length]?.nodeId)} aria-label="Focus next topic">→</button>
          </nav>

          <article className="topics-carousel-focus" aria-live="polite">
            <div className="topics-carousel-focus-heading">
              <span>TOPIC {String(selectedBook.ordinal).padStart(2, "0")} / {String(carouselBooks.length).padStart(2, "0")}</span>
              <h2>{selectedBook.label}</h2>
              <p>Grade {selectedBook.grade} curriculum volume · Trail {selectedBook.nodeId}</p>
            </div>
            <div className="topics-carousel-focus-details">
              <div className={`topics-carousel-status ${selectedBook.completed ? "is-complete" : selectedBook.hasProgress ? "is-progress" : ""}`}><span>{selectedBook.completed ? "✦" : selectedBook.hasProgress ? "●" : "○"}</span>{selectedBook.status}</div>
              <div className="topics-carousel-mastery"><div><span>Mastery</span><b>{String(selectedBook.mastery).padStart(2, "0")}%</b></div><i><em style={{ width: `${selectedBook.mastery}%` }} /></i></div>
              <p className="topics-carousel-path">Learning path: {topicChains[selectedBook.nodeId]?.length ?? 0} skills</p>
              <button type="button" className="topics-carousel-action" onClick={() => enterTopic(selectedBook.nodeId)} onPointerEnter={() => preloadTopic(selectedBook.nodeId)} onFocus={() => preloadTopic(selectedBook.nodeId)}>{selectedBook.nodeId in activeTopics ? "Resume quest" : selectedBook.completed ? "Review again" : "Open volume"}<span aria-hidden="true">→</span></button>
            </div>
          </article>
        </>}
      </section>
    </div>
  </MainPage>;
}
