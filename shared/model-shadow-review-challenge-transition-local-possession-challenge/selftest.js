#!/usr/bin/env node
'use strict';

const assert = require('assert');
const childProcess = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Custody = require('../model-shadow-review-challenge-transition-local-receiver-custody/model-shadow-review-challenge-transition-local-receiver-custody');
const Possession = require('./model-shadow-review-challenge-transition-local-possession-challenge');
const Fixture = require('./selftest-fixture');

let checks = 0;

function ok(value, message) {
  assert.ok(value, message);
  checks += 1;
}

function equal(actual, expected, message) {
  assert.deepStrictEqual(actual, expected, message);
  checks += 1;
}

function throwsCode(action, expected, message) {
  let caught = null;
  try { action(); } catch (error) { caught = error; }
  assert.ok(caught, message + ' should throw');
  assert.strictEqual(caught.code, expected, message + ' code');
  checks += 2;
}

function copy(value) {
  return Fixture.copy(value);
}

function runChild(action, options, input) {
  const result = childProcess.spawnSync(process.execPath, [path.join(__dirname, 'selftest-child.js')], {
    input: JSON.stringify({ action, options, input }),
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024
  });
  if (result.status !== 0) throw new Error('child failed: ' + result.stderr + result.stdout);
  return JSON.parse(result.stdout);
}

function publicKeyPem(pair) {
  return pair.publicKey.export({ type: 'spki', format: 'pem' }).toString();
}

function privateKeyPem(pair) {
  return pair.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
}

function hasKeyDeep(value, key) {
  if (!value || typeof value !== 'object') return false;
  if (Object.prototype.hasOwnProperty.call(value, key)) return true;
  return Object.values(value).some(item => hasKeyDeep(item, key));
}

function issue(fixture, byte, overrides) {
  return fixture.challengerService.issue(Object.assign(copy(fixture.challengeInput), {
    nonce: Buffer.alloc(32, byte).toString('base64')
  }, overrides || {}));
}

function answerInput(fixture, challenge, overrides) {
  return Object.assign(copy(fixture.answerInput), { challenge: copy(challenge) }, overrides || {});
}

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'axm-local-possession-challenge-'));
let cleanupVerified = false;

try {
  const fixture = Fixture.buildFixture(tempRoot);
  const challenge = fixture.challenge;
  const receiverService = Possession.createReceiver(fixture.receiverOptions);

  equal(Possession.VERSION, '1.3.0', 'version is exact');
  equal(Possession.STATUS, 'TEST', 'status is TEST');
  equal(Possession.CHALLENGE_SCHEMA, 'axm.model-shadow-review-challenge-transition-local-possession-challenge/v1', 'challenge schema is exact');
  equal(Possession.RESPONSE_RECORD_SCHEMA, 'axm.model-shadow-review-challenge-transition-local-possession-response-record/v1', 'response schema is exact');
  equal(Possession.RECEIPT_SCHEMA, 'axm.model-shadow-review-challenge-transition-local-possession-receipt/v1', 'receipt schema is exact');
  equal(Possession.RELOAD_RECEIPT_SCHEMA, 'axm.model-shadow-review-challenge-transition-local-possession-reload-receipt/v1', 'reload schema is exact');
  equal(Possession.ANSWER_CONFIRMATION, 'ANSWER_EXACT_LOCAL_RECEIVER_POSSESSION_CHALLENGE', 'confirmation is exact');
  equal(Possession.MAX_CHALLENGE_WINDOW_MS, 86400000, 'challenge window is bounded to 24 hours');

  const deterministicChallenge = fixture.challengerService.issue(copy(fixture.challengeInput));
  equal(deterministicChallenge, challenge, 'same key and exact input deterministically rebuild challenge');
  equal(challenge.schema, Possession.CHALLENGE_SCHEMA, 'challenge carries schema');
  equal(challenge.status, 'TEST', 'challenge remains TEST');
  equal(Buffer.from(challenge.nonce, 'base64').length, 32, 'challenge nonce is exactly 32 bytes');
  ok(challenge.challengeId.startsWith('local-possession-challenge:'), 'challenge has deterministic id');
  ok(/^sha256:[a-f0-9]{64}$/.test(challenge.challengeDigest), 'challenge has exact digest');
  equal(challenge.truth.challengerIdentityAuthenticated, false, 'challenge does not authenticate identity');
  equal(challenge.truth.challengeTimeExternallyTrusted, false, 'challenge time is not trusted');
  equal(challenge.truth.receiverPossessionProvenByChallengeAlone, false, 'challenge alone proves no possession');

  throwsCode(() => receiverService.answer(Object.assign(copy(fixture.answerInput), { confirmation: 'yes' })), 'ANSWER_CONFIRMATION_REQUIRED', 'answer requires exact confirmation');
  const stateNamespace = path.join(fixture.receiverOptions.stateRoot, Possession.NAMESPACE);
  equal(fs.existsSync(stateNamespace), false, 'missing confirmation creates no response namespace');

  const answerChild = runChild('answer', fixture.receiverOptions, fixture.answerInput);
  ok(answerChild.pid !== process.pid, 'answer executed in a distinct child process');
  const answer = answerChild.output;
  equal(answer.responsePackage.schema, Possession.RESPONSE_RECORD_SCHEMA, 'answer returns exact response package');
  equal(answer.receipt.schema, Possession.RECEIPT_SCHEMA, 'answer returns exact public receipt');
  equal(answer.responseFileName, answer.receipt.responseFileName, 'answer and receipt bind response filename');
  equal(answer.responsePackage.challenge, challenge, 'response embeds exact signed challenge');
  equal(answer.responsePackage.custodyRecordRef, fixture.custodyResult.receiverReceipt.custodyRecordRef, 'response binds exact custody record');
  equal(answer.responsePackage.storedAssessmentReceiptDigest, fixture.custodyResult.receiverReceipt.storedAssessmentReceiptDigest, 'response binds stored assessment receipt digest');
  equal(answer.responsePackage.truth.custodyRecordRereadFromLocalFilesystem, true, 'response reports local custody reread');
  equal(answer.responsePackage.truth.replayRefusedWhileResponseFilePresent, true, 'response bounds replay refusal to present file');
  equal(answer.responsePackage.truth.deletionOrRollbackPrevented, false, 'response admits no deletion or rollback prevention');
  equal(answer.responsePackage.truth.retentionDurationProven, false, 'response admits no retention duration proof');
  equal(answer.responsePackage.truth.challengeTimeExternallyTrusted, false, 'response admits caller time is untrusted');
  equal(answer.responsePackage.truth.independentlyOperatedChallengerProven, false, 'response admits challenger independence is unproven');
  equal(answer.responsePackage.truth.independentlyOperatedReceiverProven, false, 'response admits receiver independence is unproven');

  const responsePath = path.join(fixture.receiverOptions.stateRoot, Possession.NAMESPACE, Possession.ANSWERS_DIRECTORY, answer.responseFileName);
  ok(fs.existsSync(responsePath), 'response record exists in fixed namespace');
  const responseRaw = fs.readFileSync(responsePath, 'utf8');
  equal(responseRaw, Possession.stableStringify(answer.responsePackage) + '\n', 'persisted response is exact canonical JSON');
  equal(JSON.parse(responseRaw), answer.responsePackage, 'persisted response matches returned package');
  equal(hasKeyDeep(answer.responsePackage, 'storedAssessmentReceipt'), false, 'response does not embed stored assessment receipt');
  equal(hasKeyDeep(answer.responsePackage, 'recordSignature'), false, 'response does not embed custody record signature');
  equal(hasKeyDeep(answer.responsePackage, 'privateKeyPem'), false, 'response embeds no private key field');

  const publicRaw = Possession.stableStringify(answer.receipt);
  equal(publicRaw.includes(fixture.receiverKey.receiverId), false, 'public receipt omits raw receiver label');
  equal(publicRaw.includes(fixture.challenger.challengerId), false, 'public receipt omits raw challenger label');
  equal(publicRaw.includes(fixture.receiverKey.publicKeyPem), false, 'public receipt omits receiver public key');
  equal(publicRaw.includes(Fixture.publicKeyPem(fixture.challenger)), false, 'public receipt omits challenger public key');
  equal(publicRaw.includes(answer.responsePackage.responseSignature), false, 'public receipt omits response signature');
  equal(publicRaw.includes(challenge.challengeSignature), false, 'public receipt omits challenge signature');
  equal(publicRaw.includes(fixture.receiverOptions.stateRoot), false, 'public receipt omits machine path');
  equal(hasKeyDeep(answer.receipt, 'storedAssessmentReceipt'), false, 'public receipt omits assessment receipt');
  equal(answer.receipt.truth.rawReceiverLabelEmbedded, false, 'public truth admits no raw receiver label');
  equal(answer.receipt.truth.rawSignatureEmbedded, false, 'public truth admits no raw signature');
  equal(answer.receipt.truth.networkOrOtherHostProven, false, 'public truth admits no external transport');
  equal(answer.receipt.truth.executionAuthorized, false, 'public receipt grants no execution authority');
  equal(Possession.validateReceipt(answer.responsePackage, copy(answer.receipt)), answer.receipt, 'public receipt exact-validates');
  const changedReceipt = copy(answer.receipt);
  changedReceipt.truth.retentionDurationProven = true;
  throwsCode(() => Possession.validateReceipt(answer.responsePackage, changedReceipt), 'RECEIPT_INVALID', 'receipt rejects invented retention proof');

  const reloadOptions = Object.assign(copy(fixture.receiverOptions), { privateKeyPem: null });
  const reloadInput = {
    responseFileName: answer.responseFileName,
    recordFileName: fixture.custodyResult.recordFileName,
    receiverPolicy: copy(fixture.receiver.policy),
    challenge: copy(challenge),
    loadedAt: '2026-08-20T15:22:00.000Z'
  };
  const reloadChild = runChild('reload', reloadOptions, reloadInput);
  ok(reloadChild.pid !== process.pid && reloadChild.pid !== answerChild.pid, 'reload executed in another child process');
  const reload = reloadChild.output;
  equal(reload.schema, Possession.RELOAD_RECEIPT_SCHEMA, 'reload returns exact schema');
  equal(reload.responseRef.sha256, answer.responsePackage.responseDigest, 'reload binds response digest');
  equal(reload.custodyRecordRef, fixture.custodyResult.receiverReceipt.custodyRecordRef, 'reload binds custody record');
  equal(reload.truth.responseReloadedFromLocalFilesystem, true, 'reload reports response filesystem read');
  equal(reload.truth.custodyRecordReloadedFromLocalFilesystem, true, 'reload reports custody filesystem read');
  equal(reload.truth.freshProcessProvenByReceipt, false, 'receipt alone does not prove fresh process');
  equal(reload.truth.retentionDurationProven, false, 'reload does not invent retention duration');

  throwsCode(() => receiverService.answer(copy(fixture.answerInput)), 'CHALLENGE_ALREADY_ANSWERED', 'same challenge cannot overwrite existing response');
  throwsCode(() => receiverService.answer(Object.assign(copy(fixture.answerInput), { answeredAt: '2026-08-20T15:22:00.000Z' })), 'CHALLENGE_ALREADY_ANSWERED', 'same logical challenge cannot conflict on response time');

  const secondChallenge = issue(fixture, 0x42);
  const secondAnswer = receiverService.answer(answerInput(fixture, secondChallenge, { answeredAt: '2026-08-20T15:23:00.000Z' }));
  ok(secondAnswer.responseFileName !== answer.responseFileName, 'distinct nonce produces distinct response identity');
  equal(secondAnswer.responsePackage.challenge.nonce, secondChallenge.nonce, 'second response binds distinct nonce');
  const secondReload = Possession.createReceiver(reloadOptions).reload({
    responseFileName: secondAnswer.responseFileName,
    recordFileName: fixture.custodyResult.recordFileName,
    receiverPolicy: copy(fixture.receiver.policy),
    challenge: copy(secondChallenge),
    loadedAt: '2026-08-20T15:24:00.000Z'
  });
  equal(secondReload.responseRef.sha256, secondAnswer.responsePackage.responseDigest, 'distinct challenge response reloads');

  const tamperedSignature = issue(fixture, 0x43);
  tamperedSignature.challengeSignature = tamperedSignature.challengeSignature.slice(0, -2) + 'AA';
  throwsCode(() => receiverService.answer(answerInput(fixture, tamperedSignature)), 'SIGNATURE_INVALID', 'tampered challenger signature is refused');
  const tamperedNonce = issue(fixture, 0x44);
  tamperedNonce.nonce = Buffer.alloc(32, 0x45).toString('base64');
  throwsCode(() => receiverService.answer(answerInput(fixture, tamperedNonce)), 'CHALLENGE_INVALID', 'changed nonce breaks deterministic challenge id');

  const fakeCustodyRef = copy(fixture.challengeInput.custodyRecordRef);
  fakeCustodyRef.sha256 = 'sha256:' + '1'.repeat(64);
  const wrongCustodyChallenge = issue(fixture, 0x46, { custodyRecordRef: fakeCustodyRef });
  throwsCode(() => receiverService.answer(answerInput(fixture, wrongCustodyChallenge)), 'CUSTODY_RECORD_MISMATCH', 'signed challenge for another custody record is refused');
  const fakePolicyRef = copy(fixture.challengeInput.receiverPolicyRef);
  fakePolicyRef.sha256 = 'sha256:' + '2'.repeat(64);
  const wrongPolicyChallenge = issue(fixture, 0x47, { receiverPolicyRef: fakePolicyRef });
  throwsCode(() => receiverService.answer(answerInput(fixture, wrongPolicyChallenge)), 'POLICY_MISMATCH', 'signed challenge for another policy is refused');
  const wrongReceiverChallenge = issue(fixture, 0x48, { receiverId: fixture.receiver.keys[1].receiverId });
  throwsCode(() => receiverService.answer(answerInput(fixture, wrongReceiverChallenge)), 'RECEIVER_MISMATCH', 'challenge for another receiver is refused');

  const equalTimeChallenge = issue(fixture, 0x49, { issuedAt: '2026-08-20T15:07:00.000Z', expiresAt: '2026-08-20T15:08:00.000Z' });
  throwsCode(() => receiverService.answer(answerInput(fixture, equalTimeChallenge, { answeredAt: '2026-08-20T15:07:30.000Z' })), 'INVALID_TIME', 'challenge must be later than custody receipt');
  const beyondPolicyChallenge = issue(fixture, 0x4a, { issuedAt: '2026-08-20T15:59:00.000Z', expiresAt: '2026-08-20T16:01:00.000Z' });
  throwsCode(() => receiverService.answer(answerInput(fixture, beyondPolicyChallenge, { answeredAt: '2026-08-20T15:59:30.000Z' })), 'INVALID_TIME', 'challenge cannot outlive receiver policy');
  const timeChallenge = issue(fixture, 0x4b);
  throwsCode(() => receiverService.answer(answerInput(fixture, timeChallenge, { answeredAt: '2026-08-20T15:19:59.000Z' })), 'INVALID_TIME', 'answer cannot predate challenge');
  throwsCode(() => receiverService.answer(answerInput(fixture, timeChallenge, { answeredAt: '2026-08-20T15:30:01.000Z' })), 'INVALID_TIME', 'answer cannot follow challenge expiry');
  throwsCode(() => fixture.challengerService.issue(Object.assign(copy(fixture.challengeInput), { nonce: 'not-base64' })), 'NONCE_INVALID', 'challenge refuses invalid nonce');
  throwsCode(() => fixture.challengerService.issue(Object.assign(copy(fixture.challengeInput), { extra: true })), 'INVALID_INPUT', 'challenge refuses unknown field');
  throwsCode(() => fixture.challengerService.issue(Object.assign(copy(fixture.challengeInput), { issuedAt: '2026-08-20T15:20:00.000Z', expiresAt: '2026-08-21T15:20:00.001Z' })), 'INVALID_TIME', 'challenge window cannot exceed 24 hours');

  const wrongChallengerPair = crypto.generateKeyPairSync('ed25519');
  const wrongChallengerOptions = Object.assign(copy(fixture.receiverOptions), { challengerPublicKeyPem: publicKeyPem(wrongChallengerPair) });
  throwsCode(() => Possession.createReceiver(wrongChallengerOptions).answer(answerInput(fixture, issue(fixture, 0x4c))), 'CHALLENGER_MISMATCH', 'configured wrong challenger key is refused');
  const wrongChallengerIdOptions = Object.assign(copy(fixture.receiverOptions), { challengerId: 'challenger:other' });
  throwsCode(() => Possession.createReceiver(wrongChallengerIdOptions).answer(answerInput(fixture, issue(fixture, 0x4d))), 'CHALLENGER_MISMATCH', 'configured wrong challenger label is refused');
  const wrongReceiverPair = crypto.generateKeyPairSync('ed25519');
  const wrongReceiverOptions = Object.assign(copy(fixture.receiverOptions), { privateKeyPem: privateKeyPem(wrongReceiverPair) });
  throwsCode(() => Possession.createReceiver(wrongReceiverOptions).answer(answerInput(fixture, issue(fixture, 0x4e))), 'PRIVATE_KEY_MISMATCH', 'wrong receiver private key is refused');
  const rsa = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  throwsCode(() => Possession.createReceiver(Object.assign(copy(fixture.receiverOptions), { privateKeyPem: privateKeyPem(rsa) })), 'PRIVATE_KEY_INVALID', 'non-Ed25519 receiver private key is refused');
  throwsCode(() => Possession.createChallenger({ challengerId: 'challenger:rsa', privateKeyPem: privateKeyPem(rsa) }), 'PRIVATE_KEY_INVALID', 'non-Ed25519 challenger private key is refused');
  throwsCode(() => Possession.createReceiver(Object.assign(copy(fixture.receiverOptions), { challengerPublicKeyPem: publicKeyPem(rsa) })), 'PUBLIC_KEY_INVALID', 'non-Ed25519 challenger public key is refused');

  throwsCode(() => receiverService.answer(answerInput(fixture, issue(fixture, 0x4f), { recordFileName: '../escape.json' })), 'PATH_REFUSED', 'custody path traversal is refused');
  throwsCode(() => receiverService.answer(answerInput(fixture, issue(fixture, 0x50), { recordFileName: '0'.repeat(64) + '.json' })), 'CUSTODY_RECORD_MISSING', 'missing custody record is refused');
  throwsCode(() => Possession.createReceiver(Object.assign(copy(fixture.receiverOptions), { stateRoot: 'relative' })), 'STATE_ROOT_INVALID', 'relative state root is refused');
  throwsCode(() => Possession.createReceiver(Object.assign(copy(fixture.receiverOptions), { stateRoot: path.parse(tempRoot).root })), 'STATE_ROOT_INVALID', 'filesystem root is refused');
  const stateFile = path.join(tempRoot, 'not-a-directory.txt');
  fs.writeFileSync(stateFile, 'x');
  throwsCode(() => Possession.createReceiver(Object.assign(copy(fixture.receiverOptions), { stateRoot: stateFile })), 'STATE_ROOT_INVALID', 'file state root is refused');

  const custodyPath = path.join(fixture.receiverOptions.stateRoot, Custody.NAMESPACE, Custody.RECORDS_DIRECTORY, fixture.custodyResult.recordFileName);
  const custodyRaw = fs.readFileSync(custodyPath, 'utf8');
  fs.writeFileSync(custodyPath, JSON.stringify(JSON.parse(custodyRaw), null, 2) + '\n');
  throwsCode(() => Possession.createReceiver(reloadOptions).reload(copy(reloadInput)), 'CUSTODY_RECORD_INVALID', 'noncanonical custody record is refused');
  fs.writeFileSync(custodyPath, custodyRaw);

  const responseOriginal = fs.readFileSync(responsePath, 'utf8');
  fs.writeFileSync(responsePath, JSON.stringify(JSON.parse(responseOriginal), null, 2) + '\n');
  throwsCode(() => Possession.createReceiver(reloadOptions).reload(copy(reloadInput)), 'RESPONSE_INVALID', 'noncanonical response is refused');
  fs.writeFileSync(responsePath, responseOriginal);
  const changedResponse = JSON.parse(responseOriginal);
  changedResponse.responseSignature = changedResponse.responseSignature.slice(0, -2) + 'AA';
  fs.writeFileSync(responsePath, Possession.stableStringify(changedResponse) + '\n');
  throwsCode(() => Possession.createReceiver(reloadOptions).reload(copy(reloadInput)), 'SIGNATURE_INVALID', 'tampered response signature is refused');
  fs.writeFileSync(responsePath, responseOriginal);
  throwsCode(() => Possession.createReceiver(reloadOptions).reload(Object.assign(copy(reloadInput), { challenge: copy(secondChallenge) })), 'CHALLENGE_MISMATCH', 'reload refuses a different expected challenge');
  throwsCode(() => Possession.createReceiver(reloadOptions).reload(Object.assign(copy(reloadInput), { loadedAt: '2026-08-20T15:20:59.000Z' })), 'INVALID_TIME', 'reload cannot predate response');
  throwsCode(() => Possession.createReceiver(reloadOptions).reload(Object.assign(copy(reloadInput), { responseFileName: '../escape.json' })), 'PATH_REFUSED', 'response path traversal is refused');
  throwsCode(() => Possession.createReceiver(reloadOptions).reload(Object.assign(copy(reloadInput), { responseFileName: '0'.repeat(64) + '.json' })), 'RESPONSE_MISSING', 'missing response is refused');

  const oversizedName = 'f'.repeat(64) + '.json';
  const oversizedPath = path.join(fixture.receiverOptions.stateRoot, Possession.NAMESPACE, Possession.ANSWERS_DIRECTORY, oversizedName);
  fs.writeFileSync(oversizedPath, ' '.repeat(Possession.MAX_RESPONSE_CANONICAL_BYTES + 2));
  throwsCode(() => Possession.createReceiver(reloadOptions).reload(Object.assign(copy(reloadInput), { responseFileName: oversizedName })), 'RESPONSE_TOO_LARGE', 'oversized response file is refused');
  fs.unlinkSync(oversizedPath);

  const challengeSchema = JSON.parse(fs.readFileSync(path.join(__dirname, 'model-shadow-review-challenge-transition-local-possession-challenge.schema.json'), 'utf8'));
  const responseSchema = JSON.parse(fs.readFileSync(path.join(__dirname, 'model-shadow-review-challenge-transition-local-possession-response-record.schema.json'), 'utf8'));
  const receiptSchema = JSON.parse(fs.readFileSync(path.join(__dirname, 'model-shadow-review-challenge-transition-local-possession-receipt.schema.json'), 'utf8'));
  const reloadSchema = JSON.parse(fs.readFileSync(path.join(__dirname, 'model-shadow-review-challenge-transition-local-possession-reload-receipt.schema.json'), 'utf8'));
  const contract = JSON.parse(fs.readFileSync(path.join(__dirname, 'module.contract.json'), 'utf8'));
  equal(challengeSchema.$id, Possession.CHALLENGE_SCHEMA, 'challenge schema id matches runtime');
  equal(responseSchema.$id, Possession.RESPONSE_RECORD_SCHEMA, 'response schema id matches runtime');
  equal(receiptSchema.$id, Possession.RECEIPT_SCHEMA, 'receipt schema id matches runtime');
  equal(reloadSchema.$id, Possession.RELOAD_RECEIPT_SCHEMA, 'reload schema id matches runtime');
  equal(challengeSchema.additionalProperties, false, 'challenge schema closes unknown fields');
  equal(responseSchema.additionalProperties, false, 'response schema closes unknown fields');
  equal(receiptSchema.additionalProperties, false, 'receipt schema closes unknown fields');
  equal(reloadSchema.additionalProperties, false, 'reload schema closes unknown fields');
  equal(responseSchema.$defs.truth.additionalProperties, false, 'response truth is closed');
  equal(receiptSchema.$defs.truth.properties.retentionDurationProven.const, false, 'receipt schema forbids retention claim');
  equal(reloadSchema.properties.truth.properties.freshProcessProvenByReceipt.const, false, 'reload schema separates external process evidence');
  equal(contract.id, 'model-shadow-review-challenge-transition-local-possession-challenge', 'contract id is exact');
  equal(contract.status, 'TEST', 'contract status remains TEST');
  equal(contract.lifecycle.installed, false, 'contract remains uninstalled');
  equal(contract.lifecycle.promoted, false, 'contract remains unpromoted');
  ok(contract.boundaries.refuses.includes('caller-times-as-externally-trusted-time-or-retention-duration-proof'), 'contract refuses trusted-time substitution');
  ok(contract.boundaries.refuses.includes('existing-response-refusal-as-protected-monotonic-state-or-deletion-rollback-resistance'), 'contract refuses rollback substitution');
  ok(contract.boundaries.refuses.includes('automatic-canon'), 'contract refuses automatic CANON');

  const source = fs.readFileSync(path.join(__dirname, 'model-shadow-review-challenge-transition-local-possession-challenge.js'), 'utf8');
  equal(source.includes("require('net')"), false, 'runtime opens no net module');
  equal(source.includes("require('http')"), false, 'runtime opens no HTTP module');
  equal(source.includes("require('child_process')"), false, 'runtime spawns no processes');
  equal(source.includes('automaticCanon: true'), false, 'runtime never declares automatic CANON');
  equal(source.includes('retentionDurationProven: true'), false, 'runtime never declares retention duration proved');
  equal(source.includes('deletionOrRollbackPrevented: true'), false, 'runtime never declares rollback prevention');
  equal(source.includes('providerExecutionProven: true'), false, 'runtime never declares provider execution');

  const finalReload = Possession.createReceiver(reloadOptions).reload(copy(reloadInput));
  equal(finalReload.receiptDigest, reload.receiptDigest, 'restored files reproduce exact reload receipt');
  const expectedPrefix = path.resolve(os.tmpdir()) + path.sep;
  ok(path.resolve(tempRoot).startsWith(expectedPrefix), 'synthetic cleanup root stays under OS temp');
  ok(path.basename(tempRoot).startsWith('axm-local-possession-challenge-'), 'synthetic cleanup root has fixed prefix');
  cleanupVerified = true;
} finally {
  if (cleanupVerified) fs.rmSync(tempRoot, { recursive: true, force: false });
}

console.log('model shadow local possession challenge self-test passed: ' + checks + ' checks');
