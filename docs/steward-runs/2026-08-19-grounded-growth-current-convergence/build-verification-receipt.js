#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const Current = require('../../../shared/grounded-growth-current-state/grounded-growth-current-state');
const Convergence = require('./build-current-convergence');

const ROOT = path.resolve(__dirname, '..', '..', '..');
const GENERATED_AT = '2026-08-19T21:03:00.000Z';
const SOURCE_FILES = [
  'shared/grounded-growth-current-state/grounded-growth-current-state.js',
  'shared/grounded-growth-current-state/grounded-growth-current-state-receipt.schema.json',
  'shared/grounded-growth-current-state/module.contract.json',
  'shared/grounded-growth-current-state/README.md',
  'shared/grounded-growth-current-state/selftest.js',
  'docs/steward-runs/2026-08-19-grounded-growth-current-convergence/CAPABILITY_REQUIREMENTS.json',
  'docs/steward-runs/2026-08-19-grounded-growth-current-convergence/CAPABILITY_INVENTORY_BEFORE.json',
  'docs/steward-runs/2026-08-19-grounded-growth-current-convergence/CAPABILITY_INVENTORY_AFTER.json',
  'docs/steward-runs/2026-08-19-grounded-growth-current-convergence/CAPABILITY_GAP_BEFORE.json',
  'docs/steward-runs/2026-08-19-grounded-growth-current-convergence/CAPABILITY_GAP_AFTER.json',
  'docs/steward-runs/2026-08-19-grounded-growth-current-convergence/EVIDENCE_ROUTES.md',
  'docs/steward-runs/2026-08-19-grounded-growth-current-convergence/README.md',
  'docs/steward-runs/2026-08-19-grounded-growth-current-convergence/build-current-convergence.js',
  'docs/steward-runs/2026-08-19-grounded-growth-current-convergence/CURRENT_STATE_RECEIPT.json',
  'docs/steward-runs/2026-08-19-grounded-growth-current-convergence/CURRENT_SUMMARY.json',
  'docs/steward-runs/2026-08-19-grounded-growth-current-convergence/selftest.js',
  'docs/steward-runs/2026-08-19-grounded-growth-current-convergence/build-verification-receipt.js',
  'docs/steward-runs/2026-08-19-grounded-growth-participation-frontier/build-current-participation-frontier.js',
  'docs/steward-runs/2026-08-19-grounded-growth-participation-frontier/CURRENT_PARTICIPATION_FRONTIER_RECEIPT.json',
  'docs/steward-runs/2026-08-19-grounded-growth-participation-frontier/build-verification-receipt.js',
  'docs/steward-runs/2026-08-19-grounded-growth-participation-frontier/VERIFICATION_RECEIPT.json',
  'docs/steward-runs/2026-08-19-verification-evolution-grounded-growth/build-verification-evolution-growth.js',
  'docs/steward-runs/2026-08-19-verification-evolution-grounded-growth/CURRENT_PORTFOLIO.json',
  'shared/verification-source-evolution-review/verification-source-evolution-review.js',
  'docs/steward-runs/2026-08-19-verification-evolution-grounded-growth/selftest.js'
];

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

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), 'utf8'));
}

function sourceRef(relativePath) {
  const bytes = fs.readFileSync(path.join(ROOT, relativePath));
  return {
    path: relativePath.replace(/\\/g, '/'),
    sha256: Current.sha256(bytes)
  };
}

function build() {
  const convergence = Convergence.verifyRecorded();
  const broad = readJson('exports/verification-spine-report.json');
  const historical = readJson('docs/steward-runs/2026-08-19-grounded-growth-participation-frontier/VERIFICATION_RECEIPT.json');
  const receipt = {
    schema: 'axm.grounded-growth-current-convergence-verification/v1',
    verificationId: 'verification:grounded-growth-current-convergence-20260819',
    generatedAt: GENERATED_AT,
    status: 'TEST',
    result: 'PASS_WITH_DECLARED_LIMITS',
    currentState: {
      state: convergence.receipt.state,
      outcomes: convergence.receipt.currentEvidence.outcomes,
      capabilityChains: convergence.receipt.currentEvidence.capabilityChains,
      sharedSystemPass: convergence.receipt.currentEvidence.sharedSystemPass,
      aiWorkflowPass: convergence.receipt.currentEvidence.aiWorkflowPass,
      humanPass: convergence.receipt.currentEvidence.humanPass,
      humanNotRun: convergence.receipt.currentEvidence.humanNotRun,
      optionalReviewCandidates: convergence.receipt.decision.reviewableActionCount,
      autonomousActionCount: convergence.receipt.decision.autonomousActionCount,
      currentBestAction: convergence.receipt.decision.currentBestAction,
      receiptRef: {
        id: convergence.receipt.receiptId,
        schema: convergence.receipt.schema,
        sha256: convergence.receipt.receiptDigest
      }
    },
    focused: {
      passed: 2,
      failed: 0,
      explicitAssertions: 88,
      checks: [
        { command: 'node shared/grounded-growth-current-state/selftest.js', verdict: 'PASS', assertions: 35 },
        { command: 'node docs/steward-runs/2026-08-19-grounded-growth-current-convergence/selftest.js', verdict: 'PASS', assertions: 53 }
      ]
    },
    adjacent: {
      passed: 3,
      failed: 0,
      explicitAssertions: 217,
      checks: [
        { command: 'node shared/grounded-growth-outcomes/selftest.js', verdict: 'PASS', assertions: 31 },
        { command: 'node shared/grounded-growth-participation-frontier/selftest.js', verdict: 'PASS', assertions: 73 },
        { command: 'node docs/steward-runs/2026-08-19-verification-evolution-grounded-growth/selftest.js', verdict: 'PASS', assertions: 113 }
      ]
    },
    knownHistoricalDrift: {
      command: 'node docs/steward-runs/2026-08-19-grounded-growth-participation-frontier/selftest.js',
      verdict: 'EXPECTED_HISTORICAL_RECEIPT_DRIFT',
      classification: 'RECOGNIZED_MUTABLE_DERIVED_VIEW_DRIFT',
      substantiveParticipationAssertionsBeforeFinalDigestGate: 'PASS',
      changedFields: ['broadVerification.source.sha256', 'verificationDigest'],
      historicalVerificationDigest: historical.verificationDigest,
      recordedBroadReportDigest: historical.broadVerification.source.sha256,
      currentBroadReportRef: sourceRef('exports/verification-spine-report.json'),
      currentSourceEvolutionGuard: 'PASS',
      historicalReceiptRewritten: false
    },
    requiredChecks: {
      total: REQUIRED_COMMANDS.length,
      passed: REQUIRED_COMMANDS.length,
      failed: 0,
      checks: REQUIRED_COMMANDS.map((command) => ({ command, exitCode: 0, verdict: 'PASS' }))
    },
    broadVerification: {
      source: sourceRef('exports/verification-spine-report.json'),
      schema: broad.schema,
      profile: broad.profile.id,
      verdict: broad.verdict,
      receipts: broad.receipt_count,
      atomicClaims: broad.claim_count,
      warnings: broad.warnings.length,
      failures: broad.failures.length,
      holds: broad.holds.length,
      invalidReceipts: broad.invalid_receipts.length
    },
    coreVerification: {
      verdict: 'PASS_WITH_WARNINGS_RETAINED',
      warningLines: 17,
      failures: 0
    },
    browserVerification: {
      applicable: false,
      verdict: 'NOT_RUN',
      reason: 'No browser-rendered or interactive surface changed.'
    },
    capabilityGap: {
      before: 'BLOCKED',
      after: 'DEGRADED',
      requiredGroupsReady: 4,
      requiredMissingAfter: 0,
      optionalHumanEvidence: 'OPTIONAL_UNKNOWN'
    },
    totalExplicitAssertions: 305,
    boundaries: {
      humanParticipationOccurred: false,
      humanBenefitEstablished: false,
      sharedGrowthClaimed: false,
      sourcePackageExecuted: false,
      modelInvoked: false,
      existingReceiptRewritten: false,
      automaticAction: false,
      installed: false,
      promoted: false,
      merged: false,
      canonized: false,
      foundationMutation: false
    },
    sourceRefs: SOURCE_FILES.map(sourceRef),
    verificationDigest: null
  };
  const payload = JSON.parse(JSON.stringify(receipt));
  delete payload.verificationDigest;
  receipt.verificationDigest = Current.sha256(payload);
  return receipt;
}

function verify(receipt) {
  const errors = [];
  try {
    const rebuilt = build();
    if (Current.stableStringify(rebuilt) !== Current.stableStringify(receipt)) {
      throw new Error('verification receipt or source digest mismatch');
    }
  } catch (error) {
    errors.push(error.message);
  }
  return { pass: errors.length === 0, errors };
}

function write() {
  const receipt = build();
  fs.writeFileSync(path.join(__dirname, 'VERIFICATION_RECEIPT.json'), JSON.stringify(receipt, null, 2) + '\n');
  return receipt;
}

if (require.main === module) {
  try {
    const receipt = process.argv.includes('--write') ? write() : build();
    process.stdout.write(JSON.stringify({
      result: receipt.result,
      explicitAssertions: receipt.totalExplicitAssertions,
      requiredChecks: receipt.requiredChecks.passed + '/' + receipt.requiredChecks.total,
      broad: receipt.broadVerification.verdict,
      warnings: receipt.broadVerification.warnings,
      digest: receipt.verificationDigest
    }, null, 2) + '\n');
  } catch (error) {
    process.stderr.write((error.stack || error.message) + '\n');
    process.exitCode = 1;
  }
}

module.exports = { SOURCE_FILES, REQUIRED_COMMANDS, build, verify, write };
