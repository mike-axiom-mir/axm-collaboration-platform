'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const LanguageModel = require('../learning/typed-trace-language-model');
const FrontierRouter = require('./foundation-development-frontier-router-organ');
const ImmutableBatchStore = require('../kernel/immutable-batch-store');

const ORGAN_ID = 'axm.mirror.foundation-development-hand-planner-organ/v1';
const HAND_SCHEMA = 'axm.mirror.foundation-development-hand-request/v1';
const BATCH_SCHEMA = 'axm.mirror.foundation-development-hand-batch/v1';
const EVIDENCE_NEED_SCHEMA = 'axm.mirror.foundation-development-evidence-need/v1';
const ROOT = path.resolve(__dirname, '..');
const DEFAULT_STATE_DIR = path.join(ROOT, 'state', 'foundation-development-hand-runs');
const DEFAULT_FRONTIER_STATE_DIR = FrontierRouter.DEFAULT_STATE_DIR;

const HAND_GRAMMAR = Object.freeze({
  EXTERNAL_PERMISSIONED_SUBMISSION: Object.freeze({
    handFamily: 'PERMISSIONED_EXTERNAL_EVIDENCE_INTAKE_HAND',
    inputKind: 'PERMISSIONED_CONTENT_SEALED_EXTERNAL_SUBMISSION',
    requiredCapabilityTokens: Object.freeze([
      'EXPLICIT_USE_PERMISSION_REQUIRED',
      'CONTENT_SEAL_BEFORE_EVALUATION',
      'OUTSIDE_AUTHORSHIP_DECLARATION_PRESERVED_NOT_CERTIFIED',
      'KNOWN_GROUP_OVERLAP_REFUSED',
      'HIDDEN_REASONING_REFUSED',
      'POST_SEAL_MUTATION_REFUSED'
    ]),
    requiredBehaviors: Object.freeze([
      'require explicit permission and declared source lineage before intake',
      'content-seal submitted bytes before evaluation',
      'preserve authorship as a declaration that Mirror does not certify',
      'refuse hidden reasoning, known-source overlap, and post-seal mutation'
    ])
  }),
  PASSIVE_LOCAL_OBSERVATION: Object.freeze({
    handFamily: 'NON_INDUCING_LOCAL_EVENT_OBSERVATION_HAND',
    inputKind: 'PERMISSIONED_EXISTING_LOCAL_EPISODE_RECEIPT',
    requiredCapabilityTokens: Object.freeze([
      'EXPLICIT_USE_PERMISSION_REQUIRED',
      'EXISTING_REAL_LOCAL_EPISODE_INTAKE',
      'INDEPENDENT_NEGATIVE_OUTCOME_REQUIRED',
      'REAL_SYNTHETIC_EPISODE_CLASS_SEPARATION',
      'NO_EVENT_INDUCTION',
      'APPEND_ONLY_CONTENT_DIGESTED_RECEIPT'
    ]),
    requiredBehaviors: Object.freeze([
      'observe only already-occurring permissioned local episodes',
      'never induce, schedule, or manufacture a failure to fill the evidence gate',
      'require an independently verified negative observed outcome',
      'keep real, synthetic, positive, and unknown episode classes separate'
    ])
  }),
  INDEPENDENT_BOUNDED_EXAM: Object.freeze({
    handFamily: 'INDEPENDENT_REGRESSION_EXAM_HAND',
    inputKind: 'BOUND_SOURCE_AND_EVIDENCE_DELTA_EXAM',
    requiredCapabilityTokens: Object.freeze([
      'EXACT_REGRESSION_SOURCE_BINDING',
      'INDEPENDENT_EXPECTED_RESULT_AUTHORSHIP',
      'CAUSE_HYPOTHESIS_FALSIFICATION',
      'EARLIER_DIMENSION_REGRESSION_CANARIES',
      'AUTHORITY_CANARIES'
    ]),
    requiredBehaviors: Object.freeze([
      'bind the exact regressed snapshot, execution receipt, source deltas, and evidence deltas',
      'keep expected results and acceptance criteria independent from the candidate repair',
      'falsify the cause hypothesis and candidate before any repair selection',
      'rerun earlier behavior and authority canaries without lowering gates'
    ])
  })
});
const EVIDENCE_MODE_BY_KIND = Object.freeze({
  OUTSIDE_AUTHORED_SEALED_LANGUAGE_EXAM: 'EXTERNAL_PERMISSIONED_SUBMISSION',
  PASSIVE_VERIFIED_REAL_LOCAL_NEGATIVE_EPISODE: 'PASSIVE_LOCAL_OBSERVATION',
  BOUND_INDEPENDENT_REGRESSION_EXAM: 'INDEPENDENT_BOUNDED_EXAM'
});

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
  if (path.dirname(resolved) !== resolvedParent) throw new Error(`foundation hand path escapes its parent: ${child}`);
  return resolved;
}

function loadPolicy(options = {}) {
  const policyPath = path.resolve(options.policyPath || path.join(ROOT, 'training', 'TRAINING_POLICY.json'));
  const policy = options.policy || JSON.parse(fs.readFileSync(policyPath, 'utf8'));
  if (!policy || policy.schema !== 'axm.mirror.training-policy/v1') throw new Error('foundation hand planning requires the Mirror training policy');
  if (policy.automaticFoundationDevelopmentHandPlanning !== true) throw new Error('automatic foundation hand planning is not enabled');
  if (policy.automaticRuntimePromotion !== false || policy.automaticCanonPromotion !== false || policy.automaticAuthorityGrowth !== false) throw new Error('foundation hand planning refuses runtime, canon, or authority growth');
  if (!String(policy.foundationDevelopmentHandPlanningScope || '').includes('no-dimension-name-inference-no-capability-or-organ-need-claim')) throw new Error('foundation hand planning scope is incomplete');
  return policy;
}

function loadCurrentFrontier(options = {}) {
  if (options.frontierBatch) {
    FrontierRouter.verifyBatch(options.frontierBatch);
    return options.frontierBatch;
  }
  const status = JSON.parse(fs.readFileSync(path.resolve(options.statusPath || path.join(ROOT, 'STATUS.json')), 'utf8'));
  const batchId = (status.foundationDevelopmentFrontierRouterEvidence || {}).currentBatchId;
  if (!/^foundation-development-frontier-[a-f0-9]{24}$/.test(String(batchId || ''))) throw new Error('foundation hand planning current frontier id is missing');
  const frontierStateDir = path.resolve(options.frontierStateDir || DEFAULT_FRONTIER_STATE_DIR);
  const runDir = boundedChild(frontierStateDir, batchId);
  const batch = JSON.parse(fs.readFileSync(path.join(runDir, 'batch.json'), 'utf8'));
  FrontierRouter.verifyBatch(batch, null, runDir);
  return batch;
}

function verifyEvidenceNeed(need) {
  if (!need || typeof need !== 'object' || Array.isArray(need)) throw new Error('foundation hand requires a machine-readable evidence need');
  const grammar = HAND_GRAMMAR[need.acquisitionMode];
  if (!grammar) throw new Error('foundation hand acquisition mode is unsupported');
  if (!EVIDENCE_MODE_BY_KIND[need.evidenceKind]) throw new Error('foundation hand evidence kind is unsupported');
  if (EVIDENCE_MODE_BY_KIND[need.evidenceKind] !== need.acquisitionMode) throw new Error('foundation hand evidence kind and acquisition mode do not match');
  if (!String(need.sourceConstraint || '').trim()) throw new Error('foundation hand evidence source constraint is missing');
  if (need.permissionRequired !== true || need.eventInductionAllowed !== false || need.candidateMayAuthorExpectedResult !== false) throw new Error('foundation hand evidence boundary changed');
  if (typeof need.independentFromCandidate !== 'boolean') throw new Error('foundation hand independence declaration is missing');
  if (!Array.isArray(need.acceptanceEvidence) || !need.acceptanceEvidence.length || need.acceptanceEvidence.some(item => !String(item || '').trim())) throw new Error('foundation hand acceptance evidence is missing');
  return grammar;
}

function buildHandRequest(frontierBatch, frontierRequest) {
  if (!frontierRequest || frontierRequest.requestDigest !== digest(Object.assign({}, frontierRequest, { requestDigest: null }))) throw new Error('foundation hand source request digest changed');
  if (frontierRequest.handPlanningEligible !== true || !frontierRequest.developmentNeed) return null;
  const grammar = verifyEvidenceNeed(frontierRequest.developmentNeed);
  const basis = {
    schema: HAND_SCHEMA,
    source: {
      frontierBatchId: frontierBatch.batchId,
      frontierBatchDigest: frontierBatch.batchDigest,
      frontierRequestId: frontierRequest.requestId,
      frontierRequestDigest: frontierRequest.requestDigest,
      dimensionId: frontierRequest.dimensionId,
      observedState: frontierRequest.observedState,
      classification: frontierRequest.classification,
      deltas: frontierRequest.deltas
    },
    evidenceNeed: frontierRequest.developmentNeed,
    handFamily: grammar.handFamily,
    proposedContract: {
      inputKind: grammar.inputKind,
      outputKind: 'CONTENT_DIGESTED_FOUNDATION_EVIDENCE_CANDIDATE',
      requiredCapabilityTokens: grammar.requiredCapabilityTokens.slice(),
      requiredBehaviors: grammar.requiredBehaviors.slice(),
      forbiddenBehaviors: [
        'fabricate or relabel evidence',
        'infer permission, authorship, independence, or a passing result',
        'select priority, implementation, repair, training admission, or promotion',
        'write outside ignored private content-addressed proposal state'
      ],
      recoveryRequirement: 'Discard the hand candidate and preserve the evidence gate; source state and prior evidence remain unchanged.',
      implementationState: 'NOT_BUILT_OR_SELECTED'
    },
    selection: {
      prioritySelected: false,
      existingCapabilityMatch: 'NOT_SEARCHED',
      newOrganNeed: 'UNASSESSED',
      implementationSelected: false
    },
    unresolved: Array.from(new Set((frontierRequest.unresolved || []).concat([
      'existing-capability-match', 'new-organ-need', 'hand-implementation', 'independent-acceptance-result'
    ]))).sort(),
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
    boundary: 'This is a typed reviewable hand-interface request derived from a machine-readable evidence need. It is not evidence, a capability match, proof that a new organ is required, an implementation, permission, priority, repair, training, promotion, or action.'
  };
  const handRequestId = `foundation-evidence-hand-${digest(basis).slice(0, 24)}`;
  const hand = Object.assign({ handRequestId, handRequestDigest: null }, basis);
  hand.handRequestDigest = digest(Object.assign({}, hand, { handRequestDigest: null }));
  return hand;
}

function buildBatch(frontierBatch) {
  FrontierRouter.verifyBatch(frontierBatch);
  const hands = [];
  const holds = [];
  for (const request of frontierBatch.requests || []) {
    const hand = buildHandRequest(frontierBatch, request);
    if (hand) hands.push(hand);
    else holds.push({
      frontierRequestId: request.requestId,
      frontierRequestDigest: request.requestDigest,
      dimensionId: request.dimensionId,
      state: 'HOLD_MACHINE_READABLE_EVIDENCE_NEED_ABSENT',
      statement: 'Legacy or incomplete frontier evidence has no typed acquisition need; hand planning refuses prose inference.'
    });
  }
  hands.sort((a, b) => a.handRequestId.localeCompare(b.handRequestId));
  holds.sort((a, b) => a.frontierRequestId.localeCompare(b.frontierRequestId));
  const basis = { organId: ORGAN_ID, frontierBatchDigest: frontierBatch.batchDigest, handDigests: hands.map(item => item.handRequestDigest), holds };
  const batch = {
    schema: BATCH_SCHEMA,
    batchId: `foundation-development-hands-${digest(basis).slice(0, 24)}`,
    batchDigest: null,
    organ: { id: ORGAN_ID, learnedWeights: false, dimensionNameRules: false },
    source: { frontierBatchId: frontierBatch.batchId, frontierBatchDigest: frontierBatch.batchDigest },
    hands,
    holds,
    summary: {
      sourceFrontierRequests: (frontierBatch.requests || []).length,
      evidenceHandRequests: hands.length,
      machineReadableNeedHolds: holds.length,
      externalEvidenceIntakeHands: hands.filter(item => item.handFamily === 'PERMISSIONED_EXTERNAL_EVIDENCE_INTAKE_HAND').length,
      passiveObservationHands: hands.filter(item => item.handFamily === 'NON_INDUCING_LOCAL_EVENT_OBSERVATION_HAND').length,
      independentRegressionExamHands: hands.filter(item => item.handFamily === 'INDEPENDENT_REGRESSION_EXAM_HAND').length,
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
    boundary: 'This planner maps typed acquisition modes to reusable hand-interface families. It does not infer from dimension names or prose, search or claim an existing capability, decide that a new organ is required, acquire evidence, select priority or implementation, train, repair, grant, promote, or act.'
  };
  batch.batchDigest = digest(Object.assign({}, batch, { batchDigest: null }));
  return batch;
}

function verifyBatch(batch, frontierBatch, runDir) {
  if (!batch || batch.schema !== BATCH_SCHEMA || batch.batchDigest !== digest(Object.assign({}, batch, { batchDigest: null }))) throw new Error('foundation development hand batch digest changed');
  if (!batch.organ || batch.organ.id !== ORGAN_ID || batch.organ.learnedWeights !== false || batch.organ.dimensionNameRules !== false) throw new Error('foundation development hand organ boundary changed');
  if (frontierBatch) {
    FrontierRouter.verifyBatch(frontierBatch);
    if (batch.source.frontierBatchId !== frontierBatch.batchId || batch.source.frontierBatchDigest !== frontierBatch.batchDigest) throw new Error('foundation development hand source changed');
    const expected = buildBatch(frontierBatch);
    if (!same(expected, batch)) throw new Error('foundation development hand content changed');
  }
  if (!batch.authority || Object.entries(batch.authority).some(([key, value]) => key === 'privateProposalTraceWrite' ? value !== true : value !== false)) throw new Error('foundation development hand authority changed');
  for (const hand of batch.hands || []) {
    if (hand.schema !== HAND_SCHEMA || hand.handRequestDigest !== digest(Object.assign({}, hand, { handRequestDigest: null }))) throw new Error('foundation development hand request digest changed');
    verifyEvidenceNeed(hand.evidenceNeed);
    if (hand.selection.prioritySelected !== false || hand.selection.existingCapabilityMatch !== 'NOT_SEARCHED' || hand.selection.newOrganNeed !== 'UNASSESSED' || hand.selection.implementationSelected !== false) throw new Error('foundation development hand selection boundary changed');
    if (Object.values(hand.authority || {}).some(value => value !== false)) throw new Error('foundation development hand request authority changed');
  }
  if (batch.summary.sourceFrontierRequests !== batch.hands.length + batch.holds.length || batch.summary.evidenceHandRequests !== batch.hands.length || batch.summary.capabilitiesClaimed !== 0 || batch.summary.organsRequired !== 0 || batch.summary.implementationsBuilt !== 0) throw new Error('foundation development hand summary changed');
  if (runDir) {
    const disk = JSON.parse(fs.readFileSync(path.join(runDir, 'batch.json'), 'utf8'));
    if (!same(disk, batch)) throw new Error('foundation development hand batch file changed');
  }
  return true;
}

function run(options = {}) {
  loadPolicy(options);
  const frontierBatch = loadCurrentFrontier(options);
  const batch = buildBatch(frontierBatch);
  const stateDir = path.resolve(options.stateDir || DEFAULT_STATE_DIR);
  fs.mkdirSync(stateDir, { recursive: true });
  const runDir = path.join(stateDir, batch.batchId);
  if (fs.existsSync(runDir)) {
    const existing = JSON.parse(fs.readFileSync(path.join(runDir, 'batch.json'), 'utf8'));
    verifyBatch(existing, frontierBatch, runDir);
    if (existing.batchDigest !== batch.batchDigest) throw new Error('foundation development hand identity collision');
    return { batch: existing, runDir, reused: true };
  }
  const stageDir = path.join(stateDir, `.stage-${batch.batchId}-${process.pid}`);
  if (fs.existsSync(stageDir)) throw new Error(`foundation development hand staging directory already exists: ${stageDir}`);
  fs.mkdirSync(stageDir, { recursive: true });
  fs.writeFileSync(path.join(stageDir, 'batch.json'), json(batch), { flag: 'wx' });
  verifyBatch(batch, frontierBatch, stageDir);
  const commit = ImmutableBatchStore.commitDirectory(stageDir, runDir);
  return { batch, runDir, reused: commit.reused };
}

module.exports = {
  ORGAN_ID, HAND_SCHEMA, BATCH_SCHEMA, EVIDENCE_NEED_SCHEMA, DEFAULT_STATE_DIR, DEFAULT_FRONTIER_STATE_DIR, HAND_GRAMMAR, EVIDENCE_MODE_BY_KIND,
  loadPolicy, loadCurrentFrontier, verifyEvidenceNeed, buildHandRequest, buildBatch, verifyBatch, run
};
