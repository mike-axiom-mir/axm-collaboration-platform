'use strict';

const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const { createWorldState } = require('../server/world-state');
const { applyVehicleDamage } = require('../server/projectile-system');
const { claimVehicleSeat, updateVehicles } = require('../server/vehicle-system');

function makeWorld() {
  return createWorldState({
    projectRoot: path.join(__dirname, '..'),
    players: Array.from({ length: 4 }, (_, index) => ({
      actorId: `actor-seat-${index + 1}`, seatId: `seat_${index + 1}`, slot: index + 1,
      displayName: `P${index + 1}`, controllerType: 'human', partyId: 'party_a',
    })),
  });
}

test('non-driver movement aims independently and all four seats remain host-owned', () => {
  const world = makeWorld(), vehicle = world.vehicles['vehicle-001'];
  Object.values(world.actors).forEach((actor) => { actor.position = { ...vehicle.position }; });
  assert.equal(claimVehicleSeat(world, 'actor-seat-1', vehicle.id, 'driver').ok, true);
  for (let slot = 2; slot <= 4; slot += 1) assert.equal(claimVehicleSeat(world, `actor-seat-${slot}`, vehicle.id, 'passenger').ok, true);
  const passenger = world.actors['actor-seat-2'];
  passenger.input = { moveX: 0, moveY: -1, attack: true };
  updateVehicles(world, 1 / 30);
  assert.deepEqual(passenger.facing, { x: 0, y: -1 });
  assert.equal(vehicle.driverActorId, 'actor-seat-1');
  assert.equal(vehicle.passengerActorIds.length, 3);
});

test('50 HP car explosion ejects occupants and applies exactly 80 damage through the one-point shield', () => {
  const world = makeWorld(), vehicle = world.vehicles['vehicle-001'];
  world.staticMap.safeZones = [];
  Object.values(world.actors).forEach((actor) => { actor.position = { ...vehicle.position }; });
  claimVehicleSeat(world, 'actor-seat-1', vehicle.id, 'driver');
  for (let slot = 2; slot <= 4; slot += 1) claimVehicleSeat(world, `actor-seat-${slot}`, vehicle.id, 'passenger');
  const rival = Object.values(world.npcs).find((npc) => npc.hostile);
  assert.equal(vehicle.health, 50);
  for (let hit = 0; hit < 10; hit += 1) applyVehicleDamage(world, rival, vehicle, { id: `hit-${hit}`, damage: 5, sourceVehicleId: null });
  assert.equal(vehicle.destroyed, true);
  assert.equal(vehicle.health, 0);
  assert.equal(vehicle.driverActorId, null);
  assert.deepEqual(vehicle.passengerActorIds, []);
  assert.ok(Object.values(world.actors).every((actor) => actor.currentVehicleId === null && actor.shield === 0 && actor.health === 21 && actor.alive));
  assert.ok(world.effects.some((effect) => effect.kind === 'vehicle-explosion'));
});

test('same-party shots cannot damage an owned car and destroyed cars reject entry until host respawn', () => {
  const world = makeWorld(), vehicle = world.vehicles['vehicle-001'];
  world.staticMap.safeZones = [];
  const owner = world.actors['actor-seat-1'];
  owner.position = { ...vehicle.position };
  claimVehicleSeat(world, owner.id, vehicle.id, 'driver');
  assert.equal(applyVehicleDamage(world, owner, vehicle, { id: 'ally-shot', damage: 5, sourceVehicleId: null }).reason, 'ally-vehicle');
  assert.equal(vehicle.health, 50);
  vehicle.driverActorId = null; owner.currentVehicleId = null; owner.vehicleSeat = null;
  vehicle.destroyed = true; vehicle.health = 0; vehicle.respawnAtTick = world.tick + 1;
  assert.equal(claimVehicleSeat(world, owner.id, vehicle.id).reason, 'vehicle-destroyed');
  world.tick += 1; updateVehicles(world, 1 / 30);
  assert.equal(vehicle.destroyed, false);
  assert.equal(vehicle.health, 50);
});
