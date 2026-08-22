#!/usr/bin/env node
'use strict';

const assert = require('assert');
const childProcess = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Custody = require('../model-shadow-review-challenge-transition-local-receiver-custody/model-shadow-review-challenge-transition-local-receiver-custody');
const Possession = require('../model-shadow-review-challenge-transition-local-possession-challenge/model-shadow-review-challenge-transition-local-possession-challenge');
const Continuity = require('../model-shadow-review-challenge-transition-local-possession-continuity/model-shadow-review-challenge-transition-local-possession-continuity');
const StateFixture = require('../model-shadow-review-challenge-transition-local-possession-continuity/selftest-fixture');
const OldSeparation = require('../model-shadow-review-challenge-separation-gate/model-shadow-review-challenge-separation-gate');
const Anchor = require('../model-shadow-review-challenge-transition-local-possession-checkpoint-anchor/model-shadow-review-challenge-transition-local-possession-checkpoint-anchor');
const Witness = require('../model-shadow-review-challenge-transition-local-possession-checkpoint-witness/model-shadow-review-challenge-transition-local-possession-checkpoint-witness');
const Separation = require('./model-shadow-review-challenge-transition-local-possession-checkpoint-separation');
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

function separationInput(anchorPackage, tag, verifiedAt) {
  return {
    receiptId: 'local-possession-separated-witness:' + tag,
    verifiedAt: verifiedAt || '2026-08-20T15:24:30.000Z',
    anchoredWitnessInput: copy(anchorPackage.anchoredWitnessInput),
    anchoredWitnessReceipt: copy(anchorPackage.anchoredWitnessReceipt)
  };
}

function buildAudit(input, receipt, currentSnapshot, tag, checkedAt) {
  const auditInput = {
    auditId: 'local-possession-separated-continuity-audit:' + tag,
    checkedAt,
    separationInput: copy(input),
    separationReceipt: copy(receipt),
    currentSnapshot: copy(currentSnapshot)
  };
  return { input: auditInput, receipt: Separation.buildSeparatedAudit(auditInput) };
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
  result[field] = Separation.sha256(payload);
  return result;
}

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'axm-local-possession-checkpoint-separation-'));
let cleanupVerified = false;

try {
  const state = StateFixture.buildFixture(tempRoot);
  const possession = state.possession;
  const answersDir = path.join(possession.receiverOptions.stateRoot, Possession.NAMESPACE, Possession.ANSWERS_DIRECTORY);
  const firstPath = path.join(answersDir, state.first.responseFileName);
  const firstBytes = fs.readFileSync(firstPath);

  equal(Separation.VERSION, '1.7.0', 'version is exact');
  equal(Separation.STATUS, 'TEST', 'status remains TEST');
  equal(Separation.SEPARATION_SCOPE, 'OBSERVED_LOCAL_POSSESSION_CROSS_LAYER_KEY_FINGERPRINT_AND_DECLARED_PRINCIPAL_DIGEST_NONOVERLAP', 'separation scope is exact');
  equal(Separation.MAX_ARTIFACT_CANONICAL_BYTES, 524288, 'artifact byte bound is exact');
  equal(Separation.NEXT_GATE, 'HOST_AUTHENTICATED_ANCHOR_PIN_INDEPENDENT_IDENTITY_ATTESTATION_AND_EXTERNALLY_RETAINED_OR_PROTECTED_STATE', 'next gate is exact');

  const baseSnapshot = Continuity.captureState(copy(state.continuityOptions));
  const checkpoint = Continuity.buildCheckpoint({
    checkpointId: 'local-possession-checkpoint:separation-base',
    anchoredAt: '2026-08-20T15:22:30.000Z',
    currentSnapshot: baseSnapshot
  });
  equal(Continuity.verifyCheckpoint(checkpoint).pass, true, 'v1.4 checkpoint exact-verifies');
  const witnessPackage = Fixture.buildWitnessPackage(checkpoint, 'base');
  equal(Witness.verifyWitness(witnessPackage.witnessInput, witnessPackage.witnessReceipt).pass, true, 'v1.5 witness exact-verifies');
  const anchorPackage = Fixture.buildAnchorPackage(witnessPackage, 'base');
  equal(Anchor.verifyAnchoredWitness(anchorPackage.anchoredWitnessInput, anchorPackage.anchoredWitnessReceipt).pass, true, 'v1.6 anchored witness exact-verifies');
  const input = separationInput(anchorPackage, 'base');
  throws(
    () => OldSeparation.buildSeparatedWitness(copy(input)),
    /anchored witness is invalid|receipt schema mismatch|checkpoint witness is invalid/,
    'older ledger separation gate cannot consume the v1.6 possession anchor'
  );

  const receipt = Separation.buildSeparatedWitness(input);
  equal(receipt.schema, Separation.RECEIPT_SCHEMA, 'separation receipt schema is exact');
  equal(receipt.version, '1.7.0', 'separation receipt version is exact');
  equal(receipt.status, 'TEST', 'separation receipt remains TEST');
  equal(receipt.anchoredWitnessRef.sha256, anchorPackage.anchoredWitnessReceipt.receiptDigest, 'receipt binds exact v1.6 anchored witness');
  equal(receipt.anchorRef, anchorPackage.anchoredWitnessReceipt.anchorRef, 'receipt binds exact anchor reference');
  equal(receipt.witnessRef, anchorPackage.anchoredWitnessReceipt.witnessRef, 'receipt binds exact witness reference');
  equal(receipt.witnessPolicyRef, anchorPackage.anchoredWitnessReceipt.witnessPolicyRef, 'receipt binds exact witness policy reference');
  equal(receipt.checkpointRef, anchorPackage.anchoredWitnessReceipt.checkpointRef, 'receipt binds exact checkpoint reference');
  equal(receipt.sourceSnapshotRef, anchorPackage.anchoredWitnessReceipt.sourceSnapshotRef, 'receipt binds exact source snapshot reference');
  equal(receipt.receiverIdDigest, anchorPackage.anchoredWitnessReceipt.receiverIdDigest, 'receipt binds receiver identity digest');
  equal(receipt.challengerIdDigest, anchorPackage.anchoredWitnessReceipt.challengerIdDigest, 'receipt binds challenger identity digest');
  equal(receipt.receiverPolicyRef, anchorPackage.anchoredWitnessReceipt.receiverPolicyRef, 'receipt binds receiver policy reference');
  equal(receipt.entriesDigest, anchorPackage.anchoredWitnessReceipt.entriesDigest, 'receipt binds response entries digest');
  equal(receipt.separationEvidence.witnessVerifiedSeats, 2, 'receipt counts two verified witness seats');
  equal(receipt.separationEvidence.anchorVerifiedSeats, 2, 'receipt counts two verified anchor seats');
  equal(receipt.separationEvidence.combinedVerifiedSeats, 4, 'receipt counts four combined verified seats');
  equal(receipt.separationEvidence.sharedKeyFingerprintCount, 0, 'receipt declares no shared key fingerprint');
  equal(receipt.separationEvidence.sharedDeclaredPrincipalDigestCount, 0, 'receipt declares no shared principal digest');
  equal(receipt.truth.anchoredWitnessVerifiedByExactRebuild, true, 'anchored witness exact-rebuild truth is explicit');
  equal(receipt.truth.noSharedPublicKeyFingerprintObserved, true, 'key non-overlap truth is explicit');
  equal(receipt.truth.noSharedDeclaredPrincipalDigestObserved, true, 'declared-principal non-overlap truth is explicit');
  equal(receipt.truth.observableCrossLayerSeparationVerified, true, 'observable separation truth is explicit');
  equal(receipt.truth.keyCustodyIndependenceProven, false, 'different keys are not promoted to independent custody');
  equal(receipt.truth.realWorldControllerIndependenceProven, false, 'observable non-overlap is not promoted to controller independence');
  equal(receipt.truth.declaredPrincipalDigestsAuthenticated, false, 'declared principal digests are not promoted to identity');
  equal(receipt.truth.sameControllerWithDistinctKeysStillPossible, true, 'same-controller distinct-key counterexample is explicit');
  equal(receipt.truth.sameControllerWithDistinctPrincipalDigestsStillPossible, true, 'same-controller distinct-principal counterexample is explicit');
  equal(receipt.truth.crossLayerCollusionExcluded, false, 'observable separation does not exclude collusion');
  equal(receipt.truth.witnessPolicyReplacementPrevented, false, 'separation does not become policy replacement prevention');
  equal(receipt.truth.jointAnchorPinAndWitnessPolicySubstitutionStillPossible, true, 'joint substitution remains explicit');
  equal(receipt.truth.anchorPolicyAuthorityAuthenticated, false, 'separation authenticates no anchor authority');
  equal(receipt.truth.separationReceiptExternallyRetained, false, 'separation proves no external retention');
  equal(receipt.truth.checkpointDeletionOrRollbackPrevented, false, 'separation prevents no checkpoint rollback');
  equal(receipt.truth.currentResponseStateDeletionOrRollbackPrevented, false, 'separation prevents no response rollback');
  equal(receipt.truth.executionAuthorized, false, 'separation grants no execution authority');
  equal(receipt.truth.automaticCanon, false, 'separation grants no CANON authority');
  equal(Separation.verifySeparatedWitness(input, receipt).pass, true, 'separation receipt exact-verifies');
  equal(Separation.buildSeparatedWitness(copy(input)), receipt, 'separation receipt deterministically exact-rebuilds');
  const firstFingerprintDigest = receipt.separationEvidence.witnessKeyFingerprintSetDigest;
  equal(
    Separation.setDigest('order-check', ['sha256:' + '1'.repeat(64), 'sha256:' + '2'.repeat(64)]),
    Separation.setDigest('order-check', ['sha256:' + '2'.repeat(64), 'sha256:' + '1'.repeat(64)]),
    'domain-separated set digest is order independent'
  );
  ok(firstFingerprintDigest !== receipt.separationEvidence.anchorKeyFingerprintSetDigest, 'witness and anchor key sets retain distinct digests');
  ok(receipt.separationEvidence.witnessDeclaredPrincipalSetDigest !== receipt.separationEvidence.anchorDeclaredPrincipalSetDigest, 'witness and anchor declared-principal sets retain distinct digests');

  const sharedKeyAnchor = Fixture.buildAnchorPackage(witnessPackage, 'shared-key', { pairs: witnessPackage.pairs });
  equal(Anchor.verifyAnchoredWitness(sharedKeyAnchor.anchoredWitnessInput, sharedKeyAnchor.anchoredWitnessReceipt).pass, true, 'v1.6 alone admits cross-layer key reuse');
  throws(
    () => Separation.buildSeparatedWitness(separationInput(sharedKeyAnchor, 'shared-key')),
    /must not share an observed public key fingerprint/,
    'cross-layer public key reuse is refused'
  );

  const sharedPrincipalAnchor = Fixture.buildAnchorPackage(witnessPackage, 'shared-principal', {
    stewardDigests: [witnessPackage.actorDigests[0], Anchor.sha256('distinct-anchor-steward')]
  });
  equal(Anchor.verifyAnchoredWitness(sharedPrincipalAnchor.anchoredWitnessInput, sharedPrincipalAnchor.anchoredWitnessReceipt).pass, true, 'v1.6 alone admits cross-layer declared-principal reuse');
  throws(
    () => Separation.buildSeparatedWitness(separationInput(sharedPrincipalAnchor, 'shared-principal')),
    /must not share a declared principal digest/,
    'cross-layer declared-principal reuse is refused'
  );

  const sameControllerWitness = Fixture.buildWitnessPackage(checkpoint, 'same-controller');
  const sameControllerAnchor = Fixture.buildAnchorPackage(sameControllerWitness, 'same-controller');
  const sameControllerInput = separationInput(sameControllerAnchor, 'same-controller');
  const sameControllerReceipt = Separation.buildSeparatedWitness(sameControllerInput);
  equal(Separation.verifySeparatedWitness(sameControllerInput, sameControllerReceipt).pass, true, 'one synthetic controller with distinct keys and digests passes observable non-overlap');
  equal(sameControllerReceipt.truth.keyCustodyIndependenceProven, false, 'same-controller counterexample keeps custody independence false');
  equal(sameControllerReceipt.truth.realWorldControllerIndependenceProven, false, 'same-controller counterexample keeps controller independence false');
  equal(sameControllerReceipt.truth.crossLayerCollusionExcluded, false, 'same-controller counterexample keeps collusion exclusion false');

  const exactSnapshot = Continuity.captureState(StateFixture.observationOptions(state, 'local-possession-observation:separation-exact', '2026-08-20T15:25:00.000Z'));
  const exact = buildAudit(input, receipt, exactSnapshot, 'exact', '2026-08-20T15:25:30.000Z');
  equal(exact.receipt.schema, Separation.AUDIT_SCHEMA, 'separated audit schema is exact');
  equal(exact.receipt.decision.classification, 'CURRENT_RESPONSE_SET_MATCHES_PRESENTED_CHECKPOINT', 'separated audit sees exact response set');
  equal(exact.receipt.decision.autonomousActionCount, 0, 'separated exact comparison performs no autonomous action');
  equal(exact.receipt.truth.separatedWitnessVerifiedByExactRebuild, true, 'audit exact-verifies separated receipt');
  equal(exact.receipt.truth.anchoredContinuityAuditVerifiedByExactRebuild, true, 'audit composes unchanged v1.6 comparison');
  equal(exact.receipt.truth.comparisonBoundToExactConfiguredIdentity, true, 'audit compares exact configured identity');
  equal(exact.receipt.truth.responseFilenameIdentityVerifiedWhenAvailable, true, 'audit retains filename identity truth');
  equal(exact.receipt.truth.keyCustodyIndependenceProven, false, 'audit retains nonindependence boundary');
  equal(exact.receipt.truth.witnessPolicyReplacementPrevented, false, 'audit retains policy replacement boundary');
  equal(exact.receipt.truth.executionAuthorized, false, 'audit grants no execution authority');
  equal(Separation.verifySeparatedAudit(exact.input, exact.receipt).pass, true, 'separated audit exact-verifies');

  const childPackagePath = path.join(tempRoot, 'fresh-process-separated-package.json');
  const childPackage = {
    observationOptions: StateFixture.observationOptions(state, 'local-possession-observation:separation-child', '2026-08-20T15:26:00.000Z'),
    auditId: 'local-possession-separated-continuity-audit:child',
    checkedAt: '2026-08-20T15:26:30.000Z',
    separationInput: copy(input),
    separationReceipt: copy(receipt)
  };
  fs.writeFileSync(childPackagePath, Separation.stableStringify(childPackage) + '\n', { encoding: 'utf8', mode: 0o600 });
  const child = runChild(childPackagePath);
  ok(child.pid !== process.pid, 'separated comparison executes in a distinct child process');
  equal(child.audit.decision.classification, 'CURRENT_RESPONSE_SET_MATCHES_PRESENTED_CHECKPOINT', 'fresh process verifies separated exact state');
  equal(Separation.verifySeparatedAudit(child.auditInput, child.audit).pass, true, 'fresh-process separated audit exact-rebuilds in parent');

  const secondChallenge = StateFixture.issueChallenge(state, 0x42);
  const second = StateFixture.answer(state, secondChallenge, '2026-08-20T15:26:00.000Z');
  const secondPath = path.join(answersDir, second.responseFileName);
  const extensionSnapshot = Continuity.captureState(StateFixture.observationOptions(state, 'local-possession-observation:separation-extension', '2026-08-20T15:27:00.000Z'));
  const extension = buildAudit(input, receipt, extensionSnapshot, 'extension', '2026-08-20T15:27:30.000Z');
  equal(extension.receipt.decision.classification, 'CURRENT_RESPONSE_SET_EXTENDS_PRESENTED_CHECKPOINT', 'separated checkpoint classifies valid extension');
  equal(extension.receipt.comparison.addedCurrentChallenges.length, 1, 'separated extension names one added challenge');
  equal(extension.receipt.truth.rollbackOrReplacementDetectedAgainstSeparatedCheckpoint, false, 'extension is not mislabeled rollback');

  fs.unlinkSync(firstPath);
  childPackage.observationOptions = StateFixture.observationOptions(state, 'local-possession-observation:separation-rollback-child', '2026-08-20T15:28:00.000Z');
  childPackage.auditId = 'local-possession-separated-continuity-audit:rollback-child';
  childPackage.checkedAt = '2026-08-20T15:28:30.000Z';
  fs.writeFileSync(childPackagePath, Separation.stableStringify(childPackage) + '\n');
  const rollbackChild = runChild(childPackagePath);
  equal(rollbackChild.audit.decision.classification, 'ROLLBACK_OR_REPLACEMENT_DETECTED_AGAINST_PRESENTED_CHECKPOINT', 'fresh process detects deletion through separated chain');
  equal(rollbackChild.audit.comparison.missingCheckpointChallenges[0], checkpoint.entries[0].challengeRef.sha256, 'separated rollback names exact missing challenge');
  equal(rollbackChild.audit.truth.rollbackOrReplacementDetectedAgainstSeparatedCheckpoint, true, 'separated rollback truth is explicit');
  equal(rollbackChild.audit.truth.checkpointDeletionOrRollbackPrevented, false, 'separated detection is not checkpoint prevention');
  equal(rollbackChild.audit.truth.currentResponseStateDeletionOrRollbackPrevented, false, 'separated detection is not response-state prevention');
  equal(rollbackChild.audit.decision.autonomousActionCount, 0, 'separated rollback performs no repair');
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
  const replacementSnapshot = Continuity.captureState(StateFixture.observationOptions(state, 'local-possession-observation:separation-replacement', '2026-08-20T15:29:00.000Z'));
  const replacement = buildAudit(input, receipt, replacementSnapshot, 'replacement', '2026-08-20T15:29:30.000Z');
  equal(replacement.receipt.decision.classification, 'ROLLBACK_OR_REPLACEMENT_DETECTED_AGAINST_PRESENTED_CHECKPOINT', 'valid signed response replacement is detected through separated chain');
  equal(replacement.receipt.comparison.replacedCheckpointEntries.length, 1, 'separated replacement identifies one changed response');
  ok(replacement.receipt.comparison.replacedCheckpointEntries[0].checkpointResponseDigest !== replacement.receipt.comparison.replacedCheckpointEntries[0].currentResponseDigest, 'separated replacement exposes distinct response digests');
  fs.writeFileSync(firstPath, firstBytes);

  const namespacePath = path.join(possession.receiverOptions.stateRoot, Possession.NAMESPACE);
  const namespaceBackup = namespacePath + '-backup';
  fs.renameSync(namespacePath, namespaceBackup);
  const absentSnapshot = Continuity.captureState(StateFixture.observationOptions(state, 'local-possession-observation:separation-absent', '2026-08-20T15:30:00.000Z'));
  const absent = buildAudit(input, receipt, absentSnapshot, 'absent', '2026-08-20T15:30:30.000Z');
  equal(absent.receipt.decision.classification, 'HOLD_LOCAL_POSSESSION_STATE_ABSENT_AGAINST_PRESENTED_CHECKPOINT', 'separated absence becomes typed hold');
  equal(absent.receipt.truth.currentAbsenceDetectedAgainstSeparatedCheckpoint, true, 'separated absence truth is explicit');
  fs.renameSync(namespaceBackup, namespacePath);

  const unexpectedPath = path.join(answersDir, 'unexpected.txt');
  fs.writeFileSync(unexpectedPath, 'x');
  const invalidSnapshot = Continuity.captureState(StateFixture.observationOptions(state, 'local-possession-observation:separation-invalid', '2026-08-20T15:31:00.000Z'));
  const invalid = buildAudit(input, receipt, invalidSnapshot, 'invalid', '2026-08-20T15:31:30.000Z');
  equal(invalid.receipt.decision.classification, 'HOLD_CURRENT_LOCAL_POSSESSION_STATE_INVALID', 'separated invalid state becomes typed hold');
  equal(invalid.receipt.truth.currentInvalidityDetected, true, 'separated invalidity truth is explicit');
  fs.unlinkSync(unexpectedPath);

  const identitySnapshot = Continuity.buildSnapshot({
    observationId: 'local-possession-observation:separation-identity-drift',
    observedAt: '2026-08-20T15:32:00.000Z',
    availability: 'AVAILABLE',
    receiverIdDigest: 'sha256:' + 'a'.repeat(64),
    challengerIdDigest: exactSnapshot.challengerIdDigest,
    receiverPolicyRef: exactSnapshot.receiverPolicyRef,
    entries: exactSnapshot.entries,
    errors: []
  });
  const identity = buildAudit(input, receipt, identitySnapshot, 'identity-drift', '2026-08-20T15:32:30.000Z');
  equal(identity.receipt.decision.classification, 'HOLD_LOCAL_POSSESSION_IDENTITY_CHANGED', 'separated identity drift becomes typed hold');
  equal(identity.receipt.truth.comparisonBoundToExactConfiguredIdentity, false, 'identity drift is not compared as same identity');

  const nestedTamper = copy(input);
  nestedTamper.anchoredWitnessReceipt.authorizationEvidence.verifiedSignatures = 1;
  throws(() => Separation.buildSeparatedWitness(nestedTamper), /anchored witness is invalid/, 'tampered nested anchored receipt is refused');
  const receiptTamper = copy(receipt);
  receiptTamper.separationEvidence.combinedVerifiedSeats = 3;
  equal(Separation.verifySeparatedWitness(input, receiptTamper).pass, false, 'separation receipt tamper is detected');
  let independenceTamper = copy(receipt);
  independenceTamper.truth.keyCustodyIndependenceProven = true;
  independenceTamper = redigest(independenceTamper, 'receiptDigest');
  equal(Separation.verifySeparatedWitness(input, independenceTamper).pass, false, 'invented key-custody independence fails with recomputed digest');
  let identityTamper = copy(receipt);
  identityTamper.truth.declaredPrincipalDigestsAuthenticated = true;
  identityTamper = redigest(identityTamper, 'receiptDigest');
  equal(Separation.verifySeparatedWitness(input, identityTamper).pass, false, 'invented principal identity fails with recomputed digest');
  let auditTamper = copy(exact.receipt);
  auditTamper.truth.separationReceiptExternallyRetained = true;
  auditTamper = redigest(auditTamper, 'auditDigest');
  equal(Separation.verifySeparatedAudit(exact.input, auditTamper).pass, false, 'invented external retention fails with recomputed audit digest');
  throws(() => Separation.buildSeparatedAudit({ ...exact.input, checkedAt: '2026-08-20T15:24:20.000Z' }), /cannot predate separation verification/, 'separated audit cannot predate separation receipt');
  const overBound = copy(input);
  overBound.padding = 'x'.repeat(Separation.MAX_ARTIFACT_CANONICAL_BYTES);
  throws(() => Separation.buildSeparatedWitness(overBound), /exceeds the 512 KiB canonical artifact bound/, 'oversized separation input is refused before field processing');

  const serializedArtifacts = [Separation.stableStringify(receipt), Separation.stableStringify(exact.receipt)];
  serializedArtifacts.forEach((serialized, artifactIndex) => {
    witnessPackage.pairs.forEach((pair, pairIndex) => {
      equal(serialized.includes(Fixture.publicKeyPem(pair)), false, 'public artifact ' + artifactIndex + ' omits witness public key ' + pairIndex);
    });
    anchorPackage.pairs.forEach((pair, pairIndex) => {
      equal(serialized.includes(Fixture.publicKeyPem(pair)), false, 'public artifact ' + artifactIndex + ' omits anchor public key ' + pairIndex);
    });
    witnessPackage.witnessInput.signedAttestations.forEach((attestation, index) => {
      equal(serialized.includes(attestation.signature), false, 'public artifact ' + artifactIndex + ' omits witness signature ' + index);
      equal(serialized.includes(attestation.attestationId), false, 'public artifact ' + artifactIndex + ' omits witness attestation id ' + index);
    });
    anchorPackage.anchoredWitnessInput.policyAuthorizations.forEach((authorization, index) => {
      equal(serialized.includes(authorization.signature), false, 'public artifact ' + artifactIndex + ' omits anchor signature ' + index);
      equal(serialized.includes(authorization.authorizationId), false, 'public artifact ' + artifactIndex + ' omits anchor authorization id ' + index);
    });
    equal(serialized.includes(possession.receiverKey.receiverId), false, 'public artifact ' + artifactIndex + ' omits raw receiver label');
    equal(serialized.includes(possession.challenger.challengerId), false, 'public artifact ' + artifactIndex + ' omits raw challenger label');
    equal(serialized.includes(possession.receiverOptions.stateRoot), false, 'public artifact ' + artifactIndex + ' omits state path');
    equal(serialized.includes(possession.custodyResult.receiverReceipt.custodyRecordRef.id), false, 'public artifact ' + artifactIndex + ' omits custody record id');
    equal(serialized.includes(state.first.responsePackage.responseSignature), false, 'public artifact ' + artifactIndex + ' omits response signature');
  });
  ok(Buffer.byteLength(Separation.stableStringify(receipt), 'utf8') <= Separation.MAX_ARTIFACT_CANONICAL_BYTES, 'separation receipt stays within artifact bound');
  ok(Buffer.byteLength(Separation.stableStringify(exact.receipt), 'utf8') <= Separation.MAX_ARTIFACT_CANONICAL_BYTES, 'separated audit stays within artifact bound');

  const receiptSchema = JSON.parse(fs.readFileSync(path.join(__dirname, 'model-shadow-review-challenge-transition-local-possession-checkpoint-separated-witness.schema.json'), 'utf8'));
  const auditSchema = JSON.parse(fs.readFileSync(path.join(__dirname, 'model-shadow-review-challenge-transition-local-possession-separated-continuity.schema.json'), 'utf8'));
  const contract = JSON.parse(fs.readFileSync(path.join(__dirname, 'module.contract.json'), 'utf8'));
  equal(receiptSchema.$id, Separation.RECEIPT_SCHEMA, 'receipt schema identity matches runtime');
  equal(auditSchema.$id, Separation.AUDIT_SCHEMA, 'audit schema identity matches runtime');
  equal(receiptSchema.additionalProperties, false, 'receipt schema closes unknown fields');
  equal(auditSchema.additionalProperties, false, 'audit schema closes unknown fields');
  equal(receiptSchema.properties.separationEvidence.properties.sharedKeyFingerprintCount.const, 0, 'receipt schema requires zero shared key fingerprints');
  equal(receiptSchema.properties.separationEvidence.properties.sharedDeclaredPrincipalDigestCount.const, 0, 'receipt schema requires zero shared principal digests');
  equal(receiptSchema.$defs.truth.properties.keyCustodyIndependenceProven.const, false, 'receipt schema keeps key independence false');
  equal(receiptSchema.$defs.truth.properties.realWorldControllerIndependenceProven.const, false, 'receipt schema keeps controller independence false');
  equal(receiptSchema.$defs.truth.properties.sameControllerWithDistinctKeysStillPossible.const, true, 'receipt schema preserves same-controller counterexample');
  equal(receiptSchema.$defs.truth.properties.crossLayerCollusionExcluded.const, false, 'receipt schema keeps collusion exclusion false');
  equal(receiptSchema.$defs.truth.properties.witnessPolicyReplacementPrevented.const, false, 'receipt schema keeps policy prevention false');
  equal(auditSchema.$defs.truth.properties.checkpointDeletionOrRollbackPrevented.const, false, 'audit schema keeps checkpoint prevention false');
  equal(auditSchema.$defs.truth.properties.currentResponseStateDeletionOrRollbackPrevented.const, false, 'audit schema keeps response-state prevention false');
  equal(auditSchema.$defs.decision.properties.autonomousActionCount.const, 0, 'audit schema prevents autonomous repair');
  equal(auditSchema.$defs.snapshotSummary.additionalProperties, false, 'audit snapshot schema is exact');
  equal(auditSchema.$defs.comparison.additionalProperties, false, 'audit comparison schema is exact');
  equal(contract.id, 'model-shadow-review-challenge-transition-local-possession-checkpoint-separation', 'contract id is exact');
  equal(contract.version, 'v1.7', 'contract version is exact');
  equal(contract.status, 'TEST', 'contract remains TEST');
  equal(contract.permissions.length, 0, 'contract declares no permission');
  equal(contract.boundaries.reads.length, 0, 'contract declares no read surface');
  equal(contract.boundaries.writes.length, 0, 'contract declares no write surface');
  equal(contract.lifecycle.installed, false, 'contract remains uninstalled');
  equal(contract.lifecycle.promoted, false, 'contract remains unpromoted');
  ok(contract.boundaries.refuses.includes('distinct-key-fingerprints-as-independent-key-custody-proof'), 'contract refuses distinct keys as custody independence');
  ok(contract.boundaries.refuses.includes('observable-nonoverlap-as-independent-controller-proof'), 'contract refuses non-overlap as controller independence');
  ok(contract.boundaries.refuses.includes('observable-nonoverlap-as-collusion-exclusion'), 'contract refuses non-overlap as anti-collusion proof');
  ok(contract.boundaries.refuses.includes('separation-receipt-as-proven-external-retention'), 'contract refuses separation as external retention');
  ok(contract.boundaries.refuses.includes('automatic-canon'), 'contract refuses automatic CANON');

  const readme = fs.readFileSync(path.join(__dirname, 'README.md'), 'utf8');
  ok(/One controller can generate distinct keys and declare distinct digests/i.test(readme), 'README preserves same-controller counterexample');
  const source = fs.readFileSync(path.join(__dirname, 'model-shadow-review-challenge-transition-local-possession-checkpoint-separation.js'), 'utf8');
  equal(source.includes("require('../model-shadow-review-challenge-transition-local-possession-checkpoint-anchor/"), true, 'runtime composes exact v1.6 anchor');
  equal(source.includes("require('../model-shadow-review-challenge-transition-local-possession-checkpoint-witness/"), true, 'runtime composes exact v1.5 witness');
  equal(source.includes("require('fs')"), false, 'runtime imports no filesystem capability');
  equal(source.includes("require('child_process')"), false, 'runtime imports no process capability');
  equal(source.includes("require('http')"), false, 'runtime imports no HTTP capability');
  equal(source.includes("require('https')"), false, 'runtime imports no HTTPS capability');
  equal(source.includes("require('net')"), false, 'runtime imports no network capability');
  equal(source.includes('fetch('), false, 'runtime uses no fetch capability');
  equal(source.includes('crypto.sign'), false, 'runtime performs no signing operation');
  equal(source.includes('createPrivateKey'), false, 'runtime creates no private key');
  equal(source.includes('privateKeyIngested: false'), true, 'runtime keeps private-key ingestion false');
  equal(source.includes('keyCustodyIndependenceProven: true'), false, 'runtime never claims key custody independence');
  equal(source.includes('realWorldControllerIndependenceProven: true'), false, 'runtime never claims controller independence');
  equal(source.includes('crossLayerCollusionExcluded: true'), false, 'runtime never claims collusion exclusion');
  equal(source.includes('checkpointDeletionOrRollbackPrevented: true'), false, 'runtime never claims rollback prevention');
  equal(source.includes('automaticCanon: true'), false, 'runtime never claims automatic CANON');

  fs.unlinkSync(secondPath);
  const restoredSnapshot = Continuity.captureState(StateFixture.observationOptions(state, 'local-possession-observation:separation-restored', '2026-08-20T15:33:00.000Z'));
  equal(restoredSnapshot.availability, 'AVAILABLE', 'restored base state passes final strict scan');
  equal(restoredSnapshot.entryCount, 1, 'restored base state retains one response');
  const expectedPrefix = path.resolve(os.tmpdir()) + path.sep;
  ok(path.resolve(tempRoot).startsWith(expectedPrefix), 'synthetic cleanup root stays under OS temp');
  ok(path.basename(tempRoot).startsWith('axm-local-possession-checkpoint-separation-'), 'synthetic cleanup root has fixed prefix');
  cleanupVerified = true;
} finally {
  if (cleanupVerified) fs.rmSync(tempRoot, { recursive: true, force: false });
}

console.log('model shadow local possession checkpoint separation self-test passed: ' + checks + ' checks');
