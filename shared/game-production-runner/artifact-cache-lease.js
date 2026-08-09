'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const Codec = require('./canonical');
const Contracts = require('./contracts');
const ArtifactCache = require('./artifact-cache');

const EVENT_SCHEMA = 'axm.production-artifact-cache-lease-event/v1';
const SET_SCHEMA = 'axm.production-artifact-cache-lease-set/v1';
const OWNER_SCHEMA = 'axm.production-artifact-cache-lease-owner/v1';
const LOCK_SCHEMA = 'axm.production-artifact-cache-coordination-lock/v1';
const VERSION = '0.1.0';
const DEFAULT_DURATION_MS = 300000;
const MAX_DURATION_MS = 604800000;
const PACKAGE_MARGIN_MS = 60000;
const MAX_KEYS = 10000;
const MAX_EVENTS_PER_LEDGER = 10000;
const MAX_LEDGER_BYTES = 16777216;
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

function parseLedger(raw, expectedLeaseId) {
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
    const current = events[index], previous = index ? events[index - 1] : null;
    if (expectedLeaseId && current.lease_id !== expectedLeaseId) fail('CACHE_LEASE_LEDGER_FILE_BINDING_INVALID');
    if (!previous) {
      if (current.event !== 'ACQUIRED' || current.generation !== 1 || current.previous_event_digest !== null || current.keys.length) fail('CACHE_LEASE_LEDGER_ORIGIN_INVALID');
      continue;
    }
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
  return events;
}

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

function appendEvent(file, event) {
  assertEvent(event);
  const existing = readBoundedFile(file, MAX_LEDGER_BYTES, true);
  const separator = existing.length && existing[existing.length - 1] !== 10 && existing[existing.length - 1] !== 13 ? '\n' : '';
  const addition = Buffer.from(separator + JSON.stringify(event) + '\n', 'utf8');
  if (existing.length + addition.length > MAX_LEDGER_BYTES) fail('CACHE_LEASE_LEDGER_BYTE_LIMIT');
  parseLedger(Buffer.concat([existing, addition]), event.lease_id);
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

function readLease(file, leaseId) { return parseLedger(readBoundedFile(file, MAX_LEDGER_BYTES, true), leaseId); }

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
    const events = readLease(file, leaseId), previous = events.length ? events[events.length - 1] : null;
    if (previous && !sameOwner(previous.owner, owner)) fail('CACHE_LEASE_OWNER_DRIFT');
    const keys = previous && previous.event !== 'RELEASED' ? previous.keys : [];
    const descriptors = keys.map((key) => ({ namespace: 'key', id: key }));
    withLocks(options, descriptors, () => {
      const deadline = previous && previous.event !== 'RELEASED' ? Math.max(previous.expires_at_ms, observedAt + leaseDuration) : observedAt + leaseDuration;
      const name = previous && previous.event !== 'RELEASED' ? 'RENEWED' : 'ACQUIRED';
      tail = newEvent(owner, name, sessionDigest, previous ? previous.generation + 1 : 1, observedAt, deadline, keys, previous ? previous.digest : null);
      appendEvent(file, tail);
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
        const events = readLease(file, leaseId), current = events[events.length - 1];
        if (!current || current.session_digest !== sessionDigest || !ACTIVE_EVENTS.includes(current.event)) fail('CACHE_LEASE_SESSION_STALE');
        if (current.keys.includes(key)) { tail = current; return; }
        withLocks(options, [{ namespace: 'key', id: key }], () => {
          const keys = current.keys.concat(key).sort();
          tail = newEvent(owner, 'PROTECTED', sessionDigest, current.generation + 1, now, current.expires_at_ms, keys, current.digest);
          appendEvent(file, tail);
        });
      });
      return clone(tail);
    },
    release(nowMs) {
      if (closed) return clone(tail);
      const now = nowMs == null ? Date.now() : nowMs;
      if (!finiteInteger(now)) fail('CACHE_LEASE_TIME_INVALID');
      withLocks(options, [{ namespace: 'lease', id: leaseId }], () => {
        const events = readLease(file, leaseId), current = events[events.length - 1];
        if (!current || current.session_digest !== sessionDigest || !ACTIVE_EVENTS.includes(current.event)) fail('CACHE_LEASE_SESSION_STALE');
        tail = newEvent(owner, 'RELEASED', sessionDigest, current.generation + 1, now, now, current.keys, current.digest);
        appendEvent(file, tail);
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

function snapshotDigest(receipt) {
  return Codec.digest({
    cache_root_fingerprint: receipt.cache_root_fingerprint,
    root_exists: receipt.root_exists,
    ledgers: receipt.leases.map((lease) => ({ lease_id: lease.lease_id, owner_digest: lease.owner_digest, tail_event_digest: lease.tail_event_digest, event: lease.event, generation: lease.generation, expires_at_ms: lease.expires_at_ms, key_count: lease.key_count, key_set_digest: lease.key_set_digest })),
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
    usage: { ledgers: 0, events: 0, bytes: 0, active: 0, expired: 0, released: 0, protected_keys: 0 },
    snapshot_digest: null,
    authority: { read_only: true, protection_granted: false, deletion: false, installed: false, promoted: false, canon: false }
  };
  if (cache.exists) {
    const direct = boundedNames(cache.leasesRoot, budget.max_directory_entries), protectedKeys = new Set();
    for (const name of direct.names) {
      const relative = 'leases/' + name, file = path.join(cache.leasesRoot, name), match = /^([a-f0-9]{64})\.jsonl$/.exec(name);
      if (!match) { receipt.ignored_files += 1; receipt.holds.push({ locator_digest: locatorDigest(relative), reason: 'CACHE_LEASE_LEDGER_NAME_INVALID' }); continue; }
      const leaseId = match[1], stat = fs.lstatSync(file);
      if (!stat.isFile() || stat.isSymbolicLink()) { receipt.holds.push({ locator_digest: locatorDigest(relative), reason: 'CACHE_LEASE_LEDGER_NOT_PLAIN' }); continue; }
      receipt.usage.ledgers += 1;
      if (receipt.usage.ledgers > budget.max_ledgers) { receipt.status = 'LIMIT_EXCEEDED'; receipt.holds.push({ locator_digest: locatorDigest(relative), reason: 'CACHE_LEASE_SCAN_LEDGER_LIMIT' }); break; }
      let raw, events;
      try {
        raw = readBoundedFile(file, budget.max_single_ledger_bytes, false);
        receipt.usage.bytes += raw.length;
        if (receipt.usage.bytes > budget.max_bytes) fail('CACHE_LEASE_SCAN_BYTE_LIMIT');
        events = parseLedger(raw, leaseId);
        receipt.usage.events += events.length;
        if (receipt.usage.events > budget.max_events) fail('CACHE_LEASE_SCAN_EVENT_LIMIT');
        if (!events.length) fail('CACHE_LEASE_LEDGER_EMPTY');
      } catch (error) {
        const reason = error instanceof LeaseError ? error.code : 'CACHE_LEASE_LEDGER_INSPECTION_FAILED';
        if (['CACHE_LEASE_SCAN_BYTE_LIMIT', 'CACHE_LEASE_SCAN_EVENT_LIMIT', 'CACHE_LEASE_FILE_BYTE_LIMIT', 'CACHE_LEASE_LEDGER_EVENT_LIMIT'].includes(reason)) receipt.status = 'LIMIT_EXCEEDED';
        receipt.holds.push({ locator_digest: locatorDigest(relative), reason });
        if (receipt.status === 'LIMIT_EXCEEDED') break;
        continue;
      }
      const tail = events[events.length - 1], active = ACTIVE_EVENTS.includes(tail.event) && tail.expires_at_ms > observedAt;
      const state = tail.event === 'RELEASED' ? 'RELEASED' : active ? 'ACTIVE' : 'EXPIRED';
      if (state === 'ACTIVE') { receipt.usage.active += 1; tail.keys.forEach((key) => protectedKeys.add(key)); }
      else if (state === 'EXPIRED') receipt.usage.expired += 1;
      else receipt.usage.released += 1;
      receipt.leases.push({ lease_id: tail.lease_id, owner_digest: ownerDigest(tail.owner), tail_event_digest: tail.digest, event: tail.event, state, generation: tail.generation, expires_at_ms: tail.expires_at_ms, key_count: tail.keys.length, key_set_digest: Codec.digest(tail.keys), protected_keys: active ? tail.keys.slice() : [] });
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
  if (!Array.isArray(receipt.leases) || receipt.leases.some((lease) => !exactKeys(lease, ['lease_id', 'owner_digest', 'tail_event_digest', 'event', 'state', 'generation', 'expires_at_ms', 'key_count', 'key_set_digest', 'protected_keys']) || !digest(lease.lease_id) || !digest(lease.owner_digest) || !digest(lease.tail_event_digest) || !digest(lease.key_set_digest) || !['ACQUIRED', 'RENEWED', 'PROTECTED', 'RELEASED'].includes(lease.event) || !['ACTIVE', 'EXPIRED', 'RELEASED'].includes(lease.state) || !Number.isSafeInteger(lease.generation) || lease.generation < 1 || !finiteInteger(lease.expires_at_ms) || !finiteInteger(lease.key_count) || !Array.isArray(lease.protected_keys) || lease.protected_keys.some((key) => !digest(key)) || new Set(lease.protected_keys).size !== lease.protected_keys.length || Codec.canonical(lease.protected_keys) !== Codec.canonical(lease.protected_keys.slice().sort()) || (lease.state === 'ACTIVE') !== (ACTIVE_EVENTS.includes(lease.event) && lease.expires_at_ms > receipt.observed_at_ms) || (lease.state === 'RELEASED') !== (lease.event === 'RELEASED') || (lease.state === 'ACTIVE' ? lease.protected_keys.length !== lease.key_count || Codec.digest(lease.protected_keys) !== lease.key_set_digest : lease.protected_keys.length !== 0))) errors.push('cache lease summaries are invalid');
  if (Array.isArray(receipt.leases) && new Set(receipt.leases.map((lease) => lease && lease.lease_id)).size !== receipt.leases.length) errors.push('cache lease summaries are duplicated');
  const summarizedProtected = Array.isArray(receipt.leases) ? Array.from(new Set(receipt.leases.flatMap((lease) => lease && Array.isArray(lease.protected_keys) ? lease.protected_keys : []))).sort() : [];
  if (!Array.isArray(receipt.protected_keys) || receipt.protected_keys.some((key) => !digest(key)) || new Set(receipt.protected_keys).size !== receipt.protected_keys.length || Codec.canonical(receipt.protected_keys) !== Codec.canonical(receipt.protected_keys.slice().sort()) || Codec.canonical(receipt.protected_keys) !== Codec.canonical(summarizedProtected)) errors.push('cache lease protected keys are invalid');
  if (!Array.isArray(receipt.holds) || receipt.holds.some((hold) => !exactKeys(hold, ['locator_digest', 'reason']) || !digest(hold.locator_digest) || typeof hold.reason !== 'string' || !hold.reason)) errors.push('cache lease holds are invalid');
  const usage = receipt.usage;
  const activeCount = Array.isArray(receipt.leases) ? receipt.leases.filter((lease) => lease && lease.state === 'ACTIVE').length : -1;
  const expiredCount = Array.isArray(receipt.leases) ? receipt.leases.filter((lease) => lease && lease.state === 'EXPIRED').length : -1;
  const releasedCount = Array.isArray(receipt.leases) ? receipt.leases.filter((lease) => lease && lease.state === 'RELEASED').length : -1;
  const eventCount = Array.isArray(receipt.leases) ? receipt.leases.reduce((sum, lease) => sum + (lease && Number.isSafeInteger(lease.generation) ? lease.generation : 0), 0) : -1;
  if (!exactKeys(usage, ['ledgers', 'events', 'bytes', 'active', 'expired', 'released', 'protected_keys']) || !finiteInteger(usage.ledgers) || usage.ledgers < (Array.isArray(receipt.leases) ? receipt.leases.length : 0) || !finiteInteger(usage.events) || usage.events < eventCount || !finiteInteger(usage.bytes) || !finiteInteger(usage.active) || usage.active !== activeCount || !finiteInteger(usage.expired) || usage.expired !== expiredCount || !finiteInteger(usage.released) || usage.released !== releasedCount || !finiteInteger(usage.protected_keys) || usage.protected_keys !== (Array.isArray(receipt.protected_keys) ? receipt.protected_keys.length : -1)) errors.push('cache lease usage is invalid');
  if (receipt.status === 'COMPLETE' && (!Array.isArray(receipt.holds) || receipt.holds.length)) errors.push('complete cache lease set contains holds');
  if (!receipt.lease_root_exists && ((Array.isArray(receipt.leases) && receipt.leases.length) || (Array.isArray(receipt.protected_keys) && receipt.protected_keys.length) || (Array.isArray(receipt.holds) && receipt.holds.length) || (exactKeys(usage, ['ledgers', 'events', 'bytes', 'active', 'expired', 'released', 'protected_keys']) && Object.values(usage).some((value) => value !== 0)))) errors.push('missing cache lease root contains invented observations');
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
  validateSet,
  assertSet,
  withKeyLock
};
