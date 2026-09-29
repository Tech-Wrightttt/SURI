import { getMe, getStudentProgress, getTopicCatalog, type MeResponse, type StudentProgress, type TopicInfo } from "./api";

export type NodeStatus = "mastered" | "in_progress" | "unresolved" | "not_attempted";
export type ChainNode = { node_id: string; node_label: string; grade: number };
export type LearningData = {
  me: MeResponse;
  topics: TopicInfo[];
  progress: StudentProgress;
  chains: Record<string, ChainNode[]>;
  statuses: Record<string, NodeStatus>;
  curriculumReady: boolean;
};
type Snapshot = { data: LearningData | null; error: Error | null; coreUpdatedAt: number; curriculumUpdatedAt: number };
type LearningDataOptions = { curriculum?: boolean; force?: boolean };
const CACHE_TTL = 30_000;
const empty: Snapshot = { data: null, error: null, coreUpdatedAt: 0, curriculumUpdatedAt: 0 };
let snapshot = empty;
let pendingCore: Promise<LearningData> | null = null;
let pendingCurriculum: Promise<LearningData> | null = null;
let generation = 0;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach(listener => listener());
export const subscribeLearningData = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
export const getLearningSnapshot = () => snapshot;
export const getServerLearningSnapshot = () => empty;
export function clearLearningData() {
  generation++; pendingCore = null; pendingCurriculum = null; snapshot = empty; emit();
}
export function staleLearningData() {
  snapshot = { ...snapshot, coreUpdatedAt: 0 }; emit();
}

function buildStatuses(progress: StudentProgress): Record<string, NodeStatus> {
  const statuses: Record<string, NodeStatus> = {};
  for (const session of [...progress.active_sessions, ...progress.completed_sessions]) {
    for (const node of session.unresolved_nodes || []) if (!statuses[node.node_id]) statuses[node.node_id] = "unresolved";
    for (const node of session.in_progress_nodes || []) if (statuses[node.node_id] !== "mastered") statuses[node.node_id] = "in_progress";
    for (const node of session.mastered_nodes || []) statuses[node.node_id] = "mastered";
  }
  return statuses;
}

function ensureCoreLearningData(force = false): Promise<LearningData> {
  if (pendingCore) return pendingCore;
  if (!force && snapshot.data && Date.now() - snapshot.coreUpdatedAt < CACHE_TTL) return Promise.resolve(snapshot.data);
  const version = generation;
  const work = (async () => {
    const me = await getMe();
    if (snapshot.data && snapshot.data.me.student_id !== me.student_id) {
      snapshot = empty; emit();
    }
    const old = snapshot.data;
    const progress = await getStudentProgress(me.student_id);
    const data: LearningData = {
      me,
      progress,
      topics: old?.topics ?? [],
      chains: old?.chains ?? {},
      statuses: buildStatuses(progress),
      curriculumReady: old?.curriculumReady ?? false,
    };
    if (version === generation) {
      snapshot = { ...snapshot, data, error: null, coreUpdatedAt: Date.now() };
      emit();
    }
    return data;
  })();
  pendingCore = work;
  void work.catch(error => {
    if (version === generation) { snapshot = { ...snapshot, error: error instanceof Error ? error : new Error("Could not refresh your learning data.") }; emit(); }
  }).finally(() => { if (pendingCore === work) pendingCore = null; });
  return work;
}

async function ensureCurriculumData(force = false): Promise<LearningData> {
  const core = await ensureCoreLearningData(force);
  if (!force && core.curriculumReady && Date.now() - snapshot.curriculumUpdatedAt < CACHE_TTL) return core;
  if (pendingCurriculum) return pendingCurriculum;
  const version = generation;
  const work = (async () => {
    const catalog = await getTopicCatalog();
    const current = snapshot.data ?? core;
    const data: LearningData = { ...current, ...catalog, curriculumReady: true };
    if (version === generation) {
      snapshot = { ...snapshot, data, error: null, curriculumUpdatedAt: Date.now() };
      emit();
    }
    return data;
  })();
  pendingCurriculum = work;
  void work.catch(error => {
    if (version === generation) { snapshot = { ...snapshot, error: error instanceof Error ? error : new Error("Could not load the curriculum catalogue.") }; emit(); }
  }).finally(() => { if (pendingCurriculum === work) pendingCurriculum = null; });
  return work;
}

export function ensureLearningData(options: LearningDataOptions = {}): Promise<LearningData> {
  return options.curriculum
    ? ensureCurriculumData(options.force)
    : ensureCoreLearningData(options.force);
}
