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
  'node tools/deterministic-json-core/selftest.js',
  'node docs/steward-runs/2026-08-20-grounded-growth-upstream-json-roots/scan-workshop-json-seams.js',
  'node docs/steward-runs/2026-08-20-grounded-growth-upstream-json-roots/probe-voluntary-phone-qa-gap.js',
  'node docs/steward-runs/2026-08-20-grounded-growth-upstream-json-roots/build-current-upstream-closure.js',
  'node docs/steward-runs/2026-08-20-grounded-growth-upstream-json-roots/selftest.js',
  'node shared/verified-capability-loop/selftest.js',
  'node shared/human-benefit-evidence/selftest.js',
  'node shared/portable-baseline-capsule/selftest.js',
  'node shared/baseline-simulation-lab/selftest.js',
  'node shared/research-contribution-intake/selftest.js',
  'node shared/simulation-lab-extension-intake/selftest.js',
  'node shared/grounded-growth-challenger-lab/selftest.js',
  'node shared/grounded-growth-current-state/selftest.js',
  'node shared/grounded-growth-direction-handoff/selftest.js',
  'node shared/grounded-growth-feedback/selftest.js',
  'node shared/grounded-growth-frontier-gate/selftest.js',
  'node shared/grounded-growth-human-bridge/selftest.js',
  'node shared/grounded-growth-human-bridge-v2/selftest.js',
  'node shared/grounded-growth-human-handoff/selftest.js',
  'node shared/grounded-growth-human-route-coverage/selftest.js',
  'node shared/grounded-growth-knowledge-frontier/selftest.js',
  'node shared/grounded-growth-outcomes/selftest.js',
  'node shared/grounded-growth-participation-frontier/selftest.js',
  'node shared/grounded-growth-phone-evidence-gate/selftest.js',
  'node shared/grounded-growth-signal-lineage/selftest.js',
  'node shared/grounded-growth-voluntary-choice-frontier/selftest.js',
  'node tools/browser-lan-hardware-qa-lab/selftest.js',
  'node docs/steward-runs/2026-08-20-grounded-growth-json-full-closure/build-current-full-closure.js',
  'node docs/steward-runs/2026-08-20-grounded-growth-json-full-closure/selftest.js'
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
    schema: 'axm.grounded-growth-upstream-json-check-results/v1',
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
      requiredPassed: checks.filter((item) => item.phase === 'REQUIRED' && item.exitCode === 0).length,
      expectedTypedGaps: 1
    },
    typedGaps: [{
      id: 'voluntary-phone-qa-current-contract',
      evidence: 'PHONE_QA_GAP.json',
      state: 'DEFERRED_CONTRACT_AND_EVIDENCE_GAP',
      treatedAsPassingProductCheck: false
    }],
    retention: {
      rawStdoutStored: false,
      rawStderrStored: false,
      failureDiagnosticPrintedOnly: true
    },
    limits: {
      browserRenderClickTestRun: false,
      humanReviewRun: false,
      fullWorkshopRepresentationClosureProved: false,
      humanBenefitEstablished: false,
      modelLearningImprovementEstablished: false,
      shadowCloneCandidateEvaluated: false
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
  const payload = JSON.parse(Core.canonicalJson(receipt));
  delete payload.resultsDigest;
  receipt.resultsDigest = 'sha256:' + crypto.createHash('sha256').update(Core.canonicalJson(payload)).digest('hex');
  return receipt;
}

if (require.main === module) {
  const receipt = build();
  if (process.argv.includes('--write')) fs.writeFileSync(OUTPUT, JSON.stringify(receipt, null, 2) + '\n', 'utf8');
  process.stdout.write(JSON.stringify(receipt.summary) + '\n');
  if (receipt.summary.failed) process.exitCode = 1;
}

module.exports = { ROOT, OUTPUT, FOCUSED, REQUIRED, assertionCount, build };
