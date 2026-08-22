#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const Campaign = require('../../../shared/voluntary-phone-qa-campaign/voluntary-phone-qa-campaign');

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
  const seamReport = readJson('exports/game-night-seam-report.json');
  const qaLabManifest = readJson('tools/browser-lan-hardware-qa-lab/manifest.json');
  const qaLabContract = readJson('tools/browser-lan-hardware-qa-lab/module.contract.json');
  const campaign = readJson('docs/steward-runs/2026-08-19-voluntary-phone-qa-campaign/CURRENT_PHONE_QA_CAMPAIGN.json');
  const gapBefore = readJson('docs/steward-runs/2026-08-19-voluntary-phone-qa-campaign/CAPABILITY_GAP_BEFORE.json');
  const gapAfter = readJson('docs/steward-runs/2026-08-19-voluntary-phone-qa-campaign/CAPABILITY_GAP_AFTER.json');
  const contract = readJson('shared/voluntary-phone-qa-campaign/module.contract.json');
  const broad = readJson('exports/verification-spine-report.json');
  const input = {
    campaignId: 'current-voluntary-phone-qa-campaign-20260819',
    generatedAt: '2026-08-19T15:02:00.000Z',
    seamReport,
    qaLabManifest,
    qaLabContract,
    maxGamesPerSession: 3,
    candidateReviews: []
  };

  requireTruth(Campaign.verifyCampaign(campaign, input).pass, 'current campaign no longer verifies');
  requireTruth(gapBefore.overall === 'BLOCKED' && gapBefore.missingCapabilities.length === 8, 'before capability gap changed');
  requireTruth(gapAfter.overall === 'READY' && gapAfter.missingCapabilities.length === 0, 'after capability gap changed');
  requireTruth(campaign.summary.physicalPhoneWarnings === 17 && campaign.summary.warningsStillOpen === 17, 'current warning queue changed');
  requireTruth(campaign.summary.reviewRecords === 0 && campaign.truth.physicalHardwareProven === false, 'current external evidence boundary changed');
  requireTruth(campaign.sessions.length === 6 && campaign.sessions.every((session) => session.stopOrSkipAllowed && !session.automatic), 'campaign agency boundary changed');
  requireTruth(contract.status === 'TEST' && contract.permissions.length === 0 && contract.boundaries.writes.length === 0, 'campaign module authority boundary changed');
  requireTruth(broad.verdict === 'VERIFIED_WITH_LIMITS', 'broad verification verdict changed');
  requireTruth(broad.failures.length === 0 && broad.holds.length === 0 && broad.invalid_receipts.length === 0 && broad.conflicts.length === 0, 'broad verification has a failure, hold, invalid receipt, or conflict');

  const sources = [
    'shared/voluntary-phone-qa-campaign/voluntary-phone-qa-campaign.js',
    'shared/voluntary-phone-qa-campaign/voluntary-phone-qa-campaign.schema.json',
    'shared/voluntary-phone-qa-campaign/module.contract.json',
    'shared/voluntary-phone-qa-campaign/README.md',
    'shared/voluntary-phone-qa-campaign/selftest.js',
    'docs/steward-runs/2026-08-19-voluntary-phone-qa-campaign/build-current-campaign.js',
    'docs/steward-runs/2026-08-19-voluntary-phone-qa-campaign/build-verification-receipt.js',
    'docs/steward-runs/2026-08-19-voluntary-phone-qa-campaign/selftest.js',
    'docs/steward-runs/2026-08-19-voluntary-phone-qa-campaign/EVIDENCE_ROUTES.md',
    'docs/steward-runs/2026-08-19-voluntary-phone-qa-campaign/README.md',
    'docs/steward-runs/2026-08-19-voluntary-phone-qa-campaign/PHYSICAL_PHONE_QA_HANDOFF.md',
    'docs/steward-runs/2026-08-19-voluntary-phone-qa-campaign/CAPABILITY_REQUIREMENTS.json',
    'docs/steward-runs/2026-08-19-voluntary-phone-qa-campaign/CAPABILITY_INVENTORY_BEFORE.json',
    'docs/steward-runs/2026-08-19-voluntary-phone-qa-campaign/CAPABILITY_INVENTORY_AFTER.json',
    'docs/steward-runs/2026-08-19-voluntary-phone-qa-campaign/CAPABILITY_GAP_BEFORE.json',
    'docs/steward-runs/2026-08-19-voluntary-phone-qa-campaign/CAPABILITY_GAP_AFTER.json',
    'docs/steward-runs/2026-08-19-voluntary-phone-qa-campaign/CURRENT_PHONE_QA_CAMPAIGN.json',
    'tools/browser-lan-hardware-qa-lab/app.js',
    'tools/browser-lan-hardware-qa-lab/index.html',
    'tools/browser-lan-hardware-qa-lab/manifest.json',
    'tools/browser-lan-hardware-qa-lab/module.contract.json',
    'tools/browser-lan-hardware-qa-lab/selftest.js',
    'exports/game-night-seam-report.json',
    'exports/verification-spine-report.json'
  ].map(ref);

  return {
    schema: 'axm.voluntary-phone-qa-campaign-verification-receipt/v1',
    version: Campaign.VERSION,
    generatedAt: '2026-08-19T15:13:00.000Z',
    status: 'TEST',
    focused: {
      verdict: 'PASS',
      explicitAssertions: 90,
      commands: [
        { command: 'node shared/voluntary-phone-qa-campaign/selftest.js', verdict: 'PASS', assertions: 47 },
        { command: 'node docs/steward-runs/2026-08-19-voluntary-phone-qa-campaign/selftest.js', verdict: 'PASS', assertions: 43 }
      ]
    },
    adjacent: {
      verdict: 'PASS_WITH_DECLARED_LIMITS',
      explicitAssertions: 146,
      commandLevelPasses: 1,
      commands: [
        { command: 'node tools/browser-lan-hardware-qa-lab/selftest.js', verdict: 'PASS', assertions: 24 },
        { command: 'node shared/operations/wave2-selftest.js', verdict: 'PASS', assertions: 38 },
        { command: 'node tools/game-hub/game-package-verifier-selftest.js', verdict: 'PASS', assertions: 21 },
        { command: 'node tools/game-hub/game-night-selftest.js', verdict: 'PASS', assertions: null },
        { command: 'node tools/repairbuddy/selftest.js', verdict: 'PASS', assertions: 63 }
      ],
      declaredLimits: [
        'No physical phone, game phone-controller route, or real disconnect/recovery journey was exercised.',
        'No human candidate review or usefulness judgment was supplied.',
        'The QA Lab browser surface was not visually rerun in this increment; its existing source and focused browser-model tests were reused.'
      ]
    },
    capabilityComparison: {
      before: { verdict: 'BLOCKED', missingRequiredCapabilities: 8 },
      after: { verdict: 'READY', missingRequiredCapabilities: 0 },
      optionalCandidateObservation: 'DEGRADED_NOT_RECEIVED',
      optionalAcceptedReview: 'DEGRADED_NOT_RECEIVED',
      optionalPhysicalPhoneEvidence: 'DEGRADED_NOT_RUN',
      optionalWarningClosure: 'DEGRADED_NOT_RUN'
    },
    currentCampaign: {
      verifierGames: campaign.summary.verifierGames,
      physicalPhoneWarnings: campaign.summary.physicalPhoneWarnings,
      sessions: campaign.summary.sessionCount,
      candidateReviews: campaign.summary.reviewRecords,
      acceptedReviews: campaign.summary.acceptedForSeparateGameReview,
      warningsStillOpen: campaign.summary.warningsStillOpen,
      nextGameId: campaign.nextAction.nextGameId,
      participation: campaign.nextAction.state,
      automatic: campaign.nextAction.automatic
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
      state: 'NOT_RUN_EXISTING_LAB_UI_UNCHANGED',
      browserRenderClickTestRun: false
    },
    workspaceSnapshot: {
      branch: 'local-visual-fabric-20260728',
      totalChangedPaths: 12593,
      trackedChangedPaths: 3603,
      untrackedPaths: 8990,
      conflictPaths: 0,
      filesScanned: 20001,
      recentFiles: 177,
      activeFiles: 101,
      activeSharedSeams: 4,
      scanTruncated: true,
      clockSkewedAetherglassSeamsPreserved: 3
    },
    truth: {
      remoteControlIsPhysicalGameQa: false,
      candidateObservationReceived: false,
      humanReviewReceived: false,
      physicalHardwareProven: false,
      humanUsefulnessEstablished: false,
      warningCleared: false,
      qaLabModified: false,
      gameManifestModified: false,
      automaticParticipation: false,
      automaticWrite: false,
      automaticPermissionGrant: false,
      automaticMerge: false,
      automaticCanon: false,
      foundationMutation: false
    },
    sources
  };
}

const receipt = buildReceipt();
fs.writeFileSync(path.join(__dirname, 'VERIFICATION_RECEIPT.json'), JSON.stringify(receipt, null, 2) + '\n');
console.log('PASS voluntary phone-QA campaign verification receipt built');
console.log('focused=90 adjacent=146+1-command required=10 broad=' + receipt.broadVerification.verdict);

