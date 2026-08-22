'use strict';

const fs = require('fs');
const path = require('path');
const Continuity = require('../model-shadow-review-challenge-transition-local-possession-continuity/model-shadow-review-challenge-transition-local-possession-continuity');
const StateFixture = require('../model-shadow-review-challenge-transition-local-possession-continuity/selftest-fixture');
const LegacyPairwise = require('../model-shadow-review-challenge-transition-local-possession-checkpoint-pairwise-transition/model-shadow-review-challenge-transition-local-possession-checkpoint-pairwise-transition');
const LegacyPairwiseFixture = require('../model-shadow-review-challenge-transition-local-possession-checkpoint-pairwise-transition/selftest-fixture');
const Ledger = require('../model-shadow-review-challenge-transition-local-possession-checkpoint-two-phase-settlement-ledger/model-shadow-review-challenge-transition-local-possession-checkpoint-two-phase-settlement-ledger');
const LedgerFixture = require('../model-shadow-review-challenge-transition-local-possession-checkpoint-two-phase-settlement-ledger/selftest-fixture');
const History = require('../model-shadow-two-phase-history-checkpoint/model-shadow-two-phase-history-checkpoint');
const PairwiseFixture = require('../model-shadow-history-checkpoint-pairwise/selftest-fixture');
const PinTransition = require('../model-shadow-history-checkpoint-pin-transition/model-shadow-history-checkpoint-pin-transition');

function copy(value) { return JSON.parse(JSON.stringify(value)); }
function makeDir(parent, name) { const result = path.join(parent, name); fs.mkdirSync(result); return result; }
function recordPackage(proposalInput, proposalResult, settlementInput, settlementResult) {
  return {
    proposal: { input: copy(proposalInput), evidence: copy(proposalResult.prewriteEvidence), receipt: copy(proposalResult.proposal) },
    settlement: { input: copy(settlementInput), evidence: copy(settlementResult.postwriteEvidence), receipt: copy(settlementResult.settlement) }
  };
}
function checkpointInput(id, checkpointedAt, options, records) { return { checkpointId: id, checkpointedAt, serviceOptions: copy(options), records: copy(records) }; }
function pinTransitionInput(pin, previous, candidate, tag, comparedAt) {
  return {
    transitionId: 'history-checkpoint-pin-transition:v25:' + tag,
    comparedAt: comparedAt || '2026-08-20T16:30:00.000Z',
    successorPinId: 'history-checkpoint-pin:v25:' + tag + ':successor',
    expectedPreviousPin: copy(pin),
    previousAnchoredInput: copy(previous.anchoredInput),
    previousAnchoredReceipt: copy(previous.anchoredReceipt),
    candidateAnchoredInput: copy(candidate.anchoredInput),
    candidateAnchoredReceipt: copy(candidate.anchoredReceipt)
  };
}
function proposalInput(transitionInput, transitionReceipt, tag, proposedAt) {
  return {
    proposalId: 'pin-settlement-proposal:' + tag,
    proposedAt: proposedAt || '2026-08-20T16:32:00.000Z',
    confirmation: 'PROPOSE_LOCAL_PIN_SETTLEMENT_REVIEW_REQUIRED',
    transitionInput: copy(transitionInput),
    transitionReceipt: copy(transitionReceipt)
  };
}
function settlementInput(proposalInputValue, proposalReceipt, tag, settledAt) {
  return {
    settlementId: 'pin-settlement:' + tag,
    settledAt: settledAt || '2026-08-20T16:33:00.000Z',
    confirmation: 'SETTLE_LOCAL_PIN_SETTLEMENT_DECLARED_UNAUTHENTICATED',
    proposalInput: copy(proposalInputValue),
    proposalReceipt: copy(proposalReceipt)
  };
}
function serviceOptions(stateRoot, logId, genesisPinInput, genesisPin) {
  return {
    stateRoot,
    logId,
    createdAt: '2026-08-20T16:31:00.000Z',
    genesisPinInput: copy(genesisPinInput),
    genesisPin: copy(genesisPin)
  };
}

function build(tempRoot) {
  const scenario = LedgerFixture.buildScenario(tempRoot);
  const baseLedgerRoot = makeDir(tempRoot, 'fixture-base-ledger');
  const genesisRef = LedgerFixture.separatedRef(scenario.baseChain);
  const options = LedgerFixture.serviceOptions(scenario.state, scenario.sourceRoot, baseLedgerRoot, 'v25-pin-settlement-source-ledger', genesisRef);
  const service = Ledger.createService(copy(options));
  const firstProposalInput = LedgerFixture.proposalInput(scenario.firstTransitionInput, scenario.firstTransitionReceipt, 'v25-first');
  const firstProposal = service.propose(firstProposalInput);
  const firstSettlementInput = LedgerFixture.settlementInput(firstProposalInput, firstProposal, 'v25-first');
  const firstSettlement = service.settle(firstSettlementInput);
  const firstRecord = recordPackage(firstProposalInput, firstProposal, firstSettlementInput, firstSettlement);
  const previousCheckpoint = History.createCheckpoint(checkpointInput('history-checkpoint:v25-previous', '2026-08-20T15:36:00.000Z', options, [firstRecord]));

  const forkARoot = path.join(tempRoot, 'fixture-fork-a-ledger');
  const forkBRoot = path.join(tempRoot, 'fixture-fork-b-ledger');
  fs.cpSync(baseLedgerRoot, forkARoot, { recursive: true });
  fs.cpSync(baseLedgerRoot, forkBRoot, { recursive: true });
  const thirdChallenge = StateFixture.issueChallenge(scenario.state, 0x65, { issuedAt: '2026-08-20T15:37:00.000Z', expiresAt: '2026-08-20T15:55:00.000Z' });
  StateFixture.answer(scenario.state, thirdChallenge, '2026-08-20T15:37:20.000Z');
  const thirdSnapshot = Continuity.captureState(StateFixture.observationOptions(scenario.state, 'local-possession-observation:v25-third', '2026-08-20T15:37:30.000Z'));
  const thirdCheckpoint = LedgerFixture.checkpoint(thirdSnapshot, 'local-possession-checkpoint:v25-third', '2026-08-20T15:37:40.000Z');
  const thirdChain = LegacyPairwiseFixture.buildSeparatedChain(thirdCheckpoint, 'v25-third', scenario.authority, { minute: 38 });
  const secondTransitionInput = LegacyPairwiseFixture.transitionInput(scenario.secondChain, thirdChain, 'v25-second', '2026-08-20T15:41:00.000Z');
  const secondTransitionReceipt = LegacyPairwise.buildTransition(secondTransitionInput);

  function buildFork(root, tag, times, checkpointedAt) {
    const forkOptions = Object.assign(copy(options), { stateRoot: root });
    const forkService = Ledger.createService(copy(forkOptions));
    const pInput = LedgerFixture.proposalInput(secondTransitionInput, secondTransitionReceipt, tag, times.proposal);
    const p = forkService.propose(pInput);
    const sInput = LedgerFixture.settlementInput(pInput, p, tag, times.settlement);
    const s = forkService.settle(sInput);
    const record = recordPackage(pInput, p, sInput, s);
    return History.createCheckpoint(checkpointInput('history-checkpoint:' + tag, checkpointedAt, forkOptions, [firstRecord, record]));
  }
  const forkACheckpoint = buildFork(forkARoot, 'v25-fork-a', {
    proposal: { observedAt: '2026-08-20T15:42:00.000Z', checkedAt: '2026-08-20T15:42:10.000Z', proposedAt: '2026-08-20T15:42:20.000Z' },
    settlement: { observedAt: '2026-08-20T15:42:30.000Z', checkedAt: '2026-08-20T15:42:40.000Z', settledAt: '2026-08-20T15:43:00.000Z' }
  }, '2026-08-20T15:44:00.000Z');
  const forkBCheckpoint = buildFork(forkBRoot, 'v25-fork-b', {
    proposal: { observedAt: '2026-08-20T15:42:05.000Z', checkedAt: '2026-08-20T15:42:15.000Z', proposedAt: '2026-08-20T15:42:25.000Z' },
    settlement: { observedAt: '2026-08-20T15:42:35.000Z', checkedAt: '2026-08-20T15:42:45.000Z', settledAt: '2026-08-20T15:43:05.000Z' }
  }, '2026-08-20T15:45:00.000Z');

  const authority = PairwiseFixture.createAuthority('v25-stable');
  const previousPackage = PairwiseFixture.buildAnchoredPackage(previousCheckpoint, 'v25-previous', authority, 37);
  const forkAPackage = PairwiseFixture.buildAnchoredPackage(forkACheckpoint, 'v25-fork-a', authority, 46);
  const forkBPackage = PairwiseFixture.buildAnchoredPackage(forkBCheckpoint, 'v25-fork-b', authority, 47);
  const genesisPinInput = { pinId: 'history-checkpoint-pin:v25-genesis', pinnedAt: '2026-08-20T16:00:00.000Z', anchoredInput: copy(previousPackage.anchoredInput), anchoredReceipt: copy(previousPackage.anchoredReceipt) };
  const genesisPin = PinTransition.buildGenesisPin(genesisPinInput);
  const transitionAInput = pinTransitionInput(genesisPin, previousPackage, forkAPackage, 'fork-a');
  const transitionA = PinTransition.buildTransition(transitionAInput);
  const transitionBInput = pinTransitionInput(genesisPin, previousPackage, forkBPackage, 'fork-b');
  const transitionB = PinTransition.buildTransition(transitionBInput);
  const replayInput = pinTransitionInput(genesisPin, previousPackage, previousPackage, 'replay');
  const replay = PinTransition.buildTransition(replayInput);

  return { previousPackage, forkAPackage, forkBPackage, genesisPinInput, genesisPin, transitionAInput, transitionA, transitionBInput, transitionB, replayInput, replay };
}

module.exports = { copy, build, pinTransitionInput, proposalInput, settlementInput, serviceOptions };
