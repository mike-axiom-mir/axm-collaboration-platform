'use strict';

const fs = require('fs');
const path = require('path');
const PinTransition = require('../model-shadow-history-checkpoint-pin-transition/model-shadow-history-checkpoint-pin-transition');

const MANIFEST_SCHEMA = 'axm.model-shadow-two-phase-history-checkpoint-pin-settlement-ledger-manifest/v1';
const PROPOSAL_SCHEMA = 'axm.model-shadow-two-phase-history-checkpoint-pin-settlement-ledger-proposal/v1';
const SETTLEMENT_SCHEMA = 'axm.model-shadow-two-phase-history-checkpoint-pin-settlement-ledger-settlement/v1';
const SNAPSHOT_SCHEMA = 'axm.model-shadow-two-phase-history-checkpoint-pin-settlement-ledger-snapshot/v1';
const GENESIS_PACKAGE_SCHEMA = 'axm.model-shadow-two-phase-history-checkpoint-pin-settlement-ledger-genesis-package/v1';
const VERSION = '2.5.0';
const STATUS = 'TEST';
const NAMESPACE = 'model-shadow-history-checkpoint-pin-settlement-ledger';
const MANIFEST_FILE = 'ledger.json';
const PROPOSALS_DIRECTORY = 'proposals';
const SETTLEMENTS_DIRECTORY = 'settlements';
const LOCK_FILE = '.operation.lock';
const AUTHORITY_ORIGIN = 'CALLER_CONFIGURED_LOCAL_PIN_SETTLEMENT_LEDGER_UNAUTHENTICATED';
const STORAGE_MODE = 'LOCAL_EXCLUSIVE_CREATE_FILE_FSYNC_SETTLED_ONLY_HEAD';
const PROPOSE_CONFIRMATION = 'PROPOSE_LOCAL_PIN_SETTLEMENT_REVIEW_REQUIRED';
const SETTLE_CONFIRMATION = 'SETTLE_LOCAL_PIN_SETTLEMENT_DECLARED_UNAUTHENTICATED';
const SETTLEMENT_CLASSIFICATION = 'LOCAL_SUCCESSOR_PIN_SETTLED';
const MAX_RECORDS = 10000;
const MAX_ARTIFACT_CANONICAL_BYTES = 4194304;
const MAX_SERVICE_OPTIONS_CANONICAL_BYTES = 75497472;
const MAX_CALLER_INPUT_CANONICAL_BYTES = 152043520;
const SEQUENCE_FILE = /^(\d{12})\.json$/;

class PinSettlementLedgerError extends Error {
  constructor(code, message) { super(message); this.name = 'PinSettlementLedgerError'; this.code = code; }
}
function fail(code, message) { throw new PinSettlementLedgerError(code, message); }
function stableStringify(value) { return PinTransition.stableStringify(value); }
function sha256(value) { return PinTransition.sha256(value); }
function clone(value) { return JSON.parse(stableStringify(value)); }
function same(left, right) { return stableStringify(left) === stableStringify(right); }
function withoutField(value, field) { const result = clone(value); delete result[field]; return result; }
function bound(value, maximum, label) {
  let bytes;
  try { bytes = Buffer.byteLength(stableStringify(value)); }
  catch (error) { fail('STRICT_JSON_REQUIRED', label + ' must be strict canonical JSON: ' + error.message); }
  if (bytes > maximum) fail('RESOURCE_BOUND', label + ' exceeds ' + maximum + ' canonical bytes');
}
function exactKeys(value, allowed, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail('INVALID_SHAPE', label + ' must be an object');
  const actual = Object.keys(value).sort(); const expected = allowed.slice().sort();
  if (!same(actual, expected)) fail('INVALID_SHAPE', label + ' must contain exactly: ' + expected.join(', '));
}
function text(value, label, maximum) {
  if (typeof value !== 'string' || value.length < 1 || value.length > maximum || /[\u0000-\u001f\u007f]/.test(value)) {
    fail('INVALID_TEXT', label + ' must be bounded non-control text');
  }
  return value;
}
function digest(value, label) {
  if (typeof value !== 'string' || !/^sha256:[a-f0-9]{64}$/.test(value)) fail('INVALID_DIGEST', label + ' must be an exact SHA-256 digest');
  return value;
}
function timestamp(value, label) {
  text(value, label, 40);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) || !Number.isFinite(Date.parse(value))) {
    fail('INVALID_TIME', label + ' must be canonical UTC milliseconds');
  }
  return value;
}
function reference(value, label) {
  exactKeys(value, ['id', 'schema', 'sha256'], label);
  return { id: text(value.id, label + '.id', 180), schema: text(value.schema, label + '.schema', 180), sha256: digest(value.sha256, label + '.sha256') };
}
function sameReference(left, right) { return same(left, right); }
function pinRef(pin) { return { id: pin.pinId, schema: pin.schema, sha256: pin.pinDigest }; }
function manifestRef(value) { return { id: value.logId, schema: value.schema, sha256: value.manifestDigest }; }
function proposalRef(value) { return { id: value.proposalId, schema: value.schema, sha256: value.proposalDigest }; }
function settlementRef(value) { return { id: value.settlementId, schema: value.schema, sha256: value.settlementDigest }; }
function transitionRef(value) { return { id: value.transitionId, schema: value.schema, sha256: value.transitionDigest }; }
function sequenceFile(sequence) { return String(sequence).padStart(12, '0') + '.json'; }

function manifestTruth() {
  return {
    genesisPinExactRebuiltFromCallerPackageAtServiceOpen: true,
    manifestCanonicalAndSelfDigested: true,
    localExclusiveCreateIntended: true,
    localFileFsyncIntended: true,
    directoryEntryOrHardwareDurabilityProven: false,
    pinOriginAuthenticated: false,
    hostAuthorizationAuthenticated: false,
    authenticatedHumanReviewProven: false,
    externalRetentionProven: false,
    protectedMonotonicStateProven: false,
    deletionOrRollbackPrevented: false,
    globallyConsistentLogProven: false,
    automaticPromotion: false,
    automaticMerge: false,
    automaticCanon: false,
    foundationMutation: false
  };
}
function proposalTruth() {
  return {
    eligibleV24TransitionVerifiedByExactRebuild: true,
    successorPinValidated: true,
    proposalConfirmationObserved: true,
    proposalIsPendingOnly: true,
    localSettledHeadAdvanced: false,
    declaredConfirmationAuthenticatesHost: false,
    authenticatedHumanReviewProven: false,
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
    rawModelOutputEmbedded: false,
    privateContextEmbedded: false,
    automaticPromotion: false,
    automaticMerge: false,
    automaticCanon: false,
    foundationMutation: false
  };
}
function settlementTruth() {
  return {
    pendingProposalVerifiedAgainstCallerPackageAndStoredReceipt: true,
    separateSettlementConfirmationObserved: true,
    localSettledPinHeadAdvanced: true,
    advanceLimitedToConfiguredLocalLedger: true,
    declaredConfirmationAuthenticatesHost: false,
    authenticatedHumanReviewProven: false,
    externalRetentionProven: false,
    protectedMonotonicStateProven: false,
    deletionOrRollbackPrevented: false,
    globalTransitionUniquenessProven: false,
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
    rawModelOutputEmbedded: false,
    privateContextEmbedded: false,
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
    storedReceiptDigestChainsValidated: true,
    currentPinHeadDerivedOnlyFromSettlements: true,
    atMostOneTrailingPendingProposal: true,
    localFilesReloaded: true,
    callerPackagesRequiredForUpstreamExactReverification: true,
    localFilePersistenceObserved: true,
    directoryEntryOrHardwareDurabilityProven: false,
    externalRetentionProven: false,
    protectedMonotonicStateProven: false,
    deletionOrRollbackPrevented: false,
    independentRootsExcluded: false,
    globallyConsistentLogProven: false,
    hostAuthorizationAuthenticated: false,
    authenticatedHumanReviewProven: false,
    providerInvoked: false,
    humanBenefitProven: false,
    broadLearningClaimed: false,
    automaticPromotion: false,
    automaticMerge: false,
    automaticCanon: false,
    foundationMutation: false
  };
}

function genesisPackageDigest(input) { return sha256({ schema: GENESIS_PACKAGE_SCHEMA, input: clone(input) }); }
function buildManifest(logId, createdAt, genesisPinInput, genesisPin) {
  const verification = PinTransition.verifyGenesisPin(clone(genesisPinInput), clone(genesisPin));
  if (!verification.pass) fail('GENESIS_PIN_INVALID', 'genesis pin does not exact-rebuild: ' + verification.errors.join('; '));
  if (Date.parse(createdAt) < Date.parse(genesisPin.pinnedAt)) fail('MANIFEST_TIME_INVALID', 'manifest creation cannot predate genesis pin');
  const manifest = {
    schema: MANIFEST_SCHEMA,
    version: VERSION,
    status: STATUS,
    logId,
    createdAt,
    genesisPinRef: pinRef(genesisPin),
    genesisPackageDigest: genesisPackageDigest(genesisPinInput),
    authorityOrigin: AUTHORITY_ORIGIN,
    storageMode: STORAGE_MODE,
    maxRecords: MAX_RECORDS,
    state: 'CALLER_CONFIGURED_LOCAL_PIN_SETTLEMENT_LEDGER_AUTHORITY_PROTECTION_AND_EXTERNAL_RETENTION_NOT_PROVEN',
    truth: manifestTruth(),
    manifestDigest: null
  };
  manifest.manifestDigest = sha256(withoutField(manifest, 'manifestDigest'));
  bound(manifest, MAX_ARTIFACT_CANONICAL_BYTES, 'pin settlement manifest');
  return manifest;
}
function validateManifest(value, expected) {
  try {
    exactKeys(value, ['schema', 'version', 'status', 'logId', 'createdAt', 'genesisPinRef', 'genesisPackageDigest', 'authorityOrigin', 'storageMode', 'maxRecords', 'state', 'truth', 'manifestDigest'], 'pin settlement manifest');
    if (value.schema !== MANIFEST_SCHEMA || value.version !== VERSION || value.status !== STATUS) throw new Error('manifest identity mismatch');
    if (text(value.logId, 'stored log id', 180) !== expected.logId) fail('LOG_ID_MISMATCH', 'state root is bound to a different log id');
    timestamp(value.createdAt, 'stored manifest time');
    if (!sameReference(reference(value.genesisPinRef, 'stored genesis pin reference'), expected.genesisPinRef)) fail('GENESIS_PIN_MISMATCH', 'state root is bound to a different genesis pin');
    if (digest(value.genesisPackageDigest, 'stored genesis package digest') !== expected.genesisPackageDigest) fail('GENESIS_PACKAGE_MISMATCH', 'state root is bound to a different genesis package');
    if (value.authorityOrigin !== AUTHORITY_ORIGIN || value.storageMode !== STORAGE_MODE || value.maxRecords !== MAX_RECORDS) throw new Error('manifest storage boundary mismatch');
    if (value.state !== 'CALLER_CONFIGURED_LOCAL_PIN_SETTLEMENT_LEDGER_AUTHORITY_PROTECTION_AND_EXTERNAL_RETENTION_NOT_PROVEN') throw new Error('manifest state mismatch');
    if (!same(value.truth, manifestTruth())) throw new Error('manifest truth boundary mismatch');
    if (digest(value.manifestDigest, 'stored manifest digest') !== sha256(withoutField(value, 'manifestDigest'))) throw new Error('manifest digest mismatch');
    return clone(value);
  } catch (error) {
    if (error instanceof PinSettlementLedgerError) throw error;
    fail('PIN_LEDGER_MANIFEST_CORRUPT', 'pin settlement manifest is corrupt or boundary-invalid: ' + error.message);
  }
}

function validateProposalInput(input) {
  bound(input, MAX_CALLER_INPUT_CANONICAL_BYTES, 'pin settlement proposal input');
  exactKeys(input, ['proposalId', 'proposedAt', 'confirmation', 'transitionInput', 'transitionReceipt'], 'pin settlement proposal input');
  const proposalId = text(input.proposalId, 'pin settlement proposal id', 180);
  const proposedAt = timestamp(input.proposedAt, 'pin settlement proposal time');
  if (input.confirmation !== PROPOSE_CONFIRMATION) fail('PROPOSAL_CONFIRMATION_REQUIRED', 'exact proposal confirmation is required');
  const verification = PinTransition.verifyTransition(clone(input.transitionInput), clone(input.transitionReceipt));
  if (!verification.pass) fail('V24_TRANSITION_INVALID', 'v2.4 transition does not exact-rebuild: ' + verification.errors.join('; '));
  const transition = verification.rebuilt;
  const eligible = ['PIN_MATCH_PRESENTED_HISTORY_EXACT_RECHECKPOINT', 'PIN_MATCH_CANDIDATE_EXTENDS_PRESENTED_ANCHORED_HISTORY'].includes(transition.classification);
  if (!eligible || transition.decision.holdRequired || !transition.successorPinProposal) fail('V24_TRANSITION_INELIGIBLE', 'v2.4 transition has no eligible successor pin proposal');
  const successorPin = PinTransition.validatePin(clone(transition.successorPinProposal));
  if (Date.parse(proposedAt) < Date.parse(transition.comparedAt)) fail('PROPOSAL_TIME_INVALID', 'proposal time cannot predate v2.4 comparison');
  return { proposalId, proposedAt, transition, successorPin };
}
function buildProposal(input, context) {
  const validated = validateProposalInput(input);
  if (Date.parse(validated.proposedAt) < Date.parse(context.manifest.createdAt)) fail('PROPOSAL_TIME_INVALID', 'proposal time cannot predate local manifest creation');
  if (!sameReference(validated.transition.expectedPreviousPinRef, context.currentSettledPinRef)) fail('STALE_SETTLED_PIN_HEAD', 'v2.4 transition does not start at the current local settled pin head');
  const proposal = {
    schema: PROPOSAL_SCHEMA,
    version: VERSION,
    status: STATUS,
    proposalId: validated.proposalId,
    proposedAt: validated.proposedAt,
    log: { logId: context.manifest.logId, authorityOrigin: AUTHORITY_ORIGIN, storageMode: STORAGE_MODE, sequence: context.sequence },
    manifestRef: manifestRef(context.manifest),
    previousProposalRef: context.previousProposalRef ? clone(context.previousProposalRef) : null,
    previousSettledPinRef: clone(context.currentSettledPinRef),
    transitionRef: transitionRef(validated.transition),
    successorPinRef: pinRef(validated.successorPin),
    decision: { reviewRequired: true, pendingSettlement: true, settledHeadAdvanced: false, autonomousActionCount: 0 },
    state: 'ELIGIBLE_SUCCESSOR_PIN_PROPOSED_TO_LOCAL_LEDGER_SETTLED_HEAD_UNCHANGED',
    truth: proposalTruth(),
    proposalDigest: null
  };
  proposal.proposalDigest = sha256(withoutField(proposal, 'proposalDigest'));
  bound(proposal, MAX_ARTIFACT_CANONICAL_BYTES, 'pin settlement proposal receipt');
  return proposal;
}
function validateStoredProposal(value, context) {
  try {
    exactKeys(value, ['schema', 'version', 'status', 'proposalId', 'proposedAt', 'log', 'manifestRef', 'previousProposalRef', 'previousSettledPinRef', 'transitionRef', 'successorPinRef', 'decision', 'state', 'truth', 'proposalDigest'], 'stored pin proposal');
    if (value.schema !== PROPOSAL_SCHEMA || value.version !== VERSION || value.status !== STATUS) throw new Error('proposal identity mismatch');
    text(value.proposalId, 'stored proposal id', 180); timestamp(value.proposedAt, 'stored proposal time');
    if (Date.parse(value.proposedAt) < Date.parse(context.manifest.createdAt)) throw new Error('stored proposal predates manifest');
    exactKeys(value.log, ['logId', 'authorityOrigin', 'storageMode', 'sequence'], 'stored proposal log');
    if (value.log.logId !== context.manifest.logId || value.log.authorityOrigin !== AUTHORITY_ORIGIN || value.log.storageMode !== STORAGE_MODE || value.log.sequence !== context.sequence) throw new Error('proposal log mismatch');
    if (!sameReference(reference(value.manifestRef, 'stored proposal manifest reference'), manifestRef(context.manifest))) throw new Error('proposal manifest mismatch');
    const previousProposal = value.previousProposalRef === null ? null : reference(value.previousProposalRef, 'stored previous proposal reference');
    if (!same(previousProposal, context.previousProposalRef)) throw new Error('proposal predecessor mismatch');
    if (!sameReference(reference(value.previousSettledPinRef, 'stored previous pin reference'), context.currentSettledPinRef)) throw new Error('proposal previous settled pin mismatch');
    reference(value.transitionRef, 'stored transition reference'); reference(value.successorPinRef, 'stored successor pin reference');
    if (!same(value.decision, { reviewRequired: true, pendingSettlement: true, settledHeadAdvanced: false, autonomousActionCount: 0 })) throw new Error('proposal decision mismatch');
    if (value.state !== 'ELIGIBLE_SUCCESSOR_PIN_PROPOSED_TO_LOCAL_LEDGER_SETTLED_HEAD_UNCHANGED' || !same(value.truth, proposalTruth())) throw new Error('proposal truth or state mismatch');
    if (digest(value.proposalDigest, 'stored proposal digest') !== sha256(withoutField(value, 'proposalDigest'))) throw new Error('proposal digest mismatch');
    return clone(value);
  } catch (error) {
    fail('PIN_LEDGER_PROPOSAL_CORRUPT', 'stored proposal is corrupt or boundary-invalid: ' + error.message);
  }
}

function validateSettlementInput(input) {
  bound(input, MAX_CALLER_INPUT_CANONICAL_BYTES, 'pin settlement input');
  exactKeys(input, ['settlementId', 'settledAt', 'confirmation', 'proposalInput', 'proposalReceipt'], 'pin settlement input');
  const settlementId = text(input.settlementId, 'pin settlement id', 180);
  const settledAt = timestamp(input.settledAt, 'pin settlement time');
  if (input.confirmation !== SETTLE_CONFIRMATION) fail('SETTLEMENT_CONFIRMATION_REQUIRED', 'exact settlement confirmation is required');
  bound(input.proposalReceipt, MAX_ARTIFACT_CANONICAL_BYTES, 'presented pin proposal receipt');
  return { settlementId, settledAt };
}
function buildSettlement(input, proposal, manifest) {
  const validated = validateSettlementInput(input);
  if (!same(input.proposalReceipt, proposal)) fail('PROPOSAL_PACKAGE_MISMATCH', 'settlement proposal receipt does not match the exact proposal');
  if (Date.parse(validated.settledAt) < Date.parse(proposal.proposedAt)) fail('SETTLEMENT_TIME_INVALID', 'settlement time cannot predate proposal');
  const settlement = {
    schema: SETTLEMENT_SCHEMA,
    version: VERSION,
    status: STATUS,
    settlementId: validated.settlementId,
    settledAt: validated.settledAt,
    log: clone(proposal.log),
    manifestRef: manifestRef(manifest),
    proposalRef: proposalRef(proposal),
    previousSettledPinRef: clone(proposal.previousSettledPinRef),
    settledPinRef: clone(proposal.successorPinRef),
    classification: SETTLEMENT_CLASSIFICATION,
    decision: { localSettledHeadAdvanced: true, executionAuthorized: false, adoptionAuthorized: false, autonomousActionCount: 0 },
    state: 'DECLARED_SETTLEMENT_CONFIRMATION_RECORDED_LOCAL_PIN_HEAD_ADVANCED_AUTHORITY_AND_PROTECTION_NOT_PROVEN',
    truth: settlementTruth(),
    settlementDigest: null
  };
  settlement.settlementDigest = sha256(withoutField(settlement, 'settlementDigest'));
  bound(settlement, MAX_ARTIFACT_CANONICAL_BYTES, 'pin settlement receipt');
  return settlement;
}
function validateStoredSettlement(value, context) {
  try {
    exactKeys(value, ['schema', 'version', 'status', 'settlementId', 'settledAt', 'log', 'manifestRef', 'proposalRef', 'previousSettledPinRef', 'settledPinRef', 'classification', 'decision', 'state', 'truth', 'settlementDigest'], 'stored pin settlement');
    if (value.schema !== SETTLEMENT_SCHEMA || value.version !== VERSION || value.status !== STATUS) throw new Error('settlement identity mismatch');
    text(value.settlementId, 'stored settlement id', 180); timestamp(value.settledAt, 'stored settlement time');
    if (Date.parse(value.settledAt) < Date.parse(context.proposal.proposedAt)) throw new Error('stored settlement predates proposal');
    if (!same(value.log, context.proposal.log)) throw new Error('settlement log mismatch');
    if (!sameReference(reference(value.manifestRef, 'stored settlement manifest reference'), manifestRef(context.manifest))) throw new Error('settlement manifest mismatch');
    if (!sameReference(reference(value.proposalRef, 'stored settlement proposal reference'), proposalRef(context.proposal))) throw new Error('settlement proposal mismatch');
    if (!sameReference(reference(value.previousSettledPinRef, 'stored settlement previous pin reference'), context.proposal.previousSettledPinRef) || !sameReference(reference(value.settledPinRef, 'stored settled pin reference'), context.proposal.successorPinRef)) throw new Error('settlement pin binding mismatch');
    if (value.classification !== SETTLEMENT_CLASSIFICATION) throw new Error('settlement classification mismatch');
    if (!same(value.decision, { localSettledHeadAdvanced: true, executionAuthorized: false, adoptionAuthorized: false, autonomousActionCount: 0 })) throw new Error('settlement decision mismatch');
    if (value.state !== 'DECLARED_SETTLEMENT_CONFIRMATION_RECORDED_LOCAL_PIN_HEAD_ADVANCED_AUTHORITY_AND_PROTECTION_NOT_PROVEN' || !same(value.truth, settlementTruth())) throw new Error('settlement truth or state mismatch');
    if (digest(value.settlementDigest, 'stored settlement digest') !== sha256(withoutField(value, 'settlementDigest'))) throw new Error('settlement digest mismatch');
    return clone(value);
  } catch (error) {
    fail('PIN_LEDGER_SETTLEMENT_CORRUPT', 'stored settlement is corrupt or boundary-invalid: ' + error.message);
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
  const root = path.resolve(text(stateRoot, 'pin settlement ledger stateRoot', 32767));
  if (root === path.parse(root).root) fail('STATE_ROOT_INVALID', 'filesystem root cannot be a pin settlement ledger stateRoot');
  assertDirectoryNotLink(root, 'pin settlement ledger stateRoot');
  return { root, namespace: path.join(root, NAMESPACE), proposals: path.join(root, NAMESPACE, PROPOSALS_DIRECTORY), settlements: path.join(root, NAMESPACE, SETTLEMENTS_DIRECTORY) };
}
function readJsonFile(filePath, code, label) {
  let stat;
  try { stat = fs.lstatSync(filePath); } catch (error) { if (error.code === 'ENOENT') return null; fail(code, label + ' cannot be inspected: ' + error.message); }
  if (!stat.isFile() || stat.isSymbolicLink()) fail(code, label + ' must be a regular file and not a symbolic link');
  if (stat.size > MAX_ARTIFACT_CANONICAL_BYTES + 1) fail(code, label + ' exceeds the bounded canonical byte limit');
  try {
    const raw = fs.readFileSync(filePath, 'utf8'); const parsed = JSON.parse(raw);
    if (raw !== stableStringify(parsed) + '\n') fail(code, label + ' is not exact canonical JSON');
    return parsed;
  } catch (error) {
    if (error instanceof PinSettlementLedgerError) throw error;
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
function withOperationLock(paths, operation) {
  const lockPath = path.join(paths.namespace, LOCK_FILE);
  let descriptor;
  try { descriptor = fs.openSync(lockPath, 'wx', 0o600); }
  catch (error) {
    if (error.code === 'EEXIST') fail('PIN_LEDGER_BUSY', 'pin settlement ledger has an active or stale operation lock');
    fail('PIN_LEDGER_LOCK_FAILED', 'pin settlement ledger operation lock cannot be created: ' + error.message);
  }
  let result; let problem = null;
  try { fs.writeFileSync(descriptor, 'LOCKED\n', { encoding: 'utf8' }); fs.fsyncSync(descriptor); result = operation(); }
  catch (error) { problem = error; }
  try { fs.closeSync(descriptor); } catch (error) { if (!problem) problem = new PinSettlementLedgerError('PIN_LEDGER_LOCK_RELEASE_FAILED', 'operation lock cannot be closed: ' + error.message); }
  try { fs.unlinkSync(lockPath); } catch (error) { if (!problem) problem = new PinSettlementLedgerError('PIN_LEDGER_LOCK_RELEASE_FAILED', 'operation lock cannot be removed: ' + error.message); }
  if (problem) throw problem;
  return result;
}
function readManifest(filePath, expected) {
  const value = readJsonFile(filePath, 'PIN_LEDGER_MANIFEST_CORRUPT', 'pin settlement manifest');
  return value === null ? null : validateManifest(value, expected);
}
function ensureManifest(paths, expected, build) {
  const filePath = path.join(paths.namespace, MANIFEST_FILE);
  const existing = readManifest(filePath, expected);
  if (existing) return existing;
  const manifest = build();
  if (!writeExclusive(filePath, manifest, 'PIN_LEDGER_MANIFEST')) return readManifest(filePath, expected);
  return manifest;
}
function prepareUnderLock(paths, expected, build) {
  assertDirectoryNotLink(paths.namespace, 'pin settlement ledger namespace');
  const manifest = ensureManifest(paths, expected, build);
  createFixedDirectory(paths.proposals, 'pin settlement proposals directory');
  createFixedDirectory(paths.settlements, 'pin settlement settlements directory');
  return manifest;
}
function contiguousNames(directory, label) {
  if (!fs.existsSync(directory)) return [];
  assertDirectoryNotLink(directory, label);
  const names = fs.readdirSync(directory).sort();
  if (names.length > MAX_RECORDS) fail('PIN_LEDGER_RESOURCE_BOUND', label + ' exceeds record bound');
  names.forEach((name, index) => {
    const match = SEQUENCE_FILE.exec(name);
    if (!match || Number(match[1]) !== index + 1) fail('PIN_LEDGER_SEQUENCE_CORRUPT', label + ' filenames must be one contiguous 12-digit sequence');
  });
  return names;
}
function buildSnapshot(manifest, proposals, settlements, currentSettledPinRef, pendingProposal) {
  const snapshot = {
    schema: SNAPSHOT_SCHEMA,
    version: VERSION,
    status: STATUS,
    logId: manifest.logId,
    manifestRef: manifestRef(manifest),
    genesisPinRef: clone(manifest.genesisPinRef),
    currentSettledPinRef: clone(currentSettledPinRef),
    proposalCount: proposals.length,
    settlementCount: settlements.length,
    pendingProposalRef: pendingProposal ? proposalRef(pendingProposal) : null,
    lastProposalRef: proposals.length ? proposalRef(proposals[proposals.length - 1]) : null,
    lastSettlementRef: settlements.length ? settlementRef(settlements[settlements.length - 1]) : null,
    state: pendingProposal ? 'LOCAL_PIN_LEDGER_RELOADED_ONE_PROPOSAL_PENDING_SETTLEMENT' : 'LOCAL_PIN_LEDGER_RELOADED_NO_PENDING_PROPOSAL',
    truth: snapshotTruth(),
    snapshotDigest: null
  };
  snapshot.snapshotDigest = sha256(withoutField(snapshot, 'snapshotDigest'));
  bound(snapshot, MAX_ARTIFACT_CANONICAL_BYTES, 'pin settlement ledger snapshot');
  return snapshot;
}
function loadState(paths, expected) {
  assertDirectoryNotLink(paths.namespace, 'pin settlement ledger namespace');
  const items = fs.readdirSync(paths.namespace).sort();
  const unexpected = items.filter(name => ![MANIFEST_FILE, PROPOSALS_DIRECTORY, SETTLEMENTS_DIRECTORY, LOCK_FILE].includes(name));
  if (unexpected.length) fail('PIN_LEDGER_NAMESPACE_CORRUPT', 'unexpected pin settlement namespace items: ' + unexpected.join(', '));
  const manifest = readManifest(path.join(paths.namespace, MANIFEST_FILE), expected);
  if (!manifest) fail('PIN_LEDGER_MANIFEST_MISSING', 'pin settlement namespace has no manifest');
  const proposalNames = contiguousNames(paths.proposals, 'pin proposal directory');
  const settlementNames = contiguousNames(paths.settlements, 'pin settlement directory');
  if (settlementNames.length > proposalNames.length || proposalNames.length - settlementNames.length > 1) fail('PIN_LEDGER_SEQUENCE_CORRUPT', 'settlements must cover every proposal except at most one trailing pending proposal');
  const proposals = []; const settlements = []; const headBeforeProposal = [];
  let currentSettledPinRef = clone(manifest.genesisPinRef); let previousProposalRef = null;
  proposalNames.forEach((name, index) => {
    headBeforeProposal.push(clone(currentSettledPinRef));
    const proposal = validateStoredProposal(readJsonFile(path.join(paths.proposals, name), 'PIN_LEDGER_PROPOSAL_CORRUPT', 'proposal ' + name), {
      manifest, sequence: index + 1, previousProposalRef, currentSettledPinRef
    });
    proposals.push(proposal); previousProposalRef = proposalRef(proposal);
    if (index < settlementNames.length) {
      const settlement = validateStoredSettlement(readJsonFile(path.join(paths.settlements, settlementNames[index]), 'PIN_LEDGER_SETTLEMENT_CORRUPT', 'settlement ' + settlementNames[index]), { manifest, proposal });
      settlements.push(settlement); currentSettledPinRef = clone(settlement.settledPinRef);
    }
  });
  const pendingProposal = proposals.length > settlements.length ? proposals[proposals.length - 1] : null;
  return { manifest, proposals, settlements, headBeforeProposal, currentSettledPinRef, pendingProposal, snapshot: buildSnapshot(manifest, proposals, settlements, currentSettledPinRef, pendingProposal) };
}

function createService(options) {
  bound(options, MAX_SERVICE_OPTIONS_CANONICAL_BYTES, 'pin settlement service options');
  exactKeys(options, ['stateRoot', 'logId', 'createdAt', 'genesisPinInput', 'genesisPin'], 'pin settlement service options');
  const paths = resolvePaths(options.stateRoot);
  const logId = text(options.logId, 'pin settlement log id', 180);
  const createdAt = timestamp(options.createdAt, 'pin settlement manifest creation time');
  const genesisVerification = PinTransition.verifyGenesisPin(clone(options.genesisPinInput), clone(options.genesisPin));
  if (!genesisVerification.pass) fail('GENESIS_PIN_INVALID', 'configured genesis pin does not exact-rebuild: ' + genesisVerification.errors.join('; '));
  const genesisPin = genesisVerification.rebuilt;
  const configuredManifest = buildManifest(logId, createdAt, options.genesisPinInput, genesisPin);
  const expected = { logId, genesisPinRef: clone(configuredManifest.genesisPinRef), genesisPackageDigest: configuredManifest.genesisPackageDigest };
  const manifestBuilder = () => clone(configuredManifest);

  function inspect() {
    if (!fs.existsSync(paths.namespace)) return null;
    return withOperationLock(paths, () => clone(loadState(paths, expected).snapshot));
  }
  function proposalContext(state, sequence) {
    return { manifest: state.manifest, sequence, previousProposalRef: sequence === 1 ? null : proposalRef(state.proposals[sequence - 2]), currentSettledPinRef: clone(state.headBeforeProposal[sequence - 1]) };
  }
  function verifyProposalPackage(state, input, receipt) {
    const candidate = clone(receipt);
    const sequence = candidate && candidate.log && candidate.log.sequence;
    if (!Number.isSafeInteger(sequence) || sequence < 1 || sequence > state.proposals.length) fail('PROPOSAL_PACKAGE_MISMATCH', 'proposal sequence is absent');
    const rebuilt = buildProposal(input, proposalContext(state, sequence));
    const stored = state.proposals[sequence - 1];
    if (!same(rebuilt, candidate) || !same(stored, rebuilt)) fail('PROPOSAL_PACKAGE_MISMATCH', 'proposal does not exact-rebuild from caller package or match stored receipt');
    return { rebuilt, stored, sequence };
  }
  function propose(input) {
    const validated = validateProposalInput(input);
    createFixedDirectory(paths.namespace, 'pin settlement ledger namespace');
    return withOperationLock(paths, () => {
      const manifest = prepareUnderLock(paths, expected, manifestBuilder);
      const state = loadState(paths, expected);
      if (state.pendingProposal) fail('PENDING_SETTLEMENT', 'the trailing pin proposal must be settled before another proposal');
      if (!sameReference(validated.transition.expectedPreviousPinRef, state.currentSettledPinRef)) fail('STALE_SETTLED_PIN_HEAD', 'v2.4 transition does not start at current local settled pin head');
      const sequence = state.proposals.length + 1;
      if (sequence > MAX_RECORDS) fail('PIN_LEDGER_RESOURCE_BOUND', 'pin proposal sequence exceeds record bound');
      const proposal = buildProposal(input, { manifest, sequence, previousProposalRef: state.proposals.length ? proposalRef(state.proposals[state.proposals.length - 1]) : null, currentSettledPinRef: state.currentSettledPinRef });
      const filePath = path.join(paths.proposals, sequenceFile(sequence));
      if (!writeExclusive(filePath, proposal, 'PIN_LEDGER_PROPOSAL')) fail('PIN_LEDGER_SEQUENCE_CONFLICT', 'next proposal sequence already exists');
      return clone(proposal);
    });
  }
  function settle(input) {
    validateSettlementInput(input);
    if (!fs.existsSync(paths.namespace)) fail('NO_PENDING_PROPOSAL', 'pin settlement ledger is absent');
    return withOperationLock(paths, () => {
      const state = loadState(paths, expected);
      if (!state.pendingProposal) fail('NO_PENDING_PROPOSAL', 'there is no trailing pin proposal');
      const proposalResult = verifyProposalPackage(state, input.proposalInput, input.proposalReceipt);
      if (proposalResult.sequence !== state.proposals.length) fail('PROPOSAL_PACKAGE_MISMATCH', 'caller package is not the trailing pending proposal');
      const settlement = buildSettlement(input, proposalResult.rebuilt, state.manifest);
      const filePath = path.join(paths.settlements, sequenceFile(proposalResult.sequence));
      if (!writeExclusive(filePath, settlement, 'PIN_LEDGER_SETTLEMENT')) fail('PIN_LEDGER_SEQUENCE_CONFLICT', 'matching settlement sequence already exists');
      return clone(settlement);
    });
  }
  function verifyProposalPersisted(input, receipt) {
    const errors = []; let rebuilt = null; let stored = null;
    try { const result = withOperationLock(paths, () => { const state = loadState(paths, expected); return verifyProposalPackage(state, input, receipt); }); rebuilt = result.rebuilt; stored = result.stored; }
    catch (error) { errors.push(error.message); }
    return { pass: errors.length === 0, errors, rebuilt, stored };
  }
  function verifySettlementPersisted(input, receipt) {
    const errors = []; let rebuilt = null; let stored = null;
    try {
      validateSettlementInput(input);
      const result = withOperationLock(paths, () => {
        const state = loadState(paths, expected); const candidate = clone(receipt); const sequence = candidate && candidate.log && candidate.log.sequence;
        if (!Number.isSafeInteger(sequence) || sequence < 1 || sequence > state.settlements.length) throw new Error('settlement sequence is absent');
        const proposalResult = verifyProposalPackage(state, input.proposalInput, input.proposalReceipt);
        if (proposalResult.sequence !== sequence) throw new Error('settlement proposal sequence mismatch');
        const exactSettlement = buildSettlement(input, proposalResult.rebuilt, state.manifest); const storedSettlement = state.settlements[sequence - 1];
        if (!same(exactSettlement, candidate) || !same(storedSettlement, exactSettlement)) throw new Error('settlement does not exact-rebuild from caller package or match stored receipt');
        return { exactSettlement, storedSettlement };
      });
      rebuilt = result.exactSettlement; stored = result.storedSettlement;
    } catch (error) { errors.push(error.message); }
    return { pass: errors.length === 0, errors, rebuilt, stored };
  }
  return Object.freeze({ logId, genesisPinRef: pinRef(genesisPin), propose, settle, inspect, verifyProposalPersisted, verifySettlementPersisted });
}

module.exports = {
  MANIFEST_SCHEMA,
  PROPOSAL_SCHEMA,
  SETTLEMENT_SCHEMA,
  SNAPSHOT_SCHEMA,
  VERSION,
  STATUS,
  NAMESPACE,
  LOCK_FILE,
  AUTHORITY_ORIGIN,
  STORAGE_MODE,
  PROPOSE_CONFIRMATION,
  SETTLE_CONFIRMATION,
  SETTLEMENT_CLASSIFICATION,
  MAX_RECORDS,
  MAX_ARTIFACT_CANONICAL_BYTES,
  MAX_SERVICE_OPTIONS_CANONICAL_BYTES,
  MAX_CALLER_INPUT_CANONICAL_BYTES,
  PinSettlementLedgerError,
  stableStringify,
  sha256,
  buildManifest,
  buildProposal,
  buildSettlement,
  createService
};
