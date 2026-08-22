#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const Ledger = require('../model-shadow-review-challenge-ledger/model-shadow-review-challenge-ledger');
const Deterministic = require('../model-shadow-signed-review-evidence/model-shadow-signed-review-evidence');

const SNAPSHOT_SCHEMA = 'axm.model-shadow-review-challenge-ledger-snapshot/v1';
const CHECKPOINT_SCHEMA = 'axm.model-shadow-review-challenge-checkpoint/v1';
const AUDIT_SCHEMA = 'axm.model-shadow-review-challenge-continuity/v1';
const VERSION = '0.3.0';
const STATUS = 'TEST';
const ENTRY_FILE = /^([a-f0-9]{64})\.json$/;
const DIGEST = /^sha256:[a-f0-9]{64}$/;
const AVAILABILITY = new Set(['AVAILABLE', 'ABSENT', 'INVALID']);

function clone(value) {
  return JSON.parse(Deterministic.stableStringify(value));
}

function stableStringify(value) {
  return Deterministic.stableStringify(value);
}

function sha256(value) {
  return Deterministic.sha256(value);
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

function withoutField(value, field) {
  const result = clone(value);
  delete result[field];
  return result;
}

function normalizeEntry(value, index) {
  const label = 'ledger snapshot entry[' + index + ']';
  exactKeys(value, ['challengeDigest', 'consumptionReceiptDigest', 'consumedAt'], label);
  return {
    challengeDigest: digest(value.challengeDigest, label + '.challengeDigest'),
    consumptionReceiptDigest: digest(value.consumptionReceiptDigest, label + '.consumptionReceiptDigest'),
    consumedAt: timestamp(value.consumedAt, label + '.consumedAt')
  };
}

function normalizeErrors(values) {
  if (!Array.isArray(values)) throw new Error('ledger snapshot errors must be an array');
  const result = values.map((value, index) => exactText(value, 'ledger snapshot error[' + index + ']', 120));
  if (new Set(result).size !== result.length) throw new Error('ledger snapshot errors must be unique');
  return result.sort();
}

function snapshotInput(snapshot) {
  return {
    observationId: snapshot.observationId,
    observedAt: snapshot.observedAt,
    ledgerId: snapshot.ledgerId,
    availability: snapshot.availability,
    manifestRef: snapshot.manifestRef,
    entries: snapshot.entries,
    errors: snapshot.errors
  };
}

function snapshotTruth(availability) {
  return {
    readOnlyObservation: true,
    currentLedgerFilesValidated: availability === 'AVAILABLE',
    callerOwnedFilesystemObserved: true,
    snapshotOriginAuthenticated: false,
    observationTimeExternallyTrusted: false,
    stateRootPathEmbedded: false,
    absenceClaimedAsNeverExisted: false,
    invalidStateClaimedAsUnusedLedger: false,
    checkpointAuthorityAuthenticated: false,
    hostAuthorizationAuthenticated: false,
    executionAuthorized: false,
    automaticWrite: false,
    automaticPromotion: false,
    automaticCanon: false,
    foundationMutation: false
  };
}

function buildSnapshot(input) {
  exactKeys(input, [
    'observationId', 'observedAt', 'ledgerId', 'availability',
    'manifestRef', 'entries', 'errors'
  ], 'ledger snapshot input');
  const observationId = exactText(input.observationId, 'ledger snapshot observation id', 180);
  const observedAt = timestamp(input.observedAt, 'ledger snapshot observedAt');
  const ledgerId = exactText(input.ledgerId, 'ledger snapshot ledger id', 180);
  const availability = exactText(input.availability, 'ledger snapshot availability', 20);
  if (!AVAILABILITY.has(availability)) throw new Error('ledger snapshot availability is unsupported');
  if (!Array.isArray(input.entries)) throw new Error('ledger snapshot entries must be an array');
  const entries = input.entries.map(normalizeEntry).sort((left, right) => left.challengeDigest.localeCompare(right.challengeDigest));
  if (new Set(entries.map(entry => entry.challengeDigest)).size !== entries.length) {
    throw new Error('ledger snapshot challenge digests must be unique');
  }
  const errors = normalizeErrors(input.errors);
  let manifestRef = null;
  if (availability === 'AVAILABLE') {
    manifestRef = reference(input.manifestRef, 'ledger snapshot manifest reference');
    if (manifestRef.id !== ledgerId || manifestRef.schema !== Ledger.MANIFEST_SCHEMA) {
      throw new Error('ledger snapshot manifest reference identity mismatch');
    }
    if (errors.length) throw new Error('available ledger snapshot cannot contain errors');
  } else {
    if (input.manifestRef !== null) throw new Error('unavailable ledger snapshot cannot contain a manifest reference');
    if (entries.length) throw new Error('unavailable ledger snapshot cannot contain entries');
    if (!errors.length) throw new Error('unavailable ledger snapshot must explain its state');
  }

  const snapshot = {
    schema: SNAPSHOT_SCHEMA,
    version: VERSION,
    observationId,
    observedAt,
    status: STATUS,
    ledgerId,
    availability,
    manifestRef,
    entryCount: entries.length,
    entriesDigest: sha256(entries),
    entries,
    errors,
    truth: snapshotTruth(availability),
    snapshotDigest: null
  };
  snapshot.snapshotDigest = sha256(withoutField(snapshot, 'snapshotDigest'));
  return snapshot;
}

function validateSnapshot(value) {
  if (!value || value.schema !== SNAPSHOT_SCHEMA) throw new Error('ledger snapshot schema mismatch');
  const rebuilt = buildSnapshot(snapshotInput(value));
  if (stableStringify(rebuilt) !== stableStringify(value)) throw new Error('ledger snapshot content or digest mismatch');
  return rebuilt;
}

function invalidSnapshot(options, codes, availability) {
  return buildSnapshot({
    observationId: options.observationId,
    observedAt: options.observedAt,
    ledgerId: options.ledgerId,
    availability: availability || 'INVALID',
    manifestRef: null,
    entries: [],
    errors: codes
  });
}

function captureState(options) {
  exactKeys(options, ['stateRoot', 'ledgerId', 'observationId', 'observedAt'], 'ledger state observation options');
  const ledgerId = exactText(options.ledgerId, 'ledger state observation ledger id', 180);
  const observation = {
    observationId: exactText(options.observationId, 'ledger state observation id', 180),
    observedAt: timestamp(options.observedAt, 'ledger state observedAt'),
    ledgerId
  };
  let stateRoot;
  try {
    stateRoot = path.resolve(exactText(options.stateRoot, 'ledger state root', 32767));
    if (stateRoot === path.parse(stateRoot).root) return invalidSnapshot(observation, ['STATE_ROOT_IS_FILESYSTEM_ROOT']);
    const rootStat = fs.lstatSync(stateRoot);
    if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) return invalidSnapshot(observation, ['STATE_ROOT_NOT_REAL_DIRECTORY']);
  } catch (error) {
    return invalidSnapshot(observation, ['STATE_ROOT_UNAVAILABLE']);
  }

  const namespace = path.join(stateRoot, Ledger.NAMESPACE);
  const manifestPath = path.join(namespace, Ledger.MANIFEST_FILE);
  const entriesPath = path.join(namespace, Ledger.ENTRIES_DIRECTORY);
  if (!fs.existsSync(namespace)) return invalidSnapshot(observation, ['LEDGER_NAMESPACE_ABSENT'], 'ABSENT');

  try {
    const namespaceStat = fs.lstatSync(namespace);
    if (!namespaceStat.isDirectory() || namespaceStat.isSymbolicLink()) {
      return invalidSnapshot(observation, ['LEDGER_NAMESPACE_NOT_REAL_DIRECTORY']);
    }
    const namespaceNames = fs.readdirSync(namespace).sort();
    if (namespaceNames.some(name => ![Ledger.MANIFEST_FILE, Ledger.ENTRIES_DIRECTORY].includes(name))) {
      return invalidSnapshot(observation, ['LEDGER_UNEXPECTED_NAMESPACE_ENTRY']);
    }
    if (!fs.existsSync(manifestPath)) return invalidSnapshot(observation, ['LEDGER_MANIFEST_ABSENT']);
    const manifestStat = fs.lstatSync(manifestPath);
    if (!manifestStat.isFile() || manifestStat.isSymbolicLink()) return invalidSnapshot(observation, ['LEDGER_MANIFEST_NOT_REGULAR_FILE']);
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    const expectedManifest = Ledger.buildManifest(ledgerId);
    if (stableStringify(manifest) !== stableStringify(expectedManifest)) {
      return invalidSnapshot(observation, ['LEDGER_MANIFEST_CONTENT_MISMATCH']);
    }
    if (!fs.existsSync(entriesPath)) return invalidSnapshot(observation, ['LEDGER_ENTRIES_DIRECTORY_ABSENT']);
    const entriesStat = fs.lstatSync(entriesPath);
    if (!entriesStat.isDirectory() || entriesStat.isSymbolicLink()) {
      return invalidSnapshot(observation, ['LEDGER_ENTRIES_NOT_REAL_DIRECTORY']);
    }
    const names = fs.readdirSync(entriesPath).sort();
    if (names.some(name => !ENTRY_FILE.test(name))) return invalidSnapshot(observation, ['LEDGER_UNEXPECTED_ENTRY_NAME']);
    const entries = names.map(name => {
      const match = ENTRY_FILE.exec(name);
      const entryPath = path.join(entriesPath, name);
      const stat = fs.lstatSync(entryPath);
      if (!stat.isFile() || stat.isSymbolicLink()) throw Object.assign(new Error('entry is not a regular file'), { code: 'LEDGER_ENTRY_NOT_REGULAR_FILE' });
      const receipt = JSON.parse(fs.readFileSync(entryPath, 'utf8'));
      const challengeDigest = 'sha256:' + match[1];
      const validated = Ledger.validateStoredReceipt(receipt, challengeDigest, ledgerId);
      return {
        challengeDigest,
        consumptionReceiptDigest: validated.receiptDigest,
        consumedAt: validated.consumedAt
      };
    });
    return buildSnapshot({
      observationId: observation.observationId,
      observedAt: observation.observedAt,
      ledgerId,
      availability: 'AVAILABLE',
      manifestRef: { id: ledgerId, schema: Ledger.MANIFEST_SCHEMA, sha256: manifest.manifestDigest },
      entries,
      errors: []
    });
  } catch (error) {
    const code = typeof error.code === 'string' && /^[A-Z0-9_]{3,120}$/.test(error.code)
      ? error.code
      : error instanceof SyntaxError ? 'LEDGER_JSON_INVALID' : 'LEDGER_STATE_INVALID';
    return invalidSnapshot(observation, [code]);
  }
}

function buildCheckpoint(input) {
  exactKeys(input, ['checkpointId', 'anchoredAt', 'currentSnapshot'], 'challenge checkpoint input');
  const checkpointId = exactText(input.checkpointId, 'challenge checkpoint id', 180);
  const anchoredAt = timestamp(input.anchoredAt, 'challenge checkpoint anchoredAt');
  const snapshot = validateSnapshot(input.currentSnapshot);
  if (snapshot.availability !== 'AVAILABLE') throw new Error('challenge checkpoint requires an available valid ledger snapshot');
  if (Date.parse(anchoredAt) < Date.parse(snapshot.observedAt)) throw new Error('challenge checkpoint cannot predate its ledger observation');
  const checkpoint = {
    schema: CHECKPOINT_SCHEMA,
    version: VERSION,
    checkpointId,
    anchoredAt,
    status: STATUS,
    ledgerRef: clone(snapshot.manifestRef),
    sourceSnapshotRef: { id: snapshot.observationId, schema: snapshot.schema, sha256: snapshot.snapshotDigest },
    entryCount: snapshot.entryCount,
    entriesDigest: snapshot.entriesDigest,
    entries: clone(snapshot.entries),
    state: 'CALLER_RETAINED_CHECKPOINT_FOR_FUTURE_COMPARISON_AUTHORITY_NOT_AUTHENTICATED',
    nextGate: 'HOST_AUTHENTICATED_EXTERNALLY_RETAINED_CHECKPOINT_OR_PROTECTED_MONOTONIC_STORE',
    truth: buildCheckpointTruth(),
    checkpointDigest: null
  };
  checkpoint.checkpointDigest = sha256(withoutField(checkpoint, 'checkpointDigest'));
  return checkpoint;
}

function validateCheckpoint(value) {
  exactKeys(value, [
    'schema', 'version', 'checkpointId', 'anchoredAt', 'status', 'ledgerRef',
    'sourceSnapshotRef', 'entryCount', 'entriesDigest', 'entries', 'state',
    'nextGate', 'truth', 'checkpointDigest'
  ], 'challenge checkpoint');
  if (value.schema !== CHECKPOINT_SCHEMA || value.version !== VERSION || value.status !== STATUS) {
    throw new Error('challenge checkpoint identity mismatch');
  }
  exactText(value.checkpointId, 'challenge checkpoint id', 180);
  timestamp(value.anchoredAt, 'challenge checkpoint anchoredAt');
  const ledgerRef = reference(value.ledgerRef, 'challenge checkpoint ledger reference');
  if (ledgerRef.schema !== Ledger.MANIFEST_SCHEMA) throw new Error('challenge checkpoint ledger schema mismatch');
  reference(value.sourceSnapshotRef, 'challenge checkpoint source snapshot reference');
  if (value.sourceSnapshotRef.schema !== SNAPSHOT_SCHEMA) throw new Error('challenge checkpoint snapshot schema mismatch');
  if (!Array.isArray(value.entries)) throw new Error('challenge checkpoint entries must be an array');
  const entries = value.entries.map(normalizeEntry).sort((left, right) => left.challengeDigest.localeCompare(right.challengeDigest));
  if (new Set(entries.map(entry => entry.challengeDigest)).size !== entries.length) throw new Error('challenge checkpoint entries must be unique');
  if (stableStringify(value.entries) !== stableStringify(entries)) throw new Error('challenge checkpoint entries must use canonical challenge-digest order');
  if (value.entryCount !== entries.length || value.entriesDigest !== sha256(entries)) throw new Error('challenge checkpoint entry summary mismatch');
  if (value.state !== 'CALLER_RETAINED_CHECKPOINT_FOR_FUTURE_COMPARISON_AUTHORITY_NOT_AUTHENTICATED') throw new Error('challenge checkpoint state mismatch');
  if (value.nextGate !== 'HOST_AUTHENTICATED_EXTERNALLY_RETAINED_CHECKPOINT_OR_PROTECTED_MONOTONIC_STORE') throw new Error('challenge checkpoint next gate mismatch');
  const expectedTruth = buildCheckpointTruth();
  if (stableStringify(value.truth) !== stableStringify(expectedTruth)) throw new Error('challenge checkpoint truth boundary mismatch');
  const expectedDigest = sha256(withoutField(value, 'checkpointDigest'));
  if (digest(value.checkpointDigest, 'challenge checkpoint digest') !== expectedDigest) throw new Error('challenge checkpoint digest mismatch');
  return clone(value);
}

function buildCheckpointTruth() {
  return {
    sourceSnapshotSelfDigestValid: true,
    sourceSnapshotOriginAuthenticated: false,
    checkpointTimeExternallyTrusted: false,
    futureStateComparable: true,
    checkpointWrittenByThisModule: false,
    checkpointExternalRetentionProven: false,
    checkpointAuthorityAuthenticated: false,
    preCheckpointHistoryProven: false,
    ledgerDeletionOrRollbackPrevented: false,
    globalSingleUseProven: false,
    hostAuthorizationAuthenticated: false,
    actualHumanParticipationProven: false,
    executionAuthorized: false,
    adoptionAuthorized: false,
    automaticWrite: false,
    automaticPromotion: false,
    automaticMerge: false,
    automaticCanon: false,
    foundationMutation: false
  };
}

function buildAudit(input) {
  exactKeys(input, ['auditId', 'checkedAt', 'priorCheckpoint', 'currentSnapshot'], 'challenge continuity audit input');
  const auditId = exactText(input.auditId, 'challenge continuity audit id', 180);
  const checkedAt = timestamp(input.checkedAt, 'challenge continuity checkedAt');
  const checkpoint = validateCheckpoint(input.priorCheckpoint);
  const current = validateSnapshot(input.currentSnapshot);
  if (Date.parse(checkedAt) < Date.parse(checkpoint.anchoredAt) || Date.parse(checkedAt) < Date.parse(current.observedAt)) {
    throw new Error('challenge continuity audit cannot predate its checkpoint or current observation');
  }
  const priorByChallenge = new Map(checkpoint.entries.map(entry => [entry.challengeDigest, entry]));
  const currentByChallenge = new Map(current.entries.map(entry => [entry.challengeDigest, entry]));
  const missing = [];
  const replaced = [];
  const added = [];
  let identityMatches = false;
  if (current.availability === 'ABSENT') {
    checkpoint.entries.forEach(prior => missing.push(prior.challengeDigest));
  } else if (current.availability === 'AVAILABLE') {
    identityMatches = current.manifestRef.id === checkpoint.ledgerRef.id &&
      current.manifestRef.schema === checkpoint.ledgerRef.schema &&
      current.manifestRef.sha256 === checkpoint.ledgerRef.sha256;
    if (identityMatches) {
      checkpoint.entries.forEach(prior => {
        const now = currentByChallenge.get(prior.challengeDigest);
        if (!now) missing.push(prior.challengeDigest);
        else if (now.consumptionReceiptDigest !== prior.consumptionReceiptDigest) {
          replaced.push({
            challengeDigest: prior.challengeDigest,
            checkpointReceiptDigest: prior.consumptionReceiptDigest,
            currentReceiptDigest: now.consumptionReceiptDigest
          });
        }
      });
      current.entries.forEach(now => {
        if (!priorByChallenge.has(now.challengeDigest)) added.push(now.challengeDigest);
      });
    }
  }

  let classification;
  let bestAction;
  if (current.availability === 'ABSENT') {
    classification = 'HOLD_LEDGER_STATE_ABSENT_AGAINST_PRESENTED_CHECKPOINT';
    bestAction = 'PRESERVE_CHECKPOINT_AND_REQUEST_PROTECTED_STATE_RECOVERY_REVIEW';
  } else if (current.availability === 'INVALID') {
    classification = 'HOLD_CURRENT_LEDGER_STATE_INVALID';
    bestAction = 'PRESERVE_CHECKPOINT_AND_REPAIR_OR_EXPLAIN_CURRENT_STATE';
  } else if (!identityMatches) {
    classification = 'HOLD_LEDGER_IDENTITY_CHANGED';
    bestAction = 'PRESERVE_BOTH_IDENTITIES_AND_REQUEST_STEWARD_RECONCILIATION';
  } else if (missing.length || replaced.length) {
    classification = 'ROLLBACK_OR_REPLACEMENT_DETECTED_AGAINST_PRESENTED_CHECKPOINT';
    bestAction = 'HOLD_NEW_CONSUMPTION_AND_REQUEST_PROTECTED_STATE_RECOVERY_REVIEW';
  } else if (added.length) {
    classification = 'CURRENT_LEDGER_EXTENDS_PRESENTED_CHECKPOINT';
    bestAction = 'RETAIN_A_NEW_CHECKPOINT_IF_AN_AUTHORIZED_HOST_CHOOSES';
  } else {
    classification = 'CURRENT_LEDGER_MATCHES_PRESENTED_CHECKPOINT';
    bestAction = 'NO_CONTINUITY_REPAIR_INDICATED_RELATIVE_TO_PRESENTED_CHECKPOINT';
  }
  const contradiction = classification.startsWith('HOLD_') || classification.startsWith('ROLLBACK_');
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
      ledgerRef: clone(checkpoint.ledgerRef),
      entryCount: checkpoint.entryCount,
      entriesDigest: checkpoint.entriesDigest
    },
    currentSnapshot: {
      id: current.observationId,
      schema: current.schema,
      sha256: current.snapshotDigest,
      availability: current.availability,
      ledgerRef: clone(current.manifestRef),
      entryCount: current.entryCount,
      entriesDigest: current.entriesDigest,
      errors: clone(current.errors)
    },
    comparison: {
      ledgerIdentityMatches: identityMatches,
      missingCheckpointChallenges: missing.sort(),
      replacedCheckpointEntries: replaced.sort((left, right) => left.challengeDigest.localeCompare(right.challengeDigest)),
      addedCurrentChallenges: added.sort()
    },
    decision: {
      classification,
      bestAction,
      reviewRequired: contradiction,
      autonomousActionCount: 0
    },
    nextGate: 'HOST_AUTHENTICATED_EXTERNALLY_RETAINED_CHECKPOINT_OR_PROTECTED_MONOTONIC_STORE',
    truth: {
      priorCheckpointSelfDigestValid: true,
      currentSnapshotSelfDigestValid: true,
      currentSnapshotOriginAuthenticated: false,
      auditTimeExternallyTrusted: false,
      comparisonBoundToExactLedgerIdentity: identityMatches,
      rollbackOrReplacementDetectedAgainstPresentedCheckpoint: classification === 'ROLLBACK_OR_REPLACEMENT_DETECTED_AGAINST_PRESENTED_CHECKPOINT',
      currentAbsenceDetectedAgainstPresentedCheckpoint: current.availability === 'ABSENT',
      currentInvalidityDetected: current.availability === 'INVALID',
      presentedCheckpointProvesExternalRetention: false,
      checkpointAuthorityAuthenticated: false,
      preCheckpointHistoryProven: false,
      ledgerDeletionOrRollbackPrevented: false,
      globalSingleUseProven: false,
      hostAuthorizationAuthenticated: false,
      actualHumanParticipationProven: false,
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
    },
    auditDigest: null
  };
  audit.auditDigest = sha256(withoutField(audit, 'auditDigest'));
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
  ENTRY_FILE,
  clone,
  stableStringify,
  sha256,
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
