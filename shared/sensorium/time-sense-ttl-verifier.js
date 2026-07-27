'use strict';

const C = require('./core');
const CAPABILITY = 'sense.time.ttl/v1';
const RECEIPT_SCHEMA = 'axm.time-sense-ttl/v1';

function create(options) {
  options = options || {};
  const store = C.createReceiptStore(options.receiptLimit);
  function stamp(input) {
    input = input || {};
    const ttlMs = Math.max(1, Math.min(31536000000, Number(input.ttlMs) || 60000));
    return { fact: C.compact(input.fact, 500), factDigest: C.digest(input.fact), observedAt: C.now(input.observedAt), ttlMs: ttlMs, volatility: C.compact(input.volatility || 'medium', 20) };
  }
  function check(stamped, input) {
    input = input || {};
    if (!stamped || !stamped.observedAt) {
      return store.push({ schema: RECEIPT_SCHEMA, capability: CAPABILITY, fact: '', observed_at: '', ttl_assigned_ms: null, volatility_class: 'unknown', age_at_use_ms: null, status: 'UNTIMED', re_verified_before_action: false, decision_inherited_ttl_ms: null, next_recheck_due: null });
    }
    const at = Date.parse(C.now(input.at)), observed = Date.parse(stamped.observedAt);
    const validAt = Number.isFinite(at), validObserved = Number.isFinite(observed);
    const delta = validAt && validObserved ? at - observed : null;
    const age = delta == null ? null : Math.max(0, delta);
    const receiptStatus = !validObserved || !validAt ? 'INVALID_TIMESTAMP' : (delta < 0 ? 'FUTURE' : (age <= stamped.ttlMs ? 'LIVE' : 'STALE'));
    const requestedDecisionTtl = Number(input.decisionTtlMs);
    const inheritedTtl = Number.isFinite(requestedDecisionTtl) && requestedDecisionTtl > 0
      ? Math.min(stamped.ttlMs, Math.round(requestedDecisionTtl))
      : stamped.ttlMs;
    const receipt = {
      schema: RECEIPT_SCHEMA, capability: CAPABILITY, fact: stamped.fact, fact_digest: stamped.factDigest, observed_at: stamped.observedAt,
      ttl_assigned_ms: stamped.ttlMs, volatility_class: stamped.volatility, age_at_use_ms: age, status: receiptStatus,
      re_verified_before_action: input.reverified === true, decision_inherited_ttl_ms: inheritedTtl,
      next_recheck_due: validObserved ? new Date(observed + stamped.ttlMs).toISOString() : null
    };
    return store.push(receipt);
  }
  return { capability: CAPABILITY, stamp, check, receipts: store.list, status: function () { return C.status(store); } };
}

module.exports = { CAPABILITY, RECEIPT_SCHEMA, create };
