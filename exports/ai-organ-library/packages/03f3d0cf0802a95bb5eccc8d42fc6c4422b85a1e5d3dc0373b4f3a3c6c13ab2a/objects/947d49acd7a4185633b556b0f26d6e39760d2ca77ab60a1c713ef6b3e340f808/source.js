'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const LanguageModel = require('../learning/typed-trace-language-model');
const Observatory = require('./foundation-development-observatory-organ');
const Executor = require('./foundation-development-observation-executor-organ');
const ImmutableBatchStore = require('../kernel/immutable-batch-store');

const ORGAN_ID = 'axm.mirror.foundation-development-frontier-router-organ/v1';
const REQUEST_SCHEMA = 'axm.mirror.foundation-development-frontier-request/v1';
const BATCH_SCHEMA = 'axm.mirror.foundation-development-frontier-batch/v1';
const ROOT = path.resolve(__dirname, '..');
const DEFAULT_STATE_DIR = path.join(ROOT, 'state', 'foundation-development-frontier-runs');
const DEFAULT_OBSERVATORY_STATE_DIR = Observatory.DEFAULT_STATE_DIR;
const DEFAULT_EXECUTION_STATE_DIR = Executor.DEFAULT_STATE_DIR;

function stable(value) { return LanguageModel.stable(value); }
function digest(value) {
  const encoded = typeof value === 'string' || Buffer.isBuffer(value) ? value : JSON.stringify(stable(value));
  const bytes = encoded === undefined ? 'undefined' : encoded;
  return crypto.createHash('sha256').update(bytes).digest('hex');
}
function json(value) { return JSON.stringify(stable(value), null, 2) + '\n'; }
function same(left, right) { return JSON.stringify(stable(left)) === JSON.stringify(stable(right)); }
function boundedChild(parent, child) {
  const resolvedParent = path.resolve(parent);
  const resolved = path.resolve(resolvedParent, child);
  if (path.dirname(resolved) !== resolvedParent) throw new Error(`foundation frontier path escapes its parent: ${child}`);
  return resolved;
}

function loadPolicy(options = {}) {
  const policyPath = path.resolve(options.policyPath || path.join(ROOT, 'training', 'TRAINING_POLICY.json'));
  const policy = options.policy || JSON.parse(fs.readFileSync(policyPath, 'utf8'));
  if (!policy || policy.schema !== 'axm.mirror.training-policy/v1') throw new Error('foundation frontier routing requires the Mirror training policy');
  if (policy.automaticFoundationDevelopmentFrontierRouting !== true) throw new Error('automatic foundation frontier routing is not enabled');
  if (policy.automaticRuntimePromotion !== false || policy.automaticCanonPromotion !== false || policy.automaticAuthorityGrowth !== false) throw new Error('foundation frontier routing refuses runtime, canon, or authority growth');
  if (!String(policy.foundationDevelopmentFrontierRoutingScope || '').includes('no-priority-selection-no-evidence-fabrication-no-implementation')) throw new Error('foundation frontier routing scope is incomplete');
  return policy;
}

function loadCurrentSource(options = {}) {
  if (options.snapshot || options.receipt) {
    if (!options.snapshot || !options.receipt) throw new Error('foundation frontier routing requires snapshot and receipt together');
    Observatory.verifySnapshot(options.snapshot);
    Executor.verifyReceipt(options.receipt);
    return { snapshot: options.snapshot, receipt: options.receipt };
  }
  const status = JSON.parse(fs.readFileSync(path.resolve(options.statusPath || path.join(ROOT, 'STATUS.json')), 'utf8'));
  const evidence = status.foundationDevelopmentObservationExecutorEvidence || {};
  const snapshotId = evidence.snapshotId;
  const executionId = evidence.currentExecutionId;
  if (!/^foundation-development-[a-f0-9]{24}$/.test(String(snapshotId || '')) || !/^foundation-observation-execution-[a-f0-9]{24}$/.test(String(executionId || ''))) throw new Error('foundation frontier routing current source ids are missing');
  const observatoryStateDir = path.resolve(options.observatoryStateDir || DEFAULT_OBSERVATORY_STATE_DIR);
  const executionStateDir = path.resolve(options.executionStateDir || DEFAULT_EXECUTION_STATE_DIR);
  const snapshotDir = boundedChild(observatoryStateDir, snapshotId);
  const executionDir = boundedChild(executionStateDir, executionId);
  const snapshot = JSON.parse(fs.readFileSync(path.join(snapshotDir, 'snapshot.json'), 'utf8'));
  const receipt = JSON.parse(fs.readFileSync(path.join(executionDir, 'receipt.json'), 'utf8'));
  Observatory.verifySnapshot(snapshot, snapshotDir);
  Executor.verifyReceipt(receipt, executionDir);
  return { snapshot, receipt };
}

function verifySource(source) {
  const { snapshot, receipt } = source;
  if (receipt.observation.snapshotId !== snapshot.snapshotId || receipt.observation.snapshotDigest !== snapshot.snapshotDigest) throw new Error('foundation frontier execution receipt does not bind snapshot');
  if (receipt.request.subjectDigest !== snapshot.subject.digest) throw new Error('foundation frontier request subject does not bind snapshot');
  return true;
}

function changedFilePaths(current, prior) {
  const left = new Map(((current.subject || {}).files || []).map(item => [item.path, item.sha256]));
  const right = new Map(((prior.subject || {}).files || []).map(item => [item.path, item.sha256]));
  return Array.from(new Set([...left.keys(), ...right.keys()])).filter(file => left.get(file) !== right.get(file)).sort();
}

function changedEvidenceSections(current, prior) {
  const left = current.evidence || {};
  const right = prior.evidence || {};
  return Array.from(new Set([...Object.keys(left), ...Object.keys(right)])).filter(key => digest(left[key]) !== digest(right[key])).sort();
}

function buildRequest(dimension, snapshot, receipt, priorSnapshots) {
  const longitudinalRows = (snapshot.comparison.regressions || []).filter(item => item.dimensionId === dimension.id);
  const continuityRows = (snapshot.comparison.evidenceContinuityLosses || []).filter(item => item.dimensionId === dimension.id);
  const classification = dimension.state === 'REGRESSION_REQUIRES_REVIEW' || longitudinalRows.length
    ? 'REGRESSION_INVESTIGATION_REQUEST'
    : 'INDEPENDENT_EVIDENCE_ACQUISITION_REQUEST';
  const comparisonRows = classification === 'REGRESSION_INVESTIGATION_REQUEST' ? longitudinalRows : continuityRows;
  const priorIds = comparisonRows.map(item => item.priorSnapshotId).sort();
  const prior = (priorSnapshots || []).filter(item => priorIds.includes(item.snapshotId));
  const sourceFileDeltas = Array.from(new Set(prior.flatMap(item => changedFilePaths(snapshot, item)))).sort();
  const evidenceSectionDeltas = Array.from(new Set(prior.flatMap(item => changedEvidenceSections(snapshot, item)))).sort();
  const basis = { snapshotDigest: snapshot.snapshotDigest, dimensionId: dimension.id, observedState: dimension.state, classification };
  const request = {
    schema: REQUEST_SCHEMA,
    requestId: `foundation-frontier-request-${digest(basis).slice(0, 24)}`,
    requestDigest: null,
    dimensionId: dimension.id,
    observedState: dimension.state,
    classification,
    observation: {
      statement: dimension.statement,
      evidenceRefs: (dimension.evidenceRefs || []).slice().sort(),
      snapshotId: snapshot.snapshotId,
      snapshotDigest: snapshot.snapshotDigest,
      executionId: receipt.executionId,
      executionReceiptDigest: receipt.receiptDigest
    },
    deltas: {
      comparedPriorSnapshotIds: priorIds,
      sourceFilePathsChanged: sourceFileDeltas,
      evidenceSectionsChanged: evidenceSectionDeltas
    },
    developmentNeed: dimension.developmentNeed || null,
    handPlanningEligible: !!dimension.developmentNeed,
    requestedOutcome: classification === 'REGRESSION_INVESTIGATION_REQUEST'
      ? {
          kind: 'INDEPENDENT_CAUSE_AND_REPAIR_EXAM',
          statement: `Investigate the bound source and evidence deltas for ${dimension.id}, then author an independent falsifiable repair exam before any repair is selected or implemented.`,
          acceptanceBoundary: 'A cause hypothesis and repair candidate remain proposals until independent evidence passes without weakening existing dimensions or authority boundaries.'
        }
      : {
          kind: 'INDEPENDENT_EVIDENCE_ACQUISITION',
          statement: `Acquire permissioned source-lineaged evidence capable of falsifying or supporting ${dimension.id} without lowering its current gate.`,
          acceptanceBoundary: 'Missing evidence remains a hold. The router cannot manufacture outside authorship, real experience, permission, or a passing result.'
        },
    unresolved: ['evidence-source', 'method', 'candidate', 'implementation', 'permissions', 'acceptance-result'],
    trainingEligible: false,
    prioritySelected: false,
    repairSelected: false,
    implementationSelected: false,
    authority: {
      evidenceFabrication: false,
      trainingAdmission: false,
      repairSelection: false,
      implementationBuild: false,
      modelChange: false,
      permissionGrant: false,
      runtimePromotion: false,
      canonChange: false,
      worldAction: false
    }
  };
  request.requestDigest = digest(Object.assign({}, request, { requestDigest: null }));
  return request;
}

function buildBatch(snapshot, receipt, priorSnapshots = []) {
  verifySource({ snapshot, receipt });
  const eligible = snapshot.dimensions.filter(item => item.state !== 'OBSERVED_PASS');
  const requests = eligible.map(item => buildRequest(item, snapshot, receipt, priorSnapshots)).sort((a, b) => a.dimensionId.localeCompare(b.dimensionId));
  const basis = { organId: ORGAN_ID, snapshotDigest: snapshot.snapshotDigest, executionReceiptDigest: receipt.receiptDigest, requestDigests: requests.map(item => item.requestDigest) };
  const batch = {
    schema: BATCH_SCHEMA,
    batchId: `foundation-development-frontier-${digest(basis).slice(0, 24)}`,
    batchDigest: null,
    organ: { id: ORGAN_ID, learnedWeights: false },
    source: { snapshotId: snapshot.snapshotId, snapshotDigest: snapshot.snapshotDigest, executionId: receipt.executionId, executionReceiptDigest: receipt.receiptDigest },
    requests,
    summary: {
      nonPassingDimensions: eligible.length,
      evidenceAcquisitionRequests: requests.filter(item => item.classification === 'INDEPENDENT_EVIDENCE_ACQUISITION_REQUEST').length,
      regressionInvestigationRequests: requests.filter(item => item.classification === 'REGRESSION_INVESTIGATION_REQUEST').length,
      prioritySelections: 0,
      evidenceFabrications: 0,
      repairsSelected: 0,
      implementationsBuilt: 0,
      trainingAdmissions: 0,
      modelChanges: 0,
      permissionGrants: 0,
      runtimePromotions: 0,
      canonChanges: 0,
      worldActions: 0
    },
    state: requests.length ? 'DEVELOPMENT_FRONTIER_REQUESTS_PROPOSED' : 'NO_DEVELOPMENT_FRONTIER_REQUESTS',
    authority: {
      privateProposalTraceWrite: true,
      prioritySelection: false,
      evidenceFabrication: false,
      trainingAdmission: false,
      repairSelection: false,
      implementationBuild: false,
      modelChange: false,
      permissionGrant: false,
      runtimePromotion: false,
      canonChange: false,
      worldAction: false
    },
    boundary: 'This router turns every measured non-passing dimension into a typed proposal-only development request. It does not select a priority, fabricate evidence, choose or build a repair, train, change a model, grant permission, promote, or act.'
  };
  batch.batchDigest = digest(Object.assign({}, batch, { batchDigest: null }));
  return batch;
}

function verifyBatch(batch, source, runDir) {
  if (!batch || batch.schema !== BATCH_SCHEMA || batch.batchDigest !== digest(Object.assign({}, batch, { batchDigest: null }))) throw new Error('foundation development frontier batch digest changed');
  if (!batch.organ || batch.organ.id !== ORGAN_ID || batch.organ.learnedWeights !== false) throw new Error('foundation development frontier organ boundary changed');
  if (source) {
    verifySource(source);
    if (batch.source.snapshotDigest !== source.snapshot.snapshotDigest || batch.source.executionReceiptDigest !== source.receipt.receiptDigest) throw new Error('foundation development frontier source binding changed');
  }
  const trueAuthority = new Set(['privateProposalTraceWrite']);
  if (!batch.authority || Object.entries(batch.authority).some(([key, value]) => trueAuthority.has(key) ? value !== true : value !== false)) throw new Error('foundation development frontier authority changed');
  for (const request of batch.requests || []) {
    if (request.schema !== REQUEST_SCHEMA || request.requestDigest !== digest(Object.assign({}, request, { requestDigest: null }))) throw new Error('foundation development frontier request digest changed');
    if (request.prioritySelected !== false || request.repairSelected !== false || request.implementationSelected !== false || request.trainingEligible !== false) throw new Error('foundation development frontier request selected authority');
    if (Object.values(request.authority || {}).some(value => value !== false)) throw new Error('foundation development frontier request authority changed');
  }
  if (batch.summary.nonPassingDimensions !== batch.requests.length || batch.summary.prioritySelections !== 0 || batch.summary.repairsSelected !== 0 || batch.summary.implementationsBuilt !== 0) throw new Error('foundation development frontier summary changed');
  if (runDir) {
    const disk = JSON.parse(fs.readFileSync(path.join(runDir, 'batch.json'), 'utf8'));
    if (!same(disk, batch)) throw new Error('foundation development frontier batch file changed');
  }
  return true;
}

function run(options = {}) {
  loadPolicy(options);
  const source = loadCurrentSource(options);
  verifySource(source);
  const observatoryStateDir = path.resolve(options.observatoryStateDir || DEFAULT_OBSERVATORY_STATE_DIR);
  const priorSnapshots = options.priorSnapshots || Observatory.loadPriorSnapshots(observatoryStateDir);
  const batch = buildBatch(source.snapshot, source.receipt, priorSnapshots);
  const stateDir = path.resolve(options.stateDir || DEFAULT_STATE_DIR);
  fs.mkdirSync(stateDir, { recursive: true });
  const runDir = path.join(stateDir, batch.batchId);
  if (fs.existsSync(runDir)) {
    const existing = JSON.parse(fs.readFileSync(path.join(runDir, 'batch.json'), 'utf8'));
    verifyBatch(existing, source, runDir);
    if (existing.batchDigest !== batch.batchDigest) throw new Error('foundation development frontier identity collision');
    return { batch: existing, runDir, reused: true };
  }
  const stageDir = path.join(stateDir, `.stage-${batch.batchId}-${process.pid}`);
  if (fs.existsSync(stageDir)) throw new Error(`foundation development frontier staging directory already exists: ${stageDir}`);
  fs.mkdirSync(stageDir, { recursive: true });
  fs.writeFileSync(path.join(stageDir, 'batch.json'), json(batch), { flag: 'wx' });
  verifyBatch(batch, source, stageDir);
  const commit = ImmutableBatchStore.commitDirectory(stageDir, runDir);
  return { batch, runDir, reused: commit.reused };
}

module.exports = {
  ORGAN_ID, REQUEST_SCHEMA, BATCH_SCHEMA, DEFAULT_STATE_DIR,
  loadPolicy, loadCurrentSource, verifySource, changedFilePaths, changedEvidenceSections,
  buildRequest, buildBatch, verifyBatch, run
};
