'use strict';

const assert = require('node:assert/strict');
const lan = require('../runtime/lan-qualification');

let now = 0;
const wall = Date.UTC(2026, 6, 28, 9, 0, 0);

function controller(player, index, overrides) {
  const step = index || 0;
  return Object.assign({
    player,
    sessionId: 'controller-' + player + '-held-out-device',
    clientKind: 'controller',
    connected: true,
    seatConfirmed: true,
    resumes: player === 'p3' && step >= 60 ? 1 : 0,
    appliedMeaningfulDriveActions: step,
    itemAttempts: step,
    heartbeatCount: step,
    acceptedActions: step * 2,
    rejectedActions: 0,
    ignoredActions: 0,
    roundTripMs: { sampleCount: step, average: 14 + Number(player.slice(1)), p95: 22 + Number(player.slice(1)), max: 36 }
  }, overrides || {});
}

const readyPreflightPacket = {
  ok: true,
  transport: {
    sessions: lan.SEATS.map(player => controller(player, 0)).concat([
      { player: 'p1', sessionId: 'screen-p1-preflight', clientKind: 'screen', connected: true }
    ])
  }
};
const readyPreflight = lan.inspectPreflight(readyPreflightPacket);
assert.equal(readyPreflight.schema, lan.PREFLIGHT_SCHEMA);
assert.equal(readyPreflight.ready, true);
assert.equal(readyPreflight.connectedSeatCount, 4);
assert.equal(readyPreflight.confirmedSeatCount, 4);
assert.equal(readyPreflight.duplicateSeatCount, 0);
assert.equal(JSON.stringify(readyPreflight).includes('held-out-device'), false);
assert.equal(readyPreflight.privacy.sessionIdsRetained, false);

const missingPreflight = lan.inspectPreflight({ ok: true, transport: { sessions: lan.SEATS.slice(0, 3).map(player => controller(player, 0)) } });
assert.equal(missingPreflight.ready, false);
assert.deepEqual(missingPreflight.missingSeats, ['p4']);

const unconfirmedPreflight = lan.inspectPreflight({ ok: true, transport: { sessions: lan.SEATS.map(player => controller(player, 0, player === 'p3' ? { seatConfirmed: false } : null)) } });
assert.equal(unconfirmedPreflight.ready, false);
assert.equal(unconfirmedPreflight.connectedSeatCount, 4);
assert.equal(unconfirmedPreflight.confirmedSeatCount, 3);
assert.deepEqual(unconfirmedPreflight.unconfirmedSeats, ['p3']);
assert.equal(unconfirmedPreflight.seats[2].status, 'unconfirmed');

const duplicatePreflight = lan.inspectPreflight({ ok: true, transport: { sessions: lan.SEATS.map(player => controller(player, 0)).concat([controller('p1', 0, { sessionId: 'controller-p1-duplicate-preflight' })]) } });
assert.equal(duplicatePreflight.ready, false);
assert.deepEqual(duplicatePreflight.duplicateSeats, ['p1']);
assert.equal(duplicatePreflight.seats[0].connectedControllers, 2);

const staleDuplicatePreflight = lan.inspectPreflight({ ok: true, transport: { sessions: lan.SEATS.map(player => controller(player, 0)).concat([controller('p2', 0, { connected: false, sessionId: 'controller-p2-stale-preflight' })]) } });
assert.equal(staleDuplicatePreflight.ready, false);
assert.deepEqual(staleDuplicatePreflight.duplicateSeats, ['p2']);
assert.equal(staleDuplicatePreflight.seats[1].connectedControllers, 1);
assert.equal(staleDuplicatePreflight.seats[1].controllerSessions, 2);

const unhealthyPreflight = lan.inspectPreflight({ ok: false });
assert.equal(unhealthyPreflight.ready, false);
assert.equal(unhealthyPreflight.telemetryHealthy, false);

const qualification = lan.createQualification({ requestedDurationMs: 1800000, now: () => now, wallNow: () => wall, startPreflight: readyPreflight });
qualification.setAttestations({ fourIndependentPhysicalPhones: true, intendedRouterLan: true, seatIdentityConfirmed: true });
assert.equal(qualification.start(), true);

for (let index = 0; index <= 100; index += 1) {
  now = index * 18000;
  const sessions = lan.SEATS.map(player => controller(player, index, player === 'p1' ? { ignoredActions: index >= 10 ? 3 : 0 } : null));
  if (index === 45) sessions.find(item => item.player === 'p3').connected = false;
  sessions.push({ player: 'p1', sessionId: 'screen-p1-held-out', clientKind: 'screen', connected: true, ignoredActions: index >= 10 ? 3 : 0 });
  qualification.recordTelemetry({
    ok: true,
    transport: {
      actionReceipts: { accepted: index * 8, rejected: 0, applied: index * 8 - (index >= 10 && index < 90 ? 3 : 0), ignored: index >= 10 && index < 90 ? 3 : 0 },
      sessions
    }
  });
}

now = 1800000;
const receipt = qualification.stop('duration-complete');
assert.equal(receipt.schema, lan.SCHEMA);
assert.equal(receipt.status, 'complete');
assert.equal(receipt.durationClass, 'thirty-minute-four-phone-gate');
assert.equal(receipt.telemetrySnapshots, 101);
assert.equal(receipt.startPreflight.ready, true);
assert.equal(receipt.machineChecks.startPreflightReady, true);
assert.equal(receipt.machineChecks.controllerSeatConfirmationsReady, true);
assert.equal(receipt.allFourConnected.samples, 100);
assert.ok(receipt.allFourConnected.ratio >= .99);
assert.equal(receipt.seats.length, 4);
receipt.seats.forEach(seat => {
  assert.equal(seat.controllerSessionCount, 1);
  assert.equal(seat.maxConcurrentControllers, 1);
  assert.ok(seat.appliedMeaningfulDriveActions >= 100);
  assert.ok(seat.itemAttempts >= 100);
  assert.ok(seat.heartbeats >= 100);
  assert.ok(seat.roundTripMs.samples >= 100);
  assert.ok(seat.roundTripMs.p95WorstObserved <= 26);
  assert.equal(seat.machineReady, true);
});
assert.equal(receipt.totalReconnects, 1);
assert.equal(receipt.transportDelta.ignored, 0);
assert.equal(receipt.seats[0].ignoredActions, 3);
assert.equal(receipt.machineChecks.reconnectObserved, true);
assert.equal(receipt.machineChecks.inputOwnershipProtectionObserved, true);
assert.equal(receipt.eligibleForStewardReview, true);
assert.equal(receipt.physicalGateVerdict, 'requires-external-steward-review');
assert.equal(receipt.privacy.sessionIdsRetained, false);
assert.equal(JSON.stringify(receipt).includes('held-out-device'), false);
assert.ok(Buffer.byteLength(JSON.stringify(receipt)) < 30000);
assert.match(receipt.evidenceBoundaries.join(' '), /do not prove that four independent physical phones/i);

let partialNow = 0;
const partial = lan.createQualification({ requestedDurationMs: 120000, now: () => partialNow, wallNow: () => wall });
partial.start();
partial.recordTelemetry({ ok: true, transport: { actionReceipts: {}, sessions: [] } });
partialNow = 10000;
const partialReceipt = partial.stop('manual');
assert.equal(partialReceipt.status, 'partial');
assert.equal(partialReceipt.eligibleForStewardReview, false);
assert.equal(partialReceipt.machineChecks.allSeatsReady, false);
assert.equal(partialReceipt.machineChecks.startPreflightReady, false);
assert.equal(Object.values(partialReceipt.hostAttestations).every(Boolean), false);

let duplicateNow = 0;
const duplicate = lan.createQualification({ requestedDurationMs: 10000, now: () => duplicateNow, wallNow: () => wall, thresholds: { connectedRatio: 0, roundTripSamplesPerSeat: 0, heartbeatsPerSeat: 0, meaningfulDriveActionsPerSeat: 0, itemAttemptsPerSeat: 0, reconnectsTotal: 0, ignoredActionsTotal: 0 } });
duplicate.start();
duplicate.recordTelemetry({ ok: true, transport: { actionReceipts: {}, sessions: [controller('p1', 1), controller('p1', 1, { sessionId: 'controller-p1-duplicate' })] } });
duplicateNow = 10000;
const duplicateReceipt = duplicate.stop('duration-complete');
assert.equal(duplicateReceipt.seats[0].maxConcurrentControllers, 2);
assert.equal(duplicateReceipt.seats[0].checks.stableSingleSession, false);
assert.equal(duplicateReceipt.eligibleForStewardReview, false);

console.log('MIRRORSHIFT FOUR-PHONE LAN QUALIFICATION PASS · four controller confirmations gated · 101 bounded snapshots · reconnect and ownership challenge · physical verdict preserved');
