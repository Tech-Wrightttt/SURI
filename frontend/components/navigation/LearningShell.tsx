"use client";

import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import dynamic from "next/dynamic";
import { usePathname, useRouter } from "next/navigation";
import { clearLearningData, ensureLearningData, getLearningSnapshot, getServerLearningSnapshot, staleLearningData, subscribeLearningData } from "@/lib/learningData";
import { ISLAND_ROUTES, type CameraCommand, type IslandRoute } from "@/lib/worldMap/navigation";

const loadWorld = () => import("@/components/WorldMap/KingdomWorld");
const DashboardWorld = dynamic(loadWorld, { ssr: false });
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
    void loadWorld();
    void ensureLearningData().catch(() => {});
  }, [managed, pathname, router]);

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
      // The dashboard gets a new canvas after every return, so it should start
      // from its default camera rather than trying to reuse a prior world.
      setCommand(null);
      unlock();
    } else {
      // Drop the prior camera command together with the unmounted canvas.
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
    void camera.then(() => {
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
    {overview && <div className="dashboard-world-layer">
      <DashboardWorld visible command={command} navigate={navigate} busy={busy}
        active={data?.progress.active_sessions} errors={data?.progress.misconception_history} progress={progress}/>
    </div>}
    <div className={overview ? "dashboard-route-overlay" : "learning-route-content"}>{children}</div>
  </NavigationContext.Provider>;
}
