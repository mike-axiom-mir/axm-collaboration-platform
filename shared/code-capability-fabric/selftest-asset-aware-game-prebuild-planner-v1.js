'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Planner = require('./asset-aware-game-prebuild-planner-v1');
const Generator = require('./deterministic-game-candidate-generator-v1');

let passed = 0;
function test(name, fn) {
  try { fn(); passed += 1; process.stdout.write('PASS ' + name + '\n'); }
  catch (error) { process.stderr.write('FAIL ' + name + ': ' + error.message + '\n'); throw error; }
}
function clone(value) { return JSON.parse(JSON.stringify(value)); }
function assertClosedObjects(schema, label, pointer = '#') {
  if (!schema || typeof schema !== 'object' || Array.isArray(schema)) return;
  if (schema.type === 'object') assert.strictEqual(schema.additionalProperties, false, label + ' leaves object open at ' + pointer);
  for (const [key, value] of Object.entries(schema)) {
    if (key === 'examples' || key === 'default') continue;
    if (Array.isArray(value)) value.forEach((item, index) => assertClosedObjects(item, label, pointer + '/' + key + '/' + index));
    else assertClosedObjects(value, label, pointer + '/' + key);
  }
}

const brief = Generator.buildCoopExampleRequest().brief;
const snapshot = Planner.buildCapabilitySnapshot();
const plan = Planner.buildPrebuildPlan(brief, snapshot);

test('snapshot is deterministic and binds the exact Asset Factory declarations', () => {
  assert.deepStrictEqual(snapshot, Planner.buildCapabilitySnapshot());
  assert.strictEqual(snapshot.observed.assetHands.id, 'asset-hands');
  assert.strictEqual(snapshot.observed.assetFabric.id, 'asset-fabric');
  assert.strictEqual(snapshot.observed.visualCatalog.declaredDigest, 'sha256:413853e116023c991509d97f22e1f29f56e9537ca88286c9f38517755b79a121');
  assert.deepStrictEqual(snapshot.catalogInventory, {
    builtInHandsDeclared: 46,
    serviceCapabilitiesDeclared: 105,
    assetFabricCapabilitiesDeclared: 37,
    visualAdaptersDeclared: 30,
    aetherFxModulesDeclared: 64,
    pbrMaterialFamiliesDeclared: 6,
    portableEffectsDeclared: 15,
    stylePresetsDeclared: 25,
    treatmentMoldsDeclared: 3
  });
});

test('snapshot exposes only declared hands and never claims artifact production', () => {
  assert.deepStrictEqual(snapshot.declaredHands.map((item) => item.id), Planner.RELEVANT_HANDS.map((item) => item.id).sort());
  assert(snapshot.declaredHands.every((item) => item.availability === 'DECLARED_BUILT_IN' && item.artifactProduced === false));
  assert.strictEqual(snapshot.truth.artifactBytesProduced, false);
  assert.strictEqual(snapshot.truth.providerCodeLoaded, false);
});

test('prebuild plan selects exact catalog style, treatment, and portable effects', () => {
  assert.strictEqual(plan.visualSystem.stylePresetId, 'arcade-neon-circuit');
  assert.strictEqual(plan.visualSystem.treatmentId, 'aetherglass-cinematic');
  assert.deepStrictEqual(plan.visualSystem.effectIds, Planner.EFFECT_IDS.slice().sort());
  assert.strictEqual(plan.visualSystem.minimumTextContrast, 4.5);
  assert.strictEqual(plan.visualSystem.reducedMotionFallback, true);
});

test('known tunnelling repair is applied before candidate bytes', () => {
  const repair = plan.repairs.find((item) => item.id === 'projectile-spawn-and-swept-collision-v1');
  assert(repair);
  assert.strictEqual(repair.state, 'APPLIED_BEFORE_BUILD');
  assert.strictEqual(repair.evidence.sha256, Planner.PRIOR_EVIDENCE.sha256);
  assert.strictEqual(plan.truth.builtBeforeCandidateBytes, true);
});

test('asset routes preserve declaration versus artifact truth', () => {
  assert(plan.assetRoutes.some((item) => item.handId === 'pixel-sprite'));
  assert(plan.assetRoutes.some((item) => item.handId === 'portable-visual-fx'));
  assert(plan.assetRoutes.every((item) => item.state === 'PLANNED_FROM_DECLARATION' && item.artifactProduced === false));
  assert.strictEqual(plan.truth.assetProviderExecuted, false);
  assert.strictEqual(plan.truth.assetArtifactsProduced, false);
});

test('forged or stale capability observations fail closed', () => {
  const forged = clone(snapshot);
  forged.declaredHands.pop();
  assert.throws(() => Planner.normalizeSnapshot(forged), /digest mismatch/);
  const resealed = clone(forged);
  delete resealed.snapshotDigest;
  resealed.snapshotDigest = Planner.hashValue(resealed);
  assert.throws(() => Planner.normalizeSnapshot(resealed), /differs from the approved/);
});

test('prebuild planning refuses recipe ambiguity', () => {
  assert.throws(() => Planner.buildPrebuildPlan({ ...brief, recipeId: 'unknown-game' }, snapshot), /exact Twin Reactor/);
});

test('plan rebuild verifies byte-identically', () => {
  assert.strictEqual(Planner.verifyPlan(plan, brief, snapshot).pass, true);
  const changed = clone(plan); changed.visualSystem.palette.p1 = '#ffffff';
  assert.strictEqual(Planner.verifyPlan(changed, brief, snapshot).pass, false);
});

test('planner loads catalog data and no Asset Hands provider runtime', () => {
  const source = fs.readFileSync(path.join(__dirname, 'asset-aware-game-prebuild-planner-v1.js'), 'utf8');
  assert.strictEqual(/require\(['"]\.\.\/asset-hands\/asset-hands['"]\)/.test(source), false);
  assert.strictEqual(/child_process|process\.env|\bfetch\s*\(|WebSocket|XMLHttpRequest/.test(source), false);
});

test('snapshot and prebuild schemas close every declared object boundary', () => {
  const snapshotSchema = JSON.parse(fs.readFileSync(path.join(__dirname, 'asset-factory-capability-snapshot.schema.json'), 'utf8'));
  const planSchema = JSON.parse(fs.readFileSync(path.join(__dirname, 'game-prebuild-plan.schema.json'), 'utf8'));
  assertClosedObjects(snapshotSchema, 'snapshot schema');
  assertClosedObjects(planSchema, 'prebuild schema');
});

test('resealed malformed records still fail deterministic emitted-record validation', () => {
  const malformedSnapshot = clone(snapshot);
  malformedSnapshot.truth.unexpected = true;
  delete malformedSnapshot.snapshotDigest;
  malformedSnapshot.snapshotDigest = Planner.hashValue(malformedSnapshot);
  assert.throws(() => Planner.normalizeSnapshot(malformedSnapshot), /differs from the approved/);
  const malformedPlan = clone(plan);
  malformedPlan.repairs[0].state = 'PLANNED_ONLY';
  delete malformedPlan.planDigest;
  malformedPlan.planDigest = Planner.hashValue(malformedPlan);
  assert.strictEqual(Planner.verifyPlan(malformedPlan, brief, snapshot).pass, false);
});

process.stdout.write('PASS asset-aware game prebuild planner (' + passed + ' cases)\n');
