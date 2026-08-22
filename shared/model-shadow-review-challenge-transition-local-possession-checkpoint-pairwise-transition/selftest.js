#!/usr/bin/env node
'use strict';

const assert = require('assert');
const childProcess = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Possession = require('../model-shadow-review-challenge-transition-local-possession-challenge/model-shadow-review-challenge-transition-local-possession-challenge');
const Continuity = require('../model-shadow-review-challenge-transition-local-possession-continuity/model-shadow-review-challenge-transition-local-possession-continuity');
const StateFixture = require('../model-shadow-review-challenge-transition-local-possession-continuity/selftest-fixture');
const Separation = require('../model-shadow-review-challenge-transition-local-possession-checkpoint-separation/model-shadow-review-challenge-transition-local-possession-checkpoint-separation');
const OldTransition = require('../model-shadow-review-challenge-transition-gate/model-shadow-review-challenge-transition-gate');
const Transition = require('./model-shadow-review-challenge-transition-local-possession-checkpoint-pairwise-transition');
const Fixture = require('./selftest-fixture');

let checks = 0;
function check(value, label) { assert.ok(value, label); checks += 1; console.log('PASS ' + label); }
function equal(actual, expected, label) { assert.deepStrictEqual(actual, expected, label); checks += 1; console.log('PASS ' + label); }
function throws(fn, pattern, label) {
  let caught = null;
  try { fn(); } catch (error) { caught = error; }
  assert.ok(caught, label + ' should throw');
  assert.match(String(caught && caught.message), pattern, label + ' message');
  checks += 2;
  console.log('PASS ' + label);
}
function copy(value) { return Fixture.copy(value); }

function checkpoint(snapshot, checkpointId, anchoredAt) {
  return Continuity.buildCheckpoint({ checkpointId, anchoredAt, currentSnapshot: copy(snapshot) });
}

function redigestCheckpoint(value) {
  const result = copy(value);
  result.entries.sort((left, right) => left.challengeRef.sha256.localeCompare(right.challengeRef.sha256));
  result.entryCount = result.entries.length;
  result.entriesDigest = Continuity.sha256(result.entries);
  result.checkpointDigest = null;
  const payload = copy(result);
  delete payload.checkpointDigest;
  result.checkpointDigest = Continuity.sha256(payload);
  return result;
}

function derivedSnapshot(source, id, observedAt, overrides) {
  const settings = overrides || {};
  return Continuity.buildSnapshot({
    observationId: id,
    observedAt,
    availability: 'AVAILABLE',
    receiverIdDigest: settings.receiverIdDigest || source.receiverIdDigest,
    challengerIdDigest: settings.challengerIdDigest || source.challengerIdDigest,
    receiverPolicyRef: copy(settings.receiverPolicyRef || source.receiverPolicyRef),
    entries: copy(settings.entries || source.entries),
    errors: []
  });
}

function runChild(packagePath) {
  const result = childProcess.spawnSync(process.execPath, [path.join(__dirname, 'selftest-child.js'), packagePath], {
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
    windowsHide: true
  });
  if (result.status !== 0) throw new Error('child failed: ' + result.stderr + result.stdout);
  return JSON.parse(result.stdout);
}

function redigestReceipt(value) {
  const result = copy(value);
  result.receiptDigest = null;
  const payload = copy(result);
  delete payload.receiptDigest;
  result.receiptDigest = Transition.sha256(payload);
  return result;
}

function verifiedRemove(target, parent) {
  const resolvedTarget = path.resolve(target);
  const resolvedParent = path.resolve(parent);
  if (resolvedTarget === resolvedParent || !resolvedTarget.startsWith(resolvedParent + path.sep)) {
    throw new Error('temporary deletion target escapes selftest root');
  }
  fs.rmSync(resolvedTarget, { recursive: true, force: true });
}

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'axm-local-possession-checkpoint-pairwise-transition-'));
let cleanupVerified = false;

try {
  const state = StateFixture.buildFixture(tempRoot);
  const answersDir = path.join(
    state.possession.receiverOptions.stateRoot,
    Possession.NAMESPACE,
    Possession.ANSWERS_DIRECTORY
  );

  equal(Transition.VERSION, '1.8.0', 'module version is exact');
  equal(Transition.STATUS, 'TEST', 'module status remains TEST');
  equal(Transition.MAX_ARTIFACT_CANONICAL_BYTES, 524288, 'artifact byte bound is exact');
  equal(
    Transition.NEXT_GATE,
    'HOST_AUTHENTICATED_EXTERNALLY_RETAINED_GLOBALLY_CONSISTENT_LOCAL_POSSESSION_TRANSITION_LOG_OR_PROTECTED_MONOTONIC_STORE',
    'next gate is exact'
  );

  const baseSnapshot = Continuity.captureState(copy(state.continuityOptions));
  const baseCheckpoint = checkpoint(baseSnapshot, 'local-possession-checkpoint:pairwise-base', '2026-08-20T15:22:30.000Z');
  const authority = Fixture.createAuthority('stable');
  const baseChain = Fixture.buildSeparatedChain(baseCheckpoint, 'base', authority, { minute: 23 });
  equal(Separation.verifySeparatedWitness(baseChain.separationInput, baseChain.separationReceipt).pass, true, 'base v1.7 separated chain exact-verifies');

  const oldInput = Fixture.transitionInput(baseChain, baseChain, 'old-contract-rejection');
  throws(
    () => OldTransition.buildTransition(copy(oldInput)),
    /previous separated chain is invalid|anchored witness is invalid|receipt schema mismatch/,
    'older ledger pairwise gate cannot consume the v1.7 possession chain'
  );

  const replayInput = Fixture.transitionInput(baseChain, baseChain, 'exact-replay');
  const replay = Transition.buildTransition(replayInput);
  equal(replay.schema, Transition.RECEIPT_SCHEMA, 'transition receipt schema is exact');
  equal(replay.version, '1.8.0', 'transition receipt version is exact');
  equal(replay.status, 'TEST', 'transition receipt remains TEST');
  equal(replay.decision.classification, 'PRESENTED_POSSESSION_CHAIN_EXACT_REPLAY', 'exact chain is classified as replay');
  equal(replay.decision.pairwiseConsistency, 'CONSISTENT_REPLAY', 'exact replay is pairwise consistent');
  equal(replay.decision.forwardTransitionAdmissible, false, 'exact replay is not a forward transition');
  equal(replay.decision.reviewRequired, false, 'exact replay creates no contradiction review');
  equal(replay.decision.autonomousActionCount, 0, 'exact replay triggers no autonomous action');
  equal(replay.truth.exactPresentedReplayObserved, true, 'exact replay truth is explicit');
  equal(replay.truth.forwardExtensionObserved, false, 'exact replay is not marked as extension');
  equal(replay.truth.pairwiseComparisonOnly, true, 'pairwise scope is explicit');
  equal(replay.truth.sourceSnapshotsPresentedByReferenceOnly, true, 'source snapshots remain reference-only');
  equal(replay.truth.sourceStateRecapturedByThisModule, false, 'pairwise adapter performs no source-state recapture');
  equal(replay.truth.presentedCheckpointSourceTruthIndependentlyProven, false, 'presented checkpoint source truth remains unproven');
  equal(replay.truth.withheldForksExcluded, false, 'exact replay excludes no withheld fork');
  equal(replay.truth.globalTransitionUniquenessProven, false, 'exact replay proves no global uniqueness');
  equal(Transition.verifyTransition(replayInput, replay).pass, true, 'exact replay receipt exact-verifies');
  equal(Transition.buildTransition(copy(replayInput)), replay, 'exact replay deterministically rebuilds');

  const forkAChallenge = StateFixture.issueChallenge(state, 0x42);
  const forkAResponse = StateFixture.answer(state, forkAChallenge, '2026-08-20T15:26:00.000Z');
  const forkAPath = path.join(answersDir, forkAResponse.responseFileName);
  const forkASnapshot = Continuity.captureState(StateFixture.observationOptions(state, 'local-possession-observation:pairwise-fork-a', '2026-08-20T15:27:00.000Z'));
  const forkACheckpoint = checkpoint(forkASnapshot, 'local-possession-checkpoint:pairwise-fork-a', '2026-08-20T15:27:30.000Z');
  const forkAChain = Fixture.buildSeparatedChain(forkACheckpoint, 'fork-a', authority, { minute: 28 });
  const extensionInput = Fixture.transitionInput(baseChain, forkAChain, 'base-to-fork-a');
  const extension = Transition.buildTransition(extensionInput);
  equal(extension.decision.classification, 'CANDIDATE_EXTENDS_PRESENTED_POSSESSION_CHAIN', 'candidate with one new response is a forward extension');
  equal(extension.decision.pairwiseConsistency, 'CONSISTENT_EXTENSION', 'response extension is pairwise consistent');
  equal(extension.decision.forwardTransitionAdmissible, true, 'response extension is pairwise admissible');
  equal(extension.decision.reviewRequired, false, 'response extension contains no pairwise contradiction');
  equal(extension.comparison.addedCandidateChallenges.length, 1, 'response extension contains one added challenge');
  equal(extension.comparison.addedCandidateChallenges[0], forkAChallenge.challengeDigest, 'response extension binds exact added challenge');
  equal(extension.comparison.missingPreviousChallenges.length, 0, 'response extension removes no prior challenge');
  equal(extension.comparison.replacedPreviousResponses.length, 0, 'response extension replaces no prior response');
  equal(extension.comparison.witnessPolicyIdentityMatches, true, 'extension preserves witness-policy identity');
  equal(extension.comparison.sameWitnessPolicyDigest, false, 'checkpoint-bound witness-policy digest changes for extension');
  equal(extension.truth.witnessPolicyDigestChangedForCandidate, true, 'expected witness-policy digest change is explicit');
  equal(extension.truth.forwardExtensionObserved, true, 'forward response extension truth is explicit');
  equal(extension.truth.anchorEpochMonotonicityProven, false, 'same presented epoch is not protected monotonic state');
  equal(extension.truth.keyCustodyIndependenceProven, false, 'pairwise extension proves no independent custody');
  equal(extension.truth.realWorldControllerIndependenceProven, false, 'pairwise extension proves no independent controller');
  equal(extension.truth.sameControllerWithDistinctKeysStillPossible, true, 'same-controller counterexample remains explicit');
  equal(extension.truth.crossLayerCollusionExcluded, false, 'pairwise extension excludes no collusion');
  equal(extension.truth.witnessPolicyReplacementPrevented, false, 'pairwise extension prevents no policy replacement');
  equal(extension.truth.executionAuthorized, false, 'pairwise extension grants no execution authority');
  equal(extension.truth.adoptionAuthorized, false, 'pairwise extension grants no adoption authority');
  equal(extension.truth.automaticCanon, false, 'pairwise extension grants no CANON authority');
  equal(Transition.verifyTransition(extensionInput, extension).pass, true, 'forward extension exact-verifies');
  equal(Transition.buildTransition(copy(extensionInput)), extension, 'forward extension deterministically rebuilds');

  fs.unlinkSync(forkAPath);
  const forkBChallenge = StateFixture.issueChallenge(state, 0x43);
  const forkBResponse = StateFixture.answer(state, forkBChallenge, '2026-08-20T15:30:00.000Z');
  const forkBSnapshot = Continuity.captureState(StateFixture.observationOptions(state, 'local-possession-observation:pairwise-fork-b', '2026-08-20T15:31:00.000Z'));
  const forkBCheckpoint = checkpoint(forkBSnapshot, 'local-possession-checkpoint:pairwise-fork-b', '2026-08-20T15:31:30.000Z');
  const forkBChain = Fixture.buildSeparatedChain(forkBCheckpoint, 'fork-b', authority, { minute: 32 });
  const forkBTransition = Transition.buildTransition(Fixture.transitionInput(baseChain, forkBChain, 'base-to-fork-b'));
  equal(forkBTransition.decision.classification, 'CANDIDATE_EXTENDS_PRESENTED_POSSESSION_CHAIN', 'second fork independently extends the same prior chain');
  equal(forkBTransition.decision.forwardTransitionAdmissible, true, 'second fork is independently pairwise admissible');
  equal(forkBTransition.truth.withheldForksExcluded, false, 'independently valid fork does not exclude another branch');

  const coPresentedFork = Transition.buildTransition(Fixture.transitionInput(forkAChain, forkBChain, 'fork-a-to-fork-b'));
  equal(coPresentedFork.decision.classification, 'HOLD_CANDIDATE_REMOVES_OR_REPLACES_PRIOR_RESPONSES', 'co-presented divergent response forks are held');
  equal(coPresentedFork.decision.pairwiseConsistency, 'CONTRADICTION', 'co-presented forks are pairwise contradictory');
  equal(coPresentedFork.decision.forwardTransitionAdmissible, false, 'co-presented fork is not forward-admissible');
  equal(coPresentedFork.decision.reviewRequired, true, 'co-presented fork requires review');
  equal(coPresentedFork.comparison.missingPreviousChallenges[0], forkAChallenge.challengeDigest, 'fork comparison identifies omitted prior-branch challenge');
  equal(coPresentedFork.comparison.addedCandidateChallenges[0], forkBChallenge.challengeDigest, 'fork comparison identifies candidate-branch challenge');
  equal(coPresentedFork.truth.priorResponseRemovalOrReplacementDetected, true, 'response fork contradiction truth is explicit');
  equal(coPresentedFork.truth.withheldForksExcluded, false, 'co-presented detection still excludes no withheld fork');

  const alternateAuthority = Fixture.createAuthority('alternate-same-epoch', {
    anchorId: authority.anchorPolicy.anchorId,
    witnessPolicyId: authority.witnessPolicyId
  });
  const alternateAnchorChain = Fixture.buildSeparatedChain(forkACheckpoint, 'alternate-anchor', alternateAuthority, { minute: 28 });
  const anchorEquivocation = Transition.buildTransition(Fixture.transitionInput(baseChain, alternateAnchorChain, 'anchor-equivocation'));
  equal(anchorEquivocation.decision.classification, 'HOLD_ANCHOR_EQUIVOCATION_AT_SELF_DECLARED_EPOCH', 'different anchor digest at same presented epoch is held');
  equal(anchorEquivocation.truth.sameEpochAnchorEquivocationObserved, true, 'same-epoch anchor equivocation truth is explicit');

  const epochTwoAuthority = Fixture.createAuthority('epoch-two', {
    anchorId: authority.anchorPolicy.anchorId,
    anchorEpoch: 2,
    witnessPairs: authority.witnessPairs,
    actorDigests: authority.actorDigests,
    witnessKeyIds: authority.witnessKeyIds,
    witnessPolicyId: authority.witnessPolicyId,
    anchorPairs: authority.anchorPairs,
    stewardDigests: authority.stewardDigests,
    anchorKeyIds: authority.anchorKeyIds
  });
  const epochTwoForkA = Fixture.buildSeparatedChain(forkACheckpoint, 'epoch-two-fork-a', epochTwoAuthority, { minute: 28 });
  const epochAdvance = Transition.buildTransition(Fixture.transitionInput(baseChain, epochTwoForkA, 'epoch-advance'));
  equal(epochAdvance.decision.classification, 'CANDIDATE_EXTENDS_PRESENTED_POSSESSION_CHAIN', 'higher self-declared epoch can accompany response extension');
  equal(epochAdvance.anchorTransition.relation, 'ADVANCED_SELF_DECLARED', 'higher epoch remains labelled self-declared');
  equal(epochAdvance.truth.anchorEpochMonotonicityProven, false, 'higher presented epoch is not protected monotonicity');

  const epochTwoBase = Fixture.buildSeparatedChain(baseCheckpoint, 'epoch-two-base', epochTwoAuthority, { minute: 23 });
  const epochRollback = Transition.buildTransition(Fixture.transitionInput(epochTwoBase, forkAChain, 'epoch-rollback'));
  equal(epochRollback.decision.classification, 'HOLD_SELF_DECLARED_ANCHOR_EPOCH_ROLLBACK', 'lower candidate self-declared epoch is held');
  equal(epochRollback.anchorTransition.relation, 'ROLLBACK_SELF_DECLARED', 'epoch rollback relation is explicit');
  equal(epochRollback.truth.anchorEpochRollbackObserved, true, 'epoch rollback truth is explicit');

  const differentAnchorAuthority = Fixture.createAuthority('different-anchor', {
    anchorId: 'local-possession-pairwise-anchor:different',
    witnessPolicyId: authority.witnessPolicyId
  });
  const differentAnchorChain = Fixture.buildSeparatedChain(forkACheckpoint, 'different-anchor', differentAnchorAuthority, { minute: 28 });
  const anchorIdentityDrift = Transition.buildTransition(Fixture.transitionInput(baseChain, differentAnchorChain, 'anchor-identity-drift'));
  equal(anchorIdentityDrift.decision.classification, 'HOLD_ANCHOR_IDENTITY_DRIFT', 'different anchor identity is held');
  equal(anchorIdentityDrift.truth.pairwiseAnchorIdentityMatches, false, 'anchor identity drift truth is explicit');

  const witnessPolicyDriftChain = Fixture.buildSeparatedChain(forkACheckpoint, 'witness-policy-drift', authority, {
    minute: 28,
    witnessPolicyId: 'local-possession-pairwise-witness-policy:different'
  });
  const witnessPolicyDrift = Transition.buildTransition(Fixture.transitionInput(baseChain, witnessPolicyDriftChain, 'witness-policy-drift'));
  equal(witnessPolicyDrift.decision.classification, 'HOLD_WITNESS_POLICY_IDENTITY_DRIFT', 'different witness-policy identity is held');
  equal(witnessPolicyDrift.truth.pairwiseWitnessPolicyIdentityMatches, false, 'witness-policy identity drift truth is explicit');

  const receiverDriftSnapshot = derivedSnapshot(forkASnapshot, 'local-possession-observation:pairwise-receiver-drift', '2026-08-20T15:27:00.000Z', {
    receiverIdDigest: Transition.sha256('different-declared-receiver')
  });
  const receiverDriftCheckpoint = checkpoint(receiverDriftSnapshot, 'local-possession-checkpoint:pairwise-receiver-drift', '2026-08-20T15:27:30.000Z');
  const receiverDriftChain = Fixture.buildSeparatedChain(receiverDriftCheckpoint, 'receiver-drift', authority, { minute: 28 });
  const receiverDrift = Transition.buildTransition(Fixture.transitionInput(baseChain, receiverDriftChain, 'receiver-drift'));
  equal(receiverDrift.decision.classification, 'HOLD_DECLARED_RECEIVER_DIGEST_DRIFT', 'different declared receiver digest is held');
  equal(receiverDrift.truth.pairwiseDeclaredReceiverDigestMatches, false, 'declared receiver digest drift truth is explicit');
  equal(receiverDrift.truth.declaredPrincipalDigestsAuthenticated, false, 'digest comparison is not promoted to authenticated identity');

  const challengerDriftSnapshot = derivedSnapshot(forkASnapshot, 'local-possession-observation:pairwise-challenger-drift', '2026-08-20T15:27:00.000Z', {
    challengerIdDigest: Transition.sha256('different-declared-challenger')
  });
  const challengerDriftCheckpoint = checkpoint(challengerDriftSnapshot, 'local-possession-checkpoint:pairwise-challenger-drift', '2026-08-20T15:27:30.000Z');
  const challengerDriftChain = Fixture.buildSeparatedChain(challengerDriftCheckpoint, 'challenger-drift', authority, { minute: 28 });
  const challengerDrift = Transition.buildTransition(Fixture.transitionInput(baseChain, challengerDriftChain, 'challenger-drift'));
  equal(challengerDrift.decision.classification, 'HOLD_DECLARED_CHALLENGER_DIGEST_DRIFT', 'different declared challenger digest is held');
  equal(challengerDrift.truth.pairwiseDeclaredChallengerDigestMatches, false, 'declared challenger digest drift truth is explicit');

  const changedReceiverPolicyRef = copy(forkASnapshot.receiverPolicyRef);
  changedReceiverPolicyRef.sha256 = Transition.sha256('different-receiver-policy');
  const policyDriftSnapshot = derivedSnapshot(forkASnapshot, 'local-possession-observation:pairwise-policy-drift', '2026-08-20T15:27:00.000Z', {
    receiverPolicyRef: changedReceiverPolicyRef
  });
  const policyDriftCheckpoint = checkpoint(policyDriftSnapshot, 'local-possession-checkpoint:pairwise-policy-drift', '2026-08-20T15:27:30.000Z');
  const policyDriftChain = Fixture.buildSeparatedChain(policyDriftCheckpoint, 'receiver-policy-drift', authority, { minute: 28 });
  const receiverPolicyDrift = Transition.buildTransition(Fixture.transitionInput(baseChain, policyDriftChain, 'receiver-policy-drift'));
  equal(receiverPolicyDrift.decision.classification, 'HOLD_RECEIVER_POLICY_DRIFT', 'changed receiver-policy reference is held');
  equal(receiverPolicyDrift.truth.pairwiseReceiverPolicyMatches, false, 'receiver-policy drift truth is explicit');

  const timeRollback = Transition.buildTransition(Fixture.transitionInput(forkAChain, baseChain, 'time-rollback'));
  equal(timeRollback.decision.classification, 'HOLD_PRESENTED_TIME_ROLLBACK', 'earlier candidate verification or checkpoint time is held');
  equal(timeRollback.comparison.candidateVerificationTimePrecedesPrevious, true, 'candidate verification-time rollback is explicit');
  equal(timeRollback.comparison.candidateCheckpointTimePrecedesPrevious, true, 'candidate checkpoint-time rollback is explicit');

  const reusedCheckpointId = checkpoint(forkASnapshot, baseCheckpoint.checkpointId, '2026-08-20T15:27:30.000Z');
  const reusedCheckpointIdChain = Fixture.buildSeparatedChain(reusedCheckpointId, 'reused-checkpoint-id', authority, { minute: 28 });
  const checkpointEquivocation = Transition.buildTransition(Fixture.transitionInput(baseChain, reusedCheckpointIdChain, 'checkpoint-equivocation'));
  equal(checkpointEquivocation.decision.classification, 'HOLD_CHECKPOINT_ID_EQUIVOCATION', 'same checkpoint id with different digest is held');
  equal(checkpointEquivocation.truth.checkpointIdEquivocationObserved, true, 'checkpoint-id equivocation truth is explicit');

  const alternateSameCheckpoint = Fixture.buildSeparatedChain(baseCheckpoint, 'alternate-same-checkpoint', authority, { minute: 24 });
  const alternateSameCheckpointReceipt = Transition.buildTransition(Fixture.transitionInput(baseChain, alternateSameCheckpoint, 'alternate-same-checkpoint'));
  equal(alternateSameCheckpointReceipt.decision.classification, 'HOLD_ALTERNATE_SEPARATED_CHAIN_FOR_SAME_CHECKPOINT', 'different separated chain for exact checkpoint is held');
  equal(alternateSameCheckpointReceipt.comparison.sameCheckpointDigest, true, 'same exact checkpoint digest is explicit');
  equal(alternateSameCheckpointReceipt.comparison.sameSeparatedReceiptDigest, false, 'different separated receipt digest is explicit');

  const sameTimeMetadataCheckpoint = checkpoint(baseSnapshot, 'local-possession-checkpoint:pairwise-same-time-metadata', baseCheckpoint.anchoredAt);
  const sameTimeMetadataChain = Fixture.buildSeparatedChain(sameTimeMetadataCheckpoint, 'same-time-metadata', authority, { minute: 24 });
  const timeCollision = Transition.buildTransition(Fixture.transitionInput(baseChain, sameTimeMetadataChain, 'time-collision'));
  equal(timeCollision.decision.classification, 'HOLD_CHECKPOINT_TIME_COLLISION', 'different checkpoint at same presented time is held');

  const laterMetadataCheckpoint = checkpoint(baseSnapshot, 'local-possession-checkpoint:pairwise-later-metadata', '2026-08-20T15:26:30.000Z');
  const laterMetadataChain = Fixture.buildSeparatedChain(laterMetadataCheckpoint, 'later-metadata', authority, { minute: 27 });
  const metadataOnly = Transition.buildTransition(Fixture.transitionInput(baseChain, laterMetadataChain, 'metadata-only'));
  equal(metadataOnly.decision.classification, 'HOLD_CHECKPOINT_CHANGED_WITHOUT_RESPONSE_EXTENSION', 'checkpoint metadata change without response extension is held');
  equal(metadataOnly.comparison.addedCandidateChallenges.length, 0, 'metadata-only checkpoint adds no challenge');

  const replacedCheckpoint = copy(forkACheckpoint);
  const baseChallengeDigest = baseCheckpoint.entries[0].challengeRef.sha256;
  const baseIndex = replacedCheckpoint.entries.findIndex(entry => entry.challengeRef.sha256 === baseChallengeDigest);
  replacedCheckpoint.entries[baseIndex].responseRef.sha256 = Transition.sha256('synthetic-caller-presented-replacement-response');
  replacedCheckpoint.entries[baseIndex].answeredAt = '2026-08-20T15:26:30.000Z';
  const exactReplacedCheckpoint = redigestCheckpoint(replacedCheckpoint);
  equal(Continuity.verifyCheckpoint(exactReplacedCheckpoint).pass, true, 'caller-presented replaced-response checkpoint is structurally exact');
  const replacedChain = Fixture.buildSeparatedChain(exactReplacedCheckpoint, 'replaced-response', authority, { minute: 28 });
  const replacedTransition = Transition.buildTransition(Fixture.transitionInput(baseChain, replacedChain, 'replaced-response'));
  equal(replacedTransition.decision.classification, 'HOLD_CANDIDATE_REMOVES_OR_REPLACES_PRIOR_RESPONSES', 'candidate replacing a prior response is held');
  equal(replacedTransition.comparison.replacedPreviousResponses.length, 1, 'replaced response is retained as exact pairwise evidence');
  equal(replacedTransition.comparison.replacedPreviousResponses[0].challengeDigest, baseChallengeDigest, 'replacement evidence identifies exact prior challenge');
  check(replacedTransition.comparison.replacedPreviousResponses[0].previousEntryDigest !== replacedTransition.comparison.replacedPreviousResponses[0].candidateEntryDigest, 'replacement evidence binds distinct entry digests');
  check(replacedTransition.comparison.replacedPreviousResponses[0].previousResponseDigest !== replacedTransition.comparison.replacedPreviousResponses[0].candidateResponseDigest, 'replacement evidence binds distinct response digests');

  const earlyComparison = copy(extensionInput);
  earlyComparison.comparedAt = '2026-08-20T15:30:00.000Z';
  throws(() => Transition.buildTransition(earlyComparison), /cannot predate either separated chain/, 'comparison cannot predate either presented chain');

  const unknownField = copy(extensionInput);
  unknownField.globalForkFree = true;
  throws(() => Transition.buildTransition(unknownField), /unknown fields: globalForkFree/, 'undeclared global-fork claim is refused');

  const overBound = copy(extensionInput);
  overBound.padding = 'x'.repeat(Transition.MAX_ARTIFACT_CANONICAL_BYTES);
  throws(() => Transition.buildTransition(overBound), /exceeds the 512 KiB canonical artifact bound/, 'oversized transition input is refused before field processing');

  const invalidPrevious = copy(extensionInput);
  invalidPrevious.previousSeparationReceipt.truth.realWorldControllerIndependenceProven = true;
  throws(() => Transition.buildTransition(invalidPrevious), /previous local possession separated chain is invalid/, 'tampered previous separated chain is refused');

  const invalidCandidate = copy(extensionInput);
  invalidCandidate.candidateSeparationReceipt.truth.crossLayerCollusionExcluded = true;
  throws(() => Transition.buildTransition(invalidCandidate), /candidate local possession separated chain is invalid/, 'tampered candidate separated chain is refused');

  let authorityTamper = copy(extension);
  authorityTamper.truth.globalTransitionUniquenessProven = true;
  authorityTamper = redigestReceipt(authorityTamper);
  equal(Transition.verifyTransition(extensionInput, authorityTamper).pass, false, 'global-uniqueness tamper fails with recomputed digest');

  let identityTamper = copy(extension);
  identityTamper.truth.declaredPrincipalDigestsAuthenticated = true;
  identityTamper = redigestReceipt(identityTamper);
  equal(Transition.verifyTransition(extensionInput, identityTamper).pass, false, 'invented principal authentication fails with recomputed digest');

  const packagePath = path.join(tempRoot, 'caller-retained-local-possession-pairwise-transition-package.json');
  fs.writeFileSync(packagePath, Transition.stableStringify({ transitionInput: extensionInput, transitionReceipt: extension }) + '\n', {
    encoding: 'utf8',
    mode: 0o600
  });
  const child = runChild(packagePath);
  check(child.pid !== process.pid, 'fresh-process verification runs under a distinct process id');
  equal(child.rebuilt.receiptDigest, extension.receiptDigest, 'fresh process rebuilds exact transition digest');
  equal(child.verification.pass, true, 'fresh process verifies committed transition receipt');
  equal(child.rebuilt.truth.externalTransitionRetentionProven, false, 'fresh reload claims no external retention');
  equal(child.rebuilt.truth.withheldForksExcluded, false, 'fresh reload preserves withheld-fork boundary');

  const serialized = Transition.stableStringify(extension);
  authority.witnessPairs.forEach((pair, index) => equal(serialized.includes(Fixture.publicKeyPem(pair)), false, 'receipt omits witness public key ' + index));
  authority.anchorPairs.forEach((pair, index) => equal(serialized.includes(Fixture.publicKeyPem(pair)), false, 'receipt omits anchor public key ' + index));
  baseChain.separationInput.anchoredWitnessInput.witnessInput.signedAttestations.forEach((entry, index) => equal(serialized.includes(entry.signature), false, 'receipt omits witness signature ' + index));
  forkAChain.separationInput.anchoredWitnessInput.policyAuthorizations.forEach((entry, index) => equal(serialized.includes(entry.signature), false, 'receipt omits anchor signature ' + index));
  authority.actorDigests.forEach((value, index) => equal(serialized.includes(value), false, 'receipt omits witness actor digest ' + index));
  authority.stewardDigests.forEach((value, index) => equal(serialized.includes(value), false, 'receipt omits anchor steward digest ' + index));
  equal(serialized.includes(state.possession.receiverOptions.receiverId), false, 'receipt omits raw configured receiver label');
  equal(serialized.includes(state.possession.receiverOptions.challengerId), false, 'receipt omits raw configured challenger label');
  equal(serialized.includes(tempRoot), false, 'receipt omits machine state-root path');
  check(Buffer.byteLength(Transition.stableStringify(extensionInput), 'utf8') <= Transition.MAX_ARTIFACT_CANONICAL_BYTES, 'transition input stays within artifact bound');
  check(Buffer.byteLength(serialized, 'utf8') <= Transition.MAX_ARTIFACT_CANONICAL_BYTES, 'transition receipt stays within artifact bound');

  const schema = JSON.parse(fs.readFileSync(path.join(__dirname, 'model-shadow-review-challenge-transition-local-possession-checkpoint-pairwise-transition.schema.json'), 'utf8'));
  const contract = JSON.parse(fs.readFileSync(path.join(__dirname, 'module.contract.json'), 'utf8'));
  const implementation = fs.readFileSync(path.join(__dirname, 'model-shadow-review-challenge-transition-local-possession-checkpoint-pairwise-transition.js'), 'utf8');
  const readme = fs.readFileSync(path.join(__dirname, 'README.md'), 'utf8');
  equal(schema.$id, Transition.RECEIPT_SCHEMA, 'transition schema identity matches runtime');
  equal(schema.additionalProperties, false, 'transition schema closes unknown top-level fields');
  equal(schema.properties.comparison.additionalProperties, false, 'comparison schema closes unknown fields');
  equal(schema.properties.comparison.properties.replacedPreviousResponses.items.additionalProperties, false, 'replacement schema closes unknown fields');
  equal(schema.properties.decision.properties.autonomousActionCount.const, 0, 'schema prevents autonomous action');
  equal(schema.properties.truth.properties.withheldForksExcluded.const, false, 'schema preserves withheld-fork boundary');
  equal(schema.properties.truth.properties.sourceStateRecapturedByThisModule.const, false, 'schema preserves no-recapture boundary');
  equal(schema.properties.truth.properties.keyCustodyIndependenceProven.const, false, 'schema preserves custody boundary');
  equal(schema.properties.truth.properties.sameControllerWithDistinctKeysStillPossible.const, true, 'schema preserves same-controller counterexample');
  equal(schema.properties.truth.properties.declaredPrincipalDigestsAuthenticated.const, false, 'schema preserves principal-authentication boundary');
  equal(schema.properties.truth.properties.witnessPolicyReplacementPrevented.const, false, 'schema preserves policy-replacement boundary');
  equal(schema.properties.truth.properties.automaticCanon.const, false, 'schema preserves CANON boundary');
  equal(Object.keys(extension.truth).sort(), schema.properties.truth.required.slice().sort(), 'truth schema required keys exactly match runtime receipt');
  equal(Object.keys(extension.comparison).sort(), schema.properties.comparison.required.slice().sort(), 'comparison schema required keys exactly match runtime receipt');
  check(contract.status === 'TEST' && contract.permissions.length === 0 && contract.boundaries.reads.length === 0 && contract.boundaries.writes.length === 0, 'contract remains permissionless pure TEST');
  equal(contract.lifecycle.installed, false, 'contract remains uninstalled');
  equal(contract.lifecycle.promoted, false, 'contract remains unpromoted');
  check(contract.boundaries.refuses.includes('pairwise-comparison-as-global-fork-exclusion'), 'contract refuses global fork exclusion');
  check(contract.boundaries.refuses.includes('presented-checkpoint-as-current-source-state-recapture'), 'contract refuses presented checkpoint as live-state recapture');
  check(contract.boundaries.refuses.includes('pairwise-comparison-as-observation-of-withheld-branches'), 'contract refuses observation of withheld branches');
  check(contract.boundaries.refuses.includes('declared-party-digest-continuity-as-authenticated-real-world-identity'), 'contract refuses declared digests as authenticated identity');
  check(contract.boundaries.refuses.includes('transition-receipt-as-execution-or-adoption-authority'), 'contract refuses transition as action authority');
  check(/Two different candidates can each extend/.test(readme) && /withheld or\s+never-presented branch remains invisible/.test(readme), 'README preserves independently valid forks and withheld-branch boundary');
  check(/same controller can still create every key/.test(readme), 'README preserves same-controller counterexample');
  check(!implementation.includes("require('fs')") && !implementation.includes("require('child_process')"), 'runtime imports no filesystem or process capability');
  check(!implementation.includes('writeFileSync') && !implementation.includes('mkdirSync') && !implementation.includes('rmSync'), 'runtime contains no filesystem write route');
  check(!implementation.includes("require('http')") && !implementation.includes("require('https')") && !implementation.includes("require('net')") && !implementation.includes('fetch('), 'runtime contains no network route');
  check(!implementation.includes('crypto.sign') && !implementation.includes('createPrivateKey'), 'runtime performs no signing and creates no private key');
  check(!implementation.includes('automaticCanon: true'), 'runtime never declares automatic CANON');

  console.log('\nModel Shadow local possession checkpoint pairwise transition selftest: PASS (' + checks + ' checks)');
} finally {
  verifiedRemove(tempRoot, path.dirname(tempRoot));
  cleanupVerified = !fs.existsSync(tempRoot);
  if (!cleanupVerified) process.exitCode = 1;
}
