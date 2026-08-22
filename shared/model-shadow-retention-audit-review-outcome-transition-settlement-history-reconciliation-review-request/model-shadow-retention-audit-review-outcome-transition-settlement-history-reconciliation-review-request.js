'use strict';

const V39 = require('../model-shadow-retention-audit-review-outcome-transition-settlement-history-pairwise-observer/model-shadow-retention-audit-review-outcome-transition-settlement-history-pairwise-observer');

const ARTIFACT_SCHEMA = 'axm.model-shadow-retention-audit-review-outcome-transition-settlement-history-reconciliation-artifact/v1';
const REQUEST_SCHEMA = 'axm.model-shadow-retention-audit-review-outcome-transition-settlement-history-reconciliation-review-request/v1';
const ACTION_SCHEMA = 'axm.model-shadow-retention-audit-review-outcome-transition-settlement-history-reconciliation-review-action/v1';
const VERSION = '4.0.0';
const STATUS = 'TEST';
const MODE = 'DATA_ONLY_COMPLETE_HISTORY_DIVERGENCE_RECONCILIATION_REVIEW_REQUEST_UNAUTHENTICATED';
const REVIEW_KIND = 'model-shadow-transition-settlement-history-reconciliation';
const REVIEW_ROUTE = '/api/reviews';
const REVIEW_HEADER_NAME = 'x-axm-review';
const REVIEW_HEADER_VALUE = 'explicit-submit';
const REQUEST_STATE = 'READY_FOR_EXPLICIT_HOST_AUTHORIZED_RECONCILIATION_REVIEW_SUBMISSION';
const NEXT_GATE = 'AUTHENTICATED_STEWARD_REVIEW_THEN_SEPARATELY_AUTHORIZED_RECONCILIATION';
const MAX_INPUT_CANONICAL_BYTES = 4 * 1024 * 1024;
const MAX_ARTIFACT_CANONICAL_BYTES = 1024 * 1024;
const MAX_REQUEST_CANONICAL_BYTES = 2 * 1024 * 1024;

const ARTIFACT_TRUTH = Object.freeze({
  v39ObservationExactRebuilt: true,
  completeHistoryDivergenceRequired: true,
  leftHistoryCommitmentPreserved: true,
  rightHistoryCommitmentPreserved: true,
  earliestDivergencePreserved: true,
  completeV39ObservationCopied: false,
  completeStoredHistoryCopied: false,
  rawStoredArtifactEmbedded: false,
  sourceOrSettlementPathEmbedded: false,
  rootControllersIndependent: false,
  globallyConsistentHistoryProven: false,
  reviewSubmitted: false,
  hostMutationAuthorizationProven: false,
  actualHumanReviewProven: false,
  reviewActorAuthenticated: false,
  reviewDecisionRecorded: false,
  reconciliationPerformed: false,
  divergenceResolved: false,
  executionAuthorized: false,
  adoptionAuthorized: false,
  humanBenefitProven: false,
  broadLearningClaimed: false,
  providerInvoked: false,
  evaluationPerformed: false,
  autonomousActionCount: 0,
  automaticPermissionGrant: false,
  automaticInstall: false,
  automaticPromotion: false,
  automaticMerge: false,
  automaticCanon: false,
  foundationMutation: false
});

const REQUEST_TRUTH = Object.freeze({
  v39ObservationExactRebuilt: true,
  completeHistoryDivergenceRequired: true,
  reviewArtifactSelfDigestBound: true,
  reviewCandidateExactArtifactDigestMatch: true,
  explicitHostRouteDeclared: true,
  reviewSubmittedByModule: false,
  reviewItemObserved: false,
  hostMutationAuthorizationProven: false,
  actualHumanReviewProven: false,
  reviewActorAuthenticated: false,
  reviewVoteRecorded: false,
  reviewApprovalRecorded: false,
  reviewApprovalWouldReconcileDivergence: false,
  reconciliationPerformed: false,
  divergenceResolved: false,
  networkInvoked: false,
  providerInvoked: false,
  evaluationPerformed: false,
  executionAuthorized: false,
  adoptionAuthorized: false,
  humanBenefitProven: false,
  broadLearningClaimed: false,
  autonomousActionCount: 0,
  automaticPermissionGrant: false,
  automaticInstall: false,
  automaticPromotion: false,
  automaticMerge: false,
  automaticCanon: false,
  foundationMutation: false
});

class HistoryReconciliationReviewRequestError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'HistoryReconciliationReviewRequestError';
    this.code = code;
  }
}

function fail(code, message) { throw new HistoryReconciliationReviewRequestError(code, message); }
function stableStringify(value) { return V39.stableStringify(value); }
function sha256(value) { return V39.sha256(value); }
function clone(value) { return JSON.parse(stableStringify(value)); }
function same(left, right) { return stableStringify(left) === stableStringify(right); }
function withoutField(value, field) { const result = clone(value); delete result[field]; return result; }
function isObject(value) { return Boolean(value) && typeof value === 'object' && !Array.isArray(value); }
function exactKeys(value, keys, code, label) {
  if (!isObject(value)) fail(code, label + ' must be an object');
  const actual = Object.keys(value).sort();
  const expected = keys.slice().sort();
  if (!same(actual, expected)) fail(code, label + ' keys must be exactly: ' + expected.join(', '));
}
function text(value, code, label, maximum) {
  if (typeof value !== 'string' || !value || value !== value.trim() || value.length > maximum) fail(code, label + ' is invalid');
  return value;
}
function timestamp(value, code, label) {
  text(value, code, label, 32);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(Date.parse(value)).toISOString() !== value) fail(code, label + ' is invalid');
  return value;
}
function digest(value, code, label) {
  if (typeof value !== 'string' || !/^sha256:[a-f0-9]{64}$/.test(value)) fail(code, label + ' is invalid');
  return value;
}
function rawDigest(value, code, label) {
  if (typeof value !== 'string' || !/^[a-f0-9]{64}$/.test(value)) fail(code, label + ' is invalid');
  return value;
}
function integer(value, minimum, maximum, code, label) {
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) fail(code, label + ' is invalid');
  return value;
}
function reference(value, code, label, expectedSchema) {
  exactKeys(value, ['id', 'schema', 'sha256'], code, label);
  text(value.id, code, label + ' id', 180);
  text(value.schema, code, label + ' schema', 180);
  digest(value.sha256, code, label + ' digest');
  if (expectedSchema && value.schema !== expectedSchema) fail(code, label + ' schema mismatch');
  return clone(value);
}
function bound(value, maximum, code, label) {
  let bytes;
  try { bytes = Buffer.byteLength(stableStringify(value), 'utf8'); }
  catch (error) { fail(code, label + ' is not canonical JSON data'); }
  if (bytes > maximum) fail(code, label + ' exceeds the bounded canonical byte limit');
  return bytes;
}
function observationRef(observation) {
  return { id: observation.observationId, schema: observation.schema, sha256: observation.observationDigest };
}
function historyCommitmentRef(side) {
  return {
    id: side.historyCommitment.settlementLogId,
    schema: side.historyCommitment.schema,
    sha256: side.historyCommitment.historyCommitmentDigest
  };
}
function historySummary(side) {
  return {
    commitmentRef: historyCommitmentRef(side),
    snapshotRef: clone(side.snapshotRef),
    proposalCount: side.proposalCount,
    settlementCount: side.settlementCount,
    heldSettlementCount: side.heldSettlementCount,
    eventCount: side.historyCommitment.eventCount
  };
}
function artifactTruth() { return clone(ARTIFACT_TRUTH); }
function requestTruth() { return clone(REQUEST_TRUTH); }

function buildArtifact(requestId, generatedAt, observation) {
  const artifact = {
    schema: ARTIFACT_SCHEMA,
    version: VERSION,
    status: STATUS,
    artifactId: requestId,
    generatedAt,
    mode: MODE,
    classification: 'COMPLETE_HISTORY_DIVERGENCE_RECONCILIATION_REVIEW_ARTIFACT',
    observationRef: observationRef(observation),
    leftHistory: historySummary(observation.left),
    rightHistory: historySummary(observation.right),
    comparison: {
      commonNormalizedEventPrefixLength: observation.comparison.commonNormalizedEventPrefixLength,
      earliestDivergence: clone(observation.comparison.earliestDivergence)
    },
    decision: {
      reviewRequired: true,
      holdRequired: true,
      reconciliationRequired: true,
      bestAction: observation.decision.bestAction,
      autonomousActionCount: 0
    },
    truth: artifactTruth(),
    artifactDigest: null
  };
  artifact.artifactDigest = sha256(withoutField(artifact, 'artifactDigest'));
  bound(artifact, MAX_ARTIFACT_CANONICAL_BYTES, 'REVIEW_ARTIFACT_TOO_LARGE', 'history reconciliation review artifact');
  return artifact;
}

function sourceRefFor(artifact) {
  return 'model-shadow-transition-history:' + artifact.observationRef.sha256.slice(7, 31);
}

function buildCandidate(artifact, requiredSeats) {
  const result = {
    kind: REVIEW_KIND,
    title: 'Model Shadow transition-history divergence',
    sourceRef: sourceRefFor(artifact),
    artifactDigest: artifact.artifactDigest.slice(7),
    summary: 'Complete v3.9 transition histories diverge at normalized event ' + artifact.comparison.earliestDivergence.eventIndex + '. Inspect both exact commitments; approval would not reconcile the histories or authorize action.',
    requiredSeats,
    action: {
      schema: ACTION_SCHEMA,
      type: 'inspect-transition-settlement-history-divergence',
      artifact: clone(artifact),
      automaticApply: false,
      reconciliationOnApproval: false,
      executionOnApproval: false,
      adoptionOnApproval: false,
      promotionAuthority: false,
      mergeAuthority: false,
      canonAuthority: false
    }
  };
  bound(result, MAX_REQUEST_CANONICAL_BYTES, 'REVIEW_CANDIDATE_TOO_LARGE', 'Review Inbox candidate');
  return result;
}

function buildSubmission(requestId, candidate) {
  return {
    method: 'POST',
    route: REVIEW_ROUTE,
    requiredHeader: { name: REVIEW_HEADER_NAME, value: REVIEW_HEADER_VALUE },
    bodyRef: { id: requestId, schema: 'axm.review-candidate/v1', sha256: sha256(candidate) },
    explicitHostMutationRequired: true
  };
}

function loadDivergence(input) {
  const verification = V39.verifyObservation(clone(input.observationInput), clone(input.observationReceipt));
  if (!verification.pass) fail('V39_OBSERVATION_INVALID', 'v3.9 observation does not exact-rebuild: ' + verification.errors.join('; '));
  const observation = verification.rebuilt;
  if (observation.classification !== 'COMPLETE_HISTORY_DIVERGES' || observation.decision.divergenceObserved !== true || observation.decision.holdRequired !== false) {
    fail('V39_OBSERVATION_NOT_DIVERGENT', 'only an exact v3.9 complete-history divergence can enter reconciliation review');
  }
  if (!observation.left.historyCommitment || !observation.right.historyCommitment || !observation.comparison.earliestDivergence) {
    fail('V39_DIVERGENCE_EVIDENCE_INCOMPLETE', 'v3.9 divergence is missing complete-history commitment evidence');
  }
  return observation;
}

function buildReviewRequest(value) {
  bound(value, MAX_INPUT_CANONICAL_BYTES, 'REVIEW_REQUEST_INPUT_TOO_LARGE', 'history reconciliation review request input');
  const input = clone(value);
  exactKeys(input, ['requestId', 'generatedAt', 'requiredSeats', 'observationInput', 'observationReceipt'], 'INVALID_REVIEW_REQUEST_INPUT', 'history reconciliation review request input');
  const requestId = text(input.requestId, 'INVALID_REVIEW_REQUEST_INPUT', 'request id', 180);
  const generatedAt = timestamp(input.generatedAt, 'INVALID_REVIEW_REQUEST_INPUT', 'request generation time');
  const requiredSeats = integer(input.requiredSeats, 1, 10, 'INVALID_REVIEW_REQUEST_INPUT', 'required review seats');
  const observation = loadDivergence(input);
  if (Date.parse(generatedAt) < Date.parse(observation.observedAt)) fail('REVIEW_REQUEST_TIME_INVALID', 'review request cannot predate the v3.9 observation');
  const artifact = buildArtifact(requestId, generatedAt, observation);
  const candidate = buildCandidate(artifact, requiredSeats);
  const request = {
    schema: REQUEST_SCHEMA,
    version: VERSION,
    status: STATUS,
    requestId,
    generatedAt,
    mode: MODE,
    observationRef: observationRef(observation),
    reviewArtifact: artifact,
    reviewCandidate: candidate,
    submission: buildSubmission(requestId, candidate),
    state: REQUEST_STATE,
    nextGate: NEXT_GATE,
    truth: requestTruth(),
    requestDigest: null
  };
  request.requestDigest = sha256(withoutField(request, 'requestDigest'));
  bound(request, MAX_REQUEST_CANONICAL_BYTES, 'REVIEW_REQUEST_TOO_LARGE', 'history reconciliation review request');
  return request;
}

function validateHistory(value, code, label) {
  exactKeys(value, ['commitmentRef', 'snapshotRef', 'proposalCount', 'settlementCount', 'heldSettlementCount', 'eventCount'], code, label);
  reference(value.commitmentRef, code, label + ' commitment', V39.HISTORY_COMMITMENT_SCHEMA);
  reference(value.snapshotRef, code, label + ' snapshot');
  integer(value.proposalCount, 0, 10000, code, label + ' proposal count');
  integer(value.settlementCount, 0, 10000, code, label + ' settlement count');
  integer(value.heldSettlementCount, 0, value.settlementCount, code, label + ' held settlement count');
  integer(value.eventCount, 0, 20000, code, label + ' event count');
  if (value.eventCount !== value.proposalCount + value.settlementCount) fail(code, label + ' event count mismatch');
}

function validateDivergence(value, code) {
  exactKeys(value, ['eventIndex', 'leftKind', 'leftSequence', 'leftContentDigest', 'rightKind', 'rightSequence', 'rightContentDigest'], code, 'earliest divergence');
  integer(value.eventIndex, 1, 20001, code, 'earliest divergence event index');
  ['leftKind', 'rightKind'].forEach(key => { if (!['PROPOSAL', 'SETTLEMENT'].includes(value[key])) fail(code, key + ' is invalid'); });
  integer(value.leftSequence, 1, 10000, code, 'left divergence sequence');
  integer(value.rightSequence, 1, 10000, code, 'right divergence sequence');
  digest(value.leftContentDigest, code, 'left divergence digest');
  digest(value.rightContentDigest, code, 'right divergence digest');
  if (value.leftKind === value.rightKind && value.leftSequence === value.rightSequence && value.leftContentDigest === value.rightContentDigest) fail(code, 'earliest divergence events cannot match');
}

function validateArtifact(value) {
  const code = 'INVALID_RECONCILIATION_REVIEW_ARTIFACT';
  try {
    bound(value, MAX_ARTIFACT_CANONICAL_BYTES, code, 'history reconciliation review artifact');
    exactKeys(value, ['schema', 'version', 'status', 'artifactId', 'generatedAt', 'mode', 'classification', 'observationRef', 'leftHistory', 'rightHistory', 'comparison', 'decision', 'truth', 'artifactDigest'], code, 'history reconciliation review artifact');
    if (value.schema !== ARTIFACT_SCHEMA || value.version !== VERSION || value.status !== STATUS || value.mode !== MODE || value.classification !== 'COMPLETE_HISTORY_DIVERGENCE_RECONCILIATION_REVIEW_ARTIFACT') throw new Error('artifact identity mismatch');
    text(value.artifactId, code, 'artifact id', 180);
    timestamp(value.generatedAt, code, 'artifact generation time');
    reference(value.observationRef, code, 'v3.9 observation reference', V39.RECEIPT_SCHEMA);
    validateHistory(value.leftHistory, code, 'left history');
    validateHistory(value.rightHistory, code, 'right history');
    exactKeys(value.comparison, ['commonNormalizedEventPrefixLength', 'earliestDivergence'], code, 'history comparison');
    integer(value.comparison.commonNormalizedEventPrefixLength, 0, 20000, code, 'common history prefix length');
    validateDivergence(value.comparison.earliestDivergence, code);
    if (value.comparison.earliestDivergence.eventIndex !== value.comparison.commonNormalizedEventPrefixLength + 1) throw new Error('divergence index does not follow the common prefix');
    exactKeys(value.decision, ['reviewRequired', 'holdRequired', 'reconciliationRequired', 'bestAction', 'autonomousActionCount'], code, 'review decision');
    if (value.decision.reviewRequired !== true || value.decision.holdRequired !== true || value.decision.reconciliationRequired !== true || value.decision.autonomousActionCount !== 0) throw new Error('review decision boundary mismatch');
    if (value.decision.bestAction !== 'PRESERVE_BOTH_HISTORY_COMMITMENTS_AND_REQUEST_AUTHENTICATED_STEWARD_RECONCILIATION') throw new Error('review best action mismatch');
    exactKeys(value.truth, Object.keys(ARTIFACT_TRUTH), code, 'artifact truth');
    if (!same(value.truth, ARTIFACT_TRUTH)) throw new Error('artifact truth boundary mismatch');
    if (digest(value.artifactDigest, code, 'artifact digest') !== sha256(withoutField(value, 'artifactDigest'))) throw new Error('artifact digest mismatch');
    return clone(value);
  } catch (error) {
    if (error instanceof HistoryReconciliationReviewRequestError && error.code === code) throw error;
    fail(code, 'history reconciliation review artifact is invalid: ' + error.message);
  }
}

function validateCandidate(candidate, artifact, requiredSeats, code) {
  exactKeys(candidate, ['kind', 'title', 'sourceRef', 'artifactDigest', 'summary', 'requiredSeats', 'action'], code, 'Review Inbox candidate');
  if (candidate.kind !== REVIEW_KIND || candidate.title !== 'Model Shadow transition-history divergence' || candidate.sourceRef !== sourceRefFor(artifact)) throw new Error('candidate identity mismatch');
  if (rawDigest(candidate.artifactDigest, code, 'candidate artifact digest') !== artifact.artifactDigest.slice(7)) throw new Error('candidate artifact digest mismatch');
  text(candidate.summary, code, 'candidate summary', 2000);
  integer(candidate.requiredSeats, 1, 10, code, 'candidate required seats');
  if (candidate.requiredSeats !== requiredSeats) throw new Error('candidate seat count mismatch');
  exactKeys(candidate.action, ['schema', 'type', 'artifact', 'automaticApply', 'reconciliationOnApproval', 'executionOnApproval', 'adoptionOnApproval', 'promotionAuthority', 'mergeAuthority', 'canonAuthority'], code, 'candidate action');
  if (candidate.action.schema !== ACTION_SCHEMA || candidate.action.type !== 'inspect-transition-settlement-history-divergence' || !same(candidate.action.artifact, artifact)) throw new Error('candidate action binding mismatch');
  ['automaticApply', 'reconciliationOnApproval', 'executionOnApproval', 'adoptionOnApproval', 'promotionAuthority', 'mergeAuthority', 'canonAuthority'].forEach(key => {
    if (candidate.action[key] !== false) throw new Error('candidate action authority boundary mismatch for ' + key);
  });
}

function validateRequest(value) {
  const code = 'INVALID_RECONCILIATION_REVIEW_REQUEST';
  try {
    bound(value, MAX_REQUEST_CANONICAL_BYTES, code, 'history reconciliation review request');
    exactKeys(value, ['schema', 'version', 'status', 'requestId', 'generatedAt', 'mode', 'observationRef', 'reviewArtifact', 'reviewCandidate', 'submission', 'state', 'nextGate', 'truth', 'requestDigest'], code, 'history reconciliation review request');
    if (value.schema !== REQUEST_SCHEMA || value.version !== VERSION || value.status !== STATUS || value.mode !== MODE || value.state !== REQUEST_STATE || value.nextGate !== NEXT_GATE) throw new Error('request identity mismatch');
    const requestId = text(value.requestId, code, 'request id', 180);
    timestamp(value.generatedAt, code, 'request generation time');
    reference(value.observationRef, code, 'request observation reference', V39.RECEIPT_SCHEMA);
    const artifact = validateArtifact(value.reviewArtifact);
    if (artifact.artifactId !== requestId || artifact.generatedAt !== value.generatedAt || !same(artifact.observationRef, value.observationRef)) throw new Error('request artifact binding mismatch');
    validateCandidate(value.reviewCandidate, artifact, value.reviewCandidate.requiredSeats, code);
    exactKeys(value.submission, ['method', 'route', 'requiredHeader', 'bodyRef', 'explicitHostMutationRequired'], code, 'submission descriptor');
    exactKeys(value.submission.requiredHeader, ['name', 'value'], code, 'submission header');
    if (value.submission.method !== 'POST' || value.submission.route !== REVIEW_ROUTE || value.submission.requiredHeader.name !== REVIEW_HEADER_NAME || value.submission.requiredHeader.value !== REVIEW_HEADER_VALUE || value.submission.explicitHostMutationRequired !== true) throw new Error('submission descriptor mismatch');
    const expectedBodyRef = { id: requestId, schema: 'axm.review-candidate/v1', sha256: sha256(value.reviewCandidate) };
    if (!same(value.submission.bodyRef, expectedBodyRef)) throw new Error('submission body reference mismatch');
    exactKeys(value.truth, Object.keys(REQUEST_TRUTH), code, 'request truth');
    if (!same(value.truth, REQUEST_TRUTH)) throw new Error('request truth boundary mismatch');
    if (digest(value.requestDigest, code, 'request digest') !== sha256(withoutField(value, 'requestDigest'))) throw new Error('request digest mismatch');
    return clone(value);
  } catch (error) {
    if (error instanceof HistoryReconciliationReviewRequestError && error.code === code) throw error;
    fail(code, 'history reconciliation review request is invalid: ' + error.message);
  }
}

function verifyReviewRequest(input, request) {
  const errors = [];
  let rebuilt = null;
  try {
    rebuilt = buildReviewRequest(clone(input));
    validateRequest(request);
    if (!same(rebuilt, request)) throw new Error('review request does not exact-rebuild from caller package');
  } catch (error) { errors.push(error.message); }
  return { pass: errors.length === 0, errors, rebuilt };
}

module.exports = {
  ARTIFACT_SCHEMA, REQUEST_SCHEMA, ACTION_SCHEMA, VERSION, STATUS, MODE,
  REVIEW_KIND, REVIEW_ROUTE, REVIEW_HEADER_NAME, REVIEW_HEADER_VALUE,
  REQUEST_STATE, NEXT_GATE, MAX_INPUT_CANONICAL_BYTES, MAX_ARTIFACT_CANONICAL_BYTES,
  MAX_REQUEST_CANONICAL_BYTES, HistoryReconciliationReviewRequestError,
  stableStringify, sha256, buildReviewRequest, validateArtifact, validateRequest,
  verifyReviewRequest
};
