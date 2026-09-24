"use client";

import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import dynamic from "next/dynamic";
import { usePathname, useRouter } from "next/navigation";
import { clearLearningData, ensureLearningData, getLearningSnapshot, getServerLearningSnapshot, staleLearningData, subscribeLearningData } from "@/lib/learningData";
import { ISLAND_ROUTES, TOPICS_APPROACH_DURATION, type CameraCommand, type IslandRoute } from "@/lib/worldMap/navigation";

const loadWorld = () => import("@/components/WorldMap/KingdomWorld");
const loadTopicsWorld = () => import("@/components/WorldMap/TopicsLibraryWorld");
const loadProgressWorld = () => import("@/components/WorldMap/ProgressTrailWorld");
const DashboardWorld = dynamic(loadWorld, { ssr: false });
const TopicsLibraryWorld = dynamic(loadTopicsWorld, { ssr: false });
const ProgressTrailWorld = dynamic(loadProgressWorld, { ssr: false });
const managedRoutes = ["/dashboard", ...Object.keys(ISLAND_ROUTES)];
type FocusedTransition = "idle" | "entering" | "revealing" | "visible" | "leaving" | "zooming-out";
const TOPICS_WORLD_CROSSFADE_MS = 260;
const TOPICS_CONTENT_EXIT_MS = 360;
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
  const [topicsTransition, setTopicsTransition] = useState<FocusedTransition>(pathname === "/topics" ? "visible" : "idle");
  const [progressTransition, setProgressTransition] = useState<FocusedTransition>(pathname === "/progress" ? "visible" : "idle");
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
  const topicsTransitionRef = useRef(topicsTransition);
  const progressTransitionRef = useRef(progressTransition);
  const topicsRevealTimer = useRef<number | null>(null);
  const progressRevealTimer = useRef<number | null>(null);
  const setTopicsStage = useCallback((stage: FocusedTransition) => {
    topicsTransitionRef.current = stage;
    setTopicsTransition(stage);
  }, []);
  const setProgressStage = useCallback((stage: FocusedTransition) => {
    progressTransitionRef.current = stage;
    setProgressTransition(stage);
  }, []);
  const unlock = useCallback(() => { locked.current=false; setBusy(false); }, []);
  const clearSession = useCallback(() => {
    transaction.current++; clearLearningData(); setCommand(null); pendingRoute.current=null;
    if (topicsRevealTimer.current !== null) window.clearTimeout(topicsRevealTimer.current);
    if (progressRevealTimer.current !== null) window.clearTimeout(progressRevealTimer.current);
    setTopicsStage("idle"); setProgressStage("idle"); unlock();
  }, [setProgressStage, setTopicsStage, unlock]);

  const waitForMotion = useCallback((duration: number) => new Promise<void>(resolve => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { resolve(); return; }
    window.setTimeout(resolve, duration);
  }), []);

  const revealTopicsContent = useCallback(() => {
    if (pathname !== "/topics" || topicsTransitionRef.current !== "entering") return;
    setTopicsStage("revealing");
    if (topicsRevealTimer.current !== null) window.clearTimeout(topicsRevealTimer.current);
    topicsRevealTimer.current = window.setTimeout(() => {
      if (topicsTransitionRef.current !== "revealing") return;
      setTopicsStage("visible");
      unlock();
    }, window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : TOPICS_WORLD_CROSSFADE_MS);
  }, [pathname, setTopicsStage, unlock]);

  const revealProgressContent = useCallback(() => {
    if (pathname !== "/progress" || progressTransitionRef.current !== "entering") return;
    setProgressStage("revealing");
    if (progressRevealTimer.current !== null) window.clearTimeout(progressRevealTimer.current);
    progressRevealTimer.current = window.setTimeout(() => {
      if (progressTransitionRef.current !== "revealing") return;
      setProgressStage("visible");
      unlock();
    }, window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : TOPICS_WORLD_CROSSFADE_MS);
  }, [pathname, setProgressStage, unlock]);

  useEffect(() => () => {
    if (topicsRevealTimer.current !== null) window.clearTimeout(topicsRevealTimer.current);
    if (progressRevealTimer.current !== null) window.clearTimeout(progressRevealTimer.current);
  }, []);

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
      setTopicsStage("idle");
      setProgressStage("idle");
      setCommand(null);
      unlock();
    } else if (pathname === "/topics" && topicsTransitionRef.current === "entering") {
      // The content remains masked until the focused-island canvas has taken
      // over from the final dashboard camera frame.
      setCommand(null);
    } else if (pathname === "/progress" && progressTransitionRef.current === "entering") {
      // Progress uses the same masked handoff as Topics, with the Hall of
      // Champions already framed at its final scale before its UI appears.
      setCommand(null);
    } else {
      // Do not let a completed island command run when the world is paused.
      setCommand(null);
      unlock();
    }
  }, [pathname, overview, clearSession, setProgressStage, setTopicsStage, unlock]);

  const navigate = useCallback((href: string) => {
    if (locked.current || href === pathname) return;
    locked.current=true; setBusy(true); setError(null);
    const token=++transaction.current;
    pendingRoute.current=href;
    router.prefetch(href);

    const returningFocusedRoute = href === "/dashboard" && (pathname === "/topics" || pathname === "/progress");
    if (returningFocusedRoute) {
      // Reverse the arrival in two deliberate phases: remove the route UI
      // first, then reveal the retained dashboard camera already positioned at
      // the matching close-up before it travels back to the overview.
      const isTopics = pathname === "/topics";
      const setStage = isTopics ? setTopicsStage : setProgressStage;
      const site = isTopics ? "topics" : "champions";
      setStage("leaving");
      setDashboardWorldMounted(true);
      const worldReady = loadWorld().then(() => undefined).catch(() => undefined);
      const closeCamera = new Promise<void>(resolve => {
        setCommand({ id: ++serial.current, kind: "island", site, instant: true, onComplete: resolve });
      });
      void Promise.all([worldReady, closeCamera, waitForMotion(TOPICS_CONTENT_EXIT_MS)]).then(() => {
        if (token !== transaction.current) return;
        setStage("zooming-out");
        setCommand({
          id: ++serial.current,
          kind: "overview",
          duration: TOPICS_APPROACH_DURATION,
          onComplete: () => { if (token === transaction.current) router.push(href); },
        });
      }).catch(cause => {
        if (token !== transaction.current) return;
        pendingRoute.current=null;
        setStage("visible");
        setError(cause instanceof Error ? cause.message : "Unable to return to the kingdom. Please try again.");
        unlock();
      });
      return;
    }

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
      if (href === "/topics") setTopicsStage("entering");
      if (href === "/progress") setProgressStage("entering");
      router.push(href);
    }).catch(cause => {
      if(token!==transaction.current)return;
      pendingRoute.current=null;
      if (href === "/topics") setTopicsStage("idle");
      if (href === "/progress") setProgressStage("idle");
      setError(cause instanceof Error ? cause.message : "Unable to open this section. Please try again.");
      if(overview)setCommand({id:++serial.current,kind:"overview",onComplete:unlock});
      else unlock();
    });
  }, [pathname, overview, router, setProgressStage, setTopicsStage, unlock, waitForMotion]);

  const progress = useMemo(() => {
    const active=data?.progress.active_sessions ?? [], completed=data?.progress.completed_sessions ?? [];
    const mastered=active.reduce((sum,s)=>sum+s.mastered_count,0),total=active.reduce((sum,s)=>sum+s.total_in_chain,0);
    const pct=active.length?Math.round(active.reduce((sum,s)=>sum+(Number(s.completion_percentage)||0),0)/active.length):0;
    const dewdrops=mastered*10+completed.length*50;
    const rank=dewdrops>=1000?"Elder Canopy Sage":dewdrops>=600?"Wildwood Ranger":dewdrops>=300?"Dewdrop Pathfinder":dewdrops>=100?"Fern Scout":"Sprout Explorer";
    return {mastered,total,pct,dewdrops,rank};
  }, [data]);
  const context=useMemo(()=>({navigate,busy,error:error ?? dataError?.message ?? null,clearSession}),[navigate,busy,error,dataError,clearSession]);
  const focusedTransition = topicsTransition !== "idle" ? topicsTransition : progressTransition;
  const dashboardLayerVisible = overview || ["entering", "revealing", "leaving", "zooming-out"].includes(focusedTransition);
  const dashboardActive = overview || ["entering", "leaving", "zooming-out"].includes(focusedTransition);
  const dashboardTransitionClass = focusedTransition === "revealing"
    ? "is-fading-behind-topics"
    : focusedTransition === "leaving"
      ? "is-preparing-topics-return"
      : focusedTransition === "zooming-out"
        ? "is-returning-from-topics"
        : "";
  const contentClass = overview
    ? "dashboard-route-overlay"
    : pathname === "/topics"
      ? `learning-route-content topic-route-content topic-transition-${topicsTransition}`
      : pathname === "/progress"
        ? `learning-route-content progress-route-content progress-transition-${progressTransition}`
        : "learning-route-content";
  return <NavigationContext.Provider value={context}>
    {(dashboardWorldMounted || overview) && <div className={`dashboard-world-layer ${dashboardTransitionClass}`} aria-hidden={!overview} style={{ visibility: dashboardLayerVisible ? "visible" : "hidden" }}>
      <DashboardWorld visible={dashboardActive} preserveCameraOnActivate={!overview && focusedTransition !== "idle"} command={command} navigate={navigate} busy={busy}
        active={data?.progress.active_sessions} errors={data?.progress.misconception_history} progress={progress}/>
    </div>}
    {(topicsWorldMounted || pathname === "/topics") && <div className={`topics-world-shell topics-transition-${topicsTransition}`} aria-hidden={pathname !== "/topics"} style={{ visibility: pathname === "/topics" ? "visible" : "hidden" }}>
      <TopicsLibraryWorld active={pathname === "/topics"} onReady={revealTopicsContent} />
    </div>}
    {(progressWorldMounted || pathname === "/progress") && <div className={`progress-world-shell progress-transition-${progressTransition}`} aria-hidden={pathname !== "/progress"} style={{ visibility: pathname === "/progress" ? "visible" : "hidden" }}>
      <ProgressTrailWorld active={pathname === "/progress"} onReady={revealProgressContent} />
    </div>}
    <div className={contentClass}>{children}</div>
  </NavigationContext.Provider>;
}
