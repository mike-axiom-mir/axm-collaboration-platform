'use strict';

const fs = require('fs');
const path = require('path');
const Human = require('../../../shared/human-benefit-evidence/human-benefit-evidence');
const Current = require('./current-protocol');

const ALLOWED_TOP = new Set([
  'schema', 'sessionId', 'generatedAt', 'fixtureMode', 'startedAt', 'completedAt',
  'participantRef', 'consent', 'observations', 'participantJudgment'
]);
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

function isWithin(root, target) {
  const relative = path.relative(root, target);
  return relative === '' || (!relative.startsWith('..' + path.sep) && relative !== '..' && !path.isAbsolute(relative));
}

function loadResponse(responsePath) {
  const workspaceRoot = fs.realpathSync(path.resolve(__dirname, '..', '..', '..'));
  const exactPath = fs.realpathSync(path.resolve(responsePath));
  if (isWithin(workspaceRoot, exactPath)) throw new Error('live response input must stay outside the Workshop repository');
  const response = JSON.parse(fs.readFileSync(exactPath, 'utf8'));
  refuseUnknownKeys(response, ALLOWED_TOP, 'response');
  refuseUnknownKeys(response.consent, ALLOWED_CONSENT, 'consent');
  if (!Array.isArray(response.observations)) throw new Error('observations must be an array');
  response.observations.forEach((observation, index) => refuseUnknownKeys(observation, ALLOWED_OBSERVATION, 'observation[' + index + ']'));
  if (response.participantJudgment != null) refuseUnknownKeys(response.participantJudgment, ALLOWED_JUDGMENT, 'participantJudgment');
  return response;
}

function main() {
  const responsePath = process.argv[2];
  if (!responsePath) throw new Error('usage: node run-current-human-session.js <response.json outside the Workshop>');
  const protocol = Current.buildCurrentProtocol();
  const exact = Current.loadExact();
  if (Human.stableStringify(protocol) !== Human.stableStringify(exact.protocol)) throw new Error('current protocol sources changed; rebuild before collecting a response');
  const response = loadResponse(responsePath);
  if (response.schema !== 'axm.human-benefit-response-input/v1') throw new Error('response schema mismatch');
  const session = Human.buildSession(protocol, response);
  console.log(JSON.stringify(session, null, 2));
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error.stack || error.message);
    process.exitCode = 1;
  }
}

module.exports = { loadResponse };
