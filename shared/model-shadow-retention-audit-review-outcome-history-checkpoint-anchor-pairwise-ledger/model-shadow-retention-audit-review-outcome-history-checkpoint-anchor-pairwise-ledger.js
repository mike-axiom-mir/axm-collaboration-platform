#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const Pairwise = require('../model-shadow-retention-audit-review-outcome-history-checkpoint-anchor-pairwise/model-shadow-retention-audit-review-outcome-history-checkpoint-anchor-pairwise');

const ENTRY_SCHEMA = 'axm.model-shadow-retention-audit-review-outcome-history-checkpoint-anchor-pairwise-ledger-entry/v1';
const MANIFEST_SCHEMA = 'axm.model-shadow-retention-audit-review-outcome-history-checkpoint-anchor-pairwise-ledger-manifest/v1';
const SNAPSHOT_SCHEMA = 'axm.model-shadow-retention-audit-review-outcome-history-checkpoint-anchor-pairwise-ledger-snapshot/v1';
const VERSION = '3.6.0';
const STATUS = 'TEST';
const CONFIRMATION = 'RECORD EXACT FORWARD ANCHORED REVIEW OUTCOME HISTORY TRANSITION ONCE';
const AUTHORITY_ORIGIN = 'CALLER_OWNED_LOCAL_ROOT_AND_CONFIRMATION_UNAUTHENTICATED';
const STORAGE_MODE = 'EXACT_V35_FORWARD_RECEIPT_THEN_EXCLUSIVE_LOCAL_SEQUENCE_ENTRY_CREATE';
const NAMESPACE = 'model-shadow-retention-audit-review-outcome-history-checkpoint-anchor-pairwise-ledger';
const ENTRIES_DIRECTORY = 'entries';
const MANIFEST_FILE = 'ledger.json';
const NEXT_GATE = 'HOST_AUTHENTICATED_EXTERNALLY_RETAINED_GLOBALLY_CONSISTENT_LOG_OR_PROTECTED_MONOTONIC_STORE';
const MAX_INPUT_CANONICAL_BYTES = 132 * 1024 * 1024;
const MAX_ARTIFACT_CANONICAL_BYTES = 2 * 1024 * 1024;
const MAX_LEDGER_BYTES = 256 * 1024 * 1024;
const MAX_ENTRIES = 10000;
const DIGEST = /^sha256:[a-f0-9]{64}$/;
const ENTRY_FILE = /^([0-9]{12})\.json$/;
const FORWARD_STATE = 'LOCAL_FORWARD_ANCHORED_HISTORY_TRANSITION_RECORDED_RELATIVE_TO_ONE_CALLER_ROOT_GLOBALITY_RETENTION_AND_AUTHORITY_NOT_PROVEN';
const PAIRWISE_STATE = 'PAIRWISE_ANCHORED_REVIEW_OUTCOME_HISTORY_CLASSIFIED_RELATIVE_TO_TWO_CALLER_PACKAGES_AUTHORITY_RETENTION_AND_GLOBAL_UNIQUENESS_NOT_PROVEN';

class AnchoredPairwiseLedgerError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'AnchoredPairwiseLedgerError';
    this.code = code;
  }
}

function stableStringify(value) { return Pairwise.stableStringify(value); }
function clone(value) { return JSON.parse(stableStringify(value)); }
function sha256(value) { return Pairwise.sha256(value); }
function fail(code, message) { throw new AnchoredPairwiseLedgerError(code, message); }
function same(left, right) { return stableStringify(left) === stableStringify(right); }

function bound(value, maximum, label) {
  let bytes;
  try { bytes = Buffer.byteLength(stableStringify(value), 'utf8'); }
  catch (error) { fail('INVALID_INPUT', label + ' is not canonical JSON data'); }
  if (bytes > maximum) fail('ARTIFACT_TOO_LARGE', label + ' exceeds the bounded canonical byte limit');
}

function exactKeys(value, allowed, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail('INVALID_INPUT', label + ' must be an object');
  const extras = Object.keys(value).filter(key => !allowed.includes(key));
  const missing = allowed.filter(key => !Object.prototype.hasOwnProperty.call(value, key));
  if (extras.length) fail('INVALID_INPUT', label + ' has unknown fields: ' + extras.sort().join(', '));
  if (missing.length) fail('INVALID_INPUT', label + ' is missing fields: ' + missing.sort().join(', '));
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

function identityOf(value) { return { id: value.id, schema: value.schema }; }
function sameReference(left, right) { return left.id === right.id && left.schema === right.schema && left.sha256 === right.sha256; }
function sameIdentity(left, right) { return left.id === right.id && left.schema === right.schema; }
function withoutField(value, field) { const result = clone(value); delete result[field]; return result; }
function manifestDigest(value) { return sha256(withoutField(value, 'manifestDigest')); }
function entryDigest(value) { return sha256(withoutField(value, 'entryDigest')); }
function snapshotDigest(value) { return sha256(withoutField(value, 'snapshotDigest')); }
function manifestRef(value) { return { id: value.logId, schema: value.schema, sha256: value.manifestDigest }; }
function entryRef(value) { return { id: value.entryId, schema: value.schema, sha256: value.entryDigest }; }

function forwardTruth() {
  return {
    previousAnchoredCheckpointVerifiedByExactRebuild: true,
    candidateAnchoredCheckpointVerifiedByExactRebuild: true,
    previousCheckpointSelfValidated: true,
    candidateCheckpointSelfValidated: true,
    normalizedAnchorContinuityProfilesCompared: true,
    normalizedWitnessContinuityProfilesCompared: true,
    completeOrderedHistoryEntriesCompared: true,
    anchorEpochOrderingChecked: true,
    exactAnchoredPackageReplayObserved: false,
    exactHistoryRecheckpointObserved: false,
    forwardHistoryExtensionObserved: true,
    strictHistoryRollbackObserved: false,
    historyReplacementOrForkObserved: false,
    historyExtensionWithoutSnapshotChangeObserved: false,
    ledgerIdentityDriftObserved: false,
    policyOrAnchorDriftObserved: false,
    pairwiseHoldRequired: false,
    anchorEpochExactlyNextObserved: true,
    pairwiseComparisonOnly: true,
    sourceOrLedgerStateRecapturedByThisModule: false,
    checkpointOriginAuthenticated: false,
    anchorPolicyAuthorityAuthenticated: false,
    witnessPolicyAuthorityAuthenticated: false,
    policyRotationAuthenticated: false,
    anchorEpochExternallyMonotonicProven: false,
    hostAuthorizationAuthenticated: false,
    externalRetentionProven: false,
    protectedMonotonicStateProven: false,
    deletionOrRollbackPrevented: false,
    withheldBranchesExcluded: false,
    unpresentedBranchesObserved: false,
    twoIndependentCandidatesMayUseSameNextEpoch: true,
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
    autonomousActionCount: 0,
    automaticWrite: false,
    automaticPermissionGrant: false,
    automaticInstall: false,
    automaticPromotion: false,
    automaticMerge: false,
    automaticCanon: false,
    foundationMutation: false
  };
}

function entryTruth() {
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

function snapshotTruth() {
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

function validateComparison(value) {
  const keys = [
    'anchorIdentityMatches', 'anchorContinuityProfileMatches', 'witnessPolicyIdentityMatches',
    'witnessPolicyContinuityProfileMatches', 'ledgerIdentityMatches', 'candidateVerificationTimePrecedesPrevious',
    'candidateVerificationTimeEqualsPrevious', 'candidateCheckpointTimePrecedesPrevious', 'candidateCheckpointTimeEqualsPrevious',
    'sameCheckpointId', 'sameCheckpointDigest', 'sameAnchoredReceiptDigest', 'sameSnapshotBinding', 'sameHistory',
    'previousHistoryPrefixesCandidate', 'candidateHistoryPrefixesPrevious', 'previousRecordCount', 'candidateRecordCount',
    'commonHistoryPrefixCount', 'previousAnchorEpoch', 'candidateAnchorEpoch', 'anchorEpochDelta',
    'anchorEpochRolledBack', 'anchorEpochNotAdvanced', 'anchorEpochExactlyNext', 'anchorEpochGap'
  ];
  exactKeys(value, keys, 'stored v3.5 transition comparison');
  const requiredTrue = ['anchorIdentityMatches', 'anchorContinuityProfileMatches', 'witnessPolicyIdentityMatches', 'witnessPolicyContinuityProfileMatches', 'ledgerIdentityMatches', 'previousHistoryPrefixesCandidate', 'anchorEpochExactlyNext'];
  const requiredFalse = ['candidateVerificationTimePrecedesPrevious', 'candidateVerificationTimeEqualsPrevious', 'candidateCheckpointTimePrecedesPrevious', 'candidateCheckpointTimeEqualsPrevious', 'sameCheckpointId', 'sameCheckpointDigest', 'sameAnchoredReceiptDigest', 'sameSnapshotBinding', 'sameHistory', 'candidateHistoryPrefixesPrevious', 'anchorEpochRolledBack', 'anchorEpochNotAdvanced', 'anchorEpochGap'];
  requiredTrue.forEach(key => { if (value[key] !== true) fail('TRANSITION_RECEIPT_CORRUPT', 'stored forward comparison expected true: ' + key); });
  requiredFalse.forEach(key => { if (value[key] !== false) fail('TRANSITION_RECEIPT_CORRUPT', 'stored forward comparison expected false: ' + key); });
  const previousCount = integer(value.previousRecordCount, 'stored previous record count', 1, Number.MAX_SAFE_INTEGER);
  const candidateCount = integer(value.candidateRecordCount, 'stored candidate record count', 2, Number.MAX_SAFE_INTEGER);
  const prefixCount = integer(value.commonHistoryPrefixCount, 'stored common history prefix count', 1, Number.MAX_SAFE_INTEGER);
  const previousEpoch = integer(value.previousAnchorEpoch, 'stored previous anchor epoch', 1, Number.MAX_SAFE_INTEGER);
  const candidateEpoch = integer(value.candidateAnchorEpoch, 'stored candidate anchor epoch', 2, Number.MAX_SAFE_INTEGER);
  if (candidateCount <= previousCount || prefixCount !== previousCount || candidateEpoch !== previousEpoch + 1 || value.anchorEpochDelta !== 1) {
    fail('TRANSITION_RECEIPT_CORRUPT', 'stored forward comparison count prefix or epoch relation mismatch');
  }
  return { previousCount, candidateCount, previousEpoch, candidateEpoch };
}

function validateStoredTransition(value) {
  try {
    const receipt = clone(value);
    exactKeys(receipt, [
      'schema', 'version', 'status', 'transitionId', 'comparedAt', 'previousAnchoredCheckpointRef',
      'candidateAnchoredCheckpointRef', 'previousCheckpointRef', 'candidateCheckpointRef', 'anchorContinuity',
      'witnessContinuity', 'historyContinuity', 'classification', 'comparison', 'decision', 'state', 'truth', 'transitionDigest'
    ], 'stored v3.5 transition receipt');
    if (receipt.schema !== Pairwise.RECEIPT_SCHEMA || receipt.version !== Pairwise.VERSION || receipt.status !== STATUS) throw new Error('stored transition identity mismatch');
    text(receipt.transitionId, 'stored transition id', 180);
    timestamp(receipt.comparedAt, 'stored transition comparison time');
    const previousAnchored = reference(receipt.previousAnchoredCheckpointRef, 'stored previous anchored checkpoint reference');
    const candidateAnchored = reference(receipt.candidateAnchoredCheckpointRef, 'stored candidate anchored checkpoint reference');
    const previousCheckpoint = reference(receipt.previousCheckpointRef, 'stored previous checkpoint reference');
    const candidateCheckpoint = reference(receipt.candidateCheckpointRef, 'stored candidate checkpoint reference');
    exactKeys(receipt.anchorContinuity, ['previousPolicyRef', 'candidatePolicyRef', 'previousProfileDigest', 'candidateProfileDigest', 'previousEpoch', 'candidateEpoch', 'epochDelta'], 'stored anchor continuity');
    const previousAnchorPolicy = reference(receipt.anchorContinuity.previousPolicyRef, 'stored previous anchor policy reference');
    const candidateAnchorPolicy = reference(receipt.anchorContinuity.candidatePolicyRef, 'stored candidate anchor policy reference');
    const previousAnchorProfile = digest(receipt.anchorContinuity.previousProfileDigest, 'stored previous anchor profile digest');
    const candidateAnchorProfile = digest(receipt.anchorContinuity.candidateProfileDigest, 'stored candidate anchor profile digest');
    exactKeys(receipt.witnessContinuity, ['previousPolicyRef', 'candidatePolicyRef', 'previousProfileDigest', 'candidateProfileDigest'], 'stored witness continuity');
    const previousWitnessPolicy = reference(receipt.witnessContinuity.previousPolicyRef, 'stored previous witness policy reference');
    const candidateWitnessPolicy = reference(receipt.witnessContinuity.candidatePolicyRef, 'stored candidate witness policy reference');
    const previousWitnessProfile = digest(receipt.witnessContinuity.previousProfileDigest, 'stored previous witness profile digest');
    const candidateWitnessProfile = digest(receipt.witnessContinuity.candidateProfileDigest, 'stored candidate witness profile digest');
    exactKeys(receipt.historyContinuity, ['previousHistoryDigest', 'candidateHistoryDigest', 'previousRecordCount', 'candidateRecordCount', 'commonHistoryPrefixCount'], 'stored history continuity');
    digest(receipt.historyContinuity.previousHistoryDigest, 'stored previous history digest');
    digest(receipt.historyContinuity.candidateHistoryDigest, 'stored candidate history digest');
    const comparison = validateComparison(receipt.comparison);
    if (receipt.historyContinuity.previousRecordCount !== comparison.previousCount || receipt.historyContinuity.candidateRecordCount !== comparison.candidateCount ||
        receipt.historyContinuity.commonHistoryPrefixCount !== comparison.previousCount) throw new Error('stored history continuity and comparison mismatch');
    if (!sameIdentity(previousAnchorPolicy, candidateAnchorPolicy) || previousAnchorProfile !== candidateAnchorProfile ||
        !sameIdentity(previousWitnessPolicy, candidateWitnessPolicy) || previousWitnessProfile !== candidateWitnessProfile) throw new Error('stored transition policy continuity mismatch');
    if (receipt.anchorContinuity.previousEpoch !== comparison.previousEpoch || receipt.anchorContinuity.candidateEpoch !== comparison.candidateEpoch || receipt.anchorContinuity.epochDelta !== 1) throw new Error('stored anchor continuity epoch mismatch');
    if (receipt.classification !== 'CANDIDATE_EXTENDS_PRESENTED_ANCHORED_HISTORY') throw new Error('stored transition is not a forward history extension');
    exactKeys(receipt.decision, ['reviewRequired', 'holdRequired', 'forwardHistoryCandidate', 'retentionHoldUnresolved', 'bestAction', 'autonomousActionCount'], 'stored transition decision');
    if (receipt.decision.reviewRequired !== true || receipt.decision.holdRequired !== false || receipt.decision.forwardHistoryCandidate !== true ||
        receipt.decision.retentionHoldUnresolved !== true || receipt.decision.bestAction !== 'REVIEW_EXTENSION_AND_RETAIN_ONLY_IF_AN_AUTHORIZED_HOST_CHOOSES' || receipt.decision.autonomousActionCount !== 0) throw new Error('stored transition decision boundary mismatch');
    if (receipt.state !== PAIRWISE_STATE || !same(receipt.truth, forwardTruth())) throw new Error('stored transition truth or state boundary mismatch');
    if (digest(receipt.transitionDigest, 'stored transition digest') !== sha256(withoutField(receipt, 'transitionDigest'))) throw new Error('stored transition digest mismatch');
    return {
      receipt,
      previousAnchored,
      candidateAnchored,
      previousCheckpoint,
      candidateCheckpoint,
      previousEpoch: comparison.previousEpoch,
      candidateEpoch: comparison.candidateEpoch,
      anchorPolicyIdentity: identityOf(previousAnchorPolicy),
      anchorProfileDigest: previousAnchorProfile,
      witnessPolicyIdentity: identityOf(previousWitnessPolicy),
      witnessProfileDigest: previousWitnessProfile
    };
  } catch (error) {
    if (error instanceof AnchoredPairwiseLedgerError && error.code === 'TRANSITION_RECEIPT_CORRUPT') throw error;
    fail('TRANSITION_RECEIPT_CORRUPT', 'stored v3.5 transition receipt is corrupt or boundary-invalid: ' + error.message);
  }
}

function validateTransition(input) {
  const check = Pairwise.verifyTransition(clone(input.transitionInput), clone(input.transitionReceipt));
  if (!check.pass) fail('TRANSITION_INVALID', 'v3.5 pairwise transition is invalid: ' + check.errors.join('; '));
  if (check.rebuilt.classification !== 'CANDIDATE_EXTENDS_PRESENTED_ANCHORED_HISTORY' || check.rebuilt.decision.forwardHistoryCandidate !== true || check.rebuilt.decision.holdRequired !== false) {
    fail('TRANSITION_NOT_FORWARD_EXTENSION', 'only an exact v3.5 forward anchored-history extension may advance this local ledger');
  }
  const stored = validateStoredTransition(check.rebuilt);
  if (!same(stored.receipt, check.rebuilt)) fail('TRANSITION_INVALID', 'v3.5 pairwise transition did not preserve exact rebuilt bytes');
  return stored;
}

function validateRecordInput(input) {
  bound(input, MAX_INPUT_CANONICAL_BYTES, 'local anchored pairwise ledger record input');
  exactKeys(input, ['entryId', 'recordedAt', 'confirmation', 'transitionInput', 'transitionReceipt'], 'local anchored pairwise ledger record input');
  if (input.confirmation !== CONFIRMATION) fail('CONFIRMATION_REQUIRED', 'exact local transition recording confirmation is required');
  const result = {
    entryId: text(input.entryId, 'local transition entry id', 180),
    recordedAt: timestamp(input.recordedAt, 'local transition recording time'),
    transition: validateTransition(input)
  };
  if (Date.parse(result.recordedAt) < Date.parse(result.transition.receipt.comparedAt)) fail('INVALID_INPUT', 'recording time cannot predate the exact v3.5 comparison time');
  return result;
}

function headFromTransition(transition, side) {
  return side === 'previous'
    ? { anchoredCheckpointRef: clone(transition.previousAnchored), checkpointRef: clone(transition.previousCheckpoint), anchorEpoch: transition.previousEpoch }
    : { anchoredCheckpointRef: clone(transition.candidateAnchored), checkpointRef: clone(transition.candidateCheckpoint), anchorEpoch: transition.candidateEpoch };
}

function sameHead(left, right) {
  return sameReference(left.anchoredCheckpointRef, right.anchoredCheckpointRef) && sameReference(left.checkpointRef, right.checkpointRef) && left.anchorEpoch === right.anchorEpoch;
}

function buildManifest(logId, transition) {
  const manifest = {
    schema: MANIFEST_SCHEMA,
    version: VERSION,
    status: STATUS,
    logId: text(logId, 'local anchored pairwise ledger log id', 180),
    genesisAnchoredCheckpointRef: clone(transition.previousAnchored),
    genesisCheckpointRef: clone(transition.previousCheckpoint),
    genesisAnchorEpoch: transition.previousEpoch,
    anchorPolicyIdentity: clone(transition.anchorPolicyIdentity),
    anchorProfileDigest: transition.anchorProfileDigest,
    witnessPolicyIdentity: clone(transition.witnessPolicyIdentity),
    witnessProfileDigest: transition.witnessProfileDigest,
    authorityOrigin: AUTHORITY_ORIGIN,
    storageMode: STORAGE_MODE,
    manifestDigest: null
  };
  manifest.manifestDigest = manifestDigest(manifest);
  return manifest;
}

function validateManifest(value, expected) {
  try {
    const manifest = clone(value);
    exactKeys(manifest, [
      'schema', 'version', 'status', 'logId', 'genesisAnchoredCheckpointRef', 'genesisCheckpointRef', 'genesisAnchorEpoch',
      'anchorPolicyIdentity', 'anchorProfileDigest', 'witnessPolicyIdentity', 'witnessProfileDigest', 'authorityOrigin', 'storageMode', 'manifestDigest'
    ], 'local anchored pairwise ledger manifest');
    if (manifest.schema !== MANIFEST_SCHEMA || manifest.version !== VERSION || manifest.status !== STATUS) throw new Error('manifest identity mismatch');
    text(manifest.logId, 'stored ledger log id', 180);
    const anchored = reference(manifest.genesisAnchoredCheckpointRef, 'stored genesis anchored checkpoint reference');
    const checkpoint = reference(manifest.genesisCheckpointRef, 'stored genesis checkpoint reference');
    const epoch = integer(manifest.genesisAnchorEpoch, 'stored genesis anchor epoch', 1, Number.MAX_SAFE_INTEGER);
    identity(manifest.anchorPolicyIdentity, 'stored anchor policy identity');
    digest(manifest.anchorProfileDigest, 'stored anchor profile digest');
    identity(manifest.witnessPolicyIdentity, 'stored witness policy identity');
    digest(manifest.witnessProfileDigest, 'stored witness profile digest');
    if (manifest.authorityOrigin !== AUTHORITY_ORIGIN || manifest.storageMode !== STORAGE_MODE) throw new Error('manifest authority or storage boundary mismatch');
    if (digest(manifest.manifestDigest, 'stored manifest digest') !== manifestDigest(manifest)) throw new Error('manifest digest mismatch');
    if (manifest.logId !== expected.logId) fail('LOG_ID_MISMATCH', 'ledger root is already bound to a different log id');
    if (!sameReference(anchored, expected.genesisAnchoredCheckpointRef) || !sameReference(checkpoint, expected.genesisCheckpointRef) || epoch !== expected.genesisAnchorEpoch) {
      fail('GENESIS_MISMATCH', 'ledger root is already bound to a different exact genesis head');
    }
    return manifest;
  } catch (error) {
    if (error instanceof AnchoredPairwiseLedgerError && ['LOG_ID_MISMATCH', 'GENESIS_MISMATCH'].includes(error.code)) throw error;
    fail('TRANSITION_LEDGER_MANIFEST_CORRUPT', 'local anchored pairwise ledger manifest is corrupt or boundary-invalid: ' + error.message);
  }
}

function pinnedProfilesMatch(manifest, transition) {
  return sameIdentity(manifest.anchorPolicyIdentity, transition.anchorPolicyIdentity) && manifest.anchorProfileDigest === transition.anchorProfileDigest &&
    sameIdentity(manifest.witnessPolicyIdentity, transition.witnessPolicyIdentity) && manifest.witnessProfileDigest === transition.witnessProfileDigest;
}

function buildEntry(input, context) {
  const validated = validateRecordInput(input);
  exactKeys(context, ['manifest', 'sequence', 'previousEntryRef', 'currentHead'], 'local anchored pairwise ledger entry context');
  const manifest = validateManifest(context.manifest, {
    logId: context.manifest.logId,
    genesisAnchoredCheckpointRef: context.manifest.genesisAnchoredCheckpointRef,
    genesisCheckpointRef: context.manifest.genesisCheckpointRef,
    genesisAnchorEpoch: context.manifest.genesisAnchorEpoch
  });
  const sequence = integer(context.sequence, 'local transition sequence', 1, MAX_ENTRIES);
  const previousEntryRef = context.previousEntryRef === null ? null : reference(context.previousEntryRef, 'previous local entry reference');
  const currentHead = {
    anchoredCheckpointRef: reference(context.currentHead.anchoredCheckpointRef, 'current anchored checkpoint head'),
    checkpointRef: reference(context.currentHead.checkpointRef, 'current checkpoint head'),
    anchorEpoch: integer(context.currentHead.anchorEpoch, 'current anchor epoch head', 1, Number.MAX_SAFE_INTEGER)
  };
  const presentedPrevious = headFromTransition(validated.transition, 'previous');
  if (!sameHead(presentedPrevious, currentHead)) fail('STALE_LOCAL_HEAD', 'v3.5 previous anchored package checkpoint or epoch does not match the exact current local head');
  if (!pinnedProfilesMatch(manifest, validated.transition)) fail('POLICY_PROFILE_MISMATCH', 'v3.5 transition policy identity or normalized profile does not match the pinned local ledger profile');
  const entry = {
    schema: ENTRY_SCHEMA,
    version: VERSION,
    status: STATUS,
    entryId: validated.entryId,
    recordedAt: validated.recordedAt,
    log: { logId: manifest.logId, authorityOrigin: AUTHORITY_ORIGIN, storageMode: STORAGE_MODE, sequence },
    manifestRef: manifestRef(manifest),
    previousEntryRef,
    transitionReceipt: clone(validated.transition.receipt),
    previousAnchoredCheckpointRef: clone(validated.transition.previousAnchored),
    candidateAnchoredCheckpointRef: clone(validated.transition.candidateAnchored),
    previousCheckpointRef: clone(validated.transition.previousCheckpoint),
    candidateCheckpointRef: clone(validated.transition.candidateCheckpoint),
    previousAnchorEpoch: validated.transition.previousEpoch,
    candidateAnchorEpoch: validated.transition.candidateEpoch,
    state: FORWARD_STATE,
    nextGate: NEXT_GATE,
    truth: entryTruth(),
    entryDigest: null
  };
  entry.entryDigest = entryDigest(entry);
  bound(entry, MAX_ARTIFACT_CANONICAL_BYTES, 'local anchored pairwise ledger entry');
  return entry;
}

function validateStoredEntry(value, context) {
  try {
    const entry = clone(value);
    exactKeys(entry, [
      'schema', 'version', 'status', 'entryId', 'recordedAt', 'log', 'manifestRef', 'previousEntryRef', 'transitionReceipt',
      'previousAnchoredCheckpointRef', 'candidateAnchoredCheckpointRef', 'previousCheckpointRef', 'candidateCheckpointRef',
      'previousAnchorEpoch', 'candidateAnchorEpoch', 'state', 'nextGate', 'truth', 'entryDigest'
    ], 'stored local anchored pairwise ledger entry');
    if (entry.schema !== ENTRY_SCHEMA || entry.version !== VERSION || entry.status !== STATUS) throw new Error('entry identity mismatch');
    text(entry.entryId, 'stored entry id', 180);
    timestamp(entry.recordedAt, 'stored entry recording time');
    exactKeys(entry.log, ['logId', 'authorityOrigin', 'storageMode', 'sequence'], 'stored entry log binding');
    if (entry.log.logId !== context.manifest.logId || entry.log.authorityOrigin !== AUTHORITY_ORIGIN || entry.log.storageMode !== STORAGE_MODE ||
        integer(entry.log.sequence, 'stored entry sequence', 1, MAX_ENTRIES) !== context.sequence) throw new Error('entry log binding mismatch');
    if (!sameReference(reference(entry.manifestRef, 'stored manifest reference'), manifestRef(context.manifest))) throw new Error('entry manifest reference mismatch');
    if (context.previousEntryRef === null ? entry.previousEntryRef !== null : !sameReference(reference(entry.previousEntryRef, 'stored previous entry reference'), context.previousEntryRef)) throw new Error('previous entry reference mismatch');
    const transition = validateStoredTransition(entry.transitionReceipt);
    const previousAnchored = reference(entry.previousAnchoredCheckpointRef, 'stored previous anchored checkpoint reference');
    const candidateAnchored = reference(entry.candidateAnchoredCheckpointRef, 'stored candidate anchored checkpoint reference');
    const previousCheckpoint = reference(entry.previousCheckpointRef, 'stored previous checkpoint reference');
    const candidateCheckpoint = reference(entry.candidateCheckpointRef, 'stored candidate checkpoint reference');
    const previousEpoch = integer(entry.previousAnchorEpoch, 'stored previous anchor epoch', 1, Number.MAX_SAFE_INTEGER);
    const candidateEpoch = integer(entry.candidateAnchorEpoch, 'stored candidate anchor epoch', 2, Number.MAX_SAFE_INTEGER);
    if (!sameReference(previousAnchored, transition.previousAnchored) || !sameReference(candidateAnchored, transition.candidateAnchored) ||
        !sameReference(previousCheckpoint, transition.previousCheckpoint) || !sameReference(candidateCheckpoint, transition.candidateCheckpoint) ||
        previousEpoch !== transition.previousEpoch || candidateEpoch !== transition.candidateEpoch) throw new Error('entry and transition head binding mismatch');
    if (!sameHead({ anchoredCheckpointRef: previousAnchored, checkpointRef: previousCheckpoint, anchorEpoch: previousEpoch }, context.currentHead)) throw new Error('entry does not consume exact current local head');
    if (!pinnedProfilesMatch(context.manifest, transition)) throw new Error('entry policy profile does not match manifest pin');
    if (entry.state !== FORWARD_STATE || entry.nextGate !== NEXT_GATE || !same(entry.truth, entryTruth())) throw new Error('entry state truth or next-gate boundary mismatch');
    if (digest(entry.entryDigest, 'stored entry digest') !== entryDigest(entry)) throw new Error('entry digest mismatch');
    return entry;
  } catch (error) {
    if (error instanceof AnchoredPairwiseLedgerError && error.code === 'TRANSITION_LEDGER_ENTRY_CORRUPT') throw error;
    fail('TRANSITION_LEDGER_ENTRY_CORRUPT', 'local anchored pairwise ledger entry is corrupt or boundary-invalid: ' + error.message);
  }
}

function assertDirectoryNotLink(directoryPath, label) {
  let stat;
  try { stat = fs.lstatSync(directoryPath); }
  catch (error) { fail('STATE_ROOT_INVALID', label + ' cannot be inspected: ' + error.message); }
  if (!stat.isDirectory() || stat.isSymbolicLink()) fail('STATE_ROOT_INVALID', label + ' must be a real directory and not a symbolic link or junction');
}

function createFixedDirectory(directoryPath, label) {
  try { fs.mkdirSync(directoryPath); }
  catch (error) { if (error.code !== 'EEXIST') fail('STATE_ROOT_INVALID', label + ' cannot be created: ' + error.message); }
  assertDirectoryNotLink(directoryPath, label);
}

function resolvePaths(stateRoot) {
  const root = path.resolve(text(stateRoot, 'local anchored pairwise ledger stateRoot', 32767));
  if (root === path.parse(root).root) fail('STATE_ROOT_INVALID', 'filesystem root cannot be a local transition ledger stateRoot');
  assertDirectoryNotLink(root, 'local anchored pairwise ledger stateRoot');
  return { root, namespace: path.join(root, NAMESPACE), entries: path.join(root, NAMESPACE, ENTRIES_DIRECTORY), manifest: path.join(root, NAMESPACE, MANIFEST_FILE) };
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
    if (error instanceof AnchoredPairwiseLedgerError) throw error;
    fail(code, label + ' is unreadable or invalid JSON');
  }
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

function configured(options) {
  return {
    logId: text(options.logId, 'configured local anchored pairwise ledger log id', 180),
    genesisAnchoredCheckpointRef: reference(options.genesisAnchoredCheckpointRef, 'configured genesis anchored checkpoint reference'),
    genesisCheckpointRef: reference(options.genesisCheckpointRef, 'configured genesis checkpoint reference'),
    genesisAnchorEpoch: integer(options.genesisAnchorEpoch, 'configured genesis anchor epoch', 1, Number.MAX_SAFE_INTEGER)
  };
}

function readManifest(paths, expected) {
  const parsed = readJsonFile(paths.manifest, 'TRANSITION_LEDGER_MANIFEST_CORRUPT', 'local anchored pairwise ledger manifest');
  return parsed === null ? null : validateManifest(parsed, expected);
}

function ensureManifest(paths, expected, transition) {
  const existing = readManifest(paths, expected);
  if (existing) return existing;
  if (fs.readdirSync(paths.namespace).length) {
    const raced = readManifest(paths, expected);
    if (raced) return raced;
    fail('TRANSITION_LEDGER_MANIFEST_MISSING', 'non-empty local transition ledger namespace has no manifest');
  }
  const manifest = buildManifest(expected.logId, transition);
  validateManifest(manifest, expected);
  if (!writeExclusive(paths.manifest, manifest, 'TRANSITION_LEDGER_MANIFEST')) return readManifest(paths, expected);
  return manifest;
}

function prepare(paths, expected, transition) {
  createFixedDirectory(paths.namespace, 'local anchored pairwise ledger namespace');
  const manifest = ensureManifest(paths, expected, transition);
  createFixedDirectory(paths.entries, 'local anchored pairwise ledger entries directory');
  return manifest;
}

function sequenceFile(sequence) { return String(sequence).padStart(12, '0') + '.json'; }

function buildSnapshot(manifest, entries, currentHead) {
  const snapshot = {
    schema: SNAPSHOT_SCHEMA,
    version: VERSION,
    status: STATUS,
    logId: manifest.logId,
    manifestRef: manifestRef(manifest),
    genesisAnchoredCheckpointRef: clone(manifest.genesisAnchoredCheckpointRef),
    genesisCheckpointRef: clone(manifest.genesisCheckpointRef),
    genesisAnchorEpoch: manifest.genesisAnchorEpoch,
    currentAnchoredCheckpointRef: clone(currentHead.anchoredCheckpointRef),
    currentCheckpointRef: clone(currentHead.checkpointRef),
    currentAnchorEpoch: currentHead.anchorEpoch,
    anchorPolicyIdentity: clone(manifest.anchorPolicyIdentity),
    anchorProfileDigest: manifest.anchorProfileDigest,
    witnessPolicyIdentity: clone(manifest.witnessPolicyIdentity),
    witnessProfileDigest: manifest.witnessProfileDigest,
    entryCount: entries.length,
    lastEntryRef: entries.length ? entryRef(entries[entries.length - 1]) : null,
    truth: snapshotTruth(),
    snapshotDigest: null
  };
  snapshot.snapshotDigest = snapshotDigest(snapshot);
  bound(snapshot, MAX_ARTIFACT_CANONICAL_BYTES, 'local anchored pairwise ledger snapshot');
  return snapshot;
}

function loadState(paths, expected) {
  assertDirectoryNotLink(paths.namespace, 'local anchored pairwise ledger namespace');
  const namespaceItems = fs.readdirSync(paths.namespace).sort();
  const unexpected = namespaceItems.filter(name => name !== MANIFEST_FILE && name !== ENTRIES_DIRECTORY);
  if (unexpected.length) fail('TRANSITION_LEDGER_NAMESPACE_CORRUPT', 'unexpected local ledger namespace items: ' + unexpected.join(', '));
  const manifest = readManifest(paths, expected);
  if (!manifest) { if (namespaceItems.length) fail('TRANSITION_LEDGER_MANIFEST_MISSING', 'non-empty local ledger namespace has no manifest'); return null; }
  if (!fs.existsSync(paths.entries)) fail('TRANSITION_LEDGER_NAMESPACE_CORRUPT', 'manifest exists without the fixed entries directory');
  assertDirectoryNotLink(paths.entries, 'local anchored pairwise ledger entries directory');
  const names = fs.readdirSync(paths.entries).sort();
  if (names.length > MAX_ENTRIES) fail('TRANSITION_LEDGER_RESOURCE_LIMIT', 'local ledger exceeds the entry-count bound');
  let totalBytes = fs.lstatSync(paths.manifest).size;
  const entries = [];
  const headBeforeEntry = [];
  const entryIds = new Set();
  const transitionIds = new Set();
  let currentHead = {
    anchoredCheckpointRef: clone(manifest.genesisAnchoredCheckpointRef),
    checkpointRef: clone(manifest.genesisCheckpointRef),
    anchorEpoch: manifest.genesisAnchorEpoch
  };
  let previousEntryRef = null;
  let previousRecordedAt = null;
  names.forEach((name, index) => {
    const match = ENTRY_FILE.exec(name);
    if (!match || Number(match[1]) !== index + 1) fail('TRANSITION_LEDGER_SEQUENCE_CORRUPT', 'entry filenames must be one contiguous 12-digit sequence');
    const filePath = path.join(paths.entries, name);
    totalBytes += fs.lstatSync(filePath).size;
    if (totalBytes > MAX_LEDGER_BYTES) fail('TRANSITION_LEDGER_RESOURCE_LIMIT', 'local ledger exceeds the aggregate byte bound');
    headBeforeEntry.push(clone(currentHead));
    const entry = validateStoredEntry(readJsonFile(filePath, 'TRANSITION_LEDGER_ENTRY_CORRUPT', 'local transition entry ' + name), {
      manifest, sequence: index + 1, previousEntryRef, currentHead
    });
    if (entryIds.has(entry.entryId)) fail('TRANSITION_LEDGER_ENTRY_CORRUPT', 'stored entry id is reused');
    if (transitionIds.has(entry.transitionReceipt.transitionId)) fail('TRANSITION_LEDGER_ENTRY_CORRUPT', 'stored transition id is reused');
    if (previousRecordedAt && Date.parse(entry.recordedAt) < Date.parse(previousRecordedAt)) fail('TRANSITION_LEDGER_ENTRY_CORRUPT', 'stored recording time moved backward');
    entryIds.add(entry.entryId);
    transitionIds.add(entry.transitionReceipt.transitionId);
    entries.push(entry);
    previousEntryRef = entryRef(entry);
    previousRecordedAt = entry.recordedAt;
    currentHead = {
      anchoredCheckpointRef: clone(entry.candidateAnchoredCheckpointRef),
      checkpointRef: clone(entry.candidateCheckpointRef),
      anchorEpoch: entry.candidateAnchorEpoch
    };
  });
  return { manifest, entries, headBeforeEntry, currentHead, snapshot: buildSnapshot(manifest, entries, currentHead), totalBytes };
}

function createService(options) {
  exactKeys(options, ['stateRoot', 'logId', 'genesisAnchoredCheckpointRef', 'genesisCheckpointRef', 'genesisAnchorEpoch'], 'local anchored pairwise ledger service options');
  const paths = resolvePaths(options.stateRoot);
  const expected = configured(options);

  function inspect() {
    if (!fs.existsSync(paths.namespace)) return null;
    const state = loadState(paths, expected);
    return state ? clone(state.snapshot) : null;
  }

  function record(input) {
    const validated = validateRecordInput(input);
    const configuredHead = { anchoredCheckpointRef: expected.genesisAnchoredCheckpointRef, checkpointRef: expected.genesisCheckpointRef, anchorEpoch: expected.genesisAnchorEpoch };
    if (!sameHead(headFromTransition(validated.transition, 'previous'), configuredHead) && !fs.existsSync(paths.namespace)) {
      fail('GENESIS_MISMATCH', 'first v3.5 transition does not consume the explicitly configured genesis head');
    }
    const manifest = prepare(paths, expected, validated.transition);
    const state = loadState(paths, expected);
    if (state.entries.some(entry => entry.entryId === validated.entryId)) fail('ENTRY_ID_ALREADY_USED', 'local transition entry id is already used');
    if (state.entries.some(entry => entry.transitionReceipt.transitionId === validated.transition.receipt.transitionId)) fail('TRANSITION_ID_ALREADY_USED', 'v3.5 transition id is already recorded');
    const context = {
      manifest,
      sequence: state.entries.length + 1,
      previousEntryRef: state.entries.length ? entryRef(state.entries[state.entries.length - 1]) : null,
      currentHead: state.currentHead
    };
    if (context.sequence > MAX_ENTRIES) fail('TRANSITION_LEDGER_RESOURCE_LIMIT', 'local ledger cannot exceed its entry-count bound');
    const entry = buildEntry(input, context);
    if (state.entries.length && Date.parse(entry.recordedAt) < Date.parse(state.entries[state.entries.length - 1].recordedAt)) fail('RECORDING_TIME_ROLLBACK', 'recording time cannot predate the prior local entry');
    if (state.totalBytes + Buffer.byteLength(stableStringify(entry) + '\n', 'utf8') > MAX_LEDGER_BYTES) fail('TRANSITION_LEDGER_RESOURCE_LIMIT', 'local ledger cannot exceed its aggregate byte bound');
    const filePath = path.join(paths.entries, sequenceFile(context.sequence));
    if (!writeExclusive(filePath, entry, 'TRANSITION_LEDGER_ENTRY')) {
      const afterRace = loadState(paths, expected);
      const existing = afterRace.entries[context.sequence - 1];
      if (existing && existing.entryDigest === entry.entryDigest) fail('TRANSITION_ALREADY_RECORDED', 'exact local transition entry is already recorded');
      if (!sameHead(afterRace.currentHead, state.currentHead)) fail('STALE_LOCAL_HEAD', 'another local transition advanced the exact head first');
      fail('TRANSITION_LEDGER_SEQUENCE_CONFLICT', 'next local sequence entry exists with different content');
    }
    const after = loadState(paths, expected);
    const stored = after.entries[context.sequence - 1];
    if (!stored || !same(stored, entry) || !sameHead(after.currentHead, headFromTransition(validated.transition, 'candidate'))) {
      fail('TRANSITION_LEDGER_POSTWRITE_INVALID', 'postwrite reload did not recover the exact entry and candidate head');
    }
    return clone(entry);
  }

  function verifyPersisted(input, receipt) {
    const errors = [];
    let rebuilt = null;
    let stored = null;
    try {
      const state = loadState(paths, expected);
      if (!state) throw new Error('local anchored pairwise ledger is absent');
      const candidate = clone(receipt);
      const sequence = candidate && candidate.log && candidate.log.sequence;
      if (!Number.isSafeInteger(sequence) || sequence < 1 || sequence > state.entries.length) throw new Error('persisted entry sequence is absent');
      stored = state.entries[sequence - 1];
      rebuilt = buildEntry(input, {
        manifest: state.manifest,
        sequence,
        previousEntryRef: sequence === 1 ? null : entryRef(state.entries[sequence - 2]),
        currentHead: state.headBeforeEntry[sequence - 1]
      });
      if (!same(rebuilt, candidate)) throw new Error('presented entry does not exact-rebuild from the caller package');
      if (!same(stored, rebuilt)) throw new Error('persisted entry does not match the exact rebuilt entry');
    } catch (error) { errors.push(error.message); }
    return { pass: errors.length === 0, errors, rebuilt, stored };
  }

  return Object.freeze({
    logId: expected.logId,
    genesisAnchoredCheckpointRef: clone(expected.genesisAnchoredCheckpointRef),
    genesisCheckpointRef: clone(expected.genesisCheckpointRef),
    genesisAnchorEpoch: expected.genesisAnchorEpoch,
    record,
    inspect,
    verifyPersisted
  });
}

module.exports = {
  ENTRY_SCHEMA,
  MANIFEST_SCHEMA,
  SNAPSHOT_SCHEMA,
  VERSION,
  STATUS,
  CONFIRMATION,
  AUTHORITY_ORIGIN,
  STORAGE_MODE,
  NAMESPACE,
  ENTRIES_DIRECTORY,
  MANIFEST_FILE,
  NEXT_GATE,
  MAX_INPUT_CANONICAL_BYTES,
  MAX_ARTIFACT_CANONICAL_BYTES,
  MAX_LEDGER_BYTES,
  MAX_ENTRIES,
  AnchoredPairwiseLedgerError,
  stableStringify,
  sha256,
  buildManifest,
  buildEntry,
  validateStoredTransition,
  validateStoredEntry,
  createService
};
