"use client";

import { PerspectiveCamera } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { memo, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { configureWorldRenderer } from "@/lib/three/renderer";
import FantasySpellbook, { useSpellbookAssets } from "@/components/FantasySpellbook";
import { getSpellbookLayout } from "@/lib/three/spellbookLayout";

export type CarouselBook = {
  nodeId: string;
  label: string;
  grade: number;
  ordinal: number;
  mastery: number;
  status: "Mastered" | "In Progress" | "Not Attempted";
  hasProgress: boolean;
  completed: boolean;
};

type TopicBookCarouselProps = {
  books: CarouselBook[];
  activeIndex: number;
  onBookClick: (index: number) => void;
  onBookIntent?: (index: number) => void;
  onPeakLayout?: (top: number, height: number, center: number) => void;
};

type CarouselSceneProps = TopicBookCarouselProps & { reducedMotion: boolean };

const TWO_PI = Math.PI * 2;

function shortestAngle(current: number, target: number) {
  const delta = THREE.MathUtils.euclideanModulo(target - current + Math.PI, TWO_PI) - Math.PI;
  return current + delta;
}

function Book({
  book,
  index,
  angle,
  radius,
  selected,
  hovered,
  carouselRotation,
  onClick,
  onIntent,
  onHoverChange,
  reducedMotion,
  assets,
}: {
  book: CarouselBook;
  index: number;
  angle: number;
  radius: number;
  selected: boolean;
  hovered: boolean;
  carouselRotation: React.MutableRefObject<number>;
  onClick: () => void;
  onIntent?: () => void;
  onHoverChange: (hovering: boolean) => void;
  reducedMotion: boolean;
  assets: ReturnType<typeof useSpellbookAssets>;
}) {
  const invalidate = useThree(state => state.invalidate);
  const body = useRef<THREE.Group>(null);
  const emphasis = useRef(selected ? 1 : 0);
  const hoverLift = useRef(hovered ? 1 : 0);
  const phase = index * 1.57 + 0.6;

  useFrame((state, delta) => {
    const group = body.current;
    if (!group) return;
    const step = Math.min(delta, .05);
    emphasis.current = reducedMotion ? Number(selected) : THREE.MathUtils.damp(emphasis.current, selected ? 1 : 0, 5.5, step);
    hoverLift.current = reducedMotion ? 0 : THREE.MathUtils.damp(hoverLift.current, hovered ? 1 : 0, 9, step);
    if (Math.abs(emphasis.current - Number(selected)) > .001 || (!reducedMotion && Math.abs(hoverLift.current - Number(hovered)) > .001)) invalidate();
    const focus = emphasis.current;
    const hover = hoverLift.current;
    const worldAngle = angle + carouselRotation.current;
    const elapsed = state.clock.getElapsed();
    const bob = reducedMotion ? 0 : Math.sin(elapsed * .95 + phase) * (.10 + index * .008);
    // The book at the far side rises above the foreground volume instead of
    // disappearing directly behind it, so all four positions stay legible.
    const rearLift = Math.pow(Math.max(0, -Math.cos(worldAngle)), 2) * 1.18;
    // Give the closed volumes room beside the wider, open foreground book.
    const side = Math.sin(worldAngle);
    const spread = side * (side < 0 ? 1.9 : 1.25);
    const forward = THREE.MathUtils.lerp(-0.24, 0.92, focus);
    group.position.set(
      spread * Math.cos(carouselRotation.current) - forward * Math.sin(carouselRotation.current),
      bob + focus * 0.18 + rearLift + hover * (selected ? .04 : .14),
      spread * Math.sin(carouselRotation.current) + forward * Math.cos(carouselRotation.current),
    );
    const scale = THREE.MathUtils.lerp(0.96, 1.06, focus) * (1 + hover * (selected ? .012 : .04));
    group.scale.setScalar(scale);
    // Cancelling the parent yaw keeps covers readable while a small angle-dependent
    // tilt makes the surrounding volumes feel placed around the ring rather than flat.
    group.rotation.set(0.025 + Math.sin(worldAngle) * 0.07, -carouselRotation.current + Math.sin(worldAngle) * 0.24, reducedMotion ? 0 : Math.sin(elapsed * .55 + phase) * .014);
  });

  return <group position={[Math.sin(angle) * radius, 0, Math.cos(angle) * radius]}>
    <group ref={body} onPointerOver={() => { onIntent?.(); onHoverChange(true); }} onPointerOut={() => onHoverChange(false)} onClick={(event) => { event.stopPropagation(); onClick(); }}>
      <FantasySpellbook book={book} index={index} selected={selected} angle={angle} carouselRotation={carouselRotation} reducedMotion={reducedMotion} assets={assets} />
    </group>
  </group>;
}

function CarouselScene({ books, activeIndex, onBookClick, onBookIntent, onPeakLayout, reducedMotion }: CarouselSceneProps) {
  const assets = useSpellbookAssets();
  const invalidate = useThree(state => state.invalidate);
  const canvas = useThree(state => state.gl.domElement);
  const size = useThree(state => state.size);
  const carousel = useRef<THREE.Group>(null);
  const rotation = useRef(0);
  const targetRotation = useRef(0);
  const measuredLayout = useRef("");
  const count = books.length;
  const angleStep = count ? TWO_PI / count : 0;
  const radius = 2.95;
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  // Fit the wider, open book without making the phone presentation too small.
  const aspect = size.width / Math.max(1, size.height);
  const cameraZ = Math.max(12.9, 6.2 / (Math.tan(THREE.MathUtils.degToRad(20)) * Math.max(.9, aspect)));

  useEffect(() => {
    if (reducedMotion) return;
    let onScreen = false;
    let running = false;
    let frame = 0;
    let previous = 0;
    const tick = (time: number) => {
      if (time - previous >= 1000 / 30) {
        invalidate();
        previous = time - (time - previous) % (1000 / 30);
      }
      frame = window.requestAnimationFrame(tick);
    };
    const sync = () => {
      const active = onScreen && !document.hidden;
      if (active && !running) {
        running = true;
        previous = 0;
        frame = window.requestAnimationFrame(tick);
      } else if (!active && running) {
        running = false;
        window.cancelAnimationFrame(frame);
      }
    };
    const observer = new IntersectionObserver(([entry]) => {
      onScreen = entry.isIntersecting;
      sync();
    });
    observer.observe(canvas);
    document.addEventListener("visibilitychange", sync);
    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
      document.removeEventListener("visibilitychange", sync);
    };
  }, [canvas, invalidate, reducedMotion]);

  useEffect(() => {
    if (!count) return;
    // angle 0 is the camera-facing point (+z).  Selecting an item only ever
    // takes the shortest quarter-turn (with the current four-topic catalogue).
    targetRotation.current = shortestAngle(rotation.current, -activeIndex * angleStep);
    invalidate();
  }, [activeIndex, angleStep, count, invalidate]);

  useFrame((state, delta) => {
    const group = carousel.current;
    if (!group) return;
    rotation.current = reducedMotion ? targetRotation.current : THREE.MathUtils.damp(rotation.current, targetRotation.current, 4.6, Math.min(delta, .05));
    if (Math.abs(rotation.current - targetRotation.current) > .001) invalidate();
    group.rotation.y = rotation.current;
    // Measure once per selection/resize, after the cover has opened. This only
    // adjusts the surrounding CSS margin; the carousel and book scale stay put.
    const layoutKey = `${activeIndex}:${size.width}:${size.height}:${reducedMotion}`;
    if (!onPeakLayout || measuredLayout.current === layoutKey || Math.abs(rotation.current - targetRotation.current) > .001) return;
    const body = group.children[activeIndex]?.children[0];
    const cover = body?.getObjectByName("spellbook-cover");
    if (!body || !cover || body.scale.x < 1.059 || Math.abs(cover.rotation.y + 2.57) > .003) return;
    const layout = getSpellbookLayout(body, state.camera, size.height, activeIndex, reducedMotion);
    if (layout !== null) {
      measuredLayout.current = layoutKey;
      onPeakLayout(layout.top, size.height, layout.center);
    }
  });

  return <>
    <PerspectiveCamera makeDefault position={[0, .22, cameraZ]} fov={40} near={.1} far={100} />
    <ambientLight intensity={1.15} color="#fff5d7" />
    <hemisphereLight args={["#f8dfaa", "#211009", 1.05]} />
    <directionalLight castShadow position={[-5, 7, 8]} intensity={2.25} color="#fff0c6" shadow-mapSize-width={1024} shadow-mapSize-height={1024} />
    <pointLight position={[0, 2.5, 5]} intensity={1.2} color="#f4cd57" distance={13} />
    <group ref={carousel} position={[0, 0.1, 0]} scale={1.0625}>
      {books.map((book, index) => <Book key={book.nodeId} book={book} index={index} angle={index * angleStep} radius={radius} selected={index === activeIndex} hovered={index === hoveredIndex} carouselRotation={rotation} reducedMotion={reducedMotion} assets={assets} onHoverChange={(hovering) => setHoveredIndex(current => hovering ? index : current === index ? null : current)} onClick={() => onBookClick(index)} onIntent={() => onBookIntent?.(index)} />)}
    </group>
    <mesh position={[0, -2.28, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[14, 8]} />
      <meshBasicMaterial map={assets.groundShadow} transparent opacity={.55} depthWrite={false} />
    </mesh>
  </>;
}

/** A transparent, WebGL-based ring of real topic books; the island behind it stays untouched. */
function TopicBookCarousel(props: TopicBookCarouselProps) {
  const [reducedMotion, setReducedMotion] = useState(false);
  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(preference.matches);
    update();
    preference.addEventListener("change", update);
    return () => preference.removeEventListener("change", update);
  }, []);
  // The centered lens leaves room for the full floating book and its bookmark.
  const camera = useMemo(() => ({ position: [0, .22, 12.9] as [number, number, number], fov: 40, near: 0.1, far: 100 }), []);
  if (!props.books.length) return null;

  return <Canvas
    frameloop="demand"
    shadows="percentage"
    dpr={[1, 1.35]}
    camera={camera}
    style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
    gl={{ alpha: true, antialias: true, powerPreference: "high-performance" }}
    onCreated={({ gl }) => {
      gl.setClearColor(0x000000, 0);
      configureWorldRenderer(gl);
    }}
  >
    <CarouselScene {...props} reducedMotion={reducedMotion} />
  </Canvas>;
}

export default memo(TopicBookCarousel);
