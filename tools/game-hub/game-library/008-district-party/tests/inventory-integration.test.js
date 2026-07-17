'use strict';

const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const { SessionManager } = require('../server/session-manager');
const { routeInput } = require('../server/input-router');
const { advanceWorld } = require('../server/world-loop');
const { pickupItem } = require('../server/inventory-system');
const { downActor, spawnProjectile } = require('../server/projectile-system');
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

function sendInventoryInput(manager, session, token, seq, input, now) {
  return routeInput(manager, {
    roomCode: session.roomCode,
    sessionId: session.id,
    seatId: 'seat_1',
    token,
    seq,
    input,
  }, now);
}

test('every one of eight simulated actors receives an independent six-plus-twelve host inventory', () => {
  const manager = new SessionManager({ projectRoot });
  const launch = manager.createSession({
    players: Array.from({ length: 8 }, (_, index) => ({
      ...human(index + 1),
      controllerType: index % 2 ? 'ai' : 'human',
    })),
  });
  const actors = Object.values(manager.getSession(launch.sessionId).world.actors);
  assert.equal(actors.length, 8);
  for (const actor of actors) {
    assert.deepEqual(Object.keys(actor.inventory.equipment), ['melee', 'ranged', 'ammo', 'shoes', 'body', 'hat']);
    assert.equal(actor.inventory.bag.length, 12);
    assert.equal(actor.inventoryOpen, false);
    assert.equal(actor.inventory.hostOwned, true);
  }
  assert.notEqual(actors[0].inventory, actors[1].inventory, 'actors never share mutable inventory state');
  assert.notEqual(actors[0].inventory.bag, actors[1].inventory.bag);
});

test('token-bound phone pulses open only its actor quarter and perform a host-owned equipment swap', () => {
  const manager = new SessionManager({ projectRoot });
  const launch = manager.createSession({ players: [human(1), human(2), human(3), human(4)] });
  const session = manager.getSession(launch.sessionId);
  const actor = session.world.actors['actor-seat-1'];
  const other = session.world.actors['actor-seat-2'];
  const token = launch.controllerLinks.find((link) => link.seatId === 'seat_1').token;
  const start = { ...actor.position };

  pickupItem(actor.inventory, item('hat-basic-a', 'Test Hat A', 'hat'));
  pickupItem(actor.inventory, item('hat-basic-b', 'Test Hat B', 'hat'));
  assert.equal(actor.inventory.equipment.hat.id, 'hat-basic-a');
  assert.equal(actor.inventory.bag[0].id, 'hat-basic-b');

  assert.equal(sendInventoryInput(manager, session, token, 1, {
    inventoryToggle: true,
    moveX: 1,
    attack: true,
  }, 10_000).ok, true);
  advanceWorld(session.world, { now: 10_001 });
  assert.equal(actor.inventoryOpen, true);
  assert.equal(other.inventoryOpen, false, 'one seat cannot open another actor inventory');
  assert.deepEqual(actor.position, start, 'movement is paused for the actor whose inventory is open');
  assert.equal(Object.keys(session.world.projectiles).length, 0, 'combat is paused for that actor');

  sendInventoryInput(manager, session, token, 2, {}, 10_002);
  advanceWorld(session.world, { now: 10_003 });
  sendInventoryInput(manager, session, token, 3, { inventoryActivate: true }, 10_004);
  advanceWorld(session.world, { now: 10_005 });
  assert.equal(actor.inventory.equipment.hat.id, 'hat-basic-b');
  assert.equal(actor.inventory.bag[0].id, 'hat-basic-a');

  sendInventoryInput(manager, session, token, 4, {}, 10_006);
  advanceWorld(session.world, { now: 10_007 });
  sendInventoryInput(manager, session, token, 5, { inventoryToggle: true }, 10_008);
  advanceWorld(session.world, { now: 10_009 });
  assert.equal(actor.inventoryOpen, false);
});

test('quick phone pulse remains latched until a host tick even when its release packet arrives first', () => {
  const manager = new SessionManager({ projectRoot });
  const launch = manager.createSession({ players: [human(1)] });
  const session = manager.getSession(launch.sessionId);
  const actor = session.world.actors['actor-seat-1'];
  const token = launch.controllerLinks[0].token;

  assert.equal(sendInventoryInput(manager, session, token, 1, { inventoryToggle: true }, 20_000).ok, true);
  assert.equal(sendInventoryInput(manager, session, token, 2, {}, 20_001).ok, true);
  assert.equal(actor.inventoryOpen, false, 'world has not consumed the pulse before its tick');
  assert.equal(actor.pendingPulses.inventoryToggle, true, 'release packet cannot erase the accepted rising edge');
  advanceWorld(session.world, { now: 20_002 });
  assert.equal(actor.inventoryOpen, true);
  assert.equal(actor.pendingPulses.inventoryToggle, false);

  sendInventoryInput(manager, session, token, 3, { inventoryToggle: true }, 20_003);
  sendInventoryInput(manager, session, token, 4, {}, 20_004);
  advanceWorld(session.world, { now: 20_005 });
  assert.equal(actor.inventoryOpen, false);

  const vehicle = session.world.vehicles['vehicle-001'];
  actor.position = { ...vehicle.position };
  sendInventoryInput(manager, session, token, 5, { action: true }, 20_006);
  sendInventoryInput(manager, session, token, 6, {}, 20_007);
  assert.equal(actor.pendingPulses.action, true, 'ACTION uses the same host latch');
  advanceWorld(session.world, { now: 20_008 });
  assert.equal(actor.currentVehicleId, vehicle.id, 'quick ACTION still enters the vehicle');
  assert.equal(actor.pendingPulses.action, false);
});

test('pulse input accepted while dead is ignored and cannot reopen inventory after respawn', () => {
  const manager = new SessionManager({ projectRoot });
  const launch = manager.createSession({ players: [human(1)] });
  const session = manager.getSession(launch.sessionId);
  const actor = session.world.actors['actor-seat-1'];
  const token = launch.controllerLinks[0].token;
  downActor(session.world, actor);

  sendInventoryInput(manager, session, token, 1, { inventoryToggle: true, action: true }, 30_000);
  sendInventoryInput(manager, session, token, 2, {}, 30_001);
  assert.equal(actor.pendingPulses.inventoryToggle, undefined);
  assert.equal(actor.pendingPulses.action, undefined);
  while (session.world.tick <= actor.respawnAtTick) advanceWorld(session.world, { now: 30_002 + session.world.tick });
  advanceWorld(session.world, { now: 30_200 });
  assert.equal(actor.alive, true);
  assert.equal(actor.inventoryOpen, false);
  assert.equal(actor.input.inventoryToggle, false);
  assert.equal(actor.input.action, false);
});

test('expired unconsumed ACTION pulse is cleared instead of executing after an input timeout', () => {
  const manager = new SessionManager({ projectRoot });
  const launch = manager.createSession({ players: [human(1)] });
  const session = manager.getSession(launch.sessionId);
  const actor = session.world.actors['actor-seat-1'];
  const token = launch.controllerLinks[0].token;
  const vehicle = session.world.vehicles['vehicle-001'];
  actor.position = { ...vehicle.position };

  sendInventoryInput(manager, session, token, 1, { action: true }, 40_000);
  assert.equal(actor.pendingPulses.action, true);
  advanceWorld(session.world, { now: 40_601 });
  assert.equal(actor.currentVehicleId, null);
  assert.equal(actor.input.action, false);
  assert.equal(actor.pendingPulses.action, undefined);
});

test('equipped ranged item consumes host ammo and depletion auto-equips the first compatible bag stack', () => {
  const world = createWorldState({ projectRoot, players: [human(1)] });
  const actor = world.actors['actor-seat-1'];
  pickupItem(actor.inventory, item('test-ranged', 'Test Ranged', 'ranged', { ammoType: 'test-pulse' }));
  pickupItem(actor.inventory, item('test-ammo-first', 'Test Ammo 1', 'ammo', { ammoType: 'test-pulse', quantity: 1 }));
  pickupItem(actor.inventory, item('test-ammo-next', 'Test Ammo 2', 'ammo', { ammoType: 'test-pulse', quantity: 4 }));

  const projectile = spawnProjectile(world, actor);
  assert.ok(projectile, 'host created a projectile after consuming ammo');
  assert.equal(projectile.autoReloadedItemId, 'test-ammo-next');
  assert.equal(actor.inventory.equipment.ammo.id, 'test-ammo-next');
  assert.equal(actor.inventory.equipment.ammo.quantity, 4);
  assert.equal(actor.inventory.bag[0], null);

  world.tick = actor.nextAttackTick;
  spawnProjectile(world, actor);
  assert.equal(actor.inventory.equipment.ammo.quantity, 3, 'the newly equipped stack is used by the next shot');
});

test('equipped ranged item cannot fire without ammo, while the provisional built-in sidearm remains available before gear exists', () => {
  const gearedWorld = createWorldState({ projectRoot, players: [human(1)] });
  const gearedActor = gearedWorld.actors['actor-seat-1'];
  pickupItem(gearedActor.inventory, item('empty-ranged', 'Empty Ranged', 'ranged', { ammoType: 'test-pulse' }));
  assert.equal(spawnProjectile(gearedWorld, gearedActor), null);
  assert.ok(gearedWorld.effects.some((effect) => effect.kind === 'dry-fire'));

  const emptyInventoryWorld = createWorldState({ projectRoot, players: [human(1)] });
  const emptyActor = emptyInventoryWorld.actors['actor-seat-1'];
  assert.ok(spawnProjectile(emptyInventoryWorld, emptyActor), 'v0.1 built-in pulse sidearm preserves current playable combat');
  emptyInventoryWorld.tick = emptyActor.nextAttackTick;
  emptyActor.inventoryOpen = true;
  assert.equal(spawnProjectile(emptyInventoryWorld, emptyActor), null, 'open inventory blocks combat on the host');
});

test('shared-screen inventory markup defines exact quadrants and phone controls without party-screen inputs', () => {
  const overlay = fs.readFileSync(path.join(projectRoot, 'client/game/ui/inventory-overlay.js'), 'utf8');
  const css = fs.readFileSync(path.join(projectRoot, 'client/game/inventory.css'), 'utf8');
  const controller = fs.readFileSync(path.join(projectRoot, 'client/controller/controller.html'), 'utf8');
  assert.match(css, /width:\s*50vw/);
  assert.match(css, /height:\s*50vh/);
  assert.match(css, /\.inventory-q1\s*\{\s*top:\s*0;\s*left:\s*0;/);
  assert.match(css, /\.inventory-q2\s*\{\s*top:\s*0;\s*right:\s*0;/);
  assert.match(css, /\.inventory-q3\s*\{\s*bottom:\s*0;\s*left:\s*0;/);
  assert.match(css, /\.inventory-q4\s*\{\s*right:\s*0;\s*bottom:\s*0;/);
  assert.match(overlay, /\['ranged', 'RANGED'\],[\s\S]*\['ammo', 'AMMO'\]/);
  assert.match(overlay, /for \(let index = 0; index < 12;/);
  for (const id of ['inventory-toggle', 'inventory-prev', 'inventory-next', 'inventory-activate', 'shield']) {
    assert.match(controller, new RegExp(`id="${id}"`));
  }
  assert.doesNotMatch(overlay, /fetch\(|addEventListener\(|\/api\/input/);
});
