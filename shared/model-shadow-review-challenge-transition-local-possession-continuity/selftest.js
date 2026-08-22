#!/usr/bin/env node
'use strict';

const assert = require('assert');
const childProcess = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Custody = require('../model-shadow-review-challenge-transition-local-receiver-custody/model-shadow-review-challenge-transition-local-receiver-custody');
const Possession = require('../model-shadow-review-challenge-transition-local-possession-challenge/model-shadow-review-challenge-transition-local-possession-challenge');
const Continuity = require('./model-shadow-review-challenge-transition-local-possession-continuity');
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

function runChild(input) {
  const result = childProcess.spawnSync(process.execPath, [path.join(__dirname, 'selftest-child.js')], {
    input: JSON.stringify(input),
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024
  });
  if (result.status !== 0) throw new Error('child failed: ' + result.stderr + result.stdout);
  return JSON.parse(result.stdout);
}

function audit(checkpoint, snapshot, tag, checkedAt) {
  return Continuity.buildAudit({
    auditId: 'local-possession-audit:' + tag,
    checkedAt,
    priorCheckpoint: copy(checkpoint),
    currentSnapshot: copy(snapshot)
  });
}

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'axm-local-possession-continuity-'));
let cleanupVerified = false;

try {
  const fixture = Fixture.buildFixture(tempRoot);
  const possession = fixture.possession;
  const answersDir = path.join(possession.receiverOptions.stateRoot, Possession.NAMESPACE, Possession.ANSWERS_DIRECTORY);
  const firstPath = path.join(answersDir, fixture.first.responseFileName);
  const firstBytes = fs.readFileSync(firstPath);

  equal(Continuity.VERSION, '1.4.0', 'version is exact');
  equal(Continuity.STATUS, 'TEST', 'status remains TEST');
  equal(Continuity.MAX_ENTRIES, 64, 'response inventory bound is exact');
  equal(Continuity.MAX_ERRORS, 64, 'error inventory bound is exact');
  equal(Continuity.MAX_ARTIFACT_CANONICAL_BYTES, 524288, 'artifact byte bound is exact');
  equal(Continuity.responseFileName(fixture.first.responsePackage.challenge.challengeId, fixture.first.responsePackage.receiverId), fixture.first.responseFileName, 'response filename re-derives from signed identity');
  equal(Continuity.custodyRecordFileName(fixture.first.responsePackage.custodyRecordRef), possession.custodyResult.recordFileName, 'custody filename re-derives from signed custody id');

  const baseSnapshot = Continuity.captureState(copy(fixture.continuityOptions));
  equal(baseSnapshot.schema, Continuity.SNAPSHOT_SCHEMA, 'base snapshot schema is exact');
  equal(baseSnapshot.status, 'TEST', 'base snapshot remains TEST');
  equal(baseSnapshot.availability, 'AVAILABLE', 'base response state is available');
  equal(baseSnapshot.entryCount, 1, 'base snapshot inventories one response');
  equal(baseSnapshot.entries[0].responseFileName, fixture.first.responseFileName, 'base snapshot binds exact derived response filename');
  equal(baseSnapshot.entries[0].responseRef.sha256, fixture.first.responsePackage.responseDigest, 'base snapshot binds exact response digest');
  equal(baseSnapshot.entries[0].challengeRef.sha256, fixture.first.responsePackage.challenge.challengeDigest, 'base snapshot binds exact challenge digest');
  equal(baseSnapshot.entries[0].custodyRecordRef, possession.custodyResult.receiverReceipt.custodyRecordRef, 'base snapshot binds exact custody reference');
  equal(baseSnapshot.truth.readOnlyObservation, true, 'snapshot is read-only observation');
  equal(baseSnapshot.truth.strictV13ResponseReloadVerified, true, 'snapshot reports strict v1.3 reload');
  equal(baseSnapshot.truth.responseFilenameIdentityVerified, true, 'snapshot reports filename identity verification');
  equal(baseSnapshot.truth.responseSetCanonicalAndUnique, true, 'snapshot reports canonical unique inventory');
  equal(baseSnapshot.truth.rollbackOrDeletionPrevented, false, 'snapshot claims no rollback prevention');
  equal(Continuity.verifySnapshot(baseSnapshot).pass, true, 'base snapshot exact-verifies');
  equal(Continuity.buildSnapshot({
    observationId: baseSnapshot.observationId,
    observedAt: baseSnapshot.observedAt,
    availability: baseSnapshot.availability,
    receiverIdDigest: baseSnapshot.receiverIdDigest,
    challengerIdDigest: baseSnapshot.challengerIdDigest,
    receiverPolicyRef: baseSnapshot.receiverPolicyRef,
    entries: copy(baseSnapshot.entries),
    errors: []
  }), baseSnapshot, 'base snapshot exact-rebuilds from bounded input');

  const baseCheckpoint = Continuity.buildCheckpoint({
    checkpointId: 'local-possession-checkpoint:base',
    anchoredAt: '2026-08-20T15:22:30.000Z',
    currentSnapshot: copy(baseSnapshot)
  });
  equal(baseCheckpoint.schema, Continuity.CHECKPOINT_SCHEMA, 'checkpoint schema is exact');
  equal(baseCheckpoint.entryCount, 1, 'checkpoint retains one response entry');
  equal(baseCheckpoint.entriesDigest, baseSnapshot.entriesDigest, 'checkpoint binds exact response set');
  equal(baseCheckpoint.truth.callerRetentionRequiredForFutureComparison, true, 'checkpoint makes caller retention precondition explicit');
  equal(baseCheckpoint.truth.checkpointStoredByModule, false, 'module stores no checkpoint');
  equal(baseCheckpoint.truth.checkpointAuthorityAuthenticated, false, 'checkpoint authenticates no authority');
  equal(baseCheckpoint.truth.checkpointRetentionProven, false, 'checkpoint proves no external retention');
  equal(baseCheckpoint.truth.rollbackOrDeletionPrevented, false, 'checkpoint prevents no rollback');
  equal(Continuity.verifyCheckpoint(baseCheckpoint).pass, true, 'checkpoint exact-verifies');

  const checkpointRoot = path.join(tempRoot, 'caller-checkpoint');
  fs.mkdirSync(checkpointRoot);
  const checkpointPath = path.join(checkpointRoot, 'checkpoint.json');
  fs.writeFileSync(checkpointPath, Continuity.stableStringify(baseCheckpoint) + '\n', { encoding: 'utf8', mode: 0o600 });
  equal(JSON.parse(fs.readFileSync(checkpointPath, 'utf8')), baseCheckpoint, 'caller-retained checkpoint bytes exact-reload');

  const exactChild = runChild({
    action: 'captureAndAudit',
    options: Fixture.observationOptions(fixture, 'local-possession-observation:exact-child', '2026-08-20T15:22:45.000Z'),
    priorCheckpoint: baseCheckpoint,
    auditId: 'local-possession-audit:exact-child',
    checkedAt: '2026-08-20T15:23:00.000Z'
  });
  ok(exactChild.pid !== process.pid, 'exact audit captures in a distinct child process');
  equal(exactChild.snapshot.availability, 'AVAILABLE', 'fresh process sees available exact state');
  equal(exactChild.audit.schema, Continuity.AUDIT_SCHEMA, 'audit schema is exact');
  equal(exactChild.audit.decision.classification, 'CURRENT_RESPONSE_SET_MATCHES_PRESENTED_CHECKPOINT', 'fresh process sees exact checkpoint match');
  equal(exactChild.audit.decision.reviewRequired, false, 'exact match requires no continuity repair');
  equal(exactChild.audit.decision.autonomousActionCount, 0, 'audit performs no autonomous action');
  equal(exactChild.audit.truth.presentedCheckpointProvesExternalRetention, false, 'presented checkpoint proves no external retention');
  equal(exactChild.audit.truth.rollbackOrDeletionPrevented, false, 'exact comparison prevents no rollback');
  equal(Continuity.verifyAudit({ auditId: 'local-possession-audit:exact-child', checkedAt: '2026-08-20T15:23:00.000Z', priorCheckpoint: baseCheckpoint, currentSnapshot: exactChild.snapshot }, exactChild.audit).pass, true, 'exact audit exact-verifies');

  const secondChallenge = Fixture.issueChallenge(fixture, 0x42);
  const second = Fixture.answer(fixture, secondChallenge, '2026-08-20T15:23:00.000Z');
  const secondPath = path.join(answersDir, second.responseFileName);
  const secondBytes = fs.readFileSync(secondPath);
  const extendedSnapshot = Continuity.captureState(Fixture.observationOptions(fixture, 'local-possession-observation:extended', '2026-08-20T15:24:00.000Z'));
  equal(extendedSnapshot.availability, 'AVAILABLE', 'extended response state remains available');
  equal(extendedSnapshot.entryCount, 2, 'extended snapshot inventories two responses');
  const extensionAudit = audit(baseCheckpoint, extendedSnapshot, 'extension', '2026-08-20T15:24:30.000Z');
  equal(extensionAudit.decision.classification, 'CURRENT_RESPONSE_SET_EXTENDS_PRESENTED_CHECKPOINT', 'second challenge is classified as checkpoint extension');
  equal(extensionAudit.comparison.addedCurrentChallenges.length, 1, 'extension identifies one added challenge');
  equal(extensionAudit.comparison.missingCheckpointChallenges.length, 0, 'extension loses no checkpoint challenge');
  equal(extensionAudit.truth.rollbackOrReplacementDetectedAgainstPresentedCheckpoint, false, 'extension is not mislabeled rollback');

  const extendedCheckpoint = Continuity.buildCheckpoint({
    checkpointId: 'local-possession-checkpoint:extended',
    anchoredAt: '2026-08-20T15:25:00.000Z',
    currentSnapshot: extendedSnapshot
  });
  equal(extendedCheckpoint.entryCount, 2, 'extended checkpoint retains both responses');

  fs.unlinkSync(secondPath);
  const rollbackChild = runChild({
    action: 'captureAndAudit',
    options: Fixture.observationOptions(fixture, 'local-possession-observation:rollback', '2026-08-20T15:26:00.000Z'),
    priorCheckpoint: extendedCheckpoint,
    auditId: 'local-possession-audit:rollback',
    checkedAt: '2026-08-20T15:26:30.000Z'
  });
  equal(rollbackChild.snapshot.availability, 'AVAILABLE', 'one-entry rolled-back state remains structurally available');
  equal(rollbackChild.audit.decision.classification, 'ROLLBACK_OR_REPLACEMENT_DETECTED_AGAINST_PRESENTED_CHECKPOINT', 'missing response is detected relative to checkpoint');
  equal(rollbackChild.audit.comparison.missingCheckpointChallenges.length, 1, 'relative rollback names one missing challenge');
  equal(rollbackChild.audit.comparison.missingCheckpointChallenges[0], secondChallenge.challengeDigest, 'relative rollback names exact missing challenge digest');
  equal(rollbackChild.audit.decision.reviewRequired, true, 'relative rollback requires review');
  equal(rollbackChild.audit.decision.autonomousActionCount, 0, 'relative rollback performs no repair');
  equal(rollbackChild.audit.truth.rollbackOrReplacementDetectedAgainstPresentedCheckpoint, true, 'relative rollback truth is explicit');
  equal(rollbackChild.audit.truth.rollbackOrDeletionPrevented, false, 'relative rollback detection is not prevention');
  fs.writeFileSync(secondPath, secondBytes);

  const custodyPath = path.join(possession.receiverOptions.stateRoot, Custody.NAMESPACE, Custody.RECORDS_DIRECTORY, possession.custodyResult.recordFileName);
  const custodyRecord = JSON.parse(fs.readFileSync(custodyPath, 'utf8'));
  const validatedCustody = Custody.validateCustodyRecord(custodyRecord, possession.receiver.policy, possession.receiverKey.receiverId);
  const alternateSecond = Possession.buildResponseRecord(validatedCustody.record, validatedCustody.policy, secondChallenge, '2026-08-20T15:24:00.000Z', possession.receiverKey.privateKey);
  fs.writeFileSync(secondPath, Possession.stableStringify(alternateSecond) + '\n');
  const replacementSnapshot = Continuity.captureState(Fixture.observationOptions(fixture, 'local-possession-observation:replacement', '2026-08-20T15:27:00.000Z'));
  equal(replacementSnapshot.availability, 'AVAILABLE', 'valid receiver-signed replacement remains structurally available');
  const replacementAudit = audit(extendedCheckpoint, replacementSnapshot, 'replacement', '2026-08-20T15:27:30.000Z');
  equal(replacementAudit.decision.classification, 'ROLLBACK_OR_REPLACEMENT_DETECTED_AGAINST_PRESENTED_CHECKPOINT', 'valid changed response is detected relative to checkpoint');
  equal(replacementAudit.comparison.replacedCheckpointEntries.length, 1, 'replacement audit identifies one changed response');
  equal(replacementAudit.comparison.replacedCheckpointEntries[0].challengeDigest, secondChallenge.challengeDigest, 'replacement binds exact challenge');
  ok(replacementAudit.comparison.replacedCheckpointEntries[0].currentResponseDigest !== replacementAudit.comparison.replacedCheckpointEntries[0].checkpointResponseDigest, 'replacement exposes both response digests');
  fs.writeFileSync(secondPath, secondBytes);

  fs.writeFileSync(secondPath, firstBytes);
  const genericReload = Possession.createReceiver(Object.assign(copy(possession.receiverOptions), { privateKeyPem: null })).reload({
    responseFileName: second.responseFileName,
    recordFileName: possession.custodyResult.recordFileName,
    receiverPolicy: copy(possession.receiver.policy),
    challenge: copy(possession.challenge),
    loadedAt: '2026-08-20T15:28:00.000Z'
  });
  equal(genericReload.responseRef.sha256, fixture.first.responsePackage.responseDigest, 'v1.3 counterexample accepts valid response copied under another well-formed filename');
  const misnamedSnapshot = Continuity.captureState(Fixture.observationOptions(fixture, 'local-possession-observation:misnamed', '2026-08-20T15:28:00.000Z'));
  equal(misnamedSnapshot.availability, 'INVALID', 'v1.4 strict inventory rejects copied response under wrong filename');
  ok(misnamedSnapshot.errors.includes('RESPONSE_VALIDATION_FAILED_RESPONSE_FILENAME_IDENTITY_MISMATCH'), 'strict inventory names filename identity mismatch');
  equal(misnamedSnapshot.truth.responseFilenameIdentityVerified, false, 'invalid snapshot claims no filename verification');
  const misnamedAudit = audit(extendedCheckpoint, misnamedSnapshot, 'misnamed', '2026-08-20T15:28:30.000Z');
  equal(misnamedAudit.decision.classification, 'HOLD_CURRENT_LOCAL_POSSESSION_STATE_INVALID', 'misnamed state becomes an invalid-state hold');
  equal(misnamedAudit.truth.currentInvalidityDetected, true, 'misnamed-state invalidity truth is explicit');
  fs.writeFileSync(secondPath, secondBytes);

  const noncanonical = JSON.stringify(JSON.parse(secondBytes.toString('utf8')), null, 2) + '\n';
  fs.writeFileSync(secondPath, noncanonical);
  const noncanonicalSnapshot = Continuity.captureState(Fixture.observationOptions(fixture, 'local-possession-observation:noncanonical', '2026-08-20T15:29:00.000Z'));
  equal(noncanonicalSnapshot.availability, 'INVALID', 'noncanonical response state is invalid');
  ok(noncanonicalSnapshot.errors.includes('RESPONSE_VALIDATION_FAILED_RESPONSE_NONCANONICAL'), 'noncanonical response error is typed');
  fs.writeFileSync(secondPath, secondBytes);

  const tampered = JSON.parse(secondBytes.toString('utf8'));
  tampered.responseSignature = tampered.responseSignature.slice(0, -2) + 'AA';
  fs.writeFileSync(secondPath, Possession.stableStringify(tampered) + '\n');
  const tamperedSnapshot = Continuity.captureState(Fixture.observationOptions(fixture, 'local-possession-observation:tampered', '2026-08-20T15:29:15.000Z'));
  equal(tamperedSnapshot.availability, 'INVALID', 'tampered response state is invalid');
  ok(tamperedSnapshot.errors.includes('RESPONSE_VALIDATION_FAILED_SIGNATURE_INVALID'), 'tampered response signature error is typed');
  fs.writeFileSync(secondPath, secondBytes);

  const unexpectedPath = path.join(answersDir, 'unexpected.txt');
  fs.writeFileSync(unexpectedPath, 'x');
  const unexpectedSnapshot = Continuity.captureState(Fixture.observationOptions(fixture, 'local-possession-observation:unexpected', '2026-08-20T15:29:30.000Z'));
  equal(unexpectedSnapshot.availability, 'INVALID', 'unexpected response filename invalidates state');
  ok(unexpectedSnapshot.errors.includes('RESPONSE_UNEXPECTED_ENTRY_NAME'), 'unexpected response filename is typed');
  fs.unlinkSync(unexpectedPath);

  const namespacePath = path.join(possession.receiverOptions.stateRoot, Possession.NAMESPACE);
  const namespaceBackup = path.join(possession.receiverOptions.stateRoot, Possession.NAMESPACE + '-backup');
  fs.renameSync(namespacePath, namespaceBackup);
  const absentSnapshot = Continuity.captureState(Fixture.observationOptions(fixture, 'local-possession-observation:absent', '2026-08-20T15:30:00.000Z'));
  equal(absentSnapshot.availability, 'ABSENT', 'whole namespace absence is typed');
  ok(absentSnapshot.errors.includes('RESPONSE_NAMESPACE_ABSENT'), 'whole namespace absence has exact error');
  equal(absentSnapshot.truth.currentAbsenceClaimedAsNeverExisted, false, 'absence is not mislabeled never existed');
  const absentAudit = audit(extendedCheckpoint, absentSnapshot, 'absent', '2026-08-20T15:30:30.000Z');
  equal(absentAudit.decision.classification, 'HOLD_LOCAL_POSSESSION_STATE_ABSENT_AGAINST_PRESENTED_CHECKPOINT', 'whole namespace absence becomes checkpoint-relative hold');
  equal(absentAudit.truth.currentAbsenceDetectedAgainstPresentedCheckpoint, true, 'absence against checkpoint truth is explicit');
  fs.renameSync(namespaceBackup, namespacePath);

  const identitySnapshot = Continuity.buildSnapshot({
    observationId: 'local-possession-observation:identity-drift',
    observedAt: '2026-08-20T15:31:00.000Z',
    availability: 'AVAILABLE',
    receiverIdDigest: 'sha256:' + 'a'.repeat(64),
    challengerIdDigest: extendedSnapshot.challengerIdDigest,
    receiverPolicyRef: extendedSnapshot.receiverPolicyRef,
    entries: extendedSnapshot.entries,
    errors: []
  });
  const identityAudit = audit(extendedCheckpoint, identitySnapshot, 'identity', '2026-08-20T15:31:30.000Z');
  equal(identityAudit.decision.classification, 'HOLD_LOCAL_POSSESSION_IDENTITY_CHANGED', 'configured identity drift becomes a hold');
  equal(identityAudit.comparison.identityMatches, false, 'identity mismatch is explicit');
  equal(identityAudit.truth.comparisonBoundToExactConfiguredIdentity, false, 'identity drift is not compared as same set');

  const tamperedCheckpoint = copy(extendedCheckpoint);
  tamperedCheckpoint.entryCount = 1;
  equal(Continuity.verifyCheckpoint(tamperedCheckpoint).pass, false, 'checkpoint summary tampering is detected');
  const authorityTamper = copy(extendedCheckpoint);
  authorityTamper.truth.checkpointAuthorityAuthenticated = true;
  authorityTamper.checkpointDigest = Continuity.sha256((() => { const value = copy(authorityTamper); delete value.checkpointDigest; return value; })());
  equal(Continuity.verifyCheckpoint(authorityTamper).pass, false, 'checkpoint authority tamper fails even with recomputed digest');
  const reorderedCheckpoint = copy(extendedCheckpoint);
  reorderedCheckpoint.entries.reverse();
  reorderedCheckpoint.entriesDigest = Continuity.sha256(reorderedCheckpoint.entries);
  reorderedCheckpoint.checkpointDigest = Continuity.sha256((() => { const value = copy(reorderedCheckpoint); delete value.checkpointDigest; return value; })());
  equal(Continuity.verifyCheckpoint(reorderedCheckpoint).pass, false, 'checkpoint refuses noncanonical entry order');
  const snapshotTamper = copy(extendedSnapshot);
  snapshotTamper.truth.rollbackOrDeletionPrevented = true;
  snapshotTamper.snapshotDigest = Continuity.sha256((() => { const value = copy(snapshotTamper); delete value.snapshotDigest; return value; })());
  equal(Continuity.verifySnapshot(snapshotTamper).pass, false, 'snapshot refuses invented rollback prevention even with recomputed digest');
  throwsCode(() => Continuity.buildAudit({ auditId: 'audit:invalid-checkpoint', checkedAt: '2026-08-20T15:32:00.000Z', priorCheckpoint: tamperedCheckpoint, currentSnapshot: extendedSnapshot }), 'CHECKPOINT_INVALID', 'invalid checkpoint cannot drive audit');
  throwsCode(() => Continuity.buildCheckpoint({ checkpointId: 'checkpoint:early', anchoredAt: '2026-08-20T15:23:59.000Z', currentSnapshot: extendedSnapshot }), 'INVALID_TIME', 'checkpoint cannot predate source snapshot');
  const emptySnapshot = Continuity.buildSnapshot({
    observationId: 'local-possession-observation:empty',
    observedAt: '2026-08-20T15:32:00.000Z',
    availability: 'AVAILABLE',
    receiverIdDigest: extendedSnapshot.receiverIdDigest,
    challengerIdDigest: extendedSnapshot.challengerIdDigest,
    receiverPolicyRef: extendedSnapshot.receiverPolicyRef,
    entries: [],
    errors: []
  });
  throwsCode(() => Continuity.buildCheckpoint({ checkpointId: 'checkpoint:empty', anchoredAt: '2026-08-20T15:32:00.000Z', currentSnapshot: emptySnapshot }), 'CHECKPOINT_SOURCE_INVALID', 'empty available state cannot form checkpoint');
  throwsCode(() => Continuity.buildSnapshot({
    observationId: 'observation:over-bound', observedAt: '2026-08-20T15:32:00.000Z', availability: 'AVAILABLE',
    receiverIdDigest: extendedSnapshot.receiverIdDigest, challengerIdDigest: extendedSnapshot.challengerIdDigest,
    receiverPolicyRef: extendedSnapshot.receiverPolicyRef, entries: Array(65).fill(extendedSnapshot.entries[0]), errors: []
  }), 'RESOURCE_BOUND_EXCEEDED', 'snapshot refuses response count over bound');
  const hugeSnapshot = copy(extendedSnapshot);
  hugeSnapshot.extra = 'x'.repeat(Continuity.MAX_ARTIFACT_CANONICAL_BYTES);
  throwsCode(() => Continuity.validateSnapshot(hugeSnapshot), 'ARTIFACT_TOO_LARGE', 'snapshot refuses oversized artifact before field processing');

  const relativeSnapshot = Continuity.captureState(Fixture.observationOptions(fixture, 'observation:relative', '2026-08-20T15:32:30.000Z', { stateRoot: 'relative' }));
  equal(relativeSnapshot.availability, 'INVALID', 'relative state root becomes typed invalid snapshot');
  ok(relativeSnapshot.errors.includes('STATE_ROOT_NOT_ABSOLUTE'), 'relative state root error is exact');
  const missingSnapshot = Continuity.captureState(Fixture.observationOptions(fixture, 'observation:missing-root', '2026-08-20T15:32:30.000Z', { stateRoot: path.join(tempRoot, 'missing-root') }));
  equal(missingSnapshot.availability, 'INVALID', 'missing state root becomes typed invalid snapshot');
  ok(missingSnapshot.errors.includes('STATE_ROOT_UNAVAILABLE'), 'missing state root error is exact');
  throwsCode(() => Continuity.captureState(Object.assign(copy(fixture.continuityOptions), { privateKeyPem: possession.receiverOptions.privateKeyPem })), 'INVALID_INPUT', 'observer refuses private key input');
  throwsCode(() => Continuity.captureState(Fixture.observationOptions(fixture, 'observation:wrong-receiver', '2026-08-20T15:32:30.000Z', { receiverId: 'receiver:not-declared' })), 'RECEIVER_INVALID', 'observer refuses receiver outside policy');
  const earlySnapshot = Continuity.captureState(Fixture.observationOptions(fixture, 'observation:early', '2026-08-20T15:20:00.000Z'));
  equal(earlySnapshot.availability, 'INVALID', 'observation before responses is invalid');
  ok(earlySnapshot.errors.some(code => code.includes('INVALID_TIME')), 'early observation retains typed time failure');

  const snapshotSerialized = Continuity.stableStringify(extendedSnapshot);
  const checkpointSerialized = Continuity.stableStringify(extendedCheckpoint);
  const auditSerialized = Continuity.stableStringify(extensionAudit);
  [snapshotSerialized, checkpointSerialized, auditSerialized].forEach((serialized, index) => {
    equal(serialized.includes(possession.receiverKey.receiverId), false, 'public artifact ' + index + ' omits raw receiver label');
    equal(serialized.includes(possession.challenger.challengerId), false, 'public artifact ' + index + ' omits raw challenger label');
    equal(serialized.includes(possession.receiverKey.publicKeyPem), false, 'public artifact ' + index + ' omits raw receiver public key');
    equal(serialized.includes(possession.receiverOptions.challengerPublicKeyPem), false, 'public artifact ' + index + ' omits raw challenger public key');
    equal(serialized.includes(fixture.first.responsePackage.responseSignature), false, 'public artifact ' + index + ' omits raw response signature');
    equal(serialized.includes(possession.receiverOptions.stateRoot), false, 'public artifact ' + index + ' omits machine path');
  });

  const snapshotSchema = JSON.parse(fs.readFileSync(path.join(__dirname, 'model-shadow-review-challenge-transition-local-possession-snapshot.schema.json'), 'utf8'));
  const checkpointSchema = JSON.parse(fs.readFileSync(path.join(__dirname, 'model-shadow-review-challenge-transition-local-possession-checkpoint.schema.json'), 'utf8'));
  const auditSchema = JSON.parse(fs.readFileSync(path.join(__dirname, 'model-shadow-review-challenge-transition-local-possession-continuity.schema.json'), 'utf8'));
  const contract = JSON.parse(fs.readFileSync(path.join(__dirname, 'module.contract.json'), 'utf8'));
  equal(snapshotSchema.$id, Continuity.SNAPSHOT_SCHEMA, 'snapshot schema identity matches implementation');
  equal(checkpointSchema.$id, Continuity.CHECKPOINT_SCHEMA, 'checkpoint schema identity matches implementation');
  equal(auditSchema.$id, Continuity.AUDIT_SCHEMA, 'audit schema identity matches implementation');
  equal(snapshotSchema.additionalProperties, false, 'snapshot schema closes unknown fields');
  equal(checkpointSchema.additionalProperties, false, 'checkpoint schema closes unknown fields');
  equal(auditSchema.additionalProperties, false, 'audit schema closes unknown fields');
  equal(snapshotSchema.$defs.truth.properties.rollbackOrDeletionPrevented.const, false, 'snapshot schema keeps rollback prevention false');
  equal(checkpointSchema.$defs.truth.properties.checkpointRetentionProven.const, false, 'checkpoint schema keeps external retention false');
  equal(auditSchema.$defs.truth.properties.protectedMonotonicStateProven.const, false, 'audit schema keeps protected monotonic state false');
  equal(auditSchema.$defs.decision.properties.autonomousActionCount.const, 0, 'audit schema prevents autonomous repair');
  equal(contract.id, 'model-shadow-review-challenge-transition-local-possession-continuity', 'contract id is exact');
  equal(contract.status, 'TEST', 'contract remains TEST');
  equal(contract.permissions.length, 1, 'contract declares one bounded read permission');
  equal(contract.boundaries.writes.length, 0, 'contract declares no write surface');
  equal(contract.lifecycle.installed, false, 'contract remains uninstalled');
  equal(contract.lifecycle.promoted, false, 'contract remains unpromoted');
  ok(contract.boundaries.refuses.includes('valid-response-artifact-copied-under-another-response-filename'), 'contract preserves v1.3 filename counterexample');
  ok(contract.boundaries.refuses.includes('relative-rollback-detection-as-rollback-prevention'), 'contract refuses detection as prevention');
  ok(contract.boundaries.refuses.includes('caller-checkpoint-as-proven-external-retention'), 'contract refuses checkpoint as external retention');
  ok(contract.boundaries.refuses.includes('automatic-canon'), 'contract refuses automatic CANON');

  const source = fs.readFileSync(path.join(__dirname, 'model-shadow-review-challenge-transition-local-possession-continuity.js'), 'utf8');
  equal(source.includes('fs.writeFileSync'), false, 'runtime performs no file write');
  equal(source.includes('fs.openSync'), false, 'runtime performs no file open for write');
  equal(source.includes('fs.mkdirSync'), false, 'runtime creates no directory');
  equal(source.includes("require('child_process')"), false, 'runtime spawns no process');
  equal(source.includes("require('net')"), false, 'runtime opens no network route');
  equal(source.includes('rollbackOrDeletionPrevented: true'), false, 'runtime never declares rollback prevention');
  equal(source.includes('presentedCheckpointProvesExternalRetention: true'), false, 'runtime never declares external checkpoint retention');
  equal(source.includes('automaticCanon: true'), false, 'runtime never declares automatic CANON');

  const restoredSnapshot = Continuity.captureState(Fixture.observationOptions(fixture, 'local-possession-observation:restored', '2026-08-20T15:33:00.000Z'));
  equal(restoredSnapshot.availability, 'AVAILABLE', 'restored response state passes final strict scan');
  equal(restoredSnapshot.entryCount, 2, 'restored response state retains both entries');
  const expectedPrefix = path.resolve(os.tmpdir()) + path.sep;
  ok(path.resolve(tempRoot).startsWith(expectedPrefix), 'synthetic cleanup root stays under OS temp');
  ok(path.basename(tempRoot).startsWith('axm-local-possession-continuity-'), 'synthetic cleanup root has fixed prefix');
  cleanupVerified = true;
} finally {
  if (cleanupVerified) fs.rmSync(tempRoot, { recursive: true, force: false });
}

console.log('model shadow local possession continuity self-test passed: ' + checks + ' checks');
