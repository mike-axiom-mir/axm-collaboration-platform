(function (root, factory) {
  'use strict';
  var api = factory(typeof module === 'object' && module.exports ? require('./canonical-state') : root.AXMTycoonCanonical);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.AXMTycoonReceipts = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Canonical) {
  'use strict';

  var SCHEMA = 'axm.tycoon-steward.receipt/v0.1';

  function pad(value, size) { return String(value).padStart(size, '0'); }
  function predictId(state, kind, turn) {
    return 'receipt-t' + pad(turn == null ? state.turn : turn, 4) + '-s' + pad(Number(state.receiptSequence || 0) + 1, 5) + '-' + String(kind || 'event').toLowerCase();
  }
  function contentForHash(receipt) {
    var copy = Canonical.clone(receipt);
    delete copy.currentReceiptHash;
    return Canonical.stableStringify(copy);
  }
  function hashReceipt(receipt) { return Canonical.sha256(contentForHash(receipt)); }

  function readable(receipt) {
    var lines = [];
    lines.push('Turn ' + receipt.logicalTurn + ' · ' + receipt.kind + ' · ' + receipt.receiptId);
    if (receipt.decisionReferences.length) lines.push('Explicit decision: ' + receipt.decisionReferences.join(', '));
    if (receipt.needsObserved.length) lines.push('Strongest need: ' + receipt.needsObserved[0].label + ' (' + receipt.needsObserved[0].pressure + ')');
    if (receipt.changes.length) lines.push('Changes: ' + receipt.changes.map(function (change) { return change.summary || change.type || change.id; }).join('; '));
    if (receipt.resourceTransactions.length) lines.push('Resource movements: ' + receipt.resourceTransactions.length + ' traceable transaction(s).');
    if (receipt.warnings.length) lines.push('Warnings: ' + receipt.warnings.join('; '));
    if (receipt.limitations.length) lines.push('Limits: ' + receipt.limitations.join('; '));
    return lines;
  }

  function append(state, input) {
    var draft = Canonical.clone(state);
    draft.receiptSequence = Number(draft.receiptSequence || 0) + 1;
    var receipt = {
      schema: SCHEMA,
      version: '0.1.0',
      receiptId: predictId(state, input.kind, input.logicalTurn == null ? state.turn : input.logicalTurn),
      kind: input.kind || 'EVENT',
      logicalTurn: input.logicalTurn == null ? state.turn : input.logicalTurn,
      sequence: draft.receiptSequence,
      actor: Canonical.clone(input.actor || { id: 'human-steward', type: 'HUMAN' }),
      decisionReferences: Canonical.clone(input.decisionReferences || []),
      seedPreState: Canonical.clone(input.seedPreState || state.prng),
      seedPostState: Canonical.clone(input.seedPostState || draft.prng),
      preStateHash: input.preStateHash || Canonical.hashState(state),
      postStateHash: Canonical.hashState(draft),
      needsObserved: Canonical.clone(input.needsObserved || []),
      proposalsConsidered: Canonical.clone(input.proposalsConsidered || []),
      candidates: Canonical.clone(input.candidates || []),
      resourceTransactions: Canonical.clone(input.resourceTransactions || []),
      changes: Canonical.clone(input.changes || []),
      vitalDeltas: Canonical.clone(input.vitalDeltas || {}),
      unmetNeeds: Canonical.clone(input.unmetNeeds || []),
      noveltyFlags: Canonical.clone(input.noveltyFlags || []),
      warnings: Canonical.clone(input.warnings || []),
      limitations: Canonical.clone(input.limitations || []),
      adapterProposals: Canonical.clone(input.adapterProposals || []),
      previousReceiptHash: state.receiptHead || null,
      currentReceiptHash: ''
    };
    receipt.readableExplanation = readable(receipt);
    receipt.currentReceiptHash = hashReceipt(receipt);
    draft.receipts.push(receipt);
    draft.receiptHead = receipt.currentReceiptHash;
    return { state: draft, receipt: receipt };
  }

  function verify(receipts) {
    var errors = [], previous = null, expectedSequence = 1;
    (receipts || []).forEach(function (receipt, index) {
      if (receipt.schema !== SCHEMA) errors.push('receipt ' + index + ' has unsupported schema');
      if (receipt.sequence !== expectedSequence) errors.push('receipt ' + index + ' sequence mismatch');
      if (receipt.previousReceiptHash !== previous) errors.push('receipt ' + index + ' previous hash mismatch');
      if (receipt.currentReceiptHash !== hashReceipt(receipt)) errors.push('receipt ' + index + ' hash mismatch');
      previous = receipt.currentReceiptHash;
      expectedSequence += 1;
    });
    return { ok: errors.length === 0, errors: errors, count: (receipts || []).length, head: previous };
  }

  function query(state, input) {
    var options = input || {};
    return state.receipts.filter(function (receipt) {
      if (options.kind && receipt.kind !== options.kind) return false;
      if (Number.isFinite(options.turn) && receipt.logicalTurn !== options.turn) return false;
      if (options.id && receipt.receiptId !== options.id) return false;
      return true;
    }).slice(options.limit ? -Math.max(1, Math.min(500, options.limit)) : 0);
  }

  function explain(receipt) { return receipt ? receipt.readableExplanation.join('\n') : 'No matching receipt.'; }

  return { SCHEMA: SCHEMA, predictId: predictId, contentForHash: contentForHash, hashReceipt: hashReceipt, append: append, verify: verify, query: query, explain: explain };
});
