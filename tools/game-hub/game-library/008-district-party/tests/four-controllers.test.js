'use strict';

const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const { SessionManager } = require('../server/session-manager');
const { routeInput } = require('../server/input-router');
const { advanceWorld } = require('../server/world-loop');
const { claimVehicleSeat } = require('../server/vehicle-system');
const { startMission } = require('../server/mission-system');

function fourHumans() {
  return Array.from({ length: 4 }, (_, index) => ({
    slot: index + 1,
    seatId: `seat_${index + 1}`,
    displayName: `Human ${index + 1}`,
    controllerType: 'human',
  }));
}

test('four controller identities route distinct simultaneous intentions to four actors', () => {
  const manager = new SessionManager({ projectRoot: path.join(__dirname, '..') });
  const launch = manager.createSession({ players: fourHumans(), roomCode: 'AXM1' });
  const session = manager.getSession(launch.sessionId);
  const tokens = Object.fromEntries(launch.controllerLinks.map((link) => [link.seatId, link.token]));
  const p1Before = { ...session.world.actors['actor-seat-1'].position };
  const p2Before = { ...session.world.actors['actor-seat-2'].position };
  const vehicle = session.world.vehicles['vehicle-001'];
  session.world.actors['actor-seat-4'].position = { ...vehicle.position };

  const packets = [
    { seatId: 'seat_1', input: { moveY: -1 } },
    { seatId: 'seat_2', input: { moveX: 1 } },
    { seatId: 'seat_3', input: { attack: true } },
    { seatId: 'seat_4', input: { action: true } },
  ].map((entry, index) => ({
    roomCode: 'AXM1',
    sessionId: session.id,
    seatId: entry.seatId,
    token: tokens[entry.seatId],
    seq: index + 1,
    input: entry.input,
  }));

  const results = packets.map((packet) => routeInput(manager, packet, 10_000));
  assert.ok(results.every((result) => result.ok));
  assert.deepEqual(results.map((result) => result.actorId), [
    'actor-seat-1', 'actor-seat-2', 'actor-seat-3', 'actor-seat-4',
  ]);
  advanceWorld(session.world, { now: 10_010 });
  assert.ok(session.world.actors['actor-seat-1'].position.y < p1Before.y, 'P1 moved north');
  assert.ok(session.world.actors['actor-seat-2'].position.x > p2Before.x, 'P2 moved east');
  assert.ok(Object.keys(session.world.projectiles).length >= 1, 'P3 host-owned projectile exists');
  assert.equal(session.world.actors['actor-seat-4'].currentVehicleId, 'vehicle-001', 'P4 entered vehicle');
  assert.equal(vehicle.driverActorId, 'actor-seat-4');
});

test('AI player seats and civilians advance under host systems', () => {
  const manager = new SessionManager({ projectRoot: path.join(__dirname, '..') });
  const launch = manager.createSession({
    players: [
      { slot: 1, controllerType: 'human', displayName: 'Anchor' },
      { slot: 2, controllerType: 'ai', displayName: 'Nova' },
    ],
  });
  const world = manager.getSession(launch.sessionId).world;
  const aiBefore = { ...world.actors['actor-seat-2'].position };
  const npcBefore = Object.fromEntries(Object.values(world.npcs).map((npc) => [npc.id, { ...npc.position }]));
  for (let index = 0; index < 10; index += 1) advanceWorld(world, { now: 20_000 + index * 34 });
  const ai = world.actors['actor-seat-2'];
  assert.notEqual(ai.aiState, null);
  assert.ok(Math.hypot(ai.position.x - aiBefore.x, ai.position.y - aiBefore.y) > 0, 'AI party actor moved');
  assert.ok(Object.values(world.npcs).some((npc) => (
    Math.hypot(npc.position.x - npcBefore[npc.id].x, npc.position.y - npcBefore[npc.id].y) > 0
  )), 'at least one civilian moved');
});

test('eight selected seat records initialise one authoritative world with Party B intact', () => {
  const manager = new SessionManager({ projectRoot: path.join(__dirname, '..') });
  const launch = manager.createSession({
    players: Array.from({ length: 8 }, (_, index) => ({
      slot: index + 1,
      displayName: `Seat ${index + 1}`,
      controllerType: index % 2 === 0 ? 'human' : 'ai',
    })),
  });
  const world = manager.getSession(launch.sessionId).world;
  assert.equal(Object.keys(world.actors).length, 8);
  assert.deepEqual(
    Object.values(world.actors).filter((actor) => actor.partyId === 'party_b').map((actor) => actor.slot),
    [5, 6, 7, 8],
  );
  assert.ok(Object.values(world.actors).every((actor) => (
    actor.inventory?.hostOwned === true && actor.inventory.bag.length === 12
  )), 'all eight actors initialise the authoritative inventory shape');
  assert.match(launch.partyScreenLinks.party_b, /party=party_b/);
  advanceWorld(world, { now: 30_000 });
  assert.equal(world.tick, 1);
});

test('nearby AI party actor enters an ally-driven vehicle as a real passenger', () => {
  const manager = new SessionManager({ projectRoot: path.join(__dirname, '..') });
  const launch = manager.createSession({
    players: [
      { slot: 1, controllerType: 'human', displayName: 'Driver' },
      { slot: 2, controllerType: 'ai', displayName: 'Wingmate' },
    ],
  });
  const world = manager.getSession(launch.sessionId).world;
  const vehicle = world.vehicles['vehicle-001'];
  const driver = world.actors['actor-seat-1'];
  const wingmate = world.actors['actor-seat-2'];
  driver.position = { ...vehicle.position };
  assert.equal(claimVehicleSeat(world, driver.id, vehicle.id, 'driver').ok, true);
  wingmate.position = { x: vehicle.position.x + 30, y: vehicle.position.y };
  advanceWorld(world, { now: 40_000 });
  assert.equal(wingmate.aiState, 'enter_party_vehicle');
  assert.equal(wingmate.currentVehicleId, vehicle.id);
  assert.ok(vehicle.passengerActorIds.includes(wingmate.id));
});

test('held human ACTION is a host-side rising edge and cannot enter then immediately exit', () => {
  const manager = new SessionManager({ projectRoot: path.join(__dirname, '..') });
  const launch = manager.createSession({ players: [{ slot: 1, controllerType: 'human', displayName: 'Driver' }] });
  const session = manager.getSession(launch.sessionId);
  const actor = session.world.actors['actor-seat-1'];
  const vehicle = session.world.vehicles['vehicle-001'];
  actor.position = { ...vehicle.position };
  const token = launch.controllerLinks[0].token;
  const send = (seq, action) => routeInput(manager, {
    roomCode: 'AXM1', sessionId: session.id, seatId: actor.seatId, token, seq, input: { action },
  }, 50_000 + seq);

  send(1, true);
  advanceWorld(session.world, { now: 50_001 });
  assert.equal(actor.currentVehicleId, vehicle.id);
  send(2, true);
  advanceWorld(session.world, { now: 50_002 });
  assert.equal(actor.currentVehicleId, vehicle.id, 'held ACTION did not create a second action pulse');
  send(3, false);
  advanceWorld(session.world, { now: 50_003 });
  send(4, true);
  advanceWorld(session.world, { now: 50_004 });
  assert.equal(actor.currentVehicleId, null, 'release then press produces the next action edge');
});

test('human connection presence expires on the authoritative host after the disconnect window', () => {
  const manager = new SessionManager({ projectRoot: path.join(__dirname, '..') });
  const launch = manager.createSession({ players: fourHumans(), roomCode: 'AXM1' });
  const session = manager.getRunningSession();
  const actor = session.world.actors['actor-seat-1'];
  const token = launch.controllerLinks.find((link) => link.seatId === 'seat_1').token;
  const now = Date.now();
  assert.equal(routeInput(manager, { roomCode: 'AXM1', sessionId: session.id, seatId: 'seat_1', token, seq: 1, input: {} }, now).ok, true);
  advanceWorld(session.world, { now: now + 6000 });
  assert.equal(actor.connected, false);
  assert.equal(manager.launcherState(true).players.find((player) => player.seatId === 'seat_1').connected, false);
});

test('bounded AI courier routes around city collision and completes a delivery', () => {
  const manager = new SessionManager({ projectRoot: path.join(__dirname, '..') });
  const launch = manager.createSession({ players: [{ slot: 1, controllerType: 'ai', displayName: 'Courier AI' }] });
  const world = manager.getSession(launch.sessionId).world;
  startMission(world, 'courier_chaos');
  for (let index = 0; index < 1800 && world.mission.deliveredCount === 0; index += 1) {
    advanceWorld(world, { now: 60_000 + index * 34 });
  }
  assert.ok(world.mission.deliveredCount >= 1, 'host AI claimed and delivered at least one package');
  assert.ok(Object.values(world.actors).every((actor) => Number.isFinite(actor.position.x) && Number.isFinite(actor.position.y)));
});
