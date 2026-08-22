#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Redaction = require('./diagnostic-redaction');

const root = path.resolve(__dirname, '..', '..');
const index = JSON.parse(fs.readFileSync(path.join(root, 'tools-index.json'), 'utf8'));
const results = index.tools.map(tool => tool && tool.selftest && tool.selftest.result).filter(Boolean);
const failureTails = results.map(result => result.failureTail).filter(value => typeof value === 'string' && value.length > 0);
const exercisedTails = failureTails.length ? failureTails : [
  Redaction.failureTail('failure at ' + path.join(root, 'tools', 'fixture', 'selftest.js'), { workspaceRoot:root })
];
let assertions = 0;
function check(value, label) { assert(value, label); assertions += 1; }
function equal(actual, expected, label) { assert.equal(actual, expected, label); assertions += 1; }

equal(index.truth.failureDiagnosticsMachinePathRedacted, true, 'index truth must declare machine-path redaction');
equal(index.truth.failureDiagnosticsRecognizedCredentialEvidenceRedacted, true, 'index truth must declare recognized credential-evidence redaction');
exercisedTails.forEach((tail, position) => {
  equal(Redaction.redactDiagnostic(tail, { workspaceRoot:root }), tail, 'failure tail ' + position + ' must already be path-redacted');
  check(tail.length <= 1200, 'failure tail ' + position + ' must remain bounded');
});
check(exercisedTails.some(tail => tail.includes('<WORKSPACE>')), 'portable workspace-relative diagnostics remain visible');

console.log('tools index diagnostic privacy selftest: PASS (' + assertions + ' assertions across ' + exercisedTails.length + ' bounded failure tails, zero detected absolute machine paths or recognized credential evidence; retained=' + failureTails.length + ')');
