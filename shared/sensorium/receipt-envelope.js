'use strict';

const C = require('./core');
const SCHEMA = 'axm.sensorium-receipt/v1';
const FORBIDDEN_KEYS = /(^|_)(frame|frames|image|images|video|audio|recording|transcript|directory_tree|source_file|secret|token|password|raw_material|raw_payload|dataurl)(_|$)/i;

function exact(value, label) { return C.assertExactIdentifier(value, label); }
function validIso(value) { return typeof value === 'string' && Number.isFinite(Date.parse(value)); }
function splitCapability(value, fallbackVersion) {
  const text = String(value || '');
  const match = text.match(/^(.*)\/(v\d+)$/);
  return match ? { id: match[1], version: match[2] } : { id: text, version: fallbackVersion || 'v1' };
}
function containsForbiddenMaterial(value, currentPath) {
  currentPath = currentPath || '';
  if (!value || typeof value !== 'object') return null;
  for (const key of Object.keys(value)) {
    const next = currentPath ? currentPath + '.' + key : key;
    if (FORBIDDEN_KEYS.test(key) && value[key] != null && value[key] !== false && value[key] !== 0 && value[key] !== '') return next;
    const nested = containsForbiddenMaterial(value[key], next);
    if (nested) return nested;
  }
  return null;
}
function validate(envelope) {
  const errors = [];
  const required = ['receiptId','claimId','senseId','capabilityId','capabilityVersion','seatId','targetId','backendId','observedAt','sealedAt','ttlMs','freshnessStatus','verdict','namedSeams','typedObservationDigest','specificReceiptSchema','specificReceiptDigest','authorityLeaseId','authorityInherited','rawRetainedBytesAfterSeal','rawRetainedItemsAfterSeal','cleanupComplete'];
  if (!envelope || envelope.schema !== SCHEMA) errors.push('wrong schema');
  required.forEach(function (key) { if (!envelope || !(key in envelope)) errors.push('missing ' + key); });
  if (!envelope) return { ok: false, errors };
  ['receiptId','claimId','senseId','capabilityId','capabilityVersion','seatId','targetId','backendId','specificReceiptSchema'].forEach(function (key) { if (!C.compact(envelope[key])) errors.push(key + ' must be non-empty'); });
  if (!validIso(envelope.observedAt) || !validIso(envelope.sealedAt)) errors.push('timestamps must be valid ISO date-times');
  if (!Number.isInteger(envelope.ttlMs) || envelope.ttlMs < 1) errors.push('ttlMs must be a positive integer');
  if (['LIVE','STALE','UNTIMED','INVALID_TIMESTAMP','FUTURE'].indexOf(envelope.freshnessStatus) < 0) errors.push('invalid freshnessStatus');
  if (['PASS','FAIL','UNKNOWN'].indexOf(envelope.verdict) < 0) errors.push('invalid verdict');
  if (!Array.isArray(envelope.namedSeams) || envelope.namedSeams.length > 20) errors.push('namedSeams must be a bounded array');
  if (!/^[a-f0-9]{64}$/.test(envelope.typedObservationDigest || '') || !/^[a-f0-9]{64}$/.test(envelope.specificReceiptDigest || '')) errors.push('digests must be sha256');
  if (envelope.authorityInherited !== false) errors.push('authorityInherited must be false');
  if (envelope.rawRetainedBytesAfterSeal !== 0 || envelope.rawRetainedItemsAfterSeal !== 0) errors.push('post-seal retention must be zero');
  if (envelope.cleanupComplete !== true) errors.push('cleanupComplete must be true');
  const forbidden = containsForbiddenMaterial(envelope);
  if (forbidden) errors.push('forbidden raw field: ' + forbidden);
  return { ok: errors.length === 0, errors };
}
function create(input) {
  input = input || {};
  const specific = input.specificReceipt || {};
  const capability = splitCapability(input.capability || specific.capability || (input.capabilityId + '/' + (input.capabilityVersion || 'v1')), input.capabilityVersion);
  const observedAt = C.now(input.observedAt || specific.observedAt || specific.observed_at || specific.window_start || specific.openedAt || input.sealedAt);
  const sealedAt = C.now(input.sealedAt || specific.sealedAt || specific.window_end || observedAt);
  const ttlMs = Math.max(1, Math.min(31536000000, Math.round(Number(input.ttlMs) || 60000)));
  const age = Date.parse(sealedAt) - Date.parse(observedAt);
  let freshnessStatus = input.freshnessStatus;
  if (!freshnessStatus) freshnessStatus = !validIso(observedAt) ? 'INVALID_TIMESTAMP' : (age < 0 ? 'FUTURE' : (age <= ttlMs ? 'LIVE' : 'STALE'));
  let verdict = String(input.verdict || specific.verdict || 'UNKNOWN').toUpperCase();
  if (['PASS','FAIL','UNKNOWN'].indexOf(verdict) < 0) verdict = 'UNKNOWN';
  const typedObservation = input.typedObservation == null ? (specific.typed_observation || { verdict }) : input.typedObservation;
  const material = {
    claimId: exact(input.claimId || 'claim-unassigned', 'claimId'),
    senseId: exact(input.senseId, 'senseId'),
    capabilityId: exact(capability.id, 'capabilityId'),
    capabilityVersion: exact(capability.version, 'capabilityVersion'),
    seatId: exact(input.seatId || 'seat-unknown', 'seatId'),
    targetId: exact(input.targetId || 'target-unknown', 'targetId'),
    backendId: exact(input.backendId || 'backend-unknown', 'backendId'),
    observedAt, sealedAt, ttlMs, freshnessStatus, verdict,
    namedSeams: (input.namedSeams || []).map(function (item) { return C.compact(item, 160); }).filter(Boolean).slice(0, 20),
    typedObservationDigest: C.digest(typedObservation),
    specificReceiptSchema: exact(input.specificReceiptSchema || specific.schema, 'specificReceiptSchema'),
    specificReceiptDigest: C.digest(specific),
    authorityLeaseId: input.authorityLeaseId ? exact(input.authorityLeaseId, 'authorityLeaseId') : null,
    authorityInherited: false,
    rawRetainedBytesAfterSeal: Number(input.rawRetainedBytesAfterSeal || 0),
    rawRetainedItemsAfterSeal: Number(input.rawRetainedItemsAfterSeal || 0),
    cleanupComplete: input.cleanupComplete === true
  };
  const envelope = Object.assign({ schema: SCHEMA, receiptId: 'sensorium-' + C.digest(material).slice(0, 24) }, material);
  const checked = validate(envelope);
  if (!checked.ok) throw new Error('invalid Sensorium envelope: ' + checked.errors.join('; '));
  return envelope;
}

module.exports = { SCHEMA, FORBIDDEN_KEYS, create, validate, containsForbiddenMaterial, splitCapability };
