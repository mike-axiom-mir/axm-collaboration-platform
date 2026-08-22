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
const CHECKED_AT = '2026-08-20T09:00:00.000Z';
const FOCUSED = [
  'node tools/browser-lan-hardware-qa-lab/selftest.js',
  'node shared/operations/wave2-selftest.js',
  'node shared/voluntary-phone-qa-campaign/selftest.js',
  'node shared/grounded-growth-phone-evidence-gate/selftest.js',
  'node tests/shared-runtime-deterministic-json-test.js',
  'node shared/capabilities/selftest.js'
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
const PREREQUISITE_REQUIRED = REQUIRED[0];
const FINALIZE = [
  'node docs/steward-runs/2026-08-20-phone-qa-contract-runtime-closure/build-current-phone-qa-closure.js',
  'node docs/steward-runs/2026-08-20-phone-qa-contract-runtime-closure/selftest.js'
];

function args(command) {
  const parts = command.split(' ');
  if (parts.shift() !== 'node') throw new Error('only explicit node checks are supported');
  return parts;
}

function assertionCount(output) {
  return Array.from(String(output || '').matchAll(/(\d+)\s+(?:assertions?|checks?)/gi))
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
  const assertions = phase === 'FOCUSED' ? assertionCount(result.stdout) : 0;
  process.stdout.write((exitCode === 0 ? 'PASS ' : 'FAIL ') + command + '\n');
  if (exitCode !== 0) {
    const diagnostic = String(result.stderr || result.stdout || result.error || '').trim().slice(-1600);
    if (diagnostic) process.stderr.write(diagnostic + '\n');
  }
  return { command, phase, assertions, exitCode, verdict: exitCode === 0 ? 'PASS' : 'FAIL' };
}

function seal(receipt) {
  const payload = JSON.parse(Core.canonicalJson(receipt));
  delete payload.resultsDigest;
  receipt.resultsDigest = 'sha256:' + crypto.createHash('sha256').update(Core.canonicalJson(payload)).digest('hex');
  return receipt;
}

function build() {
  const checks = [
    execute(PREREQUISITE_REQUIRED, 'REQUIRED'),
    ...FOCUSED.map((command) => execute(command, 'FOCUSED')),
    ...REQUIRED.slice(1).map((command) => execute(command, 'REQUIRED')),
    ...FINALIZE.map((command) => execute(command, 'FOCUSED'))
  ];
  return seal({
    schema: 'axm.phone-qa-contract-runtime-check-results/v1',
    version: '0.1.0',
    status: 'TEST',
    checkedAt: CHECKED_AT,
    checks,
    summary: {
      total: checks.length,
      passed: checks.filter((item) => item.exitCode === 0).length,
      failed: checks.filter((item) => item.exitCode !== 0).length,
      explicitAssertions: checks.reduce((sum, item) => sum + item.assertions, 0),
      focusedTotal: FOCUSED.length + FINALIZE.length,
      focusedPassed: checks.filter((item) => item.phase === 'FOCUSED' && item.exitCode === 0).length,
      requiredTotal: REQUIRED.length,
      requiredPassed: checks.filter((item) => item.phase === 'REQUIRED' && item.exitCode === 0).length
    },
    typedGaps: [
      { id: 'physical-phone-session', state: 'DEGRADED', treatedAsPassingProductCheck: false },
      { id: 'human-usefulness', state: 'DEGRADED', treatedAsPassingProductCheck: false },
      { id: 'mobile-viewport-live-layout', state: 'UNKNOWN', treatedAsPassingProductCheck: false }
    ],
    retention: {
      rawStdoutStored: false,
      rawStderrStored: false,
      failureDiagnosticPrintedOnly: true,
      rawBrowserFramesStored: false
    },
    limits: {
      browserRunByThisScript: false,
      desktopBrowserRefusalReceiptRecorded: true,
      physicalPhoneSessionRun: false,
      mobileViewportRun: false,
      humanReviewRun: false,
      humanBenefitEstablished: false,
      verifierWarningsCleared: false
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
  });
}

if (require.main === module) {
  const receipt = build();
  if (process.argv.includes('--write')) fs.writeFileSync(OUTPUT, JSON.stringify(receipt, null, 2) + '\n', 'utf8');
  process.stdout.write(JSON.stringify(receipt.summary) + '\n');
  if (receipt.summary.failed) process.exitCode = 1;
}

module.exports = { ROOT, OUTPUT, CHECKED_AT, FOCUSED, REQUIRED, PREREQUISITE_REQUIRED, FINALIZE, assertionCount, build };
