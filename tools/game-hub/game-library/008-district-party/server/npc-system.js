'use strict';

const { clamp } = require('../shared/validation');
const { applyActorDamage, applyNpcDamage, spawnNpcProjectile } = require('./projectile-system');
const { territoryTargetForParty } = require('./territory-system');
const { findGridPath } = require('./ai-player-system');

function normalized(dx, dy) {
  const distance = Math.hypot(dx, dy);
  const length = distance || 1;
  return { x: dx / length, y: dy / length, distance };
}

function nearestProjectile(world, npc, radius = 75) {
  for (const projectile of Object.values(world.projectiles)) {
    if (projectile.ownerNpcId) continue;
    if (Math.hypot(projectile.position.x - npc.position.x, projectile.position.y - npc.position.y) < radius) return projectile;
  }
  return null;
}

function nearestMovingVehicle(world, npc, radius = 58) {
  let nearest = null;
  for (const vehicle of Object.values(world.vehicles)) {
    if (vehicle.destroyed) continue;
    const distance = Math.hypot(vehicle.position.x - npc.position.x, vehicle.position.y - npc.position.y);
    if (distance <= radius && Math.abs(vehicle.speed) > 18 && (!nearest || distance < nearest.distance)) {
      nearest = { vehicle, distance };
    }
  }
  return nearest;
}

function npcCollidesObstacle(world, position, radius) {
  return world.staticMap.obstacles.some((box) => (
    position.x + radius > box.x
    && position.x - radius < box.x + box.width
    && position.y + radius > box.y
    && position.y - radius < box.y + box.height
  ));
}

function moveNpcWithCollision(world, npc, velocity, deltaSeconds) {
  const previous = { ...npc.position };
  npc.position.x = clamp(npc.position.x + velocity.x * deltaSeconds, npc.radius, world.staticMap.width - npc.radius);
  if (npcCollidesObstacle(world, npc.position, npc.radius)) npc.position.x = previous.x;
  npc.position.y = clamp(npc.position.y + velocity.y * deltaSeconds, npc.radius, world.staticMap.height - npc.radius);
  if (npcCollidesObstacle(world, npc.position, npc.radius)) npc.position.y = previous.y;
  return npc.position.x !== previous.x || npc.position.y !== previous.y;
}

function respawnNpc(npc) {
  npc.position = { ...npc.spawnPosition };
  npc.velocity = { x: 0, y: 0 };
  npc.health = npc.maxHealth;
  npc.alive = true;
  npc.state = npc.hostile ? 'guard' : 'follow_route';
  npc.downedAtTick = null;
  npc.respawnAtTick = null;
  npc.pendingAttack = null;
}

function updateCivilian(world, npc, deltaSeconds) {
  const nearbyProjectile = nearestProjectile(world, npc);
  const nearbyVehicle = nearestMovingVehicle(world, npc);
  if (nearbyProjectile) {
    npc.state = 'flee';
    npc.stateUntilTick = world.tick + 60;
  } else if (nearbyVehicle && npc.state !== 'flee') {
    npc.state = 'avoid_vehicle';
    npc.stateUntilTick = world.tick + 30;
  }
  if (npc.state === 'idle' || npc.state === 'pause_at_corner') {
    npc.velocity = { x: 0, y: 0 };
    if (world.tick >= npc.stateUntilTick) npc.state = 'follow_route';
    return;
  }

  let target;
  if (npc.state === 'flee' && nearbyProjectile) {
    target = {
      x: npc.position.x + (npc.position.x - nearbyProjectile.position.x) * 2,
      y: npc.position.y + (npc.position.y - nearbyProjectile.position.y) * 2,
    };
  } else if (npc.state === 'avoid_vehicle' && nearbyVehicle) {
    target = {
      x: npc.position.x + (npc.position.x - nearbyVehicle.vehicle.position.x) * 2,
      y: npc.position.y + (npc.position.y - nearbyVehicle.vehicle.position.y) * 2,
    };
  } else {
    if (npc.state === 'flee' && world.tick >= npc.stateUntilTick) npc.state = 'recover';
    if (npc.state === 'recover' && world.tick >= npc.stateUntilTick) npc.state = 'follow_route';
    if (npc.state === 'avoid_vehicle' && world.tick >= npc.stateUntilTick) npc.state = 'follow_route';
    const route = world.staticMap.npcRoutes[npc.routeId] || [];
    target = route[npc.routeIndex % route.length] || npc.position;
  }
  const direction = normalized(target.x - npc.position.x, target.y - npc.position.y);
  const speed = npc.state === 'flee' ? 75 : 38;
  npc.velocity = { x: direction.x * speed, y: direction.y * speed };
  npc.facing = { x: direction.x, y: direction.y };
  const moved = moveNpcWithCollision(world, npc, npc.velocity, deltaSeconds);
  if (!moved && direction.distance >= 8) {
    const route = world.staticMap.npcRoutes[npc.routeId] || [];
    npc.routeIndex = route.length ? (npc.routeIndex + 1) % route.length : 0;
    npc.state = 'pause_at_corner';
    npc.stateUntilTick = world.tick + 12;
  }
  if (direction.distance < 8 && npc.state !== 'flee') {
    const route = world.staticMap.npcRoutes[npc.routeId] || [];
    npc.routeIndex = route.length ? (npc.routeIndex + 1) % route.length : 0;
    npc.state = 'pause_at_corner';
    npc.stateUntilTick = world.tick + 20 + (npc.routeIndex * 3);
  }
}

function nearestLivingActor(world, npc, maximumDistance = Infinity) {
  let nearest = null;
  for (const actor of Object.values(world.actors)) {
    if (!actor.alive) continue;
    const distance = Math.hypot(actor.position.x - npc.position.x, actor.position.y - npc.position.y);
    if (distance <= maximumDistance && (!nearest || distance < nearest.distance)) nearest = { actor, distance };
  }
  return nearest;
}

function hostileObjective(world, npc) {
  if (npc.source === 'mission' && world.mission?.mode === 'hold_relay' && world.mission.relay?.health > 0) {
    return { kind: 'relay', id: world.mission.relay.id, position: world.mission.relay.position };
  }
  if (npc.kind === 'crew' && npc.partyId) {
    let nearest = null;
    const candidates = [
      ...Object.values(world.actors).filter((actor) => actor.partyId && actor.partyId !== npc.partyId),
      ...Object.values(world.npcs).filter((other) => (
        other.kind === 'crew' && other.partyId && other.partyId !== npc.partyId && other.id !== npc.id
      )),
    ];
    for (const candidate of candidates) {
      if (!candidate.alive) continue;
      const candidateDistance = Math.hypot(candidate.position.x - npc.position.x, candidate.position.y - npc.position.y);
      if (candidateDistance <= 220 && (!nearest || candidateDistance < nearest.distance)) {
        nearest = { entity: candidate, distance: candidateDistance };
      }
    }
    if (nearest) {
      const target = nearest.entity;
      return target.kind === 'player'
        ? { kind: 'actor', id: target.id, position: target.position, actor: target }
        : { kind: 'npc', id: target.id, position: target.position, npc: target };
    }
    const zone = world.territory?.zones?.find((entry) => entry.id === npc.assignedZoneId)
      || territoryTargetForParty(world, npc.partyId);
    if (zone) {
      npc.assignedZoneId = zone.id;
      return { kind: 'territory', id: zone.id, position: zone, radius: zone.radius };
    }
    return null;
  }
  const aggroRange = npc.source === 'city' && npc.state !== 'engage' && npc.health === npc.maxHealth ? 185 : Infinity;
  const nearest = nearestLivingActor(world, npc, aggroRange);
  return nearest ? { kind: 'actor', id: nearest.actor.id, position: nearest.actor.position, actor: nearest.actor } : null;
}

function applyRelayDamage(world, npc) {
  const relay = world.mission?.relay;
  if (!relay || relay.health <= 0) return false;
  relay.health = clamp(relay.health - npc.damage, 0, relay.maxHealth);
  world.effects.push({
    id: `effect-relay-hit-${npc.id}-${world.tick}`,
    kind: 'relay-hit',
    damage: npc.damage,
    position: { ...relay.position },
    expiresAtTick: world.tick + 10,
  });
  return true;
}

function executeHostileAttack(world, npc, target) {
  if (target.kind === 'relay') {
    if (npc.attackKind === 'projectile') spawnNpcProjectile(world, npc, target.position, 'relay');
    else applyRelayDamage(world, npc);
    return;
  }
  if (npc.attackKind === 'projectile') {
    spawnNpcProjectile(world, npc, target.position, target.kind === 'npc' ? 'npc' : null);
    return;
  }
  if (target.kind === 'npc') {
    applyNpcDamage(world, npc, target.npc, {
      id: `npc-melee-${npc.id}-${world.tick}`,
      ownerActorId: null,
      ownerNpcId: npc.id,
      damage: npc.damage,
      channel: 'meleeDamage',
      velocity: { x: npc.facing.x * 80, y: npc.facing.y * 80 },
    });
    npc.nextAttackTick = world.tick + npc.attackCooldownTicks;
    return;
  }
  applyActorDamage(world, npc, target.actor, {
    id: `npc-melee-${npc.id}-${world.tick}`,
    ownerActorId: null,
    ownerNpcId: npc.id,
    damage: npc.damage,
    channel: 'meleeDamage',
    velocity: { x: npc.facing.x * 80, y: npc.facing.y * 80 },
  });
  npc.nextAttackTick = world.tick + npc.attackCooldownTicks;
}

function updateHostile(world, npc, deltaSeconds) {
  const target = hostileObjective(world, npc);
  if (!target) {
    const home = normalized(npc.spawnPosition.x - npc.position.x, npc.spawnPosition.y - npc.position.y);
    npc.state = 'guard';
    npc.velocity = home.distance > 18 ? { x: home.x * npc.moveSpeed * 0.6, y: home.y * npc.moveSpeed * 0.6 } : { x: 0, y: 0 };
    if (home.distance > 18) moveNpcWithCollision(world, npc, npc.velocity, deltaSeconds);
    return;
  }

  let movementTarget = target.position;
  if (npc.kind === 'crew') {
    const pathKey = `${target.kind}:${target.id}`;
    if (npc.aiPathTargetKey !== pathKey || world.tick >= (npc.aiRepathAtTick || 0) || !Array.isArray(npc.aiPath)) {
      npc.aiPath = findGridPath(world, npc.position, target.position);
      npc.aiPathTargetKey = pathKey;
      npc.aiRepathAtTick = world.tick + 45;
    }
    while (npc.aiPath.length && Math.hypot(npc.aiPath[0].x - npc.position.x, npc.aiPath[0].y - npc.position.y) < 16) npc.aiPath.shift();
    movementTarget = npc.aiPath[0] || target.position;
  }
  const vector = normalized(movementTarget.x - npc.position.x, movementTarget.y - npc.position.y);
  const directDistance = Math.hypot(target.position.x - npc.position.x, target.position.y - npc.position.y);
  npc.facing = { x: vector.x, y: vector.y };
  if (target.kind === 'territory' && directDistance <= Math.max(20, Number(target.radius) * 0.45)) {
    npc.state = 'capture';
    npc.velocity = { x: 0, y: 0 };
    return;
  }
  if (npc.pendingAttack) {
    npc.state = 'windup';
    npc.velocity = { x: 0, y: 0 };
    if (world.tick >= npc.pendingAttack.executeAtTick) {
      const refreshed = hostileObjective(world, npc);
      if (refreshed) {
        const currentDistance = Math.hypot(refreshed.position.x - npc.position.x, refreshed.position.y - npc.position.y);
        if (currentDistance <= npc.attackRange + 18) executeHostileAttack(world, npc, refreshed);
      }
      npc.pendingAttack = null;
      npc.nextAttackTick = Math.max(npc.nextAttackTick, world.tick + npc.attackCooldownTicks);
    }
    return;
  }
  if (directDistance <= npc.attackRange && world.tick >= npc.nextAttackTick) {
    npc.pendingAttack = { targetId: target.id, targetKind: target.kind, executeAtTick: world.tick + 9 };
    npc.state = 'windup';
    npc.velocity = { x: 0, y: 0 };
    return;
  }

  npc.state = 'engage';
  let direction = vector;
  if (npc.attackKind === 'projectile' && directDistance < 72) direction = { x: -vector.x, y: -vector.y };
  npc.velocity = { x: direction.x * npc.moveSpeed, y: direction.y * npc.moveSpeed };
  moveNpcWithCollision(world, npc, npc.velocity, deltaSeconds);
}

function updateNpcs(world, deltaSeconds) {
  for (const npc of Object.values(world.npcs)) {
    if (!npc.alive) {
      npc.velocity = { x: 0, y: 0 };
      if (npc.respawnAtTick !== null && world.tick >= npc.respawnAtTick) respawnNpc(npc);
      continue;
    }
    if (npc.hostile) updateHostile(world, npc, deltaSeconds);
    else updateCivilian(world, npc, deltaSeconds);
  }
}

module.exports = {
  applyRelayDamage,
  hostileObjective,
  moveNpcWithCollision,
  nearestLivingActor,
  nearestMovingVehicle,
  npcCollidesObstacle,
  respawnNpc,
  updateNpcs,
};
