"use client";

import { ArrowUpRight, ChevronDown } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import type { MisconceptionHistoryItem } from "@/lib/api";
import type { NodeStatus } from "@/lib/learningData";
import { STATUS_LABELS } from "@/lib/progressAnalytics";
import { REVIEW_TIPS } from "@/lib/reviewTips";
import styles from "@/app/progress/progress.module.css";

export function recordDate(iso: string) {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "Date unavailable" : date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function MistakeRecord({ item, status = "not_attempted", launchingNodeId, onReview }: {
  item: MisconceptionHistoryItem;
  status?: NodeStatus;
  launchingNodeId: string | null;
  onReview: (nodeId: string) => void;
}) {
  return <details className={styles.record}>
    <summary>
      <span className={styles.recordTitle}>
        <strong>{item.node_label}</strong>
        <span>{item.step_description || "Review this practice step"}</span>
      </span>
      <span className={styles.recordMeta}>
        <time dateTime={item.logged_at}>{recordDate(item.logged_at)}</time>
        <span>Review <ChevronDown size={15} aria-hidden="true" /></span>
      </span>
    </summary>
    <div className={styles.recordBody}>
      <div className={styles.recordContext}>
        <span className={styles.badge} data-status={status}>Current: {STATUS_LABELS[status]}</span>
      </div>
      <h4>What to revisit</h4>
      <p>{item.step_description || "Return to this competency for a refresher."}</p>
      <div className={styles.guidance}>
        <h4>Suri&apos;s recovery note</h4>
        <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
          {REVIEW_TIPS[item.node_id] || "Review variables, factors, and coordinate signs related to this section."}
        </ReactMarkdown>
      </div>
      <button type="button" className={styles.primaryButton} disabled={launchingNodeId !== null} onClick={() => onReview(item.node_id)}>
        {launchingNodeId === item.node_id ? "Opening…" : "Review lesson"}
        <ArrowUpRight size={16} aria-hidden="true" />
      </button>
    </div>
  </details>;
}
