#!/usr/bin/env node
'use strict';

const assert = require('assert');
const http = require('http');
const core = require('../runtime/game-core');
const { TRANSPORT_METRICS, createRuntime } = require('../runtime/server');

function request(port, pathname, options) {
  const settings = options || {};
  return new Promise((resolve, reject) => {
    const payload = settings.body == null ? null : JSON.stringify(settings.body);
    const req = http.request({
      host: '127.0.0.1', port, path: pathname, method: settings.method || 'GET',
      headers: payload ? { 'content-type': 'application/json', 'content-length': Buffer.byteLength(payload) } : {}
    }, response => {
      let body = '';
      response.on('data', chunk => { body += chunk; });
      response.on('end', () => resolve({ status: response.statusCode, headers: response.headers, body }));
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

(async function () {
  let now = 1000;
  const runtime = createRuntime({
    manualTick: true,
    clock: () => now,
    roster: [
      { id: 'p1', seatId: 'seat_1', displayName: 'Mike', type: 'human' },
      { id: 'p2', seatId: 'seat_2', displayName: 'Friend', type: 'human' },
      { id: 'p3', seatId: 'seat_3', displayName: 'Codex', type: 'ai' },
      { id: 'p4', seatId: 'seat_4', displayName: 'Mirror', type: 'ai' }
    ],
    env: { MIRRORSHIFT_SEED: '15015' }
  });
  await new Promise(resolve => runtime.server.listen(0, '127.0.0.1', resolve));
  const port = runtime.server.address().port;
  try {
    const health = await request(port, '/health');
    assert.equal(health.status, 200);
    const healthBody = JSON.parse(health.body);
    assert.equal(healthBody.gameId, '015-axm-mirrorshift');
    assert.equal(healthBody.stateAuthority, 'server');
    assert.match(healthBody.status, /V23/);
    assert.match(healthBody.status, /LIVING CIRCUITS/);
    assert.equal(healthBody.networkBind.policy, 'standalone-loopback-or-explicit-override');
    assert.equal(healthBody.mode, 'race');
    assert.equal(healthBody.routeDirectionId, 'forward');

    const page = await request(port, '/games/015/');
    assert.equal(page.status, 200);
    assert.match(page.body, /performance-recorder\.js\?v=0\.13\.0/);
    assert.match(page.body, /lan-qualification\.js\?v=0\.16\.0/);
    assert.match(page.body, /lan-lab-ui\.js\?v=0\.16\.0/);
    assert.match(page.body, /mirror-echo\.js\?v=0\.21\.0/);
    const recorderScript = await request(port, '/games/015/performance-recorder.js');
    assert.equal(recorderScript.status, 200);
    assert.match(recorderScript.body, /axm\.target-session-performance\/v1/);
    const performanceUi = await request(port, '/games/015/performance-ui.js');
    assert.equal(performanceUi.status, 200);
    assert.match(performanceUi.body, /__MIRRORSHIFT_PERFORMANCE__/);
    const lanQualificationScript = await request(port, '/games/015/lan-qualification.js');
    assert.equal(lanQualificationScript.status, 200);
    assert.match(lanQualificationScript.body, /axm\.four-phone-lan-qualification\/v1/);
    assert.match(lanQualificationScript.body, /axm\.four-phone-lan-preflight\/v1/);
    const lanLabUi = await request(port, '/games/015/lan-lab-ui.js');
    assert.equal(lanLabUi.status, 200);
    assert.match(lanLabUi.body, /__MIRRORSHIFT_LAN_QUALIFICATION__/);
    assert.match(page.body, /MIRROR<span>SHIFT/);
    assert.match(page.headers['content-security-policy'], /default-src 'self'/);

    const controller = await request(port, '/controller.html?room=AXM1&player=p2');
    assert.equal(controller.status, 200);
    assert.match(controller.body, /name="viewport"/);
    assert.match(controller.body, /CONFIRM SEAT/);
    assert.match(controller.body, /\/api\/seat-confirm/);

    const art = await request(port, '/games/015/assets/mirrorshift-roster-key-art-v1.png');
    assert.equal(art.status, 200);
    assert.equal(art.headers['content-type'], 'image/png');
    assert(art.body.length > 100000);

    const launcher = JSON.parse((await request(port, '/api/launcher-state')).body);
    assert.equal(launcher.authority.race, 'managed-server');
    assert.equal(launcher.controllerLinks.length, 2);
    assert.match(launcher.controllerLinks[1].localPath, /player=p2/);
    assert.equal(launcher.transport.sessionPath, '/api/session');
    assert.equal(launcher.transport.heartbeatPath, '/api/heartbeat');
    assert.equal(launcher.transport.seatConfirmationPath, '/api/seat-confirm');
    assert.equal(launcher.transport.seatConfirmationSchema, 'axm.mirrorshift-seat-confirmation/v1');
    assert.equal(launcher.transport.actionReceiptSchema, 'axm.mirrorshift-action-receipt/v1');
    assert.equal(launcher.transport.characterPath, '/api/character');
    assert.equal(launcher.transport.variantPath, '/api/variant');
    assert.equal(launcher.transport.routeDirectionPath, '/api/route-direction');
    assert.equal(launcher.transport.tourAdvancePath, '/api/tour/advance');
    assert.equal(launcher.transport.heartbeatMs, 1000);
    assert.equal(launcher.transport.inputOwnerLeaseMs, 900);

    const sessionId = 'http-test-p1-session';
    const firstSession = JSON.parse((await request(port, '/api/session', { method: 'POST', body: { player: 'p1', sessionId, clientKind: 'controller' } })).body).session;
    assert.equal(firstSession.resumed, false);
    assert.equal(firstSession.nextSeq, 1);
    assert.equal(firstSession.player, 'p1');
    assert.equal(firstSession.clientKind, 'controller');
    assert.equal(firstSession.seatConfirmed, false);

    const seatConfirmation = await request(port, '/api/seat-confirm', { method: 'POST', body: { player: 'p1', sessionId } });
    assert.equal(seatConfirmation.status, 200);
    const seatConfirmationBody = JSON.parse(seatConfirmation.body);
    assert.equal(seatConfirmationBody.schema, 'axm.mirrorshift-seat-confirmation/v1');
    assert.equal(seatConfirmationBody.confirmed, true);
    assert.equal(seatConfirmationBody.confirmationCount, 1);

    const assist = await request(port, '/api/assist', { method: 'POST', body: { player: 'p1', assists: { steering: true, autoAccelerate: true } } });
    assert.equal(assist.status, 200);
    assert.equal(JSON.parse(assist.body).state.racers.p1.assists.steering, .22);
    assert.equal(JSON.parse(assist.body).assistContract.changesVehicleStats, false);

    const track = await request(port, '/api/track', { method: 'POST', body: { trackId: 'splitglass-gardens' } });
    assert.equal(track.status, 200);
    assert.equal(JSON.parse(track.body).state.trackId, 'splitglass-gardens');
    assert.equal(JSON.parse(track.body).tracks.length, 3);

    const variant = await request(port, '/api/variant', { method: 'POST', body: { variantId: 'shardline-sprint' } });
    assert.equal(variant.status, 200);
    assert.equal(JSON.parse(variant.body).state.variantId, 'shardline-sprint');
    assert.equal(JSON.parse(variant.body).state.raceLaps, 2);
    assert.equal(JSON.parse(variant.body).raceVariants.length, 3);

    const reflection = await request(port, '/api/route-direction', { method: 'POST', body: { routeDirectionId: 'reflection' } });
    assert.equal(reflection.status, 200);
    const reflectionBody = JSON.parse(reflection.body);
    assert.equal(reflectionBody.state.routeDirectionId, 'reflection');
    assert.equal(reflectionBody.routeDirections.length, 2);
    assert.deepEqual(reflectionBody.state.track.points[1], core.TRACKS[core.TRACK_IDS.GARDENS].points.at(-1));

    const mode = await request(port, '/api/mode', { method: 'POST', body: { mode: 'battle' } });
    assert.equal(mode.status, 200);
    assert.equal(JSON.parse(mode.body).state.mode, 'battle');
    const battleRoute = await request(port, '/api/route-direction', { method: 'POST', body: { routeDirectionId: 'forward' } });
    assert.equal(battleRoute.status, 409);
    assert.equal(JSON.parse(battleRoute.body).reason, 'battle-mode');

    const character = await request(port, '/api/character', { method: 'POST', body: { player: 'p2', characterId: 'p4' } });
    assert.equal(character.status, 200);
    const characterBody = JSON.parse(character.body);
    assert.equal(characterBody.state.racers.p2.characterId, 'p4');
    assert.equal(characterBody.state.racers.p2.character, 'Mirror');
    assert.equal(characterBody.state.racers.p4.characterId, 'p2');
    assert.equal(new Set(Object.values(characterBody.state.racers).map(racer => racer.characterId)).size, 4);

    const start = await request(port, '/api/start', { method: 'POST' });
    assert.equal(start.status, 200);
    now += 3300;
    runtime.advance(now);

    const drive = await request(port, '/api/action', { method: 'POST', body: {
      player: 'p1', sessionId, requestId: 'http-drive-1',
      action: { type: 'drive', throttle: 1, steer: .25, seq: firstSession.nextSeq }
    } });
    assert.equal(drive.status, 200);
    const driveBody = JSON.parse(drive.body);
    assert.equal(driveBody.receipt.schema, 'axm.mirrorshift-action-receipt/v1');
    assert.equal(driveBody.receipt.requestId, 'http-drive-1');
    assert.equal(driveBody.receipt.accepted, true);
    assert.equal(driveBody.receipt.nextSeq, 2);

    const resumedSession = JSON.parse((await request(port, '/api/session', { method: 'POST', body: { player: 'p1', sessionId, clientKind: 'controller' } })).body).session;
    assert.equal(resumedSession.resumed, true);
    assert.equal(resumedSession.resumeCount, 1);
    assert.equal(resumedSession.nextSeq, 2);
    assert.equal(resumedSession.seatConfirmed, true);
    const resumedDrive = await request(port, '/api/action', { method: 'POST', body: {
      player: 'p1', sessionId, requestId: 'http-drive-2',
      action: { type: 'drive', throttle: .75, steer: -.2, seq: resumedSession.nextSeq }
    } });
    assert.equal(resumedDrive.status, 200);
    assert.equal(JSON.parse(resumedDrive.body).receipt.sequence, 2);
    const staleDrive = await request(port, '/api/action', { method: 'POST', body: {
      player: 'p1', sessionId, requestId: 'http-stale',
      action: { type: 'drive', throttle: 1, steer: 1, seq: resumedSession.nextSeq }
    } });
    assert.equal(staleDrive.status, 409);
    assert.equal(JSON.parse(staleDrive.body).receipt.reason, 'stale-sequence');

    const secondSessionId = 'http-test-p1-screen-session';
    const secondSession = JSON.parse((await request(port, '/api/session', { method: 'POST', body: { player: 'p1', sessionId: secondSessionId, clientKind: 'screen' } })).body).session;
    assert.equal(secondSession.resumed, false);
    assert.equal(secondSession.nextSeq, 1);
    assert.equal(secondSession.clientKind, 'screen');
    assert.equal(secondSession.seatConfirmed, false);
    const screenConfirmation = await request(port, '/api/seat-confirm', { method: 'POST', body: { player: 'p1', sessionId: secondSessionId } });
    assert.equal(screenConfirmation.status, 409);
    assert.equal(JSON.parse(screenConfirmation.body).error, 'controller-session-required');
    const secondSessionDrive = await request(port, '/api/action', { method: 'POST', body: {
      player: 'p1', sessionId: secondSessionId, requestId: 'http-screen-drive-1',
      action: { type: 'drive', throttle: .6, steer: .1, seq: secondSession.nextSeq }
    } });
    assert.equal(secondSessionDrive.status, 200);
    assert.equal(JSON.parse(secondSessionDrive.body).receipt.serverSequence, 3);
    assert.equal(JSON.parse(secondSessionDrive.body).receipt.applied, false);
    assert.equal(JSON.parse(secondSessionDrive.body).receipt.reason, 'input-owner-active');
    const originalSessionAgain = await request(port, '/api/action', { method: 'POST', body: {
      player: 'p1', sessionId, requestId: 'http-drive-3',
      action: { type: 'drive', throttle: .9, steer: 0, seq: 3 }
    } });
    assert.equal(originalSessionAgain.status, 200);
    assert.equal(JSON.parse(originalSessionAgain.body).receipt.serverSequence, 3);
    assert.equal(JSON.parse(originalSessionAgain.body).receipt.applied, true);
    const heartbeat = await request(port, '/api/heartbeat', { method: 'POST', body: { player: 'p1', sessionId: secondSessionId } });
    assert.equal(heartbeat.status, 200);
    assert.equal(JSON.parse(heartbeat.body).schema, 'axm.mirrorshift-heartbeat/v1');
    assert.equal(JSON.parse(heartbeat.body).nextSeq, 2);
    const clientTelemetry = await request(port, '/api/client-telemetry', { method: 'POST', body: {
      player: 'p1', sessionId, requestId: 'http-drive-2', rttMs: 12.5
    } });
    assert.equal(clientTelemetry.status, 200);
    now += 50;
    runtime.advance(now);

    const state = JSON.parse((await request(port, '/api/state')).body);
    assert.equal(state.authority, 'server');
    assert.equal(state.state.phase, 'racing');
    assert.equal(state.state.mode, 'battle');
    assert.equal(Object.keys(state.state.racers).length, 4);
    assert.equal(state.itemWeights.filter(item => state.items[item.id].attack).reduce((sum, item) => sum + item.weight, 0), 85);
    assert.equal(state.battleItemWeights.filter(item => state.items[item.id].attack).reduce((sum, item) => sum + item.weight, 0), 90);

    const observation = JSON.parse((await request(port, '/api/observe?player=p1')).body).observation;
    assert.equal(observation.self.character, 'Mike');
    assert.equal(observation.mode, 'battle');
    assert.equal(typeof observation.self.score, 'number');
    assert.equal(observation.hiddenStateExcluded, true);

    const lockedMode = await request(port, '/api/mode', { method: 'POST', body: { mode: 'race' } });
    assert.equal(lockedMode.status, 409);
    const lockedTrack = await request(port, '/api/track', { method: 'POST', body: { trackId: 'null-foundry' } });
    assert.equal(lockedTrack.status, 409);
    const lockedVariant = await request(port, '/api/variant', { method: 'POST', body: { variantId: 'redline-gauntlet' } });
    assert.equal(lockedVariant.status, 409);
    assert.equal(JSON.parse(lockedVariant.body).reason, 'variant-locked');
    const lockedRoute = await request(port, '/api/route-direction', { method: 'POST', body: { routeDirectionId: 'forward' } });
    assert.equal(lockedRoute.status, 409);
    assert.equal(JSON.parse(lockedRoute.body).reason, 'route-direction-locked');
    const lockedAssist = await request(port, '/api/assist', { method: 'POST', body: { player: 'p1', assists: { steering: false } } });
    assert.equal(lockedAssist.status, 409);
    const lockedCharacter = await request(port, '/api/character', { method: 'POST', body: { player: 'p1', characterId: 'p2' } });
    assert.equal(lockedCharacter.status, 409);
    assert.equal(JSON.parse(lockedCharacter.body).reason, 'character-locked');

    const telemetry = JSON.parse((await request(port, '/api/telemetry')).body);
    assert.equal(telemetry.ok, true);
    assert(telemetry.tickMs.average >= 0);
    assert.equal(telemetry.transport.schema, 'axm.mirrorshift-transport-telemetry/v1');
    assert.equal(telemetry.transport.sessionCount, 2);
    assert.equal(telemetry.transport.resumeCount, 1);
    assert.equal(telemetry.transport.actionReceipts.accepted, 4);
    assert.equal(telemetry.transport.actionReceipts.rejected, 1);
    assert.equal(telemetry.transport.actionReceipts.applied, 3);
    assert.equal(telemetry.transport.actionReceipts.ignored, 1);
    assert.equal(telemetry.transport.clientReportedRoundTripMs.p95, 12.5);
    assert.equal(telemetry.transport.sessions.find(session => session.sessionId === sessionId).nextSeq, 4);
    assert.equal(telemetry.transport.sessions.find(session => session.sessionId === secondSessionId).nextSeq, 2);
    assert.equal(telemetry.transport.sessions.find(session => session.sessionId === secondSessionId).ignoredActions, 1);
    assert.equal(telemetry.transport.sessions.find(session => session.sessionId === sessionId).clientKind, 'controller');
    assert.equal(telemetry.transport.sessions.find(session => sessionId === session.sessionId).roundTripMs.p95, 12.5);
    assert.equal(telemetry.transport.sessions.find(session => sessionId === session.sessionId).appliedMeaningfulDriveActions, 3);
    assert.equal(telemetry.transport.sessions.find(session => sessionId === session.sessionId).seatConfirmed, true);
    assert.equal(telemetry.transport.sessions.find(session => sessionId === session.sessionId).seatConfirmCount, 1);
    assert.equal(telemetry.transport.sessions.find(session => secondSessionId === session.sessionId).clientKind, 'screen');
    assert.equal(telemetry.transport.sessions.find(session => secondSessionId === session.sessionId).seatConfirmed, false);
    assert.equal(telemetry.transport.sessions.find(session => secondSessionId === session.sessionId).heartbeatCount, 1);

    now += TRANSPORT_METRICS.sessionRetentionMs + 1;
    const expiredTelemetry = JSON.parse((await request(port, '/api/telemetry')).body);
    assert.equal(expiredTelemetry.transport.sessionCount, 0);
    assert.equal(expiredTelemetry.transport.activeSessionCount, 0);

    const reset = await request(port, '/api/reset', { method: 'POST' });
    assert.equal(reset.status, 200);
    assert.equal(JSON.parse(reset.body).state.mode, 'battle');
    assert.equal(JSON.parse(reset.body).state.trackId, 'splitglass-gardens');
    assert.equal(JSON.parse(reset.body).state.variantId, 'shardline-sprint');
    assert.equal(JSON.parse(reset.body).state.raceLaps, 2);
    assert.equal(JSON.parse(reset.body).state.racers.p1.assists.autoAccelerate, true);
    assert.equal(JSON.parse(reset.body).state.racers.p2.characterId, 'p4');
    assert.equal(JSON.parse(reset.body).state.racers.p4.characterId, 'p2');

    const raceReset = await request(port, '/api/reset', { method: 'POST', body: { mode: 'race', trackId: 'null-foundry', variantId: 'redline-gauntlet', routeDirectionId: 'reflection' } });
    assert.equal(raceReset.status, 200);
    assert.equal(JSON.parse(raceReset.body).state.mode, 'race');
    assert.equal(JSON.parse(raceReset.body).state.trackId, 'null-foundry');
    assert.equal(JSON.parse(raceReset.body).state.variantId, 'redline-gauntlet');
    assert.equal(JSON.parse(raceReset.body).state.raceLaps, 4);
    assert.equal(JSON.parse(raceReset.body).state.routeDirectionId, 'reflection');
    const healthAfter = JSON.parse((await request(port, '/health')).body);
    assert.equal(healthAfter.trackId, 'null-foundry');
    assert.equal(healthAfter.variantId, 'redline-gauntlet');
    assert.equal(healthAfter.raceLaps, 4);
    assert.equal(healthAfter.routeDirectionId, 'reflection');

    const tourReset = await request(port, '/api/reset', { method: 'POST', body: { mode: 'tour', trackId: 'null-foundry', variantId: 'redline-gauntlet' } });
    assert.equal(tourReset.status, 200);
    const tourState = JSON.parse(tourReset.body).state;
    assert.equal(tourState.mode, 'tour');
    assert.equal(tourState.trackId, 'mirror-forge');
    assert.equal(tourState.variantId, 'clear-signal');
    assert.equal(tourState.routeDirectionId, 'forward');
    assert.equal(tourState.tour.roundIndex, 0);
    assert.deepEqual(tourState.tour.points, { p1: 0, p2: 0, p3: 0, p4: 0 });
    const tourTrackLock = await request(port, '/api/track', { method: 'POST', body: { trackId: 'null-foundry' } });
    assert.equal(tourTrackLock.status, 409);
    assert.equal(JSON.parse(tourTrackLock.body).reason, 'tour-itinerary');
    const tourVariantLock = await request(port, '/api/variant', { method: 'POST', body: { variantId: 'redline-gauntlet' } });
    assert.equal(tourVariantLock.status, 409);
    assert.equal(JSON.parse(tourVariantLock.body).reason, 'tour-itinerary');
    const tourRouteLock = await request(port, '/api/route-direction', { method: 'POST', body: { routeDirectionId: 'reflection' } });
    assert.equal(tourRouteLock.status, 409);
    assert.equal(JSON.parse(tourRouteLock.body).reason, 'tour-itinerary');
    const earlyTourAdvance = await request(port, '/api/tour/advance', { method: 'POST' });
    assert.equal(earlyTourAdvance.status, 409);
    assert.equal(JSON.parse(earlyTourAdvance.body).reason, 'tour-round-active');
    const tourStart = await request(port, '/api/start', { method: 'POST' });
    assert.equal(tourStart.status, 200);
    const tourObservation = JSON.parse((await request(port, '/api/observe?player=p1')).body).observation;
    assert.equal(tourObservation.mode, 'tour');
    assert.equal(tourObservation.tour.roundNumber, 1);
    assert.equal(tourObservation.tour.roundCount, 3);

    const traversal = await request(port, '/games/015/..%2Fserver.js');
    assert.equal(traversal.status, 404);
    console.log('MIRRORSHIFT HTTP TEST PASS · live server, mode/track/variant/reflection/tour authority locks, resumable dual sessions, heartbeat, acknowledgement receipts, input ownership, client RTT, controller, state, art, observation, profile-preserving reset, traversal');
  } finally {
    await new Promise(resolve => runtime.server.close(resolve));
  }
})().catch(error => {
  console.error(error.stack);
  process.exitCode = 1;
});
