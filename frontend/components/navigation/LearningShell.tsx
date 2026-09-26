"use client";

import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import dynamic from "next/dynamic";
import { usePathname, useRouter } from "next/navigation";
import { clearLearningData, ensureLearningData, getLearningSnapshot, getServerLearningSnapshot, staleLearningData, subscribeLearningData } from "@/lib/learningData";
import { ISLAND_ROUTES, TOPICS_APPROACH_DURATION, type CameraCommand, type IslandRoute } from "@/lib/worldMap/navigation";

const loadWorld = () => import("@/components/WorldMap/KingdomWorld");
const loadTopicsWorld = () => import("@/components/WorldMap/TopicsLibraryWorld");
const loadProgressWorld = () => import("@/components/WorldMap/ProgressTrailWorld");
const loadCalculatorWorld = () => import("@/components/WorldMap/CalculatorTowerWorld");
const loadTopicCarousel = () => import("@/components/TopicBookCarousel");
const DashboardWorld = dynamic(loadWorld, { ssr: false });
const TopicsLibraryWorld = dynamic(loadTopicsWorld, { ssr: false });
const ProgressTrailWorld = dynamic(loadProgressWorld, { ssr: false });
const CalculatorTowerWorld = dynamic(loadCalculatorWorld, { ssr: false });

const managedRoutes = ["/dashboard", ...Object.keys(ISLAND_ROUTES)];
const FOCUSED_ROUTE_KEYS = ["topics", "progress", "calculator", "errors"] as const;
type FocusedRouteKey = typeof FOCUSED_ROUTE_KEYS[number];
type FocusedTransition = "idle" | "entering" | "revealing" | "visible" | "leaving" | "zooming-out";
type FocusedTransitionMap = Record<FocusedRouteKey, FocusedTransition>;
type FocusedWorldMap = Record<FocusedRouteKey, boolean>;

// Every close-up route uses this same handoff: the dashboard camera finishes its
// approach, the matching retained island takes over, then foreground content fades
// in. Keeping the route specifics here prevents each page from inventing its own
// version of the transition.
const FOCUSED_ROUTES = {
  "/topics": { key: "topics", site: "topics", load: loadTopicsWorld, contentClass: "topic-route-content" },
  "/progress": { key: "progress", site: "champions", load: loadProgressWorld, contentClass: "progress-route-content" },
  "/calculator": { key: "calculator", site: "calculator", load: loadCalculatorWorld, contentClass: "calculator-route-content" },
  "/error-history": { key: "errors", site: "records", load: loadProgressWorld, contentClass: "error-history-route-content" },
} as const;

// Route canvases and foreground pages deliberately overlap for a little
// longer so the handoff reads as a single gentle transition.
const TOPICS_WORLD_CROSSFADE_MS = 600;
const TOPICS_CONTENT_EXIT_MS = 660;
const routeModulePreloads = new Map<string, Promise<unknown>>();
const routeModuleLoaders: Partial<Record<string, () => Promise<unknown>>> = {
  "/dashboard": loadWorld,
  "/topics": () => Promise.all([loadTopicsWorld(), loadTopicCarousel()]),
  "/progress": loadProgressWorld,
  "/calculator": loadCalculatorWorld,
  "/error-history": loadProgressWorld,
};

function warmRouteModule(href: string) {
  const loader = routeModuleLoaders[href];
  if (!loader) return Promise.resolve();
  const existing = routeModulePreloads.get(href);
  if (existing) return existing;
  const preload = loader().catch((cause: unknown) => {
    routeModulePreloads.delete(href);
    throw cause;
  });
  routeModulePreloads.set(href, preload);
  return preload;
}

function canPreloadHeavySceneWork() {
  if (typeof navigator === "undefined") return false;
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
  return !connection?.saveData && !connection?.effectiveType?.includes("2g");
}

const NavigationContext = createContext<{
  navigate: (href: string) => void; preloadRoute: (href: string) => void; busy: boolean; error: string | null; clearSession: () => void;
}>({ navigate: () => {}, preloadRoute: () => {}, busy: false, error: null, clearSession: () => {} });

export const useWorldNavigation = () => useContext(NavigationContext);
export function useLearningData() {
  return useSyncExternalStore(subscribeLearningData, getLearningSnapshot, getServerLearningSnapshot);
}

function getFocusedRoute(pathname: string) {
  return FOCUSED_ROUTES[pathname as keyof typeof FOCUSED_ROUTES];
}

function createTransitionMap(pathname: string): FocusedTransitionMap {
  const route = getFocusedRoute(pathname);
  return {
    topics: route?.key === "topics" ? "visible" : "idle",
    progress: route?.key === "progress" ? "visible" : "idle",
    calculator: route?.key === "calculator" ? "visible" : "idle",
    errors: route?.key === "errors" ? "visible" : "idle",
  };
}

function createWorldMap(pathname: string): FocusedWorldMap {
  const route = getFocusedRoute(pathname);
  return {
    topics: route?.key === "topics",
    progress: route?.key === "progress",
    calculator: route?.key === "calculator",
    errors: route?.key === "errors",
  };
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
  const [focusedTransitions, setFocusedTransitions] = useState<FocusedTransitionMap>(() => createTransitionMap(pathname));
  const [dashboardWorldMounted, setDashboardWorldMounted] = useState(overview);
  const [focusedWorldMounted, setFocusedWorldMounted] = useState<FocusedWorldMap>(() => createWorldMap(pathname));
  const locked = useRef(false);
  const serial = useRef(0);
  const previous = useRef(pathname);
  const transaction = useRef(0);
  const pendingRoute = useRef<string | null>(null);
  const focusedTransitionsRef = useRef(focusedTransitions);
  const revealTimers = useRef<Partial<Record<FocusedRouteKey, number>>>({});

  const preloadRoute = useCallback((href: string, includeScene = false) => {
    router.prefetch(href);
    if (includeScene) void warmRouteModule(href).catch(() => {});
  }, [router]);

  const setFocusedStage = useCallback((key: FocusedRouteKey, stage: FocusedTransition) => {
    focusedTransitionsRef.current = { ...focusedTransitionsRef.current, [key]: stage };
    setFocusedTransitions(current => ({ ...current, [key]: stage }));
  }, []);
  const resetFocusedStages = useCallback(() => {
    const idle: FocusedTransitionMap = { topics: "idle", progress: "idle", calculator: "idle", errors: "idle" };
    focusedTransitionsRef.current = idle;
    setFocusedTransitions(idle);
  }, []);
  const unlock = useCallback(() => { locked.current = false; setBusy(false); }, []);
  const clearRevealTimers = useCallback(() => {
    FOCUSED_ROUTE_KEYS.forEach(key => {
      const timer = revealTimers.current[key];
      if (timer !== undefined) window.clearTimeout(timer);
    });
    revealTimers.current = {};
  }, []);
  const clearSession = useCallback(() => {
    transaction.current++; clearLearningData(); setCommand(null); pendingRoute.current = null;
    clearRevealTimers(); resetFocusedStages(); unlock();
  }, [clearRevealTimers, resetFocusedStages, unlock]);

  const waitForMotion = useCallback((duration: number) => new Promise<void>(resolve => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { resolve(); return; }
    window.setTimeout(resolve, duration);
  }), []);

  const revealFocusedContent = useCallback((key: FocusedRouteKey) => {
    const route = getFocusedRoute(pathname);
    if (route?.key !== key || focusedTransitionsRef.current[key] !== "entering") return;
    setFocusedStage(key, "revealing");
    const existingTimer = revealTimers.current[key];
    if (existingTimer !== undefined) window.clearTimeout(existingTimer);
    revealTimers.current[key] = window.setTimeout(() => {
      if (focusedTransitionsRef.current[key] !== "revealing") return;
      setFocusedStage(key, "visible");
      unlock();
    }, window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : TOPICS_WORLD_CROSSFADE_MS);
  }, [pathname, setFocusedStage, unlock]);

  useEffect(() => () => clearRevealTimers(), [clearRevealTimers]);

  useEffect(() => {
    if (!managed) return;
    managedRoutes.forEach((href) => preloadRoute(href));
    void ensureLearningData().catch(() => {});
  }, [managed, pathname, preloadRoute]);

  useEffect(() => {
    const focusedRoute = getFocusedRoute(pathname);
    if (!overview && !focusedRoute) return;
    // Delay bookkeeping to the next frame: the active route is rendered from
    // the pathname immediately, while this only records that it should stay
    // mounted after the user leaves it.
    const frame = window.requestAnimationFrame(() => {
      if (overview) setDashboardWorldMounted(true);
      if (focusedRoute) setFocusedWorldMounted(current => ({ ...current, [focusedRoute.key]: true }));
    });
    return () => window.cancelAnimationFrame(frame);
  }, [overview, pathname]);

  useEffect(() => {
    if (!managed) return;
    // Route prefetching fetches code in most cases. This idle preload is a
    // fallback that keeps Three.js from competing with the first paint.
    if (!canPreloadHeavySceneWork()) return;
    const preload = () => { ["/dashboard", "/topics", "/progress", "/calculator", "/error-history"].forEach(href => void warmRouteModule(href).catch(() => {})); };
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
    pendingRoute.current = null;
    if (pathname === "/login" || pathname === "/register" || pathname === "/") {
      clearSession(); return;
    }
    const focusedRoute = getFocusedRoute(pathname);
    if (overview) {
      // The retained dashboard camera resets itself as it becomes visible.
      resetFocusedStages();
      setCommand(null);
      unlock();
    } else if (focusedRoute && focusedTransitionsRef.current[focusedRoute.key] === "entering") {
      // The content remains masked until the focused-island canvas has taken
      // over from the final dashboard camera frame.
      setCommand(null);
    } else {
      // Do not let a completed island command run when the world is paused.
      setCommand(null);
      unlock();
    }
  }, [pathname, overview, clearSession, resetFocusedStages, unlock]);

  const navigate = useCallback((href: string) => {
    if (locked.current || href === pathname) return;
    locked.current = true; setBusy(true); setError(null);
    const token = ++transaction.current;
    pendingRoute.current = href;
    preloadRoute(href, true);

    const currentFocusedRoute = getFocusedRoute(pathname);
    if (href === "/dashboard" && currentFocusedRoute) {
      // Reverse the arrival in two deliberate phases: remove the route UI
      // first, then reveal the retained dashboard camera already positioned at
      // the matching close-up before it travels back to the overview.
      setFocusedStage(currentFocusedRoute.key, "leaving");
      setDashboardWorldMounted(true);
      const worldReady = loadWorld().then(() => undefined).catch(() => undefined);
      const closeCamera = new Promise<void>(resolve => {
        setCommand({ id: ++serial.current, kind: "island", site: currentFocusedRoute.site, instant: true, onComplete: resolve });
      });
      void Promise.all([worldReady, closeCamera, waitForMotion(TOPICS_CONTENT_EXIT_MS)]).then(() => {
        if (token !== transaction.current) return;
        setFocusedStage(currentFocusedRoute.key, "zooming-out");
        setCommand({
          id: ++serial.current,
          kind: "overview",
          duration: TOPICS_APPROACH_DURATION,
          onComplete: () => { if (token === transaction.current) router.push(href); },
        });
      }).catch(cause => {
        if (token !== transaction.current) return;
        pendingRoute.current = null;
        setFocusedStage(currentFocusedRoute.key, "visible");
        setError(cause instanceof Error ? cause.message : "Unable to return to the kingdom. Please try again.");
        unlock();
      });
      return;
    }

    // Start the destination's expensive scene work during the intentional map
    // zoom. The route is shown only after that critical module is available.
    const destinationFocusedRoute = getFocusedRoute(href);
    const worldReady = destinationFocusedRoute
      ? destinationFocusedRoute.load().then(() => undefined).catch(() => undefined)
      : Promise.resolve();
    const site = ISLAND_ROUTES[href as IslandRoute];
    const camera = new Promise<void>(resolve => {
      if (overview && site) setCommand({ id: ++serial.current, kind: "island", site, onComplete: resolve });
      else resolve();
    });
    // Prefetching starts eagerly, but navigation is deliberately gated only by
    // the short camera motion. A slow data request must never turn an island
    // click into a blank or spinner-bound intermediate state.
    if (managedRoutes.includes(href) && destinationFocusedRoute?.key !== "calculator" && !getLearningSnapshot().data) {
      void ensureLearningData().catch(() => {});
    }
    void Promise.all([camera, worldReady]).then(() => {
      if (token !== transaction.current) return;
      if (destinationFocusedRoute) setFocusedStage(destinationFocusedRoute.key, "entering");
      router.push(href);
    }).catch(cause => {
      if (token !== transaction.current) return;
      pendingRoute.current = null;
      if (destinationFocusedRoute) setFocusedStage(destinationFocusedRoute.key, "idle");
      setError(cause instanceof Error ? cause.message : "Unable to open this section. Please try again.");
      if (overview) setCommand({ id: ++serial.current, kind: "overview", onComplete: unlock });
      else unlock();
    });
  }, [pathname, overview, preloadRoute, router, setFocusedStage, unlock, waitForMotion]);

  const progress = useMemo(() => {
    const active = data?.progress.active_sessions ?? [], completed = data?.progress.completed_sessions ?? [];
    const mastered = active.reduce((sum, s) => sum + s.mastered_count, 0), total = active.reduce((sum, s) => sum + s.total_in_chain, 0);
    const pct = active.length ? Math.round(active.reduce((sum, s) => sum + (Number(s.completion_percentage) || 0), 0) / active.length) : 0;
    const dewdrops = mastered * 10 + completed.length * 50;
    const rank = dewdrops >= 1000 ? "Elder Canopy Sage" : dewdrops >= 600 ? "Wildwood Ranger" : dewdrops >= 300 ? "Dewdrop Pathfinder" : dewdrops >= 100 ? "Fern Scout" : "Sprout Explorer";
    return { mastered, total, pct, dewdrops, rank };
  }, [data]);
  const context = useMemo(() => ({ navigate, preloadRoute, busy, error: error ?? dataError?.message ?? null, clearSession }), [navigate, preloadRoute, busy, error, dataError, clearSession]);
  const focusedTransition = FOCUSED_ROUTE_KEYS.map(key => focusedTransitions[key]).find(stage => stage !== "idle") ?? "idle";
  const dashboardLayerVisible = overview || ["entering", "revealing", "leaving", "zooming-out"].includes(focusedTransition);
  const dashboardActive = overview || ["entering", "leaving", "zooming-out"].includes(focusedTransition);
  const dashboardTransitionClass = focusedTransition === "revealing"
    ? "is-fading-behind-topics"
    : focusedTransition === "leaving"
      ? "is-preparing-topics-return"
      : focusedTransition === "zooming-out"
        ? "is-returning-from-topics"
        : "";
  const activeFocusedRoute = getFocusedRoute(pathname);
  const contentClass = overview
    ? "dashboard-route-overlay"
    : activeFocusedRoute
      ? `learning-route-content focused-route-content ${activeFocusedRoute.contentClass} ${activeFocusedRoute.key}-transition-${focusedTransitions[activeFocusedRoute.key]}`
      : "learning-route-content";

  return <NavigationContext.Provider value={context}>
    {(dashboardWorldMounted || overview) && <div className={`dashboard-world-layer ${dashboardTransitionClass}`} aria-hidden={!overview} style={{ visibility: dashboardLayerVisible ? "visible" : "hidden" }}>
      <DashboardWorld visible={dashboardActive} preserveCameraOnActivate={!overview && focusedTransition !== "idle"} command={command} navigate={navigate} preloadRoute={(href) => preloadRoute(href, true)} busy={busy}
        active={data?.progress.active_sessions} errors={data?.progress.misconception_history} progress={progress} />
    </div>}
    {(focusedWorldMounted.topics || pathname === "/topics") && <div className={`topics-world-shell topics-transition-${focusedTransitions.topics}`} aria-hidden={pathname !== "/topics"} style={{ visibility: pathname === "/topics" ? "visible" : "hidden" }}>
      <TopicsLibraryWorld active={pathname === "/topics"} onReady={() => revealFocusedContent("topics")} />
    </div>}
    {(focusedWorldMounted.progress || pathname === "/progress") && <div className={`progress-world-shell progress-transition-${focusedTransitions.progress}`} aria-hidden={pathname !== "/progress"} style={{ visibility: pathname === "/progress" ? "visible" : "hidden" }}>
      <ProgressTrailWorld active={pathname === "/progress"} onReady={() => revealFocusedContent("progress")} />
    </div>}
    {(focusedWorldMounted.calculator || pathname === "/calculator") && <div className={`calculator-world-shell calculator-transition-${focusedTransitions.calculator}`} aria-hidden={pathname !== "/calculator"} style={{ visibility: pathname === "/calculator" ? "visible" : "hidden" }}>
      <CalculatorTowerWorld active={pathname === "/calculator"} onReady={() => revealFocusedContent("calculator")} />
    </div>}
    {(focusedWorldMounted.errors || pathname === "/error-history") && <div className={`error-history-world-shell errors-transition-${focusedTransitions.errors}`} aria-hidden={pathname !== "/error-history"} style={{ visibility: pathname === "/error-history" ? "visible" : "hidden" }}>
      <ProgressTrailWorld active={pathname === "/error-history"} onReady={() => revealFocusedContent("errors")} />
    </div>}
    <div className={contentClass}>{children}</div>
  </NavigationContext.Provider>;
}
