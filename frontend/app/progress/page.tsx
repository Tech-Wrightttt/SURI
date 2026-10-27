"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpRight, BookOpen, CheckCircle2, ChevronDown, Circle, Lock, Play, Search, ShieldAlert } from "lucide-react";
import MainPage from "@/components/mainpage";
import BackToTopButton from "@/components/navigation/BackToTopButton";
import { useLearningData, useWorldNavigation } from "@/components/navigation/LearningShell";
import RecentMistakes from "@/components/progress/RecentMistakes";
import { ensureLearningData, type NodeStatus } from "@/lib/learningData";
import { buildProgressAnalytics, STATUS_LABELS } from "@/lib/progressAnalytics";
import { openLesson } from "@/lib/openLesson";
import styles from "./progress.module.css";

const EMPTY_DATA = { topics: [], chains: {}, statuses: {} };

export default function ProgressPage() {
  const router = useRouter();
  const { navigate } = useWorldNavigation();
  const { data, error: loadError } = useLearningData();
  const [launchingNodeId, setLaunchingNodeId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [gradeFilter, setGradeFilter] = useState("");
  const [topicFilter, setTopicFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const errorRef = useRef<HTMLDivElement>(null);
  const alignedReviewLink = useRef(false);

  const analytics = useMemo(() => buildProgressAnalytics(data ?? EMPTY_DATA), [data]);
  const activeSessions = data?.progress.active_sessions ?? [];
  const loading = !data?.curriculumReady && !loadError;
  const coreLoading = !data && !loadError;
  const error = actionError ?? loadError?.message;
  const curriculumReady = Boolean(data?.curriculumReady);
  useEffect(() => {
    // Position contextual review links after the learning data is available.
    // Align it once the final layout is available, without jumping on refresh.
    if (loading || !data || alignedReviewLink.current || window.location.hash !== "#error-history") return;
    const frame = window.requestAnimationFrame(() => {
      document.getElementById("error-history")?.scrollIntoView({ block: "start" });
      alignedReviewLink.current = true;
    });
    return () => window.cancelAnimationFrame(frame);
  }, [loading, data]);
  const selectedTopic = analytics.topics.find(topic => topic.node_id === topicFilter);
  const filtered = analytics.concepts.filter(({ node, status }) =>
    (!gradeFilter || node.grade === Number(gradeFilter)) &&
    (!selectedTopic || selectedTopic.nodeIds.has(node.node_id)) &&
    (!statusFilter || status === statusFilter) &&
    `${node.node_label} ${node.node_id}`.toLowerCase().includes(search.trim().toLowerCase()));
  const filteredGrades = analytics.grades.filter(grade => filtered.some(concept => concept.node.grade === grade));

  const handleStudyNode = async (nodeId: string) => {
    if (launchingNodeId) return;
    setLaunchingNodeId(nodeId);
    setActionError(null);
    try { router.push(await openLesson(nodeId, activeSessions)); }
    catch {
      setActionError("Could not open the lesson. Please try again.");
      window.requestAnimationFrame(() => errorRef.current?.focus());
    }
    finally { setLaunchingNodeId(null); }
  };
  const refresh = async () => {
    setRefreshing(true);
    setActionError(null);
    try { await ensureLearningData({ curriculum: true, force: true }); }
    catch { /* The shared store exposes the fetch error. */ }
    finally { setRefreshing(false); }
  };
  const resetFilters = () => { setGradeFilter(""); setTopicFilter(""); setStatusFilter(""); setSearch(""); };
  const displayCount = (value: number, pending = !curriculumReady) => pending || (!data && loadError) ? "--" : String(value).padStart(2, "0");

  return <MainPage immersive>
    <div className={`progress-library-page ${styles.page}`}>
      <div className="progress-library-back-row">
        <button type="button" className="topics-library-back" onClick={() => navigate("/dashboard")} aria-label="Return to dashboard"><span aria-hidden="true">←</span> Go back</button>
      </div>
      <header className="progress-library-header">
        <div className="progress-library-kicker"><span /> SURI&apos;S MASTERY ARCHIVE <span /></div>
        <h1>Your <em>Mastery Trail</em></h1>
        <p>See the concepts you&apos;ve mastered from Grade 6 through Grade 10, and continue from the next skill on your path.</p>
        <div className={`progress-library-stats ${styles.headerStats}`} aria-label="Progress overview">
          {(Object.entries(STATUS_LABELS) as [NodeStatus, string][]).map(([status, label]) => <div key={status}>
            <b>{displayCount(analytics.counts[status])}</b><span>{label}</span>
          </div>)}
          <div><b>{displayCount(activeSessions.length, coreLoading)}</b><span>Quests active</span></div>
        </div>
      </header>

      <div className={styles.dashboard}>
        {error && <div ref={errorRef} className={styles.error} role="alert" tabIndex={-1}>
          <div><strong>{actionError ? "Lesson unavailable" : "Could not refresh your progress"}</strong><p>{error}{data ? " Your last loaded data is still shown." : ""}</p></div>
          {actionError
            ? <button type="button" className={styles.textButton} onClick={() => setActionError(null)}>Dismiss</button>
            : <button type="button" className={styles.textButton} disabled={refreshing} onClick={refresh}>Try again</button>}
        </div>}

        <div id="overview" className={styles.overview}>
          <section className={styles.mastery} aria-labelledby="mastery-heading">
            <header><span className={styles.eyebrow}>THE BIG PICTURE</span><h2 id="mastery-heading">Curriculum mastery</h2></header>
            {curriculumReady ? <div className={styles.masteryVisual}>
              <div className={styles.masteryRing} style={{ "--mastery-angle": `${analytics.mastery * 3.6}deg` } as CSSProperties}
                role="progressbar" aria-label="Overall curriculum mastery" aria-valuemin={0} aria-valuemax={100} aria-valuenow={analytics.mastery}>
                <div><strong>{analytics.mastery}<span>%</span></strong><span>{analytics.total} total skills</span></div>
              </div>
              <ul className={styles.legend}>
                {(Object.entries(STATUS_LABELS) as [NodeStatus, string][]).map(([status, label]) => <li key={status}>
                  <i data-status={status} aria-hidden="true" /><span>{label}</span>
                </li>)}
              </ul>
            </div> : <p className={styles.empty} role="status">{loading ? "Loading curriculum mastery…" : "Curriculum mastery is unavailable. Try refreshing your data."}</p>}
          </section>

          {data ? <RecentMistakes key={`${data.me.student_id}:${JSON.stringify(data.progress.misconception_history)}`}
            items={data.progress.misconception_history} studentId={data.me.student_id}
            initialNextOffset={data.progress.misconception_next_offset} statuses={data.statuses}
            launchingNodeId={launchingNodeId} onReview={handleStudyNode} />
            : <section id="error-history" className={styles.recentReview} aria-labelledby="recent-review-heading">
              <span className={styles.eyebrow}>RECENT MISTAKES</span><h2 id="recent-review-heading">Reflect &amp; review</h2>
              <p className={styles.empty} role="status">{coreLoading ? "Loading your recent mistakes…" : "Mistake history could not be loaded. Try refreshing your data."}</p>
            </section>}
        </div>

        <div id="competencies" className={styles.competencies}>
          <section className={styles.filterPanel} aria-labelledby="competency-heading">
            <div className={styles.sectionHeading}>
              <h2 id="competency-heading">Find a lesson</h2>
              <div className={styles.filterActions}>
                {(gradeFilter || topicFilter || statusFilter || search) && <button type="button" className={styles.textButton} onClick={resetFilters}>Reset filters</button>}
                <button type="button" className={styles.textButton} onClick={refresh} disabled={refreshing}>{refreshing ? "Refreshing…" : "Refresh data"}</button>
              </div>
            </div>
            {curriculumReady && analytics.total > 0 && <>
              <div className={styles.filters}>
                <label className={styles.search}><span>Search competencies</span><div><Search size={18} aria-hidden="true" /><input type="search" placeholder="Find a skill…" value={search} onChange={event => setSearch(event.target.value)} /></div></label>
                <label><span>Grade</span><select aria-label="Grade" value={gradeFilter} onChange={event => setGradeFilter(event.target.value)}><option value="">All grades</option>{analytics.grades.map(grade => <option key={grade} value={grade}>Grade {grade}</option>)}</select></label>
                <label><span>Topic</span><select aria-label="Topic" value={topicFilter} onChange={event => setTopicFilter(event.target.value)}><option value="">All topics</option>{analytics.topics.map(topic => <option key={topic.node_id} value={topic.node_id}>{topic.label}</option>)}</select></label>
                <label><span>Status</span><select aria-label="Status" value={statusFilter} onChange={event => setStatusFilter(event.target.value)}><option value="">All statuses</option>{Object.entries(STATUS_LABELS).map(([status, label]) => <option key={status} value={status}>{label}</option>)}</select></label>
              </div>
              <span className="sr-only" role="status">{filtered.length} matching lessons</span>
            </>}
            {!curriculumReady && <p className={styles.empty} role="status">{loading ? "Reading your learning path…" : "The curriculum could not be loaded. Your mistake records are still available above."}</p>}
            {curriculumReady && analytics.total === 0 && <div className={styles.empty}><strong>No competencies available yet.</strong><button type="button" className={styles.textButton} onClick={refresh}>Refresh data</button></div>}
            {curriculumReady && analytics.total > 0 && filtered.length === 0 && <div className={styles.empty}><strong>No matching competencies.</strong><button type="button" className={styles.textButton} onClick={resetFilters}>Show all competencies</button></div>}
          </section>

          {filteredGrades.map(grade => {
            const gradeConcepts = analytics.concepts.filter(concept => concept.node.grade === grade);
            const gradeMastered = gradeConcepts.filter(concept => concept.status === "mastered").length;
            const gradeMastery = Math.round(gradeMastered / gradeConcepts.length * 100);
            return <details key={grade} className={styles.grade} open>
              <summary>
                <span className={styles.gradeNumber} aria-hidden="true">{grade}</span>
                <h3>Grade {grade}</h3>
                <div className={styles.gradeTrack} role="progressbar" aria-label={`Grade ${grade} mastery`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={gradeMastery}><i style={{ width: `${gradeMastery}%` }} /></div>
                <b>{gradeMastery}%</b><ChevronDown size={20} aria-hidden="true" />
              </summary>
              <ul className={styles.conceptList}>
                {filtered.filter(concept => concept.node.grade === grade).map(concept => {
                  const topicMastery = selectedTopic?.mastery ?? concept.topicMastery;
                  const StatusIcon = concept.status === "mastered" ? CheckCircle2 : concept.status === "unresolved" ? ShieldAlert : concept.status === "in_progress" ? Play : Circle;
                  return <li key={concept.node.node_id}>
                    <header className={styles.conceptHeading}>
                      <span className={styles.conceptEmblem} data-status={concept.status}><BookOpen size={24} aria-hidden="true" /></span>
                      <h4>{concept.node.node_label}</h4>
                    </header>
                    {!concept.canOpen && concept.previousLabel && <p className={styles.prerequisite}>
                      <Lock size={17} aria-hidden="true" />
                      <span>Requires <strong>{concept.previousLabel}</strong></span>
                    </p>}
                    <div className={styles.topicMastery}>
                      <div><span>Topic mastery</span><b>{topicMastery}%</b></div>
                      <div className={styles.topicTrack} role="progressbar" aria-label={`Topic mastery for ${concept.node.node_label}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={topicMastery}><i style={{ width: `${topicMastery}%` }} /></div>
                    </div>
                    <div className={styles.conceptFooter}>
                      <span className={styles.skillStatus} data-status={concept.status}><StatusIcon size={23} aria-hidden="true" />{STATUS_LABELS[concept.status]}</span>
                      <button type="button" className={styles.studyButton} disabled={!concept.canOpen || launchingNodeId !== null} onClick={() => handleStudyNode(concept.node.node_id)} aria-label={`${concept.canOpen ? concept.status === "mastered" ? "Review" : "Study" : "Locked:"} ${concept.node.node_label}`}>
                        {!concept.canOpen ? <Lock size={22} aria-hidden="true" /> : <BookOpen size={22} aria-hidden="true" />}
                        {launchingNodeId === concept.node.node_id ? "Opening…" : !concept.canOpen ? "Locked" : concept.status === "mastered" ? "Review" : "Study"}
                        {concept.canOpen && <ArrowUpRight size={20} aria-hidden="true" />}
                      </button>
                    </div>
                  </li>;
                })}
              </ul>
            </details>;
          })}
        </div>
      </div>
      <div className={styles.backToTop}><BackToTopButton className="topics-library-back" /></div>
    </div>
  </MainPage>;
}
