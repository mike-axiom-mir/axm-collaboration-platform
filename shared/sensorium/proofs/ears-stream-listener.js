'use strict';

const assert = require('assert');
const Ears = require('../ears-stream-listener');
const Runtime = require('../runtime-route');

async function run() {
  const source = [{ type: 'ready', message: 'server ready', emittedAt: '2026-07-22T12:00:00.000Z' }], before = JSON.stringify(source);
  const ears = Ears.create({ maxEvents: 1, maxBytes: 2048, readWindow: async function () { return source.concat([{ type: 'tick', message: 'later', emittedAt: '2026-07-22T12:00:01.000Z' }]); } });
  const expected = await ears.listen({ source: 'test-stream', expectedEvents: ['later'], openedAt: '2026-07-22T12:00:00.000Z', closedAt: '2026-07-22T12:00:02.000Z' });
  assert.equal(expected.verdict, 'PASS'); assert.equal(expected.evicted_events, 1); assert.equal(JSON.stringify(source), before); assert.equal(ears.status().rawRetainedBytes, 0);
  const refuting = await Ears.create({ readWindow: async function () { return [{ type: 'error', message: 'fatal refusal', emittedAt: '2026-07-22T12:00:00.000Z' }]; } }).listen({ expectedEvents: ['ready'], refutingEvents: ['fatal'], openedAt: '2026-07-22T12:00:00.000Z', closedAt: '2026-07-22T12:00:01.000Z' });
  const silence = await Ears.create({ readWindow: async function () { return []; } }).listen({ expectedEvents: ['ready'], openedAt: '2026-07-22T12:00:00.000Z', closedAt: '2026-07-22T12:00:01.000Z' });
  assert.equal(refuting.verdict, 'FAIL'); assert.equal(silence.verdict, 'UNKNOWN'); assert.equal(silence.heard_nothing, true);
  async function use(n) { return Runtime.invoke('ears-stream-listener', { source: 'route-stream', expectedEvents: ['ready'], openedAt: '2026-07-22T12:00:00.000Z', closedAt: '2026-07-22T12:00:02.000Z' }, { claimId: 'claim-ears-' + n, seatId: 'seat-test', targetId: 'route-stream', adapters: { readWindow: async function () { return source; } } }); }
  const first = await use(1), second = await use(2);
  return { senseId: 'ears-stream-listener', verdict: 'PASS', positive: expected, negative: [refuting, silence], envelopes: [first.envelope, second.envelope], uses: [first.envelope.rawRetainedBytesAfterSeal, second.envelope.rawRetainedBytesAfterSeal], rawRetainedBytes: 0, rawRetainedItems: 0 };
}

module.exports = { run };
