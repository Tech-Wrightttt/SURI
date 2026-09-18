import { MAP_HEIGHT, MAP_WIDTH, PLAYABLE_INSET, ROAD_HALF_WIDTH, gridToWorld, isInBounds, worldToGrid } from "./gridUtils";
import { createWorldPath, sampleCurvePoints } from "./pathGenerator";
import { TileType, type MapCell, type MapConfig } from "./types";

export const MAP_SEED = 7319;
const ROAD_SAMPLE_SEGMENTS = 900;
interface IslandDef { x: number; z: number; radiusX: number; radiusZ: number; rotation: number; seed: number; main?: boolean }
export const ISLAND_DEFS: IslandDef[] = [
  { x: 0, z: 0, radiusX: 24.5, radiusZ: 20, rotation: -0.12, seed: 101, main: true },
  { x: -39, z: -33, radiusX: 13.5, radiusZ: 11.5, rotation: 0.22, seed: 211 },
  { x: 39, z: -33, radiusX: 13.5, radiusZ: 11.5, rotation: -0.24, seed: 307 },
  { x: -39, z: 33, radiusX: 13.5, radiusZ: 11.5, rotation: -0.18, seed: 419 },
  { x: 39, z: 33, radiusX: 13.5, radiusZ: 11.5, rotation: 0.2, seed: 523 },
];

/** Short, straight access paths for the four destination islands. */
export const SECONDARY_PATHS = [
  { from: [-50, -33], to: [-39, -33] },
  { from: [50, -33], to: [39, -33] },
  { from: [-50, 33], to: [-39, 33] },
  { from: [50, 33], to: [39, 33] },
] as const;
export function hash2(x: number, z: number, seed = MAP_SEED) { let h = (x * 374761393 + z * 668265263 + seed * 982451653) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967295; }
function smoothstep(t: number) { return t * t * (3 - 2 * t); }
export function noise2(x: number, z: number, seed = MAP_SEED) { const ix = Math.floor(x); const iz = Math.floor(z); const fx = smoothstep(x - ix); const fz = smoothstep(z - iz); const a = hash2(ix, iz, seed); const b = hash2(ix + 1, iz, seed); const c = hash2(ix, iz + 1, seed); const d = hash2(ix + 1, iz + 1, seed); return (a + (b - a) * fx) + ((c + (d - c) * fx) - (a + (b - a) * fx)) * fz; }
export function fbm2(x: number, z: number, seed = MAP_SEED) { let value = 0; let amplitude = 0.58; let frequency = 1; let normalizer = 0; for (let octave = 0; octave < 3; octave++) { value += noise2(x * frequency, z * frequency, seed + octave * 97) * amplitude; normalizer += amplitude; amplitude *= 0.5; frequency *= 2; } return value / normalizer; }
function islandRadius(wx: number, wz: number, island: IslandDef) { const cos = Math.cos(island.rotation); const sin = Math.sin(island.rotation); const dx = wx - island.x; const dz = wz - island.z; const rx = dx * cos - dz * sin; const rz = dx * sin + dz * cos; return Math.hypot(rx / island.radiusX, rz / island.radiusZ); }
function islandAt(wx: number, wz: number) { for (const island of ISLAND_DEFS) { const radial = islandRadius(wx, wz, island); const broad = fbm2((wx + island.seed) * 0.075, (wz - island.seed) * 0.075, island.seed) - 0.5; const detail = noise2(wx * 0.19, wz * 0.19, island.seed + 17) - 0.5; const angle = Math.atan2(wz - island.z, wx - island.x); const silhouette = island.main ? Math.sin(angle * 3 + 0.7) * 0.105 + Math.sin(angle * 5 - 1.15) * 0.055 : Math.sin(angle * 3 + island.seed) * 0.055; const asymmetry = island.main ? ((wx - island.x) / island.radiusX) * 0.045 - ((wz - island.z) / island.radiusZ) * 0.025 : 0; const edge = 1 + broad * (island.main ? 0.3 : 0.22) + detail * 0.055 + silhouette + asymmetry; if (radial <= edge) return { island, radial: radial / edge }; } return null; }
function paintDisc(cells: MapCell[][], worldX: number, worldZ: number, radius: number, type: TileType, elevation: number) { const grid = worldToGrid(worldX, worldZ); if (!grid) return; const r = Math.ceil(radius) + 1; for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) { const x = grid.x + dx; const z = grid.z + dz; if (!isInBounds(x, z)) continue; const world = gridToWorld(x, z); if (Math.hypot(world.x - worldX, world.z - worldZ) <= radius) cells[z][x] = { type, walkable: type === TileType.Road, variant: (x * 5 + z * 11) & 3, elevation }; } }
function isVoidNeighbor(landMask: boolean[][], x: number, z: number) { for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) { if (!dx && !dz) continue; const nx = x + dx; const nz = z + dz; if (!isInBounds(nx, nz) || !landMask[nz][nx]) return true; } return false; }
function paintLine(cells: MapCell[][], from: readonly [number, number], to: readonly [number, number], radius: number) { const distance = Math.hypot(to[0] - from[0], to[1] - from[1]); const steps = Math.max(1, Math.ceil(distance * 2)); for (let step = 0; step <= steps; step++) { const t = step / steps; paintDisc(cells, from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t, radius, TileType.Road, 0.05); } }
export function generateMap(): MapConfig {
  const cells: MapCell[][] = []; const landMask: boolean[][] = [];
  for (let z = 0; z < MAP_HEIGHT; z++) { const row: MapCell[] = []; const maskRow: boolean[] = []; for (let x = 0; x < MAP_WIDTH; x++) { const { x: wx, z: wz } = gridToWorld(x, z); const insideBounds = x >= PLAYABLE_INSET && x < MAP_WIDTH - PLAYABLE_INSET && z >= PLAYABLE_INSET && z < MAP_HEIGHT - PLAYABLE_INSET; const hit = insideBounds ? islandAt(wx, wz) : null; maskRow.push(Boolean(hit)); if (!hit) { row.push({ type: TileType.Void, walkable: false, variant: (x * 3 + z * 7) & 3, elevation: -0.08 }); continue; } const interior = Math.max(0, 1 - hit.radial); const hills = fbm2(wx * 0.075, wz * 0.075, hit.island.seed + 233) - 0.5; const detail = noise2(wx * 0.24, wz * 0.24, hit.island.seed + 401) - 0.5; const heightScale = hit.island.main ? 1.05 : 0.42; row.push({ type: TileType.Grass, walkable: true, variant: Math.floor(hash2(x, z, hit.island.seed) * 4), elevation: Math.max(0.015, interior * heightScale + hills * 0.28 + detail * 0.08) }); } cells.push(row); landMask.push(maskRow); }
  for (let z = 0; z < MAP_HEIGHT; z++) for (let x = 0; x < MAP_WIDTH; x++) if (landMask[z][x] && isVoidNeighbor(landMask, x, z)) { const beach = hash2(x, z, MAP_SEED + 59) > 0.22; if (beach) { cells[z][x].type = TileType.Sand; cells[z][x].elevation = Math.min(cells[z][x].elevation, 0.12); cells[z][x].variant = Math.floor(hash2(x, z, MAP_SEED + 59) * 4); } }
  const { mainCurve } = createWorldPath(); sampleCurvePoints(mainCurve, ROAD_SAMPLE_SEGMENTS).forEach((point) => paintDisc(cells, point.x, point.z, ROAD_HALF_WIDTH, TileType.Road, 0.05));
  SECONDARY_PATHS.forEach(({ from, to }) => paintLine(cells, from, to, 1.05));
  return { width: MAP_WIDTH, height: MAP_HEIGHT, cells };
}
