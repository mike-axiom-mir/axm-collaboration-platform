'use strict';

const crypto = require('crypto');
const Custody = require('../model-shadow-review-challenge-transition-local-receiver-custody/model-shadow-review-challenge-transition-local-receiver-custody');
const CustodyFixture = require('../model-shadow-review-challenge-transition-local-receiver-custody/selftest-fixture');
const Possession = require('./model-shadow-review-challenge-transition-local-possession-challenge');

function copy(value) {
  return JSON.parse(JSON.stringify(value));
}

function privateKeyPem(key) {
  return key.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
}

function publicKeyPem(key) {
  return key.publicKey.export({ type: 'spki', format: 'pem' }).toString();
}

function buildFixture(tempRoot) {
  const custodyFixture = CustodyFixture.buildFixture(tempRoot);
  const receiver = custodyFixture.receiver;
  const receiverKey = receiver.keys[0];
  const sender = Custody.createSender({ transportRoot: custodyFixture.roots.transport });
  const senderReceipt = sender.send(CustodyFixture.senderInput(receiver, receiverKey.receiverId, 'possession-alpha', '2026-08-20T15:06:30.000Z'));
  const custodyOptions = CustodyFixture.receiverOptions(custodyFixture.roots, receiverKey);
  const custodyResult = Custody.createReceiver(custodyOptions).receive(CustodyFixture.receiveInput(senderReceipt, '2026-08-20T15:07:00.000Z'));
  const challengerPair = crypto.generateKeyPairSync('ed25519');
  const challenger = {
    challengerId: 'challenger:local-audit',
    publicKey: challengerPair.publicKey,
    privateKey: challengerPair.privateKey
  };
  const challengerService = Possession.createChallenger({
    challengerId: challenger.challengerId,
    privateKeyPem: privateKeyPem(challenger)
  });
  const challengeInput = {
    receiverId: receiverKey.receiverId,
    custodyRecordRef: copy(custodyResult.receiverReceipt.custodyRecordRef),
    receiverPolicyRef: copy(custodyResult.receiverReceipt.receiverPolicyRef),
    nonce: Buffer.alloc(32, 0x41).toString('base64'),
    issuedAt: '2026-08-20T15:20:00.000Z',
    expiresAt: '2026-08-20T15:30:00.000Z'
  };
  const challenge = challengerService.issue(challengeInput);
  const receiverOptions = {
    stateRoot: custodyFixture.roots.receivers[receiverKey.receiverId],
    receiverId: receiverKey.receiverId,
    privateKeyPem: privateKeyPem(receiverKey),
    challengerId: challenger.challengerId,
    challengerPublicKeyPem: publicKeyPem(challenger)
  };
  const answerInput = {
    confirmation: Possession.ANSWER_CONFIRMATION,
    recordFileName: custodyResult.recordFileName,
    receiverPolicy: copy(receiver.policy),
    challenge: copy(challenge),
    answeredAt: '2026-08-20T15:21:00.000Z'
  };
  return {
    custodyFixture,
    receiver,
    receiverKey,
    custodyResult,
    challenger,
    challengerService,
    challengeInput,
    challenge,
    receiverOptions,
    answerInput
  };
}

module.exports = {
  copy,
  privateKeyPem,
  publicKeyPem,
  buildFixture
};
