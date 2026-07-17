'use strict';

const { spawnProjectile, updateProjectiles } = require('./projectile-system');

function processCombatIntent(world, actor) {
  if (!actor.alive) return null;
  if (actor.input.fire) {
    actor.fireQueuedUntilTick = world.tick + 4;
    actor.input.fire = false;
    if (actor.pendingPulses) actor.pendingPulses.fire = false;
  }
  if (actor.input.attack) {
    const projectile = spawnProjectile(world, actor);
    if (projectile) actor.fireQueuedUntilTick = null;
    return projectile;
  }
  if (actor.fireQueuedUntilTick === null || actor.fireQueuedUntilTick === undefined) return null;
  if (world.tick > actor.fireQueuedUntilTick) {
    actor.fireQueuedUntilTick = null;
    return null;
  }
  if (world.tick < actor.nextAttackTick) return null;
  const projectile = spawnProjectile(world, actor);
  actor.fireQueuedUntilTick = null;
  return projectile;
}

function updateCombat(world, deltaSeconds) {
  for (const actor of Object.values(world.actors)) processCombatIntent(world, actor);
  updateProjectiles(world, deltaSeconds);
}

module.exports = { processCombatIntent, updateCombat };
