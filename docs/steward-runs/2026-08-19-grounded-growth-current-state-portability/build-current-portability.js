#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const Current = require('../../../shared/grounded-growth-current-state/grounded-growth-current-state');
const Gap = require('../../../shared/ai-native-hands/capability-gap-hand');
const PreviousVerification = require('../2026-08-19-grounded-growth-current-convergence/build-verification-receipt');
const CurrentConvergence = require('../2026-08-19-grounded-growth-current-convergence/build-current-convergence');

const ROOT = path.resolve(__dirname, '../../..');
const CASES_PATH = path.join(__dirname, 'PORTABLE_VERIFICATION_CASES.json');
const REQUIREMENTS_PATH = path.join(__dirname, 'CAPABILITY_REQUIREMENTS.json');
const BEFORE_PATH = path.join(__dirname, 'CAPABILITY_INVENTORY_BEFORE.json');
const AFTER_PATH = path.join(__dirname, 'CAPABILITY_INVENTORY_AFTER.json');
const EVALUATION_PATH = path.join(__dirname, 'PORTABLE_AI_WORKFLOW_EVALUATION.json');
const GAP_BEFORE_PATH = path.join(__dirname, 'CAPABILITY_GAP_BEFORE.json');
const GAP_AFTER_PATH = path.join(__dirname, 'CAPABILITY_GAP_AFTER.json');
const PRIOR_EVOLUTION_PATH = path.join(__dirname, 'PRIOR_RECEIPT_EVOLUTION.json');

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function redigest(receipt) {
  const result = clone(receipt);
  delete result.receiptDigest;
  result.receiptDigest = Current.sha256(result);
  return result;
}

function mutate(source, name) {
  const receipt = clone(source);
  switch (name) {
    case 'none':
      return receipt;
    case 'raw-human-pass':
      receipt.currentEvidence.humanPass = 1;
      return receipt;
    case 'human-pass-count':
      receipt.currentEvidence.humanPass = 1;
      return redigest(receipt);
    case 'human-evidence-presence':
      receipt.participationBinding.humanEvidencePresent = true;
      return redigest(receipt);
    case 'autonomous-action':
      receipt.decision.autonomousActionCount = 1;
      return redigest(receipt);
    case 'automatic-canon':
      receipt.truth.automaticCanon = true;
      return redigest(receipt);
    case 'rebind-without-affected':
      receipt.state = 'HOLD_PARTICIPATION_REBIND_REQUIRED';
      receipt.participationBinding.state = 'REQUIRES_REBIND';
      receipt.participationBinding.optionalReviewCandidates = 0;
      receipt.decision.reviewableActionCount = 0;
      receipt.decision.currentBestAction = 'HOLD_FOR_PARTICIPATION_REBIND';
      return redigest(receipt);
    case 'outcome-count':
      receipt.portfolioEvolution.currentOutcomeCount += 1;
      return redigest(receipt);
    case 'unknown-nested-field':
      receipt.decision.uncontracted = true;
      return redigest(receipt);
    case 'forged-source-references':
      receipt.sourceRefs.participationFrontier.sha256 = 'sha256:' + '1'.repeat(64);
      receipt.sourceRefs.participationPortfolio.sha256 = 'sha256:' + '2'.repeat(64);
      receipt.sourceRefs.latestPortfolio.sha256 = 'sha256:' + '3'.repeat(64);
      return redigest(receipt);
    case 'coherent-human-benefit-substitution':
      receipt.currentEvidence.effectiveBeneficiaryVerdicts['HUMAN:PASS'] = 1;
      receipt.currentEvidence.humanPass = 1;
      receipt.participationBinding.humanEvidencePresent = true;
      receipt.participationBinding.humanBenefitEstablished = true;
      receipt.truth.humanBenefitClaimed = true;
      return redigest(receipt);
    default:
      throw new Error('unsupported mutation: ' + name);
  }
}

function digestOnly(receipt) {
  if (!receipt || typeof receipt !== 'object' || typeof receipt.receiptDigest !== 'string') return false;
  const payload = clone(receipt);
  delete payload.receiptDigest;
  return Current.sha256(payload) === receipt.receiptDigest;
}

function safeDecision(inspection) {
  return inspection.pass ? 'HOLD_SOURCE_TRUTH_UNKNOWN' : 'REJECT_PORTABLE_INTEGRITY';
}

function buildEvaluation() {
  const specification = readJson(CASES_PATH);
  const sourcePath = path.join(ROOT, specification.sourceReceipt);
  const source = readJson(sourcePath);
  const results = specification.cases.map((testCase) => {
    const candidate = mutate(source, testCase.mutation);
    const naivePass = digestOnly(candidate);
    const detached = Current.inspectDetached(candidate);
    const decision = safeDecision(detached);
    const issueCodes = detached.issues.map((item) => item.code);
    const expectationPass = detached.pass === testCase.expectedPortablePass
      && decision === testCase.expectedDecision
      && (testCase.expectedIssueCode === null || issueCodes.includes(testCase.expectedIssueCode));
    return {
      id: testCase.id,
      mutation: testCase.mutation,
      naiveDigestOnlyPass: naivePass,
      detachedPortablePass: detached.pass,
      detachedVerdict: detached.verdict,
      sourceTruth: detached.sourceVerification.sourceTruth,
      safeDecision: decision,
      issueCodes,
      recomputedTamperCaughtBeyondDigest: naivePass && !detached.pass,
      semanticSourceSubstitution: testCase.semanticSourceSubstitution,
      sourceTruthLimitationPreserved: testCase.semanticSourceSubstitution
        ? detached.pass && detached.sourceVerification.sourceTruth === 'UNKNOWN' && decision === 'HOLD_SOURCE_TRUTH_UNKNOWN'
        : null,
      expectationPass
    };
  });
  const summary = {
    caseCount: results.length,
    expectationPass: results.filter((item) => item.expectationPass).length,
    expectationFail: results.filter((item) => !item.expectationPass).length,
    digestOnlyPass: results.filter((item) => item.naiveDigestOnlyPass).length,
    detachedPortablePass: results.filter((item) => item.detachedPortablePass).length,
    recomputedTamperCaughtBeyondDigest: results.filter((item) => item.recomputedTamperCaughtBeyondDigest).length,
    sourceTruthUnknownHolds: results.filter((item) => item.safeDecision === 'HOLD_SOURCE_TRUTH_UNKNOWN').length,
    semanticSubstitutionLimitsPreserved: results.filter((item) => item.sourceTruthLimitationPreserved === true).length,
    humanPass: 0,
    humanNotRun: 1
  };
  return {
    schema: 'axm.grounded-growth-current-state-portability-evaluation/v1',
    version: '0.1.0',
    status: 'TEST',
    evaluationId: 'grounded-growth-current-state-portability-20260819',
    sourceReceiptRef: {
      id: source.receiptId,
      schema: source.schema,
      sha256: source.receiptDigest
    },
    comparedApproaches: {
      naiveDigestOnly: 'Rebuild only receiptDigest; makes no structural, coherence, authority, or source-truth distinction.',
      detachedGuard: 'Check strict structure, self-digest, internal coherence, authority boundaries, and preserve source truth/currentness as UNKNOWN.'
    },
    results,
    summary,
    verdict: summary.expectationFail === 0
      ? 'PORTABLE_GUARD_BETTER_WITH_EXPLICIT_SOURCE_TRUTH_LIMIT'
      : 'PORTABLE_GUARD_EVALUATION_FAILED',
    authority: {
      writesDuringInspection: false,
      networkDuringInspection: false,
      participation: false,
      promotion: false,
      merge: false,
      canon: false,
      foundationMutation: false
    }
  };
}

function gapReports() {
  const requirements = readJson(REQUIREMENTS_PATH).requirements;
  return {
    before: Gap.compare(requirements, readJson(BEFORE_PATH).capabilities),
    after: Gap.compare(requirements, readJson(AFTER_PATH).capabilities)
  };
}

function sourceRef(relativePath) {
  return {
    path: relativePath.replace(/\\/g, '/'),
    sha256: Current.sha256(fs.readFileSync(path.join(ROOT, relativePath)))
  };
}

function buildPriorEvolution() {
  const priorPath = 'docs/steward-runs/2026-08-19-grounded-growth-current-convergence/VERIFICATION_RECEIPT.json';
  const prior = readJson(path.join(ROOT, priorPath));
  const convergence = CurrentConvergence.verifyRecorded();
  const changedSources = prior.sourceRefs.map((historical) => {
    const current = sourceRef(historical.path);
    return current.sha256 === historical.sha256 ? null : {
      path: historical.path,
      historicalSha256: historical.sha256,
      currentSha256: current.sha256
    };
  }).filter(Boolean);
  return {
    schema: 'axm.grounded-growth-current-state-prior-verification-evolution/v1',
    version: '0.1.0',
    status: 'TEST',
    historicalVerificationRef: {
      path: priorPath,
      sha256: sourceRef(priorPath).sha256,
      verificationDigest: prior.verificationDigest
    },
    historicalExactVerificationAgainstCurrentSources: PreviousVerification.verify(prior).pass ? 'PASS' : 'EXPECTED_FAIL_SOURCE_EVOLUTION',
    currentBehaviorReceipt: {
      id: convergence.receipt.receiptId,
      schema: convergence.receipt.schema,
      sha256: convergence.receipt.receiptDigest,
      matchesHistoricalBehaviorReceipt: convergence.receipt.receiptDigest === prior.currentState.receiptRef.sha256,
      exactRebuild: 'PASS'
    },
    changedTrackedSources: changedSources,
    addedPortabilitySource: sourceRef('shared/grounded-growth-current-state/verify-current-state.js'),
    decision: {
      classification: 'LATER_PORTABILITY_HARDENING_SOURCE_EVOLUTION',
      historicalReceiptRewritten: false,
      behavioralReceiptChanged: convergence.receipt.receiptDigest !== prior.currentState.receiptRef.sha256,
      currentBestAction: 'PRESERVE_HISTORICAL_RECEIPT_AND_USE_THIS_LATER_AUDIT'
    },
    truth: {
      sourceEvolutionClaimedAsHistoricalByteEquality: false,
      unchangedBehaviorReceiptClaimedAsAllBehaviorEquivalent: false,
      portableIntegrityClaimedAsSourceTruth: false,
      regressionAbsenceClaimedBeyondExecutedChecks: false,
      humanBenefitClaimed: false,
      authorityGranted: false,
      canonized: false
    }
  };
}

function current() {
  const gaps = gapReports();
  return {
    evaluation: buildEvaluation(),
    gapBefore: gaps.before,
    gapAfter: gaps.after,
    priorEvolution: buildPriorEvolution()
  };
}

function writeJson(file, value) {
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n');
}

function checkRecorded(value, file, label) {
  const recorded = readJson(file);
  if (Current.stableStringify(recorded) !== Current.stableStringify(value)) throw new Error(label + ' differs from recorded artifact');
}

if (require.main === module) {
  const result = current();
  if (process.argv.includes('--write')) {
    writeJson(EVALUATION_PATH, result.evaluation);
    writeJson(GAP_BEFORE_PATH, result.gapBefore);
    writeJson(GAP_AFTER_PATH, result.gapAfter);
    writeJson(PRIOR_EVOLUTION_PATH, result.priorEvolution);
  }
  if (process.argv.includes('--check-recorded')) {
    checkRecorded(result.evaluation, EVALUATION_PATH, 'portable evaluation');
    checkRecorded(result.gapBefore, GAP_BEFORE_PATH, 'gap before');
    checkRecorded(result.gapAfter, GAP_AFTER_PATH, 'gap after');
    checkRecorded(result.priorEvolution, PRIOR_EVOLUTION_PATH, 'prior receipt evolution');
  }
  process.stdout.write(JSON.stringify({
    verdict: result.evaluation.verdict,
    cases: result.evaluation.summary.caseCount,
    expectations: result.evaluation.summary.expectationPass,
    caughtBeyondDigest: result.evaluation.summary.recomputedTamperCaughtBeyondDigest,
    sourceTruthHolds: result.evaluation.summary.sourceTruthUnknownHolds,
    before: result.gapBefore.overall,
    after: result.gapAfter.overall
  }, null, 2) + '\n');
}

module.exports = { ROOT, readJson, mutate, digestOnly, buildEvaluation, gapReports, buildPriorEvolution, current };
