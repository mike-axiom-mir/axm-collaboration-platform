'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const LanguageModel = require('../learning/typed-trace-language-model');
const Observatory = require('./foundation-development-observatory-organ');
const Executor = require('./foundation-development-observation-executor-organ');
const FrontierRouter = require('./foundation-development-frontier-router-organ');
const HandPlanner = require('./foundation-development-hand-planner-organ');
const WorkshopExam = require('./workshop-transfer-regression-exam-organ');
const ImmutableBatchStore = require('../kernel/immutable-batch-store');

const ORGAN_ID = 'axm.mirror.foundation-development-workshop-revalidation-coordinator-organ/v1';
const RECEIPT_SCHEMA = 'axm.mirror.foundation-development-workshop-revalidation-coordination-receipt/v1';
const ROOT = path.resolve(__dirname, '..');
const DEFAULT_STATE_DIR = path.join(ROOT, 'state', 'foundation-development-workshop-revalidation-coordination-runs');
const DEFAULT_OBSERVATORY_STATE_DIR = Observatory.DEFAULT_STATE_DIR;
const DEFAULT_EXECUTOR_STATE_DIR = Executor.DEFAULT_STATE_DIR;
const TARGET_DIMENSION = WorkshopExam.TARGET_DIMENSION;

function stable(value) { return LanguageModel.stable(value); }
function digest(value) {
  const bytes = typeof value === 'string' || Buffer.isBuffer(value) ? value : JSON.stringify(stable(value));
  return crypto.createHash('sha256').update(bytes).digest('hex');
}
function json(value) { return JSON.stringify(stable(value), null, 2) + '\n'; }
function same(left, right) { return JSON.stringify(stable(left)) === JSON.stringify(stable(right)); }

function boundedChild(parent, child) {
  const resolvedParent = path.resolve(parent);
  const target = path.resolve(resolvedParent, child);
  if (path.dirname(target) !== resolvedParent) throw new Error(`foundation Workshop revalidation coordination path escapes its parent: ${child}`);
  return target;
}

function loadPolicy(options = {}) {
  const policyPath = path.resolve(options.policyPath || path.join(ROOT, 'training', 'TRAINING_POLICY.json'));
  const policy = options.policy || JSON.parse(fs.readFileSync(policyPath, 'utf8'));
  if (!policy || policy.schema !== 'axm.mirror.training-policy/v1') throw new Error('foundation Workshop revalidation coordination requires the Mirror training policy');
  if (policy.automaticFoundationWorkshopRevalidationCoordination !== true) throw new Error('automatic foundation Workshop revalidation coordination is not enabled');
  const scope = String(policy.foundationWorkshopRevalidationCoordinationScope || '');
  if (!scope.includes('one-exact-regression-hand-one-read-only-exam-one-reobservation-no-loop')) throw new Error('foundation Workshop revalidation coordination scope is incomplete');
  if (policy.automaticRuntimePromotion !== false || policy.automaticCanonPromotion !== false || policy.automaticAuthorityGrowth !== false) throw new Error('foundation Workshop revalidation coordination refuses runtime, canon, or authority growth');
  return policy;
}

function verifiedSource(initialResult, frontierBatch, handBatch) {
  if (!initialResult || !initialResult.snapshot || !initialResult.receipt) throw new Error('foundation Workshop revalidation coordination requires one executed observation result');
  const snapshot = initialResult.snapshot;
  const receipt = initialResult.receipt;
  Observatory.verifySnapshot(snapshot);
  Executor.verifyReceipt(receipt);
  if (receipt.observation.snapshotId !== snapshot.snapshotId || receipt.observation.snapshotDigest !== snapshot.snapshotDigest) throw new Error('foundation Workshop revalidation coordination receipt no longer binds its snapshot');
  FrontierRouter.verifyBatch(frontierBatch, { snapshot, receipt });
  HandPlanner.verifyBatch(handBatch, frontierBatch);
  if (frontierBatch.source.snapshotId !== snapshot.snapshotId || handBatch.source.frontierBatchId !== frontierBatch.batchId) throw new Error('foundation Workshop revalidation coordination source chain changed');
  return { snapshot, receipt, frontierBatch, handBatch };
}

function sourceRecord(source) {
  return stable({
    snapshotId: source.snapshot.snapshotId,
    snapshotDigest: source.snapshot.snapshotDigest,
    executionId: source.receipt.executionId,
    executionReceiptDigest: source.receipt.receiptDigest,
    frontierBatchId: source.frontierBatch.batchId,
    frontierBatchDigest: source.frontierBatch.batchDigest,
    handBatchId: source.handBatch.batchId,
    handBatchDigest: source.handBatch.batchDigest
  });
}

function coordinationId(source) {
  return `foundation-workshop-revalidation-coordination-${digest({ organId: ORGAN_ID, source: sourceRecord(source) }).slice(0, 24)}`;
}

function exactExamRecord(examOutcome, binding) {
  if (!examOutcome || typeof examOutcome.state !== 'string') throw new Error('foundation Workshop revalidation coordination exam outcome is missing');
  if (!examOutcome.exam) {
    return stable({
      attempted: true,
      state: examOutcome.state,
      examId: null,
      examDigest: null,
      resultDigest: null,
      written: examOutcome.written === true,
      reused: examOutcome.reused === true
    });
  }
  WorkshopExam.verifyExam(examOutcome.exam, examOutcome.runDir || null);
  if (!same(examOutcome.exam.regressionBinding, binding)) throw new Error('foundation Workshop revalidation coordination exam no longer binds the exact regression hand');
  return stable({
    attempted: true,
    state: examOutcome.exam.state,
    examId: examOutcome.exam.examId,
    examDigest: examOutcome.exam.examDigest,
    resultDigest: examOutcome.exam.result.resultDigest,
    written: examOutcome.written === true,
    reused: examOutcome.reused === true
  });
}

function verifyReobservation(reobservation, initialSource, exam) {
  if (!reobservation || !reobservation.snapshot || !reobservation.receipt) throw new Error('foundation Workshop revalidation coordination requires one bound re-observation result after a passing exam');
  Observatory.verifySnapshot(reobservation.snapshot);
  Executor.verifyReceipt(reobservation.receipt);
  if (reobservation.receipt.observation.snapshotId !== reobservation.snapshot.snapshotId || reobservation.receipt.observation.snapshotDigest !== reobservation.snapshot.snapshotDigest) throw new Error('foundation Workshop revalidation coordination re-observation receipt changed');
  if (reobservation.snapshot.subject.digest !== initialSource.snapshot.subject.digest) throw new Error('foundation Workshop revalidation coordination source changed during the bounded loop');
  const workshop = ((reobservation.snapshot.evidence || {}).workshop || {}).revalidation || {};
  if (workshop.examId !== exam.examId || workshop.examDigest !== exam.examDigest || workshop.resultDigest !== exam.result.resultDigest || workshop.examState !== 'PASS_BOUND_WORKSHOP_TRANSFER_REVALIDATION') {
    throw new Error('foundation Workshop revalidation coordination re-observation lacks the exact passing exam');
  }
  const dimension = (reobservation.snapshot.dimensions || []).find(item => item.id === TARGET_DIMENSION);
  if (!dimension || dimension.state !== 'OBSERVED_PASS') throw new Error('foundation Workshop revalidation coordination passing exam did not produce an observed Workshop pass');
  return true;
}

function reobservationRecord(reobservation) {
  return stable({
    attempted: true,
    state: reobservation.state,
    requestId: reobservation.request.requestId,
    requestDigest: reobservation.request.requestDigest,
    snapshotId: reobservation.snapshot.snapshotId,
    snapshotDigest: reobservation.snapshot.snapshotDigest,
    executionId: reobservation.receipt.executionId,
    executionReceiptDigest: reobservation.receipt.receiptDigest,
    activeRegressedDimensions: reobservation.receipt.observation.dimensions.activeRegressedDimensions,
    openEvidenceGates: reobservation.receipt.observation.dimensions.openEvidenceGates
  });
}

function buildReceipt(source, binding, examRecord, reobservation) {
  const after = reobservation ? reobservationRecord(reobservation) : null;
  const state = !binding
    ? 'NO_ELIGIBLE_WORKSHOP_TRANSFER_REGRESSION_HAND'
    : !examRecord || examRecord.state !== 'PASS_BOUND_WORKSHOP_TRANSFER_REVALIDATION'
      ? 'WORKSHOP_REVALIDATION_HELD_NO_REOBSERVATION'
      : after && after.activeRegressedDimensions === 0
        ? 'WORKSHOP_REVALIDATED_AND_REOBSERVED_STABLE'
        : 'WORKSHOP_REVALIDATED_AND_REOBSERVED_WITH_REMAINING_REGRESSION';
  const receipt = {
    schema: RECEIPT_SCHEMA,
    coordinationId: coordinationId(source),
    receiptDigest: null,
    organ: { id: ORGAN_ID, learnedWeights: false, maximumExamAttempts: 1, maximumReobservations: 1 },
    source: sourceRecord(source),
    regressionBindingDigest: binding ? digest(binding) : null,
    exam: examRecord || null,
    reobservation: after,
    state,
    summary: {
      eligibleRegressionHands: binding ? 1 : 0,
      examAttempts: examRecord ? 1 : 0,
      reobservations: after ? 1 : 0,
      repairsSelected: 0,
      trainingAdmissions: 0,
      permissionGrants: 0,
      runtimePromotions: 0,
      canonChanges: 0,
      worldActions: 0
    },
    authority: {
      privateCoordinationTraceWrite: true,
      exactBoundWorkshopExamExecution: binding !== null,
      oneFoundationReobservation: after !== null,
      repairSelection: false,
      implementationBuild: false,
      modelChange: false,
      trainingAdmission: false,
      permissionGrant: false,
      runtimePromotion: false,
      canonChange: false,
      worldAction: false
    },
    boundary: 'This coordinator may pass one exact current Workshop regression hand to the existing read-only examiner and, only after an exact passing exam, execute one Foundation re-observation. It cannot loop, select or build a repair, change source or a model, train, grant permission, promote runtime or canon, or act in the world.'
  };
  receipt.receiptDigest = digest(Object.assign({}, receipt, { receiptDigest: null }));
  return stable(receipt);
}

function verifyReceipt(receipt, source, runDir) {
  if (!receipt || receipt.schema !== RECEIPT_SCHEMA || receipt.receiptDigest !== digest(Object.assign({}, receipt, { receiptDigest: null }))) throw new Error('foundation Workshop revalidation coordination receipt digest changed');
  if (!receipt.organ || receipt.organ.id !== ORGAN_ID || receipt.organ.learnedWeights !== false || receipt.organ.maximumExamAttempts !== 1 || receipt.organ.maximumReobservations !== 1) throw new Error('foundation Workshop revalidation coordination organ boundary changed');
  if (source && !same(receipt.source, sourceRecord(source))) throw new Error('foundation Workshop revalidation coordination receipt source changed');
  if (receipt.summary.examAttempts > 1 || receipt.summary.reobservations > 1 || receipt.summary.reobservations > receipt.summary.examAttempts) throw new Error('foundation Workshop revalidation coordination loop bound changed');
  if (receipt.summary.repairsSelected !== 0 || receipt.summary.trainingAdmissions !== 0 || receipt.summary.permissionGrants !== 0 || receipt.summary.runtimePromotions !== 0 || receipt.summary.canonChanges !== 0 || receipt.summary.worldActions !== 0) throw new Error('foundation Workshop revalidation coordination claim ceiling changed');
  const allowedTrue = new Set(['privateCoordinationTraceWrite', 'exactBoundWorkshopExamExecution', 'oneFoundationReobservation']);
  if (!receipt.authority || Object.entries(receipt.authority).some(([key, value]) => allowedTrue.has(key) ? typeof value !== 'boolean' : value !== false)) throw new Error('foundation Workshop revalidation coordination gained authority');
  if (receipt.authority.privateCoordinationTraceWrite !== true || receipt.authority.exactBoundWorkshopExamExecution !== (receipt.summary.examAttempts === 1) || receipt.authority.oneFoundationReobservation !== (receipt.summary.reobservations === 1)) throw new Error('foundation Workshop revalidation coordination execution authority changed');
  if (runDir) {
    const disk = JSON.parse(fs.readFileSync(path.join(runDir, 'receipt.json'), 'utf8'));
    if (!same(disk, receipt)) throw new Error('foundation Workshop revalidation coordination receipt file changed');
  }
  return true;
}

function storeReceipt(receipt, source, stateDir = DEFAULT_STATE_DIR) {
  const resolved = path.resolve(stateDir);
  fs.mkdirSync(resolved, { recursive: true });
  const runDir = path.join(resolved, receipt.coordinationId);
  if (fs.existsSync(runDir)) {
    const existing = JSON.parse(fs.readFileSync(path.join(runDir, 'receipt.json'), 'utf8'));
    verifyReceipt(existing, source, runDir);
    if (existing.receiptDigest !== receipt.receiptDigest) throw new Error('foundation Workshop revalidation coordination identity collision');
    return { receipt: existing, runDir, reused: true };
  }
  const stageDir = path.join(resolved, `.stage-${receipt.coordinationId}-${process.pid}`);
  if (fs.existsSync(stageDir)) throw new Error(`foundation Workshop revalidation coordination staging directory already exists: ${stageDir}`);
  fs.mkdirSync(stageDir, { recursive: true });
  fs.writeFileSync(path.join(stageDir, 'receipt.json'), json(receipt), { flag: 'wx' });
  verifyReceipt(receipt, source, stageDir);
  const commit = ImmutableBatchStore.commitDirectory(stageDir, runDir);
  return { receipt, runDir, reused: commit.reused };
}

function loadReobservation(receipt, options = {}) {
  if (!receipt.reobservation) return null;
  const snapshotDir = boundedChild(path.resolve(options.observatoryStateDir || DEFAULT_OBSERVATORY_STATE_DIR), receipt.reobservation.snapshotId);
  const executionDir = boundedChild(path.resolve(options.executorStateDir || DEFAULT_EXECUTOR_STATE_DIR), receipt.reobservation.executionId);
  const snapshot = JSON.parse(fs.readFileSync(path.join(snapshotDir, 'snapshot.json'), 'utf8'));
  const execution = JSON.parse(fs.readFileSync(path.join(executionDir, 'receipt.json'), 'utf8'));
  Observatory.verifySnapshot(snapshot, snapshotDir);
  Executor.verifyReceipt(execution, executionDir);
  return {
    state: receipt.reobservation.state,
    request: { requestId: receipt.reobservation.requestId, requestDigest: receipt.reobservation.requestDigest },
    snapshot,
    receipt: execution,
    observationExecuted: false,
    receiptWritten: false
  };
}

function run(options = {}) {
  loadPolicy(options);
  const source = verifiedSource(options.initialResult, options.frontierBatch, options.handBatch);
  const id = coordinationId(source);
  const stateDir = path.resolve(options.stateDir || DEFAULT_STATE_DIR);
  const existingDir = boundedChild(stateDir, id);
  if (fs.existsSync(existingDir)) {
    const receipt = JSON.parse(fs.readFileSync(path.join(existingDir, 'receipt.json'), 'utf8'));
    verifyReceipt(receipt, source, existingDir);
    const reobservation = loadReobservation(receipt, options);
    return { state: receipt.state, receipt, runDir: existingDir, reused: true, written: false, examOutcome: null, reobservation, effectiveResult: reobservation || options.initialResult };
  }

  const loaded = { frontierBatch: source.frontierBatch, handBatch: source.handBatch, source: { snapshot: source.snapshot, receipt: source.receipt } };
  const binding = WorkshopExam.selectRegressionBinding(loaded);
  if (!binding) {
    const receipt = buildReceipt(source, null, null, null);
    const stored = storeReceipt(receipt, source, stateDir);
    return { state: stored.receipt.state, receipt: stored.receipt, runDir: stored.runDir, reused: stored.reused, written: !stored.reused, examOutcome: null, reobservation: null, effectiveResult: options.initialResult };
  }

  const examOptions = Object.assign({}, options.examOptions || {}, {
    frontierBatch: source.frontierBatch,
    handBatch: source.handBatch,
    frontierSource: { snapshot: source.snapshot, receipt: source.receipt }
  });
  if (options.policy) examOptions.policy = options.policy;
  const examOutcome = options.examOutcome || WorkshopExam.run(examOptions);
  const examRecord = exactExamRecord(examOutcome, binding);
  let reobservation = null;
  if (examOutcome.exam && examOutcome.exam.state === 'PASS_BOUND_WORKSHOP_TRANSFER_REVALIDATION') {
    reobservation = options.reobservationResult || Executor.run(options.reobservationOptions || {});
    verifyReobservation(reobservation, source, examOutcome.exam);
  }
  const receipt = buildReceipt(source, binding, examRecord, reobservation);
  const stored = storeReceipt(receipt, source, stateDir);
  return {
    state: stored.receipt.state,
    receipt: stored.receipt,
    runDir: stored.runDir,
    reused: stored.reused,
    written: !stored.reused,
    examOutcome,
    reobservation,
    effectiveResult: reobservation || options.initialResult
  };
}

module.exports = {
  ORGAN_ID, RECEIPT_SCHEMA, ROOT, DEFAULT_STATE_DIR, TARGET_DIMENSION,
  stable, digest, loadPolicy, verifiedSource, sourceRecord, coordinationId, exactExamRecord, verifyReobservation,
  reobservationRecord, buildReceipt, verifyReceipt, storeReceipt, loadReobservation, run
};
