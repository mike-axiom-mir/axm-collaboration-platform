#!/usr/bin/env node
'use strict';

const assert = require('assert');
const childProcess = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const ContractVerifier = require('../../hub/module-contract-verifier');
const Ledger = require('../model-shadow-retention-audit-review-outcome-ledger/model-shadow-retention-audit-review-outcome-ledger');
const Fixture = require('../model-shadow-retention-audit-review-outcome-ledger/selftest-fixture');
const Checkpoint = require('./model-shadow-retention-audit-review-outcome-history-checkpoint');

let checks = 0;
function check(value, label) { assert.ok(value, label); checks += 1; console.log('PASS ' + label); }
function equal(actual, expected, label) { assert.deepStrictEqual(actual, expected, label); checks += 1; console.log('PASS ' + label); }
function copy(value) { return JSON.parse(JSON.stringify(value)); }
function expectCode(operation, code, label) {
  assert.throws(operation, error => error && error.code === code, label);
  checks += 1;
  console.log('PASS ' + label);
}
function verifiedRemove(target, parent) {
  const resolvedTarget = path.resolve(target), resolvedParent = path.resolve(parent);
  if (resolvedTarget === resolvedParent || !resolvedTarget.startsWith(resolvedParent + path.sep)) throw new Error('unsafe cleanup target');
  fs.rmSync(resolvedTarget, { recursive: true, force: true });
}
function walkFiles(root, base, rows) {
  if (!fs.existsSync(root)) return rows;
  for (const name of fs.readdirSync(root).sort()) {
    const full = path.join(root, name), relative = path.relative(base, full).replace(/\\/g, '/');
    const stat = fs.statSync(full);
    if (stat.isDirectory()) walkFiles(full, base, rows);
    else rows.push({ path: relative, sha256: crypto.createHash('sha256').update(fs.readFileSync(full)).digest('hex') });
  }
  return rows;
}
function treeDigest(root) { return crypto.createHash('sha256').update(JSON.stringify(walkFiles(root, root, []))).digest('hex'); }
function writePackage(parent, name, value) { const target = path.join(parent, name + '.json'); fs.writeFileSync(target, JSON.stringify(value), 'utf8'); return target; }
function runChild(packagePath) {
  const result = childProcess.spawnSync(process.execPath, [path.join(__dirname, 'selftest-child.js'), packagePath], {
    cwd: __dirname, encoding: 'utf8', windowsHide: true, timeout: 120000, maxBuffer: 16 * 1024 * 1024
  });
  return { status: result.status, value: result.status === 0 ? JSON.parse(result.stdout) : null, stderr: result.stderr };
}
function copyLedger(parent, source, name) { const target = path.join(parent, name); fs.cpSync(source, target, { recursive: true }); return target; }
function recordFile(root, sequence) {
  return path.join(root, Ledger.NAMESPACE, Ledger.RECORDS_DIRECTORY, String(sequence).padStart(12, '0') + '.json');
}
function auditInput(auditId, auditedAt, checkpoint, currentServiceOptions) {
  return { auditId, auditedAt, checkpoint: copy(checkpoint), currentServiceOptions: copy(currentServiceOptions) };
}

function main() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'axm-review-outcome-history-checkpoint-'));
  try {
    const approvedItem = Fixture.outcomeFixture(tempRoot, 'APPROVED', 'checkpoint-approved');
    const heldItem = Fixture.outcomeFixture(tempRoot, 'HOLD', 'checkpoint-held');
    const rejectedItem = Fixture.outcomeFixture(tempRoot, 'REJECTED', 'checkpoint-rejected');
    const ledgerRoot = Fixture.makeDir(tempRoot, 'origin-ledger');
    const options = Fixture.serviceOptions(ledgerRoot, 'v33-origin-ledger', '2020-01-01T00:00:00.000Z');
    const service = Ledger.createService(options);

    equal(Checkpoint.CHECKPOINT_SCHEMA, 'axm.model-shadow-retention-audit-review-outcome-history-checkpoint/v1', 'checkpoint schema is exact');
    equal(Checkpoint.AUDIT_SCHEMA, 'axm.model-shadow-retention-audit-review-outcome-history-audit/v1', 'audit schema is exact');
    equal(Checkpoint.VERSION, '3.3.0', 'version is exact');
    equal(Checkpoint.STATUS, 'TEST', 'status remains TEST');
    equal(Checkpoint.MAX_HISTORY_ITEMS, 10000, 'history item bound matches v3.2');
    equal(Checkpoint.MAX_CHECKPOINT_CANONICAL_BYTES, 16777216, 'checkpoint byte bound is exact');
    equal(Checkpoint.MAX_AUDIT_CANONICAL_BYTES, 1048576, 'audit byte bound is exact');
    equal(Checkpoint.CLASSIFICATIONS.length, 7, 'audit classification set is closed');

    const approvedAt = Fixture.after(approvedItem.outcome.observedAt);
    const approvedRecord = service.capture(Fixture.captureInput(approvedItem, 'v33-record:approved', approvedAt));
    const oneRecordRoot = copyLedger(tempRoot, ledgerRoot, 'one-record-ledger');
    const oneRecordOptions = Fixture.serviceOptions(oneRecordRoot, options.ledgerId, options.createdAt);
    const firstCheckpointInput = {
      checkpointId: 'v33-checkpoint:first',
      checkpointedAt: Fixture.after(approvedAt),
      serviceOptions: copy(options)
    };
    const beforeFirstCheckpoint = treeDigest(ledgerRoot);
    const firstCheckpoint = Checkpoint.createCheckpoint(copy(firstCheckpointInput));
    equal(treeDigest(ledgerRoot), beforeFirstCheckpoint, 'checkpoint creation leaves durable v3.2 bytes unchanged');
    equal(firstCheckpoint.ledger.recordCount, 1, 'first checkpoint counts one record');
    equal(firstCheckpoint.history.entries[0].recordRef.sha256, approvedRecord.recordDigest, 'first checkpoint commits exact record digest');
    equal(firstCheckpoint.history.entries[0].outcomeRef.sha256, approvedRecord.outcome.outcomeDigest, 'first checkpoint commits exact outcome digest');
    equal(firstCheckpoint.history.entries[0].classification, Ledger.CLASSIFICATIONS.APPROVED, 'first checkpoint commits minimized approval classification');
    equal(Checkpoint.validateCheckpoint(firstCheckpoint), firstCheckpoint, 'checkpoint self-validator accepts exact first checkpoint');
    equal(Checkpoint.verifyCheckpointOrigin(firstCheckpointInput, firstCheckpoint).pass, true, 'checkpoint origin verifier exact-rebuilds first checkpoint');

    const heldAt = Fixture.laterThan([approvedAt, heldItem.outcome.observedAt]);
    const heldRecord = service.capture(Fixture.captureInput(heldItem, 'v33-record:held', heldAt));
    const rejectedAt = Fixture.laterThan([heldAt, rejectedItem.outcome.observedAt]);
    const rejectedRecord = service.capture(Fixture.captureInput(rejectedItem, 'v33-record:rejected', rejectedAt));
    const finalCheckpointInput = {
      checkpointId: 'v33-checkpoint:final',
      checkpointedAt: Fixture.after(rejectedAt),
      serviceOptions: copy(options)
    };
    const beforeFinalCheckpoint = treeDigest(ledgerRoot);
    const finalCheckpoint = Checkpoint.createCheckpoint(copy(finalCheckpointInput));
    equal(treeDigest(ledgerRoot), beforeFinalCheckpoint, 'final checkpoint leaves durable v3.2 bytes unchanged');
    equal(finalCheckpoint.ledger.recordCount, 3, 'final checkpoint counts complete history');
    equal(finalCheckpoint.ledger.approvedCount, 1, 'final checkpoint counts approval classification');
    equal(finalCheckpoint.ledger.holdCount, 1, 'final checkpoint counts hold classification');
    equal(finalCheckpoint.ledger.rejectedCount, 1, 'final checkpoint counts rejection classification');
    equal(finalCheckpoint.history.entries.map(entry => entry.sequence), [1, 2, 3], 'final checkpoint sequences are contiguous');
    equal(finalCheckpoint.history.entries.map(entry => entry.recordRef.sha256), [approvedRecord.recordDigest, heldRecord.recordDigest, rejectedRecord.recordDigest], 'final checkpoint commits every ordered record reference');
    equal(finalCheckpoint.ledger.latestRecordRef.sha256, rejectedRecord.recordDigest, 'final checkpoint endpoint binds latest record');
    equal(finalCheckpoint.ledger.latestOutcomeRef.sha256, rejectedRecord.outcome.outcomeDigest, 'final checkpoint endpoint binds latest outcome');
    equal(finalCheckpoint.truth.checkpointSeparatelyRetainedProven, false, 'checkpoint refuses separate retention claim');
    equal(finalCheckpoint.truth.jointCheckpointAndLedgerReplacementExcluded, false, 'checkpoint preserves joint replacement boundary');
    equal(finalCheckpoint.truth.retentionHoldResolved, false, 'checkpoint leaves retention hold unresolved');
    equal(finalCheckpoint.truth.executionAuthorized, false, 'checkpoint grants no execution authority');
    equal(Checkpoint.validateCheckpoint(finalCheckpoint), finalCheckpoint, 'checkpoint self-validator accepts exact final checkpoint');
    equal(Checkpoint.verifyCheckpointOrigin(finalCheckpointInput, finalCheckpoint).pass, true, 'checkpoint origin verifier exact-rebuilds final checkpoint');

    const driftedCheckpoint = copy(finalCheckpoint);
    driftedCheckpoint.history.entries[1].classification = Ledger.CLASSIFICATIONS.REJECTED;
    expectCode(() => Checkpoint.validateCheckpoint(driftedCheckpoint), 'INVALID_CHECKPOINT', 'classification drift with stale digests fails closed');
    const extraCheckpoint = copy(finalCheckpoint); extraCheckpoint.extra = true;
    expectCode(() => Checkpoint.validateCheckpoint(extraCheckpoint), 'INVALID_CHECKPOINT', 'checkpoint extra field fails closed');
    const sequenceDrift = copy(finalCheckpoint); sequenceDrift.history.entries[1].sequence = 3;
    expectCode(() => Checkpoint.validateCheckpoint(sequenceDrift), 'INVALID_CHECKPOINT', 'checkpoint sequence drift fails closed');
    const endpointDrift = copy(finalCheckpoint); endpointDrift.ledger.latestRecordRef = copy(approvedRecord.log.manifestRef);
    expectCode(() => Checkpoint.validateCheckpoint(endpointDrift), 'INVALID_CHECKPOINT', 'checkpoint endpoint drift fails closed');
    const earlyCheckpointInput = copy(finalCheckpointInput); earlyCheckpointInput.checkpointId = 'v33-checkpoint:early'; earlyCheckpointInput.checkpointedAt = approvedAt;
    expectCode(() => Checkpoint.createCheckpoint(earlyCheckpointInput), 'INVALID_INPUT', 'checkpoint before latest record is refused');
    const absentRootForCreate = Fixture.makeDir(tempRoot, 'absent-checkpoint-origin');
    const absentCreateInput = copy(finalCheckpointInput); absentCreateInput.serviceOptions = Fixture.serviceOptions(absentRootForCreate, options.ledgerId, options.createdAt);
    expectCode(() => Checkpoint.createCheckpoint(absentCreateInput), 'LEDGER_ABSENT', 'checkpoint creation requires present ledger');
    const oversizedInput = copy(finalCheckpointInput); oversizedInput.padding = 'x'.repeat(Checkpoint.MAX_INPUT_CANONICAL_BYTES);
    expectCode(() => Checkpoint.createCheckpoint(oversizedInput), 'INPUT_TOO_LARGE', 'oversized checkpoint input fails before processing');

    const originalCreateService = Ledger.createService;
    let bracketReadAllCalls = 0;
    try {
      Ledger.createService = serviceOptions => {
        const wrapped = originalCreateService(serviceOptions);
        let inspectCalls = 0;
        return {
          inspect() {
            inspectCalls += 1;
            const snapshot = wrapped.inspect();
            if (inspectCalls === 2 && snapshot) snapshot.aggregateStorageBytes += 1;
            return snapshot;
          },
          readAll() { bracketReadAllCalls += 1; return wrapped.readAll(); }
        };
      };
      expectCode(() => Checkpoint.createCheckpoint(finalCheckpointInput), 'LEDGER_MOVED_DURING_PRESENTATION', 'changed bracketing snapshot fails closed');
      equal(bracketReadAllCalls, 1, 'checkpoint uses one complete v3.2 history read per presentation');
    } finally {
      Ledger.createService = originalCreateService;
    }

    const exactAuditInput = auditInput('v33-audit:exact', Fixture.after(finalCheckpoint.checkpointedAt), finalCheckpoint, options);
    const beforeExactAudit = treeDigest(ledgerRoot);
    const exactAudit = Checkpoint.auditCheckpoint(copy(exactAuditInput));
    equal(treeDigest(ledgerRoot), beforeExactAudit, 'exact audit leaves durable v3.2 bytes unchanged');
    equal(exactAudit.classification, 'EXACT_HISTORY_MATCH', 'exact history is classified exactly');
    equal(exactAudit.comparison.commonPrefixCount, 3, 'exact audit reports complete common prefix');
    equal(exactAudit.decision.continuityHoldRequired, false, 'exact audit requires no continuity hold');
    equal(exactAudit.decision.retentionHoldUnresolved, true, 'exact audit still leaves retention hold unresolved');
    equal(exactAudit.decision.autonomousActionCount, 0, 'exact audit grants zero actions');
    equal(Checkpoint.validateAudit(exactAudit), exactAudit, 'audit self-validator accepts exact audit');
    equal(Checkpoint.verifyAudit(exactAuditInput, exactAudit).pass, true, 'audit verifier exact-rebuilds exact audit');

    const forwardAuditInput = auditInput('v33-audit:forward', Fixture.after(finalCheckpoint.checkpointedAt, 2000), firstCheckpoint, options);
    const forwardAudit = Checkpoint.auditCheckpoint(copy(forwardAuditInput));
    equal(forwardAudit.classification, 'FORWARD_HISTORY_EXTENSION', 'strict extension is classified forward');
    equal(forwardAudit.comparison.commonPrefixCount, 1, 'forward audit binds complete checkpoint prefix');
    equal(forwardAudit.decision.continuityHoldRequired, false, 'forward audit requires review without continuity hold');
    equal(forwardAudit.decision.autonomousActionCount, 0, 'forward audit grants zero actions');

    const rollbackAuditInput = auditInput('v33-audit:rollback', Fixture.after(finalCheckpoint.checkpointedAt, 3000), finalCheckpoint, oneRecordOptions);
    const rollbackAudit = Checkpoint.auditCheckpoint(copy(rollbackAuditInput));
    equal(rollbackAudit.classification, 'OBSERVED_STRICT_HISTORY_ROLLBACK_RELATIVE_TO_PRESENTED_CHECKPOINT', 'short exact prefix is classified rollback');
    equal(rollbackAudit.comparison.commonPrefixCount, 1, 'rollback audit reports exact remaining prefix');
    equal(rollbackAudit.decision.continuityHoldRequired, true, 'rollback requires continuity hold');
    equal(rollbackAudit.truth.retainedCheckpointRelativeRewriteDetected, true, 'rollback truth is relative to presented checkpoint');

    const forkRoot = copyLedger(tempRoot, oneRecordRoot, 'fork-ledger');
    const forkOptions = Fixture.serviceOptions(forkRoot, options.ledgerId, options.createdAt);
    const forkItem = Fixture.outcomeFixture(tempRoot, 'HOLD', 'fork-alternative');
    const forkAt = Fixture.laterThan([approvedAt, forkItem.outcome.observedAt]);
    Ledger.createService(forkOptions).capture(Fixture.captureInput(forkItem, 'v33-record:fork', forkAt));
    const forkAuditInput = auditInput('v33-audit:fork', Fixture.after(finalCheckpoint.checkpointedAt, 4000), finalCheckpoint, forkOptions);
    const forkAudit = Checkpoint.auditCheckpoint(copy(forkAuditInput));
    equal(forkAudit.classification, 'OBSERVED_HISTORY_REPLACEMENT_OR_FORK_RELATIVE_TO_PRESENTED_CHECKPOINT', 'divergent suffix is classified replacement or fork');
    equal(forkAudit.comparison.commonPrefixCount, 1, 'fork audit preserves exact common prefix count');
    equal(forkAudit.decision.continuityHoldRequired, true, 'fork requires continuity hold');

    const identityRoot = Fixture.makeDir(tempRoot, 'identity-ledger');
    const identityOptions = Fixture.serviceOptions(identityRoot, 'v33-other-ledger', options.createdAt);
    const identityItem = Fixture.outcomeFixture(tempRoot, 'REJECTED', 'identity');
    Ledger.createService(identityOptions).capture(Fixture.captureInput(identityItem, 'v33-record:identity', Fixture.after(identityItem.outcome.observedAt)));
    const identityAudit = Checkpoint.auditCheckpoint(auditInput('v33-audit:identity', Fixture.after(finalCheckpoint.checkpointedAt, 5000), finalCheckpoint, identityOptions));
    equal(identityAudit.classification, 'OBSERVED_LEDGER_IDENTITY_DRIFT', 'manifest drift is classified identity drift');
    equal(identityAudit.comparison.ledgerIdentityDrift, true, 'identity drift flag is exact');
    equal(identityAudit.decision.continuityHoldRequired, true, 'identity drift requires continuity hold');

    const absentRoot = Fixture.makeDir(tempRoot, 'absent-ledger');
    const absentOptions = Fixture.serviceOptions(absentRoot, options.ledgerId, options.createdAt);
    const absentAudit = Checkpoint.auditCheckpoint(auditInput('v33-audit:absent', Fixture.after(finalCheckpoint.checkpointedAt, 6000), finalCheckpoint, absentOptions));
    equal(absentAudit.classification, 'OBSERVED_LEDGER_ABSENT', 'absent namespace is classified absent');
    equal(absentAudit.current.snapshotBinding, null, 'absent audit claims no current snapshot');
    equal(absentAudit.current.errorCode, null, 'absent audit invents no error cause');
    equal(absentAudit.truth.absenceCauseProven, false, 'absent audit proves no deletion cause');

    const invalidRoot = copyLedger(tempRoot, ledgerRoot, 'invalid-ledger');
    fs.appendFileSync(recordFile(invalidRoot, 1), ' ');
    const invalidOptions = Fixture.serviceOptions(invalidRoot, options.ledgerId, options.createdAt);
    const invalidAudit = Checkpoint.auditCheckpoint(auditInput('v33-audit:invalid', Fixture.after(finalCheckpoint.checkpointedAt, 7000), finalCheckpoint, invalidOptions));
    equal(invalidAudit.classification, 'OBSERVED_LEDGER_OR_CONFIGURATION_INVALID', 'corrupt current ledger is classified invalid');
    equal(invalidAudit.current.errorCode, 'REVIEW_OUTCOME_LEDGER_RECORD_CORRUPT', 'invalid audit preserves bounded upstream error code');
    equal(invalidAudit.current.snapshotBinding, null, 'invalid audit claims no exact current presentation');
    const invalidConfiguration = Fixture.serviceOptions(path.join(tempRoot, 'missing-current-root'), options.ledgerId, options.createdAt);
    const invalidConfigurationAudit = Checkpoint.auditCheckpoint(auditInput('v33-audit:invalid-config', Fixture.after(finalCheckpoint.checkpointedAt, 8000), finalCheckpoint, invalidConfiguration));
    equal(invalidConfigurationAudit.classification, 'OBSERVED_LEDGER_OR_CONFIGURATION_INVALID', 'invalid configuration receives typed invalid classification');
    equal(invalidConfigurationAudit.current.errorCode, 'REVIEW_OUTCOME_LEDGER_STATE_ROOT_INVALID', 'configuration failure retains bounded typed code');

    const alteredAudit = copy(exactAudit); alteredAudit.decision.autonomousActionCount = 1;
    expectCode(() => Checkpoint.validateAudit(alteredAudit), 'INVALID_AUDIT', 'authority-inflated audit fails closed');
    const alteredAuditDigest = copy(exactAudit); alteredAuditDigest.auditDigest = 'sha256:' + '0'.repeat(64);
    expectCode(() => Checkpoint.validateAudit(alteredAuditDigest), 'INVALID_AUDIT', 'audit digest drift fails closed');
    const incoherentForkAudit = copy(forkAudit); incoherentForkAudit.comparison.commonPrefixCount = 2; incoherentForkAudit.auditDigest = Checkpoint.sha256((() => { const value = copy(incoherentForkAudit); delete value.auditDigest; return value; })());
    expectCode(() => Checkpoint.validateAudit(incoherentForkAudit), 'INVALID_AUDIT', 'fork audit with a complete shorter prefix fails closed');
    const earlyAuditInput = copy(exactAuditInput); earlyAuditInput.auditId = 'v33-audit:early'; earlyAuditInput.auditedAt = approvedAt;
    expectCode(() => Checkpoint.auditCheckpoint(earlyAuditInput), 'INVALID_INPUT', 'audit before checkpoint is refused');
    const extraAuditInput = copy(exactAuditInput); extraAuditInput.extra = true;
    expectCode(() => Checkpoint.auditCheckpoint(extraAuditInput), 'INVALID_INPUT', 'audit input extra field is refused');

    const replacementRoot = Fixture.makeDir(tempRoot, 'replacement-ledger');
    const replacementOptions = Fixture.serviceOptions(replacementRoot, options.ledgerId, options.createdAt);
    const replacementItem = Fixture.outcomeFixture(tempRoot, 'HOLD', 'replacement');
    const replacementAt = Fixture.after(replacementItem.outcome.observedAt);
    const replacementRecord = Ledger.createService(replacementOptions).capture(Fixture.captureInput(replacementItem, 'v33-record:replacement', replacementAt));
    const replacementAuditInput = auditInput('v33-audit:replacement-relative-original', Fixture.after(finalCheckpoint.checkpointedAt, 9000), finalCheckpoint, replacementOptions);
    const replacementAudit = Checkpoint.auditCheckpoint(copy(replacementAuditInput));
    equal(replacementAudit.classification, 'OBSERVED_HISTORY_REPLACEMENT_OR_FORK_RELATIVE_TO_PRESENTED_CHECKPOINT', 'retained original checkpoint detects same-identity whole-ledger replacement');
    equal(replacementAudit.comparison.commonPrefixCount, 0, 'whole-ledger replacement has no original prefix');
    equal(replacementAudit.truth.retainedCheckpointRelativeRewriteDetected, true, 'whole-ledger replacement detection is explicitly relative');
    check(replacementRecord.recordDigest !== approvedRecord.recordDigest, 'replacement record identity differs from original');

    const replacementCheckpointInput = {
      checkpointId: 'v33-checkpoint:replacement',
      checkpointedAt: Fixture.after(replacementAt),
      serviceOptions: copy(replacementOptions)
    };
    const replacementCheckpoint = Checkpoint.createCheckpoint(copy(replacementCheckpointInput));
    const replacementExactInput = auditInput('v33-audit:joint-replacement', Fixture.after(replacementCheckpoint.checkpointedAt), replacementCheckpoint, replacementOptions);
    const replacementExact = Checkpoint.auditCheckpoint(copy(replacementExactInput));
    equal(replacementExact.classification, 'EXACT_HISTORY_MATCH', 'jointly replaced checkpoint and ledger form another internally exact pair');
    equal(replacementExact.truth.originalHistoryProven, false, 'joint replacement exactness proves no original history');
    equal(replacementExact.truth.jointCheckpointAndLedgerReplacementExcluded, false, 'joint replacement remains explicit counterevidence');

    const publicArtifacts = [firstCheckpoint, finalCheckpoint, exactAudit, forwardAudit, rollbackAudit, forkAudit, identityAudit, absentAudit, invalidAudit];
    const publicText = JSON.stringify(publicArtifacts);
    const publicKeys = new Set();
    (function collectKeys(value) {
      if (Array.isArray(value)) return value.forEach(collectKeys);
      if (!value || typeof value !== 'object') return;
      Object.keys(value).forEach(key => { publicKeys.add(key); collectKeys(value[key]); });
    })(publicArtifacts);
    ['Alice Reviewer', 'Machine Seat', 'Alice exact artifact approval note', 'Machine exact artifact approval note'].forEach(secret => {
      check(!publicText.includes(secret), 'public checkpoint artifacts omit raw review material: ' + secret);
    });
    [tempRoot, ledgerRoot, approvedItem.fixture.pending.fixture.observationRoot].forEach(secretPath => {
      check(!publicText.includes(secretPath), 'public checkpoint artifacts omit configured path');
    });
    ['outcome', 'reviewOutcome', 'votes', 'actorDigest', 'outcomeInput', 'serviceOptions', 'stateRoot'].forEach(key => {
      check(!publicKeys.has(key), 'public checkpoint artifacts omit package key ' + key);
    });
    check(publicKeys.has('recordRef') && publicKeys.has('outcomeRef') && publicKeys.has('classification'), 'checkpoint retains only useful minimized history references and classifications');
    equal(Checkpoint.stableStringify(JSON.parse(Checkpoint.stableStringify(finalCheckpoint))), Checkpoint.stableStringify(finalCheckpoint), 'checkpoint canonical JSON is stable');
    equal(Checkpoint.checkpointTruth, undefined, 'checkpoint truth completion builder is not exported');
    equal(Checkpoint.auditTruth, undefined, 'audit truth completion builder is not exported');

    const implementation = fs.readFileSync(path.join(__dirname, 'model-shadow-retention-audit-review-outcome-history-checkpoint.js'), 'utf8');
    check(!implementation.includes("require('fs')") && !implementation.includes('fs.write') && !implementation.includes('fs.open'), 'runtime performs no direct filesystem write or read');
    check(!implementation.includes('fetch(') && !implementation.includes('https.request') && !implementation.includes('http.request'), 'runtime has no network invocation');
    check(!implementation.includes('child_process'), 'runtime launches no child process');
    check(!implementation.includes('review-service') && !implementation.includes('ReviewService'), 'runtime imports no ReviewService');
    check(!implementation.includes('bridge-token') && !implementation.includes('Authorization:'), 'runtime contains no credential source');
    check(implementation.includes('completeMinimizedV31OutcomeEmbedded: false'), 'runtime refuses complete outcome embedding claim');
    check(implementation.includes('jointCheckpointAndLedgerReplacementExcluded: false'), 'runtime preserves joint replacement counterevidence');
    check(implementation.includes('retentionHoldResolved: false') && implementation.includes('executionAuthorized: false'), 'runtime refuses hold resolution and execution authority');
    check(implementation.includes('humanBenefitProven: false') && implementation.includes('broadLearningClaimed: false'), 'runtime refuses benefit and learning claims');

    const contract = require('./module.contract.json');
    equal(contract.version, 'v3.3', 'contract version is exact');
    equal(contract.status, 'TEST', 'contract status remains TEST');
    equal(contract.merge_gate, 'Mike Tobi / AXM', 'contract preserves human merge gate');
    equal(contract.lifecycle.installed, false, 'module remains uninstalled');
    equal(contract.lifecycle.promoted, false, 'module remains unpromoted');
    check(contract.boundaries.writes.every(value => value.includes('transient') && value.includes('no durable')), 'contract declares no durable write');
    check(contract.boundaries.refuses.includes('joint-ledger-and-checkpoint-replacement-as-original-history'), 'contract refuses joint replacement as original history');
    check(contract.boundaries.refuses.includes('approved-history-as-hold-resolution-remediation-execution-or-adoption-authority'), 'contract refuses approval authority inflation');
    const contractCheck = ContractVerifier.validateContract(contract);
    equal(contractCheck.pass, true, 'module contract passes repository verifier');
    equal(contractCheck.errors, [], 'module contract verifier reports no errors');

    ['checkpoint.schema.json', 'audit.schema.json'].forEach(name => {
      const schema = JSON.parse(fs.readFileSync(path.join(__dirname, name), 'utf8'));
      equal(schema.$schema, 'https://json-schema.org/draft/2020-12/schema', name + ' declares Draft 2020-12');
      equal(schema.additionalProperties, false, name + ' is closed at root');
    });
    const checkpointSchema = require('./checkpoint.schema.json');
    const auditSchema = require('./audit.schema.json');
    equal(checkpointSchema.properties.truth.$ref, '#/$defs/checkpointTruth', 'checkpoint schema binds closed truth object');
    equal(checkpointSchema.$defs.checkpointTruth.properties.retentionHoldResolved.const, false, 'checkpoint schema fixes hold resolution false');
    equal(checkpointSchema.$defs.checkpointTruth.properties.executionAuthorized.const, false, 'checkpoint schema fixes execution authority false');
    equal(auditSchema.properties.decision.properties.autonomousActionCount.const, 0, 'audit schema fixes zero actions');
    equal(auditSchema.$defs.auditTruth.properties.originalHistoryProven.const, false, 'audit schema refuses original-history proof');

    const checkpointPackagePath = writePackage(tempRoot, 'fresh-checkpoint', { action: 'validateCheckpoint', checkpoint: finalCheckpoint });
    const auditPackagePath = writePackage(tempRoot, 'fresh-audit', { action: 'validateAudit', audit: exactAudit });
    const originNamespace = path.join(ledgerRoot, Ledger.NAMESPACE);
    verifiedRemove(originNamespace, ledgerRoot);
    equal(fs.existsSync(originNamespace), false, 'synthetic origin ledger namespace is absent after bounded removal');
    equal(Checkpoint.validateCheckpoint(finalCheckpoint), finalCheckpoint, 'checkpoint self-validates after origin loss');
    equal(Checkpoint.verifyCheckpointOrigin(finalCheckpointInput, finalCheckpoint).pass, false, 'checkpoint origin cannot be reverified after origin loss');
    const afterLossAudit = Checkpoint.auditCheckpoint(auditInput('v33-audit:after-loss', Fixture.after(finalCheckpoint.checkpointedAt, 11000), finalCheckpoint, options));
    equal(afterLossAudit.classification, 'OBSERVED_LEDGER_ABSENT', 'audit observes origin absence after bounded removal');
    const childCheckpoint = runChild(checkpointPackagePath);
    equal(childCheckpoint.status, 0, 'fresh process checkpoint validation exits zero after origin loss');
    equal(childCheckpoint.value.result, finalCheckpoint, 'fresh process validates exact checkpoint after origin loss');
    const childAudit = runChild(auditPackagePath);
    equal(childAudit.status, 0, 'fresh process audit validation exits zero after origin loss');
    equal(childAudit.value.result, exactAudit, 'fresh process validates exact audit after origin loss');

    console.log('RESULT ' + checks + ' focused assertions passed');
  } finally {
    verifiedRemove(tempRoot, path.dirname(tempRoot));
  }
}

try { main(); }
catch (error) {
  console.error(error && error.stack ? error.stack : error);
  process.exitCode = 1;
}
