'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const test = require('node:test');
const assert = require('node:assert/strict');
const LanguageModel = require('../learning/typed-trace-language-model');
const Observatory = require('../organs/foundation-development-observatory-organ');
const Executor = require('../organs/foundation-development-observation-executor-organ');
const Router = require('../organs/foundation-development-frontier-router-organ');
const Planner = require('../organs/foundation-development-hand-planner-organ');

const ROOT = path.resolve(__dirname, '..');
const POLICY = JSON.parse(fs.readFileSync(path.join(ROOT, 'training', 'TRAINING_POLICY.json'), 'utf8'));
const REASONING_CANARIES = [
  'source-family-isolation', 'held-out-frozen', 'model-authority-closed', 'challenger-session-authority-closed',
  'independent-reasoning-seams-clean', 'adversarial-transfer', 'candidate-origination-transfer',
  'candidate-origin-authority-closed', 'ordered-strategy-composition', 'underspecified-candidate-origin-holds',
  'experience-self-training-closed', 'experience-remains-episodic', 'synthetic-counterexample-lineage', 'known-failed-experience-excluded'
];

function digest(value) {
  return crypto.createHash('sha256').update(JSON.stringify(LanguageModel.stable(value))).digest('hex');
}
function clone(value) { return JSON.parse(JSON.stringify(value)); }

function fixtureEvidence() {
  return {
    sourceMode: 'SYNTHETIC_OBSERVATORY_FIXTURE',
    subject: { identity: 'axm.machine.mirror/seed-0', files: [], digest: 'a'.repeat(64) },
    bodyIntegrity: { state: 'PASS_BOUNDED_PUBLIC_BODY_STRUCTURAL_INTEGRITY', digest: '9'.repeat(64), source: { inventoryDigest: 'a'.repeat(64) }, summary: { javascriptSyntaxChecked: 4, jsonParsed: 4, activeOrgansChecked: 1, activeOrgansWithTestReachability: 1, holds: 0, sourceExecutions: 0 } },
    foundationCanaries: Observatory.runFrozenFoundationCanaries(),
    reasoning: {
      cycleId: 'reasoning-skill-testfixture000000000', cycleSha256: 'b'.repeat(64), seamReportSha256: 'c'.repeat(64), seamOpen: 0,
      promotionState: 'PROPOSE_HUMAN_REVIEW', runtimePointerChanged: false,
      canaries: REASONING_CANARIES.map(id => ({ id, status: 'PASS', evidence: 'synthetic hand fixture' })),
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
  const base = fs.mkdtempSync(path.join(os.tmpdir(), `axm-foundation-hands-${label}-`));
  const dirs = {
    base,
    observatoryStateDir: path.join(base, 'observations'),
    requestStateDir: path.join(base, 'requests'),
    executorStateDir: path.join(base, 'executions'),
    frontierStateDir: path.join(base, 'frontier'),
    stateDir: path.join(base, 'hands')
  };
  t.after(() => fs.rmSync(base, { recursive: true, force: true }));
  return dirs;
}

function route(t, label, evidence, setup) {
  const dirs = stateDirs(t, label);
  if (setup) setup(dirs);
  const execution = Executor.run(Object.assign({ policy: POLICY, evidence, allowSyntheticFixture: true }, dirs));
  const frontier = Router.run({
    policy: POLICY,
    snapshot: execution.snapshot,
    receipt: execution.receipt,
    observatoryStateDir: dirs.observatoryStateDir,
    stateDir: dirs.frontierStateDir
  });
  return { dirs, execution, frontier };
}

function redigestFrontier(batch) {
  for (const request of batch.requests) request.requestDigest = digest(Object.assign({}, request, { requestDigest: null }));
  batch.batchDigest = digest(Object.assign({}, batch, { batchDigest: null }));
  return batch;
}

test('typed acquisition modes create reusable hand families without dimension-name routing', t => {
  const { dirs, frontier } = route(t, 'current', fixtureEvidence());
  const first = Planner.run({ policy: POLICY, frontierBatch: frontier.batch, stateDir: dirs.stateDir });
  assert.equal(first.batch.summary.evidenceHandRequests, 2);
  assert.equal(first.batch.summary.externalEvidenceIntakeHands, 1);
  assert.equal(first.batch.summary.passiveObservationHands, 1);
  assert.equal(first.batch.summary.capabilitiesClaimed, 0);
  assert.equal(first.batch.summary.organsRequired, 0);
  assert.ok(first.batch.hands.every(item => item.selection.existingCapabilityMatch === 'NOT_SEARCHED' && item.selection.newOrganNeed === 'UNASSESSED'));
  assert.ok(first.batch.hands.every(item => item.authority.eventInduction === false && Object.values(item.authority).every(value => value === false)));
  const poisoned = clone(frontier.batch.requests[0].developmentNeed);
  poisoned.acquisitionMode = 'PASSIVE_LOCAL_OBSERVATION';
  assert.throws(() => Planner.verifyEvidenceNeed(poisoned), /kind and acquisition mode do not match/);
  const source = fs.readFileSync(path.join(ROOT, 'organs', 'foundation-development-hand-planner-organ.js'), 'utf8');
  assert.equal(source.includes('DECLARED_INDEPENDENT_LANGUAGE_TRANSFER'), false);
  assert.equal(source.includes('REAL_NEGATIVE_EXPERIENCE_COVERAGE'), false);

  const renamed = clone(frontier.batch);
  renamed.requests.forEach((item, index) => { item.dimensionId = `UNSEEN_DIMENSION_${index}`; item.observation.statement = `hostile prose decoy ${index}`; });
  redigestFrontier(renamed);
  const renamedPlan = Planner.buildBatch(renamed);
  assert.deepEqual(renamedPlan.hands.map(item => item.handFamily).sort(), first.batch.hands.map(item => item.handFamily).sort());
  const second = Planner.run({ policy: POLICY, frontierBatch: frontier.batch, stateDir: dirs.stateDir });
  assert.equal(second.reused, true);
  assert.equal(second.batch.batchDigest, first.batch.batchDigest);
});

test('an all-observed frontier creates an explicit empty hand batch without fake work', t => {
  const evidence = fixtureEvidence();
  evidence.reasoning.negativeExperiences = 1;
  evidence.independent.fullPasses = 1;
  evidence.independent.exams = 1;
  evidence.independent.examDigests = ['4'.repeat(64)];
  const { dirs, frontier } = route(t, 'empty', evidence);
  const result = Planner.run({ policy: POLICY, frontierBatch: frontier.batch, stateDir: dirs.stateDir });
  assert.equal(result.batch.state, 'NO_ELIGIBLE_EVIDENCE_HAND_REQUESTS');
  assert.equal(result.batch.hands.length, 0);
  assert.equal(result.batch.holds.length, 0);
  assert.equal(result.batch.summary.implementationsBuilt, 0);
});

test('a regression need becomes an independent exam hand and preserves bound deltas', t => {
  const baseline = fixtureEvidence();
  const changed = fixtureEvidence();
  changed.foundationCanaries.receipts.find(item => item.id === 'missing-recovery-holds').status = 'FAIL';
  const { dirs, frontier } = route(t, 'regression', changed, target => {
    Observatory.run({ stateDir: target.observatoryStateDir, evidence: baseline, allowSyntheticFixture: true });
  });
  const result = Planner.run({ policy: POLICY, frontierBatch: frontier.batch, stateDir: dirs.stateDir });
  const hand = result.batch.hands.find(item => item.handFamily === 'INDEPENDENT_REGRESSION_EXAM_HAND');
  assert.ok(hand);
  assert.equal(hand.evidenceNeed.evidenceKind, 'BOUND_INDEPENDENT_REGRESSION_EXAM');
  assert.ok(hand.source.deltas.evidenceSectionsChanged.includes('foundationCanaries'));
  assert.equal(hand.selection.implementationSelected, false);
  assert.equal(result.batch.summary.independentRegressionExamHands, 1);
});

test('missing typed need holds without prose inference and committed tampering is preserved', t => {
  const { dirs, frontier } = route(t, 'legacy', fixtureEvidence());
  const legacy = clone(frontier.batch);
  legacy.requests[0].developmentNeed = null;
  legacy.requests[0].handPlanningEligible = false;
  redigestFrontier(legacy);
  const first = Planner.run({ policy: POLICY, frontierBatch: legacy, stateDir: dirs.stateDir });
  assert.equal(first.batch.summary.evidenceHandRequests, 1);
  assert.equal(first.batch.summary.machineReadableNeedHolds, 1);
  assert.equal(first.batch.holds[0].state, 'HOLD_MACHINE_READABLE_EVIDENCE_NEED_ABSENT');
  const file = path.join(first.runDir, 'batch.json');
  const disk = JSON.parse(fs.readFileSync(file, 'utf8'));
  disk.summary.organsRequired = 1;
  fs.writeFileSync(file, JSON.stringify(disk, null, 2) + '\n');
  assert.throws(() => Planner.run({ policy: POLICY, frontierBatch: legacy, stateDir: dirs.stateDir }), /batch digest changed/);
  assert.equal(fs.existsSync(file), true);
});

test('hand policy, contracts, commands, Workshop hook, and runtime boundary are explicit', () => {
  const disabled = Object.assign({}, POLICY, { automaticFoundationDevelopmentHandPlanning: false });
  assert.throws(() => Planner.run({ policy: disabled }), /planning is not enabled/);
  const evidenceNeed = JSON.parse(fs.readFileSync(path.join(ROOT, 'contracts', 'foundation-development-evidence-need.schema.json'), 'utf8'));
  const hand = JSON.parse(fs.readFileSync(path.join(ROOT, 'contracts', 'foundation-development-hand-request.schema.json'), 'utf8'));
  const batch = JSON.parse(fs.readFileSync(path.join(ROOT, 'contracts', 'foundation-development-hand-batch.schema.json'), 'utf8'));
  assert.equal(evidenceNeed.$id, Planner.EVIDENCE_NEED_SCHEMA);
  assert.equal(hand.$id, Planner.HAND_SCHEMA);
  assert.equal(batch.$id, Planner.BATCH_SCHEMA);
  assert.equal(fs.existsSync(path.join(ROOT, 'scripts', 'run-foundation-development-hand-planner.js')), true);
  const executorCommand = fs.readFileSync(path.join(ROOT, 'scripts', 'run-foundation-development-observation-executor.js'), 'utf8');
  const workshopCommand = fs.readFileSync(path.join(ROOT, 'scripts', 'run-workshop-steward-curriculum.js'), 'utf8');
  assert.match(executorCommand, /foundation-development-hand-planner-organ/);
  assert.match(workshopCommand, /foundation-development-hand-planner-organ/);
  const runtime = fs.readFileSync(path.join(ROOT, 'runtime', 'server.js'), 'utf8');
  assert.equal(runtime.includes('foundation-development-hand-planner-organ'), false);
});
