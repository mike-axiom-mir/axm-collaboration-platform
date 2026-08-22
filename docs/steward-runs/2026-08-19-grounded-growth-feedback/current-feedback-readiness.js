#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const Feedback = require('../../../shared/grounded-growth-feedback/grounded-growth-feedback');

const ROOT = path.resolve(__dirname, '..', '..', '..');
const GENERATED_AT = '2026-08-19T06:35:00.000Z';

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), 'utf8'));
}

function currentInputs() {
  const portfolio = readJson('docs/steward-runs/2026-08-19-grounded-growth/current-portfolio.json');
  const bridge = readJson('docs/steward-runs/2026-08-19-human-grounded-bridge/current-bridge-readiness-receipt.json');
  const needsDir = path.join(ROOT, 'tools', 'grounded-evolution-intelligence', 'engine', 'registry', 'needs');
  const existingNeeds = fs.readdirSync(needsDir)
    .filter((name) => name.endsWith('.json'))
    .sort()
    .map((name) => JSON.parse(fs.readFileSync(path.join(needsDir, name), 'utf8')));
  return { portfolio, bridge, existingNeeds };
}

function buildCurrent() {
  const { portfolio, bridge, existingNeeds } = currentInputs();
  const latest = portfolio.latest.find((item) => item.nextEvidenceNeeds.includes('HUMAN_BENEFIT_NATIVE_EVIDENCE'));
  if (!latest) throw new Error('current portfolio has no human-native evidence need');
  if (bridge.currentInputs.groundedOutcomeRef.sha256 !== latest.effectiveReceiptDigest) {
    throw new Error('human bridge readiness does not reference the effective grounded outcome');
  }
  const packet = Feedback.buildPacket({
    packetId: 'grounded-growth-feedback-current-20260819',
    generatedAt: GENERATED_AT,
    sourceReceipt: portfolio,
    routeStates: [{
      capabilityId: latest.capabilityId,
      needCode: 'HUMAN_BENEFIT_NATIVE_EVIDENCE',
      state: 'READY_FOR_VOLUNTARY_INPUT',
      evidenceRef: {
        id: 'current-human-grounded-bridge-readiness',
        schema: bridge.schema,
        sha256: bridge.receiptDigest
      },
      detail: bridge.nextGate.action
    }],
    existingNeeds,
    coverageLinks: []
  });
  const checked = Feedback.verifyPacket(packet);
  if (!checked.pass) throw new Error('current feedback packet failed verification: ' + checked.errors.join('; '));
  if (packet.candidateNeeds.length !== 1) throw new Error('current feedback packet must contain exactly one bounded candidate');
  const candidate = packet.candidateNeeds[0];
  if (!candidate.improvement_dimensions.includes('HUMAN_ACCESSIBILITY')) throw new Error('current candidate is not human-native evidence work');
  if (candidate.possible_responses.length !== 1 || candidate.possible_responses[0] !== 'WAIT_FOR_EVIDENCE') {
    throw new Error('current human candidate must only wait for evidence');
  }
  if (candidate.assigned_direction_ids.length) throw new Error('current candidate must not create a direction');

  const readiness = {
    schema: 'axm.grounded-growth-feedback-readiness/v1',
    version: Feedback.VERSION,
    generatedAt: GENERATED_AT,
    status: 'TEST',
    state: 'TECHNICALLY_REVIEWED_WAIT_FOR_EVIDENCE',
    sourceRefs: {
      groundedPortfolio: {
        id: portfolio.portfolioId,
        schema: portfolio.schema,
        sha256: portfolio.portfolioDigest
      },
      humanBridgeReadiness: {
        id: 'current-human-grounded-bridge-readiness',
        schema: bridge.schema,
        sha256: bridge.receiptDigest
      }
    },
    feedbackPacketRef: {
      id: packet.packetId,
      schema: packet.schema,
      sha256: packet.packetDigest
    },
    currentCandidate: {
      needId: candidate.need_id,
      status: candidate.status,
      truthState: candidate.truth_state,
      possibleResponses: candidate.possible_responses,
      assignedDirectionIds: candidate.assigned_direction_ids,
      observedProblem: candidate.observed_problem,
      desiredOutcome: candidate.desired_outcome,
      verificationMethod: candidate.verification_method
    },
    existingNeedReview: {
      registryNeedCount: existingNeeds.length,
      exactDuplicateSuppressed: packet.suppressed.some((item) => item.reason === 'EXACT_ACTIVE_NEED_EXISTS'),
      explicitCoverageLinkSupplied: false,
      broadBeginnerNeedAutomaticallyTreatedAsDuplicate: false
    },
    review: {
      disposition: 'WAIT_FOR_EVIDENCE',
      reviewer: 'KEEL_CODEX_TECHNICAL_STEWARD',
      reviewedAt: GENERATED_AT,
      candidateOnly: true,
      directionCreated: false,
      registryWritePerformed: false,
      executionAuthorized: false,
      humanAcceptanceClaimed: false,
      note: 'Technical review accepts this as bounded attention only. Waiting is the correct current action; Mike remains the merge and CANON gate.'
    },
    truth: {
      sourcePortfolioVerified: true,
      feedbackPacketVerified: true,
      humanBenefitEstablished: false,
      liveHumanParticipationOccurred: false,
      voluntaryCompletionOrWithdrawalPreserved: true,
      existingBroadNeedProvesExactCoverage: false,
      automaticExecution: false,
      automaticInstall: false,
      automaticPromotion: false,
      automaticMerge: false,
      automaticCanon: false,
      foundationMutation: false,
      modelWeightTrainingClaimed: false
    },
    nextGate: {
      action: 'Remain at WAIT_FOR_EVIDENCE unless a person independently opts in; completion and withdrawal remain equally valid.',
      automatic: false,
      requiredForHumanBenefitClaim: true
    },
    receiptDigest: null
  };
  const digestPayload = JSON.parse(JSON.stringify(readiness));
  delete digestPayload.receiptDigest;
  readiness.receiptDigest = Feedback.sha256(digestPayload);
  return { packet, readiness };
}

function verifyCurrent(bundle) {
  const errors = [];
  const checked = Feedback.verifyPacket(bundle && bundle.packet);
  if (!checked.pass) errors.push(...checked.errors.map((error) => 'packet: ' + error));
  let rebuilt = null;
  try {
    rebuilt = buildCurrent();
  } catch (error) {
    errors.push('rebuild: ' + error.message);
  }
  if (rebuilt && Feedback.stableStringify(rebuilt) !== Feedback.stableStringify(bundle)) errors.push('current feedback bundle content mismatch');
  return { pass: errors.length === 0, errors };
}

if (require.main === module) process.stdout.write(JSON.stringify(buildCurrent(), null, 2) + '\n');

module.exports = { buildCurrent, verifyCurrent };
