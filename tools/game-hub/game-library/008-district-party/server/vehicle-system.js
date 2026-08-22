'use strict';

const { DISCONNECT_TIMEOUT_MS } = require('../shared/constants');
const { clamp } = require('../shared/validation');
const { collidesObstacle } = require('./spatial-index');
const { collidesCityRoadblock } = require('./city-life-system');
const { recordVehicleTheft } = require('./justice-system');
const { ensureVehicleTuning, vehiclePerformance } = require('./vehicle-tuning-system');

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function signedAngleDelta(from, to) {
  let delta = (to - from) % (Math.PI * 2);
  if (delta > Math.PI) delta -= Math.PI * 2;
  if (delta < -Math.PI) delta += Math.PI * 2;
  return delta;
}

function nearestEnterableVehicle(world, actor, maximumDistance = 52) {
  let best = null;
  let bestDistance = maximumDistance;
  for (const vehicle of Object.values(world.vehicles)) {
    if (vehicle.destroyed || vehicle.health <= 0) continue;
    const currentDistance = distance(actor.position, vehicle.position);
    if (currentDistance <= bestDistance && (
      vehicle.driverActorId === null || vehicle.passengerActorIds.length < vehicle.maxOccupants - 1
    )) {
      best = vehicle;
      bestDistance = currentDistance;
    }
  }
  return best;
}

function claimVehicleSeat(world, actorId, vehicleId, requestedSeat = 'auto') {
  const actor = world.actors[actorId];
  const vehicle = world.vehicles[vehicleId];
  if (!actor || !vehicle) return { ok: false, reason: 'not-found' };
  if (vehicle.destroyed || vehicle.health <= 0) return { ok: false, reason: 'vehicle-destroyed' };
  if (!actor.alive) return { ok: false, reason: 'actor-not-alive' };
  if (actor.currentVehicleId) return { ok: false, reason: 'actor-already-in-vehicle' };
  if (distance(actor.position, vehicle.position) > 58) return { ok: false, reason: 'vehicle-too-far' };

  let seat;
  if (requestedSeat === 'driver' && vehicle.driverActorId !== null) {
    return { ok: false, reason: 'seat-occupied' };
  }
  if (requestedSeat === 'passenger' && vehicle.passengerActorIds.length >= vehicle.maxOccupants - 1) {
    return { ok: false, reason: 'vehicle-full' };
  }
  if (vehicle.driverActorId === null && requestedSeat !== 'passenger') {
    vehicle.driverActorId = actor.id;
    seat = 'driver';
  } else if (vehicle.passengerActorIds.length < vehicle.maxOccupants - 1) {
    const usedPassengerSeats = new Set(vehicle.passengerActorIds.map((passengerId) => (
      world.actors[passengerId]?.vehicleSeat
    )).filter(Boolean));
    let passengerNumber = 1;
    while (usedPassengerSeats.has(`passenger_${passengerNumber}`) && passengerNumber < vehicle.maxOccupants) {
      passengerNumber += 1;
    }
    vehicle.passengerActorIds.push(actor.id);
    seat = `passenger_${passengerNumber}`;
  } else {
    return { ok: false, reason: 'vehicle-full' };
  }
  actor.currentVehicleId = vehicle.id;
  actor.vehicleSeat = seat;
  actor.position = { ...vehicle.position };
  const publicVehicleTheft = seat === 'driver' && vehicle.stealable === true && !vehicle.partyOwnerId && !vehicle.purchasedByActorId;
  const movingTheft = publicVehicleTheft && vehicle.traffic?.active === true;
  if (!vehicle.partyOwnerId) vehicle.partyOwnerId = actor.partyId;
  if (publicVehicleTheft) {
    vehicle.stolenByActorId = actor.id;
    recordVehicleTheft(world, actor, vehicle, movingTheft);
  }
  if (seat === 'driver' && vehicle.traffic?.active) {
    vehicle.traffic.active = false;
    vehicle.ambientDriver = false;
    vehicle.parked = false;
  }
  return { ok: true, vehicleId: vehicle.id, actorId: actor.id, seat };
}

function exitVehicle(world, actorId, reason = 'requested') {
  const actor = world.actors[actorId];
  if (!actor || !actor.currentVehicleId) return { ok: false, reason: 'actor-not-in-vehicle' };
  const vehicle = world.vehicles[actor.currentVehicleId];
  const formerVehicleId = actor.currentVehicleId;
  if (vehicle) {
    const exitPosition = findSafeExitPosition(world, actor, vehicle);
    if (!exitPosition) return { ok: false, reason: 'no-safe-exit', vehicleId: vehicle.id, actorId };
    if (vehicle.driverActorId === actor.id) vehicle.driverActorId = null;
    vehicle.passengerActorIds = vehicle.passengerActorIds.filter((id) => id !== actor.id);
    actor.position = exitPosition;
  }
  actor.currentVehicleId = null;
  actor.vehicleSeat = null;
  return { ok: true, vehicleId: formerVehicleId, actorId, reason };
}

function findSafeExitPosition(world, actor, vehicle) {
  const preferredSide = actor.slot % 2 === 0 ? 1 : -1;
  const directions = [
    vehicle.rotation + Math.PI / 2 * preferredSide,
    vehicle.rotation - Math.PI / 2 * preferredSide,
    vehicle.rotation + Math.PI,
    vehicle.rotation,
  ];
  for (const distanceFromVehicle of [32, 40, 48]) {
    for (const angle of directions) {
      const candidate = {
        x: vehicle.position.x + Math.cos(angle) * distanceFromVehicle,
        y: vehicle.position.y + Math.sin(angle) * distanceFromVehicle,
      };
      const inBounds = candidate.x - actor.radius >= 0
        && candidate.x + actor.radius <= world.staticMap.width
        && candidate.y - actor.radius >= 0
        && candidate.y + actor.radius <= world.staticMap.height;
      if (inBounds && !collidesObstacle(world, candidate, actor.radius)) return candidate;
    }
  }
  return null;
}

function ejectAllOccupants(world, vehicle, reason = 'forced-eject') {
  if (!vehicle) return [];
  const occupantIds = [vehicle.driverActorId, ...vehicle.passengerActorIds].filter(Boolean);
  const results = [];
  occupantIds.forEach((actorId, index) => {
    const actor = world.actors[actorId];
    if (!actor) return;
    const safe = findSafeExitPosition(world, actor, vehicle);
    actor.position = safe || { ...actor.spawnPosition };
    actor.currentVehicleId = null;
    actor.vehicleSeat = null;
    actor.velocity = { x: 0, y: 0 };
    results.push({ ok: true, actorId, vehicleId: vehicle.id, reason, fallbackToSpawn: !safe, index });
  });
  vehicle.driverActorId = null;
  vehicle.passengerActorIds = [];
  return results;
}

function respawnVehicle(vehicle) {
  const retainOwner = Boolean(vehicle.purchasedByActorId || ['custom', 'gang-car'].includes(vehicle.vehicleClass));
  vehicle.position = { ...vehicle.spawnPosition };
  vehicle.rotation = Number(vehicle.spawnRotation ?? vehicle.rotation) || 0;
  vehicle.travelRotation = vehicle.rotation;
  vehicle.speed = 0;
  vehicle.velocity = { x: 0, y: 0 };
  vehicle.health = vehicle.maxHealth;
  vehicle.destroyed = false;
  vehicle.destroyedAtTick = null;
  vehicle.respawnAtTick = null;
  vehicle.driverActorId = null;
  vehicle.passengerActorIds = [];
  if (!retainOwner) vehicle.partyOwnerId = null;
  if (vehicle.traffic) {
    vehicle.traffic.active = true;
    vehicle.traffic.waitUntilTick = 0;
    vehicle.ambientDriver = true;
    vehicle.stolenByActorId = null;
  }
}

function updateAmbientTraffic(world, vehicle, deltaSeconds) {
  const traffic = vehicle.traffic;
  if (!traffic?.active || vehicle.driverActorId) return false;
  if (world.tick < (traffic.waitUntilTick || 0)) {
    vehicle.speed = 0;
    vehicle.velocity = { x: 0, y: 0 };
    return true;
  }
  const points = traffic.points || [];
  if (points.length < 2) return false;
  let target = points[traffic.waypointIndex % points.length];
  let dx = target.x - vehicle.position.x;
  let dy = target.y - vehicle.position.y;
  if (Math.hypot(dx, dy) < 34) {
    traffic.waypointIndex = (traffic.waypointIndex + 1) % points.length;
    target = points[traffic.waypointIndex];
    dx = target.x - vehicle.position.x;
    dy = target.y - vehicle.position.y;
  }
  const length = Math.hypot(dx, dy) || 1;
  const cruiseSpeed = Math.max(36, Number(traffic.cruiseSpeed) || 68);
  const previous = { ...vehicle.position };
  vehicle.rotation = Math.atan2(dy, dx);
  vehicle.speed = cruiseSpeed;
  vehicle.velocity = { x: dx / length * cruiseSpeed, y: dy / length * cruiseSpeed };
  vehicle.position.x = clamp(vehicle.position.x + vehicle.velocity.x * deltaSeconds, vehicle.radius, world.staticMap.width - vehicle.radius);
  vehicle.position.y = clamp(vehicle.position.y + vehicle.velocity.y * deltaSeconds, vehicle.radius, world.staticMap.height - vehicle.radius);
  if (collidesObstacle(world, vehicle.position, vehicle.radius) || collidesCityRoadblock(world, vehicle.position, vehicle.radius)) {
    vehicle.position = previous;
    vehicle.speed = 0;
    vehicle.velocity = { x: 0, y: 0 };
    traffic.waitUntilTick = world.tick + 24;
  }
  return true;
}

function recoverDisconnectedDrivers(world, now = Date.now()) {
  const released = [];
  for (const vehicle of Object.values(world.vehicles)) {
    ensureVehicleTuning(vehicle);
    if (!vehicle.driverActorId) continue;
    const actor = world.actors[vehicle.driverActorId];
    if (!actor) {
      vehicle.driverActorId = null;
      continue;
    }
    if (['human', 'adapter'].includes(actor.controller) && actor.lastInputAt > 0 && now - actor.lastInputAt > DISCONNECT_TIMEOUT_MS) {
      actor.connected = false;
      released.push(exitVehicle(world, actor.id, 'driver-disconnected'));
    }
  }
  return released;
}

function vehiclePartyTetherGuard(world, vehicle, proposedPosition) {
  const occupantIds = [vehicle.driverActorId, ...vehicle.passengerActorIds].filter(Boolean);
  const occupants = occupantIds.map((id) => world.actors[id]).filter((actor) => actor?.alive);
  const partyId = occupants[0]?.partyId || null;
  if (!partyId) return { blocked: false, level: 'ok', distance: 0 };
  const outsideAllies = Object.values(world.actors).filter((actor) => (
    actor.alive && actor.partyId === partyId && !occupantIds.includes(actor.id)
  ));
  if (!outsideAllies.length) {
    for (const actor of occupants) actor.tether = { level: 'ok', distance: 0, returnToParty: false, movementBlocked: false };
    return { blocked: false, level: 'ok', distance: 0 };
  }
  const centre = {
    x: outsideAllies.reduce((sum, actor) => sum + actor.position.x, 0) / outsideAllies.length,
    y: outsideAllies.reduce((sum, actor) => sum + actor.position.y, 0) / outsideAllies.length,
  };
  const currentDistance = Math.hypot(vehicle.position.x - centre.x, vehicle.position.y - centre.y);
  const proposedDistance = Math.hypot(proposedPosition.x - centre.x, proposedPosition.y - centre.y);
  const rules = world.tetherRules;
  const blocked = proposedDistance >= rules.hard && proposedDistance > currentDistance;
  const distance = Math.round(currentDistance);
  const level = currentDistance >= rules.hard ? 'hard'
    : currentDistance >= rules.warning ? 'warning'
      : currentDistance >= rules.soft ? 'soft' : 'ok';
  for (const actor of occupants) {
    actor.tether = {
      level,
      distance,
      returnToParty: level === 'warning' || level === 'hard',
      movementBlocked: blocked,
    };
  }
  return { blocked, level, distance, centre };
}

function updateVehicles(world, deltaSeconds, now = Date.now()) {
  recoverDisconnectedDrivers(world, now);
  for (const vehicle of Object.values(world.vehicles)) {
    if (vehicle.destroyed || vehicle.health <= 0) {
      vehicle.speed = 0;
      vehicle.velocity = { x: 0, y: 0 };
      if (vehicle.respawnAtTick !== null && world.tick >= vehicle.respawnAtTick) respawnVehicle(vehicle);
      continue;
    }
    if (['board', 'countdown', 'results'].includes(world.mission?.status)) {
      vehicle.speed = 0;
      vehicle.velocity = { x: 0, y: 0 };
    }
    if (!['board', 'countdown', 'results'].includes(world.mission?.status)
      && updateAmbientTraffic(world, vehicle, deltaSeconds)) continue;
    const driver = vehicle.driverActorId ? world.actors[vehicle.driverActorId] : null;
    const performance = vehiclePerformance(vehicle);
    if (driver && driver.alive && !['board', 'countdown', 'results'].includes(world.mission?.status)) {
      const input = driver.input;
      const forwardRequested = input.sprint || input.moveY < -0.1;
      const reverseRequested = input.moveY > 0.1;
      const acceleration = forwardRequested ? performance.acceleration : reverseRequested ? -performance.reverseAcceleration : 0;
      vehicle.speed += acceleration * deltaSeconds;
      if (input.brake) {
        if (vehicle.speed > 9) vehicle.speed *= Math.pow(performance.brakeRetention, deltaSeconds);
        else vehicle.speed -= performance.reverseAcceleration * deltaSeconds;
      }
      const steeringStrength = Math.min(1, Math.abs(vehicle.speed) / 55);
      vehicle.rotation += input.moveX * performance.steeringRate * steeringStrength * deltaSeconds * (vehicle.speed >= 0 ? 1 : -1);
    }
    vehicle.speed *= Math.pow(performance.dragRetention, deltaSeconds);
    vehicle.speed = clamp(vehicle.speed, -performance.reverseSpeed, performance.topSpeed);
    const previous = { ...vehicle.position };
    if (!Number.isFinite(vehicle.travelRotation)) vehicle.travelRotation = vehicle.rotation;
    if (performance.presetId === 'drift') {
      vehicle.travelRotation += signedAngleDelta(vehicle.travelRotation, vehicle.rotation) * Math.min(1, performance.tractionResponse * deltaSeconds);
    } else vehicle.travelRotation = vehicle.rotation;
    vehicle.velocity.x = Math.cos(vehicle.travelRotation) * vehicle.speed;
    vehicle.velocity.y = Math.sin(vehicle.travelRotation) * vehicle.speed;
    vehicle.position.x += vehicle.velocity.x * deltaSeconds;
    vehicle.position.y += vehicle.velocity.y * deltaSeconds;
    vehicle.position.x = clamp(vehicle.position.x, vehicle.radius, world.staticMap.width - vehicle.radius);
    vehicle.position.y = clamp(vehicle.position.y, vehicle.radius, world.staticMap.height - vehicle.radius);
    const tether = vehiclePartyTetherGuard(world, { ...vehicle, position: previous }, vehicle.position);
    if (tether.blocked || collidesObstacle(world, vehicle.position, vehicle.radius)
      || collidesCityRoadblock(world, vehicle.position, vehicle.radius)) {
      vehicle.position = previous;
      vehicle.speed = tether.blocked ? 0 : vehicle.speed * -0.2;
    }

    const occupantIds = [vehicle.driverActorId, ...vehicle.passengerActorIds].filter(Boolean);
    occupantIds.forEach((actorId, index) => {
      const actor = world.actors[actorId];
      if (!actor) return;
      const offset = index === 0 ? 0 : (index - 2) * 5;
      actor.position.x = vehicle.position.x + Math.cos(vehicle.rotation + Math.PI / 2) * offset;
      actor.position.y = vehicle.position.y + Math.sin(vehicle.rotation + Math.PI / 2) * offset;
      actor.velocity = { ...vehicle.velocity };
      if (actor.vehicleSeat === 'driver') {
        actor.facing = { x: Math.cos(vehicle.rotation), y: Math.sin(vehicle.rotation) };
      } else {
        const explicitAimLength = Math.hypot(actor.input?.aimX || 0, actor.input?.aimY || 0);
        const aimX = explicitAimLength > 0.12 ? actor.input.aimX : actor.input?.moveX || 0;
        const aimY = explicitAimLength > 0.12 ? actor.input.aimY : actor.input?.moveY || 0;
        const aimLength = Math.hypot(aimX, aimY);
        if (aimLength > 0.15) {
          actor.facing = {
            x: aimX / aimLength,
            y: aimY / aimLength,
          };
        }
      }
    });
  }
}

module.exports = {
  claimVehicleSeat,
  ejectAllOccupants,
  exitVehicle,
  findSafeExitPosition,
  nearestEnterableVehicle,
  recoverDisconnectedDrivers,
  respawnVehicle,
  updateVehicles,
  updateAmbientTraffic,
  vehiclePartyTetherGuard,
};
