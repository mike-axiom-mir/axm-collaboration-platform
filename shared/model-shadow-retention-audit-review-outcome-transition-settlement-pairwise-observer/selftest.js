#!/usr/bin/env node
'use strict';

const assert = require('assert');
const childProcess = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const ContractVerifier = require('../../hub/module-contract-verifier');
const V36 = require('../model-shadow-retention-audit-review-outcome-history-checkpoint-anchor-pairwise-ledger/model-shadow-retention-audit-review-outcome-history-checkpoint-anchor-pairwise-ledger');
const V36Fixture = require('../model-shadow-retention-audit-review-outcome-history-checkpoint-anchor-pairwise-ledger/selftest-fixture');
const V37 = require('../model-shadow-retention-audit-review-outcome-transition-settlement-ledger/model-shadow-retention-audit-review-outcome-transition-settlement-ledger');
const V37Fixture = require('../model-shadow-retention-audit-review-outcome-transition-settlement-ledger/selftest-fixture');
const Observer = require('./model-shadow-retention-audit-review-outcome-transition-settlement-pairwise-observer');
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
function namespace(root) { return path.join(root, V37.NAMESPACE); }
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
    cwd: __dirname, encoding: 'utf8', windowsHide: true, timeout: 180000, maxBuffer: 64 * 1024 * 1024
  });
  if (result.status !== 0) throw new Error('child transport failed: ' + result.stderr);
  return JSON.parse(result.stdout);
}
function canonicalWrite(file, value) { fs.writeFileSync(file, V37.stableStringify(value) + '\n', 'utf8'); }
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
  if (schema.$ref) schema = schema.$ref.split('/').slice(1).reduce((current, key) => current[key], root);
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

function latestSide(existing, sourceInput, sourceEntry, tag) {
  const proposalInput = V37Fixture.proposalInput(sourceInput, sourceEntry, 'v38-' + tag);
  const proposalResult = existing.service.propose(copy(proposalInput));
  const settlementInput = V37Fixture.settlementInput({ input: proposalInput, result: proposalResult }, 'v38-' + tag);
  const settlementResult = existing.service.settle(copy(settlementInput));
  return {
    serviceOptions: copy(existing.side.serviceOptions), settlementInput: copy(settlementInput),
    settlementEvidence: copy(settlementResult.prewriteEvidence), settlementReceipt: copy(settlementResult.settlement)
  };
}

function main() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'axm-v38-settlement-pairwise-'));
  try {
    const scenarioRoot = Fixture.makeDir(tempRoot, 'scenario');
    const scenario = V37Fixture.buildScenario(scenarioRoot);
    const settledA = Fixture.settle(Fixture.makeDir(tempRoot, 'settlement-a'), scenario.sourceAOptions, scenario.entryAInput, scenario.entryA, 'a');
    const settledA2 = Fixture.settle(Fixture.makeDir(tempRoot, 'settlement-a2'), scenario.sourceAOptions, scenario.entryAInput, scenario.entryA, 'a2');
    const settledB = Fixture.settle(Fixture.makeDir(tempRoot, 'settlement-b'), scenario.sourceBOptions, scenario.entryBInput, scenario.entryB, 'b');

    equal(Observer.VERSION, '3.8.0', 'version is exact');
    equal(Observer.STATUS, 'TEST', 'status remains TEST');
    equal(Observer.MAX_INPUT_CANONICAL_BYTES, 314572800, 'input is bounded to 300 MiB');
    equal(Observer.MAX_RECEIPT_CANONICAL_BYTES, 2097152, 'receipt is bounded to 2 MiB');

    const exactInput = Fixture.pairInput(settledA.side, settledA.side, 'exact-a');
    const extraInput = copy(exactInput); extraInput.extra = true;
    throwsCode(() => Observer.buildObservation(extraInput), 'INVALID_INPUT', 'unknown top-level field fails closed');
    const earlyInput = copy(exactInput); earlyInput.observedAt = '2020-01-01T00:00:00.000Z';
    throwsCode(() => Observer.buildObservation(earlyInput), 'OBSERVATION_TIME_INVALID', 'observation time cannot predate exact current receipts');

    const sourceBefore = treeDigest(scenario.sourceARoot);
    const settlementBefore = treeDigest(settledA.side.serviceOptions.stateRoot);
    const exact = Observer.buildObservation(copy(exactInput));
    equal(treeDigest(scenario.sourceARoot), sourceBefore, 'observer leaves left source bytes unchanged');
    equal(treeDigest(settledA.side.serviceOptions.stateRoot), settlementBefore, 'observer leaves left settlement bytes unchanged');
    equal(exact.classification, 'PRESENTED_FRONTIER_EXACT_REPLAY', 'same presented frontier is exact replay');
    equal(exact.left.observation.classification, 'EXACT_CURRENT_SETTLEMENT_PACKAGE', 'left exact current package is admitted');
    equal(exact.right.observation.classification, 'EXACT_CURRENT_SETTLEMENT_PACKAGE', 'right exact current package is admitted');
    equal(exact.comparison.exactSnapshotReplay, true, 'exact replay compares identical snapshot digests');
    equal(exact.decision.autonomousActionCount, 0, 'exact replay authorizes zero actions');
    equal(exact.truth.completeProposalAndSettlementHistoriesCompared, false, 'receipt denies complete-history comparison');
    equal(exact.truth.rootsAuthenticatedIndependent, false, 'receipt does not authenticate root independence');
    equal(exact.truth.withheldBranchesExcluded, false, 'receipt does not exclude withheld frontiers');
    equal(Observer.verifyObservation(exactInput, exact).pass, true, 'exact observation rebuilds from caller package');
    const tamperedObservation = copy(exact); tamperedObservation.observationDigest = 'sha256:' + '0'.repeat(64);
    equal(Observer.verifyObservation(exactInput, tamperedObservation).pass, false, 'tampered observation fails exact rebuild');

    const childBuild = runChild(writePackage(tempRoot, 'child-build', { action: 'build', input: exactInput }));
    equal(childBuild.ok, true, 'fresh process builds pairwise observation');
    check(childBuild.pid !== process.pid, 'fresh build uses a distinct process');
    equal(childBuild.result, exact, 'fresh process builds exact same receipt');
    const childVerify = runChild(writePackage(tempRoot, 'child-verify', { action: 'verify', input: exactInput, receipt: exact }));
    equal(childVerify.ok, true, 'fresh process runs pairwise verification');
    equal(childVerify.result.pass, true, 'fresh process exact-rebuilds receipt');

    const matchingInput = Fixture.pairInput(settledA.side, settledA2.side, 'matching-head');
    const matching = Observer.buildObservation(copy(matchingInput));
    equal(matching.classification, 'MATCHING_SETTLED_HEAD_DISTINCT_LOCAL_FRONTIERS', 'same settled head with distinct snapshot is classified without history equivalence');
    equal(matching.comparison.settledHeadsMatch, true, 'matching frontier comparison records equal heads');
    check(matching.left.snapshotRef.sha256 !== matching.right.snapshotRef.sha256, 'matching heads retain distinct local snapshot references');
    equal(matching.truth.sameSettledHeadProvesSameHistory, false, 'matching head does not claim complete history equivalence');

    const sameEpochInput = Fixture.pairInput(settledA.side, settledB.side, 'same-epoch-different-heads');
    const sameEpoch = Observer.buildObservation(copy(sameEpochInput));
    equal(sameEpoch.classification, 'SAME_LOCAL_EPOCH_DIFFERENT_SETTLED_HEADS', 'different compatible heads at one local epoch are exposed precisely');
    equal(sameEpoch.decision.contradictionObserved, true, 'same-epoch different heads record a contradiction');
    equal(sameEpoch.decision.reviewRequired, true, 'same-epoch contradiction remains review-required');
    equal(sameEpoch.truth.globalTransitionUniquenessProven, false, 'co-presented contradiction proves no global exhaustiveness');

    const otherSourceRoot = Fixture.makeDir(tempRoot, 'other-source');
    const otherSourceOptions = V36Fixture.serviceOptions(otherSourceRoot, scenario.upstream, 'v38-other-source-log');
    const otherSource = V36.createService(copy(otherSourceOptions));
    const otherEntryInput = V36Fixture.recordInput(scenario.upstream.transitionA, 'v38-other-entry', V36.CONFIRMATION);
    otherEntryInput.recordedAt = scenario.entryA.recordedAt;
    const otherEntry = otherSource.record(copy(otherEntryInput));
    const otherSettled = Fixture.settle(Fixture.makeDir(tempRoot, 'other-settlement'), otherSourceOptions, otherEntryInput, otherEntry, 'other');
    const identityInput = Fixture.pairInput(settledA.side, otherSettled.side, 'identity-mismatch');
    const identity = Observer.buildObservation(copy(identityInput));
    equal(identity.classification, 'HOLD_SOURCE_IDENTITY_MISMATCH', 'different source identity is held');
    equal(identity.comparison.sourceIdentityMatches, false, 'identity hold records mismatch');
    equal(identity.decision.holdRequired, true, 'identity mismatch requires hold');

    const entryC = scenario.sourceA.record(copy(scenario.entryCInput));
    const latestA = latestSide(settledA, scenario.entryCInput, entryC, 'extension-c');
    const rightExtensionInput = Fixture.pairInput(settledA2.side, latestA, 'right-extension');
    const rightExtension = Observer.buildObservation(copy(rightExtensionInput));
    equal(rightExtension.classification, 'RIGHT_LAST_EXACT_SETTLEMENT_EXTENDS_LEFT_HEAD', 'right latest receipt can expose one relative settlement extension');
    equal(rightExtension.comparison.rightLastExactSettlementExtendsLeftHead, true, 'right extension binds exact left head to right previous head');
    equal(rightExtension.truth.globallyConsistentLogProven, false, 'relative extension proves no globally consistent log');
    const leftExtensionInput = Fixture.pairInput(latestA, settledA2.side, 'left-extension');
    const leftExtension = Observer.buildObservation(copy(leftExtensionInput));
    equal(leftExtension.classification, 'LEFT_LAST_EXACT_SETTLEMENT_EXTENDS_RIGHT_HEAD', 'left latest receipt can expose one relative settlement extension');
    equal(leftExtension.comparison.leftLastExactSettlementExtendsRightHead, true, 'left extension binds exact right head to left previous head');
    const unresolvedInput = Fixture.pairInput(settledB.side, latestA, 'different-epoch-unresolved');
    const unresolved = Observer.buildObservation(copy(unresolvedInput));
    equal(unresolved.classification, 'DIFFERENT_LOCAL_EPOCH_HEAD_RELATION_UNRESOLVED', 'different epochs without a latest-receipt link remain unresolved');
    equal(unresolved.comparison.differentLocalEpochHeadRelationUnresolved, true, 'unresolved result records missing relative history');
    equal(unresolved.decision.contradictionObserved, false, 'different epochs alone are not called a contradiction');

    const noncurrentInput = Fixture.pairInput(settledA2.side, settledA.side, 'noncurrent');
    const noncurrent = Observer.buildObservation(copy(noncurrentInput));
    equal(noncurrent.classification, 'HOLD_FRONTIER_OBSERVATION', 'noncurrent latest package holds pairwise observation');
    equal(noncurrent.right.observation.classification, 'SETTLEMENT_PACKAGE_NOT_CURRENT', 'older exact settlement package is typed noncurrent');
    equal(noncurrent.right.observation.settlementPackageExactRebuild, true, 'noncurrent package retains successful exact rebuild fact');
    equal(noncurrent.right.observation.settlementPackageMatchesCurrentReceipt, false, 'noncurrent package does not match last receipt');

    const pendingRoot = Fixture.makeDir(tempRoot, 'pending-settlement');
    const pendingOptions = V37Fixture.serviceOptions(pendingRoot, scenario.sourceBOptions, 'v38-pending-log');
    const pendingService = V37.createService(copy(pendingOptions));
    pendingService.propose(V37Fixture.proposalInput(scenario.entryBInput, scenario.entryB, 'v38-pending'));
    const pendingSide = copy(settledB.side); pendingSide.serviceOptions = copy(pendingOptions);
    const pending = Observer.buildObservation(Fixture.pairInput(settledA2.side, pendingSide, 'pending'));
    equal(pending.right.observation.classification, 'PENDING_PROPOSAL_PRESENT', 'pending frontier is typed before package mismatch');
    equal(pending.right.observation.pendingProposalPresent, true, 'pending observation retains pending fact');

    const absentRoot = Fixture.makeDir(tempRoot, 'absent-settlement');
    const absentSide = copy(settledA2.side);
    absentSide.serviceOptions = V37Fixture.serviceOptions(absentRoot, scenario.sourceAOptions, 'v38-absent-log');
    const absent = Observer.buildObservation(Fixture.pairInput(settledA2.side, absentSide, 'absent'));
    equal(absent.right.observation.classification, 'ROOT_ABSENT', 'absent namespace becomes typed side observation');
    equal([absent.right.observation.beforeCaptureState, absent.right.observation.afterCaptureState], ['ABSENT', 'ABSENT'], 'absent side records two absent captures');

    const invalidRoot = path.join(tempRoot, 'invalid-settlement');
    fs.cpSync(settledA2.side.serviceOptions.stateRoot, invalidRoot, { recursive: true });
    const invalidManifestPath = path.join(namespace(invalidRoot), V37.MANIFEST_FILE);
    const invalidManifest = JSON.parse(fs.readFileSync(invalidManifestPath, 'utf8'));
    invalidManifest.manifestDigest = 'sha256:' + '0'.repeat(64);
    canonicalWrite(invalidManifestPath, invalidManifest);
    const invalidSide = copy(settledA2.side); invalidSide.serviceOptions.stateRoot = invalidRoot;
    const invalid = Observer.buildObservation(Fixture.pairInput(settledA2.side, invalidSide, 'invalid'));
    equal(invalid.right.observation.classification, 'ROOT_INVALID', 'invalid namespace becomes typed side observation');
    equal([invalid.right.observation.beforeCaptureState, invalid.right.observation.afterCaptureState], ['INVALID', 'INVALID'], 'invalid side records two invalid captures');

    const nonexactSide = copy(settledB.side);
    nonexactSide.settlementReceipt.settlementDigest = 'sha256:' + '0'.repeat(64);
    const nonexact = Observer.buildObservation(Fixture.pairInput(settledA2.side, nonexactSide, 'nonexact'));
    equal(nonexact.right.observation.classification, 'SETTLEMENT_PACKAGE_NOT_EXACT', 'tampered settlement package becomes typed side observation');
    equal(nonexact.truth.leftSettlementPackageExactRebuilt, true, 'held comparison retains independently exact left fact');
    equal(nonexact.truth.rightSettlementPackageExactRebuilt, false, 'held comparison retains independently nonexact right fact');
    equal(noncurrent.truth.rightSettlementPackageExactRebuilt, true, 'noncurrent truth retains independently exact package rebuild');
    equal(noncurrent.truth.rightSettlementPackageMatchesCurrentReceipt, false, 'noncurrent truth separately denies current-receipt match');
    const earlyHeldInput = Fixture.pairInput(settledA2.side, nonexactSide, 'early-held', '2020-01-01T00:00:00.000Z');
    throwsCode(() => Observer.buildObservation(earlyHeldInput), 'OBSERVATION_TIME_INVALID', 'held comparison time still cannot predate independently exact left package');

    const beforeChanged = settledA2.service.inspect();
    const afterChanged = settledB.service.inspect();
    let changedCalls = 0;
    const fakeService = {
      inspect() { changedCalls += 1; return copy(changedCalls === 1 ? beforeChanged : afterChanged); },
      verifySettlementPersisted() { return { pass: true, errors: [], rebuilt: copy(settledB.side.settlementReceipt), stored: copy(settledB.side.settlementReceipt) }; }
    };
    const changedSide = copy(settledB.side); changedSide.serviceOptions.settlementLogId = 'v38-changing-fake';
    const originalCreateService = V37.createService;
    let changed;
    try {
      V37.createService = options => options.settlementLogId === 'v38-changing-fake' ? fakeService : originalCreateService(options);
      changed = Observer.buildObservation(Fixture.pairInput(settledA2.side, changedSide, 'changed'));
    } finally { V37.createService = originalCreateService; }
    equal(changed.right.observation.classification, 'ROOT_CHANGED_DURING_CHECK', 'different valid bracketing snapshots become typed side observation');
    equal(changed.right.observation.settlementPackageExactRebuild, true, 'changed side retains successful exact rebuild fact');
    equal(changed.right.observation.equalBracketingSnapshots, false, 'changed side retains failed bracketing equality');
    equal(changed.truth.rightSettlementPackageExactRebuilt, true, 'changed-side truth retains independently exact package rebuild');

    const sideClassifications = [exact.right, absent.right, invalid.right, changed.right, pending.right, nonexact.right, noncurrent.right]
      .map(side => side.observation.classification).sort();
    equal(sideClassifications, Observer.SIDE_OBSERVATIONS.slice().sort(), 'focused cases exercise every side observation classification');
    const pairClassifications = [exact, matching, rightExtension, leftExtension, sameEpoch, unresolved, identity, nonexact]
      .map(result => result.classification).sort();
    equal(pairClassifications, Observer.CLASSIFICATIONS.slice().sort(), 'focused cases exercise every pairwise classification');

    const exactB = Observer.buildObservation(Fixture.pairInput(settledB.side, settledB.side, 'exact-b'));
    equal(exactB.classification, 'PRESENTED_FRONTIER_EXACT_REPLAY', 'jointly presented alternate pair is also internally exact');
    check(exact.left.currentSettledHead.anchoredCheckpointRef.sha256 !== exactB.left.currentSettledHead.anchoredCheckpointRef.sha256, 'joint pair replacement can present another exact replay with a different head');
    equal(exactB.truth.originalPairContinuityProven, false, 'alternate exact pair proves no original pair continuity');
    equal(exactB.truth.jointPairReplacementStillPossible, true, 'receipt preserves joint pair replacement possibility');

    const serialized = JSON.stringify([exact, matching, sameEpoch, unresolved, rightExtension, nonexact]);
    equal(serialized.includes(tempRoot), false, 'receipts omit temporary root path');
    equal(serialized.includes('serviceOptions'), false, 'receipts omit service options');
    equal(serialized.includes('settlementInput'), false, 'receipts omit settlement caller input');
    equal(serialized.includes('settlementEvidence'), false, 'receipts omit settlement evidence package');
    equal(serialized.includes('sourceRecordInput'), false, 'receipts omit upstream caller package');
    equal(serialized.includes('signature'), false, 'receipts omit signatures');
    equal(serialized.includes('BEGIN PUBLIC KEY'), false, 'receipts omit raw public keys');
    equal(serialized.includes('reviewMaterial'), false, 'receipts omit review material');
    equal(exact.truth.providerInvoked, false, 'receipt claims no provider invocation');
    equal(exact.truth.liveV36SourceRecaptured, false, 'receipt claims no live v3.6 source recapture');
    equal(exact.truth.sourceEntryCurrentnessReverified, false, 'receipt claims no source-entry currentness recheck');
    equal(exact.truth.executionAuthorized, false, 'receipt grants no execution authority');
    equal(exact.truth.automaticCanon, false, 'receipt grants no CANON status');

    const schema = JSON.parse(fs.readFileSync(path.join(__dirname, 'observation.schema.json'), 'utf8'));
    equal(schema.$schema, 'https://json-schema.org/draft/2020-12/schema', 'schema declares Draft 2020-12');
    equal(schema.additionalProperties, false, 'schema closes top-level fields');
    equal(everyObjectClosed(schema), true, 'schema closes every local object shape');
    assertClosedShape(exact, schema, schema, 'pairwise observation');
    check(true, 'exact receipt matches every required closed local schema shape');
    equal(schema.$defs.truth.properties.completeProposalAndSettlementHistoriesCompared.const, false, 'schema fixes complete-history comparison false');
    equal(schema.$defs.truth.properties.rootsAuthenticatedIndependent.const, false, 'schema fixes root independence false');
    equal(schema.$defs.truth.properties.liveV36SourceRecaptured.const, false, 'schema fixes live v3.6 source recapture false');

    const contract = JSON.parse(fs.readFileSync(path.join(__dirname, 'module.contract.json'), 'utf8'));
    equal(ContractVerifier.validateContract(contract), { pass: true, errors: [] }, 'module contract passes repository verifier');
    equal(contract.version, 'v3.8', 'contract version is exact');
    equal(contract.status, 'TEST', 'contract remains TEST');
    equal(contract.lifecycle.installed, false, 'module remains uninstalled');
    equal(contract.lifecycle.promoted, false, 'module remains unpromoted');
    equal(contract.merge_gate, 'Mike Tobi / AXM', 'Mike Tobi remains merge gate');
    equal(contract.provides.length, 21, 'contract exposes twenty-one bounded handoffs');
    check(contract.boundaries.refuses.includes('same-current-settled-head-as-same-complete-proposal-or-settlement-history'), 'contract refuses matching-head history inflation');
    check(contract.boundaries.refuses.includes('caller-owned-roots-as-authenticated-independent-controllers-external-retention-or-custody'), 'contract refuses root independence inflation');

    const source = fs.readFileSync(path.join(__dirname, 'model-shadow-retention-audit-review-outcome-transition-settlement-pairwise-observer.js'), 'utf8');
    check(source.includes("require('../model-shadow-retention-audit-review-outcome-transition-settlement-ledger/"), 'runtime composes exact v3.7 module');
    equal(source.includes("require('fs')"), false, 'runtime imports no direct filesystem writer');
    equal(source.includes('writeFile'), false, 'runtime contains no file-write call');
    equal(source.includes('fetch('), false, 'runtime contains no network fetch');
    equal(source.includes('crypto.sign'), false, 'runtime performs no signing');
    equal(source.includes('provider.invoke'), false, 'runtime invokes no provider');

    console.log('RESULT ' + checks + ' focused assertions passed');
  } finally {
    verifiedRemove(tempRoot, os.tmpdir());
  }
}

try { main(); } catch (error) { console.error(error.stack || error.message); process.exitCode = 1; }
