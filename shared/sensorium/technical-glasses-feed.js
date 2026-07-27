'use strict';

const C = require('./core');

function compile(input) {
  input = input || {};
  const registry = input.registry || require('./registry.json');
  const receipts = (input.receipts || []).slice(-200);
  const bySense = {};
  receipts.forEach(function (receipt) { if (receipt && receipt.senseId) bySense[receipt.senseId] = receipt; });
  const rows = (registry.senses || []).map(function (sense) {
    const latest = bySense[sense.id] || null;
    return {
      senseId: sense.id, capability: sense.capability, skillStatus: sense.skillStatus, executorStatus: sense.executorStatus,
      adapterStatus: sense.adapterStatus, proofStatus: sense.proofStatus, authorityStatus: latest && latest.authorityLeaseId ? 'LEASED' : 'NO_LEASE',
      latestReceiptId: latest && latest.receiptId || null, freshnessStatus: latest && latest.freshnessStatus || 'UNTIMED', ttlMs: latest && latest.ttlMs || null,
      rawRetainedBytes: latest && latest.rawRetainedBytesAfterSeal || 0, rawRetainedItems: latest && latest.rawRetainedItemsAfterSeal || 0,
      holds: latest && latest.namedSeams || [], constraints: sense.constraints || []
    };
  });
  return {
    schema: 'axm.sensorium-technical-feed/v1', generatedAt: C.now(input.at), sourceDigest: registry.sourceDigest,
    counts: { skills: rows.length, executable: rows.filter(function (row) { return row.executorStatus === 'EXECUTABLE'; }).length, hostMediated: rows.filter(function (row) { return row.executorStatus === 'HOST_MEDIATED'; }).length, rawRetainedBytes: rows.reduce(function (sum, row) { return sum + row.rawRetainedBytes; }, 0), rawRetainedItems: rows.reduce(function (sum, row) { return sum + row.rawRetainedItems; }, 0), holds: rows.reduce(function (sum, row) { return sum + row.holds.length; }, 0) },
    rows, derivedOnly: true, handEnteredNumbers: false, automaticAction: false
  };
}

module.exports = { compile };
