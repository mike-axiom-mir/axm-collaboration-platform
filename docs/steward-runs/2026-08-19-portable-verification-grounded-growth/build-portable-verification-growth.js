#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Gap = require('../../../shared/ai-native-hands/capability-gap-hand');
const Cycle = require('../../../shared/verified-capability-loop/verified-capability-loop');
const Growth = require('../../../shared/grounded-growth-outcomes/grounded-growth-outcomes');
const Current = require('../../../shared/grounded-growth-current-state/grounded-growth-current-state');
const Participation = require('../2026-08-19-grounded-growth-participation-frontier/build-current-participation-frontier');
const Portability = require('../2026-08-19-grounded-growth-current-state-portability/build-current-portability');

const ROOT = path.resolve(__dirname, '../../..');
const PORTABILITY_LANE = 'docs/steward-runs/2026-08-19-grounded-growth-current-state-portability';
const PRIOR_PORTFOLIO = 'docs/steward-runs/2026-08-19-verification-evolution-grounded-growth/CURRENT_PORTFOLIO.json';
const PRIOR_CURRENT_STATE = 'docs/steward-runs/2026-08-19-grounded-growth-current-convergence/CURRENT_STATE_RECEIPT.json';
const CANDIDATE_AT = '2026-08-19T21:50:00.000Z';
const PROOF_AT = '2026-08-19T21:51:00.000Z';
const CYCLE_AT = '2026-08-19T21:52:00.000Z';
const OUTCOME_AT = '2026-08-19T21:53:00.000Z';
const PORTFOLIO_AT = '2026-08-19T21:54:00.000Z';
const CURRENT_AT = '2026-08-19T21:55:00.000Z';

const CANDIDATE_SOURCES = [
  'shared/grounded-growth-current-state/grounded-growth-current-state.js',
  'shared/grounded-growth-current-state/grounded-growth-current-state-receipt.schema.json',
  'shared/grounded-growth-current-state/module.contract.json',
  'shared/grounded-growth-current-state/README.md',
  'shared/grounded-growth-current-state/selftest.js',
  'shared/grounded-growth-current-state/verify-current-state.js'
];
const CANDIDATE_EVIDENCE = [
  PORTABILITY_LANE + '/PORTABLE_VERIFICATION_CASES.json',
  PORTABILITY_LANE + '/PORTABLE_AI_WORKFLOW_EVALUATION.json',
  PORTABILITY_LANE + '/CHECK_RESULTS.json',
  PORTABILITY_LANE + '/VERIFICATION_RECEIPT.json'
];

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), 'utf8'));
}

function fileRef(relativePath, id, schema) {
  return {
    id,
    schema,
    sha256: Growth.sha256(fs.readFileSync(path.join(ROOT, relativePath)))
  };
}

function schemaFor(relativePath) {
  const extension = path.extname(relativePath).toLowerCase();
  if (extension === '.json') return 'application/json';
  if (extension === '.js') return 'text/javascript';
  return 'text/markdown';
}

function namedFileRef(relativePath) {
  return fileRef(
    relativePath,
    'file:' + relativePath.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase(),
    schemaFor(relativePath)
  );
}

function selfDigestValid(receipt, field) {
  const payload = clone(receipt);
  const declared = payload[field];
  delete payload[field];
  return declared === Growth.sha256(payload);
}

function candidateReference(candidate) {
  return { id: candidate.candidateId, schema: candidate.schema, sha256: candidate.candidateDigest };
}

function proofReference(proof) {
  return { id: proof.proofId, schema: proof.schema, sha256: proof.proofDigest };
}

function gapReports() {
  const requirements = readJson('docs/steward-runs/2026-08-19-portable-verification-grounded-growth/CAPABILITY_REQUIREMENTS.json').requirements;
  const before = readJson('docs/steward-runs/2026-08-19-portable-verification-grounded-growth/CAPABILITY_INVENTORY_BEFORE.json').capabilities;
  const after = readJson('docs/steward-runs/2026-08-19-portable-verification-grounded-growth/CAPABILITY_INVENTORY_AFTER.json').capabilities;
  return { before: Gap.compare(requirements, before), after: Gap.compare(requirements, after) };
}

function buildCandidate() {
  const candidate = {
    schema: 'axm.portable-current-state-verification-candidate/v1',
    version: '0.1.0',
    candidateId: 'portable-current-state-verification-candidate-20260819',
    generatedAt: CANDIDATE_AT,
    status: 'EXPERIMENTAL',
    capabilityId: 'growth.current-state.detached-integrity.verify',
    sourceRefs: CANDIDATE_SOURCES.map(namedFileRef),
    evidenceRefs: CANDIDATE_EVIDENCE.map(namedFileRef),
    boundaries: {
      detachedIntegrityIsSourceTruth: false,
      detachedIntegrityIsSourceCurrentness: false,
      technicalEvidenceIsHumanBenefit: false,
      installed: false,
      permissionGranted: false,
      promoted: false,
      merged: false,
      canon: false,
      foundationMutation: false
    },
    candidateDigest: null
  };
  const payload = clone(candidate);
  delete payload.candidateDigest;
  candidate.candidateDigest = Growth.sha256(payload);
  return candidate;
}

function buildProof(candidate) {
  const evaluation = readJson(PORTABILITY_LANE + '/PORTABLE_AI_WORKFLOW_EVALUATION.json');
  const rebuiltEvaluation = Portability.buildEvaluation();
  const checks = readJson(PORTABILITY_LANE + '/CHECK_RESULTS.json');
  const verification = readJson(PORTABILITY_LANE + '/VERIFICATION_RECEIPT.json');
  const recordedEvaluationExact = Growth.stableStringify(evaluation) === Growth.stableStringify(rebuiltEvaluation);
  const checkResultsDigestValid = selfDigestValid(checks, 'resultsDigest');
  const verificationDigestValid = selfDigestValid(verification, 'verificationDigest');
  const verificationStableSourceRefsCurrent = verification.sourceRefs.every((reference) => {
    const file = path.join(ROOT, reference.path);
    return fs.existsSync(file) && Growth.sha256(fs.readFileSync(file)) === reference.sha256;
  });
  const pass = recordedEvaluationExact && checkResultsDigestValid && verificationDigestValid
    && verificationStableSourceRefsCurrent && evaluation.summary.expectationFail === 0
    && evaluation.summary.recomputedTamperCaughtBeyondDigest === 7
    && evaluation.summary.sourceTruthUnknownHolds === 3
    && checks.summary.failed === 0 && checks.summary.requiredPassed === 10
    && verification.result === 'PASS_WITH_DECLARED_LIMITS';
  const candidateRef = candidateReference(candidate);
  const proof = {
    schema: 'axm.portable-current-state-capability-proof/v1',
    version: '0.1.0',
    proofId: 'portable-current-state-capability-proof-20260819',
    generatedAt: PROOF_AT,
    status: 'TEST',
    subjectRef: candidateRef,
    verdict: pass ? 'PASS_WITH_DECLARED_LIMITS' : 'FAIL',
    checks: {
      recordedEvaluationExact,
      checkResultsDigestValid,
      verificationDigestValid,
      verificationStableSourceRefsCurrent,
      adversarialCases: evaluation.summary.caseCount,
      expectationsPassed: evaluation.summary.expectationPass,
      recomputedTamperCaughtBeyondDigest: evaluation.summary.recomputedTamperCaughtBeyondDigest,
      coherentSourceTruthHolds: evaluation.summary.sourceTruthUnknownHolds,
      focusedAndAdjacentAssertions: checks.summary.explicitAssertions,
      requiredChecksPassed: checks.summary.requiredPassed
    },
    limitations: [
      'The representative cases were used to develop and test the deterministic guard; this is bounded workflow evidence, not an independently blinded or statistical benchmark.',
      'A coherent forged receipt can still pass detached integrity, so source truth and currentness remain UNKNOWN without the native source graph.',
      'No human journey, model training, weight change, provider comparison, broad generalization, installation, promotion, merge, or CANON decision is proven.'
    ],
    authority: {
      availabilityGranted: false,
      humanDecisionMade: false,
      installed: false,
      permissionGranted: false,
      promoted: false,
      merged: false,
      canon: false,
      foundationMutation: false
    },
    proofDigest: null
  };
  const payload = clone(proof);
  delete payload.proofDigest;
  proof.proofDigest = Growth.sha256(payload);
  return proof;
}

function buildCycle(candidate, proof, gaps) {
  const candidateRef = candidateReference(candidate);
  const proofRef = proofReference(proof);
  return Cycle.build({
    cycleId: 'cycle-portable-current-state-verification-20260819',
    capabilityId: candidate.capabilityId,
    generatedAt: CYCLE_AT,
    baseline: {
      kind: 'grounded-growth-current-state',
      identity: 'eight-outcome current state with full-source verification and no dedicated detached capability cycle',
      receiptRef: namedFileRef(PRIOR_CURRENT_STATE)
    },
    need: {
      id: 'need-portable-current-state-verification',
      statement: 'A copied current-state receipt needs bounded integrity, coherence, and authority checks without pretending absent sources are authenticated.',
      sourceRef: namedFileRef(PORTABILITY_LANE + '/PORTABLE_AI_WORKFLOW_EVALUATION.json'),
      directionRef: namedFileRef(PORTABILITY_LANE + '/README.md')
    },
    gap: {
      state: 'OPEN',
      reason: 'The detached verifier existed as tested technical material but had no exact candidate aggregate, verified capability cycle, beneficiary-routed outcome, or longitudinal portfolio entry.',
      reportRef: Growth.reference(gaps.before, { id: 'portable-verification-grounded-growth-gap-before', schema: gaps.before.schema }),
      existingCapabilityRef: null
    },
    provenance: [...candidate.sourceRefs, ...candidate.evidenceRefs],
    candidate: {
      strategy: 'ADAPT',
      status: 'EXPERIMENTAL',
      artifactRef: candidateRef,
      sourceMutationPerformed: false,
      installed: false,
      promoted: false,
      canon: false
    },
    verification: {
      verdict: proof.verdict === 'PASS_WITH_DECLARED_LIMITS' ? 'PASS' : 'FAIL',
      subjectDigest: candidateRef.sha256,
      receiptRef: proofRef,
      evidenceAuthority: 'MIXED',
      limitations: proof.limitations
    },
    decision: null,
    availability: null,
    refresh: {
      trigger: 'NEW_INFORMATION',
      checkedAt: CYCLE_AT,
      due: false,
      reason: 'Recheck when candidate sources, adversarial cases, verifier behavior, authority boundaries, or the prior current-state baseline change.'
    }
  });
}

function closure(id, refs) {
  const coveredDigests = Array.from(new Set(refs.map((reference) => reference.sha256))).sort();
  return {
    state: 'CURRENT',
    checkedAt: OUTCOME_AT,
    receiptRef: Growth.reference({ id, coveredDigests }, { id, schema: 'axm.evidence-closure-receipt/v1' }),
    coveredDigests
  };
}

function buildOutcome(candidate, proof, cycle) {
  const evaluation = readJson(PORTABILITY_LANE + '/PORTABLE_AI_WORKFLOW_EVALUATION.json');
  const candidateRef = candidateReference(candidate);
  const proofRef = proofReference(proof);
  const cycleRef = { id: cycle.cycleId, schema: cycle.schema, sha256: cycle.receiptDigest };
  const evaluationRef = namedFileRef(PORTABILITY_LANE + '/PORTABLE_AI_WORKFLOW_EVALUATION.json');
  const casesRef = namedFileRef(PORTABILITY_LANE + '/PORTABLE_VERIFICATION_CASES.json');
  const checksRef = namedFileRef(PORTABILITY_LANE + '/CHECK_RESULTS.json');
  const verificationRef = namedFileRef(PORTABILITY_LANE + '/VERIFICATION_RECEIPT.json');
  const evidenceRefs = [candidateRef, proofRef, cycleRef, evaluationRef, casesRef, checksRef, verificationRef];
  const systemBaselineRef = Growth.reference({
    checker: 'DIGEST_ONLY',
    casesPassed: evaluation.summary.digestOnlyPass,
    semanticChecks: 0,
    authorityChecks: 0
  }, { id: 'portable-verification-digest-only-system-baseline', schema: 'axm.portable-verification-system-baseline/v1' });
  const systemOutcomeRef = Growth.reference({
    checker: 'DETACHED_GUARD',
    casesMatchingExpectation: evaluation.summary.expectationPass,
    recomputedTamperCaughtBeyondDigest: evaluation.summary.recomputedTamperCaughtBeyondDigest,
    sourceTruthUnknownHolds: evaluation.summary.sourceTruthUnknownHolds
  }, { id: 'portable-verification-detached-system-outcome', schema: 'axm.portable-verification-system-outcome/v1' });
  const aiBaselineRef = Growth.reference({
    policy: 'ACCEPT_SELF_DIGEST_PASS',
    admittedCases: evaluation.summary.digestOnlyPass,
    sourceTruthDistinction: false
  }, { id: 'portable-verification-ai-workflow-baseline', schema: 'axm.ai-workflow-evaluation-baseline/v1' });
  const aiOutcomeRef = Growth.reference({
    policy: 'STRICT_DETACHED_GUARD_WITH_SOURCE_TRUTH_HOLD',
    expectedDecisions: evaluation.summary.expectationPass,
    totalDecisions: evaluation.summary.caseCount,
    sourceTruthUnknownHolds: evaluation.summary.sourceTruthUnknownHolds
  }, { id: 'portable-verification-ai-workflow-outcome', schema: 'axm.ai-workflow-evaluation-outcome/v1' });
  return Growth.buildOutcome({
    outcomeId: 'grounded-growth-portable-current-state-verification-20260819',
    generatedAt: OUTCOME_AT,
    cycleReceipt: cycle,
    interventionRef: candidateRef,
    previousOutcomeRef: null,
    noNewInformation: false,
    informationRefs: evidenceRefs,
    claims: [
      {
        id: 'portable-current-state-system-effect',
        beneficiary: 'SHARED_SYSTEM',
        statement: 'The detached current-state guard checks strict structure, self-digest, internal coherence, and authority boundaries; on eleven frozen cases it catches seven recomputed contradictions that a digest-only checker admits while preserving source truth as UNKNOWN for coherent passes.',
        kind: 'DETERMINISTIC_BEHAVIOR',
        verdict: 'PASS',
        proofSurface: 'FOCUSED_RUNTIME',
        baselineRef: systemBaselineRef,
        outcomeRef: systemOutcomeRef,
        evidenceRefs,
        evidenceClosure: closure('portable-current-state-system-effect-closure', [systemBaselineRef, systemOutcomeRef, ...evidenceRefs]),
        limitations: proof.limitations
      },
      {
        id: 'portable-current-state-human-benefit',
        beneficiary: 'HUMAN',
        statement: 'A person makes fewer mistaken receipt-trust decisions when using the detached guard.',
        kind: 'WORKFLOW_OUTCOME',
        verdict: 'NOT_RUN',
        proofSurface: 'NOT_RUN',
        baselineRef: null,
        outcomeRef: null,
        evidenceRefs: [],
        evidenceClosure: null,
        limitations: ['No voluntary representative human journey or comprehension comparison was run.']
      },
      {
        id: 'portable-current-state-ai-workflow-benefit',
        beneficiary: 'AI_WORKFLOW',
        statement: 'For the exact eleven-case stewardship evaluation, the detached guard replaces self-digest-only acceptance with the expected reject or source-truth-hold decision in every case and exposes seven recomputed contradictions beyond digest checking.',
        kind: 'WORKFLOW_OUTCOME',
        verdict: 'PASS',
        proofSurface: 'AI_WORKFLOW_EVALUATION',
        baselineRef: aiBaselineRef,
        outcomeRef: aiOutcomeRef,
        evidenceRefs,
        evidenceClosure: closure('portable-current-state-ai-workflow-closure', [aiBaselineRef, aiOutcomeRef, ...evidenceRefs]),
        limitations: proof.limitations
      }
    ],
    refresh: {
      checkedAt: OUTCOME_AT,
      due: false,
      reason: 'Rebuild when the candidate, case set, evaluation, source graph, prior current state, or beneficiary evidence changes.'
    }
  });
}

function buildPortfolio(outcome) {
  const prior = readJson(PRIOR_PORTFOLIO);
  assert.ok(Growth.verifyPortfolio(prior).pass, 'prior eight-outcome portfolio must verify');
  return Growth.buildPortfolio({
    portfolioId: 'axm-grounded-growth-current-portable-verification-20260819',
    generatedAt: PORTFOLIO_AT,
    outcomes: [...prior.outcomes, outcome]
  });
}

function effectiveClaims(portfolio) {
  return portfolio.latest.flatMap((latest) => {
    const outcome = portfolio.outcomes.find((item) => item.receiptDigest === latest.effectiveReceiptDigest);
    if (!outcome) throw new Error('effective outcome missing: ' + latest.capabilityId);
    return outcome.claims;
  });
}

function buildSummary(candidate, proof, cycle, outcome, portfolio, currentState, gaps) {
  const claims = effectiveClaims(portfolio);
  const verdicts = {};
  claims.forEach((claim) => {
    const key = claim.beneficiary + ':' + claim.admittedVerdict;
    verdicts[key] = (verdicts[key] || 0) + 1;
  });
  const summary = {
    schema: 'axm.portable-verification-grounded-growth-summary/v1',
    generatedAt: CURRENT_AT,
    candidateRef: { id: candidate.candidateId, schema: candidate.schema, sha256: candidate.candidateDigest },
    proofRef: { id: proof.proofId, schema: proof.schema, sha256: proof.proofDigest },
    cycleRef: { id: cycle.cycleId, schema: cycle.schema, sha256: cycle.receiptDigest },
    outcomeRef: { id: outcome.outcomeId, schema: outcome.schema, sha256: outcome.receiptDigest },
    portfolioRef: { id: portfolio.portfolioId, schema: portfolio.schema, sha256: portfolio.portfolioDigest },
    currentStateRef: { id: currentState.receiptId, schema: currentState.schema, sha256: currentState.receiptDigest },
    growth: {
      priorOutcomes: 8,
      currentOutcomes: portfolio.summary.outcomeCount,
      priorCapabilityChains: 4,
      currentCapabilityChains: portfolio.summary.capabilityCount,
      outcomeState: outcome.state,
      effectiveBeneficiaryVerdicts: verdicts,
      sharedSystemPass: verdicts['SHARED_SYSTEM:PASS'] || 0,
      aiWorkflowPass: verdicts['AI_WORKFLOW:PASS'] || 0,
      humanPass: verdicts['HUMAN:PASS'] || 0,
      humanNotRun: verdicts['HUMAN:NOT_RUN'] || 0
    },
    participation: {
      state: currentState.participationBinding.state,
      protectedCapabilityIds: currentState.participationBinding.protectedCapabilityIds,
      affectedProtectedCapabilityIds: currentState.participationBinding.affectedProtectedCapabilityIds,
      optionalReviewCandidates: currentState.participationBinding.optionalReviewCandidates,
      humanEvidencePresent: currentState.participationBinding.humanEvidencePresent,
      humanBenefitEstablished: currentState.participationBinding.humanBenefitEstablished
    },
    capabilityGap: {
      before: gaps.before.overall,
      after: gaps.after.overall,
      requiredMissingAfter: gaps.after.missingCapabilities.length,
      nativeHumanBenefit: gaps.after.requirements.find((item) => item.id === 'native-human-benefit').status,
      detachedSourceTruth: gaps.after.requirements.find((item) => item.id === 'detached-source-truth').status
    },
    decision: currentState.decision,
    truth: {
      priorOutcomeBytesPreserved: true,
      currentTechnicalOutcomeIsHumanBenefit: false,
      humanBenefitEstablished: false,
      modelLearningClaimed: false,
      broadGeneralizationClaimed: false,
      sourceTruthClaimed: false,
      participationStarted: false,
      installed: false,
      promoted: false,
      merged: false,
      canonized: false,
      foundationMutation: false
    },
    summaryDigest: null
  };
  const payload = clone(summary);
  delete payload.summaryDigest;
  summary.summaryDigest = Growth.sha256(payload);
  return summary;
}

function build() {
  const gaps = gapReports();
  const candidate = buildCandidate();
  const proof = buildProof(candidate);
  assert.strictEqual(proof.verdict, 'PASS_WITH_DECLARED_LIMITS', 'portable candidate proof must pass');
  const cycle = buildCycle(candidate, proof, gaps);
  const outcome = buildOutcome(candidate, proof, cycle);
  const portfolio = buildPortfolio(outcome);
  const participationFrontier = Participation.build();
  const recordedParticipation = readJson('docs/steward-runs/2026-08-19-grounded-growth-participation-frontier/CURRENT_PARTICIPATION_FRONTIER_RECEIPT.json');
  assert.strictEqual(Growth.stableStringify(participationFrontier), Growth.stableStringify(recordedParticipation), 'participation frontier source must rebuild exactly');
  const currentStateInput = {
    receiptId: 'current-grounded-growth-portable-verification-20260819',
    generatedAt: CURRENT_AT,
    participationFrontierReceipt: participationFrontier,
    participationFrontierInput: Participation.currentInput(),
    latestPortfolio: portfolio
  };
  const currentState = Current.build(currentStateInput);
  const summary = buildSummary(candidate, proof, cycle, outcome, portfolio, currentState, gaps);
  return { gaps, candidate, proof, cycle, outcome, portfolio, currentStateInput, currentState, summary };
}

function recorded() {
  return {
    gapBefore: readJson('docs/steward-runs/2026-08-19-portable-verification-grounded-growth/CAPABILITY_GAP_BEFORE.json'),
    gapAfter: readJson('docs/steward-runs/2026-08-19-portable-verification-grounded-growth/CAPABILITY_GAP_AFTER.json'),
    candidate: readJson('docs/steward-runs/2026-08-19-portable-verification-grounded-growth/PORTABLE_VERIFICATION_CANDIDATE.json'),
    proof: readJson('docs/steward-runs/2026-08-19-portable-verification-grounded-growth/PORTABLE_CAPABILITY_PROOF.json'),
    cycle: readJson('docs/steward-runs/2026-08-19-portable-verification-grounded-growth/VERIFIED_CAPABILITY_CYCLE.json'),
    outcome: readJson('docs/steward-runs/2026-08-19-portable-verification-grounded-growth/GROUNDED_GROWTH_OUTCOME.json'),
    portfolio: readJson('docs/steward-runs/2026-08-19-portable-verification-grounded-growth/CURRENT_PORTFOLIO.json'),
    currentState: readJson('docs/steward-runs/2026-08-19-portable-verification-grounded-growth/CURRENT_STATE_RECEIPT.json'),
    summary: readJson('docs/steward-runs/2026-08-19-portable-verification-grounded-growth/CURRENT_SUMMARY.json')
  };
}

function checkRecorded() {
  const current = build();
  const saved = recorded();
  const expected = {
    gapBefore: current.gaps.before,
    gapAfter: current.gaps.after,
    candidate: current.candidate,
    proof: current.proof,
    cycle: current.cycle,
    outcome: current.outcome,
    portfolio: current.portfolio,
    currentState: current.currentState,
    summary: current.summary
  };
  assert.strictEqual(Growth.stableStringify(saved), Growth.stableStringify(expected), 'recorded portable-verification growth artifacts differ from exact rebuild');
  return current;
}

function writeJson(name, value) {
  fs.writeFileSync(path.join(__dirname, name), JSON.stringify(value, null, 2) + '\n');
}

function write() {
  const current = build();
  writeJson('CAPABILITY_GAP_BEFORE.json', current.gaps.before);
  writeJson('CAPABILITY_GAP_AFTER.json', current.gaps.after);
  writeJson('PORTABLE_VERIFICATION_CANDIDATE.json', current.candidate);
  writeJson('PORTABLE_CAPABILITY_PROOF.json', current.proof);
  writeJson('VERIFIED_CAPABILITY_CYCLE.json', current.cycle);
  writeJson('GROUNDED_GROWTH_OUTCOME.json', current.outcome);
  writeJson('CURRENT_PORTFOLIO.json', current.portfolio);
  writeJson('CURRENT_STATE_RECEIPT.json', current.currentState);
  writeJson('CURRENT_SUMMARY.json', current.summary);
  return current;
}

if (require.main === module) {
  try {
    const result = process.argv.includes('--write') ? write()
      : process.argv.includes('--check-recorded') ? checkRecorded()
        : build();
    process.stdout.write(JSON.stringify({
      proof: result.proof.verdict,
      cycle: result.cycle.state,
      outcome: result.outcome.state,
      outcomes: result.portfolio.summary.outcomeCount,
      capabilityChains: result.portfolio.summary.capabilityCount,
      currentState: result.currentState.state,
      systemPass: result.summary.growth.sharedSystemPass,
      aiWorkflowPass: result.summary.growth.aiWorkflowPass,
      humanPass: result.summary.growth.humanPass,
      reviewCandidates: result.currentState.decision.reviewableActionCount,
      digest: result.currentState.receiptDigest
    }, null, 2) + '\n');
  } catch (error) {
    process.stderr.write((error.stack || error.message) + '\n');
    process.exitCode = 1;
  }
}

module.exports = {
  ROOT,
  CANDIDATE_SOURCES,
  CANDIDATE_EVIDENCE,
  readJson,
  fileRef,
  selfDigestValid,
  candidateReference,
  proofReference,
  gapReports,
  buildCandidate,
  buildProof,
  buildCycle,
  buildOutcome,
  buildPortfolio,
  build,
  recorded,
  checkRecorded,
  write
};
