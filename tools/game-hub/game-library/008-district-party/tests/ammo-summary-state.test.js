'use strict';

const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const { pickupItem } = require('../server/inventory-system');
const { publicActor, serializeWorldState } = require('../server/display-state');
const { createWorldState } = require('../server/world-state');

const projectRoot = path.join(__dirname, '..');

function human(slot = 1) {
  return {
    actorId: `actor-seat-${slot}`,
    slot,
    seatId: `seat_${slot}`,
    displayName: `Player ${slot}`,
    controllerType: 'human',
    adapterId: null,
    partyId: slot <= 4 ? 'party_a' : 'party_b',
  };
}

function item(id, displayName, equipSlot, extra = {}) {
  return { id, displayName, equipSlot, ...extra };
}

test('public actor derives a compatible total without adding mutable ammo state to its source actor', () => {
  const world = createWorldState({ projectRoot, players: [human(1)] });
  const actor = world.actors['actor-seat-1'];
  pickupItem(actor.inventory, item('test-ranged', 'Test Ranged', 'ranged', { ammoType: 'pulse-cell' }));
  pickupItem(actor.inventory, item('test-loaded', 'Loaded Cells', 'ammo', { ammoType: 'pulse-cell', quantity: 4 }));
  pickupItem(actor.inventory, item('test-reserve', 'Reserve Cells', 'ammo', { ammoType: 'pulse-cell', quantity: 9 }));
  pickupItem(actor.inventory, item('other-reserve', 'Other Cells', 'ammo', { ammoType: 'other-cell', quantity: 99 }));

  assert.equal(actor.ammoSummary, undefined, 'derived HUD data is not stored in authoritative actor state');
  const first = publicActor(actor, world);
  const second = publicActor(actor, world);
  assert.deepEqual(first.ammoSummary, {
    mode: 'inventory',
    unlimited: false,
    weaponId: 'test-ranged',
    weaponName: 'Test Ranged',
    ammoType: 'pulse-cell',
    loaded: 4,
    reserve: 9,
    total: 13,
  });
  assert.notEqual(first.ammoSummary, second.ammoSummary, 'each serialized view receives a fresh derived value');
  assert.equal(actor.ammoSummary, undefined);
});

test('serialized server world state includes the host-derived ammo summary for every actor', () => {
  const world = createWorldState({ projectRoot, players: [human(1), human(2)] });
  const actor = world.actors['actor-seat-2'];
  pickupItem(actor.inventory, item('ranged-b', 'Ranged B', 'ranged', { ammoType: 'type-b' }));
  pickupItem(actor.inventory, item('ammo-b', 'Ammo B', 'ammo', { ammoType: 'type-b', quantity: 6 }));
  const session = { id: 'session-test', roomCode: 'AXM1', status: 'running', world };

  const actors = serializeWorldState(session, 'party_a').world.actors;
  assert.equal(actors.length, 2);
  assert.equal(actors[0].ammoSummary.unlimited, true);
  assert.equal(actors[0].ammoSummary.total, null);
  assert.equal(actors[1].ammoSummary.unlimited, false);
  assert.equal(actors[1].ammoSummary.loaded, 6);
  assert.equal(actors[1].ammoSummary.reserve, 0);
  assert.equal(actors[1].ammoSummary.total, 6);
  assert.equal(world.actors['actor-seat-2'].ammoSummary, undefined);
});

test('all eight reserved seat actors serialize independent ammunition summaries without a four-seat assumption', () => {
  const players = Array.from({ length: 8 }, (_, index) => human(index + 1));
  const world = createWorldState({ projectRoot, players });
  const actor = world.actors['actor-seat-8'];
  pickupItem(actor.inventory, item('ranged-eight', 'Seat Eight Ranged', 'ranged', { ammoType: 'eight-cell' }));
  pickupItem(actor.inventory, item('loaded-eight', 'Seat Eight Loaded', 'ammo', { ammoType: 'eight-cell', quantity: 2 }));
  pickupItem(actor.inventory, item('reserve-eight', 'Seat Eight Reserve', 'ammo', { ammoType: 'eight-cell', quantity: 11 }));

  const session = { id: 'session-eight', roomCode: 'AXM1', status: 'running', world };
  const actors = serializeWorldState(session, 'all').world.actors.sort((a, b) => a.slot - b.slot);
  assert.equal(actors.length, 8);
  assert.ok(actors.every((entry) => entry.ammoSummary && typeof entry.ammoSummary.mode === 'string'));
  assert.equal(actors[0].ammoSummary.unlimited, true);
  assert.deepEqual(
    { loaded: actors[7].ammoSummary.loaded, reserve: actors[7].ammoSummary.reserve, total: actors[7].ammoSummary.total },
    { loaded: 2, reserve: 11, total: 13 },
  );
});
