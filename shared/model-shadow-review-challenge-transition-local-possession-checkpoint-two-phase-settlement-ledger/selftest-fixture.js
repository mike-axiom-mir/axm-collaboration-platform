'use strict';

const LegacyFixture = require('../model-shadow-review-challenge-transition-local-possession-checkpoint-transition-ledger/selftest-fixture');
const Ledger = require('./model-shadow-review-challenge-transition-local-possession-checkpoint-two-phase-settlement-ledger');

function copy(value) { return LegacyFixture.copy(value); }
function buildScenario(tempRoot) { return LegacyFixture.buildScenario(tempRoot); }
function separatedRef(chain) { return LegacyFixture.separatedRef(chain); }
function checkpoint(snapshot, id, anchoredAt) { return LegacyFixture.checkpoint(snapshot, id, anchoredAt); }

function serviceOptions(state, sourceRoot, ledgerRoot, logId, genesisRef) {
  return LegacyFixture.serviceOptions(state, sourceRoot, ledgerRoot, logId, genesisRef);
}

function proposalInput(transitionInput, transitionReceipt, tag, times) {
  const t = times || {};
  return {
    proposalId: 'local-possession-two-phase-proposal:' + tag,
    proposedAt: t.proposedAt || '2026-08-20T15:34:00.000Z',
    confirmation: Ledger.PROPOSE_CONFIRMATION,
    transitionInput: copy(transitionInput),
    transitionReceipt: copy(transitionReceipt),
    observationId: 'local-possession-two-phase-prewrite-observation:' + tag,
    observedAt: t.observedAt || '2026-08-20T15:33:00.000Z',
    auditId: 'local-possession-two-phase-prewrite-audit:' + tag,
    checkedAt: t.checkedAt || '2026-08-20T15:33:30.000Z'
  };
}

function settlementInput(proposalInputValue, proposalResult, tag, times) {
  const t = times || {};
  return {
    settlementId: 'local-possession-two-phase-settlement:' + tag,
    settledAt: t.settledAt || '2026-08-20T15:35:30.000Z',
    confirmation: Ledger.SETTLE_CONFIRMATION,
    proposalInput: copy(proposalInputValue),
    prewriteEvidence: copy(proposalResult.prewriteEvidence),
    proposalReceipt: copy(proposalResult.proposal),
    observationId: 'local-possession-two-phase-postwrite-observation:' + tag,
    observedAt: t.observedAt || '2026-08-20T15:34:30.000Z',
    auditId: 'local-possession-two-phase-postwrite-audit:' + tag,
    checkedAt: t.checkedAt || '2026-08-20T15:35:00.000Z'
  };
}

module.exports = {
  copy,
  buildScenario,
  separatedRef,
  checkpoint,
  serviceOptions,
  proposalInput,
  settlementInput
};
