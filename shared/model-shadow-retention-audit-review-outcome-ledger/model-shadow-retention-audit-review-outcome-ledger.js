'use strict';

const fs = require('fs');
const path = require('path');
const V31 = require('../model-shadow-retention-audit-review-outcome/model-shadow-retention-audit-review-outcome');

const MANIFEST_SCHEMA = 'axm.model-shadow-retention-audit-review-outcome-ledger-manifest/v1';
const RECORD_SCHEMA = 'axm.model-shadow-retention-audit-review-outcome-ledger-record/v1';
const SNAPSHOT_SCHEMA = 'axm.model-shadow-retention-audit-review-outcome-ledger-snapshot/v1';
const VERSION = '3.2.0';
const STATUS = 'TEST';
const NAMESPACE = 'model-shadow-retention-audit-review-outcome-ledger';
const MANIFEST_FILE = 'manifest.json';
const RECORDS_DIRECTORY = 'records';
const LOCK_FILE = '.operation.lock';
const MODE = 'CALLER_OWNED_LOCAL_REVIEW_OUTCOME_CONTINUITY_UNAUTHENTICATED';
const STORAGE_MODE = 'CANONICAL_JSON_EXCLUSIVE_CREATE_FILE_FSYNC_APPEND_ONLY';
const CAPTURE_CONFIRMATION = 'RECORD_LOCAL_RETENTION_AUDIT_REVIEW_OUTCOME_UNAUTHENTICATED';
const CLASSIFICATIONS = Object.freeze({
  APPROVED: 'APPROVED_OUTCOME_PRESERVED_RETENTION_HOLD_UNRESOLVED',
  HOLD: 'HOLD_OUTCOME_PRESERVED_RETENTION_HOLD_UNRESOLVED',
  REJECTED: 'REJECTED_OUTCOME_PRESERVED_RETENTION_HOLD_UNRESOLVED'
});
const MAX_RECORDS = 10000;
const MAX_ARTIFACT_CANONICAL_BYTES = 4194304;
const MAX_AGGREGATE_STORAGE_BYTES = 268435456;
const MAX_SERVICE_OPTIONS_CANONICAL_BYTES = 1048576;
const MAX_CAPTURE_INPUT_CANONICAL_BYTES = 41943040;

class RetentionAuditReviewOutcomeLedgerError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'RetentionAuditReviewOutcomeLedgerError';
    this.code = code;
  }
}

function fail(code, message) { throw new RetentionAuditReviewOutcomeLedgerError(code, message); }
function clone(value) { return JSON.parse(JSON.stringify(value)); }
function stableStringify(value) { return V31.stableStringify(value); }
function sha256(value) { return V31.sha256(value); }
function same(left, right) { return stableStringify(left) === stableStringify(right); }
function withoutField(value, field) { const result = clone(value); delete result[field]; return result; }
function isObject(value) { return Boolean(value) && typeof value === 'object' && !Array.isArray(value); }

function exactKeys(value, keys, code, label) {
  if (!isObject(value)) fail(code, label + ' must be an object');
  const actual = Object.keys(value).sort();
  const expected = keys.slice().sort();
  if (!same(actual, expected)) fail(code, label + ' keys must be exactly: ' + expected.join(', '));
}

function text(value, code, label, maximum) {
  if (typeof value !== 'string' || value.length < 1 || value.length > maximum) fail(code, label + ' is invalid');
  return value;
}

function timestamp(value, code, label) {
  text(value, code, label, 32);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) fail(code, label + ' must be canonical UTC milliseconds');
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== value) fail(code, label + ' is invalid');
  return value;
}

function digest(value, code, label) {
  if (typeof value !== 'string' || !/^sha256:[a-f0-9]{64}$/.test(value)) fail(code, label + ' is invalid');
  return value;
}

function reference(value, code, label) {
  exactKeys(value, ['id', 'schema', 'sha256'], code, label);
  text(value.id, code, label + ' id', 180);
  text(value.schema, code, label + ' schema', 180);
  digest(value.sha256, code, label + ' digest');
  return clone(value);
}

function bound(value, maximum, code, label) {
  let bytes;
  try { bytes = Buffer.byteLength(stableStringify(value), 'utf8'); }
  catch (error) { fail(code, label + ' is not canonicalizable: ' + error.message); }
  if (bytes > maximum) fail(code, label + ' exceeds ' + maximum + ' canonical bytes');
  return bytes;
}

function sequenceName(sequence) { return String(sequence).padStart(12, '0') + '.json'; }

function assertDirectoryNotLink(target, code, label) {
  let stat;
  try { stat = fs.lstatSync(target); }
  catch (error) { fail(code, label + ' must already exist'); }
  if (!stat.isDirectory() || stat.isSymbolicLink()) fail(code, label + ' must be a real directory, not a link');
  let real;
  try { real = fs.realpathSync.native(target); }
  catch (error) { fail(code, label + ' cannot be resolved'); }
  return path.resolve(real);
}

function resolvedRoot(value, code, label) {
  const result = path.resolve(text(value, code, label, 32767));
  if (result === path.parse(result).root) fail(code, label + ' cannot be a filesystem root');
  return assertDirectoryNotLink(result, code, label);
}

function pathKey(value) { return process.platform === 'win32' ? value.toLowerCase() : value; }
function rootsOverlap(left, right) {
  const leftKey = pathKey(left);
  const rightKey = pathKey(right);
  return leftKey === rightKey || leftKey.startsWith(rightKey + path.sep) || rightKey.startsWith(leftKey + path.sep);
}

function upstreamObservationRoot(outcomeInput) {
  const options = outcomeInput && outcomeInput.pendingHandoffInput && outcomeInput.pendingHandoffInput.requestInput && outcomeInput.pendingHandoffInput.requestInput.observationServiceOptions;
  if (!isObject(options) || typeof options.stateRoot !== 'string') {
    fail('REVIEW_OUTCOME_LEDGER_ROOT_INVALID', 'v3.1 caller package must identify its upstream v2.8 observation root');
  }
  return resolvedRoot(options.stateRoot, 'REVIEW_OUTCOME_LEDGER_ROOT_INVALID', 'upstream v2.8 observation root');
}

function assertDistinctRoots(ledgerRoot, outcomeInput) {
  const upstreamRoot = upstreamObservationRoot(outcomeInput);
  if (rootsOverlap(ledgerRoot, upstreamRoot)) {
    fail('REVIEW_OUTCOME_LEDGER_ROOT_OVERLAP', 'outcome ledger and upstream v2.8 observation roots must be distinct and nonnested');
  }
  return upstreamRoot;
}

function resolvePaths(stateRoot) {
  const root = resolvedRoot(stateRoot, 'REVIEW_OUTCOME_LEDGER_STATE_ROOT_INVALID', 'outcome ledger state root');
  const namespace = path.join(root, NAMESPACE);
  return {
    root,
    namespace,
    manifest: path.join(namespace, MANIFEST_FILE),
    records: path.join(namespace, RECORDS_DIRECTORY),
    lock: path.join(namespace, LOCK_FILE)
  };
}

function ensureDirectory(target, code, label) {
  if (!fs.existsSync(target)) {
    try { fs.mkdirSync(target, { mode: 0o700 }); }
    catch (error) {
      if (!fs.existsSync(target)) fail(code, label + ' cannot be created: ' + error.message);
    }
  }
  assertDirectoryNotLink(target, code, label);
}

function ensureNamespace(paths) {
  ensureDirectory(paths.namespace, 'REVIEW_OUTCOME_LEDGER_NAMESPACE_CORRUPT', 'outcome ledger namespace');
  ensureDirectory(paths.records, 'REVIEW_OUTCOME_LEDGER_NAMESPACE_CORRUPT', 'outcome ledger records directory');
}

function withOperationLock(paths, operation) {
  let descriptor;
  try {
    descriptor = fs.openSync(paths.lock, 'wx', 0o600);
    fs.writeFileSync(descriptor, stableStringify({ schema: 'axm.local-operation-lock/v1', pid: process.pid }) + '\n', 'utf8');
    fs.fsyncSync(descriptor);
  } catch (error) {
    if (descriptor !== undefined) { try { fs.closeSync(descriptor); } catch (_) {} }
    fail('REVIEW_OUTCOME_LEDGER_BUSY', 'outcome ledger operation lock already exists or cannot be created');
  }
  try { return operation(); }
  finally {
    try { fs.closeSync(descriptor); } catch (_) {}
    try { fs.rmSync(paths.lock, { force: true }); } catch (_) {}
  }
}

function writeExclusiveFsync(filePath, value, code, label) {
  const payload = stableStringify(value) + '\n';
  let descriptor;
  try {
    descriptor = fs.openSync(filePath, 'wx', 0o600);
    fs.writeFileSync(descriptor, payload, 'utf8');
    fs.fsyncSync(descriptor);
    fs.closeSync(descriptor);
    descriptor = undefined;
  } catch (error) {
    if (descriptor !== undefined) { try { fs.closeSync(descriptor); } catch (_) {} }
    fail(code, label + ' exclusive-create file-fsync write failed: ' + error.message);
  }
}

function readCanonicalFile(filePath, maximum, code, label) {
  let stat;
  let payload;
  try {
    stat = fs.lstatSync(filePath);
    if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('not a regular file');
    if (stat.size > maximum + 1) throw new Error('file exceeds byte bound');
    payload = fs.readFileSync(filePath, 'utf8');
  } catch (error) { fail(code, label + ' cannot be read: ' + error.message); }
  let value;
  try { value = JSON.parse(payload); }
  catch (error) { fail(code, label + ' is not JSON: ' + error.message); }
  if (payload !== stableStringify(value) + '\n') fail(code, label + ' is not exact canonical JSON with one trailing newline');
  bound(value, maximum, code, label);
  return { value, bytes: stat.size };
}

function manifestTruth() {
  return {
    callerOwnedLocalLedgerRoot: true,
    manifestExclusiveCreateAndFileFsyncCompleted: true,
    appendOnlyRecordIntent: true,
    directoryEntryOrHardwareDurabilityProven: false,
    externalRetentionProven: false,
    protectedMonotonicStateProven: false,
    localControllerFullRewriteExcluded: false,
    hostAuthorizationAuthenticated: false,
    actorRealWorldIdentityProven: false,
    actualHumanParticipationProven: false,
    timeExternallyTrusted: false,
    holdResolved: false,
    executionAuthorized: false,
    adoptionAuthorized: false,
    automaticPromotion: false,
    automaticMerge: false,
    automaticCanon: false,
    foundationMutation: false
  };
}

function recordTruth() {
  return {
    v31OutcomeExactRebuiltBeforeWrite: true,
    actorDigestProvenanceExactRebuiltBeforeWrite: true,
    completeMinimizedV31OutcomePersisted: true,
    completeV31InputPersisted: false,
    rawReviewItemPersisted: false,
    rawActorIdentityPersisted: false,
    voteNotesPersisted: false,
    reviewDiscussionPersisted: false,
    configuredPathPersisted: false,
    recordExclusiveCreateAndFileFsyncCompleted: true,
    ledgerRootDistinctAndNonnestedFromUpstreamObservationRoot: true,
    completePriorRecordChainValidated: true,
    upstreamPresentationRequiredForReload: false,
    actorDigestProvenanceReverifiedOnReload: false,
    historicalExactRebuildClaimBoundToRecordDigest: true,
    callerPresentedReviewOutcomeNotLiveHostObservation: true,
    transientV28OperationLockMayBeWrittenDuringCapture: true,
    durableUpstreamStateChangedByModule: false,
    continuousReviewInboxMonitoringPerformed: false,
    directoryEntryOrHardwareDurabilityProven: false,
    externalRetentionProven: false,
    protectedMonotonicStateProven: false,
    deletionOrRollbackPrevented: false,
    localControllerFullRewriteExcluded: false,
    withheldOrJointlyReplacedRootsExcluded: false,
    globalTransitionUniquenessProven: false,
    globallyConsistentLogProven: false,
    hostAuthorizationAuthenticated: false,
    actorRealWorldIdentityProven: false,
    actualHumanParticipationProven: false,
    authenticatedStewardRemediationDecisionProven: false,
    timeExternallyTrusted: false,
    holdResolved: false,
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

function snapshotTruth() {
  return {
    manifestReloaded: true,
    completeRecordChainValidated: true,
    fullMinimizedV31OutcomesReloadedWithoutCaptureInputs: true,
    upstreamPresentationRequiredForReload: false,
    actorDigestProvenanceReverifiedOnReload: false,
    currentReviewInboxStateContinuouslyObserved: false,
    callerOwnedLocalLedgerRoot: true,
    directoryEntryOrHardwareDurabilityProven: false,
    externalRetentionProven: false,
    protectedMonotonicStateProven: false,
    deletionOrRollbackPrevented: false,
    localControllerFullRewriteExcluded: false,
    jointUpstreamAndLedgerLossExcluded: false,
    hostAuthorizationAuthenticated: false,
    actorRealWorldIdentityProven: false,
    actualHumanParticipationProven: false,
    holdResolved: false,
    providerInvoked: false,
    evaluationPerformed: false,
    executionAuthorized: false,
    adoptionAuthorized: false,
    humanBenefitProven: false,
    broadLearningClaimed: false,
    autonomousActionCount: 0,
    automaticPromotion: false,
    automaticMerge: false,
    automaticCanon: false,
    foundationMutation: false
  };
}

function buildManifest(ledgerId, createdAt) {
  const result = {
    schema: MANIFEST_SCHEMA,
    version: VERSION,
    status: STATUS,
    ledgerId,
    createdAt,
    mode: MODE,
    storageMode: STORAGE_MODE,
    truth: manifestTruth(),
    manifestDigest: null
  };
  result.manifestDigest = sha256(withoutField(result, 'manifestDigest'));
  bound(result, MAX_ARTIFACT_CANONICAL_BYTES, 'REVIEW_OUTCOME_LEDGER_MANIFEST_TOO_LARGE', 'outcome ledger manifest');
  return result;
}

function manifestRef(manifest) { return { id: manifest.ledgerId, schema: manifest.schema, sha256: manifest.manifestDigest }; }
function recordRef(record) { return { id: record.recordId, schema: record.schema, sha256: record.recordDigest }; }
function outcomeRef(outcome) { return { id: outcome.outcomeId, schema: outcome.schema, sha256: outcome.outcomeDigest }; }

function validateManifest(value, expected) {
  try {
    exactKeys(value, ['schema', 'version', 'status', 'ledgerId', 'createdAt', 'mode', 'storageMode', 'truth', 'manifestDigest'], 'REVIEW_OUTCOME_LEDGER_MANIFEST_CORRUPT', 'stored outcome ledger manifest');
    if (value.schema !== MANIFEST_SCHEMA || value.version !== VERSION || value.status !== STATUS || value.mode !== MODE || value.storageMode !== STORAGE_MODE) throw new Error('manifest identity mismatch');
    text(value.ledgerId, 'REVIEW_OUTCOME_LEDGER_MANIFEST_CORRUPT', 'stored ledger id', 180);
    timestamp(value.createdAt, 'REVIEW_OUTCOME_LEDGER_MANIFEST_CORRUPT', 'stored ledger creation time');
    if (value.ledgerId !== expected.ledgerId || value.createdAt !== expected.createdAt) throw new Error('manifest does not match configured identity');
    if (!same(value.truth, manifestTruth())) throw new Error('manifest truth boundary mismatch');
    if (digest(value.manifestDigest, 'REVIEW_OUTCOME_LEDGER_MANIFEST_CORRUPT', 'stored manifest digest') !== sha256(withoutField(value, 'manifestDigest'))) throw new Error('manifest digest mismatch');
    return clone(value);
  } catch (error) {
    if (error instanceof RetentionAuditReviewOutcomeLedgerError && error.code === 'REVIEW_OUTCOME_LEDGER_MANIFEST_CORRUPT') throw error;
    fail('REVIEW_OUTCOME_LEDGER_MANIFEST_CORRUPT', 'stored outcome ledger manifest is corrupt: ' + error.message);
  }
}

function classificationFor(outcome) { return CLASSIFICATIONS[outcome.reviewOutcome.state]; }
function decisionFor(outcome) {
  return {
    reviewState: outcome.reviewOutcome.state,
    outcomeState: outcome.state,
    retentionHoldUnresolved: true,
    observationOnly: true,
    bestAction: outcome.nextGate,
    autonomousActionCount: 0
  };
}

function buildRecord(input, outcome, context) {
  const result = {
    schema: RECORD_SCHEMA,
    version: VERSION,
    status: STATUS,
    recordId: input.recordId,
    recordedAt: input.recordedAt,
    mode: MODE,
    log: {
      manifestRef: manifestRef(context.manifest),
      sequence: context.sequence,
      previousRecordRef: context.previousRecord ? recordRef(context.previousRecord) : null
    },
    outcomeRef: outcomeRef(outcome),
    classification: classificationFor(outcome),
    outcome: clone(outcome),
    decision: decisionFor(outcome),
    truth: recordTruth(),
    recordDigest: null
  };
  result.recordDigest = sha256(withoutField(result, 'recordDigest'));
  bound(result, MAX_ARTIFACT_CANONICAL_BYTES, 'REVIEW_OUTCOME_LEDGER_RECORD_TOO_LARGE', 'outcome ledger record');
  return result;
}

function validateRecord(value, context) {
  try {
    bound(value, MAX_ARTIFACT_CANONICAL_BYTES, 'REVIEW_OUTCOME_LEDGER_RECORD_CORRUPT', 'stored outcome ledger record');
    exactKeys(value, ['schema', 'version', 'status', 'recordId', 'recordedAt', 'mode', 'log', 'outcomeRef', 'classification', 'outcome', 'decision', 'truth', 'recordDigest'], 'REVIEW_OUTCOME_LEDGER_RECORD_CORRUPT', 'stored outcome ledger record');
    if (value.schema !== RECORD_SCHEMA || value.version !== VERSION || value.status !== STATUS || value.mode !== MODE) throw new Error('record identity mismatch');
    text(value.recordId, 'REVIEW_OUTCOME_LEDGER_RECORD_CORRUPT', 'stored record id', 180);
    timestamp(value.recordedAt, 'REVIEW_OUTCOME_LEDGER_RECORD_CORRUPT', 'stored record time');
    exactKeys(value.log, ['manifestRef', 'sequence', 'previousRecordRef'], 'REVIEW_OUTCOME_LEDGER_RECORD_CORRUPT', 'stored record log binding');
    reference(value.log.manifestRef, 'REVIEW_OUTCOME_LEDGER_RECORD_CORRUPT', 'stored manifest reference');
    if (!Number.isSafeInteger(value.log.sequence) || value.log.sequence !== context.sequence || value.log.sequence < 1 || value.log.sequence > MAX_RECORDS) throw new Error('record sequence mismatch or outside bound');
    const expectedPrevious = context.previousRecord ? recordRef(context.previousRecord) : null;
    if (value.log.previousRecordRef !== null) reference(value.log.previousRecordRef, 'REVIEW_OUTCOME_LEDGER_RECORD_CORRUPT', 'stored previous record reference');
    if (!same(value.log.previousRecordRef, expectedPrevious)) throw new Error('previous record chain mismatch');
    if (!same(value.log.manifestRef, manifestRef(context.manifest))) throw new Error('record manifest binding mismatch');
    reference(value.outcomeRef, 'REVIEW_OUTCOME_LEDGER_RECORD_CORRUPT', 'stored outcome reference');
    const outcome = V31.validateOutcome(value.outcome);
    if (!same(value.outcomeRef, outcomeRef(outcome))) throw new Error('outcome reference mismatch');
    if (Date.parse(value.recordedAt) < Date.parse(outcome.observedAt)) throw new Error('record predates v3.1 outcome');
    if (Date.parse(value.recordedAt) < Date.parse(context.manifest.createdAt)) throw new Error('record predates ledger manifest');
    if (context.previousRecord && Date.parse(value.recordedAt) <= Date.parse(context.previousRecord.recordedAt)) throw new Error('record time is not strictly forward');
    if (value.classification !== classificationFor(outcome)) throw new Error('record classification mismatch');
    if (!same(value.decision, decisionFor(outcome))) throw new Error('record decision mismatch');
    if (!same(value.truth, recordTruth())) throw new Error('record truth boundary mismatch');
    if (digest(value.recordDigest, 'REVIEW_OUTCOME_LEDGER_RECORD_CORRUPT', 'stored record digest') !== sha256(withoutField(value, 'recordDigest'))) throw new Error('record digest mismatch');
    return clone(value);
  } catch (error) {
    if (error instanceof RetentionAuditReviewOutcomeLedgerError && error.code === 'REVIEW_OUTCOME_LEDGER_RECORD_CORRUPT') throw error;
    fail('REVIEW_OUTCOME_LEDGER_RECORD_CORRUPT', 'stored outcome ledger record is corrupt: ' + error.message);
  }
}

function buildSnapshot(manifest, records, aggregateBytes) {
  const latest = records.length ? records[records.length - 1] : null;
  const result = {
    schema: SNAPSHOT_SCHEMA,
    version: VERSION,
    status: STATUS,
    ledgerId: manifest.ledgerId,
    mode: MODE,
    manifestRef: manifestRef(manifest),
    recordCount: records.length,
    approvedCount: records.filter(item => item.outcome.reviewOutcome.state === 'APPROVED').length,
    holdCount: records.filter(item => item.outcome.reviewOutcome.state === 'HOLD').length,
    rejectedCount: records.filter(item => item.outcome.reviewOutcome.state === 'REJECTED').length,
    latestRecordRef: latest ? recordRef(latest) : null,
    latestOutcomeRef: latest ? clone(latest.outcomeRef) : null,
    latestClassification: latest ? latest.classification : null,
    aggregateStorageBytes: aggregateBytes,
    truth: snapshotTruth(),
    snapshotDigest: null
  };
  result.snapshotDigest = sha256(withoutField(result, 'snapshotDigest'));
  bound(result, MAX_ARTIFACT_CANONICAL_BYTES, 'REVIEW_OUTCOME_LEDGER_SNAPSHOT_TOO_LARGE', 'outcome ledger snapshot');
  return result;
}

function validateNamespaceShape(paths) {
  assertDirectoryNotLink(paths.namespace, 'REVIEW_OUTCOME_LEDGER_NAMESPACE_CORRUPT', 'outcome ledger namespace');
  const allowed = new Set([MANIFEST_FILE, RECORDS_DIRECTORY, LOCK_FILE]);
  const unexpected = fs.readdirSync(paths.namespace).filter(name => !allowed.has(name));
  if (unexpected.length) fail('REVIEW_OUTCOME_LEDGER_NAMESPACE_CORRUPT', 'unexpected outcome ledger namespace items: ' + unexpected.sort().join(', '));
  if (!fs.existsSync(paths.records)) fail('REVIEW_OUTCOME_LEDGER_NAMESPACE_CORRUPT', 'outcome ledger records directory is absent');
  assertDirectoryNotLink(paths.records, 'REVIEW_OUTCOME_LEDGER_NAMESPACE_CORRUPT', 'outcome ledger records directory');
}

function contiguousRecordNames(directory) {
  const entries = fs.readdirSync(directory, { withFileTypes: true }).sort((left, right) => left.name < right.name ? -1 : (left.name > right.name ? 1 : 0));
  if (entries.length > MAX_RECORDS) fail('REVIEW_OUTCOME_LEDGER_SEQUENCE_CORRUPT', 'outcome record count exceeds bound');
  return entries.map((entry, index) => {
    const expected = sequenceName(index + 1);
    if (!entry.isFile() || entry.isSymbolicLink() || entry.name !== expected) fail('REVIEW_OUTCOME_LEDGER_SEQUENCE_CORRUPT', 'outcome record files must be contiguous regular files; expected ' + expected);
    return entry.name;
  });
}

function loadState(paths, expected) {
  validateNamespaceShape(paths);
  const names = contiguousRecordNames(paths.records);
  if (!fs.existsSync(paths.manifest)) {
    if (names.length) fail('REVIEW_OUTCOME_LEDGER_MANIFEST_MISSING', 'outcome records exist without a manifest');
    return { manifest: null, records: [], aggregateBytes: 0, snapshot: null };
  }
  const manifestFile = readCanonicalFile(paths.manifest, MAX_ARTIFACT_CANONICAL_BYTES, 'REVIEW_OUTCOME_LEDGER_MANIFEST_CORRUPT', 'stored outcome ledger manifest');
  const manifest = validateManifest(manifestFile.value, expected);
  let aggregateBytes = manifestFile.bytes;
  const records = [];
  names.forEach((name, index) => {
    const loaded = readCanonicalFile(path.join(paths.records, name), MAX_ARTIFACT_CANONICAL_BYTES, 'REVIEW_OUTCOME_LEDGER_RECORD_CORRUPT', 'stored outcome record ' + name);
    aggregateBytes += loaded.bytes;
    if (aggregateBytes > MAX_AGGREGATE_STORAGE_BYTES) fail('REVIEW_OUTCOME_LEDGER_AGGREGATE_TOO_LARGE', 'outcome ledger exceeds aggregate storage bound');
    const record = validateRecord(loaded.value, {
      manifest,
      sequence: index + 1,
      previousRecord: records.length ? records[records.length - 1] : null
    });
    if (records.some(item => item.recordId === record.recordId || item.outcome.outcomeId === record.outcome.outcomeId || item.outcome.outcomeDigest === record.outcome.outcomeDigest)) {
      fail('REVIEW_OUTCOME_LEDGER_RECORD_CORRUPT', 'stored record id outcome id or outcome digest is duplicated');
    }
    records.push(record);
  });
  return { manifest, records, aggregateBytes, snapshot: buildSnapshot(manifest, records, aggregateBytes) };
}

function prevalidateCapture(input, ledgerRoot, manifestCreatedAt) {
  bound(input, MAX_CAPTURE_INPUT_CANONICAL_BYTES, 'REVIEW_OUTCOME_LEDGER_INPUT_TOO_LARGE', 'outcome ledger capture input');
  exactKeys(input, ['recordId', 'recordedAt', 'confirmation', 'outcomeInput', 'outcome'], 'INVALID_REVIEW_OUTCOME_LEDGER_INPUT', 'outcome ledger capture input');
  const recordId = text(input.recordId, 'INVALID_REVIEW_OUTCOME_LEDGER_INPUT', 'record id', 180);
  const recordedAt = timestamp(input.recordedAt, 'INVALID_REVIEW_OUTCOME_LEDGER_INPUT', 'record time');
  if (input.confirmation !== CAPTURE_CONFIRMATION) fail('REVIEW_OUTCOME_LEDGER_CONFIRMATION_REQUIRED', 'exact unauthenticated outcome capture confirmation is required');
  assertDistinctRoots(ledgerRoot, input.outcomeInput);
  const verification = V31.verifyOutcome(clone(input.outcomeInput), clone(input.outcome));
  if (!verification.pass) fail('REVIEW_OUTCOME_LEDGER_V31_OUTCOME_INVALID', 'v3.1 outcome does not exact-rebuild: ' + verification.errors.join('; '));
  if (Date.parse(recordedAt) < Date.parse(verification.rebuilt.observedAt)) fail('REVIEW_OUTCOME_LEDGER_TIME_INVALID', 'record cannot predate v3.1 outcome');
  if (Date.parse(recordedAt) < Date.parse(manifestCreatedAt)) fail('REVIEW_OUTCOME_LEDGER_TIME_INVALID', 'record cannot predate outcome ledger');
  return { recordId, recordedAt, outcome: verification.rebuilt };
}

function createService(options) {
  bound(options, MAX_SERVICE_OPTIONS_CANONICAL_BYTES, 'REVIEW_OUTCOME_LEDGER_SERVICE_OPTIONS_TOO_LARGE', 'outcome ledger service options');
  exactKeys(options, ['stateRoot', 'ledgerId', 'createdAt'], 'INVALID_REVIEW_OUTCOME_LEDGER_SERVICE_OPTIONS', 'outcome ledger service options');
  const paths = resolvePaths(options.stateRoot);
  const ledgerId = text(options.ledgerId, 'INVALID_REVIEW_OUTCOME_LEDGER_SERVICE_OPTIONS', 'ledger id', 180);
  const createdAt = timestamp(options.createdAt, 'INVALID_REVIEW_OUTCOME_LEDGER_SERVICE_OPTIONS', 'ledger creation time');
  const configuredManifest = buildManifest(ledgerId, createdAt);
  const expected = { ledgerId, createdAt };

  function inspect() {
    if (!fs.existsSync(paths.namespace)) return null;
    validateNamespaceShape(paths);
    return withOperationLock(paths, () => clone(loadState(paths, expected).snapshot));
  }

  function read(sequence) {
    if (!Number.isSafeInteger(sequence) || sequence < 1 || sequence > MAX_RECORDS) fail('INVALID_REVIEW_OUTCOME_LEDGER_SEQUENCE', 'outcome record sequence is invalid');
    if (!fs.existsSync(paths.namespace)) fail('NO_REVIEW_OUTCOME_LEDGER_RECORDS', 'outcome ledger is absent');
    validateNamespaceShape(paths);
    return withOperationLock(paths, () => {
      const state = loadState(paths, expected);
      if (!state.records[sequence - 1]) fail('NO_REVIEW_OUTCOME_LEDGER_RECORDS', 'requested outcome record is absent');
      return clone(state.records[sequence - 1]);
    });
  }

  function readAll() {
    if (!fs.existsSync(paths.namespace)) fail('NO_REVIEW_OUTCOME_LEDGER_RECORDS', 'outcome ledger is absent');
    validateNamespaceShape(paths);
    return withOperationLock(paths, () => clone(loadState(paths, expected).records));
  }

  function capture(input) {
    prevalidateCapture(input, paths.root, createdAt);
    ensureNamespace(paths);
    return withOperationLock(paths, () => {
      const state = loadState(paths, expected);
      const validated = prevalidateCapture(input, paths.root, createdAt);
      if (state.records.length >= MAX_RECORDS) fail('REVIEW_OUTCOME_LEDGER_LIMIT_REACHED', 'outcome record count limit reached');
      if (state.records.some(item => item.recordId === validated.recordId)) fail('REVIEW_OUTCOME_LEDGER_DUPLICATE', 'record id already exists');
      if (state.records.some(item => item.outcome.outcomeId === validated.outcome.outcomeId)) fail('REVIEW_OUTCOME_LEDGER_DUPLICATE', 'v3.1 outcome id already exists');
      if (state.records.some(item => item.outcome.outcomeDigest === validated.outcome.outcomeDigest)) fail('REVIEW_OUTCOME_LEDGER_DUPLICATE', 'v3.1 outcome digest already exists');
      const previous = state.records.length ? state.records[state.records.length - 1] : null;
      if (previous && Date.parse(validated.recordedAt) <= Date.parse(previous.recordedAt)) fail('REVIEW_OUTCOME_LEDGER_TIME_INVALID', 'record time must be strictly forward');
      const manifest = state.manifest || clone(configuredManifest);
      const record = buildRecord(validated, validated.outcome, {
        manifest,
        sequence: state.records.length + 1,
        previousRecord: previous
      });
      const additionalBytes = Buffer.byteLength(stableStringify(record) + '\n', 'utf8') + (state.manifest ? 0 : Buffer.byteLength(stableStringify(manifest) + '\n', 'utf8'));
      if (state.aggregateBytes + additionalBytes > MAX_AGGREGATE_STORAGE_BYTES) fail('REVIEW_OUTCOME_LEDGER_AGGREGATE_TOO_LARGE', 'outcome ledger would exceed aggregate storage bound');
      if (!state.manifest) writeExclusiveFsync(paths.manifest, manifest, 'REVIEW_OUTCOME_LEDGER_MANIFEST_WRITE_FAILED', 'outcome ledger manifest');
      writeExclusiveFsync(path.join(paths.records, sequenceName(record.log.sequence)), record, 'REVIEW_OUTCOME_LEDGER_RECORD_WRITE_FAILED', 'outcome ledger record');
      return clone(record);
    });
  }

  function verifyPersisted(record) {
    const errors = [];
    let rebuilt = null;
    try {
      if (!isObject(record) || !isObject(record.log) || !Number.isSafeInteger(record.log.sequence)) throw new Error('presented record has no sequence');
      rebuilt = read(record.log.sequence);
      if (!same(rebuilt, record)) throw new Error('presented record does not equal stored canonical outcome record');
    } catch (error) { errors.push(error.message); }
    return { pass: errors.length === 0, errors, rebuilt };
  }

  return Object.freeze({ ledgerId, capture, inspect, read, readAll, verifyPersisted });
}

module.exports = {
  MANIFEST_SCHEMA,
  RECORD_SCHEMA,
  SNAPSHOT_SCHEMA,
  VERSION,
  STATUS,
  NAMESPACE,
  MANIFEST_FILE,
  RECORDS_DIRECTORY,
  LOCK_FILE,
  MODE,
  STORAGE_MODE,
  CAPTURE_CONFIRMATION,
  CLASSIFICATIONS,
  MAX_RECORDS,
  MAX_ARTIFACT_CANONICAL_BYTES,
  MAX_AGGREGATE_STORAGE_BYTES,
  MAX_SERVICE_OPTIONS_CANONICAL_BYTES,
  MAX_CAPTURE_INPUT_CANONICAL_BYTES,
  RetentionAuditReviewOutcomeLedgerError,
  stableStringify,
  sha256,
  validateManifest,
  validateRecord,
  createService
};
