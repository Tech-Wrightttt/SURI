"use client";

import { useEffect } from "react";

export default function ProgressTrailWorld({ active = true, onReady }: { active?: boolean; onReady?: () => void }) {
  useEffect(() => {
    if (active) onReady?.();
  }, [active, onReady]);

  // Temporary static library backdrop to match the Topics route while the
  // grade-based Progress experience is being refined.
  return <div className="progress-world" aria-hidden="true" />;
}
