'use strict';

const C = require('./core');
const Janitor = require('./retention-janitor');

async function close(input) {
  input = input || {};
  const janitorPlan = Janitor.preview(input.temporaryItems || []);
  const cleanup = await Janitor.release(janitorPlan, input.retentionAdapter, Janitor.CONFIRMATION);
  const expiredLeases = [];
  for (const leaseId of (input.authorityLeaseIds || []).slice(0, 50)) {
    const exact = C.assertExactIdentifier(leaseId, 'leaseId');
    if (!input.leaseAdapter || typeof input.leaseAdapter.expireExact !== 'function') throw new Error('exact lease expiry adapter required');
    await input.leaseAdapter.expireExact(exact); expiredLeases.push(exact);
  }
  const handoff = {
    schema: 'axm.sensorium-session-handoff/v1', sessionId: C.assertExactIdentifier(input.sessionId, 'sessionId'), seatId: C.assertExactIdentifier(input.seatId, 'seatId'),
    closedAt: C.now(input.closedAt), receiptDigests: (input.receipts || []).slice(-100).map(function (receipt) { return { receiptId: C.compact(receipt.receiptId, 160), digest: C.digest(receipt) }; }),
    openHolds: (input.openHolds || []).slice(0, 50).map(function (hold) { return C.compact(hold, 300); }),
    nextStep: C.compact(input.nextStep, 500), authorityLeaseIdsExpired: expiredLeases, authorityInherited: false,
    rawSenseMaterialCarried: false, cleanupComplete: cleanup.cleanupComplete
  };
  handoff.digest = C.digest(handoff);
  return { schema: 'axm.sensorium-session-close-receipt/v1', handoff, cleanup, verdict: cleanup.cleanupComplete ? 'PASS' : 'FAIL', automaticPromotion: false };
}

module.exports = { close };
