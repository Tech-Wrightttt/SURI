"use client";

import { RoundedBox } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { memo, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { CarouselBook } from "@/components/TopicBookCarousel";
import {
  createBookmarkGeometry, createCoverMetalwork, createIlluminatedPage,
  createLeatherTextures, createPageEdges, createGroundShadow, createSpineHardware,
  createPageLayers, createCoverLettering, SPELLBOOK_PALETTES,
} from "@/lib/three/spellbookAssets";

export function useSpellbookAssets() {
  const assets = useMemo(() => ({
    ...createLeatherTextures(),
    edges: createPageEdges(),
    metalwork: createCoverMetalwork(),
    spineHardware: createSpineHardware(),
    pageLayers: createPageLayers(),
    endpaper: createIlluminatedPage("", 1, 0, true),
    groundShadow: createGroundShadow(),
    bookmark: createBookmarkGeometry(),
  }), []);
  useEffect(() => () => {
    assets.leather.dispose();
    assets.bump.dispose();
    assets.edges.dispose();
    assets.metalwork.dispose();
    assets.spineHardware.dispose();
    assets.pageLayers.dispose();
    assets.endpaper.dispose();
    assets.groundShadow.dispose();
    assets.bookmark.dispose();
  }, [assets]);
  return assets;
}

type FantasySpellbookProps = {
  book: CarouselBook;
  index: number;
  selected: boolean;
  angle: number;
  carouselRotation: React.MutableRefObject<number>;
  reducedMotion: boolean;
  assets: ReturnType<typeof useSpellbookAssets>;
};

/** A hinged leather grimoire, with raised brasswork and illuminated paper inside. */
function FantasySpellbook({ book, index, selected, angle, carouselRotation, reducedMotion, assets }: FantasySpellbookProps) {
  const invalidate = useThree(state => state.invalidate);
  const palette = SPELLBOOK_PALETTES[index % SPELLBOOK_PALETTES.length];
  const model = useRef<THREE.Group>(null);
  const cover = useRef<THREE.Group>(null);
  const flyleaf = useRef<THREE.Group>(null);
  const glow = useRef<THREE.MeshBasicMaterial>(null);
  const opening = useRef(0);
  const page = useMemo(() => createIlluminatedPage(book.label, book.ordinal, book.grade), [book.label, book.ordinal, book.grade]);
  const lettering = useMemo(() => createCoverLettering(book.label, book.ordinal), [book.label, book.ordinal]);
  useEffect(() => () => { page.dispose(); lettering.dispose(); }, [page, lettering]);

  useFrame((_, delta) => {
    // Open only once the selected volume has arrived at the front of the ring.
    // A new selection closes the old cover while the carousel turns.
    const facing = THREE.MathUtils.euclideanModulo(angle + carouselRotation.current + Math.PI, Math.PI * 2) - Math.PI;
    const target = selected && Math.abs(facing) < .22 ? 1 : 0;
    opening.current = reducedMotion ? target : THREE.MathUtils.damp(opening.current, target, 3.6, Math.min(delta, .05));
    if (Math.abs(opening.current - target) > .001) invalidate();
    if (cover.current) cover.current.rotation.y = -2.57 * opening.current;
    if (model.current) {
      model.current.position.x = .91 * opening.current;
      model.current.rotation.y = .10 * opening.current;
    }
    if (flyleaf.current) flyleaf.current.rotation.y = -.09 * opening.current;
    if (glow.current) glow.current.opacity = opening.current * .12;
  });

  return <group ref={model}>
    {/* Thick, uneven parchment and a leather back board. */}
    <RoundedBox castShadow receiveShadow args={[2.42, 3.4, .18]} radius={.055} smoothness={3} position={[0, 0, -.43]}>
      <meshStandardMaterial color={palette.shadow} map={assets.leather} bumpMap={assets.bump} bumpScale={.045} roughness={.76} />
    </RoundedBox>
    <mesh castShadow receiveShadow position={[0, 0, -.07]}>
      <boxGeometry args={[2.22, 3.15, .51]} />
      <meshStandardMaterial map={assets.edges} roughness={.94} color="#f3dfb2" />
    </mesh>
    <mesh geometry={assets.pageLayers}>
      <meshStandardMaterial color="#dec793" roughness={.9} />
    </mesh>
    <mesh position={[0, 0, .193]}>
      <planeGeometry args={[2.2, 3.13]} />
      <meshStandardMaterial map={page} roughness={.92} />
    </mesh>
    {/* An inset, slightly lifted leaf makes the open page edge catch the light. */}
    <group ref={flyleaf} position={[-1.09, 0, .201]}>
      <mesh position={[1.09, 0, 0]}>
        <planeGeometry args={[2.18, 3.11]} />
        <meshStandardMaterial map={page} roughness={.91} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[1.09, -.11, .006]}>
        <ringGeometry args={[.573, .581, 64]} />
        <meshBasicMaterial ref={glow} color={palette.gem} transparent opacity={0} depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
    </group>

    {/* Rolled leather spine, raised binding bands, brass studs and headcaps. */}
    <mesh castShadow position={[-1.17, 0, -.07]}>
      <cylinderGeometry args={[.19, .19, 3.42, 16]} />
      <meshStandardMaterial color={palette.shadow} map={assets.leather} bumpMap={assets.bump} bumpScale={.04} roughness={.72} />
    </mesh>
    <mesh geometry={assets.spineHardware}>
      <meshStandardMaterial color={palette.metal} metalness={.76} roughness={.36} />
    </mesh>
    <mesh position={[.58, -1.37, -.09]} rotation={[.08, 0, -.08]} geometry={assets.bookmark}>
      <meshStandardMaterial color={palette.ribbon} roughness={.85} side={THREE.DoubleSide} />
    </mesh>

    {/* All front-cover details share the hinge, including the clasps and seal. */}
    <group ref={cover} name="spellbook-cover" position={[-1.18, 0, .32]}>
      <group position={[1.18, 0, 0]}>
        <RoundedBox castShadow receiveShadow args={[2.42, 3.4, .18]} radius={.055} smoothness={3}>
          <meshStandardMaterial color={palette.leather} map={assets.leather} bumpMap={assets.bump} bumpScale={.055} roughness={.66} metalness={.04} />
        </RoundedBox>
        <RoundedBox args={[1.95, 2.80, .018]} radius={.035} smoothness={2} position={[0, 0, .099]}>
          <meshStandardMaterial color={palette.leather} map={assets.leather} bumpMap={assets.bump} bumpScale={.035} roughness={.79} />
        </RoundedBox>
        <mesh geometry={assets.metalwork}>
          <meshStandardMaterial color={palette.metal} metalness={.78} roughness={.35} />
        </mesh>
        <mesh position={[0, .08, .18]}>
          <torusGeometry args={[.26, .045, 8, 40]} />
          <meshStandardMaterial color={palette.metal} metalness={.83} roughness={.25} />
        </mesh>
        <mesh position={[0, .08, .216]} scale={[1, 1, .57]}>
          <icosahedronGeometry args={[.235, 2]} />
          <meshPhysicalMaterial color={palette.gem} emissive={palette.gem} emissiveIntensity={selected ? .46 : .2} roughness={.16} metalness={.22} clearcoat={1} clearcoatRoughness={.08} flatShading />
        </mesh>
        <mesh position={[-.055, .15, .34]} scale={[1, .6, .35]}>
          <sphereGeometry args={[.047, 10, 6]} />
          <meshBasicMaterial color="#e4fbff" transparent opacity={.68} />
        </mesh>
        <mesh position={[0, 0, .17]}>
          <planeGeometry args={[2.42, 3.4]} />
          <meshBasicMaterial map={lettering} transparent alphaTest={.05} depthWrite={false} toneMapped={false} />
        </mesh>
        {[-.86, .86].map(y => <group key={y} position={[1.15, y, .08]}>
          <RoundedBox castShadow args={[.29, .27, .075]} radius={.025} smoothness={2}>
            <meshStandardMaterial color={palette.shadow} roughness={.74} />
          </RoundedBox>
        </group>)}
        {/* Inside endpaper faces the camera after the front board swings open. */}
        <mesh position={[0, 0, -.096]} rotation={[0, Math.PI, 0]}>
          <planeGeometry args={[2.18, 3.12]} />
          <meshStandardMaterial map={assets.endpaper} roughness={.94} />
        </mesh>
      </group>
    </group>
    {selected && <pointLight position={[-.7, .1, 2]} color={palette.gem} intensity={.35} distance={4} />}
  </group>;
}

export default memo(FantasySpellbook);
