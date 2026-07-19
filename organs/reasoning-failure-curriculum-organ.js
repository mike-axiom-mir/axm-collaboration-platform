'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const Experience = require('./reasoning-experience-organ');
const ImmutableBatchStore = require('../kernel/immutable-batch-store');

const ORGAN_ID = 'axm.mirror.organ/reasoning-failure-curriculum-v1';
const REQUEST_SCHEMA = 'axm.mirror.reasoning-failure-curriculum-request/v1';
const BATCH_SCHEMA = 'axm.mirror.reasoning-failure-curriculum-batch/v1';
const ROOT = path.resolve(__dirname, '..');
const DEFAULT_RECEIPT_DIR = path.join(ROOT, 'training', 'datasets', 'reasoning-receipts');
const DEFAULT_STATE_DIR = path.join(ROOT, 'state', 'reasoning-failure-curriculum-runs');
const REQUIRED_REAL_SOURCE_GROUPS = 2;
const COMPATIBLE_RECEIPT_SCHEMAS = new Set([Experience.SCHEMA, Experience.PREVIOUS_SCHEMA]);
const SOURCE_PATHS = Object.freeze([
  'organs/reasoning-failure-curriculum-organ.js',
  'organs/reasoning-experience-organ.js',
  'contracts/reasoning-failure-curriculum-request.schema.json',
  'contracts/reasoning-failure-curriculum-batch.schema.json',
  'contracts/reasoning-experience-receipt.schema.json'
]);

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== 'object') return value;
  return Object.keys(value).sort().reduce((output, key) => {
    output[key] = stable(value[key]);
    return output;
  }, {});
}

function digest(value) {
  const bytes = typeof value === 'string' || Buffer.isBuffer(value)
    ? value
    : JSON.stringify(stable(value));
  return crypto.createHash('sha256').update(bytes === undefined ? 'undefined' : bytes).digest('hex');
}

function json(value) { return JSON.stringify(stable(value), null, 2) + '\n'; }
function same(left, right) { return JSON.stringify(stable(left)) === JSON.stringify(stable(right)); }
function clone(value) { return JSON.parse(JSON.stringify(value)); }

function sourceBinding() {
  return SOURCE_PATHS.map(sourcePath => {
    const bytes = fs.readFileSync(path.join(ROOT, sourcePath));
    return { path: sourcePath, bytes: bytes.length, sha256: digest(bytes) };
  });
}

function loadPolicy(options = {}) {
  const file = path.resolve(options.policyPath || path.join(ROOT, 'training', 'TRAINING_POLICY.json'));
  const policy = options.policy || JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!policy || policy.schema !== 'axm.mirror.training-policy/v1') throw new Error('failure curriculum requires the Mirror training policy');
  if (policy.automaticReasoningFailureCurriculumPlanning !== true) throw new Error('automatic reasoning failure curriculum planning is not enabled');
  if (!String(policy.reasoningFailureCurriculumPlanningScope || '').includes('verified-real-local-negative-receipts-only-proposal-only')) throw new Error('reasoning failure curriculum scope is incomplete');
  if (policy.automaticRuntimePromotion !== false || policy.automaticCanonPromotion !== false || policy.automaticAuthorityGrowth !== false) {
    throw new Error('failure curriculum refuses runtime, canon, or authority growth');
  }
  return policy;
}

function normalizeRecords(records) {
  if (!Array.isArray(records)) throw new Error('failure curriculum receipt records must be an array');
  const output = records.map((item, index) => {
    const receipt = item && item.receipt ? item.receipt : item;
    Experience.verify(receipt);
    const sha256 = String(item && item.sha256 || receipt.receiptDigest || '').toLowerCase();
    if (!/^[a-f0-9]{64}$/.test(sha256)) throw new Error(`failure curriculum source hash missing at record ${index}`);
    return { receipt, sha256, file: item && item.file ? path.resolve(item.file) : null };
  }).sort((a, b) => a.receipt.receiptId.localeCompare(b.receipt.receiptId));
  const ids = output.map(item => item.receipt.receiptId);
  const groups = output.map(item => item.receipt.source.sourceGroup);
  if (new Set(ids).size !== ids.length) throw new Error('failure curriculum receipt IDs must be unique');
  if (new Set(groups).size !== groups.length) throw new Error('failure curriculum source groups must be unique');
  return output;
}

function candidateIds(receipt) {
  return (((receipt.reasoningSession || {}).principleTrace || {}).candidates || [])
    .map(item => item && item.action && item.action.id)
    .filter(Boolean);
}

function failureClass(receipt) {
  const evaluation = receipt.evaluation;
  const observed = evaluation.observedDecision;
  const expected = evaluation.expectedDecision;
  if (observed.actionId === expected.actionId && observed.value === expected.value) return 'VERIFIED_ACTION_OUTCOME_FAILURE';
  if (candidateIds(receipt).includes(expected.actionId)) return 'PATH_SELECTION_FAILURE';
  return 'CANDIDATE_ORIGINATION_FAILURE';
}

function signatureBasis(receipt, classification) {
  return {
    failureClass: classification,
    structuralFeatures: Array.from(new Set(receipt.trainingExample.features || [])).sort(),
    strategyTags: Array.from(new Set(receipt.trainingExample.strategyTags || [])).sort(),
    observedDecisionValue: receipt.evaluation.observedDecision.value,
    expectedDecisionValue: receipt.evaluation.expectedDecision.value
  };
}

function contrastKey(receipt) {
  return digest({
    structuralFeatures: Array.from(new Set(receipt.trainingExample.features || [])).sort(),
    strategyTags: Array.from(new Set(receipt.trainingExample.strategyTags || [])).sort()
  });
}

function routeFor(classification) {
  if (classification === 'PATH_SELECTION_FAILURE') return {
    kind: 'PRIVATE_STRATEGY_CHALLENGER_CURRICULUM',
    target: 'axm.mirror.reasoning-strategy-model/v2',
    reasonCode: 'EXPECTED_PATH_WAS_PRESENT_BUT_NOT_SELECTED'
  };
  if (classification === 'CANDIDATE_ORIGINATION_FAILURE') return {
    kind: 'NEW_HARDCODED_ORGAN_ADMISSION',
    target: 'axm.mirror.organ-admission-assessment/v1',
    reasonCode: 'INDEPENDENT_EXPECTED_PATH_WAS_ABSENT_FROM_CANDIDATES'
  };
  return {
    kind: 'INDEPENDENT_CAUSE_AND_REPAIR_EXAM',
    target: 'axm.mirror.foundation-development-frontier-request/v1',
    reasonCode: 'EXPECTED_SELECTED_ACTION_STILL_FAILED_IN_OBSERVED_USE'
  };
}

function contractDraftFor(classification, signatureDigest) {
  if (classification !== 'CANDIDATE_ORIGINATION_FAILURE') return null;
  return {
    draftId: `organ-contract-draft-${signatureDigest.slice(0, 24)}`,
    state: 'MACHINE_DRAFT_REQUIRES_INDEPENDENT_EXAM_AND_ADMISSION',
    organId: `axm.mirror.organ/candidate-origin-${signatureDigest.slice(0, 16)}/v1`,
    purposeCode: 'ORIGINATE_BOUNDED_CANDIDATE_PATHS_FOR_RECURRENT_STRUCTURAL_GAP',
    implementationKind: 'HARD_CODED_DETERMINISTIC',
    inputSchema: 'axm.mirror.reasoning-state/v1',
    outputSchema: 'axm.mirror.reasoning-path-set/v1',
    toolAuthority: false,
    worldMutationAuthority: false,
    permissionGrantAuthority: false,
    runtimeInstallAuthority: false,
    requiredTests: {
      frozenHeldOutTransfer: true,
      counterexamples: true,
      earlierCapabilityRegression: true,
      authorityCanaries: true,
      rollbackDryRun: true,
      independentEvaluator: 'UNASSIGNED'
    },
    unresolved: ['implementation-mechanism', 'independent-evaluator', 'post-seal-held-out-fixtures', 'acceptance-result'],
    installationState: 'NOT_BUILT_OR_INSTALLED',
    boundary: 'This deterministic draft names a narrow interface from repeated machine-structural failure evidence. It is not an implementation, a passing exam, an admission decision, an installation, or authority.'
  };
}

function requestFor(group, positiveRecords) {
  const rows = group.records.slice().sort((a, b) => a.receipt.receiptId.localeCompare(b.receipt.receiptId));
  const first = rows[0].receipt;
  const sourceGroups = rows.map(item => item.receipt.source.sourceGroup).sort();
  const evaluators = Array.from(new Set(rows.map(item => item.receipt.source.evaluator.id))).sort();
  const contrasts = positiveRecords.filter(item => contrastKey(item.receipt) === contrastKey(first))
    .map(item => ({ receiptId: item.receipt.receiptId, receiptDigest: item.receipt.receiptDigest, sourceGroup: item.receipt.source.sourceGroup }))
    .sort((a, b) => a.receiptId.localeCompare(b.receiptId));
  const recurrent = sourceGroups.length >= REQUIRED_REAL_SOURCE_GROUPS && evaluators.length >= REQUIRED_REAL_SOURCE_GROUPS;
  const route = routeFor(group.failureClass);
  const source = rows.map(item => ({
    receiptId: item.receipt.receiptId,
    receiptDigest: item.receipt.receiptDigest,
    sourceSha256: item.sha256,
    sourceGroup: item.receipt.source.sourceGroup,
    evaluatorId: item.receipt.source.evaluator.id,
    evaluatorSourceDigest: item.receipt.source.evaluator.sourceDigest,
    observedDecision: clone(item.receipt.evaluation.observedDecision),
    expectedDecision: clone(item.receipt.evaluation.expectedDecision)
  }));
  const basis = {
    failureSignatureDigest: group.signatureDigest,
    failureClass: group.failureClass,
    sourceReceiptDigests: source.map(item => item.receiptDigest),
    sourceGroups,
    evaluatorIds: evaluators,
    route
  };
  const request = {
    schema: REQUEST_SCHEMA,
    requestId: `reasoning-failure-curriculum-${digest(basis).slice(0, 24)}`,
    requestDigest: null,
    state: recurrent ? 'PROPOSE_INDEPENDENT_CURRICULUM' : 'HOLD_INSUFFICIENT_INDEPENDENT_REAL_SOURCE_GROUPS',
    failureClass: group.failureClass,
    failureSignature: clone(group.signature),
    failureSignatureDigest: group.signatureDigest,
    recurrence: {
      requiredIndependentRealSourceGroups: REQUIRED_REAL_SOURCE_GROUPS,
      distinctRealSourceGroups: sourceGroups.length,
      distinctIndependentEvaluators: evaluators.length,
      recurrentNeedObserved: recurrent
    },
    source,
    positiveStructuralContrasts: contrasts,
    route,
    contractDraft: contractDraftFor(group.failureClass, group.signatureDigest),
    curriculum: {
      sourceRole: 'VERIFIED_REAL_LOCAL_NEGATIVE_EPISODIC_EVIDENCE',
      proposalRole: 'PROPOSAL_ONLY_NOT_TRAINING',
      independentHeldOutRequirement: 'Author unseen source-group cases only after this request is content-sealed; the candidate may not author fixtures, expected results, or the evaluator.',
      counterexampleRequirement: 'Include positive and negative structural contrasts and cases that distinguish path selection, candidate absence, and post-selection outcome failure.',
      regressionRequirement: 'Re-run root, permission, contradiction, hold, earlier-capability, and authority canaries without lowering any gate.',
      repairReplayRequired: true,
      candidateMayAuthorExpectedResult: false,
      candidateMayAdmitTraining: false,
      candidateMayInstallItself: false
    },
    authority: {
      privateProposalTraceWrite: true,
      semanticTruthWrite: false,
      trainingAdmission: false,
      heldOutMutation: false,
      codeBuild: false,
      repairSelection: false,
      installOrgan: false,
      modelChange: false,
      permissionGrant: false,
      toolUse: false,
      runtimePromotion: false,
      canonChange: false,
      identityChange: false,
      worldAction: false
    },
    boundary: 'A recurrent failure curriculum request routes verified real negative experience toward an independent exam. It does not make the failure universal, choose a repair, admit training, build or install code, change a model, grant permission, promote, or act.'
  };
  request.requestDigest = digest(Object.assign({}, request, { requestDigest: null }));
  return request;
}

function buildBatch(inputRecords) {
  const records = normalizeRecords(inputRecords);
  const compatible = records.filter(item => COMPATIBLE_RECEIPT_SCHEMAS.has(item.receipt.schema));
  const real = compatible.filter(item => item.receipt.source.experienceKind === 'REAL_LOCAL_LESSON');
  const realPositive = real.filter(item => item.receipt.evaluation.result === 'WORKED');
  const realNegative = real.filter(item => item.receipt.evaluation.result === 'DID_NOT_WORK');
  const excludedNegative = compatible.filter(item => item.receipt.evaluation.result === 'DID_NOT_WORK' && item.receipt.source.experienceKind !== 'REAL_LOCAL_LESSON')
    .map(item => ({
      receiptId: item.receipt.receiptId,
      receiptDigest: item.receipt.receiptDigest,
      experienceKind: item.receipt.source.experienceKind,
      reason: 'Only independently verified real local negative experience may prove a recurrent real curriculum need.'
    }));
  const legacy = records.filter(item => !COMPATIBLE_RECEIPT_SCHEMAS.has(item.receipt.schema)).map(item => ({
    receiptId: item.receipt.receiptId,
    receiptDigest: item.receipt.receiptDigest,
    schema: item.receipt.schema,
    reason: 'Legacy receipts remain inspectable but cannot enter automatic v1 failure-curriculum recurrence evidence.'
  }));

  const grouped = new Map();
  for (const record of realNegative) {
    const classification = failureClass(record.receipt);
    const signature = signatureBasis(record.receipt, classification);
    const signatureDigest = digest(signature);
    if (!grouped.has(signatureDigest)) grouped.set(signatureDigest, { failureClass: classification, signature, signatureDigest, records: [] });
    grouped.get(signatureDigest).records.push(record);
  }
  const requests = Array.from(grouped.values()).map(group => requestFor(group, realPositive)).sort((a, b) => a.requestId.localeCompare(b.requestId));
  const proposed = requests.filter(item => item.state === 'PROPOSE_INDEPENDENT_CURRICULUM');
  const sourceInventory = records.map(item => ({
    receiptId: item.receipt.receiptId,
    receiptDigest: item.receipt.receiptDigest,
    sourceSha256: item.sha256,
    schema: item.receipt.schema,
    experienceKind: item.receipt.source.experienceKind,
    sourceGroup: item.receipt.source.sourceGroup,
    result: item.receipt.evaluation.result
  }));
  const implementationSources = sourceBinding();
  const basis = {
    organId: ORGAN_ID,
    implementationSources,
    sourceReceiptDigests: sourceInventory.map(item => item.receiptDigest),
    sourceHashes: sourceInventory.map(item => item.sourceSha256),
    requestDigests: requests.map(item => item.requestDigest),
    excludedNegative,
    legacy
  };
  const batch = {
    schema: BATCH_SCHEMA,
    batchId: `reasoning-failure-curriculum-${digest(basis).slice(0, 24)}`,
    batchDigest: null,
    organ: { id: ORGAN_ID, status: 'TEST_PROPOSAL_ONLY', learnedWeights: false },
    implementationSources,
    sourceInventory,
    requests,
    exclusions: { nonRealNegativeReceipts: excludedNegative, legacyReceipts: legacy },
    summary: {
      verifiedReceipts: records.length,
      currentV5Receipts: compatible.filter(item => item.receipt.schema === Experience.SCHEMA).length,
      compatibleV4Receipts: compatible.filter(item => item.receipt.schema === Experience.PREVIOUS_SCHEMA).length,
      realLocalPositiveReceipts: realPositive.length,
      realLocalNegativeReceipts: realNegative.length,
      syntheticNegativeReceiptsExcluded: excludedNegative.filter(item => item.experienceKind === 'SYNTHETIC_COUNTEREXAMPLE').length,
      contractDerivedNegativeReceiptsExcluded: excludedNegative.filter(item => item.experienceKind === 'CONTRACT_DERIVED_EXAM').length,
      legacyReceiptsExcluded: legacy.length,
      distinctFailureSignatures: requests.length,
      recurrentFailureSignatures: proposed.length,
      curriculumRequestsProposed: proposed.length,
      insufficientRecurrenceHolds: requests.length - proposed.length,
      trainingAdmissions: 0,
      codeBuilds: 0,
      repairsSelected: 0,
      organsInstalled: 0,
      runtimePromotions: 0,
      canonChanges: 0,
      worldActions: 0
    },
    state: proposed.length
      ? 'INDEPENDENT_FAILURE_CURRICULUM_REQUESTS_PROPOSED'
      : realNegative.length
        ? 'REAL_FAILURES_HELD_FOR_MORE_INDEPENDENT_RECURRENCE'
        : 'NO_VERIFIED_REAL_LOCAL_NEGATIVE_EXPERIENCE',
    authority: {
      privateProposalTraceWrite: true,
      semanticTruthWrite: false,
      trainingAdmission: false,
      heldOutMutation: false,
      codeBuild: false,
      repairSelection: false,
      installOrgan: false,
      modelChange: false,
      permissionGrant: false,
      toolUse: false,
      runtimePromotion: false,
      canonChange: false,
      identityChange: false,
      worldAction: false
    },
    boundary: 'This organ groups only verified real-local negative receipts by machine-structural failure signature and proposes independent curricula after recurrence. Synthetic and contract-derived negatives remain visible but cannot prove real need. No proposal trains, writes code, selects a repair, installs an organ, changes authority, promotes, or acts.'
  };
  batch.batchDigest = digest(Object.assign({}, batch, { batchDigest: null }));
  return batch;
}

function verifyBatch(batch, inputRecords, runDir) {
  if (!batch || batch.schema !== BATCH_SCHEMA || batch.batchDigest !== digest(Object.assign({}, batch, { batchDigest: null }))) throw new Error('reasoning failure curriculum batch digest changed');
  if (!batch.organ || batch.organ.id !== ORGAN_ID || batch.organ.learnedWeights !== false) throw new Error('reasoning failure curriculum organ boundary changed');
  const trueAuthority = new Set(['privateProposalTraceWrite']);
  if (!batch.authority || Object.entries(batch.authority).some(([key, value]) => trueAuthority.has(key) ? value !== true : value !== false)) throw new Error('reasoning failure curriculum authority changed');
  for (const request of batch.requests || []) {
    if (request.schema !== REQUEST_SCHEMA || request.requestDigest !== digest(Object.assign({}, request, { requestDigest: null }))) throw new Error('reasoning failure curriculum request digest changed');
    if (!['PATH_SELECTION_FAILURE', 'CANDIDATE_ORIGINATION_FAILURE', 'VERIFIED_ACTION_OUTCOME_FAILURE'].includes(request.failureClass)) throw new Error('reasoning failure curriculum class changed');
    if (request.curriculum.candidateMayAuthorExpectedResult !== false || request.curriculum.candidateMayAdmitTraining !== false || request.curriculum.candidateMayInstallItself !== false) throw new Error('reasoning failure curriculum exam boundary changed');
    if (!request.authority || Object.entries(request.authority).some(([key, value]) => trueAuthority.has(key) ? value !== true : value !== false)) throw new Error('reasoning failure curriculum request authority changed');
    if (request.failureClass === 'CANDIDATE_ORIGINATION_FAILURE' && !request.contractDraft) throw new Error('candidate-origination failure contract draft missing');
    if (request.failureClass !== 'CANDIDATE_ORIGINATION_FAILURE' && request.contractDraft !== null) throw new Error('non-origination failure invented an organ contract');
  }
  if (batch.summary.curriculumRequestsProposed !== (batch.requests || []).filter(item => item.state === 'PROPOSE_INDEPENDENT_CURRICULUM').length || batch.summary.trainingAdmissions !== 0 || batch.summary.codeBuilds !== 0 || batch.summary.organsInstalled !== 0) throw new Error('reasoning failure curriculum summary changed');
  if (inputRecords) {
    const expected = buildBatch(inputRecords);
    if (!same(expected, batch)) throw new Error('reasoning failure curriculum source reconstruction changed');
  }
  if (runDir) {
    const disk = JSON.parse(fs.readFileSync(path.join(runDir, 'batch.json'), 'utf8'));
    if (!same(disk, batch)) throw new Error('reasoning failure curriculum batch file changed');
  }
  return true;
}

function run(options = {}) {
  loadPolicy(options);
  const root = path.resolve(options.root || ROOT);
  const receiptDir = path.resolve(options.receiptDir || path.join(root, 'training', 'datasets', 'reasoning-receipts'));
  const records = options.records || Experience.loadDirectory(receiptDir);
  const batch = buildBatch(records);
  const stateDir = path.resolve(options.stateDir || path.join(root, 'state', 'reasoning-failure-curriculum-runs'));
  const relative = path.relative(root, stateDir);
  if (!relative || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) throw new Error('reasoning failure curriculum state must stay inside the Mirror root');
  fs.mkdirSync(stateDir, { recursive: true });
  const runDir = path.join(stateDir, batch.batchId);
  if (fs.existsSync(runDir)) {
    const existing = JSON.parse(fs.readFileSync(path.join(runDir, 'batch.json'), 'utf8'));
    verifyBatch(existing, records, runDir);
    if (existing.batchDigest !== batch.batchDigest) throw new Error('reasoning failure curriculum identity collision');
    return { batch: existing, runDir, reused: true };
  }
  const stageDir = path.join(stateDir, `.stage-${batch.batchId}-${process.pid}`);
  if (fs.existsSync(stageDir)) throw new Error(`reasoning failure curriculum staging directory already exists: ${stageDir}`);
  fs.mkdirSync(stageDir, { recursive: true });
  fs.writeFileSync(path.join(stageDir, 'batch.json'), json(batch), { flag: 'wx' });
  verifyBatch(batch, records, stageDir);
  const commit = ImmutableBatchStore.commitDirectory(stageDir, runDir);
  return { batch, runDir, reused: commit.reused };
}

module.exports = {
  ORGAN_ID, REQUEST_SCHEMA, BATCH_SCHEMA, ROOT, DEFAULT_RECEIPT_DIR, DEFAULT_STATE_DIR, REQUIRED_REAL_SOURCE_GROUPS,
  SOURCE_PATHS, sourceBinding, loadPolicy, normalizeRecords, failureClass, signatureBasis, buildBatch, verifyBatch, run, digest
};
