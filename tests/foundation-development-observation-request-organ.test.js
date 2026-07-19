'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const test = require('node:test');
const assert = require('node:assert/strict');
const Observatory = require('../organs/foundation-development-observatory-organ');
const Request = require('../organs/foundation-development-observation-request-organ');

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
      canaries: REASONING_CANARIES.map(id => ({ id, status: 'PASS', evidence: 'synthetic request fixture' })),
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

test('exact source-plus-evidence snapshot suppresses a duplicate observation request', t => {
  const observatoryStateDir = fs.mkdtempSync(path.join(os.tmpdir(), 'axm-observation-request-observed-'));
  const requestStateDir = fs.mkdtempSync(path.join(os.tmpdir(), 'axm-observation-request-empty-'));
  t.after(() => { fs.rmSync(observatoryStateDir, { recursive: true, force: true }); fs.rmSync(requestStateDir, { recursive: true, force: true }); });
  const evidence = fixtureEvidence();
  const observed = Observatory.run({ stateDir: observatoryStateDir, evidence, allowSyntheticFixture: true });
  const result = Request.run({ policy: POLICY, observatoryStateDir, stateDir: requestStateDir, evidence, allowSyntheticFixture: true });
  assert.equal(result.request.state, 'NO_NEW_OBSERVATION_REQUIRED');
  assert.deepEqual(result.request.prior.exactSnapshotIds, [observed.snapshot.snapshotId]);
  assert.equal(result.written, false);
  assert.deepEqual(fs.readdirSync(requestStateDir), []);
});

test('new evidence on the same source creates one immutable request and reuses it', t => {
  const observatoryStateDir = fs.mkdtempSync(path.join(os.tmpdir(), 'axm-observation-request-prior-'));
  const requestStateDir = fs.mkdtempSync(path.join(os.tmpdir(), 'axm-observation-request-state-'));
  t.after(() => { fs.rmSync(observatoryStateDir, { recursive: true, force: true }); fs.rmSync(requestStateDir, { recursive: true, force: true }); });
  const baseline = fixtureEvidence();
  Observatory.run({ stateDir: observatoryStateDir, evidence: baseline, allowSyntheticFixture: true });
  const changed = fixtureEvidence();
  changed.reasoning.negativeExperiences = 1;
  const first = Request.run({ policy: POLICY, observatoryStateDir, stateDir: requestStateDir, evidence: changed, allowSyntheticFixture: true });
  const second = Request.run({ policy: POLICY, observatoryStateDir, stateDir: requestStateDir, evidence: changed, allowSyntheticFixture: true });
  assert.equal(first.request.state, 'OBSERVATION_REQUIRED');
  assert.equal(first.written, true);
  assert.equal(first.reused, false);
  assert.equal(second.reused, true);
  assert.equal(second.request.requestDigest, first.request.requestDigest);
  assert.equal(first.request.authority.foundationObservationExecution, false);
  assert.equal(first.request.authority.automaticRepair, false);

  const file = path.join(first.runDir, 'request.json');
  const disk = JSON.parse(fs.readFileSync(file, 'utf8'));
  disk.reason = 'silently altered';
  fs.writeFileSync(file, JSON.stringify(disk, null, 2) + '\n');
  assert.throws(() => Request.run({ policy: POLICY, observatoryStateDir, stateDir: requestStateDir, evidence: changed, allowSyntheticFixture: true }), /request digest changed/);
});

test('policy keeps request authority separate when a different executor may observe', () => {
  assert.equal(POLICY.automaticFoundationDevelopmentObservationRequest, true);
  assert.equal(POLICY.automaticFoundationDevelopmentObservation, true);
  const disabled = Object.assign({}, POLICY, { automaticFoundationDevelopmentObservationRequest: false });
  assert.throws(() => Request.inspect({ policy: disabled, evidence: fixtureEvidence(), allowSyntheticFixture: true }), /requests are not enabled/);
  const request = Request.inspect({ policy: POLICY, evidence: fixtureEvidence(), allowSyntheticFixture: true });
  assert.equal(request.authority.foundationObservationExecution, false);
  const overpowered = Object.assign({}, POLICY, { automaticRuntimePromotion: true });
  assert.throws(() => Request.inspect({ policy: overpowered, evidence: fixtureEvidence(), allowSyntheticFixture: true }), /refuses runtime, canon, or authority growth/);
});

test('request contract and command exist outside the active runtime', () => {
  const contract = JSON.parse(fs.readFileSync(path.join(ROOT, 'contracts', 'foundation-development-observation-request.schema.json'), 'utf8'));
  assert.equal(contract.$id, Request.REQUEST_SCHEMA);
  assert.equal(fs.existsSync(path.join(ROOT, 'scripts', 'run-foundation-development-observation-request.js')), true);
  const workshopCommand = fs.readFileSync(path.join(ROOT, 'scripts', 'run-workshop-steward-curriculum.js'), 'utf8');
  assert.match(workshopCommand, /foundation-development-observation-executor-organ/);
  const runtime = fs.readFileSync(path.join(ROOT, 'runtime', 'server.js'), 'utf8');
  assert.equal(runtime.includes('foundation-development-observation-request-organ'), false);
});
