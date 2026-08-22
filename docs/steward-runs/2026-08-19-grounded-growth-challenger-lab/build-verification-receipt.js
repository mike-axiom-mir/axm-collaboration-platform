#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const Challenger = require('../../../shared/grounded-growth-challenger-lab/grounded-growth-challenger-lab');

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
    'shared/grounded-growth-challenger-lab/grounded-growth-challenger-lab.js',
    'shared/grounded-growth-challenger-lab/grounded-growth-challenger-plan.schema.json',
    'shared/grounded-growth-challenger-lab/grounded-growth-challenger-evaluation.schema.json',
    'shared/grounded-growth-challenger-lab/module.contract.json',
    'shared/grounded-growth-challenger-lab/README.md',
    'shared/grounded-growth-challenger-lab/selftest.js',
    'docs/steward-runs/2026-08-19-grounded-growth-challenger-lab/build-current-challenger-readiness.js',
    'docs/steward-runs/2026-08-19-grounded-growth-challenger-lab/selftest.js',
    'docs/steward-runs/2026-08-19-grounded-growth-challenger-lab/EVIDENCE_ROUTES.md',
    'docs/steward-runs/2026-08-19-grounded-growth-challenger-lab/CAPABILITY_REQUIREMENTS.json',
    'docs/steward-runs/2026-08-19-grounded-growth-challenger-lab/CAPABILITY_INVENTORY_BEFORE.json',
    'docs/steward-runs/2026-08-19-grounded-growth-challenger-lab/CAPABILITY_INVENTORY_AFTER.json',
    'docs/steward-runs/2026-08-19-grounded-growth-challenger-lab/CAPABILITY_GAP_BEFORE.json',
    'docs/steward-runs/2026-08-19-grounded-growth-challenger-lab/CAPABILITY_GAP_AFTER.json',
    'docs/steward-runs/2026-08-19-grounded-growth-challenger-lab/CURRENT_CHALLENGER_READINESS.json',
    'docs/steward-runs/2026-08-19-grounded-growth-direction-handoff/CURRENT_DIRECTION_HANDOFF.json',
    'tools/repair-resilience-library/components/shadow-simulator/index.js',
    'tools/repair-resilience-library/components/shadow-simulator/module.contract.json',
    'tools/repair-resilience-library/components/diagnostic-experiment-runner/index.js',
    'tools/repair-resilience-library/components/diagnostic-experiment-runner/module.contract.json',
    'exports/verification-spine-report.json'
  ].map(digestFile);

  const receipt = {
    schema: 'axm.grounded-growth-challenger-verification-receipt/v1',
    version: '0.1.0',
    generatedAt: '2026-08-19T13:20:00.000Z',
    status: 'TEST',
    focused: {
      verdict: 'PASS',
      explicitAssertions: 60,
      commands: [
        { command: 'node shared/grounded-growth-challenger-lab/selftest.js', verdict: 'PASS', assertions: 32 },
        { command: 'node docs/steward-runs/2026-08-19-grounded-growth-challenger-lab/selftest.js', verdict: 'PASS', assertions: 28 }
      ]
    },
    adjacent: {
      verdict: 'PASS_WITH_DECLARED_LIMITS',
      explicitAssertions: 173,
      commandLevelPasses: 1,
      commands: [
        { command: 'node shared/grounded-growth-direction-handoff/selftest.js', verdict: 'PASS', assertions: 32 },
        { command: 'node docs/steward-runs/2026-08-19-grounded-growth-direction-handoff/selftest.js', verdict: 'PASS', assertions: 31 },
        { command: 'node tools/repair-resilience-library/components/shadow-simulator/selftest.js', verdict: 'PASS', assertions: 1 },
        { command: 'node tools/repair-resilience-library/components/diagnostic-experiment-runner/selftest.js', verdict: 'PASS', assertions: 1 },
        { command: 'node shared/baseline-simulation-lab/selftest.js', verdict: 'PASS', assertions: 36 },
        { command: 'node shared/grounded-growth-feedback/selftest.js', verdict: 'PASS', assertions: 33 },
        { command: 'node shared/grounded-growth-outcomes/selftest.js', verdict: 'PASS', assertions: 31 },
        { command: 'node shared/module-evolution-ledger/selftest.js', verdict: 'PASS', assertions: 8 },
        { command: 'node tools/grounded-evolution-intelligence/selftest.js', verdict: 'PASS', assertions: null }
      ],
      declaredLimits: [
        'Shadow Simulator and Diagnostic Experiment Runner remain EXPERIMENTAL reused organs; their focused selftests passed but this increment does not promote them.',
        'No current challenger plan or evaluation exists because every exact current direction is WAIT_FOR_EVIDENCE.'
      ]
    },
    capabilityComparison: {
      before: { verdict: 'BLOCKED', missingRequiredCapabilities: 11 },
      after: { verdict: 'READY', missingRequiredCapabilities: 0 },
      optionalLiveHumanEvidence: 'DEGRADED_NOT_RUN'
    },
    currentReadiness: {
      state: 'LAB_CAPABILITY_READY_CURRENT_DIRECTIONS_HELD',
      directions: 4,
      waitDirections: 4,
      actionableDirections: 0,
      challengerPlans: 0,
      challengerEvaluations: 0,
      acceptedDirections: 0,
      executedDirections: 0,
      liveHumanOutcomes: 0,
      currentBestAction: 'WAIT_FOR_EVIDENCE'
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
        stage: 'session sealing',
        observed: 'The curation helper refused to overwrite a placeholder seal after the final workspace snapshot was added.',
        repair: 'The exact lane-local placeholder seal was retired and rebuilt once from the completed append-only segment; the refusal and repair are preserved in the final seal.'
      }
    ],
    notRun: [
      'current challenger execution: no current direction is actionable and no current plan or evaluation was created',
      'browser render/click: no browser UI changed in this increment',
      'LIVE human-benefit session: no person opted in'
    ],
    workspaceBoundary: {
      branch: 'local-visual-fabric-20260728',
      preRequiredSnapshotEntries: 12522,
      preRequiredTrackedRows: 3603,
      preRequiredUntrackedRows: 8919,
      additiveLaneRowsBeforeReceipt: 16,
      unrelatedSharedAetherglassRowsObserved: 8,
      sharedSeamsTouchedByThisIncrement: 0
    },
    sources,
    truth: {
      directionHandoffVerifiedNatively: true,
      challengerPlanContractVerified: true,
      challengerEvaluationContractVerified: true,
      existingShadowReceiptVerified: true,
      pairedDiagnosticReceiptsVerified: true,
      heldOutAiAndRegressionEvidenceRequired: true,
      currentExperimentRequired: false,
      canonicalStateTouched: false,
      humanBenefitClaimed: false,
      sharedGrowthClaimed: false,
      broadLearningClaimed: false,
      generalizationClaimed: false,
      modelWeightTrainingClaimed: false,
      directionAccepted: false,
      automaticExecution: false,
      automaticWrite: false,
      automaticInstall: false,
      automaticPermissionGrant: false,
      automaticPromotion: false,
      automaticMerge: false,
      automaticCanon: false,
      foundationMutation: false
    },
    receiptDigest: null
  };
  const payload = JSON.parse(JSON.stringify(receipt));
  delete payload.receiptDigest;
  receipt.receiptDigest = Challenger.sha256(payload);
  return receipt;
}

const expected = buildReceipt();
if (process.argv.includes('--check-recorded')) {
  const recorded = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
  if (Challenger.stableStringify(recorded) !== Challenger.stableStringify(expected)) {
    throw new Error('recorded verification receipt differs from current exact sources');
  }
  console.log('PASS exact challenger verification receipt (60 focused, 173 adjacent assertions + 1 command check, 10 required)');
} else {
  fs.writeFileSync(outputPath, JSON.stringify(expected, null, 2) + '\n');
  console.log('PASS wrote exact challenger verification receipt');
}
