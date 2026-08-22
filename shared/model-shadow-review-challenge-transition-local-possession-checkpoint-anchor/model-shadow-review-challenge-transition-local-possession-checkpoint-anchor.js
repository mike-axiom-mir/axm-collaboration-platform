#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const Witness = require('../model-shadow-review-challenge-transition-local-possession-checkpoint-witness/model-shadow-review-challenge-transition-local-possession-checkpoint-witness');

const ANCHOR_POLICY_SCHEMA = 'axm.model-shadow-review-challenge-transition-local-possession-checkpoint-anchor-policy/v1';
const AUTHORIZATION_SCHEMA = 'axm.model-shadow-review-challenge-transition-local-possession-checkpoint-anchor-authorization/v1';
const RECEIPT_SCHEMA = 'axm.model-shadow-review-challenge-transition-local-possession-checkpoint-anchored-witness/v1';
const AUDIT_SCHEMA = 'axm.model-shadow-review-challenge-transition-local-possession-anchored-continuity/v1';
const VERSION = '1.6.0';
const STATUS = 'TEST';
const AUDIENCE = 'MODEL_SHADOW_REVIEW_CHALLENGE_TRANSITION_LOCAL_POSSESSION_CHECKPOINT_WITNESS_AUTHORIZATION';
const SCOPE = 'AUTHORIZE_EXACT_MODEL_SHADOW_REVIEW_CHALLENGE_TRANSITION_LOCAL_POSSESSION_CHECKPOINT_WITNESS';
const AUTHORITY_ORIGIN = 'CALLER_PRESENTED_PIN_UNAUTHENTICATED';
const NEXT_GATE = 'HOST_AUTHENTICATED_ANCHOR_PIN_AND_EXTERNALLY_RETAINED_ANCHORED_RECEIPT_OR_PROTECTED_MONOTONIC_STORE';
const MAX_ANCHOR_KEYS = 10;
const MAX_AUTHORIZATION_AGE_SECONDS = 86400;
const MAX_ARTIFACT_CANONICAL_BYTES = 512 * 1024;
const DIGEST = /^sha256:[a-f0-9]{64}$/;
const BASE64 = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;
const PUBLIC_KEY_PEM = /^-----BEGIN PUBLIC KEY-----\r?\n(?:[A-Za-z0-9+/=]{1,64}\r?\n)+-----END PUBLIC KEY-----(?:\r?\n)?$/;

function stableStringify(value) {
  return Witness.stableStringify(value);
}

function clone(value) {
  return JSON.parse(stableStringify(value));
}

function sha256(value) {
  return Witness.sha256(value);
}

function assertArtifactBound(value, label) {
  const bytes = Buffer.byteLength(stableStringify(value), 'utf8');
  if (bytes > MAX_ARTIFACT_CANONICAL_BYTES) {
    throw new Error(label + ' exceeds the 512 KiB canonical artifact bound');
  }
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
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new Error(label + ' must be a safe integer from ' + minimum + ' through ' + maximum);
  }
  return value;
}

function withoutField(value, field) {
  const result = clone(value);
  delete result[field];
  return result;
}

function anchorPolicyDigest(policy) {
  return sha256(withoutField(policy, 'anchorDigest'));
}

function authorizationSigningPayload(authorization) {
  return withoutField(authorization, 'signature');
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

function normalizeAnchorPolicy(policyInput, verifiedAt) {
  const policy = clone(policyInput);
  exactKeys(policy, [
    'schema', 'anchorId', 'anchorEpoch', 'issuedAt', 'expiresAt', 'status',
    'audience', 'scope', 'authorityOrigin', 'requiredSignatures',
    'maxAuthorizationAgeSeconds', 'keys', 'anchorDigest'
  ], 'local possession checkpoint witness anchor policy');
  if (policy.schema !== ANCHOR_POLICY_SCHEMA) throw new Error('local possession checkpoint witness anchor policy schema mismatch');
  const anchorId = exactText(policy.anchorId, 'local possession checkpoint witness anchor id', 180);
  const anchorEpoch = positiveInteger(policy.anchorEpoch, 'local possession checkpoint witness anchor epoch', 1, Number.MAX_SAFE_INTEGER);
  const issuedAt = timestamp(policy.issuedAt, 'local possession checkpoint witness anchor issuedAt');
  const expiresAt = timestamp(policy.expiresAt, 'local possession checkpoint witness anchor expiresAt');
  if (Date.parse(issuedAt) > Date.parse(verifiedAt)) throw new Error('local possession checkpoint witness anchor cannot be issued after verification');
  if (Date.parse(expiresAt) <= Date.parse(verifiedAt) || Date.parse(expiresAt) <= Date.parse(issuedAt)) {
    throw new Error('local possession checkpoint witness anchor is expired or has an invalid validity window');
  }
  if (policy.status !== STATUS) throw new Error('local possession checkpoint witness anchor status mismatch');
  if (policy.audience !== AUDIENCE) throw new Error('local possession checkpoint witness anchor audience mismatch');
  if (policy.scope !== SCOPE) throw new Error('local possession checkpoint witness anchor scope mismatch');
  if (policy.authorityOrigin !== AUTHORITY_ORIGIN) {
    throw new Error('local possession checkpoint witness anchor must admit its caller-presented unauthenticated origin');
  }
  const requiredSignatures = positiveInteger(policy.requiredSignatures, 'local possession checkpoint witness anchor requiredSignatures', 1, MAX_ANCHOR_KEYS);
  const maxAuthorizationAgeSeconds = positiveInteger(
    policy.maxAuthorizationAgeSeconds,
    'local possession checkpoint witness anchor maxAuthorizationAgeSeconds',
    1,
    MAX_AUTHORIZATION_AGE_SECONDS
  );
  if (!Array.isArray(policy.keys) || policy.keys.length < requiredSignatures || policy.keys.length > MAX_ANCHOR_KEYS) {
    throw new Error('local possession checkpoint witness anchor keys must cover the signature threshold and contain at most ten entries');
  }
  const keyIds = new Set();
  const stewardDigests = new Set();
  const fingerprints = new Set();
  const keys = policy.keys.map((entry, index) => {
    const label = 'local possession checkpoint witness anchor key[' + index + ']';
    exactKeys(entry, ['anchorKeyId', 'algorithm', 'publicKeyPem', 'stewardDigest', 'stewardKind', 'scope', 'enabled'], label);
    const anchorKeyId = exactText(entry.anchorKeyId, label + '.anchorKeyId', 180);
    if (keyIds.has(anchorKeyId)) throw new Error('local possession checkpoint witness anchor key id must be unique');
    keyIds.add(anchorKeyId);
    if (entry.algorithm !== 'Ed25519') throw new Error(label + '.algorithm must be Ed25519');
    const stewardDigest = digest(entry.stewardDigest, label + '.stewardDigest');
    if (stewardDigests.has(stewardDigest)) throw new Error('local possession checkpoint witness anchor stewardDigest must be unique');
    stewardDigests.add(stewardDigest);
    const stewardKind = exactText(entry.stewardKind, label + '.stewardKind', 40);
    if (!['human', 'machine', 'unknown'].includes(stewardKind)) throw new Error(label + '.stewardKind is unsupported');
    if (entry.scope !== SCOPE) throw new Error(label + '.scope mismatch');
    if (entry.enabled !== true) throw new Error(label + ' must be explicitly enabled');
    const key = publicKey(entry.publicKeyPem, label + '.publicKeyPem');
    const fingerprint = keyFingerprint(key);
    if (fingerprints.has(fingerprint)) throw new Error('local possession checkpoint witness anchor public key fingerprint must be unique');
    fingerprints.add(fingerprint);
    return { anchorKeyId, stewardDigest, stewardKind, key, fingerprint };
  });
  const expectedDigest = anchorPolicyDigest(policy);
  if (digest(policy.anchorDigest, 'local possession checkpoint witness anchor digest') !== expectedDigest) {
    throw new Error('local possession checkpoint witness anchor digest mismatch');
  }
  return {
    anchorId,
    anchorEpoch,
    issuedAt,
    expiresAt,
    requiredSignatures,
    maxAuthorizationAgeSeconds,
    keys,
    anchorDigest: expectedDigest
  };
}

function verifyAuthorization(input, anchor, expectedAnchorDigest, witness, verifiedAt, index) {
  const authorization = clone(input);
  const label = 'local possession checkpoint witness anchor authorization[' + index + ']';
  exactKeys(authorization, [
    'schema', 'authorizationId', 'anchorKeyId', 'stewardDigest', 'stewardKind',
    'verdict', 'scope', 'anchorDigest', 'expectedAnchorDigest',
    'witnessPolicyDigest', 'witnessDigest', 'checkpointDigest',
    'sourceSnapshotDigest', 'receiverIdDigest', 'challengerIdDigest',
    'receiverPolicyDigest', 'entriesDigest', 'issuedAt', 'expiresAt',
    'signatureAlgorithm', 'signature'
  ], label);
  if (authorization.schema !== AUTHORIZATION_SCHEMA) throw new Error(label + ' schema mismatch');
  const authorizationId = exactText(authorization.authorizationId, label + '.authorizationId', 180);
  const anchorKeyId = exactText(authorization.anchorKeyId, label + '.anchorKeyId', 180);
  const key = anchor.keys.find(entry => entry.anchorKeyId === anchorKeyId);
  if (!key) throw new Error(label + ' anchorKeyId is not enabled by the exact anchor policy');
  if (authorization.stewardDigest !== key.stewardDigest) throw new Error(label + ' steward digest mismatch');
  if (authorization.stewardKind !== key.stewardKind) throw new Error(label + ' steward kind mismatch');
  if (authorization.verdict !== 'AUTHORIZE') throw new Error(label + ' verdict must be AUTHORIZE');
  if (authorization.scope !== SCOPE) throw new Error(label + ' scope mismatch');
  if (authorization.anchorDigest !== anchor.anchorDigest) throw new Error(label + ' anchor digest mismatch');
  if (authorization.expectedAnchorDigest !== expectedAnchorDigest) throw new Error(label + ' expected anchor digest mismatch');
  if (authorization.witnessPolicyDigest !== witness.keyPolicyRef.sha256) throw new Error(label + ' witness policy digest mismatch');
  if (authorization.witnessDigest !== witness.witnessDigest) throw new Error(label + ' witness digest mismatch');
  if (authorization.checkpointDigest !== witness.checkpointRef.sha256) throw new Error(label + ' checkpoint digest mismatch');
  if (authorization.sourceSnapshotDigest !== witness.sourceSnapshotRef.sha256) throw new Error(label + ' source snapshot digest mismatch');
  if (authorization.receiverIdDigest !== witness.receiverIdDigest) throw new Error(label + ' receiver identity digest mismatch');
  if (authorization.challengerIdDigest !== witness.challengerIdDigest) throw new Error(label + ' challenger identity digest mismatch');
  if (authorization.receiverPolicyDigest !== witness.receiverPolicyRef.sha256) throw new Error(label + ' receiver policy digest mismatch');
  if (authorization.entriesDigest !== witness.entriesDigest) throw new Error(label + ' entries digest mismatch');
  const issuedAt = timestamp(authorization.issuedAt, label + '.issuedAt');
  const expiresAt = timestamp(authorization.expiresAt, label + '.expiresAt');
  const issuedMs = Date.parse(issuedAt);
  const expiresMs = Date.parse(expiresAt);
  const verifiedMs = Date.parse(verifiedAt);
  if (issuedMs > verifiedMs) throw new Error(label + ' cannot be issued after verification');
  if (issuedMs < Date.parse(anchor.issuedAt) || issuedMs < Date.parse(witness.verifiedAt)) {
    throw new Error(label + ' cannot predate its anchor policy or exact witness');
  }
  if (expiresMs <= issuedMs || expiresMs <= verifiedMs) throw new Error(label + ' is expired or has an invalid validity window');
  if (expiresMs > Date.parse(anchor.expiresAt)) throw new Error(label + ' cannot outlive its exact anchor policy');
  if (verifiedMs - issuedMs > anchor.maxAuthorizationAgeSeconds * 1000) {
    throw new Error(label + ' exceeds the anchor authorization age window');
  }
  if (authorization.signatureAlgorithm !== 'Ed25519') throw new Error(label + ' signatureAlgorithm must be Ed25519');
  const signature = decodeSignature(authorization.signature, label + '.signature');
  const payload = Buffer.from(stableStringify(authorizationSigningPayload(authorization)), 'utf8');
  let verified = false;
  try {
    verified = crypto.verify(null, payload, key.key, signature);
  } catch (error) {
    verified = false;
  }
  if (!verified) throw new Error(label + ' signature verification failed');
  return {
    authorizationId,
    authorizationIdDigest: sha256('local-possession-checkpoint-anchor-authorization-id:' + authorizationId),
    authorizationDigest: sha256(authorization),
    anchorKeyIdDigest: sha256('local-possession-checkpoint-anchor-key-id:' + key.anchorKeyId),
    keyFingerprint: key.fingerprint,
    stewardDigest: key.stewardDigest,
    stewardKind: key.stewardKind,
    issuedAt,
    expiresAt
  };
}

function anchoredWitnessTruth() {
  return {
    witnessVerifiedByExactRebuild: true,
    witnessCheckpointSignaturesCryptographicallyValid: true,
    witnessSigningKeyPossessionVerified: true,
    exactAnchorPolicySelfDigestValid: true,
    expectedAnchorDigestMatched: true,
    anchorAuthorizationSignaturesCryptographicallyValid: true,
    anchorSigningKeyPossessionVerified: true,
    anchorKeysAllowedByExactPolicy: true,
    witnessAndPolicyAuthorizedByExactAnchorSignatures: true,
    witnessPolicySubstitutionDetectedRelativeToPresentedAnchor: true,
    witnessPolicyReplacementPrevented: false,
    anchorEpochSelfDeclared: true,
    anchorEpochMonotonicityProven: false,
    anchorPolicyAuthorityAuthenticated: false,
    expectedAnchorDigestAuthorityAuthenticated: false,
    witnessPolicyAuthorityAuthenticated: false,
    anchorOriginAuthenticatedByHost: false,
    anchorStewardRealWorldIdentityProven: false,
    declaredHumanAnchorStewardIsAuthenticatedHuman: false,
    actualHumanParticipationProven: false,
    jointAnchorPinAndWitnessPolicySubstitutionStillPossible: true,
    anchoredWitnessVerificationTimeExternallyTrusted: false,
    anchorExternallyRetained: false,
    anchoredWitnessExternallyRetained: false,
    checkpointExternallyRetained: false,
    anchorStoredByThisModule: false,
    anchoredWitnessStoredByThisModule: false,
    checkpointDeletionOrRollbackPrevented: false,
    currentResponseStateDeletionOrRollbackPrevented: false,
    globalSingleUseProven: false,
    hostAuthorizationAuthenticated: false,
    rawStewardIdentityEmbedded: false,
    rawPublicKeyEmbedded: false,
    rawSignatureEmbedded: false,
    rawConfiguredPartyLabelEmbedded: false,
    stateRootPathEmbedded: false,
    rawCustodyRecordEmbedded: false,
    rawAssessmentReceiptEmbedded: false,
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

function buildAnchoredWitness(input) {
  assertArtifactBound(input, 'local possession checkpoint anchored witness input');
  exactKeys(input, [
    'receiptId', 'verifiedAt', 'expectedAnchorDigest', 'witnessInput',
    'witnessReceipt', 'anchorPolicy', 'policyAuthorizations'
  ], 'local possession checkpoint anchored witness input');
  const receiptId = exactText(input.receiptId, 'local possession checkpoint anchored witness receipt id', 180);
  const verifiedAt = timestamp(input.verifiedAt, 'local possession checkpoint anchored witness verifiedAt');
  const expectedAnchorDigest = digest(input.expectedAnchorDigest, 'expected local possession checkpoint witness anchor digest');
  const witnessCheck = Witness.verifyWitness(clone(input.witnessInput), clone(input.witnessReceipt));
  if (!witnessCheck.pass) throw new Error('local possession checkpoint witness is invalid: ' + witnessCheck.errors.join('; '));
  const witness = witnessCheck.rebuilt;
  if (Date.parse(verifiedAt) < Date.parse(witness.verifiedAt)) {
    throw new Error('local possession checkpoint anchored witness verification cannot predate checkpoint witness verification');
  }
  const anchor = normalizeAnchorPolicy(input.anchorPolicy, verifiedAt);
  if (expectedAnchorDigest !== anchor.anchorDigest) {
    throw new Error('caller-presented expected anchor digest does not match the exact local possession checkpoint anchor policy');
  }
  if (!Array.isArray(input.policyAuthorizations) ||
      input.policyAuthorizations.length < anchor.requiredSignatures ||
      input.policyAuthorizations.length > MAX_ANCHOR_KEYS) {
    throw new Error('local possession checkpoint witness anchor authorizations must cover the anchor threshold and contain at most ten entries');
  }
  const authorizations = input.policyAuthorizations.map((entry, index) => (
    verifyAuthorization(entry, anchor, expectedAnchorDigest, witness, verifiedAt, index)
  ));
  const ids = new Set();
  const stewards = new Set();
  const fingerprints = new Set();
  for (const authorization of authorizations) {
    if (ids.has(authorization.authorizationId)) throw new Error('local possession checkpoint witness anchor authorizationId must be unique');
    if (stewards.has(authorization.stewardDigest)) throw new Error('local possession checkpoint witness anchor stewardDigest must fill at most one seat');
    if (fingerprints.has(authorization.keyFingerprint)) throw new Error('local possession checkpoint witness anchor public key must fill at most one seat');
    ids.add(authorization.authorizationId);
    stewards.add(authorization.stewardDigest);
    fingerprints.add(authorization.keyFingerprint);
  }
  const retainedAuthorizations = authorizations.map(authorization => {
    const retained = clone(authorization);
    delete retained.authorizationId;
    return retained;
  });
  const receipt = {
    schema: RECEIPT_SCHEMA,
    version: VERSION,
    receiptId,
    verifiedAt,
    status: STATUS,
    expectedAnchorDigest,
    anchorRef: { id: anchor.anchorId, schema: ANCHOR_POLICY_SCHEMA, sha256: anchor.anchorDigest },
    anchorEpoch: anchor.anchorEpoch,
    witnessRef: { id: witness.witnessId, schema: witness.schema, sha256: witness.witnessDigest },
    witnessPolicyRef: clone(witness.keyPolicyRef),
    checkpointRef: clone(witness.checkpointRef),
    sourceSnapshotRef: clone(witness.sourceSnapshotRef),
    receiverIdDigest: witness.receiverIdDigest,
    challengerIdDigest: witness.challengerIdDigest,
    receiverPolicyRef: clone(witness.receiverPolicyRef),
    entriesDigest: witness.entriesDigest,
    state: 'LOCAL_POSSESSION_CHECKPOINT_WITNESS_CHAIN_VERIFIED_TO_CALLER_PRESENTED_ANCHOR_PIN_AUTHORITY_NOT_AUTHENTICATED',
    authorizationEvidence: {
      algorithm: 'Ed25519',
      requiredSignatures: anchor.requiredSignatures,
      verifiedSignatures: authorizations.length,
      anchorAuthorityOrigin: AUTHORITY_ORIGIN,
      authorizations: retainedAuthorizations.sort((left, right) => left.authorizationDigest.localeCompare(right.authorizationDigest))
    },
    nextGate: NEXT_GATE,
    truth: anchoredWitnessTruth(),
    receiptDigest: null
  };
  receipt.receiptDigest = sha256(withoutField(receipt, 'receiptDigest'));
  assertArtifactBound(receipt, 'local possession checkpoint anchored witness receipt');
  return receipt;
}

function verifyAnchoredWitness(input, receipt) {
  const errors = [];
  let rebuilt = null;
  try {
    assertArtifactBound(receipt, 'local possession checkpoint anchored witness receipt');
    if (!receipt || receipt.schema !== RECEIPT_SCHEMA) throw new Error('local possession checkpoint anchored witness receipt schema mismatch');
    rebuilt = buildAnchoredWitness(clone(input));
  } catch (error) {
    errors.push(error.message);
  }
  if (rebuilt && stableStringify(rebuilt) !== stableStringify(receipt)) {
    errors.push('local possession checkpoint anchored witness receipt content or digest mismatch');
  }
  return { pass: errors.length === 0, errors, rebuilt };
}

function anchoredAuditTruth(witnessedAudit) {
  return {
    anchoredWitnessVerifiedByExactRebuild: true,
    checkpointWitnessVerifiedByExactRebuild: true,
    anchorAuthorizationSignaturesCryptographicallyValid: true,
    expectedAnchorDigestMatched: true,
    witnessPolicySubstitutionDetectedRelativeToPresentedAnchor: true,
    witnessPolicyReplacementPrevented: false,
    anchorPolicyAuthorityAuthenticated: false,
    expectedAnchorDigestAuthorityAuthenticated: false,
    witnessPolicyAuthorityAuthenticated: false,
    anchorOriginAuthenticatedByHost: false,
    jointAnchorPinAndWitnessPolicySubstitutionStillPossible: true,
    actualHumanParticipationProven: false,
    anchoredAuditTimeExternallyTrusted: false,
    witnessedContinuityAuditVerifiedByExactRebuild: true,
    comparisonBoundToExactConfiguredIdentity: witnessedAudit.truth.comparisonBoundToExactConfiguredIdentity,
    responseFilenameIdentityVerifiedWhenAvailable: witnessedAudit.truth.responseFilenameIdentityVerifiedWhenAvailable,
    rollbackOrReplacementDetectedAgainstAnchoredCheckpoint: witnessedAudit.truth.rollbackOrReplacementDetectedAgainstWitnessedCheckpoint,
    currentAbsenceDetectedAgainstAnchoredCheckpoint: witnessedAudit.truth.currentAbsenceDetectedAgainstWitnessedCheckpoint,
    currentInvalidityDetected: witnessedAudit.truth.currentInvalidityDetected,
    anchorExternallyRetained: false,
    checkpointExternallyRetained: false,
    anchoredWitnessExternallyRetained: false,
    preCheckpointHistoryProven: false,
    checkpointDeletionOrRollbackPrevented: false,
    currentResponseStateDeletionOrRollbackPrevented: false,
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

function buildAnchoredAudit(input) {
  assertArtifactBound(input, 'local possession anchored continuity audit input');
  exactKeys(input, [
    'auditId', 'checkedAt', 'anchoredWitnessInput',
    'anchoredWitnessReceipt', 'currentSnapshot'
  ], 'local possession anchored continuity audit input');
  const auditId = exactText(input.auditId, 'local possession anchored continuity audit id', 180);
  const checkedAt = timestamp(input.checkedAt, 'local possession anchored continuity audit checkedAt');
  const anchoredCheck = verifyAnchoredWitness(clone(input.anchoredWitnessInput), clone(input.anchoredWitnessReceipt));
  if (!anchoredCheck.pass) throw new Error('local possession checkpoint anchored witness is invalid: ' + anchoredCheck.errors.join('; '));
  const anchored = anchoredCheck.rebuilt;
  if (Date.parse(checkedAt) < Date.parse(anchored.verifiedAt)) {
    throw new Error('local possession anchored continuity audit cannot predate anchored witness verification');
  }
  const witnessedAuditInput = {
    auditId,
    checkedAt,
    witnessInput: clone(input.anchoredWitnessInput.witnessInput),
    witnessReceipt: clone(input.anchoredWitnessInput.witnessReceipt),
    currentSnapshot: clone(input.currentSnapshot)
  };
  const witnessedAudit = Witness.buildWitnessedAudit(witnessedAuditInput);
  const audit = {
    schema: AUDIT_SCHEMA,
    version: VERSION,
    auditId,
    checkedAt,
    status: STATUS,
    anchoredWitnessRef: { id: anchored.receiptId, schema: anchored.schema, sha256: anchored.receiptDigest },
    anchorRef: clone(anchored.anchorRef),
    anchorEpoch: anchored.anchorEpoch,
    witnessRef: clone(anchored.witnessRef),
    witnessPolicyRef: clone(anchored.witnessPolicyRef),
    checkpointRef: clone(anchored.checkpointRef),
    sourceSnapshotRef: clone(anchored.sourceSnapshotRef),
    receiverIdDigest: anchored.receiverIdDigest,
    challengerIdDigest: anchored.challengerIdDigest,
    receiverPolicyRef: clone(anchored.receiverPolicyRef),
    witnessedContinuityAuditRef: { id: witnessedAudit.auditId, schema: witnessedAudit.schema, sha256: witnessedAudit.auditDigest },
    currentSnapshot: clone(witnessedAudit.currentSnapshot),
    comparison: clone(witnessedAudit.comparison),
    decision: clone(witnessedAudit.decision),
    state: 'LOCAL_POSSESSION_ANCHORED_WITNESS_CHAIN_VERIFIED_AND_COMPARED_AUTHORITY_NOT_AUTHENTICATED',
    nextGate: NEXT_GATE,
    truth: anchoredAuditTruth(witnessedAudit),
    auditDigest: null
  };
  audit.auditDigest = sha256(withoutField(audit, 'auditDigest'));
  assertArtifactBound(audit, 'local possession anchored continuity audit');
  return audit;
}

function verifyAnchoredAudit(input, receipt) {
  const errors = [];
  let rebuilt = null;
  try {
    assertArtifactBound(receipt, 'local possession anchored continuity audit receipt');
    if (!receipt || receipt.schema !== AUDIT_SCHEMA) throw new Error('local possession anchored continuity audit schema mismatch');
    rebuilt = buildAnchoredAudit(clone(input));
  } catch (error) {
    errors.push(error.message);
  }
  if (rebuilt && stableStringify(rebuilt) !== stableStringify(receipt)) {
    errors.push('local possession anchored continuity audit content or digest mismatch');
  }
  return { pass: errors.length === 0, errors, rebuilt };
}

module.exports = {
  ANCHOR_POLICY_SCHEMA,
  AUTHORIZATION_SCHEMA,
  RECEIPT_SCHEMA,
  AUDIT_SCHEMA,
  VERSION,
  STATUS,
  AUDIENCE,
  SCOPE,
  AUTHORITY_ORIGIN,
  NEXT_GATE,
  MAX_ANCHOR_KEYS,
  MAX_AUTHORIZATION_AGE_SECONDS,
  MAX_ARTIFACT_CANONICAL_BYTES,
  stableStringify,
  sha256,
  anchorPolicyDigest,
  authorizationSigningPayload,
  buildAnchoredWitness,
  verifyAnchoredWitness,
  buildAnchoredAudit,
  verifyAnchoredAudit
};
