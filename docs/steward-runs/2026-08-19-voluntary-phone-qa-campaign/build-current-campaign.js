#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const Campaign = require('../../../shared/voluntary-phone-qa-campaign/voluntary-phone-qa-campaign');

const workshop = path.resolve(__dirname, '../../..');

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(workshop, relativePath), 'utf8'));
}

function writeJson(name, value) {
  fs.writeFileSync(path.join(__dirname, name), JSON.stringify(value, null, 2) + '\n');
}

const input = {
  campaignId: 'current-voluntary-phone-qa-campaign-20260819',
  generatedAt: '2026-08-19T15:02:00.000Z',
  seamReport: readJson('exports/game-night-seam-report.json'),
  qaLabManifest: readJson('tools/browser-lan-hardware-qa-lab/manifest.json'),
  qaLabContract: readJson('tools/browser-lan-hardware-qa-lab/module.contract.json'),
  maxGamesPerSession: 3,
  candidateReviews: []
};

const requirements = {
  requirements: [
    {
      id: 'current-warning-source',
      capabilities: ['qa.phone-campaign.report-native-verify', 'qa.phone-campaign.lab-contract-bind'],
      required: true
    },
    {
      id: 'privacy-and-bounded-scope',
      capabilities: ['qa.phone-campaign.sanitized-queue', 'qa.phone-campaign.machine-path-redaction'],
      required: true
    },
    {
      id: 'human-agency',
      capabilities: ['qa.phone-campaign.bounded-session-batching', 'qa.phone-campaign.voluntary-stop'],
      required: true
    },
    {
      id: 'evidence-and-warning-separation',
      capabilities: ['qa.phone-campaign.candidate-review-separate', 'qa.phone-campaign.warning-mutation.none'],
      required: true
    },
    {
      id: 'candidate-observation-received',
      capabilities: ['qa.phone-campaign.candidate.received'],
      required: false
    },
    {
      id: 'candidate-review-accepted',
      capabilities: ['qa.phone-campaign.review.accepted'],
      required: false
    },
    {
      id: 'physical-phone-evidence-verified',
      capabilities: ['qa.physical-phone.verified'],
      required: false
    },
    {
      id: 'game-warning-closed',
      capabilities: ['qa.phone-campaign.game-warning.closed'],
      required: false
    }
  ]
};

const before = {
  capabilities: [
    {
      id: 'qa.phone-observation.candidate-capture',
      status: 'available',
      constraints: ['The existing Browser, LAN & Hardware QA Lab captures one bounded candidate at a time under explicit qa.run authority.']
    },
    {
      id: 'qa.game-warning.current-report',
      status: 'available',
      constraints: ['The current verifier report exposes exact physical-phone warnings but contains local machine paths and no resumable campaign view.']
    },
    {
      id: 'qa.phone-campaign.candidate.received',
      status: 'degraded',
      constraints: ['No voluntary physical-phone candidate was supplied to this campaign.']
    },
    {
      id: 'qa.phone-campaign.review.accepted',
      status: 'degraded',
      constraints: ['No candidate review was supplied to this campaign.']
    },
    {
      id: 'qa.physical-phone.verified',
      status: 'degraded',
      constraints: ['No native physical-phone journey was observed or verified in this run.']
    },
    {
      id: 'qa.phone-campaign.game-warning.closed',
      status: 'degraded',
      constraints: ['All seventeen verifier warnings remain open.']
    }
  ]
};

const provided = [
  ['qa.phone-campaign.report-native-verify', 'A passing zero-failure seam report is structurally checked and digest-bound before planning.'],
  ['qa.phone-campaign.lab-contract-bind', 'The exact TEST QA Lab manifest and contract are identity, route, permission, write, and refusal checked.'],
  ['qa.phone-campaign.sanitized-queue', 'Only bounded game ids, slots, warning state, and review-state fields enter the campaign queue.'],
  ['qa.phone-campaign.machine-path-redaction', 'Source manifest and scope paths are excluded from the campaign output.'],
  ['qa.phone-campaign.bounded-session-batching', 'The current seventeen items are deterministically split into six sessions of at most three games.'],
  ['qa.phone-campaign.voluntary-stop', 'Every session allows stop or skip and never begins automatically.'],
  ['qa.phone-campaign.candidate-review-separate', 'Candidate review advances only campaign state and cannot authenticate identity or prove hardware.'],
  ['qa.phone-campaign.warning-mutation.none', 'Candidate acceptance and campaign completion leave every verifier warning open.']
];

const after = {
  capabilities: [
    ...before.capabilities,
    ...provided.map(([id, constraint]) => ({ id, status: 'available', constraints: [constraint] }))
  ]
};

const receipt = Campaign.buildCampaign(input);
const handoff = `# Physical-phone QA campaign handoff\n\nStatus: \`TEST\` · participation is optional\n\nThe current Workshop verifier exposes **${receipt.summary.physicalPhoneWarnings}** physical-phone evidence gaps. The existing Browser, LAN & Hardware QA Lab is the capture surface:\n\n\`tools/browser-lan-hardware-qa-lab/index.html\`\n\nA ChatGPT mobile remote-control connection is useful for managing the PC, but it does not by itself count as a game controller, shared-screen action, disconnect/recovery observation, or physical-phone QA proof. Use the actual game phone/controller route for each selected game.\n\nFor one game at a time:\n\n1. Start the selected game through its normal trusted Workshop route.\n2. Open the QA Lab and choose the same verifier-listed game.\n3. Join from a separate physical phone through the game's intended controller route.\n4. Observe the six checklist items; leave any unobserved item unchecked.\n5. Capture a candidate receipt and stop whenever desired.\n6. Review the candidate separately. Acceptance does not clear the verifier warning.\n\n${receipt.sessions.map((session) => `## Optional session ${session.sessionNumber}\n\n${session.gameIds.map((gameId) => `- \`${gameId}\``).join('\n')}\n\nStopping or skipping is valid. No session starts automatically.`).join('\n\n')}\n\n## Current next item\n\n\`${receipt.nextAction.nextGameId}\` — only if Mike independently chooses to run a physical-phone session.\n\nThe campaign stores no raw notes or machine paths, modifies no game manifest, and grants no merge, promotion, CANON, or Foundation authority.\n`;

writeJson('CAPABILITY_REQUIREMENTS.json', requirements);
writeJson('CAPABILITY_INVENTORY_BEFORE.json', before);
writeJson('CAPABILITY_INVENTORY_AFTER.json', after);
writeJson('CURRENT_PHONE_QA_CAMPAIGN.json', receipt);
fs.writeFileSync(path.join(__dirname, 'PHYSICAL_PHONE_QA_HANDOFF.md'), handoff);

console.log('PASS current voluntary phone-QA campaign built');
console.log('warnings=' + receipt.summary.physicalPhoneWarnings + ' sessions=' + receipt.summary.sessionCount + ' reviews=' + receipt.summary.reviewRecords);
console.log('next=' + receipt.nextAction.nextGameId + ' automatic=' + receipt.nextAction.automatic);

