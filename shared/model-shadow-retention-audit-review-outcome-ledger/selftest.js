#!/usr/bin/env node
'use strict';

const assert = require('assert');
const childProcess = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const ContractVerifier = require('../../hub/module-contract-verifier');
const Ledger = require('./model-shadow-retention-audit-review-outcome-ledger');
const Fixture = require('./selftest-fixture');

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
function namespace(root) { return path.join(root, Ledger.NAMESPACE); }
function manifestFile(root) { return path.join(namespace(root), Ledger.MANIFEST_FILE); }
function recordFile(root, sequence) { return path.join(namespace(root), Ledger.RECORDS_DIRECTORY, String(sequence).padStart(12, '0') + '.json'); }
function writePackage(parent, name, value) { const target = path.join(parent, name + '.json'); fs.writeFileSync(target, JSON.stringify(value), 'utf8'); return target; }
function runChild(packagePath) {
  const result = childProcess.spawnSync(process.execPath, [path.join(__dirname, 'selftest-child.js'), packagePath], {
    cwd: __dirname, encoding: 'utf8', windowsHide: true, timeout: 120000, maxBuffer: 16 * 1024 * 1024
  });
  return { status: result.status, value: result.status === 0 ? JSON.parse(result.stdout) : null, stderr: result.stderr };
}
function runChildren(packagePaths) {
  return Promise.all(packagePaths.map(packagePath => new Promise(resolve => {
    const child = childProcess.spawn(process.execPath, [path.join(__dirname, 'selftest-child.js'), packagePath], {
      cwd: __dirname, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe']
    });
    let stdout = '', stderr = '';
    child.stdout.on('data', chunk => { stdout += chunk; });
    child.stderr.on('data', chunk => { stderr += chunk; });
    child.on('close', status => resolve({ status, value: status === 0 ? JSON.parse(stdout) : null, stderr }));
  })));
}
function copyLedger(parent, source, name) { const target = path.join(parent, name); fs.cpSync(source, target, { recursive: true }); return target; }
function rewriteCanonical(file, mutate) {
  const value = JSON.parse(fs.readFileSync(file, 'utf8'));
  mutate(value);
  fs.writeFileSync(file, Ledger.stableStringify(value) + '\n', 'utf8');
}
function rehashOutcome(outcome) {
  const payload = copy(outcome); delete payload.outcomeDigest;
  outcome.outcomeDigest = Ledger.sha256(payload);
}
function rehashRecord(record) {
  const payload = copy(record); delete payload.recordDigest;
  record.recordDigest = Ledger.sha256(payload);
}

async function main() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'axm-review-outcome-ledger-'));
  try {
    const approvedItem = Fixture.outcomeFixture(tempRoot, 'APPROVED', 'approved');
    const heldItem = Fixture.outcomeFixture(tempRoot, 'HOLD', 'held');
    const rejectedItem = Fixture.outcomeFixture(tempRoot, 'REJECTED', 'rejected');
    const ledgerRoot = Fixture.makeDir(tempRoot, 'outcome-ledger');
    const options = Fixture.serviceOptions(ledgerRoot, 'v32-review-outcome-ledger:main');
    const service = Ledger.createService(options);

    equal(Ledger.MANIFEST_SCHEMA, 'axm.model-shadow-retention-audit-review-outcome-ledger-manifest/v1', 'manifest schema is exact');
    equal(Ledger.RECORD_SCHEMA, 'axm.model-shadow-retention-audit-review-outcome-ledger-record/v1', 'record schema is exact');
    equal(Ledger.SNAPSHOT_SCHEMA, 'axm.model-shadow-retention-audit-review-outcome-ledger-snapshot/v1', 'snapshot schema is exact');
    equal(Ledger.VERSION, '3.2.0', 'ledger version is exact');
    equal(Ledger.STATUS, 'TEST', 'ledger status remains TEST');
    equal(Ledger.MAX_RECORDS, 10000, 'record count bound is exact');
    equal(Ledger.MAX_ARTIFACT_CANONICAL_BYTES, 4194304, 'artifact byte bound is exact');
    equal(Ledger.MAX_AGGREGATE_STORAGE_BYTES, 268435456, 'aggregate byte bound is exact');
    equal(Ledger.MAX_CAPTURE_INPUT_CANONICAL_BYTES, 41943040, 'capture input byte bound is exact');
    equal(service.inspect(), null, 'absent ledger inspects as null');

    const approvedRecordedAt = Fixture.after(approvedItem.outcome.observedAt);
    const approvedInput = Fixture.captureInput(approvedItem, 'v32-record:approved', approvedRecordedAt);
    const pristineRoot = Fixture.makeDir(tempRoot, 'pristine-invalid-ledger');
    const pristineService = Ledger.createService(Fixture.serviceOptions(pristineRoot, 'v32-pristine-invalid'));
    const noConfirmation = copy(approvedInput); noConfirmation.confirmation = 'NOT_CONFIRMED';
    expectCode(() => pristineService.capture(noConfirmation), 'REVIEW_OUTCOME_LEDGER_CONFIRMATION_REQUIRED', 'capture requires exact unauthenticated confirmation');
    equal(fs.existsSync(namespace(pristineRoot)), false, 'invalid confirmation creates no namespace');
    const corruptOutcome = copy(approvedInput); corruptOutcome.outcome.outcomeDigest = 'sha256:' + '0'.repeat(64);
    expectCode(() => pristineService.capture(corruptOutcome), 'REVIEW_OUTCOME_LEDGER_V31_OUTCOME_INVALID', 'altered v3.1 outcome is refused before write');
    equal(fs.existsSync(namespace(pristineRoot)), false, 'invalid outcome creates no namespace');
    const corruptInput = copy(approvedInput); corruptInput.outcomeInput.pendingHandoff.handoffDigest = 'sha256:' + '0'.repeat(64);
    expectCode(() => pristineService.capture(corruptInput), 'REVIEW_OUTCOME_LEDGER_V31_OUTCOME_INVALID', 'altered v3.1 caller package is refused before write');
    const earlyInput = copy(approvedInput); earlyInput.recordedAt = '2020-01-01T00:00:00.001Z';
    expectCode(() => pristineService.capture(earlyInput), 'REVIEW_OUTCOME_LEDGER_TIME_INVALID', 'record before v3.1 outcome is refused');
    const extraInput = copy(approvedInput); extraInput.extra = true;
    expectCode(() => pristineService.capture(extraInput), 'INVALID_REVIEW_OUTCOME_LEDGER_INPUT', 'capture input extra field is refused');

    const overlapService = Ledger.createService(Fixture.serviceOptions(approvedItem.fixture.pending.fixture.observationRoot, 'v32-overlap'));
    expectCode(() => overlapService.capture(approvedInput), 'REVIEW_OUTCOME_LEDGER_ROOT_OVERLAP', 'equal ledger and upstream roots are refused');
    const parentOverlapService = Ledger.createService(Fixture.serviceOptions(tempRoot, 'v32-parent-overlap'));
    expectCode(() => parentOverlapService.capture(approvedInput), 'REVIEW_OUTCOME_LEDGER_ROOT_OVERLAP', 'nested ledger and upstream roots are refused');
    const missingRootOptions = Fixture.serviceOptions(path.join(tempRoot, 'missing-ledger-root'), 'v32-missing-root');
    expectCode(() => Ledger.createService(missingRootOptions), 'REVIEW_OUTCOME_LEDGER_STATE_ROOT_INVALID', 'missing ledger root is refused');
    expectCode(() => Ledger.createService(Fixture.serviceOptions(path.parse(tempRoot).root, 'v32-filesystem-root')), 'REVIEW_OUTCOME_LEDGER_STATE_ROOT_INVALID', 'filesystem root is refused');
    const fileRoot = path.join(tempRoot, 'not-a-directory'); fs.writeFileSync(fileRoot, 'x', 'utf8');
    expectCode(() => Ledger.createService(Fixture.serviceOptions(fileRoot, 'v32-file-root')), 'REVIEW_OUTCOME_LEDGER_STATE_ROOT_INVALID', 'file state root is refused');

    const approvedUpstreamRoot = approvedItem.fixture.pending.fixture.observationRoot;
    const approvedUpstreamBefore = treeDigest(approvedUpstreamRoot);
    const approvedRecord = service.capture(copy(approvedInput));
    equal(treeDigest(approvedUpstreamRoot), approvedUpstreamBefore, 'approved capture leaves durable upstream bytes unchanged');
    equal(approvedRecord.schema, Ledger.RECORD_SCHEMA, 'approved capture emits exact record schema');
    equal(approvedRecord.recordId, approvedInput.recordId, 'approved record id is exact');
    equal(approvedRecord.outcome, approvedItem.outcome, 'approved record persists exact minimized v3.1 outcome');
    equal(approvedRecord.classification, Ledger.CLASSIFICATIONS.APPROVED, 'approved outcome receives exact held classification');
    equal(approvedRecord.log.sequence, 1, 'first record has sequence one');
    equal(approvedRecord.log.previousRecordRef, null, 'first record has no previous reference');
    equal(approvedRecord.truth.v31OutcomeExactRebuiltBeforeWrite, true, 'record reports exact v3.1 rebuild before write');
    equal(approvedRecord.truth.actorDigestProvenanceExactRebuiltBeforeWrite, true, 'record reports actor digest derivation checked before write');
    equal(approvedRecord.truth.actorDigestProvenanceReverifiedOnReload, false, 'record refuses reload provenance re-verification claim');
    equal(approvedRecord.truth.holdResolved, false, 'approved persistence leaves retention hold unresolved');
    equal(approvedRecord.truth.executionAuthorized, false, 'approved persistence grants no execution authority');
    equal(approvedRecord.truth.localControllerFullRewriteExcluded, false, 'record refuses full local rewrite exclusion');
    check(fs.existsSync(manifestFile(ledgerRoot)), 'first capture persists manifest');
    check(fs.existsSync(recordFile(ledgerRoot, 1)), 'first capture persists record one');
    equal(fs.readFileSync(recordFile(ledgerRoot, 1), 'utf8'), Ledger.stableStringify(approvedRecord) + '\n', 'record file is exact canonical JSON');
    equal(service.read(1), approvedRecord, 'read returns exact first record');
    equal(service.verifyPersisted(approvedRecord).pass, true, 'persisted record verifier accepts exact first record');

    const oneRecordRoot = copyLedger(tempRoot, ledgerRoot, 'one-record-full-rewrite-counterexample');
    const firstSnapshot = service.inspect();
    equal(firstSnapshot.recordCount, 1, 'first snapshot counts one record');
    equal(firstSnapshot.approvedCount, 1, 'first snapshot counts one approval observation');
    equal(firstSnapshot.holdCount, 0, 'first snapshot counts no hold observation');
    equal(firstSnapshot.rejectedCount, 0, 'first snapshot counts no rejection observation');
    equal(firstSnapshot.truth.completeRecordChainValidated, true, 'snapshot reports complete record chain validation');
    equal(firstSnapshot.truth.actorDigestProvenanceReverifiedOnReload, false, 'snapshot refuses raw actor provenance reload claim');
    equal(firstSnapshot.truth.localControllerFullRewriteExcluded, false, 'snapshot refuses full local rewrite exclusion');

    expectCode(() => service.capture(copy(approvedInput)), 'REVIEW_OUTCOME_LEDGER_DUPLICATE', 'duplicate approved outcome is refused');
    const duplicateRecordId = Fixture.captureInput(heldItem, approvedInput.recordId, Fixture.laterThan([approvedRecordedAt, heldItem.outcome.observedAt]));
    expectCode(() => service.capture(duplicateRecordId), 'REVIEW_OUTCOME_LEDGER_DUPLICATE', 'duplicate record id with another outcome is refused');
    equal(service.inspect().recordCount, 1, 'duplicate refusals append no record');

    const heldRecordedAt = Fixture.laterThan([approvedRecordedAt, heldItem.outcome.observedAt]);
    const heldInput = Fixture.captureInput(heldItem, 'v32-record:held', heldRecordedAt);
    const heldUpstreamBefore = treeDigest(heldItem.fixture.pending.fixture.observationRoot);
    const heldRecord = service.capture(copy(heldInput));
    equal(treeDigest(heldItem.fixture.pending.fixture.observationRoot), heldUpstreamBefore, 'held capture leaves durable upstream bytes unchanged');
    equal(heldRecord.classification, Ledger.CLASSIFICATIONS.HOLD, 'held outcome receives exact held classification');
    equal(heldRecord.log.sequence, 2, 'held record advances sequence');
    equal(heldRecord.log.previousRecordRef.sha256, approvedRecord.recordDigest, 'held record chains exact approved record digest');
    equal(heldRecord.outcome, heldItem.outcome, 'held record persists exact minimized outcome');

    const rejectedRecordedAt = Fixture.laterThan([heldRecordedAt, rejectedItem.outcome.observedAt]);
    const rejectedInput = Fixture.captureInput(rejectedItem, 'v32-record:rejected', rejectedRecordedAt);
    const rejectedUpstreamBefore = treeDigest(rejectedItem.fixture.pending.fixture.observationRoot);
    const rejectedRecord = service.capture(copy(rejectedInput));
    equal(treeDigest(rejectedItem.fixture.pending.fixture.observationRoot), rejectedUpstreamBefore, 'rejected capture leaves durable upstream bytes unchanged');
    equal(rejectedRecord.classification, Ledger.CLASSIFICATIONS.REJECTED, 'rejected outcome receives exact held classification');
    equal(rejectedRecord.log.sequence, 3, 'rejected record advances sequence');
    equal(rejectedRecord.log.previousRecordRef.sha256, heldRecord.recordDigest, 'rejected record chains exact held record digest');
    equal(rejectedRecord.outcome, rejectedItem.outcome, 'rejected record persists exact minimized outcome');
    equal(service.verifyPersisted(rejectedRecord).pass, true, 'persisted verifier accepts exact rejected record');
    const alteredPresentedRecord = copy(rejectedRecord); alteredPresentedRecord.decision.observationOnly = false;
    equal(service.verifyPersisted(alteredPresentedRecord).pass, false, 'persisted verifier refuses altered presented record');

    const finalSnapshot = service.inspect();
    equal(finalSnapshot.recordCount, 3, 'snapshot counts all three records');
    equal(finalSnapshot.approvedCount, 1, 'snapshot counts one approved outcome');
    equal(finalSnapshot.holdCount, 1, 'snapshot counts one held outcome');
    equal(finalSnapshot.rejectedCount, 1, 'snapshot counts one rejected outcome');
    equal(finalSnapshot.latestRecordRef.sha256, rejectedRecord.recordDigest, 'snapshot binds latest record digest');
    equal(finalSnapshot.latestOutcomeRef.sha256, rejectedItem.outcome.outcomeDigest, 'snapshot binds latest outcome digest');
    equal(finalSnapshot.latestClassification, Ledger.CLASSIFICATIONS.REJECTED, 'snapshot exposes latest classification');
    equal(finalSnapshot.truth.holdResolved, false, 'snapshot leaves retention hold unresolved');
    equal(finalSnapshot.truth.externalRetentionProven, false, 'snapshot claims no external retention');
    equal(finalSnapshot.truth.protectedMonotonicStateProven, false, 'snapshot claims no protected monotonic state');
    equal(finalSnapshot.truth.directoryEntryOrHardwareDurabilityProven, false, 'snapshot claims no directory or hardware durability');
    equal(service.readAll(), [approvedRecord, heldRecord, rejectedRecord], 'single-load complete history read returns every exact record');

    const nonforwardItem = Fixture.outcomeFixture(tempRoot, 'HOLD', 'nonforward');
    const nonforwardInput = Fixture.captureInput(nonforwardItem, 'v32-record:nonforward', rejectedRecordedAt);
    expectCode(() => service.capture(nonforwardInput), 'REVIEW_OUTCOME_LEDGER_TIME_INVALID', 'record times must move strictly forward');
    const oversized = copy(nonforwardInput); oversized.padding = 'x'.repeat(Ledger.MAX_CAPTURE_INPUT_CANONICAL_BYTES);
    expectCode(() => service.capture(oversized), 'REVIEW_OUTCOME_LEDGER_INPUT_TOO_LARGE', 'oversized capture input is refused before processing');

    const childInspectPath = writePackage(tempRoot, 'child-inspect-before-loss', { action: 'inspect', serviceOptions: options });
    const childInspect = runChild(childInspectPath);
    equal(childInspect.status, 0, 'fresh child inspect exits zero');
    equal(childInspect.value.result, finalSnapshot, 'fresh child reloads exact snapshot');
    const childReadPath = writePackage(tempRoot, 'child-read-before-loss', { action: 'read', serviceOptions: options, sequence: 2 });
    const childRead = runChild(childReadPath);
    equal(childRead.status, 0, 'fresh child read exits zero');
    equal(childRead.value.result, heldRecord, 'fresh child reads exact held record');
    const childReadAllPath = writePackage(tempRoot, 'child-read-all-before-loss', { action: 'readAll', serviceOptions: options });
    const childReadAll = runChild(childReadAllPath);
    equal(childReadAll.status, 0, 'fresh child complete history read exits zero');
    equal(childReadAll.value.result, [approvedRecord, heldRecord, rejectedRecord], 'fresh child reads every exact record in one validated load');

    const corruptDigestRoot = copyLedger(tempRoot, ledgerRoot, 'corrupt-record-digest');
    rewriteCanonical(recordFile(corruptDigestRoot, 1), value => { value.recordDigest = 'sha256:' + '0'.repeat(64); });
    expectCode(() => Ledger.createService(Fixture.serviceOptions(corruptDigestRoot, options.ledgerId, options.createdAt)).inspect(), 'REVIEW_OUTCOME_LEDGER_RECORD_CORRUPT', 'corrupt record digest fails closed');
    const corruptManifestRoot = copyLedger(tempRoot, ledgerRoot, 'corrupt-manifest');
    rewriteCanonical(manifestFile(corruptManifestRoot), value => { value.manifestDigest = 'sha256:' + '0'.repeat(64); });
    expectCode(() => Ledger.createService(Fixture.serviceOptions(corruptManifestRoot, options.ledgerId, options.createdAt)).inspect(), 'REVIEW_OUTCOME_LEDGER_MANIFEST_CORRUPT', 'corrupt manifest fails closed');
    const corruptChainRoot = copyLedger(tempRoot, ledgerRoot, 'corrupt-chain');
    rewriteCanonical(recordFile(corruptChainRoot, 2), value => {
      value.log.previousRecordRef.sha256 = 'sha256:' + '1'.repeat(64);
      rehashRecord(value);
    });
    expectCode(() => Ledger.createService(Fixture.serviceOptions(corruptChainRoot, options.ledgerId, options.createdAt)).inspect(), 'REVIEW_OUTCOME_LEDGER_RECORD_CORRUPT', 'self-consistent previous-reference drift fails closed');
    const inflatedRoot = copyLedger(tempRoot, ledgerRoot, 'inflated-outcome');
    rewriteCanonical(recordFile(inflatedRoot, 1), value => {
      value.outcome.truth.holdResolved = true;
      rehashOutcome(value.outcome);
      value.outcomeRef.sha256 = value.outcome.outcomeDigest;
      rehashRecord(value);
    });
    expectCode(() => Ledger.createService(Fixture.serviceOptions(inflatedRoot, options.ledgerId, options.createdAt)).inspect(), 'REVIEW_OUTCOME_LEDGER_RECORD_CORRUPT', 'authority-inflated stored outcome fails closed');
    const gapRoot = copyLedger(tempRoot, ledgerRoot, 'gap');
    fs.renameSync(recordFile(gapRoot, 2), recordFile(gapRoot, 4));
    expectCode(() => Ledger.createService(Fixture.serviceOptions(gapRoot, options.ledgerId, options.createdAt)).inspect(), 'REVIEW_OUTCOME_LEDGER_SEQUENCE_CORRUPT', 'record sequence gap fails closed');
    const extraRoot = copyLedger(tempRoot, ledgerRoot, 'extra');
    fs.writeFileSync(path.join(namespace(extraRoot), 'unexpected.txt'), 'unexpected', 'utf8');
    expectCode(() => Ledger.createService(Fixture.serviceOptions(extraRoot, options.ledgerId, options.createdAt)).inspect(), 'REVIEW_OUTCOME_LEDGER_NAMESPACE_CORRUPT', 'unexpected namespace item fails closed');
    const noncanonicalRoot = copyLedger(tempRoot, ledgerRoot, 'noncanonical');
    fs.appendFileSync(recordFile(noncanonicalRoot, 1), ' ');
    expectCode(() => Ledger.createService(Fixture.serviceOptions(noncanonicalRoot, options.ledgerId, options.createdAt)).inspect(), 'REVIEW_OUTCOME_LEDGER_RECORD_CORRUPT', 'noncanonical record bytes fail closed');
    const missingManifestRoot = copyLedger(tempRoot, ledgerRoot, 'missing-manifest');
    fs.rmSync(manifestFile(missingManifestRoot), { force: true });
    expectCode(() => Ledger.createService(Fixture.serviceOptions(missingManifestRoot, options.ledgerId, options.createdAt)).inspect(), 'REVIEW_OUTCOME_LEDGER_MANIFEST_MISSING', 'records without manifest fail closed');
    const oversizedRecordRoot = copyLedger(tempRoot, ledgerRoot, 'oversized-record');
    fs.writeFileSync(recordFile(oversizedRecordRoot, 1), Buffer.alloc(Ledger.MAX_ARTIFACT_CANONICAL_BYTES + 2, 0x20));
    expectCode(() => Ledger.createService(Fixture.serviceOptions(oversizedRecordRoot, options.ledgerId, options.createdAt)).inspect(), 'REVIEW_OUTCOME_LEDGER_RECORD_CORRUPT', 'oversized stored record fails closed');
    const wrongIdentityOptions = copy(options); wrongIdentityOptions.ledgerId = 'v32-wrong-ledger-id';
    expectCode(() => Ledger.createService(wrongIdentityOptions).inspect(), 'REVIEW_OUTCOME_LEDGER_MANIFEST_CORRUPT', 'configured manifest identity mismatch fails closed');

    fs.writeFileSync(path.join(namespace(ledgerRoot), Ledger.LOCK_FILE), '{}\n', 'utf8');
    expectCode(() => service.inspect(), 'REVIEW_OUTCOME_LEDGER_BUSY', 'pre-existing operation lock fails closed');
    fs.rmSync(path.join(namespace(ledgerRoot), Ledger.LOCK_FILE), { force: true });
    equal(service.inspect(), finalSnapshot, 'ledger reloads after exact synthetic lock cleanup');

    rewriteCanonical(recordFile(oneRecordRoot, 1), value => {
      value.outcome.reviewOutcome.votes[0].actorDigest = Ledger.sha256('review-actor:controller-rewrite');
      value.outcome.reviewOutcome.votes.sort((left, right) => left.actorDigest < right.actorDigest ? -1 : (left.actorDigest > right.actorDigest ? 1 : 0));
      rehashOutcome(value.outcome);
      value.outcomeRef.sha256 = value.outcome.outcomeDigest;
      rehashRecord(value);
    });
    const rewrittenSnapshot = Ledger.createService(Fixture.serviceOptions(oneRecordRoot, options.ledgerId, options.createdAt)).inspect();
    equal(rewrittenSnapshot.recordCount, 1, 'self-consistent full local record rewrite remains internally loadable');
    equal(rewrittenSnapshot.truth.localControllerFullRewriteExcluded, false, 'rewritten snapshot refuses tamper-exclusion claim');
    check(rewrittenSnapshot.latestOutcomeRef.sha256 !== approvedItem.outcome.outcomeDigest, 'rewritten local outcome has different identity from captured original');

    const concurrentItem = Fixture.outcomeFixture(tempRoot, 'APPROVED', 'concurrent');
    const concurrentRoot = Fixture.makeDir(tempRoot, 'concurrent-ledger');
    const concurrentOptions = Fixture.serviceOptions(concurrentRoot, 'v32-concurrent-ledger');
    const concurrentInput = Fixture.captureInput(concurrentItem, 'v32-record:concurrent', Fixture.after(concurrentItem.outcome.observedAt));
    const concurrentPackage = { action: 'capture', serviceOptions: concurrentOptions, input: concurrentInput };
    const concurrentResults = await runChildren([
      writePackage(tempRoot, 'concurrent-a', concurrentPackage),
      writePackage(tempRoot, 'concurrent-b', concurrentPackage)
    ]);
    equal(concurrentResults.filter(result => result.status === 0).length, 1, 'exactly one concurrent duplicate writer succeeds');
    equal(concurrentResults.filter(result => result.status !== 0).length, 1, 'exactly one concurrent duplicate writer fails closed');
    equal(Ledger.createService(concurrentOptions).inspect().recordCount, 1, 'concurrent race persists exactly one record');

    const publicArtifacts = [approvedRecord, heldRecord, rejectedRecord, finalSnapshot];
    const publicText = JSON.stringify(publicArtifacts);
    const publicKeys = new Set();
    (function collectKeys(value) {
      if (Array.isArray(value)) return value.forEach(collectKeys);
      if (!value || typeof value !== 'object') return;
      Object.keys(value).forEach(key => { publicKeys.add(key); collectKeys(value[key]); });
    })(publicArtifacts);
    ['Alice Reviewer', 'Machine Seat', 'Alice exact artifact approval note', 'Machine exact artifact approval note'].forEach(secret => {
      check(!publicText.includes(secret), 'persisted public artifacts omit raw review material: ' + secret);
    });
    [tempRoot, ledgerRoot, approvedItem.fixture.pending.fixture.observationRoot, heldItem.fixture.pending.fixture.observationRoot].forEach(secretPath => {
      check(!publicText.includes(secretPath), 'persisted public artifacts omit configured path');
    });
    ['outcomeInput', 'reviewItem', 'pendingHandoffInput', 'stateRoot', 'serviceOptions'].forEach(key => {
      check(!publicKeys.has(key), 'persisted public artifacts omit package key ' + key);
    });
    check(publicText.includes('rawActorIdentityPersisted') && publicText.includes('completeV31InputPersisted'), 'public artifacts retain explicit minimization truth');
    equal(Ledger.stableStringify(JSON.parse(Ledger.stableStringify(finalSnapshot))), Ledger.stableStringify(finalSnapshot), 'snapshot canonical JSON is stable');
    equal(Ledger.buildManifest, undefined, 'manifest completion builder is not exported');
    equal(Ledger.buildRecord, undefined, 'record completion builder is not exported');

    const implementation = fs.readFileSync(path.join(__dirname, 'model-shadow-retention-audit-review-outcome-ledger.js'), 'utf8');
    check(!implementation.includes('fetch(') && !implementation.includes('https.request') && !implementation.includes('http.request'), 'runtime has no network invocation');
    check(!implementation.includes('child_process'), 'runtime launches no child process');
    check(!implementation.includes('review-service') && !implementation.includes('ReviewService'), 'runtime imports no ReviewService');
    check(!implementation.includes('bridge-token') && !implementation.includes('Authorization:'), 'runtime contains no credential source');
    check(implementation.includes('fs.openSync') && implementation.includes("'wx'") && implementation.includes('fs.fsyncSync'), 'runtime uses exclusive create and file fsync');
    check(implementation.includes('actorDigestProvenanceReverifiedOnReload: false'), 'runtime refuses actor provenance reload claim');
    check(implementation.includes('localControllerFullRewriteExcluded: false'), 'runtime preserves full local rewrite counterevidence');
    check(implementation.includes('directoryEntryOrHardwareDurabilityProven: false'), 'runtime refuses directory and hardware durability claim');
    check(implementation.includes('humanBenefitProven: false') && implementation.includes('broadLearningClaimed: false'), 'runtime refuses benefit and learning claims');

    const contract = require('./module.contract.json');
    equal(contract.version, 'v3.2', 'contract version is exact');
    equal(contract.status, 'TEST', 'contract status remains TEST');
    equal(contract.merge_gate, 'Mike Tobi / AXM', 'contract preserves human merge gate');
    equal(contract.lifecycle.installed, false, 'module remains uninstalled');
    equal(contract.lifecycle.promoted, false, 'module remains unpromoted');
    check(contract.boundaries.writes.some(value => value.includes('outcome') && value.includes('file-fsync')), 'contract declares outcome file-fsync write');
    check(contract.boundaries.refuses.includes('reload-as-independent-raw-actor-digest-provenance-proof'), 'contract refuses reload as raw actor provenance proof');
    check(contract.boundaries.refuses.includes('caller-controlled-full-ledger-rewrite-as-detectable-tamper-or-original-history-proof'), 'contract refuses full rewrite as original history proof');
    check(contract.boundaries.refuses.includes('persisted-approval-as-hold-resolution-remediation-or-execution-authority'), 'contract refuses persisted approval authority');
    const contractCheck = ContractVerifier.validateContract(contract);
    equal(contractCheck.pass, true, 'module contract passes repository verifier');
    equal(contractCheck.errors, [], 'module contract verifier reports no errors');

    const schemas = ['manifest.schema.json', 'record.schema.json', 'snapshot.schema.json'];
    schemas.forEach(name => {
      const schema = JSON.parse(fs.readFileSync(path.join(__dirname, name), 'utf8'));
      equal(schema.$schema, 'https://json-schema.org/draft/2020-12/schema', name + ' declares Draft 2020-12');
      equal(schema.additionalProperties, false, name + ' is closed at root');
    });
    const recordSchema = require('./record.schema.json');
    equal(recordSchema.properties.outcome.$ref, '../model-shadow-retention-audit-review-outcome/review-outcome.schema.json', 'record schema reuses exact v3.1 outcome schema');
    equal(recordSchema.properties.truth.properties.actorDigestProvenanceReverifiedOnReload.const, false, 'record schema fixes reload provenance false');
    equal(recordSchema.properties.truth.properties.holdResolved.const, false, 'record schema fixes hold resolution false');
    equal(recordSchema.properties.truth.properties.executionAuthorized.const, false, 'record schema fixes execution authority false');

    const upstreamRoots = [
      approvedItem.fixture.pending.fixture.observationRoot,
      heldItem.fixture.pending.fixture.observationRoot,
      rejectedItem.fixture.pending.fixture.observationRoot
    ];
    upstreamRoots.forEach(root => verifiedRemove(root, tempRoot));
    upstreamRoots.forEach(root => equal(fs.existsSync(root), false, 'synthetic upstream observation root is absent after bounded removal'));
    const afterLossInspect = runChild(writePackage(tempRoot, 'child-inspect-after-upstream-loss', { action: 'inspect', serviceOptions: options }));
    equal(afterLossInspect.status, 0, 'fresh process reload after upstream loss exits zero');
    equal(afterLossInspect.value.result, finalSnapshot, 'fresh process reloads exact snapshot after upstream loss');
    const afterLossRead = runChild(writePackage(tempRoot, 'child-read-after-upstream-loss', { action: 'read', serviceOptions: options, sequence: 1 }));
    equal(afterLossRead.status, 0, 'fresh process read after upstream loss exits zero');
    equal(afterLossRead.value.result, approvedRecord, 'fresh process preserves exact approved outcome after upstream loss');

    const replacementItem = Fixture.outcomeFixture(tempRoot, 'HOLD', 'replacement');
    const replacementRoot = Fixture.makeDir(tempRoot, 'replacement-ledger');
    const replacementOptions = Fixture.serviceOptions(replacementRoot, options.ledgerId, options.createdAt);
    const replacementInput = Fixture.captureInput(replacementItem, 'v32-record:replacement', Fixture.after(replacementItem.outcome.observedAt));
    const replacementRecord = Ledger.createService(replacementOptions).capture(replacementInput);
    const replacementSnapshot = Ledger.createService(replacementOptions).inspect();
    equal(replacementSnapshot.manifestRef, finalSnapshot.manifestRef, 'replacement ledger can reuse the same configured manifest identity');
    check(replacementRecord.recordDigest !== approvedRecord.recordDigest, 'replacement ledger has different record identity');
    equal(replacementSnapshot.truth.localControllerFullRewriteExcluded, false, 'replacement ledger refuses original-history proof');
    verifiedRemove(ledgerRoot, tempRoot);
    equal(fs.existsSync(ledgerRoot), false, 'synthetic original outcome ledger root is absent after joint-loss simulation');
    equal(service.inspect(), null, 'original service has no continuity after its ledger root is removed');
    equal(Ledger.createService(replacementOptions).inspect().recordCount, 1, 'another internally exact local ledger remains possible after original loss');

    console.log('RESULT ' + checks + ' focused assertions passed');
  } finally {
    verifiedRemove(tempRoot, path.dirname(tempRoot));
  }
}

main().catch(error => {
  console.error(error && error.stack ? error.stack : error);
  process.exitCode = 1;
});
