'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const ContractVerifier = require('../../hub/module-contract-verifier');

const ROOT = path.resolve(__dirname, '..', '..');
const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, 'manifest.json'), 'utf8'));
const contractPath = path.join(__dirname, 'module.contract.json');
assert.ok(fs.existsSync(contractPath), 'Verifier module contract must exist');
const contract = JSON.parse(fs.readFileSync(contractPath, 'utf8'));
const config = JSON.parse(fs.readFileSync(path.join(ROOT, 'verify.config.json'), 'utf8'));
const runner = fs.readFileSync(path.join(ROOT, 'hub', 'verify-plus.js'), 'utf8');
let checks = 0;

function ok(condition, message) { assert.ok(condition, message); checks++; }
function equal(actual, expected, message) { assert.strictEqual(actual, expected, message); checks++; }

equal(manifest.version, 'v2.0', 'Verifier manifest must declare v2.0');
equal(manifest.schema, ContractVerifier.MANIFEST_SCHEMA, 'Verifier manifest must use the modern schema');
equal(manifest.kind, 'product', 'Verifier manifest must declare product kind');
equal(manifest.contract, 'module.contract.json', 'Verifier manifest must declare its module contract');
ok(JSON.stringify(manifest.permissions) === '[]' && JSON.stringify(contract.permissions) === '[]', 'Verifier must request no Hub permission token');
ok(ContractVerifier.validateContract(contract, manifest).pass, 'Verifier module contract must validate against its manifest');
ok(contract.lifecycle.state_owner === 'none' && contract.lifecycle.reload === 'reset', 'Verifier draft state must reset to the root config on reload');
['direct-root-config-write', 'browser-command-execution', 'downloaded-config-as-applied-state', 'report-freshness-claim', 'silent-failure-memory-deletion', 'automatic-workshop-status-promotion', 'canon-authority'].forEach(function (boundary) {
  ok(contract.boundaries.refuses.indexOf(boundary) >= 0, 'Verifier contract must refuse ' + boundary);
});
ok(manifest.uses.indexOf('verification-spine') >= 0, 'Verifier manifest must declare Verification Spine dependency');
equal(config.verificationSpine.schema, 'axm.verification-spine-config/v2', 'Config schema must be v2');
equal(config.verificationSpine.targetProfile, 'workshop-full', 'Default target profile must be explicit');
ok(Array.isArray(config.verificationSpine.failureMemory), 'Failure memory must be an array');
ok(html.indexOf('/shared/verification-spine/verification-spine.js') >= 0, 'Browser must load the shared spine implementation');
function attr(tag, name) {
  const match = String(tag).match(new RegExp('\\s' + name + '\\s*=\\s*(["\\\'])([\\s\\S]*?)\\1', 'i'));
  return match ? match[2] : null;
}
const markup = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '');
const labelIds = new Set(Array.from(markup.matchAll(/<label\b[^>]*\bfor\s*=\s*(["'])(.*?)\1/gi), function (match) { return match[2]; }));
for (const label of markup.matchAll(/<label\b[^>]*>([\s\S]*?)<\/label>/gi)) {
  for (const control of label[1].matchAll(/<(?:input|select|textarea)\b[^>]*>/gi)) {
    const id = attr(control[0], 'id');
    if (id) labelIds.add(id);
  }
}
const unnamedControls = Array.from(markup.matchAll(/<(?:input|select|textarea)\b[^>]*>/gi), function (match) { return match[0]; }).filter(function (tag) {
  const type = String(attr(tag, 'type') || '').toLowerCase();
  if (['hidden', 'button', 'submit'].indexOf(type) >= 0) return false;
  const id = attr(tag, 'id');
  const name = attr(tag, 'aria-label') || attr(tag, 'aria-labelledby') || attr(tag, 'title');
  return !name && !(id && labelIds.has(id));
}).map(function (tag) { return attr(tag, 'id') || tag; });
equal(unnamedControls.join(','), '', 'Every Verifier form control must have an accessible name');
['categoryGrid', 'attentionLane', 'failureFlow', 'failureForm', 'fmAdd', 'fmSave', 'fmActivate', 'fmMonitor', 'fmHuman', 'fmRetire'].forEach(function (id) {
  ok(html.indexOf('id="' + id + '"') >= 0, 'Missing Verifier UI control: ' + id);
});
ok(html.indexOf('AXMVerificationSpine.createFailureCandidate') >= 0, 'Candidates must use the shared failure-memory constructor');
ok(html.indexOf('AXMVerificationSpine.reviseFailure') >= 0, 'Edits must append through the shared revision function');
ok(html.indexOf('entries=j.categories||[]') >= 0 && html.indexOf('(j.profiles||[])') >= 0, 'Browser registry loader must use the canonical registry field names');
ok(html.indexOf('What this judge requires') >= 0 && html.indexOf('baseline_claims') >= 0, 'Category cards must expose their deep baseline exam');
ok(html.indexOf('fmDelete') < 0, 'Admitted failure lessons must not have silent delete UI');
ok(html.indexOf('Remember') >= 0, 'Core report failures must be promotable into memory candidates');
ok(html.indexOf('AXMHub.save(') < 0, 'Verifier must not persist an unused Hub draft checkpoint');
ok(/AXMHub\.ready\(\{[\s\S]*?permissions:\[\][\s\S]*?savesState:false/.test(html), 'Verifier passport must declare zero authority and no state persistence');
ok(html.indexOf("a.download='verify.config.json'") >= 0 && html.indexOf('URL.revokeObjectURL') >= 0, 'Config proposal must use an explicit download and revoke its temporary URL');
ok(html.indexOf('Edits are session-only') >= 0 && html.indexOf('Downloading does not replace the root config or run verification') >= 0, 'Stateless download and execution boundary must be visible');
ok(html.indexOf('replace root verify.config.json and run node hub/verify-plus.js') >= 0, 'Download instructions must preserve manual replacement and execution');
ok(html.indexOf('AXMHub.verifyPass') < 0 && html.indexOf('AXMHub.permission.request') < 0, 'Verifier browser must neither emit a pass intent nor request authority');
ok(!/https?:\/\//i.test(html), 'Verifier browser must declare no direct external-network URL');
ok(runner.indexOf("require('../shared/verification-spine/workspace-runner.js')") >= 0, 'verify-plus must invoke the shared runner');
ok(runner.indexOf("['FAILED', 'HELD', 'HUMAN_REVIEW']") >= 0, 'Unresolved spine verdicts must block the gate');

console.log('Verifier v2 self-test passed ' + checks + ' checks.');
