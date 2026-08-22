#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const TransitionGate = require('../model-shadow-review-challenge-transition-gate/model-shadow-review-challenge-transition-gate');

const ENTRY_SCHEMA = 'axm.model-shadow-review-challenge-transition-ledger-entry/v1';
const MANIFEST_SCHEMA = 'axm.model-shadow-review-challenge-transition-ledger-manifest/v1';
const SNAPSHOT_SCHEMA = 'axm.model-shadow-review-challenge-transition-ledger-snapshot/v1';
const VERSION = '0.8.0';
const STATUS = 'TEST';
const CONFIRMATION = 'ADVANCE CALLER-OWNED TRANSITION HEAD ONCE';
const AUTHORITY_ORIGIN = 'CALLER_STATE_ROOT_UNAUTHENTICATED';
const STORAGE_MODE = 'SEQUENCE_ENTRY_EXCLUSIVE_CREATE_LOCAL_HEAD_DERIVED_FROM_VALIDATED_CHAIN';
const NAMESPACE = 'model-shadow-review-challenge-transition-ledger';
const ENTRIES_DIRECTORY = 'entries';
const MANIFEST_FILE = 'ledger.json';
const NEXT_GATE = 'HOST_AUTHENTICATED_EXTERNALLY_RETAINED_GLOBALLY_CONSISTENT_TRANSITION_LOG_OR_PROTECTED_MONOTONIC_STORE';
const DIGEST = /^sha256:[a-f0-9]{64}$/;
const ENTRY_FILE = /^([0-9]{12})\.json$/;

class TransitionLedgerError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'TransitionLedgerError';
    this.code = code;
  }
}

function stableStringify(value) {
  return TransitionGate.stableStringify(value);
}

function copy(value) {
  return JSON.parse(stableStringify(value));
}

function sha256(value) {
  return TransitionGate.sha256(value);
}

function exactKeys(value, allowed, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TransitionLedgerError('INVALID_INPUT', label + ' must be an object');
  }
  const extras = Object.keys(value).filter(key => !allowed.includes(key));
  const missing = allowed.filter(key => !Object.prototype.hasOwnProperty.call(value, key));
  if (extras.length) throw new TransitionLedgerError('INVALID_INPUT', label + ' has unknown fields: ' + extras.sort().join(', '));
  if (missing.length) throw new TransitionLedgerError('INVALID_INPUT', label + ' is missing fields: ' + missing.sort().join(', '));
}

function exactText(value, label, maximum) {
  if (typeof value !== 'string' || !value || value !== value.trim()) {
    throw new TransitionLedgerError('INVALID_INPUT', label + ' must be exact non-empty text');
  }
  if (maximum && value.length > maximum) throw new TransitionLedgerError('INVALID_INPUT', label + ' is too long');
  return value;
}

function digest(value, label) {
  const result = exactText(value, label, 71);
  if (!DIGEST.test(result)) throw new TransitionLedgerError('INVALID_INPUT', label + ' must be an exact SHA-256 digest');
  return result;
}

function timestamp(value, label) {
  const result = exactText(value, label, 64);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?Z$/.test(result) || Number.isNaN(Date.parse(result))) {
    throw new TransitionLedgerError('INVALID_INPUT', label + ' must be an exact UTC timestamp');
  }
  return result;
}

function positiveInteger(value, label) {
  if (!Number.isSafeInteger(value) || value < 1) throw new TransitionLedgerError('INVALID_INPUT', label + ' must be a positive safe integer');
  return value;
}

function reference(value, label) {
  exactKeys(value, ['id', 'schema', 'sha256'], label);
  return {
    id: exactText(value.id, label + '.id', 180),
    schema: exactText(value.schema, label + '.schema', 180),
    sha256: digest(value.sha256, label + '.sha256')
  };
}

function sameReference(left, right) {
  return left.id === right.id && left.schema === right.schema && left.sha256 === right.sha256;
}

function withoutField(value, field) {
  const payload = copy(value);
  delete payload[field];
  return payload;
}

function manifestDigest(manifest) {
  return sha256(withoutField(manifest, 'manifestDigest'));
}

function entryDigest(entry) {
  return sha256(withoutField(entry, 'entryDigest'));
}

function snapshotDigest(snapshot) {
  return sha256(withoutField(snapshot, 'snapshotDigest'));
}

function manifestRef(manifest) {
  return { id: manifest.logId, schema: manifest.schema, sha256: manifest.manifestDigest };
}

function entryRef(entry) {
  return { id: entry.entryId, schema: entry.schema, sha256: entry.entryDigest };
}

function entryTruth() {
  return {
    transitionReceiptVerifiedByExactRebuildBeforeWrite: true,
    forwardPairwiseExtensionRequired: true,
    manifestVerified: true,
    exactLocalHeadMatchedBeforeWrite: true,
    stateWritePerformed: true,
    writeRequiredExplicitConfirmation: true,
    exclusiveSequenceEntryCreateWon: true,
    entryFileFsyncCompleted: true,
    localHeadAdvancedWhileCallerStateIsPreserved: true,
    persistedUpstreamTransitionInput: false,
    upstreamTransitionReverifiedAfterReloadWithoutCallerPackage: false,
    callerPresentedPackageRequiredForPersistedExactRebuild: true,
    independentStateRootsExcluded: false,
    withheldForksExcluded: false,
    unpresentedBranchesExcluded: false,
    globalTransitionUniquenessProven: false,
    globallyConsistentTransitionLogProven: false,
    externalTransitionRetentionProven: false,
    protectedMonotonicStateProven: false,
    deletionOrRollbackPrevented: false,
    ledgerAuthorityAuthenticated: false,
    hostAuthorizationAuthenticated: false,
    actorRealWorldIdentityProven: false,
    actualHumanParticipationProven: false,
    comparisonTimeExternallyTrusted: false,
    recordingTimeExternallyTrusted: false,
    durabilityBeyondReportedFileFsyncProven: false,
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

function snapshotTruth() {
  return {
    manifestVerified: true,
    localEntrySequenceValidated: true,
    localDigestChainValidated: true,
    localHeadDerivedFromValidatedEntries: true,
    upstreamTransitionsReverifiedWithoutCallerPackages: false,
    independentStateRootsExcluded: false,
    globallyConsistentTransitionLogProven: false,
    externalTransitionRetentionProven: false,
    protectedMonotonicStateProven: false,
    deletionOrRollbackPrevented: false,
    hostAuthorizationAuthenticated: false,
    executionAuthorized: false,
    adoptionAuthorized: false,
    automaticPromotion: false,
    automaticCanon: false
  };
}

function storedForwardTransitionTruth() {
  return {
    previousSeparatedChainVerifiedByExactRebuild: true,
    candidateSeparatedChainVerifiedByExactRebuild: true,
    pairwiseComparisonOnly: true,
    pairwiseLedgerIdentityMatches: true,
    pairwiseAnchorIdentityMatches: true,
    exactPresentedReplayObserved: false,
    forwardExtensionObserved: true,
    pairwiseConflictOrContradictionDetected: false,
    priorEntryRemovalOrReplacementDetected: false,
    anchorEpochSelfDeclared: true,
    anchorEpochRollbackObserved: false,
    sameEpochAnchorEquivocationObserved: false,
    checkpointIdEquivocationObserved: false,
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

function buildManifest(logId, genesisSeparatedWitnessRef) {
  const manifest = {
    schema: MANIFEST_SCHEMA,
    version: VERSION,
    status: STATUS,
    logId: exactText(logId, 'transition ledger log id', 180),
    genesisSeparatedWitnessRef: reference(genesisSeparatedWitnessRef, 'genesis separated witness reference'),
    authorityOrigin: AUTHORITY_ORIGIN,
    storageMode: STORAGE_MODE,
    manifestDigest: null
  };
  manifest.manifestDigest = manifestDigest(manifest);
  return manifest;
}

function validateAdvanceInput(input) {
  exactKeys(input, ['entryId', 'recordedAt', 'confirmation', 'transitionInput', 'transitionReceipt'], 'transition ledger advance input');
  const entryId = exactText(input.entryId, 'transition ledger entry id', 180);
  const recordedAt = timestamp(input.recordedAt, 'transition ledger recording time');
  if (input.confirmation !== CONFIRMATION) {
    throw new TransitionLedgerError('CONFIRMATION_REQUIRED', 'exact transition ledger advance confirmation is required');
  }
  const check = TransitionGate.verifyTransition(copy(input.transitionInput), copy(input.transitionReceipt));
  if (!check.pass) {
    throw new TransitionLedgerError('TRANSITION_INVALID', 'pairwise transition receipt is invalid: ' + check.errors.join('; '));
  }
  const transition = check.rebuilt;
  if (transition.decision.classification !== 'CANDIDATE_EXTENDS_PRESENTED_CHAIN' ||
      transition.decision.forwardTransitionAdmissible !== true ||
      transition.decision.reviewRequired !== false) {
    throw new TransitionLedgerError('TRANSITION_NOT_FORWARD_EXTENSION', 'only an exact pairwise forward extension may advance the local transition head');
  }
  if (transition.truth.globalTransitionUniquenessProven !== false ||
      transition.truth.globallyConsistentTransitionLogProven !== false ||
      transition.truth.executionAuthorized !== false ||
      transition.truth.adoptionAuthorized !== false) {
    throw new TransitionLedgerError('UPSTREAM_AUTHORITY_MISMATCH', 'pairwise transition authority boundary mismatch');
  }
  if (Date.parse(recordedAt) < Date.parse(transition.comparedAt)) {
    throw new TransitionLedgerError('INVALID_INPUT', 'transition recording cannot predate pairwise comparison');
  }
  return { entryId, recordedAt, transition };
}

function buildEntry(input, context) {
  const validated = validateAdvanceInput(input);
  exactKeys(context, ['manifest', 'sequence', 'previousEntryRef'], 'transition ledger entry context');
  const manifest = validateManifest(copy(context.manifest), context.manifest.logId, context.manifest.genesisSeparatedWitnessRef);
  const sequence = positiveInteger(context.sequence, 'transition ledger sequence');
  const previousEntryRef = context.previousEntryRef === null ? null : reference(context.previousEntryRef, 'previous transition ledger entry reference');
  const receipt = {
    schema: ENTRY_SCHEMA,
    version: VERSION,
    entryId: validated.entryId,
    recordedAt: validated.recordedAt,
    status: STATUS,
    log: {
      logId: manifest.logId,
      authorityOrigin: AUTHORITY_ORIGIN,
      storageMode: STORAGE_MODE,
      sequence
    },
    manifestRef: manifestRef(manifest),
    previousEntryRef,
    transitionReceipt: copy(validated.transition),
    previousSeparatedWitnessRef: copy(validated.transition.previousSeparatedWitnessRef),
    candidateSeparatedWitnessRef: copy(validated.transition.candidateSeparatedWitnessRef),
    state: 'LOCAL_CALLER_OWNED_TRANSITION_HEAD_ADVANCED_WHILE_STATE_IS_PRESERVED_NO_GLOBAL_CONSISTENCY_OR_EXECUTION_AUTHORITY',
    nextGate: NEXT_GATE,
    truth: entryTruth(),
    entryDigest: null
  };
  receipt.entryDigest = entryDigest(receipt);
  return receipt;
}

function validateManifest(value, expectedLogId, expectedGenesisRef) {
  try {
    const manifest = copy(value);
    exactKeys(manifest, ['schema', 'version', 'status', 'logId', 'genesisSeparatedWitnessRef', 'authorityOrigin', 'storageMode', 'manifestDigest'], 'transition ledger manifest');
    if (manifest.schema !== MANIFEST_SCHEMA || manifest.version !== VERSION || manifest.status !== STATUS) throw new Error('transition ledger manifest identity mismatch');
    exactText(manifest.logId, 'stored transition ledger log id', 180);
    const genesis = reference(manifest.genesisSeparatedWitnessRef, 'stored genesis separated witness reference');
    if (manifest.authorityOrigin !== AUTHORITY_ORIGIN || manifest.storageMode !== STORAGE_MODE) throw new Error('transition ledger manifest boundary mismatch');
    if (digest(manifest.manifestDigest, 'stored transition ledger manifest digest') !== manifestDigest(manifest)) throw new Error('transition ledger manifest digest mismatch');
    if (manifest.logId !== exactText(expectedLogId, 'expected transition ledger log id', 180)) {
      throw new TransitionLedgerError('LOG_ID_MISMATCH', 'caller state root is already bound to a different transition log id');
    }
    if (!sameReference(genesis, reference(expectedGenesisRef, 'expected genesis separated witness reference'))) {
      throw new TransitionLedgerError('GENESIS_MISMATCH', 'caller state root is already bound to a different genesis separated witness');
    }
    return manifest;
  } catch (error) {
    if (error instanceof TransitionLedgerError && (error.code === 'LOG_ID_MISMATCH' || error.code === 'GENESIS_MISMATCH')) throw error;
    throw new TransitionLedgerError('TRANSITION_LEDGER_MANIFEST_CORRUPT', 'transition ledger manifest is corrupt or boundary-invalid; fail-closed steward repair is required: ' + error.message);
  }
}

function validateStoredTransition(value) {
  const transition = copy(value);
  exactKeys(transition, [
    'schema', 'version', 'transitionId', 'comparedAt', 'status',
    'previousSeparatedWitnessRef', 'candidateSeparatedWitnessRef',
    'anchorTransition', 'ledgerRef', 'previousCheckpointRef', 'candidateCheckpointRef',
    'comparison', 'decision', 'state', 'nextGate', 'truth', 'receiptDigest'
  ], 'stored pairwise transition receipt');
  if (transition.schema !== TransitionGate.RECEIPT_SCHEMA || transition.version !== TransitionGate.VERSION || transition.status !== STATUS) throw new Error('stored transition receipt identity mismatch');
  exactText(transition.transitionId, 'stored transition id', 180);
  timestamp(transition.comparedAt, 'stored transition comparison time');
  reference(transition.previousSeparatedWitnessRef, 'stored transition previous separated witness reference');
  reference(transition.candidateSeparatedWitnessRef, 'stored transition candidate separated witness reference');
  exactKeys(transition.anchorTransition, ['anchorId', 'previousAnchorDigest', 'candidateAnchorDigest', 'previousSelfDeclaredEpoch', 'candidateSelfDeclaredEpoch', 'relation'], 'stored transition anchor relation');
  exactText(transition.anchorTransition.anchorId, 'stored transition anchor id', 180);
  digest(transition.anchorTransition.previousAnchorDigest, 'stored previous anchor digest');
  digest(transition.anchorTransition.candidateAnchorDigest, 'stored candidate anchor digest');
  positiveInteger(transition.anchorTransition.previousSelfDeclaredEpoch, 'stored previous anchor epoch');
  positiveInteger(transition.anchorTransition.candidateSelfDeclaredEpoch, 'stored candidate anchor epoch');
  if (!['ROLLBACK_SELF_DECLARED', 'ADVANCED_SELF_DECLARED', 'SAME_SELF_DECLARED_EPOCH'].includes(transition.anchorTransition.relation)) throw new Error('stored transition anchor relation mismatch');
  reference(transition.ledgerRef, 'stored transition ledger reference');
  reference(transition.previousCheckpointRef, 'stored previous checkpoint reference');
  reference(transition.candidateCheckpointRef, 'stored candidate checkpoint reference');
  exactKeys(transition.comparison, [
    'anchorIdentityMatches', 'ledgerIdentityMatches',
    'candidateVerificationTimePrecedesPrevious', 'candidateCheckpointTimePrecedesPrevious',
    'sameAnchorDigest', 'sameCheckpointDigest', 'sameSeparatedReceiptDigest',
    'missingPreviousChallenges', 'replacedPreviousEntries', 'addedCandidateChallenges'
  ], 'stored transition comparison');
  exactKeys(transition.decision, ['classification', 'pairwiseConsistency', 'forwardTransitionAdmissible', 'reviewRequired', 'bestAction', 'autonomousActionCount'], 'stored transition decision');
  if (transition.decision.classification !== 'CANDIDATE_EXTENDS_PRESENTED_CHAIN' ||
      transition.decision.pairwiseConsistency !== 'CONSISTENT_EXTENSION' ||
      transition.decision.forwardTransitionAdmissible !== true ||
      transition.decision.reviewRequired !== false ||
      transition.decision.bestAction !== 'RETAIN_TRANSITION_ONLY_IF_AN_AUTHORIZED_HOST_CHOOSES' ||
      transition.decision.autonomousActionCount !== 0) throw new Error('stored transition is not a bounded forward extension');
  if (transition.state !== 'PAIRWISE_SEPARATED_CHAIN_TRANSITION_COMPARED_GLOBAL_FORK_ABSENCE_NOT_PROVEN' ||
      transition.nextGate !== TransitionGate.NEXT_GATE) throw new Error('stored transition state boundary mismatch');
  if (stableStringify(transition.truth) !== stableStringify(storedForwardTransitionTruth())) throw new Error('stored transition truth boundary mismatch');
  const expected = sha256(withoutField(transition, 'receiptDigest'));
  if (digest(transition.receiptDigest, 'stored transition receipt digest') !== expected) throw new Error('stored transition receipt digest mismatch');
  return transition;
}

function validateStoredEntry(value, context) {
  try {
    const entry = copy(value);
    exactKeys(entry, [
      'schema', 'version', 'entryId', 'recordedAt', 'status', 'log', 'manifestRef',
      'previousEntryRef', 'transitionReceipt', 'previousSeparatedWitnessRef',
      'candidateSeparatedWitnessRef', 'state', 'nextGate', 'truth', 'entryDigest'
    ], 'stored transition ledger entry');
    if (entry.schema !== ENTRY_SCHEMA || entry.version !== VERSION || entry.status !== STATUS) throw new Error('stored transition ledger entry identity mismatch');
    exactText(entry.entryId, 'stored transition ledger entry id', 180);
    timestamp(entry.recordedAt, 'stored transition ledger entry time');
    exactKeys(entry.log, ['logId', 'authorityOrigin', 'storageMode', 'sequence'], 'stored transition ledger log binding');
    if (entry.log.logId !== context.manifest.logId || entry.log.authorityOrigin !== AUTHORITY_ORIGIN || entry.log.storageMode !== STORAGE_MODE) throw new Error('stored transition ledger binding mismatch');
    if (positiveInteger(entry.log.sequence, 'stored transition ledger sequence') !== context.sequence) throw new Error('stored transition ledger sequence mismatch');
    if (!sameReference(reference(entry.manifestRef, 'stored manifest reference'), manifestRef(context.manifest))) throw new Error('stored transition ledger manifest reference mismatch');
    if (context.previousEntryRef === null) {
      if (entry.previousEntryRef !== null) throw new Error('first transition ledger entry must have a null previous entry reference');
    } else if (!sameReference(reference(entry.previousEntryRef, 'stored previous entry reference'), context.previousEntryRef)) {
      throw new Error('stored previous entry reference mismatch');
    }
    const transition = validateStoredTransition(entry.transitionReceipt);
    const previous = reference(entry.previousSeparatedWitnessRef, 'stored previous separated witness reference');
    const candidate = reference(entry.candidateSeparatedWitnessRef, 'stored candidate separated witness reference');
    if (!sameReference(previous, transition.previousSeparatedWitnessRef) || !sameReference(candidate, transition.candidateSeparatedWitnessRef)) throw new Error('stored transition witness reference mismatch');
    if (!sameReference(previous, context.currentHead)) throw new Error('stored transition does not extend the exact preceding local head');
    if (entry.state !== 'LOCAL_CALLER_OWNED_TRANSITION_HEAD_ADVANCED_WHILE_STATE_IS_PRESERVED_NO_GLOBAL_CONSISTENCY_OR_EXECUTION_AUTHORITY' || entry.nextGate !== NEXT_GATE) throw new Error('stored transition ledger state boundary mismatch');
    if (stableStringify(entry.truth) !== stableStringify(entryTruth())) throw new Error('stored transition ledger truth boundary mismatch');
    if (digest(entry.entryDigest, 'stored transition ledger entry digest') !== entryDigest(entry)) throw new Error('stored transition ledger entry digest mismatch');
    return entry;
  } catch (error) {
    throw new TransitionLedgerError('TRANSITION_LEDGER_ENTRY_CORRUPT', 'transition ledger entry is corrupt or boundary-invalid; fail-closed steward repair is required: ' + error.message);
  }
}

function assertDirectoryNotLink(directoryPath, label) {
  let stat;
  try { stat = fs.lstatSync(directoryPath); } catch (error) {
    throw new TransitionLedgerError('STATE_ROOT_INVALID', label + ' cannot be inspected: ' + error.message);
  }
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw new TransitionLedgerError('STATE_ROOT_INVALID', label + ' must be a real directory and not a symbolic link or junction');
}

function createFixedDirectory(directoryPath, label) {
  try { fs.mkdirSync(directoryPath); } catch (error) {
    if (error.code !== 'EEXIST') throw new TransitionLedgerError('STATE_ROOT_INVALID', label + ' cannot be created: ' + error.message);
  }
  assertDirectoryNotLink(directoryPath, label);
}

function resolvePaths(stateRoot) {
  const root = path.resolve(exactText(stateRoot, 'transition ledger stateRoot', 32767));
  if (root === path.parse(root).root) throw new TransitionLedgerError('STATE_ROOT_INVALID', 'filesystem root cannot be a transition ledger stateRoot');
  assertDirectoryNotLink(root, 'transition ledger stateRoot');
  return { root, namespace: path.join(root, NAMESPACE), entries: path.join(root, NAMESPACE, ENTRIES_DIRECTORY) };
}

function readJsonFile(filePath, code, label) {
  let stat;
  try { stat = fs.lstatSync(filePath); } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw new TransitionLedgerError(code, label + ' cannot be inspected: ' + error.message);
  }
  if (!stat.isFile() || stat.isSymbolicLink()) throw new TransitionLedgerError(code, label + ' must be a regular file and not a symbolic link');
  try { return JSON.parse(fs.readFileSync(filePath, 'utf8')); } catch (error) {
    throw new TransitionLedgerError(code, label + ' is unreadable or invalid JSON; fail-closed steward repair is required');
  }
}

function readManifest(manifestPath, logId, genesisRef) {
  const parsed = readJsonFile(manifestPath, 'TRANSITION_LEDGER_MANIFEST_CORRUPT', 'transition ledger manifest');
  return parsed === null ? null : validateManifest(parsed, logId, genesisRef);
}

function writeExclusive(filePath, value, failurePrefix) {
  let descriptor;
  try { descriptor = fs.openSync(filePath, 'wx', 0o600); } catch (error) {
    if (error.code === 'EEXIST') return false;
    throw new TransitionLedgerError(failurePrefix + '_WRITE_FAILED', 'exclusive file create failed: ' + error.message);
  }
  let writeError = null;
  try {
    fs.writeFileSync(descriptor, stableStringify(value) + '\n', { encoding: 'utf8' });
    fs.fsyncSync(descriptor);
  } catch (error) { writeError = error; } finally {
    try { fs.closeSync(descriptor); } catch (error) { if (!writeError) writeError = error; }
  }
  if (writeError) throw new TransitionLedgerError(failurePrefix + '_DURABILITY_UNCERTAIN', 'file write or fsync did not complete; fail-closed state was retained for steward inspection: ' + writeError.message);
  return true;
}

function ensureManifest(paths, logId, genesisRef) {
  const manifestPath = path.join(paths.namespace, MANIFEST_FILE);
  const existing = readManifest(manifestPath, logId, genesisRef);
  if (existing) return existing;
  const items = fs.readdirSync(paths.namespace);
  if (items.length) {
    const raced = readManifest(manifestPath, logId, genesisRef);
    if (raced) return raced;
    throw new TransitionLedgerError('TRANSITION_LEDGER_MANIFEST_MISSING', 'non-empty transition ledger namespace has no manifest; fail-closed steward repair is required');
  }
  const manifest = buildManifest(logId, genesisRef);
  if (!writeExclusive(manifestPath, manifest, 'TRANSITION_LEDGER_MANIFEST')) return readManifest(manifestPath, logId, genesisRef);
  return manifest;
}

function prepare(paths, logId, genesisRef) {
  createFixedDirectory(paths.namespace, 'transition ledger namespace');
  const manifest = ensureManifest(paths, logId, genesisRef);
  createFixedDirectory(paths.entries, 'transition ledger entries directory');
  return manifest;
}

function sequenceFile(sequence) {
  return String(sequence).padStart(12, '0') + '.json';
}

function buildSnapshot(manifest, entries, currentHead) {
  const snapshot = {
    schema: SNAPSHOT_SCHEMA,
    version: VERSION,
    status: STATUS,
    logId: manifest.logId,
    manifestRef: manifestRef(manifest),
    genesisSeparatedWitnessRef: copy(manifest.genesisSeparatedWitnessRef),
    currentHeadSeparatedWitnessRef: copy(currentHead),
    entryCount: entries.length,
    lastEntryRef: entries.length ? entryRef(entries[entries.length - 1]) : null,
    truth: snapshotTruth(),
    snapshotDigest: null
  };
  snapshot.snapshotDigest = snapshotDigest(snapshot);
  return snapshot;
}

function loadState(paths, logId, genesisRef) {
  assertDirectoryNotLink(paths.namespace, 'transition ledger namespace');
  const namespaceItems = fs.readdirSync(paths.namespace).sort();
  const unexpectedNamespace = namespaceItems.filter(name => name !== MANIFEST_FILE && name !== ENTRIES_DIRECTORY);
  if (unexpectedNamespace.length) throw new TransitionLedgerError('TRANSITION_LEDGER_NAMESPACE_CORRUPT', 'unexpected transition ledger namespace items: ' + unexpectedNamespace.join(', '));
  const manifest = readManifest(path.join(paths.namespace, MANIFEST_FILE), logId, genesisRef);
  if (!manifest) {
    if (namespaceItems.length) throw new TransitionLedgerError('TRANSITION_LEDGER_MANIFEST_MISSING', 'non-empty transition ledger namespace has no manifest; fail-closed steward repair is required');
    return null;
  }
  const entries = [];
  let currentHead = copy(manifest.genesisSeparatedWitnessRef);
  let previousEntryRef = null;
  if (fs.existsSync(paths.entries)) {
    assertDirectoryNotLink(paths.entries, 'transition ledger entries directory');
    const names = fs.readdirSync(paths.entries).sort();
    names.forEach((name, index) => {
      const match = ENTRY_FILE.exec(name);
      if (!match || Number(match[1]) !== index + 1) throw new TransitionLedgerError('TRANSITION_LEDGER_SEQUENCE_CORRUPT', 'transition ledger entry filenames must be one contiguous 12-digit sequence');
      const parsed = readJsonFile(path.join(paths.entries, name), 'TRANSITION_LEDGER_ENTRY_CORRUPT', 'transition ledger entry ' + name);
      const entry = validateStoredEntry(parsed, { manifest, sequence: index + 1, previousEntryRef, currentHead });
      entries.push(entry);
      previousEntryRef = entryRef(entry);
      currentHead = copy(entry.candidateSeparatedWitnessRef);
    });
  }
  return { manifest, entries, currentHead, snapshot: buildSnapshot(manifest, entries, currentHead) };
}

function createService(options) {
  exactKeys(options, ['stateRoot', 'logId', 'genesisSeparatedWitnessRef'], 'transition ledger service options');
  const paths = resolvePaths(options.stateRoot);
  const logId = exactText(options.logId, 'transition ledger log id', 180);
  const genesisRef = reference(options.genesisSeparatedWitnessRef, 'genesis separated witness reference');

  function inspect() {
    if (!fs.existsSync(paths.namespace)) return null;
    const state = loadState(paths, logId, genesisRef);
    return state ? copy(state.snapshot) : null;
  }

  function advance(input) {
    const validated = validateAdvanceInput(input);
    const manifest = prepare(paths, logId, genesisRef);
    const state = loadState(paths, logId, genesisRef);
    if (!sameReference(validated.transition.previousSeparatedWitnessRef, state.currentHead)) {
      throw new TransitionLedgerError('STALE_LOCAL_HEAD', 'pairwise transition previous witness does not match the exact current local head ' + state.currentHead.sha256);
    }
    const context = {
      manifest,
      sequence: state.entries.length + 1,
      previousEntryRef: state.entries.length ? entryRef(state.entries[state.entries.length - 1]) : null
    };
    const entry = buildEntry(input, context);
    const entryPath = path.join(paths.entries, sequenceFile(context.sequence));
    if (!writeExclusive(entryPath, entry, 'TRANSITION_LEDGER_ENTRY')) {
      const afterConflict = loadState(paths, logId, genesisRef);
      const existing = afterConflict.entries[context.sequence - 1];
      if (existing && existing.entryDigest === entry.entryDigest) {
        throw new TransitionLedgerError('TRANSITION_ALREADY_RECORDED', 'the exact transition entry is already recorded in this caller-owned ledger');
      }
      if (!sameReference(afterConflict.currentHead, state.currentHead)) {
        throw new TransitionLedgerError('STALE_LOCAL_HEAD', 'another local transition advanced the caller-owned head first');
      }
      throw new TransitionLedgerError('TRANSITION_LEDGER_SEQUENCE_CONFLICT', 'the next local sequence entry already exists with different content');
    }
    return entry;
  }

  function verifyPersisted(input, receipt) {
    const errors = [];
    let rebuilt = null;
    let stored = null;
    try {
      const state = loadState(paths, logId, genesisRef);
      if (!state) throw new Error('transition ledger is absent');
      const candidate = copy(receipt);
      const sequence = candidate && candidate.log && candidate.log.sequence;
      if (!Number.isSafeInteger(sequence) || sequence < 1 || sequence > state.entries.length) throw new Error('persisted transition ledger sequence is absent');
      stored = state.entries[sequence - 1];
      const previousEntryRef = sequence === 1 ? null : entryRef(state.entries[sequence - 2]);
      rebuilt = buildEntry(input, { manifest: state.manifest, sequence, previousEntryRef });
      if (stableStringify(rebuilt) !== stableStringify(candidate)) throw new Error('presented transition ledger entry does not exact-rebuild from the caller package');
      if (stableStringify(stored) !== stableStringify(rebuilt)) throw new Error('persisted transition ledger entry does not match the exact rebuilt entry');
    } catch (error) { errors.push(error.message); }
    return { pass: errors.length === 0, errors, rebuilt, stored };
  }

  return Object.freeze({ logId, genesisSeparatedWitnessRef: copy(genesisRef), advance, inspect, verifyPersisted });
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
  TransitionLedgerError,
  stableStringify,
  sha256,
  buildManifest,
  buildEntry,
  validateStoredEntry,
  createService
};
