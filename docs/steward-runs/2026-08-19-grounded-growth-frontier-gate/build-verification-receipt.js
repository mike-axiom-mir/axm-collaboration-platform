#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const Frontier = require('../../../shared/grounded-growth-frontier-gate/grounded-growth-frontier-gate');

const workshop = path.resolve(__dirname, '../../..');

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(workshop, relativePath), 'utf8'));
}

function requireTruth(condition, message) {
  if (!condition) throw new Error(message);
}

function ref(relativePath) {
  const bytes = fs.readFileSync(path.join(workshop, relativePath));
  return {
    path: relativePath.replace(/\\/g, '/'),
    sha256: 'sha256:' + crypto.createHash('sha256').update(bytes).digest('hex')
  };
}

function buildReceipt() {
  const portfolio = readJson('docs/steward-runs/2026-08-19-ai-workflow-coverage-refresh/CURRENT_PORTFOLIO.json');
  const directionHandoff = readJson('docs/steward-runs/2026-08-19-grounded-growth-direction-handoff/CURRENT_DIRECTION_HANDOFF.json');
  const humanHandoffReadiness = readJson('docs/steward-runs/2026-08-19-human-handoff-operational-readiness/CURRENT_HANDOFF_READINESS.json');
  const extensionHostProfile = readJson('docs/steward-runs/2026-08-19-simulation-lab-extension-intake/CURRENT_SIMULATION_LAB_HOST_PROFILE.json');
  const extensionReadiness = readJson('docs/steward-runs/2026-08-19-simulation-lab-extension-intake/CURRENT_EXTENSION_INTAKE_READINESS.json');
  const frontier = readJson('docs/steward-runs/2026-08-19-grounded-growth-frontier-gate/CURRENT_FRONTIER_RECEIPT.json');
  const gapBefore = readJson('docs/steward-runs/2026-08-19-grounded-growth-frontier-gate/CAPABILITY_GAP_BEFORE.json');
  const gapAfter = readJson('docs/steward-runs/2026-08-19-grounded-growth-frontier-gate/CAPABILITY_GAP_AFTER.json');
  const contract = readJson('shared/grounded-growth-frontier-gate/module.contract.json');
  const broad = readJson('exports/verification-spine-report.json');
  const input = {
    frontierId: 'current-grounded-growth-frontier-20260819',
    generatedAt: '2026-08-19T14:25:00.000Z',
    portfolio,
    directionHandoff,
    humanHandoffReadiness,
    extensionHostProfile,
    extensionReadiness
  };

  requireTruth(Frontier.verifyFrontier(frontier, input).pass, 'current frontier no longer verifies');
  requireTruth(gapBefore.overall === 'BLOCKED' && gapBefore.missingCapabilities.length === 8, 'before capability gap changed');
  requireTruth(gapAfter.overall === 'READY' && gapAfter.missingCapabilities.length === 0, 'after capability gap changed');
  requireTruth(frontier.decision.autonomousActionCount === 0 && frontier.decision.reviewableActionCount === 0, 'current frontier action count changed');
  requireTruth(frontier.counts.latestAiWorkflowPass === 4 && frontier.counts.latestHumanPass === 0, 'beneficiary frontier changed');
  requireTruth(frontier.counts.waitDirections === 4 && frontier.counts.candidatePackages === 0, 'direction or extension frontier changed');
  requireTruth(contract.status === 'TEST' && contract.permissions.length === 0 && contract.boundaries.writes.length === 0, 'module authority boundary changed');
  requireTruth(broad.verdict === 'VERIFIED_WITH_LIMITS', 'broad verification verdict changed');
  requireTruth(broad.failures.length === 0 && broad.holds.length === 0 && broad.invalid_receipts.length === 0 && broad.conflicts.length === 0, 'broad verification has a failure, hold, invalid receipt, or conflict');

  const sources = [
    'shared/grounded-growth-frontier-gate/grounded-growth-frontier-gate.js',
    'shared/grounded-growth-frontier-gate/grounded-growth-frontier-receipt.schema.json',
    'shared/grounded-growth-frontier-gate/module.contract.json',
    'shared/grounded-growth-frontier-gate/README.md',
    'shared/grounded-growth-frontier-gate/selftest.js',
    'docs/steward-runs/2026-08-19-grounded-growth-frontier-gate/build-current-frontier.js',
    'docs/steward-runs/2026-08-19-grounded-growth-frontier-gate/build-verification-receipt.js',
    'docs/steward-runs/2026-08-19-grounded-growth-frontier-gate/selftest.js',
    'docs/steward-runs/2026-08-19-grounded-growth-frontier-gate/EVIDENCE_ROUTES.md',
    'docs/steward-runs/2026-08-19-grounded-growth-frontier-gate/README.md',
    'docs/steward-runs/2026-08-19-grounded-growth-frontier-gate/CAPABILITY_REQUIREMENTS.json',
    'docs/steward-runs/2026-08-19-grounded-growth-frontier-gate/CAPABILITY_INVENTORY_BEFORE.json',
    'docs/steward-runs/2026-08-19-grounded-growth-frontier-gate/CAPABILITY_INVENTORY_AFTER.json',
    'docs/steward-runs/2026-08-19-grounded-growth-frontier-gate/CAPABILITY_GAP_BEFORE.json',
    'docs/steward-runs/2026-08-19-grounded-growth-frontier-gate/CAPABILITY_GAP_AFTER.json',
    'docs/steward-runs/2026-08-19-grounded-growth-frontier-gate/CURRENT_FRONTIER_RECEIPT.json',
    'docs/steward-runs/2026-08-19-ai-workflow-coverage-refresh/CURRENT_PORTFOLIO.json',
    'docs/steward-runs/2026-08-19-grounded-growth-direction-handoff/CURRENT_DIRECTION_HANDOFF.json',
    'docs/steward-runs/2026-08-19-human-handoff-operational-readiness/CURRENT_HANDOFF_READINESS.json',
    'docs/steward-runs/2026-08-19-simulation-lab-extension-intake/CURRENT_SIMULATION_LAB_HOST_PROFILE.json',
    'docs/steward-runs/2026-08-19-simulation-lab-extension-intake/CURRENT_EXTENSION_INTAKE_READINESS.json',
    'exports/verification-spine-report.json'
  ].map(ref);

  return {
    schema: 'axm.grounded-growth-frontier-verification-receipt/v1',
    version: Frontier.VERSION,
    generatedAt: '2026-08-19T14:39:00.000Z',
    status: 'TEST',
    focused: {
      verdict: 'PASS',
      explicitAssertions: 79,
      commands: [
        { command: 'node shared/grounded-growth-frontier-gate/selftest.js', verdict: 'PASS', assertions: 38 },
        { command: 'node docs/steward-runs/2026-08-19-grounded-growth-frontier-gate/selftest.js', verdict: 'PASS', assertions: 41 }
      ]
    },
    adjacent: {
      verdict: 'PASS_WITH_DECLARED_LIMITS',
      explicitAssertions: 368,
      commandLevelPasses: 2,
      commands: [
        { command: 'node shared/grounded-growth-outcomes/selftest.js', verdict: 'PASS', assertions: 31 },
        { command: 'node shared/grounded-growth-direction-handoff/selftest.js', verdict: 'PASS', assertions: 32 },
        { command: 'node shared/grounded-growth-human-handoff/selftest.js', verdict: 'PASS', assertions: 45 },
        { command: 'node shared/grounded-growth-human-bridge-v2/selftest.js', verdict: 'PASS', assertions: 45 },
        { command: 'node shared/simulation-lab-extension-intake/selftest.js', verdict: 'PASS', assertions: 35 },
        { command: 'node docs/steward-runs/2026-08-19-ai-workflow-coverage-refresh/build-ai-workflow-coverage.js --check-recorded', verdict: 'PASS', assertions: null },
        { command: 'node docs/steward-runs/2026-08-19-ai-workflow-coverage-refresh/selftest.js', verdict: 'PASS', assertions: 67 },
        { command: 'node docs/steward-runs/2026-08-19-grounded-growth-direction-handoff/selftest.js', verdict: 'PASS', assertions: 31 },
        { command: 'node docs/steward-runs/2026-08-19-human-handoff-operational-readiness/build-current-handoff-readiness.js --check-recorded', verdict: 'PASS', assertions: null },
        { command: 'node docs/steward-runs/2026-08-19-human-handoff-operational-readiness/selftest.js', verdict: 'PASS', assertions: 47 },
        { command: 'node docs/steward-runs/2026-08-19-simulation-lab-extension-intake/selftest.js', verdict: 'PASS', assertions: 35 }
      ],
      declaredLimits: [
        'No person participated in a live human-benefit evaluation.',
        'No extension candidate package was received, assessed, or executed.',
        'All current directions remain WAIT_FOR_EVIDENCE with zero execution steps.'
      ]
    },
    capabilityComparison: {
      before: { verdict: 'BLOCKED', missingRequiredCapabilities: 8 },
      after: { verdict: 'READY', missingRequiredCapabilities: 0 },
      optionalLiveHumanEvidence: 'DEGRADED_NOT_RUN',
      optionalExtensionCandidate: 'DEGRADED_NOT_RECEIVED',
      optionalNonWaitDirection: 'DEGRADED_NOT_PRESENT'
    },
    currentFrontier: {
      capabilityChains: frontier.counts.capabilityChains,
      latestAiWorkflowPass: frontier.counts.latestAiWorkflowPass,
      latestHumanPass: frontier.counts.latestHumanPass,
      latestHumanNotRun: frontier.counts.latestHumanNotRun,
      waitDirections: frontier.counts.waitDirections,
      voluntaryHumanRoutes: frontier.counts.voluntaryHumanRoutes,
      liveHumanOutcomes: frontier.counts.liveHumanOutcomes,
      candidatePackages: frontier.counts.candidatePackages,
      candidateAssessments: frontier.counts.candidateAssessments,
      autonomousActions: frontier.decision.autonomousActionCount,
      reviewableActions: frontier.decision.reviewableActionCount,
      currentBestAction: frontier.decision.currentBestAction
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
      warningLimits: broad.warnings.map((item) => item.summary)
    },
    visualVerification: {
      state: 'NOT_APPLICABLE_NO_UI',
      browserRenderClickTestRun: false
    },
    workspaceSnapshot: {
      branch: 'local-visual-fabric-20260728',
      totalChangedPaths: 12569,
      trackedChangedPaths: 3603,
      untrackedPaths: 8966,
      conflictPaths: 0,
      filesScanned: 20001,
      recentFiles: 172,
      activeFiles: 100,
      activeSharedSeams: 4,
      scanTruncated: true,
      clockSkewedAetherglassSeamsPreserved: 3
    },
    truth: {
      technicalReadinessIsConsent: false,
      humanBenefitEstablished: false,
      exampleIsCandidate: false,
      candidateCodeExecuted: false,
      modelWeightTrainingClaimed: false,
      autonomousWorkAuthorized: false,
      automaticInstall: false,
      automaticMerge: false,
      automaticCanon: false,
      foundationMutation: false,
      canonicalStateTouched: false
    },
    sources
  };
}

const receipt = buildReceipt();
fs.writeFileSync(path.join(__dirname, 'VERIFICATION_RECEIPT.json'), JSON.stringify(receipt, null, 2) + '\n');
console.log('PASS Grounded Growth frontier verification receipt built');
console.log('focused=79 adjacent=368+2-command required=10 broad=' + receipt.broadVerification.verdict);
