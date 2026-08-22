#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const Frontier = require('../../../shared/grounded-growth-frontier-gate/grounded-growth-frontier-gate');

const workshop = path.resolve(__dirname, '../../..');

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(workshop, relativePath), 'utf8'));
}

function writeJson(name, value) {
  fs.writeFileSync(path.join(__dirname, name), JSON.stringify(value, null, 2) + '\n');
}

const frontierInput = {
  frontierId: 'current-grounded-growth-frontier-20260819',
  generatedAt: '2026-08-19T14:25:00.000Z',
  portfolio: readJson('docs/steward-runs/2026-08-19-ai-workflow-coverage-refresh/CURRENT_PORTFOLIO.json'),
  directionHandoff: readJson('docs/steward-runs/2026-08-19-grounded-growth-direction-handoff/CURRENT_DIRECTION_HANDOFF.json'),
  humanHandoffReadiness: readJson('docs/steward-runs/2026-08-19-human-handoff-operational-readiness/CURRENT_HANDOFF_READINESS.json'),
  extensionHostProfile: readJson('docs/steward-runs/2026-08-19-simulation-lab-extension-intake/CURRENT_SIMULATION_LAB_HOST_PROFILE.json'),
  extensionReadiness: readJson('docs/steward-runs/2026-08-19-simulation-lab-extension-intake/CURRENT_EXTENSION_INTAKE_READINESS.json')
};

const campaign = readJson('docs/steward-runs/2026-08-19-voluntary-phone-qa-campaign/CURRENT_PHONE_QA_CAMPAIGN.json');
const gameId = campaign.nextAction.nextGameId;
const gameManifest = readJson('tools/game-hub/game-library/' + gameId + '/game.manifest.json');
const phoneEvidenceInput = {
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

const evidenceFrontierInput = {
  evidenceFrontierId: 'current-grounded-growth-evidence-frontier-20260819',
  generatedAt: '2026-08-19T16:00:00.000Z',
  frontierReceipt: readJson('docs/steward-runs/2026-08-19-grounded-growth-frontier-gate/CURRENT_FRONTIER_RECEIPT.json'),
  frontierInput,
  phoneEvidenceGate: readJson('docs/steward-runs/2026-08-19-phone-grounded-growth-evidence-gate/CURRENT_PHONE_GROUNDED_GROWTH_READINESS.json'),
  phoneEvidenceInput
};

const challengerReadinessInput = {
  readinessId: 'current-grounded-growth-challenger-readiness-20260819',
  generatedAt: '2026-08-19T13:05:00.000Z',
  directionHandoff: frontierInput.directionHandoff,
  directionReadiness: readJson('docs/steward-runs/2026-08-19-grounded-growth-direction-handoff/CURRENT_DIRECTION_READINESS.json'),
  shadowContract: readJson('tools/repair-resilience-library/components/shadow-simulator/module.contract.json'),
  diagnosticContract: readJson('tools/repair-resilience-library/components/diagnostic-experiment-runner/module.contract.json'),
  plans: [],
  evaluations: []
};

const stewardshipInput = {
  stewardshipFrontierId: 'current-grounded-growth-stewardship-frontier-20260819',
  generatedAt: '2026-08-19T16:40:00.000Z',
  evidenceFrontierReceipt: readJson('docs/steward-runs/2026-08-19-grounded-growth-evidence-frontier/CURRENT_EVIDENCE_FRONTIER_RECEIPT.json'),
  evidenceFrontierInput,
  challengerReadiness: readJson('docs/steward-runs/2026-08-19-grounded-growth-challenger-lab/CURRENT_CHALLENGER_READINESS.json'),
  challengerReadinessInput
};

const requirements = {
  requirements: [
    {
      id: 'native-balanced-source-verification',
      capabilities: [
        'growth.challenger.readiness-exact-rebuild',
        'growth.stewardship.evidence-frontier-exact-rebuild',
        'growth.stewardship.challenger-readiness-exact-rebuild',
        'growth.stewardship.direction-ancestry-bind'
      ],
      required: true
    },
    {
      id: 'beneficiary-and-learning-non-conflation',
      capabilities: [
        'growth.stewardship.ai-human-balance-visible',
        'growth.stewardship.readiness-not-learning',
        'growth.stewardship.ai-not-human-substitution'
      ],
      required: true
    },
    {
      id: 'bounded-authority',
      capabilities: ['growth.stewardship.authority.none'],
      required: true
    },
    {
      id: 'live-portfolio-human-evidence',
      capabilities: ['growth.human-evidence.live'],
      required: false
    },
    {
      id: 'live-phone-device-evidence',
      capabilities: ['growth.phone-evidence.current-device-key.pass'],
      required: false
    },
    {
      id: 'live-phone-human-evidence',
      capabilities: ['growth.phone-evidence.current-human-key.pass'],
      required: false
    },
    {
      id: 'current-non-wait-direction',
      capabilities: ['growth.direction.non-wait.current'],
      required: false
    },
    {
      id: 'current-challenger-evaluation',
      capabilities: ['growth.challenger.evaluation.current'],
      required: false
    },
    {
      id: 'current-extension-candidate',
      capabilities: ['simulation.extension.candidate-package.received'],
      required: false
    }
  ]
};

const before = {
  capabilities: [
    {
      id: 'growth.frontier.evidence.current', status: 'available',
      constraints: ['The exact four-lane evidence frontier already exposes portfolio, human, extension and phone evidence.']
    },
    {
      id: 'growth.challenger.readiness.audit-digest', status: 'degraded',
      constraints: ['Challenger readiness existed as an audit-local digest without a native exact-rebuild module contract.']
    },
    { id: 'growth.human-evidence.live', status: 'degraded', constraints: ['No portfolio human-benefit claim is PASS.'] },
    { id: 'growth.phone-evidence.current-device-key.pass', status: 'degraded', constraints: ['No bound physical-phone observation exists.'] },
    { id: 'growth.phone-evidence.current-human-key.pass', status: 'degraded', constraints: ['No admitted human-usefulness outcome exists for the phone surface.'] },
    { id: 'growth.direction.non-wait.current', status: 'degraded', constraints: ['All four current directions are WAIT_FOR_EVIDENCE.'] },
    { id: 'growth.challenger.evaluation.current', status: 'degraded', constraints: ['No current challenger plan or evaluation exists.'] },
    { id: 'simulation.extension.candidate-package.received', status: 'degraded', constraints: ['No explicit extension candidate was supplied.'] }
  ]
};

const provided = [
  ['growth.challenger.readiness-exact-rebuild', 'Challenger readiness rebuilds from the exact verified direction, readiness, organ contracts, plans and evaluations.'],
  ['growth.stewardship.evidence-frontier-exact-rebuild', 'The balanced frontier accepts the human/device evidence frontier only through exact rebuild verification.'],
  ['growth.stewardship.challenger-readiness-exact-rebuild', 'The balanced frontier accepts challenger readiness only through its native exact rebuild verifier.'],
  ['growth.stewardship.direction-ancestry-bind', 'Both balanced sources must bind the exact same direction handoff digest.'],
  ['growth.stewardship.ai-human-balance-visible', 'AI-workflow and human evidence counts are exposed independently in one receipt.'],
  ['growth.stewardship.readiness-not-learning', 'Lab readiness and evaluation presence do not become model learning or broad generalization.'],
  ['growth.stewardship.ai-not-human-substitution', 'AI challenger evidence cannot become human benefit or shared growth by substitution.'],
  ['growth.stewardship.authority.none', 'The receipt grants no participation, execution, adoption, write, install, promotion, merge, CANON or Foundation authority.']
];

const after = {
  capabilities: [
    ...before.capabilities,
    ...provided.map(([id, constraint]) => ({ id, status: 'available', constraints: [constraint] }))
  ]
};

const receipt = Frontier.buildStewardshipFrontier(stewardshipInput);
writeJson('CAPABILITY_REQUIREMENTS.json', requirements);
writeJson('CAPABILITY_INVENTORY_BEFORE.json', before);
writeJson('CAPABILITY_INVENTORY_AFTER.json', after);
writeJson('CURRENT_STEWARDSHIP_FRONTIER_RECEIPT.json', receipt);

console.log('PASS current Grounded Growth stewardship frontier built');
console.log('portfolio=' + receipt.counts.portfolioCapabilityChains + ' aiPass=' + receipt.counts.portfolioAiWorkflowPass + ' humanPass=' + receipt.counts.portfolioHumanPass);
console.log('phoneDevice=' + receipt.counts.phoneDeviceBehaviorPass + ' phoneHuman=' + receipt.counts.phoneHumanUsefulnessPass);
console.log('challengerDirections=' + receipt.counts.challengerActionableDirections + ' plans=' + receipt.counts.challengerPlans + ' evaluations=' + receipt.counts.challengerEvaluations);

module.exports = {
  frontierInput,
  phoneEvidenceInput,
  evidenceFrontierInput,
  challengerReadinessInput,
  stewardshipInput,
  requirements,
  before,
  after,
  receipt
};
