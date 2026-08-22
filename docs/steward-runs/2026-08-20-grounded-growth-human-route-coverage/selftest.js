#!/usr/bin/env node
'use strict';

const assert = require('assert');
const path = require('path');
const Coverage = require('../../../shared/grounded-growth-human-route-coverage/grounded-growth-human-route-coverage');
const Human = require('../../../shared/human-benefit-evidence/human-benefit-evidence');
const Bridge = require('../../../shared/grounded-growth-human-bridge-v2/grounded-growth-human-bridge-v2');
const Builder = require('./build-current-human-route-coverage');
const Runner = require('./run-current-human-route-interactive');
const PriorRoutes = require('../2026-08-19-reuse-existing-human-bridge-ancestry/build-current-readiness');

let checks = 0;
function check(value, message) {
  assert.ok(value, message);
  checks += 1;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function buildCoverage(result, overrides) {
  const input = Object.assign({
    receiptId: result.coverage.receiptId,
    generatedAt: result.coverage.generatedAt,
    status: 'TEST',
    portfolio: result.portfolio,
    readyRoutes: result.readyRoutes,
    heldRoutes: result.heldRoutes,
    sourceRefs: result.coverage.sourceRefs
  }, overrides || {});
  return Coverage.build(input);
}

const result = Builder.checkRecorded();
const prior = PriorRoutes.verifyRecorded();
check(result.portfolio.outcomes.length === 10 && result.portfolio.latest.length === 6, 'the exact ten-outcome, six-chain current portfolio is preserved');
check(result.coverage.coverage.currentCapabilityChains === 6, 'coverage binds all six current capability chains');
check(result.coverage.coverage.readyRoutes === 5 && result.coverage.coverage.heldRoutes === 1, 'five routes are technically ready and one is explicitly held');
check(result.coverage.coverage.candidateAncestryReady === 3 && result.coverage.coverage.reuseExistingAncestryReady === 2, 'ancestry distribution is exact');
check(result.coverage.coverage.humanPass === 0 && result.coverage.coverage.humanNotRun === 6, 'technical readiness invents no human result');
check(result.coverage.decision.autonomousActionCount === 0 && result.coverage.decision.reviewableActionCount === 0, 'coverage grants no automatic or queued action');
check(Coverage.verify(result.coverage, {
  portfolio: result.portfolio,
  readyRoutes: result.readyRoutes,
  heldRoutes: result.heldRoutes,
  sourceRefs: result.coverage.sourceRefs
}).pass, 'native verification rebuilds the recorded coverage exactly');
const portable = Coverage.verifyPortable(result.coverage);
check(portable.pass && portable.sourceTruth === 'UNKNOWN' && portable.sourceCurrentness === 'UNKNOWN' && portable.humanBenefit === 'NOT_RUN', 'portable verification preserves its trust ceiling');

const provenances = result.readyRoutes.map((route) => route.provenance);
check(provenances.filter((item) => item === 'REUSED_PROTOCOL_AND_LINK_REBOUND_PACKET_TO_CURRENT_OUTCOME').length === 3, 'three prior protocol/link pairs remain exact reuse');
check(provenances.filter((item) => item === 'REUSED_SURFACES_AND_TRIALS_REFRESHED_PROTOCOL_AND_LINK_FOR_CURRENT_CLAIM').length === 1, 'source closure refreshes stale claim wording without discarding its surfaces or trials');
check(provenances.filter((item) => item === 'NEW_CLAIM_NATIVE_ROUTE').length === 1, 'one detached claim-native route is new');

for (const route of result.readyRoutes) {
  const latest = result.portfolio.latest.find((item) => item.capabilityId === route.capabilityId);
  check(route.packet.capabilityBinding.currentOutcomeRef.sha256 === latest.effectiveReceiptDigest, route.capabilityId + ' packet binds the exact latest outcome');
  check(!/(expectedDecision|\"BASELINE\"|\"CANDIDATE\"|artifactRef)/.test(Coverage.stableStringify(route.packet)), route.capabilityId + ' packet is answer-free');
  check(Human.verifyProtocol(route.protocol).pass, route.capabilityId + ' protocol verifies natively');
  check(Bridge.verifyInterventionLink(route.interventionLink, route.current.outcome.cycleReceipt, route.protocol).pass, route.capabilityId + ' intervention link verifies natively');
  check(route.protocol.claim.id === route.current.humanClaim.id && route.protocol.claim.statement === route.current.humanClaim.statement, route.capabilityId + ' protocol is claim-native');
}

for (const oldRoute of prior.routes) {
  const currentRoute = result.readyRoutes.find((route) => route.capabilityId === oldRoute.definition.capabilityId);
  check(currentRoute.current.outcome.cycleReceipt.receiptDigest === oldRoute.current.outcome.cycleReceipt.receiptDigest, oldRoute.definition.capabilityId + ' verified cycle ancestry is unchanged');
}

const sourceClosure = result.readyRoutes.find((route) => route.capabilityId === 'evidence.registered-source-closure/v1');
const oldSourceClosure = prior.routes.find((route) => route.definition.capabilityId === sourceClosure.capabilityId);
check(sourceClosure.protocol.claim.statement !== oldSourceClosure.protocol.claim.statement, 'source-closure claim drift is visible rather than silently reused');
check(Coverage.stableStringify(sourceClosure.protocol.conditions) === Coverage.stableStringify(oldSourceClosure.protocol.conditions), 'source-closure comparison surfaces remain exact');
check(Coverage.stableStringify(sourceClosure.protocol.trials) === Coverage.stableStringify(oldSourceClosure.protocol.trials), 'source-closure trial cases remain exact');

const hold = result.coverage.holds[0];
check(hold.capabilityId === 'growth.knowledge-signal-lineage.verify' && hold.proposalId === 'proposal:signal-link-ledger', 'signal-lineage route is bound to the exact deferred proposal');
check(hold.routeState === Coverage.HELD_DEFERRED && hold.automaticAction === false, 'deferred route remains typed and inert');
check(!result.readyRoutes.some((route) => route.capabilityId === hold.capabilityId), 'held signal-lineage route has no protocol, packet, link, or runner route');
check(result.catalog.heldRoutes[0].commandAvailable === false, 'catalog exposes no command for the held route');
check(result.catalog.readyRoutes.every((route) => route.humanEvidenceState === 'NOT_RUN' && route.sessionCommand && route.handoffCommand), 'catalog exposes only optional commands with NOT_RUN evidence');
check(result.summary.routes.exactProtocolAndLinkReuse === 3 && result.summary.routes.claimRefreshedRoutes === 1 && result.summary.routes.newSurfaceRoutes === 1, 'summary distinguishes reuse, claim refresh, and new surface work');
check(result.summary.truth.humanBenefitEstablished === false && result.summary.truth.participationOccurred === false, 'summary does not relabel readiness as participation or benefit');

const loaded = Runner.loadExactRoute('growth.current-state.detached-integrity.verify');
check(loaded.capabilityId === 'growth.current-state.detached-integrity.verify', 'runner resolves an exact ready capability selector');
assert.throws(() => Runner.loadExactRoute('growth.knowledge-signal-lineage.verify'), /route is held/i);
checks += 1;
assert.throws(() => Runner.loadExactRoute('not.a.current.capability'), /unsupported current capability route/i);
checks += 1;
assert.throws(() => Runner.loadExternalSessions(path.join(__dirname, 'CURRENT_HUMAN_ROUTE_CATALOG.json')), /outside the Workshop/i);
checks += 1;
const ttyDescriptor = Object.getOwnPropertyDescriptor(process.stdin, 'isTTY');
Object.defineProperty(process.stdin, 'isTTY', { value: false, configurable: true });
try {
  assert.throws(() => Runner.requireTty('fixture'), /local TTY.*refused before any prompt or session read/i);
  checks += 1;
} finally {
  if (ttyDescriptor) Object.defineProperty(process.stdin, 'isTTY', ttyDescriptor);
  else delete process.stdin.isTTY;
}

assert.throws(() => buildCoverage(result, { readyRoutes: result.readyRoutes.slice(1) }), /coverage is missing/i);
checks += 1;
assert.throws(() => buildCoverage(result, { heldRoutes: [{ ...result.heldRoutes[0], capabilityId: result.readyRoutes[0].capabilityId }] }), /duplicate/i);
checks += 1;

const staleReady = clone(result.readyRoutes);
staleReady[0].packet.capabilityBinding.currentOutcomeRef.sha256 = Human.sha256('stale-current-outcome');
staleReady[0].packet.packetDigest = Coverage.packetDigest(staleReady[0].packet);
assert.throws(() => buildCoverage(result, { readyRoutes: staleReady }), /current outcome reference mismatch/i);
checks += 1;

const leakingReady = clone(result.readyRoutes);
leakingReady[0].packet.trials[0].expectedDecision = 'HOLD';
leakingReady[0].packet.packetDigest = Coverage.packetDigest(leakingReady[0].packet);
assert.throws(() => buildCoverage(result, { readyRoutes: leakingReady }), /leaks expectedDecision/i);
checks += 1;

const crossedReady = clone(result.readyRoutes);
crossedReady[0].packet.capabilityBinding.capabilityId = crossedReady[1].capabilityId;
crossedReady[0].packet.packetDigest = Coverage.packetDigest(crossedReady[0].packet);
assert.throws(() => buildCoverage(result, { readyRoutes: crossedReady }), /capability binding mismatch/i);
checks += 1;

const unboundHold = clone(result.heldRoutes);
unboundHold[0].proposalId = null;
assert.throws(() => buildCoverage(result, { heldRoutes: unboundHold }), /requires proposalId/i);
checks += 1;

const inflated = clone(result.coverage);
inflated.truth.humanBenefitEstablished = true;
inflated.receiptDigest = Coverage.sha256((() => {
  const value = clone(inflated);
  delete value.receiptDigest;
  return value;
})());
check(!Coverage.verifyPortable(inflated).pass, 'a recomputed digest cannot inflate technical coverage into human benefit');

const activatedHold = clone(result.coverage);
activatedHold.holds[0].automaticAction = true;
activatedHold.receiptDigest = Coverage.sha256((() => {
  const value = clone(activatedHold);
  delete value.receiptDigest;
  return value;
})());
check(!Coverage.verifyPortable(activatedHold).pass, 'a recomputed digest cannot activate a deferred route');

console.log('PASS current Grounded Growth human-route coverage selftest (' + checks + ' assertions)');
