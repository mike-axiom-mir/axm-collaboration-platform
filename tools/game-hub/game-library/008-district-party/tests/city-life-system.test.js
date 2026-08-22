'use strict';

const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const { createWorldState } = require('../server/world-state');
const { advanceWorld } = require('../server/world-loop');
const {
  CITIZEN_PROFILES,
  CITY_DAY_START_MINUTE,
  CITY_DAY_TICKS,
  cityClockForTick,
  collidesCityRoadblock,
  interactWithCityLife,
  updateCityLife,
  updateCityLifeActorInput,
} = require('../server/city-life-system');
const { claimVehicleSeat, updateVehicles } = require('../server/vehicle-system');

const projectRoot = path.join(__dirname, '..');

function makeWorld() {
  return createWorldState({
    projectRoot,
    players: [{ actorId: 'actor-1', seatId: 'seat-1', slot: 1, displayName: 'Mike', controllerType: 'human', partyId: 'party_a' }],
  });
}

function tickForCityMinute(minuteOfDay) {
  const elapsedMinutes = (minuteOfDay - CITY_DAY_START_MINUTE + 1440) % 1440;
  return Math.ceil(elapsedMinutes / 1440 * CITY_DAY_TICKS);
}

test('free roam starts with deterministic venues, street residents, traffic and stealable parked cars', () => {
  const first = makeWorld();
  const second = makeWorld();
  assert.equal(first.cityLife.enabled, true);
  assert.deepEqual(first.cityLife.venues.map((venue) => venue.id), [
    'iron-lantern-armory', 'neon-crown-casino', 'party-crew-garage', 'metro-dispatch', 'undercroft-chop-shop',
  ]);
  assert.equal(Object.values(first.vehicles).filter((vehicle) => vehicle.traffic?.active).length, 4);
  assert.equal(Object.values(first.vehicles).filter((vehicle) => vehicle.parked && vehicle.stealable).length, 6);
  assert.equal(Object.values(first.npcs).filter((npc) => npc.cityLifeResident).length, 20);
  assert.deepEqual(
    Object.values(first.vehicles).filter((vehicle) => vehicle.traffic).map((vehicle) => vehicle.position),
    Object.values(second.vehicles).filter((vehicle) => vehicle.traffic).map((vehicle) => vehicle.position),
  );
});

test('every civilian receives a stable identity, job and deterministic daily schedule', () => {
  const first = makeWorld();
  const second = makeWorld();
  const describe = (world) => Object.values(world.npcs)
    .filter((npc) => npc.kind === 'civilian')
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((npc) => ({
      id: npc.id,
      name: npc.displayName,
      role: npc.role,
      phase: npc.routine.phase,
      action: npc.routine.action,
      target: npc.routine.target,
    }));
  assert.equal(describe(first).length, CITIZEN_PROFILES.length);
  assert.equal(new Set(describe(first).map((entry) => entry.name)).size, CITIZEN_PROFILES.length);
  assert.equal(new Set(describe(first).map((entry) => entry.role)).size, CITIZEN_PROFILES.length);
  assert.deepEqual(describe(first), describe(second));
  assert.equal(first.cityLife.routineSummary.total, CITIZEN_PROFILES.length);
});

test('every job is geographically reachable during its deterministic commute and shift window', () => {
  const world = makeWorld();
  const residents = Object.values(world.npcs)
    .filter((npc) => npc.kind === 'civilian')
    .sort((a, b) => a.id.localeCompare(b.id));
  residents.forEach((npc, index) => {
    const profile = CITIZEN_PROFILES[index];
    const availableSeconds = (profile.commuteMinutes + profile.shiftDurationMinutes) / 1440 * (CITY_DAY_TICKS / 30);
    const reachableDistance = profile.moveSpeed * availableSeconds;
    const furthestWorkPoint = Math.max(...profile.workPoints.map((point) => Math.hypot(point.x - npc.spawnPosition.x, point.y - npc.spawnPosition.y)));
    assert.ok(furthestWorkPoint <= reachableDistance, `${npc.displayName} can reach ${profile.workLabel} during the scheduled window`);
  });
});

test('the compressed city clock moves citizens through work, leisure and home phases', () => {
  const world = makeWorld();
  const armorer = Object.values(world.npcs).find((npc) => npc.role === 'armorer');

  world.tick = tickForCityMinute(10 * 60);
  updateCityLife(world);
  assert.equal(cityClockForTick(world.tick).hour, 10);
  assert.equal(armorer.routine.phase, 'duty');
  assert.equal(armorer.routine.destinationLabel, 'Iron Lantern Armory');
  assert.match(armorer.routine.action, /SIDEARMS|ARMOR/);

  world.tick = tickForCityMinute(18 * 60);
  updateCityLife(world);
  assert.equal(armorer.routine.phase, 'leisure');
  assert.equal(armorer.routine.destinationLabel, 'Centre Cafe');

  world.tick = tickForCityMinute(23 * 60);
  updateCityLife(world);
  assert.equal(armorer.routine.phase, 'home');
  assert.deepEqual(armorer.routine.target, armorer.spawnPosition);
});

test('players can ask an available citizen about their current shift without blocking cars', () => {
  const world = makeWorld();
  const actor = world.actors['actor-1'];
  const citizen = Object.values(world.npcs).find((npc) => npc.role === 'armorer');
  citizen.position = { x: 1000, y: 1000 };
  actor.position = { ...citizen.position };
  const result = interactWithCityLife(world, actor);
  assert.equal(result.ok, true);
  assert.equal(result.kind, 'city-citizen');
  assert.equal(result.citizenId, citizen.id);
  assert.match(result.message, /Mira Vos - ARMORER/);
  assert.equal(actor.cityMessage, result.message);
});

test('ambient traffic moves host-authoritatively and becomes player-controlled when taken', () => {
  const world = makeWorld();
  const actor = world.actors['actor-1'];
  const traffic = world.vehicles['traffic-civic-1'];
  const before = { ...traffic.position };
  updateVehicles(world, 1 / 30, 1);
  assert.notDeepEqual(traffic.position, before);
  actor.position = { ...traffic.position };
  assert.equal(claimVehicleSeat(world, actor.id, traffic.id, 'driver').ok, true);
  assert.equal(traffic.traffic.active, false);
  assert.equal(traffic.ambientDriver, false);
  assert.equal(traffic.stolenByActorId, actor.id);
  assert.equal(world.justice.vehicleThefts, 1);
  assert.ok(world.justice.heat >= 24, 'taking public traffic creates a real justice consequence');
});

test('armory, bodyguard, gang car and roadblock purchases spend separate personal funds', () => {
  const world = makeWorld();
  const actor = world.actors['actor-1'];
  actor.walletCents = 20000;

  actor.position = { x: 6240, y: 4190 };
  assert.equal(interactWithCityLife(world, actor).action, 'opened');
  assert.equal(interactWithCityLife(world, actor).ok, true);
  assert.equal(actor.cityUpgrades.weaponTier, 1);
  assert.equal(actor.walletCents, 17500);

  delete world.cityLife.menus[actor.id]; actor.cityMenuOpen = false;
  actor.position = { x: 6045, y: 4680 };
  interactWithCityLife(world, actor);
  assert.equal(interactWithCityLife(world, actor).ok, true);
  assert.equal(Object.values(world.npcs).filter((npc) => npc.source === 'bodyguard').length, 1);

  world.cityLife.menus[actor.id].selectedIndex = 1;
  assert.equal(interactWithCityLife(world, actor).ok, true);
  assert.equal(Object.values(world.vehicles).filter((vehicle) => vehicle.vehicleClass === 'gang-car').length, 1);

  world.cityLife.menus[actor.id].selectedIndex = 2;
  assert.equal(interactWithCityLife(world, actor).ok, true);
  assert.equal(collidesCityRoadblock(world, { x: 6144, y: 4096 }, 10), true);
  assert.equal(world.economy.partyFunds.party_a, 0, 'optional upgrades do not silently spend shared party funds');
});

test('venue selection uses a latched stick and FIRE closes without shooting', () => {
  const world = makeWorld();
  const actor = world.actors['actor-1'];
  actor.position = { x: 6600, y: 4190 };
  interactWithCityLife(world, actor);
  actor.input.moveY = 1;
  updateCityLifeActorInput(world, actor);
  assert.equal(world.cityLife.menus[actor.id].selectedIndex, 1);
  updateCityLifeActorInput(world, actor);
  assert.equal(world.cityLife.menus[actor.id].selectedIndex, 1, 'held stick does not scroll every server tick');
  actor.input.fire = true;
  updateCityLifeActorInput(world, actor);
  assert.equal(world.cityLife.menus[actor.id], undefined);
  assert.equal(actor.input.fire, false);
});

test('optional street cache rotates and pays both the collector and shared party fund', () => {
  const world = makeWorld();
  const actor = world.actors['actor-1'];
  actor.position = { ...world.cityLife.activity.position };
  const result = interactWithCityLife(world, actor);
  assert.equal(result.ok, true);
  assert.equal(result.personalCents, 600);
  assert.equal(result.partyCents, 900);
  assert.equal(actor.walletCents, 10600);
  assert.equal(world.economy.partyFunds.party_a, 900);
  const previousId = world.cityLife.activity.id;
  world.cityLife.activity.rotateAtTick = 1;
  advanceWorld(world, { now: 1 });
  assert.notEqual(world.cityLife.activity.id, previousId);
  assert.equal(world.cityLife.activity.available, true);
});
