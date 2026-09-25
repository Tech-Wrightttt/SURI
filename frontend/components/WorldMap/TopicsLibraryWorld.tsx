"use client";

import { useEffect } from "react";

export default function TopicsLibraryWorld({ active = true, onReady }: { active?: boolean; onReady?: () => void }) {
  useEffect(() => {
    if (active) onReady?.();
  }, [active, onReady]);

  // Temporary static backdrop for the Topics library. Keeping this lightweight
  // route layer preserves the existing page-transition contract without
  // mounting the Topics island canvas.
  return <div className="topics-world" aria-hidden="true" />;
}
