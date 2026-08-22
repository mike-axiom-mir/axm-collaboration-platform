'use strict';

const assert = require('node:assert/strict');
const recorderCore = require('../runtime/performance-recorder');

let now = 0;
let wall = Date.UTC(2026, 6, 28, 8, 0, 0);
const session = recorderCore.createSession({
  sessionId: 'held-out-target-session',
  requestedDurationMs: 1800000,
  now: () => now,
  wallNow: () => wall,
  target: {
    label: 'WORKSHOP DISPLAY A',
    viewportWidth: 1920,
    viewportHeight: 1080,
    devicePixelRatio: 1.5,
    reducedMotion: false,
    hardwareConcurrency: 8,
    deviceMemoryGb: 16,
    longTaskObserver: true,
    jsHeapApi: true,
    batteryApi: true,
    userAgent: 'must-not-survive'
  }
});

assert.equal(recorderCore.SCHEMA, 'axm.target-session-performance/v1');
assert.equal(session.start(), true);
assert.equal(session.start(), false, 'a running recorder cannot be restarted');

for (let index = 0; index < 108000; index += 1) {
  const delta = index % 100 === 0 ? 52 : (index % 20 === 0 ? 24 : 16.2);
  now += delta;
  session.recordFrame(delta);
  if (index % 60 === 0) {
    const phaseCounter = index % 1800;
    session.recordDiagnostics({
      averageRenderMs: 1.4 + (index % 5) * .1,
      uiUpdateAverageMs: .55,
      schedulingWaitMs: 14.8,
      authorityPacketMs: 90.5,
      interpolationFrames: phaseCounter,
      poseSnapFrames: index % 3600 === 0 ? 1 : 0,
      workload: index < 54000 ? 'race:null-foundry:redline-gauntlet:racing' : 'battle:mirror-core:mirror-core:racing'
    });
  }
  if (index % 300 === 0) {
    session.recordServerTelemetry({
      ok: true,
      tickMs: { average: 1.15, p95: 2.2 },
      transport: {
        clientReportedRoundTripMs: { p95: 11.5 },
        actionReceipts: { p95: .8 }
      }
    });
    session.recordMemory(80 * 1024 * 1024 + index * 64);
  }
  if (index % 9000 === 0) session.recordLongTask(62);
}

session.recordBattery(.82, false);
session.recordBattery(.69, false);
session.increment('visibilityInterruptions', 'visibility-hidden');
session.increment('focusInterruptions', 'window-blur');
session.increment('offlineEvents', 'network-offline');
session.increment('reconnects', 'authority-restored');
for (let index = 0; index < 150; index += 1) session.markEvent('bounded-event', { index, secret: { nested: 'discarded' } });

now = 1800000;
const receipt = session.stop('duration-complete');

assert.equal(receipt.schema, recorderCore.SCHEMA);
assert.equal(receipt.status, 'complete');
assert.equal(receipt.thirtyMinuteGateEligible, true);
assert.equal(receipt.durationClass, 'thirty-minute-target-gate');
assert.equal(receipt.requestedDurationMs, 1800000);
assert.equal(receipt.elapsedMs, 1800000);
assert.equal(receipt.frameMs.samples, 108000);
assert.equal(receipt.frameMs.p95, 16.5);
assert.equal(receipt.frameMs.over50Rate, 1);
assert.equal(receipt.frameMs.stallsOver250, 0);
assert.ok(receipt.renderMs.p95 <= 1.9);
assert.ok(receipt.serverTickP95Ms.p95 <= 2.25);
assert.equal(receipt.longTasks.count, 12);
assert.equal(receipt.longTasks.supported, true);
assert.ok(receipt.memory.deltaBytes > 0);
assert.equal(receipt.battery.levelDelta, -.13);
assert.equal(receipt.interruptions.visibility, 1);
assert.equal(receipt.interruptions.focus, 1);
assert.equal(receipt.interruptions.offline, 1);
assert.equal(receipt.interruptions.reconnects, 1);
assert.equal(receipt.workloadSegments.length, 2);
assert.equal(receipt.recentEvents.length, recorderCore.MAX_EVENTS);
assert.equal(receipt.privacy.rawFramesRetained, false);
assert.equal(receipt.privacy.userAgentRetained, false);
assert.equal(JSON.stringify(receipt).includes('must-not-survive'), false);
assert.equal(JSON.stringify(receipt).includes('nested'), false);
assert.ok(Buffer.byteLength(JSON.stringify(receipt)) < 30000, 'receipt remains compact');
assert.equal(Object.prototype.hasOwnProperty.call(receipt, 'authorityState'), false);
assert.match(receipt.evidenceBoundaries.join(' '), /external native profiler/);
assert.match(receipt.evidenceBoundaries.join(' '), /Only a complete requested 30-minute receipt/i);

const partial = recorderCore.createSession({ requestedDurationMs: 120000, now: () => now, wallNow: () => wall });
partial.start({ label: 'SMOKE', viewportWidth: 1280, viewportHeight: 720 });
now += 10000;
const partialReceipt = partial.stop('manual-smoke');
assert.equal(partialReceipt.status, 'partial');
assert.equal(partialReceipt.thirtyMinuteGateEligible, false);

const metric = recorderCore.createMetric(1, 10);
[1, 2, 3, 4, 100].forEach(value => recorderCore.recordMetric(metric, value));
const summary = recorderCore.summarizeMetric(metric);
assert.equal(summary.samples, 5);
assert.equal(summary.overflow, 1);
assert.equal(summary.p95, 10);

console.log('MIRRORSHIFT TARGET SESSION RECORDER PASS · 108,000 bounded frame samples · compact 30-minute receipt · authority untouched');
