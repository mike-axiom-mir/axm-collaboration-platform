'use strict';

const HOSTILE_ROLES = Object.freeze({
  rusher: Object.freeze({ label: 'CHARGER', colour: '#ff6f62', maxHealth: 10, damage: 2, speed: 58, attackRange: 32, cooldownTicks: 36, windupTicks: 14, attackKind: 'melee' }),
  skirmisher: Object.freeze({ label: 'STRAFER', colour: '#ffb05f', maxHealth: 10, damage: 2, speed: 46, attackRange: 185, cooldownTicks: 42, windupTicks: 8, attackKind: 'projectile', projectileSpeed: 175 }),
  blocker: Object.freeze({ label: 'SHIELD', colour: '#ff668f', maxHealth: 20, damage: 3, speed: 34, attackRange: 42, cooldownTicks: 52, windupTicks: 18, attackKind: 'melee' }),
  sapper: Object.freeze({ label: 'SAPPER', colour: '#a58cff', maxHealth: 14, damage: 2, speed: 39, attackRange: 210, cooldownTicks: 55, windupTicks: 20, attackKind: 'projectile', projectileSpeed: 120 }),
});

function createHostileNpc({ id, faction = 'neon-rivals', role = 'rusher', position, source = 'city', kind = 'rival' }) {
  const stats = HOSTILE_ROLES[role] || HOSTILE_ROLES.rusher;
  return {
    id,
    kind,
    controller: 'ai',
    faction,
    role,
    roleLabel: stats.label,
    roleColour: stats.colour,
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
    windupTicks: stats.windupTicks,
    nextAttackTick: 0,
    alive: true,
    damageImmuneUntilTick: 0,
    stateUntilTick: 0,
    downedAtTick: null,
    respawnAtTick: null,
    telegraph: null,
    chargeUntilTick: null,
    burstShotsRemaining: 0,
    lootDropped: false,
  };
}

module.exports = { HOSTILE_ROLES, createHostileNpc };
