// Run with: node scripts/test-walking-paths.cjs
/* eslint-disable @typescript-eslint/no-require-imports -- Load the existing pure TypeScript geometry. */
const fs=require('node:fs');
const assert=require('node:assert/strict');
const ts=require('typescript');
const THREE=require('three');
require.extensions['.ts']=(module,file)=>module._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020},
}).outputText,file);
const world=require('../lib/worldMap/landscape.ts');
const {terrainSurface,walkingRibbon}=require('../lib/worldMap/walkingPaths.ts');
const placement=require('../lib/worldMap/placement.ts');

// Every civic branch belongs to the same walkable network; no orphaned paths.
const connected=new Set([4]);
let changed=true;
while(changed){
  changed=false;
  for(let i=0;i<world.ROADS.length;i++)if(!connected.has(i)){
    const joins=[...connected].some(j=>world.ROADS[i].some(p=>world.ROADS[j].some(q=>p.distanceTo(q)<0.65)));
    if(joins){connected.add(i);changed=true;}
  }
}
assert.equal(connected.size,world.ROADS.length,'all paths join the plaza network');
for(const [index,road] of world.ROADS.entries()){
  for(let i=1;i<road.length;i++){
    const a=road[i-1],b=road[i],distance=Math.hypot(a.x-b.x,a.z-b.z);
    const slope=Math.abs(world.roadHeight(a.x,a.z)-world.roadHeight(b.x,b.z))/distance;
    assert(slope<=0.3,`path ${index}: abrupt elevation change (${slope})`);
  }
}
for(const [offset,name] of ['guild','observatory','gate','pavilion'].entries()){
  const road=world.ROADS[6+offset],end=road.at(-1),before=road.at(-2);
  const entrance=world.civicEntrance(name),building=world.CIVIC_BUILDINGS[name];
  assert(Math.hypot(end.x-entrance[0],end.z-entrance[1])<1e-8,`${name}: path reaches doorway`);
  const approach=new THREE.Vector2(end.x-before.x,end.z-before.z).normalize();
  assert(approach.dot(new THREE.Vector2(-Math.sin(building.approachRotation),-Math.cos(building.approachRotation)))>0.98,`${name}: final approach aligns with rotated doorway`);
}
for(let i=0;i<4;i++){
  const road=world.ROADS[i];
  const [a,b]=world.BRIDGES[i];
  assert(road.some(p=>Math.hypot(p.x-a[0],p.z-a[1])<1e-8),'path reaches hub bridge landing');
  assert(road.some(p=>Math.hypot(p.x-b[0],p.z-b[1])<1e-8),'path reaches district bridge landing');
}
const harbor=placement.getHarborPlacement();
assert(harbor?.approach?.length>1,'harbor has a usable approach');
assert(Math.hypot(harbor.approach[0].x-world.HARBOR_PATH_ORIGIN[0],harbor.approach[0].z-world.HARBOR_PATH_ORIGIN[1])<1e-8,'harbor joins exact civic road node');
const entrance=harbor.start.clone().addScaledVector(harbor.outward,-harbor.landwardLength);
assert(Math.hypot(harbor.approach.at(-1).x-entrance.x,harbor.approach.at(-1).z-entrance.y)<1e-8,'harbor meets exact dock entrance');
for(let i=1;i<harbor.approach.length;i++){
  const a=harbor.approach[i-1],b=harbor.approach[i];
  assert(Math.abs(world.roadHeight(a.x,a.z)-world.roadHeight(b.x,b.z))/Math.hypot(a.x-b.x,a.z-b.z)<0.3,'harbor descent stays gradual');
}

for(const detail of [1,0.58]){
  const terrain=new THREE.PlaneGeometry(122,98,Math.round(188*detail),Math.round(152*detail));
  terrain.rotateX(-Math.PI/2);
  const position=terrain.attributes.position;
  for(let i=0;i<position.count;i++)position.setY(i,world.terrainHeight(position.getX(i),position.getZ(i)));
  // Validate triangle sampling at each vertex, rather than the analytical hill.
  for(let i=0;i<position.count;i+=31)assert(Math.abs(terrainSurface(terrain,position.getX(i),position.getZ(i))-position.getY(i))<1e-5);
  let triangles=0;
  for(const [index,road] of [...world.ROADS,harbor.approach].entries()){
    const geometry=walkingRibbon(road,(x,z)=>index<4?THREE.MathUtils.lerp(0.5,0.8,THREE.MathUtils.smoothstep(world.bridgeDistance(x,z),1.2,4)):index===4?0.6:0.5,(x,z)=>world.roadHeight(x,z,terrainSurface(terrain,x,z))+0.04);
    const vertices=geometry.attributes.position;
    for(let i=10;i<vertices.count;i+=7){
      const previous=i-7;
      const run=Math.hypot(vertices.getX(i)-vertices.getX(previous),vertices.getZ(i)-vertices.getZ(previous));
      const grade=Math.abs(vertices.getY(i)-vertices.getY(previous))/run;
      assert(grade<0.35,`path ${index}, detail ${detail}, at ${vertices.getX(i)},${vertices.getZ(i)}: rendered centerline has an abrupt drop (${grade})`);
    }
    for(let i=0;i<vertices.count;i++){
      const x=vertices.getX(i),y=vertices.getY(i),z=vertices.getZ(i);
      assert(Number.isFinite(x+y+z),'path vertices remain finite');
      assert(y>=terrainSurface(terrain,x,z)+0.09,'path never sinks below rendered terrain');
      if(world.shoreDistance(x,z)<0)assert(world.bridgeDistance(x,z)<1,`path ${index}: water crossing at ${x},${z} stays on a bridge`);
    }
    const indices=geometry.index;
    for(let i=0;i<indices.count;i+=3){
      const a=new THREE.Vector3().fromBufferAttribute(vertices,indices.getX(i));
      const b=new THREE.Vector3().fromBufferAttribute(vertices,indices.getX(i+1));
      const c=new THREE.Vector3().fromBufferAttribute(vertices,indices.getX(i+2));
      const area=b.sub(a).cross(c.sub(a)).y;
      assert(area>0,`path ${index}, triangle ${i/3}: curves do not fold over or invert (area ${area})`);
      triangles++;
    }
    geometry.dispose();
  }
  terrain.dispose();
  console.log(`PASS: ${detail===1?'desktop':'low-detail'} terrain, ${triangles} path triangles; connected junctions, dry lanes and exact bridge/dock joins.`);
}
