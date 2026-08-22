#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const Participation = require('../../../shared/grounded-growth-participation-frontier/grounded-growth-participation-frontier');
const Human = require('../../../shared/human-benefit-evidence/human-benefit-evidence');
const Bridge = require('../../../shared/grounded-growth-human-bridge-v2/grounded-growth-human-bridge-v2');
const Current = require('./build-current-participation-frontier');
const Verification = require('./build-verification-receipt');

const ROOT = path.resolve(__dirname, '../../..');
const COMPARE = path.join(process.env.USERPROFILE || '', '.codex', 'skills', 'detect-capability-gaps', 'scripts', 'compare_capabilities.py');
let checks = 0;

function check(condition, label) {
  checks += 1;
  assert.ok(condition, label);
  console.log('PASS ' + label);
}

function readJson(name) {
  return JSON.parse(fs.readFileSync(path.join(__dirname, name), 'utf8'));
}

function comparison(inventoryName) {
  const result = spawnSync('python', [
    COMPARE,
    '--requirements', path.join(__dirname, 'CAPABILITY_REQUIREMENTS.json'),
    '--capabilities', path.join(__dirname, inventoryName)
  ], { cwd: ROOT, encoding: 'utf8' });
  assert.strictEqual(result.status, 0, result.stderr || result.stdout);
  return JSON.parse(result.stdout);
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

const input = Current.currentInput();
const current = Current.current();
const rebuilt = Current.build();
const summary = readJson('CURRENT_SUMMARY.json');
const gap = readJson('CAPABILITY_GAP_REPORT.json');
const portfolio = input.knowledgeFrontierInput.stewardshipFrontierInput.evidenceFrontierInput.frontierInput.portfolio;
const outcome = portfolio.outcomes.find(item => item.outcomeId === current.sourceRefs.groundedResearchOutcome.id);

check(Participation.verifyParticipationFrontier(current, input).pass, 'current participation frontier verifies by exact rebuild');
check(Participation.stableStringify(current) === Participation.stableStringify(rebuilt), 'stored frontier equals a fresh current rebuild');
check(Participation.stableStringify(summary) === Participation.stableStringify(Current.summary(rebuilt)), 'stored summary equals a fresh rebuild');
check(summary.summaryDigest === Participation.sha256(Object.fromEntries(Object.entries(summary).filter(([key]) => key !== 'summaryDigest'))), 'summary digest rebuilds exactly');
check(current.status === 'TEST' && summary.truth.automaticCanon === false, 'receipt and summary remain TEST with no CANON authority');

check(current.counts.priorLanes === 6 && current.counts.totalLanes === 7, 'current frontier adds exactly one seventh lane');
check(current.lanes.length === 7 && current.lanes[6].id === 'RESEARCH_VOLUNTARY_HUMAN_HANDOFF', 'current seventh lane is the voluntary research handoff');
check(Participation.stableStringify(current.lanes.slice(0, 6)) === Participation.stableStringify(input.knowledgeFrontierReceipt.lanes), 'all six knowledge-frontier lanes remain exact');
check(current.counts.researchArtifacts === 7 && current.counts.researchModelSeats === 4, 'seven artifacts and four model seats remain visible');
check(current.counts.retainedResearchSignals === 6 && current.counts.boundedResearchAiWorkflowPass === 1, 'six signals and one bounded AI pass remain visible');
check(current.counts.researchHumanBenefitPass === 0, 'research human-benefit PASS remains zero');
check(current.counts.availableOptionalHandoffs === 1 && current.counts.reviewCandidates === 1, 'one exact optional handoff is reviewable');
check(current.counts.participantTrials === 6, 'current answer-free packet contains six trials');

const lane = current.lanes[6];
check(lane.state === 'READY_TO_REVIEW_OPTIONAL_LOCAL_SESSION', 'current lane is review-ready only');
check(lane.capabilityId === outcome.capabilityId && lane.humanClaimId === input.protocol.claim.id, 'lane capability and claim match the current outcome and protocol');
check(lane.protocolRef.sha256 === input.protocol.protocolDigest, 'lane protocol digest is exact');
check(lane.participantPacketRef.sha256 === input.participantPacket.packetDigest, 'lane packet digest is exact');
check(lane.interventionLinkRef.sha256 === input.interventionLink.linkDigest, 'lane link digest is exact');
check(lane.currentOutcomeRef.sha256 === outcome.receiptDigest, 'lane outcome digest is exact');
check(lane.ancestryMode === 'REUSE_EXISTING', 'reuse-existing capability ancestry is preserved');
check(lane.humanEvidenceState === 'NOT_RUN' && lane.humanBenefitEstablished === false, 'human evidence and benefit remain absent');
check(lane.reviewIsParticipation === false && lane.packetReadinessIsHumanEvidence === false, 'review and readiness do not become evidence');
check(lane.participationStartedAutomatically === false, 'participation has not started automatically');

check(Human.verifyProtocol(input.protocol).pass, 'current protocol verifies natively');
check(Participation.verifyParticipantPacket(input.participantPacket, input.protocol, outcome).pass, 'current participant packet verifies by exact rebuild');
check(Bridge.verifyInterventionLink(input.interventionLink, outcome.cycleReceipt, input.protocol).pass, 'current intervention link verifies natively');
check(current.participationBinding.knowledgeOutcomeMatchesPacket, 'knowledge outcome and packet are cross-bound');
check(current.participationBinding.outcomeCycleMatchesReadiness, 'outcome cycle and readiness are cross-bound');
check(current.participationBinding.humanClaimMatchesProtocol, 'human claim and protocol are cross-bound');
check(current.participationBinding.readinessRouteReferencesMatch, 'all readiness route references match');

check(current.balance.voluntaryResearchHumanHandoffReady === true, 'technical voluntary handoff is ready');
check(current.balance.liveResearchHumanEvidencePresent === false, 'live research human evidence remains absent');
check(current.balance.researchHumanBenefitEstablished === false, 'research human benefit remains unestablished');
check(current.balance.groundedGrowthForAiAndHumansEstablished === false, 'balanced AI-and-human growth remains unestablished');
check(current.balance.unresolvedEvidence.length === 9, 'all nine evidence seams remain visible');
check(current.balance.unresolvedEvidence.includes('RESEARCH_HUMAN_BENEFIT_NATIVE_EVIDENCE'), 'research human-benefit evidence is still required');
check(current.balance.resolvedTechnicalSeams.length === 1, 'only one technical binding seam is resolved');

check(current.decision.autonomousActionCount === 0, 'current frontier grants zero autonomous action');
check(current.decision.reviewableActionCount === 1 && current.decision.optionalHandoffReviewCount === 1, 'current frontier exposes one reviewable optional handoff');
check(current.decision.currentBestAction === 'REVIEW_OPTIONAL_RESEARCH_HUMAN_HANDOFF_OR_WAIT', 'current best action is review-or-wait');
check(current.decision.participationRequiresNewEvent === true, 'participation still requires a new voluntary event');
check(current.decision.externalEventsThatMayChangeFrontier.includes('VOLUNTARY_RESEARCH_SESSION_OPT_IN'), 'opt-in event remains explicit');
check(current.decision.externalEventsThatMayChangeFrontier.includes('VOLUNTARY_RESEARCH_SESSION_WITHDRAWAL'), 'withdrawal event remains explicit');

check(current.truth.knowledgeFrontierVerifiedByExactRebuild && current.truth.exactResearchOutcomeCrossBound, 'knowledge and outcome ancestry are exact');
check(current.truth.participantPacketVerifiedByExactRebuild && current.truth.interventionLinkVerifiedNatively, 'packet and link use their native proof surfaces');
check(current.truth.reviewCandidateIsHumanBenefit === false && current.truth.packetReadinessIsParticipation === false, 'candidate and packet cannot substitute for a human outcome');
check(current.truth.aiWorkflowEvidenceIsHumanBenefit === false && current.truth.sharedGrowthClaimed === false, 'AI evidence is not human benefit or shared growth');
check(current.truth.automaticParticipation === false && current.truth.automaticExecution === false && current.truth.automaticWrite === false, 'no participation execution or write is automatic');
check(current.truth.automaticPromotion === false && current.truth.automaticMerge === false && current.truth.automaticCanon === false, 'no promotion merge or CANON is automatic');

const before = comparison('CAPABILITY_INVENTORY_BEFORE.json');
const after = comparison('CAPABILITY_INVENTORY_AFTER.json');
check(before.overall === gap.before.overall && before.missingCapabilities.length === 10, 'before comparator proves ten exact required capabilities missing');
check(before.missingCapabilities.every(id => gap.before.missingCapabilities.includes(id)), 'durable before gap summary matches comparator output');
check(after.overall === gap.after.overall && after.missingCapabilities.length === 0, 'after comparator proves every required capability available');
check(after.requirements.filter(item => item.required).every(item => item.status === 'READY'), 'all required after requirements are READY');
check(after.requirements.filter(item => !item.required && item.status === 'DEGRADED').length === 1, 'LIVE human outcome remains the single degraded optional requirement');
check(gap.truth.liveHumanEvidenceHidden === false && gap.truth.sharedGrowthClaimed === false, 'gap transition preserves absent human evidence and shared-growth truth');

const falseBenefit = clone(current);
falseBenefit.counts.researchHumanBenefitPass = 1;
check(!Participation.verifyParticipationFrontier(falseBenefit, input).pass, 'fabricated stored human benefit fails exact verification');
const falseParticipation = clone(current);
falseParticipation.lanes[6].reviewIsParticipation = true;
check(!Participation.verifyParticipationFrontier(falseParticipation, input).pass, 'fabricated stored participation fails exact verification');
const falseAuthority = clone(current);
falseAuthority.decision.autonomousActionCount = 1;
check(!Participation.verifyParticipationFrontier(falseAuthority, input).pass, 'fabricated stored autonomous action fails exact verification');

const verification = readJson('VERIFICATION_RECEIPT.json');
check(Verification.verify(verification).pass, 'verification receipt and every declared source digest rebuild exactly');
check(verification.focused.explicitAssertions === 144 && verification.adjacent.explicitAssertions === 346 && verification.totalExplicitAssertions === 490, 'verification receipt preserves passing focused and adjacent assertion totals');
check(verification.requiredChecks.passed === 10 && verification.requiredChecks.failed === 0, 'all ten required checks are recorded PASS');
check(verification.broadVerification.verdict === 'VERIFIED_WITH_LIMITS' && verification.broadVerification.warningGroups === 2 && verification.broadVerification.failures === 0, 'broad verifier warnings remain visible without failures');
check(verification.currentState.totalLanes === 7 && verification.currentState.researchHumanBenefitPass === 0 && verification.currentState.reviewCandidates === 1, 'verification receipt preserves the current bounded participation state');
check(verification.correctedInvocations.length === 1 && verification.correctedInvocations[0].correctedVerdict === 'PASS' && verification.preservedAdjacentDrift.length === 1, 'test-environment correction and preserved historical drift remain visible');
check(verification.boundaries.humanBenefitClaimed === false && verification.boundaries.automaticCanon === false, 'verification receipt grants no human-benefit or CANON authority');

[
  'CAPABILITY_REQUIREMENTS.json', 'CAPABILITY_INVENTORY_BEFORE.json',
  'CAPABILITY_INVENTORY_AFTER.json', 'CAPABILITY_GAP_REPORT.json',
  'CURRENT_PARTICIPATION_FRONTIER_RECEIPT.json', 'CURRENT_SUMMARY.json'
].forEach(name => check(!!readJson(name), name + ' parses as JSON'));

console.log('Grounded Growth Participation Frontier audit selftest passed: ' + checks + ' checks.');
