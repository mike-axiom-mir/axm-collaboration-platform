#!/usr/bin/env node
'use strict';

const childProcess = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const Core = require('../../../tools/deterministic-json-core');

const ROOT = path.resolve(__dirname, '../../..');
const OUTPUT = path.join(__dirname, 'CHECK_RESULTS.json');
const NODE = process.execPath;
const FOCUSED = [
  { command: 'node docs/steward-runs/2026-08-20-shared-runtime-json-closure/build-current-shared-runtime-closure.js', executable: NODE, args: ['docs/steward-runs/2026-08-20-shared-runtime-json-closure/build-current-shared-runtime-closure.js'] },
  { command: 'node tests/shared-runtime-deterministic-json-test.js', executable: NODE, args: ['tests/shared-runtime-deterministic-json-test.js'] },
  { command: 'node shared/cognitive-resource/selftest.js', executable: NODE, args: ['shared/cognitive-resource/selftest.js'] },
  { command: 'node shared/cognitive-resource/cognitive-evidence-labs-selftest.js', executable: NODE, args: ['shared/cognitive-resource/cognitive-evidence-labs-selftest.js'] },
  { command: 'node shared/cognitive-resource/objective-audit.js', executable: NODE, args: ['shared/cognitive-resource/objective-audit.js'] },
  { command: 'node shared/holodeck/selftest.js', executable: NODE, args: ['shared/holodeck/selftest.js'] },
  { command: 'node tools/holodeck-composer/selftest.js', executable: NODE, args: ['tools/holodeck-composer/selftest.js'] },
  { command: 'node tools/holodeck-screen-deck/selftest.js', executable: NODE, args: ['tools/holodeck-screen-deck/selftest.js'] },
  { command: 'node --test --test-concurrency=1 tests/*.test.js (shared/mirror-core)', executable: NODE, args: ['--test', '--test-concurrency=1', 'tests/*.test.js'], cwd: path.join(ROOT, 'shared/mirror-core') },
  { command: 'node scripts/verify-build.js (shared/mirror-core)', executable: NODE, args: ['scripts/verify-build.js'], cwd: path.join(ROOT, 'shared/mirror-core') },
  { command: 'node shared/sensorium/automation/parity-guard.js', executable: NODE, args: ['shared/sensorium/automation/parity-guard.js'] },
  { command: 'node shared/sensorium/foundation-contracts-selftest.js', executable: NODE, args: ['shared/sensorium/foundation-contracts-selftest.js'] },
  { command: 'node shared/verification-snapshot-continuity/selftest.js', executable: NODE, args: ['shared/verification-snapshot-continuity/selftest.js'] },
  { command: 'node shared/verification-source-evolution-review/selftest.js', executable: NODE, args: ['shared/verification-source-evolution-review/selftest.js'] },
  { command: 'git diff --check HEAD', executable: 'git', args: ['diff', '--check', 'HEAD'] }
];
const REQUIRED = [
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
].map(file => ({ command: 'node ' + file, executable: NODE, args: [file] }));

function assertionCount(output) {
  return Array.from(String(output || '').matchAll(/(\d+)\s+(?:assertions?|checks?|tests?)/gi))
    .reduce((sum, match) => sum + Number(match[1]), 0);
}

function execute(spec, phase) {
  const result = childProcess.spawnSync(spec.executable, spec.args, {
    cwd: spec.cwd || ROOT,
    encoding: 'utf8',
    windowsHide: true,
    timeout: 240000
  });
  const exitCode = Number.isInteger(result.status) ? result.status : 1;
  const stdout = String(result.stdout || '');
  const assertions = phase === 'FOCUSED' ? assertionCount(stdout) : 0;
  process.stdout.write((exitCode === 0 ? 'PASS ' : 'FAIL ') + spec.command + '\n');
  if (exitCode !== 0) {
    const diagnostic = String(result.stderr || stdout || result.error || '').trim().slice(-1600);
    if (diagnostic) process.stderr.write(diagnostic + '\n');
  }
  return { command: spec.command, phase, assertions, exitCode, verdict: exitCode === 0 ? 'PASS' : 'FAIL' };
}

function seal(value) {
  value.digest = null;
  const payload = JSON.parse(Core.canonicalJson(value));
  delete payload.digest;
  value.digest = 'sha256:' + crypto.createHash('sha256').update(Core.canonicalJson(payload)).digest('hex');
  return value;
}

function build() {
  const checks = [
    ...FOCUSED.map(spec => execute(spec, 'FOCUSED')),
    ...REQUIRED.map(spec => execute(spec, 'REQUIRED'))
  ];
  return seal({
    schema: 'axm.shared-runtime-json-check-results/v1',
    version: '0.1.0',
    status: 'TEST',
    checkedAt: new Date().toISOString(),
    checks,
    summary: {
      total: checks.length,
      passed: checks.filter(item => item.exitCode === 0).length,
      failed: checks.filter(item => item.exitCode !== 0).length,
      explicitAssertions: checks.reduce((sum, item) => sum + item.assertions, 0),
      focusedTotal: FOCUSED.length,
      focusedPassed: checks.filter(item => item.phase === 'FOCUSED' && item.exitCode === 0).length,
      requiredTotal: REQUIRED.length,
      requiredPassed: checks.filter(item => item.phase === 'REQUIRED' && item.exitCode === 0).length
    },
    separateEvidence: [
      { id: 'holodeck-live-browser', receipt: 'HOLODECK_VISUAL_RECEIPT.json', verdict: 'PASS' },
      { id: 'sensorium-full-suite-local-evidence-dependency', receipt: 'SENSORIUM_TEST_DEPENDENCY.json', verdict: 'PASS_WITH_UNTRACKED_LOCAL_EVIDENCE_DEPENDENCY', countedAsSelfContainedCheck: false }
    ],
    typedGaps: [
      { id: 'voluntary-phone-qa-current-contract', state: 'DEFERRED_CONTRACT_AND_EVIDENCE_GAP' },
      { id: 'sensorium-clean-checkout-full-suite', state: 'EVIDENCE_DEPENDENCY' }
    ],
    retention: {
      rawStdoutStored: false,
      rawStderrStored: false,
      failureDiagnosticPrintedOnly: true
    },
    limits: {
      fullWorkshopRepresentationClosureProved: false,
      humanReviewRun: false,
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
    digest: null
  });
}

if (require.main === module) {
  const receipt = build();
  if (process.argv.includes('--write')) fs.writeFileSync(OUTPUT, JSON.stringify(receipt, null, 2) + '\n', 'utf8');
  process.stdout.write(JSON.stringify(receipt.summary) + '\n');
  if (receipt.summary.failed) process.exitCode = 1;
}

module.exports = { ROOT, OUTPUT, FOCUSED, REQUIRED, assertionCount, build };
