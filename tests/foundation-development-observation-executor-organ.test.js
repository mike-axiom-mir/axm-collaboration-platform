'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const test = require('node:test');
const assert = require('node:assert/strict');
const Observatory = require('../organs/foundation-development-observatory-organ');
const Request = require('../organs/foundation-development-observation-request-organ');
const Executor = require('../organs/foundation-development-observation-executor-organ');

const ROOT = path.resolve(__dirname, '..');
const POLICY = JSON.parse(fs.readFileSync(path.join(ROOT, 'training', 'TRAINING_POLICY.json'), 'utf8'));
const REASONING_CANARIES = [
  'source-family-isolation', 'held-out-frozen', 'model-authority-closed', 'challenger-session-authority-closed',
  'independent-reasoning-seams-clean', 'adversarial-transfer', 'candidate-origination-transfer',
  'candidate-origin-authority-closed', 'ordered-strategy-composition', 'underspecified-candidate-origin-holds',
  'experience-self-training-closed', 'experience-remains-episodic', 'synthetic-counterexample-lineage', 'known-failed-experience-excluded'
];

function fixtureEvidence() {
  return {
    sourceMode: 'SYNTHETIC_OBSERVATORY_FIXTURE',
    subject: { identity: 'axm.machine.mirror/seed-0', files: [], digest: 'a'.repeat(64) },
    bodyIntegrity: {
      state: 'PASS_BOUNDED_PUBLIC_BODY_STRUCTURAL_INTEGRITY', digest: '9'.repeat(64),
      source: { inventoryDigest: 'a'.repeat(64) },
      summary: { javascriptSyntaxChecked: 4, jsonParsed: 4, activeOrgansChecked: 1, activeOrgansWithTestReachability: 1, holds: 0, sourceExecutions: 0 }
    },
    foundationCanaries: Observatory.runFrozenFoundationCanaries(),
    reasoning: {
      cycleId: 'reasoning-skill-testfixture000000000', cycleSha256: 'b'.repeat(64), seamReportSha256: 'c'.repeat(64), seamOpen: 0,
      promotionState: 'PROPOSE_HUMAN_REVIEW', runtimePointerChanged: false,
      canaries: REASONING_CANARIES.map(id => ({ id, status: 'PASS', evidence: 'synthetic executor fixture' })),
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

function stateDirs(t, label) {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), `axm-foundation-executor-${label}-`));
  const dirs = {
    base,
    observatoryStateDir: path.join(base, 'observations'),
    requestStateDir: path.join(base, 'requests'),
    executorStateDir: path.join(base, 'executions')
  };
  t.after(() => fs.rmSync(base, { recursive: true, force: true }));
  return dirs;
}

test('unseen exact state is requested, observed once, bound, and then no-ops', t => {
  const dirs = stateDirs(t, 'happy');
  const options = Object.assign({ policy: POLICY, evidence: fixtureEvidence(), allowSyntheticFixture: true }, dirs);
  const first = Executor.run(options);
  assert.equal(first.state, 'OBSERVATION_RECORDED_WITHOUT_REGRESSION');
  assert.equal(first.requestWritten, true);
  assert.equal(first.observationExecuted, true);
  assert.equal(first.receiptWritten, true);
  assert.equal(first.receipt.authority.foundationObservationExecution, true);
  assert.equal(first.receipt.authority.compositeGrowthGrade, false);
  assert.equal(first.receipt.observation.dimensions.growthGrade, null);
  assert.equal(first.snapshot.subject.digest, first.request.observation.subjectDigest);
  assert.equal(first.receipt.request.evidenceDigest, first.request.observation.evidenceDigest);

  const second = Executor.run(options);
  assert.equal(second.state, 'NO_NEW_OBSERVATION_REQUIRED');
  assert.equal(second.observationExecuted, false);
  assert.equal(second.receiptWritten, false);
  assert.equal(fs.readdirSync(dirs.observatoryStateDir).length, 1);
  assert.equal(fs.readdirSync(dirs.requestStateDir).length, 1);
  assert.equal(fs.readdirSync(dirs.executorStateDir).length, 1);
});

test('automatic observation exposes a same-source regression but cannot repair it', t => {
  const dirs = stateDirs(t, 'regression');
  const baseline = fixtureEvidence();
  Observatory.run({ stateDir: dirs.observatoryStateDir, evidence: baseline, allowSyntheticFixture: true });
  const changed = fixtureEvidence();
  changed.foundationCanaries.receipts.find(item => item.id === 'missing-recovery-holds').status = 'FAIL';
  const result = Executor.run(Object.assign({ policy: POLICY, evidence: changed, allowSyntheticFixture: true }, dirs));
  assert.equal(result.state, 'OBSERVATION_RECORDED_WITH_REGRESSION_REQUIRES_REVIEW');
  assert.ok(result.snapshot.comparison.regressions.some(item => item.dimensionId === 'REPAIRABILITY'));
  assert.ok(result.receipt.observation.dimensions.directRegressions > 0);
  assert.ok(result.receipt.observation.dimensions.longitudinalRegressions > 0);
  assert.equal(result.receipt.authority.automaticRepair, false);
  assert.equal(result.receipt.authority.trainingAdmission, false);
  assert.equal(result.receipt.authority.runtimePromotion, false);
});

test('tampered outstanding request refuses observation and preserves the bad evidence', t => {
  const dirs = stateDirs(t, 'tamper');
  const evidence = fixtureEvidence();
  const request = Request.run(Object.assign({ policy: POLICY, evidence, allowSyntheticFixture: true, stateDir: dirs.requestStateDir }, dirs));
  const file = path.join(request.runDir, 'request.json');
  const disk = JSON.parse(fs.readFileSync(file, 'utf8'));
  disk.reason = 'tampered request';
  fs.writeFileSync(file, JSON.stringify(disk, null, 2) + '\n');
  assert.throws(() => Executor.run(Object.assign({ policy: POLICY, evidence, allowSyntheticFixture: true }, dirs)), /request digest changed/);
  assert.equal(fs.existsSync(dirs.observatoryStateDir), false);
  assert.equal(fs.existsSync(dirs.executorStateDir), false);
  assert.equal(fs.existsSync(file), true);
});

test('executor policy, contract, command, and runtime boundary remain explicit', () => {
  const disabled = Object.assign({}, POLICY, { automaticFoundationDevelopmentObservation: false });
  assert.throws(() => Executor.run({ policy: disabled, evidence: fixtureEvidence(), allowSyntheticFixture: true }), /execution is not enabled/);
  const overpowered = Object.assign({}, POLICY, { automaticCanonPromotion: true });
  assert.throws(() => Executor.run({ policy: overpowered, evidence: fixtureEvidence(), allowSyntheticFixture: true }), /refuses runtime, canon, or authority growth/);
  const contract = JSON.parse(fs.readFileSync(path.join(ROOT, 'contracts', 'foundation-development-observation-execution-receipt.schema.json'), 'utf8'));
  assert.equal(contract.$id, Executor.RECEIPT_SCHEMA);
  assert.equal(fs.existsSync(path.join(ROOT, 'scripts', 'run-foundation-development-observation-executor.js')), true);
  const workshopCommand = fs.readFileSync(path.join(ROOT, 'scripts', 'run-workshop-steward-curriculum.js'), 'utf8');
  assert.match(workshopCommand, /foundation-development-observation-executor-organ/);
  const runtime = fs.readFileSync(path.join(ROOT, 'runtime', 'server.js'), 'utf8');
  assert.equal(runtime.includes('foundation-development-observation-executor-organ'), false);
});
