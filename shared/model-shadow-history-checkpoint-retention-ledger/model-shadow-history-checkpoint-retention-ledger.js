'use strict';

const fs = require('fs');
const path = require('path');
const Checkpoint = require('../model-shadow-portable-pin-settlement-history-checkpoint/model-shadow-portable-pin-settlement-history-checkpoint');

const MANIFEST_SCHEMA = 'axm.model-shadow-history-checkpoint-retention-ledger-manifest/v1';
const PROPOSAL_SCHEMA = 'axm.model-shadow-history-checkpoint-retention-ledger-proposal/v1';
const SETTLEMENT_SCHEMA = 'axm.model-shadow-history-checkpoint-retention-ledger-settlement/v1';
const SNAPSHOT_SCHEMA = 'axm.model-shadow-history-checkpoint-retention-ledger-snapshot/v1';
const AUDIT_SCHEMA = 'axm.model-shadow-history-checkpoint-retention-ledger-audit/v1';
const VERSION = '2.7.0';
const STATUS = 'TEST';
const NAMESPACE = 'model-shadow-history-checkpoint-retention-ledger';
const MANIFEST_FILE = 'ledger.json';
const PROPOSALS_DIRECTORY = 'proposals';
const SETTLEMENTS_DIRECTORY = 'settlements';
const LOCK_FILE = '.operation.lock';
const MODE = 'CALLER_OWNED_DISTINCT_LOCAL_CHECKPOINT_RETENTION_UNAUTHENTICATED';
const STORAGE_MODE = 'LOCAL_EXCLUSIVE_CREATE_FILE_FSYNC_TWO_PHASE_RETENTION_HEAD';
const PROPOSE_CONFIRMATION = 'PROPOSE_LOCAL_HISTORY_CHECKPOINT_RETENTION_REVIEW_REQUIRED';
const SETTLE_CONFIRMATION = 'SETTLE_LOCAL_HISTORY_CHECKPOINT_RETENTION_DECLARED_UNAUTHENTICATED';
const INITIAL_CLASSIFICATION = 'INITIAL_EXACT_CHECKPOINT_CAPTURE';
const FORWARD_CLASSIFICATION = 'FORWARD_HISTORY_EXTENSION';
const SETTLEMENT_CLASSIFICATION = 'LOCAL_HISTORY_CHECKPOINT_RETENTION_SETTLED';
const MAX_RECORDS = 10000;
const MAX_ARTIFACT_CANONICAL_BYTES = 20971520;
const MAX_AGGREGATE_STORAGE_BYTES = 268435456;
const MAX_SERVICE_OPTIONS_CANONICAL_BYTES = 1048576;
const MAX_PROPOSAL_INPUT_CANONICAL_BYTES = 335544320;
const MAX_SETTLEMENT_INPUT_CANONICAL_BYTES = 356515840;
const MAX_AUDIT_INPUT_CANONICAL_BYTES = 335544320;
const MAX_AUDIT_CANONICAL_BYTES = 2097152;
const SEQUENCE_FILE = /^(\d{12})\.json$/;

class HistoryCheckpointRetentionLedgerError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'HistoryCheckpointRetentionLedgerError';
    this.code = code;
  }
}

function fail(code, message) { throw new HistoryCheckpointRetentionLedgerError(code, message); }
function stableStringify(value) { return Checkpoint.stableStringify(value); }
function sha256(value) { return Checkpoint.sha256(value); }
function clone(value) { return JSON.parse(stableStringify(value)); }
function same(left, right) { return stableStringify(left) === stableStringify(right); }
function withoutField(value, field) { const result = clone(value); delete result[field]; return result; }
function canonicalBytes(value, code, label) {
  try { return Buffer.byteLength(stableStringify(value), 'utf8'); }
  catch (error) { fail(code, label + ' must be strict canonical JSON: ' + error.message); }
}
function bound(value, maximum, code, label) {
  if (canonicalBytes(value, code, label) > maximum) fail(code, label + ' exceeds ' + maximum + ' canonical UTF-8 bytes');
}
function exactKeys(value, allowed, code, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(code, label + ' must be an object');
  const actual = Object.keys(value).sort();
  const expected = allowed.slice().sort();
  if (!same(actual, expected)) fail(code, label + ' must contain exactly: ' + expected.join(', '));
}
function text(value, code, label, maximum) {
  if (typeof value !== 'string' || value.length < 1 || value.length > maximum || /[\u0000-\u001f\u007f]/.test(value)) {
    fail(code, label + ' must be bounded non-control text');
  }
  return value;
}
function digest(value, code, label) {
  if (typeof value !== 'string' || !/^sha256:[a-f0-9]{64}$/.test(value)) fail(code, label + ' must be an exact SHA-256 digest');
  return value;
}
function timestamp(value, code, label) {
  text(value, code, label, 40);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) || !Number.isFinite(Date.parse(value))) {
    fail(code, label + ' must be canonical UTC milliseconds');
  }
  return value;
}
function reference(value, code, label) {
  exactKeys(value, ['id', 'schema', 'sha256'], code, label);
  return {
    id: text(value.id, code, label + '.id', 180),
    schema: text(value.schema, code, label + '.schema', 180),
    sha256: digest(value.sha256, code, label + '.sha256')
  };
}
function nullableReference(value, code, label) { return value === null ? null : reference(value, code, label); }
function sameReference(left, right) { return same(left, right); }
function sameNullableReference(left, right) { return left === null || right === null ? left === right : sameReference(left, right); }
function manifestRef(value) { return { id: value.retentionLogId, schema: value.schema, sha256: value.manifestDigest }; }
function proposalRef(value) { return { id: value.proposalId, schema: value.schema, sha256: value.proposalDigest }; }
function settlementRef(value) { return { id: value.settlementId, schema: value.schema, sha256: value.settlementDigest }; }
function checkpointRef(value) { return { id: value.checkpointId, schema: value.schema, sha256: value.checkpointDigest }; }
function auditRef(value) { return { id: value.auditId, schema: value.schema, sha256: value.auditDigest }; }
function sequenceFile(sequence) { return String(sequence).padStart(12, '0') + '.json'; }

function manifestTruth() {
  return {
    canonicalSelfDigestedManifest: true,
    callerOwnedLocalRetentionRoot: true,
    localExclusiveCreateIntended: true,
    localFileFsyncIntended: true,
    directoryEntryOrHardwareDurabilityProven: false,
    externalRetentionProven: false,
    protectedMonotonicStateProven: false,
    deletionOrRollbackPrevented: false,
    hostAuthorizationAuthenticated: false,
    actualHumanParticipationProven: false,
    automaticInstall: false,
    automaticPromotion: false,
    automaticMerge: false,
    automaticCanon: false,
    foundationMutation: false
  };
}
function proposalTruth(classification) {
  return {
    v26CheckpointSelfDigestValidated: true,
    v26CheckpointOriginExactRebuiltBeforeWrite: true,
    retentionRootDistinctAndNonnestedFromSourceRoot: true,
    initialCapture: classification === INITIAL_CLASSIFICATION,
    forwardFromSettledRetentionHead: classification === FORWARD_CLASSIFICATION,
    fullCheckpointPersistedInProposal: true,
    proposalConfirmationObserved: true,
    proposalIsPendingObservation: true,
    localSettledRetentionHeadAdvanced: false,
    localProposalExclusiveCreateAndFileFsyncCompleted: true,
    transientV25OperationLockMayBeWritten: true,
    durableSourceLedgerStateChangedByModule: false,
    sourceCurrentAfterFinalReadProven: false,
    directoryEntryOrHardwareDurabilityProven: false,
    checkpointOriginAuthenticated: false,
    externalRetentionProven: false,
    protectedMonotonicStateProven: false,
    deletionOrRollbackPrevented: false,
    globallyConsistentLogProven: false,
    hostAuthorizationAuthenticated: false,
    actualHumanParticipationProven: false,
    executionAuthorized: false,
    adoptionAuthorized: false,
    providerInvoked: false,
    evaluationPerformed: false,
    humanBenefitProven: false,
    broadLearningClaimed: false,
    rawPublicKeyEmbedded: false,
    rawSignatureEmbedded: false,
    privateKeyIngested: false,
    sourceOrLedgerPathEmbedded: false,
    rawUpstreamPackageEmbedded: false,
    rawModelOutputEmbedded: false,
    privateContextEmbedded: false,
    automaticPermissionGrant: false,
    automaticInstall: false,
    automaticPromotion: false,
    automaticMerge: false,
    automaticCanon: false,
    foundationMutation: false
  };
}
function settlementTruth() {
  return {
    pendingProposalExactRebuiltFromCallerPackageAndStoredReceipt: true,
    embeddedV26CheckpointSelfDigestValidated: true,
    separateSettlementConfirmationObserved: true,
    localSettledRetentionHeadAdvanced: true,
    advanceLimitedToConfiguredLocalRetentionLedger: true,
    localSettlementExclusiveCreateAndFileFsyncCompleted: true,
    checkpointOriginReauthenticatedAtSettlement: true,
    transientV25OperationLockMayBeWritten: true,
    durableSourceLedgerStateChangedByModule: false,
    sourceCurrentAfterFinalReadProven: false,
    declaredConfirmationAuthenticatesHost: false,
    actualHumanParticipationProven: false,
    externalRetentionProven: false,
    protectedMonotonicStateProven: false,
    deletionOrRollbackPrevented: false,
    globallyConsistentLogProven: false,
    executionAuthorized: false,
    adoptionAuthorized: false,
    providerInvoked: false,
    evaluationPerformed: false,
    humanBenefitProven: false,
    broadLearningClaimed: false,
    rawPublicKeyEmbedded: false,
    rawSignatureEmbedded: false,
    privateKeyIngested: false,
    sourceOrLedgerPathEmbedded: false,
    rawUpstreamPackageEmbedded: false,
    rawModelOutputEmbedded: false,
    privateContextEmbedded: false,
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
    manifestValidated: true,
    contiguousProposalAndSettlementSequencesValidated: true,
    completeProposalAndSettlementDigestChainsValidated: true,
    everyEmbeddedV26CheckpointSelfDigestValidated: true,
    everyPostInitialCheckpointStrictlyForwardFromPreviousSettledHead: true,
    currentSettledRetentionHeadDerivedOnlyFromSettlements: true,
    latestPersistedObservationDerivedFromProposals: true,
    atMostOneTrailingPendingProposal: true,
    localFilesReloaded: true,
    transientRetentionOperationLockWritten: true,
    callerOriginPackagesRequiredForUpstreamExactReverification: true,
    localCheckpointRetentionObserved: true,
    directoryEntryOrHardwareDurabilityProven: false,
    externalRetentionProven: false,
    protectedMonotonicStateProven: false,
    deletionOrRollbackPrevented: false,
    independentRootsExcluded: false,
    globallyConsistentLogProven: false,
    hostAuthorizationAuthenticated: false,
    actualHumanParticipationProven: false,
    providerInvoked: false,
    humanBenefitProven: false,
    broadLearningClaimed: false,
    automaticInstall: false,
    automaticPromotion: false,
    automaticMerge: false,
    automaticCanon: false,
    foundationMutation: false
  };
}
function auditTruth(classification, selectionStatus, upstreamTruth) {
  return {
    retentionManifestReloaded: true,
    completeRetentionChainValidated: true,
    latestPersistedCheckpointSelectedWithoutCallerCheckpointPresentation: true,
    latestPersistedCheckpointPending: selectionStatus === 'PENDING',
    latestPersistedCheckpointSettled: selectionStatus === 'SETTLED',
    pendingObservationGrantsSettledAuthority: false,
    retainedCheckpointSelfDigestValidated: true,
    retainedCheckpointOriginReauthenticatedAtAudit: false,
    currentSourceValidatedByV26Audit: upstreamTruth.currentLedgerValidatedByV25Reload,
    sourceRollbackObserved: classification === 'OBSERVED_STRICT_HISTORY_ROLLBACK_RELATIVE_TO_PRESENTED_CHECKPOINT',
    sourceAbsenceObserved: classification === 'OBSERVED_LEDGER_ABSENT',
    sourceReplacementOrForkObserved: classification === 'OBSERVED_HISTORY_REPLACEMENT_OR_FORK_RELATIVE_TO_PRESENTED_CHECKPOINT',
    retentionRootDistinctAndNonnestedFromPresentedSourceRoot: true,
    localCheckpointRetentionObserved: true,
    transientRetentionOperationLockWritten: true,
    transientV25OperationLockMayBeWritten: upstreamTruth.transientV25OperationLockMayBeWritten,
    durableSourceLedgerStateChangedByModule: false,
    auditReceiptPersistedByModule: false,
    directoryEntryOrHardwareDurabilityProven: false,
    checkpointOriginAuthenticated: false,
    externalRetentionProven: false,
    protectedMonotonicStateProven: false,
    deletionOrRollbackPrevented: false,
    withheldOrJointlyReplacedRootsExcluded: false,
    globalTransitionUniquenessProven: false,
    globallyConsistentLogProven: false,
    hostAuthorizationAuthenticated: false,
    actorRealWorldIdentityProven: false,
    actualHumanParticipationProven: false,
    timeExternallyTrusted: false,
    rawPublicKeyEmbedded: false,
    rawSignatureEmbedded: false,
    privateKeyIngested: false,
    sourceOrLedgerPathEmbedded: false,
    rawUpstreamPackageEmbedded: false,
    rawModelOutputEmbedded: false,
    privateContextEmbedded: false,
    experimentExecuted: false,
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

function buildManifest(retentionLogId, createdAt) {
  const result = {
    schema: MANIFEST_SCHEMA,
    version: VERSION,
    status: STATUS,
    retentionLogId,
    createdAt,
    mode: MODE,
    storageMode: STORAGE_MODE,
    truth: manifestTruth(),
    manifestDigest: null
  };
  result.manifestDigest = sha256(withoutField(result, 'manifestDigest'));
  bound(result, MAX_ARTIFACT_CANONICAL_BYTES, 'RETENTION_MANIFEST_TOO_LARGE', 'retention manifest');
  return result;
}
function validateManifest(value, expected) {
  try {
    exactKeys(value, ['schema', 'version', 'status', 'retentionLogId', 'createdAt', 'mode', 'storageMode', 'truth', 'manifestDigest'], 'RETENTION_MANIFEST_CORRUPT', 'stored retention manifest');
    if (value.schema !== MANIFEST_SCHEMA || value.version !== VERSION || value.status !== STATUS || value.mode !== MODE || value.storageMode !== STORAGE_MODE) {
      throw new Error('manifest identity mismatch');
    }
    text(value.retentionLogId, 'RETENTION_MANIFEST_CORRUPT', 'stored retention log id', 180);
    timestamp(value.createdAt, 'RETENTION_MANIFEST_CORRUPT', 'stored retention manifest creation time');
    if (value.retentionLogId !== expected.retentionLogId || value.createdAt !== expected.createdAt) throw new Error('manifest does not match configured identity');
    if (!same(value.truth, manifestTruth())) throw new Error('manifest truth boundary mismatch');
    if (digest(value.manifestDigest, 'RETENTION_MANIFEST_CORRUPT', 'stored manifest digest') !== sha256(withoutField(value, 'manifestDigest'))) throw new Error('manifest digest mismatch');
    return clone(value);
  } catch (error) {
    if (error instanceof HistoryCheckpointRetentionLedgerError && error.code === 'RETENTION_MANIFEST_CORRUPT') throw error;
    fail('RETENTION_MANIFEST_CORRUPT', 'stored retention manifest is corrupt or boundary-invalid: ' + error.message);
  }
}

function histories(checkpoint) {
  return [checkpoint.history.proposalRefs, checkpoint.history.settlementRefs, checkpoint.history.settledPinRefs];
}
function commonPrefixCount(left, right) {
  const maximum = Math.min(left.length, right.length);
  let index = 0;
  while (index < maximum && sameReference(left[index], right[index])) index += 1;
  return index;
}
function isPrefix(prefix, value) { return prefix.length <= value.length && commonPrefixCount(prefix, value) === prefix.length; }
function sameCheckpointIdentity(left, right) {
  return left.logIdDigest === right.logIdDigest && sameReference(left.manifestRef, right.manifestRef) && sameReference(left.genesisPinRef, right.genesisPinRef);
}
function checkpointRelation(previous, candidate) {
  if (!sameCheckpointIdentity(previous, candidate)) return 'OBSERVED_LEDGER_IDENTITY_DRIFT';
  const previousHistory = histories(previous);
  const candidateHistory = histories(candidate);
  const previousPrefixesCandidate = previousHistory.every((items, index) => isPrefix(items, candidateHistory[index]));
  const candidatePrefixesPrevious = candidateHistory.every((items, index) => isPrefix(items, previousHistory[index]));
  const sameLengths = previousHistory.every((items, index) => items.length === candidateHistory[index].length);
  if (sameLengths && previousPrefixesCandidate && same(previous.snapshotBinding, candidate.snapshotBinding)) return 'EXACT_HISTORY_MATCH';
  if (previousPrefixesCandidate && !sameLengths) return FORWARD_CLASSIFICATION;
  if (candidatePrefixesPrevious && !sameLengths) return 'OBSERVED_STRICT_HISTORY_ROLLBACK_RELATIVE_TO_PRESENTED_CHECKPOINT';
  return 'OBSERVED_HISTORY_REPLACEMENT_OR_FORK_RELATIVE_TO_PRESENTED_CHECKPOINT';
}
function nonForwardCode(classification) {
  if (classification === 'EXACT_HISTORY_MATCH') return 'RETENTION_CHECKPOINT_REPLAY';
  if (classification === 'OBSERVED_STRICT_HISTORY_ROLLBACK_RELATIVE_TO_PRESENTED_CHECKPOINT') return 'RETENTION_CHECKPOINT_ROLLBACK';
  if (classification === 'OBSERVED_HISTORY_REPLACEMENT_OR_FORK_RELATIVE_TO_PRESENTED_CHECKPOINT') return 'RETENTION_CHECKPOINT_REPLACEMENT_OR_FORK';
  if (classification === 'OBSERVED_LEDGER_IDENTITY_DRIFT') return 'RETENTION_CHECKPOINT_IDENTITY_DRIFT';
  if (classification === 'OBSERVED_LEDGER_ABSENT') return 'RETENTION_SOURCE_ABSENT';
  return 'RETENTION_SOURCE_INVALID';
}

function resolvedRoot(value, code, label) {
  const result = path.resolve(text(value, code, label, 32767));
  if (result === path.parse(result).root) fail(code, label + ' cannot be a filesystem root');
  return result;
}
function rootsOverlap(left, right) {
  const leftKey = process.platform === 'win32' ? left.toLowerCase() : left;
  const rightKey = process.platform === 'win32' ? right.toLowerCase() : right;
  return leftKey === rightKey || leftKey.startsWith(rightKey + path.sep) || rightKey.startsWith(leftKey + path.sep);
}
function assertDistinctSourceRoot(retentionRoot, checkpointInput, code) {
  if (!checkpointInput || !checkpointInput.serviceOptions || typeof checkpointInput.serviceOptions.stateRoot !== 'string') {
    fail(code, 'checkpoint origin package has no source state root');
  }
  const sourceRoot = resolvedRoot(checkpointInput.serviceOptions.stateRoot, code, 'checkpoint source state root');
  if (rootsOverlap(retentionRoot, sourceRoot)) fail(code, 'retention and source roots must be distinct and nonnested');
  return sourceRoot;
}
function prevalidateProposalInput(input, retentionRoot) {
  bound(input, MAX_PROPOSAL_INPUT_CANONICAL_BYTES, 'RETENTION_PROPOSAL_INPUT_TOO_LARGE', 'retention proposal input');
  exactKeys(input, ['proposalId', 'proposedAt', 'confirmation', 'checkpointInput', 'checkpoint'], 'INVALID_RETENTION_PROPOSAL_INPUT', 'retention proposal input');
  const proposalId = text(input.proposalId, 'INVALID_RETENTION_PROPOSAL_INPUT', 'retention proposal id', 180);
  const proposedAt = timestamp(input.proposedAt, 'INVALID_RETENTION_PROPOSAL_INPUT', 'retention proposal time');
  if (input.confirmation !== PROPOSE_CONFIRMATION) fail('RETENTION_PROPOSAL_CONFIRMATION_REQUIRED', 'exact retention proposal confirmation is required');
  assertDistinctSourceRoot(retentionRoot, input.checkpointInput, 'RETENTION_ROOT_OVERLAP');
  let checkpoint;
  try { checkpoint = Checkpoint.validateCheckpoint(input.checkpoint); }
  catch (error) { fail('RETENTION_CHECKPOINT_INVALID', 'presented v2.6 checkpoint is invalid: ' + error.message); }
  const verification = Checkpoint.verifyCheckpointOrigin(clone(input.checkpointInput), clone(checkpoint));
  if (!verification.pass) fail('RETENTION_CHECKPOINT_ORIGIN_INVALID', 'presented checkpoint does not exact-rebuild from its v2.6 origin package: ' + verification.errors.join('; '));
  if (Date.parse(proposedAt) < Date.parse(checkpoint.checkpointedAt)) fail('RETENTION_PROPOSAL_TIME_INVALID', 'retention proposal cannot predate checkpoint');
  return { proposalId, proposedAt, checkpoint: verification.rebuilt };
}
function buildProposal(input, context) {
  const validated = prevalidateProposalInput(input, context.retentionRoot);
  if (Date.parse(validated.proposedAt) < Date.parse(context.manifest.createdAt)) fail('RETENTION_PROPOSAL_TIME_INVALID', 'retention proposal cannot predate manifest');
  if (context.lastSettlementTime && Date.parse(validated.proposedAt) < Date.parse(context.lastSettlementTime)) {
    fail('RETENTION_PROPOSAL_TIME_INVALID', 'retention proposal cannot predate prior settlement');
  }
  let classification = INITIAL_CLASSIFICATION;
  if (context.currentSettledCheckpoint) {
    if (Date.parse(validated.checkpoint.checkpointedAt) < Date.parse(context.currentSettledCheckpoint.checkpointedAt)) {
      fail('RETENTION_CHECKPOINT_ROLLBACK', 'candidate checkpoint time predates settled retention head');
    }
    let audit;
    try {
      audit = Checkpoint.auditCheckpoint({
        auditId: validated.proposalId,
        auditedAt: validated.proposedAt,
        checkpoint: clone(context.currentSettledCheckpoint),
        current: {
          serviceOptions: clone(input.checkpointInput.serviceOptions),
          records: clone(input.checkpointInput.records)
        }
      });
    } catch (error) {
      fail('RETENTION_SOURCE_CHANGED_OR_INVALID', 'candidate source could not be audited against settled retention head: ' + error.message);
    }
    classification = audit.classification;
    if (classification !== FORWARD_CLASSIFICATION) {
      fail(nonForwardCode(classification), 'candidate checkpoint is not a strict forward extension of settled retention head: ' + classification);
    }
  }
  const result = {
    schema: PROPOSAL_SCHEMA,
    version: VERSION,
    status: STATUS,
    proposalId: validated.proposalId,
    proposedAt: validated.proposedAt,
    mode: MODE,
    log: {
      retentionLogId: context.manifest.retentionLogId,
      sequence: context.sequence,
      previousProposalRef: context.previousProposalRef ? clone(context.previousProposalRef) : null
    },
    manifestRef: manifestRef(context.manifest),
    previousSettledCheckpointRef: context.currentSettledCheckpoint ? checkpointRef(context.currentSettledCheckpoint) : null,
    checkpoint: clone(validated.checkpoint),
    classification,
    decision: {
      localObservationPersisted: true,
      retentionSettlementPending: true,
      localSettledRetentionHeadAdvanced: false,
      executionAuthorized: false,
      adoptionAuthorized: false,
      autonomousActionCount: 0
    },
    state: 'LOCAL_CHECKPOINT_OBSERVATION_PERSISTED_PENDING_SEPARATE_RETENTION_SETTLEMENT',
    truth: proposalTruth(classification),
    proposalDigest: null
  };
  result.proposalDigest = sha256(withoutField(result, 'proposalDigest'));
  bound(result, MAX_ARTIFACT_CANONICAL_BYTES, 'RETENTION_PROPOSAL_TOO_LARGE', 'retention proposal');
  return result;
}
function validateStoredProposal(value, context) {
  try {
    exactKeys(value, ['schema', 'version', 'status', 'proposalId', 'proposedAt', 'mode', 'log', 'manifestRef', 'previousSettledCheckpointRef', 'checkpoint', 'classification', 'decision', 'state', 'truth', 'proposalDigest'], 'RETENTION_PROPOSAL_CORRUPT', 'stored retention proposal');
    if (value.schema !== PROPOSAL_SCHEMA || value.version !== VERSION || value.status !== STATUS || value.mode !== MODE) throw new Error('proposal identity mismatch');
    text(value.proposalId, 'RETENTION_PROPOSAL_CORRUPT', 'stored proposal id', 180);
    timestamp(value.proposedAt, 'RETENTION_PROPOSAL_CORRUPT', 'stored proposal time');
    exactKeys(value.log, ['retentionLogId', 'sequence', 'previousProposalRef'], 'RETENTION_PROPOSAL_CORRUPT', 'stored proposal log');
    if (value.log.retentionLogId !== context.manifest.retentionLogId || value.log.sequence !== context.sequence) throw new Error('proposal log identity or sequence mismatch');
    if (!sameNullableReference(nullableReference(value.log.previousProposalRef, 'RETENTION_PROPOSAL_CORRUPT', 'stored previous proposal reference'), context.previousProposalRef)) throw new Error('previous proposal reference mismatch');
    if (!sameReference(reference(value.manifestRef, 'RETENTION_PROPOSAL_CORRUPT', 'stored proposal manifest reference'), manifestRef(context.manifest))) throw new Error('proposal manifest reference mismatch');
    const checkpoint = Checkpoint.validateCheckpoint(value.checkpoint);
    const previousSettledRef = nullableReference(value.previousSettledCheckpointRef, 'RETENTION_PROPOSAL_CORRUPT', 'stored previous settled checkpoint reference');
    const expectedClassification = context.currentSettledCheckpoint ? FORWARD_CLASSIFICATION : INITIAL_CLASSIFICATION;
    const expectedPreviousRef = context.currentSettledCheckpoint ? checkpointRef(context.currentSettledCheckpoint) : null;
    if (!sameNullableReference(previousSettledRef, expectedPreviousRef)) throw new Error('previous settled checkpoint reference mismatch');
    if (value.classification !== expectedClassification) throw new Error('proposal classification mismatch');
    if (context.currentSettledCheckpoint && checkpointRelation(context.currentSettledCheckpoint, checkpoint) !== FORWARD_CLASSIFICATION) throw new Error('stored checkpoint is not a strict forward extension');
    if (context.currentSettledCheckpoint && Date.parse(checkpoint.checkpointedAt) < Date.parse(context.currentSettledCheckpoint.checkpointedAt)) throw new Error('stored checkpoint time regresses');
    if (Date.parse(value.proposedAt) < Date.parse(checkpoint.checkpointedAt) || Date.parse(value.proposedAt) < Date.parse(context.manifest.createdAt)) throw new Error('stored proposal time precedes checkpoint or manifest');
    if (context.lastSettlementTime && Date.parse(value.proposedAt) < Date.parse(context.lastSettlementTime)) throw new Error('stored proposal predates previous settlement');
    if (!same(value.decision, { localObservationPersisted: true, retentionSettlementPending: true, localSettledRetentionHeadAdvanced: false, executionAuthorized: false, adoptionAuthorized: false, autonomousActionCount: 0 })) throw new Error('proposal decision mismatch');
    if (value.state !== 'LOCAL_CHECKPOINT_OBSERVATION_PERSISTED_PENDING_SEPARATE_RETENTION_SETTLEMENT') throw new Error('proposal state mismatch');
    if (!same(value.truth, proposalTruth(expectedClassification))) throw new Error('proposal truth boundary mismatch');
    if (digest(value.proposalDigest, 'RETENTION_PROPOSAL_CORRUPT', 'stored proposal digest') !== sha256(withoutField(value, 'proposalDigest'))) throw new Error('proposal digest mismatch');
    return clone(value);
  } catch (error) {
    if (error instanceof HistoryCheckpointRetentionLedgerError && error.code === 'RETENTION_PROPOSAL_CORRUPT') throw error;
    fail('RETENTION_PROPOSAL_CORRUPT', 'stored retention proposal is corrupt or boundary-invalid: ' + error.message);
  }
}

function validateSettlementInput(input) {
  bound(input, MAX_SETTLEMENT_INPUT_CANONICAL_BYTES, 'RETENTION_SETTLEMENT_INPUT_TOO_LARGE', 'retention settlement input');
  exactKeys(input, ['settlementId', 'settledAt', 'confirmation', 'proposalInput', 'proposalReceipt'], 'INVALID_RETENTION_SETTLEMENT_INPUT', 'retention settlement input');
  const settlementId = text(input.settlementId, 'INVALID_RETENTION_SETTLEMENT_INPUT', 'retention settlement id', 180);
  const settledAt = timestamp(input.settledAt, 'INVALID_RETENTION_SETTLEMENT_INPUT', 'retention settlement time');
  if (input.confirmation !== SETTLE_CONFIRMATION) fail('RETENTION_SETTLEMENT_CONFIRMATION_REQUIRED', 'exact retention settlement confirmation is required');
  bound(input.proposalReceipt, MAX_ARTIFACT_CANONICAL_BYTES, 'RETENTION_SETTLEMENT_INPUT_TOO_LARGE', 'presented retention proposal receipt');
  return { settlementId, settledAt };
}
function buildSettlement(input, proposal, manifest) {
  const validated = validateSettlementInput(input);
  if (!same(input.proposalReceipt, proposal)) fail('RETENTION_PROPOSAL_PACKAGE_MISMATCH', 'settlement proposal receipt does not match exact rebuilt proposal');
  if (Date.parse(validated.settledAt) < Date.parse(proposal.proposedAt)) fail('RETENTION_SETTLEMENT_TIME_INVALID', 'retention settlement cannot predate proposal');
  const result = {
    schema: SETTLEMENT_SCHEMA,
    version: VERSION,
    status: STATUS,
    settlementId: validated.settlementId,
    settledAt: validated.settledAt,
    mode: MODE,
    log: clone(proposal.log),
    manifestRef: manifestRef(manifest),
    proposalRef: proposalRef(proposal),
    previousSettledCheckpointRef: clone(proposal.previousSettledCheckpointRef),
    settledCheckpointRef: checkpointRef(proposal.checkpoint),
    classification: SETTLEMENT_CLASSIFICATION,
    decision: {
      localSettledRetentionHeadAdvanced: true,
      executionAuthorized: false,
      adoptionAuthorized: false,
      autonomousActionCount: 0
    },
    state: 'DECLARED_RETENTION_SETTLEMENT_RECORDED_LOCAL_HEAD_ADVANCED_AUTHORITY_AND_PROTECTION_NOT_PROVEN',
    truth: settlementTruth(),
    settlementDigest: null
  };
  result.settlementDigest = sha256(withoutField(result, 'settlementDigest'));
  bound(result, MAX_ARTIFACT_CANONICAL_BYTES, 'RETENTION_SETTLEMENT_TOO_LARGE', 'retention settlement');
  return result;
}
function validateStoredSettlement(value, context) {
  try {
    exactKeys(value, ['schema', 'version', 'status', 'settlementId', 'settledAt', 'mode', 'log', 'manifestRef', 'proposalRef', 'previousSettledCheckpointRef', 'settledCheckpointRef', 'classification', 'decision', 'state', 'truth', 'settlementDigest'], 'RETENTION_SETTLEMENT_CORRUPT', 'stored retention settlement');
    if (value.schema !== SETTLEMENT_SCHEMA || value.version !== VERSION || value.status !== STATUS || value.mode !== MODE) throw new Error('settlement identity mismatch');
    text(value.settlementId, 'RETENTION_SETTLEMENT_CORRUPT', 'stored settlement id', 180);
    timestamp(value.settledAt, 'RETENTION_SETTLEMENT_CORRUPT', 'stored settlement time');
    if (Date.parse(value.settledAt) < Date.parse(context.proposal.proposedAt)) throw new Error('settlement predates proposal');
    if (!same(value.log, context.proposal.log)) throw new Error('settlement log mismatch');
    if (!sameReference(reference(value.manifestRef, 'RETENTION_SETTLEMENT_CORRUPT', 'stored settlement manifest reference'), manifestRef(context.manifest))) throw new Error('settlement manifest mismatch');
    if (!sameReference(reference(value.proposalRef, 'RETENTION_SETTLEMENT_CORRUPT', 'stored settlement proposal reference'), proposalRef(context.proposal))) throw new Error('settlement proposal mismatch');
    if (!sameNullableReference(nullableReference(value.previousSettledCheckpointRef, 'RETENTION_SETTLEMENT_CORRUPT', 'stored previous settled checkpoint reference'), context.proposal.previousSettledCheckpointRef)) throw new Error('settlement previous checkpoint mismatch');
    if (!sameReference(reference(value.settledCheckpointRef, 'RETENTION_SETTLEMENT_CORRUPT', 'stored settled checkpoint reference'), checkpointRef(context.proposal.checkpoint))) throw new Error('settled checkpoint mismatch');
    if (value.classification !== SETTLEMENT_CLASSIFICATION) throw new Error('settlement classification mismatch');
    if (!same(value.decision, { localSettledRetentionHeadAdvanced: true, executionAuthorized: false, adoptionAuthorized: false, autonomousActionCount: 0 })) throw new Error('settlement decision mismatch');
    if (value.state !== 'DECLARED_RETENTION_SETTLEMENT_RECORDED_LOCAL_HEAD_ADVANCED_AUTHORITY_AND_PROTECTION_NOT_PROVEN') throw new Error('settlement state mismatch');
    if (!same(value.truth, settlementTruth())) throw new Error('settlement truth boundary mismatch');
    if (digest(value.settlementDigest, 'RETENTION_SETTLEMENT_CORRUPT', 'stored settlement digest') !== sha256(withoutField(value, 'settlementDigest'))) throw new Error('settlement digest mismatch');
    return clone(value);
  } catch (error) {
    if (error instanceof HistoryCheckpointRetentionLedgerError && error.code === 'RETENTION_SETTLEMENT_CORRUPT') throw error;
    fail('RETENTION_SETTLEMENT_CORRUPT', 'stored retention settlement is corrupt or boundary-invalid: ' + error.message);
  }
}

function assertDirectoryNotLink(directoryPath, code, label) {
  let stat;
  try { stat = fs.lstatSync(directoryPath); }
  catch (error) { fail(code, label + ' cannot be inspected: ' + error.message); }
  if (!stat.isDirectory() || stat.isSymbolicLink()) fail(code, label + ' must be a real directory and not a symbolic link or junction');
}
function createFixedDirectory(directoryPath, code, label) {
  try { fs.mkdirSync(directoryPath); }
  catch (error) { if (error.code !== 'EEXIST') fail(code, label + ' cannot be created: ' + error.message); }
  assertDirectoryNotLink(directoryPath, code, label);
}
function resolvePaths(stateRoot) {
  const root = resolvedRoot(stateRoot, 'RETENTION_STATE_ROOT_INVALID', 'retention state root');
  assertDirectoryNotLink(root, 'RETENTION_STATE_ROOT_INVALID', 'retention state root');
  return {
    root,
    namespace: path.join(root, NAMESPACE),
    proposals: path.join(root, NAMESPACE, PROPOSALS_DIRECTORY),
    settlements: path.join(root, NAMESPACE, SETTLEMENTS_DIRECTORY)
  };
}
function readJsonFile(filePath, code, label) {
  let stat;
  try { stat = fs.lstatSync(filePath); }
  catch (error) { if (error.code === 'ENOENT') return null; fail(code, label + ' cannot be inspected: ' + error.message); }
  if (!stat.isFile() || stat.isSymbolicLink()) fail(code, label + ' must be a regular file and not a symbolic link');
  if (stat.size > MAX_ARTIFACT_CANONICAL_BYTES + 1) fail(code, label + ' exceeds the bounded file byte limit');
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    if (raw !== stableStringify(parsed) + '\n') fail(code, label + ' is not exact canonical JSON');
    return parsed;
  } catch (error) {
    if (error instanceof HistoryCheckpointRetentionLedgerError) throw error;
    fail(code, label + ' is unreadable or invalid JSON');
  }
}
function writeExclusive(filePath, value, prefix) {
  let descriptor;
  try { descriptor = fs.openSync(filePath, 'wx', 0o600); }
  catch (error) {
    if (error.code === 'EEXIST') return false;
    fail(prefix + '_WRITE_FAILED', 'exclusive file create failed: ' + error.message);
  }
  let problem = null;
  try {
    fs.writeFileSync(descriptor, stableStringify(value) + '\n', { encoding: 'utf8' });
    fs.fsyncSync(descriptor);
  } catch (error) { problem = error; }
  finally {
    try { fs.closeSync(descriptor); }
    catch (error) { if (!problem) problem = error; }
  }
  if (problem) fail(prefix + '_DURABILITY_UNCERTAIN', 'file write or fsync did not complete; retained state requires steward inspection: ' + problem.message);
  return true;
}
function withOperationLock(paths, operation) {
  const lockPath = path.join(paths.namespace, LOCK_FILE);
  let descriptor;
  try { descriptor = fs.openSync(lockPath, 'wx', 0o600); }
  catch (error) {
    if (error.code === 'EEXIST') fail('RETENTION_LEDGER_BUSY', 'retention ledger has an active or stale operation lock');
    fail('RETENTION_LOCK_FAILED', 'retention operation lock cannot be created: ' + error.message);
  }
  let result;
  let problem = null;
  try {
    fs.writeFileSync(descriptor, 'LOCKED\n', { encoding: 'utf8' });
    fs.fsyncSync(descriptor);
    result = operation();
  } catch (error) { problem = error; }
  try { fs.closeSync(descriptor); }
  catch (error) { if (!problem) problem = new HistoryCheckpointRetentionLedgerError('RETENTION_LOCK_RELEASE_FAILED', 'operation lock cannot be closed: ' + error.message); }
  try { fs.unlinkSync(lockPath); }
  catch (error) { if (!problem) problem = new HistoryCheckpointRetentionLedgerError('RETENTION_LOCK_RELEASE_FAILED', 'operation lock cannot be removed: ' + error.message); }
  if (problem) throw problem;
  return result;
}
function readManifest(filePath, expected) {
  const value = readJsonFile(filePath, 'RETENTION_MANIFEST_CORRUPT', 'retention manifest');
  return value === null ? null : validateManifest(value, expected);
}
function ensureManifest(paths, expected, build) {
  const filePath = path.join(paths.namespace, MANIFEST_FILE);
  const existing = readManifest(filePath, expected);
  if (existing) return existing;
  const manifest = build();
  if (!writeExclusive(filePath, manifest, 'RETENTION_MANIFEST')) return readManifest(filePath, expected);
  return manifest;
}
function prepareUnderLock(paths, expected, build) {
  assertDirectoryNotLink(paths.namespace, 'RETENTION_STATE_ROOT_INVALID', 'retention namespace');
  const manifest = ensureManifest(paths, expected, build);
  createFixedDirectory(paths.proposals, 'RETENTION_STATE_ROOT_INVALID', 'retention proposals directory');
  createFixedDirectory(paths.settlements, 'RETENTION_STATE_ROOT_INVALID', 'retention settlements directory');
  return manifest;
}
function contiguousNames(directory, code, label) {
  if (!fs.existsSync(directory)) return [];
  assertDirectoryNotLink(directory, code, label);
  const names = fs.readdirSync(directory).sort();
  if (names.length > MAX_RECORDS) fail('RETENTION_RESOURCE_BOUND', label + ' exceeds record bound');
  names.forEach((name, index) => {
    const match = SEQUENCE_FILE.exec(name);
    if (!match || Number(match[1]) !== index + 1) fail('RETENTION_SEQUENCE_CORRUPT', label + ' filenames must be one contiguous 12-digit sequence');
  });
  return names;
}
function aggregateStorageBytes(paths, proposalNames, settlementNames) {
  const files = [path.join(paths.namespace, MANIFEST_FILE)]
    .concat(proposalNames.map(name => path.join(paths.proposals, name)))
    .concat(settlementNames.map(name => path.join(paths.settlements, name)));
  let total = 0;
  files.forEach(filePath => {
    let stat;
    try { stat = fs.lstatSync(filePath); }
    catch (error) { fail('RETENTION_SEQUENCE_CORRUPT', 'retention artifact cannot be inspected: ' + error.message); }
    if (!stat.isFile() || stat.isSymbolicLink()) fail('RETENTION_SEQUENCE_CORRUPT', 'retention artifact must be a regular file');
    total += stat.size;
    if (total > MAX_AGGREGATE_STORAGE_BYTES) fail('RETENTION_RESOURCE_BOUND', 'retention ledger exceeds aggregate storage bound');
  });
  return total;
}
function buildSnapshot(manifest, proposals, settlements, currentSettledCheckpoint, pendingProposal) {
  const latest = proposals.length ? proposals[proposals.length - 1] : null;
  const selectionStatus = latest ? (pendingProposal ? 'PENDING' : 'SETTLED') : 'EMPTY';
  const result = {
    schema: SNAPSHOT_SCHEMA,
    version: VERSION,
    status: STATUS,
    retentionLogId: manifest.retentionLogId,
    mode: MODE,
    manifestRef: manifestRef(manifest),
    proposalCount: proposals.length,
    settlementCount: settlements.length,
    currentSettledCheckpointRef: currentSettledCheckpoint ? checkpointRef(currentSettledCheckpoint) : null,
    latestPersistedCheckpointRef: latest ? checkpointRef(latest.checkpoint) : null,
    latestPersistedProposalRef: latest ? proposalRef(latest) : null,
    pendingProposalRef: pendingProposal ? proposalRef(pendingProposal) : null,
    lastSettlementRef: settlements.length ? settlementRef(settlements[settlements.length - 1]) : null,
    latestPersistedStatus: selectionStatus,
    state: selectionStatus === 'EMPTY' ? 'LOCAL_RETENTION_LEDGER_RELOADED_EMPTY' :
      selectionStatus === 'PENDING' ? 'LOCAL_RETENTION_LEDGER_RELOADED_LATEST_OBSERVATION_PENDING' :
        'LOCAL_RETENTION_LEDGER_RELOADED_LATEST_OBSERVATION_SETTLED',
    truth: snapshotTruth(),
    snapshotDigest: null
  };
  result.snapshotDigest = sha256(withoutField(result, 'snapshotDigest'));
  bound(result, MAX_ARTIFACT_CANONICAL_BYTES, 'RETENTION_SNAPSHOT_TOO_LARGE', 'retention snapshot');
  return result;
}
function loadState(paths, expected) {
  assertDirectoryNotLink(paths.namespace, 'RETENTION_STATE_ROOT_INVALID', 'retention namespace');
  const items = fs.readdirSync(paths.namespace).sort();
  const unexpected = items.filter(name => ![MANIFEST_FILE, PROPOSALS_DIRECTORY, SETTLEMENTS_DIRECTORY, LOCK_FILE].includes(name));
  if (unexpected.length) fail('RETENTION_NAMESPACE_CORRUPT', 'unexpected retention namespace items: ' + unexpected.join(', '));
  const manifest = readManifest(path.join(paths.namespace, MANIFEST_FILE), expected);
  if (!manifest) fail('RETENTION_MANIFEST_MISSING', 'retention namespace has no manifest');
  const proposalNames = contiguousNames(paths.proposals, 'RETENTION_PROPOSAL_CORRUPT', 'retention proposal directory');
  const settlementNames = contiguousNames(paths.settlements, 'RETENTION_SETTLEMENT_CORRUPT', 'retention settlement directory');
  if (settlementNames.length > proposalNames.length || proposalNames.length - settlementNames.length > 1) {
    fail('RETENTION_SEQUENCE_CORRUPT', 'settlements must cover every proposal except at most one trailing pending proposal');
  }
  const aggregateBytes = aggregateStorageBytes(paths, proposalNames, settlementNames);
  const proposals = [];
  const settlements = [];
  const headBeforeProposal = [];
  let currentSettledCheckpoint = null;
  let previousProposalRef = null;
  let lastSettlementTime = null;
  proposalNames.forEach((name, index) => {
    headBeforeProposal.push(currentSettledCheckpoint ? clone(currentSettledCheckpoint) : null);
    const proposal = validateStoredProposal(readJsonFile(path.join(paths.proposals, name), 'RETENTION_PROPOSAL_CORRUPT', 'retention proposal ' + name), {
      manifest,
      sequence: index + 1,
      previousProposalRef,
      currentSettledCheckpoint,
      lastSettlementTime
    });
    proposals.push(proposal);
    previousProposalRef = proposalRef(proposal);
    if (index < settlementNames.length) {
      const settlement = validateStoredSettlement(readJsonFile(path.join(paths.settlements, settlementNames[index]), 'RETENTION_SETTLEMENT_CORRUPT', 'retention settlement ' + settlementNames[index]), { manifest, proposal });
      settlements.push(settlement);
      currentSettledCheckpoint = clone(proposal.checkpoint);
      lastSettlementTime = settlement.settledAt;
    }
  });
  const pendingProposal = proposals.length > settlements.length ? proposals[proposals.length - 1] : null;
  return {
    manifest,
    proposals,
    settlements,
    headBeforeProposal,
    currentSettledCheckpoint,
    pendingProposal,
    aggregateBytes,
    snapshot: buildSnapshot(manifest, proposals, settlements, currentSettledCheckpoint, pendingProposal)
  };
}

function buildAuditReceipt(input, state, upstreamAudit) {
  const proposal = state.proposals[state.proposals.length - 1];
  const pending = Boolean(state.pendingProposal);
  const selectionStatus = pending ? 'PENDING' : 'SETTLED';
  const settlement = pending ? null : state.settlements[state.settlements.length - 1];
  const result = {
    schema: AUDIT_SCHEMA,
    version: VERSION,
    status: STATUS,
    auditId: input.auditId,
    auditedAt: input.auditedAt,
    mode: MODE,
    retention: {
      manifestRef: manifestRef(state.manifest),
      proposalRef: proposalRef(proposal),
      settlementRef: settlement ? settlementRef(settlement) : null,
      checkpointRef: checkpointRef(proposal.checkpoint),
      sequence: proposal.log.sequence,
      selectionStatus
    },
    classification: upstreamAudit.classification,
    upstreamAudit: clone(upstreamAudit),
    decision: {
      reviewRequired: true,
      holdRequired: upstreamAudit.decision.holdRequired,
      bestAction: upstreamAudit.decision.bestAction,
      autonomousActionCount: 0
    },
    truth: auditTruth(upstreamAudit.classification, selectionStatus, upstreamAudit.truth),
    auditDigest: null
  };
  result.auditDigest = sha256(withoutField(result, 'auditDigest'));
  bound(result, MAX_AUDIT_CANONICAL_BYTES, 'RETENTION_AUDIT_TOO_LARGE', 'retention audit');
  return result;
}
function validateAudit(value) {
  try {
    bound(value, MAX_AUDIT_CANONICAL_BYTES, 'INVALID_RETENTION_AUDIT', 'retention audit');
    exactKeys(value, ['schema', 'version', 'status', 'auditId', 'auditedAt', 'mode', 'retention', 'classification', 'upstreamAudit', 'decision', 'truth', 'auditDigest'], 'INVALID_RETENTION_AUDIT', 'retention audit');
    if (value.schema !== AUDIT_SCHEMA || value.version !== VERSION || value.status !== STATUS || value.mode !== MODE) throw new Error('audit identity mismatch');
    text(value.auditId, 'INVALID_RETENTION_AUDIT', 'retention audit id', 180);
    timestamp(value.auditedAt, 'INVALID_RETENTION_AUDIT', 'retention audit time');
    exactKeys(value.retention, ['manifestRef', 'proposalRef', 'settlementRef', 'checkpointRef', 'sequence', 'selectionStatus'], 'INVALID_RETENTION_AUDIT', 'retention audit selection');
    reference(value.retention.manifestRef, 'INVALID_RETENTION_AUDIT', 'retention audit manifest reference');
    reference(value.retention.proposalRef, 'INVALID_RETENTION_AUDIT', 'retention audit proposal reference');
    const settlement = nullableReference(value.retention.settlementRef, 'INVALID_RETENTION_AUDIT', 'retention audit settlement reference');
    reference(value.retention.checkpointRef, 'INVALID_RETENTION_AUDIT', 'retention audit checkpoint reference');
    if (!Number.isSafeInteger(value.retention.sequence) || value.retention.sequence < 1 || value.retention.sequence > MAX_RECORDS) throw new Error('audit retention sequence is invalid');
    if (!['PENDING', 'SETTLED'].includes(value.retention.selectionStatus)) throw new Error('audit retention status is invalid');
    if ((value.retention.selectionStatus === 'PENDING') !== (settlement === null)) throw new Error('audit settlement reference and selection status disagree');
    const upstream = Checkpoint.validateAudit(value.upstreamAudit);
    if (value.classification !== upstream.classification || !sameReference(value.retention.checkpointRef, upstream.checkpointRef)) throw new Error('audit classification or checkpoint binding mismatch');
    const expectedDecision = { reviewRequired: true, holdRequired: upstream.decision.holdRequired, bestAction: upstream.decision.bestAction, autonomousActionCount: 0 };
    if (!same(value.decision, expectedDecision)) throw new Error('audit decision mismatch');
    if (!same(value.truth, auditTruth(upstream.classification, value.retention.selectionStatus, upstream.truth))) throw new Error('audit truth boundary mismatch');
    if (digest(value.auditDigest, 'INVALID_RETENTION_AUDIT', 'retention audit digest') !== sha256(withoutField(value, 'auditDigest'))) throw new Error('audit digest mismatch');
    return clone(value);
  } catch (error) {
    if (error instanceof HistoryCheckpointRetentionLedgerError && error.code === 'INVALID_RETENTION_AUDIT') throw error;
    fail('INVALID_RETENTION_AUDIT', 'retention audit is invalid: ' + error.message);
  }
}

function createService(options) {
  bound(options, MAX_SERVICE_OPTIONS_CANONICAL_BYTES, 'RETENTION_SERVICE_OPTIONS_TOO_LARGE', 'retention service options');
  exactKeys(options, ['stateRoot', 'retentionLogId', 'createdAt'], 'INVALID_RETENTION_SERVICE_OPTIONS', 'retention service options');
  const paths = resolvePaths(options.stateRoot);
  const retentionLogId = text(options.retentionLogId, 'INVALID_RETENTION_SERVICE_OPTIONS', 'retention log id', 180);
  const createdAt = timestamp(options.createdAt, 'INVALID_RETENTION_SERVICE_OPTIONS', 'retention manifest creation time');
  const configuredManifest = buildManifest(retentionLogId, createdAt);
  const expected = { retentionLogId, createdAt };
  const manifestBuilder = () => clone(configuredManifest);

  function inspect() {
    if (!fs.existsSync(paths.namespace)) return null;
    assertDirectoryNotLink(paths.namespace, 'RETENTION_STATE_ROOT_INVALID', 'retention namespace');
    if (fs.readdirSync(paths.namespace).length === 0) return null;
    return withOperationLock(paths, () => clone(loadState(paths, expected).snapshot));
  }
  function proposalContext(state, sequence) {
    return {
      retentionRoot: paths.root,
      manifest: state.manifest,
      sequence,
      previousProposalRef: sequence === 1 ? null : proposalRef(state.proposals[sequence - 2]),
      currentSettledCheckpoint: state.headBeforeProposal[sequence - 1] ? clone(state.headBeforeProposal[sequence - 1]) : null,
      lastSettlementTime: sequence === 1 ? null : state.settlements[sequence - 2].settledAt
    };
  }
  function verifyProposalPackage(state, input, receipt) {
    const candidate = clone(receipt);
    const sequence = candidate && candidate.log && candidate.log.sequence;
    if (!Number.isSafeInteger(sequence) || sequence < 1 || sequence > state.proposals.length) fail('RETENTION_PROPOSAL_PACKAGE_MISMATCH', 'proposal sequence is absent');
    const rebuilt = buildProposal(input, proposalContext(state, sequence));
    const stored = state.proposals[sequence - 1];
    if (!same(rebuilt, candidate) || !same(stored, rebuilt)) fail('RETENTION_PROPOSAL_PACKAGE_MISMATCH', 'proposal does not exact-rebuild from caller package or match stored receipt');
    return { rebuilt, stored, sequence };
  }
  function propose(input) {
    prevalidateProposalInput(input, paths.root);
    createFixedDirectory(paths.namespace, 'RETENTION_STATE_ROOT_INVALID', 'retention namespace');
    return withOperationLock(paths, () => {
      const manifestPath = path.join(paths.namespace, MANIFEST_FILE);
      const existingManifest = readManifest(manifestPath, expected);
      if (!existingManifest) {
        const unexpected = fs.readdirSync(paths.namespace).filter(name => name !== LOCK_FILE);
        if (unexpected.length) fail('RETENTION_NAMESPACE_CORRUPT', 'manifest-free retention namespace has unexpected items: ' + unexpected.join(', '));
        const manifest = manifestBuilder();
        const proposal = buildProposal(input, {
          retentionRoot: paths.root,
          manifest,
          sequence: 1,
          previousProposalRef: null,
          currentSettledCheckpoint: null,
          lastSettlementTime: null
        });
        const projected = canonicalBytes(manifest, 'RETENTION_RESOURCE_BOUND', 'retention manifest') + 1 +
          canonicalBytes(proposal, 'RETENTION_RESOURCE_BOUND', 'retention proposal') + 1;
        if (projected > MAX_AGGREGATE_STORAGE_BYTES) fail('RETENTION_RESOURCE_BOUND', 'initial retention state exceeds aggregate storage bound');
        if (!writeExclusive(manifestPath, manifest, 'RETENTION_MANIFEST')) fail('RETENTION_SEQUENCE_CONFLICT', 'retention manifest appeared during locked initialization');
        createFixedDirectory(paths.proposals, 'RETENTION_STATE_ROOT_INVALID', 'retention proposals directory');
        createFixedDirectory(paths.settlements, 'RETENTION_STATE_ROOT_INVALID', 'retention settlements directory');
        if (!writeExclusive(path.join(paths.proposals, sequenceFile(1)), proposal, 'RETENTION_PROPOSAL')) fail('RETENTION_SEQUENCE_CONFLICT', 'initial retention proposal sequence already exists');
        return clone(proposal);
      }
      const manifest = prepareUnderLock(paths, expected, manifestBuilder);
      const state = loadState(paths, expected);
      if (state.pendingProposal) fail('RETENTION_SETTLEMENT_PENDING', 'trailing checkpoint retention proposal must settle before another proposal');
      const sequence = state.proposals.length + 1;
      if (sequence > MAX_RECORDS) fail('RETENTION_RESOURCE_BOUND', 'retention proposal sequence exceeds record bound');
      const proposal = buildProposal(input, {
        retentionRoot: paths.root,
        manifest,
        sequence,
        previousProposalRef: state.proposals.length ? proposalRef(state.proposals[state.proposals.length - 1]) : null,
        currentSettledCheckpoint: state.currentSettledCheckpoint ? clone(state.currentSettledCheckpoint) : null,
        lastSettlementTime: state.settlements.length ? state.settlements[state.settlements.length - 1].settledAt : null
      });
      const projected = state.aggregateBytes + canonicalBytes(proposal, 'RETENTION_RESOURCE_BOUND', 'retention proposal') + 1;
      if (projected > MAX_AGGREGATE_STORAGE_BYTES) fail('RETENTION_RESOURCE_BOUND', 'retention proposal exceeds aggregate storage bound');
      const filePath = path.join(paths.proposals, sequenceFile(sequence));
      if (!writeExclusive(filePath, proposal, 'RETENTION_PROPOSAL')) fail('RETENTION_SEQUENCE_CONFLICT', 'next retention proposal sequence already exists');
      return clone(proposal);
    });
  }
  function settle(input) {
    validateSettlementInput(input);
    if (!fs.existsSync(paths.namespace)) fail('NO_PENDING_RETENTION_PROPOSAL', 'retention ledger is absent');
    return withOperationLock(paths, () => {
      const state = loadState(paths, expected);
      if (!state.pendingProposal) fail('NO_PENDING_RETENTION_PROPOSAL', 'there is no trailing retention proposal');
      const proposalResult = verifyProposalPackage(state, input.proposalInput, input.proposalReceipt);
      if (proposalResult.sequence !== state.proposals.length) fail('RETENTION_PROPOSAL_PACKAGE_MISMATCH', 'caller package is not the trailing pending proposal');
      const settlement = buildSettlement(input, proposalResult.rebuilt, state.manifest);
      const projected = state.aggregateBytes + canonicalBytes(settlement, 'RETENTION_RESOURCE_BOUND', 'retention settlement') + 1;
      if (projected > MAX_AGGREGATE_STORAGE_BYTES) fail('RETENTION_RESOURCE_BOUND', 'retention settlement exceeds aggregate storage bound');
      const filePath = path.join(paths.settlements, sequenceFile(proposalResult.sequence));
      if (!writeExclusive(filePath, settlement, 'RETENTION_SETTLEMENT')) fail('RETENTION_SEQUENCE_CONFLICT', 'matching retention settlement sequence already exists');
      return clone(settlement);
    });
  }
  function verifyProposalPersisted(input, receipt) {
    const errors = [];
    let rebuilt = null;
    let stored = null;
    try {
      const result = withOperationLock(paths, () => {
        const state = loadState(paths, expected);
        return verifyProposalPackage(state, input, receipt);
      });
      rebuilt = result.rebuilt;
      stored = result.stored;
    } catch (error) { errors.push(error.message); }
    return { pass: errors.length === 0, errors, rebuilt, stored };
  }
  function verifySettlementPersisted(input, receipt) {
    const errors = [];
    let rebuilt = null;
    let stored = null;
    try {
      validateSettlementInput(input);
      const result = withOperationLock(paths, () => {
        const state = loadState(paths, expected);
        const candidate = clone(receipt);
        const sequence = candidate && candidate.log && candidate.log.sequence;
        if (!Number.isSafeInteger(sequence) || sequence < 1 || sequence > state.settlements.length) throw new Error('settlement sequence is absent');
        const proposalResult = verifyProposalPackage(state, input.proposalInput, input.proposalReceipt);
        if (proposalResult.sequence !== sequence) throw new Error('settlement proposal sequence mismatch');
        const exactSettlement = buildSettlement(input, proposalResult.rebuilt, state.manifest);
        const storedSettlement = state.settlements[sequence - 1];
        if (!same(exactSettlement, candidate) || !same(storedSettlement, exactSettlement)) throw new Error('settlement does not exact-rebuild from caller package or match stored receipt');
        return { exactSettlement, storedSettlement };
      });
      rebuilt = result.exactSettlement;
      stored = result.storedSettlement;
    } catch (error) { errors.push(error.message); }
    return { pass: errors.length === 0, errors, rebuilt, stored };
  }
  function auditLatest(input) {
    bound(input, MAX_AUDIT_INPUT_CANONICAL_BYTES, 'RETENTION_AUDIT_INPUT_TOO_LARGE', 'retention audit input');
    exactKeys(input, ['auditId', 'auditedAt', 'current'], 'INVALID_RETENTION_AUDIT_INPUT', 'retention audit input');
    const auditId = text(input.auditId, 'INVALID_RETENTION_AUDIT_INPUT', 'retention audit id', 180);
    const auditedAt = timestamp(input.auditedAt, 'INVALID_RETENTION_AUDIT_INPUT', 'retention audit time');
    exactKeys(input.current, ['serviceOptions', 'records'], 'INVALID_RETENTION_AUDIT_INPUT', 'retention audit current presentation');
    assertDistinctSourceRoot(paths.root, input.current, 'RETENTION_ROOT_OVERLAP');
    if (!fs.existsSync(paths.namespace)) fail('NO_RETAINED_CHECKPOINT', 'retention ledger is absent');
    return withOperationLock(paths, () => {
      const state = loadState(paths, expected);
      if (!state.proposals.length) fail('NO_RETAINED_CHECKPOINT', 'retention ledger has no persisted checkpoint observation');
      const proposal = state.proposals[state.proposals.length - 1];
      if (Date.parse(auditedAt) < Date.parse(proposal.proposedAt)) fail('RETENTION_AUDIT_TIME_INVALID', 'retention audit cannot predate persisted proposal');
      let upstreamAudit;
      try {
        upstreamAudit = Checkpoint.auditCheckpoint({
          auditId,
          auditedAt,
          checkpoint: clone(proposal.checkpoint),
          current: clone(input.current)
        });
      } catch (error) {
        fail('RETENTION_CURRENT_AUDIT_INVALID', 'v2.6 current audit failed: ' + error.message);
      }
      return buildAuditReceipt({ auditId, auditedAt }, state, upstreamAudit);
    });
  }
  function verifyAudit(input, receipt) {
    const errors = [];
    let rebuilt = null;
    try {
      rebuilt = auditLatest(input);
      const validated = validateAudit(receipt);
      if (!same(rebuilt, validated)) throw new Error('presented retention audit does not exact-rebuild from caller package');
    } catch (error) { errors.push(error.message); }
    return { pass: errors.length === 0, errors, rebuilt };
  }

  return Object.freeze({
    retentionLogId,
    propose,
    settle,
    inspect,
    auditLatest,
    verifyProposalPersisted,
    verifySettlementPersisted,
    verifyAudit
  });
}

module.exports = {
  MANIFEST_SCHEMA,
  PROPOSAL_SCHEMA,
  SETTLEMENT_SCHEMA,
  SNAPSHOT_SCHEMA,
  AUDIT_SCHEMA,
  VERSION,
  STATUS,
  NAMESPACE,
  LOCK_FILE,
  MODE,
  STORAGE_MODE,
  PROPOSE_CONFIRMATION,
  SETTLE_CONFIRMATION,
  INITIAL_CLASSIFICATION,
  FORWARD_CLASSIFICATION,
  SETTLEMENT_CLASSIFICATION,
  MAX_RECORDS,
  MAX_ARTIFACT_CANONICAL_BYTES,
  MAX_AGGREGATE_STORAGE_BYTES,
  MAX_SERVICE_OPTIONS_CANONICAL_BYTES,
  MAX_PROPOSAL_INPUT_CANONICAL_BYTES,
  MAX_SETTLEMENT_INPUT_CANONICAL_BYTES,
  MAX_AUDIT_INPUT_CANONICAL_BYTES,
  MAX_AUDIT_CANONICAL_BYTES,
  HistoryCheckpointRetentionLedgerError,
  stableStringify,
  sha256,
  buildManifest,
  validateAudit,
  createService
};
