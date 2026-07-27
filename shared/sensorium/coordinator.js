'use strict';

const C = require('./core');
const Runtime = require('./runtime-route');
const Gap = require('./capability-gap-router');
const EvidenceRouter = require('../ai-native-hands/evidence-router-hand');

function safeLease(input, senseId) {
  const lease = input.authorityLeases && input.authorityLeases[senseId];
  return lease && lease.current === true && lease.expired !== true ? lease.leaseId : null;
}
async function observeSession(input) {
  input = input || {};
  if (input.inheritedAuthorityLeaseId) throw new Error('coordinator refuses inherited authority');
  const claimId = C.assertExactIdentifier(input.claimId, 'claimId'), seatId = C.assertExactIdentifier(input.seatId, 'seatId'), targetId = C.assertExactIdentifier(input.targetId, 'targetId');
  const trace = [], routeResults = [], holds = [];
  async function call(id, payload, adapters, backendId) {
    try {
      const result = await Runtime.invoke(id, payload, { claimId, seatId, targetId, backendId: backendId || id, ttlMs: input.ttlMs, authorityLeaseId: safeLease(input, id), adapters: adapters || {} });
      routeResults.push(result); trace.push({ step: trace.length + 1, senseId: id, receiptId: result.envelope.receiptId, verdict: result.envelope.verdict, freshnessStatus: result.envelope.freshnessStatus });
      if (result.envelope.namedSeams.length) holds.push.apply(holds, result.envelope.namedSeams.map(function (seam) { return id + ': ' + seam; }));
      return result;
    } catch (error) {
      const route = Runtime.row(id);
      const gap = Gap.route({ capability: route.capability, adapters: input.hostAdapters || [], composableCapabilities: (input.observations || []).map(function (item) { return item.senseId; }) });
      trace.push({ step: trace.length + 1, senseId: id, state: gap.state, route: gap.route });
      holds.push(id + ': ' + C.compact(error.message, 240));
      return null;
    }
  }
  const touch = await call('touch-environment-probe', input.preflight || {}, { environment: input.adapters && input.adapters.environment }, 'environment-preflight');
  const timeBefore = await call('time-sense-ttl-verifier', { fact: input.claim, observedAt: input.observedAt, ttlMs: input.ttlMs, at: input.at }, {}, 'shared-clock');
  for (const observation of (input.observations || []).slice(0, 8)) {
    await call(observation.senseId, observation.input || {}, observation.adapters || {}, observation.backendId);
  }
  for (const result of routeResults.filter(function (item) { return item.routeId !== 'time-sense-ttl-verifier' && item.routeId !== 'handoff-continuity-steward'; })) {
    await call('time-sense-ttl-verifier', { fact: result.envelope.receiptId, observedAt: result.envelope.observedAt, ttlMs: result.envelope.ttlMs, at: input.at }, {}, 'shared-clock');
  }
  const evidenceRoute = EvidenceRouter.route({ id: claimId, claim: input.claim, kind: input.claimKind || 'behavior', risk: input.risk || 'medium', passCondition: input.passCondition || 'The bounded observations support the named claim without counterevidence.' });
  const observations = routeResults.filter(function (item) { return ['touch-environment-probe','time-sense-ttl-verifier','handoff-continuity-steward'].indexOf(item.routeId) < 0; });
  const stale = observations.some(function (item) { return item.envelope.freshnessStatus !== 'LIVE'; });
  const failed = observations.some(function (item) { return item.envelope.verdict === 'FAIL'; });
  const allPass = observations.length > 0 && observations.every(function (item) { return item.envelope.verdict === 'PASS'; });
  const recommendedVerdict = stale ? 'UNKNOWN' : (failed ? 'FAIL' : (allPass ? 'PASS' : 'UNKNOWN'));
  if (stale) holds.push('STALE_EVIDENCE_RECHECK_REQUIRED');
  if (!observations.length) holds.push('NO_OBSERVATION_ROUTE_COMPLETED');
  const continuityInput = {
    workLine: input.workLine || 'sensorium-session', turnId: input.sessionId || claimId, seat: seatId, accessReread: true,
    verifiedFacts: routeResults.map(function (result) { return { summary: result.routeId + ' ' + result.envelope.verdict, digest: C.digest(result.envelope), age: result.envelope.freshnessStatus }; }),
    assumedFacts: [], openHolds: holds, decisions: [{ summary: 'Recommended verdict ' + recommendedVerdict + '; recommendation only.' }], nextStep: holds.length ? 'Resolve the named holds and re-observe with current authority.' : 'Route the evidence to the appointed judgment seat.', chainIntact: true
  };
  await call('handoff-continuity-steward', continuityInput, { continuityStore: input.adapters && input.adapters.continuityStore }, 'continuity');
  const rawBytes = routeResults.reduce(function (sum, result) { return sum + result.envelope.rawRetainedBytesAfterSeal; }, 0);
  const rawItems = routeResults.reduce(function (sum, result) { return sum + result.envelope.rawRetainedItemsAfterSeal; }, 0);
  return {
    schema: 'axm.sensorium-session/v1', sessionId: C.assertExactIdentifier(input.sessionId || ('session-' + C.digest(claimId).slice(0, 12)), 'sessionId'),
    claimId, seatId, targetId, route: 'touch-time-observe-time-evidence-continuity', trace, evidenceRoute,
    recommendation: { verdict: recommendedVerdict, automaticVerdict: false, automaticAction: false }, holds,
    receipts: routeResults.map(function (result) { return result.envelope; }), specificReceiptDigests: routeResults.map(function (result) { return { senseId: result.routeId, digest: C.digest(result.specificReceipt) }; }),
    rawRetainedBytes: rawBytes, rawRetainedItems: rawItems, cleanupComplete: rawBytes === 0 && rawItems === 0,
    authorityInherited: false, permissionsTransferred: false,
    allowedEffects: ['recommendation','hold','typed-handoff'], refusedEffects: ['click','write-source','publish','promote','install','delete-source']
  };
}

module.exports = { observeSession, safeLease };
