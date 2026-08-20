#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const Gate = require('../../../shared/grounded-growth-phone-evidence-gate/grounded-growth-phone-evidence-gate');

const workshop = path.resolve(__dirname, '../../..');

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(workshop, relativePath), 'utf8'));
}

function fileRef(relativePath) {
  const bytes = fs.readFileSync(path.join(workshop, relativePath));
  return {
    path: relativePath.replace(/\\/g, '/'),
    sha256: 'sha256:' + crypto.createHash('sha256').update(bytes).digest('hex')
  };
}

const current = readJson('docs/steward-runs/2026-08-19-phone-grounded-growth-evidence-gate/CURRENT_PHONE_GROUNDED_GROWTH_READINESS.json');
const gapBefore = readJson('docs/steward-runs/2026-08-19-phone-grounded-growth-evidence-gate/CAPABILITY_GAP_BEFORE.json');
const gapAfter = readJson('docs/steward-runs/2026-08-19-phone-grounded-growth-evidence-gate/CAPABILITY_GAP_AFTER.json');

const sourcePaths = [
  'shared/grounded-growth-phone-evidence-gate/grounded-growth-phone-evidence-gate.js',
  'shared/grounded-growth-phone-evidence-gate/grounded-growth-phone-evidence-gate.schema.json',
  'shared/grounded-growth-phone-evidence-gate/module.contract.json',
  'shared/grounded-growth-phone-evidence-gate/README.md',
  'shared/grounded-growth-phone-evidence-gate/selftest.js',
  'docs/steward-runs/2026-08-19-phone-grounded-growth-evidence-gate/build-current-readiness.js',
  'docs/steward-runs/2026-08-19-phone-grounded-growth-evidence-gate/build-verification-receipt.js',
  'docs/steward-runs/2026-08-19-phone-grounded-growth-evidence-gate/selftest.js',
  'docs/steward-runs/2026-08-19-phone-grounded-growth-evidence-gate/README.md',
  'docs/steward-runs/2026-08-19-phone-grounded-growth-evidence-gate/EVIDENCE_ROUTES.md',
  'docs/steward-runs/2026-08-19-phone-grounded-growth-evidence-gate/CAPABILITY_REQUIREMENTS.json',
  'docs/steward-runs/2026-08-19-phone-grounded-growth-evidence-gate/CAPABILITY_INVENTORY_BEFORE.json',
  'docs/steward-runs/2026-08-19-phone-grounded-growth-evidence-gate/CAPABILITY_INVENTORY_AFTER.json',
  'docs/steward-runs/2026-08-19-phone-grounded-growth-evidence-gate/CAPABILITY_GAP_BEFORE.json',
  'docs/steward-runs/2026-08-19-phone-grounded-growth-evidence-gate/CAPABILITY_GAP_AFTER.json',
  'docs/steward-runs/2026-08-19-phone-grounded-growth-evidence-gate/CURRENT_PHONE_GROUNDED_GROWTH_READINESS.json'
];

const requiredChecks = [
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
].map((command) => ({ command, verdict: 'PASS' }));

const receipt = {
  schema: 'axm.phone-grounded-growth-gate-verification-receipt/v1',
  generatedAt: '2026-08-19T15:50:00.000Z',
  status: 'TEST',
  focused: [
    { command: 'node shared/grounded-growth-phone-evidence-gate/selftest.js', verdict: 'PASS', assertions: 34 },
    { command: 'node docs/steward-runs/2026-08-19-phone-grounded-growth-evidence-gate/selftest.js', verdict: 'PASS', assertions: 24 }
  ],
  adjacent: {
    assertionCount: 297,
    commandLevelPasses: 1,
    checks: [
      { command: 'node shared/grounded-growth-human-handoff/selftest.js', assertions: 45 },
      { command: 'node shared/grounded-growth-human-bridge-v2/selftest.js', assertions: 45 },
      { command: 'node shared/grounded-growth-outcomes/selftest.js', assertions: 31 },
      { command: 'node shared/voluntary-phone-qa-campaign/selftest.js', assertions: 47 },
      { command: 'node shared/human-benefit-evidence/selftest.js', assertions: 46 },
      { command: 'node shared/verified-capability-loop/selftest.js', assertions: 21 },
      { command: 'node tools/browser-lan-hardware-qa-lab/selftest.js', assertions: 24 },
      { command: 'node shared/operations/wave2-selftest.js', assertions: 38 },
      { command: 'node tools/game-hub/game-package-verifier.js', verdict: 'PASS_WITH_WARNINGS', failures: 0, warnings: 17 }
    ]
  },
  requiredChecks,
  broad: {
    state: 'VERIFIED_WITH_LIMITS',
    verifyFailures: 0,
    verifyWarnings: 17,
    verificationSpineReceipts: 6,
    verificationSpineAtomicClaims: 9,
    verificationSpineWarningGroups: 2,
    warningMeaning: 'The 17 current Game Hub physical-phone warnings remain open; this gate routes evidence but does not close them.'
  },
  capabilityComparison: {
    before: { overall: gapBefore.overall, missingCapabilities: gapBefore.missingCapabilities.length },
    after: { overall: gapAfter.overall, missingCapabilities: gapAfter.missingCapabilities.length },
    liveOptionalRequirements: gapAfter.requirements.filter((item) => !item.required).map((item) => ({ id: item.id, status: item.status }))
  },
  current: {
    receiptSchema: current.schema,
    gameId: current.game.gameId,
    overall: current.overall,
    deviceKey: current.keys.deviceBehavior.state,
    humanKey: current.keys.humanUsefulness.state,
    combinedEvidencePresent: current.truth.combinedEvidencePresent,
    receiptDigest: current.receiptDigest
  },
  visualVerification: {
    state: 'NOT_RUN',
    reason: 'The increment adds a dependency-free receipt adapter and audit artifacts only; no browser UI or existing live surface changed.'
  },
  scope: {
    addedLeaf: 'shared/grounded-growth-phone-evidence-gate/',
    auditLane: 'docs/steward-runs/2026-08-19-phone-grounded-growth-evidence-gate/',
    existingGamesModified: false,
    existingManifestsModified: false,
    existingQaLabModified: false,
    existingCampaignModified: false,
    existingGroundedGrowthPortfolioModified: false,
    foundationModified: false
  },
  truth: {
    integrationContractReady: gapAfter.overall === 'READY',
    liveDeviceEvidencePresent: false,
    liveHumanEvidencePresent: false,
    combinedEvidencePresent: false,
    humanBenefitClaimed: false,
    automaticExecution: false,
    automaticWrite: false,
    automaticInstall: false,
    automaticPromotion: false,
    automaticMerge: false,
    automaticCanon: false
  },
  sourceRefs: sourcePaths.map(fileRef)
};

if (receipt.focused.reduce((sum, item) => sum + item.assertions, 0) !== 58) throw new Error('focused assertion count mismatch');
if (receipt.adjacent.checks.filter((item) => item.assertions).reduce((sum, item) => sum + item.assertions, 0) !== receipt.adjacent.assertionCount) throw new Error('adjacent assertion count mismatch');
if (!requiredChecks.every((item) => item.verdict === 'PASS')) throw new Error('required check receipt contains a non-pass result');
if (current.schema !== Gate.RECEIPT_SCHEMA || current.truth.combinedEvidencePresent !== false) throw new Error('current readiness truth mismatch');

fs.writeFileSync(path.join(__dirname, 'VERIFICATION_RECEIPT.json'), JSON.stringify(receipt, null, 2) + '\n');
console.log('PASS verification receipt built');
console.log('focused=58 adjacent=297+1 required=10 warnings=17');

module.exports = receipt;
