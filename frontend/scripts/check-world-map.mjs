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
const { ArchitectureBuilder } = load('../lib/worldMap/architecture.ts');
const { makeSettlements, makeVegetation } = load('../lib/worldMap/settlements.ts');
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
  assert(world.terrainHeight(x, z) > 1.2 && world.terrainHeight(x, z) < 1.5, `${key}: level foundation`);
  assert(world.roadDistance(x, z) < 5, `${key}: road access`);
  const builder = new ArchitectureBuilder();
  builder.landmark(key);
  assert(checkBatch(builder) > 30, `${key}: missing architectural detail`);
}
for (const [name, island] of Object.entries(world.ISLANDS)) {
  assert(world.shoreDistance(island.x, island.z) > Math.min(3, Math.min(island.rx, island.rz) * 0.5), `${name}: missing island interior`);
}
assert(world.BRIDGES.length === 4, 'Archipelago must retain its four functional bridges');
for (const [x, z] of [[-54, -36], [54, -28], [58, 31], [-36, -70]]) assert(world.shoreDistance(x, z) < 0, 'Missing navigable ocean channel');
for (const road of world.ROADS) for (const point of road) {
  if (world.shoreDistance(point.x, point.z) < 0) assert(world.bridgeDistance(point.x, point.z) < 1.6, `Road crossed open water without a bridge at ${point.x.toFixed(1)}, ${point.z.toFixed(1)}`);
  assert(world.roadHeight(point.x, point.z) > 0.1, 'Road entered the tide line');
}
for (const path of world.RIVER_PATHS) for (const [x, z] of path) assert(world.terrainHeight(x, z) < 0.5, 'River was not carved into the terrain');
for (const lake of world.LAKES) assert(world.terrainHeight(lake.x, lake.z) < 0.2, 'Lake was not carved into the terrain');
for (const [name, builder] of [['settlements', makeSettlements()], ['forest', makeVegetation()], ['background', makeVegetation(true)]]) {
  const count = checkBatch(builder);
  assert(builder.batches.size < 40, 'Excessive environmental draw batches');
  console.log(`${name}: ${count} instances in ${builder.batches.size} batches`);
}
console.log('PASS: island foundations, bridge-only water crossings, carved rivers and lakes, and valid batched geometry.');
