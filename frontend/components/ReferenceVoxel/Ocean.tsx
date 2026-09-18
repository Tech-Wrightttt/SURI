"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

const VERTEX_SHADER = `
  uniform float uTime;
  varying vec2 vUv;
  void main() {
    vUv = position.xy / 180.0 + 0.5;
    vec3 displaced = position;
    displaced.z += sin(position.x * 0.18 + uTime * 0.7) * 0.06;
    displaced.z += cos(position.y * 0.23 - uTime * 0.46) * 0.045;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(displaced, 1.0);
  }
`;

const FRAGMENT_SHADER = `
  uniform float uTime;
  varying vec2 vUv;
  void main() {
    float longWave = sin(vUv.x * 54.0 + uTime * 0.38 + sin(vUv.y * 12.0)) * 0.5 + 0.5;
    float crossWave = cos(vUv.y * 42.0 - uTime * 0.28 + vUv.x * 8.0) * 0.5 + 0.5;
    vec3 deep = vec3(0.035, 0.34, 0.52);
    vec3 shallow = vec3(0.10, 0.55, 0.67);
    vec3 color = mix(deep, shallow, 0.28 + longWave * 0.16 + crossWave * 0.08);
    gl_FragColor = vec4(color, 1.0);
  }
`;

/** A single low-cost animated ocean surface replaces the old cloud void. */
export function Ocean() {
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const uniforms = useMemo(() => ({ uTime: { value: 0 } }), []);
  useFrame((_, delta) => {
    if (materialRef.current) materialRef.current.uniforms.uTime.value += delta;
  });

  return (
    <mesh position={[0, -0.12, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={[2000, 2000, 48, 40]} />
      <shaderMaterial
        ref={materialRef}
        uniforms={uniforms}
        vertexShader={VERTEX_SHADER}
        fragmentShader={FRAGMENT_SHADER}
      />
    </mesh>
  );
}
