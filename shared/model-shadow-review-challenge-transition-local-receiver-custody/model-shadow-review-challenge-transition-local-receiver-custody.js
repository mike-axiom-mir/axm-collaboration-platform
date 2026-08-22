#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const DeclaredDisclosure = require('../model-shadow-review-challenge-transition-declared-disclosure/model-shadow-review-challenge-transition-declared-disclosure');
const ReceiverAck = require('../model-shadow-review-challenge-transition-receiver-ack/model-shadow-review-challenge-transition-receiver-ack');

const ENVELOPE_SCHEMA = 'axm.model-shadow-review-challenge-transition-local-receiver-envelope/v1';
const SENDER_RECEIPT_SCHEMA = 'axm.model-shadow-review-challenge-transition-local-receiver-sender-receipt/v1';
const CUSTODY_RECORD_SCHEMA = 'axm.model-shadow-review-challenge-transition-local-receiver-custody-record/v1';
const RECEIVER_RECEIPT_SCHEMA = 'axm.model-shadow-review-challenge-transition-local-receiver-receipt/v1';
const RELOAD_RECEIPT_SCHEMA = 'axm.model-shadow-review-challenge-transition-local-receiver-reload-receipt/v1';
const VERSION = '1.2.0';
const STATUS = 'TEST';
const NAMESPACE = 'model-shadow-review-challenge-transition-local-receiver-custody';
const OUTBOUND_DIRECTORY = 'outbound';
const RECORDS_DIRECTORY = 'records';
const SEND_CONFIRMATION = 'WRITE_EXACT_MODEL_SHADOW_ASSESSMENT_TO_LOCAL_RECEIVER_OUTBOX';
const RECEIVE_CONFIRMATION = 'READ_AND_PERSIST_EXACT_MODEL_SHADOW_ASSESSMENT_IN_LOCAL_RECEIVER_CUSTODY';
const MAX_ENVELOPE_CANONICAL_BYTES = 48 * 1024 * 1024;
const MAX_RECORD_CANONICAL_BYTES = 48 * 1024 * 1024;
const DIGEST = /^sha256:[a-f0-9]{64}$/;
const CONTENT_FILE = /^[a-f0-9]{64}\.json$/;

class LocalReceiverCustodyError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'LocalReceiverCustodyError';
    this.code = code;
  }
}

function fail(code, message) {
  throw new LocalReceiverCustodyError(code, message);
}

function stableStringify(value) {
  return ReceiverAck.stableStringify(value);
}

function copy(value) {
  return JSON.parse(stableStringify(value));
}

function sha256(value) {
  return ReceiverAck.sha256(value);
}

function exactKeys(value, allowed, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail('INVALID_INPUT', label + ' must be an object');
  const extras = Object.keys(value).filter(key => !allowed.includes(key));
  const missing = allowed.filter(key => !Object.prototype.hasOwnProperty.call(value, key));
  if (extras.length) fail('INVALID_INPUT', label + ' has unknown fields: ' + extras.sort().join(', '));
  if (missing.length) fail('INVALID_INPUT', label + ' is missing fields: ' + missing.sort().join(', '));
}

function exactText(value, label, maximum) {
  if (typeof value !== 'string' || !value || value !== value.trim()) fail('INVALID_INPUT', label + ' must be exact non-empty text');
  if (maximum && value.length > maximum) fail('INVALID_INPUT', label + ' is too long');
  return value;
}

function timestamp(value, label) {
  const result = exactText(value, label, 64);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?Z$/.test(result) || Number.isNaN(Date.parse(result))) {
    fail('INVALID_TIME', label + ' must be an exact UTC timestamp');
  }
  return result;
}

function digest(value, label) {
  const result = exactText(value, label, 71);
  if (!DIGEST.test(result)) fail('INVALID_INPUT', label + ' must be an exact SHA-256 digest');
  return result;
}

function reference(value, label, requiredSchema) {
  exactKeys(value, ['id', 'schema', 'sha256'], label);
  const result = {
    id: exactText(value.id, label + '.id', 180),
    schema: exactText(value.schema, label + '.schema', 180),
    sha256: digest(value.sha256, label + '.sha256')
  };
  if (requiredSchema && result.schema !== requiredSchema) fail('REFERENCE_MISMATCH', label + ' schema mismatch');
  return result;
}

function sameReference(left, right) {
  return left.id === right.id && left.schema === right.schema && left.sha256 === right.sha256;
}

function withoutFields(value, fields) {
  const result = copy(value);
  fields.forEach(field => delete result[field]);
  return result;
}

function assessmentRef(assessment) {
  return { id: assessment.assessmentId, schema: assessment.schema, sha256: assessment.receiptDigest };
}

function policyRef(policy) {
  return { id: policy.policyId, schema: policy.schema, sha256: policy.policyDigest };
}

function receiptRef(receipt, idField, digestField) {
  return { id: receipt[idField], schema: receipt.schema, sha256: receipt[digestField] };
}

function canonicalBytes(value) {
  return Buffer.byteLength(stableStringify(value), 'utf8');
}

function assertCanonicalBound(value, maximum, code, label) {
  if (canonicalBytes(value) > maximum) fail(code, label + ' exceeds the bounded canonical byte limit');
}

function parsePrivateKey(privateKeyPem) {
  if (typeof privateKeyPem !== 'string' || !privateKeyPem || privateKeyPem.length > 8192) {
    fail('PRIVATE_KEY_INVALID', 'receiver private key must be bounded non-empty PEM text');
  }
  let key;
  try { key = crypto.createPrivateKey(privateKeyPem); } catch (error) {
    fail('PRIVATE_KEY_INVALID', 'receiver private key is invalid');
  }
  if (key.asymmetricKeyType !== 'ed25519') fail('PRIVATE_KEY_INVALID', 'receiver private key must be Ed25519');
  const canonical = key.export({ type: 'pkcs8', format: 'pem' }).toString();
  if (canonical !== privateKeyPem) fail('PRIVATE_KEY_INVALID', 'receiver private key must use canonical Ed25519 PKCS8 PEM');
  return key;
}

function publicKeyFingerprint(publicKey) {
  return 'sha256:' + crypto.createHash('sha256').update(publicKey.export({ type: 'spki', format: 'der' })).digest('hex');
}

function policyReceiver(policy, receiverId) {
  const receiver = policy.receivers.find(item => item.receiverId === receiverId);
  if (!receiver) fail('RECEIVER_NOT_DECLARED', 'local receiver is outside the declared policy');
  if (!receiver.enabled) fail('RECEIVER_DISABLED', 'local receiver is disabled by the declared policy');
  return receiver;
}

function assertPrivateKeyMatches(privateKey, receiver) {
  const derived = crypto.createPublicKey(privateKey).export({ type: 'spki', format: 'der' });
  const declared = crypto.createPublicKey(receiver.publicKeyPem).export({ type: 'spki', format: 'der' });
  if (!crypto.timingSafeEqual(derived, declared)) fail('PRIVATE_KEY_MISMATCH', 'receiver private key does not match the declared receiver public key');
}

function sign(privateKey, value) {
  return crypto.sign(null, Buffer.from(stableStringify(value), 'utf8'), privateKey).toString('base64');
}

function verifySignature(publicKeyPem, value, signature, label) {
  if (typeof signature !== 'string' || Buffer.from(signature, 'base64').toString('base64') !== signature || Buffer.from(signature, 'base64').length !== 64) {
    fail('SIGNATURE_INVALID', label + ' must be one canonical Ed25519 signature');
  }
  let pass = false;
  try {
    pass = crypto.verify(null, Buffer.from(stableStringify(value), 'utf8'), crypto.createPublicKey(publicKeyPem), Buffer.from(signature, 'base64'));
  } catch (error) { pass = false; }
  if (!pass) fail('SIGNATURE_INVALID', label + ' verification failed');
}

function rootPath(value, label) {
  const supplied = exactText(value, label, 32767);
  if (!path.isAbsolute(supplied)) fail('STATE_ROOT_INVALID', label + ' must be an absolute path');
  const resolved = path.resolve(supplied);
  if (resolved === path.parse(resolved).root) fail('STATE_ROOT_INVALID', label + ' cannot be a filesystem root');
  let stat;
  try { stat = fs.lstatSync(resolved); } catch (error) {
    fail('STATE_ROOT_INVALID', label + ' must already exist');
  }
  if (!stat.isDirectory() || stat.isSymbolicLink()) fail('STATE_ROOT_INVALID', label + ' must be a real directory and not a symbolic link');
  return resolved;
}

function pathKey(value) {
  return process.platform === 'win32' ? value.toLowerCase() : value;
}

function assertSeparatedRoots(transportRoot, stateRoot) {
  const left = pathKey(path.resolve(transportRoot));
  const right = pathKey(path.resolve(stateRoot));
  if (left === right || left.startsWith(right + path.sep) || right.startsWith(left + path.sep)) {
    fail('ROOTS_NOT_SEPARATE', 'transport and receiver custody roots must be distinct and non-nested');
  }
}

function assertDirectoryNotLink(directoryPath, label) {
  let stat;
  try { stat = fs.lstatSync(directoryPath); } catch (error) {
    fail('STATE_ROOT_INVALID', label + ' is missing or unreadable');
  }
  if (!stat.isDirectory() || stat.isSymbolicLink()) fail('STATE_ROOT_INVALID', label + ' must be a real directory and not a symbolic link');
}

function createFixedDirectory(directoryPath, label) {
  try { fs.mkdirSync(directoryPath); } catch (error) {
    if (error.code !== 'EEXIST') fail('WRITE_FAILED', label + ' cannot be created: ' + error.message);
  }
  assertDirectoryNotLink(directoryPath, label);
}

function contentFileName(digestValue) {
  return digestValue.slice('sha256:'.length) + '.json';
}

function deliveryFileName(deliveryId, receiverId) {
  return contentFileName(sha256({ deliveryId, receiverId }));
}

function fixedContentFile(value, label) {
  const result = exactText(value, label, 69);
  if (!CONTENT_FILE.test(result)) fail('PATH_REFUSED', label + ' must be one content-addressed JSON filename');
  return result;
}

function writeExclusive(filePath, value, maximum, codePrefix) {
  assertCanonicalBound(value, maximum, codePrefix + '_TOO_LARGE', codePrefix.toLowerCase().replaceAll('_', ' '));
  let descriptor;
  try { descriptor = fs.openSync(filePath, 'wx', 0o600); } catch (error) {
    if (error.code === 'EEXIST') fail(codePrefix + '_EXISTS', 'refusing to overwrite existing content-addressed file');
    fail(codePrefix + '_WRITE_FAILED', 'exclusive file create failed: ' + error.message);
  }
  let writeError = null;
  try {
    fs.writeFileSync(descriptor, stableStringify(value) + '\n', { encoding: 'utf8' });
    fs.fsyncSync(descriptor);
  } catch (error) { writeError = error; } finally {
    try { fs.closeSync(descriptor); } catch (error) { if (!writeError) writeError = error; }
  }
  if (writeError) fail(codePrefix + '_DURABILITY_UNCERTAIN', 'file write or fsync did not complete; fail-closed state remains for steward inspection: ' + writeError.message);
}

function readCanonicalJson(filePath, maximum, codePrefix, label) {
  let stat;
  try { stat = fs.lstatSync(filePath); } catch (error) {
    if (error.code === 'ENOENT') fail(codePrefix + '_MISSING', label + ' is missing');
    fail(codePrefix + '_UNREADABLE', label + ' cannot be inspected: ' + error.message);
  }
  if (!stat.isFile() || stat.isSymbolicLink()) fail(codePrefix + '_INVALID', label + ' must be a regular file and not a symbolic link');
  if (stat.size > maximum + 1) fail(codePrefix + '_TOO_LARGE', label + ' exceeds the bounded byte limit');
  let raw;
  let value;
  try {
    raw = fs.readFileSync(filePath, 'utf8');
    value = JSON.parse(raw);
  } catch (error) { fail(codePrefix + '_INVALID', label + ' is invalid JSON'); }
  if (raw !== stableStringify(value) + '\n') fail(codePrefix + '_INVALID', label + ' is not exact canonical JSON');
  assertCanonicalBound(value, maximum, codePrefix + '_TOO_LARGE', label);
  return value;
}

function buildEnvelope(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) fail('INVALID_INPUT', 'local receiver envelope input must be an object');
  assertCanonicalBound(input, MAX_ENVELOPE_CANONICAL_BYTES, 'ENVELOPE_TOO_LARGE', 'local receiver envelope input');
  exactKeys(input, ['deliveryId', 'receiverId', 'sentAt', 'assessmentInput', 'assessmentReceipt', 'receiverPolicy'], 'local receiver envelope input');
  const deliveryId = exactText(input.deliveryId, 'local receiver delivery id', 180);
  const receiverId = exactText(input.receiverId, 'local receiver id', 120);
  const sentAt = timestamp(input.sentAt, 'local receiver sentAt');
  const assessmentCheck = DeclaredDisclosure.verifyAssessment(copy(input.assessmentInput), copy(input.assessmentReceipt));
  if (!assessmentCheck.pass) fail('ASSESSMENT_INVALID', 'declared disclosure assessment is invalid: ' + assessmentCheck.errors.join('; '));
  const assessment = assessmentCheck.rebuilt;
  let policy;
  try { policy = ReceiverAck.validatePolicy(copy(input.receiverPolicy)); } catch (error) {
    fail('POLICY_INVALID', 'receiver policy is invalid: ' + error.message);
  }
  const expectedAssessmentRef = assessmentRef(assessment);
  if (!sameReference(policy.assessmentRef, expectedAssessmentRef)) fail('POLICY_MISMATCH', 'receiver policy does not bind the exact assessment');
  policyReceiver(policy, receiverId);
  if (Date.parse(sentAt) < Date.parse(assessment.assessedAt) || Date.parse(sentAt) < Date.parse(policy.issuedAt)) {
    fail('INVALID_TIME', 'local receiver send cannot predate assessment or policy');
  }
  if (Date.parse(sentAt) > Date.parse(policy.expiresAt)) fail('INVALID_TIME', 'local receiver send is after policy expiry');
  const packageValue = { assessmentInput: copy(input.assessmentInput), assessmentReceipt: copy(assessment) };
  const envelope = {
    schema: ENVELOPE_SCHEMA,
    version: VERSION,
    deliveryId,
    receiverId,
    sentAt,
    status: STATUS,
    assessmentRef: expectedAssessmentRef,
    rosterRef: copy(assessment.rosterRef),
    receiverPolicyRef: policyRef(policy),
    assessmentInput: packageValue.assessmentInput,
    assessmentReceipt: packageValue.assessmentReceipt,
    receiverPolicy: copy(policy),
    payloadDigest: sha256(packageValue),
    envelopeDigest: null
  };
  envelope.envelopeDigest = sha256(withoutFields(envelope, ['envelopeDigest']));
  assertCanonicalBound(envelope, MAX_ENVELOPE_CANONICAL_BYTES, 'ENVELOPE_TOO_LARGE', 'local receiver envelope');
  return envelope;
}

function envelopeInput(envelope) {
  return {
    deliveryId: envelope.deliveryId,
    receiverId: envelope.receiverId,
    sentAt: envelope.sentAt,
    assessmentInput: copy(envelope.assessmentInput),
    assessmentReceipt: copy(envelope.assessmentReceipt),
    receiverPolicy: copy(envelope.receiverPolicy)
  };
}

function validateEnvelope(value) {
  exactKeys(value, [
    'schema', 'version', 'deliveryId', 'receiverId', 'sentAt', 'status',
    'assessmentRef', 'rosterRef', 'receiverPolicyRef', 'assessmentInput',
    'assessmentReceipt', 'receiverPolicy', 'payloadDigest', 'envelopeDigest'
  ], 'local receiver envelope');
  if (value.schema !== ENVELOPE_SCHEMA || value.version !== VERSION || value.status !== STATUS) fail('ENVELOPE_INVALID', 'local receiver envelope identity mismatch');
  const expected = buildEnvelope(envelopeInput(value));
  if (stableStringify(expected) !== stableStringify(value)) fail('ENVELOPE_INVALID', 'local receiver envelope does not exact-rebuild');
  return expected;
}

function senderTruth() {
  return {
    envelopeVerifiedByExactRebuild: true,
    assessmentVerifiedByExactRebuildBeforeWrite: true,
    receiverPolicyVerifiedByExactRebuildBeforeWrite: true,
    outboundEnvelopeExclusiveCreateCompleted: true,
    outboundEnvelopeFileFsyncCompleted: true,
    receiverReadObserved: false,
    receiverPersistenceObserved: false,
    senderReceiptAuthenticated: false,
    actualNetworkTransportProven: false,
    otherHostDeliveryProven: false,
    independentlyOperatedReceiverProven: false,
    executionAuthorized: false,
    adoptionAuthorized: false,
    automaticCanon: false
  };
}

function buildSenderReceipt(envelope) {
  const envelopeFileName = deliveryFileName(envelope.deliveryId, envelope.receiverId);
  const receipt = {
    schema: SENDER_RECEIPT_SCHEMA,
    version: VERSION,
    senderReceiptId: 'local-sender-receipt:' + sha256({ deliveryId: envelope.deliveryId, receiverId: envelope.receiverId }).slice(7),
    sentAt: envelope.sentAt,
    status: STATUS,
    assessmentRef: copy(envelope.assessmentRef),
    rosterRef: copy(envelope.rosterRef),
    receiverPolicyRef: copy(envelope.receiverPolicyRef),
    receiverIdDigest: sha256({ receiverId: envelope.receiverId }),
    envelopeFileName,
    envelopeDigest: envelope.envelopeDigest,
    payloadDigest: envelope.payloadDigest,
    truth: senderTruth(),
    receiptDigest: null
  };
  receipt.receiptDigest = sha256(withoutFields(receipt, ['receiptDigest']));
  return receipt;
}

function validateSenderReceipt(value, envelope) {
  exactKeys(value, [
    'schema', 'version', 'senderReceiptId', 'sentAt', 'status', 'assessmentRef',
    'rosterRef', 'receiverPolicyRef', 'receiverIdDigest', 'envelopeFileName',
    'envelopeDigest', 'payloadDigest', 'truth', 'receiptDigest'
  ], 'local receiver sender receipt');
  if (value.schema !== SENDER_RECEIPT_SCHEMA || value.version !== VERSION || value.status !== STATUS) fail('SENDER_RECEIPT_INVALID', 'sender receipt identity mismatch');
  const expected = buildSenderReceipt(envelope);
  if (stableStringify(expected) !== stableStringify(value)) fail('SENDER_RECEIPT_INVALID', 'sender receipt does not exact-rebuild from the envelope');
  return expected;
}

function buildAcknowledgement(envelope, receivedAt, privateKey) {
  const acknowledgement = {
    schema: ReceiverAck.ACKNOWLEDGEMENT_SCHEMA,
    version: ReceiverAck.VERSION,
    acknowledgementId: 'local-receiver-ack:' + sha256({ deliveryId: envelope.deliveryId, receiverId: envelope.receiverId }).slice(7),
    policyDigest: envelope.receiverPolicy.policyDigest,
    assessmentRef: copy(envelope.assessmentRef),
    rosterRef: copy(envelope.rosterRef),
    receiverId: envelope.receiverId,
    acknowledgedAt: receivedAt,
    scope: ReceiverAck.SCOPE,
    retentionClaim: ReceiverAck.RETENTION_CLAIM,
    signatureAlgorithm: 'Ed25519',
    signature: ''
  };
  acknowledgement.signature = sign(privateKey, ReceiverAck.acknowledgementSigningPayload(acknowledgement));
  return acknowledgement;
}

function validateAcknowledgement(value, policy, expectedAssessmentRef, expectedRosterRef, receiverId, deliveryId) {
  exactKeys(value, [
    'schema', 'version', 'acknowledgementId', 'policyDigest', 'assessmentRef',
    'rosterRef', 'receiverId', 'acknowledgedAt', 'scope', 'retentionClaim',
    'signatureAlgorithm', 'signature'
  ], 'local receiver acknowledgement');
  if (value.schema !== ReceiverAck.ACKNOWLEDGEMENT_SCHEMA || value.version !== ReceiverAck.VERSION) fail('ACKNOWLEDGEMENT_INVALID', 'acknowledgement identity mismatch');
  const expectedAcknowledgementId = 'local-receiver-ack:' + sha256({ deliveryId, receiverId }).slice(7);
  if (exactText(value.acknowledgementId, 'local receiver acknowledgement id', 180) !== expectedAcknowledgementId) fail('ACKNOWLEDGEMENT_INVALID', 'acknowledgement id mismatch');
  if (value.policyDigest !== policy.policyDigest) fail('ACKNOWLEDGEMENT_INVALID', 'acknowledgement policy mismatch');
  const ackAssessmentRef = reference(value.assessmentRef, 'acknowledgement assessment reference', DeclaredDisclosure.ASSESSMENT_SCHEMA);
  const ackRosterRef = reference(value.rosterRef, 'acknowledgement roster reference', DeclaredDisclosure.ROSTER_SCHEMA);
  if (!sameReference(ackAssessmentRef, expectedAssessmentRef) || !sameReference(ackRosterRef, expectedRosterRef)) fail('ACKNOWLEDGEMENT_INVALID', 'acknowledgement assessment or roster mismatch');
  if (value.receiverId !== receiverId || value.scope !== ReceiverAck.SCOPE || value.retentionClaim !== ReceiverAck.RETENTION_CLAIM || value.signatureAlgorithm !== 'Ed25519') {
    fail('ACKNOWLEDGEMENT_INVALID', 'acknowledgement receiver scope retention or algorithm mismatch');
  }
  timestamp(value.acknowledgedAt, 'acknowledgement acknowledgedAt');
  if (Date.parse(value.acknowledgedAt) < Date.parse(policy.issuedAt) || Date.parse(value.acknowledgedAt) > Date.parse(policy.expiresAt)) {
    fail('ACKNOWLEDGEMENT_INVALID', 'acknowledgement time is outside policy window');
  }
  const receiver = policyReceiver(policy, receiverId);
  verifySignature(receiver.publicKeyPem, ReceiverAck.acknowledgementSigningPayload(value), value.signature, 'local receiver acknowledgement signature');
  return copy(value);
}

function custodyTruth() {
  return {
    envelopeVerifiedByExactRebuild: true,
    assessmentVerifiedByExactRebuildBeforeWrite: true,
    receiverPolicyVerifiedByExactRebuildBeforeWrite: true,
    matchingDeclaredReceiverPrivateKeyObservedTransiently: true,
    localOutboxEnvelopeRead: true,
    dataMinimizedAssessmentReceiptPersisted: true,
    fullAssessmentInputPersistedInCustody: false,
    receiverAcknowledgementPersisted: true,
    receiverCustodySignaturePersisted: true,
    privateKeyPersisted: false,
    custodyRecordExclusiveCreateCompleted: true,
    custodyRecordFileFsyncCompleted: true,
    actualLocalFileHandoffObserved: true,
    separateProcessProvenByRecord: false,
    actualNetworkTransportProven: false,
    otherHostDeliveryProven: false,
    independentlyOperatedReceiverProven: false,
    independentExternalRetentionProven: false,
    retentionDurationProven: false,
    durabilityBeyondReportedFileFsyncProven: false,
    protectedMonotonicStateProven: false,
    deletionOrRollbackPrevented: false,
    hostAuthorizationAuthenticated: false,
    executionAuthorized: false,
    adoptionAuthorized: false,
    automaticInstall: false,
    automaticPromotion: false,
    automaticMerge: false,
    automaticCanon: false,
    foundationMutation: false
  };
}

function recordDigest(record) {
  return sha256(withoutFields(record, ['recordDigest', 'recordSignature']));
}

function recordSigningPayload(record) {
  return withoutFields(record, ['recordSignature']);
}

function buildCustodyRecord(envelope, receivedAt, acknowledgement, privateKey) {
  const record = {
    schema: CUSTODY_RECORD_SCHEMA,
    version: VERSION,
    custodyRecordId: 'local-custody-record:' + sha256({ deliveryId: envelope.deliveryId, receiverId: envelope.receiverId }).slice(7),
    deliveryId: envelope.deliveryId,
    receiverId: envelope.receiverId,
    receivedAt,
    status: STATUS,
    assessmentRef: copy(envelope.assessmentRef),
    rosterRef: copy(envelope.rosterRef),
    receiverPolicyRef: copy(envelope.receiverPolicyRef),
    envelopeDigest: envelope.envelopeDigest,
    payloadDigest: envelope.payloadDigest,
    storedAssessmentReceipt: copy(envelope.assessmentReceipt),
    storedAssessmentReceiptDigest: sha256(envelope.assessmentReceipt),
    acknowledgement: copy(acknowledgement),
    recordSignatureAlgorithm: 'Ed25519',
    truth: custodyTruth(),
    recordDigest: null,
    recordSignature: ''
  };
  record.recordDigest = recordDigest(record);
  record.recordSignature = sign(privateKey, recordSigningPayload(record));
  assertCanonicalBound(record, MAX_RECORD_CANONICAL_BYTES, 'CUSTODY_RECORD_TOO_LARGE', 'local receiver custody record');
  return record;
}

function validateStoredAssessmentReceipt(value, expectedRef, expectedRosterRef) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || value.schema !== DeclaredDisclosure.ASSESSMENT_SCHEMA) {
    fail('CUSTODY_RECORD_INVALID', 'stored assessment receipt identity mismatch');
  }
  const receiptDigest = digest(value.receiptDigest, 'stored assessment receipt digest');
  timestamp(value.assessedAt, 'stored assessment assessedAt');
  if (sha256(withoutFields(value, ['receiptDigest'])) !== receiptDigest) fail('CUSTODY_RECORD_INVALID', 'stored assessment receipt self-digest mismatch');
  const rebuiltRef = assessmentRef(value);
  if (!sameReference(rebuiltRef, expectedRef)) fail('CUSTODY_RECORD_INVALID', 'stored assessment receipt reference mismatch');
  if (!sameReference(reference(value.rosterRef, 'stored assessment roster reference', DeclaredDisclosure.ROSTER_SCHEMA), expectedRosterRef)) {
    fail('CUSTODY_RECORD_INVALID', 'stored assessment roster reference mismatch');
  }
  return copy(value);
}

function validateCustodyRecord(value, receiverPolicy, configuredReceiverId) {
  assertCanonicalBound(value, MAX_RECORD_CANONICAL_BYTES, 'CUSTODY_RECORD_TOO_LARGE', 'local receiver custody record');
  exactKeys(value, [
    'schema', 'version', 'custodyRecordId', 'deliveryId', 'receiverId', 'receivedAt',
    'status', 'assessmentRef', 'rosterRef', 'receiverPolicyRef', 'envelopeDigest',
    'payloadDigest', 'storedAssessmentReceipt', 'storedAssessmentReceiptDigest',
    'acknowledgement', 'recordSignatureAlgorithm', 'truth', 'recordDigest',
    'recordSignature'
  ], 'local receiver custody record');
  if (value.schema !== CUSTODY_RECORD_SCHEMA || value.version !== VERSION || value.status !== STATUS) fail('CUSTODY_RECORD_INVALID', 'custody record identity mismatch');
  const deliveryId = exactText(value.deliveryId, 'custody delivery id', 180);
  const receiverId = exactText(value.receiverId, 'custody receiver id', 120);
  const expectedCustodyRecordId = 'local-custody-record:' + sha256({ deliveryId, receiverId }).slice(7);
  if (exactText(value.custodyRecordId, 'custody record id', 180) !== expectedCustodyRecordId) fail('CUSTODY_RECORD_INVALID', 'custody record id mismatch');
  if (receiverId !== configuredReceiverId) fail('RECEIVER_MISMATCH', 'custody record receiver does not match configured receiver');
  timestamp(value.receivedAt, 'custody receivedAt');
  const expectedAssessmentRef = reference(value.assessmentRef, 'custody assessment reference', DeclaredDisclosure.ASSESSMENT_SCHEMA);
  const expectedRosterRef = reference(value.rosterRef, 'custody roster reference', DeclaredDisclosure.ROSTER_SCHEMA);
  let policy;
  try { policy = ReceiverAck.validatePolicy(copy(receiverPolicy)); } catch (error) { fail('POLICY_INVALID', 'receiver policy is invalid: ' + error.message); }
  if (!sameReference(reference(value.receiverPolicyRef, 'custody policy reference', ReceiverAck.POLICY_SCHEMA), policyRef(policy))) fail('POLICY_MISMATCH', 'custody policy reference mismatch');
  const receiver = policyReceiver(policy, receiverId);
  if (!sameReference(policy.assessmentRef, expectedAssessmentRef)) fail('POLICY_MISMATCH', 'custody policy assessment mismatch');
  digest(value.envelopeDigest, 'custody envelope digest');
  digest(value.payloadDigest, 'custody payload digest');
  digest(value.storedAssessmentReceiptDigest, 'custody stored assessment receipt digest');
  const stored = validateStoredAssessmentReceipt(value.storedAssessmentReceipt, expectedAssessmentRef, expectedRosterRef);
  if (Date.parse(value.receivedAt) < Date.parse(stored.assessedAt) || Date.parse(value.receivedAt) < Date.parse(policy.issuedAt) || Date.parse(value.receivedAt) > Date.parse(policy.expiresAt)) {
    fail('CUSTODY_RECORD_INVALID', 'custody receive time is outside assessment and policy order');
  }
  if (sha256(stored) !== value.storedAssessmentReceiptDigest) fail('CUSTODY_RECORD_INVALID', 'stored assessment receipt package digest mismatch');
  const acknowledgement = validateAcknowledgement(value.acknowledgement, policy, expectedAssessmentRef, expectedRosterRef, receiverId, deliveryId);
  if (acknowledgement.acknowledgedAt !== value.receivedAt) fail('CUSTODY_RECORD_INVALID', 'acknowledgement time does not match custody receive time');
  if (value.recordSignatureAlgorithm !== 'Ed25519') fail('CUSTODY_RECORD_INVALID', 'custody record signature algorithm mismatch');
  if (stableStringify(value.truth) !== stableStringify(custodyTruth())) fail('CUSTODY_RECORD_INVALID', 'custody record truth boundary mismatch');
  if (digest(value.recordDigest, 'custody record digest') !== recordDigest(value)) fail('CUSTODY_RECORD_INVALID', 'custody record digest mismatch');
  verifySignature(receiver.publicKeyPem, recordSigningPayload(value), value.recordSignature, 'custody record signature');
  return { record: copy(value), policy, receiver };
}

function receiverTruth() {
  return {
    senderAndReceiverReceiptsBoundToExactEnvelopeDigest: true,
    senderOutboxFileFsyncReported: true,
    receiverReadExactCanonicalEnvelope: true,
    assessmentVerifiedByExactRebuildBeforeCustodyWrite: true,
    receiverPolicyVerifiedByExactRebuild: true,
    receiverAcknowledgementSignatureVerified: true,
    receiverCustodyRecordSignatureVerified: true,
    dataMinimizedAssessmentReceiptPersisted: true,
    receiverCustodyRecordFileFsyncCompleted: true,
    actualLocalFileHandoffObserved: true,
    separateProcessProvenByReceipt: false,
    actualNetworkTransportProven: false,
    otherHostDeliveryProven: false,
    independentlyOperatedReceiverProven: false,
    independentExternalRetentionProven: false,
    retentionDurationProven: false,
    protectedMonotonicStateProven: false,
    deletionOrRollbackPrevented: false,
    rawReceiverLabelEmbedded: false,
    rawPublicKeyEmbedded: false,
    rawSignatureEmbedded: false,
    privateKeyEmbedded: false,
    fullAssessmentReceiptEmbedded: false,
    machinePathEmbedded: false,
    executionAuthorized: false,
    adoptionAuthorized: false,
    automaticCanon: false
  };
}

function buildReceiverReceipt(senderReceipt, custodyRecord, recordFileName) {
  const fileName = fixedContentFile(recordFileName, 'custody record file name');
  const receipt = {
    schema: RECEIVER_RECEIPT_SCHEMA,
    version: VERSION,
    receiverReceiptId: 'local-receiver-receipt:' + sha256({ custodyRecordId: custodyRecord.custodyRecordId }).slice(7),
    receivedAt: custodyRecord.receivedAt,
    status: STATUS,
    senderReceiptRef: receiptRef(senderReceipt, 'senderReceiptId', 'receiptDigest'),
    custodyRecordRef: { id: custodyRecord.custodyRecordId, schema: custodyRecord.schema, sha256: custodyRecord.recordDigest },
    assessmentRef: copy(custodyRecord.assessmentRef),
    rosterRef: copy(custodyRecord.rosterRef),
    receiverPolicyRef: copy(custodyRecord.receiverPolicyRef),
    receiverIdDigest: sha256({ receiverId: custodyRecord.receiverId }),
    envelopeDigest: custodyRecord.envelopeDigest,
    payloadDigest: custodyRecord.payloadDigest,
    storedAssessmentReceiptDigest: custodyRecord.storedAssessmentReceiptDigest,
    acknowledgementPackageDigest: sha256(custodyRecord.acknowledgement),
    acknowledgementSignedPayloadDigest: sha256(ReceiverAck.acknowledgementSigningPayload(custodyRecord.acknowledgement)),
    recordFileName: fileName,
    truth: receiverTruth(),
    receiptDigest: null
  };
  receipt.receiptDigest = sha256(withoutFields(receipt, ['receiptDigest']));
  return receipt;
}

function validateReceiverReceipt(senderReceipt, custodyRecord, receipt) {
  exactKeys(receipt, [
    'schema', 'version', 'receiverReceiptId', 'receivedAt', 'status',
    'senderReceiptRef', 'custodyRecordRef', 'assessmentRef', 'rosterRef',
    'receiverPolicyRef', 'receiverIdDigest', 'envelopeDigest', 'payloadDigest',
    'storedAssessmentReceiptDigest', 'acknowledgementPackageDigest',
    'acknowledgementSignedPayloadDigest', 'recordFileName', 'truth', 'receiptDigest'
  ], 'local receiver receipt');
  if (receipt.schema !== RECEIVER_RECEIPT_SCHEMA || receipt.version !== VERSION || receipt.status !== STATUS) fail('RECEIVER_RECEIPT_INVALID', 'receiver receipt identity mismatch');
  const expected = buildReceiverReceipt(senderReceipt, custodyRecord, receipt.recordFileName);
  if (stableStringify(expected) !== stableStringify(receipt)) fail('RECEIVER_RECEIPT_INVALID', 'receiver receipt does not exact-rebuild');
  return expected;
}

function reloadTruth() {
  return {
    custodyRecordReloadedFromLocalFilesystem: true,
    custodyRecordDigestVerified: true,
    custodyRecordSignatureVerified: true,
    receiverAcknowledgementSignatureVerified: true,
    storedAssessmentReceiptSelfDigestVerified: true,
    storedAssessmentReceiptPackageDigestVerified: true,
    assessmentUpstreamExactReverifiedWithoutInput: false,
    freshProcessProvenByReceipt: false,
    custodyRecordFileFsyncWasReportedAtWrite: true,
    durabilityBeyondReportedFileFsyncProven: false,
    independentlyOperatedReceiverProven: false,
    independentExternalRetentionProven: false,
    retentionDurationProven: false,
    protectedMonotonicStateProven: false,
    deletionOrRollbackPrevented: false,
    rawReceiverLabelEmbedded: false,
    rawPublicKeyEmbedded: false,
    rawSignatureEmbedded: false,
    fullAssessmentReceiptEmbedded: false,
    machinePathEmbedded: false,
    executionAuthorized: false,
    adoptionAuthorized: false,
    automaticCanon: false
  };
}

function buildReloadReceipt(record, recordFileName, loadedAt) {
  const receipt = {
    schema: RELOAD_RECEIPT_SCHEMA,
    version: VERSION,
    reloadReceiptId: 'local-receiver-reload:' + sha256({ custodyRecordId: record.custodyRecordId, loadedAt }).slice(7),
    loadedAt,
    status: STATUS,
    custodyRecordRef: { id: record.custodyRecordId, schema: record.schema, sha256: record.recordDigest },
    assessmentRef: copy(record.assessmentRef),
    rosterRef: copy(record.rosterRef),
    receiverPolicyRef: copy(record.receiverPolicyRef),
    receiverIdDigest: sha256({ receiverId: record.receiverId }),
    storedAssessmentReceiptDigest: record.storedAssessmentReceiptDigest,
    acknowledgementPackageDigest: sha256(record.acknowledgement),
    recordFileName: fixedContentFile(recordFileName, 'custody reload record file name'),
    truth: reloadTruth(),
    receiptDigest: null
  };
  receipt.receiptDigest = sha256(withoutFields(receipt, ['receiptDigest']));
  return receipt;
}

function validateReloadReceipt(record, receipt) {
  exactKeys(receipt, [
    'schema', 'version', 'reloadReceiptId', 'loadedAt', 'status',
    'custodyRecordRef', 'assessmentRef', 'rosterRef', 'receiverPolicyRef',
    'receiverIdDigest', 'storedAssessmentReceiptDigest',
    'acknowledgementPackageDigest', 'recordFileName', 'truth', 'receiptDigest'
  ], 'local receiver reload receipt');
  if (receipt.schema !== RELOAD_RECEIPT_SCHEMA || receipt.version !== VERSION || receipt.status !== STATUS) fail('RELOAD_RECEIPT_INVALID', 'reload receipt identity mismatch');
  const expected = buildReloadReceipt(record, receipt.recordFileName, timestamp(receipt.loadedAt, 'reload loadedAt'));
  if (stableStringify(expected) !== stableStringify(receipt)) fail('RELOAD_RECEIPT_INVALID', 'reload receipt does not exact-rebuild');
  return expected;
}

function createSender(options) {
  exactKeys(options, ['transportRoot'], 'local receiver sender options');
  const transportRoot = rootPath(options.transportRoot, 'local receiver transport root');
  const namespace = path.join(transportRoot, NAMESPACE);
  const outbound = path.join(namespace, OUTBOUND_DIRECTORY);
  return {
    send(input) {
      exactKeys(input, ['confirmation', 'deliveryId', 'receiverId', 'sentAt', 'assessmentInput', 'assessmentReceipt', 'receiverPolicy'], 'local receiver send input');
      if (input.confirmation !== SEND_CONFIRMATION) fail('SEND_CONFIRMATION_REQUIRED', 'exact local receiver send confirmation is required');
      const envelope = buildEnvelope(withoutFields(input, ['confirmation']));
      createFixedDirectory(namespace, 'local receiver transport namespace');
      createFixedDirectory(outbound, 'local receiver outbound directory');
      const envelopeFileName = deliveryFileName(envelope.deliveryId, envelope.receiverId);
      writeExclusive(path.join(outbound, envelopeFileName), envelope, MAX_ENVELOPE_CANONICAL_BYTES, 'OUTBOX_ENVELOPE');
      return buildSenderReceipt(envelope);
    }
  };
}

function createReceiver(options) {
  exactKeys(options, ['transportRoot', 'stateRoot', 'receiverId', 'privateKeyPem'], 'local receiver options');
  const transportRoot = rootPath(options.transportRoot, 'local receiver transport root');
  const stateRoot = rootPath(options.stateRoot, 'local receiver custody root');
  assertSeparatedRoots(transportRoot, stateRoot);
  const receiverId = exactText(options.receiverId, 'configured local receiver id', 120);
  const privateKey = options.privateKeyPem === null ? null : parsePrivateKey(options.privateKeyPem);
  const transportNamespace = path.join(transportRoot, NAMESPACE);
  const outbound = path.join(transportNamespace, OUTBOUND_DIRECTORY);
  const stateNamespace = path.join(stateRoot, NAMESPACE);
  const records = path.join(stateNamespace, RECORDS_DIRECTORY);

  function readEnvelope(envelopeFileName) {
    assertDirectoryNotLink(transportNamespace, 'local receiver transport namespace');
    assertDirectoryNotLink(outbound, 'local receiver outbound directory');
    return validateEnvelope(readCanonicalJson(path.join(outbound, fixedContentFile(envelopeFileName, 'local receiver envelope file name')), MAX_ENVELOPE_CANONICAL_BYTES, 'OUTBOX_ENVELOPE', 'local receiver outbound envelope'));
  }

  function readRecord(recordFileName) {
    assertDirectoryNotLink(stateNamespace, 'local receiver custody namespace');
    assertDirectoryNotLink(records, 'local receiver records directory');
    return readCanonicalJson(path.join(records, fixedContentFile(recordFileName, 'local receiver custody record file name')), MAX_RECORD_CANONICAL_BYTES, 'CUSTODY_RECORD', 'local receiver custody record');
  }

  return {
    receive(input) {
      exactKeys(input, ['confirmation', 'envelopeFileName', 'senderReceipt', 'receivedAt'], 'local receiver receive input');
      if (input.confirmation !== RECEIVE_CONFIRMATION) fail('RECEIVE_CONFIRMATION_REQUIRED', 'exact local receiver receive confirmation is required');
      if (!privateKey) fail('PRIVATE_KEY_REQUIRED', 'receiver private key is required for receive but not reload');
      const envelope = readEnvelope(input.envelopeFileName);
      const senderReceipt = validateSenderReceipt(copy(input.senderReceipt), envelope);
      if (envelope.receiverId !== receiverId) fail('RECEIVER_MISMATCH', 'outbound envelope receiver does not match configured receiver');
      const policy = ReceiverAck.validatePolicy(copy(envelope.receiverPolicy));
      const receiver = policyReceiver(policy, receiverId);
      assertPrivateKeyMatches(privateKey, receiver);
      const receivedAt = timestamp(input.receivedAt, 'local receiver receivedAt');
      if (Date.parse(receivedAt) < Date.parse(envelope.sentAt)) fail('INVALID_TIME', 'local receiver receive cannot predate send');
      if (Date.parse(receivedAt) > Date.parse(policy.expiresAt)) fail('INVALID_TIME', 'local receiver receive is after policy expiry');
      const acknowledgement = buildAcknowledgement(envelope, receivedAt, privateKey);
      validateAcknowledgement(acknowledgement, policy, envelope.assessmentRef, envelope.rosterRef, receiverId, envelope.deliveryId);
      const record = buildCustodyRecord(envelope, receivedAt, acknowledgement, privateKey);
      validateCustodyRecord(record, policy, receiverId);
      createFixedDirectory(stateNamespace, 'local receiver custody namespace');
      createFixedDirectory(records, 'local receiver records directory');
      const recordFileName = contentFileName(sha256({ deliveryId: envelope.deliveryId, receiverId }));
      writeExclusive(path.join(records, recordFileName), record, MAX_RECORD_CANONICAL_BYTES, 'CUSTODY_RECORD');
      const receiverReceipt = buildReceiverReceipt(senderReceipt, record, recordFileName);
      return { acknowledgement: copy(acknowledgement), receiverReceipt, recordFileName };
    },

    reload(input) {
      exactKeys(input, ['recordFileName', 'receiverPolicy', 'loadedAt'], 'local receiver reload input');
      const loadedAt = timestamp(input.loadedAt, 'local receiver loadedAt');
      const record = readRecord(input.recordFileName);
      const validated = validateCustodyRecord(record, copy(input.receiverPolicy), receiverId);
      if (Date.parse(loadedAt) < Date.parse(validated.record.receivedAt)) fail('INVALID_TIME', 'local receiver reload cannot predate custody receive');
      const receipt = buildReloadReceipt(validated.record, input.recordFileName, loadedAt);
      validateReloadReceipt(validated.record, receipt);
      return receipt;
    }
  };
}

module.exports = {
  ENVELOPE_SCHEMA,
  SENDER_RECEIPT_SCHEMA,
  CUSTODY_RECORD_SCHEMA,
  RECEIVER_RECEIPT_SCHEMA,
  RELOAD_RECEIPT_SCHEMA,
  VERSION,
  STATUS,
  NAMESPACE,
  OUTBOUND_DIRECTORY,
  RECORDS_DIRECTORY,
  SEND_CONFIRMATION,
  RECEIVE_CONFIRMATION,
  MAX_ENVELOPE_CANONICAL_BYTES,
  MAX_RECORD_CANONICAL_BYTES,
  LocalReceiverCustodyError,
  stableStringify,
  sha256,
  assessmentRef,
  policyRef,
  buildEnvelope,
  validateEnvelope,
  buildSenderReceipt,
  validateSenderReceipt,
  buildCustodyRecord,
  validateCustodyRecord,
  buildReceiverReceipt,
  validateReceiverReceipt,
  buildReloadReceipt,
  validateReloadReceipt,
  createSender,
  createReceiver
};
