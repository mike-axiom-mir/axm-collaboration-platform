(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.AXMTycoonCanonical = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var STATE_SCHEMA = 'axm.tycoon-steward.state/v0.1';
  var EXPORT_SCHEMA = 'axm.tycoon-steward.export/v0.1';
  var MAX_IMPORT_BYTES = 1024 * 1024;

  function clone(value) {
    if (value === undefined) return undefined;
    return JSON.parse(JSON.stringify(value));
  }

  function stableValue(value) {
    if (Array.isArray(value)) return value.map(stableValue);
    if (value && typeof value === 'object') {
      var out = {};
      Object.keys(value).sort().forEach(function (key) {
        out[key] = stableValue(value[key]);
      });
      return out;
    }
    return value;
  }

  function stableStringify(value) {
    return JSON.stringify(stableValue(value));
  }

  function utf8Bytes(text) {
    var encoded = unescape(encodeURIComponent(String(text)));
    var bytes = [];
    for (var i = 0; i < encoded.length; i += 1) bytes.push(encoded.charCodeAt(i));
    return bytes;
  }

  /* Small synchronous SHA-256 implementation shared by browser and Node. */
  function sha256(input) {
    var bytes = utf8Bytes(typeof input === 'string' ? input : stableStringify(input));
    var bitLength = bytes.length * 8;
    bytes.push(0x80);
    while ((bytes.length % 64) !== 56) bytes.push(0);
    var high = Math.floor(bitLength / 0x100000000);
    var low = bitLength >>> 0;
    for (var h = 3; h >= 0; h -= 1) bytes.push((high >>> (h * 8)) & 255);
    for (var l = 3; l >= 0; l -= 1) bytes.push((low >>> (l * 8)) & 255);

    var constants = [
      0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
      0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
      0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
      0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
      0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
      0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
      0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
      0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
    ];
    var hash = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
    var words = new Array(64);
    function rotate(value, bits) { return (value >>> bits) | (value << (32 - bits)); }
    for (var offset = 0; offset < bytes.length; offset += 64) {
      var i;
      for (i = 0; i < 16; i += 1) {
        var p = offset + i * 4;
        words[i] = ((bytes[p] << 24) | (bytes[p + 1] << 16) | (bytes[p + 2] << 8) | bytes[p + 3]) >>> 0;
      }
      for (i = 16; i < 64; i += 1) {
        var s0 = (rotate(words[i - 15], 7) ^ rotate(words[i - 15], 18) ^ (words[i - 15] >>> 3)) >>> 0;
        var s1 = (rotate(words[i - 2], 17) ^ rotate(words[i - 2], 19) ^ (words[i - 2] >>> 10)) >>> 0;
        words[i] = (words[i - 16] + s0 + words[i - 7] + s1) >>> 0;
      }
      var a = hash[0], b = hash[1], c = hash[2], d = hash[3];
      var e = hash[4], f = hash[5], g = hash[6], hh = hash[7];
      for (i = 0; i < 64; i += 1) {
        var big1 = (rotate(e, 6) ^ rotate(e, 11) ^ rotate(e, 25)) >>> 0;
        var choice = ((e & f) ^ ((~e) & g)) >>> 0;
        var temp1 = (hh + big1 + choice + constants[i] + words[i]) >>> 0;
        var big0 = (rotate(a, 2) ^ rotate(a, 13) ^ rotate(a, 22)) >>> 0;
        var majority = ((a & b) ^ (a & c) ^ (b & c)) >>> 0;
        var temp2 = (big0 + majority) >>> 0;
        hh = g; g = f; f = e; e = (d + temp1) >>> 0;
        d = c; c = b; b = a; a = (temp1 + temp2) >>> 0;
      }
      hash[0] = (hash[0] + a) >>> 0; hash[1] = (hash[1] + b) >>> 0;
      hash[2] = (hash[2] + c) >>> 0; hash[3] = (hash[3] + d) >>> 0;
      hash[4] = (hash[4] + e) >>> 0; hash[5] = (hash[5] + f) >>> 0;
      hash[6] = (hash[6] + g) >>> 0; hash[7] = (hash[7] + hh) >>> 0;
    }
    return hash.map(function (value) { return ('00000000' + value.toString(16)).slice(-8); }).join('');
  }

  function round(value, digits) {
    if (!Number.isFinite(value)) throw new Error('finite number required');
    var places = digits == null ? 4 : digits;
    var factor = Math.pow(10, places);
    return Math.round((value + Number.EPSILON) * factor) / factor;
  }

  function stateForHash(state) {
    var copy = clone(state);
    delete copy.receipts;
    delete copy.receiptHead;
    delete copy.observationalMetadata;
    return copy;
  }

  function hashState(state) {
    return sha256(stableStringify(stateForHash(state)));
  }

  function findUnsafeKey(value, path) {
    if (!value || typeof value !== 'object') return null;
    var base = path || '$';
    var keys = Object.keys(value);
    for (var i = 0; i < keys.length; i += 1) {
      var key = keys[i];
      if (key === '__proto__' || key === 'prototype' || key === 'constructor') return base + '.' + key;
      var nested = findUnsafeKey(value[key], base + '.' + key);
      if (nested) return nested;
    }
    return null;
  }

  function validateFinite(value, path, errors) {
    if (typeof value === 'number' && !Number.isFinite(value)) errors.push((path || '$') + ' must be finite');
    if (!value || typeof value !== 'object') return;
    Object.keys(value).forEach(function (key) { validateFinite(value[key], (path || '$') + '.' + key, errors); });
  }

  function makeExportPacket(state) {
    var exportedState = clone(state);
    return {
      schema: EXPORT_SCHEMA,
      stateSchema: STATE_SCHEMA,
      checksum: { algorithm: 'sha256', value: sha256(stableStringify(exportedState)) },
      state: exportedState
    };
  }

  function validateExportPacket(packet) {
    var errors = [];
    if (!packet || typeof packet !== 'object' || Array.isArray(packet)) return { ok: false, errors: ['packet must be an object'] };
    var unsafe = findUnsafeKey(packet);
    if (unsafe) errors.push('unsafe key refused at ' + unsafe);
    var size = stableStringify(packet).length;
    if (size > MAX_IMPORT_BYTES) errors.push('packet exceeds ' + MAX_IMPORT_BYTES + ' byte limit');
    if (packet.schema !== EXPORT_SCHEMA) errors.push('unsupported export schema');
    if (packet.stateSchema !== STATE_SCHEMA) errors.push('unsupported state schema');
    if (!packet.state || packet.state.schema !== STATE_SCHEMA) errors.push('state schema missing or unsupported');
    if (!packet.checksum || packet.checksum.algorithm !== 'sha256' || typeof packet.checksum.value !== 'string') errors.push('SHA-256 checksum required');
    if (packet.state && packet.checksum && packet.checksum.value !== sha256(stableStringify(packet.state))) errors.push('checksum mismatch');
    validateFinite(packet, '$', errors);
    return { ok: errors.length === 0, errors: errors, bytes: size };
  }

  return {
    STATE_SCHEMA: STATE_SCHEMA,
    EXPORT_SCHEMA: EXPORT_SCHEMA,
    MAX_IMPORT_BYTES: MAX_IMPORT_BYTES,
    clone: clone,
    stableValue: stableValue,
    stableStringify: stableStringify,
    sha256: sha256,
    round: round,
    stateForHash: stateForHash,
    hashState: hashState,
    findUnsafeKey: findUnsafeKey,
    validateFinite: validateFinite,
    makeExportPacket: makeExportPacket,
    validateExportPacket: validateExportPacket
  };
});
