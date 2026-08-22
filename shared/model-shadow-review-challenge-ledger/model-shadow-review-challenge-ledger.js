#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const SignedReview = require('../model-shadow-signed-review-evidence/model-shadow-signed-review-evidence');

const RECEIPT_SCHEMA = 'axm.model-shadow-review-challenge-consumption/v1';
const MANIFEST_SCHEMA = 'axm.model-shadow-review-challenge-ledger-manifest/v1';
const VERSION = '0.2.0';
const STATUS = 'TEST';
const CONFIRMATION = 'CONSUME SIGNED REVIEW CHALLENGE ONCE';
const AUTHORITY_ORIGIN = 'CALLER_STATE_ROOT_UNAUTHENTICATED';
const STORAGE_MODE = 'APPEND_ONLY_EXCLUSIVE_CREATE';
const NAMESPACE = 'model-shadow-review-challenge-ledger';
const ENTRIES_DIRECTORY = 'entries';
const MANIFEST_FILE = 'ledger.json';
const DIGEST = /^sha256:[a-f0-9]{64}$/;

class ChallengeLedgerError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'ChallengeLedgerError';
    this.code = code;
  }
}

function copy(value) {
  return JSON.parse(SignedReview.stableStringify(value));
}

function exactKeys(value, allowed, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ChallengeLedgerError('INVALID_INPUT', label + ' must be an object');
  }
  const extras = Object.keys(value).filter(key => !allowed.includes(key));
  const missing = allowed.filter(key => !Object.prototype.hasOwnProperty.call(value, key));
  if (extras.length) throw new ChallengeLedgerError('INVALID_INPUT', label + ' has unknown fields: ' + extras.sort().join(', '));
  if (missing.length) throw new ChallengeLedgerError('INVALID_INPUT', label + ' is missing fields: ' + missing.sort().join(', '));
}

function exactText(value, label, maximum) {
  if (typeof value !== 'string' || !value || value !== value.trim()) {
    throw new ChallengeLedgerError('INVALID_INPUT', label + ' must be exact non-empty text');
  }
  if (maximum && value.length > maximum) {
    throw new ChallengeLedgerError('INVALID_INPUT', label + ' is too long');
  }
  return value;
}

function digest(value, label) {
  const result = exactText(value, label, 71);
  if (!DIGEST.test(result)) {
    throw new ChallengeLedgerError('INVALID_INPUT', label + ' must be an exact SHA-256 digest');
  }
  return result;
}

function timestamp(value, label) {
  const result = exactText(value, label, 64);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?Z$/.test(result) || Number.isNaN(Date.parse(result))) {
    throw new ChallengeLedgerError('INVALID_INPUT', label + ' must be an exact UTC timestamp');
  }
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

function withoutDigest(receipt) {
  const payload = copy(receipt);
  delete payload.receiptDigest;
  return payload;
}

function receiptDigest(receipt) {
  return SignedReview.sha256(withoutDigest(receipt));
}

function receiptTruth() {
  return {
    signedReviewReceiptVerifiedByExactRebuild: true,
    exactProposalPlanReviewAndChallengeBound: true,
    ledgerManifestVerified: true,
    stateWritePerformed: true,
    writeRequiredExplicitConfirmation: true,
    exclusiveEntryCreateWon: true,
    entryFileFsyncCompleted: true,
    challengeReplayRefusedWhileLedgerStatePreserved: true,
    ledgerDeletionOrRollbackResistanceProven: false,
    challengeGloballySingleUseProven: false,
    ledgerAuthorityAuthenticated: false,
    callerPolicyAuthorityAuthenticated: false,
    hostAuthorizationAuthenticated: false,
    actorRealWorldIdentityProven: false,
    actualHumanParticipationProven: false,
    verificationTimeExternallyTrusted: false,
    consumptionTimeExternallyTrusted: false,
    durabilityBeyondReportedFileFsyncProven: false,
    rawActorIdentityEmbedded: false,
    reviewDiscussionIngested: false,
    voteNotesIngested: false,
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
    sharedGrowthClaimed: false,
    broadLearningClaimed: false,
    automaticExecution: false,
    automaticInstall: false,
    automaticPermissionGrant: false,
    automaticPromotion: false,
    automaticMerge: false,
    automaticCanon: false,
    foundationMutation: false
  };
}

function buildManifest(ledgerId) {
  ledgerId = exactText(ledgerId, 'challenge ledger id', 180);
  const manifest = {
    schema: MANIFEST_SCHEMA,
    version: VERSION,
    status: STATUS,
    ledgerId,
    authorityOrigin: AUTHORITY_ORIGIN,
    storageMode: STORAGE_MODE,
    manifestDigest: null
  };
  const payload = copy(manifest);
  delete payload.manifestDigest;
  manifest.manifestDigest = SignedReview.sha256(payload);
  return manifest;
}

function buildReceipt(input, ledgerId) {
  ledgerId = exactText(ledgerId, 'challenge ledger id', 180);
  exactKeys(input, [
    'consumptionId', 'consumedAt', 'confirmation',
    'signedReviewInput', 'signedReviewReceipt'
  ], 'challenge consumption input');
  const consumptionId = exactText(input.consumptionId, 'challenge consumption id', 180);
  const consumedAt = timestamp(input.consumedAt, 'challenge consumption time');
  if (input.confirmation !== CONFIRMATION) {
    throw new ChallengeLedgerError('CONFIRMATION_REQUIRED', 'exact challenge consumption confirmation is required');
  }

  const signedCheck = SignedReview.verifyReceipt(
    copy(input.signedReviewInput),
    copy(input.signedReviewReceipt)
  );
  if (!signedCheck.pass) {
    throw new ChallengeLedgerError(
      'SIGNED_REVIEW_INVALID',
      'signed review receipt is invalid: ' + signedCheck.errors.join('; ')
    );
  }
  const signedReceipt = signedCheck.rebuilt;
  if (signedReceipt.truth.challengeSingleUseProven !== false || signedReceipt.truth.executionAuthorized !== false) {
    throw new ChallengeLedgerError('UPSTREAM_AUTHORITY_MISMATCH', 'signed review receipt authority boundary mismatch');
  }
  if (Date.parse(consumedAt) < Date.parse(signedReceipt.verifiedAt)) {
    throw new ChallengeLedgerError('INVALID_INPUT', 'challenge consumption cannot predate signed review verification');
  }

  const receipt = {
    schema: RECEIPT_SCHEMA,
    version: VERSION,
    consumptionId,
    consumedAt,
    status: STATUS,
    ledger: {
      ledgerId,
      authorityOrigin: AUTHORITY_ORIGIN,
      storageMode: STORAGE_MODE
    },
    signedReviewReceiptRef: {
      id: signedReceipt.receiptId,
      schema: signedReceipt.schema,
      sha256: signedReceipt.receiptDigest
    },
    reviewedHandoffRef: copy(signedReceipt.reviewedHandoffRef),
    proposalRef: copy(signedReceipt.proposalRef),
    planRef: copy(signedReceipt.planRef),
    reviewEvidenceRef: copy(signedReceipt.reviewEvidenceRef),
    keyPolicyRef: copy(signedReceipt.keyPolicyRef),
    challengeRef: copy(signedReceipt.challengeRef),
    state: 'CHALLENGE_REPLAY_REFUSED_WHILE_CALLER_LEDGER_STATE_IS_PRESERVED_EXECUTION_NOT_AUTHORIZED',
    nextGate: 'HOST_TRUST_ANCHOR_AND_PROTECTED_LEDGER_STATE_THEN_SEPARATE_EXECUTION_DECISION',
    truth: receiptTruth(),
    receiptDigest: null
  };
  receipt.receiptDigest = receiptDigest(receipt);
  return receipt;
}

function validateStoredReceipt(value, expectedChallengeDigest, expectedLedgerId) {
  try {
    expectedLedgerId = exactText(expectedLedgerId, 'expected challenge ledger id', 180);
    const receipt = copy(value);
    exactKeys(receipt, [
      'schema', 'version', 'consumptionId', 'consumedAt', 'status', 'ledger',
      'signedReviewReceiptRef', 'reviewedHandoffRef', 'proposalRef', 'planRef',
      'reviewEvidenceRef', 'keyPolicyRef', 'challengeRef', 'state', 'nextGate',
      'truth', 'receiptDigest'
    ], 'stored challenge consumption receipt');
    if (receipt.schema !== RECEIPT_SCHEMA || receipt.version !== VERSION || receipt.status !== STATUS) {
      throw new Error('stored receipt identity mismatch');
    }
    exactText(receipt.consumptionId, 'stored consumption id', 180);
    timestamp(receipt.consumedAt, 'stored consumption time');
    exactKeys(receipt.ledger, ['ledgerId', 'authorityOrigin', 'storageMode'], 'stored receipt ledger');
    exactText(receipt.ledger.ledgerId, 'stored ledger id', 180);
    if (receipt.ledger.authorityOrigin !== AUTHORITY_ORIGIN || receipt.ledger.storageMode !== STORAGE_MODE) {
      throw new Error('stored receipt ledger boundary mismatch');
    }
    if (receipt.ledger.ledgerId !== expectedLedgerId) throw new Error('stored receipt ledger id mismatch');
    reference(receipt.signedReviewReceiptRef, 'stored signed review receipt reference');
    reference(receipt.reviewedHandoffRef, 'stored reviewed handoff reference');
    reference(receipt.proposalRef, 'stored proposal reference');
    reference(receipt.planRef, 'stored plan reference');
    reference(receipt.reviewEvidenceRef, 'stored review evidence reference');
    reference(receipt.keyPolicyRef, 'stored key policy reference');
    const challengeRef = reference(receipt.challengeRef, 'stored challenge reference');
    if (challengeRef.sha256 !== expectedChallengeDigest) throw new Error('stored challenge digest mismatch');
    if (receipt.state !== 'CHALLENGE_REPLAY_REFUSED_WHILE_CALLER_LEDGER_STATE_IS_PRESERVED_EXECUTION_NOT_AUTHORIZED') {
      throw new Error('stored receipt state mismatch');
    }
    if (receipt.nextGate !== 'HOST_TRUST_ANCHOR_AND_PROTECTED_LEDGER_STATE_THEN_SEPARATE_EXECUTION_DECISION') {
      throw new Error('stored receipt next gate mismatch');
    }
    if (SignedReview.stableStringify(receipt.truth) !== SignedReview.stableStringify(receiptTruth())) {
      throw new Error('stored receipt truth boundary mismatch');
    }
    const expected = receiptDigest(receipt);
    if (digest(receipt.receiptDigest, 'stored receipt digest') !== expected) {
      throw new Error('stored receipt digest mismatch');
    }
    return receipt;
  } catch (error) {
    if (error instanceof ChallengeLedgerError && error.code === 'CHALLENGE_ENTRY_CORRUPT') throw error;
    throw new ChallengeLedgerError(
      'CHALLENGE_ENTRY_CORRUPT',
      'existing challenge entry is corrupt or boundary-invalid; fail-closed steward repair is required: ' + error.message
    );
  }
}

function assertDirectoryNotLink(directoryPath, label) {
  let stat;
  try {
    stat = fs.lstatSync(directoryPath);
  } catch (error) {
    throw new ChallengeLedgerError('STATE_ROOT_INVALID', label + ' cannot be inspected: ' + error.message);
  }
  if (!stat.isDirectory() || stat.isSymbolicLink()) {
    throw new ChallengeLedgerError('STATE_ROOT_INVALID', label + ' must be a real directory and not a symbolic link or junction');
  }
}

function createFixedDirectory(directoryPath, label) {
  try {
    fs.mkdirSync(directoryPath);
  } catch (error) {
    if (error.code !== 'EEXIST') {
      throw new ChallengeLedgerError('STATE_ROOT_INVALID', label + ' cannot be created: ' + error.message);
    }
  }
  assertDirectoryNotLink(directoryPath, label);
}

function resolveLedgerPaths(stateRoot) {
  const root = path.resolve(exactText(stateRoot, 'challenge ledger stateRoot', 32767));
  if (root === path.parse(root).root) {
    throw new ChallengeLedgerError('STATE_ROOT_INVALID', 'filesystem root cannot be a challenge ledger stateRoot');
  }
  assertDirectoryNotLink(root, 'challenge ledger stateRoot');
  return {
    root,
    namespace: path.join(root, NAMESPACE),
    entries: path.join(root, NAMESPACE, ENTRIES_DIRECTORY)
  };
}

function validateManifest(value, expectedLedgerId) {
  try {
    const manifest = copy(value);
    exactKeys(manifest, [
      'schema', 'version', 'status', 'ledgerId', 'authorityOrigin',
      'storageMode', 'manifestDigest'
    ], 'challenge ledger manifest');
    if (manifest.schema !== MANIFEST_SCHEMA || manifest.version !== VERSION || manifest.status !== STATUS) {
      throw new Error('challenge ledger manifest identity mismatch');
    }
    exactText(manifest.ledgerId, 'challenge ledger manifest id', 180);
    if (manifest.authorityOrigin !== AUTHORITY_ORIGIN || manifest.storageMode !== STORAGE_MODE) {
      throw new Error('challenge ledger manifest boundary mismatch');
    }
    const expected = buildManifest(manifest.ledgerId);
    if (manifest.manifestDigest !== expected.manifestDigest) throw new Error('challenge ledger manifest digest mismatch');
    if (manifest.ledgerId !== expectedLedgerId) {
      throw new ChallengeLedgerError('LEDGER_ID_MISMATCH', 'caller state root is already bound to a different ledger id');
    }
    return manifest;
  } catch (error) {
    if (error instanceof ChallengeLedgerError && error.code === 'LEDGER_ID_MISMATCH') throw error;
    throw new ChallengeLedgerError(
      'LEDGER_MANIFEST_CORRUPT',
      'challenge ledger manifest is corrupt or boundary-invalid; fail-closed steward repair is required: ' + error.message
    );
  }
}

function readManifest(manifestPath, expectedLedgerId) {
  let stat;
  try {
    stat = fs.lstatSync(manifestPath);
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw new ChallengeLedgerError('LEDGER_MANIFEST_CORRUPT', 'challenge ledger manifest cannot be inspected: ' + error.message);
  }
  if (!stat.isFile() || stat.isSymbolicLink()) {
    throw new ChallengeLedgerError('LEDGER_MANIFEST_CORRUPT', 'challenge ledger manifest must be a regular file and not a symbolic link');
  }
  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  } catch (error) {
    throw new ChallengeLedgerError('LEDGER_MANIFEST_CORRUPT', 'challenge ledger manifest is unreadable or invalid JSON; fail-closed steward repair is required');
  }
  return validateManifest(parsed, expectedLedgerId);
}

function ensureManifest(paths, ledgerId) {
  const manifestPath = path.join(paths.namespace, MANIFEST_FILE);
  const existing = readManifest(manifestPath, ledgerId);
  if (existing) return existing;
  let namespaceItems;
  try {
    namespaceItems = fs.readdirSync(paths.namespace);
  } catch (error) {
    throw new ChallengeLedgerError('LEDGER_MANIFEST_CORRUPT', 'challenge ledger namespace cannot be inspected: ' + error.message);
  }
  if (namespaceItems.length) {
    const racedManifest = readManifest(manifestPath, ledgerId);
    if (racedManifest) return racedManifest;
    throw new ChallengeLedgerError(
      'LEDGER_MANIFEST_MISSING',
      'non-empty challenge ledger namespace has no manifest; fail-closed steward repair is required'
    );
  }
  const manifest = buildManifest(ledgerId);
  let descriptor;
  try {
    descriptor = fs.openSync(manifestPath, 'wx', 0o600);
  } catch (error) {
    if (error.code === 'EEXIST') return readManifest(manifestPath, ledgerId);
    throw new ChallengeLedgerError('LEDGER_MANIFEST_WRITE_FAILED', 'exclusive ledger manifest create failed: ' + error.message);
  }
  let writeError = null;
  try {
    fs.writeFileSync(descriptor, SignedReview.stableStringify(manifest) + '\n', { encoding: 'utf8' });
    fs.fsyncSync(descriptor);
  } catch (error) {
    writeError = error;
  } finally {
    try { fs.closeSync(descriptor); } catch (error) { if (!writeError) writeError = error; }
  }
  if (writeError) {
    throw new ChallengeLedgerError(
      'LEDGER_MANIFEST_DURABILITY_UNCERTAIN',
      'ledger manifest write or file fsync did not complete; fail-closed state was retained for steward inspection: ' + writeError.message
    );
  }
  return manifest;
}

function prepareLedgerDirectories(paths, ledgerId) {
  createFixedDirectory(paths.namespace, 'challenge ledger namespace');
  ensureManifest(paths, ledgerId);
  createFixedDirectory(paths.entries, 'challenge ledger entries directory');
}

function entryPathFor(paths, challengeDigest) {
  return path.join(paths.entries, digest(challengeDigest, 'challenge digest').slice('sha256:'.length) + '.json');
}

function readStoredEntry(entryPath, expectedChallengeDigest, expectedLedgerId) {
  let stat;
  try {
    stat = fs.lstatSync(entryPath);
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw new ChallengeLedgerError('CHALLENGE_ENTRY_CORRUPT', 'challenge entry cannot be inspected: ' + error.message);
  }
  if (!stat.isFile() || stat.isSymbolicLink()) {
    throw new ChallengeLedgerError('CHALLENGE_ENTRY_CORRUPT', 'challenge entry must be a regular file and not a symbolic link');
  }
  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(entryPath, 'utf8'));
  } catch (error) {
    throw new ChallengeLedgerError('CHALLENGE_ENTRY_CORRUPT', 'challenge entry is unreadable or invalid JSON; fail-closed steward repair is required');
  }
  return validateStoredReceipt(parsed, expectedChallengeDigest, expectedLedgerId);
}

function verifyReceipt(input, ledgerId, receipt) {
  const errors = [];
  let rebuilt = null;
  try {
    rebuilt = buildReceipt(input, exactText(ledgerId, 'challenge ledger id', 180));
  } catch (error) {
    errors.push(error.message);
  }
  if (rebuilt && SignedReview.stableStringify(rebuilt) !== SignedReview.stableStringify(receipt)) {
    errors.push('challenge consumption receipt content or digest mismatch');
  }
  return { pass: errors.length === 0, errors, rebuilt };
}

function createService(options) {
  exactKeys(options, ['stateRoot', 'ledgerId'], 'challenge ledger service options');
  const paths = resolveLedgerPaths(options.stateRoot);
  const ledgerId = exactText(options.ledgerId, 'challenge ledger id', 180);

  function consume(input) {
    const receipt = buildReceipt(input, ledgerId);
    const challengeDigest = receipt.challengeRef.sha256;
    prepareLedgerDirectories(paths, ledgerId);
    const entryPath = entryPathFor(paths, challengeDigest);
    let descriptor;
    try {
      descriptor = fs.openSync(entryPath, 'wx', 0o600);
    } catch (error) {
      if (error.code === 'EEXIST') {
        const existing = readStoredEntry(entryPath, challengeDigest, ledgerId);
        if (!existing) {
          throw new ChallengeLedgerError('CHALLENGE_ENTRY_CORRUPT', 'challenge entry disappeared during replay inspection');
        }
        throw new ChallengeLedgerError(
          'CHALLENGE_ALREADY_CONSUMED',
          'challenge was already consumed in this caller-scoped ledger by receipt ' + existing.receiptDigest
        );
      }
      throw new ChallengeLedgerError('CHALLENGE_WRITE_FAILED', 'exclusive challenge entry create failed: ' + error.message);
    }

    let writeError = null;
    try {
      fs.writeFileSync(descriptor, SignedReview.stableStringify(receipt) + '\n', { encoding: 'utf8' });
      fs.fsyncSync(descriptor);
    } catch (error) {
      writeError = error;
    } finally {
      try { fs.closeSync(descriptor); } catch (error) { if (!writeError) writeError = error; }
    }
    if (writeError) {
      throw new ChallengeLedgerError(
        'CHALLENGE_DURABILITY_UNCERTAIN',
        'challenge entry write or file fsync did not complete; the fail-closed entry was retained for steward inspection: ' + writeError.message
      );
    }
    return receipt;
  }

  function inspect(challengeDigest) {
    const target = digest(challengeDigest, 'challenge digest');
    if (!fs.existsSync(paths.namespace)) return null;
    assertDirectoryNotLink(paths.namespace, 'challenge ledger namespace');
    const manifest = readManifest(path.join(paths.namespace, MANIFEST_FILE), ledgerId);
    if (!manifest) {
      const namespaceItems = fs.readdirSync(paths.namespace);
      if (namespaceItems.length) {
        throw new ChallengeLedgerError(
          'LEDGER_MANIFEST_MISSING',
          'non-empty challenge ledger namespace has no manifest; fail-closed steward repair is required'
        );
      }
      return null;
    }
    const entryPath = entryPathFor(paths, target);
    return readStoredEntry(entryPath, target, ledgerId);
  }

  function verifyPersisted(input, receipt) {
    const detached = verifyReceipt(input, ledgerId, receipt);
    if (!detached.pass) return detached;
    let stored = null;
    try {
      stored = inspect(detached.rebuilt.challengeRef.sha256);
      if (!stored) throw new Error('challenge entry is absent');
      if (SignedReview.stableStringify(stored) !== SignedReview.stableStringify(detached.rebuilt)) {
        throw new Error('persisted challenge entry does not match the exact rebuilt receipt');
      }
    } catch (error) {
      return { pass: false, errors: detached.errors.concat(error.message), rebuilt: detached.rebuilt, stored };
    }
    return { pass: true, errors: [], rebuilt: detached.rebuilt, stored };
  }

  return Object.freeze({
    ledgerId,
    consume,
    inspect,
    verifyPersisted
  });
}

module.exports = {
  RECEIPT_SCHEMA,
  MANIFEST_SCHEMA,
  VERSION,
  STATUS,
  CONFIRMATION,
  AUTHORITY_ORIGIN,
  STORAGE_MODE,
  NAMESPACE,
  ENTRIES_DIRECTORY,
  MANIFEST_FILE,
  ChallengeLedgerError,
  buildReceipt,
  buildManifest,
  verifyReceipt,
  validateStoredReceipt,
  createService
};
