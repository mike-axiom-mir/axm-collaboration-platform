'use strict';

const C = require('./core');
const Drift = require('./drift-detector-ambient');

function propose(input) {
  input = input || {};
  const seat = C.assertExactIdentifier(input.seat, 'seat');
  const receipts = (input.receipts || []).slice(0, 200);
  if (receipts.length < 3) return { schema: 'axm.sensorium-drift-baseline-proposal/v1', seat, state: 'HOLD', reason: 'At least three reviewed typed receipts are required.', automaticReplace: false };
  if (receipts.some(function (receipt) { return receipt.seatId !== seat || receipt.reviewed !== true; })) return { schema: 'axm.sensorium-drift-baseline-proposal/v1', seat, state: 'HOLD', reason: 'Every receipt must be reviewed and belong to the same seat.', automaticReplace: false };
  const detector = Drift.create();
  const baseline = detector.formBaseline({ seat, sourceRange: C.compact(input.sourceRange, 240), receipts: receipts.map(function (receipt) { return receipt.features || receipt; }), reviewed: false, at: input.at });
  return { schema: 'axm.sensorium-drift-baseline-proposal/v1', seat, state: 'PROPOSED_FOR_REVIEW', baseline, receiptDigests: receipts.map(C.digest), automaticReplace: false, promotionGate: 'Mike' };
}

module.exports = { propose };
