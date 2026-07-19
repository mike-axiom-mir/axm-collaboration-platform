'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const test = require('node:test');
const assert = require('node:assert/strict');
const Cycle = require('../training/reasoning-skill-cycle');
const Experience = require('../organs/reasoning-experience-organ');
const CapabilitySurvey = require('../organs/foundation-development-capability-survey-organ');
const OutputAdapterPlanner = require('../organs/foundation-development-capability-output-adapter-planner-organ');
const NativeInventory = require('../organs/foundation-capability-native-artifact-inventory-organ');
const Eligibility = require('../organs/foundation-native-evidence-eligibility-organ');
const Cell = require('../kernel/reasoning-experience-foundation-evidence-cell');

const ROOT = path.resolve(__dirname, '..');
const CURRENT_NATIVE = path.join(ROOT, 'state', 'foundation-capability-native-artifact-inventory-runs', 'foundation-capability-native-artifacts-c86ca7d4c226d9110303af30', 'batch.json');
const CURRENT_ADAPTER = path.join(ROOT, 'state', 'foundation-development-capability-output-adapter-runs', 'foundation-capability-output-adapters-7e2b4ba513378dfee03d34eb', 'batch.json');
const CURRENT_HAND = path.join(ROOT, 'state', 'foundation-development-hand-runs', 'foundation-development-hands-27a977fbb9b844c12640a2bc', 'batch.json');

function read(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }
function currentSources() { return { nativeBatch: read(CURRENT_NATIVE), adapterBatch: read(CURRENT_ADAPTER), handBatch: read(CURRENT_HAND) }; }
function policy() { return read(path.join(ROOT, 'training', 'TRAINING_POLICY.json')); }

function session(caseId) {
  const fixture = read(path.join(ROOT, 'training', 'reasoning-strategy-train.json'));
  const row = JSON.parse(JSON.stringify(fixture.cases[0]));
  row.caseId = caseId;
  row.sourceGroup = `native-evidence/${caseId}`;
  return Cycle.buildVerifiedSession(row, {
    sha256: 'b'.repeat(64),
    value: { usePermission: 'allowed', permissionBasis: 'test-owned native evidence fixture' }
  }, { at: null });
}

function receipt(caseId, negative) {
  const reasoning = session(caseId);
  const observed = reasoning.principleTrace.decision;
  return Experience.create(reasoning, {
    provider: 'axm-workshop-local',
    sourceGroup: `native-evidence/${caseId}`,
    experienceKind: 'REAL_LOCAL_LESSON',
    parentReceiptIds: [],
    interventionId: null,
    role: 'training',
    policyId: Experience.STANDING_POLICY_ID,
    usePermission: 'allowed',
    permissionBasis: 'test-owned local reasoning evidence',
    evaluator: {
      id: `independent-native-evidence-evaluator/${caseId}`,
      kind: 'frozen-test-evaluator',
      independent: true,
      sourceRef: `test://native-evidence/${caseId}`,
      sourceDigest: 'd'.repeat(64)
    }
  }, {
    observedDecisionValue: observed.value,
    observedActionId: observed.selectedActionId,
    expectedDecisionValue: observed.value,
    expectedActionId: negative ? `${observed.selectedActionId}-independent-expected` : observed.selectedActionId,
    behaviorMatched: !negative,
    outcomeVerified: true,
    strategyTags: negative ? ['independent-negative-observation'] : ['ask-blocking-unknown'],
    strategyLabelSource: 'INDEPENDENT_EVALUATOR',
    statement: negative ? 'The naturally observed decision did not match the independent expected action.' : 'The naturally observed decision matched the independent expected action.',
    worldMutations: 0,
    runtimePointerChanged: false,
    unexpectedSeams: []
  }, { at: null });
}

function declarationRecords() {
  return [
    'reasoning-experience-negative-observation.artifact-inventory.json',
    'reasoning-experience-negative-observation-v5.artifact-inventory.json',
    'typed-trace-independent-exam-intake.artifact-inventory.json'
  ].map(name => {
    const file = path.join(ROOT, 'capabilities', name);
    const bytes = fs.readFileSync(file);
    return {
      path: `capabilities/${name}`,
      bytes: bytes.length,
      sha256: NativeInventory.digest(bytes),
      status: 'VERIFIED_INVENTORY_DECLARATION',
      issue: null,
      declaration: JSON.parse(bytes.toString('utf8'))
    };
  });
}

function syntheticSources(t, receipts) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'axm-native-evidence-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const receiptDir = path.join(root, 'training', 'datasets', 'reasoning-receipts');
  fs.mkdirSync(receiptDir, { recursive: true });
  for (const item of receipts) fs.writeFileSync(path.join(receiptDir, `${item.receiptId}.json`), JSON.stringify(item, null, 2) + '\n');
  const { handBatch } = currentSources();
  const capabilityInventory = CapabilitySurvey.collectInventory({ capabilityDir: path.join(ROOT, 'capabilities') });
  const surveyBatch = CapabilitySurvey.buildBatch(handBatch, capabilityInventory);
  const adapterBatch = OutputAdapterPlanner.buildBatch(handBatch, surveyBatch);
  const declarations = declarationRecords();
  const nativeBatch = NativeInventory.buildBatch(adapterBatch, capabilityInventory, declarations, { root });
  NativeInventory.verifyBatch(nativeBatch, adapterBatch, capabilityInventory, declarations, null, { root });
  return { root, nativeBatch, adapterBatch, handBatch, capabilityInventory, declarations };
}

test('all 45 current v4 receipts are verified but none can fake the missing negative experience', () => {
  const sources = currentSources();
  const batch = Eligibility.buildBatch(sources.nativeBatch, sources.adapterBatch, sources.handBatch);
  assert.equal(Eligibility.verifyBatch(batch, sources.nativeBatch, sources.adapterBatch, sources.handBatch), true);
  assert.equal(batch.state, 'HOLD_NO_ELIGIBLE_NATIVE_EVIDENCE_CANDIDATES');
  assert.equal(batch.summary.artifactsExamined, 45);
  assert.equal(batch.summary.nativeReceiptsVerified, 45);
  assert.equal(batch.summary.realLocalArtifacts, 1);
  assert.equal(batch.summary.syntheticOrContractDerivedArtifacts, 44);
  assert.equal(batch.summary.positiveArtifacts, 45);
  assert.equal(batch.summary.negativeArtifacts, 0);
  assert.equal(batch.summary.eligibleEvidenceCandidates, 0);
  assert.equal(batch.summary.evidenceAdmissions, 0);
  assert.equal(batch.assessments.filter(item => item.state === 'HOLD_SYNTHETIC_OR_CONTRACT_DERIVED_EPISODE_NOT_REAL_LOCAL').length, 44);
  assert.equal(batch.assessments.filter(item => item.state === 'HOLD_REAL_LOCAL_EPISODE_HAS_NO_VERIFIED_NEGATIVE_OUTCOME').length, 1);
});

test('one genuine negative compatible receipt automatically becomes a sealed candidate but is not admitted', t => {
  const negative = receipt('genuine-negative', true);
  const sources = syntheticSources(t, [negative]);
  const batch = Eligibility.buildBatch(sources.nativeBatch, sources.adapterBatch, sources.handBatch, { root: sources.root });
  assert.equal(batch.state, 'ELIGIBLE_NATIVE_EVIDENCE_CANDIDATES_PRODUCED_NOT_ADMITTED');
  assert.equal(batch.summary.nativeReceiptsVerified, 1);
  assert.equal(batch.summary.realLocalArtifacts, 1);
  assert.equal(batch.summary.negativeArtifacts, 1);
  assert.equal(batch.summary.eligibleEvidenceCandidates, 1);
  assert.equal(batch.summary.genericAdapterExecutions, 1);
  assert.equal(batch.summary.evidenceAdmissions, 0);
  const assessment = batch.assessments[0];
  assert.equal(assessment.state, Cell.ELIGIBLE_STATE);
  assert.equal(assessment.native.permissionState, 'ALLOWED');
  assert.equal(assessment.native.sourceClass, 'REAL_LOCAL');
  assert.equal(assessment.native.observedOutcome, 'NEGATIVE');
  assert.ok(assessment.evidenceCandidate);
  assert.equal(assessment.evidenceCandidate.assessment.evidenceAdmission, 'NOT_ADMITTED');
  assert.equal(assessment.evidenceCandidate.authority.evidenceAdmission, false);
  assert.equal(Eligibility.verifyBatch(batch, sources.nativeBatch, sources.adapterBatch, sources.handBatch, null, { root: sources.root }), true);
});

test('all eligible artifacts are emitted without first-match or input-order selection', t => {
  const first = receipt('negative-one', true);
  const second = receipt('negative-two', true);
  const positive = receipt('positive-one', false);
  const sourcesA = syntheticSources(t, [first, positive, second]);
  const sourcesB = syntheticSources(t, [second, first, positive]);
  const batchA = Eligibility.buildBatch(sourcesA.nativeBatch, sourcesA.adapterBatch, sourcesA.handBatch, { root: sourcesA.root });
  const batchB = Eligibility.buildBatch(sourcesB.nativeBatch, sourcesB.adapterBatch, sourcesB.handBatch, { root: sourcesB.root });
  assert.equal(batchA.summary.eligibleEvidenceCandidates, 2);
  assert.equal(batchA.summary.evidenceCandidatesProduced, 2);
  assert.equal(batchA.summary.artifactSelections, 0);
  assert.deepEqual(batchA.assessments.map(item => [item.native.receiptId, item.state]), batchB.assessments.map(item => [item.native.receiptId, item.state]));
  assert.equal(batchA.batchDigest, batchB.batchDigest);
});

test('synthetic lineage, positive outcome, tampering, and changed source remain explicit holds', t => {
  const positive = receipt('positive-hold', false);
  const syntheticReasoning = session('synthetic-hold');
  const observed = syntheticReasoning.principleTrace.decision;
  const synthetic = Experience.create(syntheticReasoning, {
    provider: 'axm-workshop-local',
    sourceGroup: 'native-evidence/synthetic-hold',
    experienceKind: 'SYNTHETIC_COUNTEREXAMPLE',
    parentReceiptIds: [positive.receiptId],
    interventionId: 'test-intervention',
    role: 'training',
    policyId: Experience.STANDING_POLICY_ID,
    usePermission: 'allowed',
    permissionBasis: 'test-owned synthetic reasoning evidence',
    evaluator: {
      id: 'independent-native-evidence-evaluator/synthetic-hold',
      kind: 'frozen-test-evaluator',
      independent: true,
      sourceRef: 'test://native-evidence/synthetic-hold',
      sourceDigest: 'd'.repeat(64)
    }
  }, {
    observedDecisionValue: observed.value,
    observedActionId: observed.selectedActionId,
    expectedDecisionValue: observed.value,
    expectedActionId: `${observed.selectedActionId}-independent-expected`,
    behaviorMatched: false,
    outcomeVerified: true,
    strategyTags: ['independent-negative-observation'],
    strategyLabelSource: 'INDEPENDENT_EVALUATOR',
    statement: 'A synthetic intervention produced a negative counterexample.',
    worldMutations: 0,
    runtimePointerChanged: false,
    unexpectedSeams: []
  }, { at: null });
  const tampered = JSON.parse(JSON.stringify(receipt('tampered-hold', true)));
  tampered.receiptDigest = '0'.repeat(64);
  const sources = syntheticSources(t, [positive, synthetic, tampered]);
  const batch = Eligibility.buildBatch(sources.nativeBatch, sources.adapterBatch, sources.handBatch, { root: sources.root });
  assert.equal(batch.summary.eligibleEvidenceCandidates, 0);
  assert.ok(batch.assessments.some(item => item.state === 'HOLD_REAL_LOCAL_EPISODE_HAS_NO_VERIFIED_NEGATIVE_OUTCOME'));
  assert.ok(batch.assessments.some(item => item.state === 'HOLD_SYNTHETIC_OR_CONTRACT_DERIVED_EPISODE_NOT_REAL_LOCAL'));
  assert.ok(batch.assessments.some(item => item.state === 'HOLD_NATIVE_REASONING_EXPERIENCE_VERIFICATION_REFUSED'));

  const mutationSources = syntheticSources(t, [receipt('mutation-hold', true)]);
  let changed = false;
  const mutated = Eligibility.buildBatch(mutationSources.nativeBatch, mutationSources.adapterBatch, mutationSources.handBatch, {
    root: mutationSources.root,
    onAfterArtifactRead({ file }) {
      if (!changed) {
        changed = true;
        fs.appendFileSync(file, ' ');
      }
    }
  });
  assert.equal(mutated.summary.eligibleEvidenceCandidates, 0);
  assert.equal(mutated.summary.sourceBindingHolds, 1);
  assert.equal(mutated.assessments[0].state, 'HOLD_NATIVE_ARTIFACT_CHANGED_DURING_ASSESSMENT');
});

test('internally valid historical batches with older verifier sources remain visible but cannot contribute candidates', t => {
  const sources = syntheticSources(t, [receipt('stale-source-negative', true)]);
  const stateDir = path.join(sources.root, 'state', 'eligibility-stale');
  const stored = Eligibility.run(Object.assign({
    stateDir,
    policy: policy(),
    cellSourceBytes: Buffer.from('historical cell source')
  }, sources));
  assert.equal(stored.batch.summary.eligibleEvidenceCandidates, 1);
  const evidence = Eligibility.loadVerifiedEvidence({ stateDir });
  assert.equal(evidence.batches, 1);
  assert.equal(evidence.currentSourceBatches, 0);
  assert.equal(evidence.staleBatches, 1);
  assert.equal(evidence.eligibleCandidates.length, 0);
});

test('historical v4 verification labels remain summary-verifiable after the v5-compatible upgrade', t => {
  const sources = syntheticSources(t, [receipt('historical-v4-label', false)]);
  const current = Eligibility.buildBatch(sources.nativeBatch, sources.adapterBatch, sources.handBatch, { root: sources.root });
  const historical = JSON.parse(JSON.stringify(current));
  for (const assessment of historical.assessments) {
    if (assessment.native.verificationState === 'VERIFIED_BY_HARDCODED_V4_V5_RECEIPT_VERIFIER') {
      assessment.native.verificationState = 'VERIFIED_BY_HARDCODED_V4_RECEIPT_VERIFIER';
      assessment.assessmentId = `foundation-native-evidence-assessment-${Eligibility.digest(Object.assign({}, assessment, { assessmentId: null })).slice(0, 24)}`;
    }
  }
  historical.summary = Eligibility.expectedSummary(historical.assessments, historical.sourceHolds);
  historical.batchId = `foundation-native-evidence-eligibility-${Eligibility.digest({
    organId: Eligibility.ORGAN_ID,
    source: historical.source,
    assessments: historical.assessments,
    sourceHolds: historical.sourceHolds
  }).slice(0, 24)}`;
  historical.batchDigest = Eligibility.digest(Object.assign({}, historical, { batchDigest: null }));

  assert.equal(historical.summary.nativeReceiptsVerified, 1);
  assert.equal(Eligibility.verifyBatch(historical), true);
});

test('private eligibility batches are content-addressed, reusable, and tamper-evident', t => {
  const sources = syntheticSources(t, [receipt('stored-negative', true)]);
  const stateDir = path.join(sources.root, 'state', 'eligibility');
  const options = Object.assign({ stateDir, policy: policy() }, sources);
  const first = Eligibility.run(options);
  const second = Eligibility.run(options);
  assert.equal(first.reused, false);
  assert.equal(second.reused, true);
  assert.equal(first.batch.batchDigest, second.batch.batchDigest);
  const batchFile = path.join(first.runDir, 'batch.json');
  const changed = read(batchFile);
  changed.summary.evidenceAdmissions = 1;
  fs.writeFileSync(batchFile, JSON.stringify(changed, null, 2) + '\n');
  assert.throws(() => Eligibility.run(options), /batch digest changed|summary changed|claim ceiling/);
});

test('policy, contract, command, runtime separation, and zero authority stay explicit', () => {
  const disabled = policy();
  disabled.automaticFoundationNativeEvidenceEligibilityAssessment = false;
  assert.throws(() => Eligibility.loadPolicy({ policy: disabled }), /not enabled/);
  const contract = read(path.join(ROOT, 'contracts', 'foundation-native-evidence-eligibility-batch.schema.json'));
  assert.equal(contract.$id, Eligibility.BATCH_SCHEMA);
  assert.equal(contract.additionalProperties, false);
  const pkg = read(path.join(ROOT, 'package.json'));
  assert.equal(pkg.scripts['assess:foundation-native-evidence-eligibility'], 'node scripts/run-foundation-native-evidence-eligibility.js');
  const runtime = fs.readFileSync(path.join(ROOT, 'runtime', 'server.js'), 'utf8');
  assert.doesNotMatch(runtime, /foundation-native-evidence-eligibility|reasoning-experience-foundation-evidence-cell/);
  const status = read(path.join(ROOT, 'STATUS.json'));
  assert.match(status.foundationNativeEvidenceEligibilityOrgan || '', /^TEST_/);
  const bom = read(path.join(ROOT, 'MODEL_BOM.json'));
  assert.equal(bom.foundationNativeEvidenceEligibility.runtimeAuthority, false);
  assert.equal(bom.foundationNativeEvidenceEligibility.evidenceAdmissionAuthority, false);
});
