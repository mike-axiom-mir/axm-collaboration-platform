#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const Growth = require('../../../shared/grounded-growth-outcomes/grounded-growth-outcomes');
const Build = require('./build-signal-lineage-growth');
const PriorVerification = require('../2026-08-19-portable-verification-grounded-growth/build-verification-receipt');

const ROOT = path.resolve(__dirname, '../../..');
const OUTPUT = path.join(__dirname, 'VERIFICATION_RECEIPT.json');
const LANE = Build.LANE;
const SOURCE_FILES = Array.from(new Set([
  LANE + '/CAPABILITY_REQUIREMENTS.json',
  LANE + '/CAPABILITY_INVENTORY_BEFORE.json',
  LANE + '/CAPABILITY_INVENTORY_AFTER.json',
  LANE + '/CAPABILITY_GAP_BEFORE.json',
  LANE + '/CAPABILITY_GAP_AFTER.json',
  LANE + '/EVIDENCE_ROUTES.md',
  LANE + '/CURRENT_SIGNAL_LINEAGE_RECEIPT.json',
  LANE + '/SIGNAL_LINEAGE_CASES.json',
  LANE + '/SIGNAL_LINEAGE_AI_WORKFLOW_EVALUATION.json',
  LANE + '/SIGNAL_LINEAGE_CANDIDATE.json',
  LANE + '/SIGNAL_LINEAGE_PROOF.json',
  LANE + '/VERIFIED_CAPABILITY_CYCLE.json',
  LANE + '/GROUNDED_GROWTH_OUTCOME.json',
  LANE + '/CURRENT_PORTFOLIO.json',
  LANE + '/CURRENT_STATE_RECEIPT.json',
  LANE + '/CURRENT_SUMMARY.json',
  LANE + '/CHECK_RESULTS.json',
  LANE + '/README.md',
  LANE + '/build-signal-lineage-growth.js',
  LANE + '/run-verification-checks.js',
  LANE + '/selftest.js',
  LANE + '/build-verification-receipt.js',
  LANE + '/verification-selftest.js',
  ...Build.CANDIDATE_SOURCE_FILES,
  ...Build.EVIDENCE_SOURCE_DEFS.map((definition) => definition[0]),
  Build.DISPOSITION_PATH,
  Build.PRIOR_PORTFOLIO,
  Build.PRIOR_CURRENT_STATE,
  Build.PARTICIPATION_RECEIPT,
  'shared/grounded-growth-outcomes/grounded-growth-outcomes.js',
  'shared/grounded-growth-current-state/grounded-growth-current-state.js',
  'shared/grounded-growth-knowledge-frontier/grounded-growth-knowledge-frontier.js',
  'shared/research-contribution-intake/research-contribution-intake.js',
  'docs/steward-runs/2026-08-19-portable-verification-grounded-growth/VERIFICATION_RECEIPT.json'
]));

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), 'utf8'));
}

function sourceRef(relativePath) {
  return {
    path: relativePath.replace(/\\/g, '/'),
    sha256: Growth.sha256(fs.readFileSync(path.join(ROOT, relativePath)))
  };
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

function claimFor(outcome, beneficiary) {
  return outcome.claims.find((claim) => claim.beneficiary === beneficiary);
}

function requirementStatus(gap, id) {
  const requirement = gap.requirements.find((item) => item.id === id);
  if (!requirement) throw new Error('missing capability-gap requirement ' + id);
  return requirement.status;
}

function build() {
  const current = Build.checkRecorded();
  const checks = readJson(LANE + '/CHECK_RESULTS.json');
  if (!selfDigestValid(checks, 'resultsDigest') || checks.summary.failed !== 0 ||
      checks.summary.focusedPassed !== 15 || checks.summary.requiredPassed !== 10) {
    throw new Error('current check results are absent, invalid, incomplete, or failing');
  }

  const broadPath = 'exports/verification-spine-report.json';
  const broad = readJson(broadPath);
  const historicalPrior = readJson('docs/steward-runs/2026-08-19-portable-verification-grounded-growth/VERIFICATION_RECEIPT.json');
  const rebuiltPrior = PriorVerification.build();
  const priorDiff = diffPaths(historicalPrior, rebuiltPrior, '', []);
  const previousState = readJson(Build.PRIOR_CURRENT_STATE);
  const sharedClaim = claimFor(current.outcome, 'SHARED_SYSTEM');
  const aiClaim = claimFor(current.outcome, 'AI_WORKFLOW');
  const humanClaim = claimFor(current.outcome, 'HUMAN');

  const receipt = {
    schema: 'axm.grounded-growth-signal-lineage-verification/v1',
    version: '0.1.0',
    verificationId: 'verification:grounded-growth-signal-lineage-20260820',
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
    lineage: {
      state: current.lineage.state,
      dispositionDigest: current.lineage.sourceRefs.disposition.sha256,
      acceptedSignals: current.lineage.coverage.acceptedSignals,
      signalLinks: current.lineage.coverage.signalLinks,
      currentTechnicalSignals: current.lineage.coverage.currentTechnicalSignals,
      waitingVoluntaryHumanSignals: current.lineage.coverage.waitingVoluntaryHumanSignals,
      proposalLinks: current.lineage.coverage.proposalLinks,
      deferredProposals: current.lineage.coverage.deferredProposals,
      autonomousActionCount: current.lineage.decision.autonomousActionCount,
      reviewableActionCount: current.lineage.decision.reviewableActionCount,
      deferredSignalLedgerImplemented: current.lineage.truth.deferredSignalLedgerImplemented,
      receiptDigest: current.lineage.receiptDigest
    },
    aiWorkflowEvaluation: {
      verdict: current.evaluation.verdict,
      proofSurface: current.evaluation.proofSurface,
      baselinePolicy: current.evaluation.baseline.policyId,
      baselineCorrect: current.evaluation.baseline.correctDecisions,
      baselineUnsafe: current.evaluation.baseline.unsupportedOrUnsafeDecisions,
      candidatePolicy: current.evaluation.outcome.policyId,
      candidateCorrect: current.evaluation.outcome.correctDecisions,
      candidateUnsafe: current.evaluation.outcome.unsupportedOrUnsafeDecisions,
      totalCases: current.evaluation.outcome.totalDecisions,
      independentlyHeldOut: false,
      modelInvoked: current.evaluation.truth.modelInvoked,
      modelWeightsChanged: current.evaluation.truth.modelWeightsChanged,
      receiptDigest: current.evaluation.receiptDigest
    },
    outcome: {
      id: current.outcome.outcomeId,
      state: current.outcome.state,
      digest: current.outcome.receiptDigest,
      sharedSystemVerdict: sharedClaim.admittedVerdict,
      aiWorkflowVerdict: aiClaim.admittedVerdict,
      humanVerdict: humanClaim.admittedVerdict,
      modelLearningClaimed: current.outcome.truth.modelWeightTrainingClaimed
    },
    portfolio: {
      priorOutcomes: 9,
      outcomes: current.portfolio.summary.outcomeCount,
      priorCapabilityChains: 5,
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
      total: checks.summary.focusedTotal,
      passed: checks.summary.focusedPassed,
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
      priorVerificationDigest: historicalPrior.verificationDigest,
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
      nativeHumanBenefit: requirementStatus(current.gaps.after, 'native-human-benefit'),
      independentHeldOutEvaluation: requirementStatus(current.gaps.after, 'independent-held-out-evaluation'),
      detachedSourceTruth: requirementStatus(current.gaps.after, 'detached-source-truth')
    },
    browserVerification: {
      applicable: false,
      verdict: 'NOT_RUN',
      reason: 'No browser-rendered, interactive, controller, or visual surface changed.'
    },
    declaredLimits: [
      'The eight cases were visible while the exact guard was developed; this is bounded workflow evidence, not an independently blinded or statistical benchmark.',
      'No language model was invoked, no model weights changed, and no intelligence or broad-generalization claim is made.',
      'Detached integrity cannot authenticate coherent forged source references; detached source truth and currentness remain UNKNOWN without the native source graph.',
      'No voluntary representative human comparison ran, so human benefit remains NOT_RUN.',
      'The deferred human-facing signal-link ledger remains deferred and was not implemented by this technical receipt.',
      'A verified candidate awaiting stewardship is not installed or governed availability.'
    ],
    boundaries: {
      detachedSourceTruthClaimed: false,
      humanParticipationOccurred: false,
      humanBenefitEstablished: false,
      modelLearningClaimed: false,
      broadGeneralizationClaimed: false,
      deferredProposalImplemented: false,
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
    lineage: receipt.lineage.signalLinks + '+' + receipt.lineage.proposalLinks,
    evaluation: receipt.aiWorkflowEvaluation.candidateCorrect + '/' + receipt.aiWorkflowEvaluation.totalCases,
    assertions: receipt.focusedAndAdjacent.explicitAssertions,
    required: receipt.requiredChecks.passed + '/' + receipt.requiredChecks.total,
    broad: receipt.broadVerification.verdict,
    history: receipt.historicalEvolution.classification,
    currentState: receipt.currentState.successorReceiptRef.sha256,
    digest: receipt.verificationDigest
  }, null, 2) + '\n');
}

module.exports = { ROOT, OUTPUT, SOURCE_FILES, diffPaths, selfDigestValid, build, verify };
