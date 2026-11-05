import * as THREE from "three";
import { installWorldShaderDiagnostics } from "./shaderDiagnostics";

let assetCacheEnabled = false;

/**
 * Applies the renderer settings shared by every retained R3F canvas.
 *
 * Three.Cache is process-wide, so URL-loaded resources remain reusable when a
 * route is revisited. Renderer configuration stays local because each canvas
 * owns a separate WebGLRenderer while it is mounted.
 */
export function configureWorldRenderer(renderer: THREE.WebGLRenderer) {
  installWorldShaderDiagnostics();
  if (!assetCacheEnabled) {
    THREE.Cache.enabled = true;
    assetCacheEnabled = true;
  }

  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
}
