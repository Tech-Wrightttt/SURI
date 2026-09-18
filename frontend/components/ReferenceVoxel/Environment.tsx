"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { BUSH_COLOR, FLOWER_COLORS, ROCK_COLOR, TREE_LEAVES, TREE_TRUNK } from "@/lib/referenceVoxel/colors";
import { TILE_HEIGHT } from "@/lib/referenceVoxel/gridUtils";
import type { DecorationDef } from "@/lib/referenceVoxel/types";

function setInstances(mesh: THREE.InstancedMesh | null, items: { x: number; z: number; y: number; sx: number; sy: number; sz: number; rot: number; color?: string }[]) {
  if (!mesh) return; const object = new THREE.Object3D(); const color = new THREE.Color();
  items.forEach((item, index) => { object.position.set(item.x, item.y, item.z); object.scale.set(item.sx, item.sy, item.sz); object.rotation.set(0, item.rot, 0); object.updateMatrix(); mesh.setMatrixAt(index, object.matrix); if (item.color) mesh.setColorAt(index, color.set(item.color)); });
  mesh.instanceMatrix.needsUpdate = true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true; mesh.computeBoundingSphere(); mesh.count = items.length;
}

export function Environment({ decorations }: { decorations: DecorationDef[] }) {
  const trunkRef = useRef<THREE.InstancedMesh>(null); const leafLowRef = useRef<THREE.InstancedMesh>(null); const leafTopRef = useRef<THREE.InstancedMesh>(null); const palmTrunkRef = useRef<THREE.InstancedMesh>(null); const palmCrownRef = useRef<THREE.InstancedMesh>(null); const bushRef = useRef<THREE.InstancedMesh>(null); const flowerRef = useRef<THREE.InstancedMesh>(null); const stemRef = useRef<THREE.InstancedMesh>(null); const rockRef = useRef<THREE.InstancedMesh>(null); const logRef = useRef<THREE.InstancedMesh>(null);
  const data = useMemo(() => {
    const trees = decorations.filter((d) => d.kind === "tree"); const palms = decorations.filter((d) => d.kind === "palm"); const bushes = decorations.filter((d) => d.kind === "bush"); const flowers = decorations.filter((d) => d.kind === "flower"); const rocks = decorations.filter((d) => d.kind === "rock"); const logs = decorations.filter((d) => d.kind === "log");
    const trunk = trees.map((t) => { const s = (t.scale ?? 1) * (0.9 + (t.variant % 3) * 0.08); const h = t.heightScale ?? 1; return { x: t.x, z: t.z, y: TILE_HEIGHT + (t.elevation ?? 0) + 0.3 * s * h, sx: s, sy: s * h, sz: s, rot: t.rotation, color: TREE_TRUNK }; });
    const leafLow = trees.map((t) => { const s = (t.scale ?? 1) * (0.9 + (t.variant % 3) * 0.1); const h = t.heightScale ?? 1; const canopy = t.canopyScale ?? 1; const tall = t.variant === 3 ? 0.25 : 0; return { x: t.x, z: t.z, y: TILE_HEIGHT + (t.elevation ?? 0) + (0.82 * s + tall) * h, sx: s * canopy, sy: s * (0.82 + h * 0.18), sz: s * canopy, rot: t.rotation, color: TREE_LEAVES[t.variant % TREE_LEAVES.length] }; });
    const leafTop = trees.map((t) => { const s = (t.scale ?? 1) * (0.85 + (t.variant % 3) * 0.1); const h = t.heightScale ?? 1; const canopy = t.canopyScale ?? 1; const tall = t.variant === 3 ? 0.4 : 0.15; return { x: t.x, z: t.z, y: TILE_HEIGHT + (t.elevation ?? 0) + (1.12 + tall) * s * h, sx: s * 0.68 * canopy, sy: s * 0.68, sz: s * 0.68 * canopy, rot: t.rotation, color: TREE_LEAVES[(t.variant + 1) % TREE_LEAVES.length] }; });
    const palmTrunk = palms.map((p) => { const s = p.scale ?? 1; const h = p.heightScale ?? 1; return { x: p.x, z: p.z, y: TILE_HEIGHT + (p.elevation ?? 0) + 0.55 * s * h, sx: s, sy: s * h, sz: s, rot: p.rotation, color: "#8b6a45" }; });
    const palmCrown = palms.map((p) => { const s = p.scale ?? 1; const h = p.heightScale ?? 1; const canopy = p.canopyScale ?? 1; return { x: p.x, z: p.z, y: TILE_HEIGHT + (p.elevation ?? 0) + 1.15 * s * h, sx: s * canopy, sy: s, sz: s * canopy, rot: p.rotation, color: TREE_LEAVES[(p.variant + 2) % TREE_LEAVES.length] }; });
    const bush = bushes.map((b) => ({ x: b.x, z: b.z, y: TILE_HEIGHT + (b.elevation ?? 0) + 0.14, sx: b.scale ?? 1, sy: b.scale ?? 1, sz: b.scale ?? 1, rot: b.rotation, color: BUSH_COLOR[b.variant % BUSH_COLOR.length] }));
    const stem = flowers.map((f) => ({ x: f.x, z: f.z, y: TILE_HEIGHT + (f.elevation ?? 0) + 0.1, sx: 1, sy: 1, sz: 1, rot: 0, color: "#558b2f" }));
    const head = flowers.map((f) => ({ x: f.x, z: f.z, y: TILE_HEIGHT + (f.elevation ?? 0) + 0.24, sx: 1, sy: 1, sz: 1, rot: 0, color: FLOWER_COLORS[f.variant % FLOWER_COLORS.length] }));
    const rock = rocks.map((r) => { const s = 0.8 + (r.variant % 3) * 0.3; return { x: r.x, z: r.z, y: TILE_HEIGHT + (r.elevation ?? 0) + 0.08, sx: s, sy: s * 0.7, sz: s, rot: r.rotation, color: ROCK_COLOR[r.variant % ROCK_COLOR.length] }; });
    const log = logs.map((l) => ({ x: l.x, z: l.z, y: TILE_HEIGHT + (l.elevation ?? 0) + 0.1, sx: l.scale ?? 1, sy: l.scale ?? 1, sz: l.scale ?? 1, rot: l.rotation, color: "#6d4c41" }));
    return { trunk, leafLow, leafTop, palmTrunk, palmCrown, bush, stem, head, rock, log, counts: { trees: trees.length, palms: palms.length, bushes: bushes.length, flowers: flowers.length, rocks: rocks.length, logs: logs.length } };
  }, [decorations]);
  useLayoutEffect(() => { setInstances(trunkRef.current, data.trunk); setInstances(leafLowRef.current, data.leafLow); setInstances(leafTopRef.current, data.leafTop); setInstances(palmTrunkRef.current, data.palmTrunk); setInstances(palmCrownRef.current, data.palmCrown); setInstances(bushRef.current, data.bush); setInstances(stemRef.current, data.stem); setInstances(flowerRef.current, data.head); setInstances(rockRef.current, data.rock); setInstances(logRef.current, data.log); }, [data]);
  const c = data.counts;
  return <group>
    {c.trees > 0 && <><instancedMesh ref={trunkRef} args={[undefined, undefined, c.trees]} castShadow><boxGeometry args={[0.2, 0.6, 0.2]} /><meshStandardMaterial roughness={0.85} flatShading /></instancedMesh><instancedMesh ref={leafLowRef} args={[undefined, undefined, c.trees]} castShadow><boxGeometry args={[0.85, 0.6, 0.85]} /><meshStandardMaterial roughness={0.75} flatShading /></instancedMesh><instancedMesh ref={leafTopRef} args={[undefined, undefined, c.trees]} castShadow><boxGeometry args={[0.85, 0.6, 0.85]} /><meshStandardMaterial roughness={0.75} flatShading /></instancedMesh></>}
    {c.palms > 0 && <><instancedMesh ref={palmTrunkRef} args={[undefined, undefined, c.palms]} castShadow><boxGeometry args={[0.16, 1.1, 0.16]} /><meshStandardMaterial roughness={0.9} flatShading /></instancedMesh><instancedMesh ref={palmCrownRef} args={[undefined, undefined, c.palms]} castShadow><boxGeometry args={[1.05, 0.22, 0.36]} /><meshStandardMaterial roughness={0.78} flatShading /></instancedMesh></>}
    {c.bushes > 0 && <instancedMesh ref={bushRef} args={[undefined, undefined, c.bushes]} castShadow><boxGeometry args={[0.45, 0.28, 0.45]} /><meshStandardMaterial roughness={0.8} flatShading /></instancedMesh>}
    {c.flowers > 0 && <><instancedMesh ref={stemRef} args={[undefined, undefined, c.flowers]}><boxGeometry args={[0.05, 0.2, 0.05]} /><meshStandardMaterial roughness={0.8} flatShading /></instancedMesh><instancedMesh ref={flowerRef} args={[undefined, undefined, c.flowers]}><boxGeometry args={[0.15, 0.1, 0.15]} /><meshStandardMaterial roughness={0.6} flatShading /></instancedMesh></>}
    {c.rocks > 0 && <instancedMesh ref={rockRef} args={[undefined, undefined, c.rocks]} castShadow><boxGeometry args={[0.3, 0.2, 0.26]} /><meshStandardMaterial roughness={0.95} flatShading /></instancedMesh>}
    {c.logs > 0 && <instancedMesh ref={logRef} args={[undefined, undefined, c.logs]} castShadow><boxGeometry args={[0.7, 0.18, 0.22]} /><meshStandardMaterial roughness={0.9} flatShading /></instancedMesh>}
  </group>;
}
