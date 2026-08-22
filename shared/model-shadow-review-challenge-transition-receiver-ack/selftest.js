#!/usr/bin/env node
'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const childProcess = require('child_process');
const ReceiverAck = require('./model-shadow-review-challenge-transition-receiver-ack');
const Fixture = require('./selftest-fixture');

let checks = 0;

function check(condition, message) {
  assert.ok(condition, message);
  checks += 1;
  process.stdout.write('PASS ' + message + '\n');
}

function equal(actual, expected, message) {
  assert.deepStrictEqual(actual, expected, message);
  checks += 1;
  process.stdout.write('PASS ' + message + '\n');
}

function throws(fn, pattern, message) {
  assert.throws(fn, pattern, message);
  checks += 1;
  process.stdout.write('PASS ' + message + '\n');
}

function readJson(name) {
  return JSON.parse(fs.readFileSync(path.join(__dirname, name), 'utf8'));
}

function resign(acknowledgement, privateKey) {
  const value = Fixture.copy(acknowledgement);
  value.signature = '';
  value.signature = crypto.sign(
    null,
    Buffer.from(ReceiverAck.stableStringify(ReceiverAck.acknowledgementSigningPayload(value)), 'utf8'),
    privateKey
  ).toString('base64');
  return value;
}

function run() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'axm-receiver-ack-'));
  try {
    const fixture = Fixture.buildFixture(tempRoot);
    const policySchema = readJson('model-shadow-review-challenge-transition-receiver-policy.schema.json');
    const acknowledgementSchema = readJson('model-shadow-review-challenge-transition-receiver-acknowledgement.schema.json');
    const receiptSchema = readJson('model-shadow-review-challenge-transition-receiver-acknowledgement-witness.schema.json');
    const contract = readJson('module.contract.json');
    const source = fs.readFileSync(path.join(__dirname, 'model-shadow-review-challenge-transition-receiver-ack.js'), 'utf8');

    equal(ReceiverAck.VERSION, '1.1.0', 'module version is exact');
    equal(ReceiverAck.STATUS, 'TEST', 'module status remains TEST');
    equal(ReceiverAck.MAX_RECEIVERS, 10, 'receiver bound is exact');
    equal(ReceiverAck.MIN_REQUIRED_ACKNOWLEDGEMENTS, 2, 'minimum acknowledgement threshold is exact');
    equal(ReceiverAck.MAX_POLICY_CANONICAL_BYTES, 256 * 1024, 'policy canonical byte bound is exact');
    equal(ReceiverAck.MAX_WITNESS_CANONICAL_BYTES, 48 * 1024 * 1024, 'witness canonical byte bound is exact');
    check(!source.includes("require('fs')") && !source.includes("require('path')") && !source.includes("require('child_process')") && !source.includes('fetch('), 'runtime has no filesystem process path or network dependency');

    const policy = fixture.policy;
    equal(policy.schema, ReceiverAck.POLICY_SCHEMA, 'policy schema identity is exact');
    equal(policy.requiredAcknowledgements, 2, 'policy retains exact acknowledgement threshold');
    equal(policy.receivers.length, 3, 'policy retains exact receiver count');
    equal(policy.receivers.map(item => item.receiverId), ['receiver:alpha', 'receiver:beta', 'receiver:gamma'], 'policy normalizes receiver labels by deterministic code-unit order');
    check(policy.truth.callerSuppliedReceiverPolicy, 'policy explicitly admits caller origin');
    check(policy.truth.distinctReceiverLabelsVerified, 'policy verifies distinct receiver labels');
    check(policy.truth.distinctReceiverKeysVerified, 'policy verifies distinct Ed25519 public keys');
    equal(policy.truth.receiverPolicyAuthorityAuthenticated, false, 'policy authenticates no authority');
    equal(policy.truth.receiverIdentitiesAuthenticated, false, 'policy authenticates no receiver identity');
    equal(policy.truth.realWorldReceiverIndependenceProven, false, 'policy proves no real-world receiver independence');
    equal(ReceiverAck.validatePolicy(policy), policy, 'policy validates by exact rebuild');
    equal(ReceiverAck.buildPolicy(Fixture.copy(fixture.basePolicyInput)), policy, 'policy rebuild is deterministic from copied input');

    const threshold = ReceiverAck.buildWitness(fixture.witnessInputs.threshold);
    equal(threshold.schema, ReceiverAck.RECEIPT_SCHEMA, 'witness receipt schema identity is exact');
    equal(threshold.assessmentRef, ReceiverAck.assessmentRef(fixture.assessment), 'witness binds exact v1.0 assessment reference');
    equal(threshold.rosterRef, fixture.assessment.rosterRef, 'witness binds exact v1.0 roster reference');
    equal(threshold.receiverPolicyRef.sha256, policy.policyDigest, 'witness binds exact receiver policy digest');
    equal(threshold.acknowledgementEvidence.requiredAcknowledgements, 2, 'witness retains exact required acknowledgement count');
    equal(threshold.acknowledgementEvidence.enabledReceiverCount, 3, 'witness retains exact enabled receiver count');
    equal(threshold.acknowledgementEvidence.verifiedAcknowledgements, 2, 'witness verifies two detached acknowledgements');
    equal(threshold.acknowledgementEvidence.acknowledgements.length, 2, 'witness retains two bounded acknowledgement summaries');
    equal(threshold.acknowledgementEvidence.missingReceiverIdDigests.length, 1, 'threshold receipt retains one missing declared receiver digest');
    equal(threshold.acknowledgementEvidence.allEnabledDeclaredReceiversAcknowledged, false, 'threshold can be met without claiming all enabled receivers acknowledged');
    equal(threshold.decision.classification, 'DECLARED_RECEIVER_ACKNOWLEDGEMENT_THRESHOLD_MET', 'two valid acknowledgements meet declared threshold');
    equal(threshold.decision.thresholdStatus, 'MET', 'threshold status is exact');
    equal(threshold.decision.reviewRequired, false, 'met declared threshold adds no incomplete-threshold hold');
    equal(threshold.decision.autonomousActionCount, 0, 'met threshold triggers no autonomous action');
    check(threshold.truth.assessmentVerifiedByExactRebuild, 'witness exact-rebuilds complete v1.0 assessment');
    check(threshold.truth.receiverPolicyVerifiedByExactRebuild, 'witness exact-rebuilds receiver policy');
    check(threshold.truth.everyPresentedAcknowledgementSignatureCryptographicallyValid, 'witness verifies every presented signature');
    check(threshold.truth.distinctPresentedReceiverLabelsVerified, 'witness verifies presented receiver labels are distinct');
    check(threshold.truth.distinctPresentedReceiverKeysVerified, 'witness verifies presented keys are distinct');
    check(threshold.truth.acknowledgementThresholdMet, 'threshold-met truth is explicit');
    check(threshold.truth.declaredReceiverAcknowledgementStatementsObserved, 'declared-key acknowledgement statements are explicit');
    check(threshold.truth.signingKeyPossessionEvidenceObserved, 'signing-key possession evidence is explicit');
    equal(threshold.truth.realWorldReceiverIndependenceProven, false, 'same-process distinct keys prove no operator independence');
    equal(threshold.truth.actualTransportDeliveryProven, false, 'signatures prove no actual transport delivery');
    equal(threshold.truth.receiverReadOrAppliedAssessmentProven, false, 'signatures prove no receiver read or application');
    equal(threshold.truth.receiverPersistedAssessmentBytesProven, false, 'signatures prove no persisted assessment bytes');
    equal(threshold.truth.independentExternalRetentionProven, false, 'signatures prove no independent external retention');
    equal(threshold.truth.retentionDurationProven, false, 'signatures prove no retention duration');
    equal(threshold.truth.deletionOrRollbackPrevented, false, 'signatures prevent no deletion or rollback');
    equal(threshold.truth.hostAuthorizationAuthenticated, false, 'witness authenticates no host entrypoint');
    equal(threshold.truth.executionAuthorized, false, 'witness grants no execution authority');
    equal(threshold.truth.adoptionAuthorized, false, 'witness grants no adoption authority');
    equal(threshold.truth.automaticCanon, false, 'witness grants no CANON authority');
    check(ReceiverAck.verifyWitness(fixture.witnessInputs.threshold, threshold).pass, 'threshold witness verifies by exact rebuild');
    equal(ReceiverAck.buildWitness(Fixture.copy(fixture.witnessInputs.threshold)), threshold, 'witness rebuild is deterministic from copied input');

    check(fixture.keys.length === 3 && fixture.keys.every(key => key.privateKey), 'counterexample keys were generated together in one fixture process');
    check(threshold.truth.acknowledgementThresholdMet && !threshold.truth.realWorldReceiverIndependenceProven, 'same-process two-key counterexample meets threshold without independence proof');

    const serializedThreshold = JSON.stringify(threshold);
    check(!serializedThreshold.includes('receiver:alpha') && !serializedThreshold.includes('receiver:beta'), 'receipt embeds no raw receiver label');
    check(!serializedThreshold.includes(fixture.keys[0].publicKeyPem) && !serializedThreshold.includes(fixture.keys[1].publicKeyPem), 'receipt embeds no raw public key');
    check(!serializedThreshold.includes(fixture.acknowledgements[0].signature) && !serializedThreshold.includes(fixture.acknowledgements[1].signature), 'receipt embeds no raw signature');
    check(!serializedThreshold.includes(tempRoot), 'receipt embeds no temporary machine path');
    check(!serializedThreshold.includes('advanceInput') && !serializedThreshold.includes('transitionInput'), 'receipt embeds no transient upstream assessment package');
    check(!ReceiverAck.stableStringify(fixture.witnessInputs.threshold).includes('PRIVATE KEY'), 'runtime witness input contains no private key material');

    const complete = ReceiverAck.buildWitness(fixture.witnessInputs.complete);
    equal(complete.acknowledgementEvidence.verifiedAcknowledgements, 3, 'complete witness verifies all three acknowledgements');
    equal(complete.acknowledgementEvidence.missingReceiverIdDigests, [], 'complete witness has no missing receiver digest');
    check(complete.acknowledgementEvidence.allEnabledDeclaredReceiversAcknowledged, 'complete witness marks all enabled labels acknowledged');
    check(complete.truth.allEnabledDeclaredReceiversAcknowledged, 'complete all-enabled truth is explicit');

    const incomplete = ReceiverAck.buildWitness(fixture.witnessInputs.incomplete);
    equal(incomplete.decision.classification, 'HOLD_DECLARED_RECEIVER_ACKNOWLEDGEMENT_THRESHOLD_INCOMPLETE', 'one valid acknowledgement produces typed incomplete-threshold hold');
    equal(incomplete.decision.thresholdStatus, 'INCOMPLETE', 'incomplete threshold status is exact');
    equal(incomplete.acknowledgementEvidence.verifiedAcknowledgements, 1, 'incomplete receipt preserves one valid acknowledgement');
    equal(incomplete.acknowledgementEvidence.missingReceiverIdDigests.length, 2, 'incomplete receipt retains two missing receiver digests');
    equal(incomplete.truth.acknowledgementThresholdMet, false, 'incomplete-threshold truth is explicit');
    check(incomplete.decision.reviewRequired, 'incomplete declared threshold requires review');
    equal(incomplete.decision.autonomousActionCount, 0, 'incomplete threshold triggers no autonomous action');

    const empty = ReceiverAck.buildWitness(fixture.witnessInputs.empty);
    equal(empty.acknowledgementEvidence.verifiedAcknowledgements, 0, 'empty witness preserves zero verified acknowledgements');
    equal(empty.decision.classification, 'HOLD_DECLARED_RECEIVER_ACKNOWLEDGEMENT_THRESHOLD_INCOMPLETE', 'empty acknowledgement set produces typed hold');
    equal(empty.truth.declaredReceiverAcknowledgementStatementsObserved, false, 'empty acknowledgement set claims no observed statement');
    equal(empty.truth.signingKeyPossessionEvidenceObserved, false, 'empty acknowledgement set claims no key-possession evidence');

    const oneReceiver = Fixture.copy(fixture.basePolicyInput);
    oneReceiver.receivers = [oneReceiver.receivers[0]];
    oneReceiver.requiredAcknowledgements = 2;
    throws(() => ReceiverAck.buildPolicy(oneReceiver), /at least two receiver entries/, 'one-receiver policy is refused');
    const duplicateReceiver = Fixture.copy(fixture.basePolicyInput);
    duplicateReceiver.receivers[1].receiverId = duplicateReceiver.receivers[0].receiverId;
    throws(() => ReceiverAck.buildPolicy(duplicateReceiver), /receiver ids must be unique/, 'duplicate receiver label is refused');
    const duplicateKey = Fixture.copy(fixture.basePolicyInput);
    duplicateKey.receivers[1].publicKeyPem = duplicateKey.receivers[0].publicKeyPem;
    throws(() => ReceiverAck.buildPolicy(duplicateKey), /public keys must be unique/, 'duplicate public key is refused as independent receiver');
    const rsa = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
    const nonEd = Fixture.copy(fixture.basePolicyInput);
    nonEd.receivers[0].publicKeyPem = rsa.publicKey.export({ type: 'spki', format: 'pem' }).toString();
    throws(() => ReceiverAck.buildPolicy(nonEd), /must be Ed25519/, 'non-Ed25519 receiver key is refused');
    const oneEnabled = Fixture.copy(fixture.basePolicyInput);
    oneEnabled.receivers[1].enabled = false;
    oneEnabled.receivers[2].enabled = false;
    throws(() => ReceiverAck.buildPolicy(oneEnabled), /at least two enabled receivers/, 'policy with fewer than two enabled receivers is refused');
    const excessiveThreshold = Fixture.copy(fixture.basePolicyInput);
    excessiveThreshold.requiredAcknowledgements = 4;
    throws(() => ReceiverAck.buildPolicy(excessiveThreshold), /integer from 2 to 3/, 'threshold above enabled receiver count is refused');

    const badSignature = Fixture.copy(fixture.witnessInputs.threshold);
    badSignature.signedAcknowledgements[0].signature = badSignature.signedAcknowledgements[1].signature;
    throws(() => ReceiverAck.buildWitness(badSignature), /signature verification failed/, 'signature from another receiver key is refused');
    const alteredAssessment = Fixture.copy(fixture.witnessInputs.threshold);
    alteredAssessment.signedAcknowledgements[0].assessmentRef.sha256 = ReceiverAck.sha256({ altered: 'assessment' });
    alteredAssessment.signedAcknowledgements[0] = resign(alteredAssessment.signedAcknowledgements[0], fixture.keys[0].privateKey);
    throws(() => ReceiverAck.buildWitness(alteredAssessment), /assessment reference mismatch/, 're-signed altered assessment reference is refused');
    const alteredRoster = Fixture.copy(fixture.witnessInputs.threshold);
    alteredRoster.signedAcknowledgements[0].rosterRef.sha256 = ReceiverAck.sha256({ altered: 'roster' });
    alteredRoster.signedAcknowledgements[0] = resign(alteredRoster.signedAcknowledgements[0], fixture.keys[0].privateKey);
    throws(() => ReceiverAck.buildWitness(alteredRoster), /roster reference mismatch/, 're-signed altered roster reference is refused');
    const alteredPolicyDigest = Fixture.copy(fixture.witnessInputs.threshold);
    alteredPolicyDigest.signedAcknowledgements[0].policyDigest = ReceiverAck.sha256({ altered: 'policy' });
    alteredPolicyDigest.signedAcknowledgements[0] = resign(alteredPolicyDigest.signedAcknowledgements[0], fixture.keys[0].privateKey);
    throws(() => ReceiverAck.buildWitness(alteredPolicyDigest), /policy digest mismatch/, 're-signed altered policy digest is refused');
    const alteredScope = Fixture.copy(fixture.witnessInputs.threshold);
    alteredScope.signedAcknowledgements[0].scope = 'ACKNOWLEDGE_SOMETHING_ELSE';
    alteredScope.signedAcknowledgements[0] = resign(alteredScope.signedAcknowledgements[0], fixture.keys[0].privateKey);
    throws(() => ReceiverAck.buildWitness(alteredScope), /scope mismatch/, 're-signed altered acknowledgement scope is refused');
    const retentionClaim = Fixture.copy(fixture.witnessInputs.threshold);
    retentionClaim.signedAcknowledgements[0].retentionClaim = 'DURABLE_RETENTION_PROVEN';
    retentionClaim.signedAcknowledgements[0] = resign(retentionClaim.signedAcknowledgements[0], fixture.keys[0].privateKey);
    throws(() => ReceiverAck.buildWitness(retentionClaim), /retentionClaim mismatch/, 'undeclared durable retention claim is refused even when signed');
    const wrongAlgorithm = Fixture.copy(fixture.witnessInputs.threshold);
    wrongAlgorithm.signedAcknowledgements[0].signatureAlgorithm = 'RSA';
    throws(() => ReceiverAck.buildWitness(wrongAlgorithm), /must be Ed25519/, 'non-Ed25519 acknowledgement algorithm is refused');

    const unknownKey = Fixture.keyPair('receiver:unknown');
    const unknownAck = Fixture.signedAcknowledgement('unknown', fixture.policy, fixture.assessment, unknownKey, '2026-08-20T15:09:00.000Z');
    const unknownReceiver = Fixture.copy(fixture.witnessInputs.threshold);
    unknownReceiver.signedAcknowledgements = [unknownAck];
    throws(() => ReceiverAck.buildWitness(unknownReceiver), /outside policy/, 'acknowledgement from receiver outside policy is refused');

    const disabledPolicyInput = Fixture.policyInput(
      'disabled-gamma', fixture.assessment, fixture.keys, 2,
      { disabledReceiverId: 'receiver:gamma' }
    );
    const disabledPolicy = ReceiverAck.buildPolicy(disabledPolicyInput);
    const disabledAck = Fixture.signedAcknowledgement('disabled-gamma', disabledPolicy, fixture.assessment, fixture.keys[2], '2026-08-20T15:09:00.000Z');
    const disabledInput = Fixture.witnessInput('disabled', fixture.assessmentInput, fixture.assessment, disabledPolicy, [disabledAck]);
    throws(() => ReceiverAck.buildWitness(disabledInput), /disabled receiver/, 'acknowledgement from disabled receiver is refused');

    const duplicateAck = Fixture.copy(fixture.witnessInputs.threshold);
    duplicateAck.signedAcknowledgements = [duplicateAck.signedAcknowledgements[0], Fixture.copy(duplicateAck.signedAcknowledgements[0])];
    throws(() => ReceiverAck.buildWitness(duplicateAck), /at most one item per receiver/, 'duplicate acknowledgement for one receiver is refused');
    const earlyAck = Fixture.copy(fixture.witnessInputs.threshold);
    earlyAck.signedAcknowledgements[0].acknowledgedAt = '2026-08-20T15:04:00.000Z';
    earlyAck.signedAcknowledgements[0] = resign(earlyAck.signedAcknowledgements[0], fixture.keys[0].privateKey);
    throws(() => ReceiverAck.buildWitness(earlyAck), /cannot predate assessment or policy/, 'acknowledgement before assessment or policy is refused');
    const lateAck = Fixture.copy(fixture.witnessInputs.threshold);
    lateAck.signedAcknowledgements[0].acknowledgedAt = '2026-08-20T16:00:01.000Z';
    lateAck.verifiedAt = '2026-08-20T16:00:01.000Z';
    lateAck.signedAcknowledgements[0] = resign(lateAck.signedAcknowledgements[0], fixture.keys[0].privateKey);
    throws(() => ReceiverAck.buildWitness(lateAck), /after policy expiry/, 'acknowledgement after policy expiry is refused');
    const lateWitness = Fixture.copy(fixture.witnessInputs.threshold);
    lateWitness.verifiedAt = '2026-08-20T16:00:01.000Z';
    throws(() => ReceiverAck.buildWitness(lateWitness), /witness is after policy expiry/, 'witness verification after policy expiry is refused');
    const earlyWitness = Fixture.copy(fixture.witnessInputs.threshold);
    earlyWitness.verifiedAt = '2026-08-20T15:07:30.000Z';
    throws(() => ReceiverAck.buildWitness(earlyWitness), /cannot postdate witness verification/, 'acknowledgement after witness verification is refused');
    const earlyPolicyInput = Fixture.policyInput(
      'early-policy', fixture.assessment, fixture.keys, 2,
      { issuedAt: '2026-08-20T15:04:00.000Z' }
    );
    const earlyPolicy = ReceiverAck.buildPolicy(earlyPolicyInput);
    const earlyPolicyWitness = Fixture.witnessInput('early-policy', fixture.assessmentInput, fixture.assessment, earlyPolicy, []);
    throws(() => ReceiverAck.buildWitness(earlyPolicyWitness), /policy cannot predate assessment/, 'receiver policy before assessment is refused');

    const tamperedAssessment = Fixture.copy(fixture.witnessInputs.threshold);
    tamperedAssessment.assessmentReceipt.truth.unlistedRootsExcluded = true;
    throws(() => ReceiverAck.buildWitness(tamperedAssessment), /assessment is invalid/, 'tampered v1.0 assessment is refused');
    const wrongAssessmentPolicyInput = Fixture.copy(fixture.basePolicyInput);
    wrongAssessmentPolicyInput.assessmentRef.sha256 = ReceiverAck.sha256({ wrong: 'assessment' });
    const wrongAssessmentPolicy = ReceiverAck.buildPolicy(wrongAssessmentPolicyInput);
    const wrongAssessmentPolicyWitness = Fixture.witnessInput('wrong-assessment-policy', fixture.assessmentInput, fixture.assessment, wrongAssessmentPolicy, []);
    throws(() => ReceiverAck.buildWitness(wrongAssessmentPolicyWitness), /does not match exact assessment/, 'policy bound to another assessment is refused');
    const policyTamper = Fixture.copy(fixture.witnessInputs.threshold);
    policyTamper.receiverPolicy.truth.receiverPolicyAuthorityAuthenticated = true;
    throws(() => ReceiverAck.buildWitness(policyTamper), /policy does not exact-rebuild/, 'policy authority tampering is refused');

    const undeclaredTransport = Fixture.copy(fixture.witnessInputs.threshold);
    undeclaredTransport.actualTransportDeliveryProven = true;
    throws(() => ReceiverAck.buildWitness(undeclaredTransport), /unknown fields/, 'undeclared transport proof input is refused');
    const undeclaredAdoption = Fixture.copy(fixture.witnessInputs.threshold);
    undeclaredAdoption.adoptionAuthorized = true;
    throws(() => ReceiverAck.buildWitness(undeclaredAdoption), /unknown fields/, 'undeclared adoption authority input is refused');
    const tamperedReceipt = Fixture.copy(threshold);
    tamperedReceipt.truth.independentExternalRetentionProven = true;
    check(!ReceiverAck.verifyWitness(fixture.witnessInputs.threshold, tamperedReceipt).pass, 'external-retention receipt tamper fails exact verification');

    const tenKeys = Array.from({ length: 10 }, (_, index) => Fixture.keyPair('receiver:bounded-' + String(index).padStart(2, '0')));
    const tenPolicyInput = Fixture.policyInput('ten', fixture.assessment, tenKeys, 10);
    const tenPolicy = ReceiverAck.buildPolicy(tenPolicyInput);
    const tenAcknowledgements = tenKeys.map((key, index) => Fixture.signedAcknowledgement(
      'bounded-' + String(index).padStart(2, '0'),
      tenPolicy,
      fixture.assessment,
      key,
      '2026-08-20T15:' + String(10 + index).padStart(2, '0') + ':00.000Z'
    ));
    const tenInput = Fixture.witnessInput('ten', fixture.assessmentInput, fixture.assessment, tenPolicy, tenAcknowledgements, '2026-08-20T15:25:00.000Z');
    const tenReceipt = ReceiverAck.buildWitness(tenInput);
    equal(tenReceipt.acknowledgementEvidence.verifiedAcknowledgements, 10, 'maximum bounded witness verifies all ten acknowledgements');
    equal(tenReceipt.acknowledgementEvidence.missingReceiverIdDigests, [], 'maximum bounded witness has no missing receiver digest');
    check(tenReceipt.truth.acknowledgementThresholdMet, 'maximum bounded threshold is met');
    const elevenPolicyInput = Fixture.copy(tenPolicyInput);
    const extraKey = Fixture.keyPair('receiver:bounded-10');
    elevenPolicyInput.receivers.push({ receiverId: extraKey.receiverId, publicKeyPem: extraKey.publicKeyPem, enabled: true });
    elevenPolicyInput.requiredAcknowledgements = 10;
    throws(() => ReceiverAck.buildPolicy(elevenPolicyInput), /bounded receiver limit/, 'policy over bounded receiver limit is refused');
    const elevenAckInput = Fixture.copy(tenInput);
    elevenAckInput.signedAcknowledgements.push(Fixture.copy(tenAcknowledgements[0]));
    throws(() => ReceiverAck.buildWitness(elevenAckInput), /exceed the bounded receiver limit/, 'witness over bounded acknowledgement limit is refused');

    const oversizedPolicy = Fixture.copy(fixture.basePolicyInput);
    oversizedPolicy.padding = 'x'.repeat(ReceiverAck.MAX_POLICY_CANONICAL_BYTES);
    throws(() => ReceiverAck.buildPolicy(oversizedPolicy), /canonical byte limit/, 'policy over canonical byte limit is refused before field processing');
    const oversizedWitness = Fixture.copy(fixture.witnessInputs.threshold);
    oversizedWitness.padding = 'x'.repeat(ReceiverAck.MAX_WITNESS_CANONICAL_BYTES);
    throws(() => ReceiverAck.buildWitness(oversizedWitness), /canonical byte limit/, 'witness over canonical byte limit is refused before field processing');

    const child = childProcess.spawnSync(
      process.execPath,
      [path.join(__dirname, 'selftest-child.js')],
      {
        input: JSON.stringify({ input: fixture.witnessInputs.complete }),
        encoding: 'utf8',
        maxBuffer: 32 * 1024 * 1024
      }
    );
    equal(child.status, 0, 'fresh process rebuild exits successfully');
    const childResult = JSON.parse(child.stdout);
    check(childResult.pass, 'fresh process verifies rebuilt witness receipt');
    equal(childResult.receiptDigest, complete.receiptDigest, 'fresh process derives exact witness digest');
    equal(childResult.classification, complete.decision.classification, 'fresh process derives exact witness classification');
    equal(childResult.verifiedAcknowledgements, 3, 'fresh process derives exact acknowledgement count');

    equal(policySchema.$id, ReceiverAck.POLICY_SCHEMA, 'policy schema identity matches implementation');
    equal(acknowledgementSchema.$id, ReceiverAck.ACKNOWLEDGEMENT_SCHEMA, 'acknowledgement schema identity matches implementation');
    equal(receiptSchema.$id, ReceiverAck.RECEIPT_SCHEMA, 'receipt schema identity matches implementation');
    equal(policySchema.properties.receivers.maxItems, 10, 'policy schema mirrors receiver bound');
    equal(receiptSchema.properties.acknowledgementEvidence.properties.acknowledgements.maxItems, 10, 'receipt schema mirrors acknowledgement bound');
    equal(receiptSchema.properties.truth.properties.independentExternalRetentionProven.const, false, 'receipt schema keeps external retention false');
    equal(receiptSchema.properties.truth.properties.realWorldReceiverIndependenceProven.const, false, 'receipt schema keeps receiver independence false');
    equal(receiptSchema.properties.truth.properties.actualTransportDeliveryProven.const, false, 'receipt schema keeps actual transport false');
    equal(contract.status, 'TEST', 'contract remains TEST');
    equal(contract.permissions, [], 'contract remains permissionless');
    equal(contract.boundaries.reads, [], 'contract declares no direct read route');
    equal(contract.boundaries.writes, [], 'contract declares no direct write route');
    check(contract.boundaries.refuses.includes('distinct-signing-keys-as-independent-operators'), 'contract refuses distinct keys as operator independence');
    check(contract.boundaries.refuses.includes('signature-threshold-as-actual-network-delivery'), 'contract refuses signature threshold as transport proof');
    check(contract.boundaries.refuses.includes('threshold-receipt-as-independent-external-retention'), 'contract refuses threshold as external retention proof');
    check(contract.boundaries.refuses.includes('receipt-as-branch-adoption-or-execution-authority'), 'contract refuses receipt as adoption or execution authority');
    equal(contract.lifecycle.installed, false, 'contract remains uninstalled');
    equal(contract.lifecycle.promoted, false, 'contract remains unpromoted');

    process.stdout.write('\nModel Shadow review challenge transition receiver acknowledgement selftest: PASS (' + checks + ' checks)\n');
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}

run();
