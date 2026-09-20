"use client";

import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { shoreDistance } from "@/lib/worldMap/landscape";

// This deliberately has no foam, whitecap, texture-scroll, or time uniform.
// It retains the established shallow-to-open-ocean palette as one clean,
// continuous surface, without loop boundaries or per-frame ocean work.
const VERTEX_SHADER = `
  attribute float shore;
  attribute float exposure;
  varying float vShore;
  varying float vExposure;
  void main() {
    vShore = shore;
    vExposure = exposure;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const FRAGMENT_SHADER = `
  varying float vShore;
  varying float vExposure;
  void main() {
    float offshore = smoothstep(0.0, 15.0, vShore);
    vec3 shallow = vec3(0.025, 0.62, 0.73);
    vec3 turquoise = vec3(0.012, 0.43, 0.65);
    vec3 openOcean = vec3(0.012, 0.25, 0.51);
    vec3 color = mix(shallow, turquoise, smoothstep(0.12, 0.58, offshore));
    color = mix(color, openOcean, smoothstep(0.52, 1.0, offshore));
    // Exposure only subtly deepens enclosed channels; it never produces foam.
    color *= mix(0.94, 1.0, vExposure);
    gl_FragColor = vec4(color, 1.0);
  }
`;

function makeOceanGeometry() {
  const geometry = new THREE.PlaneGeometry(220, 190, 168, 144);
  const positions = geometry.attributes.position;
  const shore = new Float32Array(positions.count);
  const exposure = new Float32Array(positions.count);
  const sampleRadius = 8;
  for (let index = 0; index < positions.count; index++) {
    const x = positions.getX(index), z = -positions.getY(index);
    shore[index] = Math.min(16, Math.max(0, -shoreDistance(x, z)));
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

/** A static, opaque ocean; all generated GPU resources dispose on unmount. */
export function Ocean() {
  const geometry = useMemo(() => makeOceanGeometry(), []);
  const material = useMemo(() => new THREE.ShaderMaterial({ vertexShader: VERTEX_SHADER, fragmentShader: FRAGMENT_SHADER }), []);
  useEffect(() => () => { geometry.dispose(); material.dispose(); }, [geometry, material]);
  return <mesh geometry={geometry} material={material} position={[0, -0.2, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow frustumCulled />;
}
