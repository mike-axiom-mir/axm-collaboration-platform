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
const OldAnchor = require('../model-shadow-review-challenge-anchor-gate/model-shadow-review-challenge-anchor-gate');
const Witness = require('../model-shadow-review-challenge-transition-local-possession-checkpoint-witness/model-shadow-review-challenge-transition-local-possession-checkpoint-witness');
const Anchor = require('./model-shadow-review-challenge-transition-local-possession-checkpoint-anchor');

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

function resignWitness(attestation, pair) {
  const result = copy(attestation);
  result.signature = crypto.sign(
    null,
    Buffer.from(Witness.stableStringify(Witness.attestationSigningPayload(result)), 'utf8'),
    pair.privateKey
  ).toString('base64');
  return result;
}

function resignAuthorization(authorization, pair) {
  const result = copy(authorization);
  result.signature = crypto.sign(
    null,
    Buffer.from(Anchor.stableStringify(Anchor.authorizationSigningPayload(result)), 'utf8'),
    pair.privateKey
  ).toString('base64');
  return result;
}

function buildWitnessPackage(checkpoint, tag) {
  const pairs = [crypto.generateKeyPairSync('ed25519'), crypto.generateKeyPairSync('ed25519')];
  const policy = {
    schema: Witness.POLICY_SCHEMA,
    policyId: 'local-possession-anchor-witness-policy:' + tag,
    issuedAt: '2026-08-20T15:23:00.000Z',
    expiresAt: '2026-08-20T16:00:00.000Z',
    audience: Witness.AUDIENCE,
    scope: Witness.SCOPE,
    authorityOrigin: Witness.AUTHORITY_ORIGIN,
    checkpointRef: { id: checkpoint.checkpointId, schema: checkpoint.schema, sha256: checkpoint.checkpointDigest },
    sourceSnapshotRef: copy(checkpoint.sourceSnapshotRef),
    receiverIdDigest: checkpoint.receiverIdDigest,
    challengerIdDigest: checkpoint.challengerIdDigest,
    receiverPolicyRef: copy(checkpoint.receiverPolicyRef),
    entriesDigest: checkpoint.entriesDigest,
    requiredSignatures: 2,
    maxAttestationAgeSeconds: 3600,
    keys: pairs.map((pair, index) => ({
      keyId: 'synthetic-anchor-witness-key:' + tag + ':' + (index + 1),
      algorithm: 'Ed25519',
      publicKeyPem: publicKeyPem(pair),
      actorDigest: Witness.sha256('synthetic-anchor-witness-actor:' + tag + ':' + (index + 1)),
      actorKind: index === 0 ? 'human' : 'machine',
      scope: Witness.SCOPE,
      enabled: true
    })),
    policyDigest: null
  };
  policy.policyDigest = Witness.policyDigest(policy);
  const signedAttestations = pairs.map((pair, index) => resignWitness({
    schema: Witness.ATTESTATION_SCHEMA,
    attestationId: 'local-possession-anchor-witness-attestation:' + tag + ':' + (index + 1),
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
    witnessId: 'local-possession-checkpoint-anchor-witness:' + tag,
    verifiedAt: '2026-08-20T15:23:30.000Z',
    checkpoint: copy(checkpoint),
    keyPolicy: policy,
    signedAttestations
  };
  return { pairs, witnessInput, witnessReceipt: Witness.buildWitness(witnessInput) };
}

function buildAnchorPackage(witnessPackage, tag) {
  const pairs = [crypto.generateKeyPairSync('ed25519'), crypto.generateKeyPairSync('ed25519')];
  const witness = witnessPackage.witnessReceipt;
  const anchorPolicy = {
    schema: Anchor.ANCHOR_POLICY_SCHEMA,
    anchorId: 'local-possession-checkpoint-anchor:' + tag,
    anchorEpoch: 1,
    issuedAt: '2026-08-20T15:22:00.000Z',
    expiresAt: '2026-08-20T16:20:00.000Z',
    status: 'TEST',
    audience: Anchor.AUDIENCE,
    scope: Anchor.SCOPE,
    authorityOrigin: Anchor.AUTHORITY_ORIGIN,
    requiredSignatures: 2,
    maxAuthorizationAgeSeconds: 3600,
    keys: pairs.map((pair, index) => ({
      anchorKeyId: 'synthetic-local-possession-anchor-key:' + tag + ':' + (index + 1),
      algorithm: 'Ed25519',
      publicKeyPem: publicKeyPem(pair),
      stewardDigest: Anchor.sha256('synthetic-local-possession-anchor-steward:' + tag + ':' + (index + 1)),
      stewardKind: index === 0 ? 'human' : 'machine',
      scope: Anchor.SCOPE,
      enabled: true
    })),
    anchorDigest: null
  };
  anchorPolicy.anchorDigest = Anchor.anchorPolicyDigest(anchorPolicy);
  const policyAuthorizations = pairs.map((pair, index) => resignAuthorization({
    schema: Anchor.AUTHORIZATION_SCHEMA,
    authorizationId: 'local-possession-checkpoint-anchor-authorization:' + tag + ':' + (index + 1),
    anchorKeyId: anchorPolicy.keys[index].anchorKeyId,
    stewardDigest: anchorPolicy.keys[index].stewardDigest,
    stewardKind: anchorPolicy.keys[index].stewardKind,
    verdict: 'AUTHORIZE',
    scope: Anchor.SCOPE,
    anchorDigest: anchorPolicy.anchorDigest,
    expectedAnchorDigest: anchorPolicy.anchorDigest,
    witnessPolicyDigest: witness.keyPolicyRef.sha256,
    witnessDigest: witness.witnessDigest,
    checkpointDigest: witness.checkpointRef.sha256,
    sourceSnapshotDigest: witness.sourceSnapshotRef.sha256,
    receiverIdDigest: witness.receiverIdDigest,
    challengerIdDigest: witness.challengerIdDigest,
    receiverPolicyDigest: witness.receiverPolicyRef.sha256,
    entriesDigest: witness.entriesDigest,
    issuedAt: '2026-08-20T15:23:40.000Z',
    expiresAt: '2026-08-20T16:00:00.000Z',
    signatureAlgorithm: 'Ed25519',
    signature: ''
  }, pair));
  const anchoredWitnessInput = {
    receiptId: 'local-possession-checkpoint-anchored-witness:' + tag,
    verifiedAt: '2026-08-20T15:24:00.000Z',
    expectedAnchorDigest: anchorPolicy.anchorDigest,
    witnessInput: copy(witnessPackage.witnessInput),
    witnessReceipt: copy(witness),
    anchorPolicy,
    policyAuthorizations
  };
  return { pairs, anchoredWitnessInput };
}

function rebindToWitness(anchorPackage, witnessPackage, tag) {
  const result = copy(anchorPackage.anchoredWitnessInput);
  const witness = witnessPackage.witnessReceipt;
  result.receiptId = 'local-possession-checkpoint-anchored-witness:' + tag;
  result.witnessInput = copy(witnessPackage.witnessInput);
  result.witnessReceipt = copy(witness);
  result.policyAuthorizations = result.policyAuthorizations.map((authorization, index) => {
    const rebound = copy(authorization);
    rebound.authorizationId = 'local-possession-checkpoint-anchor-authorization:' + tag + ':' + (index + 1);
    rebound.witnessPolicyDigest = witness.keyPolicyRef.sha256;
    rebound.witnessDigest = witness.witnessDigest;
    rebound.checkpointDigest = witness.checkpointRef.sha256;
    rebound.sourceSnapshotDigest = witness.sourceSnapshotRef.sha256;
    rebound.receiverIdDigest = witness.receiverIdDigest;
    rebound.challengerIdDigest = witness.challengerIdDigest;
    rebound.receiverPolicyDigest = witness.receiverPolicyRef.sha256;
    rebound.entriesDigest = witness.entriesDigest;
    return resignAuthorization(rebound, anchorPackage.pairs[index]);
  });
  return result;
}

function buildAudit(anchoredWitnessInput, anchoredWitnessReceipt, currentSnapshot, tag, checkedAt) {
  const input = {
    auditId: 'local-possession-anchored-continuity-audit:' + tag,
    checkedAt,
    anchoredWitnessInput: copy(anchoredWitnessInput),
    anchoredWitnessReceipt: copy(anchoredWitnessReceipt),
    currentSnapshot: copy(currentSnapshot)
  };
  return { input, receipt: Anchor.buildAnchoredAudit(input) };
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

function redigest(value, field) {
  const result = copy(value);
  result[field] = null;
  const payload = copy(result);
  delete payload[field];
  result[field] = Anchor.sha256(payload);
  return result;
}

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'axm-local-possession-checkpoint-anchor-'));
let cleanupVerified = false;

try {
  const fixture = Fixture.buildFixture(tempRoot);
  const possession = fixture.possession;
  const answersDir = path.join(possession.receiverOptions.stateRoot, Possession.NAMESPACE, Possession.ANSWERS_DIRECTORY);
  const firstPath = path.join(answersDir, fixture.first.responseFileName);
  const firstBytes = fs.readFileSync(firstPath);

  equal(Anchor.VERSION, '1.6.0', 'version is exact');
  equal(Anchor.STATUS, 'TEST', 'status remains TEST');
  equal(Anchor.MAX_ANCHOR_KEYS, 10, 'anchor seat bound is exact');
  equal(Anchor.MAX_AUTHORIZATION_AGE_SECONDS, 86400, 'authorization age bound is exact');
  equal(Anchor.MAX_ARTIFACT_CANONICAL_BYTES, 524288, 'artifact byte bound is exact');
  equal(Anchor.AUTHORITY_ORIGIN, 'CALLER_PRESENTED_PIN_UNAUTHENTICATED', 'anchor origin is explicit');
  equal(Anchor.NEXT_GATE, 'HOST_AUTHENTICATED_ANCHOR_PIN_AND_EXTERNALLY_RETAINED_ANCHORED_RECEIPT_OR_PROTECTED_MONOTONIC_STORE', 'next gate is exact');

  const baseSnapshot = Continuity.captureState(copy(fixture.continuityOptions));
  const baseCheckpoint = Continuity.buildCheckpoint({
    checkpointId: 'local-possession-checkpoint:anchor-base',
    anchoredAt: '2026-08-20T15:22:30.000Z',
    currentSnapshot: baseSnapshot
  });
  equal(Continuity.verifyCheckpoint(baseCheckpoint).pass, true, 'v1.4 base checkpoint exact-verifies');
  const witnessPackage = buildWitnessPackage(baseCheckpoint, 'base');
  equal(Witness.verifyWitness(witnessPackage.witnessInput, witnessPackage.witnessReceipt).pass, true, 'v1.5 witness exact-verifies before anchoring');
  const anchorPackage = buildAnchorPackage(witnessPackage, 'base');
  throws(
    () => OldAnchor.buildAnchoredWitness(copy(anchorPackage.anchoredWitnessInput)),
    /checkpoint witness is invalid|receipt schema mismatch|challenge checkpoint has unknown fields/,
    'older ledger anchor cannot consume the v1.5 possession witness'
  );

  const anchoredInput = anchorPackage.anchoredWitnessInput;
  const anchored = Anchor.buildAnchoredWitness(anchoredInput);
  equal(anchored.schema, Anchor.RECEIPT_SCHEMA, 'anchored witness schema is exact');
  equal(anchored.version, '1.6.0', 'anchored witness version is exact');
  equal(anchored.status, 'TEST', 'anchored witness remains TEST');
  equal(anchored.expectedAnchorDigest, anchoredInput.anchorPolicy.anchorDigest, 'receipt binds caller-presented anchor digest');
  equal(anchored.anchorRef.sha256, anchoredInput.anchorPolicy.anchorDigest, 'receipt binds exact anchor policy');
  equal(anchored.witnessRef.sha256, witnessPackage.witnessReceipt.witnessDigest, 'receipt binds exact v1.5 witness');
  equal(anchored.witnessPolicyRef, witnessPackage.witnessReceipt.keyPolicyRef, 'receipt binds exact witness policy reference');
  equal(anchored.checkpointRef, witnessPackage.witnessReceipt.checkpointRef, 'receipt binds exact checkpoint reference');
  equal(anchored.sourceSnapshotRef, witnessPackage.witnessReceipt.sourceSnapshotRef, 'receipt binds source snapshot reference');
  equal(anchored.receiverIdDigest, witnessPackage.witnessReceipt.receiverIdDigest, 'receipt binds receiver identity digest');
  equal(anchored.challengerIdDigest, witnessPackage.witnessReceipt.challengerIdDigest, 'receipt binds challenger identity digest');
  equal(anchored.receiverPolicyRef, witnessPackage.witnessReceipt.receiverPolicyRef, 'receipt binds receiver policy reference');
  equal(anchored.entriesDigest, witnessPackage.witnessReceipt.entriesDigest, 'receipt binds response entries digest');
  equal(anchored.authorizationEvidence.requiredSignatures, 2, 'receipt retains exact anchor threshold');
  equal(anchored.authorizationEvidence.verifiedSignatures, 2, 'receipt verifies two anchor signatures');
  equal(new Set(anchored.authorizationEvidence.authorizations.map(item => item.keyFingerprint)).size, 2, 'receipt retains two distinct anchor key fingerprints');
  equal(new Set(anchored.authorizationEvidence.authorizations.map(item => item.stewardDigest)).size, 2, 'receipt retains two distinct declared steward digests');
  equal(anchored.truth.witnessVerifiedByExactRebuild, true, 'v1.5 witness exact-rebuild truth is explicit');
  equal(anchored.truth.anchorAuthorizationSignaturesCryptographicallyValid, true, 'anchor signature truth is explicit');
  equal(anchored.truth.witnessPolicySubstitutionDetectedRelativeToPresentedAnchor, true, 'relative policy-substitution detection is explicit');
  equal(anchored.truth.witnessPolicyReplacementPrevented, false, 'relative detection is not replacement prevention');
  equal(anchored.truth.anchorPolicyAuthorityAuthenticated, false, 'anchor policy is not promoted to authority');
  equal(anchored.truth.expectedAnchorDigestAuthorityAuthenticated, false, 'presented pin is not promoted to authority');
  equal(anchored.truth.anchorEpochMonotonicityProven, false, 'self-declared epoch is not promoted to monotonicity');
  equal(anchored.truth.jointAnchorPinAndWitnessPolicySubstitutionStillPossible, true, 'joint substitution boundary is explicit');
  equal(anchored.truth.actualHumanParticipationProven, false, 'declared human anchor seat is not actual participation');
  equal(anchored.truth.anchoredWitnessExternallyRetained, false, 'receipt proves no external retention');
  equal(anchored.truth.checkpointDeletionOrRollbackPrevented, false, 'receipt prevents no checkpoint rollback');
  equal(anchored.truth.currentResponseStateDeletionOrRollbackPrevented, false, 'receipt prevents no response rollback');
  equal(anchored.truth.executionAuthorized, false, 'receipt grants no execution authority');
  equal(anchored.truth.automaticCanon, false, 'receipt grants no CANON authority');
  equal(Anchor.verifyAnchoredWitness(anchoredInput, anchored).pass, true, 'anchored witness exact-verifies');
  equal(Anchor.buildAnchoredWitness(copy(anchoredInput)), anchored, 'anchored witness deterministically exact-rebuilds');

  const exactSnapshot = Continuity.captureState(Fixture.observationOptions(fixture, 'local-possession-observation:anchor-exact', '2026-08-20T15:24:30.000Z'));
  const exact = buildAudit(anchoredInput, anchored, exactSnapshot, 'exact', '2026-08-20T15:25:00.000Z');
  equal(exact.receipt.schema, Anchor.AUDIT_SCHEMA, 'anchored audit schema is exact');
  equal(exact.receipt.decision.classification, 'CURRENT_RESPONSE_SET_MATCHES_PRESENTED_CHECKPOINT', 'anchored audit sees exact response set');
  equal(exact.receipt.decision.reviewRequired, false, 'exact anchored comparison requires no repair');
  equal(exact.receipt.decision.autonomousActionCount, 0, 'exact anchored comparison performs no autonomous action');
  equal(exact.receipt.truth.anchoredWitnessVerifiedByExactRebuild, true, 'audit exact-verifies anchored witness');
  equal(exact.receipt.truth.witnessedContinuityAuditVerifiedByExactRebuild, true, 'audit composes unchanged v1.5 comparison');
  equal(exact.receipt.truth.comparisonBoundToExactConfiguredIdentity, true, 'audit compares exact configured identity');
  equal(exact.receipt.truth.responseFilenameIdentityVerifiedWhenAvailable, true, 'audit retains filename identity truth');
  equal(exact.receipt.truth.witnessPolicyReplacementPrevented, false, 'audit preserves policy replacement boundary');
  equal(exact.receipt.truth.hostAuthorizationAuthenticated, false, 'audit proves no host authorization');
  equal(exact.receipt.truth.executionAuthorized, false, 'audit grants no execution authority');
  equal(Anchor.verifyAnchoredAudit(exact.input, exact.receipt).pass, true, 'anchored audit exact-verifies');

  const childPackagePath = path.join(tempRoot, 'fresh-process-anchored-package.json');
  const childPackage = {
    observationOptions: Fixture.observationOptions(fixture, 'local-possession-observation:anchor-child', '2026-08-20T15:25:30.000Z'),
    auditId: 'local-possession-anchored-continuity-audit:child',
    checkedAt: '2026-08-20T15:26:00.000Z',
    anchoredWitnessInput: copy(anchoredInput),
    anchoredWitnessReceipt: copy(anchored)
  };
  fs.writeFileSync(childPackagePath, Anchor.stableStringify(childPackage) + '\n', { encoding: 'utf8', mode: 0o600 });
  const child = runChild(childPackagePath);
  ok(child.pid !== process.pid, 'anchored comparison executes in a distinct child process');
  equal(child.audit.decision.classification, 'CURRENT_RESPONSE_SET_MATCHES_PRESENTED_CHECKPOINT', 'fresh process verifies anchored exact state');
  equal(Anchor.verifyAnchoredAudit(child.auditInput, child.audit).pass, true, 'fresh-process anchored audit exact-rebuilds in parent');

  const secondChallenge = Fixture.issueChallenge(fixture, 0x42);
  const second = Fixture.answer(fixture, secondChallenge, '2026-08-20T15:25:30.000Z');
  const secondPath = path.join(answersDir, second.responseFileName);
  const extensionSnapshot = Continuity.captureState(Fixture.observationOptions(fixture, 'local-possession-observation:anchor-extension', '2026-08-20T15:26:30.000Z'));
  const extension = buildAudit(anchoredInput, anchored, extensionSnapshot, 'extension', '2026-08-20T15:27:00.000Z');
  equal(extension.receipt.decision.classification, 'CURRENT_RESPONSE_SET_EXTENDS_PRESENTED_CHECKPOINT', 'anchored checkpoint classifies valid extension');
  equal(extension.receipt.comparison.addedCurrentChallenges.length, 1, 'anchored extension names one added challenge');
  equal(extension.receipt.truth.rollbackOrReplacementDetectedAgainstAnchoredCheckpoint, false, 'extension is not mislabeled rollback');

  fs.unlinkSync(firstPath);
  childPackage.observationOptions = Fixture.observationOptions(fixture, 'local-possession-observation:anchor-rollback-child', '2026-08-20T15:27:30.000Z');
  childPackage.auditId = 'local-possession-anchored-continuity-audit:rollback-child';
  childPackage.checkedAt = '2026-08-20T15:28:00.000Z';
  fs.writeFileSync(childPackagePath, Anchor.stableStringify(childPackage) + '\n');
  const rollbackChild = runChild(childPackagePath);
  equal(rollbackChild.audit.decision.classification, 'ROLLBACK_OR_REPLACEMENT_DETECTED_AGAINST_PRESENTED_CHECKPOINT', 'fresh process detects deletion against anchored checkpoint');
  equal(rollbackChild.audit.comparison.missingCheckpointChallenges[0], baseCheckpoint.entries[0].challengeRef.sha256, 'anchored rollback names exact missing challenge');
  equal(rollbackChild.audit.truth.rollbackOrReplacementDetectedAgainstAnchoredCheckpoint, true, 'anchored rollback truth is explicit');
  equal(rollbackChild.audit.truth.checkpointDeletionOrRollbackPrevented, false, 'anchored detection is not checkpoint prevention');
  equal(rollbackChild.audit.truth.currentResponseStateDeletionOrRollbackPrevented, false, 'anchored detection is not response-state prevention');
  equal(rollbackChild.audit.decision.autonomousActionCount, 0, 'anchored rollback performs no repair');
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
  const replacementSnapshot = Continuity.captureState(Fixture.observationOptions(fixture, 'local-possession-observation:anchor-replacement', '2026-08-20T15:28:30.000Z'));
  const replacement = buildAudit(anchoredInput, anchored, replacementSnapshot, 'replacement', '2026-08-20T15:29:00.000Z');
  equal(replacement.receipt.decision.classification, 'ROLLBACK_OR_REPLACEMENT_DETECTED_AGAINST_PRESENTED_CHECKPOINT', 'valid signed response replacement is detected through anchor');
  equal(replacement.receipt.comparison.replacedCheckpointEntries.length, 1, 'anchored replacement identifies one changed response');
  ok(replacement.receipt.comparison.replacedCheckpointEntries[0].checkpointResponseDigest !== replacement.receipt.comparison.replacedCheckpointEntries[0].currentResponseDigest, 'anchored replacement exposes distinct response digests');
  fs.writeFileSync(firstPath, firstBytes);

  const namespacePath = path.join(possession.receiverOptions.stateRoot, Possession.NAMESPACE);
  const namespaceBackup = namespacePath + '-backup';
  fs.renameSync(namespacePath, namespaceBackup);
  const absentSnapshot = Continuity.captureState(Fixture.observationOptions(fixture, 'local-possession-observation:anchor-absent', '2026-08-20T15:29:30.000Z'));
  const absent = buildAudit(anchoredInput, anchored, absentSnapshot, 'absent', '2026-08-20T15:30:00.000Z');
  equal(absent.receipt.decision.classification, 'HOLD_LOCAL_POSSESSION_STATE_ABSENT_AGAINST_PRESENTED_CHECKPOINT', 'anchored absence becomes typed hold');
  equal(absent.receipt.truth.currentAbsenceDetectedAgainstAnchoredCheckpoint, true, 'anchored absence truth is explicit');
  fs.renameSync(namespaceBackup, namespacePath);

  const unexpectedPath = path.join(answersDir, 'unexpected.txt');
  fs.writeFileSync(unexpectedPath, 'x');
  const invalidSnapshot = Continuity.captureState(Fixture.observationOptions(fixture, 'local-possession-observation:anchor-invalid', '2026-08-20T15:30:30.000Z'));
  const invalid = buildAudit(anchoredInput, anchored, invalidSnapshot, 'invalid', '2026-08-20T15:31:00.000Z');
  equal(invalid.receipt.decision.classification, 'HOLD_CURRENT_LOCAL_POSSESSION_STATE_INVALID', 'anchored invalid state becomes typed hold');
  equal(invalid.receipt.truth.currentInvalidityDetected, true, 'anchored invalidity truth is explicit');
  fs.unlinkSync(unexpectedPath);

  const identitySnapshot = Continuity.buildSnapshot({
    observationId: 'local-possession-observation:anchor-identity-drift',
    observedAt: '2026-08-20T15:31:30.000Z',
    availability: 'AVAILABLE',
    receiverIdDigest: 'sha256:' + 'a'.repeat(64),
    challengerIdDigest: exactSnapshot.challengerIdDigest,
    receiverPolicyRef: exactSnapshot.receiverPolicyRef,
    entries: exactSnapshot.entries,
    errors: []
  });
  const identity = buildAudit(anchoredInput, anchored, identitySnapshot, 'identity-drift', '2026-08-20T15:32:00.000Z');
  equal(identity.receipt.decision.classification, 'HOLD_LOCAL_POSSESSION_IDENTITY_CHANGED', 'anchored identity drift becomes typed hold');
  equal(identity.receipt.truth.comparisonBoundToExactConfiguredIdentity, false, 'identity drift is not compared as same identity');

  const replacementWitness = buildWitnessPackage(baseCheckpoint, 'replacement-policy');
  const witnessSubstitution = copy(anchoredInput);
  witnessSubstitution.witnessInput = copy(replacementWitness.witnessInput);
  witnessSubstitution.witnessReceipt = copy(replacementWitness.witnessReceipt);
  throws(() => Anchor.buildAnchoredWitness(witnessSubstitution), /witness policy digest mismatch/, 'replacement witness policy cannot reuse original anchor signatures');
  const reboundByOriginalAnchor = rebindToWitness(anchorPackage, replacementWitness, 'original-anchor-rebound');
  const reboundReceipt = Anchor.buildAnchoredWitness(reboundByOriginalAnchor);
  equal(Anchor.verifyAnchoredWitness(reboundByOriginalAnchor, reboundReceipt).pass, true, 'original anchor keys can explicitly authorize a replacement witness policy');
  equal(reboundReceipt.anchorRef.sha256, anchored.anchorRef.sha256, 'explicit replacement retains exact original anchor');
  ok(reboundReceipt.witnessPolicyRef.sha256 !== anchored.witnessPolicyRef.sha256, 'explicit replacement binds a distinct witness policy');

  const jointReplacementAnchor = buildAnchorPackage(replacementWitness, 'joint-replacement');
  const jointReplacementReceipt = Anchor.buildAnchoredWitness(jointReplacementAnchor.anchoredWitnessInput);
  equal(Anchor.verifyAnchoredWitness(jointReplacementAnchor.anchoredWitnessInput, jointReplacementReceipt).pass, true, 'joint replacement anchor pin witness policy and signatures can form a valid chain');
  ok(jointReplacementReceipt.anchorRef.sha256 !== anchored.anchorRef.sha256, 'joint replacement has a distinct anchor digest');
  ok(jointReplacementReceipt.witnessPolicyRef.sha256 !== anchored.witnessPolicyRef.sha256, 'joint replacement has a distinct witness policy digest');
  equal(jointReplacementReceipt.truth.jointAnchorPinAndWitnessPolicySubstitutionStillPossible, true, 'joint replacement counterexample remains explicit');
  equal(jointReplacementReceipt.truth.witnessPolicyReplacementPrevented, false, 'joint replacement counterexample is not mislabeled prevention');

  const mismatchedPin = copy(anchoredInput);
  mismatchedPin.expectedAnchorDigest = 'sha256:' + '0'.repeat(64);
  throws(() => Anchor.buildAnchoredWitness(mismatchedPin), /expected anchor digest does not match/, 'mismatched caller-presented anchor pin is refused');
  const invalidAnchorDigest = copy(anchoredInput);
  invalidAnchorDigest.anchorPolicy.anchorEpoch = 2;
  throws(() => Anchor.buildAnchoredWitness(invalidAnchorDigest), /anchor digest mismatch/, 'modified anchor policy with stale self-digest is refused');
  const badSignature = copy(anchoredInput);
  badSignature.policyAuthorizations[0].signature = badSignature.policyAuthorizations[1].signature;
  throws(() => Anchor.buildAnchoredWitness(badSignature), /signature verification failed/, 'signature from another anchor key is refused');
  const unlisted = copy(anchoredInput);
  unlisted.policyAuthorizations[0].anchorKeyId = 'synthetic-unlisted-anchor-key';
  throws(() => Anchor.buildAnchoredWitness(unlisted), /not enabled by the exact anchor policy/, 'unlisted anchor key is refused');
  const duplicateAuthorization = copy(anchoredInput);
  duplicateAuthorization.policyAuthorizations[1] = copy(duplicateAuthorization.policyAuthorizations[0]);
  throws(() => Anchor.buildAnchoredWitness(duplicateAuthorization), /authorizationId must be unique/, 'duplicate anchor authorization id is refused');
  const duplicateKeyId = copy(anchoredInput);
  duplicateKeyId.anchorPolicy.keys[1].anchorKeyId = duplicateKeyId.anchorPolicy.keys[0].anchorKeyId;
  duplicateKeyId.anchorPolicy.anchorDigest = Anchor.anchorPolicyDigest(duplicateKeyId.anchorPolicy);
  throws(() => Anchor.buildAnchoredWitness(duplicateKeyId), /key id must be unique/, 'duplicate anchor policy key id is refused');
  const duplicateSteward = copy(anchoredInput);
  duplicateSteward.anchorPolicy.keys[1].stewardDigest = duplicateSteward.anchorPolicy.keys[0].stewardDigest;
  duplicateSteward.anchorPolicy.anchorDigest = Anchor.anchorPolicyDigest(duplicateSteward.anchorPolicy);
  throws(() => Anchor.buildAnchoredWitness(duplicateSteward), /stewardDigest must be unique/, 'duplicate anchor steward is refused');
  const duplicatePublicKey = copy(anchoredInput);
  duplicatePublicKey.anchorPolicy.keys[1].publicKeyPem = duplicatePublicKey.anchorPolicy.keys[0].publicKeyPem;
  duplicatePublicKey.anchorPolicy.anchorDigest = Anchor.anchorPolicyDigest(duplicatePublicKey.anchorPolicy);
  throws(() => Anchor.buildAnchoredWitness(duplicatePublicKey), /public key fingerprint must be unique/, 'duplicate anchor public key is refused');
  const privateKeyPolicy = copy(anchoredInput);
  privateKeyPolicy.anchorPolicy.keys[0].publicKeyPem = privateKeyPem(anchorPackage.pairs[0]);
  privateKeyPolicy.anchorPolicy.anchorDigest = Anchor.anchorPolicyDigest(privateKeyPolicy.anchorPolicy);
  throws(() => Anchor.buildAnchoredWitness(privateKeyPolicy), /never private-key material/, 'private key material is refused');
  const rsaPolicy = copy(anchoredInput);
  rsaPolicy.anchorPolicy.keys[0].publicKeyPem = publicKeyPem(crypto.generateKeyPairSync('rsa', { modulusLength: 2048 }));
  rsaPolicy.anchorPolicy.anchorDigest = Anchor.anchorPolicyDigest(rsaPolicy.anchorPolicy);
  throws(() => Anchor.buildAnchoredWitness(rsaPolicy), /must be an Ed25519 public key/, 'non-Ed25519 anchor key is refused');
  const insufficient = copy(anchoredInput);
  insufficient.policyAuthorizations.pop();
  throws(() => Anchor.buildAnchoredWitness(insufficient), /cover the anchor threshold/, 'insufficient anchor authorization count is refused');
  const tooMany = copy(anchoredInput);
  tooMany.policyAuthorizations = Array(11).fill(null).map(() => copy(anchoredInput.policyAuthorizations[0]));
  throws(() => Anchor.buildAnchoredWitness(tooMany), /at most ten entries/, 'anchor authorization count over bound is refused');
  const expiredPolicy = copy(anchoredInput);
  expiredPolicy.anchorPolicy.expiresAt = '2026-08-20T15:23:50.000Z';
  expiredPolicy.anchorPolicy.anchorDigest = Anchor.anchorPolicyDigest(expiredPolicy.anchorPolicy);
  throws(() => Anchor.buildAnchoredWitness(expiredPolicy), /expired or has an invalid validity window/, 'expired anchor policy is refused');
  const futurePolicy = copy(anchoredInput);
  futurePolicy.anchorPolicy.issuedAt = '2026-08-20T15:24:10.000Z';
  futurePolicy.anchorPolicy.anchorDigest = Anchor.anchorPolicyDigest(futurePolicy.anchorPolicy);
  throws(() => Anchor.buildAnchoredWitness(futurePolicy), /issued after verification/, 'future anchor policy is refused');
  const expiredAuthorization = copy(anchoredInput);
  expiredAuthorization.policyAuthorizations[0].expiresAt = '2026-08-20T15:23:50.000Z';
  expiredAuthorization.policyAuthorizations[0] = resignAuthorization(expiredAuthorization.policyAuthorizations[0], anchorPackage.pairs[0]);
  throws(() => Anchor.buildAnchoredWitness(expiredAuthorization), /expired or has an invalid validity window/, 'expired anchor authorization is refused');
  const futureAuthorization = copy(anchoredInput);
  futureAuthorization.policyAuthorizations[0].issuedAt = '2026-08-20T15:24:10.000Z';
  futureAuthorization.policyAuthorizations[0] = resignAuthorization(futureAuthorization.policyAuthorizations[0], anchorPackage.pairs[0]);
  throws(() => Anchor.buildAnchoredWitness(futureAuthorization), /cannot be issued after verification/, 'future anchor authorization is refused');
  const outlivesAnchor = copy(anchoredInput);
  outlivesAnchor.policyAuthorizations[0].expiresAt = '2026-08-20T16:20:01.000Z';
  outlivesAnchor.policyAuthorizations[0] = resignAuthorization(outlivesAnchor.policyAuthorizations[0], anchorPackage.pairs[0]);
  throws(() => Anchor.buildAnchoredWitness(outlivesAnchor), /cannot outlive its exact anchor policy/, 'authorization beyond anchor expiry is refused');
  const overBoundInput = copy(anchoredInput);
  overBoundInput.padding = 'x'.repeat(Anchor.MAX_ARTIFACT_CANONICAL_BYTES);
  throws(() => Anchor.buildAnchoredWitness(overBoundInput), /exceeds the 512 KiB canonical artifact bound/, 'oversized input is refused before field processing');

  const bindingCases = [
    ['anchorDigest', 'sha256:' + '1'.repeat(64), /anchor digest mismatch/, 'wrong anchor digest'],
    ['expectedAnchorDigest', 'sha256:' + '2'.repeat(64), /expected anchor digest mismatch/, 'wrong expected anchor digest'],
    ['witnessPolicyDigest', 'sha256:' + '3'.repeat(64), /witness policy digest mismatch/, 'wrong witness policy digest'],
    ['witnessDigest', 'sha256:' + '4'.repeat(64), /witness digest mismatch/, 'wrong witness digest'],
    ['checkpointDigest', 'sha256:' + '5'.repeat(64), /checkpoint digest mismatch/, 'wrong checkpoint digest'],
    ['sourceSnapshotDigest', 'sha256:' + '6'.repeat(64), /source snapshot digest mismatch/, 'wrong source snapshot digest'],
    ['receiverIdDigest', 'sha256:' + '7'.repeat(64), /receiver identity digest mismatch/, 'wrong receiver identity'],
    ['challengerIdDigest', 'sha256:' + '8'.repeat(64), /challenger identity digest mismatch/, 'wrong challenger identity'],
    ['receiverPolicyDigest', 'sha256:' + '9'.repeat(64), /receiver policy digest mismatch/, 'wrong receiver policy digest'],
    ['entriesDigest', 'sha256:' + 'a'.repeat(64), /entries digest mismatch/, 'wrong response-set digest']
  ];
  bindingCases.forEach(([field, value, pattern, label]) => {
    const candidate = copy(anchoredInput);
    candidate.policyAuthorizations[0][field] = value;
    candidate.policyAuthorizations[0] = resignAuthorization(candidate.policyAuthorizations[0], anchorPackage.pairs[0]);
    throws(() => Anchor.buildAnchoredWitness(candidate), pattern, label + ' is refused even with a valid signature');
  });

  const receiptTamper = copy(anchored);
  receiptTamper.authorizationEvidence.verifiedSignatures = 1;
  equal(Anchor.verifyAnchoredWitness(anchoredInput, receiptTamper).pass, false, 'anchored receipt tamper is detected');
  let truthTamper = copy(anchored);
  truthTamper.truth.anchorPolicyAuthorityAuthenticated = true;
  truthTamper = redigest(truthTamper, 'receiptDigest');
  equal(Anchor.verifyAnchoredWitness(anchoredInput, truthTamper).pass, false, 'invented anchor authority fails even with recomputed receipt digest');
  let preventionTamper = copy(anchored);
  preventionTamper.truth.witnessPolicyReplacementPrevented = true;
  preventionTamper = redigest(preventionTamper, 'receiptDigest');
  equal(Anchor.verifyAnchoredWitness(anchoredInput, preventionTamper).pass, false, 'invented policy replacement prevention fails even with recomputed digest');
  let auditTamper = copy(exact.receipt);
  auditTamper.truth.anchorExternallyRetained = true;
  auditTamper = redigest(auditTamper, 'auditDigest');
  equal(Anchor.verifyAnchoredAudit(exact.input, auditTamper).pass, false, 'invented external retention fails even with recomputed audit digest');
  throws(() => Anchor.buildAnchoredAudit({ ...exact.input, checkedAt: '2026-08-20T15:23:50.000Z' }), /cannot predate anchored witness verification/, 'anchored audit cannot predate anchored witness');

  const serializedArtifacts = [Anchor.stableStringify(anchored), Anchor.stableStringify(exact.receipt)];
  serializedArtifacts.forEach((serialized, artifactIndex) => {
    anchorPackage.pairs.forEach((pair, pairIndex) => {
      equal(serialized.includes(publicKeyPem(pair)), false, 'public artifact ' + artifactIndex + ' omits anchor public key ' + pairIndex);
    });
    anchoredInput.policyAuthorizations.forEach((authorization, authorizationIndex) => {
      equal(serialized.includes(authorization.signature), false, 'public artifact ' + artifactIndex + ' omits anchor signature ' + authorizationIndex);
      equal(serialized.includes(authorization.authorizationId), false, 'public artifact ' + artifactIndex + ' omits authorization id ' + authorizationIndex);
      equal(serialized.includes(authorization.anchorKeyId), false, 'public artifact ' + artifactIndex + ' omits anchor key id ' + authorizationIndex);
    });
    equal(serialized.includes(possession.receiverKey.receiverId), false, 'public artifact ' + artifactIndex + ' omits raw receiver label');
    equal(serialized.includes(possession.challenger.challengerId), false, 'public artifact ' + artifactIndex + ' omits raw challenger label');
    equal(serialized.includes(possession.receiverOptions.stateRoot), false, 'public artifact ' + artifactIndex + ' omits state path');
    equal(serialized.includes(possession.custodyResult.receiverReceipt.custodyRecordRef.id), false, 'public artifact ' + artifactIndex + ' omits custody record id');
    equal(serialized.includes(fixture.first.responsePackage.responseSignature), false, 'public artifact ' + artifactIndex + ' omits response signature');
  });
  ok(Buffer.byteLength(Anchor.stableStringify(anchored), 'utf8') <= Anchor.MAX_ARTIFACT_CANONICAL_BYTES, 'anchored receipt stays within artifact bound');
  ok(Buffer.byteLength(Anchor.stableStringify(exact.receipt), 'utf8') <= Anchor.MAX_ARTIFACT_CANONICAL_BYTES, 'anchored audit stays within artifact bound');

  const policySchema = JSON.parse(fs.readFileSync(path.join(__dirname, 'model-shadow-review-challenge-transition-local-possession-checkpoint-anchor-policy.schema.json'), 'utf8'));
  const authorizationSchema = JSON.parse(fs.readFileSync(path.join(__dirname, 'model-shadow-review-challenge-transition-local-possession-checkpoint-anchor-authorization.schema.json'), 'utf8'));
  const receiptSchema = JSON.parse(fs.readFileSync(path.join(__dirname, 'model-shadow-review-challenge-transition-local-possession-checkpoint-anchored-witness.schema.json'), 'utf8'));
  const auditSchema = JSON.parse(fs.readFileSync(path.join(__dirname, 'model-shadow-review-challenge-transition-local-possession-anchored-continuity.schema.json'), 'utf8'));
  const contract = JSON.parse(fs.readFileSync(path.join(__dirname, 'module.contract.json'), 'utf8'));
  equal(policySchema.$id, Anchor.ANCHOR_POLICY_SCHEMA, 'anchor policy schema identity matches runtime');
  equal(authorizationSchema.$id, Anchor.AUTHORIZATION_SCHEMA, 'authorization schema identity matches runtime');
  equal(receiptSchema.$id, Anchor.RECEIPT_SCHEMA, 'anchored receipt schema identity matches runtime');
  equal(auditSchema.$id, Anchor.AUDIT_SCHEMA, 'anchored audit schema identity matches runtime');
  equal(policySchema.additionalProperties, false, 'anchor policy schema closes unknown fields');
  equal(authorizationSchema.additionalProperties, false, 'authorization schema closes unknown fields');
  equal(receiptSchema.additionalProperties, false, 'anchored receipt schema closes unknown fields');
  equal(auditSchema.additionalProperties, false, 'anchored audit schema closes unknown fields');
  equal(policySchema.properties.authorityOrigin.const, 'CALLER_PRESENTED_PIN_UNAUTHENTICATED', 'anchor policy schema admits caller-presented origin');
  equal(policySchema.properties.maxAuthorizationAgeSeconds.maximum, 86400, 'anchor policy schema enforces age bound');
  equal(receiptSchema.$defs.truth.properties.witnessPolicySubstitutionDetectedRelativeToPresentedAnchor.const, true, 'receipt schema declares relative substitution detection');
  equal(receiptSchema.$defs.truth.properties.witnessPolicyReplacementPrevented.const, false, 'receipt schema keeps replacement prevention false');
  equal(receiptSchema.$defs.truth.properties.anchorPolicyAuthorityAuthenticated.const, false, 'receipt schema keeps anchor authority false');
  equal(receiptSchema.$defs.truth.properties.jointAnchorPinAndWitnessPolicySubstitutionStillPossible.const, true, 'receipt schema preserves joint substitution counterexample');
  equal(auditSchema.$defs.truth.properties.checkpointDeletionOrRollbackPrevented.const, false, 'audit schema keeps checkpoint prevention false');
  equal(auditSchema.$defs.truth.properties.currentResponseStateDeletionOrRollbackPrevented.const, false, 'audit schema keeps response-state prevention false');
  equal(auditSchema.$defs.decision.properties.autonomousActionCount.const, 0, 'audit schema prevents autonomous repair');
  equal(auditSchema.$defs.snapshotSummary.additionalProperties, false, 'audit snapshot schema is exact');
  equal(auditSchema.$defs.comparison.additionalProperties, false, 'audit comparison schema is exact');
  equal(auditSchema.$defs.decision.additionalProperties, false, 'audit decision schema is exact');
  equal(contract.id, 'model-shadow-review-challenge-transition-local-possession-checkpoint-anchor', 'contract id is exact');
  equal(contract.version, 'v1.6', 'contract version is exact');
  equal(contract.status, 'TEST', 'contract remains TEST');
  equal(contract.permissions.length, 0, 'contract declares no permission');
  equal(contract.boundaries.reads.length, 0, 'contract declares no read surface');
  equal(contract.boundaries.writes.length, 0, 'contract declares no write surface');
  equal(contract.lifecycle.installed, false, 'contract remains uninstalled');
  equal(contract.lifecycle.promoted, false, 'contract remains unpromoted');
  ok(contract.boundaries.refuses.includes('joint-anchor-pin-witness-policy-and-signature-substitution-as-original-policy-continuity'), 'contract preserves joint-substitution counterexample');
  ok(contract.boundaries.refuses.includes('relative-witness-policy-substitution-detection-as-replacement-prevention'), 'contract refuses relative detection as prevention');
  ok(contract.boundaries.refuses.includes('anchored-witness-as-proven-external-retention'), 'contract refuses anchored receipt as external retention');
  ok(contract.boundaries.refuses.includes('automatic-canon'), 'contract refuses automatic CANON');

  const source = fs.readFileSync(path.join(__dirname, 'model-shadow-review-challenge-transition-local-possession-checkpoint-anchor.js'), 'utf8');
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
  equal(source.includes('witnessPolicySubstitutionDetectedRelativeToPresentedAnchor: true'), true, 'runtime declares bounded relative detection');
  equal(source.includes('jointAnchorPinAndWitnessPolicySubstitutionStillPossible: true'), true, 'runtime preserves joint-substitution counterexample');
  equal(source.includes('anchorPolicyAuthorityAuthenticated: true'), false, 'runtime never authenticates anchor authority');
  equal(source.includes('witnessPolicyReplacementPrevented: true'), false, 'runtime never claims policy replacement prevention');
  equal(source.includes('anchorExternallyRetained: true'), false, 'runtime never claims external anchor retention');
  equal(source.includes('checkpointDeletionOrRollbackPrevented: true'), false, 'runtime never claims rollback prevention');
  equal(source.includes('automaticCanon: true'), false, 'runtime never claims automatic CANON');

  fs.unlinkSync(secondPath);
  const restoredSnapshot = Continuity.captureState(Fixture.observationOptions(fixture, 'local-possession-observation:anchor-restored', '2026-08-20T15:33:00.000Z'));
  equal(restoredSnapshot.availability, 'AVAILABLE', 'restored base state passes final strict scan');
  equal(restoredSnapshot.entryCount, 1, 'restored base state retains one response');
  const expectedPrefix = path.resolve(os.tmpdir()) + path.sep;
  ok(path.resolve(tempRoot).startsWith(expectedPrefix), 'synthetic cleanup root stays under OS temp');
  ok(path.basename(tempRoot).startsWith('axm-local-possession-checkpoint-anchor-'), 'synthetic cleanup root has fixed prefix');
  cleanupVerified = true;
} finally {
  if (cleanupVerified) fs.rmSync(tempRoot, { recursive: true, force: false });
}

console.log('model shadow local possession checkpoint anchor self-test passed: ' + checks + ' checks');
