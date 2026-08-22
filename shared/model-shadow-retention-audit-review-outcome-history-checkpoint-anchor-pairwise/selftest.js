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
const LedgerFixture = require('../model-shadow-retention-audit-review-outcome-ledger/selftest-fixture');
const History = require('../model-shadow-retention-audit-review-outcome-history-checkpoint/model-shadow-retention-audit-review-outcome-history-checkpoint');
const Anchor = require('../model-shadow-retention-audit-review-outcome-history-checkpoint-anchor/model-shadow-retention-audit-review-outcome-history-checkpoint-anchor');
const Pairwise = require('./model-shadow-retention-audit-review-outcome-history-checkpoint-anchor-pairwise');
const Fixture = require('./selftest-fixture');

let checks = 0;
const observedClassifications = new Set();
function check(value, label) { assert.ok(value, label); checks += 1; console.log('PASS ' + label); }
function equal(actual, expected, label) { assert.deepStrictEqual(actual, expected, label); checks += 1; console.log('PASS ' + label); }
function throws(operation, pattern, label) { assert.throws(operation, pattern, label); checks += 1; console.log('PASS ' + label); }
function copy(value) { return Fixture.copy(value); }
function makeDir(parent, name) { const target = path.join(parent, name); fs.mkdirSync(target); return target; }
function verifiedRemove(target, parent) {
  const resolvedTarget = path.resolve(target); const resolvedParent = path.resolve(parent);
  if (resolvedTarget === resolvedParent || !resolvedTarget.startsWith(resolvedParent + path.sep)) throw new Error('unsafe cleanup target');
  fs.rmSync(resolvedTarget, { recursive: true, force: true });
}
function writePackage(parent, name, value) {
  const target = path.join(parent, name + '.json');
  fs.writeFileSync(target, JSON.stringify(value), { encoding: 'utf8', mode: 0o600 });
  return target;
}
function runChild(packagePath) {
  const result = childProcess.spawnSync(process.execPath, [path.join(__dirname, 'selftest-child.js'), packagePath], {
    cwd: __dirname, encoding: 'utf8', windowsHide: true, timeout: 120000, maxBuffer: 128 * 1024 * 1024
  });
  return { status: result.status, value: result.status === 0 ? JSON.parse(result.stdout) : null, stderr: result.stderr };
}
function redigestCheckpoint(value, checkpointId, checkpointedAt, mutate) {
  const result = copy(value);
  result.checkpointId = checkpointId;
  result.checkpointedAt = checkpointedAt;
  if (mutate) mutate(result);
  delete result.checkpointDigest;
  result.checkpointDigest = History.sha256(result);
  return History.validateCheckpoint(result);
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
function transition(previous, candidate, tag, expected) {
  const input = Fixture.transitionInput(previous, candidate, tag);
  const receipt = Pairwise.buildTransition(input);
  observedClassifications.add(receipt.classification);
  equal(receipt.classification, expected, tag + ' classification is exact');
  equal(receipt.decision.reviewRequired, true, tag + ' always requires review');
  equal(receipt.decision.holdRequired, expected.startsWith('HOLD_'), tag + ' hold flag matches classification');
  equal(receipt.decision.autonomousActionCount, 0, tag + ' authorizes zero autonomous actions');
  equal(Pairwise.verifyTransition(input, receipt).pass, true, tag + ' receipt exact-rebuilds');
  return { input, receipt };
}
function packageFor(checkpoint, tag, authority, epoch, settings) {
  return Fixture.buildPackage(checkpoint, tag, authority, Object.assign({ anchorEpoch: epoch }, settings || {}));
}
function assertClosedShape(value, schema, root, label) {
  const resolved = schema.$ref ? schema.$ref.split('/').slice(1).reduce((current, key) => current[key], root) : schema;
  if (resolved.type === 'object') {
    assert.strictEqual(resolved.additionalProperties, false, label + ' schema must be closed');
    assert.deepStrictEqual(Object.keys(value).sort(), resolved.required.slice().sort(), label + ' fields must be exact');
    Object.keys(value).forEach(key => assertClosedShape(value[key], resolved.properties[key], root, label + '.' + key));
  } else if (resolved.type === 'array') {
    value.forEach((entry, index) => assertClosedShape(entry, resolved.items, root, label + '[' + index + ']'));
  }
}
function everyObjectClosed(schema) {
  let pass = true;
  function walk(value) {
    if (!value || typeof value !== 'object') return;
    if (value.type === 'object' && value.additionalProperties !== false) pass = false;
    Object.values(value).forEach(walk);
  }
  walk(schema);
  return pass;
}

function main() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'axm-v35-anchored-pairwise-'));
  try {
    const baseItem = LedgerFixture.outcomeFixture(tempRoot, 'APPROVED', 'v35-base');
    const baseRoot = makeDir(tempRoot, 'base-ledger');
    const baseOptions = LedgerFixture.serviceOptions(baseRoot, 'v35-review-outcome-ledger', '2020-01-01T00:00:00.000Z');
    const baseService = Ledger.createService(copy(baseOptions));
    const baseRecordedAt = LedgerFixture.after(baseItem.outcome.observedAt);
    baseService.capture(LedgerFixture.captureInput(baseItem, 'v35-record:base', baseRecordedAt));
    const baseCheckpointTime = LedgerFixture.after(baseRecordedAt, 60000);
    const baseCheckpoint = History.createCheckpoint({ checkpointId: 'v35-checkpoint:base', checkpointedAt: baseCheckpointTime, serviceOptions: copy(baseOptions) });

    equal(Pairwise.VERSION, '3.5.0', 'version is exact');
    equal(Pairwise.STATUS, 'TEST', 'status remains TEST');
    equal(Pairwise.CLASSIFICATIONS.length, 19, 'classification set is closed to nineteen outcomes');
    equal(Pairwise.MAX_INPUT_CANONICAL_BYTES, 134217728, 'input envelope is bounded to 128 MiB');
    equal(Pairwise.MAX_RECEIPT_CANONICAL_BYTES, 1048576, 'receipt envelope is bounded to 1 MiB');
    equal(History.validateCheckpoint(baseCheckpoint), baseCheckpoint, 'base v3.3 checkpoint self-validates');

    const authority = Fixture.createAuthority('stable');
    const basePackage = packageFor(baseCheckpoint, 'base', authority, 1);
    equal(Anchor.verifyAnchoredCheckpoint(basePackage.anchoredInput, basePackage.anchoredReceipt).pass, true, 'base v3.4 package exact-rebuilds');

    const exact = transition(basePackage, basePackage, 'exact-replay', 'PRESENTED_ANCHORED_PACKAGE_EXACT_REPLAY');
    equal(exact.receipt.comparison.sameCheckpointDigest, true, 'exact replay preserves checkpoint digest');
    equal(exact.receipt.comparison.sameAnchoredReceiptDigest, true, 'exact replay preserves anchored receipt digest');
    equal(exact.receipt.truth.exactAnchoredPackageReplayObserved, true, 'exact replay truth is explicit');

    const recheckpointTime = Fixture.add(baseCheckpointTime, 60000);
    const recheckpointValue = History.createCheckpoint({ checkpointId: 'v35-checkpoint:recheckpoint', checkpointedAt: recheckpointTime, serviceOptions: copy(baseOptions) });
    const recheckpointPackage = packageFor(recheckpointValue, 'recheckpoint', authority, 2);
    const recheckpoint = transition(basePackage, recheckpointPackage, 'exact-recheckpoint', 'PRESENTED_HISTORY_EXACT_RECHECKPOINT');
    equal(recheckpoint.receipt.comparison.sameHistory, true, 'recheckpoint preserves complete ordered history');
    equal(recheckpoint.receipt.comparison.sameSnapshotBinding, true, 'recheckpoint preserves snapshot binding');
    equal(recheckpoint.receipt.comparison.anchorEpochExactlyNext, true, 'recheckpoint advances exactly one caller epoch');
    equal(recheckpoint.receipt.decision.forwardHistoryCandidate, false, 'recheckpoint is not a history extension');

    const forkARoot = path.join(tempRoot, 'fork-a-ledger');
    const forkBRoot = path.join(tempRoot, 'fork-b-ledger');
    fs.cpSync(baseRoot, forkARoot, { recursive: true });
    fs.cpSync(baseRoot, forkBRoot, { recursive: true });
    const forkAOptions = LedgerFixture.serviceOptions(forkARoot, baseOptions.ledgerId, baseOptions.createdAt);
    const forkBOptions = LedgerFixture.serviceOptions(forkBRoot, baseOptions.ledgerId, baseOptions.createdAt);
    const forkAService = Ledger.createService(copy(forkAOptions));
    const forkBService = Ledger.createService(copy(forkBOptions));
    const forkAItem = LedgerFixture.outcomeFixture(tempRoot, 'HOLD', 'v35-fork-a');
    const forkARecordedAt = LedgerFixture.laterThan([recheckpointTime, forkAItem.outcome.observedAt], 60000);
    forkAService.capture(LedgerFixture.captureInput(forkAItem, 'v35-record:fork-a', forkARecordedAt));
    const forkACheckpointTime = Fixture.add(forkARecordedAt, 60000);
    const forkACheckpoint = History.createCheckpoint({ checkpointId: 'v35-checkpoint:fork-a', checkpointedAt: forkACheckpointTime, serviceOptions: copy(forkAOptions) });
    const forkBItem = LedgerFixture.outcomeFixture(tempRoot, 'REJECTED', 'v35-fork-b');
    const forkBRecordedAt = LedgerFixture.laterThan([forkACheckpointTime, forkBItem.outcome.observedAt], 60000);
    forkBService.capture(LedgerFixture.captureInput(forkBItem, 'v35-record:fork-b', forkBRecordedAt));
    const forkBCheckpointTime = Fixture.add(forkBRecordedAt, 60000);
    const forkBCheckpoint = History.createCheckpoint({ checkpointId: 'v35-checkpoint:fork-b', checkpointedAt: forkBCheckpointTime, serviceOptions: copy(forkBOptions) });
    const forkAPackage = packageFor(forkACheckpoint, 'fork-a', authority, 2);
    const forkBPackage = packageFor(forkBCheckpoint, 'fork-b', authority, 2);

    const beforeTree = treeDigest(baseRoot);
    const forwardA = transition(basePackage, forkAPackage, 'forward-a', 'CANDIDATE_EXTENDS_PRESENTED_ANCHORED_HISTORY');
    const afterTree = treeDigest(baseRoot);
    equal(beforeTree, afterTree, 'pairwise comparison leaves the origin ledger byte-for-byte unchanged');
    equal(forwardA.receipt.comparison.previousHistoryPrefixesCandidate, true, 'forward A preserves every previous ordered entry');
    equal(forwardA.receipt.historyContinuity.commonHistoryPrefixCount, 1, 'forward A reports the exact common prefix length');
    equal(forwardA.receipt.comparison.anchorContinuityProfileMatches, true, 'normalized anchor profile remains stable across epochs');
    equal(forwardA.receipt.comparison.witnessPolicyContinuityProfileMatches, true, 'normalized witness profile remains stable across checkpoint bindings');
    equal(forwardA.receipt.decision.forwardHistoryCandidate, true, 'forward A is only a review candidate');
    equal(forwardA.receipt.truth.retentionHoldResolved, false, 'forward A leaves retention hold unresolved');
    equal(forwardA.receipt.truth.executionAuthorized, false, 'forward A grants no execution authority');

    const forwardB = transition(basePackage, forkBPackage, 'forward-b', 'CANDIDATE_EXTENDS_PRESENTED_ANCHORED_HISTORY');
    equal(forwardB.receipt.anchorContinuity.candidateEpoch, 2, 'independent forward B also claims the same next epoch');
    check(forwardA.receipt.candidateCheckpointRef.sha256 !== forwardB.receipt.candidateCheckpointRef.sha256, 'same-next-epoch candidates have distinct checkpoint digests');
    equal(forwardB.receipt.truth.twoIndependentCandidatesMayUseSameNextEpoch, true, 'same-next-epoch counterexample is explicit');
    equal(forwardB.receipt.truth.withheldBranchesExcluded, false, 'withheld branches remain unexcluded');
    const forkVisible = transition(forkAPackage, forkBPackage, 'same-next-epoch-fork', 'HOLD_HISTORY_REPLACEMENT_OR_FORK');
    equal(forkVisible.receipt.comparison.anchorEpochNotAdvanced, true, 'co-presented fork shares one caller epoch');
    equal(forkVisible.receipt.comparison.commonHistoryPrefixCount, 1, 'co-presented fork exposes only its common ordered prefix');
    equal(forkVisible.receipt.truth.historyReplacementOrForkObserved, true, 'fork truth remains visible ahead of epoch symptom');

    const rollbackTime = Fixture.add(forkBCheckpointTime, 60000);
    const rollbackCheckpoint = History.createCheckpoint({ checkpointId: 'v35-checkpoint:strict-rollback', checkpointedAt: rollbackTime, serviceOptions: copy(baseOptions) });
    const rollbackPackage = packageFor(rollbackCheckpoint, 'strict-rollback', authority, 3);
    const rollback = transition(forkAPackage, rollbackPackage, 'strict-rollback', 'HOLD_STRICT_HISTORY_ROLLBACK');
    equal(rollback.receipt.comparison.candidateHistoryPrefixesPrevious, true, 'rollback candidate is an exact strict history prefix');
    equal(rollback.receipt.truth.strictHistoryRollbackObserved, true, 'rollback truth is explicit');
    equal(rollback.receipt.truth.deletionOrRollbackPrevented, false, 'rollback detection claims no prevention');

    const alternatePackage = packageFor(baseCheckpoint, 'alternate-same-checkpoint', authority, 1);
    const alternate = transition(basePackage, alternatePackage, 'alternate-package', 'HOLD_ALTERNATE_ANCHORED_PACKAGE_FOR_SAME_CHECKPOINT');
    equal(alternate.receipt.comparison.sameCheckpointDigest, true, 'alternate package binds the same checkpoint bytes');
    equal(alternate.receipt.comparison.sameAnchoredReceiptDigest, false, 'alternate package has a distinct anchored receipt');

    const collisionCheckpoint = History.createCheckpoint({ checkpointId: 'v35-checkpoint:time-collision', checkpointedAt: baseCheckpointTime, serviceOptions: copy(baseOptions) });
    const collisionPackage = packageFor(collisionCheckpoint, 'time-collision', authority, 2);
    const collision = transition(basePackage, collisionPackage, 'time-collision', 'HOLD_PRESENTED_TIME_COLLISION');
    equal(collision.receipt.comparison.candidateCheckpointTimeEqualsPrevious, true, 'time collision exposes equal checkpoint time');
    equal(collision.receipt.comparison.candidateVerificationTimeEqualsPrevious, true, 'time collision exposes equal verification time');

    const earlierCheckpoint = History.createCheckpoint({ checkpointId: 'v35-checkpoint:earlier', checkpointedAt: Fixture.add(baseCheckpointTime, -1000), serviceOptions: copy(baseOptions) });
    const earlierPackage = packageFor(earlierCheckpoint, 'earlier', authority, 3);
    const timeRollback = transition(recheckpointPackage, earlierPackage, 'time-rollback', 'HOLD_PRESENTED_TIME_ROLLBACK');
    equal(timeRollback.receipt.comparison.candidateCheckpointTimePrecedesPrevious, true, 'time rollback exposes earlier checkpoint time');

    const equivocationCheckpoint = redigestCheckpoint(forkACheckpoint, baseCheckpoint.checkpointId, Fixture.add(forkACheckpointTime, 1000));
    const equivocationPackage = packageFor(equivocationCheckpoint, 'equivocation', authority, 2);
    const equivocation = transition(basePackage, equivocationPackage, 'checkpoint-id-equivocation', 'HOLD_CHECKPOINT_ID_EQUIVOCATION');
    equal(equivocation.receipt.comparison.sameCheckpointId, true, 'equivocation reuses checkpoint id');
    equal(equivocation.receipt.comparison.sameCheckpointDigest, false, 'equivocation changes checkpoint digest');

    const anchorIdentityPackage = packageFor(forkACheckpoint, 'anchor-identity-drift', authority, 2, { anchorId: 'v35-anchor:different' });
    transition(basePackage, anchorIdentityPackage, 'anchor-identity-drift', 'HOLD_ANCHOR_IDENTITY_DRIFT');
    const anchorProfilePackage = packageFor(forkACheckpoint, 'anchor-profile-drift', authority, 2, { maxAuthorizationAgeSeconds: 1199 });
    const anchorProfile = transition(basePackage, anchorProfilePackage, 'anchor-profile-drift', 'HOLD_ANCHOR_POLICY_PROFILE_DRIFT');
    equal(anchorProfile.receipt.comparison.anchorIdentityMatches, true, 'anchor profile drift preserves anchor identity');
    const witnessIdentityPackage = packageFor(forkACheckpoint, 'witness-identity-drift', authority, 2, { witnessPolicyId: 'v35-witness-policy:different' });
    transition(basePackage, witnessIdentityPackage, 'witness-identity-drift', 'HOLD_WITNESS_POLICY_IDENTITY_DRIFT');
    const witnessProfilePackage = packageFor(forkACheckpoint, 'witness-profile-drift', authority, 2, { maxAttestationAgeSeconds: 1199 });
    const witnessProfile = transition(basePackage, witnessProfilePackage, 'witness-profile-drift', 'HOLD_WITNESS_POLICY_PROFILE_DRIFT');
    equal(witnessProfile.receipt.comparison.witnessPolicyIdentityMatches, true, 'witness profile drift preserves policy identity');

    const otherItem = LedgerFixture.outcomeFixture(tempRoot, 'APPROVED', 'v35-other-ledger');
    const otherRoot = makeDir(tempRoot, 'other-ledger');
    const otherOptions = LedgerFixture.serviceOptions(otherRoot, 'v35-other-review-outcome-ledger', baseOptions.createdAt);
    const otherService = Ledger.createService(copy(otherOptions));
    const otherRecordedAt = LedgerFixture.laterThan([baseRecordedAt, otherItem.outcome.observedAt], 1000);
    otherService.capture(LedgerFixture.captureInput(otherItem, 'v35-record:other', otherRecordedAt));
    const otherCheckpoint = History.createCheckpoint({ checkpointId: 'v35-checkpoint:other-ledger', checkpointedAt: Fixture.add(forkACheckpointTime, 1000), serviceOptions: copy(otherOptions) });
    const otherPackage = packageFor(otherCheckpoint, 'other-ledger', authority, 2);
    const ledgerDrift = transition(basePackage, otherPackage, 'ledger-identity-drift', 'HOLD_LEDGER_IDENTITY_DRIFT');
    equal(ledgerDrift.receipt.comparison.ledgerIdentityMatches, false, 'ledger identity drift is explicit');

    const epochRollbackPrevious = packageFor(baseCheckpoint, 'epoch-rollback-previous', authority, 2);
    const epochRollbackCandidate = packageFor(recheckpointValue, 'epoch-rollback-candidate', authority, 1);
    const epochRollback = transition(epochRollbackPrevious, epochRollbackCandidate, 'epoch-rollback', 'HOLD_ANCHOR_EPOCH_ROLLBACK');
    equal(epochRollback.receipt.comparison.anchorEpochDelta, -1, 'epoch rollback reports exact negative delta');
    const epochNotAdvanced = transition(basePackage, packageFor(recheckpointValue, 'epoch-not-advanced', authority, 1), 'epoch-not-advanced', 'HOLD_ANCHOR_EPOCH_NOT_ADVANCED');
    equal(epochNotAdvanced.receipt.comparison.anchorEpochDelta, 0, 'non-advanced epoch reports zero delta');
    const epochGap = transition(basePackage, packageFor(recheckpointValue, 'epoch-gap', authority, 3), 'epoch-gap', 'HOLD_ANCHOR_EPOCH_GAP');
    equal(epochGap.receipt.comparison.anchorEpochDelta, 2, 'epoch gap reports exact delta');

    const snapshotDriftCheckpoint = redigestCheckpoint(recheckpointValue, 'v35-checkpoint:snapshot-drift', Fixture.add(recheckpointTime, 1000), value => {
      value.ledger.snapshotBinding.sha256 = Fixture.principal('synthetic-v35-snapshot-drift');
    });
    const snapshotDriftPackage = packageFor(snapshotDriftCheckpoint, 'snapshot-drift', authority, 2);
    const snapshotDrift = transition(basePackage, snapshotDriftPackage, 'snapshot-drift', 'HOLD_SNAPSHOT_CHANGED_WITHOUT_HISTORY_EXTENSION');
    equal(snapshotDrift.receipt.comparison.sameHistory, true, 'snapshot drift retains identical complete history');
    equal(snapshotDrift.receipt.comparison.sameSnapshotBinding, false, 'snapshot drift changes only the self-valid binding dimension');

    const unchangedSnapshotExtensionCheckpoint = redigestCheckpoint(forkACheckpoint, 'v35-checkpoint:unchanged-snapshot-extension', Fixture.add(forkACheckpointTime, 2000), value => {
      value.ledger.snapshotBinding = copy(baseCheckpoint.ledger.snapshotBinding);
    });
    const unchangedSnapshotExtensionPackage = packageFor(unchangedSnapshotExtensionCheckpoint, 'unchanged-snapshot-extension', authority, 2);
    const unchangedSnapshotExtension = transition(basePackage, unchangedSnapshotExtensionPackage, 'unchanged-snapshot-extension', 'HOLD_HISTORY_EXTENSION_WITHOUT_SNAPSHOT_CHANGE');
    equal(unchangedSnapshotExtension.receipt.comparison.previousHistoryPrefixesCandidate, true, 'unchanged-snapshot case still extends complete ordered history');
    equal(unchangedSnapshotExtension.receipt.comparison.sameSnapshotBinding, true, 'unchanged-snapshot case exposes the stale binding');
    equal(unchangedSnapshotExtension.receipt.truth.historyExtensionWithoutSnapshotChangeObserved, true, 'unchanged snapshot extension truth is explicit');

    const replacementAuthority = Fixture.createAuthority('joint-replacement');
    const replacedPreviousCheckpoint = redigestCheckpoint(baseCheckpoint, 'v35-checkpoint:replaced-previous', Fixture.add(rollbackTime, 60000));
    const replacedCandidateCheckpoint = redigestCheckpoint(forkACheckpoint, 'v35-checkpoint:replaced-candidate', Fixture.add(rollbackTime, 120000));
    const replacedPrevious = packageFor(replacedPreviousCheckpoint, 'replaced-previous', replacementAuthority, 1);
    const replacedCandidate = packageFor(replacedCandidateCheckpoint, 'replaced-candidate', replacementAuthority, 2);
    const jointReplacement = transition(replacedPrevious, replacedCandidate, 'joint-replacement', 'CANDIDATE_EXTENDS_PRESENTED_ANCHORED_HISTORY');
    check(jointReplacement.receipt.previousCheckpointRef.sha256 !== forwardA.receipt.previousCheckpointRef.sha256, 'joint replacement changes the previous checkpoint digest');
    check(jointReplacement.receipt.anchorContinuity.previousProfileDigest !== forwardA.receipt.anchorContinuity.previousProfileDigest, 'joint replacement changes the normalized authority profile');
    equal(jointReplacement.receipt.truth.originalPairContinuityProven, false, 'joint replacement proves no continuity with the original pair');
    equal(jointReplacement.receipt.truth.jointPairReplacementStillPossible, true, 'joint pair replacement limitation is explicit');

    const child = runChild(writePackage(tempRoot, 'fresh-process', { input: forwardA.input }));
    equal(child.status, 0, 'fresh process rebuilds a transition');
    check(child.value.pid !== process.pid, 'fresh rebuild uses a distinct process');
    equal(child.value.result, forwardA.receipt, 'fresh-process transition is exact');
    const badInput = copy(forwardA.input); badInput.candidateAnchoredReceipt.receiptDigest = 'sha256:' + '0'.repeat(64);
    equal(Pairwise.verifyTransition(badInput, forwardA.receipt).pass, false, 'tampered candidate package fails closed');
    const badReceipt = copy(forwardA.receipt); badReceipt.classification = 'PRESENTED_HISTORY_EXACT_RECHECKPOINT';
    equal(Pairwise.verifyTransition(forwardA.input, badReceipt).pass, false, 'tampered transition receipt fails closed');
    const earlyInput = copy(forwardA.input); earlyInput.comparedAt = baseCheckpointTime;
    throws(() => Pairwise.buildTransition(earlyInput), /cannot predate either exact anchored checkpoint verification/, 'comparison time before either verification fails closed');
    const extraInput = copy(forwardA.input); extraInput.unexpected = true;
    throws(() => Pairwise.buildTransition(extraInput), /unknown fields/, 'unknown transition input field fails closed');
    const oversizedReceipt = { schema: Pairwise.RECEIPT_SCHEMA, padding: 'x'.repeat(Pairwise.MAX_RECEIPT_CANONICAL_BYTES + 1) };
    equal(Pairwise.verifyTransition(forwardA.input, oversizedReceipt).pass, false, 'oversized transition receipt fails closed');

    const publicReceipt = JSON.stringify(forwardA.receipt);
    equal(publicReceipt.includes('BEGIN PUBLIC KEY'), false, 'receipt omits raw public keys');
    equal(publicReceipt.includes(forwardA.input.candidateAnchoredInput.policyAuthorizations[0].signature), false, 'receipt omits raw signatures');
    equal(publicReceipt.includes(baseRoot), false, 'receipt omits source and ledger paths');
    equal(publicReceipt.includes(JSON.stringify(forkAItem.outcome)), false, 'receipt omits complete review outcome');
    equal(publicReceipt.includes('PRIVATE KEY'), false, 'receipt omits private keys');
    equal(forwardA.receipt.truth.providerInvoked, false, 'receipt claims no provider invocation');
    equal(forwardA.receipt.truth.experimentExecuted, false, 'receipt claims no experiment execution');
    equal(forwardA.receipt.truth.evaluationPerformed, false, 'receipt claims no evaluation');
    equal(forwardA.receipt.truth.humanBenefitProven, false, 'receipt claims no human benefit');
    equal(forwardA.receipt.truth.automaticCanon, false, 'receipt claims no automatic CANON');
    equal(forwardA.receipt.truth.anchorEpochExternallyMonotonicProven, false, 'caller epoch claims no external monotonicity');
    equal(forwardA.receipt.truth.globalTransitionUniquenessProven, false, 'pairwise result claims no global uniqueness');

    const schema = JSON.parse(fs.readFileSync(path.join(__dirname, 'transition.schema.json'), 'utf8'));
    equal(schema.$schema, 'https://json-schema.org/draft/2020-12/schema', 'schema declares Draft 2020-12');
    equal(schema.additionalProperties, false, 'schema closes unknown top-level fields');
    equal(schema.properties.classification.enum, Pairwise.CLASSIFICATIONS, 'schema classification enum matches runtime exactly');
    equal(everyObjectClosed(schema), true, 'every object shape in the transition schema is closed');
    assertClosedShape(forwardA.receipt, schema, schema, 'transition');
    check(true, 'forward receipt matches every required closed schema object shape');
    const contract = JSON.parse(fs.readFileSync(path.join(__dirname, 'module.contract.json'), 'utf8'));
    equal(ContractVerifier.validateContract(contract), { pass: true, errors: [] }, 'module contract passes repository verifier');
    equal(contract.version, 'v3.5', 'contract version is exact');
    equal(contract.status, 'TEST', 'contract remains TEST');
    equal(contract.lifecycle.installed, false, 'module remains uninstalled');
    equal(contract.lifecycle.promoted, false, 'module remains unpromoted');
    equal(contract.merge_gate, 'Mike Tobi / AXM', 'Mike Tobi remains merge gate');
    equal(contract.provides.length, 24, 'contract exposes twenty-four bounded handoffs');
    equal(Array.from(observedClassifications).sort(), Pairwise.CLASSIFICATIONS.slice().sort(), 'focused suite observes every closed classification');

    const implementation = fs.readFileSync(path.join(__dirname, 'model-shadow-retention-audit-review-outcome-history-checkpoint-anchor-pairwise.js'), 'utf8');
    check(implementation.includes("require('../model-shadow-retention-audit-review-outcome-history-checkpoint-anchor/"), 'runtime composes the exact v3.4 anchor module');
    check(implementation.includes("require('../model-shadow-retention-audit-review-outcome-history-checkpoint/"), 'runtime composes the exact v3.3 checkpoint module');
    equal(implementation.includes("require('fs')"), false, 'runtime imports no filesystem');
    equal(implementation.includes('writeFile'), false, 'runtime contains no file-write operation');
    equal(implementation.includes('fetch('), false, 'runtime contains no network fetch');
    equal(implementation.includes('crypto.sign'), false, 'runtime performs no signing');
    equal(implementation.includes('generateKeyPair'), false, 'runtime generates no key pair');
    equal(implementation.includes('createPrivateKey'), false, 'runtime ingests no private key API');

    console.log('RESULT ' + checks + ' focused assertions passed');
  } finally {
    verifiedRemove(tempRoot, os.tmpdir());
  }
}

main();
