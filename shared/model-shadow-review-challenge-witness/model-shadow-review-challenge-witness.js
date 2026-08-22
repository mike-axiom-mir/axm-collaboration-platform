#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const Continuity = require('../model-shadow-review-challenge-continuity/model-shadow-review-challenge-continuity');

const POLICY_SCHEMA = 'axm.model-shadow-review-challenge-witness-policy/v1';
const ATTESTATION_SCHEMA = 'axm.model-shadow-review-challenge-witness-attestation/v1';
const WITNESS_SCHEMA = 'axm.model-shadow-review-challenge-witness/v1';
const AUDIT_SCHEMA = 'axm.model-shadow-review-challenge-witnessed-continuity/v1';
const VERSION = '0.4.0';
const STATUS = 'TEST';
const AUDIENCE = 'MODEL_SHADOW_REVIEW_CHALLENGE_CONTINUITY';
const SCOPE = 'WITNESS_EXACT_MODEL_SHADOW_REVIEW_CHALLENGE_CHECKPOINT';
const AUTHORITY_ORIGIN = 'CALLER_SUPPLIED_UNAUTHENTICATED';
const NEXT_GATE = 'HOST_TRUSTED_WITNESS_POLICY_AND_EXTERNALLY_RETAINED_WITNESS_OR_PROTECTED_MONOTONIC_STORE';
const DIGEST = /^sha256:[a-f0-9]{64}$/;
const BASE64 = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;
const PUBLIC_KEY_PEM = /^-----BEGIN PUBLIC KEY-----\r?\n(?:[A-Za-z0-9+/=]{1,64}\r?\n)+-----END PUBLIC KEY-----(?:\r?\n)?$/;

function stableStringify(value) {
  return Continuity.stableStringify(value);
}

function clone(value) {
  return JSON.parse(stableStringify(value));
}

function sha256(value) {
  return Continuity.sha256(value);
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

function positiveInteger(value, label, minimum, maximum) {
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new Error(label + ' must be an integer from ' + minimum + ' through ' + maximum);
  }
  return value;
}

function reference(value, label) {
  exactKeys(value, ['id', 'schema', 'sha256'], label);
  return {
    id: exactText(value.id, label + '.id', 180),
    schema: exactText(value.schema, label + '.schema', 180),
    sha256: digest(value.sha256, label + '.sha256')
  };
}

function withoutField(value, field) {
  const result = clone(value);
  delete result[field];
  return result;
}

function same(left, right) {
  return stableStringify(left) === stableStringify(right);
}

function policyDigest(policy) {
  return sha256(withoutField(policy, 'policyDigest'));
}

function attestationSigningPayload(attestation) {
  return withoutField(attestation, 'signature');
}

function publicKey(value, label) {
  if (typeof value !== 'string' || !PUBLIC_KEY_PEM.test(value) || value.length > 8192) {
    throw new Error(label + ' must be one SPKI PUBLIC KEY PEM and never private-key material');
  }
  let key;
  try {
    key = crypto.createPublicKey(value);
  } catch (error) {
    throw new Error(label + ' must be one SPKI PUBLIC KEY PEM and never private-key material');
  }
  if (key.asymmetricKeyType !== 'ed25519') throw new Error(label + ' must be an Ed25519 public key');
  return key;
}

function keyFingerprint(key) {
  return 'sha256:' + crypto.createHash('sha256').update(key.export({ type: 'spki', format: 'der' })).digest('hex');
}

function decodeSignature(value, label) {
  const encoded = exactText(value, label, 128);
  if (!BASE64.test(encoded)) throw new Error(label + ' must be canonical base64');
  const bytes = Buffer.from(encoded, 'base64');
  if (bytes.length !== 64 || bytes.toString('base64') !== encoded) {
    throw new Error(label + ' must be one canonical Ed25519 signature');
  }
  return bytes;
}

function expectedCheckpointRef(checkpoint) {
  return { id: checkpoint.checkpointId, schema: checkpoint.schema, sha256: checkpoint.checkpointDigest };
}

function normalizePolicy(policyInput, checkpoint, verifiedAt) {
  const policy = clone(policyInput);
  exactKeys(policy, [
    'schema', 'policyId', 'issuedAt', 'expiresAt', 'audience', 'scope',
    'authorityOrigin', 'checkpointRef', 'ledgerRef', 'entriesDigest',
    'requiredSignatures', 'maxAttestationAgeSeconds', 'keys', 'policyDigest'
  ], 'checkpoint witness key policy');
  if (policy.schema !== POLICY_SCHEMA) throw new Error('checkpoint witness key policy schema mismatch');
  const policyId = exactText(policy.policyId, 'checkpoint witness key policy id', 180);
  const issuedAt = timestamp(policy.issuedAt, 'checkpoint witness key policy issuedAt');
  const expiresAt = timestamp(policy.expiresAt, 'checkpoint witness key policy expiresAt');
  if (Date.parse(issuedAt) < Date.parse(checkpoint.anchoredAt)) {
    throw new Error('checkpoint witness key policy cannot predate the checkpoint');
  }
  if (Date.parse(issuedAt) > Date.parse(verifiedAt)) {
    throw new Error('checkpoint witness key policy cannot be issued after verification');
  }
  if (Date.parse(expiresAt) <= Date.parse(verifiedAt) || Date.parse(expiresAt) <= Date.parse(issuedAt)) {
    throw new Error('checkpoint witness key policy is expired or has an invalid validity window');
  }
  if (policy.audience !== AUDIENCE) throw new Error('checkpoint witness key policy audience mismatch');
  if (policy.scope !== SCOPE) throw new Error('checkpoint witness key policy scope mismatch');
  if (policy.authorityOrigin !== AUTHORITY_ORIGIN) {
    throw new Error('checkpoint witness key policy must admit its caller-supplied unauthenticated origin');
  }
  const checkpointRef = reference(policy.checkpointRef, 'checkpoint witness key policy checkpoint reference');
  const ledgerRef = reference(policy.ledgerRef, 'checkpoint witness key policy ledger reference');
  const entriesDigest = digest(policy.entriesDigest, 'checkpoint witness key policy entries digest');
  if (!same(checkpointRef, expectedCheckpointRef(checkpoint))) throw new Error('checkpoint witness key policy checkpoint reference mismatch');
  if (!same(ledgerRef, checkpoint.ledgerRef)) throw new Error('checkpoint witness key policy ledger reference mismatch');
  if (entriesDigest !== checkpoint.entriesDigest) throw new Error('checkpoint witness key policy entries digest mismatch');
  const requiredSignatures = positiveInteger(policy.requiredSignatures, 'checkpoint witness requiredSignatures', 1, 10);
  const maxAttestationAgeSeconds = positiveInteger(
    policy.maxAttestationAgeSeconds,
    'checkpoint witness maxAttestationAgeSeconds',
    1,
    86400
  );
  if (!Array.isArray(policy.keys) || policy.keys.length < requiredSignatures || policy.keys.length > 10) {
    throw new Error('checkpoint witness key policy keys must cover the signature threshold and contain at most ten entries');
  }

  const keyIds = new Set();
  const actorDigests = new Set();
  const fingerprints = new Set();
  const keys = policy.keys.map((entry, index) => {
    const label = 'checkpoint witness key policy key[' + index + ']';
    exactKeys(entry, ['keyId', 'algorithm', 'publicKeyPem', 'actorDigest', 'actorKind', 'scope', 'enabled'], label);
    const keyId = exactText(entry.keyId, label + '.keyId', 180);
    if (keyIds.has(keyId)) throw new Error('checkpoint witness key policy keyId must be unique');
    keyIds.add(keyId);
    if (entry.algorithm !== 'Ed25519') throw new Error(label + '.algorithm must be Ed25519');
    const actorDigest = digest(entry.actorDigest, label + '.actorDigest');
    if (actorDigests.has(actorDigest)) throw new Error('checkpoint witness key policy actorDigest must be unique');
    actorDigests.add(actorDigest);
    const actorKind = exactText(entry.actorKind, label + '.actorKind', 40);
    if (!['human', 'machine', 'unknown'].includes(actorKind)) throw new Error(label + '.actorKind is unsupported');
    if (entry.scope !== SCOPE) throw new Error(label + '.scope mismatch');
    if (entry.enabled !== true) throw new Error(label + ' must be explicitly enabled');
    const key = publicKey(entry.publicKeyPem, label + '.publicKeyPem');
    const fingerprint = keyFingerprint(key);
    if (fingerprints.has(fingerprint)) throw new Error('checkpoint witness public key fingerprint must be unique');
    fingerprints.add(fingerprint);
    return { keyId, actorDigest, actorKind, key, fingerprint };
  });
  const expectedDigest = policyDigest(policy);
  if (digest(policy.policyDigest, 'checkpoint witness key policy digest') !== expectedDigest) {
    throw new Error('checkpoint witness key policy digest mismatch');
  }
  return {
    policyId,
    issuedAt,
    expiresAt,
    checkpointRef,
    ledgerRef,
    entriesDigest,
    requiredSignatures,
    maxAttestationAgeSeconds,
    keys,
    policyDigest: expectedDigest
  };
}

function verifyAttestation(attestationInput, policy, checkpoint, verifiedAt, index) {
  const attestation = clone(attestationInput);
  const label = 'checkpoint witness attestation[' + index + ']';
  exactKeys(attestation, [
    'schema', 'attestationId', 'keyId', 'actorDigest', 'actorKind', 'verdict',
    'scope', 'policyDigest', 'checkpointDigest', 'ledgerManifestDigest',
    'entriesDigest', 'issuedAt', 'expiresAt', 'signatureAlgorithm', 'signature'
  ], label);
  if (attestation.schema !== ATTESTATION_SCHEMA) throw new Error(label + ' schema mismatch');
  const attestationId = exactText(attestation.attestationId, label + '.attestationId', 180);
  const keyId = exactText(attestation.keyId, label + '.keyId', 180);
  const key = policy.keys.find(entry => entry.keyId === keyId);
  if (!key) throw new Error(label + ' keyId is not enabled by the exact policy');
  if (digest(attestation.actorDigest, label + '.actorDigest') !== key.actorDigest) throw new Error(label + ' actorDigest mismatch');
  if (attestation.actorKind !== key.actorKind) throw new Error(label + ' actorKind mismatch');
  if (attestation.verdict !== 'WITNESS') throw new Error(label + ' verdict must be WITNESS');
  if (attestation.scope !== SCOPE) throw new Error(label + ' scope mismatch');
  if (attestation.policyDigest !== policy.policyDigest) throw new Error(label + ' policy digest mismatch');
  if (attestation.checkpointDigest !== checkpoint.checkpointDigest) throw new Error(label + ' checkpoint digest mismatch');
  if (attestation.ledgerManifestDigest !== checkpoint.ledgerRef.sha256) throw new Error(label + ' ledger manifest digest mismatch');
  if (attestation.entriesDigest !== checkpoint.entriesDigest) throw new Error(label + ' entries digest mismatch');
  const issuedAt = timestamp(attestation.issuedAt, label + '.issuedAt');
  const expiresAt = timestamp(attestation.expiresAt, label + '.expiresAt');
  const issuedMs = Date.parse(issuedAt);
  const expiresMs = Date.parse(expiresAt);
  const verifiedMs = Date.parse(verifiedAt);
  if (issuedMs < Date.parse(checkpoint.anchoredAt) || issuedMs < Date.parse(policy.issuedAt)) {
    throw new Error(label + ' cannot predate its checkpoint or exact key policy');
  }
  if (issuedMs > verifiedMs) throw new Error(label + ' cannot be issued after verification');
  if (expiresMs <= verifiedMs || expiresMs <= issuedMs) throw new Error(label + ' is expired or has an invalid validity window');
  if (expiresMs > Date.parse(policy.expiresAt)) throw new Error(label + ' cannot outlive its exact key policy');
  const maxAgeMs = policy.maxAttestationAgeSeconds * 1000;
  if (verifiedMs - issuedMs > maxAgeMs || expiresMs - issuedMs > maxAgeMs) {
    throw new Error(label + ' exceeds the policy attestation age window');
  }
  if (attestation.signatureAlgorithm !== 'Ed25519') throw new Error(label + '.signatureAlgorithm must be Ed25519');
  const signature = decodeSignature(attestation.signature, label + '.signature');
  const payload = Buffer.from(stableStringify(attestationSigningPayload(attestation)), 'utf8');
  let verified = false;
  try {
    verified = crypto.verify(null, payload, key.key, signature);
  } catch (error) {
    verified = false;
  }
  if (!verified) throw new Error(label + ' signature verification failed');
  return {
    attestationId,
    attestationIdDigest: sha256('checkpoint-witness-attestation-id:' + attestationId),
    attestationDigest: sha256(attestation),
    keyIdDigest: sha256('checkpoint-witness-key-id:' + key.keyId),
    keyFingerprint: key.fingerprint,
    actorDigest: key.actorDigest,
    actorKind: key.actorKind,
    issuedAt,
    expiresAt
  };
}

function witnessTruth() {
  return {
    checkpointVerifiedByExactRebuild: true,
    checkpointSelfDigestValid: true,
    detachedSignaturesCryptographicallyValid: true,
    signingKeyPossessionVerified: true,
    keysAllowedByExactCallerPolicy: true,
    policyAuthorityAuthenticated: false,
    signerRealWorldIdentityProven: false,
    declaredHumanSignerIsAuthenticatedHuman: false,
    actualHumanParticipationProven: false,
    witnessVerificationTimeExternallyTrusted: false,
    checkpointExternalRetentionProven: false,
    checkpointStoredByThisModule: false,
    checkpointOriginAuthenticatedByHost: false,
    checkpointDeletionOrRollbackPrevented: false,
    ledgerDeletionOrRollbackPrevented: false,
    globalSingleUseProven: false,
    hostAuthorizationAuthenticated: false,
    rawActorIdentityEmbedded: false,
    rawPublicKeyEmbedded: false,
    rawSignatureEmbedded: false,
    privateKeyIngested: false,
    rawModelOutputEmbedded: false,
    privateContextEmbedded: false,
    experimentExecuted: false,
    evaluationPerformed: false,
    executionAuthorized: false,
    adoptionAuthorized: false,
    humanBenefitProven: false,
    broadLearningClaimed: false,
    automaticWrite: false,
    automaticPermissionGrant: false,
    automaticPromotion: false,
    automaticMerge: false,
    automaticCanon: false,
    foundationMutation: false
  };
}

function buildWitness(input) {
  exactKeys(input, ['witnessId', 'verifiedAt', 'checkpoint', 'keyPolicy', 'signedAttestations'], 'checkpoint witness input');
  const witnessId = exactText(input.witnessId, 'checkpoint witness id', 180);
  const verifiedAt = timestamp(input.verifiedAt, 'checkpoint witness verifiedAt');
  const checkpoint = Continuity.validateCheckpoint(clone(input.checkpoint));
  if (Date.parse(verifiedAt) < Date.parse(checkpoint.anchoredAt)) {
    throw new Error('checkpoint witness verification cannot predate the checkpoint');
  }
  const policy = normalizePolicy(input.keyPolicy, checkpoint, verifiedAt);
  if (!Array.isArray(input.signedAttestations) ||
      input.signedAttestations.length < policy.requiredSignatures ||
      input.signedAttestations.length > 10) {
    throw new Error('checkpoint witness attestations must cover the policy threshold and contain at most ten entries');
  }
  const attestations = input.signedAttestations.map((entry, index) => (
    verifyAttestation(entry, policy, checkpoint, verifiedAt, index)
  ));
  const ids = new Set();
  const actors = new Set();
  const fingerprints = new Set();
  for (const attestation of attestations) {
    if (ids.has(attestation.attestationId)) throw new Error('checkpoint witness attestationId must be unique');
    if (actors.has(attestation.actorDigest)) throw new Error('checkpoint witness actorDigest must fill at most one seat');
    if (fingerprints.has(attestation.keyFingerprint)) throw new Error('checkpoint witness public key must fill at most one seat');
    ids.add(attestation.attestationId);
    actors.add(attestation.actorDigest);
    fingerprints.add(attestation.keyFingerprint);
  }
  if (attestations.length < policy.requiredSignatures) throw new Error('checkpoint witness signature threshold is not met');
  const retainedAttestations = attestations.map(attestation => {
    const retained = clone(attestation);
    delete retained.attestationId;
    return retained;
  });

  const witness = {
    schema: WITNESS_SCHEMA,
    version: VERSION,
    witnessId,
    verifiedAt,
    status: STATUS,
    checkpointRef: expectedCheckpointRef(checkpoint),
    ledgerRef: clone(checkpoint.ledgerRef),
    entriesDigest: checkpoint.entriesDigest,
    keyPolicyRef: { id: policy.policyId, schema: POLICY_SCHEMA, sha256: policy.policyDigest },
    state: 'CHECKPOINT_SIGNATURES_VERIFIED_AGAINST_CALLER_POLICY_AUTHORITY_NOT_AUTHENTICATED',
    signatureEvidence: {
      algorithm: 'Ed25519',
      requiredSignatures: policy.requiredSignatures,
      verifiedSignatures: attestations.length,
      policyAuthorityOrigin: AUTHORITY_ORIGIN,
      attestations: retainedAttestations.sort((left, right) => left.attestationDigest.localeCompare(right.attestationDigest))
    },
    nextGate: NEXT_GATE,
    truth: witnessTruth(),
    witnessDigest: null
  };
  witness.witnessDigest = sha256(withoutField(witness, 'witnessDigest'));
  return witness;
}

function verifyWitness(input, receipt) {
  const errors = [];
  let rebuilt = null;
  try {
    if (!receipt || receipt.schema !== WITNESS_SCHEMA) throw new Error('checkpoint witness receipt schema mismatch');
    rebuilt = buildWitness(clone(input));
  } catch (error) {
    errors.push(error.message);
  }
  if (rebuilt && stableStringify(rebuilt) !== stableStringify(receipt)) {
    errors.push('checkpoint witness receipt content or digest mismatch');
  }
  return { pass: errors.length === 0, errors, rebuilt };
}

function witnessedAuditTruth(continuityAudit) {
  return {
    checkpointWitnessVerifiedByExactRebuild: true,
    checkpointDetachedSignaturesCryptographicallyValid: true,
    checkpointSigningKeyPossessionVerified: true,
    checkpointKeysAllowedByExactCallerPolicy: true,
    checkpointPolicyAuthorityAuthenticated: false,
    checkpointSignerRealWorldIdentityProven: false,
    actualHumanParticipationProven: false,
    checkpointExternalRetentionProven: false,
    checkpointOriginAuthenticatedByHost: false,
    witnessedAuditTimeExternallyTrusted: false,
    bareContinuityAuditVerifiedByExactRebuild: true,
    comparisonBoundToExactLedgerIdentity: continuityAudit.truth.comparisonBoundToExactLedgerIdentity,
    rollbackOrReplacementDetectedAgainstWitnessedCheckpoint: continuityAudit.truth.rollbackOrReplacementDetectedAgainstPresentedCheckpoint,
    currentAbsenceDetectedAgainstWitnessedCheckpoint: continuityAudit.truth.currentAbsenceDetectedAgainstPresentedCheckpoint,
    currentInvalidityDetected: continuityAudit.truth.currentInvalidityDetected,
    preCheckpointHistoryProven: false,
    checkpointDeletionOrRollbackPrevented: false,
    ledgerDeletionOrRollbackPrevented: false,
    globalSingleUseProven: false,
    hostAuthorizationAuthenticated: false,
    experimentExecuted: false,
    evaluationPerformed: false,
    executionAuthorized: false,
    adoptionAuthorized: false,
    humanBenefitProven: false,
    broadLearningClaimed: false,
    automaticWrite: false,
    automaticPermissionGrant: false,
    automaticPromotion: false,
    automaticMerge: false,
    automaticCanon: false,
    foundationMutation: false
  };
}

function buildWitnessedAudit(input) {
  exactKeys(input, ['auditId', 'checkedAt', 'witnessInput', 'witnessReceipt', 'currentSnapshot'], 'witnessed continuity audit input');
  const auditId = exactText(input.auditId, 'witnessed continuity audit id', 180);
  const checkedAt = timestamp(input.checkedAt, 'witnessed continuity audit checkedAt');
  const witnessCheck = verifyWitness(clone(input.witnessInput), clone(input.witnessReceipt));
  if (!witnessCheck.pass) {
    throw new Error('checkpoint witness is invalid: ' + witnessCheck.errors.join('; '));
  }
  const witness = witnessCheck.rebuilt;
  if (Date.parse(checkedAt) < Date.parse(witness.verifiedAt)) {
    throw new Error('witnessed continuity audit cannot predate witness verification');
  }
  const currentSnapshot = Continuity.validateSnapshot(clone(input.currentSnapshot));
  const continuityAudit = Continuity.buildAudit({
    auditId,
    checkedAt,
    priorCheckpoint: clone(input.witnessInput.checkpoint),
    currentSnapshot
  });
  const audit = {
    schema: AUDIT_SCHEMA,
    version: VERSION,
    auditId,
    checkedAt,
    status: STATUS,
    witnessRef: { id: witness.witnessId, schema: witness.schema, sha256: witness.witnessDigest },
    checkpointRef: clone(witness.checkpointRef),
    keyPolicyRef: clone(witness.keyPolicyRef),
    continuityAuditRef: { id: continuityAudit.auditId, schema: continuityAudit.schema, sha256: continuityAudit.auditDigest },
    currentSnapshot: clone(continuityAudit.currentSnapshot),
    comparison: clone(continuityAudit.comparison),
    decision: clone(continuityAudit.decision),
    state: 'SIGNED_CHECKPOINT_VERIFIED_AGAINST_CALLER_POLICY_AND_COMPARED_AUTHORITY_NOT_AUTHENTICATED',
    nextGate: NEXT_GATE,
    truth: witnessedAuditTruth(continuityAudit),
    auditDigest: null
  };
  audit.auditDigest = sha256(withoutField(audit, 'auditDigest'));
  return audit;
}

function verifyWitnessedAudit(input, receipt) {
  const errors = [];
  let rebuilt = null;
  try {
    if (!receipt || receipt.schema !== AUDIT_SCHEMA) throw new Error('witnessed continuity audit schema mismatch');
    rebuilt = buildWitnessedAudit(clone(input));
  } catch (error) {
    errors.push(error.message);
  }
  if (rebuilt && stableStringify(rebuilt) !== stableStringify(receipt)) {
    errors.push('witnessed continuity audit content or digest mismatch');
  }
  return { pass: errors.length === 0, errors, rebuilt };
}

module.exports = {
  POLICY_SCHEMA,
  ATTESTATION_SCHEMA,
  WITNESS_SCHEMA,
  AUDIT_SCHEMA,
  VERSION,
  STATUS,
  AUDIENCE,
  SCOPE,
  AUTHORITY_ORIGIN,
  NEXT_GATE,
  stableStringify,
  sha256,
  policyDigest,
  attestationSigningPayload,
  buildWitness,
  verifyWitness,
  buildWitnessedAudit,
  verifyWitnessedAudit
};
