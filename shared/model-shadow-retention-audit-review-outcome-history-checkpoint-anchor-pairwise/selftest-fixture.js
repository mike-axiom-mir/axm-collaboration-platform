'use strict';

const crypto = require('crypto');
const Anchor = require('../model-shadow-retention-audit-review-outcome-history-checkpoint-anchor/model-shadow-retention-audit-review-outcome-history-checkpoint-anchor');

function copy(value) { return JSON.parse(JSON.stringify(value)); }
function slug(value) { return String(value || 'base').replace(/[^a-z0-9-]/gi, '-').toLowerCase(); }
function add(timestamp, milliseconds) { return new Date(Date.parse(timestamp) + milliseconds).toISOString(); }
function publicKeyPem(pair) { return pair.publicKey.export({ type: 'spki', format: 'pem' }).toString(); }
function principal(label) { return Anchor.sha256('synthetic-v3.5-principal:' + label); }
function sign(value, privateKey, payloadBuilder) {
  const result = copy(value);
  result.signature = crypto.sign(null, Buffer.from(payloadBuilder(result), 'utf8'), privateKey).toString('base64');
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
    witnessPolicyId: options.witnessPolicyId || 'v35-witness-policy:' + suffix,
    anchorPolicyId: options.anchorPolicyId || 'v35-anchor-policy:' + suffix,
    anchorId: options.anchorId || 'v35-anchor:' + suffix,
    witnessKeyIds: options.witnessKeyIds || witnessPairs.map((unused, index) => 'v35-witness-key:' + suffix + ':' + (index + 1)),
    anchorKeyIds: options.anchorKeyIds || anchorPairs.map((unused, index) => 'v35-anchor-key:' + suffix + ':' + (index + 1)),
    witnessPrincipals: options.witnessPrincipals || witnessPairs.map((unused, index) => principal(suffix + ':witness:' + (index + 1))),
    anchorPrincipals: options.anchorPrincipals || anchorPairs.map((unused, index) => principal(suffix + ':anchor:' + (index + 1)))
  };
}

function buildPackage(checkpoint, tag, authority, settings) {
  const options = settings || {};
  const suffix = slug(tag);
  const source = authority || createAuthority(suffix);
  const witnessPolicy = {
    schema: Anchor.WITNESS_POLICY_SCHEMA,
    policyId: options.witnessPolicyId || source.witnessPolicyId,
    issuedAt: add(checkpoint.checkpointedAt, 1000),
    expiresAt: add(checkpoint.checkpointedAt, 900000),
    audience: Anchor.WITNESS_AUDIENCE,
    scope: Anchor.WITNESS_SCOPE,
    authorityOrigin: Anchor.POLICY_AUTHORITY_ORIGIN,
    checkpointRef: { id: checkpoint.checkpointId, schema: checkpoint.schema, sha256: checkpoint.checkpointDigest },
    requiredSignatures: options.witnessRequiredSignatures || 2,
    maxAttestationAgeSeconds: options.maxAttestationAgeSeconds || 1200,
    keys: source.witnessPairs.map((pair, index) => ({
      keyId: source.witnessKeyIds[index],
      algorithm: 'Ed25519',
      publicKeyPem: publicKeyPem(pair),
      actorDigest: source.witnessPrincipals[index],
      actorKind: index === 0 ? 'human' : 'machine',
      scope: Anchor.WITNESS_SCOPE,
      enabled: true
    })),
    policyDigest: null
  };
  witnessPolicy.policyDigest = Anchor.witnessPolicyDigest(witnessPolicy);
  const signedAttestations = source.witnessPairs.map((pair, index) => sign({
    schema: Anchor.WITNESS_ATTESTATION_SCHEMA,
    attestationId: 'v35-attestation:' + suffix + ':' + (index + 1),
    keyId: witnessPolicy.keys[index].keyId,
    actorDigest: witnessPolicy.keys[index].actorDigest,
    actorKind: witnessPolicy.keys[index].actorKind,
    verdict: 'WITNESS',
    scope: Anchor.WITNESS_SCOPE,
    policyDigest: witnessPolicy.policyDigest,
    checkpointDigest: checkpoint.checkpointDigest,
    issuedAt: add(checkpoint.checkpointedAt, 2000 + index * 1000),
    expiresAt: add(checkpoint.checkpointedAt, 600000),
    signatureAlgorithm: 'Ed25519',
    signature: null
  }, pair.privateKey, Anchor.witnessSigningPayload));
  const witnessInput = {
    witnessId: 'v35-witness:' + suffix,
    verifiedAt: add(checkpoint.checkpointedAt, 4000),
    checkpoint: copy(checkpoint),
    witnessPolicy,
    signedAttestations
  };
  const witnessReceipt = Anchor.buildWitness(witnessInput);
  const anchorPolicy = {
    schema: Anchor.ANCHOR_POLICY_SCHEMA,
    policyId: options.anchorPolicyId || source.anchorPolicyId,
    anchorId: options.anchorId || source.anchorId,
    anchorEpoch: options.anchorEpoch || 1,
    issuedAt: add(checkpoint.checkpointedAt, 5000),
    expiresAt: add(checkpoint.checkpointedAt, 900000),
    status: Anchor.STATUS,
    audience: Anchor.ANCHOR_AUDIENCE,
    scope: Anchor.ANCHOR_SCOPE,
    authorityOrigin: Anchor.POLICY_AUTHORITY_ORIGIN,
    requiredSignatures: options.anchorRequiredSignatures || 2,
    maxAuthorizationAgeSeconds: options.maxAuthorizationAgeSeconds || 1200,
    keys: source.anchorPairs.map((pair, index) => ({
      keyId: source.anchorKeyIds[index],
      algorithm: 'Ed25519',
      publicKeyPem: publicKeyPem(pair),
      stewardDigest: source.anchorPrincipals[index],
      stewardKind: index === 0 ? 'human' : 'machine',
      scope: Anchor.ANCHOR_SCOPE,
      enabled: true
    })),
    policyDigest: null
  };
  anchorPolicy.policyDigest = Anchor.anchorPolicyDigest(anchorPolicy);
  const expectedAnchorDigest = Anchor.anchorDigest(witnessReceipt, anchorPolicy);
  const policyAuthorizations = source.anchorPairs.map((pair, index) => sign({
    schema: Anchor.ANCHOR_AUTHORIZATION_SCHEMA,
    authorizationId: 'v35-authorization:' + suffix + ':' + (index + 1),
    keyId: anchorPolicy.keys[index].keyId,
    stewardDigest: anchorPolicy.keys[index].stewardDigest,
    stewardKind: anchorPolicy.keys[index].stewardKind,
    verdict: 'AUTHORIZE',
    scope: Anchor.ANCHOR_SCOPE,
    policyDigest: anchorPolicy.policyDigest,
    expectedAnchorDigest,
    checkpointDigest: checkpoint.checkpointDigest,
    witnessDigest: witnessReceipt.witnessDigest,
    witnessPolicyDigest: witnessPolicy.policyDigest,
    witnessKeyFingerprintSetDigest: witnessReceipt.signatureEvidence.keyFingerprintSetDigest,
    witnessDeclaredPrincipalSetDigest: witnessReceipt.signatureEvidence.declaredPrincipalSetDigest,
    issuedAt: add(checkpoint.checkpointedAt, 6000 + index * 1000),
    expiresAt: add(checkpoint.checkpointedAt, 600000),
    signatureAlgorithm: 'Ed25519',
    signature: null
  }, pair.privateKey, Anchor.anchorAuthorizationPayload));
  const anchoredInput = {
    receiptId: 'v35-anchored:' + suffix,
    verifiedAt: add(checkpoint.checkpointedAt, 8000),
    expectedAnchorDigest,
    witnessInput,
    witnessReceipt,
    anchorPolicy,
    policyAuthorizations
  };
  return {
    authority: source,
    anchoredInput,
    anchoredReceipt: Anchor.buildAnchoredCheckpoint(anchoredInput)
  };
}

function transitionInput(previous, candidate, tag, comparedAt) {
  const laterVerification = Date.parse(previous.anchoredReceipt.verifiedAt) > Date.parse(candidate.anchoredReceipt.verifiedAt)
    ? previous.anchoredReceipt.verifiedAt : candidate.anchoredReceipt.verifiedAt;
  return {
    transitionId: 'v35-transition:' + slug(tag),
    comparedAt: comparedAt || add(laterVerification, 1000),
    previousAnchoredInput: copy(previous.anchoredInput),
    previousAnchoredReceipt: copy(previous.anchoredReceipt),
    candidateAnchoredInput: copy(candidate.anchoredInput),
    candidateAnchoredReceipt: copy(candidate.anchoredReceipt)
  };
}

module.exports = { copy, add, principal, createAuthority, buildPackage, transitionInput };
