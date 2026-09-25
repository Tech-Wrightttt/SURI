"use client";

import { ContactShadows, RoundedBox, Text } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { memo, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { configureWorldRenderer } from "@/lib/three/renderer";

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
};

type BookPalette = {
  cover: string;
  coverDark: string;
  accent: string;
  pattern: string;
};

const PALETTES: BookPalette[] = [
  { cover: "#653b21", coverDark: "#2d160c", accent: "#ffe288", pattern: "#bd7b31" },
  { cover: "#542777", coverDark: "#28123e", accent: "#f6d173", pattern: "#9c4bc1" },
  { cover: "#2d7040", coverDark: "#15341e", accent: "#ffe288", pattern: "#65b76e" },
  { cover: "#7a2e3c", coverDark: "#3b1019", accent: "#f6d173", pattern: "#bd5e61" },
];

const BOOK_SYMBOLS = ["≠", "√", "x²", "∏"];
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
}) {
  const body = useRef<THREE.Group>(null);
  const emphasis = useRef(selected ? 1 : 0);
  const hoverLift = useRef(hovered ? 1 : 0);
  const palette = PALETTES[index % PALETTES.length];
  const phase = index * 1.57 + 0.6;
  const symbol = BOOK_SYMBOLS[index % BOOK_SYMBOLS.length];

  useFrame((state, delta) => {
    const group = body.current;
    if (!group) return;
    emphasis.current = THREE.MathUtils.damp(emphasis.current, selected ? 1 : 0, 5.5, delta);
    hoverLift.current = THREE.MathUtils.damp(hoverLift.current, hovered ? 1 : 0, 9, delta);
    const focus = emphasis.current;
    const hover = hoverLift.current;
    const worldAngle = angle + carouselRotation.current;
    const elapsed = state.clock.getElapsed();
    const bob = Math.sin(elapsed * 1.1 + phase) * (0.12 + index * 0.008);
    // The book at the far side rises above the foreground volume instead of
    // disappearing directly behind it, so all four positions stay legible.
    const rearLift = Math.pow(Math.max(0, -Math.cos(worldAngle)), 2) * 1.18;
    group.position.set(0, bob + focus * 0.18 + rearLift + hover * 0.14, THREE.MathUtils.lerp(-0.24, 0.92, focus));
    const scale = THREE.MathUtils.lerp(0.82, 1.12, focus) * (1 + hover * 0.055);
    group.scale.setScalar(scale);
    // Cancelling the parent yaw keeps covers readable while a small angle-dependent
    // tilt makes the surrounding volumes feel placed around the ring rather than flat.
    group.rotation.set(0.04 + Math.sin(worldAngle) * 0.09, -carouselRotation.current + Math.sin(worldAngle) * 0.32, Math.sin(elapsed * 0.55 + phase) * 0.018);
  });

  return <group position={[Math.sin(angle) * radius, 0, Math.cos(angle) * radius]}>
    <group ref={body} onPointerOver={() => { onIntent?.(); onHoverChange(true); }} onPointerOut={() => onHoverChange(false)} onClick={(event) => { event.stopPropagation(); onClick(); }}>
      <mesh castShadow receiveShadow position={[0, 0, -0.08]}>
        <boxGeometry args={[2.25, 3.18, 0.52]} />
        <meshStandardMaterial color="#efe5c8" roughness={0.86} />
      </mesh>
      <RoundedBox castShadow args={[2.42, 3.38, 0.16]} radius={0.055} smoothness={3} position={[0, 0, 0.27]}>
        <meshStandardMaterial color={palette.cover} roughness={0.45} metalness={0.08} />
      </RoundedBox>
      <RoundedBox castShadow args={[2.42, 3.38, 0.16]} radius={0.055} smoothness={3} position={[0, 0, -0.43]}>
        <meshStandardMaterial color={palette.coverDark} roughness={0.58} />
      </RoundedBox>
      <mesh castShadow position={[-1.18, 0, -0.07]}>
        <boxGeometry args={[0.18, 3.4, 0.78]} />
        <meshStandardMaterial color={palette.coverDark} roughness={0.48} metalness={0.08} />
      </mesh>
      <mesh position={[1.13, 0, -0.07]}>
        <boxGeometry args={[0.045, 3.05, 0.5]} />
        <meshStandardMaterial color="#d9caa9" roughness={0.9} />
      </mesh>
      {[-1.08, -0.66, -0.24, 0.18, 0.6, 1.02].map(y => <mesh key={y} position={[1.16, y, 0.02]}>
        <boxGeometry args={[0.055, 0.018, 0.48]} />
        <meshStandardMaterial color="#9d8c70" roughness={0.92} />
      </mesh>)}

      <mesh position={[0, 0, 0.365]}>
        <planeGeometry args={[1.88, 2.78]} />
        <meshStandardMaterial color={palette.coverDark} roughness={0.62} />
      </mesh>
      <mesh position={[0, 0, 0.378]}>
        <boxGeometry args={[1.98, 2.88, 0.025]} />
        <meshStandardMaterial color={palette.pattern} roughness={0.4} metalness={0.16} />
      </mesh>
      <mesh position={[0, 0, 0.397]}>
        <planeGeometry args={[1.82, 2.72]} />
        <meshStandardMaterial color={palette.cover} roughness={0.5} />
      </mesh>
      <mesh position={[0, 0.15, 0.422]}>
        <torusGeometry args={[0.38, 0.05, 8, 32]} />
        <meshStandardMaterial color={palette.accent} metalness={0.5} roughness={0.28} emissive={selected ? palette.accent : "#000000"} emissiveIntensity={selected ? 0.17 : 0} />
      </mesh>
      <mesh position={[0, 0.15, 0.427]} rotation={[0, 0, Math.PI / 4]}>
        <boxGeometry args={[0.5, 0.5, 0.025]} />
        <meshStandardMaterial color={palette.accent} metalness={0.35} roughness={0.32} />
      </mesh>
      <Text position={[0, 0.15, 0.456]} color={palette.coverDark} fontSize={0.31} fontWeight={900} anchorX="center" anchorY="middle">
        {symbol}
      </Text>
      <Text position={[0, 1.02, 0.43]} color="#fff9e8" fontSize={0.18} fontWeight={700} letterSpacing={0.1} anchorX="center" anchorY="middle">
        {`TOPIC ${String(book.ordinal).padStart(2, "0")}`}
      </Text>
      <Text position={[0, -0.93, 0.43]} color={palette.accent} fontSize={0.16} fontWeight={800} maxWidth={1.68} textAlign="center" anchorX="center" anchorY="middle" lineHeight={1.12}>
        {book.label}
      </Text>
      {selected && <pointLight position={[0, 0.2, 1.35]} color={palette.accent} intensity={0.65} distance={3.8} />}
    </group>
  </group>;
}

function CarouselScene({ books, activeIndex, onBookClick, onBookIntent }: TopicBookCarouselProps) {
  const carousel = useRef<THREE.Group>(null);
  const rotation = useRef(0);
  const targetRotation = useRef(0);
  const count = books.length;
  const angleStep = count ? TWO_PI / count : 0;
  const radius = 3.5;
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  useEffect(() => {
    if (!count) return;
    // angle 0 is the camera-facing point (+z).  Selecting an item only ever
    // takes the shortest quarter-turn (with the current four-topic catalogue).
    targetRotation.current = shortestAngle(rotation.current, -activeIndex * angleStep);
  }, [activeIndex, angleStep, count]);

  useFrame((state, delta) => {
    const group = carousel.current;
    if (!group) return;
    rotation.current = THREE.MathUtils.damp(rotation.current, targetRotation.current, 4.6, delta);
    const idleOrbit = Math.sin(state.clock.getElapsed() * 0.21) * 0.055;
    group.rotation.y = rotation.current + idleOrbit;
  });

  return <>
    <ambientLight intensity={1.15} color="#fff5d7" />
    <hemisphereLight args={["#f8dfaa", "#211009", 1.05]} />
    <directionalLight castShadow position={[-5, 7, 8]} intensity={2.25} color="#fff0c6" shadow-mapSize-width={1024} shadow-mapSize-height={1024} />
    <pointLight position={[0, 2.5, 5]} intensity={1.2} color="#f4cd57" distance={13} />
    <group ref={carousel} position={[0, 0.1, 0]} scale={1.0625}>
      {books.map((book, index) => <Book key={book.nodeId} book={book} index={index} angle={index * angleStep} radius={radius} selected={index === activeIndex} hovered={index === hoveredIndex} carouselRotation={rotation} onHoverChange={(hovering) => setHoveredIndex(current => hovering ? index : current === index ? null : current)} onClick={() => onBookClick(index)} onIntent={() => onBookIntent?.(index)} />)}
    </group>
    <ContactShadows position={[0, -2.28, 0]} opacity={0.32} scale={12.75} blur={2.7} far={6.5} color="#160b07" />
  </>;
}

/** A transparent, WebGL-based ring of real topic books; the island behind it stays untouched. */
function TopicBookCarousel(props: TopicBookCarouselProps) {
  // The slightly wider camera frame provides a safe visual margin for the
  // selected book's lift, glow, and hover motion at every carousel position.
  const camera = useMemo(() => ({ position: [0, 1.15, 12.9] as [number, number, number], fov: 40, near: 0.1, far: 100 }), []);
  if (!props.books.length) return null;

  return <Canvas
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
    <CarouselScene {...props} />
  </Canvas>;
}

export default memo(TopicBookCarousel);
