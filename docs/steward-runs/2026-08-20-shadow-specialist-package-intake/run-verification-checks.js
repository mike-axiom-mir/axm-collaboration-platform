#!/usr/bin/env node
'use strict';

const childProcess = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const Core = require('../../../tools/deterministic-json-core');

const workshop = path.resolve(__dirname, '../../..');
const commands = [
  'docs/steward-runs/2026-08-20-shadow-specialist-package-intake/build-shadow-specialist-intake.js',
  'docs/steward-runs/2026-08-20-shadow-specialist-package-intake/selftest.js',
  'shared/research-contribution-intake/selftest.js',
  'shared/model-shadow-continuity/selftest.js',
  'shared/model-shadow-challenger-gate/selftest.js',
  'shared/grounded-growth-challenger-lab/selftest.js',
  'tools/branch-module-return-gate/selftest.js',
  'tools/deterministic-json-core/selftest.js',
  'verify.js',
  'hub/hub-selftest.js',
  'hub/route-selftest.js',
  'hub/graft-selftest.js',
  'hub/skin-selftest.js',
  'hub/verify-plus.js',
  'tests/html-script-syntax-test.js',
  'tests/tool-forge-package-test.js',
  'tools/agent-tool-forge/selftest.js',
  'tools/evidence-desk/selftest.js'
];

function sha256(value) {
  return 'sha256:' + crypto.createHash('sha256').update(value).digest('hex');
}

const results = commands.map(script => {
  const run = childProcess.spawnSync(process.execPath, [script], {
    cwd: workshop,
    encoding: 'utf8',
    windowsHide: true,
    maxBuffer: 16 * 1024 * 1024
  });
  const stdout = run.stdout || '';
  const stderr = run.stderr || '';
  return {
    command: 'node ' + script,
    exitCode: run.status,
    signal: run.signal || null,
    passed: run.status === 0,
    stdoutBytes: Buffer.byteLength(stdout),
    stdoutSha256: sha256(stdout),
    stderrBytes: Buffer.byteLength(stderr),
    stderrSha256: sha256(stderr),
    focusedPassAssertions: (stdout.match(/\bPASS\b/g) || []).length
  };
});

const receipt = {
  schema: 'axm.shadow-specialist-intake-check-results/v1',
  generatedAt: new Date().toISOString(),
  status: results.every(item => item.passed) ? 'PASS' : 'FAIL',
  summary: {
    commands: results.length,
    passed: results.filter(item => item.passed).length,
    failed: results.filter(item => !item.passed).length,
    focusedPassAssertions: results.reduce((sum, item) => sum + item.focusedPassAssertions, 0)
  },
  results,
  truth: {
    packageCodeExecuted: false,
    packageTestsExecuted: false,
    browserRenderClickTestApplicable: false,
    browserRenderClickTestRun: false,
    installed: false,
    promoted: false,
    canonChanged: false
  },
  resultsDigest: null
};
const payload = JSON.parse(Core.canonicalJson(receipt));
delete payload.resultsDigest;
receipt.resultsDigest = sha256(Core.canonicalJson(payload));
fs.writeFileSync(path.join(__dirname, 'CHECK_RESULTS.json'), JSON.stringify(receipt, null, 2) + '\n');
process.stdout.write(JSON.stringify({
  status: receipt.status,
  commands: receipt.summary.commands,
  failed: receipt.summary.failed,
  focusedPassAssertions: receipt.summary.focusedPassAssertions,
  resultsDigest: receipt.resultsDigest
}) + '\n');
if (receipt.status !== 'PASS') process.exitCode = 1;
