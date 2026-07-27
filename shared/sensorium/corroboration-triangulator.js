'use strict';

const C = require('./core');
const Envelope = require('./receipt-envelope');

const CAPABILITY = 'sense.consensus.claim-corroboration/v1';
const RECEIPT_SCHEMA = 'axm.corroboration-record/v1';
const AGREEMENTS = ['CONVERGENT', 'DIVERGENT', 'INSUFFICIENT', 'INCOMPARABLE'];

function normalizedSeams(receipt) {
  return Array.from(new Set((receipt.namedSeams || []).map(function (value) {
    return C.compact(value, 160);
  }).filter(Boolean))).sort();
}

function observationKey(receipt) {
  return C.digest({
    verdict: receipt.verdict,
    typedObservationDigest: receipt.typedObservationDigest,
    namedSeams: normalizedSeams(receipt)
  });
}

function create(options) {
  options = options || {};
  const store = C.createReceiptStore(options.receiptLimit);
  const maxReceipts = Math.max(2, Math.min(32, Number(options.maxReceipts) || 32));

  function seal(input, details) {
    const receipt = Object.assign({
      schema: RECEIPT_SCHEMA,
      capability: CAPABILITY,
      claimId: C.compact(input.claimId, 500),
      seatsCompared: [],
      capabilityFamily: null,
      capabilityVersion: null,
      verdictsSeen: [],
      agreement: 'INCOMPARABLE',
      divergenceAxis: [],
      independentSeatCount: 0,
      routedTo: 'none',
      tookNoDirectAction: true,
      nextCheapestCorroboration: 'Supply two valid sealed receipts from distinct seats for the same claim and capability version.',
      inputReceiptsRetained: false,
      rawRetainedBytesAfterSeal: 0,
      rawRetainedItemsAfterSeal: 0,
      cleanupComplete: true
    }, details || {});
    if (AGREEMENTS.indexOf(receipt.agreement) < 0) throw new Error('invalid corroboration agreement');
    return store.push(receipt);
  }

  function corroborate(input) {
    input = input || {};
    const claimId = C.assertExactIdentifier(input.claimId, 'claimId');
    const supplied = Array.isArray(input.receiptEnvelopes) ? input.receiptEnvelopes.slice() : [];
    if (supplied.length > maxReceipts) {
      return seal({ claimId }, {
        agreement: 'INCOMPARABLE',
        divergenceAxis: ['RECEIPT_BUDGET_EXCEEDED'],
        routedTo: 'gate-review',
        nextCheapestCorroboration: 'Reduce the comparison to at most ' + maxReceipts + ' sealed receipts.'
      });
    }

    const invalid = [];
    supplied.forEach(function (receipt, index) {
      const checked = Envelope.validate(receipt);
      if (!checked.ok) invalid.push('receipt[' + index + ']:' + checked.errors.join(','));
      else if (receipt.claimId !== claimId) invalid.push('receipt[' + index + ']:CLAIM_MISMATCH');
    });
    if (invalid.length) {
      return seal({ claimId }, {
        agreement: 'INCOMPARABLE',
        divergenceAxis: ['INVALID_OR_UNSEALED_RECEIPT'],
        routedTo: 'gate-review',
        nextCheapestCorroboration: 'Replace invalid or claim-mismatched envelopes: ' + invalid.slice(0, 3).join(' | ')
      });
    }

    const families = Array.from(new Set(supplied.map(function (receipt) { return receipt.capabilityId; })));
    const versions = Array.from(new Set(supplied.map(function (receipt) { return receipt.capabilityVersion; })));
    if (families.length > 1 || versions.length > 1) {
      return seal({ claimId }, {
        seatsCompared: Array.from(new Set(supplied.map(function (receipt) { return receipt.seatId; }))).sort(),
        capabilityFamily: families.length === 1 ? families[0] : null,
        capabilityVersion: versions.length === 1 ? versions[0] : null,
        agreement: 'INCOMPARABLE',
        divergenceAxis: families.length > 1 ? ['CAPABILITY_FAMILY_MISMATCH'] : ['CAPABILITY_VERSION_MISMATCH'],
        independentSeatCount: new Set(supplied.map(function (receipt) { return receipt.seatId; })).size,
        routedTo: 'gate-review',
        nextCheapestCorroboration: 'Compare receipts produced by the same capability family and version.'
      });
    }

    const bySeat = new Map();
    supplied.forEach(function (receipt) {
      const rows = bySeat.get(receipt.seatId) || [];
      rows.push(receipt);
      bySeat.set(receipt.seatId, rows);
    });
    const ambiguousSeats = [];
    const independent = [];
    Array.from(bySeat.keys()).sort().forEach(function (seatId) {
      const unique = new Map();
      bySeat.get(seatId).forEach(function (receipt) { unique.set(observationKey(receipt), receipt); });
      if (unique.size > 1) ambiguousSeats.push(seatId);
      else if (unique.size === 1) independent.push(Array.from(unique.values())[0]);
    });
    if (ambiguousSeats.length) {
      return seal({ claimId }, {
        seatsCompared: Array.from(bySeat.keys()).sort(),
        capabilityFamily: families[0] || null,
        capabilityVersion: versions[0] || null,
        agreement: 'INCOMPARABLE',
        divergenceAxis: ['MULTIPLE_OBSERVATIONS_FROM_ONE_SEAT'],
        independentSeatCount: independent.length,
        routedTo: 'gate-review',
        nextCheapestCorroboration: 'Ask these seats to seal one bounded observation each: ' + ambiguousSeats.join(', ')
      });
    }

    const seats = independent.map(function (receipt) { return receipt.seatId; });
    const verdictsSeen = independent.map(function (receipt) { return { seatId: receipt.seatId, verdict: receipt.verdict }; });
    if (independent.length < 2) {
      return seal({ claimId }, {
        seatsCompared: seats,
        capabilityFamily: families[0] || null,
        capabilityVersion: versions[0] || null,
        verdictsSeen,
        agreement: 'INSUFFICIENT',
        independentSeatCount: independent.length,
        nextCheapestCorroboration: 'Obtain one sealed receipt from a second independent seat.'
      });
    }

    const axes = [];
    if (new Set(independent.map(function (receipt) { return receipt.verdict; })).size > 1) axes.push('VERDICT');
    if (new Set(independent.map(function (receipt) { return receipt.typedObservationDigest; })).size > 1) axes.push('TYPED_OBSERVATION_DIGEST');
    if (new Set(independent.map(function (receipt) { return JSON.stringify(normalizedSeams(receipt)); })).size > 1) axes.push('NAMED_SEAMS');
    const agreement = axes.length ? 'DIVERGENT' : 'CONVERGENT';
    return seal({ claimId }, {
      seatsCompared: seats,
      capabilityFamily: families[0],
      capabilityVersion: versions[0],
      verdictsSeen,
      agreement,
      divergenceAxis: axes,
      independentSeatCount: independent.length,
      routedTo: agreement === 'DIVERGENT' ? 'gate-review' : 'none',
      nextCheapestCorroboration: agreement === 'DIVERGENT'
        ? 'Route the named divergence to a human or independent gate; do not vote or average.'
        : 'Preserve this as corroboration evidence only; canon promotion remains a separate gate.'
    });
  }

  return {
    capability: CAPABILITY,
    corroborate,
    receipts: store.list,
    status: function () { return C.status(store, { inputReceiptsRetained: false }); }
  };
}

module.exports = { CAPABILITY, RECEIPT_SCHEMA, AGREEMENTS, create, normalizedSeams, observationKey };
