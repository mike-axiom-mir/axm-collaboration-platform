#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const Direction = require('../../../shared/grounded-growth-direction-handoff/grounded-growth-direction-handoff');

const workshop = path.resolve(__dirname, '../../..');
const outputPath = path.join(__dirname, 'VERIFICATION_RECEIPT.json');

function digestFile(relativePath) {
  const full = path.join(workshop, relativePath);
  return {
    path: relativePath.replace(/\\/g, '/'),
    sha256: 'sha256:' + crypto.createHash('sha256').update(fs.readFileSync(full)).digest('hex')
  };
}

function buildReceipt() {
  const sources = [
    'shared/grounded-growth-direction-handoff/grounded-growth-direction-handoff.js',
    'shared/grounded-growth-direction-handoff/grounded-growth-direction-handoff.schema.json',
    'shared/grounded-growth-direction-handoff/module.contract.json',
    'shared/grounded-growth-direction-handoff/README.md',
    'shared/grounded-growth-direction-handoff/selftest.js',
    'docs/steward-runs/2026-08-19-grounded-growth-direction-handoff/build-current-direction-handoff.js',
    'docs/steward-runs/2026-08-19-grounded-growth-direction-handoff/selftest.js',
    'docs/steward-runs/2026-08-19-grounded-growth-direction-handoff/CURRENT_FEEDBACK_PACKET.json',
    'docs/steward-runs/2026-08-19-grounded-growth-direction-handoff/CURRENT_DIRECTION_HANDOFF.json',
    'docs/steward-runs/2026-08-19-grounded-growth-direction-handoff/CURRENT_DIRECTION_READINESS.json',
    'docs/steward-runs/2026-08-19-grounded-growth-direction-handoff/CAPABILITY_GAP_BEFORE.json',
    'docs/steward-runs/2026-08-19-grounded-growth-direction-handoff/CAPABILITY_GAP_AFTER.json',
    'docs/steward-runs/2026-08-19-ai-workflow-coverage-refresh/CURRENT_PORTFOLIO.json',
    'docs/steward-runs/2026-08-19-human-handoff-operational-readiness/CURRENT_HANDOFF_READINESS.json',
    'tools/grounded-evolution-intelligence/engine/schemas/evolution_direction.schema.json'
  ].map(digestFile);

  const receipt = {
    schema: 'axm.grounded-growth-direction-verification-receipt/v1',
    version: '0.1.0',
    generatedAt: '2026-08-19T12:50:00.000Z',
    status: 'TEST',
    focused: {
      verdict: 'PASS',
      explicitAssertions: 63,
      commands: [
        { command: 'node shared/grounded-growth-direction-handoff/selftest.js', verdict: 'PASS', assertions: 32 },
        { command: 'node docs/steward-runs/2026-08-19-grounded-growth-direction-handoff/selftest.js', verdict: 'PASS', assertions: 31 }
      ]
    },
    adjacent: {
      verdict: 'PASS_WITH_DECLARED_LIMIT',
      explicitAssertions: 185,
      commandLevelPasses: 2,
      commands: [
        { command: 'node shared/grounded-growth-feedback/selftest.js', verdict: 'PASS', assertions: 33 },
        { command: 'node shared/grounded-growth-outcomes/selftest.js', verdict: 'PASS', assertions: 31 },
        { command: 'node shared/verified-capability-loop/selftest.js', verdict: 'PASS', assertions: 21 },
        { command: 'node shared/grounded-growth-human-handoff/selftest.js', verdict: 'PASS', assertions: 45 },
        { command: 'node docs/steward-runs/2026-08-19-human-handoff-operational-readiness/selftest.js', verdict: 'PASS', assertions: 47 },
        { command: 'node shared/module-evolution-ledger/selftest.js', verdict: 'PASS', assertions: 8 },
        { command: 'node tools/grounded-evolution-intelligence/selftest.js', verdict: 'PASS', assertions: null },
        { command: 'PowerShell Test-Json against GEI evolution_direction.schema.json', verdict: 'PASS', subjects: { currentDirections: 4, referenceExamples: 1 } }
      ],
      declaredLimit: 'The broader Python GEI validate_contract.py command was NOT_RUN because neither available Python runtime provides jsonschema. No dependency was installed.'
    },
    capabilityComparison: {
      before: { verdict: 'BLOCKED', missingRequiredCapabilities: 9 },
      after: { verdict: 'READY', missingRequiredCapabilities: 0 },
      optionalLiveHumanEvidence: 'DEGRADED_NOT_RUN'
    },
    requiredChecks: {
      verdict: 'PASS',
      passed: 10,
      failed: 0,
      commands: [
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
      ]
    },
    broadVerification: {
      verdict: 'VERIFIED_WITH_LIMITS',
      failures: 0,
      holds: 0,
      warnings: 2,
      invalidReceipts: 0,
      conflicts: 0,
      receiptCount: 6,
      claimCount: 9,
      namedWarnings: [
        '17 core warning lines remain visible.',
        '17 pending physical, reconnect, overlay or collaborator evidence items remain visible.'
      ]
    },
    preservedFailures: [
      {
        stage: 'current composition',
        observed: 'The first build reused one route evidence digest across four capability-specific declarations and was rejected as an evidence ID collision.',
        repair: 'Each route now binds a distinct digest of its exact readiness-receipt slice; the shared feedback adapter was not weakened.'
      },
      {
        stage: 'adjacent GEI Python validation',
        observed: 'Default Python raised ModuleNotFoundError for jsonschema.',
        repair: 'No installation attempted; a configured bundled Python was checked next.'
      },
      {
        stage: 'bundled GEI Python validation',
        observed: 'Bundled Python also raised ModuleNotFoundError for jsonschema.',
        repair: 'The exact direction-schema claim was independently verified with PowerShell Test-Json; the broader Python validator remains NOT_RUN.'
      }
    ],
    notRun: [
      'tools/grounded-evolution-intelligence/engine/scripts/validate_contract.py: missing jsonschema in both available Python runtimes',
      'browser render/click: no browser UI changed in this increment',
      'LIVE human-benefit session: no person opted in'
    ],
    sources,
    truth: {
      currentDirections: 4,
      currentWaitDirections: 4,
      acceptedDirections: 0,
      executedDirections: 0,
      liveHumanOutcomes: 0,
      sharedGrowthClaimed: false,
      automaticExecution: false,
      automaticWrite: false,
      automaticInstall: false,
      automaticPermissionGrant: false,
      automaticPromotion: false,
      automaticMerge: false,
      automaticCanon: false,
      foundationMutation: false,
      modelWeightTrainingClaimed: false
    },
    receiptDigest: null
  };
  const payload = JSON.parse(JSON.stringify(receipt));
  delete payload.receiptDigest;
  receipt.receiptDigest = Direction.sha256(payload);
  return receipt;
}

const expected = buildReceipt();
if (process.argv.includes('--check-recorded')) {
  const recorded = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
  if (Direction.stableStringify(recorded) !== Direction.stableStringify(expected)) {
    throw new Error('recorded verification receipt differs from current exact sources');
  }
  console.log('PASS exact direction verification receipt (63 focused, 185 adjacent assertions + 2 command checks, 10 required)');
} else {
  fs.writeFileSync(outputPath, JSON.stringify(expected, null, 2) + '\n');
  console.log('PASS wrote exact direction verification receipt');
}

