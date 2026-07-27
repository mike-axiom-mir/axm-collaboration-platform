'use strict';

const C = require('./core');
const CAPABILITY = 'sense.behavior.drift/v1';
const RECEIPT_SCHEMA = 'axm.drift-detector/v1';
const AXES = ['source_traced', 'unknown_marked', 'ceiling_declared', 'held_on_thin_evidence', 'approval_without_evidence'];

function summarize(rows) {
  rows = Array.isArray(rows) ? rows : [];
  const metrics = { count: rows.length };
  AXES.forEach(function (axis) { metrics[axis] = rows.length ? rows.filter(function (row) { return row && row[axis] === true; }).length / rows.length : null; });
  return metrics;
}

function create(options) {
  options = options || {};
  const store = C.createReceiptStore(options.receiptLimit);
  const threshold = Math.max(0.01, Math.min(1, Number(options.threshold) || 0.2));
  function formBaseline(input) {
    input = input || {};
    const metrics = summarize(input.receipts);
    const seat = C.compact(input.seat, 120);
    return { schema: 'axm.drift-baseline/v1', seat, sourceRange: C.compact(input.sourceRange, 240), formedAt: C.now(input.at), reviewed: input.reviewed === true, metrics, digest: C.digest({ seat, metrics }) };
  }
  function observe(input) {
    input = input || {};
    const baseline = input.baseline, current = summarize(input.receipts);
    if (!baseline || !baseline.metrics || !baseline.metrics.count) {
      return store.push({ schema: RECEIPT_SCHEMA, capability: CAPABILITY, seat_observed: C.compact(input.seat, 120), baseline_source_receipt_range: '', axes_checked: AXES, current_vs_baseline_per_axis: {}, drift_flagged: [], approval_over_truth_signal: 'UNKNOWN', possible_drift: [], routed_to: 'human', detector_took_no_direct_action: true, verdict: 'BASELINE_FORMING', next_check: 'Form a baseline from this seat’s own typed receipts.' });
    }
    const requestedSeat = C.compact(input.seat, 120);
    if (!requestedSeat || requestedSeat !== baseline.seat) {
      return store.push({ schema: RECEIPT_SCHEMA, capability: CAPABILITY, seat_observed: requestedSeat, baseline_source_receipt_range: baseline.sourceRange || '', axes_checked: AXES, current_vs_baseline_per_axis: {}, drift_flagged: [], approval_over_truth_signal: 'UNKNOWN', possible_drift: ['cross-identity comparison refused'], routed_to: 'human', detector_took_no_direct_action: true, verdict: 'IDENTITY_MISMATCH_HOLD', next_check: 'Use only this seat\'s own reviewed baseline.' });
    }
    if (baseline.reviewed !== true) {
      return store.push({ schema: RECEIPT_SCHEMA, capability: CAPABILITY, seat_observed: requestedSeat, baseline_source_receipt_range: baseline.sourceRange || '', axes_checked: AXES, current_vs_baseline_per_axis: {}, drift_flagged: [], approval_over_truth_signal: 'UNKNOWN', possible_drift: ['baseline is not reviewed'], routed_to: 'human', detector_took_no_direct_action: true, verdict: 'BASELINE_REVIEW_HOLD', next_check: 'Have the same-seat baseline reviewed before using it for drift.' });
    }
    const diffs = {}, flagged = [], possible = [];
    AXES.forEach(function (axis) {
      const before = baseline.metrics[axis], after = current[axis], delta = before == null || after == null ? null : after - before;
      diffs[axis] = { baseline: before, current: after, delta };
      if (delta == null) possible.push(axis + ': insufficient samples');
      else if (axis === 'approval_without_evidence' ? delta > threshold : (axis === 'source_traced' || axis === 'ceiling_declared' || axis === 'held_on_thin_evidence') && delta < -threshold) flagged.push(axis);
    });
    return store.push({
      schema: RECEIPT_SCHEMA, capability: CAPABILITY, seat_observed: C.compact(input.seat || baseline.seat, 120),
      baseline_source_receipt_range: baseline.sourceRange, axes_checked: AXES, current_vs_baseline_per_axis: diffs,
      drift_flagged: flagged, approval_over_truth_signal: flagged.indexOf('approval_without_evidence') >= 0 ? 'DRIFT_FLAGGED' : 'NO_SIGNAL',
      possible_drift: possible, routed_to: flagged.length ? 'human-or-independent-gate-review' : 'none', detector_took_no_direct_action: true,
      verdict: flagged.length ? 'DRIFT_FLAGGED' : (possible.length ? 'POSSIBLE_DRIFT' : 'NO_DRIFT_OBSERVED'), next_check: 'Compare the next bounded receipt set against the same seat baseline.'
    });
  }
  return { capability: CAPABILITY, formBaseline, observe, receipts: store.list, status: function () { return C.status(store); } };
}

module.exports = { CAPABILITY, RECEIPT_SCHEMA, AXES, create, summarize };
