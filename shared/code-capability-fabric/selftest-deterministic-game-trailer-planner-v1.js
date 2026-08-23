'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Planner = require('./deterministic-game-trailer-planner-v1');

let passed = 0;
function test(name, fn) {
  try { fn(); passed += 1; process.stdout.write('PASS ' + name + '\n'); }
  catch (error) { process.stderr.write('FAIL ' + name + ': ' + error.message + '\n'); throw error; }
}
function clone(value) { return JSON.parse(JSON.stringify(value)); }
function resign(value) {
  const core = Object.fromEntries(Object.entries(value).filter(([key]) => key !== 'requestDigest'));
  return { ...core, requestDigest: Planner.hashValue(core) };
}
function mutateRequest(mutation) { const value = clone(Planner.buildExampleRequest()); mutation(value); return resign(value); }

test('request, plan schemas, and contract close every emitted object boundary', () => {
  for (const name of ['game-trailer-generation-request.schema.json', 'game-trailer-plan.schema.json']) {
    const schema = JSON.parse(fs.readFileSync(path.join(__dirname, name), 'utf8'));
    assert.strictEqual(schema.additionalProperties, false);
    const walk = (node) => {
      if (!node || typeof node !== 'object') return;
      if (node.type === 'object' && node.properties) assert.strictEqual(node.additionalProperties, false, name + ' contains an open object');
      Object.values(node).forEach(walk);
    };
    walk(schema);
  }
  const contract = require('./module-deterministic-game-trailer-planner-v1.contract.json');
  assert.strictEqual(contract.status, 'TEST');
  assert.deepStrictEqual(contract.permissions, []);
  for (const refusal of ['runtime-execution', 'workspace-write', 'network-use', 'automatic-publication', 'automatic-canon']) assert(contract.boundaries.refuses.includes(refusal));
});

test('identical exact inputs produce byte-identical plans', () => {
  const request = Planner.buildExampleRequest();
  const first = Planner.plan(request), second = Planner.plan(clone(request));
  assert.deepStrictEqual(first, second);
  assert.deepStrictEqual(Planner.verify(first, request), { pass: true, errors: [] });
});

test('source lineage is stable in a Windows checkout', () => {
  const sources = Planner.loadSources();
  assert.strictEqual(Planner.hashBytes(sources.contentBytes), Planner.CONTENT_REF.sha256);
  assert.strictEqual(sources.contentBytes.length, Planner.CONTENT_REF.byteLength);
  assert.strictEqual(Planner.hashBytes(sources.manifestBytes), Planner.MANIFEST_REF.sha256);
  assert.strictEqual(sources.manifestBytes.length, Planner.MANIFEST_REF.byteLength);
});

test('all marketing claims bind to exact source evidence', () => {
  const { plan } = Planner.plan(Planner.buildExampleRequest());
  assert.strictEqual(plan.claims.length, 8);
  assert(plan.claims.every((claim) => claim.status === 'PROVEN_FROM_EXACT_SOURCE' && claim.evidenceRefs.length > 0));
  assert.deepStrictEqual(plan.claims.map((claim) => claim.id), ['local-test-adventure','five-connected-zones','six-quests','ten-discoveries','four-ordered-roots','keyboard-pointer-controls','server-resume','offline-native']);
});

test('timeline is exact, silent, captioned, and bounded', () => {
  const { plan } = Planner.plan(Planner.buildExampleRequest());
  assert.strictEqual(plan.scenes.length, 6);
  assert.strictEqual(plan.captions.length, 6);
  assert.deepStrictEqual(plan.profile, {width:640,height:360,frameRate:12,durationSeconds:30,samples:360,uniqueFrames:48,formats:['video/mp4','video/webm'],audio:false,captions:true});
  plan.scenes.forEach((scene, index) => { assert.strictEqual(scene.index, index); assert.strictEqual(scene.startFrame, index * 60); assert.strictEqual(scene.endFrame, (index + 1) * 60); });
});

test('plan has no execution, publishing, promotion, or CANON authority', () => {
  const { request, plan } = Planner.plan(Planner.buildExampleRequest());
  assert.strictEqual(request.authority, 'NONE');
  assert.strictEqual(request.hostDecision.publishAuthorized, false);
  assert.strictEqual(plan.authority, 'NONE');
  assert.strictEqual(plan.rights.publicDistribution, 'HOLD');
  assert.deepStrictEqual(plan.truth, {deterministicPlan:true,claimsEvidenceBound:true,providerCalled:false,aiUsed:false,gameRuntimeExecuted:false,videoRendered:false,playabilityProvenByTrailer:false,published:false,canonChanged:false});
});

test('forged source digest and stale canonical request fail closed', () => {
  assert.throws(() => Planner.plan(mutateRequest((value) => { value.gameContentRef.sha256 = 'sha256:' + '0'.repeat(64); })), /source reference drift/);
  const stale = clone(Planner.buildExampleRequest()); stale.goal += ' changed';
  assert.throws(() => Planner.plan(stale), /request digest/);
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
    (value) => { value.resources.maxUniqueFrameBytes += 4; },
    (value) => { value.resources.maxEncodedOutputBytes += 1; },
    (value) => { value.rights.publicDistribution = 'ALLOW'; }
  ]) assert.throws(() => Planner.plan(mutateRequest(mutation)), /resource envelope drift|rights drift/);
});

test('portable output paths reject Windows aliases and traversal', () => {
  for (const value of ['C:/trailer.mp4','//server/share/trailer.mp4','media\\trailer.mp4','media/../trailer.mp4','media/CON/trailer.mp4','media/trailer.mp4:stream','media./trailer.mp4']) assert.throws(() => Planner.portablePath(value, 'path'), /portable relative path/);
  assert.strictEqual(Planner.portablePath('media/rendered/trailer.webm', 'path'), 'media/rendered/trailer.webm');
});

test('mutated plan truth cannot verify against the exact request', () => {
  const request = Planner.buildExampleRequest(), result = Planner.plan(request);
  result.plan.truth.published = true;
  assert.strictEqual(Planner.verify(result, request).pass, false);
});

process.stdout.write('Deterministic game trailer planner selftest passed: ' + passed + ' cases.\n');
