import * as THREE from "three";

export type MapPoint = [number, number];
export const WORLD_BOUNDS = { minX: -108, maxX: 108, minZ: -108, maxZ: 88 };

export const ISLANDS = {
  hub: { x: 0, z: -4, rx: 53, rz: 48 },
  progress: { x: -76, z: -10, rx: 22, rz: 20 },
  tactics: { x: 0, z: -76, rx: 21, rz: 21 },
  records: { x: 76, z: -6, rx: 22, rz: 20 },
  calculator: { x: 38, z: 58, rx: 21, rz: 19 },
  lanternCove: { x: -78, z: 47, rx: 10, rz: 7 },
  tidewatch: { x: 83, z: 44, rx: 8, rz: 6 },
  mossrock: { x: -83, z: -61, rx: 9, rz: 6 },
  starfall: { x: 78, z: -63, rx: 11, rz: 7 },
  pebbleKey: { x: 3, z: 84, rx: 6, rz: 4 },
} as const;

export const SITES = {
  keep: [0, -7], academy: [-24, -14], guild: [-11, 5], ranger: [14, -10], arena: [15, 15],
  champions: [-76, -10], thorns: [0, -76], records: [76, -6], calculator: [38, 58],
} satisfies Record<string, MapPoint>;

export const LAKES: Array<{ x: number; z: number; rx: number; rz: number }> = [
  { x: -32, z: 9, rx: 6.5, rz: 4.3 }, { x: 80, z: 7, rx: 4.5, rz: 3.1 }, { x: 47, z: 66, rx: 3.8, rz: 2.8 },
];
export const RIVER_PATHS: MapPoint[][] = [[[27, -43], [23, -34], [27, -24], [22, -14], [28, -5], [24, 7], [31, 18], [29, 32]]];
export const BRIDGES: Array<[MapPoint, MapPoint, "wood" | "stone"]> = [
  [[-46, -10], [-55, -10], "stone"], [[46, -6], [54, -6], "wood"], [[0, -51], [0, -56], "wood"], [[26, 31], [34, 43], "stone"],
];

function segmentDistance(x: number, z: number, a: MapPoint, b: MapPoint) {
  const dx = b[0] - a[0], dz = b[1] - a[1];
  const t = THREE.MathUtils.clamp(((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz), 0, 1);
  return Math.hypot(x - (a[0] + dx * t), z - (a[1] + dz * t));
}
function islandScore(x: number, z: number, island: { x: number; z: number; rx: number; rz: number }) {
  const angle = Math.atan2(z - island.z, x - island.x);
  const scallop = 1 + Math.sin(angle * 5 + island.x) * 0.055 + Math.sin(angle * 9 - island.z) * 0.028;
  return Math.min(island.rx, island.rz) * (1 - Math.hypot((x - island.x) / (island.rx * scallop), (z - island.z) / (island.rz * scallop)));
}

/** Positive on an island, zero on its beach, negative in the surrounding sea. */
export function shoreDistance(x: number, z: number) { return Math.max(...Object.values(ISLANDS).map(island => islandScore(x, z, island))); }
export function coastZ(x: number) {
  const hub = ISLANDS.hub, span = Math.sqrt(Math.max(0, 1 - ((x - hub.x) / hub.rx) ** 2));
  return hub.z + hub.rz * span;
}
export function riverDistance(x: number, z: number) { return Math.min(...RIVER_PATHS.flatMap(path => path.slice(1).map((point, index) => segmentDistance(x, z, path[index], point)))); }
export function riverWidth(z: number) { return 1.35 + z * 0; }
export function riverLevel(z: number) { return 0.34 + z * 0; }
export function bridgeDistance(x: number, z: number) { return Math.min(...BRIDGES.map(([a, b]) => segmentDistance(x, z, a, b))); }
function lakeAt(x: number, z: number) { return LAKES.find(lake => ((x - lake.x) / lake.rx) ** 2 + ((z - lake.z) / lake.rz) ** 2 < 1); }

export function terrainHeight(x: number, z: number, coast = shoreDistance(x, z)) {
  if (coast <= 0) return -1.1;
  const hill = (cx: number, cz: number, sx: number, sz: number, h: number) => h * Math.exp(-(((x - cx) / sx) ** 2 + ((z - cz) / sz) ** 2));
  let height = 0.85 + 0.3 * Math.sin(x * 0.32) * Math.cos(z * 0.23)
    + hill(-7, -35, 20, 15, 4.2) + hill(35, 25, 17, 18, 3.1) + hill(-38, 18, 15, 14, 2.6)
    + hill(-76, -10, 10, 10, 2.3) + hill(0, -76, 11, 11, 2.8) + hill(76, -6, 10, 10, 2.4) + hill(38, 58, 10, 9, 2.7)
    + hill(-78, 47, 5, 4, 1.1) + hill(83, 44, 4, 4, 1.2) + hill(-83, -61, 4, 3, 1.4) + hill(78, -63, 6, 4, 1.5);
  height *= THREE.MathUtils.smoothstep(coast, 0, 4.2);
  const river = riverDistance(x, z);
  if (river < 3.4) height = THREE.MathUtils.lerp(0.12, height, THREE.MathUtils.smoothstep(river, 1.15, 3.4));
  if (lakeAt(x, z)) height = 0.1;
  for (const [sx, sz] of Object.values(SITES)) height = THREE.MathUtils.lerp(1.35, height, THREE.MathUtils.smoothstep(Math.hypot(x - sx, z - sz), 5.5, 9));
  return height;
}

const roadRoutes: MapPoint[][] = [
  [[0, -7], [-11, 5], [-24, -14]], [[0, -7], [14, -10], [15, 15]], [[-11, 5], [-3, 15], [11, 23]],
  [[0, -7], [-25, -9], [-46, -10], [-55, -10], [-76, -10]], [[0, -7], [23, -7], [46, -6], [54, -6], [76, -6]],
  [[0, -7], [0, -29], [0, -51], [0, -56], [0, -76]], [[0, -7], [13, 13], [25, 31], [30, 38], [34, 43], [38, 58]],
  [[-24, -14], [-34, -2], [-38, 12], [-31, 20]], [[14, -10], [25, -15], [31, -26]],
];
export const ROADS = roadRoutes.map(points => new THREE.CatmullRomCurve3(points.map(([x, z]) => new THREE.Vector3(x, 0, z)), false, "centripetal").getPoints(80));
export function roadDistance(x: number, z: number) { return Math.min(...ROADS.flatMap(road => road.slice(1).map((point, index) => segmentDistance(x, z, [road[index].x, road[index].z], [point.x, point.z])))); }
export function roadHeight(x: number, z: number) { return bridgeDistance(x, z) < 1.3 ? 0.9 : terrainHeight(x, z) + 0.07; }
export const FARMS: MapPoint[] = [[-15, -28], [8, 24], [-37, -3]];
export function farmDistance(x: number, z: number) { return Math.min(...FARMS.map(([a, b]) => Math.hypot((x - a) / 1.2, z - b))); }
export function siteDistance(x: number, z: number) { return Math.min(...Object.values(SITES).map(([sx, sz]) => Math.hypot(x - sx, z - sz))); }
export function sitePosition(site: keyof typeof SITES): [number, number, number] { const [x, z] = SITES[site]; return [x, terrainHeight(x, z) + 0.06, z]; }
export function seededRandom(seed: number) { return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; }; }
