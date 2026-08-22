#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const Custody = require('../model-shadow-review-challenge-transition-local-receiver-custody/model-shadow-review-challenge-transition-local-receiver-custody');
const ReceiverAck = require('../model-shadow-review-challenge-transition-receiver-ack/model-shadow-review-challenge-transition-receiver-ack');

const CHALLENGE_SCHEMA = 'axm.model-shadow-review-challenge-transition-local-possession-challenge/v1';
const RESPONSE_RECORD_SCHEMA = 'axm.model-shadow-review-challenge-transition-local-possession-response-record/v1';
const RECEIPT_SCHEMA = 'axm.model-shadow-review-challenge-transition-local-possession-receipt/v1';
const RELOAD_RECEIPT_SCHEMA = 'axm.model-shadow-review-challenge-transition-local-possession-reload-receipt/v1';
const VERSION = '1.3.0';
const STATUS = 'TEST';
const NAMESPACE = 'model-shadow-review-challenge-transition-local-possession-challenge';
const ANSWERS_DIRECTORY = 'answers';
const ANSWER_CONFIRMATION = 'ANSWER_EXACT_LOCAL_RECEIVER_POSSESSION_CHALLENGE';
const MAX_CHALLENGE_WINDOW_MS = 24 * 60 * 60 * 1000;
const MAX_CHALLENGE_CANONICAL_BYTES = 64 * 1024;
const MAX_RESPONSE_CANONICAL_BYTES = 4 * 1024 * 1024;
const DIGEST = /^sha256:[a-f0-9]{64}$/;
const CONTENT_FILE = /^[a-f0-9]{64}\.json$/;

class LocalPossessionChallengeError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'LocalPossessionChallengeError';
    this.code = code;
  }
}

function fail(code, message) {
  throw new LocalPossessionChallengeError(code, message);
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

function canonicalBytes(value) {
  return Buffer.byteLength(stableStringify(value), 'utf8');
}

function assertCanonicalBound(value, maximum, code, label) {
  if (canonicalBytes(value) > maximum) fail(code, label + ' exceeds the bounded canonical byte limit');
}

function parsePrivateKey(privateKeyPem, label) {
  if (typeof privateKeyPem !== 'string' || !privateKeyPem || privateKeyPem.length > 8192) fail('PRIVATE_KEY_INVALID', label + ' must be bounded non-empty PEM text');
  let key;
  try { key = crypto.createPrivateKey(privateKeyPem); } catch (error) { fail('PRIVATE_KEY_INVALID', label + ' is invalid'); }
  if (key.asymmetricKeyType !== 'ed25519') fail('PRIVATE_KEY_INVALID', label + ' must be Ed25519');
  const canonical = key.export({ type: 'pkcs8', format: 'pem' }).toString();
  if (canonical !== privateKeyPem) fail('PRIVATE_KEY_INVALID', label + ' must use canonical Ed25519 PKCS8 PEM');
  return key;
}

function parsePublicKey(publicKeyPem, label) {
  if (typeof publicKeyPem !== 'string' || !publicKeyPem || publicKeyPem.length > 8192) fail('PUBLIC_KEY_INVALID', label + ' must be bounded non-empty PEM text');
  let key;
  try { key = crypto.createPublicKey(publicKeyPem); } catch (error) { fail('PUBLIC_KEY_INVALID', label + ' is invalid'); }
  if (key.asymmetricKeyType !== 'ed25519') fail('PUBLIC_KEY_INVALID', label + ' must be Ed25519');
  const canonical = key.export({ type: 'spki', format: 'pem' }).toString();
  if (canonical !== publicKeyPem) fail('PUBLIC_KEY_INVALID', label + ' must use canonical Ed25519 SPKI PEM');
  return key;
}

function publicKeyFingerprint(key) {
  return 'sha256:' + crypto.createHash('sha256').update(key.export({ type: 'spki', format: 'der' })).digest('hex');
}

function assertPrivateKeyObject(key, label) {
  if (!key || key.type !== 'private' || key.asymmetricKeyType !== 'ed25519') fail('PRIVATE_KEY_INVALID', label + ' must be an Ed25519 private KeyObject');
  return key;
}

function assertPrivateKeyMatches(privateKey, publicKey, code, message) {
  const derived = crypto.createPublicKey(privateKey).export({ type: 'spki', format: 'der' });
  const declared = publicKey.export({ type: 'spki', format: 'der' });
  if (derived.length !== declared.length || !crypto.timingSafeEqual(derived, declared)) fail(code, message);
}

function sign(privateKey, value) {
  return crypto.sign(null, Buffer.from(stableStringify(value), 'utf8'), privateKey).toString('base64');
}

function verifySignature(publicKey, value, signature, label) {
  if (typeof signature !== 'string' || Buffer.from(signature, 'base64').toString('base64') !== signature || Buffer.from(signature, 'base64').length !== 64) {
    fail('SIGNATURE_INVALID', label + ' must be one canonical Ed25519 signature');
  }
  let pass = false;
  try { pass = crypto.verify(null, Buffer.from(stableStringify(value), 'utf8'), publicKey, Buffer.from(signature, 'base64')); } catch (error) { pass = false; }
  if (!pass) fail('SIGNATURE_INVALID', label + ' verification failed');
}

function nonce(value) {
  const result = exactText(value, 'challenge nonce', 44);
  const bytes = Buffer.from(result, 'base64');
  if (bytes.length !== 32 || bytes.toString('base64') !== result) fail('NONCE_INVALID', 'challenge nonce must be exactly 32 canonical base64 bytes');
  return result;
}

function rootPath(value) {
  const supplied = exactText(value, 'local possession state root', 32767);
  if (!path.isAbsolute(supplied)) fail('STATE_ROOT_INVALID', 'local possession state root must be absolute');
  const resolved = path.resolve(supplied);
  if (resolved === path.parse(resolved).root) fail('STATE_ROOT_INVALID', 'local possession state root cannot be a filesystem root');
  let stat;
  try { stat = fs.lstatSync(resolved); } catch (error) { fail('STATE_ROOT_INVALID', 'local possession state root must already exist'); }
  if (!stat.isDirectory() || stat.isSymbolicLink()) fail('STATE_ROOT_INVALID', 'local possession state root must be a real directory and not a symbolic link');
  return resolved;
}

function assertDirectoryNotLink(directoryPath, label) {
  let stat;
  try { stat = fs.lstatSync(directoryPath); } catch (error) { fail('STATE_ROOT_INVALID', label + ' is missing or unreadable'); }
  if (!stat.isDirectory() || stat.isSymbolicLink()) fail('STATE_ROOT_INVALID', label + ' must be a real directory and not a symbolic link');
}

function createFixedDirectory(directoryPath, label) {
  try { fs.mkdirSync(directoryPath); } catch (error) {
    if (error.code !== 'EEXIST') fail('WRITE_FAILED', label + ' cannot be created: ' + error.message);
  }
  assertDirectoryNotLink(directoryPath, label);
}

function fixedContentFile(value, label) {
  const result = exactText(value, label, 69);
  if (!CONTENT_FILE.test(result)) fail('PATH_REFUSED', label + ' must be one content-addressed JSON filename');
  return result;
}

function contentFileName(digestValue) {
  return digestValue.slice('sha256:'.length) + '.json';
}

function answerFileName(challengeId, receiverId) {
  return contentFileName(sha256({ challengeId, receiverId }));
}

function writeExclusive(filePath, value) {
  assertCanonicalBound(value, MAX_RESPONSE_CANONICAL_BYTES, 'RESPONSE_TOO_LARGE', 'local possession response record');
  let descriptor;
  try { descriptor = fs.openSync(filePath, 'wx', 0o600); } catch (error) {
    if (error.code === 'EEXIST') fail('CHALLENGE_ALREADY_ANSWERED', 'refusing to overwrite or replay an existing local possession response');
    fail('RESPONSE_WRITE_FAILED', 'exclusive response create failed: ' + error.message);
  }
  let writeError = null;
  try {
    fs.writeFileSync(descriptor, stableStringify(value) + '\n', { encoding: 'utf8' });
    fs.fsyncSync(descriptor);
  } catch (error) { writeError = error; } finally {
    try { fs.closeSync(descriptor); } catch (error) { if (!writeError) writeError = error; }
  }
  if (writeError) fail('RESPONSE_DURABILITY_UNCERTAIN', 'response write or fsync did not complete; fail-closed state remains for steward inspection: ' + writeError.message);
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

function challengeTruth() {
  return {
    nonceBoundToExactCustodyReference: true,
    receiverPolicyReferenceBound: true,
    challengerKeyPossessionSignaturePresent: true,
    challengerIdentityAuthenticated: false,
    challengeTimeExternallyTrusted: false,
    receiverPossessionProvenByChallengeAlone: false,
    executionAuthorized: false,
    adoptionAuthorized: false,
    automaticCanon: false
  };
}

function challengeCore(challenge) {
  return withoutFields(challenge, ['challengeDigest', 'challengeSignature']);
}

function challengeSigningPayload(challenge) {
  return withoutFields(challenge, ['challengeSignature']);
}

function buildChallenge(input, challengerId, challengerPrivateKey) {
  exactKeys(input, ['receiverId', 'custodyRecordRef', 'receiverPolicyRef', 'nonce', 'issuedAt', 'expiresAt'], 'local possession challenge input');
  const exactChallengerId = exactText(challengerId, 'challenge challenger id', 120);
  assertPrivateKeyObject(challengerPrivateKey, 'challenger private key');
  const receiverId = exactText(input.receiverId, 'challenge receiver id', 120);
  const custodyRecordRef = reference(input.custodyRecordRef, 'challenge custody record reference', Custody.CUSTODY_RECORD_SCHEMA);
  const receiverPolicyRef = reference(input.receiverPolicyRef, 'challenge receiver policy reference', ReceiverAck.POLICY_SCHEMA);
  const challengeNonce = nonce(input.nonce);
  const issuedAt = timestamp(input.issuedAt, 'challenge issuedAt');
  const expiresAt = timestamp(input.expiresAt, 'challenge expiresAt');
  const windowMs = Date.parse(expiresAt) - Date.parse(issuedAt);
  if (windowMs <= 0 || windowMs > MAX_CHALLENGE_WINDOW_MS) fail('INVALID_TIME', 'challenge expiry must follow issue within the bounded challenge window');
  const challengerPublicKey = crypto.createPublicKey(challengerPrivateKey);
  const challenge = {
    schema: CHALLENGE_SCHEMA,
    version: VERSION,
    challengeId: 'local-possession-challenge:' + sha256({ challengerId: exactChallengerId, receiverId, custodyRecordRef, nonce: challengeNonce }).slice(7),
    challengerId: exactChallengerId,
    challengerKeyFingerprint: publicKeyFingerprint(challengerPublicKey),
    receiverId,
    issuedAt,
    expiresAt,
    nonce: challengeNonce,
    custodyRecordRef,
    receiverPolicyRef,
    status: STATUS,
    challengeSignatureAlgorithm: 'Ed25519',
    truth: challengeTruth(),
    challengeDigest: null,
    challengeSignature: ''
  };
  challenge.challengeDigest = sha256(challengeCore(challenge));
  challenge.challengeSignature = sign(challengerPrivateKey, challengeSigningPayload(challenge));
  assertCanonicalBound(challenge, MAX_CHALLENGE_CANONICAL_BYTES, 'CHALLENGE_TOO_LARGE', 'local possession challenge');
  return challenge;
}

function validateChallenge(value, options) {
  assertCanonicalBound(value, MAX_CHALLENGE_CANONICAL_BYTES, 'CHALLENGE_TOO_LARGE', 'local possession challenge');
  exactKeys(value, [
    'schema', 'version', 'challengeId', 'challengerId', 'challengerKeyFingerprint',
    'receiverId', 'issuedAt', 'expiresAt', 'nonce', 'custodyRecordRef',
    'receiverPolicyRef', 'status', 'challengeSignatureAlgorithm', 'truth',
    'challengeDigest', 'challengeSignature'
  ], 'local possession challenge');
  if (value.schema !== CHALLENGE_SCHEMA || value.version !== VERSION || value.status !== STATUS) fail('CHALLENGE_INVALID', 'challenge identity mismatch');
  const challengerId = exactText(value.challengerId, 'challenge challenger id', 120);
  const receiverId = exactText(value.receiverId, 'challenge receiver id', 120);
  if (challengerId !== options.challengerId) fail('CHALLENGER_MISMATCH', 'challenge challenger does not match configured challenger');
  if (receiverId !== options.receiverId) fail('RECEIVER_MISMATCH', 'challenge receiver does not match configured receiver');
  const custodyRecordRef = reference(value.custodyRecordRef, 'challenge custody record reference', Custody.CUSTODY_RECORD_SCHEMA);
  const receiverPolicyRef = reference(value.receiverPolicyRef, 'challenge receiver policy reference', ReceiverAck.POLICY_SCHEMA);
  const challengeNonce = nonce(value.nonce);
  const expectedId = 'local-possession-challenge:' + sha256({ challengerId, receiverId, custodyRecordRef, nonce: challengeNonce }).slice(7);
  if (exactText(value.challengeId, 'challenge id', 180) !== expectedId) fail('CHALLENGE_INVALID', 'challenge id mismatch');
  if (digest(value.challengerKeyFingerprint, 'challenge challenger key fingerprint') !== publicKeyFingerprint(options.challengerPublicKey)) fail('CHALLENGER_MISMATCH', 'challenge key fingerprint mismatch');
  const issuedAt = timestamp(value.issuedAt, 'challenge issuedAt');
  const expiresAt = timestamp(value.expiresAt, 'challenge expiresAt');
  const windowMs = Date.parse(expiresAt) - Date.parse(issuedAt);
  if (windowMs <= 0 || windowMs > MAX_CHALLENGE_WINDOW_MS) fail('INVALID_TIME', 'challenge expiry must follow issue within the bounded challenge window');
  if (value.challengeSignatureAlgorithm !== 'Ed25519') fail('CHALLENGE_INVALID', 'challenge signature algorithm mismatch');
  if (stableStringify(value.truth) !== stableStringify(challengeTruth())) fail('CHALLENGE_INVALID', 'challenge truth boundary mismatch');
  if (digest(value.challengeDigest, 'challenge digest') !== sha256(challengeCore(value))) fail('CHALLENGE_INVALID', 'challenge digest mismatch');
  verifySignature(options.challengerPublicKey, challengeSigningPayload(value), value.challengeSignature, 'challenge signature');
  return copy(value);
}

function responseTruth() {
  return {
    custodyRecordRereadFromLocalFilesystem: true,
    custodyRecordDigestVerified: true,
    custodyRecordSignatureVerified: true,
    storedAssessmentReceiptSelfDigestVerified: true,
    receiverPolicyVerified: true,
    challengerSignatureVerified: true,
    nonceBoundToExactCustodyRecord: true,
    receiverResponseSignatureVerified: true,
    responseExclusiveCreateCompleted: true,
    responseFileFsyncCompleted: true,
    replayRefusedWhileResponseFilePresent: true,
    freshProcessProvenByRecord: false,
    independentlyOperatedChallengerProven: false,
    independentlyOperatedReceiverProven: false,
    actualNetworkTransportProven: false,
    otherHostDeliveryProven: false,
    challengeTimeExternallyTrusted: false,
    retentionDurationProven: false,
    durabilityBeyondReportedFileFsyncProven: false,
    protectedMonotonicStateProven: false,
    deletionOrRollbackPrevented: false,
    humanReviewProven: false,
    providerExecutionProven: false,
    executionAuthorized: false,
    adoptionAuthorized: false,
    automaticCanon: false
  };
}

function responseCore(response) {
  return withoutFields(response, ['responseDigest', 'responseSignature']);
}

function responseSigningPayload(response) {
  return withoutFields(response, ['responseSignature']);
}

function custodyRecordReference(record) {
  return { id: record.custodyRecordId, schema: record.schema, sha256: record.recordDigest };
}

function policyReference(policy) {
  return { id: policy.policyId, schema: policy.schema, sha256: policy.policyDigest };
}

function buildResponseRecord(record, policy, challenge, answeredAt, receiverPrivateKey) {
  assertPrivateKeyObject(receiverPrivateKey, 'receiver private key');
  const response = {
    schema: RESPONSE_RECORD_SCHEMA,
    version: VERSION,
    responseId: 'local-possession-response:' + sha256({ challengeId: challenge.challengeId, receiverId: record.receiverId }).slice(7),
    answeredAt,
    status: STATUS,
    challenge: copy(challenge),
    custodyRecordRef: custodyRecordReference(record),
    assessmentRef: copy(record.assessmentRef),
    rosterRef: copy(record.rosterRef),
    receiverPolicyRef: policyReference(policy),
    receiverId: record.receiverId,
    challengerId: challenge.challengerId,
    storedAssessmentReceiptDigest: record.storedAssessmentReceiptDigest,
    responseSignatureAlgorithm: 'Ed25519',
    truth: responseTruth(),
    responseDigest: null,
    responseSignature: ''
  };
  response.responseDigest = sha256(responseCore(response));
  response.responseSignature = sign(receiverPrivateKey, responseSigningPayload(response));
  assertCanonicalBound(response, MAX_RESPONSE_CANONICAL_BYTES, 'RESPONSE_TOO_LARGE', 'local possession response record');
  return response;
}

function validateResponseRecord(value, context) {
  assertCanonicalBound(value, MAX_RESPONSE_CANONICAL_BYTES, 'RESPONSE_TOO_LARGE', 'local possession response record');
  exactKeys(value, [
    'schema', 'version', 'responseId', 'answeredAt', 'status', 'challenge',
    'custodyRecordRef', 'assessmentRef', 'rosterRef', 'receiverPolicyRef',
    'receiverId', 'challengerId', 'storedAssessmentReceiptDigest',
    'responseSignatureAlgorithm', 'truth', 'responseDigest', 'responseSignature'
  ], 'local possession response record');
  if (value.schema !== RESPONSE_RECORD_SCHEMA || value.version !== VERSION || value.status !== STATUS) fail('RESPONSE_INVALID', 'response identity mismatch');
  const challenge = validateChallenge(copy(value.challenge), context);
  if (stableStringify(challenge) !== stableStringify(context.challenge)) fail('CHALLENGE_MISMATCH', 'stored response challenge does not match expected challenge');
  const expectedResponseId = 'local-possession-response:' + sha256({ challengeId: challenge.challengeId, receiverId: context.receiverId }).slice(7);
  if (exactText(value.responseId, 'response id', 180) !== expectedResponseId) fail('RESPONSE_INVALID', 'response id mismatch');
  const answeredAt = timestamp(value.answeredAt, 'response answeredAt');
  if (Date.parse(answeredAt) < Date.parse(challenge.issuedAt) || Date.parse(answeredAt) > Date.parse(challenge.expiresAt)) fail('INVALID_TIME', 'response time is outside the challenge window');
  const recordRef = reference(value.custodyRecordRef, 'response custody record reference', Custody.CUSTODY_RECORD_SCHEMA);
  if (!sameReference(recordRef, custodyRecordReference(context.record))) fail('CUSTODY_RECORD_MISMATCH', 'response custody reference mismatch');
  if (!sameReference(recordRef, challenge.custodyRecordRef)) fail('CUSTODY_RECORD_MISMATCH', 'response and challenge custody references differ');
  if (!sameReference(reference(value.assessmentRef, 'response assessment reference'), context.record.assessmentRef)) fail('RESPONSE_INVALID', 'response assessment reference mismatch');
  if (!sameReference(reference(value.rosterRef, 'response roster reference'), context.record.rosterRef)) fail('RESPONSE_INVALID', 'response roster reference mismatch');
  if (!sameReference(reference(value.receiverPolicyRef, 'response policy reference', ReceiverAck.POLICY_SCHEMA), policyReference(context.policy))) fail('POLICY_MISMATCH', 'response policy reference mismatch');
  if (!sameReference(challenge.receiverPolicyRef, policyReference(context.policy))) fail('POLICY_MISMATCH', 'challenge policy reference mismatch');
  if (exactText(value.receiverId, 'response receiver id', 120) !== context.receiverId) fail('RECEIVER_MISMATCH', 'response receiver mismatch');
  if (exactText(value.challengerId, 'response challenger id', 120) !== context.challengerId) fail('CHALLENGER_MISMATCH', 'response challenger mismatch');
  if (digest(value.storedAssessmentReceiptDigest, 'response stored assessment receipt digest') !== context.record.storedAssessmentReceiptDigest) fail('RESPONSE_INVALID', 'response stored assessment receipt digest mismatch');
  if (value.responseSignatureAlgorithm !== 'Ed25519') fail('RESPONSE_INVALID', 'response signature algorithm mismatch');
  if (stableStringify(value.truth) !== stableStringify(responseTruth())) fail('RESPONSE_INVALID', 'response truth boundary mismatch');
  if (digest(value.responseDigest, 'response digest') !== sha256(responseCore(value))) fail('RESPONSE_INVALID', 'response digest mismatch');
  verifySignature(context.receiverPublicKey, responseSigningPayload(value), value.responseSignature, 'response signature');
  return copy(value);
}

function publicTruth() {
  return {
    custodyRecordRereadAndVerified: true,
    signedNonceChallengeVerified: true,
    receiverSignedResponseVerified: true,
    responseExclusiveCreateAndFileFsyncReported: true,
    replayRefusedWhileResponseFilePresent: true,
    rawReceiverLabelEmbedded: false,
    rawChallengerLabelEmbedded: false,
    rawPublicKeyEmbedded: false,
    rawSignatureEmbedded: false,
    fullCustodyRecordEmbedded: false,
    storedAssessmentReceiptEmbedded: false,
    machinePathEmbedded: false,
    independentPartiesProven: false,
    networkOrOtherHostProven: false,
    trustedTimeProven: false,
    retentionDurationProven: false,
    deletionOrRollbackPrevented: false,
    executionAuthorized: false,
    adoptionAuthorized: false,
    automaticCanon: false
  };
}

function buildReceipt(response, responseFileName) {
  const receipt = {
    schema: RECEIPT_SCHEMA,
    version: VERSION,
    receiptId: 'local-possession-receipt:' + sha256({ responseId: response.responseId }).slice(7),
    answeredAt: response.answeredAt,
    status: STATUS,
    challengeRef: { id: response.challenge.challengeId, schema: response.challenge.schema, sha256: response.challenge.challengeDigest },
    responseRef: { id: response.responseId, schema: response.schema, sha256: response.responseDigest },
    custodyRecordRef: copy(response.custodyRecordRef),
    assessmentRef: copy(response.assessmentRef),
    receiverPolicyRef: copy(response.receiverPolicyRef),
    receiverIdDigest: sha256({ receiverId: response.receiverId }),
    challengerIdDigest: sha256({ challengerId: response.challengerId }),
    nonceDigest: sha256({ nonce: response.challenge.nonce }),
    responseFileName: fixedContentFile(responseFileName, 'response file name'),
    truth: publicTruth(),
    receiptDigest: null
  };
  receipt.receiptDigest = sha256(withoutFields(receipt, ['receiptDigest']));
  return receipt;
}

function validateReceipt(response, receipt) {
  exactKeys(receipt, [
    'schema', 'version', 'receiptId', 'answeredAt', 'status', 'challengeRef',
    'responseRef', 'custodyRecordRef', 'assessmentRef', 'receiverPolicyRef',
    'receiverIdDigest', 'challengerIdDigest', 'nonceDigest', 'responseFileName',
    'truth', 'receiptDigest'
  ], 'local possession receipt');
  if (receipt.schema !== RECEIPT_SCHEMA || receipt.version !== VERSION || receipt.status !== STATUS) fail('RECEIPT_INVALID', 'receipt identity mismatch');
  const expected = buildReceipt(response, receipt.responseFileName);
  if (stableStringify(expected) !== stableStringify(receipt)) fail('RECEIPT_INVALID', 'receipt does not exact-rebuild');
  return expected;
}

function reloadTruth() {
  const truth = publicTruth();
  truth.responseReloadedFromLocalFilesystem = true;
  truth.custodyRecordReloadedFromLocalFilesystem = true;
  truth.freshProcessProvenByReceipt = false;
  return truth;
}

function buildReloadReceipt(response, responseFileName, custodyRecordFileName, loadedAt) {
  const receipt = {
    schema: RELOAD_RECEIPT_SCHEMA,
    version: VERSION,
    reloadReceiptId: 'local-possession-reload:' + sha256({ responseId: response.responseId, loadedAt }).slice(7),
    loadedAt,
    status: STATUS,
    challengeRef: { id: response.challenge.challengeId, schema: response.challenge.schema, sha256: response.challenge.challengeDigest },
    responseRef: { id: response.responseId, schema: response.schema, sha256: response.responseDigest },
    custodyRecordRef: copy(response.custodyRecordRef),
    assessmentRef: copy(response.assessmentRef),
    receiverPolicyRef: copy(response.receiverPolicyRef),
    receiverIdDigest: sha256({ receiverId: response.receiverId }),
    challengerIdDigest: sha256({ challengerId: response.challengerId }),
    nonceDigest: sha256({ nonce: response.challenge.nonce }),
    responseFileName: fixedContentFile(responseFileName, 'reload response file name'),
    custodyRecordFileName: fixedContentFile(custodyRecordFileName, 'reload custody record file name'),
    truth: reloadTruth(),
    receiptDigest: null
  };
  receipt.receiptDigest = sha256(withoutFields(receipt, ['receiptDigest']));
  return receipt;
}

function validateReloadReceipt(response, receipt) {
  exactKeys(receipt, [
    'schema', 'version', 'reloadReceiptId', 'loadedAt', 'status', 'challengeRef',
    'responseRef', 'custodyRecordRef', 'assessmentRef', 'receiverPolicyRef',
    'receiverIdDigest', 'challengerIdDigest', 'nonceDigest', 'responseFileName',
    'custodyRecordFileName', 'truth', 'receiptDigest'
  ], 'local possession reload receipt');
  if (receipt.schema !== RELOAD_RECEIPT_SCHEMA || receipt.version !== VERSION || receipt.status !== STATUS) fail('RELOAD_RECEIPT_INVALID', 'reload receipt identity mismatch');
  const expected = buildReloadReceipt(response, receipt.responseFileName, receipt.custodyRecordFileName, timestamp(receipt.loadedAt, 'reload loadedAt'));
  if (stableStringify(expected) !== stableStringify(receipt)) fail('RELOAD_RECEIPT_INVALID', 'reload receipt does not exact-rebuild');
  return expected;
}

function createChallenger(options) {
  exactKeys(options, ['challengerId', 'privateKeyPem'], 'local possession challenger options');
  const challengerId = exactText(options.challengerId, 'configured challenger id', 120);
  const privateKey = parsePrivateKey(options.privateKeyPem, 'challenger private key');
  return {
    issue(input) {
      return buildChallenge(copy(input), challengerId, privateKey);
    }
  };
}

function createReceiver(options) {
  exactKeys(options, ['stateRoot', 'receiverId', 'privateKeyPem', 'challengerId', 'challengerPublicKeyPem'], 'local possession receiver options');
  const stateRoot = rootPath(options.stateRoot);
  const receiverId = exactText(options.receiverId, 'configured receiver id', 120);
  const challengerId = exactText(options.challengerId, 'configured challenger id', 120);
  const challengerPublicKey = parsePublicKey(options.challengerPublicKeyPem, 'challenger public key');
  const receiverPrivateKey = options.privateKeyPem === null ? null : parsePrivateKey(options.privateKeyPem, 'receiver private key');
  const custodyNamespace = path.join(stateRoot, Custody.NAMESPACE);
  const custodyRecords = path.join(custodyNamespace, Custody.RECORDS_DIRECTORY);
  const namespace = path.join(stateRoot, NAMESPACE);
  const answers = path.join(namespace, ANSWERS_DIRECTORY);

  function readCustodyRecord(recordFileName) {
    assertDirectoryNotLink(stateRoot, 'local possession state root');
    assertDirectoryNotLink(custodyNamespace, 'v1.2 custody namespace');
    assertDirectoryNotLink(custodyRecords, 'v1.2 custody records directory');
    return readCanonicalJson(path.join(custodyRecords, fixedContentFile(recordFileName, 'custody record file name')), Custody.MAX_RECORD_CANONICAL_BYTES, 'CUSTODY_RECORD', 'v1.2 custody record');
  }

  function readResponse(responseFileName) {
    assertDirectoryNotLink(stateRoot, 'local possession state root');
    assertDirectoryNotLink(namespace, 'local possession namespace');
    assertDirectoryNotLink(answers, 'local possession answers directory');
    return readCanonicalJson(path.join(answers, fixedContentFile(responseFileName, 'response file name')), MAX_RESPONSE_CANONICAL_BYTES, 'RESPONSE', 'local possession response record');
  }

  function buildContext(record, receiverPolicy, challenge) {
    let validated;
    try { validated = Custody.validateCustodyRecord(record, copy(receiverPolicy), receiverId); } catch (error) {
      fail('CUSTODY_RECORD_INVALID', 'v1.2 custody record exact verification failed: ' + error.message);
    }
    const receiverPublicKey = parsePublicKey(validated.receiver.publicKeyPem, 'declared receiver public key');
    const context = { receiverId, challengerId, challengerPublicKey, receiverPublicKey, record: validated.record, policy: validated.policy, challenge: copy(challenge) };
    const validatedChallenge = validateChallenge(copy(challenge), context);
    context.challenge = validatedChallenge;
    if (!sameReference(validatedChallenge.custodyRecordRef, custodyRecordReference(validated.record))) fail('CUSTODY_RECORD_MISMATCH', 'challenge custody record reference mismatch');
    if (!sameReference(validatedChallenge.receiverPolicyRef, policyReference(validated.policy))) fail('POLICY_MISMATCH', 'challenge receiver policy reference mismatch');
    if (Date.parse(validatedChallenge.issuedAt) <= Date.parse(validated.record.receivedAt)) fail('INVALID_TIME', 'challenge must be declared later than custody receipt');
    if (Date.parse(validatedChallenge.expiresAt) > Date.parse(validated.policy.expiresAt)) fail('INVALID_TIME', 'challenge expiry exceeds receiver policy expiry');
    return context;
  }

  return {
    answer(input) {
      exactKeys(input, ['confirmation', 'recordFileName', 'receiverPolicy', 'challenge', 'answeredAt'], 'local possession answer input');
      if (input.confirmation !== ANSWER_CONFIRMATION) fail('ANSWER_CONFIRMATION_REQUIRED', 'exact local possession answer confirmation is required');
      if (!receiverPrivateKey) fail('PRIVATE_KEY_REQUIRED', 'receiver private key is required to answer but not reload');
      const record = readCustodyRecord(input.recordFileName);
      const context = buildContext(record, input.receiverPolicy, input.challenge);
      assertPrivateKeyMatches(receiverPrivateKey, context.receiverPublicKey, 'PRIVATE_KEY_MISMATCH', 'receiver private key does not match the custody policy receiver key');
      const answeredAt = timestamp(input.answeredAt, 'local possession answeredAt');
      if (Date.parse(answeredAt) < Date.parse(context.challenge.issuedAt) || Date.parse(answeredAt) > Date.parse(context.challenge.expiresAt)) fail('INVALID_TIME', 'answer time is outside the challenge window');
      const response = buildResponseRecord(context.record, context.policy, context.challenge, answeredAt, receiverPrivateKey);
      validateResponseRecord(response, context);
      assertDirectoryNotLink(stateRoot, 'local possession state root');
      createFixedDirectory(namespace, 'local possession namespace');
      createFixedDirectory(answers, 'local possession answers directory');
      const responseFileName = answerFileName(context.challenge.challengeId, receiverId);
      writeExclusive(path.join(answers, responseFileName), response);
      const receipt = buildReceipt(response, responseFileName);
      validateReceipt(response, receipt);
      return { responsePackage: copy(response), receipt, responseFileName };
    },

    reload(input) {
      exactKeys(input, ['responseFileName', 'recordFileName', 'receiverPolicy', 'challenge', 'loadedAt'], 'local possession reload input');
      const loadedAt = timestamp(input.loadedAt, 'local possession loadedAt');
      const record = readCustodyRecord(input.recordFileName);
      const context = buildContext(record, input.receiverPolicy, input.challenge);
      const response = readResponse(input.responseFileName);
      const validatedResponse = validateResponseRecord(response, context);
      if (Date.parse(loadedAt) < Date.parse(validatedResponse.answeredAt)) fail('INVALID_TIME', 'reload cannot predate the response');
      const receipt = buildReloadReceipt(validatedResponse, input.responseFileName, input.recordFileName, loadedAt);
      validateReloadReceipt(validatedResponse, receipt);
      return receipt;
    }
  };
}

module.exports = {
  CHALLENGE_SCHEMA,
  RESPONSE_RECORD_SCHEMA,
  RECEIPT_SCHEMA,
  RELOAD_RECEIPT_SCHEMA,
  VERSION,
  STATUS,
  NAMESPACE,
  ANSWERS_DIRECTORY,
  ANSWER_CONFIRMATION,
  MAX_CHALLENGE_WINDOW_MS,
  MAX_CHALLENGE_CANONICAL_BYTES,
  MAX_RESPONSE_CANONICAL_BYTES,
  LocalPossessionChallengeError,
  stableStringify,
  sha256,
  buildChallenge,
  validateChallenge,
  challengeSigningPayload,
  buildResponseRecord,
  validateResponseRecord,
  responseSigningPayload,
  buildReceipt,
  validateReceipt,
  buildReloadReceipt,
  validateReloadReceipt,
  createChallenger,
  createReceiver
};
