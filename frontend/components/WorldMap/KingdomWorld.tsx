"use client";

import { memo, Suspense, useEffect, useRef, useState, type RefObject } from "react";
import type { CameraCommand } from "@/lib/worldMap/navigation";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { ActiveSessionProgress, MisconceptionHistoryItem } from "@/lib/api";
import { Landscape } from "./Landscape";
import { MapCamera, CAMERA_POSITION } from "./MapCamera";
import { LandmarkArchitecture } from "./Architecture";
import type { LandmarkKind } from "@/lib/worldMap/architecture";
import { SITES, sitePosition } from "@/lib/worldMap/landscape";
import styles from "./landmarks.module.css";
import { Ocean } from "@/components/ReferenceVoxel/Ocean";
import { LANDMARK_BOUNDS, LANDMARK_LABEL_LIFT, LANDMARK_SCALE, worldFrame } from "@/lib/worldMap/framing";
import { playableProjectionBounds } from "@/lib/worldMap/worldBounds";
import { configureWorldRenderer } from "@/lib/three/renderer";

type Point3 = [number, number, number];
const COLORS = { gold: "#dfc188", purple: "#a99bd1" };
const noRaycast: THREE.Mesh["raycast"] = () => {};
type DashboardLandmark = "topics" | "records" | "champions" | "calculator";

const DASHBOARD_LANDMARKS: Array<{ kind: DashboardLandmark; title: string; href: string }> = [
  { kind: "topics", title: "Topics · Learning Grove", href: "/topics" },
  { kind: "records", title: "Error History · Hall of Records", href: "/error-history" },
  { kind: "champions", title: "Progress · Hall of Champions", href: "/progress" },
  { kind: "calculator", title: "Calculator · Arcane Tower", href: "/calculator" },
];

function Landmark({ position, kind, onClick, onIntent, accent, selected=false, hovered=false, onHoverChange }: { position: Point3; kind: LandmarkKind; onClick?: () => void; onIntent?: () => void; accent?: string; selected?: boolean; hovered?: boolean; onHoverChange?: (kind: LandmarkKind | null) => void }) {
  const highlighted = hovered || selected;
  const enter = () => { onClick?.(); };
  const prepareDestination = () => { onIntent?.(); };
  const setLandmarkHover = (next: boolean) => {
    onHoverChange?.(next ? kind : null);
    document.body.style.cursor = next && onClick ? "pointer" : "default";
  };
  useEffect(() => () => { document.body.style.cursor = "default"; }, []);
  const bounds = LANDMARK_BOUNDS[kind];
  const glowOuterRadius = Math.hypot(bounds[0] / 2, bounds[2] / 2) + 2.4;
  const glowInnerRadius = glowOuterRadius - 0.8;
  return <group position={position} scale={LANDMARK_SCALE}>
    <LandmarkArchitecture kind={kind} />
    {/* Only this single, unchanging mesh receives pointer intersections. */}
    <mesh name={`landmark-hitbox-${kind}`} position={[0, bounds[1] / 2, 0]}
      onPointerOver={(event) => { event.stopPropagation(); prepareDestination(); setLandmarkHover(true); }}
      onPointerOut={() => { setLandmarkHover(false); }}
      onClick={(event) => { event.stopPropagation(); if (event.delta < 5) enter(); }}>
      <boxGeometry args={bounds} />
      <meshBasicMaterial transparent opacity={0} colorWrite={false} depthWrite={false} />
    </mesh>
    {highlighted && <>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.1, 0]} raycast={noRaycast}><circleGeometry args={[glowOuterRadius, 64]} /><meshBasicMaterial color="#f5c542" transparent opacity={0.18} blending={THREE.AdditiveBlending} toneMapped={false} depthWrite={false} /></mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.12, 0]} raycast={noRaycast}><ringGeometry args={[glowInnerRadius, glowOuterRadius, 64]} /><meshBasicMaterial color={accent || COLORS.gold} transparent opacity={0.95} blending={THREE.AdditiveBlending} toneMapped={false} depthWrite={false} /></mesh>
    </>}
  </group>;
}

function SuriKeepLabel() {
  return <div role="note" className={`${styles.marker} ${styles.scenic} ${styles.keepLabel}`} aria-label="SURI Keep Castle: The central welcome hall for your learning kingdom">
    <span className={styles.markerHeading}><span className={styles.markerIcon} aria-hidden="true">✦</span><span className={styles.markerTitle}>SURI Keep Castle</span></span>
  </div>;
}

type WorldProps = {
  active?: ActiveSessionProgress[]; errors?: MisconceptionHistoryItem[];
  progress: { mastered: number; total: number; pct: number; dewdrops: number; rank: string };
  command: CameraCommand | null; visible: boolean; preserveCameraOnActivate?: boolean; busy: boolean; navigate: (href: string) => void; preloadRoute?: (href: string) => void;
};

type CoastalWorldProps = WorldProps & {
  labelLayerRef: RefObject<HTMLDivElement | null>; hoveredLandmark: LandmarkKind | null; setHoveredLandmark: (kind: LandmarkKind | null) => void;
};

function FrameGate({ active }: { active: boolean }) {
  const invalidate = useThree(state => state.invalidate);
  useEffect(() => { if (active) invalidate(); }, [active, invalidate]);
  return null;
}

function LandmarkLabelProjector({ layerRef }: { layerRef: RefObject<HTMLDivElement | null> }) {
  const size = useThree(state => state.size);
  const point = useRef(new THREE.Vector3());

  useFrame(({ camera }) => {
    const layer = layerRef.current;
    if (!layer) return;
    const frame = worldFrame(size.width, size.height, playableProjectionBounds());
    for (const { kind } of DASHBOARD_LANDMARKS) {
      const element = layer.querySelector<HTMLElement>(`[data-landmark="${kind}"]`);
      if (!element) continue;
      const bounds = LANDMARK_BOUNDS[kind];
      point.current
        .set(...sitePosition(kind))
        .addScaledVector(new THREE.Vector3(0, 1, 0), (bounds[1] + LANDMARK_LABEL_LIFT) * LANDMARK_SCALE)
        .applyAxisAngle(new THREE.Vector3(0, 1, 0), frame.rotation)
        .multiplyScalar(frame.scale)
        .add(new THREE.Vector3(...frame.position))
        .project(camera);
      const visible = point.current.z >= -1 && Math.abs(point.current.x) <= 1.15 && Math.abs(point.current.y) <= 1.15;
      element.style.visibility = visible ? "visible" : "hidden";
      if (visible) {
        element.style.left = `${(point.current.x * 0.5 + 0.5) * size.width}px`;
        element.style.top = `${(-point.current.y * 0.5 + 0.5) * size.height}px`;
      }
    }
  });

  return null;
}

function CoastalWorld({ command, navigate, preloadRoute, busy, visible, preserveCameraOnActivate, labelLayerRef, hoveredLandmark, setHoveredLandmark }: CoastalWorldProps) {
  const size = useThree(state => state.size);
  const frame = worldFrame(size.width, size.height, playableProjectionBounds());
  const visit = (_site: keyof typeof SITES, href: string) => { if(!busy)navigate(href); };
  const selectedSite = command?.kind === "island" ? command.site : undefined;
  return (
    <>
      <color attach="background" args={["#a9d8df"]} />
      <ambientLight intensity={0.7} color="#fff8e7" />
      <directionalLight position={[-38, 60, 35]} intensity={2.6} color="#fffde7" castShadow shadow-mapSize-width={1024} shadow-mapSize-height={1024} shadow-camera-left={-50} shadow-camera-right={50} shadow-camera-top={42} shadow-camera-bottom={-42} shadow-camera-far={130} shadow-normalBias={0.06} shadow-bias={-0.0004} />
      <hemisphereLight args={["#c4dfef", "#697653", 0.7]} />
      <MapCamera command={command} active={visible} preserveCameraOnActivate={preserveCameraOnActivate} />
      <LandmarkLabelProjector layerRef={labelLayerRef} />
      <group position={frame.position} rotation={[0, frame.rotation, 0]} scale={frame.scale}>
        <Ocean />
        <Landscape />

        <Landmark position={sitePosition("keep")} accent={COLORS.gold} kind="keep" hovered={hoveredLandmark === "keep"} onHoverChange={setHoveredLandmark} />
        <Landmark position={sitePosition("topics")} onClick={() => visit("topics", "/topics")} onIntent={() => preloadRoute?.("/topics")} kind="topics" selected={selectedSite === "topics"} hovered={hoveredLandmark === "topics"} onHoverChange={setHoveredLandmark} />
        <Landmark position={sitePosition("records")} onClick={() => visit("records", "/error-history")} onIntent={() => preloadRoute?.("/error-history")} kind="records" selected={selectedSite === "records"} hovered={hoveredLandmark === "records"} onHoverChange={setHoveredLandmark} />
        <Landmark position={sitePosition("champions")} onClick={() => visit("champions", "/progress")} onIntent={() => preloadRoute?.("/progress")} kind="champions" selected={selectedSite === "champions"} hovered={hoveredLandmark === "champions"} onHoverChange={setHoveredLandmark} />
        <Landmark position={sitePosition("calculator")} onClick={() => visit("calculator", "/calculator")} onIntent={() => preloadRoute?.("/calculator")} kind="calculator" selected={selectedSite === "calculator"} hovered={hoveredLandmark === "calculator"} onHoverChange={setHoveredLandmark} />
      </group>
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
          <p>Explore the island kingdom to discover every destination. Hover a landmark for a quick read, then click it to open the same learning space you already know.</p>
          <div className="voxel-tutorial-actions"><span>Every island in view</span><span>Click to travel</span><span>Hover to inspect</span></div>
        </div>
        <button className="voxel-close" onClick={onClose}>Got it</button>
      </div>
    </div>
  );
}

function DashboardWorld(props: WorldProps) {
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const [hoveredLandmark, setHoveredLandmark] = useState<LandmarkKind | null>(null);
  const labelLayerRef = useRef<HTMLDivElement | null>(null);
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
    <div className={`dashboard-world ${styles.world}`}>
      {showSaved && <div className="world-toast">✦ Progress cataloged in the kingdom archives.</div>}
      <div className={styles.viewport}><Canvas
        className="dashboard-canvas"
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
        frameloop={props.visible ? "demand" : "never"}
        orthographic
        shadows="percentage"
        dpr={[1, 1.25]}
        camera={{ position: [...CAMERA_POSITION], near: 0.5, far: 650 }}
        gl={{ antialias: true, powerPreference: "high-performance" }}
        onCreated={({ gl }) => configureWorldRenderer(gl)}
      >
        <FrameGate active={props.visible} />
        <Suspense fallback={null}><CoastalWorld {...props} labelLayerRef={labelLayerRef} hoveredLandmark={hoveredLandmark} setHoveredLandmark={setHoveredLandmark} /></Suspense>
      </Canvas>
        <div className={styles.labelLayer} ref={labelLayerRef}>
          {DASHBOARD_LANDMARKS.map(({ kind, title, href }) => {
            const detail = kind === "records"
              ? `${props.errors?.length ?? 0} misconception records · inspect the error history`
              : kind === "champions"
                ? `${props.progress.mastered}/${props.progress.total || 0} skills mastered · view progress`
                : kind === "topics"
                  ? "Browse topics and choose your next learning trail"
                  : "Solve and explore equations";
            const label = title.split(" · ")[0];
            const hovered = hoveredLandmark === kind;
            return <div key={kind} className={styles.anchor} data-landmark={kind} style={{ visibility: "hidden" }}>
              <button type="button" className={`${styles.marker} ${hovered ? styles.markerExpanded : ""}`} aria-label={`${title}: ${detail}`}
                onClick={() => { if (!props.busy) props.navigate(href); }}
                onMouseEnter={() => { props.preloadRoute?.(href); setHoveredLandmark(kind); }}
                onMouseLeave={() => setHoveredLandmark(null)}
                onFocus={() => { props.preloadRoute?.(href); setHoveredLandmark(kind); }}
                onBlur={() => setHoveredLandmark(null)}>
                <span className={styles.markerHeading}><span className={styles.markerIcon} aria-hidden="true">✦</span><span className={styles.markerTitle}>{label}</span></span>
                <span className={styles.markerDetail}>{detail}</span>
              </button>
            </div>;
          })}
        </div>
        <SuriKeepLabel />
      </div>
      {tutorialOpen && <TutorialModal onClose={() => setTutorialOpen(false)} />}
    </div>
  );
}


export default memo(DashboardWorld);

