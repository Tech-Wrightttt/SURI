import * as THREE from "three";
import { CAMERA_POSITION, CAMERA_TARGET } from "./framing";

export const ISLAND_ROUTES = {
  "/progress": "champions", "/topics": "academy", "/error-history": "records", "/calculator": "calculator",
} as const;
export type IslandRoute = keyof typeof ISLAND_ROUTES;
export const ZOOM_DURATION = 0.22;
export const RETURN_DURATION = 0.28;
export type CameraCommand = { id: number; kind: "island" | "overview"; site?: string; onComplete: () => void };
export function islandCameraPose(point: THREE.Vector3) {
  const camera = new THREE.PerspectiveCamera();
  camera.position.set(...CAMERA_POSITION); camera.lookAt(...CAMERA_TARGET);
  const right = new THREE.Vector3(1,0,0).applyQuaternion(camera.quaternion);
  const up = new THREE.Vector3(0,1,0).applyQuaternion(camera.quaternion);
  const offset = point.clone().sub(new THREE.Vector3(...CAMERA_TARGET));
  // A gentle emphasis, not a full recenter that crops the rest of the islands.
  const position = new THREE.Vector3(...CAMERA_POSITION)
    .addScaledVector(right, offset.dot(right)*0.18)
    .addScaledVector(up, offset.dot(up)*0.18);
  return { position, zoom: 1.12 };
}
export function cameraEase(t: number) { const p=THREE.MathUtils.clamp(t,0,1); return p*p*(3-2*p); }
