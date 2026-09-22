"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { LandmarkArchitecture } from "./Architecture";
import { Landscape, type LandscapeFocus } from "./Landscape";
import { Ocean } from "@/components/ReferenceVoxel/Ocean";
import { LANDMARK_SCALE, WORLD_ROTATION } from "@/lib/worldMap/framing";
import { sitePosition } from "@/lib/worldMap/landscape";

// This is the Dashboard's Topics island, not a second, page-specific map. The
// tight bounds contain its whole shoreline and forecourt, while the island mask
// deliberately excludes the nearby scenic keys from the close-up.
const TOPICS_FOCUS = {
  island: "topics",
  bounds: { minX: -29, maxX: 8, minZ: -49, maxZ: -20, padding: 2.4, island: "topics" },
} satisfies LandscapeFocus;
const CAMERA_HALF_HEIGHT = 17.5;
const Y_AXIS = new THREE.Vector3(0, 1, 0);

function TopicsCamera() {
  const getThree = useThree(state => state.get);
  const size = useThree(state => state.size);
  const invalidate = useThree(state => state.invalidate);
  const elapsed = useRef(0);
  const focal = useMemo(() => new THREE.Vector3(...sitePosition("topics")).applyAxisAngle(Y_AXIS, WORLD_ROTATION).add(new THREE.Vector3(0, 3.2, 0)), []);
  const distant = useMemo(() => focal.clone().add(new THREE.Vector3(126, 126, 126)), [focal]);
  const close = useMemo(() => focal.clone().add(new THREE.Vector3(82, 82, 82)), [focal]);

  useLayoutEffect(() => {
    const { camera } = getThree();
    camera.position.copy(distant);
    camera.lookAt(focal);
    camera.near = 0.5;
    camera.far = 420;
    if (camera instanceof THREE.OrthographicCamera) {
      camera.left = -CAMERA_HALF_HEIGHT * size.width / Math.max(size.height, 1);
      camera.right = -camera.left;
      camera.top = CAMERA_HALF_HEIGHT;
      camera.bottom = -CAMERA_HALF_HEIGHT;
      camera.zoom = 0.84;
    }
    camera.updateProjectionMatrix();
    invalidate();
  }, [distant, focal, getThree, size, invalidate]);

  useFrame((_, delta) => {
    if (elapsed.current >= 0.9) return;
    elapsed.current = Math.min(elapsed.current + delta, 0.9);
    const t = THREE.MathUtils.smootherstep(elapsed.current / 0.9, 0, 1);
    const { camera } = getThree();
    camera.position.lerpVectors(distant, close, t);
    camera.lookAt(focal);
    if (camera instanceof THREE.OrthographicCamera) {
      camera.zoom = THREE.MathUtils.lerp(0.84, 1.08, t);
      camera.updateProjectionMatrix();
    }
    if (elapsed.current < 0.9) invalidate();
  });
  return null;
}

/** The reusable Topics landmark shown in the Dashboard, framed as a close-up. */
export function TopicsIsland() {
  const position = sitePosition("topics");
  return <>
    <color attach="background" args={["#a9d8df"]} />
    <ambientLight intensity={0.7} color="#fff8e7" />
    <hemisphereLight args={["#c4dfef", "#697653", 0.7]} />
    <directionalLight position={[-38, 60, 35]} intensity={2.6} color="#fffde7" castShadow shadow-mapSize-width={1024} shadow-mapSize-height={1024} shadow-camera-left={-50} shadow-camera-right={50} shadow-camera-top={42} shadow-camera-bottom={-42} shadow-camera-far={130} shadow-normalBias={0.06} shadow-bias={-0.0004} />
    <TopicsCamera />
    <group rotation={[0, WORLD_ROTATION, 0]}>
      <Ocean island="topics" />
      <Landscape focus={TOPICS_FOCUS} />
      <group position={position} scale={LANDMARK_SCALE}><LandmarkArchitecture kind="topics" /></group>
    </group>
  </>;
}

function FrameGate({ active }: { active: boolean }) {
  const invalidate = useThree(state => state.invalidate);
  useEffect(() => { if (active) invalidate(); }, [active, invalidate]);
  return null;
}

export default function TopicsLibraryWorld({ active = true }: { active?: boolean }) {
  return <div className="topics-world" aria-hidden="true">
    <div className="topics-world-backdrop">
      <Canvas frameloop={active ? "demand" : "never"} orthographic shadows="percentage" dpr={[1, 1.25]} camera={{ position: [82, 82, 82], near: 0.5, far: 420 }} gl={{ antialias: true, powerPreference: "high-performance" }} onCreated={({ gl }) => {
        gl.shadowMap.enabled = true;
        gl.shadowMap.type = THREE.PCFSoftShadowMap;
      }}><FrameGate active={active} /><TopicsIsland /></Canvas>
    </div>
  </div>;
}
