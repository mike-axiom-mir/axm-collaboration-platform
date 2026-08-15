'use strict';

const fs = require('fs');
const path = require('path');
const Cell = require('../kernel/workshop-transfer-regression-exam-cell');
const WorkshopRoot = require('../config/workshop-root');
const ImmutableBatchStore = require('../kernel/immutable-batch-store');

const ORGAN_ID = 'axm.mirror.workshop-transfer-regression-exam-organ/v1';
const EXAM_SCHEMA = 'axm.mirror.workshop-transfer-regression-exam/v1';
const ROOT = path.resolve(__dirname, '..');
const DEFAULT_STATE_DIR = path.join(ROOT, 'state', 'workshop-transfer-regression-exams');
const DEFAULT_HAND_STATE_DIR = path.join(ROOT, 'state', 'foundation-development-hand-runs');
const DEFAULT_FRONTIER_STATE_DIR = path.join(ROOT, 'state', 'foundation-development-frontier-runs');
const DEFAULT_AUDIT_PATH = path.join(ROOT, 'exports', 'action-reports', 'MIRROR_SETTLED_WORKSHOP_GROWTH_AUDIT_2026-07-18.json');
const TARGET_DIMENSION = 'DISCOVERY_TRANSFER_ACROSS_WORKSHOP_GROWTH';

function stable(value) { return Cell.stable(value); }
function digest(value) { return Cell.digest(value); }
function json(value) { return JSON.stringify(stable(value), null, 2) + '\n'; }
function same(left, right) { return Cell.same(left, right); }

function boundedChild(parent, child) {
  const resolvedParent = path.resolve(parent);
  const target = path.resolve(resolvedParent, child);
  if (path.dirname(target) !== resolvedParent) throw new Error(`Workshop transfer exam path escapes its parent: ${child}`);
  return target;
}

function loadPolicy(options = {}) {
  const policyPath = path.resolve(options.policyPath || path.join(ROOT, 'training', 'TRAINING_POLICY.json'));
  const policy = options.policy || JSON.parse(fs.readFileSync(policyPath, 'utf8'));
  if (!policy || policy.schema !== 'axm.mirror.training-policy/v1') throw new Error('Workshop transfer revalidation requires the Mirror training policy');
  if (policy.automaticWorkshopTransferRegressionRevalidation !== true) throw new Error('automatic Workshop transfer regression revalidation is not enabled');
  if (!String(policy.workshopTransferRegressionRevalidationScope || '').includes('read-only-current-source-no-workshop-code-execution-no-training-no-repair')) throw new Error('Workshop transfer revalidation policy scope is incomplete');
  if (policy.automaticRuntimePromotion !== false || policy.automaticCanonPromotion !== false || policy.automaticAuthorityGrowth !== false) throw new Error('Workshop transfer revalidation refuses runtime, canon, or authority growth');
  return policy;
}

function loadJson(file, label) {
  const bytes = fs.readFileSync(file);
  let value;
  try { value = JSON.parse(bytes.toString('utf8')); } catch (error) { throw new Error(`${label} is not valid JSON`); }
  return { value, bytes, sha256: digest(bytes) };
}

function loadCurrentBinding(options = {}) {
  // Lazy imports avoid a cycle when the Foundation observatory loads only
  // already-sealed matching exams as one of its evidence dimensions.
  const FrontierRouter = require('./foundation-development-frontier-router-organ');
  const HandPlanner = require('./foundation-development-hand-planner-organ');
  if (options.frontierBatch && options.handBatch) {
    const source = options.frontierSource || null;
    FrontierRouter.verifyBatch(options.frontierBatch, source || undefined);
    HandPlanner.verifyBatch(options.handBatch, options.frontierBatch);
    return { frontierBatch: options.frontierBatch, handBatch: options.handBatch, source };
  }
  const statusPath = path.resolve(options.statusPath || path.join(ROOT, 'STATUS.json'));
  const status = JSON.parse(fs.readFileSync(statusPath, 'utf8'));
  const handBatchId = (status.foundationDevelopmentHandPlannerEvidence || {}).currentBatchId;
  const frontierBatchId = (status.foundationDevelopmentFrontierRouterEvidence || {}).currentBatchId;
  if (!/^foundation-development-hands-[a-f0-9]{24}$/.test(String(handBatchId || '')) || !/^foundation-development-frontier-[a-f0-9]{24}$/.test(String(frontierBatchId || ''))) {
    throw new Error('Workshop transfer revalidation current hand or frontier batch is missing');
  }
  const handStateDir = path.resolve(options.handStateDir || DEFAULT_HAND_STATE_DIR);
  const frontierStateDir = path.resolve(options.frontierStateDir || DEFAULT_FRONTIER_STATE_DIR);
  const handRunDir = boundedChild(handStateDir, handBatchId);
  const frontierRunDir = boundedChild(frontierStateDir, frontierBatchId);
  const handBatch = JSON.parse(fs.readFileSync(path.join(handRunDir, 'batch.json'), 'utf8'));
  const frontierBatch = JSON.parse(fs.readFileSync(path.join(frontierRunDir, 'batch.json'), 'utf8'));
  const source = FrontierRouter.loadCurrentSource(options);
  FrontierRouter.verifyBatch(frontierBatch, source, frontierRunDir);
  HandPlanner.verifyBatch(handBatch, frontierBatch, handRunDir);
  return { frontierBatch, handBatch, source };
}

function selectRegressionBinding(loaded) {
  const eligible = (loaded.handBatch.hands || []).filter(hand => hand.handFamily === 'INDEPENDENT_REGRESSION_EXAM_HAND' &&
    hand.evidenceNeed && hand.evidenceNeed.evidenceKind === 'BOUND_INDEPENDENT_REGRESSION_EXAM' && hand.source && hand.source.dimensionId === TARGET_DIMENSION);
  if (!eligible.length) return null;
  if (eligible.length !== 1) throw new Error(`Workshop transfer revalidation requires exactly one ${TARGET_DIMENSION} regression hand`);
  const hand = eligible[0];
  const request = (loaded.frontierBatch.requests || []).find(item => item.requestId === hand.source.frontierRequestId);
  if (!request || request.requestDigest !== hand.source.frontierRequestDigest || request.dimensionId !== TARGET_DIMENSION || request.classification !== 'REGRESSION_INVESTIGATION_REQUEST') {
    throw new Error('Workshop transfer regression hand no longer binds its exact frontier request');
  }
  if (!request.observation || !request.observation.snapshotId || !request.observation.snapshotDigest || !request.observation.executionId || !request.observation.executionReceiptDigest) {
    throw new Error('Workshop transfer regression request lacks exact observation lineage');
  }
  return stable({
    dimensionId: TARGET_DIMENSION,
    observedState: request.observedState,
    handBatchId: loaded.handBatch.batchId,
    handBatchDigest: loaded.handBatch.batchDigest,
    handRequestId: hand.handRequestId,
    handRequestDigest: hand.handRequestDigest,
    frontierBatchId: loaded.frontierBatch.batchId,
    frontierBatchDigest: loaded.frontierBatch.batchDigest,
    frontierRequestId: request.requestId,
    frontierRequestDigest: request.requestDigest,
    snapshotId: request.observation.snapshotId,
    snapshotDigest: request.observation.snapshotDigest,
    executionId: request.observation.executionId,
    executionReceiptDigest: request.observation.executionReceiptDigest,
    deltas: request.deltas,
    evidenceNeed: hand.evidenceNeed,
    candidateRepair: null,
    causeHypothesis: 'The changed Workshop source topology may have invalidated typed contract-boundary conservation or exact manifest-bound route selection.'
  });
}

function buildExam(result, binding, settledAudit, settledAuditBytes, options = {}) {
  Cell.verify(result);
  if (!same(result.regressionBinding, binding)) throw new Error('Workshop transfer revalidation result binding changed');
  const lineage = Cell.sourceLineage(options.root || ROOT);
  const basis = {
    organId: ORGAN_ID,
    regressionBindingDigest: digest(binding),
    resultDigest: result.resultDigest,
    sourceInventoryDigest: result.source.after.digest,
    settledAuditSha256: digest(settledAuditBytes),
    sourceLineage: lineage,
    criteriaId: Cell.CRITERIA_ID
  };
  const exam = {
    schema: EXAM_SCHEMA,
    examId: `workshop-transfer-regression-exam-${digest(basis).slice(0, 24)}`,
    examDigest: null,
    organ: { id: ORGAN_ID, learnedWeights: false, automaticRepair: false, outsideAuthorshipClaim: false },
    regressionBinding: binding,
    settledAudit: {
      schema: settledAudit.schema,
      status: settledAudit.status,
      observedAt: settledAudit.observedAt,
      sha256: digest(settledAuditBytes),
      semanticDigest: digest(settledAudit)
    },
    sourceLineage: lineage,
    expectedResultAuthorship: {
      criteriaId: Cell.CRITERIA_ID,
      versionedInPublicMirrorSource: true,
      authoredBeforeAnyRepairCandidate: binding.candidateRepair === null,
      independentFromRepairCandidate: binding.candidateRepair === null,
      repairCandidatePresent: false,
      outsideAuthorshipClaimed: false,
      cryptographicallyIndependentAuthorshipProven: false,
      humanAcceptedAsCanon: false,
      statement: 'The falsifiable relational criteria are hardcoded in a separate public cell before any repair candidate exists; Mirror does not claim outside authorship or CANON acceptance.'
    },
    result,
    state: result.state,
    evidenceDisposition: result.state === Cell.PASS_STATE
      ? 'CONTENT_DIGESTED_BOUNDED_FOUNDATION_EVIDENCE_CANDIDATE'
      : 'CONTENT_DIGESTED_HELD_OR_NEGATIVE_EVIDENCE_CANDIDATE',
    authority: {
      privateEvidenceTraceWrite: true,
      foundationEvidenceCandidate: true,
      outsideIndependenceCertification: false,
      trainingAdmission: false,
      repairSelection: false,
      modelChange: false,
      permissionGrant: false,
      runtimePromotion: false,
      canonChange: false,
      worldAction: false
    },
    boundary: 'This append-only exam binds one exact regression hand, its source/evidence deltas, a settled baseline, versioned Mirror-authored criteria, and current read-only relational canaries. It may distinguish source drift from bounded observed behavior. It does not certify outside independence, select or validate a repair, execute Workshop code, train, grant permission, promote, or become CANON.'
  };
  exam.examDigest = digest(Object.assign({}, exam, { examDigest: null }));
  return stable(exam);
}

function verifyExam(exam, runDir, options = {}) {
  if (!exam || exam.schema !== EXAM_SCHEMA || exam.examDigest !== digest(Object.assign({}, exam, { examDigest: null }))) throw new Error('Workshop transfer regression exam digest changed');
  if (!exam.organ || exam.organ.id !== ORGAN_ID || exam.organ.learnedWeights !== false || exam.organ.automaticRepair !== false || exam.organ.outsideAuthorshipClaim !== false) throw new Error('Workshop transfer regression exam organ boundary changed');
  Cell.verify(exam.result);
  if (!same(exam.result.regressionBinding, exam.regressionBinding) || exam.result.state !== exam.state) throw new Error('Workshop transfer regression exam result binding changed');
  if (!exam.expectedResultAuthorship || exam.expectedResultAuthorship.criteriaId !== Cell.CRITERIA_ID || exam.expectedResultAuthorship.outsideAuthorshipClaimed !== false || exam.expectedResultAuthorship.cryptographicallyIndependentAuthorshipProven !== false || exam.expectedResultAuthorship.humanAcceptedAsCanon !== false) throw new Error('Workshop transfer regression exam authorship boundary changed');
  const trueAuthority = new Set(['privateEvidenceTraceWrite', 'foundationEvidenceCandidate']);
  if (!exam.authority || Object.entries(exam.authority).some(([key, value]) => trueAuthority.has(key) ? value !== true : value !== false)) throw new Error('Workshop transfer regression exam gained authority');
  if (options.verifyCurrentLineage === true && !same(exam.sourceLineage, Cell.sourceLineage(options.root || ROOT))) throw new Error('Workshop transfer regression examiner source lineage changed');
  if (runDir) {
    const disk = JSON.parse(fs.readFileSync(path.join(runDir, 'exam.json'), 'utf8'));
    if (!same(disk, exam)) throw new Error('Workshop transfer regression exam file changed');
  }
  return true;
}

function storeExam(exam, stateDir = DEFAULT_STATE_DIR) {
  const resolved = path.resolve(stateDir);
  fs.mkdirSync(resolved, { recursive: true });
  const runDir = path.join(resolved, exam.examId);
  if (fs.existsSync(runDir)) {
    const existing = JSON.parse(fs.readFileSync(path.join(runDir, 'exam.json'), 'utf8'));
    verifyExam(existing, runDir);
    if (existing.examDigest !== exam.examDigest) throw new Error('Workshop transfer regression exam identity collision');
    return { exam: existing, runDir, reused: true };
  }
  const stageDir = path.join(resolved, `.stage-${exam.examId}-${process.pid}`);
  if (fs.existsSync(stageDir)) throw new Error(`Workshop transfer regression exam staging directory already exists: ${stageDir}`);
  fs.mkdirSync(stageDir, { recursive: true });
  fs.writeFileSync(path.join(stageDir, 'exam.json'), json(exam), { flag: 'wx' });
  verifyExam(exam, stageDir);
  const commit = ImmutableBatchStore.commitDirectory(stageDir, runDir);
  return { exam, runDir, reused: commit.reused };
}

function run(options = {}) {
  loadPolicy(options);
  const loaded = loadCurrentBinding(options);
  const binding = selectRegressionBinding(loaded);
  if (!binding) return { state: 'NO_ELIGIBLE_WORKSHOP_TRANSFER_REGRESSION_HAND', exam: null, written: false, reused: false };
  const workshopRoot = WorkshopRoot.resolve({ workshopRoot: options.workshopRoot, config: options.config, configRoot: options.root || ROOT });
  const observation = WorkshopRoot.inspect({ workshopRoot });
  if (!observation.available) return { state: 'WORKSHOP_ABSENT', reason: observation.reason, exam: null, written: false, reused: false };
  const auditPath = path.resolve(options.auditPath || DEFAULT_AUDIT_PATH);
  const auditSource = options.settledAudit
    ? { value: options.settledAudit, bytes: Buffer.from(json(options.settledAudit)), sha256: digest(Buffer.from(json(options.settledAudit))) }
    : loadJson(auditPath, 'settled Workshop audit');
  const result = Cell.examine({ workshopRoot, regressionBinding: binding, settledAudit: auditSource.value });
  const exam = buildExam(result, binding, auditSource.value, auditSource.bytes, options);
  const stored = storeExam(exam, options.stateDir || DEFAULT_STATE_DIR);
  return { state: stored.exam.state, exam: stored.exam, runDir: stored.runDir, written: !stored.reused, reused: stored.reused };
}

function loadMatchingExam(options = {}) {
  const workshopRoot = WorkshopRoot.resolve({ workshopRoot: options.workshopRoot, config: options.config, configRoot: options.root || ROOT });
  const observation = WorkshopRoot.inspect({ workshopRoot });
  if (!observation.available) return { state: 'WORKSHOP_ABSENT', reason: observation.reason, exam: null, currentSource: null };
  const currentSource = options.currentSource || Cell.inspectSource(workshopRoot);
  const stateDir = path.resolve(options.stateDir || DEFAULT_STATE_DIR);
  if (!fs.existsSync(stateDir)) return { state: 'NO_MATCHING_WORKSHOP_TRANSFER_EXAM', exam: null, currentSource };
  const auditPath = path.resolve(options.auditPath || DEFAULT_AUDIT_PATH);
  const auditSha256 = digest(fs.readFileSync(auditPath));
  const lineage = Cell.sourceLineage(options.root || ROOT);
  const matches = [];
  for (const entry of fs.readdirSync(stateDir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    if (!entry.isDirectory() || entry.name.startsWith('.stage-')) continue;
    const runDir = boundedChild(stateDir, entry.name);
    const examFile = path.join(runDir, 'exam.json');
    if (!fs.existsSync(examFile)) continue;
    const exam = JSON.parse(fs.readFileSync(examFile, 'utf8'));
    verifyExam(exam, runDir);
    if (exam.state === Cell.PASS_STATE && exam.result.source.stableDuringExam === true && exam.result.source.after.digest === currentSource.digest &&
        exam.settledAudit.sha256 === auditSha256 && same(exam.sourceLineage, lineage)) matches.push(exam);
  }
  if (!matches.length) return { state: 'NO_MATCHING_WORKSHOP_TRANSFER_EXAM', exam: null, currentSource };
  matches.sort((left, right) => left.examId.localeCompare(right.examId));
  return { state: 'MATCHING_BOUND_WORKSHOP_TRANSFER_EXAM', exam: matches[matches.length - 1], currentSource };
}

module.exports = {
  ORGAN_ID, EXAM_SCHEMA, ROOT, DEFAULT_STATE_DIR, DEFAULT_HAND_STATE_DIR, DEFAULT_FRONTIER_STATE_DIR, DEFAULT_AUDIT_PATH, TARGET_DIMENSION,
  stable, digest, loadPolicy, loadCurrentBinding, selectRegressionBinding, buildExam, verifyExam, storeExam, run, loadMatchingExam
};
