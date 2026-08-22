#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const Anchor = require('../model-shadow-history-checkpoint-anchor/model-shadow-history-checkpoint-anchor');
const History = require('../model-shadow-two-phase-history-checkpoint/model-shadow-two-phase-history-checkpoint');

const RECEIPT_SCHEMA = 'axm.model-shadow-two-phase-history-checkpoint-anchored-pairwise-transition/v1';
const PROFILE_SCHEMA = 'axm.model-shadow-two-phase-history-checkpoint-policy-continuity-profile/v1';
const VERSION = '2.3.0';
const STATUS = 'TEST';
const MAX_INPUT_CANONICAL_BYTES = 132 * 1024 * 1024;
const MAX_RECEIPT_CANONICAL_BYTES = 1024 * 1024;
const HOLD_PREFIX = 'HOLD_';
const CLASSIFICATIONS = Object.freeze([
  'PRESENTED_ANCHORED_PACKAGE_EXACT_REPLAY',
  'PRESENTED_HISTORY_EXACT_RECHECKPOINT',
  'CANDIDATE_EXTENDS_PRESENTED_ANCHORED_HISTORY',
  'HOLD_ANCHOR_IDENTITY_DRIFT',
  'HOLD_ANCHOR_POLICY_PROFILE_DRIFT',
  'HOLD_WITNESS_POLICY_IDENTITY_DRIFT',
  'HOLD_WITNESS_POLICY_PROFILE_DRIFT',
  'HOLD_LEDGER_IDENTITY_DRIFT',
  'HOLD_PRESENTED_TIME_ROLLBACK',
  'HOLD_PRESENTED_TIME_COLLISION',
  'HOLD_CHECKPOINT_ID_EQUIVOCATION',
  'HOLD_ALTERNATE_ANCHORED_PACKAGE_FOR_SAME_CHECKPOINT',
  'HOLD_SNAPSHOT_CHANGED_WITHOUT_HISTORY_EXTENSION',
  'HOLD_STRICT_HISTORY_ROLLBACK',
  'HOLD_HISTORY_REPLACEMENT_OR_FORK'
]);

function stableStringify(value) { return Anchor.stableStringify(value); }
function clone(value) { return JSON.parse(stableStringify(value)); }
function sha256(value) { return Anchor.sha256(value); }
function withoutField(value, field) { const result = clone(value); delete result[field]; return result; }
function same(left, right) { return stableStringify(left) === stableStringify(right); }
function bound(value, maximum, label) {
  let bytes;
  try { bytes = Buffer.byteLength(stableStringify(value), 'utf8'); }
  catch (error) { throw new Error(label + ' must be canonical JSON data'); }
  if (bytes > maximum) throw new Error(label + ' exceeds the bounded canonical byte limit');
}
function exactKeys(value, allowed, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(label + ' must be an object');
  const extras = Object.keys(value).filter(key => !allowed.includes(key));
  const missing = allowed.filter(key => !Object.prototype.hasOwnProperty.call(value, key));
  if (extras.length) throw new Error(label + ' has unknown fields: ' + extras.sort().join(', '));
  if (missing.length) throw new Error(label + ' is missing fields: ' + missing.sort().join(', '));
}
function text(value, label, maximum) {
  if (typeof value !== 'string' || !value || value !== value.trim()) throw new Error(label + ' must be exact non-empty text');
  if (maximum && value.length > maximum) throw new Error(label + ' is too long');
  return value;
}
function timestamp(value, label) {
  const result = text(value, label, 64);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?Z$/.test(result) || Number.isNaN(Date.parse(result))) {
    throw new Error(label + ' must be an exact UTC timestamp');
  }
  return result;
}
function reference(value, label) {
  exactKeys(value, ['id', 'schema', 'sha256'], label);
  if (!/^sha256:[a-f0-9]{64}$/.test(value.sha256)) throw new Error(label + '.sha256 must be an exact SHA-256 digest');
  return { id: text(value.id, label + '.id', 180), schema: text(value.schema, label + '.schema', 180), sha256: value.sha256 };
}
function sameReference(left, right) { return same(left, right); }
function sameReferenceIdentity(left, right) { return left.id === right.id && left.schema === right.schema; }
function publicKeyFingerprint(pem) {
  const key = crypto.createPublicKey(pem);
  if (key.asymmetricKeyType !== 'ed25519') throw new Error('continuity profile contains a non-Ed25519 key');
  return 'sha256:' + crypto.createHash('sha256').update(key.export({ type: 'spki', format: 'der' })).digest('hex');
}

function witnessContinuityProfile(policy) {
  const keys = policy.keys.map(key => ({
    keyId: key.keyId,
    algorithm: key.algorithm,
    keyFingerprint: publicKeyFingerprint(key.publicKeyPem),
    actorDigest: key.actorDigest,
    actorKind: key.actorKind,
    scope: key.scope,
    enabled: key.enabled
  })).sort((left, right) => left.keyId.localeCompare(right.keyId));
  return {
    schema: PROFILE_SCHEMA,
    layer: 'WITNESS',
    policySchema: policy.schema,
    policyId: policy.policyId,
    audience: policy.audience,
    scope: policy.scope,
    authorityOrigin: policy.authorityOrigin,
    requiredSignatures: policy.requiredSignatures,
    maxSignatureAgeSeconds: policy.maxAttestationAgeSeconds,
    keys
  };
}

function anchorContinuityProfile(policy) {
  const keys = policy.keys.map(key => ({
    keyId: key.keyId,
    algorithm: key.algorithm,
    keyFingerprint: publicKeyFingerprint(key.publicKeyPem),
    stewardDigest: key.stewardDigest,
    stewardKind: key.stewardKind,
    scope: key.scope,
    enabled: key.enabled
  })).sort((left, right) => left.keyId.localeCompare(right.keyId));
  return {
    schema: PROFILE_SCHEMA,
    layer: 'ANCHOR',
    policySchema: policy.schema,
    policyId: policy.policyId,
    anchorId: policy.anchorId,
    anchorEpoch: policy.anchorEpoch,
    status: policy.status,
    audience: policy.audience,
    scope: policy.scope,
    authorityOrigin: policy.authorityOrigin,
    requiredSignatures: policy.requiredSignatures,
    maxSignatureAgeSeconds: policy.maxAuthorizationAgeSeconds,
    keys
  };
}

function exactAnchored(input, receipt, label) {
  bound(input, Anchor.MAX_INPUT_CANONICAL_BYTES, label + ' input');
  bound(receipt, Anchor.MAX_RECEIPT_CANONICAL_BYTES, label + ' receipt');
  const check = Anchor.verifyAnchoredCheckpoint(clone(input), clone(receipt));
  if (!check.pass) throw new Error(label + ' does not exact-rebuild: ' + check.errors.join('; '));
  const checkpoint = History.validateCheckpoint(clone(input.witnessInput.checkpoint));
  if (check.rebuilt.checkpointRef.sha256 !== checkpoint.checkpointDigest) throw new Error(label + ' does not reference its exact checkpoint');
  const witnessProfile = witnessContinuityProfile(input.witnessInput.witnessPolicy);
  const anchorProfile = anchorContinuityProfile(input.anchorPolicy);
  return {
    anchored: check.rebuilt,
    checkpoint,
    witnessPolicyRef: clone(check.rebuilt.witnessPolicyRef),
    anchorPolicyRef: clone(check.rebuilt.anchorPolicyRef),
    witnessProfileDigest: sha256(witnessProfile),
    anchorProfileDigest: sha256(anchorProfile),
    witnessProfile,
    anchorProfile
  };
}

function commonPrefixCount(left, right) {
  const maximum = Math.min(left.length, right.length);
  let index = 0;
  while (index < maximum && sameReference(left[index], right[index])) index += 1;
  return index;
}
function isPrefix(left, right) { return left.length <= right.length && commonPrefixCount(left, right) === left.length; }

function identityComparison(previous, candidate) {
  const dimensions = {
    logIdDigest: previous.logIdDigest === candidate.logIdDigest,
    manifestRef: sameReference(previous.manifestRef, candidate.manifestRef),
    genesisSeparatedWitnessRef: sameReference(previous.genesisSeparatedWitnessRef, candidate.genesisSeparatedWitnessRef),
    receiverIdDigest: previous.receiverIdDigest === candidate.receiverIdDigest,
    challengerIdDigest: previous.challengerIdDigest === candidate.challengerIdDigest,
    receiverPolicyRef: sameReference(previous.receiverPolicyRef, candidate.receiverPolicyRef)
  };
  return {
    dimensions,
    driftDimensions: Object.keys(dimensions).filter(key => !dimensions[key]).sort(),
    allMatch: Object.values(dimensions).every(Boolean)
  };
}

function buildComparison(previous, candidate) {
  const previousCheckpoint = previous.checkpoint;
  const candidateCheckpoint = candidate.checkpoint;
  const proposalPrefix = commonPrefixCount(previousCheckpoint.history.proposalRefs, candidateCheckpoint.history.proposalRefs);
  const settlementPrefix = commonPrefixCount(previousCheckpoint.history.settlementRefs, candidateCheckpoint.history.settlementRefs);
  const sameProposals = proposalPrefix === previousCheckpoint.history.proposalRefs.length && proposalPrefix === candidateCheckpoint.history.proposalRefs.length;
  const sameSettlements = settlementPrefix === previousCheckpoint.history.settlementRefs.length && settlementPrefix === candidateCheckpoint.history.settlementRefs.length;
  const sameHistory = sameProposals && sameSettlements;
  const previousPrefixesCandidate = isPrefix(previousCheckpoint.history.proposalRefs, candidateCheckpoint.history.proposalRefs) &&
    isPrefix(previousCheckpoint.history.settlementRefs, candidateCheckpoint.history.settlementRefs);
  const candidatePrefixesPrevious = isPrefix(candidateCheckpoint.history.proposalRefs, previousCheckpoint.history.proposalRefs) &&
    isPrefix(candidateCheckpoint.history.settlementRefs, previousCheckpoint.history.settlementRefs);
  const ledgerIdentity = identityComparison(previousCheckpoint, candidateCheckpoint);
  const anchorIdentityMatches = previous.anchorPolicyRef.id === candidate.anchorPolicyRef.id &&
    previous.anchorPolicyRef.schema === candidate.anchorPolicyRef.schema &&
    previous.anchorProfile.anchorId === candidate.anchorProfile.anchorId;
  const witnessPolicyIdentityMatches = sameReferenceIdentity(previous.witnessPolicyRef, candidate.witnessPolicyRef);
  return {
    anchorIdentityMatches,
    anchorContinuityProfileMatches: previous.anchorProfileDigest === candidate.anchorProfileDigest,
    witnessPolicyIdentityMatches,
    witnessPolicyContinuityProfileMatches: previous.witnessProfileDigest === candidate.witnessProfileDigest,
    ledgerIdentityMatches: ledgerIdentity.allMatch,
    ledgerIdentityDimensions: ledgerIdentity.dimensions,
    ledgerIdentityDriftDimensions: ledgerIdentity.driftDimensions,
    candidateVerificationTimePrecedesPrevious: Date.parse(candidate.anchored.verifiedAt) < Date.parse(previous.anchored.verifiedAt),
    candidateVerificationTimeEqualsPrevious: candidate.anchored.verifiedAt === previous.anchored.verifiedAt,
    candidateCheckpointTimePrecedesPrevious: Date.parse(candidateCheckpoint.checkpointedAt) < Date.parse(previousCheckpoint.checkpointedAt),
    candidateCheckpointTimeEqualsPrevious: candidateCheckpoint.checkpointedAt === previousCheckpoint.checkpointedAt,
    sameCheckpointId: candidateCheckpoint.checkpointId === previousCheckpoint.checkpointId,
    sameCheckpointDigest: candidateCheckpoint.checkpointDigest === previousCheckpoint.checkpointDigest,
    sameAnchoredReceiptDigest: candidate.anchored.receiptDigest === previous.anchored.receiptDigest,
    sameSnapshotBinding: sameReference(
      { id: 'snapshot-binding', schema: previousCheckpoint.snapshotBinding.schema, sha256: previousCheckpoint.snapshotBinding.sha256 },
      { id: 'snapshot-binding', schema: candidateCheckpoint.snapshotBinding.schema, sha256: candidateCheckpoint.snapshotBinding.sha256 }
    ),
    sameHistory,
    previousHistoryPrefixesCandidate: previousPrefixesCandidate,
    candidateHistoryPrefixesPrevious: candidatePrefixesPrevious,
    previousProposalCount: previousCheckpoint.state.proposalCount,
    candidateProposalCount: candidateCheckpoint.state.proposalCount,
    previousSettlementCount: previousCheckpoint.state.settlementCount,
    candidateSettlementCount: candidateCheckpoint.state.settlementCount,
    commonProposalPrefixCount: proposalPrefix,
    commonSettlementPrefixCount: settlementPrefix
  };
}

function classify(comparison) {
  if (!comparison.anchorIdentityMatches) return 'HOLD_ANCHOR_IDENTITY_DRIFT';
  if (!comparison.anchorContinuityProfileMatches) return 'HOLD_ANCHOR_POLICY_PROFILE_DRIFT';
  if (!comparison.witnessPolicyIdentityMatches) return 'HOLD_WITNESS_POLICY_IDENTITY_DRIFT';
  if (!comparison.witnessPolicyContinuityProfileMatches) return 'HOLD_WITNESS_POLICY_PROFILE_DRIFT';
  if (!comparison.ledgerIdentityMatches) return 'HOLD_LEDGER_IDENTITY_DRIFT';
  if (comparison.candidateVerificationTimePrecedesPrevious || comparison.candidateCheckpointTimePrecedesPrevious) {
    return 'HOLD_PRESENTED_TIME_ROLLBACK';
  }
  if (comparison.sameCheckpointId && !comparison.sameCheckpointDigest) return 'HOLD_CHECKPOINT_ID_EQUIVOCATION';
  if (comparison.sameCheckpointDigest) {
    if (comparison.sameAnchoredReceiptDigest) return 'PRESENTED_ANCHORED_PACKAGE_EXACT_REPLAY';
    return 'HOLD_ALTERNATE_ANCHORED_PACKAGE_FOR_SAME_CHECKPOINT';
  }
  if (comparison.candidateVerificationTimeEqualsPrevious || comparison.candidateCheckpointTimeEqualsPrevious) {
    return 'HOLD_PRESENTED_TIME_COLLISION';
  }
  if (comparison.sameHistory) {
    if (!comparison.sameSnapshotBinding) return 'HOLD_SNAPSHOT_CHANGED_WITHOUT_HISTORY_EXTENSION';
    return 'PRESENTED_HISTORY_EXACT_RECHECKPOINT';
  }
  if (comparison.previousHistoryPrefixesCandidate) return 'CANDIDATE_EXTENDS_PRESENTED_ANCHORED_HISTORY';
  if (comparison.candidateHistoryPrefixesPrevious) return 'HOLD_STRICT_HISTORY_ROLLBACK';
  return 'HOLD_HISTORY_REPLACEMENT_OR_FORK';
}

function bestAction(classification) {
  if (classification === 'PRESENTED_ANCHORED_PACKAGE_EXACT_REPLAY') return 'RETAIN_NO_NEW_PAIRWISE_STATE';
  if (classification === 'PRESENTED_HISTORY_EXACT_RECHECKPOINT') return 'REVIEW_RECHECKPOINT_WITHOUT_TREATING_IT_AS_HISTORY_EXTENSION';
  if (classification === 'CANDIDATE_EXTENDS_PRESENTED_ANCHORED_HISTORY') return 'RETAIN_ONLY_IF_AN_AUTHORIZED_HOST_CHOOSES';
  if (classification.includes('POLICY') || classification.includes('ANCHOR')) return 'PRESERVE_BOTH_POLICY_PACKAGES_AND_REQUEST_STEWARD_RECONCILIATION';
  if (classification.includes('TIME')) return 'PRESERVE_BOTH_PACKAGES_AND_REQUEST_TRUSTED_TIME_REVIEW';
  if (classification.includes('LEDGER_IDENTITY')) return 'PRESERVE_BOTH_LEDGER_IDENTITIES_AND_REQUEST_STEWARD_RECONCILIATION';
  return 'PRESERVE_BOTH_PACKAGES_AND_HOLD_FOR_STEWARD_REVIEW';
}

function transitionTruth(classification, comparison) {
  return {
    previousAnchoredCheckpointVerifiedByExactRebuild: true,
    candidateAnchoredCheckpointVerifiedByExactRebuild: true,
    previousCheckpointSelfValidated: true,
    candidateCheckpointSelfValidated: true,
    normalizedAnchorContinuityProfilesCompared: true,
    normalizedWitnessContinuityProfilesCompared: true,
    completeProposalAndSettlementReferencePrefixesCompared: true,
    pairwiseComparisonOnly: true,
    exactAnchoredPackageReplayObserved: classification === 'PRESENTED_ANCHORED_PACKAGE_EXACT_REPLAY',
    exactHistoryRecheckpointObserved: classification === 'PRESENTED_HISTORY_EXACT_RECHECKPOINT',
    forwardHistoryExtensionObserved: classification === 'CANDIDATE_EXTENDS_PRESENTED_ANCHORED_HISTORY',
    strictHistoryRollbackObserved: classification === 'HOLD_STRICT_HISTORY_ROLLBACK',
    historyReplacementOrForkObserved: classification === 'HOLD_HISTORY_REPLACEMENT_OR_FORK',
    ledgerIdentityDriftObserved: classification === 'HOLD_LEDGER_IDENTITY_DRIFT',
    policyOrAnchorDriftObserved: ['HOLD_ANCHOR_IDENTITY_DRIFT', 'HOLD_ANCHOR_POLICY_PROFILE_DRIFT', 'HOLD_WITNESS_POLICY_IDENTITY_DRIFT', 'HOLD_WITNESS_POLICY_PROFILE_DRIFT'].includes(classification),
    pairwiseHoldRequired: classification.startsWith(HOLD_PREFIX),
    pairwiseAnchorIdentityMatches: comparison.anchorIdentityMatches,
    pairwiseAnchorContinuityProfileMatches: comparison.anchorContinuityProfileMatches,
    pairwiseWitnessPolicyIdentityMatches: comparison.witnessPolicyIdentityMatches,
    pairwiseWitnessPolicyContinuityProfileMatches: comparison.witnessPolicyContinuityProfileMatches,
    pairwiseLedgerIdentityMatches: comparison.ledgerIdentityMatches,
    sourceOrLedgerStateRecapturedByThisModule: false,
    checkpointOriginAuthenticated: false,
    checkpointPinAuthenticated: false,
    anchorPolicyAuthorityAuthenticated: false,
    witnessPolicyAuthorityAuthenticated: false,
    policyRotationAuthenticated: false,
    hostAuthorizationAuthenticated: false,
    externalRetentionProven: false,
    protectedMonotonicStateProven: false,
    deletionOrRollbackPrevented: false,
    withheldBranchesExcluded: false,
    unpresentedBranchesObserved: false,
    twoIndependentCandidatesMayExtendSamePrevious: true,
    globalTransitionUniquenessProven: false,
    globallyConsistentLogProven: false,
    originalPairContinuityProven: false,
    jointPairReplacementStillPossible: true,
    realWorldControllerIndependenceProven: false,
    sameControllerWithDistinctKeysAndDigestsStillPossible: true,
    crossLayerCollusionExcluded: false,
    actualHumanParticipationProven: false,
    comparisonTimeExternallyTrusted: false,
    rawPublicKeyEmbedded: false,
    rawSignatureEmbedded: false,
    privateKeyIngested: false,
    sourceOrLedgerPathEmbedded: false,
    rawModelOutputEmbedded: false,
    privateContextEmbedded: false,
    providerInvoked: false,
    experimentExecuted: false,
    evaluationPerformed: false,
    executionAuthorized: false,
    adoptionAuthorized: false,
    humanBenefitProven: false,
    broadLearningClaimed: false,
    automaticWrite: false,
    automaticPermissionGrant: false,
    automaticInstall: false,
    automaticPromotion: false,
    automaticMerge: false,
    automaticCanon: false,
    foundationMutation: false
  };
}

function buildTransition(input) {
  bound(input, MAX_INPUT_CANONICAL_BYTES, 'anchored history pairwise transition input');
  exactKeys(input, [
    'transitionId', 'comparedAt',
    'previousAnchoredInput', 'previousAnchoredReceipt',
    'candidateAnchoredInput', 'candidateAnchoredReceipt'
  ], 'anchored history pairwise transition input');
  const transitionId = text(input.transitionId, 'anchored history pairwise transition id', 180);
  const comparedAt = timestamp(input.comparedAt, 'anchored history pairwise comparison time');
  const previous = exactAnchored(input.previousAnchoredInput, input.previousAnchoredReceipt, 'previous anchored checkpoint');
  const candidate = exactAnchored(input.candidateAnchoredInput, input.candidateAnchoredReceipt, 'candidate anchored checkpoint');
  if (Date.parse(comparedAt) < Date.parse(previous.anchored.verifiedAt) || Date.parse(comparedAt) < Date.parse(candidate.anchored.verifiedAt)) {
    throw new Error('pairwise comparison time cannot predate either exact anchored checkpoint verification');
  }
  const comparison = buildComparison(previous, candidate);
  const classification = classify(comparison);
  if (!CLASSIFICATIONS.includes(classification)) throw new Error('pairwise classification is outside the closed set');
  const receipt = {
    schema: RECEIPT_SCHEMA,
    version: VERSION,
    status: STATUS,
    transitionId,
    comparedAt,
    previousAnchoredCheckpointRef: {
      id: previous.anchored.receiptId,
      schema: previous.anchored.schema,
      sha256: previous.anchored.receiptDigest
    },
    candidateAnchoredCheckpointRef: {
      id: candidate.anchored.receiptId,
      schema: candidate.anchored.schema,
      sha256: candidate.anchored.receiptDigest
    },
    previousCheckpointRef: clone(previous.anchored.checkpointRef),
    candidateCheckpointRef: clone(candidate.anchored.checkpointRef),
    anchorContinuity: {
      previousPolicyRef: clone(previous.anchorPolicyRef),
      candidatePolicyRef: clone(candidate.anchorPolicyRef),
      previousProfileDigest: previous.anchorProfileDigest,
      candidateProfileDigest: candidate.anchorProfileDigest
    },
    witnessContinuity: {
      previousPolicyRef: clone(previous.witnessPolicyRef),
      candidatePolicyRef: clone(candidate.witnessPolicyRef),
      previousProfileDigest: previous.witnessProfileDigest,
      candidateProfileDigest: candidate.witnessProfileDigest
    },
    classification,
    comparison,
    decision: {
      reviewRequired: true,
      holdRequired: classification.startsWith(HOLD_PREFIX),
      forwardHistoryCandidate: classification === 'CANDIDATE_EXTENDS_PRESENTED_ANCHORED_HISTORY',
      bestAction: bestAction(classification),
      autonomousActionCount: 0
    },
    state: 'PAIRWISE_ANCHORED_HISTORY_CLASSIFIED_RELATIVE_TO_TWO_CALLER_PACKAGES_AUTHORITY_AND_RETENTION_NOT_PROVEN',
    truth: transitionTruth(classification, comparison),
    transitionDigest: null
  };
  receipt.transitionDigest = sha256(withoutField(receipt, 'transitionDigest'));
  bound(receipt, MAX_RECEIPT_CANONICAL_BYTES, 'anchored history pairwise transition receipt');
  return receipt;
}

function verifyTransition(input, receipt) {
  const errors = [];
  let rebuilt = null;
  try {
    bound(receipt, MAX_RECEIPT_CANONICAL_BYTES, 'anchored history pairwise transition receipt');
    if (!receipt || receipt.schema !== RECEIPT_SCHEMA) throw new Error('anchored history pairwise transition receipt schema mismatch');
    rebuilt = buildTransition(input);
    if (!same(rebuilt, receipt)) throw new Error('anchored history pairwise transition receipt content or digest mismatch');
  } catch (error) { errors.push(error.message); }
  return { pass: errors.length === 0, errors, rebuilt };
}

module.exports = {
  RECEIPT_SCHEMA,
  PROFILE_SCHEMA,
  VERSION,
  STATUS,
  MAX_INPUT_CANONICAL_BYTES,
  MAX_RECEIPT_CANONICAL_BYTES,
  CLASSIFICATIONS,
  stableStringify,
  sha256,
  witnessContinuityProfile,
  anchorContinuityProfile,
  buildTransition,
  verifyTransition
};
