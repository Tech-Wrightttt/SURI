"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import MainPage from "@/components/mainpage";
import DashboardWorld from "@/components/WorldMap/KingdomWorld";
import { ActiveSessionProgress, getMe, getStudentProgress, MisconceptionHistoryItem } from "../../lib/api";

export default function DashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<ActiveSessionProgress[]>([]);
  const [completed, setCompleted] = useState<ActiveSessionProgress[]>([]);
  const [errors, setErrors] = useState<MisconceptionHistoryItem[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  useEffect(() => {
    const load = async () => {
      try {
        const me = await getMe();
        const result = await getStudentProgress(me.student_id);
        setActive(result.active_sessions || []);
        setCompleted(result.completed_sessions || []);
        setErrors(result.misconception_history || []);
      } catch (error: unknown) {
        const status = error && typeof error === "object" && "status" in error ? (error as { status: number }).status : 0;
        if (status === 401) { router.replace("/login"); return; }
        setErrorMsg(error instanceof Error ? error.message : "Failed to load dashboard.");
      } finally { setLoading(false); }
    };
    load();
  }, [router]);
  const stats = useMemo(() => {
    const mastered = active.reduce((sum, session) => sum + session.mastered_count, 0);
    const total = active.reduce((sum, session) => sum + session.total_in_chain, 0);
    const pct = active.length > 0 ? Math.round(active.reduce((sum, session) => sum + (Number(session.completion_percentage) || 0), 0) / active.length) : 0;
    const dewdrops = mastered * 10 + completed.length * 50;
    const rank = dewdrops >= 1000 ? "Elder Canopy Sage" : dewdrops >= 600 ? "Wildwood Ranger" : dewdrops >= 300 ? "Dewdrop Pathfinder" : dewdrops >= 100 ? "Fern Scout" : "Sprout Explorer";
    return { mastered, total, pct, dewdrops, rank };
  }, [active, completed]);
  return (
    <MainPage immersive>
      {loading ? <div className="world-loading"><div className="world-loader" /><span>Raising the skybound realm…</span></div> : <DashboardWorld active={active} errors={errors} progress={stats} />}
      {errorMsg && <div className="world-error">{errorMsg}</div>}
    </MainPage>
  );
}
