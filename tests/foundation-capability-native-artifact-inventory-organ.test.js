'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const test = require('node:test');
const assert = require('node:assert/strict');
const Observatory = require('../organs/foundation-development-observatory-organ');
const Executor = require('../organs/foundation-development-observation-executor-organ');
const Router = require('../organs/foundation-development-frontier-router-organ');
const HandPlanner = require('../organs/foundation-development-hand-planner-organ');
const Survey = require('../organs/foundation-development-capability-survey-organ');
const OutputAdapterPlanner = require('../organs/foundation-development-capability-output-adapter-planner-organ');
const Inventory = require('../organs/foundation-capability-native-artifact-inventory-organ');

const ROOT = path.resolve(__dirname, '..');
const POLICY = JSON.parse(fs.readFileSync(path.join(ROOT, 'training', 'TRAINING_POLICY.json'), 'utf8'));
const REASONING_CANARIES = [
  'source-family-isolation', 'held-out-frozen', 'model-authority-closed', 'challenger-session-authority-closed',
  'independent-reasoning-seams-clean', 'adversarial-transfer', 'candidate-origination-transfer',
  'candidate-origin-authority-closed', 'ordered-strategy-composition', 'underspecified-candidate-origin-holds',
  'experience-self-training-closed', 'experience-remains-episodic', 'synthetic-counterexample-lineage', 'known-failed-experience-excluded'
];

function clone(value) { return JSON.parse(JSON.stringify(value)); }
function fixtureEvidence() {
  return {
    sourceMode: 'SYNTHETIC_OBSERVATORY_FIXTURE',
    subject: { identity: 'axm.machine.mirror/seed-0', files: [], digest: 'a'.repeat(64) },
    bodyIntegrity: { state: 'PASS_BOUNDED_PUBLIC_BODY_STRUCTURAL_INTEGRITY', digest: '9'.repeat(64), source: { inventoryDigest: 'a'.repeat(64) }, summary: { javascriptSyntaxChecked: 4, jsonParsed: 4, activeOrgansChecked: 1, activeOrgansWithTestReachability: 1, holds: 0, sourceExecutions: 0 } },
    foundationCanaries: Observatory.runFrozenFoundationCanaries(),
    reasoning: {
      cycleId: 'reasoning-skill-artifactinventoryfixture', cycleSha256: 'b'.repeat(64), seamReportSha256: 'c'.repeat(64), seamOpen: 0,
      promotionState: 'PROPOSE_HUMAN_REVIEW', runtimePointerChanged: false,
      canaries: REASONING_CANARIES.map(id => ({ id, status: 'PASS', evidence: 'synthetic native-artifact inventory fixture' })),
      heldOutAccuracy: 1, candidateFreeAccuracy: 1, adversarialPassed: 8, adversarialCases: 8, negativeExperiences: 0, knownFailReceiptsPreserved: 7
    },
    workshop: {
      auditSha256: 'd'.repeat(64), privateReportId: 'fixture', privateReportSha256: 'e'.repeat(64), sourceInventoryStillSettled: true,
      wholeWorkshopJsonInventoryStillSettled: false, wholeWorkshopJsonScopeIncludesMutableOperationalState: true,
      eligibleContracts: 49, boundaryMismatches: 0, heldOutPassed: 9, heldOutFailed: 0, splitLeakage: false,
      manifestBoundRoutes: 38, routeSelectionMismatches: 0, missingProbeHands: 6, providerDeclarationGaps: 1,
      workShopFilesChanged: 0, runtimePointerChanged: false, worldActions: 0
    },
    language: {
      auditSha256: '1'.repeat(64), modelDigest: '2'.repeat(64), batchDigest: '3'.repeat(64), realLocalGroups: 7,
      accepted: 7, fallback: 0, planContradictions: 0, proseDecoyPasses: 7, proseDecoyFailures: 0, runtimeActive: false
    },
    independent: { exams: 0, fullPasses: 0, insufficientCoverage: 0, drift: 0, examDigests: [], independenceProven: false }
  };
}

function makeFixture(t) {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'axm-foundation-native-artifacts-'));
  t.after(() => fs.rmSync(base, { recursive: true, force: true }));
  const dirs = {
    observatoryStateDir: path.join(base, 'observations'), requestStateDir: path.join(base, 'requests'),
    executorStateDir: path.join(base, 'executions'), frontierStateDir: path.join(base, 'frontier'),
    handStateDir: path.join(base, 'hands'), surveyStateDir: path.join(base, 'surveys'),
    stateDir: path.join(base, 'adapter-requests')
  };
  const execution = Executor.run(Object.assign({ policy: POLICY, evidence: fixtureEvidence(), allowSyntheticFixture: true }, dirs));
  const frontier = Router.run({ policy: POLICY, snapshot: execution.snapshot, receipt: execution.receipt, observatoryStateDir: dirs.observatoryStateDir, stateDir: dirs.frontierStateDir });
  const hands = HandPlanner.run({ policy: POLICY, frontierBatch: frontier.batch, stateDir: dirs.handStateDir });
  const capabilityInventory = Survey.collectInventory();
  const survey = Survey.run({ policy: POLICY, handBatch: hands.batch, inventory: capabilityInventory, stateDir: dirs.surveyStateDir });
  const adapters = OutputAdapterPlanner.run({ policy: POLICY, handBatch: hands.batch, surveyBatch: survey.batch, inventory: capabilityInventory, stateDir: dirs.stateDir });
  const declarations = Inventory.collectInventoryDeclarations({ root: ROOT }, capabilityInventory);
  return { base, adapterRequestBatch: adapters.batch, capabilityInventory, declarations };
}

function receiptPath(root, hex) {
  return path.join(root, 'training', 'datasets', 'reasoning-receipts', `reasoning-experience-${hex.repeat(24)}.json`);
}
function writeText(file, text) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text);
}
function writeJson(file, value) { writeText(file, JSON.stringify(value, null, 2) + '\n'); }
function reseal(declaration) {
  const sealed = clone(declaration);
  sealed.inventoryDeclarationId = null;
  sealed.inventoryDeclarationDigest = null;
  sealed.inventoryDeclarationId = `foundation-capability-native-artifact-inventory-${Inventory.digest(sealed).slice(0, 24)}`;
  sealed.inventoryDeclarationDigest = Inventory.digest(Object.assign({}, sealed, { inventoryDeclarationDigest: null }));
  return sealed;
}
function record(declaration, label) {
  return {
    path: `capabilities/${label}.artifact-inventory.json`, bytes: JSON.stringify(declaration).length,
    sha256: Inventory.digest(JSON.stringify(declaration)), status: 'VERIFIED_INVENTORY_DECLARATION', issue: null, declaration
  };
}

test('declaration-driven inventory separates compatible root witnesses, old schemas, and absent roots', t => {
  const fixture = makeFixture(t);
  const artifactRoot = path.join(fixture.base, 'artifact-root');
  writeJson(receiptPath(artifactRoot, 'a'), { schema: 'axm.mirror.reasoning-experience-receipt/v4', prototype: { boundary: 'public machine trace' }, state: 'KNOWN_FAIL' });
  writeJson(receiptPath(artifactRoot, 'b'), { schema: 'axm.mirror.reasoning-experience-receipt/v3', state: 'KNOWN_FAIL' });
  writeText(receiptPath(artifactRoot, 'c'), '{ invalid json');
  writeJson(path.join(artifactRoot, 'training', 'datasets', 'reasoning-receipts', 'ignored.json'), { schema: 'axm.mirror.reasoning-experience-receipt/v4' });

  const batch = Inventory.buildBatch(fixture.adapterRequestBatch, fixture.capabilityInventory, fixture.declarations, { root: artifactRoot });
  Inventory.verifyBatch(batch);
  assert.equal(batch.summary.nativeArtifactRootSchemaWitnesses, 1);
  assert.equal(batch.summary.genericEnvelopeCompatibleWitnesses, 1);
  assert.equal(batch.summary.genericEnvelopeBoundaryRefusals, 0);
  assert.equal(batch.summary.refusedArtifactFiles, 5);
  assert.equal(batch.summary.optionalRootsAbsent, 1);
  assert.equal(batch.summary.artifactSelections, 0);
  assert.equal(batch.summary.permissionEvaluations, 0);
  assert.equal(batch.summary.evidenceAdmissions, 0);
  const witness = batch.results.flatMap(result => result.artifacts)[0];
  assert.equal(witness.state, 'NATIVE_ARTIFACT_ROOT_SCHEMA_AND_CONTENT_SEAL_WITNESS_NOT_PERMISSION_OR_EVIDENCE');
  assert.equal(witness.genericEnvelopeBoundaryState, null);
  assert.match(witness.artifactDigest, /^[a-f0-9]{64}$/);
  assert.equal(witness.permissionState, 'NOT_EVALUATED');
  assert.equal(Object.prototype.hasOwnProperty.call(witness, 'artifact'), false);
});

test('inventory order and artifact order do not select a source or change the sealed result', t => {
  const fixture = makeFixture(t);
  const artifactRoot = path.join(fixture.base, 'order-root');
  writeJson(receiptPath(artifactRoot, 'f'), { schema: 'axm.mirror.reasoning-experience-receipt/v4', value: 2 });
  writeJson(receiptPath(artifactRoot, 'e'), { schema: 'axm.mirror.reasoning-experience-receipt/v4', value: 1 });
  const forward = Inventory.buildBatch(fixture.adapterRequestBatch, fixture.capabilityInventory, fixture.declarations, { root: artifactRoot });
  const reverse = Inventory.buildBatch(fixture.adapterRequestBatch, fixture.capabilityInventory, fixture.declarations.slice().reverse(), { root: artifactRoot });
  assert.equal(forward.batchDigest, reverse.batchDigest);
  assert.equal(forward.summary.nativeArtifactRootSchemaWitnesses, 2);
  assert.equal(forward.summary.genericEnvelopeCompatibleWitnesses, 2);
  assert.ok(forward.results.flatMap(result => result.artifacts).every(artifact => artifact.artifactSelected === false));
  assert.deepEqual(forward.results.flatMap(result => result.artifacts).map(artifact => artifact.path), forward.results.flatMap(result => result.artifacts).map(artifact => artifact.path).slice().sort());
});

test('path escape, ambiguity, file-size, file-count, and root-symlink boundaries hold explicitly', t => {
  const fixture = makeFixture(t);
  const reasoning = fixture.declarations.find(item => item.declaration.source.nativeOutputKind === 'axm.mirror.reasoning-experience-receipt/v4').declaration;
  const escaped = clone(reasoning);
  escaped.search.roots[0].path = '../outside';
  assert.throws(() => Inventory.validateInventoryDeclaration(reseal(escaped), fixture.capabilityInventory), /root path changed/);

  const second = clone(reasoning);
  second.search.roots[0].path = 'training/datasets/other-reasoning-receipts';
  const ambiguous = fixture.declarations.concat(record(reseal(second), 'other-reasoning'));
  const ambiguousBatch = Inventory.buildBatch(fixture.adapterRequestBatch, fixture.capabilityInventory, ambiguous, { root: fixture.base });
  const ambiguousResult = ambiguousBatch.results.find(result => result.nativeOutputKind === reasoning.source.nativeOutputKind);
  assert.equal(ambiguousResult.state, 'HOLD_AMBIGUOUS_NATIVE_ARTIFACT_INVENTORY_DECLARATIONS');
  assert.equal(ambiguousResult.artifacts.length, 0);

  const bounded = clone(reasoning);
  bounded.search.maximumFileBytes = 32;
  bounded.search.maximumFiles = 1;
  const boundedRoot = path.join(fixture.base, 'bounded-root');
  writeJson(receiptPath(boundedRoot, '1'), { schema: reasoning.search.requiredRootSchema, padding: 'x'.repeat(80) });
  writeJson(receiptPath(boundedRoot, '2'), { schema: reasoning.search.requiredRootSchema, padding: 'y'.repeat(80) });
  const countHold = Inventory.scanDeclaredRoot(bounded.search.roots[0], reseal(bounded).search, { root: boundedRoot });
  assert.equal(countHold.root.state, 'HOLD_MATCHING_FILE_LIMIT_EXCEEDED');
  fs.rmSync(receiptPath(boundedRoot, '2'));
  const sizeHold = Inventory.scanDeclaredRoot(bounded.search.roots[0], reseal(bounded).search, { root: boundedRoot });
  assert.equal(sizeHold.refusals[0].state, 'REFUSED_FILE_SIZE_LIMIT');

  const linkRoot = path.join(fixture.base, 'link-root');
  const outside = path.join(fixture.base, 'outside-real-root');
  fs.mkdirSync(outside, { recursive: true });
  const declared = path.join(linkRoot, 'training', 'datasets', 'reasoning-receipts');
  fs.mkdirSync(path.dirname(declared), { recursive: true });
  try {
    fs.symlinkSync(outside, declared, process.platform === 'win32' ? 'junction' : 'dir');
  } catch (error) {
    if (error && (error.code === 'EPERM' || error.code === 'EACCES')) return;
    throw error;
  }
  const linkHold = Inventory.scanDeclaredRoot(reasoning.search.roots[0], reasoning.search, { root: linkRoot });
  assert.equal(linkHold.root.state, 'REFUSED_ROOT_NOT_REAL_DIRECTORY');
});

test('a source mutation during inspection becomes a hold and exposes no stale witness', t => {
  const fixture = makeFixture(t);
  const reasoning = fixture.declarations.find(item => item.declaration.source.nativeOutputKind === 'axm.mirror.reasoning-experience-receipt/v4').declaration;
  const artifactRoot = path.join(fixture.base, 'mutation-root');
  const first = receiptPath(artifactRoot, '3');
  const second = receiptPath(artifactRoot, '4');
  writeJson(first, { schema: reasoning.search.requiredRootSchema, value: 1 });
  writeJson(second, { schema: reasoning.search.requiredRootSchema, value: 2 });
  const originalRead = fs.readFileSync;
  let mutated = false;
  fs.readFileSync = function intercepted(file, encoding) {
    const value = originalRead.apply(fs, arguments);
    if (!mutated && path.resolve(String(file)) === path.resolve(first) && encoding === 'utf8') {
      mutated = true;
      fs.appendFileSync(second, ' ');
    }
    return value;
  };
  try {
    const held = Inventory.scanDeclaredRoot(reasoning.search.roots[0], reasoning.search, { root: artifactRoot });
    assert.equal(held.root.state, 'HOLD_SOURCE_CHANGED_DURING_SCAN');
    assert.equal(held.root.unchanged, false);
    assert.equal(held.artifacts.length, 0);
  } finally {
    fs.readFileSync = originalRead;
  }
});

test('append-only reuse, tamper refusal, policy, contracts, private hooks, and runtime exclusion are explicit', t => {
  const fixture = makeFixture(t);
  const artifactRoot = path.join(fixture.base, 'run-root');
  writeJson(receiptPath(artifactRoot, '9'), { schema: 'axm.mirror.reasoning-experience-receipt/v4', value: 'negative observation' });
  const stateDir = path.join(fixture.base, 'inventory-state');
  const first = Inventory.run({
    root: artifactRoot, policy: POLICY, adapterRequestBatch: fixture.adapterRequestBatch,
    capabilityInventory: fixture.capabilityInventory, declarationInventory: fixture.declarations, stateDir
  });
  const second = Inventory.run({
    root: artifactRoot, policy: POLICY, adapterRequestBatch: fixture.adapterRequestBatch,
    capabilityInventory: fixture.capabilityInventory, declarationInventory: fixture.declarations, stateDir
  });
  assert.equal(second.reused, true);
  assert.equal(second.batch.batchDigest, first.batch.batchDigest);
  assert.equal(first.batch.source.inventoryOrganSourcePath, 'organs/foundation-capability-native-artifact-inventory-organ.js');
  assert.equal(first.batch.source.envelopeAdapterSourcePath, 'organs/foundation-evidence-envelope-adapter-organ.js');
  assert.equal(first.batch.source.transportSourcePath, 'kernel/key-safe-json-transport-cell.js');
  assert.ok([first.batch.source.inventoryOrganSourceSha256, first.batch.source.envelopeAdapterSourceSha256, first.batch.source.transportSourceSha256].every(value => /^[a-f0-9]{64}$/.test(value)));
  const sourceDrift = Inventory.buildBatch(fixture.adapterRequestBatch, fixture.capabilityInventory, fixture.declarations, { root: artifactRoot, transportSourceBytes: 'changed transport source' });
  assert.notEqual(sourceDrift.batchId, first.batch.batchId);
  const file = path.join(first.runDir, 'batch.json');
  const disk = JSON.parse(fs.readFileSync(file, 'utf8'));
  disk.summary.evidenceAdmissions = 1;
  fs.writeFileSync(file, JSON.stringify(disk, null, 2) + '\n');
  assert.throws(() => Inventory.run({
    root: artifactRoot, policy: POLICY, adapterRequestBatch: fixture.adapterRequestBatch,
    capabilityInventory: fixture.capabilityInventory, declarationInventory: fixture.declarations, stateDir
  }), /batch digest changed/);

  assert.throws(() => Inventory.run({ policy: Object.assign({}, POLICY, { automaticFoundationCapabilityNativeArtifactInventory: false }) }), /inventory is not enabled/);
  assert.equal(JSON.parse(fs.readFileSync(path.join(ROOT, 'contracts', 'foundation-capability-native-artifact-inventory-declaration.schema.json'), 'utf8')).$id, Inventory.DECLARATION_SCHEMA);
  assert.equal(JSON.parse(fs.readFileSync(path.join(ROOT, 'contracts', 'foundation-capability-native-artifact-inventory-batch-v2.schema.json'), 'utf8')).$id, Inventory.BATCH_SCHEMA);
  assert.equal(require('../package.json').scripts['inventory:foundation-capability-native-artifacts'], 'node scripts/run-foundation-capability-native-artifact-inventory.js');
  assert.match(fs.readFileSync(path.join(ROOT, 'scripts', 'run-foundation-development-observation-executor.js'), 'utf8'), /foundation-capability-native-artifact-inventory-organ/);
  assert.match(fs.readFileSync(path.join(ROOT, 'scripts', 'run-workshop-steward-curriculum.js'), 'utf8'), /foundation-capability-native-artifact-inventory-organ/);
  assert.equal(fs.readFileSync(path.join(ROOT, 'runtime', 'server.js'), 'utf8').includes('foundation-capability-native-artifact-inventory-organ'), false);
});
