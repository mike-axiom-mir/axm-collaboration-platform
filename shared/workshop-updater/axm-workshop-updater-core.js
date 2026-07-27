'use strict';

const crypto = require('crypto');

const VERSION = '0.1.0';
const STATE_SCHEMA = 'axm.workshop-updater.state/v1';
const STATUS_SCHEMA = 'axm.workshop-updater.status/v1';
const MANIFEST_SCHEMA = 'axm.workshop-update-manifest/v1';
const CANONICAL_REPOSITORY = 'mike-axiom-mir/axm-collaboration-platform';
const CANONICAL_REF = 'main';
const ENABLE_CONFIRMATION = 'ENABLE WORKSHOP UPDATE CHECKS';
const STAGE_CONFIRMATION = 'ALLOW VERIFIED UPDATE DOWNLOADS';
const MODES = Object.freeze(['CHECK_ONLY', 'AUTO_STAGE']);
const MIN_INTERVAL_MS = 3600000;
const MAX_INTERVAL_MS = 604800000;
const DEFAULT_INTERVAL_MS = 86400000;
const MAX_ARCHIVE_BYTES = 536870912;

function clone(value) { return JSON.parse(JSON.stringify(value)); }
function nowIso(now) { return new Date(now == null ? Date.now() : now).toISOString(); }
function text(value, max) { return String(value == null ? '' : value).trim().slice(0, max || 240); }
function boundedNumber(value, fallback, min, max) {
  const parsed = Number(value);
  return Math.round(Math.max(min, Math.min(max, Number.isFinite(parsed) ? parsed : fallback)));
}
function stable(value) {
  if (Array.isArray(value)) return '[' + value.map(stable).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + stable(value[key])).join(',') + '}';
  return JSON.stringify(value);
}
function canonicalManifest(manifest) {
  const copy = clone(manifest || {});
  delete copy.signatures;
  return stable(copy);
}
function createState(now) {
  return {
    schema: STATE_SCHEMA,
    version: VERSION,
    config: {
      enabled: false,
      mode: 'CHECK_ONLY',
      repository: CANONICAL_REPOSITORY,
      ref: CANONICAL_REF,
      intervalMs: DEFAULT_INTERVAL_MS,
      maxArchiveBytes: MAX_ARCHIVE_BYTES,
      networkConsentAt: null,
      stageConsentAt: null
    },
    nextCheckAt: null,
    checking: false,
    lastCheckAt: null,
    lastReason: 'off-by-default',
    lastError: null,
    installed: null,
    remote: null,
    candidate: null,
    receipts: [],
    createdAt: nowIso(now),
    updatedAt: nowIso(now)
  };
}
function normalize(raw, now) {
  const base = createState(now);
  const state = raw && raw.schema === STATE_SCHEMA ? clone(raw) : base;
  state.version = VERSION;
  state.config = Object.assign({}, base.config, state.config || {});
  state.config.enabled = state.config.enabled === true;
  state.config.mode = MODES.includes(state.config.mode) ? state.config.mode : 'CHECK_ONLY';
  state.config.repository = CANONICAL_REPOSITORY;
  state.config.ref = CANONICAL_REF;
  state.config.intervalMs = boundedNumber(state.config.intervalMs, DEFAULT_INTERVAL_MS, MIN_INTERVAL_MS, MAX_INTERVAL_MS);
  state.config.maxArchiveBytes = MAX_ARCHIVE_BYTES;
  state.nextCheckAt = state.config.enabled && state.nextCheckAt && Number.isFinite(Date.parse(state.nextCheckAt)) ? new Date(state.nextCheckAt).toISOString() : null;
  state.checking = state.checking === true;
  state.receipts = Array.isArray(state.receipts) ? state.receipts.slice(-100) : [];
  state.updatedAt = state.updatedAt || nowIso(now);
  return state;
}
function configure(raw, input, actor, now) {
  const state = normalize(raw, now);
  input = input || {};
  const stamp = Number(now == null ? Date.now() : now);
  const previousEnabled = state.config.enabled;
  const previousInterval = state.config.intervalMs;
  const requestedMode = input.mode == null ? state.config.mode : text(input.mode, 40).toUpperCase();
  if (!MODES.includes(requestedMode)) throw new Error('Updater mode must be CHECK_ONLY or AUTO_STAGE');
  if (requestedMode === 'AUTO_STAGE' && input.stageConfirmation !== STAGE_CONFIRMATION && state.config.mode !== 'AUTO_STAGE') {
    throw new Error('Verified download confirmation is required for AUTO_STAGE');
  }
  if (input.enabled === true && !previousEnabled && input.confirmation !== ENABLE_CONFIRMATION) {
    throw new Error('Exact updater enable confirmation is required');
  }
  state.config.mode = requestedMode;
  state.config.intervalMs = boundedNumber(input.intervalMs, state.config.intervalMs, MIN_INTERVAL_MS, MAX_INTERVAL_MS);
  if (input.enabled != null) state.config.enabled = input.enabled === true;
  if (state.config.enabled && !previousEnabled) state.config.networkConsentAt = nowIso(stamp);
  if (requestedMode === 'AUTO_STAGE' && state.config.mode !== 'AUTO_STAGE') state.config.stageConsentAt = nowIso(stamp);
  if (requestedMode === 'AUTO_STAGE' && input.stageConfirmation === STAGE_CONFIRMATION) state.config.stageConsentAt = nowIso(stamp);
  if (!state.config.enabled) {
    state.nextCheckAt = null;
    state.lastReason = 'disabled-explicitly';
  } else if (!previousEnabled || previousInterval !== state.config.intervalMs || !state.nextCheckAt) {
    state.nextCheckAt = nowIso(stamp + state.config.intervalMs);
    state.lastReason = previousEnabled ? 'check-interval-changed' : 'enabled-awaiting-heartbeat';
  } else {
    state.lastReason = 'settings-saved';
  }
  state.updatedAt = nowIso(stamp);
  state.lastError = null;
  state.receipts.push({
    schema: 'axm.workshop-updater.config-receipt/v1',
    at: nowIso(stamp),
    actor: text(actor || 'unknown', 100),
    enabled: state.config.enabled,
    mode: state.config.mode,
    intervalMs: state.config.intervalMs,
    networkEffect: 'NONE'
  });
  state.receipts = state.receipts.slice(-100);
  return state;
}
function validArchiveUrl(value, repository, commitSha) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname === 'codeload.github.com' && url.pathname === '/' + repository + '/zip/' + commitSha;
  } catch (error) { return false; }
}
function validateManifest(manifest, expected) {
  expected = expected || {};
  const errors = [];
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) errors.push('manifest must be an object');
  if (errors.length) return { ok: false, errors };
  if (manifest.schema !== MANIFEST_SCHEMA) errors.push('unsupported update manifest schema');
  if (manifest.repository !== (expected.repository || CANONICAL_REPOSITORY)) errors.push('manifest repository mismatch');
  if (!/^[a-f0-9]{40}$/i.test(String(manifest.commitSha || ''))) errors.push('manifest commitSha must be a full Git commit');
  if (expected.commitSha && manifest.commitSha !== expected.commitSha) errors.push('manifest commit does not match the GitHub ref receipt');
  if (!text(manifest.releaseId, 120)) errors.push('releaseId required');
  if (!text(manifest.version, 80)) errors.push('version required');
  if (!manifest.archive || typeof manifest.archive !== 'object') errors.push('archive descriptor required');
  else {
    if (!validArchiveUrl(manifest.archive.url, manifest.repository, manifest.commitSha)) errors.push('archive URL must be the commit-pinned canonical codeload URL');
    if (!/^[a-f0-9]{64}$/i.test(String(manifest.archive.sha256 || ''))) errors.push('archive sha256 required');
    const bytes = Number(manifest.archive.bytes);
    if (!Number.isInteger(bytes) || bytes < 1 || bytes > MAX_ARCHIVE_BYTES) errors.push('archive byte length is outside the updater limit');
  }
  if (!Array.isArray(manifest.signatures) || !manifest.signatures.length) errors.push('at least one release signature required');
  return { ok: errors.length === 0, errors };
}
function verifyManifest(manifest, trustedKeys) {
  const signatures = Array.isArray(manifest && manifest.signatures) ? manifest.signatures : [];
  const keys = Array.isArray(trustedKeys) ? trustedKeys : [];
  const payload = Buffer.from(canonicalManifest(manifest), 'utf8');
  const attempts = [];
  for (const signature of signatures) {
    const key = keys.find(item => item && item.keyId === signature.keyId && item.algorithm === 'ed25519');
    if (!key) { attempts.push({ keyId: text(signature.keyId, 100), trusted: false, verified: false }); continue; }
    let verified = false;
    try {
      verified = signature.algorithm === 'ed25519' && crypto.verify(null, payload, key.publicKeyPem, Buffer.from(String(signature.signature || ''), 'base64'));
    } catch (error) { verified = false; }
    attempts.push({ keyId: key.keyId, trusted: true, verified });
    if (verified) return { trusted: true, keyId: key.keyId, algorithm: 'ed25519', attempts };
  }
  return { trusted: false, keyId: null, algorithm: null, attempts };
}
function status(raw, now) {
  const state = normalize(raw, now);
  return {
    schema: STATUS_SCHEMA,
    version: VERSION,
    config: clone(state.config),
    nextCheckAt: state.nextCheckAt,
    checking: state.checking,
    lastCheckAt: state.lastCheckAt,
    lastReason: state.lastReason,
    lastError: state.lastError,
    installed: clone(state.installed),
    remote: clone(state.remote),
    candidate: clone(state.candidate),
    recentReceipts: clone(state.receipts.slice(-20)),
    networkPolicy: state.config.enabled ? 'EXPLICITLY_ENABLED' : 'OFF_ZERO_NETWORK',
    heartbeatBridge: state.config.enabled ? 'ARMED_FOR_DUE_SCHEDULED_BEATS' : 'HELD_OFF',
    applyAuthority: 'NONE',
    installerState: 'MISSING_GOVERNED_WHOLE_WORKSHOP_INSTALLER',
    truth: 'The updater may check a pinned GitHub ref and stage only a signed, hash-matching archive. It cannot install, overwrite, delete, restart, promote, or merge the Workshop.'
  };
}

module.exports = {
  VERSION,
  STATE_SCHEMA,
  STATUS_SCHEMA,
  MANIFEST_SCHEMA,
  CANONICAL_REPOSITORY,
  CANONICAL_REF,
  ENABLE_CONFIRMATION,
  STAGE_CONFIRMATION,
  MODES: MODES.slice(),
  MIN_INTERVAL_MS,
  MAX_INTERVAL_MS,
  DEFAULT_INTERVAL_MS,
  MAX_ARCHIVE_BYTES,
  createState,
  normalize,
  configure,
  canonicalManifest,
  validateManifest,
  verifyManifest,
  status
};
