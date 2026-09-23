import * as THREE from "three";
import { ArchitectureBuilder, type Shape } from "./architecture";
import { LANDMARK_BOUNDS, LANDMARK_LABEL_LIFT, LANDMARK_SCALE, projectWorldPoint } from "./framing";
import { ROADS, SITES, WORLD_BOUNDS, roadHeight, shoreDistance, sitePosition, terrainHeight } from "./landscape";
import { makeSettlements, makeVegetation } from "./settlements";

// Match the primitive extents in Architecture.tsx, including non-unit rings/arches.
function shapeBox(shape:Shape) {
  if(shape==="ring")return new THREE.Box3(new THREE.Vector3(-1.05,-0.05,-1.05),new THREE.Vector3(1.05,0.05,1.05));
  if(shape==="arch")return new THREE.Box3(new THREE.Vector3(-0.5,0,0),new THREE.Vector3(0.5,1.05,0));
  if(shape==="hull")return new THREE.Box3(new THREE.Vector3(-0.8,-0.3,-0.8),new THREE.Vector3(0.8,0.4,0.8));
  return new THREE.Box3(new THREE.Vector3(-0.5,-0.5,-0.5),new THREE.Vector3(0.5,0.5,0.5));
}
export function architectureBounds(builder:ArchitectureBuilder,transform=new THREE.Matrix4()) {
  const box=new THREE.Box3();
  for(const batch of builder.batches.values())for(const piece of batch.pieces){
    box.union(shapeBox(batch.shape).applyMatrix4(transform.clone().multiply(piece.matrix)));
  }
  return box;
}
function corners(box:THREE.Box3) {
  const points:THREE.Vector3[]=[];
  for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z])points.push(new THREE.Vector3(x,y,z));
  return points;
}
let cached:THREE.Box2|undefined;
export function playableProjectionBounds() {
  if(cached)return cached;
  const bounds=new THREE.Box2();
  const add=(p:THREE.Vector3)=>bounds.expandByPoint(projectWorldPoint(p));
  // Sample the same terrain grid used for rendering, excluding the submerged seabed.
  for(let x=WORLD_BOUNDS.minX;x<=WORLD_BOUNDS.maxX;x+=0.5)for(let z=WORLD_BOUNDS.minZ;z<=WORLD_BOUNDS.maxZ;z+=0.5){
    const coast=shoreDistance(x,z);
    if(coast>=-0.5)add(new THREE.Vector3(x,Math.max(0,terrainHeight(x,z,coast)),z));
  }
  for(const road of ROADS)for(const p of road)add(new THREE.Vector3(p.x,roadHeight(p.x,p.z)+1,p.z));
  for(const site of Object.keys(SITES) as Array<keyof typeof SITES>){
    const builder=new ArchitectureBuilder();builder.landmark(site);
    const matrix=new THREE.Matrix4().makeTranslation(...sitePosition(site)).scale(new THREE.Vector3().setScalar(LANDMARK_SCALE));
    corners(architectureBounds(builder,matrix)).forEach(add);
    const label=new THREE.Vector3(0,LANDMARK_BOUNDS[site][1]+LANDMARK_LABEL_LIFT,0).applyMatrix4(matrix);
    add(label);
  }
  // Keep the actual decorative geometry in the envelope, without introducing
  // imaginary tall corners above the entire ocean rectangle.
  for(const builder of [makeSettlements(),makeVegetation()]) {
    for(const batch of builder.batches.values())for(const piece of batch.pieces)corners(shapeBox(batch.shape).applyMatrix4(piece.matrix)).forEach(add);
  }
  // One world-unit ocean border also absorbs sub-grid coastline differences.
  cached=bounds.expandByScalar(1);
  return cached;
}
