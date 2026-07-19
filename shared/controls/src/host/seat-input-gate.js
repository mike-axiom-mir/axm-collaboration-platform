'use strict';

const crypto = require('node:crypto');
const {
  createIntentSanitizer,
  validateInputPacket,
} = require('../shared/intent');

function tokensEqual(left, right) {
  if (typeof left !== 'string' || typeof right !== 'string') return false;
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function toArray(collection) {
  if (!collection) return [];
  if (Array.isArray(collection)) return collection;
  if (collection instanceof Map) return [...collection.values()];
  if (typeof collection === 'object') return Object.values(collection);
  return [];
}

function sessionActors(session) {
  return toArray(session?.actors ?? session?.world?.actors);
}

function findSeatActor(session, seatId) {
  return sessionActors(session).find((actor) => actor?.seatId === seatId) || null;
}

const HUMAN_INPUT_SOURCES = new Set(['phone-touch', 'keyboard', 'host-gamepad', 'device-gamepad']);

function bindHumanInputSource(actor, inputSource, options = {}) {
  if (!actor || actor.controller !== 'human') throw new TypeError('an occupied human actor is required.');
  if (!HUMAN_INPUT_SOURCES.has(inputSource)) throw new RangeError('unsupported human input source.');
  const previousEpoch = Number.isSafeInteger(actor.inputSourceBinding?.epoch)
    ? actor.inputSourceBinding.epoch
    : -1;
  const epoch = previousEpoch + 1;
  const id = typeof options.bindingId === 'string' && options.bindingId.length > 0
    ? options.bindingId
    : crypto.randomUUID();
  if (id.length > 160) throw new RangeError('input-source binding id is too long.');
  neutralizeActorInput(actor, options.sanitizeIntent);
  actor.inputSequence = -1;
  actor.inputSourceBinding = {
    id,
    epoch,
    inputSource,
    status: 'active',
    claimedAt: Number.isFinite(options.now) ? options.now : Date.now(),
  };
  return { ...actor.inputSourceBinding };
}

function revokeHumanInputSource(actor, options = {}) {
  if (!actor || actor.controller !== 'human') throw new TypeError('an occupied human actor is required.');
  neutralizeActorInput(actor, options.sanitizeIntent);
  actor.inputSequence = -1;
  actor.connected = false;
  if (actor.inputSourceBinding) actor.inputSourceBinding = { ...actor.inputSourceBinding, status: 'revoked' };
  return actor.inputSourceBinding ? { ...actor.inputSourceBinding } : null;
}

function createSeatInputGate(options = {}) {
  if (typeof options.getSession !== 'function') throw new TypeError('getSession(sessionId) is required.');
  const sanitizeIntent = options.sanitizeIntent || createIntentSanitizer(options.intentSpec);
  const pulseFields = [...new Set(options.pulseFields || sanitizeIntent.spec?.pulseFields || [])];
  const externalControllerKinds = new Set(options.externalControllerKinds || ['human', 'adapter']);
  const runningStatus = options.runningStatus || 'running';

  function route(packet, now = Date.now()) {
    const validation = validateInputPacket(packet, options.validation);
    if (!validation.ok) {
      return { ok: false, statusCode: 400, reason: 'malformed-input', errors: validation.errors };
    }
    const session = options.getSession(packet.sessionId);
    if (!session || session.status !== runningStatus) {
      return { ok: false, statusCode: 404, reason: 'session-not-running' };
    }
    if ((packet.roomCode ?? packet.room) !== session.roomCode) {
      return { ok: false, statusCode: 403, reason: 'room-session-mismatch' };
    }
    const actor = findSeatActor(session, packet.seatId);
    if (!actor) return { ok: false, statusCode: 404, reason: 'seat-not-active' };
    if (!externalControllerKinds.has(actor.controller)) {
      return { ok: false, statusCode: 403, reason: 'seat-host-controlled' };
    }
    const expectedToken = session.seatTokens?.[packet.seatId];
    if (!tokensEqual(packet.token, expectedToken)) {
      return { ok: false, statusCode: 403, reason: 'seat-token-rejected' };
    }
    const sourceBinding = actor.inputSourceBinding;
    if (sourceBinding) {
      if (sourceBinding.status !== 'active') {
        return { ok: false, statusCode: 409, reason: 'input-source-binding-inactive' };
      }
      if (packet.inputSourceBindingId !== sourceBinding.id || packet.inputSourceEpoch !== sourceBinding.epoch) {
        return {
          ok: false,
          statusCode: 409,
          reason: 'input-source-binding-rejected',
          inputSourceEpoch: sourceBinding.epoch,
        };
      }
    }
    const acceptedSequence = Number.isSafeInteger(actor.inputSequence) ? actor.inputSequence : -1;
    if (packet.seq <= acceptedSequence) {
      return {
        ok: false,
        statusCode: 409,
        reason: 'stale-input-sequence',
        acceptedSeq: acceptedSequence,
      };
    }

    const nextInput = sanitizeIntent(packet.input);
    actor.inputHeld ||= {};
    actor.pendingPulses ||= {};
    for (const field of pulseFields) {
      const held = nextInput[field] === true;
      if (actor.alive !== false && held && actor.inputHeld[field] !== true) {
        actor.pendingPulses[field] = true;
      }
      actor.inputHeld[field] = held;
      nextInput[field] = actor.alive !== false && actor.pendingPulses[field] === true;
    }
    actor.input = nextInput;
    actor.inputSequence = packet.seq;
    actor.lastInputAt = now;
    actor.connected = true;

    if (Array.isArray(session.players)) {
      const player = session.players.find((candidate) => candidate?.seatId === actor.seatId);
      if (player) player.connected = true;
    }
    options.onAccepted?.({ session, actor, input: nextInput, now });
    return {
      ok: true,
      actorId: actor.id,
      seatId: actor.seatId,
      controller: actor.controller,
      acceptedSeq: actor.inputSequence,
      tick: session.world?.tick ?? session.tick ?? null,
      inputSource: sourceBinding?.inputSource ?? null,
      inputSourceEpoch: sourceBinding?.epoch ?? null,
    };
  }

  return {
    externalControllerKinds,
    pulseFields,
    route,
    sanitizeIntent,
  };
}

function consumePulse(actor, field) {
  if (!actor?.pendingPulses?.[field]) return false;
  actor.pendingPulses[field] = false;
  if (actor.input) actor.input[field] = false;
  return true;
}

function neutralizeActorInput(actor, sanitizeIntent = createIntentSanitizer()) {
  if (!actor) return;
  actor.input = sanitizeIntent({});
  actor.inputHeld = {};
  actor.pendingPulses = {};
}

function disconnectIdleSeats(session, timeoutMs, now = Date.now(), sanitizeIntent) {
  const disconnected = [];
  for (const actor of sessionActors(session)) {
    if (!['human', 'adapter'].includes(actor.controller)) continue;
    if (!Number.isFinite(actor.lastInputAt) || now - actor.lastInputAt <= timeoutMs) continue;
    actor.connected = false;
    neutralizeActorInput(actor, sanitizeIntent);
    disconnected.push(actor.seatId);
  }
  return disconnected;
}

module.exports = {
  HUMAN_INPUT_SOURCES,
  bindHumanInputSource,
  consumePulse,
  createSeatInputGate,
  disconnectIdleSeats,
  findSeatActor,
  neutralizeActorInput,
  revokeHumanInputSource,
  sessionActors,
  tokensEqual,
};
