"use client";

import { useRef } from "react";
import { ArrowUpRight, CheckCircle2, X } from "lucide-react";
import type { MisconceptionHistoryItem } from "@/lib/api";
import type { NodeStatus } from "@/lib/learningData";
import { filterMistakes } from "@/lib/progressAnalytics";
import MistakeRecord from "./MistakeRecord";
import MistakeReview from "./MistakeReview";
import styles from "@/app/progress/progress.module.css";

export default function RecentMistakes({ items, studentId, initialNextOffset, statuses, launchingNodeId, onReview }: {
  items: MisconceptionHistoryItem[];
  studentId: string;
  initialNextOffset?: number | null;
  statuses: Record<string, NodeStatus>;
  launchingNodeId: string | null;
  onReview: (nodeId: string) => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const recent = filterMistakes(items, "", "", "newest").slice(0, 5);

  return <section id="error-history" className={styles.recentReview} aria-labelledby="recent-review-heading" tabIndex={-1}>
    <div className={styles.sectionHeading}>
      <div><span className={styles.eyebrow}>RECENT MISTAKES</span><h2 id="recent-review-heading">Reflect &amp; review</h2></div>
      <span className={styles.sectionCount}>Latest {recent.length}</span>
    </div>
    {recent.length ? <ol className={styles.recentList} aria-label="Five most recent mistakes">
      {recent.map((item, index) => <li key={item.id ?? `${item.node_id}-${item.logged_at}-${index}`}>
        <MistakeRecord item={item} status={statuses[item.node_id]} launchingNodeId={launchingNodeId} onReview={onReview} />
      </li>)}
    </ol> : <div className={styles.reviewEmpty}>
      <CheckCircle2 size={36} aria-hidden="true" />
      <strong>No mistakes recorded yet.</strong>
    </div>}
    {items.length > 0 && <button type="button" className={styles.historyButton} onClick={() => dialogRef.current?.showModal()}>
      View full history <ArrowUpRight size={18} aria-hidden="true" />
    </button>}
    <dialog ref={dialogRef} className={styles.historyDialog} aria-labelledby="history-dialog-title">
      <header className={styles.dialogHeader}>
        <h2 id="history-dialog-title">Error history</h2>
        <button type="button" aria-label="Close error history" onClick={() => dialogRef.current?.close()}><X size={22} aria-hidden="true" /></button>
      </header>
      <MistakeReview items={items} studentId={studentId} initialNextOffset={initialNextOffset} statuses={statuses} launchingNodeId={launchingNodeId} onReview={nodeId => { dialogRef.current?.close(); onReview(nodeId); }} />
    </dialog>
  </section>;
}
