'use strict';

const crypto = require('crypto');

function canonical(value, stack) {
  stack = stack || new Set();
  if (value === null) return 'null';
  if (typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError('canonical JSON refuses non-finite numbers');
    return JSON.stringify(Object.is(value, -0) ? 0 : value);
  }
  if (typeof value !== 'object') throw new TypeError('canonical JSON refuses ' + typeof value);
  if (stack.has(value)) throw new TypeError('canonical JSON refuses cycles');
  stack.add(value);
  try {
    if (Array.isArray(value)) {
      for (let index = 0; index < value.length; index += 1) {
        if (!Object.prototype.hasOwnProperty.call(value, index)) throw new TypeError('canonical JSON refuses sparse arrays');
      }
      return '[' + value.map((item) => canonical(item, stack)).join(',') + ']';
    }
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) throw new TypeError('canonical JSON accepts plain records only');
    const keys = Object.keys(value).sort();
    for (const key of keys) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor || descriptor.get || descriptor.set) throw new TypeError('canonical JSON refuses accessors');
      if (descriptor.value === undefined) throw new TypeError('canonical JSON refuses undefined values');
    }
    return '{' + keys.map((key) => JSON.stringify(key) + ':' + canonical(value[key], stack)).join(',') + '}';
  } finally {
    stack.delete(value);
  }
}

function bytes(value) { return Buffer.from(canonical(value), 'utf8'); }
function sha256(value) { return crypto.createHash('sha256').update(Buffer.isBuffer(value) ? value : Buffer.from(value)).digest('hex'); }
function digest(value) { return sha256(bytes(value)); }
function clone(value) { return JSON.parse(canonical(value)); }

function withoutDigest(value) {
  const copy = clone(value);
  delete copy.digest;
  return copy;
}

function seal(value) {
  const copy = withoutDigest(value);
  copy.digest = digest(copy);
  return copy;
}

function validDigest(value) {
  return !!value && /^[a-f0-9]{64}$/.test(String(value.digest || '')) && value.digest === digest(withoutDigest(value));
}

module.exports = { canonical, bytes, sha256, digest, clone, withoutDigest, seal, validDigest };
