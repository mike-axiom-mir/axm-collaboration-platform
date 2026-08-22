'use strict';

const crypto = require('crypto');
const Anchor = require('../model-shadow-history-checkpoint-anchor/model-shadow-history-checkpoint-anchor');

function copy(value) { return JSON.parse(JSON.stringify(value)); }
function slug(value) { return String(value || 'base').replace(/[^a-z0-9-]/gi, '-').toLowerCase(); }
function at(totalMinute, second) {
  return new Date(Date.UTC(2026, 7, 20, 15, totalMinute, second || 0)).toISOString();
}
function publicKeyPem(pair) { return pair.publicKey.export({ type: 'spki', format: 'pem' }).toString(); }
function digest(value) { return Anchor.sha256('synthetic-v2.3-principal:' + value); }
function sign(value, privateKey, builder) {
  const result = copy(value);
  result.signature = crypto.sign(null, Buffer.from(builder(result), 'utf8'), privateKey).toString('base64');
  return result;
}

function createAuthority(tag, settings) {
  const options = settings || {};
  const suffix = slug(tag);
  const witnessPairs = options.witnessPairs || [crypto.generateKeyPairSync('ed25519'), crypto.generateKeyPairSync('ed25519')];
  const anchorPairs = options.anchorPairs || [crypto.generateKeyPairSync('ed25519'), crypto.generateKeyPairSync('ed25519')];
  return {
    witnessPairs,
    anchorPairs,
    witnessPolicyId: options.witnessPolicyId || 'history-checkpoint-pairwise-witness-policy:' + suffix,
    anchorPolicyId: options.anchorPolicyId || 'history-checkpoint-pairwise-anchor-policy:' + suffix,
    anchorId: options.anchorId || 'history-checkpoint-pairwise-anchor:' + suffix,
    anchorEpoch: options.anchorEpoch || 1,
    witnessKeyIds: options.witnessKeyIds || witnessPairs.map((unused, index) => 'history-checkpoint-pairwise-witness-key:' + suffix + ':' + (index + 1)),
    anchorKeyIds: options.anchorKeyIds || anchorPairs.map((unused, index) => 'history-checkpoint-pairwise-anchor-key:' + suffix + ':' + (index + 1)),
    witnessPrincipals: options.witnessPrincipals || witnessPairs.map((unused, index) => digest(suffix + ':witness:' + (index + 1))),
    anchorPrincipals: options.anchorPrincipals || anchorPairs.map((unused, index) => digest(suffix + ':anchor:' + (index + 1)))
  };
}

function buildAnchoredPackage(checkpoint, tag, authority, minute, settings) {
  const options = settings || {};
  const suffix = slug(tag);
  const witnessPolicy = {
    schema: Anchor.WITNESS_POLICY_SCHEMA,
    policyId: options.witnessPolicyId || authority.witnessPolicyId,
    issuedAt: at(minute, 0),
    expiresAt: at(minute + 35, 0),
    audience: Anchor.WITNESS_AUDIENCE,
    scope: Anchor.WITNESS_SCOPE,
    authorityOrigin: Anchor.POLICY_AUTHORITY_ORIGIN,
    checkpointRef: { id: checkpoint.checkpointId, schema: checkpoint.schema, sha256: checkpoint.checkpointDigest },
    requiredSignatures: 2,
    maxAttestationAgeSeconds: 3600,
    keys: authority.witnessPairs.map((pair, index) => ({
      keyId: authority.witnessKeyIds[index],
      algorithm: 'Ed25519',
      publicKeyPem: publicKeyPem(pair),
      actorDigest: authority.witnessPrincipals[index],
      actorKind: index === 0 ? 'human' : 'machine',
      scope: Anchor.WITNESS_SCOPE,
      enabled: true
    })),
    policyDigest: null
  };
  witnessPolicy.policyDigest = Anchor.witnessPolicyDigest(witnessPolicy);
  const signedAttestations = authority.witnessPairs.map((pair, index) => sign({
    schema: Anchor.WITNESS_ATTESTATION_SCHEMA,
    attestationId: 'history-checkpoint-pairwise-attestation:' + suffix + ':' + (index + 1),
    keyId: witnessPolicy.keys[index].keyId,
    actorDigest: witnessPolicy.keys[index].actorDigest,
    actorKind: witnessPolicy.keys[index].actorKind,
    verdict: 'WITNESS',
    scope: Anchor.WITNESS_SCOPE,
    policyDigest: witnessPolicy.policyDigest,
    checkpointDigest: checkpoint.checkpointDigest,
    issuedAt: at(minute, 10),
    expiresAt: at(minute + 30, 0),
    signatureAlgorithm: 'Ed25519',
    signature: ''
  }, pair.privateKey, Anchor.witnessSigningPayload));
  const witnessInput = {
    witnessId: 'history-checkpoint-pairwise-witness:' + suffix,
    verifiedAt: at(minute, 20),
    checkpoint: copy(checkpoint),
    witnessPolicy,
    signedAttestations
  };
  const witnessReceipt = Anchor.buildWitness(witnessInput);
  const anchorPolicy = {
    schema: Anchor.ANCHOR_POLICY_SCHEMA,
    policyId: options.anchorPolicyId || authority.anchorPolicyId,
    anchorId: options.anchorId || authority.anchorId,
    anchorEpoch: options.anchorEpoch || authority.anchorEpoch,
    issuedAt: at(minute, 21),
    expiresAt: at(minute + 40, 0),
    status: Anchor.STATUS,
    audience: Anchor.ANCHOR_AUDIENCE,
    scope: Anchor.ANCHOR_SCOPE,
    authorityOrigin: Anchor.POLICY_AUTHORITY_ORIGIN,
    requiredSignatures: 2,
    maxAuthorizationAgeSeconds: 3600,
    keys: authority.anchorPairs.map((pair, index) => ({
      keyId: authority.anchorKeyIds[index],
      algorithm: 'Ed25519',
      publicKeyPem: publicKeyPem(pair),
      stewardDigest: authority.anchorPrincipals[index],
      stewardKind: index === 0 ? 'human' : 'machine',
      scope: Anchor.ANCHOR_SCOPE,
      enabled: true
    })),
    policyDigest: null
  };
  anchorPolicy.policyDigest = Anchor.anchorPolicyDigest(anchorPolicy);
  const expectedAnchorDigest = Anchor.sha256(Anchor.anchorCommitment(witnessReceipt, anchorPolicy));
  const policyAuthorizations = authority.anchorPairs.map((pair, index) => sign({
    schema: Anchor.ANCHOR_AUTHORIZATION_SCHEMA,
    authorizationId: 'history-checkpoint-pairwise-authorization:' + suffix + ':' + (index + 1),
    keyId: anchorPolicy.keys[index].keyId,
    stewardDigest: anchorPolicy.keys[index].stewardDigest,
    stewardKind: anchorPolicy.keys[index].stewardKind,
    verdict: 'AUTHORIZE',
    scope: Anchor.ANCHOR_SCOPE,
    policyDigest: anchorPolicy.policyDigest,
    expectedAnchorDigest,
    checkpointDigest: witnessReceipt.checkpointRef.sha256,
    witnessDigest: witnessReceipt.witnessDigest,
    witnessPolicyDigest: witnessReceipt.witnessPolicyRef.sha256,
    witnessKeyFingerprintSetDigest: witnessReceipt.signatureEvidence.keyFingerprintSetDigest,
    witnessDeclaredPrincipalSetDigest: witnessReceipt.signatureEvidence.declaredPrincipalSetDigest,
    issuedAt: at(minute, 30),
    expiresAt: at(minute + 35, 0),
    signatureAlgorithm: 'Ed25519',
    signature: ''
  }, pair.privateKey, Anchor.anchorAuthorizationPayload));
  const anchoredInput = {
    receiptId: 'history-checkpoint-pairwise-anchored:' + suffix,
    verifiedAt: at(minute, 40),
    expectedAnchorDigest,
    witnessInput,
    witnessReceipt,
    anchorPolicy,
    policyAuthorizations
  };
  return { anchoredInput, anchoredReceipt: Anchor.buildAnchoredCheckpoint(anchoredInput), authority };
}

function transitionInput(previous, candidate, tag, comparedAt) {
  return {
    transitionId: 'history-checkpoint-pairwise-transition:' + slug(tag),
    comparedAt: comparedAt || '2026-08-20T16:30:00.000Z',
    previousAnchoredInput: copy(previous.anchoredInput),
    previousAnchoredReceipt: copy(previous.anchoredReceipt),
    candidateAnchoredInput: copy(candidate.anchoredInput),
    candidateAnchoredReceipt: copy(candidate.anchoredReceipt)
  };
}

module.exports = { copy, at, createAuthority, buildAnchoredPackage, transitionInput };
