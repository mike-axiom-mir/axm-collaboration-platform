'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const test = require('node:test');
const assert = require('node:assert/strict');
const Observatory = require('../organs/foundation-development-observatory-organ');

const ROOT = path.resolve(__dirname, '..');
const REASONING_CANARIES = [
  'source-family-isolation', 'held-out-frozen', 'model-authority-closed', 'challenger-session-authority-closed',
  'independent-reasoning-seams-clean', 'adversarial-transfer', 'candidate-origination-transfer',
  'candidate-origin-authority-closed', 'ordered-strategy-composition', 'underspecified-candidate-origin-holds',
  'experience-self-training-closed', 'experience-remains-episodic', 'synthetic-counterexample-lineage', 'known-failed-experience-excluded'
];

function fixtureEvidence(subject = 'a'.repeat(64)) {
  return {
    sourceMode: 'SYNTHETIC_OBSERVATORY_FIXTURE',
    subject: { identity: 'axm.machine.mirror/seed-0', files: [], digest: subject },
    bodyIntegrity: {
      state: 'PASS_BOUNDED_PUBLIC_BODY_STRUCTURAL_INTEGRITY', digest: '9'.repeat(64),
      source: { inventoryDigest: subject },
      summary: { javascriptSyntaxChecked: 4, jsonParsed: 4, activeOrgansChecked: 1, activeOrgansWithTestReachability: 1, holds: 0, sourceExecutions: 0 }
    },
    foundationCanaries: Observatory.runFrozenFoundationCanaries(),
    reasoning: {
      cycleId: 'reasoning-skill-testfixture000000000', cycleSha256: 'b'.repeat(64), seamReportSha256: 'c'.repeat(64),
      seamOpen: 0, promotionState: 'PROPOSE_HUMAN_REVIEW', runtimePointerChanged: false,
      canaries: REASONING_CANARIES.map(id => ({ id, status: 'PASS', evidence: 'synthetic observatory test fixture' })),
      heldOutAccuracy: 1, candidateFreeAccuracy: 1, adversarialPassed: 8, adversarialCases: 8,
      negativeExperiences: 0, knownFailReceiptsPreserved: 7
    },
    workshop: {
      auditSha256: 'd'.repeat(64), privateReportId: 'fixture', privateReportSha256: 'e'.repeat(64),
      sourceInventoryStillSettled: true, wholeWorkshopJsonInventoryStillSettled: false,
      wholeWorkshopJsonScopeIncludesMutableOperationalState: true,
      eligibleContracts: 49, boundaryMismatches: 0, heldOutPassed: 9, heldOutFailed: 0, splitLeakage: false,
      manifestBoundRoutes: 38, routeSelectionMismatches: 0, missingProbeHands: 6, providerDeclarationGaps: 1,
      workShopFilesChanged: 0, runtimePointerChanged: false, worldActions: 0
    },
    language: {
      auditSha256: '1'.repeat(64), modelDigest: '2'.repeat(64), batchDigest: '3'.repeat(64),
      realLocalGroups: 7, accepted: 7, fallback: 0, planContradictions: 0,
      proseDecoyPasses: 7, proseDecoyFailures: 0, runtimeActive: false
    },
    independent: { exams: 0, fullPasses: 0, insufficientCoverage: 0, drift: 0, examDigests: [], independenceProven: false }
  };
}

test('frozen Foundation canaries directly observe inhibition, restraint, repairability, and order', () => {
  const canaries = Observatory.runFrozenFoundationCanaries();
  assert.equal(canaries.canaryVersion, 1);
  assert.equal(canaries.passed, 8);
  assert.equal(canaries.failed, 0);
  assert.equal(canaries.trainingAdmissions, 0);
  assert.equal(new Set(canaries.receipts.map(item => item.id)).size, 8);
  assert.ok(canaries.receipts.every(item => item.status === 'PASS'));
  assert.ok(canaries.receipts.every(item => item.trainingEligible === false));
  assert.ok(canaries.receipts.every(item => Object.values(item.authority).every(value => value === false)));
});

test('development dimensions stay separate and preserve absent evidence as holds', () => {
  const rows = Observatory.dimensions(fixtureEvidence());
  const byId = new Map(rows.map(item => [item.id, item]));
  assert.equal(rows.length, 11);
  assert.equal(byId.get('EPISTEMIC_INHIBITION').state, 'OBSERVED_PASS');
  assert.equal(byId.get('DISCOVERY_TRANSFER_ACROSS_WORKSHOP_GROWTH').state, 'OBSERVED_PASS');
  assert.equal(byId.get('PUBLIC_BODY_STRUCTURAL_INTEGRITY').state, 'OBSERVED_PASS');
  assert.match(byId.get('DISCOVERY_TRANSFER_ACROSS_WORKSHOP_GROWTH').statement, /operational drift is recorded separately: observed/);
  assert.equal(byId.get('REAL_NEGATIVE_EXPERIENCE_COVERAGE').state, 'HOLD_NO_REAL_NEGATIVE_EXPERIENCE');
  assert.equal(byId.get('DECLARED_INDEPENDENT_LANGUAGE_TRANSFER').state, 'HOLD_NO_OUTSIDE_AUTHORED_LANGUAGE_EXAM');
  assert.ok(rows.every(item => item.claimAuthority === false));
});

test('a separately verified passive native negative candidate closes only the matching observation gate', () => {
  const evidence = fixtureEvidence();
  evidence.nativeEvidenceEligibility = {
    batches: 1,
    currentSourceBatches: 1,
    staleBatches: 0,
    eligibleCandidates: [{ receiptId: 'reasoning-experience-aaaaaaaaaaaaaaaaaaaaaaaa', candidateDigest: '8'.repeat(64) }],
    batchDigests: ['7'.repeat(64)],
    authoritySeams: 0
  };
  const byId = new Map(Observatory.dimensions(evidence).map(item => [item.id, item]));
  assert.equal(byId.get('REAL_NEGATIVE_EXPERIENCE_COVERAGE').state, 'OBSERVED_PASS');
  assert.equal(byId.get('DECLARED_INDEPENDENT_LANGUAGE_TRANSFER').state, 'HOLD_NO_OUTSIDE_AUTHORED_LANGUAGE_EXAM');
  assert.equal(byId.get('REAL_NEGATIVE_EXPERIENCE_COVERAGE').claimAuthority, false);
});

test('append-only eligibility bookkeeping cannot create a self-observation loop without new candidates', () => {
  const first = fixtureEvidence();
  first.nativeEvidenceEligibility = {
    batches: 1, currentSourceBatches: 1, staleBatches: 0,
    eligibleCandidates: [], batchDigests: ['1'.repeat(64)], authoritySeams: 0
  };
  const later = fixtureEvidence();
  later.nativeEvidenceEligibility = {
    batches: 9, currentSourceBatches: 4, staleBatches: 5,
    eligibleCandidates: [], batchDigests: ['2'.repeat(64), '3'.repeat(64)], authoritySeams: 0
  };
  assert.deepEqual(Observatory.evidenceSummary(first).nativeEvidenceEligibility, {
    currentVerifierEvidenceAvailable: true,
    staleHistoryPresent: false,
    eligibleCandidates: [],
    authoritySeams: 0
  });
  later.nativeEvidenceEligibility.staleBatches = 1;
  first.nativeEvidenceEligibility.staleBatches = 1;
  assert.deepEqual(Observatory.evidenceSummary(later), Observatory.evidenceSummary(first));
});

test('append-only synthetic examiner snapshots reuse exact bytes and expose no score or authority', t => {
  const stateDir = fs.mkdtempSync(path.join(os.tmpdir(), 'axm-foundation-observatory-'));
  t.after(() => fs.rmSync(stateDir, { recursive: true, force: true }));
  const first = Observatory.run({ stateDir, evidence: fixtureEvidence(), allowSyntheticFixture: true });
  assert.equal(first.reused, false);
  assert.equal(first.snapshot.state, 'SYNTHETIC_OBSERVATORY_FIXTURE_NOT_OPERATIONAL_EVIDENCE');
  assert.equal(first.snapshot.organ.singleIntelligenceScore, false);
  assert.equal(first.snapshot.authority.trainingAdmission, false);
  assert.equal(first.snapshot.authority.automaticRepair, false);
  assert.equal(first.snapshot.authority.runtimePromotion, false);
  Observatory.verifySnapshot(first.snapshot, first.runDir);
  const second = Observatory.run({ stateDir, evidence: fixtureEvidence(), allowSyntheticFixture: true });
  assert.equal(second.reused, true);
  assert.equal(second.snapshot.snapshotDigest, first.snapshot.snapshotDigest);
});

test('longitudinal comparison exposes regressions and committed snapshot tampering', t => {
  const baselineEvidence = fixtureEvidence('a'.repeat(64));
  const baseline = Observatory.buildSnapshot(baselineEvidence, []);
  const changed = fixtureEvidence('b'.repeat(64));
  changed.foundationCanaries.receipts.find(item => item.id === 'missing-recovery-holds').status = 'FAIL';
  const next = Observatory.buildSnapshot(changed, [baseline]);
  assert.equal(next.dimensions.find(item => item.id === 'REPAIRABILITY').state, 'REGRESSION_REQUIRES_REVIEW');
  assert.ok(next.comparison.regressions.some(item => item.dimensionId === 'REPAIRABILITY'));

  const sameSourceChangedEvidence = fixtureEvidence('a'.repeat(64));
  sameSourceChangedEvidence.foundationCanaries.receipts.find(item => item.id === 'missing-recovery-holds').status = 'FAIL';
  const sameSourceNext = Observatory.buildSnapshot(sameSourceChangedEvidence, [baseline]);
  assert.equal(sameSourceNext.dimensions.find(item => item.id === 'REPAIRABILITY').state, 'REGRESSION_REQUIRES_REVIEW');
  assert.ok(sameSourceNext.comparison.regressions.some(item => item.dimensionId === 'REPAIRABILITY'));
  const exactRepeat = Observatory.buildSnapshot(baselineEvidence, [baseline]);
  assert.equal(exactRepeat.snapshotId, baseline.snapshotId);
  assert.equal(exactRepeat.comparison.priorVerifiedSubjects, 0);

  const stateDir = fs.mkdtempSync(path.join(os.tmpdir(), 'axm-foundation-observatory-tamper-'));
  t.after(() => fs.rmSync(stateDir, { recursive: true, force: true }));
  const written = Observatory.run({ stateDir, evidence: baselineEvidence, allowSyntheticFixture: true });
  const file = path.join(written.runDir, 'snapshot.json');
  const disk = JSON.parse(fs.readFileSync(file, 'utf8'));
  disk.openGates = [];
  fs.writeFileSync(file, JSON.stringify(disk, null, 2) + '\n');
  assert.throws(() => Observatory.verifySnapshot(written.snapshot, written.runDir), /snapshot file changed/);
  assert.throws(() => Observatory.run({ stateDir, evidence: baselineEvidence, allowSyntheticFixture: true }), /snapshot digest changed/);
});

test('observatory contract and command are present and the active runtime does not import it', () => {
  const contract = JSON.parse(fs.readFileSync(path.join(ROOT, 'contracts', 'foundation-development-snapshot.schema.json'), 'utf8'));
  assert.equal(contract.$id, Observatory.SNAPSHOT_SCHEMA);
  assert.equal(fs.existsSync(path.join(ROOT, 'scripts', 'run-foundation-development-observatory.js')), true);
  const runtime = fs.readFileSync(path.join(ROOT, 'runtime', 'server.js'), 'utf8');
  assert.equal(runtime.includes('foundation-development-observatory-organ'), false);
});
