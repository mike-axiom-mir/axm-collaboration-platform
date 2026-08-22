'use strict';

const crypto = require('crypto');
const AnchorGate = require('../model-shadow-review-challenge-anchor-gate/model-shadow-review-challenge-anchor-gate');
const SeparationGate = require('../model-shadow-review-challenge-separation-gate/model-shadow-review-challenge-separation-gate');
const Witness = require('../model-shadow-review-challenge-witness/model-shadow-review-challenge-witness');

function copy(value) {
  return JSON.parse(JSON.stringify(value));
}

function sign(payload, privateKey, payloadBuilder) {
  const value = copy(payload);
  value.signature = crypto.sign(null, Buffer.from(payloadBuilder(value), 'utf8'), privateKey).toString('base64');
  return value;
}

function slug(value) {
  return String(value || 'base').replace(/[^a-z0-9-]/gi, '-').toLowerCase();
}

function at(minute, second) {
  return '2026-08-20T14:' + String(minute).padStart(2, '0') + ':' + String(second || 0).padStart(2, '0') + '.000Z';
}

function createAuthority(tag, options) {
  const settings = options || {};
  const suffix = slug(tag);
  const witnessPairs = settings.witnessPairs || [crypto.generateKeyPairSync('ed25519'), crypto.generateKeyPairSync('ed25519')];
  const anchorPairs = settings.anchorPairs || [crypto.generateKeyPairSync('ed25519'), crypto.generateKeyPairSync('ed25519')];
  const actorDigests = settings.actorDigests || witnessPairs.map((unused, index) => Witness.sha256('transition-witness-actor:' + suffix + ':' + index));
  const stewardDigests = settings.stewardDigests || anchorPairs.map((unused, index) => AnchorGate.sha256('transition-anchor-steward:' + suffix + ':' + index));
  const anchorEpoch = settings.anchorEpoch || 1;
  const anchorPolicy = {
    schema: AnchorGate.ANCHOR_POLICY_SCHEMA,
    anchorId: settings.anchorId || 'anchor:transition-gate-stable',
    anchorEpoch,
    issuedAt: settings.anchorIssuedAt || '2026-08-20T14:00:00.000Z',
    expiresAt: settings.anchorExpiresAt || '2026-08-20T16:00:00.000Z',
    status: 'TEST',
    audience: AnchorGate.AUDIENCE,
    scope: AnchorGate.SCOPE,
    authorityOrigin: AnchorGate.AUTHORITY_ORIGIN,
    requiredSignatures: 2,
    maxAuthorizationAgeSeconds: 1800,
    keys: anchorPairs.map((pair, index) => ({
      anchorKeyId: 'transition-anchor-key-' + suffix + '-' + (index + 1),
      algorithm: 'Ed25519',
      publicKeyPem: pair.publicKey.export({ type: 'spki', format: 'pem' }),
      stewardDigest: stewardDigests[index],
      stewardKind: index === 0 ? 'human' : 'machine',
      scope: AnchorGate.SCOPE,
      enabled: true
    })),
    anchorDigest: null
  };
  anchorPolicy.anchorDigest = AnchorGate.anchorPolicyDigest(anchorPolicy);
  return { witnessPairs, anchorPairs, actorDigests, stewardDigests, anchorPolicy };
}

function buildSeparatedChain(checkpoint, tag, authority, options) {
  const settings = options || {};
  const suffix = slug(tag);
  const minute = settings.minute || 8;
  const policy = {
    schema: Witness.POLICY_SCHEMA,
    policyId: 'policy:transition-witness-' + suffix,
    issuedAt: at(minute, 0),
    expiresAt: at(minute + 10, 0),
    audience: Witness.AUDIENCE,
    scope: Witness.SCOPE,
    authorityOrigin: Witness.AUTHORITY_ORIGIN,
    checkpointRef: { id: checkpoint.checkpointId, schema: checkpoint.schema, sha256: checkpoint.checkpointDigest },
    ledgerRef: copy(checkpoint.ledgerRef),
    entriesDigest: checkpoint.entriesDigest,
    requiredSignatures: 2,
    maxAttestationAgeSeconds: 600,
    keys: authority.witnessPairs.map((pair, index) => ({
      keyId: 'transition-witness-key-' + suffix + '-' + (index + 1),
      algorithm: 'Ed25519',
      publicKeyPem: pair.publicKey.export({ type: 'spki', format: 'pem' }),
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
    attestationId: 'attestation:transition-' + suffix + '-' + (index + 1),
    keyId: key.keyId,
    actorDigest: key.actorDigest,
    actorKind: key.actorKind,
    verdict: 'WITNESS',
    scope: Witness.SCOPE,
    policyDigest: policy.policyDigest,
    checkpointDigest: checkpoint.checkpointDigest,
    ledgerManifestDigest: checkpoint.ledgerRef.sha256,
    entriesDigest: checkpoint.entriesDigest,
    issuedAt: at(minute, 30),
    expiresAt: at(minute + 9, 30),
    signatureAlgorithm: 'Ed25519',
    signature: ''
  }, authority.witnessPairs[index].privateKey, value => Witness.stableStringify(Witness.attestationSigningPayload(value))));
  const witnessInput = {
    witnessId: 'witness:transition-' + suffix,
    verifiedAt: at(minute + 1, 0),
    checkpoint: copy(checkpoint),
    keyPolicy: policy,
    signedAttestations
  };
  const witnessReceipt = Witness.buildWitness(witnessInput);
  const anchorPolicy = copy(authority.anchorPolicy);
  const policyAuthorizations = anchorPolicy.keys.map((key, index) => sign({
    schema: AnchorGate.AUTHORIZATION_SCHEMA,
    authorizationId: 'authorization:transition-' + suffix + '-' + (index + 1),
    anchorKeyId: key.anchorKeyId,
    stewardDigest: key.stewardDigest,
    stewardKind: key.stewardKind,
    verdict: 'AUTHORIZE',
    scope: AnchorGate.SCOPE,
    anchorDigest: anchorPolicy.anchorDigest,
    expectedAnchorDigest: anchorPolicy.anchorDigest,
    witnessPolicyDigest: witnessReceipt.keyPolicyRef.sha256,
    witnessDigest: witnessReceipt.witnessDigest,
    checkpointDigest: witnessReceipt.checkpointRef.sha256,
    ledgerManifestDigest: witnessReceipt.ledgerRef.sha256,
    entriesDigest: witnessReceipt.entriesDigest,
    issuedAt: at(minute + 1, 30),
    expiresAt: at(minute + 21, 30),
    signatureAlgorithm: 'Ed25519',
    signature: ''
  }, authority.anchorPairs[index].privateKey, value => AnchorGate.stableStringify(AnchorGate.authorizationSigningPayload(value))));
  const anchoredWitnessInput = {
    receiptId: 'receipt:transition-anchored-' + suffix,
    verifiedAt: at(minute + 2, 0),
    expectedAnchorDigest: anchorPolicy.anchorDigest,
    witnessInput,
    witnessReceipt,
    anchorPolicy,
    policyAuthorizations
  };
  const anchoredWitnessReceipt = AnchorGate.buildAnchoredWitness(anchoredWitnessInput);
  const separationInput = {
    receiptId: 'receipt:transition-separated-' + suffix,
    verifiedAt: at(minute + 2, 30),
    anchoredWitnessInput,
    anchoredWitnessReceipt
  };
  const separationReceipt = SeparationGate.buildSeparatedWitness(separationInput);
  return { separationInput, separationReceipt, checkpoint, authority };
}

function transitionInput(previous, candidate, tag, comparedAt) {
  return {
    transitionId: 'transition:' + slug(tag),
    comparedAt: comparedAt || '2026-08-20T14:40:00.000Z',
    previousSeparationInput: copy(previous.separationInput),
    previousSeparationReceipt: copy(previous.separationReceipt),
    candidateSeparationInput: copy(candidate.separationInput),
    candidateSeparationReceipt: copy(candidate.separationReceipt)
  };
}

module.exports = { copy, at, createAuthority, buildSeparatedChain, transitionInput };
