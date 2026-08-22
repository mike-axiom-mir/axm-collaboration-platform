'use strict';

const crypto = require('crypto');
const Anchor = require('../model-shadow-review-challenge-transition-local-possession-checkpoint-anchor/model-shadow-review-challenge-transition-local-possession-checkpoint-anchor');
const Separation = require('../model-shadow-review-challenge-transition-local-possession-checkpoint-separation/model-shadow-review-challenge-transition-local-possession-checkpoint-separation');
const Witness = require('../model-shadow-review-challenge-transition-local-possession-checkpoint-witness/model-shadow-review-challenge-transition-local-possession-checkpoint-witness');

function copy(value) {
  return JSON.parse(JSON.stringify(value));
}

function sign(payload, privateKey, payloadBuilder) {
  const value = copy(payload);
  value.signature = crypto.sign(null, Buffer.from(payloadBuilder(value), 'utf8'), privateKey).toString('base64');
  return value;
}

function publicKeyPem(pair) {
  return pair.publicKey.export({ type: 'spki', format: 'pem' }).toString();
}

function slug(value) {
  return String(value || 'base').replace(/[^a-z0-9-]/gi, '-').toLowerCase();
}

function at(minute, second) {
  return '2026-08-20T15:' + String(minute).padStart(2, '0') + ':' + String(second || 0).padStart(2, '0') + '.000Z';
}

function createAuthority(tag, options) {
  const settings = options || {};
  const suffix = slug(tag);
  const witnessPairs = settings.witnessPairs || [crypto.generateKeyPairSync('ed25519'), crypto.generateKeyPairSync('ed25519')];
  const anchorPairs = settings.anchorPairs || [crypto.generateKeyPairSync('ed25519'), crypto.generateKeyPairSync('ed25519')];
  const actorDigests = settings.actorDigests || witnessPairs.map((unused, index) => Witness.sha256('local-possession-pairwise-witness-actor:' + suffix + ':' + index));
  const stewardDigests = settings.stewardDigests || anchorPairs.map((unused, index) => Anchor.sha256('local-possession-pairwise-anchor-steward:' + suffix + ':' + index));
  const witnessKeyIds = settings.witnessKeyIds || witnessPairs.map((unused, index) => 'local-possession-pairwise-witness-key:' + suffix + ':' + (index + 1));
  const anchorKeyIds = settings.anchorKeyIds || anchorPairs.map((unused, index) => 'local-possession-pairwise-anchor-key:' + suffix + ':' + (index + 1));
  const witnessPolicyId = settings.witnessPolicyId || 'local-possession-pairwise-witness-policy:stable';
  const anchorEpoch = settings.anchorEpoch || 1;
  const anchorPolicy = {
    schema: Anchor.ANCHOR_POLICY_SCHEMA,
    anchorId: settings.anchorId || 'local-possession-pairwise-anchor:stable',
    anchorEpoch,
    issuedAt: settings.anchorIssuedAt || '2026-08-20T15:20:00.000Z',
    expiresAt: settings.anchorExpiresAt || '2026-08-20T17:00:00.000Z',
    status: 'TEST',
    audience: Anchor.AUDIENCE,
    scope: Anchor.SCOPE,
    authorityOrigin: Anchor.AUTHORITY_ORIGIN,
    requiredSignatures: 2,
    maxAuthorizationAgeSeconds: 3600,
    keys: anchorPairs.map((pair, index) => ({
      anchorKeyId: anchorKeyIds[index],
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
  return {
    witnessPairs,
    anchorPairs,
    actorDigests,
    stewardDigests,
    witnessKeyIds,
    anchorKeyIds,
    witnessPolicyId,
    anchorPolicy
  };
}

function buildSeparatedChain(checkpoint, tag, authority, options) {
  const settings = options || {};
  const suffix = slug(tag);
  const minute = settings.minute || 23;
  const policy = {
    schema: Witness.POLICY_SCHEMA,
    policyId: settings.witnessPolicyId || authority.witnessPolicyId,
    issuedAt: at(minute, 0),
    expiresAt: at(minute + 20, 0),
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
    maxAttestationAgeSeconds: 1800,
    keys: authority.witnessPairs.map((pair, index) => ({
      keyId: authority.witnessKeyIds[index],
      algorithm: 'Ed25519',
      publicKeyPem: publicKeyPem(pair),
      actorDigest: authority.actorDigests[index],
      actorKind: index === 0 ? 'human' : 'machine',
      scope: Witness.SCOPE,
      enabled: true
    })),
    policyDigest: null
  };
  policy.policyDigest = Witness.policyDigest(policy);
  const signedAttestations = policy.keys.map((key, index) => sign({
    schema: Witness.ATTESTATION_SCHEMA,
    attestationId: 'local-possession-pairwise-witness-attestation:' + suffix + ':' + (index + 1),
    keyId: key.keyId,
    actorDigest: key.actorDigest,
    actorKind: key.actorKind,
    verdict: 'WITNESS',
    scope: Witness.SCOPE,
    policyDigest: policy.policyDigest,
    checkpointDigest: checkpoint.checkpointDigest,
    sourceSnapshotDigest: checkpoint.sourceSnapshotRef.sha256,
    receiverIdDigest: checkpoint.receiverIdDigest,
    challengerIdDigest: checkpoint.challengerIdDigest,
    receiverPolicyDigest: checkpoint.receiverPolicyRef.sha256,
    entriesDigest: checkpoint.entriesDigest,
    issuedAt: at(minute, 15),
    expiresAt: at(minute + 19, 15),
    signatureAlgorithm: 'Ed25519',
    signature: ''
  }, authority.witnessPairs[index].privateKey, value => Witness.stableStringify(Witness.attestationSigningPayload(value))));
  const witnessInput = {
    witnessId: 'local-possession-pairwise-checkpoint-witness:' + suffix,
    verifiedAt: at(minute + 1, 0),
    checkpoint: copy(checkpoint),
    keyPolicy: policy,
    signedAttestations
  };
  const witnessReceipt = Witness.buildWitness(witnessInput);
  const anchorPolicy = copy(authority.anchorPolicy);
  const policyAuthorizations = anchorPolicy.keys.map((key, index) => sign({
    schema: Anchor.AUTHORIZATION_SCHEMA,
    authorizationId: 'local-possession-pairwise-anchor-authorization:' + suffix + ':' + (index + 1),
    anchorKeyId: key.anchorKeyId,
    stewardDigest: key.stewardDigest,
    stewardKind: key.stewardKind,
    verdict: 'AUTHORIZE',
    scope: Anchor.SCOPE,
    anchorDigest: anchorPolicy.anchorDigest,
    expectedAnchorDigest: anchorPolicy.anchorDigest,
    witnessPolicyDigest: witnessReceipt.keyPolicyRef.sha256,
    witnessDigest: witnessReceipt.witnessDigest,
    checkpointDigest: witnessReceipt.checkpointRef.sha256,
    sourceSnapshotDigest: witnessReceipt.sourceSnapshotRef.sha256,
    receiverIdDigest: witnessReceipt.receiverIdDigest,
    challengerIdDigest: witnessReceipt.challengerIdDigest,
    receiverPolicyDigest: witnessReceipt.receiverPolicyRef.sha256,
    entriesDigest: witnessReceipt.entriesDigest,
    issuedAt: at(minute + 1, 15),
    expiresAt: at(minute + 21, 15),
    signatureAlgorithm: 'Ed25519',
    signature: ''
  }, authority.anchorPairs[index].privateKey, value => Anchor.stableStringify(Anchor.authorizationSigningPayload(value))));
  const anchoredWitnessInput = {
    receiptId: 'local-possession-pairwise-anchored-witness:' + suffix,
    verifiedAt: at(minute + 2, 0),
    expectedAnchorDigest: anchorPolicy.anchorDigest,
    witnessInput,
    witnessReceipt,
    anchorPolicy,
    policyAuthorizations
  };
  const anchoredWitnessReceipt = Anchor.buildAnchoredWitness(anchoredWitnessInput);
  const separationInput = {
    receiptId: 'local-possession-pairwise-separated-witness:' + suffix,
    verifiedAt: at(minute + 2, 30),
    anchoredWitnessInput,
    anchoredWitnessReceipt
  };
  const separationReceipt = Separation.buildSeparatedWitness(separationInput);
  return { separationInput, separationReceipt, checkpoint, authority };
}

function transitionInput(previous, candidate, tag, comparedAt) {
  return {
    transitionId: 'local-possession-pairwise-transition:' + slug(tag),
    comparedAt: comparedAt || '2026-08-20T15:55:00.000Z',
    previousSeparationInput: copy(previous.separationInput),
    previousSeparationReceipt: copy(previous.separationReceipt),
    candidateSeparationInput: copy(candidate.separationInput),
    candidateSeparationReceipt: copy(candidate.separationReceipt)
  };
}

module.exports = {
  copy,
  publicKeyPem,
  at,
  createAuthority,
  buildSeparatedChain,
  transitionInput
};
