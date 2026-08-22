#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const Gate = require('../../../shared/grounded-growth-phone-evidence-gate/grounded-growth-phone-evidence-gate');

const workshop = path.resolve(__dirname, '../../..');

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(workshop, relativePath), 'utf8'));
}

function writeJson(name, value) {
  fs.writeFileSync(path.join(__dirname, name), JSON.stringify(value, null, 2) + '\n');
}

const campaign = readJson('docs/steward-runs/2026-08-19-voluntary-phone-qa-campaign/CURRENT_PHONE_QA_CAMPAIGN.json');
const gameId = campaign.nextAction.nextGameId;
const gameManifest = readJson('tools/game-hub/game-library/' + gameId + '/game.manifest.json');
const binding = {
  capabilityId: 'game.' + gameId + '.physical-phone-controller-experience',
  humanClaimId: gameId + '-phone-experience-usefulness',
  targetScope: 'NAMED_LOCAL_STEWARD',
  scopeStatement: 'The named local steward using the exact ' + gameManifest.name + ' phone-controller surface.'
};

const gateInput = {
  gateId: 'current-phone-grounded-growth-evidence-gate-20260819',
  generatedAt: '2026-08-19T15:30:00.000Z',
  campaign,
  gameManifest,
  deviceEvidence: null,
  closureReport: null,
  binding,
  humanHandoff: null
};

const requirements = {
  requirements: [
    {
      id: 'campaign-and-device-binding',
      capabilities: ['growth.phone-evidence.campaign-native-bind', 'growth.phone-evidence.device-native-verify'],
      required: true
    },
    {
      id: 'warning-closure-separation',
      capabilities: ['growth.phone-evidence.manifest-warning-closure-bind'],
      required: true
    },
    {
      id: 'human-outcome-native-route',
      capabilities: ['growth.phone-evidence.human-outcome-native-verify'],
      required: true
    },
    {
      id: 'two-key-non-conflation',
      capabilities: ['growth.phone-evidence.two-key-separation'],
      required: true
    },
    {
      id: 'authority-ceiling',
      capabilities: ['growth.phone-evidence.authority.none'],
      required: true
    },
    {
      id: 'current-device-key',
      capabilities: ['growth.phone-evidence.current-device-key.pass'],
      required: false
    },
    {
      id: 'current-human-key',
      capabilities: ['growth.phone-evidence.current-human-key.pass'],
      required: false
    },
    {
      id: 'current-combined-evidence',
      capabilities: ['growth.phone-evidence.current-combined.pass'],
      required: false
    }
  ]
};

const before = {
  capabilities: [
    {
      id: 'qa.phone-campaign.candidate-capture',
      status: 'available',
      constraints: ['The existing voluntary campaign and QA Lab can capture a bounded phone-observation candidate.']
    },
    {
      id: 'human.handoff.native-package-verify',
      status: 'available',
      constraints: ['The existing Grounded Growth human handoff can rebuild and verify live evidence through the v2 bridge.']
    },
    {
      id: 'growth.phone-evidence.current-device-key.pass',
      status: 'degraded',
      constraints: ['No exact physical-phone device receipt, accepted candidate review, or later warning-free verifier report exists for the current game.']
    },
    {
      id: 'growth.phone-evidence.current-human-key.pass',
      status: 'degraded',
      constraints: ['No live human handoff package exists for the declared current game experience.']
    },
    {
      id: 'growth.phone-evidence.current-combined.pass',
      status: 'degraded',
      constraints: ['Neither independent evidence key currently passes.']
    }
  ]
};

const provided = [
  ['growth.phone-evidence.campaign-native-bind', 'The gate validates the exact campaign digest, queue identity, current warning, and review state.'],
  ['growth.phone-evidence.device-native-verify', 'The gate verifies the QA Lab receipt native digest and all six complete phone declarations without retaining notes or user-agent text.'],
  ['growth.phone-evidence.manifest-warning-closure-bind', 'The device key requires a later passing native Game Hub verifier report where the selected warning is absent.'],
  ['growth.phone-evidence.human-outcome-native-verify', 'The human key requires a complete Grounded Growth human handoff package that natively rebuilds its live session, judgment, declaration, closure, bridge, and outcome.'],
  ['growth.phone-evidence.two-key-separation', 'Device behavior and human usefulness remain independently visible; only both can create the combined evidence state.'],
  ['growth.phone-evidence.authority.none', 'The gate writes nothing and grants no participation, manifest, portfolio, install, promotion, merge, CANON, or Foundation authority.']
];

const after = {
  capabilities: [
    ...before.capabilities,
    ...provided.map(([id, constraint]) => ({ id, status: 'available', constraints: [constraint] }))
  ]
};

const receipt = Gate.build(gateInput);
writeJson('CAPABILITY_REQUIREMENTS.json', requirements);
writeJson('CAPABILITY_INVENTORY_BEFORE.json', before);
writeJson('CAPABILITY_INVENTORY_AFTER.json', after);
writeJson('CURRENT_PHONE_GROUNDED_GROWTH_READINESS.json', receipt);

console.log('PASS current phone-to-Grounded-Growth readiness built');
console.log('game=' + receipt.game.gameId + ' overall=' + receipt.overall);
console.log('device=' + receipt.keys.deviceBehavior.state + ' human=' + receipt.keys.humanUsefulness.state);

module.exports = { gateInput, requirements, before, after, receipt };
