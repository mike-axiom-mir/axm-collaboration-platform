#!/usr/bin/env node
'use strict';

const AnchorGate = require('../model-shadow-review-challenge-anchor-gate/model-shadow-review-challenge-anchor-gate');
const Continuity = require('../model-shadow-review-challenge-continuity/model-shadow-review-challenge-continuity');
const SeparationGate = require('../model-shadow-review-challenge-separation-gate/model-shadow-review-challenge-separation-gate');

const RECEIPT_SCHEMA = 'axm.model-shadow-review-challenge-pairwise-transition/v1';
const VERSION = '0.7.0';
const STATUS = 'TEST';
const NEXT_GATE = 'HOST_AUTHENTICATED_EXTERNALLY_RETAINED_GLOBALLY_CONSISTENT_TRANSITION_LOG_OR_PROTECTED_MONOTONIC_STORE';
const DIGEST = /^sha256:[a-f0-9]{64}$/;
const HOLD_PREFIX = 'HOLD_';

function stableStringify(value) {
  return SeparationGate.stableStringify(value);
}

function clone(value) {
  return JSON.parse(stableStringify(value));
}

function sha256(value) {
  return SeparationGate.sha256(value);
}

function exactKeys(value, allowed, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(label + ' must be an object');
  const extras = Object.keys(value).filter(key => !allowed.includes(key));
  const missing = allowed.filter(key => !Object.prototype.hasOwnProperty.call(value, key));
  if (extras.length) throw new Error(label + ' has unknown fields: ' + extras.sort().join(', '));
  if (missing.length) throw new Error(label + ' is missing fields: ' + missing.sort().join(', '));
}

function exactText(value, label, maximum) {
  if (typeof value !== 'string' || !value || value !== value.trim()) throw new Error(label + ' must be exact non-empty text');
  if (maximum && value.length > maximum) throw new Error(label + ' is too long');
  return value;
}

function timestamp(value, label) {
  const result = exactText(value, label, 64);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?Z$/.test(result) || Number.isNaN(Date.parse(result))) {
    throw new Error(label + ' must be an exact UTC timestamp');
  }
  return result;
}

function digest(value, label) {
  const result = exactText(value, label, 71);
  if (!DIGEST.test(result)) throw new Error(label + ' must be an exact SHA-256 digest');
  return result;
}

function withoutField(value, field) {
  const result = clone(value);
  delete result[field];
  return result;
}

function reference(value, label) {
  exactKeys(value, ['id', 'schema', 'sha256'], label);
  return {
    id: exactText(value.id, label + '.id', 180),
    schema: exactText(value.schema, label + '.schema', 180),
    sha256: digest(value.sha256, label + '.sha256')
  };
}

function sameIdentity(left, right) {
  return left.id === right.id && left.schema === right.schema;
}

function sameReference(left, right) {
  return sameIdentity(left, right) && left.sha256 === right.sha256;
}

function compareEntries(previousCheckpoint, candidateCheckpoint) {
  const previousByChallenge = new Map(previousCheckpoint.entries.map(entry => [entry.challengeDigest, entry]));
  const candidateByChallenge = new Map(candidateCheckpoint.entries.map(entry => [entry.challengeDigest, entry]));
  const missing = [];
  const replaced = [];
  const added = [];
  previousCheckpoint.entries.forEach(previous => {
    const candidate = candidateByChallenge.get(previous.challengeDigest);
    if (!candidate) missing.push(previous.challengeDigest);
    else if (candidate.consumptionReceiptDigest !== previous.consumptionReceiptDigest || candidate.consumedAt !== previous.consumedAt) {
      replaced.push({
        challengeDigest: previous.challengeDigest,
        previousConsumptionReceiptDigest: previous.consumptionReceiptDigest,
        candidateConsumptionReceiptDigest: candidate.consumptionReceiptDigest,
        previousConsumedAt: previous.consumedAt,
        candidateConsumedAt: candidate.consumedAt
      });
    }
  });
  candidateCheckpoint.entries.forEach(candidate => {
    if (!previousByChallenge.has(candidate.challengeDigest)) added.push(candidate.challengeDigest);
  });
  return {
    missingPreviousChallenges: missing.sort(),
    replacedPreviousEntries: replaced.sort((left, right) => left.challengeDigest.localeCompare(right.challengeDigest)),
    addedCandidateChallenges: added.sort()
  };
}

function exactSeparated(input, receipt, label) {
  const check = SeparationGate.verifySeparatedWitness(clone(input), clone(receipt));
  if (!check.pass) throw new Error(label + ' is invalid: ' + check.errors.join('; '));
  const anchoredCheck = AnchorGate.verifyAnchoredWitness(
    clone(input.anchoredWitnessInput),
    clone(input.anchoredWitnessReceipt)
  );
  if (!anchoredCheck.pass) throw new Error(label + ' anchored witness is invalid: ' + anchoredCheck.errors.join('; '));
  const checkpoint = Continuity.validateCheckpoint(clone(input.anchoredWitnessInput.witnessInput.checkpoint));
  return { separated: check.rebuilt, anchored: anchoredCheck.rebuilt, checkpoint };
}

function classify(previous, candidate, comparison) {
  if (!comparison.anchorIdentityMatches) return 'HOLD_ANCHOR_IDENTITY_DRIFT';
  if (!comparison.ledgerIdentityMatches) return 'HOLD_LEDGER_IDENTITY_DRIFT';
  if (comparison.candidateVerificationTimePrecedesPrevious || comparison.candidateCheckpointTimePrecedesPrevious) {
    return 'HOLD_PRESENTED_TIME_ROLLBACK';
  }
  if (candidate.anchored.anchorEpoch < previous.anchored.anchorEpoch) return 'HOLD_SELF_DECLARED_ANCHOR_EPOCH_ROLLBACK';
  if (candidate.anchored.anchorEpoch === previous.anchored.anchorEpoch &&
      candidate.anchored.anchorRef.sha256 !== previous.anchored.anchorRef.sha256) {
    return 'HOLD_ANCHOR_EQUIVOCATION_AT_SELF_DECLARED_EPOCH';
  }
  if (candidate.checkpoint.checkpointId === previous.checkpoint.checkpointId &&
      candidate.checkpoint.checkpointDigest !== previous.checkpoint.checkpointDigest) {
    return 'HOLD_CHECKPOINT_ID_EQUIVOCATION';
  }
  if (candidate.checkpoint.checkpointDigest === previous.checkpoint.checkpointDigest) {
    if (candidate.separated.receiptDigest === previous.separated.receiptDigest) return 'PRESENTED_CHAIN_EXACT_REPLAY';
    return 'HOLD_ALTERNATE_SEPARATED_CHAIN_FOR_SAME_CHECKPOINT';
  }
  if (Date.parse(candidate.checkpoint.anchoredAt) <= Date.parse(previous.checkpoint.anchoredAt)) {
    return 'HOLD_CHECKPOINT_TIME_COLLISION';
  }
  if (comparison.missingPreviousChallenges.length || comparison.replacedPreviousEntries.length) {
    return 'HOLD_CANDIDATE_REMOVES_OR_REPLACES_PRIOR_ENTRIES';
  }
  if (!comparison.addedCandidateChallenges.length) return 'HOLD_CHECKPOINT_CHANGED_WITHOUT_LEDGER_EXTENSION';
  return 'CANDIDATE_EXTENDS_PRESENTED_CHAIN';
}

function bestAction(classification) {
  const actions = {
    PRESENTED_CHAIN_EXACT_REPLAY: 'RETAIN_NO_NEW_TRANSITION_STATE',
    CANDIDATE_EXTENDS_PRESENTED_CHAIN: 'RETAIN_TRANSITION_ONLY_IF_AN_AUTHORIZED_HOST_CHOOSES',
    HOLD_ANCHOR_IDENTITY_DRIFT: 'PRESERVE_BOTH_ANCHOR_IDENTITIES_AND_REQUEST_STEWARD_RECONCILIATION',
    HOLD_LEDGER_IDENTITY_DRIFT: 'PRESERVE_BOTH_LEDGER_IDENTITIES_AND_REQUEST_STEWARD_RECONCILIATION',
    HOLD_PRESENTED_TIME_ROLLBACK: 'PRESERVE_BOTH_CHAINS_AND_REQUEST_TRUSTED_TIME_REVIEW',
    HOLD_SELF_DECLARED_ANCHOR_EPOCH_ROLLBACK: 'PRESERVE_BOTH_CHAINS_AND_REQUEST_ANCHOR_EPOCH_REVIEW',
    HOLD_ANCHOR_EQUIVOCATION_AT_SELF_DECLARED_EPOCH: 'PRESERVE_BOTH_ANCHOR_POLICIES_AND_HOLD_TRANSITION',
    HOLD_CHECKPOINT_ID_EQUIVOCATION: 'PRESERVE_BOTH_CHECKPOINTS_AND_HOLD_TRANSITION',
    HOLD_ALTERNATE_SEPARATED_CHAIN_FOR_SAME_CHECKPOINT: 'PRESERVE_BOTH_SEPARATED_CHAINS_AND_HOLD_TRANSITION',
    HOLD_CHECKPOINT_TIME_COLLISION: 'PRESERVE_BOTH_CHECKPOINTS_AND_REQUEST_TRUSTED_TIME_REVIEW',
    HOLD_CANDIDATE_REMOVES_OR_REPLACES_PRIOR_ENTRIES: 'PRESERVE_BOTH_CHAINS_AND_REQUEST_FORK_OR_ROLLBACK_REVIEW',
    HOLD_CHECKPOINT_CHANGED_WITHOUT_LEDGER_EXTENSION: 'PRESERVE_BOTH_CHECKPOINTS_AND_REQUEST_METADATA_CHANGE_REVIEW'
  };
  return actions[classification];
}

function transitionTruth(classification, comparison) {
  const hold = classification.startsWith(HOLD_PREFIX);
  return {
    previousSeparatedChainVerifiedByExactRebuild: true,
    candidateSeparatedChainVerifiedByExactRebuild: true,
    pairwiseComparisonOnly: true,
    pairwiseLedgerIdentityMatches: comparison.ledgerIdentityMatches,
    pairwiseAnchorIdentityMatches: comparison.anchorIdentityMatches,
    exactPresentedReplayObserved: classification === 'PRESENTED_CHAIN_EXACT_REPLAY',
    forwardExtensionObserved: classification === 'CANDIDATE_EXTENDS_PRESENTED_CHAIN',
    pairwiseConflictOrContradictionDetected: hold,
    priorEntryRemovalOrReplacementDetected: comparison.missingPreviousChallenges.length > 0 || comparison.replacedPreviousEntries.length > 0,
    anchorEpochSelfDeclared: true,
    anchorEpochRollbackObserved: classification === 'HOLD_SELF_DECLARED_ANCHOR_EPOCH_ROLLBACK',
    sameEpochAnchorEquivocationObserved: classification === 'HOLD_ANCHOR_EQUIVOCATION_AT_SELF_DECLARED_EPOCH',
    checkpointIdEquivocationObserved: classification === 'HOLD_CHECKPOINT_ID_EQUIVOCATION',
    anchorEpochMonotonicityProven: false,
    withheldForksExcluded: false,
    unpresentedBranchesExcluded: false,
    globalTransitionUniquenessProven: false,
    globallyConsistentTransitionLogProven: false,
    externalTransitionRetentionProven: false,
    protectedMonotonicStateProven: false,
    realWorldControllerIndependenceProven: false,
    crossLayerCollusionExcluded: false,
    anchorPolicyAuthorityAuthenticated: false,
    expectedAnchorDigestAuthorityAuthenticated: false,
    actualHumanParticipationProven: false,
    comparisonTimeExternallyTrusted: false,
    deletionOrRollbackPrevented: false,
    hostAuthorizationAuthenticated: false,
    experimentExecuted: false,
    evaluationPerformed: false,
    executionAuthorized: false,
    adoptionAuthorized: false,
    humanBenefitProven: false,
    broadLearningClaimed: false,
    automaticWrite: false,
    automaticPermissionGrant: false,
    automaticPromotion: false,
    automaticMerge: false,
    automaticCanon: false,
    foundationMutation: false
  };
}

function buildTransition(input) {
  exactKeys(input, [
    'transitionId', 'comparedAt',
    'previousSeparationInput', 'previousSeparationReceipt',
    'candidateSeparationInput', 'candidateSeparationReceipt'
  ], 'pairwise transition input');
  const transitionId = exactText(input.transitionId, 'pairwise transition id', 180);
  const comparedAt = timestamp(input.comparedAt, 'pairwise transition comparedAt');
  const previous = exactSeparated(input.previousSeparationInput, input.previousSeparationReceipt, 'previous separated chain');
  const candidate = exactSeparated(input.candidateSeparationInput, input.candidateSeparationReceipt, 'candidate separated chain');
  if (Date.parse(comparedAt) < Date.parse(previous.separated.verifiedAt) ||
      Date.parse(comparedAt) < Date.parse(candidate.separated.verifiedAt)) {
    throw new Error('pairwise transition comparison cannot predate either separated chain');
  }

  const entryComparison = compareEntries(previous.checkpoint, candidate.checkpoint);
  const comparison = {
    anchorIdentityMatches: sameIdentity(previous.anchored.anchorRef, candidate.anchored.anchorRef),
    ledgerIdentityMatches: sameReference(previous.checkpoint.ledgerRef, candidate.checkpoint.ledgerRef),
    candidateVerificationTimePrecedesPrevious: Date.parse(candidate.separated.verifiedAt) < Date.parse(previous.separated.verifiedAt),
    candidateCheckpointTimePrecedesPrevious: Date.parse(candidate.checkpoint.anchoredAt) < Date.parse(previous.checkpoint.anchoredAt),
    sameAnchorDigest: previous.anchored.anchorRef.sha256 === candidate.anchored.anchorRef.sha256,
    sameCheckpointDigest: previous.checkpoint.checkpointDigest === candidate.checkpoint.checkpointDigest,
    sameSeparatedReceiptDigest: previous.separated.receiptDigest === candidate.separated.receiptDigest,
    missingPreviousChallenges: entryComparison.missingPreviousChallenges,
    replacedPreviousEntries: entryComparison.replacedPreviousEntries,
    addedCandidateChallenges: entryComparison.addedCandidateChallenges
  };
  const classification = classify(previous, candidate, comparison);
  const hold = classification.startsWith(HOLD_PREFIX);
  const anchorEpochRelation = candidate.anchored.anchorEpoch < previous.anchored.anchorEpoch
    ? 'ROLLBACK_SELF_DECLARED'
    : candidate.anchored.anchorEpoch > previous.anchored.anchorEpoch
      ? 'ADVANCED_SELF_DECLARED'
      : 'SAME_SELF_DECLARED_EPOCH';
  const receipt = {
    schema: RECEIPT_SCHEMA,
    version: VERSION,
    transitionId,
    comparedAt,
    status: STATUS,
    previousSeparatedWitnessRef: {
      id: previous.separated.receiptId,
      schema: previous.separated.schema,
      sha256: previous.separated.receiptDigest
    },
    candidateSeparatedWitnessRef: {
      id: candidate.separated.receiptId,
      schema: candidate.separated.schema,
      sha256: candidate.separated.receiptDigest
    },
    anchorTransition: {
      anchorId: previous.anchored.anchorRef.id,
      previousAnchorDigest: previous.anchored.anchorRef.sha256,
      candidateAnchorDigest: candidate.anchored.anchorRef.sha256,
      previousSelfDeclaredEpoch: previous.anchored.anchorEpoch,
      candidateSelfDeclaredEpoch: candidate.anchored.anchorEpoch,
      relation: anchorEpochRelation
    },
    ledgerRef: reference(previous.checkpoint.ledgerRef, 'previous checkpoint ledger reference'),
    previousCheckpointRef: {
      id: previous.checkpoint.checkpointId,
      schema: previous.checkpoint.schema,
      sha256: previous.checkpoint.checkpointDigest
    },
    candidateCheckpointRef: {
      id: candidate.checkpoint.checkpointId,
      schema: candidate.checkpoint.schema,
      sha256: candidate.checkpoint.checkpointDigest
    },
    comparison,
    decision: {
      classification,
      pairwiseConsistency: hold ? 'CONTRADICTION' : classification === 'PRESENTED_CHAIN_EXACT_REPLAY' ? 'CONSISTENT_REPLAY' : 'CONSISTENT_EXTENSION',
      forwardTransitionAdmissible: classification === 'CANDIDATE_EXTENDS_PRESENTED_CHAIN',
      reviewRequired: hold,
      bestAction: bestAction(classification),
      autonomousActionCount: 0
    },
    state: 'PAIRWISE_SEPARATED_CHAIN_TRANSITION_COMPARED_GLOBAL_FORK_ABSENCE_NOT_PROVEN',
    nextGate: NEXT_GATE,
    truth: transitionTruth(classification, comparison),
    receiptDigest: null
  };
  receipt.receiptDigest = sha256(withoutField(receipt, 'receiptDigest'));
  return receipt;
}

function verifyTransition(input, receipt) {
  const errors = [];
  let rebuilt = null;
  try {
    if (!receipt || receipt.schema !== RECEIPT_SCHEMA) throw new Error('pairwise transition receipt schema mismatch');
    rebuilt = buildTransition(clone(input));
  } catch (error) {
    errors.push(error.message);
  }
  if (rebuilt && stableStringify(rebuilt) !== stableStringify(receipt)) {
    errors.push('pairwise transition receipt content or digest mismatch');
  }
  return { pass: errors.length === 0, errors, rebuilt };
}

module.exports = {
  RECEIPT_SCHEMA,
  VERSION,
  STATUS,
  NEXT_GATE,
  stableStringify,
  sha256,
  buildTransition,
  verifyTransition
};
