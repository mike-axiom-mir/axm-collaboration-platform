'use strict';

const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const { createWorldState } = require('../server/world-state');
const {
  claimVehicleSeat,
  exitVehicle,
  findSafeExitPosition,
  recoverDisconnectedDrivers,
  updateVehicles,
} = require('../server/vehicle-system');

const projectRoot = path.join(__dirname, '..');

function makeWorld() {
  const players = Array.from({ length: 5 }, (_, index) => ({
    actorId: `actor-seat-${index + 1}`,
    seatId: `seat_${index + 1}`,
    slot: index + 1,
    displayName: `P${index + 1}`,
    controllerType: 'human',
    adapterId: null,
    partyId: index < 4 ? 'party_a' : 'party_b',
  }));
  const world = createWorldState({ players, projectRoot });
  const vehicle = world.vehicles['vehicle-001'];
  Object.values(world.actors).forEach((actor) => { actor.position = { ...vehicle.position }; });
  return world;
}

test('host resolves one driver, rejects a second driver, and caps passengers', () => {
  const world = makeWorld();
  assert.deepEqual(claimVehicleSeat(world, 'actor-seat-1', 'vehicle-001', 'driver'), {
    ok: true, vehicleId: 'vehicle-001', actorId: 'actor-seat-1', seat: 'driver',
  });
  assert.equal(claimVehicleSeat(world, 'actor-seat-2', 'vehicle-001', 'driver').reason, 'seat-occupied');
  assert.equal(claimVehicleSeat(world, 'actor-seat-2', 'vehicle-001', 'passenger').ok, true);
  assert.equal(claimVehicleSeat(world, 'actor-seat-3', 'vehicle-001', 'passenger').ok, true);
  assert.equal(claimVehicleSeat(world, 'actor-seat-4', 'vehicle-001', 'passenger').ok, true);
  assert.equal(claimVehicleSeat(world, 'actor-seat-5', 'vehicle-001', 'passenger').reason, 'vehicle-full');
  assert.equal(world.vehicles['vehicle-001'].hostOwned, true);
});

test('released passenger seat is reused without duplicating another occupant seat', () => {
  const world = makeWorld();
  claimVehicleSeat(world, 'actor-seat-1', 'vehicle-001', 'driver');
  claimVehicleSeat(world, 'actor-seat-2', 'vehicle-001', 'passenger');
  claimVehicleSeat(world, 'actor-seat-3', 'vehicle-001', 'passenger');
  assert.equal(world.actors['actor-seat-2'].vehicleSeat, 'passenger_1');
  assert.equal(world.actors['actor-seat-3'].vehicleSeat, 'passenger_2');
  exitVehicle(world, 'actor-seat-2');
  world.actors['actor-seat-4'].position = { ...world.vehicles['vehicle-001'].position };
  claimVehicleSeat(world, 'actor-seat-4', 'vehicle-001', 'passenger');
  assert.equal(world.actors['actor-seat-4'].vehicleSeat, 'passenger_1');
  assert.equal(world.actors['actor-seat-3'].vehicleSeat, 'passenger_2');
});

test('phone sprint acts as throttle and brake becomes reverse near a stop', () => {
  const world = makeWorld();
  claimVehicleSeat(world, 'actor-seat-1', 'vehicle-001', 'driver');
  const actor = world.actors['actor-seat-1'];
  const vehicle = world.vehicles['vehicle-001'];
  actor.input = { moveX: 0, moveY: 0, sprint: true, brake: false };
  updateVehicles(world, 1 / 30, 1000);
  assert.ok(vehicle.speed > 0, 'sprint button accelerates forward');
  vehicle.speed = 0;
  actor.input = { moveX: 0, moveY: 0, sprint: false, brake: true };
  updateVehicles(world, 1 / 30, 1010);
  assert.ok(vehicle.speed < 0, 'brake button reverses once nearly stopped');
});

test('vehicle occupants cannot drive farther outward beyond party hard range', () => {
  const world = makeWorld();
  const vehicle = world.vehicles['vehicle-001'];
  const driver = world.actors['actor-seat-1'];
  const anchor = world.actors['actor-seat-2'];
  vehicle.position = { x: 700, y: 500 };
  driver.position = { ...vehicle.position };
  anchor.position = { x: 100, y: 500 };
  world.actors['actor-seat-3'].position = { x: 100, y: 500 };
  world.actors['actor-seat-4'].position = { x: 100, y: 500 };
  claimVehicleSeat(world, driver.id, vehicle.id, 'driver');
  vehicle.rotation = 0;
  vehicle.speed = 100;
  driver.input = { moveX: 0, moveY: 0, sprint: false, brake: false };
  updateVehicles(world, 1 / 30, 2000);
  assert.equal(vehicle.position.x, 700);
  assert.equal(driver.tether.level, 'hard');
  assert.equal(driver.tether.movementBlocked, true);

  vehicle.rotation = Math.PI;
  vehicle.speed = 100;
  updateVehicles(world, 1 / 30, 2010);
  assert.ok(vehicle.position.x < 700, 'vehicle can still drive back toward the party');
});

test('exit releases the seat and disconnected driver recovery is host-owned', () => {
  const world = makeWorld();
  claimVehicleSeat(world, 'actor-seat-1', 'vehicle-001', 'driver');
  assert.equal(exitVehicle(world, 'actor-seat-1').ok, true);
  assert.equal(world.vehicles['vehicle-001'].driverActorId, null);
  assert.equal(world.actors['actor-seat-1'].currentVehicleId, null);

  world.actors['actor-seat-1'].position = { ...world.vehicles['vehicle-001'].position };
  claimVehicleSeat(world, 'actor-seat-1', 'vehicle-001', 'driver');
  world.actors['actor-seat-1'].lastInputAt = 1000;
  const released = recoverDisconnectedDrivers(world, 7001);
  assert.equal(released.length, 1);
  assert.equal(world.vehicles['vehicle-001'].driverActorId, null);
});

test('vehicle exit chooses another side instead of placing actor inside depot collision', () => {
  const world = makeWorld();
  const vehicle = world.vehicles['vehicle-001'];
  const actor = world.actors['actor-seat-1'];
  vehicle.position = { x: 620, y: 200 };
  vehicle.rotation = Math.PI / 2;
  actor.position = { ...vehicle.position };
  assert.equal(claimVehicleSeat(world, actor.id, vehicle.id, 'driver').ok, true);
  const result = exitVehicle(world, actor.id);
  assert.equal(result.ok, true);
  assert.equal(world.vehicles[vehicle.id].driverActorId, null);
  assert.equal(actor.currentVehicleId, null);
  assert.equal(world.staticMap.obstacles.some((box) => (
    actor.position.x + actor.radius > box.x
    && actor.position.x - actor.radius < box.x + box.width
    && actor.position.y + actor.radius > box.y
    && actor.position.y - actor.radius < box.y + box.height
  )), false, 'safe candidate is outside every collision rectangle');
  assert.ok(actor.position.x < 650, 'actor selected the clear side of the nearby depot');
});

test('fully blocked vehicle exit is rejected without changing host occupancy', () => {
  const world = makeWorld();
  const vehicle = world.vehicles['vehicle-001'];
  const actor = world.actors['actor-seat-1'];
  vehicle.position = { x: 500, y: 500 };
  vehicle.rotation = 0;
  actor.position = { ...vehicle.position };
  claimVehicleSeat(world, actor.id, vehicle.id, 'driver');
  world.staticMap.obstacles.push(
    { id: 'exit-block-left', x: 440, y: 480, width: 50, height: 40 },
    { id: 'exit-block-right', x: 510, y: 480, width: 50, height: 40 },
    { id: 'exit-block-up', x: 480, y: 440, width: 40, height: 50 },
    { id: 'exit-block-down', x: 480, y: 510, width: 40, height: 50 },
  );
  assert.equal(findSafeExitPosition(world, actor, vehicle), null);
  const result = exitVehicle(world, actor.id);
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'no-safe-exit');
  assert.equal(actor.currentVehicleId, vehicle.id);
  assert.equal(actor.vehicleSeat, 'driver');
  assert.equal(vehicle.driverActorId, actor.id);
});
