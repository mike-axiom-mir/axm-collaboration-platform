'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Planner = require('./deterministic-gameplay-trailer-planner-v1');
const Replay = require('../../tools/game-hub/game-library/020-four-roots-adventure/runtime/deterministic-journey');

let passed = 0;
function test(name, fn) {
  try { fn(); passed += 1; process.stdout.write('PASS ' + name + '\n'); }
  catch (error) { process.stderr.write('FAIL ' + name + ': ' + error.message + '\n'); throw error; }
}
function clone(value) { return JSON.parse(JSON.stringify(value)); }
function resign(value) { const core = Object.fromEntries(Object.entries(value).filter(([key]) => key !== 'requestDigest')); return { ...core, requestDigest: Planner.hashValue(core) }; }
function mutateRequest(mutation) { const value = clone(Planner.buildExampleRequest()); mutation(value); return resign(value); }

test('request, plan, replay schemas, and contract close object boundaries', () => {
  for (const name of ['gameplay-trailer-generation-request.schema.json', 'gameplay-trailer-plan.schema.json', 'four-roots-gameplay-replay.schema.json']) {
    const schema = JSON.parse(fs.readFileSync(path.join(__dirname, name), 'utf8'));
    assert.strictEqual(schema.additionalProperties, false);
    const walk = (node) => {
      if (!node || typeof node !== 'object') return;
      if (node.type === 'object' && node.properties) assert.strictEqual(node.additionalProperties, false, name + ' contains an open object');
      Object.values(node).forEach(walk);
    };
    walk(schema);
  }
  const contract = require('./module-deterministic-gameplay-trailer-planner-v1.contract.json');
  assert.strictEqual(contract.status, 'TEST');
  assert.deepStrictEqual(contract.permissions, []);
  assert.strictEqual(contract.boundaries.executes.length, 1);
  for (const refusal of ['uploaded-runtime-execution', 'generated-runtime-execution', 'arbitrary-command', 'network-use', 'browser-capture-claim', 'automatic-publication', 'automatic-canon']) assert(contract.boundaries.refuses.includes(refusal));
});

test('identical exact inputs produce byte-identical plans and replays', () => {
  const request = Planner.buildExampleRequest(), first = Planner.plan(request), second = Planner.plan(clone(request));
  assert.deepStrictEqual(first, second);
  assert.deepStrictEqual(Planner.verify(first, request), { pass: true, errors: [] });
  assert.strictEqual(first.replay.replayDigest, second.replay.replayDigest);
});

test('content, manifest, and exact native engine lineage are stable on Windows', () => {
  const source = Planner.loadSources();
  assert.strictEqual(Planner.hashBytes(source.contentBytes), Planner.CONTENT_REF.sha256);
  assert.strictEqual(Planner.hashBytes(source.manifestBytes), Planner.MANIFEST_REF.sha256);
  assert.strictEqual(Planner.hashBytes(source.engineBytes), Planner.ENGINE_REF.sha256);
  assert.strictEqual(source.contentBytes.length, Planner.CONTENT_REF.byteLength);
  assert.strictEqual(source.manifestBytes.length, Planner.MANIFEST_REF.byteLength);
  assert.strictEqual(source.engineBytes.length, Planner.ENGINE_REF.byteLength);
});

test('the plan binds the exact deterministic replay artifact', () => {
  const result = Planner.plan(Planner.buildExampleRequest()), source = Planner.loadSources();
  assert.strictEqual(result.plan.replayRef.sha256, Planner.hashBytes(Buffer.from(JSON.stringify(result.replay, null, 2) + '\n', 'utf8')));
  assert.notStrictEqual(result.plan.replayRef.sha256, result.replay.replayDigest, 'byte digest and semantic core digest must stay distinct');
  assert.strictEqual(result.plan.replayRef.byteLength, result.plan.resources.replayBytes);
  assert.strictEqual(Replay.verify(result.replay, source.content, Planner.CONTENT_REF.sha256).pass, true);
});

test('all nine claims bind to exact source or replay evidence', () => {
  const { plan } = Planner.plan(Planner.buildExampleRequest());
  assert.strictEqual(plan.claims.length, 9);
  assert(plan.claims.every((claim) => claim.status === 'PROVEN_FROM_EXACT_SOURCE' && claim.evidenceRefs.length > 0));
  assert(plan.claims.some((claim) => claim.id === 'deterministic-gameplay-replay' && claim.evidenceRefs.length === 3));
});

test('five gameplay scenes cite all 40 exact checkpoints and five zones', () => {
  const { plan, replay } = Planner.plan(Planner.buildExampleRequest());
  const gameplay = plan.scenes.filter((scene) => scene.visual.mode === 'gameplay-replay');
  assert.strictEqual(gameplay.length, 5);
  assert.strictEqual(gameplay.flatMap((scene) => scene.visual.checkpointIds).length, 40);
  assert.deepStrictEqual(Array.from(new Set(gameplay.flatMap((scene) => scene.visual.zoneIds))), ['crossroads', 'truth-hollow', 'agency-garden', 'continuity-archive', 'wisdom-grove']);
  assert.deepStrictEqual(gameplay.flatMap((scene) => scene.visual.checkpointIds), replay.checkpoints.map((entry) => entry.id));
});

test('timeline remains exact, silent, captioned, and bounded', () => {
  const { plan } = Planner.plan(Planner.buildExampleRequest());
  assert.strictEqual(plan.scenes.length, 6); assert.strictEqual(plan.captions.length, 6);
  assert.deepStrictEqual(plan.profile, {width:640,height:360,frameRate:12,durationSeconds:30,samples:360,uniqueFrames:48,formats:['video/mp4','video/webm'],audio:false,captions:true});
  plan.scenes.forEach((scene, index) => { assert.strictEqual(scene.startFrame, index * 60); assert.strictEqual(scene.endFrame, (index + 1) * 60); });
});

test('truth distinguishes reconstructed replay from capture, live input, and playability proof', () => {
  const { request, plan, replay } = Planner.plan(Planner.buildExampleRequest());
  assert.strictEqual(request.replayPolicy.browserCapture, false);
  assert.strictEqual(request.replayPolicy.livePlayerInput, false);
  assert.strictEqual(plan.truth.replayReconstructed, true);
  assert.strictEqual(plan.truth.nativeGameEngineExecuted, true);
  assert.strictEqual(plan.truth.browserCapture, false);
  assert.strictEqual(plan.truth.livePlayerInput, false);
  assert.strictEqual(plan.truth.playabilityProvenByTrailer, false);
  assert.strictEqual(replay.truth.browserCapture, false);
});

test('forged source digest and stale canonical request fail closed', () => {
  for (const field of ['gameContentRef', 'gameManifestRef', 'gameEngineRef']) assert.throws(() => Planner.plan(mutateRequest((value) => { value[field].sha256 = 'sha256:' + '0'.repeat(64); })), /source reference drift/);
  const stale = clone(Planner.buildExampleRequest()); stale.goal += ' changed';
  assert.throws(() => Planner.plan(stale), /request digest/);
});

test('replay capture, live-input, and budget expansion fail closed', () => {
  for (const mutation of [
    (value) => { value.replayPolicy.browserCapture = true; },
    (value) => { value.replayPolicy.livePlayerInput = true; },
    (value) => { value.replayPolicy.maxActions += 1; },
    (value) => { value.replayPolicy.maxCheckpoints += 1; }
  ]) assert.throws(() => Planner.plan(mutateRequest(mutation)), /replay policy drift/);
});

test('root HOLD, FAIL, order drift, and missing evidence fail closed', () => {
  for (const mutation of [
    (value) => { value.rootsGate[0].verdict = 'HOLD'; },
    (value) => { value.rootsGate[1].verdict = 'FAIL'; },
    (value) => { [value.rootsGate[0], value.rootsGate[1]] = [value.rootsGate[1], value.rootsGate[0]]; },
    (value) => { value.rootsGate[2].evidenceRefs = []; }
  ]) assert.throws(() => Planner.plan(mutateRequest(mutation)), /ROOTS_GATE_HOLD|root evidence/);
});

test('marketing inflation fails closed', () => {
  for (const mutation of [
    (value) => { value.marketingPolicy.fakeReviewQuotes = true; },
    (value) => { value.marketingPolicy.universalBest = true; },
    (value) => { value.marketingPolicy.publicAvailability = true; },
    (value) => { value.marketingPolicy.canon = true; }
  ]) assert.throws(() => Planner.plan(mutateRequest(mutation)), /marketing policy inflation/);
});

test('publication, identity, and authority escalation fail closed', () => {
  for (const mutation of [
    (value) => { value.hostDecision.publishAuthorized = true; },
    (value) => { value.hostDecision.authenticatedIdentityProven = true; },
    (value) => { value.authority = 'HOST'; }
  ]) assert.throws(() => Planner.plan(mutateRequest(mutation)), /host decision drift|identity or authority drift/);
});

test('resource expansion and rights drift fail closed', () => {
  for (const mutation of [
    (value) => { value.resources.maxChildProcesses = 1; },
    (value) => { value.resources.maxNetworkRequests = 1; },
    (value) => { value.resources.maxReplayBytes += 1; },
    (value) => { value.resources.maxFiles += 1; },
    (value) => { value.rights.publicDistribution = 'ALLOW'; }
  ]) assert.throws(() => Planner.plan(mutateRequest(mutation)), /resource envelope drift|rights drift/);
});

test('portable output paths reject Windows aliases and traversal', () => {
  for (const value of ['C:/trailer.mp4', '//server/share/trailer.mp4', 'media\\trailer.mp4', 'media/../trailer.mp4', 'media/CON/trailer.mp4', 'media/trailer.mp4:stream', 'media./trailer.mp4']) assert.throws(() => Planner.portablePath(value, 'path'), /portable relative path/);
  assert.strictEqual(Planner.portablePath('media/rendered/gameplay-replay.json', 'path'), 'media/rendered/gameplay-replay.json');
});

test('mutated plan or replay truth cannot verify against the exact request', () => {
  const request = Planner.buildExampleRequest(), result = Planner.plan(request);
  result.plan.truth.published = true;
  assert.strictEqual(Planner.verify(result, request).pass, false);
  const second = Planner.plan(request); second.replay.truth.browserCapture = true;
  assert.strictEqual(Planner.verify(second, request).pass, false);
});

process.stdout.write('Deterministic gameplay trailer planner selftest passed: ' + passed + ' cases.\n');
