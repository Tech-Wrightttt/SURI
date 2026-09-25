"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
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
  const pathname = usePathname();
  const {clearSession} = useWorldNavigation();
  const {data} = useLearningData();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  useEffect(() => {
    const sessionId = pathname.match(/^\/session\/([^/]+)/)?.[1];
    const routes = sessionId
      ? [
          `/session/${sessionId}/lesson`,
          `/session/${sessionId}/practice`,
          `/session/${sessionId}/quiz`,
          `/session/${sessionId}/results`,
          "/topics",
          "/dashboard",
        ]
      : ["/dashboard", "/topics", "/progress", "/calculator", "/error-history"];
    const warm = () => routes.filter((route) => route !== pathname).forEach((route) => router.prefetch(route));
    const idle = window.requestIdleCallback?.(warm, { timeout: 1800 });
    const timeout = idle === undefined ? window.setTimeout(warm, 700) : undefined;
    return () => {
      if (idle !== undefined) window.cancelIdleCallback?.(idle);
      if (timeout !== undefined) window.clearTimeout(timeout);
    };
  }, [pathname, router]);

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
            <div className="suri-app-control suri-app-account-control" aria-label={`Signed in as ${data?.me.name || "Student"}`}>
              <UserRound className="h-5 w-5 shrink-0" /><span className="truncate">{data?.me.name || "Student"}</span>
            </div>
            <button
              type="button"
              onClick={() => setShowLogoutConfirm(true)}
              aria-label="Log out"
              className="suri-app-control suri-app-logout-control"
              style={{
                background: "linear-gradient(180deg, #d74b42, #a8211c)",
                color: "#fff4d5",
                boxShadow: "0 6px 0 #59100e, 0 13px 23px rgba(0,0,0,.26), inset 0 0 0 3px rgba(255,237,218,.16)",
                inlineSize: "4.1rem",
                blockSize: "4.1rem",
                padding: 0,
              }}
            >
              <LogOut className="h-4 w-4" />
            </button>
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

