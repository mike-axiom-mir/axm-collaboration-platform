'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Director = require('./game-experience-director-v1');
const Generator = require('./deterministic-game-candidate-generator-v1');
const Prebuild = require('./asset-aware-game-prebuild-planner-v1');

let passed = 0;
function test(name, fn) {
  try { fn(); passed += 1; process.stdout.write('PASS ' + name + '\n'); }
  catch (error) { process.stderr.write('FAIL ' + name + ': ' + error.message + '\n'); throw error; }
}
function clone(value) { return JSON.parse(JSON.stringify(value)); }
function input() { const request = Generator.buildCoopExampleRequest(); return { brief: request.brief, prebuild: Prebuild.buildPrebuildPlan(request.brief, Prebuild.buildCapabilitySnapshot()) }; }

test('closed schema and deterministic plan stay byte stable', () => {
  const schema = JSON.parse(fs.readFileSync(path.join(__dirname, 'game-experience-flow-plan.schema.json'), 'utf8'));
  assert.strictEqual(schema.$id, Director.PLAN_SCHEMA);
  assert.strictEqual(schema.additionalProperties, false);
  const current = input();
  const left = Director.buildPlan(current.brief, current.prebuild);
  const right = Director.buildPlan(clone(current.brief), clone(current.prebuild));
  assert.deepStrictEqual(left, right);
  assert.strictEqual(Director.verifyPlan(left, current.brief, current.prebuild).pass, true);
});

test('flow defines a complete game-first scene set without hiding truth', () => {
  const current = input(); const plan = Director.buildPlan(current.brief, current.prebuild);
  assert.deepStrictEqual(plan.scenes.map((item) => item.id), Director.SCENE_IDS);
  assert.strictEqual(plan.intent.mode, 'GAME_FIRST_STAGED_DISCLOSURE');
  assert.strictEqual(plan.disclosure.reviewSurface, 'COLLAPSIBLE_REVIEW_DRAWER');
  assert.strictEqual(plan.disclosure.mayHideTruth, false);
  assert(plan.disclosure.onDemand.includes('authority-boundary'));
  assert(plan.disclosure.onDemand.includes('asset-capability-lineage'));
});

test('transitions retain both shared outcomes and human lifecycle control', () => {
  const current = input(); const plan = Director.buildPlan(current.brief, current.prebuild);
  const transitions = plan.transitions.map((item) => item.event + ':' + item.to);
  for (const expected of ['START:MISSION_INTRO', 'PAUSE:PAUSED', 'RESUME:ACTIVE_PLAY', 'SHARED_VICTORY:VICTORY', 'SHARED_DEFEAT:DEFEAT', 'RESTART:LOBBY']) assert(transitions.includes(expected));
  assert.strictEqual(plan.timing.clock, 'DETERMINISTIC_ENGINE_TICKS');
  assert.strictEqual(plan.timing.wallClockProof, false);
});

test('planner grants no provider, write, install, or canon authority', () => {
  const current = input(); const plan = Director.buildPlan(current.brief, current.prebuild);
  assert.deepStrictEqual(plan.boundaries.permissions, []);
  assert.deepStrictEqual(plan.boundaries.networkDomains, []);
  assert.deepStrictEqual(plan.boundaries.writes, []);
  assert.strictEqual(plan.boundaries.providerCalls, false);
  assert.strictEqual(plan.boundaries.executesAssetHands, false);
  assert.strictEqual(plan.boundaries.installs, false);
  assert.strictEqual(plan.boundaries.canonizes, false);
  assert.strictEqual(plan.authority, 'NONE');
});

test('stale or forged source lineage cannot verify', () => {
  const current = input(); const plan = Director.buildPlan(current.brief, current.prebuild);
  const forged = clone(plan); forged.sourceRefs.prebuildPlan.sha256 = Director.hashValue('forged');
  assert.strictEqual(Director.verifyPlan(forged, current.brief, current.prebuild).pass, false);
  const stale = clone(current.prebuild); stale.planDigest = Director.hashValue('stale');
  assert.strictEqual(Director.verifyPlan(plan, current.brief, stale).pass, false);
});

process.stdout.write('PASS game experience director (' + passed + ' cases)\n');
