"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Activity, BookOpenCheck, Castle, CircleUserRound, Clock3, GraduationCap, Sparkles, Target, X } from "lucide-react";
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

const DATE_FORMATTER = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" });
const DATE_TIME_FORMATTER = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });

const formatDate = (value?: string, includeTime = false) => {
  if (!value) return "Not available";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not available";
  return (includeTime ? DATE_TIME_FORMATTER : DATE_FORMATTER).format(date);
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
    .slice(0, 5);
}

export default function StudentOverviewModal({ me, active = [], completed = [], errors = [], progress, opener, onClose }: StudentOverviewModalProps) {
  const [closing, setClosing] = useState(false);
  const [mobilePane, setMobilePane] = useState<"learning" | "account">("learning");
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
    document.body.classList.add("suri-overview-open");
    const focusFrame = window.requestAnimationFrame(() => closeButtonRef.current?.focus());
    return () => {
      window.cancelAnimationFrame(focusFrame);
      if (closeTimerRef.current !== null) window.clearTimeout(closeTimerRef.current);
      document.body.style.overflow = previousOverflow;
      document.body.classList.remove("suri-overview-open");
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
  const sessions = useMemo(() => [...active, ...completed], [active, completed]);
  const latestSession = useMemo(() => sessions.reduce<ActiveSessionProgress | undefined>((latest, session) =>
    !latest || new Date(session.last_active_at).getTime() > new Date(latest.last_active_at).getTime() ? session : latest
  , undefined), [sessions]);
  const groupedErrors = useMemo(() => groupRecentErrors(errors), [errors]);
  const masteredNodeIds = useMemo(() => new Set(
    sessions.flatMap((session) => session.mastered_nodes.map((node) => node.node_id)),
  ), [sessions]);
  const unresolvedNodeIds = useMemo(() => new Set(
    active.flatMap((session) => session.unresolved_nodes.map((node) => node.node_id)),
  ), [active]);
  const learningStatus = current?.unresolved_nodes.length ? "Remediation" : current ? "In Progress" : completed.length ? "Advance" : "Ready to begin";
  const nextAction = current?.unresolved_nodes[0]
    ? `Review ${current.unresolved_nodes[0].node_label}`
    : current ? `Continue ${current.current_node_label}` : "Choose a topic from the Learning Grove";
  const displayName = me?.name || "Student";
  const initials = displayName.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "S";
  const sessionCount = sessions.length;
  const reviewCount = active.reduce((sum, session) => sum + session.unresolved_nodes.length, 0);
  const recentActiveTopics = useMemo(() => [...active]
    .sort((a, b) => new Date(b.last_active_at).getTime() - new Date(a.last_active_at).getTime())
    .slice(0, 3), [active]);

  return createPortal(
    <div className={`suri-overview-overlay ${closing ? "is-closing" : ""}`} onMouseDown={(event) => {
      if (event.target === event.currentTarget) requestClose();
    }}>
      <div ref={dialogRef} className="suri-overview-modal" role="dialog" aria-modal="true" aria-labelledby="suri-overview-title" aria-describedby="suri-overview-subtitle" onMouseDown={(event) => event.stopPropagation()}>
        <header className="suri-overview-header">
          <div className="suri-overview-heading">
            <span className="suri-overview-castle" aria-hidden="true"><Castle size={25} strokeWidth={2.5} /></span>
            <div>
              <span className="suri-overview-eyebrow">SURI Keep · Student overview</span>
              <h2 id="suri-overview-title">Your learning journey</h2>
              <p id="suri-overview-subtitle">Progress, priorities, and account details in one place.</p>
            </div>
          </div>
          <button ref={closeButtonRef} type="button" className="suri-overview-close" onClick={requestClose} aria-label="Close progress overview"><X size={21} strokeWidth={2.5} /></button>
        </header>

        <div className="suri-overview-scroll">
          <div className="suri-overview-mobile-tabs" role="tablist" aria-label="Progress overview sections">
            <button id="suri-overview-learning-tab" type="button" role="tab" aria-selected={mobilePane === "learning"} aria-controls="suri-overview-learning-panel" className={mobilePane === "learning" ? "is-active" : ""} onClick={() => setMobilePane("learning")}><Target size={15} /> Learning</button>
            <button id="suri-overview-account-tab" type="button" role="tab" aria-selected={mobilePane === "account"} aria-controls="suri-overview-account-panel" className={mobilePane === "account" ? "is-active" : ""} onClick={() => setMobilePane("account")}><CircleUserRound size={15} /> Account</button>
          </div>
          <div className="suri-overview-columns">
            <section id="suri-overview-learning-panel" className={`suri-overview-learning ${mobilePane === "learning" ? "is-mobile-active" : ""}`} role="tabpanel" aria-labelledby="suri-overview-learning-tab">
              <article className="suri-progress-summary">
                <div className="suri-progress-summary-top">
                  <div className="suri-progress-copy">
                    <span className="suri-card-kicker"><Target size={14} /> Progress overview</span>
                    <div><strong>{progress.pct}%</strong><span>complete</span></div>
                    <p>{progress.mastered} of {progress.total || 0} competencies mastered across {sessionCount} {sessionCount === 1 ? "topic" : "topics"}.</p>
                  </div>
                </div>
                <div className="suri-progress-track" role="progressbar" aria-label="Overall learning completion" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress.pct}>
                  <span style={{ width: `${Math.min(100, Math.max(0, progress.pct))}%` }} />
                </div>

                <div className="suri-progress-focus-grid">
                  <div className="suri-progress-focus-item">
                    <span aria-hidden="true"><GraduationCap size={18} /></span>
                    <div><small>Current competency</small><strong>{current?.current_node_label || "Choose your next lesson"}</strong></div>
                  </div>
                  <div className="suri-progress-focus-item">
                    <span aria-hidden="true"><BookOpenCheck size={18} /></span>
                    <div><small>Recommended action</small><strong>{nextAction}</strong></div>
                    <span className={`suri-learning-status is-${learningStatus.toLowerCase().replaceAll(" ", "-")}`}>{learningStatus}</span>
                  </div>
                </div>
              </article>

              <section className="suri-recent-errors" aria-labelledby="suri-recent-errors-heading">
                <div className="suri-overview-subheading"><div><span>Learning insights</span><h3 id="suri-recent-errors-heading">Review queue</h3></div><small>{groupedErrors.length} recent</small></div>
                {groupedErrors.length ? <ol className="suri-error-list">
                  {groupedErrors.map((item) => {
                    const status = masteredNodeIds.has(item.node_id) ? "Resolved" : unresolvedNodeIds.has(item.node_id) ? "Needs Review" : "Improving";
                    return <li key={`${item.node_id}:${item.step_description}`} className="suri-error-item">
                      <div className="suri-error-item-head"><div><span>{item.node_id}</span><h5>{item.node_label}</h5></div><span className={`suri-error-status is-${status.toLowerCase().replace(" ", "-")}`}>{status}</span></div>
                      <p>{item.step_description}</p>
                      <div className="suri-error-meta">{item.count > 1 && <span>{item.count} occurrences</span>}<span><Clock3 size={13} /> {formatDate(item.logged_at, true)}</span></div>
                    </li>;
                  })}
                </ol> : <div className="suri-overview-empty"><Sparkles size={20} /><div><strong>No recent misconceptions</strong><p>Your review queue is clear. Keep following your learning trail.</p></div></div>}
              </section>
            </section>

            <aside id="suri-overview-account-panel" className={`suri-overview-account ${mobilePane === "account" ? "is-mobile-active" : ""}`} role="tabpanel" aria-labelledby="suri-overview-account-tab">
              <div className="suri-profile-card">
                <span className="suri-profile-avatar" aria-hidden="true">{initials}</span>
                <div><span className="suri-card-kicker"><CircleUserRound size={13} /> Student profile</span><strong id="suri-account-heading">{displayName}</strong><span>{me?.grade_level ? `Grade ${me.grade_level}` : "Grade level not available"}</span><small><Clock3 size={13} /> Last session {formatDate(latestSession?.last_active_at, true)}</small></div>
              </div>

              <section className="suri-learning-stats" aria-labelledby="suri-learning-stats-heading">
                <div className="suri-overview-subheading"><div><span>At a glance</span><h3 id="suri-learning-stats-heading">Learning totals</h3></div></div>
                <div className="suri-stat-grid">
                  <div><strong>{completed.length}</strong><span>Topics completed</span></div>
                  <div><strong>{reviewCount}</strong><span>Skills to review</span></div>
                </div>
              </section>

              <section className="suri-active-topics" aria-labelledby="suri-active-topics-heading">
                <div className="suri-overview-subheading"><div><span>In progress</span><h3 id="suri-active-topics-heading">Active topics</h3></div><small>{recentActiveTopics.length} recent</small></div>
                {recentActiveTopics.length ? <div className="suri-active-topic-list">
                  {recentActiveTopics.map((session) => {
                    const topicPct = Math.min(100, Math.max(0, Math.round(Number(session.completion_percentage) || 0)));
                    return <div className="suri-active-topic-item" key={session.id}>
                      <div className="suri-topic-progress-label"><strong>{session.topic_label}</strong><b>{topicPct}%</b></div>
                      <div className="suri-topic-track" role="progressbar" aria-label={`${session.topic_label} completion`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={topicPct}><span style={{ width: `${topicPct}%` }} /></div>
                    </div>;
                  })}
                </div> : <div className="suri-active-topics-empty"><Activity size={17} /><span>No active topics right now.</span></div>}
              </section>
            </aside>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
