#!/usr/bin/env node
'use strict';

const assert = require('assert');
const childProcess = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const ContractVerifier = require('../../hub/module-contract-verifier');
const PairwiseFixture = require('../model-shadow-retention-audit-review-outcome-history-checkpoint-anchor-pairwise/selftest-fixture');
const V36 = require('../model-shadow-retention-audit-review-outcome-history-checkpoint-anchor-pairwise-ledger/model-shadow-retention-audit-review-outcome-history-checkpoint-anchor-pairwise-ledger');
const Settlement = require('./model-shadow-retention-audit-review-outcome-transition-settlement-ledger');
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
function namespace(root) { return path.join(root, Settlement.NAMESPACE); }
function sourceNamespace(root) { return path.join(root, V36.NAMESPACE); }
function proposalFile(root, sequence) { return path.join(namespace(root), Settlement.PROPOSALS_DIRECTORY, String(sequence).padStart(12, '0') + '.json'); }
function settlementFile(root, sequence) { return path.join(namespace(root), Settlement.SETTLEMENTS_DIRECTORY, String(sequence).padStart(12, '0') + '.json'); }
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
  if (result.status !== 0) throw new Error('child transport failed: ' + result.stderr);
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
function canonicalRead(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }
function canonicalWrite(file, value) { fs.writeFileSync(file, Settlement.stableStringify(value) + '\n', 'utf8'); }
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
function pendingPackage(input, result) { return { input, result }; }

async function main() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'axm-v37-transition-settlement-'));
  try {
    const scenario = Fixture.buildScenario(tempRoot);
    const settlementRoot = Fixture.makeDir(tempRoot, 'v37-settlement-main');
    const options = Fixture.serviceOptions(settlementRoot, scenario.sourceAOptions);
    const service = Settlement.createService(copy(options));

    equal(Settlement.VERSION, '3.7.0', 'version is exact');
    equal(Settlement.STATUS, 'TEST', 'status remains TEST');
    equal(Settlement.MAX_INPUT_CANONICAL_BYTES, 146800640, 'transient input is bounded to 140 MiB');
    equal(Settlement.MAX_ARTIFACT_CANONICAL_BYTES, 2097152, 'persisted artifact is bounded to 2 MiB');
    equal(Settlement.MAX_LEDGER_BYTES, 268435456, 'aggregate ledger is bounded to 256 MiB');
    equal(Settlement.MAX_RECORDS, 10000, 'record count is bounded to ten thousand');
    equal(service.inspect(), null, 'absent settlement namespace inspects as null');
    equal(fs.existsSync(namespace(settlementRoot)), false, 'inspection creates no namespace');

    const firstInput = Fixture.proposalInput(scenario.entryAInput, scenario.entryA, 'main-a');
    const wrongConfirmation = copy(firstInput); wrongConfirmation.confirmation = 'YES';
    throwsCode(() => service.propose(wrongConfirmation), 'PROPOSAL_CONFIRMATION_REQUIRED', 'wrong proposal confirmation fails before write');
    equal(fs.existsSync(namespace(settlementRoot)), false, 'wrong proposal confirmation leaves namespace absent');
    const tamperedEntry = copy(firstInput); tamperedEntry.sourceEntry.entryDigest = 'sha256:' + '0'.repeat(64);
    throwsCode(() => service.propose(tamperedEntry), 'SOURCE_ENTRY_INVALID', 'tampered v3.6 entry fails before write');
    equal(fs.existsSync(namespace(settlementRoot)), false, 'tampered source entry leaves namespace absent');
    const extraInput = copy(firstInput); extraInput.extra = true;
    throwsCode(() => service.propose(extraInput), 'INVALID_INPUT', 'unknown proposal input field fails closed');

    const overlapOptions = Fixture.serviceOptions(scenario.sourceARoot, scenario.sourceAOptions, 'v37-overlap');
    throwsCode(() => Settlement.createService(overlapOptions), 'STATE_ROOT_OVERLAP', 'equal source and settlement roots are refused');
    const nestedRoot = Fixture.makeDir(scenario.sourceARoot, 'nested-settlement');
    throwsCode(() => Settlement.createService(Fixture.serviceOptions(nestedRoot, scenario.sourceAOptions, 'v37-nested')), 'STATE_ROOT_OVERLAP', 'nested source and settlement roots are refused');
    throwsCode(() => Settlement.createService(Object.assign(copy(options), { stateRoot: path.parse(tempRoot).root })), 'STATE_ROOT_INVALID', 'filesystem root is refused as settlement root');

    const sourceBeforeProposal = treeDigest(scenario.sourceARoot);
    const firstResult = service.propose(copy(firstInput));
    const firstPending = pendingPackage(firstInput, firstResult);
    equal(treeDigest(scenario.sourceARoot), sourceBeforeProposal, 'proposal leaves durable v3.6 source bytes unchanged');
    equal(firstResult.proposal.log.sequence, 1, 'first proposal receives sequence one');
    equal(firstResult.proposal.sourceEntryRef.sha256, scenario.entryA.entryDigest, 'proposal references exact persisted v3.6 entry');
    equal(firstResult.proposal.previousSettledHead.anchorEpoch, 1, 'first proposal consumes genesis epoch');
    equal(firstResult.proposal.candidateSettledHead.anchorEpoch, 2, 'first proposal targets candidate epoch');
    equal(firstResult.proposal.sourceObservation.classification, 'EXACT_ENTRY_PRESENT', 'proposal retains exact bracketing source observation');
    equal([firstResult.proposal.sourceObservation.beforeCaptureState, firstResult.proposal.sourceObservation.afterCaptureState], ['PRESENT', 'PRESENT'], 'exact proposal records two present source captures');
    equal(firstResult.proposal.truth.proposalDoesNotAdvanceSettledHead, true, 'proposal truth denies settled-head advance');
    equal(firstResult.proposal.truth.sourceObservationAtomicWithProposalWrite, false, 'proposal truth denies atomic source observation and write');
    equal(firstResult.proposal.truth.externalRetentionProven, false, 'proposal claims no external retention');
    equal(firstResult.proposal.truth.automaticCanon, false, 'proposal grants no CANON status');
    equal(service.verifyProposalPersisted(firstInput, firstResult.prewriteEvidence, firstResult.proposal).pass, true, 'caller package exact-rebuilds persisted first proposal');

    const pendingSnapshot = service.inspect();
    equal(pendingSnapshot.proposalCount, 1, 'pending snapshot counts one proposal');
    equal(pendingSnapshot.settlementCount, 0, 'pending snapshot counts no settlement');
    equal(pendingSnapshot.currentSettledHead, pendingSnapshot.genesisSettledHead, 'pending proposal leaves settled head at genesis');
    equal(pendingSnapshot.pendingProposalRef.sha256, firstResult.proposal.proposalDigest, 'pending snapshot binds exact proposal');
    equal(pendingSnapshot.truth.liveSourceRecapturedByInspect, false, 'inspect claims no live source recapture');

    const manifestPath = path.join(namespace(settlementRoot), Settlement.MANIFEST_FILE);
    const manifestRaw = fs.readFileSync(manifestPath, 'utf8');
    const proposalRaw = fs.readFileSync(proposalFile(settlementRoot, 1), 'utf8');
    equal(manifestRaw, Settlement.stableStringify(JSON.parse(manifestRaw)) + '\n', 'manifest bytes are exact canonical JSON');
    equal(proposalRaw, Settlement.stableStringify(JSON.parse(proposalRaw)) + '\n', 'proposal bytes are exact canonical JSON');

    const childInspect = runChild(writePackage(tempRoot, 'child-inspect-pending', { action: 'inspect', serviceOptions: options }));
    equal(childInspect.ok, true, 'fresh process reloads pending settlement ledger');
    check(childInspect.pid !== process.pid, 'fresh pending inspection uses a distinct process');
    equal(childInspect.result, pendingSnapshot, 'fresh process derives exact pending snapshot');
    const childProposal = runChild(writePackage(tempRoot, 'child-verify-proposal', { action: 'verify-proposal', serviceOptions: options, input: firstInput, evidence: firstResult.prewriteEvidence, receipt: firstResult.proposal }));
    equal(childProposal.ok, true, 'fresh process executes proposal verification');
    equal(childProposal.result.pass, true, 'fresh process exact-rebuilds persisted proposal');

    const blockedSecond = Fixture.proposalInput(scenario.entryAInput, scenario.entryA, 'blocked-pending');
    throwsCode(() => service.propose(blockedSecond), 'PENDING_SETTLEMENT', 'second proposal is refused while one remains pending');
    equal(service.inspect().proposalCount, 1, 'pending-proposal refusal creates no second proposal');

    const wrongSettlement = Fixture.settlementInput(firstPending, 'wrong-confirmation', null, 'YES');
    throwsCode(() => service.settle(wrongSettlement), 'SETTLEMENT_CONFIRMATION_REQUIRED', 'wrong settlement confirmation fails before write');
    equal(service.inspect().settlementCount, 0, 'wrong settlement confirmation creates no settlement');
    const earlySettlement = Fixture.settlementInput(firstPending, 'early-time', '2020-01-01T00:00:00.000Z');
    throwsCode(() => service.settle(earlySettlement), 'SETTLEMENT_TIME_INVALID', 'settlement cannot predate proposal');

    const entryC = scenario.sourceA.record(copy(scenario.entryCInput));
    equal(scenario.sourceA.inspect().entryCount, 2, 'source advances beyond pending entry before settlement');
    const sourceBeforeSettlement = treeDigest(scenario.sourceARoot);
    const firstSettlementInput = Fixture.settlementInput(firstPending, 'main-a', PairwiseFixture.add(entryC.recordedAt, 1000));
    const firstSettlementResult = service.settle(copy(firstSettlementInput));
    equal(treeDigest(scenario.sourceARoot), sourceBeforeSettlement, 'settlement leaves durable advanced source bytes unchanged');
    equal(firstSettlementResult.settlement.classification, 'SETTLED_EXACT_SOURCE_ENTRY_PRESENT', 'persisted entry settles while later source entry also exists');
    equal(firstSettlementResult.settlement.decision.settledHeadAdvanced, true, 'exact settlement advances local settled head');
    equal(firstSettlementResult.settlement.resultingSettledHead, firstResult.proposal.candidateSettledHead, 'first settlement advances to exact proposed head');
    equal(firstSettlementResult.settlement.truth.postwriteSourceCurrentnessProven, false, 'settlement proves no postwrite source currentness');
    equal(firstSettlementResult.settlement.truth.globalTransitionUniquenessProven, false, 'settlement claims no global uniqueness');
    equal(service.verifySettlementPersisted(firstSettlementInput, firstSettlementResult.prewriteEvidence, firstSettlementResult.settlement).pass, true, 'caller package exact-rebuilds persisted first settlement');
    const firstSettledSnapshot = service.inspect();
    equal(firstSettledSnapshot.settlementCount, 1, 'settled snapshot counts first settlement');
    equal(firstSettledSnapshot.pendingProposalRef, null, 'exact settlement clears pending proposal');
    equal(firstSettledSnapshot.currentSettledHead.anchorEpoch, 2, 'settled-only head advances to epoch two');

    const childSettlement = runChild(writePackage(tempRoot, 'child-verify-settlement', { action: 'verify-settlement', serviceOptions: options, input: firstSettlementInput, evidence: firstSettlementResult.prewriteEvidence, receipt: firstSettlementResult.settlement }));
    equal(childSettlement.ok, true, 'fresh process executes settlement verification');
    equal(childSettlement.result.pass, true, 'fresh process exact-rebuilds persisted settlement');

    const secondInput = Fixture.proposalInput(scenario.entryCInput, entryC, 'main-c', PairwiseFixture.add(entryC.recordedAt, 2000));
    const timeRollback = copy(secondInput); timeRollback.proposedAt = entryC.recordedAt;
    throwsCode(() => service.propose(timeRollback), 'PROPOSAL_TIME_ROLLBACK', 'proposal time cannot move behind previous settlement');
    const secondResult = service.propose(copy(secondInput));
    const secondPending = pendingPackage(secondInput, secondResult);
    equal(service.inspect().currentSettledHead.anchorEpoch, 2, 'second pending proposal still does not advance head');
    equal(secondResult.proposal.previousProposalRef.sha256, firstResult.proposal.proposalDigest, 'second proposal chains to exact prior proposal digest');
    const duplicateSettlementId = Fixture.settlementInput(secondPending, 'main-a', PairwiseFixture.add(secondInput.proposedAt, 1000));
    throwsCode(() => service.settle(duplicateSettlementId), 'SETTLEMENT_ID_ALREADY_USED', 'settlement id reuse is refused');
    const secondSettlementInput = Fixture.settlementInput(secondPending, 'main-c', PairwiseFixture.add(secondInput.proposedAt, 1000));
    const secondSettlementResult = service.settle(copy(secondSettlementInput));
    equal(secondSettlementResult.settlement.classification, 'SETTLED_EXACT_SOURCE_ENTRY_PRESENT', 'second exact entry settles');
    equal(service.inspect().currentSettledHead.anchorEpoch, 3, 'second exact settlement advances settled head to epoch three');
    equal(service.inspect().heldSettlementCount, 0, 'main ledger has no held settlement');
    throwsCode(() => service.propose(Fixture.proposalInput(scenario.entryAInput, scenario.entryA, 'stale-after-settlement', PairwiseFixture.add(secondSettlementInput.settledAt, 1000))), 'STALE_SETTLED_HEAD', 'old exact source entry cannot consume advanced settled head');

    const heldRoot = Fixture.makeDir(tempRoot, 'v37-held-settlement');
    const heldOptions = Fixture.serviceOptions(heldRoot, scenario.sourceBOptions, 'v37-held-log');
    const heldService = Settlement.createService(copy(heldOptions));
    const heldProposalInput = Fixture.proposalInput(scenario.entryBInput, scenario.entryB, 'held-b');
    const heldProposalResult = heldService.propose(copy(heldProposalInput));
    const heldPending = pendingPackage(heldProposalInput, heldProposalResult);
    const sourceBBackup = cloneRoot(tempRoot, sourceNamespace(scenario.sourceBRoot), 'v37-source-b-backup');
    verifiedRemove(sourceNamespace(scenario.sourceBRoot), scenario.sourceBRoot);
    const heldSettlementInput = Fixture.settlementInput(heldPending, 'held-b');
    const heldSettlementResult = heldService.settle(copy(heldSettlementInput));
    equal(heldSettlementResult.settlement.classification, 'HELD_SOURCE_ABSENT', 'source absence becomes typed held settlement');
    equal([heldSettlementResult.settlement.sourceObservation.beforeCaptureState, heldSettlementResult.settlement.sourceObservation.afterCaptureState], ['ABSENT', 'ABSENT'], 'source-absence hold records two absent captures');
    equal(heldSettlementResult.settlement.decision.settledHeadAdvanced, false, 'held settlement does not advance head');
    equal(heldSettlementResult.settlement.decision.autonomousActionCount, 0, 'held settlement authorizes zero actions');
    equal(heldService.inspect().currentSettledHead, heldService.inspect().genesisSettledHead, 'held settlement preserves genesis head');
    equal(heldService.inspect().heldSettlementCount, 1, 'held settlement remains counted');
    equal(heldService.inspect().pendingProposalRef, null, 'held settlement clears pending proposal without silent retry');
    fs.cpSync(sourceBBackup, sourceNamespace(scenario.sourceBRoot), { recursive: true });
    const retryProposalInput = Fixture.proposalInput(scenario.entryBInput, scenario.entryB, 'retry-b', PairwiseFixture.add(heldSettlementInput.settledAt, 1000));
    const retryProposalResult = heldService.propose(copy(retryProposalInput));
    const retryPending = pendingPackage(retryProposalInput, retryProposalResult);
    const retrySettlementInput = Fixture.settlementInput(retryPending, 'retry-b', PairwiseFixture.add(retryProposalInput.proposedAt, 1000));
    const retrySettlementResult = heldService.settle(copy(retrySettlementInput));
    equal(retrySettlementResult.settlement.classification, 'SETTLED_EXACT_SOURCE_ENTRY_PRESENT', 'restored exact source entry can be proposed and settled in a new sequence');
    equal(heldService.inspect().currentSettledHead.anchorEpoch, 2, 'retry advances held ledger to epoch two');
    check(firstSettlementResult.settlement.resultingSettledHead.anchoredCheckpointRef.sha256 !== retrySettlementResult.settlement.resultingSettledHead.anchoredCheckpointRef.sha256, 'independent local source and settlement roots settle divergent candidates from one genesis');
    equal(heldService.inspect().truth.independentRootsExcluded, false, 'independent-root counterexample remains explicit');

    const invalidSourceRoot = cloneRoot(tempRoot, scenario.sourceBRoot, 'v37-invalid-source');
    const invalidSourceOptions = copy(scenario.sourceBOptions); invalidSourceOptions.stateRoot = invalidSourceRoot;
    const invalidRoot = Fixture.makeDir(tempRoot, 'v37-invalid-settlement');
    const invalidService = Settlement.createService(Fixture.serviceOptions(invalidRoot, invalidSourceOptions, 'v37-invalid-log'));
    const invalidProposalInput = Fixture.proposalInput(scenario.entryBInput, scenario.entryB, 'invalid-source');
    const invalidProposalResult = invalidService.propose(copy(invalidProposalInput));
    const invalidManifestPath = path.join(sourceNamespace(invalidSourceRoot), V36.MANIFEST_FILE);
    const invalidManifest = canonicalRead(invalidManifestPath);
    invalidManifest.manifestDigest = 'sha256:' + '0'.repeat(64);
    fs.writeFileSync(invalidManifestPath, JSON.stringify(invalidManifest) + '\n', 'utf8');
    const invalidSettlementResult = invalidService.settle(Fixture.settlementInput(pendingPackage(invalidProposalInput, invalidProposalResult), 'invalid-source'));
    equal(invalidSettlementResult.settlement.classification, 'HELD_SOURCE_INVALID', 'invalid source becomes typed held settlement');
    equal([invalidSettlementResult.settlement.sourceObservation.beforeCaptureState, invalidSettlementResult.settlement.sourceObservation.afterCaptureState], ['INVALID', 'INVALID'], 'invalid-source hold records two invalid captures');
    equal(invalidSettlementResult.settlement.sourceObservation.entryPersistedExactRebuild, false, 'invalid-source observation retains failed exact verification');
    equal(invalidSettlementResult.settlement.sourceObservation.equalBracketingSnapshots, false, 'invalid-source observation retains unavailable bracketing equality');
    equal(invalidSettlementResult.settlement.truth.sourceEntryRecheckedByExactV36PersistedVerificationBeforeWrite, false, 'invalid-source truth does not inflate source verification');
    equal(invalidService.inspect().currentSettledHead, invalidService.inspect().genesisSettledHead, 'invalid-source hold preserves prior settled head');

    const mismatchSourceRoot = cloneRoot(tempRoot, scenario.sourceBRoot, 'v37-mismatch-source');
    const mismatchSourceOptions = copy(scenario.sourceBOptions); mismatchSourceOptions.stateRoot = mismatchSourceRoot;
    const mismatchRoot = Fixture.makeDir(tempRoot, 'v37-mismatch-settlement');
    const mismatchService = Settlement.createService(Fixture.serviceOptions(mismatchRoot, mismatchSourceOptions, 'v37-mismatch-log'));
    const mismatchProposalInput = Fixture.proposalInput(scenario.entryBInput, scenario.entryB, 'mismatch-source');
    const mismatchProposalResult = mismatchService.propose(copy(mismatchProposalInput));
    verifiedRemove(sourceNamespace(mismatchSourceRoot), mismatchSourceRoot);
    fs.cpSync(sourceNamespace(scenario.sourceARoot), sourceNamespace(mismatchSourceRoot), { recursive: true });
    const mismatchSettlementResult = mismatchService.settle(Fixture.settlementInput(pendingPackage(mismatchProposalInput, mismatchProposalResult), 'mismatch-source'));
    equal(mismatchSettlementResult.settlement.classification, 'HELD_ENTRY_NOT_EXACT_OR_PRESENT', 'stable source without the proposed entry becomes typed held settlement');
    equal([mismatchSettlementResult.settlement.sourceObservation.beforeCaptureState, mismatchSettlementResult.settlement.sourceObservation.afterCaptureState], ['PRESENT', 'PRESENT'], 'entry-mismatch hold records two present captures');
    equal(mismatchSettlementResult.settlement.sourceObservation.entryPersistedExactRebuild, false, 'entry-mismatch observation retains failed exact verification');
    equal(mismatchSettlementResult.settlement.sourceObservation.equalBracketingSnapshots, true, 'entry-mismatch observation retains equal bracketing snapshots');
    equal(mismatchSettlementResult.settlement.truth.equalBracketingSourceSnapshotsObservedBeforeSettlementWrite, true, 'entry-mismatch truth preserves independently observed bracketing equality');
    equal(mismatchService.inspect().currentSettledHead, mismatchService.inspect().genesisSettledHead, 'entry-mismatch hold preserves prior settled head');

    const changedBefore = scenario.sourceB.inspect();
    const changedAfter = scenario.sourceA.inspect();
    let changedInspectCalls = 0;
    const fakeChangingSourceService = {
      logId: scenario.sourceB.logId,
      genesisAnchoredCheckpointRef: copy(scenario.sourceB.genesisAnchoredCheckpointRef),
      genesisCheckpointRef: copy(scenario.sourceB.genesisCheckpointRef),
      genesisAnchorEpoch: scenario.sourceB.genesisAnchorEpoch,
      inspect() { changedInspectCalls += 1; return copy(changedInspectCalls <= 3 ? changedBefore : changedAfter); },
      verifyPersisted() { return { pass: true, errors: [], rebuilt: copy(scenario.entryB), stored: copy(scenario.entryB) }; }
    };
    const changedRoot = Fixture.makeDir(tempRoot, 'v37-changed-settlement');
    const originalCreateSourceService = V36.createService;
    let changedService;
    try {
      V36.createService = () => fakeChangingSourceService;
      changedService = Settlement.createService(Fixture.serviceOptions(changedRoot, scenario.sourceBOptions, 'v37-changed-log'));
    } finally { V36.createService = originalCreateSourceService; }
    const changedProposalInput = Fixture.proposalInput(scenario.entryBInput, scenario.entryB, 'changed-source');
    const changedProposalResult = changedService.propose(copy(changedProposalInput));
    const changedSettlementResult = changedService.settle(Fixture.settlementInput(pendingPackage(changedProposalInput, changedProposalResult), 'changed-source'));
    equal(changedSettlementResult.settlement.classification, 'HELD_SOURCE_CHANGED_DURING_CHECK', 'different valid bracketing snapshots become typed held settlement');
    equal([changedSettlementResult.settlement.sourceObservation.beforeCaptureState, changedSettlementResult.settlement.sourceObservation.afterCaptureState], ['PRESENT', 'PRESENT'], 'changed-source hold records two present but unequal captures');
    equal(changedSettlementResult.settlement.sourceObservation.entryPersistedExactRebuild, true, 'changed-source observation retains successful exact entry verification');
    equal(changedSettlementResult.settlement.sourceObservation.equalBracketingSnapshots, false, 'changed-source observation retains failed bracketing equality');
    equal(changedSettlementResult.settlement.truth.sourceEntryRecheckedByExactV36PersistedVerificationBeforeWrite, true, 'changed-source truth preserves independently successful source verification');
    equal(changedSettlementResult.settlement.truth.equalBracketingSourceSnapshotsObservedBeforeSettlementWrite, false, 'changed-source truth does not inflate bracketing equality');
    equal(changedSettlementResult.settlement.truth.settledHeadAdvancedForThisReceipt, false, 'changed-source truth records no settled-head advance');
    equal(changedService.inspect().currentSettledHead, changedService.inspect().genesisSettledHead, 'changed-source hold preserves prior settled head');

    const observedSourceClassifications = [
      firstSettlementResult, heldSettlementResult, invalidSettlementResult, mismatchSettlementResult, changedSettlementResult
    ].map(result => result.settlement.sourceObservation.classification).sort();
    equal(observedSourceClassifications, Settlement.SOURCE_OBSERVATIONS.slice().sort(), 'focused cases exercise every source observation classification');
    const observedSettlementClassifications = [
      firstSettlementResult, heldSettlementResult, invalidSettlementResult, mismatchSettlementResult, changedSettlementResult
    ].map(result => result.settlement.classification).sort();
    equal(observedSettlementClassifications, Settlement.SETTLEMENT_CLASSIFICATIONS.slice().sort(), 'focused cases exercise every settlement classification');

    const raceSourceRoot = cloneRoot(tempRoot, scenario.sourceARoot, 'v37-race-source');
    const raceSourceOptions = copy(scenario.sourceAOptions); raceSourceOptions.stateRoot = raceSourceRoot;
    const raceSettlementRoot = Fixture.makeDir(tempRoot, 'v37-race-settlement');
    const raceOptions = Fixture.serviceOptions(raceSettlementRoot, raceSourceOptions, 'v37-race-log');
    const raceAInput = Fixture.proposalInput(scenario.entryAInput, scenario.entryA, 'race-a');
    const raceBInput = Fixture.proposalInput(scenario.entryAInput, scenario.entryA, 'race-b');
    const raceAPath = writePackage(tempRoot, 'v37-race-a', { action: 'propose', serviceOptions: raceOptions, input: raceAInput });
    const raceBPath = writePackage(tempRoot, 'v37-race-b', { action: 'propose', serviceOptions: raceOptions, input: raceBInput });
    const raceResults = await Promise.all([runChildAsync(raceAPath), runChildAsync(raceBPath)]);
    equal(raceResults.filter(item => item.ok).length, 1, 'exactly one concurrent proposal wins local operation contention');
    equal(raceResults.filter(item => !item.ok).length, 1, 'exactly one concurrent proposal is refused');
    check(['SETTLEMENT_OPERATION_BUSY', 'PENDING_SETTLEMENT', 'SETTLEMENT_SEQUENCE_CONFLICT'].includes(raceResults.find(item => !item.ok).error.code), 'concurrent loser has a typed contention refusal');
    equal(Settlement.createService(raceOptions).inspect().proposalCount, 1, 'concurrent settlement root contains one pending proposal');

    const proposalFsyncSourceRoot = cloneRoot(tempRoot, scenario.sourceARoot, 'v37-proposal-fsync-source');
    const proposalFsyncSourceOptions = copy(scenario.sourceAOptions); proposalFsyncSourceOptions.stateRoot = proposalFsyncSourceRoot;
    const proposalFsyncRoot = Fixture.makeDir(tempRoot, 'v37-proposal-fsync');
    const proposalFsyncService = Settlement.createService(Fixture.serviceOptions(proposalFsyncRoot, proposalFsyncSourceOptions, 'v37-proposal-fsync'));
    const originalFsyncSync = fs.fsyncSync;
    let fsyncCalls = 0;
    let proposalDurabilityError = null;
    try {
      fs.fsyncSync = descriptor => {
        fsyncCalls += 1;
        if (fsyncCalls === 2) { const error = new Error('injected proposal fsync failure'); error.code = 'EIO'; throw error; }
        return originalFsyncSync(descriptor);
      };
      try { proposalFsyncService.propose(Fixture.proposalInput(scenario.entryAInput, scenario.entryA, 'proposal-fsync')); }
      catch (error) { proposalDurabilityError = error; }
    } finally { fs.fsyncSync = originalFsyncSync; }
    equal(proposalDurabilityError && proposalDurabilityError.code, 'SETTLEMENT_PROPOSAL_DURABILITY_UNCERTAIN', 'proposal fsync failure has typed durability uncertainty');
    equal(fsyncCalls, 2, 'proposal fault injection reaches proposal fsync after manifest fsync');
    equal(proposalFsyncService.inspect().proposalCount, 1, 'proposal may remain inspectable after fsync failure');
    const uncertainProposal = canonicalRead(proposalFile(proposalFsyncRoot, 1));
    equal(uncertainProposal.truth.writeAndReloadCompletionPersistedSeparately, false, 'uncertain proposal claims no separately persisted completion');

    const uncertainPending = {
      input: Fixture.proposalInput(scenario.entryAInput, scenario.entryA, 'proposal-fsync'),
      result: { proposal: uncertainProposal, prewriteEvidence: null }
    };
    const exactProposalChild = runChild(writePackage(tempRoot, 'recover-proposal-evidence', { action: 'propose', serviceOptions: Fixture.serviceOptions(Fixture.makeDir(tempRoot, 'v37-evidence-rebuild-root'), proposalFsyncSourceOptions, 'v37-evidence-rebuild'), input: uncertainPending.input }));
    equal(exactProposalChild.ok, true, 'independent exact proposal run reconstructs caller evidence for fsync fixture');
    uncertainPending.result.prewriteEvidence = exactProposalChild.result.prewriteEvidence;
    const proposalVerify = proposalFsyncService.verifyProposalPersisted(uncertainPending.input, uncertainPending.result.prewriteEvidence, uncertainProposal);
    equal(proposalVerify.pass, true, 'reconstructed exact caller evidence verifies uncertain persisted proposal');
    const settlementFsyncInput = Fixture.settlementInput(uncertainPending, 'settlement-fsync');
    let settlementDurabilityError = null;
    fsyncCalls = 0;
    try {
      fs.fsyncSync = descriptor => { fsyncCalls += 1; const error = new Error('injected settlement fsync failure'); error.code = 'EIO'; throw error; };
      try { proposalFsyncService.settle(copy(settlementFsyncInput)); }
      catch (error) { settlementDurabilityError = error; }
    } finally { fs.fsyncSync = originalFsyncSync; }
    equal(settlementDurabilityError && settlementDurabilityError.code, 'SETTLEMENT_RECEIPT_DURABILITY_UNCERTAIN', 'settlement fsync failure has typed durability uncertainty');
    equal(fsyncCalls, 1, 'settlement fault injection reaches the settlement file fsync');
    equal(proposalFsyncService.inspect().settlementCount, 1, 'settlement may remain inspectable after fsync failure');
    const uncertainSettlement = canonicalRead(settlementFile(proposalFsyncRoot, 1));
    equal(uncertainSettlement.truth.writeAndReloadCompletionPersistedSeparately, false, 'uncertain settlement claims no separately persisted completion');

    const replacementSourceRoot = cloneRoot(tempRoot, scenario.sourceARoot, 'v37-replacement-source');
    const replacementSourceOptions = copy(scenario.sourceAOptions); replacementSourceOptions.stateRoot = replacementSourceRoot;
    const replacementRoot = Fixture.makeDir(tempRoot, 'v37-replacement-settlement');
    const replacementOptions = Fixture.serviceOptions(replacementRoot, replacementSourceOptions, 'v37-replacement-log');
    const replacementService = Settlement.createService(copy(replacementOptions));
    const replacementAInput = Fixture.proposalInput(scenario.entryAInput, scenario.entryA, 'replacement-a');
    const replacementAResult = replacementService.propose(copy(replacementAInput));
    const replacementAPending = pendingPackage(replacementAInput, replacementAResult);
    const replacementASettlement = replacementService.settle(Fixture.settlementInput(replacementAPending, 'replacement-a'));
    verifiedRemove(namespace(replacementRoot), replacementRoot);
    verifiedRemove(sourceNamespace(replacementSourceRoot), replacementSourceRoot);
    fs.cpSync(sourceNamespace(scenario.sourceBRoot), sourceNamespace(replacementSourceRoot), { recursive: true });
    equal(replacementService.inspect(), null, 'deleting settlement namespace removes local settled head');
    const replacementBInput = Fixture.proposalInput(scenario.entryBInput, scenario.entryB, 'replacement-b');
    const replacementBResult = replacementService.propose(copy(replacementBInput));
    const replacementBPending = pendingPackage(replacementBInput, replacementBResult);
    const replacementBSettlement = replacementService.settle(Fixture.settlementInput(replacementBPending, 'replacement-b'));
    check(replacementASettlement.settlement.resultingSettledHead.anchoredCheckpointRef.sha256 !== replacementBSettlement.settlement.resultingSettledHead.anchoredCheckpointRef.sha256, 'joint source and settlement replacement can reopen a divergent sequence one');
    equal(replacementBSettlement.settlement.truth.deletionOrRollbackPrevented, false, 'replacement counterexample claims no rollback prevention');

    const lockPath = path.join(namespace(settlementRoot), Settlement.LOCK_FILE);
    fs.writeFileSync(lockPath, '{"schema":"axm.model-shadow-retention-audit-review-outcome-transition-settlement-ledger-operation-lock/v1"}\n', 'utf8');
    throwsCode(() => service.inspect(), 'SETTLEMENT_OPERATION_BUSY', 'stale operation lock fails inspect closed');
    fs.unlinkSync(lockPath);
    equal(service.inspect().settlementCount, 2, 'inspect resumes after explicit task-owned lock removal');

    const corruptProposalRoot = cloneRoot(tempRoot, settlementRoot, 'v37-corrupt-proposal');
    const corruptProposal = canonicalRead(proposalFile(corruptProposalRoot, 1));
    corruptProposal.proposalDigest = 'sha256:' + '0'.repeat(64);
    canonicalWrite(proposalFile(corruptProposalRoot, 1), corruptProposal);
    throwsCode(() => Settlement.createService(Fixture.serviceOptions(corruptProposalRoot, scenario.sourceAOptions)).inspect(), 'SETTLEMENT_PROPOSAL_CORRUPT', 'proposal digest corruption fails closed');
    const corruptSettlementRoot = cloneRoot(tempRoot, settlementRoot, 'v37-corrupt-settlement');
    const corruptSettlement = canonicalRead(settlementFile(corruptSettlementRoot, 2));
    corruptSettlement.settlementDigest = 'sha256:' + '0'.repeat(64);
    canonicalWrite(settlementFile(corruptSettlementRoot, 2), corruptSettlement);
    throwsCode(() => Settlement.createService(Fixture.serviceOptions(corruptSettlementRoot, scenario.sourceAOptions)).inspect(), 'SETTLEMENT_RECEIPT_CORRUPT', 'settlement digest corruption fails closed');
    const noncanonicalRoot = cloneRoot(tempRoot, settlementRoot, 'v37-noncanonical');
    fs.appendFileSync(proposalFile(noncanonicalRoot, 1), ' ', 'utf8');
    throwsCode(() => Settlement.createService(Fixture.serviceOptions(noncanonicalRoot, scenario.sourceAOptions)).inspect(), 'SETTLEMENT_PROPOSAL_CORRUPT', 'noncanonical proposal fails closed');
    const gapRoot = cloneRoot(tempRoot, settlementRoot, 'v37-gap');
    fs.renameSync(proposalFile(gapRoot, 2), proposalFile(gapRoot, 3));
    throwsCode(() => Settlement.createService(Fixture.serviceOptions(gapRoot, scenario.sourceAOptions)).inspect(), 'SETTLEMENT_SEQUENCE_CORRUPT', 'proposal sequence gap fails closed');
    const unmatchedRoot = cloneRoot(tempRoot, settlementRoot, 'v37-unmatched');
    fs.unlinkSync(settlementFile(unmatchedRoot, 1));
    fs.unlinkSync(settlementFile(unmatchedRoot, 2));
    throwsCode(() => Settlement.createService(Fixture.serviceOptions(unmatchedRoot, scenario.sourceAOptions)).inspect(), 'SETTLEMENT_SEQUENCE_CORRUPT', 'more than one trailing pending proposal fails closed');
    const unexpectedRoot = cloneRoot(tempRoot, settlementRoot, 'v37-unexpected');
    fs.writeFileSync(path.join(namespace(unexpectedRoot), 'unexpected.json'), '{}\n', 'utf8');
    throwsCode(() => Settlement.createService(Fixture.serviceOptions(unexpectedRoot, scenario.sourceAOptions)).inspect(), 'SETTLEMENT_NAMESPACE_CORRUPT', 'unexpected namespace file fails closed');
    const oversizedRoot = cloneRoot(tempRoot, settlementRoot, 'v37-oversized');
    fs.writeFileSync(proposalFile(oversizedRoot, 1), 'x'.repeat(Settlement.MAX_ARTIFACT_CANONICAL_BYTES + 2), 'utf8');
    throwsCode(() => Settlement.createService(Fixture.serviceOptions(oversizedRoot, scenario.sourceAOptions)).inspect(), 'SETTLEMENT_PROPOSAL_CORRUPT', 'oversized stored proposal fails closed');
    const manifestCorruptRoot = cloneRoot(tempRoot, settlementRoot, 'v37-manifest-corrupt');
    const manifestCorrupt = canonicalRead(path.join(namespace(manifestCorruptRoot), Settlement.MANIFEST_FILE));
    manifestCorrupt.manifestDigest = 'sha256:' + '0'.repeat(64);
    canonicalWrite(path.join(namespace(manifestCorruptRoot), Settlement.MANIFEST_FILE), manifestCorrupt);
    throwsCode(() => Settlement.createService(Fixture.serviceOptions(manifestCorruptRoot, scenario.sourceAOptions)).inspect(), 'SETTLEMENT_MANIFEST_CORRUPT', 'manifest digest corruption fails closed');

    const persisted = JSON.stringify({
      manifest: canonicalRead(manifestPath),
      proposals: [canonicalRead(proposalFile(settlementRoot, 1)), canonicalRead(proposalFile(settlementRoot, 2))],
      settlements: [canonicalRead(settlementFile(settlementRoot, 1)), canonicalRead(settlementFile(settlementRoot, 2))],
      snapshot: service.inspect()
    });
    equal(persisted.includes(settlementRoot), false, 'persisted artifacts omit settlement path');
    equal(persisted.includes(scenario.sourceARoot), false, 'persisted artifacts omit source path');
    equal(persisted.includes('sourceRecordInput'), false, 'persisted artifacts omit v3.6 caller rebuild input');
    equal(persisted.includes('transitionReceipt'), false, 'persisted artifacts omit v3.5 transition receipt');
    equal(persisted.includes('BEGIN PUBLIC KEY'), false, 'persisted artifacts omit raw public keys');
    equal(persisted.includes('signature'), false, 'persisted artifacts omit raw signatures');
    equal(persisted.includes('policyAuthorizations'), false, 'persisted artifacts omit v3.4 anchor inputs');
    equal(persisted.includes('signedAttestations'), false, 'persisted artifacts omit v3.4 witness inputs');
    equal(service.inspect().truth.externalRetentionProven, false, 'local settlement snapshot claims no external retention');
    equal(service.inspect().truth.globallyConsistentLogProven, false, 'local settlement snapshot claims no globally consistent log');
    equal(service.inspect().truth.executionAuthorized, false, 'local settlement snapshot grants no execution authority');

    const schemaNames = ['manifest.schema.json', 'proposal.schema.json', 'settlement.schema.json', 'snapshot.schema.json'];
    const schemas = schemaNames.map(name => ({ name, value: JSON.parse(fs.readFileSync(path.join(__dirname, name), 'utf8')) }));
    schemas.forEach(item => {
      equal(item.value.$schema, 'https://json-schema.org/draft/2020-12/schema', item.name + ' declares Draft 2020-12');
      equal(item.value.additionalProperties, false, item.name + ' closes top-level fields');
      equal(everyObjectClosed(item.value), true, item.name + ' closes every local object shape');
    });
    assertClosedShape(canonicalRead(manifestPath), schemas[0].value, schemas[0].value, 'manifest');
    check(true, 'stored manifest matches every required closed local schema shape');
    assertClosedShape(canonicalRead(proposalFile(settlementRoot, 1)), schemas[1].value, schemas[1].value, 'proposal');
    check(true, 'stored proposal matches every required closed local schema shape');
    assertClosedShape(canonicalRead(settlementFile(settlementRoot, 1)), schemas[2].value, schemas[2].value, 'settlement');
    check(true, 'stored settlement matches every required closed local schema shape');
    assertClosedShape(service.inspect(), schemas[3].value, schemas[3].value, 'snapshot');
    check(true, 'derived snapshot matches every required closed local schema shape');
    equal(schemas[1].value.$defs.truth.properties.sourceObservationAtomicWithProposalWrite.const, false, 'proposal schema fixes observation atomicity false');
    equal(schemas[2].value.$defs.truth.properties.postwriteSourceCurrentnessProven.const, false, 'settlement schema fixes postwrite currentness false');

    const contract = JSON.parse(fs.readFileSync(path.join(__dirname, 'module.contract.json'), 'utf8'));
    equal(ContractVerifier.validateContract(contract), { pass: true, errors: [] }, 'module contract passes repository verifier');
    equal(contract.version, 'v3.7', 'contract version is exact');
    equal(contract.status, 'TEST', 'contract remains TEST');
    equal(contract.lifecycle.installed, false, 'module remains uninstalled');
    equal(contract.lifecycle.promoted, false, 'module remains unpromoted');
    equal(contract.merge_gate, 'Mike Tobi / AXM', 'Mike Tobi remains merge gate');
    equal(contract.provides.length, 31, 'contract exposes thirty-one bounded handoffs');
    check(contract.boundaries.refuses.includes('prewrite-source-match-as-proof-of-postwrite-or-later-currentness'), 'contract refuses prewrite currentness inflation');
    check(contract.boundaries.refuses.includes('distinct-caller-owned-local-root-as-independent-external-retention-or-custody'), 'contract refuses distinct local root as external custody');

    const source = fs.readFileSync(path.join(__dirname, 'model-shadow-retention-audit-review-outcome-transition-settlement-ledger.js'), 'utf8');
    check(source.includes("require('../model-shadow-retention-audit-review-outcome-history-checkpoint-anchor-pairwise-ledger/"), 'runtime composes exact v3.6 module');
    check(source.includes("fs.openSync(filePath, 'wx'"), 'runtime uses exclusive artifact creation');
    check(source.includes('fs.fsyncSync(descriptor)'), 'runtime file-fsyncs persisted artifacts');
    check(source.includes("fs.openSync(paths.lock, 'wx'"), 'runtime uses fixed exclusive operation lock');
    equal(source.includes('fetch('), false, 'runtime contains no network fetch');
    equal(source.includes('crypto.sign'), false, 'runtime performs no signing');
    equal(source.includes('generateKeyPair'), false, 'runtime generates no key pair');
    equal(source.includes('createPrivateKey'), false, 'runtime ingests no private key API');
    equal(source.includes('provider.invoke'), false, 'runtime invokes no provider');
    equal(Settlement.buildProposal, undefined, 'proposal builder is not exported as a write substitute');
    equal(Settlement.buildSettlement, undefined, 'settlement builder is not exported as a write substitute');
    equal(Settlement.SOURCE_CAPTURE_STATES, ['PRESENT', 'ABSENT', 'INVALID'], 'source capture state vocabulary is exact and public');

    console.log('RESULT ' + checks + ' focused assertions passed');
  } finally {
    verifiedRemove(tempRoot, os.tmpdir());
  }
}

main().catch(error => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
