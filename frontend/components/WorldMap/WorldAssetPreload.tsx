"use client";

import { useEffect } from "react";
import { useLoader, useThree } from "@react-three/fiber";
import { QUALITY, type QualityTier } from "@/lib/worldMap/renderQuality";
import { AmbientLoader } from "./AmbientAssets";
import { BakedSceneLoader } from "./BakedScene";
import { EnvironmentTextureLoader } from "./EnvironmentTextureLoader";

/** Stay outside Suspense so terrain, citizens and textures can load together. */
export function WorldAssetPreload({ tier }: { tier: QualityTier }) {
  const compressed = useThree(state => state.gl.extensions.has("WEBGL_compressed_texture_s3tc") && state.gl.extensions.has("WEBGL_compressed_texture_s3tc_srgb"));
  useEffect(() => {
    useLoader.preload(BakedSceneLoader, `/world-map/scene/${QUALITY[tier].asset}.json`);
    useLoader.preload(AmbientLoader, "/world-map/ambient/ambient.json");
    useLoader.preload(EnvironmentTextureLoader, compressed ? "environment-s3tc" : "environment-portable");
  }, [tier, compressed]);
  return null;
}
