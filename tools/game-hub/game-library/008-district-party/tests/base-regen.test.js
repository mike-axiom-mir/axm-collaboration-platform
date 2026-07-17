'use strict';

const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  findActorBaseZone,
  initializeActorVitals,
  updateBaseRegeneration,
} = require('../server/base-system');
const { createWorldState } = require('../server/world-state');

const PROJECT_ROOT = path.join(__dirname, '..');

function makeWorld(actorOverrides = {}) {
  return {
    staticMap: {
      baseZones: [{
        id: 'party-base-interior',
        x: 100,
        y: 100,
        width: 200,
        height: 140,
        healthRegenPerSecond: 10,
        shieldRegenPerSecond: 0,
      }],
    },
    actors: {
      'actor-seat-1': {
        id: 'actor-seat-1',
        alive: true,
        state: 'alive',
        position: { x: 50, y: 50 },
        ...actorOverrides,
      },
    },
  };
}

function advance(world, seconds, ticks) {
  for (let index = 0; index < ticks; index += 1) {
    updateBaseRegeneration(world, seconds / ticks);
  }
}

test('new actor vitals start at 100 base HP and one non-regenerating shield', () => {
  const actor = initializeActorVitals({ id: 'actor-seat-1' });
  assert.equal(actor.baseHealth, 100);
  assert.equal(actor.health, 100);
  assert.equal(actor.maxHealth, 100);
  assert.equal(actor.defaultHealthRegenCap, 100);
  assert.equal(actor.shield, 1);
  assert.equal(actor.maxShield, 1);
  assert.equal(actor.regeneration.shieldPerSecond, 0);
});

test('outside-base regeneration restores exactly 1 HP per second across fractional ticks', () => {
  const world = makeWorld({ health: 50, maxHealth: 100, shield: 0, maxShield: 1 });
  advance(world, 1, 30);
  assert.equal(world.actors['actor-seat-1'].health, 51);
  assert.equal(world.actors['actor-seat-1'].shield, 0, 'shield did not regenerate');
  assert.equal(world.actors['actor-seat-1'].regeneration.insideBase, false);
  assert.equal(world.actors['actor-seat-1'].regeneration.healthPerSecond, 1);
});

test('inside-base regeneration restores exactly 10 HP per second', () => {
  const world = makeWorld({
    health: 50,
    maxHealth: 100,
    shield: 0,
    maxShield: 1,
    position: { x: 180, y: 160 },
  });
  advance(world, 1, 30);
  const actor = world.actors['actor-seat-1'];
  assert.equal(actor.health, 60);
  assert.equal(actor.shield, 0);
  assert.equal(actor.regeneration.insideBase, true);
  assert.equal(actor.regeneration.baseZoneId, 'party-base-interior');
  assert.equal(findActorBaseZone(world, actor).id, 'party-base-interior');
});

test('default regeneration never crosses 100 HP even when equipment later raises maxHealth', () => {
  const world = makeWorld({
    health: 99,
    maxHealth: 175,
    position: { x: 180, y: 160 },
  });
  advance(world, 2, 60);
  const actor = world.actors['actor-seat-1'];
  assert.equal(actor.health, 100);
  assert.equal(actor.maxHealth, 175);

  actor.health = 125;
  advance(world, 2, 60);
  assert.equal(actor.health, 125, 'regen does not reduce or increase above-cap equipment health');
});

test('dead, downed and respawning actors do not regenerate', () => {
  for (const state of ['downed', 'respawning']) {
    const world = makeWorld({ health: 20, state, position: { x: 180, y: 160 } });
    updateBaseRegeneration(world, 1);
    assert.equal(world.actors['actor-seat-1'].health, 20);
  }
  const deadWorld = makeWorld({ health: 0, alive: false, position: { x: 180, y: 160 } });
  updateBaseRegeneration(deadWorld, 1);
  assert.equal(deadWorld.actors['actor-seat-1'].health, 0);
});

test('map contains a walkable Party A house, usable south door, and four interior spawns', () => {
  const map = JSON.parse(fs.readFileSync(path.join(PROJECT_ROOT, 'data', 'map.json'), 'utf8'));
  const base = map.layers.base_zones.find((zone) => zone.id === 'party-base-interior');
  const house = map.layers.buildings.find((building) => building.id === 'party-base-house');
  assert.ok(base);
  assert.equal(base.healthRegenPerSecond, 10);
  assert.equal(base.defaultHealthRegenCap, 100);
  assert.equal(base.shieldRegenPerSecond, 0);
  assert.equal(house.walkable, true);
  assert.equal(house.entrance.side, 'south');

  const partyASpawns = map.layers.player_spawns.filter((spawn) => spawn.slot >= 1 && spawn.slot <= 4);
  assert.equal(partyASpawns.length, 4);
  for (const spawn of partyASpawns) {
    assert.ok(spawn.x >= base.x && spawn.x <= base.x + base.w);
    assert.ok(spawn.y >= base.y && spawn.y <= base.y + base.h);
  }

  const doorSideWalls = map.layers.collision.filter((wall) => wall.id.startsWith('party-base-wall-south-'));
  assert.equal(doorSideWalls.length, 2);
  const doorCentreX = house.entrance.x + house.entrance.w / 2;
  assert.equal(doorSideWalls.some((wall) => doorCentreX >= wall.x && doorCentreX <= wall.x + wall.w), false);
  assert.equal(map.layers.collision.some((entry) => entry.id === 'apartments-building'), false);
});

test('real world creation places Party A inside the mapped 10 HP/s base and uses 1 HP/s after leaving', () => {
  const world = createWorldState({
    projectRoot: PROJECT_ROOT,
    players: [{
      actorId: 'actor-seat-1', seatId: 'seat_1', slot: 1, displayName: 'Player 1',
      controllerType: 'human', adapterId: null, partyId: 'party_a',
    }],
  });
  const actor = world.actors['actor-seat-1'];
  actor.health = 50;
  updateBaseRegeneration(world, 1);
  assert.equal(actor.health, 60);
  assert.equal(actor.regeneration.insideBase, true);

  actor.position = { x: 512, y: 512 };
  actor.health = 50;
  updateBaseRegeneration(world, 1);
  assert.equal(actor.health, 51);
  assert.equal(actor.regeneration.insideBase, false);
});
