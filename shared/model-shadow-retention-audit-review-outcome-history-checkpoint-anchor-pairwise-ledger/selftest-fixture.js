'use strict';

const fs = require('fs');
const path = require('path');
const OutcomeLedger = require('../model-shadow-retention-audit-review-outcome-ledger/model-shadow-retention-audit-review-outcome-ledger');
const OutcomeFixture = require('../model-shadow-retention-audit-review-outcome-ledger/selftest-fixture');
const History = require('../model-shadow-retention-audit-review-outcome-history-checkpoint/model-shadow-retention-audit-review-outcome-history-checkpoint');
const Pairwise = require('../model-shadow-retention-audit-review-outcome-history-checkpoint-anchor-pairwise/model-shadow-retention-audit-review-outcome-history-checkpoint-anchor-pairwise');
const PairwiseFixture = require('../model-shadow-retention-audit-review-outcome-history-checkpoint-anchor-pairwise/selftest-fixture');

function copy(value) { return JSON.parse(JSON.stringify(value)); }
function makeDir(parent, name) { const target = path.join(parent, name); fs.mkdirSync(target); return target; }
function anchoredRef(item) {
  return { id: item.anchoredReceipt.receiptId, schema: item.anchoredReceipt.schema, sha256: item.anchoredReceipt.receiptDigest };
}
function checkpointRef(item) { return copy(item.anchoredReceipt.checkpointRef); }
function makeTransition(previous, candidate, tag) {
  const input = PairwiseFixture.transitionInput(previous, candidate, tag);
  const receipt = Pairwise.buildTransition(input);
  if (receipt.classification !== 'CANDIDATE_EXTENDS_PRESENTED_ANCHORED_HISTORY') throw new Error('fixture transition is not forward: ' + receipt.classification);
  return { input, receipt };
}
function addRecord(service, parent, state, tag, afterTime) {
  const item = OutcomeFixture.outcomeFixture(parent, state, tag);
  const recordedAt = OutcomeFixture.laterThan([afterTime, item.outcome.observedAt], 60000);
  service.capture(OutcomeFixture.captureInput(item, 'v36-record:' + tag, recordedAt));
  return { item, recordedAt };
}

function buildScenario(tempRoot) {
  const baseItem = OutcomeFixture.outcomeFixture(tempRoot, 'APPROVED', 'v36-base');
  const baseRoot = makeDir(tempRoot, 'base-source-ledger');
  const baseOptions = OutcomeFixture.serviceOptions(baseRoot, 'v36-review-outcome-ledger', '2020-01-01T00:00:00.000Z');
  const baseService = OutcomeLedger.createService(copy(baseOptions));
  const baseRecordedAt = OutcomeFixture.after(baseItem.outcome.observedAt);
  baseService.capture(OutcomeFixture.captureInput(baseItem, 'v36-record:base', baseRecordedAt));
  const baseCheckpointTime = OutcomeFixture.after(baseRecordedAt, 60000);
  const baseCheckpoint = History.createCheckpoint({ checkpointId: 'v36-checkpoint:base', checkpointedAt: baseCheckpointTime, serviceOptions: copy(baseOptions) });

  const forkARoot = path.join(tempRoot, 'fork-a-source-ledger');
  const forkBRoot = path.join(tempRoot, 'fork-b-source-ledger');
  fs.cpSync(baseRoot, forkARoot, { recursive: true });
  fs.cpSync(baseRoot, forkBRoot, { recursive: true });
  const forkAOptions = OutcomeFixture.serviceOptions(forkARoot, baseOptions.ledgerId, baseOptions.createdAt);
  const forkBOptions = OutcomeFixture.serviceOptions(forkBRoot, baseOptions.ledgerId, baseOptions.createdAt);
  const forkARecord = addRecord(OutcomeLedger.createService(copy(forkAOptions)), tempRoot, 'HOLD', 'fork-a', baseCheckpointTime);
  const forkACheckpointTime = OutcomeFixture.after(forkARecord.recordedAt, 60000);
  const forkACheckpoint = History.createCheckpoint({ checkpointId: 'v36-checkpoint:fork-a', checkpointedAt: forkACheckpointTime, serviceOptions: copy(forkAOptions) });
  const forkBRecord = addRecord(OutcomeLedger.createService(copy(forkBOptions)), tempRoot, 'REJECTED', 'fork-b', forkACheckpointTime);
  const forkBCheckpointTime = OutcomeFixture.after(forkBRecord.recordedAt, 60000);
  const forkBCheckpoint = History.createCheckpoint({ checkpointId: 'v36-checkpoint:fork-b', checkpointedAt: forkBCheckpointTime, serviceOptions: copy(forkBOptions) });

  const nextCRoot = path.join(tempRoot, 'next-c-source-ledger');
  const nextDRoot = path.join(tempRoot, 'next-d-source-ledger');
  fs.cpSync(forkARoot, nextCRoot, { recursive: true });
  fs.cpSync(forkARoot, nextDRoot, { recursive: true });
  const nextCOptions = OutcomeFixture.serviceOptions(nextCRoot, baseOptions.ledgerId, baseOptions.createdAt);
  const nextDOptions = OutcomeFixture.serviceOptions(nextDRoot, baseOptions.ledgerId, baseOptions.createdAt);
  const nextCRecord = addRecord(OutcomeLedger.createService(copy(nextCOptions)), tempRoot, 'APPROVED', 'next-c', forkBCheckpointTime);
  const nextCCheckpointTime = OutcomeFixture.after(nextCRecord.recordedAt, 60000);
  const nextCCheckpoint = History.createCheckpoint({ checkpointId: 'v36-checkpoint:next-c', checkpointedAt: nextCCheckpointTime, serviceOptions: copy(nextCOptions) });
  const nextDRecord = addRecord(OutcomeLedger.createService(copy(nextDOptions)), tempRoot, 'REJECTED', 'next-d', nextCCheckpointTime);
  const nextDCheckpointTime = OutcomeFixture.after(nextDRecord.recordedAt, 60000);
  const nextDCheckpoint = History.createCheckpoint({ checkpointId: 'v36-checkpoint:next-d', checkpointedAt: nextDCheckpointTime, serviceOptions: copy(nextDOptions) });

  const authority = PairwiseFixture.createAuthority('v36-stable');
  const basePackage = PairwiseFixture.buildPackage(baseCheckpoint, 'v36-base', authority, { anchorEpoch: 1 });
  const forkAPackage = PairwiseFixture.buildPackage(forkACheckpoint, 'v36-fork-a', authority, { anchorEpoch: 2 });
  const forkBPackage = PairwiseFixture.buildPackage(forkBCheckpoint, 'v36-fork-b', authority, { anchorEpoch: 2 });
  const nextCPackage = PairwiseFixture.buildPackage(nextCCheckpoint, 'v36-next-c', authority, { anchorEpoch: 3 });
  const nextDPackage = PairwiseFixture.buildPackage(nextDCheckpoint, 'v36-next-d', authority, { anchorEpoch: 3 });
  const transitionA = makeTransition(basePackage, forkAPackage, 'v36-forward-a');
  const transitionB = makeTransition(basePackage, forkBPackage, 'v36-forward-b');
  const transitionC = makeTransition(forkAPackage, nextCPackage, 'v36-forward-c');
  const transitionD = makeTransition(forkAPackage, nextDPackage, 'v36-forward-d');

  return {
    sourceRoots: { baseRoot, forkARoot, forkBRoot, nextCRoot, nextDRoot },
    authority,
    basePackage,
    forkAPackage,
    forkBPackage,
    nextCPackage,
    nextDPackage,
    transitionA,
    transitionB,
    transitionC,
    transitionD,
    genesis: {
      anchoredCheckpointRef: anchoredRef(basePackage),
      checkpointRef: checkpointRef(basePackage),
      anchorEpoch: 1
    }
  };
}

function serviceOptions(stateRoot, scenario, logId) {
  return {
    stateRoot,
    logId: logId || 'v36-anchored-pairwise-ledger',
    genesisAnchoredCheckpointRef: copy(scenario.genesis.anchoredCheckpointRef),
    genesisCheckpointRef: copy(scenario.genesis.checkpointRef),
    genesisAnchorEpoch: scenario.genesis.anchorEpoch
  };
}

function recordInput(transition, tag, confirmation) {
  return {
    entryId: 'v36-ledger-entry:' + tag,
    recordedAt: PairwiseFixture.add(transition.input.comparedAt, 1000),
    confirmation,
    transitionInput: copy(transition.input),
    transitionReceipt: copy(transition.receipt)
  };
}

module.exports = { copy, makeDir, anchoredRef, checkpointRef, buildScenario, serviceOptions, recordInput };
