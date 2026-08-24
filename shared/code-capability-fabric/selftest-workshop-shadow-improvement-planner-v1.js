'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Planner = require('./workshop-shadow-improvement-planner-v1');

let passed = 0;
function test(name, fn) {
  try { fn(); passed += 1; process.stdout.write('PASS ' + name + '\n'); }
  catch (error) { process.stderr.write('FAIL ' + name + ': ' + error.message + '\n'); throw error; }
}
function clone(value) { return JSON.parse(JSON.stringify(value)); }
function digest(label) { return Planner.hashValue(label); }
function summary(tools) {
  return { tools, contractsPresent: tools, contractsValid: tools, topLevelSelftests: tools, capabilities: tools * 2, readyForHumanReview: 0, blocked: 0, claimsNeedingReverification: 0 };
}
function snapshot(currentState = 'VALID') {
  const currentPresent = currentState !== 'MISSING';
  return Planner.sealSnapshot({
    schema: Planner.SNAPSHOT_SCHEMA, version: Planner.VERSION, status: 'TEST', id: 'shadow-fixture-snapshot', sourceLabel: 'current-workshop', evaluatedAt: '2026-08-23T03:00:00.000Z', scopeId: Planner.SCOPE_ID,
    inputRefs: [{ path: 'shared/readiness/promotion-ladder.json', sha256: digest('ladder'), byteLength: 80 }, { path: 'tools/alpha/manifest.json', sha256: digest('manifest'), byteLength: 120 }],
    currentIndex: { state: currentState, ref: currentPresent ? { path: 'tools-index.json', sha256: digest('old-index'), byteLength: 500 } : null, sourceDigest: currentState === 'VALID' ? '1'.repeat(64) : null, summary: currentState === 'VALID' ? summary(1) : null, toolIds: currentState === 'VALID' ? ['alpha'] : [] },
    rebuiltIndex: { state: 'VALID', ref: { path: 'tools-index.json', sha256: digest('new-index'), byteLength: 640 }, sourceDigest: '2'.repeat(64), summary: summary(2), toolIds: ['alpha', 'beta'] },
    resources: { inputFiles: 2, inputBytes: 200, enforced: true }, privacy: { rawSourceRetained: false, machinePathsRetained: false, secretsRead: false },
    truth: { sourceRead: true, sourceWritten: false, candidateExecuted: false, networkUsed: false, childProcessSpawned: false, installed: false, integrated: false, promoted: false, canonChanged: false }, authority: 'NONE'
  });
}
function request() { return Planner.buildExampleRequest(); }
function resignRequest(value) { const { requestDigest, ...core } = value; return Planner.sealRequest(core); }

test('request, snapshot, plan schemas, and contract close emitted object boundaries', () => {
  for (const name of ['workshop-shadow-refresh-request.schema.json', 'workshop-shadow-snapshot.schema.json', 'workshop-shadow-improvement-plan.schema.json']) {
    const schema = JSON.parse(fs.readFileSync(path.join(__dirname, name), 'utf8'));
    assert.strictEqual(schema.additionalProperties, false);
    const walk = (node) => {
      if (!node || typeof node !== 'object') return;
      if (node.type === 'object' && node.properties) assert.strictEqual(node.additionalProperties, false, name + ' contains an open object');
      Object.values(node).forEach(walk);
    };
    walk(schema);
  }
  const contract = require('./module-workshop-shadow-improvement-planner-v1.contract.json');
  assert.strictEqual(contract.status, 'TEST');
  assert.deepStrictEqual(contract.permissions, []);
  for (const refusal of ['source-writeback', 'candidate-execution', 'network-use', 'automatic-installation', 'automatic-canon']) assert(contract.boundaries.refuses.includes(refusal));
});

test('identical request and snapshot produce byte-identical plans', () => {
  const first = Planner.plan(request(), snapshot()), second = Planner.plan(clone(request()), clone(snapshot()));
  assert.deepStrictEqual(first, second);
  assert.deepStrictEqual(Planner.verify(first, request(), snapshot()), { pass: true, errors: [] });
});

test('stale, missing, and invalid indexes create one exact detached change', () => {
  const expected = { VALID: 'TOOLS_INDEX_SOURCE_DIGEST_STALE', MISSING: 'TOOLS_INDEX_MISSING', INVALID: 'TOOLS_INDEX_INVALID' };
  for (const state of Object.keys(expected)) {
    const result = Planner.plan(request(), snapshot(state)).plan;
    assert.strictEqual(result.status, 'DRAFT_PLANNED');
    assert.strictEqual(result.finding, expected[state]);
    assert.strictEqual(result.changes.length, 1);
    assert.strictEqual(result.changes[0].path, 'tools-index.json');
    assert.strictEqual(result.truth.draftDetached, true);
  }
});

test('a byte-current index creates no draft or output claim', () => {
  const value = snapshot();
  const current = clone(value.rebuiltIndex);
  current.ref = { path: 'tools-index.json', sha256: digest('current-index'), byteLength: 640 };
  const core = clone(value);
  delete core.sourceStateDigest; delete core.snapshotDigest;
  core.currentIndex = current;
  const sealed = Planner.sealSnapshot(core), plan = Planner.plan(request(), sealed).plan;
  assert.strictEqual(plan.status, 'CURRENT_NO_DRAFT');
  assert.strictEqual(plan.finding, 'NONE');
  assert.deepStrictEqual(plan.changes, []);
  assert.strictEqual(plan.resources.outputFiles, 0);
  assert.strictEqual(plan.truth.draftDetached, false);
});

test('four roots must pass in exact order with evidence', () => {
  for (const mutate of [
    (value) => { value.rootsGate[0].verdict = 'HOLD'; },
    (value) => { value.rootsGate[1].verdict = 'FAIL'; },
    (value) => { [value.rootsGate[0], value.rootsGate[1]] = [value.rootsGate[1], value.rootsGate[0]]; },
    (value) => { value.rootsGate[2].evidenceRefs = []; }
  ]) {
    const value = request(); mutate(value);
    assert.throws(() => Planner.plan(resignRequest(value), snapshot()), /ROOTS_GATE_HOLD|root evidence/);
  }
});

test('authority, lifecycle, resource, privacy, and recipe expansion fail closed', () => {
  for (const mutate of [
    (value) => { value.authorization.candidateExecution = true; },
    (value) => { value.authorization.sourceWriteBack = true; },
    (value) => { value.authorization.install = true; },
    (value) => { value.authorization.promote = true; },
    (value) => { value.resources.maxChildProcesses = 1; },
    (value) => { value.resources.maxNetworkRequests = 1; },
    (value) => { value.privacy.rawSourceRetention = true; },
    (value) => { value.recipe.id = 'run-arbitrary-improvement'; }
  ]) {
    const value = request(); mutate(value);
    assert.throws(() => resignRequest(value), /authorization drift|resource envelope drift|privacy scope drift|UNSUPPORTED_SHADOW_RECIPE/);
  }
});

test('forged or stale request and snapshot records fail closed', () => {
  const staleRequest = request(); staleRequest.sourceLabel = 'forged';
  assert.throws(() => Planner.plan(staleRequest, snapshot()), /request digest mismatch/);
  const forgedSnapshot = snapshot(); forgedSnapshot.inputRefs[0].sha256 = digest('forged');
  assert.throws(() => Planner.plan(request(), forgedSnapshot), /snapshot digest mismatch/);
  const context = clone(snapshot());
  const core = clone(context); delete core.sourceStateDigest; delete core.snapshotDigest; core.evaluatedAt = '2026-08-23T03:00:01.000Z';
  assert.throws(() => Planner.plan(request(), Planner.sealSnapshot(core)), /context drift/);
});

test('malformed observations, duplicates, and extra record fields are rejected', () => {
  for (const mutate of [
    (value) => { value.currentIndex.extra = true; },
    (value) => { value.currentIndex.state = 'MISSING'; },
    (value) => { value.currentIndex.summary.extra = 1; },
    (value) => { value.inputRefs.push(clone(value.inputRefs[0])); },
    (value) => { value.rebuiltIndex.toolIds = ['beta', 'alpha']; }
  ]) {
    const value = snapshot(); const core = clone(value); delete core.sourceStateDigest; delete core.snapshotDigest; mutate(core);
    assert.throws(() => Planner.sealSnapshot(core), /closed|reference state mismatch|unique and canonical|toolIds are not canonical/);
  }
});

test('portable paths reject Windows aliases, reserved names, ADS, and traversal', () => {
  for (const value of ['C:/tools-index.json', '//server/share/tools-index.json', 'tools\\index.json', '../tools-index.json', 'aux.json', 'tools-index.json:stream', 'folder./index.json', 'folder /index.json']) assert.throws(() => Planner.portablePath(value, 'path'), /portable relative path/);
  assert.strictEqual(Planner.portablePath('tools-index.json', 'path'), 'tools-index.json');
});

test('source and output digests bind lineage while plans retain zero authority', () => {
  const result = Planner.plan(request(), snapshot());
  assert.strictEqual(result.plan.snapshotRef.sha256, result.snapshot.snapshotDigest);
  assert.strictEqual(result.plan.changes[0].replacementSha256, result.snapshot.rebuiltIndex.ref.sha256);
  assert.deepStrictEqual(result.plan.resources, { inputFiles: 2, inputBytes: 200, outputFiles: 1, outputBytes: 640, networkRequests: 0, childProcesses: 0, enforced: true });
  assert.strictEqual(result.plan.authority, 'NONE');
  assert(Object.entries(result.plan.truth).filter(([key]) => key !== 'deterministicPlan' && key !== 'sourceCurrentAtPlanning' && key !== 'draftDetached').every(([, value]) => value === false));
});

test('mutated plan cannot verify against exact inputs', () => {
  const req = request(), snap = snapshot(), result = Planner.plan(req, snap);
  result.plan.truth.installed = true;
  assert.strictEqual(Planner.verify(result, req, snap).pass, false);
});

process.stdout.write('Workshop shadow improvement planner selftest passed: ' + passed + ' cases.\n');
