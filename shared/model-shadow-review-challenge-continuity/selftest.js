#!/usr/bin/env node
'use strict';

const assert = require('assert');
const childProcess = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Continuity = require('./model-shadow-review-challenge-continuity');
const Ledger = require('../model-shadow-review-challenge-ledger/model-shadow-review-challenge-ledger');
const Fixture = require('../model-shadow-review-challenge-ledger/selftest-fixture');

let checks = 0;
function check(value, label) { assert.ok(value, label); checks += 1; console.log('PASS ' + label); }
function equal(actual, expected, label) { assert.strictEqual(actual, expected); checks += 1; console.log('PASS ' + label); }
function throws(fn, pattern, label) { assert.throws(fn, pattern); checks += 1; console.log('PASS ' + label); }
function copy(value) { return JSON.parse(JSON.stringify(value)); }

const childPath = path.join(__dirname, 'selftest-child.js');

function runChild(checkpointPath, stateRoot, ledgerId, tag, observedAt, checkedAt) {
  const result = childProcess.spawnSync(process.execPath, [
    childPath,
    checkpointPath,
    stateRoot,
    ledgerId,
    'observation:child-' + tag,
    observedAt,
    'audit:child-' + tag,
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

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'axm-challenge-continuity-'));
try {
  const stateRoot = path.join(tempRoot, 'state-a');
  const otherStateRoot = path.join(tempRoot, 'state-b');
  fs.mkdirSync(stateRoot);
  fs.mkdirSync(otherStateRoot);
  const ledgerId = 'ledger:continuity-selftest';
  const service = Ledger.createService({ stateRoot, ledgerId });

  const absent = Continuity.captureState({
    stateRoot,
    ledgerId,
    observationId: 'observation:absent-before-init',
    observedAt: '2026-08-20T14:06:00.000Z'
  });
  equal(absent.availability, 'ABSENT', 'uninitialized namespace is observed as absent');
  equal(absent.truth.absenceClaimedAsNeverExisted, false, 'absence is not promoted to a never-existed claim');
  throws(
    () => Continuity.buildCheckpoint({ checkpointId: 'checkpoint:absent', anchoredAt: '2026-08-20T14:06:01.000Z', currentSnapshot: absent }),
    /requires an available valid ledger snapshot/,
    'absent state cannot become a continuity checkpoint'
  );

  const baseRequest = Fixture.buildRequest('continuity-base');
  const baseReceipt = service.consume(baseRequest);
  const namespace = path.join(stateRoot, Ledger.NAMESPACE);
  const beforeCapture = treeFingerprint(namespace);
  const baseSnapshot = Continuity.captureState({
    stateRoot,
    ledgerId,
    observationId: 'observation:base',
    observedAt: '2026-08-20T14:07:00.000Z'
  });
  const afterCapture = treeFingerprint(namespace);
  equal(beforeCapture, afterCapture, 'ledger capture performs no filesystem write');
  equal(baseSnapshot.availability, 'AVAILABLE', 'valid initialized ledger is available');
  equal(baseSnapshot.entryCount, 1, 'base snapshot contains one exact challenge entry');
  equal(baseSnapshot.entries[0].challengeDigest, baseReceipt.challengeRef.sha256, 'snapshot binds exact challenge digest');
  equal(baseSnapshot.entries[0].consumptionReceiptDigest, baseReceipt.receiptDigest, 'snapshot binds exact consumption receipt digest');
  equal(baseSnapshot.truth.currentLedgerFilesValidated, true, 'available snapshot validates current ledger files');
  equal(baseSnapshot.truth.snapshotOriginAuthenticated, false, 'snapshot self-digest does not authenticate observer origin');
  equal(baseSnapshot.truth.observationTimeExternallyTrusted, false, 'snapshot caller time remains untrusted');
  check(Continuity.verifySnapshot(baseSnapshot).pass, 'base snapshot verifies by exact rebuild');

  const checkpoint = Continuity.buildCheckpoint({
    checkpointId: 'checkpoint:continuity-base',
    anchoredAt: '2026-08-20T14:07:30.000Z',
    currentSnapshot: baseSnapshot
  });
  equal(checkpoint.entryCount, 1, 'checkpoint retains one privacy-bounded entry');
  equal(checkpoint.truth.futureStateComparable, true, 'checkpoint enables future exact comparison');
  equal(checkpoint.truth.checkpointWrittenByThisModule, false, 'checkpoint leaf performs no checkpoint storage write');
  equal(checkpoint.truth.checkpointExternalRetentionProven, false, 'checkpoint does not prove external retention');
  equal(checkpoint.truth.checkpointAuthorityAuthenticated, false, 'checkpoint self-digest is not authenticated authority');
  equal(checkpoint.truth.sourceSnapshotOriginAuthenticated, false, 'checkpoint does not authenticate snapshot origin');
  equal(checkpoint.truth.checkpointTimeExternallyTrusted, false, 'checkpoint caller time remains untrusted');
  equal(checkpoint.truth.ledgerDeletionOrRollbackPrevented, false, 'checkpoint does not claim rollback prevention');
  equal(checkpoint.truth.globalSingleUseProven, false, 'checkpoint does not claim global single-use');
  check(Continuity.verifyCheckpoint(checkpoint).pass, 'checkpoint validates its strict content and digest');

  const checkpointPath = path.join(tempRoot, 'caller-retained-checkpoint.json');
  fs.writeFileSync(checkpointPath, Continuity.stableStringify(checkpoint) + '\n', { encoding: 'utf8', mode: 0o600 });
  const exactChild = runChild(
    checkpointPath, stateRoot, ledgerId, 'exact',
    '2026-08-20T14:08:00.000Z', '2026-08-20T14:08:01.000Z'
  );
  equal(exactChild.status, 0, 'fresh process audits current state successfully');
  equal(exactChild.output.audit.decision.classification, 'CURRENT_LEDGER_MATCHES_PRESENTED_CHECKPOINT', 'fresh process sees exact checkpoint match');
  equal(exactChild.output.audit.decision.reviewRequired, false, 'exact match requires no continuity repair');
  equal(exactChild.output.audit.truth.presentedCheckpointProvesExternalRetention, false, 'fresh process does not infer external retention');
  equal(exactChild.output.audit.truth.currentSnapshotOriginAuthenticated, false, 'audit does not authenticate snapshot origin');
  equal(exactChild.output.audit.truth.executionAuthorized, false, 'continuity match grants no execution authority');
  check(Continuity.verifyAudit({
    auditId: 'audit:child-exact',
    checkedAt: '2026-08-20T14:08:01.000Z',
    priorCheckpoint: checkpoint,
    currentSnapshot: exactChild.output.currentSnapshot
  }, exactChild.output.audit).pass, 'fresh-process exact audit verifies by rebuild');

  const extensionRequest = Fixture.buildRequest('continuity-extension');
  const extensionReceipt = service.consume(extensionRequest);
  const extensionChild = runChild(
    checkpointPath, stateRoot, ledgerId, 'extension',
    '2026-08-20T14:08:10.000Z', '2026-08-20T14:08:11.000Z'
  );
  equal(extensionChild.status, 0, 'fresh process audits forward extension');
  equal(extensionChild.output.audit.decision.classification, 'CURRENT_LEDGER_EXTENDS_PRESENTED_CHECKPOINT', 'new challenge is classified as forward extension');
  equal(extensionChild.output.audit.comparison.addedCurrentChallenges.length, 1, 'extension identifies one added challenge');
  equal(extensionChild.output.audit.comparison.addedCurrentChallenges[0], extensionReceipt.challengeRef.sha256, 'extension identifies exact added challenge digest');
  equal(extensionChild.output.audit.decision.reviewRequired, false, 'forward extension alone is not a continuity contradiction');
  const extensionCheckpoint = Continuity.buildCheckpoint({
    checkpointId: 'checkpoint:extension-order',
    anchoredAt: '2026-08-20T14:08:12.000Z',
    currentSnapshot: extensionChild.output.currentSnapshot
  });
  const reorderedCheckpoint = copy(extensionCheckpoint);
  reorderedCheckpoint.entries.reverse();
  delete reorderedCheckpoint.checkpointDigest;
  reorderedCheckpoint.checkpointDigest = Continuity.sha256(reorderedCheckpoint);
  equal(Continuity.verifyCheckpoint(reorderedCheckpoint).pass, false, 'checkpoint refuses non-canonical entry ordering even with recomputed digest');

  const unexpectedNamespacePath = path.join(namespace, 'unexpected.json');
  fs.writeFileSync(unexpectedNamespacePath, '{}');
  const unexpectedNamespace = Continuity.captureState({
    stateRoot,
    ledgerId,
    observationId: 'observation:unexpected-namespace',
    observedAt: '2026-08-20T14:08:15.000Z'
  });
  equal(unexpectedNamespace.availability, 'INVALID', 'unexpected namespace file makes current state invalid');
  check(unexpectedNamespace.errors.includes('LEDGER_UNEXPECTED_NAMESPACE_ENTRY'), 'unexpected namespace error is retained without a machine path');
  fs.unlinkSync(unexpectedNamespacePath);

  const entriesPath = path.join(namespace, Ledger.ENTRIES_DIRECTORY);
  const unexpectedPath = path.join(entriesPath, '.pending-synthetic.json');
  fs.writeFileSync(unexpectedPath, '{}');
  const unexpected = Continuity.captureState({
    stateRoot,
    ledgerId,
    observationId: 'observation:unexpected-entry',
    observedAt: '2026-08-20T14:08:20.000Z'
  });
  equal(unexpected.availability, 'INVALID', 'unexpected entry file makes current state invalid');
  check(unexpected.errors.includes('LEDGER_UNEXPECTED_ENTRY_NAME'), 'unexpected entry error is retained without a machine path');
  fs.unlinkSync(unexpectedPath);

  const baseEntryPath = path.join(entriesPath, baseReceipt.challengeRef.sha256.slice('sha256:'.length) + '.json');
  fs.unlinkSync(baseEntryPath);
  const missingChild = runChild(
    checkpointPath, stateRoot, ledgerId, 'missing',
    '2026-08-20T14:08:30.000Z', '2026-08-20T14:08:31.000Z'
  );
  equal(missingChild.status, 0, 'fresh process produces a bounded audit for a missing entry');
  equal(missingChild.output.audit.decision.classification, 'ROLLBACK_OR_REPLACEMENT_DETECTED_AGAINST_PRESENTED_CHECKPOINT', 'missing checkpoint entry is detected as relative rollback');
  equal(missingChild.output.audit.comparison.missingCheckpointChallenges[0], baseReceipt.challengeRef.sha256, 'missing exact challenge digest is retained');
  equal(missingChild.output.audit.decision.reviewRequired, true, 'missing entry requires review');
  equal(missingChild.output.audit.decision.autonomousActionCount, 0, 'rollback detection performs no recovery action');

  const replacementRequest = copy(baseRequest);
  replacementRequest.consumptionId = 'consumption:continuity-base-replacement';
  replacementRequest.consumedAt = '2026-08-20T14:08:40.000Z';
  const replacementReceipt = service.consume(replacementRequest);
  check(replacementReceipt.receiptDigest !== baseReceipt.receiptDigest, 'replacement receipt has a distinct exact digest');
  const replacementChild = runChild(
    checkpointPath, stateRoot, ledgerId, 'replacement',
    '2026-08-20T14:09:00.000Z', '2026-08-20T14:09:01.000Z'
  );
  equal(replacementChild.output.audit.decision.classification, 'ROLLBACK_OR_REPLACEMENT_DETECTED_AGAINST_PRESENTED_CHECKPOINT', 'valid replacement is detected relative to checkpoint');
  equal(replacementChild.output.audit.comparison.replacedCheckpointEntries.length, 1, 'one replaced checkpoint entry is retained');
  equal(replacementChild.output.audit.comparison.replacedCheckpointEntries[0].currentReceiptDigest, replacementReceipt.receiptDigest, 'replacement comparison binds current receipt digest');
  equal(replacementChild.output.audit.truth.rollbackOrReplacementDetectedAgainstPresentedCheckpoint, true, 'relative replacement truth is explicit');
  equal(replacementChild.output.audit.truth.ledgerDeletionOrRollbackPrevented, false, 'detection remains distinct from prevention');

  const extensionEntryPath = path.join(entriesPath, extensionReceipt.challengeRef.sha256.slice('sha256:'.length) + '.json');
  fs.writeFileSync(extensionEntryPath, '{"truncated":');
  const invalidChild = runChild(
    checkpointPath, stateRoot, ledgerId, 'invalid',
    '2026-08-20T14:10:00.000Z', '2026-08-20T14:10:01.000Z'
  );
  equal(invalidChild.output.currentSnapshot.availability, 'INVALID', 'fresh process observes corrupt current state as invalid');
  equal(invalidChild.output.audit.decision.classification, 'HOLD_CURRENT_LEDGER_STATE_INVALID', 'corrupt state produces a hold');
  equal(invalidChild.output.audit.truth.currentInvalidityDetected, true, 'current invalidity truth is explicit');
  equal(invalidChild.output.audit.decision.autonomousActionCount, 0, 'invalid state is not repaired automatically');

  verifiedRemove(namespace, tempRoot);
  const absentChild = runChild(
    checkpointPath, stateRoot, ledgerId, 'deleted',
    '2026-08-20T14:11:00.000Z', '2026-08-20T14:11:01.000Z'
  );
  equal(absentChild.output.currentSnapshot.availability, 'ABSENT', 'fresh process observes whole namespace deletion');
  equal(absentChild.output.audit.decision.classification, 'HOLD_LEDGER_STATE_ABSENT_AGAINST_PRESENTED_CHECKPOINT', 'deleted namespace is held against presented checkpoint');
  equal(absentChild.output.audit.comparison.missingCheckpointChallenges[0], baseReceipt.challengeRef.sha256, 'whole-state absence enumerates the exact missing checkpoint challenge');
  equal(absentChild.output.audit.truth.currentAbsenceDetectedAgainstPresentedCheckpoint, true, 'current absence truth is explicit');
  equal(absentChild.output.audit.truth.preCheckpointHistoryProven, false, 'checkpoint does not retroactively prove prior history');

  const otherLedgerId = 'ledger:continuity-other';
  const otherService = Ledger.createService({ stateRoot: otherStateRoot, ledgerId: otherLedgerId });
  otherService.consume(Fixture.buildRequest('continuity-other-ledger'));
  const identityChild = runChild(
    checkpointPath, otherStateRoot, otherLedgerId, 'identity',
    '2026-08-20T14:12:00.000Z', '2026-08-20T14:12:01.000Z'
  );
  equal(identityChild.output.audit.decision.classification, 'HOLD_LEDGER_IDENTITY_CHANGED', 'different valid ledger identity produces a hold');
  equal(identityChild.output.audit.comparison.ledgerIdentityMatches, false, 'ledger identity mismatch is explicit');
  equal(identityChild.output.audit.truth.comparisonBoundToExactLedgerIdentity, false, 'identity-drift audit refuses exact-identity claim');

  const checkpointTamper = copy(checkpoint);
  checkpointTamper.entryCount = 2;
  equal(Continuity.verifyCheckpoint(checkpointTamper).pass, false, 'checkpoint summary tampering is detected');
  const boundaryTamper = copy(checkpoint);
  boundaryTamper.truth.checkpointAuthorityAuthenticated = true;
  delete boundaryTamper.checkpointDigest;
  boundaryTamper.checkpointDigest = Continuity.sha256(boundaryTamper);
  equal(Continuity.verifyCheckpoint(boundaryTamper).pass, false, 'checkpoint authority tamper fails even with recomputed digest');
  const snapshotTamper = copy(baseSnapshot);
  snapshotTamper.truth.executionAuthorized = true;
  delete snapshotTamper.snapshotDigest;
  snapshotTamper.snapshotDigest = Continuity.sha256(snapshotTamper);
  equal(Continuity.verifySnapshot(snapshotTamper).pass, false, 'snapshot authority tamper fails even with recomputed digest');
  throws(
    () => Continuity.buildAudit({ auditId: 'audit:tamper', checkedAt: '2026-08-20T14:13:00.000Z', priorCheckpoint: checkpointTamper, currentSnapshot: baseSnapshot }),
    /entry summary mismatch/,
    'invalid checkpoint cannot drive an audit'
  );

  const serializedSnapshot = Continuity.stableStringify(baseSnapshot);
  const serializedCheckpoint = Continuity.stableStringify(checkpoint);
  check(!serializedSnapshot.includes(tempRoot) && !serializedCheckpoint.includes(tempRoot), 'snapshot and checkpoint retain no machine state-root path');
  check(!serializedCheckpoint.includes('fixture-human'), 'checkpoint retains no raw Review Inbox actor string');
  check(!serializedCheckpoint.includes('BEGIN PUBLIC KEY'), 'checkpoint retains no raw public key');
  check(!serializedCheckpoint.includes(baseRequest.signedReviewInput.signedAttestations[0].signature), 'checkpoint retains no raw signature');

  const snapshotSchema = JSON.parse(fs.readFileSync(path.join(__dirname, 'model-shadow-review-challenge-ledger-snapshot.schema.json'), 'utf8'));
  const checkpointSchema = JSON.parse(fs.readFileSync(path.join(__dirname, 'model-shadow-review-challenge-checkpoint.schema.json'), 'utf8'));
  const auditSchema = JSON.parse(fs.readFileSync(path.join(__dirname, 'model-shadow-review-challenge-continuity.schema.json'), 'utf8'));
  const contract = JSON.parse(fs.readFileSync(path.join(__dirname, 'module.contract.json'), 'utf8'));
  const implementation = fs.readFileSync(path.join(__dirname, 'model-shadow-review-challenge-continuity.js'), 'utf8');
  equal(snapshotSchema.$id, Continuity.SNAPSHOT_SCHEMA, 'snapshot schema identity matches implementation');
  equal(checkpointSchema.$id, Continuity.CHECKPOINT_SCHEMA, 'checkpoint schema identity matches implementation');
  equal(auditSchema.$id, Continuity.AUDIT_SCHEMA, 'audit schema identity matches implementation');
  check(contract.status === 'TEST' && contract.permissions.length === 0 && contract.boundaries.writes.length === 0, 'module remains read-only TEST with no claimed host permission integration');
  check(contract.lifecycle.installed === false && contract.lifecycle.promoted === false, 'module remains uninstalled and unpromoted');
  check(contract.boundaries.refuses.includes('relative-rollback-detection-as-rollback-prevention'), 'contract refuses detection as prevention');
  check(contract.boundaries.refuses.includes('caller-checkpoint-as-authenticated-authority'), 'contract refuses caller checkpoint as authenticated authority');
  check(!implementation.includes('writeFileSync') && !implementation.includes('mkdirSync') && !implementation.includes('rmSync') && !implementation.includes('unlinkSync'), 'runtime implementation contains no filesystem write route');
  check(!implementation.includes('fetch(') && !implementation.includes('child_process'), 'runtime implementation contains no network or process execution route');

  console.log('\nModel Shadow review challenge continuity selftest: PASS (' + checks + ' checks)');
} finally {
  verifiedRemove(tempRoot, path.dirname(tempRoot));
}
