'use strict';

const fs = require('fs');
const path = require('path');
const Outcome = require('../model-shadow-retention-audit-review-outcome/model-shadow-retention-audit-review-outcome');
const OutcomeFixture = require('../model-shadow-retention-audit-review-outcome/selftest-fixture');
const Ledger = require('./model-shadow-retention-audit-review-outcome-ledger');

function copy(value) { return JSON.parse(JSON.stringify(value)); }
function makeDir(parent, name) { const target = path.join(parent, name); fs.mkdirSync(target); return target; }
function after(value, milliseconds) { return new Date(Date.parse(value) + (milliseconds || 1000)).toISOString(); }
function laterThan(values, milliseconds) {
  const latest = Math.max(...values.map(value => Date.parse(value)));
  return new Date(latest + (milliseconds || 1000)).toISOString();
}
function serviceOptions(stateRoot, ledgerId, createdAt) {
  return { stateRoot, ledgerId: ledgerId || 'v32-review-outcome-ledger', createdAt: createdAt || '2020-01-01T00:00:00.000Z' };
}
function outcomeFixture(parent, state, tag) {
  const builder = { APPROVED: OutcomeFixture.approved, HOLD: OutcomeFixture.held, REJECTED: OutcomeFixture.rejected }[state];
  if (!builder) throw new Error('unsupported fixture state');
  const fixture = builder(parent, tag);
  return { fixture, outcome: Outcome.buildOutcome(copy(fixture.input)) };
}
function captureInput(item, recordId, recordedAt) {
  return {
    recordId,
    recordedAt,
    confirmation: Ledger.CAPTURE_CONFIRMATION,
    outcomeInput: copy(item.fixture.input),
    outcome: copy(item.outcome)
  };
}

module.exports = { copy, makeDir, after, laterThan, serviceOptions, outcomeFixture, captureInput };
