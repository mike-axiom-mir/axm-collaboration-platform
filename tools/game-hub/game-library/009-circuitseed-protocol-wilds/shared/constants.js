'use strict';

const GAME_ID = '009-circuitseed-protocol-wilds';
const ROOM_CODE = 'AXM1';
const MAX_SEATS = 8;
const FIELD_OPERATOR_LIMIT = 4;
const TICK_RATE = 20;
const INPUT_TIMEOUT_MS = 900;
const DISCONNECT_MS = 5000;
const RECONNECT_WINDOW_MS = 15 * 60 * 1000;

const SEAT_TYPES = Object.freeze(['human', 'adapter', 'ai', 'spectator']);
const PULSE_FIELDS = Object.freeze(['scan', 'connect', 'deploy', 'assist', 'recover', 'return', 'build', 'interact']);
const BOOLEAN_FIELDS = Object.freeze(['moveActive']);
const TACTICAL_ACTIONS = Object.freeze(['Scan', 'Anchor', 'Shield', 'Patch', 'Reroute', 'Challenge', 'Isolate', 'Synchronize']);
const CHOICES = Object.freeze(['trace', 'mend', 'relay', 'branch_a', 'branch_b', 'repair', 'map', 'translate', 'open', 'closed']);
const FORBIDDEN_OBSERVATION_KEYS = Object.freeze([
  'token', 'seatTokens', 'hostToken', 'input', 'inputHeld', 'pendingPulses', 'randomSeed',
  'worldSeed', 'rngState', 'hidden', 'futureState', 'aiPlan', 'privateNotes', 'authority'
]);

module.exports = {
  GAME_ID, ROOM_CODE, MAX_SEATS, FIELD_OPERATOR_LIMIT, TICK_RATE, INPUT_TIMEOUT_MS,
  DISCONNECT_MS, RECONNECT_WINDOW_MS, SEAT_TYPES, PULSE_FIELDS, BOOLEAN_FIELDS,
  TACTICAL_ACTIONS, CHOICES, FORBIDDEN_OBSERVATION_KEYS
};
