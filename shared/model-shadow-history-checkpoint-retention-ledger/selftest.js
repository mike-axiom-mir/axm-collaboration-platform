#!/usr/bin/env node
'use strict';

const assert = require('assert');
const childProcess = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const ContractVerifier = require('../../hub/module-contract-verifier');
const V25 = require('../model-shadow-history-checkpoint-pin-settlement-ledger/model-shadow-history-checkpoint-pin-settlement-ledger');
const V25Fixture = require('../model-shadow-history-checkpoint-pin-settlement-ledger/selftest-fixture');
const V26 = require('../model-shadow-portable-pin-settlement-history-checkpoint/model-shadow-portable-pin-settlement-history-checkpoint');
const V26Fixture = require('../model-shadow-portable-pin-settlement-history-checkpoint/selftest-fixture');
const Ledger = require('./model-shadow-history-checkpoint-retention-ledger');
const Fixture = require('./selftest-fixture');

let checks = 0;
function check(value, label) { assert.ok(value, label); checks += 1; console.log('PASS ' + label); }
function equal(actual, expected, label) { assert.deepStrictEqual(actual, expected, label); checks += 1; console.log('PASS ' + label); }
function copy(value) { return JSON.parse(JSON.stringify(value)); }
function expectCode(action, code, label) {
  let caught = null;
  try { action(); } catch (error) { caught = error; }
  check(caught instanceof Ledger.HistoryCheckpointRetentionLedgerError, label + ' returns typed v2.7 error');
  equal(caught.code, code, label);
}
function treeDigest(root) {
  const entries = [];
  function walk(current, relative) {
    fs.readdirSync(current, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name)).forEach(entry => {
      const absolute = path.join(current, entry.name);
      const child = relative ? relative + '/' + entry.name : entry.name;
      if (entry.isDirectory()) { entries.push({ path: child, type: 'directory' }); walk(absolute, child); }
      else entries.push({ path: child, type: 'file', sha256: crypto.createHash('sha256').update(fs.readFileSync(absolute)).digest('hex') });
    });
  }
  walk(root, '');
  return crypto.createHash('sha256').update(JSON.stringify(entries)).digest('hex');
}
function writePackage(parent, name, value) {
  const target = path.join(parent, name + '.json');
  fs.writeFileSync(target, JSON.stringify(value), { encoding: 'utf8', mode: 0o600 });
  return target;
}
function runChild(packagePath) {
  const result = childProcess.spawnSync(process.execPath, [path.join(__dirname, 'selftest-child.js'), packagePath], {
    encoding: 'utf8', windowsHide: true, maxBuffer: 384 * 1024 * 1024
  });
  return { status: result.status, value: JSON.parse(result.stdout || '{}'), stderr: result.stderr };
}
function runChildren(packagePaths) {
  return Promise.all(packagePaths.map(packagePath => new Promise(resolve => {
    const child = childProcess.spawn(process.execPath, [path.join(__dirname, 'selftest-child.js'), packagePath], {
      windowsHide: true, stdio: ['ignore', 'pipe', 'pipe']
    });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', chunk => { stdout += chunk; });
    child.stderr.on('data', chunk => { stderr += chunk; });
    child.on('close', code => resolve({ status: code, value: JSON.parse(stdout || '{}'), stderr }));
  })));
}
function verifiedRemove(target, parent) {
  const resolvedTarget = path.resolve(target);
  const resolvedParent = path.resolve(parent);
  if (resolvedTarget === resolvedParent || !resolvedTarget.startsWith(resolvedParent + path.sep)) throw new Error('unsafe cleanup target');
  fs.rmSync(resolvedTarget, { recursive: true, force: true });
}
function retentionNamespace(root) { return path.join(root, Ledger.NAMESPACE); }
function proposalFile(root, sequence) { return path.join(retentionNamespace(root), 'proposals', String(sequence).padStart(12, '0') + '.json'); }
function settlementFile(root, sequence) { return path.join(retentionNamespace(root), 'settlements', String(sequence).padStart(12, '0') + '.json'); }
function rewriteCanonical(filePath, transform) {
  const value = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  transform(value);
  fs.writeFileSync(filePath, Ledger.stableStringify(value) + '\n', 'utf8');
}

async function main() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'axm-v27-checkpoint-retention-'));
  try {
    const fixture = Fixture.build(Fixture.makeDir(tempRoot, 'fixture'));
    equal(Ledger.VERSION, '2.7.0', 'version is exact');
    equal(Ledger.STATUS, 'TEST', 'status remains TEST');
    equal(Ledger.MAX_RECORDS, 10000, 'record count is bounded');
    equal(Ledger.MAX_ARTIFACT_CANONICAL_BYTES, 20971520, 'artifact bound is 20 MiB');
    equal(Ledger.MAX_AGGREGATE_STORAGE_BYTES, 268435456, 'aggregate retention bound is 256 MiB');
    equal(Ledger.MAX_PROPOSAL_INPUT_CANONICAL_BYTES, 335544320, 'proposal input bound is 320 MiB');
    equal(Ledger.MAX_AUDIT_CANONICAL_BYTES, 2097152, 'audit artifact bound is two MiB');

    const source = V26Fixture.buildPending(tempRoot, fixture, 'source-primary', 'A', 'v27-source-history', 'v27-source-a');
    const pendingRecords = [copy(source.record)];
    const pendingCheckpointInput = V26Fixture.checkpointInput(
      'v27-checkpoint:pending-a', '2026-08-20T16:32:30.000Z', source.serviceOptions, pendingRecords
    );
    const pendingCheckpoint = V26.createCheckpoint(copy(pendingCheckpointInput));
    const rollbackRoot = path.join(tempRoot, 'source-rollback-copy');
    fs.cpSync(source.root, rollbackRoot, { recursive: true });
    const rollbackOptions = Object.assign(copy(source.serviceOptions), { stateRoot: rollbackRoot });

    const retentionRoot = Fixture.makeDir(tempRoot, 'retention-primary');
    const serviceOptions = Fixture.serviceOptions(retentionRoot, 'v27-retention-log');
    const service = Ledger.createService(copy(serviceOptions));
    equal(service.inspect(), null, 'absent retention namespace inspects as null without creation');
    equal(fs.existsSync(retentionNamespace(retentionRoot)), false, 'read-only absent inspect creates no namespace');

    const sourceBeforeInitialProposal = treeDigest(source.root);
    const initialInput = Fixture.proposalInput(
      'v27-retention-proposal:initial', '2026-08-20T16:32:40.000Z', pendingCheckpointInput, pendingCheckpoint
    );
    const initialProposal = service.propose(copy(initialInput));
    equal(treeDigest(source.root), sourceBeforeInitialProposal, 'initial retention proposal leaves durable source bytes unchanged');
    equal(initialProposal.schema, Ledger.PROPOSAL_SCHEMA, 'initial proposal schema is exact');
    equal(initialProposal.classification, Ledger.INITIAL_CLASSIFICATION, 'first proposal is typed initial capture');
    equal(initialProposal.checkpoint, pendingCheckpoint, 'proposal durably embeds full exact v2.6 checkpoint');
    equal(initialProposal.previousSettledCheckpointRef, null, 'initial proposal has no invented prior head');
    equal(initialProposal.log.sequence, 1, 'initial proposal sequence is one');
    equal(initialProposal.truth.v26CheckpointOriginExactRebuiltBeforeWrite, true, 'proposal records exact v2.6 origin rebuild');
    equal(initialProposal.truth.retentionRootDistinctAndNonnestedFromSourceRoot, true, 'proposal records root separation');
    equal(initialProposal.truth.localProposalExclusiveCreateAndFileFsyncCompleted, true, 'proposal records local exclusive create and file fsync');
    equal(initialProposal.truth.externalRetentionProven, false, 'local proposal claims no external retention');
    equal(initialProposal.truth.protectedMonotonicStateProven, false, 'local proposal claims no protected state');
    equal(initialProposal.truth.executionAuthorized, false, 'proposal authorizes no execution');
    equal(initialProposal.decision.localSettledRetentionHeadAdvanced, false, 'proposal does not advance settled retention head');
    check(fs.existsSync(proposalFile(retentionRoot, 1)), 'initial proposal file exists');
    equal(fs.readFileSync(proposalFile(retentionRoot, 1), 'utf8'), Ledger.stableStringify(initialProposal) + '\n', 'proposal file is exact canonical JSON');

    const pendingSnapshot = service.inspect();
    equal(pendingSnapshot.proposalCount, 1, 'pending snapshot counts one proposal');
    equal(pendingSnapshot.settlementCount, 0, 'pending snapshot counts no settlement');
    equal(pendingSnapshot.currentSettledCheckpointRef, null, 'pending snapshot has no settled head');
    equal(pendingSnapshot.latestPersistedCheckpointRef, { id: pendingCheckpoint.checkpointId, schema: pendingCheckpoint.schema, sha256: pendingCheckpoint.checkpointDigest }, 'pending snapshot derives latest persisted checkpoint');
    equal(pendingSnapshot.latestPersistedStatus, 'PENDING', 'pending snapshot distinguishes observation status');
    equal(pendingSnapshot.truth.latestPersistedObservationDerivedFromProposals, true, 'snapshot derives latest observation from proposal chain');
    equal(pendingSnapshot.truth.currentSettledRetentionHeadDerivedOnlyFromSettlements, true, 'snapshot derives settled head only from settlements');

    const sourceBeforePendingAudit = treeDigest(source.root);
    const pendingAuditInput = Fixture.auditInput(
      'v27-retention-audit:pending-exact', '2026-08-20T16:32:45.000Z', source.serviceOptions, pendingRecords
    );
    const pendingAudit = service.auditLatest(copy(pendingAuditInput));
    equal(treeDigest(source.root), sourceBeforePendingAudit, 'pending audit leaves durable source bytes unchanged');
    equal(pendingAudit.schema, Ledger.AUDIT_SCHEMA, 'retention audit schema is exact');
    equal(pendingAudit.classification, 'EXACT_HISTORY_MATCH', 'pending retained observation audits exact current history');
    equal(pendingAudit.retention.selectionStatus, 'PENDING', 'audit binds pending observation status');
    equal(pendingAudit.retention.settlementRef, null, 'pending audit invents no settlement reference');
    equal(pendingAudit.upstreamAudit.checkpointRef, pendingAudit.retention.checkpointRef, 'retention audit binds exact upstream checkpoint');
    equal(pendingAudit.truth.latestPersistedCheckpointSelectedWithoutCallerCheckpointPresentation, true, 'audit selects stored checkpoint without checkpoint input');
    equal(pendingAudit.truth.pendingObservationGrantsSettledAuthority, false, 'pending observation grants no settled authority');
    equal(pendingAudit.truth.externalRetentionProven, false, 'audit claims no external retention');
    equal(Ledger.validateAudit(pendingAudit), pendingAudit, 'pending retention audit self-validates');
    equal(service.verifyAudit(pendingAuditInput, pendingAudit).pass, true, 'pending retention audit exact-rebuilds');

    expectCode(
      () => service.propose(copy(initialInput)),
      'RETENTION_SETTLEMENT_PENDING',
      'second proposal is blocked while initial proposal is pending'
    );
    const wrongSettleConfirmation = Fixture.settlementInput(
      'v27-retention-settlement:initial-wrong', '2026-08-20T16:32:50.000Z', initialInput, initialProposal
    );
    wrongSettleConfirmation.confirmation = 'NOT_CONFIRMED';
    expectCode(() => service.settle(wrongSettleConfirmation), 'RETENTION_SETTLEMENT_CONFIRMATION_REQUIRED', 'settlement requires exact separate confirmation');
    const earlySettlement = Fixture.settlementInput(
      'v27-retention-settlement:initial-early', '2026-08-20T16:32:39.999Z', initialInput, initialProposal
    );
    expectCode(() => service.settle(earlySettlement), 'RETENTION_SETTLEMENT_TIME_INVALID', 'settlement cannot predate proposal');

    const sourceBeforeInitialSettlement = treeDigest(source.root);
    const initialSettlementInput = Fixture.settlementInput(
      'v27-retention-settlement:initial', '2026-08-20T16:32:50.000Z', initialInput, initialProposal
    );
    const initialSettlement = service.settle(copy(initialSettlementInput));
    equal(treeDigest(source.root), sourceBeforeInitialSettlement, 'retention settlement leaves durable source bytes unchanged');
    equal(initialSettlement.schema, Ledger.SETTLEMENT_SCHEMA, 'retention settlement schema is exact');
    equal(initialSettlement.classification, Ledger.SETTLEMENT_CLASSIFICATION, 'retention settlement classification is exact');
    equal(initialSettlement.settledCheckpointRef, pendingAudit.retention.checkpointRef, 'settlement advances to exact checkpoint reference');
    equal(initialSettlement.truth.pendingProposalExactRebuiltFromCallerPackageAndStoredReceipt, true, 'settlement exact-rebuilds proposal package');
    equal(initialSettlement.truth.checkpointOriginReauthenticatedAtSettlement, true, 'settlement reauthenticates checkpoint origin');
    equal(initialSettlement.truth.actualHumanParticipationProven, false, 'settlement confirmation proves no human');
    check(fs.existsSync(settlementFile(retentionRoot, 1)), 'initial settlement file exists');
    const settledInitialSnapshot = service.inspect();
    equal(settledInitialSnapshot.latestPersistedStatus, 'SETTLED', 'snapshot records settled latest observation');
    equal(settledInitialSnapshot.currentSettledCheckpointRef, settledInitialSnapshot.latestPersistedCheckpointRef, 'settled head equals latest checkpoint after settlement');
    equal(settledInitialSnapshot.pendingProposalRef, null, 'settled snapshot has no pending proposal');
    equal(service.verifyProposalPersisted(initialInput, initialProposal).pass, true, 'initial proposal exact-verifies while origin is unchanged');
    equal(service.verifySettlementPersisted(initialSettlementInput, initialSettlement).pass, true, 'initial settlement exact-verifies while origin is unchanged');

    const replayInput = Fixture.proposalInput(
      'v27-retention-proposal:replay', '2026-08-20T16:32:55.000Z', pendingCheckpointInput, pendingCheckpoint
    );
    expectCode(() => service.propose(replayInput), 'RETENTION_CHECKPOINT_REPLAY', 'same-history checkpoint replay is refused');
    equal(service.inspect().proposalCount, 1, 'replay refusal creates no proposal');

    const sourceSettlement = V26Fixture.settle(source, 'v27-source-a', '2026-08-20T16:33:00.000Z');
    const settledRecords = [copy(sourceSettlement.record)];
    const settledCheckpointInput = V26Fixture.checkpointInput(
      'v27-checkpoint:settled-a', '2026-08-20T16:33:20.000Z', source.serviceOptions, settledRecords
    );
    const settledCheckpoint = V26.createCheckpoint(copy(settledCheckpointInput));
    equal(V26.checkpointRelation, undefined, 'v2.7 does not depend on an undeclared v2.6 relation export');
    equal(Ledger.checkpointRelation, undefined, 'internal checkpoint relation classifier is not exported');

    const sourceBeforeForwardProposal = treeDigest(source.root);
    const forwardInput = Fixture.proposalInput(
      'v27-retention-proposal:forward', '2026-08-20T16:33:30.000Z', settledCheckpointInput, settledCheckpoint
    );
    const forwardProposal = service.propose(copy(forwardInput));
    equal(treeDigest(source.root), sourceBeforeForwardProposal, 'forward proposal leaves durable source bytes unchanged');
    equal(forwardProposal.classification, 'FORWARD_HISTORY_EXTENSION', 'second proposal is strict forward extension');
    equal(forwardProposal.log.sequence, 2, 'forward proposal sequence is two');
    equal(forwardProposal.log.previousProposalRef, { id: initialProposal.proposalId, schema: initialProposal.schema, sha256: initialProposal.proposalDigest }, 'forward proposal chains previous proposal');
    equal(forwardProposal.previousSettledCheckpointRef, initialSettlement.settledCheckpointRef, 'forward proposal starts at settled retention head');
    equal(forwardProposal.truth.forwardFromSettledRetentionHead, true, 'forward proposal truth is classification-bound');
    const pendingForwardSnapshot = service.inspect();
    equal(pendingForwardSnapshot.proposalCount, 2, 'forward snapshot counts two proposals');
    equal(pendingForwardSnapshot.settlementCount, 1, 'forward snapshot leaves second proposal pending');
    equal(pendingForwardSnapshot.currentSettledCheckpointRef, initialSettlement.settledCheckpointRef, 'pending forward proposal does not advance settled head');
    equal(pendingForwardSnapshot.latestPersistedCheckpointRef, { id: settledCheckpoint.checkpointId, schema: settledCheckpoint.schema, sha256: settledCheckpoint.checkpointDigest }, 'snapshot selects latest persisted forward checkpoint');
    equal(pendingForwardSnapshot.latestPersistedStatus, 'PENDING', 'latest forward observation is pending');

    const pendingForwardAuditInput = Fixture.auditInput(
      'v27-retention-audit:pending-forward-exact', '2026-08-20T16:33:40.000Z', source.serviceOptions, settledRecords
    );
    const pendingForwardAudit = service.auditLatest(copy(pendingForwardAuditInput));
    equal(pendingForwardAudit.classification, 'EXACT_HISTORY_MATCH', 'latest persisted forward checkpoint audits exact source');
    equal(pendingForwardAudit.retention.selectionStatus, 'PENDING', 'latest persisted audit remains pending');
    equal(pendingForwardAudit.retention.sequence, 2, 'audit binds latest proposal sequence');

    const rollbackAuditInput = Fixture.auditInput(
      'v27-retention-audit:rollback', '2026-08-20T16:33:50.000Z', rollbackOptions, pendingRecords
    );
    const rollbackAudit = service.auditLatest(copy(rollbackAuditInput));
    equal(rollbackAudit.classification, 'OBSERVED_STRICT_HISTORY_ROLLBACK_RELATIVE_TO_PRESENTED_CHECKPOINT', 'stored checkpoint exposes strict source rollback');
    equal(rollbackAudit.truth.sourceRollbackObserved, true, 'rollback truth is classification-bound');
    equal(rollbackAudit.decision.holdRequired, true, 'rollback audit requires hold');
    equal(rollbackAudit.truth.deletionOrRollbackPrevented, false, 'observed rollback claims no prevention');

    const absentRoot = Fixture.makeDir(tempRoot, 'source-absent');
    const absentOptions = V26Fixture.options(absentRoot, fixture, 'v27-source-history');
    const absentAudit = service.auditLatest(Fixture.auditInput(
      'v27-retention-audit:absent', '2026-08-20T16:34:00.000Z', absentOptions, []
    ));
    equal(absentAudit.classification, 'OBSERVED_LEDGER_ABSENT', 'stored checkpoint exposes absent source namespace');
    equal(absentAudit.truth.sourceAbsenceObserved, true, 'absence truth is classification-bound');
    equal(absentAudit.upstreamAudit.truth.absenceCauseProven, false, 'absence invents no deletion cause');
    equal(fs.existsSync(path.join(absentRoot, V25.NAMESPACE)), false, 'absent audit creates no source namespace');

    const mismatchedForwardSettlement = Fixture.settlementInput(
      'v27-retention-settlement:forward-bad', '2026-08-20T16:34:10.000Z', forwardInput, forwardProposal
    );
    mismatchedForwardSettlement.proposalReceipt.proposalDigest = 'sha256:' + '0'.repeat(64);
    expectCode(() => service.settle(mismatchedForwardSettlement), 'RETENTION_PROPOSAL_PACKAGE_MISMATCH', 'settlement refuses tampered proposal receipt');
    const sourceBeforeForwardSettlement = treeDigest(source.root);
    const forwardSettlementInput = Fixture.settlementInput(
      'v27-retention-settlement:forward', '2026-08-20T16:34:10.000Z', forwardInput, forwardProposal
    );
    const forwardSettlement = service.settle(copy(forwardSettlementInput));
    equal(treeDigest(source.root), sourceBeforeForwardSettlement, 'forward retention settlement leaves durable source bytes unchanged');
    equal(forwardSettlement.settledCheckpointRef, { id: settledCheckpoint.checkpointId, schema: settledCheckpoint.schema, sha256: settledCheckpoint.checkpointDigest }, 'forward settlement advances retained head');
    const finalSnapshot = service.inspect();
    equal(finalSnapshot.proposalCount, 2, 'final snapshot counts both proposals');
    equal(finalSnapshot.settlementCount, 2, 'final snapshot counts both settlements');
    equal(finalSnapshot.latestPersistedStatus, 'SETTLED', 'final latest observation is settled');
    equal(finalSnapshot.currentSettledCheckpointRef, forwardSettlement.settledCheckpointRef, 'final settled head is derived from second settlement');
    equal(finalSnapshot.pendingProposalRef, null, 'final snapshot has no pending proposal');

    const settledAuditInput = Fixture.auditInput(
      'v27-retention-audit:settled-exact', '2026-08-20T16:34:20.000Z', source.serviceOptions, settledRecords
    );
    const settledAudit = service.auditLatest(copy(settledAuditInput));
    equal(settledAudit.classification, 'EXACT_HISTORY_MATCH', 'settled latest checkpoint audits exact source');
    equal(settledAudit.retention.selectionStatus, 'SETTLED', 'settled audit selection is exact');
    equal(settledAudit.retention.settlementRef, { id: forwardSettlement.settlementId, schema: forwardSettlement.schema, sha256: forwardSettlement.settlementDigest }, 'settled audit binds settlement reference');
    equal(settledAudit.truth.latestPersistedCheckpointSettled, true, 'settled audit truth is status-bound');
    equal(settledAudit.truth.retainedCheckpointOriginReauthenticatedAtAudit, false, 'audit does not reauthenticate stored checkpoint origin');
    equal(settledAudit.truth.auditReceiptPersistedByModule, false, 'audit receipt is not persisted');
    equal(Ledger.validateAudit(settledAudit), settledAudit, 'settled audit self-validates');
    equal(service.verifyAudit(settledAuditInput, settledAudit).pass, true, 'settled audit exact-rebuilds');

    const rollbackCheckpointInput = V26Fixture.checkpointInput(
      'v27-checkpoint:rollback-candidate', '2026-08-20T16:34:21.000Z', rollbackOptions, pendingRecords
    );
    const rollbackCheckpoint = V26.createCheckpoint(copy(rollbackCheckpointInput));
    const rollbackProposalInput = Fixture.proposalInput(
      'v27-retention-proposal:rollback', '2026-08-20T16:34:30.000Z', rollbackCheckpointInput, rollbackCheckpoint
    );
    expectCode(() => service.propose(rollbackProposalInput), 'RETENTION_CHECKPOINT_ROLLBACK', 'strict rollback checkpoint proposal is refused');

    const fork = V26Fixture.buildPending(tempRoot, fixture, 'source-fork-b', 'B', 'v27-source-history', 'v27-source-b');
    const forkRecords = [copy(fork.record)];
    const forkCheckpointInput = V26Fixture.checkpointInput(
      'v27-checkpoint:fork-b', '2026-08-20T16:34:21.000Z', fork.serviceOptions, forkRecords
    );
    const forkCheckpoint = V26.createCheckpoint(copy(forkCheckpointInput));
    const forkProposalInput = Fixture.proposalInput(
      'v27-retention-proposal:fork-b', '2026-08-20T16:34:31.000Z', forkCheckpointInput, forkCheckpoint
    );
    expectCode(() => service.propose(forkProposalInput), 'RETENTION_CHECKPOINT_REPLACEMENT_OR_FORK', 'fork checkpoint proposal is refused');

    const identity = V26Fixture.buildPending(tempRoot, fixture, 'source-identity', 'A', 'v27-other-history', 'v27-source-identity');
    const identityRecords = [copy(identity.record)];
    const identityCheckpointInput = V26Fixture.checkpointInput(
      'v27-checkpoint:identity', '2026-08-20T16:34:21.000Z', identity.serviceOptions, identityRecords
    );
    const identityCheckpoint = V26.createCheckpoint(copy(identityCheckpointInput));
    const identityProposalInput = Fixture.proposalInput(
      'v27-retention-proposal:identity', '2026-08-20T16:34:32.000Z', identityCheckpointInput, identityCheckpoint
    );
    expectCode(() => service.propose(identityProposalInput), 'RETENTION_CHECKPOINT_IDENTITY_DRIFT', 'identity-drift checkpoint proposal is refused');
    const absentProposalCheckpointInput = V26Fixture.checkpointInput(
      'v27-checkpoint:absent-candidate', '2026-08-20T16:34:21.000Z', absentOptions, []
    );
    expectCode(
      () => service.propose(Fixture.proposalInput('v27-retention-proposal:absent', '2026-08-20T16:34:33.000Z', absentProposalCheckpointInput, settledCheckpoint)),
      'RETENTION_CHECKPOINT_ORIGIN_INVALID',
      'absent source cannot exact-rebuild a checkpoint proposal'
    );
    equal(service.inspect().proposalCount, 2, 'all non-forward refusals leave retained proposal count unchanged');

    const childInspectPath = writePackage(tempRoot, 'fresh-inspect', { action: 'inspect', serviceOptions });
    const childInspect = runChild(childInspectPath);
    equal(childInspect.status, 0, 'fresh inspect process exits normally');
    equal(childInspect.value.ok, true, 'fresh inspect process reports success');
    check(childInspect.value.pid !== process.pid, 'fresh inspect uses distinct process');
    equal(childInspect.value.result, finalSnapshot, 'fresh process reloads exact final snapshot');
    const childAuditPath = writePackage(tempRoot, 'fresh-audit', { action: 'audit', serviceOptions, input: settledAuditInput });
    const childAudit = runChild(childAuditPath);
    equal(childAudit.status, 0, 'fresh audit process exits normally');
    equal(childAudit.value.result, settledAudit, 'fresh process rebuilds exact settled audit');
    const childProposalPath = writePackage(tempRoot, 'fresh-verify-proposal', { action: 'verify-proposal', serviceOptions, input: forwardInput, receipt: forwardProposal });
    const childProposal = runChild(childProposalPath);
    equal(childProposal.status, 0, 'fresh proposal verification process exits normally');
    equal(childProposal.value.result.pass, true, 'fresh process exact-verifies persisted forward proposal');
    const childSettlementPath = writePackage(tempRoot, 'fresh-verify-settlement', { action: 'verify-settlement', serviceOptions, input: forwardSettlementInput, receipt: forwardSettlement });
    const childSettlement = runChild(childSettlementPath);
    equal(childSettlement.status, 0, 'fresh settlement verification process exits normally');
    equal(childSettlement.value.result.pass, true, 'fresh process exact-verifies persisted forward settlement');

    const overlapRoot = Fixture.makeDir(tempRoot, 'overlap-source');
    const overlap = V26Fixture.buildPending(overlapRoot, fixture, 'source', 'A', 'v27-overlap-history', 'v27-overlap-a');
    const overlapRecords = [copy(overlap.record)];
    const overlapCheckpointInput = V26Fixture.checkpointInput(
      'v27-checkpoint:overlap', '2026-08-20T16:32:30.000Z', overlap.serviceOptions, overlapRecords
    );
    const overlapCheckpoint = V26.createCheckpoint(copy(overlapCheckpointInput));
    const equalRootService = Ledger.createService(Fixture.serviceOptions(overlap.root, 'v27-overlap-retention'));
    expectCode(
      () => equalRootService.propose(Fixture.proposalInput('v27-overlap:equal', '2026-08-20T16:32:40.000Z', overlapCheckpointInput, overlapCheckpoint)),
      'RETENTION_ROOT_OVERLAP',
      'equal source and retention roots are refused before write'
    );
    equal(fs.existsSync(path.join(overlap.root, Ledger.NAMESPACE)), false, 'equal-root refusal creates no retention namespace');
    const nestedRetentionRoot = Fixture.makeDir(overlap.root, 'nested-retention-root');
    const nestedService = Ledger.createService(Fixture.serviceOptions(nestedRetentionRoot, 'v27-overlap-nested'));
    expectCode(
      () => nestedService.propose(Fixture.proposalInput('v27-overlap:nested', '2026-08-20T16:32:40.000Z', overlapCheckpointInput, overlapCheckpoint)),
      'RETENTION_ROOT_OVERLAP',
      'nested source and retention roots are refused before write'
    );
    equal(fs.existsSync(path.join(nestedRetentionRoot, Ledger.NAMESPACE)), false, 'nested-root refusal creates no retention namespace');
    expectCode(
      () => Ledger.createService({ stateRoot: path.parse(tempRoot).root, retentionLogId: 'v27-root', createdAt: '2026-08-20T16:31:30.000Z' }),
      'RETENTION_STATE_ROOT_INVALID',
      'filesystem root is refused as retention state root'
    );
    expectCode(
      () => Ledger.createService({ stateRoot: path.join(tempRoot, 'missing-root'), retentionLogId: 'v27-missing', createdAt: '2026-08-20T16:31:30.000Z' }),
      'RETENTION_STATE_ROOT_INVALID',
      'missing retention state root is refused'
    );

    const invalidSourceRoot = path.join(tempRoot, 'source-invalid');
    fs.cpSync(source.root, invalidSourceRoot, { recursive: true });
    const invalidSourceOptions = Object.assign(copy(source.serviceOptions), { stateRoot: invalidSourceRoot });
    fs.writeFileSync(path.join(invalidSourceRoot, V25.NAMESPACE, 'proposals', '000000000001.json'), '{"truncated":true}\n', 'utf8');
    const invalidSourceAudit = service.auditLatest(Fixture.auditInput(
      'v27-retention-audit:invalid-source', '2026-08-20T16:34:40.000Z', invalidSourceOptions, []
    ));
    equal(invalidSourceAudit.classification, 'OBSERVED_LEDGER_OR_CONFIGURATION_INVALID', 'retained checkpoint audit types invalid source');
    equal(invalidSourceAudit.upstreamAudit.current.errorCode, 'PIN_LEDGER_PROPOSAL_CORRUPT', 'invalid source audit retains bounded upstream error code');
    const invalidProposalCheckpointInput = V26Fixture.checkpointInput(
      'v27-checkpoint:invalid-candidate', '2026-08-20T16:34:21.000Z', invalidSourceOptions, []
    );
    expectCode(
      () => service.propose(Fixture.proposalInput('v27-retention-proposal:invalid', '2026-08-20T16:34:34.000Z', invalidProposalCheckpointInput, settledCheckpoint)),
      'RETENTION_CHECKPOINT_ORIGIN_INVALID',
      'invalid source cannot exact-rebuild a checkpoint proposal'
    );

    const movingSource = V26Fixture.buildPending(tempRoot, fixture, 'source-moving', 'A', 'v27-moving-history', 'v27-moving-a');
    const movingRecords = [copy(movingSource.record)];
    const movingCheckpointInput = V26Fixture.checkpointInput(
      'v27-checkpoint:moving', '2026-08-20T16:32:30.000Z', movingSource.serviceOptions, movingRecords
    );
    const movingCheckpoint = V26.createCheckpoint(copy(movingCheckpointInput));
    const movingRetentionRoot = Fixture.makeDir(tempRoot, 'retention-moving');
    const movingService = Ledger.createService(Fixture.serviceOptions(movingRetentionRoot, 'v27-retention-moving'));
    const originalVerifyCheckpointOrigin = V26.verifyCheckpointOrigin;
    let movementVerificationCalls = 0;
    V26.verifyCheckpointOrigin = function wrappedVerifyCheckpointOrigin(input, receipt) {
      const result = originalVerifyCheckpointOrigin(input, receipt);
      movementVerificationCalls += 1;
      if (movementVerificationCalls === 1) V26Fixture.settle(movingSource, 'v27-moving-a', '2026-08-20T16:33:00.000Z');
      return result;
    };
    try {
      expectCode(
        () => movingService.propose(Fixture.proposalInput('v27-retention-proposal:moving', '2026-08-20T16:33:10.000Z', movingCheckpointInput, movingCheckpoint)),
        'RETENTION_CHECKPOINT_ORIGIN_INVALID',
        'source movement between preflight and locked rebuild refuses proposal'
      );
    } finally { V26.verifyCheckpointOrigin = originalVerifyCheckpointOrigin; }
    equal(movementVerificationCalls, 2, 'movement adversary is observed by second origin verification');
    equal(movingService.inspect(), null, 'failed second origin verification leaves no admitted retention ledger');
    equal(fs.existsSync(path.join(retentionNamespace(movingRetentionRoot), 'ledger.json')), false, 'failed second origin verification writes no manifest');

    const concurrentSourceOne = path.join(tempRoot, 'concurrent-source-one');
    const concurrentSourceTwo = path.join(tempRoot, 'concurrent-source-two');
    fs.cpSync(rollbackRoot, concurrentSourceOne, { recursive: true });
    fs.cpSync(rollbackRoot, concurrentSourceTwo, { recursive: true });
    const concurrentOptionsOne = Object.assign(copy(rollbackOptions), { stateRoot: concurrentSourceOne });
    const concurrentOptionsTwo = Object.assign(copy(rollbackOptions), { stateRoot: concurrentSourceTwo });
    const concurrentCheckpointInputOne = V26Fixture.checkpointInput('v27-checkpoint:concurrent', '2026-08-20T16:32:30.000Z', concurrentOptionsOne, pendingRecords);
    const concurrentCheckpointInputTwo = V26Fixture.checkpointInput('v27-checkpoint:concurrent', '2026-08-20T16:32:30.000Z', concurrentOptionsTwo, pendingRecords);
    const concurrentCheckpointOne = V26.createCheckpoint(copy(concurrentCheckpointInputOne));
    const concurrentCheckpointTwo = V26.createCheckpoint(copy(concurrentCheckpointInputTwo));
    equal(concurrentCheckpointOne, concurrentCheckpointTwo, 'distinct source-root copies rebuild one path-free checkpoint');
    const concurrentRetentionRoot = Fixture.makeDir(tempRoot, 'retention-concurrent');
    const concurrentServiceOptions = Fixture.serviceOptions(concurrentRetentionRoot, 'v27-retention-concurrent');
    const concurrentPackageOne = writePackage(tempRoot, 'concurrent-propose-one', {
      action: 'propose', serviceOptions: concurrentServiceOptions,
      input: Fixture.proposalInput('v27-retention-proposal:concurrent-one', '2026-08-20T16:32:40.000Z', concurrentCheckpointInputOne, concurrentCheckpointOne)
    });
    const concurrentPackageTwo = writePackage(tempRoot, 'concurrent-propose-two', {
      action: 'propose', serviceOptions: concurrentServiceOptions,
      input: Fixture.proposalInput('v27-retention-proposal:concurrent-two', '2026-08-20T16:32:41.000Z', concurrentCheckpointInputTwo, concurrentCheckpointTwo)
    });
    const concurrentResults = await runChildren([concurrentPackageOne, concurrentPackageTwo]);
    equal(concurrentResults.filter(result => result.status === 0).length, 1, 'concurrent proposal race admits exactly one writer');
    equal(concurrentResults.filter(result => result.status !== 0).length, 1, 'concurrent proposal race rejects exactly one writer');
    check(['RETENTION_LEDGER_BUSY', 'RETENTION_SETTLEMENT_PENDING'].includes(concurrentResults.find(result => result.status !== 0).value.error.code), 'concurrent loser reports busy or pending typed boundary');
    const concurrentSnapshot = Ledger.createService(concurrentServiceOptions).inspect();
    equal(concurrentSnapshot.proposalCount, 1, 'concurrent retention ledger contains exactly one proposal');
    equal(concurrentSnapshot.settlementCount, 0, 'concurrent retention ledger contains no invented settlement');
    equal(concurrentSnapshot.latestPersistedStatus, 'PENDING', 'concurrent winner remains pending');

    const badAudit = copy(settledAudit);
    badAudit.truth.externalRetentionProven = true;
    badAudit.auditDigest = Ledger.sha256((() => { const value = copy(badAudit); delete value.auditDigest; return value; })());
    expectCode(() => Ledger.validateAudit(badAudit), 'INVALID_RETENTION_AUDIT', 'audit validator rejects inflated external-retention truth');
    const badSelectionAudit = copy(settledAudit);
    badSelectionAudit.retention.selectionStatus = 'PENDING';
    badSelectionAudit.auditDigest = Ledger.sha256((() => { const value = copy(badSelectionAudit); delete value.auditDigest; return value; })());
    expectCode(() => Ledger.validateAudit(badSelectionAudit), 'INVALID_RETENTION_AUDIT', 'audit validator rejects selection and settlement mismatch');
    const unknownAudit = copy(settledAudit);
    unknownAudit.unexpected = true;
    unknownAudit.auditDigest = Ledger.sha256((() => { const value = copy(unknownAudit); delete value.auditDigest; return value; })());
    expectCode(() => Ledger.validateAudit(unknownAudit), 'INVALID_RETENTION_AUDIT', 'audit validator rejects unknown fields');
    const oversizedAudit = { schema: Ledger.AUDIT_SCHEMA, padding: 'x'.repeat(Ledger.MAX_AUDIT_CANONICAL_BYTES + 1) };
    expectCode(() => Ledger.validateAudit(oversizedAudit), 'INVALID_RETENTION_AUDIT', 'oversized audit fails before structural validation');

    const earlyProposalInput = Fixture.proposalInput(
      'v27-retention-proposal:early', '2026-08-20T16:34:09.999Z', settledCheckpointInput, settledCheckpoint
    );
    expectCode(() => service.propose(earlyProposalInput), 'RETENTION_PROPOSAL_TIME_INVALID', 'proposal cannot predate prior settlement');
    const earlyAuditInput = Fixture.auditInput(
      'v27-retention-audit:early', '2026-08-20T16:33:29.999Z', source.serviceOptions, settledRecords
    );
    expectCode(() => service.auditLatest(earlyAuditInput), 'RETENTION_AUDIT_TIME_INVALID', 'audit cannot predate latest persisted proposal');
    const unknownProposalInput = copy(forwardInput);
    unknownProposalInput.unexpected = true;
    expectCode(() => service.propose(unknownProposalInput), 'INVALID_RETENTION_PROPOSAL_INPUT', 'proposal input rejects unknown fields');

    function corruptCopy(name) {
      const target = path.join(tempRoot, name);
      fs.cpSync(retentionRoot, target, { recursive: true });
      return target;
    }
    const digestCorruptRoot = corruptCopy('retention-corrupt-proposal-digest');
    rewriteCanonical(proposalFile(digestCorruptRoot, 2), value => { value.proposalDigest = 'sha256:' + '0'.repeat(64); });
    expectCode(
      () => Ledger.createService(Fixture.serviceOptions(digestCorruptRoot, 'v27-retention-log')).inspect(),
      'RETENTION_PROPOSAL_CORRUPT',
      'corrupt proposal digest fails closed'
    );
    const settlementCorruptRoot = corruptCopy('retention-corrupt-settlement-digest');
    rewriteCanonical(settlementFile(settlementCorruptRoot, 2), value => { value.settlementDigest = 'sha256:' + '0'.repeat(64); });
    expectCode(
      () => Ledger.createService(Fixture.serviceOptions(settlementCorruptRoot, 'v27-retention-log')).inspect(),
      'RETENTION_SETTLEMENT_CORRUPT',
      'corrupt settlement digest fails closed'
    );
    const noncanonicalRoot = corruptCopy('retention-noncanonical');
    fs.appendFileSync(proposalFile(noncanonicalRoot, 1), ' ', 'utf8');
    expectCode(
      () => Ledger.createService(Fixture.serviceOptions(noncanonicalRoot, 'v27-retention-log')).inspect(),
      'RETENTION_PROPOSAL_CORRUPT',
      'noncanonical proposal file fails closed'
    );
    const gapRoot = corruptCopy('retention-gap');
    fs.unlinkSync(proposalFile(gapRoot, 1));
    expectCode(
      () => Ledger.createService(Fixture.serviceOptions(gapRoot, 'v27-retention-log')).inspect(),
      'RETENTION_SEQUENCE_CORRUPT',
      'proposal filename gap fails closed'
    );
    const unexpectedRoot = corruptCopy('retention-unexpected');
    fs.writeFileSync(path.join(retentionNamespace(unexpectedRoot), 'unexpected.txt'), 'unexpected\n', 'utf8');
    expectCode(
      () => Ledger.createService(Fixture.serviceOptions(unexpectedRoot, 'v27-retention-log')).inspect(),
      'RETENTION_NAMESPACE_CORRUPT',
      'unexpected namespace file fails closed'
    );
    const busyRoot = corruptCopy('retention-busy');
    fs.writeFileSync(path.join(retentionNamespace(busyRoot), Ledger.LOCK_FILE), 'LOCKED\n', 'utf8');
    expectCode(
      () => Ledger.createService(Fixture.serviceOptions(busyRoot, 'v27-retention-log')).inspect(),
      'RETENTION_LEDGER_BUSY',
      'stale operation lock fails closed'
    );

    const jointSource = V26Fixture.buildPending(tempRoot, fixture, 'source-joint-replacement', 'B', 'v27-source-history', 'v27-joint-b');
    const jointRecords = [copy(jointSource.record)];
    const jointCheckpointInput = V26Fixture.checkpointInput(
      'v27-checkpoint:joint-replacement-b', '2026-08-20T16:34:21.000Z', jointSource.serviceOptions, jointRecords
    );
    const jointCheckpoint = V26.createCheckpoint(copy(jointCheckpointInput));
    const jointRetentionRoot = Fixture.makeDir(tempRoot, 'retention-joint-replacement');
    const jointServiceOptions = Fixture.serviceOptions(jointRetentionRoot, 'v27-retention-log');
    const jointService = Ledger.createService(copy(jointServiceOptions));
    const jointProposalInput = Fixture.proposalInput(
      'v27-retention-proposal:joint-b', '2026-08-20T16:34:30.000Z', jointCheckpointInput, jointCheckpoint
    );
    const jointProposal = jointService.propose(copy(jointProposalInput));
    const jointSettlementInput = Fixture.settlementInput(
      'v27-retention-settlement:joint-b', '2026-08-20T16:34:40.000Z', jointProposalInput, jointProposal
    );
    jointService.settle(copy(jointSettlementInput));
    const jointAudit = jointService.auditLatest(Fixture.auditInput(
      'v27-retention-audit:joint-b', '2026-08-20T16:34:50.000Z', jointSource.serviceOptions, jointRecords
    ));
    equal(jointAudit.classification, 'EXACT_HISTORY_MATCH', 'jointly replaced source and retention roots form another exact relative pair');
    check(jointAudit.retention.checkpointRef.sha256 !== settledAudit.retention.checkpointRef.sha256, 'joint replacement does not preserve original retained checkpoint');
    equal(jointAudit.truth.withheldOrJointlyReplacedRootsExcluded, false, 'joint replacement counterexample remains explicit');

    const publicArtifacts = [
      JSON.parse(fs.readFileSync(path.join(retentionNamespace(retentionRoot), 'ledger.json'), 'utf8')),
      initialProposal, initialSettlement, forwardProposal, forwardSettlement, finalSnapshot, settledAudit
    ];
    const publicText = JSON.stringify(publicArtifacts);
    const publicKeys = new Set();
    (function collectKeys(value) {
      if (Array.isArray(value)) return value.forEach(collectKeys);
      if (!value || typeof value !== 'object') return;
      Object.keys(value).forEach(key => { publicKeys.add(key); collectKeys(value[key]); });
    })(publicArtifacts);
    check(!publicText.includes(tempRoot), 'public artifacts embed no configured machine path');
    check(!publicText.includes('stateRoot'), 'public artifacts embed no source or retention root field');
    check(!publicText.includes('BEGIN PUBLIC KEY'), 'public artifacts embed no raw public key PEM');
    check(!publicText.includes('BEGIN PRIVATE KEY'), 'public artifacts embed no private key PEM');
    check(!publicText.includes('proposalInput'), 'public artifacts embed no v2.5 proposal input package');
    check(!publicText.includes('settlementInput'), 'public artifacts embed no v2.5 settlement input package');
    check(!publicKeys.has('modelOutput'), 'public artifacts embed no model output payload field');
    check(!publicKeys.has('privateContext'), 'public artifacts embed no private context payload field');
    check(publicText.includes('rawModelOutputEmbedded') && publicText.includes('privateContextEmbedded'), 'public artifacts retain explicit negative minimization truth fields');
    equal(Ledger.stableStringify(JSON.parse(Ledger.stableStringify(finalSnapshot))), Ledger.stableStringify(finalSnapshot), 'snapshot canonical JSON is stable');
    equal(Ledger.auditRef, undefined, 'private audit reference helper is not exported');
    equal(Ledger.buildProposal, undefined, 'write-completion proposal builder is not exported');
    equal(Ledger.buildSettlement, undefined, 'write-completion settlement builder is not exported');

    const implementation = fs.readFileSync(path.join(__dirname, 'model-shadow-history-checkpoint-retention-ledger.js'), 'utf8');
    check(!implementation.includes('fetch(') && !implementation.includes('https.request') && !implementation.includes('http.request'), 'implementation has no network invocation');
    check(!implementation.includes('child_process'), 'runtime launches no child process');
    check(!implementation.includes('bridge-token') && !implementation.includes('Authorization:'), 'runtime contains no credential source');
    check(implementation.includes('fs.openSync') && implementation.includes("'wx'") && implementation.includes('fs.fsyncSync'), 'runtime uses exclusive create and file fsync');
    check(implementation.includes('directoryEntryOrHardwareDurabilityProven: false'), 'runtime refuses directory and hardware durability claim');
    check(implementation.includes('externalRetentionProven: false'), 'runtime refuses external retention claim');
    check(implementation.includes('protectedMonotonicStateProven: false'), 'runtime refuses protected monotonic state claim');
    check(implementation.includes('humanBenefitProven: false') && implementation.includes('broadLearningClaimed: false'), 'runtime refuses benefit and learning claims');

    const contract = require('./module.contract.json');
    equal(contract.version, 'v2.7', 'contract version is exact');
    equal(contract.status, 'TEST', 'contract status remains TEST');
    equal(contract.lifecycle.installed, false, 'module remains uninstalled');
    equal(contract.lifecycle.promoted, false, 'module remains unpromoted');
    check(contract.boundaries.writes.some(value => value.includes('proposal') && value.includes('file-fsync')), 'contract declares proposal file-fsync write');
    check(contract.boundaries.refuses.includes('caller-owned-distinct-local-root-as-independent-external-retention'), 'contract refuses local root as external retention');
    check(contract.boundaries.refuses.includes('joint-source-and-retention-root-replacement-as-original-continuity'), 'contract refuses joint replacement continuity');
    check(contract.boundaries.refuses.includes('pending-observation-as-settled-retention-authority'), 'contract refuses pending authority');
    check(contract.boundaries.refuses.includes('file-fsync-as-directory-entry-or-hardware-durability'), 'contract refuses durability overclaim');
    const contractCheck = ContractVerifier.validateContract(contract);
    equal(contractCheck.pass, true, 'module contract passes repository verifier');
    equal(contractCheck.errors, [], 'module contract verifier reports no errors');

    const schemas = ['manifest.schema.json', 'proposal.schema.json', 'settlement.schema.json', 'snapshot.schema.json', 'audit.schema.json'];
    schemas.forEach(name => {
      const schema = JSON.parse(fs.readFileSync(path.join(__dirname, name), 'utf8'));
      equal(schema.$schema, 'https://json-schema.org/draft/2020-12/schema', name + ' declares Draft 2020-12');
      equal(schema.additionalProperties, false, name + ' is closed at root');
    });
    const proposalSchema = require('./proposal.schema.json');
    equal(proposalSchema.properties.checkpoint.$ref, '../model-shadow-portable-pin-settlement-history-checkpoint/checkpoint.schema.json', 'proposal schema reuses exact v2.6 checkpoint schema');
    const auditSchema = require('./audit.schema.json');
    equal(auditSchema.properties.upstreamAudit.$ref, '../model-shadow-portable-pin-settlement-history-checkpoint/audit.schema.json', 'audit schema reuses exact v2.6 audit schema');
    equal(auditSchema.properties.truth.properties.externalRetentionProven.const, false, 'audit schema fixes external retention false');
    equal(auditSchema.properties.truth.properties.protectedMonotonicStateProven.const, false, 'audit schema fixes protected state false');

    console.log('RESULT ' + checks + ' focused assertions passed');
  } finally {
    verifiedRemove(tempRoot, path.dirname(tempRoot));
  }
}

main().catch(error => {
  console.error(error && error.stack ? error.stack : error);
  process.exitCode = 1;
});
