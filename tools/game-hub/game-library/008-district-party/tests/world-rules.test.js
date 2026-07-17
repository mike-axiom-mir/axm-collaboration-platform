'use strict';

const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const { createWorldState } = require('../server/world-state');
const { moveActor } = require('../server/player-system');
const { moveNpcWithCollision, npcCollidesObstacle } = require('../server/npc-system');

function makeWorld() {
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

test('hard party range transparently blocks only further outward movement', () => {
  const world = makeWorld();
  const anchor = world.actors['actor-seat-1'];
  const separated = world.actors['actor-seat-2'];
  anchor.position = { x: 100, y: 500 };
  separated.position = { x: 700, y: 500 };
  separated.input = { moveX: 1, moveY: 0, sprint: false };
  moveActor(world, separated, 1 / 30);
  assert.equal(separated.position.x, 700);
  assert.equal(separated.tether.level, 'hard');
  assert.equal(separated.tether.returnToParty, true);
  assert.equal(separated.tether.movementBlocked, true);

  separated.input.moveX = -1;
  moveActor(world, separated, 1 / 30);
  assert.ok(separated.position.x < 700, 'movement back toward party remains possible');
});

test('civilian movement performs host-side obstacle collision rollback', () => {
  const world = makeWorld();
  const npc = Object.values(world.npcs)[0];
  const obstacle = world.staticMap.obstacles.find((entry) => entry.width > 50 && entry.height > 50);
  npc.position = { x: obstacle.x - npc.radius - 1, y: obstacle.y + obstacle.height / 2 };
  assert.equal(npcCollidesObstacle(world, npc.position, npc.radius), false);
  moveNpcWithCollision(world, npc, { x: 200, y: 0 }, 1 / 30);
  assert.equal(npcCollidesObstacle(world, npc.position, npc.radius), false);
  assert.ok(npc.position.x <= obstacle.x - npc.radius, 'NPC did not enter the building collision rectangle');
});
