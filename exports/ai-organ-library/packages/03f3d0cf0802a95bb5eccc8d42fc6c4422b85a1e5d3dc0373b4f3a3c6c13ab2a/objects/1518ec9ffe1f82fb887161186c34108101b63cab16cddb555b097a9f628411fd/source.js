'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const LanguageModel = require('../learning/typed-trace-language-model');
const Observatory = require('./foundation-development-observatory-organ');
const Request = require('./foundation-development-observation-request-organ');
const ImmutableBatchStore = require('../kernel/immutable-batch-store');

const ORGAN_ID = 'axm.mirror.foundation-development-observation-executor-organ/v1';
const RECEIPT_SCHEMA = 'axm.mirror.foundation-development-observation-execution-receipt/v1';
const ROOT = path.resolve(__dirname, '..');
const DEFAULT_STATE_DIR = path.join(ROOT, 'state', 'foundation-development-observation-executions');

function stable(value) { return LanguageModel.stable(value); }
function digest(value) {
  const bytes = typeof value === 'string' || Buffer.isBuffer(value) ? value : JSON.stringify(stable(value));
  return crypto.createHash('sha256').update(bytes).digest('hex');
}
function json(value) { return JSON.stringify(stable(value), null, 2) + '\n'; }
function same(left, right) { return JSON.stringify(stable(left)) === JSON.stringify(stable(right)); }

function loadPolicy(options = {}) {
  const policy = Request.loadPolicy(options);
  if (policy.automaticFoundationDevelopmentObservation !== true) throw new Error('automatic foundation observation execution is not enabled');
  if (!String(policy.foundationDevelopmentObservationScope || '').includes('no-training-no-auto-repair')) throw new Error('automatic foundation observation scope is incomplete');
  return policy;
}

function requestOptions(options, evidence) {
  return Object.assign({}, options, {
    evidence,
    stateDir: path.resolve(options.requestStateDir || Request.DEFAULT_STATE_DIR),
    observatoryStateDir: path.resolve(options.observatoryStateDir || Observatory.DEFAULT_STATE_DIR)
  });
}

function observationOptions(options, evidence) {
  return Object.assign({}, options, {
    evidence,
    stateDir: path.resolve(options.observatoryStateDir || Observatory.DEFAULT_STATE_DIR)
  });
}

function summarizeDimensions(snapshot) {
  const directRegressionIds = snapshot.dimensions.filter(item => item.state === 'REGRESSION_REQUIRES_REVIEW').map(item => item.id);
  const activeRegressionIds = new Set(directRegressionIds.concat((snapshot.comparison.regressions || []).map(item => item.dimensionId)));
  return {
    observedPassing: snapshot.dimensions.filter(item => item.state === 'OBSERVED_PASS').length,
    openEvidenceGates: snapshot.dimensions.filter(item => item.state.startsWith('HOLD_')).length,
    directRegressions: directRegressionIds.length,
    longitudinalRegressions: snapshot.comparison.regressions.length,
    improvementsObserved: snapshot.comparison.improvements.length,
    activeRegressedDimensions: activeRegressionIds.size,
    historicalRegressionWitnesses: snapshot.comparison.regressions.reduce((sum, item) => sum + Number((item.witnessSelection || {}).eligiblePriorSnapshots || 1), 0),
    evidenceContinuityLosses: (snapshot.comparison.evidenceContinuityLosses || []).length,
    regressionRecoveries: (snapshot.comparison.recoveries || []).length,
    evidenceGateClosures: snapshot.comparison.improvements.length,
    singleIntelligenceScore: false,
    growthGrade: null
  };
}

function buildReceipt(request, observation) {
  Request.verifyRequest(request);
  Observatory.verifySnapshot(observation.snapshot, observation.runDir);
  const dimensions = summarizeDimensions(observation.snapshot);
  const basis = { organId: ORGAN_ID, requestDigest: request.requestDigest, snapshotDigest: observation.snapshot.snapshotDigest };
  const receipt = {
    schema: RECEIPT_SCHEMA,
    executionId: `foundation-observation-execution-${digest(basis).slice(0, 24)}`,
    receiptDigest: null,
    organ: { id: ORGAN_ID, learnedWeights: false },
    request: {
      requestId: request.requestId,
      requestDigest: request.requestDigest,
      subjectDigest: request.observation.subjectDigest,
      evidenceDigest: request.observation.evidenceDigest
    },
    observation: {
      snapshotId: observation.snapshot.snapshotId,
      snapshotDigest: observation.snapshot.snapshotDigest,
      snapshotState: observation.snapshot.state,
      snapshotReused: observation.reused,
      exactRequestFulfilled: true,
      dimensions
    },
    state: dimensions.activeRegressedDimensions
      ? 'OBSERVATION_RECORDED_WITH_REGRESSION_REQUIRES_REVIEW'
      : dimensions.evidenceContinuityLosses
        ? 'OBSERVATION_RECORDED_WITH_EVIDENCE_CONTINUITY_HOLD'
        : 'OBSERVATION_RECORDED_WITHOUT_REGRESSION',
    authority: {
      privateExecutionTraceWrite: true,
      foundationObservationExecution: true,
      compositeGrowthGrade: false,
      trainingAdmission: false,
      automaticRepair: false,
      modelChange: false,
      permissionGrant: false,
      runtimePromotion: false,
      canonChange: false,
      worldAction: false
    },
    boundary: 'This executor may fulfill an exact unseen observation request with the same once-collected evidence and preserve a private receipt. Separate dimension states are measurements, not a composite growth or intelligence grade. Regression creates review evidence only and grants no training, repair, model, permission, runtime, canon, or world authority.'
  };
  receipt.receiptDigest = digest(Object.assign({}, receipt, { receiptDigest: null }));
  return receipt;
}

function verifyReceipt(receipt, runDir) {
  if (!receipt || receipt.schema !== RECEIPT_SCHEMA || receipt.receiptDigest !== digest(Object.assign({}, receipt, { receiptDigest: null }))) throw new Error('foundation observation execution receipt digest changed');
  if (!receipt.organ || receipt.organ.id !== ORGAN_ID || receipt.organ.learnedWeights !== false) throw new Error('foundation observation executor boundary changed');
  const trueAuthority = new Set(['privateExecutionTraceWrite', 'foundationObservationExecution']);
  if (!receipt.authority || Object.entries(receipt.authority).some(([key, value]) => trueAuthority.has(key) ? value !== true : value !== false)) throw new Error('foundation observation execution authority changed');
  if (receipt.observation.dimensions.singleIntelligenceScore !== false || receipt.observation.dimensions.growthGrade !== null) throw new Error('foundation observation executor created a composite grade');
  if (!['OBSERVATION_RECORDED_WITHOUT_REGRESSION', 'OBSERVATION_RECORDED_WITH_REGRESSION_REQUIRES_REVIEW', 'OBSERVATION_RECORDED_WITH_EVIDENCE_CONTINUITY_HOLD'].includes(receipt.state)) throw new Error('foundation observation execution state changed');
  if (runDir) {
    const disk = JSON.parse(fs.readFileSync(path.join(runDir, 'receipt.json'), 'utf8'));
    if (!same(disk, receipt)) throw new Error('foundation observation execution receipt file changed');
  }
  return true;
}

function storeReceipt(receipt, stateDir) {
  const resolvedStateDir = path.resolve(stateDir || DEFAULT_STATE_DIR);
  fs.mkdirSync(resolvedStateDir, { recursive: true });
  const runDir = path.join(resolvedStateDir, receipt.executionId);
  if (fs.existsSync(runDir)) {
    const existing = JSON.parse(fs.readFileSync(path.join(runDir, 'receipt.json'), 'utf8'));
    verifyReceipt(existing, runDir);
    if (existing.receiptDigest !== receipt.receiptDigest) throw new Error('foundation observation execution identity collision');
    return { receipt: existing, runDir, reused: true };
  }
  const stageDir = path.join(resolvedStateDir, `.stage-${receipt.executionId}-${process.pid}`);
  if (fs.existsSync(stageDir)) throw new Error(`foundation observation execution staging directory already exists: ${stageDir}`);
  fs.mkdirSync(stageDir, { recursive: true });
  fs.writeFileSync(path.join(stageDir, 'receipt.json'), json(receipt), { flag: 'wx' });
  verifyReceipt(receipt, stageDir);
  const commit = ImmutableBatchStore.commitDirectory(stageDir, runDir);
  return { receipt, runDir, reused: commit.reused };
}

function run(options = {}) {
  loadPolicy(options);
  const evidence = options.evidence || Observatory.collectOperationalEvidence(options);
  const requestInput = requestOptions(options, evidence);
  const initialRequest = Request.inspect(requestInput);
  if (initialRequest.state === 'NO_NEW_OBSERVATION_REQUIRED') {
    return { state: 'NO_NEW_OBSERVATION_REQUIRED', request: initialRequest, snapshot: null, receipt: null, requestWritten: false, observationExecuted: false, receiptWritten: false };
  }

  const storedRequest = Request.run(requestInput);
  if (storedRequest.request.state === 'NO_NEW_OBSERVATION_REQUIRED') {
    return { state: 'NO_NEW_OBSERVATION_REQUIRED', request: storedRequest.request, snapshot: null, receipt: null, requestWritten: false, observationExecuted: false, receiptWritten: false };
  }
  const observation = Observatory.run(observationOptions(options, evidence));
  const fulfilled = Request.inspect(requestOptions(options, evidence));
  if (fulfilled.state !== 'NO_NEW_OBSERVATION_REQUIRED' || !fulfilled.prior.exactSnapshotIds.includes(observation.snapshot.snapshotId)) throw new Error('automatic foundation observation did not fulfill the exact request');
  const receipt = buildReceipt(storedRequest.request, observation);
  const storedReceipt = storeReceipt(receipt, options.executorStateDir || DEFAULT_STATE_DIR);
  return {
    state: storedReceipt.receipt.state,
    request: storedRequest.request,
    snapshot: observation.snapshot,
    receipt: storedReceipt.receipt,
    requestWritten: storedRequest.written,
    requestReused: storedRequest.reused,
    observationExecuted: true,
    snapshotReused: observation.reused,
    receiptWritten: true,
    receiptReused: storedReceipt.reused,
    runDir: storedReceipt.runDir
  };
}

module.exports = { ORGAN_ID, RECEIPT_SCHEMA, DEFAULT_STATE_DIR, loadPolicy, summarizeDimensions, buildReceipt, verifyReceipt, storeReceipt, run };
