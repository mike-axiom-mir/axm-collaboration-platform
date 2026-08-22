#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const Continuity = require('../model-shadow-review-challenge-transition-local-possession-continuity/model-shadow-review-challenge-transition-local-possession-continuity');
const Separation = require('../model-shadow-review-challenge-transition-local-possession-checkpoint-separation/model-shadow-review-challenge-transition-local-possession-checkpoint-separation');
const Transition = require('../model-shadow-review-challenge-transition-local-possession-checkpoint-pairwise-transition/model-shadow-review-challenge-transition-local-possession-checkpoint-pairwise-transition');

const ENTRY_SCHEMA = 'axm.model-shadow-review-challenge-transition-local-possession-checkpoint-transition-ledger-entry/v1';
const MANIFEST_SCHEMA = 'axm.model-shadow-review-challenge-transition-local-possession-checkpoint-transition-ledger-manifest/v1';
const SNAPSHOT_SCHEMA = 'axm.model-shadow-review-challenge-transition-local-possession-checkpoint-transition-ledger-snapshot/v1';
const VERSION = '1.9.0';
const STATUS = 'TEST';
const CONFIRMATION = 'RECORD EXACT CURRENT LOCAL POSSESSION TRANSITION ONCE';
const AUTHORITY_ORIGIN = 'CALLER_STATE_ROOT_AND_CONFIRMATION_UNAUTHENTICATED';
const STORAGE_MODE = 'EXACT_PREWRITE_CURRENTNESS_CAPTURE_THEN_EXCLUSIVE_LOCAL_SEQUENCE_ENTRY_CREATE';
const NAMESPACE = 'model-shadow-review-challenge-transition-local-possession-checkpoint-transition-ledger';
const ENTRIES_DIRECTORY = 'entries';
const MANIFEST_FILE = 'ledger.json';
const NEXT_GATE = 'HOST_AUTHENTICATED_EXTERNALLY_RETAINED_GLOBALLY_CONSISTENT_TRANSITION_LOG_OR_PROTECTED_MONOTONIC_STORE_WITH_ATOMIC_SOURCE_BINDING';
const MAX_ARTIFACT_CANONICAL_BYTES = 1024 * 1024;
const DIGEST = /^sha256:[a-f0-9]{64}$/;
const ENTRY_FILE = /^([0-9]{12})\.json$/;

class LocalTransitionLedgerError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'LocalTransitionLedgerError';
    this.code = code;
  }
}

function stableStringify(value) { return Transition.stableStringify(value); }
function clone(value) { return JSON.parse(stableStringify(value)); }
function sha256(value) { return Transition.sha256(value); }

function fail(code, message) { throw new LocalTransitionLedgerError(code, message); }

function assertBound(value, label) {
  let bytes;
  try { bytes = Buffer.byteLength(stableStringify(value), 'utf8'); } catch (error) { fail('INVALID_INPUT', label + ' is not canonical JSON data'); }
  if (bytes > MAX_ARTIFACT_CANONICAL_BYTES) fail('ARTIFACT_TOO_LARGE', label + ' exceeds the bounded canonical byte limit');
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

function boundedString(value, label, maximum) {
  if (typeof value !== 'string' || !value) fail('INVALID_INPUT', label + ' must be a non-empty string');
  if (maximum && value.length > maximum) fail('INVALID_INPUT', label + ' is too long');
  return value;
}

function timestamp(value, label) {
  const result = exactText(value, label, 64);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?Z$/.test(result) || Number.isNaN(Date.parse(result))) {
    fail('INVALID_INPUT', label + ' must be an exact UTC timestamp');
  }
  return result;
}

function digest(value, label) {
  const result = exactText(value, label, 71);
  if (!DIGEST.test(result)) fail('INVALID_INPUT', label + ' must be an exact SHA-256 digest');
  return result;
}

function positiveInteger(value, label) {
  if (!Number.isSafeInteger(value) || value < 1) fail('INVALID_INPUT', label + ' must be a positive safe integer');
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
  const payload = clone(value);
  delete payload[field];
  return payload;
}

function manifestDigest(value) { return sha256(withoutField(value, 'manifestDigest')); }
function entryDigest(value) { return sha256(withoutField(value, 'entryDigest')); }
function snapshotDigest(value) { return sha256(withoutField(value, 'snapshotDigest')); }
function manifestRef(value) { return { id: value.logId, schema: value.schema, sha256: value.manifestDigest }; }
function entryRef(value) { return { id: value.entryId, schema: value.schema, sha256: value.entryDigest }; }
function snapshotRef(value) { return { id: value.observationId, schema: value.schema, sha256: value.snapshotDigest }; }

function contextFromOptions(options) {
  const receiverId = exactText(options.receiverId, 'configured receiver id', 120);
  const challengerId = exactText(options.challengerId, 'configured challenger id', 120);
  const policy = options.receiverPolicy;
  if (!policy || typeof policy !== 'object' || Array.isArray(policy)) fail('INVALID_INPUT', 'configured receiver policy must be an object');
  return {
    receiverId,
    challengerId,
    receiverIdDigest: sha256({ receiverId }),
    challengerIdDigest: sha256({ challengerId }),
    receiverPolicyRef: {
      id: exactText(policy.policyId, 'configured receiver policy id', 180),
      schema: exactText(policy.schema, 'configured receiver policy schema', 180),
      sha256: digest(policy.policyDigest, 'configured receiver policy digest')
    }
  };
}

function entryTruth() {
  return {
    transitionReceiptVerifiedByExactRebuildBeforeWrite: true,
    forwardPairwiseExtensionRequired: true,
    candidateSourceStateCapturedBeforeWrite: true,
    candidateSeparatedAuditVerifiedByExactRebuildBeforeWrite: true,
    candidateResponseSetMatchedPresentedCheckpointBeforeWrite: true,
    currentResponseSignaturesStrictlyReloadedBeforeWrite: true,
    localManifestVerified: true,
    exactLocalHeadMatchedBeforeWrite: true,
    explicitConfirmationRequired: true,
    exclusiveSequenceEntryCreateWon: true,
    entryFileFsyncCompleted: true,
    localHeadAdvancedWhileLedgerRootIsPreserved: true,
    sourceCaptureAndLedgerAppendAtomic: false,
    sourceStateUnchangedAfterCaptureProven: false,
    candidateStillCurrentAfterWriteProven: false,
    persistedRawCurrentSnapshot: false,
    persistedUpstreamRebuildInputs: false,
    upstreamArtifactsReverifiedAfterReloadWithoutCallerPackage: false,
    callerPackageRequiredForPersistedExactRebuild: true,
    independentStateRootsExcluded: false,
    withheldForksExcluded: false,
    globalTransitionUniquenessProven: false,
    globallyConsistentTransitionLogProven: false,
    externalRetentionProven: false,
    protectedMonotonicStateProven: false,
    deletionOrRollbackPrevented: false,
    ledgerAuthorityAuthenticated: false,
    hostAuthorizationAuthenticated: false,
    actorRealWorldIdentityProven: false,
    actualHumanParticipationProven: false,
    observationTimeExternallyTrusted: false,
    recordingTimeExternallyTrusted: false,
    directoryEntryDurabilityProven: false,
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
    storedCurrentnessReceiptsSelfDigestValidated: true,
    upstreamArtifactsReverifiedWithoutCallerPackages: false,
    currentSourceStateRecapturedOnInspect: false,
    independentStateRootsExcluded: false,
    globallyConsistentTransitionLogProven: false,
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

function buildManifest(logId, genesisSeparatedWitnessRef, context) {
  const manifest = {
    schema: MANIFEST_SCHEMA,
    version: VERSION,
    status: STATUS,
    logId: exactText(logId, 'local transition ledger log id', 180),
    genesisSeparatedWitnessRef: reference(genesisSeparatedWitnessRef, 'genesis separated witness reference'),
    receiverIdDigest: digest(context.receiverIdDigest, 'configured receiver id digest'),
    challengerIdDigest: digest(context.challengerIdDigest, 'configured challenger id digest'),
    receiverPolicyRef: reference(context.receiverPolicyRef, 'configured receiver policy reference'),
    authorityOrigin: AUTHORITY_ORIGIN,
    storageMode: STORAGE_MODE,
    manifestDigest: null
  };
  manifest.manifestDigest = manifestDigest(manifest);
  return manifest;
}

function validateTransition(input) {
  const check = Transition.verifyTransition(clone(input.transitionInput), clone(input.transitionReceipt));
  if (!check.pass) fail('TRANSITION_INVALID', 'v1.8 pairwise transition is invalid: ' + check.errors.join('; '));
  const receipt = check.rebuilt;
  if (receipt.decision.classification !== 'CANDIDATE_EXTENDS_PRESENTED_POSSESSION_CHAIN' ||
      receipt.decision.forwardTransitionAdmissible !== true || receipt.decision.reviewRequired !== false) {
    fail('TRANSITION_NOT_FORWARD_EXTENSION', 'only an exact v1.8 forward response extension may advance this local ledger');
  }
  if (receipt.truth.globalTransitionUniquenessProven !== false ||
      receipt.truth.globallyConsistentTransitionLogProven !== false ||
      receipt.truth.executionAuthorized !== false || receipt.truth.adoptionAuthorized !== false) {
    fail('UPSTREAM_AUTHORITY_MISMATCH', 'v1.8 transition authority boundary mismatch');
  }
  return receipt;
}

function validateRecordInput(input) {
  assertBound(input, 'local transition ledger record input');
  exactKeys(input, [
    'entryId', 'recordedAt', 'confirmation', 'transitionInput', 'transitionReceipt',
    'observationId', 'observedAt', 'auditId', 'checkedAt'
  ], 'local transition ledger record input');
  if (input.confirmation !== CONFIRMATION) fail('CONFIRMATION_REQUIRED', 'exact local transition recording confirmation is required');
  const validated = {
    entryId: exactText(input.entryId, 'local transition ledger entry id', 180),
    recordedAt: timestamp(input.recordedAt, 'local transition ledger recording time'),
    observationId: exactText(input.observationId, 'candidate currentness observation id', 180),
    observedAt: timestamp(input.observedAt, 'candidate currentness observation time'),
    auditId: exactText(input.auditId, 'candidate currentness audit id', 180),
    checkedAt: timestamp(input.checkedAt, 'candidate currentness audit time'),
    transition: validateTransition(input)
  };
  if (Date.parse(validated.observedAt) < Date.parse(validated.transition.comparedAt) ||
      Date.parse(validated.checkedAt) < Date.parse(validated.observedAt) ||
      Date.parse(validated.recordedAt) < Date.parse(validated.checkedAt)) {
    fail('INVALID_INPUT', 'comparison, observation, audit, and recording timestamps must be nondecreasing');
  }
  return validated;
}

function validateCurrentnessEvidence(input, evidence, validated) {
  exactKeys(evidence, ['currentSnapshot', 'currentnessAuditReceipt'], 'candidate currentness evidence');
  if (!Continuity.verifySnapshot(clone(evidence.currentSnapshot)).pass) fail('CURRENT_SNAPSHOT_INVALID', 'captured candidate current snapshot is invalid');
  const current = clone(evidence.currentSnapshot);
  if (current.observationId !== validated.observationId || current.observedAt !== validated.observedAt) {
    fail('CURRENT_SNAPSHOT_MISMATCH', 'captured candidate current snapshot identity or time does not match the record request');
  }
  const auditInput = {
    auditId: validated.auditId,
    checkedAt: validated.checkedAt,
    separationInput: clone(input.transitionInput.candidateSeparationInput),
    separationReceipt: clone(input.transitionInput.candidateSeparationReceipt),
    currentSnapshot: current
  };
  const check = Separation.verifySeparatedAudit(auditInput, clone(evidence.currentnessAuditReceipt));
  if (!check.pass) fail('CURRENTNESS_AUDIT_INVALID', 'candidate separated currentness audit is invalid: ' + check.errors.join('; '));
  const audit = check.rebuilt;
  if (audit.decision.classification !== 'CURRENT_RESPONSE_SET_MATCHES_PRESENTED_CHECKPOINT' ||
      audit.decision.reviewRequired !== false || audit.currentSnapshot.availability !== 'AVAILABLE') {
    fail('CANDIDATE_NOT_CURRENT_EXACT_MATCH', 'candidate source state must exactly match the presented candidate checkpoint before local recording');
  }
  const candidateRef = reference(validated.transition.candidateSeparatedWitnessRef, 'candidate transition separated witness reference');
  if (!sameReference(candidateRef, reference(audit.separatedWitnessRef, 'candidate currentness separated witness reference'))) {
    fail('CURRENTNESS_AUDIT_MISMATCH', 'candidate currentness audit is not bound to the v1.8 candidate separated witness');
  }
  return { current, audit };
}

function buildEntry(input, evidence, context) {
  const validated = validateRecordInput(input);
  const currentness = validateCurrentnessEvidence(input, evidence, validated);
  exactKeys(context, ['manifest', 'sequence', 'previousEntryRef'], 'local transition ledger entry context');
  const manifest = validateManifest(clone(context.manifest), context.manifest.logId, context.manifest.genesisSeparatedWitnessRef, {
    receiverIdDigest: context.manifest.receiverIdDigest,
    challengerIdDigest: context.manifest.challengerIdDigest,
    receiverPolicyRef: context.manifest.receiverPolicyRef
  });
  const sequence = positiveInteger(context.sequence, 'local transition ledger sequence');
  const previousEntryRef = context.previousEntryRef === null ? null : reference(context.previousEntryRef, 'previous local transition ledger entry reference');
  if (currentness.current.receiverIdDigest !== manifest.receiverIdDigest ||
      currentness.current.challengerIdDigest !== manifest.challengerIdDigest ||
      !sameReference(reference(currentness.current.receiverPolicyRef, 'captured receiver policy reference'), manifest.receiverPolicyRef)) {
    fail('SOURCE_CONTEXT_MISMATCH', 'captured source identity does not match the ledger manifest context');
  }
  const entry = {
    schema: ENTRY_SCHEMA,
    version: VERSION,
    entryId: validated.entryId,
    recordedAt: validated.recordedAt,
    status: STATUS,
    log: { logId: manifest.logId, authorityOrigin: AUTHORITY_ORIGIN, storageMode: STORAGE_MODE, sequence },
    manifestRef: manifestRef(manifest),
    previousEntryRef,
    transitionReceipt: clone(validated.transition),
    candidateCurrentnessAuditReceipt: clone(currentness.audit),
    capturedSnapshotRef: snapshotRef(currentness.current),
    previousSeparatedWitnessRef: clone(validated.transition.previousSeparatedWitnessRef),
    candidateSeparatedWitnessRef: clone(validated.transition.candidateSeparatedWitnessRef),
    state: 'LOCAL_TRANSITION_RECORDED_AFTER_EXACT_PREWRITE_SOURCE_MATCH_NO_ATOMIC_SOURCE_BINDING_OR_GLOBAL_CONSISTENCY',
    nextGate: NEXT_GATE,
    truth: entryTruth(),
    entryDigest: null
  };
  entry.entryDigest = entryDigest(entry);
  assertBound(entry, 'local transition ledger entry');
  return entry;
}

function validateManifest(value, expectedLogId, expectedGenesisRef, expectedContext) {
  try {
    const manifest = clone(value);
    exactKeys(manifest, [
      'schema', 'version', 'status', 'logId', 'genesisSeparatedWitnessRef', 'receiverIdDigest',
      'challengerIdDigest', 'receiverPolicyRef', 'authorityOrigin', 'storageMode', 'manifestDigest'
    ], 'local transition ledger manifest');
    if (manifest.schema !== MANIFEST_SCHEMA || manifest.version !== VERSION || manifest.status !== STATUS) throw new Error('manifest identity mismatch');
    exactText(manifest.logId, 'stored local transition log id', 180);
    const genesis = reference(manifest.genesisSeparatedWitnessRef, 'stored genesis separated witness reference');
    digest(manifest.receiverIdDigest, 'stored receiver id digest');
    digest(manifest.challengerIdDigest, 'stored challenger id digest');
    reference(manifest.receiverPolicyRef, 'stored receiver policy reference');
    if (manifest.authorityOrigin !== AUTHORITY_ORIGIN || manifest.storageMode !== STORAGE_MODE) throw new Error('manifest boundary mismatch');
    if (digest(manifest.manifestDigest, 'stored manifest digest') !== manifestDigest(manifest)) throw new Error('manifest digest mismatch');
    if (manifest.logId !== expectedLogId) fail('LOG_ID_MISMATCH', 'ledger root is already bound to a different log id');
    if (!sameReference(genesis, reference(expectedGenesisRef, 'expected genesis separated witness reference'))) fail('GENESIS_MISMATCH', 'ledger root is already bound to a different genesis witness');
    if (manifest.receiverIdDigest !== expectedContext.receiverIdDigest || manifest.challengerIdDigest !== expectedContext.challengerIdDigest ||
        !sameReference(manifest.receiverPolicyRef, expectedContext.receiverPolicyRef)) fail('SOURCE_CONTEXT_MISMATCH', 'ledger root is already bound to a different source context');
    return manifest;
  } catch (error) {
    if (error instanceof LocalTransitionLedgerError && ['LOG_ID_MISMATCH', 'GENESIS_MISMATCH', 'SOURCE_CONTEXT_MISMATCH'].includes(error.code)) throw error;
    fail('TRANSITION_LEDGER_MANIFEST_CORRUPT', 'local transition ledger manifest is corrupt or boundary-invalid: ' + error.message);
  }
}

function validateStoredTransition(value) {
  const receipt = clone(value);
  exactKeys(receipt, [
    'schema', 'version', 'transitionId', 'comparedAt', 'status', 'previousSeparatedWitnessRef',
    'candidateSeparatedWitnessRef', 'anchorTransition', 'witnessPolicyTransition', 'receiverContextTransition',
    'previousCheckpointRef', 'candidateCheckpointRef', 'comparison', 'decision', 'state', 'nextGate', 'truth', 'receiptDigest'
  ], 'stored v1.8 transition receipt');
  if (receipt.schema !== Transition.RECEIPT_SCHEMA || receipt.version !== Transition.VERSION || receipt.status !== STATUS) throw new Error('stored transition identity mismatch');
  timestamp(receipt.comparedAt, 'stored transition comparison time');
  reference(receipt.previousSeparatedWitnessRef, 'stored previous separated witness reference');
  reference(receipt.candidateSeparatedWitnessRef, 'stored candidate separated witness reference');
  reference(receipt.previousCheckpointRef, 'stored previous checkpoint reference');
  reference(receipt.candidateCheckpointRef, 'stored candidate checkpoint reference');
  if (!receipt.decision || receipt.decision.classification !== 'CANDIDATE_EXTENDS_PRESENTED_POSSESSION_CHAIN' ||
      receipt.decision.forwardTransitionAdmissible !== true || receipt.decision.reviewRequired !== false) throw new Error('stored transition is not a bounded forward extension');
  if (!receipt.truth || receipt.truth.forwardExtensionObserved !== true || receipt.truth.globalTransitionUniquenessProven !== false ||
      receipt.truth.globallyConsistentTransitionLogProven !== false || receipt.truth.executionAuthorized !== false || receipt.truth.adoptionAuthorized !== false) throw new Error('stored transition truth boundary mismatch');
  if (receipt.nextGate !== Transition.NEXT_GATE || digest(receipt.receiptDigest, 'stored transition digest') !== sha256(withoutField(receipt, 'receiptDigest'))) throw new Error('stored transition digest or gate mismatch');
  return receipt;
}

function validateStoredCurrentness(value) {
  const audit = clone(value);
  exactKeys(audit, [
    'schema', 'version', 'auditId', 'checkedAt', 'status', 'separatedWitnessRef', 'anchoredWitnessRef',
    'anchorRef', 'witnessRef', 'witnessPolicyRef', 'checkpointRef', 'sourceSnapshotRef', 'receiverIdDigest',
    'challengerIdDigest', 'receiverPolicyRef', 'entriesDigest', 'anchoredContinuityAuditRef', 'currentSnapshot',
    'comparison', 'decision', 'state', 'nextGate', 'truth', 'auditDigest'
  ], 'stored v1.7 candidate currentness audit receipt');
  if (audit.schema !== Separation.AUDIT_SCHEMA || audit.version !== Separation.VERSION || audit.status !== STATUS) throw new Error('stored currentness audit identity mismatch');
  timestamp(audit.checkedAt, 'stored currentness audit time');
  reference(audit.separatedWitnessRef, 'stored currentness separated witness reference');
  if (!audit.currentSnapshot || audit.currentSnapshot.availability !== 'AVAILABLE') throw new Error('stored currentness snapshot was not available');
  if (!audit.decision || audit.decision.classification !== 'CURRENT_RESPONSE_SET_MATCHES_PRESENTED_CHECKPOINT' || audit.decision.reviewRequired !== false) throw new Error('stored currentness audit is not an exact candidate match');
  if (!audit.truth || audit.truth.responseFilenameIdentityVerifiedWhenAvailable !== true || audit.truth.comparisonBoundToExactConfiguredIdentity !== true ||
      audit.truth.currentResponseStateDeletionOrRollbackPrevented !== false ||
      audit.truth.hostAuthorizationAuthenticated !== false || audit.truth.executionAuthorized !== false || audit.truth.adoptionAuthorized !== false) throw new Error('stored currentness truth boundary mismatch');
  if (audit.nextGate !== Separation.NEXT_GATE || digest(audit.auditDigest, 'stored currentness audit digest') !== sha256(withoutField(audit, 'auditDigest'))) throw new Error('stored currentness audit digest or gate mismatch');
  return audit;
}

function validateStoredEntry(value, context) {
  try {
    const entry = clone(value);
    exactKeys(entry, [
      'schema', 'version', 'entryId', 'recordedAt', 'status', 'log', 'manifestRef', 'previousEntryRef',
      'transitionReceipt', 'candidateCurrentnessAuditReceipt', 'capturedSnapshotRef', 'previousSeparatedWitnessRef',
      'candidateSeparatedWitnessRef', 'state', 'nextGate', 'truth', 'entryDigest'
    ], 'stored local transition ledger entry');
    if (entry.schema !== ENTRY_SCHEMA || entry.version !== VERSION || entry.status !== STATUS) throw new Error('entry identity mismatch');
    exactText(entry.entryId, 'stored entry id', 180);
    timestamp(entry.recordedAt, 'stored entry time');
    exactKeys(entry.log, ['logId', 'authorityOrigin', 'storageMode', 'sequence'], 'stored entry log binding');
    if (entry.log.logId !== context.manifest.logId || entry.log.authorityOrigin !== AUTHORITY_ORIGIN || entry.log.storageMode !== STORAGE_MODE ||
        positiveInteger(entry.log.sequence, 'stored entry sequence') !== context.sequence) throw new Error('entry log binding mismatch');
    if (!sameReference(reference(entry.manifestRef, 'stored manifest reference'), manifestRef(context.manifest))) throw new Error('entry manifest reference mismatch');
    if (context.previousEntryRef === null ? entry.previousEntryRef !== null : !sameReference(reference(entry.previousEntryRef, 'stored previous entry reference'), context.previousEntryRef)) throw new Error('previous entry reference mismatch');
    const transition = validateStoredTransition(entry.transitionReceipt);
    const currentness = validateStoredCurrentness(entry.candidateCurrentnessAuditReceipt);
    const previous = reference(entry.previousSeparatedWitnessRef, 'stored previous separated witness reference');
    const candidate = reference(entry.candidateSeparatedWitnessRef, 'stored candidate separated witness reference');
    if (!sameReference(previous, transition.previousSeparatedWitnessRef) || !sameReference(candidate, transition.candidateSeparatedWitnessRef) ||
        !sameReference(candidate, currentness.separatedWitnessRef) || !sameReference(previous, context.currentHead)) throw new Error('entry transition chain binding mismatch');
    const captured = reference(entry.capturedSnapshotRef, 'stored captured snapshot reference');
    if (captured.id !== currentness.currentSnapshot.id || captured.schema !== currentness.currentSnapshot.schema || captured.sha256 !== currentness.currentSnapshot.sha256) throw new Error('entry captured snapshot binding mismatch');
    if (entry.state !== 'LOCAL_TRANSITION_RECORDED_AFTER_EXACT_PREWRITE_SOURCE_MATCH_NO_ATOMIC_SOURCE_BINDING_OR_GLOBAL_CONSISTENCY' || entry.nextGate !== NEXT_GATE) throw new Error('entry state boundary mismatch');
    if (stableStringify(entry.truth) !== stableStringify(entryTruth())) throw new Error('entry truth boundary mismatch');
    if (digest(entry.entryDigest, 'stored entry digest') !== entryDigest(entry)) throw new Error('entry digest mismatch');
    return entry;
  } catch (error) {
    fail('TRANSITION_LEDGER_ENTRY_CORRUPT', 'local transition ledger entry is corrupt or boundary-invalid: ' + error.message);
  }
}

function assertDirectoryNotLink(directoryPath, label) {
  let stat;
  try { stat = fs.lstatSync(directoryPath); } catch (error) { fail('STATE_ROOT_INVALID', label + ' cannot be inspected: ' + error.message); }
  if (!stat.isDirectory() || stat.isSymbolicLink()) fail('STATE_ROOT_INVALID', label + ' must be a real directory and not a symbolic link or junction');
}

function createFixedDirectory(directoryPath, label) {
  try { fs.mkdirSync(directoryPath); } catch (error) { if (error.code !== 'EEXIST') fail('STATE_ROOT_INVALID', label + ' cannot be created: ' + error.message); }
  assertDirectoryNotLink(directoryPath, label);
}

function resolvePaths(stateRoot) {
  const root = path.resolve(exactText(stateRoot, 'local transition ledger stateRoot', 32767));
  if (root === path.parse(root).root) fail('STATE_ROOT_INVALID', 'filesystem root cannot be a local transition ledger stateRoot');
  assertDirectoryNotLink(root, 'local transition ledger stateRoot');
  return { root, namespace: path.join(root, NAMESPACE), entries: path.join(root, NAMESPACE, ENTRIES_DIRECTORY) };
}

function readJsonFile(filePath, code, label) {
  let stat;
  try { stat = fs.lstatSync(filePath); } catch (error) { if (error.code === 'ENOENT') return null; fail(code, label + ' cannot be inspected: ' + error.message); }
  if (!stat.isFile() || stat.isSymbolicLink()) fail(code, label + ' must be a regular file and not a symbolic link');
  if (stat.size > MAX_ARTIFACT_CANONICAL_BYTES + 1) fail(code, label + ' exceeds the bounded canonical byte limit');
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    if (raw !== stableStringify(parsed) + '\n') fail(code, label + ' is not exact canonical JSON');
    return parsed;
  } catch (error) {
    if (error instanceof LocalTransitionLedgerError) throw error;
    fail(code, label + ' is unreadable or invalid JSON');
  }
}

function writeExclusive(filePath, value, failurePrefix) {
  let descriptor;
  try { descriptor = fs.openSync(filePath, 'wx', 0o600); } catch (error) { if (error.code === 'EEXIST') return false; fail(failurePrefix + '_WRITE_FAILED', 'exclusive file create failed: ' + error.message); }
  let problem = null;
  try { fs.writeFileSync(descriptor, stableStringify(value) + '\n', { encoding: 'utf8' }); fs.fsyncSync(descriptor); }
  catch (error) { problem = error; }
  finally { try { fs.closeSync(descriptor); } catch (error) { if (!problem) problem = error; } }
  if (problem) fail(failurePrefix + '_DURABILITY_UNCERTAIN', 'file write or fsync did not complete; retained state requires steward inspection: ' + problem.message);
  return true;
}

function readManifest(filePath, logId, genesisRef, context) {
  const parsed = readJsonFile(filePath, 'TRANSITION_LEDGER_MANIFEST_CORRUPT', 'local transition ledger manifest');
  return parsed === null ? null : validateManifest(parsed, logId, genesisRef, context);
}

function ensureManifest(paths, logId, genesisRef, context) {
  const filePath = path.join(paths.namespace, MANIFEST_FILE);
  const existing = readManifest(filePath, logId, genesisRef, context);
  if (existing) return existing;
  if (fs.readdirSync(paths.namespace).length) {
    const raced = readManifest(filePath, logId, genesisRef, context);
    if (raced) return raced;
    fail('TRANSITION_LEDGER_MANIFEST_MISSING', 'non-empty local transition ledger namespace has no manifest');
  }
  const manifest = buildManifest(logId, genesisRef, context);
  if (!writeExclusive(filePath, manifest, 'TRANSITION_LEDGER_MANIFEST')) return readManifest(filePath, logId, genesisRef, context);
  return manifest;
}

function prepare(paths, logId, genesisRef, context) {
  createFixedDirectory(paths.namespace, 'local transition ledger namespace');
  const manifest = ensureManifest(paths, logId, genesisRef, context);
  createFixedDirectory(paths.entries, 'local transition ledger entries directory');
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
    genesisSeparatedWitnessRef: clone(manifest.genesisSeparatedWitnessRef),
    currentHeadSeparatedWitnessRef: clone(currentHead),
    receiverIdDigest: manifest.receiverIdDigest,
    challengerIdDigest: manifest.challengerIdDigest,
    receiverPolicyRef: clone(manifest.receiverPolicyRef),
    entryCount: entries.length,
    lastEntryRef: entries.length ? entryRef(entries[entries.length - 1]) : null,
    truth: snapshotTruth(),
    snapshotDigest: null
  };
  snapshot.snapshotDigest = snapshotDigest(snapshot);
  return snapshot;
}

function loadState(paths, logId, genesisRef, context) {
  assertDirectoryNotLink(paths.namespace, 'local transition ledger namespace');
  const namespaceItems = fs.readdirSync(paths.namespace).sort();
  const unexpected = namespaceItems.filter(name => name !== MANIFEST_FILE && name !== ENTRIES_DIRECTORY);
  if (unexpected.length) fail('TRANSITION_LEDGER_NAMESPACE_CORRUPT', 'unexpected local transition ledger namespace items: ' + unexpected.join(', '));
  const manifest = readManifest(path.join(paths.namespace, MANIFEST_FILE), logId, genesisRef, context);
  if (!manifest) { if (namespaceItems.length) fail('TRANSITION_LEDGER_MANIFEST_MISSING', 'non-empty local transition ledger namespace has no manifest'); return null; }
  const entries = [];
  let currentHead = clone(manifest.genesisSeparatedWitnessRef);
  let previousEntryRef = null;
  if (fs.existsSync(paths.entries)) {
    assertDirectoryNotLink(paths.entries, 'local transition ledger entries directory');
    fs.readdirSync(paths.entries).sort().forEach((name, index) => {
      const match = ENTRY_FILE.exec(name);
      if (!match || Number(match[1]) !== index + 1) fail('TRANSITION_LEDGER_SEQUENCE_CORRUPT', 'entry filenames must be one contiguous 12-digit sequence');
      const entry = validateStoredEntry(readJsonFile(path.join(paths.entries, name), 'TRANSITION_LEDGER_ENTRY_CORRUPT', 'local transition entry ' + name), {
        manifest, sequence: index + 1, previousEntryRef, currentHead
      });
      entries.push(entry);
      previousEntryRef = entryRef(entry);
      currentHead = clone(entry.candidateSeparatedWitnessRef);
    });
  }
  return { manifest, entries, currentHead, snapshot: buildSnapshot(manifest, entries, currentHead) };
}

function createService(options) {
  exactKeys(options, [
    'stateRoot', 'sourceStateRoot', 'logId', 'genesisSeparatedWitnessRef', 'receiverId', 'challengerId',
    'challengerPublicKeyPem', 'receiverPolicy'
  ], 'local transition ledger service options');
  const paths = resolvePaths(options.stateRoot);
  const sourceStateRoot = path.resolve(exactText(options.sourceStateRoot, 'candidate source state root', 32767));
  const logId = exactText(options.logId, 'local transition ledger log id', 180);
  const genesisRef = reference(options.genesisSeparatedWitnessRef, 'genesis separated witness reference');
  const sourceContext = contextFromOptions(options);
  const challengerPublicKeyPem = boundedString(options.challengerPublicKeyPem, 'configured challenger public key', 16384);
  const receiverPolicy = clone(options.receiverPolicy);

  function inspect() {
    if (!fs.existsSync(paths.namespace)) return null;
    const state = loadState(paths, logId, genesisRef, sourceContext);
    return state ? clone(state.snapshot) : null;
  }

  function record(input) {
    const validated = validateRecordInput(input);
    const currentSnapshot = Continuity.captureState({
      stateRoot: sourceStateRoot,
      receiverId: sourceContext.receiverId,
      challengerId: sourceContext.challengerId,
      challengerPublicKeyPem,
      receiverPolicy: clone(receiverPolicy),
      observationId: validated.observationId,
      observedAt: validated.observedAt
    });
    const currentnessAuditReceipt = Separation.buildSeparatedAudit({
      auditId: validated.auditId,
      checkedAt: validated.checkedAt,
      separationInput: clone(input.transitionInput.candidateSeparationInput),
      separationReceipt: clone(input.transitionInput.candidateSeparationReceipt),
      currentSnapshot: clone(currentSnapshot)
    });
    const evidence = { currentSnapshot, currentnessAuditReceipt };
    validateCurrentnessEvidence(input, evidence, validated);
    const manifest = prepare(paths, logId, genesisRef, sourceContext);
    const state = loadState(paths, logId, genesisRef, sourceContext);
    if (!sameReference(validated.transition.previousSeparatedWitnessRef, state.currentHead)) {
      fail('STALE_LOCAL_HEAD', 'v1.8 previous witness does not match exact current local head ' + state.currentHead.sha256);
    }
    const context = {
      manifest,
      sequence: state.entries.length + 1,
      previousEntryRef: state.entries.length ? entryRef(state.entries[state.entries.length - 1]) : null
    };
    const entry = buildEntry(input, evidence, context);
    const entryPath = path.join(paths.entries, sequenceFile(context.sequence));
    if (!writeExclusive(entryPath, entry, 'TRANSITION_LEDGER_ENTRY')) {
      const after = loadState(paths, logId, genesisRef, sourceContext);
      const existing = after.entries[context.sequence - 1];
      if (existing && existing.entryDigest === entry.entryDigest) fail('TRANSITION_ALREADY_RECORDED', 'exact transition entry is already recorded');
      if (!sameReference(after.currentHead, state.currentHead)) fail('STALE_LOCAL_HEAD', 'another local transition advanced the head first');
      fail('TRANSITION_LEDGER_SEQUENCE_CONFLICT', 'next local sequence entry exists with different content');
    }
    return { entry, currentnessEvidence: clone(evidence) };
  }

  function verifyPersisted(input, evidence, receipt) {
    const errors = [];
    let rebuilt = null;
    let stored = null;
    try {
      const state = loadState(paths, logId, genesisRef, sourceContext);
      if (!state) throw new Error('local transition ledger is absent');
      const candidate = clone(receipt);
      const sequence = candidate && candidate.log && candidate.log.sequence;
      if (!Number.isSafeInteger(sequence) || sequence < 1 || sequence > state.entries.length) throw new Error('persisted entry sequence is absent');
      stored = state.entries[sequence - 1];
      rebuilt = buildEntry(input, evidence, {
        manifest: state.manifest,
        sequence,
        previousEntryRef: sequence === 1 ? null : entryRef(state.entries[sequence - 2])
      });
      if (stableStringify(rebuilt) !== stableStringify(candidate)) throw new Error('presented entry does not exact-rebuild from the caller package');
      if (stableStringify(stored) !== stableStringify(rebuilt)) throw new Error('persisted entry does not match the exact rebuilt entry');
    } catch (error) { errors.push(error.message); }
    return { pass: errors.length === 0, errors, rebuilt, stored };
  }

  return Object.freeze({ logId, genesisSeparatedWitnessRef: clone(genesisRef), record, inspect, verifyPersisted });
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
  MAX_ARTIFACT_CANONICAL_BYTES,
  LocalTransitionLedgerError,
  stableStringify,
  sha256,
  buildManifest,
  buildEntry,
  validateStoredEntry,
  createService
};
