"use client";
import { useLayoutEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { CAMERA_ORTHO_SIZE, CAMERA_POSITION, CAMERA_TARGET, worldFrame } from "@/lib/worldMap/framing";
import { playableProjectionBounds } from "@/lib/worldMap/worldBounds";
import { SITES, sitePosition } from "@/lib/worldMap/landscape";
import { cameraEase, islandCameraPose, RETURN_DURATION, ZOOM_DURATION, type CameraCommand } from "@/lib/worldMap/navigation";
export { CAMERA_POSITION } from "@/lib/worldMap/framing";

export function MapCamera({ command }: { command: CameraCommand | null }) {
  const getThree=useThree(state=>state.get),size=useThree(state=>state.size);
  const initialized=useRef(false);
  const animation=useRef<{elapsed:number;duration:number;from:THREE.Vector3;to:THREE.Vector3;fromZoom:number;toZoom:number;done:()=>void}|null>(null);
  useLayoutEffect(()=>{
    const {camera}=getThree();
    if(!initialized.current){
      camera.position.set(...CAMERA_POSITION);camera.lookAt(...CAMERA_TARGET);camera.zoom=1;
      initialized.current=true;
    }
    if(camera instanceof THREE.OrthographicCamera){
      camera.left=-CAMERA_ORTHO_SIZE*size.width/size.height;camera.right=-camera.left;
      camera.top=CAMERA_ORTHO_SIZE;camera.bottom=-CAMERA_ORTHO_SIZE;
    }
    camera.near=0.5;camera.far=650;camera.updateProjectionMatrix();
  },[getThree,size]);
  useLayoutEffect(()=>{
    if(!command)return;
    const {camera}=getThree();
    let to=new THREE.Vector3(...CAMERA_POSITION),toZoom=1;
    if(command.kind==="island"&&command.site&&command.site in SITES){
      const frame=worldFrame(size.width,size.height,playableProjectionBounds());
      const point=new THREE.Vector3(...sitePosition(command.site as keyof typeof SITES))
        .applyAxisAngle(new THREE.Vector3(0,1,0),frame.rotation).multiplyScalar(frame.scale).add(new THREE.Vector3(...frame.position));
      const pose=islandCameraPose(point);to=pose.position;toZoom=pose.zoom;
    }
    const reduced=window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    animation.current={elapsed:0,duration:reduced?0:command.kind==="overview"?RETURN_DURATION:ZOOM_DURATION,
      from:camera.position.clone(),to,fromZoom:camera.zoom,toZoom,done:command.onComplete};
  },[command,getThree,size]);
  useFrame((_,delta)=>{
    const motion=animation.current;if(!motion)return;
    motion.elapsed+=Math.min(delta,0.05);
    const t=motion.duration?Math.min(1,motion.elapsed/motion.duration):1;
    const {camera}=getThree();
    camera.position.lerpVectors(motion.from,motion.to,cameraEase(t));
    camera.zoom=THREE.MathUtils.lerp(motion.fromZoom,motion.toZoom,cameraEase(t));
    camera.updateProjectionMatrix();
    // No lookAt during motion: the original isometric quaternion stays locked.
    if(t===1){animation.current=null;motion.done();}
  });
  return null;
}
