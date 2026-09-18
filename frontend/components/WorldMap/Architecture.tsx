"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { ArchitectureBuilder, type Batch, type LandmarkKind, type Shape, type Surface } from "@/lib/worldMap/architecture";

const noRaycast: THREE.Mesh["raycast"] = () => {};
const geometries = new Map<Shape, THREE.BufferGeometry>();
const materials = new Map<Surface, THREE.MeshStandardMaterial>();
function geometryFor(shape: Shape) {
  if(geometries.has(shape))return geometries.get(shape)!;
  let geometry: THREE.BufferGeometry;
  if(shape === "box")geometry=new THREE.BoxGeometry(1,1,1);
  else if(shape === "cylinder")geometry=new THREE.CylinderGeometry(0.5,0.5,1,12);
  else if(shape === "cone")geometry=new THREE.ConeGeometry(0.5,1,12);
  else if(shape === "sphere")geometry=new THREE.IcosahedronGeometry(0.5,1);
  else if(shape === "crystal")geometry=new THREE.OctahedronGeometry(0.5,0);
  else if(shape === "ring"){geometry=new THREE.TorusGeometry(1,0.045,6,32);geometry.rotateX(Math.PI/2);}
  else if(shape === "arch") {
    const outline=new THREE.Shape();outline.moveTo(-0.5,0);outline.lineTo(0.5,0);outline.lineTo(0.5,0.55);outline.absarc(0,0.55,0.5,0,Math.PI,false);outline.lineTo(-0.5,0);
    geometry=new THREE.ShapeGeometry(outline,10);
  } else if(shape === "roof") {
    const outline=new THREE.Shape();outline.moveTo(-0.5,-0.5);outline.lineTo(0.5,-0.5);outline.lineTo(0,0.5);outline.closePath();
    geometry=new THREE.ExtrudeGeometry(outline,{depth:1,bevelEnabled:false});geometry.translate(0,0,-0.5);
  } else if(shape === "sail") {
    geometry=new THREE.PlaneGeometry(1,1,5,5);
    const p=geometry.attributes.position;
    for(let i=0;i<p.count;i++)p.setZ(i,Math.cos(p.getX(i)*Math.PI)*Math.sin((p.getY(i)+0.5)*Math.PI)*0.18);
    geometry.computeVertexNormals();
  } else {
    const outline=new THREE.Shape();outline.moveTo(0,-0.5);outline.quadraticCurveTo(0.65,-0.15,0.4,0.4);outline.quadraticCurveTo(0,0.65,-0.4,0.4);outline.quadraticCurveTo(-0.65,-0.15,0,-0.5);
    geometry=new THREE.ExtrudeGeometry(outline,{depth:0.35,bevelEnabled:true,bevelSize:0.12,bevelThickness:0.15,bevelSegments:1,steps:1,curveSegments:6});geometry.rotateX(Math.PI/2);geometry.translate(0,0.2,0);
  }
  geometries.set(shape,geometry);return geometry;
}
function surfaceTexture(type: "stone"|"roof"|"wood") {
  const size=64,data=new Uint8Array(size*size*4);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const row=Math.floor(y/16),offset=row%2*16;
    const mortar=type==="wood" ? x%16<2 : y%16<2 || (x+offset)%32<2;
    const grain=type==="wood" ? Math.sin(x*0.9+Math.sin(y*0.3))*8 : Math.sin(x*19+y*7)*5;
    const value=Math.round((mortar?153:235)+grain);
    const i=(y*size+x)*4;data[i]=value;data[i+1]=value;data[i+2]=value;data[i+3]=255;
  }
  const texture=new THREE.DataTexture(data,size,size);texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.magFilter=THREE.LinearFilter;texture.needsUpdate=true;texture.colorSpace=THREE.SRGBColorSpace;return texture;
}
function materialFor(surface: Surface) {
  if(materials.has(surface))return materials.get(surface)!;
  const material=new THREE.MeshStandardMaterial({color:"white",roughness:surface==="gold"?0.42:0.88,metalness:surface==="gold"?0.5:0,side:surface==="cloth"||surface==="window"?THREE.DoubleSide:THREE.FrontSide});
  if(surface==="stone"||surface==="roof"||surface==="wood")material.map=surfaceTexture(surface);
  if(surface==="window"||surface==="magic") {material.emissive.set(surface==="magic"?"#7cbee0":"#d89844");material.emissiveIntensity=surface==="magic"?0.65:0.4;}
  materials.set(surface,material);return material;
}
function ArchitectureBatch({ batch, shadows }: {batch:Batch;shadows:boolean}) {
  const ref=useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(()=>{
    if(!ref.current)return;
    batch.pieces.forEach((p,i)=>{ref.current!.setMatrixAt(i,p.matrix);ref.current!.setColorAt(i,p.color);});
    ref.current.instanceMatrix.needsUpdate=true;
    if(ref.current.instanceColor)ref.current.instanceColor.needsUpdate=true;
    ref.current.computeBoundingSphere();
  },[batch]);
  return <instancedMesh ref={ref} args={[geometryFor(batch.shape),materialFor(batch.surface),batch.pieces.length]} castShadow={shadows} receiveShadow raycast={noRaycast} dispose={null} />;
}
export function Architecture({builder,shadows=true}:{builder:ArchitectureBuilder;shadows?:boolean}) {
  return <group>{Array.from(builder.batches.entries()).map(([key,batch])=><ArchitectureBatch key={key} batch={batch} shadows={shadows}/>)}</group>;
}
export function LandmarkArchitecture({kind}:{kind:LandmarkKind}) {
  const builder=useMemo(()=>{const b=new ArchitectureBuilder();b.landmark(kind);return b;},[kind]);
  return <Architecture builder={builder}/>;
}
