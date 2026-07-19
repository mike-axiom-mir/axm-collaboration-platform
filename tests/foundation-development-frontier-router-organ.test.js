'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const test = require('node:test');
const assert = require('node:assert/strict');
const Observatory = require('../organs/foundation-development-observatory-organ');
const Executor = require('../organs/foundation-development-observation-executor-organ');
const Router = require('../organs/foundation-development-frontier-router-organ');

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
    bodyIntegrity: { state: 'PASS_BOUNDED_PUBLIC_BODY_STRUCTURAL_INTEGRITY', digest: '9'.repeat(64), source: { inventoryDigest: 'a'.repeat(64) }, summary: { javascriptSyntaxChecked: 4, jsonParsed: 4, activeOrgansChecked: 1, activeOrgansWithTestReachability: 1, holds: 0, sourceExecutions: 0 } },
    foundationCanaries: Observatory.runFrozenFoundationCanaries(),
    reasoning: {
      cycleId: 'reasoning-skill-testfixture000000000', cycleSha256: 'b'.repeat(64), seamReportSha256: 'c'.repeat(64), seamOpen: 0,
      promotionState: 'PROPOSE_HUMAN_REVIEW', runtimePointerChanged: false,
      canaries: REASONING_CANARIES.map(id => ({ id, status: 'PASS', evidence: 'synthetic frontier fixture' })),
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
  const base = fs.mkdtempSync(path.join(os.tmpdir(), `axm-foundation-frontier-${label}-`));
  const dirs = {
    base,
    observatoryStateDir: path.join(base, 'observations'),
    requestStateDir: path.join(base, 'requests'),
    executorStateDir: path.join(base, 'executions'),
    stateDir: path.join(base, 'frontier')
  };
  t.after(() => fs.rmSync(base, { recursive: true, force: true }));
  return dirs;
}

function execute(t, label, evidence, setup) {
  const dirs = stateDirs(t, label);
  if (setup) setup(dirs);
  const execution = Executor.run(Object.assign({ policy: POLICY, evidence, allowSyntheticFixture: true }, dirs));
  return { dirs, execution };
}

test('every current hold becomes one typed evidence request with no selected priority', t => {
  const { dirs, execution } = execute(t, 'holds', fixtureEvidence());
  const first = Router.run({ policy: POLICY, snapshot: execution.snapshot, receipt: execution.receipt, observatoryStateDir: dirs.observatoryStateDir, stateDir: dirs.stateDir });
  assert.equal(first.batch.state, 'DEVELOPMENT_FRONTIER_REQUESTS_PROPOSED');
  assert.equal(first.batch.summary.nonPassingDimensions, 2);
  assert.equal(first.batch.summary.evidenceAcquisitionRequests, 2);
  assert.equal(first.batch.summary.regressionInvestigationRequests, 0);
  assert.deepEqual(first.batch.requests.map(item => item.dimensionId), ['DECLARED_INDEPENDENT_LANGUAGE_TRANSFER', 'REAL_NEGATIVE_EXPERIENCE_COVERAGE']);
  assert.ok(first.batch.requests.every(item => item.prioritySelected === false && item.trainingEligible === false));
  assert.ok(first.batch.requests.every(item => Object.values(item.authority).every(value => value === false)));
  const second = Router.run({ policy: POLICY, snapshot: execution.snapshot, receipt: execution.receipt, observatoryStateDir: dirs.observatoryStateDir, stateDir: dirs.stateDir });
  assert.equal(second.reused, true);
  assert.equal(second.batch.batchDigest, first.batch.batchDigest);
});

test('an all-observed profile creates an explicit empty frontier without fake work', t => {
  const evidence = fixtureEvidence();
  evidence.reasoning.negativeExperiences = 1;
  evidence.independent.fullPasses = 1;
  evidence.independent.exams = 1;
  evidence.independent.examDigests = ['4'.repeat(64)];
  const { dirs, execution } = execute(t, 'empty', evidence);
  const result = Router.run({ policy: POLICY, snapshot: execution.snapshot, receipt: execution.receipt, observatoryStateDir: dirs.observatoryStateDir, stateDir: dirs.stateDir });
  assert.equal(result.batch.state, 'NO_DEVELOPMENT_FRONTIER_REQUESTS');
  assert.equal(result.batch.requests.length, 0);
  assert.equal(result.batch.summary.nonPassingDimensions, 0);
  assert.equal(result.batch.summary.implementationsBuilt, 0);
});

test('same-source regression requests an independent exam and exposes evidence deltas', t => {
  const baseline = fixtureEvidence();
  const changed = fixtureEvidence();
  changed.foundationCanaries.receipts.find(item => item.id === 'missing-recovery-holds').status = 'FAIL';
  const { dirs, execution } = execute(t, 'regression', changed, target => {
    Observatory.run({ stateDir: target.observatoryStateDir, evidence: baseline, allowSyntheticFixture: true });
  });
  const result = Router.run({ policy: POLICY, snapshot: execution.snapshot, receipt: execution.receipt, observatoryStateDir: dirs.observatoryStateDir, stateDir: dirs.stateDir });
  const request = result.batch.requests.find(item => item.dimensionId === 'REPAIRABILITY');
  assert.equal(request.classification, 'REGRESSION_INVESTIGATION_REQUEST');
  assert.equal(request.requestedOutcome.kind, 'INDEPENDENT_CAUSE_AND_REPAIR_EXAM');
  assert.ok(request.deltas.evidenceSectionsChanged.includes('foundationCanaries'));
  assert.equal(request.repairSelected, false);
  assert.equal(result.batch.summary.regressionInvestigationRequests, 1);
  assert.equal(result.batch.summary.repairsSelected, 0);
});

test('tampered source receipt or committed batch refuses reuse without erasure', t => {
  const { dirs, execution } = execute(t, 'tamper', fixtureEvidence());
  const tamperedReceipt = JSON.parse(JSON.stringify(execution.receipt));
  tamperedReceipt.state = 'OBSERVATION_RECORDED_WITH_REGRESSION_REQUIRES_REVIEW';
  assert.throws(() => Router.run({ policy: POLICY, snapshot: execution.snapshot, receipt: tamperedReceipt, observatoryStateDir: dirs.observatoryStateDir, stateDir: dirs.stateDir }), /receipt digest changed/);
  const first = Router.run({ policy: POLICY, snapshot: execution.snapshot, receipt: execution.receipt, observatoryStateDir: dirs.observatoryStateDir, stateDir: dirs.stateDir });
  const file = path.join(first.runDir, 'batch.json');
  const disk = JSON.parse(fs.readFileSync(file, 'utf8'));
  disk.summary.prioritySelections = 1;
  fs.writeFileSync(file, JSON.stringify(disk, null, 2) + '\n');
  assert.throws(() => Router.run({ policy: POLICY, snapshot: execution.snapshot, receipt: execution.receipt, observatoryStateDir: dirs.observatoryStateDir, stateDir: dirs.stateDir }), /batch digest changed/);
  assert.equal(fs.existsSync(file), true);
});

test('router policy, contracts, command, Workshop hook, and runtime boundary are explicit', () => {
  const disabled = Object.assign({}, POLICY, { automaticFoundationDevelopmentFrontierRouting: false });
  assert.throws(() => Router.run({ policy: disabled }), /routing is not enabled/);
  const requestContract = JSON.parse(fs.readFileSync(path.join(ROOT, 'contracts', 'foundation-development-frontier-request.schema.json'), 'utf8'));
  const batchContract = JSON.parse(fs.readFileSync(path.join(ROOT, 'contracts', 'foundation-development-frontier-batch.schema.json'), 'utf8'));
  assert.equal(requestContract.$id, Router.REQUEST_SCHEMA);
  assert.equal(batchContract.$id, Router.BATCH_SCHEMA);
  assert.equal(fs.existsSync(path.join(ROOT, 'scripts', 'run-foundation-development-frontier-router.js')), true);
  const workshopCommand = fs.readFileSync(path.join(ROOT, 'scripts', 'run-workshop-steward-curriculum.js'), 'utf8');
  assert.match(workshopCommand, /foundation-development-frontier-router-organ/);
  const runtime = fs.readFileSync(path.join(ROOT, 'runtime', 'server.js'), 'utf8');
  assert.equal(runtime.includes('foundation-development-frontier-router-organ'), false);
});
