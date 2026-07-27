'use strict';

const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const { serializeStaticWorld, serializeWorldState } = require('../server/display-state');
const { findActorBaseZone } = require('../server/base-system');
const { processActorAction } = require('../server/player-system');
const { applyNpcDamage } = require('../server/projectile-system');
const { SessionManager } = require('../server/session-manager');
const {
  completeTerritoryMatch,
  purchaseReinforcement,
  updateTerritory,
  updateZoneCapture,
} = require('../server/territory-system');
const { advanceWorld } = require('../server/world-loop');

const projectRoot = path.join(__dirname, '..');

function selectedPlayers(controllerType = 'human') {
  return Array.from({ length: 8 }, (_, index) => ({
    slot: index + 1,
    displayName: `District P${index + 1}`,
    controllerType,
  }));
}

function territorySession(controllerType = 'human') {
  const manager = new SessionManager({ projectRoot });
  const launch = manager.createSession({
    players: selectedPlayers(controllerType),
    settings: { mode: 'district_dominion' },
  });
  return { manager, launch, session: manager.getSession(launch.sessionId), world: manager.getSession(launch.sessionId).world };
}

function parkActorsAtCommands(world) {
  for (const actor of Object.values(world.actors)) {
    const post = world.territory.commandPosts[actor.partyId];
    actor.position = { x: post.x, y: post.y };
  }
}

test('District Dominion initializes one authoritative eight-actor world with mirrored party staging', () => {
  const { session, world } = territorySession();
  assert.equal(world.mode, 'district_dominion');
  assert.equal(world.territory.enabled, true);
  assert.equal(world.territory.status, 'active');
  assert.equal(Object.keys(world.actors).length, 8);
  assert.deepEqual(Object.values(world.actors).map((actor) => actor.partyId), [
    'party_a', 'party_a', 'party_a', 'party_a',
    'party_b', 'party_b', 'party_b', 'party_b',
  ]);
  const spawnA = world.staticMap.territory.playerSpawns.find((spawn) => spawn.slot === 1);
  const spawnB = world.staticMap.territory.playerSpawns.find((spawn) => spawn.slot === 5);
  assert.deepEqual(world.actors['actor-seat-1'].position, { x: spawnA.x, y: spawnA.y });
  assert.deepEqual(world.actors['actor-seat-5'].position, { x: spawnB.x, y: spawnB.y });
  assert.equal(world.territory.zones.length, 8);
  assert.deepEqual(world.economy.partyFunds, { party_a: 5000, party_b: 5000 });
  assert.equal(Object.keys(world.vehicles).length, 6);
  assert.equal(Object.values(world.npcs).filter((npc) => npc.source === 'city').length, 0);
  assert.equal(serializeStaticWorld(session).activePlayerTarget, 8);
});

test('District Dominion keeps a default 1v1 roster sparse instead of creating substitute actors', () => {
  const manager = new SessionManager({ projectRoot });
  const launch = manager.createSession({
    players: [
      { slot: 1, controllerType: 'human', displayName: 'A One' },
      { slot: 5, controllerType: 'human', displayName: 'B One' },
    ],
    settings: { mode: 'district_dominion' },
  });
  const session = manager.getSession(launch.sessionId);
  assert.deepEqual(Object.values(session.world.actors).map((actor) => actor.slot), [1, 5]);
  assert.equal(Object.values(session.world.actors).filter((actor) => actor.controller === 'ai').length, 0);
  assert.equal(serializeStaticWorld(session).activePlayerTarget, 2);
});

test('District Dominion accepts asymmetric ready rosters and ignores records that are not ready', () => {
  const manager = new SessionManager({ projectRoot });
  const launch = manager.createSession({
    players: [
      { slot: 1, controllerType: 'human', ready: true },
      { slot: 2, controllerType: 'adapter', ready: true, adapterId: 'ai-a2' },
      { slot: 3, controllerType: 'ai', ready: false },
      { slot: 5, controllerType: 'human', ready: true },
      { slot: 6, controllerType: 'ai', ready: true },
      { slot: 7, controllerType: 'adapter', ready: true, adapterId: 'ai-b7' },
      { slot: 8, controllerType: 'ai', ready: false },
    ],
    settings: { mode: 'district_dominion' },
  });
  const actors = Object.values(manager.getSession(launch.sessionId).world.actors);
  assert.deepEqual(actors.map((actor) => actor.slot), [1, 2, 5, 6, 7]);
  assert.equal(actors.filter((actor) => actor.partyId === 'party_a').length, 2);
  assert.equal(actors.filter((actor) => actor.partyId === 'party_b').length, 3);
  assert.equal(launch.controllerLinks.length, 2);
  assert.equal(launch.adapterBindings.length, 2);
});

test('District Dominion rejects a one-sided roster unless optional Host AI fill is explicitly enabled', () => {
  const manager = new SessionManager({ projectRoot });
  assert.throws(() => manager.createSession({
    players: [{ slot: 1, controllerType: 'human' }],
    settings: { mode: 'district_dominion' },
  }), (error) => error.code === 'INVALID_PARTY_ROSTER');

  const filled = manager.createSession({
    players: [{ slot: 1, controllerType: 'human' }],
    settings: { mode: 'district_dominion', hostAiFillEmptySeats: true },
  });
  const actors = Object.values(manager.getSession(filled.sessionId).world.actors);
  assert.equal(actors.length, 8);
  assert.equal(actors.filter((actor) => actor.controller === 'ai').length, 7);
  assert.equal(actors.find((actor) => actor.slot === 1).controller, 'human');
});

test('capture progress is host-owned, contested presence pauses it, and an owner is not erased by one tick', () => {
  const { world } = territorySession();
  parkActorsAtCommands(world);
  const central = world.territory.zones.find((zone) => zone.id === 'city-market');
  const east = world.territory.zones.find((zone) => zone.id === 'east-terraces');
  const actorA = world.actors['actor-seat-1'];
  const actorB = world.actors['actor-seat-5'];

  actorA.position = { x: central.x, y: central.y };
  actorB.position = { x: central.x, y: central.y };
  updateZoneCapture(world, central, 1);
  assert.equal(central.progress, 0);
  assert.equal(central.contested, true);

  actorB.position = { ...world.territory.commandPosts.party_b };
  for (let index = 0; index < 210; index += 1) updateZoneCapture(world, central, 1 / 30);
  assert.equal(central.progress, 100);
  assert.equal(central.ownerPartyId, 'party_a');

  actorA.position = { ...world.territory.commandPosts.party_a };
  actorB.position = { x: east.x, y: east.y };
  updateZoneCapture(world, east, 1);
  assert.ok(east.progress < 100 && east.progress > 0);
  assert.equal(east.ownerPartyId, 'party_a');
});

test('held districts score once per host interval and score goal enters a persistent result state', () => {
  const { world } = territorySession();
  parkActorsAtCommands(world);
  for (const zone of world.territory.zones) {
    zone.ownerPartyId = 'party_a';
    zone.progress = 100;
  }
  world.territory.scores.party_a = world.territory.scoreGoal - 1;
  world.mission.partyScores.party_a = world.territory.scoreGoal - 1;
  updateTerritory(world, 1.01);
  assert.equal(world.territory.status, 'results');
  assert.equal(world.mission.status, 'results');
  assert.equal(world.territory.result.winnerPartyId, 'party_a');
  assert.equal(world.territory.result.reason, 'score-goal');
  const frozen = { ...world.territory.scores };
  updateTerritory(world, 20);
  assert.deepEqual(world.territory.scores, frozen, 'result screen does not keep scoring in the background');
  const actor = world.actors['actor-seat-1'];
  actor.input.action = true;
  assert.equal(processActorAction(world, actor).reason, 'territory-results-active');
});

test('ACTION at a party command post spends only that group fund and respects cooldown and crew cap', () => {
  const { world } = territorySession();
  const actor = world.actors['actor-seat-1'];
  actor.position = { ...world.territory.commandPosts.party_a };
  actor.input.action = true;
  const first = processActorAction(world, actor);
  assert.equal(first.ok, true);
  assert.equal(first.kind, 'territory-reinforcement');
  assert.equal(first.squadSize, 2);
  assert.equal(world.economy.partyFunds.party_a, 2500);
  assert.equal(world.economy.partyFunds.party_b, 5000);
  assert.equal(Object.values(world.npcs).filter((npc) => npc.kind === 'crew' && npc.partyId === 'party_a').length, 2);

  assert.equal(purchaseReinforcement(world, actor).reason, 'reinforcement-cooldown');
  world.tick = world.territory.reinforcement.purchaseCooldownTicks;
  assert.equal(purchaseReinforcement(world, actor).ok, true);
  assert.equal(world.economy.partyFunds.party_a, 0);
  world.tick += world.territory.reinforcement.purchaseCooldownTicks;
  assert.equal(purchaseReinforcement(world, actor).reason, 'reinforcement-cap');
});

test('paid crew shares central party damage rules and can fight the opposing crew without harming allies', () => {
  const { world } = territorySession();
  const actorA = world.actors['actor-seat-1'];
  const actorB = world.actors['actor-seat-5'];
  actorA.position = { ...world.territory.commandPosts.party_a };
  actorB.position = { ...world.territory.commandPosts.party_b };
  const squadA = purchaseReinforcement(world, actorA);
  const squadB = purchaseReinforcement(world, actorB);
  const ally = world.npcs[squadA.spawnedNpcIds[1]];
  const attacker = world.npcs[squadA.spawnedNpcIds[0]];
  const enemy = world.npcs[squadB.spawnedNpcIds[0]];
  attacker.position = { x: 500, y: 500 };
  ally.position = { x: 510, y: 500 };
  enemy.position = { x: 520, y: 500 };
  const event = { id: 'crew-test', damage: 2, channel: 'projectileDamage' };
  assert.equal(applyNpcDamage(world, attacker, ally, event).reason, 'same-party-blocked');
  const before = enemy.health;
  assert.equal(applyNpcDamage(world, attacker, enemy, { ...event, id: 'crew-enemy-test' }).applied, true);
  assert.equal(enemy.health, before - 2);
});

test('host AI fills all eight seats, hires bounded squads, captures districts, and advances a playable match', () => {
  const { world } = territorySession('ai');
  for (let index = 0; index < 900 && world.territory.status === 'active'; index += 1) {
    advanceWorld(world, { now: Date.now() + index * 34 });
  }
  assert.equal(Object.keys(world.actors).length, 8);
  assert.equal(world.territory.reinforcementsPurchased.party_a, 1);
  assert.equal(world.territory.reinforcementsPurchased.party_b, 1);
  assert.ok(world.territory.scores.party_a + world.territory.scores.party_b > 0);
  assert.ok(world.territory.zones.some((zone) => Math.abs(zone.progress) > 0));
  assert.ok(Object.values(world.actors).every((actor) => Number.isFinite(actor.position.x) && Number.isFinite(actor.position.y)));
});

test('optional Host AI can simulate sparse 1v1 and asymmetric 2v3 without filling unused seats', () => {
  for (const slots of [[1, 5], [1, 2, 5, 6, 7]]) {
    const manager = new SessionManager({ projectRoot });
    const launch = manager.createSession({
      players: slots.map((slot) => ({ slot, controllerType: 'ai', displayName: `Optional AI ${slot}` })),
      settings: { mode: 'district_dominion' },
    });
    const world = manager.getSession(launch.sessionId).world;
    for (let index = 0; index < 600 && world.territory.status === 'active'; index += 1) {
      advanceWorld(world, { now: 80_000 + index * 34 });
    }
    assert.equal(Object.keys(world.actors).length, slots.length);
    assert.deepEqual(Object.values(world.actors).map((actor) => actor.slot), slots);
    assert.ok(world.territory.scores.party_a + world.territory.scores.party_b > 0);
    assert.ok(Object.values(world.actors).every((actor) => Number.isFinite(actor.position.x) && Number.isFinite(actor.position.y)));
  }
});

test('Party A and B receive the same match state with perspective scores and isolated four-corner actors', () => {
  const { session, world } = territorySession();
  world.territory.scores = { party_a: 12, party_b: 34 };
  world.mission.partyScores = { ...world.territory.scores };
  const stateA = serializeWorldState(session, 'party_a');
  const stateB = serializeWorldState(session, 'party_b');
  assert.equal(stateA.world.territory.id, stateB.world.territory.id);
  assert.equal(stateA.world.mission.partyScore, 12);
  assert.equal(stateB.world.mission.partyScore, 34);
  assert.equal(stateA.world.actors.length, 8, 'display filtering is camera-side, not a second physics world');
  assert.equal(stateB.world.actors.length, 8);
});

test('mirrored command bases regenerate only their own party and session restart clears stale territory state', () => {
  const { manager, launch, world } = territorySession();
  const actorA = world.actors['actor-seat-1'];
  const actorB = world.actors['actor-seat-5'];
  actorA.position = { ...world.territory.commandPosts.party_a };
  actorB.position = { ...world.territory.commandPosts.party_b };
  assert.equal(findActorBaseZone(world, actorA).partyId, 'party_a');
  assert.equal(findActorBaseZone(world, actorB).partyId, 'party_b');
  actorB.position = { ...world.territory.commandPosts.party_a };
  assert.equal(findActorBaseZone(world, actorB), null);

  completeTerritoryMatch(world, 'test-finish');
  const restarted = manager.restartSession(launch.sessionId, launch.hostToken);
  const next = manager.getSession(restarted.sessionId).world;
  assert.equal(next.territory.status, 'active');
  assert.deepEqual(next.territory.scores, { party_a: 0, party_b: 0 });
  assert.equal(Object.values(next.npcs).filter((npc) => npc.kind === 'crew').length, 0);
  assert.deepEqual(next.economy.partyFunds, { party_a: 5000, party_b: 5000 });
});
