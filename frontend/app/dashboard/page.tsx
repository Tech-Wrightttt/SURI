"use client";

import { Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Html, OrbitControls, Sparkles } from "@react-three/drei";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import * as THREE from "three";
import MainPage from "@/components/mainpage";
import {
  ActiveSessionProgress,
  getMe,
  getStudentProgress,
  MisconceptionHistoryItem,
} from "../../lib/api";

type Point3 = [number, number, number];

const COLORS = {
  grass: "#6fcf75",
  grassLight: "#a1ed86",
  dirt: "#70483b",
  stone: "#5e607d",
  stoneDark: "#27243f",
  wood: "#a9674e",
  woodDark: "#54324c",
  purple: "#9a72f2",
  purpleDark: "#4c2c82",
  water: "#43c9e8",
  gold: "#ffd76a",
};

const ISO_POLAR_ANGLE = Math.acos(1 / Math.sqrt(3));
const ISO_AZIMUTH_ANGLE = Math.PI / 4;
const ISO_CAMERA_POSITION: Point3 = [24, 24, 24];

function Block({
  position,
  size = [1, 1, 1],
  color,
  emissive,
  opacity = 1,
  rotation = [0, 0, 0],
}: {
  position: Point3;
  size?: Point3;
  color: string;
  emissive?: string;
  opacity?: number;
  rotation?: Point3;
}) {
  return (
    <mesh position={position} rotation={rotation} castShadow receiveShadow>
      <boxGeometry args={size} />
      <meshStandardMaterial
        color={color}
        emissive={emissive || "#000000"}
        emissiveIntensity={emissive ? 0.45 : 0}
        roughness={0.9}
        transparent={opacity < 1}
        opacity={opacity}
      />
    </mesh>
  );
}

function InstancedBlocks({
  positions,
  size,
  color,
  emissive,
}: {
  positions: Point3[];
  size: Point3;
  color: string;
  emissive?: string;
}) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    if (!meshRef.current) return;
    const object = new THREE.Object3D();
    positions.forEach(([x, y, z], index) => {
      object.position.set(x, y, z);
      object.updateMatrix();
      meshRef.current?.setMatrixAt(index, object.matrix);
    });
    meshRef.current.instanceMatrix.needsUpdate = true;
  }, [positions]);
  if (positions.length === 0) return null;
  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, positions.length]} castShadow receiveShadow>
      <boxGeometry args={size} />
      <meshStandardMaterial color={color} emissive={emissive || "#000000"} emissiveIntensity={emissive ? 0.25 : 0} roughness={0.92} />
    </instancedMesh>
  );
}

function SteppedRoof({ color = COLORS.purple, scale = 1 }: { color?: string; scale?: number }) {
  return (
    <group>
      <Block position={[0, 0, 0]} size={[2.8 * scale, 0.45, 2.8 * scale]} color={color} />
      <Block position={[0, 0.42 * scale, 0]} size={[2.15 * scale, 0.45, 2.15 * scale]} color={color} />
      <Block position={[0, 0.84 * scale, 0]} size={[1.35 * scale, 0.45, 1.35 * scale]} color={color} />
      <Block position={[0, 1.26 * scale, 0]} size={[0.5 * scale, 0.45, 0.5 * scale]} color={COLORS.gold} emissive={COLORS.gold} />
    </group>
  );
}

function Tree({ position, scale = 1 }: { position: Point3; scale?: number }) {
  return (
    <group position={position} scale={scale}>
      <Block position={[0, 0.78, 0]} size={[0.26, 1.62, 0.26]} color={COLORS.woodDark} />
      <Block position={[-0.26, 1.15, 0.05]} size={[0.55, 0.17, 0.17]} color={COLORS.wood} />
      <Block position={[0.24, 1.35, -0.06]} size={[0.5, 0.17, 0.17]} color={COLORS.wood} />
      <Block position={[0, 1.6, 0]} size={[1.2, 0.62, 1.2]} color={COLORS.grass} />
      <Block position={[-0.3, 1.86, 0.25]} size={[0.72, 0.62, 0.72]} color={COLORS.grassLight} />
      <Block position={[0.34, 1.9, -0.24]} size={[0.68, 0.65, 0.68]} color="#5aae66" />
      <Block position={[0, 2.27, 0]} size={[0.72, 0.52, 0.72]} color={COLORS.grassLight} />
      <Block position={[-0.45, 1.63, -0.32]} size={[0.46, 0.46, 0.46]} color="#4b9e5d" />
    </group>
  );
}

type HouseVariant = "cottage" | "longhouse" | "shop" | "barn";

function VillageHome({ position, scale = 1, variant = "cottage" }: { position: Point3; scale?: number; variant?: HouseVariant }) {
  const width = variant === "longhouse" ? 2.05 : variant === "barn" ? 1.75 : 1.45;
  const depth = variant === "longhouse" ? 1.35 : variant === "barn" ? 1.55 : 1.25;
  const roof = variant === "shop" ? COLORS.gold : variant === "barn" ? COLORS.grass : COLORS.purpleDark;
  return (
    <group position={position} scale={scale}>
      <Block position={[0, 0.55, 0]} size={[width, 1.1, depth]} color={variant === "barn" ? COLORS.woodDark : COLORS.wood} />
      <Block position={[0, 1.18, 0]} size={[width + 0.2, 0.3, depth + 0.2]} color={roof} />
      <Block position={[0, 1.52, 0]} size={[width * 0.7, 0.28, depth * 0.7]} color={variant === "shop" ? COLORS.purple : COLORS.purpleDark} />
      <Block position={[0, 0.57, depth / 2 + 0.055]} size={[0.34, 0.72, 0.1]} color={COLORS.woodDark} />
      <Block position={[-width * 0.3, 0.73, depth / 2 + 0.06]} size={[0.24, 0.3, 0.08]} color={COLORS.gold} emissive={COLORS.gold} />
      <Block position={[width * 0.3, 0.73, depth / 2 + 0.06]} size={[0.24, 0.3, 0.08]} color={COLORS.gold} emissive={COLORS.gold} />
      <Block position={[-width / 2 - 0.08, 0.65, 0]} size={[0.16, 1.3, 0.16]} color={COLORS.woodDark} />
      <Block position={[width / 2 + 0.08, 0.65, 0]} size={[0.16, 1.3, 0.16]} color={COLORS.woodDark} />
      {variant === "longhouse" && <Block position={[width / 2 + 0.65, 0.45, 0]} size={[0.75, 0.9, depth * 0.78]} color={COLORS.wood} />}
      {variant === "barn" && <Block position={[0, 1.95, 0]} size={[0.32, 0.68, 0.32]} color={COLORS.stoneDark} />}
      {variant === "shop" && <Block position={[0, 1.08, depth / 2 + 0.12]} size={[0.8, 0.42, 0.08]} color={COLORS.gold} emissive={COLORS.gold} />}
    </group>
  );
}

function TownSquare({ position }: { position: Point3 }) {
  return (
    <group position={position}>
      <Block position={[0, 0.38, 0]} size={[4.8, 0.12, 3.8]} color={COLORS.dirt} />
      {[-1.7, -0.85, 0, 0.85, 1.7].flatMap((x, row) => [-1.15, -0.35, 0.45, 1.25].map((z) => (
        <Block key={`${row}-${z}`} position={[x, 0.47, z]} size={[0.68, 0.08, 0.62]} color={row % 2 ? COLORS.stone : COLORS.stoneDark} />
      )))}
      <Block position={[0, 0.72, 0]} size={[0.72, 0.52, 0.72]} color={COLORS.stone} />
      <Block position={[0, 1.05, 0]} size={[0.48, 0.16, 0.48]} color={COLORS.water} emissive={COLORS.water} />
      {[-1.9, 1.9].map((x) => <Block key={x} position={[x, 0.95, 1.35]} size={[0.16, 1.05, 0.16]} color={COLORS.woodDark} />)}
      {[-1.9, 1.9].map((x) => <Block key={`lamp-${x}`} position={[x, 1.55, 1.35]} size={[0.34, 0.28, 0.34]} color={COLORS.gold} emissive={COLORS.gold} />)}
    </group>
  );
}

function VillagePath({ from, to, width = 0.34 }: { from: Point3; to: Point3; width?: number }) {
  const dx = to[0] - from[0];
  const dz = to[2] - from[2];
  const length = Math.hypot(dx, dz);
  return (
    <Block
      position={[(from[0] + to[0]) / 2, 0.39, (from[2] + to[2]) / 2]}
      size={[width, 0.08, length]}
      color={COLORS.dirt}
      rotation={[0, Math.atan2(dx, dz), 0]}
    />
  );
}

function Watchtower({ position, scale = 1 }: { position: Point3; scale?: number }) {
  return (
    <group position={position} scale={scale}>
      <Block position={[0, 0.85, 0]} size={[1.05, 1.7, 1.05]} color={COLORS.stone} />
      <Block position={[0, 1.78, 0]} size={[1.35, 0.24, 1.35]} color={COLORS.stoneDark} />
      <Block position={[-0.48, 2.1, -0.48]} size={[0.14, 0.72, 0.14]} color={COLORS.woodDark} />
      <Block position={[0.48, 2.1, -0.48]} size={[0.14, 0.72, 0.14]} color={COLORS.woodDark} />
      <Block position={[-0.48, 2.1, 0.48]} size={[0.14, 0.72, 0.14]} color={COLORS.woodDark} />
      <Block position={[0.48, 2.1, 0.48]} size={[0.14, 0.72, 0.14]} color={COLORS.woodDark} />
      <group position={[0, 2.2, 0]}>
        <SteppedRoof color={COLORS.purpleDark} scale={0.48} />
      </group>
      <Block position={[0, 3.0, 0]} size={[0.22, 0.45, 0.22]} color={COLORS.gold} emissive={COLORS.gold} />
    </group>
  );
}

function Coliseum() {
  const outerRing = Array.from({ length: 18 }, (_, index) => (index / 18) * Math.PI * 2);
  const innerRing = Array.from({ length: 14 }, (_, index) => (index / 14) * Math.PI * 2);
  return (
    <group>
      <Block position={[0, 0.42, 0]} size={[6.4, 0.84, 4.9]} color={COLORS.stoneDark} />
      <Block position={[0, 0.88, 0]} size={[5.75, 0.14, 4.25]} color={COLORS.stone} />
      <Block position={[0, 1.0, 0]} size={[4.8, 0.12, 3.35]} color={COLORS.gold} />
      <Block position={[0, 1.08, 0]} size={[3.8, 0.1, 2.55]} color={COLORS.dirt} />
      {outerRing.map((angle) => (
        <group key={`outer-${angle}`} position={[Math.cos(angle) * 2.65, 1.72, Math.sin(angle) * 1.85]} rotation={[0, -angle, 0]}>
          <Block position={[0, 0, 0]} size={[0.48, 1.35, 0.46]} color={COLORS.stone} />
          <Block position={[0, 0.8, 0]} size={[0.62, 0.2, 0.58]} color={COLORS.stoneDark} />
        </group>
      ))}
      {innerRing.map((angle) => (
        <group key={`inner-${angle}`} position={[Math.cos(angle) * 2.05, 1.08, Math.sin(angle) * 1.35]} rotation={[0, -angle, 0]}>
          <Block position={[0, 0, 0]} size={[0.32, 0.55, 0.34]} color={COLORS.stoneDark} />
        </group>
      ))}
      {[-1.25, 1.25].map((x) => (
        <group key={x} position={[x, 2.65, 0]}>
          <Block position={[0, 0, -1.83]} size={[0.34, 1.1, 0.34]} color={COLORS.stone} />
          <Block position={[0, 0, 1.83]} size={[0.34, 1.1, 0.34]} color={COLORS.stone} />
        </group>
      ))}
      <Block position={[0, 3.2, -1.83]} size={[2.9, 0.3, 0.36]} color={COLORS.stoneDark} />
      <Block position={[0, 3.2, 1.83]} size={[2.9, 0.3, 0.36]} color={COLORS.stoneDark} />
      <Block position={[0, 2.75, 0]} size={[0.22, 0.8, 0.22]} color={COLORS.woodDark} />
      <Block position={[0.4, 2.95, 0]} size={[0.75, 0.42, 0.08]} color={COLORS.gold} emissive={COLORS.gold} />
    </group>
  );
}

function Lake({ position, size = [3, 2] }: { position: Point3; size?: [number, number] }) {
  const [width, depth] = size;
  const cells = useMemo(() => {
    const result: Point3[] = [];
    for (let x = -width; x <= width; x += 1) {
      for (let z = -depth; z <= depth; z += 1) {
        if (Math.abs(x) / width + Math.abs(z) / depth < 1.35) result.push([x * 0.52, 0, z * 0.52]);
      }
    }
    return result;
  }, [width, depth]);
  const deepCells = useMemo(() => cells.map(([x, , z]) => [x, -0.2, z] as Point3), [cells]);
  return (
    <group position={position}>
      <InstancedBlocks positions={deepCells} size={[0.6, 0.42, 0.6]} color="#165a78" />
      <InstancedBlocks positions={cells} size={[0.58, 0.1, 0.58]} color="#3aa9c2" emissive="#2b92ad" />
      <Block position={[0, -0.01, 0]} size={[width * 0.72, 0.035, 0.18]} color="#d6f6f4" emissive="#b7eef2" opacity={0.3} />
    </group>
  );
}

function River({ points }: { points: Point3[] }) {
  return (
    <group>
      {points.map(([x, y, z], index) => (
        <group key={index} position={[x, y, z]}>
          <Block position={[0, -0.18, 0]} size={[0.7, 0.4, 0.8]} color="#176b91" />
          <Block position={[0, 0.06, 0]} size={[0.6, 0.1, 0.72]} color={index % 2 ? COLORS.water : "#75e0ee"} emissive={COLORS.water} />
          {index % 2 === 0 && <Block position={[0.38, 0.06, 0]} size={[0.42, 0.1, 0.58]} color={COLORS.water} emissive={COLORS.water} />}
        </group>
      ))}
    </group>
  );
}

function Waterfall({ position, height = 3.6 }: { position: Point3; height?: number }) {
  const levels = Math.max(3, Math.floor(height / 0.55));
  return (
    <group position={position}>
      {Array.from({ length: levels }, (_, index) => (
        <Block key={index} position={[(index % 2) * 0.12, -index * 0.55, (index % 3 - 1) * 0.08]} size={[0.34, 0.62, 0.34]} color={index % 2 ? COLORS.water : "#73e2f0"} emissive={COLORS.water} opacity={0.78} />
      ))}
      <Block position={[0.1, -height - 0.15, 0]} size={[1.05, 0.16, 0.8]} color="#9cf1f3" emissive={COLORS.water} opacity={0.68} />
    </group>
  );
}

function VoxelBridge({ from, to }: { from: Point3; to: Point3 }) {
  const steps = Math.max(5, Math.ceil(Math.hypot(to[0] - from[0], to[2] - from[2]) / 0.8));
  const rotation = Math.atan2(to[0] - from[0], to[2] - from[2]);
  return (
    <group>
      {Array.from({ length: steps + 1 }, (_, index) => {
        const t = index / steps;
        const x = THREE.MathUtils.lerp(from[0], to[0], t);
        const y = THREE.MathUtils.lerp(from[1], to[1], t);
        const z = THREE.MathUtils.lerp(from[2], to[2], t);
        return (
          <group key={index} position={[x, y, z]} rotation={[0, rotation, 0]}>
            <Block position={[0, 0, 0]} size={[0.96, 0.2, 0.82]} color={index % 2 ? COLORS.wood : COLORS.woodDark} />
            {index % 2 === 0 && <>
              <Block position={[-0.43, 0.34, 0]} size={[0.16, 0.66, 0.16]} color={COLORS.stoneDark} />
              <Block position={[0.43, 0.34, 0]} size={[0.16, 0.66, 0.16]} color={COLORS.stoneDark} />
              <Block position={[0, 0.61, 0]} size={[0.96, 0.13, 0.13]} color={COLORS.stone} />
            </>}
            {index % 6 === 0 && <>
              <Block position={[-0.25, -0.68, 0]} size={[0.34, 1.5, 0.46]} color={COLORS.stoneDark} />
              <Block position={[0.25, -0.68, 0]} size={[0.34, 1.5, 0.46]} color={COLORS.stone} />
              <Block position={[0, -1.38, 0]} size={[0.9, 0.22, 0.5]} color={COLORS.stoneDark} />
              <Block position={[0, 0.92, 0]} size={[0.2, 0.28, 0.2]} color={COLORS.gold} emissive={COLORS.gold} />
            </>}
          </group>
        );
      })}
    </group>
  );
}

function islandEdgePoint(center: Point3, radiusX: number, radiusZ: number, direction: Point3, gap: number): Point3 {
  const length = Math.hypot(direction[0], direction[2]) || 1;
  const unitX = direction[0] / length;
  const unitZ = direction[2] / length;
  const edgeDistance = 1 / Math.sqrt((unitX / radiusX) ** 2 + (unitZ / radiusZ) ** 2);
  return [center[0] + unitX * (edgeDistance - gap), 0.4, center[2] + unitZ * (edgeDistance - gap)];
}

function IslandBridge({ destination, islandSize }: { destination: Point3; islandSize: [number, number] }) {
  const endpoints = useMemo(() => {
    const direction: Point3 = [destination[0], 0, destination[2]];
    const from = islandEdgePoint([0, 0, 0], 22.5, 14.1, direction, 0.7);
    const radiusX = islandSize[0] * 0.325 * 1.06;
    const radiusZ = islandSize[1] * 0.325 * 1.06;
    const to = islandEdgePoint(destination, radiusX, radiusZ, [-destination[0], 0, -destination[2]], 0.1);
    return { from, to };
  }, [destination, islandSize]);
  return <VoxelBridge from={endpoints.from} to={endpoints.to} />;
}

function Tower({ position, height = 2.8, roof = COLORS.purple }: { position: Point3; height?: number; roof?: string }) {
  return (
    <group position={position}>
      <Block position={[0, height / 2, 0]} size={[1.25, height, 1.25]} color={COLORS.stone} />
      <Block position={[0, height / 2 + 0.05, 0.64]} size={[0.42, 0.65, 0.08]} color={COLORS.gold} emissive={COLORS.gold} />
      <group position={[0, height + 0.16, 0]} scale={0.52}>
        <SteppedRoof color={roof} />
      </group>
    </group>
  );
}

function Castle() {
  return (
    <group position={[0, 0.35, -0.2]}>
      <Block position={[0, 0.95, 0]} size={[4.4, 1.9, 3]} color={COLORS.stone} />
      <Block position={[0, 1.95, 0]} size={[3.35, 0.26, 2.2]} color={COLORS.purpleDark} />
      <Block position={[0, 0.9, 1.56]} size={[0.85, 1.2, 0.14]} color={COLORS.woodDark} />
      <Block position={[-0.9, 1.2, 1.58]} size={[0.33, 0.48, 0.12]} color={COLORS.gold} emissive={COLORS.gold} />
      <Block position={[0.9, 1.2, 1.58]} size={[0.33, 0.48, 0.12]} color={COLORS.gold} emissive={COLORS.gold} />
      <Tower position={[-1.65, 0, -1.05]} />
      <Tower position={[1.65, 0, -1.05]} />
      <Tower position={[-1.65, 0, 1.05]} height={2.45} />
      <Tower position={[1.65, 0, 1.05]} height={2.45} />
      <Block position={[0, 3.35, 0]} size={[0.28, 1.9, 0.28]} color={COLORS.woodDark} />
      <Block position={[0.58, 3.72, 0]} size={[1.15, 0.65, 0.08]} color={COLORS.purple} />
      <Block position={[-0.58, 3.72, 0]} size={[1.15, 0.65, 0.08]} color={COLORS.gold} />
      <Block position={[0, 2.18, 1.58]} size={[0.12, 0.12, 0.12]} color={COLORS.gold} emissive={COLORS.gold} />
      <Block position={[0, 2.18, -1.58]} size={[0.12, 0.12, 0.12]} color={COLORS.gold} emissive={COLORS.gold} />
    </group>
  );
}

function QuestGuild() {
  return (
    <group>
      <Block position={[0, 0.75, 0]} size={[2.6, 1.5, 1.9]} color={COLORS.wood} />
      <Block position={[0, 1.58, 0]} size={[2.9, 0.32, 2.2]} color={COLORS.purpleDark} />
      <Block position={[0, 1.95, 0]} size={[2.35, 0.32, 1.7]} color={COLORS.purple} />
      <Block position={[0, 2.32, 0]} size={[1.45, 0.32, 1.05]} color={COLORS.purple} />
      <Block position={[0, 0.82, 0.99]} size={[0.75, 1.1, 0.12]} color={COLORS.woodDark} />
      <Block position={[0, 1.85, 1.16]} size={[0.9, 0.68, 0.12]} color={COLORS.gold} emissive={COLORS.gold} />
      <Block position={[-1.15, 1.15, 1.03]} size={[0.22, 0.9, 0.22]} color={COLORS.woodDark} />
      <Block position={[1.15, 1.15, 1.03]} size={[0.22, 0.9, 0.22]} color={COLORS.woodDark} />
      <Block position={[0, 2.7, 0]} size={[0.16, 0.9, 0.16]} color={COLORS.woodDark} />
      <Block position={[0, 3.1, 0]} size={[0.62, 0.4, 0.08]} color={COLORS.gold} emissive={COLORS.gold} />
    </group>
  );
}

function ThornRuin() {
  const thorns: Point3[] = [[-1.3, 0.55, -0.9], [-0.9, 1.1, -0.9], [-0.45, 0.55, -1.15], [0.7, 0.75, -0.95], [1.25, 0.55, -0.55], [-1.2, 0.7, 0.75], [1.35, 0.8, 0.7]];
  return (
    <group>
      <Block position={[0, 0.65, 0]} size={[2.8, 1.3, 1.8]} color={COLORS.stoneDark} />
      <Block position={[-0.85, 1.5, 0]} size={[0.7, 1.8, 0.7]} color={COLORS.stone} />
      <Block position={[0.9, 1.15, 0]} size={[0.7, 1.1, 0.7]} color={COLORS.stone} />
      <Block position={[0, 1.2, 0.95]} size={[1.1, 0.15, 0.1]} color={COLORS.purple} emissive={COLORS.purple} />
      {thorns.map((point, index) => (
        <group key={index} position={point} rotation={[0, index * 0.8, index % 2 ? 0.7 : -0.6]}>
          <Block position={[0, 0, 0]} size={[0.22, 1.45, 0.22]} color={COLORS.purpleDark} emissive={COLORS.purpleDark} />
          <Block position={[0.28, 0.32, 0]} size={[0.55, 0.18, 0.18]} color={COLORS.purple} />
        </group>
      ))}
    </group>
  );
}

function RangerHall() {
  return (
    <group>
      <Block position={[0, 0.78, 0]} size={[2.8, 1.55, 2]} color={COLORS.woodDark} />
      <Block position={[0, 1.56, 0]} size={[3.1, 0.34, 2.3]} color={COLORS.grass} />
      <Block position={[0, 1.96, 0]} size={[2.45, 0.34, 1.85]} color={COLORS.grassLight} />
      <Block position={[0, 2.36, 0]} size={[1.5, 0.34, 1.15]} color={COLORS.grass} />
      <Block position={[0, 0.78, 1.05]} size={[0.7, 1.05, 0.12]} color={COLORS.gold} emissive={COLORS.gold} />
      <Block position={[-1.15, 1.05, 1.06]} size={[0.22, 1.45, 0.22]} color={COLORS.wood} />
      <Block position={[1.15, 1.05, 1.06]} size={[0.22, 1.45, 0.22]} color={COLORS.wood} />
      <Block position={[0, 1.9, 1.2]} size={[0.85, 0.58, 0.12]} color={COLORS.purple} emissive={COLORS.purple} />
      <Block position={[-0.88, 1.78, 0]} size={[0.18, 0.9, 0.18]} color={COLORS.wood} />
      <Block position={[0.88, 1.78, 0]} size={[0.18, 0.9, 0.18]} color={COLORS.wood} />
    </group>
  );
}

function DestinationBuilding({ kind }: { kind: "academy" | "records" | "colosseum" | "tower" }) {
  if (kind === "academy") {
    return (
      <group>
        <Block position={[0, 1, 0]} size={[3, 2, 2.5]} color={COLORS.stone} />
        <Block position={[0, 2.08, 0]} size={[2.55, 0.2, 2.05]} color={COLORS.purpleDark} />
        <Tower position={[-0.95, 0, 0]} height={2.9} roof={COLORS.purple} />
        <Tower position={[0.95, 0, 0]} height={2.9} roof={COLORS.purple} />
        <Block position={[0, 3.7, 0]} size={[1.1, 0.7, 1.1]} color={COLORS.gold} emissive={COLORS.gold} />
      </group>
    );
  }
  if (kind === "records") {
    return (
      <group>
        <Block position={[0, 0.9, 0]} size={[3.3, 1.8, 2.5]} color={COLORS.stoneDark} />
        <Block position={[0, 1.92, 0]} size={[3.6, 0.3, 2.75]} color={COLORS.purpleDark} />
        <Block position={[0, 2.3, 0]} size={[2.6, 0.3, 2]} color={COLORS.purple} />
        <Block position={[0, 2.7, 0]} size={[1.5, 0.3, 1.2]} color={COLORS.purple} />
        <Block position={[0, 1.05, 1.3]} size={[0.82, 1.05, 0.12]} color={COLORS.gold} emissive={COLORS.gold} />
      </group>
    );
  }
  if (kind === "colosseum") {
    return (
      <group>
        <Block position={[0, 0.5, 0]} size={[3.5, 1, 3]} color={COLORS.stone} />
        <Block position={[0, 1.05, 0]} size={[2.8, 0.45, 2.4]} color={COLORS.gold} />
        <Block position={[0, 1.42, 0]} size={[2.1, 0.35, 1.8]} color={COLORS.purpleDark} />
        {[-1.25, 1.25].map((x) => <Tower key={x} position={[x, 0, 0]} height={2.2} roof={COLORS.gold} />)}
      </group>
    );
  }
  return (
    <group>
      <Block position={[0, 1.4, 0]} size={[2.2, 2.8, 2.2]} color={COLORS.stoneDark} />
      <Block position={[0, 2.95, 0]} size={[2.6, 0.28, 2.6]} color={COLORS.purpleDark} />
      <Block position={[0, 3.3, 0]} size={[1.95, 0.28, 1.95]} color={COLORS.purple} />
      <Block position={[0, 3.68, 0]} size={[1.25, 0.28, 1.25]} color={COLORS.purple} />
      <Block position={[0, 4.08, 0]} size={[0.55, 0.55, 0.55]} color={COLORS.water} emissive={COLORS.water} />
      <Block position={[0, 1.35, 1.14]} size={[0.62, 1.15, 0.1]} color={COLORS.gold} emissive={COLORS.gold} />
    </group>
  );
}

function isIslandCell(x: number, z: number, width: number, depth: number, inset = 0) {
  const normalizedX = x / Math.max(width, 1);
  const normalizedZ = z / Math.max(depth, 1);
  const distance = Math.hypot(normalizedX, normalizedZ);
  const angle = Math.atan2(normalizedZ, normalizedX);
  const radius = 1.03 + 0.1 * Math.sin(angle * 3 + width * 0.17) + 0.06 * Math.cos(angle * 5 - depth * 0.13) + 0.025 * Math.sin(angle * 8 + 1.2);
  const notch = Math.abs(x * 17 + z * 23 + width * 5) % 37 === 0;
  return distance < radius - inset && !(notch && distance > radius - 0.16);
}

function UndersideColumns({ cells, width, depth, voxelSize }: { cells: Point3[]; width: number; depth: number; voxelSize: number }) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const columns = useMemo(() => cells.filter(([x, , z], index) => {
    const radial = Math.hypot(x / Math.max(width, 1), z / Math.max(depth, 1));
    return index % 2 === 0 || radial > 0.7;
  }), [cells, depth, width]);
  useLayoutEffect(() => {
    if (!meshRef.current) return;
    const object = new THREE.Object3D();
    const palette = [COLORS.stone, COLORS.stoneDark, "#806d66"];
    const color = new THREE.Color();
    columns.forEach(([x, , z], index) => {
      const radial = Math.min(1, Math.hypot(x / Math.max(width, 1), z / Math.max(depth, 1)));
      const depthFactor = 1 - radial;
      object.position.set(x * voxelSize, -0.43 - depthFactor * 0.72, z * voxelSize);
      const taper = Math.max(0.52, 0.92 - radial * 0.25);
      object.scale.set(taper * voxelSize, 0.72 + depthFactor * 1.65, taper * voxelSize);
      object.rotation.set((index % 3 - 1) * 0.08, (index % 5) * 0.12, (index % 2 ? 1 : -1) * 0.06);
      object.updateMatrix();
      meshRef.current?.setMatrixAt(index, object.matrix);
      meshRef.current?.setColorAt(index, color.set(palette[index % palette.length]));
    });
    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true;
    meshRef.current.computeBoundingSphere();
  }, [columns, depth, voxelSize, width]);
  if (columns.length === 0) return null;
  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, columns.length]} castShadow receiveShadow>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial roughness={0.96} flatShading />
    </instancedMesh>
  );
}

function IslandBase({ size, position, main = false, voxelSize = 1 }: { size: [number, number]; position: Point3; main?: boolean; voxelSize?: number }) {
  const [width, depth] = size;
  const cells = useMemo(() => {
    const result: Point3[] = [];
    for (let x = -width; x <= width; x += 1) {
      for (let z = -depth; z <= depth; z += 1) {
        if (isIslandCell(x, z, width, depth)) result.push([x, 0, z]);
      }
    }
    return result;
  }, [width, depth]);
  const topCells = useMemo(() => cells.filter(([x, , z]) => Math.abs(x * 19 + z * 31) % 11 !== 0).map(([x, , z]) => [x * voxelSize, 0, z * voxelSize] as Point3), [cells, voxelSize]);
  const topLightCells = useMemo(() => cells.filter(([x, , z]) => Math.abs(x * 19 + z * 31) % 11 === 0).map(([x, , z]) => [x * voxelSize, 0, z * voxelSize] as Point3), [cells, voxelSize]);
  const underLayers = useMemo(() => [1, 2].map((layer) => {
    const layerCells = cells.filter(([x, , z]) => isIslandCell(x, z, width, depth, layer * 0.055));
    return {
      layer,
      stone: layerCells.filter((_, index) => index % 4 === 0).map(([x, , z]) => [x * voxelSize, -layer * 0.62 * voxelSize, z * voxelSize] as Point3),
      dirt: layerCells.filter((_, index) => index % 4 !== 0).map(([x, , z]) => [x * voxelSize, -layer * 0.62 * voxelSize, z * voxelSize] as Point3),
    };
  }), [cells, depth, voxelSize, width]);

  return (
    <group position={position}>
      <InstancedBlocks positions={topCells} size={[1.08 * voxelSize, 0.62 * voxelSize, 0.95 * voxelSize]} color={COLORS.grass} />
      <InstancedBlocks positions={topLightCells} size={[1.08 * voxelSize, 0.62 * voxelSize, 0.95 * voxelSize]} color={COLORS.grassLight} />
      <UndersideColumns cells={cells} width={width} depth={depth} voxelSize={voxelSize} />
      {underLayers.map(({ layer, stone, dirt }) => (
        <group key={layer}>
          <InstancedBlocks positions={stone} size={[1.1 * voxelSize, 0.66 * voxelSize, 0.97 * voxelSize]} color={layer > 2 ? COLORS.stoneDark : COLORS.stone} />
          <InstancedBlocks positions={dirt} size={[1.1 * voxelSize, 0.66 * voxelSize, 0.97 * voxelSize]} color={layer > 2 ? COLORS.stoneDark : COLORS.dirt} />
        </group>
      ))}
      {main && (
        <>
          <Block position={[width * 0.77 * voxelSize, -1.2, depth * 0.18 * voxelSize]} size={[0.42, 3.1, 0.42]} color={COLORS.water} emissive={COLORS.water} opacity={0.76} />
          <Block position={[width * 0.77 * voxelSize, -2.75, depth * 0.18 * voxelSize]} size={[0.9, 0.24, 0.9]} color={COLORS.water} emissive={COLORS.water} opacity={0.52} />
          <Block position={[-width * 0.7 * voxelSize, -1.3, depth * 0.46 * voxelSize]} size={[0.48, 3.2, 0.48]} color={COLORS.water} emissive={COLORS.water} opacity={0.72} />
        </>
      )}
    </group>
  );
}

function HoverCard({ title, detail, accent = "#c4b5fd" }: { title: string; detail: string; accent?: string }) {
  return (
    <Html position={[0, 4.25, 0]} center zIndexRange={[20, 30]}>
      <div className="voxel-hover-card" style={{ borderColor: accent }}>
        <div className="voxel-hover-kicker">LANDMARK</div>
        <div className="voxel-hover-title">{title}</div>
        <div className="voxel-hover-detail">{detail}</div>
        <div className="voxel-hover-action">Click to enter →</div>
      </div>
    </Html>
  );
}

function LandmarkLabel({ title }: { title: string }) {
  return (
    <Html position={[0, 4.25, 0]} center zIndexRange={[10, 20]}>
      <div className="voxel-landmark-label">{title}</div>
    </Html>
  );
}

function Landmark({ title, detail, position, children, onClick, accent }: { title: string; detail: string; position: Point3; children: React.ReactNode; onClick?: () => void; accent?: string }) {
  const [hovered, setHovered] = useState(false);
  return (
    <group
      position={position}
      onClick={(event) => { event.stopPropagation(); onClick?.(); }}
      onPointerOver={(event) => { event.stopPropagation(); setHovered(true); document.body.style.cursor = onClick ? "pointer" : "default"; }}
      onPointerOut={() => { setHovered(false); document.body.style.cursor = "default"; }}
      scale={hovered ? 1.045 : 1}
    >
      {hovered && <pointLight color={accent || COLORS.purple} intensity={2.2} distance={5} position={[0, 2.7, 0]} />}
      {children}
      {!hovered && <LandmarkLabel title={title} />}
      {hovered && <HoverCard title={title} detail={detail} accent={accent} />}
    </group>
  );
}

function Clouds() {
  const puffs = useMemo(() => {
    const result: { position: Point3; scale: Point3; color: string }[] = [];
    const palette = ["#ffffff", "#eaf7ff", "#d7efff"];
    for (let cloud = 0; cloud < 42; cloud += 1) {
      const angle = cloud * 2.39996;
      const radius = 14 + (cloud % 8) * 5.7;
      const centerX = Math.cos(angle) * radius;
      const centerZ = Math.sin(angle) * radius;
      const centerY = -6.2 - (cloud % 7) * 0.9;
      const puffCount = 3 + (cloud % 3);
      for (let puff = 0; puff < puffCount; puff += 1) {
        const spread = puff - (puffCount - 1) / 2;
        const scale = 1.45 + ((cloud * 11 + puff * 7) % 13) * 0.13;
        result.push({
          position: [centerX + spread * 1.65, centerY + ((cloud + puff) % 3) * 0.18, centerZ + (((cloud * 5 + puff * 3) % 7) - 3) * 0.28],
          scale: [scale * 1.35, scale * 0.52, scale],
          color: palette[(cloud + puff) % palette.length],
        });
      }
    }
    return result;
  }, []);
  const meshRef = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    if (!meshRef.current) return;
    const object = new THREE.Object3D();
    const color = new THREE.Color();
    puffs.forEach((puff, index) => {
      object.position.set(...puff.position);
      object.scale.set(...puff.scale);
      object.rotation.set(0, (index % 9) * 0.31, 0);
      object.updateMatrix();
      meshRef.current?.setMatrixAt(index, object.matrix);
      meshRef.current?.setColorAt(index, color.set(puff.color));
    });
    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true;
    meshRef.current.computeBoundingSphere();
  }, [puffs]);
  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, puffs.length]} receiveShadow>
      <icosahedronGeometry args={[1, 1]} />
      <meshStandardMaterial roughness={1} flatShading transparent opacity={0.88} />
    </instancedMesh>
  );
}

function Mist() {
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (ref.current) ref.current.position.x = Math.sin(clock.getElapsedTime() * 0.08) * 0.8;
  });
  return (
    <group ref={ref} position={[0, -9, 0]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[118, 88]} />
        <meshBasicMaterial color="#effcff" transparent opacity={0.16} depthWrite={false} />
      </mesh>
      <Sparkles count={42} scale={[74, 3.5, 58]} size={5} speed={0.08} color="#effcff" opacity={0.3} position={[0, 1.4, 0]} />
    </group>
  );
}

function FloatingRocks() {
  const rocks = useMemo(() => [[-10, -2.8, -2], [-8, -4.2, 5], [7, -3.2, -5], [14, -1.6, -1], [3, -3.5, -6], [17, -3.9, 6]] as Point3[], []);
  return (
    <group>
      {rocks.map((point, index) => (
        <group key={index} position={point} rotation={[0.1 * index, 0.3 * index, 0.1]}>
          <Block position={[0, 0, 0]} size={[0.9 + (index % 2) * 0.4, 0.8, 0.9]} color={COLORS.stoneDark} />
          <Block position={[0.25, -0.48, 0]} size={[0.45, 0.55, 0.45]} color={COLORS.stoneDark} />
        </group>
      ))}
    </group>
  );
}

function ScenicIsland({ position, size, treeScale = 0.55 }: { position: Point3; size: [number, number]; treeScale?: number }) {
  return (
    <group position={position}>
      <IslandBase size={[size[0] * 2, size[1] * 2]} position={[0, 0, 0]} voxelSize={0.5} />
      <Tree position={[-0.65, 0.35, 0.2]} scale={treeScale} />
      <Tree position={[0.62, 0.35, -0.25]} scale={treeScale * 0.78} />
      <Block position={[0, 0.48, 0]} size={[0.36, 0.55, 0.36]} color={COLORS.purple} emissive={COLORS.purple} />
    </group>
  );
}

function AnimatedAtmosphere() {
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (ref.current) ref.current.position.x = Math.sin(clock.getElapsedTime() * 0.12) * 0.45;
  });
  return (
    <group ref={ref}>
      <Sparkles count={75} scale={[34, 11, 24]} size={2.2} speed={0.15} color="#c4b5fd" opacity={0.55} position={[0, 1.8, 0]} />
      <Sparkles count={28} scale={[20, 4, 14]} size={3.5} speed={0.2} color="#67e8f9" opacity={0.3} position={[0, -3.6, 0]} />
    </group>
  );
}

function CameraBounds() {
  const { camera } = useThree();
  const controls = useRef<OrbitControlsImpl>(null);
  const fixedQuaternion = useRef(new THREE.Quaternion());
  const fixedOffset = useRef(new THREE.Vector3());

  useLayoutEffect(() => {
    // Keep the camera on the classic isometric diagonal: equal X/Y/Z
    // components produce a 35.264 degree elevation and a 45 degree azimuth.
    camera.position.set(...ISO_CAMERA_POSITION);
    camera.up.set(0, 1, 0);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld();
    fixedQuaternion.current.copy(camera.quaternion);
    fixedOffset.current.copy(camera.position);
    if (camera instanceof THREE.OrthographicCamera) camera.updateProjectionMatrix();
    controls.current?.target.set(0, 0, 0);
    controls.current?.update();
  }, [camera]);
  /* The camera is intentionally clamped every frame to keep exploration bounded. */
  useFrame(() => {
    if (!controls.current) return;
    const targetX = THREE.MathUtils.clamp(controls.current.target.x, -11, 11);
    const targetZ = THREE.MathUtils.clamp(controls.current.target.z, -8, 8);
    controls.current.target.set(targetX, 0, targetZ);
    camera.position.set(targetX + fixedOffset.current.x, fixedOffset.current.y, targetZ + fixedOffset.current.z);
    camera.quaternion.copy(fixedQuaternion.current);
  });
  return (
    <OrbitControls ref={controls} target={[0, 0, 0]} enableRotate={false} enablePan enableZoom={false} minPolarAngle={ISO_POLAR_ANGLE} maxPolarAngle={ISO_POLAR_ANGLE} minAzimuthAngle={ISO_AZIMUTH_ANGLE} maxAzimuthAngle={ISO_AZIMUTH_ANGLE} panSpeed={0.7} screenSpacePanning={false} mouseButtons={{ LEFT: undefined, MIDDLE: THREE.MOUSE.PAN, RIGHT: undefined }} touches={{ ONE: undefined, TWO: undefined }} />
  );
}

function Kingdom({ router, active, errors, progress }: { router: ReturnType<typeof useRouter>; active: ActiveSessionProgress[]; errors: MisconceptionHistoryItem[]; progress: { mastered: number; total: number; pct: number; dewdrops: number; rank: string } }) {
  const activeSession = active[0];
  const activeDetail = activeSession ? `${activeSession.topic_label} · ${Math.round(Number(activeSession.completion_percentage) || 0)}% mapped` : "No active topic yet · choose a trail to begin";
  return (
    <>
      <color attach="background" args={["#67c5ef"]} />
      <fog attach="fog" args={["#93daf5", 32, 76]} />
      <ambientLight intensity={2.05} color="#e6f7ff" />
      <directionalLight
        position={[-18, 28, 12]}
        intensity={4.3}
        color="#fff7cf"
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-left={-48}
        shadow-camera-right={48}
        shadow-camera-top={48}
        shadow-camera-bottom={-48}
        shadow-camera-near={1}
        shadow-camera-far={100}
        shadow-bias={-0.0002}
      />
      <directionalLight position={[18, 11, -14]} intensity={1.1} color="#b9e7ff" />
      <CameraBounds />
      <AnimatedAtmosphere />
      <Clouds />
      <Mist />
      <FloatingRocks />

      <IslandBase size={[63, 39]} position={[0, 0, 0]} main voxelSize={0.35} />
      <Castle />
      {[
        [-8.2, 0.35, -3.8, 0.7], [-7.2, 0.35, -2.7, 0.55], [-6.1, 0.35, -4.6, 0.48], [-5.1, 0.35, -3.5, 0.62],
        [-8.4, 0.35, 2.1, 0.62], [-7.1, 0.35, 3.8, 0.52], [-5.7, 0.35, 2.7, 0.7], [-5.1, 0.35, 4.2, 0.5],
        [7.5, 0.35, -3.7, 0.66], [8.6, 0.35, -2.3, 0.52], [7.8, 0.35, 2.7, 0.7], [6.2, 0.35, 4.0, 0.52],
        [4.6, 0.35, -4.2, 0.46], [-2.7, 0.35, -5.4, 0.5], [-1.4, 0.35, 4.8, 0.6], [2.2, 0.35, 4.5, 0.48],
      ].map(([x, y, z, scale], index) => <Tree key={index} position={[x, y, z]} scale={scale} />)}
      {[
        { position: [-5.8, 0.35, -5.4] as Point3, scale: 0.48, variant: "cottage" as const },
        { position: [-2.5, 0.35, -6.2] as Point3, scale: 0.44, variant: "longhouse" as const },
        { position: [1.2, 0.35, -6.3] as Point3, scale: 0.46, variant: "shop" as const },
        { position: [5.3, 0.35, -5.4] as Point3, scale: 0.42, variant: "barn" as const },
        { position: [-9.0, 0.35, -2.0] as Point3, scale: 0.42, variant: "longhouse" as const },
        { position: [-9.4, 0.35, 1.7] as Point3, scale: 0.4, variant: "cottage" as const },
        { position: [9.1, 0.35, -1.7] as Point3, scale: 0.42, variant: "shop" as const },
        { position: [9.2, 0.35, 2.2] as Point3, scale: 0.4, variant: "cottage" as const },
        { position: [-5.8, 0.35, 6.4] as Point3, scale: 0.44, variant: "barn" as const },
        { position: [-2.2, 0.35, 7.2] as Point3, scale: 0.46, variant: "cottage" as const },
        { position: [2.4, 0.35, 7.2] as Point3, scale: 0.44, variant: "longhouse" as const },
        { position: [6.0, 0.35, 6.4] as Point3, scale: 0.4, variant: "shop" as const },
      ].map(({ position, scale, variant }, index) => <VillageHome key={`home-${index}`} position={position} scale={scale} variant={variant} />)}
      <TownSquare position={[0, 0.35, 3.9]} />
      <Watchtower position={[-11.3, 0.35, -5.2]} scale={0.9} />
      <Watchtower position={[11.2, 0.35, -5.0]} scale={0.9} />
      <Watchtower position={[-11.4, 0.35, 5.8]} scale={0.9} />
      <Watchtower position={[11.4, 0.35, 5.8]} scale={0.9} />
      <VillagePath from={[-10.8, 0.39, 0.8]} to={[10.8, 0.39, 0.8]} width={0.5} />
      <VillagePath from={[0, 0.39, -7.2]} to={[0, 0.39, 9.0]} width={0.5} />
      <VillagePath from={[-7.8, 0.39, 3.9]} to={[7.8, 0.39, 3.9]} width={0.42} />
      <VillagePath from={[-3.9, 0.39, 3.9]} to={[-5.8, 0.39, 6.4]} />
      <VillagePath from={[3.9, 0.39, 3.9]} to={[6.0, 0.39, 6.4]} />
      <VillagePath from={[-7.8, 0.39, 0.8]} to={[-9.0, 0.39, -2.0]} />
      <VillagePath from={[-7.8, 0.39, 0.8]} to={[-9.4, 0.39, 1.7]} />
      <VillagePath from={[7.8, 0.39, 0.8]} to={[9.1, 0.39, -1.7]} />
      <VillagePath from={[7.8, 0.39, 0.8]} to={[9.2, 0.39, 2.2]} />
      <VillagePath from={[7.8, 0.39, 0.8]} to={[7.4, 0.39, -3.7]} />
      <VillagePath from={[0, 0.39, 7.2]} to={[0, 0.39, 9.0]} />
      <Lake position={[-3.3, 0.36, -1.8]} size={[3, 2]} />
      <Lake position={[4.0, 0.36, 0.4]} size={[2, 1]} />
      <River points={[[-5.8, 0.39, -0.8], [-4.9, 0.39, -0.4], [-4.0, 0.39, 0.0], [-3.2, 0.39, 0.75], [-2.2, 0.39, 1.15], [-1.3, 0.39, 1.65], [-0.4, 0.39, 2.2]]} />
      <River points={[[1.5, 0.39, -4.8], [1.4, 0.39, -3.9], [1.2, 0.39, -3.0], [1.05, 0.39, -2.1], [0.8, 0.39, -1.3], [0.55, 0.39, -0.5]]} />
      <Waterfall position={[10.2, 0.3, 1.8]} height={4.7} />
      <Waterfall position={[-8.0, 0.3, 5.15]} height={3.5} />
      <Landmark title="Quest Guild" detail={activeDetail} position={[-7.4, 0.35, 0.8]} onClick={() => activeSession ? router.push(`/session/${activeSession.id}/lesson`) : router.push("/topics")} accent={COLORS.gold}>
        <QuestGuild />
      </Landmark>
      <Landmark title="Tangled Thorns" detail={`${errors.length} ${errors.length === 1 ? "error" : "errors"} logged · review your tangled steps`} position={[7.4, 0.35, 0.8]} onClick={() => router.push("/error-history")} accent="#b77cff">
        <ThornRuin />
      </Landmark>
      <Landmark title="Ranger Hall" detail={`${progress.pct}% mastery · ${progress.dewdrops} dewdrops · ${progress.rank}`} position={[7.4, 0.35, -4.1]} onClick={() => router.push("/progress")} accent="#66d88c">
        <RangerHall />
      </Landmark>
      <Landmark title="Coliseum" detail="Town arena · train skills and celebrate your mastery" position={[0, 0.35, 9.4]} onClick={() => router.push("/progress")} accent={COLORS.gold}>
        <Coliseum />
      </Landmark>

      <IslandBridge destination={[-29, 0, 3.2]} islandSize={[18.75, 12.75]} />
      <IslandBridge destination={[29, 0, -2.6]} islandSize={[17.625, 11.625]} />
      <IslandBridge destination={[-12.5, 0, 20.5]} islandSize={[16.875, 11.25]} />
      <IslandBridge destination={[13.0, 0, 20.5]} islandSize={[15.75, 10.5]} />

      <IslandBase size={[18.75, 12.75]} position={[-29, 0, 3.2]} voxelSize={0.325} />
      <Landmark title="Topics · Grand Academy" detail="Topics · browse the complete learning map" position={[-29, 0.35, 3.2]} onClick={() => router.push("/topics")}>
        <DestinationBuilding kind="academy" />
      </Landmark>
      <IslandBase size={[17.625, 11.625]} position={[29, 0, -2.6]} voxelSize={0.325} />
      <Landmark title="Error History · Hall of Records" detail={`${errors.length} misconception records · inspect the error history`} position={[29, 0.35, -2.6]} onClick={() => router.push("/error-history")} accent="#b77cff">
        <DestinationBuilding kind="records" />
      </Landmark>
      <IslandBase size={[16.875, 11.25]} position={[-12.5, 0, 20.5]} voxelSize={0.325} />
      <Landmark title="Progress · Hall of Champions" detail={`${progress.mastered}/${progress.total || 0} skills mastered · view progress`} position={[-12.5, 0.35, 20.5]} onClick={() => router.push("/progress")} accent="#66d88c">
        <DestinationBuilding kind="colosseum" />
      </Landmark>
      <IslandBase size={[15.75, 10.5]} position={[13.0, 0, 20.5]} voxelSize={0.325} />
      <Landmark title="Calculator · Arcane Tower" detail="Calculator · solve and explore equations" position={[13.0, 0.35, 20.5]} onClick={() => router.push("/calculator")} accent="#44bde9">
        <DestinationBuilding kind="tower" />
      </Landmark>
      <ScenicIsland position={[-30, 3.5, -1]} size={[3.3, 2.1]} />
      <ScenicIsland position={[-27, 2.3, 13]} size={[2.8, 1.8]} treeScale={0.45} />
      <ScenicIsland position={[-7, 4.5, -18]} size={[2.9, 1.9]} treeScale={0.42} />
      <ScenicIsland position={[8, 3.9, -18]} size={[3.1, 2]} treeScale={0.46} />
      <ScenicIsland position={[30, 3.1, 0]} size={[3.3, 2.1]} />
      <ScenicIsland position={[29, 4.6, 15]} size={[2.8, 1.8]} treeScale={0.45} />
      <ScenicIsland position={[0, 3.7, 18]} size={[3.2, 2.1]} treeScale={0.45} />
      <ScenicIsland position={[-15, 4.1, -14]} size={[2.4, 1.5]} treeScale={0.4} />
      <ScenicIsland position={[15, 4.8, -14]} size={[2.6, 1.6]} treeScale={0.4} />
      <ScenicIsland position={[-36, 2.8, -10]} size={[2.4, 1.5]} treeScale={0.38} />
      <ScenicIsland position={[37, 4.6, 7]} size={[2.8, 1.8]} treeScale={0.42} />
      <ScenicIsland position={[-36, 5.2, 8]} size={[2.5, 1.6]} treeScale={0.4} />
      <ScenicIsland position={[-3, 5.8, -27]} size={[2.8, 1.8]} treeScale={0.42} />
      <ScenicIsland position={[5, 5.2, 27]} size={[2.6, 1.7]} treeScale={0.4} />
      <ScenicIsland position={[-15, 2.7, 17]} size={[2.3, 1.5]} treeScale={0.38} />
      <ScenicIsland position={[15, 4.2, 18]} size={[2.5, 1.6]} treeScale={0.4} />
      <ScenicIsland position={[0, 6.8, 34]} size={[2.4, 1.5]} treeScale={0.38} />
      <ScenicIsland position={[-43, 5.4, -4]} size={[3.8, 2.5]} treeScale={0.46} />
      <ScenicIsland position={[43, 5.8, 3]} size={[3.9, 2.4]} treeScale={0.46} />
      <ScenicIsland position={[-33, 7.4, 22]} size={[3.2, 2]} treeScale={0.42} />
      <ScenicIsland position={[34, 6.7, 23]} size={[3.5, 2.2]} treeScale={0.44} />
      <ScenicIsland position={[-18, 7.8, -29]} size={[3.6, 2.3]} treeScale={0.43} />
      <ScenicIsland position={[20, 8.3, -28]} size={[3.3, 2.1]} treeScale={0.42} />
      <ScenicIsland position={[-48, 4.2, 20]} size={[2.2, 1.4]} treeScale={0.36} />
      <ScenicIsland position={[49, 4.8, -18]} size={[2.4, 1.5]} treeScale={0.38} />
      <ScenicIsland position={[-20, 9.2, 38]} size={[4.4, 2.8]} treeScale={0.48} />
      <ScenicIsland position={[18, 8.8, 39]} size={[4.1, 2.6]} treeScale={0.46} />
      <ScenicIsland position={[-40, 8.2, 34]} size={[3.3, 2.1]} treeScale={0.42} />
      <ScenicIsland position={[41, 8.7, 35]} size={[3.6, 2.2]} treeScale={0.44} />
      <ScenicIsland position={[-8, 11.2, 49]} size={[3.9, 2.4]} treeScale={0.43} />
      <ScenicIsland position={[9, 10.8, 50]} size={[3.7, 2.3]} treeScale={0.42} />
    </>
  );
}

function TutorialModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-[#080512]/70 px-5 backdrop-blur-sm" onClick={onClose}>
      <div className="voxel-tutorial" onClick={(event) => event.stopPropagation()}>
        <div className="voxel-tutorial-mark">?</div>
        <div>
          <div className="voxel-overline">SURI KINGDOM FIELD GUIDE</div>
          <h2>Explore your learning world</h2>
          <p>Pan across the floating kingdom to discover every destination. Hover a landmark for a quick read, then click it to open the same learning space you already know.</p>
          <div className="voxel-tutorial-actions"><span>Drag to pan</span><span>Scroll to zoom</span><span>Hover to inspect</span></div>
        </div>
        <button className="voxel-close" onClick={onClose}>Got it</button>
      </div>
    </div>
  );
}

function DashboardWorld({ active, errors, progress }: { active: ActiveSessionProgress[]; errors: MisconceptionHistoryItem[]; progress: { mastered: number; total: number; pct: number; dewdrops: number; rank: string } }) {
  const router = useRouter();
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const [showSaved, setShowSaved] = useState(() => typeof window !== "undefined" && new URLSearchParams(window.location.search).get("saved") === "true");
  useEffect(() => {
    if (!showSaved) return;
    const timeout = window.setTimeout(() => setShowSaved(false), 3500);
    return () => window.clearTimeout(timeout);
  }, [showSaved]);
  useEffect(() => {
    const openTutorial = () => setTutorialOpen(true);
    window.addEventListener("suri:open-tutorial", openTutorial);
    return () => window.removeEventListener("suri:open-tutorial", openTutorial);
  }, []);
  return (
    <div className="dashboard-world">
      {showSaved && <div className="world-toast">✦ Progress cataloged in the kingdom archives.</div>}
      <Canvas
        className="dashboard-canvas"
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
        orthographic
        shadows
        dpr={[1, 1.5]}
        camera={{ position: ISO_CAMERA_POSITION, zoom: 19, near: 0.1, far: 120 }}
        gl={{ antialias: true, powerPreference: "high-performance" }}
      >
        <Suspense fallback={null}><Kingdom router={router} active={active} errors={errors} progress={progress} /></Suspense>
      </Canvas>
      {tutorialOpen && <TutorialModal onClose={() => setTutorialOpen(false)} />}
    </div>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<ActiveSessionProgress[]>([]);
  const [completed, setCompleted] = useState<ActiveSessionProgress[]>([]);
  const [errors, setErrors] = useState<MisconceptionHistoryItem[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  useEffect(() => {
    const load = async () => {
      try {
        const me = await getMe();
        const result = await getStudentProgress(me.student_id);
        setActive(result.active_sessions || []);
        setCompleted(result.completed_sessions || []);
        setErrors(result.misconception_history || []);
      } catch (error: unknown) {
        const status = error && typeof error === "object" && "status" in error ? (error as { status: number }).status : 0;
        if (status === 401) { router.replace("/login"); return; }
        setErrorMsg(error instanceof Error ? error.message : "Failed to load dashboard.");
      } finally { setLoading(false); }
    };
    load();
  }, [router]);
  const stats = useMemo(() => {
    const mastered = active.reduce((sum, session) => sum + session.mastered_count, 0);
    const total = active.reduce((sum, session) => sum + session.total_in_chain, 0);
    const pct = active.length > 0 ? Math.round(active.reduce((sum, session) => sum + (Number(session.completion_percentage) || 0), 0) / active.length) : 0;
    const dewdrops = mastered * 10 + completed.length * 50;
    const rank = dewdrops >= 1000 ? "Elder Canopy Sage" : dewdrops >= 600 ? "Wildwood Ranger" : dewdrops >= 300 ? "Dewdrop Pathfinder" : dewdrops >= 100 ? "Fern Scout" : "Sprout Explorer";
    return { mastered, total, pct, dewdrops, rank };
  }, [active, completed]);
  return (
    <MainPage immersive>
      {loading ? <div className="world-loading"><div className="world-loader" /><span>Raising the skybound realm…</span></div> : <DashboardWorld active={active} errors={errors} progress={stats} />}
      {errorMsg && <div className="world-error">{errorMsg}</div>}
    </MainPage>
  );
}
