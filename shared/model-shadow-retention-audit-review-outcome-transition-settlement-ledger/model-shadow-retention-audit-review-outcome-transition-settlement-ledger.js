#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const V36 = require('../model-shadow-retention-audit-review-outcome-history-checkpoint-anchor-pairwise-ledger/model-shadow-retention-audit-review-outcome-history-checkpoint-anchor-pairwise-ledger');

const MANIFEST_SCHEMA = 'axm.model-shadow-retention-audit-review-outcome-transition-settlement-ledger-manifest/v1';
const PROPOSAL_SCHEMA = 'axm.model-shadow-retention-audit-review-outcome-transition-settlement-ledger-proposal/v1';
const SETTLEMENT_SCHEMA = 'axm.model-shadow-retention-audit-review-outcome-transition-settlement-ledger-settlement/v1';
const SNAPSHOT_SCHEMA = 'axm.model-shadow-retention-audit-review-outcome-transition-settlement-ledger-snapshot/v1';
const VERSION = '3.7.0';
const STATUS = 'TEST';
const NAMESPACE = 'model-shadow-retention-audit-review-outcome-transition-settlement-ledger';
const MANIFEST_FILE = 'ledger.json';
const PROPOSALS_DIRECTORY = 'proposals';
const SETTLEMENTS_DIRECTORY = 'settlements';
const LOCK_FILE = '.operation.lock';
const PROPOSE_CONFIRMATION = 'PROPOSE EXACT V36 FORWARD ENTRY FOR SEPARATE LOCAL SETTLEMENT';
const SETTLE_CONFIRMATION = 'SETTLE EXACT PENDING V36 FORWARD ENTRY ONCE';
const AUTHORITY_ORIGIN = 'CALLER_OWNED_DISTINCT_LOCAL_ROOTS_AND_CONFIRMATIONS_UNAUTHENTICATED';
const STORAGE_MODE = 'EXACT_V36_PERSISTED_ENTRY_REFERENCE_THEN_SEPARATE_LOCAL_SETTLEMENT';
const PROPOSAL_STATE = 'PENDING_SEPARATE_LOCAL_SETTLEMENT_SOURCE_EXACT_AT_PROPOSAL_OBSERVATION_ONLY';
const SETTLED_STATE = 'LOCAL_SETTLED_HEAD_ADVANCED_FROM_EXACT_V36_ENTRY_GLOBALITY_RETENTION_AND_AUTHORITY_NOT_PROVEN';
const HELD_STATE = 'LOCAL_SETTLEMENT_HELD_AND_PREVIOUS_SETTLED_HEAD_PRESERVED';
const PROPOSAL_NEXT_GATE = 'SEPARATE_EXACT_SETTLEMENT_CONFIRMATION_AND_SOURCE_RECHECK';
const SETTLEMENT_NEXT_GATE = 'HOST_AUTHENTICATED_EXTERNALLY_RETAINED_GLOBALLY_CONSISTENT_LOG_OR_PROTECTED_MONOTONIC_STORE';
const SOURCE_OBSERVATIONS = Object.freeze([
  'EXACT_ENTRY_PRESENT',
  'SOURCE_ABSENT',
  'SOURCE_INVALID',
  'SOURCE_CHANGED_DURING_CHECK',
  'ENTRY_NOT_EXACT_OR_PRESENT'
]);
const SOURCE_CAPTURE_STATES = Object.freeze(['PRESENT', 'ABSENT', 'INVALID']);
const SETTLEMENT_CLASSIFICATIONS = Object.freeze([
  'SETTLED_EXACT_SOURCE_ENTRY_PRESENT',
  'HELD_SOURCE_ABSENT',
  'HELD_SOURCE_INVALID',
  'HELD_SOURCE_CHANGED_DURING_CHECK',
  'HELD_ENTRY_NOT_EXACT_OR_PRESENT'
]);
const MAX_INPUT_CANONICAL_BYTES = 140 * 1024 * 1024;
const MAX_ARTIFACT_CANONICAL_BYTES = 2 * 1024 * 1024;
const MAX_LEDGER_BYTES = 256 * 1024 * 1024;
const MAX_RECORDS = 10000;
const DIGEST = /^sha256:[a-f0-9]{64}$/;
const RECORD_FILE = /^([0-9]{12})\.json$/;

class TransitionSettlementLedgerError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'TransitionSettlementLedgerError';
    this.code = code;
  }
}

function stableStringify(value) { return V36.stableStringify(value); }
function clone(value) { return JSON.parse(stableStringify(value)); }
function sha256(value) { return V36.sha256(value); }
function fail(code, message) { throw new TransitionSettlementLedgerError(code, message); }
function same(left, right) { return stableStringify(left) === stableStringify(right); }
function withoutField(value, field) { const result = clone(value); delete result[field]; return result; }
function manifestDigest(value) { return sha256(withoutField(value, 'manifestDigest')); }
function proposalDigest(value) { return sha256(withoutField(value, 'proposalDigest')); }
function settlementDigest(value) { return sha256(withoutField(value, 'settlementDigest')); }
function snapshotDigest(value) { return sha256(withoutField(value, 'snapshotDigest')); }

function exactKeys(value, allowed, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail('INVALID_INPUT', label + ' must be an object');
  const extras = Object.keys(value).filter(key => !allowed.includes(key));
  const missing = allowed.filter(key => !Object.prototype.hasOwnProperty.call(value, key));
  if (extras.length) fail('INVALID_INPUT', label + ' has unknown fields: ' + extras.sort().join(', '));
  if (missing.length) fail('INVALID_INPUT', label + ' is missing fields: ' + missing.sort().join(', '));
}

function bound(value, maximum, code, label) {
  let bytes;
  try { bytes = Buffer.byteLength(stableStringify(value), 'utf8'); }
  catch (error) { fail(code || 'INVALID_INPUT', label + ' is not canonical JSON data'); }
  if (bytes > maximum) fail(code || 'ARTIFACT_TOO_LARGE', label + ' exceeds the bounded canonical byte limit');
  return bytes;
}

function text(value, label, maximum) {
  if (typeof value !== 'string' || !value || value !== value.trim()) fail('INVALID_INPUT', label + ' must be exact non-empty text');
  if (maximum && value.length > maximum) fail('INVALID_INPUT', label + ' is too long');
  return value;
}

function timestamp(value, label) {
  const result = text(value, label, 64);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(result) || Number.isNaN(Date.parse(result))) {
    fail('INVALID_INPUT', label + ' must be an exact UTC timestamp');
  }
  return result;
}

function digest(value, label) {
  const result = text(value, label, 71);
  if (!DIGEST.test(result)) fail('INVALID_INPUT', label + ' must be an exact SHA-256 digest');
  return result;
}

function integer(value, label, minimum, maximum) {
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) fail('INVALID_INPUT', label + ' is outside its safe integer bounds');
  return value;
}

function boolean(value, label) {
  if (typeof value !== 'boolean') fail('INVALID_INPUT', label + ' must be boolean');
  return value;
}

function reference(value, label, expectedSchema) {
  exactKeys(value, ['id', 'schema', 'sha256'], label);
  const result = {
    id: text(value.id, label + '.id', 180),
    schema: text(value.schema, label + '.schema', 180),
    sha256: digest(value.sha256, label + '.sha256')
  };
  if (expectedSchema && result.schema !== expectedSchema) fail('INVALID_INPUT', label + ' schema mismatch');
  return result;
}

function identity(value, label) {
  exactKeys(value, ['id', 'schema'], label);
  return { id: text(value.id, label + '.id', 180), schema: text(value.schema, label + '.schema', 180) };
}

function nullableReference(value, label, expectedSchema) { return value === null ? null : reference(value, label, expectedSchema); }
function sameReference(left, right) { return left.id === right.id && left.schema === right.schema && left.sha256 === right.sha256; }
function manifestRef(value) { return { id: value.settlementLogId, schema: value.schema, sha256: value.manifestDigest }; }
function proposalRef(value) { return { id: value.proposalId, schema: value.schema, sha256: value.proposalDigest }; }
function settlementRef(value) { return { id: value.settlementId, schema: value.schema, sha256: value.settlementDigest }; }
function sourceEntryRef(value) { return { id: value.entryId, schema: value.schema, sha256: value.entryDigest }; }
function sourceSnapshotRef(value) { return { id: value.logId, schema: value.schema, sha256: value.snapshotDigest }; }
function head(anchoredCheckpointRef, checkpointRef, anchorEpoch) {
  return { anchoredCheckpointRef: clone(anchoredCheckpointRef), checkpointRef: clone(checkpointRef), anchorEpoch };
}
function validateHead(value, label) {
  exactKeys(value, ['anchoredCheckpointRef', 'checkpointRef', 'anchorEpoch'], label);
  return head(
    reference(value.anchoredCheckpointRef, label + '.anchoredCheckpointRef'),
    reference(value.checkpointRef, label + '.checkpointRef'),
    integer(value.anchorEpoch, label + '.anchorEpoch', 1, Number.MAX_SAFE_INTEGER)
  );
}
function sameHead(left, right) {
  return sameReference(left.anchoredCheckpointRef, right.anchoredCheckpointRef) &&
    sameReference(left.checkpointRef, right.checkpointRef) && left.anchorEpoch === right.anchorEpoch;
}

function sourceEntryTruth() {
  return {
    transitionReceiptVerifiedByExactRebuildBeforeWrite: true,
    forwardPairwiseHistoryExtensionRequired: true,
    exactPreviousAnchoredPackageHeadMatchedBeforeWrite: true,
    exactPreviousCheckpointHeadMatchedBeforeWrite: true,
    exactPreviousAnchorEpochMatchedBeforeWrite: true,
    pinnedAnchorPolicyIdentityAndProfileMatchedBeforeWrite: true,
    pinnedWitnessPolicyIdentityAndProfileMatchedBeforeWrite: true,
    explicitConfirmationRequired: true,
    localManifestVerified: true,
    successfulRecordReturnRequiresExclusiveSequenceEntryCreate: true,
    successfulRecordReturnRequiresEntryFileFsync: true,
    successfulRecordReturnRequiresPostwriteLocalChainReload: true,
    writeAndReloadCompletionPersistedSeparately: false,
    localHeadAdvancedWhileThisLedgerRootIsPreserved: true,
    persistedMinimizedV35Receipt: true,
    persistedRawV34Packages: false,
    callerPackageRequiredForUpstreamExactRebuild: true,
    upstreamPackagesReverifiedAfterReloadWithoutCallerInput: false,
    independentLedgerRootsExcluded: false,
    withheldBranchesExcluded: false,
    samePreviousAcceptedByAnotherRootExcluded: false,
    globalTransitionUniquenessProven: false,
    globallyConsistentLogProven: false,
    externalRetentionProven: false,
    protectedMonotonicStateProven: false,
    deletionOrRollbackPrevented: false,
    fileFsyncProvesDirectoryOrHardwareDurability: false,
    ledgerAuthorityAuthenticated: false,
    hostAuthorizationAuthenticated: false,
    actorRealWorldIdentityProven: false,
    actualHumanParticipationProven: false,
    recordingTimeExternallyTrusted: false,
    rawPublicKeyEmbedded: false,
    rawSignatureEmbedded: false,
    privateKeyIngested: false,
    sourceOrLedgerPathEmbedded: false,
    rawReviewMaterialEmbedded: false,
    rawModelOutputEmbedded: false,
    privateContextEmbedded: false,
    providerInvoked: false,
    experimentExecuted: false,
    evaluationPerformed: false,
    retentionHoldResolved: false,
    executionAuthorized: false,
    adoptionAuthorized: false,
    humanBenefitProven: false,
    broadLearningClaimed: false,
    automaticPermissionGrant: false,
    automaticInstall: false,
    automaticPromotion: false,
    automaticMerge: false,
    automaticCanon: false,
    foundationMutation: false
  };
}

function sourceSnapshotTruth() {
  return {
    manifestVerified: true,
    contiguousEntrySequenceValidated: true,
    localDigestChainValidated: true,
    storedTransitionReceiptSelfDigestsValidated: true,
    pinnedPolicyContinuityValidatedAcrossEntries: true,
    exactAnchoredCheckpointAndEpochHeadDerivedFromEntries: true,
    upstreamPackagesReverifiedWithoutCallerInput: false,
    independentLedgerRootsExcluded: false,
    withheldBranchesExcluded: false,
    globalTransitionUniquenessProven: false,
    globallyConsistentLogProven: false,
    externalRetentionProven: false,
    protectedMonotonicStateProven: false,
    deletionOrRollbackPrevented: false,
    hostAuthorizationAuthenticated: false,
    executionAuthorized: false,
    adoptionAuthorized: false,
    automaticPromotion: false,
    automaticCanon: false
  };
}

function proposalTruth() {
  return {
    sourceEntryVerifiedPersistedByExactV36RebuildBeforeProposal: true,
    equalBracketingSourceSnapshotsObservedBeforeProposal: true,
    sourceEntryPreviousHeadMatchedCurrentSettledHead: true,
    sourceManifestAndPolicyProfilesPinned: true,
    distinctNonnestedCallerOwnedRootsChecked: true,
    explicitProposalConfirmationRequired: true,
    proposalDoesNotAdvanceSettledHead: true,
    successfulProposeReturnRequiresExclusiveProposalCreate: true,
    successfulProposeReturnRequiresProposalFileFsync: true,
    successfulProposeReturnRequiresPostwriteLocalReload: true,
    writeAndReloadCompletionPersistedSeparately: false,
    sourceObservationAtomicWithProposalWrite: false,
    transientSourceChangeAndReversionExcluded: false,
    sourceMayChangeAfterFinalObservation: true,
    sourceEntryPackagePersisted: false,
    sourceEntryReferencePersisted: true,
    independentRootsExcluded: false,
    globalTransitionUniquenessProven: false,
    globallyConsistentLogProven: false,
    externalRetentionProven: false,
    protectedMonotonicStateProven: false,
    deletionOrRollbackPrevented: false,
    fileFsyncProvesDirectoryOrHardwareDurability: false,
    hostAuthorizationAuthenticated: false,
    actorRealWorldIdentityProven: false,
    actualHumanParticipationProven: false,
    callerTimeExternallyTrusted: false,
    executionAuthorized: false,
    adoptionAuthorized: false,
    humanBenefitProven: false,
    broadLearningClaimed: false,
    providerInvoked: false,
    experimentExecuted: false,
    evaluationPerformed: false,
    automaticInstall: false,
    automaticPromotion: false,
    automaticMerge: false,
    automaticCanon: false,
    foundationMutation: false
  };
}

function settlementTruth(observation) {
  const exact = observation.classification === 'EXACT_ENTRY_PRESENT';
  return {
    pendingProposalExactRebuiltFromCallerPackageAndStoredReceipt: true,
    separateSettlementConfirmationRequired: true,
    sourceEntryRecheckedByExactV36PersistedVerificationBeforeWrite: observation.entryPersistedExactRebuild,
    equalBracketingSourceSnapshotsObservedBeforeSettlementWrite: observation.equalBracketingSnapshots,
    settledHeadAdvancedForThisReceipt: exact,
    heldSettlementPreservesPreviousSettledHead: !exact,
    successfulSettleReturnRequiresExclusiveSettlementCreate: true,
    successfulSettleReturnRequiresSettlementFileFsync: true,
    successfulSettleReturnRequiresPostwriteLocalReload: true,
    writeAndReloadCompletionPersistedSeparately: false,
    settlementObservationAtomicWithSettlementWrite: false,
    transientSourceChangeAndReversionExcluded: false,
    sourceMayChangeAfterFinalObservation: true,
    postwriteSourceCurrentnessProven: false,
    resultingSettledHeadAuthorityIsLocalOnly: true,
    independentRootsExcluded: false,
    withheldBranchesExcluded: false,
    globalTransitionUniquenessProven: false,
    globallyConsistentLogProven: false,
    externalRetentionProven: false,
    protectedMonotonicStateProven: false,
    deletionOrRollbackPrevented: false,
    fileFsyncProvesDirectoryOrHardwareDurability: false,
    hostAuthorizationAuthenticated: false,
    actorRealWorldIdentityProven: false,
    actualHumanParticipationProven: false,
    callerTimeExternallyTrusted: false,
    executionAuthorized: false,
    adoptionAuthorized: false,
    humanBenefitProven: false,
    broadLearningClaimed: false,
    providerInvoked: false,
    experimentExecuted: false,
    evaluationPerformed: false,
    automaticInstall: false,
    automaticPromotion: false,
    automaticMerge: false,
    automaticCanon: false,
    foundationMutation: false
  };
}

function localSnapshotTruth() {
  return {
    manifestVerified: true,
    contiguousProposalAndSettlementSequencesValidated: true,
    localProposalDigestChainAndSettlementBindingsValidated: true,
    atMostOneTrailingPendingProposalValidated: true,
    settledHeadDerivedOnlyFromExactSettlements: true,
    heldSettlementsPreservePriorSettledHead: true,
    liveSourceRecapturedByInspect: false,
    upstreamPackagesReverifiedWithoutCallerInput: false,
    independentRootsExcluded: false,
    globalTransitionUniquenessProven: false,
    globallyConsistentLogProven: false,
    externalRetentionProven: false,
    protectedMonotonicStateProven: false,
    deletionOrRollbackPrevented: false,
    hostAuthorizationAuthenticated: false,
    executionAuthorized: false,
    adoptionAuthorized: false,
    automaticPromotion: false,
    automaticCanon: false
  };
}

function validateSourceSnapshot(value, expected) {
  const snapshot = clone(value);
  exactKeys(snapshot, [
    'schema', 'version', 'status', 'logId', 'manifestRef', 'genesisAnchoredCheckpointRef', 'genesisCheckpointRef', 'genesisAnchorEpoch',
    'currentAnchoredCheckpointRef', 'currentCheckpointRef', 'currentAnchorEpoch', 'anchorPolicyIdentity', 'anchorProfileDigest',
    'witnessPolicyIdentity', 'witnessProfileDigest', 'entryCount', 'lastEntryRef', 'truth', 'snapshotDigest'
  ], 'v3.6 source snapshot');
  if (snapshot.schema !== V36.SNAPSHOT_SCHEMA || snapshot.version !== V36.VERSION || snapshot.status !== V36.STATUS) fail('SOURCE_SNAPSHOT_INVALID', 'v3.6 source snapshot identity mismatch');
  if (text(snapshot.logId, 'v3.6 source log id', 180) !== expected.logId) fail('SOURCE_SNAPSHOT_INVALID', 'v3.6 source log id mismatch');
  reference(snapshot.manifestRef, 'v3.6 source manifest reference', V36.MANIFEST_SCHEMA);
  const genesisAnchored = reference(snapshot.genesisAnchoredCheckpointRef, 'v3.6 source genesis anchored reference');
  const genesisCheckpoint = reference(snapshot.genesisCheckpointRef, 'v3.6 source genesis checkpoint reference');
  const genesisEpoch = integer(snapshot.genesisAnchorEpoch, 'v3.6 source genesis epoch', 1, Number.MAX_SAFE_INTEGER);
  if (!sameReference(genesisAnchored, expected.genesisAnchoredCheckpointRef) || !sameReference(genesisCheckpoint, expected.genesisCheckpointRef) || genesisEpoch !== expected.genesisAnchorEpoch) {
    fail('SOURCE_SNAPSHOT_INVALID', 'v3.6 source genesis mismatch');
  }
  reference(snapshot.currentAnchoredCheckpointRef, 'v3.6 source current anchored reference');
  reference(snapshot.currentCheckpointRef, 'v3.6 source current checkpoint reference');
  integer(snapshot.currentAnchorEpoch, 'v3.6 source current epoch', 1, Number.MAX_SAFE_INTEGER);
  identity(snapshot.anchorPolicyIdentity, 'v3.6 source anchor policy identity');
  digest(snapshot.anchorProfileDigest, 'v3.6 source anchor profile digest');
  identity(snapshot.witnessPolicyIdentity, 'v3.6 source witness policy identity');
  digest(snapshot.witnessProfileDigest, 'v3.6 source witness profile digest');
  const count = integer(snapshot.entryCount, 'v3.6 source entry count', 0, V36.MAX_ENTRIES);
  const last = nullableReference(snapshot.lastEntryRef, 'v3.6 source last entry reference', V36.ENTRY_SCHEMA);
  if (count === 0 ? last !== null : last === null) fail('SOURCE_SNAPSHOT_INVALID', 'v3.6 source entry count and last entry reference disagree');
  if (!same(snapshot.truth, sourceSnapshotTruth())) fail('SOURCE_SNAPSHOT_INVALID', 'v3.6 source snapshot truth boundary mismatch');
  if (digest(snapshot.snapshotDigest, 'v3.6 source snapshot digest') !== snapshotDigest(snapshot)) fail('SOURCE_SNAPSHOT_INVALID', 'v3.6 source snapshot digest mismatch');
  return snapshot;
}

function sourceEntryView(value, expected) {
  const entry = clone(value);
  exactKeys(entry, [
    'schema', 'version', 'status', 'entryId', 'recordedAt', 'log', 'manifestRef', 'previousEntryRef', 'transitionReceipt',
    'previousAnchoredCheckpointRef', 'candidateAnchoredCheckpointRef', 'previousCheckpointRef', 'candidateCheckpointRef',
    'previousAnchorEpoch', 'candidateAnchorEpoch', 'state', 'nextGate', 'truth', 'entryDigest'
  ], 'v3.6 source entry');
  if (entry.schema !== V36.ENTRY_SCHEMA || entry.version !== V36.VERSION || entry.status !== V36.STATUS) fail('SOURCE_ENTRY_INVALID', 'v3.6 source entry identity mismatch');
  text(entry.entryId, 'v3.6 source entry id', 180);
  timestamp(entry.recordedAt, 'v3.6 source entry recordedAt');
  exactKeys(entry.log, ['logId', 'authorityOrigin', 'storageMode', 'sequence'], 'v3.6 source entry log');
  if (entry.log.logId !== expected.logId || entry.log.authorityOrigin !== V36.AUTHORITY_ORIGIN || entry.log.storageMode !== V36.STORAGE_MODE) fail('SOURCE_ENTRY_INVALID', 'v3.6 source entry log binding mismatch');
  integer(entry.log.sequence, 'v3.6 source entry sequence', 1, V36.MAX_ENTRIES);
  reference(entry.manifestRef, 'v3.6 source entry manifest reference', V36.MANIFEST_SCHEMA);
  nullableReference(entry.previousEntryRef, 'v3.6 source previous entry reference', V36.ENTRY_SCHEMA);
  let transition;
  try { transition = V36.validateStoredTransition(entry.transitionReceipt); }
  catch (error) { fail('SOURCE_ENTRY_INVALID', 'v3.6 source transition receipt is invalid'); }
  const previousAnchored = reference(entry.previousAnchoredCheckpointRef, 'v3.6 source previous anchored reference');
  const candidateAnchored = reference(entry.candidateAnchoredCheckpointRef, 'v3.6 source candidate anchored reference');
  const previousCheckpoint = reference(entry.previousCheckpointRef, 'v3.6 source previous checkpoint reference');
  const candidateCheckpoint = reference(entry.candidateCheckpointRef, 'v3.6 source candidate checkpoint reference');
  const previousEpoch = integer(entry.previousAnchorEpoch, 'v3.6 source previous epoch', 1, Number.MAX_SAFE_INTEGER);
  const candidateEpoch = integer(entry.candidateAnchorEpoch, 'v3.6 source candidate epoch', 2, Number.MAX_SAFE_INTEGER);
  if (!sameReference(previousAnchored, transition.previousAnchored) || !sameReference(candidateAnchored, transition.candidateAnchored) ||
      !sameReference(previousCheckpoint, transition.previousCheckpoint) || !sameReference(candidateCheckpoint, transition.candidateCheckpoint) ||
      previousEpoch !== transition.previousEpoch || candidateEpoch !== transition.candidateEpoch) {
    fail('SOURCE_ENTRY_INVALID', 'v3.6 source entry and transition head binding mismatch');
  }
  if (entry.state !== 'LOCAL_FORWARD_ANCHORED_HISTORY_TRANSITION_RECORDED_RELATIVE_TO_ONE_CALLER_ROOT_GLOBALITY_RETENTION_AND_AUTHORITY_NOT_PROVEN' ||
      entry.nextGate !== V36.NEXT_GATE || !same(entry.truth, sourceEntryTruth())) fail('SOURCE_ENTRY_INVALID', 'v3.6 source entry state or truth boundary mismatch');
  if (digest(entry.entryDigest, 'v3.6 source entry digest') !== sha256(withoutField(entry, 'entryDigest'))) fail('SOURCE_ENTRY_INVALID', 'v3.6 source entry digest mismatch');
  return {
    entry,
    ref: sourceEntryRef(entry),
    manifestRef: reference(entry.manifestRef, 'v3.6 source entry manifest reference', V36.MANIFEST_SCHEMA),
    sequence: entry.log.sequence,
    recordedAt: entry.recordedAt,
    previousHead: head(previousAnchored, previousCheckpoint, previousEpoch),
    candidateHead: head(candidateAnchored, candidateCheckpoint, candidateEpoch)
  };
}

function snapshotSummary(snapshot) {
  if (snapshot === null) return { ref: null, entryCount: null };
  return { ref: sourceSnapshotRef(snapshot), entryCount: snapshot.entryCount };
}

function validateObservation(value) {
  const observation = clone(value);
  exactKeys(observation, ['classification', 'beforeCaptureState', 'afterCaptureState', 'beforeSnapshotRef', 'afterSnapshotRef', 'beforeEntryCount', 'afterEntryCount', 'entryPersistedExactRebuild', 'equalBracketingSnapshots'], 'source observation');
  if (!SOURCE_OBSERVATIONS.includes(observation.classification)) fail('INVALID_INPUT', 'source observation classification is invalid');
  if (!SOURCE_CAPTURE_STATES.includes(observation.beforeCaptureState) || !SOURCE_CAPTURE_STATES.includes(observation.afterCaptureState)) fail('INVALID_INPUT', 'source observation capture state is invalid');
  const beforeRef = nullableReference(observation.beforeSnapshotRef, 'source observation before snapshot reference', V36.SNAPSHOT_SCHEMA);
  const afterRef = nullableReference(observation.afterSnapshotRef, 'source observation after snapshot reference', V36.SNAPSHOT_SCHEMA);
  const beforeCount = observation.beforeEntryCount === null ? null : integer(observation.beforeEntryCount, 'source observation before entry count', 0, V36.MAX_ENTRIES);
  const afterCount = observation.afterEntryCount === null ? null : integer(observation.afterEntryCount, 'source observation after entry count', 0, V36.MAX_ENTRIES);
  const verified = boolean(observation.entryPersistedExactRebuild, 'source observation entry verification');
  const equalSnapshots = boolean(observation.equalBracketingSnapshots, 'source observation equal snapshots');
  if ((beforeRef === null) !== (beforeCount === null) || (afterRef === null) !== (afterCount === null)) fail('INVALID_INPUT', 'source observation snapshot reference and count presence disagree');
  if ((observation.beforeCaptureState === 'PRESENT') !== (beforeRef !== null) || (observation.afterCaptureState === 'PRESENT') !== (afterRef !== null)) fail('INVALID_INPUT', 'source observation capture state and snapshot presence disagree');
  const derivedEqualSnapshots = observation.beforeCaptureState === 'PRESENT' && observation.afterCaptureState === 'PRESENT' && sameReference(beforeRef, afterRef) && beforeCount === afterCount;
  if (equalSnapshots !== derivedEqualSnapshots) fail('INVALID_INPUT', 'source observation bracketing equality does not match snapshot summaries');
  let derivedClassification;
  if (observation.beforeCaptureState === 'INVALID' || observation.afterCaptureState === 'INVALID') derivedClassification = 'SOURCE_INVALID';
  else if (observation.beforeCaptureState !== observation.afterCaptureState || (observation.beforeCaptureState === 'PRESENT' && !derivedEqualSnapshots)) derivedClassification = 'SOURCE_CHANGED_DURING_CHECK';
  else if (observation.beforeCaptureState === 'ABSENT') derivedClassification = 'SOURCE_ABSENT';
  else derivedClassification = verified ? 'EXACT_ENTRY_PRESENT' : 'ENTRY_NOT_EXACT_OR_PRESENT';
  if (observation.classification !== derivedClassification) fail('INVALID_INPUT', 'source observation classification does not match capture states and independent verification facts');
  return observation;
}

function validateEvidence(value, expected) {
  const evidence = clone(value);
  exactKeys(evidence, ['beforeSnapshot', 'afterSnapshot', 'observation'], 'source evidence');
  const before = evidence.beforeSnapshot === null ? null : validateSourceSnapshot(evidence.beforeSnapshot, expected);
  const after = evidence.afterSnapshot === null ? null : validateSourceSnapshot(evidence.afterSnapshot, expected);
  const observation = validateObservation(evidence.observation);
  const beforeSummary = snapshotSummary(before);
  const afterSummary = snapshotSummary(after);
  if (!same(beforeSummary.ref, observation.beforeSnapshotRef) || beforeSummary.entryCount !== observation.beforeEntryCount ||
      !same(afterSummary.ref, observation.afterSnapshotRef) || afterSummary.entryCount !== observation.afterEntryCount) {
    fail('INVALID_INPUT', 'source evidence snapshots do not match their observation summary');
  }
  return { beforeSnapshot: before, afterSnapshot: after, observation };
}

function captureSource(sourceService, expected) {
  try {
    const snapshot = sourceService.inspect();
    return snapshot === null ? { kind: 'ABSENT', snapshot: null } : { kind: 'PRESENT', snapshot: validateSourceSnapshot(snapshot, expected) };
  } catch (error) {
    return { kind: 'INVALID', snapshot: null };
  }
}

function observeSource(sourceService, expected, input, receipt) {
  const before = captureSource(sourceService, expected);
  let verificationPass = false;
  try { verificationPass = sourceService.verifyPersisted(input, receipt).pass === true; }
  catch (error) { verificationPass = false; }
  const after = captureSource(sourceService, expected);
  let classification;
  const equalSnapshots = before.kind === 'PRESENT' && after.kind === 'PRESENT' && same(before.snapshot, after.snapshot);
  if (before.kind === 'INVALID' || after.kind === 'INVALID') classification = 'SOURCE_INVALID';
  else if (before.kind !== after.kind || (before.kind === 'PRESENT' && !equalSnapshots)) classification = 'SOURCE_CHANGED_DURING_CHECK';
  else if (before.kind === 'ABSENT') classification = 'SOURCE_ABSENT';
  else if (verificationPass) classification = 'EXACT_ENTRY_PRESENT';
  else classification = 'ENTRY_NOT_EXACT_OR_PRESENT';
  const beforeSummary = snapshotSummary(before.snapshot);
  const afterSummary = snapshotSummary(after.snapshot);
  const observation = validateObservation({
    classification,
    beforeCaptureState: before.kind,
    afterCaptureState: after.kind,
    beforeSnapshotRef: beforeSummary.ref,
    afterSnapshotRef: afterSummary.ref,
    beforeEntryCount: beforeSummary.entryCount,
    afterEntryCount: afterSummary.entryCount,
    entryPersistedExactRebuild: verificationPass,
    equalBracketingSnapshots: equalSnapshots
  });
  return { beforeSnapshot: before.snapshot, afterSnapshot: after.snapshot, observation };
}

function validateProposalInput(value) {
  bound(value, MAX_INPUT_CANONICAL_BYTES, 'INPUT_TOO_LARGE', 'transition settlement proposal input');
  const input = clone(value);
  exactKeys(input, ['proposalId', 'proposedAt', 'confirmation', 'sourceRecordInput', 'sourceEntry'], 'transition settlement proposal input');
  const proposalId = text(input.proposalId, 'proposal id', 180);
  const proposedAt = timestamp(input.proposedAt, 'proposal time');
  if (input.confirmation !== PROPOSE_CONFIRMATION) fail('PROPOSAL_CONFIRMATION_REQUIRED', 'exact proposal confirmation is required');
  const sourceEntry = sourceEntryView(input.sourceEntry, { logId: input.sourceEntry && input.sourceEntry.log && input.sourceEntry.log.logId });
  if (Date.parse(proposedAt) < Date.parse(sourceEntry.recordedAt)) fail('PROPOSAL_TIME_INVALID', 'proposal time cannot predate the source entry recording time');
  return { input, proposalId, proposedAt, sourceEntry };
}

function validateSettlementInput(value) {
  bound(value, MAX_INPUT_CANONICAL_BYTES, 'INPUT_TOO_LARGE', 'transition settlement input');
  const input = clone(value);
  exactKeys(input, ['settlementId', 'settledAt', 'confirmation', 'proposalInput', 'proposalEvidence', 'proposalReceipt'], 'transition settlement input');
  const settlementId = text(input.settlementId, 'settlement id', 180);
  const settledAt = timestamp(input.settledAt, 'settlement time');
  if (input.confirmation !== SETTLE_CONFIRMATION) fail('SETTLEMENT_CONFIRMATION_REQUIRED', 'exact settlement confirmation is required');
  return { input, settlementId, settledAt };
}

function buildManifest(settlementLogId, sourceExpected, sourceSnapshot) {
  const snapshot = validateSourceSnapshot(sourceSnapshot, sourceExpected);
  const manifest = {
    schema: MANIFEST_SCHEMA,
    version: VERSION,
    status: STATUS,
    settlementLogId,
    sourceLogId: snapshot.logId,
    sourceManifestRef: clone(snapshot.manifestRef),
    sourceGenesisAnchoredCheckpointRef: clone(snapshot.genesisAnchoredCheckpointRef),
    sourceGenesisCheckpointRef: clone(snapshot.genesisCheckpointRef),
    sourceGenesisAnchorEpoch: snapshot.genesisAnchorEpoch,
    sourceAnchorPolicyIdentity: clone(snapshot.anchorPolicyIdentity),
    sourceAnchorProfileDigest: snapshot.anchorProfileDigest,
    sourceWitnessPolicyIdentity: clone(snapshot.witnessPolicyIdentity),
    sourceWitnessProfileDigest: snapshot.witnessProfileDigest,
    authorityOrigin: AUTHORITY_ORIGIN,
    storageMode: STORAGE_MODE,
    manifestDigest: null
  };
  manifest.manifestDigest = manifestDigest(manifest);
  bound(manifest, MAX_ARTIFACT_CANONICAL_BYTES, 'ARTIFACT_TOO_LARGE', 'transition settlement manifest');
  return manifest;
}

function validateManifest(value, expected) {
  try {
    const manifest = clone(value);
    exactKeys(manifest, [
      'schema', 'version', 'status', 'settlementLogId', 'sourceLogId', 'sourceManifestRef', 'sourceGenesisAnchoredCheckpointRef',
      'sourceGenesisCheckpointRef', 'sourceGenesisAnchorEpoch', 'sourceAnchorPolicyIdentity', 'sourceAnchorProfileDigest',
      'sourceWitnessPolicyIdentity', 'sourceWitnessProfileDigest', 'authorityOrigin', 'storageMode', 'manifestDigest'
    ], 'transition settlement manifest');
    if (manifest.schema !== MANIFEST_SCHEMA || manifest.version !== VERSION || manifest.status !== STATUS) throw new Error('manifest identity mismatch');
    if (text(manifest.settlementLogId, 'stored settlement log id', 180) !== expected.settlementLogId) fail('LOG_ID_MISMATCH', 'settlement root is already bound to another log id');
    if (text(manifest.sourceLogId, 'stored source log id', 180) !== expected.source.logId) fail('SOURCE_IDENTITY_MISMATCH', 'settlement root is already bound to another source log');
    const sourceManifestRefValue = reference(manifest.sourceManifestRef, 'stored source manifest reference', V36.MANIFEST_SCHEMA);
    const genesisAnchored = reference(manifest.sourceGenesisAnchoredCheckpointRef, 'stored source genesis anchored reference');
    const genesisCheckpoint = reference(manifest.sourceGenesisCheckpointRef, 'stored source genesis checkpoint reference');
    const genesisEpoch = integer(manifest.sourceGenesisAnchorEpoch, 'stored source genesis epoch', 1, Number.MAX_SAFE_INTEGER);
    if (!sameReference(genesisAnchored, expected.source.genesisAnchoredCheckpointRef) || !sameReference(genesisCheckpoint, expected.source.genesisCheckpointRef) || genesisEpoch !== expected.source.genesisAnchorEpoch) {
      fail('SOURCE_IDENTITY_MISMATCH', 'settlement root source genesis mismatch');
    }
    identity(manifest.sourceAnchorPolicyIdentity, 'stored source anchor policy identity');
    digest(manifest.sourceAnchorProfileDigest, 'stored source anchor profile digest');
    identity(manifest.sourceWitnessPolicyIdentity, 'stored source witness policy identity');
    digest(manifest.sourceWitnessProfileDigest, 'stored source witness profile digest');
    if (manifest.authorityOrigin !== AUTHORITY_ORIGIN || manifest.storageMode !== STORAGE_MODE) throw new Error('manifest authority or storage boundary mismatch');
    if (digest(manifest.manifestDigest, 'stored manifest digest') !== manifestDigest(manifest)) throw new Error('manifest digest mismatch');
    return { ...manifest, sourceManifestRef: sourceManifestRefValue };
  } catch (error) {
    if (error instanceof TransitionSettlementLedgerError && ['LOG_ID_MISMATCH', 'SOURCE_IDENTITY_MISMATCH'].includes(error.code)) throw error;
    fail('SETTLEMENT_MANIFEST_CORRUPT', 'transition settlement manifest is corrupt or boundary-invalid: ' + error.message);
  }
}

function evidenceMatchesManifest(evidence, manifest) {
  const snapshot = evidence.afterSnapshot;
  return snapshot && sameReference(snapshot.manifestRef, manifest.sourceManifestRef) &&
    same(snapshot.anchorPolicyIdentity, manifest.sourceAnchorPolicyIdentity) && snapshot.anchorProfileDigest === manifest.sourceAnchorProfileDigest &&
    same(snapshot.witnessPolicyIdentity, manifest.sourceWitnessPolicyIdentity) && snapshot.witnessProfileDigest === manifest.sourceWitnessProfileDigest;
}

function buildProposal(value, evidenceValue, context) {
  const validated = validateProposalInput(value);
  exactKeys(context, ['manifest', 'sequence', 'previousProposalRef', 'currentSettledHead', 'lastSettlementTime'], 'proposal build context');
  const manifest = validateManifest(context.manifest, {
    settlementLogId: context.manifest.settlementLogId,
    source: {
      logId: context.manifest.sourceLogId,
      genesisAnchoredCheckpointRef: context.manifest.sourceGenesisAnchoredCheckpointRef,
      genesisCheckpointRef: context.manifest.sourceGenesisCheckpointRef,
      genesisAnchorEpoch: context.manifest.sourceGenesisAnchorEpoch
    }
  });
  const evidence = validateEvidence(evidenceValue, {
    logId: manifest.sourceLogId,
    genesisAnchoredCheckpointRef: manifest.sourceGenesisAnchoredCheckpointRef,
    genesisCheckpointRef: manifest.sourceGenesisCheckpointRef,
    genesisAnchorEpoch: manifest.sourceGenesisAnchorEpoch
  });
  if (evidence.observation.classification !== 'EXACT_ENTRY_PRESENT' || !evidenceMatchesManifest(evidence, manifest)) fail('PROPOSAL_SOURCE_NOT_EXACT', 'proposal requires exact stable v3.6 source entry evidence matching the pinned source manifest and profiles');
  const sequence = integer(context.sequence, 'proposal sequence', 1, MAX_RECORDS);
  const previousProposalRef = nullableReference(context.previousProposalRef, 'previous proposal reference', PROPOSAL_SCHEMA);
  const currentSettledHead = validateHead(context.currentSettledHead, 'current settled head');
  if (!sameHead(validated.sourceEntry.previousHead, currentSettledHead)) fail('STALE_SETTLED_HEAD', 'v3.6 source entry does not consume the exact local settled head');
  if (!sameReference(validated.sourceEntry.manifestRef, manifest.sourceManifestRef)) fail('SOURCE_IDENTITY_MISMATCH', 'v3.6 source entry manifest does not match the pinned source manifest');
  if (context.lastSettlementTime && Date.parse(validated.proposedAt) < Date.parse(context.lastSettlementTime)) fail('PROPOSAL_TIME_ROLLBACK', 'proposal time cannot predate the previous local settlement');
  const proposal = {
    schema: PROPOSAL_SCHEMA,
    version: VERSION,
    status: STATUS,
    proposalId: validated.proposalId,
    proposedAt: validated.proposedAt,
    log: { settlementLogId: manifest.settlementLogId, authorityOrigin: AUTHORITY_ORIGIN, storageMode: STORAGE_MODE, sequence },
    manifestRef: manifestRef(manifest),
    previousProposalRef,
    sourceManifestRef: clone(manifest.sourceManifestRef),
    sourceEntryRef: clone(validated.sourceEntry.ref),
    sourceEntrySequence: validated.sourceEntry.sequence,
    previousSettledHead: clone(currentSettledHead),
    candidateSettledHead: clone(validated.sourceEntry.candidateHead),
    sourceObservation: clone(evidence.observation),
    state: PROPOSAL_STATE,
    nextGate: PROPOSAL_NEXT_GATE,
    truth: proposalTruth(),
    proposalDigest: null
  };
  proposal.proposalDigest = proposalDigest(proposal);
  bound(proposal, MAX_ARTIFACT_CANONICAL_BYTES, 'ARTIFACT_TOO_LARGE', 'transition settlement proposal');
  return proposal;
}

function validateStoredProposal(value, context) {
  try {
    const proposal = clone(value);
    exactKeys(proposal, [
      'schema', 'version', 'status', 'proposalId', 'proposedAt', 'log', 'manifestRef', 'previousProposalRef', 'sourceManifestRef',
      'sourceEntryRef', 'sourceEntrySequence', 'previousSettledHead', 'candidateSettledHead', 'sourceObservation', 'state', 'nextGate', 'truth', 'proposalDigest'
    ], 'stored transition settlement proposal');
    if (proposal.schema !== PROPOSAL_SCHEMA || proposal.version !== VERSION || proposal.status !== STATUS) throw new Error('proposal identity mismatch');
    text(proposal.proposalId, 'stored proposal id', 180);
    timestamp(proposal.proposedAt, 'stored proposal time');
    exactKeys(proposal.log, ['settlementLogId', 'authorityOrigin', 'storageMode', 'sequence'], 'stored proposal log');
    if (proposal.log.settlementLogId !== context.manifest.settlementLogId || proposal.log.authorityOrigin !== AUTHORITY_ORIGIN || proposal.log.storageMode !== STORAGE_MODE ||
        integer(proposal.log.sequence, 'stored proposal sequence', 1, MAX_RECORDS) !== context.sequence) throw new Error('proposal log binding mismatch');
    if (!sameReference(reference(proposal.manifestRef, 'stored proposal manifest reference'), manifestRef(context.manifest))) throw new Error('proposal manifest reference mismatch');
    if (context.previousProposalRef === null ? proposal.previousProposalRef !== null : !sameReference(reference(proposal.previousProposalRef, 'stored previous proposal reference'), context.previousProposalRef)) throw new Error('previous proposal reference mismatch');
    if (!sameReference(reference(proposal.sourceManifestRef, 'stored source manifest reference', V36.MANIFEST_SCHEMA), context.manifest.sourceManifestRef)) throw new Error('stored source manifest reference mismatch');
    reference(proposal.sourceEntryRef, 'stored source entry reference', V36.ENTRY_SCHEMA);
    integer(proposal.sourceEntrySequence, 'stored source entry sequence', 1, V36.MAX_ENTRIES);
    const previousHead = validateHead(proposal.previousSettledHead, 'stored previous settled head');
    const candidateHead = validateHead(proposal.candidateSettledHead, 'stored candidate settled head');
    if (!sameHead(previousHead, context.currentSettledHead) || candidateHead.anchorEpoch !== previousHead.anchorEpoch + 1) throw new Error('proposal settled-head binding mismatch');
    const observation = validateObservation(proposal.sourceObservation);
    if (observation.classification !== 'EXACT_ENTRY_PRESENT') throw new Error('stored proposal source observation is not exact');
    if (proposal.state !== PROPOSAL_STATE || proposal.nextGate !== PROPOSAL_NEXT_GATE || !same(proposal.truth, proposalTruth())) throw new Error('proposal state truth or next-gate boundary mismatch');
    if (digest(proposal.proposalDigest, 'stored proposal digest') !== proposalDigest(proposal)) throw new Error('proposal digest mismatch');
    return proposal;
  } catch (error) {
    fail('SETTLEMENT_PROPOSAL_CORRUPT', 'stored transition settlement proposal is corrupt or boundary-invalid: ' + error.message);
  }
}

function settlementClassification(observation) {
  return {
    EXACT_ENTRY_PRESENT: 'SETTLED_EXACT_SOURCE_ENTRY_PRESENT',
    SOURCE_ABSENT: 'HELD_SOURCE_ABSENT',
    SOURCE_INVALID: 'HELD_SOURCE_INVALID',
    SOURCE_CHANGED_DURING_CHECK: 'HELD_SOURCE_CHANGED_DURING_CHECK',
    ENTRY_NOT_EXACT_OR_PRESENT: 'HELD_ENTRY_NOT_EXACT_OR_PRESENT'
  }[observation.classification];
}

function buildSettlement(value, evidenceValue, proposalValue, manifestValue) {
  const validated = validateSettlementInput(value);
  const proposal = clone(proposalValue);
  const manifest = clone(manifestValue);
  const evidence = validateEvidence(evidenceValue, {
    logId: manifest.sourceLogId,
    genesisAnchoredCheckpointRef: manifest.sourceGenesisAnchoredCheckpointRef,
    genesisCheckpointRef: manifest.sourceGenesisCheckpointRef,
    genesisAnchorEpoch: manifest.sourceGenesisAnchorEpoch
  });
  if (Date.parse(validated.settledAt) < Date.parse(proposal.proposedAt)) fail('SETTLEMENT_TIME_INVALID', 'settlement time cannot predate the pending proposal');
  if (evidence.observation.classification === 'EXACT_ENTRY_PRESENT' && !evidenceMatchesManifest(evidence, manifest)) {
    fail('SOURCE_IDENTITY_MISMATCH', 'exact settlement observation does not match the pinned source manifest and policy profiles');
  }
  const exact = evidence.observation.classification === 'EXACT_ENTRY_PRESENT' && evidenceMatchesManifest(evidence, manifest);
  const classification = exact ? 'SETTLED_EXACT_SOURCE_ENTRY_PRESENT' : settlementClassification(evidence.observation);
  const previousHead = clone(proposal.previousSettledHead);
  const resultingHead = exact ? clone(proposal.candidateSettledHead) : clone(previousHead);
  const settlement = {
    schema: SETTLEMENT_SCHEMA,
    version: VERSION,
    status: STATUS,
    settlementId: validated.settlementId,
    settledAt: validated.settledAt,
    log: clone(proposal.log),
    manifestRef: manifestRef(manifest),
    proposalRef: proposalRef(proposal),
    sourceManifestRef: clone(proposal.sourceManifestRef),
    sourceEntryRef: clone(proposal.sourceEntryRef),
    previousSettledHead: previousHead,
    resultingSettledHead: resultingHead,
    sourceObservation: clone(evidence.observation),
    classification,
    decision: { settledHeadAdvanced: exact, heldForSourceUncertainty: !exact, autonomousActionCount: 0 },
    state: exact ? SETTLED_STATE : HELD_STATE,
    nextGate: SETTLEMENT_NEXT_GATE,
    truth: settlementTruth(evidence.observation),
    settlementDigest: null
  };
  settlement.settlementDigest = settlementDigest(settlement);
  bound(settlement, MAX_ARTIFACT_CANONICAL_BYTES, 'ARTIFACT_TOO_LARGE', 'transition settlement receipt');
  return settlement;
}

function validateStoredSettlement(value, context) {
  try {
    const settlement = clone(value);
    exactKeys(settlement, [
      'schema', 'version', 'status', 'settlementId', 'settledAt', 'log', 'manifestRef', 'proposalRef', 'sourceManifestRef',
      'sourceEntryRef', 'previousSettledHead', 'resultingSettledHead', 'sourceObservation', 'classification', 'decision', 'state', 'nextGate', 'truth', 'settlementDigest'
    ], 'stored transition settlement receipt');
    if (settlement.schema !== SETTLEMENT_SCHEMA || settlement.version !== VERSION || settlement.status !== STATUS) throw new Error('settlement identity mismatch');
    text(settlement.settlementId, 'stored settlement id', 180);
    const settledAt = timestamp(settlement.settledAt, 'stored settlement time');
    if (Date.parse(settledAt) < Date.parse(context.proposal.proposedAt)) throw new Error('settlement predates proposal');
    if (!same(settlement.log, context.proposal.log)) throw new Error('settlement log binding mismatch');
    if (!sameReference(reference(settlement.manifestRef, 'stored settlement manifest reference'), manifestRef(context.manifest))) throw new Error('settlement manifest reference mismatch');
    if (!sameReference(reference(settlement.proposalRef, 'stored proposal reference', PROPOSAL_SCHEMA), proposalRef(context.proposal))) throw new Error('settlement proposal reference mismatch');
    if (!sameReference(reference(settlement.sourceManifestRef, 'stored settlement source manifest reference', V36.MANIFEST_SCHEMA), context.proposal.sourceManifestRef)) throw new Error('settlement source manifest reference mismatch');
    if (!sameReference(reference(settlement.sourceEntryRef, 'stored settlement source entry reference', V36.ENTRY_SCHEMA), context.proposal.sourceEntryRef)) throw new Error('settlement source entry reference mismatch');
    const previousHead = validateHead(settlement.previousSettledHead, 'stored settlement previous head');
    const resultingHead = validateHead(settlement.resultingSettledHead, 'stored settlement resulting head');
    if (!sameHead(previousHead, context.proposal.previousSettledHead)) throw new Error('settlement previous head mismatch');
    const observation = validateObservation(settlement.sourceObservation);
    if (!SETTLEMENT_CLASSIFICATIONS.includes(settlement.classification) || settlement.classification !== settlementClassification(observation)) throw new Error('settlement classification mismatch');
    exactKeys(settlement.decision, ['settledHeadAdvanced', 'heldForSourceUncertainty', 'autonomousActionCount'], 'stored settlement decision');
    const exact = settlement.classification === 'SETTLED_EXACT_SOURCE_ENTRY_PRESENT';
    if (settlement.decision.settledHeadAdvanced !== exact || settlement.decision.heldForSourceUncertainty !== !exact || settlement.decision.autonomousActionCount !== 0) throw new Error('settlement decision mismatch');
    const expectedHead = exact ? context.proposal.candidateSettledHead : context.proposal.previousSettledHead;
    if (!sameHead(resultingHead, expectedHead)) throw new Error('settlement resulting head mismatch');
    if (settlement.state !== (exact ? SETTLED_STATE : HELD_STATE) || settlement.nextGate !== SETTLEMENT_NEXT_GATE || !same(settlement.truth, settlementTruth(observation))) throw new Error('settlement state truth or next-gate boundary mismatch');
    if (digest(settlement.settlementDigest, 'stored settlement digest') !== settlementDigest(settlement)) throw new Error('settlement digest mismatch');
    return settlement;
  } catch (error) {
    fail('SETTLEMENT_RECEIPT_CORRUPT', 'stored transition settlement receipt is corrupt or boundary-invalid: ' + error.message);
  }
}

function buildSnapshot(manifest, proposals, settlements, currentSettledHead, heldCount) {
  const pending = proposals.length > settlements.length ? proposals[proposals.length - 1] : null;
  const snapshot = {
    schema: SNAPSHOT_SCHEMA,
    version: VERSION,
    status: STATUS,
    settlementLogId: manifest.settlementLogId,
    manifestRef: manifestRef(manifest),
    sourceLogId: manifest.sourceLogId,
    sourceManifestRef: clone(manifest.sourceManifestRef),
    genesisSettledHead: head(manifest.sourceGenesisAnchoredCheckpointRef, manifest.sourceGenesisCheckpointRef, manifest.sourceGenesisAnchorEpoch),
    currentSettledHead: clone(currentSettledHead),
    proposalCount: proposals.length,
    settlementCount: settlements.length,
    heldSettlementCount: heldCount,
    lastProposalRef: proposals.length ? proposalRef(proposals[proposals.length - 1]) : null,
    lastSettlementRef: settlements.length ? settlementRef(settlements[settlements.length - 1]) : null,
    pendingProposalRef: pending ? proposalRef(pending) : null,
    truth: localSnapshotTruth(),
    snapshotDigest: null
  };
  snapshot.snapshotDigest = snapshotDigest(snapshot);
  bound(snapshot, MAX_ARTIFACT_CANONICAL_BYTES, 'ARTIFACT_TOO_LARGE', 'transition settlement snapshot');
  return snapshot;
}

function assertDirectoryNotLink(directoryPath, code, label) {
  let stat;
  try { stat = fs.lstatSync(directoryPath); }
  catch (error) { fail(code, label + ' cannot be inspected: ' + error.message); }
  if (!stat.isDirectory() || stat.isSymbolicLink()) fail(code, label + ' must be a real directory and not a symbolic link or junction');
}

function resolveRoot(value, label) {
  const root = path.resolve(text(value, label, 32767));
  if (root === path.parse(root).root) fail('STATE_ROOT_INVALID', 'filesystem root cannot be used as ' + label);
  assertDirectoryNotLink(root, 'STATE_ROOT_INVALID', label);
  return root;
}

function assertDistinctRoots(left, right) {
  const a = path.normalize(left).toLowerCase();
  const b = path.normalize(right).toLowerCase();
  if (a === b || a.startsWith(b + path.sep) || b.startsWith(a + path.sep)) fail('STATE_ROOT_OVERLAP', 'source and settlement roots must be distinct and nonnested caller-owned directories');
}

function resolvePaths(root) {
  return {
    root,
    namespace: path.join(root, NAMESPACE),
    manifest: path.join(root, NAMESPACE, MANIFEST_FILE),
    proposals: path.join(root, NAMESPACE, PROPOSALS_DIRECTORY),
    settlements: path.join(root, NAMESPACE, SETTLEMENTS_DIRECTORY),
    lock: path.join(root, NAMESPACE, LOCK_FILE)
  };
}

function createFixedDirectory(directoryPath, label) {
  try { fs.mkdirSync(directoryPath); }
  catch (error) { if (error.code !== 'EEXIST') fail('STATE_ROOT_INVALID', label + ' cannot be created: ' + error.message); }
  assertDirectoryNotLink(directoryPath, 'STATE_ROOT_INVALID', label);
}

function writeExclusive(filePath, value, prefix) {
  let descriptor;
  try { descriptor = fs.openSync(filePath, 'wx', 0o600); }
  catch (error) { if (error.code === 'EEXIST') return false; fail(prefix + '_WRITE_FAILED', 'exclusive file create failed: ' + error.message); }
  let problem = null;
  try { fs.writeFileSync(descriptor, stableStringify(value) + '\n', { encoding: 'utf8' }); fs.fsyncSync(descriptor); }
  catch (error) { problem = error; }
  finally { try { fs.closeSync(descriptor); } catch (error) { if (!problem) problem = error; } }
  if (problem) fail(prefix + '_DURABILITY_UNCERTAIN', 'file write or fsync did not complete; retained state requires steward inspection: ' + problem.message);
  return true;
}

function readJsonFile(filePath, code, label) {
  let stat;
  try { stat = fs.lstatSync(filePath); }
  catch (error) { if (error.code === 'ENOENT') return null; fail(code, label + ' cannot be inspected: ' + error.message); }
  if (!stat.isFile() || stat.isSymbolicLink()) fail(code, label + ' must be a regular file and not a symbolic link');
  if (stat.size > MAX_ARTIFACT_CANONICAL_BYTES + 1) fail(code, label + ' exceeds the bounded canonical byte limit');
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    if (raw !== stableStringify(parsed) + '\n') fail(code, label + ' is not exact canonical JSON');
    return parsed;
  } catch (error) {
    if (error instanceof TransitionSettlementLedgerError) throw error;
    fail(code, label + ' is unreadable or invalid JSON');
  }
}

function withOperationLock(paths, operation) {
  let descriptor;
  try { descriptor = fs.openSync(paths.lock, 'wx', 0o600); }
  catch (error) { if (error.code === 'EEXIST') fail('SETTLEMENT_OPERATION_BUSY', 'transition settlement operation lock already exists'); fail('SETTLEMENT_LOCK_FAILED', 'transition settlement operation lock cannot be created: ' + error.message); }
  let lockWritten = false;
  try {
    fs.writeFileSync(descriptor, '{"schema":"axm.model-shadow-retention-audit-review-outcome-transition-settlement-ledger-operation-lock/v1"}\n', 'utf8');
    lockWritten = true;
    fs.closeSync(descriptor); descriptor = null;
    return operation();
  } finally {
    if (descriptor !== null && descriptor !== undefined) try { fs.closeSync(descriptor); } catch (error) {}
    if (lockWritten || fs.existsSync(paths.lock)) try { fs.unlinkSync(paths.lock); } catch (error) {}
  }
}

function sequenceFile(sequence) { return String(sequence).padStart(12, '0') + '.json'; }
function contiguousNames(directoryPath, label) {
  assertDirectoryNotLink(directoryPath, 'SETTLEMENT_NAMESPACE_CORRUPT', label);
  const names = fs.readdirSync(directoryPath).sort();
  names.forEach((name, index) => {
    const match = RECORD_FILE.exec(name);
    if (!match || Number(match[1]) !== index + 1) fail('SETTLEMENT_SEQUENCE_CORRUPT', label + ' filenames must be one contiguous 12-digit sequence');
  });
  return names;
}

function readManifest(paths, expected) {
  const parsed = readJsonFile(paths.manifest, 'SETTLEMENT_MANIFEST_CORRUPT', 'transition settlement manifest');
  return parsed === null ? null : validateManifest(parsed, expected);
}

function prepare(paths, expected, sourceSnapshot) {
  createFixedDirectory(paths.namespace, 'transition settlement namespace');
  let manifest = readManifest(paths, expected);
  if (!manifest) {
    const unexpected = fs.readdirSync(paths.namespace).filter(name => name !== LOCK_FILE);
    if (unexpected.length) fail('SETTLEMENT_MANIFEST_MISSING', 'manifest-free settlement namespace contains unexpected items');
    manifest = buildManifest(expected.settlementLogId, expected.source, sourceSnapshot);
    if (!writeExclusive(paths.manifest, manifest, 'SETTLEMENT_MANIFEST')) manifest = readManifest(paths, expected);
  }
  createFixedDirectory(paths.proposals, 'transition settlement proposals directory');
  createFixedDirectory(paths.settlements, 'transition settlement settlements directory');
  return manifest;
}

function loadState(paths, expected) {
  assertDirectoryNotLink(paths.namespace, 'SETTLEMENT_NAMESPACE_CORRUPT', 'transition settlement namespace');
  const namespaceItems = fs.readdirSync(paths.namespace).sort();
  const unexpected = namespaceItems.filter(name => ![MANIFEST_FILE, PROPOSALS_DIRECTORY, SETTLEMENTS_DIRECTORY, LOCK_FILE].includes(name));
  if (unexpected.length) fail('SETTLEMENT_NAMESPACE_CORRUPT', 'unexpected settlement namespace items: ' + unexpected.join(', '));
  const manifest = readManifest(paths, expected);
  if (!manifest) {
    if (namespaceItems.filter(name => name !== LOCK_FILE).length) fail('SETTLEMENT_MANIFEST_MISSING', 'non-empty settlement namespace has no manifest');
    return null;
  }
  if (!fs.existsSync(paths.proposals) || !fs.existsSync(paths.settlements)) fail('SETTLEMENT_NAMESPACE_CORRUPT', 'settlement manifest exists without fixed record directories');
  const proposalNames = contiguousNames(paths.proposals, 'proposal directory');
  const settlementNames = contiguousNames(paths.settlements, 'settlement directory');
  if (proposalNames.length > MAX_RECORDS || settlementNames.length > MAX_RECORDS) fail('SETTLEMENT_RESOURCE_LIMIT', 'transition settlement record count exceeds bound');
  if (settlementNames.length > proposalNames.length || proposalNames.length - settlementNames.length > 1) fail('SETTLEMENT_SEQUENCE_CORRUPT', 'settlements must cover every proposal except at most one trailing pending proposal');
  let totalBytes = fs.lstatSync(paths.manifest).size;
  const proposals = [];
  const settlements = [];
  const headBeforeProposal = [];
  const proposalIds = new Set();
  const settlementIds = new Set();
  const exactlySettledEntryDigests = new Set();
  let currentSettledHead = head(manifest.sourceGenesisAnchoredCheckpointRef, manifest.sourceGenesisCheckpointRef, manifest.sourceGenesisAnchorEpoch);
  let previousProposalRef = null;
  let lastSettlementTime = null;
  let heldCount = 0;
  proposalNames.forEach((name, index) => {
    const proposalPath = path.join(paths.proposals, name);
    totalBytes += fs.lstatSync(proposalPath).size;
    if (totalBytes > MAX_LEDGER_BYTES) fail('SETTLEMENT_RESOURCE_LIMIT', 'transition settlement ledger exceeds aggregate byte bound');
    headBeforeProposal.push(clone(currentSettledHead));
    const proposal = validateStoredProposal(readJsonFile(proposalPath, 'SETTLEMENT_PROPOSAL_CORRUPT', 'transition settlement proposal ' + name), {
      manifest, sequence: index + 1, previousProposalRef, currentSettledHead
    });
    if (proposalIds.has(proposal.proposalId)) fail('SETTLEMENT_PROPOSAL_CORRUPT', 'stored proposal id is reused');
    if (lastSettlementTime && Date.parse(proposal.proposedAt) < Date.parse(lastSettlementTime)) fail('SETTLEMENT_PROPOSAL_CORRUPT', 'stored proposal time moved behind prior settlement');
    proposalIds.add(proposal.proposalId);
    proposals.push(proposal);
    previousProposalRef = proposalRef(proposal);
    if (index < settlementNames.length) {
      const settlementPath = path.join(paths.settlements, settlementNames[index]);
      totalBytes += fs.lstatSync(settlementPath).size;
      if (totalBytes > MAX_LEDGER_BYTES) fail('SETTLEMENT_RESOURCE_LIMIT', 'transition settlement ledger exceeds aggregate byte bound');
      const settlement = validateStoredSettlement(readJsonFile(settlementPath, 'SETTLEMENT_RECEIPT_CORRUPT', 'transition settlement receipt ' + settlementNames[index]), { manifest, proposal });
      if (settlementIds.has(settlement.settlementId)) fail('SETTLEMENT_RECEIPT_CORRUPT', 'stored settlement id is reused');
      if (settlement.decision.settledHeadAdvanced) {
        if (exactlySettledEntryDigests.has(settlement.sourceEntryRef.sha256)) fail('SETTLEMENT_RECEIPT_CORRUPT', 'exact source entry is settled more than once');
        exactlySettledEntryDigests.add(settlement.sourceEntryRef.sha256);
        currentSettledHead = clone(settlement.resultingSettledHead);
      } else heldCount += 1;
      lastSettlementTime = settlement.settledAt;
      settlementIds.add(settlement.settlementId);
      settlements.push(settlement);
    }
  });
  return {
    manifest, proposals, settlements, headBeforeProposal, currentSettledHead, lastSettlementTime, heldCount, totalBytes,
    pendingProposal: proposals.length > settlements.length ? proposals[proposals.length - 1] : null,
    snapshot: buildSnapshot(manifest, proposals, settlements, currentSettledHead, heldCount)
  };
}

function createService(options) {
  exactKeys(options, ['stateRoot', 'settlementLogId', 'sourceServiceOptions'], 'transition settlement service options');
  bound(options, 64 * 1024, 'INVALID_INPUT', 'transition settlement service options');
  const stateRoot = resolveRoot(options.stateRoot, 'transition settlement stateRoot');
  exactKeys(options.sourceServiceOptions, ['stateRoot', 'logId', 'genesisAnchoredCheckpointRef', 'genesisCheckpointRef', 'genesisAnchorEpoch'], 'v3.6 source service options');
  const sourceRoot = resolveRoot(options.sourceServiceOptions.stateRoot, 'v3.6 source stateRoot');
  assertDistinctRoots(stateRoot, sourceRoot);
  const sourceService = V36.createService(clone(options.sourceServiceOptions));
  const settlementLogId = text(options.settlementLogId, 'transition settlement log id', 180);
  const sourceExpected = {
    logId: sourceService.logId,
    genesisAnchoredCheckpointRef: clone(sourceService.genesisAnchoredCheckpointRef),
    genesisCheckpointRef: clone(sourceService.genesisCheckpointRef),
    genesisAnchorEpoch: sourceService.genesisAnchorEpoch
  };
  const expected = { settlementLogId, source: sourceExpected };
  const paths = resolvePaths(stateRoot);

  function inspect() {
    if (!fs.existsSync(paths.namespace)) return null;
    if (fs.existsSync(paths.lock)) fail('SETTLEMENT_OPERATION_BUSY', 'transition settlement operation is in progress or stale');
    const state = loadState(paths, expected);
    return state ? clone(state.snapshot) : null;
  }

  function proposalContext(state, sequence) {
    return {
      manifest: state.manifest,
      sequence,
      previousProposalRef: sequence === 1 ? null : proposalRef(state.proposals[sequence - 2]),
      currentSettledHead: state.headBeforeProposal[sequence - 1],
      lastSettlementTime: sequence === 1 ? null : state.settlements[sequence - 2].settledAt
    };
  }

  function verifyProposalPackage(state, input, evidence, receipt) {
    const candidate = clone(receipt);
    const sequence = candidate && candidate.log && candidate.log.sequence;
    if (!Number.isSafeInteger(sequence) || sequence < 1 || sequence > state.proposals.length) fail('PROPOSAL_PACKAGE_MISMATCH', 'proposal sequence is absent');
    const rebuilt = buildProposal(input, evidence, proposalContext(state, sequence));
    const stored = state.proposals[sequence - 1];
    if (!same(rebuilt, candidate) || !same(stored, rebuilt)) fail('PROPOSAL_PACKAGE_MISMATCH', 'proposal does not exact-rebuild from caller package or match stored proposal');
    return { rebuilt, stored, sequence };
  }

  function propose(input) {
    const validated = validateProposalInput(input);
    if (validated.sourceEntry.entry.log.logId !== sourceExpected.logId) fail('SOURCE_IDENTITY_MISMATCH', 'proposal source entry log id does not match configured v3.6 source');
    const evidence = observeSource(sourceService, sourceExpected, input.sourceRecordInput, input.sourceEntry);
    if (evidence.observation.classification !== 'EXACT_ENTRY_PRESENT') fail('PROPOSAL_SOURCE_NOT_EXACT', 'proposal requires an exact persisted v3.6 source entry with equal bracketing source snapshots');
    createFixedDirectory(paths.namespace, 'transition settlement namespace');
    return withOperationLock(paths, () => {
      const manifest = prepare(paths, expected, evidence.afterSnapshot);
      const state = loadState(paths, expected);
      if (state.pendingProposal) fail('PENDING_SETTLEMENT', 'trailing transition proposal must settle before another proposal');
      const sequence = state.proposals.length + 1;
      if (sequence > MAX_RECORDS) fail('SETTLEMENT_RESOURCE_LIMIT', 'transition settlement proposal count exceeds bound');
      const proposal = buildProposal(input, evidence, {
        manifest,
        sequence,
        previousProposalRef: state.proposals.length ? proposalRef(state.proposals[state.proposals.length - 1]) : null,
        currentSettledHead: state.currentSettledHead,
        lastSettlementTime: state.lastSettlementTime
      });
      if (state.proposals.some(item => item.proposalId === proposal.proposalId)) fail('PROPOSAL_ID_ALREADY_USED', 'transition settlement proposal id is already used');
      const projected = state.totalBytes + Buffer.byteLength(stableStringify(proposal) + '\n', 'utf8');
      if (projected > MAX_LEDGER_BYTES) fail('SETTLEMENT_RESOURCE_LIMIT', 'transition settlement proposal exceeds aggregate byte bound');
      const filePath = path.join(paths.proposals, sequenceFile(sequence));
      if (!writeExclusive(filePath, proposal, 'SETTLEMENT_PROPOSAL')) fail('SETTLEMENT_SEQUENCE_CONFLICT', 'next transition settlement proposal sequence already exists');
      const after = loadState(paths, expected);
      const stored = after.proposals[sequence - 1];
      if (!stored || !same(stored, proposal) || !after.pendingProposal || !sameHead(after.currentSettledHead, state.currentSettledHead)) fail('SETTLEMENT_POSTWRITE_INVALID', 'postwrite reload did not recover exact pending proposal and unchanged settled head');
      return { proposal: clone(proposal), prewriteEvidence: clone(evidence) };
    });
  }

  function settle(input) {
    const validated = validateSettlementInput(input);
    if (!fs.existsSync(paths.namespace)) fail('NO_PENDING_PROPOSAL', 'transition settlement ledger is absent');
    return withOperationLock(paths, () => {
      const state = loadState(paths, expected);
      if (!state.pendingProposal) fail('NO_PENDING_PROPOSAL', 'there is no trailing transition proposal');
      const packageResult = verifyProposalPackage(state, input.proposalInput, input.proposalEvidence, input.proposalReceipt);
      if (packageResult.sequence !== state.proposals.length) fail('PROPOSAL_PACKAGE_MISMATCH', 'caller package is not the trailing pending proposal');
      if (state.settlements.some(item => item.settlementId === validated.settlementId)) fail('SETTLEMENT_ID_ALREADY_USED', 'transition settlement id is already used');
      const evidence = observeSource(sourceService, sourceExpected, input.proposalInput.sourceRecordInput, input.proposalInput.sourceEntry);
      const settlement = buildSettlement(input, evidence, packageResult.rebuilt, state.manifest);
      const projected = state.totalBytes + Buffer.byteLength(stableStringify(settlement) + '\n', 'utf8');
      if (projected > MAX_LEDGER_BYTES) fail('SETTLEMENT_RESOURCE_LIMIT', 'transition settlement receipt exceeds aggregate byte bound');
      const filePath = path.join(paths.settlements, sequenceFile(packageResult.sequence));
      if (!writeExclusive(filePath, settlement, 'SETTLEMENT_RECEIPT')) fail('SETTLEMENT_SEQUENCE_CONFLICT', 'matching transition settlement sequence already exists');
      const after = loadState(paths, expected);
      const stored = after.settlements[packageResult.sequence - 1];
      if (!stored || !same(stored, settlement) || after.pendingProposal) fail('SETTLEMENT_POSTWRITE_INVALID', 'postwrite reload did not recover the exact settlement and clear pending state');
      if (!sameHead(after.currentSettledHead, settlement.resultingSettledHead)) fail('SETTLEMENT_POSTWRITE_INVALID', 'postwrite reload derived an unexpected settled head');
      return { settlement: clone(settlement), prewriteEvidence: clone(evidence) };
    });
  }

  function verifyProposalPersisted(input, evidence, receipt) {
    const errors = [];
    let rebuilt = null;
    let stored = null;
    try {
      if (fs.existsSync(paths.lock)) throw new Error('transition settlement operation is in progress or stale');
      const state = loadState(paths, expected);
      if (!state) throw new Error('transition settlement ledger is absent');
      const result = verifyProposalPackage(state, input, evidence, receipt);
      rebuilt = result.rebuilt;
      stored = result.stored;
    } catch (error) { errors.push(error.message); }
    return { pass: errors.length === 0, errors, rebuilt, stored };
  }

  function verifySettlementPersisted(input, evidence, receipt) {
    const errors = [];
    let rebuilt = null;
    let stored = null;
    try {
      if (fs.existsSync(paths.lock)) throw new Error('transition settlement operation is in progress or stale');
      const state = loadState(paths, expected);
      if (!state) throw new Error('transition settlement ledger is absent');
      const candidate = clone(receipt);
      const sequence = candidate && candidate.log && candidate.log.sequence;
      if (!Number.isSafeInteger(sequence) || sequence < 1 || sequence > state.settlements.length) throw new Error('settlement sequence is absent');
      const proposalResult = verifyProposalPackage(state, input.proposalInput, input.proposalEvidence, input.proposalReceipt);
      if (proposalResult.sequence !== sequence) throw new Error('settlement proposal sequence mismatch');
      rebuilt = buildSettlement(input, evidence, proposalResult.rebuilt, state.manifest);
      stored = state.settlements[sequence - 1];
      if (!same(rebuilt, candidate) || !same(stored, rebuilt)) throw new Error('settlement does not exact-rebuild from caller package or match stored receipt');
    } catch (error) { errors.push(error.message); }
    return { pass: errors.length === 0, errors, rebuilt, stored };
  }

  return Object.freeze({
    settlementLogId,
    sourceLogId: sourceExpected.logId,
    sourceGenesisAnchoredCheckpointRef: clone(sourceExpected.genesisAnchoredCheckpointRef),
    sourceGenesisCheckpointRef: clone(sourceExpected.genesisCheckpointRef),
    sourceGenesisAnchorEpoch: sourceExpected.genesisAnchorEpoch,
    inspect,
    propose,
    settle,
    verifyProposalPersisted,
    verifySettlementPersisted
  });
}

module.exports = {
  MANIFEST_SCHEMA,
  PROPOSAL_SCHEMA,
  SETTLEMENT_SCHEMA,
  SNAPSHOT_SCHEMA,
  VERSION,
  STATUS,
  NAMESPACE,
  MANIFEST_FILE,
  PROPOSALS_DIRECTORY,
  SETTLEMENTS_DIRECTORY,
  LOCK_FILE,
  PROPOSE_CONFIRMATION,
  SETTLE_CONFIRMATION,
  AUTHORITY_ORIGIN,
  STORAGE_MODE,
  PROPOSAL_STATE,
  SETTLED_STATE,
  HELD_STATE,
  PROPOSAL_NEXT_GATE,
  SETTLEMENT_NEXT_GATE,
  SOURCE_OBSERVATIONS,
  SOURCE_CAPTURE_STATES,
  SETTLEMENT_CLASSIFICATIONS,
  MAX_INPUT_CANONICAL_BYTES,
  MAX_ARTIFACT_CANONICAL_BYTES,
  MAX_LEDGER_BYTES,
  MAX_RECORDS,
  TransitionSettlementLedgerError,
  stableStringify,
  sha256,
  validateStoredProposal,
  validateStoredSettlement,
  createService
};
