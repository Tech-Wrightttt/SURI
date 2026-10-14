import * as THREE from "three";
import { CAMERA_ORTHO_SIZE, LANDMARK_SCALE, WORLD_BOUNDS } from "./framing";
export { WORLD_BOUNDS } from "./framing";
export type MapPoint = [number, number];
type Island = { x: number; z: number; rx: number; rz: number; turn: number; seed: number; hill: number };
// Camera-aligned layout: one broad hub, four nearby districts, and a scatter of
// deliberately tiny scenic keys.  These are data only: their detail is batched
// with the rest of the world instead of becoming individual scenes.
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
  wispReef: island(-55,15,3.8,3.1,-0.2,11,1.15),
  emberKey: island(-55,-19,3.2,2.8,0.45,12,1.1),
  moonShoal: island(-28,-43,3.8,2.7,-0.35,13,1.2),
  cloudrest: island(7,-43,3.2,2.5,0.2,14,1.05),
  silverhook: island(29,-38,4.2,2.7,-0.48,15,1.2),
  prismCay: island(55,19,3.4,3,0.2,16,1.1),
  heronRock: island(54,38,2.8,2.2,-0.1,17,0.9),
  fernKey: island(-1,42,2.7,2.3,0.45,18,0.9),
  gullwatch: island(27,43,2.9,2.4,-0.38,19,0.95),
  quietCairn: island(-55,40,2.5,2.2,0.3,20,0.85),
};
export const SITES = {
  keep: [0,-3], academy: [-12,-9], guild: [-12,5], ranger: [11,-4], arena: [3,12],
  champions: [-43,-5], topics: [-11,-35], records: [47,1], calculator: [16,34],
} satisfies Record<string,MapPoint>;
// Only these sites are currently rendered as interactive landmark buildings.
// The other named locations remain terrain/route references while the hub is
// rebuilt as a non-interactive environmental settlement.
export const OUTER_HEIGHTS = { topics: 4.8, records: 3.3, champions: 4.2, calculator: 4.5 };
export const LANDMARK_SITE_KEYS = ["keep", "topics", "records", "champions", "calculator"] as const;
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
function baseTerrainHeight(x:number,z:number,coast=shoreDistance(x,z)) {
  if(coast<=0)return THREE.MathUtils.lerp(-1.1,0,THREE.MathUtils.smoothstep(coast,-2,0));
  let height=0.55;
  for(const i of Object.values(ISLANDS)) {
    const u=(x-i.x+i.rx*0.18)/(i.rx*0.65),v=(z-i.z+i.rz*0.2)/(i.rz*0.7);
    height+=i.hill*Math.exp(-(u*u+v*v));
  }
  height*=THREE.MathUtils.smoothstep(coast,0,5);
  // The hub keeps its coastline and broad silhouette, but receives deliberate
  // gentle terraces around its civic core instead of random-looking spikes.
  const hub=ISLANDS.hub,hubDistance=Math.hypot(x-hub.x,z-hub.z);
  if(hubDistance<Math.max(hub.rx,hub.rz)) {
    const crown=1.15*Math.exp(-((x+1)*(x+1)/260+(z+1)*(z+1)/190));
    const westTerrace=0.42*Math.exp(-((x+9)*(x+9)/55+(z-5)*(z-5)/70));
    const eastTerrace=0.36*Math.exp(-((x-10)*(x-10)/62+(z-6)*(z-6)/62));
    const southSlope=0.24*Math.exp(-((x-2)*(x-2)/180+(z+12)*(z+12)/80));
    height+=crown+westTerrace+eastTerrace+southSlope;
  }
  for(const key of LANDMARK_SITE_KEYS) {
    const [sx,sz]=SITES[key];
    // The keep rests on a broad raised acropolis. Its platform is deliberately
    // above the surrounding civic terrace, never a low bowl cut into the hill.
    const keep=key==="keep",foundation=keep?6.15:OUTER_HEIGHTS[key as keyof typeof OUTER_HEIGHTS];
    height=THREE.MathUtils.lerp(foundation,height,THREE.MathUtils.smoothstep(Math.hypot(x-sx,z-sz),keep?4.8:5.2,keep?9:9.5));
  }
  return height;
}

export const PLAZA_HEIGHT = 5.9;
export const CIVIC_BUILDINGS = {
  guild: { center: [-9,5] as MapPoint, rotation: 0.12, approachRotation: 0.12, ground: 5.25, floor: 6.15, entrance: 2.2 },
  observatory: { center: [9,5] as MapPoint, rotation: -0.16, approachRotation: -0.16, ground: 5.3, floor: 6, entrance: 1.3 },
  gate: { center: [-3,-13] as MapPoint, rotation: 0, approachRotation: 0, ground: 4.8, floor: 5.6, entrance: 1.1 },
  pavilion: { center: [7,-12] as MapPoint, rotation: 0.2, approachRotation: 0.2+Math.PI/6, ground: 4.35, floor: 4.83, entrance: 1.85 },
};
export function civicEntrance(name: keyof typeof CIVIC_BUILDINGS, distance=CIVIC_BUILDINGS[name].entrance): MapPoint {
  const building=CIVIC_BUILDINGS[name];
  return [building.center[0]+Math.sin(building.approachRotation)*distance,building.center[1]+Math.cos(building.approachRotation)*distance];
}
type GradedSegment = { ax:number; az:number; bx:number; bz:number; ay:number; by:number };
let gradedSegments: GradedSegment[]=[];
export function pathGrade(x:number,z:number) {
  let distanceSquared=Infinity,height=PLAZA_HEIGHT;
  for(const segment of gradedSegments){
    const {ax,az,bx,bz,ay,by}=segment;
    const boxX=Math.max(Math.min(ax,bx)-x,0,x-Math.max(ax,bx));
    const boxZ=Math.max(Math.min(az,bz)-z,0,z-Math.max(az,bz));
    if(boxX*boxX+boxZ*boxZ>=distanceSquared)continue;
    const dx=bx-ax,dz=bz-az,t=THREE.MathUtils.clamp(((x-ax)*dx+(z-az)*dz)/(dx*dx+dz*dz||1),0,1);
    const squared=(x-ax-dx*t)**2+(z-az-dz*t)**2;
    if(squared<distanceSquared){distanceSquared=squared;height=THREE.MathUtils.lerp(ay,by,t);}
  }
  return {distance:Math.sqrt(distanceSquared),height};
}
export function terrainHeight(x:number,z:number,coast=shoreDistance(x,z)) {
  const original=baseTerrainHeight(x,z,coast);
  if(coast<=0)return original;
  const grade=pathGrade(x,z);
  // Leave a shallow bed for the paving so coarse terrain triangles cannot
  // poke through the planned grade at a junction.
  let height=THREE.MathUtils.lerp(original,grade.height-0.1,1-THREE.MathUtils.smoothstep(grade.distance,1.15,4.5));
  // The plaza has a single level surface, rather than overlapping raised strips.
  height=THREE.MathUtils.lerp(height,PLAZA_HEIGHT,1-THREE.MathUtils.smoothstep(Math.hypot(x,z-6),3.7,6));
  for(const building of Object.values(CIVIC_BUILDINGS)){
    const distance=Math.hypot(x-building.center[0],z-building.center[1]);
    height=THREE.MathUtils.lerp(building.ground,height,THREE.MathUtils.smoothstep(distance,2.4,4.2));
  }
  // Keep the original foundations under architecture; approaches meet the slabs.
  for(const key of LANDMARK_SITE_KEYS){
    const [sx,sz]=SITES[key],distance=Math.hypot(x-sx,z-sz);
    const radius=key==="keep"?4.8:5.2;
    const foundation=key==="keep"?6.15:OUTER_HEIGHTS[key];
    height=THREE.MathUtils.lerp(foundation,height,THREE.MathUtils.smoothstep(distance,radius,radius+1.4));
  }
  return THREE.MathUtils.lerp(original,height,THREE.MathUtils.smoothstep(coast,0,0.65));
}

const outerSites = [SITES.champions,SITES.topics,SITES.records,SITES.calculator];
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
export const BRIDGE_DECK_HEIGHTS = [3.9,4.5,3,4.2];
export const HUB_PATH_ORIGIN: MapPoint = [0, 8.7];
export const HARBOR_PATH_ORIGIN: MapPoint = [-13,11];
// Join the plaza at shared nodes, skirt the civic buildings, and approach each
// bridge along its axis. Curves are confined to land; decks stay straight.
const approaches: MapPoint[][] = [
  [[-2.7,6],[-5,9.3],[-13,11],[-18,6]],
  [[0,3.3],[-5,2.5],[-6,-3],[-8,-12],[-9,-16]],
  [[2.7,6],[5,9.5],[14,10],[18,5]],
  [HUB_PATH_ORIGIN,[2,12],[5,14]],
];
function curvedPath(points: MapPoint[]) {
  const curve=new THREE.CatmullRomCurve3(points.map(([x,z])=>new THREE.Vector3(x,0,z)),false,"centripetal");
  return curve.getSpacedPoints(Math.max(8, Math.ceil(curve.getLength() / 0.3)));
}
export const ROADS = [
  ...outerSites.map((end,index)=>{
    const [a,b]=BRIDGES[index], direction=new THREE.Vector2(...end).normalize();
    const lead:MapPoint=[a[0]-direction.x*2.5,a[1]-direction.y*2.5];
    // Finish at the front steps, not underneath the landmark's center.
    const entrance:MapPoint=[end[0]-direction.x*2.4,end[1]-direction.y*2.4];
    const forecourt=new THREE.Vector3(end[0]-direction.x*6.6,0,end[1]-direction.y*6.6);
    return [...curvedPath([...approaches[index],lead,a]),new THREE.Vector3(b[0],0,b[1]),forecourt,new THREE.Vector3(entrance[0],0,entrance[1])];
  }),
  // A continuous promenade around the fountain links every branch.
  Array.from({length:65},(_,i)=>new THREE.Vector3(Math.sin(i*Math.PI/32)*2.7,0,6+Math.cos(i*Math.PI/32)*2.7)),
  ...[
    [[0,3.3],[0,0],[0,SITES.keep[1]+2.2*LANDMARK_SCALE]],
    [[-13,11],[-10,11],civicEntrance("guild",4.8),civicEntrance("guild")],
    [[14,10],[11,11],civicEntrance("observatory",4.6),civicEntrance("observatory")],
    [[-6,-3],[-5.5,-7],civicEntrance("gate",4.2),civicEntrance("gate")],
    [[18,5],[18,-1],[14,-6],civicEntrance("pavilion",4.8),civicEntrance("pavilion")],
  ].map(points=>curvedPath(points as MapPoint[])),
];
function applyGrade(road: THREE.Vector3[], stations: Array<{index:number;height:number}>) {
  const distances=[0];
  for(let i=1;i<road.length;i++)distances.push(distances[i-1]+Math.hypot(road[i].x-road[i-1].x,road[i].z-road[i-1].z));
  for(let section=1;section<stations.length;section++){
    const from=stations[section-1],to=stations[section],length=distances[to.index]-distances[from.index];
    for(let i=from.index;i<=to.index;i++){
      const t=(distances[i]-distances[from.index])/Math.max(length,0.001);
      road[i].y=THREE.MathUtils.lerp(from.height,to.height,THREE.MathUtils.smoothstep(t,0,1));
    }
  }
}
for(let i=0;i<4;i++){
  const road=ROADS[i],last=road.length-1;
  const kind=(["champions","topics","records","calculator"] as const)[i];
  applyGrade(road,[{index:0,height:PLAZA_HEIGHT},{index:last-3,height:BRIDGE_DECK_HEIGHTS[i]},
    {index:last-2,height:BRIDGE_DECK_HEIGHTS[i]},{index:last-1,height:OUTER_HEIGHTS[kind]},
    {index:last,height:OUTER_HEIGHTS[kind]+0.22}]);
}
for(const point of ROADS[4])point.y=PLAZA_HEIGHT;
gradedSegments=ROADS.slice(0,5).flatMap(road=>road.slice(1).map((p,i)=>({ax:road[i].x,az:road[i].z,bx:p.x,bz:p.z,ay:road[i].y,by:p.y})));
const destinationHeights=[6.15+0.06+0.6*LANDMARK_SCALE,...Object.values(CIVIC_BUILDINGS).map(building=>building.floor)];
for(let i=5;i<ROADS.length;i++){
  const road=ROADS[i],start=pathGrade(road[0].x,road[0].z).height;
  applyGrade(road,[{index:0,height:start},{index:road.length-1,height:destinationHeights[i-5]}]);
}
gradedSegments=ROADS.flatMap(road=>road.slice(1).map((p,i)=>({ax:road[i].x,az:road[i].z,bx:p.x,bz:p.z,ay:road[i].y,by:p.y})));
export function registerHarborGrade(path:THREE.Vector3[]) {
  const first=path[0],last=path[path.length-1];
  const startHeight=pathGrade(first.x,first.z).height,endHeight=baseTerrainHeight(last.x,last.z);
  applyGrade(path,[{index:0,height:startHeight},{index:path.length-1,height:endHeight}]);
  gradedSegments.push(...path.slice(1).map((point,i)=>({ax:path[i].x,az:path[i].z,bx:point.x,bz:point.z,ay:path[i].y,by:point.y})));
}
const roadSegments=ROADS.flatMap(road=>road.slice(1).map((p,i)=>({a:[road[i].x,road[i].z] as MapPoint,b:[p.x,p.z] as MapPoint})));
export function roadDistance(x:number,z:number){
  let distance=Infinity;
  for(const {a,b} of roadSegments){
    const dx=Math.max(Math.min(a[0],b[0])-x,0,x-Math.max(a[0],b[0]));
    const dz=Math.max(Math.min(a[1],b[1])-z,0,z-Math.max(a[1],b[1]));
    if(Math.hypot(dx,dz)<distance)distance=Math.min(distance,segmentDistance(x,z,a,b));
  }
  return distance;
}
export function roadHeight(x:number,z:number,ground=terrainHeight(x,z)){
  const grade=pathGrade(x,z);
  return Math.max(ground,grade.distance<1.2?grade.height:ground)+0.06;
}
export const FARMS:MapPoint[]=[[-5,-15],[-6,17]];
export function farmDistance(x:number,z:number){return Math.min(...FARMS.map(([a,b])=>Math.hypot(x-a,z-b)));}
export function siteDistance(x:number,z:number){return Math.min(...Object.values(SITES).map(([a,b])=>Math.hypot(x-a,z-b)));}
export function sitePosition(site:keyof typeof SITES):[number,number,number]{const [x,z]=SITES[site];return [x,terrainHeight(x,z)+0.06,z];}
export function seededRandom(seed:number){return()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};}
export function insideWorld(x:number,z:number){return x>WORLD_BOUNDS.minX+2&&x<WORLD_BOUNDS.maxX-2&&z>WORLD_BOUNDS.minZ+2&&z<WORLD_BOUNDS.maxZ-2;}
