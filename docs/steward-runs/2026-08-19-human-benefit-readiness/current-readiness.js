'use strict';

const fs = require('fs');
const path = require('path');
const Human = require('../../../shared/human-benefit-evidence/human-benefit-evidence');
const Current = require('./current-protocol');

const WORKSHOP = path.resolve(__dirname, '..', '..', '..');
const OUTPUT_PATH = path.join(__dirname, 'current-readiness-receipt.json');

function relativeRef(relativePath, id, schema) {
  const raw = fs.readFileSync(path.join(WORKSHOP, relativePath));
  return { id, schema, path: relativePath.replace(/\\/g, '/'), sha256: Human.sha256(raw) };
}

function buildCurrentReadiness() {
  const protocol = Current.buildCurrentProtocol();
  const exact = Current.loadExact();
  if (Human.stableStringify(protocol) !== Human.stableStringify(exact.protocol)) {
    throw new Error('current protocol does not match exact source artifacts');
  }
  const packetCheck = Current.verifyParticipantPacket(protocol, exact.packet);
  if (!packetCheck.pass) throw new Error('participant packet mismatch or answer leak: ' + packetCheck.leaks.join(', '));
  const priorOutcomePath = 'docs/steward-runs/2026-08-19-grounded-growth/current-outcome-receipt.json';
  const priorOutcome = JSON.parse(fs.readFileSync(path.join(WORKSHOP, priorOutcomePath), 'utf8'));
  const humanClaim = priorOutcome.claims.find((claim) => claim.beneficiary === 'HUMAN');
  if (!humanClaim || humanClaim.admittedVerdict !== 'NOT_RUN') throw new Error('prior human claim is no longer NOT_RUN; reassess this readiness receipt');

  const receipt = {
    schema: 'axm.human-benefit-readiness-receipt/v1',
    version: '0.1.0',
    generatedAt: '2026-08-19T05:30:00.000Z',
    status: 'TEST',
    state: 'READY_FOR_VOLUNTARY_HUMAN_SESSION',
    capabilityGap: {
      before: 'BLOCKED',
      after: 'READY',
      readinessOnly: true
    },
    protocolRef: {
      id: protocol.protocolId,
      schema: Human.PROTOCOL_SCHEMA,
      sha256: protocol.protocolDigest
    },
    participantPacketRef: {
      id: exact.packet.packetId,
      schema: exact.packet.schema,
      sha256: exact.packet.packetDigest
    },
    currentGroundedGrowth: {
      outcomeState: priorOutcome.state,
      humanClaimVerdict: humanClaim.admittedVerdict,
      humanClaimRouteStatus: humanClaim.routeStatus,
      humanBenefitEstablished: false,
      priorOutcomeRef: relativeRef(priorOutcomePath, priorOutcome.outcomeId, priorOutcome.schema)
    },
    verificationPlan: {
      engineFocusedChecks: 46,
      runnerBoundaryChecks: 5,
      currentProtocolExactCheck: true,
      interactiveRunnerSyntaxAndAutomationRefusal: true,
      realHumanSession: 'NOT_RUN',
      explicitHumanJudgment: 'NOT_RUN',
      groundedOutcomeRefresh: 'NOT_RUN'
    },
    sourceRefs: [
      relativeRef('shared/human-benefit-evidence/human-benefit-evidence.js', 'human-benefit-evidence-core', 'text/javascript'),
      relativeRef('shared/human-benefit-evidence/human-benefit-protocol.schema.json', 'human-benefit-protocol-schema', 'application/schema+json'),
      relativeRef('shared/human-benefit-evidence/human-benefit-session.schema.json', 'human-benefit-session-schema', 'application/schema+json'),
      relativeRef('shared/human-benefit-evidence/human-benefit-evaluation.schema.json', 'human-benefit-evaluation-schema', 'application/schema+json'),
      relativeRef('shared/human-benefit-evidence/human-benefit-judgment.schema.json', 'human-benefit-judgment-schema', 'application/schema+json'),
      relativeRef('shared/human-benefit-evidence/module.contract.json', 'human-benefit-module-contract', 'axm.module-contract/v1'),
      relativeRef('shared/human-benefit-evidence/selftest.js', 'human-benefit-evidence-selftest', 'text/javascript'),
      relativeRef('docs/steward-runs/2026-08-19-human-benefit-readiness/baseline-surface.json', 'baseline-surface', 'axm.human-benefit-comparison-surface/v1'),
      relativeRef('docs/steward-runs/2026-08-19-human-benefit-readiness/candidate-surface.json', 'candidate-surface', 'axm.human-benefit-comparison-surface/v1'),
      relativeRef('docs/steward-runs/2026-08-19-human-benefit-readiness/current-protocol.json', 'current-human-benefit-protocol', Human.PROTOCOL_SCHEMA),
      relativeRef('docs/steward-runs/2026-08-19-human-benefit-readiness/current-participant-packet.json', 'current-participant-packet', 'axm.human-benefit-participant-packet/v1'),
      relativeRef('docs/steward-runs/2026-08-19-human-benefit-readiness/run-current-human-session.js', 'current-human-session-runner', 'text/javascript'),
      relativeRef('docs/steward-runs/2026-08-19-human-benefit-readiness/run-current-human-session-interactive.js', 'current-human-session-interactive-runner', 'text/javascript'),
      relativeRef('docs/steward-runs/2026-08-19-human-benefit-readiness/runner-selftest.js', 'current-human-session-runner-selftest', 'text/javascript')
    ],
    nextGate: {
      authority: 'VOLUNTARY_LOCAL_HUMAN',
      action: 'Complete or withdraw from the answer-free participant packet.',
      requiredForHumanBenefitClaim: true,
      automatic: false
    },
    truth: {
      capabilityToCollectEvidenceExists: true,
      humanParticipationOccurred: false,
      humanBenefitClaimed: false,
      syntheticEvidenceAcceptedAsHuman: false,
      responseInputCommitted: false,
      automaticExecution: false,
      automaticInstall: false,
      automaticPromotion: false,
      automaticCanon: false,
      foundationMutation: false
    },
    receiptDigest: null
  };
  const digestPayload = JSON.parse(JSON.stringify(receipt));
  delete digestPayload.receiptDigest;
  receipt.receiptDigest = Human.sha256(digestPayload);
  return receipt;
}

function main() {
  const receipt = buildCurrentReadiness();
  if (process.argv.includes('--exact')) {
    const exact = JSON.parse(fs.readFileSync(OUTPUT_PATH, 'utf8'));
    if (Human.stableStringify(receipt) !== Human.stableStringify(exact)) throw new Error('current readiness receipt does not match exact sources');
    console.log('PASS current human-benefit readiness matches exact sources (human session NOT_RUN)');
    return;
  }
  console.log(JSON.stringify(receipt, null, 2));
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error.stack || error.message);
    process.exitCode = 1;
  }
}

module.exports = { buildCurrentReadiness };
