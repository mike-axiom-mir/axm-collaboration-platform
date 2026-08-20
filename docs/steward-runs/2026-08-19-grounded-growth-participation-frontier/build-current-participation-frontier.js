#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const Participation = require('../../../shared/grounded-growth-participation-frontier/grounded-growth-participation-frontier');
const KnowledgeCurrent = require('../2026-08-19-grounded-growth-knowledge-frontier/build-current-knowledge-frontier');
const HandoffCurrent = require('../2026-08-19-human-handoff-operational-readiness/build-current-handoff-readiness');
const PortfolioHuman = require('../2026-08-19-human-readiness-portfolio-coverage/build-portfolio-readiness');
const BridgeCurrent = require('../2026-08-19-reuse-existing-human-bridge-ancestry/build-current-readiness');

function oneRoute(routes, capabilityId) {
  const matches = routes.filter(route => route.definition.capabilityId === capabilityId);
  if (matches.length !== 1) throw new Error('expected exactly one current route for ' + capabilityId);
  return matches[0];
}

function currentInput() {
  const capabilityId = 'simulation.run-envelope.verify';
  const portfolioRoute = oneRoute(PortfolioHuman.verifyRecorded().routes, capabilityId);
  const bridgeRoute = oneRoute(BridgeCurrent.verifyRecorded().routes, capabilityId);
  return {
    participationFrontierId: 'current-grounded-growth-participation-frontier-20260819',
    generatedAt: '2026-08-19T18:25:00.000Z',
    knowledgeFrontierReceipt: KnowledgeCurrent.current(),
    knowledgeFrontierInput: KnowledgeCurrent.currentInput(),
    humanHandoffReadiness: HandoffCurrent.verifyRecorded().readiness,
    protocol: portfolioRoute.protocol,
    participantPacket: portfolioRoute.packet,
    interventionLink: bridgeRoute.link
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

