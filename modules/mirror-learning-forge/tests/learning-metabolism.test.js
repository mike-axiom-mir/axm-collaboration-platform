'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { LearningMetabolism } = require('../core/learning-metabolism');

function healthy() {
  return { sampledAt: '2026-07-18T00:00:00.000Z', totalMemoryBytes: 16e9, freeMemoryBytes: 6e9, systemMemoryUsedRatio: 0.625, forgeRssBytes: 80e6, forgeHeapUsedBytes: 20e6 };
}

test('one healthy bounded learning session completes with a body receipt', () => {
  let now = 1000;
  const metabolism = new LearningMetabolism({ sample: healthy, now: () => now });
  const first = metabolism.begin('/api/tracks/structured/grade');
  assert.equal(first.granted, true);
  assert.equal(metabolism.begin('/api/tracks/coding/grade').granted, false);
  now = 1200;
  const receipt = metabolism.finish(first.session.sessionId, 'COMPLETED', 'grade stored');
  assert.equal(receipt.withinTimeBudget, true);
  assert.equal(receipt.outcome, 'COMPLETED');
  assert.equal(metabolism.status().state, 'READY');
});

test('memory pressure holds before any learning session begins', () => {
  const metabolism = new LearningMetabolism({ sample: () => Object.assign(healthy(), { freeMemoryBytes: 1e9, systemMemoryUsedRatio: 0.94 }) });
  const result = metabolism.begin('/api/challengers/train');
  assert.equal(result.granted, false);
  assert(result.reasons.includes('system-memory-pressure'));
  assert(result.reasons.includes('free-memory-reserve-low'));
  assert.equal(metabolism.status().activeSession, null);
});

test('automatic learning requires the exact active Body Pulse lease', () => {
  const metabolism = new LearningMetabolism({ sample: healthy });
  const missing = metabolism.begin('/api/challengers/train', { mode: 'automatic' });
  assert.equal(missing.granted, false);
  assert(missing.reasons.includes('body-pulse-unavailable'));
  const bodyPulseStatus = { mode: 'ACTIVE', body: { pressure: 'GREEN' }, leases: [{ status: 'ACTIVE', leaseId: 'pulse-1', moduleId: 'mirror-learning-forge' }] };
  const granted = metabolism.begin('/api/challengers/train', { mode: 'automatic', leaseId: 'pulse-1', bodyPulseStatus });
  assert.equal(granted.granted, true);
  metabolism.finish(granted.session.sessionId);
});

test('an overrun earns cooldown instead of immediate repeated work', () => {
  let now = 0;
  const metabolism = new LearningMetabolism({ policy: { maxOperationMs: 1000, cooldownAfterOverrunMs: 5000 }, sample: healthy, now: () => now });
  const session = metabolism.begin('/api/challengers/evaluate');
  now = 2000;
  assert.equal(metabolism.finish(session.session.sessionId).withinTimeBudget, false);
  assert(metabolism.begin('/api/challengers/evaluate').reasons.includes('learning-cooldown-active'));
  now = 7000;
  assert.equal(metabolism.begin('/api/challengers/evaluate').granted, true);
});
