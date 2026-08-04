'use strict';
var assert = require('assert');
var fs = require('fs');
var path = require('path');
var core = require('./model-eval-core.js');
var ContractVerifier = require('../../hub/module-contract-verifier');
var AccessibilityAudit = require('../../scripts/accessibility-static-audit');

var htmlPath = path.join(__dirname, 'index.html');
var html = fs.readFileSync(htmlPath, 'utf8');
var manifest = JSON.parse(fs.readFileSync(path.join(__dirname, 'manifest.json'), 'utf8'));
var contract = JSON.parse(fs.readFileSync(path.join(__dirname, 'module.contract.json'), 'utf8'));

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

assert.strictEqual(manifest.contract, 'module.contract.json', 'manifest contract declaration');
assert.strictEqual(contract.id, manifest.id, 'contract id');
assert.strictEqual(contract.version, manifest.version, 'contract version');
assert.deepStrictEqual(ContractVerifier.validateContract(contract, manifest).errors, [], 'contract validation');
assert.deepStrictEqual(AccessibilityAudit.auditHtml(htmlPath).filter(function (item) { return item.code === 'FORM_NAME_MISSING'; }), [], 'accessible form names');
assert(html.indexOf('fallback:false') >= 0 && html.indexOf('human review required') >= 0 && html.indexOf('URL.revokeObjectURL') >= 0, 'browser evidence boundaries');
['automatic-model-call-on-load', 'fallback-provider-substitution', 'automatic-winner-selection', 'automatic-model-promotion', 'mechanical-score-as-truth', 'mechanical-score-as-quality-certification', 'canon-authority'].forEach(function (boundary) {
  assert(contract.boundaries.refuses.indexOf(boundary) >= 0, boundary);
});
assert.deepStrictEqual(contract.permissions, [], 'no module authority');

console.log('MODEL LAB SELFTEST PASS — core + UI + contract');
