'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const test = require('node:test');
const assert = require('node:assert/strict');
const HandPlanner = require('../organs/foundation-development-hand-planner-organ');
const OutputAdapterPlanner = require('../organs/foundation-development-capability-output-adapter-planner-organ');
const EnvelopeAdapter = require('../organs/foundation-evidence-envelope-adapter-organ');
const Exam = require('../organs/foundation-capability-output-adapter-fixture-exam-organ');

const ROOT = path.resolve(__dirname, '..');
function clone(value) { return JSON.parse(JSON.stringify(value)); }

function fixtureHand(suffix = 'a') {
  const hand = {
    schema: HandPlanner.HAND_SCHEMA,
    handRequestId: `foundation-evidence-hand-${suffix.repeat(24).slice(0, 24)}`,
    handRequestDigest: null,
    source: {
      frontierBatchId: `foundation-development-frontier-${suffix.repeat(24).slice(0, 24)}`,
      frontierBatchDigest: suffix.repeat(64).slice(0, 64),
      frontierRequestId: `foundation-development-request-${suffix.repeat(24).slice(0, 24)}`,
      frontierRequestDigest: suffix.repeat(64).slice(0, 64),
      dimensionId: 'negative-reasoning-experience',
      observedState: 'HOLD',
      classification: 'EVIDENCE_GATE',
      deltas: []
    },
    evidenceNeed: {
      schema: HandPlanner.EVIDENCE_NEED_SCHEMA,
      evidenceKind: 'PASSIVE_VERIFIED_REAL_LOCAL_NEGATIVE_EPISODE',
      acquisitionMode: 'PASSIVE_LOCAL_OBSERVATION',
      sourceConstraint: 'Only permissioned already-occurring evidence may become a candidate.',
      permissionRequired: true,
      independentFromCandidate: true,
      eventInductionAllowed: false,
      candidateMayAuthorExpectedResult: false,
      acceptanceEvidence: ['content seal', 'independent negative outcome']
    },
    handFamily: 'NON_INDUCING_LOCAL_EVENT_OBSERVATION_HAND',
    proposedContract: {
      inputKind: 'PERMISSIONED_EXISTING_LOCAL_EPISODE_RECEIPT',
      outputKind: EnvelopeAdapter.OUTPUT_KIND,
      requiredCapabilityTokens: ['EXPLICIT_USE_PERMISSION_REQUIRED'],
      requiredBehaviors: ['preserve permission and lineage'],
      forbiddenBehaviors: ['relabel evidence'],
      recoveryRequirement: 'Preserve source state and the open evidence gate.',
      implementationState: 'NOT_BUILT_OR_SELECTED'
    },
    selection: {
      prioritySelected: false,
      existingCapabilityMatch: 'NOT_SEARCHED',
      newOrganNeed: 'UNASSESSED',
      implementationSelected: false
    },
    unresolved: ['independent-acceptance-result'],
    state: 'REVIEWABLE_EVIDENCE_HAND_REQUEST_NOT_BUILT_OR_SELECTED',
    authority: {
      evidenceAcquisition: false,
      eventInduction: false,
      prioritySelection: false,
      capabilityClaim: false,
      organNeedClaim: false,
      implementationBuild: false,
      trainingAdmission: false,
      repairSelection: false,
      modelChange: false,
      permissionGrant: false,
      runtimePromotion: false,
      canonChange: false,
      worldAction: false
    },
    boundary: 'Synthetic hand fixture only.'
  };
  hand.handRequestDigest = Exam.digest(Object.assign({}, hand, { handRequestDigest: null }));
  return hand;
}

function fixtureHandBatch(hands) {
  const batch = {
    schema: HandPlanner.BATCH_SCHEMA,
    batchId: `foundation-development-hands-${Exam.digest(hands).slice(0, 24)}`,
    batchDigest: null,
    organ: { id: HandPlanner.ORGAN_ID, learnedWeights: false, dimensionNameRules: false },
    source: { frontierBatchId: 'foundation-development-frontier-fixture', frontierBatchDigest: '1'.repeat(64) },
    hands,
    holds: [],
    summary: {
      sourceFrontierRequests: hands.length,
      evidenceHandRequests: hands.length,
      machineReadableNeedHolds: 0,
      externalEvidenceIntakeHands: 0,
      passiveObservationHands: hands.length,
      independentRegressionExamHands: 0,
      prioritiesSelected: 0,
      capabilitiesClaimed: 0,
      organsRequired: 0,
      implementationsBuilt: 0,
      trainingAdmissions: 0,
      permissionGrants: 0,
      promotions: 0,
      worldActions: 0
    },
    state: hands.length ? 'EVIDENCE_HAND_REQUESTS_PROPOSED' : 'NO_ELIGIBLE_EVIDENCE_HAND_REQUESTS',
    authority: {
      privateProposalTraceWrite: true,
      evidenceAcquisition: false,
      eventInduction: false,
      prioritySelection: false,
      capabilityClaim: false,
      organNeedClaim: false,
      implementationBuild: false,
      trainingAdmission: false,
      repairSelection: false,
      modelChange: false,
      permissionGrant: false,
      runtimePromotion: false,
      canonChange: false,
      worldAction: false
    },
    boundary: 'Synthetic hand-batch fixture only.'
  };
  batch.batchDigest = Exam.digest(Object.assign({}, batch, { batchDigest: null }));
  HandPlanner.verifyBatch(batch);
  return batch;
}

function fixtureRequest(hand, suffix = 'b', inputKind = 'axm.mirror.synthetic-native-receipt/v1') {
  const request = {
    schema: OutputAdapterPlanner.REQUEST_SCHEMA,
    adapterRequestId: null,
    adapterRequestDigest: null,
    source: {
      surveyBatchId: `foundation-capability-survey-${suffix.repeat(24).slice(0, 24)}`,
      surveyBatchDigest: suffix.repeat(64).slice(0, 64),
      handRequestId: hand.handRequestId,
      handRequestDigest: hand.handRequestDigest,
      handFamily: hand.handFamily,
      capabilityId: `axm.mirror.declared-capability/synthetic-${suffix}/v1`,
      declarationDigest: suffix.repeat(64).slice(0, 64),
      declarationPath: `synthetic/${suffix}.json`,
      declarationFileSha256: suffix.repeat(64).slice(0, 64),
      implementationOrganId: `axm.mirror.synthetic-${suffix}-organ/v1`,
      implementationSourceFiles: [{ path: `organs/synthetic-${suffix}.js`, sha256: suffix.repeat(64).slice(0, 64) }]
    },
    adapterContract: {
      inputKinds: [inputKind],
      outputKind: EnvelopeAdapter.OUTPUT_KIND,
      requiredCapabilityTokens: ['EXPLICIT_USE_PERMISSION_REQUIRED'],
      requiredPreservations: ['CLOSED_AUTHORITY_PRESERVED'],
      forbiddenTransformations: ['RELABEL_EVIDENCE'],
      recoveryRequirement: 'Preserve all source state.',
      implementationState: 'NOT_BUILT_OR_SELECTED'
    },
    requiredIndependentArtifacts: ['INDEPENDENT_OUTPUT_CONTRACT_PREDICATES'],
    result: {
      adapterBuilt: false,
      adapterSelected: false,
      sourceExecuted: false,
      evidenceProduced: false,
      capabilitySelected: false,
      operationalFit: 'UNTESTED',
      newOrganNeed: 'UNASSESSED'
    },
    state: 'MODULAR_OUTPUT_ADAPTER_REQUESTED_NOT_BUILT_OR_SELECTED',
    authority: {
      privateProposalTraceWrite: true,
      sourceExecution: false,
      adapterBuild: false,
      adapterSelection: false,
      capabilitySelection: false,
      operationalFitClaim: false,
      newOrganNeedClaim: false,
      evidenceAcquisition: false,
      evidenceRelabeling: false,
      trainingAdmission: false,
      permissionGrant: false,
      runtimePromotion: false,
      canonChange: false,
      worldAction: false
    },
    boundary: 'Synthetic adapter-request fixture only.'
  };
  request.adapterRequestId = `foundation-capability-output-adapter-${Exam.digest(Object.assign({}, request, { adapterRequestId: null, adapterRequestDigest: null })).slice(0, 24)}`;
  request.adapterRequestDigest = Exam.digest(Object.assign({}, request, { adapterRequestDigest: null }));
  OutputAdapterPlanner.verifyRequest(request);
  return request;
}

function fixtureAdapterBatch(handBatch, requests) {
  const batch = {
    schema: OutputAdapterPlanner.BATCH_SCHEMA,
    batchId: `foundation-capability-output-adapters-${Exam.digest(requests).slice(0, 24)}`,
    batchDigest: null,
    organ: { id: OutputAdapterPlanner.ORGAN_ID, learnedWeights: false, sourceExecution: false, adapterBuild: false, firstMatchSelection: false },
    source: {
      handBatchId: handBatch.batchId,
      handBatchDigest: handBatch.batchDigest,
      surveyBatchId: 'foundation-capability-survey-fixture',
      surveyBatchDigest: '2'.repeat(64)
    },
    requests,
    holds: [],
    summary: {
      evidenceHandRequests: handBatch.hands.length,
      partialOutputWitnesses: requests.length,
      outputAdapterRequests: requests.length,
      handsWithoutPartialOutputWitnesses: 0,
      adaptersBuilt: 0,
      adaptersSelected: 0,
      sourceExecutions: 0,
      capabilitiesSelected: 0,
      operationalFitsClaimed: 0,
      newOrgansRequired: 0,
      evidenceAcquisitions: 0,
      evidenceRelabelings: 0,
      trainingAdmissions: 0,
      permissionGrants: 0,
      promotions: 0,
      worldActions: 0
    },
    state: requests.length ? 'MODULAR_OUTPUT_ADAPTER_REQUESTS_PROPOSED' : 'NO_PARTIAL_OUTPUT_WITNESSES_TO_ADAPT',
    authority: {
      privateProposalTraceWrite: true,
      sourceExecution: false,
      adapterBuild: false,
      adapterSelection: false,
      capabilitySelection: false,
      operationalFitClaim: false,
      newOrganNeedClaim: false,
      evidenceAcquisition: false,
      evidenceRelabeling: false,
      trainingAdmission: false,
      permissionGrant: false,
      runtimePromotion: false,
      canonChange: false,
      worldAction: false
    },
    boundary: 'Synthetic adapter-request batch fixture only.'
  };
  batch.batchDigest = Exam.digest(Object.assign({}, batch, { batchDigest: null }));
  OutputAdapterPlanner.verifyBatch(batch);
  return batch;
}

function fixtureSet() {
  const hands = [fixtureHand('a'), fixtureHand('c')];
  const handBatch = fixtureHandBatch(hands);
  const requests = [
    fixtureRequest(hands[0], 'b', 'axm.mirror.synthetic-native-receipt/v1'),
    fixtureRequest(hands[1], 'd', 'axm.mirror.another-native-receipt/v9')
  ];
  return { handBatch, adapterRequestBatch: fixtureAdapterBatch(handBatch, requests) };
}

function policy() {
  return {
    schema: 'axm.mirror.training-policy/v1',
    automaticFoundationCapabilityOutputAdapterFixtureExams: true,
    foundationCapabilityOutputAdapterFixtureExamScope: 'synthetic-only-independent-fixtures-and-output-predicates-no-native-source-execution-no-real-evidence-no-selection',
    automaticRuntimePromotion: false,
    automaticCanonPromotion: false,
    automaticAuthorityGrowth: false
  };
}

test('independent examiner passes every bounded synthetic case while preserving the evidence ceiling', () => {
  const fixtures = fixtureSet();
  const batch = Exam.buildBatch(fixtures.handBatch, fixtures.adapterRequestBatch);
  assert.equal(Exam.verifyBatch(batch, fixtures.handBatch, fixtures.adapterRequestBatch), true);
  assert.equal(batch.state, 'SYNTHETIC_ADAPTER_FIXTURE_EXAMS_PASSED_INSTRUMENT_ONLY');
  assert.equal(batch.summary.adapterRequestsExamined, 2);
  assert.equal(batch.summary.independentFixtureCasesAuthored, 44);
  assert.equal(batch.summary.syntheticAdapterExecutions, 46);
  assert.equal(batch.summary.failedFixtureCases, 0);
  assert.equal(batch.summary.realNativeArtifactsAdapted, 0);
  assert.equal(batch.summary.nativeSourcesExecuted, 0);
  assert.equal(batch.summary.adapterImplementationsSelected, 0);
  assert.equal(batch.summary.operationalFitsClaimed, 0);
  assert.equal(batch.summary.evidenceAdmissions, 0);
  assert.ok(Object.values(batch.results[0].sourceState).includes(true));
});

test('unseen output kinds, key-safe transport, native PASS labels, and output tampering are independently judged', () => {
  const fixtures = fixtureSet();
  const batch = Exam.buildBatch(fixtures.handBatch, fixtures.adapterRequestBatch);
  for (const result of batch.results) {
    const byId = new Map(result.caseResults.map(item => [item.caseId, item]));
    assert.deepEqual([byId.get('UNSEEN_NATIVE_OUTPUT_KIND').observed, byId.get('UNSEEN_NATIVE_OUTPUT_KIND').passed], ['ACCEPT', true]);
    assert.deepEqual([byId.get('PUBLIC_PROTOTYPE_FIELD_PRESERVED').observed, byId.get('PUBLIC_PROTOTYPE_FIELD_PRESERVED').passed], ['ACCEPT', true]);
    assert.deepEqual([byId.get('CONSTRUCTOR_DATA_FIELD_PRESERVED').observed, byId.get('CONSTRUCTOR_DATA_FIELD_PRESERVED').passed], ['ACCEPT', true]);
    assert.deepEqual([byId.get('OWN_PROTO_DATA_FIELD_PRESERVED_WITHOUT_POLLUTION').observed, byId.get('OWN_PROTO_DATA_FIELD_PRESERVED_WITHOUT_POLLUTION').passed], ['ACCEPT', true]);
    assert.deepEqual([byId.get('POLLUTED_INPUT_PROTOTYPE').observed, byId.get('POLLUTED_INPUT_PROTOTYPE').passed], ['REFUSE', true]);
    assert.deepEqual([byId.get('ACCESSOR_INPUT_WITHOUT_DATA_READ').observed, byId.get('ACCESSOR_INPUT_WITHOUT_DATA_READ').passed], ['REFUSE', true]);
    assert.deepEqual([byId.get('NATIVE_PASS_LABEL_REMAINS_UNADMITTED').observed, byId.get('NATIVE_PASS_LABEL_REMAINS_UNADMITTED').passed], ['ACCEPT', true]);
    assert.deepEqual([byId.get('CONTENT_AWARE_OUTPUT_TAMPER').observed, byId.get('CONTENT_AWARE_OUTPUT_TAMPER').passed], ['REFUSE', true]);
  }
});

test('request and hand ordering cannot select or change an adapter exam result', () => {
  const fixtures = fixtureSet();
  const forward = Exam.buildBatch(fixtures.handBatch, fixtures.adapterRequestBatch);
  const reversedHands = clone(fixtures.handBatch);
  reversedHands.hands.reverse();
  reversedHands.batchDigest = Exam.digest(Object.assign({}, reversedHands, { batchDigest: null }));
  const reversedRequests = clone(fixtures.adapterRequestBatch);
  reversedRequests.source.handBatchDigest = reversedHands.batchDigest;
  reversedRequests.requests.reverse();
  reversedRequests.batchDigest = Exam.digest(Object.assign({}, reversedRequests, { batchDigest: null }));
  const reversed = Exam.buildBatch(reversedHands, reversedRequests);
  assert.deepEqual(forward.results.map(item => item.adapterRequestId), reversed.results.map(item => item.adapterRequestId));
  assert.deepEqual(forward.results.map(item => item.caseResults), reversed.results.map(item => item.caseResults));
});

test('an empty adapter-request batch creates an explicit no-exam state without pretending success', () => {
  const handBatch = fixtureHandBatch([]);
  const adapterRequestBatch = fixtureAdapterBatch(handBatch, []);
  const batch = Exam.buildBatch(handBatch, adapterRequestBatch);
  assert.equal(batch.state, 'NO_OUTPUT_ADAPTER_REQUESTS_TO_EXAM');
  assert.equal(batch.results.length, 0);
  assert.equal(batch.summary.reusableAdapterImplementationsExamined, 0);
  assert.equal(batch.summary.syntheticAdapterExecutions, 0);
});

test('immutable run reuse, tamper refusal, policy gate, contract, and runtime exclusion stay explicit', () => {
  const fixtures = fixtureSet();
  const stateDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mirror-adapter-exam-'));
  const options = Object.assign({}, fixtures, { stateDir, policy: policy() });
  const first = Exam.run(options);
  const second = Exam.run(options);
  assert.equal(first.reused, false);
  assert.equal(second.reused, true);
  const sourceDrift = Exam.buildBatch(fixtures.handBatch, fixtures.adapterRequestBatch, { examinerSourceBytes: 'changed examiner source' });
  assert.notEqual(sourceDrift.batchId, first.batch.batchId);
  const batchFile = path.join(first.runDir, 'batch.json');
  const tampered = JSON.parse(fs.readFileSync(batchFile, 'utf8'));
  tampered.summary.operationalFitsClaimed = 1;
  fs.writeFileSync(batchFile, JSON.stringify(tampered, null, 2) + '\n');
  assert.throws(() => Exam.run(options), /batch digest changed/);
  assert.throws(() => Exam.loadPolicy(Object.assign({}, options, { policy: Object.assign(policy(), { automaticFoundationCapabilityOutputAdapterFixtureExams: false }) })), /not enabled/);

  const schema = JSON.parse(fs.readFileSync(path.join(ROOT, 'contracts', 'foundation-capability-output-adapter-fixture-exam-batch-v2.schema.json'), 'utf8'));
  assert.equal(schema.$id, Exam.BATCH_SCHEMA);
  const packageJson = require('../package.json');
  assert.equal(packageJson.scripts['examine:foundation-capability-output-adapters'], 'node scripts/run-foundation-capability-output-adapter-fixture-exams.js');
  const executor = fs.readFileSync(path.join(ROOT, 'scripts', 'run-foundation-development-observation-executor.js'), 'utf8');
  const workshop = fs.readFileSync(path.join(ROOT, 'scripts', 'run-workshop-steward-curriculum.js'), 'utf8');
  assert.match(executor, /foundation-capability-output-adapter-fixture-exam-organ/);
  assert.match(workshop, /foundation-capability-output-adapter-fixture-exam-organ/);
  const integrity = require('../kernel/foundation-public-body-integrity-cell').inspect(ROOT);
  assert.ok(integrity.coverage.jsonParsed.includes('contracts/foundation-capability-output-adapter-fixture-exam-batch-v2.schema.json'));
  assert.equal(first.batch.source.examinerSourcePath, 'organs/foundation-capability-output-adapter-fixture-exam-organ.js');
  assert.match(first.batch.source.examinerSourceSha256, /^[a-f0-9]{64}$/);
  assert.equal(first.batch.source.transportSourcePath, 'kernel/key-safe-json-transport-cell.js');
  assert.match(first.batch.source.transportSourceSha256, /^[a-f0-9]{64}$/);
  const runtime = fs.readFileSync(path.join(ROOT, 'runtime', 'server.js'), 'utf8');
  assert.equal(runtime.includes('foundation-capability-output-adapter-fixture-exam-organ'), false);
});
