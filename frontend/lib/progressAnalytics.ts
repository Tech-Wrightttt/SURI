import type { MisconceptionHistoryItem } from "./api";
import type { ChainNode, LearningData, NodeStatus } from "./learningData";

export const STATUS_LABELS: Record<NodeStatus, string> = {
  mastered: "Mastered",
  in_progress: "In progress",
  unresolved: "Needs work",
  not_attempted: "Not attempted",
};

export type ProgressConcept = {
  node: ChainNode;
  topicId: string;
  topicLabel: string;
  topicMastery: number;
  priorNodeIds: string[];
  previousLabel: string | null;
  status: NodeStatus;
  canOpen: boolean;
};

// Preserve the original first-path order and prerequisite gate while counting
// a shared competency only once in the curriculum and grade summaries.
export function buildProgressAnalytics(data: Pick<LearningData, "topics" | "chains" | "statuses">) {
  const seen = new Set<string>();
  const concepts: ProgressConcept[] = [];
  const topics = data.topics.map(topic => {
    const chain = [...(data.chains[topic.node_id] ?? [])].reverse();
    const mastered = chain.filter(node => data.statuses[node.node_id] === "mastered").length;
    const mastery = chain.length ? Math.round(mastered / chain.length * 100) : 0;
    chain.forEach((node, index) => {
      if (seen.has(node.node_id)) return;
      seen.add(node.node_id);
      const priorNodeIds = chain.slice(0, index).map(prior => prior.node_id);
      const status = data.statuses[node.node_id] ?? "not_attempted";
      concepts.push({
        node, topicId: topic.node_id, topicLabel: topic.label, topicMastery: mastery,
        priorNodeIds, previousLabel: index ? chain[index - 1].node_label : null,
        status, canOpen: status === "mastered" || priorNodeIds.every(id => data.statuses[id] === "mastered"),
      });
    });
    return { ...topic, mastered, total: chain.length, mastery, nodeIds: new Set(chain.map(node => node.node_id)) };
  });
  const counts: Record<NodeStatus, number> = { mastered: 0, in_progress: 0, unresolved: 0, not_attempted: 0 };
  concepts.forEach(concept => { counts[concept.status]++; });
  const grades = [...new Set(concepts.map(concept => concept.node.grade))].sort((a, b) => a - b);
  return { concepts, topics, counts, grades, total: concepts.length, mastery: concepts.length ? Math.round(counts.mastered / concepts.length * 100) : 0 };
}

export function filterMistakes(items: MisconceptionHistoryItem[], nodeId: string, search: string, order: string) {
  const query = search.trim().toLowerCase();
  return items.filter(item => (!nodeId || item.node_id === nodeId) &&
    (!query || `${item.node_label} ${item.node_id} ${item.step_description}`.toLowerCase().includes(query)))
    .sort((a, b) => {
      const difference = (Date.parse(b.logged_at) || 0) - (Date.parse(a.logged_at) || 0);
      return order === "oldest" ? -difference : difference;
    });
}

export function mistakeFrequency(items: MisconceptionHistoryItem[]) {
  const groups = new Map<string, { nodeId: string; label: string; count: number }>();
  items.forEach(item => {
    const group = groups.get(item.node_id) ?? { nodeId: item.node_id, label: item.node_label, count: 0 };
    group.count++;
    groups.set(item.node_id, group);
  });
  return [...groups.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}
