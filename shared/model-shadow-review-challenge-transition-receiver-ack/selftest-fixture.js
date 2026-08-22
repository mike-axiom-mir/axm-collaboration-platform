'use strict';

const crypto = require('crypto');
const ReceiverAck = require('./model-shadow-review-challenge-transition-receiver-ack');
const DeclaredDisclosure = require('../model-shadow-review-challenge-transition-declared-disclosure/model-shadow-review-challenge-transition-declared-disclosure');
const DeclaredFixture = require('../model-shadow-review-challenge-transition-declared-disclosure/selftest-fixture');

function copy(value) {
  return JSON.parse(JSON.stringify(value));
}

function keyPair(receiverId) {
  const pair = crypto.generateKeyPairSync('ed25519');
  return {
    receiverId,
    publicKeyPem: pair.publicKey.export({ type: 'spki', format: 'pem' }).toString(),
    privateKey: pair.privateKey
  };
}

function policyInput(tag, assessment, keys, requiredAcknowledgements, options) {
  const settings = options || {};
  return {
    policyId: 'receiver-policy:' + tag,
    assessmentRef: ReceiverAck.assessmentRef(assessment),
    issuedAt: settings.issuedAt || '2026-08-20T15:06:00.000Z',
    expiresAt: settings.expiresAt || '2026-08-20T16:00:00.000Z',
    requiredAcknowledgements,
    receivers: keys.map(key => ({
      receiverId: key.receiverId,
      publicKeyPem: key.publicKeyPem,
      enabled: settings.disabledReceiverId !== key.receiverId
    }))
  };
}

function signedAcknowledgement(tag, policy, assessment, key, acknowledgedAt) {
  const acknowledgement = {
    schema: ReceiverAck.ACKNOWLEDGEMENT_SCHEMA,
    version: ReceiverAck.VERSION,
    acknowledgementId: 'receiver-acknowledgement:' + tag,
    policyDigest: policy.policyDigest,
    assessmentRef: ReceiverAck.assessmentRef(assessment),
    rosterRef: copy(assessment.rosterRef),
    receiverId: key.receiverId,
    acknowledgedAt,
    scope: ReceiverAck.SCOPE,
    retentionClaim: ReceiverAck.RETENTION_CLAIM,
    signatureAlgorithm: 'Ed25519',
    signature: ''
  };
  acknowledgement.signature = crypto.sign(
    null,
    Buffer.from(ReceiverAck.stableStringify(ReceiverAck.acknowledgementSigningPayload(acknowledgement)), 'utf8'),
    key.privateKey
  ).toString('base64');
  return acknowledgement;
}

function witnessInput(tag, assessmentInput, assessmentReceipt, policy, acknowledgements, verifiedAt) {
  return {
    witnessId: 'receiver-acknowledgement-witness:' + tag,
    verifiedAt: verifiedAt || '2026-08-20T15:10:00.000Z',
    assessmentInput: copy(assessmentInput),
    assessmentReceipt: copy(assessmentReceipt),
    receiverPolicy: copy(policy),
    signedAcknowledgements: copy(acknowledgements)
  };
}

function buildFixture(tempRoot) {
  const declared = DeclaredFixture.buildFixture(tempRoot);
  const assessmentInput = declared.assessmentInputs.compatible;
  const assessment = DeclaredDisclosure.buildAssessment(assessmentInput);
  const keys = [
    keyPair('receiver:alpha'),
    keyPair('receiver:beta'),
    keyPair('receiver:gamma')
  ];
  const basePolicyInput = policyInput('same-process', assessment, keys, 2);
  const policy = ReceiverAck.buildPolicy(basePolicyInput);
  const acknowledgements = [
    signedAcknowledgement('alpha', policy, assessment, keys[0], '2026-08-20T15:07:00.000Z'),
    signedAcknowledgement('beta', policy, assessment, keys[1], '2026-08-20T15:08:00.000Z'),
    signedAcknowledgement('gamma', policy, assessment, keys[2], '2026-08-20T15:09:00.000Z')
  ];
  const witnessInputs = {
    threshold: witnessInput('threshold', assessmentInput, assessment, policy, acknowledgements.slice(0, 2)),
    complete: witnessInput('complete', assessmentInput, assessment, policy, acknowledgements),
    incomplete: witnessInput('incomplete', assessmentInput, assessment, policy, acknowledgements.slice(0, 1)),
    empty: witnessInput('empty', assessmentInput, assessment, policy, [])
  };
  return {
    declared,
    assessmentInput,
    assessment,
    keys,
    basePolicyInput,
    policy,
    acknowledgements,
    witnessInputs
  };
}

module.exports = {
  copy,
  keyPair,
  policyInput,
  signedAcknowledgement,
  witnessInput,
  buildFixture
};
