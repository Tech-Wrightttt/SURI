// Geometric regression checks for the authored world and its generated routes.
/* eslint-disable @typescript-eslint/no-require-imports */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),ts=require('typescript'),T=require('three');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:1,target:7,esModuleInterop:true}}).outputText,f);
const w=require('../lib/worldMap/landscape.ts'),{TRAVERSAL}=require('../lib/worldMap/traversal.ts');
const {HUB_ROUNDABOUT:plaza,LEADERBOARD_ISLAND}=require('../lib/worldMap/mapLayout.ts');
const {ISLAND_ROUTES}=require('../lib/worldMap/navigationConfig.ts');
const {worldFrame,LANDMARK_SCALE,CAMERA_ORTHO_SIZE,LANDMARK_BOUNDS,LANDMARK_LABEL_LIFT}=require('../lib/worldMap/framing.ts');
const {responsiveCamera,applyOverviewPose}=require('../lib/worldMap/responsiveCamera.ts');
const {playableProjectionBounds}=require('../lib/worldMap/worldBounds.ts');
const {UPPER_ISLANDS}=require('../lib/worldMap/northernIslands.ts');
const {WATER_LEVEL}=require('../lib/worldMap/environment.ts');
const read=rel=>JSON.parse(fs.readFileSync(path.join(__dirname,'../public/world-map',rel)));
// Sample actual coast contours, not just island centers, to protect the open
// channel around Topics when the rear scenery is rearranged.
for(const [name,island]of Object.entries(UPPER_ISLANDS))for(let j=0;j<96;j++){
  const angle=j/96*Math.PI*2,radius=w.coastlineRadius(angle,island);
  const u=Math.cos(angle)*island.rx*radius,v=Math.sin(angle)*island.rz*radius,c=Math.cos(island.turn),s=Math.sin(island.turn);
  assert(w.islandScore(island.x+u*c-v*s,island.z+u*s+v*c,w.PRIMARY_ISLANDS.topics)<-8,'Upper islet crowds Topics: '+name);
}
const nodes=new Map(),edges=new Map();
const same=(a,b,context)=>assert(Math.hypot(...a.map((v,j)=>v-b[j]))<.002,context);
const join=(id,point)=>{if(nodes.has(id))same(point,nodes.get(id),'Disconnected junction '+id);else nodes.set(id,point);};
const connect=(a,b)=>{for(const [from,to]of [[a,b],[b,a]]){if(!edges.has(from))edges.set(from,new Set());edges.get(from).add(to);}};
for(const node of TRAVERSAL.nodes)join(node.id,node.point);
for(const p of TRAVERSAL.paths){
  assert(p.points.length>1,'Empty approach '+p.id);
  join(p.from,p.points[0]);join(p.to,p.points.at(-1));connect(p.from,p.to);
  for(let j=1;j<p.points.length;j++){
    const a=p.points[j-1],b=p.points[j],run=Math.hypot(b[0]-a[0],b[2]-a[2]);
    assert(Math.abs(b[1]-a[1])<=run*.602+.001,'Unsafe stair grade '+p.id);
    assert(w.islandScore(b[0],b[2],w.ISLANDS[p.island])>1.05,'Approach leaves dry terrain '+p.id);
  }
}
for(const bridge of TRAVERSAL.bridges){
  join(bridge.from,bridge.a);join(bridge.to,bridge.b);connect(bridge.from,bridge.to);
  assert(Math.abs(bridge.length-Math.hypot(bridge.b[0]-bridge.a[0],bridge.b[2]-bridge.a[2]))<.001,'Bridge length mismatch '+bridge.id);
}
const reached=new Set(),pending=['court-keep'];while(pending.length){const id=pending.pop();if(reached.has(id))continue;reached.add(id);pending.push(...edges.get(id)??[]);}
assert.equal(reached.size,nodes.size,'Traversal graph contains inaccessible areas');
assert.equal(ISLAND_ROUTES['/leaderboard'],'watchtower');
const leaderboardBridge=TRAVERSAL.bridges.find(b=>b.id==='hub-wyrmrest');
assert(leaderboardBridge,'Leaderboard island is missing its bridge');
assert(reached.has('court-watchtower'),'Watchtower court is not connected to the roundabout');
assert(TRAVERSAL.paths.some(p=>p.id==='watchtower-entry'),'Watchtower steps are not connected');
const arcs=TRAVERSAL.paths.filter(p=>p.id.startsWith('hub-roundabout-'));
assert.equal(arcs.length,4,'Roundabout must form one complete circle');
for(let j=0;j<4;j++){
  assert.equal(arcs[j].to,arcs[(j+1)%4].from,'Roundabout junction is disconnected');
  for(const p of arcs[j].points)assert(Math.abs(Math.hypot(p[0]-plaza.x,p[2]-plaza.z)-plaza.radius)<.001,'Roundabout lost its circular shape');
}
for(const p of TRAVERSAL.paths.filter(p=>p.island==='hub'&&!p.id.startsWith('hub-roundabout-')))for(const point of p.points){
  assert(Math.hypot(point[0]-plaza.x,point[2]-plaza.z)>=plaza.radius-.01,'Hub branch cuts across the fountain circle '+p.id);
}
const ambient=read('ambient/ambient.json');
assert(ambient.fountains.some(f=>Math.hypot(f.x-plaza.x,f.z-plaza.z)<.001),'Fountain is missing from the roundabout');
assert(ambient.routes.some(r=>r.id==='fountain-roundabout-patrol'&&r.closed),'Roundabout pedestrian circuit is missing');
for(const bridge of TRAVERSAL.bridges){
  const crossings=ambient.routes.filter(r=>r.id.startsWith('crossing-'+bridge.id+'-'));
  assert.equal(crossings.length,2,'Missing pedestrian lanes '+bridge.id);
  for(const r of crossings)for(const end of [bridge.a,bridge.b])assert(r.points.some(p=>Math.hypot(p[0]-end[0],p[2]-end[2])<.6),'NPC lane stops before bridge '+r.id);
  for(const r of crossings)for(const point of r.points){
    let edge=Infinity;
    for(const p of TRAVERSAL.paths)for(let j=1;j<p.points.length;j++)edge=Math.min(edge,w.segmentDistance(point[0],point[2],[p.points[j-1][0],p.points[j-1][2]],[p.points[j][0],p.points[j][2]])-p.width/2);
    for(const b of TRAVERSAL.bridges)edge=Math.min(edge,w.segmentDistance(point[0],point[2],[b.a[0],b.a[2]],[b.b[0],b.b[2]])-b.width/2);
    assert(edge<-.1,'NPC leaves the paved walking corridor '+r.id);
  }
}
for(const r of ambient.routes.filter(r=>r.kind==='walk')){
  for(const p of r.points)assert(p.every(Number.isFinite),'Invalid NPC waypoint '+r.id);
  for(let j=1;j<r.points.length;j++)assert(Math.hypot(...r.points[j].map((v,k)=>v-r.points[j-1][k]))<.121,'NPC route jumps '+r.id);
}
for(const tier of ['high','balanced']){
  const scene=read('scene/'+tier+'.json');
  for(const kind of w.DASHBOARD_SITE_KEYS){assert(scene.landmarks[kind]?.length,'Missing landmark '+kind);assert(scene.landmarkZones[kind]?.perimeter.length===64,'Missing selection zone '+kind);}
  const zone=scene.landmarkZones.watchtower;
  same([zone.x,zone.z],w.SITES.watchtower,'Watchtower selection ring drifted');
  assert.equal(zone.radius,LEADERBOARD_ISLAND.selectionRadius,'Watchtower selection radius is stale');
  assert(zone.radius>4,'Watchtower selection area was not expanded');
  assert(zone.radius<w.ISLANDS.wyrmrest.rz,'Watchtower ring exceeds islet');
  // Check the shipped geometry, so adding source islands without rebaking
  // either scene tier cannot silently leave the upper archipelago empty.
  const packed=scene.geometries[scene.terrain.secondary],position=packed.attributes.position,index=packed.index;
  const buffer=Uint8Array.from(fs.readFileSync(path.join(__dirname,'../public/world-map/scene',scene.buffer))).buffer;
  const geometry=new T.BufferGeometry();
  geometry.setAttribute('position',new T.BufferAttribute(new Float32Array(buffer,position.offset,position.count),position.itemSize));
  geometry.setIndex(new T.BufferAttribute(new (index.type==='u32'?Uint32Array:Uint16Array)(buffer,index.offset,index.count),1));
  const material=new T.MeshBasicMaterial({side:T.DoubleSide}),terrain=new T.Mesh(geometry,material);
  const raycaster=new T.Raycaster(new T.Vector3(),new T.Vector3(0,-1,0));
  for(const [name,island]of Object.entries(UPPER_ISLANDS)){
    raycaster.ray.origin.set(island.x,32,island.z);
    const hit=raycaster.intersectObject(terrain,false)[0];
    assert(hit&&hit.point.y>WATER_LEVEL+.005,'Missing upper islet in '+tier+': '+name);
  }
  geometry.dispose();material.dispose();
}
// Fit the whole tower and its collapsed label under the header, at multiple
// viewport shapes. A narrow phone keeps horizontal map panning by design.
for(const [width,height]of [[1440,900],[1280,720],[1920,1080],[390,844],[844,390]]){
  const frame=worldFrame(width,height,playableProjectionBounds()),response=responsiveCamera(width,height,playableProjectionBounds(),width<900,96);
  const camera=new T.OrthographicCamera(-CAMERA_ORTHO_SIZE*width/height,CAMERA_ORTHO_SIZE*width/height,CAMERA_ORTHO_SIZE,-CAMERA_ORTHO_SIZE,.5,650);
  applyOverviewPose(camera,response,new T.Vector2());
  const point=new T.Vector3(...w.sitePosition('watchtower'));point.y+=(LANDMARK_BOUNDS.watchtower[1]+LANDMARK_LABEL_LIFT)*LANDMARK_SCALE;
  point.applyAxisAngle(new T.Vector3(0,1,0),frame.rotation).multiplyScalar(frame.scale).add(new T.Vector3(...frame.position)).project(camera);
  const y=(-point.y*.5+.5)*height;
  const labelOffset=height<=480?20:0; // Match the short-screen marker offset.
  assert(y+labelOffset-40>=96,'Watchtower label is clipped by header at '+width+'x'+height);
  assert(y<height-20,'Watchtower leaves viewport at '+width+'x'+height);
}
console.log(`Verified ${TRAVERSAL.bridges.length} connected bridges, ${TRAVERSAL.paths.length} aligned paths, ${ambient.actors.filter(a=>a.model==='person').length} citizens, six destinations, watchtower framing and ${Object.keys(UPPER_ISLANDS).length} upper islets in both scene tiers.`);
