'use strict';

const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const { createWorldState } = require('../server/world-state');
const {
  interactWithCityContract,
  publicTarget,
  startCityContract,
  updateCityContracts,
} = require('../server/city-contract-system');
const { serviceVehicle } = require('../server/city-life-system');
const { claimVehicleSeat, exitVehicle } = require('../server/vehicle-system');

const projectRoot = path.join(__dirname, '..');

function makeWorld() {
  return createWorldState({
    projectRoot,
    players: [
      { actorId: 'actor-1', seatId: 'seat-1', slot: 1, displayName: 'Mike', controllerType: 'human', partyId: 'party_a' },
      { actorId: 'actor-2', seatId: 'seat-2', slot: 2, displayName: 'Errol', controllerType: 'human', partyId: 'party_a' },
    ],
  });
}

test('Metro Dispatch starts one deterministic cooperative courier route per party', () => {
  const first = makeWorld();
  const second = makeWorld();
  const actor = first.actors['actor-1'];
  const started = startCityContract(first, actor, 'courier');
  startCityContract(second, second.actors['actor-1'], 'courier');
  assert.equal(started.ok, true);
  assert.equal(first.cityLife.contracts.party_a.label, 'NEON COURIER CIRCUIT');
  assert.deepEqual(first.cityLife.contracts.party_a.checkpoints, second.cityLife.contracts.party_a.checkpoints);
  assert.equal(startCityContract(first, actor, 'streetRace').reason, 'contract-active');
});

test('two humans can alternate courier handoffs and receive the declared 40/60 completion split', () => {
  const world = makeWorld();
  const mike = world.actors['actor-1'];
  const errol = world.actors['actor-2'];
  startCityContract(world, mike, 'courier');
  const contract = world.cityLife.contracts.party_a;
  const startingMikeWallet = mike.walletCents;
  const startingErrolWallet = errol.walletCents;
  for (let index = 0; index < contract.checkpoints.length; index += 1) {
    const actor = index % 2 ? errol : mike;
    actor.position = { ...publicTarget(contract).position };
    const result = interactWithCityContract(world, actor);
    assert.equal(result.ok, true);
  }
  assert.equal(contract.status, 'complete');
  assert.deepEqual(contract.contributors.sort(), ['actor-1', 'actor-2']);
  assert.equal(mike.walletCents, startingMikeWallet + 640);
  assert.equal(errol.walletCents, startingErrolWallet + 640);
  assert.equal(world.economy.partyFunds.party_a, 1920);
  assert.equal(world.cityLife.counters.contractsCompleted, 1);
});

test('Civic Night Run advances only a party driver through all four gates', () => {
  const world = makeWorld();
  const driver = world.actors['actor-1'];
  const passenger = world.actors['actor-2'];
  startCityContract(world, driver, 'streetRace');
  const contract = world.cityLife.contracts.party_a;
  passenger.position = { ...publicTarget(contract).position };
  updateCityContracts(world);
  assert.equal(contract.stepIndex, 0, 'an on-foot player cannot clear a race gate');
  driver.currentVehicleId = 'test-car';
  driver.vehicleSeat = 'driver';
  while (contract.status === 'active') {
    driver.position = { ...publicTarget(contract).position };
    updateCityContracts(world);
  }
  assert.equal(contract.status, 'complete');
  assert.equal(contract.completedByActorId, driver.id);
});

test('Rival Patrol spawns bounded waves and advances only after both rivals are cleared', () => {
  const world = makeWorld();
  const actor = world.actors['actor-1'];
  startCityContract(world, actor, 'patrol');
  const contract = world.cityLife.contracts.party_a;
  for (let stop = 0; stop < contract.checkpoints.length; stop += 1) {
    actor.position = { ...publicTarget(contract).position };
    const started = interactWithCityContract(world, actor);
    assert.equal(started.action, 'wave-started');
    assert.equal(contract.enemyIds.length, 2);
    updateCityContracts(world);
    assert.equal(contract.phase, 'clear', 'living rivals hold the current patrol stop');
    contract.enemyIds.forEach((id) => { world.npcs[id].alive = false; });
    updateCityContracts(world);
  }
  assert.equal(contract.status, 'complete');
  assert.equal(Object.values(world.npcs).filter((npc) => npc.source === 'city-contract').length, 0);
});

test('expired jobs fail visibly and clean up their temporary contract rivals', () => {
  const world = makeWorld();
  const actor = world.actors['actor-1'];
  startCityContract(world, actor, 'patrol');
  const contract = world.cityLife.contracts.party_a;
  actor.position = { ...publicTarget(contract).position };
  interactWithCityContract(world, actor);
  contract.endsAtTick = world.tick;
  updateCityContracts(world);
  assert.equal(contract.status, 'failed');
  assert.equal(Object.values(world.npcs).filter((npc) => npc.source === 'city-contract').length, 0);
});

test('stealing a parked car creates heat and the chop shop can turn it into an owned custom car', () => {
  const world = makeWorld();
  const actor = world.actors['actor-1'];
  const vehicle = Object.values(world.vehicles).find((entry) => entry.parked && entry.stealable);
  actor.position = { ...vehicle.position };
  assert.equal(claimVehicleSeat(world, actor.id, vehicle.id, 'driver').ok, true);
  assert.equal(vehicle.stolenByActorId, actor.id);
  assert.equal(world.justice.vehicleThefts, 1);
  assert.ok(world.justice.heat > 0);
  assert.equal(exitVehicle(world, actor.id).ok, true);
  actor.walletCents = 5000;
  actor.position = { x: 7460, y: 4680 };
  vehicle.position = { x: 7460, y: 4710 };
  const heatBefore = world.justice.heat;
  const result = serviceVehicle(world, actor, { id: 'legalize-vehicle', priceCents: 900 });
  assert.equal(result.ok, true);
  assert.equal(vehicle.vehicleClass, 'custom');
  assert.equal(vehicle.partyOwnerId, actor.partyId);
  assert.equal(vehicle.stolenByActorId, null);
  assert.ok(world.justice.heat < heatBefore);
  assert.equal(actor.walletCents, 4100);
});
