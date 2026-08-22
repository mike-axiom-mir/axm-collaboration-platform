#!/usr/bin/env node
'use strict';

const assert = require('assert');
const childProcess = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const ContractVerifier = require('../../hub/module-contract-verifier');
const Continuity = require('../model-shadow-review-challenge-transition-local-possession-continuity/model-shadow-review-challenge-transition-local-possession-continuity');
const StateFixture = require('../model-shadow-review-challenge-transition-local-possession-continuity/selftest-fixture');
const LegacyPairwise = require('../model-shadow-review-challenge-transition-local-possession-checkpoint-pairwise-transition/model-shadow-review-challenge-transition-local-possession-checkpoint-pairwise-transition');
const LegacyPairwiseFixture = require('../model-shadow-review-challenge-transition-local-possession-checkpoint-pairwise-transition/selftest-fixture');
const Ledger = require('../model-shadow-review-challenge-transition-local-possession-checkpoint-two-phase-settlement-ledger/model-shadow-review-challenge-transition-local-possession-checkpoint-two-phase-settlement-ledger');
const LedgerFixture = require('../model-shadow-review-challenge-transition-local-possession-checkpoint-two-phase-settlement-ledger/selftest-fixture');
const History = require('../model-shadow-two-phase-history-checkpoint/model-shadow-two-phase-history-checkpoint');
const Anchor = require('../model-shadow-history-checkpoint-anchor/model-shadow-history-checkpoint-anchor');
const Pairwise = require('../model-shadow-history-checkpoint-pairwise/model-shadow-history-checkpoint-pairwise');
const PairwiseFixture = require('../model-shadow-history-checkpoint-pairwise/selftest-fixture');
const PinTransition = require('./model-shadow-history-checkpoint-pin-transition');

let checks = 0;
const observedClassifications = new Set();
function check(value, label) { assert.ok(value, label); checks += 1; console.log('PASS ' + label); }
function equal(actual, expected, label) { assert.deepStrictEqual(actual, expected, label); checks += 1; console.log('PASS ' + label); }
function copy(value) { return JSON.parse(JSON.stringify(value)); }
function makeDir(parent, name) { const result = path.join(parent, name); fs.mkdirSync(result); return result; }
function recordPackage(proposalInput, proposalResult, settlementInput, settlementResult) {
  return {
    proposal: { input: copy(proposalInput), evidence: copy(proposalResult.prewriteEvidence), receipt: copy(proposalResult.proposal) },
    settlement: { input: copy(settlementInput), evidence: copy(settlementResult.postwriteEvidence), receipt: copy(settlementResult.settlement) }
  };
}
function checkpointInput(id, checkpointedAt, options, records) {
  return { checkpointId: id, checkpointedAt, serviceOptions: copy(options), records: copy(records) };
}
function redigestCheckpoint(value, id, checkpointedAt) {
  const result = copy(value);
  result.checkpointId = id;
  result.checkpointedAt = checkpointedAt;
  result.checkpointDigest = null;
  result.checkpointDigest = History.sha256(Object.fromEntries(Object.entries(result).filter(([key]) => key !== 'checkpointDigest')));
  return History.validateCheckpoint(result);
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
    encoding: 'utf8', maxBuffer: 256 * 1024 * 1024
  });
  return { status: result.status, value: JSON.parse(result.stdout || '{}'), stderr: result.stderr };
}
function verifiedRemove(target, parent) {
  const resolvedTarget = path.resolve(target); const resolvedParent = path.resolve(parent);
  if (resolvedTarget === resolvedParent || !resolvedTarget.startsWith(resolvedParent + path.sep)) throw new Error('unsafe cleanup target');
  fs.rmSync(resolvedTarget, { recursive: true, force: true });
}
function genesisInput(pkg, tag) {
  return {
    pinId: 'history-checkpoint-pin:' + tag,
    pinnedAt: '2026-08-20T16:00:00.000Z',
    anchoredInput: copy(pkg.anchoredInput),
    anchoredReceipt: copy(pkg.anchoredReceipt)
  };
}
function transitionInput(pin, previous, candidate, tag) {
  return {
    transitionId: 'history-checkpoint-pin-transition:' + tag,
    comparedAt: '2026-08-20T16:30:00.000Z',
    successorPinId: 'history-checkpoint-pin:' + tag + ':successor',
    expectedPreviousPin: copy(pin),
    previousAnchoredInput: copy(previous.anchoredInput),
    previousAnchoredReceipt: copy(previous.anchoredReceipt),
    candidateAnchoredInput: copy(candidate.anchoredInput),
    candidateAnchoredReceipt: copy(candidate.anchoredReceipt)
  };
}
function build(input) {
  const receipt = PinTransition.buildTransition(input);
  observedClassifications.add(receipt.classification);
  return receipt;
}

function main() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'axm-v24-pin-transition-'));
  try {
    const scenario = LedgerFixture.buildScenario(tempRoot);
    const ledgerRoot = makeDir(tempRoot, 'ledger');
    const genesisRef = LedgerFixture.separatedRef(scenario.baseChain);
    const options = LedgerFixture.serviceOptions(scenario.state, scenario.sourceRoot, ledgerRoot, 'v24-pin-ledger', genesisRef);
    const service = Ledger.createService(copy(options));
    const firstProposalInput = LedgerFixture.proposalInput(scenario.firstTransitionInput, scenario.firstTransitionReceipt, 'v24-first');
    const firstProposal = service.propose(firstProposalInput);
    const firstSettlementInput = LedgerFixture.settlementInput(firstProposalInput, firstProposal, 'v24-first');
    const firstSettlement = service.settle(firstSettlementInput);
    const firstRecord = recordPackage(firstProposalInput, firstProposal, firstSettlementInput, firstSettlement);
    const previousCheckpoint = History.createCheckpoint(checkpointInput(
      'history-checkpoint:v24-previous', '2026-08-20T15:36:00.000Z', options, [firstRecord]
    ));
    const recheckpoint = History.createCheckpoint(checkpointInput(
      'history-checkpoint:v24-recheckpoint', '2026-08-20T15:37:00.000Z', options, [firstRecord]
    ));

    const thirdChallenge = StateFixture.issueChallenge(scenario.state, 0x64, {
      issuedAt: '2026-08-20T15:37:00.000Z', expiresAt: '2026-08-20T15:55:00.000Z'
    });
    StateFixture.answer(scenario.state, thirdChallenge, '2026-08-20T15:37:20.000Z');
    const thirdSnapshot = Continuity.captureState(StateFixture.observationOptions(
      scenario.state, 'local-possession-observation:v24-third', '2026-08-20T15:37:30.000Z'
    ));
    const thirdCheckpoint = LedgerFixture.checkpoint(thirdSnapshot, 'local-possession-checkpoint:v24-third', '2026-08-20T15:37:40.000Z');
    const thirdChain = LegacyPairwiseFixture.buildSeparatedChain(thirdCheckpoint, 'v24-third', scenario.authority, { minute: 38 });
    const secondTransitionInput = LegacyPairwiseFixture.transitionInput(
      scenario.secondChain, thirdChain, 'v24-second', '2026-08-20T15:41:00.000Z'
    );
    const secondTransitionReceipt = LegacyPairwise.buildTransition(secondTransitionInput);
    const secondProposalInput = LedgerFixture.proposalInput(secondTransitionInput, secondTransitionReceipt, 'v24-second', {
      observedAt: '2026-08-20T15:42:00.000Z', checkedAt: '2026-08-20T15:42:10.000Z', proposedAt: '2026-08-20T15:42:20.000Z'
    });
    const secondProposal = service.propose(secondProposalInput);
    const secondSettlementInput = LedgerFixture.settlementInput(secondProposalInput, secondProposal, 'v24-second', {
      observedAt: '2026-08-20T15:42:30.000Z', checkedAt: '2026-08-20T15:42:40.000Z', settledAt: '2026-08-20T15:43:00.000Z'
    });
    const secondSettlement = service.settle(secondSettlementInput);
    const secondRecord = recordPackage(secondProposalInput, secondProposal, secondSettlementInput, secondSettlement);
    const candidateCheckpoint = History.createCheckpoint(checkpointInput(
      'history-checkpoint:v24-candidate', '2026-08-20T15:44:00.000Z', options, [firstRecord, secondRecord]
    ));
    equal(PinTransition.VERSION, '2.4.0', 'version is exact');
    equal(PinTransition.STATUS, 'TEST', 'status remains TEST');
    equal(PinTransition.CLASSIFICATIONS.length, 5, 'classification set is closed to five outcomes');
    equal(PinTransition.PIN_BINDING_DIMENSIONS.length, 13, 'pin binds thirteen exact package dimensions');
    equal(PinTransition.MAX_PIN_BUILD_INPUT_CANONICAL_BYTES, 71303168, 'pin build envelope covers one bounded v2.2 package');
    equal(PinTransition.MAX_PIN_CANONICAL_BYTES, 1048576, 'pin artifact has a one MiB bound');
    equal(PinTransition.MAX_TRANSITION_INPUT_CANONICAL_BYTES, 141557760, 'transition envelope covers v2.3 plus a bounded pin');
    equal(PinTransition.MAX_TRANSITION_RECEIPT_CANONICAL_BYTES, 2097152, 'transition receipt has a two MiB bound');
    equal(History.validateCheckpoint(previousCheckpoint), previousCheckpoint, 'previous v2.1 checkpoint self-validates');
    equal(History.validateCheckpoint(candidateCheckpoint), candidateCheckpoint, 'candidate v2.1 checkpoint self-validates');

    const authority = PairwiseFixture.createAuthority('v24-stable');
    const previousPackage = PairwiseFixture.buildAnchoredPackage(previousCheckpoint, 'v24-previous', authority, 37);
    const candidatePackage = PairwiseFixture.buildAnchoredPackage(candidateCheckpoint, 'v24-candidate', authority, 45);
    const recheckpointPackage = PairwiseFixture.buildAnchoredPackage(recheckpoint, 'v24-recheckpoint', authority, 38);
    equal(Anchor.verifyAnchoredCheckpoint(previousPackage.anchoredInput, previousPackage.anchoredReceipt).pass, true, 'previous v2.2 package exact-rebuilds');
    equal(Anchor.verifyAnchoredCheckpoint(candidatePackage.anchoredInput, candidatePackage.anchoredReceipt).pass, true, 'candidate v2.2 package exact-rebuilds');

    const pinInput = genesisInput(previousPackage, 'v24-original');
    const originalPin = PinTransition.buildGenesisPin(pinInput);
    equal(originalPin.pinKind, 'GENESIS', 'genesis pin kind is explicit');
    equal(originalPin.pinGeneration, 0, 'genesis pin starts at generation zero');
    equal(originalPin.previousPinRef, null, 'genesis pin has no predecessor');
    equal(PinTransition.validatePin(originalPin), originalPin, 'genesis pin self-validates exactly');
    equal(PinTransition.verifyGenesisPin(pinInput, originalPin).pass, true, 'genesis pin exact-rebuilds from the v2.2 package');
    equal(originalPin.binding.anchoredCheckpointRef.sha256, previousPackage.anchoredReceipt.receiptDigest, 'pin binds exact anchored receipt');
    equal(originalPin.binding.checkpointRef.sha256, previousCheckpoint.checkpointDigest, 'pin binds exact checkpoint');
    equal(originalPin.binding.proposalCount, 1, 'pin records full proposal count');
    equal(originalPin.binding.settlementCount, 1, 'pin records full settlement count');
    check(originalPin.binding.anchorProfileDigest !== originalPin.binding.anchorPolicyRef.sha256, 'normalized anchor profile digest is distinct from changing policy self-digest');
    check(originalPin.binding.witnessProfileDigest !== originalPin.binding.witnessPolicyRef.sha256, 'normalized witness profile digest is distinct from changing policy self-digest');
    equal(originalPin.truth.pinOriginAuthenticated, false, 'pin does not authenticate its origin');
    equal(originalPin.truth.pinExternallyRetainedByModule, false, 'pin claims no module retention');

    const replayInput = transitionInput(originalPin, previousPackage, previousPackage, 'replay');
    const replay = build(replayInput);
    equal(replay.classification, 'PIN_MATCH_PRESENTED_ANCHORED_PACKAGE_EXACT_REPLAY', 'exact package replay is distinct');
    equal(replay.pairwiseClassification, 'PRESENTED_ANCHORED_PACKAGE_EXACT_REPLAY', 'v2.3 replay classification is preserved unchanged');
    equal(replay.successorPinProposal, null, 'exact replay produces no successor pin');
    equal(replay.decision.successorPinProposed, false, 'replay decision records no new pin state');
    equal(replay.decision.holdRequired, false, 'exact replay is not a hold');

    const recheckpointInput = transitionInput(originalPin, previousPackage, recheckpointPackage, 'recheckpoint');
    const recheckpointReceipt = build(recheckpointInput);
    equal(recheckpointReceipt.classification, 'PIN_MATCH_PRESENTED_HISTORY_EXACT_RECHECKPOINT', 'exact-history recheckpoint is distinct');
    equal(recheckpointReceipt.pairwiseClassification, 'PRESENTED_HISTORY_EXACT_RECHECKPOINT', 'v2.3 recheckpoint classification is preserved');
    equal(recheckpointReceipt.successorPinProposal.pinKind, 'SUCCESSOR', 'recheckpoint produces a successor proposal');
    equal(recheckpointReceipt.successorPinProposal.pinGeneration, 1, 'recheckpoint successor increments generation');
    equal(recheckpointReceipt.successorPinProposal.previousPinRef.sha256, originalPin.pinDigest, 'recheckpoint successor binds predecessor pin');
    equal(recheckpointReceipt.decision.successorPinAdoptionAuthorized, false, 'recheckpoint successor is not adopted');

    const beforeTree = treeDigest(ledgerRoot);
    const forwardInput = transitionInput(originalPin, previousPackage, candidatePackage, 'forward');
    const forward = build(forwardInput);
    const afterTree = treeDigest(ledgerRoot);
    equal(beforeTree, afterTree, 'pin transition leaves the source ledger byte-for-byte unchanged');
    equal(forward.classification, 'PIN_MATCH_CANDIDATE_EXTENDS_PRESENTED_ANCHORED_HISTORY', 'strict full-history extension is a pin-matched forward candidate');
    equal(forward.pairwiseClassification, 'CANDIDATE_EXTENDS_PRESENTED_ANCHORED_HISTORY', 'v2.3 forward classification is preserved unchanged');
    equal(forward.pinComparison.matches, true, 'every original pin binding matches previous package');
    equal(forward.pinComparison.driftDimensions, [], 'matching pin has no drift dimensions');
    equal(Object.values(forward.pinComparison.dimensions).every(Boolean), true, 'every individual pin comparison passes');
    equal(forward.successorPinProposal.binding.proposalCount, 2, 'successor proposal binds complete candidate proposal history');
    equal(forward.successorPinProposal.binding.settlementCount, 2, 'successor proposal binds complete candidate settlement history');
    equal(forward.successorPinProposal.previousPinRef.sha256, originalPin.pinDigest, 'forward successor binds exact predecessor pin');
    equal(PinTransition.validatePin(forward.successorPinProposal), forward.successorPinProposal, 'successor pin proposal self-validates');
    equal(forward.decision.reviewRequired, true, 'forward successor requires review');
    equal(forward.decision.successorPinAdoptionAuthorized, false, 'forward successor grants no adoption authority');
    equal(forward.decision.autonomousActionCount, 0, 'forward successor authorizes zero autonomous actions');

    const successorReplay = build(transitionInput(forward.successorPinProposal, candidatePackage, candidatePackage, 'successor-replay'));
    equal(successorReplay.classification, 'PIN_MATCH_PRESENTED_ANCHORED_PACKAGE_EXACT_REPLAY', 'successor pin can exact-match its candidate package in a later rebuild');
    equal(successorReplay.expectedPreviousPinRef.sha256, forward.successorPinProposal.pinDigest, 'later rebuild uses exact successor pin digest');

    const upstreamHold = build(transitionInput(forward.successorPinProposal, candidatePackage, previousPackage, 'upstream-hold'));
    equal(upstreamHold.classification, 'PIN_MATCH_UPSTREAM_PAIRWISE_HOLD', 'pin match does not override an upstream pairwise hold');
    equal(upstreamHold.pairwiseClassification, 'HOLD_PRESENTED_TIME_ROLLBACK', 'exact upstream hold classification remains visible');
    equal(upstreamHold.successorPinProposal, null, 'upstream hold produces no successor proposal');
    equal(upstreamHold.decision.holdRequired, true, 'upstream hold remains held');

    const oneFieldDriftPin = copy(originalPin);
    oneFieldDriftPin.binding.ledgerIdentityDigest = PinTransition.sha256('synthetic-v2.4-ledger-identity-drift');
    oneFieldDriftPin.pinDigest = PinTransition.sha256(Object.fromEntries(Object.entries(oneFieldDriftPin).filter(([key]) => key !== 'pinDigest')));
    equal(PinTransition.validatePin(oneFieldDriftPin), oneFieldDriftPin, 'self-consistent but mismatching pin remains structurally valid data');
    const oneFieldDrift = build(transitionInput(oneFieldDriftPin, previousPackage, candidatePackage, 'one-field-drift'));
    equal(oneFieldDrift.classification, 'HOLD_PREVIOUS_PACKAGE_DOES_NOT_MATCH_PRESENTED_PIN', 'one pin-binding mismatch produces typed hold');
    equal(oneFieldDrift.pinComparison.driftDimensions, ['ledgerIdentityDigest'], 'typed hold names the exact pin drift dimension');
    equal(oneFieldDrift.successorPinProposal, null, 'pin mismatch produces no successor proposal');

    const earlyPin = copy(originalPin);
    earlyPin.pinnedAt = '2026-08-20T15:00:00.000Z';
    earlyPin.pinDigest = PinTransition.sha256(Object.fromEntries(Object.entries(earlyPin).filter(([key]) => key !== 'pinDigest')));
    const earlyPinReceipt = build(transitionInput(earlyPin, previousPackage, candidatePackage, 'early-pin'));
    equal(earlyPinReceipt.pinComparison.driftDimensions, ['pinnedAtNotBeforeAnchoredVerification'], 'caller time before anchored verification is a typed pin mismatch');

    const exhaustedGenerationPin = copy(originalPin);
    exhaustedGenerationPin.pinKind = 'SUCCESSOR';
    exhaustedGenerationPin.pinGeneration = Number.MAX_SAFE_INTEGER;
    exhaustedGenerationPin.previousPinRef = { id: originalPin.pinId, schema: originalPin.schema, sha256: originalPin.pinDigest };
    exhaustedGenerationPin.pinDigest = PinTransition.sha256(Object.fromEntries(Object.entries(exhaustedGenerationPin).filter(([key]) => key !== 'pinDigest')));
    equal(PinTransition.verifyTransition(transitionInput(exhaustedGenerationPin, previousPackage, candidatePackage, 'exhausted-generation'), forward).pass, false, 'successor generation overflow fails closed');

    const replacementAuthority = PairwiseFixture.createAuthority('v24-joint-replacement');
    const replacedPreviousCheckpoint = redigestCheckpoint(previousCheckpoint, 'history-checkpoint:v24-replaced-previous', '2026-08-20T15:50:00.000Z');
    const replacedCandidateCheckpoint = redigestCheckpoint(candidateCheckpoint, 'history-checkpoint:v24-replaced-candidate', '2026-08-20T15:51:00.000Z');
    const replacedPreviousPackage = PairwiseFixture.buildAnchoredPackage(replacedPreviousCheckpoint, 'v24-replaced-previous', replacementAuthority, 52);
    const replacedCandidatePackage = PairwiseFixture.buildAnchoredPackage(replacedCandidateCheckpoint, 'v24-replaced-candidate', replacementAuthority, 54);
    equal(Pairwise.buildTransition(PairwiseFixture.transitionInput(replacedPreviousPackage, replacedCandidatePackage, 'v24-replaced-pair')).classification, 'CANDIDATE_EXTENDS_PRESENTED_ANCHORED_HISTORY', 'jointly replaced pair remains internally forward at v2.3');
    const retainedOriginal = build(transitionInput(originalPin, replacedPreviousPackage, replacedCandidatePackage, 'retained-original-pin'));
    equal(retainedOriginal.classification, 'HOLD_PREVIOUS_PACKAGE_DOES_NOT_MATCH_PRESENTED_PIN', 'retained original pin exposes joint replacement of both packages');
    check(retainedOriginal.pinComparison.driftDimensions.includes('anchoredCheckpointRef'), 'joint replacement changes pinned anchored receipt');
    check(retainedOriginal.pinComparison.driftDimensions.includes('checkpointRef'), 'joint replacement changes pinned checkpoint');
    check(retainedOriginal.pinComparison.driftDimensions.includes('anchorProfileDigest'), 'joint replacement changes pinned anchor profile');
    check(retainedOriginal.pinComparison.driftDimensions.includes('witnessProfileDigest'), 'joint replacement changes pinned witness profile');
    equal(retainedOriginal.truth.retainedOriginalPinCanExposeJointPairReplacement, true, 'conditional retained-pin detection is explicit');

    const replacementPinInput = genesisInput(replacedPreviousPackage, 'v24-replaced-pin');
    const replacementPin = PinTransition.buildGenesisPin(replacementPinInput);
    const replacedTogetherInput = transitionInput(replacementPin, replacedPreviousPackage, replacedCandidatePackage, 'pin-and-pair-replaced');
    const replacedTogether = build(replacedTogetherInput);
    equal(replacedTogether.classification, 'PIN_MATCH_CANDIDATE_EXTENDS_PRESENTED_ANCHORED_HISTORY', 'replacing pin and both packages together remains internally forward');
    equal(replacedTogether.truth.jointPairAndPinReplacementStillPossible, true, 'joint pin-and-pair replacement limitation is explicit');
    equal(replacedTogether.truth.originalPinContinuityProven, false, 'replacement chain proves no continuity with original pin');
    equal(replacedTogether.truth.externalRetentionProven, false, 'replacement chain proves no external retention');
    equal(replacedTogether.truth.protectedMonotonicStateProven, false, 'replacement chain proves no protected monotonic state');
    equal(replacedTogether.truth.deletionOrRollbackPrevented, false, 'replacement chain proves no rollback prevention');

    const childPath = writePackage(tempRoot, 'fresh-process', { genesisInput: pinInput, transitionInput: forwardInput });
    const child = runChild(childPath);
    equal(child.status, 0, 'fresh process exact-rebuilds pin and transition');
    check(child.value.pid !== process.pid, 'fresh rebuild uses a distinct process');
    equal(child.value.genesisPin, originalPin, 'fresh-process genesis pin is exact');
    equal(child.value.transition, forward, 'fresh-process transition receipt is exact');
    equal(PinTransition.verifyTransition(forwardInput, forward).pass, true, 'forward transition exact-verifies');

    const tamperedPin = copy(originalPin);
    tamperedPin.pinDigest = 'sha256:' + '0'.repeat(64);
    equal(PinTransition.verifyTransition(transitionInput(tamperedPin, previousPackage, candidatePackage, 'tampered-pin'), forward).pass, false, 'tampered pin self-digest fails closed');
    const tamperedPackageInput = copy(forwardInput);
    tamperedPackageInput.candidateAnchoredReceipt.receiptDigest = 'sha256:' + '0'.repeat(64);
    equal(PinTransition.verifyTransition(tamperedPackageInput, forward).pass, false, 'tampered candidate v2.2 receipt fails closed');
    const tamperedReceipt = copy(forward);
    tamperedReceipt.classification = 'PIN_MATCH_PRESENTED_ANCHORED_PACKAGE_EXACT_REPLAY';
    equal(PinTransition.verifyTransition(forwardInput, tamperedReceipt).pass, false, 'tampered v2.4 receipt fails closed');
    const unknownFieldInput = copy(forwardInput);
    unknownFieldInput.unexpected = true;
    equal(PinTransition.verifyTransition(unknownFieldInput, forward).pass, false, 'unknown transition input field fails closed');
    const unknownPinField = copy(originalPin);
    unknownPinField.unexpected = true;
    equal(PinTransition.verifyTransition(transitionInput(unknownPinField, previousPackage, candidatePackage, 'unknown-pin-field'), forward).pass, false, 'unknown pin field fails closed');
    const earlyTransition = copy(forwardInput);
    earlyTransition.comparedAt = '2026-08-20T15:00:00.000Z';
    equal(PinTransition.verifyTransition(earlyTransition, forward).pass, false, 'comparison time before anchored verification fails closed');
    const oversizedPin = { schema: PinTransition.PIN_SCHEMA, padding: 'x'.repeat(PinTransition.MAX_PIN_CANONICAL_BYTES + 1) };
    const oversizedPinInput = copy(forwardInput);
    oversizedPinInput.expectedPreviousPin = oversizedPin;
    equal(PinTransition.verifyTransition(oversizedPinInput, forward).pass, false, 'oversized presented pin fails before comparison');
    const oversizedReceipt = { schema: PinTransition.TRANSITION_SCHEMA, padding: 'x'.repeat(PinTransition.MAX_TRANSITION_RECEIPT_CANONICAL_BYTES + 1) };
    equal(PinTransition.verifyTransition(forwardInput, oversizedReceipt).pass, false, 'oversized transition receipt fails before rebuild');

    const publicArtifacts = JSON.stringify({ pin: originalPin, transition: forward });
    equal(publicArtifacts.includes('BEGIN PUBLIC KEY'), false, 'public artifacts contain no raw public key');
    equal(publicArtifacts.includes(previousPackage.anchoredInput.policyAuthorizations[0].signature), false, 'public artifacts contain no raw signature');
    equal(publicArtifacts.includes(ledgerRoot), false, 'public artifacts contain no ledger path');
    equal(publicArtifacts.includes('PRIVATE KEY'), false, 'public artifacts contain no private key material');
    equal(forward.truth.providerInvoked, false, 'receipt claims no provider invocation');
    equal(forward.truth.humanBenefitProven, false, 'receipt claims no human benefit');
    equal(forward.truth.broadLearningClaimed, false, 'receipt claims no held-out learning');
    equal(forward.truth.automaticCanon, false, 'receipt claims no automatic CANON');

    const pinSchema = JSON.parse(fs.readFileSync(path.join(__dirname, 'pin.schema.json'), 'utf8'));
    const transitionSchema = JSON.parse(fs.readFileSync(path.join(__dirname, 'transition.schema.json'), 'utf8'));
    equal(pinSchema.additionalProperties, false, 'pin schema closes unknown top-level fields');
    equal(pinSchema.properties.pinKind.enum, ['GENESIS', 'SUCCESSOR'], 'pin kind schema is closed');
    equal(pinSchema.allOf.length, 2, 'pin schema constrains genesis and successor lineage shapes');
    equal(transitionSchema.additionalProperties, false, 'transition schema closes unknown top-level fields');
    equal(transitionSchema.properties.classification.enum, PinTransition.CLASSIFICATIONS, 'transition schema classification enum matches runtime');
    equal(transitionSchema.properties.pairwiseClassification.enum, Pairwise.CLASSIFICATIONS, 'transition schema preserves exact v2.3 classification enum');
    equal(transitionSchema.$defs.decision.properties.autonomousActionCount.const, 0, 'schema prevents autonomous action');
    equal(transitionSchema.$defs.decision.properties.successorPinAdoptionAuthorized.const, false, 'schema prevents successor adoption authority');
    const contract = JSON.parse(fs.readFileSync(path.join(__dirname, 'module.contract.json'), 'utf8'));
    equal(ContractVerifier.validateContract(contract).pass, true, 'module contract matches Workshop contract shape');
    equal(contract.version, 'v2.4', 'contract version is exact');
    equal(contract.status, 'TEST', 'contract remains TEST');
    equal(contract.lifecycle.installed, false, 'module remains uninstalled');
    equal(contract.lifecycle.promoted, false, 'module remains unpromoted');
    equal(contract.merge_gate, 'Mike Tobi / AXM', 'Mike Tobi remains merge gate');
    equal(contract.provides.filter(value => value.startsWith('model.shadow.portable-history-checkpoint-pin-transition.')).length, 24, 'contract provides exactly twenty-four bounded v2.4 capabilities');
    equal(Array.from(observedClassifications).sort(), PinTransition.CLASSIFICATIONS.slice().sort(), 'focused suite observes every closed v2.4 classification');

    const implementation = fs.readFileSync(path.join(__dirname, 'model-shadow-history-checkpoint-pin-transition.js'), 'utf8');
    check(implementation.includes("require('../model-shadow-history-checkpoint-pairwise/"), 'runtime composes exact v2.3 module');
    check(implementation.includes('Pairwise.buildTransition('), 'runtime rebuilds unchanged v2.3 pairwise receipt');
    check(implementation.includes('Anchor.verifyAnchoredCheckpoint('), 'runtime exact-rebuilds each v2.2 package');
    equal(implementation.includes("require('fs')"), false, 'runtime imports no filesystem');
    equal(implementation.includes('writeFile'), false, 'runtime contains no file-write operation');
    equal(implementation.includes('fetch('), false, 'runtime contains no network fetch');
    equal(implementation.includes('crypto.sign'), false, 'runtime creates no signature');
    equal(implementation.includes('createPrivateKey'), false, 'runtime accepts no private key API');

    console.log('RESULT ' + checks + ' focused assertions passed');
  } finally {
    verifiedRemove(tempRoot, os.tmpdir());
  }
}

main();
