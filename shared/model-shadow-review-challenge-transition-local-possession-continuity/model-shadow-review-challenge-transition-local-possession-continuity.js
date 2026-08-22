#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const Custody = require('../model-shadow-review-challenge-transition-local-receiver-custody/model-shadow-review-challenge-transition-local-receiver-custody');
const Possession = require('../model-shadow-review-challenge-transition-local-possession-challenge/model-shadow-review-challenge-transition-local-possession-challenge');
const ReceiverAck = require('../model-shadow-review-challenge-transition-receiver-ack/model-shadow-review-challenge-transition-receiver-ack');

const SNAPSHOT_SCHEMA = 'axm.model-shadow-review-challenge-transition-local-possession-snapshot/v1';
const CHECKPOINT_SCHEMA = 'axm.model-shadow-review-challenge-transition-local-possession-checkpoint/v1';
const AUDIT_SCHEMA = 'axm.model-shadow-review-challenge-transition-local-possession-continuity/v1';
const VERSION = '1.4.0';
const STATUS = 'TEST';
const MAX_ENTRIES = 64;
const MAX_ERRORS = 64;
const MAX_ARTIFACT_CANONICAL_BYTES = 512 * 1024;
const AVAILABILITY = new Set(['AVAILABLE', 'ABSENT', 'INVALID']);
const DIGEST = /^sha256:[a-f0-9]{64}$/;
const CONTENT_FILE = /^[a-f0-9]{64}\.json$/;
const CUSTODY_RECORD_ID = /^local-custody-record:([a-f0-9]{64})$/;

class LocalPossessionContinuityError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'LocalPossessionContinuityError';
    this.code = code;
  }
}

function fail(code, message) {
  throw new LocalPossessionContinuityError(code, message);
}

function stableStringify(value) {
  return Possession.stableStringify(value);
}

function copy(value) {
  return JSON.parse(stableStringify(value));
}

function sha256(value) {
  return Possession.sha256(value);
}

function exactKeys(value, allowed, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail('INVALID_INPUT', label + ' must be an object');
  const extras = Object.keys(value).filter(key => !allowed.includes(key));
  const missing = allowed.filter(key => !Object.prototype.hasOwnProperty.call(value, key));
  if (extras.length) fail('INVALID_INPUT', label + ' has unknown fields: ' + extras.sort().join(', '));
  if (missing.length) fail('INVALID_INPUT', label + ' is missing fields: ' + missing.sort().join(', '));
}

function exactText(value, label, maximum) {
  if (typeof value !== 'string' || !value || value !== value.trim()) fail('INVALID_INPUT', label + ' must be exact non-empty text');
  if (maximum && value.length > maximum) fail('INVALID_INPUT', label + ' is too long');
  return value;
}

function timestamp(value, label) {
  const result = exactText(value, label, 64);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?Z$/.test(result) || Number.isNaN(Date.parse(result))) {
    fail('INVALID_TIME', label + ' must be an exact UTC timestamp');
  }
  return result;
}

function digest(value, label) {
  const result = exactText(value, label, 71);
  if (!DIGEST.test(result)) fail('INVALID_INPUT', label + ' must be an exact SHA-256 digest');
  return result;
}

function reference(value, label, requiredSchema) {
  exactKeys(value, ['id', 'schema', 'sha256'], label);
  const result = {
    id: exactText(value.id, label + '.id', 180),
    schema: exactText(value.schema, label + '.schema', 180),
    sha256: digest(value.sha256, label + '.sha256')
  };
  if (requiredSchema && result.schema !== requiredSchema) fail('REFERENCE_MISMATCH', label + ' schema mismatch');
  return result;
}

function sameReference(left, right) {
  return left.id === right.id && left.schema === right.schema && left.sha256 === right.sha256;
}

function withoutField(value, field) {
  const result = copy(value);
  delete result[field];
  return result;
}

function canonicalBytes(value) {
  return Buffer.byteLength(stableStringify(value), 'utf8');
}

function assertArtifactBound(value, label) {
  if (canonicalBytes(value) > MAX_ARTIFACT_CANONICAL_BYTES) fail('ARTIFACT_TOO_LARGE', label + ' exceeds the bounded canonical byte limit');
}

function normalizeErrors(values) {
  if (!Array.isArray(values)) fail('INVALID_INPUT', 'snapshot errors must be an array');
  if (values.length > MAX_ERRORS) fail('RESOURCE_BOUND_EXCEEDED', 'snapshot errors exceed the bounded count');
  const result = values.map((value, index) => exactText(value, 'snapshot error[' + index + ']', 120));
  if (new Set(result).size !== result.length) fail('INVALID_INPUT', 'snapshot errors must be unique');
  return result.sort();
}

function contentFile(value, label) {
  const result = exactText(value, label, 69);
  if (!CONTENT_FILE.test(result)) fail('PATH_REFUSED', label + ' must be one digest-shaped JSON filename');
  return result;
}

function responseFileName(challengeId, receiverId) {
  return sha256({ challengeId, receiverId }).slice('sha256:'.length) + '.json';
}

function custodyRecordFileName(custodyRecordRef) {
  const ref = reference(custodyRecordRef, 'custody record reference', Custody.CUSTODY_RECORD_SCHEMA);
  const match = CUSTODY_RECORD_ID.exec(ref.id);
  if (!match) fail('CUSTODY_REFERENCE_INVALID', 'custody record id cannot derive the exact v1.2 record filename');
  return match[1] + '.json';
}

function policyReference(policy) {
  return { id: policy.policyId, schema: policy.schema, sha256: policy.policyDigest };
}

function normalizeEntry(value, index) {
  const label = 'local possession snapshot entry[' + index + ']';
  exactKeys(value, ['challengeRef', 'responseRef', 'custodyRecordRef', 'answeredAt', 'responseFileName'], label);
  return {
    challengeRef: reference(value.challengeRef, label + '.challengeRef', Possession.CHALLENGE_SCHEMA),
    responseRef: reference(value.responseRef, label + '.responseRef', Possession.RESPONSE_RECORD_SCHEMA),
    custodyRecordRef: reference(value.custodyRecordRef, label + '.custodyRecordRef', Custody.CUSTODY_RECORD_SCHEMA),
    answeredAt: timestamp(value.answeredAt, label + '.answeredAt'),
    responseFileName: contentFile(value.responseFileName, label + '.responseFileName')
  };
}

function snapshotTruth(availability) {
  return {
    readOnlyObservation: true,
    strictV13ResponseReloadVerified: availability === 'AVAILABLE',
    responseFilenameIdentityVerified: availability === 'AVAILABLE',
    responseSetCanonicalAndUnique: availability === 'AVAILABLE',
    callerOwnedFilesystemObserved: true,
    snapshotOriginAuthenticated: false,
    observationTimeExternallyTrusted: false,
    stateRootPathEmbedded: false,
    rawPartyLabelEmbedded: false,
    rawPublicKeyEmbedded: false,
    rawSignatureEmbedded: false,
    currentAbsenceClaimedAsNeverExisted: false,
    invalidStateClaimedAsUnused: false,
    checkpointAuthorityAuthenticated: false,
    rollbackOrDeletionPrevented: false,
    hostAuthorizationAuthenticated: false,
    executionAuthorized: false,
    automaticWrite: false,
    automaticPromotion: false,
    automaticCanon: false
  };
}

function snapshotInput(snapshot) {
  return {
    observationId: snapshot.observationId,
    observedAt: snapshot.observedAt,
    availability: snapshot.availability,
    receiverIdDigest: snapshot.receiverIdDigest,
    challengerIdDigest: snapshot.challengerIdDigest,
    receiverPolicyRef: snapshot.receiverPolicyRef,
    entries: snapshot.entries,
    errors: snapshot.errors
  };
}

function buildSnapshot(input) {
  exactKeys(input, [
    'observationId', 'observedAt', 'availability', 'receiverIdDigest',
    'challengerIdDigest', 'receiverPolicyRef', 'entries', 'errors'
  ], 'local possession snapshot input');
  const observationId = exactText(input.observationId, 'snapshot observation id', 180);
  const observedAt = timestamp(input.observedAt, 'snapshot observedAt');
  const availability = exactText(input.availability, 'snapshot availability', 20);
  if (!AVAILABILITY.has(availability)) fail('INVALID_INPUT', 'snapshot availability is unsupported');
  const receiverIdDigest = digest(input.receiverIdDigest, 'snapshot receiver id digest');
  const challengerIdDigest = digest(input.challengerIdDigest, 'snapshot challenger id digest');
  const receiverPolicyRef = reference(input.receiverPolicyRef, 'snapshot receiver policy reference', ReceiverAck.POLICY_SCHEMA);
  if (!Array.isArray(input.entries)) fail('INVALID_INPUT', 'snapshot entries must be an array');
  if (input.entries.length > MAX_ENTRIES) fail('RESOURCE_BOUND_EXCEEDED', 'snapshot entries exceed the bounded count');
  const entries = input.entries.map(normalizeEntry).sort((left, right) => left.challengeRef.sha256.localeCompare(right.challengeRef.sha256));
  if (new Set(entries.map(entry => entry.challengeRef.sha256)).size !== entries.length) fail('INVALID_INPUT', 'snapshot challenge references must be unique');
  if (new Set(entries.map(entry => entry.responseFileName)).size !== entries.length) fail('INVALID_INPUT', 'snapshot response filenames must be unique');
  const errors = normalizeErrors(input.errors);
  if (availability === 'AVAILABLE' && errors.length) fail('INVALID_INPUT', 'available snapshot cannot contain errors');
  if (availability !== 'AVAILABLE' && entries.length) fail('INVALID_INPUT', 'unavailable snapshot cannot contain entries');
  if (availability !== 'AVAILABLE' && !errors.length) fail('INVALID_INPUT', 'unavailable snapshot must explain its state');
  const snapshot = {
    schema: SNAPSHOT_SCHEMA,
    version: VERSION,
    observationId,
    observedAt,
    status: STATUS,
    availability,
    receiverIdDigest,
    challengerIdDigest,
    receiverPolicyRef,
    entryCount: entries.length,
    entriesDigest: sha256(entries),
    entries,
    errors,
    truth: snapshotTruth(availability),
    snapshotDigest: null
  };
  snapshot.snapshotDigest = sha256(withoutField(snapshot, 'snapshotDigest'));
  assertArtifactBound(snapshot, 'local possession snapshot');
  return snapshot;
}

function validateSnapshot(value) {
  assertArtifactBound(value, 'local possession snapshot');
  if (!value || value.schema !== SNAPSHOT_SCHEMA || value.version !== VERSION || value.status !== STATUS) fail('SNAPSHOT_INVALID', 'snapshot identity mismatch');
  const rebuilt = buildSnapshot(snapshotInput(value));
  if (stableStringify(rebuilt) !== stableStringify(value)) fail('SNAPSHOT_INVALID', 'snapshot content or digest mismatch');
  return rebuilt;
}

function invalidSnapshot(base, codes, availability) {
  return buildSnapshot({
    observationId: base.observationId,
    observedAt: base.observedAt,
    availability: availability || 'INVALID',
    receiverIdDigest: base.receiverIdDigest,
    challengerIdDigest: base.challengerIdDigest,
    receiverPolicyRef: base.receiverPolicyRef,
    entries: [],
    errors: codes
  });
}

function readResponse(filePath) {
  let stat;
  try { stat = fs.lstatSync(filePath); } catch (error) { fail('RESPONSE_UNREADABLE', 'response file cannot be inspected'); }
  if (!stat.isFile() || stat.isSymbolicLink()) fail('RESPONSE_NOT_REGULAR_FILE', 'response entry must be a regular file and not a symbolic link');
  if (stat.size > Possession.MAX_RESPONSE_CANONICAL_BYTES + 1) fail('RESPONSE_TOO_LARGE', 'response file exceeds the v1.3 byte bound');
  let raw;
  let value;
  try {
    raw = fs.readFileSync(filePath, 'utf8');
    value = JSON.parse(raw);
  } catch (error) { fail('RESPONSE_INVALID_JSON', 'response file is invalid JSON'); }
  if (raw !== stableStringify(value) + '\n') fail('RESPONSE_NONCANONICAL', 'response file is not exact canonical JSON');
  return value;
}

function safeErrorCode(error, fallback) {
  if (error && typeof error.code === 'string' && /^[A-Z0-9_]{1,80}$/.test(error.code)) return fallback + '_' + error.code;
  return fallback;
}

function captureState(options) {
  exactKeys(options, [
    'stateRoot', 'receiverId', 'challengerId', 'challengerPublicKeyPem',
    'receiverPolicy', 'observationId', 'observedAt'
  ], 'local possession state observation options');
  const receiverId = exactText(options.receiverId, 'configured receiver id', 120);
  const challengerId = exactText(options.challengerId, 'configured challenger id', 120);
  const observationId = exactText(options.observationId, 'observation id', 180);
  const observedAt = timestamp(options.observedAt, 'observation observedAt');
  let policy;
  try { policy = ReceiverAck.validatePolicy(copy(options.receiverPolicy)); } catch (error) { fail('POLICY_INVALID', 'receiver policy exact validation failed: ' + error.message); }
  const receiver = policy.receivers.find(item => item.receiverId === receiverId);
  if (!receiver || !receiver.enabled) fail('RECEIVER_INVALID', 'configured receiver is not enabled in the policy');
  const base = {
    observationId,
    observedAt,
    receiverIdDigest: sha256({ receiverId }),
    challengerIdDigest: sha256({ challengerId }),
    receiverPolicyRef: policyReference(policy)
  };
  let stateRoot;
  try {
    const supplied = exactText(options.stateRoot, 'local possession state root', 32767);
    if (!path.isAbsolute(supplied)) return invalidSnapshot(base, ['STATE_ROOT_NOT_ABSOLUTE']);
    stateRoot = path.resolve(supplied);
    if (stateRoot === path.parse(stateRoot).root) return invalidSnapshot(base, ['STATE_ROOT_IS_FILESYSTEM_ROOT']);
    const rootStat = fs.lstatSync(stateRoot);
    if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) return invalidSnapshot(base, ['STATE_ROOT_NOT_REAL_DIRECTORY']);
  } catch (error) { return invalidSnapshot(base, ['STATE_ROOT_UNAVAILABLE']); }
  let service;
  try {
    service = Possession.createReceiver({
      stateRoot,
      receiverId,
      privateKeyPem: null,
      challengerId,
      challengerPublicKeyPem: options.challengerPublicKeyPem
    });
  } catch (error) { fail('OBSERVER_CONFIGURATION_INVALID', 'v1.3 receiver observer configuration failed: ' + error.message); }
  const namespace = path.join(stateRoot, Possession.NAMESPACE);
  const answers = path.join(namespace, Possession.ANSWERS_DIRECTORY);
  if (!fs.existsSync(namespace)) return invalidSnapshot(base, ['RESPONSE_NAMESPACE_ABSENT'], 'ABSENT');
  try {
    const rootStat = fs.lstatSync(stateRoot);
    if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) return invalidSnapshot(base, ['STATE_ROOT_NOT_REAL_DIRECTORY']);
    const namespaceStat = fs.lstatSync(namespace);
    if (!namespaceStat.isDirectory() || namespaceStat.isSymbolicLink()) return invalidSnapshot(base, ['RESPONSE_NAMESPACE_NOT_REAL_DIRECTORY']);
    const namespaceNames = fs.readdirSync(namespace).sort();
    if (namespaceNames.some(name => name !== Possession.ANSWERS_DIRECTORY)) return invalidSnapshot(base, ['RESPONSE_NAMESPACE_UNEXPECTED_ENTRY']);
    if (!fs.existsSync(answers)) return invalidSnapshot(base, ['ANSWERS_DIRECTORY_ABSENT']);
    const answersStat = fs.lstatSync(answers);
    if (!answersStat.isDirectory() || answersStat.isSymbolicLink()) return invalidSnapshot(base, ['ANSWERS_NOT_REAL_DIRECTORY']);
    const names = fs.readdirSync(answers).sort();
    if (names.length > MAX_ENTRIES) return invalidSnapshot(base, ['RESPONSE_ENTRY_COUNT_EXCEEDED']);
    if (names.some(name => !CONTENT_FILE.test(name))) return invalidSnapshot(base, ['RESPONSE_UNEXPECTED_ENTRY_NAME']);
    const entries = [];
    const errors = [];
    names.forEach(name => {
      try {
        const response = readResponse(path.join(answers, name));
        if (!response || typeof response !== 'object' || response.schema !== Possession.RESPONSE_RECORD_SCHEMA) fail('RESPONSE_IDENTITY_INVALID', 'response schema mismatch');
        const expectedName = responseFileName(response.challenge.challengeId, response.receiverId);
        if (name !== expectedName) fail('RESPONSE_FILENAME_IDENTITY_MISMATCH', 'response filename does not match its signed challenge and receiver identity');
        const custodyFileName = custodyRecordFileName(response.custodyRecordRef);
        const reload = service.reload({
          responseFileName: name,
          recordFileName: custodyFileName,
          receiverPolicy: copy(policy),
          challenge: copy(response.challenge),
          loadedAt: observedAt
        });
        if (reload.responseRef.sha256 !== response.responseDigest || reload.challengeRef.sha256 !== response.challenge.challengeDigest) {
          fail('RESPONSE_CHANGED_DURING_CAPTURE', 'response changed between strict read and v1.3 reload');
        }
        entries.push({
          challengeRef: { id: response.challenge.challengeId, schema: response.challenge.schema, sha256: response.challenge.challengeDigest },
          responseRef: { id: response.responseId, schema: response.schema, sha256: response.responseDigest },
          custodyRecordRef: copy(response.custodyRecordRef),
          answeredAt: response.answeredAt,
          responseFileName: name
        });
      } catch (error) {
        errors.push(safeErrorCode(error, 'RESPONSE_VALIDATION_FAILED'));
      }
    });
    if (new Set(errors).size > MAX_ERRORS) return invalidSnapshot(base, ['RESPONSE_ERROR_COUNT_EXCEEDED']);
    if (errors.length) return invalidSnapshot(base, Array.from(new Set(errors)).sort());
    if (new Set(entries.map(entry => entry.challengeRef.sha256)).size !== entries.length) return invalidSnapshot(base, ['DUPLICATE_CHALLENGE_RESPONSE']);
    return buildSnapshot({ ...base, availability: 'AVAILABLE', entries, errors: [] });
  } catch (error) {
    return invalidSnapshot(base, [safeErrorCode(error, 'RESPONSE_STATE_INSPECTION_FAILED')]);
  }
}

function checkpointTruth() {
  return {
    sourceSnapshotExactRebuildVerified: true,
    sourceResponseSignaturesWereVerified: true,
    responseFilenameIdentityWasVerified: true,
    checkpointSelfDigestValid: true,
    callerRetentionRequiredForFutureComparison: true,
    checkpointStoredByModule: false,
    checkpointAuthorityAuthenticated: false,
    checkpointRetentionProven: false,
    checkpointTimeExternallyTrusted: false,
    protectedMonotonicStateProven: false,
    rollbackOrDeletionPrevented: false,
    preCheckpointHistoryProven: false,
    hostAuthorizationAuthenticated: false,
    executionAuthorized: false,
    automaticWrite: false,
    automaticPromotion: false,
    automaticCanon: false
  };
}

function buildCheckpoint(input) {
  exactKeys(input, ['checkpointId', 'anchoredAt', 'currentSnapshot'], 'local possession checkpoint input');
  const checkpointId = exactText(input.checkpointId, 'checkpoint id', 180);
  const anchoredAt = timestamp(input.anchoredAt, 'checkpoint anchoredAt');
  const snapshot = validateSnapshot(copy(input.currentSnapshot));
  if (snapshot.availability !== 'AVAILABLE' || snapshot.entryCount < 1) fail('CHECKPOINT_SOURCE_INVALID', 'checkpoint requires an available non-empty snapshot');
  if (Date.parse(anchoredAt) < Date.parse(snapshot.observedAt)) fail('INVALID_TIME', 'checkpoint cannot predate its source snapshot');
  const checkpoint = {
    schema: CHECKPOINT_SCHEMA,
    version: VERSION,
    checkpointId,
    anchoredAt,
    status: STATUS,
    sourceSnapshotRef: { id: snapshot.observationId, schema: snapshot.schema, sha256: snapshot.snapshotDigest },
    receiverIdDigest: snapshot.receiverIdDigest,
    challengerIdDigest: snapshot.challengerIdDigest,
    receiverPolicyRef: copy(snapshot.receiverPolicyRef),
    entryCount: snapshot.entryCount,
    entriesDigest: snapshot.entriesDigest,
    entries: copy(snapshot.entries),
    truth: checkpointTruth(),
    checkpointDigest: null
  };
  checkpoint.checkpointDigest = sha256(withoutField(checkpoint, 'checkpointDigest'));
  assertArtifactBound(checkpoint, 'local possession checkpoint');
  return checkpoint;
}

function validateCheckpoint(value) {
  assertArtifactBound(value, 'local possession checkpoint');
  exactKeys(value, [
    'schema', 'version', 'checkpointId', 'anchoredAt', 'status',
    'sourceSnapshotRef', 'receiverIdDigest', 'challengerIdDigest',
    'receiverPolicyRef', 'entryCount', 'entriesDigest', 'entries', 'truth',
    'checkpointDigest'
  ], 'local possession checkpoint');
  if (value.schema !== CHECKPOINT_SCHEMA || value.version !== VERSION || value.status !== STATUS) fail('CHECKPOINT_INVALID', 'checkpoint identity mismatch');
  const checkpointId = exactText(value.checkpointId, 'checkpoint id', 180);
  const anchoredAt = timestamp(value.anchoredAt, 'checkpoint anchoredAt');
  const sourceSnapshotRef = reference(value.sourceSnapshotRef, 'checkpoint source snapshot reference', SNAPSHOT_SCHEMA);
  const receiverIdDigest = digest(value.receiverIdDigest, 'checkpoint receiver id digest');
  const challengerIdDigest = digest(value.challengerIdDigest, 'checkpoint challenger id digest');
  const receiverPolicyRef = reference(value.receiverPolicyRef, 'checkpoint receiver policy reference', ReceiverAck.POLICY_SCHEMA);
  if (!Array.isArray(value.entries) || value.entries.length < 1 || value.entries.length > MAX_ENTRIES) fail('CHECKPOINT_INVALID', 'checkpoint entries are outside the bounded non-empty count');
  const entries = value.entries.map(normalizeEntry).sort((left, right) => left.challengeRef.sha256.localeCompare(right.challengeRef.sha256));
  if (new Set(entries.map(entry => entry.challengeRef.sha256)).size !== entries.length) fail('CHECKPOINT_INVALID', 'checkpoint challenge references must be unique');
  if (!Number.isInteger(value.entryCount) || value.entryCount !== entries.length) fail('CHECKPOINT_INVALID', 'checkpoint entry count mismatch');
  if (digest(value.entriesDigest, 'checkpoint entries digest') !== sha256(entries)) fail('CHECKPOINT_INVALID', 'checkpoint entries digest mismatch');
  if (stableStringify(value.entries) !== stableStringify(entries)) fail('CHECKPOINT_INVALID', 'checkpoint entries are not canonical');
  if (stableStringify(value.truth) !== stableStringify(checkpointTruth())) fail('CHECKPOINT_INVALID', 'checkpoint truth boundary mismatch');
  const normalized = {
    schema: CHECKPOINT_SCHEMA,
    version: VERSION,
    checkpointId,
    anchoredAt,
    status: STATUS,
    sourceSnapshotRef,
    receiverIdDigest,
    challengerIdDigest,
    receiverPolicyRef,
    entryCount: entries.length,
    entriesDigest: sha256(entries),
    entries,
    truth: checkpointTruth(),
    checkpointDigest: value.checkpointDigest
  };
  if (digest(value.checkpointDigest, 'checkpoint digest') !== sha256(withoutField(normalized, 'checkpointDigest'))) fail('CHECKPOINT_INVALID', 'checkpoint digest mismatch');
  return copy(normalized);
}

function auditTruth(classification, identityMatches, current) {
  return {
    priorCheckpointSelfDigestValid: true,
    currentSnapshotSelfDigestValid: true,
    currentAvailableResponsesStrictlyVerified: current.availability === 'AVAILABLE',
    responseFilenameIdentityVerifiedWhenAvailable: current.availability === 'AVAILABLE',
    comparisonBoundToExactConfiguredIdentity: identityMatches,
    rollbackOrReplacementDetectedAgainstPresentedCheckpoint: classification === 'ROLLBACK_OR_REPLACEMENT_DETECTED_AGAINST_PRESENTED_CHECKPOINT',
    currentAbsenceDetectedAgainstPresentedCheckpoint: current.availability === 'ABSENT',
    currentInvalidityDetected: current.availability === 'INVALID',
    presentedCheckpointProvesExternalRetention: false,
    checkpointAuthorityAuthenticated: false,
    currentSnapshotOriginAuthenticated: false,
    auditTimeExternallyTrusted: false,
    preCheckpointHistoryProven: false,
    rollbackOrDeletionPrevented: false,
    protectedMonotonicStateProven: false,
    hostAuthorizationAuthenticated: false,
    actualHumanParticipationProven: false,
    providerExecutionProven: false,
    evaluationPerformed: false,
    executionAuthorized: false,
    adoptionAuthorized: false,
    humanBenefitProven: false,
    broadLearningClaimed: false,
    automaticWrite: false,
    automaticPromotion: false,
    automaticMerge: false,
    automaticCanon: false
  };
}

function buildAudit(input) {
  exactKeys(input, ['auditId', 'checkedAt', 'priorCheckpoint', 'currentSnapshot'], 'local possession continuity audit input');
  const auditId = exactText(input.auditId, 'audit id', 180);
  const checkedAt = timestamp(input.checkedAt, 'audit checkedAt');
  const checkpoint = validateCheckpoint(copy(input.priorCheckpoint));
  const current = validateSnapshot(copy(input.currentSnapshot));
  if (Date.parse(checkedAt) < Date.parse(checkpoint.anchoredAt) || Date.parse(checkedAt) < Date.parse(current.observedAt)) fail('INVALID_TIME', 'audit cannot predate checkpoint or current observation');
  const identityMatches = checkpoint.receiverIdDigest === current.receiverIdDigest &&
    checkpoint.challengerIdDigest === current.challengerIdDigest &&
    sameReference(checkpoint.receiverPolicyRef, current.receiverPolicyRef);
  const missing = [];
  const replaced = [];
  const added = [];
  if (current.availability === 'AVAILABLE' && identityMatches) {
    const priorByChallenge = new Map(checkpoint.entries.map(entry => [entry.challengeRef.sha256, entry]));
    const currentByChallenge = new Map(current.entries.map(entry => [entry.challengeRef.sha256, entry]));
    checkpoint.entries.forEach(prior => {
      const now = currentByChallenge.get(prior.challengeRef.sha256);
      if (!now) missing.push(prior.challengeRef.sha256);
      else if (stableStringify(prior) !== stableStringify(now)) {
        replaced.push({
          challengeDigest: prior.challengeRef.sha256,
          checkpointResponseDigest: prior.responseRef.sha256,
          currentResponseDigest: now.responseRef.sha256
        });
      }
    });
    current.entries.forEach(now => {
      if (!priorByChallenge.has(now.challengeRef.sha256)) added.push(now.challengeRef.sha256);
    });
  }
  let classification;
  let bestAction;
  if (current.availability === 'ABSENT') {
    classification = 'HOLD_LOCAL_POSSESSION_STATE_ABSENT_AGAINST_PRESENTED_CHECKPOINT';
    bestAction = 'PRESERVE_CHECKPOINT_AND_REQUEST_PROTECTED_STATE_RECOVERY_REVIEW';
  } else if (current.availability === 'INVALID') {
    classification = 'HOLD_CURRENT_LOCAL_POSSESSION_STATE_INVALID';
    bestAction = 'PRESERVE_CHECKPOINT_AND_REPAIR_OR_EXPLAIN_CURRENT_STATE';
  } else if (!identityMatches) {
    classification = 'HOLD_LOCAL_POSSESSION_IDENTITY_CHANGED';
    bestAction = 'PRESERVE_BOTH_IDENTITIES_AND_REQUEST_STEWARD_RECONCILIATION';
  } else if (missing.length || replaced.length) {
    classification = 'ROLLBACK_OR_REPLACEMENT_DETECTED_AGAINST_PRESENTED_CHECKPOINT';
    bestAction = 'HOLD_NEW_RELIANCE_AND_REQUEST_PROTECTED_STATE_RECOVERY_REVIEW';
  } else if (added.length) {
    classification = 'CURRENT_RESPONSE_SET_EXTENDS_PRESENTED_CHECKPOINT';
    bestAction = 'RETAIN_A_NEW_CHECKPOINT_IF_AN_AUTHORIZED_HOST_CHOOSES';
  } else {
    classification = 'CURRENT_RESPONSE_SET_MATCHES_PRESENTED_CHECKPOINT';
    bestAction = 'NO_CONTINUITY_REPAIR_INDICATED_RELATIVE_TO_PRESENTED_CHECKPOINT';
  }
  const reviewRequired = classification.startsWith('HOLD_') || classification.startsWith('ROLLBACK_');
  const audit = {
    schema: AUDIT_SCHEMA,
    version: VERSION,
    auditId,
    checkedAt,
    status: STATUS,
    priorCheckpoint: {
      id: checkpoint.checkpointId,
      schema: checkpoint.schema,
      sha256: checkpoint.checkpointDigest,
      sourceSnapshotRef: copy(checkpoint.sourceSnapshotRef),
      receiverIdDigest: checkpoint.receiverIdDigest,
      challengerIdDigest: checkpoint.challengerIdDigest,
      receiverPolicyRef: copy(checkpoint.receiverPolicyRef),
      entryCount: checkpoint.entryCount,
      entriesDigest: checkpoint.entriesDigest
    },
    currentSnapshot: {
      id: current.observationId,
      schema: current.schema,
      sha256: current.snapshotDigest,
      availability: current.availability,
      receiverIdDigest: current.receiverIdDigest,
      challengerIdDigest: current.challengerIdDigest,
      receiverPolicyRef: copy(current.receiverPolicyRef),
      entryCount: current.entryCount,
      entriesDigest: current.entriesDigest,
      errors: copy(current.errors)
    },
    comparison: {
      identityMatches,
      missingCheckpointChallenges: missing.sort(),
      replacedCheckpointEntries: replaced.sort((left, right) => left.challengeDigest.localeCompare(right.challengeDigest)),
      addedCurrentChallenges: added.sort()
    },
    decision: {
      classification,
      bestAction,
      reviewRequired,
      autonomousActionCount: 0
    },
    nextGate: 'HOST_AUTHENTICATED_EXTERNALLY_RETAINED_CHECKPOINT_OR_PROTECTED_MONOTONIC_STORE',
    truth: auditTruth(classification, identityMatches, current),
    auditDigest: null
  };
  audit.auditDigest = sha256(withoutField(audit, 'auditDigest'));
  assertArtifactBound(audit, 'local possession continuity audit');
  return audit;
}

function verifySnapshot(value) {
  try { return { pass: stableStringify(validateSnapshot(value)) === stableStringify(value), errors: [] }; }
  catch (error) { return { pass: false, errors: [error.message] }; }
}

function verifyCheckpoint(value) {
  try { return { pass: stableStringify(validateCheckpoint(value)) === stableStringify(value), errors: [] }; }
  catch (error) { return { pass: false, errors: [error.message] }; }
}

function verifyAudit(input, receipt) {
  try { return { pass: stableStringify(buildAudit(input)) === stableStringify(receipt), errors: [] }; }
  catch (error) { return { pass: false, errors: [error.message] }; }
}

module.exports = {
  SNAPSHOT_SCHEMA,
  CHECKPOINT_SCHEMA,
  AUDIT_SCHEMA,
  VERSION,
  STATUS,
  MAX_ENTRIES,
  MAX_ERRORS,
  MAX_ARTIFACT_CANONICAL_BYTES,
  LocalPossessionContinuityError,
  stableStringify,
  sha256,
  responseFileName,
  custodyRecordFileName,
  buildSnapshot,
  validateSnapshot,
  captureState,
  buildCheckpoint,
  validateCheckpoint,
  buildAudit,
  verifySnapshot,
  verifyCheckpoint,
  verifyAudit
};
