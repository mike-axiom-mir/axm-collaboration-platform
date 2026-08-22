'use strict';

const V29 = require('../model-shadow-retention-audit-review-request/model-shadow-retention-audit-review-request');

const OUTCOME_SCHEMA = 'axm.model-shadow-retention-audit-review-outcome/v1';
const VERSION = '3.1.0';
const STATUS = 'TEST';
const MODE = 'DATA_ONLY_CALLER_PRESENTED_REVIEW_OUTCOME_UNAUTHENTICATED';
const SUPPORTED_STATES = Object.freeze(['APPROVED', 'HOLD', 'REJECTED']);
const ACTOR_KINDS = Object.freeze(['human', 'machine', 'collective', 'unknown']);
const VERDICTS = Object.freeze(['APPROVE', 'HOLD', 'REJECT']);
const NEXT_GATE = 'SEPARATE_AUTHENTICATED_STEWARD_REMEDIATION_DECISION_OR_REPAIR_RETENTION_HOLD_REMAINS';
const MAX_INPUT_CANONICAL_BYTES = 33554432;
const MAX_OUTCOME_CANONICAL_BYTES = 2097152;
const MAX_VOTES = 10;
const RAW_DIGEST = /^[a-f0-9]{64}$/;
const DIGEST = /^sha256:[a-f0-9]{64}$/;

const FINAL_ITEM_KEYS = [
  'schema', 'id', 'kind', 'title', 'sourceRef', 'artifactDigest', 'summary',
  'requiredSeats', 'action', 'state', 'votes', 'discussion', 'createdAt',
  'updatedAt', 'expiresAt'
];
const VOTE_KEYS = ['actor', 'actorKind', 'verdict', 'note', 'artifactDigest', 'at'];
const OUTCOME_KEYS = [
  'schema', 'version', 'status', 'outcomeId', 'observedAt', 'mode',
  'pendingHandoffRef', 'reviewRequestRef', 'observationRef', 'reviewArtifactRef',
  'reviewItemRef', 'reviewContext', 'reviewOutcome', 'state', 'nextGate',
  'truth', 'outcomeDigest'
];
const OUTCOME_EVIDENCE_KEYS = [
  'state', 'requiredSeats', 'voteCount', 'approvalCount', 'holdCount',
  'rejectionCount', 'declaredHumanVoteCount', 'declaredHumanApprovalCount',
  'votes'
];
const TRUTH_KEYS = [
  'requestAndPendingHandoffExactRebuilt', 'immutableReviewItemTransitionBound',
  'reviewItemExactArtifactDigestMatch', 'reviewVotesExactArtifactDigestMatch',
  'callerPresentedReviewOutcomeObserved', 'approvalStateObserved',
  'holdStateObserved', 'rejectionStateObserved', 'declaredHumanVotePresent',
  'declaredHumanApprovalPresent', 'liveHostOutcomeObserved',
  'hostMutationAuthorizationProven', 'reviewActorAuthenticated',
  'actualHumanReviewProven', 'authenticatedStewardRemediationDecisionProven',
  'holdResolved', 'reviewOutcomeGrantsRemediationAuthority',
  'rawActorIdentityEmbedded', 'voteNotesRetained', 'reviewDiscussionIngested',
  'standaloneActorDigestProvenanceProven',
  'completeReviewItemEmbedded', 'completeReviewRequestEmbedded',
  'completePendingHandoffEmbedded', 'sourceOrReceiverPathEmbedded',
  'transientV28OperationLockMayBeWritten', 'durableSourceStateChangedByModule',
  'durableReviewInboxStateChangedByModule', 'receiverStateFileFsyncProven',
  'independentReceiverProcessProven', 'networkInvoked', 'providerInvoked',
  'evaluationPerformed', 'executionAuthorized', 'adoptionAuthorized',
  'humanBenefitProven', 'broadLearningClaimed', 'autonomousActionCount',
  'automaticPermissionGrant', 'automaticInstall', 'automaticPromotion',
  'automaticMerge', 'automaticCanon', 'foundationMutation'
];

class RetentionAuditReviewOutcomeError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'RetentionAuditReviewOutcomeError';
    this.code = code;
  }
}

function fail(code, message) { throw new RetentionAuditReviewOutcomeError(code, message); }
function clone(value) { return JSON.parse(JSON.stringify(value)); }
function stableStringify(value) { return V29.stableStringify(value); }
function sha256(value) { return V29.sha256(value); }
function same(left, right) { return stableStringify(left) === stableStringify(right); }
function withoutField(value, field) { const result = clone(value); delete result[field]; return result; }
function isObject(value) { return Boolean(value) && typeof value === 'object' && !Array.isArray(value); }

function exactKeys(value, expected, code, label) {
  if (!isObject(value)) fail(code, label + ' must be an object');
  const actual = Object.keys(value).sort();
  const wanted = expected.slice().sort();
  if (!same(actual, wanted)) fail(code, label + ' fields are not exact');
}

function text(value, code, label, maximum, allowEmpty) {
  if (typeof value !== 'string' || value.length > maximum || (!allowEmpty && value.length === 0)) {
    fail(code, label + ' is invalid');
  }
  return value;
}

function timestamp(value, code, label) {
  text(value, code, label, 32, false);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) fail(code, label + ' must use canonical UTC milliseconds');
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== value) fail(code, label + ' is invalid');
  return value;
}

function rawDigest(value, code, label) {
  if (typeof value !== 'string' || !RAW_DIGEST.test(value)) fail(code, label + ' is invalid');
  return value;
}

function digest(value, code, label) {
  if (typeof value !== 'string' || !DIGEST.test(value)) fail(code, label + ' is invalid');
  return value;
}

function integer(value, minimum, maximum, code, label) {
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) fail(code, label + ' is invalid');
  return value;
}

function bound(value, maximum, code, label) {
  let bytes;
  try { bytes = Buffer.byteLength(stableStringify(value), 'utf8'); }
  catch (error) { fail(code, label + ' is not canonicalizable: ' + error.message); }
  if (bytes > maximum) fail(code, label + ' exceeds ' + maximum + ' canonical bytes');
  return bytes;
}

function reference(value, code, label) {
  exactKeys(value, ['id', 'schema', 'sha256'], code, label);
  text(value.id, code, label + ' id', 180, false);
  text(value.schema, code, label + ' schema', 180, false);
  digest(value.sha256, code, label + ' digest');
  return clone(value);
}

function immutableReviewItem(item) {
  return {
    schema: item.schema,
    id: item.id,
    kind: item.kind,
    title: item.title,
    sourceRef: item.sourceRef,
    artifactDigest: item.artifactDigest,
    summary: item.summary,
    requiredSeats: item.requiredSeats,
    action: clone(item.action),
    createdAt: item.createdAt,
    expiresAt: item.expiresAt
  };
}

function normalizeVotes(item, pendingUpdatedAt) {
  const code = 'INVALID_REVIEW_OUTCOME_ITEM';
  if (!Array.isArray(item.votes) || item.votes.length < 1 || item.votes.length > MAX_VOTES) {
    fail(code, 'review outcome item must contain one to ' + MAX_VOTES + ' votes');
  }
  const actors = new Set();
  const normalized = item.votes.map((vote, index) => {
    const label = 'review vote[' + index + ']';
    exactKeys(vote, VOTE_KEYS, code, label);
    const actor = text(vote.actor, code, label + ' actor', 120, false);
    if (actor.trim() !== actor) fail(code, label + ' actor must already be trimmed');
    const actorKey = actor.toLowerCase();
    if (actors.has(actorKey)) fail(code, 'review vote actors must be case-insensitively distinct');
    actors.add(actorKey);
    const actorKind = text(vote.actorKind, code, label + ' actor kind', 40, false);
    if (!ACTOR_KINDS.includes(actorKind)) fail(code, label + ' actor kind is unsupported');
    const verdict = text(vote.verdict, code, label + ' verdict', 10, false);
    if (!VERDICTS.includes(verdict)) fail(code, label + ' verdict is unsupported');
    text(vote.note, code, label + ' note', 1000, true);
    if (rawDigest(vote.artifactDigest, code, label + ' artifact digest') !== item.artifactDigest) {
      fail(code, label + ' artifact digest does not match the reviewed item');
    }
    const at = timestamp(vote.at, code, label + ' time');
    if (Date.parse(at) < Date.parse(pendingUpdatedAt) || Date.parse(at) > Date.parse(item.updatedAt)) {
      fail(code, label + ' time falls outside the pending-to-outcome transition');
    }
    return {
      actorDigest: sha256('review-actor:' + actorKey),
      actorKind,
      verdict,
      artifactDigest: item.artifactDigest,
      at
    };
  }).sort((left, right) => left.actorDigest < right.actorDigest ? -1 : (left.actorDigest > right.actorDigest ? 1 : 0));
  return normalized;
}

function summarizeVotes(item, votes) {
  const approvalCount = votes.filter(vote => vote.verdict === 'APPROVE').length;
  const holdCount = votes.filter(vote => vote.verdict === 'HOLD').length;
  const rejectionCount = votes.filter(vote => vote.verdict === 'REJECT').length;
  const declaredHumanVoteCount = votes.filter(vote => vote.actorKind === 'human').length;
  const declaredHumanApprovalCount = votes.filter(vote => vote.actorKind === 'human' && vote.verdict === 'APPROVE').length;
  if (item.state === 'APPROVED') {
    if (approvalCount < item.requiredSeats) fail('REVIEW_OUTCOME_STATE_CONTRADICTION', 'approved item lacks its required distinct approvals');
    if (holdCount !== 0 || rejectionCount !== 0) fail('REVIEW_OUTCOME_STATE_CONTRADICTION', 'approved item contains a conflicting exact-digest vote');
    if (declaredHumanApprovalCount < 1) fail('REVIEW_OUTCOME_DECLARED_HUMAN_REQUIRED', 'approved item lacks a declared human approval seat');
  } else if (item.state === 'HOLD') {
    if (holdCount < 1 || rejectionCount !== 0 || approvalCount >= item.requiredSeats) {
      fail('REVIEW_OUTCOME_STATE_CONTRADICTION', 'held item vote evidence contradicts its state');
    }
  } else if (item.state === 'REJECTED') {
    if (rejectionCount < 1) fail('REVIEW_OUTCOME_STATE_CONTRADICTION', 'rejected item lacks a rejection vote');
  } else {
    fail('UNSUPPORTED_REVIEW_OUTCOME_STATE', 'review item is not an approved held or rejected outcome');
  }
  return {
    state: item.state,
    requiredSeats: item.requiredSeats,
    voteCount: votes.length,
    approvalCount,
    holdCount,
    rejectionCount,
    declaredHumanVoteCount,
    declaredHumanApprovalCount,
    votes
  };
}

function normalizeFinalReviewItem(value, pendingItem, observedAt) {
  const code = 'INVALID_REVIEW_OUTCOME_ITEM';
  bound(value, MAX_INPUT_CANONICAL_BYTES, code, 'review outcome item');
  exactKeys(value, FINAL_ITEM_KEYS, code, 'review outcome item');
  if (value.schema !== 'axm.review-item/v1') fail(code, 'review outcome item schema mismatch');
  if (!SUPPORTED_STATES.includes(value.state)) fail('UNSUPPORTED_REVIEW_OUTCOME_STATE', 'review item is not post-pending APPROVED HOLD or REJECTED');
  if (!same(immutableReviewItem(value), immutableReviewItem(pendingItem))) {
    fail('REVIEW_OUTCOME_IMMUTABLE_DRIFT', 'review item immutable identity route artifact action seat creation or expiry field drifted');
  }
  if (!Array.isArray(value.discussion) || value.discussion.length !== 0) {
    fail(code, 'review outcome observation requires zero discussion and retains no discussion content');
  }
  timestamp(value.updatedAt, code, 'review outcome item update time');
  if (Date.parse(value.updatedAt) < Date.parse(pendingItem.updatedAt)) fail(code, 'review outcome item predates the pending handoff');
  if (Date.parse(value.updatedAt) > Date.parse(observedAt)) fail('REVIEW_OUTCOME_TIME_INVALID', 'outcome observation predates the review item update');
  integer(value.requiredSeats, 1, 10, code, 'review outcome required seats');
  rawDigest(value.artifactDigest, code, 'review outcome artifact digest');
  const votes = normalizeVotes(value, pendingItem.updatedAt);
  return { item: clone(value), evidence: summarizeVotes(value, votes) };
}

function outcomeState(reviewState) {
  if (reviewState === 'APPROVED') return 'EXACT_ARTIFACT_APPROVAL_OBSERVED_RETENTION_HOLD_UNRESOLVED';
  if (reviewState === 'HOLD') return 'EXACT_ARTIFACT_HOLD_OBSERVED_RETENTION_HOLD_UNRESOLVED';
  if (reviewState === 'REJECTED') return 'EXACT_ARTIFACT_REJECTION_OBSERVED_RETENTION_HOLD_UNRESOLVED';
  fail('UNSUPPORTED_REVIEW_OUTCOME_STATE', 'review state is unsupported');
}

function outcomeTruth(evidence) {
  return {
    requestAndPendingHandoffExactRebuilt: true,
    immutableReviewItemTransitionBound: true,
    reviewItemExactArtifactDigestMatch: true,
    reviewVotesExactArtifactDigestMatch: true,
    callerPresentedReviewOutcomeObserved: true,
    approvalStateObserved: evidence.state === 'APPROVED',
    holdStateObserved: evidence.state === 'HOLD',
    rejectionStateObserved: evidence.state === 'REJECTED',
    declaredHumanVotePresent: evidence.declaredHumanVoteCount > 0,
    declaredHumanApprovalPresent: evidence.declaredHumanApprovalCount > 0,
    liveHostOutcomeObserved: false,
    hostMutationAuthorizationProven: false,
    reviewActorAuthenticated: false,
    actualHumanReviewProven: false,
    authenticatedStewardRemediationDecisionProven: false,
    holdResolved: false,
    reviewOutcomeGrantsRemediationAuthority: false,
    rawActorIdentityEmbedded: false,
    voteNotesRetained: false,
    reviewDiscussionIngested: false,
    standaloneActorDigestProvenanceProven: false,
    completeReviewItemEmbedded: false,
    completeReviewRequestEmbedded: false,
    completePendingHandoffEmbedded: false,
    sourceOrReceiverPathEmbedded: false,
    transientV28OperationLockMayBeWritten: true,
    durableSourceStateChangedByModule: false,
    durableReviewInboxStateChangedByModule: false,
    receiverStateFileFsyncProven: false,
    independentReceiverProcessProven: false,
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

function buildOutcome(input) {
  bound(input, MAX_INPUT_CANONICAL_BYTES, 'REVIEW_OUTCOME_INPUT_TOO_LARGE', 'review outcome input');
  exactKeys(input, ['outcomeId', 'observedAt', 'pendingHandoffInput', 'pendingHandoff', 'reviewItem'], 'INVALID_REVIEW_OUTCOME_INPUT', 'review outcome input');
  const outcomeId = text(input.outcomeId, 'INVALID_REVIEW_OUTCOME_INPUT', 'outcome id', 180, false);
  const observedAt = timestamp(input.observedAt, 'INVALID_REVIEW_OUTCOME_INPUT', 'outcome observation time');
  const pendingCheck = V29.verifyPendingReviewHandoff(clone(input.pendingHandoffInput), clone(input.pendingHandoff));
  if (!pendingCheck.pass) fail('PENDING_REVIEW_HANDOFF_INVALID', 'v2.9 pending handoff does not exact-rebuild: ' + pendingCheck.errors.join('; '));
  const pending = pendingCheck.rebuilt;
  if (Date.parse(observedAt) < Date.parse(pending.generatedAt)) fail('REVIEW_OUTCOME_TIME_INVALID', 'outcome observation predates the pending handoff');
  const pendingItem = clone(input.pendingHandoffInput.reloadedReviewItem);
  const normalized = normalizeFinalReviewItem(input.reviewItem, pendingItem, observedAt);
  const item = normalized.item;
  const evidence = normalized.evidence;
  const artifact = pending.reviewArtifact;
  if (item.artifactDigest !== artifact.artifactDigest.slice(7)) fail('REVIEW_OUTCOME_ARTIFACT_MISMATCH', 'review item digest does not match the exact v2.9 artifact');
  const result = {
    schema: OUTCOME_SCHEMA,
    version: VERSION,
    status: STATUS,
    outcomeId,
    observedAt,
    mode: MODE,
    pendingHandoffRef: { id: pending.handoffId, schema: pending.schema, sha256: pending.handoffDigest },
    reviewRequestRef: clone(pending.reviewRequestRef),
    observationRef: clone(pending.observationRef),
    reviewArtifactRef: { id: artifact.artifactId, schema: artifact.schema, sha256: artifact.artifactDigest },
    reviewItemRef: { id: item.id, schema: item.schema, sha256: sha256(item) },
    reviewContext: {
      v27Classification: artifact.v27Classification,
      bestAction: artifact.decision.bestAction,
      v27AuditRef: clone(artifact.v27AuditRef),
      retentionCheckpointRef: clone(artifact.retentionSelection.checkpointRef)
    },
    reviewOutcome: evidence,
    state: outcomeState(evidence.state),
    nextGate: NEXT_GATE,
    truth: outcomeTruth(evidence),
    outcomeDigest: null
  };
  result.outcomeDigest = sha256(withoutField(result, 'outcomeDigest'));
  bound(result, MAX_OUTCOME_CANONICAL_BYTES, 'REVIEW_OUTCOME_TOO_LARGE', 'review outcome');
  return result;
}

function validateOutcome(value) {
  const code = 'INVALID_REVIEW_OUTCOME';
  try {
    bound(value, MAX_OUTCOME_CANONICAL_BYTES, code, 'review outcome');
    exactKeys(value, OUTCOME_KEYS, code, 'review outcome');
    if (value.schema !== OUTCOME_SCHEMA || value.version !== VERSION || value.status !== STATUS || value.mode !== MODE) throw new Error('outcome identity mismatch');
    text(value.outcomeId, code, 'outcome id', 180, false);
    timestamp(value.observedAt, code, 'outcome observation time');
    const pendingRef = reference(value.pendingHandoffRef, code, 'pending handoff reference');
    const requestRef = reference(value.reviewRequestRef, code, 'review request reference');
    const observationRef = reference(value.observationRef, code, 'observation reference');
    const artifactRef = reference(value.reviewArtifactRef, code, 'review artifact reference');
    const itemRef = reference(value.reviewItemRef, code, 'review item reference');
    if (pendingRef.schema !== V29.HANDOFF_SCHEMA || requestRef.schema !== V29.REQUEST_SCHEMA || artifactRef.schema !== V29.ARTIFACT_SCHEMA || itemRef.schema !== 'axm.review-item/v1') throw new Error('outcome reference schema mismatch');
    exactKeys(value.reviewContext, ['v27Classification', 'bestAction', 'v27AuditRef', 'retentionCheckpointRef'], code, 'review context');
    if (!V29.HELD_V27_CLASSIFICATIONS.includes(value.reviewContext.v27Classification)) throw new Error('review context classification is not held');
    text(value.reviewContext.bestAction, code, 'review context best action', 180, false);
    reference(value.reviewContext.v27AuditRef, code, 'review context audit reference');
    reference(value.reviewContext.retentionCheckpointRef, code, 'review context checkpoint reference');
    exactKeys(value.reviewOutcome, OUTCOME_EVIDENCE_KEYS, code, 'review outcome evidence');
    if (!SUPPORTED_STATES.includes(value.reviewOutcome.state)) throw new Error('review outcome evidence state is unsupported');
    integer(value.reviewOutcome.requiredSeats, 1, 10, code, 'review outcome seats');
    integer(value.reviewOutcome.voteCount, 1, MAX_VOTES, code, 'review outcome vote count');
    ['approvalCount', 'holdCount', 'rejectionCount', 'declaredHumanVoteCount', 'declaredHumanApprovalCount'].forEach(field => integer(value.reviewOutcome[field], 0, MAX_VOTES, code, 'review outcome ' + field));
    if (!Array.isArray(value.reviewOutcome.votes) || value.reviewOutcome.votes.length !== value.reviewOutcome.voteCount) throw new Error('review outcome vote rows do not match voteCount');
    const actorDigests = new Set();
    value.reviewOutcome.votes.forEach((vote, index) => {
      exactKeys(vote, ['actorDigest', 'actorKind', 'verdict', 'artifactDigest', 'at'], code, 'outcome vote[' + index + ']');
      const actorDigest = digest(vote.actorDigest, code, 'outcome vote actor digest');
      if (actorDigests.has(actorDigest)) throw new Error('outcome actor digests must be unique');
      actorDigests.add(actorDigest);
      if (!ACTOR_KINDS.includes(vote.actorKind) || !VERDICTS.includes(vote.verdict)) throw new Error('outcome vote kind or verdict is unsupported');
      rawDigest(vote.artifactDigest, code, 'outcome vote artifact digest');
      timestamp(vote.at, code, 'outcome vote time');
    });
    const actorDigestOrder = value.reviewOutcome.votes.map(vote => vote.actorDigest);
    if (!same(actorDigestOrder, actorDigestOrder.slice().sort())) throw new Error('outcome votes are not in canonical actor-digest order');
    const counts = {
      approvalCount: value.reviewOutcome.votes.filter(vote => vote.verdict === 'APPROVE').length,
      holdCount: value.reviewOutcome.votes.filter(vote => vote.verdict === 'HOLD').length,
      rejectionCount: value.reviewOutcome.votes.filter(vote => vote.verdict === 'REJECT').length,
      declaredHumanVoteCount: value.reviewOutcome.votes.filter(vote => vote.actorKind === 'human').length,
      declaredHumanApprovalCount: value.reviewOutcome.votes.filter(vote => vote.actorKind === 'human' && vote.verdict === 'APPROVE').length
    };
    if (Object.keys(counts).some(field => counts[field] !== value.reviewOutcome[field])) throw new Error('review outcome vote counts are inconsistent');
    const artifactDigests = new Set(value.reviewOutcome.votes.map(vote => vote.artifactDigest));
    if (artifactDigests.size !== 1 || !artifactDigests.has(artifactRef.sha256.slice(7))) throw new Error('outcome votes do not bind the exact artifact');
    summarizeVotes({ state: value.reviewOutcome.state, requiredSeats: value.reviewOutcome.requiredSeats }, value.reviewOutcome.votes);
    if (value.state !== outcomeState(value.reviewOutcome.state) || value.nextGate !== NEXT_GATE) throw new Error('outcome state or next gate mismatch');
    exactKeys(value.truth, TRUTH_KEYS, code, 'outcome truth');
    if (!same(value.truth, outcomeTruth(value.reviewOutcome))) throw new Error('outcome truth boundary mismatch');
    if (digest(value.outcomeDigest, code, 'outcome digest') !== sha256(withoutField(value, 'outcomeDigest'))) throw new Error('outcome digest mismatch');
    return clone(value);
  } catch (error) {
    if (error instanceof RetentionAuditReviewOutcomeError && error.code === code) throw error;
    fail(code, 'review outcome is invalid: ' + error.message);
  }
}

function verifyOutcome(input, outcome) {
  const errors = [];
  let rebuilt = null;
  try {
    rebuilt = buildOutcome(clone(input));
    validateOutcome(outcome);
    if (!same(rebuilt, outcome)) throw new Error('review outcome does not exact-rebuild from caller package');
  } catch (error) { errors.push(error.message); }
  return { pass: errors.length === 0, errors, rebuilt };
}

module.exports = {
  OUTCOME_SCHEMA,
  VERSION,
  STATUS,
  MODE,
  SUPPORTED_STATES,
  ACTOR_KINDS,
  VERDICTS,
  NEXT_GATE,
  MAX_INPUT_CANONICAL_BYTES,
  MAX_OUTCOME_CANONICAL_BYTES,
  MAX_VOTES,
  RetentionAuditReviewOutcomeError,
  stableStringify,
  sha256,
  buildOutcome,
  validateOutcome,
  verifyOutcome
};
