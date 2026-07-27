'use strict';

const C = require('./core');

const CAPABILITY = 'sense.hearing.bounded-stream/v1';
const RECEIPT_SCHEMA = 'axm.ears-listen-digest/v1';

function create(options) {
  options = options || {};
  const readWindow = options.readWindow;
  const maxEvents = Math.max(1, Math.min(200, Number(options.maxEvents) || 80));
  const maxBytes = Math.max(1024, Math.min(512000, Number(options.maxBytes) || 128000));
  const store = C.createReceiptStore(options.receiptLimit);
  let rawRetainedBytes = 0, rawRetainedItems = 0;

  function matches(event, patterns) {
    const haystack = (C.compact(event.type) + ' ' + C.compact(event.message)).toLowerCase();
    return (patterns || []).some(function (pattern) { return haystack.indexOf(String(pattern).toLowerCase()) >= 0; });
  }

  async function listen(input) {
    input = input || {};
    const openedAt = C.now(input.openedAt);
    const expected = Array.isArray(input.expectedEvents) ? input.expectedEvents.slice(0, 20) : [];
    const refuting = Array.isArray(input.refutingEvents) ? input.refutingEvents.slice(0, 20) : [];
    if (typeof readWindow !== 'function') {
      const missing = {
        schema: RECEIPT_SCHEMA, capability: CAPABILITY, claim: C.compact(input.claim, 300), stream_source: C.compact(input.source, 240),
        window_start: openedAt, window_end: C.now(), expected_events: expected, heard_events: [], heard_nothing: true,
        typed_observation: 'No stream adapter was supplied.', verdict: 'UNKNOWN', hearing_seam: 'MISSING_STREAM_ADAPTER',
        buffer_digest: C.digest([]), temporary_capture_deleted: true, temporary_bytes_released: 0, cleanup_complete: true,
        next_cheapest_listen: 'Provide one bounded readWindow adapter for the named stream.'
      };
      return store.push(missing);
    }
    let events = await readWindow({ source: input.source, openedAt: openedAt, windowMs: Math.max(0, Math.min(60000, Number(input.windowMs) || 1000)), maxEvents: maxEvents });
    events = Array.isArray(events) ? events : [];
    let buffer = [], bytes = 0, evicted = 0;
    events.forEach(function (event, index) {
      const normalized = {
        type: C.compact(event && event.type || 'event', 80),
        message: C.compact(event && event.message, 1000),
        emittedAt: C.now(event && event.emittedAt || openedAt),
        order: index
      };
      const size = C.byteLength(normalized);
      buffer.push(normalized); bytes += size;
      while (buffer.length > maxEvents || bytes > maxBytes) { bytes -= C.byteLength(buffer.shift()); evicted++; }
    });
    rawRetainedBytes = bytes; rawRetainedItems = buffer.length;
    const heardRefuting = buffer.filter(function (event) { return matches(event, refuting); });
    const heardExpected = buffer.filter(function (event) { return matches(event, expected); });
    const selected = heardRefuting.concat(heardExpected).slice(0, 20);
    const verdict = heardRefuting.length ? 'FAIL' : (expected.length ? (heardExpected.length ? 'PASS' : 'UNKNOWN') : (buffer.length ? 'PASS' : 'UNKNOWN'));
    const materialDigest = C.digest(buffer);
    const released = bytes;
    buffer.length = 0; bytes = 0; rawRetainedBytes = 0; rawRetainedItems = 0;
    const receipt = {
      schema: RECEIPT_SCHEMA, capability: CAPABILITY, claim: C.compact(input.claim, 300), stream_source: C.compact(input.source, 240),
      window_start: openedAt, window_end: C.now(input.closedAt), expected_events: expected,
      heard_events: selected.map(function (event) { return Object.assign({}, event, { readAgeMs: Math.max(0, Date.parse(C.now(input.closedAt)) - Date.parse(event.emittedAt)) || 0 }); }),
      heard_nothing: events.length === 0, typed_observation: verdict === 'PASS' ? 'Expected bounded stream evidence was heard.' : (verdict === 'FAIL' ? 'A refuting event was heard.' : 'The bounded window did not settle the claim.'),
      verdict: verdict, hearing_seam: verdict === 'UNKNOWN' ? 'BOUNDED_WINDOW_INCONCLUSIVE' : '', buffer_digest: materialDigest,
      evicted_events: evicted, temporary_capture_deleted: true, temporary_bytes_released: released, cleanup_complete: true,
      next_cheapest_listen: verdict === 'UNKNOWN' ? 'Listen again at the event source with a declared freshness window.' : 'No further listen required for this claim.'
    };
    return store.push(receipt);
  }

  return { capability: CAPABILITY, listen: listen, receipts: store.list, status: function () { return C.status(store, { rawRetainedBytes, rawRetainedItems, maxEvents, maxBytes }); } };
}

module.exports = { CAPABILITY, RECEIPT_SCHEMA, create };
