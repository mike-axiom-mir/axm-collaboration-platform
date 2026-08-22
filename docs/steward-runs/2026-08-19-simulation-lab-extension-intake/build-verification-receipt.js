#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const Intake = require('../../../shared/simulation-lab-extension-intake/simulation-lab-extension-intake');

const workshop = path.resolve(__dirname, '../../..');
const outputPath = path.join(__dirname, 'VERIFICATION_RECEIPT.json');

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(workshop, relativePath), 'utf8'));
}

function digestFile(relativePath) {
  return {
    path: relativePath.replace(/\\/g, '/'),
    sha256: 'sha256:' + crypto.createHash('sha256').update(fs.readFileSync(path.join(workshop, relativePath))).digest('hex')
  };
}

function requireTruth(condition, message) {
  if (!condition) throw new Error(message);
}

function buildReceipt() {
  const hostProfile = readJson('docs/steward-runs/2026-08-19-simulation-lab-extension-intake/CURRENT_SIMULATION_LAB_HOST_PROFILE.json');
  const readiness = readJson('docs/steward-runs/2026-08-19-simulation-lab-extension-intake/CURRENT_EXTENSION_INTAKE_READINESS.json');
  const gapBefore = readJson('docs/steward-runs/2026-08-19-simulation-lab-extension-intake/CAPABILITY_GAP_BEFORE.json');
  const gapAfter = readJson('docs/steward-runs/2026-08-19-simulation-lab-extension-intake/CAPABILITY_GAP_AFTER.json');
  const broad = readJson('exports/verification-spine-report.json');

  requireTruth(Intake.verifyHostProfile(hostProfile).pass, 'current host profile no longer verifies');
  const readinessPayload = JSON.parse(JSON.stringify(readiness));
  delete readinessPayload.receiptDigest;
  requireTruth(readiness.receiptDigest === Intake.sha256(readinessPayload), 'current readiness digest mismatch');
  requireTruth(gapBefore.overall === 'BLOCKED' && gapBefore.missingCapabilities.length === 10, 'before gap result changed');
  requireTruth(gapAfter.overall === 'READY' && gapAfter.missingCapabilities.length === 0, 'after gap result changed');
  requireTruth(broad.verdict === 'VERIFIED_WITH_LIMITS', 'broad verification verdict changed');
  requireTruth(broad.failures.length === 0 && broad.holds.length === 0 && broad.invalid_receipts.length === 0 && broad.conflicts.length === 0, 'broad verification contains a failure, hold, invalid receipt or conflict');

  const sources = [
    'shared/simulation-lab-extension-intake/simulation-lab-extension-intake.js',
    'shared/simulation-lab-extension-intake/simulation-lab-host-profile.schema.json',
    'shared/simulation-lab-extension-intake/simulation-lab-extension.schema.json',
    'shared/simulation-lab-extension-intake/simulation-lab-extension-assessment.schema.json',
    'shared/simulation-lab-extension-intake/module.contract.json',
    'shared/simulation-lab-extension-intake/README.md',
    'shared/simulation-lab-extension-intake/selftest.js',
    'docs/steward-runs/2026-08-19-simulation-lab-extension-intake/build-current-extension-intake-readiness.js',
    'docs/steward-runs/2026-08-19-simulation-lab-extension-intake/build-verification-receipt.js',
    'docs/steward-runs/2026-08-19-simulation-lab-extension-intake/selftest.js',
    'docs/steward-runs/2026-08-19-simulation-lab-extension-intake/EVIDENCE_ROUTES.md',
    'docs/steward-runs/2026-08-19-simulation-lab-extension-intake/README.md',
    'docs/steward-runs/2026-08-19-simulation-lab-extension-intake/CURRENT_SIMULATION_LAB_HOST_PROFILE.json',
    'docs/steward-runs/2026-08-19-simulation-lab-extension-intake/PLATFORM_EXTENSION_EXAMPLE.json',
    'docs/steward-runs/2026-08-19-simulation-lab-extension-intake/PLATFORM_BRANCH_BUILD_BRIEF.md',
    'docs/steward-runs/2026-08-19-simulation-lab-extension-intake/CAPABILITY_REQUIREMENTS.json',
    'docs/steward-runs/2026-08-19-simulation-lab-extension-intake/CAPABILITY_INVENTORY_BEFORE.json',
    'docs/steward-runs/2026-08-19-simulation-lab-extension-intake/CAPABILITY_INVENTORY_AFTER.json',
    'docs/steward-runs/2026-08-19-simulation-lab-extension-intake/CAPABILITY_GAP_BEFORE.json',
    'docs/steward-runs/2026-08-19-simulation-lab-extension-intake/CAPABILITY_GAP_AFTER.json',
    'docs/steward-runs/2026-08-19-simulation-lab-extension-intake/CURRENT_EXTENSION_INTAKE_READINESS.json',
    'shared/portable-baseline-capsule/module.contract.json',
    'shared/baseline-simulation-lab/module.contract.json',
    'shared/grounded-growth-challenger-lab/module.contract.json',
    'tools/branch-module-return-gate/return-gate-core.js',
    'tools/branch-module-return-gate/module.contract.json',
    'exports/verification-spine-report.json'
  ].map(digestFile);

  const receipt = {
    schema: 'axm.simulation-lab-extension-intake-verification-receipt/v1',
    version: Intake.VERSION,
    generatedAt: '2026-08-19T14:00:00.000Z',
    status: 'TEST',
    focused: {
      verdict: 'PASS',
      explicitAssertions: 70,
      commands: [
        { command: 'node shared/simulation-lab-extension-intake/selftest.js', verdict: 'PASS', assertions: 35 },
        { command: 'node docs/steward-runs/2026-08-19-simulation-lab-extension-intake/selftest.js', verdict: 'PASS', assertions: 35 }
      ]
    },
    adjacent: {
      verdict: 'PASS_WITH_DECLARED_LIMITS',
      explicitAssertions: 143,
      commandLevelPasses: 1,
      commands: [
        { command: 'node tools/branch-module-return-gate/selftest.js', verdict: 'PASS', assertions: 13 },
        { command: 'node tools/branch-backfeed-lab/selftest.js', verdict: 'PASS', assertions: null },
        { command: 'node tools/module-lineage-comparator/selftest.js', verdict: 'PASS', assertions: 28 },
        { command: 'node shared/portable-baseline-capsule/selftest.js', verdict: 'PASS', assertions: 34 },
        { command: 'node shared/baseline-simulation-lab/selftest.js', verdict: 'PASS', assertions: 36 },
        { command: 'node shared/grounded-growth-challenger-lab/selftest.js', verdict: 'PASS', assertions: 32 }
      ],
      declaredLimits: [
        'Branch Module Return Gate proves structural portability only and does not execute candidate code.',
        'No Platform or other branch candidate package was received, assessed, executed or evaluated.'
      ]
    },
    capabilityComparison: {
      before: { verdict: 'BLOCKED', missingRequiredCapabilities: 10 },
      after: { verdict: 'READY', missingRequiredCapabilities: 0 },
      optionalCandidateReceipt: 'DEGRADED_NOT_RECEIVED',
      optionalCandidateRuntime: 'DEGRADED_NOT_RUN',
      optionalLiveHumanEvidence: 'DEGRADED_NOT_RUN'
    },
    currentReadiness: {
      state: readiness.state,
      protectedRoots: readiness.current.protectedRootCount,
      supportedSubjectKinds: readiness.current.supportedSubjectKindCount,
      candidatePackages: readiness.current.candidatePackageCount,
      assessments: readiness.current.assessmentCount,
      evaluationPlans: readiness.current.evaluationPlanCount,
      evaluations: readiness.current.evaluationCount,
      liveHumanOutcomes: readiness.current.liveHumanOutcomes,
      currentBestAction: readiness.currentBestAction
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
      verdict: broad.verdict,
      failures: broad.failures.length,
      holds: broad.holds.length,
      warnings: broad.warnings.length,
      invalidReceipts: broad.invalid_receipts.length,
      conflicts: broad.conflicts.length,
      receiptCount: broad.receipt_count,
      claimCount: broad.claim_count,
      namedWarnings: broad.warnings.map((warning) => warning.summary)
    },
    preservedFailures: [],
    notRun: [
      'candidate static assessment: no explicit inert candidate package was received',
      'candidate runtime and challenger evaluation: no candidate exists and no experiment was authorized',
      'browser render/click: no browser UI changed in this increment',
      'LIVE human-value session: no person opted in'
    ],
    workspaceBoundary: {
      branch: 'local-visual-fabric-20260728',
      preReceiptSnapshotEntries: 12548,
      preReceiptTrackedRows: 3603,
      preReceiptUntrackedRows: 8945,
      additiveLaneRowsBeforeReceipt: 20,
      sharedSeamsTouchedByThisIncrement: 0,
      activeSharedSeamsObserved: 4
    },
    sources,
    truth: {
      hostProfileVerifiedNatively: true,
      candidatePackageVerified: false,
      candidateAssessed: false,
      candidateCodeExecuted: false,
      candidateRuntimeVerified: false,
      extensionIntakeContractVerified: true,
      distinctAdapterIdentityRequired: true,
      invariantTruthRulesPreserved: true,
      unsupportedFieldsDigestBound: true,
      evaluationRequirementsRemainNotRunUntilCandidate: true,
      canonicalStateTouched: false,
      humanBenefitClaimed: false,
      sharedGrowthClaimed: false,
      broadLearningClaimed: false,
      generalizationClaimed: false,
      modelWeightTrainingClaimed: false,
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
  receipt.receiptDigest = Intake.sha256(payload);
  return receipt;
}

const expected = buildReceipt();
if (process.argv.includes('--check-recorded')) {
  const recorded = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
  if (Intake.stableStringify(recorded) !== Intake.stableStringify(expected)) {
    throw new Error('recorded verification receipt differs from current exact sources');
  }
  console.log('PASS exact extension-intake verification receipt (70 focused, 143 adjacent assertions + 1 command check, 10 required)');
} else {
  fs.writeFileSync(outputPath, JSON.stringify(expected, null, 2) + '\n');
  console.log('PASS wrote exact extension-intake verification receipt');
}
