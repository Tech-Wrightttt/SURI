import * as THREE from "three";

/** Measure peak clearance and the visible book's resting center without moving it. */
export function getSpellbookLayout(body: THREE.Object3D, camera: THREE.Camera, height: number, index: number, reducedMotion: boolean) {
  body.updateWorldMatrix(true, true);
  camera.updateMatrixWorld();
  const inverseBody = body.matrixWorld.clone().invert();
  const peakPosition = body.position.clone();
  const peakScale = new THREE.Vector3();
  const peakRotation = body.rotation.clone();
  const quaternion = new THREE.Quaternion();
  const peakBody = new THREE.Matrix4();
  const relativeMesh = new THREE.Matrix4();
  const peakWorld = new THREE.Matrix4();
  const point = new THREE.Vector3();
  let highest = -Infinity;
  let centerHighest = -Infinity;
  let centerLowest = Infinity;
  const poses = reducedMotion ? [{ roll: 0, peak: true }, { roll: 0, peak: false }] : [{ roll: -.014, peak: true }, { roll: .014, peak: true }, { roll: 0, peak: false }];
  for (const { roll, peak } of poses) {
    peakPosition.y = .18 + (peak && !reducedMotion ? .10 + index * .008 + .04 : 0);
    peakScale.setScalar(1.06 * (peak && !reducedMotion ? 1.012 : 1));
    peakRotation.z = roll;
    quaternion.setFromEuler(peakRotation);
    peakBody.compose(peakPosition, quaternion, peakScale);
    if (body.parent) peakBody.premultiply(body.parent.matrixWorld);
    body.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      const geometry = object.geometry;
      if (!geometry.boundingBox) geometry.computeBoundingBox();
      const bounds = geometry.boundingBox;
      if (!bounds || bounds.isEmpty()) return;
      relativeMesh.multiplyMatrices(inverseBody, object.matrixWorld);
      peakWorld.multiplyMatrices(peakBody, relativeMesh);
      for (const x of [bounds.min.x, bounds.max.x]) for (const y of [bounds.min.y, bounds.max.y]) for (const z of [bounds.min.z, bounds.max.z]) {
        point.set(x, y, z).applyMatrix4(peakWorld).project(camera);
        if (peak) highest = Math.max(highest, point.y);
        else {
          centerHighest = Math.max(centerHighest, point.y);
          centerLowest = Math.min(centerLowest, point.y);
        }
      }
    });
  }
  return Number.isFinite(highest) && Number.isFinite(centerHighest) && Number.isFinite(centerLowest)
    ? { top: (1 - highest) * height / 2, center: (1 - (centerHighest + centerLowest) / 2) * height / 2 }
    : null;
}
