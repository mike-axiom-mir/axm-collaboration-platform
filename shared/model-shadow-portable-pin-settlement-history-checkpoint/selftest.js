#!/usr/bin/env node
'use strict';

const assert = require('assert');
const childProcess = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const ContractVerifier = require('../../hub/module-contract-verifier');
const Ledger = require('../model-shadow-history-checkpoint-pin-settlement-ledger/model-shadow-history-checkpoint-pin-settlement-ledger');
const Checkpoint = require('./model-shadow-portable-pin-settlement-history-checkpoint');
const Fixture = require('./selftest-fixture');

let checks = 0;
const observedClassifications = new Set();
function check(value, label) { assert.ok(value, label); checks += 1; console.log('PASS ' + label); }
function equal(actual, expected, label) { assert.deepStrictEqual(actual, expected, label); checks += 1; console.log('PASS ' + label); }
function copy(value) { return JSON.parse(JSON.stringify(value)); }
function expectCode(action, code, label) {
  let caught = null;
  try { action(); } catch (error) { caught = error; }
  check(caught instanceof Checkpoint.PinSettlementHistoryCheckpointError, label + ' returns typed v2.6 error');
  equal(caught.code, code, label);
}
function treeDigest(root) {
  const entries = [];
  function walk(current, relative) {
    fs.readdirSync(current, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name)).forEach(entry => {
      const absolute = path.join(current, entry.name); const child = relative ? relative + '/' + entry.name : entry.name;
      if (entry.isDirectory()) { entries.push({ path: child, type: 'directory' }); walk(absolute, child); }
      else entries.push({ path: child, type: 'file', sha256: crypto.createHash('sha256').update(fs.readFileSync(absolute)).digest('hex') });
    });
  }
  walk(root, '');
  return crypto.createHash('sha256').update(JSON.stringify(entries)).digest('hex');
}
function writePackage(parent, name, value) {
  const target = path.join(parent, name + '.json'); fs.writeFileSync(target, JSON.stringify(value), { encoding: 'utf8', mode: 0o600 }); return target;
}
function runChild(packagePath) {
  const result = childProcess.spawnSync(process.execPath, [path.join(__dirname, 'selftest-child.js'), packagePath], {
    encoding: 'utf8', windowsHide: true, maxBuffer: 256 * 1024 * 1024
  });
  return { status: result.status, value: JSON.parse(result.stdout || '{}'), stderr: result.stderr };
}
function verifiedRemove(target, parent) {
  const resolvedTarget = path.resolve(target); const resolvedParent = path.resolve(parent);
  if (resolvedTarget === resolvedParent || !resolvedTarget.startsWith(resolvedParent + path.sep)) throw new Error('unsafe cleanup target');
  fs.rmSync(resolvedTarget, { recursive: true, force: true });
}
function redigestCheckpoint(value) {
  const result = copy(value); result.checkpointDigest = null; delete result.checkpointDigest;
  result.checkpointDigest = Checkpoint.sha256(result); return result;
}
function redigestAudit(value) {
  const result = copy(value); result.auditDigest = null; delete result.auditDigest;
  result.auditDigest = Checkpoint.sha256(result); return result;
}
function audit(input) { const result = Checkpoint.auditCheckpoint(input); observedClassifications.add(result.classification); return result; }

function main() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'axm-v26-pin-history-checkpoint-'));
  try {
    const fixture = Fixture.build(Fixture.makeDir(tempRoot, 'fixture'));
    equal(Checkpoint.VERSION, '2.6.0', 'version is exact');
    equal(Checkpoint.STATUS, 'TEST', 'status remains TEST');
    equal(Checkpoint.CLASSIFICATIONS.length, 7, 'classification set is closed to seven outcomes');
    equal(Checkpoint.MAX_HISTORY_ITEMS, 10000, 'history item bound matches v2.5 record bound');
    equal(Checkpoint.MAX_INPUT_CANONICAL_BYTES, 268435456, 'input bound is 256 MiB');
    equal(Checkpoint.MAX_CHECKPOINT_CANONICAL_BYTES, 16777216, 'checkpoint bound is 16 MiB');
    equal(Checkpoint.MAX_AUDIT_CANONICAL_BYTES, 1048576, 'audit bound is one MiB');

    const pending = Fixture.buildPending(tempRoot, fixture, 'primary-pending', 'A', 'v26-history', 'v26-primary-a');
    const pendingOptions = copy(pending.serviceOptions);
    const pendingRecords = [copy(pending.record)];
    equal(Object.keys(pendingRecords[0].settlement || {}), [], 'pending record has no settlement package');
    const pendingTreeBefore = treeDigest(pending.root);
    const pendingCheckpointInput = Fixture.checkpointInput('pin-history-checkpoint:pending-a', '2026-08-20T16:32:30.000Z', pendingOptions, pendingRecords);
    const pendingCheckpoint = Checkpoint.createCheckpoint(pendingCheckpointInput);
    equal(treeDigest(pending.root), pendingTreeBefore, 'checkpoint creation leaves complete v2.5 root byte-identical');
    equal(pendingCheckpoint.schema, Checkpoint.CHECKPOINT_SCHEMA, 'checkpoint schema is exact');
    equal(pendingCheckpoint.status, 'TEST', 'checkpoint remains TEST');
    equal(pendingCheckpoint.state.proposalCount, 1, 'pending checkpoint binds one proposal');
    equal(pendingCheckpoint.state.settlementCount, 0, 'pending checkpoint binds no settlement');
    equal(pendingCheckpoint.history.proposalRefs.length, 1, 'pending checkpoint commits full proposal sequence');
    equal(pendingCheckpoint.history.settlementRefs, [], 'pending checkpoint commits empty settlement sequence');
    equal(pendingCheckpoint.history.settledPinRefs, [], 'pending checkpoint commits empty settled-pin sequence');
    equal(pendingCheckpoint.state.pendingProposalRef, pendingCheckpoint.history.proposalRefs[0], 'pending checkpoint binds trailing proposal reference');
    equal(pendingCheckpoint.state.currentSettledPinRef, pendingCheckpoint.genesisPinRef, 'pending checkpoint self-derives genesis as settled head');
    equal(pendingCheckpoint.truth.everyPersistedProposalExactRebuiltFromCallerPackage, true, 'checkpoint truth records exact proposal rebuild');
    equal(pendingCheckpoint.truth.checkpointPersistedByModule, false, 'module stores no checkpoint');
    equal(pendingCheckpoint.truth.checkpointExternalRetentionProven, false, 'checkpoint claims no external retention');
    equal(pendingCheckpoint.truth.ledgerSnapshotAtomic, false, 'checkpoint claims no atomic snapshot');
    equal(pendingCheckpoint.truth.transientV25OperationLockMayBeWritten, true, 'checkpoint declares composed v2.5 transient lock writes');
    equal(pendingCheckpoint.truth.durableLedgerStateChangedByModule, false, 'checkpoint claims no durable ledger change');
    equal(Checkpoint.validateCheckpoint(pendingCheckpoint), pendingCheckpoint, 'pending checkpoint self-validates');
    equal(Checkpoint.verifyCheckpointOrigin(pendingCheckpointInput, pendingCheckpoint).pass, true, 'pending checkpoint exact-rebuilds from origin package');

    const pendingExactInput = Fixture.auditInput('pin-history-audit:pending-exact', '2026-08-20T16:32:40.000Z', pendingCheckpoint, pendingOptions, pendingRecords);
    const pendingExact = audit(pendingExactInput);
    equal(pendingExact.classification, 'EXACT_HISTORY_MATCH', 'pending history audits as exact');
    equal(pendingExact.current.currentSettledPinRef, pendingCheckpoint.genesisPinRef, 'pending audit preserves settled genesis head');
    equal(pendingExact.comparison.commonProposalPrefixCount, 1, 'pending exact audit shares full proposal prefix');
    equal(pendingExact.comparison.commonSettlementPrefixCount, 0, 'pending exact audit shares empty settlement prefix');
    equal(pendingExact.decision.holdRequired, false, 'exact audit does not require hold');
    equal(pendingExact.decision.autonomousActionCount, 0, 'exact audit authorizes no autonomous action');
    equal(Checkpoint.validateAudit(pendingExact), pendingExact, 'pending exact audit self-validates');
    equal(Checkpoint.verifyAudit(pendingExactInput, pendingExact).pass, true, 'pending exact audit rebuilds from caller package');
    equal(treeDigest(pending.root), pendingTreeBefore, 'exact audit leaves complete v2.5 root byte-identical');

    const childCheckpointPath = writePackage(tempRoot, 'fresh-checkpoint', { action: 'checkpoint', input: pendingCheckpointInput });
    const childCheckpoint = runChild(childCheckpointPath);
    equal(childCheckpoint.status, 0, 'fresh checkpoint process exits normally');
    equal(childCheckpoint.value.ok, true, 'fresh checkpoint process reports success');
    check(childCheckpoint.value.pid !== process.pid, 'fresh checkpoint uses a distinct process');
    equal(childCheckpoint.value.result, pendingCheckpoint, 'fresh-process checkpoint is exact');
    const childAuditPath = writePackage(tempRoot, 'fresh-audit', { action: 'audit', input: pendingExactInput });
    const childAudit = runChild(childAuditPath);
    equal(childAudit.status, 0, 'fresh audit process exits normally');
    equal(childAudit.value.ok, true, 'fresh audit process reports success');
    check(childAudit.value.pid !== process.pid, 'fresh audit uses a distinct process');
    equal(childAudit.value.result, pendingExact, 'fresh-process audit is exact');
    const childVerifyPath = writePackage(tempRoot, 'fresh-verify-checkpoint', { action: 'verify-checkpoint', input: pendingCheckpointInput, receipt: pendingCheckpoint });
    const childVerify = runChild(childVerifyPath);
    equal(childVerify.value.result.pass, true, 'fresh process exact-verifies checkpoint origin');

    const rollbackRoot = path.join(tempRoot, 'rollback-pending-copy');
    fs.cpSync(pending.root, rollbackRoot, { recursive: true });
    const rollbackOptions = Object.assign(copy(pendingOptions), { stateRoot: rollbackRoot });
    const movementRoot = path.join(tempRoot, 'movement-pending-copy');
    fs.cpSync(pending.root, movementRoot, { recursive: true });
    const movementOptions = Object.assign(copy(pendingOptions), { stateRoot: movementRoot });
    const movementService = Ledger.createService(copy(movementOptions));
    const movementSettlementInput = require('../model-shadow-history-checkpoint-pin-settlement-ledger/selftest-fixture').settlementInput(
      pending.proposalInput, pending.proposal, 'v26-movement', '2026-08-20T16:33:00.000Z'
    );
    const originalCreateService = Ledger.createService;
    let movementTriggered = false;
    Ledger.createService = function wrappedCreateService(value) {
      const wrapped = originalCreateService(value);
      if (path.resolve(value.stateRoot) !== path.resolve(movementRoot)) return wrapped;
      return Object.freeze(Object.assign({}, wrapped, {
        verifyProposalPersisted(input, receipt) {
          const result = wrapped.verifyProposalPersisted(input, receipt);
          if (!movementTriggered) { movementTriggered = true; movementService.settle(copy(movementSettlementInput)); }
          return result;
        }
      }));
    };
    try {
      const movingInput = Fixture.checkpointInput('pin-history-checkpoint:moving', '2026-08-20T16:33:10.000Z', movementOptions, pendingRecords);
      expectCode(() => Checkpoint.createCheckpoint(movingInput), 'LEDGER_MOVED_DURING_PRESENTATION', 'changed bracketing snapshot refuses checkpoint');
      equal(movementTriggered, true, 'movement adversary settled proposal during package verification');
    } finally { Ledger.createService = originalCreateService; }

    const settled = Fixture.settle(pending, 'v26-primary-a', '2026-08-20T16:33:00.000Z');
    const settledRecords = [copy(settled.record)];
    equal(Object.prototype.hasOwnProperty.call(settledRecords[0].settlement, 'proposalInput'), false, 'settlement package deduplicates proposal input');
    equal(Object.prototype.hasOwnProperty.call(settledRecords[0].settlement, 'proposalReceipt'), false, 'settlement package deduplicates proposal receipt');
    const pendingForwardInput = Fixture.auditInput('pin-history-audit:pending-forward', '2026-08-20T16:33:10.000Z', pendingCheckpoint, pendingOptions, settledRecords);
    const pendingForward = audit(pendingForwardInput);
    equal(pendingForward.classification, 'FORWARD_HISTORY_EXTENSION', 'settling checkpointed pending proposal is forward extension');
    equal(pendingForward.comparison.commonProposalPrefixCount, 1, 'pending forward preserves full proposal prefix');
    equal(pendingForward.comparison.commonSettlementPrefixCount, 0, 'pending forward preserves checkpoint empty settlement prefix');
    equal(pendingForward.comparison.commonSettledPinPrefixCount, 0, 'pending forward preserves checkpoint empty settled-pin prefix');
    equal(pendingForward.current.settlementCount, 1, 'forward audit sees new settlement');
    equal(pendingForward.decision.holdRequired, false, 'forward extension does not require hold');
    equal(pendingForward.truth.checkpointOriginReauthenticatedAtAudit, false, 'audit does not reauthenticate checkpoint origin');
    equal(pendingForward.truth.transientV25OperationLockMayBeWritten, true, 'present audit declares composed transient lock writes');

    const settledCheckpointInput = Fixture.checkpointInput('pin-history-checkpoint:settled-a', '2026-08-20T16:33:20.000Z', pendingOptions, settledRecords);
    const settledCheckpoint = Checkpoint.createCheckpoint(settledCheckpointInput);
    equal(settledCheckpoint.state.settlementCount, 1, 'settled checkpoint binds one settlement');
    equal(settledCheckpoint.history.settledPinRefs.length, 1, 'settled checkpoint commits settled-pin sequence');
    equal(settledCheckpoint.state.currentSettledPinRef, settledCheckpoint.history.settledPinRefs[0], 'checkpoint derives head from final settled-pin reference');
    equal(settledCheckpoint.state.pendingProposalRef, null, 'settled checkpoint has no pending proposal');
    const exactSettled = audit(Fixture.auditInput('pin-history-audit:settled-exact', '2026-08-20T16:33:30.000Z', settledCheckpoint, pendingOptions, settledRecords));
    equal(exactSettled.classification, 'EXACT_HISTORY_MATCH', 'settled history audits as exact');

    const rollbackAudit = audit(Fixture.auditInput('pin-history-audit:rollback', '2026-08-20T16:33:40.000Z', settledCheckpoint, rollbackOptions, pendingRecords));
    equal(rollbackAudit.classification, 'OBSERVED_STRICT_HISTORY_ROLLBACK_RELATIVE_TO_PRESENTED_CHECKPOINT', 'pending prefix is typed strict rollback relative to settled checkpoint');
    equal(rollbackAudit.comparison.commonProposalPrefixCount, 1, 'rollback preserves proposal prefix');
    equal(rollbackAudit.comparison.commonSettlementPrefixCount, 0, 'rollback has no settled prefix from settled checkpoint');
    equal(rollbackAudit.truth.strictRollbackObserved, true, 'rollback truth is classification-bound');
    equal(rollbackAudit.truth.deletionOrRollbackPrevented, false, 'rollback observation claims no prevention');
    equal(rollbackAudit.decision.holdRequired, true, 'rollback requires hold');

    const replacement = Fixture.buildPending(tempRoot, fixture, 'replacement-b', 'B', 'v26-history', 'v26-replacement-b');
    const replacementSettled = Fixture.settle(replacement, 'v26-replacement-b', '2026-08-20T16:33:00.000Z');
    const replacementRecords = [copy(replacementSettled.record)];
    const replacementAudit = audit(Fixture.auditInput('pin-history-audit:replacement', '2026-08-20T16:33:50.000Z', settledCheckpoint, replacement.serviceOptions, replacementRecords));
    equal(replacementAudit.classification, 'OBSERVED_HISTORY_REPLACEMENT_OR_FORK_RELATIVE_TO_PRESENTED_CHECKPOINT', 'different valid sequence under same identity is typed replacement or fork');
    equal(replacementAudit.comparison.commonProposalPrefixCount, 0, 'replacement shares no proposal prefix');
    equal(replacementAudit.comparison.commonSettlementPrefixCount, 0, 'replacement shares no settlement prefix');
    equal(replacementAudit.truth.replacementOrForkObserved, true, 'replacement truth is classification-bound');
    equal(replacementAudit.truth.withheldRootsExcluded, false, 'pairwise audit excludes no withheld root');

    const replacementCheckpointInput = Fixture.checkpointInput('pin-history-checkpoint:replacement-b', '2026-08-20T16:33:20.000Z', replacement.serviceOptions, replacementRecords);
    const replacementCheckpoint = Checkpoint.createCheckpoint(replacementCheckpointInput);
    const jointReplacement = audit(Fixture.auditInput('pin-history-audit:joint-replacement', '2026-08-20T16:34:00.000Z', replacementCheckpoint, replacement.serviceOptions, replacementRecords));
    equal(jointReplacement.classification, 'EXACT_HISTORY_MATCH', 'jointly replaced checkpoint and root form another exact relative history');
    check(replacementCheckpoint.checkpointDigest !== settledCheckpoint.checkpointDigest, 'joint replacement does not preserve original checkpoint digest');
    equal(jointReplacement.truth.checkpointExternalRetentionProven, false, 'joint replacement claims no checkpoint retention');

    const identity = Fixture.buildPending(tempRoot, fixture, 'identity-a', 'A', 'v26-other-log', 'v26-identity-a');
    const identitySettled = Fixture.settle(identity, 'v26-identity-a', '2026-08-20T16:33:00.000Z');
    const identityAudit = audit(Fixture.auditInput('pin-history-audit:identity', '2026-08-20T16:34:10.000Z', settledCheckpoint, identity.serviceOptions, [identitySettled.record]));
    equal(identityAudit.classification, 'OBSERVED_LEDGER_IDENTITY_DRIFT', 'different valid log identity is typed drift');
    equal(identityAudit.comparison.ledgerIdentityDrift, true, 'identity drift flag is exact');
    equal(identityAudit.decision.holdRequired, true, 'identity drift requires hold');

    const absentRoot = Fixture.makeDir(tempRoot, 'absent-ledger');
    const absentOptions = Fixture.options(absentRoot, fixture, 'v26-history');
    const absentAudit = audit(Fixture.auditInput('pin-history-audit:absent', '2026-08-20T16:34:20.000Z', settledCheckpoint, absentOptions, []));
    equal(absentAudit.classification, 'OBSERVED_LEDGER_ABSENT', 'absent namespace is typed absent');
    equal(absentAudit.current.snapshotBinding, null, 'absent audit claims no current snapshot');
    equal(absentAudit.current.errorCode, null, 'absent audit invents no error');
    equal(absentAudit.truth.absenceCauseProven, false, 'absence does not prove deletion cause');
    equal(absentAudit.truth.transientV25OperationLockMayBeWritten, false, 'absent namespace inspect writes no transient lock');
    equal(fs.existsSync(path.join(absentRoot, Ledger.NAMESPACE)), false, 'absent audit creates no v2.5 namespace');
    const absentWithPackages = Fixture.auditInput('pin-history-audit:absent-packages', '2026-08-20T16:34:21.000Z', settledCheckpoint, absentOptions, settledRecords);
    expectCode(() => Checkpoint.auditCheckpoint(absentWithPackages), 'UNUSED_CURRENT_PACKAGES', 'absent audit refuses ignored packages');

    const invalidRoot = path.join(tempRoot, 'invalid-ledger');
    fs.cpSync(pending.root, invalidRoot, { recursive: true });
    const invalidOptions = Object.assign(copy(pendingOptions), { stateRoot: invalidRoot });
    const invalidProposalPath = path.join(invalidRoot, Ledger.NAMESPACE, 'proposals', '000000000001.json');
    fs.writeFileSync(invalidProposalPath, '{"truncated":true}\n', 'utf8');
    const invalidAudit = audit(Fixture.auditInput('pin-history-audit:invalid', '2026-08-20T16:34:30.000Z', settledCheckpoint, invalidOptions, []));
    equal(invalidAudit.classification, 'OBSERVED_LEDGER_OR_CONFIGURATION_INVALID', 'corrupt namespace is typed invalid');
    equal(invalidAudit.current.errorCode, 'PIN_LEDGER_PROPOSAL_CORRUPT', 'invalid audit retains bounded typed error code');
    equal(invalidAudit.current.historyDigest, null, 'invalid audit claims no verified history');
    equal(invalidAudit.truth.transientV25OperationLockMayBeWritten, true, 'invalid namespace inspection may write the transient lock');
    const invalidWithPackages = Fixture.auditInput('pin-history-audit:invalid-packages', '2026-08-20T16:34:31.000Z', settledCheckpoint, invalidOptions, settledRecords);
    expectCode(() => Checkpoint.auditCheckpoint(invalidWithPackages), 'UNUSED_CURRENT_PACKAGES', 'invalid audit refuses ignored packages');
    const malformedOptions = copy(absentOptions); malformedOptions.stateRoot = path.parse(absentRoot).root;
    expectCode(() => Checkpoint.auditCheckpoint(Fixture.auditInput('pin-history-audit:bad-config', '2026-08-20T16:34:40.000Z', settledCheckpoint, malformedOptions, [])), 'INVALID_LEDGER_CONFIGURATION', 'unconstructable configuration yields no invalid-ledger receipt');

    const badProposalRecord = copy(settledRecords);
    badProposalRecord[0].proposal.receipt.proposalDigest = 'sha256:' + '0'.repeat(64);
    expectCode(() => Checkpoint.createCheckpoint(Fixture.checkpointInput('pin-history-checkpoint:bad-proposal', '2026-08-20T16:34:50.000Z', pendingOptions, badProposalRecord)), 'PROPOSAL_PACKAGE_INVALID', 'tampered proposal package fails closed');
    const badSettlementRecord = copy(settledRecords);
    badSettlementRecord[0].settlement.receipt.settlementDigest = 'sha256:' + '0'.repeat(64);
    expectCode(() => Checkpoint.createCheckpoint(Fixture.checkpointInput('pin-history-checkpoint:bad-settlement', '2026-08-20T16:34:50.000Z', pendingOptions, badSettlementRecord)), 'SETTLEMENT_PACKAGE_INVALID', 'tampered settlement package fails closed');
    const missingSettlementRecord = copy(settledRecords); missingSettlementRecord[0].settlement = null;
    expectCode(() => Checkpoint.createCheckpoint(Fixture.checkpointInput('pin-history-checkpoint:missing-settlement', '2026-08-20T16:34:50.000Z', pendingOptions, missingSettlementRecord)), 'SETTLEMENT_PACKAGE_MISSING', 'missing persisted settlement package fails closed');
    const extraSettlementRecord = copy(pendingRecords); extraSettlementRecord[0].settlement = copy(settledRecords[0].settlement);
    expectCode(() => Checkpoint.createCheckpoint(Fixture.checkpointInput('pin-history-checkpoint:extra-settlement', '2026-08-20T16:34:50.000Z', rollbackOptions, extraSettlementRecord)), 'UNPERSISTED_SETTLEMENT_PACKAGE', 'unpersisted settlement package fails closed');
    expectCode(() => Checkpoint.createCheckpoint(Fixture.checkpointInput('pin-history-checkpoint:early', '2026-08-20T16:32:59.999Z', pendingOptions, settledRecords)), 'INVALID_INPUT', 'checkpoint time cannot predate latest settlement');
    expectCode(() => Checkpoint.auditCheckpoint(Fixture.auditInput('pin-history-audit:early', '2026-08-20T16:33:19.999Z', settledCheckpoint, pendingOptions, settledRecords)), 'INVALID_INPUT', 'audit time cannot predate checkpoint');
    const unknownCheckpointInput = copy(settledCheckpointInput); unknownCheckpointInput.unexpected = true;
    expectCode(() => Checkpoint.createCheckpoint(unknownCheckpointInput), 'INVALID_INPUT', 'checkpoint input rejects unknown fields');

    const badDerivedHead = copy(settledCheckpoint);
    badDerivedHead.state.currentSettledPinRef = copy(badDerivedHead.genesisPinRef);
    expectCode(() => Checkpoint.validateCheckpoint(redigestCheckpoint(badDerivedHead)), 'INVALID_CHECKPOINT', 'checkpoint validator recomputes derived settled head');
    const badHistoryDigest = copy(settledCheckpoint); badHistoryDigest.history.historyDigest = 'sha256:' + '0'.repeat(64);
    expectCode(() => Checkpoint.validateCheckpoint(redigestCheckpoint(badHistoryDigest)), 'INVALID_CHECKPOINT', 'checkpoint validator recomputes full history digest');
    const badTruth = copy(settledCheckpoint); badTruth.truth.checkpointExternalRetentionProven = true;
    expectCode(() => Checkpoint.validateCheckpoint(redigestCheckpoint(badTruth)), 'INVALID_CHECKPOINT', 'checkpoint validator rejects inflated truth');
    const unknownCheckpoint = copy(settledCheckpoint); unknownCheckpoint.unexpected = true;
    expectCode(() => Checkpoint.validateCheckpoint(redigestCheckpoint(unknownCheckpoint)), 'INVALID_CHECKPOINT', 'checkpoint validator rejects unknown fields');
    const tamperedAudit = copy(exactSettled); tamperedAudit.classification = 'FORWARD_HISTORY_EXTENSION';
    expectCode(() => Checkpoint.validateAudit(redigestAudit(tamperedAudit)), 'INVALID_AUDIT', 'audit validator rejects classification and comparison mismatch');
    const inflatedAudit = copy(rollbackAudit); inflatedAudit.truth.deletionOrRollbackPrevented = true;
    expectCode(() => Checkpoint.validateAudit(redigestAudit(inflatedAudit)), 'INVALID_AUDIT', 'audit validator rejects inflated prevention truth');
    const oversizedCheckpoint = { schema: Checkpoint.CHECKPOINT_SCHEMA, padding: 'x'.repeat(Checkpoint.MAX_CHECKPOINT_CANONICAL_BYTES + 1) };
    expectCode(() => Checkpoint.validateCheckpoint(oversizedCheckpoint), 'INVALID_CHECKPOINT', 'oversized checkpoint fails before structural validation');
    const oversizedAudit = { schema: Checkpoint.AUDIT_SCHEMA, padding: 'x'.repeat(Checkpoint.MAX_AUDIT_CANONICAL_BYTES + 1) };
    expectCode(() => Checkpoint.validateAudit(oversizedAudit), 'INVALID_AUDIT', 'oversized audit fails before structural validation');

    const publicArtifacts = JSON.stringify({ pendingCheckpoint, pendingExact, settledCheckpoint, rollbackAudit, replacementAudit, identityAudit, absentAudit, invalidAudit });
    equal(publicArtifacts.includes('BEGIN PUBLIC KEY'), false, 'public artifacts contain no raw public key');
    equal(publicArtifacts.includes(fixture.previousPackage.anchoredInput.policyAuthorizations[0].signature), false, 'public artifacts contain no raw upstream signature');
    equal(publicArtifacts.includes(pending.root), false, 'public artifacts contain no configured path');
    equal(publicArtifacts.includes('PRIVATE KEY'), false, 'public artifacts contain no private key material');
    equal(publicArtifacts.includes(JSON.stringify(pending.proposalInput)), false, 'public artifacts omit raw proposal input package');
    equal(publicArtifacts.includes(JSON.stringify(settled.record)), false, 'public artifacts omit deduplicated record package');
    equal(rollbackAudit.truth.providerInvoked, false, 'audit claims no provider invocation');
    equal(rollbackAudit.truth.experimentExecuted, false, 'audit claims no experiment execution');
    equal(rollbackAudit.truth.evaluationPerformed, false, 'audit claims no evaluation');
    equal(rollbackAudit.truth.humanBenefitProven, false, 'audit claims no human benefit');
    equal(rollbackAudit.truth.broadLearningClaimed, false, 'audit claims no broad learning');
    equal(rollbackAudit.truth.automaticCanon, false, 'audit claims no automatic CANON');

    const checkpointSchema = JSON.parse(fs.readFileSync(path.join(__dirname, 'checkpoint.schema.json'), 'utf8'));
    const auditSchema = JSON.parse(fs.readFileSync(path.join(__dirname, 'audit.schema.json'), 'utf8'));
    equal(checkpointSchema.additionalProperties, false, 'checkpoint schema closes unknown top-level fields');
    equal(checkpointSchema.properties.truth.$ref, '#/$defs/truth', 'checkpoint schema routes truth to exact definition');
    equal(checkpointSchema.$defs.truth.const, pendingCheckpoint.truth, 'checkpoint truth schema exactly matches runtime');
    equal(checkpointSchema.$defs.history.required, ['proposalRefs', 'settlementRefs', 'settledPinRefs', 'historyDigest'], 'checkpoint schema requires all history sequences');
    equal(auditSchema.additionalProperties, false, 'audit schema closes unknown top-level fields');
    equal(auditSchema.properties.classification.enum, Checkpoint.CLASSIFICATIONS, 'audit schema classification enum matches runtime');
    equal(auditSchema.$defs.truth.additionalProperties, false, 'audit truth schema closes unknown fields');
    equal(auditSchema.$defs.decision.properties.autonomousActionCount.const, 0, 'audit schema prevents autonomous action');
    const contract = JSON.parse(fs.readFileSync(path.join(__dirname, 'module.contract.json'), 'utf8'));
    equal(ContractVerifier.validateContract(contract).pass, true, 'module contract matches Workshop contract shape');
    equal(contract.version, 'v2.6', 'contract version is exact');
    equal(contract.status, 'TEST', 'contract remains TEST');
    equal(contract.lifecycle.installed, false, 'module remains uninstalled');
    equal(contract.lifecycle.promoted, false, 'module remains unpromoted');
    equal(contract.merge_gate, 'Mike Tobi / AXM', 'Mike Tobi remains merge gate');
    equal(contract.provides.filter(value => value.startsWith('model.shadow.portable-pin-settlement-history-checkpoint.')).length, 24, 'contract provides exactly twenty-four bounded v2.6 capabilities');
    check(contract.boundaries.writes.some(value => value.includes('transient operation lock')), 'contract declares composed transient lock write');
    check(contract.boundaries.refuses.includes('joint-checkpoint-and-root-replacement-as-original-continuity'), 'contract preserves joint replacement counterexample');
    check(contract.boundaries.refuses.includes('equal-bracketing-reads-as-atomic-filesystem-snapshot'), 'contract refuses atomic snapshot inference');

    const implementation = fs.readFileSync(path.join(__dirname, 'model-shadow-portable-pin-settlement-history-checkpoint.js'), 'utf8');
    check(implementation.includes("require('../model-shadow-history-checkpoint-pin-settlement-ledger/"), 'runtime composes exact v2.5 module');
    check(implementation.includes('verifyProposalPersisted('), 'runtime exact-verifies persisted proposals');
    check(implementation.includes('verifySettlementPersisted('), 'runtime exact-verifies reconstructed settlement packages');
    check(implementation.includes('settledPinRefs'), 'runtime commits settled-pin sequence');
    equal(implementation.includes("require('fs')"), false, 'runtime imports no filesystem API');
    equal(implementation.includes('writeFile'), false, 'v2.6 runtime contains no direct file write');
    equal(implementation.includes('fetch('), false, 'runtime contains no network fetch');
    equal(implementation.includes('crypto.sign'), false, 'runtime creates no signature');
    equal(implementation.includes('createPrivateKey'), false, 'runtime accepts no private key API');
    equal(Array.from(observedClassifications).sort(), Checkpoint.CLASSIFICATIONS.slice().sort(), 'focused suite observes every closed v2.6 classification');
  } finally {
    verifiedRemove(tempRoot, os.tmpdir());
    equal(fs.existsSync(tempRoot), false, 'temporary test root is removed after bounded cleanup');
  }
  console.log('RESULT ' + checks + ' focused assertions passed');
}

main();
