import { ArchitectureBuilder } from "./architecture";
import { FARMS, ROADS, coastZ, farmDistance, riverDistance, riverWidth, roadDistance, roadHeight, seededRandom, shoreDistance, siteDistance, terrainHeight } from "./landscape";

export const VILLAGES = [[-17,5],[29,7],[-36,14]] as const;
export function villageDistance(x:number,z:number) {return Math.min(...VILLAGES.map(([a,b])=>Math.hypot((x-a)/1.2,z-b)));}

function ship(b:ArchitectureBuilder,x:number,z:number,scale:number,rotation:number) {
  b.at(x,0.2,z,scale,rotation,()=>{
    b.part("hull","wood","#614d3b",0,0,0,2,1.3,4.8);
    b.part("box","wood","#bc9f6f",0,0.12,0,1.3,0.12,3.4);
    b.part("cylinder","wood","#72573c",0,2.7,0,0.12,5.3,0.12);
    b.beam([-1.4,4.4,0],[1.4,4.4,0],0.09);
    b.part("sail","cloth","#f0dfb7",0,3.15,0.08,2.8,2.45,1);
    b.part("sail","cloth","#7e668d",0,3.15,0.12,0.6,2.4,1);
    b.flag(0,5.4,0,"#a46a78");
    b.beam([0,5,0],[0,0.6,-2.2],0.025,"#d8c09b");b.beam([0,5,0],[0,0.6,2.1],0.025,"#d8c09b");
    for(const side of [-1,1])for(let i=0;i<7;i++)b.part("box","wood","#9c8058",side*0.67,0.47,(i-3)*0.48,0.06,0.7,0.06);
    b.part("box","wood","#93764e",0,0.52,1.25,1.25,0.55,0.8);
  });
}
function port(b:ArchitectureBuilder,x:number) {
  const shore=coastZ(x);
  for(const dx of [-2.2,2.2]) {
    for(let i=0;i<21;i++)b.part("box","wood",i%2?"#967b55":"#aa8c62",x+dx,0.72,shore-1+i*0.48,2.1,0.18,0.43);
    for(let i=0;i<5;i++)for(const side of [-1,1]){
      b.part("cylinder","wood","#574a3a",x+dx+side*0.85,-0.15,shore+i*2,0.18,2.8,0.18);
      b.part("sphere","wood","#b19a76",x+dx+side*0.85,1.25,shore+i*2,0.25,0.18,0.25);
    }
  }
  b.part("box","wood","#a88a5f",x,0.72,shore+6.5,6.8,0.18,1.2);
  for(let i=0;i<4;i++)b.at(x-2.3,0.85,shore+1+i*1.2,0.85,0,()=>i%2?b.crate(0,0):b.barrel(0,0));
  for(const dx of [-4,3.5])b.at(x+dx,terrainHeight(x+dx,shore-4),shore-4,0.8,0,()=>b.house(dx<0?4:2.6,2.7,2.3,"#7d7772",true));
  b.at(x+6,terrainHeight(x+6,shore-5),shore-5,0.8,0,()=>b.tower(0,0,4.5,0.75,"#6a7385"));
  ship(b,x+0.3,shore+4.5,0.9,0);ship(b,x+7,shore+8,0.55,-0.5);
  b.at(x-4.3,0.8,shore+2,0.7,0.7,()=>{b.part("hull","wood","#946849",0,0,0,1.2,0.6,2.5);b.beam([-1,0.25,-0.5],[1,0.25,0.6],0.07);});
}
function well(b: ArchitectureBuilder, x: number, z: number) {
  const y=terrainHeight(x,z);
  b.at(x,y,z,1,0,()=>{
    b.part("cylinder","stone","#a9a899",0,0.45,0,2.2,0.9,2.2);b.part("cylinder","stone","#d5c8aa",0,0.92,0,1.75,0.16,1.75);
    for(const side of [-1,1])b.part("box","wood","#705440",side*1.25,2,0,0.14,2.4,0.14);
    b.part("roof","roof","#75617e",0,3.1,0,3.1,1.1,2.5);b.beam([-1.1,2.2,0],[1.1,2.2,0],0.1);
  });
}
function satelliteVillage(b: ArchitectureBuilder, x: number, z: number, roof: string, rotation=0) {
  const homes:[[number,number,number,number],[number,number,number,number],[number,number,number,number]]=[[-6,4,0.72,0.2],[6,3,0.62,-0.2],[-2,-6,0.58,0.1]];
  for(const [dx,dz,scale,turn] of homes)b.at(x+dx,terrainHeight(x+dx,z+dz),z+dz,scale,rotation+turn,()=>{
    b.house(3.1+scale,2.5,2.6,roof,true);b.barrel(2.5,1.6);if(dx<0)b.crate(-2.4,1.4);
  });
  b.stall(x+6,z-4,roof);well(b,x-5,z-5);
  for(let i=0;i<8;i++){
    const a=i*Math.PI/4+rotation,px=x+Math.sin(a)*10,pz=z+Math.cos(a)*8,py=terrainHeight(px,pz);
    b.part("sphere","leaves",i%2?"#d98a7b":"#e4c46e",px,py+0.2,pz,0.42,0.35,0.42);
    b.part("sphere","leaves","#597c58",px+0.4,py+0.55,pz,0.75,0.7,0.7);
  }
}
function scenicIslet(b: ArchitectureBuilder, x: number, z: number, kind: "ruin" | "dock" | "grove") {
  const y=terrainHeight(x,z);
  if(kind === "ruin") {
    b.at(x,y,z,0.72,0.2,()=>{b.tower(0,0,3.8,0.85,"#676273",true);b.part("ring","magic","#85d7cf",0,1.45,0.4,0.9,0.9,0.9,Math.PI/2);});
  } else if(kind === "dock") {
    for(let i=0;i<7;i++)b.part("box","wood",i%2?"#9c7d55":"#b18d60",x+2,y+0.7,z+3+i*0.6,3.2,0.18,0.5);
    for(const dx of [0.7,3.3])b.part("cylinder","wood","#614a38",x+dx,y-0.1,z+4.3,0.18,2.5,0.18);
    ship(b,x+2.1,z+8,0.42,-0.45);
  } else {
    b.at(x,y,z,0.72,0,()=>b.house(2.5,2.1,2.2,"#6f7f58"));
  }
  for(let i=0;i<5;i++){
    const a=i*Math.PI*2/5+0.35,px=x+Math.sin(a)*4.3,pz=z+Math.cos(a)*3.4,py=terrainHeight(px,pz);
    b.part("cylinder","wood","#665b46",px,py+1.05,pz,0.16,2.1,0.16);
    for(let tier=0;tier<3;tier++)b.part("cone","leaves",i%2?"#4f805c":"#6b9868",px,py+(1.25+tier*0.65),pz,1.5-tier*0.28,1.65,1.5-tier*0.28);
  }
  for(let i=0;i<6;i++){const a=i*Math.PI/3,px=x+Math.sin(a)*5.2,pz=z+Math.cos(a)*4.1,py=terrainHeight(px,pz);b.part("sphere","stone","#9aa199",px,py+0.2,pz,0.8,0.5,0.7);}
}
export function makeSettlements() {
  const b=new ArchitectureBuilder(),random=seededRandom(381);
  for(const [cx,cz] of VILLAGES)for(let row=0;row<3;row++)for(let col=0;col<4;col++){
    const x=cx+(col-1.5)*2.9,z=cz+(row-1)*3.1;
    if(Math.abs(x+36)<7&&z>coastZ(-36)-7)continue;
    if(siteDistance(x,z)<5.7||riverDistance(x,z)<riverWidth(z)+1.25||roadDistance(x,z)<1.25)continue;
    b.at(x,terrainHeight(x,z),z,0.65+random()*0.12,(random()-0.5)*0.3,()=>{
      b.house(2.4+random()*0.6,2.3,1.9+random()*0.9,random()>0.45?"#846d77":"#91715b",true);
      b.barrel(1.8,0.8);if(random()>0.5)b.crate(-1.7,1.2);
    });
  }
  for(const [cx,cz] of FARMS){
    for(let i=0;i<9;i++){
      const x=cx-4+i;
      b.part("box","plaster",i%2?"#92844f":"#a29a5b",x,terrainHeight(x,cz)+0.015,cz,0.95,0.06,6);
      for(let j=0;j<9;j++){
        const z=cz-2.7+j*0.65;
        b.part("box","leaves",i<4?"#c5b669":"#749252",x,terrainHeight(x,z)+0.18,z,0.56,0.35,0.4);
      }
    }
    for(let i=0;i<10;i++)for(const side of [-1,1]){
      const x=cx-4.5+i,z=cz+side*3.5,y=terrainHeight(x,z);
      b.part("box","wood","#aa9470",x,y+0.4,z,0.07,0.8,0.08);
      if(i<9)for(const h of [0.3,0.65])b.part("box","wood","#aa9470",x+0.5,y+h,z,1,0.06,0.07);
    }
    b.at(cx+6,terrainHeight(cx+6,cz),cz,0.8,0,()=>{
      b.house(3.2,3,2.2,"#916455");
      b.part("cylinder","plaster","#cabd99",0,3,0,1.4,5,1.4);b.part("cone","roof","#776c75",0,5.8,0,2,1.5,2);
      for(let i=0;i<4;i++){
        const a=Math.PI/4+i*Math.PI/2;
        b.beam([0,4.3,1],[Math.sin(a)*2.5,4.3+Math.cos(a)*2.5,1],0.1);
        b.part("box","cloth","#e9d9ae",Math.sin(a)*1.65,4.3+Math.cos(a)*1.65,1.04,0.48,1.7,0.04,0,0,-a);
      }
      b.part("sphere","gold","#6c5d46",0,4.3,1.12,0.3,0.3,0.2);
    });
    for(let i=0;i<3;i++)b.part("cylinder","plaster","#c6af6c",cx-5.5,terrainHeight(cx-5.5,cz+i)+0.35,cz+i,0.8,0.75,0.8);
    // Orchard and a small fenced sheep pasture beside the fields.
    for(let i=0;i<4;i++){
      const x=cx-4+i*1.7,z=cz-5.5,y=terrainHeight(x,z);
      b.part("cylinder","wood","#766347",x,y+0.7,z,0.12,1.4,0.12);b.part("sphere","leaves","#729458",x,y+1.5,z,1.6,1.8,1.6);
      b.part("sphere","leaves","#b67c52",x+0.45,y+1.4,z+0.55,0.2,0.2,0.2);
      const sx=cx-2+i*0.9,sz=cz+5.2,sy=terrainHeight(sx,sz);
      b.part("sphere","plaster","#e0d7bd",sx,sy+0.3,sz,0.6,0.4,0.35);b.part("sphere","wood","#61554a",sx+0.28,sy+0.35,sz,0.2,0.22,0.2);
    }
  }
  port(b,-36);port(b,39);
  // The outer districts make the single island feel like a full kingdom,
  // rather than a cluster of isolated destination pedestals.
  satelliteVillage(b,-91,-10,"#b06b75",0.15);
  satelliteVillage(b,0,-83,"#586f8b",0);
  satelliteVillage(b,89,-7,"#7c6790",-0.2);
  satelliteVillage(b,54,67,"#4f8291",0.35);
  scenicIslet(b,-76,47,"grove");
  scenicIslet(b,82,43,"ruin");
  scenicIslet(b,-82,-61,"grove");
  scenicIslet(b,78,-63,"ruin");
  // Road decks follow the same crossing heights as the terrain road ribbons.
  for(const road of ROADS){
    let last=-100;
    road.forEach((p,i)=>{
      if(riverDistance(p.x,p.z)>riverWidth(p.z) + 0.2||i-last<12)return;
      last=i;const a=road[Math.max(0,i-3)],c=road[Math.min(road.length-1,i+3)];
      const angle=Math.atan2(c.x-a.x,c.z-a.z),y=roadHeight(p.x,p.z);
      b.at(p.x,y,p.z,1,angle,()=>{
        b.part("box","stone","#b8b4a0",0,0,0,1.8,0.3,6.5);
        for(const side of [-1,1]){
          b.part("box","stone","#c6c2ae",side*0.86,0.43,0,0.16,0.7,6.5);
          for(const z of [-3,-1.5,0,1.5,3])b.part("box","stone","#d1c9b3",side*0.87,0.8,z,0.28,0.26,0.28);
          for(const z of [-2.8,2.8])b.part("box","stone","#8f998e",side*0.7,-0.7,z,0.45,1.5,0.5);
        }
      });
    });
  }
  b.at(-8,terrainHeight(-8,-28),-28,1,0,()=>{
    b.part("cylinder","wood","#5d6552",0,3.2,0,1.5,6.4,1.5);
    for(let i=0;i<7;i++){
      const a=i*2.4,x=Math.sin(a)*2.3,z=Math.cos(a)*2;
      b.beam([0,2.5,0],[x,5.4,z],0.5,"#65735a");b.part("sphere","leaves",i%2?"#5a9990":"#779b9a",x,6.3+(i%3)*0.5,z,4.3,3.4,4.3);
    }
    for(let i=0;i<8;i++){const a=i*Math.PI/4;b.part("crystal","magic","#85d7cf",Math.sin(a)*4,0.9,Math.cos(a)*4,0.55,1.7,0.55);}
  });
  b.at(-24,terrainHeight(-24,-24),-24,1,0,()=>{
    for(let i=0;i<7;i++){const a=i*Math.PI*2/7;b.part("box","stone","#9aafa3",Math.sin(a)*2,1,Math.cos(a)*2,0.6,2,0.5,0,-a);b.part("crystal","magic","#99d8bd",Math.sin(a)*2,1.4,Math.cos(a)*2+0.28,0.12,0.7,0.1);}
    b.part("cylinder","stone","#aab6a5",0,0.25,0,1.6,0.5,1.6);b.part("sphere","magic","#97ddd5",0,0.75,0,0.55,0.55,0.55);
  });
  b.at(35,terrainHeight(35,-32),-32,1,0,()=>{
    b.part("arch","wood","#243c3c",0,0,0,3,3.5,1);
    for(let i=0;i<5;i++)b.part("sphere","stone","#8f9d94",(i-2)*0.9,2.8-Math.abs(i-2)*0.5,-0.3,1.2,1.4,1.4);
    b.part("crystal","magic","#a4a1ea",-1.6,0.7,0.4,0.8,1.8,0.8);
  });
  return b;
}
export function makeVegetation(distant=false) {
  const b=new ArchitectureBuilder(),random=seededRandom(distant?871:7319);
  // A jittered grid creates breathing room between individual trees without
  // sacrificing the varied forest edge that frames the landmarks.
  const spacing=distant ? 8.5 : 5.2;
  const minX=-104, maxX=104;
  const minZ=-104, maxZ=84;
  for(let row=0;row<Math.ceil((maxZ-minZ)/spacing);row++) for(let column=0;column<Math.ceil((maxX-minX)/spacing);column++){
    const x=minX+(column+0.22+random()*0.56)*spacing;
    const z=minZ+(row+0.22+random()*0.56)*spacing;
    const y=terrainHeight(x,z),coast=shoreDistance(x,z);
    if(coast<2.5||y>7||riverDistance(x,z)<riverWidth(z)+1.25||siteDistance(x,z)<7||farmDistance(x,z)<7||villageDistance(x,z)<6.3||roadDistance(x,z)<2||Math.hypot(x+8,z+28)<5)continue;
    const s=(distant?0.9:0.55)+random()*0.7,oak=random()>0.65;
    b.part("cylinder","wood","#665b46",x,y+s*0.85,z,0.16*s,1.7*s,0.16*s);
    const palette=oak?["#709969","#91a36d","#578974"]:["#386954","#467c5c","#5c885c"];
    const color=palette[Math.floor(random()*palette.length)];
    if(oak) {
      b.part("sphere","leaves",color,x,y+2*s,z,2.1*s,2.4*s,2*s);
      b.part("sphere","leaves",color,x+0.5*s,y+1.9*s,z+0.3*s,1.6*s,1.6*s,1.7*s);
    } else {
      for(let j=0;j<3;j++)b.part("cone","leaves",color,x,y+(1.2+j*0.65)*s,z,(1.9-j*0.4)*s,1.8*s,(1.9-j*0.4)*s);
    }
  }
  for(let i=0;i<130&&!distant;i++){
    const x=random()*90-45,z=coastZ(x)-random()*3,y=terrainHeight(x,z);
    if(riverDistance(x,z)<3)continue;
    b.part("sphere","stone","#9da397",x,y+0.1,z,0.8+random(),0.7+random(),0.7+random());
  }
  return b;
}
