#!/usr/bin/env node
'use strict';

const assert = require('assert');
const Cycle = require('../../../shared/verified-capability-loop/verified-capability-loop');
const Growth = require('../../../shared/grounded-growth-outcomes/grounded-growth-outcomes');
const Current = require('../../../shared/grounded-growth-current-state/grounded-growth-current-state');
const Build = require('./build-portable-verification-growth');

let checks = 0;
function ok(value, message) {
  assert.ok(value, message);
  checks += 1;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function cycleInput(receipt) {
  return {
    cycleId: receipt.cycleId,
    capabilityId: receipt.capabilityId,
    generatedAt: receipt.generatedAt,
    baseline: receipt.baseline,
    need: receipt.need,
    gap: receipt.gap,
    provenance: receipt.provenance,
    candidate: receipt.candidate,
    verification: receipt.verification,
    decision: receipt.stewardDecision,
    availability: receipt.availability,
    refresh: receipt.refresh
  };
}

function redigest(receipt) {
  const result = clone(receipt);
  delete result.receiptDigest;
  result.receiptDigest = Current.sha256(result);
  return result;
}

const result = Build.checkRecorded();
const prior = Build.readJson('docs/steward-runs/2026-08-19-verification-evolution-grounded-growth/CURRENT_PORTFOLIO.json');

ok(result.gaps.before.overall === 'BLOCKED', 'before comparison records the missing longitudinal growth linkage');
ok(result.gaps.before.missingCapabilities.length === 5, 'before comparison names five exact required capabilities');
ok(result.gaps.after.overall === 'DEGRADED', 'after comparison remains degraded by optional unknown evidence');
ok(result.gaps.after.missingCapabilities.length === 0, 'all required capability gaps are closed');
ok(result.gaps.after.requirements.filter((item) => item.required).every((item) => item.status === 'READY'), 'every required capability group is READY');
ok(result.gaps.after.requirements.filter((item) => !item.required).every((item) => item.status === 'OPTIONAL_UNKNOWN'), 'human benefit and detached source truth remain optional unknowns');

ok(Build.selfDigestValid(result.candidate, 'candidateDigest'), 'candidate aggregate self-digest verifies');
ok(result.candidate.status === 'EXPERIMENTAL', 'candidate remains EXPERIMENTAL');
ok(result.candidate.capabilityId === 'growth.current-state.detached-integrity.verify', 'candidate has a distinct exact capability identity');
ok(result.candidate.sourceRefs.length === 6 && result.candidate.evidenceRefs.length === 4, 'candidate binds six implementation sources and four evidence artifacts');
ok(Object.values(result.candidate.boundaries).every((value) => value === false), 'candidate claims no source truth, human benefit, installation, or authority');
result.candidate.sourceRefs.concat(result.candidate.evidenceRefs).forEach((reference) => {
  ok(/^sha256:[0-9a-f]{64}$/.test(reference.sha256), 'candidate reference is digest bound: ' + reference.id);
});

ok(Build.selfDigestValid(result.proof, 'proofDigest'), 'capability proof self-digest verifies');
ok(result.proof.verdict === 'PASS_WITH_DECLARED_LIMITS', 'capability proof passes with declared limits');
ok(result.proof.subjectRef.sha256 === result.candidate.candidateDigest, 'proof binds the exact candidate self-digest');
ok(result.proof.checks.recordedEvaluationExact, 'proof rebuilds the recorded evaluation exactly');
ok(result.proof.checks.verificationStableSourceRefsCurrent, 'prior verification stable source references remain current');
ok(result.proof.checks.adversarialCases === 11 && result.proof.checks.expectationsPassed === 11, 'all eleven adversarial expectations remain passing');
ok(result.proof.checks.recomputedTamperCaughtBeyondDigest === 7, 'proof retains seven catches beyond digest-only checking');
ok(result.proof.checks.coherentSourceTruthHolds === 3, 'proof retains all three source-truth holds');
ok(Object.values(result.proof.authority).every((value) => value === false), 'proof grants no availability or authority');

ok(Cycle.verify(result.cycle).pass, 'verified-capability cycle verifies natively');
ok(result.cycle.state === 'AWAITING_STEWARD', 'cycle waits for a human steward decision');
ok(result.cycle.improvementClaim === 'VERIFIED_CANDIDATE_ONLY', 'cycle makes only a verified-candidate claim');
ok(result.cycle.candidate.artifactRef.sha256 === result.candidate.candidateDigest, 'cycle candidate binds the aggregate digest');
ok(result.cycle.verification.subjectDigest === result.candidate.candidateDigest, 'cycle verification binds the same candidate digest');
ok(result.cycle.stewardDecision === null && result.cycle.availability === null, 'cycle has no fabricated steward decision or availability');
ok(result.cycle.candidate.installed === false && result.cycle.candidate.promoted === false && result.cycle.candidate.canon === false, 'cycle installs, promotes, and canonizes nothing');

ok(Growth.verifyOutcome(result.outcome).pass, 'ninth Grounded Growth outcome verifies natively');
ok(result.outcome.state === 'CANDIDATE_ONLY', 'ninth outcome remains candidate-only while the capability awaits stewardship');
ok(result.outcome.capabilityId === result.candidate.capabilityId, 'outcome keeps the new capability identity');
ok(result.outcome.previousOutcomeRef === null, 'new capability chain begins without stealing another chain ancestry');
const systemClaim = result.outcome.claims.find((claim) => claim.beneficiary === 'SHARED_SYSTEM');
const aiClaim = result.outcome.claims.find((claim) => claim.beneficiary === 'AI_WORKFLOW');
const humanClaim = result.outcome.claims.find((claim) => claim.beneficiary === 'HUMAN');
ok(systemClaim.admittedVerdict === 'PASS' && systemClaim.proofSurface === 'FOCUSED_RUNTIME', 'shared-system effect is admitted on focused runtime evidence');
ok(aiClaim.admittedVerdict === 'PASS' && aiClaim.proofSurface === 'AI_WORKFLOW_EVALUATION', 'AI-workflow benefit is admitted on its native workflow surface');
ok(humanClaim.admittedVerdict === 'NOT_RUN' && humanClaim.proofSurface === 'NOT_RUN', 'human benefit remains explicitly not run');
ok(result.outcome.nextEvidenceNeeds.length === 1 && result.outcome.nextEvidenceNeeds[0] === 'HUMAN_BENEFIT_NATIVE_EVIDENCE', 'only native human-benefit evidence remains open for this outcome');
ok(result.outcome.truth.modelWeightTrainingClaimed === false && result.outcome.truth.automaticCanon === false, 'outcome claims neither model training nor CANON authority');

ok(Growth.verifyPortfolio(result.portfolio).pass, 'nine-outcome portfolio verifies natively');
ok(result.portfolio.summary.outcomeCount === 9 && result.portfolio.summary.capabilityCount === 5, 'portfolio advances to nine outcomes across five capability chains');
ok(result.portfolio.outcomes.length === prior.outcomes.length + 1, 'portfolio appends exactly one outcome to the eight-outcome source');
prior.outcomes.forEach((outcome, index) => {
  ok(Growth.stableStringify(result.portfolio.outcomes[index]) === Growth.stableStringify(outcome), 'prior outcome bytes remain exact at index ' + index);
});
ok(result.portfolio.outcomes[8].outcomeId === result.outcome.outcomeId, 'ninth index contains only the portable-verification outcome');
ok(result.portfolio.latest.some((item) => item.capabilityId === result.candidate.capabilityId && item.effectiveOutcomeId === result.outcome.outcomeId), 'new capability chain is the effective portable-verification outcome');

ok(Current.verify(result.currentState, result.currentStateInput).pass, 'successor current-state receipt verifies by exact source rebuild');
ok(result.currentState.state === 'CURRENT_CONVERGED', 'successor state is current converged');
ok(result.currentState.portfolioEvolution.baseOutcomeCount === 7 && result.currentState.portfolioEvolution.currentOutcomeCount === 9, 'successor compares the seven-outcome participation base to nine current outcomes');
ok(result.currentState.portfolioEvolution.appendedOutcomeCount === 2, 'successor sees both post-participation outcomes without rewriting either');
ok(result.currentState.currentEvidence.capabilityChains === 5, 'successor exposes five current capability chains');
ok(result.currentState.currentEvidence.sharedSystemPass === 5 && result.currentState.currentEvidence.aiWorkflowPass === 5, 'successor exposes five shared-system and five AI-workflow passes');
ok(result.currentState.currentEvidence.humanPass === 0 && result.currentState.currentEvidence.humanNotRun === 5, 'successor exposes zero human passes and five human not-run claims');
ok(result.currentState.participationBinding.state === 'PRESERVED', 'unaffected voluntary-human binding remains preserved');
ok(result.currentState.participationBinding.affectedProtectedCapabilityIds.length === 0, 'new capability does not advance the protected simulation chain');
ok(result.currentState.decision.reviewableActionCount === 1 && result.currentState.decision.autonomousActionCount === 0, 'one optional review remains and no autonomous action appears');
const detached = Current.inspectDetached(result.currentState);
ok(detached.pass && detached.verdict === 'PORTABLE_INTEGRITY_PASS_SOURCE_TRUTH_UNKNOWN', 'successor receipt passes detached integrity with the source-truth ceiling');
ok(detached.sourceVerification.sourceTruth === 'UNKNOWN' && detached.sourceVerification.sourceCurrentness === 'UNKNOWN', 'detached successor does not claim source truth or currentness');

const badInstallInput = cycleInput(result.cycle);
badInstallInput.candidate = clone(badInstallInput.candidate);
badInstallInput.candidate.installed = true;
assert.throws(() => Cycle.build(badInstallInput), /candidate.installed must be false/);
checks += 1;

const mismatchedProofInput = cycleInput(result.cycle);
mismatchedProofInput.verification = clone(mismatchedProofInput.verification);
mismatchedProofInput.verification.subjectDigest = 'sha256:' + '0'.repeat(64);
assert.throws(() => Cycle.build(mismatchedProofInput), /does not match the candidate/);
checks += 1;

const fabricatedHuman = Growth.buildOutcome({
  outcomeId: 'fixture-portable-human-fabrication',
  generatedAt: '2026-08-19T21:56:00.000Z',
  cycleReceipt: result.cycle,
  interventionRef: result.outcome.interventionRef,
  previousOutcomeRef: null,
  noNewInformation: false,
  informationRefs: result.outcome.informationRefs,
  claims: [{
    id: 'fixture-human-pass-from-ai-evidence',
    beneficiary: 'HUMAN',
    statement: 'AI workflow evidence is incorrectly relabeled as human benefit.',
    kind: 'WORKFLOW_OUTCOME',
    verdict: 'PASS',
    proofSurface: 'AI_WORKFLOW_EVALUATION',
    baselineRef: aiClaim.baselineRef,
    outcomeRef: aiClaim.outcomeRef,
    evidenceRefs: aiClaim.evidenceRefs,
    evidenceClosure: aiClaim.evidenceClosure,
    limitations: ['Deliberate negative fixture.']
  }],
  refresh: { checkedAt: '2026-08-19T21:56:00.000Z', due: false, reason: 'negative route fixture' }
});
ok(fabricatedHuman.state === 'EVIDENCE_HOLD', 'AI evidence cannot manufacture a human-growth outcome');
ok(fabricatedHuman.claims[0].admittedVerdict === 'UNKNOWN', 'fabricated human PASS is demoted to unknown');
ok(fabricatedHuman.claims[0].routeReasons.includes('HUMAN_BENEFIT_REQUIRES_BENEFICIARY_NATIVE_EVIDENCE'), 'human-native evidence gap is named');

const fakePrevious = Growth.buildOutcome({
  outcomeId: 'fixture-portable-skipped-ancestry',
  generatedAt: '2026-08-19T21:56:01.000Z',
  cycleReceipt: result.cycle,
  interventionRef: result.outcome.interventionRef,
  previousOutcomeRef: { id: 'missing-ancestor', schema: Growth.OUTCOME_SCHEMA, sha256: 'sha256:' + '1'.repeat(64) },
  noNewInformation: false,
  informationRefs: result.outcome.informationRefs,
  claims: result.outcome.claims,
  refresh: result.outcome.refresh
});
assert.throws(() => Growth.buildPortfolio({
  portfolioId: 'fixture-skipped-ancestry',
  generatedAt: '2026-08-19T21:56:02.000Z',
  outcomes: [...prior.outcomes, fakePrevious]
}), /must not skip earlier ancestry/);
checks += 1;

const protectedLatest = result.portfolio.latest.find((item) => item.capabilityId === 'simulation.run-envelope.verify');
const protectedOutcome = result.portfolio.outcomes.find((item) => item.outcomeId === protectedLatest.outcomeId);
const protectedAdvance = Growth.buildOutcome({
  outcomeId: 'fixture-protected-portable-successor',
  generatedAt: '2026-08-19T21:56:03.000Z',
  cycleReceipt: protectedOutcome.cycleReceipt,
  previousOutcomeRef: { id: protectedOutcome.outcomeId, schema: protectedOutcome.schema, sha256: protectedOutcome.receiptDigest },
  noNewInformation: true,
  refresh: { checkedAt: '2026-08-19T21:56:03.000Z', due: false, reason: 'synthetic protected-chain rebind fixture' }
});
const protectedPortfolio = Growth.buildPortfolio({
  portfolioId: 'fixture-protected-portable-successor-portfolio',
  generatedAt: '2026-08-19T21:56:04.000Z',
  outcomes: [...result.portfolio.outcomes, protectedAdvance]
});
const protectedInput = { ...result.currentStateInput, generatedAt: '2026-08-19T21:56:05.000Z', latestPortfolio: protectedPortfolio };
const protectedHold = Current.build(protectedInput);
ok(protectedHold.state === 'HOLD_PARTICIPATION_REBIND_REQUIRED', 'a later protected-chain advance still creates a participation rebind hold');
ok(protectedHold.participationBinding.state === 'REQUIRES_REBIND', 'protected-chain change cannot inherit stale participation binding');
ok(protectedHold.decision.reviewableActionCount === 0, 'protected-chain hold removes the stale review candidate');

const autonomous = clone(result.currentState);
autonomous.decision.autonomousActionCount = 1;
const autonomousCheck = Current.inspectDetached(redigest(autonomous));
ok(!autonomousCheck.pass && autonomousCheck.issues.some((item) => item.code === 'AUTONOMOUS_ACTION_REFUSED'), 'recomputed successor authority inflation is refused');

ok(result.summary.truth.humanBenefitEstablished === false && result.summary.truth.sourceTruthClaimed === false, 'summary preserves human and source-truth limits');
ok(result.summary.truth.installed === false && result.summary.truth.promoted === false && result.summary.truth.merged === false && result.summary.truth.canonized === false, 'summary grants no lifecycle authority');
ok(!/[A-Za-z]:[\\/]/.test(JSON.stringify(result.summary)), 'summary contains no machine path');

console.log('PASS portable verification Grounded Growth selftest (' + checks + ' assertions)');
