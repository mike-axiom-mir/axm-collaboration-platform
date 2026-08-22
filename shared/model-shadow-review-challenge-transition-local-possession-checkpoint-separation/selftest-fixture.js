'use strict';

const crypto = require('crypto');
const Anchor = require('../model-shadow-review-challenge-transition-local-possession-checkpoint-anchor/model-shadow-review-challenge-transition-local-possession-checkpoint-anchor');
const Witness = require('../model-shadow-review-challenge-transition-local-possession-checkpoint-witness/model-shadow-review-challenge-transition-local-possession-checkpoint-witness');

function copy(value) {
  return JSON.parse(JSON.stringify(value));
}

function sign(payload, privateKey, payloadBuilder) {
  const value = copy(payload);
  value.signature = crypto.sign(
    null,
    Buffer.from(payloadBuilder(value), 'utf8'),
    privateKey
  ).toString('base64');
  return value;
}

function publicKeyPem(pair) {
  return pair.publicKey.export({ type: 'spki', format: 'pem' }).toString();
}

function suffixFor(tag) {
  return String(tag || 'base').replace(/[^a-z0-9-]/gi, '-').toLowerCase();
}

function buildWitnessPackage(checkpoint, tag, options) {
  const settings = options || {};
  const suffix = suffixFor(tag);
  const pairs = settings.pairs || [crypto.generateKeyPairSync('ed25519'), crypto.generateKeyPairSync('ed25519')];
  const actorDigests = settings.actorDigests || pairs.map((unused, index) => (
    Witness.sha256('synthetic-local-possession-separation-witness-actor:' + suffix + ':' + (index + 1))
  ));
  const policy = {
    schema: Witness.POLICY_SCHEMA,
    policyId: 'local-possession-separation-witness-policy:' + suffix,
    issuedAt: '2026-08-20T15:23:00.000Z',
    expiresAt: '2026-08-20T16:00:00.000Z',
    audience: Witness.AUDIENCE,
    scope: Witness.SCOPE,
    authorityOrigin: Witness.AUTHORITY_ORIGIN,
    checkpointRef: { id: checkpoint.checkpointId, schema: checkpoint.schema, sha256: checkpoint.checkpointDigest },
    sourceSnapshotRef: copy(checkpoint.sourceSnapshotRef),
    receiverIdDigest: checkpoint.receiverIdDigest,
    challengerIdDigest: checkpoint.challengerIdDigest,
    receiverPolicyRef: copy(checkpoint.receiverPolicyRef),
    entriesDigest: checkpoint.entriesDigest,
    requiredSignatures: 2,
    maxAttestationAgeSeconds: 3600,
    keys: pairs.map((pair, index) => ({
      keyId: 'synthetic-local-possession-separation-witness-key:' + suffix + ':' + (index + 1),
      algorithm: 'Ed25519',
      publicKeyPem: publicKeyPem(pair),
      actorDigest: actorDigests[index],
      actorKind: index === 0 ? 'human' : 'machine',
      scope: Witness.SCOPE,
      enabled: true
    })),
    policyDigest: null
  };
  policy.policyDigest = Witness.policyDigest(policy);
  const signedAttestations = pairs.map((pair, index) => sign({
    schema: Witness.ATTESTATION_SCHEMA,
    attestationId: 'local-possession-separation-witness-attestation:' + suffix + ':' + (index + 1),
    keyId: policy.keys[index].keyId,
    actorDigest: policy.keys[index].actorDigest,
    actorKind: policy.keys[index].actorKind,
    verdict: 'WITNESS',
    scope: Witness.SCOPE,
    policyDigest: policy.policyDigest,
    checkpointDigest: checkpoint.checkpointDigest,
    sourceSnapshotDigest: checkpoint.sourceSnapshotRef.sha256,
    receiverIdDigest: checkpoint.receiverIdDigest,
    challengerIdDigest: checkpoint.challengerIdDigest,
    receiverPolicyDigest: checkpoint.receiverPolicyRef.sha256,
    entriesDigest: checkpoint.entriesDigest,
    issuedAt: '2026-08-20T15:23:10.000Z',
    expiresAt: '2026-08-20T15:40:00.000Z',
    signatureAlgorithm: 'Ed25519',
    signature: ''
  }, pair.privateKey, value => Witness.stableStringify(Witness.attestationSigningPayload(value))));
  const witnessInput = {
    witnessId: 'local-possession-separation-checkpoint-witness:' + suffix,
    verifiedAt: '2026-08-20T15:23:30.000Z',
    checkpoint: copy(checkpoint),
    keyPolicy: policy,
    signedAttestations
  };
  return { pairs, actorDigests, witnessInput, witnessReceipt: Witness.buildWitness(witnessInput) };
}

function buildAnchorPackage(witnessPackage, tag, options) {
  const settings = options || {};
  const suffix = suffixFor(tag);
  const pairs = settings.pairs || [crypto.generateKeyPairSync('ed25519'), crypto.generateKeyPairSync('ed25519')];
  const stewardDigests = settings.stewardDigests || pairs.map((unused, index) => (
    Anchor.sha256('synthetic-local-possession-separation-anchor-steward:' + suffix + ':' + (index + 1))
  ));
  const witness = witnessPackage.witnessReceipt;
  const anchorPolicy = {
    schema: Anchor.ANCHOR_POLICY_SCHEMA,
    anchorId: 'local-possession-separation-anchor:' + suffix,
    anchorEpoch: 1,
    issuedAt: '2026-08-20T15:22:00.000Z',
    expiresAt: '2026-08-20T16:20:00.000Z',
    status: 'TEST',
    audience: Anchor.AUDIENCE,
    scope: Anchor.SCOPE,
    authorityOrigin: Anchor.AUTHORITY_ORIGIN,
    requiredSignatures: 2,
    maxAuthorizationAgeSeconds: 3600,
    keys: pairs.map((pair, index) => ({
      anchorKeyId: 'synthetic-local-possession-separation-anchor-key:' + suffix + ':' + (index + 1),
      algorithm: 'Ed25519',
      publicKeyPem: publicKeyPem(pair),
      stewardDigest: stewardDigests[index],
      stewardKind: index === 0 ? 'human' : 'machine',
      scope: Anchor.SCOPE,
      enabled: true
    })),
    anchorDigest: null
  };
  anchorPolicy.anchorDigest = Anchor.anchorPolicyDigest(anchorPolicy);
  const policyAuthorizations = pairs.map((pair, index) => sign({
    schema: Anchor.AUTHORIZATION_SCHEMA,
    authorizationId: 'local-possession-separation-anchor-authorization:' + suffix + ':' + (index + 1),
    anchorKeyId: anchorPolicy.keys[index].anchorKeyId,
    stewardDigest: anchorPolicy.keys[index].stewardDigest,
    stewardKind: anchorPolicy.keys[index].stewardKind,
    verdict: 'AUTHORIZE',
    scope: Anchor.SCOPE,
    anchorDigest: anchorPolicy.anchorDigest,
    expectedAnchorDigest: anchorPolicy.anchorDigest,
    witnessPolicyDigest: witness.keyPolicyRef.sha256,
    witnessDigest: witness.witnessDigest,
    checkpointDigest: witness.checkpointRef.sha256,
    sourceSnapshotDigest: witness.sourceSnapshotRef.sha256,
    receiverIdDigest: witness.receiverIdDigest,
    challengerIdDigest: witness.challengerIdDigest,
    receiverPolicyDigest: witness.receiverPolicyRef.sha256,
    entriesDigest: witness.entriesDigest,
    issuedAt: '2026-08-20T15:23:40.000Z',
    expiresAt: '2026-08-20T16:00:00.000Z',
    signatureAlgorithm: 'Ed25519',
    signature: ''
  }, pair.privateKey, value => Anchor.stableStringify(Anchor.authorizationSigningPayload(value))));
  const anchoredWitnessInput = {
    receiptId: 'local-possession-separation-anchored-witness:' + suffix,
    verifiedAt: '2026-08-20T15:24:00.000Z',
    expectedAnchorDigest: anchorPolicy.anchorDigest,
    witnessInput: copy(witnessPackage.witnessInput),
    witnessReceipt: copy(witness),
    anchorPolicy,
    policyAuthorizations
  };
  return {
    pairs,
    stewardDigests,
    anchoredWitnessInput,
    anchoredWitnessReceipt: Anchor.buildAnchoredWitness(anchoredWitnessInput)
  };
}

module.exports = {
  copy,
  publicKeyPem,
  buildWitnessPackage,
  buildAnchorPackage
};
