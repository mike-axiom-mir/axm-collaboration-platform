import test from 'node:test';
import assert from 'node:assert/strict';
import { InputMetrics } from '../src/core/metrics.js';

test('metrics track sequence gaps, RTT, server transit, and reconnects', () => {
  const metrics = new InputMetrics();
  metrics.recordFrame('phone',{sequence:1,serverReceivedAt:100,serverSentAt:103},1000);
  metrics.recordFrame('phone',{sequence:4,serverReceivedAt:110,serverSentAt:115},1100);
  metrics.recordRtt(14);
  metrics.recordRtt(22);
  metrics.recordReconnect();
  const summary = metrics.summary(1200);
  assert.equal(summary.sequenceGaps,2);
  assert.equal(summary.rttMs.latest,22);
  assert.equal(summary.serverTransitMs.max,5);
  assert.equal(summary.reconnects,1);
  assert.match(summary.limitation,/One-way/);
});
