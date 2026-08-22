#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Growth = require('../../../shared/grounded-growth-outcomes/grounded-growth-outcomes');
const Builder = require('./build-verification-evolution-growth');
const Verification = require('./build-verification-receipt');

let assertions = 0;
function check(message, value) { assertions += 1; assert.ok(value, message); }
function equal(message, actual, expected) { assertions += 1; assert.strictEqual(actual, expected, message); }
function deepEqual(message, actual, expected) { assertions += 1; assert.deepStrictEqual(actual, expected, message); }
function throws(message, fn, pattern) { assertions += 1; assert.throws(fn, pattern, message); }
function clone(value) { return JSON.parse(JSON.stringify(value)); }
function read(name) { return JSON.parse(fs.readFileSync(path.join(__dirname, name), 'utf8')); }

const recorded = {
  evaluation: read('EVOLUTION_AI_WORKFLOW_EVALUATION.json'),
  outcome: read('EVOLUTION_AI_WORKFLOW_OUTCOME.json'),
  portfolio: read('CURRENT_PORTFOLIO.json'),
  summary: read('CURRENT_SUMMARY.json')
};
const recordedVerification = read('VERIFICATION_RECEIPT.json');
const rebuilt = Builder.build();

check('recorded evaluation verifies', Builder.verifyEvaluation(recorded.evaluation).pass);
deepEqual('all recorded artifacts rebuild exactly', recorded, rebuilt);
deepEqual('recorded summary check route rebuilds', Builder.verifyRecorded(), recorded.summary);
equal('evaluation schema', recorded.evaluation.schema, Builder.EVALUATION_SCHEMA);
equal('evaluation verdict', recorded.evaluation.verdict, 'PASS');
equal('eight cases', recorded.evaluation.cases.length, 8);
equal('shortcut gets one decision right', recorded.evaluation.baseline.correctDecisions, 1);
equal('shortcut exposes seven unsupported decisions', recorded.evaluation.baseline.unsupportedUnsafeOrHistoryErasingDecisions, 7);
equal('guard gets all decisions right', recorded.evaluation.outcome.correctDecisions, 8);
equal('guard has zero unsupported decisions', recorded.evaluation.outcome.unsupportedUnsafeOrHistoryErasingDecisions, 0);
equal('guard corrects seven decisions', recorded.evaluation.outcome.newlyCorrectedDecisions, 7);
equal('case ids unique', new Set(recorded.evaluation.cases.map(item => item.id)).size, 8);

for (const item of recorded.evaluation.cases) {
  equal(item.id + ' candidate decision', item.candidateDecision, item.expectedDecision);
  equal(item.id + ' candidate rule', item.candidateRule, item.expectedRule);
  equal(item.id + ' candidate correctness', item.candidateCorrect, true);
  check(item.id + ' source digest', /^sha256:[0-9a-f]{64}$/.test(item.sourceRef.sha256));
}

const decisions = Object.fromEntries(recorded.evaluation.cases.map(item => [item.id, item.candidateDecision]));
equal('derived view preserved', decisions['mutable-derived-view-drift'], 'PRESERVE_DERIVED_VIEW_DRIFT');
equal('direct route preserved', decisions['direct-later-current-route'], 'ROUTE_CURRENT_BYTES_DIRECT');
equal('transitive route preserved', decisions['transitive-candidate-scope-route'], 'ROUTE_CURRENT_BYTES_TRANSITIVELY');
equal('candidate currentness can hold', decisions['candidate-currentness-unresolved'], 'HOLD_CANDIDATE_CURRENTNESS');
equal('generated semantics remain bounded', decisions['known-generated-view-semantic-route'], 'ROUTE_GENERATED_VIEW_SEMANTICS_ONLY');
equal('legacy history remains held', decisions['legacy-no-self-digest'], 'ANCHOR_FORWARD_HOLD_PREANCHOR');
equal('invalid attestation held', decisions['invalid-later-attestation'], 'HOLD_INVALID_ATTESTATION');
equal('correctness inference refused', decisions['attestation-correctness-overclaim'], 'REFUSE_CORRECTNESS_INFERENCE');

equal('no model invoked', recorded.evaluation.truth.modelInvoked, false);
equal('no model weights changed', recorded.evaluation.truth.modelWeightsChanged, false);
equal('no model generalization claimed', recorded.evaluation.truth.modelGeneralizationClaimed, false);
equal('no human participant', recorded.evaluation.truth.humanParticipant, false);
equal('no human benefit claimed', recorded.evaluation.truth.humanBenefitClaimed, false);
equal('history not rewritten', recorded.evaluation.truth.historicalReceiptRewritten, false);
equal('correctness not inferred', recorded.evaluation.truth.correctnessInferredFromLineage, false);
equal('no automatic canon', recorded.evaluation.truth.automaticCanon, false);

check('later outcome verifies', Growth.verifyOutcome(recorded.outcome).pass);
equal('later outcome capability unchanged', recorded.outcome.capabilityId, 'evidence.registered-source-closure/v1');
equal('later outcome previous id exact', recorded.outcome.previousOutcomeRef.id, 'grounded-growth-output-availability-20260819');
equal('later outcome state remains candidate', recorded.outcome.state, 'CANDIDATE_ONLY');
equal('candidate growth claim remains bounded', recorded.outcome.growthClaim, 'CANDIDATE_OR_LIFECYCLE_EFFECT_ONLY');
deepEqual('only human evidence remains open', recorded.outcome.nextEvidenceNeeds, ['HUMAN_BENEFIT_NATIVE_EVIDENCE']);
equal('three beneficiary claims retained', recorded.outcome.claims.length, 3);
const systemClaim = recorded.outcome.claims.find(claim => claim.beneficiary === 'SHARED_SYSTEM');
const humanClaim = recorded.outcome.claims.find(claim => claim.beneficiary === 'HUMAN');
const aiClaim = recorded.outcome.claims.find(claim => claim.beneficiary === 'AI_WORKFLOW');
equal('system claim admitted', systemClaim.routeStatus, 'ADMITTED');
equal('system claim native surface', systemClaim.proofSurface, 'FOCUSED_RUNTIME');
equal('AI claim admitted', aiClaim.routeStatus, 'ADMITTED');
equal('AI claim native surface', aiClaim.proofSurface, 'AI_WORKFLOW_EVALUATION');
equal('human claim not run', humanClaim.admittedVerdict, 'NOT_RUN');
equal('human claim not proven', humanClaim.routeStatus, 'NOT_PROVEN');
equal('outcome grants no execution', recorded.outcome.truth.automaticExecution, false);
equal('outcome grants no promotion', recorded.outcome.truth.automaticPromotion, false);
equal('outcome grants no canon', recorded.outcome.truth.automaticCanon, false);

check('current portfolio verifies', Growth.verifyPortfolio(recorded.portfolio).pass);
equal('portfolio retains four capability chains', recorded.portfolio.summary.capabilityCount, 4);
equal('portfolio now has eight outcomes', recorded.portfolio.summary.outcomeCount, 8);
equal('all outcomes candidate only', recorded.portfolio.summary.stateCounts.CANDIDATE_ONLY, 8);
equal('portfolio overall bounded', recorded.portfolio.summary.overall, 'CANDIDATES_OR_UNKNOWN_EFFECTS');
const latestClosure = recorded.portfolio.latest.find(item => item.capabilityId === 'evidence.registered-source-closure/v1');
equal('new outcome is latest closure receipt', latestClosure.outcomeId, recorded.outcome.outcomeId);
equal('new outcome is effective closure receipt', latestClosure.effectiveOutcomeId, recorded.outcome.outcomeId);
deepEqual('portfolio closure still needs human evidence', latestClosure.nextEvidenceNeeds, ['HUMAN_BENEFIT_NATIVE_EVIDENCE']);
equal('summary binds portfolio digest', recorded.summary.portfolioRef.sha256, recorded.portfolio.portfolioDigest);
equal('summary binds latest outcome', recorded.summary.latestOutcomeRef.sha256, recorded.outcome.receiptDigest);
equal('summary admits four system effects', recorded.summary.systemEffectsAdmitted, 4);
equal('summary admits four AI workflow benefits', recorded.summary.aiWorkflowBenefitsAdmitted, 4);
equal('summary admits no human benefit', recorded.summary.humanBenefitsAdmitted, 0);
deepEqual('summary next evidence remains human-native', recorded.summary.nextEvidenceNeeds, ['HUMAN_BENEFIT_NATIVE_EVIDENCE']);
equal('summary says no availability', recorded.summary.truth.availabilityGranted, false);
equal('summary says no human benefit', recorded.summary.truth.humanBenefitEstablished, false);

const beforeGap = read('CAPABILITY_GAP_BEFORE.json');
const afterGap = read('CAPABILITY_GAP_AFTER.json');
equal('capability route was blocked before evaluator', beforeGap.overall, 'BLOCKED');
deepEqual('two exact evaluator capabilities were missing', beforeGap.missingCapabilities, [
  'workflow.verification-evolution.evaluate',
  'workflow.verification-evolution.verify'
]);
equal('capability route is degraded only by optional evidence after', afterGap.overall, 'DEGRADED');
equal('no required capability remains missing', afterGap.missingCapabilities.length, 0);
equal('human evidence remains degraded', afterGap.requirements.find(item => item.id === 'human-beneficiary-outcome').status, 'DEGRADED');
equal('independent model evidence remains unknown', afterGap.requirements.find(item => item.id === 'independent-model-effectiveness').status, 'OPTIONAL_UNKNOWN');
equal('governed availability remains unknown', afterGap.requirements.find(item => item.id === 'governed-availability').status, 'OPTIONAL_UNKNOWN');

const changedEvaluation = clone(recorded.evaluation);
changedEvaluation.cases[0].candidateDecision = 'REJECT_OR_REWRITE_HISTORY';
equal('changed decision breaks exact evaluation verification', Builder.verifyEvaluation(changedEvaluation).pass, false);
const changedDigest = clone(recorded.evaluation);
changedDigest.receiptDigest = 'sha256:' + '0'.repeat(64);
equal('changed evaluation digest breaks verification', Builder.verifyEvaluation(changedDigest).pass, false);
const changedOutcome = clone(recorded.outcome);
changedOutcome.claims[0].statement += ' altered';
equal('changed outcome breaks receipt verification', Growth.verifyOutcome(changedOutcome).pass, false);
const lastOutcome = recorded.portfolio.outcomes[recorded.portfolio.outcomes.length - 1];
const brokenPreviousRef = clone(lastOutcome.previousOutcomeRef);
brokenPreviousRef.sha256 = 'sha256:' + 'f'.repeat(64);
const validButMislinkedOutcome = Growth.buildOutcome({
  outcomeId: lastOutcome.outcomeId,
  generatedAt: lastOutcome.generatedAt,
  cycleReceipt: lastOutcome.cycleReceipt,
  interventionRef: lastOutcome.interventionRef,
  previousOutcomeRef: brokenPreviousRef,
  noNewInformation: lastOutcome.noNewInformation,
  informationRefs: lastOutcome.informationRefs,
  claims: lastOutcome.claims,
  refresh: lastOutcome.refresh
});
const brokenAncestry = [...recorded.portfolio.outcomes.slice(0, -1), validButMislinkedOutcome];
throws('broken ancestry cannot rebuild portfolio', () => Growth.buildPortfolio({
  portfolioId: 'broken-ancestry',
  generatedAt: recorded.portfolio.generatedAt,
  outcomes: brokenAncestry
}), /ancestry mismatch/);

const syntheticHumanPass = Growth.buildOutcome({
  outcomeId: 'synthetic-human-route-attack',
  generatedAt: recorded.outcome.generatedAt,
  cycleReceipt: recorded.outcome.cycleReceipt,
  noNewInformation: false,
  informationRefs: aiClaim.evidenceRefs,
  claims: [{
    id: 'synthetic-human-pass',
    beneficiary: 'HUMAN',
    statement: 'Synthetic AI-workflow evidence is incorrectly presented as human benefit.',
    kind: 'WORKFLOW_OUTCOME',
    verdict: 'PASS',
    proofSurface: 'AI_WORKFLOW_EVALUATION',
    baselineRef: aiClaim.baselineRef,
    outcomeRef: aiClaim.outcomeRef,
    evidenceRefs: aiClaim.evidenceRefs,
    evidenceClosure: aiClaim.evidenceClosure,
    limitations: ['Deliberate negative fixture.']
  }],
  refresh: { checkedAt: recorded.outcome.generatedAt, due: false, reason: 'negative route test' }
});
equal('synthetic human pass is held', syntheticHumanPass.claims[0].routeStatus, 'HOLD');
equal('synthetic human pass is not admitted', syntheticHumanPass.claims[0].admittedVerdict, 'UNKNOWN');
check('human-native evidence reason is explicit', syntheticHumanPass.claims[0].routeReasons.includes('HUMAN_BENEFIT_REQUIRES_BENEFICIARY_NATIVE_EVIDENCE'));
equal('synthetic human route makes evidence hold', syntheticHumanPass.state, 'EVIDENCE_HOLD');

const serialized = JSON.stringify(recorded);
equal('no machine path serialized', /[A-Za-z]:[\\/]/.test(serialized), false);
equal('no authority smuggled through receipt', recorded.outcome.truth.receiptAuthority, 'BENEFICIARY_OUTCOME_LINKING_ONLY');
check('verification receipt rebuilds exactly', Verification.verify(recordedVerification).pass);
equal('verification result is bounded pass', recordedVerification.result, 'PASS_WITH_DECLARED_LIMITS');
equal('all required checks recorded passed', recordedVerification.requiredChecks.passed, 10);
equal('verification retains candidate outcome state', recordedVerification.currentState.latestOutcomeState, 'CANDIDATE_ONLY');

console.log('PASS verification evolution Grounded Growth selftest (' + assertions + ' assertions)');
