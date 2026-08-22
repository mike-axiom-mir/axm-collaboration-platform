#!/usr/bin/env node
'use strict';

const assert = require('assert');
const childProcess = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const TransitionGate = require('./model-shadow-review-challenge-transition-gate');
const Continuity = require('../model-shadow-review-challenge-continuity/model-shadow-review-challenge-continuity');
const Ledger = require('../model-shadow-review-challenge-ledger/model-shadow-review-challenge-ledger');
const LedgerFixture = require('../model-shadow-review-challenge-ledger/selftest-fixture');
const Fixture = require('./selftest-fixture');

let checks = 0;
function check(value, label) { assert.ok(value, label); checks += 1; console.log('PASS ' + label); }
function equal(actual, expected, label) { assert.strictEqual(actual, expected); checks += 1; console.log('PASS ' + label); }
function throws(fn, pattern, label) { assert.throws(fn, pattern); checks += 1; console.log('PASS ' + label); }
function copy(value) { return JSON.parse(JSON.stringify(value)); }

function snapshot(root, ledgerId, tag, observedAt) {
  return Continuity.captureState({ stateRoot: root, ledgerId, observationId: 'observation:transition-' + tag, observedAt });
}

function checkpoint(currentSnapshot, checkpointId, anchoredAt) {
  return Continuity.buildCheckpoint({ checkpointId, anchoredAt, currentSnapshot });
}

function redigestCheckpoint(value) {
  const result = copy(value);
  result.entries.sort((left, right) => left.challengeDigest.localeCompare(right.challengeDigest));
  result.entryCount = result.entries.length;
  result.entriesDigest = Continuity.sha256(result.entries);
  result.checkpointDigest = null;
  const payload = copy(result);
  delete payload.checkpointDigest;
  result.checkpointDigest = Continuity.sha256(payload);
  return result;
}

function runChild(packagePath) {
  const result = childProcess.spawnSync(process.execPath, [path.join(__dirname, 'selftest-child.js'), packagePath], {
    encoding: 'utf8',
    windowsHide: true
  });
  const lines = String(result.stdout || '').trim().split(/\r?\n/).filter(Boolean);
  return { status: result.status, output: lines.length ? JSON.parse(lines[lines.length - 1]) : null, stderr: result.stderr };
}

function verifiedRemove(target, parent) {
  const resolvedTarget = path.resolve(target);
  const resolvedParent = path.resolve(parent);
  if (resolvedTarget === resolvedParent || !resolvedTarget.startsWith(resolvedParent + path.sep)) {
    throw new Error('temporary deletion target escapes selftest root');
  }
  fs.rmSync(resolvedTarget, { recursive: true, force: true });
}

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'axm-challenge-transition-gate-'));
try {
  const roots = {
    base: path.join(tempRoot, 'base'),
    forkA: path.join(tempRoot, 'fork-a'),
    forkB: path.join(tempRoot, 'fork-b'),
    other: path.join(tempRoot, 'other')
  };
  Object.values(roots).forEach(root => fs.mkdirSync(root));
  const ledgerId = 'ledger:transition-gate-selftest';
  const baseRequest = LedgerFixture.buildRequest('transition-common-base');
  const forkARequest = LedgerFixture.buildRequest('transition-fork-a');
  const forkBRequest = LedgerFixture.buildRequest('transition-fork-b');
  const baseService = Ledger.createService({ stateRoot: roots.base, ledgerId });
  const forkAService = Ledger.createService({ stateRoot: roots.forkA, ledgerId });
  const forkBService = Ledger.createService({ stateRoot: roots.forkB, ledgerId });
  const baseReceipt = baseService.consume(copy(baseRequest));
  forkAService.consume(copy(baseRequest));
  const forkAReceipt = forkAService.consume(copy(forkARequest));
  forkBService.consume(copy(baseRequest));
  const forkBReceipt = forkBService.consume(copy(forkBRequest));

  const baseSnapshot = snapshot(roots.base, ledgerId, 'base', '2026-08-20T14:07:00.000Z');
  const forkASnapshot = snapshot(roots.forkA, ledgerId, 'fork-a', '2026-08-20T14:12:00.000Z');
  const forkBSnapshot = snapshot(roots.forkB, ledgerId, 'fork-b', '2026-08-20T14:13:00.000Z');
  const baseCheckpoint = checkpoint(baseSnapshot, 'checkpoint:transition-base', '2026-08-20T14:07:30.000Z');
  const forkACheckpoint = checkpoint(forkASnapshot, 'checkpoint:transition-fork-a', '2026-08-20T14:12:30.000Z');
  const forkBCheckpoint = checkpoint(forkBSnapshot, 'checkpoint:transition-fork-b', '2026-08-20T14:13:30.000Z');
  const authority = Fixture.createAuthority('stable');
  const baseChain = Fixture.buildSeparatedChain(baseCheckpoint, 'base', authority, { minute: 8 });
  const forkAChain = Fixture.buildSeparatedChain(forkACheckpoint, 'fork-a', authority, { minute: 13 });
  const forkBChain = Fixture.buildSeparatedChain(forkBCheckpoint, 'fork-b', authority, { minute: 14 });

  const replayInput = Fixture.transitionInput(baseChain, baseChain, 'exact-replay');
  const replay = TransitionGate.buildTransition(replayInput);
  equal(TransitionGate.VERSION, '0.7.0', 'module version is exact');
  equal(TransitionGate.STATUS, 'TEST', 'module status is TEST');
  equal(replay.schema, TransitionGate.RECEIPT_SCHEMA, 'transition receipt schema identity is exact');
  equal(replay.decision.classification, 'PRESENTED_CHAIN_EXACT_REPLAY', 'exact presented chain is classified as replay');
  equal(replay.decision.pairwiseConsistency, 'CONSISTENT_REPLAY', 'exact replay is pairwise consistent');
  equal(replay.decision.forwardTransitionAdmissible, false, 'exact replay is not promoted to forward transition');
  equal(replay.decision.reviewRequired, false, 'exact replay requires no contradiction review');
  equal(replay.decision.autonomousActionCount, 0, 'exact replay triggers no autonomous action');
  equal(replay.truth.exactPresentedReplayObserved, true, 'exact replay truth is explicit');
  equal(replay.truth.forwardExtensionObserved, false, 'exact replay is not marked as extension');
  equal(replay.truth.pairwiseComparisonOnly, true, 'pairwise scope is explicit');
  equal(replay.truth.withheldForksExcluded, false, 'exact replay does not exclude withheld forks');
  equal(replay.truth.globalTransitionUniquenessProven, false, 'exact replay does not prove global uniqueness');
  check(TransitionGate.verifyTransition(replayInput, replay).pass, 'exact replay receipt verifies by exact rebuild');

  const extensionInput = Fixture.transitionInput(baseChain, forkAChain, 'base-to-fork-a');
  const extension = TransitionGate.buildTransition(extensionInput);
  equal(extension.decision.classification, 'CANDIDATE_EXTENDS_PRESENTED_CHAIN', 'candidate with one new challenge is a forward extension');
  equal(extension.decision.pairwiseConsistency, 'CONSISTENT_EXTENSION', 'forward extension is pairwise consistent');
  equal(extension.decision.forwardTransitionAdmissible, true, 'forward extension is pairwise admissible');
  equal(extension.decision.reviewRequired, false, 'forward extension contains no pairwise contradiction');
  equal(extension.comparison.addedCandidateChallenges.length, 1, 'forward extension contains one exact added challenge');
  equal(extension.comparison.addedCandidateChallenges[0], forkAReceipt.challengeRef.sha256, 'forward extension binds the exact added challenge');
  equal(extension.comparison.missingPreviousChallenges.length, 0, 'forward extension removes no prior challenge');
  equal(extension.comparison.replacedPreviousEntries.length, 0, 'forward extension replaces no prior entry');
  equal(extension.truth.forwardExtensionObserved, true, 'forward extension truth is explicit');
  equal(extension.truth.anchorEpochMonotonicityProven, false, 'same presented epoch is not promoted to monotonic state');
  equal(extension.truth.executionAuthorized, false, 'pairwise extension grants no execution authority');
  equal(extension.truth.adoptionAuthorized, false, 'pairwise extension grants no adoption authority');
  equal(extension.truth.automaticCanon, false, 'pairwise extension grants no CANON authority');
  check(TransitionGate.verifyTransition(extensionInput, extension).pass, 'forward extension receipt verifies by exact rebuild');
  equal(
    TransitionGate.stableStringify(TransitionGate.buildTransition(copy(extensionInput))),
    TransitionGate.stableStringify(extension),
    'transition rebuild is deterministic from copied input'
  );

  const forkBInput = Fixture.transitionInput(baseChain, forkBChain, 'base-to-fork-b');
  const forkBTransition = TransitionGate.buildTransition(forkBInput);
  equal(forkBTransition.decision.classification, 'CANDIDATE_EXTENDS_PRESENTED_CHAIN', 'second fork independently extends the same prior chain');
  equal(forkBTransition.decision.forwardTransitionAdmissible, true, 'second fork is independently pairwise admissible');
  equal(forkBTransition.truth.withheldForksExcluded, false, 'independently valid fork does not exclude another branch');

  const coPresentedForkInput = Fixture.transitionInput(forkAChain, forkBChain, 'fork-a-to-fork-b');
  const coPresentedFork = TransitionGate.buildTransition(coPresentedForkInput);
  equal(coPresentedFork.decision.classification, 'HOLD_CANDIDATE_REMOVES_OR_REPLACES_PRIOR_ENTRIES', 'co-presented divergent forks are held');
  equal(coPresentedFork.decision.pairwiseConsistency, 'CONTRADICTION', 'co-presented forks are pairwise contradictory');
  equal(coPresentedFork.decision.forwardTransitionAdmissible, false, 'co-presented fork is not forward-admissible');
  equal(coPresentedFork.decision.reviewRequired, true, 'co-presented fork requires review');
  equal(coPresentedFork.comparison.missingPreviousChallenges[0], forkAReceipt.challengeRef.sha256, 'fork comparison identifies the omitted prior-branch challenge');
  equal(coPresentedFork.comparison.addedCandidateChallenges[0], forkBReceipt.challengeRef.sha256, 'fork comparison identifies the candidate-branch challenge');
  equal(coPresentedFork.truth.priorEntryRemovalOrReplacementDetected, true, 'fork entry contradiction truth is explicit');
  equal(coPresentedFork.truth.withheldForksExcluded, false, 'co-presented detection still cannot exclude another withheld fork');

  const alternateAuthority = Fixture.createAuthority('alternate-same-epoch', { anchorId: authority.anchorPolicy.anchorId, anchorEpoch: 1 });
  const alternateAnchorChain = Fixture.buildSeparatedChain(forkACheckpoint, 'alternate-anchor', alternateAuthority, { minute: 13 });
  const anchorEquivocation = TransitionGate.buildTransition(Fixture.transitionInput(baseChain, alternateAnchorChain, 'anchor-equivocation'));
  equal(anchorEquivocation.decision.classification, 'HOLD_ANCHOR_EQUIVOCATION_AT_SELF_DECLARED_EPOCH', 'different anchor digest at same presented epoch is held');
  equal(anchorEquivocation.truth.sameEpochAnchorEquivocationObserved, true, 'same-epoch anchor equivocation truth is explicit');

  const epochTwoAuthority = Fixture.createAuthority('epoch-two', {
    anchorId: authority.anchorPolicy.anchorId,
    anchorEpoch: 2,
    witnessPairs: authority.witnessPairs,
    actorDigests: authority.actorDigests,
    anchorPairs: authority.anchorPairs,
    stewardDigests: authority.stewardDigests
  });
  const epochTwoForkA = Fixture.buildSeparatedChain(forkACheckpoint, 'epoch-two-fork-a', epochTwoAuthority, { minute: 13 });
  const epochAdvance = TransitionGate.buildTransition(Fixture.transitionInput(baseChain, epochTwoForkA, 'epoch-advance'));
  equal(epochAdvance.decision.classification, 'CANDIDATE_EXTENDS_PRESENTED_CHAIN', 'higher self-declared epoch can accompany valid forward extension');
  equal(epochAdvance.anchorTransition.relation, 'ADVANCED_SELF_DECLARED', 'higher epoch remains labelled self-declared');
  equal(epochAdvance.truth.anchorEpochMonotonicityProven, false, 'higher presented epoch is not promoted to protected monotonicity');

  const epochTwoBase = Fixture.buildSeparatedChain(baseCheckpoint, 'epoch-two-base', epochTwoAuthority, { minute: 8 });
  const epochRollback = TransitionGate.buildTransition(Fixture.transitionInput(epochTwoBase, forkAChain, 'epoch-rollback'));
  equal(epochRollback.decision.classification, 'HOLD_SELF_DECLARED_ANCHOR_EPOCH_ROLLBACK', 'lower candidate self-declared epoch is held');
  equal(epochRollback.anchorTransition.relation, 'ROLLBACK_SELF_DECLARED', 'epoch rollback relation is explicit');
  equal(epochRollback.truth.anchorEpochRollbackObserved, true, 'epoch rollback truth is explicit');

  const differentAnchorAuthority = Fixture.createAuthority('different-anchor-id', { anchorId: 'anchor:transition-gate-different' });
  const differentAnchorChain = Fixture.buildSeparatedChain(forkACheckpoint, 'different-anchor-id', differentAnchorAuthority, { minute: 13 });
  const anchorIdentityDrift = TransitionGate.buildTransition(Fixture.transitionInput(baseChain, differentAnchorChain, 'anchor-identity-drift'));
  equal(anchorIdentityDrift.decision.classification, 'HOLD_ANCHOR_IDENTITY_DRIFT', 'different anchor identity is held');
  equal(anchorIdentityDrift.truth.pairwiseAnchorIdentityMatches, false, 'anchor identity drift truth is explicit');

  const otherLedgerId = 'ledger:transition-gate-other';
  const otherService = Ledger.createService({ stateRoot: roots.other, ledgerId: otherLedgerId });
  otherService.consume(LedgerFixture.buildRequest('transition-other-base'));
  const otherSnapshot = snapshot(roots.other, otherLedgerId, 'other', '2026-08-20T14:12:00.000Z');
  const otherCheckpoint = checkpoint(otherSnapshot, 'checkpoint:transition-other', '2026-08-20T14:12:30.000Z');
  const otherChain = Fixture.buildSeparatedChain(otherCheckpoint, 'other-ledger', authority, { minute: 13 });
  const ledgerDrift = TransitionGate.buildTransition(Fixture.transitionInput(baseChain, otherChain, 'ledger-drift'));
  equal(ledgerDrift.decision.classification, 'HOLD_LEDGER_IDENTITY_DRIFT', 'different ledger identity is held');
  equal(ledgerDrift.truth.pairwiseLedgerIdentityMatches, false, 'ledger identity drift truth is explicit');

  const timeRollback = TransitionGate.buildTransition(Fixture.transitionInput(forkAChain, baseChain, 'time-rollback'));
  equal(timeRollback.decision.classification, 'HOLD_PRESENTED_TIME_ROLLBACK', 'earlier candidate verification or checkpoint time is held');
  equal(timeRollback.comparison.candidateVerificationTimePrecedesPrevious, true, 'candidate verification-time rollback is explicit');
  equal(timeRollback.comparison.candidateCheckpointTimePrecedesPrevious, true, 'candidate checkpoint-time rollback is explicit');

  const reusedCheckpointId = checkpoint(forkASnapshot, baseCheckpoint.checkpointId, '2026-08-20T14:12:30.000Z');
  const reusedCheckpointIdChain = Fixture.buildSeparatedChain(reusedCheckpointId, 'reused-checkpoint-id', authority, { minute: 13 });
  const checkpointEquivocation = TransitionGate.buildTransition(Fixture.transitionInput(baseChain, reusedCheckpointIdChain, 'checkpoint-equivocation'));
  equal(checkpointEquivocation.decision.classification, 'HOLD_CHECKPOINT_ID_EQUIVOCATION', 'same checkpoint id with different digest is held');
  equal(checkpointEquivocation.truth.checkpointIdEquivocationObserved, true, 'checkpoint-id equivocation truth is explicit');

  const alternateSameCheckpoint = Fixture.buildSeparatedChain(baseCheckpoint, 'alternate-same-checkpoint', authority, { minute: 9 });
  const alternateSameCheckpointReceipt = TransitionGate.buildTransition(Fixture.transitionInput(baseChain, alternateSameCheckpoint, 'alternate-same-checkpoint'));
  equal(alternateSameCheckpointReceipt.decision.classification, 'HOLD_ALTERNATE_SEPARATED_CHAIN_FOR_SAME_CHECKPOINT', 'different separated chain for exact checkpoint is held');
  equal(alternateSameCheckpointReceipt.comparison.sameCheckpointDigest, true, 'same exact checkpoint digest is explicit');
  equal(alternateSameCheckpointReceipt.comparison.sameSeparatedReceiptDigest, false, 'different separated receipt digest is explicit');

  const sameTimeMetadataCheckpoint = checkpoint(baseSnapshot, 'checkpoint:transition-same-time-metadata', baseCheckpoint.anchoredAt);
  const sameTimeMetadataChain = Fixture.buildSeparatedChain(sameTimeMetadataCheckpoint, 'same-time-metadata', authority, { minute: 9 });
  const timeCollision = TransitionGate.buildTransition(Fixture.transitionInput(baseChain, sameTimeMetadataChain, 'time-collision'));
  equal(timeCollision.decision.classification, 'HOLD_CHECKPOINT_TIME_COLLISION', 'different checkpoint at same presented time is held');

  const laterMetadataCheckpoint = checkpoint(baseSnapshot, 'checkpoint:transition-later-metadata', '2026-08-20T14:11:30.000Z');
  const laterMetadataChain = Fixture.buildSeparatedChain(laterMetadataCheckpoint, 'later-metadata', authority, { minute: 12 });
  const metadataOnly = TransitionGate.buildTransition(Fixture.transitionInput(baseChain, laterMetadataChain, 'metadata-only'));
  equal(metadataOnly.decision.classification, 'HOLD_CHECKPOINT_CHANGED_WITHOUT_LEDGER_EXTENSION', 'checkpoint metadata change without ledger extension is held');
  equal(metadataOnly.comparison.addedCandidateChallenges.length, 0, 'metadata-only checkpoint adds no challenge');

  const replacedCheckpoint = copy(forkACheckpoint);
  const baseIndex = replacedCheckpoint.entries.findIndex(entry => entry.challengeDigest === baseReceipt.challengeRef.sha256);
  replacedCheckpoint.entries[baseIndex].consumptionReceiptDigest = Continuity.sha256('synthetic-replacement-receipt');
  const exactReplacedCheckpoint = redigestCheckpoint(replacedCheckpoint);
  check(Continuity.verifyCheckpoint(exactReplacedCheckpoint).pass, 'synthetic replaced-entry checkpoint is structurally exact');
  const replacedChain = Fixture.buildSeparatedChain(exactReplacedCheckpoint, 'replaced-entry', authority, { minute: 13 });
  const replacedTransition = TransitionGate.buildTransition(Fixture.transitionInput(baseChain, replacedChain, 'replaced-entry'));
  equal(replacedTransition.decision.classification, 'HOLD_CANDIDATE_REMOVES_OR_REPLACES_PRIOR_ENTRIES', 'candidate replacing prior entry is held');
  equal(replacedTransition.comparison.replacedPreviousEntries.length, 1, 'replaced entry is retained as exact pairwise evidence');
  equal(replacedTransition.comparison.replacedPreviousEntries[0].challengeDigest, baseReceipt.challengeRef.sha256, 'replacement evidence identifies exact prior challenge');

  const earlyComparison = copy(extensionInput);
  earlyComparison.comparedAt = '2026-08-20T14:14:00.000Z';
  throws(() => TransitionGate.buildTransition(earlyComparison), /cannot predate either separated chain/, 'comparison cannot predate either presented chain');

  const unknownField = copy(extensionInput);
  unknownField.globalForkFree = true;
  throws(() => TransitionGate.buildTransition(unknownField), /unknown fields: globalForkFree/, 'undeclared global-fork claim is refused');

  const invalidPrevious = copy(extensionInput);
  invalidPrevious.previousSeparationReceipt.truth.realWorldControllerIndependenceProven = true;
  throws(() => TransitionGate.buildTransition(invalidPrevious), /previous separated chain is invalid/, 'tampered previous separated chain is refused');

  const invalidCandidate = copy(extensionInput);
  invalidCandidate.candidateSeparationReceipt.truth.crossLayerCollusionExcluded = true;
  throws(() => TransitionGate.buildTransition(invalidCandidate), /candidate separated chain is invalid/, 'tampered candidate separated chain is refused');

  const authorityTamper = copy(extension);
  authorityTamper.truth.globalTransitionUniquenessProven = true;
  authorityTamper.receiptDigest = TransitionGate.sha256((() => {
    const value = copy(authorityTamper);
    delete value.receiptDigest;
    return value;
  })());
  equal(TransitionGate.verifyTransition(extensionInput, authorityTamper).pass, false, 'global-uniqueness tamper fails even with recomputed digest');

  const packagePath = path.join(tempRoot, 'caller-retained-pairwise-transition-package.json');
  fs.writeFileSync(packagePath, TransitionGate.stableStringify({ transitionInput: extensionInput, transitionReceipt: extension }) + '\n', {
    encoding: 'utf8',
    mode: 0o600
  });
  const child = runChild(packagePath);
  equal(child.status, 0, 'fresh process rebuilds serialized pairwise transition package');
  equal(child.output.rebuilt.receiptDigest, extension.receiptDigest, 'fresh process rebuilds exact transition digest');
  equal(child.output.verification.pass, true, 'fresh process verifies committed transition receipt shape');
  equal(child.output.rebuilt.truth.externalTransitionRetentionProven, false, 'fresh reload does not claim external retention');
  equal(child.output.rebuilt.truth.withheldForksExcluded, false, 'fresh reload preserves withheld-fork boundary');

  const serialized = TransitionGate.stableStringify(extension);
  check(!serialized.includes('BEGIN PUBLIC KEY'), 'transition receipt retains no raw public key');
  check(!serialized.includes(extensionInput.candidateSeparationInput.anchoredWitnessInput.policyAuthorizations[0].signature), 'transition receipt retains no raw signature');
  check(!serialized.includes(tempRoot), 'transition receipt retains no machine state-root path');
  check(!serialized.includes('transition-anchor-key-stable-1'), 'transition receipt retains no raw key id');
  check(!serialized.includes(authority.stewardDigests[0]), 'transition receipt retains no individual principal digest');

  const schema = JSON.parse(fs.readFileSync(path.join(__dirname, 'model-shadow-review-challenge-pairwise-transition.schema.json'), 'utf8'));
  const contract = JSON.parse(fs.readFileSync(path.join(__dirname, 'module.contract.json'), 'utf8'));
  const implementation = fs.readFileSync(path.join(__dirname, 'model-shadow-review-challenge-transition-gate.js'), 'utf8');
  const readme = fs.readFileSync(path.join(__dirname, 'README.md'), 'utf8');
  equal(schema.$id, TransitionGate.RECEIPT_SCHEMA, 'transition schema identity matches implementation');
  check(contract.status === 'TEST' && contract.permissions.length === 0 && contract.boundaries.reads.length === 0 && contract.boundaries.writes.length === 0, 'module remains permissionless read-only TEST with no direct I/O');
  check(contract.lifecycle.installed === false && contract.lifecycle.promoted === false, 'module remains uninstalled and unpromoted');
  check(contract.boundaries.refuses.includes('pairwise-comparison-as-global-fork-exclusion'), 'contract refuses pairwise comparison as global fork exclusion');
  check(contract.boundaries.refuses.includes('pairwise-comparison-as-observation-of-withheld-branches'), 'contract refuses observation of withheld branches');
  check(contract.boundaries.refuses.includes('self-declared-anchor-epoch-as-protected-monotonic-state'), 'contract refuses self-declared epoch as monotonic state');
  check(contract.boundaries.refuses.includes('transition-receipt-as-execution-authority'), 'contract refuses transition receipt as execution authority');
  check(/Two\s+different candidates can each/.test(readme) && /withheld or never-presented branch/.test(readme), 'README preserves independently valid forks and withheld-branch boundary');
  check(!implementation.includes("require('fs')") && !implementation.includes("require('child_process')"), 'runtime implementation imports no filesystem or process capability');
  check(!implementation.includes('writeFileSync') && !implementation.includes('mkdirSync') && !implementation.includes('rmSync') && !implementation.includes('unlinkSync'), 'runtime implementation contains no filesystem write route');
  check(!implementation.includes('fetch('), 'runtime implementation contains no network route');

  console.log('\nModel Shadow review challenge transition gate selftest: PASS (' + checks + ' checks)');
} finally {
  verifiedRemove(tempRoot, path.dirname(tempRoot));
}
