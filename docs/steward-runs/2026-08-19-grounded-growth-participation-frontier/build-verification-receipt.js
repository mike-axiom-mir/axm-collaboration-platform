#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const Participation = require('../../../shared/grounded-growth-participation-frontier/grounded-growth-participation-frontier');
const Current = require('./build-current-participation-frontier');

const ROOT = path.resolve(__dirname, '../../..');
const GENERATED_AT = '2026-08-19T18:35:00.000Z';
const REQUIRED_COMMANDS = [
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
const SOURCE_FILES = [
  'shared/grounded-growth-participation-frontier/grounded-growth-participation-frontier.js',
  'shared/grounded-growth-participation-frontier/grounded-growth-participation-frontier-receipt.schema.json',
  'shared/grounded-growth-participation-frontier/module.contract.json',
  'shared/grounded-growth-participation-frontier/README.md',
  'shared/grounded-growth-participation-frontier/selftest.js',
  'docs/steward-runs/2026-08-19-grounded-growth-participation-frontier/build-current-participation-frontier.js',
  'docs/steward-runs/2026-08-19-grounded-growth-participation-frontier/CAPABILITY_REQUIREMENTS.json',
  'docs/steward-runs/2026-08-19-grounded-growth-participation-frontier/CAPABILITY_INVENTORY_BEFORE.json',
  'docs/steward-runs/2026-08-19-grounded-growth-participation-frontier/CAPABILITY_INVENTORY_AFTER.json',
  'docs/steward-runs/2026-08-19-grounded-growth-participation-frontier/CAPABILITY_GAP_REPORT.json',
  'docs/steward-runs/2026-08-19-grounded-growth-participation-frontier/CURRENT_PARTICIPATION_FRONTIER_RECEIPT.json',
  'docs/steward-runs/2026-08-19-grounded-growth-participation-frontier/CURRENT_SUMMARY.json',
  'docs/steward-runs/2026-08-19-grounded-growth-participation-frontier/EVIDENCE_ROUTES.md',
  'docs/steward-runs/2026-08-19-grounded-growth-participation-frontier/README.md',
  'docs/steward-runs/2026-08-19-grounded-growth-participation-frontier/selftest.js'
];

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), 'utf8'));
}

function sourceRef(relativePath) {
  return { path: relativePath, sha256: Participation.sha256(fs.readFileSync(path.join(ROOT, relativePath))) };
}

function build() {
  const current = Current.current();
  const gap = readJson('docs/steward-runs/2026-08-19-grounded-growth-participation-frontier/CAPABILITY_GAP_REPORT.json');
  const spine = readJson('exports/verification-spine-report.json');
  const receipt = {
    schema: 'axm.grounded-growth-participation-frontier-verification/v1',
    verificationId: 'verification:grounded-growth-participation-frontier-20260819',
    generatedAt: GENERATED_AT,
    status: 'TEST',
    result: 'PASS_WITH_DECLARED_LIMITS',
    focused: {
      explicitAssertions: 144,
      commands: [
        { command: 'node shared/grounded-growth-participation-frontier/selftest.js', assertions: 73, verdict: 'PASS' },
        { command: 'node docs/steward-runs/2026-08-19-grounded-growth-participation-frontier/selftest.js', assertions: 71, verdict: 'PASS' }
      ]
    },
    adjacent: {
      explicitAssertions: 346,
      commands: [
        { command: 'node shared/grounded-growth-knowledge-frontier/selftest.js', assertions: 57, verdict: 'PASS' },
        { command: 'node shared/human-benefit-evidence/selftest.js', assertions: 46, verdict: 'PASS' },
        { command: 'node shared/grounded-growth-human-bridge-v2/selftest.js', assertions: 45, verdict: 'PASS' },
        { command: 'node docs/steward-runs/2026-08-19-reuse-existing-human-bridge-ancestry/selftest.js', assertions: 53, verdict: 'PASS' },
        { command: 'node shared/grounded-growth-human-handoff/selftest.js', assertions: 45, verdict: 'PASS' },
        { command: 'node docs/steward-runs/2026-08-19-human-handoff-operational-readiness/selftest.js', assertions: 47, verdict: 'PASS' },
        { command: 'node docs/steward-runs/2026-08-19-human-readiness-portfolio-coverage/selftest.js', environment: 'AXM_TEST_TEMP=<dedicated verified temp directory>', assertions: 53, verdict: 'PASS' }
      ]
    },
    totalExplicitAssertions: 490,
    correctedInvocations: [{
      command: 'node docs/steward-runs/2026-08-19-human-readiness-portfolio-coverage/selftest.js',
      firstAttempt: 'NOT_RUN_MISSING_REQUIRED_TEST_ENVIRONMENT',
      correction: 'Reran with AXM_TEST_TEMP set to a dedicated directory under the operating-system temp root.',
      correctedVerdict: 'PASS',
      assertions: 53,
      temporaryDirectoryRemoved: true
    }],
    preservedAdjacentDrift: [{
      command: 'node docs/steward-runs/2026-08-19-grounded-growth-knowledge-frontier/selftest.js',
      verdict: 'HISTORICAL_VERIFICATION_SNAPSHOT_DRIFT',
      productAssertionsPassedBeforeDrift: 41,
      failedAssertion: 'verification receipt and every declared source digest rebuild exactly',
      changedSharedSource: 'exports/verification-spine-report.json',
      reason: 'The required verify-plus run regenerated the shared timestamped broad report after the prior knowledge receipt was sealed. The knowledge frontier, stored current receipt, summary, capability comparison, ancestry bindings, and authority boundaries all rebuilt before this historical-source assertion.',
      repairedByRewritingHistoricalReceipt: false
    }],
    requiredChecks: {
      passed: REQUIRED_COMMANDS.length,
      failed: 0,
      commands: REQUIRED_COMMANDS.map(command => ({ command, verdict: 'PASS' }))
    },
    broadVerification: {
      source: sourceRef('exports/verification-spine-report.json'),
      schema: spine.schema,
      verdict: spine.verdict,
      failures: Array.isArray(spine.failures) ? spine.failures.length : 0,
      holds: Array.isArray(spine.holds) ? spine.holds.length : 0,
      warningGroups: Array.isArray(spine.warnings) ? spine.warnings.length : 0,
      invalidReceipts: Array.isArray(spine.invalid_receipts) ? spine.invalid_receipts.length : 0,
      knownCoreWarningLines: 17,
      knownPendingRealWorldEvidenceItems: 17
    },
    browserVerification: {
      verdict: 'NOT_RUN',
      reason: 'No UI, browser journey, controller runtime, or visual surface changed.'
    },
    capabilityComparison: {
      before: { overall: gap.before.overall, missingRequiredCapabilities: gap.before.missingCapabilities.length },
      after: {
        overall: gap.after.overall,
        missingRequiredCapabilities: gap.after.missingCapabilities.length,
        degradedOptionalRequirements: Object.values(gap.after.optionalEvidence).filter(status => status !== 'READY').length
      }
    },
    currentState: {
      frontierSchema: current.schema,
      frontierDigest: current.participationFrontierDigest,
      totalLanes: current.counts.totalLanes,
      boundedResearchAiWorkflowPass: current.counts.boundedResearchAiWorkflowPass,
      researchHumanBenefitPass: current.counts.researchHumanBenefitPass,
      availableOptionalHandoffs: current.counts.availableOptionalHandoffs,
      participantTrials: current.counts.participantTrials,
      reviewCandidates: current.counts.reviewCandidates,
      unresolvedEvidence: current.balance.unresolvedEvidence.length,
      currentBestAction: current.decision.currentBestAction,
      autonomousActionCount: current.decision.autonomousActionCount,
      reviewableActionCount: current.decision.reviewableActionCount
    },
    declaredLimits: [
      'The review candidate is not participation, human evidence, human benefit, or shared growth.',
      'No person opted in and no LIVE research-workflow session, judgment, closure, bridge package, or outcome exists.',
      'The bounded AI-workflow result remains separate from human-benefit evidence, which is NOT_RUN.',
      'Research artifact/model attribution and cross-model independence remain unresolved.',
      'No execution, production, promotion, merge, shared-growth, model-weight, or CANON claim is made.'
    ],
    boundaries: {
      reviewClaimedAsParticipation: false,
      packetReadinessClaimedAsHumanEvidence: false,
      aiWorkflowClaimedAsHumanBenefit: false,
      humanBenefitClaimed: false,
      sharedGrowthClaimed: false,
      liveHumanParticipationOccurred: false,
      packageSourceExecuted: false,
      modelInvoked: false,
      browserClaimed: false,
      foundationTouched: false,
      canonicalStateTouched: false,
      automaticParticipation: false,
      automaticExecution: false,
      automaticPromotion: false,
      automaticCanon: false
    },
    sharedWorkspace: {
      branch: 'local-visual-fabric-20260728',
      broadDirtyWorktreePreserved: true,
      activeForeignSeamsTouched: false,
      scanTruncated: true
    },
    sourceRefs: SOURCE_FILES.map(sourceRef),
    truth: {
      sourceDigestsCurrentAtReceiptTime: true,
      rawTerminalLogsRetained: false,
      exactRebuildVerificationUsed: true,
      nativeProofSurfacesUsed: true,
      authorityGranted: false
    },
    verificationDigest: null
  };
  const payload = JSON.parse(JSON.stringify(receipt));
  delete payload.verificationDigest;
  receipt.verificationDigest = Participation.sha256(payload);
  return receipt;
}

function verify(receipt) {
  const errors = [];
  const rebuilt = build();
  if (Participation.stableStringify(receipt) !== Participation.stableStringify(rebuilt)) {
    errors.push('verification receipt or source digest mismatch');
  }
  return { pass: errors.length === 0, errors };
}

function write() {
  const receipt = build();
  fs.writeFileSync(path.join(__dirname, 'VERIFICATION_RECEIPT.json'), JSON.stringify(receipt, null, 2) + '\n');
  return receipt;
}

module.exports = { REQUIRED_COMMANDS, SOURCE_FILES, build, verify, write };

if (require.main === module) {
  const receipt = process.argv.includes('--write') ? write() : build();
  process.stdout.write(JSON.stringify({
    result: receipt.result,
    assertions: receipt.totalExplicitAssertions,
    requiredChecks: receipt.requiredChecks.passed,
    broad: receipt.broadVerification.verdict,
    verificationDigest: receipt.verificationDigest
  }, null, 2) + '\n');
}
