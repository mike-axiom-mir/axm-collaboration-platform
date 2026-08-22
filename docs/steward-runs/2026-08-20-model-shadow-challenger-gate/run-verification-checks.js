#!/usr/bin/env node
'use strict';

const childProcess = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Core = require('../../../tools/deterministic-json-core');

const ROOT = path.resolve(__dirname, '../../..');
const OUTPUT = path.join(__dirname, 'CHECK_RESULTS.json');
const FOCUSED = [
  'node shared/model-shadow-challenger-gate/selftest.js',
  'node shared/model-shadow-continuity/selftest.js',
  'node shared/grounded-growth-direction-handoff/selftest.js',
  'node shared/grounded-growth-challenger-lab/selftest.js',
  'node tools/review-inbox/selftest.js',
  'node shared/grounded-growth-outcomes/selftest.js',
  'node shared/grounded-growth-feedback/selftest.js',
  'node tools/deterministic-json-core/selftest.js'
];
const REQUIRED = [
  'node verify.js',
  'node hub/hub-selftest.js',
  'node hub/route-selftest.js',
  'node hub/graft-selftest.js',
  'node hub/skin-selftest.js',
  'node hub/verify-plus.js',
  'node tests/html-script-syntax-test.js',
  'node tests/tool-forge-package-test.js',
  'node tools/agent-tool-forge/selftest.js',
  'node tools/evidence-desk/selftest.js'
];

function args(command) {
  const parts = command.split(' ');
  if (parts.shift() !== 'node') throw new Error('only explicit node checks are supported');
  return parts;
}

function assertionCount(output) {
  return Array.from(String(output || '').matchAll(/(\d+)\s+(?:assertions?|checks?|evidence groups?)/gi))
    .reduce((sum, match) => sum + Number(match[1]), 0);
}

function execute(command, phase) {
  const result = childProcess.spawnSync(process.execPath, args(command), {
    cwd: ROOT,
    encoding: 'utf8',
    windowsHide: true,
    timeout: 180000,
    env: { ...process.env, AXM_TEST_TEMP: os.tmpdir() }
  });
  const exitCode = Number.isInteger(result.status) ? result.status : 1;
  const diagnostic = exitCode === 0 ? null : String(result.stderr || result.stdout || result.error || '').trim().slice(-2000);
  process.stdout.write((exitCode === 0 ? 'PASS ' : 'FAIL ') + command + '\n');
  if (diagnostic) process.stderr.write(diagnostic + '\n');
  return {
    command,
    phase,
    assertions: phase === 'FOCUSED' ? assertionCount(result.stdout) : 0,
    exitCode,
    verdict: exitCode === 0 ? 'PASS' : 'FAIL',
    diagnostic
  };
}

const results = [];
FOCUSED.forEach(command => results.push(execute(command, 'FOCUSED')));
REQUIRED.forEach(command => results.push(execute(command, 'REQUIRED')));
const receipt = {
  schema: 'axm.verification-check-results/v1',
  status: results.every(item => item.exitCode === 0) ? 'PASS' : 'FAIL',
  checkedAt: new Date().toISOString(),
  commands: results,
  summary: {
    commands: results.length,
    passed: results.filter(item => item.exitCode === 0).length,
    failed: results.filter(item => item.exitCode !== 0).length,
    focusedAssertions: results.reduce((sum, item) => sum + item.assertions, 0)
  },
  resultsDigest: null
};
const payload = JSON.parse(Core.canonicalJson(receipt));
delete payload.resultsDigest;
receipt.resultsDigest = 'sha256:' + crypto.createHash('sha256').update(Core.canonicalJson(payload)).digest('hex');
fs.writeFileSync(OUTPUT, JSON.stringify(receipt, null, 2) + '\n', 'utf8');
if (receipt.status !== 'PASS') process.exitCode = 1;
