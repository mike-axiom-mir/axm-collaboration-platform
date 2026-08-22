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

const evidenceInput = {
  evidenceFrontierId: 'current-grounded-growth-evidence-frontier-20260819',
  generatedAt: '2026-08-19T16:00:00.000Z',
  frontierReceipt: readJson('docs/steward-runs/2026-08-19-grounded-growth-frontier-gate/CURRENT_FRONTIER_RECEIPT.json'),
  frontierInput,
  phoneEvidenceGate: readJson('docs/steward-runs/2026-08-19-phone-grounded-growth-evidence-gate/CURRENT_PHONE_GROUNDED_GROWTH_READINESS.json'),
  phoneEvidenceInput
};

const requirements = {
  requirements: [
    {
      id: 'exact-native-composition',
      capabilities: [
        'growth.frontier.composite.frontier-exact-rebuild-verify',
        'growth.frontier.composite.phone-gate-exact-rebuild-verify',
        'growth.frontier.composite.exact-source-bind'
      ],
      required: true
    },
    {
      id: 'supplemental-route-non-conflation',
      capabilities: [
        'growth.frontier.composite.supplemental-not-portfolio',
        'growth.frontier.composite.phone-two-key-not-shared-growth'
      ],
      required: true
    },
    {
      id: 'bounded-current-decision',
      capabilities: [
        'growth.frontier.composite.no-manufactured-action',
        'growth.frontier.composite.authority.none'
      ],
      required: true
    },
    {
      id: 'current-physical-phone-evidence',
      capabilities: ['growth.phone-evidence.current-device-key.pass'],
      required: false
    },
    {
      id: 'current-phone-human-usefulness',
      capabilities: ['growth.phone-evidence.current-human-key.pass'],
      required: false
    },
    {
      id: 'current-phone-two-key-evidence',
      capabilities: ['growth.phone-evidence.current-combined.pass'],
      required: false
    }
  ]
};

const before = {
  capabilities: [
    {
      id: 'growth.frontier.current.exact-rebuild',
      status: 'available',
      constraints: ['The three-lane frontier already verifies its exact portfolio, direction, voluntary-human, and extension inputs.']
    },
    {
      id: 'growth.phone-evidence.current.exact-rebuild',
      status: 'available',
      constraints: ['The phone evidence gate already verifies device behavior and human usefulness as independent keys.']
    },
    {
      id: 'growth.frontier.phone-route.visibility',
      status: 'degraded',
      constraints: ['The phone evidence route was not visible in the current frontier decision surface.']
    },
    {
      id: 'growth.phone-evidence.current-device-key.pass',
      status: 'degraded',
      constraints: ['No voluntary physical-phone observation candidate has been captured.']
    },
    {
      id: 'growth.phone-evidence.current-human-key.pass',
      status: 'degraded',
      constraints: ['No admitted voluntary human-usefulness outcome exists for the exact game surface.']
    },
    {
      id: 'growth.phone-evidence.current-combined.pass',
      status: 'degraded',
      constraints: ['Neither independent phone evidence key currently passes.']
    }
  ]
};

const provided = [
  ['growth.frontier.composite.frontier-exact-rebuild-verify', 'The composite accepts the original frontier only through its exact native rebuild verifier.'],
  ['growth.frontier.composite.phone-gate-exact-rebuild-verify', 'The composite accepts the phone evidence gate only through its exact native rebuild verifier.'],
  ['growth.frontier.composite.exact-source-bind', 'The receipt binds both exact source digests and refuses source receipts that postdate it.'],
  ['growth.frontier.composite.supplemental-not-portfolio', 'The phone route is visible as a supplemental fourth lane while the portfolio remains four capability chains.'],
  ['growth.frontier.composite.phone-two-key-not-shared-growth', 'Even complete device plus human keys remain scoped evidence and are not relabeled as shared growth or model learning.'],
  ['growth.frontier.composite.no-manufactured-action', 'Incomplete supplemental evidence preserves the original bounded frontier decision.'],
  ['growth.frontier.composite.authority.none', 'The composite grants no participation, execution, write, install, promotion, merge, CANON, or Foundation authority.']
];

const after = {
  capabilities: [
    ...before.capabilities,
    ...provided.map(([id, constraint]) => ({ id, status: 'available', constraints: [constraint] }))
  ]
};

const receipt = Frontier.buildEvidenceFrontier(evidenceInput);
writeJson('CAPABILITY_REQUIREMENTS.json', requirements);
writeJson('CAPABILITY_INVENTORY_BEFORE.json', before);
writeJson('CAPABILITY_INVENTORY_AFTER.json', after);
writeJson('CURRENT_EVIDENCE_FRONTIER_RECEIPT.json', receipt);

console.log('PASS current integrated Grounded Growth evidence frontier built');
console.log('portfolioCapabilities=' + receipt.counts.portfolioCapabilityChains + ' supplementalPhoneRoutes=' + receipt.counts.supplementalPhoneEvidenceRoutes);
console.log('phoneDevicePass=' + receipt.counts.phoneDeviceBehaviorPass + ' phoneHumanPass=' + receipt.counts.phoneHumanUsefulnessPass + ' phoneTwoKey=' + receipt.counts.phoneTwoKeyEvidencePresent);
console.log('autonomousActions=' + receipt.decision.autonomousActionCount + ' reviewableActions=' + receipt.decision.reviewableActionCount);

module.exports = { frontierInput, phoneEvidenceInput, evidenceInput, requirements, before, after, receipt };
