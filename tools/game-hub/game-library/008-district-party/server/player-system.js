'use strict';

const { DISCONNECT_TIMEOUT_MS, INPUT_TIMEOUT_MS } = require('../shared/constants');
const { clamp } = require('../shared/validation');
const { interactWithMission, isMissionInputLocked } = require('./mission-system');
const {
  BAG_SLOT_COUNT,
  EQUIPMENT_SLOTS,
  createInventory,
  equipFromBag,
  setCursor,
  unequipToBag,
} = require('./inventory-system');
const { respawnActor } = require('./projectile-system');
const { interactWithTerritory } = require('./territory-system');
const { claimVehicleSeat, exitVehicle, nearestEnterableVehicle } = require('./vehicle-system');

function collidesObstacle(world, position, radius) {
  return world.staticMap.obstacles.some((box) => (
    position.x + radius > box.x
    && position.x - radius < box.x + box.width
    && position.y + radius > box.y
    && position.y - radius < box.y + box.height
  ));
}

function partyCentre(world, partyId, excludedActorId = null) {
  const members = Object.values(world.actors).filter((actor) => (
    actor.id !== excludedActorId && actor.partyId === partyId && actor.alive
  ));
  if (!members.length) return null;
  return {
    x: members.reduce((sum, actor) => sum + actor.position.x, 0) / members.length,
    y: members.reduce((sum, actor) => sum + actor.position.y, 0) / members.length,
  };
}

function applyPartyTether(world, actor, movement) {
  const centre = partyCentre(world, actor.partyId, actor.id);
  if (!centre) {
    actor.tether = { level: 'ok', distance: 0, returnToParty: false, movementBlocked: false };
    return movement;
  }
  const fromCentre = { x: actor.position.x - centre.x, y: actor.position.y - centre.y };
  const distance = Math.hypot(fromCentre.x, fromCentre.y);
  const rules = world.tetherRules;
  let level = 'ok';
  if (distance >= rules.hard) level = 'hard';
  else if (distance >= rules.warning) level = 'warning';
  else if (distance >= rules.soft) level = 'soft';

  const outward = movement.x * fromCentre.x + movement.y * fromCentre.y;
  const blocked = level === 'hard' && outward > 0;
  actor.tether = {
    level,
    distance: Math.round(distance),
    returnToParty: level === 'warning' || level === 'hard',
    movementBlocked: blocked,
  };
  if (!blocked) return movement;

  const magnitudeSquared = fromCentre.x ** 2 + fromCentre.y ** 2 || 1;
  const projection = outward / magnitudeSquared;
  return {
    x: movement.x - fromCentre.x * projection,
    y: movement.y - fromCentre.y * projection,
  };
}

function moveActor(world, actor, deltaSeconds) {
  if (actor.currentVehicleId || !actor.alive || isMissionInputLocked(world)) {
    actor.velocity = { x: 0, y: 0 };
    return;
  }
  let movement = { x: actor.input.moveX, y: actor.input.moveY };
  movement = applyPartyTether(world, actor, movement);
  const magnitude = Math.hypot(movement.x, movement.y);
  const aimX = Number(actor.input.aimX) || 0;
  const aimY = Number(actor.input.aimY) || 0;
  const aimMagnitude = Math.hypot(aimX, aimY);
  if (magnitude > 0.001) {
    movement.x /= Math.max(1, magnitude);
    movement.y /= Math.max(1, magnitude);
  }
  if (aimMagnitude > 0.12) actor.facing = { x: aimX / aimMagnitude, y: aimY / aimMagnitude };
  else if (magnitude > 0.001) actor.facing = { x: movement.x, y: movement.y };
  const speed = actor.input.sprint ? 158 : 112;
  actor.velocity = { x: movement.x * speed, y: movement.y * speed };
  const previous = { ...actor.position };

  actor.position.x = clamp(actor.position.x + actor.velocity.x * deltaSeconds, actor.radius, world.staticMap.width - actor.radius);
  if (collidesObstacle(world, actor.position, actor.radius)) actor.position.x = previous.x;
  actor.position.y = clamp(actor.position.y + actor.velocity.y * deltaSeconds, actor.radius, world.staticMap.height - actor.radius);
  if (collidesObstacle(world, actor.position, actor.radius)) actor.position.y = previous.y;
}

function processActorAction(world, actor) {
  if (!actor.input.action || !actor.alive) return null;
  actor.input.action = false;
  if (actor.pendingPulses) actor.pendingPulses.action = false;

  const territoryResult = interactWithTerritory(world, actor);
  if (territoryResult.ok) return { kind: 'territory', ...territoryResult };
  if (world.territory?.status === 'results') return { ok: false, kind: 'territory', reason: 'territory-results-active' };
  const missionResult = interactWithMission(world, actor);
  if (missionResult.ok) return { kind: 'mission', ...missionResult };
  if (actor.currentVehicleId) return { kind: 'vehicle', ...exitVehicle(world, actor.id) };
  const vehicle = nearestEnterableVehicle(world, actor);
  if (vehicle) return { kind: 'vehicle', ...claimVehicleSeat(world, actor.id, vehicle.id) };
  return { ok: false, kind: 'none', reason: 'nothing-in-range' };
}

function inventoryLocations() {
  return [
    ...EQUIPMENT_SLOTS.map((slot) => ({ container: 'equipment', slot })),
    ...Array.from({ length: BAG_SLOT_COUNT }, (_, index) => ({ container: 'bag', index })),
  ];
}

const INVENTORY_LOCATIONS = Object.freeze(inventoryLocations());

function inventoryLocationIndex(cursor) {
  if (cursor?.container === 'equipment') {
    return EQUIPMENT_SLOTS.indexOf(cursor.slot);
  }
  if (cursor?.container === 'bag' && Number.isInteger(cursor.index)) {
    return EQUIPMENT_SLOTS.length + cursor.index;
  }
  return 0;
}

function clearInventoryPulses(actor) {
  for (const field of ['inventoryToggle', 'inventoryPrev', 'inventoryNext', 'inventoryActivate']) {
    actor.input[field] = false;
    if (actor.pendingPulses) actor.pendingPulses[field] = false;
  }
}

function suppressGameplayInput(actor) {
  actor.input.moveX = 0;
  actor.input.moveY = 0;
  actor.input.aimX = 0;
  actor.input.aimY = 0;
  actor.input.aimActive = false;
  actor.input.action = false;
  actor.input.attack = false;
  actor.input.fire = false;
  actor.input.sprint = false;
  actor.input.brake = false;
  actor.fireQueuedUntilTick = null;
  if (actor.pendingPulses) {
    actor.pendingPulses.action = false;
    actor.pendingPulses.fire = false;
  }
  actor.velocity = { x: 0, y: 0 };
}

function moveInventoryCursor(actor, offset) {
  const current = inventoryLocationIndex(actor.inventory.cursor);
  const next = (current + offset + INVENTORY_LOCATIONS.length) % INVENTORY_LOCATIONS.length;
  return setCursor(actor.inventory, INVENTORY_LOCATIONS[next]);
}

function activateInventoryCursor(actor) {
  const cursor = actor.inventory.cursor;
  if (cursor?.container === 'equipment') return unequipToBag(actor.inventory, cursor.slot);
  if (cursor?.container === 'bag') return equipFromBag(actor.inventory, cursor.index);
  return { ok: false, reason: 'invalid-cursor' };
}

function processInventoryInput(actor) {
  actor.inventory ||= createInventory();
  const input = actor.input;
  let result = null;

  if (input.inventoryToggle) {
    actor.inventoryOpen = !actor.inventoryOpen;
    result = { ok: true, kind: 'inventory-toggle', open: actor.inventoryOpen };
  }

  if (actor.inventoryOpen) {
    suppressGameplayInput(actor);
    if (input.inventoryPrev) result = { kind: 'inventory-cursor', ...moveInventoryCursor(actor, -1) };
    if (input.inventoryNext) result = { kind: 'inventory-cursor', ...moveInventoryCursor(actor, 1) };
    if (input.inventoryActivate) result = { kind: 'inventory-activate', ...activateInventoryCursor(actor) };
  }

  clearInventoryPulses(actor);
  return result;
}

function refreshExternalInputState(actor, now) {
  if (!['human', 'adapter'].includes(actor.controller)) return;
  if (actor.lastInputAt && now - actor.lastInputAt > INPUT_TIMEOUT_MS) {
    actor.input.moveX = 0;
    actor.input.moveY = 0;
    actor.input.aimX = 0;
    actor.input.aimY = 0;
    actor.input.aimActive = false;
    actor.input.sprint = false;
    actor.input.brake = false;
    actor.input.attack = false;
    actor.input.fire = false;
    actor.input.action = false;
    actor.actionHeld = false;
    actor.input.inventoryToggle = false;
    actor.input.inventoryPrev = false;
    actor.input.inventoryNext = false;
    actor.input.inventoryActivate = false;
    actor.inputHeld = {};
    actor.pendingPulses = {};
    actor.fireQueuedUntilTick = null;
  }
  if (actor.lastInputAt && now - actor.lastInputAt > DISCONNECT_TIMEOUT_MS) {
    actor.connected = false;
    actor.inventoryOpen = false;
  }
}

function updatePlayers(world, deltaSeconds, now = Date.now()) {
  for (const actor of Object.values(world.actors)) {
    if (!actor.alive) {
      if (actor.respawnAtTick !== null && world.tick >= actor.respawnAtTick) respawnActor(world, actor);
      continue;
    }
    refreshExternalInputState(actor, now);
    if (isMissionInputLocked(world)) {
      actor.inventoryOpen = false;
      clearInventoryPulses(actor);
    } else {
      processInventoryInput(actor);
    }
    processActorAction(world, actor);
    moveActor(world, actor, deltaSeconds);
  }
}

module.exports = {
  applyPartyTether,
  collidesObstacle,
  moveActor,
  moveInventoryCursor,
  partyCentre,
  processInventoryInput,
  processActorAction,
  refreshExternalInputState,
  updatePlayers,
};
