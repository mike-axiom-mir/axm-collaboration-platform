#!/usr/bin/env node
'use strict';

const TransitionLedger = require('../model-shadow-review-challenge-transition-ledger/model-shadow-review-challenge-transition-ledger');

const PRESENTATION_SCHEMA = 'axm.model-shadow-review-challenge-transition-ledger-presentation/v1';
const RECEIPT_SCHEMA = 'axm.model-shadow-review-challenge-transition-reconciliation/v1';
const VERSION = '0.9.0';
const STATUS = 'TEST';
const NEXT_GATE = 'HOST_AUTHENTICATED_MULTI_PARTY_TRANSPARENT_GLOBALLY_CONSISTENT_LOG_OR_PROTECTED_MONOTONIC_STORE';
const DIGEST = /^sha256:[a-f0-9]{64}$/;
const HOLD_PREFIX = 'HOLD_';
const MAX_PRESENTED_ENTRIES = 4096;
const MAX_PRESENTATION_CANONICAL_BYTES = 16 * 1024 * 1024;

function stableStringify(value) {
  return TransitionLedger.stableStringify(value);
}

function copy(value) {
  return JSON.parse(stableStringify(value));
}

function sha256(value) {
  return TransitionLedger.sha256(value);
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

function withoutField(value, field) {
  const result = copy(value);
  delete result[field];
  return result;
}

function entryRef(entry) {
  return { id: entry.entryId, schema: entry.schema, sha256: entry.entryDigest };
}

function transitionRef(entry) {
  return {
    id: entry.transitionReceipt.transitionId,
    schema: entry.transitionReceipt.schema,
    sha256: entry.transitionReceipt.receiptDigest
  };
}

function presentationTruth() {
  return {
    manifestVerifiedByExactRebuild: true,
    everyEntryVerifiedByExactRebuild: true,
    everyUpstreamTransitionPackageVerifiedByExactRebuild: true,
    contiguousPresentedSequenceVerified: true,
    presentedDigestChainVerified: true,
    presentedHeadDerivedFromExactEntries: true,
    callerPackagesProcessedTransiently: true,
    callerPackagesEmbeddedInPresentationReceipt: false,
    callerStateRootRead: false,
    externalRetentionProven: false,
    protectedMonotonicStateProven: false,
    hostAuthorizationAuthenticated: false,
    rawPublicKeyEmbedded: false,
    rawSignatureEmbedded: false,
    privateKeyIngested: false,
    rawModelOutputEmbedded: false,
    privateContextEmbedded: false,
    executionAuthorized: false,
    adoptionAuthorized: false,
    automaticWrite: false,
    automaticPromotion: false,
    automaticCanon: false
  };
}

function reconciliationTruth(classification) {
  const hold = classification.startsWith(HOLD_PREFIX);
  return {
    leftPresentationVerifiedByExactRebuild: true,
    rightPresentationVerifiedByExactRebuild: true,
    everyPresentedUpstreamTransitionVerifiedByExactRebuild: true,
    pairwiseCoPresentationOnly: true,
    exactPresentedHistoryReplayObserved: classification === 'PRESENTED_LOCAL_HISTORIES_EXACT_REPLAY',
    exactPrefixRelationshipObserved: classification === 'LEFT_PRESENTED_HISTORY_IS_EXACT_PREFIX' || classification === 'RIGHT_PRESENTED_HISTORY_IS_EXACT_PREFIX',
    presentedConflictOrContradictionDetected: hold,
    siblingForkAtPresentedSequenceDetected: classification === 'HOLD_SIBLING_FORK_AT_PRESENTED_SEQUENCE',
    entryIdEquivocationDetected: classification === 'HOLD_ENTRY_ID_EQUIVOCATION_AT_PRESENTED_SEQUENCE',
    alternateLocalRecordForSameCandidateDetected: classification === 'HOLD_ALTERNATE_LOCAL_RECORD_FOR_SAME_CANDIDATE_HEAD',
    logIdentityDriftDetected: classification === 'HOLD_LOG_IDENTITY_DRIFT',
    genesisDriftDetected: classification === 'HOLD_GENESIS_DRIFT',
    withheldRootsExcluded: false,
    unpresentedHistoriesExcluded: false,
    thirdRootAbsenceProven: false,
    globalTransitionUniquenessProven: false,
    globallyConsistentTransitionLogProven: false,
    externalTransitionRetentionProven: false,
    protectedMonotonicStateProven: false,
    deletionOrRollbackPrevented: false,
    logAuthorityAuthenticated: false,
    hostAuthorizationAuthenticated: false,
    realWorldControllerIndependenceProven: false,
    actualHumanParticipationProven: false,
    reconciliationTimeExternallyTrusted: false,
    rawPublicKeyEmbedded: false,
    rawSignatureEmbedded: false,
    privateKeyIngested: false,
    rawModelOutputEmbedded: false,
    privateContextEmbedded: false,
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

function validateManifest(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('presented transition ledger manifest must be an object');
  const expected = TransitionLedger.buildManifest(value.logId, value.genesisSeparatedWitnessRef);
  if (stableStringify(expected) !== stableStringify(value)) throw new Error('presented transition ledger manifest does not exact-rebuild');
  return expected;
}

function buildPresentation(input) {
  exactKeys(input, ['presentationId', 'presentedAt', 'manifest', 'items'], 'transition ledger presentation input');
  if (!Array.isArray(input.items)) throw new Error('transition ledger presentation items must be an array');
  if (input.items.length > MAX_PRESENTED_ENTRIES) throw new Error('transition ledger presentation exceeds the bounded entry limit');
  if (Buffer.byteLength(stableStringify(input), 'utf8') > MAX_PRESENTATION_CANONICAL_BYTES) {
    throw new Error('transition ledger presentation exceeds the bounded canonical byte limit');
  }
  const presentationId = exactText(input.presentationId, 'transition ledger presentation id', 180);
  const presentedAt = timestamp(input.presentedAt, 'transition ledger presentation time');
  const manifest = validateManifest(copy(input.manifest));

  let previousEntryRef = null;
  let currentHead = copy(manifest.genesisSeparatedWitnessRef);
  const entries = input.items.map((item, index) => {
    exactKeys(item, ['advanceInput', 'entry'], 'transition ledger presentation item ' + (index + 1));
    const sequence = index + 1;
    const context = { manifest, sequence, previousEntryRef };
    const rebuilt = TransitionLedger.buildEntry(copy(item.advanceInput), context);
    if (stableStringify(rebuilt) !== stableStringify(item.entry)) {
      throw new Error('transition ledger presentation entry ' + sequence + ' does not exact-rebuild from its caller package');
    }
    const validated = TransitionLedger.validateStoredEntry(copy(item.entry), {
      manifest,
      sequence,
      previousEntryRef,
      currentHead
    });
    if (Date.parse(presentedAt) < Date.parse(validated.recordedAt)) {
      throw new Error('transition ledger presentation cannot predate entry ' + sequence);
    }
    const summary = {
      sequence,
      entryRef: entryRef(validated),
      previousEntryRef: validated.previousEntryRef === null ? null : copy(validated.previousEntryRef),
      transitionReceiptRef: transitionRef(validated),
      previousSeparatedWitnessRef: copy(validated.previousSeparatedWitnessRef),
      candidateSeparatedWitnessRef: copy(validated.candidateSeparatedWitnessRef)
    };
    previousEntryRef = copy(summary.entryRef);
    currentHead = copy(summary.candidateSeparatedWitnessRef);
    return summary;
  });

  const presentation = {
    schema: PRESENTATION_SCHEMA,
    version: VERSION,
    presentationId,
    presentedAt,
    status: STATUS,
    manifestRef: {
      id: manifest.logId,
      schema: manifest.schema,
      sha256: manifest.manifestDigest
    },
    logId: manifest.logId,
    genesisSeparatedWitnessRef: copy(manifest.genesisSeparatedWitnessRef),
    entries,
    entryCount: entries.length,
    headSeparatedWitnessRef: currentHead,
    truth: presentationTruth(),
    presentationDigest: null
  };
  presentation.presentationDigest = sha256(withoutField(presentation, 'presentationDigest'));
  return presentation;
}

function verifyPresentation(input, presentation) {
  const errors = [];
  let rebuilt = null;
  try {
    if (!presentation || presentation.schema !== PRESENTATION_SCHEMA) throw new Error('transition ledger presentation schema mismatch');
    rebuilt = buildPresentation(copy(input));
  } catch (error) {
    errors.push(error.message);
  }
  if (rebuilt && stableStringify(rebuilt) !== stableStringify(presentation)) errors.push('transition ledger presentation content or digest mismatch');
  return { pass: errors.length === 0, errors, rebuilt };
}

function exactPresentation(input, presentation, label) {
  const check = verifyPresentation(copy(input), copy(presentation));
  if (!check.pass) throw new Error(label + ' is invalid: ' + check.errors.join('; '));
  return check.rebuilt;
}

function classify(left, right, commonPrefixEntryCount) {
  if (left.logId !== right.logId) return 'HOLD_LOG_IDENTITY_DRIFT';
  if (!sameReference(left.genesisSeparatedWitnessRef, right.genesisSeparatedWitnessRef)) return 'HOLD_GENESIS_DRIFT';
  if (commonPrefixEntryCount === left.entryCount && commonPrefixEntryCount === right.entryCount) {
    return 'PRESENTED_LOCAL_HISTORIES_EXACT_REPLAY';
  }
  if (commonPrefixEntryCount === left.entryCount) return 'LEFT_PRESENTED_HISTORY_IS_EXACT_PREFIX';
  if (commonPrefixEntryCount === right.entryCount) return 'RIGHT_PRESENTED_HISTORY_IS_EXACT_PREFIX';
  const leftEntry = left.entries[commonPrefixEntryCount];
  const rightEntry = right.entries[commonPrefixEntryCount];
  if (sameReference(leftEntry.candidateSeparatedWitnessRef, rightEntry.candidateSeparatedWitnessRef)) {
    return 'HOLD_ALTERNATE_LOCAL_RECORD_FOR_SAME_CANDIDATE_HEAD';
  }
  if (sameIdentity(leftEntry.entryRef, rightEntry.entryRef)) {
    return 'HOLD_ENTRY_ID_EQUIVOCATION_AT_PRESENTED_SEQUENCE';
  }
  return 'HOLD_SIBLING_FORK_AT_PRESENTED_SEQUENCE';
}

function bestAction(classification) {
  const actions = {
    PRESENTED_LOCAL_HISTORIES_EXACT_REPLAY: 'RETAIN_NO_NEW_RECONCILIATION_STATE',
    LEFT_PRESENTED_HISTORY_IS_EXACT_PREFIX: 'PRESERVE_BOTH_PRESENTATIONS_AND_ALLOW_NO_AUTONOMOUS_ADOPTION',
    RIGHT_PRESENTED_HISTORY_IS_EXACT_PREFIX: 'PRESERVE_BOTH_PRESENTATIONS_AND_ALLOW_NO_AUTONOMOUS_ADOPTION',
    HOLD_LOG_IDENTITY_DRIFT: 'PRESERVE_BOTH_LOG_IDENTITIES_AND_REQUEST_STEWARD_DOMAIN_RECONCILIATION',
    HOLD_GENESIS_DRIFT: 'PRESERVE_BOTH_GENESIS_REFERENCES_AND_REQUEST_STEWARD_TRUST_RECONCILIATION',
    HOLD_SIBLING_FORK_AT_PRESENTED_SEQUENCE: 'PRESERVE_BOTH_BRANCHES_AND_REQUEST_STEWARD_FORK_RECONCILIATION',
    HOLD_ENTRY_ID_EQUIVOCATION_AT_PRESENTED_SEQUENCE: 'PRESERVE_BOTH_ENTRY_VERSIONS_AND_REQUEST_STEWARD_EQUIVOCATION_REVIEW',
    HOLD_ALTERNATE_LOCAL_RECORD_FOR_SAME_CANDIDATE_HEAD: 'PRESERVE_BOTH_LOCAL_RECORDS_AND_REQUEST_STEWARD_RECORD_RECONCILIATION'
  };
  return actions[classification];
}

function buildReconciliation(input) {
  exactKeys(input, [
    'reconciliationId', 'reconciledAt',
    'leftPresentationInput', 'leftPresentation',
    'rightPresentationInput', 'rightPresentation'
  ], 'transition reconciliation input');
  const reconciliationId = exactText(input.reconciliationId, 'transition reconciliation id', 180);
  const reconciledAt = timestamp(input.reconciledAt, 'transition reconciliation time');
  const left = exactPresentation(input.leftPresentationInput, input.leftPresentation, 'left transition ledger presentation');
  const right = exactPresentation(input.rightPresentationInput, input.rightPresentation, 'right transition ledger presentation');
  if (Date.parse(reconciledAt) < Date.parse(left.presentedAt) || Date.parse(reconciledAt) < Date.parse(right.presentedAt)) {
    throw new Error('transition reconciliation cannot predate either presentation');
  }

  const sharedLimit = Math.min(left.entryCount, right.entryCount);
  let commonPrefixEntryCount = 0;
  while (commonPrefixEntryCount < sharedLimit &&
         sameReference(left.entries[commonPrefixEntryCount].entryRef, right.entries[commonPrefixEntryCount].entryRef)) {
    commonPrefixEntryCount += 1;
  }
  const classification = classify(left, right, commonPrefixEntryCount);
  const hold = classification.startsWith(HOLD_PREFIX);
  const divergent = commonPrefixEntryCount < left.entryCount && commonPrefixEntryCount < right.entryCount;
  const leftDivergence = divergent ? left.entries[commonPrefixEntryCount] : null;
  const rightDivergence = divergent ? right.entries[commonPrefixEntryCount] : null;
  const divergence = divergent ? {
    sequence: commonPrefixEntryCount + 1,
    leftEntryRef: copy(leftDivergence.entryRef),
    rightEntryRef: copy(rightDivergence.entryRef),
    leftCandidateSeparatedWitnessRef: copy(leftDivergence.candidateSeparatedWitnessRef),
    rightCandidateSeparatedWitnessRef: copy(rightDivergence.candidateSeparatedWitnessRef)
  } : null;

  const receipt = {
    schema: RECEIPT_SCHEMA,
    version: VERSION,
    reconciliationId,
    reconciledAt,
    status: STATUS,
    leftPresentationRef: {
      id: left.presentationId,
      schema: left.schema,
      sha256: left.presentationDigest
    },
    rightPresentationRef: {
      id: right.presentationId,
      schema: right.schema,
      sha256: right.presentationDigest
    },
    domain: {
      leftLogId: left.logId,
      rightLogId: right.logId,
      logIdentityMatches: left.logId === right.logId,
      genesisMatches: sameReference(left.genesisSeparatedWitnessRef, right.genesisSeparatedWitnessRef)
    },
    comparison: {
      leftEntryCount: left.entryCount,
      rightEntryCount: right.entryCount,
      commonPrefixEntryCount,
      divergence
    },
    decision: {
      classification,
      pairwiseConsistency: hold ? 'CONTRADICTION' : classification === 'PRESENTED_LOCAL_HISTORIES_EXACT_REPLAY' ? 'CONSISTENT_REPLAY' : 'CONSISTENT_PREFIX',
      reviewRequired: hold,
      bestAction: bestAction(classification),
      autonomousActionCount: 0
    },
    state: 'TWO_EXACT_PRESENTED_LOCAL_HISTORIES_RECONCILED_WITHHELD_ROOTS_NOT_EXCLUDED',
    nextGate: NEXT_GATE,
    truth: reconciliationTruth(classification),
    receiptDigest: null
  };
  receipt.receiptDigest = sha256(withoutField(receipt, 'receiptDigest'));
  return receipt;
}

function verifyReconciliation(input, receipt) {
  const errors = [];
  let rebuilt = null;
  try {
    if (!receipt || receipt.schema !== RECEIPT_SCHEMA) throw new Error('transition reconciliation receipt schema mismatch');
    rebuilt = buildReconciliation(copy(input));
  } catch (error) {
    errors.push(error.message);
  }
  if (rebuilt && stableStringify(rebuilt) !== stableStringify(receipt)) errors.push('transition reconciliation receipt content or digest mismatch');
  return { pass: errors.length === 0, errors, rebuilt };
}

module.exports = {
  PRESENTATION_SCHEMA,
  RECEIPT_SCHEMA,
  VERSION,
  STATUS,
  NEXT_GATE,
  MAX_PRESENTED_ENTRIES,
  MAX_PRESENTATION_CANONICAL_BYTES,
  stableStringify,
  sha256,
  buildPresentation,
  verifyPresentation,
  buildReconciliation,
  verifyReconciliation
};
