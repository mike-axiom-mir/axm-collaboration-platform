(function (root, factory) {
  'use strict';
  var deterministicJson = typeof module !== 'undefined' && module.exports
    ? require('../../tools/deterministic-json-core')
    : root && root.AXMDeterministicJson;
  var api = factory(deterministicJson);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.AXMHolodeckCore = api;
})(typeof self !== 'undefined' ? self : globalThis, function (DeterministicJson) {
  'use strict';

  if (!DeterministicJson || typeof DeterministicJson.canonicalJson !== 'function') {
    throw new Error('AXM deterministic JSON core is required');
  }

  var ID_PATTERN = /^[a-z0-9][a-z0-9._:-]{0,119}$/;
  var HASH_SEEDS = [0x811c9dc5, 0x9e3779b9, 0x85ebca6b, 0xc2b2ae35];
  var HASH_PRIMES = [0x01000193, 0x27d4eb2d, 0x165667b1, 0x85ebca77];

  function clone(value) {
    return JSON.parse(DeterministicJson.canonicalJson(value));
  }

  function text(value, max) {
    var result = String(value == null ? '' : value).trim();
    return max ? result.slice(0, max) : result;
  }

  function finite(value) {
    return typeof value === 'number' && Number.isFinite(value);
  }

  function clamp(value, min, max, fallback) {
    var number = Number(value);
    if (!Number.isFinite(number)) return fallback;
    return Math.max(min, Math.min(max, number));
  }

  function round(value, places) {
    var scale = Math.pow(10, places == null ? 6 : places);
    return Math.round(Number(value) * scale) / scale;
  }

  function vec3(value, fallback) {
    var source = Array.isArray(value) ? value : fallback || [0, 0, 0];
    return [round(source[0]), round(source[1]), round(source[2])];
  }

  function stableValue(value) {
    return JSON.parse(stableStringify(value));
  }

  function stableStringify(value) {
    return DeterministicJson.canonicalJson(value);
  }

  function digest(value) {
    var source = typeof value === 'string' ? value : stableStringify(value);
    var hashes = HASH_SEEDS.slice();
    for (var index = 0; index < source.length; index += 1) {
      var code = source.charCodeAt(index);
      for (var lane = 0; lane < hashes.length; lane += 1) {
        hashes[lane] = Math.imul(hashes[lane] ^ (code + lane * 131), HASH_PRIMES[lane]);
        hashes[lane] ^= hashes[lane] >>> 13;
      }
    }
    return hashes.map(function (hash, lane) {
      hash ^= source.length + lane * 0x9e37;
      hash = Math.imul(hash ^ (hash >>> 16), 0x7feb352d);
      hash = Math.imul(hash ^ (hash >>> 15), 0x846ca68b);
      hash ^= hash >>> 16;
      return ('00000000' + (hash >>> 0).toString(16)).slice(-8);
    }).join('');
  }

  function assert(condition, message) {
    if (!condition) throw new Error(message || 'Holodeck assertion failed');
  }

  function validId(value) {
    return ID_PATTERN.test(text(value, 121));
  }

  function angle(value) {
    var result = round(Number(value) || 0, 4) % 360;
    return result < 0 ? result + 360 : result;
  }

  function distance2d(left, right) {
    var dx = Number(left[0]) - Number(right[0]);
    var dz = Number(left[2]) - Number(right[2]);
    return round(Math.sqrt(dx * dx + dz * dz), 6);
  }

  function same(left, right) {
    return stableStringify(left) === stableStringify(right);
  }

  return {
    HASH_ALGORITHM: 'axm-stable32x4/v1',
    ID_PATTERN: ID_PATTERN,
    clone: clone,
    text: text,
    finite: finite,
    clamp: clamp,
    round: round,
    vec3: vec3,
    stableValue: stableValue,
    stableStringify: stableStringify,
    digest: digest,
    assert: assert,
    validId: validId,
    angle: angle,
    distance2d: distance2d,
    same: same
  };
});
