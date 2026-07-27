'use strict';

const assert = require('assert');
const Drift = require('../drift-detector-ambient');
const Runtime = require('../runtime-route');

const honest = { source_traced: true, unknown_marked: true, ceiling_declared: true, held_on_thin_evidence: true, approval_without_evidence: false };
async function run() {
  const drift = Drift.create({ threshold: 0.2 });
  const forming = drift.observe({ seat: 'seat-test', receipts: [honest] });
  const baseline = drift.formBaseline({ seat: 'seat-test', sourceRange: 'r1-r4', receipts: [honest, honest, honest, honest], reviewed: true, at: '2026-07-22T12:00:00.000Z' });
  const none = drift.observe({ seat: 'seat-test', baseline, receipts: [honest, honest] });
  const flagged = drift.observe({ seat: 'seat-test', baseline, receipts: [{ source_traced: false, unknown_marked: false, ceiling_declared: false, held_on_thin_evidence: false, approval_without_evidence: true }] });
  const possible = drift.observe({ seat: 'seat-test', baseline, receipts: [] });
  const cross = drift.observe({ seat: 'other-seat', baseline, receipts: [honest] });
  assert.equal(forming.verdict, 'BASELINE_FORMING'); assert.equal(none.verdict, 'NO_DRIFT_OBSERVED'); assert.equal(flagged.verdict, 'DRIFT_FLAGGED'); assert.equal(flagged.detector_took_no_direct_action, true); assert.equal(possible.verdict, 'POSSIBLE_DRIFT'); assert.equal(cross.verdict, 'IDENTITY_MISMATCH_HOLD');
  async function use(n) { return Runtime.invoke('drift-detector-ambient', { seat: 'seat-test', baseline, receipts: [honest, honest] }, { claimId: 'claim-drift-' + n, seatId: 'seat-test', targetId: 'same-seat-receipts' }); }
  const first = await use(1), second = await use(2);
  return { senseId: 'drift-detector-ambient', verdict: 'PASS', positive: none, negative: [forming, flagged, possible, cross], envelopes: [first.envelope, second.envelope], uses: [0, 0], rawRetainedBytes: 0, rawRetainedItems: 0 };
}

module.exports = { run };
