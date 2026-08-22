#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const History = require('../model-shadow-retention-audit-review-outcome-history-checkpoint/model-shadow-retention-audit-review-outcome-history-checkpoint');

const WITNESS_POLICY_SCHEMA = 'axm.model-shadow-retention-audit-review-outcome-history-checkpoint-witness-policy/v1';
const WITNESS_ATTESTATION_SCHEMA = 'axm.model-shadow-retention-audit-review-outcome-history-checkpoint-witness-attestation/v1';
const WITNESS_SCHEMA = 'axm.model-shadow-retention-audit-review-outcome-history-checkpoint-witness/v1';
const ANCHOR_POLICY_SCHEMA = 'axm.model-shadow-retention-audit-review-outcome-history-checkpoint-anchor-policy/v1';
const ANCHOR_AUTHORIZATION_SCHEMA = 'axm.model-shadow-retention-audit-review-outcome-history-checkpoint-anchor-authorization/v1';
const ANCHOR_COMMITMENT_SCHEMA = 'axm.model-shadow-retention-audit-review-outcome-history-checkpoint-anchor-commitment/v1';
const ANCHORED_CHECKPOINT_SCHEMA = 'axm.model-shadow-retention-audit-review-outcome-history-checkpoint-anchored/v1';
const ANCHORED_AUDIT_SCHEMA = 'axm.model-shadow-retention-audit-review-outcome-history-checkpoint-anchored-audit/v1';
const SET_SCHEMA = 'axm.model-shadow-retention-audit-review-outcome-history-checkpoint-anchor-set/v1';
const VERSION = '3.4.0';
const STATUS = 'TEST';
const WITNESS_AUDIENCE = 'MODEL_SHADOW_RETENTION_AUDIT_REVIEW_OUTCOME_HISTORY_CHECKPOINT_WITNESS';
const WITNESS_SCOPE = 'WITNESS_EXACT_MODEL_SHADOW_RETENTION_AUDIT_REVIEW_OUTCOME_HISTORY_CHECKPOINT';
const ANCHOR_AUDIENCE = 'MODEL_SHADOW_RETENTION_AUDIT_REVIEW_OUTCOME_HISTORY_CHECKPOINT_ANCHOR';
const ANCHOR_SCOPE = 'AUTHORIZE_EXACT_WITNESSED_MODEL_SHADOW_RETENTION_AUDIT_REVIEW_OUTCOME_HISTORY_CHECKPOINT';
const POLICY_AUTHORITY_ORIGIN = 'CALLER_SUPPLIED_UNAUTHENTICATED';
const EXPECTED_ANCHOR_ORIGIN = 'CALLER_PRESENTED_UNAUTHENTICATED';
const MAX_SEATS = 10;
const MAX_SIGNATURE_AGE_SECONDS = 86400;
const MAX_INPUT_CANONICAL_BYTES = 64 * 1024 * 1024;
const MAX_RECEIPT_CANONICAL_BYTES = 1024 * 1024;
const DIGEST = /^sha256:[a-f0-9]{64}$/;
const BASE64 = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;
const PUBLIC_KEY_PEM = /^-----BEGIN PUBLIC KEY-----\r?\n(?:[A-Za-z0-9+/=]{1,64}\r?\n)+-----END PUBLIC KEY-----(?:\r?\n)?$/;

function stableStringify(value) { return History.stableStringify(value); }
function clone(value) { return JSON.parse(stableStringify(value)); }
function sha256(value) { return History.sha256(value); }
function withoutField(value, field) { const result = clone(value); delete result[field]; return result; }
function same(left, right) { return stableStringify(left) === stableStringify(right); }
function bound(value, maximum, label) {
  let bytes;
  try { bytes = Buffer.byteLength(stableStringify(value), 'utf8'); }
  catch (error) { throw new Error(label + ' must be canonical JSON data'); }
  if (bytes > maximum) throw new Error(label + ' exceeds the bounded canonical byte limit');
}
function exactKeys(value, allowed, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(label + ' must be an object');
  const extras = Object.keys(value).filter(key => !allowed.includes(key));
  const missing = allowed.filter(key => !Object.prototype.hasOwnProperty.call(value, key));
  if (extras.length) throw new Error(label + ' has unknown fields: ' + extras.sort().join(', '));
  if (missing.length) throw new Error(label + ' is missing fields: ' + missing.sort().join(', '));
}
function text(value, label, maximum) {
  if (typeof value !== 'string' || !value || value !== value.trim()) throw new Error(label + ' must be exact non-empty text');
  if (maximum && value.length > maximum) throw new Error(label + ' is too long');
  return value;
}
function digest(value, label) {
  const result = text(value, label, 71);
  if (!DIGEST.test(result)) throw new Error(label + ' must be an exact SHA-256 digest');
  return result;
}
function timestamp(value, label) {
  const result = text(value, label, 64);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(result) || Number.isNaN(Date.parse(result))) {
    throw new Error(label + ' must be an exact UTC timestamp');
  }
  return result;
}
function integer(value, label, minimum, maximum) {
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new Error(label + ' must be a safe integer from ' + minimum + ' through ' + maximum);
  }
  return value;
}
function reference(value, label, requiredSchema) {
  exactKeys(value, ['id', 'schema', 'sha256'], label);
  const result = {
    id: text(value.id, label + '.id', 180),
    schema: text(value.schema, label + '.schema', 180),
    sha256: digest(value.sha256, label + '.sha256')
  };
  if (requiredSchema && result.schema !== requiredSchema) throw new Error(label + ' schema mismatch');
  return result;
}
function checkpointRef(checkpoint) {
  return { id: checkpoint.checkpointId, schema: checkpoint.schema, sha256: checkpoint.checkpointDigest };
}
function setDigest(domain, values) {
  const sorted = values.map(value => digest(value, domain + ' member')).sort();
  return sha256({ schema: SET_SCHEMA, domain, values: sorted });
}
function intersection(left, right) {
  const rightSet = new Set(right);
  return Array.from(new Set(left.filter(value => rightSet.has(value)))).sort();
}
function publicKey(value, label) {
  if (typeof value !== 'string' || value.length > 8192 || !PUBLIC_KEY_PEM.test(value)) {
    throw new Error(label + ' must be one SPKI PUBLIC KEY PEM and never private-key material');
  }
  let key;
  try { key = crypto.createPublicKey(value); }
  catch (error) { throw new Error(label + ' must be one SPKI PUBLIC KEY PEM and never private-key material'); }
  if (key.asymmetricKeyType !== 'ed25519') throw new Error(label + ' must be an Ed25519 public key');
  return key;
}
function keyFingerprint(key) {
  return 'sha256:' + crypto.createHash('sha256').update(key.export({ type: 'spki', format: 'der' })).digest('hex');
}
function signatureBytes(value, label) {
  const encoded = text(value, label, 128);
  if (!BASE64.test(encoded)) throw new Error(label + ' must be canonical base64');
  const result = Buffer.from(encoded, 'base64');
  if (result.length !== 64 || result.toString('base64') !== encoded) throw new Error(label + ' must be one canonical Ed25519 signature');
  return result;
}
function policyDigest(policy) { return sha256(withoutField(policy, 'policyDigest')); }
function witnessPolicyDigest(policy) { return policyDigest(policy); }
function anchorPolicyDigest(policy) { return policyDigest(policy); }
function witnessSigningPayload(attestation) { return stableStringify(withoutField(attestation, 'signature')); }
function anchorAuthorizationPayload(authorization) { return stableStringify(withoutField(authorization, 'signature')); }

function normalizeSeats(entries, settings) {
  const { label, keyIdField, principalField, kindField, scope } = settings;
  if (!Array.isArray(entries) || !entries.length || entries.length > MAX_SEATS) throw new Error(label + ' must contain one through ten keys');
  const keyIds = new Set(); const principals = new Set(); const fingerprints = new Set();
  return entries.map((entry, index) => {
    const itemLabel = label + '[' + index + ']';
    exactKeys(entry, [keyIdField, 'algorithm', 'publicKeyPem', principalField, kindField, 'scope', 'enabled'], itemLabel);
    const keyId = text(entry[keyIdField], itemLabel + '.' + keyIdField, 180);
    if (keyIds.has(keyId)) throw new Error(label + ' key id must be unique');
    keyIds.add(keyId);
    if (entry.algorithm !== 'Ed25519') throw new Error(itemLabel + '.algorithm must be Ed25519');
    const principalDigest = digest(entry[principalField], itemLabel + '.' + principalField);
    if (principals.has(principalDigest)) throw new Error(label + ' declared principal digest must be unique');
    principals.add(principalDigest);
    const kind = text(entry[kindField], itemLabel + '.' + kindField, 40);
    if (!['human', 'machine', 'unknown'].includes(kind)) throw new Error(itemLabel + '.' + kindField + ' is unsupported');
    if (entry.scope !== scope) throw new Error(itemLabel + '.scope mismatch');
    if (entry.enabled !== true) throw new Error(itemLabel + ' must be explicitly enabled');
    const key = publicKey(entry.publicKeyPem, itemLabel + '.publicKeyPem');
    const fingerprint = keyFingerprint(key);
    if (fingerprints.has(fingerprint)) throw new Error(label + ' public key fingerprint must be unique');
    fingerprints.add(fingerprint);
    return { keyId, principalDigest, kind, key, fingerprint };
  });
}

function normalizeWitnessPolicy(input, checkpoint, verifiedAt) {
  const policy = clone(input);
  exactKeys(policy, ['schema', 'policyId', 'issuedAt', 'expiresAt', 'audience', 'scope', 'authorityOrigin', 'checkpointRef', 'requiredSignatures', 'maxAttestationAgeSeconds', 'keys', 'policyDigest'], 'checkpoint witness policy');
  if (policy.schema !== WITNESS_POLICY_SCHEMA) throw new Error('checkpoint witness policy schema mismatch');
  const policyId = text(policy.policyId, 'checkpoint witness policy id', 180);
  const issuedAt = timestamp(policy.issuedAt, 'checkpoint witness policy issuedAt');
  const expiresAt = timestamp(policy.expiresAt, 'checkpoint witness policy expiresAt');
  if (Date.parse(issuedAt) < Date.parse(checkpoint.checkpointedAt) || Date.parse(issuedAt) > Date.parse(verifiedAt)) throw new Error('checkpoint witness policy time does not bracket checkpoint and verification');
  if (Date.parse(expiresAt) <= Date.parse(verifiedAt) || Date.parse(expiresAt) <= Date.parse(issuedAt)) throw new Error('checkpoint witness policy is expired or has an invalid validity window');
  if (policy.audience !== WITNESS_AUDIENCE || policy.scope !== WITNESS_SCOPE) throw new Error('checkpoint witness policy domain mismatch');
  if (policy.authorityOrigin !== POLICY_AUTHORITY_ORIGIN) throw new Error('checkpoint witness policy must admit its unauthenticated caller origin');
  const ref = reference(policy.checkpointRef, 'checkpoint witness policy checkpoint reference', History.CHECKPOINT_SCHEMA);
  if (!same(ref, checkpointRef(checkpoint))) throw new Error('checkpoint witness policy checkpoint reference mismatch');
  const requiredSignatures = integer(policy.requiredSignatures, 'checkpoint witness requiredSignatures', 1, MAX_SEATS);
  const maxAttestationAgeSeconds = integer(policy.maxAttestationAgeSeconds, 'checkpoint witness maxAttestationAgeSeconds', 1, MAX_SIGNATURE_AGE_SECONDS);
  const keys = normalizeSeats(policy.keys, { label: 'checkpoint witness policy keys', keyIdField: 'keyId', principalField: 'actorDigest', kindField: 'actorKind', scope: WITNESS_SCOPE });
  if (keys.length < requiredSignatures) throw new Error('checkpoint witness policy keys do not cover the signature threshold');
  const expected = witnessPolicyDigest(policy);
  if (digest(policy.policyDigest, 'checkpoint witness policy digest') !== expected) throw new Error('checkpoint witness policy digest mismatch');
  return { policyId, issuedAt, expiresAt, requiredSignatures, maxAttestationAgeSeconds, keys, policyDigest: expected };
}

function verifyWitnessAttestation(input, policy, checkpoint, verifiedAt, index) {
  const item = clone(input); const label = 'checkpoint witness attestation[' + index + ']';
  exactKeys(item, ['schema', 'attestationId', 'keyId', 'actorDigest', 'actorKind', 'verdict', 'scope', 'policyDigest', 'checkpointDigest', 'issuedAt', 'expiresAt', 'signatureAlgorithm', 'signature'], label);
  if (item.schema !== WITNESS_ATTESTATION_SCHEMA) throw new Error(label + ' schema mismatch');
  const attestationId = text(item.attestationId, label + '.attestationId', 180);
  const keyId = text(item.keyId, label + '.keyId', 180);
  const seat = policy.keys.find(entry => entry.keyId === keyId);
  if (!seat) throw new Error(label + ' keyId is not enabled by the exact witness policy');
  if (item.actorDigest !== seat.principalDigest || item.actorKind !== seat.kind) throw new Error(label + ' declared principal mismatch');
  if (item.verdict !== 'WITNESS' || item.scope !== WITNESS_SCOPE) throw new Error(label + ' verdict or scope mismatch');
  if (item.policyDigest !== policy.policyDigest || item.checkpointDigest !== checkpoint.checkpointDigest) throw new Error(label + ' signed binding mismatch');
  const issuedAt = timestamp(item.issuedAt, label + '.issuedAt'); const expiresAt = timestamp(item.expiresAt, label + '.expiresAt');
  const issuedMs = Date.parse(issuedAt); const expiresMs = Date.parse(expiresAt); const verifiedMs = Date.parse(verifiedAt);
  if (issuedMs < Date.parse(policy.issuedAt) || issuedMs < Date.parse(checkpoint.checkpointedAt) || issuedMs > verifiedMs) throw new Error(label + ' issuance time is outside the exact policy/checkpoint window');
  if (expiresMs <= issuedMs || expiresMs <= verifiedMs || expiresMs > Date.parse(policy.expiresAt) || verifiedMs - issuedMs > policy.maxAttestationAgeSeconds * 1000 || expiresMs - issuedMs > policy.maxAttestationAgeSeconds * 1000) throw new Error(label + ' is expired or exceeds the witness age window');
  if (item.signatureAlgorithm !== 'Ed25519') throw new Error(label + ' signatureAlgorithm must be Ed25519');
  let verified = false;
  try { verified = crypto.verify(null, Buffer.from(witnessSigningPayload(item), 'utf8'), seat.key, signatureBytes(item.signature, label + '.signature')); }
  catch (error) { verified = false; }
  if (!verified) throw new Error(label + ' signature verification failed');
  return { attestationId, attestationDigest: sha256(item), keyId, fingerprint: seat.fingerprint, principalDigest: seat.principalDigest };
}

function witnessTruth() {
  return {
    checkpointSelfValidated: true,
    witnessPolicyExactRebuilt: true,
    detachedEd25519SignaturesVerified: true,
    signingKeyPossessionRelativeToCallerPolicyVerified: true,
    witnessPolicyAuthorityAuthenticated: false,
    signerRealWorldIdentityAuthenticated: false,
    actualHumanParticipationProven: false,
    checkpointOriginReauthenticated: false,
    checkpointOriginAuthenticated: false,
    hostAuthorizationAuthenticated: false,
    checkpointExternallyRetained: false,
    witnessExternallyRetained: false,
    retentionHoldResolved: false,
    deletionOrRollbackPrevented: false,
    protectedMonotonicStateProven: false,
    timeExternallyTrusted: false,
    rawPublicKeyEmbedded: false,
    rawSignatureEmbedded: false,
    privateKeyIngested: false,
    sourceOrLedgerPathEmbedded: false,
    rawReviewMaterialEmbedded: false,
    rawModelOutputEmbedded: false,
    privateContextEmbedded: false,
    providerInvoked: false,
    experimentExecuted: false,
    evaluationPerformed: false,
    executionAuthorized: false,
    adoptionAuthorized: false,
    humanBenefitProven: false,
    broadLearningClaimed: false,
    autonomousActionCount: 0,
    automaticWrite: false,
    automaticPermissionGrant: false,
    automaticInstall: false,
    automaticPromotion: false,
    automaticMerge: false,
    automaticCanon: false,
    foundationMutation: false
  };
}

function buildWitnessDetailed(input) {
  bound(input, MAX_INPUT_CANONICAL_BYTES, 'checkpoint witness input');
  exactKeys(input, ['witnessId', 'verifiedAt', 'checkpoint', 'witnessPolicy', 'signedAttestations'], 'checkpoint witness input');
  const witnessId = text(input.witnessId, 'checkpoint witness id', 180);
  const verifiedAt = timestamp(input.verifiedAt, 'checkpoint witness verifiedAt');
  const checkpoint = History.validateCheckpoint(clone(input.checkpoint));
  if (Date.parse(verifiedAt) < Date.parse(checkpoint.checkpointedAt)) throw new Error('checkpoint witness verification cannot predate checkpoint');
  const policy = normalizeWitnessPolicy(input.witnessPolicy, checkpoint, verifiedAt);
  if (!Array.isArray(input.signedAttestations) || input.signedAttestations.length < policy.requiredSignatures || input.signedAttestations.length > MAX_SEATS) throw new Error('checkpoint witness attestations must cover the threshold and contain at most ten entries');
  const seats = input.signedAttestations.map((entry, index) => verifyWitnessAttestation(entry, policy, checkpoint, verifiedAt, index));
  const ids = new Set(); const keys = new Set(); const fingerprints = new Set(); const principals = new Set();
  seats.forEach(seat => {
    if (ids.has(seat.attestationId)) throw new Error('checkpoint witness attestationId must be unique');
    if (keys.has(seat.keyId) || fingerprints.has(seat.fingerprint) || principals.has(seat.principalDigest)) throw new Error('checkpoint witness signatures must occupy unique key and declared-principal seats');
    ids.add(seat.attestationId); keys.add(seat.keyId); fingerprints.add(seat.fingerprint); principals.add(seat.principalDigest);
  });
  const fingerprintValues = seats.map(seat => seat.fingerprint); const principalValues = seats.map(seat => seat.principalDigest);
  const receipt = {
    schema: WITNESS_SCHEMA, version: VERSION, status: STATUS, witnessId, verifiedAt,
    checkpointRef: checkpointRef(checkpoint),
    witnessPolicyRef: { id: policy.policyId, schema: WITNESS_POLICY_SCHEMA, sha256: policy.policyDigest },
    state: 'CHECKPOINT_SIGNATURES_VERIFIED_RELATIVE_TO_CALLER_POLICY_AUTHORITY_NOT_AUTHENTICATED',
    signatureEvidence: {
      algorithm: 'Ed25519', requiredSignatures: policy.requiredSignatures, verifiedSignatures: seats.length,
      keyFingerprintSetDigest: setDigest('retention-audit-review-outcome-history-checkpoint-witness-key-fingerprints', fingerprintValues),
      declaredPrincipalSetDigest: setDigest('retention-audit-review-outcome-history-checkpoint-witness-declared-principals', principalValues),
      attestationSetDigest: setDigest('retention-audit-review-outcome-history-checkpoint-witness-attestations', seats.map(seat => seat.attestationDigest)),
      policyAuthorityOrigin: POLICY_AUTHORITY_ORIGIN
    },
    truth: witnessTruth(), witnessDigest: null
  };
  receipt.witnessDigest = sha256(withoutField(receipt, 'witnessDigest'));
  bound(receipt, MAX_RECEIPT_CANONICAL_BYTES, 'checkpoint witness receipt');
  return { receipt, checkpoint, policy, seats, fingerprints: fingerprintValues, principals: principalValues };
}
function buildWitness(input) { return buildWitnessDetailed(input).receipt; }
function verifyWitness(input, receipt) {
  const errors = []; let rebuilt = null;
  try {
    bound(receipt, MAX_RECEIPT_CANONICAL_BYTES, 'checkpoint witness receipt');
    if (!receipt || receipt.schema !== WITNESS_SCHEMA) throw new Error('checkpoint witness receipt schema mismatch');
    rebuilt = buildWitness(input);
    if (!same(rebuilt, receipt)) throw new Error('checkpoint witness receipt content or digest mismatch');
  } catch (error) { errors.push(error.message); }
  return { pass: errors.length === 0, errors, rebuilt };
}

function normalizeAnchorPolicy(input, verifiedAt) {
  const policy = clone(input);
  exactKeys(policy, ['schema', 'policyId', 'anchorId', 'anchorEpoch', 'issuedAt', 'expiresAt', 'status', 'audience', 'scope', 'authorityOrigin', 'requiredSignatures', 'maxAuthorizationAgeSeconds', 'keys', 'policyDigest'], 'checkpoint anchor policy');
  if (policy.schema !== ANCHOR_POLICY_SCHEMA) throw new Error('checkpoint anchor policy schema mismatch');
  const policyId = text(policy.policyId, 'checkpoint anchor policy id', 180);
  const anchorId = text(policy.anchorId, 'checkpoint anchor id', 180);
  const anchorEpoch = integer(policy.anchorEpoch, 'checkpoint anchor epoch', 1, Number.MAX_SAFE_INTEGER);
  const issuedAt = timestamp(policy.issuedAt, 'checkpoint anchor policy issuedAt'); const expiresAt = timestamp(policy.expiresAt, 'checkpoint anchor policy expiresAt');
  if (Date.parse(issuedAt) > Date.parse(verifiedAt) || Date.parse(expiresAt) <= Date.parse(verifiedAt) || Date.parse(expiresAt) <= Date.parse(issuedAt)) throw new Error('checkpoint anchor policy is expired or has an invalid validity window');
  if (policy.status !== STATUS || policy.audience !== ANCHOR_AUDIENCE || policy.scope !== ANCHOR_SCOPE) throw new Error('checkpoint anchor policy domain mismatch');
  if (policy.authorityOrigin !== POLICY_AUTHORITY_ORIGIN) throw new Error('checkpoint anchor policy must admit its unauthenticated caller origin');
  const requiredSignatures = integer(policy.requiredSignatures, 'checkpoint anchor requiredSignatures', 1, MAX_SEATS);
  const maxAuthorizationAgeSeconds = integer(policy.maxAuthorizationAgeSeconds, 'checkpoint anchor maxAuthorizationAgeSeconds', 1, MAX_SIGNATURE_AGE_SECONDS);
  const keys = normalizeSeats(policy.keys, { label: 'checkpoint anchor policy keys', keyIdField: 'keyId', principalField: 'stewardDigest', kindField: 'stewardKind', scope: ANCHOR_SCOPE });
  if (keys.length < requiredSignatures) throw new Error('checkpoint anchor policy keys do not cover the signature threshold');
  const expected = anchorPolicyDigest(policy);
  if (digest(policy.policyDigest, 'checkpoint anchor policy digest') !== expected) throw new Error('checkpoint anchor policy digest mismatch');
  return { policyId, anchorId, anchorEpoch, issuedAt, expiresAt, requiredSignatures, maxAuthorizationAgeSeconds, keys, policyDigest: expected };
}

function anchorCommitment(witness, policy) {
  return {
    schema: ANCHOR_COMMITMENT_SCHEMA,
    anchorId: policy.anchorId,
    anchorEpoch: policy.anchorEpoch,
    checkpointRef: clone(witness.checkpointRef),
    witnessRef: { id: witness.witnessId, schema: witness.schema, sha256: witness.witnessDigest },
    witnessPolicyRef: clone(witness.witnessPolicyRef),
    witnessVerifiedSignatures: witness.signatureEvidence.verifiedSignatures,
    witnessKeyFingerprintSetDigest: witness.signatureEvidence.keyFingerprintSetDigest,
    witnessDeclaredPrincipalSetDigest: witness.signatureEvidence.declaredPrincipalSetDigest,
    anchorPolicyRef: { id: policy.policyId, schema: ANCHOR_POLICY_SCHEMA, sha256: policy.policyDigest }
  };
}
function anchorDigest(witnessReceipt, anchorPolicy) {
  const policy = normalizeAnchorPolicy(anchorPolicy, anchorPolicy.issuedAt);
  return sha256(anchorCommitment(witnessReceipt, policy));
}

function verifyAnchorAuthorization(input, policy, commitment, expectedAnchorDigest, witnessVerifiedAt, verifiedAt, index) {
  const item = clone(input); const label = 'checkpoint anchor authorization[' + index + ']';
  exactKeys(item, ['schema', 'authorizationId', 'keyId', 'stewardDigest', 'stewardKind', 'verdict', 'scope', 'policyDigest', 'expectedAnchorDigest', 'checkpointDigest', 'witnessDigest', 'witnessPolicyDigest', 'witnessKeyFingerprintSetDigest', 'witnessDeclaredPrincipalSetDigest', 'issuedAt', 'expiresAt', 'signatureAlgorithm', 'signature'], label);
  if (item.schema !== ANCHOR_AUTHORIZATION_SCHEMA) throw new Error(label + ' schema mismatch');
  const authorizationId = text(item.authorizationId, label + '.authorizationId', 180);
  const keyId = text(item.keyId, label + '.keyId', 180);
  const seat = policy.keys.find(entry => entry.keyId === keyId);
  if (!seat) throw new Error(label + ' keyId is not enabled by the exact anchor policy');
  if (item.stewardDigest !== seat.principalDigest || item.stewardKind !== seat.kind) throw new Error(label + ' declared principal mismatch');
  if (item.verdict !== 'AUTHORIZE' || item.scope !== ANCHOR_SCOPE) throw new Error(label + ' verdict or scope mismatch');
  const bindings = {
    policyDigest: policy.policyDigest, expectedAnchorDigest,
    checkpointDigest: commitment.checkpointRef.sha256, witnessDigest: commitment.witnessRef.sha256,
    witnessPolicyDigest: commitment.witnessPolicyRef.sha256,
    witnessKeyFingerprintSetDigest: commitment.witnessKeyFingerprintSetDigest,
    witnessDeclaredPrincipalSetDigest: commitment.witnessDeclaredPrincipalSetDigest
  };
  Object.keys(bindings).forEach(key => { if (item[key] !== bindings[key]) throw new Error(label + ' ' + key + ' binding mismatch'); });
  const issuedAt = timestamp(item.issuedAt, label + '.issuedAt'); const expiresAt = timestamp(item.expiresAt, label + '.expiresAt');
  const issuedMs = Date.parse(issuedAt); const expiresMs = Date.parse(expiresAt); const verifiedMs = Date.parse(verifiedAt);
  if (issuedMs < Date.parse(policy.issuedAt) || issuedMs < Date.parse(witnessVerifiedAt) || issuedMs > verifiedMs || expiresMs <= issuedMs || expiresMs <= verifiedMs || expiresMs > Date.parse(policy.expiresAt) || verifiedMs - issuedMs > policy.maxAuthorizationAgeSeconds * 1000 || expiresMs - issuedMs > policy.maxAuthorizationAgeSeconds * 1000) throw new Error(label + ' is expired or exceeds the anchor authorization age window');
  if (item.signatureAlgorithm !== 'Ed25519') throw new Error(label + ' signatureAlgorithm must be Ed25519');
  let verified = false;
  try { verified = crypto.verify(null, Buffer.from(anchorAuthorizationPayload(item), 'utf8'), seat.key, signatureBytes(item.signature, label + '.signature')); }
  catch (error) { verified = false; }
  if (!verified) throw new Error(label + ' signature verification failed');
  return { authorizationId, authorizationDigest: sha256(item), keyId, fingerprint: seat.fingerprint, principalDigest: seat.principalDigest };
}

function anchoredTruth() {
  return {
    witnessReceiptVerifiedByExactRebuild: true,
    checkpointSelfValidated: true,
    expectedAnchorDigestMatched: true,
    anchorPolicyExactRebuilt: true,
    detachedEd25519AnchorSignaturesVerified: true,
    signingKeyPossessionRelativeToCallerPoliciesVerified: true,
    noSharedVerifiedPublicKeyFingerprintObserved: true,
    noSharedVerifiedDeclaredPrincipalDigestObserved: true,
    realWorldControllerIndependenceProven: false,
    sameControllerWithDistinctKeysAndDigestsStillPossible: true,
    crossLayerCollusionExcluded: false,
    witnessPolicyAuthorityAuthenticated: false,
    anchorPolicyAuthorityAuthenticated: false,
    expectedAnchorDigestAuthorityAuthenticated: false,
    anchorEpochMonotonicProven: false,
    jointCheckpointPoliciesSignaturesAndExpectedAnchorReplacementStillPossible: true,
    originalCheckpointContinuityProven: false,
    checkpointOriginAuthenticated: false,
    hostAuthorizationAuthenticated: false,
    checkpointExternallyRetained: false,
    anchoredReceiptExternallyRetained: false,
    retentionHoldResolved: false,
    deletionOrRollbackPrevented: false,
    protectedMonotonicStateProven: false,
    globalConsistencyProven: false,
    actorRealWorldIdentityAuthenticated: false,
    actualHumanParticipationProven: false,
    timeExternallyTrusted: false,
    rawPublicKeyEmbedded: false,
    rawSignatureEmbedded: false,
    privateKeyIngested: false,
    sourceOrLedgerPathEmbedded: false,
    rawReviewMaterialEmbedded: false,
    rawModelOutputEmbedded: false,
    privateContextEmbedded: false,
    providerInvoked: false,
    experimentExecuted: false,
    evaluationPerformed: false,
    executionAuthorized: false,
    adoptionAuthorized: false,
    humanBenefitProven: false,
    broadLearningClaimed: false,
    autonomousActionCount: 0,
    automaticWrite: false,
    automaticPermissionGrant: false,
    automaticInstall: false,
    automaticPromotion: false,
    automaticMerge: false,
    automaticCanon: false,
    foundationMutation: false
  };
}

function buildAnchoredCheckpoint(input) {
  bound(input, MAX_INPUT_CANONICAL_BYTES, 'anchored checkpoint input');
  exactKeys(input, ['receiptId', 'verifiedAt', 'expectedAnchorDigest', 'witnessInput', 'witnessReceipt', 'anchorPolicy', 'policyAuthorizations'], 'anchored checkpoint input');
  const receiptId = text(input.receiptId, 'anchored checkpoint receipt id', 180);
  const verifiedAt = timestamp(input.verifiedAt, 'anchored checkpoint verifiedAt');
  const expected = digest(input.expectedAnchorDigest, 'expected checkpoint anchor digest');
  const witnessDetailed = buildWitnessDetailed(input.witnessInput);
  if (!same(witnessDetailed.receipt, input.witnessReceipt)) throw new Error('checkpoint witness does not exact-rebuild from the caller package');
  if (Date.parse(verifiedAt) < Date.parse(witnessDetailed.receipt.verifiedAt)) throw new Error('anchored checkpoint verification cannot predate witness verification');
  const policy = normalizeAnchorPolicy(input.anchorPolicy, verifiedAt);
  if (Date.parse(policy.issuedAt) < Date.parse(witnessDetailed.receipt.verifiedAt)) throw new Error('checkpoint anchor policy cannot predate exact witness verification');
  const commitment = anchorCommitment(witnessDetailed.receipt, policy);
  if (sha256(commitment) !== expected) throw new Error('caller-presented expected anchor digest does not match the exact anchor commitment');
  if (!Array.isArray(input.policyAuthorizations) || input.policyAuthorizations.length < policy.requiredSignatures || input.policyAuthorizations.length > MAX_SEATS) throw new Error('checkpoint anchor authorizations must cover the threshold and contain at most ten entries');
  const seats = input.policyAuthorizations.map((entry, index) => verifyAnchorAuthorization(entry, policy, commitment, expected, witnessDetailed.receipt.verifiedAt, verifiedAt, index));
  const ids = new Set(); const keys = new Set(); const fingerprints = new Set(); const principals = new Set();
  seats.forEach(seat => {
    if (ids.has(seat.authorizationId)) throw new Error('checkpoint anchor authorizationId must be unique');
    if (keys.has(seat.keyId) || fingerprints.has(seat.fingerprint) || principals.has(seat.principalDigest)) throw new Error('checkpoint anchor authorizations must occupy unique key and declared-principal seats');
    ids.add(seat.authorizationId); keys.add(seat.keyId); fingerprints.add(seat.fingerprint); principals.add(seat.principalDigest);
  });
  const anchorFingerprints = seats.map(seat => seat.fingerprint); const anchorPrincipals = seats.map(seat => seat.principalDigest);
  if (intersection(witnessDetailed.fingerprints, anchorFingerprints).length) throw new Error('witness and anchor layers must not share a verified public key fingerprint');
  if (intersection(witnessDetailed.principals, anchorPrincipals).length) throw new Error('witness and anchor layers must not share a verified declared principal digest');
  const receipt = {
    schema: ANCHORED_CHECKPOINT_SCHEMA, version: VERSION, status: STATUS, receiptId, verifiedAt,
    checkpointRef: clone(commitment.checkpointRef), witnessRef: clone(commitment.witnessRef),
    witnessPolicyRef: clone(commitment.witnessPolicyRef), anchorPolicyRef: clone(commitment.anchorPolicyRef),
    anchorRef: { id: policy.anchorId, schema: ANCHOR_COMMITMENT_SCHEMA, sha256: expected },
    state: 'TWO_LAYER_SIGNATURES_AND_OBSERVABLE_NONOVERLAP_VERIFIED_CALLER_AUTHORITIES_NOT_AUTHENTICATED',
    separationEvidence: {
      witnessVerifiedSeats: witnessDetailed.seats.length, anchorVerifiedSeats: seats.length,
      witnessKeyFingerprintSetDigest: setDigest('retention-audit-review-outcome-history-checkpoint-witness-key-fingerprints', witnessDetailed.fingerprints),
      anchorKeyFingerprintSetDigest: setDigest('retention-audit-review-outcome-history-checkpoint-anchor-key-fingerprints', anchorFingerprints),
      witnessDeclaredPrincipalSetDigest: setDigest('retention-audit-review-outcome-history-checkpoint-witness-declared-principals', witnessDetailed.principals),
      anchorDeclaredPrincipalSetDigest: setDigest('retention-audit-review-outcome-history-checkpoint-anchor-declared-principals', anchorPrincipals),
      anchorAuthorizationSetDigest: setDigest('retention-audit-review-outcome-history-checkpoint-anchor-authorizations', seats.map(seat => seat.authorizationDigest)),
      sharedKeyFingerprintCount: 0, sharedDeclaredPrincipalDigestCount: 0,
      expectedAnchorOrigin: EXPECTED_ANCHOR_ORIGIN
    },
    truth: anchoredTruth(), receiptDigest: null
  };
  receipt.receiptDigest = sha256(withoutField(receipt, 'receiptDigest'));
  bound(receipt, MAX_RECEIPT_CANONICAL_BYTES, 'anchored checkpoint receipt');
  return receipt;
}
function verifyAnchoredCheckpoint(input, receipt) {
  const errors = []; let rebuilt = null;
  try {
    bound(receipt, MAX_RECEIPT_CANONICAL_BYTES, 'anchored checkpoint receipt');
    if (!receipt || receipt.schema !== ANCHORED_CHECKPOINT_SCHEMA) throw new Error('anchored checkpoint receipt schema mismatch');
    rebuilt = buildAnchoredCheckpoint(input);
    if (!same(rebuilt, receipt)) throw new Error('anchored checkpoint receipt content or digest mismatch');
  } catch (error) { errors.push(error.message); }
  return { pass: errors.length === 0, errors, rebuilt };
}

function anchoredAuditTruth(upstream) {
  return Object.assign(anchoredTruth(), {
    anchoredCheckpointVerifiedByExactRebuild: true,
    upstreamV33AuditComposedUnchanged: true,
    classificationRelativeToPresentedAnchoredCheckpointOnly: true,
    currentLedgerValidatedByV32Reload: upstream.truth.currentLedgerValidatedByV32Reload,
    completeCurrentRecordChainLoadedInOneV32Read: upstream.truth.completeCurrentRecordChainLoadedInOneV32Read,
    retainedCheckpointRelativeRewriteDetected: upstream.truth.retainedCheckpointRelativeRewriteDetected,
    retentionHoldUnresolved: upstream.decision.retentionHoldUnresolved,
    autonomousActionCount: 0
  });
}
function buildAnchoredAudit(input) {
  bound(input, MAX_INPUT_CANONICAL_BYTES, 'anchored audit input');
  exactKeys(input, ['auditId', 'auditedAt', 'anchoredInput', 'anchoredReceipt', 'currentServiceOptions'], 'anchored audit input');
  const auditId = text(input.auditId, 'anchored audit id', 180);
  const auditedAt = timestamp(input.auditedAt, 'anchored audit time');
  const anchored = buildAnchoredCheckpoint(input.anchoredInput);
  if (!same(anchored, input.anchoredReceipt)) throw new Error('anchored checkpoint does not exact-rebuild from the caller package');
  if (Date.parse(auditedAt) < Date.parse(anchored.verifiedAt)) throw new Error('anchored audit cannot predate anchored checkpoint verification');
  const upstream = History.auditCheckpoint({
    auditId: auditId + ':v3.3', auditedAt,
    checkpoint: clone(input.anchoredInput.witnessInput.checkpoint),
    currentServiceOptions: clone(input.currentServiceOptions)
  });
  const receipt = {
    schema: ANCHORED_AUDIT_SCHEMA, version: VERSION, status: STATUS, auditId, auditedAt,
    anchoredCheckpointRef: { id: anchored.receiptId, schema: anchored.schema, sha256: anchored.receiptDigest },
    checkpointRef: clone(anchored.checkpointRef),
    upstreamAuditRef: { id: upstream.auditId, schema: upstream.schema, sha256: upstream.auditDigest },
    classification: upstream.classification,
    current: clone(upstream.current), comparison: clone(upstream.comparison), decision: clone(upstream.decision),
    state: 'ANCHORED_CHECKPOINT_EXACT_REBUILT_AND_COMPARED_READ_ONLY_AUTHORITY_RETENTION_AND_HOLD_RESOLUTION_NOT_PROVEN',
    truth: anchoredAuditTruth(upstream), auditDigest: null
  };
  receipt.auditDigest = sha256(withoutField(receipt, 'auditDigest'));
  bound(receipt, MAX_RECEIPT_CANONICAL_BYTES, 'anchored audit receipt');
  return receipt;
}
function verifyAnchoredAudit(input, receipt) {
  const errors = []; let rebuilt = null;
  try {
    bound(receipt, MAX_RECEIPT_CANONICAL_BYTES, 'anchored audit receipt');
    if (!receipt || receipt.schema !== ANCHORED_AUDIT_SCHEMA) throw new Error('anchored audit receipt schema mismatch');
    rebuilt = buildAnchoredAudit(input);
    if (!same(rebuilt, receipt)) throw new Error('anchored audit receipt content or digest mismatch');
  } catch (error) { errors.push(error.message); }
  return { pass: errors.length === 0, errors, rebuilt };
}

module.exports = {
  WITNESS_POLICY_SCHEMA, WITNESS_ATTESTATION_SCHEMA, WITNESS_SCHEMA,
  ANCHOR_POLICY_SCHEMA, ANCHOR_AUTHORIZATION_SCHEMA, ANCHOR_COMMITMENT_SCHEMA,
  ANCHORED_CHECKPOINT_SCHEMA, ANCHORED_AUDIT_SCHEMA,
  VERSION, STATUS, WITNESS_AUDIENCE, WITNESS_SCOPE, ANCHOR_AUDIENCE, ANCHOR_SCOPE,
  POLICY_AUTHORITY_ORIGIN, EXPECTED_ANCHOR_ORIGIN, MAX_SEATS, MAX_SIGNATURE_AGE_SECONDS,
  MAX_INPUT_CANONICAL_BYTES, MAX_RECEIPT_CANONICAL_BYTES,
  stableStringify, sha256, witnessPolicyDigest, witnessSigningPayload,
  anchorPolicyDigest, anchorCommitment, anchorDigest, anchorAuthorizationPayload,
  buildWitness, verifyWitness, buildAnchoredCheckpoint, verifyAnchoredCheckpoint,
  buildAnchoredAudit, verifyAnchoredAudit
};
