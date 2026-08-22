'use strict';

const fs = require('fs');
const path = require('path');
const V36 = require('../model-shadow-retention-audit-review-outcome-history-checkpoint-anchor-pairwise-ledger/model-shadow-retention-audit-review-outcome-history-checkpoint-anchor-pairwise-ledger');
const V37 = require('../model-shadow-retention-audit-review-outcome-transition-settlement-ledger/model-shadow-retention-audit-review-outcome-transition-settlement-ledger');
const V37Fixture = require('../model-shadow-retention-audit-review-outcome-transition-settlement-ledger/selftest-fixture');
const PairwiseFixture = require('../model-shadow-retention-audit-review-outcome-history-checkpoint-anchor-pairwise/selftest-fixture');

function copy(value) { return JSON.parse(JSON.stringify(value)); }
function makeDir(parent, name) { const target = path.join(parent, name); fs.mkdirSync(target); return target; }
function add(timestamp, milliseconds) { return PairwiseFixture.add(timestamp, milliseconds); }
function settlementNamespace(root) { return path.join(root, V37.NAMESPACE); }
function sourceNamespace(root) { return path.join(root, V36.NAMESPACE); }

function startLane(parent, name, sourceServiceOptions, logId) {
  const stateRoot = makeDir(parent, name);
  const serviceOptions = V37Fixture.serviceOptions(stateRoot, sourceServiceOptions, logId || 'v39-settlement-log:' + name);
  return { stateRoot, serviceOptions, service: V37.createService(copy(serviceOptions)), latestAt: null, latestSide: null };
}

function appendExact(lane, sourceInput, sourceEntry, tag, proposedAt) {
  const proposalInput = V37Fixture.proposalInput(sourceInput, sourceEntry, 'v39-' + tag, proposedAt);
  const proposalResult = lane.service.propose(copy(proposalInput));
  const settlementInput = V37Fixture.settlementInput({ input: proposalInput, result: proposalResult }, 'v39-' + tag);
  const settlementResult = lane.service.settle(copy(settlementInput));
  lane.latestAt = settlementInput.settledAt;
  lane.latestSide = {
    serviceOptions: copy(lane.serviceOptions),
    settlementInput: copy(settlementInput),
    settlementEvidence: copy(settlementResult.prewriteEvidence),
    settlementReceipt: copy(settlementResult.settlement)
  };
  return { proposalInput, proposalResult, settlementInput, settlementResult };
}

function propose(lane, sourceInput, sourceEntry, tag, proposedAt) {
  const input = V37Fixture.proposalInput(sourceInput, sourceEntry, 'v39-' + tag, proposedAt);
  const result = lane.service.propose(copy(input));
  return { input, result };
}

function settlePending(lane, pending, tag) {
  const input = V37Fixture.settlementInput(pending, 'v39-' + tag);
  const result = lane.service.settle(copy(input));
  lane.latestAt = input.settledAt;
  lane.latestSide = {
    serviceOptions: copy(lane.serviceOptions),
    settlementInput: copy(input),
    settlementEvidence: copy(result.prewriteEvidence),
    settlementReceipt: copy(result.settlement)
  };
  return { input, result };
}

function cloneSource(parent, sourceRoot, sourceOptions, name) {
  const root = makeDir(parent, name);
  fs.cpSync(sourceNamespace(sourceRoot), sourceNamespace(root), { recursive: true, errorOnExist: true });
  const options = copy(sourceOptions);
  options.stateRoot = root;
  return { root, options, service: V36.createService(copy(options)) };
}

function cloneSettlement(parent, lane, name) {
  const root = makeDir(parent, name);
  fs.cpSync(settlementNamespace(lane.stateRoot), settlementNamespace(root), { recursive: true, errorOnExist: true });
  const options = copy(lane.serviceOptions);
  options.stateRoot = root;
  return { stateRoot: root, serviceOptions: options, service: V37.createService(copy(options)), latestAt: lane.latestAt, latestSide: copy(lane.latestSide) };
}

function moveNamespaceAway(parent, root, namespaceName, tag) {
  const source = path.join(root, namespaceName);
  const backup = path.join(parent, 'backup-' + tag);
  fs.renameSync(source, backup);
  return backup;
}

function restoreNamespace(root, namespaceName, backup) {
  const target = path.join(root, namespaceName);
  if (fs.existsSync(target)) fs.rmSync(target, { recursive: true });
  fs.renameSync(backup, target);
}

function pairInput(leftOptions, rightOptions, tag, latestAt) {
  return {
    observationId: 'v39-history-observation:' + tag,
    observedAt: add(latestAt, 1000),
    left: { serviceOptions: copy(leftOptions) },
    right: { serviceOptions: copy(rightOptions) }
  };
}

module.exports = {
  copy, makeDir, add, settlementNamespace, sourceNamespace,
  startLane, appendExact, propose, settlePending, cloneSource, cloneSettlement,
  moveNamespaceAway, restoreNamespace, pairInput, buildScenario: V37Fixture.buildScenario
};
