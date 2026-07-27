'use strict';

const assert = require('assert');
const Interoception = require('../interoception-capacity-gauge');
const Runtime = require('../runtime-route');

function adapterFor(headroom, returnedSeat) {
  return async function (request) {
    return { seatId: returnedSeat || request.seatId, signals: [{ id: 'context-window', used: 1 - headroom, limit: 1 }, { id: 'held-state', used: 0.25, limit: 1 }] };
  };
}

async function run() {
  const ampleSense = Interoception.create({ readCapacity: adapterFor(0.8) });
  const tighteningSense = Interoception.create({ readCapacity: adapterFor(0.25) });
  const nearSense = Interoception.create({ readCapacity: adapterFor(0.1) });
  const missingSense = Interoception.create();
  const mismatchSense = Interoception.create({ readCapacity: adapterFor(0.8, 'other-seat') });
  const base = { seatId: 'seat-test', observedAt: '2026-07-23T12:00:00.000Z', ttlMs: 60000 };
  const ample = await ampleSense.sense(base);
  const tightening = await tighteningSense.sense(base);
  const near = await nearSense.sense(base);
  const missing = await missingSense.sense(base);
  const mismatch = await mismatchSense.sense(base);
  const invalidTime = await ampleSense.sense({ seatId: 'seat-test', observedAt: 'not-a-time' });
  assert.equal(ample.state, 'AMPLE');
  assert.equal(tightening.state, 'TIGHTENING');
  assert.equal(near.state, 'NEAR_LIMIT');
  assert.equal(near.recommendation, 'seal-handoff-now');
  assert.equal(missing.state, 'UNKNOWN');
  assert.ok(missing.namedSeams.includes('SEAT_CAPACITY_ADAPTER_UNAVAILABLE'));
  assert.equal(mismatch.state, 'UNKNOWN');
  assert.ok(mismatch.namedSeams.includes('OWN_SEAT_IDENTITY_MISMATCH'));
  assert.equal(invalidTime.state, 'UNKNOWN');
  assert.ok(invalidTime.namedSeams.includes('INVALID_CAPACITY_TIMESTAMP'));
  assert.equal(ample.contentInspected, false);
  assert.equal(ample.tookNoDirectAction, true);

  async function use(n) {
    return Runtime.invoke('interoception-capacity-gauge', { seatId: 'seat-test', observedAt: '2026-07-23T12:00:0' + n + '.000Z', ttlMs: 60000 }, { claimId: 'claim-interoception-' + n, seatId: 'seat-test', targetId: 'seat-test', adapters: { readSeatCapacity: adapterFor(0.25) } });
  }
  const first = await use(1), second = await use(2);
  return { senseId: 'interoception-capacity-gauge', verdict: 'PASS', positive: tightening, negative: [missing, mismatch, near, invalidTime], envelopes: [first.envelope, second.envelope], uses: [0, 0], rawRetainedBytes: 0, rawRetainedItems: 0 };
}

module.exports = { run };
