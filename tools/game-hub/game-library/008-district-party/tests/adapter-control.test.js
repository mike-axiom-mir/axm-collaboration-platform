'use strict';

const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const { routeInput } = require('../server/input-router');
const { getAdapterObservation } = require('../server/seat-observation');
const { SessionManager } = require('../server/session-manager');
const { advanceWorld } = require('../server/world-loop');

const projectRoot = path.join(__dirname, '..');

function adapterSession() {
  const manager = new SessionManager({ projectRoot });
  const launch = manager.createSession({
    roomCode: 'AXM1',
    players: [
      { slot: 1, displayName: 'Connected AI', controllerType: 'adapter', adapterId: 'foundation-ai-alpha' },
      { slot: 5, displayName: 'Human Rival', controllerType: 'human' },
    ],
    settings: { mode: 'district_dominion' },
  });
  return { manager, launch, session: manager.getSession(launch.sessionId) };
}

test('Foundation adapter receives a semantic binding and seat token but never a phone QR/controller link', () => {
  const { launch } = adapterSession();
  assert.equal(launch.players.length, 2);
  assert.equal(launch.controllerLinks.length, 1);
  assert.equal(launch.controllerLinks[0].seatId, 'seat_5');
  assert.equal(launch.adapterBindings.length, 1);
  const binding = launch.adapterBindings[0];
  assert.equal(binding.seatId, 'seat_1');
  assert.equal(binding.adapterId, 'foundation-ai-alpha');
  assert.equal(binding.protocol, 'axm-semantic-input-v1');
  assert.equal(binding.inputEndpoint, '/api/input');
  assert.equal(binding.observationEndpoint, '/api/adapter-observation');
  assert.equal(binding.controllerProfile, '/data/controller-profile.json');
  assert.match(binding.token, /^seat-/);
});

test('adapter intentions use the same token, sequence, sanitation and host movement path as human input', () => {
  const { manager, launch, session } = adapterSession();
  const binding = launch.adapterBindings[0];
  const actor = session.world.actors['actor-seat-1'];
  const before = { ...actor.position };
  const routed = routeInput(manager, {
    roomCode: 'AXM1',
    sessionId: session.id,
    seatId: binding.seatId,
    token: binding.token,
    seq: 1,
    input: { moveX: -20, moveY: 0, aimX: 99, aimY: 0 },
  }, 10_000);
  assert.equal(routed.ok, true);
  assert.equal(actor.input.moveX, -1, 'adapter movement is clamped by the shared semantic input sanitizer');
  assert.equal(actor.input.aimX, 1, 'adapter aim is independently clamped');
  advanceWorld(session.world, { now: 10_010 });
  assert.ok(actor.position.x < before.x, 'host advanced adapter actor from its accepted intention');
  assert.equal(actor.aiState, null, 'adapter is not relabelled as the built-in host AI');
  assert.equal(routeInput(manager, {
    roomCode: 'AXM1', sessionId: session.id, seatId: binding.seatId, token: binding.token, seq: 1, input: {},
  }).reason, 'stale-input-sequence');
});

test('built-in Host AI remains optional and rejects external control packets', () => {
  const manager = new SessionManager({ projectRoot });
  const launch = manager.createSession({ players: [{ slot: 1, controllerType: 'ai' }] });
  assert.equal(launch.controllerLinks.length, 0);
  assert.equal(launch.adapterBindings.length, 0);
  const result = routeInput(manager, {
    roomCode: 'AXM1', sessionId: launch.sessionId, seatId: 'seat_1', token: 'seat-0000000000000000', seq: 1, input: { moveX: 1 },
  });
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'seat-host-controlled');
});

test('adapter observation contains the party-screen information budget and excludes off-screen opponents', () => {
  const { manager, launch, session } = adapterSession();
  const binding = launch.adapterBindings[0];
  const adapter = session.world.actors['actor-seat-1'];
  const rival = session.world.actors['actor-seat-5'];
  adapter.position = { x: 930, y: 500 };
  rival.position = { x: 72, y: 500 };
  const request = {
    roomCode: 'AXM1', sessionId: session.id, seatId: binding.seatId, token: binding.token, width: 960, height: 540,
  };
  const observation = getAdapterObservation(manager, request);
  assert.equal(observation.ok, true);
  assert.equal(observation.scope, 'same-party-shared-screen-only');
  assert.equal(observation.screen.viewport.width, 960);
  assert.equal(observation.partyHud.length, 1);
  assert.deepEqual(observation.visible.actors.map((actor) => actor.id), [adapter.id]);
  const serialized = JSON.stringify(observation);
  assert.doesNotMatch(serialized, new RegExp(rival.id), 'off-screen rival identity is not leaked');
  assert.doesNotMatch(serialized, /randomSeed|aiPath|nextAttackTick|pendingPulses/, 'host-only internals are absent');

  rival.position = { x: 860, y: 500 };
  const visible = getAdapterObservation(manager, request);
  assert.ok(visible.visible.actors.some((actor) => actor.id === rival.id), 'opponent appears after entering the shared camera');
});

test('adapter observation is token-bound and unavailable to human or Host AI seats', () => {
  const { manager, launch, session } = adapterSession();
  const binding = launch.adapterBindings[0];
  assert.equal(getAdapterObservation(manager, {
    roomCode: 'AXM1', sessionId: session.id, seatId: binding.seatId, token: 'seat-0000000000000000',
  }).reason, 'seat-token-rejected');
  assert.equal(getAdapterObservation(manager, {
    roomCode: 'AXM1', sessionId: session.id, seatId: 'seat_5', token: launch.controllerLinks[0].token,
  }).reason, 'adapter-seat-not-found');
});
