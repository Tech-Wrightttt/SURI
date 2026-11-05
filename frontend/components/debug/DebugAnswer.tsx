"use client";

import type { ReactNode } from "react";
import { useLearningData } from "@/components/navigation/LearningShell";

// The server decides who is a debug account (DEBUG_ACCOUNT_EMAILS); the client
// only mirrors that flag, so nothing here can switch debug mode on.
export function useDebugMode() {
  return useLearningData().data?.me.is_debug === true;
}

/** Tester-only answer readout. Styled as tooling so it never reads as game UI. */
export default function DebugAnswer({ children }: { children: ReactNode }) {
  const debug = useDebugMode();
  if (!debug) return null;
  return (
    <aside className="debug-answer" aria-label="Debug answer">
      <span className="debug-answer-tag">Debug answer</span>
      <span className="debug-answer-value">{children}</span>
    </aside>
  );
}
