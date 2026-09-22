import type { ArchitectureBuilder } from "./architecture";
import { SITES, OUTER_HEIGHTS, terrainHeight, shoreDistance, roadHeight } from "./landscape";

export type OuterKind = "topics" | "records" | "champions" | "calculator";
export function outerFacing(kind: OuterKind) { const [x,z]=SITES[kind]; return Math.atan2(-x,-z); }

// The same pale masonry, slate roofs and brass accents as the central keep.
// Everything remains static, low-poly and instanced by shape/material.
export function drawOuterLandmark(b:ArchitectureBuilder,kind:OuterKind) {
  const stone="#c7c6b2", trim="#e0d5b6", gold="#d9b768";
  const block=(x:number,y:number,z:number,w:number,h:number,d:number,color=stone)=>b.part("box","stone",color,x,y,z,w,h,d);
  const column=(x:number,z:number,h:number)=>{
    block(x,0.2,z,0.85,0.4,0.85);b.part("cylinder","stone",stone,x,h/2,z,0.42,h,0.42);block(x,h,z,0.85,0.25,0.85,trim);
  };
  // True open voussoir arch; unlike a filled arch plane it leaves a visible passage.
  const arch=(x:number,z:number,w:number,h:number)=>{
    for(const side of [-1,1])block(x+side*w/2,h*0.35,z,0.48,h*0.7,0.6);
    for(let i=0;i<9;i++){const a=i*Math.PI/8;b.part("box","stone",trim,x+Math.cos(a)*w/2,h*0.7+Math.sin(a)*w/2,z,0.5,0.55,0.65,0,0,a);}
  };
  const book=(x:number,y:number,z:number,s=1)=>{
    b.part("box","gold",gold,x,y,z,1.55*s,0.12*s,0.9*s);
    for(const side of [-1,1])b.part("box","plaster","#f1e3be",x+side*0.36*s,y+0.13*s,z,0.72*s,0.18*s,0.82*s,0,0,side*0.17);
    b.part("box","magic","#9edbd9",x,y+0.21*s,z,0.06*s,0.06*s,0.8*s);
  };
  const statue=(x:number,z:number)=>{
    block(x,0.4,z,0.95,0.8,0.95);b.part("cone","stone",trim,x,1.3,z,0.8,1.3,0.65);b.part("sphere","stone",trim,x,2.15,z,0.45,0.5,0.45);
    b.part("box","gold",gold,x+0.4,1.5,z,0.06,1.8,0.06);
  };
  b.at(0,0,0,1,outerFacing(kind),()=>{
    b.part("cylinder","stone","#9da99d",0,0.12,0,11.6,0.24,11.6);
    if(kind==="topics") {
      // A cathedral archive: broad wings, buttresses, luminous clerestory and spires.
      block(0,2.8,-0.8,6.5,5.6,4.4);
      b.part("roof","roof","#65618e",0,6.5,-0.8,7.1,2.1,5);
      for(const side of [-1,1]) {
        block(side*4,1.8,-0.8,2.6,3.6,4.1);
        b.part("roof","roof","#7672a0",side*4,4.2,-0.8,3.1,1.3,4.6);
        b.tower(side*4.5,1.4,7.6,0.86,"#686798");
        b.flag(side*4.5,10.5,1.4,"#a38dcc");
        for(const z of [-2.5,-0.7,1]){block(side*3.25,2,z,0.5,4,0.65,trim);b.at(side*5.33,0,z,1,side*Math.PI/2,()=>b.window(0,2.2,0,0.85,2.1));}
        statue(side*2.7,4.6);book(side*2.7,1.6,4.8,0.65);
      }
      b.tower(0,-2.3,9.8,1,"#666693");
      for(const x of [-2.2,0,2.2])b.window(x,4.15,1.43,1.2,2.7);
      arch(0,2.3,2.8,2.7);b.at(0,0.25,1.48,1,0,()=>b.door(0,0,1.45));
      for(let i=0;i<5;i++)block(0,0.12+i*0.1,3.9-i*0.32,3.2,0.24+i*0.2,0.38);
      book(0,7.5,1.9,1.25);
      b.part("ring","magic","#b6a1e4",0,7.7,1.85,1.3,1,1.3,Math.PI/2);
    } else if(kind==="records") {
      // Six separated outdoor stelae; no hall or roof can hide the recorded lessons.
      for(const side of [-1,1])for(let i=0;i<3;i++) {
        const x=side*(3.3+(i===1?0.55:0)),z=3.3-i*3.1,h=3.5+i*0.65;
        block(x,0.23,z,1.8,0.46,1.6);block(x,h/2+0.4,z,1.05,h,0.85,"#919e99");block(x,h+0.45,z,1.45,0.25,1.2,trim);
        b.part("crystal","magic","#8bd3c5",x,h+0.85,z,0.4,0.65,0.4);
        for(let j=0;j<4;j++){
          b.part("box","magic","#b5dcc8",x,1.1+j*0.65,z+0.44,0.36,0.06,0.025,0,0,j%2?0.55:-0.55);
          block(x+0.27,1.3+j*0.52,z+0.44,0.025,0.3,0.025,"#576e68");
        }
        b.part("box","gold",gold,x,0.53,z+0.7,0.75,0.06,0.4,-0.25);
      }
      block(0,0.4,-2,2.2,0.8,2.2);block(0,3.4,-2,1.2,5.2,1.2);
      b.part("crystal","magic","#b3dfce",0,6.5,-2,1.1,1.7,1.1);
      b.part("ring","gold",gold,0,5.3,-2,1.5,1,1.5,Math.PI/2);
      for(const side of [-1,1]){statue(side*1.8,-4.5);column(side*5,-1,2);}
      // An inlaid aisle ends at the central record, with side crosswalks to each pair.
      block(0,0.26,1,1.5,0.08,6.4,"#e0d5b6");
      for(const z of [-2.9,0.2,3.3])block(0,0.27,z,7,0.06,0.65,"#b6b9a7");
    } else if(kind==="champions") {
      // Open victory court with ascending seating and a monumental trophy dais.
      for(let tier=0;tier<3;tier++)for(const side of [-1,1])block(side*(3.3+tier*0.75),0.35+tier*0.32,-0.8,0.8,0.7+tier*0.64,6.4);
      arch(0,3.4,3.6,3.4);
      for(const side of [-1,1]){b.tower(side*3.8,-3,6.8,0.8,"#79718b");b.flag(side*3.8,9.6,-3,"#cda355");statue(side*3,2);}
      for(let i=0;i<3;i++)block(0,0.2+i*0.3,-1.2,3.8-i*0.65,0.4,3.4-i*0.5);
      b.part("cylinder","gold",gold,0,1.65,-1.2,0.38,1.1,0.38);
      b.part("cone","gold","#f2ce78",0,2.5,-1.2,1.8,1.2,1.8,Math.PI);
      for(const side of [-1,1])b.part("ring","gold",gold,side*0.85,2.65,-1.2,0.55,1,0.55,Math.PI/2);
      b.part("crystal","magic","#ffe4a0",0,3.6,-1.2,0.55,1,0.55);
      for(const x of [-1.5,0,1.5])block(x,0.27,2,0.6,0.06,0.9,gold);
    } else {
      // Mathematical observatory: an exposed armillary above a vaulted rotunda.
      for(let i=0;i<8;i++){const a=i*Math.PI/4;column(Math.sin(a)*2.4,Math.cos(a)*2.4,4.8);}
      b.part("cylinder","stone",trim,0,4.9,0,5.8,0.4,5.8);
      b.part("cone","roof","#57798b",0,5.6,0,5.7,1.1,5.7);
      for(const [rx,rz] of [[0,0],[Math.PI/2,0],[Math.PI/3,Math.PI/3]])b.part("ring","gold",gold,0,7.6,0,2.2,2.2,2.2,rx,0,rz);
      b.part("sphere","magic","#8ddcde",0,7.6,0,1.7,1.7,1.7);
      b.part("cylinder","gold",gold,0,6.3,0,0.2,3.6,0.2);
      for(const side of [-1,1]){b.tower(side*4,-2.7,5.7,0.7,"#57798b");b.flag(side*4,8.5,-2.7,"#68b8c0");}
      b.part("ring","gold",gold,0,0.3,0,4.8,1,4.8);
      for(let i=0;i<12;i++){const a=i*Math.PI/6;b.part("box","gold",gold,Math.sin(a)*4.8,0.33,Math.cos(a)*4.8,0.15,0.07,i%3?0.4:0.8,0,a);}
      book(0,1,3.4,0.9);block(0,0.5,3.4,1.4,1,1);
    }
  });
}

/** District landscape uses world units; entrances share the bridge-to-site axis. */
export function drawOuterGround(b:ArchitectureBuilder) {
  for(const kind of ["topics","records","champions","calculator"] as const) {
    const [sx,sz]=SITES[kind],angle=outerFacing(kind),c=Math.cos(angle),s=Math.sin(angle);
    const point=(x:number,z:number)=>[sx+x*c+z*s,sz-x*s+z*c] as const;
    const height=(x:number,z:number)=>{const p=point(x,z);return terrainHeight(...p);};
    const tint=kind==="records"?"#a7b4a4":"#c5bda3";
    const accent=kind==="topics"?"#b39bd7":kind==="records"?"#9ac8b0":kind==="champions"?"#dfbd71":"#82ccd1";
    b.at(sx,0,sz,1,angle,()=>{
      // Segmented masonry exposes the raised crown without turning the shore into a disk.
      for(const radius of [5.25,6.5])for(let i=0;i<32;i++) {
        const a=i*Math.PI/16,x=Math.sin(a)*radius,z=Math.cos(a)*radius;
        if(z>0&&Math.abs(x)<1.65)continue;
        const [wx,wz]=point(x,z);if(shoreDistance(wx,wz)<1.4)continue;
        const ground=height(x,z),top=radius<6?OUTER_HEIGHTS[kind]+0.05:ground+0.22;
        const wallHeight=Math.max(0.3,top-ground+0.6);
        b.part("box","stone",i%3?tint:"#a4aa99",x,top-wallHeight/2,z,0.98,wallHeight,0.42,0,a);
        b.part("box","stone","#ddd2b3",x,top+0.09,z,1.02,0.18,0.55,0,a);
      }
      // Wide, grounded stair treads follow the existing route up to the forecourt.
      for(let i=0;i<10;i++) {
        const z=4.2+i*0.33,[wx,wz]=point(0,z);
        if(shoreDistance(wx,wz)<1.7)continue;
        const y=Math.max(roadHeight(wx,wz),height(-1.25,z),height(1.25,z))+0.14;
        b.part("box","stone",i%2?"#c9c1a8":"#d6ccb1",0,y-0.16,z,2.6,0.32,0.35);
        for(const side of [-1,1])b.part("box","stone",tint,side*1.48,y+0.05,z,0.22,0.42,0.35);
      }
      // Paired book gardens / memorial cypresses / victory banners / crystal beds.
      for(const side of [-1,1])for(const z of [-1.8,1.5]) {
        const x=side*5.85,[wx,wz]=point(x,z);if(shoreDistance(wx,wz)<2)continue;
        const y=height(x,z);
        b.part("box","stone",tint,x,y+0.12,z,0.95,0.24,1.6);
        b.part("box","leaves","#527c60",x,y+0.28,z,0.76,0.22,1.4);
        if(kind==="records") {
          b.part("cylinder","wood","#655a48",x,y+0.6,z,0.1,1.2,0.1);
          b.part("cone","leaves","#436d60",x,y+1.3,z,0.7,2.2,0.7);
        } else if(kind==="calculator")b.part("crystal","magic",accent,x,y+0.95,z,0.48,1.5,0.48);
        else if(kind==="champions")b.flag(x,y+1.4,z,accent);
        else {
          b.part("sphere","leaves","#718e70",x,y+0.7,z,0.8,0.85,0.8);
          for(const dz of [-0.45,0.45])b.part("sphere","cloth",accent,x,y+0.48,z+dz,0.27,0.25,0.27);
        }
      }
      // Lamps frame the ascent and stop at the bridge landing, never in the sea.
      for(const z of [4.7,7.7])for(const side of [-1,1]){
        const x=side*1.9,[wx,wz]=point(x,z);if(shoreDistance(wx,wz)<1.8)continue;
        const y=height(x,z);
        b.part("box","stone",tint,x,y+0.2,z,0.55,0.4,0.55);
        b.part("cylinder","gold","#756951",x,y+0.85,z,0.12,1.4,0.12);b.lantern(x,y+1.7,z);
      }
    });
  }
}
