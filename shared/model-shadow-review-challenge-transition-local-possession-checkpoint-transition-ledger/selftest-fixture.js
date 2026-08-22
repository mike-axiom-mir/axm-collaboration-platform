'use strict';

const fs = require('fs');
const path = require('path');
const Possession = require('../model-shadow-review-challenge-transition-local-possession-challenge/model-shadow-review-challenge-transition-local-possession-challenge');
const Continuity = require('../model-shadow-review-challenge-transition-local-possession-continuity/model-shadow-review-challenge-transition-local-possession-continuity');
const StateFixture = require('../model-shadow-review-challenge-transition-local-possession-continuity/selftest-fixture');
const Pairwise = require('../model-shadow-review-challenge-transition-local-possession-checkpoint-pairwise-transition/model-shadow-review-challenge-transition-local-possession-checkpoint-pairwise-transition');
const PairwiseFixture = require('../model-shadow-review-challenge-transition-local-possession-checkpoint-pairwise-transition/selftest-fixture');
const Ledger = require('./model-shadow-review-challenge-transition-local-possession-checkpoint-transition-ledger');

function copy(value) { return JSON.parse(JSON.stringify(value)); }

function separatedRef(chain) {
  return { id: chain.separationReceipt.receiptId, schema: chain.separationReceipt.schema, sha256: chain.separationReceipt.receiptDigest };
}

function checkpoint(snapshot, id, anchoredAt) {
  return Continuity.buildCheckpoint({ checkpointId: id, anchoredAt, currentSnapshot: copy(snapshot) });
}

function serviceOptions(state, stateRoot, ledgerRoot, logId, genesisRef) {
  return {
    stateRoot: ledgerRoot,
    sourceStateRoot: stateRoot,
    logId,
    genesisSeparatedWitnessRef: copy(genesisRef),
    receiverId: state.possession.receiverOptions.receiverId,
    challengerId: state.possession.receiverOptions.challengerId,
    challengerPublicKeyPem: state.possession.receiverOptions.challengerPublicKeyPem,
    receiverPolicy: copy(state.possession.receiver.policy)
  };
}

function recordInput(transitionInput, transitionReceipt, tag, times) {
  const t = times || {};
  return {
    entryId: 'local-possession-transition-ledger-entry:' + tag,
    recordedAt: t.recordedAt || '2026-08-20T15:34:00.000Z',
    confirmation: Ledger.CONFIRMATION,
    transitionInput: copy(transitionInput),
    transitionReceipt: copy(transitionReceipt),
    observationId: 'local-possession-transition-ledger-observation:' + tag,
    observedAt: t.observedAt || '2026-08-20T15:33:00.000Z',
    auditId: 'local-possession-transition-ledger-audit:' + tag,
    checkedAt: t.checkedAt || '2026-08-20T15:33:30.000Z'
  };
}

function buildScenario(tempRoot) {
  const fixtureRoot = path.join(tempRoot, 'source-base');
  fs.mkdirSync(fixtureRoot);
  const state = StateFixture.buildFixture(fixtureRoot);
  const sourceRoot = state.possession.receiverOptions.stateRoot;
  const baseSnapshot = Continuity.captureState(copy(state.continuityOptions));
  const baseCheckpoint = checkpoint(baseSnapshot, 'local-possession-checkpoint:transition-ledger-base', '2026-08-20T15:22:30.000Z');
  const authority = PairwiseFixture.createAuthority('transition-ledger-stable');
  const baseChain = PairwiseFixture.buildSeparatedChain(baseCheckpoint, 'transition-ledger-base', authority, { minute: 23 });

  const secondChallenge = StateFixture.issueChallenge(state, 0x52, {
    issuedAt: '2026-08-20T15:26:00.000Z',
    expiresAt: '2026-08-20T15:46:00.000Z'
  });
  const second = StateFixture.answer(state, secondChallenge, '2026-08-20T15:26:30.000Z');
  const secondSnapshot = Continuity.captureState(StateFixture.observationOptions(state, 'local-possession-observation:transition-ledger-second', '2026-08-20T15:27:00.000Z'));
  const secondCheckpoint = checkpoint(secondSnapshot, 'local-possession-checkpoint:transition-ledger-second', '2026-08-20T15:27:30.000Z');
  const secondChain = PairwiseFixture.buildSeparatedChain(secondCheckpoint, 'transition-ledger-second', authority, { minute: 28 });
  const firstTransitionInput = PairwiseFixture.transitionInput(baseChain, secondChain, 'transition-ledger-first', '2026-08-20T15:31:00.000Z');
  const firstTransitionReceipt = Pairwise.buildTransition(firstTransitionInput);

  const answersDir = path.join(sourceRoot, Possession.NAMESPACE, Possession.ANSWERS_DIRECTORY);
  return {
    state,
    sourceRoot,
    answersDir,
    authority,
    baseSnapshot,
    baseCheckpoint,
    baseChain,
    secondChallenge,
    second,
    secondSnapshot,
    secondCheckpoint,
    secondChain,
    firstTransitionInput,
    firstTransitionReceipt
  };
}

module.exports = {
  copy,
  separatedRef,
  checkpoint,
  serviceOptions,
  recordInput,
  buildScenario
};
