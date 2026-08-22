#!/usr/bin/env node
'use strict';

const assert = require('assert');
const childProcess = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Custody = require('./model-shadow-review-challenge-transition-local-receiver-custody');
const Fixture = require('./selftest-fixture');
const ReceiverAck = require('../model-shadow-review-challenge-transition-receiver-ack/model-shadow-review-challenge-transition-receiver-ack');
const ReceiverFixture = require('../model-shadow-review-challenge-transition-receiver-ack/selftest-fixture');

let checks = 0;
function check(value, label) {
  assert.ok(value, label);
  checks += 1;
  console.log('PASS ' + label);
}
function equal(actual, expected, label) {
  assert.deepStrictEqual(actual, expected, label);
  checks += 1;
  console.log('PASS ' + label);
}
function throwsCode(fn, code, label) {
  assert.throws(fn, error => error && error.code === code, label);
  checks += 1;
  console.log('PASS ' + label);
}
function copy(value) {
  return JSON.parse(JSON.stringify(value));
}
function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}
function writeCanonical(file, value) {
  fs.writeFileSync(file, Custody.stableStringify(value) + '\n', 'utf8');
}
function runChild(action, options, input) {
  const child = childProcess.spawnSync(process.execPath, [path.join(__dirname, 'selftest-child.js')], {
    input: JSON.stringify({ action, options, input }),
    encoding: 'utf8',
    windowsHide: true,
    timeout: 120000
  });
  if (child.status !== 0) throw new Error('child ' + action + ' failed: ' + String(child.stderr || child.stdout).trim());
  return JSON.parse(child.stdout);
}

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'axm-local-receiver-custody-'));
try {
  const fixture = Fixture.buildFixture(tempRoot);
  const receiver = fixture.receiver;
  const roots = fixture.roots;
  const sender = Custody.createSender({ transportRoot: roots.transport });
  const namespace = path.join(roots.transport, Custody.NAMESPACE);
  const outbound = path.join(namespace, Custody.OUTBOUND_DIRECTORY);

  equal(Custody.VERSION, '1.2.0', 'module version is exact');
  equal(Custody.STATUS, 'TEST', 'module status remains TEST');
  equal(Custody.MAX_ENVELOPE_CANONICAL_BYTES, 48 * 1024 * 1024, 'envelope canonical byte bound is exact');
  equal(Custody.MAX_RECORD_CANONICAL_BYTES, 48 * 1024 * 1024, 'record canonical byte bound is exact');
  equal(Custody.SEND_CONFIRMATION, 'WRITE_EXACT_MODEL_SHADOW_ASSESSMENT_TO_LOCAL_RECEIVER_OUTBOX', 'send confirmation phrase is exact');
  equal(Custody.RECEIVE_CONFIRMATION, 'READ_AND_PERSIST_EXACT_MODEL_SHADOW_ASSESSMENT_IN_LOCAL_RECEIVER_CUSTODY', 'receive confirmation phrase is exact');

  const noSendConfirmation = Fixture.senderInput(receiver, receiver.keys[0].receiverId, 'no-confirmation');
  noSendConfirmation.confirmation = 'WRITE';
  throwsCode(() => sender.send(noSendConfirmation), 'SEND_CONFIRMATION_REQUIRED', 'sender write is refused without exact confirmation');
  equal(fs.existsSync(namespace), false, 'failed send confirmation creates no transport namespace');

  const alphaInput = Fixture.senderInput(receiver, receiver.keys[0].receiverId, 'alpha');
  const betaInput = Fixture.senderInput(receiver, receiver.keys[1].receiverId, 'beta', '2026-08-20T15:06:40.000Z');
  const alphaSender = sender.send(alphaInput);
  const betaSender = sender.send(betaInput);
  equal(alphaSender.schema, Custody.SENDER_RECEIPT_SCHEMA, 'alpha sender receipt schema is exact');
  equal(betaSender.schema, Custody.SENDER_RECEIPT_SCHEMA, 'beta sender receipt schema is exact');
  check(alphaSender.envelopeDigest !== betaSender.envelopeDigest, 'receiver-specific envelopes have distinct digests');
  check(/^[a-f0-9]{64}\.json$/.test(alphaSender.envelopeFileName), 'sender exposes one bounded delivery-identity-digest envelope name');
  check(fs.existsSync(path.join(outbound, alphaSender.envelopeFileName)), 'alpha outbox envelope exists after successful send');
  check(fs.existsSync(path.join(outbound, betaSender.envelopeFileName)), 'beta outbox envelope exists after successful send');
  const alphaEnvelope = readJson(path.join(outbound, alphaSender.envelopeFileName));
  const betaEnvelope = readJson(path.join(outbound, betaSender.envelopeFileName));
  equal(Custody.validateEnvelope(alphaEnvelope), alphaEnvelope, 'alpha envelope exact-rebuilds from persisted canonical JSON');
  equal(Custody.validateEnvelope(betaEnvelope), betaEnvelope, 'beta envelope exact-rebuilds from persisted canonical JSON');
  equal(Custody.validateSenderReceipt(alphaSender, alphaEnvelope), alphaSender, 'alpha sender receipt exact-rebuilds from envelope');
  check(alphaSender.truth.outboundEnvelopeExclusiveCreateCompleted, 'sender receipt reports exclusive create completion');
  check(alphaSender.truth.outboundEnvelopeFileFsyncCompleted, 'sender receipt reports file fsync completion');
  equal(alphaSender.truth.receiverReadObserved, false, 'sender receipt alone does not claim receiver read');
  equal(alphaSender.truth.actualNetworkTransportProven, false, 'sender receipt does not claim network transport');
  const serializedSender = Custody.stableStringify(alphaSender);
  check(!serializedSender.includes(receiver.keys[0].receiverId), 'public sender receipt embeds no raw receiver label');
  check(!serializedSender.includes('BEGIN PUBLIC KEY'), 'public sender receipt embeds no raw public key');
  check(!serializedSender.includes('PRIVATE KEY'), 'public sender receipt embeds no private key');
  check(!serializedSender.includes(tempRoot), 'public sender receipt embeds no machine path');
  throwsCode(() => sender.send(alphaInput), 'OUTBOX_ENVELOPE_EXISTS', 'sender refuses overwrite of an existing digest-named envelope');
  const conflictingAlpha = copy(alphaInput);
  conflictingAlpha.sentAt = '2026-08-20T15:06:31.000Z';
  throwsCode(() => sender.send(conflictingAlpha), 'OUTBOX_ENVELOPE_EXISTS', 'sender refuses conflicting payload reuse of one delivery and receiver identity');

  const alphaOptions = Fixture.receiverOptions(roots, receiver.keys[0]);
  const betaOptions = Fixture.receiverOptions(roots, receiver.keys[1]);
  const alphaChild = runChild('receive', alphaOptions, Fixture.receiveInput(alphaSender, '2026-08-20T15:07:00.000Z'));
  const betaChild = runChild('receive', betaOptions, Fixture.receiveInput(betaSender, '2026-08-20T15:08:00.000Z'));
  check(alphaChild.pid !== process.pid && betaChild.pid !== process.pid, 'both receiver writes execute in child processes distinct from the sender test process');
  check(alphaChild.pid !== betaChild.pid, 'alpha and beta receiver writes execute in distinct process instances');
  const alphaResult = alphaChild.output;
  const betaResult = betaChild.output;
  equal(alphaResult.receiverReceipt.schema, Custody.RECEIVER_RECEIPT_SCHEMA, 'alpha receiver receipt schema is exact');
  equal(betaResult.receiverReceipt.schema, Custody.RECEIVER_RECEIPT_SCHEMA, 'beta receiver receipt schema is exact');
  equal(alphaResult.acknowledgement.schema, ReceiverAck.ACKNOWLEDGEMENT_SCHEMA, 'alpha emits one exact v1.1 acknowledgement');
  equal(betaResult.acknowledgement.schema, ReceiverAck.ACKNOWLEDGEMENT_SCHEMA, 'beta emits one exact v1.1 acknowledgement');
  equal(alphaResult.acknowledgement.retentionClaim, ReceiverAck.RETENTION_CLAIM, 'v1.1 acknowledgement retains its explicit no-durable-retention claim');
  equal(betaResult.acknowledgement.retentionClaim, ReceiverAck.RETENTION_CLAIM, 'second v1.1 acknowledgement retains its no-durable-retention claim');
  const alphaRecordPath = path.join(roots.receivers[receiver.keys[0].receiverId], Custody.NAMESPACE, Custody.RECORDS_DIRECTORY, alphaResult.recordFileName);
  const betaRecordPath = path.join(roots.receivers[receiver.keys[1].receiverId], Custody.NAMESPACE, Custody.RECORDS_DIRECTORY, betaResult.recordFileName);
  check(fs.existsSync(alphaRecordPath), 'alpha custody record exists in its separate receiver root');
  check(fs.existsSync(betaRecordPath), 'beta custody record exists in its separate receiver root');
  const alphaRecord = readJson(alphaRecordPath);
  const betaRecord = readJson(betaRecordPath);
  check(Custody.validateCustodyRecord(alphaRecord, receiver.policy, receiver.keys[0].receiverId).record.recordDigest === alphaRecord.recordDigest, 'alpha signed custody record validates');
  check(Custody.validateCustodyRecord(betaRecord, receiver.policy, receiver.keys[1].receiverId).record.recordDigest === betaRecord.recordDigest, 'beta signed custody record validates');
  equal(Custody.validateReceiverReceipt(alphaSender, alphaRecord, alphaResult.receiverReceipt), alphaResult.receiverReceipt, 'alpha sender and receiver receipts exact-rebuild together');
  equal(Custody.validateReceiverReceipt(betaSender, betaRecord, betaResult.receiverReceipt), betaResult.receiverReceipt, 'beta sender and receiver receipts exact-rebuild together');
  equal(alphaResult.receiverReceipt.envelopeDigest, alphaSender.envelopeDigest, 'alpha sender and receiver receipts bind the same envelope digest');
  equal(betaResult.receiverReceipt.payloadDigest, betaSender.payloadDigest, 'beta sender and receiver receipts bind the same payload digest');
  check(alphaResult.receiverReceipt.truth.actualLocalFileHandoffObserved, 'receiver receipt reports actual local-file handoff');
  check(alphaResult.receiverReceipt.truth.receiverReadExactCanonicalEnvelope, 'receiver receipt reports exact canonical envelope read');
  check(alphaResult.receiverReceipt.truth.dataMinimizedAssessmentReceiptPersisted, 'receiver receipt reports data-minimized assessment receipt persistence');
  check(alphaResult.receiverReceipt.truth.receiverCustodyRecordFileFsyncCompleted, 'receiver receipt reports custody record file fsync completion');
  equal(alphaResult.receiverReceipt.truth.separateProcessProvenByReceipt, false, 'public receipt alone does not prove process separation');
  equal(alphaResult.receiverReceipt.truth.independentlyOperatedReceiverProven, false, 'distinct child process does not prove independently operated receiver');
  equal(alphaResult.receiverReceipt.truth.independentExternalRetentionProven, false, 'local receiver root does not prove external retention');
  equal(alphaResult.receiverReceipt.truth.protectedMonotonicStateProven, false, 'local receiver root is not protected monotonic state');
  equal(alphaResult.receiverReceipt.truth.deletionOrRollbackPrevented, false, 'local receiver root does not prevent deletion or rollback');
  equal(alphaResult.receiverReceipt.truth.executionAuthorized, false, 'receiver receipt grants no execution authority');
  equal(alphaResult.receiverReceipt.truth.adoptionAuthorized, false, 'receiver receipt grants no adoption authority');
  equal(alphaResult.receiverReceipt.truth.automaticCanon, false, 'receiver receipt grants no CANON authority');

  const serializedReceiverReceipt = Custody.stableStringify(alphaResult.receiverReceipt);
  check(!serializedReceiverReceipt.includes(receiver.keys[0].receiverId), 'public receiver receipt embeds no raw receiver label');
  check(!serializedReceiverReceipt.includes('BEGIN PUBLIC KEY'), 'public receiver receipt embeds no raw public key');
  check(!serializedReceiverReceipt.includes(alphaResult.acknowledgement.signature), 'public receiver receipt embeds no raw acknowledgement signature');
  check(!serializedReceiverReceipt.includes(alphaRecord.recordSignature), 'public receiver receipt embeds no raw custody signature');
  check(!serializedReceiverReceipt.includes('PRIVATE KEY'), 'public receiver receipt embeds no private key');
  check(!serializedReceiverReceipt.includes(tempRoot), 'public receiver receipt embeds no machine path');
  check(!Object.prototype.hasOwnProperty.call(alphaResult.receiverReceipt, 'storedAssessmentReceipt'), 'public receiver receipt omits full stored assessment receipt');

  check(Object.prototype.hasOwnProperty.call(alphaRecord, 'storedAssessmentReceipt'), 'private custody record retains data-minimized assessment receipt bytes');
  check(!Object.prototype.hasOwnProperty.call(alphaRecord, 'assessmentInput'), 'private custody record omits full assessment exact-rebuild input');
  check(Custody.stableStringify(alphaRecord).includes(alphaResult.acknowledgement.signature), 'private custody record explicitly retains native acknowledgement signature');
  check(Custody.stableStringify(alphaRecord).includes(alphaRecord.recordSignature), 'private custody record explicitly retains native custody signature');
  check(!Custody.stableStringify(alphaRecord).includes('PRIVATE KEY'), 'private custody record never retains receiver private key');
  equal(alphaRecord.truth.fullAssessmentInputPersistedInCustody, false, 'custody truth distinguishes receipt persistence from full input persistence');
  equal(alphaRecord.truth.durabilityBeyondReportedFileFsyncProven, false, 'custody truth limits durability to reported file fsync');

  const thresholdInput = copy(receiver.witnessInputs.threshold);
  thresholdInput.witnessId = 'receiver-acknowledgement-witness:local-custody-threshold';
  thresholdInput.verifiedAt = '2026-08-20T15:10:00.000Z';
  thresholdInput.signedAcknowledgements = [alphaResult.acknowledgement, betaResult.acknowledgement];
  const threshold = ReceiverAck.buildWitness(thresholdInput);
  equal(threshold.decision.classification, 'DECLARED_RECEIVER_ACKNOWLEDGEMENT_THRESHOLD_MET', 'two locally delivered receiver acknowledgements meet exact v1.1 threshold');
  equal(threshold.acknowledgementEvidence.verifiedAcknowledgements, 2, 'v1.1 witness verifies both local receiver acknowledgements');
  equal(threshold.truth.actualTransportDeliveryProven, false, 'v1.1 generic witness still makes no transport claim');
  equal(threshold.truth.independentExternalRetentionProven, false, 'v1.1 generic witness still makes no retention claim');

  const alphaReloadChild = runChild('reload', Fixture.reloadOptions(alphaOptions), {
    recordFileName: alphaResult.recordFileName,
    receiverPolicy: copy(receiver.policy),
    loadedAt: '2026-08-20T15:11:00.000Z'
  });
  const betaReloadChild = runChild('reload', Fixture.reloadOptions(betaOptions), {
    recordFileName: betaResult.recordFileName,
    receiverPolicy: copy(receiver.policy),
    loadedAt: '2026-08-20T15:11:30.000Z'
  });
  check(alphaReloadChild.pid !== alphaChild.pid && alphaReloadChild.pid !== process.pid, 'alpha custody reload executes in a new process instance');
  check(betaReloadChild.pid !== betaChild.pid && betaReloadChild.pid !== process.pid, 'beta custody reload executes in a new process instance');
  check(alphaReloadChild.pid !== betaReloadChild.pid, 'reload checks use distinct process instances');
  const alphaReload = alphaReloadChild.output;
  const betaReload = betaReloadChild.output;
  equal(alphaReload.schema, Custody.RELOAD_RECEIPT_SCHEMA, 'alpha reload receipt schema is exact');
  equal(betaReload.schema, Custody.RELOAD_RECEIPT_SCHEMA, 'beta reload receipt schema is exact');
  equal(alphaReload.custodyRecordRef.sha256, alphaRecord.recordDigest, 'alpha reload binds exact persisted custody record');
  equal(betaReload.storedAssessmentReceiptDigest, betaRecord.storedAssessmentReceiptDigest, 'beta reload binds exact stored assessment receipt bytes');
  equal(Custody.validateReloadReceipt(alphaRecord, alphaReload), alphaReload, 'alpha reload receipt exact-rebuilds');
  check(alphaReload.truth.custodyRecordReloadedFromLocalFilesystem, 'reload receipt reports local filesystem reload');
  check(alphaReload.truth.custodyRecordSignatureVerified, 'reload receipt reports custody signature verification');
  check(alphaReload.truth.receiverAcknowledgementSignatureVerified, 'reload receipt reports acknowledgement signature verification');
  check(alphaReload.truth.storedAssessmentReceiptSelfDigestVerified, 'reload receipt reports stored receipt self-digest verification');
  equal(alphaReload.truth.assessmentUpstreamExactReverifiedWithoutInput, false, 'reload does not claim upstream exact re-verification without input');
  equal(alphaReload.truth.freshProcessProvenByReceipt, false, 'reload receipt alone does not claim fresh-process proof');
  equal(alphaReload.truth.independentExternalRetentionProven, false, 'fresh process local reload does not prove external retention');
  const serializedReload = Custody.stableStringify(alphaReload);
  check(!serializedReload.includes(receiver.keys[0].receiverId), 'public reload receipt embeds no raw receiver label');
  check(!serializedReload.includes(alphaRecord.recordSignature), 'public reload receipt embeds no raw custody signature');
  check(!serializedReload.includes(tempRoot), 'public reload receipt embeds no machine path');

  const beforeGammaFiles = fs.readdirSync(outbound).length;
  const badUnknownSend = Fixture.senderInput(receiver, receiver.keys[2].receiverId, 'unknown-field');
  badUnknownSend.authority = true;
  throwsCode(() => sender.send(badUnknownSend), 'INVALID_INPUT', 'sender refuses undeclared authority input');
  equal(fs.readdirSync(outbound).length, beforeGammaFiles, 'invalid sender input performs no outbox write');
  const tamperedAssessment = Fixture.senderInput(receiver, receiver.keys[2].receiverId, 'tampered-assessment');
  tamperedAssessment.assessmentReceipt.truth.automaticCanon = true;
  throwsCode(() => sender.send(tamperedAssessment), 'ASSESSMENT_INVALID', 'sender refuses tampered v1.0 assessment before write');
  const wrongPolicy = Fixture.senderInput(receiver, receiver.keys[2].receiverId, 'wrong-policy');
  wrongPolicy.receiverPolicy.truth.receiverPolicyAuthorityAuthenticated = true;
  throwsCode(() => sender.send(wrongPolicy), 'POLICY_INVALID', 'sender refuses tampered v1.1 policy before write');
  const earlySend = Fixture.senderInput(receiver, receiver.keys[2].receiverId, 'early-send', '2026-08-20T15:05:59.000Z');
  throwsCode(() => sender.send(earlySend), 'INVALID_TIME', 'sender refuses delivery before policy issue');
  const lateSend = Fixture.senderInput(receiver, receiver.keys[2].receiverId, 'late-send', '2026-08-20T16:00:00.001Z');
  throwsCode(() => sender.send(lateSend), 'INVALID_TIME', 'sender refuses delivery after policy expiry');
  const disabledPolicyInput = ReceiverFixture.policyInput('disabled-gamma', receiver.assessment, receiver.keys, 2, { disabledReceiverId: receiver.keys[2].receiverId });
  const disabledSend = Fixture.senderInput(receiver, receiver.keys[2].receiverId, 'disabled-receiver');
  disabledSend.receiverPolicy = ReceiverAck.buildPolicy(disabledPolicyInput);
  throwsCode(() => sender.send(disabledSend), 'RECEIVER_DISABLED', 'sender refuses a disabled policy receiver');

  const gammaInput = Fixture.senderInput(receiver, receiver.keys[2].receiverId, 'gamma', '2026-08-20T15:06:50.000Z');
  const gammaSender = sender.send(gammaInput);
  const gammaOptions = Fixture.receiverOptions(roots, receiver.keys[2]);
  const gammaService = Custody.createReceiver(gammaOptions);
  const noReceiveConfirmation = Fixture.receiveInput(gammaSender, '2026-08-20T15:09:00.000Z');
  noReceiveConfirmation.confirmation = 'RECEIVE';
  throwsCode(() => gammaService.receive(noReceiveConfirmation), 'RECEIVE_CONFIRMATION_REQUIRED', 'receiver persistence is refused without exact confirmation');
  equal(fs.existsSync(path.join(roots.receivers[receiver.keys[2].receiverId], Custody.NAMESPACE)), false, 'failed receive confirmation creates no custody namespace');
  const traversalReceive = Fixture.receiveInput(gammaSender, '2026-08-20T15:09:00.000Z');
  traversalReceive.envelopeFileName = '..\\escape.json';
  throwsCode(() => gammaService.receive(traversalReceive), 'PATH_REFUSED', 'receiver refuses traversal envelope filename');
  const tamperedSenderReceipt = Fixture.receiveInput(gammaSender, '2026-08-20T15:09:00.000Z');
  tamperedSenderReceipt.senderReceipt.payloadDigest = 'sha256:' + '0'.repeat(64);
  throwsCode(() => gammaService.receive(tamperedSenderReceipt), 'SENDER_RECEIPT_INVALID', 'receiver refuses sender receipt not bound to exact envelope');
  const wrongKeyOptions = Fixture.receiverOptions(roots, receiver.keys[2]);
  wrongKeyOptions.privateKeyPem = Fixture.privateKeyPem(receiver.keys[0]);
  const wrongKeyService = Custody.createReceiver(wrongKeyOptions);
  throwsCode(() => wrongKeyService.receive(Fixture.receiveInput(gammaSender, '2026-08-20T15:09:00.000Z')), 'PRIVATE_KEY_MISMATCH', 'receiver refuses private key from another declared receiver');
  const mismatchedReceiverOptions = Fixture.receiverOptions(roots, receiver.keys[1]);
  const mismatchedService = Custody.createReceiver(mismatchedReceiverOptions);
  throwsCode(() => mismatchedService.receive(Fixture.receiveInput(gammaSender, '2026-08-20T15:09:00.000Z')), 'RECEIVER_MISMATCH', 'receiver refuses envelope addressed to another receiver');
  throwsCode(() => gammaService.receive(Fixture.receiveInput(gammaSender, '2026-08-20T15:06:40.000Z')), 'INVALID_TIME', 'receiver refuses receive before send');
  throwsCode(() => gammaService.receive(Fixture.receiveInput(gammaSender, '2026-08-20T16:00:00.001Z')), 'INVALID_TIME', 'receiver refuses receive after policy expiry');
  const gammaResult = gammaService.receive(Fixture.receiveInput(gammaSender, '2026-08-20T15:09:00.000Z'));
  equal(gammaResult.receiverReceipt.truth.actualLocalFileHandoffObserved, true, 'same-process gamma route still records actual local file handoff only');
  throwsCode(() => gammaService.receive(Fixture.receiveInput(gammaSender, '2026-08-20T15:09:00.000Z')), 'CUSTODY_RECORD_EXISTS', 'receiver refuses overwrite of existing custody record');

  const alphaReloadService = Custody.createReceiver(Fixture.reloadOptions(alphaOptions));
  throwsCode(() => alphaReloadService.reload({ recordFileName: '..\\record.json', receiverPolicy: receiver.policy, loadedAt: '2026-08-20T15:12:00.000Z' }), 'PATH_REFUSED', 'reload refuses traversal record filename');
  throwsCode(() => alphaReloadService.reload({ recordFileName: alphaResult.recordFileName, receiverPolicy: receiver.policy, loadedAt: '2026-08-20T15:06:59.000Z' }), 'INVALID_TIME', 'reload refuses time before custody receive');
  const alteredPolicy = copy(receiver.policy);
  alteredPolicy.policyId = 'receiver-policy:other';
  alteredPolicy.policyDigest = ReceiverAck.sha256((() => { const value = copy(alteredPolicy); delete value.policyDigest; return value; })());
  throwsCode(() => alphaReloadService.reload({ recordFileName: alphaResult.recordFileName, receiverPolicy: alteredPolicy, loadedAt: '2026-08-20T15:12:00.000Z' }), 'POLICY_MISMATCH', 'reload refuses a different internally valid policy');

  const tamperedTruth = copy(alphaRecord);
  tamperedTruth.truth.independentExternalRetentionProven = true;
  throwsCode(() => Custody.validateCustodyRecord(tamperedTruth, receiver.policy, receiver.keys[0].receiverId), 'CUSTODY_RECORD_INVALID', 'custody validation refuses invented external retention truth');
  const tamperedRecordId = copy(alphaRecord);
  tamperedRecordId.custodyRecordId = 'local-custody-record:' + '0'.repeat(64);
  throwsCode(() => Custody.validateCustodyRecord(tamperedRecordId, receiver.policy, receiver.keys[0].receiverId), 'CUSTODY_RECORD_INVALID', 'custody validation refuses nondeterministic record identity');
  const tamperedAcknowledgementId = copy(alphaRecord);
  tamperedAcknowledgementId.acknowledgement.acknowledgementId = 'local-receiver-ack:' + '0'.repeat(64);
  throwsCode(() => Custody.validateCustodyRecord(tamperedAcknowledgementId, receiver.policy, receiver.keys[0].receiverId), 'ACKNOWLEDGEMENT_INVALID', 'custody validation refuses nondeterministic acknowledgement identity');
  const tamperedReceiveTime = copy(alphaRecord);
  tamperedReceiveTime.receivedAt = '2026-08-20T16:00:00.001Z';
  tamperedReceiveTime.acknowledgement.acknowledgedAt = tamperedReceiveTime.receivedAt;
  throwsCode(() => Custody.validateCustodyRecord(tamperedReceiveTime, receiver.policy, receiver.keys[0].receiverId), 'CUSTODY_RECORD_INVALID', 'custody validation refuses receive time outside policy window');
  const tamperedStored = copy(alphaRecord);
  tamperedStored.storedAssessmentReceipt.decision.classification = 'ALTERED';
  throwsCode(() => Custody.validateCustodyRecord(tamperedStored, receiver.policy, receiver.keys[0].receiverId), 'CUSTODY_RECORD_INVALID', 'custody validation refuses altered stored assessment receipt');
  const tamperedAck = copy(alphaRecord);
  tamperedAck.acknowledgement.signature = betaResult.acknowledgement.signature;
  throwsCode(() => Custody.validateCustodyRecord(tamperedAck, receiver.policy, receiver.keys[0].receiverId), 'SIGNATURE_INVALID', 'custody validation refuses altered acknowledgement signature');
  const tamperedRecordDigest = copy(alphaRecord);
  tamperedRecordDigest.recordDigest = 'sha256:' + '1'.repeat(64);
  throwsCode(() => Custody.validateCustodyRecord(tamperedRecordDigest, receiver.policy, receiver.keys[0].receiverId), 'CUSTODY_RECORD_INVALID', 'custody validation refuses altered record digest');
  const tamperedRecordSignature = copy(alphaRecord);
  tamperedRecordSignature.recordSignature = betaRecord.recordSignature;
  throwsCode(() => Custody.validateCustodyRecord(tamperedRecordSignature, receiver.policy, receiver.keys[0].receiverId), 'SIGNATURE_INVALID', 'custody validation refuses altered custody signature');
  const tamperedReceiverReceipt = copy(alphaResult.receiverReceipt);
  tamperedReceiverReceipt.truth.independentExternalRetentionProven = true;
  throwsCode(() => Custody.validateReceiverReceipt(alphaSender, alphaRecord, tamperedReceiverReceipt), 'RECEIVER_RECEIPT_INVALID', 'public receiver receipt tampering fails exact rebuild');
  const tamperedReload = copy(alphaReload);
  tamperedReload.truth.freshProcessProvenByReceipt = true;
  throwsCode(() => Custody.validateReloadReceipt(alphaRecord, tamperedReload), 'RELOAD_RECEIPT_INVALID', 'public reload receipt tampering fails exact rebuild');

  const badRecordName = 'f'.repeat(64) + '.json';
  const badRecordPath = path.join(path.dirname(alphaRecordPath), badRecordName);
  writeCanonical(badRecordPath, tamperedTruth);
  throwsCode(() => alphaReloadService.reload({ recordFileName: badRecordName, receiverPolicy: receiver.policy, loadedAt: '2026-08-20T15:12:00.000Z' }), 'CUSTODY_RECORD_INVALID', 'reload fails closed on corrupt canonical custody record');
  const noncanonicalEnvelopeName = 'e'.repeat(64) + '.json';
  fs.writeFileSync(path.join(outbound, noncanonicalEnvelopeName), JSON.stringify(alphaEnvelope, null, 2), 'utf8');
  const noncanonicalReceive = Fixture.receiveInput(gammaSender, '2026-08-20T15:09:30.000Z');
  noncanonicalReceive.envelopeFileName = noncanonicalEnvelopeName;
  noncanonicalReceive.senderReceipt.envelopeFileName = noncanonicalEnvelopeName;
  throwsCode(() => gammaService.receive(noncanonicalReceive), 'OUTBOX_ENVELOPE_INVALID', 'receiver refuses noncanonical outbox JSON before receipt inspection');

  const relativeRoot = path.join('relative', 'root');
  throwsCode(() => Custody.createSender({ transportRoot: relativeRoot }), 'STATE_ROOT_INVALID', 'sender refuses relative transport root');
  throwsCode(() => Custody.createSender({ transportRoot: path.parse(tempRoot).root }), 'STATE_ROOT_INVALID', 'sender refuses filesystem root');
  const rootFile = path.join(tempRoot, 'not-a-root.txt');
  fs.writeFileSync(rootFile, 'not a directory', 'utf8');
  throwsCode(() => Custody.createSender({ transportRoot: rootFile }), 'STATE_ROOT_INVALID', 'sender refuses file as transport root');
  throwsCode(() => Custody.createReceiver({ transportRoot: roots.transport, stateRoot: roots.transport, receiverId: receiver.keys[0].receiverId, privateKeyPem: Fixture.privateKeyPem(receiver.keys[0]) }), 'ROOTS_NOT_SEPARATE', 'receiver refuses equal transport and custody roots');
  const nestedRoot = path.join(roots.transport, 'nested-receiver');
  fs.mkdirSync(nestedRoot);
  throwsCode(() => Custody.createReceiver({ transportRoot: roots.transport, stateRoot: nestedRoot, receiverId: receiver.keys[0].receiverId, privateKeyPem: Fixture.privateKeyPem(receiver.keys[0]) }), 'ROOTS_NOT_SEPARATE', 'receiver refuses nested transport and custody roots');
  const rsa = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const rsaPem = rsa.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
  throwsCode(() => Custody.createReceiver({ transportRoot: roots.transport, stateRoot: roots.receivers[receiver.keys[0].receiverId], receiverId: receiver.keys[0].receiverId, privateKeyPem: rsaPem }), 'PRIVATE_KEY_INVALID', 'receiver refuses non-Ed25519 private key');

  const oversizedEnvelope = { padding: 'x'.repeat(Custody.MAX_ENVELOPE_CANONICAL_BYTES + 1) };
  throwsCode(() => Custody.buildEnvelope(oversizedEnvelope), 'ENVELOPE_TOO_LARGE', 'oversized envelope input is refused before field processing');
  const oversizedRecord = { padding: 'x'.repeat(Custody.MAX_RECORD_CANONICAL_BYTES + 1) };
  throwsCode(() => Custody.validateCustodyRecord(oversizedRecord, receiver.policy, receiver.keys[0].receiverId), 'CUSTODY_RECORD_TOO_LARGE', 'oversized custody record is refused before field processing');

  const schemaFiles = {
    envelope: readJson(path.join(__dirname, 'model-shadow-review-challenge-transition-local-receiver-envelope.schema.json')),
    sender: readJson(path.join(__dirname, 'model-shadow-review-challenge-transition-local-receiver-sender-receipt.schema.json')),
    record: readJson(path.join(__dirname, 'model-shadow-review-challenge-transition-local-receiver-custody-record.schema.json')),
    receiver: readJson(path.join(__dirname, 'model-shadow-review-challenge-transition-local-receiver-receipt.schema.json')),
    reload: readJson(path.join(__dirname, 'model-shadow-review-challenge-transition-local-receiver-reload-receipt.schema.json'))
  };
  equal(schemaFiles.envelope.$id, Custody.ENVELOPE_SCHEMA, 'envelope schema identity matches implementation');
  equal(schemaFiles.sender.$id, Custody.SENDER_RECEIPT_SCHEMA, 'sender receipt schema identity matches implementation');
  equal(schemaFiles.record.$id, Custody.CUSTODY_RECORD_SCHEMA, 'custody record schema identity matches implementation');
  equal(schemaFiles.receiver.$id, Custody.RECEIVER_RECEIPT_SCHEMA, 'receiver receipt schema identity matches implementation');
  equal(schemaFiles.reload.$id, Custody.RELOAD_RECEIPT_SCHEMA, 'reload receipt schema identity matches implementation');
  equal(schemaFiles.record.properties.truth.properties.independentExternalRetentionProven.const, false, 'custody schema keeps external retention false');
  equal(schemaFiles.record.properties.truth.properties.fullAssessmentInputPersistedInCustody.const, false, 'custody schema keeps full assessment input persistence false');
  equal(schemaFiles.receiver.properties.truth.properties.actualLocalFileHandoffObserved.const, true, 'receiver schema records bounded local file handoff');
  equal(schemaFiles.receiver.properties.truth.properties.independentlyOperatedReceiverProven.const, false, 'receiver schema keeps real-world independence false');
  equal(schemaFiles.reload.properties.truth.properties.assessmentUpstreamExactReverifiedWithoutInput.const, false, 'reload schema keeps upstream re-verification without input false');

  const contract = readJson(path.join(__dirname, 'module.contract.json'));
  equal(contract.status, 'TEST', 'contract remains TEST');
  check(contract.permissions.length === 2, 'contract declares both bounded filesystem permission surfaces');
  check(contract.boundaries.writes.length === 2, 'contract declares both exclusive file write surfaces');
  check(contract.boundaries.refuses.includes('local-child-processes-as-independent-real-world-receivers'), 'contract refuses child processes as independent receivers');
  check(contract.boundaries.refuses.includes('caller-owned-custody-root-as-independent-external-retention'), 'contract refuses local root as external retention');
  check(contract.boundaries.refuses.includes('local-files-as-protected-monotonic-state-or-deletion-rollback-resistance'), 'contract refuses local files as protected state');
  check(contract.boundaries.refuses.includes('private-key-persistence'), 'contract refuses private-key persistence');
  equal(contract.lifecycle.installed, false, 'contract remains uninstalled');
  equal(contract.lifecycle.promoted, false, 'contract remains unpromoted');

  const source = fs.readFileSync(path.join(__dirname, 'model-shadow-review-challenge-transition-local-receiver-custody.js'), 'utf8');
  check(source.includes("require('fs')") && source.includes("require('path')"), 'runtime explicitly imports bounded local filesystem capabilities');
  check(!source.includes("require('http')") && !source.includes("require('https')") && !source.includes("require('net')") && !source.includes('fetch('), 'runtime opens no network transport');
  check(!source.includes("require('child_process')"), 'runtime itself spawns no process');

  console.log('\nModel Shadow local receiver custody selftest: PASS (' + checks + ' checks)');
} finally {
  const resolved = path.resolve(tempRoot);
  if (!resolved.startsWith(path.resolve(os.tmpdir()) + path.sep) || !path.basename(resolved).startsWith('axm-local-receiver-custody-')) {
    throw new Error('refusing to remove unexpected selftest root');
  }
  fs.rmSync(resolved, { recursive: true, force: true });
}
