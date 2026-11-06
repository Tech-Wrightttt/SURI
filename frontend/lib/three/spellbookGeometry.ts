import * as THREE from "three";
import { toCreasedNormals } from "three/examples/jsm/utils/BufferGeometryUtils.js";

// Match the existing RoundedBox bevels and normals, but build each shape once
// for the whole carousel instead of once per board, clasp, and book.
function roundedBox(width: number, height: number, depth: number, radius: number, smoothness: number) {
  const epsilon = .00001;
  const bevel = radius - epsilon;
  const shape = new THREE.Shape();
  shape.absarc(epsilon, epsilon, epsilon, -Math.PI / 2, -Math.PI, true);
  shape.absarc(epsilon, height - bevel * 2, epsilon, Math.PI, Math.PI / 2, true);
  shape.absarc(width - bevel * 2, height - bevel * 2, epsilon, Math.PI / 2, 0, true);
  shape.absarc(width - bevel * 2, epsilon, epsilon, 0, -Math.PI / 2, true);
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: depth - radius * 2,
    bevelEnabled: true,
    bevelSegments: 8,
    steps: 1,
    bevelSize: bevel,
    bevelThickness: radius,
    curveSegments: smoothness,
  });
  geometry.center();
  return toCreasedNormals(geometry, .4);
}

export function createSpellbookGeometry() {
  return {
    board: roundedBox(2.42, 3.4, .18, .055, 3),
    inset: roundedBox(1.95, 2.80, .018, .035, 2),
    clasp: roundedBox(.29, .27, .075, .025, 2),
    pageBlock: new THREE.BoxGeometry(2.22, 3.15, .51),
    page: new THREE.PlaneGeometry(2.2, 3.13),
    flyleaf: new THREE.PlaneGeometry(2.18, 3.11),
    glow: new THREE.RingGeometry(.573, .581, 64),
    spine: new THREE.CylinderGeometry(.19, .19, 3.42, 16),
    seal: new THREE.TorusGeometry(.26, .045, 8, 40),
    gem: new THREE.IcosahedronGeometry(.235, 2),
    glint: new THREE.SphereGeometry(.047, 10, 6),
    lettering: new THREE.PlaneGeometry(2.42, 3.4),
    endpaper: new THREE.PlaneGeometry(2.18, 3.12),
  };
}
