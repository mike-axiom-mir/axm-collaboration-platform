#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Participation = require('./grounded-growth-participation-frontier');
const KnowledgeCurrent = require('../../docs/steward-runs/2026-08-19-grounded-growth-knowledge-frontier/build-current-knowledge-frontier');
const PortfolioHuman = require('../../docs/steward-runs/2026-08-19-human-readiness-portfolio-coverage/build-portfolio-readiness');

let checks = 0;

function check(condition, label) {
  checks += 1;
  assert.ok(condition, label);
  console.log('PASS ' + label);
}

function checkThrows(fn, pattern, label) {
  checks += 1;
  assert.throws(fn, pattern, label);
  console.log('PASS ' + label);
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function currentInput() {
  const capabilityId = 'simulation.run-envelope.verify';
  const portfolioRoute = PortfolioHuman.loadRecordedRoute(capabilityId);
  const interventionLink = JSON.parse(fs.readFileSync(path.join(
    __dirname,
    '../../docs/steward-runs/2026-08-19-reuse-existing-human-bridge-ancestry/links/research-grounded-disposition-intervention-link.json'
  ), 'utf8'));
  const humanHandoffReadiness = JSON.parse(fs.readFileSync(path.join(
    __dirname,
    '../../docs/steward-runs/2026-08-19-human-handoff-operational-readiness/CURRENT_HANDOFF_READINESS.json'
  ), 'utf8'));
  return {
    participationFrontierId: 'current-grounded-growth-participation-frontier-20260819',
    generatedAt: '2026-08-19T18:25:00.000Z',
    knowledgeFrontierReceipt: KnowledgeCurrent.current(),
    knowledgeFrontierInput: KnowledgeCurrent.currentInput(),
    humanHandoffReadiness,
    protocol: portfolioRoute.protocol,
    participantPacket: portfolioRoute.packet,
    interventionLink
  };
}

const contract = JSON.parse(fs.readFileSync(path.join(__dirname, 'module.contract.json'), 'utf8'));
const schema = JSON.parse(fs.readFileSync(path.join(__dirname, 'grounded-growth-participation-frontier-receipt.schema.json'), 'utf8'));
check(contract.status === 'TEST' && contract.permissions.length === 0, 'contract is permissionless TEST');
check(contract.provides.includes('growth.participation-frontier.knowledge-exact-rebuild'), 'contract provides knowledge exact rebuild');
check(contract.provides.includes('growth.participation-frontier.participant-packet-exact-rebuild'), 'contract provides packet exact rebuild');
check(contract.provides.includes('growth.participation-frontier.intervention-link-native-verify'), 'contract provides native link verification');
check(contract.provides.includes('growth.participation-frontier.ai-human-evidence-separate'), 'contract separates AI and human evidence');
check(contract.boundaries.refuses.includes('packet-readiness-as-human-evidence'), 'contract refuses packet readiness as human evidence');
check(contract.boundaries.refuses.includes('automatic-participation') && contract.boundaries.refuses.includes('automatic-canon'), 'contract refuses automatic participation and CANON');
check(contract.consumes.includes('strict-deterministic-canonical-json') && contract.boundaries.refuses.includes('undefined-or-non-json-representable-state'), 'contract declares strict representation closure');
check(Participation.stableStringify({ z: 1, a: [true, null] }) === '{"a":[true,null],"z":1}', 'safe canonical bytes remain exact');
checkThrows(() => Participation.stableStringify({ lost: undefined }), /unsupported undefined/i, 'unsafe canonical state is refused');
check(schema.$id === Participation.PARTICIPATION_FRONTIER_SCHEMA && schema.additionalProperties === false, 'receipt schema id and closed top level match');

const input = currentInput();
const receipt = Participation.buildParticipationFrontier(input);
check(Participation.verifyParticipationFrontier(receipt, input).pass, 'current participation frontier verifies by exact rebuild');
check(receipt.schema === Participation.PARTICIPATION_FRONTIER_SCHEMA && receipt.version === '0.1.0', 'receipt schema and version match');
check(receipt.status === 'TEST' && receipt.scope === 'CURRENT_RESEARCH_KNOWLEDGE_AND_VOLUNTARY_HUMAN_HANDOFF', 'receipt remains scoped TEST');
check(receipt.counts.priorLanes === 6 && receipt.counts.totalLanes === 7 && receipt.lanes.length === 7, 'exactly one seventh lane is added');
check(Participation.stableStringify(receipt.lanes.slice(0, 6)) === Participation.stableStringify(input.knowledgeFrontierReceipt.lanes), 'all six prior lanes are preserved exactly');
check(receipt.counts.researchArtifacts === 7 && receipt.counts.researchModelSeats === 4, 'research artifact and seat counts are preserved');
check(receipt.counts.retainedResearchSignals === 6 && receipt.counts.boundedResearchAiWorkflowPass === 1, 'retained signals and bounded AI pass are preserved');
check(receipt.counts.researchHumanBenefitPass === 0, 'research human-benefit PASS remains zero');
check(receipt.counts.availableOptionalHandoffs === 1 && receipt.counts.reviewCandidates === 1, 'one exact optional handoff is reviewable');
check(receipt.counts.participantTrials === 6, 'participant packet exposes six answer-free trials');

const lane = receipt.lanes[6];
check(lane.id === 'RESEARCH_VOLUNTARY_HUMAN_HANDOFF', 'seventh lane has the research human-handoff identity');
check(lane.state === 'READY_TO_REVIEW_OPTIONAL_LOCAL_SESSION', 'seventh lane is ready only for optional review');
check(lane.capabilityId === 'simulation.run-envelope.verify' && lane.humanClaimId === 'public-research-replay-human-benefit', 'lane binds the exact capability and human claim');
check(lane.targetScope === 'NAMED_LOCAL_STEWARD', 'lane remains named-local scope');
check(lane.protocolRef.sha256 === input.protocol.protocolDigest, 'lane binds the exact protocol digest');
check(lane.participantPacketRef.sha256 === input.participantPacket.packetDigest, 'lane binds the exact packet digest');
check(lane.interventionLinkRef.sha256 === input.interventionLink.linkDigest, 'lane binds the exact intervention link digest');
check(lane.currentOutcomeRef.id === input.knowledgeFrontierReceipt.knowledgeBinding.researchOutcomeId, 'lane binds the exact knowledge outcome');
check(lane.ancestryMode === 'REUSE_EXISTING', 'lane preserves reuse-existing ancestry');
check(lane.humanEvidenceState === 'NOT_RUN' && lane.humanBenefitEstablished === false, 'lane preserves absent human evidence');
check(lane.reviewIsParticipation === false && lane.packetReadinessIsHumanEvidence === false, 'review and packet readiness are not evidence');
check(lane.participationStartedAutomatically === false && lane.automatic === false, 'lane starts nothing automatically');

check(receipt.participationBinding.knowledgeOutcomeMatchesPacket, 'packet is cross-bound to the knowledge outcome');
check(receipt.participationBinding.outcomeCycleMatchesReadiness, 'cycle is cross-bound to readiness');
check(receipt.participationBinding.humanClaimMatchesProtocol, 'human claim is cross-bound to protocol');
check(receipt.participationBinding.protocolVerifiedNatively, 'protocol is verified natively');
check(receipt.participationBinding.participantPacketVerifiedByExactRebuild, 'packet is verified by exact rebuild');
check(receipt.participationBinding.interventionLinkVerifiedNatively, 'intervention link is verified natively');
check(receipt.participationBinding.readinessRouteReferencesMatch, 'readiness route references all match');
check(receipt.participationBinding.responseInputSchema === 'axm.human-benefit-response-input/v1', 'response boundary remains typed');

check(receipt.balance.voluntaryResearchHumanHandoffReady === true, 'voluntary research handoff is technically ready');
check(receipt.balance.liveResearchHumanEvidencePresent === false && receipt.balance.researchHumanBenefitEstablished === false, 'live human evidence and benefit remain absent');
check(receipt.balance.groundedGrowthForAiAndHumansEstablished === false, 'balanced AI-and-human growth remains unestablished');
check(receipt.balance.unresolvedEvidence.length === 9, 'all nine evidence seams remain visible');
check(receipt.balance.unresolvedEvidence.includes('RESEARCH_HUMAN_BENEFIT_NATIVE_EVIDENCE'), 'research human-benefit evidence seam remains open');
check(receipt.balance.resolvedTechnicalSeams.length === 1 && receipt.balance.resolvedTechnicalSeams[0] === 'RESEARCH_VOLUNTARY_HANDOFF_EXACT_BINDING', 'only the technical handoff binding is resolved');

check(receipt.decision.autonomousActionCount === 0, 'participation frontier grants zero autonomous action');
check(receipt.decision.reviewableActionCount === 1 && receipt.decision.optionalHandoffReviewCount === 1, 'one optional handoff review candidate is exposed');
check(receipt.decision.currentBestAction === 'REVIEW_OPTIONAL_RESEARCH_HUMAN_HANDOFF_OR_WAIT', 'best action is review-or-wait');
check(receipt.decision.participationRequiresNewEvent === true, 'participation requires a new external event');
check(receipt.decision.externalEventsThatMayChangeFrontier.includes('VOLUNTARY_RESEARCH_SESSION_OPT_IN'), 'voluntary opt-in is explicit');
check(receipt.decision.externalEventsThatMayChangeFrontier.includes('VOLUNTARY_RESEARCH_SESSION_WITHDRAWAL'), 'voluntary withdrawal is explicit');

check(receipt.truth.knowledgeFrontierVerifiedByExactRebuild && receipt.truth.exactResearchOutcomeCrossBound, 'knowledge and outcome ancestry are verified');
check(receipt.truth.reviewCandidateIsHumanBenefit === false && receipt.truth.packetReadinessIsParticipation === false, 'review candidate is neither benefit nor participation');
check(receipt.truth.packetReadinessIsHumanEvidence === false && receipt.truth.aiWorkflowEvidenceIsHumanBenefit === false, 'packet and AI evidence cannot substitute for human evidence');
check(receipt.truth.humanBenefitClaimed === false && receipt.truth.sharedGrowthClaimed === false, 'no human-benefit or shared-growth claim is made');
check(receipt.truth.automaticParticipation === false && receipt.truth.automaticExecution === false && receipt.truth.automaticWrite === false, 'no participation execution or write is automatic');
check(receipt.truth.automaticPromotion === false && receipt.truth.automaticMerge === false && receipt.truth.automaticCanon === false, 'no promotion merge or CANON authority is granted');

const rebuiltPacket = Participation.buildParticipantPacket({
  packetId: input.participantPacket.packetId,
  protocol: input.protocol,
  outcome: input.knowledgeFrontierInput.stewardshipFrontierInput.evidenceFrontierInput.frontierInput.portfolio.outcomes
    .find(outcome => outcome.outcomeId === input.knowledgeFrontierReceipt.knowledgeBinding.researchOutcomeId)
});
check(Participation.stableStringify(rebuiltPacket) === Participation.stableStringify(input.participantPacket), 'recorded participant packet rebuilds exactly');
check(Participation.verifyParticipantPacket(input.participantPacket, input.protocol,
  input.knowledgeFrontierInput.stewardshipFrontierInput.evidenceFrontierInput.frontierInput.portfolio.outcomes
    .find(outcome => outcome.outcomeId === input.knowledgeFrontierReceipt.knowledgeBinding.researchOutcomeId)).pass, 'recorded participant packet verifies');
check(!Participation.stableStringify(input.participantPacket).includes('expectedDecision'), 'participant packet contains no expected decisions');
check(!Participation.stableStringify(input.participantPacket).includes('\"BASELINE\"') && !Participation.stableStringify(input.participantPacket).includes('\"CANDIDATE\"'), 'participant packet contains no condition roles');

const packetTamper = clone(input);
packetTamper.participantPacket.trials[0].prompt = 'tampered prompt';
checkThrows(() => Participation.buildParticipationFrontier(packetTamper), /participant packet invalid/, 'tampered participant prompt is refused');
const packetLeak = clone(input);
packetLeak.participantPacket.trials[0].expectedDecision = 'HOLD';
checkThrows(() => Participation.buildParticipationFrontier(packetLeak), /participant packet invalid/, 'answer leakage is refused');
const protocolTamper = clone(input);
protocolTamper.protocol.claim.statement = 'different human claim';
checkThrows(() => Participation.buildParticipationFrontier(protocolTamper), /protocol invalid|protocol does not bind/, 'tampered protocol claim is refused');
const linkTamper = clone(input);
linkTamper.interventionLink.linkDigest = 'sha256:' + '0'.repeat(64);
checkThrows(() => Participation.buildParticipationFrontier(linkTamper), /intervention link invalid/, 'tampered intervention link is refused');
const readinessTamper = clone(input);
readinessTamper.humanHandoffReadiness.receiptDigest = 'sha256:' + '0'.repeat(64);
checkThrows(() => Participation.buildParticipationFrontier(readinessTamper), /readiness digest mismatch/, 'tampered readiness digest is refused');
const readinessHuman = clone(input);
readinessHuman.humanHandoffReadiness.truth.humanBenefitClaimed = true;
delete readinessHuman.humanHandoffReadiness.receiptDigest;
readinessHuman.humanHandoffReadiness.receiptDigest = Participation.sha256(readinessHuman.humanHandoffReadiness);
checkThrows(() => Participation.buildParticipationFrontier(readinessHuman), /truth mismatch: humanBenefitClaimed/, 'self-consistent false human benefit is refused');
const routeTamper = clone(input);
routeTamper.humanHandoffReadiness.routes.find(route => route.capabilityId === 'simulation.run-envelope.verify').packetRef.sha256 = 'sha256:' + '1'.repeat(64);
delete routeTamper.humanHandoffReadiness.receiptDigest;
routeTamper.humanHandoffReadiness.receiptDigest = Participation.sha256(routeTamper.humanHandoffReadiness);
checkThrows(() => Participation.buildParticipationFrontier(routeTamper), /packet reference mismatch/, 'self-consistent cross-route packet reference is refused');
const outcomeTamper = clone(input);
outcomeTamper.participantPacket.capabilityBinding.currentOutcomeRef.id = 'another-outcome';
checkThrows(() => Participation.buildParticipationFrontier(outcomeTamper), /participant packet invalid/, 'cross-outcome packet is refused');
const extraInput = clone(input);
extraInput.automaticRun = true;
checkThrows(() => Participation.buildParticipationFrontier(extraInput), /unsupported field/, 'undeclared automatic-run input is refused');
const predating = clone(input);
predating.generatedAt = '2026-08-19T10:00:00.000Z';
checkThrows(() => Participation.buildParticipationFrontier(predating), /cannot predate/, 'participation frontier cannot predate its sources');
const falseBenefit = clone(receipt);
falseBenefit.truth.humanBenefitClaimed = true;
check(!Participation.verifyParticipationFrontier(falseBenefit, input).pass, 'fabricated human benefit fails exact verification');
const falseAuthority = clone(receipt);
falseAuthority.decision.autonomousActionCount = 1;
check(!Participation.verifyParticipationFrontier(falseAuthority, input).pass, 'fabricated autonomous action fails exact verification');
const falseParticipation = clone(receipt);
falseParticipation.lanes[6].reviewIsParticipation = true;
check(!Participation.verifyParticipationFrontier(falseParticipation, input).pass, 'fabricated participation fails exact verification');

console.log('Grounded Growth Participation Frontier selftest passed: ' + checks + ' checks.');
