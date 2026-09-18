"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { CLIFF_DEEP, CLIFF_STONE, CLOUD_COLORS } from "@/lib/referenceVoxel/colors";
import { TILE_GAP, TILE_SIZE, gridToWorld } from "@/lib/referenceVoxel/gridUtils";
import { hash2 } from "@/lib/referenceVoxel/mapGenerator";
import { TileType, type MapConfig } from "@/lib/referenceVoxel/types";

function distanceFromVoid(map: MapConfig) {
  const distance = Array.from({ length: map.height }, () => Array(map.width).fill(Infinity)); const queue: { x: number; z: number }[] = [];
  for (let z = 0; z < map.height; z++) for (let x = 0; x < map.width; x++) if (map.cells[z][x].type === TileType.Void) { distance[z][x] = 0; queue.push({ x, z }); }
  for (let i = 0; i < queue.length; i++) { const current = queue[i]; for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const x = current.x + dx; const z = current.z + dz; if (x < 0 || x >= map.width || z < 0 || z >= map.height) continue; const next = distance[current.z][current.x] + 1; if (next >= distance[z][x]) continue; distance[z][x] = next; queue.push({ x, z }); } }
  return distance;
}

export function FloatingIslandUndersides({ map }: { map: MapConfig }) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const columns = useMemo(() => { const edgeDistance = distanceFromVoid(map); const result: { x: number; y: number; z: number; width: number; depth: number; color: string; rotation: number }[] = []; for (let z = 0; z < map.height; z++) for (let x = 0; x < map.width; x++) { if (map.cells[z][x].type === TileType.Void) continue; const world = gridToWorld(x, z); const distance = Math.min(edgeDistance[z][x], 15); const variation = hash2(x, z, 2701); const depth = 0.75 + distance * 0.3 + variation * 0.8; const width = (TILE_SIZE - TILE_GAP) * (0.9 - Math.min(distance, 10) * 0.012); const palette = distance > 5 ? CLIFF_DEEP : CLIFF_STONE; result.push({ x: world.x, y: -depth / 2 + 0.02, z: world.z, width, depth, color: palette[Math.floor(variation * palette.length) % palette.length], rotation: (variation - 0.5) * 0.08 }); } return result; }, [map]);
  useLayoutEffect(() => { const mesh = meshRef.current; if (!mesh) return; const object = new THREE.Object3D(); const color = new THREE.Color(); columns.forEach((column, index) => { object.position.set(column.x, column.y, column.z); object.scale.set(column.width, column.depth, column.width); object.rotation.set(column.rotation, column.rotation * 0.35, -column.rotation); object.updateMatrix(); mesh.setMatrixAt(index, object.matrix); mesh.setColorAt(index, color.set(column.color)); }); mesh.instanceMatrix.needsUpdate = true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true; mesh.computeBoundingSphere(); }, [columns]);
  return <instancedMesh ref={meshRef} args={[undefined, undefined, Math.max(columns.length, 1)]} castShadow receiveShadow><boxGeometry args={[1, 1, 1]} /><meshStandardMaterial roughness={0.94} flatShading /></instancedMesh>;
}

export function CloudSea() {
  const cloudRef = useRef<THREE.InstancedMesh>(null);
  const puffs = useMemo(() => { const result: { x: number; y: number; z: number; sx: number; sy: number; sz: number; color: string }[] = []; for (let cloud = 0; cloud < 42; cloud++) { const angle = hash2(cloud, 1, 3109) * Math.PI * 2; const radius = 10 + hash2(cloud, 2, 3191) * 66; const centerX = Math.cos(angle) * radius; const centerZ = Math.sin(angle) * radius; const centerY = -5.5 - hash2(cloud, 3, 3253) * 5; const puffCount = 3 + Math.floor(hash2(cloud, 4, 3301) * 3); for (let puff = 0; puff < puffCount; puff++) { const spread = puff - (puffCount - 1) / 2; const scale = 1.5 + hash2(cloud, puff, 3371) * 2.2; result.push({ x: centerX + spread * 1.7 + (hash2(cloud, puff, 3413) - 0.5), y: centerY + hash2(cloud, puff, 3461) * 0.7, z: centerZ + (hash2(puff, cloud, 3511) - 0.5) * 2.2, sx: scale * 1.35, sy: scale * 0.55, sz: scale, color: CLOUD_COLORS[(cloud + puff) % CLOUD_COLORS.length] }); } } return result; }, []);
  useLayoutEffect(() => { const mesh = cloudRef.current; if (!mesh) return; const object = new THREE.Object3D(); const color = new THREE.Color(); puffs.forEach((puff, index) => { object.position.set(puff.x, puff.y, puff.z); object.scale.set(puff.sx, puff.sy, puff.sz); object.rotation.set(0, hash2(index, 8, 3593) * Math.PI, 0); object.updateMatrix(); mesh.setMatrixAt(index, object.matrix); mesh.setColorAt(index, color.set(puff.color)); }); mesh.instanceMatrix.needsUpdate = true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true; mesh.computeBoundingSphere(); }, [puffs]);
  return <instancedMesh ref={cloudRef} args={[undefined, undefined, puffs.length]} receiveShadow><icosahedronGeometry args={[1, 1]} /><meshStandardMaterial roughness={1} flatShading /></instancedMesh>;
}
