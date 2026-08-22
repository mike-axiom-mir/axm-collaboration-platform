#!/usr/bin/env node
'use strict';

const childProcess = require('child_process');
const fs = require('fs');
const path = require('path');
const Growth = require('../../../shared/grounded-growth-outcomes/grounded-growth-outcomes');

const ROOT = path.resolve(__dirname, '../../..');
const OUTPUT = path.join(__dirname, 'CHECK_RESULTS.json');
const CURRENT = 'docs/steward-runs/2026-08-20-grounded-growth-signal-lineage/CURRENT_STATE_RECEIPT.json';
const FOCUSED = [
  'node shared/grounded-growth-signal-lineage/selftest.js',
  'node docs/steward-runs/2026-08-20-grounded-growth-signal-lineage/selftest.js',
  'node docs/steward-runs/2026-08-20-grounded-growth-signal-lineage/build-signal-lineage-growth.js --check-recorded',
  'node shared/grounded-growth-outcomes/selftest.js',
  'node shared/grounded-growth-current-state/selftest.js',
  'node shared/grounded-growth-knowledge-frontier/selftest.js',
  'node shared/grounded-growth-participation-frontier/selftest.js',
  'node shared/research-contribution-intake/selftest.js',
  'node shared/verified-capability-loop/selftest.js',
  'node shared/baseline-simulation-lab/selftest.js',
  'node shared/portable-baseline-capsule/selftest.js',
  'node shared/visual-proof/selftest.js',
  'node shared/ai-native-hands/selftest.js',
  'node shared/evidence-retention/selftest.js',
  'node shared/grounded-growth-current-state/verify-current-state.js ' + CURRENT
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

function argumentsFor(command) {
  const parts = command.split(' ');
  if (parts.shift() !== 'node') throw new Error('only explicit node checks are supported');
  return parts;
}

function assertionCount(output) {
  const matches = Array.from(String(output || '').matchAll(/(\d+)\s+(?:assertions?|checks?)/gi));
  return matches.reduce((sum, match) => sum + Number(match[1]), 0);
}

function execute(command, phase) {
  const result = childProcess.spawnSync(process.execPath, argumentsFor(command), {
    cwd: ROOT,
    encoding: 'utf8',
    windowsHide: true,
    timeout: 180000
  });
  const exitCode = Number.isInteger(result.status) ? result.status : 1;
  const assertions = phase === 'FOCUSED_AND_ADJACENT' ? assertionCount(result.stdout) : 0;
  process.stdout.write((exitCode === 0 ? 'PASS ' : 'FAIL ') + command + '\n');
  if (exitCode !== 0) {
    const diagnostic = String(result.stderr || result.stdout || result.error || '').trim().slice(-1200);
    if (diagnostic) process.stderr.write(diagnostic + '\n');
  }
  return { command, phase, assertions, exitCode, verdict: exitCode === 0 ? 'PASS' : 'FAIL' };
}

function build() {
  const checks = [
    ...FOCUSED.map((command) => execute(command, 'FOCUSED_AND_ADJACENT')),
    ...REQUIRED.map((command) => execute(command, 'REQUIRED'))
  ];
  const receipt = {
    schema: 'axm.grounded-growth-signal-lineage-check-results/v1',
    version: '0.1.0',
    status: 'TEST',
    checkedAt: new Date().toISOString(),
    checks,
    summary: {
      total: checks.length,
      passed: checks.filter((item) => item.exitCode === 0).length,
      failed: checks.filter((item) => item.exitCode !== 0).length,
      explicitAssertions: checks.reduce((sum, item) => sum + item.assertions, 0),
      focusedTotal: FOCUSED.length,
      focusedPassed: checks.filter((item) => item.phase === 'FOCUSED_AND_ADJACENT' && item.exitCode === 0).length,
      requiredTotal: REQUIRED.length,
      requiredPassed: checks.filter((item) => item.phase === 'REQUIRED' && item.exitCode === 0).length
    },
    retention: {
      rawStdoutStored: false,
      rawStderrStored: false,
      failureDiagnosticPrintedOnly: true
    },
    authority: {
      install: false,
      permissionGrant: false,
      promotion: false,
      merge: false,
      canon: false,
      foundationMutation: false
    },
    resultsDigest: null
  };
  const payload = JSON.parse(JSON.stringify(receipt));
  delete payload.resultsDigest;
  receipt.resultsDigest = Growth.sha256(payload);
  return receipt;
}

if (require.main === module) {
  const receipt = build();
  if (process.argv.includes('--write')) fs.writeFileSync(OUTPUT, JSON.stringify(receipt, null, 2) + '\n');
  process.stdout.write(JSON.stringify(receipt.summary) + '\n');
  if (receipt.summary.failed) process.exitCode = 1;
}

module.exports = { ROOT, OUTPUT, FOCUSED, REQUIRED, assertionCount, build };
