#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const Growth = require('../../../shared/grounded-growth-outcomes/grounded-growth-outcomes');
const Build = require('./build-portable-verification-growth');
const PriorVerification = require('../2026-08-19-grounded-growth-current-state-portability/build-verification-receipt');

const ROOT = path.resolve(__dirname, '../../..');
const OUTPUT = path.join(__dirname, 'VERIFICATION_RECEIPT.json');
const LANE = 'docs/steward-runs/2026-08-19-portable-verification-grounded-growth';
const SOURCE_FILES = [
  LANE + '/CAPABILITY_REQUIREMENTS.json',
  LANE + '/CAPABILITY_INVENTORY_BEFORE.json',
  LANE + '/CAPABILITY_INVENTORY_AFTER.json',
  LANE + '/CAPABILITY_GAP_BEFORE.json',
  LANE + '/CAPABILITY_GAP_AFTER.json',
  LANE + '/EVIDENCE_ROUTES.md',
  LANE + '/PORTABLE_VERIFICATION_CANDIDATE.json',
  LANE + '/PORTABLE_CAPABILITY_PROOF.json',
  LANE + '/VERIFIED_CAPABILITY_CYCLE.json',
  LANE + '/GROUNDED_GROWTH_OUTCOME.json',
  LANE + '/CURRENT_PORTFOLIO.json',
  LANE + '/CURRENT_STATE_RECEIPT.json',
  LANE + '/CURRENT_SUMMARY.json',
  LANE + '/CHECK_RESULTS.json',
  LANE + '/README.md',
  LANE + '/build-portable-verification-growth.js',
  LANE + '/run-verification-checks.js',
  LANE + '/selftest.js',
  LANE + '/build-verification-receipt.js',
  LANE + '/verification-selftest.js',
  'shared/verified-capability-loop/verified-capability-loop.js',
  'shared/grounded-growth-outcomes/grounded-growth-outcomes.js',
  'shared/grounded-growth-current-state/grounded-growth-current-state.js',
  'shared/grounded-growth-current-state/verify-current-state.js',
  'docs/steward-runs/2026-08-19-verification-evolution-grounded-growth/CURRENT_PORTFOLIO.json',
  'docs/steward-runs/2026-08-19-grounded-growth-participation-frontier/CURRENT_PARTICIPATION_FRONTIER_RECEIPT.json',
  'docs/steward-runs/2026-08-19-grounded-growth-current-state-portability/VERIFICATION_RECEIPT.json'
];

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), 'utf8'));
}

function sourceRef(relativePath) {
  return { path: relativePath.replace(/\\/g, '/'), sha256: Growth.sha256(fs.readFileSync(path.join(ROOT, relativePath))) };
}

function diffPaths(left, right, prefix, output) {
  if (Growth.stableStringify(left) === Growth.stableStringify(right)) return output;
  if (!left || !right || typeof left !== 'object' || typeof right !== 'object' || Array.isArray(left) !== Array.isArray(right)) {
    output.push(prefix);
    return output;
  }
  Array.from(new Set([...Object.keys(left), ...Object.keys(right)])).sort()
    .forEach((key) => diffPaths(left[key], right[key], prefix ? prefix + '.' + key : key, output));
  return output;
}

function selfDigestValid(receipt, field) {
  const payload = JSON.parse(JSON.stringify(receipt));
  const declared = payload[field];
  delete payload[field];
  return declared === Growth.sha256(payload);
}

function build() {
  const current = Build.checkRecorded();
  const checks = readJson(LANE + '/CHECK_RESULTS.json');
  if (!selfDigestValid(checks, 'resultsDigest') || checks.summary.failed !== 0 || checks.summary.requiredPassed !== 10) {
    throw new Error('current check results are absent, invalid, or failing');
  }
  const broadPath = 'exports/verification-spine-report.json';
  const broad = readJson(broadPath);
  const historicalPrior = readJson('docs/steward-runs/2026-08-19-grounded-growth-current-state-portability/VERIFICATION_RECEIPT.json');
  const rebuiltPrior = PriorVerification.build();
  const priorDiff = diffPaths(historicalPrior, rebuiltPrior, '', []);
  const previousState = readJson('docs/steward-runs/2026-08-19-grounded-growth-current-convergence/CURRENT_STATE_RECEIPT.json');
  const receipt = {
    schema: 'axm.portable-verification-grounded-growth-verification/v1',
    version: '0.1.0',
    verificationId: 'verification:portable-verification-grounded-growth-20260819',
    generatedAt: checks.checkedAt,
    status: 'TEST',
    result: 'PASS_WITH_DECLARED_LIMITS',
    capability: {
      id: current.candidate.capabilityId,
      candidateDigest: current.candidate.candidateDigest,
      proofVerdict: current.proof.verdict,
      cycleState: current.cycle.state,
      improvementClaim: current.cycle.improvementClaim,
      stewardDecision: current.cycle.stewardDecision,
      availability: current.cycle.availability
    },
    outcome: {
      id: current.outcome.outcomeId,
      state: current.outcome.state,
      digest: current.outcome.receiptDigest,
      sharedSystemVerdict: current.outcome.claims.find((claim) => claim.beneficiary === 'SHARED_SYSTEM').admittedVerdict,
      aiWorkflowVerdict: current.outcome.claims.find((claim) => claim.beneficiary === 'AI_WORKFLOW').admittedVerdict,
      humanVerdict: current.outcome.claims.find((claim) => claim.beneficiary === 'HUMAN').admittedVerdict,
      modelLearningClaimed: current.outcome.truth.modelWeightTrainingClaimed
    },
    portfolio: {
      priorOutcomes: 8,
      outcomes: current.portfolio.summary.outcomeCount,
      priorCapabilityChains: 4,
      capabilityChains: current.portfolio.summary.capabilityCount,
      priorOutcomeBytesPreserved: current.summary.truth.priorOutcomeBytesPreserved,
      digest: current.portfolio.portfolioDigest
    },
    currentState: {
      previousReceiptRef: { id: previousState.receiptId, schema: previousState.schema, sha256: previousState.receiptDigest },
      successorReceiptRef: { id: current.currentState.receiptId, schema: current.currentState.schema, sha256: current.currentState.receiptDigest },
      state: current.currentState.state,
      appendedSinceParticipationBase: current.currentState.portfolioEvolution.appendedOutcomeCount,
      sharedSystemPass: current.currentState.currentEvidence.sharedSystemPass,
      aiWorkflowPass: current.currentState.currentEvidence.aiWorkflowPass,
      humanPass: current.currentState.currentEvidence.humanPass,
      humanNotRun: current.currentState.currentEvidence.humanNotRun,
      participationBinding: current.currentState.participationBinding.state,
      affectedProtectedCapabilities: current.currentState.participationBinding.affectedProtectedCapabilityIds,
      reviewableActionCount: current.currentState.decision.reviewableActionCount,
      autonomousActionCount: current.currentState.decision.autonomousActionCount
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
      receipts: broad.receipt_count,
      atomicClaims: broad.claim_count,
      warnings: Array.isArray(broad.warnings) ? broad.warnings.length : null,
      failures: Array.isArray(broad.failures) ? broad.failures.length : null,
      holds: Array.isArray(broad.holds) ? broad.holds.length : null,
      invalidReceipts: Array.isArray(broad.invalid_receipts) ? broad.invalid_receipts.length : null
    },
    historicalEvolution: {
      priorPortabilityVerificationDigest: historicalPrior.verificationDigest,
      exactAgainstCurrentMutableView: PriorVerification.verify(historicalPrior).pass ? 'PASS' : 'EXPECTED_FAIL',
      changedFields: priorDiff,
      classification: Growth.stableStringify(priorDiff) === Growth.stableStringify(['broadVerification.source.sha256', 'verificationDigest'])
        ? 'RECOGNIZED_MUTABLE_DERIVED_VIEW_DRIFT'
        : priorDiff.length === 0 ? 'CURRENT_EXACT' : 'UNCLASSIFIED_DRIFT',
      historicalReceiptRewritten: false,
      previousCurrentStateReceiptRewritten: false,
      successorIsForwardExtension: true
    },
    capabilityGap: {
      before: current.gaps.before.overall,
      after: current.gaps.after.overall,
      requiredMissingAfter: current.gaps.after.missingCapabilities.length,
      nativeHumanBenefit: current.gaps.after.requirements.find((item) => item.id === 'native-human-benefit').status,
      detachedSourceTruth: current.gaps.after.requirements.find((item) => item.id === 'detached-source-truth').status
    },
    browserVerification: {
      applicable: false,
      verdict: 'NOT_RUN',
      reason: 'No browser-rendered, interactive, controller, or visual surface changed.'
    },
    declaredLimits: [
      'The eleven representative cases were used to develop and test the guard; this is bounded workflow evidence, not an independently blinded or statistical benchmark.',
      'The outcome proves neither model learning, changed weights, provider performance, intelligence, nor broad generalization.',
      'Detached integrity still cannot authenticate coherent forged source references; native source truth remains UNKNOWN without the source graph.',
      'No voluntary human journey was run, so human benefit remains NOT_RUN.',
      'A verified candidate awaiting stewardship is not installed or governed availability.'
    ],
    boundaries: {
      sourceTruthClaimed: false,
      humanParticipationOccurred: false,
      humanBenefitEstablished: false,
      modelLearningClaimed: false,
      availabilityGranted: false,
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
  receipt.verificationDigest = Growth.sha256(payload);
  return receipt;
}

function verify(receipt) {
  try {
    return { pass: Growth.stableStringify(receipt) === Growth.stableStringify(build()), errors: [] };
  } catch (error) {
    return { pass: false, errors: [error.message] };
  }
}

if (require.main === module) {
  const receipt = build();
  if (process.argv.includes('--write')) fs.writeFileSync(OUTPUT, JSON.stringify(receipt, null, 2) + '\n');
  process.stdout.write(JSON.stringify({
    result: receipt.result,
    assertions: receipt.focusedAndAdjacent.explicitAssertions,
    required: receipt.requiredChecks.passed + '/' + receipt.requiredChecks.total,
    broad: receipt.broadVerification.verdict,
    warnings: receipt.broadVerification.warnings,
    currentState: receipt.currentState.successorReceiptRef.sha256,
    digest: receipt.verificationDigest
  }, null, 2) + '\n');
}

module.exports = { ROOT, OUTPUT, SOURCE_FILES, diffPaths, selfDigestValid, build, verify };
