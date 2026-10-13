// Run with: node scripts/test-responsive-camera.cjs
// Load the existing TypeScript geometry without adding a test dependency.
/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS hook loads TypeScript geometry in Node. */
const fs = require("node:fs");
const assert = require("node:assert/strict");
const ts = require("typescript");
const THREE = require("three");
require.extensions[".ts"] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
}).outputText, filename);
const { responsiveCamera } = require("../lib/worldMap/responsiveCamera.ts");
const { playableProjectionBounds } = require("../lib/worldMap/worldBounds.ts");
const { worldFrame, CAMERA_ORTHO_SIZE, LANDMARK_BOUNDS, LANDMARK_LABEL_LIFT, LANDMARK_SCALE, projectWorldPoint } = require("../lib/worldMap/framing.ts");
const { sitePosition } = require("../lib/worldMap/landscape.ts");
const bounds = playableProjectionBounds();
for (const [width, fullHeight] of [[360,800], [375,812], [390,844], [430,932], [495,466], [844,390], [900,500], [768,1024], [1366,768], [1920,1080], [3440,1440]]) {
  const height = fullHeight;
  const headerInset = width <= 540 ? 70 : 88;
  const usableHeight = height - headerInset;
  const result = responsiveCamera(width, height, bounds, false, headerInset);
  const frame = worldFrame(width, height, bounds);
  const extent = bounds.getSize(new THREE.Vector2()).multiplyScalar(frame.scale);
  assert.ok(Number.isFinite(result.zoom) && result.zoom > 0);
  assert.ok(result.limits.x >= 0 && result.limits.y >= 0);
  if (result.mobile) {
    assert.ok(Math.abs(extent.y / (usableHeight * result.unitsPerPixel) - 0.9) < 1e-8, "every mobile orientation uses fullscreen vertical coverage");
    // Every landmark's label can be brought fully on screen with a legal pan.
    const translation = new THREE.Vector3(...frame.position).sub(new THREE.Vector3(0, 1, -8));
    const cameraOffset = result.position.clone().sub(new THREE.Vector3(130, 130, 130));
    const centerY = bounds.getCenter(new THREE.Vector2()).y * frame.scale + translation.dot(result.up) - cameraOffset.dot(result.up);
    assert.ok(Math.abs(centerY / result.unitsPerPixel + headerInset / 2) < 1e-8, "initial scene center lies below the header");
    for (const site of ["keep", "topics", "records", "champions", "calculator"]) {
      const p = new THREE.Vector3(...sitePosition(site));
      p.y += (LANDMARK_BOUNDS[site][1] + LANDMARK_LABEL_LIFT) * LANDMARK_SCALE;
      const projected = projectWorldPoint(p).multiplyScalar(frame.scale);
      projected.x += translation.dot(result.right) - cameraOffset.dot(result.right);
      projected.y += translation.dot(result.up) - cameraOffset.dot(result.up);
      const x = THREE.MathUtils.clamp(projected.x, -result.limits.x, result.limits.x);
      const y = THREE.MathUtils.clamp(projected.y + headerInset * result.unitsPerPixel / 2, -result.limits.y, result.limits.y);
      assert.ok(Math.abs(projected.x - x) / result.unitsPerPixel + 84 < width / 2, `${site} horizontal label access`);
      assert.ok((projected.y - y) / result.unitsPerPixel + 48 < height / 2 - headerInset, `${site} vertical label access below navigation`);
      assert.ok((projected.y - y) / result.unitsPerPixel - 48 > -height / 2, `${site} vertical label access above bottom edge`);
    }
  }
  if (!result.mobile) {
    const original = worldFrame(width, fullHeight, bounds);
    const magnification = frame.scale * height * result.zoom / (original.scale * fullHeight);
    assert.ok(Math.abs(magnification - 1.1) < 1e-8, "desktop pixel magnification is 10%");
    assert.ok(result.limits.x / result.unitsPerPixel <= 12 + 1e-8);
    const translation = new THREE.Vector3(...frame.position).sub(new THREE.Vector3(0, 1, -8));
    const cameraOffset = result.position.clone().sub(new THREE.Vector3(130, 130, 130));
    for (const site of ["keep", "topics", "records", "champions", "calculator"]) {
      const p = new THREE.Vector3(...sitePosition(site));
      p.y += (LANDMARK_BOUNDS[site][1] + LANDMARK_LABEL_LIFT) * LANDMARK_SCALE;
      const point = projectWorldPoint(p).multiplyScalar(frame.scale);
      point.x += translation.dot(result.right) - cameraOffset.dot(result.right);
      point.y += translation.dot(result.up) - cameraOffset.dot(result.up);
      assert.ok(Math.abs(point.x) / result.unitsPerPixel + 84 + 12 <= width / 2 + 1e-8, `${site} desktop horizontal access`);
      assert.ok(point.y / result.unitsPerPixel + 48 + 12 <= height / 2 + 1e-8, `${site} desktop access below top edge`);
      assert.ok(point.y / result.unitsPerPixel - 48 - 12 >= -height / 2 - 1e-8, `${site} desktop access above bottom edge`);
    }
    const sceneCenterY = bounds.getCenter(new THREE.Vector2()).y * frame.scale + translation.dot(result.up) - cameraOffset.dot(result.up);
    const topGap = height / 2 - (sceneCenterY + extent.y / 2) / result.unitsPerPixel;
    const bottomGap = height / 2 + (sceneCenterY - extent.y / 2) / result.unitsPerPixel;
    assert.ok(Math.abs(topGap - bottomGap) < 24, "desktop top and bottom gaps remain balanced within parallax clearance");
  }
  console.log(`${width}x${fullHeight}: ${result.mobile ? "mobile" : "desktop"}, zoom=${result.zoom.toFixed(3)}, coverage=${(extent.y / (2 * CAMERA_ORTHO_SIZE / result.zoom)).toFixed(3)}`);
}
// Frame-rate independent damping converges identically at 30, 60 and 144 Hz.
for (const hz of [30, 60, 144]) {
  let position = 0;
  for (let frame = 0; frame < hz; frame++) position += (1 - position) * (1 - Math.exp(-9 / hz));
  assert.ok(Math.abs(position - (1 - Math.exp(-9))) < 1e-10);
}
assert.equal(responsiveCamera(1366, 680, bounds, true).mobile, true, "coarse pointer uses touch controls");
console.log("Camera geometry and damping checks passed.");
