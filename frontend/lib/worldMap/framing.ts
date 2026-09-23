import * as THREE from "three";

// The world is authored against this fixed view, never by widening the camera.
export const CAMERA_ORTHO_SIZE = 40;
export const CAMERA_POSITION = [130, 130, 130] as const;
export const CAMERA_TARGET = [0, 1, -8] as const;
export const WORLD_ROTATION = Math.PI / 4;
export const LANDMARK_SCALE = 0.68;
export const LANDMARK_LABEL_LIFT = 1.75;
export const LANDMARK_BOUNDS = {
  keep: [11,12.5,10], academy: [8,9,7], records: [13,8,13], champions: [13,11,13],
  calculator: [13,11,13], guild: [10,7,8], topics: [13,13,13], ranger: [7,8,7], arena: [9,6,9],
} satisfies Record<string,[number,number,number]>;
export const WORLD_BOUNDS = { minX: -61, maxX: 61, minZ: -49, maxZ: 49, minY: -2, maxY: 16 };

const projectionBasis = (() => {
  const camera = new THREE.PerspectiveCamera();
  camera.position.set(...CAMERA_POSITION);
  camera.lookAt(...CAMERA_TARGET);
  const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
  const up = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);
  const rotation=new THREE.Matrix4().makeRotationY(WORLD_ROTATION);
  return {right,up,rotation};
})();
export function projectWorldPoint(point: THREE.Vector3) {
  const p=point.clone().applyMatrix4(projectionBasis.rotation);
  return new THREE.Vector2(p.dot(projectionBasis.right),p.dot(projectionBasis.up));
}

export function worldFrame(width: number, height: number, projected: THREE.Box2) {
  const camera = new THREE.PerspectiveCamera();
  camera.position.set(...CAMERA_POSITION);
  camera.lookAt(...CAMERA_TARGET);
  const right = new THREE.Vector3(1,0,0).applyQuaternion(camera.quaternion);
  const up = new THREE.Vector3(0,1,0).applyQuaternion(camera.quaternion);
  // Reserve room for the fixed header, landmark labels, and an ocean border.
  const side = Math.min(64, width * 0.1);
  const top = Math.min(100, height * 0.2);
  const bottom = Math.min(72, height * 0.14);
  const units = 2 * CAMERA_ORTHO_SIZE / Math.max(height, 1);
  const availableWidth = Math.max(1, width - 2 * side) * units;
  const availableHeight = Math.max(1, height - top - bottom) * units;
  const extent = projected.getSize(new THREE.Vector2());
  const scale = Math.min(1.3, availableWidth / extent.x, availableHeight / extent.y);
  const center = projected.getCenter(new THREE.Vector2()).multiplyScalar(scale);
  const position = new THREE.Vector3(...CAMERA_TARGET)
    .addScaledVector(right, -center.x)
    .addScaledVector(up, (bottom - top) * units / 2 - center.y);
  return { scale, position: position.toArray() as [number, number, number], rotation: WORLD_ROTATION };
}

