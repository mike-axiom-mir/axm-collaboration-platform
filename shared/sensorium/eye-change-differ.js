'use strict';

const C = require('./core');

const CAPABILITY = 'visual.diff.between-stills/v1';
const RECEIPT_SCHEMA = 'axm.visual-change-observation/v1';
const CLASSIFICATIONS = ['SAME', 'CHANGED', 'APPEARED', 'DISAPPEARED'];

function normalizeObservation(observation, maxFacts) {
  if (!observation || typeof observation !== 'object') throw new Error('typed observation is required');
  const targetId = C.assertExactIdentifier(observation.targetId, 'observation targetId');
  const observedAt = C.now(observation.observedAt);
  if (!Number.isFinite(Date.parse(observedAt))) throw new Error('observation timestamp is invalid');
  const attribution = C.compact(observation.attribution, 200);
  if (!attribution) throw new Error('observation attribution is required');
  const supplied = Array.isArray(observation.facts) ? observation.facts : null;
  if (!supplied) throw new Error('observation facts are required');
  if (supplied.length > maxFacts) throw new Error('typed fact budget exceeded');
  const facts = new Map();
  supplied.forEach(function (fact) {
    const id = C.assertExactIdentifier(fact && fact.id, 'fact id');
    if (facts.has(id)) throw new Error('duplicate fact id: ' + id);
    if (typeof fact.present !== 'boolean') throw new Error(id + ' must declare present as a boolean');
    if (fact.present && !Object.prototype.hasOwnProperty.call(fact, 'value')) throw new Error(id + ' is present but has no value');
    facts.set(id, { id, present: fact.present, valueDigest: fact.present ? C.digest(fact.value) : null });
  });
  return {
    targetId,
    observedAt,
    attributionDigest: C.digest(attribution),
    facts,
    structuralHash: C.compact(observation.structuralHash, 200) || null,
    observationDigest: C.digest({ targetId, observedAt, attribution, facts: supplied })
  };
}

function normalizeExpectations(values) {
  return (Array.isArray(values) ? values : []).slice(0, 40).map(function (entry) {
    if (typeof entry === 'string') {
      const split = entry.split(':');
      return { factId: C.assertExactIdentifier(split[0], 'expected factId'), classification: String(split[1] || '').toUpperCase() };
    }
    return { factId: C.assertExactIdentifier(entry && entry.factId, 'expected factId'), classification: String(entry && entry.classification || '').toUpperCase() };
  }).map(function (entry) {
    if (!CLASSIFICATIONS.includes(entry.classification)) throw new Error('invalid expected classification for ' + entry.factId);
    return entry;
  });
}

function create(options) {
  options = options || {};
  const store = C.createReceiptStore(options.receiptLimit);
  const maxFacts = Math.max(1, Math.min(80, Math.round(Number(options.maxFacts) || 80)));

  function seal(input, details) {
    return store.push(Object.assign({
      schema: RECEIPT_SCHEMA,
      capability: CAPABILITY,
      claim: C.compact(input.claim, 500),
      targetId: C.compact(input.targetId, 500),
      beforeObservedAt: null,
      afterObservedAt: null,
      beforeObservationDigest: null,
      afterObservationDigest: null,
      beforeAttributionDigest: null,
      afterAttributionDigest: null,
      changes: [],
      counts: { SAME: 0, CHANGED: 0, APPEARED: 0, DISAPPEARED: 0 },
      structuralHashChanged: null,
      verdict: 'UNKNOWN',
      namedSeams: [],
      causeClaimed: false,
      captureClaimed: false,
      inputObservationsRetained: false,
      rawRetainedBytesAfterSeal: 0,
      rawRetainedItemsAfterSeal: 0,
      cleanupComplete: true,
      tookNoDirectAction: true,
      nextCheapestDiff: 'Supply two attributable typed observations of the same target and fact dimensions.'
    }, details || {}));
  }

  function diff(input) {
    input = input || {};
    const targetId = C.assertExactIdentifier(input.targetId, 'targetId');
    const normalized = Object.assign({}, input, { targetId });
    let before, after, expected, refuting;
    try {
      before = normalizeObservation(input.beforeObservation, maxFacts);
      after = normalizeObservation(input.afterObservation, maxFacts);
      expected = normalizeExpectations(input.expectedChange);
      refuting = normalizeExpectations(input.refutingChange);
    } catch (error) {
      return seal(normalized, { namedSeams: ['INVALID_OR_INCOMPLETE_TYPED_OBSERVATION'], nextCheapestDiff: C.compact(error && error.message, 180) });
    }

    const identity = {
      beforeObservedAt: before.observedAt,
      afterObservedAt: after.observedAt,
      beforeObservationDigest: before.observationDigest,
      afterObservationDigest: after.observationDigest,
      beforeAttributionDigest: before.attributionDigest,
      afterAttributionDigest: after.attributionDigest
    };
    if (before.targetId !== targetId || after.targetId !== targetId) {
      return seal(normalized, Object.assign(identity, { verdict: 'INCOMPARABLE', namedSeams: ['TARGET_ID_MISMATCH'], nextCheapestDiff: 'Supply two observations carrying the exact requested targetId.' }));
    }
    if (Date.parse(before.observedAt) >= Date.parse(after.observedAt)) {
      return seal(normalized, Object.assign(identity, { verdict: 'UNKNOWN', namedSeams: ['OBSERVATION_ORDER_INVALID'], nextCheapestDiff: 'Supply a before observation with an earlier timestamp than the after observation.' }));
    }

    const beforeIds = Array.from(before.facts.keys()).sort(), afterIds = Array.from(after.facts.keys()).sort();
    if (JSON.stringify(beforeIds) !== JSON.stringify(afterIds)) {
      return seal(normalized, Object.assign(identity, { verdict: 'UNKNOWN', namedSeams: ['FACT_DIMENSIONS_INCOMPLETE'], nextCheapestDiff: 'Measure the same fact ids at both times; express known absence with present=false.' }));
    }

    const counts = { SAME: 0, CHANGED: 0, APPEARED: 0, DISAPPEARED: 0 };
    const changes = beforeIds.map(function (factId) {
      const left = before.facts.get(factId), right = after.facts.get(factId);
      let classification;
      if (!left.present && right.present) classification = 'APPEARED';
      else if (left.present && !right.present) classification = 'DISAPPEARED';
      else if (!left.present && !right.present) classification = 'SAME';
      else classification = left.valueDigest === right.valueDigest ? 'SAME' : 'CHANGED';
      counts[classification] += 1;
      return { factId, classification, beforeValueDigest: left.valueDigest, afterValueDigest: right.valueDigest };
    });
    function matches(expectation) {
      return changes.some(function (change) { return change.factId === expectation.factId && change.classification === expectation.classification; });
    }
    const refuted = refuting.some(matches), supported = expected.length > 0 && expected.every(matches);
    const verdict = refuted ? 'FAIL' : (supported ? 'PASS' : 'UNKNOWN');
    return seal(normalized, Object.assign(identity, {
      changes,
      counts,
      structuralHashChanged: before.structuralHash && after.structuralHash ? before.structuralHash !== after.structuralHash : null,
      verdict,
      namedSeams: verdict === 'UNKNOWN' ? ['CHANGE_CLAIM_INCONCLUSIVE'] : [],
      nextCheapestDiff: verdict === 'PASS'
        ? 'Preserve this as before/after evidence only; cause remains a separate claim.'
        : (verdict === 'FAIL' ? 'Route the refuting change to review; this sense does not diagnose cause.' : 'Name an expected or refuting fact classification for this bounded diff.')
    }));
  }

  return {
    capability: CAPABILITY,
    diff,
    receipts: store.list,
    status: function () { return C.status(store, { maxFacts, inputObservationsRetained: false }); }
  };
}

module.exports = { CAPABILITY, RECEIPT_SCHEMA, CLASSIFICATIONS, normalizeObservation, normalizeExpectations, create };
