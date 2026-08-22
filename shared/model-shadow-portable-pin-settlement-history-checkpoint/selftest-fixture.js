'use strict';

const fs = require('fs');
const path = require('path');
const Ledger = require('../model-shadow-history-checkpoint-pin-settlement-ledger/model-shadow-history-checkpoint-pin-settlement-ledger');
const V25Fixture = require('../model-shadow-history-checkpoint-pin-settlement-ledger/selftest-fixture');

function copy(value) { return JSON.parse(JSON.stringify(value)); }
function makeDir(parent, name) { const result = path.join(parent, name); fs.mkdirSync(result); return result; }
function options(root, fixture, logId) { return V25Fixture.serviceOptions(root, logId, fixture.genesisPinInput, fixture.genesisPin); }
function proposalInput(fixture, branch, tag, proposedAt) {
  return V25Fixture.proposalInput(fixture['transition' + branch + 'Input'], fixture['transition' + branch], tag, proposedAt);
}
function compactRecord(proposalInputValue, proposalReceipt, settlementInputValue, settlementReceipt) {
  return {
    proposal: { input: copy(proposalInputValue), receipt: copy(proposalReceipt) },
    settlement: settlementInputValue === null ? null : {
      settlementId: settlementInputValue.settlementId,
      settledAt: settlementInputValue.settledAt,
      confirmation: settlementInputValue.confirmation,
      receipt: copy(settlementReceipt)
    }
  };
}
function buildPending(parent, fixture, name, branch, logId, tag) {
  const root = makeDir(parent, name);
  const serviceOptions = options(root, fixture, logId);
  const service = Ledger.createService(copy(serviceOptions));
  const pInput = proposalInput(fixture, branch, tag);
  const proposal = service.propose(copy(pInput));
  return { root, serviceOptions, service, proposalInput: pInput, proposal, record: compactRecord(pInput, proposal, null, null) };
}
function settle(pending, tag, settledAt) {
  const input = V25Fixture.settlementInput(pending.proposalInput, pending.proposal, tag, settledAt);
  const receipt = pending.service.settle(copy(input));
  return { input, receipt, record: compactRecord(pending.proposalInput, pending.proposal, input, receipt) };
}
function checkpointInput(id, checkpointedAt, serviceOptions, records) {
  return { checkpointId: id, checkpointedAt, serviceOptions: copy(serviceOptions), records: copy(records) };
}
function auditInput(id, auditedAt, checkpoint, serviceOptions, records) {
  return { auditId: id, auditedAt, checkpoint: copy(checkpoint), current: { serviceOptions: copy(serviceOptions), records: copy(records) } };
}
function build(parent) {
  const sourceRoot = makeDir(parent, 'v25-source-fixture');
  return V25Fixture.build(sourceRoot);
}

module.exports = { copy, makeDir, options, proposalInput, compactRecord, buildPending, settle, checkpointInput, auditInput, build };
