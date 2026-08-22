'use strict';

const fs = require('fs');
const path = require('path');
const Custody = require('./model-shadow-review-challenge-transition-local-receiver-custody');
const ReceiverFixture = require('../model-shadow-review-challenge-transition-receiver-ack/selftest-fixture');

function copy(value) {
  return JSON.parse(JSON.stringify(value));
}

function privateKeyPem(key) {
  return key.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
}

function senderInput(fixture, receiverId, tag, sentAt) {
  return {
    confirmation: Custody.SEND_CONFIRMATION,
    deliveryId: 'local-delivery:' + tag,
    receiverId,
    sentAt: sentAt || '2026-08-20T15:06:30.000Z',
    assessmentInput: copy(fixture.assessmentInput),
    assessmentReceipt: copy(fixture.assessment),
    receiverPolicy: copy(fixture.policy)
  };
}

function receiverOptions(roots, key) {
  return {
    transportRoot: roots.transport,
    stateRoot: roots.receivers[key.receiverId],
    receiverId: key.receiverId,
    privateKeyPem: privateKeyPem(key)
  };
}

function receiveInput(senderReceipt, receivedAt) {
  return {
    confirmation: Custody.RECEIVE_CONFIRMATION,
    envelopeFileName: senderReceipt.envelopeFileName,
    senderReceipt: copy(senderReceipt),
    receivedAt
  };
}

function reloadOptions(options) {
  const result = copy(options);
  result.privateKeyPem = null;
  return result;
}

function buildFixture(tempRoot) {
  const upstreamRoot = path.join(tempRoot, 'upstream');
  fs.mkdirSync(upstreamRoot);
  const receiver = ReceiverFixture.buildFixture(upstreamRoot);
  const roots = {
    transport: path.join(tempRoot, 'transport'),
    receivers: {}
  };
  fs.mkdirSync(roots.transport);
  receiver.keys.forEach(key => {
    roots.receivers[key.receiverId] = path.join(tempRoot, key.receiverId.replace(':', '-'));
    fs.mkdirSync(roots.receivers[key.receiverId]);
  });
  return { receiver, roots };
}

module.exports = {
  copy,
  privateKeyPem,
  senderInput,
  receiverOptions,
  receiveInput,
  reloadOptions,
  buildFixture
};
