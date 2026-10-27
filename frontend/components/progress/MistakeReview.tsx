"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import MistakeRecord from "./MistakeRecord";
import { getStudentMistakes, type MisconceptionHistoryItem } from "@/lib/api";
import type { NodeStatus } from "@/lib/learningData";
import { filterMistakes, mistakeFrequency } from "@/lib/progressAnalytics";
import styles from "@/app/progress/progress.module.css";

export default function MistakeReview({ items: recentItems, studentId, initialNextOffset, statuses, launchingNodeId, onReview }: {
  items: MisconceptionHistoryItem[];
  studentId: string;
  initialNextOffset?: number | null;
  statuses: Record<string, NodeStatus>;
  launchingNodeId: string | null;
  onReview: (nodeId: string) => void;
}) {
  const [nodeId, setNodeId] = useState("");
  const [search, setSearch] = useState("");
  const [order, setOrder] = useState("newest");
  const [olderItems, setOlderItems] = useState<MisconceptionHistoryItem[]>([]);
  const [nextOffset, setNextOffset] = useState(initialNextOffset ?? null);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const items = useMemo(() => {
    const seen = new Set<string>();
    return [...recentItems, ...olderItems].filter(item => {
      if (!item.id) return true;
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    });
  }, [recentItems, olderItems]);
  const frequency = useMemo(() => mistakeFrequency(items), [items]);
  const filtered = useMemo(() => filterMistakes(items, nodeId, search, order), [items, nodeId, search, order]);
  const reset = () => { setNodeId(""); setSearch(""); setOrder("newest"); };
  const loadOlder = async () => {
    if (loadingOlder || nextOffset === null) return;
    setLoadingOlder(true);
    setHistoryError(null);
    try {
      const page = await getStudentMistakes(studentId, nextOffset);
      setOlderItems(previous => [...previous, ...page.items]);
      setNextOffset(page.next_offset);
    } catch {
      setHistoryError("Older records could not be loaded. Please try again.");
    } finally { setLoadingOlder(false); }
  };

  return <section id="full-error-history" className={styles.section} aria-labelledby="mistake-heading" tabIndex={-1}>
    <div className={styles.sectionHeading}>
      <div><span className={styles.eyebrow}>REFLECT & REVIEW</span><h2 id="mistake-heading">Learn from your mistakes</h2><p>Your recorded practice mistakes, with the original step and a way back to the lesson. The newest 20 load first.</p></div>
      <span className={styles.sectionCount}>{items.length} {nextOffset !== null ? "loaded" : "recorded"} {items.length === 1 ? "mistake" : "mistakes"}</span>
    </div>
    {items.length === 0 ? <div className={styles.empty}><strong>No mistakes recorded yet.</strong><p>Practice mistakes will appear here as you learn. Explore a topic to get started.</p></div> : <div className={styles.reviewLayout}>
      <aside className={styles.frequency} aria-label="Mistake frequency by competency">
        <h3>Where to focus</h3><p>Frequency in these {items.length} loaded records. Select a skill to filter.</p>
        <ul>{frequency.map(item => <li key={item.nodeId}><button type="button" aria-pressed={nodeId === item.nodeId} onClick={() => { setNodeId(nodeId === item.nodeId ? "" : item.nodeId); setSearch(""); }}>
          <span>{item.label}</span><b>{item.count}</b><i aria-hidden="true"><em style={{ width: `${item.count / items.length * 100}%` }} /></i>
        </button></li>)}</ul>
        <p className={styles.note}>These are historical records. Current mastery is shown separately; reviewing a lesson keeps your history intact.</p>
      </aside>
      <div className={styles.records}>
        <div className={styles.filters}>
          <label className={styles.search}><span>Search mistakes</span><div><Search size={16} aria-hidden="true" /><input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search skill or step…" /></div></label>
          <label><span>Competency</span><select aria-label="Competency" value={nodeId} onChange={event => setNodeId(event.target.value)}><option value="">All competencies</option>{frequency.map(item => <option key={item.nodeId} value={item.nodeId}>{item.label}</option>)}</select></label>
          <label><span>Order</span><select aria-label="Order" value={order} onChange={event => setOrder(event.target.value)}><option value="newest">Newest first</option><option value="oldest">Oldest first</option></select></label>
        </div>
        <div className={styles.resultsLine}><p role="status">Showing {filtered.length} of {items.length} loaded records</p>{(nodeId || search || order !== "newest") && <button type="button" className={styles.textButton} onClick={reset}>Reset filters</button>}</div>
        {filtered.length === 0 ? <div className={styles.empty}><strong>No matching mistakes.</strong><p>Try a different competency or search term.</p><button type="button" className={styles.textButton} onClick={reset}>Show all recent mistakes</button></div> : <ol className={styles.recordList}>
          {filtered.map((item, index) => <li key={item.id ?? `${item.node_id}-${item.logged_at}-${index}`}>
            <MistakeRecord item={item} status={statuses[item.node_id]} launchingNodeId={launchingNodeId} onReview={onReview} />
          </li>)}
        </ol>}
        {historyError && <p role="alert">{historyError}</p>}
        {nextOffset !== null && <div className={styles.historyMore}><p className={styles.note}>Filters and frequency cover loaded records. Load older records to include more history.</p><button type="button" className={styles.primaryButton} disabled={loadingOlder} onClick={loadOlder}>{loadingOlder ? "Loading older records…" : historyError ? "Retry older records" : "Load older records"}</button></div>}
      </div>
    </div>}
  </section>;
}
