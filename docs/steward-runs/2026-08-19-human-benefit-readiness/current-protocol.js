'use strict';

const fs = require('fs');
const path = require('path');
const Human = require('../../../shared/human-benefit-evidence/human-benefit-evidence');

const PROTOCOL_PATH = path.join(__dirname, 'current-protocol.json');
const PACKET_PATH = path.join(__dirname, 'current-participant-packet.json');

function readCanonicalText(name) {
  return fs.readFileSync(path.join(__dirname, name), 'utf8')
    .replace(/^\uFEFF/, '')
    .replace(/\r\n/g, '\n');
}

function buildCurrentProtocol() {
  const baselineRaw = readCanonicalText('baseline-surface.json');
  const candidateRaw = readCanonicalText('candidate-surface.json');
  return Human.buildProtocol({
    protocolId: 'evidence-source-closure-local-steward-20260819',
    generatedAt: '2026-08-19T05:20:00.000Z',
    fixtureMode: 'LIVE',
    claim: {
      id: 'registered-source-closure-human-benefit',
      statement: 'The exact source-closure surface helps the participating local AXM steward notice stale evidence sooner and avoid unsupported continuation decisions.',
      targetScope: 'NAMED_LOCAL_STEWARD',
      scopeStatement: 'Any result applies only to the participating local AXM steward and cannot be generalized to other people.'
    },
    conditions: [
      {
        id: 'condition-a',
        role: 'BASELINE',
        label: 'Condition A',
        artifactRef: Human.reference(baselineRaw, { id: 'registered-identity-surface', schema: 'axm.human-benefit-comparison-surface/v1' })
      },
      {
        id: 'condition-b',
        role: 'CANDIDATE',
        label: 'Condition B',
        artifactRef: Human.reference(candidateRaw, { id: 'exact-closure-surface', schema: 'axm.human-benefit-comparison-surface/v1' })
      }
    ],
    trials: [
      {
        id: 'review-1', caseId: 'registered-without-later-check-1', conditionId: 'condition-a', order: 1,
        prompt: 'Condition A: a source digest was recorded yesterday. No later existence, type, or byte check is shown. A decision today requires the source bytes to still be current. Continue, hold, or mark unsure?',
        expectedDecision: 'HOLD'
      },
      {
        id: 'review-2', caseId: 'current-closure-1', conditionId: 'condition-b', order: 2,
        prompt: 'Condition B: the registered digest and a fresh exact check match; closure state is CURRENT. The decision requires current source bytes. Continue, hold, or mark unsure?',
        expectedDecision: 'CONTINUE'
      },
      {
        id: 'review-3', caseId: 'changed-closure-1', conditionId: 'condition-b', order: 3,
        prompt: 'Condition B: a fresh exact check differs from the registered digest; closure state is CHANGED. The decision requires the registered source bytes. Continue, hold, or mark unsure?',
        expectedDecision: 'HOLD'
      },
      {
        id: 'review-4', caseId: 'registered-without-later-check-2', conditionId: 'condition-a', order: 4,
        prompt: 'Condition A: a report says the source was registered successfully. It gives no later closure state. A downstream acceptance relies on the source still existing unchanged. Continue, hold, or mark unsure?',
        expectedDecision: 'HOLD'
      },
      {
        id: 'review-5', caseId: 'registered-without-later-check-3', conditionId: 'condition-a', order: 5,
        prompt: 'Condition A: the original registration timestamp and digest are visible, but current file type and bytes are not checked. A decision requires current exact bytes. Continue, hold, or mark unsure?',
        expectedDecision: 'HOLD'
      },
      {
        id: 'review-6', caseId: 'missing-closure-1', conditionId: 'condition-b', order: 6,
        prompt: 'Condition B: a fresh closure check cannot find the registered source; closure state is MISSING. A decision relies on that source. Continue, hold, or mark unsure?',
        expectedDecision: 'HOLD'
      }
    ],
    fairness: { maximumSameConditionRun: 2 },
    successRule: {
      minimumCompletedSessions: 1,
      minimumCandidateAccuracyGain: 0,
      maximumCandidateUnsupportedContinueRate: 0,
      maximumCandidateMeanTimeRatio: 1,
      minimumHelpedFraction: 1,
      requireNoHighBurden: true
    }
  });
}

function buildParticipantPacket(protocol) {
  const conditionLabels = new Map(protocol.conditions.map((condition) => [condition.id, condition.label]));
  const packet = {
    schema: 'axm.human-benefit-participant-packet/v1',
    version: '0.1.0',
    packetId: 'source-closure-local-steward-participant-packet-20260819',
    generatedAt: protocol.generatedAt,
    protocolRef: {
      id: protocol.protocolId,
      schema: Human.PROTOCOL_SCHEMA,
      sha256: protocol.protocolDigest
    },
    status: 'READY_FOR_VOLUNTARY_HUMAN_SESSION',
    notices: [
      'Participation is optional. Stopping or withdrawing does not count as failure.',
      'The packet records only structured choices, confidence, confusion, elapsed milliseconds, effect and burden.',
      'Do not enter a name, email address, free-text comment, audio, video or screen recording.',
      'This one-person result can describe only the participating local steward.',
      'The condition roles and expected decisions are intentionally absent from this participant packet.'
    ],
    trials: protocol.trials.map((trial) => ({
      trialId: trial.id,
      order: trial.order,
      conditionLabel: conditionLabels.get(trial.conditionId),
      prompt: trial.prompt,
      responseFields: {
        decision: ['CONTINUE', 'HOLD', 'UNSURE'],
        confidence: 'integer 1 to 5',
        confusion: ['NONE', 'SOME', 'BLOCKED'],
        elapsedMs: 'integer 0 to 3600000'
      }
    })),
    completionFields: {
      effect: ['HELPED', 'HARMED', 'NO_MEANINGFUL_DIFFERENCE', 'UNSURE'],
      burden: ['LOW', 'ACCEPTABLE', 'HIGH'],
      confidence: 'integer 1 to 5'
    },
    outputBoundary: {
      writesAutomatically: false,
      sendsToNetwork: false,
      authenticatesHuman: false,
      createsHumanBenefitVerdict: false
    },
    packetDigest: null
  };
  const digestPayload = JSON.parse(JSON.stringify(packet));
  delete digestPayload.packetDigest;
  packet.packetDigest = Human.sha256(digestPayload);
  return packet;
}

function verifyParticipantPacket(protocol, packet) {
  const rebuilt = buildParticipantPacket(protocol);
  const serialized = Human.stableStringify(packet);
  const forbidden = ['expectedDecision', 'BASELINE', 'CANDIDATE', 'artifactRef'];
  const leaks = forbidden.filter((token) => serialized.includes(token));
  return {
    pass: Human.stableStringify(rebuilt) === serialized && leaks.length === 0,
    leaks
  };
}

function loadExact() {
  return {
    protocol: JSON.parse(fs.readFileSync(PROTOCOL_PATH, 'utf8')),
    packet: JSON.parse(fs.readFileSync(PACKET_PATH, 'utf8'))
  };
}

function main() {
  const protocol = buildCurrentProtocol();
  const packet = buildParticipantPacket(protocol);
  if (process.argv.includes('--print-protocol')) return console.log(JSON.stringify(protocol, null, 2));
  if (process.argv.includes('--print-packet')) return console.log(JSON.stringify(packet, null, 2));
  if (process.argv.includes('--exact')) {
    const exact = loadExact();
    if (Human.stableStringify(protocol) !== Human.stableStringify(exact.protocol)) throw new Error('current-protocol.json does not match exact sources');
    const packetCheck = verifyParticipantPacket(protocol, exact.packet);
    if (!packetCheck.pass) throw new Error('participant packet mismatch or answer leak: ' + packetCheck.leaks.join(', '));
    console.log('PASS current live protocol and answer-free participant packet match exact sources');
    return;
  }
  console.log(JSON.stringify({ protocol, packet }, null, 2));
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error.stack || error.message);
    process.exitCode = 1;
  }
}

module.exports = { buildCurrentProtocol, buildParticipantPacket, verifyParticipantPacket, loadExact };
