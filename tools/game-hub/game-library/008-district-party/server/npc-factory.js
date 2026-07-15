'use strict';

const HOSTILE_ROLES = Object.freeze({
  rusher: Object.freeze({ maxHealth: 10, damage: 2, speed: 58, attackRange: 22, cooldownTicks: 30, attackKind: 'melee' }),
  skirmisher: Object.freeze({ maxHealth: 10, damage: 2, speed: 44, attackRange: 175, cooldownTicks: 38, attackKind: 'projectile', projectileSpeed: 155 }),
  blocker: Object.freeze({ maxHealth: 20, damage: 3, speed: 34, attackRange: 25, cooldownTicks: 45, attackKind: 'melee' }),
});

function createHostileNpc({ id, faction = 'neon-rivals', role = 'rusher', position, source = 'city', kind = 'rival' }) {
  const stats = HOSTILE_ROLES[role] || HOSTILE_ROLES.rusher;
  return {
    id,
    kind,
    controller: 'ai',
    faction,
    role,
    source,
    hostile: true,
    partyId: null,
    state: 'guard',
    position: { x: position.x, y: position.y },
    spawnPosition: { x: position.x, y: position.y },
    velocity: { x: 0, y: 0 },
    facing: { x: 0, y: 1 },
    radius: role === 'blocker' ? 10 : 8,
    health: stats.maxHealth,
    maxHealth: stats.maxHealth,
    damage: stats.damage,
    moveSpeed: stats.speed,
    attackRange: stats.attackRange,
    attackKind: stats.attackKind,
    projectileSpeed: stats.projectileSpeed || 0,
    attackCooldownTicks: stats.cooldownTicks,
    nextAttackTick: 0,
    alive: true,
    damageImmuneUntilTick: 0,
    stateUntilTick: 0,
    downedAtTick: null,
    respawnAtTick: null,
  };
}

module.exports = { HOSTILE_ROLES, createHostileNpc };
