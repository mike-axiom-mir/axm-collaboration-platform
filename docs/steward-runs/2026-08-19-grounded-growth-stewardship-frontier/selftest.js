#!/usr/bin/env node
'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const Challenger = require('../../../shared/grounded-growth-challenger-lab/grounded-growth-challenger-lab');
const Frontier = require('../../../shared/grounded-growth-frontier-gate/grounded-growth-frontier-gate');
const build = require('./build-current-stewardship-frontier');

function read(name) {
  return JSON.parse(fs.readFileSync(path.join(__dirname, name), 'utf8'));
}

let checks = 0;
function check(condition, label) {
  assert.ok(condition, label);
  checks += 1;
  console.log('PASS ' + label);
}

const receipt = read('CURRENT_STEWARDSHIP_FRONTIER_RECEIPT.json');
const gapBefore = read('CAPABILITY_GAP_BEFORE.json');
const gapAfter = read('CAPABILITY_GAP_AFTER.json');

check(Challenger.verifyReadiness(build.stewardshipInput.challengerReadiness, build.challengerReadinessInput).pass, 'current challenger readiness verifies by exact native rebuild');
check(Frontier.verifyEvidenceFrontier(build.stewardshipInput.evidenceFrontierReceipt, build.evidenceFrontierInput).pass, 'current evidence frontier verifies by exact native rebuild');
check(Frontier.verifyStewardshipFrontier(receipt, build.stewardshipInput).pass, 'current stewardship frontier verifies by exact native rebuild');
check(receipt.schema === Frontier.STEWARDSHIP_FRONTIER_SCHEMA && receipt.status === 'TEST', 'balanced frontier remains a TEST receipt');
check(receipt.sourceRefs.evidenceFrontier.sha256 === build.stewardshipInput.evidenceFrontierReceipt.evidenceFrontierDigest, 'balanced frontier binds the exact evidence frontier');
check(receipt.sourceRefs.challengerReadiness.sha256 === build.stewardshipInput.challengerReadiness.receiptDigest, 'balanced frontier binds exact challenger readiness');
check(build.stewardshipInput.challengerReadiness.sourceRefs.directionHandoff.sha256 === build.frontierInput.directionHandoff.handoffDigest, 'AI challenger and human evidence routes share exact direction ancestry');
check(receipt.counts.portfolioCapabilityChains === 4 && receipt.counts.portfolioAiWorkflowPass === 4, 'all four current portfolio chains retain AI-workflow PASS evidence');
check(receipt.counts.portfolioHumanPass === 0 && receipt.counts.phoneHumanUsefulnessPass === 0, 'portfolio and phone human evidence remain zero PASS');
check(receipt.counts.phoneDeviceBehaviorPass === 0, 'phone device behavior remains not run');
check(receipt.counts.challengerActionableDirections === 0 && receipt.counts.challengerPlans === 0 && receipt.counts.challengerEvaluations === 0, 'challenger lane remains held with no plan or evaluation');
check(receipt.lanes.length === 5 && receipt.lanes[4].id === 'BOUNDED_AI_CHALLENGER_EVIDENCE', 'balanced frontier contains five independently typed lanes');
check(receipt.lanes[4].state === 'LAB_CAPABILITY_READY_CURRENT_DIRECTIONS_HELD' && receipt.lanes[4].readinessIsLearning === false, 'challenger readiness is visible without a learning claim');
check(receipt.balance.aiWorkflowPortfolioCoverageComplete === true, 'AI-workflow portfolio coverage is complete');
check(receipt.balance.portfolioHumanCoverageComplete === false && receipt.balance.anyScopedHumanEvidencePresent === false, 'human evidence absence remains explicit');
check(receipt.balance.sharedGrowthClaimAllowed === false && receipt.truth.sharedGrowthClaimed === false, 'shared growth remains unclaimed');
check(receipt.balance.unresolvedEvidence.length === 4, 'four exact beneficiary and challenger evidence seams remain open');
check(receipt.decision.autonomousActionCount === 0 && receipt.decision.reviewableActionCount === 0, 'current balanced frontier grants zero action');
check(receipt.decision.currentBestAction === 'WAIT_FOR_NEW_EVIDENCE_OR_EXPLICIT_CANDIDATE', 'current best action remains the bounded wait');
check(receipt.truth.challengerLabReadyIsLearning === false && receipt.truth.challengerEvaluationIsHumanBenefit === false, 'AI readiness and evaluation cannot substitute for learning or human benefit');
check(receipt.truth.automaticParticipation === false && receipt.truth.automaticExecution === false && receipt.truth.automaticCanon === false, 'participation, execution and CANON remain human-governed');
check(gapBefore.overall === 'BLOCKED' && gapBefore.missingCapabilities.length === 8, 'before comparison records eight missing required capabilities');
check(gapAfter.overall === 'READY' && gapAfter.missingCapabilities.length === 0, 'after comparison satisfies all required capabilities');
check(gapAfter.requirements.filter((item) => !item.required && item.status === 'DEGRADED').length === 6, 'six optional real-world evidence seams remain honestly degraded');

const verification = read('VERIFICATION_RECEIPT.json');
check(verification.schema === 'axm.grounded-growth-stewardship-frontier-verification-receipt/v1' && verification.status === 'TEST', 'verification receipt identity remains TEST');
check(verification.focused.explicitAssertions === 148 && verification.focused.commands.length === 3, 'verification receipt records all focused assertions');
check(verification.adjacent.explicitAssertions === 278 && verification.totalExplicitAssertions === 426, 'verification receipt records adjacent and total assertions');
check(verification.requiredChecks.passed === 10 && verification.requiredChecks.failed === 0, 'all required Workshop checks are recorded as passed');
check(verification.broadVerification.verdict === 'VERIFIED_WITH_LIMITS' && verification.broadVerification.failures === 0 && verification.broadVerification.holds === 0, 'broad result preserves declared limits without hidden failure');
check(verification.currentState.receiptDigest === receipt.stewardshipFrontierDigest, 'verification receipt binds the exact balanced frontier');
check(verification.browserVerification.verdict === 'NOT_RUN' && verification.boundaries.browserClaimed === false, 'no browser result is claimed for a non-UI increment');
check(verification.boundaries.sharedGrowthClaimed === false && verification.boundaries.canonicalStateTouched === false, 'shared-growth and CANON boundaries are recorded');
check(verification.sources.every((source) => {
  const digest = 'sha256:' + crypto.createHash('sha256').update(fs.readFileSync(path.join(path.resolve(__dirname, '../../..'), source.path))).digest('hex');
  return digest === source.sha256;
}), 'every current verification source digest matches current bytes');

console.log('Grounded Growth stewardship-frontier audit selftest passed: ' + checks + ' checks.');
