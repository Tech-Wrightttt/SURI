"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
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
      {/* This in-flow archive bar begins each page and scrolls away with its content. */}
      <nav className="suri-app-bar" aria-label="SURI navigation">
        <div className="suri-app-bar-frame">
          <div className="suri-app-brand">
            <Image alt="SURI" src="/SURI1.png" width={300} height={100} className="suri-app-brand-logo" priority />
          </div>
          <div className="suri-app-bar-actions">
            <button
              onClick={() => window.dispatchEvent(new Event("suri:open-tutorial"))}
              aria-label="How to explore SURI"
              className="suri-app-control"
            >
              <HelpCircle className="h-5 w-5" /><span className="suri-app-control-label">Help</span>
            </button>
            <div ref={settingsRef} className="relative">
              <button
                onClick={() => setSettingsOpen(open => !open)}
                aria-label="Open account menu"
                aria-expanded={settingsOpen}
                aria-haspopup="menu"
                className="suri-app-control suri-app-account-control"
              >
                <UserRound className="h-5 w-5 shrink-0" /><span className="truncate">{data?.me.name || "Student"}</span>
              </button>
              {settingsOpen && <div role="menu" className="suri-account-menu">
                <button role="menuitem" disabled className="suri-account-menu-item is-disabled">
                  <span>Account settings</span><small>Soon</small>
                </button>
                <div className="suri-account-menu-divider" />
                <button role="menuitem" onClick={() => { setSettingsOpen(false); setShowLogoutConfirm(true); }} className="suri-account-menu-item is-logout">
                  <LogOut className="h-4 w-4" /> Log out
                </button>
              </div>}
            </div>
          </div>
        </div>
      </nav>

      <main className={immersive ? "min-h-screen" : "pt-4 pb-12 px-4 md:px-8 max-w-[1440px] mx-auto"}>
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

