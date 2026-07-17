'use strict';

const { clamp } = require('../shared/validation');
const { evaluateDamagePermission } = require('./damage-rules');
const { isInSafeZone } = require('./world-state');
const { dropActorPackage, isMissionInputLocked } = require('./mission-system');
const { consumeEquippedAmmo } = require('./inventory-system');
const { ejectAllOccupants, exitVehicle } = require('./vehicle-system');
const { recordCivilianHarm } = require('./justice-system');

const PULSE_INPUT_FIELDS = Object.freeze([
  'action', 'fire', 'inventoryToggle', 'inventoryPrev', 'inventoryNext', 'inventoryActivate',
]);

function clearActorPulseState(actor) {
  actor.pendingPulses = {};
  actor.fireQueuedUntilTick = null;
  if (actor.input) {
    for (const field of PULSE_INPUT_FIELDS) actor.input[field] = false;
  }
}

function spawnProjectile(world, attacker) {
  if (!attacker || !attacker.alive || attacker.inventoryOpen
    || isMissionInputLocked(world) || world.tick < attacker.nextAttackTick || !world.combatRules.enabled) return null;
  let ammoResult = null;
  const rangedItem = attacker.inventory?.equipment?.ranged;
  if (rangedItem) {
    ammoResult = consumeEquippedAmmo(attacker.inventory, 1);
    if (!ammoResult.ok) {
      attacker.nextAttackTick = world.tick + 10;
      world.effects.push({
        id: `effect-dry-${attacker.id}-${world.tick}`,
        kind: 'dry-fire',
        actorId: attacker.id,
        reason: ammoResult.reason,
        position: { ...attacker.position },
        expiresAtTick: world.tick + 8,
      });
      return null;
    }
  }
  const facingLength = Math.hypot(attacker.facing.x, attacker.facing.y) || 1;
  const direction = { x: attacker.facing.x / facingLength, y: attacker.facing.y / facingLength };
  const id = `projectile-${world.nextProjectileNumber++}`;
  const projectile = {
    id,
    kind: 'projectile',
    ownerActorId: attacker.id,
    ownerNpcId: null,
    partyId: attacker.partyId,
    position: {
      x: attacker.position.x + direction.x * 16,
      y: attacker.position.y + direction.y * 16,
    },
    velocity: { x: direction.x * 360, y: direction.y * 360 },
    radius: 4,
    damage: 5,
    channel: 'projectileDamage',
    spawnedAtTick: world.tick,
    expiresAtTick: world.tick + 42,
    rangedItemId: rangedItem?.id || null,
    ammoType: rangedItem?.ammoType || null,
    autoReloadedItemId: ammoResult?.autoEquippedItemId || null,
    sourceVehicleId: attacker.currentVehicleId || null,
  };
  world.projectiles[id] = projectile;
  attacker.nextAttackTick = world.tick + 10;
  world.effects.push({ id: `effect-muzzle-${id}`, kind: 'muzzle', position: { ...projectile.position }, expiresAtTick: world.tick + 4 });
  return projectile;
}

function spawnNpcProjectile(world, attacker, targetPosition, targetKind = null) {
  if (!attacker?.alive || !targetPosition || world.tick < attacker.nextAttackTick || !world.combatRules.enabled) return null;
  const dx = targetPosition.x - attacker.position.x;
  const dy = targetPosition.y - attacker.position.y;
  const length = Math.hypot(dx, dy) || 1;
  const direction = { x: dx / length, y: dy / length };
  const id = `projectile-${world.nextProjectileNumber++}`;
  const speed = Math.max(80, Number(attacker.projectileSpeed) || 155);
  const projectile = {
    id,
    kind: 'projectile',
    ownerActorId: null,
    ownerNpcId: attacker.id,
    ownerFaction: attacker.faction || null,
    partyId: attacker.partyId || null,
    hostile: !attacker.partyId,
    position: {
      x: attacker.position.x + direction.x * 14,
      y: attacker.position.y + direction.y * 14,
    },
    velocity: { x: direction.x * speed, y: direction.y * speed },
    radius: 4,
    damage: Math.max(1, Number(attacker.damage) || 2),
    channel: 'projectileDamage',
    spawnedAtTick: world.tick,
    expiresAtTick: world.tick + 75,
    sourceVehicleId: null,
    targetKind,
  };
  world.projectiles[id] = projectile;
  attacker.nextAttackTick = world.tick + Math.max(20, Number(attacker.attackCooldownTicks) || 38);
  world.effects.push({ id: `effect-muzzle-${id}`, kind: 'muzzle', hostile: true, position: { ...projectile.position }, expiresAtTick: world.tick + 4 });
  return projectile;
}

function applyAllyKnockback(world, target, projectile, multiplier) {
  const strength = Number(multiplier) || 0;
  if (strength <= 0 || target.currentVehicleId) return false;
  const length = Math.hypot(projectile.velocity.x, projectile.velocity.y) || 1;
  const distance = 16 * Math.min(1, strength);
  const candidate = {
    x: clamp(target.position.x + projectile.velocity.x / length * distance, target.radius, world.staticMap.width - target.radius),
    y: clamp(target.position.y + projectile.velocity.y / length * distance, target.radius, world.staticMap.height - target.radius),
  };
  const blocked = world.staticMap.obstacles.some((box) => (
    candidate.x + target.radius > box.x
    && candidate.x - target.radius < box.x + box.width
    && candidate.y + target.radius > box.y
    && candidate.y - target.radius < box.y + box.height
  ));
  if (blocked) return false;
  target.position = candidate;
  return true;
}

function applyActorDamage(world, attacker, target, projectile) {
  if (projectile.ownerNpcId && world.tick < (target.damageImmuneUntilTick || 0)) {
    world.effects.push({
      id: `effect-grace-${projectile.id}`,
      kind: 'grace-spark',
      reason: 'hit-grace',
      position: { ...target.position },
      expiresAtTick: world.tick + 6,
    });
    return { applied: false, reason: 'hit-grace' };
  }
  const safeZone = (attacker?.position && isInSafeZone(world, attacker.position)) || isInSafeZone(world, target.position);
  const permission = evaluateDamagePermission(attacker, target, {
    channel: projectile.channel,
    safeZone,
  }, world.combatRules);

  if (!permission.allowed) {
    const knockbackApplied = applyAllyKnockback(world, target, projectile, permission.knockbackMultiplier);
    world.effects.push({
      id: `effect-shield-${projectile.id}`,
      kind: 'shield-spark',
      reason: permission.reason,
      position: { ...target.position },
      partyId: target.partyId,
      knockbackApplied,
      expiresAtTick: world.tick + 8,
    });
    return { applied: false, reason: permission.reason };
  }

  const incomingDamage = Math.max(0, Number(projectile.damage) || 0);
  const currentShield = Math.max(0, Number(target.shield) || 0);
  const shieldDamage = Math.min(currentShield, incomingDamage);
  const healthDamage = incomingDamage - shieldDamage;
  target.shield = currentShield - shieldDamage;
  target.health = clamp(target.health - healthDamage, 0, target.maxHealth);
  if (projectile.ownerNpcId) target.damageImmuneUntilTick = world.tick + 11;
  world.effects.push({
    id: `effect-hit-${projectile.id}`,
    kind: 'approved-hit',
    damage: incomingDamage,
    shieldDamage,
    healthDamage,
    position: { ...target.position },
    partyId: target.partyId,
    expiresAtTick: world.tick + 8,
  });
  if (target.health <= 0) downActor(world, target, attacker);
  return { applied: true, damage: incomingDamage, shieldDamage, healthDamage };
}

function downActor(world, target, attacker = null) {
  if (!target.alive) return false;
  target.health = 0;
  target.alive = false;
  target.state = 'respawning';
  target.respawnAtTick = world.tick + (world.mission?.status === 'active' ? 150 : 90);
  target.velocity = { x: 0, y: 0 };
  target.inventoryOpen = false;
  clearActorPulseState(target);
  dropActorPackage(world, target);
  if (target.currentVehicleId) exitVehicle(world, target.id, 'actor-downed');
  world.effects.push({
    id: `effect-down-${target.id}-${world.tick}`,
    kind: 'actor-downed',
    actorId: target.id,
    attackerActorId: attacker?.id || null,
    position: { ...target.position },
    expiresAtTick: world.tick + 30,
  });
  return true;
}

function respawnActor(world, actor) {
  actor.position = { ...(world.mission?.status === 'active' && actor.missionSpawnPosition
    ? actor.missionSpawnPosition
    : actor.spawnPosition) };
  actor.velocity = { x: 0, y: 0 };
  actor.health = actor.maxHealth;
  actor.shield = Math.max(0, Number(actor.maxShield) || 0);
  actor.alive = true;
  actor.state = 'alive';
  actor.respawnAtTick = null;
  actor.inventoryOpen = false;
  clearActorPulseState(actor);
  actor.tether = { level: 'ok', distance: 0, returnToParty: false, movementBlocked: false };
  world.effects.push({
    id: `effect-respawn-${actor.id}-${world.tick}`,
    kind: 'respawn',
    actorId: actor.id,
    position: { ...actor.position },
    expiresAtTick: world.tick + 20,
  });
}

function applyNpcDamage(world, attacker, target, projectile) {
  if (!target.alive) return { applied: false, reason: 'target-downed' };
  const permission = evaluateDamagePermission(attacker, target, {
    channel: projectile.channel,
    safeZone: isInSafeZone(world, attacker.position) || isInSafeZone(world, target.position),
  }, world.combatRules);
  if (!permission.allowed) return { applied: false, reason: permission.reason };
  target.health = clamp(target.health - projectile.damage, 0, target.maxHealth);
  const downed = target.health <= 0;
  if (target.kind === 'civilian') recordCivilianHarm(world, target, projectile.damage, downed);
  target.state = target.hostile ? 'engage' : 'flee';
  target.stateUntilTick = world.tick + 90;
  if (downed) {
    target.health = 0;
    target.alive = false;
    target.state = 'downed';
    target.downedAtTick = world.tick;
    target.respawnAtTick = target.kind === 'civilian'
      ? world.tick + 450
      : target.source === 'city' ? world.tick + 900 : null;
  }
  world.effects.push({
    id: `effect-npc-hit-${projectile.id}`,
    kind: downed ? 'npc-downed' : 'approved-hit',
    damage: projectile.damage,
    position: { ...target.position },
    expiresAtTick: world.tick + 8,
  });
  return { applied: true, damage: projectile.damage };
}

function destroyVehicle(world, vehicle, projectile) {
  if (!vehicle || vehicle.destroyed) return false;
  const occupantIds = [vehicle.driverActorId, ...vehicle.passengerActorIds].filter(Boolean);
  vehicle.health = 0;
  vehicle.destroyed = true;
  vehicle.destroyedAtTick = world.tick;
  vehicle.respawnAtTick = world.tick + 900;
  vehicle.speed = 0;
  vehicle.velocity = { x: 0, y: 0 };
  ejectAllOccupants(world, vehicle, 'vehicle-explosion');
  for (const actorId of occupantIds) {
    const target = world.actors[actorId];
    if (!target?.alive) continue;
    applyActorDamage(world, null, target, {
      id: `vehicle-explosion-${vehicle.id}-${actorId}-${world.tick}`,
      damage: 80,
      channel: 'environmentDamage',
      environment: true,
      ownerActorId: null,
      ownerNpcId: null,
      velocity: { x: 0, y: 0 },
    });
  }
  world.effects.push({
    id: `effect-vehicle-explosion-${vehicle.id}-${world.tick}`,
    kind: 'vehicle-explosion',
    vehicleId: vehicle.id,
    sourceProjectileId: projectile?.id || null,
    position: { ...vehicle.position },
    expiresAtTick: world.tick + 45,
  });
  return true;
}

function applyVehicleDamage(world, attacker, vehicle, projectile) {
  if (!vehicle || vehicle.destroyed || vehicle.health <= 0) return { applied: false, reason: 'vehicle-destroyed' };
  if (projectile.sourceVehicleId === vehicle.id) return { applied: false, reason: 'source-vehicle' };
  if (isInSafeZone(world, vehicle.position) || (attacker?.position && isInSafeZone(world, attacker.position))) {
    return { applied: false, reason: 'safe-zone' };
  }
  if (attacker?.partyId && vehicle.partyOwnerId === attacker.partyId) {
    world.effects.push({ id: `effect-vehicle-shield-${projectile.id}`, kind: 'shield-spark', reason: 'ally-vehicle', position: { ...vehicle.position }, expiresAtTick: world.tick + 8 });
    return { applied: false, reason: 'ally-vehicle' };
  }
  if (!world.combatRules.enabled) return { applied: false, reason: 'combat-disabled' };
  const damage = Math.max(0, Number(projectile.damage) || 0);
  vehicle.health = clamp(vehicle.health - damage, 0, vehicle.maxHealth);
  world.effects.push({ id: `effect-vehicle-hit-${projectile.id}`, kind: 'vehicle-hit', damage, position: { ...vehicle.position }, expiresAtTick: world.tick + 8 });
  if (vehicle.health <= 0) destroyVehicle(world, vehicle, projectile);
  return { applied: true, damage, destroyed: vehicle.destroyed };
}

function circleHit(a, b, extraRadius = 0) {
  return Math.hypot(a.position.x - b.position.x, a.position.y - b.position.y)
    <= (a.radius + b.radius + extraRadius);
}

function projectileHitsObstacle(world, projectile) {
  return world.staticMap.obstacles.some((box) => (
    projectile.position.x >= box.x
    && projectile.position.x <= box.x + box.width
    && projectile.position.y >= box.y
    && projectile.position.y <= box.y + box.height
  ));
}

function updateProjectiles(world, deltaSeconds) {
  for (const projectile of Object.values(world.projectiles)) {
    projectile.position.x += projectile.velocity.x * deltaSeconds;
    projectile.position.y += projectile.velocity.y * deltaSeconds;
    const expired = world.tick >= projectile.expiresAtTick
      || projectile.position.x < 0
      || projectile.position.x > world.staticMap.width
      || projectile.position.y < 0
      || projectile.position.y > world.staticMap.height
      || projectileHitsObstacle(world, projectile);
    if (expired) {
      delete world.projectiles[projectile.id];
      continue;
    }

    const attacker = world.actors[projectile.ownerActorId] || world.npcs[projectile.ownerNpcId] || null;
    let consumed = false;
    for (const vehicle of Object.values(world.vehicles)) {
      if (vehicle.id === projectile.sourceVehicleId || vehicle.destroyed || !circleHit(projectile, vehicle, 2)) continue;
      applyVehicleDamage(world, attacker, vehicle, projectile);
      consumed = true;
      break;
    }
    for (const target of Object.values(world.actors)) {
      if (consumed) break;
      if (!target.alive || target.id === projectile.ownerActorId
        || (projectile.sourceVehicleId && target.currentVehicleId === projectile.sourceVehicleId)
        || !circleHit(projectile, target)) continue;
      applyActorDamage(world, attacker, target, projectile);
      consumed = true;
      break;
    }
    if (!consumed && (projectile.ownerActorId || (projectile.ownerNpcId && attacker?.partyId))) {
      for (const target of Object.values(world.npcs)) {
        if (!target.alive || target.id === projectile.ownerNpcId || !circleHit(projectile, target)) continue;
        applyNpcDamage(world, attacker, target, projectile);
        consumed = true;
        break;
      }
    }
    if (!consumed && projectile.targetKind === 'relay' && world.mission?.relay
      && circleHit(projectile, { position: world.mission.relay.position, radius: 14 })) {
      world.mission.relay.health = clamp(
        world.mission.relay.health - projectile.damage,
        0,
        world.mission.relay.maxHealth,
      );
      world.effects.push({ id: `effect-relay-hit-${projectile.id}`, kind: 'relay-hit', damage: projectile.damage, position: { ...world.mission.relay.position }, expiresAtTick: world.tick + 10 });
      consumed = true;
    }
    if (consumed) delete world.projectiles[projectile.id];
  }
  world.effects = world.effects.filter((effect) => effect.expiresAtTick > world.tick).slice(-64);
}

module.exports = {
  applyAllyKnockback,
  applyActorDamage,
  applyNpcDamage,
  applyVehicleDamage,
  destroyVehicle,
  downActor,
  respawnActor,
  spawnNpcProjectile,
  spawnProjectile,
  updateProjectiles,
};
