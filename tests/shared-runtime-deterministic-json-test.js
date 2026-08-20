#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const DeterministicJson = require('../tools/deterministic-json-core');
const modules = [
  ['cognitive-resource', require('../shared/cognitive-resource/cognitive-resource-core')],
  ['holodeck', require('../shared/holodeck/core')],
  ['mirror-core', require('../shared/mirror-core/core/utils')],
  ['sensorium', require('../shared/sensorium/core')],
  ['verification-snapshot-continuity', require('../shared/verification-snapshot-continuity/verification-snapshot-continuity')],
  ['verification-source-evolution-review', require('../shared/verification-source-evolution-review/verification-source-evolution-review')],
  ['voluntary-phone-qa-campaign', require('../shared/voluntary-phone-qa-campaign/voluntary-phone-qa-campaign')]
];

function safeFixtures() {
  const shared = { x: 1 };
  return [
    { z: 1, a: [true, null, 'x'] },
    { 'line\nkey': 'snowman ☃ and quote "' },
    { value: -0 },
    [{ b: 2, a: 1 }, [], { deep: [false, 0, null] }],
    { negative: -12.5, positive: 42, small: 0.00025 },
    { left: shared, right: shared }
  ];
}

function unsafeFixtures() {
  return [
    () => undefined,
    () => ({ lost: undefined }),
    () => ({ nested: { lost: undefined } }),
    () => [1, undefined],
    () => { const value = []; value.length = 1; return value; },
    () => ({ number: NaN }),
    () => ({ number: Infinity }),
    () => ({ number: -Infinity }),
    () => ({ number: 1n }),
    () => ({ value: Symbol('x') }),
    () => ({ value: function fixture() {} }),
    () => ({ value: new Date('2020-01-01T00:00:00.000Z') }),
    () => { const value = {}; value.self = value; return value; }
  ];
}

let assertions = 0;
for (const [id, api] of modules) {
  for (const value of safeFixtures()) {
    assert.strictEqual(api.stableStringify(value), DeterministicJson.canonicalJson(value), id + ' safe bytes differ');
    assertions += 1;
  }
  for (const makeValue of unsafeFixtures()) {
    assert.throws(() => api.stableStringify(makeValue()), id + ' accepted unsafe state');
    assertions += 1;
  }
}

const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'axm-mirror-json-refusal-'));
try {
  for (const [id, api] of modules) {
    const target = path.join(temporary, id + '.json');
    const canonical = api.stableStringify({ z: [3, 2, 1], a: { ok: true } });
    fs.writeFileSync(target, canonical, 'utf8');
    const parsed = JSON.parse(fs.readFileSync(target, 'utf8'));
    assert.strictEqual(api.stableStringify(parsed), canonical, id + ' persistence roundtrip drifted');
    fs.unlinkSync(target);
    assert.strictEqual(fs.existsSync(target), false, id + ' persistence fixture was not cleaned');
    assertions += 2;
  }
  const target = path.join(temporary, 'unsafe.json');
  assert.throws(() => modules[2][1].atomicWriteJson(target, { lost: undefined }), TypeError);
  assert.strictEqual(fs.existsSync(target), false, 'Mirror persisted lossy JSON state');
  assert.deepStrictEqual(fs.readdirSync(temporary), [], 'Mirror left a partial temporary file');
  assertions += 3;
} finally {
  fs.rmSync(temporary, { recursive: true, force: true });
}

const browserRoot = {};
const context = vm.createContext({ console });
context.window = browserRoot;
context.self = browserRoot;
vm.runInContext(fs.readFileSync(path.join(ROOT, 'tools/deterministic-json-core/index.js'), 'utf8'), context);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'shared/holodeck/core.js'), 'utf8'), context);
assert.strictEqual(typeof browserRoot.AXMDeterministicJson.canonicalJson, 'function');
assert.strictEqual(typeof browserRoot.AXMHolodeckCore.stableStringify, 'function');
assert.throws(() => vm.runInContext('self.AXMHolodeckCore.stableStringify({ lost: undefined })', context));
assert.strictEqual(vm.runInContext('self.AXMHolodeckCore.stableStringify({ z: 1, a: 2 })', context), '{"a":2,"z":1}');
assertions += 4;

console.log('PASS shared runtime deterministic JSON test (' + assertions + ' assertions)');
