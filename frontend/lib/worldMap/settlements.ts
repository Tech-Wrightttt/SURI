import { ArchitectureBuilder } from "./architecture";
import { BRIDGES, FARMS, ISLANDS, WORLD_BOUNDS, coastZ, farmDistance, insideWorld, roadDistance, seededRandom, shoreDistance, siteDistance, terrainHeight } from "./landscape";

function tree(b:ArchitectureBuilder,x:number,z:number,size:number,oak:boolean) {
  const y=terrainHeight(x,z);
  b.part("cylinder","wood","#665b46",x,y+size*0.85,z,0.16*size,1.7*size,0.16*size);
  if(oak)b.part("sphere","leaves","#72996d",x,y+2*size,z,2*size,2.5*size,2*size);
  else for(let j=0;j<3;j++)b.part("cone","leaves",j%2?"#56875e":"#467756",x,y+(1.2+j*0.65)*size,z,(1.9-j*0.4)*size,1.8*size,(1.9-j*0.4)*size);
}
export function makeSettlements() {
  const b=new ArchitectureBuilder(),random=seededRandom(381);
  // Generate the villages from island data. Every piece is added to a shared
  // instanced batch, so a richer settlement does not add one draw call per home.
  for(const [name,island] of Object.entries(ISLANDS)) {
    if(island.rx<8) {
      const y=terrainHeight(island.x,island.z);
      const feature=Number(island.seed)%5;
      b.at(island.x,y,island.z,0.38+Math.min(island.rx,island.rz)*0.025,island.turn,()=>{
        if(feature===0) {
          b.tower(0,0,3.4,0.7,"#777586",true);
          b.part("crystal","magic","#8ee8df",0,1.1,0.7,0.55,1.5,0.55);
        } else if(feature===1) {
          b.house(2.3,2,2.1,"#6b708f",false);
          b.lantern(-1.6,1.2,1.2);
        } else if(feature===2) {
          b.part("ring","stone","#aaa895",0,0.22,0,1.45,1,1.45);
          for(let i=0;i<4;i++){const a=i*Math.PI/2;b.part("box","stone","#9b9d91",Math.sin(a)*1.1,0.8,Math.cos(a)*1.1,0.3,1.6,0.3);}
          b.part("crystal","magic","#b49bf0",0,1.05,0,0.65,1.8,0.65);
        } else if(feature===3) {
          b.tower(0,0,3.6,0.75,"#617b86",true);
          b.part("sphere","magic","#8fe6dd",0,2.5,0,0.42,0.42,0.42);
        } else {
          b.part("box","stone","#9b9e93",0,0.25,0,2.6,0.5,2.1);
          b.part("crystal","magic","#78cadb",0,1.25,0,0.8,2.2,0.8);
          b.lantern(-1.2,1.15,0.7);
        }
      });
      // A couple of low-poly trees/rocks make the islets feel inhabited without
      // making a distant island an expensive miniature settlement.
      for(let i=0;i<2+(feature%2);i++)tree(b,island.x+(random()-0.5)*island.rx*0.8,island.z+(random()-0.5)*island.rz*0.8,0.38+random()*0.2,feature%2===0);
      continue;
    }
    let placed=0;
    const homes:Array<[number,number]>=[];
    const homeTarget=name==="hub"?34:8;
    for(let attempt=0;attempt<260&&placed<homeTarget;attempt++) {
      const x=island.x+(random()-0.5)*island.rx*1.7,z=island.z+(random()-0.5)*island.rz*1.7;
      if(shoreDistance(x,z)<2.8||siteDistance(x,z)<5.3||roadDistance(x,z)<1.5||farmDistance(x,z)<4||homes.some(([a,c])=>Math.hypot(x-a,z-c)<2.6))continue;
      homes.push([x,z]);placed++;
      b.at(x,terrainHeight(x,z),z,0.45+random()*0.13,(random()-0.5)*0.5,()=>{
        const large=random()>0.72, ornate=random()>0.42;
        b.house(large?3.7:2.5+random()*0.7,large?3:2.1+random()*0.55,large?3:2+random()*0.65,random()>0.5?"#846d77":"#94735c",ornate);
        if(ornate)b.lantern(-1.6,1.3,1.1);
        if(random()>0.35)b.barrel(2,1);
        if(random()>0.55)b.crate(-1.9,1);
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
  // A broad, static harbor extends out from the hub shore. Its planks, piles,
  // boats, and ship fragments all reuse the same instanced material batches.
  const portX=-17,portZ=coastZ(portX);
  const dockEnd=portZ-14;
  for(let i=0;i<30;i++)b.part("box","wood",i%2?"#987952":"#b08b5f",portX,0.32,portZ-i*0.48,3.1,0.2,0.5);
  for(const z of [portZ-0.5,portZ-3.2,portZ-6.2,portZ-9.2,dockEnd])for(const dx of [-1.3,1.3])b.part("cylinder","wood","#68513b",portX+dx,-0.2,z,0.16,1.5,0.16);
  for(const x of [-4.5,4.5])for(let i=0;i<12;i++)b.part("box","wood","#a57d50",portX+x,0.28,dockEnd+i*0.46,5.4,0.18,0.5);
  for(const x of [-4.5,4.5])for(const z of [dockEnd,dockEnd+3.9])b.part("cylinder","wood","#68513b",portX+x,-0.2,z,0.16,1.5,0.16);
  // Quayside warehouses and a small market are set into the inland end of the
  // dock, keeping the harbor connected to the village rather than floating at sea.
  for(const [x,z,turn,scale,roof] of [[portX-5.2,portZ+2.8,-0.28,0.78,"#78637c"],[portX+4.6,portZ+3.5,0.2,0.66,"#8c685b"]] as Array<[number,number,number,number,string]>) {
    b.at(x,terrainHeight(x,z),z,scale,turn,()=>{b.house(4.8,3.8,3.2,roof,true);b.crate(-3,1.9);b.barrel(3.1,1.6);});
  }
  b.at(portX,terrainHeight(portX,portZ+4.4),portZ+4.4,1,0,()=>{
    b.stall(-2.4,0,"#b77869");b.stall(2.4,0,"#719399");
    for(const x of [-4.1,-1.2,1.2,4.1])b.lantern(x,1.25,1.7);
  });
  const boat=(x:number,z:number,scale:number,turn:number,cloth:string,large=false)=>b.at(x,0.02,z,scale,turn,()=>{
    const hull=large?2.55:1.8,length=large?5.6:4;
    b.part("hull","wood",large?"#694731":"#75543d",0,0,0,hull,large?1.25:1,length);
    b.part("cylinder","wood","#785a3d",0,large?2.7:2,0,0.1,large?5.4:4,0.1);
    b.part("sail","cloth",cloth,0.65,large?3.3:2.5,0,large?2:1.5,large?2.8:2,1);
    if(large)b.part("sail","cloth",cloth,-0.6,2.6,-1.25,1.45,2.05,1);
    b.part("box","wood","#b08b5f",0,0.5,-length*0.36,large?1.8:1.1,0.3,0.45);
    if(large)for(const x of [-0.6,0,0.6])b.part("box","wood","#b08b5f",x,0.9,0.55,0.45,0.5,0.5);
  });
  boat(portX+5.8,dockEnd+2.3,0.78,0.18,"#efdfb8",true);
  boat(portX-6.2,dockEnd+4.1,0.7,-0.26,"#91bfc5",true);
  boat(portX+3.8,dockEnd-2.6,0.58,0.46,"#c99088");
  boat(portX-3.6,dockEnd-1.8,0.44,-0.38,"#e0c889");
  boat(portX+8.4,dockEnd-4.8,0.33,0.6,"#7ca9ba");
  // Far-off boats deliberately use only a hull and (sometimes) a tiny sail;
  // the fixed isometric camera cannot benefit from full ship detail at this size.
  const distantBoat=(x:number,z:number,scale:number,turn:number,cloth?:string)=>b.at(x,-0.02,z,scale,turn,()=>{
    b.part("hull","wood","#76533c",0,0,0,1.6,0.7,3.4);
    if(cloth){b.part("cylinder","wood","#785a3d",0,1.15,0,0.07,2.3,0.07);b.part("sail","cloth",cloth,0.35,1.45,0,0.72,1.1,1);}
  });
  for(const [x,z,scale,turn,cloth] of [[-30,-18,0.34,0.2,"#d7c69a"],[-29,18,0.25,-0.5,""],[2,-31,0.31,0.38,"#91bfc5"],[28,-22,0.27,-0.25,""],[35,18,0.33,0.55,"#c99088"],[2,38,0.22,-0.35,""],[-48,4,0.28,0.2,"#e0c889"],[50,-12,0.24,-0.48,""]] as Array<[number,number,number,number,string]>) {
    if(shoreDistance(x,z)<-1.4)distantBoat(x,z,scale,turn,cloth || undefined);
  }
  // A few stranded timbers and a broken mast make the nearby water feel sailed.
  for(const [x,z,turn] of [[portX-5.2,dockEnd-2.8,0.35],[portX+6.8,dockEnd+0.7,-0.6]] as Array<[number,number,number]>) {
    b.part("box","wood","#76573d",x,-0.01,z,1.6,0.16,0.28,0,turn,0);
    b.part("cylinder","wood","#76573d",x+0.3,0.36,z,0.09,1.1,0.09,0,0,Math.PI*0.32);
  }
  return b;
}
export function makeVegetation(distant=false) {
  const b=new ArchitectureBuilder(),random=seededRandom(distant?871:7319),spacing=distant?5:2.8;
  for(let z=WORLD_BOUNDS.minZ+2;z<WORLD_BOUNDS.maxZ-2;z+=spacing)for(let x=WORLD_BOUNDS.minX+2;x<WORLD_BOUNDS.maxX-2;x+=spacing){
    const px=x+random()*1.5,pz=z+random()*1.5;
    if(!insideWorld(px,pz)||shoreDistance(px,pz)<1.7||siteDistance(px,pz)<5.4||roadDistance(px,pz)<1.5||farmDistance(px,pz)<4.3)continue;
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
