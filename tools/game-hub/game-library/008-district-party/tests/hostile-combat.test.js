'use strict';

const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const { createWorldState } = require('../server/world-state');
const { startMission } = require('../server/mission-system');
const { updateNpcs } = require('../server/npc-system');
const { spawnProjectile, updateProjectiles } = require('../server/projectile-system');
const { createHostileNpc } = require('../server/npc-factory');

function makeWorld() {
  return createWorldState({
    projectRoot: path.join(__dirname, '..'),
    players: [{ actorId: 'actor-seat-1', seatId: 'seat_1', slot: 1, displayName: 'P1', controllerType: 'human', partyId: 'party_a' }],
  });
}

test('relay rusher uses a visible windup then deals only two damage', () => {
  const world = makeWorld();
  startMission(world, 'hold_relay');
  const rusher = Object.values(world.npcs).find((npc) => npc.source === 'mission' && npc.role === 'rusher');
  rusher.position = { x: world.mission.relay.position.x + 15, y: world.mission.relay.position.y };
  updateNpcs(world, 1 / 30);
  assert.equal(rusher.state, 'windup');
  assert.equal(world.mission.relay.health, 30);
  world.tick = rusher.pendingAttack.executeAtTick;
  updateNpcs(world, 1 / 30);
  assert.equal(world.mission.relay.health, 28);
});

test('low-number player pulse requires two hits for a rusher and four for a blocker', () => {
  const world = makeWorld();
  startMission(world, 'hold_relay');
  const actor = world.actors['actor-seat-1'];
  const rusher = Object.values(world.npcs).find((npc) => npc.source === 'mission' && npc.role === 'rusher');
  const blocker = createHostileNpc({ id: 'test-blocker', role: 'blocker', position: { ...actor.position }, source: 'mission' });
  world.npcs[blocker.id] = blocker;
  for (const [target, expectedShots] of [[rusher, 2], [blocker, 4]]) {
    target.position = { x: actor.position.x + 40, y: actor.position.y };
    actor.facing = { x: 1, y: 0 };
    let shots = 0;
    while (target.alive) {
      world.tick = actor.nextAttackTick;
      spawnProjectile(world, actor);
      updateProjectiles(world, 1 / 30);
      shots += 1;
      assert.ok(shots <= expectedShots);
    }
    assert.equal(shots, expectedShots);
  }
});
