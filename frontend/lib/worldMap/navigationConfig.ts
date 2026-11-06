// Keep shared navigation data dependency-free so the root shell can use it
// without loading the 3D scene or Three.js.
export const ISLAND_ROUTES = {
  "/progress": "champions", "/topics": "topics", "/calculator": "calculator", "/playground": "records", "/history-logs": "keep", "/leaderboard": "watchtower",
} as const;
export type IslandRoute = keyof typeof ISLAND_ROUTES;

// Give the camera enough time to establish its destination without making a
// map selection feel like a loading screen. The camera's smoother easing keeps
// both ends of this slightly longer motion calm rather than abrupt.
export const ZOOM_DURATION = 0.62;
export const RETURN_DURATION = 0.76;
// The destination has already been prefetched by intent, so this motion only
// hides the final handoff rather than becoming a visible loading delay.
export const TOPICS_APPROACH_DURATION = 0.78;

export type CameraCommand = {
  id: number;
  kind: "island" | "overview";
  site?: string;
  instant?: boolean;
  duration?: number;
  onComplete: () => void;
};
