#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Bridge = require('../../../shared/grounded-growth-human-bridge/grounded-growth-human-bridge');
const Human = require('../../../shared/human-benefit-evidence/human-benefit-evidence');
const Growth = require('../../../shared/grounded-growth-outcomes/grounded-growth-outcomes');
const Loop = require('../../../shared/verified-capability-loop/verified-capability-loop');

const root = path.resolve(__dirname, '..', '..', '..');
const relativeFiles = {
  bridgeCore: 'shared/grounded-growth-human-bridge/grounded-growth-human-bridge.js',
  bridgeSelftest: 'shared/grounded-growth-human-bridge/selftest.js',
  protocol: 'docs/steward-runs/2026-08-19-human-benefit-readiness/current-protocol.json',
  humanReadiness: 'docs/steward-runs/2026-08-19-human-benefit-readiness/current-readiness-receipt.json',
  groundedOutcome: 'docs/steward-runs/2026-08-19-grounded-growth/current-outcome-receipt.json',
  cycle: 'docs/steward-runs/2026-08-19-5yff-current-reality/output-availability-cycle-receipt.json'
};

function file(name) {
  return path.join(root, ...relativeFiles[name].split('/'));
}

function readJson(name) {
  return JSON.parse(fs.readFileSync(file(name), 'utf8'));
}

function fileRef(name, id, schema) {
  return {
    id,
    schema,
    path: relativeFiles[name],
    sha256: Bridge.sha256(fs.readFileSync(file(name)))
  };
}

function verifyDigest(receipt, field) {
  const payload = JSON.parse(JSON.stringify(receipt));
  const recorded = payload[field];
  delete payload[field];
  return recorded === Bridge.sha256(payload);
}

function build() {
  const protocol = readJson('protocol');
  const readiness = readJson('humanReadiness');
  const outcome = readJson('groundedOutcome');
  const cycle = readJson('cycle');
  const protocolCheck = Human.verifyProtocol(protocol);
  const outcomeCheck = Growth.verifyOutcome(outcome);
  const cycleCheck = Loop.verify(cycle);
  if (!protocolCheck.pass) throw new Error('current human protocol invalid: ' + protocolCheck.errors.join('; '));
  if (!outcomeCheck.pass) throw new Error('current grounded outcome invalid: ' + outcomeCheck.errors.join('; '));
  if (!cycleCheck.pass) throw new Error('current capability cycle invalid: ' + cycleCheck.errors.join('; '));
  if (!verifyDigest(readiness, 'receiptDigest')) throw new Error('current human readiness receipt digest mismatch');
  if (readiness.truth.humanParticipationOccurred !== false || readiness.truth.humanBenefitClaimed !== false) {
    throw new Error('current readiness no longer represents an unrun human route');
  }
  const humanClaim = outcome.claims.find((claim) => claim.beneficiary === 'HUMAN');
  if (!humanClaim || humanClaim.admittedVerdict !== 'NOT_RUN' || humanClaim.routeStatus !== 'NOT_PROVEN') {
    throw new Error('current grounded human claim is no longer NOT_RUN / NOT_PROVEN');
  }

  const receipt = {
    schema: 'axm.grounded-growth-human-bridge-readiness/v1',
    version: Bridge.VERSION,
    generatedAt: '2026-08-19T06:30:00.000Z',
    status: 'TEST',
    state: 'WAITING_FOR_LIVE_HUMAN_EVIDENCE',
    capabilityComparison: {
      before: 'BLOCKED',
      bridgeContractAfter: 'READY',
      overallAfter: 'DEGRADED',
      liveOperationalPath: 'NOT_RUN'
    },
    currentInputs: {
      cycleRef: { id: cycle.cycleId, schema: cycle.schema, sha256: cycle.receiptDigest },
      protocolRef: { id: protocol.protocolId, schema: protocol.schema, sha256: protocol.protocolDigest },
      groundedOutcomeRef: { id: outcome.outcomeId, schema: outcome.schema, sha256: outcome.receiptDigest },
      evaluation: 'NOT_SUPPLIED',
      judgment: 'NOT_SUPPLIED',
      sourceTrust: 'NOT_SUPPLIED',
      evidenceClosure: 'NOT_SUPPLIED'
    },
    currentGroundedHumanClaim: {
      id: humanClaim.id,
      verdict: humanClaim.verdict,
      admittedVerdict: humanClaim.admittedVerdict,
      routeStatus: humanClaim.routeStatus,
      outcomeState: outcome.state,
      humanBenefitEstablished: false
    },
    bridgeGate: {
      syntheticFixtureAccepted: false,
      liveNativeEvaluationRequired: true,
      liveNativeJudgmentRequired: true,
      exactClaimCapabilityScopeRequired: true,
      capabilityCandidateSurfaceLinkRequired: true,
      externalSourceTrustReferenceRequired: true,
      currentExactClosureRequired: true,
      positiveLivePathVerified: false
    },
    sourceRefs: [
      fileRef('bridgeCore', 'grounded-growth-human-bridge-core', 'text/javascript'),
      fileRef('bridgeSelftest', 'grounded-growth-human-bridge-selftest', 'text/javascript'),
      fileRef('protocol', 'current-human-benefit-protocol-file', Human.PROTOCOL_SCHEMA),
      fileRef('humanReadiness', 'current-human-benefit-readiness', readiness.schema),
      fileRef('groundedOutcome', 'current-grounded-growth-outcome', Growth.OUTCOME_SCHEMA),
      fileRef('cycle', 'current-capability-cycle', Loop.RECEIPT_SCHEMA)
    ],
    nextGate: {
      authority: 'VOLUNTARY_LOCAL_HUMAN',
      action: 'If a person independently opts in, complete or withdraw from the existing answer-free protocol; only then can a native evaluation, judgment and bridge closure be considered.',
      automatic: false,
      requiredForHumanBenefitClaim: true
    },
    truth: {
      bridgeContractExists: true,
      liveHumanParticipationOccurredInThisIncrement: false,
      bridgeBundleEmittedForCurrentClaim: false,
      groundedOutcomeRefreshed: false,
      humanBenefitClaimed: false,
      syntheticEvidenceAcceptedAsHuman: false,
      sourceAuthenticationClaimed: false,
      automaticExecution: false,
      automaticInstall: false,
      automaticPromotion: false,
      automaticCanon: false,
      foundationMutation: false
    },
    receiptDigest: null
  };
  const payload = JSON.parse(JSON.stringify(receipt));
  delete payload.receiptDigest;
  receipt.receiptDigest = Bridge.sha256(payload);
  return receipt;
}

function verifyRecorded() {
  const recorded = JSON.parse(fs.readFileSync(path.join(__dirname, 'current-bridge-readiness-receipt.json'), 'utf8'));
  assert.deepStrictEqual(recorded, build(), 'recorded bridge readiness differs from exact current sources');
  if (!verifyDigest(recorded, 'receiptDigest')) throw new Error('recorded bridge readiness digest mismatch');
  return recorded;
}

if (require.main === module) {
  if (process.argv.includes('--check-recorded')) {
    const receipt = verifyRecorded();
    process.stdout.write('PASS current bridge readiness matches exact sources (' + receipt.state + ')\n');
  } else {
    process.stdout.write(JSON.stringify(build(), null, 2) + '\n');
  }
}

module.exports = { build, verifyRecorded };
