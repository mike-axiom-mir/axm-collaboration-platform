#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const Growth = require('../../../shared/grounded-growth-outcomes/grounded-growth-outcomes');
const Feedback = require('../../../shared/grounded-growth-feedback/grounded-growth-feedback');
const Direction = require('../../../shared/grounded-growth-direction-handoff/grounded-growth-direction-handoff');

const workshop = path.resolve(__dirname, '../../..');
const portfolioPath = path.join(workshop, 'docs/steward-runs/2026-08-19-ai-workflow-coverage-refresh/CURRENT_PORTFOLIO.json');
const humanReadinessPath = path.join(workshop, 'docs/steward-runs/2026-08-19-human-handoff-operational-readiness/CURRENT_HANDOFF_READINESS.json');
const geiNeedsRoot = path.join(workshop, 'tools/grounded-evolution-intelligence/engine/registry/needs');

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function writeJson(name, value) {
  fs.writeFileSync(path.join(__dirname, name), JSON.stringify(value, null, 2) + '\n');
}

function digestFile(file) {
  return 'sha256:' + crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function verifiedReceiptDigest(receipt, label) {
  const copy = JSON.parse(JSON.stringify(receipt));
  const claimed = copy.receiptDigest;
  delete copy.receiptDigest;
  const actual = Direction.sha256(copy);
  if (claimed !== actual) throw new Error(label + ' receipt digest mismatch');
  return claimed;
}

const portfolio = readJson(portfolioPath);
const portfolioVerification = Growth.verifyPortfolio(portfolio);
if (!portfolioVerification.pass) throw new Error('current portfolio invalid: ' + portfolioVerification.errors.join('; '));

const humanReadiness = readJson(humanReadinessPath);
if (humanReadiness.schema !== 'axm.grounded-growth-human-handoff-readiness/v1') throw new Error('human handoff readiness schema mismatch');
if (humanReadiness.state !== 'TECHNICAL_HANDOFF_READY_HUMAN_EVIDENCE_NOT_RUN') throw new Error('human handoff is not in the expected current state');
if (!Array.isArray(humanReadiness.routes) || humanReadiness.routes.length !== 4) throw new Error('human handoff must cover four current routes');
if (humanReadiness.routes.some((route) => route.technicalHandoffState !== 'READY_FOR_OPTIONAL_LOCAL_TTY_INPUT' || route.humanEvidenceState !== 'NOT_RUN')) {
  throw new Error('human handoff route state mismatch');
}
const humanReadinessDigest = verifiedReceiptDigest(humanReadiness, 'human handoff readiness');

const latestCapabilities = portfolio.latest.map((item) => item.capabilityId).sort();
const routeCapabilities = humanReadiness.routes.map((item) => item.capabilityId).sort();
if (Direction.stableStringify(latestCapabilities) !== Direction.stableStringify(routeCapabilities)) {
  throw new Error('current portfolio and human handoff capability coverage differ');
}

const existingNeeds = fs.readdirSync(geiNeedsRoot)
  .filter((name) => name.endsWith('.json'))
  .sort()
  .map((name) => readJson(path.join(geiNeedsRoot, name)));

const routeStates = humanReadiness.routes.map((route) => {
  const routeDeclaration = {
    readinessReceiptDigest: humanReadinessDigest,
    capabilityId: route.capabilityId,
    protocolRef: route.protocolRef,
    interventionLinkRef: route.interventionLinkRef,
    technicalHandoffState: route.technicalHandoffState,
    humanEvidenceState: route.humanEvidenceState
  };
  return {
    capabilityId: route.capabilityId,
    needCode: 'HUMAN_BENEFIT_NATIVE_EVIDENCE',
    state: 'READY_FOR_VOLUNTARY_INPUT',
    evidenceRef: {
      id: 'current-human-handoff-route-' + Direction.sha256(routeDeclaration).slice(7, 23),
      schema: 'axm.grounded-growth-human-handoff-route-declaration/v1',
      sha256: Direction.sha256(routeDeclaration)
    },
    detail: 'The exact local TTY handoff is technically ready. Participation starts only if a person independently opts in; completion and withdrawal remain equally valid.'
  };
});

const feedback = Feedback.buildPacket({
  packetId: 'current-grounded-growth-feedback-20260819',
  generatedAt: '2026-08-19T12:35:00.000Z',
  sourceReceipt: portfolio,
  routeStates,
  existingNeeds,
  coverageLinks: []
});
const feedbackVerification = Feedback.verifyPacket(feedback);
if (!feedbackVerification.pass) throw new Error('current feedback packet invalid: ' + feedbackVerification.errors.join('; '));

const handoff = Direction.buildHandoff({
  handoffId: 'current-grounded-growth-direction-handoff-20260819',
  generatedAt: '2026-08-19T12:35:01.000Z',
  sourcePacket: feedback,
  selections: []
});
const handoffVerification = Direction.verifyHandoff(handoff);
if (!handoffVerification.pass) throw new Error('current direction handoff invalid: ' + handoffVerification.errors.join('; '));

if (feedback.candidateNeeds.length !== 4 || handoff.directions.length !== 4 || handoff.holds.length !== 0) {
  throw new Error('current route must produce four unambiguous direction drafts');
}
if (handoff.directions.some((item) => item.direction.action_type !== 'WAIT_FOR_EVIDENCE')) {
  throw new Error('current route must not invent work while only voluntary human evidence remains');
}

const requirements = {
  requirements: [
    {
      id: 'verified-feedback-to-direction-contract',
      capabilities: [
        'growth.direction.feedback-native-verify',
        'growth.direction.need-digest-bind',
        'growth.direction.gei-direction-compose'
      ],
      required: true
    },
    {
      id: 'choice-and-evidence-boundaries',
      capabilities: [
        'growth.direction.multi-response-selection-hold',
        'growth.direction.dual-beneficiary-evidence-plan',
        'growth.direction.authority.none'
      ],
      required: true
    },
    {
      id: 'current-portfolio-truthful-direction',
      capabilities: [
        'growth.direction.current-four-chain-coverage',
        'growth.direction.current-wait-only',
        'growth.direction.zero-accepted-or-executed'
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
      id: 'growth.feedback.packet.verify', status: 'available',
      constraints: ['Grounded Growth feedback verifies exact source outcomes and emits GEI-compatible needs, but has no direction consumer.']
    },
    {
      id: 'gei.direction.schema.declared', status: 'available',
      constraints: ['Grounded Evolution Intelligence declares evolution_direction v0.1.0, but no current feedback-to-direction composer exists.']
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
      id: 'growth.direction.feedback-native-verify', status: 'available',
      constraints: ['The additive handoff refuses any feedback packet that fails the native deterministic verifier.']
    },
    {
      id: 'growth.direction.need-digest-bind', status: 'available',
      constraints: ['Every draft binds the exact improvement-need digest and resulting direction digest.']
    },
    {
      id: 'growth.direction.gei-direction-compose', status: 'available',
      constraints: ['Single-response needs become GEI v0.1.0 HYPOTHESIS/PENDING/NOT_STARTED direction records.']
    },
    {
      id: 'growth.direction.multi-response-selection-hold', status: 'available',
      constraints: ['Multiple compatible actions remain held until an explicit digest-bound proposal selection is supplied.']
    },
    {
      id: 'growth.direction.dual-beneficiary-evidence-plan', status: 'available',
      constraints: ['Technical, AI-workflow and voluntary human evidence routes remain separate; no route can substitute for another.']
    },
    {
      id: 'growth.direction.authority.none', status: 'available',
      constraints: ['Directions are advisory hypotheses with no execution, write, install, permission, merge, promotion, CANON or Foundation authority.']
    },
    {
      id: 'growth.direction.current-four-chain-coverage', status: 'available',
      constraints: ['The exact seven-outcome/four-capability current portfolio yields four current direction drafts.']
    },
    {
      id: 'growth.direction.current-wait-only', status: 'available',
      constraints: ['All four current drafts are WAIT_FOR_EVIDENCE because AI-workflow evidence is admitted and voluntary human evidence remains NOT_RUN.']
    },
    {
      id: 'growth.direction.zero-accepted-or-executed', status: 'available',
      constraints: ['The current handoff records zero accepted and zero executed directions.']
    }
  ]
};

const readiness = {
  schema: 'axm.grounded-growth-direction-readiness/v1',
  version: '0.1.0',
  generatedAt: '2026-08-19T12:35:02.000Z',
  status: 'TEST',
  state: 'TECHNICAL_DIRECTION_HANDOFF_READY_CURRENT_WORK_REMAINS_HELD',
  current: {
    sourceOutcomeCount: portfolio.summary.outcomeCount,
    sourceCapabilityCount: portfolio.summary.capabilityCount,
    feedbackNeedCount: feedback.candidateNeeds.length,
    directionCount: handoff.summary.directionCount,
    waitDirectionCount: handoff.summary.waitDirectionCount,
    actionDirectionCount: handoff.summary.actionDirectionCount,
    selectionHoldCount: handoff.summary.holdCount,
    acceptedDirectionCount: handoff.summary.acceptedDirectionCount,
    executedDirectionCount: handoff.summary.executedDirectionCount,
    liveHumanOutcomes: 0
  },
  directions: handoff.directions.map((item) => ({
    needId: item.needId,
    needDigest: item.needDigest,
    directionId: item.direction.direction_id,
    directionDigest: item.directionDigest,
    actionType: item.direction.action_type,
    stewardStatus: item.direction.steward_status,
    executionStatus: item.direction.execution_status,
    executionPlanState: item.executionPlan.state
  })),
  sourceRefs: {
    portfolio: { id: portfolio.portfolioId, schema: portfolio.schema, sha256: portfolio.portfolioDigest },
    humanHandoffReadiness: { id: 'current-human-handoff-operational-readiness', schema: humanReadiness.schema, sha256: humanReadinessDigest },
    feedbackPacket: { id: feedback.packetId, schema: feedback.schema, sha256: feedback.packetDigest },
    directionHandoff: { id: handoff.handoffId, schema: handoff.schema, sha256: handoff.handoffDigest },
    directionCore: { id: 'grounded-growth-direction-handoff-core', schema: 'text/javascript', sha256: digestFile(path.join(workshop, 'shared/grounded-growth-direction-handoff/grounded-growth-direction-handoff.js')) }
  },
  truth: {
    technicalDirectionCompositionReady: true,
    currentWorkAutomaticallyStarted: false,
    stewardAcceptanceRecorded: false,
    liveHumanParticipationOccurred: false,
    humanBenefitEstablished: false,
    aiWorkflowEvidencePreserved: true,
    humanEvidenceStillRequiredForSharedGrowth: true,
    automaticExecution: false,
    automaticWrite: false,
    automaticInstall: false,
    automaticPermissionGrant: false,
    automaticPromotion: false,
    automaticMerge: false,
    automaticCanon: false,
    foundationMutation: false,
    modelWeightTrainingClaimed: false
  },
  receiptDigest: null
};
const readinessPayload = JSON.parse(JSON.stringify(readiness));
delete readinessPayload.receiptDigest;
readiness.receiptDigest = Direction.sha256(readinessPayload);

writeJson('CAPABILITY_REQUIREMENTS.json', requirements);
writeJson('CAPABILITY_INVENTORY_BEFORE.json', before);
writeJson('CAPABILITY_INVENTORY_AFTER.json', after);
writeJson('CURRENT_FEEDBACK_PACKET.json', feedback);
writeJson('CURRENT_DIRECTION_HANDOFF.json', handoff);
writeJson('CURRENT_DIRECTION_READINESS.json', readiness);

console.log('PASS current Grounded Growth feedback -> direction handoff built');
console.log('current outcomes=' + portfolio.summary.outcomeCount + ' capabilities=' + portfolio.summary.capabilityCount + ' needs=' + feedback.candidateNeeds.length);
console.log('directions=' + handoff.summary.directionCount + ' wait=' + handoff.summary.waitDirectionCount + ' accepted=0 executed=0');
