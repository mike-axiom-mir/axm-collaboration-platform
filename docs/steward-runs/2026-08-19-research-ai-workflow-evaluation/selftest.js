#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Growth = require('../../../shared/grounded-growth-outcomes/grounded-growth-outcomes');
const Builder = require('./build-research-ai-workflow');

let passed = 0;
function check(name, condition) {
  assert.ok(condition, name);
  passed += 1;
  process.stdout.write('PASS ' + name + '\n');
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function rebuildOutcome(receipt, overrides) {
  overrides = overrides || {};
  return Growth.buildOutcome({
    outcomeId: receipt.outcomeId,
    generatedAt: receipt.generatedAt,
    cycleReceipt: receipt.cycleReceipt,
    interventionRef: receipt.interventionRef,
    previousOutcomeRef: Object.prototype.hasOwnProperty.call(overrides, 'previousOutcomeRef') ? overrides.previousOutcomeRef : receipt.previousOutcomeRef,
    noNewInformation: receipt.noNewInformation,
    informationRefs: receipt.informationRefs,
    claims: overrides.claims || receipt.claims,
    refresh: receipt.refresh
  });
}

(() => {
  const fixturePath = path.join(__dirname, 'HELD_OUT_CASES.json');
  const fixtureBytesBefore = fs.readFileSync(fixturePath);
  const current = Builder.build();
  const recordedSummary = Builder.verifyRecorded();
  const fixtureBytesAfter = fs.readFileSync(fixturePath);
  const evaluation = current.evaluation;
  const research = current.researchOutcome;
  const portfolio = current.portfolio;
  const summary = current.summary;

  check('recorded artifacts rebuild exactly from current evidence', recordedSummary.summaryDigest === summary.summaryDigest);
  check('the evaluator does not mutate its frozen fixture bytes', fixtureBytesBefore.equals(fixtureBytesAfter));
  check('recorded evaluation matches the evaluator and frozen cases', Builder.verifyEvaluation(evaluation).pass);
  check('evaluation is routed as an AI workflow evaluation', evaluation.beneficiary === 'AI_WORKFLOW' && evaluation.proofSurface === 'AI_WORKFLOW_EVALUATION');
  check('evaluation contains eight representative cases', evaluation.cases.length === 8);
  check('shortcut baseline is correct on two of eight cases', evaluation.baseline.correctDecisions === 2 && evaluation.baseline.totalDecisions === 8);
  check('grounded guard is correct on all eight cases', evaluation.outcome.correctDecisions === 8 && evaluation.outcome.totalDecisions === 8);
  check('grounded guard reduces unsupported or unsafe decisions from six to zero', evaluation.baseline.unsupportedOrUnsafeDecisions === 6 && evaluation.outcome.unsupportedOrUnsafeDecisions === 0);
  check('every candidate result uses the fixture expected rule and decision', evaluation.cases.every(item => item.candidateCorrect && item.candidateDecision === item.expectedDecision && item.candidateRule === item.expectedRule));
  check('every evaluated case binds an exact existing source', evaluation.cases.every(item => /^sha256:[0-9a-f]{64}$/.test(item.sourceRef.sha256)));
  check('comparison baseline is not attributed to a named model', !/deepseek|openai|chatgpt|claude|sonnet|grok/i.test(JSON.stringify(evaluation.baseline)));
  check('evaluation claims no model invocation, weight change, or generalization', evaluation.truth.modelInvoked === false && evaluation.truth.modelWeightsChanged === false && evaluation.truth.modelGeneralizationClaimed === false);
  check('evaluation claims no human participant or human benefit', evaluation.truth.humanParticipant === false && evaluation.truth.humanBenefitClaimed === false);
  check('evaluation grants no execution, promotion, or CANON authority', evaluation.truth.automaticExecution === false && evaluation.truth.automaticPromotion === false && evaluation.truth.automaticCanon === false);

  const alteredEvaluation = clone(evaluation);
  alteredEvaluation.cases[0].candidateDecision = 'CONTINUE_WITH_CLAIM';
  check('changed candidate decision breaks exact evaluation verification', !Builder.verifyEvaluation(alteredEvaluation).pass);
  const alteredRule = clone(evaluation);
  alteredRule.cases[2].candidateRule = 'GOAL_LABEL_DEDUPLICATION';
  check('changed grounding rule breaks exact evaluation verification', !Builder.verifyEvaluation(alteredRule).pass);
  const alteredDigest = clone(evaluation);
  alteredDigest.receiptDigest = 'sha256:' + '0'.repeat(64);
  check('changed evaluation digest breaks exact verification', !Builder.verifyEvaluation(alteredDigest).pass);

  check('linked research outcome passes the native verifier', Growth.verifyOutcome(research).pass);
  check('linked outcome remains candidate-only because its cycle only reuses an existing capability', research.state === 'CANDIDATE_ONLY' && research.cycleReceipt.state === 'REUSE_EXISTING');
  check('linked outcome adds new information instead of using a no-new-information stop', research.noNewInformation === false && research.informationRefs.some(ref => ref.id === evaluation.evaluationId));
  check('linked outcome points to the exact prior public research receipt', research.previousOutcomeRef.id === 'grounded-growth-public-research-replay-20260819' && /^sha256:[0-9a-f]{64}$/.test(research.previousOutcomeRef.sha256));
  check('linked outcome preserves the exact prior cycle receipt', research.cycleReceipt.receiptDigest === 'sha256:7e09f01ff973c4fa2cab654ff9ba088ffbc5f3195b930db968421f605c155070');
  check('linked outcome preserves the admitted shared-system effect', research.claims.some(claim => claim.beneficiary === 'SHARED_SYSTEM' && claim.admittedVerdict === 'PASS'));
  check('linked outcome preserves human benefit as not run', research.claims.some(claim => claim.beneficiary === 'HUMAN' && claim.verdict === 'NOT_RUN' && claim.routeStatus === 'NOT_PROVEN'));
  const aiClaim = research.claims.find(claim => claim.beneficiary === 'AI_WORKFLOW');
  check('new AI workflow claim is admitted on the native proof surface', aiClaim.admittedVerdict === 'PASS' && aiClaim.routeStatus === 'ADMITTED' && aiClaim.proofSurface === 'AI_WORKFLOW_EVALUATION');
  check('AI workflow closure covers its baseline, outcome, and all evidence refs', [aiClaim.baselineRef, aiClaim.outcomeRef, ...aiClaim.evidenceRefs].every(ref => aiClaim.evidenceClosure.coveredDigests.includes(ref.sha256)));
  check('AI workflow claim repeats the no-model limitation', aiClaim.limitations.some(value => value.startsWith('No language model was invoked')));

  const wrongAiRoute = clone(research.claims);
  wrongAiRoute.find(claim => claim.beneficiary === 'AI_WORKFLOW').proofSurface = 'FOCUSED_RUNTIME';
  const heldAiRoute = rebuildOutcome(research, { claims: wrongAiRoute });
  check('component proof cannot replace the AI workflow proof route', heldAiRoute.state === 'EVIDENCE_HOLD' && heldAiRoute.claims.find(claim => claim.beneficiary === 'AI_WORKFLOW').admittedVerdict === 'UNKNOWN');
  const syntheticHuman = clone(research.claims);
  const humanClaim = syntheticHuman.find(claim => claim.beneficiary === 'HUMAN');
  humanClaim.verdict = 'PASS';
  humanClaim.proofSurface = 'AI_WORKFLOW_EVALUATION';
  humanClaim.baselineRef = aiClaim.baselineRef;
  humanClaim.outcomeRef = aiClaim.outcomeRef;
  humanClaim.evidenceRefs = aiClaim.evidenceRefs;
  humanClaim.evidenceClosure = aiClaim.evidenceClosure;
  const heldHumanRoute = rebuildOutcome(research, { claims: syntheticHuman });
  check('AI workflow evidence cannot be relabeled as human benefit', heldHumanRoute.state === 'EVIDENCE_HOLD' && heldHumanRoute.claims.find(claim => claim.beneficiary === 'HUMAN').admittedVerdict === 'UNKNOWN');
  const removedAncestry = rebuildOutcome(research, { previousOutcomeRef: null });
  check('portfolio refuses a later research outcome with missing ancestry', (() => { try { Growth.buildPortfolio({ portfolioId: portfolio.portfolioId, generatedAt: portfolio.generatedAt, outcomes: [...portfolio.outcomes.slice(0, -1), removedAncestry] }); return false; } catch (_) { return true; } })());

  check('refreshed portfolio passes its native verifier', Growth.verifyPortfolio(portfolio).pass);
  check('portfolio contains five outcomes for four capabilities', portfolio.summary.outcomeCount === 5 && portfolio.summary.capabilityCount === 4);
  check('latest research capability points to the new linked outcome', portfolio.latest.some(item => item.capabilityId === research.capabilityId && item.outcomeId === research.outcomeId));
  check('all portfolio outcomes remain candidate-only', portfolio.outcomes.every(outcome => outcome.state === 'CANDIDATE_ONLY'));
  check('portfolio refuses to relabel candidate evidence as available beneficiary growth', portfolio.summary.overall === 'CANDIDATES_OR_UNKNOWN_EFFECTS');
  check('effective portfolio has four admitted system effects', summary.systemEffectsAdmitted === 4);
  check('effective portfolio now has two admitted AI workflow outcomes', summary.aiWorkflowBenefitsAdmitted === 2);
  check('effective portfolio still has zero admitted human benefits', summary.humanBenefitsAdmitted === 0 && summary.truth.humanBenefitEstablished === false);
  check('summary says the voluntary human gate was untouched', summary.truth.voluntaryHumanGateTouched === false);
  check('summary refuses a model or weight improvement claim', summary.truth.modelOrWeightImprovementClaimed === false);
  check('summary preserves agreement-not-proof', summary.truth.crossModelAgreementTreatedAsProof === false);
  check('summary digest rebuilds exactly', (() => { const payload = clone(summary); delete payload.summaryDigest; return Growth.sha256(payload) === summary.summaryDigest; })());
  check('summary binds the exact refreshed portfolio', summary.portfolioRef.sha256 === portfolio.portfolioDigest);

  const authorityTamper = clone(portfolio);
  authorityTamper.truth.automaticCanon = true;
  check('portfolio CANON-authority tampering breaks verification', !Growth.verifyPortfolio(authorityTamper).pass);
  const outcomeDigestTamper = clone(research);
  outcomeDigestTamper.receiptDigest = 'sha256:' + 'f'.repeat(64);
  check('research outcome digest tampering breaks verification', !Growth.verifyOutcome(outcomeDigestTamper).pass);
  check('no outcome claims model-weight training', portfolio.outcomes.every(outcome => outcome.truth.modelWeightTrainingClaimed === false));
  check('no outcome grants execution, promotion, CANON, or root mutation', portfolio.outcomes.every(outcome => !outcome.truth.automaticExecution && !outcome.truth.automaticPromotion && !outcome.truth.automaticCanon && !outcome.truth.automaticRootMutation));
  check('persistent artifacts contain no personal machine path', !/[A-Z]:\\Users\\|\/home\//i.test(JSON.stringify(current)));
  check('builder is read-only and exposes no filesystem write operation', !/writeFile|appendFile|rmSync|unlinkSync|renameSync|mkdirSync/.test(fs.readFileSync(path.join(__dirname, 'build-research-ai-workflow.js'), 'utf8')));

  process.stdout.write('\nResearch AI workflow evaluation audit: PASS (' + passed + ' checks)\n');
})()
