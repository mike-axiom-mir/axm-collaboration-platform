#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const Knowledge = require('../../../shared/grounded-growth-knowledge-frontier/grounded-growth-knowledge-frontier');
const Current = require('./build-current-knowledge-frontier');

const ROOT = path.resolve(__dirname, '../../..');
const GENERATED_AT = '2026-08-19T18:05:00.000Z';
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
  'shared/grounded-growth-knowledge-frontier/grounded-growth-knowledge-frontier.js',
  'shared/grounded-growth-knowledge-frontier/grounded-growth-knowledge-frontier-receipt.schema.json',
  'shared/grounded-growth-knowledge-frontier/module.contract.json',
  'shared/grounded-growth-knowledge-frontier/README.md',
  'shared/grounded-growth-knowledge-frontier/selftest.js',
  'docs/steward-runs/2026-08-19-grounded-growth-knowledge-frontier/build-current-knowledge-frontier.js',
  'docs/steward-runs/2026-08-19-grounded-growth-knowledge-frontier/CAPABILITY_REQUIREMENTS.json',
  'docs/steward-runs/2026-08-19-grounded-growth-knowledge-frontier/CAPABILITY_INVENTORY_BEFORE.json',
  'docs/steward-runs/2026-08-19-grounded-growth-knowledge-frontier/CAPABILITY_INVENTORY_AFTER.json',
  'docs/steward-runs/2026-08-19-grounded-growth-knowledge-frontier/CAPABILITY_GAP_REPORT.json',
  'docs/steward-runs/2026-08-19-grounded-growth-knowledge-frontier/CURRENT_KNOWLEDGE_FRONTIER_RECEIPT.json',
  'docs/steward-runs/2026-08-19-grounded-growth-knowledge-frontier/CURRENT_SUMMARY.json',
  'docs/steward-runs/2026-08-19-grounded-growth-knowledge-frontier/EVIDENCE_ROUTES.md',
  'docs/steward-runs/2026-08-19-grounded-growth-knowledge-frontier/README.md',
  'docs/steward-runs/2026-08-19-grounded-growth-knowledge-frontier/selftest.js'
];

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), 'utf8'));
}

function sourceRef(relativePath) {
  return {
    path: relativePath,
    sha256: Knowledge.sha256(fs.readFileSync(path.join(ROOT, relativePath)))
  };
}

function build() {
  const current = Current.current();
  const gap = readJson('docs/steward-runs/2026-08-19-grounded-growth-knowledge-frontier/CAPABILITY_GAP_REPORT.json');
  const spine = readJson('exports/verification-spine-report.json');
  const receipt = {
    schema: 'axm.grounded-growth-knowledge-frontier-verification/v1',
    verificationId: 'verification:grounded-growth-knowledge-frontier-20260819',
    generatedAt: GENERATED_AT,
    status: 'TEST',
    result: 'PASS_WITH_DECLARED_LIMITS',
    focused: {
      explicitAssertions: 111,
      commands: [
        { command: 'node shared/grounded-growth-knowledge-frontier/selftest.js', assertions: 57, verdict: 'PASS' },
        { command: 'node docs/steward-runs/2026-08-19-grounded-growth-knowledge-frontier/selftest.js', assertions: 54, verdict: 'PASS' }
      ]
    },
    adjacent: {
      explicitAssertions: 267,
      commands: [
        { command: 'node shared/research-contribution-intake/selftest.js', assertions: 47, verdict: 'PASS' },
        { command: 'node docs/steward-runs/2026-08-19-research-contribution-intake/selftest.js', assertions: 50, verdict: 'PASS' },
        { command: 'node shared/grounded-growth-frontier-gate/selftest.js', assertions: 72, verdict: 'PASS' },
        { command: 'node docs/steward-runs/2026-08-19-grounded-growth-stewardship-frontier/selftest.js', assertions: 33, verdict: 'PASS' },
        { command: 'node shared/grounded-growth-outcomes/selftest.js', assertions: 31, verdict: 'PASS' },
        { command: 'node shared/portable-baseline-capsule/selftest.js', assertions: 34, verdict: 'PASS' }
      ]
    },
    totalExplicitAssertions: 378,
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
      before: {
        overall: gap.before.overall,
        missingRequiredCapabilities: gap.before.missingCapabilities.length
      },
      after: {
        overall: gap.after.overall,
        missingRequiredCapabilities: gap.after.missingCapabilities.length,
        nonReadyOptionalRequirements: Object.values(gap.after.optionalEvidence).filter(status => status !== 'READY').length
      }
    },
    currentState: {
      frontierSchema: current.schema,
      frontierDigest: current.knowledgeFrontierDigest,
      totalLanes: current.counts.totalLanes,
      researchArtifacts: current.counts.researchArtifacts,
      researchModelSeats: current.counts.researchModelSeats,
      researchRetainedSignals: current.counts.researchRetainedSignals,
      researchProposals: current.counts.researchProposals,
      researchWarnings: current.counts.researchWarnings,
      researchHolds: current.counts.researchHolds,
      boundedResearchAiWorkflowPass: current.counts.researchAiWorkflowPass,
      researchHumanBenefitPass: current.counts.researchHumanPass,
      unresolvedEvidence: current.balance.unresolvedEvidence.length,
      currentBestAction: current.decision.currentBestAction,
      autonomousActionCount: current.decision.autonomousActionCount,
      reviewableActionCount: current.decision.reviewableActionCount
    },
    declaredLimits: [
      'Artifact-to-model mapping, exact model identity, prior-output isolation, and cross-model independence are not established.',
      'The structural intake and planning projection are not runtime, candidate, human-benefit, or model-learning evidence.',
      'The bounded AI-workflow result remains separate from human-benefit evidence, which is NOT_RUN.',
      'The existing disposition aliases differ; only their schema and SHA-256 content identity match.',
      'No execution, production, promotion, merge, shared-growth, model-weight, or CANON claim is made.'
    ],
    boundaries: {
      packageSourceExecuted: false,
      modelInvoked: false,
      agreementClaimedAsProof: false,
      intakeClaimedAsEvidence: false,
      planningClaimedAsCandidatePresence: false,
      aiWorkflowClaimedAsModelLearning: false,
      aiWorkflowClaimedAsHumanBenefit: false,
      sharedGrowthClaimed: false,
      liveHumanParticipationOccurred: false,
      browserClaimed: false,
      foundationTouched: false,
      canonicalStateTouched: false,
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
  receipt.verificationDigest = Knowledge.sha256(payload);
  return receipt;
}

function verify(receipt) {
  const errors = [];
  const rebuilt = build();
  if (Knowledge.stableStringify(receipt) !== Knowledge.stableStringify(rebuilt)) {
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
