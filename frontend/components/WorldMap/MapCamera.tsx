"use client";
import { useLayoutEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { CAMERA_ORTHO_SIZE, CAMERA_POSITION, CAMERA_TARGET, worldFrame } from "@/lib/worldMap/framing";
import { playableProjectionBounds } from "@/lib/worldMap/worldBounds";
import { SITES, sitePosition } from "@/lib/worldMap/landscape";
import { cameraEase, islandCameraPose, RETURN_DURATION, TOPICS_APPROACH_DURATION, ZOOM_DURATION, type CameraCommand } from "@/lib/worldMap/navigation";
export { CAMERA_POSITION } from "@/lib/worldMap/framing";

export function MapCamera({ command, active = true, preserveCameraOnActivate = false }: { command: CameraCommand | null; active?: boolean; preserveCameraOnActivate?: boolean }) {
  const getThree=useThree(state=>state.get),size=useThree(state=>state.size),invalidate=useThree(state=>state.invalidate);
  const initialized=useRef(false);
  const wasActive=useRef(false);
  const animation=useRef<{elapsed:number;duration:number;from:THREE.Vector3;to:THREE.Vector3;fromZoom:number;toZoom:number;fromQuaternion:THREE.Quaternion;toQuaternion:THREE.Quaternion;done:()=>void}|null>(null);
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
  useLayoutEffect(() => {
    const { camera } = getThree();
    if (active && !wasActive.current && !preserveCameraOnActivate) {
      // A retained canvas otherwise comes back still zoomed into the island
      // selected just before navigation.
      camera.position.set(...CAMERA_POSITION);
      camera.lookAt(...CAMERA_TARGET);
      camera.zoom = 1;
      camera.updateProjectionMatrix();
      invalidate();
    }
    wasActive.current = active;
  }, [active, getThree, invalidate, preserveCameraOnActivate]);
  useLayoutEffect(()=>{
    if(!command)return;
    const {camera}=getThree();
    let to=new THREE.Vector3(...CAMERA_POSITION),toZoom=1,toQuaternion=camera.quaternion.clone();
    if (command.kind === "overview") {
      const overviewCamera = new THREE.PerspectiveCamera();
      overviewCamera.position.set(...CAMERA_POSITION);
      overviewCamera.lookAt(...CAMERA_TARGET);
      toQuaternion = overviewCamera.quaternion;
    }
    if(command.kind==="island"&&command.site&&command.site in SITES){
      const frame=worldFrame(size.width,size.height,playableProjectionBounds());
      const point=new THREE.Vector3(...sitePosition(command.site as keyof typeof SITES))
        .applyAxisAngle(new THREE.Vector3(0,1,0),frame.rotation).multiplyScalar(frame.scale).add(new THREE.Vector3(...frame.position));
      // A focused route must finish at the exact pose its retained close-up
      // canvas uses. Calculator is an Arcane Tower close-up just like Topics
      // and Progress, so treating it as an ordinary island causes a visible
      // jump when the route canvas takes over.
      const close = command.site === "topics" || command.site === "champions" || command.site === "calculator";
      if (close) point.y += 3.2 * frame.scale;
      const pose=islandCameraPose(point, close ? { close: true, worldScale: frame.scale } : undefined);
      to=pose.position;toZoom=pose.zoom;toQuaternion=pose.quaternion;
    }
    const reduced=window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const focusedIsland = command.site === "topics" || command.site === "champions" || command.site === "calculator";
    animation.current={elapsed:0,duration:reduced||command.instant?0:command.duration ?? (command.kind==="overview"?RETURN_DURATION:focusedIsland ?TOPICS_APPROACH_DURATION:ZOOM_DURATION),
      from:camera.position.clone(),to,fromZoom:camera.zoom,toZoom,fromQuaternion:camera.quaternion.clone(),toQuaternion,done:command.onComplete};
    invalidate();
  },[command,getThree,size,invalidate]);
  useFrame((_,delta)=>{
    const motion=animation.current;if(!motion)return;
    motion.elapsed+=Math.min(delta,0.05);
    const t=motion.duration?Math.min(1,motion.elapsed/motion.duration):1;
    const {camera}=getThree();
    camera.position.lerpVectors(motion.from,motion.to,cameraEase(t));
    camera.zoom=THREE.MathUtils.lerp(motion.fromZoom,motion.toZoom,cameraEase(t));
    camera.quaternion.slerpQuaternions(motion.fromQuaternion,motion.toQuaternion,cameraEase(t));
    camera.updateProjectionMatrix();
    if(t===1){animation.current=null;motion.done();}
    else invalidate();
  });
  return null;
}
