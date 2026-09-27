"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { BookOpenCheck, Castle, CircleUserRound, Clock3, Sparkles, Target, X } from "lucide-react";
import type { ActiveSessionProgress, MeResponse, MisconceptionHistoryItem } from "@/lib/api";

type ProgressSummary = { mastered: number; total: number; pct: number };

type StudentOverviewModalProps = {
  me?: MeResponse;
  active?: ActiveSessionProgress[];
  completed?: ActiveSessionProgress[];
  errors?: MisconceptionHistoryItem[];
  progress: ProgressSummary;
  opener: HTMLElement | null;
  onClose: () => void;
};

type GroupedError = MisconceptionHistoryItem & { count: number };

const formatDate = (value?: string, includeTime = false) => {
  if (!value) return "Not available";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not available";
  return new Intl.DateTimeFormat("en-US", includeTime
    ? { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }
    : { month: "short", day: "numeric", year: "numeric" }).format(date);
};

function groupRecentErrors(errors: MisconceptionHistoryItem[]): GroupedError[] {
  const grouped = new Map<string, GroupedError>();
  for (const item of errors) {
    const key = `${item.node_id}:${item.step_description}`;
    const existing = grouped.get(key);
    if (existing) existing.count += 1;
    else grouped.set(key, { ...item, count: 1 });
  }
  return [...grouped.values()]
    .sort((a, b) => new Date(b.logged_at).getTime() - new Date(a.logged_at).getTime())
    .slice(0, 6);
}

export default function StudentOverviewModal({ me, active = [], completed = [], errors = [], progress, opener, onClose }: StudentOverviewModalProps) {
  const [closing, setClosing] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeTimerRef = useRef<number | null>(null);

  const requestClose = useCallback(() => {
    if (closing) return;
    setClosing(true);
    closeTimerRef.current = window.setTimeout(onClose, 180);
  }, [closing, onClose]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusFrame = window.requestAnimationFrame(() => closeButtonRef.current?.focus());
    return () => {
      window.cancelAnimationFrame(focusFrame);
      if (closeTimerRef.current !== null) window.clearTimeout(closeTimerRef.current);
      document.body.style.overflow = previousOverflow;
      opener?.focus();
    };
  }, [opener]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        requestClose();
        return;
      }
      if (event.key !== "Tab") return;
      const dialog = dialogRef.current;
      if (!dialog) return;
      const focusable = [...dialog.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      )].filter((element) => !element.hasAttribute("hidden"));
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [requestClose]);

  const current = active[0];
  const latestSession = [...active, ...completed].sort((a, b) =>
    new Date(b.last_active_at).getTime() - new Date(a.last_active_at).getTime())[0];
  const groupedErrors = useMemo(() => groupRecentErrors(errors), [errors]);
  const masteredNodeIds = useMemo(() => new Set(
    [...active, ...completed].flatMap((session) => session.mastered_nodes.map((node) => node.node_id)),
  ), [active, completed]);
  const unresolvedNodeIds = useMemo(() => new Set(
    active.flatMap((session) => session.unresolved_nodes.map((node) => node.node_id)),
  ), [active]);
  const learningStatus = current?.unresolved_nodes.length ? "Remediation" : current ? "In Progress" : completed.length ? "Advance" : "Ready to begin";
  const nextAction = current?.unresolved_nodes[0]
    ? `Review ${current.unresolved_nodes[0].node_label}`
    : current ? `Continue ${current.current_node_label}` : "Choose a topic from the Learning Grove";
  const displayName = me?.name || "Student";
  const initials = displayName.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "S";
  const sessionCount = active.length + completed.length;
  const practiceMilestones = [...active, ...completed].reduce((sum, session) => sum + session.practice_count, 0);

  return createPortal(
    <div className={`suri-overview-overlay ${closing ? "is-closing" : ""}`} onMouseDown={(event) => {
      if (event.target === event.currentTarget) requestClose();
    }}>
      <div ref={dialogRef} className="suri-overview-modal" role="dialog" aria-modal="true" aria-labelledby="suri-overview-title" aria-describedby="suri-overview-subtitle" onMouseDown={(event) => event.stopPropagation()}>
        <header className="suri-overview-header">
          <div className="suri-overview-heading">
            <span className="suri-overview-castle" aria-hidden="true"><Castle size={25} strokeWidth={2.5} /></span>
            <div>
              <h2 id="suri-overview-title">Your SURI Progress</h2>
              <p id="suri-overview-subtitle">A quick overview of your learning journey</p>
            </div>
          </div>
          <button ref={closeButtonRef} type="button" className="suri-overview-close" onClick={requestClose} aria-label="Close progress overview"><X size={21} strokeWidth={2.5} /></button>
        </header>

        <div className="suri-overview-scroll">
          <div className="suri-overview-columns">
            <section className="suri-overview-learning" aria-labelledby="suri-learning-heading">
              <h3 id="suri-learning-heading" className="suri-overview-section-title"><Target size={17} /> Learning Progress</h3>

              <article className="suri-progress-summary">
                <div className="suri-progress-summary-top">
                  <div><span>Overall completion</span><strong>{progress.pct}%</strong></div>
                  <span className="suri-progress-mastered"><Sparkles size={14} /> {progress.mastered} of {progress.total || 0} mastered</span>
                </div>
                <div className="suri-progress-track" role="progressbar" aria-label="Overall learning completion" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress.pct}>
                  <span style={{ width: `${Math.min(100, Math.max(0, progress.pct))}%` }} />
                </div>
                <dl className="suri-progress-summary-grid">
                  <div><dt>Current topic</dt><dd>{current?.topic_label || "No active topic"}</dd></div>
                  <div><dt>Current competency</dt><dd>{current?.current_node_label || "Choose your next lesson"}</dd></div>
                  <div><dt>Latest mastery score</dt><dd>{latestSession ? `${Math.round(Number(latestSession.completion_percentage) || 0)}%` : "Not available"}</dd></div>
                </dl>
              </article>

              <section className="suri-current-status" aria-labelledby="suri-current-status-heading">
                <div className="suri-overview-subheading"><div><span>Current Learning Status</span><h4 id="suri-current-status-heading">Where you are now</h4></div><span className={`suri-learning-status is-${learningStatus.toLowerCase().replaceAll(" ", "-")}`}>{learningStatus}</span></div>
                <dl className="suri-status-grid">
                  <div><dt>Topic</dt><dd>{current?.topic_label || "Not started"}</dd></div>
                  <div><dt>Competency node</dt><dd>{current?.current_node_label || "None selected"}</dd></div>
                  <div className="suri-status-next"><dt>Recommended next action</dt><dd><BookOpenCheck size={16} /> {nextAction}</dd></div>
                </dl>
              </section>

              <section className="suri-recent-errors" aria-labelledby="suri-recent-errors-heading">
                <div className="suri-overview-subheading"><div><span>Recent Errors &amp; Misconception History</span><h4 id="suri-recent-errors-heading">Review queue</h4></div><small>{groupedErrors.length} recent</small></div>
                {groupedErrors.length ? <ol className="suri-error-list">
                  {groupedErrors.map((item) => {
                    const status = masteredNodeIds.has(item.node_id) ? "Resolved" : unresolvedNodeIds.has(item.node_id) ? "Needs Review" : "Improving";
                    return <li key={`${item.node_id}:${item.step_description}`} className="suri-error-item">
                      <div className="suri-error-item-head"><div><span>{item.node_id}</span><h5>{item.node_label}</h5></div><span className={`suri-error-status is-${status.toLowerCase().replace(" ", "-")}`}>{status}</span></div>
                      <p>{item.step_description}</p>
                      <div className="suri-error-meta"><span>Step: {item.step_description}</span>{item.count > 1 && <span>{item.count} occurrences</span>}<span><Clock3 size={13} /> {formatDate(item.logged_at, true)}</span></div>
                    </li>;
                  })}
                </ol> : <div className="suri-overview-empty"><Sparkles size={20} /><div><strong>No recent misconceptions</strong><p>Your review queue is clear. Keep following your learning trail.</p></div></div>}
              </section>
            </section>

            <aside className="suri-overview-account" aria-labelledby="suri-account-heading">
              <h3 id="suri-account-heading" className="suri-overview-section-title"><CircleUserRound size={17} /> Student Account</h3>
              <div className="suri-profile-card">
                <span className="suri-profile-avatar" aria-hidden="true">{initials}</span>
                <div><strong>{displayName}</strong><span>{me?.grade_level ? `Grade ${me.grade_level}` : "Grade level not available"}</span></div>
              </div>

              <section className="suri-account-details" aria-labelledby="suri-account-details-heading">
                <h4 id="suri-account-details-heading">Account Details</h4>
                <dl>
                  <div><dt>Name</dt><dd>{displayName}</dd></div>
                  <div><dt>Grade level</dt><dd>{me?.grade_level ? `Grade ${me.grade_level}` : "Not available"}</dd></div>
                  <div><dt>Account created</dt><dd>{formatDate(me?.created_at)}</dd></div>
                  <div><dt>Last learning session</dt><dd>{formatDate(latestSession?.last_active_at, true)}</dd></div>
                  <div><dt>Active topic</dt><dd>{current?.topic_label || "None right now"}</dd></div>
                </dl>
              </section>

              <section className="suri-learning-stats" aria-labelledby="suri-learning-stats-heading">
                <h4 id="suri-learning-stats-heading">Learning Statistics</h4>
                <div className="suri-stat-grid">
                  <div><strong>{completed.length}</strong><span>Topics completed</span></div>
                  <div><strong>{progress.mastered}</strong><span>Competencies mastered</span></div>
                  <div><strong>{practiceMilestones}</strong><span>Practice milestones</span></div>
                  <div><strong>{sessionCount}</strong><span>Total learning sessions</span></div>
                </div>
              </section>
            </aside>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
