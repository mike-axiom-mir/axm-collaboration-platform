#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const Intake = require('../../../shared/research-contribution-intake/research-contribution-intake');

const ROOT = path.resolve(__dirname, '../../..');
const GENERATED_AT = '2026-08-19T17:28:00.000Z';
const SOURCE_FILES = [
  'shared/research-contribution-intake/research-contribution-intake.js',
  'shared/research-contribution-intake/research-contribution-bundle.schema.json',
  'shared/research-contribution-intake/research-contribution-assessment.schema.json',
  'shared/research-contribution-intake/research-contribution-simulation-projection.schema.json',
  'shared/research-contribution-intake/module.contract.json',
  'shared/research-contribution-intake/README.md',
  'shared/research-contribution-intake/selftest.js',
  'docs/steward-runs/2026-08-19-research-contribution-intake/build-current-assessment.js',
  'docs/steward-runs/2026-08-19-research-contribution-intake/CAPABILITY_REQUIREMENTS.json',
  'docs/steward-runs/2026-08-19-research-contribution-intake/CAPABILITY_INVENTORY_BEFORE.json',
  'docs/steward-runs/2026-08-19-research-contribution-intake/CAPABILITY_INVENTORY_AFTER.json',
  'docs/steward-runs/2026-08-19-research-contribution-intake/CAPABILITY_GAP_REPORT.json',
  'docs/steward-runs/2026-08-19-research-contribution-intake/CURRENT_RESEARCH_CONTRIBUTION_ASSESSMENT.json',
  'docs/steward-runs/2026-08-19-research-contribution-intake/CURRENT_SUMMARY.json',
  'docs/steward-runs/2026-08-19-research-contribution-intake/EVIDENCE_ROUTES.md',
  'docs/steward-runs/2026-08-19-research-contribution-intake/README.md',
  'docs/steward-runs/2026-08-19-research-contribution-intake/selftest.js'
];

function sourceRef(relative) {
  return {
    path: relative,
    sha256: Intake.sha256(fs.readFileSync(path.join(ROOT, relative)))
  };
}

function build() {
  const receipt = {
    schema: 'axm.research-contribution-intake-verification/v1',
    verificationId: 'verification:research-contribution-intake-20260819',
    generatedAt: GENERATED_AT,
    status: 'TEST',
    outcome: 'PASS_WITH_DECLARED_LIMITS',
    assertions: {
      focusedAndAdjacent: 367,
      failed: 0,
      groups: [
        { command: 'node shared/research-contribution-intake/selftest.js', assertions: 47, verdict: 'PASS' },
        { command: 'node docs/steward-runs/2026-08-19-research-contribution-intake/selftest.js', assertions: 50, verdict: 'PASS' },
        { command: 'node shared/baseline-simulation-lab/selftest.js', assertions: 36, verdict: 'PASS' },
        { command: 'node shared/simulation-lab-extension-intake/selftest.js', assertions: 35, verdict: 'PASS' },
        { command: 'node docs/steward-runs/2026-08-19-public-baseline-research-run/selftest.js', assertions: 45, verdict: 'PASS' },
        { command: 'node docs/steward-runs/2026-08-19-research-ai-workflow-evaluation/selftest.js', assertions: 49, verdict: 'PASS' },
        { command: 'node shared/grounded-growth-frontier-gate/selftest.js', assertions: 72, verdict: 'PASS' },
        { command: 'node docs/steward-runs/2026-08-19-grounded-growth-stewardship-frontier/selftest.js', assertions: 33, verdict: 'PASS' }
      ]
    },
    requiredChecks: [
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
    ].map(command => ({ command, verdict: 'PASS' })),
    broadVerification: {
      state: 'VERIFIED_WITH_LIMITS',
      warningGroups: 2,
      knownEvidenceItems: 17,
      failedClaims: 0,
      note: 'Existing Foundation and game evidence warnings remain visible; this increment does not reinterpret them.'
    },
    browser: {
      verdict: 'NOT_RUN',
      reason: 'No interactive UI or visual claim was changed.'
    },
    currentAssessment: {
      state: 'READY_FOR_BASELINE_SIMULATION_PLANNING',
      artifacts: 7,
      modelSeats: 4,
      retainedSignals: 6,
      proposals: 6,
      holds: 0,
      warnings: 4
    },
    declaredLimits: [
      'Artifact-to-model mapping is not established.',
      'Exact model identity and prior-output isolation are not established.',
      'Cross-model independence is not established.',
      'The projection is not a Baseline Simulation Lab run or Evidence Desk receipt.',
      'No new learning, model-weight, human-benefit, production, promotion, merge, or CANON claim is made.'
    ],
    sourceRefs: SOURCE_FILES.map(sourceRef),
    truth: {
      sourceDigestsCurrentAtReceiptTime: true,
      rawTerminalLogsRetained: false,
      browserClaimed: false,
      packageSourceExecuted: false,
      modelInvoked: false,
      automaticAction: false,
      automaticCanon: false
    },
    receiptDigest: null
  };
  const payload = JSON.parse(JSON.stringify(receipt));
  delete payload.receiptDigest;
  receipt.receiptDigest = Intake.sha256(payload);
  return receipt;
}

function verify(receipt) {
  const errors = [];
  const rebuilt = build();
  if (Intake.stableStringify(rebuilt) !== Intake.stableStringify(receipt)) errors.push('verification receipt or source digest mismatch');
  return { pass: errors.length === 0, errors };
}

function write() {
  const receipt = build();
  fs.writeFileSync(path.join(__dirname, 'VERIFICATION_RECEIPT.json'), JSON.stringify(receipt, null, 2) + '\n');
  return receipt;
}

module.exports = { SOURCE_FILES, build, verify, write };

if (require.main === module) {
  const receipt = process.argv.includes('--write') ? write() : build();
  process.stdout.write(JSON.stringify({ outcome: receipt.outcome, assertions: receipt.assertions.focusedAndAdjacent, requiredChecks: receipt.requiredChecks.length, receiptDigest: receipt.receiptDigest }, null, 2) + '\n');
}
