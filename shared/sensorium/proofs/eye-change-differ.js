'use strict';

const assert = require('assert');
const Eye = require('../eye-change-differ');
const Runtime = require('../runtime-route');

function observation(targetId, observedAt, facts) {
  return { schema: 'axm.typed-visual-observation/v1', targetId, observedAt, attribution: 'host-static-eye', facts };
}

async function run() {
  const eye = Eye.create({ maxFacts: 8 });
  const before = observation('sensorium-card', '2026-07-23T12:00:00.000Z', [
    { id: 'title', present: true, value: 'Sensorium' },
    { id: 'status', present: true, value: 'DRAFT' },
    { id: 'warning', present: false },
    { id: 'old-badge', present: true, value: 'legacy' }
  ]);
  const after = observation('sensorium-card', '2026-07-23T12:01:00.000Z', [
    { id: 'title', present: true, value: 'Sensorium' },
    { id: 'status', present: true, value: 'TEST' },
    { id: 'warning', present: true, value: 'adapter unavailable' },
    { id: 'old-badge', present: false }
  ]);
  const positive = eye.diff({ claim: 'Status changed to TEST and warning appeared.', targetId: 'sensorium-card', beforeObservation: before, afterObservation: after, expectedChange: [{ factId: 'status', classification: 'CHANGED' }, { factId: 'warning', classification: 'APPEARED' }] });
  const refuted = eye.diff({ claim: 'Title disappeared.', targetId: 'sensorium-card', beforeObservation: before, afterObservation: after, refutingChange: [{ factId: 'title', classification: 'SAME' }] });
  const incomparable = eye.diff({ claim: 'Different cards changed.', targetId: 'sensorium-card', beforeObservation: before, afterObservation: observation('other-card', '2026-07-23T12:01:00.000Z', after.facts) });
  const badOrder = eye.diff({ claim: 'Ordered change.', targetId: 'sensorium-card', beforeObservation: after, afterObservation: before });
  const missingDimension = eye.diff({ claim: 'Partial dimensions.', targetId: 'sensorium-card', beforeObservation: before, afterObservation: observation('sensorium-card', '2026-07-23T12:01:00.000Z', after.facts.slice(1)) });
  const missingAttribution = eye.diff({ claim: 'Attributable change.', targetId: 'sensorium-card', beforeObservation: Object.assign({}, before, { attribution: '' }), afterObservation: after });
  assert.equal(positive.verdict, 'PASS');
  assert.equal(positive.counts.SAME, 1);
  assert.equal(positive.counts.CHANGED, 1);
  assert.equal(positive.counts.APPEARED, 1);
  assert.equal(positive.counts.DISAPPEARED, 1);
  assert.equal(refuted.verdict, 'FAIL');
  assert.equal(incomparable.verdict, 'INCOMPARABLE');
  assert.ok(incomparable.namedSeams.includes('TARGET_ID_MISMATCH'));
  assert.equal(badOrder.verdict, 'UNKNOWN');
  assert.equal(missingDimension.verdict, 'UNKNOWN');
  assert.equal(missingAttribution.verdict, 'UNKNOWN');
  assert.equal(positive.causeClaimed, false);
  assert.equal(positive.captureClaimed, false);
  assert.equal(positive.inputObservationsRetained, false);
  assert.equal(JSON.stringify(positive).includes('adapter unavailable'), false);

  async function use(n, expectedChange) {
    return Runtime.invoke('eye-change-differ', { claim: 'Runtime visual diff', targetId: 'sensorium-card', beforeObservation: before, afterObservation: after, expectedChange, observedAt: after.observedAt }, { claimId: 'claim-eye-diff-' + n, seatId: 'seat-test', targetId: 'sensorium-card' });
  }
  const first = await use(1, [{ factId: 'status', classification: 'CHANGED' }]);
  const second = await use(2, [{ factId: 'title', classification: 'DISAPPEARED' }]);
  assert.equal(first.envelope.verdict, 'PASS');
  assert.equal(second.envelope.verdict, 'UNKNOWN');
  return { senseId: 'eye-change-differ', verdict: 'PASS', positive, negative: [refuted, incomparable, badOrder, missingDimension, missingAttribution], envelopes: [first.envelope, second.envelope], uses: [0, 0], rawRetainedBytes: 0, rawRetainedItems: 0 };
}

module.exports = { run };
