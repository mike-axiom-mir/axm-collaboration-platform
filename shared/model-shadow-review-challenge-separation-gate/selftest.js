#!/usr/bin/env node
'use strict';

const assert = require('assert');
const childProcess = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const SeparationGate = require('./model-shadow-review-challenge-separation-gate');
const AnchorGate = require('../model-shadow-review-challenge-anchor-gate/model-shadow-review-challenge-anchor-gate');
const Continuity = require('../model-shadow-review-challenge-continuity/model-shadow-review-challenge-continuity');
const Ledger = require('../model-shadow-review-challenge-ledger/model-shadow-review-challenge-ledger');
const LedgerFixture = require('../model-shadow-review-challenge-ledger/selftest-fixture');
const ChainFixture = require('./selftest-fixture');

let checks = 0;
function check(value, label) { assert.ok(value, label); checks += 1; console.log('PASS ' + label); }
function equal(actual, expected, label) { assert.strictEqual(actual, expected); checks += 1; console.log('PASS ' + label); }
function throws(fn, pattern, label) { assert.throws(fn, pattern); checks += 1; console.log('PASS ' + label); }
function copy(value) { return JSON.parse(JSON.stringify(value)); }

const childPath = path.join(__dirname, 'selftest-child.js');

function runChild(packagePath, stateRoot, ledgerId, tag, observedAt, checkedAt) {
  const result = childProcess.spawnSync(process.execPath, [
    childPath,
    packagePath,
    stateRoot,
    ledgerId,
    'observation:separation-gate-child-' + tag,
    observedAt,
    'audit:separation-gate-child-' + tag,
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

function separationInputFor(anchorPackage, suffix) {
  return {
    receiptId: 'receipt:separated-witness-' + suffix,
    verifiedAt: '2026-08-20T14:10:30.000Z',
    anchoredWitnessInput: copy(anchorPackage.anchoredWitnessInput),
    anchoredWitnessReceipt: copy(anchorPackage.anchoredWitnessReceipt)
  };
}

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'axm-challenge-separation-gate-'));
try {
  const stateRoot = path.join(tempRoot, 'state-a');
  const otherStateRoot = path.join(tempRoot, 'state-b');
  fs.mkdirSync(stateRoot);
  fs.mkdirSync(otherStateRoot);
  const ledgerId = 'ledger:separation-gate-selftest';
  const service = Ledger.createService({ stateRoot, ledgerId });
  const baseRequest = LedgerFixture.buildRequest('separation-gate-base');
  const baseReceipt = service.consume(baseRequest);
  const namespace = path.join(stateRoot, Ledger.NAMESPACE);
  const baseSnapshot = Continuity.captureState({
    stateRoot,
    ledgerId,
    observationId: 'observation:separation-gate-base',
    observedAt: '2026-08-20T14:07:00.000Z'
  });
  const checkpoint = Continuity.buildCheckpoint({
    checkpointId: 'checkpoint:separation-gate-base',
    anchoredAt: '2026-08-20T14:07:30.000Z',
    currentSnapshot: baseSnapshot
  });
  const chain = ChainFixture.buildAnchoredChain(checkpoint, 'base');
  const separationInput = separationInputFor(chain.anchorPackage, 'base');
  const separated = SeparationGate.buildSeparatedWitness(separationInput);

  equal(SeparationGate.VERSION, '0.6.0', 'module version is exact');
  equal(SeparationGate.STATUS, 'TEST', 'module status is TEST');
  equal(separated.schema, SeparationGate.RECEIPT_SCHEMA, 'separated witness schema identity is exact');
  equal(separated.anchoredWitnessRef.sha256, chain.anchorPackage.anchoredWitnessReceipt.receiptDigest, 'receipt binds exact v0.5 anchored witness');
  equal(separated.anchorRef.sha256, chain.anchorPackage.anchoredWitnessReceipt.anchorRef.sha256, 'receipt retains exact anchor reference');
  equal(separated.witnessRef.sha256, chain.witnessPackage.witnessReceipt.witnessDigest, 'receipt retains exact v0.4 witness reference');
  equal(separated.checkpointRef.sha256, checkpoint.checkpointDigest, 'receipt retains exact checkpoint reference');
  equal(separated.ledgerRef.sha256, checkpoint.ledgerRef.sha256, 'receipt retains exact ledger manifest reference');
  equal(separated.entriesDigest, checkpoint.entriesDigest, 'receipt retains exact checkpoint entries digest');
  equal(separated.separationEvidence.separationScope, SeparationGate.SEPARATION_SCOPE, 'separation scope is exact');
  equal(separated.separationEvidence.witnessVerifiedSeats, 2, 'receipt counts two verified witness seats');
  equal(separated.separationEvidence.anchorVerifiedSeats, 2, 'receipt counts two verified anchor seats');
  equal(separated.separationEvidence.combinedVerifiedSeats, 4, 'receipt counts four verified seats across layers');
  equal(separated.separationEvidence.sharedKeyFingerprintCount, 0, 'receipt records zero shared key fingerprints');
  equal(separated.separationEvidence.sharedDeclaredPrincipalDigestCount, 0, 'receipt records zero shared declared principal digests');
  check(/^sha256:[a-f0-9]{64}$/.test(separated.separationEvidence.witnessKeyFingerprintSetDigest), 'witness key set is retained only as a digest');
  check(/^sha256:[a-f0-9]{64}$/.test(separated.separationEvidence.anchorDeclaredPrincipalSetDigest), 'anchor principal set is retained only as a digest');
  equal(separated.truth.anchoredWitnessVerifiedByExactRebuild, true, 'v0.5 anchored witness is verified by exact rebuild');
  equal(separated.truth.noSharedPublicKeyFingerprintObserved, true, 'observable key non-overlap truth is explicit');
  equal(separated.truth.noSharedDeclaredPrincipalDigestObserved, true, 'observable declared-principal non-overlap truth is explicit');
  equal(separated.truth.observableCrossLayerSeparationVerified, true, 'bounded cross-layer separation truth is explicit');
  equal(separated.truth.keyCustodyIndependenceProven, false, 'distinct fingerprints are not promoted to independent custody');
  equal(separated.truth.realWorldControllerIndependenceProven, false, 'observable separation is not promoted to controller independence');
  equal(separated.truth.declaredPrincipalDigestsAuthenticated, false, 'declared principal digests are not promoted to authenticated identities');
  equal(separated.truth.sameControllerWithDistinctKeysStillPossible, true, 'same-controller distinct-key counterboundary is explicit');
  equal(separated.truth.sameControllerWithDistinctPrincipalDigestsStillPossible, true, 'same-controller distinct-declaration counterboundary is explicit');
  equal(separated.truth.crossLayerCollusionExcluded, false, 'observable separation does not claim to exclude collusion');
  equal(separated.truth.anchorPolicyAuthorityAuthenticated, false, 'separation does not promote anchor policy authority');
  equal(separated.truth.expectedAnchorDigestAuthorityAuthenticated, false, 'separation does not promote caller pin authority');
  equal(separated.truth.actualHumanParticipationProven, false, 'separation does not claim actual human participation');
  equal(separated.truth.separationReceiptExternallyRetained, false, 'separation does not claim external retention');
  equal(separated.truth.deletionOrRollbackPrevented, false, 'separation does not claim rollback prevention');
  equal(separated.truth.hostAuthorizationAuthenticated, false, 'library call does not claim host authorization');
  equal(separated.truth.executionAuthorized, false, 'separation receipt grants no execution authority');
  equal(separated.truth.automaticCanon, false, 'separation receipt grants no CANON authority');
  check(SeparationGate.verifySeparatedWitness(separationInput, separated).pass, 'separated witness verifies by exact rebuild');
  equal(
    SeparationGate.stableStringify(SeparationGate.buildSeparatedWitness(copy(separationInput))),
    SeparationGate.stableStringify(separated),
    'separated witness rebuild is deterministic from copied input'
  );

  const witnessFingerprints = chain.witnessPackage.witnessReceipt.signatureEvidence.attestations.map(item => item.keyFingerprint);
  const anchorFingerprints = chain.anchorPackage.anchoredWitnessReceipt.authorizationEvidence.authorizations.map(item => item.keyFingerprint);
  check(witnessFingerprints.every(value => !anchorFingerprints.includes(value)), 'baseline fixture has no cross-layer key fingerprint overlap');
  const witnessPrincipals = chain.witnessPackage.witnessReceipt.signatureEvidence.attestations.map(item => item.actorDigest);
  const anchorPrincipals = chain.anchorPackage.anchoredWitnessReceipt.authorizationEvidence.authorizations.map(item => item.stewardDigest);
  check(witnessPrincipals.every(value => !anchorPrincipals.includes(value)), 'baseline fixture has no cross-layer declared-principal overlap');

  const sharedKeyAnchor = ChainFixture.buildAnchorPackage(chain.witnessPackage, 'shared-key', {
    pairs: [chain.witnessPackage.pairs[0], crypto.generateKeyPairSync('ed25519')]
  });
  check(AnchorGate.verifyAnchoredWitness(sharedKeyAnchor.anchoredWitnessInput, sharedKeyAnchor.anchoredWitnessReceipt).pass, 'v0.5 accepts a cryptographically valid chain with one cross-layer key reused');
  throws(
    () => SeparationGate.buildSeparatedWitness(separationInputFor(sharedKeyAnchor, 'shared-key')),
    /must not share an observed public key fingerprint/,
    'v0.6 refuses an exact public key fingerprint shared across layers'
  );

  const sharedPrincipalAnchor = ChainFixture.buildAnchorPackage(chain.witnessPackage, 'shared-principal', {
    stewardDigests: [
      chain.witnessPackage.witnessInput.keyPolicy.keys[0].actorDigest,
      AnchorGate.sha256('fixture-separation-anchor-steward:shared-principal:1')
    ]
  });
  check(AnchorGate.verifyAnchoredWitness(sharedPrincipalAnchor.anchoredWitnessInput, sharedPrincipalAnchor.anchoredWitnessReceipt).pass, 'v0.5 accepts a cryptographically valid chain with one declared principal reused');
  throws(
    () => SeparationGate.buildSeparatedWitness(separationInputFor(sharedPrincipalAnchor, 'shared-principal')),
    /must not share a declared principal digest/,
    'v0.6 refuses an exact declared principal digest shared across layers'
  );

  const oneSyntheticControllerChain = ChainFixture.buildAnchoredChain(checkpoint, 'one-synthetic-controller');
  const oneControllerInput = separationInputFor(oneSyntheticControllerChain.anchorPackage, 'one-synthetic-controller');
  const oneControllerSeparated = SeparationGate.buildSeparatedWitness(oneControllerInput);
  check(SeparationGate.verifySeparatedWitness(oneControllerInput, oneControllerSeparated).pass, 'one synthetic process controlling all distinct fixture keys still passes observable separation');
  equal(oneControllerSeparated.truth.realWorldControllerIndependenceProven, false, 'distinct fixture keys do not prove different real-world controllers');
  equal(oneControllerSeparated.truth.sameControllerWithDistinctKeysStillPossible, true, 'valid same-controller distinct-key counterexample remains explicit');

  const earlierVerification = copy(separationInput);
  earlierVerification.verifiedAt = '2026-08-20T14:09:59.000Z';
  throws(() => SeparationGate.buildSeparatedWitness(earlierVerification), /cannot predate anchored witness/, 'separation cannot predate anchored witness verification');

  const unknownInputField = copy(separationInput);
  unknownInputField.controllerIndependent = true;
  throws(() => SeparationGate.buildSeparatedWitness(unknownInputField), /unknown fields: controllerIndependent/, 'undeclared controller-independence input is refused');

  const invalidAnchoredReceiptInput = copy(separationInput);
  invalidAnchoredReceiptInput.anchoredWitnessReceipt.truth.anchorPolicyAuthorityAuthenticated = true;
  throws(() => SeparationGate.buildSeparatedWitness(invalidAnchoredReceiptInput), /anchored witness is invalid/, 'tampered anchored witness cannot drive separation');

  const separatedTamper = copy(separated);
  separatedTamper.truth.realWorldControllerIndependenceProven = true;
  separatedTamper.receiptDigest = SeparationGate.sha256((() => {
    const value = copy(separatedTamper);
    delete value.receiptDigest;
    return value;
  })());
  equal(SeparationGate.verifySeparatedWitness(separationInput, separatedTamper).pass, false, 'controller-independence tamper fails even with recomputed receipt digest');

  const serializedSeparated = SeparationGate.stableStringify(separated);
  check(!serializedSeparated.includes('BEGIN PUBLIC KEY'), 'separation receipt retains no raw public key');
  check(!serializedSeparated.includes(chain.anchorPackage.anchoredWitnessInput.policyAuthorizations[0].signature), 'separation receipt retains no raw signature');
  check(!serializedSeparated.includes(chain.witnessPackage.witnessInput.keyPolicy.keys[0].keyId), 'separation receipt retains no raw witness key id');
  check(!serializedSeparated.includes(chain.anchorPackage.anchoredWitnessInput.anchorPolicy.keys[0].anchorKeyId), 'separation receipt retains no raw anchor key id');
  check(!serializedSeparated.includes(witnessPrincipals[0]), 'separation receipt retains no individual witness principal digest');
  check(!serializedSeparated.includes(anchorPrincipals[0]), 'separation receipt retains no individual anchor principal digest');
  check(!serializedSeparated.includes(tempRoot), 'separation receipt retains no machine state-root path');

  const packagePath = path.join(tempRoot, 'caller-retained-separated-witness-package.json');
  fs.writeFileSync(packagePath, SeparationGate.stableStringify({
    separationInput,
    separationReceipt: separated
  }) + '\n', { encoding: 'utf8', mode: 0o600 });
  const beforeExactChild = treeFingerprint(namespace);
  const exactChild = runChild(
    packagePath,
    stateRoot,
    ledgerId,
    'exact',
    '2026-08-20T14:10:40.000Z',
    '2026-08-20T14:11:00.000Z'
  );
  const afterExactChild = treeFingerprint(namespace);
  equal(exactChild.status, 0, 'fresh process verifies separated chain and audits current ledger');
  equal(beforeExactChild, afterExactChild, 'fresh separated audit performs no ledger write');
  equal(exactChild.output.audit.decision.classification, 'CURRENT_LEDGER_MATCHES_PRESENTED_CHECKPOINT', 'fresh separated audit sees exact checkpoint match');
  equal(exactChild.output.audit.truth.observableCrossLayerSeparationVerified, true, 'fresh audit retains observable separation truth');
  equal(exactChild.output.audit.truth.realWorldControllerIndependenceProven, false, 'fresh audit retains controller-independence boundary');
  equal(exactChild.output.audit.truth.sameControllerWithDistinctKeysStillPossible, true, 'fresh audit retains same-controller counterboundary');
  equal(exactChild.output.audit.truth.crossLayerCollusionExcluded, false, 'fresh audit retains collusion boundary');
  equal(exactChild.output.audit.truth.executionAuthorized, false, 'fresh separated audit grants no execution authority');
  check(SeparationGate.verifySeparatedAudit(exactChild.output.auditInput, exactChild.output.audit).pass, 'fresh separated audit verifies by exact rebuild');

  const extensionRequest = LedgerFixture.buildRequest('separation-gate-extension');
  const extensionReceipt = service.consume(extensionRequest);
  const extensionChild = runChild(
    packagePath,
    stateRoot,
    ledgerId,
    'extension',
    '2026-08-20T14:11:10.000Z',
    '2026-08-20T14:11:20.000Z'
  );
  equal(extensionChild.status, 0, 'fresh process audits forward extension from separated checkpoint');
  equal(extensionChild.output.audit.decision.classification, 'CURRENT_LEDGER_EXTENDS_PRESENTED_CHECKPOINT', 'separated checkpoint classifies forward extension');
  equal(extensionChild.output.audit.comparison.addedCurrentChallenges[0], extensionReceipt.challengeRef.sha256, 'separated audit identifies exact added challenge');
  equal(extensionChild.output.audit.decision.autonomousActionCount, 0, 'separated extension performs no autonomous action');

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
  equal(rollbackChild.status, 0, 'fresh process audits missing challenge from separated checkpoint');
  equal(rollbackChild.output.audit.decision.classification, 'ROLLBACK_OR_REPLACEMENT_DETECTED_AGAINST_PRESENTED_CHECKPOINT', 'separated checkpoint detects relative rollback');
  equal(rollbackChild.output.audit.comparison.missingCheckpointChallenges[0], baseReceipt.challengeRef.sha256, 'separated rollback identifies exact missing challenge');
  equal(rollbackChild.output.audit.truth.rollbackOrReplacementDetectedAgainstSeparatedCheckpoint, true, 'separated rollback truth is explicit');
  equal(rollbackChild.output.audit.truth.deletionOrRollbackPrevented, false, 'separated rollback detection is not promoted to prevention');
  check(SeparationGate.verifySeparatedWitness(separationInput, separated).pass, 'original separated receipt remains valid after ledger rollback');

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
  equal(invalidChild.output.audit.decision.classification, 'HOLD_CURRENT_LEDGER_STATE_INVALID', 'invalid current ledger is held against separated checkpoint');
  equal(invalidChild.output.audit.truth.currentInvalidityDetected, true, 'separated audit retains invalid-current-state truth');

  verifiedRemove(namespace, tempRoot);
  const absentChild = runChild(
    packagePath,
    stateRoot,
    ledgerId,
    'absent',
    '2026-08-20T14:12:10.000Z',
    '2026-08-20T14:12:20.000Z'
  );
  equal(absentChild.output.audit.decision.classification, 'HOLD_LEDGER_STATE_ABSENT_AGAINST_PRESENTED_CHECKPOINT', 'absent ledger is held against separated checkpoint');
  equal(absentChild.output.audit.truth.currentAbsenceDetectedAgainstSeparatedCheckpoint, true, 'separated audit retains absent-current-state truth');

  const otherLedgerId = 'ledger:separation-gate-other';
  const otherService = Ledger.createService({ stateRoot: otherStateRoot, ledgerId: otherLedgerId });
  otherService.consume(LedgerFixture.buildRequest('separation-gate-other'));
  const identityChild = runChild(
    packagePath,
    otherStateRoot,
    otherLedgerId,
    'identity',
    '2026-08-20T14:12:30.000Z',
    '2026-08-20T14:12:40.000Z'
  );
  equal(identityChild.output.audit.decision.classification, 'HOLD_LEDGER_IDENTITY_CHANGED', 'different current ledger identity is held against separated checkpoint');
  equal(identityChild.output.audit.truth.comparisonBoundToExactLedgerIdentity, false, 'identity-drift separated audit refuses exact-identity claim');

  const auditTamper = copy(exactChild.output.audit);
  auditTamper.truth.hostAuthorizationAuthenticated = true;
  auditTamper.auditDigest = SeparationGate.sha256((() => {
    const value = copy(auditTamper);
    delete value.auditDigest;
    return value;
  })());
  equal(SeparationGate.verifySeparatedAudit(exactChild.output.auditInput, auditTamper).pass, false, 'separated audit authority tamper fails even with recomputed digest');

  const snapshotTamperInput = copy(exactChild.output.auditInput);
  snapshotTamperInput.currentSnapshot.truth.executionAuthorized = true;
  snapshotTamperInput.currentSnapshot.snapshotDigest = SeparationGate.sha256((() => {
    const value = copy(snapshotTamperInput.currentSnapshot);
    delete value.snapshotDigest;
    return value;
  })());
  throws(() => SeparationGate.buildSeparatedAudit(snapshotTamperInput), /snapshot content or digest mismatch/, 'tampered current snapshot boundary cannot drive separated audit');

  const serializedAudit = SeparationGate.stableStringify(exactChild.output.audit);
  check(!serializedAudit.includes(tempRoot), 'separated audit retains no machine state-root path');
  check(!serializedAudit.includes('BEGIN PUBLIC KEY'), 'separated audit retains no raw public key');
  check(!serializedAudit.includes(chain.anchorPackage.anchoredWitnessInput.policyAuthorizations[0].signature), 'separated audit retains no raw signature');

  const receiptSchema = JSON.parse(fs.readFileSync(path.join(__dirname, 'model-shadow-review-challenge-separated-witness.schema.json'), 'utf8'));
  const auditSchema = JSON.parse(fs.readFileSync(path.join(__dirname, 'model-shadow-review-challenge-separated-continuity.schema.json'), 'utf8'));
  const contract = JSON.parse(fs.readFileSync(path.join(__dirname, 'module.contract.json'), 'utf8'));
  const implementation = fs.readFileSync(path.join(__dirname, 'model-shadow-review-challenge-separation-gate.js'), 'utf8');
  const readme = fs.readFileSync(path.join(__dirname, 'README.md'), 'utf8');
  equal(receiptSchema.$id, SeparationGate.RECEIPT_SCHEMA, 'separated witness schema identity matches implementation');
  equal(auditSchema.$id, SeparationGate.AUDIT_SCHEMA, 'separated audit schema identity matches implementation');
  check(contract.status === 'TEST' && contract.permissions.length === 0 && contract.boundaries.reads.length === 0 && contract.boundaries.writes.length === 0, 'module remains permissionless read-only TEST with no direct I/O');
  check(contract.lifecycle.installed === false && contract.lifecycle.promoted === false, 'module remains uninstalled and unpromoted');
  check(contract.boundaries.refuses.includes('shared-public-key-fingerprint-across-witness-and-anchor-layers'), 'contract refuses cross-layer public key reuse');
  check(contract.boundaries.refuses.includes('shared-declared-principal-digest-across-witness-and-anchor-layers'), 'contract refuses cross-layer declared-principal reuse');
  check(contract.boundaries.refuses.includes('observable-nonoverlap-as-independent-controller-proof'), 'contract refuses non-overlap as controller independence');
  check(contract.boundaries.refuses.includes('observable-nonoverlap-as-collusion-exclusion'), 'contract refuses non-overlap as collusion exclusion');
  check(contract.boundaries.refuses.includes('separation-receipt-as-proven-external-retention'), 'contract refuses separation receipt as external retention proof');
  check(/One\s+controller can generate different keys/.test(readme) && /does not exclude\s+collusion/.test(readme), 'README preserves same-controller and collusion boundaries');
  check(!implementation.includes("require('fs')") && !implementation.includes("require('child_process')"), 'runtime implementation imports no filesystem or process capability');
  check(!implementation.includes('writeFileSync') && !implementation.includes('mkdirSync') && !implementation.includes('rmSync') && !implementation.includes('unlinkSync'), 'runtime implementation contains no filesystem write route');
  check(!implementation.includes('fetch('), 'runtime implementation contains no network route');

  console.log('\nModel Shadow review challenge separation gate selftest: PASS (' + checks + ' checks)');
} finally {
  verifiedRemove(tempRoot, path.dirname(tempRoot));
}
