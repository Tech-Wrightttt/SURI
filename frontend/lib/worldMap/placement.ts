import * as THREE from "three";
import { WORLD_BOUNDS, roadDistance, shoreDistance, terrainHeight } from "./landscape";

/** Terrain data is sampled on one shared grid so generation and rendering agree. */
export const TERRAIN_GRID_SIZE = 0.5;
export type TerrainKind = "LAND" | "COAST" | "WATER";
export type Footprint = { x: number; z: number; width: number; depth: number; rotation?: number };
export type StructureKind = "building" | "road" | "checkpoint" | "dock" | "boat" | "scenery";
export type Placement = { kind: StructureKind; footprint: Footprint; bounds: THREE.Box3; clearance?: number };
export type DockPlacement = { start: THREE.Vector2; outward: THREE.Vector2; rotation: number; length: number; landwardLength: number; width: number; approach?: THREE.Vector3[] };

type GridCell = { x: number; z: number; kind: TerrainKind };
const halfCell = TERRAIN_GRID_SIZE * 0.5;

export function gridToWorld(column: number, row: number) {
  return new THREE.Vector2(WORLD_BOUNDS.minX + column * TERRAIN_GRID_SIZE, WORLD_BOUNDS.minZ + row * TERRAIN_GRID_SIZE);
}

export function worldToGrid(x: number, z: number) {
  return { column: Math.round((x - WORLD_BOUNDS.minX) / TERRAIN_GRID_SIZE), row: Math.round((z - WORLD_BOUNDS.minZ) / TERRAIN_GRID_SIZE) };
}

function classifyTerrain(x: number, z: number): TerrainKind {
  const shore = shoreDistance(x, z);
  // Keep a full grid cell of stable ground for structures. The remaining thin
  // band is explicitly coast, which is the only valid dock origin.
  if (shore >= TERRAIN_GRID_SIZE) return "LAND";
  if (shore >= -halfCell) return "COAST";
  return "WATER";
}

/** Lazily materialized terrain tiles, shared by all procedural placements. */
export class TerrainGrid {
  private cells = new Map<string, GridCell>();
  cell(column: number, row: number): GridCell {
    const key = `${column}:${row}`;
    const cached = this.cells.get(key);
    if (cached) return cached;
    const point = gridToWorld(column, row);
    const cell = { x: point.x, z: point.y, kind: classifyTerrain(point.x, point.y) };
    this.cells.set(key, cell);
    return cell;
  }
  atWorld(x: number, z: number) {
    const { column, row } = worldToGrid(x, z);
    return this.cell(column, row);
  }
}

export const WORLD_TERRAIN_GRID = new TerrainGrid();
export function terrainKindAt(x: number, z: number): TerrainKind { return WORLD_TERRAIN_GRID.atWorld(x, z).kind; }

function isAllowed(kind: TerrainKind, allowed: readonly TerrainKind[]) { return allowed.includes(kind); }
function isInsideGridWorld(x: number, z: number) { return x >= WORLD_BOUNDS.minX && x <= WORLD_BOUNDS.maxX && z >= WORLD_BOUNDS.minZ && z <= WORLD_BOUNDS.maxZ; }
function isBoxInsideWorld(box: THREE.Box3) { return isInsideGridWorld(box.min.x, box.min.z) && isInsideGridWorld(box.max.x, box.max.z); }
function rotatedLocal(x: number, z: number, footprint: Footprint) {
  const rotation = footprint.rotation || 0, c = Math.cos(rotation), s = Math.sin(rotation);
  const dx = x - footprint.x, dz = z - footprint.z;
  return { x: dx * c - dz * s, z: dx * s + dz * c };
}

/**
 * Returns every grid tile touched by an oriented footprint. The half-cell
 * expansion makes this conservative: a building cannot straddle a water tile
 * merely because its center samples happen to be dry.
 */
export function footprintCells(footprint: Footprint): GridCell[] {
  const radius = Math.hypot(footprint.width, footprint.depth) * 0.5 + TERRAIN_GRID_SIZE;
  const min = worldToGrid(footprint.x - radius, footprint.z - radius);
  const max = worldToGrid(footprint.x + radius, footprint.z + radius);
  const cells: GridCell[] = [];
  for (let row = min.row; row <= max.row; row++) for (let column = min.column; column <= max.column; column++) {
    const point = gridToWorld(column, row);
    const local = rotatedLocal(point.x, point.y, footprint);
    if (Math.abs(local.x) <= footprint.width * 0.5 + halfCell && Math.abs(local.z) <= footprint.depth * 0.5 + halfCell) {
      cells.push(WORLD_TERRAIN_GRID.cell(column, row));
    }
  }
  return cells;
}

export function footprintBox(footprint: Footprint, minY = -0.25, maxY = 8) {
  const rotation = footprint.rotation || 0, c = Math.cos(rotation), s = Math.sin(rotation);
  const box = new THREE.Box3();
  for (const localX of [-footprint.width / 2, footprint.width / 2]) for (const localZ of [-footprint.depth / 2, footprint.depth / 2]) {
    box.expandByPoint(new THREE.Vector3(footprint.x + localX * c + localZ * s, minY, footprint.z - localX * s + localZ * c));
    box.expandByPoint(new THREE.Vector3(footprint.x + localX * c + localZ * s, maxY, footprint.z - localX * s + localZ * c));
  }
  return box;
}

export class PlacementValidator {
  private placed: Placement[] = [];

  canUseTerrain(footprint: Footprint, allowed: readonly TerrainKind[]) {
    const cells = footprintCells(footprint);
    return cells.length > 0 && cells.every(cell => isInsideGridWorld(cell.x, cell.z) && isAllowed(cell.kind, allowed));
  }

  intersectsPlaced(candidate: Placement) {
    return this.placed.some(existing => {
      const clearance = Math.max(candidate.clearance || 0, existing.clearance || 0);
      return candidate.bounds.clone().expandByScalar(clearance).intersectsBox(existing.bounds);
    });
  }

  canPlace(candidate: Placement, allowed: readonly TerrainKind[], avoidRoads = false) {
    if (!isBoxInsideWorld(candidate.bounds) || !this.canUseTerrain(candidate.footprint, allowed) || this.intersectsPlaced(candidate)) return false;
    return !avoidRoads || footprintCells(candidate.footprint).every(cell => roadDistance(cell.x, cell.z) > 1.35);
  }

  commit(candidate: Placement) { this.placed.push(candidate); return candidate; }

  tryPlace(candidate: () => Placement | null, allowed: readonly TerrainKind[], retries: number, avoidRoads = false) {
    for (let attempt = 0; attempt < retries; attempt++) {
      const next = candidate();
      if (next && this.canPlace(next, allowed, avoidRoads)) return this.commit(next);
    }
    return null;
  }
}

function sideFor(rotation: number) { return new THREE.Vector2(Math.cos(rotation), -Math.sin(rotation)); }

/** Pick an outward-facing shoreline point from terrain, never from a magic dock coordinate. */
export function findDockPlacement(preferredOutward: THREE.Vector2, length: number, width: number, retries = 180, landwardLength = 3, approachFrom?: readonly [number, number]): DockPlacement | null {
  const desired = preferredOutward.clone().normalize();
  const candidates: Array<{ placement: DockPlacement; score: number }> = [];
  for (let row = 1; row < (WORLD_BOUNDS.maxZ - WORLD_BOUNDS.minZ) / TERRAIN_GRID_SIZE - 1; row++) for (let column = 1; column < (WORLD_BOUNDS.maxX - WORLD_BOUNDS.minX) / TERRAIN_GRID_SIZE - 1; column++) {
    const point = gridToWorld(column, row);
    // A harbor approach belongs to the hub path network, not a disconnected
    // scenic key. Keep candidates close enough to the supplied settlement.
    if (approachFrom && point.distanceTo(new THREE.Vector2(approachFrom[0], approachFrom[1])) > 40) continue;
    if (terrainKindAt(point.x, point.y) !== "COAST") continue;
    const outward = new THREE.Vector2();
    for (const offset of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const neighbor = gridToWorld(column + offset[0], row + offset[1]);
      if (terrainKindAt(neighbor.x, neighbor.y) === "WATER") outward.add(new THREE.Vector2(offset[0], offset[1]));
    }
    if (outward.lengthSq() === 0) continue;
    outward.normalize();
    const rotation = Math.atan2(outward.x, outward.y);
    const dock: DockPlacement = { start: point, outward, rotation, length, landwardLength, width };
    const score = outward.dot(desired) - point.length() * 0.002;
    candidates.push({ placement: dock, score });
  }
  candidates.sort((a,b) => b.score - a.score);
  for (const { placement } of candidates.slice(0, retries)) {
    if (!validateDockTerrain(placement)) continue;
    if (approachFrom) {
      const entrance = placement.start.clone().addScaledVector(placement.outward, -placement.landwardLength);
      const approach = findLandPath(approachFrom, [entrance.x, entrance.y]);
      if (!approach) continue;
      placement.approach = approach;
    }
    return placement;
  }
  return null;
}

export function validateDockTerrain(dock: DockPlacement) {
  // The dock begins several tiles inland, where it can be visibly grounded and
  // meet a path. It only crosses the shoreline once before reaching water.
  for (let distance = -dock.landwardLength; distance < -TERRAIN_GRID_SIZE; distance += TERRAIN_GRID_SIZE) {
    const center = dock.start.clone().addScaledVector(dock.outward, distance);
    const footprint: Footprint = { x: center.x, z: center.y, width: dock.width, depth: TERRAIN_GRID_SIZE, rotation: dock.rotation };
    if (!footprintCells(footprint).every(cell => isInsideGridWorld(cell.x, cell.z) && isAllowed(cell.kind, ["LAND", "COAST"]))) return false;
  }
  // The first short transition may cross coast tiles; the remaining deck is
  // water-only, keeping the dock perpendicular and visibly seaward.
  for (let distance = TERRAIN_GRID_SIZE; distance <= dock.length; distance += TERRAIN_GRID_SIZE) {
    const center = dock.start.clone().addScaledVector(dock.outward, distance);
    const footprint: Footprint = { x: center.x, z: center.y, width: dock.width, depth: TERRAIN_GRID_SIZE, rotation: dock.rotation };
    const allowed = distance <= 1.5 ? ["COAST", "WATER"] as const : ["WATER"] as const;
    if (!footprintCells(footprint).every(cell => isInsideGridWorld(cell.x, cell.z) && isAllowed(cell.kind, allowed))) return false;
  }
  return true;
}

export function dockFootprint(dock: DockPlacement): Footprint {
  const totalLength = dock.length + dock.landwardLength;
  const center = dock.start.clone().addScaledVector(dock.outward, (dock.length - dock.landwardLength) * 0.5);
  return { x: center.x, z: center.y, width: dock.width, depth: totalLength, rotation: dock.rotation };
}

/** A dry, terrain-following connector from a settlement path to the dock's land end. */
export function dockApproachPath(dock: DockPlacement, from: readonly [number, number]) {
  if (dock.approach) return dock.approach;
  const entrance = dock.start.clone().addScaledVector(dock.outward, -dock.landwardLength);
  const inland = entrance.clone().addScaledVector(dock.outward, -3.5);
  return [new THREE.Vector3(from[0], 0, from[1]), new THREE.Vector3(inland.x, 0, inland.y), new THREE.Vector3(entrance.x, 0, entrance.y)];
}

/** A bounded grid route that keeps an access path entirely on stable land. */
export function findLandPath(from: readonly [number, number], to: readonly [number, number]) {
  const start = worldToGrid(from[0], from[1]), goal = worldToGrid(to[0], to[1]);
  const key = (column: number, row: number) => `${column}:${row}`;
  const startKey = key(start.column, start.row), goalKey = key(goal.column, goal.row);
  if (WORLD_TERRAIN_GRID.cell(start.column, start.row).kind !== "LAND" || !isAllowed(WORLD_TERRAIN_GRID.cell(goal.column, goal.row).kind, ["LAND", "COAST"])) return null;
  const previous = new Map<string, string | null>([[startKey, null]]);
  const queue: Array<{ column: number; row: number }> = [start];
  for (let head = 0; head < queue.length && queue.length < 48000; head++) {
    const current = queue[head], currentKey = key(current.column, current.row);
    if (currentKey === goalKey) break;
    for (const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]) {
      const column=current.column+dx,row=current.row+dz,nextKey=key(column,row);
      const terrain = WORLD_TERRAIN_GRID.cell(column,row).kind;
      if (previous.has(nextKey) || (nextKey === goalKey ? !isAllowed(terrain,["LAND","COAST"]) : terrain !== "LAND")) continue;
      previous.set(nextKey,currentKey); queue.push({column,row});
    }
  }
  if (!previous.has(goalKey)) return null;
  const cells: GridCell[] = [];
  for (let current: string | null = goalKey; current; current = previous.get(current) || null) {
    const [column,row] = current.split(":").map(Number); cells.push(WORLD_TERRAIN_GRID.cell(column,row));
  }
  cells.reverse();
  // Fewer points preserve the low-poly path style. The final cell is always
  // included, so the path meets the grounded dock entrance exactly.
  return cells.filter((_,index)=>index%3===0 || index===cells.length-1).map(cell=>new THREE.Vector3(cell.x,0,cell.z));
}

export function isLandPath(points: THREE.Vector3[]) {
  for (let index = 1; index < points.length; index++) for (let step = 0; step <= 20; step++) {
    const point = points[index - 1].clone().lerp(points[index], step / 20);
    if (terrainKindAt(point.x, point.z) !== "LAND") return false;
  }
  return true;
}

export function boatBesideDock(dock: DockPlacement, boatWidth: number, boatLength: number, side: 1 | -1, clearance = 0.8): Footprint {
  // Moor the boat just beyond the dock head. The Box3 loop turns the requested
  // visual clearance into a conservative world-space clearance even for docks
  // that are diagonally rotated against the grid.
  const dockEnd = dock.start.clone().addScaledVector(dock.outward, dock.length + boatLength * 0.5 + clearance + (side < 0 ? boatLength * 2 + 2 : 0));
  const offset = sideFor(dock.rotation).multiplyScalar(side * boatWidth * 0.75);
  const position = dockEnd.add(offset);
  const dockBox = footprintBox(dockFootprint(dock), -0.95, 1.1);
  const footprint: Footprint = { x: position.x, z: position.y, width: boatWidth, depth: boatLength, rotation: dock.rotation };
  for (let attempt = 0; attempt < 32 && footprintBox(footprint, -0.1, 4).expandByScalar(clearance).intersectsBox(dockBox); attempt++) {
    footprint.x += dock.outward.x * TERRAIN_GRID_SIZE;
    footprint.z += dock.outward.y * TERRAIN_GRID_SIZE;
  }
  return footprint;
}

export function waterHeight() { return terrainHeight(0, 0, -1) - 0.1; }
