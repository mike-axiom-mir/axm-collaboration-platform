#!/usr/bin/env node
'use strict';

const assert = require('assert');
const childProcess = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Witness = require('./model-shadow-review-challenge-witness');
const Continuity = require('../model-shadow-review-challenge-continuity/model-shadow-review-challenge-continuity');
const Ledger = require('../model-shadow-review-challenge-ledger/model-shadow-review-challenge-ledger');
const Fixture = require('../model-shadow-review-challenge-ledger/selftest-fixture');

let checks = 0;
function check(value, label) { assert.ok(value, label); checks += 1; console.log('PASS ' + label); }
function equal(actual, expected, label) { assert.strictEqual(actual, expected); checks += 1; console.log('PASS ' + label); }
function throws(fn, pattern, label) { assert.throws(fn, pattern); checks += 1; console.log('PASS ' + label); }
function copy(value) { return JSON.parse(JSON.stringify(value)); }

const childPath = path.join(__dirname, 'selftest-child.js');

function signAttestation(attestation, privateKey) {
  const value = copy(attestation);
  value.signature = crypto.sign(
    null,
    Buffer.from(Witness.stableStringify(Witness.attestationSigningPayload(value)), 'utf8'),
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
    policyId: 'policy:checkpoint-witness-' + suffix,
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
      keyId: 'fixture-witness-key-' + suffix + '-' + (index + 1),
      algorithm: 'Ed25519',
      publicKeyPem: pair.publicKey.export({ type: 'spki', format: 'pem' }),
      actorDigest: Witness.sha256('fixture-witness-actor:' + suffix + ':' + index),
      actorKind: actorKinds[index],
      scope: Witness.SCOPE,
      enabled: true
    })),
    policyDigest: null
  };
  policy.policyDigest = Witness.policyDigest(policy);
  const attestations = policy.keys.map((key, index) => signAttestation({
    schema: Witness.ATTESTATION_SCHEMA,
    attestationId: 'attestation:checkpoint-witness-' + suffix + '-' + (index + 1),
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
  }, pairs[index].privateKey));
  const witnessInput = {
    witnessId: 'witness:checkpoint-' + suffix,
    verifiedAt: '2026-08-20T14:09:00.000Z',
    checkpoint: copy(checkpoint),
    keyPolicy: policy,
    signedAttestations: attestations
  };
  return { witnessInput, pairs };
}

function runChild(packagePath, stateRoot, ledgerId, tag, observedAt, checkedAt) {
  const result = childProcess.spawnSync(process.execPath, [
    childPath,
    packagePath,
    stateRoot,
    ledgerId,
    'observation:witness-child-' + tag,
    observedAt,
    'audit:witness-child-' + tag,
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

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'axm-challenge-witness-'));
try {
  const stateRoot = path.join(tempRoot, 'state-a');
  const otherStateRoot = path.join(tempRoot, 'state-b');
  fs.mkdirSync(stateRoot);
  fs.mkdirSync(otherStateRoot);
  const ledgerId = 'ledger:witness-selftest';
  const service = Ledger.createService({ stateRoot, ledgerId });
  const baseRequest = Fixture.buildRequest('witness-base');
  const baseReceipt = service.consume(baseRequest);
  const namespace = path.join(stateRoot, Ledger.NAMESPACE);
  const baseSnapshot = Continuity.captureState({
    stateRoot,
    ledgerId,
    observationId: 'observation:witness-base',
    observedAt: '2026-08-20T14:07:00.000Z'
  });
  const checkpoint = Continuity.buildCheckpoint({
    checkpointId: 'checkpoint:witness-base',
    anchoredAt: '2026-08-20T14:07:30.000Z',
    currentSnapshot: baseSnapshot
  });
  const packageFixture = buildWitnessPackage(checkpoint, 'base');
  const witnessInput = packageFixture.witnessInput;
  const witness = Witness.buildWitness(witnessInput);

  equal(Witness.VERSION, '0.4.0', 'module version is exact');
  equal(Witness.STATUS, 'TEST', 'module status is TEST');
  equal(witness.schema, Witness.WITNESS_SCHEMA, 'witness schema identity is exact');
  equal(witness.checkpointRef.sha256, checkpoint.checkpointDigest, 'witness binds exact checkpoint digest');
  equal(witness.ledgerRef.sha256, checkpoint.ledgerRef.sha256, 'witness binds exact ledger manifest digest');
  equal(witness.entriesDigest, checkpoint.entriesDigest, 'witness binds exact checkpoint entries digest');
  equal(witness.keyPolicyRef.sha256, witnessInput.keyPolicy.policyDigest, 'witness binds exact caller policy digest');
  equal(witness.signatureEvidence.requiredSignatures, 2, 'witness retains exact signature threshold');
  equal(witness.signatureEvidence.verifiedSignatures, 2, 'witness verifies two detached signatures');
  equal(witness.signatureEvidence.policyAuthorityOrigin, Witness.AUTHORITY_ORIGIN, 'witness admits caller policy origin');
  equal(new Set(witness.signatureEvidence.attestations.map(item => item.keyFingerprint)).size, 2, 'witness retains two distinct key fingerprints');
  equal(new Set(witness.signatureEvidence.attestations.map(item => item.actorDigest)).size, 2, 'witness retains two distinct actor digests');
  equal(witness.truth.checkpointVerifiedByExactRebuild, true, 'checkpoint is verified by exact rebuild');
  equal(witness.truth.detachedSignaturesCryptographicallyValid, true, 'detached signature validity truth is explicit');
  equal(witness.truth.signingKeyPossessionVerified, true, 'signing-key possession evidence is explicit');
  equal(witness.truth.keysAllowedByExactCallerPolicy, true, 'signing keys are admitted by the exact caller policy');
  equal(witness.truth.policyAuthorityAuthenticated, false, 'caller policy is not promoted to authenticated authority');
  equal(witness.truth.signerRealWorldIdentityProven, false, 'key possession is not promoted to real-world identity');
  equal(witness.truth.declaredHumanSignerIsAuthenticatedHuman, false, 'declared human key is not promoted to authenticated human');
  equal(witness.truth.actualHumanParticipationProven, false, 'signature evidence is not promoted to actual human participation');
  equal(witness.truth.witnessVerificationTimeExternallyTrusted, false, 'caller verification time remains untrusted');
  equal(witness.truth.checkpointExternalRetentionProven, false, 'witness does not claim external retention');
  equal(witness.truth.checkpointDeletionOrRollbackPrevented, false, 'witness does not claim checkpoint rollback prevention');
  equal(witness.truth.hostAuthorizationAuthenticated, false, 'library witness does not claim host authorization');
  equal(witness.truth.executionAuthorized, false, 'witness grants no execution authority');
  equal(witness.truth.automaticCanon, false, 'witness grants no CANON authority');
  check(Witness.verifyWitness(witnessInput, witness).pass, 'witness verifies by exact rebuild');
  equal(
    Witness.stableStringify(Witness.buildWitness(copy(witnessInput))),
    Witness.stableStringify(witness),
    'witness rebuild is deterministic from copied input'
  );

  const serializedWitness = Witness.stableStringify(witness);
  check(!serializedWitness.includes('BEGIN PUBLIC KEY'), 'witness receipt retains no raw public key');
  check(!serializedWitness.includes(witnessInput.signedAttestations[0].signature), 'witness receipt retains no raw signature');
  check(!serializedWitness.includes('fixture-witness-key-base-1'), 'witness receipt retains no raw key id');
  check(!serializedWitness.includes('attestation:checkpoint-witness-base-1'), 'witness receipt retains no raw attestation id');

  const selfDigestTamper = copy(checkpoint);
  selfDigestTamper.entries[0].consumedAt = '2026-08-20T14:06:31.000Z';
  selfDigestTamper.entriesDigest = Witness.sha256(selfDigestTamper.entries);
  selfDigestTamper.checkpointDigest = Witness.sha256((() => {
    const value = copy(selfDigestTamper);
    delete value.checkpointDigest;
    return value;
  })());
  check(Continuity.verifyCheckpoint(selfDigestTamper).pass, 'recomputed self-digest alone can make a modified checkpoint structurally valid');
  const reusedWitnessInput = copy(witnessInput);
  reusedWitnessInput.checkpoint = selfDigestTamper;
  throws(
    () => Witness.buildWitness(reusedWitnessInput),
    /checkpoint reference mismatch/,
    'modified self-digested checkpoint cannot reuse the original witness policy'
  );

  const reboundPolicyInput = copy(reusedWitnessInput);
  reboundPolicyInput.keyPolicy.checkpointRef.sha256 = selfDigestTamper.checkpointDigest;
  reboundPolicyInput.keyPolicy.entriesDigest = selfDigestTamper.entriesDigest;
  reboundPolicyInput.keyPolicy.policyDigest = Witness.policyDigest(reboundPolicyInput.keyPolicy);
  throws(
    () => Witness.buildWitness(reboundPolicyInput),
    /policy digest mismatch|checkpoint digest mismatch|entries digest mismatch/,
    'recomputed checkpoint and policy cannot reuse the original detached signatures'
  );

  const badSignature = copy(witnessInput);
  badSignature.signedAttestations[0].signature = badSignature.signedAttestations[1].signature;
  throws(() => Witness.buildWitness(badSignature), /signature verification failed/, 'signature from another key is refused');

  const unlistedKey = copy(witnessInput);
  unlistedKey.signedAttestations[0].keyId = 'fixture-unlisted-key';
  throws(() => Witness.buildWitness(unlistedKey), /not enabled by the exact policy/, 'unlisted witness key is refused');

  const duplicateActor = copy(witnessInput);
  duplicateActor.keyPolicy.keys[1].actorDigest = duplicateActor.keyPolicy.keys[0].actorDigest;
  duplicateActor.keyPolicy.policyDigest = Witness.policyDigest(duplicateActor.keyPolicy);
  throws(() => Witness.buildWitness(duplicateActor), /actorDigest must be unique/, 'duplicate policy actor is refused');

  const duplicateKey = copy(witnessInput);
  duplicateKey.keyPolicy.keys[1].publicKeyPem = duplicateKey.keyPolicy.keys[0].publicKeyPem;
  duplicateKey.keyPolicy.policyDigest = Witness.policyDigest(duplicateKey.keyPolicy);
  throws(() => Witness.buildWitness(duplicateKey), /public key fingerprint must be unique/, 'duplicate public key is refused as an independent seat');

  const privateKeyPolicy = copy(witnessInput);
  privateKeyPolicy.keyPolicy.keys[0].publicKeyPem = packageFixture.pairs[0].privateKey.export({ type: 'pkcs8', format: 'pem' });
  privateKeyPolicy.keyPolicy.policyDigest = Witness.policyDigest(privateKeyPolicy.keyPolicy);
  throws(() => Witness.buildWitness(privateKeyPolicy), /never private-key material/, 'private key material is refused');

  const insufficient = copy(witnessInput);
  insufficient.signedAttestations.pop();
  throws(() => Witness.buildWitness(insufficient), /cover the policy threshold/, 'insufficient signature count is refused');

  const expired = copy(witnessInput);
  expired.verifiedAt = '2026-08-20T14:21:00.000Z';
  throws(() => Witness.buildWitness(expired), /expired/, 'expired witness policy is refused');

  const unexpectedPolicyField = copy(witnessInput);
  unexpectedPolicyField.keyPolicy.hostTrusted = true;
  throws(() => Witness.buildWitness(unexpectedPolicyField), /unknown fields: hostTrusted/, 'undeclared host-trust field is refused');

  const alternateFixture = buildWitnessPackage(checkpoint, 'alternate-policy');
  const alternateWitness = Witness.buildWitness(alternateFixture.witnessInput);
  check(Witness.verifyWitness(alternateFixture.witnessInput, alternateWitness).pass, 'replacement caller policy with its own keys can produce another cryptographically valid witness');
  check(alternateWitness.keyPolicyRef.sha256 !== witness.keyPolicyRef.sha256, 'replacement caller policy has a distinct exact digest');
  check(alternateWitness.witnessDigest !== witness.witnessDigest, 'replacement caller policy produces a distinct witness digest');
  equal(alternateWitness.truth.policyAuthorityAuthenticated, false, 'valid replacement policy counterexample remains unauthenticated');

  const packagePath = path.join(tempRoot, 'caller-retained-witness-package.json');
  fs.writeFileSync(packagePath, Witness.stableStringify({ witnessInput, witnessReceipt: witness }) + '\n', { encoding: 'utf8', mode: 0o600 });
  const beforeExactChild = treeFingerprint(namespace);
  const exactChild = runChild(
    packagePath,
    stateRoot,
    ledgerId,
    'exact',
    '2026-08-20T14:09:30.000Z',
    '2026-08-20T14:10:00.000Z'
  );
  const afterExactChild = treeFingerprint(namespace);
  equal(exactChild.status, 0, 'fresh process verifies witness and audits current ledger');
  equal(beforeExactChild, afterExactChild, 'fresh witnessed audit performs no ledger write');
  equal(exactChild.output.audit.decision.classification, 'CURRENT_LEDGER_MATCHES_PRESENTED_CHECKPOINT', 'fresh witnessed audit sees exact checkpoint match');
  equal(exactChild.output.audit.truth.checkpointDetachedSignaturesCryptographicallyValid, true, 'fresh witnessed audit retains signature validity truth');
  equal(exactChild.output.audit.truth.checkpointPolicyAuthorityAuthenticated, false, 'fresh witnessed audit retains unauthenticated policy boundary');
  equal(exactChild.output.audit.truth.checkpointExternalRetentionProven, false, 'fresh witnessed audit does not infer external retention');
  equal(exactChild.output.audit.truth.executionAuthorized, false, 'fresh witnessed audit grants no execution authority');
  check(Witness.verifyWitnessedAudit(exactChild.output.auditInput, exactChild.output.audit).pass, 'fresh witnessed audit verifies by exact rebuild');

  const extensionRequest = Fixture.buildRequest('witness-extension');
  const extensionReceipt = service.consume(extensionRequest);
  const extensionChild = runChild(
    packagePath,
    stateRoot,
    ledgerId,
    'extension',
    '2026-08-20T14:10:10.000Z',
    '2026-08-20T14:10:20.000Z'
  );
  equal(extensionChild.status, 0, 'fresh process audits forward ledger extension from witnessed checkpoint');
  equal(extensionChild.output.audit.decision.classification, 'CURRENT_LEDGER_EXTENDS_PRESENTED_CHECKPOINT', 'witnessed checkpoint classifies forward extension');
  equal(extensionChild.output.audit.comparison.addedCurrentChallenges[0], extensionReceipt.challengeRef.sha256, 'witnessed audit identifies exact added challenge');
  equal(extensionChild.output.audit.decision.autonomousActionCount, 0, 'witnessed extension performs no autonomous action');

  const entriesPath = path.join(namespace, Ledger.ENTRIES_DIRECTORY);
  const baseEntryPath = path.join(entriesPath, baseReceipt.challengeRef.sha256.slice('sha256:'.length) + '.json');
  fs.unlinkSync(baseEntryPath);
  const rollbackChild = runChild(
    packagePath,
    stateRoot,
    ledgerId,
    'rollback',
    '2026-08-20T14:10:30.000Z',
    '2026-08-20T14:10:40.000Z'
  );
  equal(rollbackChild.status, 0, 'fresh process audits missing challenge from witnessed checkpoint');
  equal(rollbackChild.output.audit.decision.classification, 'ROLLBACK_OR_REPLACEMENT_DETECTED_AGAINST_PRESENTED_CHECKPOINT', 'witnessed checkpoint detects relative rollback');
  equal(rollbackChild.output.audit.comparison.missingCheckpointChallenges[0], baseReceipt.challengeRef.sha256, 'witnessed rollback identifies exact missing challenge');
  equal(rollbackChild.output.audit.truth.rollbackOrReplacementDetectedAgainstWitnessedCheckpoint, true, 'witnessed rollback truth is explicit');
  equal(rollbackChild.output.audit.truth.ledgerDeletionOrRollbackPrevented, false, 'rollback detection is not promoted to prevention');
  check(Witness.verifyWitness(witnessInput, witness).pass, 'original checkpoint witness remains cryptographically valid after ledger rollback');

  const extensionEntryPath = path.join(entriesPath, extensionReceipt.challengeRef.sha256.slice('sha256:'.length) + '.json');
  fs.writeFileSync(extensionEntryPath, '{"truncated":');
  const invalidChild = runChild(
    packagePath,
    stateRoot,
    ledgerId,
    'invalid',
    '2026-08-20T14:10:50.000Z',
    '2026-08-20T14:11:00.000Z'
  );
  equal(invalidChild.output.audit.decision.classification, 'HOLD_CURRENT_LEDGER_STATE_INVALID', 'invalid current ledger is held against witnessed checkpoint');
  equal(invalidChild.output.audit.truth.currentInvalidityDetected, true, 'witnessed audit retains invalid-current-state truth');

  verifiedRemove(namespace, tempRoot);
  const absentChild = runChild(
    packagePath,
    stateRoot,
    ledgerId,
    'absent',
    '2026-08-20T14:11:10.000Z',
    '2026-08-20T14:11:20.000Z'
  );
  equal(absentChild.output.audit.decision.classification, 'HOLD_LEDGER_STATE_ABSENT_AGAINST_PRESENTED_CHECKPOINT', 'absent ledger is held against witnessed checkpoint');
  equal(absentChild.output.audit.truth.currentAbsenceDetectedAgainstWitnessedCheckpoint, true, 'witnessed audit retains absent-current-state truth');

  const otherLedgerId = 'ledger:witness-other';
  const otherService = Ledger.createService({ stateRoot: otherStateRoot, ledgerId: otherLedgerId });
  otherService.consume(Fixture.buildRequest('witness-other'));
  const identityChild = runChild(
    packagePath,
    otherStateRoot,
    otherLedgerId,
    'identity',
    '2026-08-20T14:11:30.000Z',
    '2026-08-20T14:11:40.000Z'
  );
  equal(identityChild.output.audit.decision.classification, 'HOLD_LEDGER_IDENTITY_CHANGED', 'different current ledger identity is held against witnessed checkpoint');
  equal(identityChild.output.audit.truth.comparisonBoundToExactLedgerIdentity, false, 'identity-drift audit refuses exact-identity claim');

  const witnessReceiptTamper = copy(witness);
  witnessReceiptTamper.truth.policyAuthorityAuthenticated = true;
  witnessReceiptTamper.witnessDigest = Witness.sha256((() => {
    const value = copy(witnessReceiptTamper);
    delete value.witnessDigest;
    return value;
  })());
  equal(Witness.verifyWitness(witnessInput, witnessReceiptTamper).pass, false, 'witness authority tamper fails even with recomputed digest');

  const auditTamper = copy(exactChild.output.audit);
  auditTamper.truth.hostAuthorizationAuthenticated = true;
  auditTamper.auditDigest = Witness.sha256((() => {
    const value = copy(auditTamper);
    delete value.auditDigest;
    return value;
  })());
  equal(Witness.verifyWitnessedAudit(exactChild.output.auditInput, auditTamper).pass, false, 'witnessed audit authority tamper fails even with recomputed digest');

  const snapshotTamperInput = copy(exactChild.output.auditInput);
  snapshotTamperInput.currentSnapshot.truth.executionAuthorized = true;
  snapshotTamperInput.currentSnapshot.snapshotDigest = Witness.sha256((() => {
    const value = copy(snapshotTamperInput.currentSnapshot);
    delete value.snapshotDigest;
    return value;
  })());
  throws(() => Witness.buildWitnessedAudit(snapshotTamperInput), /snapshot content or digest mismatch/, 'tampered current snapshot boundary cannot drive witnessed audit');

  const serializedAudit = Witness.stableStringify(exactChild.output.audit);
  check(!serializedAudit.includes(tempRoot), 'witnessed audit retains no machine state-root path');
  check(!serializedAudit.includes('BEGIN PUBLIC KEY'), 'witnessed audit retains no raw public key');
  check(!serializedAudit.includes(witnessInput.signedAttestations[0].signature), 'witnessed audit retains no raw signature');

  const policySchema = JSON.parse(fs.readFileSync(path.join(__dirname, 'model-shadow-review-challenge-witness-policy.schema.json'), 'utf8'));
  const attestationSchema = JSON.parse(fs.readFileSync(path.join(__dirname, 'model-shadow-review-challenge-witness-attestation.schema.json'), 'utf8'));
  const witnessSchema = JSON.parse(fs.readFileSync(path.join(__dirname, 'model-shadow-review-challenge-witness.schema.json'), 'utf8'));
  const auditSchema = JSON.parse(fs.readFileSync(path.join(__dirname, 'model-shadow-review-challenge-witnessed-continuity.schema.json'), 'utf8'));
  const contract = JSON.parse(fs.readFileSync(path.join(__dirname, 'module.contract.json'), 'utf8'));
  const implementation = fs.readFileSync(path.join(__dirname, 'model-shadow-review-challenge-witness.js'), 'utf8');
  const readme = fs.readFileSync(path.join(__dirname, 'README.md'), 'utf8');
  equal(policySchema.$id, Witness.POLICY_SCHEMA, 'policy schema identity matches implementation');
  equal(attestationSchema.$id, Witness.ATTESTATION_SCHEMA, 'attestation schema identity matches implementation');
  equal(witnessSchema.$id, Witness.WITNESS_SCHEMA, 'witness schema identity matches implementation');
  equal(auditSchema.$id, Witness.AUDIT_SCHEMA, 'witnessed audit schema identity matches implementation');
  check(contract.status === 'TEST' && contract.permissions.length === 0 && contract.boundaries.writes.length === 0, 'module remains read-only TEST with no claimed host permission integration');
  check(contract.lifecycle.installed === false && contract.lifecycle.promoted === false, 'module remains uninstalled and unpromoted');
  check(contract.boundaries.refuses.includes('caller-witness-policy-as-authenticated-host-trust-root'), 'contract refuses caller policy as authenticated host trust');
  check(contract.boundaries.refuses.includes('signed-checkpoint-as-proven-external-retention'), 'contract refuses signature as external retention proof');
  check(contract.boundaries.refuses.includes('signed-checkpoint-as-deletion-or-rollback-prevention'), 'contract refuses signature as rollback prevention');
  check(/replacement\s+policy/.test(readme) && /does not\s+authenticate a host trust root/.test(readme), 'README preserves the policy-swap counterexample and host boundary');
  check(!implementation.includes("require('fs')") && !implementation.includes("require('child_process')"), 'runtime implementation imports no filesystem or process capability');
  check(!implementation.includes('writeFileSync') && !implementation.includes('mkdirSync') && !implementation.includes('rmSync') && !implementation.includes('unlinkSync'), 'runtime implementation contains no filesystem write route');
  check(!implementation.includes('fetch('), 'runtime implementation contains no network route');

  console.log('\nModel Shadow review challenge checkpoint witness selftest: PASS (' + checks + ' checks)');
} finally {
  verifiedRemove(tempRoot, path.dirname(tempRoot));
}
