'use strict';

const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const { createWorldState } = require('../server/world-state');
const { interactWithCityLife, serviceVehicle } = require('../server/city-life-system');
const { claimVehicleSeat, exitVehicle, updateVehicles } = require('../server/vehicle-system');
const {
  BODY_KITS,
  PAINT_PRESETS,
  TUNE_PRESETS,
  cycleBodyKit,
  cycleTunePreset,
  cycleVehiclePaint,
  ensureVehicleTuning,
  publicVehicleBuild,
  quoteVehicleUpgrade,
  upgradeVehiclePart,
  vehiclePerformance,
} = require('../server/vehicle-tuning-system');

const projectRoot = path.join(__dirname, '..');

function makeWorld() {
  return createWorldState({
    projectRoot,
    players: [{ actorId: 'actor-1', seatId: 'seat-1', slot: 1, displayName: 'Mike', controllerType: 'human', partyId: 'party_a' }],
  });
}

test('three-stage engine, tire and two-stage brake upgrades change declared vehicle performance', () => {
  const vehicle = { id: 'tune-fixture', vehicleClass: 'custom', maxHealth: 50, health: 50 };
  const baseline = vehiclePerformance(vehicle);
  for (let tier = 1; tier <= 3; tier += 1) assert.deepEqual(upgradeVehiclePart(vehicle, 'engine').tier, tier);
  for (let tier = 1; tier <= 3; tier += 1) assert.deepEqual(upgradeVehiclePart(vehicle, 'tires').tier, tier);
  for (let tier = 1; tier <= 2; tier += 1) assert.deepEqual(upgradeVehiclePart(vehicle, 'brakes').tier, tier);
  const modified = vehiclePerformance(vehicle);
  assert.ok(modified.topSpeed > baseline.topSpeed);
  assert.ok(modified.acceleration > baseline.acceleration);
  assert.ok(modified.steeringRate > baseline.steeringRate);
  assert.ok(modified.reverseAcceleration > baseline.reverseAcceleration);
  assert.equal(upgradeVehiclePart(vehicle, 'engine').reason, 'vehicle-part-max');
  assert.equal(quoteVehicleUpgrade(vehicle, 'engine-vehicle'), 0);
});

test('handling, paint and body choices cycle deterministically without losing the exact car build', () => {
  const vehicle = { id: 'visual-fixture', vehicleClass: 'custom', maxHealth: 50, health: 50 };
  const tuning = ensureVehicleTuning(vehicle);
  const seenTunes = new Set([tuning.presetId]);
  const seenPaint = new Set([tuning.paintId]);
  const seenBodies = new Set([tuning.bodyKitId]);
  for (let index = 1; index < TUNE_PRESETS.length; index += 1) seenTunes.add(cycleTunePreset(vehicle, 'actor-1').id);
  for (let index = 1; index < PAINT_PRESETS.length; index += 1) seenPaint.add(cycleVehiclePaint(vehicle, 'actor-1').id);
  for (let index = 1; index < BODY_KITS.length; index += 1) seenBodies.add(cycleBodyKit(vehicle, 'actor-1').id);
  assert.equal(seenTunes.size, TUNE_PRESETS.length);
  assert.equal(seenPaint.size, PAINT_PRESETS.length);
  assert.equal(seenBodies.size, BODY_KITS.length);
  assert.deepEqual(vehicle.tuning.installedByActorIds, ['actor-1']);
  assert.equal(publicVehicleBuild(vehicle).vehicleId, vehicle.id);
});

test('the Chop Shop locks its menu to one nearby car and previews real stat changes', () => {
  const world = makeWorld();
  const actor = world.actors['actor-1'];
  actor.walletCents = 10000;
  actor.position = { x: 7460, y: 4680 };
  const target = Object.values(world.vehicles).find((vehicle) => vehicle.parked);
  const other = Object.values(world.vehicles).find((vehicle) => vehicle.parked && vehicle.id !== target.id);
  target.position = { x: 7460, y: 4710 };
  target.partyOwnerId = actor.partyId;
  other.position = { x: 7460, y: 4780 };
  other.partyOwnerId = actor.partyId;

  assert.equal(interactWithCityLife(world, actor).action, 'opened');
  const menu = world.cityLife.menus[actor.id];
  assert.equal(menu.serviceVehicleId, target.id);
  assert.equal(menu.vehicleBuild.vehicleId, target.id);
  assert.match(menu.options[2].detail, /Top 190 -> 204/);
  menu.selectedIndex = 2;
  const purchase = interactWithCityLife(world, actor);
  assert.equal(purchase.ok, true);
  assert.equal(target.tuning.engineTier, 1);
  assert.equal(other.tuning.engineTier, 0);
  assert.equal(actor.walletCents, 8600);
  assert.equal(menu.vehicleBuild.engineTier, 1);
  assert.equal(menu.options[2].priceCents, 2200);
});

test('ECU tuning costs once, then handling presets can be changed freely', () => {
  const world = makeWorld();
  const actor = world.actors['actor-1'];
  const vehicle = Object.values(world.vehicles).find((entry) => entry.parked);
  actor.walletCents = 2000;
  actor.position = { x: 7460, y: 4680 };
  vehicle.position = { x: 7460, y: 4710 };
  vehicle.partyOwnerId = actor.partyId;
  const option = { id: 'tune-vehicle', priceCents: 500 };
  assert.equal(serviceVehicle(world, actor, option, vehicle.id).ok, true);
  assert.equal(actor.walletCents, 1500);
  assert.equal(vehicle.tuning.presetId, 'grip');
  assert.equal(serviceVehicle(world, actor, option, vehicle.id).ok, true);
  assert.equal(actor.walletCents, 1500);
  assert.equal(vehicle.tuning.presetId, 'drift');
  assert.ok(vehiclePerformance(vehicle).tractionResponse < vehiclePerformance({ id: 'stock', maxHealth: 50 }).tractionResponse);
});

test('the tow crew retrieves one empty claimed party car and never another party car', () => {
  const world = makeWorld();
  const actor = world.actors['actor-1'];
  actor.walletCents = 2000;
  actor.position = { x: 7460, y: 4680 };
  const ownCar = Object.values(world.vehicles).find((vehicle) => vehicle.parked);
  const otherCar = Object.values(world.vehicles).find((vehicle) => vehicle.parked && vehicle.id !== ownCar.id);
  ownCar.partyOwnerId = actor.partyId;
  ownCar.position = { x: 9000, y: 6000 };
  otherCar.partyOwnerId = 'party_b';
  otherCar.position = { x: 7500, y: 4700 };
  const result = serviceVehicle(world, actor, { id: 'tow-vehicle', priceCents: 600 });
  assert.equal(result.ok, true);
  assert.equal(result.vehicleId, ownCar.id);
  assert.deepEqual(ownCar.position, { x: 7510, y: 4740 });
  assert.notDeepEqual(otherCar.position, ownCar.position);
  assert.equal(actor.walletCents, 1400);
});

test('tuned acceleration changes live driving and a custom build survives host respawn', () => {
  const stockWorld = makeWorld();
  const tunedWorld = makeWorld();
  const stockActor = stockWorld.actors['actor-1'];
  const tunedActor = tunedWorld.actors['actor-1'];
  const stockCar = Object.values(stockWorld.vehicles).find((vehicle) => vehicle.parked);
  const tunedCar = tunedWorld.vehicles[stockCar.id];
  stockActor.position = { ...stockCar.position };
  tunedActor.position = { ...tunedCar.position };
  claimVehicleSeat(stockWorld, stockActor.id, stockCar.id, 'driver');
  claimVehicleSeat(tunedWorld, tunedActor.id, tunedCar.id, 'driver');
  for (let index = 0; index < 3; index += 1) upgradeVehiclePart(tunedCar, 'engine', tunedActor.id);
  stockActor.input.sprint = true;
  tunedActor.input.sprint = true;
  updateVehicles(stockWorld, 0.25, 1);
  updateVehicles(tunedWorld, 0.25, 1);
  assert.ok(tunedCar.speed > stockCar.speed);

  exitVehicle(tunedWorld, tunedActor.id);
  tunedCar.vehicleClass = 'custom';
  tunedCar.purchasedByActorId = tunedActor.id;
  tunedCar.partyOwnerId = tunedActor.partyId;
  tunedCar.destroyed = true;
  tunedCar.health = 0;
  tunedCar.respawnAtTick = tunedWorld.tick;
  updateVehicles(tunedWorld, 1 / 30, 2);
  assert.equal(tunedCar.destroyed, false);
  assert.equal(tunedCar.partyOwnerId, tunedActor.partyId);
  assert.equal(tunedCar.tuning.engineTier, 3);
});
