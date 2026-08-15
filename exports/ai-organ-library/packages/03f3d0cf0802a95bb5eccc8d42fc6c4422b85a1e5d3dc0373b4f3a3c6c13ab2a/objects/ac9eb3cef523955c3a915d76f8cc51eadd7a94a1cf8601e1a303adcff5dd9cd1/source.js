'use strict';

const fs = require('fs');
const path = require('path');
const ImmutableStore = require('../kernel/immutable-batch-store');
const Admission = require('../kernel/organ-admission-cell');
const Discovery = require('./reasoning-recipe-example-discovery-organ');

const ORGAN_ID = 'axm.mirror.organ/reasoning-recipe-evidence-frontier-v1';
const SCHEMA = 'axm.mirror.reasoning-recipe-evidence-frontier-batch/v1';
const ROOT = path.resolve(__dirname, '..');
const DEFAULT_STATE_DIR = path.join(ROOT, 'state', 'reasoning-recipe-evidence-frontier-runs');
const MAX_REQUESTS = 8;
const ACTIONS = Object.freeze(['ASK', 'OBSERVE', 'HOLD']);
const NON_HOLD_ACTIONS = Object.freeze(['ASK', 'OBSERVE']);

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])]));
}
function digest(value) { return Discovery.digest(value); }
function clone(value) { return JSON.parse(JSON.stringify(value)); }
function same(left, right) { return JSON.stringify(stable(left)) === JSON.stringify(stable(right)); }
function without(value, key) { const copy = clone(value); delete copy[key]; return copy; }
function json(value) { return `${JSON.stringify(stable(value), null, 2)}\n`; }
function exactKeys(value, expected, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || JSON.stringify(Object.keys(value).sort()) !== JSON.stringify(expected.slice().sort())) throw new Error(`${label} shape is closed`);
}
function unique(values) { return Array.from(new Set(values.filter(Boolean))).sort(); }
function identifier(value, maximum = 160) {
  const text = String(value == null ? '' : value).trim();
  return text && text.length <= maximum && !/[\u0000-\u001f]/.test(text) ? text : null;
}
function requestAuthority() {
  return {
    evidenceAdmission: false,
    exampleCreation: false,
    evaluation: false,
    failureInduction: false,
    humanDecision: false,
    permissionGrant: false,
    prioritySelection: false,
    recipeDraft: false,
    trainingAdmission: false,
    runtimePromotion: false,
    canonChange: false,
    worldAction: false
  };
}
function batchAuthority() {
  return {
    privateFrontierWrite: true,
    externalCommunication: false,
    evidenceAcquisition: false,
    evidenceAdmission: false,
    exampleCreation: false,
    failureInduction: false,
    prioritySelection: false,
    recipeDraft: false,
    reviewApproval: false,
    candidateBuild: false,
    permissionGrant: false,
    trainingAdmission: false,
    runtimePromotion: false,
    canonChange: false,
    worldAction: false
  };
}

function reconstructTarget(target, batch, root) {
  if (target == null) {
    return {
      public: {
        state: 'NO_TARGET_ASSESSMENT_SUPPLIED', assessmentId: null, assessmentDigest: null,
        classification: null, organId: null, materializationReceiptDigest: null,
        fullContextsPersisted: 0, sourceIndependenceCertified: false
      },
      records: batch.records.filter(record => record.state === 'ELIGIBLE_EXPLICIT_MACHINE_LABEL'),
      targetUsable: false
    };
  }
  exactKeys(target, ['admissionInput', 'assessment'], 'reasoning recipe frontier target');
  const reconstructed = Admission.assess(target.admissionInput);
  if (!same(reconstructed, target.assessment)) throw new Error('reasoning recipe frontier assessment does not reconstruct from admission input');
  const organId = identifier(reconstructed.proposedContract && reconstructed.proposedContract.organId) || null;
  if (reconstructed.classification !== 'PROPOSE_BUILD') {
    return {
      public: {
        state: 'TARGET_ASSESSMENT_NOT_PROPOSE_BUILD', assessmentId: reconstructed.assessmentId,
        assessmentDigest: reconstructed.assessmentDigest, classification: reconstructed.classification,
        organId, materializationReceiptDigest: null, fullContextsPersisted: 0,
        sourceIndependenceCertified: false
      },
      records: batch.records.filter(record => record.state === 'ELIGIBLE_EXPLICIT_MACHINE_LABEL'),
      targetUsable: false
    };
  }
  const materialized = Discovery.materialize(batch, organId, { root });
  const acceptedIds = new Set(materialized.receipt.accepted.map(item => item.sourceReceiptId));
  const records = batch.records.filter(record => acceptedIds.has(record.receiptId));
  materialized.examples.splice(0, materialized.examples.length);
  return {
    public: {
      state: 'EXACT_PROPOSE_BUILD_TARGET_BOUND', assessmentId: reconstructed.assessmentId,
      assessmentDigest: reconstructed.assessmentDigest, classification: reconstructed.classification,
      organId, materializationReceiptDigest: materialized.receipt.receiptDigest,
      fullContextsPersisted: 0, sourceIndependenceCertified: false
    },
    records,
    targetUsable: true
  };
}

function metrics(records) {
  const actionKinds = unique(records.map(record => record.label && record.label.expected && record.label.expected.actionKind).filter(kind => ACTIONS.includes(kind)));
  return {
    eligibleExamples: records.length,
    distinctSourceGroups: unique(records.map(record => record.sourceGroupId)).length,
    distinctEvaluators: unique(records.map(record => record.evaluator && record.evaluator.id)).length,
    distinctReceiptDigests: unique(records.map(record => record.sourceFileSha256)).length,
    distinctActionOutputs: actionKinds.length,
    actionKinds
  };
}

function makeRequest(kind, target, batch, observed, requiredEvidence, acquisitionMode, targetActionKind = null) {
  const basis = {
    kind,
    sourceBatchDigest: batch.batchDigest,
    assessmentDigest: target.assessmentDigest,
    targetOrganId: target.organId,
    targetActionKind,
    observed,
    requiredEvidence,
    acquisitionMode
  };
  const request = {
    requestId: `reasoning-recipe-evidence-request-${digest(basis).slice(0, 24)}`,
    requestDigest: null,
    requestKind: kind,
    targetOrganId: target.organId,
    targetActionKind,
    source: {
      discoveryBatchId: batch.batchId,
      discoveryBatchDigest: batch.batchDigest,
      assessmentDigest: target.assessmentDigest
    },
    observed,
    requiredEvidence,
    acquisitionMode,
    answerKeyIncluded: false,
    mayInduceFailure: false,
    prioritySelected: false,
    automaticAcquisition: false,
    trainingEligible: false,
    authority: requestAuthority(),
    boundary: 'This request names missing evidence only. It cannot contact a provider, cause an event or failure, create or label an example, select priority, admit evidence or training, draft a recipe, grant permission, promote runtime, change CANON, or act.'
  };
  request.requestDigest = digest(without(request, 'requestDigest'));
  return stable(request);
}

function buildFrontier(batch, target = null, options = {}) {
  const root = path.resolve(options.root || ROOT);
  Discovery.verifyBatch(batch, { root });
  const targetResult = reconstructTarget(target, batch, root);
  const all = metrics(targetResult.records);
  const observed = {
    eligibleExamples: all.eligibleExamples,
    distinctSourceGroups: all.distinctSourceGroups,
    distinctEvaluators: all.distinctEvaluators,
    distinctReceiptDigests: all.distinctReceiptDigests,
    distinctActionOutputs: all.distinctActionOutputs
  };
  const requests = [];
  if (!targetResult.targetUsable) {
    requests.push(makeRequest(
      'REQUEST_REAL_PROPOSE_BUILD_TARGET_ASSESSMENT', targetResult.public, batch, observed,
      { targetAssessments: 1, eligibleExamples: 0, distinctSourceGroups: 0, distinctEvaluators: 0, distinctReceiptDigests: 0, distinctActionOutputs: 0 },
      'EXPLICIT_EXISTING_ORGAN_ADMISSION'
    ));
  }
  const nonHoldRecords = targetResult.records.filter(record => NON_HOLD_ACTIONS.includes(record.label && record.label.expected && record.label.expected.actionKind));
  if (!nonHoldRecords.length) {
    requests.push(makeRequest(
      'REQUEST_FIRST_ELIGIBLE_NON_HOLD_EXPERIENCE', targetResult.public, batch, observed,
      { targetAssessments: 0, eligibleExamples: 1, distinctSourceGroups: 1, distinctEvaluators: 1, distinctReceiptDigests: 1, distinctActionOutputs: 1 },
      'PASSIVE_VERIFIED_PRACTICE_ONLY'
    ));
  } else {
    for (const actionKind of NON_HOLD_ACTIONS) {
      const actionRecords = nonHoldRecords.filter(record => record.label.expected.actionKind === actionKind);
      if (!actionRecords.length) continue;
      const actionMetrics = metrics(actionRecords);
      if (actionMetrics.distinctSourceGroups < 2 || actionMetrics.distinctEvaluators < 2 || actionMetrics.distinctReceiptDigests < 2) {
        requests.push(makeRequest(
          'REQUEST_INDEPENDENT_REPEAT_FOR_EXPLICIT_ACTION', targetResult.public, batch,
          {
            eligibleExamples: actionMetrics.eligibleExamples,
            distinctSourceGroups: actionMetrics.distinctSourceGroups,
            distinctEvaluators: actionMetrics.distinctEvaluators,
            distinctReceiptDigests: actionMetrics.distinctReceiptDigests,
            distinctActionOutputs: 1
          },
          { targetAssessments: 0, eligibleExamples: 2, distinctSourceGroups: 2, distinctEvaluators: 2, distinctReceiptDigests: 2, distinctActionOutputs: 1 },
          'PASSIVE_VERIFIED_PRACTICE_ONLY',
          actionKind
        ));
      }
    }
  }
  if (all.distinctActionOutputs < 2 && all.eligibleExamples > 0) {
    requests.push(makeRequest(
      'REQUEST_CONTRASTING_EXPLICIT_ACTION_OUTPUT', targetResult.public, batch, observed,
      { targetAssessments: 0, eligibleExamples: 2, distinctSourceGroups: 0, distinctEvaluators: 0, distinctReceiptDigests: 0, distinctActionOutputs: 2 },
      'SEPARATELY_AUTHORED_OR_NATURALLY_OBSERVED_CONTRAST'
    ));
  }
  requests.sort((left, right) => left.requestId.localeCompare(right.requestId));
  if (requests.length > MAX_REQUESTS) throw new Error(`reasoning recipe evidence frontier exceeds ${MAX_REQUESTS} requests`);
  let state = 'READY_FOR_EXPLICIT_RECIPE_DRAFTER_ATTEMPT';
  if (targetResult.public.state === 'NO_TARGET_ASSESSMENT_SUPPLIED') state = 'HOLD_REAL_PROPOSE_BUILD_TARGET_REQUIRED';
  else if (targetResult.public.state === 'TARGET_ASSESSMENT_NOT_PROPOSE_BUILD') state = 'HOLD_TARGET_ASSESSMENT_NOT_PROPOSE_BUILD';
  else if (requests.length) state = 'HOLD_RECIPE_EVIDENCE_FRONTIER_OPEN';
  const count = kind => requests.filter(request => request.requestKind === kind).length;
  const basis = {
    sourceBatchId: batch.batchId,
    sourceBatchDigest: batch.batchDigest,
    target: targetResult.public,
    requests,
    state
  };
  const frontier = {
    schema: SCHEMA,
    frontierId: `reasoning-recipe-evidence-frontier-${digest(basis).slice(0, 24)}`,
    frontierDigest: null,
    createdAt: null,
    organ: { id: ORGAN_ID, learnedWeights: false },
    source: {
      discoveryBatchId: batch.batchId,
      discoveryBatchDigest: batch.batchDigest,
      verifiedReceipts: batch.summary.verifiedReceipts,
      eligibleExplicitLabels: batch.summary.eligibleExplicitLabels
    },
    target: targetResult.public,
    requests,
    summary: {
      eligibleExamplesConsidered: all.eligibleExamples,
      distinctSourceGroups: all.distinctSourceGroups,
      distinctEvaluators: all.distinctEvaluators,
      distinctReceiptDigests: all.distinctReceiptDigests,
      distinctActionOutputs: all.distinctActionOutputs,
      requests: requests.length,
      targetAssessmentRequests: count('REQUEST_REAL_PROPOSE_BUILD_TARGET_ASSESSMENT'),
      firstExperienceRequests: count('REQUEST_FIRST_ELIGIBLE_NON_HOLD_EXPERIENCE'),
      independentRepeatRequests: count('REQUEST_INDEPENDENT_REPEAT_FOR_EXPLICIT_ACTION'),
      contrastRequests: count('REQUEST_CONTRASTING_EXPLICIT_ACTION_OUTPUT'),
      fullContextsPersisted: 0,
      labelsInferredFromProse: 0,
      prioritiesSelected: 0,
      failuresInduced: 0,
      automaticAcquisitions: 0,
      recipeDraftsProduced: 0,
      trainingAdmissions: 0,
      runtimePromotions: 0,
      canonChanges: 0,
      worldActions: 0
    },
    state,
    authority: batchAuthority(),
    boundary: 'This frontier converts a verified discovery inventory into typed missing-evidence requests. It persists no full reasoning context, infers no label from prose, selects no priority, induces no event or failure, acquires or admits no evidence, drafts no recipe, trains nothing, grants no permission, changes no runtime or CANON, and performs no world action.'
  };
  frontier.frontierDigest = digest(without(frontier, 'frontierDigest'));
  return stable(frontier);
}

function verifyFrontier(frontier, batch, target = null, options = {}) {
  if (!frontier || frontier.schema !== SCHEMA || !/^reasoning-recipe-evidence-frontier-[a-f0-9]{24}$/.test(String(frontier.frontierId || '')) || frontier.frontierDigest !== digest(without(frontier, 'frontierDigest'))) throw new Error('reasoning recipe evidence frontier seal changed');
  if (!same(frontier.authority, batchAuthority())) throw new Error('reasoning recipe evidence frontier authority changed');
  for (const request of frontier.requests || []) {
    if (!/^reasoning-recipe-evidence-request-[a-f0-9]{24}$/.test(String(request.requestId || '')) || request.requestDigest !== digest(without(request, 'requestDigest'))) throw new Error('reasoning recipe evidence request seal changed');
    if (!same(request.authority, requestAuthority()) || request.prioritySelected !== false || request.automaticAcquisition !== false || request.mayInduceFailure !== false || request.trainingEligible !== false) throw new Error('reasoning recipe evidence request gained authority');
  }
  const expected = buildFrontier(batch, target, options);
  if (!same(frontier, expected)) throw new Error('reasoning recipe evidence frontier does not reconstruct from source evidence');
  return true;
}

function stateDirectory(value) {
  const directory = path.resolve(value || DEFAULT_STATE_DIR);
  fs.mkdirSync(directory, { recursive: true });
  const stat = fs.lstatSync(directory);
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('reasoning recipe evidence frontier state must be a real directory');
  return directory;
}

function storeFrontier(frontier, batch, target = null, options = {}) {
  verifyFrontier(frontier, batch, target, options);
  const stateDir = stateDirectory(options.stateDir);
  const runDir = path.join(stateDir, frontier.frontierId);
  const file = path.join(runDir, 'frontier.json');
  if (fs.existsSync(runDir)) {
    const existing = JSON.parse(fs.readFileSync(file, 'utf8'));
    verifyFrontier(existing, batch, target, options);
    if (!same(existing, frontier)) throw new Error('reasoning recipe evidence frontier identity collision');
    return { frontier: existing, runDir, reused: true };
  }
  const stage = path.join(stateDir, `.stage-${process.pid}-${frontier.frontierId}`);
  if (fs.existsSync(stage)) throw new Error('reasoning recipe evidence frontier staging directory exists');
  fs.mkdirSync(stage);
  try {
    fs.writeFileSync(path.join(stage, 'frontier.json'), json(frontier), { flag: 'wx' });
    verifyFrontier(JSON.parse(fs.readFileSync(path.join(stage, 'frontier.json'), 'utf8')), batch, target, options);
    const commit = ImmutableStore.commitDirectory(stage, runDir);
    const stored = JSON.parse(fs.readFileSync(file, 'utf8'));
    verifyFrontier(stored, batch, target, options);
    return { frontier: stored, runDir, reused: commit.reused };
  } catch (error) {
    if (fs.existsSync(stage) && path.dirname(stage) === stateDir && path.basename(stage).startsWith(`.stage-${process.pid}-`)) fs.rmSync(stage, { recursive: true, force: true });
    throw error;
  }
}

function derive(options = {}) {
  const root = path.resolve(options.root || ROOT);
  const discovery = options.batch
    ? { batch: options.batch, reused: null, runDir: null }
    : Discovery.derive({ root, receiptsDir: options.receiptsDir, stateDir: options.discoveryStateDir });
  const frontier = buildFrontier(discovery.batch, options.target || null, { root });
  return Object.assign(storeFrontier(frontier, discovery.batch, options.target || null, { root, stateDir: options.stateDir }), {
    discoveryBatch: discovery.batch,
    discoveryReused: discovery.reused
  });
}

module.exports = {
  ORGAN_ID, SCHEMA, ROOT, DEFAULT_STATE_DIR, MAX_REQUESTS, ACTIONS, NON_HOLD_ACTIONS,
  stable, digest, clone, same, requestAuthority, batchAuthority, reconstructTarget,
  metrics, makeRequest, buildFrontier, verifyFrontier, storeFrontier, derive
};
