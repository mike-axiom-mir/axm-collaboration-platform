'use strict';

const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const { createWorldState } = require('../server/world-state');
const { updateBaseRegeneration } = require('../server/base-system');
const { SessionManager } = require('../server/session-manager');
const { routeInput } = require('../server/input-router');
const { advanceWorld } = require('../server/world-loop');
const { downActor } = require('../server/projectile-system');
const {
  completeMission,
  interactWithMission,
  startMission,
  updateMission,
} = require('../server/mission-system');

function makeWorld(count = 4) {
  return createWorldState({
    projectRoot: path.join(__dirname, '..'),
    players: Array.from({ length: count }, (_, index) => ({
      actorId: `actor-seat-${index + 1}`,
      seatId: `seat_${index + 1}`,
      slot: index + 1,
      displayName: `P${index + 1}`,
      controllerType: 'human',
      partyId: index < 4 ? 'party_a' : 'party_b',
    })),
  });
}

test('party house board starts a ten-second countdown then teleports the whole party together', () => {
  const world = makeWorld();
  const leader = world.actors['actor-seat-2'];
  const before = Object.values(world.actors).map((actor) => ({ ...actor.position }));
  assert.equal(world.mission.status, 'base');
  assert.equal(interactWithMission(world, leader).kind, 'mission-board-open');
  assert.equal(world.mission.status, 'board');
  assert.equal(interactWithMission(world, leader).mode, 'supply_sweep');
  assert.equal(world.mission.countdownEndsAtTick - world.tick, 300);
  world.tick = world.mission.countdownEndsAtTick;
  updateMission(world);
  assert.equal(world.mission.status, 'active');
  assert.equal(world.mission.mode, 'supply_sweep');
  assert.equal(world.mission.packages.length, 6);
  assert.ok(Object.values(world.actors).every((actor, index) => (
    actor.missionSpawnPosition && (actor.position.x !== before[index].x || actor.position.y !== before[index].y)
  )));
});

test('token-bound phone ACTION opens and confirms only its host-controlled mission board', () => {
  const manager = new SessionManager({ projectRoot: path.join(__dirname, '..') });
  const launch = manager.createSession({ players: [{ slot: 1, displayName: 'Leader', controllerType: 'human' }] });
  const session = manager.getSession(launch.sessionId);
  const link = launch.controllerLinks[0];
  const send = (seq, action) => routeInput(manager, {
    roomCode: session.roomCode, sessionId: session.id, seatId: link.seatId, token: link.token, seq, input: { action },
  }, 10_000 + seq);
  assert.equal(send(1, true).actorId, 'actor-seat-1');
  advanceWorld(session.world, { now: 10_001 });
  assert.equal(session.world.mission.status, 'board');
  send(2, false); advanceWorld(session.world, { now: 10_002 });
  send(3, true); advanceWorld(session.world, { now: 10_003 });
  assert.equal(session.world.mission.status, 'countdown');
  assert.equal(session.world.mission.selectedMode, 'supply_sweep');
});

test('successful mission pays equal low-value credits, returns everyone to base, and results never auto-dismiss', () => {
  const world = makeWorld(2);
  startMission(world, 'supply_sweep');
  const actors = Object.values(world.actors);
  actors[0].health = 40;
  completeMission(world, true, 'test-complete');
  assert.equal(world.mission.status, 'results');
  assert.deepEqual(actors.map((actor) => actor.walletCents), [10600, 10600]);
  assert.deepEqual(world.economy.partyFunds, { party_a: 1800, party_b: 0 });
  assert.equal(world.mission.result.personalRewardCents, 600);
  assert.equal(world.mission.result.partyContributionCents, 900);
  assert.equal(actors[0].health, 40, 'a successful return preserves damage for the base to heal');
  updateBaseRegeneration(world, 1);
  assert.equal(actors[0].health, 50, 'results break keeps the party-house 10 HP/s regeneration active');
  assert.ok(actors.every((actor) => actor.regeneration.baseZoneId === null || actor.position.x >= 662));
  const results = world.mission;
  world.tick += 30 * 60 * 20;
  updateMission(world);
  assert.equal(world.mission, results, 'twenty simulated minutes do not dismiss the break screen');
  assert.equal(world.mission.status, 'results');
});

test('results ignore early ACTION then deliberately continue after the two-second guard', () => {
  const world = makeWorld(1);
  const actor = world.actors['actor-seat-1'];
  startMission(world, 'supply_sweep');
  completeMission(world, true, 'test-complete');
  assert.equal(interactWithMission(world, actor).reason, 'results-break-locked');
  world.tick = world.mission.resultsReadyAtTick;
  assert.equal(interactWithMission(world, actor).kind, 'mission-continue');
  assert.equal(world.mission.status, 'base');
});

test('whole-party down fails once and returns everyone alive at 50 HP without a cash penalty', () => {
  const world = makeWorld(2);
  startMission(world, 'hold_relay');
  Object.values(world.actors).forEach((actor) => downActor(world, actor));
  updateMission(world);
  assert.equal(world.mission.status, 'results');
  assert.equal(world.mission.result.success, false);
  assert.equal(world.mission.result.reason, 'party-downed');
  assert.equal(world.mission.result.rewardCents, 0);
  assert.deepEqual(world.economy.partyFunds, { party_a: 0, party_b: 0 });
  assert.ok(Object.values(world.actors).every((actor) => actor.alive && actor.health === 50 && actor.walletCents === 10000));
});

test('eight actors initialise and receive isolated Party A/B mission splits without four-seat assumptions', () => {
  const world = makeWorld(8);
  startMission(world, 'hold_relay');
  assert.equal(Object.keys(world.actors).length, 8);
  assert.ok(Object.values(world.actors).every((actor) => actor.walletCents === 10000 && actor.missionSpawnPosition));
  assert.deepEqual(world.economy.partyFunds, { party_a: 0, party_b: 0 });
  assert.equal(world.mission.goal, 3);
  assert.equal(world.mission.relay.maxHealth, 30);
  assert.equal(Object.values(world.npcs).filter((npc) => npc.source === 'mission').length, 5);
  completeMission(world, true, 'eight-seat-test');
  assert.ok(Object.values(world.actors).every((actor) => actor.walletCents === 11000));
  assert.deepEqual(world.economy.partyFunds, { party_a: 6000, party_b: 6000 });
});
