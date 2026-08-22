'use strict';

const crypto = require('crypto');
const AnchorGate = require('../model-shadow-review-challenge-anchor-gate/model-shadow-review-challenge-anchor-gate');
const Witness = require('../model-shadow-review-challenge-witness/model-shadow-review-challenge-witness');

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

function suffixFor(tag) {
  return String(tag || 'base').replace(/[^a-z0-9-]/gi, '-').toLowerCase();
}

function buildWitnessPackage(checkpoint, tag, options) {
  const settings = options || {};
  const suffix = suffixFor(tag);
  const pairs = settings.pairs || [crypto.generateKeyPairSync('ed25519'), crypto.generateKeyPairSync('ed25519')];
  const actorDigests = settings.actorDigests || pairs.map((unused, index) => (
    Witness.sha256('fixture-separation-witness-actor:' + suffix + ':' + index)
  ));
  const actorKinds = settings.actorKinds || ['human', 'machine'];
  const policy = {
    schema: Witness.POLICY_SCHEMA,
    policyId: 'policy:separation-gate-witness-' + suffix,
    issuedAt: '2026-08-20T14:08:00.000Z',
    expiresAt: '2026-08-20T14:20:00.000Z',
    audience: Witness.AUDIENCE,
    scope: Witness.SCOPE,
    authorityOrigin: Witness.AUTHORITY_ORIGIN,
    checkpointRef: {
      id: checkpoint.checkpointId,
      schema: checkpoint.schema,
      sha256: checkpoint.checkpointDigest
    },
    ledgerRef: copy(checkpoint.ledgerRef),
    entriesDigest: checkpoint.entriesDigest,
    requiredSignatures: 2,
    maxAttestationAgeSeconds: 600,
    keys: pairs.map((pair, index) => ({
      keyId: 'fixture-separation-witness-key-' + suffix + '-' + (index + 1),
      algorithm: 'Ed25519',
      publicKeyPem: pair.publicKey.export({ type: 'spki', format: 'pem' }),
      actorDigest: actorDigests[index],
      actorKind: actorKinds[index],
      scope: Witness.SCOPE,
      enabled: true
    })),
    policyDigest: null
  };
  policy.policyDigest = Witness.policyDigest(policy);
  const attestations = policy.keys.map((key, index) => sign({
    schema: Witness.ATTESTATION_SCHEMA,
    attestationId: 'attestation:separation-witness-' + suffix + '-' + (index + 1),
    keyId: key.keyId,
    actorDigest: key.actorDigest,
    actorKind: key.actorKind,
    verdict: 'WITNESS',
    scope: Witness.SCOPE,
    policyDigest: policy.policyDigest,
    checkpointDigest: checkpoint.checkpointDigest,
    ledgerManifestDigest: checkpoint.ledgerRef.sha256,
    entriesDigest: checkpoint.entriesDigest,
    issuedAt: '2026-08-20T14:08:30.000Z',
    expiresAt: '2026-08-20T14:18:30.000Z',
    signatureAlgorithm: 'Ed25519',
    signature: ''
  }, pairs[index].privateKey, value => Witness.stableStringify(Witness.attestationSigningPayload(value))));
  const witnessInput = {
    witnessId: 'witness:separation-gate-' + suffix,
    verifiedAt: '2026-08-20T14:09:00.000Z',
    checkpoint: copy(checkpoint),
    keyPolicy: policy,
    signedAttestations: attestations
  };
  return { witnessInput, witnessReceipt: Witness.buildWitness(witnessInput), pairs };
}

function buildAnchorPackage(witnessPackage, tag, options) {
  const settings = options || {};
  const suffix = suffixFor(tag);
  const pairs = settings.pairs || [crypto.generateKeyPairSync('ed25519'), crypto.generateKeyPairSync('ed25519')];
  const stewardDigests = settings.stewardDigests || pairs.map((unused, index) => (
    AnchorGate.sha256('fixture-separation-anchor-steward:' + suffix + ':' + index)
  ));
  const stewardKinds = settings.stewardKinds || ['human', 'machine'];
  const witness = witnessPackage.witnessReceipt;
  const anchorPolicy = {
    schema: AnchorGate.ANCHOR_POLICY_SCHEMA,
    anchorId: 'anchor:separation-gate-' + suffix,
    anchorEpoch: 1,
    issuedAt: '2026-08-20T14:00:00.000Z',
    expiresAt: '2026-08-20T15:00:00.000Z',
    status: 'TEST',
    audience: AnchorGate.AUDIENCE,
    scope: AnchorGate.SCOPE,
    authorityOrigin: AnchorGate.AUTHORITY_ORIGIN,
    requiredSignatures: 2,
    maxAuthorizationAgeSeconds: 1800,
    keys: pairs.map((pair, index) => ({
      anchorKeyId: 'fixture-separation-anchor-key-' + suffix + '-' + (index + 1),
      algorithm: 'Ed25519',
      publicKeyPem: pair.publicKey.export({ type: 'spki', format: 'pem' }),
      stewardDigest: stewardDigests[index],
      stewardKind: stewardKinds[index],
      scope: AnchorGate.SCOPE,
      enabled: true
    })),
    anchorDigest: null
  };
  anchorPolicy.anchorDigest = AnchorGate.anchorPolicyDigest(anchorPolicy);
  const policyAuthorizations = anchorPolicy.keys.map((key, index) => sign({
    schema: AnchorGate.AUTHORIZATION_SCHEMA,
    authorizationId: 'authorization:separation-gate-' + suffix + '-' + (index + 1),
    anchorKeyId: key.anchorKeyId,
    stewardDigest: key.stewardDigest,
    stewardKind: key.stewardKind,
    verdict: 'AUTHORIZE',
    scope: AnchorGate.SCOPE,
    anchorDigest: anchorPolicy.anchorDigest,
    expectedAnchorDigest: anchorPolicy.anchorDigest,
    witnessPolicyDigest: witness.keyPolicyRef.sha256,
    witnessDigest: witness.witnessDigest,
    checkpointDigest: witness.checkpointRef.sha256,
    ledgerManifestDigest: witness.ledgerRef.sha256,
    entriesDigest: witness.entriesDigest,
    issuedAt: '2026-08-20T14:09:30.000Z',
    expiresAt: '2026-08-20T14:39:30.000Z',
    signatureAlgorithm: 'Ed25519',
    signature: ''
  }, pairs[index].privateKey, value => AnchorGate.stableStringify(AnchorGate.authorizationSigningPayload(value))));
  const anchoredWitnessInput = {
    receiptId: 'receipt:separation-anchored-witness-' + suffix,
    verifiedAt: '2026-08-20T14:10:00.000Z',
    expectedAnchorDigest: anchorPolicy.anchorDigest,
    witnessInput: copy(witnessPackage.witnessInput),
    witnessReceipt: copy(witness),
    anchorPolicy,
    policyAuthorizations
  };
  return {
    anchoredWitnessInput,
    anchoredWitnessReceipt: AnchorGate.buildAnchoredWitness(anchoredWitnessInput),
    pairs
  };
}

function buildAnchoredChain(checkpoint, tag, options) {
  const settings = options || {};
  const witnessPackage = buildWitnessPackage(checkpoint, tag, settings.witness);
  const anchorPackage = buildAnchorPackage(witnessPackage, tag, settings.anchor);
  return { witnessPackage, anchorPackage };
}

module.exports = { copy, buildWitnessPackage, buildAnchorPackage, buildAnchoredChain };
