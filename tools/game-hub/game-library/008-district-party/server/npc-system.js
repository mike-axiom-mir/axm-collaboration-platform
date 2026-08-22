'use strict';

const { clamp } = require('../shared/validation');
const { applyActorDamage, applyNpcDamage, spawnNpcProjectile } = require('./projectile-system');
const { territoryTargetForParty } = require('./territory-system');
const { findGridPath } = require('./ai-player-system');
const { collidesObstacle } = require('./spatial-index');

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
  return collidesObstacle(world, position, radius);
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
  npc.telegraph = null;
  npc.chargeUntilTick = null;
  npc.burstShotsRemaining = 0;
  npc.lootDropped = false;
}

function updateScheduledCivilian(world, npc, deltaSeconds) {
  const nearbyProjectile = nearestProjectile(world, npc);
  const nearbyVehicle = nearestMovingVehicle(world, npc);
  let target = npc.routine?.target || npc.spawnPosition;
  let movementState = npc.routine?.phase === 'duty' ? 'working' : npc.routine?.phase || 'home';
  let speed = Number(npc.routine?.moveSpeed) || 36;

  if (nearbyProjectile) {
    npc.state = 'flee';
    npc.stateUntilTick = world.tick + 60;
    npc.routineEscapeTarget = {
      x: npc.position.x + (npc.position.x - nearbyProjectile.position.x) * 2,
      y: npc.position.y + (npc.position.y - nearbyProjectile.position.y) * 2,
    };
  } else if (nearbyVehicle && npc.state !== 'flee') {
    npc.state = 'avoid_vehicle';
    npc.stateUntilTick = world.tick + 30;
    npc.routineEscapeTarget = {
      x: npc.position.x + (npc.position.x - nearbyVehicle.vehicle.position.x) * 2,
      y: npc.position.y + (npc.position.y - nearbyVehicle.vehicle.position.y) * 2,
    };
  }

  if (world.tick < (npc.stateUntilTick || 0) && ['flee', 'avoid_vehicle'].includes(npc.state) && npc.routineEscapeTarget) {
    target = npc.routineEscapeTarget;
    movementState = npc.state;
    speed = npc.state === 'flee' ? 75 : 55;
  } else {
    npc.routineEscapeTarget = null;
    npc.stateUntilTick = 0;
  }

  const direct = normalized(target.x - npc.position.x, target.y - npc.position.y);
  if (direct.distance < 11 && !npc.routineEscapeTarget) {
    npc.velocity = { x: 0, y: 0 };
    npc.state = movementState;
    npc.routinePath = [];
    npc.routinePathTargetKey = null;
    return;
  }

  let movementTarget = target;
  if (!npc.routineEscapeTarget) {
    const targetKey = `${npc.routine?.phase || 'home'}:${npc.routine?.destinationId || 'home'}:${Math.round(target.x / 16)}:${Math.round(target.y / 16)}`;
    if (npc.routinePathTargetKey !== targetKey || world.tick >= (npc.routineRepathAtTick || 0) || !Array.isArray(npc.routinePath)) {
      npc.routinePath = findGridPath(world, npc.position, target, 32);
      npc.routinePathTargetKey = targetKey;
      npc.routineRepathAtTick = world.tick + 90;
    }
    while (npc.routinePath.length && Math.hypot(npc.routinePath[0].x - npc.position.x, npc.routinePath[0].y - npc.position.y) < 13) npc.routinePath.shift();
    movementTarget = npc.routinePath[0] || target;
  }

  const direction = normalized(movementTarget.x - npc.position.x, movementTarget.y - npc.position.y);
  npc.state = movementState;
  npc.velocity = { x: direction.x * speed, y: direction.y * speed };
  npc.facing = { x: direction.x, y: direction.y };
  const moved = moveNpcWithCollision(world, npc, npc.velocity, deltaSeconds);
  if (!moved && direction.distance >= 8) npc.routineRepathAtTick = world.tick + 1;
}

function updateCivilian(world, npc, deltaSeconds) {
  if (npc.cityLifeResident && npc.routine) {
    updateScheduledCivilian(world, npc, deltaSeconds);
    return;
  }
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
  if (npc.kind === 'crew' && npc.source === 'bodyguard' && npc.partyId) {
    let nearestThreat = null;
    const threats = Object.values(world.npcs).filter((other) => (
      other.id !== npc.id
      && other.alive
      && other.hostile
      && other.partyId !== npc.partyId
      && other.kind !== 'civilian'
    ));
    for (const threat of threats) {
      const threatDistance = Math.hypot(threat.position.x - npc.position.x, threat.position.y - npc.position.y);
      if (threatDistance <= 230 && (!nearestThreat || threatDistance < nearestThreat.distance)) {
        nearestThreat = { entity: threat, distance: threatDistance };
      }
    }
    if (nearestThreat) {
      const target = nearestThreat.entity;
      return { kind: 'npc', id: target.id, position: target.position, npc: target };
    }
    const owner = world.actors[npc.ownerActorId];
    if (owner?.alive) return { kind: 'escort', id: owner.id, position: owner.position, actor: owner };
    return null;
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
  if (npc.role === 'rusher' && target.kind === 'actor') {
    const direction = normalized(target.position.x - npc.position.x, target.position.y - npc.position.y);
    npc.chargeDirection = { x: direction.x, y: direction.y };
    npc.chargeTargetId = target.id;
    npc.chargeUntilTick = world.tick + 11;
    npc.state = 'charge';
    npc.nextAttackTick = world.tick + npc.attackCooldownTicks;
    world.effects.push({ id: `effect-charge-${npc.id}-${world.tick}`, kind: 'rusher-charge', position: { ...npc.position }, targetPosition: { ...target.position }, expiresAtTick: world.tick + 14 });
    return;
  }
  if (npc.attackKind === 'projectile') {
    spawnNpcProjectile(world, npc, target.position, target.kind === 'npc' ? 'npc' : null);
    if (npc.role === 'skirmisher') {
      npc.burstShotsRemaining = 1;
      npc.nextBurstTick = world.tick + 5;
      npc.burstTargetId = target.id;
    }
    return;
  }
  if (target.kind === 'npc') {
    if (npc.role === 'blocker') world.effects.push({ id: `effect-slam-${npc.id}-${world.tick}`, kind: 'blocker-slam', position: { ...npc.position }, expiresAtTick: world.tick + 18 });
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
  if (npc.role === 'blocker') world.effects.push({ id: `effect-slam-${npc.id}-${world.tick}`, kind: 'blocker-slam', position: { ...npc.position }, expiresAtTick: world.tick + 18 });
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
  if (npc.chargeUntilTick && world.tick < npc.chargeUntilTick) {
    const target = world.actors[npc.chargeTargetId];
    npc.state = 'charge';
    npc.velocity = { x: npc.chargeDirection.x * 175, y: npc.chargeDirection.y * 175 };
    npc.facing = { ...npc.chargeDirection };
    moveNpcWithCollision(world, npc, npc.velocity, deltaSeconds);
    if (target?.alive && Math.hypot(target.position.x - npc.position.x, target.position.y - npc.position.y) <= 24) {
      applyActorDamage(world, npc, target, {
        id: `npc-charge-${npc.id}-${world.tick}`, ownerActorId: null, ownerNpcId: npc.id,
        damage: npc.damage, channel: 'meleeDamage', velocity: { ...npc.velocity },
      });
      npc.chargeUntilTick = null;
      npc.state = 'recover';
    }
    return;
  }
  if (npc.chargeUntilTick && world.tick >= npc.chargeUntilTick) {
    npc.chargeUntilTick = null;
    npc.state = 'recover';
  }
  if (npc.burstShotsRemaining > 0 && world.tick >= (npc.nextBurstTick || 0)) {
    const target = world.actors[npc.burstTargetId] || world.npcs[npc.burstTargetId];
    if (target?.alive) {
      npc.nextAttackTick = world.tick;
      spawnNpcProjectile(world, npc, target.position, target.kind === 'player' ? null : 'npc');
    }
    npc.burstShotsRemaining -= 1;
    npc.nextAttackTick = Math.max(npc.nextAttackTick, world.tick + npc.attackCooldownTicks);
  }
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
  if (target.kind === 'escort' && directDistance <= 52) {
    npc.state = 'escort';
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
      npc.telegraph = null;
      npc.nextAttackTick = Math.max(npc.nextAttackTick, world.tick + npc.attackCooldownTicks);
    }
    return;
  }
  if (directDistance <= npc.attackRange && world.tick >= npc.nextAttackTick) {
    const windupTicks = Math.max(6, Number(npc.windupTicks) || 9);
    npc.pendingAttack = { targetId: target.id, targetKind: target.kind, executeAtTick: world.tick + windupTicks };
    npc.telegraph = {
      kind: npc.role === 'rusher' ? 'charge' : npc.role === 'blocker' ? 'slam' : npc.role === 'sapper' ? 'slow-orb' : 'burst',
      targetPosition: { ...target.position },
      startedAtTick: world.tick,
      executeAtTick: world.tick + windupTicks,
    };
    npc.state = 'windup';
    npc.velocity = { x: 0, y: 0 };
    return;
  }

  npc.state = 'engage';
  let direction = vector;
  if (npc.role === 'skirmisher' && directDistance >= 72 && directDistance <= 175) {
    const side = ((world.tick + npc.id.length) % 120) < 60 ? 1 : -1;
    direction = { x: -vector.y * side, y: vector.x * side };
  } else if (npc.attackKind === 'projectile' && directDistance < (npc.role === 'sapper' ? 125 : 72)) direction = { x: -vector.x, y: -vector.y };
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
  updateScheduledCivilian,
};
