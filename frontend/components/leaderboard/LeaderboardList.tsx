"use client";

import { useEffect, useState } from "react";
import {
  getLeaderboard, getTopics,
  type LeaderboardEntry, type LeaderboardResponse, type TopicInfo,
} from "@/lib/api";
import styles from "./leaderboard.module.css";

const DEFAULT_LIMIT = 10;
const EXPANDED_LIMIT = 50;

function Row({ entry }: { entry: LeaderboardEntry }) {
  return (
    <li className={styles.row} data-me={entry.is_me} data-top={entry.rank <= 3}>
      <span className={styles.rank} aria-label={`Rank ${entry.rank}`}>{entry.rank}</span>
      <span className={styles.name}>
        {entry.name}{entry.is_me && <span className={styles.you}> (you)</span>}
      </span>
      <span className={styles.topics}>
        {entry.topics_done} {entry.topics_done === 1 ? "topic" : "topics"}
      </span>
      <span className={styles.points}>{entry.points.toLocaleString()} pts</span>
    </li>
  );
}

export default function LeaderboardList() {
  const [topics, setTopics] = useState<TopicInfo[]>([]);
  const [nodeId, setNodeId] = useState<string>(""); // "" = overall
  const [limit, setLimit] = useState<number>(DEFAULT_LIMIT);
  const [data, setData] = useState<LeaderboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Topic list: one request on mount. If it fails, the dropdown just shows "Overall".
  useEffect(() => {
    let cancelled = false;
    getTopics().then(t => { if (!cancelled) setTopics(t); }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  // Board: refetch whenever the topic or the limit changes.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getLeaderboard(limit, nodeId || undefined)
      .then(res => { if (!cancelled) setData(res); })
      .catch(() => { if (!cancelled) setError("The leaderboard could not be loaded. Please try again."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [limit, nodeId]);

  const changeTopic = (value: string) => {
    setData(null);
    setLimit(DEFAULT_LIMIT);
    setNodeId(value);
  };

  const entries = data?.entries ?? [];
  const me = data?.me ?? null;
  const meInList = entries.some(e => e.is_me);
  const canShowMore = limit === DEFAULT_LIMIT && (data?.total_ranked ?? 0) > entries.length;
  const canShowLess = limit === EXPANDED_LIMIT;
  const topicLabel = topics.find(t => t.node_id === nodeId)?.label;

  return (
    <section className={styles.card} aria-label="Quiz leaderboard">
      <div className={styles.banner} role="status">
        {me ? (
          <>
            <strong>Your rank: #{me.rank}</strong>
            <span>of {data?.total_ranked} ranked · {me.points.toLocaleString()} pts</span>
          </>
        ) : data ? (
          <strong>{nodeId ? "Take a quiz on this topic to get ranked." : "Take a quiz to get ranked."}</strong>
        ) : (
          <strong>Loading your rank…</strong>
        )}
      </div>

      <div className={styles.controls}>
        <label htmlFor="leaderboard-topic">Board</label>
        <select
          id="leaderboard-topic"
          className={styles.select}
          value={nodeId}
          onChange={e => changeTopic(e.target.value)}
        >
          <option value="">Overall (best score in each topic, added up)</option>
          {topics.map(t => (
            <option key={t.node_id} value={t.node_id}>{t.label}</option>
          ))}
        </select>
      </div>

      <div className={styles.panelHead}>
        <h2>{nodeId ? (topicLabel ?? "Topic") : "Overall"}</h2>
        {data && !error && <span className={styles.count}>{data.total_ranked} ranked</span>}
      </div>

      {loading && !data ? (
        <p className={styles.empty} role="status">Loading leaderboard…</p>
      ) : error ? (
        <p className={styles.error} role="alert">{error}</p>
      ) : entries.length === 0 ? (
        <div className={styles.empty}>
          <strong>No one is ranked yet.</strong>
          <p>Finish a quiz to be the first on the board.</p>
        </div>
      ) : (
        <>
          <ol className={styles.list} aria-busy={loading}>
            {entries.map(e => <Row key={`${e.rank}-${e.name}-${e.is_me}`} entry={e} />)}
          </ol>

          {me && !meInList && (
            <>
              <p className={styles.gap} aria-hidden="true">· · ·</p>
              <ol className={styles.list}><Row entry={me} /></ol>
            </>
          )}
        </>
      )}

      {(canShowMore || canShowLess) && !error && (
        <div className={styles.more}>
          <button
            type="button"
            disabled={loading}
            onClick={() => setLimit(canShowMore ? EXPANDED_LIMIT : DEFAULT_LIMIT)}
          >
            {loading ? "Loading…" : canShowMore ? "Show more (up to 50)" : "Show top 10 only"}
          </button>
        </div>
      )}
    </section>
  );
}
