'use strict';

const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const { createWorldState } = require('../server/world-state');
const { claimPackage, deliverPackage, restartMission, startMission } = require('../server/mission-system');

function makeWorld() {
  return createWorldState({
    projectRoot: path.join(__dirname, '..'),
    players: [1, 2].map((slot) => ({
      actorId: `actor-seat-${slot}`,
      seatId: `seat_${slot}`,
      slot,
      displayName: `P${slot}`,
      controllerType: 'human',
      adapterId: null,
      partyId: 'party_a',
    })),
  });
}

test('package claim is exclusive and one delivery awards once', () => {
  const world = makeWorld();
  startMission(world, 'courier_chaos');
  const packageEntity = world.mission.packages[0];
  const p1 = world.actors['actor-seat-1'];
  const p2 = world.actors['actor-seat-2'];
  p1.position = { ...packageEntity.position };
  p2.position = { ...packageEntity.position };
  assert.equal(claimPackage(world, p1.id, packageEntity.id).ok, true);
  assert.equal(claimPackage(world, p2.id, packageEntity.id).reason, 'package-unavailable');

  const zone = world.staticMap.mission.deliveryZones[0];
  p1.position = { x: zone.x + 5, y: zone.y + 5 };
  p1.currentVehicleId = 'vehicle-001';
  world.tick = 25;
  const delivered = deliverPackage(world, p1.id, zone.id);
  assert.equal(delivered.ok, true);
  assert.equal(world.mission.deliveredCount, 1);
  assert.equal(world.mission.individual[p1.id].vehicleAssistedDeliveries, 1);
  assert.equal(deliverPackage(world, p1.id, zone.id).reason, 'not-ready');
});

test('round completes at goal and restart removes stale ownership', () => {
  const world = makeWorld();
  startMission(world, 'courier_chaos');
  world.mission.goal = 1;
  const packageEntity = world.mission.packages[0];
  const actor = world.actors['actor-seat-1'];
  actor.position = { ...packageEntity.position };
  claimPackage(world, actor.id, packageEntity.id);
  const zone = world.staticMap.mission.deliveryZones[0];
  actor.position = { x: zone.x + 4, y: zone.y + 4 };
  deliverPackage(world, actor.id, zone.id);
  assert.equal(world.mission.status, 'results');
  assert.equal(world.mission.result.reason, 'delivery-goal');
  restartMission(world);
  assert.equal(world.mission.status, 'active');
  assert.equal(world.mission.deliveredCount, 0);
  assert.equal(actor.carryingPackageId, null);
  assert.ok(world.mission.packages.every((entry) => entry.ownerActorId === null));
});
