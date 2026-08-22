'use strict';

const crypto = require('crypto');

const EXTERNAL_TYPES = new Set(['human', 'adapter']);
const ALLOWED_INTENT_FIELDS = new Set(['axis', 'power']);
const OUTCOME_FIELDS = new Set(['position', 'x', 'y', 'damage', 'lives', 'winner', 'outcome', 'mission', 'ball', 'paddle', 'state']);
const INPUT_PROTOCOL = 'axm-semantic-input-v1';
const OBSERVATION_PROTOCOL = 'axm-seat-screen-semantics-v1';
const AUTHORITY_GATE = 'cross-seat-authority-v1';

function token() { return crypto.randomBytes(24).toString('base64url'); }
function fail(statusCode, reason, extra) { return Object.assign({ ok: false, statusCode, reason }, extra || {}); }
function tokensEqual(supplied, expected) {
  const left = Buffer.from(String(supplied || ''));
  const right = Buffer.from(String(expected || ''));
  return left.length === right.length && left.length > 0 && crypto.timingSafeEqual(left, right);
}
function playerBySeat(room, seatId) {
  return Object.values(room.players).find(player => player.participant && player.seatId === seatId) || null;
}
function createSeatBindings(room) {
  const bindings = {};
  for (const player of Object.values(room.players)) {
    if (!player.participant || !EXTERNAL_TYPES.has(player.kind) || !player.seatId) continue;
    bindings[player.seatId] = {
      seatId: player.seatId,
      playerId: player.id,
      slot: player.slot,
      displayName: player.name,
      controllerType: player.kind,
      adapterId: player.adapterId || null,
      token: token(),
      protocol: INPUT_PROTOCOL,
      observation: OBSERVATION_PROTOCOL,
      inputEndpoint: '/api/input',
      observationEndpoint: player.kind === 'adapter' ? '/api/adapter-observation' : null
    };
  }
  return bindings;
}
function sanitizeIntent(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return fail(400, 'intent-object-required');
  const keys = Object.keys(value);
  const outcome = keys.find(key => OUTCOME_FIELDS.has(key));
  if (outcome) return fail(400, 'machine-or-outcome-action-rejected', { field: outcome });
  const unknown = keys.find(key => !ALLOWED_INTENT_FIELDS.has(key));
  if (unknown) return fail(400, 'unknown-intention-field', { field: unknown });
  const axis = value.axis == null ? 0 : value.axis;
  if (typeof axis !== 'number' || !Number.isFinite(axis) || axis < -1 || axis > 1) return fail(400, 'axis-out-of-range');
  if (value.power != null && typeof value.power !== 'boolean') return fail(400, 'power-must-be-boolean');
  return { ok: true, value: { axis: Math.abs(axis) < 0.05 ? 0 : axis, power: value.power === true } };
}
function routeSemanticInput(room, packet, context) {
  const options = context || {};
  const binding = packet && packet.seatId ? options.bindings && options.bindings[packet.seatId] : null;
  const playerId = options.playerId || binding && binding.playerId;
  const player = playerId && room.players[playerId] || playerBySeat(room, packet && packet.seatId);
  if (!player || !player.participant) return fail(404, 'seat-not-active');
  if (!EXTERNAL_TYPES.has(player.kind)) return fail(403, 'seat-cannot-send-input');
  if (player.kind === 'adapter' && player.adapterConsent !== true) return fail(403, 'adapter-consent-revoked');
  if (options.requireToken) {
    if (!binding || !tokensEqual(packet.token, binding.token)) return fail(403, 'seat-token-rejected');
    if (packet.roomCode !== room.room) return fail(409, 'room-binding-rejected');
    if (!Number.isInteger(packet.sequence) || packet.sequence < 0) return fail(400, 'sequence-must-be-nonnegative-integer');
  } else if (player.kind !== 'human') return fail(403, 'legacy-controller-human-only');

  const input = room.inputs[player.id];
  const sequence = options.requireToken ? packet.sequence : input.sequence + 1;
  if (sequence <= input.sequence) return fail(409, 'stale-sequence', { nextSequenceMinimum: input.sequence + 1 });
  const sanitized = sanitizeIntent(packet.intent || {});
  if (!sanitized.ok) return sanitized;
  const now = Number.isFinite(options.now) ? options.now : Date.now();
  input.rateWindow = input.rateWindow.filter(at => now - at < 1000);
  if (input.rateWindow.length >= 30) return fail(429, 'seat-rate-limit');
  input.rateWindow.push(now);
  input.sequence = sequence;
  input.left = sanitized.value.axis < 0;
  input.right = sanitized.value.axis > 0;
  input.lastSeenAt = now;
  player.controllerConnected = true;
  if (sanitized.value.power && typeof options.usePower === 'function') options.usePower(player.id, now);
  return {
    ok: true,
    statusCode: 200,
    gate: AUTHORITY_GATE,
    protocol: INPUT_PROTOCOL,
    player: player.id,
    seatId: player.seatId,
    sequence,
    nextSequenceMinimum: sequence + 1,
    sanitized: sanitized.value
  };
}
function buildAdapterObservation(room, request, context) {
  const bindings = context && context.bindings || {};
  const binding = bindings[request && request.seatId];
  const player = binding && room.players[binding.playerId];
  if (!player || !player.participant || player.kind !== 'adapter') return fail(403, 'adapter-seat-required');
  if (player.adapterConsent !== true) return fail(403, 'adapter-consent-revoked');
  if (!tokensEqual(request.token, binding.token)) return fail(403, 'seat-token-rejected');
  if (request.roomCode !== room.room) return fail(409, 'room-binding-rejected');
  const state = context.publicState();
  const arena = state.arenas.find(item => item.id === state.arenaId) || state.arenas[0];
  const publicPlayer = id => {
    const item = state.players[id];
    return { id: item.id, seatId: item.seatId, displayName: item.name, controllerType: item.kind, side: item.side, role: item.role, team: item.team, participant: item.participant, alive: item.alive, lives: state.lives[id] };
  };
  return {
    ok: true,
    schema: OBSERVATION_PROTOCOL,
    scope: 'shared-arena-visible-only',
    roomCode: state.room,
    sessionId: String(context.sessionId || ''),
    version: state.version,
    tick: state.tick,
    phase: state.phase,
    playMode: state.playMode,
    arena: { id: arena.id, label: arena.label, objective: arena.objective, width: state.width, height: state.height },
    self: {
      ...publicPlayer(player.id),
      connected: player.controllerConnected,
      paddle: state.paddles[player.id],
      power: state.power[player.id]
    },
    hud: {
      event: state.event,
      winner: state.winner,
      outcome: state.outcome,
      alivePlayers: Object.keys(state.players).filter(id => state.players[id].participant && state.players[id].alive).length,
      mission: state.mission,
      effects: state.effects
    },
    visible: {
      players: Object.keys(state.players).map(publicPlayer),
      paddles: state.paddles,
      balls: state.balls,
      diamond: state.diamond
    },
    controls: {
      protocol: INPUT_PROTOCOL,
      inputEndpoint: '/api/input',
      allowedIntent: { axis: 'number -1..1', power: 'boolean pulse' },
      nextSequenceMinimum: room.inputs[player.id].sequence + 1
    },
    limits: ['No seat tokens', 'No input buffers', 'No random state', 'No client-authored position, damage, lives or outcomes']
  };
}

module.exports = {
  AUTHORITY_GATE,
  INPUT_PROTOCOL,
  OBSERVATION_PROTOCOL,
  buildAdapterObservation,
  createSeatBindings,
  routeSemanticInput,
  sanitizeIntent,
  tokensEqual
};
