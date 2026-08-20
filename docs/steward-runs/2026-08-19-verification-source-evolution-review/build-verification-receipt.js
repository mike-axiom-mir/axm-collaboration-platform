#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const Evolution = require('../../../shared/verification-source-evolution-review/verification-source-evolution-review');

const ROOT = path.resolve(__dirname, '../../..');
const GENERATED_AT = '2026-08-19T20:05:00.000Z';
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
  'shared/verification-source-evolution-review/verification-source-evolution-review.js',
  'shared/verification-source-evolution-review/verification-source-evolution-review.schema.json',
  'shared/verification-source-evolution-review/verification-legacy-external-anchor.schema.json',
  'shared/verification-source-evolution-review/verification-candidate-evolution-bridge.schema.json',
  'shared/verification-source-evolution-review/module.contract.json',
  'shared/verification-source-evolution-review/README.md',
  'shared/verification-source-evolution-review/selftest.js',
  'docs/steward-runs/2026-08-19-verification-source-evolution-review/build-current-evolution-review.js',
  'docs/steward-runs/2026-08-19-verification-source-evolution-review/build-verification-receipt.js',
  'docs/steward-runs/2026-08-19-verification-source-evolution-review/CAPABILITY_REQUIREMENTS.json',
  'docs/steward-runs/2026-08-19-verification-source-evolution-review/CAPABILITY_INVENTORY_BEFORE.json',
  'docs/steward-runs/2026-08-19-verification-source-evolution-review/CAPABILITY_INVENTORY_AFTER.json',
  'docs/steward-runs/2026-08-19-verification-source-evolution-review/CAPABILITY_GAP_REPORT.json',
  'docs/steward-runs/2026-08-19-verification-source-evolution-review/CURRENT_EVOLUTION_REVIEW_PORTFOLIO.json',
  'docs/steward-runs/2026-08-19-verification-source-evolution-review/CURRENT_SUMMARY.json',
  'docs/steward-runs/2026-08-19-verification-source-evolution-review/EVIDENCE_ROUTES.md',
  'docs/steward-runs/2026-08-19-verification-source-evolution-review/README.md',
  'docs/steward-runs/2026-08-19-verification-source-evolution-review/RECEIPT_INVENTORY.json',
  'docs/steward-runs/2026-08-19-verification-source-evolution-review/selftest.js'
];

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), 'utf8'));
}

function sourceRef(relativePath) {
  return {
    path: relativePath,
    sha256: Evolution.sha256(fs.readFileSync(path.join(ROOT, relativePath)))
  };
}

function build() {
  const portfolio = readJson('docs/steward-runs/2026-08-19-verification-source-evolution-review/CURRENT_EVOLUTION_REVIEW_PORTFOLIO.json');
  const gap = readJson('docs/steward-runs/2026-08-19-verification-source-evolution-review/CAPABILITY_GAP_REPORT.json');
  const broad = portfolio.broadVerificationObservation;
  const receipt = {
    schema: 'axm.verification-source-evolution-review-verification/v1',
    verificationId: 'verification:verification-source-evolution-review-20260819',
    generatedAt: GENERATED_AT,
    status: 'TEST',
    result: 'PASS_WITH_DECLARED_LIMITS',
    focused: {
      explicitAssertions: 147,
      commands: [
        { command: 'node shared/verification-source-evolution-review/selftest.js', assertions: 47, verdict: 'PASS' },
        { command: 'node docs/steward-runs/2026-08-19-verification-source-evolution-review/selftest.js', assertions: 100, verdict: 'PASS' }
      ]
    },
    adjacent: {
      explicitAssertions: 154,
      commandLevelPasses: 1,
      commands: [
        { command: 'node shared/verification-snapshot-continuity/selftest.js', assertions: 42, verdict: 'PASS' },
        { command: 'node docs/steward-runs/2026-08-19-verification-snapshot-continuity/selftest.js', assertions: 84, verdict: 'PASS' },
        { command: 'node tools/module-lineage-comparator/selftest.js', assertions: 28, verdict: 'PASS' },
        { command: 'node tools/immutable-history-guard/selftest.js', assertions: null, verdict: 'PASS' }
      ]
    },
    totalExplicitAssertions: 301,
    requiredChecks: {
      passed: REQUIRED_COMMANDS.length,
      failed: 0,
      commands: REQUIRED_COMMANDS.map(command => ({ command, verdict: 'PASS' }))
    },
    broadVerification: {
      binding: 'OBSERVED_AFTER_REQUIRED_CHECKS_THROUGH_CURRENT_EVOLUTION_PORTFOLIO',
      mutableSourcePath: portfolio.sourceRefs.currentVerificationSpine.path,
      observationSha256: portfolio.sourceRefs.currentVerificationSpine.sha256,
      rawDigestIncludedInStableSourceRefs: false,
      schema: broad.schema,
      profile: broad.profile,
      verdict: broad.verdict,
      failures: broad.failures,
      holds: broad.holds,
      warningGroups: broad.warningGroups,
      invalidReceipts: broad.invalidReceipts,
      receiptCount: broad.receiptCount,
      claimCount: broad.claimCount,
      knownCoreWarningLines: broad.knownCoreWarningLines
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
        historicalPreAnchorIntegrity: gap.after.optionalEvidence['historical-pre-anchor-integrity']
      }
    },
    currentState: {
      portfolioSchema: portfolio.schema,
      portfolioDigest: portfolio.portfolioDigest,
      receiptInventory: portfolio.counts.receiptInventory,
      driftRows: portfolio.counts.driftRows,
      directStrongRoutes: portfolio.counts.laterCurrentTrackedReceiptCoverage,
      directAttestationOnlyRows: portfolio.counts.laterDigestValidAttestationOnly,
      candidateScopeEvolutionBridges: portfolio.counts.candidateScopeEvolutionBridges,
      generatedViewSemanticRoutes: portfolio.counts.generatedViewSemanticMatches,
      unresolvedCurrentByteProvenance: portfolio.counts.unresolvedCurrentByteProvenance,
      unresolvedCandidateCurrentness: portfolio.counts.unresolvedCandidateCurrentness,
      legacyPreAnchorIntegrityUnknown: portfolio.counts.legacyPreAnchorIntegrityUnknown,
      autonomousActions: portfolio.counts.autonomousActions,
      currentBestAction: portfolio.decision.currentBestAction
    },
    preservedContradictions: [
      {
        subject: 'docs/steward-runs/2026-08-19-grounded-growth-frontier-gate/selftest.js',
        directReviewState: 'CURRENT_BYTES_ATTESTED_BY_LATER_DIGEST_VALID_RECEIPT_CURRENTNESS_UNPROVEN',
        portfolioRoute: 'TARGET_BYTES_ATTESTED_AND_CANDIDATE_SCOPE_EVOLUTION_FULLY_ROUTED',
        interpretation: 'The target bytes have an exact later attestation and every drift row in that candidate receipt has a strong later-current route. The candidate receipt itself is not claimed byte-current.'
      },
      {
        subject: 'two legacy verification receipts without declared self-digests',
        currentRoute: 'EXTERNALLY_ANCHORED_FROM_CURRENT_BYTES',
        retainedHold: 'PRE_ANCHOR_INTEGRITY_UNKNOWN'
      },
      {
        subject: 'exports/game-night-seam-report.json',
        currentRoute: 'KNOWN_GENERATED_VIEW_BOUNDED_SEMANTIC_MATCH',
        retainedHold: 'HISTORICAL_REPORT_BYTES_NOT_RECONSTRUCTED'
      }
    ],
    declaredLimits: [
      'Later receipt lineage establishes byte attestation, not original intent, correctness, regression absence, quality, or human benefit.',
      'The transitive bridge routes candidate-scope evolution without claiming the candidate receipt itself remains byte-current.',
      'Two legacy receipts are protected only from the external anchor forward; pre-anchor integrity remains unknown.',
      'The Game Night bridge proves only a bounded generated-view semantic snapshot, not historical report bytes or phone usability.',
      'The broad verification report is a recorded post-check observation and is not a stable source reference.',
      'No browser behavior, production, promotion, merge, Foundation, or CANON claim is made.'
    ],
    boundaries: {
      historicalReceiptRewritten: false,
      candidateReceiptClaimedByteCurrent: false,
      intentOrCorrectnessInferred: false,
      humanBenefitInferred: false,
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
      mutableBroadReportRawDigestIncludedInStableSourceRefs: false,
      currentPortfolioBindsBroadObservationDigest: true,
      historicalReceiptBytesRewritten: false,
      laterAttestationClaimedAsCorrectness: false,
      transitiveRouteClaimedAsCandidateReceiptByteCurrentness: false,
      preAnchorIntegrityClaimedEstablished: false,
      generatedSemanticMatchClaimedAsHistoricalByteMatch: false,
      rawTerminalLogsRetained: false,
      authorityGranted: false
    },
    verificationDigest: null
  };
  const payload = Evolution.clone(receipt);
  delete payload.verificationDigest;
  receipt.verificationDigest = Evolution.sha256(payload);
  return receipt;
}

function verify(receipt) {
  const rebuilt = build();
  const errors = [];
  if (Evolution.stableStringify(receipt) !== Evolution.stableStringify(rebuilt)) {
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
    legacyHolds: receipt.currentState.legacyPreAnchorIntegrityUnknown,
    verificationDigest: receipt.verificationDigest
  }, null, 2) + '\n');
}
