#!/usr/bin/env node
'use strict';

const Ledger = require('../model-shadow-history-checkpoint-pin-settlement-ledger/model-shadow-history-checkpoint-pin-settlement-ledger');

const CHECKPOINT_SCHEMA = 'axm.model-shadow-portable-pin-settlement-history-checkpoint/v1';
const AUDIT_SCHEMA = 'axm.model-shadow-portable-pin-settlement-history-audit/v1';
const HISTORY_COMMITMENT_SCHEMA = 'axm.model-shadow-portable-pin-settlement-history-commitment/v1';
const VERSION = '2.6.0';
const STATUS = 'TEST';
const MODE = 'CALLER_PORTABLE_UNAUTHENTICATED_PIN_SETTLEMENT_HISTORY_CHECKPOINT';
const MAX_HISTORY_ITEMS = Ledger.MAX_RECORDS;
const MAX_INPUT_CANONICAL_BYTES = 268435456;
const MAX_CHECKPOINT_CANONICAL_BYTES = 16777216;
const MAX_AUDIT_CANONICAL_BYTES = 1048576;
const CLASSIFICATIONS = Object.freeze([
  'EXACT_HISTORY_MATCH',
  'FORWARD_HISTORY_EXTENSION',
  'OBSERVED_STRICT_HISTORY_ROLLBACK_RELATIVE_TO_PRESENTED_CHECKPOINT',
  'OBSERVED_HISTORY_REPLACEMENT_OR_FORK_RELATIVE_TO_PRESENTED_CHECKPOINT',
  'OBSERVED_LEDGER_IDENTITY_DRIFT',
  'OBSERVED_LEDGER_ABSENT',
  'OBSERVED_LEDGER_OR_CONFIGURATION_INVALID'
]);

class PinSettlementHistoryCheckpointError extends Error {
  constructor(code, message) { super(message); this.name = 'PinSettlementHistoryCheckpointError'; this.code = code; }
}

function stableStringify(value) { return Ledger.stableStringify(value); }
function clone(value) { return JSON.parse(stableStringify(value)); }
function sha256(value) { return Ledger.sha256(value); }
function fail(code, message) { throw new PinSettlementHistoryCheckpointError(code, message); }
function canonicalBytes(value, code, label) {
  try { return Buffer.byteLength(stableStringify(value), 'utf8'); }
  catch (error) { fail(code, label + ' must be strict canonical JSON data'); }
}
function bound(value, maximum, code, label) {
  if (canonicalBytes(value, code, label) > maximum) fail(code, label + ' exceeds the bounded canonical byte limit');
}
function exactKeys(value, allowed, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail('INVALID_INPUT', label + ' must be an object');
  const actual = Object.keys(value).sort(); const expected = allowed.slice().sort();
  if (stableStringify(actual) !== stableStringify(expected)) fail('INVALID_INPUT', label + ' must contain exactly: ' + expected.join(', '));
}
function exactText(value, label, maximum) {
  if (typeof value !== 'string' || value.length < 1 || value.length > maximum || /[\u0000-\u001f\u007f]/.test(value)) {
    fail('INVALID_INPUT', label + ' must be bounded non-control text');
  }
  return value;
}
function timestamp(value, label) {
  const result = exactText(value, label, 40);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(result) || !Number.isFinite(Date.parse(result))) {
    fail('INVALID_INPUT', label + ' must be canonical UTC milliseconds');
  }
  return result;
}
function digest(value, label) {
  const result = exactText(value, label, 71);
  if (!/^sha256:[a-f0-9]{64}$/.test(result)) fail('INVALID_INPUT', label + ' must be an exact SHA-256 digest');
  return result;
}
function count(value, label) {
  if (!Number.isSafeInteger(value) || value < 0 || value > MAX_HISTORY_ITEMS) fail('INVALID_INPUT', label + ' must be a bounded non-negative integer');
  return value;
}
function reference(value, label) {
  exactKeys(value, ['id', 'schema', 'sha256'], label);
  return { id: exactText(value.id, label + '.id', 180), schema: exactText(value.schema, label + '.schema', 180), sha256: digest(value.sha256, label + '.sha256') };
}
function nullableReference(value, label) { return value === null ? null : reference(value, label); }
function sameReference(left, right) { return stableStringify(left) === stableStringify(right); }
function sameNullableReference(left, right) { return left === null || right === null ? left === right : sameReference(left, right); }
function withoutField(value, field) { const result = clone(value); delete result[field]; return result; }
function checkpointDigest(value) { return sha256(withoutField(value, 'checkpointDigest')); }
function auditDigest(value) { return sha256(withoutField(value, 'auditDigest')); }
function checkpointRef(value) { return { id: value.checkpointId, schema: value.schema, sha256: value.checkpointDigest }; }
function proposalRef(value) { return { id: value.proposalId, schema: value.schema, sha256: value.proposalDigest }; }
function settlementRef(value) { return { id: value.settlementId, schema: value.schema, sha256: value.settlementDigest }; }
function snapshotBinding(value) { return { schema: value.schema, sha256: value.snapshotDigest }; }
function sameSnapshotBinding(left, right) { return stableStringify(left) === stableStringify(right); }
function validateSnapshotBinding(value, label) {
  exactKeys(value, ['schema', 'sha256'], label);
  return { schema: exactText(value.schema, label + '.schema', 180), sha256: digest(value.sha256, label + '.sha256') };
}

function validateRecord(record, index) {
  const label = 'history record ' + (index + 1);
  exactKeys(record, ['proposal', 'settlement'], label);
  exactKeys(record.proposal, ['input', 'receipt'], label + '.proposal');
  if (record.settlement !== null) exactKeys(record.settlement, ['settlementId', 'settledAt', 'confirmation', 'receipt'], label + '.settlement');
}
function settlementInput(record) {
  return {
    settlementId: record.settlement.settlementId,
    settledAt: record.settlement.settledAt,
    confirmation: record.settlement.confirmation,
    proposalInput: clone(record.proposal.input),
    proposalReceipt: clone(record.proposal.receipt)
  };
}
function boundedErrorCode(error, fallback) {
  return typeof error.code === 'string' && error.code.length > 0 && error.code.length <= 180 ? error.code : fallback;
}
function observe(options) {
  let service;
  try { service = Ledger.createService(clone(options)); }
  catch (error) { fail('INVALID_LEDGER_CONFIGURATION', 'v2.5 service configuration is invalid: ' + boundedErrorCode(error, 'UNCLASSIFIED_CONFIGURATION_FAILURE')); }
  try {
    const snapshot = service.inspect();
    if (snapshot === null) return { kind: 'absent', service, snapshot: null, errorCode: null };
    return { kind: 'present', service, snapshot, errorCode: null };
  } catch (error) {
    return { kind: 'invalid', service: null, snapshot: null, errorCode: boundedErrorCode(error, 'UNCLASSIFIED_LEDGER_READ_FAILURE') };
  }
}
function historyDigest(proposalRefs, settlementRefs, settledPinRefs) {
  return sha256({ schema: HISTORY_COMMITMENT_SCHEMA, proposalRefs, settlementRefs, settledPinRefs });
}
function presentObserved(observation, records) {
  if (observation.kind !== 'present') fail('CURRENT_LEDGER_NOT_PRESENT', 'an exact history presentation requires a valid present v2.5 ledger');
  if (!Array.isArray(records)) fail('INVALID_INPUT', 'history records must be an array');
  if (records.length > MAX_HISTORY_ITEMS) fail('HISTORY_TOO_LARGE', 'history exceeds the bounded item limit');
  const before = observation.snapshot;
  if (records.length !== before.proposalCount) fail('HISTORY_PACKAGE_COUNT_MISMATCH', 'history packages must cover every persisted proposal');
  const proposalRefs = []; const settlementRefs = []; const settledPinRefs = [];
  let latestRecordTime = null;
  records.forEach((record, index) => {
    validateRecord(record, index);
    const proposalResult = observation.service.verifyProposalPersisted(record.proposal.input, record.proposal.receipt);
    if (!proposalResult.pass) fail('PROPOSAL_PACKAGE_INVALID', 'proposal package ' + (index + 1) + ' does not exact-rebuild persisted state');
    if (!proposalResult.stored || proposalResult.stored.log.sequence !== index + 1) fail('PROPOSAL_SEQUENCE_MISMATCH', 'proposal package sequence is not contiguous');
    proposalRefs.push(proposalRef(proposalResult.stored));
    latestRecordTime = proposalResult.stored.proposedAt;
    if (index < before.settlementCount) {
      if (record.settlement === null) fail('SETTLEMENT_PACKAGE_MISSING', 'settlement package ' + (index + 1) + ' is required');
      const settlementResult = observation.service.verifySettlementPersisted(settlementInput(record), record.settlement.receipt);
      if (!settlementResult.pass) fail('SETTLEMENT_PACKAGE_INVALID', 'settlement package ' + (index + 1) + ' does not exact-rebuild persisted state');
      if (!settlementResult.stored || settlementResult.stored.log.sequence !== index + 1) fail('SETTLEMENT_SEQUENCE_MISMATCH', 'settlement package sequence is not contiguous');
      settlementRefs.push(settlementRef(settlementResult.stored));
      settledPinRefs.push(reference(settlementResult.stored.settledPinRef, 'stored settled pin reference'));
      latestRecordTime = settlementResult.stored.settledAt;
    } else if (record.settlement !== null) {
      fail('UNPERSISTED_SETTLEMENT_PACKAGE', 'a package was supplied for a settlement that is not persisted');
    }
  });
  const expectedLastProposal = proposalRefs.length ? proposalRefs[proposalRefs.length - 1] : null;
  const expectedLastSettlement = settlementRefs.length ? settlementRefs[settlementRefs.length - 1] : null;
  const expectedPending = proposalRefs.length > settlementRefs.length ? proposalRefs[proposalRefs.length - 1] : null;
  const expectedHead = settledPinRefs.length ? settledPinRefs[settledPinRefs.length - 1] : before.genesisPinRef;
  if (!sameNullableReference(expectedLastProposal, before.lastProposalRef) ||
      !sameNullableReference(expectedLastSettlement, before.lastSettlementRef) ||
      !sameNullableReference(expectedPending, before.pendingProposalRef) ||
      !sameReference(expectedHead, before.currentSettledPinRef)) {
    fail('HISTORY_SNAPSHOT_BINDING_MISMATCH', 'verified history references do not match the v2.5 snapshot');
  }
  let after;
  try { after = observation.service.inspect(); }
  catch (error) { fail('LEDGER_MOVED_DURING_PRESENTATION', 'ledger became unreadable while exact packages were verified: ' + boundedErrorCode(error, 'UNCLASSIFIED_LEDGER_READ_FAILURE')); }
  if (after === null || stableStringify(after) !== stableStringify(before)) {
    fail('LEDGER_MOVED_DURING_PRESENTATION', 'ledger snapshot changed while exact caller packages were verified');
  }
  return {
    snapshot: clone(before), proposalRefs, settlementRefs, settledPinRefs,
    historyDigest: historyDigest(proposalRefs, settlementRefs, settledPinRefs), latestRecordTime
  };
}
function presentCurrent(options, records) {
  const observation = observe(options);
  if (observation.kind === 'absent') fail('LEDGER_ABSENT', 'the v2.5 pin settlement ledger is absent');
  if (observation.kind === 'invalid') fail('LEDGER_INVALID', 'the v2.5 pin settlement ledger is invalid: ' + observation.errorCode);
  return presentObserved(observation, records);
}

function checkpointTruth() {
  return {
    originLedgerValidatedByV25Reload: true,
    everyPersistedProposalExactRebuiltFromCallerPackage: true,
    everyPersistedSettlementExactRebuiltFromDeduplicatedCallerPackage: true,
    fullProposalSettlementAndSettledPinReferenceSequencesCommitted: true,
    currentSettledHeadSelfValidatedFromSettlementSequence: true,
    equalBracketingSnapshotsRequired: true,
    transientV25OperationLockMayBeWritten: true,
    durableLedgerStateChangedByModule: false,
    checkpointPortableAsData: true,
    checkpointPersistedByModule: false,
    checkpointExternalRetentionProven: false,
    checkpointPinAuthenticated: false,
    checkpointOriginAuthenticated: false,
    ledgerSnapshotAtomic: false,
    intermediateOrRevertedLedgerChangesExcluded: false,
    ledgerCurrentAfterFinalReadProven: false,
    deletionOrRollbackPrevented: false,
    protectedMonotonicStateProven: false,
    withheldRootsExcluded: false,
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
    automaticPermissionGrant: false,
    automaticInstall: false,
    automaticPromotion: false,
    automaticMerge: false,
    automaticCanon: false,
    foundationMutation: false
  };
}
function createCheckpoint(input) {
  bound(input, MAX_INPUT_CANONICAL_BYTES, 'INPUT_TOO_LARGE', 'checkpoint input');
  exactKeys(input, ['checkpointId', 'checkpointedAt', 'serviceOptions', 'records'], 'checkpoint input');
  const checkpointId = exactText(input.checkpointId, 'checkpoint id', 180);
  const checkpointedAt = timestamp(input.checkpointedAt, 'checkpoint time');
  const presentation = presentCurrent(input.serviceOptions, input.records);
  const latestTime = presentation.latestRecordTime || timestamp(input.serviceOptions.createdAt, 'configured manifest time');
  if (Date.parse(checkpointedAt) < Date.parse(latestTime)) fail('INVALID_INPUT', 'checkpoint time must not precede the latest verified ledger record time');
  const snapshot = presentation.snapshot;
  const result = {
    schema: CHECKPOINT_SCHEMA, version: VERSION, status: STATUS, checkpointId, checkpointedAt, mode: MODE,
    logIdDigest: sha256({ schema: 'axm.model-shadow-pin-settlement-log-id-digest/v1', logId: snapshot.logId }),
    manifestRef: reference(snapshot.manifestRef, 'snapshot manifest reference'),
    genesisPinRef: reference(snapshot.genesisPinRef, 'snapshot genesis pin reference'),
    snapshotBinding: snapshotBinding(snapshot),
    state: {
      proposalCount: snapshot.proposalCount,
      settlementCount: snapshot.settlementCount,
      currentSettledPinRef: reference(snapshot.currentSettledPinRef, 'snapshot settled pin head'),
      pendingProposalRef: nullableReference(snapshot.pendingProposalRef, 'snapshot pending proposal'),
      lastProposalRef: nullableReference(snapshot.lastProposalRef, 'snapshot last proposal'),
      lastSettlementRef: nullableReference(snapshot.lastSettlementRef, 'snapshot last settlement')
    },
    history: {
      proposalRefs: clone(presentation.proposalRefs),
      settlementRefs: clone(presentation.settlementRefs),
      settledPinRefs: clone(presentation.settledPinRefs),
      historyDigest: presentation.historyDigest
    },
    truth: checkpointTruth(), checkpointDigest: null
  };
  result.checkpointDigest = checkpointDigest(result);
  bound(result, MAX_CHECKPOINT_CANONICAL_BYTES, 'CHECKPOINT_TOO_LARGE', 'checkpoint');
  return result;
}
function validateReferenceArray(value, label) {
  if (!Array.isArray(value) || value.length > MAX_HISTORY_ITEMS) fail('INVALID_CHECKPOINT', label + ' must be a bounded array');
  return value.map((item, index) => reference(item, label + '[' + index + ']'));
}
function validateCheckpoint(value) {
  try {
    bound(value, MAX_CHECKPOINT_CANONICAL_BYTES, 'INVALID_CHECKPOINT', 'checkpoint');
    const candidate = clone(value);
    exactKeys(candidate, ['schema', 'version', 'status', 'checkpointId', 'checkpointedAt', 'mode', 'logIdDigest', 'manifestRef', 'genesisPinRef', 'snapshotBinding', 'state', 'history', 'truth', 'checkpointDigest'], 'checkpoint');
    if (candidate.schema !== CHECKPOINT_SCHEMA || candidate.version !== VERSION || candidate.status !== STATUS || candidate.mode !== MODE) fail('INVALID_CHECKPOINT', 'checkpoint identity mismatch');
    exactText(candidate.checkpointId, 'checkpoint id', 180); timestamp(candidate.checkpointedAt, 'checkpoint time');
    digest(candidate.logIdDigest, 'checkpoint log id digest'); reference(candidate.manifestRef, 'checkpoint manifest reference');
    const genesisPinRef = reference(candidate.genesisPinRef, 'checkpoint genesis pin reference');
    validateSnapshotBinding(candidate.snapshotBinding, 'checkpoint snapshot binding');
    exactKeys(candidate.state, ['proposalCount', 'settlementCount', 'currentSettledPinRef', 'pendingProposalRef', 'lastProposalRef', 'lastSettlementRef'], 'checkpoint state');
    const proposalCount = count(candidate.state.proposalCount, 'checkpoint proposal count');
    const settlementCount = count(candidate.state.settlementCount, 'checkpoint settlement count');
    if (settlementCount > proposalCount || proposalCount - settlementCount > 1) fail('INVALID_CHECKPOINT', 'checkpoint state counts are incoherent');
    const currentSettledPinRef = reference(candidate.state.currentSettledPinRef, 'checkpoint settled pin head');
    nullableReference(candidate.state.pendingProposalRef, 'checkpoint pending proposal');
    nullableReference(candidate.state.lastProposalRef, 'checkpoint last proposal');
    nullableReference(candidate.state.lastSettlementRef, 'checkpoint last settlement');
    exactKeys(candidate.history, ['proposalRefs', 'settlementRefs', 'settledPinRefs', 'historyDigest'], 'checkpoint history');
    const proposalRefs = validateReferenceArray(candidate.history.proposalRefs, 'checkpoint proposal refs');
    const settlementRefs = validateReferenceArray(candidate.history.settlementRefs, 'checkpoint settlement refs');
    const settledPinRefs = validateReferenceArray(candidate.history.settledPinRefs, 'checkpoint settled pin refs');
    if (proposalRefs.length !== proposalCount || settlementRefs.length !== settlementCount || settledPinRefs.length !== settlementCount) fail('INVALID_CHECKPOINT', 'checkpoint history counts do not match state');
    const lastProposal = proposalRefs.length ? proposalRefs[proposalRefs.length - 1] : null;
    const lastSettlement = settlementRefs.length ? settlementRefs[settlementRefs.length - 1] : null;
    const pending = proposalRefs.length > settlementRefs.length ? proposalRefs[proposalRefs.length - 1] : null;
    const derivedHead = settledPinRefs.length ? settledPinRefs[settledPinRefs.length - 1] : genesisPinRef;
    if (!sameNullableReference(lastProposal, candidate.state.lastProposalRef) ||
        !sameNullableReference(lastSettlement, candidate.state.lastSettlementRef) ||
        !sameNullableReference(pending, candidate.state.pendingProposalRef) ||
        !sameReference(derivedHead, currentSettledPinRef)) fail('INVALID_CHECKPOINT', 'checkpoint state does not bind its history endpoints and derived head');
    if (digest(candidate.history.historyDigest, 'checkpoint history digest') !== historyDigest(proposalRefs, settlementRefs, settledPinRefs)) fail('INVALID_CHECKPOINT', 'checkpoint history digest mismatch');
    if (stableStringify(candidate.truth) !== stableStringify(checkpointTruth())) fail('INVALID_CHECKPOINT', 'checkpoint truth boundary mismatch');
    if (digest(candidate.checkpointDigest, 'checkpoint digest') !== checkpointDigest(candidate)) fail('INVALID_CHECKPOINT', 'checkpoint digest mismatch');
    return candidate;
  } catch (error) {
    if (error instanceof PinSettlementHistoryCheckpointError && error.code === 'INVALID_CHECKPOINT') throw error;
    fail('INVALID_CHECKPOINT', 'checkpoint is invalid: ' + error.message);
  }
}
function verifyCheckpointOrigin(input, receipt) {
  const errors = []; let rebuilt = null;
  try {
    rebuilt = createCheckpoint(input); const validated = validateCheckpoint(receipt);
    if (stableStringify(rebuilt) !== stableStringify(validated)) throw new Error('presented checkpoint does not exact-rebuild from its origin package');
  } catch (error) { errors.push(error.message); }
  return { pass: errors.length === 0, errors, rebuilt };
}
function commonPrefixCount(left, right) {
  const maximum = Math.min(left.length, right.length); let index = 0;
  while (index < maximum && sameReference(left[index], right[index])) index += 1;
  return index;
}
function isPrefix(prefix, value) { return prefix.length <= value.length && commonPrefixCount(prefix, value) === prefix.length; }
function sameIdentity(checkpoint, snapshot) {
  return checkpoint.logIdDigest === sha256({ schema: 'axm.model-shadow-pin-settlement-log-id-digest/v1', logId: snapshot.logId }) &&
    sameReference(checkpoint.manifestRef, snapshot.manifestRef) && sameReference(checkpoint.genesisPinRef, snapshot.genesisPinRef);
}
function classify(checkpoint, presentation) {
  if (!sameIdentity(checkpoint, presentation.snapshot)) return 'OBSERVED_LEDGER_IDENTITY_DRIFT';
  const checkpointArrays = [checkpoint.history.proposalRefs, checkpoint.history.settlementRefs, checkpoint.history.settledPinRefs];
  const currentArrays = [presentation.proposalRefs, presentation.settlementRefs, presentation.settledPinRefs];
  const checkpointPrefixesCurrent = checkpointArrays.every((value, index) => isPrefix(value, currentArrays[index]));
  const currentPrefixesCheckpoint = currentArrays.every((value, index) => isPrefix(value, checkpointArrays[index]));
  const sameLengths = checkpointArrays.every((value, index) => value.length === currentArrays[index].length);
  if (sameLengths && checkpointPrefixesCurrent && sameSnapshotBinding(checkpoint.snapshotBinding, snapshotBinding(presentation.snapshot))) return 'EXACT_HISTORY_MATCH';
  if (checkpointPrefixesCurrent && !sameLengths) return 'FORWARD_HISTORY_EXTENSION';
  if (currentPrefixesCheckpoint && !sameLengths) return 'OBSERVED_STRICT_HISTORY_ROLLBACK_RELATIVE_TO_PRESENTED_CHECKPOINT';
  return 'OBSERVED_HISTORY_REPLACEMENT_OR_FORK_RELATIVE_TO_PRESENTED_CHECKPOINT';
}
function bestAction(classification) {
  if (classification === 'EXACT_HISTORY_MATCH') return 'RETAIN_PRESENTED_CHECKPOINT_AND_CONTINUE_READ_ONLY_REVIEW';
  if (classification === 'FORWARD_HISTORY_EXTENSION') return 'REVIEW_EXTENSION_BEFORE_OPTIONAL_NEW_CALLER_CHECKPOINT';
  return 'HOLD_AND_ESCALATE_TO_STEWARD';
}
function auditTruth(classification, hasExactCurrentPresentation, operationLockMayBeWritten) {
  return {
    checkpointSelfDigestValidated: true,
    checkpointOriginReauthenticatedAtAudit: false,
    checkpointPinAuthenticated: false,
    currentLedgerValidatedByV25Reload: hasExactCurrentPresentation,
    everyCurrentPersistedPackageExactRebuilt: hasExactCurrentPresentation,
    currentSettledHeadVerifiedFromSettlementSequence: hasExactCurrentPresentation,
    equalBracketingCurrentSnapshotsRequired: hasExactCurrentPresentation,
    transientV25OperationLockMayBeWritten: operationLockMayBeWritten,
    durableLedgerStateChangedByModule: false,
    classificationRelativeToPresentedCheckpointOnly: true,
    strictRollbackObserved: classification === 'OBSERVED_STRICT_HISTORY_ROLLBACK_RELATIVE_TO_PRESENTED_CHECKPOINT',
    replacementOrForkObserved: classification === 'OBSERVED_HISTORY_REPLACEMENT_OR_FORK_RELATIVE_TO_PRESENTED_CHECKPOINT',
    absenceCauseProven: false,
    ledgerSnapshotAtomic: false,
    intermediateOrRevertedLedgerChangesExcluded: false,
    ledgerCurrentAfterFinalReadProven: false,
    checkpointExternalRetentionProven: false,
    deletionOrRollbackPrevented: false,
    protectedMonotonicStateProven: false,
    withheldRootsExcluded: false,
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
function auditCheckpoint(input) {
  bound(input, MAX_INPUT_CANONICAL_BYTES, 'INPUT_TOO_LARGE', 'audit input');
  exactKeys(input, ['auditId', 'auditedAt', 'checkpoint', 'current'], 'audit input');
  const auditId = exactText(input.auditId, 'audit id', 180); const auditedAt = timestamp(input.auditedAt, 'audit time');
  const checkpoint = validateCheckpoint(input.checkpoint);
  if (Date.parse(auditedAt) < Date.parse(checkpoint.checkpointedAt)) fail('INVALID_INPUT', 'audit time must not precede checkpoint time');
  exactKeys(input.current, ['serviceOptions', 'records'], 'current ledger input');
  if (!Array.isArray(input.current.records)) fail('INVALID_INPUT', 'current history records must be an array');
  const observation = observe(input.current.serviceOptions);
  let presentation = null; let classification;
  if (observation.kind === 'absent') {
    if (input.current.records.length) fail('UNUSED_CURRENT_PACKAGES', 'an absent ledger must not have ignored current packages');
    classification = 'OBSERVED_LEDGER_ABSENT';
  } else if (observation.kind === 'invalid') {
    if (input.current.records.length) fail('UNUSED_CURRENT_PACKAGES', 'an invalid ledger must not have ignored current packages');
    classification = 'OBSERVED_LEDGER_OR_CONFIGURATION_INVALID';
  } else {
    presentation = presentObserved(observation, input.current.records); classification = classify(checkpoint, presentation);
  }
  const currentSnapshot = presentation ? presentation.snapshot : null;
  const result = {
    schema: AUDIT_SCHEMA, version: VERSION, status: STATUS, auditId, auditedAt, mode: MODE,
    checkpointRef: checkpointRef(checkpoint), classification,
    current: {
      snapshotBinding: currentSnapshot ? snapshotBinding(currentSnapshot) : null,
      historyDigest: presentation ? presentation.historyDigest : null,
      proposalCount: currentSnapshot ? currentSnapshot.proposalCount : null,
      settlementCount: currentSnapshot ? currentSnapshot.settlementCount : null,
      currentSettledPinRef: currentSnapshot ? reference(currentSnapshot.currentSettledPinRef, 'current settled pin head') : null,
      errorCode: observation.kind === 'invalid' ? observation.errorCode : null
    },
    comparison: {
      checkpointProposalCount: checkpoint.state.proposalCount,
      checkpointSettlementCount: checkpoint.state.settlementCount,
      commonProposalPrefixCount: presentation ? commonPrefixCount(checkpoint.history.proposalRefs, presentation.proposalRefs) : 0,
      commonSettlementPrefixCount: presentation ? commonPrefixCount(checkpoint.history.settlementRefs, presentation.settlementRefs) : 0,
      commonSettledPinPrefixCount: presentation ? commonPrefixCount(checkpoint.history.settledPinRefs, presentation.settledPinRefs) : 0,
      exactHistoryMatch: classification === 'EXACT_HISTORY_MATCH',
      forwardHistoryExtension: classification === 'FORWARD_HISTORY_EXTENSION',
      strictHistoryRollback: classification === 'OBSERVED_STRICT_HISTORY_ROLLBACK_RELATIVE_TO_PRESENTED_CHECKPOINT',
      historyReplacementOrFork: classification === 'OBSERVED_HISTORY_REPLACEMENT_OR_FORK_RELATIVE_TO_PRESENTED_CHECKPOINT',
      ledgerIdentityDrift: classification === 'OBSERVED_LEDGER_IDENTITY_DRIFT'
    },
    decision: {
      reviewRequired: true,
      holdRequired: !['EXACT_HISTORY_MATCH', 'FORWARD_HISTORY_EXTENSION'].includes(classification),
      bestAction: bestAction(classification), autonomousActionCount: 0
    },
    truth: auditTruth(classification, Boolean(presentation), observation.kind !== 'absent'), auditDigest: null
  };
  result.auditDigest = auditDigest(result);
  bound(result, MAX_AUDIT_CANONICAL_BYTES, 'AUDIT_TOO_LARGE', 'audit receipt');
  return result;
}
function validateAudit(value) {
  try {
    bound(value, MAX_AUDIT_CANONICAL_BYTES, 'INVALID_AUDIT', 'audit receipt');
    const candidate = clone(value);
    exactKeys(candidate, ['schema', 'version', 'status', 'auditId', 'auditedAt', 'mode', 'checkpointRef', 'classification', 'current', 'comparison', 'decision', 'truth', 'auditDigest'], 'audit receipt');
    if (candidate.schema !== AUDIT_SCHEMA || candidate.version !== VERSION || candidate.status !== STATUS || candidate.mode !== MODE) fail('INVALID_AUDIT', 'audit identity mismatch');
    exactText(candidate.auditId, 'audit id', 180); timestamp(candidate.auditedAt, 'audit time'); reference(candidate.checkpointRef, 'audit checkpoint reference');
    if (!CLASSIFICATIONS.includes(candidate.classification)) fail('INVALID_AUDIT', 'audit classification is not recognized');
    exactKeys(candidate.current, ['snapshotBinding', 'historyDigest', 'proposalCount', 'settlementCount', 'currentSettledPinRef', 'errorCode'], 'audit current state');
    const present = candidate.current.snapshotBinding !== null;
    if (present) {
      validateSnapshotBinding(candidate.current.snapshotBinding, 'audit current snapshot binding'); digest(candidate.current.historyDigest, 'audit current history digest');
      count(candidate.current.proposalCount, 'audit current proposal count'); count(candidate.current.settlementCount, 'audit current settlement count');
      reference(candidate.current.currentSettledPinRef, 'audit current settled pin head');
      if (candidate.current.errorCode !== null) fail('INVALID_AUDIT', 'a present current ledger cannot have an error code');
    } else {
      if (candidate.current.historyDigest !== null || candidate.current.proposalCount !== null || candidate.current.settlementCount !== null || candidate.current.currentSettledPinRef !== null) fail('INVALID_AUDIT', 'an absent or invalid current ledger cannot claim current history state');
      if (candidate.classification === 'OBSERVED_LEDGER_OR_CONFIGURATION_INVALID') exactText(candidate.current.errorCode, 'audit current error code', 180);
      else if (candidate.current.errorCode !== null) fail('INVALID_AUDIT', 'only invalid current state may retain an error code');
    }
    exactKeys(candidate.comparison, ['checkpointProposalCount', 'checkpointSettlementCount', 'commonProposalPrefixCount', 'commonSettlementPrefixCount', 'commonSettledPinPrefixCount', 'exactHistoryMatch', 'forwardHistoryExtension', 'strictHistoryRollback', 'historyReplacementOrFork', 'ledgerIdentityDrift'], 'audit comparison');
    const checkpointProposalCount = count(candidate.comparison.checkpointProposalCount, 'audit checkpoint proposal count');
    const checkpointSettlementCount = count(candidate.comparison.checkpointSettlementCount, 'audit checkpoint settlement count');
    const commonProposalPrefixCount = count(candidate.comparison.commonProposalPrefixCount, 'common proposal prefix count');
    const commonSettlementPrefixCount = count(candidate.comparison.commonSettlementPrefixCount, 'common settlement prefix count');
    const commonSettledPinPrefixCount = count(candidate.comparison.commonSettledPinPrefixCount, 'common settled pin prefix count');
    if (checkpointSettlementCount > checkpointProposalCount || checkpointProposalCount - checkpointSettlementCount > 1) fail('INVALID_AUDIT', 'audit checkpoint counts are incoherent');
    const requiresCurrent = !['OBSERVED_LEDGER_ABSENT', 'OBSERVED_LEDGER_OR_CONFIGURATION_INVALID'].includes(candidate.classification);
    if (present !== requiresCurrent) fail('INVALID_AUDIT', 'audit classification and current-state presence disagree');
    if (!present) {
      if (commonProposalPrefixCount !== 0 || commonSettlementPrefixCount !== 0 || commonSettledPinPrefixCount !== 0) fail('INVALID_AUDIT', 'absent or invalid state cannot claim a common prefix');
    } else {
      if (candidate.current.settlementCount > candidate.current.proposalCount || candidate.current.proposalCount - candidate.current.settlementCount > 1) fail('INVALID_AUDIT', 'audit current counts are incoherent');
      if (commonProposalPrefixCount > Math.min(checkpointProposalCount, candidate.current.proposalCount) ||
          commonSettlementPrefixCount > Math.min(checkpointSettlementCount, candidate.current.settlementCount) ||
          commonSettledPinPrefixCount > Math.min(checkpointSettlementCount, candidate.current.settlementCount)) fail('INVALID_AUDIT', 'audit common prefix exceeds a presented history');
      if (candidate.classification === 'EXACT_HISTORY_MATCH' &&
          (checkpointProposalCount !== candidate.current.proposalCount || checkpointSettlementCount !== candidate.current.settlementCount || commonProposalPrefixCount !== checkpointProposalCount || commonSettlementPrefixCount !== checkpointSettlementCount || commonSettledPinPrefixCount !== checkpointSettlementCount)) fail('INVALID_AUDIT', 'exact classification does not cover both complete histories');
      if (candidate.classification === 'FORWARD_HISTORY_EXTENSION' &&
          (checkpointProposalCount > candidate.current.proposalCount || checkpointSettlementCount > candidate.current.settlementCount ||
           (checkpointProposalCount === candidate.current.proposalCount && checkpointSettlementCount === candidate.current.settlementCount) ||
           commonProposalPrefixCount !== checkpointProposalCount || commonSettlementPrefixCount !== checkpointSettlementCount || commonSettledPinPrefixCount !== checkpointSettlementCount)) fail('INVALID_AUDIT', 'forward classification is not an exact checkpoint prefix with a strict current extension');
      if (candidate.classification === 'OBSERVED_STRICT_HISTORY_ROLLBACK_RELATIVE_TO_PRESENTED_CHECKPOINT' &&
          (candidate.current.proposalCount > checkpointProposalCount || candidate.current.settlementCount > checkpointSettlementCount ||
           (checkpointProposalCount === candidate.current.proposalCount && checkpointSettlementCount === candidate.current.settlementCount) ||
           commonProposalPrefixCount !== candidate.current.proposalCount || commonSettlementPrefixCount !== candidate.current.settlementCount || commonSettledPinPrefixCount !== candidate.current.settlementCount)) fail('INVALID_AUDIT', 'rollback classification is not an exact current prefix with a strict checkpoint extension');
    }
    const expectedFlags = {
      exactHistoryMatch: candidate.classification === 'EXACT_HISTORY_MATCH',
      forwardHistoryExtension: candidate.classification === 'FORWARD_HISTORY_EXTENSION',
      strictHistoryRollback: candidate.classification === 'OBSERVED_STRICT_HISTORY_ROLLBACK_RELATIVE_TO_PRESENTED_CHECKPOINT',
      historyReplacementOrFork: candidate.classification === 'OBSERVED_HISTORY_REPLACEMENT_OR_FORK_RELATIVE_TO_PRESENTED_CHECKPOINT',
      ledgerIdentityDrift: candidate.classification === 'OBSERVED_LEDGER_IDENTITY_DRIFT'
    };
    Object.keys(expectedFlags).forEach(key => { if (candidate.comparison[key] !== expectedFlags[key]) fail('INVALID_AUDIT', 'audit comparison flag mismatch: ' + key); });
    exactKeys(candidate.decision, ['reviewRequired', 'holdRequired', 'bestAction', 'autonomousActionCount'], 'audit decision');
    if (candidate.decision.reviewRequired !== true || candidate.decision.holdRequired !== !['EXACT_HISTORY_MATCH', 'FORWARD_HISTORY_EXTENSION'].includes(candidate.classification) || candidate.decision.bestAction !== bestAction(candidate.classification) || candidate.decision.autonomousActionCount !== 0) fail('INVALID_AUDIT', 'audit decision boundary mismatch');
    const operationLockMayBeWritten = present || candidate.classification === 'OBSERVED_LEDGER_OR_CONFIGURATION_INVALID';
    if (stableStringify(candidate.truth) !== stableStringify(auditTruth(candidate.classification, present, operationLockMayBeWritten))) fail('INVALID_AUDIT', 'audit truth boundary mismatch');
    if (digest(candidate.auditDigest, 'audit digest') !== auditDigest(candidate)) fail('INVALID_AUDIT', 'audit digest mismatch');
    return candidate;
  } catch (error) {
    if (error instanceof PinSettlementHistoryCheckpointError && error.code === 'INVALID_AUDIT') throw error;
    fail('INVALID_AUDIT', 'audit receipt is invalid: ' + error.message);
  }
}
function verifyAudit(input, receipt) {
  const errors = []; let rebuilt = null;
  try {
    rebuilt = auditCheckpoint(input); const validated = validateAudit(receipt);
    if (stableStringify(rebuilt) !== stableStringify(validated)) throw new Error('presented audit does not exact-rebuild from its caller package');
  } catch (error) { errors.push(error.message); }
  return { pass: errors.length === 0, errors, rebuilt };
}

module.exports = {
  CHECKPOINT_SCHEMA, AUDIT_SCHEMA, HISTORY_COMMITMENT_SCHEMA, VERSION, STATUS, MODE, CLASSIFICATIONS,
  MAX_HISTORY_ITEMS, MAX_INPUT_CANONICAL_BYTES, MAX_CHECKPOINT_CANONICAL_BYTES, MAX_AUDIT_CANONICAL_BYTES,
  PinSettlementHistoryCheckpointError, stableStringify, sha256, createCheckpoint, validateCheckpoint,
  verifyCheckpointOrigin, auditCheckpoint, validateAudit, verifyAudit
};
