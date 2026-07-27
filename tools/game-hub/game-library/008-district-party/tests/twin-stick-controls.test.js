'use strict';

const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const { SessionManager } = require('../server/session-manager');
const { routeInput } = require('../server/input-router');
const { advanceWorld } = require('../server/world-loop');
const { claimVehicleSeat, updateVehicles } = require('../server/vehicle-system');
const { sanitizeInputIntent } = require('../shared/validation');
const { INPUT_FIELDS } = require('../shared/protocol');
const { serializeWorldState } = require('../server/display-state');

const projectRoot = path.join(__dirname, '..');
const controlModulePath = path.join(projectRoot, 'client', 'controller', 'axm-game-night-controls.js');

async function controlModule() {
  const source = fs.readFileSync(controlModulePath, 'utf8');
  return import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
}

function oneHumanSession() {
  const manager = new SessionManager({ projectRoot });
  const launch = manager.createSession({ players: [{ slot: 1, displayName: 'Twin Stick', controllerType: 'human' }] });
  return { manager, launch, session: manager.getSession(launch.sessionId), token: launch.controllerLinks[0].token };
}

test('radial dead zone removes drift while the response curve reaches full speed', async () => {
  const { normalizeRadialInput } = await controlModule();
  assert.deepEqual(normalizeRadialInput(0.05, -0.04), { x: 0, y: 0, magnitude: 0, rawMagnitude: Math.hypot(0.05, -0.04) });
  const half = normalizeRadialInput(0.5, 0);
  assert.ok(half.x > 0 && half.x < 0.5, 'response curve gives precise low-speed control');
  const diagonal = normalizeRadialInput(1, 1);
  assert.ok(Math.abs(diagonal.magnitude - 1) < 1e-9);
  assert.ok(Math.abs(Math.hypot(diagonal.x, diagonal.y) - 1) < 1e-9);
});

test('host sanitizes movement and aim as two independent normalized vectors', () => {
  const clean = sanitizeInputIntent({ moveX: 2, moveY: 2, aimX: -3, aimY: 0, aimActive: true, fire: true, mapToggle: true });
  assert.ok(Math.abs(Math.hypot(clean.moveX, clean.moveY) - 1) < 1e-9);
  assert.deepEqual({ x: clean.aimX, y: clean.aimY }, { x: -1, y: 0 });
  assert.equal(clean.aimActive, true);
  assert.equal(clean.fire, true);
  assert.equal(clean.mapToggle, true);
  for (const field of ['moveX', 'moveY', 'aimX', 'aimY', 'aimActive', 'fire', 'mapToggle']) assert.ok(INPUT_FIELDS.includes(field));
});

test('quick release-to-fire survives a release packet and shoots along host-owned aim while strafing', () => {
  const { manager, session, token } = oneHumanSession();
  const actor = session.world.actors['actor-seat-1'];
  const before = { ...actor.position };
  const send = (seq, input) => routeInput(manager, {
    roomCode: session.roomCode,
    sessionId: session.id,
    seatId: actor.seatId,
    token,
    seq,
    input,
  }, 10_000 + seq);
  assert.equal(send(1, { moveX: 1, aimX: 0, aimY: -1, aimActive: true, fire: true }).ok, true);
  assert.equal(send(2, { moveX: 1, aimX: 0, aimY: -1, aimActive: false, fire: false }).ok, true);
  assert.equal(actor.pendingPulses.fire, true, 'network release cannot erase the accepted fire edge');
  advanceWorld(session.world, { now: 10_010 });
  const projectile = Object.values(session.world.projectiles)[0];
  assert.ok(actor.position.x > before.x, 'movement stick strafed east');
  assert.ok(Math.abs(actor.facing.x) < 1e-9 && actor.facing.y < -0.99, 'aim stick owns facing independently');
  assert.ok(projectile && Math.abs(projectile.velocity.x) < 1e-9 && projectile.velocity.y < 0, 'host projectile follows aim intent');
  assert.equal(actor.pendingPulses.fire, false);
});

test('latched controller map pulse increments only its party presentation signal', () => {
  const { manager, session, token } = oneHumanSession();
  const actor = session.world.actors['actor-seat-1'];
  const send = (seq, input) => routeInput(manager, {
    roomCode: session.roomCode,
    sessionId: session.id,
    seatId: actor.seatId,
    token,
    seq,
    input,
  }, 15_000 + seq);
  assert.equal(send(1, { mapToggle: true }).ok, true);
  assert.equal(send(2, { mapToggle: false }).ok, true);
  assert.equal(actor.pendingPulses.mapToggle, true, 'release packet cannot erase the map pulse');
  advanceWorld(session.world, { now: 15_010 });
  assert.equal(actor.pendingPulses.mapToggle, false);
  assert.equal(serializeWorldState(session, 'party_a').world.presentation.mapToggleSequence, 1);
  assert.equal(serializeWorldState(session, 'party_b').world.presentation.mapToggleSequence, 0);
});

test('release fire buffers briefly across an active weapon cooldown', () => {
  const { manager, session, token } = oneHumanSession();
  const actor = session.world.actors['actor-seat-1'];
  actor.nextAttackTick = 3;
  routeInput(manager, {
    roomCode: session.roomCode,
    sessionId: session.id,
    seatId: actor.seatId,
    token,
    seq: 1,
    input: { aimX: 1, aimY: 0, fire: true },
  }, 20_000);
  advanceWorld(session.world, { now: 20_001 });
  advanceWorld(session.world, { now: 20_002 });
  assert.equal(Object.keys(session.world.projectiles).length, 0);
  advanceWorld(session.world, { now: 20_003 });
  assert.equal(Object.keys(session.world.projectiles).length, 1, 'four-tick input buffer avoids a near-cooldown lost shot');
  assert.equal(actor.fireQueuedUntilTick, null);
});

test('passenger aim uses the right-stick vector without stealing left-stick movement fields', () => {
  const { session } = oneHumanSession();
  const world = session.world;
  const actor = world.actors['actor-seat-1'];
  const vehicle = world.vehicles['vehicle-001'];
  actor.position = { ...vehicle.position };
  vehicle.driverActorId = 'host-driver-placeholder';
  assert.equal(claimVehicleSeat(world, actor.id, vehicle.id, 'passenger').ok, true);
  actor.input = { moveX: -1, moveY: 0, aimX: 0, aimY: 1, aimActive: true, fire: false, sprint: false, brake: false };
  updateVehicles(world, 1 / 30);
  assert.ok(Math.abs(actor.facing.x) < 1e-9 && actor.facing.y > 0.99);
  assert.equal(actor.vehicleSeat, 'passenger_1');
});

test('controller page exposes two original floating sticks and loads the reusable module locally', () => {
  const html = fs.readFileSync(path.join(projectRoot, 'client', 'controller', 'controller.html'), 'utf8');
  const css = fs.readFileSync(path.join(projectRoot, 'client', 'controller', 'controller.css'), 'utf8');
  const controller = fs.readFileSync(path.join(projectRoot, 'client', 'controller', 'controller.js'), 'utf8');
  const profile = JSON.parse(fs.readFileSync(path.join(projectRoot, 'data', 'controller-profile.json'), 'utf8'));
  for (const id of ['stick', 'stick-base', 'stick-knob', 'aim-stick', 'aim-stick-base', 'aim-stick-knob']) {
    assert.match(html, new RegExp(`id=["']${id}["']`));
  }
  assert.match(html, /type=["']module["'][^>]*src=["']\/controller\/controller\.js["']/);
  assert.match(css, /\.twin-controls/);
  assert.match(css, /touch-action:\s*none/);
  assert.match(controller, /AxmVirtualStick/);
  assert.match(controller, /setInterval\(sendInput, 50\)/);
  assert.match(controller, /pulseKeys = \['action', 'fire'/, 'ACTION shares the loss-resistant pulse queue');
  assert.match(controller, /bindPulse\('action', 'action'\)/, 'phone ACTION is a one-tap pulse instead of a lossy hold');
  assert.match(controller, /MAP_HOLD_MS = 650/);
  assert.match(controller, /bindInventoryTapOrMapHold\(\)/);
  assert.match(controller, /triggerPulse\('mapToggle'\)/);
  assert.match(controller, /KeyE: 'action'/, 'keyboard ACTION uses the same one-shot route');
  assert.doesNotMatch(controller, /bindHold\('action'/, 'ACTION cannot be cleared by an unrelated in-flight send');
  assert.equal(profile.profileId, 'axm-game-night-twin-stick-v1');
  assert.deepEqual(profile.rightStick.fields, ['aimX', 'aimY', 'aimActive']);
  assert.equal(profile.hostRules.firePulseLatchedUntilTick, true);
  assert.doesNotMatch(fs.readFileSync(controlModulePath, 'utf8'), /fetch\(|XMLHttpRequest|WebSocket/);
});
