"use client";

import { useMemo } from "react";
import * as THREE from "three";
import { Architecture, type ArchitectureClip } from "./Architecture";
import { makeSettlements, makeVegetation } from "@/lib/worldMap/settlements";
import { ISLANDS, LANDMARK_SITE_KEYS, ROADS, SITES, WORLD_BOUNDS, bridgeDistance, islandScore, roadHeight, shoreDistance, terrainHeight } from "@/lib/worldMap/landscape";
import { dockApproachPath, getHarborPlacement } from "@/lib/worldMap/placement";
import { terrainSurface, walkingRibbon } from "@/lib/worldMap/walkingPaths";
import { HARBOR_PATH_ORIGIN } from "@/lib/worldMap/landscape";
const noRaycast: THREE.Mesh["raycast"] = () => {};

export type IslandFocus = keyof typeof ISLANDS;
export type LandscapeFocus = { island: IslandFocus; bounds: ArchitectureClip };

function makeTerrain(bounds:ArchitectureClip,coastDistance:(x:number,z:number)=>number,detailScale:number) {
  const width=bounds.maxX-bounds.minX,depth=bounds.maxZ-bounds.minZ;
  const xSegments=Math.max(8,Math.round(width/122*188*detailScale)),zSegments=Math.max(8,Math.round(depth/98*152*detailScale));
  const geometry=new THREE.PlaneGeometry(width,depth,xSegments,zSegments);geometry.rotateX(-Math.PI/2);geometry.translate((bounds.minX+bounds.maxX)/2,0,(bounds.minZ+bounds.maxZ)/2);
  const p=geometry.attributes.position,colors:number[]=[],color=new THREE.Color();
  for(let i=0;i<p.count;i++){
    const x=p.getX(i),z=p.getZ(i),coast=coastDistance(x,z),y=terrainHeight(x,z,coast);p.setY(i,y);
    // Keep every land elevation in the same grass family; height no longer
    // changes terrain color while the terrace treatment is being tuned.
    color.set(coast<1.9?"#d9cba7":"#71935d");
    if(coast>1.9)color.lerp(new THREE.Color("#4d815b"),(Math.sin(x*0.16+z*0.13)+1)*0.16);
    color.multiplyScalar(0.96+Math.sin(x*2.1+z*3.6)*0.028);colors.push(color.r,color.g,color.b);
  }
  geometry.setAttribute("color",new THREE.Float32BufferAttribute(colors,3));geometry.computeVertexNormals();return geometry;
}
export function Landscape({focus,lowDetail=false}:{focus?:LandscapeFocus;lowDetail?:boolean}) {
  // The locked isometric view does not benefit from a dense terrain grid. This
  // retains the faceted fantasy silhouette while cutting terrain vertices by ~40%.
  const bounds=focus?.bounds ?? WORLD_BOUNDS;
  // Grade the harbor before sampling the terrain it rests on.
  const harbor=useMemo(()=>getHarborPlacement(),[]);
  const coastDistance=useMemo(()=>focus ? (x:number,z:number)=>islandScore(x,z,ISLANDS[focus.island]) : shoreDistance,[focus]);
  const terrain=useMemo(()=>makeTerrain(bounds,coastDistance,lowDetail?0.58:1),[bounds,coastDistance,lowDetail]);
  const roads=useMemo(()=>{
    const harborRoad=harbor ? dockApproachPath(harbor,HARBOR_PATH_ORIGIN) : [];
    return [...ROADS,harborRoad].map((road,index)=>({road,index})).filter(({road,index})=>index!==4&&road.length>1&&(!focus||road.some(point=>point.x>=bounds.minX&&point.x<=bounds.maxX&&point.z>=bounds.minZ&&point.z<=bounds.maxZ))).map(({road,index})=>walkingRibbon(road,
      (x,z)=>index<4 ? THREE.MathUtils.lerp(0.5,0.8,THREE.MathUtils.smoothstep(bridgeDistance(x,z),1.2,4)) : index===4 ? 0.6 : 0.5,
      (x,z)=>Math.hypot(x,z-6)<3.6?terrainSurface(terrain,x,z)+0.015:roadHeight(x,z,terrainSurface(terrain,x,z))+0.04));
  },[bounds,focus,terrain,harbor]);
  const buildings=useMemo(()=>makeSettlements(),[]);
  const trees=useMemo(()=>makeVegetation(),[]);
  return <group>
    <mesh geometry={terrain} receiveShadow raycast={noRaycast}><meshStandardMaterial vertexColors roughness={1}/></mesh>
    {roads.map((geometry,i)=><mesh key={i} geometry={geometry} receiveShadow raycast={noRaycast}><meshStandardMaterial vertexColors roughness={1} side={THREE.DoubleSide}/></mesh>)}
    {LANDMARK_SITE_KEYS.filter(key=>key==="keep").map(key=>{const [x,z]=SITES[key];return <mesh key={`${x},${z}`} position={[x,terrainHeight(x,z)+0.04,z]} rotation={[-Math.PI/2,0,0]} receiveShadow raycast={noRaycast}><circleGeometry args={[3.25,40]}/><meshStandardMaterial color="#b1aa90" roughness={1}/></mesh>})}
    {/* Only hero landmarks cast shadows. The large static instance fields stay lit
        but avoid paying for thousands of shadow-map draws every frame. */}
    <Architecture builder={buildings} shadows={false} clip={focus?.bounds}/><Architecture builder={trees} shadows={false} clip={focus?.bounds}/>
  </group>;
}
