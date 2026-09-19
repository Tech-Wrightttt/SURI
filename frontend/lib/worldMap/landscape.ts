import * as THREE from "three";
import { CAMERA_ORTHO_SIZE, WORLD_BOUNDS } from "./framing";
export { WORLD_BOUNDS } from "./framing";
export type MapPoint = [number, number];
type Island = { x: number; z: number; rx: number; rz: number; turn: number; seed: number; hill: number };
// Camera-aligned layout: one broad hub, four nearby districts, five small keys.
const unit = CAMERA_ORTHO_SIZE / 40;
function island(x:number,z:number,rx:number,rz:number,turn:number,seed:number,hill:number):Island {
  return { x:x*unit,z:z*unit,rx:rx*unit,rz:rz*unit,turn,seed,hill };
}
export const ISLANDS = {
  hub: island(0,0,28,24,-0.1,1,4.5),
  progress: island(-42,-5,12,14,-0.4,2,3.2),
  topics: island(-11,-35,16,10,0.15,3,3.5),
  records: island(46,1,12,11,0.35,4,2.8),
  calculator: island(15,34,15,10,-0.25,5,3),
  lanternCove: island(-41,24,7,5,0.3,6,1.6),
  tidewatch: island(47,-24,6,4,-0.45,7,1.4),
  mossrock: island(-39,-32,5,4,0.6,8,1.5),
  starfall: island(-13,35,6,4,-0.2,9,1.3),
  pebbleKey: island(40,28,5,4,0.5,10,1.5),
};
export const SITES = {
  keep: [0,-3], thorns: [-12,-9], guild: [-12,5], ranger: [11,-4], arena: [3,12],
  champions: [-43,-5], academy: [-11,-35], records: [47,1], calculator: [16,34],
} satisfies Record<string,MapPoint>;
export const LAKES = [{x:-18,z:0,rx:2.8,rz:2}];
export const RIVER_PATHS:MapPoint[][] = [[[16,-18],[18,-12],[17,-6],[20,0],[18,7],[19,16]]];

export function segmentDistance(x:number,z:number,a:MapPoint,b:MapPoint) {
  const dx=b[0]-a[0],dz=b[1]-a[1];
  const t=THREE.MathUtils.clamp(((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz || 1),0,1);
  return Math.hypot(x-a[0]-dx*t,z-a[1]-dz*t);
}
export function islandScore(x:number,z:number,island:Island) {
  const dx=x-island.x,dz=z-island.z,c=Math.cos(island.turn),s=Math.sin(island.turn);
  const u=(dx*c+dz*s)/island.rx,v=(-dx*s+dz*c)/island.rz;
  const angle=Math.atan2(v,u),phase=island.seed*1.37;
  const coastline=0.9+0.11*Math.sin(3*angle+phase)+0.075*Math.cos(2*angle-phase)
    +0.045*Math.sin(5*angle+phase*0.7)+0.025*Math.cos(7*angle-phase);
  return Math.min(island.rx,island.rz)*(1-Math.hypot(u,v)/coastline);
}
export function shoreDistance(x:number,z:number) {return Math.max(...Object.values(ISLANDS).map(i=>islandScore(x,z,i)));}
export function coastZ(x:number) {
  for(let z=30;z>=0;z-=0.1)if(islandScore(x,z,ISLANDS.hub)>=0)return z;
  return 0;
}
export function riverDistance(x:number,z:number) {return Math.min(...RIVER_PATHS.flatMap(path=>path.slice(1).map((p,i)=>segmentDistance(x,z,path[i],p))));}
export function riverWidth(z:number) {return 0.7+z*0;}
export function riverLevel(z:number) {return 0.25+z*0;}
export function terrainHeight(x:number,z:number,coast=shoreDistance(x,z)) {
  if(coast<=0)return THREE.MathUtils.lerp(-1.1,0,THREE.MathUtils.smoothstep(coast,-2,0));
  let height=0.55;
  for(const i of Object.values(ISLANDS)) {
    const u=(x-i.x+i.rx*0.18)/(i.rx*0.65),v=(z-i.z+i.rz*0.2)/(i.rz*0.7);
    height+=i.hill*Math.exp(-(u*u+v*v));
  }
  height*=THREE.MathUtils.smoothstep(coast,0,5);
  for(const [sx,sz] of Object.values(SITES))height=THREE.MathUtils.lerp(1.1,height,THREE.MathUtils.smoothstep(Math.hypot(x-sx,z-sz),3.6,7.5));
  const river=riverDistance(x,z);
  height=THREE.MathUtils.lerp(0.08,height,THREE.MathUtils.smoothstep(river,0.6,2.6));
  for(const lake of LAKES){
    const distance=Math.hypot((x-lake.x)/lake.rx,(z-lake.z)/lake.rz);
    height=THREE.MathUtils.lerp(0.08,height,THREE.MathUtils.smoothstep(distance,0.85,1.6));
  }
  return height;
}

const outerSites = [SITES.champions,SITES.academy,SITES.records,SITES.calculator];
const hub:MapPoint=[0,0];
// Derive each bridge from the actual coast intersections along its road.
export const BRIDGES:Array<[MapPoint,MapPoint,"wood"|"stone"]> = outerSites.map((end,index)=>{
  let first=1,last=0;
  for(let step=0;step<=400;step++){
    const t=step/400,x=end[0]*t,z=end[1]*t;
    if(shoreDistance(x,z)<0){first=Math.min(first,t);last=Math.max(last,t);}
  }
  const margin=1.5/Math.hypot(...end);
  return [[end[0]*(first-margin),end[1]*(first-margin)],[end[0]*(last+margin),end[1]*(last+margin)],index%2?"wood":"stone"];
});
export function bridgeDistance(x:number,z:number){return Math.min(...BRIDGES.map(([a,b])=>segmentDistance(x,z,a,b)));}
const internal:MapPoint[][] = [[SITES.thorns,SITES.guild,SITES.arena],[SITES.keep,SITES.ranger],[SITES.keep,SITES.thorns],[SITES.keep,SITES.arena]];
export const ROADS = [ ...outerSites.map(end=>[hub,end]),...internal ].map(points=>{
  const curve=new THREE.CatmullRomCurve3(points.map(([x,z])=>new THREE.Vector3(x,0,z)),false,"centripetal");
  return curve.getPoints(80);
});
export function roadDistance(x:number,z:number){return Math.min(...ROADS.flatMap(road=>road.slice(1).map((p,i)=>segmentDistance(x,z,[road[i].x,road[i].z],[p.x,p.z]))));}
export function roadHeight(x:number,z:number){
  const deck=THREE.MathUtils.smoothstep(bridgeDistance(x,z),0.65,2.5);
  return THREE.MathUtils.lerp(0.85,terrainHeight(x,z)+0.06,deck);
}
export const FARMS:MapPoint[]=[[-5,-15],[-6,17]];
export function farmDistance(x:number,z:number){return Math.min(...FARMS.map(([a,b])=>Math.hypot(x-a,z-b)));}
export function siteDistance(x:number,z:number){return Math.min(...Object.values(SITES).map(([a,b])=>Math.hypot(x-a,z-b)));}
export function sitePosition(site:keyof typeof SITES):[number,number,number]{const [x,z]=SITES[site];return [x,terrainHeight(x,z)+0.06,z];}
export function seededRandom(seed:number){return()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};}
export function insideWorld(x:number,z:number){return x>WORLD_BOUNDS.minX+2&&x<WORLD_BOUNDS.maxX-2&&z>WORLD_BOUNDS.minZ+2&&z<WORLD_BOUNDS.maxZ-2;}
