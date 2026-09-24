"use client";

import FocusedIslandWorld from "./FocusedIslandWorld";
import type { LandscapeFocus } from "./Landscape";

// Reuse the Calculator's real Arcane Tower and island from the dashboard. The
// focused bounds keep its shoreline and forecourt in view without introducing a
// separate decorative scene for the solver.
const CALCULATOR_FOCUS = {
  island: "calculator",
  bounds: { minX: 1, maxX: 31, minZ: 19, maxZ: 48, padding: 2.4, island: "calculator" },
} satisfies LandscapeFocus;

export default function CalculatorTowerWorld({ active = true, onReady }: { active?: boolean; onReady?: () => void }) {
  return <FocusedIslandWorld
    active={active}
    arrive={false}
    className="calculator-world"
    focus={CALCULATOR_FOCUS}
    landmark="calculator"
    site="calculator"
    onReady={onReady}
  />;
}
