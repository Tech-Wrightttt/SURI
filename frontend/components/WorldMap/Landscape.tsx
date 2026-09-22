"use client";

import { useMemo } from "react";
import * as THREE from "three";
import { Architecture, type ArchitectureClip } from "./Architecture";
import { makeSettlements, makeVegetation } from "@/lib/worldMap/settlements";
import { ISLANDS, LANDMARK_SITE_KEYS, ROADS, SITES, WORLD_BOUNDS, bridgeDistance, islandScore, roadHeight, shoreDistance, terrainHeight } from "@/lib/worldMap/landscape";
import { dockApproachPath, findDockPlacement } from "@/lib/worldMap/placement";
const noRaycast: THREE.Mesh["raycast"] = () => {};

export type IslandFocus = keyof typeof ISLANDS;
export type LandscapeFocus = { island: IslandFocus; bounds: ArchitectureClip };

function makeTerrain(bounds:ArchitectureClip,coastDistance:(x:number,z:number)=>number) {
  const width=bounds.maxX-bounds.minX,depth=bounds.maxZ-bounds.minZ;
  const xSegments=Math.max(8,Math.round(width/122*188)),zSegments=Math.max(8,Math.round(depth/98*152));
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
function ribbon(points:THREE.Vector3[],width:number | ((x:number,z:number)=>number),height:(x:number,z:number)=>number,clipToShore=false) {
  const vertices:number[]=[],indices:number[]=[];
  points.forEach((p,i)=>{
    const a=points[Math.max(0,i-1)],b=points[Math.min(points.length-1,i+1)],t=b.clone().sub(a).normalize();
    const halfWidth=typeof width === "function" ? width(p.x,p.z) : width;
    for(const side of [-1,1]){const x=p.x+t.z*side*halfWidth,z=p.z-t.x*side*halfWidth;vertices.push(x,height(x,z),z);}
    if(i<points.length-1&&(!clipToShore||(shoreDistance(p.x,p.z)>0&&shoreDistance(b.x,b.z)>0))){const n=i*2;indices.push(n,n+2,n+1,n+1,n+2,n+3);}
  });
  const g=new THREE.BufferGeometry();g.setAttribute("position",new THREE.Float32BufferAttribute(vertices,3));g.setIndex(indices);g.computeVertexNormals();return g;
}
export function Landscape({focus}:{focus?:LandscapeFocus}) {
  // The locked isometric view does not benefit from a dense terrain grid. This
  // retains the faceted fantasy silhouette while cutting terrain vertices by ~40%.
  const bounds=focus?.bounds ?? WORLD_BOUNDS;
  const coastDistance=useMemo(()=>focus ? (x:number,z:number)=>islandScore(x,z,ISLANDS[focus.island]) : shoreDistance,[focus]);
  const terrain=useMemo(()=>makeTerrain(bounds,coastDistance),[bounds,coastDistance]);
  const roads=useMemo(()=>{
    const harbor=findDockPlacement(new THREE.Vector2(0,1),4,2.2,1200,2,[SITES.keep[0],SITES.keep[1]]);
    const harborRoad=harbor ? dockApproachPath(harbor,SITES.keep) : [];
    return [...ROADS,harborRoad].filter(road=>road.length>1&&(!focus||road.some(point=>point.x>=bounds.minX&&point.x<=bounds.maxX&&point.z>=bounds.minZ&&point.z<=bounds.maxZ))).map((road,index)=>ribbon(road,(x,z)=>index<4 ? THREE.MathUtils.lerp(0.45,1.1,THREE.MathUtils.smoothstep(bridgeDistance(x,z),1.2,4)) : 0.45,(x,z)=>index<ROADS.length?roadHeight(x,z)+0.08:terrainHeight(x,z)+0.08));
  },[bounds,focus]);
  const buildings=useMemo(()=>makeSettlements(),[]);
  const trees=useMemo(()=>makeVegetation(),[]);
  return <group>
    <mesh geometry={terrain} receiveShadow raycast={noRaycast}><meshStandardMaterial vertexColors roughness={1}/></mesh>
    {roads.map((geometry,i)=><mesh key={i} geometry={geometry} receiveShadow raycast={noRaycast}><meshStandardMaterial color="#baae8e" roughness={1} side={THREE.DoubleSide}/></mesh>)}
    {LANDMARK_SITE_KEYS.filter(key=>key==="keep").map(key=>{const [x,z]=SITES[key];return <mesh key={`${x},${z}`} position={[x,terrainHeight(x,z)+0.04,z]} rotation={[-Math.PI/2,0,0]} receiveShadow raycast={noRaycast}><circleGeometry args={[3.25,40]}/><meshStandardMaterial color="#b1aa90" roughness={1}/></mesh>})}
    {/* Only hero landmarks cast shadows. The large static instance fields stay lit
        but avoid paying for thousands of shadow-map draws every frame. */}
    <Architecture builder={buildings} shadows={false} clip={focus?.bounds}/><Architecture builder={trees} shadows={false} clip={focus?.bounds}/>
  </group>;
}
