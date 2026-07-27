'use strict';

const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const { createDistrictPartyServer } = require('../server/server');
const { advanceWorld } = require('../server/world-loop');

const projectRoot = path.join(__dirname, '..');

async function jsonRequest(base, pathname, options = {}) {
  const response = await fetch(`${base}${pathname}`, options);
  const json = await response.json();
  return { response, json };
}

test('live server serves static clients and completes start/input/state/settings/restart/end flow', async (t) => {
  const runtime = createDistrictPartyServer({
    projectRoot,
    host: '127.0.0.1',
    port: 0,
    autoStartLoop: false,
    logger: { error() {} },
  });
  const address = await runtime.listen();
  const base = `http://127.0.0.1:${address.port}`;
  t.after(async () => runtime.close());

  assert.equal(fs.existsSync(runtime.pidPath), true, 'PID file exists while host is running');
  const health = await jsonRequest(base, '/health');
  assert.equal(health.response.status, 200);
  assert.equal(health.json.localOnly, true);

  const oversizedResponse = await fetch(`${base}/api/session/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ padding: 'x'.repeat(70 * 1024) }),
  });
  assert.equal(oversizedResponse.status, 413, 'oversized JSON receives a graceful 413');
  assert.equal((await oversizedResponse.json()).error, 'body_too_large');

  for (const route of ['/', '/party-screen.html?party=party_a', '/controller.html', '/controller/controller.js', '/controller/axm-game-night-controls.js', '/game/', '/game/results.css', '/game/inventory.css', '/game/ui/inventory-overlay.js', '/game/ui/city-map.js', '/common.css', '/vendor/qrcode.js', '/data/map.json', '/data/item-schema.json', '/data/group-save-schema.json', '/data/controller-profile.json', '/data/territory-zones.json']) {
    const response = await fetch(`${base}${route}`);
    assert.equal(response.status, 200, `${route} static load`);
  }
  const traversal = await fetch(`${base}/assets/%2e%2e/server/server.js`);
  assert.equal(traversal.status, 404, 'directory traversal is rejected');
  const saveCatalog = await jsonRequest(base, '/api/group-saves');
  assert.equal(saveCatalog.response.status, 200);
  assert.equal(saveCatalog.json.slotCount, 9);
  assert.equal(saveCatalog.json.slots.length, 9);
  assert.equal(saveCatalog.json.profileAccountsUsed, false);

  const players = Array.from({ length: 4 }, (_, index) => ({
    slot: index + 1,
    seatId: `seat_${index + 1}`,
    displayName: `P${index + 1}`,
    controllerType: 'human',
  }));
  const started = await jsonRequest(base, '/api/session/start', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ roomCode: 'AXM1', players }),
  });
  assert.equal(started.response.status, 201);
  assert.equal(started.json.players.length, 4);
  assert.equal(started.json.controllerLinks.length, 4);
  assert.ok(started.json.hostToken);

  const { sessionId, hostToken } = started.json;
  const p1 = started.json.controllerLinks.find((link) => link.seatId === 'seat_1');
  const input = await jsonRequest(base, '/api/input', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ roomCode: 'AXM1', sessionId, seatId: 'seat_1', token: p1.token, seq: 1, input: { moveY: -1 } }),
  });
  assert.equal(input.json.actorId, 'actor-seat-1');

  const wrongRoom = await jsonRequest(base, '/api/input', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ roomCode: 'AXM2', sessionId, seatId: 'seat_1', token: p1.token, seq: 2, input: {} }),
  });
  assert.equal(wrongRoom.response.status, 403, 'valid token cannot cross room binding');

  const rejected = await jsonRequest(base, '/api/input', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      roomCode: 'AXM1',
      sessionId,
      seatId: 'seat_1',
      token: `${p1.token.slice(0, -1)}${p1.token.endsWith('0') ? '1' : '0'}`,
      seq: 2,
      input: {},
    }),
  });
  assert.equal(rejected.response.status, 403);

  const controller = await jsonRequest(base, `/api/controller-info?roomCode=AXM1&sessionId=${sessionId}&seatId=seat_1&token=${p1.token}`);
  assert.equal(controller.json.player.displayName, 'P1');
  assert.equal(controller.json.player.acceptedSeq, 1, 'reload bootstrap receives current accepted sequence');
  const wrongRoomController = await jsonRequest(base, `/api/controller-info?roomCode=AXM2&sessionId=${sessionId}&seatId=seat_1&token=${p1.token}`);
  assert.equal(wrongRoomController.response.status, 403);
  const state = await jsonRequest(base, `/api/state?roomCode=AXM1&sessionId=${sessionId}&view=party&party=party_a`);
  assert.equal(state.json.world.actors.length, 4);
  assert.equal(state.json.world.actors[0].shield, 1);
  assert.equal(state.json.world.actors[0].inventory.hostOwned, true);
  assert.equal(state.json.world.actors[0].inventory.bag.length, 12);
  assert.equal(state.json.world.actors[0].inventoryOpen, false);
  assert.deepEqual(state.json.world.actors[0].ammoSummary, {
    mode: 'provisional-unlimited',
    unlimited: true,
    weaponId: 'pulse-sidearm',
    weaponName: 'Pulse Sidearm',
    ammoType: null,
    loaded: null,
    reserve: null,
    total: null,
  });
  assert.equal(state.json.world.actors[0].regeneration.healthAccumulator, undefined, 'private fractional regeneration state is not broadcast');
  assert.equal(state.json.world.npcs.filter((npc) => npc.kind === 'civilian').length, 8);
  assert.equal(state.json.world.npcs.filter((npc) => npc.kind === 'rival').length, 3);
  assert.equal(state.json.world.vehicles.length, 6);
  assert.ok(state.json.world.vehicles.every((vehicle) => vehicle.health === 50 && vehicle.maxHealth === 50));
  assert.equal(state.json.world.actors[0].walletCents, 10000);
  assert.equal(state.json.world.actors[0].personalFundCents, 10000);
  assert.deepEqual(state.json.world.economy.rewardSplit, { personalPercent: 40, partyPercent: 60 });
  assert.deepEqual(state.json.world.economy.partyFunds, { party_a: 0, party_b: 0 });
  assert.equal(state.json.world.mission.status, 'base');
  assert.ok(Array.isArray(state.json.world.mission.packages));
  assert.equal(typeof state.json.world.mission.timeRemaining, 'number');
  const wrongRoomState = await jsonRequest(base, `/api/state?roomCode=AXM2&sessionId=${sessionId}&view=party&party=party_a`);
  assert.equal(wrongRoomState.response.status, 403);
  const world = await jsonRequest(base, `/api/world?roomCode=AXM1&sessionId=${sessionId}`);
  assert.equal(world.json.reservedSeatCapacity, 8);

  const displayA = await jsonRequest(base, '/display/party_a');
  const displayB = await jsonRequest(base, '/api/display/party_b');
  assert.equal(displayA.json.status, 'running');
  assert.match(displayA.json.screenUrl, /party=party_a/);
  assert.match(displayB.json.screenUrl, /party=party_b/);
  const unknownDisplay = await jsonRequest(base, '/display/not_a_party');
  assert.equal(unknownDisplay.response.status, 400);

  const settings = await jsonRequest(base, '/api/session/settings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId, hostToken, combatRules: { partyFriendlyFire: { party_a: true } } }),
  });
  assert.equal(settings.json.combatRules.partyFriendlyFire.party_a, true);
  assert.equal(settings.json.combatRules.partyFriendlyFire.party_b, false);

  const restarted = await jsonRequest(base, '/api/session/restart', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId, hostToken }),
  });
  assert.equal(restarted.json.status, 'running');
  const restartedState = await jsonRequest(base, `/api/state?roomCode=AXM1&sessionId=${sessionId}&party=party_a`);
  assert.equal(restartedState.json.tick, 0);

  const ended = await jsonRequest(base, '/api/session/end', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId, hostToken }),
  });
  assert.equal(ended.json.status, 'ended');
  const waiting = await jsonRequest(base, '/display/party_a');
  assert.equal(waiting.json.status, 'waiting');

  const oneSided = await jsonRequest(base, '/api/session/start', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      roomCode: 'AXM1',
      players: [{ slot: 1, controllerType: 'human' }],
      settings: { mode: 'district_dominion' },
    }),
  });
  assert.equal(oneSided.response.status, 400);
  assert.equal(oneSided.json.error, 'invalid_party_roster');

  const districtPlayers = [
    { slot: 1, displayName: 'A Human', controllerType: 'human' },
    { slot: 2, displayName: 'A Connected AI', controllerType: 'adapter', adapterId: 'smoke-adapter-a2' },
    { slot: 5, displayName: 'B Human', controllerType: 'human' },
    { slot: 6, displayName: 'B Host AI', controllerType: 'ai' },
    { slot: 7, displayName: 'B Second Human', controllerType: 'human' },
  ];
  const district = await jsonRequest(base, '/api/session/start', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ roomCode: 'AXM1', players: districtPlayers, settings: { mode: 'district_dominion' } }),
  });
  assert.equal(district.response.status, 201);
  assert.equal(district.json.mode, 'district_dominion');
  assert.equal(district.json.players.length, 5);
  assert.equal(district.json.controllerLinks.length, 3);
  assert.equal(district.json.adapterBindings.length, 1);
  const humanA = district.json.controllerLinks.find((link) => link.seatId === 'seat_1');
  const humanB = district.json.controllerLinks.find((link) => link.seatId === 'seat_5');
  for (const [link, seq] of [[humanA, 1], [humanB, 1]]) {
    const routed = await jsonRequest(base, '/api/input', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomCode: 'AXM1', sessionId: district.json.sessionId, seatId: link.seatId, token: link.token, seq, input: { action: true } }),
    });
    assert.equal(routed.response.status, 200);
  }
  const adapter = district.json.adapterBindings[0];
  const adapterInput = await jsonRequest(base, '/api/input', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      roomCode: 'AXM1', sessionId: district.json.sessionId, seatId: adapter.seatId,
      token: adapter.token, seq: 1, input: { moveY: 1, aimX: -1, aimActive: true },
    }),
  });
  assert.equal(adapterInput.response.status, 200);
  const adapterObservation = await jsonRequest(
    base,
    `/api/adapter-observation?room=AXM1&session=${district.json.sessionId}&seat=${adapter.seatId}&width=960&height=540`,
    { headers: { 'X-AXM-Seat-Token': adapter.token } },
  );
  assert.equal(adapterObservation.response.status, 200);
  assert.equal(adapterObservation.json.scope, 'same-party-shared-screen-only');
  assert.equal(adapterObservation.json.seatId, 'seat_2');
  advanceWorld(runtime.sessionManager.getRunningSession().world);
  const districtState = await jsonRequest(base, `/api/state?roomCode=AXM1&sessionId=${district.json.sessionId}&party=party_b`);
  assert.equal(districtState.json.world.territory.enabled, true);
  assert.equal(districtState.json.world.territory.zones.length, 8);
  assert.equal(districtState.json.world.actors.length, 5);
  assert.equal(districtState.json.world.npcs.filter((npc) => npc.kind === 'crew' && npc.partyId === 'party_a').length, 2);
  assert.equal(districtState.json.world.npcs.filter((npc) => npc.kind === 'crew' && npc.partyId === 'party_b').length, 2);
  assert.deepEqual(districtState.json.world.economy.partyFunds, { party_a: 2500, party_b: 2500 });
  const districtWorld = await jsonRequest(base, `/api/world?roomCode=AXM1&sessionId=${district.json.sessionId}`);
  assert.equal(districtWorld.json.activePlayerTarget, 5);
  assert.equal(districtWorld.json.maximumPlayerCapacity, 8);
  const districtDisplayB = await jsonRequest(base, '/display/party_b');
  assert.match(districtDisplayB.json.screenUrl, /party=party_b/);

  await jsonRequest(base, '/api/session/end', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId: district.json.sessionId, hostToken: district.json.hostToken }),
  });

  await runtime.close();
  assert.equal(fs.existsSync(runtime.pidPath), false, 'PID file removed on clean shutdown');
});
