#!/usr/bin/env node
'use strict';

const assert = require('assert');
const childProcess = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const AnchorGate = require('./model-shadow-review-challenge-anchor-gate');
const Witness = require('../model-shadow-review-challenge-witness/model-shadow-review-challenge-witness');
const Continuity = require('../model-shadow-review-challenge-continuity/model-shadow-review-challenge-continuity');
const Ledger = require('../model-shadow-review-challenge-ledger/model-shadow-review-challenge-ledger');
const Fixture = require('../model-shadow-review-challenge-ledger/selftest-fixture');

let checks = 0;
function check(value, label) { assert.ok(value, label); checks += 1; console.log('PASS ' + label); }
function equal(actual, expected, label) { assert.strictEqual(actual, expected); checks += 1; console.log('PASS ' + label); }
function throws(fn, pattern, label) { assert.throws(fn, pattern); checks += 1; console.log('PASS ' + label); }
function copy(value) { return JSON.parse(JSON.stringify(value)); }

const childPath = path.join(__dirname, 'selftest-child.js');

function sign(payload, privateKey, payloadBuilder) {
  const value = copy(payload);
  value.signature = crypto.sign(
    null,
    Buffer.from(payloadBuilder(value), 'utf8'),
    privateKey
  ).toString('base64');
  return value;
}

function buildWitnessPackage(checkpoint, tag) {
  const suffix = String(tag || 'base').replace(/[^a-z0-9-]/gi, '-').toLowerCase();
  const pairs = [crypto.generateKeyPairSync('ed25519'), crypto.generateKeyPairSync('ed25519')];
  const actorKinds = ['human', 'machine'];
  const policy = {
    schema: Witness.POLICY_SCHEMA,
    policyId: 'policy:anchor-gate-witness-' + suffix,
    issuedAt: '2026-08-20T14:08:00.000Z',
    expiresAt: '2026-08-20T14:20:00.000Z',
    audience: Witness.AUDIENCE,
    scope: Witness.SCOPE,
    authorityOrigin: Witness.AUTHORITY_ORIGIN,
    checkpointRef: {
      id: checkpoint.checkpointId,
      schema: checkpoint.schema,
      sha256: checkpoint.checkpointDigest
    },
    ledgerRef: copy(checkpoint.ledgerRef),
    entriesDigest: checkpoint.entriesDigest,
    requiredSignatures: 2,
    maxAttestationAgeSeconds: 600,
    keys: pairs.map((pair, index) => ({
      keyId: 'fixture-anchor-gate-witness-key-' + suffix + '-' + (index + 1),
      algorithm: 'Ed25519',
      publicKeyPem: pair.publicKey.export({ type: 'spki', format: 'pem' }),
      actorDigest: Witness.sha256('fixture-anchor-gate-witness-actor:' + suffix + ':' + index),
      actorKind: actorKinds[index],
      scope: Witness.SCOPE,
      enabled: true
    })),
    policyDigest: null
  };
  policy.policyDigest = Witness.policyDigest(policy);
  const attestations = policy.keys.map((key, index) => sign({
    schema: Witness.ATTESTATION_SCHEMA,
    attestationId: 'attestation:anchor-gate-witness-' + suffix + '-' + (index + 1),
    keyId: key.keyId,
    actorDigest: key.actorDigest,
    actorKind: key.actorKind,
    verdict: 'WITNESS',
    scope: Witness.SCOPE,
    policyDigest: policy.policyDigest,
    checkpointDigest: checkpoint.checkpointDigest,
    ledgerManifestDigest: checkpoint.ledgerRef.sha256,
    entriesDigest: checkpoint.entriesDigest,
    issuedAt: '2026-08-20T14:08:30.000Z',
    expiresAt: '2026-08-20T14:18:30.000Z',
    signatureAlgorithm: 'Ed25519',
    signature: ''
  }, pairs[index].privateKey, value => Witness.stableStringify(Witness.attestationSigningPayload(value))));
  const witnessInput = {
    witnessId: 'witness:anchor-gate-' + suffix,
    verifiedAt: '2026-08-20T14:09:00.000Z',
    checkpoint: copy(checkpoint),
    keyPolicy: policy,
    signedAttestations: attestations
  };
  return { witnessInput, witnessReceipt: Witness.buildWitness(witnessInput), pairs };
}

function buildAnchorPackage(witnessPackage, tag) {
  const suffix = String(tag || 'base').replace(/[^a-z0-9-]/gi, '-').toLowerCase();
  const pairs = [crypto.generateKeyPairSync('ed25519'), crypto.generateKeyPairSync('ed25519')];
  const stewardKinds = ['human', 'machine'];
  const witness = witnessPackage.witnessReceipt;
  const anchorPolicy = {
    schema: AnchorGate.ANCHOR_POLICY_SCHEMA,
    anchorId: 'anchor:checkpoint-witness-' + suffix,
    anchorEpoch: 1,
    issuedAt: '2026-08-20T14:00:00.000Z',
    expiresAt: '2026-08-20T15:00:00.000Z',
    status: 'TEST',
    audience: AnchorGate.AUDIENCE,
    scope: AnchorGate.SCOPE,
    authorityOrigin: AnchorGate.AUTHORITY_ORIGIN,
    requiredSignatures: 2,
    maxAuthorizationAgeSeconds: 1800,
    keys: pairs.map((pair, index) => ({
      anchorKeyId: 'fixture-anchor-key-' + suffix + '-' + (index + 1),
      algorithm: 'Ed25519',
      publicKeyPem: pair.publicKey.export({ type: 'spki', format: 'pem' }),
      stewardDigest: AnchorGate.sha256('fixture-anchor-steward:' + suffix + ':' + index),
      stewardKind: stewardKinds[index],
      scope: AnchorGate.SCOPE,
      enabled: true
    })),
    anchorDigest: null
  };
  anchorPolicy.anchorDigest = AnchorGate.anchorPolicyDigest(anchorPolicy);
  const policyAuthorizations = anchorPolicy.keys.map((key, index) => sign({
    schema: AnchorGate.AUTHORIZATION_SCHEMA,
    authorizationId: 'authorization:checkpoint-witness-' + suffix + '-' + (index + 1),
    anchorKeyId: key.anchorKeyId,
    stewardDigest: key.stewardDigest,
    stewardKind: key.stewardKind,
    verdict: 'AUTHORIZE',
    scope: AnchorGate.SCOPE,
    anchorDigest: anchorPolicy.anchorDigest,
    expectedAnchorDigest: anchorPolicy.anchorDigest,
    witnessPolicyDigest: witness.keyPolicyRef.sha256,
    witnessDigest: witness.witnessDigest,
    checkpointDigest: witness.checkpointRef.sha256,
    ledgerManifestDigest: witness.ledgerRef.sha256,
    entriesDigest: witness.entriesDigest,
    issuedAt: '2026-08-20T14:09:30.000Z',
    expiresAt: '2026-08-20T14:39:30.000Z',
    signatureAlgorithm: 'Ed25519',
    signature: ''
  }, pairs[index].privateKey, value => AnchorGate.stableStringify(AnchorGate.authorizationSigningPayload(value))));
  const anchoredWitnessInput = {
    receiptId: 'receipt:anchored-witness-' + suffix,
    verifiedAt: '2026-08-20T14:10:00.000Z',
    expectedAnchorDigest: anchorPolicy.anchorDigest,
    witnessInput: copy(witnessPackage.witnessInput),
    witnessReceipt: copy(witness),
    anchorPolicy,
    policyAuthorizations
  };
  return { anchoredWitnessInput, pairs };
}

function runChild(packagePath, stateRoot, ledgerId, tag, observedAt, checkedAt) {
  const result = childProcess.spawnSync(process.execPath, [
    childPath,
    packagePath,
    stateRoot,
    ledgerId,
    'observation:anchor-gate-child-' + tag,
    observedAt,
    'audit:anchor-gate-child-' + tag,
    checkedAt
  ], { encoding: 'utf8', windowsHide: true });
  const lines = String(result.stdout || '').trim().split(/\r?\n/).filter(Boolean);
  return {
    status: result.status,
    output: lines.length ? JSON.parse(lines[lines.length - 1]) : null,
    stderr: result.stderr
  };
}

function treeFingerprint(root) {
  const rows = [];
  function walk(directory, relative) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const absolute = path.join(directory, entry.name);
      const itemPath = relative ? relative + '/' + entry.name : entry.name;
      if (entry.isDirectory()) {
        rows.push({ path: itemPath + '/', kind: 'directory' });
        walk(absolute, itemPath);
      } else if (entry.isFile()) {
        const bytes = fs.readFileSync(absolute);
        rows.push({
          path: itemPath,
          kind: 'file',
          bytes: bytes.length,
          sha256: crypto.createHash('sha256').update(bytes).digest('hex')
        });
      } else {
        rows.push({ path: itemPath, kind: 'other' });
      }
    }
  }
  walk(root, '');
  return JSON.stringify(rows);
}

function verifiedRemove(target, parent) {
  const resolvedTarget = path.resolve(target);
  const resolvedParent = path.resolve(parent);
  if (resolvedTarget === resolvedParent || !resolvedTarget.startsWith(resolvedParent + path.sep)) {
    throw new Error('temporary deletion target escapes selftest root');
  }
  fs.rmSync(resolvedTarget, { recursive: true, force: true });
}

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'axm-challenge-anchor-gate-'));
try {
  const stateRoot = path.join(tempRoot, 'state-a');
  const otherStateRoot = path.join(tempRoot, 'state-b');
  fs.mkdirSync(stateRoot);
  fs.mkdirSync(otherStateRoot);
  const ledgerId = 'ledger:anchor-gate-selftest';
  const service = Ledger.createService({ stateRoot, ledgerId });
  const baseRequest = Fixture.buildRequest('anchor-gate-base');
  const baseReceipt = service.consume(baseRequest);
  const namespace = path.join(stateRoot, Ledger.NAMESPACE);
  const baseSnapshot = Continuity.captureState({
    stateRoot,
    ledgerId,
    observationId: 'observation:anchor-gate-base',
    observedAt: '2026-08-20T14:07:00.000Z'
  });
  const checkpoint = Continuity.buildCheckpoint({
    checkpointId: 'checkpoint:anchor-gate-base',
    anchoredAt: '2026-08-20T14:07:30.000Z',
    currentSnapshot: baseSnapshot
  });
  const witnessPackage = buildWitnessPackage(checkpoint, 'base');
  const anchorPackage = buildAnchorPackage(witnessPackage, 'base');
  const anchoredInput = anchorPackage.anchoredWitnessInput;
  const anchored = AnchorGate.buildAnchoredWitness(anchoredInput);

  equal(AnchorGate.VERSION, '0.5.0', 'module version is exact');
  equal(AnchorGate.STATUS, 'TEST', 'module status is TEST');
  equal(anchored.schema, AnchorGate.RECEIPT_SCHEMA, 'anchored witness schema identity is exact');
  equal(anchored.expectedAnchorDigest, anchoredInput.anchorPolicy.anchorDigest, 'anchored witness matches caller-presented anchor digest');
  equal(anchored.anchorRef.sha256, anchoredInput.anchorPolicy.anchorDigest, 'anchored witness binds exact anchor policy digest');
  equal(anchored.anchorEpoch, 1, 'anchored witness retains self-declared anchor epoch');
  equal(anchored.witnessRef.sha256, witnessPackage.witnessReceipt.witnessDigest, 'anchored witness binds exact v0.4 witness digest');
  equal(anchored.witnessPolicyRef.sha256, witnessPackage.witnessReceipt.keyPolicyRef.sha256, 'anchored witness binds exact witness policy digest');
  equal(anchored.checkpointRef.sha256, checkpoint.checkpointDigest, 'anchored witness binds exact checkpoint digest');
  equal(anchored.ledgerRef.sha256, checkpoint.ledgerRef.sha256, 'anchored witness binds exact ledger manifest digest');
  equal(anchored.entriesDigest, checkpoint.entriesDigest, 'anchored witness binds exact checkpoint entries digest');
  equal(anchored.authorizationEvidence.requiredSignatures, 2, 'anchored witness retains exact anchor signature threshold');
  equal(anchored.authorizationEvidence.verifiedSignatures, 2, 'anchored witness verifies two anchor authorizations');
  equal(new Set(anchored.authorizationEvidence.authorizations.map(item => item.keyFingerprint)).size, 2, 'anchored witness retains two distinct anchor key fingerprints');
  equal(new Set(anchored.authorizationEvidence.authorizations.map(item => item.stewardDigest)).size, 2, 'anchored witness retains two distinct steward digests');
  equal(anchored.truth.witnessVerifiedByExactRebuild, true, 'v0.4 witness is verified by exact rebuild');
  equal(anchored.truth.anchorAuthorizationSignaturesCryptographicallyValid, true, 'anchor authorization signature validity is explicit');
  equal(anchored.truth.anchorSigningKeyPossessionVerified, true, 'anchor signing-key possession evidence is explicit');
  equal(anchored.truth.witnessAndPolicyAuthorizedByExactAnchorSignatures, true, 'anchor signatures bind exact witness and policy');
  equal(anchored.truth.expectedAnchorDigestMatched, true, 'exact expected anchor digest match is explicit');
  equal(anchored.truth.anchorPolicyAuthorityAuthenticated, false, 'caller anchor is not promoted to authenticated policy authority');
  equal(anchored.truth.expectedAnchorDigestAuthorityAuthenticated, false, 'caller anchor pin is not promoted to authenticated authority');
  equal(anchored.truth.witnessPolicyAuthorityAuthenticated, false, 'anchored witness policy is not promoted to host authority');
  equal(anchored.truth.anchorEpochMonotonicityProven, false, 'self-declared anchor epoch is not promoted to monotonic state');
  equal(anchored.truth.anchorStewardRealWorldIdentityProven, false, 'anchor key possession is not promoted to real-world identity');
  equal(anchored.truth.declaredHumanAnchorStewardIsAuthenticatedHuman, false, 'declared human anchor key is not authenticated human evidence');
  equal(anchored.truth.actualHumanParticipationProven, false, 'anchor signatures are not promoted to actual human participation');
  equal(anchored.truth.jointAnchorAndPinSubstitutionStillPossible, true, 'joint anchor and pin substitution boundary is explicit');
  equal(anchored.truth.anchorExternallyRetained, false, 'anchor receipt does not claim external retention');
  equal(anchored.truth.deletionOrRollbackPrevented, false, 'anchored witness does not claim rollback prevention');
  equal(anchored.truth.hostAuthorizationAuthenticated, false, 'library gate does not claim host authorization');
  equal(anchored.truth.executionAuthorized, false, 'anchored witness grants no execution authority');
  equal(anchored.truth.automaticCanon, false, 'anchored witness grants no CANON authority');
  check(AnchorGate.verifyAnchoredWitness(anchoredInput, anchored).pass, 'anchored witness verifies by exact rebuild');
  equal(
    AnchorGate.stableStringify(AnchorGate.buildAnchoredWitness(copy(anchoredInput))),
    AnchorGate.stableStringify(anchored),
    'anchored witness rebuild is deterministic from copied input'
  );

  const serializedAnchored = AnchorGate.stableStringify(anchored);
  check(!serializedAnchored.includes('BEGIN PUBLIC KEY'), 'anchored witness receipt retains no raw public key');
  check(!serializedAnchored.includes(anchoredInput.policyAuthorizations[0].signature), 'anchored witness receipt retains no raw anchor signature');
  check(!serializedAnchored.includes('fixture-anchor-key-base-1'), 'anchored witness receipt retains no raw anchor key id');
  check(!serializedAnchored.includes('authorization:checkpoint-witness-base-1'), 'anchored witness receipt retains no raw authorization id');

  const wrongPin = copy(anchoredInput);
  wrongPin.expectedAnchorDigest = AnchorGate.sha256('different-anchor-pin');
  throws(() => AnchorGate.buildAnchoredWitness(wrongPin), /expected anchor digest does not match/, 'wrong expected anchor digest is refused');

  const corruptAnchor = copy(anchoredInput);
  corruptAnchor.anchorPolicy.anchorEpoch = 2;
  throws(() => AnchorGate.buildAnchoredWitness(corruptAnchor), /anchor digest mismatch/, 'modified anchor policy with stale self-digest is refused');

  const repinnedAnchor = copy(anchoredInput);
  repinnedAnchor.anchorPolicy.anchorEpoch = 2;
  repinnedAnchor.anchorPolicy.anchorDigest = AnchorGate.anchorPolicyDigest(repinnedAnchor.anchorPolicy);
  throws(() => AnchorGate.buildAnchoredWitness(repinnedAnchor), /expected anchor digest does not match/, 'modified self-digested anchor cannot reuse the original expected pin');

  const replacementWitnessPackage = buildWitnessPackage(checkpoint, 'replacement-policy');
  check(Witness.verifyWitness(replacementWitnessPackage.witnessInput, replacementWitnessPackage.witnessReceipt).pass, 'replacement witness policy and keys form a valid v0.4 witness');
  const witnessPolicySwap = copy(anchoredInput);
  witnessPolicySwap.witnessInput = replacementWitnessPackage.witnessInput;
  witnessPolicySwap.witnessReceipt = replacementWitnessPackage.witnessReceipt;
  throws(
    () => AnchorGate.buildAnchoredWitness(witnessPolicySwap),
    /witness policy digest mismatch|witness digest mismatch/,
    'valid replacement witness policy cannot reuse original anchor authorizations'
  );

  const reboundWithoutSignatures = copy(witnessPolicySwap);
  reboundWithoutSignatures.policyAuthorizations.forEach(authorization => {
    authorization.witnessPolicyDigest = replacementWitnessPackage.witnessReceipt.keyPolicyRef.sha256;
    authorization.witnessDigest = replacementWitnessPackage.witnessReceipt.witnessDigest;
  });
  throws(() => AnchorGate.buildAnchoredWitness(reboundWithoutSignatures), /signature verification failed/, 'rewritten anchor payload cannot reuse original anchor signatures');

  const badSignature = copy(anchoredInput);
  badSignature.policyAuthorizations[0].signature = badSignature.policyAuthorizations[1].signature;
  throws(() => AnchorGate.buildAnchoredWitness(badSignature), /signature verification failed/, 'signature from another anchor key is refused');

  const unlistedKey = copy(anchoredInput);
  unlistedKey.policyAuthorizations[0].anchorKeyId = 'fixture-unlisted-anchor-key';
  throws(() => AnchorGate.buildAnchoredWitness(unlistedKey), /not enabled by the exact anchor policy/, 'unlisted anchor key is refused');

  const duplicateSteward = copy(anchoredInput);
  duplicateSteward.anchorPolicy.keys[1].stewardDigest = duplicateSteward.anchorPolicy.keys[0].stewardDigest;
  duplicateSteward.anchorPolicy.anchorDigest = AnchorGate.anchorPolicyDigest(duplicateSteward.anchorPolicy);
  duplicateSteward.expectedAnchorDigest = duplicateSteward.anchorPolicy.anchorDigest;
  throws(() => AnchorGate.buildAnchoredWitness(duplicateSteward), /stewardDigest must be unique/, 'duplicate anchor steward is refused');

  const duplicateKey = copy(anchoredInput);
  duplicateKey.anchorPolicy.keys[1].publicKeyPem = duplicateKey.anchorPolicy.keys[0].publicKeyPem;
  duplicateKey.anchorPolicy.anchorDigest = AnchorGate.anchorPolicyDigest(duplicateKey.anchorPolicy);
  duplicateKey.expectedAnchorDigest = duplicateKey.anchorPolicy.anchorDigest;
  throws(() => AnchorGate.buildAnchoredWitness(duplicateKey), /public key fingerprint must be unique/, 'duplicate anchor public key is refused as an independent seat');

  const privateKeyAnchor = copy(anchoredInput);
  privateKeyAnchor.anchorPolicy.keys[0].publicKeyPem = anchorPackage.pairs[0].privateKey.export({ type: 'pkcs8', format: 'pem' });
  privateKeyAnchor.anchorPolicy.anchorDigest = AnchorGate.anchorPolicyDigest(privateKeyAnchor.anchorPolicy);
  privateKeyAnchor.expectedAnchorDigest = privateKeyAnchor.anchorPolicy.anchorDigest;
  throws(() => AnchorGate.buildAnchoredWitness(privateKeyAnchor), /never private-key material/, 'private anchor key material is refused');

  const insufficient = copy(anchoredInput);
  insufficient.policyAuthorizations.pop();
  throws(() => AnchorGate.buildAnchoredWitness(insufficient), /cover the anchor threshold/, 'insufficient anchor authorization count is refused');

  const expired = copy(anchoredInput);
  expired.verifiedAt = '2026-08-20T15:01:00.000Z';
  throws(() => AnchorGate.buildAnchoredWitness(expired), /expired/, 'expired anchor policy is refused');

  const unexpectedAnchorField = copy(anchoredInput);
  unexpectedAnchorField.anchorPolicy.hostTrusted = true;
  throws(() => AnchorGate.buildAnchoredWitness(unexpectedAnchorField), /unknown fields: hostTrusted/, 'undeclared host-trust field is refused');

  const alternateAnchorPackage = buildAnchorPackage(witnessPackage, 'alternate-anchor');
  const alternateAnchored = AnchorGate.buildAnchoredWitness(alternateAnchorPackage.anchoredWitnessInput);
  check(AnchorGate.verifyAnchoredWitness(alternateAnchorPackage.anchoredWitnessInput, alternateAnchored).pass, 'replacement anchor and matching pin with new keys can produce another cryptographically valid chain');
  check(alternateAnchored.anchorRef.sha256 !== anchored.anchorRef.sha256, 'replacement anchor has a distinct exact digest');
  check(alternateAnchored.receiptDigest !== anchored.receiptDigest, 'replacement anchor produces a distinct anchored witness digest');
  equal(alternateAnchored.truth.jointAnchorAndPinSubstitutionStillPossible, true, 'valid joint-substitution counterexample remains explicit');
  equal(alternateAnchored.truth.anchorPolicyAuthorityAuthenticated, false, 'valid replacement anchor remains unauthenticated');

  const packagePath = path.join(tempRoot, 'caller-retained-anchored-witness-package.json');
  fs.writeFileSync(packagePath, AnchorGate.stableStringify({
    anchoredWitnessInput: anchoredInput,
    anchoredWitnessReceipt: anchored
  }) + '\n', { encoding: 'utf8', mode: 0o600 });
  const beforeExactChild = treeFingerprint(namespace);
  const exactChild = runChild(
    packagePath,
    stateRoot,
    ledgerId,
    'exact',
    '2026-08-20T14:10:30.000Z',
    '2026-08-20T14:11:00.000Z'
  );
  const afterExactChild = treeFingerprint(namespace);
  equal(exactChild.status, 0, 'fresh process verifies anchor chain and audits current ledger');
  equal(beforeExactChild, afterExactChild, 'fresh anchored audit performs no ledger write');
  equal(exactChild.output.audit.decision.classification, 'CURRENT_LEDGER_MATCHES_PRESENTED_CHECKPOINT', 'fresh anchored audit sees exact checkpoint match');
  equal(exactChild.output.audit.truth.anchorAuthorizationSignaturesCryptographicallyValid, true, 'fresh anchored audit retains anchor signature validity truth');
  equal(exactChild.output.audit.truth.anchorPolicyAuthorityAuthenticated, false, 'fresh anchored audit retains unauthenticated anchor boundary');
  equal(exactChild.output.audit.truth.expectedAnchorDigestAuthorityAuthenticated, false, 'fresh anchored audit retains unauthenticated pin boundary');
  equal(exactChild.output.audit.truth.jointAnchorAndPinSubstitutionStillPossible, true, 'fresh anchored audit retains joint-substitution boundary');
  equal(exactChild.output.audit.truth.executionAuthorized, false, 'fresh anchored audit grants no execution authority');
  check(AnchorGate.verifyAnchoredAudit(exactChild.output.auditInput, exactChild.output.audit).pass, 'fresh anchored audit verifies by exact rebuild');

  const extensionRequest = Fixture.buildRequest('anchor-gate-extension');
  const extensionReceipt = service.consume(extensionRequest);
  const extensionChild = runChild(
    packagePath,
    stateRoot,
    ledgerId,
    'extension',
    '2026-08-20T14:11:10.000Z',
    '2026-08-20T14:11:20.000Z'
  );
  equal(extensionChild.status, 0, 'fresh process audits forward extension from anchored checkpoint');
  equal(extensionChild.output.audit.decision.classification, 'CURRENT_LEDGER_EXTENDS_PRESENTED_CHECKPOINT', 'anchored checkpoint classifies forward extension');
  equal(extensionChild.output.audit.comparison.addedCurrentChallenges[0], extensionReceipt.challengeRef.sha256, 'anchored audit identifies exact added challenge');
  equal(extensionChild.output.audit.decision.autonomousActionCount, 0, 'anchored extension performs no autonomous action');

  const entriesPath = path.join(namespace, Ledger.ENTRIES_DIRECTORY);
  const baseEntryPath = path.join(entriesPath, baseReceipt.challengeRef.sha256.slice('sha256:'.length) + '.json');
  fs.unlinkSync(baseEntryPath);
  const rollbackChild = runChild(
    packagePath,
    stateRoot,
    ledgerId,
    'rollback',
    '2026-08-20T14:11:30.000Z',
    '2026-08-20T14:11:40.000Z'
  );
  equal(rollbackChild.status, 0, 'fresh process audits missing challenge from anchored checkpoint');
  equal(rollbackChild.output.audit.decision.classification, 'ROLLBACK_OR_REPLACEMENT_DETECTED_AGAINST_PRESENTED_CHECKPOINT', 'anchored checkpoint detects relative rollback');
  equal(rollbackChild.output.audit.comparison.missingCheckpointChallenges[0], baseReceipt.challengeRef.sha256, 'anchored rollback identifies exact missing challenge');
  equal(rollbackChild.output.audit.truth.rollbackOrReplacementDetectedAgainstAnchoredCheckpoint, true, 'anchored rollback truth is explicit');
  equal(rollbackChild.output.audit.truth.deletionOrRollbackPrevented, false, 'anchored rollback detection is not promoted to prevention');
  check(AnchorGate.verifyAnchoredWitness(anchoredInput, anchored).pass, 'original anchored witness remains valid after ledger rollback');

  const extensionEntryPath = path.join(entriesPath, extensionReceipt.challengeRef.sha256.slice('sha256:'.length) + '.json');
  fs.writeFileSync(extensionEntryPath, '{"truncated":');
  const invalidChild = runChild(
    packagePath,
    stateRoot,
    ledgerId,
    'invalid',
    '2026-08-20T14:11:50.000Z',
    '2026-08-20T14:12:00.000Z'
  );
  equal(invalidChild.output.audit.decision.classification, 'HOLD_CURRENT_LEDGER_STATE_INVALID', 'invalid current ledger is held against anchored checkpoint');
  equal(invalidChild.output.audit.truth.currentInvalidityDetected, true, 'anchored audit retains invalid-current-state truth');

  verifiedRemove(namespace, tempRoot);
  const absentChild = runChild(
    packagePath,
    stateRoot,
    ledgerId,
    'absent',
    '2026-08-20T14:12:10.000Z',
    '2026-08-20T14:12:20.000Z'
  );
  equal(absentChild.output.audit.decision.classification, 'HOLD_LEDGER_STATE_ABSENT_AGAINST_PRESENTED_CHECKPOINT', 'absent ledger is held against anchored checkpoint');
  equal(absentChild.output.audit.truth.currentAbsenceDetectedAgainstAnchoredCheckpoint, true, 'anchored audit retains absent-current-state truth');

  const otherLedgerId = 'ledger:anchor-gate-other';
  const otherService = Ledger.createService({ stateRoot: otherStateRoot, ledgerId: otherLedgerId });
  otherService.consume(Fixture.buildRequest('anchor-gate-other'));
  const identityChild = runChild(
    packagePath,
    otherStateRoot,
    otherLedgerId,
    'identity',
    '2026-08-20T14:12:30.000Z',
    '2026-08-20T14:12:40.000Z'
  );
  equal(identityChild.output.audit.decision.classification, 'HOLD_LEDGER_IDENTITY_CHANGED', 'different current ledger identity is held against anchored checkpoint');
  equal(identityChild.output.audit.truth.comparisonBoundToExactLedgerIdentity, false, 'identity-drift anchored audit refuses exact-identity claim');

  const anchoredReceiptTamper = copy(anchored);
  anchoredReceiptTamper.truth.anchorPolicyAuthorityAuthenticated = true;
  anchoredReceiptTamper.receiptDigest = AnchorGate.sha256((() => {
    const value = copy(anchoredReceiptTamper);
    delete value.receiptDigest;
    return value;
  })());
  equal(AnchorGate.verifyAnchoredWitness(anchoredInput, anchoredReceiptTamper).pass, false, 'anchored witness authority tamper fails even with recomputed digest');

  const auditTamper = copy(exactChild.output.audit);
  auditTamper.truth.hostAuthorizationAuthenticated = true;
  auditTamper.auditDigest = AnchorGate.sha256((() => {
    const value = copy(auditTamper);
    delete value.auditDigest;
    return value;
  })());
  equal(AnchorGate.verifyAnchoredAudit(exactChild.output.auditInput, auditTamper).pass, false, 'anchored audit authority tamper fails even with recomputed digest');

  const snapshotTamperInput = copy(exactChild.output.auditInput);
  snapshotTamperInput.currentSnapshot.truth.executionAuthorized = true;
  snapshotTamperInput.currentSnapshot.snapshotDigest = AnchorGate.sha256((() => {
    const value = copy(snapshotTamperInput.currentSnapshot);
    delete value.snapshotDigest;
    return value;
  })());
  throws(() => AnchorGate.buildAnchoredAudit(snapshotTamperInput), /snapshot content or digest mismatch/, 'tampered current snapshot boundary cannot drive anchored audit');

  const serializedAudit = AnchorGate.stableStringify(exactChild.output.audit);
  check(!serializedAudit.includes(tempRoot), 'anchored audit retains no machine state-root path');
  check(!serializedAudit.includes('BEGIN PUBLIC KEY'), 'anchored audit retains no raw public key');
  check(!serializedAudit.includes(anchoredInput.policyAuthorizations[0].signature), 'anchored audit retains no raw anchor signature');

  const anchorPolicySchema = JSON.parse(fs.readFileSync(path.join(__dirname, 'model-shadow-review-challenge-anchor-policy.schema.json'), 'utf8'));
  const authorizationSchema = JSON.parse(fs.readFileSync(path.join(__dirname, 'model-shadow-review-challenge-anchor-authorization.schema.json'), 'utf8'));
  const anchoredSchema = JSON.parse(fs.readFileSync(path.join(__dirname, 'model-shadow-review-challenge-anchored-witness.schema.json'), 'utf8'));
  const auditSchema = JSON.parse(fs.readFileSync(path.join(__dirname, 'model-shadow-review-challenge-anchored-continuity.schema.json'), 'utf8'));
  const contract = JSON.parse(fs.readFileSync(path.join(__dirname, 'module.contract.json'), 'utf8'));
  const implementation = fs.readFileSync(path.join(__dirname, 'model-shadow-review-challenge-anchor-gate.js'), 'utf8');
  const readme = fs.readFileSync(path.join(__dirname, 'README.md'), 'utf8');
  equal(anchorPolicySchema.$id, AnchorGate.ANCHOR_POLICY_SCHEMA, 'anchor policy schema identity matches implementation');
  equal(authorizationSchema.$id, AnchorGate.AUTHORIZATION_SCHEMA, 'anchor authorization schema identity matches implementation');
  equal(anchoredSchema.$id, AnchorGate.RECEIPT_SCHEMA, 'anchored witness schema identity matches implementation');
  equal(auditSchema.$id, AnchorGate.AUDIT_SCHEMA, 'anchored audit schema identity matches implementation');
  check(contract.status === 'TEST' && contract.permissions.length === 0 && contract.boundaries.reads.length === 0 && contract.boundaries.writes.length === 0, 'module remains permissionless read-only TEST with no direct I/O');
  check(contract.lifecycle.installed === false && contract.lifecycle.promoted === false, 'module remains uninstalled and unpromoted');
  check(contract.boundaries.refuses.includes('caller-presented-anchor-as-authenticated-host-trust-root'), 'contract refuses caller anchor as authenticated host trust');
  check(contract.boundaries.refuses.includes('caller-presented-anchor-digest-as-authenticated-pin'), 'contract refuses caller digest as authenticated pin');
  check(contract.boundaries.refuses.includes('self-declared-anchor-epoch-as-monotonic-state'), 'contract refuses self-declared epoch as monotonic state');
  check(contract.boundaries.refuses.includes('anchored-witness-as-proven-external-retention'), 'contract refuses anchored witness as external retention proof');
  check(/Replacing them\s+together/.test(readme) && /does not prove Mike or host trust/.test(readme), 'README preserves joint-substitution and host-trust boundary');
  check(!implementation.includes("require('fs')") && !implementation.includes("require('child_process')"), 'runtime implementation imports no filesystem or process capability');
  check(!implementation.includes('writeFileSync') && !implementation.includes('mkdirSync') && !implementation.includes('rmSync') && !implementation.includes('unlinkSync'), 'runtime implementation contains no filesystem write route');
  check(!implementation.includes('fetch('), 'runtime implementation contains no network route');

  console.log('\nModel Shadow review challenge anchor gate selftest: PASS (' + checks + ' checks)');
} finally {
  verifiedRemove(tempRoot, path.dirname(tempRoot));
}
