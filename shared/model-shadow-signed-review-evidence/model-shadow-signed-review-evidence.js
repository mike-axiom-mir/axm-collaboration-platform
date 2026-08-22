#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const ChallengerGate = require('../model-shadow-challenger-gate/model-shadow-challenger-gate');
const DeterministicJson = require('../../tools/deterministic-json-core');

const POLICY_SCHEMA = 'axm.model-shadow-review-key-policy/v1';
const ATTESTATION_SCHEMA = 'axm.model-shadow-signed-review-attestation/v1';
const RECEIPT_SCHEMA = 'axm.model-shadow-signed-review-receipt/v1';
const VERSION = '0.1.0';
const STATUS = 'TEST';
const AUDIENCE = 'MODEL_SHADOW_CHALLENGER_REVIEW';
const SCOPE = 'REVIEW_EXACT_MODEL_SHADOW_CHALLENGER_PLAN';
const AUTHORITY_ORIGIN = 'CALLER_SUPPLIED_UNAUTHENTICATED';
const DIGEST = /^sha256:[a-f0-9]{64}$/;
const BASE64 = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;
const PUBLIC_KEY_PEM = /^-----BEGIN PUBLIC KEY-----\r?\n(?:[A-Za-z0-9+/=]{1,64}\r?\n)+-----END PUBLIC KEY-----(?:\r?\n)?$/;

function stableStringify(value) {
  return DeterministicJson.canonicalJson(value);
}

function clone(value) {
  return JSON.parse(stableStringify(value));
}

function sha256(value) {
  const bytes = typeof value === 'string' ? value : stableStringify(value);
  return 'sha256:' + crypto.createHash('sha256').update(bytes).digest('hex');
}

function exactKeys(value, allowed, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(label + ' must be an object');
  const extras = Object.keys(value).filter(key => !allowed.includes(key));
  const missing = allowed.filter(key => !Object.prototype.hasOwnProperty.call(value, key));
  if (extras.length) throw new Error(label + ' has unknown fields: ' + extras.sort().join(', '));
  if (missing.length) throw new Error(label + ' is missing fields: ' + missing.sort().join(', '));
}

function exactText(value, label, maximum) {
  if (typeof value !== 'string' || !value || value !== value.trim()) throw new Error(label + ' must be exact non-empty text');
  if (maximum && value.length > maximum) throw new Error(label + ' is too long');
  return value;
}

function digest(value, label) {
  const result = exactText(value, label, 71);
  if (!DIGEST.test(result)) throw new Error(label + ' must be an exact SHA-256 digest');
  return result;
}

function timestamp(value, label) {
  const result = exactText(value, label, 64);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?Z$/.test(result) || Number.isNaN(Date.parse(result))) {
    throw new Error(label + ' must be an exact UTC timestamp');
  }
  return result;
}

function reference(value, label) {
  exactKeys(value, ['id', 'schema', 'sha256'], label);
  return {
    id: exactText(value.id, label + '.id', 180),
    schema: exactText(value.schema, label + '.schema', 180),
    sha256: digest(value.sha256, label + '.sha256')
  };
}

function expectedHandoffRef(handoff) {
  return { id: handoff.handoffId, schema: handoff.schema, sha256: handoff.handoffDigest };
}

function expectedPlanRef(handoff) {
  return { id: handoff.plan.planId, schema: handoff.plan.schema, sha256: handoff.plan.planDigest };
}

function withoutField(value, field) {
  const result = clone(value);
  delete result[field];
  return result;
}

function keyPolicyDigest(policy) {
  return sha256(withoutField(policy, 'policyDigest'));
}

function attestationSigningPayload(attestation) {
  return withoutField(attestation, 'signature');
}

function same(left, right) {
  return stableStringify(left) === stableStringify(right);
}

function positiveInteger(value, label, minimum, maximum) {
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new Error(label + ' must be an integer from ' + minimum + ' through ' + maximum);
  }
  return value;
}

function createPublicKey(pem, label) {
  if (typeof pem !== 'string' || !PUBLIC_KEY_PEM.test(pem) || pem.length > 8192) {
    throw new Error(label + ' must be one SPKI PUBLIC KEY PEM and never private-key material');
  }
  let key;
  try {
    key = crypto.createPublicKey(pem);
  } catch (error) {
    throw new Error(label + ' must be one SPKI PUBLIC KEY PEM and never private-key material');
  }
  if (key.asymmetricKeyType !== 'ed25519') throw new Error(label + ' must be an Ed25519 public key');
  return key;
}

function publicKeyFingerprint(key) {
  const der = key.export({ type: 'spki', format: 'der' });
  return 'sha256:' + crypto.createHash('sha256').update(der).digest('hex');
}

function normalizePolicy(policyInput, handoff, verifiedAt) {
  const policy = clone(policyInput);
  exactKeys(policy, [
    'schema', 'policyId', 'issuedAt', 'expiresAt', 'audience', 'scope',
    'authorityOrigin', 'reviewedHandoffRef', 'planRef', 'challengeRef',
    'requiredSignatures', 'requiredDeclaredHumanSignatures',
    'maxAttestationAgeSeconds', 'keys', 'policyDigest'
  ], 'review key policy');
  if (policy.schema !== POLICY_SCHEMA) throw new Error('review key policy schema mismatch');
  const policyId = exactText(policy.policyId, 'review key policy id', 180);
  const issuedAt = timestamp(policy.issuedAt, 'review key policy issuedAt');
  const expiresAt = timestamp(policy.expiresAt, 'review key policy expiresAt');
  if (Date.parse(issuedAt) < Date.parse(handoff.generatedAt)) throw new Error('review key policy cannot predate the reviewed handoff');
  if (Date.parse(issuedAt) > Date.parse(verifiedAt)) throw new Error('review key policy cannot be issued after verification');
  if (Date.parse(expiresAt) <= Date.parse(verifiedAt)) throw new Error('review key policy is expired at verification time');
  if (policy.audience !== AUDIENCE) throw new Error('review key policy audience mismatch');
  if (policy.scope !== SCOPE) throw new Error('review key policy scope mismatch');
  if (policy.authorityOrigin !== AUTHORITY_ORIGIN) throw new Error('review key policy must admit its caller-supplied unauthenticated origin');
  const handoffRef = reference(policy.reviewedHandoffRef, 'review key policy handoff reference');
  const planRef = reference(policy.planRef, 'review key policy plan reference');
  const challengeRef = reference(policy.challengeRef, 'review key policy challenge reference');
  if (!same(handoffRef, expectedHandoffRef(handoff))) throw new Error('review key policy handoff reference mismatch');
  if (!same(planRef, expectedPlanRef(handoff))) throw new Error('review key policy plan reference mismatch');
  const requiredSignatures = positiveInteger(policy.requiredSignatures, 'review key policy requiredSignatures', 1, 10);
  const requiredDeclaredHumanSignatures = positiveInteger(
    policy.requiredDeclaredHumanSignatures,
    'review key policy requiredDeclaredHumanSignatures',
    1,
    requiredSignatures
  );
  const maxAttestationAgeSeconds = positiveInteger(
    policy.maxAttestationAgeSeconds,
    'review key policy maxAttestationAgeSeconds',
    1,
    86400
  );
  if (!Array.isArray(policy.keys) || policy.keys.length < requiredSignatures || policy.keys.length > 10) {
    throw new Error('review key policy keys must cover the required signatures and contain at most ten entries');
  }

  const keyIds = new Set();
  const actorDigests = new Set();
  const fingerprints = new Set();
  const keys = policy.keys.map((entry, index) => {
    const label = 'review key policy key[' + index + ']';
    exactKeys(entry, ['keyId', 'algorithm', 'publicKeyPem', 'actorDigest', 'actorKind', 'scope', 'enabled'], label);
    const keyId = exactText(entry.keyId, label + '.keyId', 180);
    if (keyIds.has(keyId)) throw new Error('review key policy keyId must be unique');
    keyIds.add(keyId);
    if (entry.algorithm !== 'Ed25519') throw new Error(label + '.algorithm must be Ed25519');
    const actorDigest = digest(entry.actorDigest, label + '.actorDigest');
    if (actorDigests.has(actorDigest)) throw new Error('review key policy actorDigest must be unique');
    actorDigests.add(actorDigest);
    const actorKind = exactText(entry.actorKind, label + '.actorKind', 40);
    if (!['human', 'machine', 'unknown'].includes(actorKind)) throw new Error(label + '.actorKind is unsupported');
    if (entry.scope !== SCOPE) throw new Error(label + '.scope mismatch');
    if (entry.enabled !== true) throw new Error(label + ' must be explicitly enabled');
    const publicKey = createPublicKey(entry.publicKeyPem, label + '.publicKeyPem');
    const fingerprint = publicKeyFingerprint(publicKey);
    if (fingerprints.has(fingerprint)) throw new Error('review key policy public key fingerprint must be unique');
    fingerprints.add(fingerprint);
    return { keyId, actorDigest, actorKind, publicKey, fingerprint };
  });
  const declaredHumanKeys = keys.filter(key => key.actorKind === 'human').length;
  if (declaredHumanKeys < requiredDeclaredHumanSignatures) {
    throw new Error('review key policy lacks enough keys declared as human');
  }
  const expectedDigest = keyPolicyDigest(policy);
  if (digest(policy.policyDigest, 'review key policy digest') !== expectedDigest) throw new Error('review key policy digest mismatch');
  return {
    policyId,
    issuedAt,
    expiresAt,
    handoffRef,
    planRef,
    challengeRef,
    requiredSignatures,
    requiredDeclaredHumanSignatures,
    maxAttestationAgeSeconds,
    keys,
    policyDigest: expectedDigest
  };
}

function decodeSignature(value) {
  const signature = exactText(value, 'signed review attestation signature', 128);
  if (!BASE64.test(signature)) throw new Error('signed review attestation signature must be canonical base64');
  const bytes = Buffer.from(signature, 'base64');
  if (bytes.length !== 64 || bytes.toString('base64') !== signature) {
    throw new Error('signed review attestation signature must be one canonical Ed25519 signature');
  }
  return bytes;
}

function verifyAttestation(attestationInput, policy, handoff, verifiedAt, index) {
  const attestation = clone(attestationInput);
  const label = 'signed review attestation[' + index + ']';
  exactKeys(attestation, [
    'schema', 'attestationId', 'keyId', 'actorDigest', 'actorKind', 'verdict',
    'scope', 'policyDigest', 'challengeDigest', 'reviewedHandoffDigest',
    'proposalDigest', 'planDigest', 'reviewEvidenceDigest', 'reviewItemId',
    'reviewApprovalAt', 'issuedAt', 'expiresAt', 'signatureAlgorithm', 'signature'
  ], label);
  if (attestation.schema !== ATTESTATION_SCHEMA) throw new Error(label + ' schema mismatch');
  const attestationId = exactText(attestation.attestationId, label + '.attestationId', 180);
  const keyId = exactText(attestation.keyId, label + '.keyId', 180);
  const key = policy.keys.find(entry => entry.keyId === keyId);
  if (!key) throw new Error(label + ' keyId is not enabled by the exact policy');
  if (digest(attestation.actorDigest, label + '.actorDigest') !== key.actorDigest) throw new Error(label + ' actorDigest mismatch');
  if (attestation.actorKind !== key.actorKind) throw new Error(label + ' actorKind mismatch');
  if (attestation.verdict !== 'APPROVE') throw new Error(label + ' verdict must be APPROVE');
  if (attestation.scope !== SCOPE) throw new Error(label + ' scope mismatch');
  if (attestation.policyDigest !== policy.policyDigest) throw new Error(label + ' policy digest mismatch');
  if (attestation.challengeDigest !== policy.challengeRef.sha256) throw new Error(label + ' challenge digest mismatch');
  if (attestation.reviewedHandoffDigest !== handoff.handoffDigest) throw new Error(label + ' reviewed handoff digest mismatch');
  if (attestation.proposalDigest !== handoff.proposalRef.sha256) throw new Error(label + ' proposal digest mismatch');
  if (attestation.planDigest !== handoff.plan.planDigest) throw new Error(label + ' plan digest mismatch');
  if (attestation.reviewEvidenceDigest !== handoff.reviewEvidenceRef.sha256) throw new Error(label + ' review evidence digest mismatch');
  if (attestation.reviewItemId !== handoff.reviewEvidence.reviewItemId) throw new Error(label + ' review item id mismatch');
  const reviewApprovalAt = timestamp(attestation.reviewApprovalAt, label + '.reviewApprovalAt');
  const approval = handoff.reviewEvidence.approvals.find(entry => (
    entry.actorDigest === key.actorDigest && entry.actorKind === key.actorKind && entry.at === reviewApprovalAt
  ));
  if (!approval) throw new Error(label + ' does not bind an approval retained in the exact reviewed handoff');
  const issuedAt = timestamp(attestation.issuedAt, label + '.issuedAt');
  const expiresAt = timestamp(attestation.expiresAt, label + '.expiresAt');
  const issuedMs = Date.parse(issuedAt);
  const expiresMs = Date.parse(expiresAt);
  const verifiedMs = Date.parse(verifiedAt);
  if (issuedMs < Date.parse(reviewApprovalAt)) throw new Error(label + ' cannot predate its retained review approval');
  if (issuedMs < Date.parse(policy.issuedAt)) throw new Error(label + ' cannot predate its exact key policy');
  if (issuedMs > verifiedMs) throw new Error(label + ' cannot be issued after verification');
  if (expiresMs <= verifiedMs || expiresMs <= issuedMs) throw new Error(label + ' is expired or has an invalid validity window');
  if (expiresMs > Date.parse(policy.expiresAt)) throw new Error(label + ' cannot outlive its exact key policy');
  const maxAgeMs = policy.maxAttestationAgeSeconds * 1000;
  if (verifiedMs - issuedMs > maxAgeMs || expiresMs - issuedMs > maxAgeMs) {
    throw new Error(label + ' exceeds the policy attestation age window');
  }
  if (attestation.signatureAlgorithm !== 'Ed25519') throw new Error(label + ' signatureAlgorithm must be Ed25519');
  const signature = decodeSignature(attestation.signature);
  const payload = Buffer.from(stableStringify(attestationSigningPayload(attestation)), 'utf8');
  let verified = false;
  try {
    verified = crypto.verify(null, payload, key.publicKey, signature);
  } catch (error) {
    verified = false;
  }
  if (!verified) throw new Error(label + ' signature verification failed');
  return {
    attestationId,
    attestationDigest: sha256(attestation),
    keyIdDigest: sha256('review-key-id:' + key.keyId),
    keyFingerprint: key.fingerprint,
    actorDigest: key.actorDigest,
    actorKind: key.actorKind,
    reviewApprovalAt,
    issuedAt,
    expiresAt
  };
}

function buildReceipt(input) {
  exactKeys(input, [
    'receiptId', 'verifiedAt', 'reviewedHandoffInput', 'reviewedHandoff',
    'keyPolicy', 'signedAttestations'
  ], 'signed review receipt input');
  const receiptId = exactText(input.receiptId, 'signed review receipt id', 180);
  const verifiedAt = timestamp(input.verifiedAt, 'signed review receipt verifiedAt');
  const handoffCheck = ChallengerGate.verifyReviewedHandoff(
    clone(input.reviewedHandoffInput),
    clone(input.reviewedHandoff)
  );
  if (!handoffCheck.pass) throw new Error('reviewed challenger handoff is invalid: ' + handoffCheck.errors.join('; '));
  const handoff = handoffCheck.rebuilt;
  if (handoff.truth.executionAuthorized !== false || handoff.truth.actualHumanParticipationProven !== false) {
    throw new Error('reviewed challenger handoff authority boundary mismatch');
  }
  if (Date.parse(verifiedAt) < Date.parse(handoff.generatedAt)) {
    throw new Error('signed review verification cannot predate the reviewed handoff');
  }
  const policy = normalizePolicy(input.keyPolicy, handoff, verifiedAt);
  if (!Array.isArray(input.signedAttestations) || input.signedAttestations.length < policy.requiredSignatures || input.signedAttestations.length > 10) {
    throw new Error('signed review attestations must cover the policy requirement and contain at most ten entries');
  }
  const attestations = input.signedAttestations.map((entry, index) => verifyAttestation(entry, policy, handoff, verifiedAt, index));
  const attestationIds = new Set();
  const actorDigests = new Set();
  const keyFingerprints = new Set();
  for (const attestation of attestations) {
    if (attestationIds.has(attestation.attestationId)) throw new Error('signed review attestationId must be unique');
    if (actorDigests.has(attestation.actorDigest)) throw new Error('signed review actorDigest must fill at most one seat');
    if (keyFingerprints.has(attestation.keyFingerprint)) throw new Error('signed review public key must fill at most one seat');
    attestationIds.add(attestation.attestationId);
    actorDigests.add(attestation.actorDigest);
    keyFingerprints.add(attestation.keyFingerprint);
  }
  if (attestations.length < policy.requiredSignatures) throw new Error('signed review signature threshold is not met');
  const declaredHumanSignatures = attestations.filter(entry => entry.actorKind === 'human').length;
  if (declaredHumanSignatures < policy.requiredDeclaredHumanSignatures) {
    throw new Error('signed review declared-human signature threshold is not met');
  }
  const receipt = {
    schema: RECEIPT_SCHEMA,
    version: VERSION,
    receiptId,
    verifiedAt,
    status: STATUS,
    reviewedHandoffRef: expectedHandoffRef(handoff),
    proposalRef: clone(handoff.proposalRef),
    planRef: expectedPlanRef(handoff),
    reviewEvidenceRef: clone(handoff.reviewEvidenceRef),
    keyPolicyRef: { id: policy.policyId, schema: POLICY_SCHEMA, sha256: policy.policyDigest },
    challengeRef: clone(policy.challengeRef),
    state: 'DETACHED_SIGNATURES_VERIFIED_AGAINST_CALLER_KEY_POLICY_EXECUTION_NOT_AUTHORIZED',
    signatureEvidence: {
      algorithm: 'Ed25519',
      requiredSignatures: policy.requiredSignatures,
      verifiedSignatures: attestations.length,
      requiredDeclaredHumanSignatures: policy.requiredDeclaredHumanSignatures,
      verifiedDeclaredHumanSignatures: declaredHumanSignatures,
      policyAuthorityOrigin: AUTHORITY_ORIGIN,
      attestations: attestations.sort((left, right) => left.attestationDigest.localeCompare(right.attestationDigest))
    },
    nextGate: 'HOST_TRUST_ANCHOR_AND_SINGLE_USE_CHALLENGE_LEDGER_THEN_SEPARATE_EXECUTION_DECISION',
    truth: {
      reviewedHandoffVerifiedByExactRebuild: true,
      exactProposalPlanAndReviewEvidenceBound: true,
      detachedSignaturesCryptographicallyValid: true,
      signingKeyPossessionVerified: true,
      keysAllowedByExactCallerPolicy: true,
      callerPolicyAuthorityAuthenticated: false,
      actorRealWorldIdentityProven: false,
      declaredHumanKeyIsAuthenticatedHuman: false,
      actualHumanParticipationProven: false,
      challengeSingleUseProven: false,
      verificationTimeExternallyTrusted: false,
      rawActorIdentityEmbedded: false,
      reviewDiscussionIngested: false,
      voteNotesIngested: false,
      privateKeyIngested: false,
      rawModelOutputEmbedded: false,
      privateContextEmbedded: false,
      experimentExecuted: false,
      evaluationPerformed: false,
      executionAuthorized: false,
      adoptionAuthorized: false,
      humanBenefitProven: false,
      sharedGrowthClaimed: false,
      broadLearningClaimed: false,
      automaticExecution: false,
      automaticWrite: false,
      automaticInstall: false,
      automaticPermissionGrant: false,
      automaticPromotion: false,
      automaticMerge: false,
      automaticCanon: false,
      foundationMutation: false
    },
    receiptDigest: null
  };
  const payload = clone(receipt);
  delete payload.receiptDigest;
  receipt.receiptDigest = sha256(payload);
  return receipt;
}

function verifyReceipt(input, receipt) {
  const errors = [];
  let rebuilt = null;
  try {
    if (!receipt || receipt.schema !== RECEIPT_SCHEMA) throw new Error('signed review receipt schema mismatch');
    rebuilt = buildReceipt(input);
  } catch (error) {
    errors.push(error.message);
  }
  if (rebuilt && stableStringify(rebuilt) !== stableStringify(receipt)) {
    errors.push('signed review receipt content or digest mismatch');
  }
  return { pass: errors.length === 0, errors, rebuilt };
}

module.exports = {
  POLICY_SCHEMA,
  ATTESTATION_SCHEMA,
  RECEIPT_SCHEMA,
  VERSION,
  STATUS,
  AUDIENCE,
  SCOPE,
  AUTHORITY_ORIGIN,
  stableStringify,
  sha256,
  keyPolicyDigest,
  attestationSigningPayload,
  buildReceipt,
  verifyReceipt
};
