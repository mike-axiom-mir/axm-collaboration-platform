'use strict';

const crypto = require('crypto');

const EXTERNAL_TYPES = new Set(['human', 'adapter']);
const ALLOWED_INTENT_FIELDS = new Set(['moveX', 'moveY', 'lookX', 'lookY', 'fire', 'special', 'buy']);
const OUTCOME_FIELDS = new Set(['x', 'z', 'yaw', 'pitch', 'position', 'health', 'ammo', 'wood', 'damage', 'score', 'teamScore', 'healthJar', 'winner', 'world', 'state']);
const INPUT_PROTOCOL = 'axm-semantic-input-v1';
const OBSERVATION_PROTOCOL = 'axm-seat-screen-semantics-v1';
const AUTHORITY_GATE = 'briarfront-seat-authority-v1';

function token() { return crypto.randomBytes(24).toString('base64url'); }
function fail(statusCode, reason, extra) { return Object.assign({ ok: false, statusCode, reason }, extra || {}); }
function tokensEqual(supplied, expected) {
  const left = Buffer.from(String(supplied || ''));
  const right = Buffer.from(String(expected || ''));
  return left.length === right.length && left.length > 0 && crypto.timingSafeEqual(left, right);
}
function playerBySeat(world, seatId) {
  return Object.values(world.players).find(player => player.seatId === seatId) || null;
}
function createSeatBindings(world) {
  const bindings = {};
  for (const player of Object.values(world.players)) {
    if (player.kind !== 'adapter' || !player.seatId) continue;
    bindings[player.seatId] = {
      seatId: player.seatId,
      playerId: player.id,
      slot: player.slot,
      displayName: player.name,
      controllerType: player.kind,
      adapterId: player.adapterId,
      token: token(),
      protocol: INPUT_PROTOCOL,
      observation: OBSERVATION_PROTOCOL,
      inputEndpoint: '/api/input',
      observationEndpoint: '/api/adapter-observation'
    };
  }
  return bindings;
}
function finiteAxis(value, name) {
  if (value == null) return { ok: true, value: 0 };
  if (typeof value !== 'number' || !Number.isFinite(value) || value < -1 || value > 1) return fail(400, name + '-out-of-range');
  return { ok: true, value: Math.abs(value) < 0.025 ? 0 : value };
}
function sanitizeIntent(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return fail(400, 'intent-object-required');
  const keys = Object.keys(value);
  const outcome = keys.find(key => OUTCOME_FIELDS.has(key));
  if (outcome) return fail(400, 'machine-or-outcome-action-rejected', { field: outcome });
  const unknown = keys.find(key => !ALLOWED_INTENT_FIELDS.has(key));
  if (unknown) return fail(400, 'unknown-intention-field', { field: unknown });
  const axes = {};
  for (const name of ['moveX', 'moveY', 'lookX', 'lookY']) {
    const checked = finiteAxis(value[name], name);
    if (!checked.ok) return checked;
    axes[name] = checked.value;
  }
  for (const name of ['fire', 'special']) if (value[name] != null && typeof value[name] !== 'boolean') return fail(400, name + '-must-be-boolean');
  const buy = value.buy == null || value.buy === '' ? null : value.buy;
  if (buy !== null && buy !== 'small' && buy !== 'big') return fail(400, 'buy-must-be-small-or-big');
  return { ok: true, value: Object.assign(axes, { fire: value.fire === true, special: value.special === true, buy }) };
}
function routeSemanticInput(world, packet, context) {
  const options = context || {};
  const binding = packet && packet.seatId ? options.bindings && options.bindings[packet.seatId] : null;
  const playerId = options.playerId || binding && binding.playerId;
  const player = playerId && world.players[playerId] || playerBySeat(world, packet && packet.seatId);
  if (!player) return fail(404, 'seat-not-active');
  if (!EXTERNAL_TYPES.has(player.kind)) return fail(403, 'seat-cannot-send-input');
  if (player.kind === 'adapter' && player.adapterConsent !== true) return fail(403, 'adapter-consent-revoked');
  if (options.requireToken) {
    if (!binding || !tokensEqual(packet.token, binding.token)) return fail(403, 'seat-token-rejected');
    if (packet.roomCode !== world.room) return fail(409, 'room-binding-rejected');
    if (!Number.isInteger(packet.sequence) || packet.sequence < 0) return fail(400, 'sequence-must-be-nonnegative-integer');
  } else if (player.kind !== 'human') return fail(403, 'legacy-controller-human-only');

  const input = world.inputs[player.id];
  const sequence = options.requireToken ? packet.sequence : input.sequence + 1;
  if (sequence <= input.sequence) return fail(409, 'stale-sequence', { nextSequenceMinimum: input.sequence + 1 });
  const sanitized = sanitizeIntent(packet.intent || {});
  if (!sanitized.ok) return sanitized;
  const now = Number.isFinite(options.now) ? options.now : Date.now();
  input.rateWindow = input.rateWindow.filter(at => now - at < 1000);
  if (input.rateWindow.length >= 40) return fail(429, 'seat-rate-limit');
  input.rateWindow.push(now);
  input.sequence = sequence;
  input.moveX = sanitized.value.moveX;
  input.moveY = sanitized.value.moveY;
  input.lookX = sanitized.value.lookX;
  input.lookY = sanitized.value.lookY;
  input.updatedAt = now;
  player.controllerConnected = true;
  const actions = { fired: false, bought: false };
  if (sanitized.value.fire && typeof options.fireArrow === 'function') actions.fired = options.fireArrow(player, now, sanitized.value.special) === true;
  if (sanitized.value.buy && typeof options.buyMob === 'function') actions.bought = options.buyMob(player, sanitized.value.buy, now) === true;
  return {
    ok: true,
    statusCode: 200,
    gate: AUTHORITY_GATE,
    protocol: INPUT_PROTOCOL,
    player: player.id,
    seatId: player.seatId,
    sequence,
    nextSequenceMinimum: sequence + 1,
    sanitized: sanitized.value,
    actions
  };
}
function buildAdapterObservation(world, request, context) {
  const bindings = context && context.bindings || {};
  const binding = bindings[request && request.seatId];
  const player = binding && world.players[binding.playerId];
  if (!player || player.kind !== 'adapter') return fail(403, 'adapter-seat-required');
  if (player.adapterConsent !== true) return fail(403, 'adapter-consent-revoked');
  if (!tokensEqual(request.token, binding.token)) return fail(403, 'seat-token-rejected');
  if (request.roomCode !== world.room) return fail(409, 'room-binding-rejected');
  const state = context.publicState();
  const self = state.players[player.id];
  const visiblePlayer = item => ({
    id: item.id,
    seatId: item.seatId,
    displayName: item.name,
    controllerType: item.kind,
    color: item.color,
    territory: item.territory,
    x: item.x,
    z: item.z,
    yaw: item.yaw,
    alive: item.alive,
    health: item.health,
    kills: item.kills,
    deaths: item.deaths
  });
  return {
    ok: true,
    schema: OBSERVATION_PROTOCOL,
    scope: 'seat-and-shared-screen-visible-only',
    roomCode: state.room,
    sessionId: String(context.sessionId || ''),
    version: state.version,
    tick: state.tick,
    phase: state.phase,
    mode: state.mode,
    self: {
      ...visiblePlayer(self),
      pitch: self.pitch,
      connected: self.controllerConnected,
      ammo: self.ammo,
      abilityIn: self.abilityIn,
      personalWood: self.wood
    },
    hud: {
      event: state.event,
      winner: state.winner,
      teamScore: state.teamScore,
      combatScore: state.combatScore,
      healthJar: state.healthJar,
      waveIn: state.waveIn,
      giftIn: state.giftIn
    },
    visible: {
      world: { size: state.size, divider: state.divider, woodTarget: state.woodTarget },
      players: Object.values(state.players).map(visiblePlayer),
      trees: state.trees.map(tree => ({ id: tree.id, x: tree.x, z: tree.z, radius: tree.radius, height: tree.height })),
      mobs: state.mobs.map(mob => ({ id: mob.id, name: mob.name, elite: mob.elite, team: mob.team || null, x: mob.x, z: mob.z, health: mob.health, maxHealth: mob.maxHealth, color: mob.color })),
      gifts: state.gifts.map(gift => ({ id: gift.id, owner: gift.owner, x: gift.x, z: gift.z, status: gift.status })),
      arrows: state.arrows.map(arrow => ({ id: arrow.id, owner: arrow.owner, team: arrow.team, x: arrow.x, z: arrow.z, vx: arrow.vx, vz: arrow.vz, piercing: arrow.piercing }))
    },
    controls: {
      protocol: INPUT_PROTOCOL,
      inputEndpoint: '/api/input',
      allowedIntent: {
        moveX: 'number -1..1', moveY: 'number -1..1', lookX: 'number -1..1', lookY: 'number -1..1',
        fire: 'boolean pulse', special: 'boolean with fire', buy: 'small|big|null'
      },
      nextSequenceMinimum: world.inputs[player.id].sequence + 1
    },
    limits: ['No seat tokens', 'No input buffers', 'No bot random state', 'No client-authored position, health, ammo, wood, damage, score or outcome']
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
