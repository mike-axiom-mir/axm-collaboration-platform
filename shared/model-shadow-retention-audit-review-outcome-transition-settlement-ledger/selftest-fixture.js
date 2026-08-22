'use strict';

const fs = require('fs');
const path = require('path');
const PairwiseFixture = require('../model-shadow-retention-audit-review-outcome-history-checkpoint-anchor-pairwise/selftest-fixture');
const V36 = require('../model-shadow-retention-audit-review-outcome-history-checkpoint-anchor-pairwise-ledger/model-shadow-retention-audit-review-outcome-history-checkpoint-anchor-pairwise-ledger');
const V36Fixture = require('../model-shadow-retention-audit-review-outcome-history-checkpoint-anchor-pairwise-ledger/selftest-fixture');
const Settlement = require('./model-shadow-retention-audit-review-outcome-transition-settlement-ledger');

function copy(value) { return JSON.parse(JSON.stringify(value)); }
function makeDir(parent, name) { const target = path.join(parent, name); fs.mkdirSync(target); return target; }

function buildScenario(tempRoot) {
  const upstream = V36Fixture.buildScenario(tempRoot);
  const sourceARoot = makeDir(tempRoot, 'v37-source-a');
  const sourceBRoot = makeDir(tempRoot, 'v37-source-b');
  const sourceAOptions = V36Fixture.serviceOptions(sourceARoot, upstream, 'v37-source-log');
  const sourceBOptions = V36Fixture.serviceOptions(sourceBRoot, upstream, 'v37-source-log');
  const sourceA = V36.createService(copy(sourceAOptions));
  const sourceB = V36.createService(copy(sourceBOptions));
  const entryAInput = V36Fixture.recordInput(upstream.transitionA, 'v37-source-entry-a', V36.CONFIRMATION);
  const entryBInput = V36Fixture.recordInput(upstream.transitionB, 'v37-source-entry-b', V36.CONFIRMATION);
  const stableFirstRecordingTime = PairwiseFixture.add(upstream.transitionD.input.comparedAt, 60000);
  entryAInput.recordedAt = stableFirstRecordingTime;
  entryBInput.recordedAt = stableFirstRecordingTime;
  const entryA = sourceA.record(copy(entryAInput));
  const entryB = sourceB.record(copy(entryBInput));
  const entryCInput = V36Fixture.recordInput(upstream.transitionC, 'v37-source-entry-c', V36.CONFIRMATION);
  entryCInput.recordedAt = PairwiseFixture.add(stableFirstRecordingTime, 60000);
  return { upstream, sourceARoot, sourceBRoot, sourceAOptions, sourceBOptions, sourceA, sourceB, entryAInput, entryBInput, entryCInput, entryA, entryB };
}

function serviceOptions(stateRoot, sourceServiceOptions, settlementLogId) {
  return { stateRoot, settlementLogId: settlementLogId || 'v37-settlement-log', sourceServiceOptions: copy(sourceServiceOptions) };
}

function proposalInput(sourceRecordInput, sourceEntry, tag, proposedAt, confirmation) {
  return {
    proposalId: 'v37-proposal:' + tag,
    proposedAt: proposedAt || PairwiseFixture.add(sourceEntry.recordedAt, 1000),
    confirmation: confirmation === undefined ? Settlement.PROPOSE_CONFIRMATION : confirmation,
    sourceRecordInput: copy(sourceRecordInput),
    sourceEntry: copy(sourceEntry)
  };
}

function settlementInput(pending, tag, settledAt, confirmation) {
  return {
    settlementId: 'v37-settlement:' + tag,
    settledAt: settledAt || PairwiseFixture.add(pending.result.proposal.proposedAt, 1000),
    confirmation: confirmation === undefined ? Settlement.SETTLE_CONFIRMATION : confirmation,
    proposalInput: copy(pending.input),
    proposalEvidence: copy(pending.result.prewriteEvidence),
    proposalReceipt: copy(pending.result.proposal)
  };
}

module.exports = { copy, makeDir, buildScenario, serviceOptions, proposalInput, settlementInput };
