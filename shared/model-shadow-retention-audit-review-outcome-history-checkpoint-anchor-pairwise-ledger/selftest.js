#!/usr/bin/env node
'use strict';

const assert = require('assert');
const childProcess = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const ContractVerifier = require('../../hub/module-contract-verifier');
const Pairwise = require('../model-shadow-retention-audit-review-outcome-history-checkpoint-anchor-pairwise/model-shadow-retention-audit-review-outcome-history-checkpoint-anchor-pairwise');
const PairwiseFixture = require('../model-shadow-retention-audit-review-outcome-history-checkpoint-anchor-pairwise/selftest-fixture');
const Ledger = require('./model-shadow-retention-audit-review-outcome-history-checkpoint-anchor-pairwise-ledger');
const Fixture = require('./selftest-fixture');

let checks = 0;
function check(value, label) { assert.ok(value, label); checks += 1; console.log('PASS ' + label); }
function equal(actual, expected, label) { assert.deepStrictEqual(actual, expected, label); checks += 1; console.log('PASS ' + label); }
function throwsCode(operation, expected, label) {
  let observed = null;
  try { operation(); } catch (error) { observed = error.code || error.name; }
  equal(observed, expected, label);
}
function copy(value) { return Fixture.copy(value); }
function verifiedRemove(target, parent) {
  const resolvedTarget = path.resolve(target); const resolvedParent = path.resolve(parent);
  if (resolvedTarget === resolvedParent || !resolvedTarget.startsWith(resolvedParent + path.sep)) throw new Error('unsafe cleanup target');
  fs.rmSync(resolvedTarget, { recursive: true, force: true });
}
function treeDigest(root) {
  const entries = [];
  function walk(current, relative) {
    fs.readdirSync(current, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name)).forEach(entry => {
      const absolute = path.join(current, entry.name); const child = relative ? relative + '/' + entry.name : entry.name;
      if (entry.isDirectory()) { entries.push({ path: child, type: 'directory' }); walk(absolute, child); }
      else entries.push({ path: child, type: 'file', digest: crypto.createHash('sha256').update(fs.readFileSync(absolute)).digest('hex') });
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
    cwd: __dirname, encoding: 'utf8', windowsHide: true, timeout: 120000, maxBuffer: 64 * 1024 * 1024
  });
  if (result.status !== 0) throw new Error('child process transport failed: ' + result.stderr);
  return JSON.parse(result.stdout);
}
function runChildAsync(packagePath) {
  return new Promise((resolve, reject) => {
    const child = childProcess.spawn(process.execPath, [path.join(__dirname, 'selftest-child.js'), packagePath], {
      cwd: __dirname, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe']
    });
    let stdout = ''; let stderr = '';
    child.stdout.on('data', value => { stdout += value; });
    child.stderr.on('data', value => { stderr += value; });
    child.on('error', reject);
    child.on('close', code => {
      if (code !== 0) reject(new Error('concurrent child transport failed: ' + stderr));
      else { try { resolve(JSON.parse(stdout)); } catch (error) { reject(new Error('concurrent child returned invalid JSON: ' + stdout)); } }
    });
  });
}
function cloneRoot(parent, source, name) {
  const target = path.join(parent, name);
  fs.cpSync(source, target, { recursive: true });
  return target;
}
function namespace(root) { return path.join(root, Ledger.NAMESPACE); }
function entryFile(root, sequence) { return path.join(namespace(root), Ledger.ENTRIES_DIRECTORY, String(sequence).padStart(12, '0') + '.json'); }
function canonicalRead(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }
function canonicalWrite(file, value) { fs.writeFileSync(file, Ledger.stableStringify(value) + '\n', 'utf8'); }
function makeReplayTransition(previous, candidate, tag) {
  const input = PairwiseFixture.transitionInput(previous, candidate, tag);
  return { input, receipt: Pairwise.buildTransition(input) };
}
function everyObjectClosed(schema) {
  let pass = true;
  function walk(value) {
    if (!value || typeof value !== 'object') return;
    if (value.type === 'object' && value.additionalProperties !== false) pass = false;
    Object.values(value).forEach(walk);
  }
  walk(schema); return pass;
}
function assertClosedShape(value, schema, root, label) {
  if (schema.$ref) {
    if (!schema.$ref.startsWith('#/')) return;
    schema = schema.$ref.split('/').slice(1).reduce((current, key) => current[key], root);
  }
  if (schema.oneOf) {
    const selected = value === null ? schema.oneOf.find(item => item.type === 'null') : schema.oneOf.find(item => item.$ref || item.type !== 'null');
    return assertClosedShape(value, selected, root, label);
  }
  if (schema.type === 'object') {
    assert.strictEqual(schema.additionalProperties, false, label + ' schema must be closed');
    assert.deepStrictEqual(Object.keys(value).sort(), schema.required.slice().sort(), label + ' fields must be exact');
    Object.keys(value).forEach(key => assertClosedShape(value[key], schema.properties[key], root, label + '.' + key));
  }
}

async function main() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'axm-v36-anchored-pairwise-ledger-'));
  try {
    const scenario = Fixture.buildScenario(tempRoot);
    const localRoot = Fixture.makeDir(tempRoot, 'local-ledger-main');
    const options = Fixture.serviceOptions(localRoot, scenario);
    const service = Ledger.createService(copy(options));

    equal(Ledger.VERSION, '3.6.0', 'version is exact');
    equal(Ledger.STATUS, 'TEST', 'status remains TEST');
    equal(Ledger.MAX_INPUT_CANONICAL_BYTES, 138412032, 'transient input envelope is bounded to 132 MiB');
    equal(Ledger.MAX_ARTIFACT_CANONICAL_BYTES, 2097152, 'persisted artifact is bounded to 2 MiB');
    equal(Ledger.MAX_LEDGER_BYTES, 268435456, 'aggregate ledger is bounded to 256 MiB');
    equal(Ledger.MAX_ENTRIES, 10000, 'entry count is bounded to ten thousand');
    equal(service.inspect(), null, 'absent local namespace inspects as null');
    equal(fs.existsSync(namespace(localRoot)), false, 'inspection creates no namespace');

    const wrongConfirmation = Fixture.recordInput(scenario.transitionA, 'wrong-confirmation', 'YES');
    throwsCode(() => service.record(wrongConfirmation), 'CONFIRMATION_REQUIRED', 'wrong confirmation fails before write');
    equal(fs.existsSync(namespace(localRoot)), false, 'wrong confirmation leaves namespace absent');
    const exactReplayTransition = makeReplayTransition(scenario.basePackage, scenario.basePackage, 'v36-exact-replay');
    const exactReplayInput = Fixture.recordInput(exactReplayTransition, 'exact-replay', Ledger.CONFIRMATION);
    throwsCode(() => service.record(exactReplayInput), 'TRANSITION_NOT_FORWARD_EXTENSION', 'nonforward exact replay fails before write');
    equal(fs.existsSync(namespace(localRoot)), false, 'nonforward receipt leaves namespace absent');
    const tamperedTransition = Fixture.recordInput(scenario.transitionA, 'tampered-transition', Ledger.CONFIRMATION);
    tamperedTransition.transitionReceipt.transitionDigest = 'sha256:' + '0'.repeat(64);
    throwsCode(() => service.record(tamperedTransition), 'TRANSITION_INVALID', 'tampered v3.5 receipt fails before write');
    equal(fs.existsSync(namespace(localRoot)), false, 'tampered receipt leaves namespace absent');
    const earlyRecord = Fixture.recordInput(scenario.transitionA, 'early-time', Ledger.CONFIRMATION);
    earlyRecord.recordedAt = scenario.transitionA.input.comparedAt.replace(/\d{2}\.000Z$/, '00.000Z');
    if (Date.parse(earlyRecord.recordedAt) >= Date.parse(scenario.transitionA.input.comparedAt)) earlyRecord.recordedAt = '2020-01-01T00:00:00.000Z';
    throwsCode(() => service.record(earlyRecord), 'INVALID_INPUT', 'recording time before comparison fails before write');
    equal(fs.existsSync(namespace(localRoot)), false, 'early recording time leaves namespace absent');

    const uncertaintyRoot = Fixture.makeDir(tempRoot, 'fsync-uncertainty-ledger');
    const uncertaintyService = Ledger.createService(Fixture.serviceOptions(uncertaintyRoot, scenario, 'v36-fsync-uncertainty'));
    const originalFsyncSync = fs.fsyncSync;
    let fsyncCalls = 0;
    let durabilityError = null;
    try {
      fs.fsyncSync = descriptor => {
        fsyncCalls += 1;
        if (fsyncCalls === 2) {
          const error = new Error('injected entry fsync failure');
          error.code = 'EIO';
          throw error;
        }
        return originalFsyncSync(descriptor);
      };
      try {
        uncertaintyService.record(Fixture.recordInput(scenario.transitionA, 'fsync-uncertainty', Ledger.CONFIRMATION));
      } catch (error) {
        durabilityError = error;
      }
    } finally {
      fs.fsyncSync = originalFsyncSync;
    }
    equal(durabilityError && durabilityError.code, 'TRANSITION_LEDGER_ENTRY_DURABILITY_UNCERTAIN', 'entry fsync failure has a typed durability-uncertain result');
    equal(fsyncCalls, 2, 'fault injection reaches the entry fsync after the manifest fsync');
    const uncertaintySnapshot = uncertaintyService.inspect();
    equal(uncertaintySnapshot.entryCount, 1, 'entry write may remain inspectable after an fsync failure');
    const uncertainEntry = canonicalRead(entryFile(uncertaintyRoot, 1));
    equal(uncertainEntry.truth.successfulRecordReturnRequiresEntryFileFsync, true, 'retained entry describes the successful-return requirement');
    equal(uncertainEntry.truth.writeAndReloadCompletionPersistedSeparately, false, 'retained entry does not claim that write fsync and reload completed');
    equal(uncertaintySnapshot.truth.externalRetentionProven, false, 'retained entry and local reload do not prove external durability');

    const sourceBefore = treeDigest(scenario.sourceRoots.baseRoot);
    const firstInput = Fixture.recordInput(scenario.transitionA, 'forward-a', Ledger.CONFIRMATION);
    firstInput.recordedAt = PairwiseFixture.add(scenario.transitionD.input.comparedAt, 60000);
    const first = service.record(firstInput);
    equal(treeDigest(scenario.sourceRoots.baseRoot), sourceBefore, 'recording leaves upstream source ledger byte-for-byte unchanged');
    equal(first.log.sequence, 1, 'first valid transition receives sequence one');
    equal(first.previousEntryRef, null, 'first entry has no previous entry reference');
    equal(first.transitionReceipt, scenario.transitionA.receipt, 'entry persists the exact minimized v3.5 receipt');
    equal(first.previousAnchoredCheckpointRef, scenario.transitionA.receipt.previousAnchoredCheckpointRef, 'entry binds exact previous anchored package');
    equal(first.candidateAnchoredCheckpointRef, scenario.transitionA.receipt.candidateAnchoredCheckpointRef, 'entry binds exact candidate anchored package');
    equal(first.previousAnchorEpoch, 1, 'first entry consumes epoch one');
    equal(first.candidateAnchorEpoch, 2, 'first entry advances to epoch two');
    equal(first.truth.localHeadAdvancedWhileThisLedgerRootIsPreserved, true, 'entry truth limits head advancement to preserved root');
    equal(first.truth.globalTransitionUniquenessProven, false, 'entry claims no global transition uniqueness');
    equal(first.truth.externalRetentionProven, false, 'entry claims no external retention');
    equal(first.truth.executionAuthorized, false, 'entry grants no execution authority');
    equal(first.truth.automaticCanon, false, 'entry grants no CANON status');
    equal(service.verifyPersisted(firstInput, first).pass, true, 'caller package exact-rebuilds persisted first entry');

    const firstSnapshot = service.inspect();
    equal(firstSnapshot.entryCount, 1, 'snapshot reports one validated entry');
    equal(firstSnapshot.currentAnchoredCheckpointRef, first.candidateAnchoredCheckpointRef, 'snapshot derives exact anchored-package head');
    equal(firstSnapshot.currentCheckpointRef, first.candidateCheckpointRef, 'snapshot derives exact checkpoint head');
    equal(firstSnapshot.currentAnchorEpoch, 2, 'snapshot derives exact caller epoch head');
    equal(firstSnapshot.truth.upstreamPackagesReverifiedWithoutCallerInput, false, 'inspect claims no upstream rebuild without caller package');
    equal(firstSnapshot.truth.protectedMonotonicStateProven, false, 'snapshot claims no protected monotonic state');

    const manifestPath = path.join(namespace(localRoot), Ledger.MANIFEST_FILE);
    const storedFirstPath = entryFile(localRoot, 1);
    const manifestRaw = fs.readFileSync(manifestPath, 'utf8');
    const firstRaw = fs.readFileSync(storedFirstPath, 'utf8');
    equal(manifestRaw, Ledger.stableStringify(JSON.parse(manifestRaw)) + '\n', 'manifest bytes are exact canonical JSON');
    equal(firstRaw, Ledger.stableStringify(JSON.parse(firstRaw)) + '\n', 'entry bytes are exact canonical JSON');

    const childInspect = runChild(writePackage(tempRoot, 'child-inspect', { action: 'inspect', serviceOptions: options }));
    equal(childInspect.ok, true, 'fresh process reloads local ledger');
    check(childInspect.pid !== process.pid, 'fresh inspection uses a distinct process');
    equal(childInspect.result, firstSnapshot, 'fresh process derives exact snapshot');
    const childVerify = runChild(writePackage(tempRoot, 'child-verify', { action: 'verify', serviceOptions: options, input: firstInput, receipt: first }));
    equal(childVerify.ok, true, 'fresh process executes persisted verification');
    check(childVerify.pid !== process.pid, 'fresh verification uses a distinct process');
    equal(childVerify.result.pass, true, 'fresh process exact-rebuilds persisted entry with caller package');

    const staleB = Fixture.recordInput(scenario.transitionB, 'stale-fork-b', Ledger.CONFIRMATION);
    throwsCode(() => service.record(staleB), 'STALE_LOCAL_HEAD', 'second branch from consumed genesis is refused locally');
    equal(service.inspect().entryCount, 1, 'stale second branch creates no entry');

    const alternateA = PairwiseFixture.buildPackage(scenario.forkAPackage.anchoredInput.witnessInput.checkpoint, 'v36-alternate-a', scenario.authority, { anchorEpoch: 2 });
    const alternateHeadTransition = makeReplayTransition(alternateA, scenario.nextCPackage, 'v36-alternate-head-forward');
    equal(alternateHeadTransition.receipt.classification, 'CANDIDATE_EXTENDS_PRESENTED_ANCHORED_HISTORY', 'alternate anchoring forms a valid relative v3.5 forward transition');
    const exactHeadRoot = Fixture.makeDir(tempRoot, 'exact-package-head-ledger');
    const exactHeadService = Ledger.createService(Fixture.serviceOptions(exactHeadRoot, scenario, 'v36-exact-package-head'));
    exactHeadService.record(Fixture.recordInput(scenario.transitionA, 'exact-head-first', Ledger.CONFIRMATION));
    throwsCode(() => exactHeadService.record(Fixture.recordInput(alternateHeadTransition, 'alternate-head-second', Ledger.CONFIRMATION)), 'STALE_LOCAL_HEAD', 'alternate anchoring of same checkpoint cannot consume exact local package head');

    const secondEarly = Fixture.recordInput(scenario.transitionC, 'forward-c-early', Ledger.CONFIRMATION);
    secondEarly.recordedAt = PairwiseFixture.add(scenario.transitionC.input.comparedAt, 1000);
    throwsCode(() => service.record(secondEarly), 'RECORDING_TIME_ROLLBACK', 'valid next head with earlier local time is refused');
    const secondInput = Fixture.recordInput(scenario.transitionC, 'forward-c', Ledger.CONFIRMATION);
    secondInput.recordedAt = PairwiseFixture.add(first.recordedAt, 1000);
    const second = service.record(secondInput);
    equal(second.log.sequence, 2, 'second valid transition receives sequence two');
    equal(second.previousEntryRef.sha256, first.entryDigest, 'second entry chains to exact first entry digest');
    equal(second.previousAnchoredCheckpointRef, first.candidateAnchoredCheckpointRef, 'second entry consumes exact first anchored-package head');
    equal(second.previousAnchorEpoch, 2, 'second entry consumes epoch two');
    equal(second.candidateAnchorEpoch, 3, 'second entry advances to epoch three');
    equal(service.inspect().entryCount, 2, 'snapshot reports two validated entries');
    equal(service.inspect().currentAnchorEpoch, 3, 'snapshot advances exact epoch head to three');
    equal(service.verifyPersisted(secondInput, second).pass, true, 'caller package exact-rebuilds persisted second entry');
    throwsCode(() => service.record(Fixture.recordInput(scenario.transitionC, 'reused-transition-id', Ledger.CONFIRMATION)), 'TRANSITION_ID_ALREADY_USED', 'reused transition id is refused');
    const reusedEntryId = Fixture.recordInput(scenario.transitionD, 'forward-a', Ledger.CONFIRMATION);
    throwsCode(() => service.record(reusedEntryId), 'ENTRY_ID_ALREADY_USED', 'reused local entry id is refused');
    throwsCode(() => service.record(Fixture.recordInput(scenario.transitionD, 'stale-next-d', Ledger.CONFIRMATION)), 'STALE_LOCAL_HEAD', 'divergent epoch-three candidate is stale after local head advances');

    const wrongLog = copy(options); wrongLog.logId = 'v36-different-log';
    throwsCode(() => Ledger.createService(wrongLog).inspect(), 'LOG_ID_MISMATCH', 'existing root rejects a different configured log id');
    const wrongGenesis = copy(options); wrongGenesis.genesisAnchorEpoch = 2;
    throwsCode(() => Ledger.createService(wrongGenesis).inspect(), 'GENESIS_MISMATCH', 'existing root rejects a different configured genesis');
    const extraOptions = copy(options); extraOptions.extra = true;
    throwsCode(() => Ledger.createService(extraOptions), 'INVALID_INPUT', 'unknown service option fails closed');
    throwsCode(() => Ledger.createService(Object.assign(copy(options), { stateRoot: path.parse(tempRoot).root })), 'STATE_ROOT_INVALID', 'filesystem root is refused as state root');
    throwsCode(() => Ledger.createService(Object.assign(copy(options), { stateRoot: path.join(tempRoot, 'missing-root') })), 'STATE_ROOT_INVALID', 'missing state root is refused');

    const independentARoot = Fixture.makeDir(tempRoot, 'independent-root-a');
    const independentBRoot = Fixture.makeDir(tempRoot, 'independent-root-b');
    const independentA = Ledger.createService(Fixture.serviceOptions(independentARoot, scenario, 'v36-independent'));
    const independentB = Ledger.createService(Fixture.serviceOptions(independentBRoot, scenario, 'v36-independent'));
    const independentAEntry = independentA.record(Fixture.recordInput(scenario.transitionA, 'independent-a', Ledger.CONFIRMATION));
    const independentBEntry = independentB.record(Fixture.recordInput(scenario.transitionB, 'independent-b', Ledger.CONFIRMATION));
    check(independentAEntry.candidateAnchoredCheckpointRef.sha256 !== independentBEntry.candidateAnchoredCheckpointRef.sha256, 'independent roots accept distinct candidates from the same genesis');
    equal(independentA.inspect().truth.independentLedgerRootsExcluded, false, 'independent-root counterexample is explicit');
    equal(independentB.inspect().truth.globalTransitionUniquenessProven, false, 'second root claims no global uniqueness');

    const raceRoot = Fixture.makeDir(tempRoot, 'race-root');
    const raceOptions = Fixture.serviceOptions(raceRoot, scenario, 'v36-race');
    const raceAPath = writePackage(tempRoot, 'race-a', { action: 'record', serviceOptions: raceOptions, input: Fixture.recordInput(scenario.transitionA, 'race-a', Ledger.CONFIRMATION) });
    const raceBPath = writePackage(tempRoot, 'race-b', { action: 'record', serviceOptions: raceOptions, input: Fixture.recordInput(scenario.transitionB, 'race-b', Ledger.CONFIRMATION) });
    const raceResults = await Promise.all([runChildAsync(raceAPath), runChildAsync(raceBPath)]);
    equal(raceResults.filter(item => item.ok).length, 1, 'exactly one concurrent writer wins the local genesis head');
    equal(raceResults.filter(item => !item.ok).length, 1, 'exactly one concurrent writer is refused');
    check(['STALE_LOCAL_HEAD', 'TRANSITION_LEDGER_SEQUENCE_CONFLICT'].includes(raceResults.find(item => !item.ok).error.code), 'concurrent loser has a typed contention refusal');
    const raceSnapshot = Ledger.createService(raceOptions).inspect();
    equal(raceSnapshot.entryCount, 1, 'concurrent root contains one exact sequence entry');
    check([scenario.transitionA.receipt.candidateAnchoredCheckpointRef.sha256, scenario.transitionB.receipt.candidateAnchoredCheckpointRef.sha256].includes(raceSnapshot.currentAnchoredCheckpointRef.sha256), 'concurrent head is exactly one presented candidate');

    const deletionRoot = Fixture.makeDir(tempRoot, 'deletion-root');
    const deletionService = Ledger.createService(Fixture.serviceOptions(deletionRoot, scenario, 'v36-deletion'));
    deletionService.record(Fixture.recordInput(scenario.transitionA, 'deletion-a', Ledger.CONFIRMATION));
    verifiedRemove(namespace(deletionRoot), deletionRoot);
    equal(deletionService.inspect(), null, 'deleting the caller-owned namespace removes the local head');
    const reopened = deletionService.record(Fixture.recordInput(scenario.transitionB, 'deletion-b', Ledger.CONFIRMATION));
    equal(reopened.candidateAnchoredCheckpointRef, scenario.transitionB.receipt.candidateAnchoredCheckpointRef, 'deletion reopens a different genesis branch');
    equal(reopened.truth.deletionOrRollbackPrevented, false, 'deletion counterexample remains explicit');

    const rollbackRoot = Fixture.makeDir(tempRoot, 'rollback-root');
    const rollbackOptions = Fixture.serviceOptions(rollbackRoot, scenario, 'v36-rollback');
    const rollbackService = Ledger.createService(rollbackOptions);
    rollbackService.record(Fixture.recordInput(scenario.transitionA, 'rollback-a', Ledger.CONFIRMATION));
    const earlierNamespace = cloneRoot(tempRoot, namespace(rollbackRoot), 'rollback-earlier-namespace');
    rollbackService.record(Fixture.recordInput(scenario.transitionC, 'rollback-c', Ledger.CONFIRMATION));
    equal(rollbackService.inspect().entryCount, 2, 'rollback fixture first reaches two entries');
    verifiedRemove(namespace(rollbackRoot), rollbackRoot);
    fs.cpSync(earlierNamespace, namespace(rollbackRoot), { recursive: true });
    equal(rollbackService.inspect().entryCount, 1, 'restored earlier root reopens the prior local head');
    const rollbackFork = rollbackService.record(Fixture.recordInput(scenario.transitionD, 'rollback-d', Ledger.CONFIRMATION));
    equal(rollbackFork.candidateAnchoredCheckpointRef, scenario.transitionD.receipt.candidateAnchoredCheckpointRef, 'rolled-back root accepts a different next branch');
    equal(rollbackFork.truth.protectedMonotonicStateProven, false, 'rollback counterexample claims no protected monotonic state');

    const corruptDigestRoot = cloneRoot(tempRoot, localRoot, 'corrupt-digest-root');
    const corruptDigestEntry = canonicalRead(entryFile(corruptDigestRoot, 1));
    corruptDigestEntry.entryDigest = 'sha256:' + '0'.repeat(64);
    canonicalWrite(entryFile(corruptDigestRoot, 1), corruptDigestEntry);
    throwsCode(() => Ledger.createService(Fixture.serviceOptions(corruptDigestRoot, scenario)).inspect(), 'TRANSITION_LEDGER_ENTRY_CORRUPT', 'entry digest corruption fails closed');

    const noncanonicalRoot = cloneRoot(tempRoot, localRoot, 'noncanonical-root');
    fs.appendFileSync(entryFile(noncanonicalRoot, 1), ' ', 'utf8');
    throwsCode(() => Ledger.createService(Fixture.serviceOptions(noncanonicalRoot, scenario)).inspect(), 'TRANSITION_LEDGER_ENTRY_CORRUPT', 'noncanonical stored JSON fails closed');

    const gapRoot = cloneRoot(tempRoot, localRoot, 'sequence-gap-root');
    fs.renameSync(entryFile(gapRoot, 2), entryFile(gapRoot, 3));
    throwsCode(() => Ledger.createService(Fixture.serviceOptions(gapRoot, scenario)).inspect(), 'TRANSITION_LEDGER_SEQUENCE_CORRUPT', 'sequence gap fails closed');

    const unexpectedRoot = cloneRoot(tempRoot, localRoot, 'unexpected-file-root');
    fs.writeFileSync(path.join(namespace(unexpectedRoot), 'unexpected.json'), '{}\n', 'utf8');
    throwsCode(() => Ledger.createService(Fixture.serviceOptions(unexpectedRoot, scenario)).inspect(), 'TRANSITION_LEDGER_NAMESPACE_CORRUPT', 'unexpected namespace file fails closed');

    const oversizedRoot = cloneRoot(tempRoot, localRoot, 'oversized-entry-root');
    fs.writeFileSync(entryFile(oversizedRoot, 1), 'x'.repeat(Ledger.MAX_ARTIFACT_CANONICAL_BYTES + 2), 'utf8');
    throwsCode(() => Ledger.createService(Fixture.serviceOptions(oversizedRoot, scenario)).inspect(), 'TRANSITION_LEDGER_ENTRY_CORRUPT', 'oversized stored artifact fails closed');

    const manifestCorruptRoot = cloneRoot(tempRoot, localRoot, 'manifest-corrupt-root');
    const corruptManifest = canonicalRead(path.join(namespace(manifestCorruptRoot), Ledger.MANIFEST_FILE));
    corruptManifest.manifestDigest = 'sha256:' + '0'.repeat(64);
    canonicalWrite(path.join(namespace(manifestCorruptRoot), Ledger.MANIFEST_FILE), corruptManifest);
    throwsCode(() => Ledger.createService(Fixture.serviceOptions(manifestCorruptRoot, scenario)).inspect(), 'TRANSITION_LEDGER_MANIFEST_CORRUPT', 'manifest digest corruption fails closed');

    const persisted = JSON.stringify({ manifest: canonicalRead(manifestPath), entries: [canonicalRead(storedFirstPath), canonicalRead(entryFile(localRoot, 2))], snapshot: service.inspect() });
    equal(persisted.includes('BEGIN PUBLIC KEY'), false, 'persisted artifacts omit raw public keys');
    equal(persisted.includes(scenario.transitionA.input.previousAnchoredInput.policyAuthorizations[0].signature), false, 'persisted artifacts omit raw signatures');
    equal(persisted.includes(localRoot), false, 'persisted artifacts omit configured paths');
    equal(persisted.includes('PRIVATE KEY'), false, 'persisted artifacts omit private keys');
    equal(persisted.includes('signedAttestations'), false, 'persisted artifacts omit v3.4 witness inputs');
    equal(persisted.includes('policyAuthorizations'), false, 'persisted artifacts omit v3.4 anchor inputs');
    equal(service.inspect().truth.externalRetentionProven, false, 'local files claim no external retention');
    equal(service.inspect().truth.globallyConsistentLogProven, false, 'local files claim no globally consistent log');
    equal(service.inspect().truth.executionAuthorized, false, 'local snapshot grants no execution authority');

    const schemas = ['manifest.schema.json', 'entry.schema.json', 'snapshot.schema.json'].map(name => ({ name, value: JSON.parse(fs.readFileSync(path.join(__dirname, name), 'utf8')) }));
    schemas.forEach(item => {
      equal(item.value.$schema, 'https://json-schema.org/draft/2020-12/schema', item.name + ' declares Draft 2020-12');
      equal(item.value.additionalProperties, false, item.name + ' closes top-level fields');
      equal(everyObjectClosed(item.value), true, item.name + ' closes every local object shape');
    });
    assertClosedShape(canonicalRead(manifestPath), schemas[0].value, schemas[0].value, 'manifest');
    check(true, 'stored manifest matches every required closed local schema shape');
    assertClosedShape(canonicalRead(storedFirstPath), schemas[1].value, schemas[1].value, 'entry');
    check(true, 'stored entry matches every required closed local schema shape');
    assertClosedShape(service.inspect(), schemas[2].value, schemas[2].value, 'snapshot');
    check(true, 'derived snapshot matches every required closed local schema shape');
    equal(schemas[1].value.properties.transitionReceipt.$ref, '../model-shadow-retention-audit-review-outcome-history-checkpoint-anchor-pairwise/transition.schema.json', 'entry schema composes exact v3.5 receipt schema');

    const contract = JSON.parse(fs.readFileSync(path.join(__dirname, 'module.contract.json'), 'utf8'));
    equal(ContractVerifier.validateContract(contract), { pass: true, errors: [] }, 'module contract passes repository verifier');
    equal(contract.version, 'v3.6', 'contract version is exact');
    equal(contract.status, 'TEST', 'contract remains TEST');
    equal(contract.lifecycle.installed, false, 'module remains uninstalled');
    equal(contract.lifecycle.promoted, false, 'module remains unpromoted');
    equal(contract.merge_gate, 'Mike Tobi / AXM', 'Mike Tobi remains merge gate');
    equal(contract.provides.length, 27, 'contract exposes twenty-seven bounded handoffs');

    const source = fs.readFileSync(path.join(__dirname, 'model-shadow-retention-audit-review-outcome-history-checkpoint-anchor-pairwise-ledger.js'), 'utf8');
    check(source.includes("require('../model-shadow-retention-audit-review-outcome-history-checkpoint-anchor-pairwise/"), 'runtime composes exact v3.5 module');
    check(source.includes("fs.openSync(filePath, 'wx'"), 'runtime uses exclusive file creation');
    check(source.includes('fs.fsyncSync(descriptor)'), 'runtime file-fsyncs persisted artifacts');
    equal(source.includes('fetch('), false, 'runtime contains no network fetch');
    equal(source.includes('crypto.sign'), false, 'runtime performs no signing');
    equal(source.includes('generateKeyPair'), false, 'runtime generates no key pair');
    equal(source.includes('createPrivateKey'), false, 'runtime ingests no private key API');
    equal(source.includes('provider.invoke'), false, 'runtime invokes no provider');

    console.log('RESULT ' + checks + ' focused assertions passed');
  } finally {
    verifiedRemove(tempRoot, os.tmpdir());
  }
}

main().catch(error => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
