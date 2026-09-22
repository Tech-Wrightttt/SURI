import type { MapConfig } from "./types";

export const TILE_SIZE = 1;
export const TILE_GAP = 0.06;
export const TILE_HEIGHT = 0.22;
export const ROAD_HEIGHT = 0.3;
export const ROAD_HALF_WIDTH = 1.15;
export const MAP_WIDTH = 112;
export const MAP_HEIGHT = 112;
export const PLAYABLE_INSET = 4;

export interface GridCoord { x: number; z: number }

export interface WorldBounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export function gridToWorld(x: number, z: number) {
  const offsetX = (MAP_WIDTH - 1) / 2;
  const offsetZ = (MAP_HEIGHT - 1) / 2;
  return { x: x - offsetX, z: z - offsetZ };
}

export function worldToGrid(worldX: number, worldZ: number): GridCoord | null {
  const offsetX = (MAP_WIDTH - 1) / 2;
  const offsetZ = (MAP_HEIGHT - 1) / 2;
  const x = Math.round(worldX + offsetX);
  const z = Math.round(worldZ + offsetZ);
  if (x < 0 || x >= MAP_WIDTH || z < 0 || z >= MAP_HEIGHT) return null;
  return { x, z };
}

export function isInBounds(x: number, z: number) {
  return x >= 0 && x < MAP_WIDTH && z >= 0 && z < MAP_HEIGHT;
}

export function isWalkable(map: MapConfig, x: number, z: number) {
  return isInBounds(x, z) && map.cells[z][x].walkable;
}

/** World-space envelope of generated, non-void terrain. */
export function getMapWorldBounds(map: MapConfig): WorldBounds {
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (let z = 0; z < map.height; z++) {
    for (let x = 0; x < map.width; x++) {
      if (map.cells[z][x].type === "void") continue;
      const world = gridToWorld(x, z);
      minX = Math.min(minX, world.x);
      maxX = Math.max(maxX, world.x);
      minZ = Math.min(minZ, world.z);
      maxZ = Math.max(maxZ, world.z);
    }
  }
  return { minX, maxX, minZ, maxZ };
}
