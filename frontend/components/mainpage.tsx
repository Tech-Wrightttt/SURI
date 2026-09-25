"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { HelpCircle, LogOut, UserRound } from "lucide-react";
import { logout } from "@/lib/api";
import { useLearningData, useWorldNavigation } from "@/components/navigation/LearningShell";

export default function MainPage({
  children,
  immersive = false,
}: {
  children: React.ReactNode;
  immersive?: boolean;
}) {
  const router = useRouter();
  const {clearSession} = useWorldNavigation();
  const {data} = useLearningData();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const settingsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(event.target as Node)) setSettingsOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setSettingsOpen(false); };
    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, []);

  const handleLogout = async () => {
    try {
      await logout();
      clearSession();
      router.push("/login");
    } catch {
      // ignore
    }
  };

  return (
    <div className={immersive ? "min-h-screen bg-transparent text-white" : "min-h-screen bg-[#DBD4C7] text-[#191c1e]"}>
      {/* TopAppBar */}
      <nav className="fixed top-0 left-0 right-0 z-50">
        {/* The immersive world stays unobstructed: its landmark detail cards must
            remain readable even when they travel through the header area. */}
        {!immersive && <div className="absolute inset-0" style={{ background: "rgba(219,212,199,0.85)", backdropFilter: "blur(12px)", maskImage: "linear-gradient(to bottom, black 0%, black 60%, transparent 100%)", WebkitMaskImage: "linear-gradient(to bottom, black 0%, black 60%, transparent 100%)" }} />}
        <div className="relative flex items-center h-24 px-4 md:px-8">
          
          <div className="flex items-center gap-3 absolute right-4 md:right-8 top-1/2 -translate-y-1/2 pointer-events-auto">
          {immersive && <button
            onClick={() => window.dispatchEvent(new Event("suri:open-tutorial"))}
            aria-label="How to explore SURI"
            className="h-12 rounded-full bg-white/12 border border-white/20 px-4 backdrop-blur-md flex items-center gap-2 text-white hover:bg-[#a78bfa] hover:border-[#c4b5fd] transition-all cursor-pointer"
          >
            <HelpCircle className="w-5 h-5" /><span className="font-['Manrope'] text-[13px] font-bold">Help</span>
          </button>}
          <div ref={settingsRef} className="relative flex items-center gap-2">
            <button
              onClick={() => setSettingsOpen(open => !open)}
              aria-label="Open account menu"
              aria-expanded={settingsOpen}
              aria-haspopup="menu"
              className={immersive ? "h-12 max-w-48 rounded-full bg-white/12 border border-white/20 px-4 backdrop-blur-md flex items-center gap-2 text-white hover:bg-white/20 transition-all cursor-pointer" : "h-14 max-w-52 rounded-full bg-white border border-[#c3c5d9]/30 px-5 shadow-[0_4px_20px_rgba(0,0,0,0.04)] flex items-center gap-2 text-[#434656] hover:bg-[#f2f4f6] transition-all cursor-pointer"}
            >
              <UserRound className="w-5 h-5 shrink-0" /><span className="truncate font-['Manrope'] text-[13px] font-bold">{data?.me.name || "Student"}</span>
            </button>
            {settingsOpen && <div role="menu" className={immersive ? "absolute right-0 top-[calc(100%+0.65rem)] w-52 overflow-hidden rounded-2xl border border-white/20 bg-[#19132f]/95 p-1.5 text-white shadow-2xl backdrop-blur-xl" : "absolute right-0 top-[calc(100%+0.65rem)] w-52 overflow-hidden rounded-2xl border border-[#c3c5d9]/50 bg-white p-1.5 text-[#191c1e] shadow-xl"}>
              <button role="menuitem" disabled className={immersive ? "flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm font-bold text-white/50 cursor-not-allowed" : "flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm font-bold text-[#434656]/50 cursor-not-allowed"}>
                <span>Account settings</span><small className="text-[10px] font-bold uppercase tracking-wide">Soon</small>
              </button>
              <div className={immersive ? "my-1 border-t border-white/10" : "my-1 border-t border-[#c3c5d9]/40"} />
              <button role="menuitem" onClick={() => { setSettingsOpen(false); setShowLogoutConfirm(true); }} className={immersive ? "flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-bold text-[#ffb4ab] hover:bg-[#ba1a1a]/30 cursor-pointer" : "flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-bold text-[#ba1a1a] hover:bg-red-50 cursor-pointer"}>
                <LogOut className="h-4 w-4" /> Log out
              </button>
            </div>}
          </div>
        </div>
        </div>
      </nav>

      <main className={immersive ? "min-h-screen" : "pt-28 pb-12 px-4 md:px-8 max-w-[1440px] mx-auto"}>
        {children}
      </main>

      {showLogoutConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-6 shadow-lg w-80 text-center">
            <h3 className="font-['Hanken_Grotesk'] text-lg font-bold text-[#191c1e] mb-2">Log out</h3>
            <p className="font-['Manrope'] text-sm text-[#434656] mb-6">Are you sure you want to log out?</p>
            <div className="flex gap-3">
              <button onClick={() => setShowLogoutConfirm(false)} className="flex-1 py-2 rounded-xl border border-[#c3c5d9] text-[#434656] font-bold text-sm hover:bg-[#f2f4f6] cursor-pointer">Cancel</button>
              <button onClick={handleLogout} className="flex-1 py-2 rounded-xl bg-[#ba1a1a] text-white font-bold text-sm hover:bg-red-700 cursor-pointer">Log out</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

