'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const LanguageModel = require('../learning/typed-trace-language-model');
const HandPlanner = require('./foundation-development-hand-planner-organ');
const CapabilitySurvey = require('./foundation-development-capability-survey-organ');
const ImmutableBatchStore = require('../kernel/immutable-batch-store');

const ORGAN_ID = 'axm.mirror.foundation-development-capability-affordance-exam-planner-organ/v2';
const REQUEST_SCHEMA = 'axm.mirror.foundation-development-capability-affordance-exam-request/v1';
const BATCH_SCHEMA = 'axm.mirror.foundation-development-capability-affordance-exam-batch/v2';
const ROOT = path.resolve(__dirname, '..');
const DEFAULT_SURVEY_STATE_DIR = CapabilitySurvey.DEFAULT_STATE_DIR;
const DEFAULT_HAND_STATE_DIR = HandPlanner.DEFAULT_STATE_DIR;
const DEFAULT_STATE_DIR = path.join(ROOT, 'state', 'foundation-development-capability-affordance-exam-runs');

function stable(value) { return LanguageModel.stable(value); }
function digest(value) {
  const encoded = typeof value === 'string' || Buffer.isBuffer(value) ? value : JSON.stringify(stable(value));
  return crypto.createHash('sha256').update(encoded === undefined ? 'undefined' : encoded).digest('hex');
}
function json(value) { return JSON.stringify(stable(value), null, 2) + '\n'; }
function same(left, right) { return JSON.stringify(stable(left)) === JSON.stringify(stable(right)); }
function boundedChild(parent, child) {
  const resolvedParent = path.resolve(parent);
  const resolved = path.resolve(resolvedParent, child);
  if (path.dirname(resolved) !== resolvedParent) throw new Error(`foundation affordance exam path escapes its parent: ${child}`);
  return resolved;
}

function loadPolicy(options = {}) {
  const policyPath = path.resolve(options.policyPath || path.join(ROOT, 'training', 'TRAINING_POLICY.json'));
  const policy = options.policy || JSON.parse(fs.readFileSync(policyPath, 'utf8'));
  if (!policy || policy.schema !== 'axm.mirror.training-policy/v1') throw new Error('foundation affordance exam planner requires the Mirror training policy');
  if (policy.automaticFoundationDevelopmentCapabilityAffordanceExamPlanning !== true) throw new Error('automatic foundation capability affordance exam planning is not enabled');
  if (policy.automaticRuntimePromotion !== false || policy.automaticCanonPromotion !== false || policy.automaticAuthorityGrowth !== false) throw new Error('foundation affordance exam planner refuses runtime, canon, or authority growth');
  if (!String(policy.foundationDevelopmentCapabilityAffordanceExamPlanningScope || '').includes('one-request-per-hand-witness-pair-no-source-execution-no-fixture-or-expected-result-authoring')) throw new Error('foundation affordance exam planning scope is incomplete');
  return policy;
}

function loadCurrentHandBatch(options = {}) {
  if (options.handBatch) {
    HandPlanner.verifyBatch(options.handBatch);
    return options.handBatch;
  }
  const status = JSON.parse(fs.readFileSync(path.resolve(options.statusPath || path.join(ROOT, 'STATUS.json')), 'utf8'));
  const batchId = (status.foundationDevelopmentHandPlannerEvidence || {}).currentBatchId;
  if (!/^foundation-development-hands-[a-f0-9]{24}$/.test(String(batchId || ''))) throw new Error('foundation affordance exam current hand batch id is missing');
  const stateDir = path.resolve(options.handStateDir || DEFAULT_HAND_STATE_DIR);
  const runDir = boundedChild(stateDir, batchId);
  const batch = JSON.parse(fs.readFileSync(path.join(runDir, 'batch.json'), 'utf8'));
  HandPlanner.verifyBatch(batch, null, runDir);
  return batch;
}

function validateSurveyInventory(inventory) {
  for (const record of inventory || []) {
    if (record.status === 'VERIFIED_DECLARATION') CapabilitySurvey.validateDeclaration(record.declaration);
  }
  return true;
}

function loadCurrentSurveyBatch(options = {}, handBatch) {
  const inventory = options.inventory || CapabilitySurvey.collectInventory(options);
  validateSurveyInventory(inventory);
  if (options.surveyBatch) {
    CapabilitySurvey.verifyBatch(options.surveyBatch, handBatch, inventory);
    return options.surveyBatch;
  }
  const status = JSON.parse(fs.readFileSync(path.resolve(options.statusPath || path.join(ROOT, 'STATUS.json')), 'utf8'));
  const batchId = (status.foundationDevelopmentCapabilitySurveyEvidence || {}).currentBatchId;
  if (!/^foundation-capability-survey-[a-f0-9]{24}$/.test(String(batchId || ''))) throw new Error('foundation affordance exam current capability survey id is missing');
  const stateDir = path.resolve(options.surveyStateDir || DEFAULT_SURVEY_STATE_DIR);
  const runDir = boundedChild(stateDir, batchId);
  const batch = JSON.parse(fs.readFileSync(path.join(runDir, 'batch.json'), 'utf8'));
  CapabilitySurvey.verifyBatch(batch, handBatch, inventory, runDir);
  return batch;
}

function machineCase(caseId, family, fields = {}) {
  return Object.assign({
    caseId,
    family,
    fixtureStatus: 'INDEPENDENT_FIXTURE_NOT_SUPPLIED',
    expectedPredicateStatus: 'INDEPENDENT_PREDICATE_NOT_SUPPLIED',
    candidateMayAuthorFixture: false,
    candidateMayAuthorExpectedResult: false,
    executionState: 'NOT_EXECUTED'
  }, fields);
}

function planCaseRequirements(hand) {
  const contract = hand.proposedContract;
  const cases = (contract.requiredCapabilityTokens || []).slice().sort().map(token => machineCase(
    `required-token-${digest(token).slice(0, 12)}`,
    'REQUIRED_TOKEN_AFFORDANCE',
    { sourceAuthority: 'HAND_MACHINE_CAPABILITY_TOKEN', capabilityToken: token, expectedObservation: 'TOKEN_BEHAVIOR_OBSERVED' }
  ));
  cases.push(machineCase('typed-input-acceptance', 'TYPED_INPUT_ACCEPTANCE', {
    sourceAuthority: 'HAND_MACHINE_CONTRACT', inputKind: contract.inputKind,
    outputKind: contract.outputKind, expectedObservation: 'DECLARED_OUTPUT_KIND_WITH_BOUND_LINEAGE'
  }));
  cases.push(machineCase('wrong-input-kind-refusal', 'WRONG_INPUT_KIND_REFUSAL', {
    sourceAuthority: 'HAND_MACHINE_CONTRACT', refusedInputKind: 'INDEPENDENT_MISMATCH_FIXTURE_REQUIRED',
    expectedObservation: 'REFUSED_WITHOUT_EVIDENCE_OR_AUTHORITY'
  }));
  if (hand.evidenceNeed.permissionRequired === true) cases.push(machineCase('permission-absent-refusal', 'PERMISSION_ABSENT_REFUSAL', {
    sourceAuthority: 'HAND_MACHINE_EVIDENCE_NEED', expectedObservation: 'REFUSED_WITHOUT_PERMISSION_INFERENCE'
  }));
  if (hand.evidenceNeed.eventInductionAllowed === false) cases.push(machineCase('event-induction-refusal', 'EVENT_INDUCTION_REFUSAL', {
    sourceAuthority: 'HAND_MACHINE_EVIDENCE_NEED', expectedObservation: 'NO_EVENT_INDUCTION'
  }));
  cases.push(machineCase('source-hash-drift-refusal', 'SOURCE_HASH_DRIFT_REFUSAL', {
    sourceAuthority: 'DECLARATION_SOURCE_HASH_BINDING', expectedObservation: 'STALE_IMPLEMENTATION_REFUSED'
  }));
  cases.push(machineCase('bounded-recovery', 'RECOVERY_NONMUTATION', {
    sourceAuthority: 'HAND_MACHINE_RECOVERY_BOUNDARY', expectedObservation: 'SOURCE_AND_PRIOR_EVIDENCE_UNCHANGED'
  }));
  cases.push(machineCase('authority-closure', 'AUTHORITY_CLOSURE', {
    sourceAuthority: 'HAND_AND_DECLARATION_CLOSED_AUTHORITY', expectedObservation: 'ZERO_PERMISSION_TRAINING_RUNTIME_CANON_OR_WORLD_AUTHORITY'
  }));
  return cases.sort((a, b) => a.caseId.localeCompare(b.caseId));
}

function buildExamRequest(hand, surveyResult, inventoryRecord, surveyBatch) {
  if (!inventoryRecord || inventoryRecord.status !== 'VERIFIED_DECLARATION') throw new Error('foundation affordance exam requires a verified declaration record');
  const declaration = inventoryRecord.declaration;
  const witness = (surveyResult.declaredCompatibilityWitnesses || []).find(item => item.capabilityId === declaration.capabilityId && item.declarationDigest === declaration.declarationDigest);
  if (!witness) throw new Error('foundation affordance exam requires an exact declared compatibility witness');
  if (surveyResult.handRequestId !== hand.handRequestId || surveyResult.handRequestDigest !== hand.handRequestDigest) throw new Error('foundation affordance exam hand binding changed');
  const request = {
    schema: REQUEST_SCHEMA,
    examRequestId: null,
    examRequestDigest: null,
    source: {
      surveyBatchId: surveyBatch.batchId,
      surveyBatchDigest: surveyBatch.batchDigest,
      handRequestId: hand.handRequestId,
      handRequestDigest: hand.handRequestDigest,
      capabilityId: declaration.capabilityId,
      declarationDigest: declaration.declarationDigest,
      declarationPath: inventoryRecord.path,
      declarationFileSha256: inventoryRecord.sha256,
      implementationOrganId: declaration.implementation.organId,
      implementationSourceFiles: declaration.implementation.sourceFiles.slice().sort((a, b) => a.path.localeCompare(b.path))
    },
    examBoundary: {
      handFamily: hand.handFamily,
      inputKind: hand.proposedContract.inputKind,
      outputKind: hand.proposedContract.outputKind,
      requiredCapabilityTokens: hand.proposedContract.requiredCapabilityTokens.slice().sort(),
      permissionRequired: hand.evidenceNeed.permissionRequired,
      independentFromCandidate: hand.evidenceNeed.independentFromCandidate,
      eventInductionAllowed: hand.evidenceNeed.eventInductionAllowed,
      candidateMayAuthorExpectedResult: false,
      humanProseCaseAuthority: false,
      declarationCompatibilityCeiling: 'WITNESS_NOT_OPERATIONAL_FIT'
    },
    caseRequirements: planCaseRequirements(hand),
    requiredIndependentArtifacts: [
      'INDEPENDENT_FIXTURE_SET',
      'INDEPENDENT_EXPECTED_PREDICATES',
      'PRE_AND_POST_STATE_DIGESTS',
      'SANDBOXED_CAPABILITY_ADAPTER',
      'SOURCE_HASH_VERIFICATION'
    ].concat(hand.evidenceNeed.permissionRequired ? ['ATTRIBUTED_PERMISSION_RECORD'] : []).sort(),
    result: {
      examExecution: 'NOT_RUN',
      fixturesSupplied: false,
      expectedPredicatesSupplied: false,
      sourceExecuted: false,
      evidenceProduced: false,
      capabilitySelected: false,
      operationalFit: 'UNTESTED',
      newOrganNeed: 'UNASSESSED'
    },
    state: 'INDEPENDENT_AFFORDANCE_EXAM_REQUESTED_NOT_EXECUTED',
    authority: {
      privateProposalTraceWrite: true,
      sourceExecution: false,
      fixtureAuthoring: false,
      expectedResultAuthoring: false,
      capabilitySelection: false,
      operationalFitClaim: false,
      newOrganNeedClaim: false,
      implementationBuild: false,
      evidenceAcquisition: false,
      eventInduction: false,
      trainingAdmission: false,
      permissionGrant: false,
      runtimePromotion: false,
      canonChange: false,
      worldAction: false
    },
    boundary: 'This request translates one exact hand/declaration witness into machine-defined independent exam obligations. It does not provide fixtures or expected predicates, execute source, select the capability, claim operational fit, decide organ need, acquire evidence, induce events, build, train, grant, promote, or act.'
  };
  request.examRequestId = `foundation-capability-affordance-exam-${digest(Object.assign({}, request, { examRequestId: null, examRequestDigest: null })).slice(0, 24)}`;
  request.examRequestDigest = digest(Object.assign({}, request, { examRequestDigest: null }));
  return request;
}

function buildBatch(handBatch, surveyBatch) {
  HandPlanner.verifyBatch(handBatch);
  CapabilitySurvey.verifyBatch(surveyBatch);
  if (surveyBatch.source.handBatchId !== handBatch.batchId || surveyBatch.source.handBatchDigest !== handBatch.batchDigest) throw new Error('foundation affordance exam survey and hand batch binding changed');
  const hands = new Map((handBatch.hands || []).map(hand => [hand.handRequestId, hand]));
  const inventory = new Map();
  for (const record of surveyBatch.inventory || []) {
    if (record.status === 'VERIFIED_DECLARATION') inventory.set(`${record.declaration.capabilityId}:${record.declaration.declarationDigest}`, record);
  }
  const requests = [];
  const holds = [];
  for (const result of (surveyBatch.results || []).slice().sort((a, b) => a.handRequestId.localeCompare(b.handRequestId))) {
    const hand = hands.get(result.handRequestId);
    if (!hand || hand.handRequestDigest !== result.handRequestDigest) throw new Error('foundation affordance exam survey result has no exact hand');
    const witnesses = (result.declaredCompatibilityWitnesses || []).slice().sort((a, b) => a.capabilityId.localeCompare(b.capabilityId));
    if (!witnesses.length) {
      const partialWitnesses = (result.declaredPartialCompatibilityWitnesses || []).slice().sort((a, b) => a.capabilityId.localeCompare(b.capabilityId));
      holds.push({
        handRequestId: hand.handRequestId,
        handRequestDigest: hand.handRequestDigest,
        partialCompatibilityWitnesses: partialWitnesses,
        state: partialWitnesses.length
          ? 'HOLD_PARTIAL_DECLARED_COMPATIBILITY_REQUIRES_OUTPUT_ADAPTER'
          : 'HOLD_NO_DECLARED_COMPATIBILITY_WITNESS_NO_EXAM_REQUEST',
        operationalFit: 'UNTESTED',
        newOrganNeed: 'UNASSESSED'
      });
      continue;
    }
    for (const witness of witnesses) {
      const record = inventory.get(`${witness.capabilityId}:${witness.declarationDigest}`);
      if (!record) throw new Error('foundation affordance exam witness declaration is missing or refused');
      requests.push(buildExamRequest(hand, result, record, surveyBatch));
    }
  }
  requests.sort((a, b) => a.examRequestId.localeCompare(b.examRequestId));
  holds.sort((a, b) => a.handRequestId.localeCompare(b.handRequestId));
  const partialWitnessCount = (surveyBatch.results || []).reduce((sum, item) => sum + (item.declaredPartialCompatibilityWitnesses || []).length, 0);
  const basis = { organId: ORGAN_ID, handBatchDigest: handBatch.batchDigest, surveyBatchDigest: surveyBatch.batchDigest, requests, holds };
  const batch = {
    schema: BATCH_SCHEMA,
    batchId: `foundation-capability-affordance-exams-${digest(basis).slice(0, 24)}`,
    batchDigest: null,
    organ: { id: ORGAN_ID, learnedWeights: false, humanProseCaseAuthority: false, sourceExecution: false },
    source: {
      handBatchId: handBatch.batchId,
      handBatchDigest: handBatch.batchDigest,
      surveyBatchId: surveyBatch.batchId,
      surveyBatchDigest: surveyBatch.batchDigest
    },
    requests,
    holds,
    summary: {
      evidenceHandRequests: (handBatch.hands || []).length,
      declaredCompatibilityWitnesses: (surveyBatch.results || []).reduce((sum, item) => sum + (item.declaredCompatibilityWitnesses || []).length, 0),
      declaredPartialCompatibilityWitnesses: partialWitnessCount,
      independentAffordanceExamRequests: requests.length,
      handsHeldForOutputAdapter: holds.filter(item => item.state === 'HOLD_PARTIAL_DECLARED_COMPATIBILITY_REQUIRES_OUTPUT_ADAPTER').length,
      handsHeldWithoutWitness: holds.filter(item => item.state === 'HOLD_NO_DECLARED_COMPATIBILITY_WITNESS_NO_EXAM_REQUEST').length,
      fixturesAuthored: 0,
      expectedResultsAuthored: 0,
      sourceExecutions: 0,
      examResults: 0,
      capabilitiesSelected: 0,
      operationalFitsClaimed: 0,
      newOrgansRequired: 0,
      implementationsBuilt: 0,
      evidenceAcquisitions: 0,
      eventsInduced: 0,
      trainingAdmissions: 0,
      permissionGrants: 0,
      promotions: 0,
      worldActions: 0
    },
    state: !(handBatch.hands || []).length ? 'NO_EVIDENCE_HANDS_TO_EXAMINE'
      : requests.length ? 'INDEPENDENT_AFFORDANCE_EXAM_REQUESTS_PROPOSED'
        : partialWitnessCount ? 'HOLD_PARTIAL_DECLARED_COMPATIBILITY_REQUIRES_OUTPUT_ADAPTER'
          : 'HOLD_NO_DECLARED_COMPATIBILITY_WITNESSES',
    authority: {
      privateProposalTraceWrite: true,
      sourceExecution: false,
      fixtureAuthoring: false,
      expectedResultAuthoring: false,
      capabilitySelection: false,
      operationalFitClaim: false,
      newOrganNeedClaim: false,
      implementationBuild: false,
      evidenceAcquisition: false,
      eventInduction: false,
      trainingAdmission: false,
      permissionGrant: false,
      runtimePromotion: false,
      canonChange: false,
      worldAction: false
    },
    boundary: 'Every exact declared witness receives its own independent affordance-exam request. Partial input/token witnesses with an output-kind mismatch are held for an explicit adapter and never executed as exact. Machine tokens and typed booleans define case families; names and prose do not. Planning is not execution, evidence, fit, selection, proof of organ need, build, training, permission, promotion, or action.'
  };
  batch.batchDigest = digest(Object.assign({}, batch, { batchDigest: null }));
  return batch;
}

function verifyRequest(request) {
  if (!request || request.schema !== REQUEST_SCHEMA || request.examRequestDigest !== digest(Object.assign({}, request, { examRequestDigest: null }))) throw new Error('foundation affordance exam request digest changed');
  const expectedId = `foundation-capability-affordance-exam-${digest(Object.assign({}, request, { examRequestId: null, examRequestDigest: null })).slice(0, 24)}`;
  if (request.examRequestId !== expectedId) throw new Error('foundation affordance exam request id changed');
  if (!request.examBoundary || request.examBoundary.humanProseCaseAuthority !== false || request.examBoundary.candidateMayAuthorExpectedResult !== false) throw new Error('foundation affordance exam machine boundary changed');
  if (!request.result || request.result.examExecution !== 'NOT_RUN' || request.result.sourceExecuted !== false || request.result.capabilitySelected !== false || request.result.operationalFit !== 'UNTESTED' || request.result.newOrganNeed !== 'UNASSESSED') throw new Error('foundation affordance exam result boundary changed');
  if (!request.authority || Object.entries(request.authority).some(([key, value]) => key === 'privateProposalTraceWrite' ? value !== true : value !== false)) throw new Error('foundation affordance exam request authority changed');
  if (!Array.isArray(request.caseRequirements) || !request.caseRequirements.length || request.caseRequirements.some(item => item.candidateMayAuthorFixture !== false || item.candidateMayAuthorExpectedResult !== false || item.executionState !== 'NOT_EXECUTED')) throw new Error('foundation affordance exam case boundary changed');
  return true;
}

function verifyBatch(batch, handBatch, surveyBatch, runDir) {
  if (!batch || batch.schema !== BATCH_SCHEMA || batch.batchDigest !== digest(Object.assign({}, batch, { batchDigest: null }))) throw new Error('foundation affordance exam batch digest changed');
  if (!batch.organ || batch.organ.id !== ORGAN_ID || batch.organ.learnedWeights !== false || batch.organ.humanProseCaseAuthority !== false || batch.organ.sourceExecution !== false) throw new Error('foundation affordance exam organ boundary changed');
  if (!batch.authority || Object.entries(batch.authority).some(([key, value]) => key === 'privateProposalTraceWrite' ? value !== true : value !== false)) throw new Error('foundation affordance exam batch authority changed');
  for (const request of batch.requests || []) verifyRequest(request);
  if (batch.summary.fixturesAuthored !== 0 || batch.summary.expectedResultsAuthored !== 0 || batch.summary.sourceExecutions !== 0 || batch.summary.examResults !== 0 || batch.summary.capabilitiesSelected !== 0 || batch.summary.operationalFitsClaimed !== 0 || batch.summary.newOrgansRequired !== 0 || batch.summary.implementationsBuilt !== 0) throw new Error('foundation affordance exam summary changed');
  if (handBatch && surveyBatch) {
    const expected = buildBatch(handBatch, surveyBatch);
    if (!same(expected, batch)) throw new Error('foundation affordance exam batch content changed');
  }
  if (runDir) {
    const disk = JSON.parse(fs.readFileSync(path.join(runDir, 'batch.json'), 'utf8'));
    if (!same(disk, batch)) throw new Error('foundation affordance exam batch file changed');
  }
  return true;
}

function run(options = {}) {
  loadPolicy(options);
  const handBatch = loadCurrentHandBatch(options);
  const surveyBatch = loadCurrentSurveyBatch(options, handBatch);
  const batch = buildBatch(handBatch, surveyBatch);
  const stateDir = path.resolve(options.stateDir || DEFAULT_STATE_DIR);
  fs.mkdirSync(stateDir, { recursive: true });
  const runDir = path.join(stateDir, batch.batchId);
  if (fs.existsSync(runDir)) {
    const existing = JSON.parse(fs.readFileSync(path.join(runDir, 'batch.json'), 'utf8'));
    verifyBatch(existing, handBatch, surveyBatch, runDir);
    if (existing.batchDigest !== batch.batchDigest) throw new Error('foundation affordance exam batch identity collision');
    return { batch: existing, runDir, reused: true };
  }
  const stageDir = path.join(stateDir, `.stage-${batch.batchId}-${process.pid}`);
  if (fs.existsSync(stageDir)) throw new Error(`foundation affordance exam staging directory already exists: ${stageDir}`);
  fs.mkdirSync(stageDir, { recursive: true });
  fs.writeFileSync(path.join(stageDir, 'batch.json'), json(batch), { flag: 'wx' });
  verifyBatch(batch, handBatch, surveyBatch, stageDir);
  const commit = ImmutableBatchStore.commitDirectory(stageDir, runDir);
  return { batch, runDir, reused: commit.reused };
}

module.exports = {
  ORGAN_ID, REQUEST_SCHEMA, BATCH_SCHEMA, DEFAULT_SURVEY_STATE_DIR, DEFAULT_HAND_STATE_DIR, DEFAULT_STATE_DIR,
  loadPolicy, loadCurrentHandBatch, validateSurveyInventory, loadCurrentSurveyBatch, planCaseRequirements,
  buildExamRequest, buildBatch, verifyRequest, verifyBatch, run
};
