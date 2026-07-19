'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const Cell = require('../kernel/key-safe-json-transport-cell');
const EnvelopeAdapter = require('../organs/foundation-evidence-envelope-adapter-organ');

test('reserved-looking JSON names remain inert own data and canonical ordering is stable', () => {
  const left = JSON.parse('{"z":1,"prototype":{"kind":"public-model-field"},"constructor":"public-data","__proto__":{"polluted":true}}');
  const right = JSON.parse('{"constructor":"public-data","__proto__":{"polluted":true},"prototype":{"kind":"public-model-field"},"z":1}');
  const transported = Cell.canonicalize(left);
  assert.equal(transported.encoded, Cell.canonicalize(right).encoded);
  assert.equal(Object.getPrototypeOf(transported.canonical), Object.prototype);
  assert.equal(Object.prototype.hasOwnProperty.call(transported.canonical, '__proto__'), true);
  assert.equal(Object.prototype.hasOwnProperty.call(transported.canonical, 'constructor'), true);
  assert.equal(Object.prototype.hasOwnProperty.call(transported.canonical, 'prototype'), true);
  assert.deepEqual(Object.getOwnPropertyDescriptor(transported.canonical, '__proto__').value, { polluted: true });
  assert.equal(Object.prototype.polluted, undefined);
  assert.equal({}.polluted, undefined);
  assert.match(transported.encoded, /"__proto__":\{"polluted":true\}/);
});

test('transport is detached and post-seal source mutation changes a new digest only', () => {
  const source = { nested: { value: 1 } };
  const sealed = Cell.canonicalize(source);
  source.nested.value = 2;
  assert.equal(sealed.canonical.nested.value, 1);
  assert.notEqual(sealed.digest, Cell.digest(source));
  assert.equal(sealed.digest, Cell.digest(sealed.canonical));
});

test('polluted prototypes and proxies are refused without touching Object.prototype', () => {
  const polluted = { safe: true };
  Object.setPrototypeOf(polluted, { polluted: true });
  assert.throws(() => Cell.canonicalize(polluted), error => error && error.code === 'NON_PLAIN_OBJECT');
  const proxy = new Proxy({ safe: true }, {});
  assert.throws(() => Cell.canonicalize(proxy), error => error && error.code === 'PROXY_REFUSED');
  assert.equal(Object.prototype.polluted, undefined);
});

test('accessors, symbols, hidden properties, and non-JSON array shapes are refused', () => {
  let getterCalls = 0;
  const accessor = {};
  Object.defineProperty(accessor, 'secret', {
    enumerable: true,
    get() {
      getterCalls += 1;
      return 'never read';
    }
  });
  assert.throws(() => Cell.canonicalize(accessor), error => error && error.code === 'ACCESSOR_OR_HIDDEN_PROPERTY');
  assert.equal(getterCalls, 0);

  const symbolKey = { safe: true };
  symbolKey[Symbol('hidden')] = 1;
  assert.throws(() => Cell.canonicalize(symbolKey), error => error && error.code === 'SYMBOL_KEY');

  const hidden = { safe: true };
  Object.defineProperty(hidden, 'hidden', { value: 1, enumerable: false });
  assert.throws(() => Cell.canonicalize(hidden), error => error && error.code === 'ACCESSOR_OR_HIDDEN_PROPERTY');

  const sparse = [];
  sparse.length = 2;
  sparse[1] = 'present';
  assert.throws(() => Cell.canonicalize(sparse), error => error && error.code === 'NON_JSON_ARRAY_SHAPE');

  const extended = ['present'];
  extended.extra = true;
  assert.throws(() => Cell.canonicalize(extended), error => error && error.code === 'NON_JSON_ARRAY_SHAPE');
});

test('depth, node, byte, type, cycle, and finite-number limits stay explicit', () => {
  assert.throws(() => Cell.canonicalize({ a: { b: 1 } }, { maxDepth: 1 }), error => error && error.code === 'BOUNDED_JSON_STRUCTURE_LIMIT');
  assert.throws(() => Cell.canonicalize({ a: 1, b: 2 }, { maxNodes: 2 }), error => error && error.code === 'BOUNDED_JSON_STRUCTURE_LIMIT');
  assert.throws(() => Cell.canonicalize('abcdef', { maxBytes: 3 }), error => error && error.code === 'BOUNDED_JSON_SIZE_LIMIT');
  assert.throws(() => Cell.canonicalize({ value: undefined }), error => error && error.code === 'NON_JSON_VALUE');
  assert.throws(() => Cell.canonicalize({ value: Infinity }), error => error && error.code === 'NON_FINITE_NUMBER');
  const cyclic = {};
  cyclic.self = cyclic;
  assert.throws(() => Cell.canonicalize(cyclic), error => error && error.code === 'CYCLIC_VALUE');
});

test('adapter keeps semantic hidden-reasoning refusal separate from key-safe transport', () => {
  const publicReservedNames = JSON.parse('{"prototype":{"family":"public"},"constructor":"public","__proto__":{"note":"inert own data"}}');
  assert.equal(EnvelopeAdapter.assertJsonArtifact(publicReservedNames), true);
  const stable = EnvelopeAdapter.stable(publicReservedNames);
  assert.equal(Object.getPrototypeOf(stable), Object.prototype);
  assert.equal(Object.prototype.hasOwnProperty.call(stable, '__proto__'), true);
  assert.throws(() => EnvelopeAdapter.assertJsonArtifact({ nested: { private_reasoning: ['secret'] } }), /hidden reasoning/);
  let getterCalls = 0;
  const active = {};
  Object.defineProperty(active, 'value', {
    enumerable: true,
    get() {
      getterCalls += 1;
      return 'must-not-run';
    }
  });
  assert.throws(() => EnvelopeAdapter.assertJsonArtifact(active), /not inert plain JSON/);
  assert.equal(getterCalls, 0);
});
