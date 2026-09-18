"use client";

import { useMemo } from "react";
import { Sparkles } from "@react-three/drei";
import * as THREE from "three";
import { Architecture } from "./Architecture";
import { makeSettlements, makeVegetation } from "@/lib/worldMap/settlements";
import { LAKES, RIVER_PATHS, ROADS, SITES, riverDistance, riverLevel, roadHeight, shoreDistance, terrainHeight } from "@/lib/worldMap/landscape";
const noRaycast: THREE.Mesh["raycast"] = () => {};

function makeTerrain(width:number,depth:number,xSegments:number,zSegments:number,centerZ:number) {
  const geometry=new THREE.PlaneGeometry(width,depth,xSegments,zSegments);geometry.rotateX(-Math.PI/2);geometry.translate(0,0,centerZ);
  const p=geometry.attributes.position,colors:number[]=[],color=new THREE.Color();
  for(let i=0;i<p.count;i++){
    const x=p.getX(i),z=p.getZ(i),coast=shoreDistance(x,z),y=terrainHeight(x,z,coast);p.setY(i,y);
    color.set(coast<1.9?"#d9cba7":y>4.2?"#8f9c8d":"#71935d");
    if(coast>1.9&&y<4.2)color.lerp(new THREE.Color("#4d815b"),(Math.sin(x*0.16+z*0.13)+1)*0.16);
    if(riverDistance(x,z)<3&&coast>1)color.lerp(new THREE.Color("#718d70"),0.38);
    color.multiplyScalar(0.96+Math.sin(x*2.1+z*3.6)*0.028);colors.push(color.r,color.g,color.b);
  }
  geometry.setAttribute("color",new THREE.Float32BufferAttribute(colors,3));geometry.computeVertexNormals();return geometry;
}
function ribbon(points:THREE.Vector3[],width:number | ((x:number,z:number)=>number),height:(x:number,z:number)=>number) {
  const vertices:number[]=[],indices:number[]=[];
  points.forEach((p,i)=>{
    const a=points[Math.max(0,i-1)],b=points[Math.min(points.length-1,i+1)],t=b.clone().sub(a).normalize();
    const halfWidth=typeof width === "function" ? width(p.x,p.z) : width;
    for(const side of [-1,1]){const x=p.x+t.z*side*halfWidth,z=p.z-t.x*side*halfWidth;vertices.push(x,height(x,z),z);}
    if(i<points.length-1){const n=i*2;indices.push(n,n+2,n+1,n+1,n+2,n+3);}
  });
  const g=new THREE.BufferGeometry();g.setAttribute("position",new THREE.Float32BufferAttribute(vertices,3));g.setIndex(indices);g.computeVertexNormals();return g;
}
export function Landscape() {
  const terrain=useMemo(()=>makeTerrain(260,230,260,230,-4),[]);
  const roads=useMemo(()=>ROADS.map(r=>ribbon(r,0.6,(x,z)=>roadHeight(x,z)+0.08)),[]);
  const rivers=useMemo(()=>RIVER_PATHS.map(path=>ribbon(new THREE.CatmullRomCurve3(path.map(([x,z])=>new THREE.Vector3(x,0,z))).getPoints(120),1.35,(_,z)=>riverLevel(z))),[]);
  const buildings=useMemo(()=>makeSettlements(),[]);
  const trees=useMemo(()=>makeVegetation(),[]);
  return <group>
    <mesh geometry={terrain} receiveShadow raycast={noRaycast}><meshStandardMaterial vertexColors roughness={1}/></mesh>
    {roads.map((geometry,i)=><mesh key={i} geometry={geometry} receiveShadow raycast={noRaycast}><meshStandardMaterial color="#baae8e" roughness={1} side={THREE.DoubleSide}/></mesh>)}
    {rivers.map((geometry,i)=><mesh key={i} geometry={geometry} raycast={noRaycast}><meshStandardMaterial color="#6baab3" emissive="#3d7379" emissiveIntensity={0.12} metalness={0.22} roughness={0.3} side={THREE.DoubleSide}/></mesh>)}
    {LAKES.map((lake,i)=><mesh key={`lake-${i}`} position={[lake.x,0.35,lake.z]} rotation={[-Math.PI/2,0,0]} scale={[lake.rx,lake.rz,1]} raycast={noRaycast}><circleGeometry args={[1,32]}/><meshStandardMaterial color="#6baab3" emissive="#3d7379" emissiveIntensity={0.1} metalness={0.18} roughness={0.32} side={THREE.DoubleSide}/></mesh>)}
    {Object.values(SITES).map(([x,z])=><mesh key={`${x},${z}`} position={[x,terrainHeight(x,z)+0.04,z]} rotation={[-Math.PI/2,0,0]} receiveShadow raycast={noRaycast}><circleGeometry args={[4.8,40]}/><meshStandardMaterial color="#b1aa90" roughness={1}/></mesh>)}
    <Architecture builder={buildings}/><Architecture builder={trees}/>
    <Sparkles position={[-8,8,-28]} count={30} scale={[11,6,10]} size={2.4} speed={0.14} color="#b2eee0" opacity={0.55}/>
  </group>;
}
