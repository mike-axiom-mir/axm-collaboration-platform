#!/usr/bin/env node
'use strict';

const childProcess = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const Core = require('../../../tools/deterministic-json-core');

const ROOT = path.resolve(__dirname, '../../..');
const commands = [
  ['FOCUSED', 'node shared/operations/review-operation-lease-selftest.js'],
  ['FOCUSED', 'node shared/operations/review-operation-lease-retirement-selftest.js'],
  ['FOCUSED', 'node shared/operations/review-operation-lease-retirement-publication-selftest.js'],
  ['FOCUSED', 'node shared/operations/review-operation-lease-retirement-recovery-selftest.js'],
  ['FOCUSED', 'node shared/operations/review-operation-lease-retirement-recovery-convergence-selftest.js'],
  ['FOCUSED', 'node shared/operations/review-operation-lease-retirement-recovery-process-convergence-selftest.js'],
  ['FOCUSED', 'node shared/operations/review-operation-lease-retirement-intent-withdrawal-selftest.js'],
  ['FOCUSED', 'node shared/operations/review-operation-lease-retirement-decision-process-selftest.js'],
  ['FOCUSED', 'node tools/review-inbox/selftest.js'],
  ['FOCUSED', 'node tools/review-inbox/discovery-seam-review.js'],
  ['REQUIRED', 'node verify.js'],
  ['REQUIRED', 'node hub/hub-selftest.js'],
  ['REQUIRED', 'node hub/route-selftest.js'],
  ['REQUIRED', 'node hub/graft-selftest.js'],
  ['REQUIRED', 'node hub/skin-selftest.js'],
  ['REQUIRED', 'node hub/verify-plus.js'],
  ['REQUIRED', 'node tests/html-script-syntax-test.js'],
  ['REQUIRED', 'node tests/tool-forge-package-test.js'],
  ['REQUIRED', 'node tools/agent-tool-forge/selftest.js'],
  ['REQUIRED', 'node tools/evidence-desk/selftest.js']
];

function run(phase, command) {
  const file = command.slice(5);
  if (!/^[A-Za-z0-9._/-]+\.js$/.test(file) || file.includes('..')) throw new Error('unbounded check path');
  const result = childProcess.spawnSync(process.execPath, [file], { cwd:ROOT, encoding:'utf8', windowsHide:true, timeout:180000, maxBuffer:64 * 1024 * 1024 });
  const exitCode = Number.isInteger(result.status) ? result.status : 1;
  const output = String(result.stdout || '');
  const assertions = phase === 'FOCUSED'
    ? Array.from(output.matchAll(/(\d+)\s+(?:assertions?|checks?|controls?)\b/gi)).reduce((sum, match) => sum + Number(match[1]), 0)
    : 0;
  process.stdout.write((exitCode === 0 ? 'PASS ' : 'FAIL ') + command + '\n');
  return {
    phase, command, exitCode, verdict:exitCode === 0 ? 'PASS' : 'FAIL', assertions,
    diagnostic:exitCode === 0 ? null : String(result.stderr || result.stdout || result.error || '').trim().split(/\r?\n/).slice(-8).join('\n')
  };
}

const results = commands.map(item => run(item[0], item[1]));
const receipt = {
  schema:'axm.verification-check-results/v1',
  status:results.every(item => item.exitCode === 0) ? 'PASS' : 'FAIL',
  checkedAt:new Date().toISOString(),
  commands:results,
  summary:{
    commands:results.length,
    passed:results.filter(item => item.exitCode === 0).length,
    failed:results.filter(item => item.exitCode !== 0).length,
    focusedAssertions:results.reduce((sum, item) => sum + item.assertions, 0)
  },
  resultsDigest:null
};
const body = JSON.parse(Core.canonicalJson(receipt));
delete body.resultsDigest;
receipt.resultsDigest = 'sha256:' + crypto.createHash('sha256').update(Core.canonicalJson(body)).digest('hex');
fs.writeFileSync(path.join(__dirname,'CHECK_RESULTS.json'), JSON.stringify(receipt, null, 2) + '\n', 'utf8');
if (receipt.status !== 'PASS') process.exitCode = 1;
