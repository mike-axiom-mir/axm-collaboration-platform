'use strict';

const fs = require('fs');
const path = require('path');
const Human = require('../../../shared/human-benefit-evidence/human-benefit-evidence');
const Builder = require('./build-portfolio-readiness');

const ALLOWED_TOP = new Set([
  'schema', 'protocolRef', 'sessionId', 'generatedAt', 'fixtureMode', 'startedAt', 'completedAt',
  'participantRef', 'consent', 'observations', 'participantJudgment'
]);
const ALLOWED_REF = new Set(['id', 'schema', 'sha256']);
const ALLOWED_CONSENT = new Set([
  'mode', 'grantedAt', 'completionConfirmedAt', 'withdrawnAt', 'useScope', 'retentionAccepted'
]);
const ALLOWED_OBSERVATION = new Set(['trialId', 'decision', 'confidence', 'confusion', 'elapsedMs']);
const ALLOWED_JUDGMENT = new Set(['effect', 'burden', 'confidence']);

function refuseUnknownKeys(value, allowed, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(label + ' must be an object');
  const unknown = Object.keys(value).filter((key) => !allowed.has(key));
  if (unknown.length) throw new Error(label + ' contains forbidden or unknown fields: ' + unknown.join(', '));
}

function sameReference(left, right) {
  return Boolean(left && right && left.id === right.id && left.schema === right.schema && left.sha256 === right.sha256);
}

function isWithin(root, target) {
  const relative = path.relative(root, target);
  return relative === '' || (!relative.startsWith('..' + path.sep) && relative !== '..' && !path.isAbsolute(relative));
}

function selectExact(capabilityId) {
  const exact = Builder.loadRecordedRoute(capabilityId);
  const protocolCheck = Human.verifyProtocol(exact.protocol);
  const packetCheck = Builder.verifyParticipantPacket(exact.protocol, exact.packet);
  if (!protocolCheck.pass) throw new Error('selected protocol is invalid: ' + protocolCheck.errors.join('; '));
  if (!packetCheck.pass) throw new Error('selected participant packet is invalid or leaks answers');
  return exact;
}

function loadResponse(capabilityId, responsePath) {
  const workspaceRoot = fs.realpathSync(path.resolve(__dirname, '..', '..', '..'));
  const exactPath = fs.realpathSync(path.resolve(responsePath));
  if (isWithin(workspaceRoot, exactPath)) throw new Error('live response input must stay outside the Workshop repository');
  const response = JSON.parse(fs.readFileSync(exactPath, 'utf8'));
  refuseUnknownKeys(response, ALLOWED_TOP, 'response');
  refuseUnknownKeys(response.protocolRef, ALLOWED_REF, 'protocolRef');
  refuseUnknownKeys(response.consent, ALLOWED_CONSENT, 'consent');
  if (!Array.isArray(response.observations)) throw new Error('observations must be an array');
  response.observations.forEach((observation, index) => refuseUnknownKeys(observation, ALLOWED_OBSERVATION, 'observation[' + index + ']'));
  if (response.participantJudgment != null) refuseUnknownKeys(response.participantJudgment, ALLOWED_JUDGMENT, 'participantJudgment');
  if (response.schema !== 'axm.human-benefit-response-input/v1') throw new Error('response schema mismatch');
  const exact = selectExact(capabilityId);
  if (!sameReference(response.protocolRef, exact.packet.protocolRef)) {
    throw new Error('response protocolRef does not match the selected capability route');
  }
  return { exact, response };
}

function buildSession(capabilityId, responsePath) {
  Builder.verifyRecorded();
  const { exact, response } = loadResponse(capabilityId, responsePath);
  const nativeInput = JSON.parse(JSON.stringify(response));
  delete nativeInput.protocolRef;
  return Human.buildSession(exact.protocol, nativeInput);
}

function main() {
  const capabilityId = process.argv[2];
  const responsePath = process.argv[3];
  if (!capabilityId || !responsePath) {
    throw new Error('usage: node run-portfolio-human-session.js <capability-id> <response.json outside the Workshop>');
  }
  console.log(JSON.stringify(buildSession(capabilityId, responsePath), null, 2));
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error.stack || error.message);
    process.exitCode = 1;
  }
}

module.exports = { buildSession, loadResponse, selectExact, sameReference };

