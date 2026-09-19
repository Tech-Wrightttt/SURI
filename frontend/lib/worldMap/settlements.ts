import { ArchitectureBuilder } from "./architecture";
import { BRIDGES, FARMS, ISLANDS, WORLD_BOUNDS, coastZ, farmDistance, insideWorld, riverDistance, roadDistance, seededRandom, shoreDistance, siteDistance, terrainHeight } from "./landscape";

function tree(b:ArchitectureBuilder,x:number,z:number,size:number,oak:boolean) {
  const y=terrainHeight(x,z);
  b.part("cylinder","wood","#665b46",x,y+size*0.85,z,0.16*size,1.7*size,0.16*size);
  if(oak)b.part("sphere","leaves","#72996d",x,y+2*size,z,2*size,2.5*size,2*size);
  else for(let j=0;j<3;j++)b.part("cone","leaves",j%2?"#56875e":"#467756",x,y+(1.2+j*0.65)*size,z,(1.9-j*0.4)*size,1.8*size,(1.9-j*0.4)*size);
}
export function makeSettlements() {
  const b=new ArchitectureBuilder(),random=seededRandom(381);
  // Generate the villages from the islands, instead of retaining remote coordinates.
  for(const [name,island] of Object.entries(ISLANDS)) {
    if(island.rx<8) {
      if(name==="tidewatch"||name==="pebbleKey")b.at(island.x,terrainHeight(island.x,island.z),island.z,0.45,0.25,()=>b.tower(0,0,3.5,0.8,"#777586",true));
      continue;
    }
    let placed=0;
    const homes:Array<[number,number]>=[];
    for(let attempt=0;attempt<180&&placed<(name==="hub"?20:5);attempt++) {
      const x=island.x+(random()-0.5)*island.rx*1.7,z=island.z+(random()-0.5)*island.rz*1.7;
      if(shoreDistance(x,z)<2.8||siteDistance(x,z)<5.3||roadDistance(x,z)<1.5||riverDistance(x,z)<2.8||farmDistance(x,z)<4||homes.some(([a,c])=>Math.hypot(x-a,z-c)<2.6))continue;
      homes.push([x,z]);placed++;
      b.at(x,terrainHeight(x,z),z,0.45+random()*0.13,(random()-0.5)*0.5,()=>{
        b.house(3,2.5,2.3,random()>0.5?"#846d77":"#94735c",true);b.barrel(2,1);b.crate(-1.9,1);
      });
    }
  }
  for(const [cx,cz] of FARMS) {
    for(let row=0;row<6;row++)for(let col=0;col<7;col++){
      const x=cx+(col-3)*0.6,z=cz+(row-2.5)*0.6;
      if(shoreDistance(x,z)<1.8)continue;
      const y=terrainHeight(x,z);
      b.part("box","wood","#9b895b",x,y+0.04,z,0.56,0.07,0.56);
      b.part("box","leaves",col<3?"#c7b76c":"#7f9956",x,y+0.2,z,0.35,0.3,0.35);
    }
    b.at(cx+3,terrainHeight(cx+3,cz),cz,0.5,0,()=>{
      b.house(2.6,2.2,2.1,"#89684e");
      b.part("cylinder","plaster","#d0c0a3",0,2.2,0,1.3,4,1.3);
      b.part("cone","roof","#776c75",0,4.4,0,1.9,1,1.9);
      for(let i=0;i<4;i++){
        const a=Math.PI/4+i*Math.PI/2;
        b.beam([0,3.5,1],[Math.sin(a)*2,3.5+Math.cos(a)*2,1],0.08);
        b.part("box","cloth","#eddbb7",Math.sin(a)*1.3,3.5+Math.cos(a)*1.3,1.02,0.4,1.3,0.04,0,0,-a);
      }
    });
  }
  for(const [a,c,kind] of BRIDGES) {
    const length=Math.hypot(c[0]-a[0],c[1]-a[1]),angle=Math.atan2(c[0]-a[0],c[1]-a[1]);
    b.at((a[0]+c[0])/2,0.85,(a[1]+c[1])/2,1,angle,()=>{
      const color=kind==="stone"?"#b5b19c":"#ad8c60";
      b.part("box",kind,color,0,-0.08,0,1.3,0.16,length);
      for(const side of [-1,1]){
        b.part("box",kind,color,side*0.68,0.6,0,0.09,0.1,length);
        for(let z=-length/2;z<=length/2;z+=1.4)b.part("box",kind,color,side*0.68,0.2,z,0.12,0.9,0.12);
      }
      for(let z=-length/2;z<=length/2;z+=0.4)b.part("box",kind,color,0,0.02,z,1.3,0.06,0.08);
    });
  }
  // A small harbor tucked into the hub's southern inlet.
  const portX=-17,portZ=coastZ(portX);
  for(let i=0;i<10;i++)b.part("box","wood",i%2?"#987952":"#b08b5f",portX,0.6,portZ+i*0.4,1.8,0.15,0.35);
  for(const dx of [-0.75,0.75])for(const dz of [0,2,3.6])b.part("cylinder","wood","#68513b",portX+dx,0,portZ+dz,0.12,1.8,0.12);
  b.at(portX+2,0.15,portZ+3,0.55,0.2,()=>{
    b.part("hull","wood","#75543d",0,0,0,1.8,1,4);
    b.part("cylinder","wood","#785a3d",0,2,0,0.1,4,0.1);
    b.part("sail","cloth","#efdfb8",0.65,2.5,0,1.5,2,1);
  });
  return b;
}
export function makeVegetation(distant=false) {
  const b=new ArchitectureBuilder(),random=seededRandom(distant?871:7319),spacing=distant?5:2.8;
  for(let z=WORLD_BOUNDS.minZ+2;z<WORLD_BOUNDS.maxZ-2;z+=spacing)for(let x=WORLD_BOUNDS.minX+2;x<WORLD_BOUNDS.maxX-2;x+=spacing){
    const px=x+random()*1.5,pz=z+random()*1.5;
    if(!insideWorld(px,pz)||shoreDistance(px,pz)<1.7||siteDistance(px,pz)<5.4||roadDistance(px,pz)<1.5||riverDistance(px,pz)<2.4||farmDistance(px,pz)<4.3)continue;
    tree(b,px,pz,0.45+random()*0.45,random()>0.6);
  }
  for(let i=0;i<180;i++){
    const x=WORLD_BOUNDS.minX+random()*(WORLD_BOUNDS.maxX-WORLD_BOUNDS.minX),z=WORLD_BOUNDS.minZ+random()*(WORLD_BOUNDS.maxZ-WORLD_BOUNDS.minZ);
    const shore=shoreDistance(x,z);
    if(shore<0.3||shore>1.4||!insideWorld(x,z))continue;
    b.part("sphere","stone","#a0a497",x,terrainHeight(x,z)+0.1,z,0.5+random()*0.4,0.4,0.6);
  }
  return b;
}
