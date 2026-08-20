#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const Participation = require('../../../shared/grounded-growth-participation-frontier/grounded-growth-participation-frontier');
const KnowledgeCurrent = require('../2026-08-19-grounded-growth-knowledge-frontier/build-current-knowledge-frontier');
const PortfolioHuman = require('../2026-08-19-human-readiness-portfolio-coverage/build-portfolio-readiness');

function currentInput() {
  const capabilityId = 'simulation.run-envelope.verify';
  const portfolioRoute = PortfolioHuman.loadRecordedRoute(capabilityId);
  const interventionLink = JSON.parse(fs.readFileSync(path.join(
    __dirname,
    '../2026-08-19-reuse-existing-human-bridge-ancestry/links/research-grounded-disposition-intervention-link.json'
  ), 'utf8'));
  const humanHandoffReadiness = JSON.parse(fs.readFileSync(path.join(
    __dirname,
    '../2026-08-19-human-handoff-operational-readiness/CURRENT_HANDOFF_READINESS.json'
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

function build() {
  return Participation.buildParticipationFrontier(currentInput());
}

function current() {
  return JSON.parse(fs.readFileSync(path.join(__dirname, 'CURRENT_PARTICIPATION_FRONTIER_RECEIPT.json'), 'utf8'));
}

function summary(receipt) {
  const result = {
    schema: 'axm.grounded-growth-participation-frontier-summary/v1',
    generatedAt: receipt.generatedAt,
    frontierRef: {
      id: receipt.participationFrontierId,
      schema: receipt.schema,
      sha256: receipt.participationFrontierDigest
    },
    lanes: receipt.counts.totalLanes,
    knowledge: {
      researchArtifacts: receipt.counts.researchArtifacts,
      modelSeats: receipt.counts.researchModelSeats,
      retainedSignals: receipt.counts.retainedResearchSignals,
      boundedAiWorkflowPass: receipt.counts.boundedResearchAiWorkflowPass
    },
    voluntaryHumanHandoff: {
      state: receipt.lanes[6].state,
      targetScope: receipt.lanes[6].targetScope,
      participantTrials: receipt.counts.participantTrials,
      reviewCandidates: receipt.counts.reviewCandidates,
      liveHumanEvidence: receipt.balance.liveResearchHumanEvidencePresent,
      humanBenefitEstablished: receipt.balance.researchHumanBenefitEstablished
    },
    evidence: {
      technicalBindingReady: receipt.balance.voluntaryResearchHumanHandoffReady,
      groundedGrowthForAiAndHumansEstablished: receipt.balance.groundedGrowthForAiAndHumansEstablished,
      unresolvedEvidenceCount: receipt.balance.unresolvedEvidence.length,
      resolvedTechnicalSeams: receipt.balance.resolvedTechnicalSeams
    },
    decision: receipt.decision,
    truth: {
      reviewIsParticipation: false,
      packetReadinessIsHumanEvidence: false,
      aiWorkflowPassIsHumanBenefit: false,
      sharedGrowthClaimed: false,
      automaticParticipation: false,
      automaticAction: false,
      automaticCanon: false
    }
  };
  result.summaryDigest = Participation.sha256(result);
  return result;
}

function write() {
  const receipt = build();
  fs.writeFileSync(path.join(__dirname, 'CURRENT_PARTICIPATION_FRONTIER_RECEIPT.json'), JSON.stringify(receipt, null, 2) + '\n');
  fs.writeFileSync(path.join(__dirname, 'CURRENT_SUMMARY.json'), JSON.stringify(summary(receipt), null, 2) + '\n');
  return receipt;
}

module.exports = { currentInput, build, current, summary, write };

if (require.main === module) {
  const receipt = process.argv.includes('--write') ? write() : build();
  process.stdout.write(JSON.stringify({
    state: receipt.decision.currentBestAction,
    lanes: receipt.counts.totalLanes,
    reviewCandidates: receipt.counts.reviewCandidates,
    humanPass: receipt.counts.researchHumanBenefitPass,
    unresolvedEvidence: receipt.balance.unresolvedEvidence.length,
    digest: receipt.participationFrontierDigest
  }, null, 2) + '\n');
}
