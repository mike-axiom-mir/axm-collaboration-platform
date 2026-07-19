'use strict';

const crypto = require('crypto');
const util = require('util');

const CELL_ID = 'axm.mirror.key-safe-json-transport-cell/v1';
const DEFAULT_MAX_BYTES = 16 * 1024 * 1024;
const DEFAULT_MAX_DEPTH = 128;
const DEFAULT_MAX_NODES = 100000;

function boundaryError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function boundedInteger(value, fallback, label) {
  const number = value == null ? fallback : Number(value);
  if (!Number.isSafeInteger(number) || number < 1) throw boundaryError('INVALID_LIMIT', `${label} must be a positive safe integer`);
  return number;
}

function defineData(target, key, value) {
  Object.defineProperty(target, key, {
    value,
    enumerable: true,
    configurable: true,
    writable: true
  });
}

function canonicalize(value, options = {}) {
  const maxBytes = boundedInteger(options.maxBytes, DEFAULT_MAX_BYTES, 'key-safe JSON maximum bytes');
  const maxDepth = boundedInteger(options.maxDepth, DEFAULT_MAX_DEPTH, 'key-safe JSON maximum depth');
  const maxNodes = boundedInteger(options.maxNodes, DEFAULT_MAX_NODES, 'key-safe JSON maximum nodes');
  const rejectKey = options.rejectKey == null ? null : options.rejectKey;
  if (rejectKey !== null && typeof rejectKey !== 'function') throw boundaryError('INVALID_KEY_POLICY', 'key-safe JSON key policy must be a function');
  const rejectedKeyMessage = String(options.rejectedKeyMessage || 'key-safe JSON key policy refused a property');
  const active = new WeakSet();
  let nodes = 0;

  function copy(current, depth, path) {
    nodes += 1;
    if (nodes > maxNodes || depth > maxDepth) throw boundaryError('BOUNDED_JSON_STRUCTURE_LIMIT', 'value exceeds the bounded key-safe JSON structure');
    if (current === null || typeof current === 'string' || typeof current === 'boolean') return current;
    if (typeof current === 'number') {
      if (!Number.isFinite(current)) throw boundaryError('NON_FINITE_NUMBER', 'value contains a non-finite JSON number');
      return Object.is(current, -0) ? 0 : current;
    }
    if (typeof current !== 'object') throw boundaryError('NON_JSON_VALUE', `value contains a non-JSON ${typeof current}`);
    if (util.types.isProxy(current)) throw boundaryError('PROXY_REFUSED', 'value contains a proxy rather than inert JSON data');
    if (active.has(current)) throw boundaryError('CYCLIC_VALUE', 'value contains a cyclic reference');
    active.add(current);
    try {
      if (Array.isArray(current)) {
        if (Object.getPrototypeOf(current) !== Array.prototype) throw boundaryError('NON_PLAIN_ARRAY', 'value contains an array with a changed prototype');
        const ownKeys = Reflect.ownKeys(current);
        if (ownKeys.some(key => typeof key === 'symbol')) throw boundaryError('SYMBOL_KEY', 'value contains a symbol key');
        const allowed = new Set(['length', ...Array.from({ length: current.length }, (_, index) => String(index))]);
        if (ownKeys.some(key => !allowed.has(key)) || ownKeys.length !== allowed.size) throw boundaryError('NON_JSON_ARRAY_SHAPE', 'value contains a sparse array or extra array property');
        const descriptors = Object.getOwnPropertyDescriptors(current);
        const out = new Array(current.length);
        for (let index = 0; index < current.length; index += 1) {
          const key = String(index);
          const descriptor = descriptors[key];
          if (!descriptor || !Object.prototype.hasOwnProperty.call(descriptor, 'value') || descriptor.enumerable !== true) throw boundaryError('ACCESSOR_OR_HIDDEN_PROPERTY', 'value contains an accessor or hidden array property');
          out[index] = copy(descriptor.value, depth + 1, path.concat(key));
        }
        return out;
      }

      if (Object.getPrototypeOf(current) !== Object.prototype) throw boundaryError('NON_PLAIN_OBJECT', 'value contains an object with a changed prototype');
      const ownKeys = Reflect.ownKeys(current);
      if (ownKeys.some(key => typeof key === 'symbol')) throw boundaryError('SYMBOL_KEY', 'value contains a symbol key');
      const descriptors = Object.getOwnPropertyDescriptors(current);
      const out = {};
      for (const key of ownKeys.slice().sort()) {
        const descriptor = descriptors[key];
        if (!descriptor || !Object.prototype.hasOwnProperty.call(descriptor, 'value') || descriptor.enumerable !== true) throw boundaryError('ACCESSOR_OR_HIDDEN_PROPERTY', 'value contains an accessor or hidden object property');
        if (rejectKey && rejectKey(key, path.concat(key)) === true) throw boundaryError('KEY_POLICY_REFUSAL', rejectedKeyMessage);
        defineData(out, key, copy(descriptor.value, depth + 1, path.concat(key)));
      }
      if (Object.getPrototypeOf(out) !== Object.prototype) throw boundaryError('TRANSPORT_PROTOTYPE_CHANGED', 'key-safe JSON transport changed the destination prototype');
      return out;
    } finally {
      active.delete(current);
    }
  }

  const canonical = copy(value, 0, []);
  const encoded = JSON.stringify(canonical);
  if (encoded === undefined) throw boundaryError('NON_JSON_VALUE', 'value cannot be encoded as JSON');
  const bytes = Buffer.byteLength(encoded, 'utf8');
  if (bytes > maxBytes) throw boundaryError('BOUNDED_JSON_SIZE_LIMIT', 'value exceeds the bounded key-safe JSON envelope');
  return {
    canonical,
    encoded,
    bytes,
    nodes,
    digest: crypto.createHash('sha256').update(encoded).digest('hex')
  };
}

function stable(value, options) {
  return canonicalize(value, options).canonical;
}

function digest(value, options) {
  return canonicalize(value, options).digest;
}

function same(left, right, options) {
  return canonicalize(left, options).encoded === canonicalize(right, options).encoded;
}

function sha256Bytes(value) {
  if (typeof value !== 'string' && !Buffer.isBuffer(value)) throw boundaryError('NON_BYTE_SOURCE', 'raw SHA-256 input must be a string or buffer');
  return crypto.createHash('sha256').update(value).digest('hex');
}

module.exports = {
  CELL_ID,
  DEFAULT_MAX_BYTES,
  DEFAULT_MAX_DEPTH,
  DEFAULT_MAX_NODES,
  canonicalize,
  stable,
  digest,
  same,
  sha256Bytes
};
