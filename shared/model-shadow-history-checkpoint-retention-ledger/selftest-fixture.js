'use strict';

const fs = require('fs');
const path = require('path');
const V26Fixture = require('../model-shadow-portable-pin-settlement-history-checkpoint/selftest-fixture');

function copy(value) { return JSON.parse(JSON.stringify(value)); }
function makeDir(parent, name) { const result = path.join(parent, name); fs.mkdirSync(result); return result; }
function serviceOptions(stateRoot, retentionLogId) {
  return { stateRoot, retentionLogId, createdAt: '2026-08-20T16:31:30.000Z' };
}
function proposalInput(proposalId, proposedAt, checkpointInput, checkpoint) {
  return {
    proposalId,
    proposedAt,
    confirmation: 'PROPOSE_LOCAL_HISTORY_CHECKPOINT_RETENTION_REVIEW_REQUIRED',
    checkpointInput: copy(checkpointInput),
    checkpoint: copy(checkpoint)
  };
}
function settlementInput(settlementId, settledAt, proposalInputValue, proposalReceipt) {
  return {
    settlementId,
    settledAt,
    confirmation: 'SETTLE_LOCAL_HISTORY_CHECKPOINT_RETENTION_DECLARED_UNAUTHENTICATED',
    proposalInput: copy(proposalInputValue),
    proposalReceipt: copy(proposalReceipt)
  };
}
function auditInput(auditId, auditedAt, serviceOptionsValue, records) {
  return { auditId, auditedAt, current: { serviceOptions: copy(serviceOptionsValue), records: copy(records) } };
}
function build(parent) { return V26Fixture.build(parent); }

module.exports = { copy, makeDir, serviceOptions, proposalInput, settlementInput, auditInput, build };
