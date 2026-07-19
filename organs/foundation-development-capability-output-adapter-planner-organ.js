'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const LanguageModel = require('../learning/typed-trace-language-model');
const HandPlanner = require('./foundation-development-hand-planner-organ');
const CapabilitySurvey = require('./foundation-development-capability-survey-organ');
const ImmutableBatchStore = require('../kernel/immutable-batch-store');

const ORGAN_ID = 'axm.mirror.foundation-development-capability-output-adapter-planner-organ/v1';
const REQUEST_SCHEMA = 'axm.mirror.foundation-development-capability-output-adapter-request/v1';
const BATCH_SCHEMA = 'axm.mirror.foundation-development-capability-output-adapter-batch/v1';
const ROOT = path.resolve(__dirname, '..');
const DEFAULT_SURVEY_STATE_DIR = CapabilitySurvey.DEFAULT_STATE_DIR;
const DEFAULT_HAND_STATE_DIR = HandPlanner.DEFAULT_STATE_DIR;
const DEFAULT_STATE_DIR = path.join(ROOT, 'state', 'foundation-development-capability-output-adapter-runs');

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
  if (path.dirname(resolved) !== resolvedParent) throw new Error(`foundation output-adapter path escapes its parent: ${child}`);
  return resolved;
}

function loadPolicy(options = {}) {
  const policyPath = path.resolve(options.policyPath || path.join(ROOT, 'training', 'TRAINING_POLICY.json'));
  const policy = options.policy || JSON.parse(fs.readFileSync(policyPath, 'utf8'));
  if (!policy || policy.schema !== 'axm.mirror.training-policy/v1') throw new Error('foundation output-adapter planner requires the Mirror training policy');
  if (policy.automaticFoundationDevelopmentCapabilityOutputAdapterPlanning !== true) throw new Error('automatic foundation capability output-adapter planning is not enabled');
  if (policy.automaticRuntimePromotion !== false || policy.automaticCanonPromotion !== false || policy.automaticAuthorityGrowth !== false) throw new Error('foundation output-adapter planner refuses runtime, canon, or authority growth');
  if (!String(policy.foundationDevelopmentCapabilityOutputAdapterPlanningScope || '').includes('one-request-per-partial-output-mismatch-witness-no-source-execution-no-adapter-build-or-selection')) throw new Error('foundation output-adapter planning scope is incomplete');
  return policy;
}

function loadCurrentHandBatch(options = {}) {
  if (options.handBatch) {
    HandPlanner.verifyBatch(options.handBatch);
    return options.handBatch;
  }
  const status = JSON.parse(fs.readFileSync(path.resolve(options.statusPath || path.join(ROOT, 'STATUS.json')), 'utf8'));
  const batchId = (status.foundationDevelopmentHandPlannerEvidence || {}).currentBatchId;
  if (!/^foundation-development-hands-[a-f0-9]{24}$/.test(String(batchId || ''))) throw new Error('foundation output-adapter current hand batch id is missing');
  const runDir = boundedChild(path.resolve(options.handStateDir || DEFAULT_HAND_STATE_DIR), batchId);
  const batch = JSON.parse(fs.readFileSync(path.join(runDir, 'batch.json'), 'utf8'));
  HandPlanner.verifyBatch(batch, null, runDir);
  return batch;
}

function validateSurveyInventory(inventory) {
  for (const record of inventory || []) if (record.status === 'VERIFIED_DECLARATION') CapabilitySurvey.validateDeclaration(record.declaration);
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
  if (!/^foundation-capability-survey-[a-f0-9]{24}$/.test(String(batchId || ''))) throw new Error('foundation output-adapter current capability survey id is missing');
  const runDir = boundedChild(path.resolve(options.surveyStateDir || DEFAULT_SURVEY_STATE_DIR), batchId);
  const batch = JSON.parse(fs.readFileSync(path.join(runDir, 'batch.json'), 'utf8'));
  CapabilitySurvey.verifyBatch(batch, handBatch, inventory, runDir);
  return batch;
}

function buildAdapterRequest(hand, surveyResult, inventoryRecord, surveyBatch) {
  if (!inventoryRecord || inventoryRecord.status !== 'VERIFIED_DECLARATION') throw new Error('foundation output-adapter requires a verified declaration record');
  const declaration = inventoryRecord.declaration;
  const partial = (surveyResult.declaredPartialCompatibilityWitnesses || []).find(item => item.capabilityId === declaration.capabilityId && item.declarationDigest === declaration.declarationDigest);
  if (!partial) throw new Error('foundation output-adapter requires a partial output-mismatch witness');
  if (surveyResult.handRequestId !== hand.handRequestId || surveyResult.handRequestDigest !== hand.handRequestDigest) throw new Error('foundation output-adapter hand binding changed');
  if (declaration.outputKinds.includes(hand.proposedContract.outputKind)) throw new Error('foundation output-adapter refuses an already exact output kind');
  const request = {
    schema: REQUEST_SCHEMA,
    adapterRequestId: null,
    adapterRequestDigest: null,
    source: {
      surveyBatchId: surveyBatch.batchId,
      surveyBatchDigest: surveyBatch.batchDigest,
      handRequestId: hand.handRequestId,
      handRequestDigest: hand.handRequestDigest,
      handFamily: hand.handFamily,
      capabilityId: declaration.capabilityId,
      declarationDigest: declaration.declarationDigest,
      declarationPath: inventoryRecord.path,
      declarationFileSha256: inventoryRecord.sha256,
      implementationOrganId: declaration.implementation.organId,
      implementationSourceFiles: declaration.implementation.sourceFiles.slice().sort((a, b) => a.path.localeCompare(b.path))
    },
    adapterContract: {
      inputKinds: declaration.outputKinds.slice().sort(),
      outputKind: hand.proposedContract.outputKind,
      requiredCapabilityTokens: hand.proposedContract.requiredCapabilityTokens.slice().sort(),
      requiredPreservations: [
        'ACCEPTANCE_STATE_PRESERVED_NOT_INFERRED',
        'AUTHORSHIP_DECLARATION_PRESERVED_NOT_CERTIFIED',
        'CANDIDATE_SOURCE_AND_CONTENT_DIGESTS_PRESERVED',
        'CLOSED_AUTHORITY_PRESERVED',
        'EVIDENCE_CLASS_PRESERVED_NOT_RELABELED',
        'INDEPENDENCE_STATUS_PRESERVED_NOT_INFERRED',
        'PERMISSION_STATUS_PRESERVED_NOT_INFERRED'
      ],
      forbiddenTransformations: [
        'ACCEPT_OR_PASS_THE_EVIDENCE_CANDIDATE',
        'ACQUIRE_OR_INDUCE_EVIDENCE',
        'CERTIFY_AUTHORSHIP_OR_INDEPENDENCE',
        'DROP_NATIVE_RECEIPT_LINEAGE',
        'GRANT_PERMISSION_OR_AUTHORITY',
        'RELABEL_SYNTHETIC_DECLARED_UNKNOWN_OR_FAILED_AS_REAL_VERIFIED_OR_PASSING'
      ],
      recoveryRequirement: 'Reject the adapted candidate and preserve the native receipt, source state, evidence gate, and all prior evidence unchanged.',
      implementationState: 'NOT_BUILT_OR_SELECTED'
    },
    requiredIndependentArtifacts: [
      'ADAPTER_SOURCE_AND_HASH_BINDING',
      'INDEPENDENT_LINEAGE_PRESERVATION_FIXTURES',
      'INDEPENDENT_NEGATIVE_RELABELING_FIXTURES',
      'INDEPENDENT_OUTPUT_CONTRACT_PREDICATES',
      'PRE_AND_POST_SOURCE_STATE_DIGESTS'
    ],
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
    boundary: 'This request makes one native-output-to-evidence-candidate seam explicit. It is a reusable modular adapter proposal, not an adapter implementation, execution, selection, fit result, organ-need decision, evidence result, permission, training, promotion, canon change, or world action.'
  };
  request.adapterRequestId = `foundation-capability-output-adapter-${digest(Object.assign({}, request, { adapterRequestId: null, adapterRequestDigest: null })).slice(0, 24)}`;
  request.adapterRequestDigest = digest(Object.assign({}, request, { adapterRequestDigest: null }));
  return request;
}

function buildBatch(handBatch, surveyBatch) {
  HandPlanner.verifyBatch(handBatch);
  CapabilitySurvey.verifyBatch(surveyBatch);
  if (surveyBatch.source.handBatchId !== handBatch.batchId || surveyBatch.source.handBatchDigest !== handBatch.batchDigest) throw new Error('foundation output-adapter survey and hand batch binding changed');
  const hands = new Map((handBatch.hands || []).map(hand => [hand.handRequestId, hand]));
  const inventory = new Map();
  for (const record of surveyBatch.inventory || []) if (record.status === 'VERIFIED_DECLARATION') inventory.set(`${record.declaration.capabilityId}:${record.declaration.declarationDigest}`, record);
  const requests = [];
  const holds = [];
  for (const result of (surveyBatch.results || []).slice().sort((a, b) => a.handRequestId.localeCompare(b.handRequestId))) {
    const hand = hands.get(result.handRequestId);
    if (!hand || hand.handRequestDigest !== result.handRequestDigest) throw new Error('foundation output-adapter survey result has no exact hand');
    const partials = (result.declaredPartialCompatibilityWitnesses || []).slice().sort((a, b) => a.capabilityId.localeCompare(b.capabilityId));
    if (!partials.length) {
      holds.push({
        handRequestId: hand.handRequestId,
        handRequestDigest: hand.handRequestDigest,
        exactWitnesses: (result.declaredCompatibilityWitnesses || []).length,
        state: (result.declaredCompatibilityWitnesses || []).length
          ? 'NO_OUTPUT_ADAPTER_REQUEST_EXACT_WITNESS_EXISTS'
          : 'HOLD_NO_PARTIAL_OUTPUT_WITNESS',
        operationalFit: 'UNTESTED',
        newOrganNeed: 'UNASSESSED'
      });
      continue;
    }
    for (const partial of partials) {
      const record = inventory.get(`${partial.capabilityId}:${partial.declarationDigest}`);
      if (!record) throw new Error('foundation output-adapter partial declaration is missing or refused');
      requests.push(buildAdapterRequest(hand, result, record, surveyBatch));
    }
  }
  requests.sort((a, b) => a.adapterRequestId.localeCompare(b.adapterRequestId));
  holds.sort((a, b) => a.handRequestId.localeCompare(b.handRequestId));
  const basis = { organId: ORGAN_ID, handBatchDigest: handBatch.batchDigest, surveyBatchDigest: surveyBatch.batchDigest, requests, holds };
  const batch = {
    schema: BATCH_SCHEMA,
    batchId: `foundation-capability-output-adapters-${digest(basis).slice(0, 24)}`,
    batchDigest: null,
    organ: { id: ORGAN_ID, learnedWeights: false, sourceExecution: false, adapterBuild: false, firstMatchSelection: false },
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
      partialOutputWitnesses: (surveyBatch.results || []).reduce((sum, item) => sum + (item.declaredPartialCompatibilityWitnesses || []).length, 0),
      outputAdapterRequests: requests.length,
      handsWithoutPartialOutputWitnesses: holds.length,
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
    state: !(handBatch.hands || []).length ? 'NO_EVIDENCE_HANDS_TO_ADAPT'
      : requests.length ? 'MODULAR_OUTPUT_ADAPTER_REQUESTS_PROPOSED'
        : 'NO_PARTIAL_OUTPUT_WITNESSES_TO_ADAPT',
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
    boundary: 'Every partial family/input/token witness with an output-kind mismatch receives one modular adapter request. Exact witnesses need no adapter request. Planning never builds, executes, selects, relabels evidence, claims fit or organ need, grants permission, trains, promotes, changes canon, or acts.'
  };
  batch.batchDigest = digest(Object.assign({}, batch, { batchDigest: null }));
  return batch;
}

function verifyRequest(request) {
  if (!request || request.schema !== REQUEST_SCHEMA || request.adapterRequestDigest !== digest(Object.assign({}, request, { adapterRequestDigest: null }))) throw new Error('foundation output-adapter request digest changed');
  const expectedId = `foundation-capability-output-adapter-${digest(Object.assign({}, request, { adapterRequestId: null, adapterRequestDigest: null })).slice(0, 24)}`;
  if (request.adapterRequestId !== expectedId) throw new Error('foundation output-adapter request id changed');
  if (!request.adapterContract || request.adapterContract.implementationState !== 'NOT_BUILT_OR_SELECTED' || request.adapterContract.inputKinds.includes(request.adapterContract.outputKind)) throw new Error('foundation output-adapter contract boundary changed');
  if (!request.result || request.result.adapterBuilt !== false || request.result.adapterSelected !== false || request.result.sourceExecuted !== false || request.result.operationalFit !== 'UNTESTED' || request.result.newOrganNeed !== 'UNASSESSED') throw new Error('foundation output-adapter result boundary changed');
  if (!request.authority || Object.entries(request.authority).some(([key, value]) => key === 'privateProposalTraceWrite' ? value !== true : value !== false)) throw new Error('foundation output-adapter request authority changed');
  return true;
}

function verifyBatch(batch, handBatch, surveyBatch, runDir) {
  if (!batch || batch.schema !== BATCH_SCHEMA || batch.batchDigest !== digest(Object.assign({}, batch, { batchDigest: null }))) throw new Error('foundation output-adapter batch digest changed');
  if (!batch.organ || batch.organ.id !== ORGAN_ID || batch.organ.learnedWeights !== false || batch.organ.sourceExecution !== false || batch.organ.adapterBuild !== false || batch.organ.firstMatchSelection !== false) throw new Error('foundation output-adapter organ boundary changed');
  if (!batch.authority || Object.entries(batch.authority).some(([key, value]) => key === 'privateProposalTraceWrite' ? value !== true : value !== false)) throw new Error('foundation output-adapter batch authority changed');
  for (const request of batch.requests || []) verifyRequest(request);
  if (batch.summary.adaptersBuilt !== 0 || batch.summary.adaptersSelected !== 0 || batch.summary.sourceExecutions !== 0 || batch.summary.capabilitiesSelected !== 0 || batch.summary.operationalFitsClaimed !== 0 || batch.summary.newOrgansRequired !== 0 || batch.summary.evidenceAcquisitions !== 0 || batch.summary.evidenceRelabelings !== 0) throw new Error('foundation output-adapter summary changed');
  if (handBatch && surveyBatch && !same(buildBatch(handBatch, surveyBatch), batch)) throw new Error('foundation output-adapter batch content changed');
  if (runDir) {
    const disk = JSON.parse(fs.readFileSync(path.join(runDir, 'batch.json'), 'utf8'));
    if (!same(disk, batch)) throw new Error('foundation output-adapter batch file changed');
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
    if (existing.batchDigest !== batch.batchDigest) throw new Error('foundation output-adapter batch identity collision');
    return { batch: existing, runDir, reused: true };
  }
  const stageDir = path.join(stateDir, `.stage-${batch.batchId}-${process.pid}`);
  if (fs.existsSync(stageDir)) throw new Error(`foundation output-adapter staging directory already exists: ${stageDir}`);
  fs.mkdirSync(stageDir, { recursive: true });
  fs.writeFileSync(path.join(stageDir, 'batch.json'), json(batch), { flag: 'wx' });
  verifyBatch(batch, handBatch, surveyBatch, stageDir);
  const commit = ImmutableBatchStore.commitDirectory(stageDir, runDir);
  return { batch, runDir, reused: commit.reused };
}

module.exports = {
  ORGAN_ID, REQUEST_SCHEMA, BATCH_SCHEMA, DEFAULT_SURVEY_STATE_DIR, DEFAULT_HAND_STATE_DIR, DEFAULT_STATE_DIR,
  loadPolicy, loadCurrentHandBatch, validateSurveyInventory, loadCurrentSurveyBatch,
  buildAdapterRequest, buildBatch, verifyRequest, verifyBatch, run
};
