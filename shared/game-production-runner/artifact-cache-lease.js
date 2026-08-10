'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const Codec = require('./canonical');
const Contracts = require('./contracts');
const ArtifactCache = require('./artifact-cache');

const EVENT_SCHEMA = 'axm.production-artifact-cache-lease-event/v1';
const SET_SCHEMA = 'axm.production-artifact-cache-lease-set/v1';
const ARCHIVE_ANCHOR_SCHEMA = 'axm.production-artifact-cache-lease-archive-anchor/v1';
const ARCHIVE_RECEIPT_SCHEMA = 'axm.production-artifact-cache-lease-archive-receipt/v1';
const ARCHIVE_AUDIT_SCHEMA = 'axm.production-artifact-cache-lease-archive-audit/v1';
const OWNER_SCHEMA = 'axm.production-artifact-cache-lease-owner/v1';
const LOCK_SCHEMA = 'axm.production-artifact-cache-coordination-lock/v1';
const VERSION = '0.1.0';
const DEFAULT_DURATION_MS = 300000;
const MAX_DURATION_MS = 604800000;
const PACKAGE_MARGIN_MS = 60000;
const MAX_KEYS = 10000;
const MAX_EVENTS_PER_LEDGER = 10000;
const MAX_LEDGER_BYTES = 16777216;
const MAX_ANCHOR_BYTES = 2097152;
const MAX_ARCHIVE_RECEIPT_BYTES = 1048576;
const DEFAULT_MAX_ARCHIVE_SEGMENTS = 10000;
const DEFAULT_MAX_ARCHIVE_COMPRESSED_BYTES = 67108864;
const DEFAULT_MAX_ARCHIVE_RAW_BYTES = 268435456;
const DEFAULT_MAX_DIRECTORY_ENTRIES = 20000;
const DEFAULT_MAX_LEDGERS = 10000;
const DEFAULT_MAX_EVENTS = 100000;
const DEFAULT_MAX_BYTES = 67108864;
const LOCK_DURATION_MS = 60000;
const LOCK_STALE_GRACE_MS = 60000;
const MAX_LOCK_BYTES = 65536;
const DIGEST = /^[a-f0-9]{64}$/;
const ACTIVE_EVENTS = Object.freeze(['ACQUIRED', 'RENEWED', 'PROTECTED']);
const EVENT_KEYS = Object.freeze([
  'schema', 'version', 'lease_id', 'owner', 'event', 'session_digest',
  'generation', 'observed_at_ms', 'expires_at_ms', 'keys',
  'previous_event_digest', 'authority', 'digest'
]);
const OWNER_KEYS = Object.freeze([
  'cache_root_fingerprint', 'job_root_fingerprint', 'run_id_digest',
  'plan_digest', 'run_started_at_digest'
]);
const AUTHORITY_KEYS = Object.freeze([
  'cache_protection_requested', 'deletion', 'execution', 'installed',
  'promoted', 'canon', 'released'
]);
const ANCHOR_KEYS = Object.freeze([
  'schema', 'version', 'lease_id', 'owner', 'tail_event',
  'history_event_count', 'archived_segment_count',
  'latest_archive_receipt_digest', 'authority', 'digest'
]);
const ARCHIVE_RECEIPT_KEYS = Object.freeze([
  'schema', 'version', 'lease_id', 'owner_digest',
  'previous_archive_receipt_digest', 'previous_anchor_digest',
  'source_segment_digest', 'source_segment_bytes', 'source_event_count',
  'source_first_generation', 'source_last_generation',
  'source_tail_event_digest', 'archive_blob_digest', 'archive_blob_bytes',
  'recorded_at_ms', 'authority', 'digest'
]);

class LeaseError extends Error {
  constructor(code) {
    super(code);
    this.name = 'LeaseError';
    this.code = code;
  }
}

function fail(code) { throw new LeaseError(code); }
function exactKeys(value, expected) {
  return value && typeof value === 'object' && !Array.isArray(value) && Codec.canonical(Object.keys(value).sort()) === Codec.canonical(expected.slice().sort());
}
function finiteInteger(value) { return Number.isSafeInteger(value) && value >= 0; }
function digest(value) { return DIGEST.test(String(value || '')); }
function normalizedPath(value) {
  const resolved = path.resolve(value);
  return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
}
function rootFingerprint(value) { return Codec.sha256(Buffer.from(normalizedPath(value), 'utf8')); }
function locatorDigest(relative) { return Codec.sha256(Buffer.from(String(relative).replace(/\\/g, '/'), 'utf8')); }
function clone(value) { return Codec.clone(value); }

function duration(value) {
  const observed = value == null ? DEFAULT_DURATION_MS : value;
  if (!Number.isSafeInteger(observed) || observed < 1 || observed > MAX_DURATION_MS) fail('CACHE_LEASE_DURATION_INVALID');
  return observed;
}

function durationForPackages(packages, state) {
  if (!Array.isArray(packages) || !state || !state.steps || !state.attempts) fail('CACHE_LEASE_BUDGET_SOURCE_INVALID');
  let total = DEFAULT_DURATION_MS;
  for (const pkg of packages) {
    if (state.steps[pkg.id] && state.steps[pkg.id].state === 'VERIFIED') continue;
    const attempted = Number.isInteger(state.attempts[pkg.id]) ? state.attempts[pkg.id] : 0;
    const remaining = pkg.repair_policy.max_attempts - attempted;
    if (!Number.isSafeInteger(pkg.resource_budget.timeout_ms) || !Number.isSafeInteger(remaining) || remaining < 0) fail('CACHE_LEASE_BUDGET_SOURCE_INVALID');
    // A warm entry may consume one current-verifier budget before falling back
    // to a fresh executor plus a second current-verifier budget.
    const attemptBudget = pkg.resource_budget.timeout_ms * 3 + PACKAGE_MARGIN_MS;
    const packageBudget = attemptBudget * remaining;
    if (!Number.isSafeInteger(attemptBudget) || !Number.isSafeInteger(packageBudget) || !Number.isSafeInteger(total + packageBudget)) fail('CACHE_LEASE_DURATION_INVALID');
    total += packageBudget;
    if (total > MAX_DURATION_MS) fail('CACHE_LEASE_DURATION_INVALID');
  }
  return duration(total);
}

function location(options, create) {
  const state = create
    ? { root: ArtifactCache.assertCacheRoot(options.cacheRoot, options.sourceRoot, options.jobRoot), exists: true }
    : ArtifactCache.locate(options);
  const leasesRoot = path.join(state.root, 'leases');
  if (create && !fs.existsSync(leasesRoot)) fs.mkdirSync(leasesRoot, { recursive: false });
  const exists = fs.existsSync(leasesRoot);
  if (exists) {
    const stat = fs.lstatSync(leasesRoot);
    if (!stat.isDirectory() || stat.isSymbolicLink() || normalizedPath(fs.realpathSync.native(leasesRoot)) !== normalizedPath(leasesRoot)) fail('CACHE_LEASE_ROOT_NOT_PLAIN');
  }
  return { root: state.root, cacheExists: state.exists, leasesRoot, exists };
}

function ownerFor(options, cacheRoot) {
  if (!path.isAbsolute(String(options.jobRoot || '')) || !Contracts.portableId(options.runId) || !digest(options.planDigest) || typeof options.startedAt !== 'string' || !options.startedAt) fail('CACHE_LEASE_OWNER_INVALID');
  return {
    cache_root_fingerprint: rootFingerprint(cacheRoot),
    job_root_fingerprint: rootFingerprint(options.jobRoot),
    run_id_digest: Codec.sha256(Buffer.from(options.runId, 'utf8')),
    plan_digest: options.planDigest,
    run_started_at_digest: Codec.sha256(Buffer.from(options.startedAt, 'utf8'))
  };
}

function leaseIdFor(owner) { return Codec.digest({ schema: OWNER_SCHEMA, owner }); }
function ownerDigest(owner) { return Codec.digest(owner); }

function validateEvent(event) {
  const errors = [];
  if (!exactKeys(event, EVENT_KEYS)) return ['cache lease event shape is invalid'];
  if (event.schema !== EVENT_SCHEMA || event.version !== VERSION || !Codec.validDigest(event)) errors.push('cache lease event integrity is invalid');
  if (!exactKeys(event.owner, OWNER_KEYS) || Object.values(event.owner).some((value) => !digest(value)) || event.lease_id !== leaseIdFor(event.owner)) errors.push('cache lease owner binding is invalid');
  if (!['ACQUIRED', 'RENEWED', 'PROTECTED', 'RELEASED'].includes(event.event) || !digest(event.session_digest) || !Number.isSafeInteger(event.generation) || event.generation < 1 || !finiteInteger(event.observed_at_ms) || !finiteInteger(event.expires_at_ms)) errors.push('cache lease event state is invalid');
  if (ACTIVE_EVENTS.includes(event.event) ? event.expires_at_ms <= event.observed_at_ms : event.expires_at_ms !== event.observed_at_ms) errors.push('cache lease expiry is invalid');
  if (!Array.isArray(event.keys) || event.keys.length > MAX_KEYS || event.keys.some((key) => !digest(key)) || new Set(event.keys).size !== event.keys.length || Codec.canonical(event.keys) !== Codec.canonical(event.keys.slice().sort())) errors.push('cache lease keys are invalid');
  if (event.previous_event_digest !== null && !digest(event.previous_event_digest)) errors.push('cache lease previous event is invalid');
  const requesting = ACTIVE_EVENTS.includes(event.event);
  if (!exactKeys(event.authority, AUTHORITY_KEYS) || event.authority.cache_protection_requested !== requesting || Object.entries(event.authority).some(([key, value]) => key !== 'cache_protection_requested' && value !== false)) errors.push('cache lease authority is invalid');
  return errors;
}

function assertEvent(event) {
  const errors = validateEvent(event);
  if (errors.length) fail('CACHE_LEASE_EVENT_INVALID:' + errors.join('; '));
  return event;
}

function sameOwner(left, right) { return Codec.canonical(left) === Codec.canonical(right); }
function keysPreserved(previous, current) { return previous.every((key) => current.includes(key)); }

function validateTransition(previous, current) {
  if (current.previous_event_digest !== previous.digest || current.generation !== previous.generation + 1 || !sameOwner(current.owner, previous.owner) || current.lease_id !== previous.lease_id || current.observed_at_ms < previous.observed_at_ms) fail('CACHE_LEASE_LEDGER_CHAIN_INVALID');
  if (current.event === 'ACQUIRED') {
    if (previous.event !== 'RELEASED' || current.keys.length) fail('CACHE_LEASE_LEDGER_REACQUIRE_INVALID');
  } else if (current.event === 'RENEWED') {
    if (!ACTIVE_EVENTS.includes(previous.event) || Codec.canonical(current.keys) !== Codec.canonical(previous.keys) || current.expires_at_ms < previous.expires_at_ms) fail('CACHE_LEASE_LEDGER_RENEWAL_INVALID');
  } else if (current.event === 'PROTECTED') {
    if (!ACTIVE_EVENTS.includes(previous.event) || current.session_digest !== previous.session_digest || current.expires_at_ms !== previous.expires_at_ms || !keysPreserved(previous.keys, current.keys) || current.keys.length <= previous.keys.length) fail('CACHE_LEASE_LEDGER_PROTECTION_INVALID');
  } else if (current.event === 'RELEASED') {
    if (!ACTIVE_EVENTS.includes(previous.event) || current.session_digest !== previous.session_digest || Codec.canonical(current.keys) !== Codec.canonical(previous.keys)) fail('CACHE_LEASE_LEDGER_RELEASE_INVALID');
  }
}

function parseSegment(raw, expectedLeaseId, prefixTail) {
  const bytes = Buffer.isBuffer(raw) ? raw.length : Buffer.byteLength(String(raw || ''), 'utf8');
  if (bytes > MAX_LEDGER_BYTES) fail('CACHE_LEASE_LEDGER_BYTE_LIMIT');
  const trimmed = Buffer.isBuffer(raw) ? raw.toString('utf8').trim() : String(raw || '').trim();
  const lines = trimmed ? trimmed.split(/\r?\n/) : [];
  if (lines.length > MAX_EVENTS_PER_LEDGER) fail('CACHE_LEASE_LEDGER_EVENT_LIMIT');
  const events = lines.map((line) => {
    let event;
    try { event = JSON.parse(line); } catch (_) { fail('CACHE_LEASE_LEDGER_JSON_INVALID'); }
    return assertEvent(event);
  });
  for (let index = 0; index < events.length; index += 1) {
    const current = events[index], previous = index ? events[index - 1] : prefixTail || null;
    if (expectedLeaseId && current.lease_id !== expectedLeaseId) fail('CACHE_LEASE_LEDGER_FILE_BINDING_INVALID');
    if (!previous) {
      if (current.event !== 'ACQUIRED' || current.generation !== 1 || current.previous_event_digest !== null || current.keys.length) fail('CACHE_LEASE_LEDGER_ORIGIN_INVALID');
      continue;
    }
    validateTransition(previous, current);
  }
  return events;
}

function parseLedger(raw, expectedLeaseId) { return parseSegment(raw, expectedLeaseId, null); }

function readBoundedFile(file, maximum, missingAllowed) {
  if (!fs.existsSync(file)) {
    if (missingAllowed) return Buffer.alloc(0);
    fail('CACHE_LEASE_FILE_MISSING');
  }
  const before = fs.lstatSync(file);
  if (!before.isFile() || before.isSymbolicLink()) fail('CACHE_LEASE_FILE_NOT_PLAIN');
  const buffer = Buffer.allocUnsafe(maximum + 1);
  const handle = fs.openSync(file, 'r');
  let offset = 0;
  try {
    if (!fs.fstatSync(handle).isFile()) fail('CACHE_LEASE_FILE_NOT_PLAIN');
    while (offset <= maximum) {
      const read = fs.readSync(handle, buffer, offset, buffer.length - offset, null);
      if (read === 0) break;
      offset += read;
    }
  } finally { fs.closeSync(handle); }
  if (offset > maximum) fail('CACHE_LEASE_FILE_BYTE_LIMIT');
  return buffer.subarray(0, offset);
}

function archiveAuthority() {
  return { read_only_evidence: true, cache_protection: false, deletion: false, execution: false, installed: false, promoted: false, canon: false };
}

function validateArchiveReceipt(receipt) {
  if (!exactKeys(receipt, ARCHIVE_RECEIPT_KEYS) || receipt.schema !== ARCHIVE_RECEIPT_SCHEMA || receipt.version !== VERSION || !Codec.validDigest(receipt) || !digest(receipt.lease_id) || !digest(receipt.owner_digest) || (receipt.previous_archive_receipt_digest !== null && !digest(receipt.previous_archive_receipt_digest)) || (receipt.previous_anchor_digest !== null && !digest(receipt.previous_anchor_digest)) || !digest(receipt.source_segment_digest) || !finiteInteger(receipt.source_segment_bytes) || receipt.source_segment_bytes < 1 || receipt.source_segment_bytes > MAX_LEDGER_BYTES || !Number.isSafeInteger(receipt.source_event_count) || receipt.source_event_count < 1 || receipt.source_event_count > MAX_EVENTS_PER_LEDGER || !Number.isSafeInteger(receipt.source_first_generation) || receipt.source_first_generation < 1 || !Number.isSafeInteger(receipt.source_last_generation) || receipt.source_last_generation < receipt.source_first_generation || receipt.source_last_generation - receipt.source_first_generation + 1 !== receipt.source_event_count || !digest(receipt.source_tail_event_digest) || !digest(receipt.archive_blob_digest) || !finiteInteger(receipt.archive_blob_bytes) || receipt.archive_blob_bytes < 1 || receipt.archive_blob_bytes > MAX_LEDGER_BYTES + 65536 || !finiteInteger(receipt.recorded_at_ms) || !exactKeys(receipt.authority, ['read_only_evidence', 'cache_protection', 'deletion', 'execution', 'installed', 'promoted', 'canon']) || Codec.canonical(receipt.authority) !== Codec.canonical(archiveAuthority())) fail('CACHE_LEASE_ARCHIVE_RECEIPT_INVALID');
  return receipt;
}

function validateArchiveAnchor(anchor, expectedLeaseId) {
  if (!exactKeys(anchor, ANCHOR_KEYS) || anchor.schema !== ARCHIVE_ANCHOR_SCHEMA || anchor.version !== VERSION || !Codec.validDigest(anchor) || !digest(anchor.lease_id) || (expectedLeaseId && anchor.lease_id !== expectedLeaseId) || !exactKeys(anchor.owner, OWNER_KEYS) || Object.values(anchor.owner).some((value) => !digest(value)) || anchor.lease_id !== leaseIdFor(anchor.owner) || validateEvent(anchor.tail_event).length || anchor.tail_event.lease_id !== anchor.lease_id || !sameOwner(anchor.tail_event.owner, anchor.owner) || !Number.isSafeInteger(anchor.history_event_count) || anchor.history_event_count !== anchor.tail_event.generation || !Number.isSafeInteger(anchor.archived_segment_count) || anchor.archived_segment_count < 1 || !digest(anchor.latest_archive_receipt_digest) || !exactKeys(anchor.authority, ['read_only_evidence', 'cache_protection', 'deletion', 'execution', 'installed', 'promoted', 'canon']) || Codec.canonical(anchor.authority) !== Codec.canonical(archiveAuthority())) fail('CACHE_LEASE_ARCHIVE_ANCHOR_INVALID');
  return anchor;
}

function archiveDirectory(cacheRoot, leaseId, create) {
  const archives = path.join(cacheRoot, 'lease-archives');
  if (create && !fs.existsSync(archives)) fs.mkdirSync(archives, { recursive: false });
  if (!fs.existsSync(archives)) fail('CACHE_LEASE_ARCHIVE_ROOT_MISSING');
  let stat = fs.lstatSync(archives);
  if (!stat.isDirectory() || stat.isSymbolicLink() || normalizedPath(fs.realpathSync.native(archives)) !== normalizedPath(archives)) fail('CACHE_LEASE_ARCHIVE_ROOT_NOT_PLAIN');
  const directory = path.join(archives, leaseId);
  if (create && !fs.existsSync(directory)) fs.mkdirSync(directory, { recursive: false });
  if (!fs.existsSync(directory)) fail('CACHE_LEASE_ARCHIVE_DIRECTORY_MISSING');
  stat = fs.lstatSync(directory);
  if (!stat.isDirectory() || stat.isSymbolicLink() || normalizedPath(fs.realpathSync.native(directory)) !== normalizedPath(directory)) fail('CACHE_LEASE_ARCHIVE_DIRECTORY_NOT_PLAIN');
  return directory;
}

function archiveRecordFiles(cacheRoot, leaseId, receiptDigest, create) {
  if (!digest(leaseId) || !digest(receiptDigest)) fail('CACHE_LEASE_ARCHIVE_LOCATOR_INVALID');
  const directory = archiveDirectory(cacheRoot, leaseId, create);
  return { receipt: path.join(directory, receiptDigest + '.json'), blob: path.join(directory, receiptDigest + '.jsonl.gz') };
}

function readArchiveReceipt(cacheRoot, leaseId, receiptDigest) {
  const files = archiveRecordFiles(cacheRoot, leaseId, receiptDigest, false);
  let receipt, raw;
  try { raw = readBoundedFile(files.receipt, MAX_ARCHIVE_RECEIPT_BYTES, false); receipt = JSON.parse(raw.toString('utf8')); }
  catch (error) { if (error instanceof LeaseError) throw error; fail('CACHE_LEASE_ARCHIVE_RECEIPT_UNREADABLE'); }
  validateArchiveReceipt(receipt);
  if (receipt.digest !== receiptDigest || receipt.lease_id !== leaseId) fail('CACHE_LEASE_ARCHIVE_RECEIPT_BINDING_INVALID');
  const blobStat = fs.lstatSync(files.blob);
  if (!blobStat.isFile() || blobStat.isSymbolicLink() || blobStat.size !== receipt.archive_blob_bytes) fail('CACHE_LEASE_ARCHIVE_BLOB_SHAPE_INVALID');
  return { receipt, files, bytes: raw.length };
}

function readArchiveAnchor(cacheRoot, anchorFile, leaseId) {
  if (!fs.existsSync(anchorFile)) return null;
  let anchor, raw;
  try { raw = readBoundedFile(anchorFile, MAX_ANCHOR_BYTES, false); anchor = JSON.parse(raw.toString('utf8')); }
  catch (error) { if (error instanceof LeaseError) throw error; fail('CACHE_LEASE_ARCHIVE_ANCHOR_UNREADABLE'); }
  validateArchiveAnchor(anchor, leaseId);
  const latest = readArchiveReceipt(cacheRoot, leaseId, anchor.latest_archive_receipt_digest);
  if (latest.receipt.owner_digest !== ownerDigest(anchor.owner) || latest.receipt.source_tail_event_digest !== anchor.tail_event.digest || latest.receipt.source_last_generation !== anchor.history_event_count) fail('CACHE_LEASE_ARCHIVE_HEAD_BINDING_INVALID');
  return { anchor, latest, bytes: raw.length };
}

function leaseStorageFiles(cache, leaseId) {
  return { ledger: path.join(cache.leasesRoot, leaseId + '.jsonl'), anchor: path.join(cache.leasesRoot, leaseId + '.anchor.json') };
}

function detachedSegment(raw, leaseId, receipt) {
  const trimmed = raw.toString('utf8').trim(), lines = trimmed ? trimmed.split(/\r?\n/) : [];
  if (lines.length !== receipt.source_event_count || lines.length > MAX_EVENTS_PER_LEDGER) fail('CACHE_LEASE_ARCHIVE_SOURCE_COUNT_INVALID');
  const events = lines.map((line) => {
    let event;
    try { event = JSON.parse(line); } catch (_) { fail('CACHE_LEASE_LEDGER_JSON_INVALID'); }
    return assertEvent(event);
  });
  if (!events.length || events[0].lease_id !== leaseId || events[0].generation !== receipt.source_first_generation || events[events.length - 1].digest !== receipt.source_tail_event_digest || events[events.length - 1].generation !== receipt.source_last_generation) fail('CACHE_LEASE_ARCHIVE_SOURCE_BINDING_INVALID');
  for (let index = 1; index < events.length; index += 1) validateTransition(events[index - 1], events[index]);
  return events;
}

function readLeaseStorage(cache, leaseId) {
  const files = leaseStorageFiles(cache, leaseId), anchorState = readArchiveAnchor(cache.root, files.anchor, leaseId);
  const raw = readBoundedFile(files.ledger, MAX_LEDGER_BYTES, true);
  if (!raw.length && !anchorState) return { files, anchor: null, latestArchive: null, raw, events: [], tail: null, compactionPending: false, storedRecords: 0, historyEvents: 0, archivedEvents: 0, archivedSegments: 0, storageBytes: 0 };
  const anchor = anchorState && anchorState.anchor, latestArchive = anchorState && anchorState.latest.receipt;
  let events = [], compactionPending = false;
  if (raw.length && anchor && Codec.sha256(raw) === latestArchive.source_segment_digest && raw.length === latestArchive.source_segment_bytes) {
    events = detachedSegment(raw, leaseId, latestArchive);
    compactionPending = true;
  } else if (raw.length) events = parseSegment(raw, leaseId, anchor ? anchor.tail_event : null);
  const tail = compactionPending ? anchor.tail_event : events.length ? events[events.length - 1] : anchor && anchor.tail_event;
  if (!tail) fail('CACHE_LEASE_LEDGER_EMPTY');
  const archivedEvents = anchor ? anchor.history_event_count : 0;
  if (!compactionPending && tail.generation !== archivedEvents + events.length) fail('CACHE_LEASE_ARCHIVE_HISTORY_COUNT_INVALID');
  return {
    files,
    anchor,
    latestArchive,
    raw,
    events,
    tail,
    compactionPending,
    storedRecords: (anchor ? 1 : 0) + events.length,
    historyEvents: tail.generation,
    archivedEvents,
    archivedSegments: anchor ? anchor.archived_segment_count : 0,
    storageBytes: raw.length + (anchorState ? anchorState.bytes + anchorState.latest.bytes : 0)
  };
}

function appendEvent(file, event, prefixTail) {
  assertEvent(event);
  const existing = readBoundedFile(file, MAX_LEDGER_BYTES, true);
  const separator = existing.length && existing[existing.length - 1] !== 10 && existing[existing.length - 1] !== 13 ? '\n' : '';
  const addition = Buffer.from(separator + JSON.stringify(event) + '\n', 'utf8');
  if (existing.length + addition.length > MAX_LEDGER_BYTES) fail('CACHE_LEASE_LEDGER_BYTE_LIMIT');
  parseSegment(Buffer.concat([existing, addition]), event.lease_id, prefixTail || null);
  fs.appendFileSync(file, addition, { flag: 'a' });
  return event;
}

function ensurePlainDirectory(directory) {
  if (!fs.existsSync(directory)) fs.mkdirSync(directory, { recursive: false });
  const stat = fs.lstatSync(directory);
  if (!stat.isDirectory() || stat.isSymbolicLink() || normalizedPath(fs.realpathSync.native(directory)) !== normalizedPath(directory)) fail('CACHE_LEASE_COORDINATION_ROOT_NOT_PLAIN');
}

function processAlive(pid) {
  if (!Number.isSafeInteger(pid) || pid < 1) return false;
  if (pid === process.pid) return true;
  try { process.kill(pid, 0); return true; }
  catch (error) { return !(error && error.code === 'ESRCH'); }
}

function validateLock(lock) {
  return exactKeys(lock, ['schema', 'version', 'namespace', 'id', 'token', 'pid', 'created_at_ms', 'expires_at_ms', 'authority', 'digest']) &&
    lock.schema === LOCK_SCHEMA && lock.version === VERSION && ['key', 'lease'].includes(lock.namespace) && digest(lock.id) && digest(lock.token) && Number.isSafeInteger(lock.pid) && lock.pid > 0 && finiteInteger(lock.created_at_ms) && finiteInteger(lock.expires_at_ms) && lock.expires_at_ms > lock.created_at_ms &&
    exactKeys(lock.authority, ['cache_write', 'deletion', 'installed', 'promoted', 'canon']) && Object.values(lock.authority).every((value) => value === false) && Codec.validDigest(lock);
}

function lockFile(options, namespace, id) {
  if (!['key', 'lease'].includes(namespace) || !digest(id)) fail('CACHE_LEASE_LOCK_ID_INVALID');
  const cache = location(options, true);
  const coordination = path.join(cache.root, 'coordination');
  ensurePlainDirectory(coordination);
  const namespaceRoot = path.join(coordination, namespace === 'key' ? 'keys' : 'leases');
  ensurePlainDirectory(namespaceRoot);
  let parent = namespaceRoot;
  if (namespace === 'key') {
    parent = path.join(namespaceRoot, id.slice(0, 2));
    ensurePlainDirectory(parent);
  }
  return path.join(parent, id + '.lock');
}

function recoverableLock(file, now) {
  const stat = fs.lstatSync(file);
  if (!stat.isFile() || stat.isSymbolicLink()) fail('CACHE_LEASE_LOCK_NOT_PLAIN');
  let raw, lock = null;
  try {
    raw = readBoundedFile(file, MAX_LOCK_BYTES, false);
    lock = JSON.parse(raw.toString('utf8'));
  } catch (_) {}
  if (lock && validateLock(lock)) {
    if (lock.expires_at_ms > now || processAlive(lock.pid)) return false;
  } else if (Math.trunc(stat.mtimeMs) + LOCK_STALE_GRACE_MS > now) return false;
  const before = raw ? Codec.sha256(raw) : null;
  let current;
  try { current = readBoundedFile(file, MAX_LOCK_BYTES, false); } catch (_) { return false; }
  if (before !== Codec.sha256(current)) return false;
  fs.unlinkSync(file);
  return true;
}

function acquireLock(options, namespace, id) {
  const file = lockFile(options, namespace, id);
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const now = Date.now(), token = Codec.sha256(crypto.randomBytes(32));
    const lock = Codec.seal({ schema: LOCK_SCHEMA, version: VERSION, namespace, id, token, pid: process.pid, created_at_ms: now, expires_at_ms: now + LOCK_DURATION_MS, authority: { cache_write: false, deletion: false, installed: false, promoted: false, canon: false } });
    let handle;
    try { handle = fs.openSync(file, 'wx'); }
    catch (error) {
      if (!error || error.code !== 'EEXIST') throw error;
      if (attempt === 0 && recoverableLock(file, now)) continue;
      fail('CACHE_LEASE_COORDINATION_BUSY');
    }
    try { fs.writeFileSync(handle, JSON.stringify(lock) + '\n'); }
    finally { fs.closeSync(handle); }
    return { file, token };
  }
  fail('CACHE_LEASE_COORDINATION_BUSY');
}

function releaseLock(lock) {
  const raw = readBoundedFile(lock.file, MAX_LOCK_BYTES, false);
  let observed;
  try { observed = JSON.parse(raw.toString('utf8')); } catch (_) { fail('CACHE_LEASE_LOCK_RELEASE_REFUSED'); }
  if (!validateLock(observed) || observed.token !== lock.token || observed.pid !== process.pid) fail('CACHE_LEASE_LOCK_RELEASE_REFUSED');
  fs.unlinkSync(lock.file);
}

function withLocks(options, descriptors, action) {
  const unique = Array.from(new Map(descriptors.map((item) => [item.namespace + ':' + item.id, item])).values()).sort((left, right) => (left.namespace + ':' + left.id).localeCompare(right.namespace + ':' + right.id));
  const locks = [];
  let result, primaryError = null, cleanupError = null;
  try {
    for (const descriptor of unique) locks.push(acquireLock(options, descriptor.namespace, descriptor.id));
    result = action();
  } catch (error) {
    primaryError = error;
  }
  for (const lock of locks.reverse()) {
    try { releaseLock(lock); }
    catch (error) { if (!cleanupError) cleanupError = error; }
  }
  if (primaryError) throw primaryError;
  if (cleanupError) throw cleanupError;
  return result;
}

function withKeyLock(options, key, action) {
  if (!digest(key) || typeof action !== 'function') fail('CACHE_LEASE_KEY_LOCK_INPUT_INVALID');
  return withLocks(options, [{ namespace: 'key', id: key }], action);
}

function withLeaseLock(options, leaseId, action) {
  if (!digest(leaseId) || typeof action !== 'function') fail('CACHE_LEASE_LOCK_INPUT_INVALID');
  return withLocks(options, [{ namespace: 'lease', id: leaseId }], action);
}

function eventAuthority(active) {
  return { cache_protection_requested: active, deletion: false, execution: false, installed: false, promoted: false, canon: false, released: false };
}

function newEvent(owner, eventName, sessionDigest, generation, observedAt, expiresAt, keys, previousDigest) {
  return assertEvent(Codec.seal({
    schema: EVENT_SCHEMA,
    version: VERSION,
    lease_id: leaseIdFor(owner),
    owner: clone(owner),
    event: eventName,
    session_digest: sessionDigest,
    generation,
    observed_at_ms: observedAt,
    expires_at_ms: expiresAt,
    keys: keys.slice().sort(),
    previous_event_digest: previousDigest,
    authority: eventAuthority(eventName !== 'RELEASED')
  }));
}

function acquire(options) {
  options = options || {};
  const cache = location(options, true), owner = ownerFor(options, cache.root), leaseId = leaseIdFor(owner);
  const file = path.join(cache.leasesRoot, leaseId + '.jsonl');
  const observedAt = options.nowMs == null ? Date.now() : options.nowMs;
  const leaseDuration = duration(options.durationMs);
  if (!finiteInteger(observedAt) || !Number.isSafeInteger(observedAt + leaseDuration)) fail('CACHE_LEASE_TIME_INVALID');
  const sessionDigest = Codec.sha256(crypto.randomBytes(32));
  let tail;
  withLocks(options, [{ namespace: 'lease', id: leaseId }], () => {
    const storage = readLeaseStorage(cache, leaseId), previous = storage.tail;
    if (storage.compactionPending) fail('CACHE_LEASE_COMPACTION_INCOMPLETE');
    if (previous && !sameOwner(previous.owner, owner)) fail('CACHE_LEASE_OWNER_DRIFT');
    const keys = previous && previous.event !== 'RELEASED' ? previous.keys : [];
    const descriptors = keys.map((key) => ({ namespace: 'key', id: key }));
    withLocks(options, descriptors, () => {
      const deadline = previous && previous.event !== 'RELEASED' ? Math.max(previous.expires_at_ms, observedAt + leaseDuration) : observedAt + leaseDuration;
      const name = previous && previous.event !== 'RELEASED' ? 'RENEWED' : 'ACQUIRED';
      tail = newEvent(owner, name, sessionDigest, previous ? previous.generation + 1 : 1, observedAt, deadline, keys, previous ? previous.digest : null);
      appendEvent(file, tail, storage.anchor ? storage.anchor.tail_event : null);
    });
  });
  let closed = false;
  return Object.freeze({
    leaseId,
    ownerDigest: ownerDigest(owner),
    get event() { return clone(tail); },
    protect(key, nowMs) {
      if (closed || !digest(key)) fail('CACHE_LEASE_SESSION_INVALID');
      const now = nowMs == null ? Date.now() : nowMs;
      if (!finiteInteger(now) || now >= tail.expires_at_ms) fail('CACHE_LEASE_SESSION_EXPIRED');
      withLocks(options, [{ namespace: 'lease', id: leaseId }], () => {
        const storage = readLeaseStorage(cache, leaseId), current = storage.tail;
        if (storage.compactionPending) fail('CACHE_LEASE_COMPACTION_INCOMPLETE');
        if (!current || current.session_digest !== sessionDigest || !ACTIVE_EVENTS.includes(current.event)) fail('CACHE_LEASE_SESSION_STALE');
        if (current.keys.includes(key)) { tail = current; return; }
        withLocks(options, [{ namespace: 'key', id: key }], () => {
          const keys = current.keys.concat(key).sort();
          tail = newEvent(owner, 'PROTECTED', sessionDigest, current.generation + 1, now, current.expires_at_ms, keys, current.digest);
          appendEvent(file, tail, storage.anchor ? storage.anchor.tail_event : null);
        });
      });
      return clone(tail);
    },
    release(nowMs) {
      if (closed) return clone(tail);
      const now = nowMs == null ? Date.now() : nowMs;
      if (!finiteInteger(now)) fail('CACHE_LEASE_TIME_INVALID');
      withLocks(options, [{ namespace: 'lease', id: leaseId }], () => {
        const storage = readLeaseStorage(cache, leaseId), current = storage.tail;
        if (storage.compactionPending) fail('CACHE_LEASE_COMPACTION_INCOMPLETE');
        if (!current || current.session_digest !== sessionDigest || !ACTIVE_EVENTS.includes(current.event)) fail('CACHE_LEASE_SESSION_STALE');
        tail = newEvent(owner, 'RELEASED', sessionDigest, current.generation + 1, now, now, current.keys, current.digest);
        appendEvent(file, tail, storage.anchor ? storage.anchor.tail_event : null);
      });
      closed = true;
      return clone(tail);
    }
  });
}

function scanBudget(options) {
  const directoryEntries = options.scanMaxDirectoryEntries == null ? DEFAULT_MAX_DIRECTORY_ENTRIES : options.scanMaxDirectoryEntries;
  const ledgers = options.scanMaxLedgers == null ? DEFAULT_MAX_LEDGERS : options.scanMaxLedgers;
  const events = options.scanMaxEvents == null ? DEFAULT_MAX_EVENTS : options.scanMaxEvents;
  const bytes = options.scanMaxBytes == null ? DEFAULT_MAX_BYTES : options.scanMaxBytes;
  if (!Number.isInteger(directoryEntries) || directoryEntries < 1 || directoryEntries > DEFAULT_MAX_DIRECTORY_ENTRIES || !Number.isInteger(ledgers) || ledgers < 1 || ledgers > DEFAULT_MAX_LEDGERS || !Number.isInteger(events) || events < 1 || events > DEFAULT_MAX_EVENTS || !Number.isSafeInteger(bytes) || bytes < 1 || bytes > DEFAULT_MAX_BYTES) fail('CACHE_LEASE_SCAN_BUDGET_INVALID');
  return { max_directory_entries: directoryEntries, max_ledgers: ledgers, max_events: events, max_bytes: bytes, max_single_ledger_bytes: MAX_LEDGER_BYTES, max_events_per_ledger: MAX_EVENTS_PER_LEDGER };
}

function boundedNames(root, maximum) {
  const directory = fs.opendirSync(root), names = [];
  let exceeded = false;
  try {
    for (;;) {
      const entry = directory.readSync();
      if (entry === null) break;
      if (names.length >= maximum) { exceeded = true; break; }
      names.push(entry.name);
    }
  } finally { directory.closeSync(); }
  return { names: names.sort(), exceeded };
}

function writeExactFile(file, bytes) {
  if (fs.existsSync(file)) {
    const existing = readBoundedFile(file, bytes.length, false);
    if (existing.length !== bytes.length || !existing.equals(bytes)) fail('CACHE_LEASE_ARCHIVE_FILE_CONFLICT');
    return false;
  }
  fs.writeFileSync(file, bytes, { flag: 'wx' });
  return true;
}

function replaceAnchor(file, anchor, temporaryRoot) {
  const temporary = path.join(temporaryRoot, anchor.digest + '.anchor.next-' + process.pid + '-' + crypto.randomBytes(8).toString('hex'));
  fs.writeFileSync(temporary, JSON.stringify(anchor) + '\n', { flag: 'wx' });
  try { fs.renameSync(temporary, file); }
  finally { if (fs.existsSync(temporary)) fs.unlinkSync(temporary); }
}

function archiveCandidate(options, candidate, recordedAtValue) {
  options = options || {};
  const recordedAt = recordedAtValue == null ? Date.now() : recordedAtValue;
  if (!finiteInteger(recordedAt) || !candidate || !digest(candidate.lease_id) || !digest(candidate.tail_event_digest) || !digest(candidate.live_segment_digest) || !finiteInteger(candidate.live_segment_bytes) || candidate.live_segment_bytes < 1 || !Number.isInteger(candidate.live_segment_events) || candidate.live_segment_events < 1 || !Number.isInteger(candidate.generation) || candidate.generation < 1 || !['EXPIRED', 'RELEASED'].includes(candidate.state) || (candidate.archive_anchor_digest !== null && !digest(candidate.archive_anchor_digest))) fail('CACHE_LEASE_ARCHIVE_CANDIDATE_INVALID');
  const cache = location(options, true), leaseId = candidate.lease_id;
  let outcome;
  withLeaseLock(options, leaseId, () => {
    const storage = readLeaseStorage(cache, leaseId);
    const latestMatches = storage.anchor && storage.latestArchive && storage.latestArchive.owner_digest === candidate.owner_digest && storage.latestArchive.previous_anchor_digest === candidate.archive_anchor_digest && storage.latestArchive.source_segment_digest === candidate.live_segment_digest && storage.latestArchive.source_segment_bytes === candidate.live_segment_bytes && storage.latestArchive.source_event_count === candidate.live_segment_events && storage.latestArchive.source_last_generation === candidate.generation && storage.latestArchive.source_tail_event_digest === candidate.tail_event_digest;
    if (storage.compactionPending && latestMatches) {
      fs.unlinkSync(storage.files.ledger);
      outcome = { status: 'RECOVERED', lease_id: leaseId, source_segment_digest: candidate.live_segment_digest, source_removed: !fs.existsSync(storage.files.ledger), archive_receipt_digest: storage.latestArchive.digest, archive_anchor_digest: storage.anchor.digest, archived_event_count: storage.anchor.history_event_count };
      return;
    }
    if (!storage.raw.length && latestMatches) {
      outcome = { status: 'ALREADY_ARCHIVED', lease_id: leaseId, source_segment_digest: candidate.live_segment_digest, source_removed: true, archive_receipt_digest: storage.latestArchive.digest, archive_anchor_digest: storage.anchor.digest, archived_event_count: storage.anchor.history_event_count };
      return;
    }
    if (storage.compactionPending || !storage.raw.length || ownerDigest(storage.tail.owner) !== candidate.owner_digest || storage.tail.digest !== candidate.tail_event_digest || storage.tail.generation !== candidate.generation || storage.tail.expires_at_ms !== candidate.expires_at_ms || Codec.sha256(storage.raw) !== candidate.live_segment_digest || storage.raw.length !== candidate.live_segment_bytes || storage.events.length !== candidate.live_segment_events || (storage.anchor ? storage.anchor.digest : null) !== candidate.archive_anchor_digest) fail('CACHE_LEASE_ARCHIVE_CANDIDATE_STALE');
    const active = ACTIVE_EVENTS.includes(storage.tail.event) && storage.tail.expires_at_ms > recordedAt;
    const state = storage.tail.event === 'RELEASED' ? 'RELEASED' : active ? 'ACTIVE' : 'EXPIRED';
    if (state !== candidate.state || state === 'ACTIVE') fail('CACHE_LEASE_ARCHIVE_CANDIDATE_STALE');
    const blob = zlib.gzipSync(storage.raw, { level: 9, mtime: 0 });
    const receipt = validateArchiveReceipt(Codec.seal({
      schema: ARCHIVE_RECEIPT_SCHEMA,
      version: VERSION,
      lease_id: leaseId,
      owner_digest: ownerDigest(storage.tail.owner),
      previous_archive_receipt_digest: storage.anchor ? storage.anchor.latest_archive_receipt_digest : null,
      previous_anchor_digest: storage.anchor ? storage.anchor.digest : null,
      source_segment_digest: Codec.sha256(storage.raw),
      source_segment_bytes: storage.raw.length,
      source_event_count: storage.events.length,
      source_first_generation: storage.events[0].generation,
      source_last_generation: storage.tail.generation,
      source_tail_event_digest: storage.tail.digest,
      archive_blob_digest: Codec.sha256(blob),
      archive_blob_bytes: blob.length,
      recorded_at_ms: recordedAt,
      authority: archiveAuthority()
    }));
    const files = archiveRecordFiles(cache.root, leaseId, receipt.digest, true);
    writeExactFile(files.blob, blob);
    writeExactFile(files.receipt, Buffer.from(JSON.stringify(receipt) + '\n', 'utf8'));
    const anchor = validateArchiveAnchor(Codec.seal({
      schema: ARCHIVE_ANCHOR_SCHEMA,
      version: VERSION,
      lease_id: leaseId,
      owner: clone(storage.tail.owner),
      tail_event: clone(storage.tail),
      history_event_count: storage.tail.generation,
      archived_segment_count: storage.archivedSegments + 1,
      latest_archive_receipt_digest: receipt.digest,
      authority: archiveAuthority()
    }), leaseId);
    replaceAnchor(storage.files.anchor, anchor, path.dirname(files.receipt));
    fs.unlinkSync(storage.files.ledger);
    outcome = { status: 'ARCHIVED', lease_id: leaseId, source_segment_digest: candidate.live_segment_digest, source_removed: !fs.existsSync(storage.files.ledger), archive_receipt_digest: receipt.digest, archive_anchor_digest: anchor.digest, archived_event_count: anchor.history_event_count };
  });
  return Object.freeze(clone(outcome));
}

function archiveAuditBudget(options) {
  const anchors = options.auditMaxAnchors == null ? DEFAULT_MAX_LEDGERS : options.auditMaxAnchors;
  const segments = options.auditMaxSegments == null ? DEFAULT_MAX_ARCHIVE_SEGMENTS : options.auditMaxSegments;
  const compressed = options.auditMaxCompressedBytes == null ? DEFAULT_MAX_ARCHIVE_COMPRESSED_BYTES : options.auditMaxCompressedBytes;
  const raw = options.auditMaxRawBytes == null ? DEFAULT_MAX_ARCHIVE_RAW_BYTES : options.auditMaxRawBytes;
  if (!Number.isInteger(anchors) || anchors < 1 || anchors > DEFAULT_MAX_LEDGERS || !Number.isInteger(segments) || segments < 1 || segments > DEFAULT_MAX_ARCHIVE_SEGMENTS || !Number.isSafeInteger(compressed) || compressed < 1 || compressed > DEFAULT_MAX_ARCHIVE_COMPRESSED_BYTES || !Number.isSafeInteger(raw) || raw < 1 || raw > DEFAULT_MAX_ARCHIVE_RAW_BYTES) fail('CACHE_LEASE_ARCHIVE_AUDIT_BUDGET_INVALID');
  return { max_anchors: anchors, max_segments: segments, max_compressed_bytes: compressed, max_raw_bytes: raw };
}

function auditArchives(options) {
  options = options || {};
  const cache = location(options, false), budget = archiveAuditBudget(options), observedAt = options.nowMs == null ? Date.now() : options.nowMs;
  if (!finiteInteger(observedAt)) fail('CACHE_LEASE_ARCHIVE_AUDIT_TIME_INVALID');
  const audit = { schema: ARCHIVE_AUDIT_SCHEMA, version: VERSION, status: 'COMPLETE', observed_at_ms: observedAt, cache_root_fingerprint: rootFingerprint(cache.root), scan_budget: budget, anchors: [], holds: [], usage: { anchors: 0, segments: 0, compressed_bytes: 0, raw_bytes: 0, history_events: 0 }, authority: { read_only: true, cache_protection: false, deletion: false, installed: false, promoted: false, canon: false } };
  if (cache.exists) {
    const direct = boundedNames(cache.leasesRoot, DEFAULT_MAX_DIRECTORY_ENTRIES), anchorNames = direct.names.filter((name) => /^[a-f0-9]{64}\.anchor\.json$/.test(name));
    for (const name of anchorNames) {
      const leaseId = name.slice(0, 64), locator = locatorDigest('leases/' + name);
      audit.usage.anchors += 1;
      if (audit.usage.anchors > budget.max_anchors) { audit.status = 'LIMIT_EXCEEDED'; audit.holds.push({ locator_digest: locator, reason: 'CACHE_LEASE_ARCHIVE_AUDIT_ANCHOR_LIMIT' }); break; }
      try {
        const anchorState = readArchiveAnchor(cache.root, path.join(cache.leasesRoot, name), leaseId), receipts = [], seen = new Set();
        let next = anchorState.anchor.latest_archive_receipt_digest;
        while (next) {
          if (seen.has(next)) fail('CACHE_LEASE_ARCHIVE_RECEIPT_CYCLE');
          seen.add(next);
          audit.usage.segments += 1;
          if (audit.usage.segments > budget.max_segments) fail('CACHE_LEASE_ARCHIVE_AUDIT_SEGMENT_LIMIT');
          const record = readArchiveReceipt(cache.root, leaseId, next);
          receipts.push(record);
          next = record.receipt.previous_archive_receipt_digest;
        }
        receipts.reverse();
        if (receipts.length !== anchorState.anchor.archived_segment_count) fail('CACHE_LEASE_ARCHIVE_SEGMENT_COUNT_INVALID');
        let prefix = null, historyEvents = 0, previousReceiptDigest = null, previousAnchorDigest = null;
        for (let index = 0; index < receipts.length; index += 1) {
          const record = receipts[index];
          if (record.receipt.previous_archive_receipt_digest !== previousReceiptDigest || record.receipt.previous_anchor_digest !== previousAnchorDigest) fail('CACHE_LEASE_ARCHIVE_PREDECESSOR_BINDING_INVALID');
          audit.usage.compressed_bytes += record.receipt.archive_blob_bytes;
          if (audit.usage.compressed_bytes > budget.max_compressed_bytes) fail('CACHE_LEASE_ARCHIVE_AUDIT_COMPRESSED_BYTE_LIMIT');
          const blob = readBoundedFile(record.files.blob, MAX_LEDGER_BYTES + 65536, false);
          if (Codec.sha256(blob) !== record.receipt.archive_blob_digest) fail('CACHE_LEASE_ARCHIVE_BLOB_DIGEST_INVALID');
          let raw;
          try { raw = zlib.gunzipSync(blob, { maxOutputLength: MAX_LEDGER_BYTES }); }
          catch (_) { fail('CACHE_LEASE_ARCHIVE_BLOB_DECOMPRESSION_INVALID'); }
          audit.usage.raw_bytes += raw.length;
          if (audit.usage.raw_bytes > budget.max_raw_bytes) fail('CACHE_LEASE_ARCHIVE_AUDIT_RAW_BYTE_LIMIT');
          if (raw.length !== record.receipt.source_segment_bytes || Codec.sha256(raw) !== record.receipt.source_segment_digest) fail('CACHE_LEASE_ARCHIVE_SOURCE_DIGEST_INVALID');
          const events = parseSegment(raw, leaseId, prefix);
          if (events.length !== record.receipt.source_event_count || events[0].generation !== record.receipt.source_first_generation || events[events.length - 1].generation !== record.receipt.source_last_generation || events[events.length - 1].digest !== record.receipt.source_tail_event_digest) fail('CACHE_LEASE_ARCHIVE_SOURCE_BINDING_INVALID');
          prefix = events[events.length - 1];
          historyEvents += events.length;
          previousReceiptDigest = record.receipt.digest;
          previousAnchorDigest = Codec.seal({
            schema: ARCHIVE_ANCHOR_SCHEMA,
            version: VERSION,
            lease_id: leaseId,
            owner: clone(anchorState.anchor.owner),
            tail_event: clone(prefix),
            history_event_count: historyEvents,
            archived_segment_count: index + 1,
            latest_archive_receipt_digest: previousReceiptDigest,
            authority: archiveAuthority()
          }).digest;
        }
        if (!prefix || prefix.digest !== anchorState.anchor.tail_event.digest || historyEvents !== anchorState.anchor.history_event_count || previousAnchorDigest !== anchorState.anchor.digest) fail('CACHE_LEASE_ARCHIVE_HISTORY_BINDING_INVALID');
        audit.usage.history_events += historyEvents;
        audit.anchors.push({ lease_id: leaseId, anchor_digest: anchorState.anchor.digest, tail_event_digest: prefix.digest, archived_segments: receipts.length, history_events: historyEvents, latest_archive_receipt_digest: anchorState.anchor.latest_archive_receipt_digest });
      } catch (error) {
        const reason = error instanceof LeaseError ? error.code : 'CACHE_LEASE_ARCHIVE_AUDIT_FAILED';
        if (reason.includes('_LIMIT')) audit.status = 'LIMIT_EXCEEDED';
        audit.holds.push({ locator_digest: locator, reason });
        if (audit.status === 'LIMIT_EXCEEDED') break;
      }
    }
    if (direct.exceeded && audit.status !== 'LIMIT_EXCEEDED') { audit.status = 'LIMIT_EXCEEDED'; audit.holds.push({ locator_digest: locatorDigest('leases/directory-entry-limit'), reason: 'CACHE_LEASE_ARCHIVE_AUDIT_DIRECTORY_LIMIT' }); }
  }
  audit.anchors.sort((left, right) => left.lease_id.localeCompare(right.lease_id));
  audit.holds.sort((left, right) => left.locator_digest.localeCompare(right.locator_digest) || left.reason.localeCompare(right.reason));
  if (audit.status === 'COMPLETE' && audit.holds.length) audit.status = 'REVIEW_REQUIRED';
  return Codec.seal(audit);
}

function snapshotDigest(receipt) {
  return Codec.digest({
    cache_root_fingerprint: receipt.cache_root_fingerprint,
    root_exists: receipt.root_exists,
    ledgers: receipt.leases.map((lease) => ({ lease_id: lease.lease_id, owner_digest: lease.owner_digest, tail_event_digest: lease.tail_event_digest, event: lease.event, generation: lease.generation, expires_at_ms: lease.expires_at_ms, key_count: lease.key_count, key_set_digest: lease.key_set_digest, archive_anchor_digest: lease.archive_anchor_digest, archived_segments: lease.archived_segments, archived_events: lease.archived_events, live_segment_digest: lease.live_segment_digest, live_segment_events: lease.live_segment_events, live_segment_bytes: lease.live_segment_bytes, compaction_pending: lease.compaction_pending })),
    holds: receipt.holds,
    ignored_files: receipt.ignored_files
  });
}

function discover(options) {
  options = options || {};
  const cache = location(options, false), budget = scanBudget(options);
  const observedAt = options.nowMs == null ? Date.now() : options.nowMs;
  if (!finiteInteger(observedAt)) fail('CACHE_LEASE_OBSERVATION_TIME_INVALID');
  const receipt = {
    schema: SET_SCHEMA,
    version: VERSION,
    status: 'COMPLETE',
    observed_at_ms: observedAt,
    cache_root_fingerprint: rootFingerprint(cache.root),
    root_exists: cache.cacheExists,
    lease_root_exists: cache.exists,
    scan_budget: budget,
    leases: [],
    protected_keys: [],
    holds: [],
    ignored_files: 0,
    usage: { ledgers: 0, events: 0, history_events: 0, bytes: 0, archives: 0, active: 0, expired: 0, released: 0, protected_keys: 0 },
    snapshot_digest: null,
    authority: { read_only: true, protection_granted: false, deletion: false, installed: false, promoted: false, canon: false }
  };
  if (cache.exists) {
    const direct = boundedNames(cache.leasesRoot, budget.max_directory_entries), protectedKeys = new Set(), groups = new Map();
    for (const name of direct.names) {
      const relative = 'leases/' + name, file = path.join(cache.leasesRoot, name), ledgerMatch = /^([a-f0-9]{64})\.jsonl$/.exec(name), anchorMatch = /^([a-f0-9]{64})\.anchor\.json$/.exec(name), match = ledgerMatch || anchorMatch;
      if (!match) { receipt.ignored_files += 1; receipt.holds.push({ locator_digest: locatorDigest(relative), reason: 'CACHE_LEASE_STORAGE_NAME_INVALID' }); continue; }
      const stat = fs.lstatSync(file);
      if (!stat.isFile() || stat.isSymbolicLink()) { receipt.holds.push({ locator_digest: locatorDigest(relative), reason: 'CACHE_LEASE_STORAGE_NOT_PLAIN' }); continue; }
      if (!groups.has(match[1])) groups.set(match[1], { leaseId: match[1] });
      groups.get(match[1])[ledgerMatch ? 'ledger' : 'anchor'] = file;
    }
    for (const leaseId of Array.from(groups.keys()).sort()) {
      const relative = 'leases/' + leaseId, storageFiles = groups.get(leaseId);
      receipt.usage.ledgers += 1;
      if (receipt.usage.ledgers > budget.max_ledgers) { receipt.status = 'LIMIT_EXCEEDED'; receipt.holds.push({ locator_digest: locatorDigest(relative), reason: 'CACHE_LEASE_SCAN_LEDGER_LIMIT' }); break; }
      let storage;
      try {
        storage = readLeaseStorage(cache, leaseId);
        receipt.usage.bytes += storage.storageBytes;
        if (receipt.usage.bytes > budget.max_bytes) fail('CACHE_LEASE_SCAN_BYTE_LIMIT');
        receipt.usage.events += storage.storedRecords;
        if (receipt.usage.events > budget.max_events) fail('CACHE_LEASE_SCAN_EVENT_LIMIT');
        receipt.usage.history_events += storage.historyEvents;
        receipt.usage.archives += storage.archivedSegments;
      } catch (error) {
        const reason = error instanceof LeaseError ? error.code : 'CACHE_LEASE_LEDGER_INSPECTION_FAILED';
        if (['CACHE_LEASE_SCAN_BYTE_LIMIT', 'CACHE_LEASE_SCAN_EVENT_LIMIT', 'CACHE_LEASE_FILE_BYTE_LIMIT', 'CACHE_LEASE_LEDGER_EVENT_LIMIT'].includes(reason)) receipt.status = 'LIMIT_EXCEEDED';
        receipt.holds.push({ locator_digest: locatorDigest(relative), reason });
        if (receipt.status === 'LIMIT_EXCEEDED') break;
        continue;
      }
      if ((!storageFiles.ledger && storage.raw.length) || (!storageFiles.anchor && storage.anchor)) {
        receipt.holds.push({ locator_digest: locatorDigest(relative), reason: 'CACHE_LEASE_STORAGE_DISCOVERY_DRIFT' });
        continue;
      }
      const tail = storage.tail, active = ACTIVE_EVENTS.includes(tail.event) && tail.expires_at_ms > observedAt;
      const state = tail.event === 'RELEASED' ? 'RELEASED' : active ? 'ACTIVE' : 'EXPIRED';
      if (state === 'ACTIVE') { receipt.usage.active += 1; tail.keys.forEach((key) => protectedKeys.add(key)); }
      else if (state === 'EXPIRED') receipt.usage.expired += 1;
      else receipt.usage.released += 1;
      if (storage.compactionPending) receipt.holds.push({ locator_digest: locatorDigest(relative), reason: 'CACHE_LEASE_COMPACTION_INCOMPLETE' });
      receipt.leases.push({ lease_id: tail.lease_id, owner_digest: ownerDigest(tail.owner), tail_event_digest: tail.digest, event: tail.event, state, generation: tail.generation, expires_at_ms: tail.expires_at_ms, key_count: tail.keys.length, key_set_digest: Codec.digest(tail.keys), protected_keys: active ? tail.keys.slice() : [], archive_anchor_digest: storage.anchor ? storage.anchor.digest : null, archived_segments: storage.archivedSegments, archived_events: storage.archivedEvents, live_segment_digest: storage.raw.length ? Codec.sha256(storage.raw) : null, live_segment_events: storage.events.length, live_segment_bytes: storage.raw.length, compaction_pending: storage.compactionPending });
    }
    if (direct.exceeded && receipt.status !== 'LIMIT_EXCEEDED') { receipt.status = 'LIMIT_EXCEEDED'; receipt.holds.push({ locator_digest: locatorDigest('leases/directory-entry-limit'), reason: 'CACHE_LEASE_SCAN_DIRECTORY_ENTRY_LIMIT' }); }
    receipt.protected_keys = Array.from(protectedKeys).sort();
  }
  receipt.leases.sort((left, right) => left.lease_id.localeCompare(right.lease_id));
  receipt.holds.sort((left, right) => left.locator_digest.localeCompare(right.locator_digest) || left.reason.localeCompare(right.reason));
  if (receipt.status === 'COMPLETE' && receipt.holds.length) receipt.status = 'REVIEW_REQUIRED';
  receipt.usage.protected_keys = receipt.protected_keys.length;
  receipt.snapshot_digest = snapshotDigest(receipt);
  receipt.authority.protection_granted = receipt.status === 'COMPLETE';
  return Codec.seal(receipt);
}

function validateSet(receipt) {
  const errors = [];
  if (!receipt || receipt.schema !== SET_SCHEMA || receipt.version !== VERSION || !Codec.validDigest(receipt)) return ['cache lease set integrity is invalid'];
  if (!exactKeys(receipt, ['schema', 'version', 'status', 'observed_at_ms', 'cache_root_fingerprint', 'root_exists', 'lease_root_exists', 'scan_budget', 'leases', 'protected_keys', 'holds', 'ignored_files', 'usage', 'snapshot_digest', 'authority', 'digest'])) errors.push('cache lease set shape is invalid');
  if (!['COMPLETE', 'REVIEW_REQUIRED', 'LIMIT_EXCEEDED'].includes(receipt.status) || !finiteInteger(receipt.observed_at_ms) || !digest(receipt.cache_root_fingerprint) || typeof receipt.root_exists !== 'boolean' || typeof receipt.lease_root_exists !== 'boolean' || (receipt.lease_root_exists && !receipt.root_exists) || !finiteInteger(receipt.ignored_files)) errors.push('cache lease set observation is invalid');
  const budget = receipt.scan_budget;
  if (!exactKeys(budget, ['max_directory_entries', 'max_ledgers', 'max_events', 'max_bytes', 'max_single_ledger_bytes', 'max_events_per_ledger']) || !Number.isInteger(budget.max_directory_entries) || budget.max_directory_entries < 1 || budget.max_directory_entries > DEFAULT_MAX_DIRECTORY_ENTRIES || !Number.isInteger(budget.max_ledgers) || budget.max_ledgers < 1 || budget.max_ledgers > DEFAULT_MAX_LEDGERS || !Number.isInteger(budget.max_events) || budget.max_events < 1 || budget.max_events > DEFAULT_MAX_EVENTS || !Number.isSafeInteger(budget.max_bytes) || budget.max_bytes < 1 || budget.max_bytes > DEFAULT_MAX_BYTES || budget.max_single_ledger_bytes !== MAX_LEDGER_BYTES || budget.max_events_per_ledger !== MAX_EVENTS_PER_LEDGER) errors.push('cache lease scan budget is invalid');
  let snapshotValid = false;
  try { snapshotValid = digest(receipt.snapshot_digest) && receipt.snapshot_digest === snapshotDigest(receipt); } catch (_) {}
  if (!snapshotValid) errors.push('cache lease set snapshot is invalid');
  if (!Array.isArray(receipt.leases) || receipt.leases.some((lease) => !exactKeys(lease, ['lease_id', 'owner_digest', 'tail_event_digest', 'event', 'state', 'generation', 'expires_at_ms', 'key_count', 'key_set_digest', 'protected_keys', 'archive_anchor_digest', 'archived_segments', 'archived_events', 'live_segment_digest', 'live_segment_events', 'live_segment_bytes', 'compaction_pending']) || !digest(lease.lease_id) || !digest(lease.owner_digest) || !digest(lease.tail_event_digest) || !digest(lease.key_set_digest) || !['ACQUIRED', 'RENEWED', 'PROTECTED', 'RELEASED'].includes(lease.event) || !['ACTIVE', 'EXPIRED', 'RELEASED'].includes(lease.state) || !Number.isSafeInteger(lease.generation) || lease.generation < 1 || !finiteInteger(lease.expires_at_ms) || !finiteInteger(lease.key_count) || !Array.isArray(lease.protected_keys) || lease.protected_keys.some((key) => !digest(key)) || new Set(lease.protected_keys).size !== lease.protected_keys.length || Codec.canonical(lease.protected_keys) !== Codec.canonical(lease.protected_keys.slice().sort()) || (lease.archive_anchor_digest !== null && !digest(lease.archive_anchor_digest)) || !finiteInteger(lease.archived_segments) || !finiteInteger(lease.archived_events) || (lease.archived_segments === 0) !== (lease.archive_anchor_digest === null) || (lease.live_segment_digest !== null && !digest(lease.live_segment_digest)) || !finiteInteger(lease.live_segment_events) || !finiteInteger(lease.live_segment_bytes) || (lease.live_segment_digest === null) !== (lease.live_segment_events === 0 && lease.live_segment_bytes === 0) || typeof lease.compaction_pending !== 'boolean' || (lease.compaction_pending ? lease.archived_events !== lease.generation || lease.live_segment_events < 1 : lease.archived_events + lease.live_segment_events !== lease.generation) || (lease.state === 'ACTIVE') !== (ACTIVE_EVENTS.includes(lease.event) && lease.expires_at_ms > receipt.observed_at_ms) || (lease.state === 'RELEASED') !== (lease.event === 'RELEASED') || (lease.state === 'ACTIVE' ? lease.protected_keys.length !== lease.key_count || Codec.digest(lease.protected_keys) !== lease.key_set_digest : lease.protected_keys.length !== 0))) errors.push('cache lease summaries are invalid');
  if (Array.isArray(receipt.leases) && new Set(receipt.leases.map((lease) => lease && lease.lease_id)).size !== receipt.leases.length) errors.push('cache lease summaries are duplicated');
  const summarizedProtected = Array.isArray(receipt.leases) ? Array.from(new Set(receipt.leases.flatMap((lease) => lease && Array.isArray(lease.protected_keys) ? lease.protected_keys : []))).sort() : [];
  if (!Array.isArray(receipt.protected_keys) || receipt.protected_keys.some((key) => !digest(key)) || new Set(receipt.protected_keys).size !== receipt.protected_keys.length || Codec.canonical(receipt.protected_keys) !== Codec.canonical(receipt.protected_keys.slice().sort()) || Codec.canonical(receipt.protected_keys) !== Codec.canonical(summarizedProtected)) errors.push('cache lease protected keys are invalid');
  if (!Array.isArray(receipt.holds) || receipt.holds.some((hold) => !exactKeys(hold, ['locator_digest', 'reason']) || !digest(hold.locator_digest) || typeof hold.reason !== 'string' || !hold.reason)) errors.push('cache lease holds are invalid');
  const usage = receipt.usage;
  const activeCount = Array.isArray(receipt.leases) ? receipt.leases.filter((lease) => lease && lease.state === 'ACTIVE').length : -1;
  const expiredCount = Array.isArray(receipt.leases) ? receipt.leases.filter((lease) => lease && lease.state === 'EXPIRED').length : -1;
  const releasedCount = Array.isArray(receipt.leases) ? receipt.leases.filter((lease) => lease && lease.state === 'RELEASED').length : -1;
  const storedRecordCount = Array.isArray(receipt.leases) ? receipt.leases.reduce((sum, lease) => sum + (lease && lease.archive_anchor_digest ? 1 : 0) + (lease && Number.isSafeInteger(lease.live_segment_events) ? lease.live_segment_events : 0), 0) : -1;
  const historyEventCount = Array.isArray(receipt.leases) ? receipt.leases.reduce((sum, lease) => sum + (lease && Number.isSafeInteger(lease.generation) ? lease.generation : 0), 0) : -1;
  const archiveCount = Array.isArray(receipt.leases) ? receipt.leases.reduce((sum, lease) => sum + (lease && Number.isSafeInteger(lease.archived_segments) ? lease.archived_segments : 0), 0) : -1;
  if (!exactKeys(usage, ['ledgers', 'events', 'history_events', 'bytes', 'archives', 'active', 'expired', 'released', 'protected_keys']) || !finiteInteger(usage.ledgers) || usage.ledgers < (Array.isArray(receipt.leases) ? receipt.leases.length : 0) || !finiteInteger(usage.events) || usage.events < storedRecordCount || !finiteInteger(usage.history_events) || usage.history_events < historyEventCount || !finiteInteger(usage.bytes) || !finiteInteger(usage.archives) || usage.archives < archiveCount || !finiteInteger(usage.active) || usage.active !== activeCount || !finiteInteger(usage.expired) || usage.expired !== expiredCount || !finiteInteger(usage.released) || usage.released !== releasedCount || !finiteInteger(usage.protected_keys) || usage.protected_keys !== (Array.isArray(receipt.protected_keys) ? receipt.protected_keys.length : -1)) errors.push('cache lease usage is invalid');
  if (receipt.status === 'COMPLETE' && (!Array.isArray(receipt.holds) || receipt.holds.length)) errors.push('complete cache lease set contains holds');
  if (!receipt.lease_root_exists && ((Array.isArray(receipt.leases) && receipt.leases.length) || (Array.isArray(receipt.protected_keys) && receipt.protected_keys.length) || (Array.isArray(receipt.holds) && receipt.holds.length) || (exactKeys(usage, ['ledgers', 'events', 'history_events', 'bytes', 'archives', 'active', 'expired', 'released', 'protected_keys']) && Object.values(usage).some((value) => value !== 0)))) errors.push('missing cache lease root contains invented observations');
  if (!exactKeys(receipt.authority, ['read_only', 'protection_granted', 'deletion', 'installed', 'promoted', 'canon']) || receipt.authority.read_only !== true || receipt.authority.protection_granted !== (receipt.status === 'COMPLETE') || Object.entries(receipt.authority).some(([key, value]) => !['read_only', 'protection_granted'].includes(key) && value !== false)) errors.push('cache lease authority is invalid');
  return errors;
}

function assertSet(receipt) {
  const errors = validateSet(receipt);
  if (errors.length) fail('CACHE_LEASE_SET_INVALID:' + errors.join('; '));
  return receipt;
}

module.exports = {
  EVENT_SCHEMA,
  SET_SCHEMA,
  ARCHIVE_ANCHOR_SCHEMA,
  ARCHIVE_RECEIPT_SCHEMA,
  ARCHIVE_AUDIT_SCHEMA,
  VERSION,
  DEFAULT_DURATION_MS,
  MAX_DURATION_MS,
  MAX_KEYS,
  MAX_EVENTS_PER_LEDGER,
  MAX_LEDGER_BYTES,
  LeaseError,
  duration,
  durationForPackages,
  leaseIdFor,
  validateEvent,
  assertEvent,
  parseLedger,
  acquire,
  discover,
  archiveCandidate,
  auditArchives,
  validateSet,
  assertSet,
  withKeyLock,
  withLeaseLock
};
