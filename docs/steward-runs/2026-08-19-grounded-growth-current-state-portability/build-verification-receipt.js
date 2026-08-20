#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const Current = require('../../../shared/grounded-growth-current-state/grounded-growth-current-state');
const Audit = require('./build-current-portability');
const EvolutionVerification = require('../2026-08-19-verification-evolution-grounded-growth/build-verification-receipt');

const ROOT = path.resolve(__dirname, '../../..');
const OUTPUT = path.join(__dirname, 'VERIFICATION_RECEIPT.json');
const SOURCE_FILES = [
  'shared/grounded-growth-current-state/grounded-growth-current-state.js',
  'shared/grounded-growth-current-state/grounded-growth-current-state-receipt.schema.json',
  'shared/grounded-growth-current-state/module.contract.json',
  'shared/grounded-growth-current-state/README.md',
  'shared/grounded-growth-current-state/selftest.js',
  'shared/grounded-growth-current-state/verify-current-state.js',
  'docs/steward-runs/2026-08-19-grounded-growth-current-state-portability/CAPABILITY_REQUIREMENTS.json',
  'docs/steward-runs/2026-08-19-grounded-growth-current-state-portability/CAPABILITY_INVENTORY_BEFORE.json',
  'docs/steward-runs/2026-08-19-grounded-growth-current-state-portability/CAPABILITY_INVENTORY_AFTER.json',
  'docs/steward-runs/2026-08-19-grounded-growth-current-state-portability/CAPABILITY_GAP_BEFORE.json',
  'docs/steward-runs/2026-08-19-grounded-growth-current-state-portability/CAPABILITY_GAP_AFTER.json',
  'docs/steward-runs/2026-08-19-grounded-growth-current-state-portability/EVIDENCE_ROUTES.md',
  'docs/steward-runs/2026-08-19-grounded-growth-current-state-portability/PORTABLE_VERIFICATION_CASES.json',
  'docs/steward-runs/2026-08-19-grounded-growth-current-state-portability/PORTABLE_AI_WORKFLOW_EVALUATION.json',
  'docs/steward-runs/2026-08-19-grounded-growth-current-state-portability/PRIOR_RECEIPT_EVOLUTION.json',
  'docs/steward-runs/2026-08-19-grounded-growth-current-state-portability/CHECK_RESULTS.json',
  'docs/steward-runs/2026-08-19-grounded-growth-current-state-portability/README.md',
  'docs/steward-runs/2026-08-19-grounded-growth-current-state-portability/build-current-portability.js',
  'docs/steward-runs/2026-08-19-grounded-growth-current-state-portability/run-verification-checks.js',
  'docs/steward-runs/2026-08-19-grounded-growth-current-state-portability/selftest.js',
  'docs/steward-runs/2026-08-19-grounded-growth-current-state-portability/build-verification-receipt.js',
  'docs/steward-runs/2026-08-19-grounded-growth-current-state-portability/verification-selftest.js',
  'docs/steward-runs/2026-08-19-grounded-growth-current-convergence/CURRENT_STATE_RECEIPT.json'
];

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), 'utf8'));
}

function sourceRef(relativePath) {
  return {
    path: relativePath.replace(/\\/g, '/'),
    sha256: Current.sha256(fs.readFileSync(path.join(ROOT, relativePath)))
  };
}

function diffPaths(left, right, prefix, output) {
  if (Current.stableStringify(left) === Current.stableStringify(right)) return output;
  if (!left || !right || typeof left !== 'object' || typeof right !== 'object' || Array.isArray(left) !== Array.isArray(right)) {
    output.push(prefix);
    return output;
  }
  const keys = Array.from(new Set([...Object.keys(left), ...Object.keys(right)])).sort();
  keys.forEach((key) => diffPaths(left[key], right[key], prefix ? prefix + '.' + key : key, output));
  return output;
}

function verifyResultsDigest(receipt) {
  const payload = JSON.parse(JSON.stringify(receipt));
  const declared = payload.resultsDigest;
  delete payload.resultsDigest;
  return declared === Current.sha256(payload);
}

function build() {
  const audit = Audit.current();
  const checks = readJson('docs/steward-runs/2026-08-19-grounded-growth-current-state-portability/CHECK_RESULTS.json');
  if (!verifyResultsDigest(checks) || checks.summary.failed !== 0 || checks.summary.requiredPassed !== 10) {
    throw new Error('verification checks are absent, invalid, or not all passing');
  }
  const broadPath = 'exports/verification-spine-report.json';
  const broad = readJson(broadPath);
  const historicalEvolution = readJson('docs/steward-runs/2026-08-19-verification-evolution-grounded-growth/VERIFICATION_RECEIPT.json');
  const currentEvolution = EvolutionVerification.build();
  const evolutionDiff = diffPaths(historicalEvolution, currentEvolution, '', []);
  const receipt = {
    schema: 'axm.grounded-growth-current-state-portability-verification/v1',
    version: '0.1.0',
    verificationId: 'verification:grounded-growth-current-state-portability-20260819',
    generatedAt: checks.checkedAt,
    status: 'TEST',
    result: 'PASS_WITH_DECLARED_LIMITS',
    increment: {
      currentStateReceiptDigest: audit.priorEvolution.currentBehaviorReceipt.sha256,
      currentStateReceiptUnchanged: audit.priorEvolution.currentBehaviorReceipt.matchesHistoricalBehaviorReceipt,
      detachedEvaluationVerdict: audit.evaluation.verdict,
      cases: audit.evaluation.summary.caseCount,
      casesMatchingExpectation: audit.evaluation.summary.expectationPass,
      recomputedTamperCaughtBeyondDigest: audit.evaluation.summary.recomputedTamperCaughtBeyondDigest,
      coherentPortablePassesHeldForSourceTruth: audit.evaluation.summary.sourceTruthUnknownHolds,
      sourceTruthWithoutSources: 'UNKNOWN',
      humanPass: 0,
      humanNotRun: 1
    },
    focusedAndAdjacent: {
      total: checks.checks.filter((item) => item.phase === 'FOCUSED_AND_ADJACENT').length,
      passed: checks.checks.filter((item) => item.phase === 'FOCUSED_AND_ADJACENT' && item.exitCode === 0).length,
      failed: checks.checks.filter((item) => item.phase === 'FOCUSED_AND_ADJACENT' && item.exitCode !== 0).length,
      explicitAssertions: checks.summary.explicitAssertions,
      checks: checks.checks.filter((item) => item.phase === 'FOCUSED_AND_ADJACENT')
    },
    requiredChecks: {
      total: checks.summary.requiredTotal,
      passed: checks.summary.requiredPassed,
      failed: checks.checks.filter((item) => item.phase === 'REQUIRED' && item.exitCode !== 0).length,
      checks: checks.checks.filter((item) => item.phase === 'REQUIRED')
    },
    broadVerification: {
      binding: 'OBSERVED_AFTER_REQUIRED_CHECKS',
      source: sourceRef(broadPath),
      schema: broad.schema,
      profile: broad.profile && broad.profile.id,
      verdict: broad.verdict,
      receiptCount: broad.receipt_count,
      atomicClaims: broad.claim_count,
      warnings: Array.isArray(broad.warnings) ? broad.warnings.length : null,
      failures: Array.isArray(broad.failures) ? broad.failures.length : null,
      holds: Array.isArray(broad.holds) ? broad.holds.length : null,
      invalidReceipts: Array.isArray(broad.invalid_receipts) ? broad.invalid_receipts.length : null
    },
    historicalReceipts: {
      convergence: audit.priorEvolution,
      verificationEvolution: {
        historicalVerificationDigest: historicalEvolution.verificationDigest,
        exactAgainstCurrentMutableView: EvolutionVerification.verify(historicalEvolution).pass ? 'PASS' : 'EXPECTED_FAIL',
        changedFields: evolutionDiff,
        classification: Current.stableStringify(evolutionDiff) === Current.stableStringify(['broadVerification.observationSha256', 'verificationDigest'])
          ? 'RECOGNIZED_MUTABLE_DERIVED_VIEW_DRIFT'
          : 'UNCLASSIFIED_DRIFT',
        historicalReceiptRewritten: false
      }
    },
    capabilityGap: {
      before: audit.gapBefore.overall,
      after: audit.gapAfter.overall,
      requiredMissingAfter: audit.gapAfter.missingCapabilities.length,
      detachedSourceTruth: audit.gapAfter.requirements.find((item) => item.id === 'source-truth-without-sources').status,
      nativeHumanBenefit: audit.gapAfter.requirements.find((item) => item.id === 'native-human-benefit').status
    },
    browserVerification: {
      applicable: false,
      verdict: 'NOT_RUN',
      reason: 'No browser-rendered, interactive, controller, or visual surface changed.'
    },
    declaredLimits: [
      'Detached success proves strict receipt integrity, coherence, and authority boundaries; it does not authenticate referenced source bytes or currentness.',
      'A coherently forged or substituted receipt can pass detached integrity after recomputing its digest, so source truth remains UNKNOWN until native rebuild.',
      'The adversarial cases are deterministic representative fixtures, not a statistical, independent-model, or human-benefit evaluation.',
      'Two older verification receipts are preserved as historical evidence and their expected current-source drift is classified rather than rewritten.',
      'No browser behavior or human participation was tested because this increment changes neither surface.'
    ],
    boundaries: {
      sourceTruthClaimed: false,
      sourceCurrentnessClaimed: false,
      humanParticipationOccurred: false,
      humanBenefitEstablished: false,
      modelLearningClaimed: false,
      automaticAction: false,
      installed: false,
      permissionGranted: false,
      promoted: false,
      merged: false,
      canonized: false,
      foundationMutation: false,
      historicalReceiptRewritten: false
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
  try {
    return { pass: Current.stableStringify(receipt) === Current.stableStringify(build()), errors: [] };
  } catch (error) {
    return { pass: false, errors: [error.message] };
  }
}

if (require.main === module) {
  const receipt = build();
  if (process.argv.includes('--write')) fs.writeFileSync(OUTPUT, JSON.stringify(receipt, null, 2) + '\n');
  process.stdout.write(JSON.stringify({
    result: receipt.result,
    explicitAssertions: receipt.focusedAndAdjacent.explicitAssertions,
    required: receipt.requiredChecks.passed + '/' + receipt.requiredChecks.total,
    broad: receipt.broadVerification.verdict,
    warnings: receipt.broadVerification.warnings,
    digest: receipt.verificationDigest
  }, null, 2) + '\n');
}

module.exports = { ROOT, OUTPUT, SOURCE_FILES, diffPaths, verifyResultsDigest, build, verify };
