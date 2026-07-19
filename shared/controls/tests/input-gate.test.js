'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const profile = require('../profiles/top-down-twin-stick.json');
const { createIntentSanitizer } = require('../src/shared/intent');
const {
  bindHumanInputSource,
  consumePulse,
  createSeatInputGate,
  disconnectIdleSeats,
  revokeHumanInputSource,
} = require('../src/host/seat-input-gate');

function fixture() {
  const session = {
    id: 'session-gate-test', roomCode: 'AXM1', status: 'running', tick: 7,
    seatTokens: {
      seat_1: 'private-human-token', seat_2: 'private-adapter-token', seat_3: 'private-host-ai-token',
    },
    actors: {
      human: { id: 'actor-1', seatId: 'seat_1', controller: 'human', alive: true, inputSequence: -1 },
      adapter: { id: 'actor-2', seatId: 'seat_2', controller: 'adapter', alive: true, inputSequence: -1 },
      ai: { id: 'actor-3', seatId: 'seat_3', controller: 'ai', alive: true, inputSequence: -1 },
    },
  };
  const gate = createSeatInputGate({
    getSession: (id) => id === session.id ? session : null,
    sanitizeIntent: createIntentSanitizer(profile.intent),
    pulseFields: profile.intent.pulseFields,
  });
  const packet = (seatId, token, seq, input) => ({
    roomCode: 'AXM1', sessionId: session.id, seatId, token, seq, input,
  });
  return { session, gate, packet };
}

test('human and connected adapter use the same authoritative token and sanitation gate', () => {
  const { session, gate, packet } = fixture();
  for (const [seatId, token, actorKey] of [
    ['seat_1', 'private-human-token', 'human'],
    ['seat_2', 'private-adapter-token', 'adapter'],
  ]) {
    const result = gate.route(packet(seatId, token, 0, {
      moveX: 50, moveY: 50, aimX: -8, aimY: 0, fire: true,
      position: { x: 9999, y: 9999 }, claimedHit: true,
    }), 10_000);
    assert.equal(result.ok, true);
    const actor = session.actors[actorKey];
    assert.ok(Math.abs(Math.hypot(actor.input.moveX, actor.input.moveY) - 1) < 1e-12);
    assert.equal(actor.input.aimX, -1);
    assert.equal(actor.pendingPulses.fire, true);
    assert.equal('position' in actor.input, false);
    assert.equal('claimedHit' in actor.input, false);
  }
});

test('rising-edge pulse survives a release packet until the host consumes it', () => {
  const { session, gate, packet } = fixture();
  const actor = session.actors.adapter;
  assert.equal(gate.route(packet('seat_2', 'private-adapter-token', 0, { fire: true })).ok, true);
  assert.equal(gate.route(packet('seat_2', 'private-adapter-token', 1, { fire: false })).ok, true);
  assert.equal(actor.pendingPulses.fire, true);
  assert.equal(actor.input.fire, true);
  assert.equal(consumePulse(actor, 'fire'), true);
  assert.equal(consumePulse(actor, 'fire'), false);
  assert.equal(actor.input.fire, false);
});

test('wrong token, stale sequence, and built-in Host AI control are rejected', () => {
  const { gate, packet } = fixture();
  assert.equal(gate.route(packet('seat_1', 'wrong-token', 0, {})).reason, 'seat-token-rejected');
  assert.equal(gate.route(packet('seat_1', 'private-human-token', 2, {})).ok, true);
  assert.equal(gate.route(packet('seat_1', 'private-human-token', 2, {})).reason, 'stale-input-sequence');
  assert.equal(gate.route(packet('seat_3', 'private-host-ai-token', 0, {})).reason, 'seat-host-controlled');
});

test('idle external seats are neutralized while built-in Host AI remains internal', () => {
  const { session } = fixture();
  session.actors.human.lastInputAt = 10;
  session.actors.adapter.lastInputAt = 20;
  session.actors.ai.lastInputAt = 0;
  session.actors.human.input = { moveX: 1, fire: true };
  session.actors.adapter.input = { moveX: 1, fire: true };
  assert.deepEqual(disconnectIdleSeats(session, 100, 500).sort(), ['seat_1', 'seat_2']);
  assert.equal(session.actors.human.connected, false);
  assert.equal(session.actors.human.input.moveX, 0);
  assert.notEqual(session.actors.ai.connected, false);
});

test('one versioned input-source lease excludes the previous hand while preserving the human seat', () => {
  const { session, gate, packet } = fixture();
  const actor = session.actors.human;
  const phone = bindHumanInputSource(actor, 'phone-touch', { bindingId: 'binding-phone', now: 100 });
  const phonePacket = { ...packet('seat_1', 'private-human-token', 0, { moveX: 1 }), inputSourceBindingId: phone.id, inputSourceEpoch: phone.epoch };
  assert.equal(gate.route(packet('seat_1', 'private-human-token', 0, { moveX: 1 })).reason, 'input-source-binding-rejected');
  assert.equal(gate.route(phonePacket).ok, true);

  const gamepad = bindHumanInputSource(actor, 'host-gamepad', { bindingId: 'binding-gamepad', now: 200 });
  assert.equal(gamepad.epoch, phone.epoch + 1);
  assert.equal(gate.route({ ...phonePacket, seq: 99 }).reason, 'input-source-binding-rejected');
  assert.equal(gate.route({
    ...packet('seat_1', 'private-human-token', 0, { moveX: -1 }),
    inputSourceBindingId: gamepad.id,
    inputSourceEpoch: gamepad.epoch,
  }).ok, true);
  assert.equal(actor.controller, 'human');

  revokeHumanInputSource(actor);
  assert.equal(actor.input.moveX, 0);
  assert.equal(actor.controller, 'human');
  assert.equal(gate.route({
    ...packet('seat_1', 'private-human-token', 1, {}),
    inputSourceBindingId: gamepad.id,
    inputSourceEpoch: gamepad.epoch,
  }).reason, 'input-source-binding-inactive');
});
