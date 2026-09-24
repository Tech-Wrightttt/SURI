"use client";

import FocusedIslandWorld, { FocusedIslandScene } from "./FocusedIslandWorld";
import type { LandscapeFocus } from "./Landscape";

// This is the Dashboard's Topics island, not a second, page-specific map. The
// tight bounds contain its whole shoreline and forecourt, while the island mask
// deliberately excludes the nearby scenic keys from the close-up.
const TOPICS_FOCUS = {
  island: "topics",
  bounds: { minX: -29, maxX: 8, minZ: -49, maxZ: -20, padding: 2.4, island: "topics" },
} satisfies LandscapeFocus;
/** The reusable Topics landmark shown in the Dashboard, framed as a close-up. */
export function TopicsIsland() {
  return <FocusedIslandScene focus={TOPICS_FOCUS} landmark="topics" site="topics" />;
}

export default function TopicsLibraryWorld({ active = true }: { active?: boolean }) {
  return <FocusedIslandWorld active={active} className="topics-world" focus={TOPICS_FOCUS} landmark="topics" site="topics" />;
}
