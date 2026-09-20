"use client";

import { memo, Suspense, useEffect, useRef, useState, type RefObject } from "react";
import type { CameraCommand } from "@/lib/worldMap/navigation";
import { Canvas, useThree } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import type { ActiveSessionProgress, MisconceptionHistoryItem } from "@/lib/api";
import { Landscape } from "./Landscape";
import { MapCamera, CAMERA_POSITION } from "./MapCamera";
import { LandmarkArchitecture } from "./Architecture";
import type { LandmarkKind } from "@/lib/worldMap/architecture";
import { SITES, sitePosition } from "@/lib/worldMap/landscape";
import styles from "./landmarks.module.css";
import { Ocean } from "@/components/ReferenceVoxel/Ocean";
import { LANDMARK_BOUNDS, LANDMARK_SCALE, worldFrame } from "@/lib/worldMap/framing";
import { playableProjectionBounds } from "@/lib/worldMap/worldBounds";

type Point3 = [number, number, number];
const COLORS = { gold: "#dfc188", purple: "#a99bd1" };
const noRaycast: THREE.Mesh["raycast"] = () => {};
const tooltipPoint = new THREE.Vector3();

// The tooltip gets its own body-level portal and is clamped just enough to keep
// its 210px card inside the locked dashboard viewport.
function tooltipPosition(object: THREE.Object3D, camera: THREE.Camera, size: { width: number; height: number }) {
  tooltipPoint.setFromMatrixPosition(object.matrixWorld).project(camera);
  const x = tooltipPoint.x * size.width * 0.5 + size.width * 0.5;
  const y = -tooltipPoint.y * size.height * 0.5 + size.height * 0.5;
  return [Math.min(size.width - 116, Math.max(116, x)), Math.min(size.height - 22, Math.max(118, y))];
}

function Landmark({ title, detail, position, kind, onClick, accent, selected=false, tooltipPortal }: { title: string; detail: string; position: Point3; kind: LandmarkKind; onClick?: () => void; accent?: string; selected?: boolean; tooltipPortal?: RefObject<HTMLElement> }) {
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);

  const highlighted = hovered || focused || selected;
  const enter = () => { onClick?.(); };
  useEffect(() => () => { document.body.style.cursor = "default"; }, []);
  const label = title.includes(" · ") ? title.split(" · ")[0] : title;
  const bounds = LANDMARK_BOUNDS[kind];
  return <group position={position} scale={LANDMARK_SCALE}>
    <LandmarkArchitecture kind={kind} />
    {/* Only this single, unchanging mesh receives pointer intersections. */}
    <mesh name={`landmark-hitbox-${kind}`} position={[0, bounds[1] / 2, 0]}
      onPointerOver={(event) => { event.stopPropagation(); setHovered(true); document.body.style.cursor = onClick ? "pointer" : "default"; }}
      onPointerOut={() => { setHovered(false); document.body.style.cursor = "default"; }}
      onClick={(event) => { event.stopPropagation(); if (event.delta < 5) enter(); }}>
      <boxGeometry args={bounds} />
      <meshBasicMaterial transparent opacity={0} colorWrite={false} depthWrite={false} />
    </mesh>
    {highlighted && <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.12, 0]} raycast={noRaycast}><ringGeometry args={[4.6, 4.7, 64]} /><meshBasicMaterial color={accent || COLORS.gold} transparent opacity={0.65} depthWrite={false} /></mesh>}
    <Html position={[0, bounds[1] + 0.4, 0]} center zIndexRange={[30, 10]} style={{ pointerEvents: "none" }}>
      <div className={styles.anchor} data-landmark={kind}>
        {onClick ? <button className={styles.marker} aria-label={`${title}: ${detail}`} onClick={enter} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}>{label}</button>
          : <span className={`${styles.marker} ${styles.scenic}`}>{label}</span>}
      </div>
    </Html>
    {highlighted && tooltipPortal && <Html position={[0, bounds[1] + 0.4, 0]} center portal={tooltipPortal} calculatePosition={tooltipPosition} zIndexRange={[1, 1]} style={{ pointerEvents: "none" }}>
      <div className={styles.tooltipAnchor}><div className={styles.detail}><strong>{title}</strong><span>{detail}</span></div></div>
    </Html>}
  </group>;
}

const EMPTY_ACTIVE: ActiveSessionProgress[] = [];
const EMPTY_ERRORS: MisconceptionHistoryItem[] = [];
type WorldProps = {
  active?: ActiveSessionProgress[]; errors?: MisconceptionHistoryItem[];
  progress: { mastered: number; total: number; pct: number; dewdrops: number; rank: string };
  command: CameraCommand | null; visible: boolean; busy: boolean; navigate: (href: string) => void;
};
function CoastalWorld({ active=EMPTY_ACTIVE, errors=EMPTY_ERRORS, progress, command, navigate, busy, visible, tooltipPortal }: WorldProps & { tooltipPortal?: RefObject<HTMLElement> }) {
  const size = useThree(state => state.size);
  const frame = worldFrame(size.width, size.height, playableProjectionBounds());
  const visit = (_site: keyof typeof SITES, href: string) => { if(!busy)navigate(href); };
  const activeSession = active[0];
  const activeDetail = activeSession ? `${activeSession.topic_label} · ${Math.round(Number(activeSession.completion_percentage) || 0)}% mapped` : "No active topic yet · choose a trail to begin";
  const selectedSite = command?.kind === "island" ? command.site : undefined;
  return (
    <>
      <color attach="background" args={["#a9d8df"]} />
      <ambientLight intensity={0.7} color="#fff8e7" />
      <directionalLight position={[-38, 60, 35]} intensity={2.6} color="#fffde7" castShadow shadow-mapSize-width={1024} shadow-mapSize-height={1024} shadow-camera-left={-50} shadow-camera-right={50} shadow-camera-top={42} shadow-camera-bottom={-42} shadow-camera-far={130} shadow-normalBias={0.06} shadow-bias={-0.0004} />
      <hemisphereLight args={["#c4dfef", "#697653", 0.7]} />
      <MapCamera command={command} />
      <group position={frame.position} rotation={[0, frame.rotation, 0]} scale={frame.scale}>
        <Ocean />
        <Landscape />

        <Landmark title="SURI Keep" detail="The central welcome hall for your learning kingdom" position={sitePosition("keep")} accent={COLORS.gold} kind="keep" tooltipPortal={visible ? tooltipPortal : undefined} />
        <Landmark title="Quest Guild" detail={activeDetail} position={sitePosition("guild")} onClick={() => visit("guild", activeSession ? `/session/${activeSession.id}/lesson` : "/topics")} kind="guild" selected={selectedSite === "guild"} tooltipPortal={visible ? tooltipPortal : undefined} />
        <Landmark title="Topics · Learning Grove" detail="Browse topics and choose your next learning trail" position={sitePosition("topics")} onClick={() => visit("topics", "/topics")} kind="topics" selected={selectedSite === "topics"} tooltipPortal={visible ? tooltipPortal : undefined} />
        <Landmark title="Ranger Hall" detail={`${progress.pct}% mastery · ${progress.dewdrops} dewdrops · ${progress.rank}`} position={sitePosition("ranger")} onClick={() => visit("ranger", "/progress")} kind="ranger" selected={selectedSite === "ranger"} tooltipPortal={visible ? tooltipPortal : undefined} />
        <Landmark title="Coliseum" detail="Train skills and celebrate your mastery" position={sitePosition("arena")} onClick={() => visit("arena", "/progress")} kind="arena" selected={selectedSite === "arena"} tooltipPortal={visible ? tooltipPortal : undefined} />

        <Landmark title="Topics · Grand Academy" detail="Browse the complete learning map" position={sitePosition("academy")} onClick={() => visit("academy", "/topics")} kind="academy" selected={selectedSite === "academy"} tooltipPortal={visible ? tooltipPortal : undefined} />
        <Landmark title="Error History · Hall of Records" detail={`${errors.length} misconception records · inspect the error history`} position={sitePosition("records")} onClick={() => visit("records", "/error-history")} kind="records" selected={selectedSite === "records"} tooltipPortal={visible ? tooltipPortal : undefined} />
        <Landmark title="Progress · Hall of Champions" detail={`${progress.mastered}/${progress.total || 0} skills mastered · view progress`} position={sitePosition("champions")} onClick={() => visit("champions", "/progress")} kind="champions" selected={selectedSite === "champions"} tooltipPortal={visible ? tooltipPortal : undefined} />
        <Landmark title="Calculator · Arcane Tower" detail="Solve and explore equations" position={sitePosition("calculator")} onClick={() => visit("calculator", "/calculator")} kind="calculator" selected={selectedSite === "calculator"} tooltipPortal={visible ? tooltipPortal : undefined} />
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
  const tooltipPortal = useRef<HTMLElement>(null!);
  const [tooltipPortalReady, setTooltipPortalReady] = useState(false);
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
  useEffect(() => {
    const portal = document.createElement("div");
    portal.className = styles.tooltipPortal;
    document.body.appendChild(portal);
    tooltipPortal.current = portal;
    const frame = window.requestAnimationFrame(() => setTooltipPortalReady(true));
    return () => { window.cancelAnimationFrame(frame); portal.remove(); tooltipPortal.current = null!; };
  }, []);
  return (
    <div className={`dashboard-world ${styles.world}`}>
      {showSaved && <div className="world-toast">✦ Progress cataloged in the kingdom archives.</div>}
      <div className={styles.viewport}><Canvas
        className="dashboard-canvas"
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
        frameloop={props.visible ? "always" : "never"}
        orthographic
        shadows="percentage"
        dpr={[1, 1.25]}
        camera={{ position: [...CAMERA_POSITION], near: 0.5, far: 650 }}
        gl={{ antialias: true, powerPreference: "high-performance" }}
        onCreated={({ gl }) => {
          gl.shadowMap.enabled = true;
          gl.shadowMap.type = THREE.PCFSoftShadowMap;
        }}
      >
        <Suspense fallback={null}><CoastalWorld {...props} tooltipPortal={tooltipPortalReady ? tooltipPortal : undefined} /></Suspense>
      </Canvas></div>
      {tutorialOpen && <TutorialModal onClose={() => setTutorialOpen(false)} />}
    </div>
  );
}


export default memo(DashboardWorld);

