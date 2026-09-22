// Run with: node scripts/check-world-map.mjs
// Transpile the pure geometry generators without introducing a test dependency.
import ts from 'typescript';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const load = createRequire(import.meta.url);
load.extensions['.ts'] = (module, file) => module._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, file);
const world = load('../lib/worldMap/landscape.ts');
const THREE = load('three');
const framing = load('../lib/worldMap/framing.ts');
const { ArchitectureBuilder } = load('../lib/worldMap/architecture.ts');
const { makeSettlements, makeVegetation } = load('../lib/worldMap/settlements.ts');
const placement = load('../lib/worldMap/placement.ts');
function checkBatch(builder) {
  let count = 0;
  for (const batch of builder.batches.values()) {
    count += batch.pieces.length;
    for (const piece of batch.pieces) assert(piece.matrix.elements.every(Number.isFinite), 'Invalid geometry transform');
  }
  return count;
}
for (const [key, [x, z]] of Object.entries(world.SITES)) {
  assert(world.shoreDistance(x, z) > 5, `${key}: shoreline clearance`);
  if (world.LANDMARK_SITE_KEYS.includes(key)) {
    const expected = key === 'keep' ? 6.15 : world.OUTER_HEIGHTS[key];
    assert(Math.abs(world.terrainHeight(x, z) - expected) < 0.01, `${key}: level landmark foundation`);
  } else assert(world.terrainHeight(x, z) > 0.5, `${key}: dry civic terrain`);
  if (world.LANDMARK_SITE_KEYS.includes(key)) assert(world.roadDistance(x, z) < 5, `${key}: road access`);
  const builder = new ArchitectureBuilder();
  builder.landmark(key);
  assert(checkBatch(builder) > 30, `${key}: missing architectural detail`);
}
for (const [x,z] of [[0,-3],[4,-3],[-4,-3],[0,1],[0,-7]]) {
  assert(Math.abs(world.terrainHeight(x,z)-6.15)<0.01, 'Keep acropolis must be a broad, level elevated platform');
}
// The destination crowns must support the whole monument, not just its center.
for (const [kind, elevation] of Object.entries(world.OUTER_HEIGHTS)) {
  const [x,z] = world.SITES[kind];
  for (let i=0;i<16;i++) {
    const angle=i*Math.PI/8;
    assert(Math.abs(world.terrainHeight(x+Math.sin(angle)*4.5,z+Math.cos(angle)*4.5)-elevation)<0.01, `${kind}: unsupported landmark terrace`);
  }
  const builder=new ArchitectureBuilder(); builder.landmark(kind);
  assert(checkBatch(builder)<600 && builder.batches.size<24, `${kind}: landmark exceeds instance budget`);
  if(kind==='records') {
    assert(![...builder.batches.values()].some(batch=>batch.surface==='roof'), 'Memorial records must remain exposed outdoors');
  }
}
assert('topics' in world.SITES && 'topics' in world.ISLANDS, 'Topics must retain its own named island and site');
assert(!('tactics' in world.SITES) && !('tactics' in world.ISLANDS), 'Obsolete Tactics world identifiers must be removed');
for (const [key, [x, z]] of Object.entries(world.SITES)) {
  const [width,,depth] = framing.LANDMARK_BOUNDS[key];
  const footprint = { x, z, width: width * framing.LANDMARK_SCALE, depth: depth * framing.LANDMARK_SCALE };
  assert(placement.footprintCells(footprint).every(cell => cell.kind === 'LAND'), `${key}: full landmark footprint must be land`);
}
const dock = placement.findDockPlacement(new THREE.Vector2(0, 1), 4, 2.2, 1200, 2, world.SITES.keep);
assert(dock && placement.validateDockTerrain(dock), 'Dock must be anchored at coast and extend across water');
assert(dock.length <= 4 && dock.landwardLength >= 2, 'Harbor must use a short water dock with a grounded land approach');
const harborPath = placement.dockApproachPath(dock, world.SITES.keep);
for (let index = 1; index < harborPath.length; index++) for (let step = 0; step <= 20; step++) {
  const point = harborPath[index - 1].clone().lerp(harborPath[index], step / 20);
  assert(world.shoreDistance(point.x, point.z) > 0, 'Dock access path must stay on land');
}
assert(world.terrainHeight(harborPath.at(-1).x, harborPath.at(-1).z) > 0.25, 'Dock entrance must be raised above the waterline');
const dockBox = placement.footprintBox(placement.dockFootprint(dock), -0.95, 1.1);
const harborValidator = new placement.PlacementValidator();
harborValidator.commit({ kind: 'dock', footprint: placement.dockFootprint(dock), bounds: dockBox, clearance: 0.15 });
for (const side of [1]) {
  const boat = placement.boatBesideDock(dock, 1.9, 4.2, side);
  assert(placement.footprintCells(boat).every(cell => cell.kind === 'WATER'), 'Boat footprint must stay in water');
  const boatPlacement = { kind: 'boat', footprint: boat, bounds: placement.footprintBox(boat, -0.1, 4), clearance: 0.55 };
  assert(!boatPlacement.bounds.clone().expandByScalar(0.55).intersectsBox(dockBox), 'Boat must clear dock bounding box');
  assert(harborValidator.canPlace(boatPlacement, ['WATER']), `Boat ${side} must commit only after water and collision validation at ${boat.x.toFixed(1)},${boat.z.toFixed(1)}; bounds ${boatPlacement.bounds.min.x.toFixed(1)},${boatPlacement.bounds.min.z.toFixed(1)} to ${boatPlacement.bounds.max.x.toFixed(1)},${boatPlacement.bounds.max.z.toFixed(1)}`);
  harborValidator.commit(boatPlacement);
}
for (const [name, island] of Object.entries(world.ISLANDS)) {
  assert(world.shoreDistance(island.x, island.z) > Math.min(3, Math.min(island.rx, island.rz) * 0.5), `${name}: missing island interior`);
}
// Check actual coastline connectivity so irregular headlands cannot join islands.
const land = new Set();
const stride = 261;
for (let z = 0; z < 241; z++) for (let x = 0; x < stride; x++) {
  if (world.shoreDistance(x - 130, z - 120) > 0) land.add(z * stride + x);
}
let islandCount = 0;
const islandGroups = [];
while (land.size) {
  islandCount++;
  const start = land.values().next().value;
  const pending = [start];
  const names = [];
  land.delete(start);
  while (pending.length) {
    const point = pending.pop();
    for (const [name, island] of Object.entries(world.ISLANDS)) {
      if (point === (island.z + 120) * stride + island.x + 130) names.push(name);
    }
    for (const neighbor of [point - 1, point + 1, point - stride, point + stride]) {
      if (land.delete(neighbor)) pending.push(neighbor);
    }
  }
  islandGroups.push(names.join('+'));
}
assert.equal(islandCount, Object.keys(world.ISLANDS).length, `Each island must remain separated by ocean: ${islandGroups.join(', ')}`);
assert(Object.keys(world.ISLANDS).length >= 20, 'The world needs a varied scatter of scenic islets');
assert(world.BRIDGES.length === 4, 'Archipelago must retain its four functional bridges');
for (const [a,b] of world.BRIDGES) {
  assert(world.shoreDistance((a[0]+b[0])/2,(a[1]+b[1])/2)<0, 'Bridge must span an ocean channel');
  assert(world.shoreDistance(...a)>0&&world.shoreDistance(...b)>0, 'Bridge must land on both shores');
  assert(Math.hypot(b[0]-a[0],b[1]-a[1])<20, 'Districts should stay close to the hub');
}
for (const road of world.ROADS) for (const point of road) {
  if (world.shoreDistance(point.x, point.z) < 0) assert(world.bridgeDistance(point.x, point.z) < 1.6, `Road crossed open water without a bridge at ${point.x.toFixed(1)}, ${point.z.toFixed(1)}`);
  assert(world.roadHeight(point.x, point.z) > 0.1, 'Road entered the tide line');
}
assert(!('RIVER_PATHS' in world) && !('LAKES' in world), 'The main island must not retain inland water geometry');
for (const [name, builder] of [['settlements', makeSettlements()], ['forest', makeVegetation()], ['background', makeVegetation(true)]]) {
  const count = checkBatch(builder);
  assert(builder.batches.size < 40, 'Excessive environmental draw batches');
  console.log(`${name}: ${count} instances in ${builder.batches.size} batches`);
}
console.log('PASS: island foundations, bridge-only water crossings, dry main-island terrain, and valid batched geometry.');

// Validate actual generated terrain and architecture against the camera projection.
const { playableProjectionBounds, architectureBounds } = load('../lib/worldMap/worldBounds.ts');
const projectedBounds = playableProjectionBounds();
const generated = [makeSettlements(), makeVegetation()];
for (const [key, point] of Object.entries(world.SITES)) {
  const builder = new ArchitectureBuilder(); builder.landmark(key);
  const transform = new THREE.Matrix4().makeTranslation(...world.sitePosition(key)).scale(new THREE.Vector3().setScalar(framing.LANDMARK_SCALE));
  const box = architectureBounds(builder, transform);
  assert(box.min.x >= world.WORLD_BOUNDS.minX && box.max.x <= world.WORLD_BOUNDS.maxX, `${key}: outside generated terrain`);
  for (const x of [box.min.x, box.max.x]) for (const z of [box.min.z, box.max.z]) {
    assert(world.shoreDistance(x,z)>0, `${key}: building footprint over water`);
  }
  assert(Math.hypot(...point) < 55, `${key}: district too far from hub`);
}
for (const builder of generated) {
  const bounds=architectureBounds(builder);
  assert(bounds.min.x>=world.WORLD_BOUNDS.minX&&bounds.max.x<=world.WORLD_BOUNDS.maxX&&bounds.min.z>=world.WORLD_BOUNDS.minZ&&bounds.max.z<=world.WORLD_BOUNDS.maxZ,`Decorations escaped the compact layout: ${bounds.min.x.toFixed(1)},${bounds.min.z.toFixed(1)} to ${bounds.max.x.toFixed(1)},${bounds.max.z.toFixed(1)}`);
}
for (const [width,height] of [[1288,646],[1440,900],[1024,768],[820,600],[390,260],[844,390]]) {
  const frame=framing.worldFrame(width,height,projectedBounds);
  const camera=new THREE.OrthographicCamera(-40*width/height,40*width/height,40,-40,0.5,650);
  camera.position.set(...framing.CAMERA_POSITION);camera.lookAt(...framing.CAMERA_TARGET);camera.updateMatrixWorld();
  const matrix=new THREE.Matrix4().compose(new THREE.Vector3(...frame.position),new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),frame.rotation),new THREE.Vector3().setScalar(frame.scale));
  for (const [site, [x,z]] of Object.entries(world.SITES)) {
    const y=world.sitePosition(site)[1]+(framing.LANDMARK_BOUNDS[site][1]+0.4)*framing.LANDMARK_SCALE;
    const p=new THREE.Vector3(x,y,z).applyMatrix4(matrix).project(camera);
    const px=(p.x+1)*width/2,py=(1-p.y)*height/2;
    const labelHalfWidth=width<=600?40:58;
    assert(px-labelHalfWidth>0&&px+labelHalfWidth<width&&py>24&&py<height-24, `${site}: label clipped at ${width}x${height}`);
  }
  const basis=new THREE.PerspectiveCamera();basis.position.set(...framing.CAMERA_POSITION);basis.lookAt(...framing.CAMERA_TARGET);
  const right=new THREE.Vector3(1,0,0).applyQuaternion(basis.quaternion),up=new THREE.Vector3(0,1,0).applyQuaternion(basis.quaternion);
  const offset=new THREE.Vector3(...frame.position).sub(new THREE.Vector3(...framing.CAMERA_TARGET));
  for(const x of [projectedBounds.min.x,projectedBounds.max.x])for(const y of [projectedBounds.min.y,projectedBounds.max.y]) {
    const px=(x*frame.scale+offset.dot(right))/(80*width/height)*width+width/2;
    const py=height/2-(y*frame.scale+offset.dot(up))/80*height;
    assert(px>=width*0.04&&px<=width*0.96&&py>=height*0.08&&py<=height*0.96,`Playable geometry clipped at ${width}x${height}`);
  }
  console.log(`PASS: full playable bounds and all labels inside ${width}x${height}, fixed camera size 40`);
}
