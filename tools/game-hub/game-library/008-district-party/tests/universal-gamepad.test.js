'use strict';

const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const { SessionManager } = require('../server/session-manager');
const { routeInput } = require('../server/input-router');
const { localGamepadBindings } = require('../server/server');

const projectRoot = path.join(__dirname, '..');

test('host-local gamepad bindings expose only visible human seats in stable seat order', () => {
  const manager = new SessionManager({ projectRoot });
  const launch = manager.createSession({
    roomCode: 'AXM1',
    players: [
      { slot: 1, displayName: 'Mike', controllerType: 'human' },
      { slot: 2, displayName: 'Errol', controllerType: 'human' },
      { slot: 3, displayName: 'Moxie', controllerType: 'ai' },
    ],
  });
  const result = localGamepadBindings(manager, { sessionId: launch.sessionId, roomCode: 'AXM1', partyId: 'party_a' });
  assert.equal(result.ok, true);
  assert.equal(result.profile, 'axm-universal-xbox-brawl-v0.2.1');
  assert.deepEqual(result.bindings.map((binding) => [binding.gamepadIndex, binding.seatId, binding.displayName]), [
    [0, 'seat_1', 'Mike'],
    [1, 'seat_2', 'Errol'],
  ]);
  assert.ok(result.bindings.every((binding) => binding.token === manager.getSession(launch.sessionId).seatTokens[binding.seatId]));
});

test('phone and shared gamepad sequences stay independent and only meaningful input changes ownership', () => {
  const manager = new SessionManager({ projectRoot });
  const launch = manager.createSession({ roomCode: 'AXM1', players: [{ slot: 1, displayName: 'Mike', controllerType: 'human' }] });
  const session = manager.getSession(launch.sessionId);
  const actor = session.world.actors['actor-seat-1'];
  const token = launch.controllerLinks[0].token;
  const packet = (source, seq, input) => ({ roomCode: 'AXM1', sessionId: session.id, seatId: 'seat_1', token, source, seq, input });

  assert.equal(routeInput(manager, packet('controller', 1, { moveX: 1 }), 1000).ok, true);
  assert.equal(actor.inputSource, 'controller');
  const ignoredPad = routeInput(manager, packet('shared-gamepad', 1, { moveX: 0 }), 1010);
  assert.equal(ignoredPad.ignored, true);
  assert.equal(actor.input.moveX, 1);
  assert.equal(routeInput(manager, packet('shared-gamepad', 2, { moveX: -1 }), 1020).ok, true);
  assert.equal(actor.inputSource, 'shared-gamepad');
  assert.equal(actor.input.moveX, -1);
  const ignoredPhone = routeInput(manager, packet('controller', 2, { moveX: 0 }), 1030);
  assert.equal(ignoredPhone.ignored, true);
  assert.equal(actor.input.moveX, -1);
  assert.equal(routeInput(manager, packet('controller', 3, { moveY: -1 }), 1040).ok, true);
  assert.equal(actor.inputSource, 'controller');
  assert.equal(actor.input.moveY, -1);
  assert.equal(routeInput(manager, packet('shared-gamepad', 2, { moveX: 1 }), 1050).reason, 'stale-input-sequence');
});

test('shared screen declares the complete Xbox/Brawl mapping and local-only binding route', () => {
  const game = fs.readFileSync(path.join(projectRoot, 'client/game/game.html'), 'utf8');
  const bridge = fs.readFileSync(path.join(projectRoot, 'client/game/universal-gamepad.js'), 'utf8');
  const server = fs.readFileSync(path.join(projectRoot, 'server/server.js'), 'utf8');
  assert.match(game, /id="gamepad-status"/);
  assert.match(game, /LEFT STICK\/D-PAD MOVE/);
  assert.match(game, /A ACTION/);
  assert.match(game, /X\/RT FIRE/);
  assert.match(bridge, /source: 'shared-gamepad'/);
  assert.match(bridge, /pressed\(gamepad, 9\)/);
  assert.match(server, /host-local-gamepad-bindings-required/);
  assert.match(server, /isLoopbackAddress\(request\.socket\.remoteAddress\)/);
});
