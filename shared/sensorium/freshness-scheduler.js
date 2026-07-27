'use strict';

const C = require('./core');

function schedule(receipts, at) {
  const stamp = Date.parse(at || new Date().toISOString());
  if (!Number.isFinite(stamp)) throw new Error('scheduler time must be valid');
  const rows = (Array.isArray(receipts) ? receipts : []).slice(0, 500).map(function (receipt) {
    const observed = Date.parse(receipt.observedAt), ttl = Number(receipt.ttlMs), due = observed + ttl;
    const valid = Number.isFinite(observed) && Number.isFinite(ttl) && ttl > 0;
    const state = !valid ? 'UNKNOWN' : (stamp > due ? 'STALE' : 'LIVE');
    return { receiptId: C.compact(receipt.receiptId, 160), claimId: C.compact(receipt.claimId, 160), senseId: C.compact(receipt.senseId, 160), state, reobserveAfter: valid ? new Date(due).toISOString() : null, queued: state === 'STALE', authorityRequiredAtRun: true };
  });
  return { schema: 'axm.sensorium-freshness-schedule/v1', at: new Date(stamp).toISOString(), rows, queue: rows.filter(function (row) { return row.queued; }).map(function (row) { return { claimId: row.claimId, senseId: row.senseId, state: 'QUEUED_FOR_REOBSERVATION', automaticObservation: false, authorityInherited: false }; }), automaticObservation: false };
}

module.exports = { schedule };
