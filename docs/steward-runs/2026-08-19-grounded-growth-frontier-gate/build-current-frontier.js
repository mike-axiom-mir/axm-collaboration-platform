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

const input = {
  frontierId: 'current-grounded-growth-frontier-20260819',
  generatedAt: '2026-08-19T14:25:00.000Z',
  portfolio: readJson('docs/steward-runs/2026-08-19-ai-workflow-coverage-refresh/CURRENT_PORTFOLIO.json'),
  directionHandoff: readJson('docs/steward-runs/2026-08-19-grounded-growth-direction-handoff/CURRENT_DIRECTION_HANDOFF.json'),
  humanHandoffReadiness: readJson('docs/steward-runs/2026-08-19-human-handoff-operational-readiness/CURRENT_HANDOFF_READINESS.json'),
  extensionHostProfile: readJson('docs/steward-runs/2026-08-19-simulation-lab-extension-intake/CURRENT_SIMULATION_LAB_HOST_PROFILE.json'),
  extensionReadiness: readJson('docs/steward-runs/2026-08-19-simulation-lab-extension-intake/CURRENT_EXTENSION_INTAKE_READINESS.json')
};

const requirements = {
  requirements: [
    {
      id: 'native-current-source-validation',
      capabilities: [
        'growth.frontier.portfolio-native-verify',
        'growth.frontier.direction-native-verify',
        'growth.frontier.exact-source-bind'
      ],
      required: true
    },
    {
      id: 'readiness-receipt-validation',
      capabilities: [
        'growth.frontier.human-readiness-digest-verify',
        'growth.frontier.extension-readiness-digest-verify'
      ],
      required: true
    },
    {
      id: 'agency-preserving-separation',
      capabilities: [
        'growth.frontier.readiness-not-consent',
        'growth.frontier.example-not-candidate'
      ],
      required: true
    },
    {
      id: 'scoped-current-action-decision',
      capabilities: ['growth.frontier.no-autonomous-action'],
      required: true
    },
    {
      id: 'live-voluntary-human-evidence',
      capabilities: ['growth.human-evidence.live'],
      required: false
    },
    {
      id: 'experimental-extension-candidate',
      capabilities: ['simulation.extension.candidate-package.received'],
      required: false
    },
    {
      id: 'new-non-wait-direction',
      capabilities: ['growth.direction.non-wait.current'],
      required: false
    }
  ]
};

const before = {
  capabilities: [
    {
      id: 'growth.portfolio.current',
      status: 'available',
      constraints: ['The latest portfolio already carries four exact effective capability chains.']
    },
    {
      id: 'growth.direction-handoff.current',
      status: 'available',
      constraints: ['The current handoff already embeds the current portfolio and reports four WAIT_FOR_EVIDENCE directions.']
    },
    {
      id: 'growth.human-handoff.technical-ready',
      status: 'available',
      constraints: ['Four local TTY routes are technically ready but do not constitute consent or human benefit.']
    },
    {
      id: 'simulation.extension.intake-ready',
      status: 'available',
      constraints: ['The extension intake is ready but contains no candidate package or assessment.']
    },
    {
      id: 'growth.human-evidence.live',
      status: 'degraded',
      constraints: ['No independent voluntary human participation or live usefulness outcome has occurred.']
    },
    {
      id: 'simulation.extension.candidate-package.received',
      status: 'degraded',
      constraints: ['The Platform example is declaration guidance only; no candidate package has been supplied.']
    },
    {
      id: 'growth.direction.non-wait.current',
      status: 'degraded',
      constraints: ['All four current directions are WAIT_FOR_EVIDENCE with zero execution steps.']
    }
  ]
};

const provided = [
  ['growth.frontier.portfolio-native-verify', 'The current portfolio is accepted only through its native verifier.'],
  ['growth.frontier.direction-native-verify', 'The current direction handoff is accepted only through its native verifier.'],
  ['growth.frontier.exact-source-bind', 'The direction handoff must embed the exact supplied current portfolio.'],
  ['growth.frontier.human-readiness-digest-verify', 'The voluntary human-readiness receipt must pass exact self-digest and ancestry checks.'],
  ['growth.frontier.extension-readiness-digest-verify', 'The extension readiness must pass exact self-digest and host-profile binding checks.'],
  ['growth.frontier.readiness-not-consent', 'Technical route readiness cannot become opt-in, participation, or human benefit.'],
  ['growth.frontier.example-not-candidate', 'An example declaration cannot become a received candidate or runtime evidence.'],
  ['growth.frontier.no-autonomous-action', 'The exact current frontier always grants zero autonomous action and no lifecycle authority.']
];

const after = {
  capabilities: [
    ...before.capabilities,
    ...provided.map(([id, constraint]) => ({
      id,
      status: 'available',
      constraints: [constraint]
    }))
  ]
};

const receipt = Frontier.buildFrontier(input);

writeJson('CAPABILITY_REQUIREMENTS.json', requirements);
writeJson('CAPABILITY_INVENTORY_BEFORE.json', before);
writeJson('CAPABILITY_INVENTORY_AFTER.json', after);
writeJson('CURRENT_FRONTIER_RECEIPT.json', receipt);

console.log('PASS current Grounded Growth frontier built');
console.log('capabilities=' + receipt.counts.capabilityChains + ' aiWorkflowPass=' + receipt.counts.latestAiWorkflowPass + ' humanPass=' + receipt.counts.latestHumanPass);
console.log('waitDirections=' + receipt.counts.waitDirections + ' humanRoutes=' + receipt.counts.voluntaryHumanRoutes + ' candidatePackages=' + receipt.counts.candidatePackages);
console.log('autonomousActions=' + receipt.decision.autonomousActionCount + ' reviewableActions=' + receipt.decision.reviewableActionCount);

