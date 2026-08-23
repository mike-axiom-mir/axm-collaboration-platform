'use strict';

const Codec = require('./canonical');
const Contracts = require('./contracts');

const PROFILES = Object.freeze({ game: 'game', production: 'production' });
const SCHEMAS = Object.freeze({
  game: Contracts.SCHEMAS.step,
  production: 'axm.production-step-receipt/v1'
});
const STATES = Object.freeze(['VERIFIED', 'HELD', 'FAILED']);
const VERDICTS = Object.freeze(['VERIFIED', 'VERIFIED_WITH_LIMITS', 'HUMAN_REVIEW', 'HELD', 'FAILED']);
const CACHE_STATES = Object.freeze(['MISS', 'DISABLED', 'BYPASSED', 'MISS_STORED', 'MISS_ENTRY_EXISTS', 'MISS_CONFLICT', 'MISS_NOT_STORED', 'HIT', 'REJECTED']);
const CACHE_KEYS = Object.freeze(['state', 'key', 'entry_digest', 'reason']);
const KEYS = Object.freeze([
  'schema', 'run_id', 'step_id', 'package_ref', 'attempt', 'state', 'started_at', 'completed_at',
  'inputs', 'outputs', 'process', 'evidence', 'verdict', 'detail', 'cache',
  'previous_receipt_digest', 'authority', 'digest'
]);
const DIGEST = /^[a-f0-9]{64}$/;

function record(value) { return !!value && typeof value === 'object' && !Array.isArray(value); }
function text(value) { return typeof value === 'string' && value.length > 0; }

function assertSchema(schema) {
  if (!Object.values(SCHEMAS).includes(schema)) throw new Error('unsupported step receipt schema: ' + schema);
  return schema;
}

function schemaFor(profile) {
  const selected = profile == null ? PROFILES.game : profile;
  if (!Object.prototype.hasOwnProperty.call(SCHEMAS, selected)) throw new Error('unsupported step receipt profile: ' + selected);
  return SCHEMAS[selected];
}

function validate(receipt, expectedSchema) {
  const errors = [];
  const expected = assertSchema(expectedSchema);
  if (!record(receipt)) return ['step receipt must be a record'];
  const keys = Object.keys(receipt);
  for (const key of KEYS) if (!keys.includes(key)) errors.push('step receipt is missing ' + key);
  for (const key of keys) if (!KEYS.includes(key)) errors.push('step receipt has undeclared field ' + key);
  if (receipt.schema !== expected) errors.push('step receipt schema mismatch');
  if (!Contracts.portableId(receipt.run_id)) errors.push('step receipt run_id must be portable');
  if (!Contracts.portableId(receipt.step_id)) errors.push('step receipt step_id must be portable');
  if (!Contracts.exactRef(receipt.package_ref)) errors.push('step receipt package_ref must be exact');
  if (!Number.isInteger(receipt.attempt) || receipt.attempt < 1) errors.push('step receipt attempt must be positive');
  if (!STATES.includes(receipt.state)) errors.push('step receipt state is invalid');
  if (!text(receipt.started_at) || !text(receipt.completed_at)) errors.push('step receipt timestamps are required');
  if (!Array.isArray(receipt.inputs) || !Array.isArray(receipt.outputs)) errors.push('step receipt inputs and outputs must be arrays');
  if (!record(receipt.process) || !Contracts.exactIdentity(receipt.process.executor) || typeof receipt.process.native_process_started !== 'boolean' || (receipt.process.executor_invoked != null && typeof receipt.process.executor_invoked !== 'boolean')) errors.push('step receipt process descriptor is invalid');
  if (!Array.isArray(receipt.evidence)) errors.push('step receipt evidence must be an array');
  if (!VERDICTS.includes(receipt.verdict)) errors.push('step receipt verdict is invalid');
  if (!text(receipt.detail)) errors.push('step receipt detail is required');
  if (!record(receipt.cache) || !CACHE_STATES.includes(receipt.cache.state) || !DIGEST.test(String(receipt.cache.key || '')) || (receipt.cache.entry_digest != null && !DIGEST.test(String(receipt.cache.entry_digest))) || (receipt.cache.reason != null && !text(receipt.cache.reason)) || (record(receipt.cache) && Object.keys(receipt.cache).some((key) => !CACHE_KEYS.includes(key)))) errors.push('step receipt cache descriptor is invalid');
  if (receipt.previous_receipt_digest !== null && !DIGEST.test(String(receipt.previous_receipt_digest || ''))) errors.push('step receipt previous digest is invalid');
  if (!record(receipt.authority) || receipt.authority.source_write !== false || receipt.authority.installed !== false || receipt.authority.promoted !== false || receipt.authority.canon !== false) errors.push('step receipt authority boundary is invalid');
  const expectedState = ['VERIFIED', 'VERIFIED_WITH_LIMITS', 'HUMAN_REVIEW'].includes(receipt.verdict) ? 'VERIFIED' : receipt.verdict;
  if (STATES.includes(receipt.state) && VERDICTS.includes(receipt.verdict) && receipt.state !== expectedState) errors.push('step receipt state and verdict disagree');
  if (!Codec.validDigest(receipt)) errors.push('step receipt exact canonical digest mismatch');
  return errors;
}

function assertValid(receipt, expectedSchema) {
  const errors = validate(receipt, expectedSchema);
  if (errors.length) throw new Error(errors.join('; '));
  return receipt;
}

function inferSchema(receipts, fallback) {
  if (!Array.isArray(receipts)) throw new Error('step receipt ledger must be an array');
  if (!receipts.length) return assertSchema(fallback || SCHEMAS.game);
  const schemas = Array.from(new Set(receipts.map((receipt) => assertSchema(receipt && receipt.schema))));
  if (schemas.length !== 1) throw new Error('step receipt ledger mixes schemas');
  return schemas[0];
}

module.exports = { PROFILES, SCHEMAS, STATES, VERDICTS, CACHE_STATES, schemaFor, validate, assertValid, inferSchema };
