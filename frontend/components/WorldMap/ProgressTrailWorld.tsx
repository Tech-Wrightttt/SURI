"use client";

import FocusedIslandWorld from "./FocusedIslandWorld";
import type { LandscapeFocus } from "./Landscape";

// The Hall of Champions occupies the Progress island. The bounds retain its
// shoreline, forecourt, and victory banners while excluding the hub and the
// nearby scenic islets, matching the Topics route's isolated-island treatment.
const PROGRESS_FOCUS = {
  island: "progress",
  bounds: { minX: -58, maxX: -27, minZ: -23, maxZ: 13, padding: 2.4, island: "progress" },
} satisfies LandscapeFocus;

export default function ProgressTrailWorld({ active = true, onReady }: { active?: boolean; onReady?: () => void }) {
  return <FocusedIslandWorld
    active={active}
    arrive={false}
    className="progress-world"
    focus={PROGRESS_FOCUS}
    landmark="champions"
    site="champions"
    onReady={onReady}
  />;
}
