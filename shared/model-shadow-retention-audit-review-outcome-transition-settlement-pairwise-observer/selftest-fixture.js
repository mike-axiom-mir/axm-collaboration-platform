'use strict';

const fs = require('fs');
const path = require('path');
const PairwiseFixture = require('../model-shadow-retention-audit-review-outcome-history-checkpoint-anchor-pairwise/selftest-fixture');
const V37 = require('../model-shadow-retention-audit-review-outcome-transition-settlement-ledger/model-shadow-retention-audit-review-outcome-transition-settlement-ledger');
const V37Fixture = require('../model-shadow-retention-audit-review-outcome-transition-settlement-ledger/selftest-fixture');

function copy(value) { return JSON.parse(JSON.stringify(value)); }
function makeDir(parent, name) { const target = path.join(parent, name); fs.mkdirSync(target); return target; }

function settle(stateRoot, sourceOptions, sourceInput, sourceEntry, tag) {
  const options = V37Fixture.serviceOptions(stateRoot, sourceOptions, 'v38-settlement-log:' + tag);
  const service = V37.createService(copy(options));
  const proposalInput = V37Fixture.proposalInput(sourceInput, sourceEntry, 'v38-' + tag);
  const proposalResult = service.propose(copy(proposalInput));
  const settlementInput = V37Fixture.settlementInput({ input: proposalInput, result: proposalResult }, 'v38-' + tag);
  const settlementResult = service.settle(copy(settlementInput));
  return {
    service,
    side: {
      serviceOptions: copy(options),
      settlementInput: copy(settlementInput),
      settlementEvidence: copy(settlementResult.prewriteEvidence),
      settlementReceipt: copy(settlementResult.settlement)
    }
  };
}

function pairInput(left, right, tag, observedAt) {
  const latest = Math.max(Date.parse(left.settlementReceipt.settledAt), Date.parse(right.settlementReceipt.settledAt));
  return {
    observationId: 'v38-observation:' + tag,
    observedAt: observedAt || new Date(latest + 1000).toISOString(),
    left: copy(left),
    right: copy(right)
  };
}

module.exports = { copy, makeDir, settle, pairInput, add: PairwiseFixture.add };
