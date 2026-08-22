#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const Direction = require('../../../shared/grounded-growth-direction-handoff/grounded-growth-direction-handoff');
const Lab = require('../../../shared/grounded-growth-challenger-lab/grounded-growth-challenger-lab');

const workshop = path.resolve(__dirname, '../../..');
const directionPath = path.join(workshop, 'docs/steward-runs/2026-08-19-grounded-growth-direction-handoff/CURRENT_DIRECTION_HANDOFF.json');
const directionReadinessPath = path.join(workshop, 'docs/steward-runs/2026-08-19-grounded-growth-direction-handoff/CURRENT_DIRECTION_READINESS.json');
const shadowContractPath = path.join(workshop, 'tools/repair-resilience-library/components/shadow-simulator/module.contract.json');
const diagnosticContractPath = path.join(workshop, 'tools/repair-resilience-library/components/diagnostic-experiment-runner/module.contract.json');

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}
function writeJson(name, value) {
  fs.writeFileSync(path.join(__dirname, name), JSON.stringify(value, null, 2) + '\n');
}

const directionHandoff = readJson(directionPath);
const directionVerification = Direction.verifyHandoff(directionHandoff);
if (!directionVerification.pass) throw new Error('current direction handoff invalid: ' + directionVerification.errors.join('; '));
const directionReadiness = readJson(directionReadinessPath);
const shadowContract = readJson(shadowContractPath);
const diagnosticContract = readJson(diagnosticContractPath);
if (shadowContract.status !== 'EXPERIMENTAL' || shadowContract.permissions.length !== 0) throw new Error('shadow simulator contract boundary changed');
if (diagnosticContract.status !== 'EXPERIMENTAL' || diagnosticContract.permissions.length !== 0) throw new Error('diagnostic runner contract boundary changed');

const waitDirections = directionHandoff.directions.filter((item) => item.direction.action_type === 'WAIT_FOR_EVIDENCE');
const actionableDirections = directionHandoff.directions.filter((item) => item.direction.action_type !== 'WAIT_FOR_EVIDENCE');
if (directionHandoff.directions.length !== 4 || waitDirections.length !== 4 || actionableDirections.length !== 0) {
  throw new Error('current direction frontier changed; expected four WAIT directions and zero actionable directions');
}

const requirements = {
  requirements: [
    {
      id: 'direction-and-artifact-identity',
      capabilities: [
        'growth.challenger.direction-native-verify',
        'growth.challenger.baseline-challenger-bind'
      ],
      required: true
    },
    {
      id: 'bounded-challenger-evidence',
      capabilities: [
        'growth.challenger.held-out-separation',
        'growth.challenger.shadow-receipt-verify',
        'growth.challenger.diagnostic-receipt-verify',
        'growth.challenger.regression-hold',
        'growth.challenger.no-gain-hold'
      ],
      required: true
    },
    {
      id: 'authority-and-beneficiary-boundary',
      capabilities: [
        'growth.challenger.adoption.none',
        'growth.challenger.human-substitution.refuse'
      ],
      required: true
    },
    {
      id: 'current-frontier-restraint',
      capabilities: [
        'growth.challenger.current-wait-block',
        'growth.challenger.current-zero-plan'
      ],
      required: true
    },
    {
      id: 'live-human-beneficiary-outcome',
      capabilities: ['growth.human-evidence.live'],
      required: false
    }
  ]
};

const before = {
  capabilities: [
    {
      id: 'growth.direction.handoff.verify', status: 'available',
      constraints: ['Current Grounded Growth directions verify natively but have no challenger-lab consumer.']
    },
    {
      id: 'simulation.shadow.clone-patch', status: 'degraded',
      constraints: ['Shadow Simulator is EXPERIMENTAL and applies bounded JSON patches to a clone without canonical mutation.']
    },
    {
      id: 'evaluation.diagnostic.shadow-run', status: 'degraded',
      constraints: ['Diagnostic Experiment Runner is EXPERIMENTAL and runs a caller function against a cloned fixture.']
    },
    {
      id: 'growth.human-evidence.live', status: 'degraded',
      constraints: ['No person opted in and no LIVE human-benefit outcome exists.']
    }
  ]
};

const after = {
  capabilities: [
    ...before.capabilities,
    {
      id: 'growth.challenger.direction-native-verify', status: 'available',
      constraints: ['The lab refuses a direction handoff that fails its native verifier and refuses WAIT_FOR_EVIDENCE directions.']
    },
    {
      id: 'growth.challenger.baseline-challenger-bind', status: 'available',
      constraints: ['Plan and Shadow receipt bind distinct exact baseline and challenger digests.']
    },
    {
      id: 'growth.challenger.held-out-separation', status: 'available',
      constraints: ['Every plan requires declared held-out AI-workflow and regression cases; the declaration is not authenticated.']
    },
    {
      id: 'growth.challenger.shadow-receipt-verify', status: 'available',
      constraints: ['The lab recomputes the Shadow receipt digest, state digest, artifact ancestry and no-canonical-mutation boundary.']
    },
    {
      id: 'growth.challenger.diagnostic-receipt-verify', status: 'available',
      constraints: ['Every paired Diagnostic receipt is hash-verified, shadow-only, observation-only and bound to the exact case and artifact.']
    },
    {
      id: 'growth.challenger.regression-hold', status: 'available',
      constraints: ['A technical or regression failure derives CHALLENGER_REJECT_CANDIDATE.']
    },
    {
      id: 'growth.challenger.no-gain-hold', status: 'available',
      constraints: ['No held-out AI improvement derives NO_MEASURED_GAIN rather than an improvement claim.']
    },
    {
      id: 'growth.challenger.adoption.none', status: 'available',
      constraints: ['The strongest result is a review candidate with adoptionState NOT_AUTHORIZED.']
    },
    {
      id: 'growth.challenger.human-substitution.refuse', status: 'available',
      constraints: ['Held-out AI evidence never becomes human benefit or shared growth.']
    },
    {
      id: 'growth.challenger.current-wait-block', status: 'available',
      constraints: ['All four exact current WAIT_FOR_EVIDENCE directions are refused as challenger-plan inputs.']
    },
    {
      id: 'growth.challenger.current-zero-plan', status: 'available',
      constraints: ['Current readiness contains zero challenger plans and zero evaluations.']
    }
  ]
};

const readinessInput = {
  readinessId: 'current-grounded-growth-challenger-readiness-20260819',
  generatedAt: '2026-08-19T13:05:00.000Z',
  directionHandoff,
  directionReadiness,
  shadowContract,
  diagnosticContract,
  plans: [],
  evaluations: []
};
const readiness = Lab.buildReadiness(readinessInput);

writeJson('CAPABILITY_REQUIREMENTS.json', requirements);
writeJson('CAPABILITY_INVENTORY_BEFORE.json', before);
writeJson('CAPABILITY_INVENTORY_AFTER.json', after);
writeJson('CURRENT_CHALLENGER_READINESS.json', readiness);

console.log('PASS current Grounded Growth challenger readiness built');
console.log('directions=' + directionHandoff.directions.length + ' wait=' + waitDirections.length + ' actionable=' + actionableDirections.length);
console.log('plans=0 evaluations=0 accepted=0 executed=0');

module.exports = { readinessInput, readiness };
