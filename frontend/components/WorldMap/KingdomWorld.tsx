"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Canvas } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import type { ActiveSessionProgress, MisconceptionHistoryItem } from "@/lib/api";
import { Landscape } from "./Landscape";
import { MapCamera, CAMERA_POSITION, type CameraTravel } from "./MapCamera";
import { LandmarkArchitecture } from "./Architecture";
import type { LandmarkKind } from "@/lib/worldMap/architecture";
import { SITES, sitePosition } from "@/lib/worldMap/landscape";
import styles from "./landmarks.module.css";
import { Ocean } from "@/components/ReferenceVoxel/Ocean";

type Point3 = [number, number, number];
const COLORS = { gold: "#dfc188", purple: "#a99bd1" };
const HITBOXES: Record<LandmarkKind, Point3> = {
  keep: [11, 12.5, 10], academy: [8, 9, 7], records: [8, 9, 7], champions: [8, 6, 8],
  calculator: [8, 11.5, 8], guild: [10, 7, 8], thorns: [6.5, 6, 5], ranger: [7, 8, 7], arena: [9, 6, 9],
};
const noRaycast: THREE.Mesh["raycast"] = () => {};

function Landmark({ title, detail, position, kind, onClick, accent }: { title: string; detail: string; position: Point3; kind: LandmarkKind; onClick?: () => void; accent?: string }) {
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [selected, setSelected] = useState(false);
  const highlighted = hovered || focused || selected;
  const enter = () => { if (onClick && !selected) { setSelected(true); onClick(); } };
  useEffect(() => () => { document.body.style.cursor = "default"; }, []);
  const label = title.includes(" · ") ? title.split(" · ")[0] : title;
  const bounds = HITBOXES[kind];
  return <group position={position}>
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
      <div className={styles.anchor} data-landmark={kind} data-hovered={hovered}>
        {onClick ? <button className={styles.marker} aria-label={`${title}: ${detail}`} onClick={enter} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}>{selected ? "Traveling…" : label}</button>
          : <span className={`${styles.marker} ${styles.scenic}`}>{label}</span>}
        {highlighted && <div className={styles.detail}><strong>{title}</strong><span>{detail}</span></div>}
      </div>
    </Html>
  </group>;
}

function CoastalWorld({ router, active, errors, progress }: { router: ReturnType<typeof useRouter>; active: ActiveSessionProgress[]; errors: MisconceptionHistoryItem[]; progress: { mastered: number; total: number; pct: number; dewdrops: number; rank: string } }) {
  const [travel, setTravel] = useState<CameraTravel | null>(null);
  const navigating = useRef(false);
  const visit = (site: keyof typeof SITES, href: string) => {
    if (navigating.current) return;
    navigating.current = true;
    document.body.style.cursor = "default";
    router.prefetch(href);
    setTravel({ position: sitePosition(site), onArrive: () => router.push(href) });
  };
  const activeSession = active[0];
  const activeDetail = activeSession ? `${activeSession.topic_label} · ${Math.round(Number(activeSession.completion_percentage) || 0)}% mapped` : "No active topic yet · choose a trail to begin";
  return (
    <>
      <color attach="background" args={["#a9d8df"]} />
      <ambientLight intensity={0.7} color="#fff8e7" />
      <directionalLight position={[-38, 60, 35]} intensity={2.6} color="#fffde7" castShadow shadow-mapSize-width={2048} shadow-mapSize-height={2048} shadow-camera-left={-50} shadow-camera-right={50} shadow-camera-top={42} shadow-camera-bottom={-42} shadow-camera-far={130} shadow-normalBias={0.06} shadow-bias={-0.0004} />
      <hemisphereLight args={["#c4dfef", "#697653", 0.7]} />
      <MapCamera travel={travel} />
      <Ocean />
      <group>
        <Landscape />

        <Landmark title="SURI Keep" detail="The central welcome hall for your learning kingdom" position={sitePosition("keep")} accent={COLORS.gold} kind="keep" />
        <Landmark title="Quest Guild" detail={activeDetail} position={sitePosition("guild")} onClick={() => visit("guild", activeSession ? `/session/${activeSession.id}/lesson` : "/topics")} kind="guild" />
        <Landmark title="Tactics · Tangled Thorns" detail={`${errors.length} ${errors.length === 1 ? "error" : "errors"} logged · review your tangled steps`} position={sitePosition("thorns")} onClick={() => visit("thorns", "/error-history")} kind="thorns" />
        <Landmark title="Ranger Hall" detail={`${progress.pct}% mastery · ${progress.dewdrops} dewdrops · ${progress.rank}`} position={sitePosition("ranger")} onClick={() => visit("ranger", "/progress")} kind="ranger" />
        <Landmark title="Coliseum" detail="Train skills and celebrate your mastery" position={sitePosition("arena")} onClick={() => visit("arena", "/progress")} kind="arena" />

        <Landmark title="Topics · Grand Academy" detail="Browse the complete learning map" position={sitePosition("academy")} onClick={() => visit("academy", "/topics")} kind="academy" />
        <Landmark title="Error History · Hall of Records" detail={`${errors.length} misconception records · inspect the error history`} position={sitePosition("records")} onClick={() => visit("records", "/error-history")} kind="records" />
        <Landmark title="Progress · Hall of Champions" detail={`${progress.mastered}/${progress.total || 0} skills mastered · view progress`} position={sitePosition("champions")} onClick={() => visit("champions", "/progress")} kind="champions" />
        <Landmark title="Calculator · Arcane Tower" detail="Solve and explore equations" position={sitePosition("calculator")} onClick={() => visit("calculator", "/calculator")} kind="calculator" />
      </group>
    </>
  );
}

function Kingdom({ router, active, errors, progress }: { router: ReturnType<typeof useRouter>; active: ActiveSessionProgress[]; errors: MisconceptionHistoryItem[]; progress: { mastered: number; total: number; pct: number; dewdrops: number; rank: string } }) {
  return <CoastalWorld router={router} active={active} errors={errors} progress={progress} />;
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
          <div className="voxel-tutorial-actions"><span>Drag gently left or right</span><span>Click to travel</span><span>Hover to inspect</span></div>
        </div>
        <button className="voxel-close" onClick={onClose}>Got it</button>
      </div>
    </div>
  );
}

export default function DashboardWorld({ active, errors, progress }: { active: ActiveSessionProgress[]; errors: MisconceptionHistoryItem[]; progress: { mastered: number; total: number; pct: number; dewdrops: number; rank: string } }) {
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
    <div className={`dashboard-world ${styles.world}`}>
      {showSaved && <div className="world-toast">✦ Progress cataloged in the kingdom archives.</div>}
      <div className={styles.viewport}><Canvas
        className="dashboard-canvas"
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
        orthographic
        shadows="percentage"
        dpr={[1, 1.5]}
        camera={{ position: [...CAMERA_POSITION], near: 0.5, far: 650 }}
        gl={{ antialias: true, powerPreference: "high-performance" }}
        onCreated={({ gl }) => {
          gl.shadowMap.enabled = true;
          gl.shadowMap.type = THREE.PCFShadowMap;
        }}
      >
        <Suspense fallback={null}><Kingdom router={router} active={active} errors={errors} progress={progress} /></Suspense>
      </Canvas></div>
      {tutorialOpen && <TutorialModal onClose={() => setTutorialOpen(false)} />}
    </div>
  );
}

