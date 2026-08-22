'use strict';

const V28 = require('../model-shadow-retention-audit-observation-ledger/model-shadow-retention-audit-observation-ledger');

const ARTIFACT_SCHEMA = 'axm.model-shadow-retention-audit-review-artifact/v1';
const REQUEST_SCHEMA = 'axm.model-shadow-retention-audit-review-request/v1';
const HANDOFF_SCHEMA = 'axm.model-shadow-retention-audit-pending-review-handoff/v1';
const ACTION_SCHEMA = 'axm.model-shadow-retention-audit-review-action/v1';
const VERSION = '2.9.0';
const STATUS = 'TEST';
const MODE = 'DATA_ONLY_HELD_RETENTION_AUDIT_REVIEW_REQUEST_UNAUTHENTICATED';
const REVIEW_KIND = 'model-shadow-retention-audit-hold';
const REVIEW_ROUTE = '/api/reviews';
const REVIEW_HEADER_NAME = 'x-axm-review';
const REVIEW_HEADER_VALUE = 'explicit-submit';
const REQUEST_STATE = 'READY_FOR_EXPLICIT_HOST_AUTHORIZED_REVIEW_SUBMISSION';
const HANDOFF_STATE = 'PENDING_REVIEW_ITEM_RELOAD_PRESENTED_HOST_AUTHORIZATION_UNPROVEN';
const NEXT_GATE = 'HUMAN_REVIEW_OF_EXACT_DIGEST_OR_HOLD_REPAIR_REJECT';
const HELD_V27_CLASSIFICATIONS = Object.freeze([
  'OBSERVED_STRICT_HISTORY_ROLLBACK_RELATIVE_TO_PRESENTED_CHECKPOINT',
  'OBSERVED_HISTORY_REPLACEMENT_OR_FORK_RELATIVE_TO_PRESENTED_CHECKPOINT',
  'OBSERVED_LEDGER_IDENTITY_DRIFT',
  'OBSERVED_LEDGER_ABSENT',
  'OBSERVED_LEDGER_OR_CONFIGURATION_INVALID'
]);
const MAX_REQUEST_INPUT_CANONICAL_BYTES = 8388608;
const MAX_HANDOFF_INPUT_CANONICAL_BYTES = 25165824;
const MAX_ARTIFACT_CANONICAL_BYTES = 1048576;
const MAX_REQUEST_CANONICAL_BYTES = 2097152;
const MAX_HANDOFF_CANONICAL_BYTES = 4194304;

class RetentionAuditReviewRequestError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'RetentionAuditReviewRequestError';
    this.code = code;
  }
}

function fail(code, message) { throw new RetentionAuditReviewRequestError(code, message); }
function clone(value) { return JSON.parse(JSON.stringify(value)); }
function stableStringify(value) { return V28.stableStringify(value); }
function sha256(value) { return V28.sha256(value); }
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
  if (typeof value !== 'string' || value.length < 1 || value.length > maximum) fail(code, label + ' is invalid');
  return value;
}
function timestamp(value, code, label) {
  text(value, code, label, 32);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) fail(code, label + ' must be canonical UTC milliseconds');
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== value) fail(code, label + ' is invalid');
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
function reference(value, code, label) {
  exactKeys(value, ['id', 'schema', 'sha256'], code, label);
  text(value.id, code, label + ' id', 180);
  text(value.schema, code, label + ' schema', 180);
  digest(value.sha256, code, label + ' digest');
  return clone(value);
}
function bound(value, maximum, code, label) {
  let bytes;
  try { bytes = Buffer.byteLength(stableStringify(value), 'utf8'); }
  catch (error) { fail(code, label + ' is not canonicalizable: ' + error.message); }
  if (bytes > maximum) fail(code, label + ' exceeds ' + maximum + ' canonical bytes');
  return bytes;
}
function integer(value, minimum, maximum, code, label) {
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) fail(code, label + ' is invalid');
  return value;
}
function observationRef(observation) {
  return { id: observation.observationId, schema: observation.schema, sha256: observation.observationDigest };
}
function auditRef(audit) { return { id: audit.auditId, schema: audit.schema, sha256: audit.auditDigest }; }

function artifactTruth(observation) {
  const audit = observation.v27Audit;
  return {
    v28ObservationExactReloaded: true,
    v28HeldClassificationRequired: true,
    completeV28ObservationCopied: false,
    completeV27AuditCopied: false,
    sourceRollbackObserved: audit.truth.sourceRollbackObserved,
    sourceAbsenceObserved: audit.truth.sourceAbsenceObserved,
    sourceReplacementOrForkObserved: audit.truth.sourceReplacementOrForkObserved,
    currentSourceValidatedByV26Audit: audit.truth.currentSourceValidatedByV26Audit,
    pendingObservationGrantsSettledAuthority: false,
    causeBeyondAuditClassificationProven: false,
    continuousMonitoringPerformed: false,
    reviewSubmitted: false,
    hostMutationAuthorizationProven: false,
    actualHumanReviewProven: false,
    reviewActorAuthenticated: false,
    reviewDecisionRecorded: false,
    holdResolved: false,
    executionAuthorized: false,
    adoptionAuthorized: false,
    humanBenefitProven: false,
    broadLearningClaimed: false,
    rawModelOutputEmbedded: false,
    privateContextEmbedded: false,
    sourceOrLedgerPathEmbedded: false,
    autonomousActionCount: 0,
    automaticPermissionGrant: false,
    automaticInstall: false,
    automaticPromotion: false,
    automaticMerge: false,
    automaticCanon: false,
    foundationMutation: false
  };
}
function requestTruth() {
  return {
    v28ObservationExactReloaded: true,
    heldObservationRequired: true,
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
    holdResolved: false,
    reviewApprovalWouldResolveHold: false,
    transientV28OperationLockMayBeWritten: true,
    durableObservationLedgerStateChangedByModule: false,
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
  };
}
function handoffTruth() {
  return {
    requestExactRebuilt: true,
    reviewArtifactExactDigestMatch: true,
    reviewCandidateExactMatch: true,
    initialReviewItemPresented: true,
    receiverReloadPresentationMatched: true,
    independentReceiverProcessProven: false,
    receiverPersistenceClaimedByHandoff: false,
    reviewItemPending: true,
    reviewVotesIngested: false,
    reviewDiscussionIngested: false,
    reviewNotesIngested: false,
    reviewSubmittedByModule: false,
    hostMutationAuthorizationProven: false,
    actualHumanReviewProven: false,
    reviewActorAuthenticated: false,
    reviewDecisionRecorded: false,
    reviewApprovalRecorded: false,
    holdResolved: false,
    reviewApprovalWouldResolveHold: false,
    receiverStateFileFsyncProven: false,
    directoryEntryOrHardwareDurabilityProven: false,
    externalReceiverRetentionProven: false,
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
  };
}

function buildArtifact(requestId, generatedAt, observation) {
  const audit = observation.v27Audit;
  const result = {
    schema: ARTIFACT_SCHEMA,
    version: VERSION,
    status: STATUS,
    artifactId: requestId,
    generatedAt,
    mode: MODE,
    classification: 'HELD_RETENTION_AUDIT_REVIEW_ARTIFACT',
    observationRef: observationRef(observation),
    observationManifestRef: clone(observation.log.manifestRef),
    observationSequence: observation.log.sequence,
    v27AuditRef: auditRef(audit),
    v27Classification: audit.classification,
    retentionSelection: {
      manifestRef: clone(audit.retention.manifestRef),
      checkpointRef: clone(audit.retention.checkpointRef),
      sequence: audit.retention.sequence,
      selectionStatus: audit.retention.selectionStatus
    },
    decision: {
      reviewRequired: true,
      holdRequired: true,
      bestAction: audit.decision.bestAction,
      autonomousActionCount: 0
    },
    truth: artifactTruth(observation),
    artifactDigest: null
  };
  result.artifactDigest = sha256(withoutField(result, 'artifactDigest'));
  bound(result, MAX_ARTIFACT_CANONICAL_BYTES, 'REVIEW_ARTIFACT_TOO_LARGE', 'retention audit review artifact');
  return result;
}
function sourceRefFor(artifact) {
  return 'model-shadow-retention-audit:' + artifact.observationManifestRef.sha256.slice(7, 23) + ':' + artifact.observationSequence;
}
function buildCandidate(artifact, requiredSeats) {
  const result = {
    kind: REVIEW_KIND,
    title: 'Held Model Shadow retention audit',
    sourceRef: sourceRefFor(artifact),
    artifactDigest: artifact.artifactDigest.slice(7),
    summary: 'Held v2.8 retention-audit observation. v2.7 classification: ' + artifact.v27Classification + '. Inspect the embedded exact-digest artifact; approval would not resolve the hold or authorize action.',
    requiredSeats,
    action: {
      schema: ACTION_SCHEMA,
      type: 'inspect-held-retention-audit-observation',
      artifact: clone(artifact),
      automaticApply: false,
      executionOnApproval: false,
      holdResolutionOnApproval: false,
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

function loadHeldObservation(input) {
  const sequence = integer(input.observationSequence, 1, V28.MAX_RECORDS, 'INVALID_REVIEW_REQUEST_INPUT', 'observation sequence');
  let service;
  try { service = V28.createService(clone(input.observationServiceOptions)); }
  catch (error) { fail('REVIEW_OBSERVATION_INVALID', 'v2.8 observation service is invalid: ' + error.message); }
  const verification = service.verifyPersisted(clone(input.observation));
  if (!verification.pass) fail('REVIEW_OBSERVATION_INVALID', 'v2.8 observation does not exact-reload: ' + verification.errors.join('; '));
  if (verification.rebuilt.log.sequence !== sequence) fail('REVIEW_OBSERVATION_SEQUENCE_MISMATCH', 'requested sequence does not match persisted observation');
  if (verification.rebuilt.classification !== V28.HELD_CLASSIFICATION || verification.rebuilt.decision.holdRequired !== true) {
    fail('REVIEW_OBSERVATION_NOT_HELD', 'only a held v2.8 observation can enter the review request bridge');
  }
  return verification.rebuilt;
}

function buildReviewRequest(input) {
  bound(input, MAX_REQUEST_INPUT_CANONICAL_BYTES, 'REVIEW_REQUEST_INPUT_TOO_LARGE', 'review request input');
  exactKeys(input, ['requestId', 'generatedAt', 'requiredSeats', 'observationServiceOptions', 'observationSequence', 'observation'], 'INVALID_REVIEW_REQUEST_INPUT', 'review request input');
  const requestId = text(input.requestId, 'INVALID_REVIEW_REQUEST_INPUT', 'request id', 180);
  const generatedAt = timestamp(input.generatedAt, 'INVALID_REVIEW_REQUEST_INPUT', 'request generation time');
  const requiredSeats = integer(input.requiredSeats, 1, 10, 'INVALID_REVIEW_REQUEST_INPUT', 'required review seats');
  const observation = loadHeldObservation(input);
  if (Date.parse(generatedAt) < Date.parse(observation.observedAt)) fail('REVIEW_REQUEST_TIME_INVALID', 'review request cannot predate held observation');
  const artifact = buildArtifact(requestId, generatedAt, observation);
  const candidate = buildCandidate(artifact, requiredSeats);
  const result = {
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
    truth: requestTruth(),
    requestDigest: null
  };
  result.requestDigest = sha256(withoutField(result, 'requestDigest'));
  bound(result, MAX_REQUEST_CANONICAL_BYTES, 'REVIEW_REQUEST_TOO_LARGE', 'review request');
  return result;
}

function validateArtifact(value) {
  try {
    bound(value, MAX_ARTIFACT_CANONICAL_BYTES, 'INVALID_REVIEW_ARTIFACT', 'review artifact');
    exactKeys(value, ['schema', 'version', 'status', 'artifactId', 'generatedAt', 'mode', 'classification', 'observationRef', 'observationManifestRef', 'observationSequence', 'v27AuditRef', 'v27Classification', 'retentionSelection', 'decision', 'truth', 'artifactDigest'], 'INVALID_REVIEW_ARTIFACT', 'review artifact');
    if (value.schema !== ARTIFACT_SCHEMA || value.version !== VERSION || value.status !== STATUS || value.mode !== MODE || value.classification !== 'HELD_RETENTION_AUDIT_REVIEW_ARTIFACT') throw new Error('artifact identity mismatch');
    text(value.artifactId, 'INVALID_REVIEW_ARTIFACT', 'artifact id', 180);
    timestamp(value.generatedAt, 'INVALID_REVIEW_ARTIFACT', 'artifact time');
    reference(value.observationRef, 'INVALID_REVIEW_ARTIFACT', 'artifact observation reference');
    reference(value.observationManifestRef, 'INVALID_REVIEW_ARTIFACT', 'artifact observation manifest reference');
    integer(value.observationSequence, 1, V28.MAX_RECORDS, 'INVALID_REVIEW_ARTIFACT', 'artifact observation sequence');
    reference(value.v27AuditRef, 'INVALID_REVIEW_ARTIFACT', 'artifact v2.7 audit reference');
    text(value.v27Classification, 'INVALID_REVIEW_ARTIFACT', 'artifact v2.7 classification', 180);
    if (!HELD_V27_CLASSIFICATIONS.includes(value.v27Classification)) throw new Error('artifact v2.7 classification is not held');
    exactKeys(value.retentionSelection, ['manifestRef', 'checkpointRef', 'sequence', 'selectionStatus'], 'INVALID_REVIEW_ARTIFACT', 'artifact retention selection');
    reference(value.retentionSelection.manifestRef, 'INVALID_REVIEW_ARTIFACT', 'artifact retention manifest reference');
    reference(value.retentionSelection.checkpointRef, 'INVALID_REVIEW_ARTIFACT', 'artifact checkpoint reference');
    integer(value.retentionSelection.sequence, 1, 10000, 'INVALID_REVIEW_ARTIFACT', 'artifact retention sequence');
    if (!['PENDING', 'SETTLED'].includes(value.retentionSelection.selectionStatus)) throw new Error('artifact retention selection status is invalid');
    exactKeys(value.decision, ['reviewRequired', 'holdRequired', 'bestAction', 'autonomousActionCount'], 'INVALID_REVIEW_ARTIFACT', 'artifact decision');
    if (value.decision.reviewRequired !== true || value.decision.holdRequired !== true || value.decision.autonomousActionCount !== 0) throw new Error('artifact decision boundary mismatch');
    text(value.decision.bestAction, 'INVALID_REVIEW_ARTIFACT', 'artifact best action', 180);
    const truthKeys = [
      'v28ObservationExactReloaded', 'v28HeldClassificationRequired', 'completeV28ObservationCopied', 'completeV27AuditCopied',
      'sourceRollbackObserved', 'sourceAbsenceObserved', 'sourceReplacementOrForkObserved', 'currentSourceValidatedByV26Audit',
      'pendingObservationGrantsSettledAuthority', 'causeBeyondAuditClassificationProven', 'continuousMonitoringPerformed',
      'reviewSubmitted', 'hostMutationAuthorizationProven', 'actualHumanReviewProven', 'reviewActorAuthenticated',
      'reviewDecisionRecorded', 'holdResolved', 'executionAuthorized', 'adoptionAuthorized', 'humanBenefitProven',
      'broadLearningClaimed', 'rawModelOutputEmbedded', 'privateContextEmbedded', 'sourceOrLedgerPathEmbedded',
      'autonomousActionCount', 'automaticPermissionGrant', 'automaticInstall', 'automaticPromotion', 'automaticMerge',
      'automaticCanon', 'foundationMutation'
    ];
    exactKeys(value.truth, truthKeys, 'INVALID_REVIEW_ARTIFACT', 'artifact truth');
    const expectedDynamic = {
      sourceRollbackObserved: value.v27Classification === 'OBSERVED_STRICT_HISTORY_ROLLBACK_RELATIVE_TO_PRESENTED_CHECKPOINT',
      sourceAbsenceObserved: value.v27Classification === 'OBSERVED_LEDGER_ABSENT',
      sourceReplacementOrForkObserved: value.v27Classification === 'OBSERVED_HISTORY_REPLACEMENT_OR_FORK_RELATIVE_TO_PRESENTED_CHECKPOINT'
    };
    Object.keys(expectedDynamic).forEach(key => { if (value.truth[key] !== expectedDynamic[key]) throw new Error('artifact classification truth mismatch for ' + key); });
    if (typeof value.truth.currentSourceValidatedByV26Audit !== 'boolean') throw new Error('artifact current-source validation truth is invalid');
    const fixedTrue = ['v28ObservationExactReloaded', 'v28HeldClassificationRequired'];
    const fixedFalse = truthKeys.filter(key => !fixedTrue.includes(key) && !Object.prototype.hasOwnProperty.call(expectedDynamic, key) && key !== 'currentSourceValidatedByV26Audit' && key !== 'autonomousActionCount');
    if (fixedTrue.some(key => value.truth[key] !== true) || fixedFalse.some(key => value.truth[key] !== false) || value.truth.autonomousActionCount !== 0) throw new Error('artifact truth boundary mismatch');
    if (digest(value.artifactDigest, 'INVALID_REVIEW_ARTIFACT', 'artifact digest') !== sha256(withoutField(value, 'artifactDigest'))) throw new Error('artifact digest mismatch');
    return clone(value);
  } catch (error) {
    if (error instanceof RetentionAuditReviewRequestError && error.code === 'INVALID_REVIEW_ARTIFACT') throw error;
    fail('INVALID_REVIEW_ARTIFACT', 'review artifact is invalid: ' + error.message);
  }
}

function validateRequest(value) {
  try {
    bound(value, MAX_REQUEST_CANONICAL_BYTES, 'INVALID_REVIEW_REQUEST', 'review request');
    exactKeys(value, ['schema', 'version', 'status', 'requestId', 'generatedAt', 'mode', 'observationRef', 'reviewArtifact', 'reviewCandidate', 'submission', 'state', 'truth', 'requestDigest'], 'INVALID_REVIEW_REQUEST', 'review request');
    if (value.schema !== REQUEST_SCHEMA || value.version !== VERSION || value.status !== STATUS || value.mode !== MODE || value.state !== REQUEST_STATE) throw new Error('request identity mismatch');
    const requestId = text(value.requestId, 'INVALID_REVIEW_REQUEST', 'request id', 180);
    timestamp(value.generatedAt, 'INVALID_REVIEW_REQUEST', 'request time');
    reference(value.observationRef, 'INVALID_REVIEW_REQUEST', 'request observation reference');
    const artifact = validateArtifact(value.reviewArtifact);
    if (artifact.artifactId !== requestId || artifact.generatedAt !== value.generatedAt || !same(artifact.observationRef, value.observationRef)) throw new Error('request and artifact binding mismatch');
    if (!isObject(value.reviewCandidate)) throw new Error('review candidate is invalid');
    const requiredSeats = integer(value.reviewCandidate.requiredSeats, 1, 10, 'INVALID_REVIEW_REQUEST', 'candidate required seats');
    if (!same(value.reviewCandidate, buildCandidate(artifact, requiredSeats))) throw new Error('review candidate does not derive exactly from artifact');
    if (!same(value.submission, buildSubmission(requestId, value.reviewCandidate))) throw new Error('submission route or body binding mismatch');
    if (!same(value.truth, requestTruth())) throw new Error('request truth boundary mismatch');
    if (digest(value.requestDigest, 'INVALID_REVIEW_REQUEST', 'request digest') !== sha256(withoutField(value, 'requestDigest'))) throw new Error('request digest mismatch');
    return clone(value);
  } catch (error) {
    if (error instanceof RetentionAuditReviewRequestError && error.code === 'INVALID_REVIEW_REQUEST') throw error;
    fail('INVALID_REVIEW_REQUEST', 'review request is invalid: ' + error.message);
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

function validatePendingReviewItem(value, candidate, label) {
  const code = 'INVALID_PENDING_REVIEW_ITEM';
  try {
    exactKeys(value, ['schema', 'id', 'kind', 'title', 'sourceRef', 'artifactDigest', 'summary', 'requiredSeats', 'action', 'state', 'votes', 'discussion', 'createdAt', 'updatedAt', 'expiresAt'], code, label);
    if (value.schema !== 'axm.review-item/v1') throw new Error('review item schema mismatch');
    text(value.id, code, label + ' id', 180);
    if (value.kind !== candidate.kind || value.title !== candidate.title || value.sourceRef !== candidate.sourceRef || value.summary !== candidate.summary) throw new Error('review item route or text mismatch');
    if (rawDigest(value.artifactDigest, code, label + ' artifact digest') !== candidate.artifactDigest) throw new Error('review item digest mismatch');
    if (value.requiredSeats !== candidate.requiredSeats || !same(value.action, candidate.action)) throw new Error('review item seats or action mismatch');
    if (value.state !== 'PENDING') throw new Error('review item is not pending');
    if (!Array.isArray(value.votes) || value.votes.length !== 0) throw new Error('pending review item must have zero votes');
    if (!Array.isArray(value.discussion) || value.discussion.length !== 0) throw new Error('pending review item must have zero discussion');
    timestamp(value.createdAt, code, label + ' creation time');
    timestamp(value.updatedAt, code, label + ' update time');
    if (Date.parse(value.updatedAt) < Date.parse(value.createdAt)) throw new Error('review item update time predates creation');
    if (value.expiresAt !== null) throw new Error('review item expiry must remain null for exact candidate');
    return clone(value);
  } catch (error) {
    if (error instanceof RetentionAuditReviewRequestError && error.code === code) throw error;
    fail(code, label + ' is invalid: ' + error.message);
  }
}
function reviewItemRef(item) { return { id: item.id, schema: item.schema, sha256: sha256(item) }; }

function buildPendingReviewHandoff(input) {
  bound(input, MAX_HANDOFF_INPUT_CANONICAL_BYTES, 'PENDING_REVIEW_HANDOFF_INPUT_TOO_LARGE', 'pending review handoff input');
  exactKeys(input, ['handoffId', 'generatedAt', 'requestInput', 'request', 'initialReviewItem', 'reloadedReviewItem'], 'INVALID_PENDING_REVIEW_HANDOFF_INPUT', 'pending review handoff input');
  const handoffId = text(input.handoffId, 'INVALID_PENDING_REVIEW_HANDOFF_INPUT', 'handoff id', 180);
  const generatedAt = timestamp(input.generatedAt, 'INVALID_PENDING_REVIEW_HANDOFF_INPUT', 'handoff time');
  const requestVerification = verifyReviewRequest(input.requestInput, input.request);
  if (!requestVerification.pass) fail('PENDING_REVIEW_REQUEST_INVALID', 'request does not exact-rebuild: ' + requestVerification.errors.join('; '));
  const request = requestVerification.rebuilt;
  const initial = validatePendingReviewItem(input.initialReviewItem, request.reviewCandidate, 'initial Review Inbox item');
  const reloaded = validatePendingReviewItem(input.reloadedReviewItem, request.reviewCandidate, 'reloaded Review Inbox item');
  if (!same(initial, reloaded)) fail('PENDING_REVIEW_RELOAD_MISMATCH', 'initial and reloaded Review Inbox items differ');
  if (Date.parse(generatedAt) < Math.max(Date.parse(request.generatedAt), Date.parse(reloaded.updatedAt))) fail('PENDING_REVIEW_HANDOFF_TIME_INVALID', 'handoff cannot predate request or receiver item');
  const itemRef = reviewItemRef(reloaded);
  const result = {
    schema: HANDOFF_SCHEMA,
    version: VERSION,
    status: STATUS,
    handoffId,
    generatedAt,
    mode: MODE,
    reviewRequestRef: { id: request.requestId, schema: request.schema, sha256: request.requestDigest },
    observationRef: clone(request.observationRef),
    reviewArtifact: clone(request.reviewArtifact),
    initialReviewItemRef: reviewItemRef(initial),
    receiverReloadRef: itemRef,
    reviewItemEvidence: {
      schema: reloaded.schema,
      id: reloaded.id,
      kind: reloaded.kind,
      sourceRef: reloaded.sourceRef,
      artifactDigest: reloaded.artifactDigest,
      state: reloaded.state,
      requiredSeats: reloaded.requiredSeats,
      voteCount: 0,
      discussionCount: 0,
      createdAt: reloaded.createdAt,
      updatedAt: reloaded.updatedAt
    },
    state: HANDOFF_STATE,
    nextGate: NEXT_GATE,
    truth: handoffTruth(),
    handoffDigest: null
  };
  result.handoffDigest = sha256(withoutField(result, 'handoffDigest'));
  bound(result, MAX_HANDOFF_CANONICAL_BYTES, 'PENDING_REVIEW_HANDOFF_TOO_LARGE', 'pending review handoff');
  return result;
}

function validatePendingReviewHandoff(value) {
  try {
    bound(value, MAX_HANDOFF_CANONICAL_BYTES, 'INVALID_PENDING_REVIEW_HANDOFF', 'pending review handoff');
    exactKeys(value, ['schema', 'version', 'status', 'handoffId', 'generatedAt', 'mode', 'reviewRequestRef', 'observationRef', 'reviewArtifact', 'initialReviewItemRef', 'receiverReloadRef', 'reviewItemEvidence', 'state', 'nextGate', 'truth', 'handoffDigest'], 'INVALID_PENDING_REVIEW_HANDOFF', 'pending review handoff');
    if (value.schema !== HANDOFF_SCHEMA || value.version !== VERSION || value.status !== STATUS || value.mode !== MODE || value.state !== HANDOFF_STATE || value.nextGate !== NEXT_GATE) throw new Error('handoff identity mismatch');
    text(value.handoffId, 'INVALID_PENDING_REVIEW_HANDOFF', 'handoff id', 180);
    timestamp(value.generatedAt, 'INVALID_PENDING_REVIEW_HANDOFF', 'handoff time');
    reference(value.reviewRequestRef, 'INVALID_PENDING_REVIEW_HANDOFF', 'handoff request reference');
    reference(value.observationRef, 'INVALID_PENDING_REVIEW_HANDOFF', 'handoff observation reference');
    const artifact = validateArtifact(value.reviewArtifact);
    if (value.reviewRequestRef.id !== artifact.artifactId || value.reviewRequestRef.schema !== REQUEST_SCHEMA) throw new Error('handoff request reference identity mismatch');
    if (!same(artifact.observationRef, value.observationRef)) throw new Error('handoff artifact and observation disagree');
    reference(value.initialReviewItemRef, 'INVALID_PENDING_REVIEW_HANDOFF', 'initial review item reference');
    reference(value.receiverReloadRef, 'INVALID_PENDING_REVIEW_HANDOFF', 'receiver reload reference');
    if (!same(value.initialReviewItemRef, value.receiverReloadRef)) throw new Error('initial and reload references disagree');
    exactKeys(value.reviewItemEvidence, ['schema', 'id', 'kind', 'sourceRef', 'artifactDigest', 'state', 'requiredSeats', 'voteCount', 'discussionCount', 'createdAt', 'updatedAt'], 'INVALID_PENDING_REVIEW_HANDOFF', 'review item evidence');
    if (value.reviewItemEvidence.schema !== 'axm.review-item/v1' || value.reviewItemEvidence.id !== value.receiverReloadRef.id || value.reviewItemEvidence.state !== 'PENDING') throw new Error('review item evidence identity mismatch');
    if (value.reviewItemEvidence.kind !== REVIEW_KIND || value.reviewItemEvidence.sourceRef !== sourceRefFor(artifact) || value.reviewItemEvidence.artifactDigest !== artifact.artifactDigest.slice(7)) throw new Error('review item evidence artifact mismatch');
    integer(value.reviewItemEvidence.requiredSeats, 1, 10, 'INVALID_PENDING_REVIEW_HANDOFF', 'review item seats');
    if (value.reviewItemEvidence.voteCount !== 0 || value.reviewItemEvidence.discussionCount !== 0) throw new Error('review item evidence is not pristine pending state');
    timestamp(value.reviewItemEvidence.createdAt, 'INVALID_PENDING_REVIEW_HANDOFF', 'review item creation time');
    timestamp(value.reviewItemEvidence.updatedAt, 'INVALID_PENDING_REVIEW_HANDOFF', 'review item update time');
    if (Date.parse(value.reviewItemEvidence.updatedAt) < Date.parse(value.reviewItemEvidence.createdAt)) throw new Error('review item evidence update time predates creation');
    if (Date.parse(value.generatedAt) < Math.max(Date.parse(artifact.generatedAt), Date.parse(value.reviewItemEvidence.updatedAt))) throw new Error('handoff time predates request artifact or review item evidence');
    if (!same(value.truth, handoffTruth())) throw new Error('handoff truth boundary mismatch');
    if (digest(value.handoffDigest, 'INVALID_PENDING_REVIEW_HANDOFF', 'handoff digest') !== sha256(withoutField(value, 'handoffDigest'))) throw new Error('handoff digest mismatch');
    return clone(value);
  } catch (error) {
    if (error instanceof RetentionAuditReviewRequestError && error.code === 'INVALID_PENDING_REVIEW_HANDOFF') throw error;
    fail('INVALID_PENDING_REVIEW_HANDOFF', 'pending review handoff is invalid: ' + error.message);
  }
}

function verifyPendingReviewHandoff(input, handoff) {
  const errors = [];
  let rebuilt = null;
  try {
    rebuilt = buildPendingReviewHandoff(clone(input));
    validatePendingReviewHandoff(handoff);
    if (!same(rebuilt, handoff)) throw new Error('pending review handoff does not exact-rebuild from caller package');
  } catch (error) { errors.push(error.message); }
  return { pass: errors.length === 0, errors, rebuilt };
}

module.exports = {
  ARTIFACT_SCHEMA,
  REQUEST_SCHEMA,
  HANDOFF_SCHEMA,
  ACTION_SCHEMA,
  VERSION,
  STATUS,
  MODE,
  REVIEW_KIND,
  REVIEW_ROUTE,
  REVIEW_HEADER_NAME,
  REVIEW_HEADER_VALUE,
  REQUEST_STATE,
  HANDOFF_STATE,
  NEXT_GATE,
  HELD_V27_CLASSIFICATIONS,
  MAX_REQUEST_INPUT_CANONICAL_BYTES,
  MAX_HANDOFF_INPUT_CANONICAL_BYTES,
  MAX_ARTIFACT_CANONICAL_BYTES,
  MAX_REQUEST_CANONICAL_BYTES,
  MAX_HANDOFF_CANONICAL_BYTES,
  RetentionAuditReviewRequestError,
  stableStringify,
  sha256,
  validateArtifact,
  validateRequest,
  validatePendingReviewHandoff,
  buildReviewRequest,
  verifyReviewRequest,
  buildPendingReviewHandoff,
  verifyPendingReviewHandoff
};
