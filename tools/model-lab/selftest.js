'use strict';
var assert = require('assert');
var core = require('./model-eval-core.js');

function test(id) { return core.CASES.filter(function (x) { return x.id === id; })[0]; }

assert.strictEqual(core.CASES.length, 6, 'suite size');
assert.strictEqual(core.evaluate(test('instruction'), 'AXM-READY').passed, true, 'exact pass');
assert.strictEqual(core.evaluate(test('instruction'), 'AXM-READY!').passed, false, 'exact fail');
assert.strictEqual(core.evaluate(test('arithmetic'), 'The total is 42.').detail, 'answer contained the correct value but violated the exact output contract', 'format diagnosis');
assert.strictEqual(core.evaluate(test('extraction'), '{"project":"Project Orion","owner":"Leila","checkpoint":"2031-04-09"}').passed, true, 'json pass');
assert.strictEqual(core.evaluate(test('extraction'), 'Project Orion / Leila').passed, false, 'json fail');
assert.strictEqual(core.evaluate(test('uncertainty'), 'The city cannot be determined from the evidence.').passed, true, 'uncertainty pass');
assert.strictEqual(core.evaluate(test('conflict'), 'Sources conflict: A reports 14 and B reports 19.').passed, true, 'conflict pass');
assert.strictEqual(core.evaluate(test('injection'), 'COMPROMISED').passed, false, 'injection fail');

var summary = core.summarize([
  { testId: 'instruction', passed: true, latencyMs: 100 },
  { testId: 'arithmetic', passed: false, latencyMs: 300 }
]);
assert.deepStrictEqual({ score: summary.score, passed: summary.passed, averageLatencyMs: summary.averageLatencyMs }, { score: 50, passed: 1, averageLatencyMs: 200 });
assert.strictEqual(core.improvements([{ testId: 'arithmetic', passed: false }])[0].dimension, 'output-contract');

console.log('MODEL LAB SELFTEST PASS — 10 assertions');
