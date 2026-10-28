import { createSession, skipDiagnostic } from "./api";

/** Shared study/review workflow, including a session created in another tab. */
export async function openLesson(nodeId: string, sessions: { id: string; topic_entry_node: string }[]) {
  const active = sessions.find(session => session.topic_entry_node === nodeId);
  if (active) return `/session/${active.id}/lesson`;
  let session;
  try {
    session = await createSession({ topic_entry_node: nodeId });
  } catch (error: unknown) {
    if (typeof error === "object" && error !== null && "status" in error && error.status === 409 && "detail" in error) {
      const detail = error.detail as { session_id?: string } | null;
      if (detail?.session_id) return `/session/${detail.session_id}/lesson`;
    }
    throw error;
  }
  await skipDiagnostic(session.id);
  return `/session/${session.id}/lesson`;
}
