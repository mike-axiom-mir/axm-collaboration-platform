'use strict';
const assert = require('assert');
const api = require('./index.js');

assert.strictEqual(api.canonicalJson({ z: 1, a: [true, null, 'x'] }), '{"a":[true,null,"x"],"z":1}');
assert.strictEqual(api.canonicalJson({ b: 2, a: 1 }), api.canonicalJson({ a: 1, b: 2 }));
assert.strictEqual(api.sameCanonical({ a: -0 }, { a: 0 }), true);
assert.throws(() => api.canonicalJson({ a: undefined }), /unsupported undefined/);
assert.throws(() => api.canonicalJson([, 1]), /sparse array/);
assert.throws(() => api.canonicalJson({ a: Infinity }), /non-finite/);
const cyclic = {}; cyclic.self = cyclic;
assert.throws(() => api.canonicalJson(cyclic), /cycle/);
console.log('deterministic-json-core: PASS');
