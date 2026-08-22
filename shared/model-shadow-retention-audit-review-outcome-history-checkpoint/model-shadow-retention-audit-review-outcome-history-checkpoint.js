#!/usr/bin/env node
'use strict';

const Ledger = require('../model-shadow-retention-audit-review-outcome-ledger/model-shadow-retention-audit-review-outcome-ledger');
const Outcome = require('../model-shadow-retention-audit-review-outcome/model-shadow-retention-audit-review-outcome');

const CHECKPOINT_SCHEMA = 'axm.model-shadow-retention-audit-review-outcome-history-checkpoint/v1';
const AUDIT_SCHEMA = 'axm.model-shadow-retention-audit-review-outcome-history-audit/v1';
const HISTORY_COMMITMENT_SCHEMA = 'axm.model-shadow-retention-audit-review-outcome-history-commitment/v1';
const VERSION = '3.3.0';
const STATUS = 'TEST';
const MODE = 'CALLER_PORTABLE_UNAUTHENTICATED_REVIEW_OUTCOME_HISTORY_CHECKPOINT';
const MAX_HISTORY_ITEMS = Ledger.MAX_RECORDS;
const MAX_INPUT_CANONICAL_BYTES = 64 * 1024 * 1024;
const MAX_CHECKPOINT_CANONICAL_BYTES = 16 * 1024 * 1024;
const MAX_AUDIT_CANONICAL_BYTES = 1024 * 1024;
const DIGEST_PATTERN = /^sha256:[a-f0-9]{64}$/;
const ENTRY_CLASSIFICATIONS = Object.freeze(Object.values(Ledger.CLASSIFICATIONS));
const CLASSIFICATIONS = Object.freeze([
  'EXACT_HISTORY_MATCH',
  'FORWARD_HISTORY_EXTENSION',
  'OBSERVED_STRICT_HISTORY_ROLLBACK_RELATIVE_TO_PRESENTED_CHECKPOINT',
  'OBSERVED_HISTORY_REPLACEMENT_OR_FORK_RELATIVE_TO_PRESENTED_CHECKPOINT',
  'OBSERVED_LEDGER_IDENTITY_DRIFT',
  'OBSERVED_LEDGER_ABSENT',
  'OBSERVED_LEDGER_OR_CONFIGURATION_INVALID'
]);

class RetentionAuditReviewOutcomeHistoryCheckpointError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'RetentionAuditReviewOutcomeHistoryCheckpointError';
    this.code = code;
  }
}

function stableStringify(value) { return Ledger.stableStringify(value); }
function clone(value) { return JSON.parse(stableStringify(value)); }
function sha256(value) { return Ledger.sha256(value); }
function same(left, right) { return stableStringify(left) === stableStringify(right); }
function fail(code, message) { throw new RetentionAuditReviewOutcomeHistoryCheckpointError(code, message); }

function canonicalBytes(value, code, label) {
  try { return Buffer.byteLength(stableStringify(value), 'utf8'); }
  catch (error) { fail(code, label + ' must be canonical JSON data'); }
}

function bound(value, maximum, code, label) {
  if (canonicalBytes(value, code, label) > maximum) fail(code, label + ' exceeds the bounded canonical byte limit');
}

function exactKeys(value, allowed, code, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(code, label + ' must be an object');
  const extras = Object.keys(value).filter(key => !allowed.includes(key));
  const missing = allowed.filter(key => !Object.prototype.hasOwnProperty.call(value, key));
  if (extras.length) fail(code, label + ' has unknown fields: ' + extras.sort().join(', '));
  if (missing.length) fail(code, label + ' is missing fields: ' + missing.sort().join(', '));
}

function text(value, code, label, maximum) {
  if (typeof value !== 'string' || !value || value !== value.trim()) fail(code, label + ' must be exact non-empty text');
  if (maximum && value.length > maximum) fail(code, label + ' is too long');
  return value;
}

function timestamp(value, code, label) {
  const result = text(value, code, label, 64);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(result) || Number.isNaN(Date.parse(result))) {
    fail(code, label + ' must be an exact millisecond UTC timestamp');
  }
  return result;
}

function digest(value, code, label) {
  const result = text(value, code, label, 71);
  if (!DIGEST_PATTERN.test(result)) fail(code, label + ' must be an exact SHA-256 digest');
  return result;
}

function count(value, code, label) {
  if (!Number.isSafeInteger(value) || value < 0 || value > MAX_HISTORY_ITEMS) fail(code, label + ' must be a bounded non-negative integer');
  return value;
}

function bool(value, code, label) {
  if (typeof value !== 'boolean') fail(code, label + ' must be boolean');
  return value;
}

function reference(value, code, label, expectedSchema) {
  exactKeys(value, ['id', 'schema', 'sha256'], code, label);
  const result = {
    id: text(value.id, code, label + '.id', 180),
    schema: text(value.schema, code, label + '.schema', 180),
    sha256: digest(value.sha256, code, label + '.sha256')
  };
  if (expectedSchema && result.schema !== expectedSchema) fail(code, label + ' schema mismatch');
  return result;
}

function nullableReference(value, code, label, expectedSchema) {
  return value === null ? null : reference(value, code, label, expectedSchema);
}

function snapshotBinding(value, code, label) {
  exactKeys(value, ['schema', 'sha256'], code, label);
  const result = {
    schema: text(value.schema, code, label + '.schema', 180),
    sha256: digest(value.sha256, code, label + '.sha256')
  };
  if (result.schema !== Ledger.SNAPSHOT_SCHEMA) fail(code, label + ' schema mismatch');
  return result;
}

function nullableSnapshotBinding(value, code, label) { return value === null ? null : snapshotBinding(value, code, label); }
function sameReference(left, right) { return left.id === right.id && left.schema === right.schema && left.sha256 === right.sha256; }
function sameNullableReference(left, right) { return left === null || right === null ? left === right : sameReference(left, right); }
function withoutField(value, field) { const result = clone(value); delete result[field]; return result; }
function checkpointDigest(value) { return sha256(withoutField(value, 'checkpointDigest')); }
function auditDigest(value) { return sha256(withoutField(value, 'auditDigest')); }
function checkpointRef(value) { return { id: value.checkpointId, schema: value.schema, sha256: value.checkpointDigest }; }
function recordRef(value) { return { id: value.recordId, schema: value.schema, sha256: value.recordDigest }; }
function snapshotRef(value) { return { schema: value.schema, sha256: value.snapshotDigest }; }

function historyEntry(record, index, code) {
  if (!record || !record.log || record.log.sequence !== index + 1) fail(code, 'history record sequence is not contiguous');
  if (!ENTRY_CLASSIFICATIONS.includes(record.classification)) fail(code, 'history record classification is unsupported');
  return {
    sequence: index + 1,
    recordedAt: timestamp(record.recordedAt, code, 'history record time'),
    recordRef: reference(recordRef(record), code, 'history record reference', Ledger.RECORD_SCHEMA),
    outcomeRef: reference(record.outcomeRef, code, 'history outcome reference', Outcome.OUTCOME_SCHEMA),
    classification: record.classification
  };
}

function validateHistoryEntry(value, index, entries, code) {
  exactKeys(value, ['sequence', 'recordedAt', 'recordRef', 'outcomeRef', 'classification'], code, 'history entry ' + (index + 1));
  if (!Number.isSafeInteger(value.sequence) || value.sequence !== index + 1) fail(code, 'history entry sequence is not contiguous');
  timestamp(value.recordedAt, code, 'history entry time');
  reference(value.recordRef, code, 'history entry record reference', Ledger.RECORD_SCHEMA);
  reference(value.outcomeRef, code, 'history entry outcome reference', Outcome.OUTCOME_SCHEMA);
  if (!ENTRY_CLASSIFICATIONS.includes(value.classification)) fail(code, 'history entry classification is unsupported');
  if (index > 0 && Date.parse(value.recordedAt) <= Date.parse(entries[index - 1].recordedAt)) fail(code, 'history entry times are not strictly forward');
  return clone(value);
}

function historyDigest(entries) { return sha256({ schema: HISTORY_COMMITMENT_SCHEMA, entries }); }

function countsFor(entries) {
  return {
    recordCount: entries.length,
    approvedCount: entries.filter(entry => entry.classification === Ledger.CLASSIFICATIONS.APPROVED).length,
    holdCount: entries.filter(entry => entry.classification === Ledger.CLASSIFICATIONS.HOLD).length,
    rejectedCount: entries.filter(entry => entry.classification === Ledger.CLASSIFICATIONS.REJECTED).length
  };
}

function checkpointTruth() {
  return {
    originLedgerValidatedByV32Reload: true,
    completeRecordChainLoadedInOneV32Read: true,
    fullOrderedRecordAndOutcomeReferenceSequenceCommitted: true,
    minimizedClassificationTimelineCommitted: true,
    equalBracketingSnapshotsRequired: true,
    checkpointPortableAsData: true,
    checkpointPersistedByModule: false,
    completeV32RecordEmbedded: false,
    completeMinimizedV31OutcomeEmbedded: false,
    actorDigestOrVoteEvidenceEmbedded: false,
    rawReviewMaterialEmbedded: false,
    configuredPathEmbedded: false,
    checkpointSeparatelyRetainedProven: false,
    checkpointOriginAuthenticated: false,
    checkpointExternalRetentionProven: false,
    ledgerSnapshotAtomic: false,
    intermediateOrRevertedLedgerChangesExcluded: false,
    ledgerCurrentAfterFinalReadProven: false,
    localControllerFullRewriteExcludedWithoutPresentedCheckpoint: false,
    jointCheckpointAndLedgerReplacementExcluded: false,
    deletionOrRollbackPrevented: false,
    protectedMonotonicStateProven: false,
    globallyConsistentLogProven: false,
    hostAuthorizationAuthenticated: false,
    actorRealWorldIdentityProven: false,
    actualHumanParticipationProven: false,
    retentionHoldResolved: false,
    timeExternallyTrusted: false,
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

function observe(options) {
  let service;
  try { service = Ledger.createService(clone(options)); }
  catch (error) {
    const errorCode = typeof error.code === 'string' && error.code && error.code.length <= 180 ? error.code : 'UNCLASSIFIED_CONFIGURATION_FAILURE';
    return { kind: 'invalid', service: null, snapshot: null, errorCode };
  }
  try {
    const snapshot = service.inspect();
    if (snapshot === null) return { kind: 'absent', service, snapshot: null, errorCode: null };
    return { kind: 'present', service, snapshot, errorCode: null };
  } catch (error) {
    const errorCode = typeof error.code === 'string' && error.code && error.code.length <= 180 ? error.code : 'UNCLASSIFIED_LEDGER_READ_FAILURE';
    return { kind: 'invalid', service: null, snapshot: null, errorCode };
  }
}

function presentObserved(observation) {
  if (observation.kind !== 'present') fail('LEDGER_NOT_PRESENT', 'an exact v3.2 presentation requires a valid present ledger');
  const before = clone(observation.snapshot);
  let records;
  try { records = observation.service.readAll(); }
  catch (error) { fail('LEDGER_INVALID_DURING_PRESENTATION', 'v3.2 complete record read failed: ' + (error.code || 'UNCLASSIFIED_LEDGER_READ_FAILURE')); }
  let after;
  try { after = observation.service.inspect(); }
  catch (error) { fail('LEDGER_INVALID_DURING_PRESENTATION', 'v3.2 final snapshot failed: ' + (error.code || 'UNCLASSIFIED_LEDGER_READ_FAILURE')); }
  if (after === null || !same(before, after)) fail('LEDGER_MOVED_DURING_PRESENTATION', 'v3.2 snapshot changed across the complete record read');
  if (!Array.isArray(records) || records.length !== before.recordCount || records.length > MAX_HISTORY_ITEMS) {
    fail('LEDGER_HISTORY_COUNT_MISMATCH', 'v3.2 complete record read does not match snapshot count');
  }
  const entries = records.map((record, index) => {
    if (!record.log || !sameReference(record.log.manifestRef, before.manifestRef)) fail('LEDGER_HISTORY_BINDING_MISMATCH', 'v3.2 record manifest binding does not match snapshot');
    return historyEntry(record, index, 'LEDGER_HISTORY_INVALID');
  });
  const totals = countsFor(entries);
  if (totals.approvedCount !== before.approvedCount || totals.holdCount !== before.holdCount || totals.rejectedCount !== before.rejectedCount) {
    fail('LEDGER_HISTORY_COUNT_MISMATCH', 'v3.2 classification counts do not match snapshot');
  }
  const latest = entries.length ? entries[entries.length - 1] : null;
  if (!latest || !sameNullableReference(latest.recordRef, before.latestRecordRef) ||
      !sameNullableReference(latest.outcomeRef, before.latestOutcomeRef) || latest.classification !== before.latestClassification) {
    fail('LEDGER_HISTORY_BINDING_MISMATCH', 'v3.2 history endpoint does not match snapshot');
  }
  return {
    snapshot: before,
    entries,
    historyDigest: historyDigest(entries),
    latestRecordTime: latest.recordedAt
  };
}

function presentCurrent(options) {
  const observation = observe(options);
  if (observation.kind === 'absent') fail('LEDGER_ABSENT', 'the v3.2 review-outcome ledger is absent');
  if (observation.kind === 'invalid') fail('LEDGER_OR_CONFIGURATION_INVALID', 'the v3.2 review-outcome ledger or configuration is invalid: ' + observation.errorCode);
  return presentObserved(observation);
}

function createCheckpoint(input) {
  bound(input, MAX_INPUT_CANONICAL_BYTES, 'INPUT_TOO_LARGE', 'checkpoint input');
  exactKeys(input, ['checkpointId', 'checkpointedAt', 'serviceOptions'], 'INVALID_INPUT', 'checkpoint input');
  const checkpointId = text(input.checkpointId, 'INVALID_INPUT', 'checkpoint id', 180);
  const checkpointedAt = timestamp(input.checkpointedAt, 'INVALID_INPUT', 'checkpoint time');
  const presentation = presentCurrent(input.serviceOptions);
  if (Date.parse(checkpointedAt) < Date.parse(presentation.latestRecordTime)) fail('INVALID_INPUT', 'checkpoint time must not precede the latest record');
  const snapshot = presentation.snapshot;
  const totals = countsFor(presentation.entries);
  const result = {
    schema: CHECKPOINT_SCHEMA,
    version: VERSION,
    status: STATUS,
    checkpointId,
    checkpointedAt,
    mode: MODE,
    ledger: {
      manifestRef: reference(snapshot.manifestRef, 'INVALID_INPUT', 'snapshot manifest reference', Ledger.MANIFEST_SCHEMA),
      snapshotBinding: snapshotRef(snapshot),
      recordCount: totals.recordCount,
      approvedCount: totals.approvedCount,
      holdCount: totals.holdCount,
      rejectedCount: totals.rejectedCount,
      latestRecordRef: reference(snapshot.latestRecordRef, 'INVALID_INPUT', 'snapshot latest record reference', Ledger.RECORD_SCHEMA),
      latestOutcomeRef: reference(snapshot.latestOutcomeRef, 'INVALID_INPUT', 'snapshot latest outcome reference', Outcome.OUTCOME_SCHEMA),
      latestClassification: snapshot.latestClassification
    },
    history: {
      entries: clone(presentation.entries),
      historyDigest: presentation.historyDigest
    },
    truth: checkpointTruth(),
    checkpointDigest: null
  };
  result.checkpointDigest = checkpointDigest(result);
  bound(result, MAX_CHECKPOINT_CANONICAL_BYTES, 'CHECKPOINT_TOO_LARGE', 'checkpoint');
  return result;
}

function validateCheckpoint(value) {
  const code = 'INVALID_CHECKPOINT';
  try {
    bound(value, MAX_CHECKPOINT_CANONICAL_BYTES, code, 'checkpoint');
    const candidate = clone(value);
    exactKeys(candidate, ['schema', 'version', 'status', 'checkpointId', 'checkpointedAt', 'mode', 'ledger', 'history', 'truth', 'checkpointDigest'], code, 'checkpoint');
    if (candidate.schema !== CHECKPOINT_SCHEMA || candidate.version !== VERSION || candidate.status !== STATUS || candidate.mode !== MODE) fail(code, 'checkpoint identity mismatch');
    text(candidate.checkpointId, code, 'checkpoint id', 180);
    timestamp(candidate.checkpointedAt, code, 'checkpoint time');
    exactKeys(candidate.ledger, ['manifestRef', 'snapshotBinding', 'recordCount', 'approvedCount', 'holdCount', 'rejectedCount', 'latestRecordRef', 'latestOutcomeRef', 'latestClassification'], code, 'checkpoint ledger binding');
    reference(candidate.ledger.manifestRef, code, 'checkpoint manifest reference', Ledger.MANIFEST_SCHEMA);
    snapshotBinding(candidate.ledger.snapshotBinding, code, 'checkpoint snapshot binding');
    const recordCount = count(candidate.ledger.recordCount, code, 'checkpoint record count');
    count(candidate.ledger.approvedCount, code, 'checkpoint approved count');
    count(candidate.ledger.holdCount, code, 'checkpoint hold count');
    count(candidate.ledger.rejectedCount, code, 'checkpoint rejected count');
    reference(candidate.ledger.latestRecordRef, code, 'checkpoint latest record reference', Ledger.RECORD_SCHEMA);
    reference(candidate.ledger.latestOutcomeRef, code, 'checkpoint latest outcome reference', Outcome.OUTCOME_SCHEMA);
    if (!ENTRY_CLASSIFICATIONS.includes(candidate.ledger.latestClassification)) fail(code, 'checkpoint latest classification is unsupported');
    exactKeys(candidate.history, ['entries', 'historyDigest'], code, 'checkpoint history');
    if (!Array.isArray(candidate.history.entries) || !candidate.history.entries.length || candidate.history.entries.length > MAX_HISTORY_ITEMS) fail(code, 'checkpoint history must be a non-empty bounded array');
    const entries = candidate.history.entries.map((entry, index, all) => validateHistoryEntry(entry, index, all, code));
    const totals = countsFor(entries);
    if (recordCount !== entries.length || candidate.ledger.approvedCount !== totals.approvedCount || candidate.ledger.holdCount !== totals.holdCount || candidate.ledger.rejectedCount !== totals.rejectedCount) fail(code, 'checkpoint counts do not match history');
    const latest = entries[entries.length - 1];
    if (!sameReference(candidate.ledger.latestRecordRef, latest.recordRef) || !sameReference(candidate.ledger.latestOutcomeRef, latest.outcomeRef) || candidate.ledger.latestClassification !== latest.classification) fail(code, 'checkpoint endpoints do not match history');
    if (Date.parse(candidate.checkpointedAt) < Date.parse(latest.recordedAt)) fail(code, 'checkpoint time precedes latest history entry');
    if (digest(candidate.history.historyDigest, code, 'checkpoint history digest') !== historyDigest(entries)) fail(code, 'checkpoint history digest mismatch');
    if (!same(candidate.truth, checkpointTruth())) fail(code, 'checkpoint truth boundary mismatch');
    if (digest(candidate.checkpointDigest, code, 'checkpoint digest') !== checkpointDigest(candidate)) fail(code, 'checkpoint digest mismatch');
    return candidate;
  } catch (error) {
    if (error instanceof RetentionAuditReviewOutcomeHistoryCheckpointError && error.code === code) throw error;
    fail(code, 'checkpoint is invalid: ' + error.message);
  }
}

function verifyCheckpointOrigin(input, receipt) {
  const errors = [];
  let rebuilt = null;
  try {
    rebuilt = createCheckpoint(clone(input));
    const validated = validateCheckpoint(receipt);
    if (!same(rebuilt, validated)) throw new Error('presented checkpoint does not exact-rebuild from the v3.2 origin');
  } catch (error) { errors.push(error.message); }
  return { pass: errors.length === 0, errors, rebuilt };
}

function commonPrefixCount(left, right) {
  const maximum = Math.min(left.length, right.length);
  let index = 0;
  while (index < maximum && same(left[index], right[index])) index += 1;
  return index;
}

function isPrefix(prefix, value) { return prefix.length <= value.length && commonPrefixCount(prefix, value) === prefix.length; }

function classify(checkpoint, presentation) {
  if (!sameReference(checkpoint.ledger.manifestRef, presentation.snapshot.manifestRef)) return 'OBSERVED_LEDGER_IDENTITY_DRIFT';
  const prior = checkpoint.history.entries;
  const current = presentation.entries;
  const priorPrefixesCurrent = isPrefix(prior, current);
  const currentPrefixesPrior = isPrefix(current, prior);
  if (prior.length === current.length && priorPrefixesCurrent && checkpoint.history.historyDigest === presentation.historyDigest && same(checkpoint.ledger.snapshotBinding, snapshotRef(presentation.snapshot))) return 'EXACT_HISTORY_MATCH';
  if (priorPrefixesCurrent && current.length > prior.length) return 'FORWARD_HISTORY_EXTENSION';
  if (currentPrefixesPrior && current.length < prior.length) return 'OBSERVED_STRICT_HISTORY_ROLLBACK_RELATIVE_TO_PRESENTED_CHECKPOINT';
  return 'OBSERVED_HISTORY_REPLACEMENT_OR_FORK_RELATIVE_TO_PRESENTED_CHECKPOINT';
}

function bestAction(classification) {
  if (classification === 'EXACT_HISTORY_MATCH') return 'RETAIN_CHECKPOINT_AND_CONTINUE_READ_ONLY_REVIEW';
  if (classification === 'FORWARD_HISTORY_EXTENSION') return 'REVIEW_EXTENSION_BEFORE_OPTIONAL_NEW_CALLER_CHECKPOINT';
  return 'HOLD_CONTINUITY_AND_ESCALATE_TO_AUTHENTICATED_STEWARD';
}

function auditTruth(classification, currentPresent) {
  return {
    checkpointSelfDigestValidated: true,
    checkpointOriginReauthenticatedAtAudit: false,
    currentLedgerValidatedByV32Reload: currentPresent,
    completeCurrentRecordChainLoadedInOneV32Read: currentPresent,
    equalBracketingCurrentSnapshotsRequired: currentPresent,
    classificationRelativeToPresentedCheckpointOnly: true,
    retainedCheckpointRelativeRewriteDetected: ['OBSERVED_STRICT_HISTORY_ROLLBACK_RELATIVE_TO_PRESENTED_CHECKPOINT', 'OBSERVED_HISTORY_REPLACEMENT_OR_FORK_RELATIVE_TO_PRESENTED_CHECKPOINT', 'OBSERVED_LEDGER_IDENTITY_DRIFT'].includes(classification),
    checkpointSeparatelyRetainedProven: false,
    checkpointOriginAuthenticated: false,
    originalHistoryProven: false,
    jointCheckpointAndLedgerReplacementExcluded: false,
    withheldCheckpointOrBranchExcluded: false,
    ledgerSnapshotAtomic: false,
    intermediateOrRevertedLedgerChangesExcluded: false,
    ledgerCurrentAfterFinalReadProven: false,
    absenceCauseProven: false,
    deletionOrRollbackPrevented: false,
    externalRetentionProven: false,
    protectedMonotonicStateProven: false,
    globallyConsistentLogProven: false,
    hostAuthorizationAuthenticated: false,
    actorRealWorldIdentityProven: false,
    actualHumanParticipationProven: false,
    retentionHoldResolved: false,
    timeExternallyTrusted: false,
    completeV32RecordEmbedded: false,
    completeMinimizedV31OutcomeEmbedded: false,
    actorDigestOrVoteEvidenceEmbedded: false,
    rawReviewMaterialEmbedded: false,
    configuredPathEmbedded: false,
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
  exactKeys(input, ['auditId', 'auditedAt', 'checkpoint', 'currentServiceOptions'], 'INVALID_INPUT', 'audit input');
  const auditId = text(input.auditId, 'INVALID_INPUT', 'audit id', 180);
  const auditedAt = timestamp(input.auditedAt, 'INVALID_INPUT', 'audit time');
  const checkpoint = validateCheckpoint(input.checkpoint);
  if (Date.parse(auditedAt) < Date.parse(checkpoint.checkpointedAt)) fail('INVALID_INPUT', 'audit time must not precede checkpoint time');
  const observation = observe(input.currentServiceOptions);
  let presentation = null;
  let classification;
  let errorCode = observation.errorCode;
  if (observation.kind === 'absent') classification = 'OBSERVED_LEDGER_ABSENT';
  else if (observation.kind === 'invalid') classification = 'OBSERVED_LEDGER_OR_CONFIGURATION_INVALID';
  else {
    try {
      presentation = presentObserved(observation);
      classification = classify(checkpoint, presentation);
    } catch (error) {
      classification = 'OBSERVED_LEDGER_OR_CONFIGURATION_INVALID';
      errorCode = typeof error.code === 'string' && error.code && error.code.length <= 180 ? error.code : 'UNCLASSIFIED_PRESENTATION_FAILURE';
    }
  }
  const snapshot = presentation ? presentation.snapshot : null;
  const commonPrefix = presentation ? commonPrefixCount(checkpoint.history.entries, presentation.entries) : 0;
  const result = {
    schema: AUDIT_SCHEMA,
    version: VERSION,
    status: STATUS,
    auditId,
    auditedAt,
    mode: MODE,
    checkpointRef: checkpointRef(checkpoint),
    classification,
    current: {
      manifestRef: snapshot ? reference(snapshot.manifestRef, 'INVALID_INPUT', 'current manifest reference', Ledger.MANIFEST_SCHEMA) : null,
      snapshotBinding: snapshot ? snapshotRef(snapshot) : null,
      recordCount: snapshot ? snapshot.recordCount : null,
      historyDigest: presentation ? presentation.historyDigest : null,
      latestRecordRef: snapshot ? reference(snapshot.latestRecordRef, 'INVALID_INPUT', 'current latest record reference', Ledger.RECORD_SCHEMA) : null,
      latestOutcomeRef: snapshot ? reference(snapshot.latestOutcomeRef, 'INVALID_INPUT', 'current latest outcome reference', Outcome.OUTCOME_SCHEMA) : null,
      latestClassification: snapshot ? snapshot.latestClassification : null,
      errorCode: presentation ? null : (classification === 'OBSERVED_LEDGER_OR_CONFIGURATION_INVALID' ? errorCode : null)
    },
    comparison: {
      checkpointRecordCount: checkpoint.ledger.recordCount,
      currentRecordCount: snapshot ? snapshot.recordCount : null,
      commonPrefixCount: commonPrefix,
      exactHistoryMatch: classification === 'EXACT_HISTORY_MATCH',
      forwardHistoryExtension: classification === 'FORWARD_HISTORY_EXTENSION',
      strictHistoryRollback: classification === 'OBSERVED_STRICT_HISTORY_ROLLBACK_RELATIVE_TO_PRESENTED_CHECKPOINT',
      historyReplacementOrFork: classification === 'OBSERVED_HISTORY_REPLACEMENT_OR_FORK_RELATIVE_TO_PRESENTED_CHECKPOINT',
      ledgerIdentityDrift: classification === 'OBSERVED_LEDGER_IDENTITY_DRIFT'
    },
    decision: {
      reviewRequired: true,
      continuityHoldRequired: !['EXACT_HISTORY_MATCH', 'FORWARD_HISTORY_EXTENSION'].includes(classification),
      retentionHoldUnresolved: true,
      bestAction: bestAction(classification),
      autonomousActionCount: 0
    },
    truth: auditTruth(classification, Boolean(presentation)),
    auditDigest: null
  };
  result.auditDigest = auditDigest(result);
  bound(result, MAX_AUDIT_CANONICAL_BYTES, 'AUDIT_TOO_LARGE', 'audit receipt');
  return result;
}

function validateAudit(value) {
  const code = 'INVALID_AUDIT';
  try {
    bound(value, MAX_AUDIT_CANONICAL_BYTES, code, 'audit receipt');
    const candidate = clone(value);
    exactKeys(candidate, ['schema', 'version', 'status', 'auditId', 'auditedAt', 'mode', 'checkpointRef', 'classification', 'current', 'comparison', 'decision', 'truth', 'auditDigest'], code, 'audit receipt');
    if (candidate.schema !== AUDIT_SCHEMA || candidate.version !== VERSION || candidate.status !== STATUS || candidate.mode !== MODE) fail(code, 'audit identity mismatch');
    text(candidate.auditId, code, 'audit id', 180);
    timestamp(candidate.auditedAt, code, 'audit time');
    reference(candidate.checkpointRef, code, 'audit checkpoint reference', CHECKPOINT_SCHEMA);
    if (!CLASSIFICATIONS.includes(candidate.classification)) fail(code, 'audit classification is unsupported');
    exactKeys(candidate.current, ['manifestRef', 'snapshotBinding', 'recordCount', 'historyDigest', 'latestRecordRef', 'latestOutcomeRef', 'latestClassification', 'errorCode'], code, 'audit current state');
    const currentPresent = candidate.current.snapshotBinding !== null;
    if (currentPresent) {
      reference(candidate.current.manifestRef, code, 'audit current manifest reference', Ledger.MANIFEST_SCHEMA);
      snapshotBinding(candidate.current.snapshotBinding, code, 'audit current snapshot binding');
      const currentCount = count(candidate.current.recordCount, code, 'audit current record count');
      if (currentCount < 1) fail(code, 'present current history must be non-empty');
      digest(candidate.current.historyDigest, code, 'audit current history digest');
      reference(candidate.current.latestRecordRef, code, 'audit current latest record reference', Ledger.RECORD_SCHEMA);
      reference(candidate.current.latestOutcomeRef, code, 'audit current latest outcome reference', Outcome.OUTCOME_SCHEMA);
      if (!ENTRY_CLASSIFICATIONS.includes(candidate.current.latestClassification)) fail(code, 'audit current latest classification is unsupported');
      if (candidate.current.errorCode !== null) fail(code, 'present current history cannot have an error code');
    } else {
      for (const field of ['manifestRef', 'recordCount', 'historyDigest', 'latestRecordRef', 'latestOutcomeRef', 'latestClassification']) {
        if (candidate.current[field] !== null) fail(code, 'absent or invalid current history must not retain ' + field);
      }
      if (candidate.classification === 'OBSERVED_LEDGER_OR_CONFIGURATION_INVALID') text(candidate.current.errorCode, code, 'audit current error code', 180);
      else if (candidate.current.errorCode !== null) fail(code, 'only invalid current history may retain an error code');
    }
    const needsCurrent = !['OBSERVED_LEDGER_ABSENT', 'OBSERVED_LEDGER_OR_CONFIGURATION_INVALID'].includes(candidate.classification);
    if (currentPresent !== needsCurrent) fail(code, 'audit classification and current-state presence disagree');
    exactKeys(candidate.comparison, ['checkpointRecordCount', 'currentRecordCount', 'commonPrefixCount', 'exactHistoryMatch', 'forwardHistoryExtension', 'strictHistoryRollback', 'historyReplacementOrFork', 'ledgerIdentityDrift'], code, 'audit comparison');
    const checkpointCount = count(candidate.comparison.checkpointRecordCount, code, 'audit checkpoint record count');
    const currentCount = candidate.comparison.currentRecordCount === null ? null : count(candidate.comparison.currentRecordCount, code, 'audit current comparison count');
    const commonPrefix = count(candidate.comparison.commonPrefixCount, code, 'audit common prefix count');
    if (currentPresent && currentCount !== candidate.current.recordCount) fail(code, 'audit current counts disagree');
    if (!currentPresent && (currentCount !== null || commonPrefix !== 0)) fail(code, 'absent or invalid history cannot claim current count or prefix');
    if (currentPresent && commonPrefix > Math.min(checkpointCount, currentCount)) fail(code, 'audit common prefix exceeds a history');
    const flags = {
      exactHistoryMatch: candidate.classification === 'EXACT_HISTORY_MATCH',
      forwardHistoryExtension: candidate.classification === 'FORWARD_HISTORY_EXTENSION',
      strictHistoryRollback: candidate.classification === 'OBSERVED_STRICT_HISTORY_ROLLBACK_RELATIVE_TO_PRESENTED_CHECKPOINT',
      historyReplacementOrFork: candidate.classification === 'OBSERVED_HISTORY_REPLACEMENT_OR_FORK_RELATIVE_TO_PRESENTED_CHECKPOINT',
      ledgerIdentityDrift: candidate.classification === 'OBSERVED_LEDGER_IDENTITY_DRIFT'
    };
    Object.keys(flags).forEach(field => { if (bool(candidate.comparison[field], code, 'audit comparison ' + field) !== flags[field]) fail(code, 'audit comparison flag mismatch: ' + field); });
    if (flags.exactHistoryMatch && (currentCount !== checkpointCount || commonPrefix !== checkpointCount)) fail(code, 'exact audit comparison counts are incoherent');
    if (flags.forwardHistoryExtension && (currentCount <= checkpointCount || commonPrefix !== checkpointCount)) fail(code, 'forward audit comparison counts are incoherent');
    if (flags.strictHistoryRollback && (currentCount >= checkpointCount || commonPrefix !== currentCount)) fail(code, 'rollback audit comparison counts are incoherent');
    if (flags.historyReplacementOrFork && commonPrefix >= Math.min(checkpointCount, currentCount)) fail(code, 'replacement or fork audit comparison counts are incoherent');
    exactKeys(candidate.decision, ['reviewRequired', 'continuityHoldRequired', 'retentionHoldUnresolved', 'bestAction', 'autonomousActionCount'], code, 'audit decision');
    if (candidate.decision.reviewRequired !== true || candidate.decision.retentionHoldUnresolved !== true || candidate.decision.continuityHoldRequired !== !['EXACT_HISTORY_MATCH', 'FORWARD_HISTORY_EXTENSION'].includes(candidate.classification) || candidate.decision.bestAction !== bestAction(candidate.classification) || candidate.decision.autonomousActionCount !== 0) fail(code, 'audit decision boundary mismatch');
    if (!same(candidate.truth, auditTruth(candidate.classification, currentPresent))) fail(code, 'audit truth boundary mismatch');
    if (digest(candidate.auditDigest, code, 'audit digest') !== auditDigest(candidate)) fail(code, 'audit digest mismatch');
    return candidate;
  } catch (error) {
    if (error instanceof RetentionAuditReviewOutcomeHistoryCheckpointError && error.code === code) throw error;
    fail(code, 'audit receipt is invalid: ' + error.message);
  }
}

function verifyAudit(input, receipt) {
  const errors = [];
  let rebuilt = null;
  try {
    rebuilt = auditCheckpoint(clone(input));
    const validated = validateAudit(receipt);
    if (!same(rebuilt, validated)) throw new Error('presented audit does not exact-rebuild from caller package');
  } catch (error) { errors.push(error.message); }
  return { pass: errors.length === 0, errors, rebuilt };
}

module.exports = {
  CHECKPOINT_SCHEMA,
  AUDIT_SCHEMA,
  HISTORY_COMMITMENT_SCHEMA,
  VERSION,
  STATUS,
  MODE,
  MAX_HISTORY_ITEMS,
  MAX_INPUT_CANONICAL_BYTES,
  MAX_CHECKPOINT_CANONICAL_BYTES,
  MAX_AUDIT_CANONICAL_BYTES,
  ENTRY_CLASSIFICATIONS,
  CLASSIFICATIONS,
  RetentionAuditReviewOutcomeHistoryCheckpointError,
  stableStringify,
  sha256,
  createCheckpoint,
  validateCheckpoint,
  verifyCheckpointOrigin,
  auditCheckpoint,
  validateAudit,
  verifyAudit
};
