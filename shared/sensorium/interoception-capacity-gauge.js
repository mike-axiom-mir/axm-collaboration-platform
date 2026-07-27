'use strict';

const C = require('./core');

const CAPABILITY = 'sense.interoception.own-capacity/v1';
const RECEIPT_SCHEMA = 'axm.interoception-record/v1';
const STATES = ['AMPLE', 'TIGHTENING', 'NEAR_LIMIT', 'UNKNOWN'];

function thresholds(policy) {
  policy = policy || {};
  const tightening = Number.isFinite(Number(policy.tighteningHeadroom)) ? Number(policy.tighteningHeadroom) : 0.35;
  const near = Number.isFinite(Number(policy.nearLimitHeadroom)) ? Number(policy.nearLimitHeadroom) : 0.15;
  if (near < 0 || tightening > 1 || near >= tightening) throw new Error('threshold policy must satisfy 0 <= nearLimitHeadroom < tighteningHeadroom <= 1');
  return { tighteningHeadroom: tightening, nearLimitHeadroom: near };
}

function normalizeSignals(reading, maxSignals) {
  const signals = reading && Array.isArray(reading.signals) ? reading.signals.slice(0, maxSignals + 1) : [];
  if (!signals.length) throw new Error('capacity adapter returned no bounded signals');
  if (signals.length > maxSignals) throw new Error('capacity signal budget exceeded');
  return signals.map(function (signal) {
    const id = C.assertExactIdentifier(signal && signal.id, 'capacity signal id');
    const used = Number(signal && signal.used), limit = Number(signal && signal.limit);
    if (!Number.isFinite(used) || used < 0 || !Number.isFinite(limit) || limit <= 0) throw new Error(id + ' must declare finite used >= 0 and limit > 0');
    return { id, headroom: Math.max(0, Math.min(1, 1 - (used / limit))) };
  });
}

function create(options) {
  options = options || {};
  const store = C.createReceiptStore(options.receiptLimit);
  const readCapacity = options.readCapacity;
  const maxSignals = Math.max(1, Math.min(16, Number(options.maxSignals) || 16));

  function seal(details) {
    return store.push(Object.assign({
      schema: RECEIPT_SCHEMA,
      capability: CAPABILITY,
      seatId: null,
      headroomFraction: null,
      state: 'UNKNOWN',
      signalsRead: [],
      observedAt: null,
      ttlMs: 60000,
      recommendation: 'hold-dependent-timing-claim',
      recommendationOnly: true,
      nextCheckDue: null,
      namedSeams: [],
      measurementSource: 'host-adapter',
      contentInspected: false,
      tookNoDirectAction: true,
      rawRetainedBytesAfterSeal: 0,
      rawRetainedItemsAfterSeal: 0,
      cleanupComplete: true
    }, details || {}));
  }

  async function sense(input) {
    input = input || {};
    const seatId = C.assertExactIdentifier(input.seatId, 'seatId');
    const observedAt = C.now(input.observedAt);
    const ttlMs = Math.max(1000, Math.min(600000, Math.round(Number(input.ttlMs) || 60000)));
    if (!Number.isFinite(Date.parse(observedAt))) {
      return seal({ seatId, observedAt: C.now(), ttlMs, namedSeams: ['INVALID_CAPACITY_TIMESTAMP'], recommendation: 'supply a valid observation timestamp' });
    }
    if (typeof readCapacity !== 'function') {
      return seal({
        seatId, observedAt, ttlMs,
        nextCheckDue: new Date(Date.parse(observedAt) + ttlMs).toISOString(),
        namedSeams: ['SEAT_CAPACITY_ADAPTER_UNAVAILABLE']
      });
    }

    let reading;
    try { reading = await readCapacity({ seatId, maxSignals }); }
    catch (error) {
      return seal({
        seatId, observedAt, ttlMs,
        nextCheckDue: new Date(Date.parse(observedAt) + ttlMs).toISOString(),
        namedSeams: ['SEAT_CAPACITY_ADAPTER_ERROR'],
        recommendation: 'hold-dependent-timing-claim; adapter error: ' + C.compact(error && error.message, 120)
      });
    }
    if (!reading || C.compact(reading.seatId, 500) !== seatId) {
      return seal({
        seatId, observedAt, ttlMs,
        nextCheckDue: new Date(Date.parse(observedAt) + ttlMs).toISOString(),
        namedSeams: ['OWN_SEAT_IDENTITY_MISMATCH'],
        recommendation: 'refuse cross-seat capacity reading'
      });
    }

    let signals;
    try { signals = normalizeSignals(reading, maxSignals); }
    catch (error) {
      return seal({
        seatId, observedAt, ttlMs,
        nextCheckDue: new Date(Date.parse(observedAt) + ttlMs).toISOString(),
        namedSeams: ['INVALID_CAPACITY_SIGNAL'],
        recommendation: C.compact(error && error.message, 160)
      });
    }
    const policy = thresholds(input.thresholdPolicy);
    const headroom = Math.min.apply(null, signals.map(function (signal) { return signal.headroom; }));
    const state = headroom <= policy.nearLimitHeadroom ? 'NEAR_LIMIT' : (headroom <= policy.tighteningHeadroom ? 'TIGHTENING' : 'AMPLE');
    const recommendation = state === 'NEAR_LIMIT' ? 'seal-handoff-now' : (state === 'TIGHTENING' ? 'compact-soon' : 'continue');
    return seal({
      seatId,
      headroomFraction: Number(headroom.toFixed(6)),
      state,
      signalsRead: signals.map(function (signal) { return signal.id; }),
      observedAt,
      ttlMs,
      recommendation,
      nextCheckDue: new Date(Date.parse(observedAt) + ttlMs).toISOString()
    });
  }

  return {
    capability: CAPABILITY,
    sense,
    receipts: store.list,
    status: function () { return C.status(store, { capacityAdapterAvailable: typeof readCapacity === 'function' }); }
  };
}

module.exports = { CAPABILITY, RECEIPT_SCHEMA, STATES, create, thresholds, normalizeSignals };
