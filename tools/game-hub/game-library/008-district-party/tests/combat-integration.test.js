'use strict';

const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const { createWorldState } = require('../server/world-state');
const { spawnProjectile, updateProjectiles } = require('../server/projectile-system');

function worldWithTwoAllies() {
  return createWorldState({
    projectRoot: path.join(__dirname, '..'),
    players: [1, 2].map((slot) => ({
      actorId: `actor-seat-${slot}`,
      seatId: `seat_${slot}`,
      slot,
      displayName: `P${slot}`,
      controllerType: 'human',
      adapterId: null,
      partyId: 'party_a',
    })),
  });
}

test('host projectile collision shows shield spark with FF off and applies damage with FF on', () => {
  const world = worldWithTwoAllies();
  world.staticMap.obstacles = [];
  world.staticMap.safeZones = [];
  const attacker = world.actors['actor-seat-1'];
  const target = world.actors['actor-seat-2'];
  attacker.position = { x: 400, y: 500 };
  target.position = { x: 440, y: 500 };
  attacker.facing = { x: 1, y: 0 };
  const targetStartX = target.position.x;
  spawnProjectile(world, attacker);
  updateProjectiles(world, 1 / 30);
  assert.equal(target.health, 100);
  assert.ok(target.position.x > targetStartX, 'blocked ally shot applies low host-owned knockback');
  assert.ok(world.effects.some((effect) => effect.kind === 'shield-spark'));

  target.position = { x: 440, y: 500 };
  world.tick = attacker.nextAttackTick;
  world.combatRules.partyFriendlyFire.party_a = true;
  spawnProjectile(world, attacker);
  updateProjectiles(world, 1 / 30);
  assert.equal(target.shield, 0, 'the starting shield absorbs the first point of approved damage');
  assert.equal(target.health, 96);
  assert.ok(world.effects.some((effect) => (
    effect.kind === 'approved-hit' && effect.damage === 5
    && effect.shieldDamage === 1 && effect.healthDamage === 4
  )));
});
