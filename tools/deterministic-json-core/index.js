(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') root.AXMDeterministicJson = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function fail(message) { throw new TypeError(message); }

  function encode(value, seen, at) {
    if (value === null) return 'null';
    const type = typeof value;
    if (type === 'string' || type === 'boolean') return JSON.stringify(value);
    if (type === 'number') {
      if (!Number.isFinite(value)) fail('non-finite number at ' + at);
      return JSON.stringify(Object.is(value, -0) ? 0 : value);
    }
    if (type !== 'object') fail('unsupported ' + type + ' at ' + at);
    if (seen.has(value)) fail('cycle at ' + at);
    seen.add(value);
    let result;
    if (Array.isArray(value)) {
      const rows = [];
      for (let i = 0; i < value.length; i += 1) {
        if (!Object.prototype.hasOwnProperty.call(value, i)) fail('sparse array at ' + at + '[' + i + ']');
        rows.push(encode(value[i], seen, at + '[' + i + ']'));
      }
      result = '[' + rows.join(',') + ']';
    } else {
      const prototype = Object.getPrototypeOf(value);
      if (prototype !== Object.prototype && prototype !== null) fail('non-plain object at ' + at);
      const keys = Object.keys(value).sort();
      result = '{' + keys.map(function (key) {
        return JSON.stringify(key) + ':' + encode(value[key], seen, at + '.' + key);
      }).join(',') + '}';
    }
    seen.delete(value);
    return result;
  }

  function canonicalJson(value) { return encode(value, new Set(), '$'); }
  function sameCanonical(left, right) { return canonicalJson(left) === canonicalJson(right); }

  return { canonicalJson: canonicalJson, sameCanonical: sameCanonical };
});
