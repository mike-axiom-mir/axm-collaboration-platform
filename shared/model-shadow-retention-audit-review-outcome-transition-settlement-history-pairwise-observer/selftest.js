#!/usr/bin/env node
'use strict';

const childProcess = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Observer = require('./model-shadow-retention-audit-review-outcome-transition-settlement-history-pairwise-observer');
const Fixture = require('./selftest-fixture');
const V36 = require('../model-shadow-retention-audit-review-outcome-history-checkpoint-anchor-pairwise-ledger/model-shadow-retention-audit-review-outcome-history-checkpoint-anchor-pairwise-ledger');
const V37 = require('../model-shadow-retention-audit-review-outcome-transition-settlement-ledger/model-shadow-retention-audit-review-outcome-transition-settlement-ledger');
const V38 = require('../model-shadow-retention-audit-review-outcome-transition-settlement-pairwise-observer/model-shadow-retention-audit-review-outcome-transition-settlement-pairwise-observer');

let assertions = 0;
function check(condition, message) {
  assertions += 1;
  if (!condition) throw new Error('FAIL: ' + message);
  console.log('PASS ' + message);
}
function equal(actual, expected, message) { check(Observer.stableStringify(actual) === Observer.stableStringify(expected), message); }
function throwsCode(operation, code, message) {
  let observed = null;
  try { operation(); } catch (error) { observed = error.code || error.name; }
  equal(observed, code, message);
}
function canonicalRead(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }
function canonicalWrite(file, value) { fs.writeFileSync(file, Observer.stableStringify(value) + '\n', 'utf8'); }
function writePackage(root, name, value) { const file = path.join(root, name + '.json'); canonicalWrite(file, value); return file; }
function runChild(file) {
  const result = childProcess.spawnSync(process.execPath, [path.join(__dirname, 'selftest-child.js'), file], { encoding: 'utf8', windowsHide: true, maxBuffer: 16 * 1024 * 1024 });
  if (result.status !== 0) throw new Error('child failed: ' + result.stdout + result.stderr);
  return JSON.parse(result.stdout);
}
function treeDigest(root) {
  const files = [];
  function visit(directory, relative) {
    fs.readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name)).forEach(entry => {
      const absolute = path.join(directory, entry.name);
      const rel = path.join(relative, entry.name).replace(/\\/g, '/');
      if (entry.isDirectory()) visit(absolute, rel);
      else if (entry.isFile()) files.push([rel, crypto.createHash('sha256').update(fs.readFileSync(absolute)).digest('hex')]);
      else files.push([rel, 'NON_REGULAR']);
    });
  }
  visit(root, '');
  return crypto.createHash('sha256').update(JSON.stringify(files)).digest('hex');
}
function assertClosedShape(value, schema, root, label) {
  const objectType = schema && (schema.type === 'object' || (Array.isArray(schema.type) && schema.type.includes('object')));
  check(objectType && schema.additionalProperties === false, label + ' schema closes object shape');
  const properties = schema.properties || {};
  equal(Object.keys(value).sort(), (schema.required || []).slice().sort(), label + ' has every and only required field');
  for (const key of Object.keys(value)) {
    const child = properties[key];
    if (!child || value[key] === null) continue;
    const resolved = child.$ref ? child.$ref.split('/').slice(2).reduce((node, part) => node[part], root.$defs) : child;
    if (Array.isArray(value[key]) && resolved.items && value[key].length) {
      const itemSchema = resolved.items.$ref ? resolved.items.$ref.split('/').slice(2).reduce((node, part) => node[part], root.$defs) : resolved.items;
      const itemObject = itemSchema.type === 'object' || (Array.isArray(itemSchema.type) && itemSchema.type.includes('object'));
      if (itemObject) value[key].forEach((item, index) => assertClosedShape(item, itemSchema, root, label + '.' + key + '[' + index + ']'));
    } else if (resolved.type === 'object' || (Array.isArray(resolved.type) && resolved.type.includes('object'))) assertClosedShape(value[key], resolved, root, label + '.' + key);
  }
}

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'axm-v39-history-pairwise-'));
try {
  check(Observer.VERSION === '3.9.0' && Observer.STATUS === 'TEST', 'observer identity is v3.9.0 TEST');
  equal(Observer.SIDE_OBSERVATIONS.length, 6, 'side observation vocabulary has six states');
  equal(Observer.CLASSIFICATIONS.length, 7, 'pairwise classification vocabulary has seven states');
  throwsCode(() => Observer.buildObservation({}), 'INVALID_INPUT', 'closed input rejects missing fields');
  throwsCode(() => Observer.buildObservation({ observationId: 'x', observedAt: '2026-08-21T00:00:00.000Z', left: {}, right: {}, extra: true }), 'INVALID_INPUT', 'closed input rejects extra fields');

  const scenario = Fixture.buildScenario(tempRoot);
  const matchingLeft = Fixture.startLane(tempRoot, 'matching-left', scenario.sourceAOptions, 'v39-matching-left');
  const matchingRight = Fixture.startLane(tempRoot, 'matching-right', scenario.sourceAOptions, 'v39-matching-right');
  Fixture.appendExact(matchingLeft, scenario.entryAInput, scenario.entryA, 'matching-left');
  Fixture.appendExact(matchingRight, scenario.entryAInput, scenario.entryA, 'matching-right');

  const exactInput = Fixture.pairInput(matchingLeft.serviceOptions, matchingLeft.serviceOptions, 'exact-replay', matchingLeft.latestAt);
  const rootsBefore = [treeDigest(matchingLeft.stateRoot), treeDigest(scenario.sourceARoot)];
  const exactReceipt = Observer.buildObservation(exactInput);
  equal(exactReceipt.classification, 'PRESENTED_COMPLETE_HISTORY_EXACT_REPLAY', 'same presented complete history is exact replay');
  check(exactReceipt.comparison.completeArtifactHistoryExactReplay, 'exact replay compares the complete artifact commitment');
  check(exactReceipt.comparison.completeNormalizedEventHistoriesMatch, 'exact replay also matches normalized event histories');
  equal(exactReceipt.left.historyCommitment.eventCount, 2, 'one proposal and settlement become two committed events');
  equal(exactReceipt.left.historyCommitment.proposalCount, 1, 'complete commitment counts one proposal');
  equal(exactReceipt.left.historyCommitment.settlementCount, 1, 'complete commitment counts one settlement');
  check(exactReceipt.truth.completeProposalAndSettlementArtifactHistoriesCompared, 'truth records complete local artifact-history comparison');
  check(exactReceipt.truth.intermediateHeldSettlementOutcomesCompared, 'truth records intermediate held-outcome coverage');
  check(!exactReceipt.truth.atomicSingleRootHistorySnapshotProven && !exactReceipt.truth.atomicTwoRootHistorySnapshotProven, 'truth denies atomic history snapshots');
  check(!exactReceipt.truth.callerPackagesRebuilt && !exactReceipt.truth.liveV36SourceRecaptured, 'truth distinguishes stored-history validation from caller-package or live-source verification');
  check(!exactReceipt.truth.rootsAuthenticatedIndependent && !exactReceipt.truth.globallyConsistentLogProven, 'truth denies independent roots and a global log');
  check(!exactReceipt.truth.executionAuthorized && !exactReceipt.truth.automaticCanon, 'receipt grants no execution or canon authority');
  equal([treeDigest(matchingLeft.stateRoot), treeDigest(scenario.sourceARoot)], rootsBefore, 'complete-history observation writes no source or settlement bytes');
  check(Observer.verifyObservation(exactInput, exactReceipt).pass, 'stable complete-history receipt exact-rebuilds');
  const tamperedReceipt = Fixture.copy(exactReceipt); tamperedReceipt.comparison.commonNormalizedEventPrefixLength = 0;
  check(!Observer.verifyObservation(exactInput, tamperedReceipt).pass, 'tampered complete-history receipt fails exact rebuild');

  const matchingInput = Fixture.pairInput(matchingLeft.serviceOptions, matchingRight.serviceOptions, 'matching-normalized', matchingLeft.latestAt);
  const matchingReceipt = Observer.buildObservation(matchingInput);
  equal(matchingReceipt.classification, 'MATCHING_COMPLETE_TRANSITION_HISTORY_DISTINCT_LOCAL_ARTIFACTS', 'distinct local artifacts can retain matching complete normalized history');
  check(!matchingReceipt.comparison.completeArtifactHistoryExactReplay, 'distinct local artifacts are not called exact artifact replay');
  check(matchingReceipt.comparison.completeNormalizedEventHistoriesMatch, 'normalized proposal and settlement histories match');
  check(matchingReceipt.left.historyCommitment.historyCommitmentDigest !== matchingReceipt.right.historyCommitment.historyCommitmentDigest, 'distinct artifact histories retain different commitments');

  const prefixRight = Fixture.cloneSettlement(tempRoot, matchingLeft, 'prefix-right');
  const entryC = scenario.sourceA.record(Fixture.copy(scenario.entryCInput));
  Fixture.appendExact(prefixRight, scenario.entryCInput, entryC, 'prefix-right');
  const prefixLatest = prefixRight.latestAt;
  const rightExtensionInput = Fixture.pairInput(matchingLeft.serviceOptions, prefixRight.serviceOptions, 'right-extension', prefixLatest);
  const rightExtension = Observer.buildObservation(rightExtensionInput);
  equal(rightExtension.classification, 'RIGHT_COMPLETE_HISTORY_EXTENDS_LEFT_PREFIX', 'right complete history exposes a full normalized prefix extension');
  equal(rightExtension.comparison.commonNormalizedEventPrefixLength, 2, 'right extension retains both left events as its complete prefix');
  check(rightExtension.truth.completeLocalHistoryPrefixExtensionObserved, 'truth records bounded local prefix extension');
  const leftExtensionInput = Fixture.pairInput(prefixRight.serviceOptions, matchingLeft.serviceOptions, 'left-extension', prefixLatest);
  const leftExtension = Observer.buildObservation(leftExtensionInput);
  equal(leftExtension.classification, 'LEFT_COMPLETE_HISTORY_EXTENDS_RIGHT_PREFIX', 'left complete history exposes the reverse prefix extension');

  const divergent = Fixture.startLane(tempRoot, 'divergent', scenario.sourceBOptions, 'v39-divergent');
  Fixture.appendExact(divergent, scenario.entryBInput, scenario.entryB, 'divergent');
  const divergentAt = Date.parse(divergent.latestAt) > Date.parse(matchingLeft.latestAt) ? divergent.latestAt : matchingLeft.latestAt;
  const divergentReceipt = Observer.buildObservation(Fixture.pairInput(matchingLeft.serviceOptions, divergent.serviceOptions, 'divergent', divergentAt));
  equal(divergentReceipt.classification, 'COMPLETE_HISTORY_DIVERGES', 'different first transition becomes complete-history divergence');
  equal(divergentReceipt.comparison.commonNormalizedEventPrefixLength, 0, 'first-event divergence has no common normalized prefix');
  equal(divergentReceipt.comparison.earliestDivergence.eventIndex, 1, 'first divergence location is retained');
  equal([divergentReceipt.comparison.earliestDivergence.leftKind, divergentReceipt.comparison.earliestDivergence.rightKind], ['PROPOSAL', 'PROPOSAL'], 'first divergent event kinds are minimized and explicit');

  const heldParent = Fixture.makeDir(tempRoot, 'held-counterexample');
  const heldScenario = Fixture.buildScenario(heldParent);
  const heldClone = Fixture.cloneSource(heldParent, heldScenario.sourceARoot, heldScenario.sourceAOptions, 'held-source-clone');
  const heldAbsent = Fixture.startLane(heldParent, 'held-absent', heldScenario.sourceAOptions, 'v39-held-shared');
  const heldInvalid = Fixture.startLane(heldParent, 'held-invalid', heldClone.options, 'v39-held-shared');
  const absentPending = Fixture.propose(heldAbsent, heldScenario.entryAInput, heldScenario.entryA, 'held-first');
  const absentBackup = Fixture.moveNamespaceAway(heldParent, heldScenario.sourceARoot, V36.NAMESPACE, 'held-absent-source');
  const absentResult = Fixture.settlePending(heldAbsent, absentPending, 'held-first');
  equal(absentResult.result.settlement.classification, 'HELD_SOURCE_ABSENT', 'counterexample first history retains source-absent hold');
  Fixture.restoreNamespace(heldScenario.sourceARoot, V36.NAMESPACE, absentBackup);
  const invalidPending = Fixture.propose(heldInvalid, heldScenario.entryAInput, heldScenario.entryA, 'held-first');
  const invalidBackup = Fixture.moveNamespaceAway(heldParent, heldClone.root, V36.NAMESPACE, 'held-invalid-source');
  fs.cpSync(invalidBackup, Fixture.sourceNamespace(heldClone.root), { recursive: true, errorOnExist: true });
  const invalidManifestPath = path.join(Fixture.sourceNamespace(heldClone.root), V36.MANIFEST_FILE);
  const invalidManifest = canonicalRead(invalidManifestPath); invalidManifest.manifestDigest = 'sha256:' + '0'.repeat(64); canonicalWrite(invalidManifestPath, invalidManifest);
  const invalidResult = Fixture.settlePending(heldInvalid, invalidPending, 'held-first');
  equal(invalidResult.result.settlement.classification, 'HELD_SOURCE_INVALID', 'counterexample second history retains source-invalid hold');
  Fixture.restoreNamespace(heldClone.root, V36.NAMESPACE, invalidBackup);
  const heldRetryTime = Fixture.add(heldAbsent.latestAt, 1000);
  Fixture.appendExact(heldAbsent, heldScenario.entryAInput, heldScenario.entryA, 'held-retry', heldRetryTime);
  Fixture.appendExact(heldInvalid, heldScenario.entryAInput, heldScenario.entryA, 'held-retry', heldRetryTime);
  const heldLatest = Date.parse(heldAbsent.latestAt) > Date.parse(heldInvalid.latestAt) ? heldAbsent.latestAt : heldInvalid.latestAt;
  const heldInput = Fixture.pairInput(heldAbsent.serviceOptions, heldInvalid.serviceOptions, 'held-outcome-divergence', heldLatest);
  const heldReceipt = Observer.buildObservation(heldInput);
  equal(heldReceipt.classification, 'COMPLETE_HISTORY_DIVERGES', 'complete histories expose different intermediate held outcomes');
  equal(heldReceipt.comparison.earliestDivergence.eventIndex, 2, 'intermediate held-outcome divergence is located at the first settlement');
  equal([heldReceipt.comparison.earliestDivergence.leftKind, heldReceipt.comparison.earliestDivergence.rightKind], ['SETTLEMENT', 'SETTLEMENT'], 'held divergence identifies settlement events without embedding artifacts');
  equal(heldReceipt.left.currentSettledHead, heldReceipt.right.currentSettledHead, 'held counterexample ends at the same settled head');
  equal(heldReceipt.left.snapshotRef, heldReceipt.right.snapshotRef, 'held counterexample ends with the exact same v3.7 snapshot reference');
  equal([heldReceipt.left.proposalCount, heldReceipt.left.settlementCount, heldReceipt.left.heldSettlementCount], [2, 2, 1], 'left counterexample has matching final counts');
  equal([heldReceipt.right.proposalCount, heldReceipt.right.settlementCount, heldReceipt.right.heldSettlementCount], [2, 2, 1], 'right counterexample has matching final counts');
  const v38HeldInput = {
    observationId: 'v38-hidden-held-history', observedAt: Fixture.add(heldLatest, 1000),
    left: Fixture.copy(heldAbsent.latestSide), right: Fixture.copy(heldInvalid.latestSide)
  };
  const v38HeldReceipt = V38.buildObservation(v38HeldInput);
  equal(v38HeldReceipt.classification, 'PRESENTED_FRONTIER_EXACT_REPLAY', 'v3.8 exact snapshot replay cannot expose the different intermediate held outcomes');
  check(!v38HeldReceipt.truth.completeProposalAndSettlementHistoriesCompared, 'v3.8 counterevidence explicitly leaves complete history comparison false');

  const alternateExactInput = Fixture.pairInput(divergent.serviceOptions, divergent.serviceOptions, 'alternate-exact-replay', divergent.latestAt);
  const alternateExactReceipt = Observer.buildObservation(alternateExactInput);
  equal(alternateExactReceipt.classification, 'PRESENTED_COMPLETE_HISTORY_EXACT_REPLAY', 'a jointly replaced distinct history can also exact-replay');
  check(alternateExactReceipt.left.historyCommitment.normalizedEventHistoryDigest !== exactReceipt.left.historyCommitment.normalizedEventHistoryDigest, 'joint exact-replay pairs can commit different complete histories');
  check(!alternateExactReceipt.truth.originalPairContinuityProven, 'joint pair replacement proves no original-pair continuity');

  const foreignParent = Fixture.makeDir(tempRoot, 'foreign-source');
  const foreignScenario = Fixture.buildScenario(foreignParent);
  const foreignLane = Fixture.startLane(foreignParent, 'foreign-lane', foreignScenario.sourceAOptions, 'v39-foreign');
  Fixture.appendExact(foreignLane, foreignScenario.entryAInput, foreignScenario.entryA, 'foreign');
  const foreignAt = Date.parse(foreignLane.latestAt) > Date.parse(matchingLeft.latestAt) ? foreignLane.latestAt : matchingLeft.latestAt;
  const foreignReceipt = Observer.buildObservation(Fixture.pairInput(matchingLeft.serviceOptions, foreignLane.serviceOptions, 'foreign-source', foreignAt));
  equal(foreignReceipt.classification, 'HOLD_SOURCE_IDENTITY_MISMATCH', 'different source identity holds complete-history comparison');

  const absentRoot = Fixture.makeDir(tempRoot, 'absent-root');
  const absentOptions = require('../model-shadow-retention-audit-review-outcome-transition-settlement-ledger/selftest-fixture').serviceOptions(absentRoot, scenario.sourceAOptions, 'v39-absent');
  const absentReceipt = Observer.buildObservation(Fixture.pairInput(absentOptions, matchingLeft.serviceOptions, 'absent-root', matchingLeft.latestAt));
  equal(absentReceipt.left.observation.classification, 'ROOT_ABSENT', 'absent settlement namespace is typed separately');
  equal(absentReceipt.classification, 'HOLD_HISTORY_OBSERVATION', 'absent side holds pairwise history comparison');

  const invalidLane = Fixture.cloneSettlement(tempRoot, matchingLeft, 'invalid-root');
  const invalidSettlementPath = path.join(Fixture.settlementNamespace(invalidLane.stateRoot), V37.SETTLEMENTS_DIRECTORY, '000000000001.json');
  const invalidSettlement = canonicalRead(invalidSettlementPath); invalidSettlement.settlementDigest = 'sha256:' + '0'.repeat(64); canonicalWrite(invalidSettlementPath, invalidSettlement);
  const invalidRootReceipt = Observer.buildObservation(Fixture.pairInput(invalidLane.serviceOptions, matchingRight.serviceOptions, 'invalid-root', matchingRight.latestAt));
  equal(invalidRootReceipt.left.observation.classification, 'ROOT_INVALID', 'v3.7 full-chain inspection failure is typed as invalid root');

  const targetProposal = path.normalize(path.join(Fixture.settlementNamespace(matchingLeft.stateRoot), V37.PROPOSALS_DIRECTORY, '000000000001.json')).toLowerCase();
  const originalRead = fs.readFileSync;
  let targetReads = 0;
  fs.readFileSync = function(file, encoding) {
    if (path.normalize(String(file)).toLowerCase() === targetProposal) {
      targetReads += 1;
      if (targetReads === 2 || targetReads === 4) return '{}\n';
    }
    return originalRead.apply(this, arguments);
  };
  let captureInvalidReceipt;
  try { captureInvalidReceipt = Observer.buildObservation(Fixture.pairInput(matchingLeft.serviceOptions, matchingRight.serviceOptions, 'capture-invalid', matchingLeft.latestAt)); }
  finally { fs.readFileSync = originalRead; }
  equal(captureInvalidReceipt.left.observation.classification, 'HISTORY_CAPTURE_INVALID', 'independent history-capture failure is typed separately from valid v3.7 inspections');

  const originalCreateService = V37.createService;
  const stableSnapshot = originalCreateService(Fixture.copy(matchingLeft.serviceOptions)).inspect();
  const mismatchedSnapshot = Fixture.copy(stableSnapshot); mismatchedSnapshot.proposalCount += 1;
  V37.createService = options => options.stateRoot === matchingLeft.stateRoot ? { inspect() { return Fixture.copy(mismatchedSnapshot); } } : originalCreateService(options);
  let mismatchReceipt;
  try { mismatchReceipt = Observer.buildObservation(Fixture.pairInput(matchingLeft.serviceOptions, matchingRight.serviceOptions, 'snapshot-mismatch', matchingLeft.latestAt)); }
  finally { V37.createService = originalCreateService; }
  equal(mismatchReceipt.left.observation.classification, 'HISTORY_SNAPSHOT_MISMATCH', 'stable history that does not match the presented snapshot is typed separately');

  let changingCalls = 0;
  V37.createService = options => options.stateRoot === matchingLeft.stateRoot ? { inspect() { changingCalls += 1; return Fixture.copy(changingCalls === 1 ? stableSnapshot : mismatchedSnapshot); } } : originalCreateService(options);
  let changedReceipt;
  try { changedReceipt = Observer.buildObservation(Fixture.pairInput(matchingLeft.serviceOptions, matchingRight.serviceOptions, 'changed-root', matchingLeft.latestAt)); }
  finally { V37.createService = originalCreateService; }
  equal(changedReceipt.left.observation.classification, 'ROOT_CHANGED_DURING_CHECK', 'different bracketing snapshots are typed as root change');

  const sideStates = [
    exactReceipt.left.observation.classification,
    absentReceipt.left.observation.classification,
    invalidRootReceipt.left.observation.classification,
    changedReceipt.left.observation.classification,
    captureInvalidReceipt.left.observation.classification,
    mismatchReceipt.left.observation.classification
  ].sort();
  equal(sideStates, Observer.SIDE_OBSERVATIONS.slice().sort(), 'focused cases exercise every side observation classification');
  const pairStates = [
    exactReceipt.classification, matchingReceipt.classification, rightExtension.classification, leftExtension.classification,
    heldReceipt.classification, foreignReceipt.classification, absentReceipt.classification
  ].sort();
  equal(pairStates, Observer.CLASSIFICATIONS.slice().sort(), 'focused cases exercise every pairwise classification');

  throwsCode(() => Observer.buildObservation({ ...exactInput, observedAt: '2020-01-01T00:00:00.000Z' }), 'OBSERVATION_TIME_INVALID', 'caller time cannot predate either exact captured local history');
  const oversized = Fixture.copy(exactInput); oversized.left.serviceOptions.padding = 'x'.repeat(Observer.MAX_INPUT_CANONICAL_BYTES);
  throwsCode(() => Observer.buildObservation(oversized), 'INPUT_TOO_LARGE', 'oversized input fails before observation');

  const childBuild = runChild(writePackage(tempRoot, 'child-build', { action: 'build', input: exactInput }));
  check(childBuild.ok, 'fresh process builds complete-history observation');
  equal(childBuild.receipt, exactReceipt, 'fresh process rebuild is byte-exact for stable roots');
  const childVerify = runChild(writePackage(tempRoot, 'child-verify', { action: 'verify', input: exactInput, receipt: exactReceipt }));
  check(childVerify.ok && childVerify.result.pass, 'fresh process verifies complete-history observation');

  const persisted = Observer.stableStringify(exactReceipt) + Observer.stableStringify(heldReceipt);
  check(!persisted.includes(matchingLeft.stateRoot) && !persisted.includes(scenario.sourceARoot), 'receipts omit source and settlement paths');
  check(!persisted.includes('sourceRecordInput') && !persisted.includes('proposalInput'), 'receipts omit caller rebuild packages');
  check(!persisted.includes('privateKey') && !persisted.includes('signature'), 'receipts omit keys and signatures');
  check(!persisted.includes('"modelOutput":') && !persisted.includes('"privateContext":'), 'receipts omit model output and private context payload fields');

  const schema = canonicalRead(path.join(__dirname, 'observation.schema.json'));
  equal(schema.$schema, 'https://json-schema.org/draft/2020-12/schema', 'receipt schema declares Draft 2020-12');
  assertClosedShape(exactReceipt, schema, schema, 'receipt');
  assertClosedShape(divergentReceipt.comparison.earliestDivergence, schema.$defs.nullableDivergence, schema, 'divergence');
  equal(schema.$defs.truth.properties.atomicTwoRootHistorySnapshotProven.const, false, 'schema fixes atomic two-root history false');
  equal(schema.$defs.truth.properties.liveV36SourceRecaptured.const, false, 'schema fixes live source recapture false');
  equal(schema.$defs.truth.properties.rootsAuthenticatedIndependent.const, false, 'schema fixes root independence false');
  equal(schema.$defs.truth.properties.globallyConsistentLogProven.const, false, 'schema fixes global log false');

  const contract = canonicalRead(path.join(__dirname, 'module.contract.json'));
  equal([contract.schema, contract.version, contract.status], ['axm.module-contract/v1', 'v3.9', 'TEST'], 'module contract identity is exact');
  check(contract.lifecycle.installed === false && contract.lifecycle.promoted === false, 'module remains uninstalled and unpromoted');
  equal(contract.merge_gate, 'Mike Tobi / AXM', 'Mike Tobi and AXM remain the merge gate');
  check(contract.boundaries.refuses.includes('complete-history-double-capture-as-atomic-filesystem-snapshot-or-transient-mutation-exclusion'), 'contract refuses atomicity inflation');
  check(contract.boundaries.refuses.includes('matching-complete-local-history-as-global-uniqueness-or-withheld-history-exclusion'), 'contract refuses globality inflation');
  const source = fs.readFileSync(path.join(__dirname, 'model-shadow-retention-audit-review-outcome-transition-settlement-history-pairwise-observer.js'), 'utf8');
  check(source.includes("require('../model-shadow-retention-audit-review-outcome-transition-settlement-ledger/"), 'runtime composes the exact v3.7 validator');
  check(!source.includes('writeFileSync') && !source.includes('unlinkSync') && !source.includes('mkdirSync'), 'runtime has no filesystem write surface');
  check(!source.includes('fetch(') && !source.includes('http.') && !source.includes('https.'), 'runtime has no network surface');
  check(Observer.captureHistory === undefined, 'raw history capture is not exported as a data bypass');

  console.log('\nSettlement history pairwise-observer selftest: PASS (' + assertions + ' assertions)');
} finally {
  const expectedPrefix = path.join(os.tmpdir(), 'axm-v39-history-pairwise-');
  if (!path.resolve(tempRoot).startsWith(path.resolve(expectedPrefix))) throw new Error('refusing to remove unexpected selftest root');
  fs.rmSync(tempRoot, { recursive: true, force: true });
}
