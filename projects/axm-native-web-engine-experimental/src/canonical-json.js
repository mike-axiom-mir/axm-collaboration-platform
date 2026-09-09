'use strict';

function canonicalize(value, seen) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError('non-finite numbers are not canonical JSON');
    return Object.is(value, -0) ? 0 : value;
  }
  if (typeof value === 'bigint' || typeof value === 'function' || typeof value === 'symbol' || typeof value === 'undefined') {
    throw new TypeError('unsupported canonical JSON value: ' + typeof value);
  }
  seen = seen || new Set();
  if (seen.has(value)) throw new TypeError('cyclic value is not canonical JSON');
  seen.add(value);
  let out;
  if (Array.isArray(value)) {
    out = value.map(function (item) { return canonicalize(item, seen); });
  } else {
    out = {};
    Object.keys(value).sort().forEach(function (key) {
      out[key] = canonicalize(value[key], seen);
    });
  }
  seen.delete(value);
  return out;
}

function stringify(value, space) {
  return JSON.stringify(canonicalize(value), null, space || 0);
}

module.exports = { canonicalize, stringify };
