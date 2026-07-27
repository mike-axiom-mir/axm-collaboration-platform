'use strict';

const C = require('./core');
const CAPABILITY = 'sense.continuity.handoff/v1';
const RECEIPT_SCHEMA = 'axm.handoff-record/v1';

function inMemoryStore() {
  let rows = [];
  return { append: function (row) { rows.push(C.clone(row)); }, latest: function () { return rows.length ? C.clone(rows[rows.length - 1]) : null; }, list: function () { return C.clone(rows); } };
}

function safeItems(items, maximum) {
  return (Array.isArray(items) ? items : []).slice(0, maximum || 30).map(function (item) {
    if (typeof item === 'string') return { summary: C.compact(item, 500) };
    return { summary: C.compact(item && (item.summary || item.fact || item.decision), 500), source: C.compact(item && item.source, 240), digest: C.compact(item && item.digest, 128), age: C.compact(item && item.age, 80) };
  });
}

function create(options) {
  options = options || {};
  const chain = options.store || inMemoryStore();
  const receipts = C.createReceiptStore(options.receiptLimit);
  function write(input) {
    input = input || {};
    const record = {
      schema: RECEIPT_SCHEMA, capability: CAPABILITY, id: C.uid('handoff'), work_line: C.compact(input.workLine, 160),
      turn_id: C.compact(input.turnId, 120), seat: C.compact(input.seat, 120), written_at: C.now(input.at),
      verified_facts_with_age: safeItems(input.verifiedFacts, 30), assumed_facts_flagged: safeItems(input.assumedFacts, 20),
      open_holds: safeItems(input.openHolds, 30), decisions_as_state_not_permission: safeItems(input.decisions, 20),
      access_state_reread_from_gates: input.accessReread === true, next_cheapest_step: C.compact(input.nextStep, 500),
      continuity_seam: C.compact(input.continuitySeam, 240), chain_intact: input.chainIntact !== false,
      raw_sense_material_carried: false
    };
    record.digest = C.digest(record);
    chain.append(record);
    receipts.push({ schema: 'axm.handoff-write-receipt/v1', handoff_id: record.id, handoff_digest: record.digest, written_at: record.written_at, raw_sense_material_carried: false });
    return C.clone(record);
  }
  function readLatest() { return chain.latest(); }
  return { capability: CAPABILITY, write, readLatest, list: chain.list, receipts: receipts.list, status: function () { return C.status(receipts, { chainLength: chain.list().length }); } };
}

module.exports = { CAPABILITY, RECEIPT_SCHEMA, create, inMemoryStore };
