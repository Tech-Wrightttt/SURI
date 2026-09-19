"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { shoreDistance } from "@/lib/worldMap/landscape";

// The shader uses world-map X/Z coordinates even though the plane is rotated
// into place below. That keeps wave directions and coastline data stable when
// the complete map is framed or rotated for the isometric camera.
const VERTEX_SHADER = `
  attribute float shore;
  attribute float exposure;

  uniform float uTime;

  varying float vShore;
  varying float vExposure;
  varying float vWaveHeight;
  varying float vWaveSlope;
  varying vec2 vOceanPosition;
  varying vec3 vWaveNormal;
  varying vec3 vViewDirection;

  void main() {
    // The local plane's Y axis becomes negative world Z after its -PI/2 turn.
    vec2 oceanPosition = vec2(position.x, -position.y);
    float shoreFactor = smoothstep(0.0, 10.0, shore);
    float openWater = mix(0.58, 1.0, exposure);
    float amplitude = mix(0.60, 1.0, shoreFactor) * openWater;

    // Three independent swells plus two small, warped ripples. The derivative
    // terms below yield a procedural normal that moves with the real geometry.
    float phaseA = dot(oceanPosition, vec2(0.115, 0.048)) + uTime * 0.52;
    float phaseB = dot(oceanPosition, vec2(-0.072, 0.096)) - uTime * 0.36 + 1.7;
    float phaseC = dot(oceanPosition, vec2(0.215, -0.183)) + uTime * 0.91 + sin(oceanPosition.y * 0.071);
    float phaseD = dot(oceanPosition, vec2(-0.43, -0.29)) - uTime * 1.36 + sin(oceanPosition.x * 0.12);
    float phaseE = dot(oceanPosition, vec2(0.62, -0.36)) + uTime * 1.74;

    float waveHeight = (
      sin(phaseA) * 0.145 +
      sin(phaseB) * 0.092 +
      sin(phaseC) * 0.052 +
      sin(phaseD) * 0.020 +
      cos(phaseE) * 0.012
    ) * amplitude;

    float dHeightX = (
      cos(phaseA) * 0.145 * 0.115 +
      cos(phaseB) * 0.092 * -0.072 +
      cos(phaseC) * 0.052 * 0.215 +
      cos(phaseD) * 0.020 * (-0.43 + cos(oceanPosition.x * 0.12) * 0.12) -
      sin(phaseE) * 0.012 * 0.62
    ) * amplitude;
    float dHeightZ = (
      cos(phaseA) * 0.145 * 0.048 +
      cos(phaseB) * 0.092 * 0.096 +
      cos(phaseC) * 0.052 * (-0.183 + cos(oceanPosition.y * 0.071) * 0.071) +
      cos(phaseD) * 0.020 * -0.29 -
      sin(phaseE) * 0.012 * -0.36
    ) * amplitude;

    // Small horizontal drift makes a crest travel across the surface instead
    // of only moving up and down, while preserving the inexpensive grid mesh.
    vec2 drift = vec2(
      sin(phaseB) * 0.10 + cos(phaseD) * 0.035,
      cos(phaseA) * 0.08 + sin(phaseC) * 0.045
    ) * amplitude;
    vec3 displaced = vec3(position.xy + vec2(drift.x, -drift.y), waveHeight);
    vec4 worldPosition = modelMatrix * vec4(displaced, 1.0);
    vec3 localNormal = normalize(vec3(-dHeightX, dHeightZ, 1.0));

    vShore = shore;
    vExposure = exposure;
    vWaveHeight = waveHeight;
    vWaveSlope = length(vec2(dHeightX, dHeightZ));
    vOceanPosition = oceanPosition;
    vWaveNormal = normalize(mat3(modelMatrix) * localNormal);
    vViewDirection = normalize(cameraPosition - worldPosition.xyz);
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
  }
`;

const FRAGMENT_SHADER = `
  uniform float uTime;

  varying float vShore;
  varying float vExposure;
  varying float vWaveHeight;
  varying float vWaveSlope;
  varying vec2 vOceanPosition;
  varying vec3 vWaveNormal;
  varying vec3 vViewDirection;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }

  float noise(vec2 p) {
    vec2 cell = floor(p);
    vec2 local = fract(p);
    local = local * local * (3.0 - 2.0 * local);
    return mix(
      mix(hash(cell), hash(cell + vec2(1.0, 0.0)), local.x),
      mix(hash(cell + vec2(0.0, 1.0)), hash(cell + vec2(1.0, 1.0)), local.x),
      local.y
    );
  }

  float foamNoise(vec2 p) {
    return noise(p) * 0.55 + noise(p * 2.07 + 9.3) * 0.30 + noise(p * 4.13 - 5.1) * 0.15;
  }

  void main() {
    float offshore = smoothstep(0.0, 15.0, vShore);
    float surfaceVariation = foamNoise(vOceanPosition * 0.075 + vec2(uTime * 0.012, -uTime * 0.008));

    // Bright cyan shallows fade into a rich, still-saturated blue rather than
    // using alpha. This is a fully opaque body of water at every depth.
    vec3 shallow = vec3(0.025, 0.62, 0.73);
    vec3 turquoise = vec3(0.012, 0.43, 0.65);
    vec3 openOcean = vec3(0.012, 0.25, 0.51);
    vec3 color = mix(shallow, turquoise, smoothstep(0.12, 0.58, offshore));
    color = mix(color, openOcean, smoothstep(0.52, 1.0, offshore));
    color += vec3(0.012, 0.055, 0.074) * (surfaceVariation - 0.42);

    vec3 sunDirection = normalize(vec3(-0.42, 0.30, 0.86));
    float diffuse = 0.64 + max(dot(vWaveNormal, sunDirection), 0.0) * 0.42;
    float fresnel = pow(1.0 - max(dot(vWaveNormal, vViewDirection), 0.0), 3.3);
    color *= diffuse;
    color += vec3(0.08, 0.18, 0.24) * fresnel * 0.22;

    // A moving, broken band brings foam into the coast. More exposed shorelines
    // receive stronger surf; narrow water between islands remains calmer.
    float coastBand = 1.0 - smoothstep(0.18, 3.9, vShore);
    float incomingWave = sin(vShore * 4.6 - uTime * 1.65 + surfaceVariation * 7.0);
    float brokenEdge = smoothstep(0.34, 0.72, foamNoise(vOceanPosition * 0.72 + vec2(-uTime * 0.16, uTime * 0.11)));
    float shoreFoam = coastBand * smoothstep(-0.35, 0.74, incomingWave + brokenEdge * 0.82 - 0.47);
    shoreFoam *= mix(0.55, 1.0, vExposure);

    // Whitecaps are reserved for the highest, steeper open-water crests, so
    // they read as occasional lively highlights instead of a tiled pattern.
    float crest = smoothstep(0.105, 0.185, vWaveHeight + vWaveSlope * 0.72);
    float whitecapNoise = smoothstep(0.45, 0.72, foamNoise(vOceanPosition * 0.52 + uTime * vec2(0.09, -0.07)));
    float whitecaps = crest * whitecapNoise * smoothstep(0.42, 0.92, offshore) * mix(0.55, 1.0, vExposure);
    float foam = clamp(shoreFoam + whitecaps * 0.74, 0.0, 1.0);
    color = mix(color, vec3(0.91, 0.985, 1.0), foam * 0.86);

    gl_FragColor = vec4(color, 1.0);
  }
`;

function makeOceanGeometry() {
  // This stays compact enough for a locked isometric view, yet is dense enough
  // for the shader's vertex displacement to create clearly readable crests.
  const geometry = new THREE.PlaneGeometry(220, 190, 168, 144);
  const positions = geometry.attributes.position;
  const shore = new Float32Array(positions.count);
  const exposure = new Float32Array(positions.count);
  const sampleRadius = 8;

  for (let index = 0; index < positions.count; index++) {
    const x = positions.getX(index);
    const z = -positions.getY(index);
    shore[index] = Math.min(16, Math.max(0, -shoreDistance(x, z)));

    // Count how much open water surrounds this point. A coast facing the outer
    // ocean approaches 1, while channels hemmed in by islands approach 0.
    let openSamples = 0;
    for (let direction = 0; direction < 8; direction++) {
      const angle = direction * Math.PI * 0.25;
      if (shoreDistance(x + Math.cos(angle) * sampleRadius, z + Math.sin(angle) * sampleRadius) < 0) openSamples++;
    }
    exposure[index] = openSamples / 8;
  }

  geometry.setAttribute("shore", new THREE.BufferAttribute(shore, 1));
  geometry.setAttribute("exposure", new THREE.BufferAttribute(exposure, 1));
  return geometry;
}

/** A solid, procedural archipelago ocean: no textures, simulation, or alpha. */
export function Ocean() {
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const timer = useMemo(() => new THREE.Timer(), []);
  const elapsed = useRef(0);
  const uniforms = useMemo(() => ({ uTime: { value: 0 } }), []);
  const geometry = useMemo(() => makeOceanGeometry(), []);

  useEffect(() => {
    timer.connect(document);
    return () => timer.dispose();
  }, [timer]);

  useEffect(() => () => geometry.dispose(), [geometry]);

  useFrame(() => {
    // THREE.Timer replaces deprecated Clock and keeps tab-resume deltas bounded.
    timer.update();
    elapsed.current += Math.min(timer.getDelta(), 0.05);
    if (materialRef.current) materialRef.current.uniforms.uTime.value = elapsed.current;
  });

  return (
    <mesh geometry={geometry} position={[0, -0.2, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow frustumCulled>
      <shaderMaterial
        ref={materialRef}
        uniforms={uniforms}
        vertexShader={VERTEX_SHADER}
        fragmentShader={FRAGMENT_SHADER}
        transparent={false}
        depthWrite
      />
    </mesh>
  );
}
