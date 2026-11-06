import * as THREE from "three";
import { CAMERA_ORTHO_SIZE, CAMERA_POSITION, CAMERA_TARGET } from "./framing";

// The route close-up uses an orthographic half-height of 17.5 at zoom 1.08.
// Keeping these values here lets the dashboard finish at the same apparent
// scale before its canvas hands off to that close-up.
export const FOCUSED_HALF_HEIGHT = 17.5;
export const FOCUSED_ZOOM = 1.08;
// Keep close-ups on the dashboard's current viewing axis. Position and
// orientation must use the same axis or the selected island drifts off-screen.
export const FOCUSED_CAMERA_OFFSET = new THREE.Vector3(...CAMERA_POSITION)
  .sub(new THREE.Vector3(...CAMERA_TARGET)).normalize().multiplyScalar(Math.sqrt(3) * 82);

export function islandCameraPose(point: THREE.Vector3, options?: { close?: boolean; worldScale?: number }) {
  const camera = new THREE.PerspectiveCamera();
  camera.position.set(...CAMERA_POSITION); camera.lookAt(...CAMERA_TARGET);
  const right = new THREE.Vector3(1,0,0).applyQuaternion(camera.quaternion);
  const up = new THREE.Vector3(0,1,0).applyQuaternion(camera.quaternion);
  const offset = point.clone().sub(new THREE.Vector3(...CAMERA_TARGET));
  const recenter = options?.close ? 1 : 0.18;
  const position = new THREE.Vector3(...CAMERA_POSITION)
    .addScaledVector(right, offset.dot(right)*recenter)
    .addScaledVector(up, offset.dot(up)*recenter);

  if (!options?.close || !options.worldScale) return { position, zoom: 1.12, quaternion: camera.quaternion.clone() };

  // The dashboard scales the world to fit its viewport. Compensate for that
  // scale so its final visible area matches the focused Topics island.
  const zoom = CAMERA_ORTHO_SIZE * FOCUSED_ZOOM / (FOCUSED_HALF_HEIGHT * options.worldScale);
  return {
    position: point.clone().addScaledVector(FOCUSED_CAMERA_OFFSET, options.worldScale),
    zoom,
    quaternion: camera.quaternion.clone(),
  };
}
export function cameraEase(t: number) { return THREE.MathUtils.smootherstep(THREE.MathUtils.clamp(t, 0, 1), 0, 1); }
