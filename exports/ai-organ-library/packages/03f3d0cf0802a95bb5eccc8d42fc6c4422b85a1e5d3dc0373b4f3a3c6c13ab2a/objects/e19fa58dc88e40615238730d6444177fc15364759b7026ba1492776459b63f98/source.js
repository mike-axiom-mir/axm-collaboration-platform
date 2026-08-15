'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const LanguageModel = require('../learning/typed-trace-language-model');
const Observatory = require('./foundation-development-observatory-organ');
const ImmutableBatchStore = require('../kernel/immutable-batch-store');

const ORGAN_ID = 'axm.mirror.foundation-development-observation-request-organ/v1';
const REQUEST_SCHEMA = 'axm.mirror.foundation-development-observation-request/v1';
const ROOT = path.resolve(__dirname, '..');
const DEFAULT_STATE_DIR = path.join(ROOT, 'state', 'foundation-development-observation-requests');
const DEFAULT_POLICY_PATH = path.join(ROOT, 'training', 'TRAINING_POLICY.json');

function stable(value) { return LanguageModel.stable(value); }
function digest(value) {
  const bytes = typeof value === 'string' || Buffer.isBuffer(value) ? value : JSON.stringify(stable(value));
  return crypto.createHash('sha256').update(bytes).digest('hex');
}
function json(value) { return JSON.stringify(stable(value), null, 2) + '\n'; }
function same(left, right) { return JSON.stringify(stable(left)) === JSON.stringify(stable(right)); }

function loadPolicy(options = {}) {
  const policy = options.policy || JSON.parse(fs.readFileSync(path.resolve(options.policyPath || DEFAULT_POLICY_PATH), 'utf8'));
  if (!policy || policy.schema !== 'axm.mirror.training-policy/v1') throw new Error('foundation observation request requires the Mirror training policy');
  if (policy.automaticFoundationDevelopmentObservationRequest !== true) throw new Error('automatic foundation observation requests are not enabled');
  if (policy.automaticRuntimePromotion !== false || policy.automaticCanonPromotion !== false || policy.automaticAuthorityGrowth !== false) {
    throw new Error('foundation observation request refuses runtime, canon, or authority growth');
  }
  return policy;
}

function inspect(options = {}) {
  loadPolicy(options);
  const evidence = options.evidence || Observatory.collectOperationalEvidence(options);
  if (!evidence || !['OPERATIONAL_VERIFIED_LOCAL_EVIDENCE', 'SYNTHETIC_OBSERVATORY_FIXTURE'].includes(evidence.sourceMode)) throw new Error('foundation observation request evidence mode changed');
  if (evidence.sourceMode === 'SYNTHETIC_OBSERVATORY_FIXTURE' && options.allowSyntheticFixture !== true) throw new Error('synthetic observation request fixtures require explicit test-only admission');
  if (!evidence.subject || !/^[a-f0-9]{64}$/.test(String(evidence.subject.digest || ''))) throw new Error('foundation observation request subject digest missing');

  const observatoryStateDir = path.resolve(options.observatoryStateDir || Observatory.DEFAULT_STATE_DIR);
  const priorSnapshots = Observatory.loadPriorSnapshots(observatoryStateDir);
  const evidenceDigest = digest(Observatory.evidenceSummary(evidence));
  const exactSnapshotIds = priorSnapshots
    .filter(snapshot => snapshot.subject.digest === evidence.subject.digest && digest(snapshot.evidence) === evidenceDigest)
    .map(snapshot => snapshot.snapshotId)
    .sort();
  const state = exactSnapshotIds.length ? 'NO_NEW_OBSERVATION_REQUIRED' : 'OBSERVATION_REQUIRED';
  const basis = { organId: ORGAN_ID, subjectDigest: evidence.subject.digest, evidenceDigest };
  const request = {
    schema: REQUEST_SCHEMA,
    requestId: `foundation-observation-request-${digest(basis).slice(0, 24)}`,
    requestDigest: null,
    organ: { id: ORGAN_ID, learnedWeights: false },
    observation: { sourceMode: evidence.sourceMode, subjectDigest: evidence.subject.digest, evidenceDigest },
    prior: { snapshotsExamined: priorSnapshots.length, exactSnapshotIds },
    state,
    reason: state === 'OBSERVATION_REQUIRED'
      ? 'No verified snapshot binds this exact Foundation subject and evidence state.'
      : 'A verified immutable snapshot already binds this exact Foundation subject and evidence state.',
    authority: {
      privateRequestTraceWrite: true,
      foundationObservationExecution: false,
      trainingAdmission: false,
      automaticRepair: false,
      modelChange: false,
      runtimePromotion: false,
      canonChange: false,
      permissionGrant: false,
      worldAction: false
    },
    boundary: 'This hand may request a separate Foundation observation when exact source-plus-evidence state is unseen. It cannot perform the observation, grade growth, train, repair, grant permission, promote runtime or canon, or act in the world.'
  };
  request.requestDigest = digest(Object.assign({}, request, { requestDigest: null }));
  return request;
}

function verifyRequest(request, runDir) {
  if (!request || request.schema !== REQUEST_SCHEMA || request.requestDigest !== digest(Object.assign({}, request, { requestDigest: null }))) throw new Error('foundation observation request digest changed');
  if (!request.organ || request.organ.id !== ORGAN_ID || request.organ.learnedWeights !== false) throw new Error('foundation observation request organ boundary changed');
  if (!request.authority || request.authority.privateRequestTraceWrite !== true || Object.entries(request.authority).some(([key, value]) => key === 'privateRequestTraceWrite' ? value !== true : value !== false)) throw new Error('foundation observation request authority changed');
  if (!['OBSERVATION_REQUIRED', 'NO_NEW_OBSERVATION_REQUIRED'].includes(request.state)) throw new Error('foundation observation request state changed');
  if (request.state === 'OBSERVATION_REQUIRED' && request.prior.exactSnapshotIds.length) throw new Error('foundation observation request contradicts exact prior evidence');
  if (request.state === 'NO_NEW_OBSERVATION_REQUIRED' && !request.prior.exactSnapshotIds.length) throw new Error('foundation observation no-op lacks exact prior evidence');
  if (runDir) {
    const disk = JSON.parse(fs.readFileSync(path.join(runDir, 'request.json'), 'utf8'));
    if (!same(disk, request)) throw new Error('foundation observation request file changed');
  }
  return true;
}

function run(options = {}) {
  const request = inspect(options);
  verifyRequest(request);
  if (request.state === 'NO_NEW_OBSERVATION_REQUIRED') return { request, runDir: null, reused: true, written: false };

  const stateDir = path.resolve(options.stateDir || DEFAULT_STATE_DIR);
  fs.mkdirSync(stateDir, { recursive: true });
  const runDir = path.join(stateDir, request.requestId);
  if (fs.existsSync(runDir)) {
    const existing = JSON.parse(fs.readFileSync(path.join(runDir, 'request.json'), 'utf8'));
    verifyRequest(existing, runDir);
    if (existing.requestDigest !== request.requestDigest) throw new Error('foundation observation request identity collision');
    return { request: existing, runDir, reused: true, written: true };
  }
  const stageDir = path.join(stateDir, `.stage-${request.requestId}-${process.pid}`);
  if (fs.existsSync(stageDir)) throw new Error(`foundation observation request staging directory already exists: ${stageDir}`);
  fs.mkdirSync(stageDir, { recursive: true });
  fs.writeFileSync(path.join(stageDir, 'request.json'), json(request), { flag: 'wx' });
  verifyRequest(request, stageDir);
  const commit = ImmutableBatchStore.commitDirectory(stageDir, runDir);
  return { request, runDir, reused: commit.reused, written: true };
}

module.exports = { ORGAN_ID, REQUEST_SCHEMA, DEFAULT_STATE_DIR, loadPolicy, inspect, verifyRequest, run };
