#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Coverage = require('./grounded-growth-human-route-coverage');
const Human = require('../human-benefit-evidence/human-benefit-evidence');
const Bridge = require('../grounded-growth-human-bridge-v2/grounded-growth-human-bridge-v2');
const Growth = require('../grounded-growth-outcomes/grounded-growth-outcomes');
const Loop = require('../verified-capability-loop/verified-capability-loop');

let checks = 0;
function check(value, message) {
  assert.ok(value, message);
  checks += 1;
}

function cycle(suffix) {
  const candidateRef = Loop.reference({ candidate: suffix }, { id: 'fixture-coverage-candidate-' + suffix, schema: 'text/javascript' });
  return Loop.build({
    cycleId: 'fixture-coverage-cycle-' + suffix,
    capabilityId: 'fixture.coverage.' + suffix,
    generatedAt: '2026-08-20T00:00:00.000Z',
    baseline: {
      kind: 'fixture-baseline',
      identity: 'synthetic human-route coverage baseline ' + suffix,
      receiptRef: Loop.reference({ baseline: suffix }, { id: 'fixture-coverage-baseline-' + suffix, schema: 'axm.baseline-observation/v1' })
    },
    need: {
      id: 'fixture-coverage-need-' + suffix,
      statement: 'Every current human claim needs a verified route or an explicit hold.',
      sourceRef: Loop.reference({ source: suffix }, { id: 'fixture-coverage-source-' + suffix, schema: 'axm.workshop-need/v1' })
    },
    gap: {
      state: 'OPEN',
      reason: 'Synthetic fixture route is not yet covered.',
      reportRef: Loop.reference({ gap: suffix }, { id: 'fixture-coverage-gap-' + suffix, schema: 'axm.capability-gap-report/v1' })
    },
    provenance: [
      Loop.reference({ provenance: suffix }, { id: 'fixture-coverage-provenance-' + suffix, schema: 'axm.source-provenance/v1' })
    ],
    candidate: {
      strategy: 'COMPOSE', status: 'EXPERIMENTAL', artifactRef: candidateRef,
      sourceMutationPerformed: false, installed: false, promoted: false, canon: false
    },
    verification: {
      verdict: 'PASS', subjectDigest: candidateRef.sha256,
      receiptRef: Loop.reference({ verification: suffix }, { id: 'fixture-coverage-verification-' + suffix, schema: 'axm.focused-test-receipt/v1' }),
      evidenceAuthority: 'MIXED', limitations: ['Synthetic fixture only.']
    },
    decision: null,
    availability: null,
    refresh: { trigger: 'NEW_INFORMATION', checkedAt: '2026-08-20T00:00:00.000Z', due: false, reason: 'Refresh when fixture changes.' }
  });
}

function humanClaim(suffix, verdict) {
  verdict = verdict || 'NOT_RUN';
  const passing = verdict === 'PASS';
  const baselineRef = passing ? Growth.reference({ baseline: suffix }, { id: 'fixture-human-baseline-' + suffix, schema: 'axm.comparison-surface/v1' }) : null;
  const outcomeRef = passing ? Growth.reference({ outcome: suffix }, { id: 'fixture-human-outcome-' + suffix, schema: 'axm.comparison-surface/v1' }) : null;
  const evidenceRef = passing ? Growth.reference({ evidence: suffix }, { id: 'fixture-human-evidence-' + suffix, schema: 'axm.human-benefit-evaluation-receipt/v1' }) : null;
  const covered = passing ? [baselineRef.sha256, outcomeRef.sha256, evidenceRef.sha256].sort() : [];
  return {
    id: 'fixture-coverage-human-benefit-' + suffix,
    beneficiary: 'HUMAN',
    statement: 'The named fixture steward makes fewer unsupported decisions with the covered surface ' + suffix + '.',
    kind: 'WORKFLOW_OUTCOME',
    verdict,
    proofSurface: passing ? 'REPRESENTATIVE_USER_JOURNEY' : 'NOT_RUN',
    baselineRef,
    outcomeRef,
    evidenceRefs: passing ? [evidenceRef] : [],
    evidenceClosure: passing ? {
      state: 'CURRENT', checkedAt: '2026-08-20T00:10:00.000Z',
      receiptRef: Growth.reference({ covered }, { id: 'fixture-human-closure-' + suffix, schema: 'axm.evidence-closure-receipt/v1' }),
      coveredDigests: covered
    } : { state: 'UNKNOWN', checkedAt: null, receiptRef: null, coveredDigests: [] },
    limitations: ['Synthetic fixture proves routing behavior only.']
  };
}

function outcome(suffix, verdict) {
  const currentCycle = cycle(suffix);
  return Growth.buildOutcome({
    outcomeId: 'fixture-coverage-outcome-' + suffix,
    generatedAt: '2026-08-20T00:10:00.000Z',
    cycleReceipt: currentCycle,
    interventionRef: currentCycle.candidate.artifactRef,
    informationRefs: [Growth.reference({ information: suffix }, { id: 'fixture-coverage-information-' + suffix, schema: 'axm.test-evidence/v1' })],
    claims: [humanClaim(suffix, verdict)],
    refresh: { checkedAt: '2026-08-20T00:10:00.000Z', due: false, reason: 'Fixture evidence state is current.' }
  });
}

function portfolio(verdictForHeld) {
  return Growth.buildPortfolio({
    portfolioId: 'fixture-human-route-coverage-portfolio',
    generatedAt: '2026-08-20T00:20:00.000Z',
    outcomes: [outcome('ready'), outcome('held', verdictForHeld)]
  });
}

function protocol(currentOutcome) {
  return Human.buildProtocol({
    protocolId: 'fixture-human-route-coverage-protocol',
    generatedAt: '2026-08-20T00:05:00.000Z',
    fixtureMode: 'LIVE',
    claim: {
      id: currentOutcome.claims[0].id,
      statement: currentOutcome.claims[0].statement,
      targetScope: 'NAMED_LOCAL_STEWARD',
      scopeStatement: 'Any result applies only to the participating local fixture steward.'
    },
    conditions: [
      {
        id: 'a', role: 'BASELINE', label: 'Condition A',
        artifactRef: Human.reference({ surface: 'baseline' }, { id: 'fixture-coverage-surface-a', schema: 'axm.comparison-surface/v1' })
      },
      {
        id: 'b', role: 'CANDIDATE', label: 'Condition B',
        artifactRef: Human.reference({ surface: 'candidate' }, { id: 'fixture-coverage-surface-b', schema: 'axm.comparison-surface/v1' })
      }
    ],
    trials: [
      { id: 'fixture-route-t1', caseId: 'fixture-route-c1', conditionId: 'a', order: 1, prompt: 'Condition A bounded decision.', expectedDecision: 'HOLD' },
      { id: 'fixture-route-t2', caseId: 'fixture-route-c2', conditionId: 'b', order: 2, prompt: 'Condition B bounded decision.', expectedDecision: 'CONTINUE' },
      { id: 'fixture-route-t3', caseId: 'fixture-route-c3', conditionId: 'a', order: 3, prompt: 'Condition A second bounded decision.', expectedDecision: 'HOLD' },
      { id: 'fixture-route-t4', caseId: 'fixture-route-c4', conditionId: 'b', order: 4, prompt: 'Condition B second bounded decision.', expectedDecision: 'CONTINUE' }
    ],
    fairness: { maximumSameConditionRun: 1 },
    successRule: {
      minimumCompletedSessions: 1,
      minimumCandidateAccuracyGain: 0,
      maximumCandidateUnsupportedContinueRate: 0,
      maximumCandidateMeanTimeRatio: 1.25,
      minimumHelpedFraction: 1,
      requireNoHighBurden: true
    }
  });
}

function packet(currentOutcome, currentProtocol) {
  const protocolRef = { id: currentProtocol.protocolId, schema: currentProtocol.schema, sha256: currentProtocol.protocolDigest };
  const value = {
    schema: Coverage.PACKET_SCHEMA,
    version: '0.1.0',
    packetId: 'fixture-human-route-coverage-packet',
    generatedAt: currentProtocol.generatedAt,
    capabilityBinding: {
      capabilityId: currentOutcome.capabilityId,
      humanClaimId: currentOutcome.claims[0].id,
      protocolRef,
      cycleRef: { id: currentOutcome.cycleReceipt.cycleId, schema: currentOutcome.cycleReceipt.schema, sha256: currentOutcome.cycleReceipt.receiptDigest },
      currentOutcomeRef: { id: currentOutcome.outcomeId, schema: currentOutcome.schema, sha256: currentOutcome.receiptDigest }
    },
    protocolRef,
    status: 'READY_FOR_VOLUNTARY_HUMAN_SESSION',
    notices: ['Participation is optional.', 'No free text or identity is retained.'],
    trials: currentProtocol.trials.map((trial) => ({
      trialId: trial.id,
      order: trial.order,
      conditionLabel: currentProtocol.conditions.find((condition) => condition.id === trial.conditionId).label,
      prompt: trial.prompt,
      responseFields: {
        decision: ['CONTINUE', 'HOLD', 'UNSURE'], confidence: 'integer 1 to 5',
        confusion: ['NONE', 'SOME', 'BLOCKED'], elapsedMs: 'integer 0 to 3600000'
      }
    })),
    completionFields: {
      effect: ['HELPED', 'HARMED', 'NO_MEANINGFUL_DIFFERENCE', 'UNSURE'],
      burden: ['LOW', 'ACCEPTABLE', 'HIGH'], confidence: 'integer 1 to 5'
    },
    responseBoundary: {
      schema: 'axm.human-benefit-response-input/v1', exactProtocolRefRequired: true,
      externalToWorkshopRepository: true, structuredNoFreeText: true
    },
    outputBoundary: {
      writesAutomatically: false, sendsToNetwork: false, authenticatesHuman: false, createsHumanBenefitVerdict: false
    },
    packetDigest: null
  };
  value.packetDigest = Coverage.packetDigest(value);
  return value;
}

function sources(currentPortfolio) {
  const readyOutcome = currentPortfolio.outcomes.find((item) => item.capabilityId === 'fixture.coverage.ready');
  const currentProtocol = protocol(readyOutcome);
  const currentPacket = packet(readyOutcome, currentProtocol);
  const link = Bridge.buildInterventionLink({
    linkId: 'fixture-human-route-coverage-link',
    generatedAt: '2026-08-20T00:15:00.000Z',
    cycleReceipt: readyOutcome.cycleReceipt,
    protocol: currentProtocol
  });
  return {
    portfolio: currentPortfolio,
    readyRoutes: [{
      capabilityId: readyOutcome.capabilityId,
      protocol: currentProtocol,
      packet: currentPacket,
      interventionLink: link,
      runnerRef: Human.reference({ runner: 'fixture' }, { id: 'fixture-human-route-runner', schema: 'text/javascript' })
    }],
    heldRoutes: [{
      capabilityId: 'fixture.coverage.held',
      reasonCode: 'DEFERRED_HUMAN_SURFACE_REQUIRES_STEWARD_DECISION',
      proposalId: 'fixture:deferred-human-surface',
      evidenceRefs: [Human.reference({ deferred: true }, { id: 'fixture-deferred-proposal', schema: 'axm.research-disposition/v1' })]
    }],
    sourceRefs: [Human.reference({ source: 'fixture coverage' }, { id: 'fixture-human-route-coverage-source', schema: 'axm.test-source/v1' })]
  };
}

function buildInput(overrides) {
  const currentSources = sources(portfolio());
  return Object.assign({
    receiptId: 'fixture-human-route-coverage-receipt',
    generatedAt: '2026-08-20T00:30:00.000Z',
    status: 'TEST'
  }, currentSources, overrides || {});
}

const schema = JSON.parse(fs.readFileSync(path.join(__dirname, 'grounded-growth-human-route-coverage-receipt.schema.json'), 'utf8'));
const contract = JSON.parse(fs.readFileSync(path.join(__dirname, 'module.contract.json'), 'utf8'));
check(schema.$id === Coverage.RECEIPT_SCHEMA, 'receipt schema identity matches implementation');
check(contract.status === 'TEST' && contract.permissions.length === 0 && contract.boundaries.writes.length === 0, 'module remains permissionless TEST with no writes');

const input = buildInput();
const receipt = Coverage.build(input);
check(receipt.state === 'BOUNDED_COVERAGE_WITH_EXPLICIT_HOLDS', 'complete coverage preserves an explicit hold');
check(receipt.coverage.currentCapabilityChains === 2 && receipt.coverage.readyRoutes === 1 && receipt.coverage.heldRoutes === 1, 'coverage counts every current chain exactly once');
check(receipt.coverage.humanPass === 0 && receipt.coverage.humanNotRun === 2, 'coverage invents no human evidence');
check(receipt.routes[0].routeState === Coverage.READY && receipt.routes[0].ancestryMode === 'CANDIDATE', 'claim-native candidate route is ready');
check(receipt.holds[0].routeState === Coverage.HELD_DEFERRED && receipt.holds[0].proposalId === 'fixture:deferred-human-surface', 'deferred surface remains a typed hold');
check(receipt.decision.autonomousActionCount === 0 && receipt.decision.reviewableActionCount === 0, 'coverage grants no action');
check(Object.entries(receipt.truth).filter(([key]) => key !== 'portfolioVerifiedNatively').every(([, value]) => value === false), 'truth block grants no human or lifecycle authority');
check(Coverage.verify(receipt, input).pass, 'native verification rebuilds exact coverage');
const portable = Coverage.verifyPortable(receipt);
check(portable.pass && portable.sourceTruth === 'UNKNOWN' && portable.humanBenefit === 'NOT_RUN', 'portable verification preserves source and human limits');

assert.throws(() => Coverage.build({ ...input, heldRoutes: [] }), /missing/i);
checks += 1;
assert.throws(() => Coverage.build({ ...input, heldRoutes: [{ ...input.heldRoutes[0], capabilityId: 'fixture.coverage.ready' }] }), /duplicate/i);
checks += 1;

const stalePacketInput = buildInput();
stalePacketInput.readyRoutes[0].packet.capabilityBinding.currentOutcomeRef.sha256 = Human.sha256('stale-outcome');
stalePacketInput.readyRoutes[0].packet.packetDigest = Coverage.packetDigest(stalePacketInput.readyRoutes[0].packet);
assert.throws(() => Coverage.build(stalePacketInput), /current outcome reference mismatch/i);
checks += 1;

const leakedInput = buildInput();
leakedInput.readyRoutes[0].packet.trials[0].expectedDecision = 'HOLD';
leakedInput.readyRoutes[0].packet.packetDigest = Coverage.packetDigest(leakedInput.readyRoutes[0].packet);
assert.throws(() => Coverage.build(leakedInput), /leaks expectedDecision/i);
checks += 1;

const crossClaimInput = buildInput();
crossClaimInput.readyRoutes[0].protocol.claim.id = 'cross-capability-human-claim';
crossClaimInput.readyRoutes[0].protocol.protocolDigest = Human.sha256((() => {
  const value = JSON.parse(JSON.stringify(crossClaimInput.readyRoutes[0].protocol));
  delete value.protocolDigest;
  return value;
})());
assert.throws(() => Coverage.build(crossClaimInput), /protocol human claim differs|packet.*protocol/i);
checks += 1;

const badLinkInput = buildInput();
badLinkInput.readyRoutes[0].interventionLink.capabilityId = 'fixture.coverage.held';
assert.throws(() => Coverage.build(badLinkInput), /intervention link invalid|crossed capability/i);
checks += 1;

const noProposalInput = buildInput();
noProposalInput.heldRoutes[0].proposalId = null;
assert.throws(() => Coverage.build(noProposalInput), /requires proposalId/i);
checks += 1;

const badReasonInput = buildInput();
badReasonInput.heldRoutes[0].reasonCode = 'IGNORE_THE_HOLD';
assert.throws(() => Coverage.build(badReasonInput), /unsupported human-route hold reason/i);
checks += 1;

const humanPassInput = buildInput({ portfolio: portfolio('PASS') });
assert.throws(() => Coverage.build(humanPassInput), /current human claim is not NOT_RUN/i);
checks += 1;

const tampered = JSON.parse(JSON.stringify(receipt));
tampered.coverage.readyRoutes = 2;
check(!Coverage.verifyPortable(tampered).pass, 'portable verifier rejects digest and count tampering');
tampered.receiptDigest = Coverage.sha256((() => {
  const value = JSON.parse(JSON.stringify(tampered));
  delete value.receiptDigest;
  return value;
})());
check(!Coverage.verifyPortable(tampered).pass, 'recomputed digest cannot hide coverage inflation');

const authority = JSON.parse(JSON.stringify(receipt));
authority.truth.humanBenefitEstablished = true;
authority.receiptDigest = Coverage.sha256((() => {
  const value = JSON.parse(JSON.stringify(authority));
  delete value.receiptDigest;
  return value;
})());
check(!Coverage.verifyPortable(authority).pass, 'recomputed digest cannot grant human benefit');

const holdAction = JSON.parse(JSON.stringify(receipt));
holdAction.holds[0].automaticAction = true;
holdAction.receiptDigest = Coverage.sha256((() => {
  const value = JSON.parse(JSON.stringify(holdAction));
  delete value.receiptDigest;
  return value;
})());
check(!Coverage.verifyPortable(holdAction).pass, 'recomputed digest cannot activate a held route');

console.log('PASS Grounded Growth human-route coverage selftest (' + checks + ' assertions)');
