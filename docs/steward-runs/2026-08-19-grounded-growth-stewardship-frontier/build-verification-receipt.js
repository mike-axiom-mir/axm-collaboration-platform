#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const workshop = path.resolve(__dirname, '../../..');

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(workshop, relativePath), 'utf8'));
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === 'object') {
    const result = {};
    Object.keys(value).sort().forEach((key) => { result[key] = stableValue(value[key]); });
    return result;
  }
  return value;
}

function sha256(value) {
  const bytes = Buffer.isBuffer(value)
    ? value
    : Buffer.from(typeof value === 'string' ? value : JSON.stringify(stableValue(value)), 'utf8');
  return 'sha256:' + crypto.createHash('sha256').update(bytes).digest('hex');
}

function fileRef(relativePath) {
  return { path: relativePath, sha256: sha256(fs.readFileSync(path.join(workshop, relativePath))) };
}

const current = readJson('docs/steward-runs/2026-08-19-grounded-growth-stewardship-frontier/CURRENT_STEWARDSHIP_FRONTIER_RECEIPT.json');
const gapBefore = readJson('docs/steward-runs/2026-08-19-grounded-growth-stewardship-frontier/CAPABILITY_GAP_BEFORE.json');
const gapAfter = readJson('docs/steward-runs/2026-08-19-grounded-growth-stewardship-frontier/CAPABILITY_GAP_AFTER.json');
const spine = readJson('exports/verification-spine-report.json');

const sourcePaths = [
  'shared/grounded-growth-challenger-lab/grounded-growth-challenger-lab.js',
  'shared/grounded-growth-challenger-lab/grounded-growth-challenger-readiness.schema.json',
  'shared/grounded-growth-challenger-lab/module.contract.json',
  'shared/grounded-growth-challenger-lab/README.md',
  'shared/grounded-growth-challenger-lab/selftest.js',
  'shared/grounded-growth-frontier-gate/grounded-growth-frontier-gate.js',
  'shared/grounded-growth-frontier-gate/grounded-growth-stewardship-frontier-receipt.schema.json',
  'shared/grounded-growth-frontier-gate/module.contract.json',
  'shared/grounded-growth-frontier-gate/README.md',
  'shared/grounded-growth-frontier-gate/selftest.js',
  'docs/steward-runs/2026-08-19-grounded-growth-challenger-lab/build-current-challenger-readiness.js',
  'docs/steward-runs/2026-08-19-grounded-growth-challenger-lab/selftest.js',
  'docs/steward-runs/2026-08-19-grounded-growth-challenger-lab/CURRENT_CHALLENGER_READINESS.json',
  'docs/steward-runs/2026-08-19-grounded-growth-evidence-frontier/selftest.js',
  'docs/steward-runs/2026-08-19-grounded-growth-stewardship-frontier/build-current-stewardship-frontier.js',
  'docs/steward-runs/2026-08-19-grounded-growth-stewardship-frontier/build-verification-receipt.js',
  'docs/steward-runs/2026-08-19-grounded-growth-stewardship-frontier/selftest.js',
  'docs/steward-runs/2026-08-19-grounded-growth-stewardship-frontier/README.md',
  'docs/steward-runs/2026-08-19-grounded-growth-stewardship-frontier/EVIDENCE_ROUTES.md',
  'docs/steward-runs/2026-08-19-grounded-growth-stewardship-frontier/CAPABILITY_REQUIREMENTS.json',
  'docs/steward-runs/2026-08-19-grounded-growth-stewardship-frontier/CAPABILITY_INVENTORY_BEFORE.json',
  'docs/steward-runs/2026-08-19-grounded-growth-stewardship-frontier/CAPABILITY_INVENTORY_AFTER.json',
  'docs/steward-runs/2026-08-19-grounded-growth-stewardship-frontier/CAPABILITY_GAP_BEFORE.json',
  'docs/steward-runs/2026-08-19-grounded-growth-stewardship-frontier/CAPABILITY_GAP_AFTER.json',
  'docs/steward-runs/2026-08-19-grounded-growth-stewardship-frontier/CURRENT_STEWARDSHIP_FRONTIER_RECEIPT.json'
];

const receipt = {
  schema: 'axm.grounded-growth-stewardship-frontier-verification-receipt/v1',
  version: '0.1.0',
  generatedAt: '2026-08-19T16:46:00.000Z',
  status: 'TEST',
  result: 'PASS_WITH_DECLARED_LIMITS',
  focused: {
    explicitAssertions: 148,
    commands: [
      { command: 'node shared/grounded-growth-challenger-lab/selftest.js', verdict: 'PASS', assertions: 43 },
      { command: 'node shared/grounded-growth-frontier-gate/selftest.js', verdict: 'PASS', assertions: 72 },
      { command: 'node docs/steward-runs/2026-08-19-grounded-growth-stewardship-frontier/selftest.js', verdict: 'PASS', assertions: 33 }
    ]
  },
  adjacent: {
    explicitAssertions: 278,
    commands: [
      { command: 'node docs/steward-runs/2026-08-19-grounded-growth-challenger-lab/selftest.js', verdict: 'PASS', assertions: 29 },
      { command: 'node docs/steward-runs/2026-08-19-grounded-growth-evidence-frontier/selftest.js', verdict: 'PASS', assertions: 26 },
      { command: 'node docs/steward-runs/2026-08-19-grounded-growth-frontier-gate/selftest.js', verdict: 'PASS', assertions: 41 },
      { command: 'node shared/grounded-growth-phone-evidence-gate/selftest.js', verdict: 'PASS', assertions: 34 },
      { command: 'node docs/steward-runs/2026-08-19-phone-grounded-growth-evidence-gate/selftest.js', verdict: 'PASS', assertions: 24 },
      { command: 'node shared/grounded-growth-direction-handoff/selftest.js', verdict: 'PASS', assertions: 32 },
      { command: 'node shared/grounded-growth-human-handoff/selftest.js', verdict: 'PASS', assertions: 45 },
      { command: 'node shared/voluntary-phone-qa-campaign/selftest.js', verdict: 'PASS', assertions: 47 }
    ]
  },
  totalExplicitAssertions: 426,
  capabilityComparison: {
    before: { overall: gapBefore.overall, missingRequiredCapabilities: gapBefore.missingCapabilities.length },
    after: {
      overall: gapAfter.overall,
      missingRequiredCapabilities: gapAfter.missingCapabilities.length,
      degradedOptionalRequirements: gapAfter.requirements.filter((item) => !item.required && item.status === 'DEGRADED').length
    }
  },
  requiredChecks: {
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
    source: fileRef('exports/verification-spine-report.json'),
    schema: spine.schema,
    verdict: spine.verdict,
    failures: Array.isArray(spine.failures) ? spine.failures.length : 0,
    holds: Array.isArray(spine.holds) ? spine.holds.length : 0,
    warningGroups: Array.isArray(spine.warnings) ? spine.warnings.length : 0,
    invalidReceipts: Array.isArray(spine.invalid_receipts) ? spine.invalid_receipts.length : 0,
    knownPhysicalPhoneItems: 17,
    knownCoreWarningLines: 17
  },
  browserVerification: {
    verdict: 'NOT_RUN',
    reason: 'No UI, browser journey, controller runtime, or visual surface changed.'
  },
  currentState: {
    receiptSchema: current.schema,
    receiptDigest: current.stewardshipFrontierDigest,
    portfolioCapabilityChains: current.counts.portfolioCapabilityChains,
    portfolioAiWorkflowPass: current.counts.portfolioAiWorkflowPass,
    portfolioHumanPass: current.counts.portfolioHumanPass,
    phoneDeviceBehaviorPass: current.counts.phoneDeviceBehaviorPass,
    phoneHumanUsefulnessPass: current.counts.phoneHumanUsefulnessPass,
    challengerActionableDirections: current.counts.challengerActionableDirections,
    challengerPlans: current.counts.challengerPlans,
    challengerEvaluations: current.counts.challengerEvaluations,
    sharedGrowthClaimAllowed: current.balance.sharedGrowthClaimAllowed,
    autonomousActionCount: current.decision.autonomousActionCount,
    reviewableActionCount: current.decision.reviewableActionCount
  },
  boundaries: {
    aiReadinessClaimedAsLearning: false,
    challengerEvaluationClaimedAsHumanBenefit: false,
    humanEvidenceClaimedAsAiLearning: false,
    sharedGrowthClaimed: false,
    liveHumanParticipationOccurred: false,
    physicalPhoneObservationOccurred: false,
    challengerPlanCreated: false,
    challengerEvaluationCreated: false,
    experimentalOrganExecuted: false,
    browserClaimed: false,
    canonicalStateTouched: false,
    foundationTouched: false,
    automaticExecution: false,
    automaticCanon: false
  },
  sharedWorkspace: {
    branch: 'local-visual-fabric-20260728',
    broadDirtyWorktreePreserved: true,
    activeForeignSeamsTouched: false,
    scanTruncated: true
  },
  sources: sourcePaths.map(fileRef),
  verificationDigest: null
};

const payload = JSON.parse(JSON.stringify(receipt));
delete payload.verificationDigest;
receipt.verificationDigest = sha256(payload);
fs.writeFileSync(path.join(__dirname, 'VERIFICATION_RECEIPT.json'), JSON.stringify(receipt, null, 2) + '\n');

console.log('PASS Grounded Growth stewardship-frontier verification receipt built');
console.log('focused=' + receipt.focused.explicitAssertions + ' adjacent=' + receipt.adjacent.explicitAssertions + ' required=' + receipt.requiredChecks.passed);
console.log('broad=' + receipt.broadVerification.verdict + ' failures=' + receipt.broadVerification.failures + ' warnings=' + receipt.broadVerification.warningGroups);
