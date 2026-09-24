import * as THREE from "three";
import { CAMERA_ORTHO_SIZE, CAMERA_POSITION, CAMERA_TARGET } from "./framing";

export const ISLAND_ROUTES = {
  "/progress": "champions", "/topics": "topics", "/error-history": "records", "/calculator": "calculator",
} as const;
export type IslandRoute = keyof typeof ISLAND_ROUTES;
export const ZOOM_DURATION = 0.22;
export const RETURN_DURATION = 0.28;
export const TOPICS_APPROACH_DURATION = 1.05;

// The route close-up uses an orthographic half-height of 17.5 at zoom 1.08.
// Keeping these values here lets the dashboard finish at the same apparent
// scale before its canvas hands off to that close-up.
const FOCUSED_HALF_HEIGHT = 17.5;
const FOCUSED_ZOOM = 1.08;

export type CameraCommand = {
  id: number;
  kind: "island" | "overview";
  site?: string;
  instant?: boolean;
  duration?: number;
  onComplete: () => void;
};

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
  const closeCamera = new THREE.PerspectiveCamera();
  closeCamera.position.copy(point).addScalar(1);
  closeCamera.lookAt(point);
  return { position, zoom, quaternion: closeCamera.quaternion.clone() };
}
export function cameraEase(t: number) { const p=THREE.MathUtils.clamp(t,0,1); return p*p*(3-2*p); }
