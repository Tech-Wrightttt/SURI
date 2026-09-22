"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { GRASS_BORDER, GRASS_PLAYABLE, ROAD_COLORS, SAND_COLORS } from "@/lib/referenceVoxel/colors";
import { ROAD_HEIGHT, TILE_GAP, TILE_HEIGHT, TILE_SIZE, gridToWorld } from "@/lib/referenceVoxel/gridUtils";
import { TileType, type MapConfig } from "@/lib/referenceVoxel/types";

export function Ground({ map }: { map: MapConfig }) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const tiles = useMemo(() => {
    const list: { x: number; y: number; z: number; height: number; color: string }[] = [];
    for (let z = 0; z < map.height; z++) for (let x = 0; x < map.width; x++) {
      const cell = map.cells[z][x]; if (cell.type === TileType.Void) continue;
      const world = gridToWorld(x, z); const road = cell.type === TileType.Road; const border = cell.type === TileType.Border;
      const height = (road ? ROAD_HEIGHT : TILE_HEIGHT) + cell.elevation;
      const color = road ? ROAD_COLORS[cell.variant % ROAD_COLORS.length] : cell.type === TileType.Sand ? SAND_COLORS[cell.variant % SAND_COLORS.length] : border ? GRASS_BORDER[cell.variant % GRASS_BORDER.length] : GRASS_PLAYABLE[cell.variant % GRASS_PLAYABLE.length];
      list.push({ x: world.x, y: height / 2, z: world.z, height, color });
    }
    return list;
  }, [map]);
  useLayoutEffect(() => {
    const mesh = meshRef.current; if (!mesh) return; const object = new THREE.Object3D(); const color = new THREE.Color(); const size = TILE_SIZE - TILE_GAP;
    tiles.forEach((tile, index) => { object.position.set(tile.x, tile.y, tile.z); object.scale.set(size, tile.height, size); object.rotation.set(0, 0, 0); object.updateMatrix(); mesh.setMatrixAt(index, object.matrix); mesh.setColorAt(index, color.set(tile.color)); });
    mesh.instanceMatrix.needsUpdate = true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true; mesh.computeBoundingSphere();
  }, [tiles]);
  return <instancedMesh ref={meshRef} args={[undefined, undefined, Math.max(tiles.length, 1)]} receiveShadow><boxGeometry args={[1, 1, 1]} /><meshStandardMaterial roughness={0.82} metalness={0.02} flatShading /></instancedMesh>;
}
