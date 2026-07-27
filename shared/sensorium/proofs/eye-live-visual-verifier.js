'use strict';

const assert = require('assert');
const Runtime = require('../runtime-route');

function captureFactory(seed) {
  let frame = 0;
  return async function () { frame += 1; return { dataUrl: 'data:image/jpeg;base64,' + Buffer.alloc(1200, seed + frame).toString('base64'), capturedAt: '2026-07-22T12:00:0' + frame + '.000Z' }; };
}
async function one(use) {
  return Runtime.invoke('eye-live-visual-verifier', { observedAt: '2026-07-22T12:00:00.000Z', sealedAt: '2026-07-22T12:00:04.000Z', frameCount: 4, maxFrames: 3, verdict: 'PASS', typedObservation: 'The declared bounded sequence changed and settled.' }, { claimId: 'claim-live-eye-' + use, seatId: 'seat-test', targetId: 'shared-browser-surface', backendId: 'browser-primary', ttlMs: 60000, adapters: { captureFrame: captureFactory(use * 10) } });
}
async function run() {
  const first = await one(1), second = await one(2);
  assert.equal(first.specificReceipt.cleanupComplete, true); assert.equal(first.specificReceipt.rawVideoArchive, false);
  assert.equal(first.envelope.rawRetainedBytesAfterSeal, 0); assert.equal(second.envelope.rawRetainedItemsAfterSeal, 0);
  const denied = await Runtime.invoke('eye-live-visual-verifier', { observedAt: '2026-07-22T12:00:00.000Z', sealedAt: '2026-07-22T12:00:01.000Z' }, { claimId: 'claim-live-eye-denied', seatId: 'seat-test', targetId: 'unshared', backendId: 'browser-primary', adapters: {} });
  assert.equal(denied.envelope.verdict, 'UNKNOWN'); assert.ok(denied.envelope.namedSeams.includes('MISSING_VISUAL_CAPTURE'));
  return { senseId: 'eye-live-visual-verifier', verdict: 'PASS', positive: first.specificReceipt, negative: [denied.specificReceipt], envelopes: [first.envelope, second.envelope, denied.envelope], uses: [first.envelope.rawRetainedBytesAfterSeal, second.envelope.rawRetainedBytesAfterSeal], rawRetainedBytes: 0, rawRetainedItems: 0 };
}

module.exports = { run };
