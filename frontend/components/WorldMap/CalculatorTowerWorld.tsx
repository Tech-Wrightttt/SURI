"use client";

import { useEffect } from "react";

export default function CalculatorTowerWorld({ active = true, onReady }: { active?: boolean; onReady?: () => void }) {
  useEffect(() => {
    if (active) onReady?.();
  }, [active, onReady]);

  // Temporary static library backdrop shared with Progress while the
  // Calculator's dedicated close-up scene is being refined.
  return <div className="calculator-world" aria-hidden="true" />;
}
