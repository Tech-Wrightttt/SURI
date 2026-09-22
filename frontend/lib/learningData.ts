import { getMe, getTopics, getStudentProgress, getGraphChain, type MeResponse, type StudentProgress, type TopicInfo } from "./api";

export type NodeStatus = "mastered" | "in_progress" | "unresolved" | "not_attempted";
export type ChainNode = { node_id: string; node_label: string; grade: number };
export type LearningData = {
  me: MeResponse;
  topics: TopicInfo[];
  progress: StudentProgress;
  chains: Record<string, ChainNode[]>;
  statuses: Record<string, NodeStatus>;
};
type Snapshot = { data: LearningData | null; error: Error | null; updatedAt: number };
const empty: Snapshot = { data: null, error: null, updatedAt: 0 };
let snapshot = empty;
let pending: Promise<LearningData> | null = null;
let generation = 0;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach(listener => listener());
export const subscribeLearningData = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
export const getLearningSnapshot = () => snapshot;
export const getServerLearningSnapshot = () => empty;
export function clearLearningData() {
  generation++; pending = null; snapshot = empty; emit();
}
export function staleLearningData() {
  snapshot = { ...snapshot, updatedAt: 0 }; emit();
}
export function ensureLearningData(force = false): Promise<LearningData> {
  if (pending) return pending;
  if (!force && snapshot.data && Date.now() - snapshot.updatedAt < 30_000) return Promise.resolve(snapshot.data);
  const version = generation;
  const work = (async () => {
    const [me, topics] = await Promise.all([getMe(), getTopics()]);
    if (snapshot.data && snapshot.data.me.student_id !== me.student_id) {
      snapshot = empty; emit();
    }
    const old = snapshot.data;
    const [progress, chainEntries] = await Promise.all([
      getStudentProgress(me.student_id),
      Promise.all(topics.map(async topic => [topic.node_id, old?.chains[topic.node_id] ?? (await getGraphChain(topic.node_id)).chain] as const)),
    ]);
    const statuses: Record<string, NodeStatus> = {};
    for (const session of [...progress.active_sessions, ...progress.completed_sessions]) {
      for (const node of session.unresolved_nodes || []) if (!statuses[node.node_id]) statuses[node.node_id] = "unresolved";
      for (const node of session.in_progress_nodes || []) if (statuses[node.node_id] !== "mastered") statuses[node.node_id] = "in_progress";
      for (const node of session.mastered_nodes || []) statuses[node.node_id] = "mastered";
    }
    const data = { me, topics, progress, chains: Object.fromEntries(chainEntries), statuses };
    if (version === generation) { snapshot = { data, error: null, updatedAt: Date.now() }; emit(); }
    return data;
  })();
  pending = work;
  void work.catch(error => {
    if (version === generation) { snapshot = { ...snapshot, error: error instanceof Error ? error : new Error("Could not refresh your learning data.") }; emit(); }
  }).finally(() => { if (pending === work) pending = null; });
  return work;
}
