#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Verification = require('./build-verification-receipt');

let checks = 0;
function check(value, message) {
  assert.ok(value, message);
  checks += 1;
}

const receipt = JSON.parse(fs.readFileSync(path.join(__dirname, 'VERIFICATION_RECEIPT.json'), 'utf8'));
const checkResults = JSON.parse(fs.readFileSync(path.join(__dirname, 'CHECK_RESULTS.json'), 'utf8'));
check(Verification.verify(receipt).pass, 'verification receipt and every stable source reference rebuild exactly');
check(receipt.status === 'TEST' && receipt.result === 'PASS_WITH_DECLARED_LIMITS', 'result remains TEST with declared limits');
check(receipt.portfolio.outcomes === 10 && receipt.portfolio.currentCapabilityChains === 6, 'verification binds the exact ten-outcome, six-chain portfolio');
check(receipt.portfolio.appendedByThisIncrement === 0 && receipt.portfolio.selfReferentialChoiceOutcomeAvoided, 'choice support creates no recursive outcome chain');
check(receipt.reconciliation.state === 'CURRENT_NEUTRAL_OPTION_MENU_WITH_EXPLICIT_HOLDS', 'current reconciliation state is exact');
check(receipt.reconciliation.olderOptionalReviewCandidates === 1, 'the older single research candidate remains visible as historical source state');
check(receipt.reconciliation.currentAvailableChoices === 5 && receipt.reconciliation.currentHeldChoices === 1, 'all six current chains have one exact choice disposition');
check(receipt.reconciliation.missingChoiceDispositions === 0 && receipt.reconciliation.oldSingleCandidateTreatedAsCompleteMenu === false, 'the older candidate is not mistaken for the complete current menu');
check(receipt.selection.state === 'NO_SELECTION_EVENT' && receipt.selection.policy === 'HUMAN_CHOOSES_ONE_OR_MORE_OR_WAIT', 'selection policy remains voluntary and event-bound');
check(receipt.selection.defaultChoiceId === null && receipt.selection.rankedChoices === 0, 'no default, ranking, or recommendation is created');
check(receipt.selection.preselectedChoices === 0 && receipt.selection.selectedChoices === 0, 'nothing is preselected or selected');
check(receipt.selection.waitAllowed && receipt.selection.optOutHasNoPenalty, 'wait and opt-out remain first-class choices');
check(receipt.selection.explicitHumanRequestRequiredBeforeMenuOrPrompt && receipt.selection.automaticPrompt === false, 'no menu or prompt is pushed without a new request');
check(receipt.selection.autonomousActionCount === 0 && receipt.selection.reviewableActionCount === 0, 'the frontier grants no action or review pressure');
check(receipt.evidenceBalance.technicalPassSignals === 12 && receipt.evidenceBalance.currentHumanPassSignals === 0, 'technical and human evidence remain separately counted');
check(receipt.evidenceBalance.technicalEvidenceAheadOfHumanEvidence, 'technical evidence asymmetry remains visible');
check(receipt.evidenceBalance.currentRoutesCoverEveryHumanClaim && receipt.evidenceBalance.humanNotRun === 6, 'every claim has a disposition while all human verdicts remain NOT_RUN');
check(receipt.evidenceBalance.groundedGrowthForAiAndHumansEstablished === false, 'shared AI-and-human growth is not overclaimed');
check(receipt.capabilityGap.before === 'BLOCKED' && receipt.capabilityGap.after === 'DEGRADED', 'the required choice gap closes without hiding optional unknowns');
check(receipt.capabilityGap.requiredMissingAfter === 0, 'no required capability remains missing');
check(receipt.capabilityGap.explicitHumanSelectionEvent === 'OPTIONAL_UNKNOWN', 'live human selection remains optional unknown');
check(receipt.capabilityGap.liveHumanBenefit === 'OPTIONAL_UNKNOWN', 'live human benefit remains optional unknown');
check(receipt.capabilityGap.humanSourceAuthentication === 'OPTIONAL_UNKNOWN', 'human source authentication remains optional unknown');
check(receipt.focusedAndAdjacent.total === 17 && receipt.focusedAndAdjacent.passed === 17 && receipt.focusedAndAdjacent.failed === 0, 'all seventeen focused and adjacent checks pass');
check(receipt.focusedAndAdjacent.explicitAssertions === checkResults.summary.explicitAssertions && receipt.focusedAndAdjacent.explicitAssertions > 500, 'counted focused assertions match the compact check receipt');
check(receipt.requiredChecks.total === 10 && receipt.requiredChecks.passed === 10 && receipt.requiredChecks.failed === 0, 'all ten required Workshop checks pass');
check(receipt.broadVerification.verdict === 'VERIFIED_WITH_LIMITS' && receipt.broadVerification.failures === 0, 'broad verification retains limits with no failures');
check(['RECOGNIZED_MUTABLE_DERIVED_VIEW_DRIFT', 'CURRENT_EXACT'].includes(receipt.historicalEvolution.classification), 'prior verification evolution is exactly classified');
check(receipt.historicalEvolution.historicalReceiptRewritten === false, 'historical verification receipt remains unchanged');
check(receipt.browserVerification.applicable === false && receipt.browserVerification.verdict === 'NOT_RUN', 'browser verification is honestly not applicable');
check(receipt.declaredLimits.length >= 7, 'verification preserves explicit evidence and authority limits');
check(Object.values(receipt.boundaries).every((value) => value === false), 'verification grants no participation, source, lifecycle, model, or CANON authority');
check(!/[A-Za-z]:[\\/]/.test(JSON.stringify(receipt)), 'verification receipt contains no machine path');
check(Verification.SOURCE_FILES.every((file) => fs.existsSync(path.join(Verification.ROOT, file))), 'every declared stable source exists');
check(receipt.sourceRefs.length === Verification.SOURCE_FILES.length, 'stable source reference count is exact');

console.log('PASS Grounded Growth voluntary-choice frontier verification selftest (' + checks + ' assertions)');
