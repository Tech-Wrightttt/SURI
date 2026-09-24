"use client";

import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import dynamic from "next/dynamic";
import { usePathname, useRouter } from "next/navigation";
import { clearLearningData, ensureLearningData, getLearningSnapshot, getServerLearningSnapshot, staleLearningData, subscribeLearningData } from "@/lib/learningData";
import { ISLAND_ROUTES, type CameraCommand, type IslandRoute } from "@/lib/worldMap/navigation";

const loadWorld = () => import("@/components/WorldMap/KingdomWorld");
const loadTopicsWorld = () => import("@/components/WorldMap/TopicsLibraryWorld");
const loadProgressWorld = () => import("@/components/WorldMap/ProgressTrailWorld");
const DashboardWorld = dynamic(loadWorld, { ssr: false });
const TopicsLibraryWorld = dynamic(loadTopicsWorld, { ssr: false });
const ProgressTrailWorld = dynamic(loadProgressWorld, { ssr: false });
const managedRoutes = ["/dashboard", ...Object.keys(ISLAND_ROUTES)];
const NavigationContext = createContext<{
  navigate: (href: string) => void; busy: boolean; error: string | null; clearSession: () => void;
}>({ navigate: () => {}, busy: false, error: null, clearSession: () => {} });
export const useWorldNavigation = () => useContext(NavigationContext);
export function useLearningData() {
  return useSyncExternalStore(subscribeLearningData, getLearningSnapshot, getServerLearningSnapshot);
}

export default function LearningShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const overview = pathname === "/dashboard";
  const managed = managedRoutes.includes(pathname);
  const { data, error: dataError } = useLearningData();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [command, setCommand] = useState<CameraCommand | null>(null);
  // Keep a scene alive once it has been opened. Reusing its renderer, compiled
  // shaders, instanced meshes, and procedural geometry makes a return trip
  // immediate instead of rebuilding a second WebGL context on every route.
  const [dashboardWorldMounted, setDashboardWorldMounted] = useState(overview);
  const [topicsWorldMounted, setTopicsWorldMounted] = useState(pathname === "/topics");
  const [progressWorldMounted, setProgressWorldMounted] = useState(pathname === "/progress");
  const locked = useRef(false);
  const serial = useRef(0);
  const previous = useRef(pathname);
  const transaction = useRef(0);
  const pendingRoute = useRef<string | null>(null);
  const unlock = useCallback(() => { locked.current=false; setBusy(false); }, []);
  const clearSession = useCallback(() => {
    transaction.current++; clearLearningData(); setCommand(null); pendingRoute.current=null; unlock();
  }, [unlock]);

  useEffect(() => {
    if (!managed) return;
    managedRoutes.forEach(href => router.prefetch(href));
    void ensureLearningData().catch(() => {});
  }, [managed, pathname, router]);

  useEffect(() => {
    if (!overview && pathname !== "/topics" && pathname !== "/progress") return;
    // Delay bookkeeping to the next frame: the active route is rendered from
    // the pathname immediately, while this only records that it should stay
    // mounted after the user leaves it.
    const frame = window.requestAnimationFrame(() => {
      if (overview) setDashboardWorldMounted(true);
      if (pathname === "/topics") setTopicsWorldMounted(true);
      if (pathname === "/progress") setProgressWorldMounted(true);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [overview, pathname]);

  useEffect(() => {
    if (!managed) return;
    // Route prefetching fetches code in most cases. This idle preload is a
    // fallback that keeps Three.js from competing with the first paint.
    const preload = () => { void loadWorld(); void loadTopicsWorld(); void loadProgressWorld(); };
    const idle = window.requestIdleCallback?.(preload, { timeout: 2500 });
    const timeout = idle === undefined ? window.setTimeout(preload, 1200) : undefined;
    return () => {
      if (idle !== undefined) window.cancelIdleCallback?.(idle);
      if (timeout !== undefined) window.clearTimeout(timeout);
    };
  }, [managed]);

  useEffect(() => {
    const refresh = () => { if (managed && document.visibilityState === "visible") void ensureLearningData().catch(() => {}); };
    const change = (event: Event) => {
      if ((event as CustomEvent).detail === "auth") { clearSession(); return; }
      staleLearningData(); refresh();
    };
    window.addEventListener("focus", refresh);
    window.addEventListener("suri:data-changed", change);
    return () => { window.removeEventListener("focus", refresh); window.removeEventListener("suri:data-changed", change); };
  }, [managed, clearSession]);

  useEffect(() => {
    if (dataError && "status" in dataError && dataError.status === 401 && managed) {
      clearSession(); router.replace("/login");
    }
  }, [dataError, managed, clearSession, router]);

  useLayoutEffect(() => {
    const from = previous.current;
    previous.current = pathname;
    if (from === pathname) return;
    transaction.current++;
    pendingRoute.current=null;
    if (pathname === "/login" || pathname === "/register" || pathname === "/") {
      clearSession(); return;
    }
    if (overview) {
      // The retained dashboard camera resets itself as it becomes visible.
      setCommand(null);
      unlock();
    } else {
      // Do not let a completed island command run when the world is paused.
      setCommand(null);
      unlock();
    }
  }, [pathname, overview, clearSession, unlock]);

  const navigate = useCallback((href: string) => {
    if (locked.current || href === pathname) return;
    locked.current=true; setBusy(true); setError(null);
    const token=++transaction.current;
    pendingRoute.current=href;
    router.prefetch(href);
    // Start the destination's expensive scene work during the intentional map
    // zoom. The route is shown only after that critical module is available.
    const worldReady = href === "/topics"
      ? loadTopicsWorld().then(() => undefined).catch(() => undefined)
      : href === "/progress"
        ? loadProgressWorld().then(() => undefined).catch(() => undefined)
        : Promise.resolve();
    const site=ISLAND_ROUTES[href as IslandRoute];
    const camera = new Promise<void>(resolve => {
      if (overview && site) setCommand({id:++serial.current,kind:"island",site,onComplete:resolve});
      else resolve();
    });
    // Prefetching starts eagerly, but navigation is deliberately gated only by
    // the short camera motion. A slow data request must never turn an island
    // click into a blank or spinner-bound intermediate state.
    if (managedRoutes.includes(href) && href !== "/dashboard" && href !== "/calculator" && !getLearningSnapshot().data) {
      void ensureLearningData().catch(() => {});
    }
    void Promise.all([camera, worldReady]).then(() => {
      if(token!==transaction.current)return;
      router.push(href);
    }).catch(cause => {
      if(token!==transaction.current)return;
      pendingRoute.current=null;
      setError(cause instanceof Error ? cause.message : "Unable to open this section. Please try again.");
      if(overview)setCommand({id:++serial.current,kind:"overview",onComplete:unlock});
      else unlock();
    });
  }, [pathname, overview, router, unlock]);

  const progress = useMemo(() => {
    const active=data?.progress.active_sessions ?? [], completed=data?.progress.completed_sessions ?? [];
    const mastered=active.reduce((sum,s)=>sum+s.mastered_count,0),total=active.reduce((sum,s)=>sum+s.total_in_chain,0);
    const pct=active.length?Math.round(active.reduce((sum,s)=>sum+(Number(s.completion_percentage)||0),0)/active.length):0;
    const dewdrops=mastered*10+completed.length*50;
    const rank=dewdrops>=1000?"Elder Canopy Sage":dewdrops>=600?"Wildwood Ranger":dewdrops>=300?"Dewdrop Pathfinder":dewdrops>=100?"Fern Scout":"Sprout Explorer";
    return {mastered,total,pct,dewdrops,rank};
  }, [data]);
  const context=useMemo(()=>({navigate,busy,error:error ?? dataError?.message ?? null,clearSession}),[navigate,busy,error,dataError,clearSession]);
  return <NavigationContext.Provider value={context}>
    {(dashboardWorldMounted || overview) && <div className="dashboard-world-layer" aria-hidden={!overview} style={{ visibility: overview ? "visible" : "hidden" }}>
      <DashboardWorld visible={overview} command={command} navigate={navigate} busy={busy}
        active={data?.progress.active_sessions} errors={data?.progress.misconception_history} progress={progress}/>
    </div>}
    {(topicsWorldMounted || pathname === "/topics") && <div className="topics-world-shell" aria-hidden={pathname !== "/topics"} style={{ visibility: pathname === "/topics" ? "visible" : "hidden" }}>
      <TopicsLibraryWorld active={pathname === "/topics"} />
    </div>}
    {(progressWorldMounted || pathname === "/progress") && <div className="progress-world-shell" aria-hidden={pathname !== "/progress"} style={{ visibility: pathname === "/progress" ? "visible" : "hidden" }}>
      <ProgressTrailWorld active={pathname === "/progress"} />
    </div>}
    <div className={overview ? "dashboard-route-overlay" : "learning-route-content"}>{children}</div>
  </NavigationContext.Provider>;
}
