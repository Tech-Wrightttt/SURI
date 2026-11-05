// Ground-plane translations follow the overview camera's vertical axis, so
// each location moves down without drifting sideways in the authored shot.
export const HISTORY_LOGS_OFFSET = { x: -5.7, z: 9 } as const;
export const WATCHTOWER_OFFSET = { x: -5.6, z: 9 } as const;

// One shared plaza drives terrain grading, paving, the fountain and NPC routes.
export const HUB_ROUNDABOUT = {
  x: HISTORY_LOGS_OFFSET.x, z: -3 + HISTORY_LOGS_OFFSET.z + 9.4,
  radius: 2.8, width: 1.5, floor: 4.8,
} as const;

export const LEADERBOARD_ISLAND = { rx: 6.6, rz: 5.2, selectionRadius: 4.4 } as const;
