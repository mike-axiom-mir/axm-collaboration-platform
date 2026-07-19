'use strict';

const assert = require('assert');
const H = require('./test-helpers');
const Ledger = require('../core/resource-ledger');

module.exports = ({ test }) => {
  test('duplicate, reserved and unaffordable spending is atomically refused', 'R2 resource integrity', () => {
    let state = H.Steward.createStarterState('ledger');
    const first = Ledger.reserve(state, { reservationId: 'r1', amounts: { funds: 80 }, zone: 'HOUSING', transactionId: 'tx-r1', cause: 'test', turn: 0, decisionReference: 'd1', receiptReference: 'receipt-test' });
    assert.equal(first.ok, true); state = first.state;
    const before = H.Canonical.stableStringify(state);
    assert.equal(Ledger.reserve(state, { reservationId: 'r2', amounts: { funds: 150 }, zone: 'HOUSING', transactionId: 'tx-r2', cause: 'test', turn: 0 }).ok, false, 'reserved stock must not be spendable');
    assert.equal(Ledger.spendAvailable(state, { amounts: { funds: 150 }, transactionId: 'tx-spend', cause: 'test', turn: 0 }).ok, false);
    assert.equal(Ledger.reserve(state, { reservationId: 'r3', amounts: { funds: 1 }, zone: 'HOUSING', transactionId: 'tx-r1', cause: 'duplicate tx', turn: 0 }).ok, false);
    assert.equal(H.Canonical.stableStringify(state), before);
  });

  test('reservation cannot be committed twice or beyond its remainder', 'R2 resource integrity', () => {
    let state = H.Steward.createStarterState('commit-once');
    state = Ledger.reserve(state, { reservationId: 'r1', amounts: { materials: 10 }, zone: 'HOUSING', transactionId: 'tx-reserve', cause: 'test', turn: 0 }).state;
    const committed = Ledger.commitReservation(state, { reservationId: 'r1', amounts: { materials: 10 }, transactionId: 'tx-commit', cause: 'test', turn: 0 });
    assert.equal(committed.ok, true); state = committed.state;
    const before = H.Canonical.stableStringify(state);
    assert.equal(Ledger.commitReservation(state, { reservationId: 'r1', amounts: { materials: 1 }, transactionId: 'tx-again', cause: 'test', turn: 0 }).ok, false);
    assert.equal(H.Canonical.stableStringify(state), before);
  });

  test('stale concurrent and duplicate decisions are refused without mutation', 'R2 resource integrity', () => {
    const engine = H.Steward.createSteward('stale');
    const baseRevision = engine.observeState({ summary: true }).revision;
    const first = { schema: H.Steward.DECISION_SCHEMA, id: 'decision-concurrent-a', type: 'SET_POLICY', expectedRevision: baseRevision, reason: 'First explicit direction.', payload: { priority: 'HOMES_FIRST' } };
    const second = { schema: H.Steward.DECISION_SCHEMA, id: 'decision-concurrent-b', type: 'SET_POLICY', expectedRevision: baseRevision, reason: 'Second stale direction.', payload: { priority: 'LOCAL_WORK' } };
    assert.equal(engine.applyStewardDecision(first).ok, true);
    const beforeStale = H.Canonical.stableStringify(engine.observeState());
    assert.equal(engine.applyStewardDecision(second).ok, false);
    assert.equal(H.Canonical.stableStringify(engine.observeState()), beforeStale);
    const duplicate = { ...first, expectedRevision: engine.observeState({ summary: true }).revision };
    assert.equal(engine.applyStewardDecision(duplicate).ok, false);
    assert.equal(H.Canonical.stableStringify(engine.observeState()), beforeStale);
  });

  test('population, labor, energy, materials, funds and attention retain distinct units', 'R2 resource integrity', () => {
    const state = H.Steward.createStarterState('units');
    const units = Object.values(state.resources).map(resource => resource.unit);
    assert.equal(new Set(units).size, 6);
    assert.equal(state.policies.constraints.debtAllowed, false);
  });
};
