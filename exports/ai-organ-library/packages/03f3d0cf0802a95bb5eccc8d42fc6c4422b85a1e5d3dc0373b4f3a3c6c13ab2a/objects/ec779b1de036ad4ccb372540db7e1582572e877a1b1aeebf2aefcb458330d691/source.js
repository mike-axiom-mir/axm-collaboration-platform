'use strict';

const fs = require('fs');
const path = require('path');
const Cell = require('../kernel/reasoning-experience-foundation-evidence-cell');
const NativeInventory = require('./foundation-capability-native-artifact-inventory-organ');
const OutputAdapterPlanner = require('./foundation-development-capability-output-adapter-planner-organ');
const HandPlanner = require('./foundation-development-hand-planner-organ');
const EnvelopeAdapter = require('./foundation-evidence-envelope-adapter-organ');
const ImmutableBatchStore = require('../kernel/immutable-batch-store');

const ORGAN_ID = 'axm.mirror.foundation-native-evidence-eligibility-organ/v1';
const BATCH_SCHEMA = 'axm.mirror.foundation-native-evidence-eligibility-batch/v1';
const STATUS = 'TEST_HARDCODED_REASONING_RECEIPT_NATIVE_VERIFICATION_AND_EXACT_EVIDENCE_ELIGIBILITY';
const ROOT = path.resolve(__dirname, '..');
const CELL_SOURCE_PATH = 'kernel/reasoning-experience-foundation-evidence-cell.js';
const ORGAN_SOURCE_PATH = 'organs/foundation-native-evidence-eligibility-organ.js';
const EXPERIENCE_SOURCE_PATH = 'organs/reasoning-experience-organ.js';
const ADAPTER_SOURCE_PATH = 'organs/foundation-evidence-envelope-adapter-organ.js';
const DEFAULT_NATIVE_STATE_DIR = NativeInventory.DEFAULT_STATE_DIR;
const DEFAULT_ADAPTER_STATE_DIR = OutputAdapterPlanner.DEFAULT_STATE_DIR;
const DEFAULT_HAND_STATE_DIR = HandPlanner.DEFAULT_STATE_DIR;
const DEFAULT_STATE_DIR = path.join(ROOT, 'state', 'foundation-native-evidence-eligibility-runs');
const VERIFIED_NATIVE_RECEIPT_STATES = new Set([
  'VERIFIED_BY_HARDCODED_V4_RECEIPT_VERIFIER',
  'VERIFIED_BY_HARDCODED_V4_V5_RECEIPT_VERIFIER'
]);

function stable(value) { return Cell.stable(value); }
function digest(value) { return Cell.digest(value); }
function same(left, right) { return Cell.same(left, right); }
function json(value) { return JSON.stringify(stable(value), null, 2) + '\n'; }
function sourceSha256(sourcePath, sourceBytes) { return digest(sourceBytes == null ? fs.readFileSync(path.join(ROOT, sourcePath)) : Buffer.from(sourceBytes)); }

function boundedChild(parent, child) {
  const resolvedParent = path.resolve(parent);
  const target = path.resolve(resolvedParent, child);
  if (path.dirname(target) !== resolvedParent) throw new Error(`foundation native evidence path escapes its parent: ${child}`);
  return target;
}

function boundedArtifact(root, relativePath) {
  const text = String(relativePath || '').replace(/\\/g, '/');
  if (!text || path.isAbsolute(text) || text.startsWith('/') || text.includes('\0') || text.split('/').some(part => !part || part === '.' || part === '..')) {
    throw new Error('foundation native evidence artifact path changed');
  }
  const resolvedRoot = path.resolve(root);
  const target = path.resolve(resolvedRoot, text);
  const relative = path.relative(resolvedRoot, target).replace(/\\/g, '/');
  if (relative !== text || relative === '..' || relative.startsWith('../')) throw new Error('foundation native evidence artifact escaped Mirror');
  return target;
}

function loadPolicy(options = {}) {
  const root = path.resolve(options.root || ROOT);
  const policy = options.policy || JSON.parse(fs.readFileSync(path.resolve(options.policyPath || path.join(root, 'training', 'TRAINING_POLICY.json')), 'utf8'));
  if (!policy || policy.schema !== 'axm.mirror.training-policy/v1') throw new Error('foundation native evidence eligibility requires the Mirror training policy');
  if (policy.automaticFoundationNativeEvidenceEligibilityAssessment !== true) throw new Error('automatic foundation native evidence eligibility assessment is not enabled');
  if (!String(policy.foundationNativeEvidenceEligibilityAssessmentScope || '').includes('hardcoded-v4-v5-receipt-verification-all-artifacts-exact-need-candidates-not-admission')) {
    throw new Error('foundation native evidence eligibility policy scope is incomplete');
  }
  if (policy.automaticRuntimePromotion !== false || policy.automaticCanonPromotion !== false || policy.automaticAuthorityGrowth !== false) {
    throw new Error('foundation native evidence eligibility refuses runtime, canon, or authority growth');
  }
  return policy;
}

function verifySources(nativeBatch, adapterBatch, handBatch) {
  NativeInventory.verifyBatch(nativeBatch);
  OutputAdapterPlanner.verifyBatch(adapterBatch);
  HandPlanner.verifyBatch(handBatch);
  if (nativeBatch.source.adapterRequestBatchId !== adapterBatch.batchId || nativeBatch.source.adapterRequestBatchDigest !== adapterBatch.batchDigest) {
    throw new Error('foundation native evidence eligibility changed its inventory-to-adapter binding');
  }
  const requests = new Map((adapterBatch.requests || []).map(request => [request.adapterRequestId, request]));
  const hands = new Map((handBatch.hands || []).map(hand => [hand.handRequestId, hand]));
  for (const result of nativeBatch.results || []) {
    const request = requests.get(result.adapterRequestId);
    if (!request || request.adapterRequestDigest !== result.adapterRequestDigest) throw new Error('foundation native evidence inventory result lacks its exact adapter request');
    const hand = hands.get(request.source.handRequestId);
    if (!hand || hand.handRequestDigest !== request.source.handRequestDigest) throw new Error('foundation native evidence adapter request lacks its exact hand');
  }
  return { requests, hands };
}

function sourceBindingHold(inventoryResult, artifact, request, hand, state, issue) {
  const result = {
    assessmentId: null,
    inventoryResultId: inventoryResult.resultId,
    adapterRequestId: request.adapterRequestId,
    adapterRequestDigest: request.adapterRequestDigest,
    handRequestId: hand.handRequestId,
    handRequestDigest: hand.handRequestDigest,
    capabilityId: inventoryResult.capabilityId,
    nativeOutputKind: inventoryResult.nativeOutputKind,
    artifact: {
      path: artifact.path,
      bytes: artifact.bytes,
      fileSha256: artifact.fileSha256,
      artifactDigest: artifact.artifactDigest,
      sourceStableDuringAssessment: false
    },
    native: {
      receiptId: null,
      receiptDigest: null,
      verificationState: 'NOT_EXECUTED_SOURCE_BINDING_HOLD',
      permissionState: 'UNKNOWN',
      sourceClass: 'UNKNOWN',
      observedOutcome: 'UNKNOWN',
      independenceState: 'UNKNOWN'
    },
    criteria: null,
    failedCriteria: [],
    state,
    issue,
    evidenceCandidate: null,
    authority: closedResultAuthority(),
    boundary: 'The sealed artifact source no longer matched its inventory witness, so native verification and evidence candidacy were not attempted.'
  };
  result.assessmentId = `foundation-native-evidence-assessment-${digest(Object.assign({}, result, { assessmentId: null })).slice(0, 24)}`;
  return result;
}

function closedResultAuthority() {
  return {
    artifactSelection: false,
    evidenceAdmission: false,
    evidenceRelabeling: false,
    eventInduction: false,
    capabilitySelection: false,
    operationalFitClaim: false,
    newOrganNeedClaim: false,
    permissionGrant: false,
    trainingAdmission: false,
    runtimePromotion: false,
    canonChange: false,
    worldAction: false
  };
}

function assessArtifact(inventoryResult, artifact, request, hand, options = {}) {
  if (artifact.genericEnvelopeCompatibility !== 'COMPATIBLE_NOT_EXECUTED') {
    return sourceBindingHold(inventoryResult, artifact, request, hand, 'HOLD_GENERIC_ENVELOPE_BOUNDARY_REFUSED', artifact.genericEnvelopeBoundaryState || 'GENERIC_ENVELOPE_BOUNDARY_REFUSED');
  }
  if (inventoryResult.capabilityId !== Cell.TARGET_CAPABILITY || !Cell.TARGET_OUTPUT_KINDS.includes(inventoryResult.nativeOutputKind)) {
    return sourceBindingHold(inventoryResult, artifact, request, hand, 'HOLD_NO_HARDCODED_NATIVE_EVIDENCE_SEMANTICS', 'NO_MATCHING_HARDCODED_NATIVE_VERIFIER');
  }
  const root = path.resolve(options.root || ROOT);
  const file = boundedArtifact(root, artifact.path);
  let firstBytes;
  try {
    const stat = fs.lstatSync(file);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size !== artifact.bytes) throw new Error('file shape changed');
    firstBytes = fs.readFileSync(file);
    if (digest(firstBytes) !== artifact.fileSha256) throw new Error('file digest changed');
  } catch (error) {
    return sourceBindingHold(inventoryResult, artifact, request, hand, 'HOLD_NATIVE_ARTIFACT_SOURCE_BINDING_CHANGED', 'FILE_SHAPE_OR_DIGEST_CHANGED');
  }
  let receipt;
  try {
    receipt = JSON.parse(firstBytes.toString('utf8'));
    if (digest(receipt) !== artifact.artifactDigest) throw new Error('artifact digest changed');
  } catch (error) {
    return sourceBindingHold(inventoryResult, artifact, request, hand, 'HOLD_NATIVE_ARTIFACT_SOURCE_BINDING_CHANGED', 'JSON_OR_CANONICAL_ARTIFACT_DIGEST_CHANGED');
  }
  if (typeof options.onAfterArtifactRead === 'function') options.onAfterArtifactRead({ path: artifact.path, file, receipt: stable(receipt) });
  let secondBytes;
  try {
    const stat = fs.lstatSync(file);
    secondBytes = fs.readFileSync(file);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size !== artifact.bytes || digest(secondBytes) !== artifact.fileSha256 || !firstBytes.equals(secondBytes)) {
      throw new Error('source changed during assessment');
    }
  } catch (error) {
    return sourceBindingHold(inventoryResult, artifact, request, hand, 'HOLD_NATIVE_ARTIFACT_CHANGED_DURING_ASSESSMENT', 'SOURCE_CHANGED_DURING_ASSESSMENT');
  }
  const assessment = Cell.evaluate(receipt, artifact.artifactDigest, hand, request);
  const candidate = assessment.eligible ? EnvelopeAdapter.buildCandidate(assessment.envelopeInput, request, hand) : null;
  if (candidate) EnvelopeAdapter.verifyCandidate(candidate, assessment.envelopeInput, request, hand);
  const result = {
    assessmentId: null,
    inventoryResultId: inventoryResult.resultId,
    adapterRequestId: request.adapterRequestId,
    adapterRequestDigest: request.adapterRequestDigest,
    handRequestId: hand.handRequestId,
    handRequestDigest: hand.handRequestDigest,
    capabilityId: inventoryResult.capabilityId,
    nativeOutputKind: inventoryResult.nativeOutputKind,
    artifact: {
      path: artifact.path,
      bytes: artifact.bytes,
      fileSha256: artifact.fileSha256,
      artifactDigest: artifact.artifactDigest,
      sourceStableDuringAssessment: true
    },
    native: {
      receiptId: assessment.receiptId,
      receiptDigest: assessment.receiptDigest,
      verificationState: assessment.criteria.nativeReceiptVerified ? 'VERIFIED_BY_HARDCODED_V4_V5_RECEIPT_VERIFIER' : 'REFUSED_BY_HARDCODED_V4_V5_RECEIPT_VERIFIER',
      permissionState: assessment.permission.status,
      sourceClass: assessment.provenance.sourceClass,
      observedOutcome: assessment.provenance.observedOutcome,
      independenceState: assessment.provenance.independenceState
    },
    criteria: assessment.criteria,
    failedCriteria: assessment.failedCriteria,
    state: assessment.state,
    issue: assessment.verificationIssue,
    evidenceCandidate: candidate,
    authority: closedResultAuthority(),
    boundary: 'All current artifacts are evaluated without ranking. An eligible result may produce an opaque content-sealed candidate, but neither this result nor its candidate is admitted as Foundation evidence.'
  };
  result.assessmentId = `foundation-native-evidence-assessment-${digest(Object.assign({}, result, { assessmentId: null })).slice(0, 24)}`;
  return stable(result);
}

function expectedSummary(assessments, sourceHolds) {
  return {
    nativeInventoryResultsExamined: sourceHolds.length,
    artifactsExamined: assessments.length,
    nativeVerifierExecutions: assessments.filter(item => item.native.verificationState !== 'NOT_EXECUTED_SOURCE_BINDING_HOLD').length,
    nativeReceiptsVerified: assessments.filter(item => VERIFIED_NATIVE_RECEIPT_STATES.has(item.native.verificationState)).length,
    permissionEvaluations: assessments.filter(item => item.native.verificationState !== 'NOT_EXECUTED_SOURCE_BINDING_HOLD').length,
    evidenceEligibilityEvaluations: assessments.filter(item => item.native.verificationState !== 'NOT_EXECUTED_SOURCE_BINDING_HOLD').length,
    realLocalArtifacts: assessments.filter(item => item.native.sourceClass === 'REAL_LOCAL').length,
    syntheticOrContractDerivedArtifacts: assessments.filter(item => item.native.sourceClass === 'SYNTHETIC_FIXTURE').length,
    negativeArtifacts: assessments.filter(item => item.native.observedOutcome === 'NEGATIVE').length,
    positiveArtifacts: assessments.filter(item => item.native.observedOutcome === 'POSITIVE').length,
    eligibleEvidenceCandidates: assessments.filter(item => item.state === Cell.ELIGIBLE_STATE).length,
    evidenceCandidatesProduced: assessments.filter(item => item.evidenceCandidate !== null).length,
    genericAdapterExecutions: assessments.filter(item => item.evidenceCandidate !== null).length,
    heldAssessments: assessments.filter(item => item.state !== Cell.ELIGIBLE_STATE).length,
    sourceBindingHolds: assessments.filter(item => item.artifact.sourceStableDuringAssessment === false).length,
    unsupportedNativeSemantics: assessments.filter(item => item.state === 'HOLD_NO_HARDCODED_NATIVE_EVIDENCE_SEMANTICS').length,
    artifactSelections: 0,
    evidenceAdmissions: 0,
    evidenceRelabelings: 0,
    eventInductions: 0,
    nativeSourceExecutions: 0,
    capabilitiesSelected: 0,
    operationalFitsClaimed: 0,
    newOrgansRequired: 0,
    trainingAdmissions: 0,
    permissionGrants: 0,
    runtimePromotions: 0,
    canonChanges: 0,
    worldActions: 0
  };
}

function buildBatch(nativeBatch, adapterBatch, handBatch, options = {}) {
  const loaded = verifySources(nativeBatch, adapterBatch, handBatch);
  const assessments = [];
  const sourceHolds = [];
  for (const inventoryResult of (nativeBatch.results || []).slice().sort((a, b) => a.resultId.localeCompare(b.resultId))) {
    const request = loaded.requests.get(inventoryResult.adapterRequestId);
    const hand = loaded.hands.get(request.source.handRequestId);
    sourceHolds.push({
      inventoryResultId: inventoryResult.resultId,
      adapterRequestId: inventoryResult.adapterRequestId,
      capabilityId: inventoryResult.capabilityId,
      nativeOutputKind: inventoryResult.nativeOutputKind,
      inventoryState: inventoryResult.state,
      artifactsAvailable: (inventoryResult.artifacts || []).length,
      assessmentState: (inventoryResult.artifacts || []).length ? 'ARTIFACTS_ASSESSED_SEPARATELY' : 'HOLD_NO_ARTIFACTS_AVAILABLE'
    });
    for (const artifact of (inventoryResult.artifacts || []).slice().sort((a, b) => a.path.localeCompare(b.path))) {
      assessments.push(assessArtifact(inventoryResult, artifact, request, hand, options));
    }
  }
  assessments.sort((a, b) => a.assessmentId.localeCompare(b.assessmentId));
  const source = {
    nativeInventoryBatchId: nativeBatch.batchId,
    nativeInventoryBatchDigest: nativeBatch.batchDigest,
    adapterRequestBatchId: adapterBatch.batchId,
    adapterRequestBatchDigest: adapterBatch.batchDigest,
    handBatchId: handBatch.batchId,
    handBatchDigest: handBatch.batchDigest,
    cellSourcePath: CELL_SOURCE_PATH,
    cellSourceSha256: sourceSha256(CELL_SOURCE_PATH, options.cellSourceBytes),
    organSourcePath: ORGAN_SOURCE_PATH,
    organSourceSha256: sourceSha256(ORGAN_SOURCE_PATH, options.organSourceBytes),
    nativeVerifierSourcePath: EXPERIENCE_SOURCE_PATH,
    nativeVerifierSourceSha256: sourceSha256(EXPERIENCE_SOURCE_PATH, options.experienceSourceBytes),
    envelopeAdapterSourcePath: ADAPTER_SOURCE_PATH,
    envelopeAdapterSourceSha256: sourceSha256(ADAPTER_SOURCE_PATH, options.adapterSourceBytes)
  };
  const summary = expectedSummary(assessments, sourceHolds);
  const batch = {
    schema: BATCH_SCHEMA,
    batchId: `foundation-native-evidence-eligibility-${digest({ organId: ORGAN_ID, source, assessments, sourceHolds }).slice(0, 24)}`,
    batchDigest: null,
    organ: {
      id: ORGAN_ID,
      status: STATUS,
      learnedWeights: false,
      hardcodedEvidenceSemantics: Cell.TARGET_EVIDENCE_KIND,
      evaluatesEveryArtifact: true,
      firstMatchSelection: false,
      eventInduction: false
    },
    source,
    sourceHolds,
    assessments,
    summary,
    state: summary.eligibleEvidenceCandidates > 0 ? 'ELIGIBLE_NATIVE_EVIDENCE_CANDIDATES_PRODUCED_NOT_ADMITTED'
      : summary.artifactsExamined > 0 ? 'HOLD_NO_ELIGIBLE_NATIVE_EVIDENCE_CANDIDATES'
        : 'HOLD_NO_NATIVE_ARTIFACTS_TO_ASSESS',
    authority: {
      privateEvidenceTraceWrite: true,
      privateArtifactRead: true,
      nativeVerifierExecution: true,
      evidenceEligibilityAssessment: true,
      genericAdapterExecution: true,
      artifactSelection: false,
      evidenceAdmission: false,
      evidenceRelabeling: false,
      eventInduction: false,
      nativeSourceExecution: false,
      capabilitySelection: false,
      operationalFitClaim: false,
      newOrganNeedClaim: false,
      permissionGrant: false,
      trainingAdmission: false,
      runtimePromotion: false,
      canonChange: false,
      worldAction: false
    },
    boundary: 'This hardcoded organ may read every exact inventoried compatible v4 or v5 reasoning receipt, execute its deterministic native verifier, assess explicit permission/provenance against one exact passive-negative evidence need, and run the opaque generic adapter for every eligible artifact. It does not select first or best, induce failure, certify authorship or independence, admit or relabel evidence, claim operational fit, decide organ need, train, promote, change canon, or act.'
  };
  batch.batchDigest = digest(Object.assign({}, batch, { batchDigest: null }));
  return stable(batch);
}

function verifyBatch(batch, nativeBatch, adapterBatch, handBatch, runDir, options = {}) {
  if (!batch || batch.schema !== BATCH_SCHEMA || batch.batchDigest !== digest(Object.assign({}, batch, { batchDigest: null }))) throw new Error('foundation native evidence eligibility batch digest changed');
  const expectedId = `foundation-native-evidence-eligibility-${digest({ organId: ORGAN_ID, source: batch.source, assessments: batch.assessments, sourceHolds: batch.sourceHolds }).slice(0, 24)}`;
  if (batch.batchId !== expectedId) throw new Error('foundation native evidence eligibility batch id changed');
  if (!batch.organ || batch.organ.id !== ORGAN_ID || batch.organ.learnedWeights !== false || batch.organ.hardcodedEvidenceSemantics !== Cell.TARGET_EVIDENCE_KIND || batch.organ.evaluatesEveryArtifact !== true || batch.organ.firstMatchSelection !== false || batch.organ.eventInduction !== false) {
    throw new Error('foundation native evidence eligibility organ boundary changed');
  }
  const allowedTrue = new Set(['privateEvidenceTraceWrite', 'privateArtifactRead', 'nativeVerifierExecution', 'evidenceEligibilityAssessment', 'genericAdapterExecution']);
  if (!batch.authority || Object.entries(batch.authority).some(([key, value]) => allowedTrue.has(key) ? value !== true : value !== false)) throw new Error('foundation native evidence eligibility authority changed');
  if (!same(batch.summary, expectedSummary(batch.assessments || [], batch.sourceHolds || []))) throw new Error('foundation native evidence eligibility summary changed');
  for (const result of batch.assessments || []) {
    const expectedAssessmentId = `foundation-native-evidence-assessment-${digest(Object.assign({}, result, { assessmentId: null })).slice(0, 24)}`;
    if (result.assessmentId !== expectedAssessmentId || Object.values(result.authority || {}).some(value => value !== false)) throw new Error('foundation native evidence assessment boundary changed');
    if ((result.state === Cell.ELIGIBLE_STATE) !== (result.evidenceCandidate !== null)) throw new Error('foundation native evidence candidate eligibility changed');
    if (result.evidenceCandidate) EnvelopeAdapter.verifyCandidate(result.evidenceCandidate);
  }
  if (batch.summary.artifactSelections !== 0 || batch.summary.evidenceAdmissions !== 0 || batch.summary.evidenceRelabelings !== 0 || batch.summary.eventInductions !== 0 || batch.summary.nativeSourceExecutions !== 0 || batch.summary.capabilitiesSelected !== 0 || batch.summary.operationalFitsClaimed !== 0 || batch.summary.newOrgansRequired !== 0 || batch.summary.trainingAdmissions !== 0 || batch.summary.permissionGrants !== 0 || batch.summary.runtimePromotions !== 0 || batch.summary.canonChanges !== 0 || batch.summary.worldActions !== 0) {
    throw new Error('foundation native evidence eligibility claim ceiling changed');
  }
  if (nativeBatch && adapterBatch && handBatch && !same(buildBatch(nativeBatch, adapterBatch, handBatch, options), batch)) throw new Error('foundation native evidence eligibility batch content changed');
  if (runDir) {
    const disk = JSON.parse(fs.readFileSync(path.join(runDir, 'batch.json'), 'utf8'));
    if (!same(disk, batch)) throw new Error('foundation native evidence eligibility batch file changed');
  }
  return true;
}

function loadBatch(stateDir, batchId, label) {
  if (!/^[a-z0-9-]+$/.test(String(batchId || ''))) throw new Error(`foundation native evidence ${label} batch id changed`);
  const runDir = boundedChild(stateDir, batchId);
  return { batch: JSON.parse(fs.readFileSync(path.join(runDir, 'batch.json'), 'utf8')), runDir };
}

function loadCurrentSources(options = {}) {
  if (options.nativeBatch && options.adapterBatch && options.handBatch) {
    verifySources(options.nativeBatch, options.adapterBatch, options.handBatch);
    return { nativeBatch: options.nativeBatch, adapterBatch: options.adapterBatch, handBatch: options.handBatch };
  }
  const root = path.resolve(options.root || ROOT);
  const status = JSON.parse(fs.readFileSync(path.resolve(options.statusPath || path.join(root, 'STATUS.json')), 'utf8'));
  const nativeId = (status.foundationCapabilityNativeArtifactInventoryEvidence || {}).currentBatchId;
  const native = loadBatch(path.resolve(options.nativeStateDir || DEFAULT_NATIVE_STATE_DIR), nativeId, 'native inventory');
  NativeInventory.verifyBatch(native.batch, null, null, null, native.runDir);
  const adapterId = (native.batch.source || {}).adapterRequestBatchId;
  const adapter = loadBatch(path.resolve(options.adapterStateDir || DEFAULT_ADAPTER_STATE_DIR), adapterId, 'adapter request');
  OutputAdapterPlanner.verifyBatch(adapter.batch, null, null, adapter.runDir);
  const handId = (adapter.batch.source || {}).handBatchId;
  const hand = loadBatch(path.resolve(options.handStateDir || DEFAULT_HAND_STATE_DIR), handId, 'hand');
  HandPlanner.verifyBatch(hand.batch, null, hand.runDir);
  verifySources(native.batch, adapter.batch, hand.batch);
  return { nativeBatch: native.batch, adapterBatch: adapter.batch, handBatch: hand.batch };
}

function run(options = {}) {
  loadPolicy(options);
  const sources = loadCurrentSources(options);
  const batch = buildBatch(sources.nativeBatch, sources.adapterBatch, sources.handBatch, options);
  const stateDir = path.resolve(options.stateDir || DEFAULT_STATE_DIR);
  fs.mkdirSync(stateDir, { recursive: true });
  const runDir = path.join(stateDir, batch.batchId);
  if (fs.existsSync(runDir)) {
    const existing = JSON.parse(fs.readFileSync(path.join(runDir, 'batch.json'), 'utf8'));
    verifyBatch(existing, sources.nativeBatch, sources.adapterBatch, sources.handBatch, runDir, options);
    if (existing.batchDigest !== batch.batchDigest) throw new Error('foundation native evidence eligibility batch identity collision');
    return { batch: existing, runDir, reused: true };
  }
  const stageDir = path.join(stateDir, `.stage-${batch.batchId}-${process.pid}`);
  if (fs.existsSync(stageDir)) throw new Error(`foundation native evidence eligibility staging directory already exists: ${stageDir}`);
  fs.mkdirSync(stageDir, { recursive: true });
  fs.writeFileSync(path.join(stageDir, 'batch.json'), json(batch), { flag: 'wx' });
  verifyBatch(batch, sources.nativeBatch, sources.adapterBatch, sources.handBatch, stageDir, options);
  const commit = ImmutableBatchStore.commitDirectory(stageDir, runDir);
  return { batch, runDir, reused: commit.reused };
}

function loadVerifiedEvidence(options = {}) {
  const stateDir = path.resolve(options.stateDir || DEFAULT_STATE_DIR);
  if (!fs.existsSync(stateDir)) return { batches: 0, currentSourceBatches: 0, staleBatches: 0, eligibleCandidates: [], batchDigests: [], authoritySeams: 0 };
  const currentSource = {
    cellSourcePath: CELL_SOURCE_PATH,
    cellSourceSha256: sourceSha256(CELL_SOURCE_PATH, options.cellSourceBytes),
    organSourcePath: ORGAN_SOURCE_PATH,
    organSourceSha256: sourceSha256(ORGAN_SOURCE_PATH, options.organSourceBytes),
    nativeVerifierSourcePath: EXPERIENCE_SOURCE_PATH,
    nativeVerifierSourceSha256: sourceSha256(EXPERIENCE_SOURCE_PATH, options.experienceSourceBytes),
    envelopeAdapterSourcePath: ADAPTER_SOURCE_PATH,
    envelopeAdapterSourceSha256: sourceSha256(ADAPTER_SOURCE_PATH, options.adapterSourceBytes)
  };
  const eligible = [];
  const digests = [];
  let currentSourceBatches = 0;
  let staleBatches = 0;
  for (const entry of fs.readdirSync(stateDir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    if (!entry.isDirectory() || entry.name.startsWith('.stage-')) continue;
    const runDir = boundedChild(stateDir, entry.name);
    const batch = JSON.parse(fs.readFileSync(path.join(runDir, 'batch.json'), 'utf8'));
    verifyBatch(batch, null, null, null, runDir);
    digests.push(batch.batchDigest);
    const batchSource = {};
    for (const key of Object.keys(currentSource)) batchSource[key] = batch.source[key];
    if (!same(batchSource, currentSource)) {
      staleBatches += 1;
      continue;
    }
    currentSourceBatches += 1;
    const native = loadBatch(path.resolve(options.nativeStateDir || DEFAULT_NATIVE_STATE_DIR), batch.source.nativeInventoryBatchId, 'native inventory');
    const adapter = loadBatch(path.resolve(options.adapterStateDir || DEFAULT_ADAPTER_STATE_DIR), batch.source.adapterRequestBatchId, 'adapter request');
    const hand = loadBatch(path.resolve(options.handStateDir || DEFAULT_HAND_STATE_DIR), batch.source.handBatchId, 'hand');
    verifyBatch(batch, native.batch, adapter.batch, hand.batch, runDir, options);
    for (const assessment of batch.assessments || []) if (assessment.state === Cell.ELIGIBLE_STATE && assessment.evidenceCandidate) {
      eligible.push({
        batchId: batch.batchId,
        batchDigest: batch.batchDigest,
        assessmentId: assessment.assessmentId,
        receiptId: assessment.native.receiptId,
        receiptDigest: assessment.native.receiptDigest,
        candidateId: assessment.evidenceCandidate.candidateId,
        candidateDigest: assessment.evidenceCandidate.candidateDigest,
        evidenceKind: Cell.TARGET_EVIDENCE_KIND,
        sourceClass: assessment.native.sourceClass,
        observedOutcome: assessment.native.observedOutcome,
        permissionState: assessment.native.permissionState,
        independenceState: assessment.native.independenceState,
        admitted: false
      });
    }
  }
  const unique = Array.from(new Map(eligible.map(item => [item.receiptDigest, item])).values()).sort((a, b) => a.receiptDigest.localeCompare(b.receiptDigest));
  return { batches: digests.length, currentSourceBatches, staleBatches, eligibleCandidates: unique, batchDigests: digests.sort(), authoritySeams: 0 };
}

module.exports = {
  ORGAN_ID, BATCH_SCHEMA, STATUS, ROOT, CELL_SOURCE_PATH, ORGAN_SOURCE_PATH, EXPERIENCE_SOURCE_PATH, ADAPTER_SOURCE_PATH,
  DEFAULT_NATIVE_STATE_DIR, DEFAULT_ADAPTER_STATE_DIR, DEFAULT_HAND_STATE_DIR, DEFAULT_STATE_DIR,
  stable, digest, sourceSha256, boundedArtifact, loadPolicy, verifySources, closedResultAuthority, assessArtifact, expectedSummary, buildBatch, verifyBatch,
  loadCurrentSources, run, loadVerifiedEvidence
};
