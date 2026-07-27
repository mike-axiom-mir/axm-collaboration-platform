'use strict';

const assert = require('assert');
const Envelope = require('../receipt-envelope');
const Corroboration = require('../corroboration-triangulator');
const Runtime = require('../runtime-route');

function envelope(seatId, options) {
  options = options || {};
  return Envelope.create({
    claimId: options.claimId || 'claim-shared',
    senseId: 'proof-source-sense',
    capability: options.capability || 'proof.observe.claim/v1',
    seatId,
    targetId: 'proof-target',
    backendId: 'proof-backend',
    observedAt: '2026-07-23T12:00:00.000Z',
    sealedAt: '2026-07-23T12:00:01.000Z',
    ttlMs: 60000,
    verdict: options.verdict || 'PASS',
    namedSeams: options.namedSeams || [],
    typedObservation: options.observation || { fact: 'same bounded observation' },
    specificReceiptSchema: 'axm.proof-source/v1',
    specificReceipt: { schema: 'axm.proof-source/v1', verdict: options.verdict || 'PASS', factDigest: options.factDigest || 'same' },
    cleanupComplete: true
  });
}

async function run() {
  const sense = Corroboration.create();
  const a = envelope('seat-a'), b = envelope('seat-b');
  const convergent = sense.corroborate({ claimId: 'claim-shared', receiptEnvelopes: [a, b] });
  const divergent = sense.corroborate({ claimId: 'claim-shared', receiptEnvelopes: [a, envelope('seat-b', { observation: { fact: 'different bounded observation' } })] });
  const insufficient = sense.corroborate({ claimId: 'claim-shared', receiptEnvelopes: [a, a] });
  const incomparable = sense.corroborate({ claimId: 'claim-shared', receiptEnvelopes: [a, envelope('seat-b', { capability: 'proof.other.claim/v1' })] });
  const ambiguous = sense.corroborate({ claimId: 'claim-shared', receiptEnvelopes: [a, envelope('seat-a', { observation: { fact: 'changed by same seat' } }), b] });
  assert.equal(convergent.agreement, 'CONVERGENT');
  assert.equal(convergent.independentSeatCount, 2);
  assert.equal(divergent.agreement, 'DIVERGENT');
  assert.ok(divergent.divergenceAxis.includes('TYPED_OBSERVATION_DIGEST'));
  assert.equal(divergent.routedTo, 'gate-review');
  assert.equal(insufficient.agreement, 'INSUFFICIENT');
  assert.equal(incomparable.agreement, 'INCOMPARABLE');
  assert.equal(ambiguous.agreement, 'INCOMPARABLE');
  assert.equal(convergent.tookNoDirectAction, true);
  assert.equal(sense.status().inputReceiptsRetained, false);

  async function use(n) {
    return Runtime.invoke('corroboration-triangulator', { claimId: 'claim-shared', receiptEnvelopes: [a, b], observedAt: '2026-07-23T12:00:0' + n + '.000Z' }, { claimId: 'claim-corroboration-' + n, seatId: 'seat-gauge', targetId: 'sealed-receipts' });
  }
  const first = await use(1), second = await use(2);
  return { senseId: 'corroboration-triangulator', verdict: 'PASS', positive: convergent, negative: [divergent, insufficient, incomparable, ambiguous], envelopes: [first.envelope, second.envelope], uses: [0, 0], rawRetainedBytes: 0, rawRetainedItems: 0 };
}

module.exports = { run };
