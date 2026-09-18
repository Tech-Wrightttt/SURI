"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

export type CameraTravel = { position: [number, number, number]; onArrive: () => void };
export const CAMERA_PAN_LIMIT = 8;
export const CAMERA_POSITION = [130, 130, 130] as const;
export const CAMERA_TARGET = [0, 1, -8] as const;
export const CAMERA_ORTHO_SIZE = 92;
let savedPan = 0;

/** Only horizontal translation is possible; no orbit controller is mounted. */
export function MapCamera({ travel }: { travel: CameraTravel | null }) {
  const getThree = useThree(state => state.get);
  const size = useThree(state => state.size);
  const pan = useRef(savedPan);
  const target = useRef(savedPan);
  const travelTime = useRef(0);
  const completed = useRef(false);
  const orientation = useRef(new THREE.Quaternion());
  const busy = useRef(false);
  useLayoutEffect(() => {
    const { camera } = getThree();
    camera.position.set(...CAMERA_POSITION);camera.lookAt(...CAMERA_TARGET);
    orientation.current.copy(camera.quaternion);
    if(camera instanceof THREE.OrthographicCamera) {
      const aspect=size.width/size.height;
      camera.left=-CAMERA_ORTHO_SIZE*aspect;camera.right=CAMERA_ORTHO_SIZE*aspect;
      camera.top=CAMERA_ORTHO_SIZE;camera.bottom=-CAMERA_ORTHO_SIZE;
    }
    camera.near=0.5;camera.far=650;camera.updateProjectionMatrix();
  },[getThree,size]);
  useEffect(()=>{
    const canvas=getThree().gl.domElement;
    let down: {id:number;x:number;pan:number}|null=null;
    const start=(e:PointerEvent)=>{if(!busy.current&&e.isPrimary&&(e.button===0||e.button===2))down={id:e.pointerId,x:e.clientX,pan:target.current};};
    const move=(e:PointerEvent)=>{if(!down||down.id!==e.pointerId||busy.current)return;target.current=THREE.MathUtils.clamp(down.pan-(e.clientX-down.x)*0.025,-CAMERA_PAN_LIMIT,CAMERA_PAN_LIMIT);};
    const end=()=>{down=null;};
    const oldTouchAction=canvas.style.touchAction;canvas.style.touchAction="none";
    canvas.addEventListener("pointerdown",start);window.addEventListener("pointermove",move);window.addEventListener("pointerup",end);window.addEventListener("pointercancel",end);window.addEventListener("blur",end);
    return()=>{canvas.style.touchAction=oldTouchAction;canvas.removeEventListener("pointerdown",start);window.removeEventListener("pointermove",move);window.removeEventListener("pointerup",end);window.removeEventListener("pointercancel",end);window.removeEventListener("blur",end);};
  },[getThree]);
  useLayoutEffect(()=>{
    busy.current=Boolean(travel);completed.current=false;travelTime.current=0;
    if(travel) {savedPan=pan.current;target.current=THREE.MathUtils.clamp(travel.position[0]*0.15,-CAMERA_PAN_LIMIT,CAMERA_PAN_LIMIT);}
  },[travel]);
  useFrame((_,delta)=>{
    const {camera}=getThree();
    pan.current=THREE.MathUtils.damp(pan.current,target.current,7,delta);
    camera.position.set(CAMERA_POSITION[0]+pan.current,CAMERA_POSITION[1],CAMERA_POSITION[2]);camera.quaternion.copy(orientation.current);
    if(!travel)savedPan=pan.current;
    if(travel&&!completed.current){travelTime.current+=delta;if(travelTime.current>=0.65){completed.current=true;travel.onArrive();}}
  });
  return null;
}
