#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const Knowledge = require('../../../shared/grounded-growth-knowledge-frontier/grounded-growth-knowledge-frontier');

const ROOT = path.resolve(__dirname, '../../..');

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), 'utf8'));
}

function currentFrontierInput() {
  return {
    frontierId: 'current-grounded-growth-frontier-20260819',
    generatedAt: '2026-08-19T14:25:00.000Z',
    portfolio: readJson('docs/steward-runs/2026-08-19-ai-workflow-coverage-refresh/CURRENT_PORTFOLIO.json'),
    directionHandoff: readJson('docs/steward-runs/2026-08-19-grounded-growth-direction-handoff/CURRENT_DIRECTION_HANDOFF.json'),
    humanHandoffReadiness: readJson('docs/steward-runs/2026-08-19-human-handoff-operational-readiness/CURRENT_HANDOFF_READINESS.json'),
    extensionHostProfile: readJson('docs/steward-runs/2026-08-19-simulation-lab-extension-intake/CURRENT_SIMULATION_LAB_HOST_PROFILE.json'),
    extensionReadiness: readJson('docs/steward-runs/2026-08-19-simulation-lab-extension-intake/CURRENT_EXTENSION_INTAKE_READINESS.json')
  };
}

function currentPhoneInput() {
  const campaign = readJson('docs/steward-runs/2026-08-19-voluntary-phone-qa-campaign/CURRENT_PHONE_QA_CAMPAIGN.json');
  const gameId = campaign.nextAction.nextGameId;
  const gameManifest = readJson('tools/game-hub/game-library/' + gameId + '/game.manifest.json');
  return {
    gateId: 'current-phone-grounded-growth-evidence-gate-20260819',
    generatedAt: '2026-08-19T15:30:00.000Z',
    campaign,
    gameManifest,
    deviceEvidence: null,
    closureReport: null,
    binding: {
      capabilityId: 'game.' + gameId + '.physical-phone-controller-experience',
      humanClaimId: gameId + '-phone-experience-usefulness',
      targetScope: 'NAMED_LOCAL_STEWARD',
      scopeStatement: 'The named local steward using the exact ' + gameManifest.name + ' phone-controller surface.'
    },
    humanHandoff: null
  };
}

function currentChallengerInput(frontierInput) {
  return {
    readinessId: 'current-grounded-growth-challenger-readiness-20260819',
    generatedAt: '2026-08-19T13:05:00.000Z',
    directionHandoff: frontierInput.directionHandoff,
    directionReadiness: readJson('docs/steward-runs/2026-08-19-grounded-growth-direction-handoff/CURRENT_DIRECTION_READINESS.json'),
    shadowContract: readJson('tools/repair-resilience-library/components/shadow-simulator/module.contract.json'),
    diagnosticContract: readJson('tools/repair-resilience-library/components/diagnostic-experiment-runner/module.contract.json'),
    plans: [],
    evaluations: []
  };
}

function currentStewardshipInput() {
  const frontierInput = currentFrontierInput();
  const phoneEvidenceInput = currentPhoneInput();
  const evidenceFrontierInput = {
    evidenceFrontierId: 'current-grounded-growth-evidence-frontier-20260819',
    generatedAt: '2026-08-19T16:00:00.000Z',
    frontierReceipt: readJson('docs/steward-runs/2026-08-19-grounded-growth-frontier-gate/CURRENT_FRONTIER_RECEIPT.json'),
    frontierInput,
    phoneEvidenceGate: readJson('docs/steward-runs/2026-08-19-phone-grounded-growth-evidence-gate/CURRENT_PHONE_GROUNDED_GROWTH_READINESS.json'),
    phoneEvidenceInput
  };
  return {
    stewardshipFrontierId: 'current-grounded-growth-stewardship-frontier-20260819',
    generatedAt: '2026-08-19T16:40:00.000Z',
    evidenceFrontierReceipt: readJson('docs/steward-runs/2026-08-19-grounded-growth-evidence-frontier/CURRENT_EVIDENCE_FRONTIER_RECEIPT.json'),
    evidenceFrontierInput,
    challengerReadiness: readJson('docs/steward-runs/2026-08-19-grounded-growth-challenger-lab/CURRENT_CHALLENGER_READINESS.json'),
    challengerReadinessInput: currentChallengerInput(frontierInput)
  };
}

function currentInput() {
  return {
    knowledgeFrontierId: 'current-grounded-growth-knowledge-frontier-20260819',
    generatedAt: '2026-08-19T17:35:00.000Z',
    stewardshipFrontierReceipt: readJson('docs/steward-runs/2026-08-19-grounded-growth-stewardship-frontier/CURRENT_STEWARDSHIP_FRONTIER_RECEIPT.json'),
    stewardshipFrontierInput: currentStewardshipInput(),
    researchContributionAssessment: readJson('docs/steward-runs/2026-08-19-research-contribution-intake/CURRENT_RESEARCH_CONTRIBUTION_ASSESSMENT.json'),
    baselineCapsule: readJson('docs/steward-runs/2026-08-19-public-baseline-research-run/PUBLIC_BASELINE_CAPSULE.json')
  };
}

function build() {
  return Knowledge.buildKnowledgeFrontier(currentInput());
}

function current() {
  return readJson('docs/steward-runs/2026-08-19-grounded-growth-knowledge-frontier/CURRENT_KNOWLEDGE_FRONTIER_RECEIPT.json');
}

function summary(receipt) {
  const result = {
    schema: 'axm.grounded-growth-knowledge-frontier-summary/v1',
    generatedAt: receipt.generatedAt,
    frontierRef: {
      id: receipt.knowledgeFrontierId,
      schema: receipt.schema,
      sha256: receipt.knowledgeFrontierDigest
    },
    lanes: receipt.counts.totalLanes,
    knowledgeIntake: {
      state: receipt.lanes[5].state,
      artifacts: receipt.counts.researchArtifacts,
      modelSeats: receipt.counts.researchModelSeats,
      retainedSignals: receipt.counts.researchRetainedSignals,
      proposals: receipt.counts.researchProposals,
      warnings: receipt.counts.researchWarnings,
      holds: receipt.counts.researchHolds
    },
    evidence: {
      boundedAiWorkflowPass: receipt.counts.researchAiWorkflowPass,
      humanBenefitPass: receipt.counts.researchHumanPass,
      artifactMappingEstablished: receipt.balance.researchAttributionComplete,
      crossModelIndependenceEstablished: receipt.balance.crossModelIndependenceEstablished,
      groundedGrowthForAiAndHumansEstablished: receipt.balance.groundedGrowthForAiAndHumansEstablished,
      unresolvedEvidenceCount: receipt.balance.unresolvedEvidence.length
    },
    decision: receipt.decision,
    dispositionAlias: {
      baselineId: receipt.knowledgeBinding.baselineDispositionId,
      outcomeId: receipt.knowledgeBinding.outcomeDispositionId,
      exactContentIdentityMatches: receipt.knowledgeBinding.dispositionContentIdentityMatches
    },
    truth: {
      intakeReadyIsRuntimeEvidence: false,
      aiWorkflowPassIsModelLearning: false,
      aiWorkflowPassIsHumanBenefit: false,
      sharedGrowthClaimed: false,
      automaticAction: false,
      automaticCanon: false
    }
  };
  result.summaryDigest = Knowledge.sha256(result);
  return result;
}

function write() {
  const receipt = build();
  fs.writeFileSync(path.join(__dirname, 'CURRENT_KNOWLEDGE_FRONTIER_RECEIPT.json'), JSON.stringify(receipt, null, 2) + '\n');
  fs.writeFileSync(path.join(__dirname, 'CURRENT_SUMMARY.json'), JSON.stringify(summary(receipt), null, 2) + '\n');
  return receipt;
}

module.exports = {
  currentFrontierInput,
  currentPhoneInput,
  currentChallengerInput,
  currentStewardshipInput,
  currentInput,
  build,
  summary,
  current,
  write
};

if (require.main === module) {
  const receipt = process.argv.includes('--write') ? write() : build();
  process.stdout.write(JSON.stringify({
    state: receipt.decision.currentBestAction,
    lanes: receipt.counts.totalLanes,
    artifacts: receipt.counts.researchArtifacts,
    aiPass: receipt.counts.researchAiWorkflowPass,
    humanPass: receipt.counts.researchHumanPass,
    unresolvedEvidence: receipt.balance.unresolvedEvidence.length,
    digest: receipt.knowledgeFrontierDigest
  }, null, 2) + '\n');
}
