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
const Continuity = require('../model-shadow-review-challenge-transition-local-possession-continuity/model-shadow-review-challenge-transition-local-possession-continuity');
const Fixture = require('../model-shadow-review-challenge-transition-local-possession-continuity/selftest-fixture');
const OldWitness = require('../model-shadow-review-challenge-witness/model-shadow-review-challenge-witness');
const Witness = require('./model-shadow-review-challenge-transition-local-possession-checkpoint-witness');

let checks = 0;

function ok(value, message) {
  assert.ok(value, message);
  checks += 1;
}

function equal(actual, expected, message) {
  assert.deepStrictEqual(actual, expected, message);
  checks += 1;
}

function throws(action, pattern, message) {
  let caught = null;
  try { action(); } catch (error) { caught = error; }
  assert.ok(caught, message + ' should throw');
  assert.match(String(caught && caught.message), pattern, message + ' message');
  checks += 2;
}

function copy(value) {
  return Fixture.copy(value);
}

function publicKeyPem(pair) {
  return pair.publicKey.export({ type: 'spki', format: 'pem' }).toString();
}

function privateKeyPem(pair) {
  return pair.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
}

function resign(attestation, pair) {
  const result = copy(attestation);
  result.signature = crypto.sign(
    null,
    Buffer.from(Witness.stableStringify(Witness.attestationSigningPayload(result)), 'utf8'),
    pair.privateKey
  ).toString('base64');
  return result;
}

function buildWitnessPackage(checkpoint, tag) {
  const pairs = [crypto.generateKeyPairSync('ed25519'), crypto.generateKeyPairSync('ed25519')];
  const policy = {
    schema: Witness.POLICY_SCHEMA,
    policyId: 'local-possession-witness-policy:' + tag,
    issuedAt: '2026-08-20T15:23:00.000Z',
    expiresAt: '2026-08-20T16:00:00.000Z',
    audience: Witness.AUDIENCE,
    scope: Witness.SCOPE,
    authorityOrigin: Witness.AUTHORITY_ORIGIN,
    checkpointRef: {
      id: checkpoint.checkpointId,
      schema: checkpoint.schema,
      sha256: checkpoint.checkpointDigest
    },
    sourceSnapshotRef: copy(checkpoint.sourceSnapshotRef),
    receiverIdDigest: checkpoint.receiverIdDigest,
    challengerIdDigest: checkpoint.challengerIdDigest,
    receiverPolicyRef: copy(checkpoint.receiverPolicyRef),
    entriesDigest: checkpoint.entriesDigest,
    requiredSignatures: 2,
    maxAttestationAgeSeconds: 3600,
    keys: pairs.map((pair, index) => ({
      keyId: 'synthetic-witness-key:' + tag + ':' + (index + 1),
      algorithm: 'Ed25519',
      publicKeyPem: publicKeyPem(pair),
      actorDigest: Witness.sha256('synthetic-witness-actor:' + tag + ':' + (index + 1)),
      actorKind: index === 0 ? 'human' : 'machine',
      scope: Witness.SCOPE,
      enabled: true
    })),
    policyDigest: null
  };
  policy.policyDigest = Witness.policyDigest(policy);
  const attestations = pairs.map((pair, index) => resign({
    schema: Witness.ATTESTATION_SCHEMA,
    attestationId: 'local-possession-witness-attestation:' + tag + ':' + (index + 1),
    keyId: policy.keys[index].keyId,
    actorDigest: policy.keys[index].actorDigest,
    actorKind: policy.keys[index].actorKind,
    verdict: 'WITNESS',
    scope: Witness.SCOPE,
    policyDigest: policy.policyDigest,
    checkpointDigest: checkpoint.checkpointDigest,
    sourceSnapshotDigest: checkpoint.sourceSnapshotRef.sha256,
    receiverIdDigest: checkpoint.receiverIdDigest,
    challengerIdDigest: checkpoint.challengerIdDigest,
    receiverPolicyDigest: checkpoint.receiverPolicyRef.sha256,
    entriesDigest: checkpoint.entriesDigest,
    issuedAt: '2026-08-20T15:23:10.000Z',
    expiresAt: '2026-08-20T15:40:00.000Z',
    signatureAlgorithm: 'Ed25519',
    signature: ''
  }, pair));
  const witnessInput = {
    witnessId: 'local-possession-checkpoint-witness:' + tag,
    verifiedAt: '2026-08-20T15:23:30.000Z',
    checkpoint: copy(checkpoint),
    keyPolicy: policy,
    signedAttestations: attestations
  };
  const witnessReceipt = Witness.buildWitness(witnessInput);
  return { pairs, witnessInput, witnessReceipt };
}

function runChild(packagePath) {
  const result = childProcess.spawnSync(process.execPath, [path.join(__dirname, 'selftest-child.js'), packagePath], {
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
    windowsHide: true
  });
  if (result.status !== 0) throw new Error('child failed: ' + result.stderr + result.stdout);
  return JSON.parse(result.stdout);
}

function recomputeCheckpoint(value) {
  const result = copy(value);
  result.checkpointDigest = null;
  const payload = copy(result);
  delete payload.checkpointDigest;
  result.checkpointDigest = Continuity.sha256(payload);
  return result;
}

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'axm-local-possession-checkpoint-witness-'));
let cleanupVerified = false;

try {
  const fixture = Fixture.buildFixture(tempRoot);
  const possession = fixture.possession;
  const answersDir = path.join(possession.receiverOptions.stateRoot, Possession.NAMESPACE, Possession.ANSWERS_DIRECTORY);
  const firstPath = path.join(answersDir, fixture.first.responseFileName);
  const firstBytes = fs.readFileSync(firstPath);

  equal(Witness.VERSION, '1.5.0', 'version is exact');
  equal(Witness.STATUS, 'TEST', 'status remains TEST');
  equal(Witness.MAX_WITNESSES, 10, 'witness seat bound is exact');
  equal(Witness.MAX_ATTESTATION_AGE_SECONDS, 86400, 'attestation age bound is exact');
  equal(Witness.MAX_ARTIFACT_CANONICAL_BYTES, 524288, 'artifact byte bound is exact');
  equal(Witness.AUTHORITY_ORIGIN, 'CALLER_SUPPLIED_UNAUTHENTICATED', 'caller policy origin is explicit');
  equal(Witness.NEXT_GATE, 'HOST_TRUSTED_WITNESS_POLICY_AND_EXTERNALLY_RETAINED_WITNESS_OR_PROTECTED_MONOTONIC_STORE', 'next gate is exact');

  const baseSnapshot = Continuity.captureState(copy(fixture.continuityOptions));
  equal(baseSnapshot.availability, 'AVAILABLE', 'v1.4 base state is available');
  equal(baseSnapshot.entryCount, 1, 'v1.4 base state contains one strict response');
  const baseCheckpoint = Continuity.buildCheckpoint({
    checkpointId: 'local-possession-checkpoint:witness-base',
    anchoredAt: '2026-08-20T15:22:30.000Z',
    currentSnapshot: baseSnapshot
  });
  equal(Continuity.verifyCheckpoint(baseCheckpoint).pass, true, 'v1.4 base checkpoint exact-verifies');
  throws(
    () => OldWitness.buildWitness(buildWitnessPackage(baseCheckpoint, 'incompatible').witnessInput),
    /challenge checkpoint has unknown fields|checkpoint identity mismatch|checkpoint.*schema mismatch/,
    'older ledger witness cannot consume the v1.4 possession checkpoint'
  );

  const packageFixture = buildWitnessPackage(baseCheckpoint, 'base');
  const witnessInput = packageFixture.witnessInput;
  const witness = packageFixture.witnessReceipt;
  equal(witness.schema, Witness.WITNESS_SCHEMA, 'witness schema is exact');
  equal(witness.version, '1.5.0', 'witness version is exact');
  equal(witness.status, 'TEST', 'witness remains TEST');
  equal(witness.checkpointRef.sha256, baseCheckpoint.checkpointDigest, 'witness binds exact checkpoint digest');
  equal(witness.sourceSnapshotRef, baseCheckpoint.sourceSnapshotRef, 'witness binds exact source snapshot reference');
  equal(witness.receiverIdDigest, baseCheckpoint.receiverIdDigest, 'witness binds receiver identity digest');
  equal(witness.challengerIdDigest, baseCheckpoint.challengerIdDigest, 'witness binds challenger identity digest');
  equal(witness.receiverPolicyRef, baseCheckpoint.receiverPolicyRef, 'witness binds receiver policy reference');
  equal(witness.entriesDigest, baseCheckpoint.entriesDigest, 'witness binds response-set digest');
  equal(witness.keyPolicyRef.sha256, witnessInput.keyPolicy.policyDigest, 'witness binds exact caller policy digest');
  equal(witness.signatureEvidence.requiredSignatures, 2, 'witness retains exact threshold');
  equal(witness.signatureEvidence.verifiedSignatures, 2, 'witness verifies two detached signatures');
  equal(new Set(witness.signatureEvidence.attestations.map(item => item.keyFingerprint)).size, 2, 'witness retains two distinct key fingerprints');
  equal(new Set(witness.signatureEvidence.attestations.map(item => item.actorDigest)).size, 2, 'witness retains two distinct actor digests');
  equal(witness.truth.checkpointVerifiedByExactRebuild, true, 'checkpoint exact-rebuild truth is explicit');
  equal(witness.truth.checkpointBytesBoundByVerifiedSignatures, true, 'signature binding truth is explicit');
  equal(witness.truth.detachedSignaturesCryptographicallyValid, true, 'signature validity truth is explicit');
  equal(witness.truth.signingKeyPossessionVerified, true, 'signing key possession truth is explicit');
  equal(witness.truth.keysAllowedByExactCallerPolicy, true, 'caller policy admission truth is explicit');
  equal(witness.truth.policyAuthorityAuthenticated, false, 'caller policy is not promoted to authority');
  equal(witness.truth.callerPolicyReplacementPrevented, false, 'caller policy replacement is not claimed prevented');
  equal(witness.truth.signerRealWorldIdentityProven, false, 'key possession is not promoted to identity');
  equal(witness.truth.declaredHumanSignerIsAuthenticatedHuman, false, 'declared human key is not promoted to authenticated human');
  equal(witness.truth.actualHumanParticipationProven, false, 'signature is not promoted to actual human participation');
  equal(witness.truth.checkpointExternalRetentionProven, false, 'witness proves no external checkpoint retention');
  equal(witness.truth.witnessExternalRetentionProven, false, 'witness proves no external witness retention');
  equal(witness.truth.checkpointDeletionOrRollbackPrevented, false, 'witness prevents no checkpoint rollback');
  equal(witness.truth.currentResponseStateDeletionOrRollbackPrevented, false, 'witness prevents no response-state rollback');
  equal(witness.truth.executionAuthorized, false, 'witness grants no execution authority');
  equal(witness.truth.automaticCanon, false, 'witness grants no CANON authority');
  equal(Witness.verifyWitness(witnessInput, witness).pass, true, 'witness exact-verifies');
  equal(Witness.buildWitness(copy(witnessInput)), witness, 'witness deterministically exact-rebuilds');

  const exactSnapshot = Continuity.captureState(Fixture.observationOptions(fixture, 'local-possession-observation:witness-exact', '2026-08-20T15:24:00.000Z'));
  const exactAuditInput = {
    auditId: 'local-possession-witnessed-audit:exact',
    checkedAt: '2026-08-20T15:24:30.000Z',
    witnessInput: copy(witnessInput),
    witnessReceipt: copy(witness),
    currentSnapshot: exactSnapshot
  };
  const exactAudit = Witness.buildWitnessedAudit(exactAuditInput);
  equal(exactAudit.schema, Witness.AUDIT_SCHEMA, 'witnessed audit schema is exact');
  equal(exactAudit.decision.classification, 'CURRENT_RESPONSE_SET_MATCHES_PRESENTED_CHECKPOINT', 'witnessed audit sees exact response set');
  equal(exactAudit.decision.reviewRequired, false, 'exact witnessed comparison needs no repair');
  equal(exactAudit.decision.autonomousActionCount, 0, 'witnessed audit performs no autonomous action');
  equal(exactAudit.truth.checkpointWitnessVerifiedByExactRebuild, true, 'witnessed audit exact-verifies witness');
  equal(exactAudit.truth.bareContinuityAuditVerifiedByExactRebuild, true, 'witnessed audit composes exact v1.4 comparison');
  equal(exactAudit.truth.comparisonBoundToExactConfiguredIdentity, true, 'witnessed audit compares exact configured identity');
  equal(exactAudit.truth.responseFilenameIdentityVerifiedWhenAvailable, true, 'witnessed audit retains filename identity truth');
  equal(exactAudit.truth.checkpointPolicyAuthorityAuthenticated, false, 'witnessed audit retains unauthenticated policy boundary');
  equal(exactAudit.truth.checkpointExternalRetentionProven, false, 'witnessed audit infers no external checkpoint retention');
  equal(exactAudit.truth.witnessExternalRetentionProven, false, 'witnessed audit infers no external witness retention');
  equal(exactAudit.truth.executionAuthorized, false, 'witnessed audit grants no execution authority');
  equal(Witness.verifyWitnessedAudit(exactAuditInput, exactAudit).pass, true, 'witnessed audit exact-verifies');

  const childPackagePath = path.join(tempRoot, 'fresh-process-witness-package.json');
  const childPackage = {
    observationOptions: Fixture.observationOptions(fixture, 'local-possession-observation:witness-child', '2026-08-20T15:25:00.000Z'),
    auditId: 'local-possession-witnessed-audit:child',
    checkedAt: '2026-08-20T15:25:30.000Z',
    witnessInput: copy(witnessInput),
    witnessReceipt: copy(witness)
  };
  fs.writeFileSync(childPackagePath, Witness.stableStringify(childPackage) + '\n', { encoding: 'utf8', mode: 0o600 });
  const child = runChild(childPackagePath);
  ok(child.pid !== process.pid, 'witnessed comparison executes in a distinct child process');
  equal(child.currentSnapshot.availability, 'AVAILABLE', 'fresh process sees available local state');
  equal(child.audit.decision.classification, 'CURRENT_RESPONSE_SET_MATCHES_PRESENTED_CHECKPOINT', 'fresh process verifies witnessed exact state');
  equal(Witness.verifyWitnessedAudit(child.auditInput, child.audit).pass, true, 'fresh-process witnessed audit exact-rebuilds in parent');

  const secondChallenge = Fixture.issueChallenge(fixture, 0x42);
  const second = Fixture.answer(fixture, secondChallenge, '2026-08-20T15:24:00.000Z');
  const secondPath = path.join(answersDir, second.responseFileName);
  const secondBytes = fs.readFileSync(secondPath);
  const extensionSnapshot = Continuity.captureState(Fixture.observationOptions(fixture, 'local-possession-observation:witness-extension', '2026-08-20T15:26:00.000Z'));
  const extensionAudit = Witness.buildWitnessedAudit({
    auditId: 'local-possession-witnessed-audit:extension',
    checkedAt: '2026-08-20T15:26:30.000Z',
    witnessInput: copy(witnessInput),
    witnessReceipt: copy(witness),
    currentSnapshot: extensionSnapshot
  });
  equal(extensionAudit.decision.classification, 'CURRENT_RESPONSE_SET_EXTENDS_PRESENTED_CHECKPOINT', 'witnessed checkpoint classifies valid extension');
  equal(extensionAudit.comparison.addedCurrentChallenges.length, 1, 'witnessed extension names one added challenge');
  equal(extensionAudit.truth.rollbackOrReplacementDetectedAgainstWitnessedCheckpoint, false, 'extension is not mislabeled rollback');

  fs.unlinkSync(firstPath);
  childPackage.observationOptions = Fixture.observationOptions(fixture, 'local-possession-observation:witness-rollback-child', '2026-08-20T15:27:00.000Z');
  childPackage.auditId = 'local-possession-witnessed-audit:rollback-child';
  childPackage.checkedAt = '2026-08-20T15:27:30.000Z';
  fs.writeFileSync(childPackagePath, Witness.stableStringify(childPackage) + '\n');
  const rollbackChild = runChild(childPackagePath);
  equal(rollbackChild.audit.decision.classification, 'ROLLBACK_OR_REPLACEMENT_DETECTED_AGAINST_PRESENTED_CHECKPOINT', 'fresh process detects deletion against witnessed checkpoint');
  equal(rollbackChild.audit.comparison.missingCheckpointChallenges.length, 1, 'witnessed rollback names one missing challenge');
  equal(rollbackChild.audit.comparison.missingCheckpointChallenges[0], baseCheckpoint.entries[0].challengeRef.sha256, 'witnessed rollback names exact missing challenge');
  equal(rollbackChild.audit.truth.rollbackOrReplacementDetectedAgainstWitnessedCheckpoint, true, 'witnessed rollback truth is explicit');
  equal(rollbackChild.audit.truth.checkpointDeletionOrRollbackPrevented, false, 'detection is not checkpoint prevention');
  equal(rollbackChild.audit.truth.currentResponseStateDeletionOrRollbackPrevented, false, 'detection is not response-state prevention');
  equal(rollbackChild.audit.decision.autonomousActionCount, 0, 'witnessed rollback performs no repair');
  fs.writeFileSync(firstPath, firstBytes);

  const custodyPath = path.join(
    possession.receiverOptions.stateRoot,
    Custody.NAMESPACE,
    Custody.RECORDS_DIRECTORY,
    possession.custodyResult.recordFileName
  );
  const custodyRecord = JSON.parse(fs.readFileSync(custodyPath, 'utf8'));
  const validatedCustody = Custody.validateCustodyRecord(custodyRecord, possession.receiver.policy, possession.receiverKey.receiverId);
  const alternateFirst = Possession.buildResponseRecord(
    validatedCustody.record,
    validatedCustody.policy,
    possession.challenge,
    '2026-08-20T15:21:30.000Z',
    possession.receiverKey.privateKey
  );
  fs.writeFileSync(firstPath, Possession.stableStringify(alternateFirst) + '\n');
  const replacementSnapshot = Continuity.captureState(Fixture.observationOptions(fixture, 'local-possession-observation:witness-replacement', '2026-08-20T15:28:00.000Z'));
  const replacementAudit = Witness.buildWitnessedAudit({
    auditId: 'local-possession-witnessed-audit:replacement',
    checkedAt: '2026-08-20T15:28:30.000Z',
    witnessInput: copy(witnessInput),
    witnessReceipt: copy(witness),
    currentSnapshot: replacementSnapshot
  });
  equal(replacementAudit.decision.classification, 'ROLLBACK_OR_REPLACEMENT_DETECTED_AGAINST_PRESENTED_CHECKPOINT', 'valid signed response replacement is detected against witness');
  equal(replacementAudit.comparison.replacedCheckpointEntries.length, 1, 'witnessed replacement identifies one changed response');
  equal(replacementAudit.comparison.replacedCheckpointEntries[0].challengeDigest, baseCheckpoint.entries[0].challengeRef.sha256, 'witnessed replacement binds exact challenge');
  ok(replacementAudit.comparison.replacedCheckpointEntries[0].checkpointResponseDigest !== replacementAudit.comparison.replacedCheckpointEntries[0].currentResponseDigest, 'witnessed replacement exposes distinct response digests');
  fs.writeFileSync(firstPath, firstBytes);

  const namespacePath = path.join(possession.receiverOptions.stateRoot, Possession.NAMESPACE);
  const namespaceBackup = namespacePath + '-backup';
  fs.renameSync(namespacePath, namespaceBackup);
  const absentSnapshot = Continuity.captureState(Fixture.observationOptions(fixture, 'local-possession-observation:witness-absent', '2026-08-20T15:29:00.000Z'));
  const absentAudit = Witness.buildWitnessedAudit({
    auditId: 'local-possession-witnessed-audit:absent',
    checkedAt: '2026-08-20T15:29:30.000Z',
    witnessInput: copy(witnessInput),
    witnessReceipt: copy(witness),
    currentSnapshot: absentSnapshot
  });
  equal(absentAudit.decision.classification, 'HOLD_LOCAL_POSSESSION_STATE_ABSENT_AGAINST_PRESENTED_CHECKPOINT', 'witnessed absence becomes typed hold');
  equal(absentAudit.truth.currentAbsenceDetectedAgainstWitnessedCheckpoint, true, 'witnessed absence truth is explicit');
  fs.renameSync(namespaceBackup, namespacePath);

  const unexpectedPath = path.join(answersDir, 'unexpected.txt');
  fs.writeFileSync(unexpectedPath, 'x');
  const invalidSnapshot = Continuity.captureState(Fixture.observationOptions(fixture, 'local-possession-observation:witness-invalid', '2026-08-20T15:30:00.000Z'));
  const invalidAudit = Witness.buildWitnessedAudit({
    auditId: 'local-possession-witnessed-audit:invalid',
    checkedAt: '2026-08-20T15:30:30.000Z',
    witnessInput: copy(witnessInput),
    witnessReceipt: copy(witness),
    currentSnapshot: invalidSnapshot
  });
  equal(invalidAudit.decision.classification, 'HOLD_CURRENT_LOCAL_POSSESSION_STATE_INVALID', 'witnessed invalid state becomes typed hold');
  equal(invalidAudit.truth.currentInvalidityDetected, true, 'witnessed invalidity truth is explicit');
  fs.unlinkSync(unexpectedPath);

  const identitySnapshot = Continuity.buildSnapshot({
    observationId: 'local-possession-observation:witness-identity-drift',
    observedAt: '2026-08-20T15:31:00.000Z',
    availability: 'AVAILABLE',
    receiverIdDigest: 'sha256:' + 'a'.repeat(64),
    challengerIdDigest: exactSnapshot.challengerIdDigest,
    receiverPolicyRef: exactSnapshot.receiverPolicyRef,
    entries: exactSnapshot.entries,
    errors: []
  });
  const identityAudit = Witness.buildWitnessedAudit({
    auditId: 'local-possession-witnessed-audit:identity-drift',
    checkedAt: '2026-08-20T15:31:30.000Z',
    witnessInput: copy(witnessInput),
    witnessReceipt: copy(witness),
    currentSnapshot: identitySnapshot
  });
  equal(identityAudit.decision.classification, 'HOLD_LOCAL_POSSESSION_IDENTITY_CHANGED', 'witnessed identity drift becomes typed hold');
  equal(identityAudit.truth.comparisonBoundToExactConfiguredIdentity, false, 'identity drift is not compared as same identity');

  let modifiedCheckpoint = copy(baseCheckpoint);
  modifiedCheckpoint.entries[0].responseRef.sha256 = 'sha256:' + 'b'.repeat(64);
  modifiedCheckpoint.entriesDigest = Continuity.sha256(modifiedCheckpoint.entries);
  modifiedCheckpoint = recomputeCheckpoint(modifiedCheckpoint);
  equal(Continuity.verifyCheckpoint(modifiedCheckpoint).pass, true, 'recomputed self-digest alone can make modified checkpoint structurally valid');
  const reusedWitnessInput = copy(witnessInput);
  reusedWitnessInput.checkpoint = modifiedCheckpoint;
  throws(() => Witness.buildWitness(reusedWitnessInput), /checkpoint reference mismatch/, 'modified self-digested checkpoint cannot reuse original witness policy');
  const reboundPolicy = copy(reusedWitnessInput);
  reboundPolicy.keyPolicy.checkpointRef.sha256 = modifiedCheckpoint.checkpointDigest;
  reboundPolicy.keyPolicy.entriesDigest = modifiedCheckpoint.entriesDigest;
  reboundPolicy.keyPolicy.policyDigest = Witness.policyDigest(reboundPolicy.keyPolicy);
  throws(() => Witness.buildWitness(reboundPolicy), /policy digest mismatch|checkpoint digest mismatch|entries digest mismatch|signature verification failed/, 'recomputed checkpoint and policy cannot reuse original signatures');
  const replacementPolicyPackage = buildWitnessPackage(modifiedCheckpoint, 'replacement-policy');
  equal(Witness.verifyWitness(replacementPolicyPackage.witnessInput, replacementPolicyPackage.witnessReceipt).pass, true, 'replacement caller policy with its own keys can witness modified checkpoint');
  ok(replacementPolicyPackage.witnessReceipt.keyPolicyRef.sha256 !== witness.keyPolicyRef.sha256, 'replacement caller policy has distinct digest');
  equal(replacementPolicyPackage.witnessReceipt.truth.policyAuthorityAuthenticated, false, 'replacement policy counterexample remains unauthenticated');
  equal(replacementPolicyPackage.witnessReceipt.truth.callerPolicyReplacementPrevented, false, 'replacement policy counterexample remains explicitly possible');

  const badSignature = copy(witnessInput);
  badSignature.signedAttestations[0].signature = badSignature.signedAttestations[1].signature;
  throws(() => Witness.buildWitness(badSignature), /signature verification failed/, 'signature from another key is refused');
  const unlisted = copy(witnessInput);
  unlisted.signedAttestations[0].keyId = 'synthetic-unlisted-key';
  throws(() => Witness.buildWitness(unlisted), /not enabled by the exact policy/, 'unlisted key is refused');
  const duplicateId = copy(witnessInput);
  duplicateId.signedAttestations[1] = copy(duplicateId.signedAttestations[0]);
  throws(() => Witness.buildWitness(duplicateId), /attestationId must be unique/, 'duplicate attestation id is refused');
  const duplicatePolicyKeyId = copy(witnessInput);
  duplicatePolicyKeyId.keyPolicy.keys[1].keyId = duplicatePolicyKeyId.keyPolicy.keys[0].keyId;
  duplicatePolicyKeyId.keyPolicy.policyDigest = Witness.policyDigest(duplicatePolicyKeyId.keyPolicy);
  throws(() => Witness.buildWitness(duplicatePolicyKeyId), /keyId must be unique/, 'duplicate policy key id is refused');
  const duplicateActor = copy(witnessInput);
  duplicateActor.keyPolicy.keys[1].actorDigest = duplicateActor.keyPolicy.keys[0].actorDigest;
  duplicateActor.keyPolicy.policyDigest = Witness.policyDigest(duplicateActor.keyPolicy);
  throws(() => Witness.buildWitness(duplicateActor), /actorDigest must be unique/, 'duplicate policy actor is refused');
  const duplicateKey = copy(witnessInput);
  duplicateKey.keyPolicy.keys[1].publicKeyPem = duplicateKey.keyPolicy.keys[0].publicKeyPem;
  duplicateKey.keyPolicy.policyDigest = Witness.policyDigest(duplicateKey.keyPolicy);
  throws(() => Witness.buildWitness(duplicateKey), /public key fingerprint must be unique/, 'duplicate public key is refused');
  const privateKeyPolicy = copy(witnessInput);
  privateKeyPolicy.keyPolicy.keys[0].publicKeyPem = privateKeyPem(packageFixture.pairs[0]);
  privateKeyPolicy.keyPolicy.policyDigest = Witness.policyDigest(privateKeyPolicy.keyPolicy);
  throws(() => Witness.buildWitness(privateKeyPolicy), /never private-key material/, 'private key material is refused');
  const rsaPolicy = copy(witnessInput);
  rsaPolicy.keyPolicy.keys[0].publicKeyPem = publicKeyPem(crypto.generateKeyPairSync('rsa', { modulusLength: 2048 }));
  rsaPolicy.keyPolicy.policyDigest = Witness.policyDigest(rsaPolicy.keyPolicy);
  throws(() => Witness.buildWitness(rsaPolicy), /must be an Ed25519 public key/, 'non-Ed25519 public key is refused');
  const insufficient = copy(witnessInput);
  insufficient.signedAttestations.pop();
  throws(() => Witness.buildWitness(insufficient), /cover the policy threshold/, 'insufficient signature count is refused');
  const tooMany = copy(witnessInput);
  tooMany.signedAttestations = Array(11).fill(null).map(() => copy(witnessInput.signedAttestations[0]));
  throws(() => Witness.buildWitness(tooMany), /at most ten entries/, 'attestation count over bound is refused');
  const expiredPolicy = copy(witnessInput);
  expiredPolicy.keyPolicy.expiresAt = '2026-08-20T15:23:20.000Z';
  expiredPolicy.keyPolicy.policyDigest = Witness.policyDigest(expiredPolicy.keyPolicy);
  throws(() => Witness.buildWitness(expiredPolicy), /expired or has an invalid validity window/, 'expired policy is refused');
  const futurePolicy = copy(witnessInput);
  futurePolicy.keyPolicy.issuedAt = '2026-08-20T15:23:40.000Z';
  futurePolicy.keyPolicy.policyDigest = Witness.policyDigest(futurePolicy.keyPolicy);
  throws(() => Witness.buildWitness(futurePolicy), /issued after verification/, 'future policy is refused');
  const overBoundInput = copy(witnessInput);
  overBoundInput.padding = 'x'.repeat(Witness.MAX_ARTIFACT_CANONICAL_BYTES);
  throws(() => Witness.buildWitness(overBoundInput), /exceeds the bounded canonical byte limit/, 'oversized input is refused before field processing');

  const bindingCases = [
    ['checkpointDigest', 'sha256:' + '1'.repeat(64), /checkpoint digest mismatch/, 'wrong checkpoint digest'],
    ['sourceSnapshotDigest', 'sha256:' + '2'.repeat(64), /source snapshot digest mismatch/, 'wrong source snapshot digest'],
    ['receiverIdDigest', 'sha256:' + '3'.repeat(64), /receiver identity mismatch/, 'wrong receiver identity'],
    ['challengerIdDigest', 'sha256:' + '4'.repeat(64), /challenger identity mismatch/, 'wrong challenger identity'],
    ['receiverPolicyDigest', 'sha256:' + '5'.repeat(64), /receiver policy digest mismatch/, 'wrong receiver policy digest'],
    ['entriesDigest', 'sha256:' + '6'.repeat(64), /entries digest mismatch/, 'wrong response-set digest']
  ];
  bindingCases.forEach(([field, value, pattern, label]) => {
    const candidate = copy(witnessInput);
    candidate.signedAttestations[0][field] = value;
    candidate.signedAttestations[0] = resign(candidate.signedAttestations[0], packageFixture.pairs[0]);
    throws(() => Witness.buildWitness(candidate), pattern, label + ' is refused even with valid signature');
  });
  const wrongPolicyDigest = copy(witnessInput);
  wrongPolicyDigest.signedAttestations[0].policyDigest = 'sha256:' + '7'.repeat(64);
  wrongPolicyDigest.signedAttestations[0] = resign(wrongPolicyDigest.signedAttestations[0], packageFixture.pairs[0]);
  throws(() => Witness.buildWitness(wrongPolicyDigest), /policy digest mismatch/, 'wrong policy digest is refused even with valid signature');
  const futureAttestation = copy(witnessInput);
  futureAttestation.signedAttestations[0].issuedAt = '2026-08-20T15:23:40.000Z';
  futureAttestation.signedAttestations[0] = resign(futureAttestation.signedAttestations[0], packageFixture.pairs[0]);
  throws(() => Witness.buildWitness(futureAttestation), /issued after verification/, 'future attestation is refused');
  const expiredAttestation = copy(witnessInput);
  expiredAttestation.signedAttestations[0].expiresAt = '2026-08-20T15:23:20.000Z';
  expiredAttestation.signedAttestations[0] = resign(expiredAttestation.signedAttestations[0], packageFixture.pairs[0]);
  throws(() => Witness.buildWitness(expiredAttestation), /expired or has an invalid validity window/, 'expired attestation is refused');
  const outlivesPolicy = copy(witnessInput);
  outlivesPolicy.signedAttestations[0].expiresAt = '2026-08-20T16:00:01.000Z';
  outlivesPolicy.signedAttestations[0] = resign(outlivesPolicy.signedAttestations[0], packageFixture.pairs[0]);
  throws(() => Witness.buildWitness(outlivesPolicy), /cannot outlive its exact key policy/, 'attestation beyond policy expiry is refused');

  const receiptTamper = copy(witness);
  receiptTamper.signatureEvidence.verifiedSignatures = 1;
  equal(Witness.verifyWitness(witnessInput, receiptTamper).pass, false, 'witness receipt tamper is detected');
  const truthTamper = copy(witness);
  truthTamper.truth.policyAuthorityAuthenticated = true;
  truthTamper.witnessDigest = Witness.sha256((() => { const value = copy(truthTamper); delete value.witnessDigest; return value; })());
  equal(Witness.verifyWitness(witnessInput, truthTamper).pass, false, 'invented witness authority fails even with recomputed digest');
  const auditTamper = copy(exactAudit);
  auditTamper.truth.checkpointExternalRetentionProven = true;
  auditTamper.auditDigest = Witness.sha256((() => { const value = copy(auditTamper); delete value.auditDigest; return value; })());
  equal(Witness.verifyWitnessedAudit(exactAuditInput, auditTamper).pass, false, 'invented external retention fails even with recomputed audit digest');
  throws(() => Witness.buildWitnessedAudit({ ...exactAuditInput, checkedAt: '2026-08-20T15:23:20.000Z' }), /cannot predate witness verification/, 'witnessed audit cannot predate witness');

  const serializedWitness = Witness.stableStringify(witness);
  const serializedAudit = Witness.stableStringify(exactAudit);
  [serializedWitness, serializedAudit].forEach((serialized, index) => {
    packageFixture.pairs.forEach((pair, pairIndex) => {
      equal(serialized.includes(publicKeyPem(pair)), false, 'public artifact ' + index + ' omits public key ' + pairIndex);
    });
    witnessInput.signedAttestations.forEach((attestation, attestationIndex) => {
      equal(serialized.includes(attestation.signature), false, 'public artifact ' + index + ' omits signature ' + attestationIndex);
      equal(serialized.includes(attestation.attestationId), false, 'public artifact ' + index + ' omits attestation id ' + attestationIndex);
      equal(serialized.includes(attestation.keyId), false, 'public artifact ' + index + ' omits key id ' + attestationIndex);
    });
    equal(serialized.includes(possession.receiverKey.receiverId), false, 'public artifact ' + index + ' omits raw receiver label');
    equal(serialized.includes(possession.challenger.challengerId), false, 'public artifact ' + index + ' omits raw challenger label');
    equal(serialized.includes(possession.receiverOptions.stateRoot), false, 'public artifact ' + index + ' omits state path');
    equal(serialized.includes(possession.custodyResult.receiverReceipt.custodyRecordRef.id), false, 'public artifact ' + index + ' omits custody record id');
    equal(serialized.includes(fixture.first.responsePackage.responseSignature), false, 'public artifact ' + index + ' omits response signature');
  });

  const policySchema = JSON.parse(fs.readFileSync(path.join(__dirname, 'model-shadow-review-challenge-transition-local-possession-checkpoint-witness-policy.schema.json'), 'utf8'));
  const attestationSchema = JSON.parse(fs.readFileSync(path.join(__dirname, 'model-shadow-review-challenge-transition-local-possession-checkpoint-witness-attestation.schema.json'), 'utf8'));
  const witnessSchema = JSON.parse(fs.readFileSync(path.join(__dirname, 'model-shadow-review-challenge-transition-local-possession-checkpoint-witness.schema.json'), 'utf8'));
  const auditSchema = JSON.parse(fs.readFileSync(path.join(__dirname, 'model-shadow-review-challenge-transition-local-possession-witnessed-continuity.schema.json'), 'utf8'));
  const contract = JSON.parse(fs.readFileSync(path.join(__dirname, 'module.contract.json'), 'utf8'));
  equal(policySchema.$id, Witness.POLICY_SCHEMA, 'policy schema identity matches runtime');
  equal(attestationSchema.$id, Witness.ATTESTATION_SCHEMA, 'attestation schema identity matches runtime');
  equal(witnessSchema.$id, Witness.WITNESS_SCHEMA, 'witness schema identity matches runtime');
  equal(auditSchema.$id, Witness.AUDIT_SCHEMA, 'audit schema identity matches runtime');
  equal(policySchema.additionalProperties, false, 'policy schema closes unknown fields');
  equal(attestationSchema.additionalProperties, false, 'attestation schema closes unknown fields');
  equal(witnessSchema.additionalProperties, false, 'witness schema closes unknown fields');
  equal(auditSchema.additionalProperties, false, 'audit schema closes unknown fields');
  equal(policySchema.properties.authorityOrigin.const, 'CALLER_SUPPLIED_UNAUTHENTICATED', 'policy schema admits unauthenticated origin');
  equal(witnessSchema.$defs.truth.properties.policyAuthorityAuthenticated.const, false, 'witness schema keeps policy authority false');
  equal(witnessSchema.$defs.truth.properties.callerPolicyReplacementPrevented.const, false, 'witness schema keeps policy replacement prevention false');
  equal(witnessSchema.$defs.truth.properties.checkpointExternalRetentionProven.const, false, 'witness schema keeps checkpoint retention false');
  equal(witnessSchema.$defs.truth.properties.witnessExternalRetentionProven.const, false, 'witness schema keeps witness retention false');
  equal(auditSchema.$defs.truth.properties.checkpointDeletionOrRollbackPrevented.const, false, 'audit schema keeps checkpoint prevention false');
  equal(auditSchema.$defs.truth.properties.currentResponseStateDeletionOrRollbackPrevented.const, false, 'audit schema keeps response-state prevention false');
  equal(auditSchema.$defs.decision.properties.autonomousActionCount.const, 0, 'audit schema prevents autonomous repair');
  equal(contract.id, 'model-shadow-review-challenge-transition-local-possession-checkpoint-witness', 'contract id is exact');
  equal(contract.version, 'v1.5', 'contract version is exact');
  equal(contract.status, 'TEST', 'contract remains TEST');
  equal(contract.permissions.length, 0, 'contract declares no permission');
  equal(contract.boundaries.reads.length, 0, 'contract declares no read surface');
  equal(contract.boundaries.writes.length, 0, 'contract declares no write surface');
  equal(contract.lifecycle.installed, false, 'contract remains uninstalled');
  equal(contract.lifecycle.promoted, false, 'contract remains unpromoted');
  ok(contract.boundaries.refuses.includes('replacement-caller-policy-with-valid-signatures-as-original-policy-continuity'), 'contract preserves replacement-policy counterexample');
  ok(contract.boundaries.refuses.includes('signed-checkpoint-as-proven-external-retention'), 'contract refuses signatures as external retention');
  ok(contract.boundaries.refuses.includes('automatic-canon'), 'contract refuses automatic CANON');

  const source = fs.readFileSync(path.join(__dirname, 'model-shadow-review-challenge-transition-local-possession-checkpoint-witness.js'), 'utf8');
  equal(source.includes("require('fs')"), false, 'runtime imports no filesystem capability');
  equal(source.includes("require('child_process')"), false, 'runtime imports no process capability');
  equal(source.includes("require('http')"), false, 'runtime imports no HTTP capability');
  equal(source.includes("require('https')"), false, 'runtime imports no HTTPS capability');
  equal(source.includes("require('net')"), false, 'runtime imports no network capability');
  equal(source.includes('fetch('), false, 'runtime uses no fetch capability');
  equal(source.includes('crypto.sign'), false, 'runtime performs no signing operation');
  equal(source.includes('createPrivateKey'), false, 'runtime creates no private key');
  equal(source.includes('privateKeyPem'), false, 'runtime accepts no private-key PEM field');
  equal(source.includes('privateKeyIngested: false'), true, 'runtime keeps private-key ingestion false');
  equal(source.includes('policyAuthorityAuthenticated: true'), false, 'runtime never authenticates caller policy authority');
  equal(source.includes('checkpointExternalRetentionProven: true'), false, 'runtime never claims external checkpoint retention');
  equal(source.includes('checkpointDeletionOrRollbackPrevented: true'), false, 'runtime never claims rollback prevention');
  equal(source.includes('automaticCanon: true'), false, 'runtime never claims automatic CANON');

  fs.unlinkSync(secondPath);
  const restoredSnapshot = Continuity.captureState(Fixture.observationOptions(fixture, 'local-possession-observation:witness-restored', '2026-08-20T15:32:00.000Z'));
  equal(restoredSnapshot.availability, 'AVAILABLE', 'restored base state passes final strict scan');
  equal(restoredSnapshot.entryCount, 1, 'restored base state retains one response');
  const expectedPrefix = path.resolve(os.tmpdir()) + path.sep;
  ok(path.resolve(tempRoot).startsWith(expectedPrefix), 'synthetic cleanup root stays under OS temp');
  ok(path.basename(tempRoot).startsWith('axm-local-possession-checkpoint-witness-'), 'synthetic cleanup root has fixed prefix');
  cleanupVerified = true;
} finally {
  if (cleanupVerified) fs.rmSync(tempRoot, { recursive: true, force: false });
}

console.log('model shadow local possession checkpoint witness self-test passed: ' + checks + ' checks');
