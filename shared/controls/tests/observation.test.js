'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  buildScreenBoundedObservation,
  computePartyCamera,
} = require('../src/host/screen-observation');

function worldFixture() {
  const adapter = {
    id: 'actor-adapter', seatId: 'seat_2', slot: 2, displayName: 'Adapter', controller: 'adapter',
    partyId: 'party_a', alive: true, health: 100, position: { x: 120, y: 120 }, inputSequence: 8,
    token: 'must-never-leak', input: { moveX: 1 }, pendingPulses: { fire: true }, aiPath: ['hidden'],
  };
  const ally = {
    id: 'actor-ally', seatId: 'seat_1', displayName: 'Ally', controller: 'human', partyId: 'party_a',
    alive: true, health: 90, position: { x: 180, y: 120 },
  };
  const rival = {
    id: 'actor-rival', seatId: 'seat_5', displayName: 'Rival', controller: 'human', partyId: 'party_b',
    alive: true, health: 100, position: { x: 1800, y: 800 }, privateState: { plan: 'hidden' },
  };
  return { adapter, ally, rival, actors: { adapter, ally, rival } };
}

test('connected AI sees party HUD and only entities inside its shared camera', () => {
  const { adapter, rival, actors } = worldFixture();
  const observation = buildScreenBoundedObservation({
    sessionId: 'session-observation', roomCode: 'AXM1', tick: 44,
    seatActor: adapter, actors, vehicles: [],
    viewport: { width: 960, height: 540 },
    worldBounds: { left: 0, top: 0, right: 2000, bottom: 1000 },
    publicSelf: { objective: 'Visible objective', hostToken: 'not-visible' },
    publicHud: { mission: 'Find the marker', randomSeed: 12345 },
    collections: {
      npcs: { items: [{ id: 'npc-visible', kind: 'civilian', position: { x: 150, y: 160 }, aiPath: ['secret'] }] },
    },
    controllerProfile: '/profiles/top-down-twin-stick.json',
  });
  assert.equal(observation.scope, 'same-party-shared-screen-only');
  assert.equal(observation.partyHud.length, 2);
  assert.deepEqual(observation.visible.actors.map((actor) => actor.id).sort(), ['actor-adapter', 'actor-ally']);
  assert.equal(observation.controls.nextSequenceMinimum, 9);
  assert.equal(observation.visible.npcs[0].id, 'npc-visible');
  const serialized = JSON.stringify(observation);
  assert.doesNotMatch(serialized, new RegExp(rival.id));
  assert.doesNotMatch(serialized, /must-never-leak|hostToken|randomSeed|pendingPulses|aiPath|privateState/);
});

test('an opponent becomes visible only after entering the party camera', () => {
  const { adapter, rival, actors } = worldFixture();
  rival.position = { x: 210, y: 150 };
  const observation = buildScreenBoundedObservation({
    sessionId: 'session-observation', roomCode: 'AXM1', seatActor: adapter, actors,
    viewport: { width: 960, height: 540 }, worldBounds: { left: 0, top: 0, right: 2000, bottom: 1000 },
  });
  assert.ok(observation.visible.actors.some((actor) => actor.id === rival.id));
});

test('party camera treats co-riders as one vehicle focal point', () => {
  const { adapter, ally, actors } = worldFixture();
  adapter.currentVehicleId = 'vehicle-1';
  ally.currentVehicleId = 'vehicle-1';
  const camera = computePartyCamera({
    actors, partyId: 'party_a',
    vehicles: [{ id: 'vehicle-1', position: { x: 700, y: 400 } }],
    viewport: { width: 960, height: 540 },
    worldBounds: { left: 0, top: 0, right: 2000, bottom: 1000 },
  });
  assert.equal(camera.x, 700);
  assert.equal(camera.y, 400);
});

