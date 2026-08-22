'use strict';

const crypto = require('crypto');

const INPUT_PROTOCOL = 'axm-semantic-input-v1';
const OBSERVATION_PROTOCOL = 'axm-seat-screen-semantics-v1';
const AUTHORITY_GATE = 'lumenwake-seat-authority-v1';
const ALLOWED_INTENT_FIELDS = new Set(['moveX', 'moveY', 'action', 'dash']);
const OUTCOME_FIELDS = new Set([
  'x', 'y', 'hp', 'maxHp', 'down', 'revive', 'charge', 'goal', 'wave',
  'phase', 'result', 'players', 'shards', 'enemies', 'effects', 'stats', 'state'
]);

function token() {
  return crypto.randomBytes(24).toString('base64url');
}

function fail(statusCode, reason, extra) {
  return Object.assign({ ok: false, statusCode, reason }, extra || {});
}

function tokensEqual(supplied, expected) {
  const left = Buffer.from(String(supplied || ''));
  const right = Buffer.from(String(expected || ''));
  return left.length === right.length && left.length > 0 && crypto.timingSafeEqual(left, right);
}

function finiteAxis(value, field) {
  if (value == null) return { ok: true, value: 0 };
  if (typeof value !== 'number' || !Number.isFinite(value) || value < -1 || value > 1) {
    return fail(400, field + '-out-of-range');
  }
  return { ok: true, value: Math.abs(value) < 0.025 ? 0 : value };
}

function sanitizeIntent(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return fail(400, 'intent-object-required');
  const keys = Object.keys(value);
  const outcome = keys.find(key => OUTCOME_FIELDS.has(key));
  if (outcome) return fail(400, 'machine-or-outcome-action-rejected', { field: outcome });
  const unknown = keys.find(key => !ALLOWED_INTENT_FIELDS.has(key));
  if (unknown) return fail(400, 'unknown-intention-field', { field: unknown });
  const moveX = finiteAxis(value.moveX, 'moveX');
  if (!moveX.ok) return moveX;
  const moveY = finiteAxis(value.moveY, 'moveY');
  if (!moveY.ok) return moveY;
  for (const field of ['action', 'dash']) {
    if (value[field] != null && typeof value[field] !== 'boolean') return fail(400, field + '-must-be-boolean');
  }
  return { ok: true, value: { moveX: moveX.value, moveY: moveY.value, action: value.action === true, dash: value.dash === true } };
}

function createSeatBindings(game, configuredSeats) {
  const rawSeats = Array.isArray(configuredSeats) ? configuredSeats : [];
  const bindings = {};
  Object.values(game.players).forEach((player, index) => {
    if (player.kind !== 'adapter' || !player.seatId) return;
    const configured = rawSeats[index] || {};
    bindings[player.seatId] = {
      seatId: player.seatId,
      playerId: player.id,
      slot: index + 1,
      displayName: player.name,
      controllerType: 'adapter',
      adapterId: String(configured.adapter_id || configured.adapterId || 'adapter-seat-' + (index + 1)),
      token: token(),
      consent: true,
      sequence: -1,
      rateWindow: [],
      protocol: INPUT_PROTOCOL,
      observation: OBSERVATION_PROTOCOL,
      inputEndpoint: '/api/input',
      observationEndpoint: '/api/adapter-observation'
    };
  });
  return bindings;
}

function publicBindings(bindings) {
  return Object.values(bindings || {}).map(binding => ({
    seatId: binding.seatId,
    playerId: binding.playerId,
    slot: binding.slot,
    displayName: binding.displayName,
    controllerType: binding.controllerType,
    adapterId: binding.adapterId,
    token: binding.token,
    protocol: binding.protocol,
    observation: binding.observation,
    inputEndpoint: binding.inputEndpoint,
    observationEndpoint: binding.observationEndpoint
  }));
}

function routeSemanticInput(game, inputs, packet, context) {
  const options = context || {};
  const value = packet || {};
  let player = null;
  let ledger = null;
  let sequence = -1;

  if (options.requireToken) {
    const binding = options.bindings && options.bindings[value.seatId];
    if (!binding) return fail(403, 'adapter-seat-required');
    player = game.players[binding.playerId];
    if (!player || player.kind !== 'adapter') return fail(403, 'adapter-seat-required');
    if (binding.consent !== true) return fail(403, 'adapter-consent-revoked');
    if (!tokensEqual(value.token, binding.token)) return fail(403, 'seat-token-rejected');
    if (value.roomCode !== options.roomCode) return fail(409, 'room-binding-rejected');
    if (!Number.isInteger(value.sequence) || value.sequence < 0) return fail(400, 'sequence-must-be-nonnegative-integer');
    ledger = binding;
    sequence = value.sequence;
  } else {
    player = game.players[options.playerId];
    if (!player) return fail(404, 'seat-not-active');
    if (player.kind !== 'human') return fail(403, 'legacy-controller-human-only');
    ledger = inputs[player.id] || { sequence: -1, rateWindow: [] };
    sequence = Number.isInteger(ledger.sequence) ? ledger.sequence + 1 : 0;
  }

  if (sequence <= ledger.sequence) return fail(409, 'stale-sequence', { nextSequenceMinimum: ledger.sequence + 1 });
  const sanitized = sanitizeIntent(value.intent || {});
  if (!sanitized.ok) return sanitized;
  const now = Number.isFinite(options.now) ? options.now : Date.now();
  ledger.rateWindow = Array.isArray(ledger.rateWindow) ? ledger.rateWindow.filter(at => now - at < 1000) : [];
  if (ledger.rateWindow.length >= 40) return fail(429, 'seat-rate-limit');
  ledger.rateWindow.push(now);
  ledger.sequence = sequence;

  const previous = inputs[player.id] || {};
  inputs[player.id] = {
    moveX: sanitized.value.moveX,
    moveY: sanitized.value.moveY,
    action: previous.action === true || sanitized.value.action,
    dash: previous.dash === true || sanitized.value.dash,
    updatedAt: now,
    sequence: player.kind === 'human' ? sequence : Number.isInteger(previous.sequence) ? previous.sequence : -1,
    rateWindow: player.kind === 'human' ? ledger.rateWindow : Array.isArray(previous.rateWindow) ? previous.rateWindow : []
  };

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

function visiblePlayer(player, now, inputs) {
  const input = inputs[player.id] || {};
  return {
    id: player.id,
    seatId: player.seatId,
    displayName: player.name,
    controllerType: player.kind,
    color: player.color,
    x: player.x,
    y: player.y,
    hp: player.hp,
    maxHp: player.maxHp,
    down: player.down,
    revive: player.revive,
    carried: player.carried.slice(),
    pulseIn: Math.max(0, player.pulseReadyAt - now),
    dashIn: Math.max(0, player.dashReadyAt - now),
    connected: player.kind === 'ai' ? null : now - Number(input.updatedAt || 0) <= 1200,
    stats: JSON.parse(JSON.stringify(player.stats))
  };
}

function buildAdapterObservation(game, request, context) {
  const options = context || {};
  const binding = options.bindings && options.bindings[request && request.seatId];
  const player = binding && game.players[binding.playerId];
  if (!player || player.kind !== 'adapter') return fail(403, 'adapter-seat-required');
  if (binding.consent !== true) return fail(403, 'adapter-consent-revoked');
  if (!tokensEqual(request.token, binding.token)) return fail(403, 'seat-token-rejected');
  if (request.roomCode !== options.roomCode) return fail(409, 'room-binding-rejected');
  const now = game.now;
  const players = Object.values(game.players).map(item => visiblePlayer(item, now, options.inputs || {}));
  return {
    ok: true,
    schema: OBSERVATION_PROTOCOL,
    profile: 'axm.lumenwake-adapter-observation/v1',
    scope: 'seat-and-shared-screen-visible-only',
    roomCode: options.roomCode,
    sessionId: String(options.sessionId || ''),
    gameId: game.gameId,
    version: game.version,
    now,
    phase: game.phase,
    self: players.find(item => item.id === player.id),
    hud: {
      startAt: game.startAt,
      endsAt: game.endsAt,
      durationMs: game.durationMs,
      wave: game.wave,
      charge: game.charge,
      goal: game.goal,
      event: game.event,
      eventAt: game.eventAt,
      map: { id: game.map.id, name: game.map.name, description: game.map.description },
      duetsCompleted: game.duetsCompleted,
      duetCount: game.duets.length,
      resonancesCompleted: game.resonancesCompleted,
      resonanceCount: game.resonances.length,
      result: game.result ? JSON.parse(JSON.stringify(game.result)) : null
    },
    visible: {
      players,
      shards: game.shards.map(item => ({ id: item.id, color: item.color, x: item.x, y: item.y })),
      enemies: game.enemies.map(item => ({ id: item.id, x: item.x, y: item.y, hp: item.hp, stunned: item.stunnedUntil > now })),
      duets: game.duets.map(item => ({ id: item.id, label: item.label, color: item.color, pads: item.pads, progress: item.progress, complete: item.complete, occupants: item.occupants })),
      resonances: game.resonances.map(item => ({ id: item.id, label: item.label, color: item.color, x: item.x, y: item.y, progress: item.progress, complete: item.complete, firstPlayer: item.firstPlayer, expiresAt: item.expiresAt })),
      effects: game.effects.map(item => ({ id: item.id, kind: item.kind, x: item.x, y: item.y, color: item.color, bornAt: item.bornAt }))
    },
    controls: {
      gate: AUTHORITY_GATE,
      protocol: INPUT_PROTOCOL,
      inputEndpoint: '/api/input',
      allowedIntent: { moveX: 'number -1..1', moveY: 'number -1..1', action: 'boolean pulse', dash: 'boolean pulse' },
      nextSequenceMinimum: binding.sequence + 1
    },
    limits: ['No seat tokens', 'No random seed or spawn schedule', 'No input buffers or rate ledger', 'No client-authored position, health, charge, phase, score or result']
  };
}

module.exports = {
  AUTHORITY_GATE,
  INPUT_PROTOCOL,
  OBSERVATION_PROTOCOL,
  buildAdapterObservation,
  createSeatBindings,
  publicBindings,
  routeSemanticInput,
  sanitizeIntent,
  tokensEqual
};
