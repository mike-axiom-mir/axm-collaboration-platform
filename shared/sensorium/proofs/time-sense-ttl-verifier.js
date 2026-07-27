'use strict';

const assert = require('assert');
const Time = require('../time-sense-ttl-verifier');
const Runtime = require('../runtime-route');

async function run() {
  const time = Time.create(), liveStamp = time.stamp({ fact: 'live', observedAt: '2026-07-22T12:00:00.000Z', ttlMs: 1000 });
  const live = time.check(liveStamp, { at: '2026-07-22T12:00:00.500Z', decisionTtlMs: 5000 });
  const stale = time.check(liveStamp, { at: '2026-07-22T12:00:02.000Z' });
  const untimed = time.check(null, {});
  const invalid = time.check(time.stamp({ fact: 'bad', observedAt: 'not-a-time', ttlMs: 1000 }), { at: '2026-07-22T12:00:00.000Z' });
  const future = time.check(time.stamp({ fact: 'future', observedAt: '2026-07-22T12:00:10.000Z', ttlMs: 1000 }), { at: '2026-07-22T12:00:00.000Z' });
  assert.equal(live.status, 'LIVE'); assert.equal(live.decision_inherited_ttl_ms, 1000); assert.equal(stale.status, 'STALE'); assert.equal(untimed.status, 'UNTIMED'); assert.equal(invalid.status, 'INVALID_TIMESTAMP'); assert.equal(future.status, 'FUTURE');
  async function use(n) { return Runtime.invoke('time-sense-ttl-verifier', { fact: 'fact', observedAt: '2026-07-22T12:00:00.000Z', ttlMs: 60000, at: '2026-07-22T12:00:01.000Z' }, { claimId: 'claim-time-' + n, seatId: 'seat-test', targetId: 'clock' }); }
  const first = await use(1), second = await use(2);
  return { senseId: 'time-sense-ttl-verifier', verdict: 'PASS', positive: live, negative: [stale, untimed, invalid, future], envelopes: [first.envelope, second.envelope], uses: [0, 0], rawRetainedBytes: 0, rawRetainedItems: 0 };
}

module.exports = { run };
