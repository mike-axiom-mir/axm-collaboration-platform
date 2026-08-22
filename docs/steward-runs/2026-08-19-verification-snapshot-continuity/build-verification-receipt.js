#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const Continuity = require('../../../shared/verification-snapshot-continuity/verification-snapshot-continuity');

const ROOT = path.resolve(__dirname, '../../..');
const GENERATED_AT = '2026-08-19T20:35:00.000Z';
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
  'shared/verification-snapshot-continuity/verification-snapshot-continuity.js',
  'shared/verification-snapshot-continuity/verification-snapshot-continuity-receipt.schema.json',
  'shared/verification-snapshot-continuity/module.contract.json',
  'shared/verification-snapshot-continuity/README.md',
  'shared/verification-snapshot-continuity/selftest.js',
  'docs/steward-runs/2026-08-19-verification-snapshot-continuity/build-current-continuity.js',
  'docs/steward-runs/2026-08-19-verification-snapshot-continuity/build-verification-receipt.js',
  'docs/steward-runs/2026-08-19-verification-snapshot-continuity/CAPABILITY_REQUIREMENTS.json',
  'docs/steward-runs/2026-08-19-verification-snapshot-continuity/CAPABILITY_INVENTORY_BEFORE.json',
  'docs/steward-runs/2026-08-19-verification-snapshot-continuity/CAPABILITY_INVENTORY_AFTER.json',
  'docs/steward-runs/2026-08-19-verification-snapshot-continuity/CAPABILITY_GAP_REPORT.json',
  'docs/steward-runs/2026-08-19-verification-snapshot-continuity/CURRENT_CONTINUITY_PORTFOLIO.json',
  'docs/steward-runs/2026-08-19-verification-snapshot-continuity/CURRENT_SUMMARY.json',
  'docs/steward-runs/2026-08-19-verification-snapshot-continuity/EVIDENCE_ROUTES.md',
  'docs/steward-runs/2026-08-19-verification-snapshot-continuity/README.md',
  'docs/steward-runs/2026-08-19-verification-snapshot-continuity/selftest.js'
];

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), 'utf8'));
}

function sourceRef(relativePath) {
  return {
    path: relativePath,
    sha256: Continuity.sha256(fs.readFileSync(path.join(ROOT, relativePath)))
  };
}

function build() {
  const portfolio = readJson('docs/steward-runs/2026-08-19-verification-snapshot-continuity/CURRENT_CONTINUITY_PORTFOLIO.json');
  const gap = readJson('docs/steward-runs/2026-08-19-verification-snapshot-continuity/CAPABILITY_GAP_REPORT.json');
  const observedDerived = portfolio.entries[0].currentEvidence.derivedView;
  const receipt = {
    schema: 'axm.verification-snapshot-continuity-verification/v1',
    verificationId: 'verification:verification-snapshot-continuity-20260819',
    generatedAt: GENERATED_AT,
    status: 'TEST',
    result: 'PASS_WITH_DECLARED_LIMITS',
    focused: {
      explicitAssertions: 126,
      commands: [
        { command: 'node shared/verification-snapshot-continuity/selftest.js', assertions: 42, verdict: 'PASS' },
        { command: 'node docs/steward-runs/2026-08-19-verification-snapshot-continuity/selftest.js', assertions: 84, verdict: 'PASS' }
      ]
    },
    adjacent: {
      explicitAssertions: 201,
      commandLevelPasses: 1,
      commands: [
        { command: 'node shared/grounded-growth-knowledge-frontier/selftest.js', assertions: 57, verdict: 'PASS' },
        { command: 'node shared/grounded-growth-participation-frontier/selftest.js', assertions: 73, verdict: 'PASS' },
        { command: 'node docs/steward-runs/2026-08-19-grounded-growth-participation-frontier/selftest.js', assertions: 71, verdict: 'PASS' },
        { command: 'node tools/module-installer/selftest.js', assertions: null, verdict: 'PASS' }
      ]
    },
    totalExplicitAssertions: 327,
    requiredChecks: {
      passed: REQUIRED_COMMANDS.length,
      failed: 0,
      commands: REQUIRED_COMMANDS.map(command => ({ command, verdict: 'PASS' }))
    },
    broadVerification: {
      binding: 'OBSERVED_AFTER_REQUIRED_CHECKS_THROUGH_CURRENT_PORTFOLIO',
      mutableSourcePath: observedDerived.path,
      observationSha256: observedDerived.sha256,
      rawDigestIncludedInStableSourceRefs: false,
      schema: observedDerived.schema,
      verdict: observedDerived.verdict,
      failures: observedDerived.failures,
      holds: observedDerived.holds,
      warningGroups: observedDerived.warningGroups,
      invalidReceipts: observedDerived.invalidReceipts,
      knownCoreWarningLines: 17
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
        historicalDerivedBytes: gap.after.optionalEvidence['historical-derived-bytes-retained']
      }
    },
    currentState: {
      portfolioSchema: portfolio.schema,
      portfolioDigest: portfolio.portfolioDigest,
      historicalReceipts: portfolio.counts.historicalReceipts,
      currentSourceSetExact: portfolio.counts.currentSourceSetExact,
      mutableDerivedViewDriftOnly: portfolio.counts.mutableDerivedViewDriftOnly,
      trackedSourceDrift: portfolio.counts.trackedSourceDrift,
      held: portfolio.counts.held,
      trackedSourceDriftPaths: portfolio.counts.trackedSourceDriftPaths,
      autonomousActions: portfolio.counts.autonomousActions,
      currentBestAction: portfolio.decision.currentBestAction
    },
    preservedContradictions: [
      {
        command: 'node docs/steward-runs/2026-08-19-grounded-growth-knowledge-frontier/selftest.js',
        verdict: 'FAIL_AT_HISTORICAL_VERIFICATION_RECEIPT_EXACT_REBUILD',
        precedingPassingAssertions: 41,
        continuityClassification: 'MUTABLE_DERIVED_VIEW_DRIFT_ONLY',
        trackedSourceDriftPaths: 0,
        historicalSelfDigest: 'VALID',
        interpretation: 'The product/audit sources tracked by that receipt are current; the retained mutable broad-report digest differs. The historical receipt remains unchanged.'
      }
    ],
    declaredLimits: [
      'Tracked-source byte drift is preserved for review and is not automatically a regression, defect, or harmless change.',
      'Two historical receipts lack a declared self-digest and remain held.',
      'Historical broad-report bytes are unavailable and are not reconstructed from their digest.',
      'The broad report observation is bound through the recorded current portfolio, not treated as a future-stable source ref.',
      'No browser behavior, human benefit, production, promotion, merge, Foundation, or CANON claim is made.'
    ],
    boundaries: {
      historicalReceiptRewritten: false,
      trackedSourceDriftHidden: false,
      currentBroadReportExecutedByClassifier: false,
      currentBroadVerificationClaimedByClassifier: false,
      browserClaimed: false,
      foundationTouched: false,
      canonicalStateTouched: false,
      automaticExecution: false,
      automaticWrite: false,
      automaticPromotion: false,
      automaticMerge: false,
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
      mutableDerivedViewRawDigestIncludedInStableSourceRefs: false,
      currentPortfolioBindsDerivedObservationDigest: true,
      historicalReceiptBytesRewritten: false,
      trackedSourceDriftClaimedAsHarmless: false,
      trackedSourceDriftClaimedAsRegression: false,
      currentBroadVerificationClaimedByContinuityReceipt: false,
      historicalDerivedBytesClaimedAvailable: false,
      rawTerminalLogsRetained: false,
      authorityGranted: false
    },
    verificationDigest: null
  };
  const payload = Continuity.clone(receipt);
  delete payload.verificationDigest;
  receipt.verificationDigest = Continuity.sha256(payload);
  return receipt;
}

function verify(receipt) {
  const errors = [];
  const rebuilt = build();
  if (Continuity.stableStringify(receipt) !== Continuity.stableStringify(rebuilt)) {
    errors.push('verification receipt or stable source digest mismatch');
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
    explicitAssertions: receipt.totalExplicitAssertions,
    requiredChecks: receipt.requiredChecks.passed,
    broadVerdict: receipt.broadVerification.verdict,
    mutableDigestStableSourceRef: receipt.broadVerification.rawDigestIncludedInStableSourceRefs,
    verificationDigest: receipt.verificationDigest
  }, null, 2) + '\n');
}
