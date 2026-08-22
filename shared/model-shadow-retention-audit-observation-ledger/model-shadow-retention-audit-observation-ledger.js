'use strict';

const fs = require('fs');
const path = require('path');
const V27 = require('../model-shadow-history-checkpoint-retention-ledger/model-shadow-history-checkpoint-retention-ledger');

const MANIFEST_SCHEMA = 'axm.model-shadow-retention-audit-observation-ledger-manifest/v1';
const OBSERVATION_SCHEMA = 'axm.model-shadow-retention-audit-observation-ledger-observation/v1';
const SNAPSHOT_SCHEMA = 'axm.model-shadow-retention-audit-observation-ledger-snapshot/v1';
const VERSION = '2.8.0';
const STATUS = 'TEST';
const NAMESPACE = 'model-shadow-retention-audit-observation-ledger';
const MANIFEST_FILE = 'manifest.json';
const OBSERVATIONS_DIRECTORY = 'observations';
const LOCK_FILE = '.operation.lock';
const MODE = 'CALLER_OWNED_DISTINCT_LOCAL_RETENTION_AUDIT_OBSERVATION_UNAUTHENTICATED';
const STORAGE_MODE = 'CANONICAL_JSON_EXCLUSIVE_CREATE_FILE_FSYNC_APPEND_ONLY';
const CAPTURE_CONFIRMATION = 'RECORD_LOCAL_RETENTION_AUDIT_OBSERVATION_UNAUTHENTICATED';
const HELD_CLASSIFICATION = 'HELD_RETENTION_AUDIT_OBSERVATION';
const NONHOLD_CLASSIFICATION = 'NONHOLD_RETENTION_AUDIT_OBSERVATION';
const MAX_RECORDS = 10000;
const MAX_ARTIFACT_CANONICAL_BYTES = 4194304;
const MAX_AGGREGATE_STORAGE_BYTES = 268435456;
const MAX_SERVICE_OPTIONS_CANONICAL_BYTES = 1048576;
const MAX_CAPTURE_INPUT_CANONICAL_BYTES = 402653184;

class RetentionAuditObservationLedgerError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'RetentionAuditObservationLedgerError';
    this.code = code;
  }
}

function fail(code, message) { throw new RetentionAuditObservationLedgerError(code, message); }
function clone(value) { return JSON.parse(JSON.stringify(value)); }
function stableStringify(value) { return V27.stableStringify(value); }
function sha256(value) { return V27.sha256(value); }
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
function assertThreeDistinctRoots(observationRoot, retentionServiceOptions, auditInput) {
  if (!isObject(retentionServiceOptions) || typeof retentionServiceOptions.stateRoot !== 'string') {
    fail('AUDIT_OBSERVATION_ROOT_INVALID', 'v2.7 retention service options must identify a retention root');
  }
  if (!isObject(auditInput) || !isObject(auditInput.current) || !isObject(auditInput.current.serviceOptions) || typeof auditInput.current.serviceOptions.stateRoot !== 'string') {
    fail('AUDIT_OBSERVATION_ROOT_INVALID', 'v2.7 audit input must identify a current source root');
  }
  const retentionRoot = resolvedRoot(retentionServiceOptions.stateRoot, 'AUDIT_OBSERVATION_ROOT_INVALID', 'retention root');
  const sourceRoot = resolvedRoot(auditInput.current.serviceOptions.stateRoot, 'AUDIT_OBSERVATION_ROOT_INVALID', 'source root');
  if (rootsOverlap(observationRoot, retentionRoot) || rootsOverlap(observationRoot, sourceRoot) || rootsOverlap(retentionRoot, sourceRoot)) {
    fail('AUDIT_OBSERVATION_ROOT_OVERLAP', 'observation, retention, and source roots must be distinct and nonnested');
  }
  return { retentionRoot, sourceRoot };
}

function resolvePaths(stateRoot) {
  const root = resolvedRoot(stateRoot, 'AUDIT_OBSERVATION_STATE_ROOT_INVALID', 'observation state root');
  const namespace = path.join(root, NAMESPACE);
  return {
    root,
    namespace,
    manifest: path.join(namespace, MANIFEST_FILE),
    observations: path.join(namespace, OBSERVATIONS_DIRECTORY),
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
  ensureDirectory(paths.namespace, 'AUDIT_OBSERVATION_NAMESPACE_CORRUPT', 'observation namespace');
  ensureDirectory(paths.observations, 'AUDIT_OBSERVATION_NAMESPACE_CORRUPT', 'observation records directory');
}
function withOperationLock(paths, operation) {
  let descriptor;
  try {
    descriptor = fs.openSync(paths.lock, 'wx', 0o600);
    fs.writeFileSync(descriptor, stableStringify({ schema: 'axm.local-operation-lock/v1', pid: process.pid }) + '\n', 'utf8');
    fs.fsyncSync(descriptor);
  } catch (error) {
    if (descriptor !== undefined) { try { fs.closeSync(descriptor); } catch (_) {} }
    fail('AUDIT_OBSERVATION_BUSY', 'observation ledger operation lock already exists or cannot be created');
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
    callerOwnedLocalObservationRoot: true,
    manifestExclusiveCreateAndFileFsyncCompleted: true,
    appendOnlyObservationIntent: true,
    directoryEntryOrHardwareDurabilityProven: false,
    externalRetentionProven: false,
    protectedMonotonicStateProven: false,
    hostAuthorizationAuthenticated: false,
    actorRealWorldIdentityProven: false,
    actualHumanParticipationProven: false,
    timeExternallyTrusted: false,
    executionAuthorized: false,
    adoptionAuthorized: false,
    automaticPromotion: false,
    automaticMerge: false,
    automaticCanon: false,
    foundationMutation: false
  };
}
function observationTruth(audit) {
  return {
    v27AuditExactRebuiltBeforeWrite: true,
    completeV27AuditPersisted: true,
    v27AuditInputPersisted: false,
    observationExclusiveCreateAndFileFsyncCompleted: true,
    observationRootDistinctAndNonnestedFromComparedRoots: true,
    completePriorObservationChainValidated: true,
    sourceOrRetentionPresentationRequiredForReload: false,
    continuousMonitoringPerformed: false,
    v27AuditReceiptPersistedByV27: audit.truth.auditReceiptPersistedByModule,
    transientV27RetentionOperationLockMayBeWritten: true,
    transientV25SourceOperationLockMayBeWritten: audit.truth.transientV25OperationLockMayBeWritten,
    durableSourceOrRetentionStateChangedByModule: false,
    directoryEntryOrHardwareDurabilityProven: false,
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
    sourceOrRetentionPathEmbedded: false,
    rawV27AuditInputEmbedded: false,
    privateKeyIngested: false,
    rawModelOutputEmbedded: false,
    privateContextEmbedded: false,
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
    completeObservationChainValidated: true,
    fullV27AuditsReloadedWithoutAuditInputs: true,
    sourceOrRetentionPresentationRequiredForReload: false,
    currentSourceOrRetentionStateContinuouslyMonitored: false,
    observationRootCallerOwnedAndLocal: true,
    externalRetentionProven: false,
    protectedMonotonicStateProven: false,
    jointThreeRootLossExcluded: false,
    hostAuthorizationAuthenticated: false,
    actorRealWorldIdentityProven: false,
    actualHumanParticipationProven: false,
    timeExternallyTrusted: false,
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

function buildManifest(auditLogId, createdAt) {
  const result = {
    schema: MANIFEST_SCHEMA,
    version: VERSION,
    status: STATUS,
    auditLogId,
    createdAt,
    mode: MODE,
    storageMode: STORAGE_MODE,
    truth: manifestTruth(),
    manifestDigest: null
  };
  result.manifestDigest = sha256(withoutField(result, 'manifestDigest'));
  bound(result, MAX_ARTIFACT_CANONICAL_BYTES, 'AUDIT_OBSERVATION_MANIFEST_TOO_LARGE', 'observation manifest');
  return result;
}
function manifestRef(manifest) { return { id: manifest.auditLogId, schema: manifest.schema, sha256: manifest.manifestDigest }; }
function observationRef(observation) { return { id: observation.observationId, schema: observation.schema, sha256: observation.observationDigest }; }
function auditRef(audit) { return { id: audit.auditId, schema: audit.schema, sha256: audit.auditDigest }; }

function validateManifest(value, expected) {
  try {
    exactKeys(value, ['schema', 'version', 'status', 'auditLogId', 'createdAt', 'mode', 'storageMode', 'truth', 'manifestDigest'], 'AUDIT_OBSERVATION_MANIFEST_CORRUPT', 'stored observation manifest');
    if (value.schema !== MANIFEST_SCHEMA || value.version !== VERSION || value.status !== STATUS || value.mode !== MODE || value.storageMode !== STORAGE_MODE) throw new Error('manifest identity mismatch');
    text(value.auditLogId, 'AUDIT_OBSERVATION_MANIFEST_CORRUPT', 'stored audit log id', 180);
    timestamp(value.createdAt, 'AUDIT_OBSERVATION_MANIFEST_CORRUPT', 'stored audit log creation time');
    if (value.auditLogId !== expected.auditLogId || value.createdAt !== expected.createdAt) throw new Error('manifest does not match configured identity');
    if (!same(value.truth, manifestTruth())) throw new Error('manifest truth boundary mismatch');
    if (digest(value.manifestDigest, 'AUDIT_OBSERVATION_MANIFEST_CORRUPT', 'stored manifest digest') !== sha256(withoutField(value, 'manifestDigest'))) throw new Error('manifest digest mismatch');
    return clone(value);
  } catch (error) {
    if (error instanceof RetentionAuditObservationLedgerError && error.code === 'AUDIT_OBSERVATION_MANIFEST_CORRUPT') throw error;
    fail('AUDIT_OBSERVATION_MANIFEST_CORRUPT', 'stored observation manifest is corrupt: ' + error.message);
  }
}

function classificationFor(audit) { return audit.decision.holdRequired ? HELD_CLASSIFICATION : NONHOLD_CLASSIFICATION; }
function decisionFor(audit) {
  return {
    reviewRequired: true,
    holdRequired: audit.decision.holdRequired,
    observationOnly: true,
    bestAction: audit.decision.holdRequired ? 'PRESERVE_HELD_OBSERVATION_FOR_REVIEW_NO_AUTONOMOUS_ACTION' : 'PRESERVE_NONHOLD_OBSERVATION_FOR_REVIEW_NO_AUTONOMOUS_ACTION',
    autonomousActionCount: 0
  };
}
function buildObservation(input, audit, context) {
  const result = {
    schema: OBSERVATION_SCHEMA,
    version: VERSION,
    status: STATUS,
    observationId: input.observationId,
    observedAt: input.observedAt,
    mode: MODE,
    log: {
      manifestRef: manifestRef(context.manifest),
      sequence: context.sequence,
      previousObservationRef: context.previousObservation ? observationRef(context.previousObservation) : null
    },
    retentionManifestRef: clone(audit.retention.manifestRef),
    classification: classificationFor(audit),
    v27Audit: clone(audit),
    decision: decisionFor(audit),
    truth: observationTruth(audit),
    observationDigest: null
  };
  result.observationDigest = sha256(withoutField(result, 'observationDigest'));
  bound(result, MAX_ARTIFACT_CANONICAL_BYTES, 'AUDIT_OBSERVATION_TOO_LARGE', 'audit observation');
  return result;
}
function validateObservation(value, context) {
  try {
    bound(value, MAX_ARTIFACT_CANONICAL_BYTES, 'AUDIT_OBSERVATION_RECORD_CORRUPT', 'stored audit observation');
    exactKeys(value, ['schema', 'version', 'status', 'observationId', 'observedAt', 'mode', 'log', 'retentionManifestRef', 'classification', 'v27Audit', 'decision', 'truth', 'observationDigest'], 'AUDIT_OBSERVATION_RECORD_CORRUPT', 'stored audit observation');
    if (value.schema !== OBSERVATION_SCHEMA || value.version !== VERSION || value.status !== STATUS || value.mode !== MODE) throw new Error('observation identity mismatch');
    text(value.observationId, 'AUDIT_OBSERVATION_RECORD_CORRUPT', 'stored observation id', 180);
    timestamp(value.observedAt, 'AUDIT_OBSERVATION_RECORD_CORRUPT', 'stored observation time');
    exactKeys(value.log, ['manifestRef', 'sequence', 'previousObservationRef'], 'AUDIT_OBSERVATION_RECORD_CORRUPT', 'stored observation log binding');
    reference(value.log.manifestRef, 'AUDIT_OBSERVATION_RECORD_CORRUPT', 'stored manifest reference');
    if (!Number.isSafeInteger(value.log.sequence) || value.log.sequence !== context.sequence) throw new Error('observation sequence mismatch');
    if (value.log.sequence < 1 || value.log.sequence > MAX_RECORDS) throw new Error('observation sequence outside bound');
    const expectedPrevious = context.previousObservation ? observationRef(context.previousObservation) : null;
    if (value.log.previousObservationRef !== null) reference(value.log.previousObservationRef, 'AUDIT_OBSERVATION_RECORD_CORRUPT', 'stored previous observation reference');
    if (!same(value.log.previousObservationRef, expectedPrevious)) throw new Error('previous observation chain mismatch');
    if (!same(value.log.manifestRef, manifestRef(context.manifest))) throw new Error('observation manifest binding mismatch');
    const audit = V27.validateAudit(value.v27Audit);
    reference(value.retentionManifestRef, 'AUDIT_OBSERVATION_RECORD_CORRUPT', 'stored retention manifest reference');
    if (!same(value.retentionManifestRef, audit.retention.manifestRef)) throw new Error('retention manifest and audit disagree');
    if (context.retentionManifestRef && !same(value.retentionManifestRef, context.retentionManifestRef)) throw new Error('retention manifest identity changed within observation log');
    if (Date.parse(value.observedAt) < Date.parse(audit.auditedAt)) throw new Error('observation predates v2.7 audit');
    if (Date.parse(value.observedAt) < Date.parse(context.manifest.createdAt)) throw new Error('observation predates observation manifest');
    if (context.previousObservation && Date.parse(value.observedAt) <= Date.parse(context.previousObservation.observedAt)) throw new Error('observation time is not strictly forward');
    if (value.classification !== classificationFor(audit)) throw new Error('observation classification mismatch');
    if (!same(value.decision, decisionFor(audit))) throw new Error('observation decision mismatch');
    if (!same(value.truth, observationTruth(audit))) throw new Error('observation truth boundary mismatch');
    if (digest(value.observationDigest, 'AUDIT_OBSERVATION_RECORD_CORRUPT', 'stored observation digest') !== sha256(withoutField(value, 'observationDigest'))) throw new Error('observation digest mismatch');
    return clone(value);
  } catch (error) {
    if (error instanceof RetentionAuditObservationLedgerError && error.code === 'AUDIT_OBSERVATION_RECORD_CORRUPT') throw error;
    fail('AUDIT_OBSERVATION_RECORD_CORRUPT', 'stored audit observation is corrupt: ' + error.message);
  }
}

function buildSnapshot(manifest, observations, aggregateBytes) {
  const latest = observations.length ? observations[observations.length - 1] : null;
  const result = {
    schema: SNAPSHOT_SCHEMA,
    version: VERSION,
    status: STATUS,
    auditLogId: manifest.auditLogId,
    mode: MODE,
    manifestRef: manifestRef(manifest),
    retentionManifestRef: observations.length ? clone(observations[0].retentionManifestRef) : null,
    observationCount: observations.length,
    heldObservationCount: observations.filter(item => item.classification === HELD_CLASSIFICATION).length,
    nonholdObservationCount: observations.filter(item => item.classification === NONHOLD_CLASSIFICATION).length,
    latestObservationRef: latest ? observationRef(latest) : null,
    latestV27AuditRef: latest ? auditRef(latest.v27Audit) : null,
    latestClassification: latest ? latest.classification : null,
    aggregateStorageBytes: aggregateBytes,
    truth: snapshotTruth(),
    snapshotDigest: null
  };
  result.snapshotDigest = sha256(withoutField(result, 'snapshotDigest'));
  bound(result, MAX_ARTIFACT_CANONICAL_BYTES, 'AUDIT_OBSERVATION_SNAPSHOT_TOO_LARGE', 'observation snapshot');
  return result;
}

function validateNamespaceShape(paths) {
  assertDirectoryNotLink(paths.namespace, 'AUDIT_OBSERVATION_NAMESPACE_CORRUPT', 'observation namespace');
  const allowed = new Set([MANIFEST_FILE, OBSERVATIONS_DIRECTORY, LOCK_FILE]);
  const unexpected = fs.readdirSync(paths.namespace).filter(name => !allowed.has(name));
  if (unexpected.length) fail('AUDIT_OBSERVATION_NAMESPACE_CORRUPT', 'unexpected observation namespace items: ' + unexpected.join(', '));
  if (!fs.existsSync(paths.observations)) fail('AUDIT_OBSERVATION_NAMESPACE_CORRUPT', 'observation records directory is absent');
  assertDirectoryNotLink(paths.observations, 'AUDIT_OBSERVATION_NAMESPACE_CORRUPT', 'observation records directory');
}
function contiguousObservationNames(directory) {
  const entries = fs.readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name));
  if (entries.length > MAX_RECORDS) fail('AUDIT_OBSERVATION_SEQUENCE_CORRUPT', 'observation count exceeds bound');
  return entries.map((entry, index) => {
    const expected = sequenceName(index + 1);
    if (!entry.isFile() || entry.isSymbolicLink() || entry.name !== expected) fail('AUDIT_OBSERVATION_SEQUENCE_CORRUPT', 'observation files must be contiguous regular files; expected ' + expected);
    return entry.name;
  });
}
function loadState(paths, expected) {
  validateNamespaceShape(paths);
  const names = contiguousObservationNames(paths.observations);
  if (!fs.existsSync(paths.manifest)) {
    if (names.length) fail('AUDIT_OBSERVATION_MANIFEST_MISSING', 'observations exist without a manifest');
    return { manifest: null, observations: [], aggregateBytes: 0, snapshot: null };
  }
  const manifestFile = readCanonicalFile(paths.manifest, MAX_ARTIFACT_CANONICAL_BYTES, 'AUDIT_OBSERVATION_MANIFEST_CORRUPT', 'stored observation manifest');
  const manifest = validateManifest(manifestFile.value, expected);
  let aggregateBytes = manifestFile.bytes;
  const observations = [];
  let retentionManifestRef = null;
  names.forEach((name, index) => {
    const loaded = readCanonicalFile(path.join(paths.observations, name), MAX_ARTIFACT_CANONICAL_BYTES, 'AUDIT_OBSERVATION_RECORD_CORRUPT', 'stored audit observation ' + name);
    aggregateBytes += loaded.bytes;
    if (aggregateBytes > MAX_AGGREGATE_STORAGE_BYTES) fail('AUDIT_OBSERVATION_AGGREGATE_TOO_LARGE', 'observation ledger exceeds aggregate storage bound');
    const observation = validateObservation(loaded.value, {
      manifest,
      sequence: index + 1,
      previousObservation: observations.length ? observations[observations.length - 1] : null,
      retentionManifestRef
    });
    retentionManifestRef = retentionManifestRef || clone(observation.retentionManifestRef);
    if (observations.some(item => item.observationId === observation.observationId || item.v27Audit.auditDigest === observation.v27Audit.auditDigest)) {
      fail('AUDIT_OBSERVATION_RECORD_CORRUPT', 'stored observation id or v2.7 audit digest is duplicated');
    }
    observations.push(observation);
  });
  return { manifest, observations, aggregateBytes, snapshot: buildSnapshot(manifest, observations, aggregateBytes) };
}

function prevalidateCapture(input, observationRoot, manifestCreatedAt) {
  bound(input, MAX_CAPTURE_INPUT_CANONICAL_BYTES, 'AUDIT_OBSERVATION_INPUT_TOO_LARGE', 'audit observation input');
  exactKeys(input, ['observationId', 'observedAt', 'confirmation', 'retentionServiceOptions', 'auditInput', 'auditReceipt'], 'INVALID_AUDIT_OBSERVATION_INPUT', 'audit observation input');
  const observationId = text(input.observationId, 'INVALID_AUDIT_OBSERVATION_INPUT', 'observation id', 180);
  const observedAt = timestamp(input.observedAt, 'INVALID_AUDIT_OBSERVATION_INPUT', 'observation time');
  if (input.confirmation !== CAPTURE_CONFIRMATION) fail('AUDIT_OBSERVATION_CONFIRMATION_REQUIRED', 'exact unauthenticated observation confirmation is required');
  assertThreeDistinctRoots(observationRoot, input.retentionServiceOptions, input.auditInput);
  let receipt;
  try { receipt = V27.validateAudit(input.auditReceipt); }
  catch (error) { fail('AUDIT_OBSERVATION_V27_AUDIT_INVALID', 'presented v2.7 audit is invalid: ' + error.message); }
  let verification;
  try { verification = V27.createService(clone(input.retentionServiceOptions)).verifyAudit(clone(input.auditInput), clone(receipt)); }
  catch (error) { fail('AUDIT_OBSERVATION_V27_AUDIT_INVALID', 'v2.7 audit exact rebuild failed: ' + error.message); }
  if (!verification.pass) fail('AUDIT_OBSERVATION_V27_AUDIT_INVALID', 'v2.7 audit does not exact-rebuild: ' + verification.errors.join('; '));
  if (Date.parse(observedAt) < Date.parse(verification.rebuilt.auditedAt)) fail('AUDIT_OBSERVATION_TIME_INVALID', 'observation cannot predate v2.7 audit');
  if (Date.parse(observedAt) < Date.parse(manifestCreatedAt)) fail('AUDIT_OBSERVATION_TIME_INVALID', 'observation cannot predate observation log');
  return { observationId, observedAt, audit: verification.rebuilt };
}

function createService(options) {
  bound(options, MAX_SERVICE_OPTIONS_CANONICAL_BYTES, 'AUDIT_OBSERVATION_SERVICE_OPTIONS_TOO_LARGE', 'observation service options');
  exactKeys(options, ['stateRoot', 'auditLogId', 'createdAt'], 'INVALID_AUDIT_OBSERVATION_SERVICE_OPTIONS', 'observation service options');
  const paths = resolvePaths(options.stateRoot);
  const auditLogId = text(options.auditLogId, 'INVALID_AUDIT_OBSERVATION_SERVICE_OPTIONS', 'audit log id', 180);
  const createdAt = timestamp(options.createdAt, 'INVALID_AUDIT_OBSERVATION_SERVICE_OPTIONS', 'audit log creation time');
  const configuredManifest = buildManifest(auditLogId, createdAt);
  const expected = { auditLogId, createdAt };

  function inspect() {
    if (!fs.existsSync(paths.namespace)) return null;
    validateNamespaceShape(paths);
    return withOperationLock(paths, () => clone(loadState(paths, expected).snapshot));
  }
  function read(sequence) {
    if (!Number.isSafeInteger(sequence) || sequence < 1 || sequence > MAX_RECORDS) fail('INVALID_AUDIT_OBSERVATION_SEQUENCE', 'observation sequence is invalid');
    if (!fs.existsSync(paths.namespace)) fail('NO_AUDIT_OBSERVATIONS', 'observation ledger is absent');
    validateNamespaceShape(paths);
    return withOperationLock(paths, () => {
      const state = loadState(paths, expected);
      if (!state.observations[sequence - 1]) fail('NO_AUDIT_OBSERVATIONS', 'requested observation is absent');
      return clone(state.observations[sequence - 1]);
    });
  }
  function capture(input) {
    prevalidateCapture(input, paths.root, createdAt);
    ensureNamespace(paths);
    return withOperationLock(paths, () => {
      const state = loadState(paths, expected);
      const validated = prevalidateCapture(input, paths.root, createdAt);
      if (state.observations.length >= MAX_RECORDS) fail('AUDIT_OBSERVATION_LIMIT_REACHED', 'observation count limit reached');
      if (state.observations.some(item => item.observationId === validated.observationId)) fail('AUDIT_OBSERVATION_DUPLICATE', 'observation id already exists');
      if (state.observations.some(item => item.v27Audit.auditDigest === validated.audit.auditDigest)) fail('AUDIT_OBSERVATION_DUPLICATE', 'v2.7 audit was already observed');
      const previous = state.observations.length ? state.observations[state.observations.length - 1] : null;
      if (previous && Date.parse(validated.observedAt) <= Date.parse(previous.observedAt)) fail('AUDIT_OBSERVATION_TIME_INVALID', 'observation time must be strictly forward');
      if (state.observations.length && !same(validated.audit.retention.manifestRef, state.observations[0].retentionManifestRef)) {
        fail('AUDIT_OBSERVATION_RETENTION_IDENTITY_DRIFT', 'v2.7 retention manifest identity changed within the observation log');
      }
      const manifest = state.manifest || clone(configuredManifest);
      const observation = buildObservation(validated, validated.audit, {
        manifest,
        sequence: state.observations.length + 1,
        previousObservation: previous
      });
      const additionalBytes = Buffer.byteLength(stableStringify(observation) + '\n', 'utf8') + (state.manifest ? 0 : Buffer.byteLength(stableStringify(manifest) + '\n', 'utf8'));
      if (state.aggregateBytes + additionalBytes > MAX_AGGREGATE_STORAGE_BYTES) fail('AUDIT_OBSERVATION_AGGREGATE_TOO_LARGE', 'observation ledger would exceed aggregate storage bound');
      if (!state.manifest) writeExclusiveFsync(paths.manifest, manifest, 'AUDIT_OBSERVATION_MANIFEST_WRITE_FAILED', 'observation manifest');
      writeExclusiveFsync(path.join(paths.observations, sequenceName(observation.log.sequence)), observation, 'AUDIT_OBSERVATION_WRITE_FAILED', 'audit observation');
      return clone(observation);
    });
  }
  function verifyPersisted(receipt) {
    const errors = [];
    let rebuilt = null;
    try {
      if (!isObject(receipt) || !isObject(receipt.log) || !Number.isSafeInteger(receipt.log.sequence)) throw new Error('presented observation has no sequence');
      rebuilt = read(receipt.log.sequence);
      if (!same(rebuilt, receipt)) throw new Error('presented observation does not equal stored canonical observation');
    } catch (error) { errors.push(error.message); }
    return { pass: errors.length === 0, errors, rebuilt };
  }

  return Object.freeze({ auditLogId, capture, inspect, read, verifyPersisted });
}

module.exports = {
  MANIFEST_SCHEMA,
  OBSERVATION_SCHEMA,
  SNAPSHOT_SCHEMA,
  VERSION,
  STATUS,
  NAMESPACE,
  LOCK_FILE,
  MODE,
  STORAGE_MODE,
  CAPTURE_CONFIRMATION,
  HELD_CLASSIFICATION,
  NONHOLD_CLASSIFICATION,
  MAX_RECORDS,
  MAX_ARTIFACT_CANONICAL_BYTES,
  MAX_AGGREGATE_STORAGE_BYTES,
  MAX_SERVICE_OPTIONS_CANONICAL_BYTES,
  MAX_CAPTURE_INPUT_CANONICAL_BYTES,
  RetentionAuditObservationLedgerError,
  stableStringify,
  sha256,
  validateManifest,
  validateObservation,
  createService
};
