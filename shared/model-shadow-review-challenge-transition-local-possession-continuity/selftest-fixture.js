'use strict';

const Possession = require('../model-shadow-review-challenge-transition-local-possession-challenge/model-shadow-review-challenge-transition-local-possession-challenge');
const PossessionFixture = require('../model-shadow-review-challenge-transition-local-possession-challenge/selftest-fixture');

function copy(value) {
  return JSON.parse(JSON.stringify(value));
}

function buildFixture(tempRoot) {
  const possession = PossessionFixture.buildFixture(tempRoot);
  const possessionService = Possession.createReceiver(possession.receiverOptions);
  const first = possessionService.answer(copy(possession.answerInput));
  const continuityOptions = {
    stateRoot: possession.receiverOptions.stateRoot,
    receiverId: possession.receiverOptions.receiverId,
    challengerId: possession.receiverOptions.challengerId,
    challengerPublicKeyPem: possession.receiverOptions.challengerPublicKeyPem,
    receiverPolicy: copy(possession.receiver.policy),
    observationId: 'local-possession-observation:base',
    observedAt: '2026-08-20T15:22:00.000Z'
  };
  return { possession, possessionService, first, continuityOptions };
}

function issueChallenge(fixture, byte, overrides) {
  return fixture.possession.challengerService.issue(Object.assign(copy(fixture.possession.challengeInput), {
    nonce: Buffer.alloc(32, byte).toString('base64')
  }, overrides || {}));
}

function answer(fixture, challenge, answeredAt) {
  return fixture.possessionService.answer(Object.assign(copy(fixture.possession.answerInput), {
    challenge: copy(challenge),
    answeredAt
  }));
}

function observationOptions(fixture, observationId, observedAt, overrides) {
  return Object.assign(copy(fixture.continuityOptions), { observationId, observedAt }, overrides || {});
}

module.exports = {
  copy,
  buildFixture,
  issueChallenge,
  answer,
  observationOptions
};
