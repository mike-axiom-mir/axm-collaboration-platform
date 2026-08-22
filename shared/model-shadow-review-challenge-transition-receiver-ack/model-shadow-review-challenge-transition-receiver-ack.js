#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const DeclaredDisclosure = require('../model-shadow-review-challenge-transition-declared-disclosure/model-shadow-review-challenge-transition-declared-disclosure');

const POLICY_SCHEMA = 'axm.model-shadow-review-challenge-transition-receiver-policy/v1';
const ACKNOWLEDGEMENT_SCHEMA = 'axm.model-shadow-review-challenge-transition-receiver-acknowledgement/v1';
const RECEIPT_SCHEMA = 'axm.model-shadow-review-challenge-transition-receiver-acknowledgement-witness/v1';
const VERSION = '1.1.0';
const STATUS = 'TEST';
const AUDIENCE = 'MODEL_SHADOW_REVIEW_CHALLENGE_TRANSITION_DECLARED_DISCLOSURE';
const SCOPE = 'ACKNOWLEDGE_EXACT_DECLARED_DISCLOSURE_ASSESSMENT_REFERENCE_PRESENTED_BY_CALLER';
const RETENTION_CLAIM = 'NO_DURABLE_RETENTION_CLAIM';
const AUTHORITY_ORIGIN = 'CALLER_SUPPLIED_UNAUTHENTICATED';
const NEXT_GATE = 'INDEPENDENTLY_OPERATED_RECEIVER_TRANSPORT_AND_DURABLE_RETENTION_RECEIPTS_OR_PROTECTED_MONOTONIC_STORE';
const DIGEST = /^sha256:[a-f0-9]{64}$/;
const BASE64 = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;
const PUBLIC_KEY_PEM = /^-----BEGIN PUBLIC KEY-----\r?\n(?:[A-Za-z0-9+/=]{1,64}\r?\n)+-----END PUBLIC KEY-----(?:\r?\n)?$/;
const MAX_RECEIVERS = 10;
const MIN_REQUIRED_ACKNOWLEDGEMENTS = 2;
const MAX_POLICY_CANONICAL_BYTES = 256 * 1024;
const MAX_WITNESS_CANONICAL_BYTES = 48 * 1024 * 1024;

function stableStringify(value) {
  return DeclaredDisclosure.stableStringify(value);
}

function copy(value) {
  return JSON.parse(stableStringify(value));
}

function sha256(value) {
  return DeclaredDisclosure.sha256(value);
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

function timestamp(value, label) {
  const result = exactText(value, label, 64);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?Z$/.test(result) || Number.isNaN(Date.parse(result))) {
    throw new Error(label + ' must be an exact UTC timestamp');
  }
  return result;
}

function digest(value, label) {
  const result = exactText(value, label, 71);
  if (!DIGEST.test(result)) throw new Error(label + ' must be an exact SHA-256 digest');
  return result;
}

function integer(value, label, minimum, maximum) {
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new Error(label + ' must be an integer from ' + minimum + ' to ' + maximum);
  }
  return value;
}

function reference(value, label, requiredSchema) {
  exactKeys(value, ['id', 'schema', 'sha256'], label);
  const result = {
    id: exactText(value.id, label + '.id', 180),
    schema: exactText(value.schema, label + '.schema', 180),
    sha256: digest(value.sha256, label + '.sha256')
  };
  if (requiredSchema && result.schema !== requiredSchema) throw new Error(label + ' schema mismatch');
  return result;
}

function sameReference(left, right) {
  return left.id === right.id && left.schema === right.schema && left.sha256 === right.sha256;
}

function compareText(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function withoutField(value, field) {
  const result = copy(value);
  delete result[field];
  return result;
}

function publicKey(value, label) {
  if (typeof value !== 'string' || !value) throw new Error(label + ' must be non-empty text');
  if (value.length > 4096) throw new Error(label + ' is too long');
  const pem = value;
  if (!PUBLIC_KEY_PEM.test(pem)) throw new Error(label + ' must be canonical public-key PEM');
  let key;
  try {
    key = crypto.createPublicKey(pem);
  } catch (error) {
    throw new Error(label + ' is not a valid public key');
  }
  if (key.asymmetricKeyType !== 'ed25519') throw new Error(label + ' must be Ed25519');
  const canonicalPem = key.export({ type: 'spki', format: 'pem' }).toString();
  if (canonicalPem !== pem) throw new Error(label + ' must use canonical Ed25519 SPKI PEM');
  return { pem, key };
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

function assessmentRef(assessment) {
  return { id: assessment.assessmentId, schema: assessment.schema, sha256: assessment.receiptDigest };
}

function policyInputFromPolicy(policy) {
  const value = copy(policy);
  delete value.schema;
  delete value.version;
  delete value.status;
  delete value.truth;
  delete value.policyDigest;
  return value;
}

function policyTruth() {
  return {
    callerSuppliedReceiverPolicy: true,
    distinctReceiverLabelsVerified: true,
    distinctReceiverKeysVerified: true,
    receiverPolicyAuthorityAuthenticated: false,
    receiverIdentitiesAuthenticated: false,
    realWorldReceiverIndependenceProven: false,
    externallyRetained: false,
    protectedMonotonicStateProven: false,
    issuedAndExpiryTimesExternallyTrusted: false,
    executionAuthorized: false,
    adoptionAuthorized: false,
    automaticWrite: false,
    automaticPromotion: false,
    automaticCanon: false
  };
}

function buildPolicy(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('receiver acknowledgement policy input must be an object');
  if (Buffer.byteLength(stableStringify(input), 'utf8') > MAX_POLICY_CANONICAL_BYTES) {
    throw new Error('receiver acknowledgement policy exceeds the bounded canonical byte limit');
  }
  exactKeys(input, [
    'policyId', 'assessmentRef', 'issuedAt', 'expiresAt',
    'requiredAcknowledgements', 'receivers'
  ], 'receiver acknowledgement policy input');
  if (!Array.isArray(input.receivers)) throw new Error('receiver acknowledgement policy receivers must be an array');
  if (input.receivers.length < MIN_REQUIRED_ACKNOWLEDGEMENTS) {
    throw new Error('receiver acknowledgement policy requires at least two receiver entries');
  }
  if (input.receivers.length > MAX_RECEIVERS) throw new Error('receiver acknowledgement policy exceeds the bounded receiver limit');
  const policyId = exactText(input.policyId, 'receiver acknowledgement policy id', 180);
  const expectedAssessmentRef = reference(
    input.assessmentRef,
    'receiver acknowledgement policy assessment reference',
    DeclaredDisclosure.ASSESSMENT_SCHEMA
  );
  const issuedAt = timestamp(input.issuedAt, 'receiver acknowledgement policy issuedAt');
  const expiresAt = timestamp(input.expiresAt, 'receiver acknowledgement policy expiresAt');
  if (Date.parse(expiresAt) <= Date.parse(issuedAt)) throw new Error('receiver acknowledgement policy must expire after issue');
  const seenIds = new Set();
  const seenKeys = new Set();
  const receivers = input.receivers.map((receiver, index) => {
    exactKeys(receiver, ['receiverId', 'publicKeyPem', 'enabled'], 'receiver acknowledgement policy receiver ' + (index + 1));
    const receiverId = exactText(receiver.receiverId, 'receiver acknowledgement policy receiver id', 120);
    if (typeof receiver.enabled !== 'boolean') throw new Error('receiver acknowledgement policy receiver enabled must be boolean');
    const parsed = publicKey(receiver.publicKeyPem, 'receiver acknowledgement policy public key');
    const fingerprint = keyFingerprint(parsed.key);
    if (seenIds.has(receiverId)) throw new Error('receiver acknowledgement policy receiver ids must be unique');
    if (seenKeys.has(fingerprint)) throw new Error('receiver acknowledgement policy public keys must be unique');
    seenIds.add(receiverId);
    seenKeys.add(fingerprint);
    return { receiverId, publicKeyPem: parsed.pem, enabled: receiver.enabled };
  }).sort((left, right) => compareText(left.receiverId, right.receiverId));
  const enabledCount = receivers.filter(receiver => receiver.enabled).length;
  if (enabledCount < MIN_REQUIRED_ACKNOWLEDGEMENTS) throw new Error('receiver acknowledgement policy requires at least two enabled receivers');
  const requiredAcknowledgements = integer(
    input.requiredAcknowledgements,
    'receiver acknowledgement policy required acknowledgements',
    MIN_REQUIRED_ACKNOWLEDGEMENTS,
    enabledCount
  );
  const policy = {
    schema: POLICY_SCHEMA,
    version: VERSION,
    policyId,
    assessmentRef: expectedAssessmentRef,
    issuedAt,
    expiresAt,
    requiredAcknowledgements,
    receivers,
    status: STATUS,
    truth: policyTruth(),
    policyDigest: null
  };
  policy.policyDigest = sha256(withoutField(policy, 'policyDigest'));
  return policy;
}

function validatePolicy(value) {
  exactKeys(value, [
    'schema', 'version', 'policyId', 'assessmentRef', 'issuedAt', 'expiresAt',
    'requiredAcknowledgements', 'receivers', 'status', 'truth', 'policyDigest'
  ], 'receiver acknowledgement policy');
  if (value.schema !== POLICY_SCHEMA || value.version !== VERSION || value.status !== STATUS) {
    throw new Error('receiver acknowledgement policy identity mismatch');
  }
  const expected = buildPolicy(policyInputFromPolicy(value));
  if (stableStringify(expected) !== stableStringify(value)) throw new Error('receiver acknowledgement policy does not exact-rebuild');
  return expected;
}

function acknowledgementSigningPayload(acknowledgement) {
  return withoutField(acknowledgement, 'signature');
}

function receiverRecord(policy, receiverId) {
  const record = policy.receivers.find(receiver => receiver.receiverId === receiverId);
  if (!record) throw new Error('receiver acknowledgement references a receiver outside policy');
  if (!record.enabled) throw new Error('receiver acknowledgement references a disabled receiver');
  return record;
}

function verifyAcknowledgement(value, context, index) {
  const label = 'receiver acknowledgement ' + (index + 1);
  exactKeys(value, [
    'schema', 'version', 'acknowledgementId', 'policyDigest', 'assessmentRef',
    'rosterRef', 'receiverId', 'acknowledgedAt', 'scope', 'retentionClaim',
    'signatureAlgorithm', 'signature'
  ], label);
  if (value.schema !== ACKNOWLEDGEMENT_SCHEMA || value.version !== VERSION) throw new Error(label + ' identity mismatch');
  const acknowledgementId = exactText(value.acknowledgementId, label + '.acknowledgementId', 180);
  const policyDigestValue = digest(value.policyDigest, label + '.policyDigest');
  if (policyDigestValue !== context.policy.policyDigest) throw new Error(label + ' policy digest mismatch');
  const acknowledgedAssessmentRef = reference(value.assessmentRef, label + '.assessmentRef', DeclaredDisclosure.ASSESSMENT_SCHEMA);
  if (!sameReference(acknowledgedAssessmentRef, context.assessmentRef)) throw new Error(label + ' assessment reference mismatch');
  const acknowledgedRosterRef = reference(value.rosterRef, label + '.rosterRef', DeclaredDisclosure.ROSTER_SCHEMA);
  if (!sameReference(acknowledgedRosterRef, context.assessment.rosterRef)) throw new Error(label + ' roster reference mismatch');
  const receiverId = exactText(value.receiverId, label + '.receiverId', 120);
  const receiver = receiverRecord(context.policy, receiverId);
  const acknowledgedAt = timestamp(value.acknowledgedAt, label + '.acknowledgedAt');
  if (Date.parse(acknowledgedAt) < Date.parse(context.assessment.assessedAt) ||
      Date.parse(acknowledgedAt) < Date.parse(context.policy.issuedAt)) {
    throw new Error(label + ' cannot predate assessment or policy');
  }
  if (Date.parse(acknowledgedAt) > Date.parse(context.policy.expiresAt)) throw new Error(label + ' is after policy expiry');
  if (Date.parse(acknowledgedAt) > Date.parse(context.verifiedAt)) throw new Error(label + ' cannot postdate witness verification');
  if (value.scope !== SCOPE) throw new Error(label + '.scope mismatch');
  if (value.retentionClaim !== RETENTION_CLAIM) throw new Error(label + '.retentionClaim mismatch');
  if (value.signatureAlgorithm !== 'Ed25519') throw new Error(label + '.signatureAlgorithm must be Ed25519');
  const signature = decodeSignature(value.signature, label + '.signature');
  const key = publicKey(receiver.publicKeyPem, label + ' policy public key');
  const payload = Buffer.from(stableStringify(acknowledgementSigningPayload(value)), 'utf8');
  let verified = false;
  try {
    verified = crypto.verify(null, payload, key.key, signature);
  } catch (error) {
    verified = false;
  }
  if (!verified) throw new Error(label + ' signature verification failed');
  return {
    receiverId,
    acknowledgementId,
    acknowledgementPackageDigest: sha256(value),
    signedPayloadDigest: sha256(acknowledgementSigningPayload(value)),
    receiverIdDigest: sha256({ receiverId }),
    keyFingerprint: keyFingerprint(key.key),
    acknowledgedAt
  };
}

function witnessTruth(values) {
  return {
    assessmentVerifiedByExactRebuild: true,
    receiverPolicyVerifiedByExactRebuild: true,
    everyPresentedAcknowledgementSignatureCryptographicallyValid: true,
    distinctPresentedReceiverLabelsVerified: true,
    distinctPresentedReceiverKeysVerified: true,
    acknowledgementThresholdMet: values.thresholdMet,
    declaredReceiverAcknowledgementStatementsObserved: values.verifiedCount > 0,
    allEnabledDeclaredReceiversAcknowledged: values.allEnabledAcknowledged,
    callerSuppliedReceiverPolicy: true,
    receiverPolicyAuthorityAuthenticated: false,
    receiverIdentitiesAuthenticated: false,
    signingKeyPossessionEvidenceObserved: values.verifiedCount > 0,
    realWorldReceiverIndependenceProven: false,
    actualTransportDeliveryProven: false,
    receiverReadOrAppliedAssessmentProven: false,
    receiverPersistedAssessmentBytesProven: false,
    independentExternalRetentionProven: false,
    retentionDurationProven: false,
    protectedMonotonicStateProven: false,
    deletionOrRollbackPrevented: false,
    hostAuthorizationAuthenticated: false,
    witnessTimeExternallyTrusted: false,
    actualHumanParticipationProven: false,
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
    automaticInstall: false,
    automaticPromotion: false,
    automaticMerge: false,
    automaticCanon: false,
    foundationMutation: false
  };
}

function buildWitness(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('receiver acknowledgement witness input must be an object');
  if (Buffer.byteLength(stableStringify(input), 'utf8') > MAX_WITNESS_CANONICAL_BYTES) {
    throw new Error('receiver acknowledgement witness exceeds the bounded canonical byte limit');
  }
  exactKeys(input, [
    'witnessId', 'verifiedAt', 'assessmentInput', 'assessmentReceipt',
    'receiverPolicy', 'signedAcknowledgements'
  ], 'receiver acknowledgement witness input');
  if (!Array.isArray(input.signedAcknowledgements)) throw new Error('signed receiver acknowledgements must be an array');
  if (input.signedAcknowledgements.length > MAX_RECEIVERS) throw new Error('signed receiver acknowledgements exceed the bounded receiver limit');
  const witnessId = exactText(input.witnessId, 'receiver acknowledgement witness id', 180);
  const verifiedAt = timestamp(input.verifiedAt, 'receiver acknowledgement witness verifiedAt');
  const assessmentCheck = DeclaredDisclosure.verifyAssessment(copy(input.assessmentInput), copy(input.assessmentReceipt));
  if (!assessmentCheck.pass) throw new Error('declared disclosure assessment is invalid: ' + assessmentCheck.errors.join('; '));
  const assessment = assessmentCheck.rebuilt;
  const expectedAssessmentRef = assessmentRef(assessment);
  const policy = validatePolicy(copy(input.receiverPolicy));
  if (!sameReference(policy.assessmentRef, expectedAssessmentRef)) throw new Error('receiver acknowledgement policy assessment reference does not match exact assessment');
  if (Date.parse(policy.issuedAt) < Date.parse(assessment.assessedAt)) throw new Error('receiver acknowledgement policy cannot predate assessment');
  if (Date.parse(verifiedAt) < Date.parse(policy.issuedAt)) throw new Error('receiver acknowledgement witness cannot predate policy');
  if (Date.parse(verifiedAt) > Date.parse(policy.expiresAt)) throw new Error('receiver acknowledgement witness is after policy expiry');

  const context = { policy, assessment, assessmentRef: expectedAssessmentRef, verifiedAt };
  const seenReceivers = new Set();
  const evidence = input.signedAcknowledgements.map((acknowledgement, index) => {
    const verified = verifyAcknowledgement(copy(acknowledgement), context, index);
    if (seenReceivers.has(verified.receiverId)) throw new Error('signed receiver acknowledgements must contain at most one item per receiver');
    seenReceivers.add(verified.receiverId);
    return verified;
  }).sort((left, right) => compareText(left.receiverId, right.receiverId));
  const enabled = policy.receivers.filter(receiver => receiver.enabled);
  const missingReceiverIdDigests = enabled
    .filter(receiver => !seenReceivers.has(receiver.receiverId))
    .map(receiver => sha256({ receiverId: receiver.receiverId }))
    .sort(compareText);
  const thresholdMet = evidence.length >= policy.requiredAcknowledgements;
  const allEnabledAcknowledged = missingReceiverIdDigests.length === 0;
  const classification = thresholdMet
    ? 'DECLARED_RECEIVER_ACKNOWLEDGEMENT_THRESHOLD_MET'
    : 'HOLD_DECLARED_RECEIVER_ACKNOWLEDGEMENT_THRESHOLD_INCOMPLETE';
  const acknowledgementEvidence = evidence.map(item => ({
    acknowledgementIdDigest: sha256({ acknowledgementId: item.acknowledgementId }),
    acknowledgementPackageDigest: item.acknowledgementPackageDigest,
    signedPayloadDigest: item.signedPayloadDigest,
    receiverIdDigest: item.receiverIdDigest,
    keyFingerprint: item.keyFingerprint,
    acknowledgedAt: item.acknowledgedAt
  }));
  const receipt = {
    schema: RECEIPT_SCHEMA,
    version: VERSION,
    witnessId,
    verifiedAt,
    status: STATUS,
    assessmentRef: expectedAssessmentRef,
    rosterRef: copy(assessment.rosterRef),
    receiverPolicyRef: { id: policy.policyId, schema: policy.schema, sha256: policy.policyDigest },
    acknowledgementEvidence: {
      requiredAcknowledgements: policy.requiredAcknowledgements,
      enabledReceiverCount: enabled.length,
      verifiedAcknowledgements: evidence.length,
      allEnabledDeclaredReceiversAcknowledged: allEnabledAcknowledged,
      acknowledgements: acknowledgementEvidence,
      missingReceiverIdDigests
    },
    decision: {
      classification,
      thresholdStatus: thresholdMet ? 'MET' : 'INCOMPLETE',
      reviewRequired: !thresholdMet,
      bestAction: thresholdMet
        ? 'PRESERVE_RECEIPT_AND_REQUIRE_INDEPENDENT_TRANSPORT_EVIDENCE_BEFORE_RETENTION_CLAIMS'
        : 'PRESERVE_POLICY_AND_VALID_ACKNOWLEDGEMENTS_AND_REQUEST_MISSING_DECLARED_RECEIPTS',
      autonomousActionCount: 0
    },
    state: 'DECLARED_RECEIVER_KEY_ACKNOWLEDGEMENTS_VERIFIED_EXTERNAL_RETENTION_NOT_PROVEN',
    nextGate: NEXT_GATE,
    truth: witnessTruth({
      thresholdMet,
      verifiedCount: evidence.length,
      allEnabledAcknowledged
    }),
    receiptDigest: null
  };
  receipt.receiptDigest = sha256(withoutField(receipt, 'receiptDigest'));
  return receipt;
}

function verifyWitness(input, receipt) {
  const errors = [];
  let rebuilt = null;
  try {
    if (!receipt || receipt.schema !== RECEIPT_SCHEMA) throw new Error('receiver acknowledgement witness receipt schema mismatch');
    rebuilt = buildWitness(copy(input));
  } catch (error) {
    errors.push(error.message);
  }
  if (rebuilt && stableStringify(rebuilt) !== stableStringify(receipt)) {
    errors.push('receiver acknowledgement witness receipt content or digest mismatch');
  }
  return { pass: errors.length === 0, errors, rebuilt };
}

module.exports = {
  POLICY_SCHEMA,
  ACKNOWLEDGEMENT_SCHEMA,
  RECEIPT_SCHEMA,
  VERSION,
  STATUS,
  AUDIENCE,
  SCOPE,
  RETENTION_CLAIM,
  AUTHORITY_ORIGIN,
  NEXT_GATE,
  MAX_RECEIVERS,
  MIN_REQUIRED_ACKNOWLEDGEMENTS,
  MAX_POLICY_CANONICAL_BYTES,
  MAX_WITNESS_CANONICAL_BYTES,
  stableStringify,
  sha256,
  assessmentRef,
  buildPolicy,
  validatePolicy,
  acknowledgementSigningPayload,
  buildWitness,
  verifyWitness
};
