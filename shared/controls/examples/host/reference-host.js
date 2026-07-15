'use strict';

const path = require('node:path');
const profile = require(path.join(__dirname, '..', '..', 'profiles', 'top-down-twin-stick.json'));
const { createIntentSanitizer } = require('../../src/shared/intent');
const { createSeatInputGate, consumePulse } = require('../../src/host/seat-input-gate');
const { buildScreenBoundedObservation } = require('../../src/host/screen-observation');

const session = {
  id: 'session-reference-local',
  roomCode: 'AXM1',
  status: 'running',
  tick: 10,
  seatTokens: {
    seat_1: 'private-human-seat-token',
    seat_2: 'private-adapter-seat-token',
  },
  actors: {
    human: {
      id: 'actor-seat-1', seatId: 'seat_1', controller: 'human', partyId: 'party_a',
      displayName: 'Human', alive: true, position: { x: 120, y: 120 }, inputSequence: -1,
    },
    adapter: {
      id: 'actor-seat-2', seatId: 'seat_2', controller: 'adapter', partyId: 'party_a',
      displayName: 'Connected AI', alive: true, position: { x: 180, y: 120 }, inputSequence: -1,
    },
  },
};

const gate = createSeatInputGate({
  getSession: (sessionId) => sessionId === session.id ? session : null,
  sanitizeIntent: createIntentSanitizer(profile.intent),
  pulseFields: profile.intent.pulseFields,
});

const accepted = gate.route({
  roomCode: 'AXM1', sessionId: session.id, seatId: 'seat_2',
  token: session.seatTokens.seat_2, seq: 0,
  input: { moveX: 20, moveY: 0, aimX: 0, aimY: -1, fire: true, claimedHit: 'enemy-1' },
});

const actor = session.actors.adapter;
const observation = buildScreenBoundedObservation({
  sessionId: session.id,
  roomCode: session.roomCode,
  tick: session.tick,
  seatActor: actor,
  actors: session.actors,
  vehicles: [],
  viewport: { width: 960, height: 540 },
  worldBounds: { left: 0, top: 0, right: 1200, bottom: 800 },
  publicHud: { objective: 'Reach the beacon' },
  controllerProfile: '/profiles/top-down-twin-stick.json',
});

console.log(JSON.stringify({
  accepted,
  sanitizedInput: actor.input,
  fireConsumedByHostTick: consumePulse(actor, 'fire'),
  observation,
}, null, 2));

