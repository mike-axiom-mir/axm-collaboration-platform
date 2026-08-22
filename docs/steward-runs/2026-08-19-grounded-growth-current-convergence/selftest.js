#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Current = require('../../../shared/grounded-growth-current-state/grounded-growth-current-state');
const Participation = require('../2026-08-19-grounded-growth-participation-frontier/build-current-participation-frontier');
const Evolution = require('../2026-08-19-verification-evolution-grounded-growth/build-verification-evolution-growth');
const Builder = require('./build-current-convergence');
const Verification = require('./build-verification-receipt');

let checks = 0;
function ok(condition, message) {
  assert.ok(condition, message);
  checks += 1;
}

function readJson(name) {
  return JSON.parse(fs.readFileSync(path.join(__dirname, name), 'utf8'));
}

const built = Builder.verifyRecorded();
const input = Builder.currentInput();
const receipt = readJson('CURRENT_STATE_RECEIPT.json');
const summary = readJson('CURRENT_SUMMARY.json');
const before = readJson('CAPABILITY_GAP_BEFORE.json');
const after = readJson('CAPABILITY_GAP_AFTER.json');
const requirements = readJson('CAPABILITY_REQUIREMENTS.json');
const inventoryBefore = readJson('CAPABILITY_INVENTORY_BEFORE.json');
const inventoryAfter = readJson('CAPABILITY_INVENTORY_AFTER.json');

ok(Current.verify(receipt, input).pass, 'recorded receipt verifies against exact current sources');
ok(Current.stableStringify(built.receipt) === Current.stableStringify(receipt), 'fresh receipt equals recorded receipt');
ok(Current.stableStringify(built.summary) === Current.stableStringify(summary), 'fresh summary equals recorded summary');
ok(receipt.state === 'CURRENT_CONVERGED', 'current sources converge');
ok(receipt.portfolioEvolution.state === 'VALID_FORWARD_EXTENSION', 'portfolio relation is a valid forward extension');
ok(receipt.portfolioEvolution.baseOutcomeCount === 7, 'participation source contains seven outcomes');
ok(receipt.portfolioEvolution.currentOutcomeCount === 8, 'latest portfolio contains eight outcomes');
ok(receipt.portfolioEvolution.appendedOutcomeCount === 1, 'one later outcome is appended');
ok(receipt.portfolioEvolution.historicalOutcomeBytesPreserved, 'all seven earlier outcomes remain byte-identical');
ok(receipt.portfolioEvolution.capabilityCountBefore === 4 && receipt.portfolioEvolution.capabilityCountCurrent === 4, 'capability identity count remains four');

const currentParticipation = Participation.current();
const currentPortfolio = Evolution.build().portfolio;
ok(receipt.sourceRefs.participationFrontier.sha256 === currentParticipation.participationFrontierDigest, 'participation frontier digest is exact');
ok(receipt.sourceRefs.latestPortfolio.sha256 === currentPortfolio.portfolioDigest, 'latest portfolio digest is exact');
ok(receipt.portfolioEvolution.appendedOutcomeRefs[0].id === 'grounded-growth-verification-evolution-ai-workflow-20260819', 'new source-evolution outcome is named');
ok(receipt.portfolioEvolution.appendedOutcomeRefs[0].sha256 === currentPortfolio.outcomes[7].receiptDigest, 'new outcome digest is exact');

ok(receipt.participationBinding.state === 'PRESERVED', 'unaffected human handoff binding is preserved');
ok(receipt.participationBinding.protectedCapabilityIds.length === 1, 'one human handoff capability is protected');
ok(receipt.participationBinding.affectedProtectedCapabilityIds.length === 0, 'new outcome does not advance the protected chain');
ok(receipt.participationBinding.optionalReviewCandidates === 1, 'one optional review candidate remains');
ok(receipt.participationBinding.humanEvidencePresent === false, 'readiness is not human evidence');
ok(receipt.participationBinding.humanBenefitEstablished === false, 'human benefit is not established');

ok(receipt.currentEvidence.sharedSystemPass === 4, 'four shared-system passes remain current');
ok(receipt.currentEvidence.aiWorkflowPass === 4, 'four AI-workflow passes remain current');
ok(receipt.currentEvidence.humanPass === 0, 'human pass count remains zero');
ok(receipt.currentEvidence.humanNotRun === 4, 'all four capability chains remain human not-run');
ok(receipt.currentEvidence.portfolioOverall === 'CANDIDATES_OR_UNKNOWN_EFFECTS', 'portfolio remains bounded candidates or unknown effects');
ok(receipt.currentEvidence.unresolvedEvidence.length === 10, 'ten distinct unresolved evidence seams remain visible');

ok(receipt.decision.autonomousActionCount === 0, 'no autonomous action is created');
ok(receipt.decision.reviewableActionCount === 1, 'one optional human review remains visible');
ok(receipt.decision.currentBestAction === 'REVIEW_OPTIONAL_RESEARCH_HUMAN_HANDOFF_OR_WAIT', 'review-or-wait remains the bounded action');
ok(receipt.decision.participationRequiresNewEvent, 'participation still requires a new event');

ok(receipt.truth.sourceReceiptsVerifiedByExactRebuild, 'source receipts were natively rebuilt');
ok(receipt.truth.historicalOutcomeBytesPreserved && !receipt.truth.priorFrontierRewritten, 'history is preserved without rewriting the prior frontier');
ok(!receipt.truth.reviewIsParticipation && !receipt.truth.readinessIsHumanEvidence, 'review and readiness boundaries remain false');
ok(!receipt.truth.aiWorkflowPassIsHumanBenefit && !receipt.truth.humanBenefitClaimed, 'AI evidence is not relabeled as human benefit');
ok(!receipt.truth.automaticExecution && !receipt.truth.automaticPromotion && !receipt.truth.automaticCanon, 'no execution, promotion, or CANON authority exists');

ok(before.overall === 'BLOCKED' && before.missingCapabilities.length === 5, 'before comparator records five required missing capabilities');
ok(after.overall === 'DEGRADED' && after.missingCapabilities.length === 0, 'after comparator closes all required gaps');
ok(after.requirements.filter((item) => item.required).every((item) => item.status === 'READY'), 'all required groups are READY after the leaf');
ok(after.requirements.find((item) => item.id === 'native-human-benefit').status === 'OPTIONAL_UNKNOWN', 'live human evidence remains optional unknown');
ok(requirements.requirements.length === 5, 'capability requirement set has five groups');
ok(inventoryBefore.capabilities.length === 3 && inventoryAfter.capabilities.length === 6, 'before and after inventories remain bounded');

const summaryPayload = JSON.parse(JSON.stringify(summary));
const summaryDigest = summaryPayload.summaryDigest;
delete summaryPayload.summaryDigest;
ok(Current.sha256(summaryPayload) === summaryDigest, 'summary digest is internally valid');
ok(summary.truth.currentTechnicalAndHumanReadinessVisibleTogether, 'summary exposes both technical and human-readiness lanes');
ok(summary.truth.humanBenefitEstablished === false && summary.truth.reviewStarted === false, 'summary preserves not-run human truth');
ok(summary.truth.automaticAction === false && summary.truth.automaticCanon === false, 'summary creates no action or CANON authority');

const verification = readJson('VERIFICATION_RECEIPT.json');
ok(Verification.verify(verification).pass, 'verification receipt and every declared source digest rebuild exactly');
ok(verification.result === 'PASS_WITH_DECLARED_LIMITS', 'verification result preserves declared limits');
ok(verification.focused.explicitAssertions === 88 && verification.adjacent.explicitAssertions === 217, 'focused and adjacent assertion totals are exact');
ok(verification.totalExplicitAssertions === 305, 'verification records 305 explicit assertions');
ok(verification.requiredChecks.passed === 10 && verification.requiredChecks.failed === 0, 'all ten required checks are recorded PASS');
ok(verification.broadVerification.verdict === 'VERIFIED_WITH_LIMITS' && verification.broadVerification.failures === 0, 'broad verification keeps limits visible without failures');
ok(verification.knownHistoricalDrift.classification === 'RECOGNIZED_MUTABLE_DERIVED_VIEW_DRIFT', 'historical audit drift is explicitly classified');
ok(verification.boundaries.humanBenefitEstablished === false && verification.boundaries.canonized === false, 'verification creates neither human benefit nor CANON');

console.log('PASS grounded growth current convergence audit (' + checks + ' assertions)');
