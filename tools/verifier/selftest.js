'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, 'manifest.json'), 'utf8'));
const config = JSON.parse(fs.readFileSync(path.join(ROOT, 'verify.config.json'), 'utf8'));
const runner = fs.readFileSync(path.join(ROOT, 'hub', 'verify-plus.js'), 'utf8');
let checks = 0;

function ok(condition, message) { assert.ok(condition, message); checks++; }
function equal(actual, expected, message) { assert.strictEqual(actual, expected, message); checks++; }

equal(manifest.version, 'v2.0', 'Verifier manifest must declare v2.0');
ok(manifest.uses.indexOf('verification-spine') >= 0, 'Verifier manifest must declare Verification Spine dependency');
equal(config.verificationSpine.schema, 'axm.verification-spine-config/v2', 'Config schema must be v2');
equal(config.verificationSpine.targetProfile, 'workshop-full', 'Default target profile must be explicit');
ok(Array.isArray(config.verificationSpine.failureMemory), 'Failure memory must be an array');
ok(html.indexOf('/shared/verification-spine/verification-spine.js') >= 0, 'Browser must load the shared spine implementation');
['categoryGrid', 'attentionLane', 'failureFlow', 'failureForm', 'fmAdd', 'fmSave', 'fmActivate', 'fmMonitor', 'fmHuman', 'fmRetire'].forEach(function (id) {
  ok(html.indexOf('id="' + id + '"') >= 0, 'Missing Verifier UI control: ' + id);
});
ok(html.indexOf('AXMVerificationSpine.createFailureCandidate') >= 0, 'Candidates must use the shared failure-memory constructor');
ok(html.indexOf('AXMVerificationSpine.reviseFailure') >= 0, 'Edits must append through the shared revision function');
ok(html.indexOf('entries=j.categories||[]') >= 0 && html.indexOf('(j.profiles||[])') >= 0, 'Browser registry loader must use the canonical registry field names');
ok(html.indexOf('What this judge requires') >= 0 && html.indexOf('baseline_claims') >= 0, 'Category cards must expose their deep baseline exam');
ok(html.indexOf('fmDelete') < 0, 'Admitted failure lessons must not have silent delete UI');
ok(html.indexOf('Remember') >= 0, 'Core report failures must be promotable into memory candidates');
ok(runner.indexOf("require('../shared/verification-spine/workspace-runner.js')") >= 0, 'verify-plus must invoke the shared runner');
ok(runner.indexOf("['FAILED', 'HELD', 'HUMAN_REVIEW']") >= 0, 'Unresolved spine verdicts must block the gate');

console.log('Verifier v2 self-test passed ' + checks + ' checks.');
