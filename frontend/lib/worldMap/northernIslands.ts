import type { Island } from "./landscape";
import { WATCHTOWER_OFFSET as offset, LEADERBOARD_ISLAND } from "./mapLayout";

// Stagger the rear scenery in depth as well as across the view. Keep the
// Topics coastline open rather than following it with a continuous island row.
export const UPPER_ISLANDS = {
  windwardCay: {x:-2,z:-61,rx:2.8,rz:1.7,turn:-.45,seed:74,hill:2.5,biome:"highlands"},
  windwardNeedle: {x:-12,z:-57,rx:1.1,rz:.75,turn:.2,seed:75,hill:2.6,biome:"stack"},
  windwardReef: {x:-5,z:-65,rx:1.4,rz:.8,turn:.4,seed:76,hill:.18,biome:"reef"},
  dawnCay: {x:12,z:-58,rx:3,rz:1.9,turn:-.3,seed:77,hill:2.7,biome:"highlands"},
  dawnStack: {x:18,z:-64,rx:1.1,rz:.8,turn:.6,seed:78,hill:2.4,biome:"stack"},
  dawnShelf: {x:7,z:-54,rx:1.6,rz:.7,turn:.2,seed:79,hill:.2,biome:"reef"},
  cloudwardCay: {x:30,z:-47,rx:3.2,rz:2,turn:.4,seed:80,hill:2.4,biome:"highlands"},
  cloudwardNeedle: {x:37,z:-51,rx:1.15,rz:.8,turn:-.3,seed:81,hill:3,biome:"stack"},
  cloudwardReef: {x:21,z:-51,rx:1.5,rz:.7,turn:-.2,seed:82,hill:.14,biome:"reef"},
  sunwardCay: {x:49,z:-39,rx:3,rz:1.8,turn:-.4,seed:83,hill:2.2,biome:"ruins"},
  sunwardStack: {x:59,z:-27,rx:1.2,rz:.8,turn:.4,seed:84,hill:2.7,biome:"stack"},
  sunwardShelf: {x:61,z:-16,rx:1.6,rz:.8,turn:.1,seed:85,hill:.18,biome:"reef"},
} satisfies Record<string,Island>;

// The watchtower family moves together inside the existing camera envelope.
export const NORTHERN_ISLANDS = {
  wyrmrest: {x:25+offset.x,z:-24+offset.z,rx:LEADERBOARD_ISLAND.rx,rz:LEADERBOARD_ISLAND.rz,turn:-.38,seed:61,hill:3.6,biome:"ruins"},
  wyrmLedge: {x:21.5+offset.x,z:-27.5+offset.z,rx:1.9,rz:1.1,turn:.3,seed:62,hill:1.5,biome:"stack"},
  wyrmShoal: {x:18+offset.x,z:-35+offset.z,rx:1.6,rz:.75,turn:-.2,seed:63,hill:.16,biome:"reef"},
  northwood: {x:-39,z:-38,rx:4.5,rz:2.7,turn:-.6,seed:64,hill:2.7,biome:"highlands"},
  northwoodStack: {x:-44,z:-40,rx:1.5,rz:1.1,turn:.4,seed:65,hill:3,biome:"stack"},
  northwoodShoal: {x:-42,z:-35,rx:1.8,rz:.9,turn:.3,seed:66,hill:.2,biome:"reef"},
  oldQuarry: {x:-31,z:-48,rx:3.3,rz:2.1,turn:.2,seed:67,hill:3.2,biome:"ruins"},
  quarryScree: {x:-35,z:-46,rx:1.3,rz:.8,turn:-.6,seed:68,hill:1.8,biome:"stack"},
  eastReach: {x:32,z:-39,rx:4.2,rz:2.7,turn:-.4,seed:69,hill:3.1,biome:"ruins"},
  eastReachStack: {x:37,z:-41,rx:1.3,rz:1,turn:.4,seed:70,hill:3.4,biome:"stack"},
  eastReachReef: {x:35,z:-36,rx:1.7,rz:.9,turn:-.3,seed:71,hill:.18,biome:"reef"},
  gullhaven: {x:48,z:-29,rx:2.9,rz:2,turn:.6,seed:72,hill:2.3,biome:"sanctuary"},
  gullhavenSkerry: {x:52,z:-31,rx:1.1,rz:.7,turn:.8,seed:73,hill:2.4,biome:"stack"},
  ...UPPER_ISLANDS,
} satisfies Record<string,Island>;

export const WYRM_TOWER = {x:25+offset.x,z:-24+offset.z,floor:3.75,turn:.45} as const;
