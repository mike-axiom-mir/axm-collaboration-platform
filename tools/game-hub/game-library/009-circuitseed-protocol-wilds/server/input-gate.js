'use strict';

const crypto = require('node:crypto');
const { PULSE_FIELDS, TACTICAL_ACTIONS } = require('../shared/constants');
const { sanitizeIntent, validateInputPacket } = require('../shared/validation');

const ALLOWED_INPUT_FIELDS = new Set([
  'moveX','moveY','moveActive','scan','connect','deploy','assist','recover','return','build','interact',
  'tacticalAction','choice','targetId','recipeId','orderId','vote'
]);
const OUTCOME_FIELDS = new Set(['damage','hit','reward','currency','position','teleport','missionComplete','inventory','ownership','score','worldState','hostAction']);

function tokensEqual(supplied, expected) {
  if (typeof supplied !== 'string' || typeof expected !== 'string') return false;
  const a = Buffer.from(supplied), b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function inspectFields(input) {
  for (const key of Object.keys(input || {})) {
    if (OUTCOME_FIELDS.has(key)) return { ok: false, statusCode: 400, reason: 'machine-or-outcome-action-rejected', field: key };
    if (!ALLOWED_INPUT_FIELDS.has(key)) return { ok: false, statusCode: 400, reason: 'unknown-intention-field', field: key };
  }
  if (input && input.tacticalAction && !TACTICAL_ACTIONS.includes(input.tacticalAction)) return { ok: false, statusCode: 400, reason: 'unknown-tactical-action' };
  return { ok: true };
}

function routeInput(session, packet, now = Date.now()) {
  const validation = validateInputPacket(packet);
  if (!validation.ok) return { ok: false, statusCode: 400, reason: validation.errors.join(',') };
  const fieldCheck = inspectFields(packet.input);
  if (!fieldCheck.ok) return fieldCheck;
  if (!session || session.status !== 'running') return { ok: false, statusCode: 404, reason: 'session-not-running' };
  if (packet.roomCode !== session.roomCode || packet.sessionId !== session.id) return { ok: false, statusCode: 403, reason: 'room-session-mismatch' };
  const actor = session.actors[packet.seatId];
  if (!actor || !actor.occupied || actor.active === false) return { ok: false, statusCode: 404, reason: 'seat-not-active' };
  if (actor.controllerType === 'ai') return { ok: false, statusCode: 403, reason: 'seat-host-controlled' };
  if (!['human','adapter'].includes(actor.controllerType)) return { ok: false, statusCode: 403, reason: 'seat-cannot-send-input' };
  if (actor.controllerType === 'adapter' && actor.adapterConsent !== true) return { ok: false, statusCode: 403, reason: 'adapter-consent-revoked' };
  if (!tokensEqual(packet.token, session.seatTokens[actor.seatId])) return { ok: false, statusCode: 403, reason: 'seat-token-rejected' };
  if (packet.seq <= actor.inputSequence) return { ok: false, statusCode: 409, reason: 'stale-sequence', nextSequenceMinimum: actor.inputSequence + 1 };

  actor.rateWindow = (actor.rateWindow || []).filter(at => now - at < 1000);
  if (actor.rateWindow.length >= 30) return { ok: false, statusCode: 429, reason: 'seat-rate-limit' };
  actor.rateWindow.push(now);

  const intent = sanitizeIntent(packet.input);
  actor.pendingPulses = actor.pendingPulses || {};
  actor.inputHeld = actor.inputHeld || {};
  for (const field of PULSE_FIELDS) {
    const pressed = intent[field] === true;
    if (pressed && actor.inputHeld[field] !== true) actor.pendingPulses[field] = true;
    actor.inputHeld[field] = pressed;
    delete intent[field];
  }
  if (intent.tacticalAction) actor.pendingTacticalAction = { action: intent.tacticalAction, targetId: intent.targetId || null };
  actor.input = intent;
  actor.inputSequence = packet.seq;
  actor.lastInputAt = now;
  actor.connected = true;
  return { ok: true, statusCode: 200, acceptedSequence: packet.seq, actorId: actor.id, sanitized: JSON.parse(JSON.stringify(intent)) };
}

function consumePulse(actor, field) {
  if (!actor || !actor.pendingPulses || actor.pendingPulses[field] !== true) return false;
  delete actor.pendingPulses[field]; return true;
}

function revokeAdapterConsent(session, seatId) {
  const actor = session && session.actors[seatId];
  if (!actor || actor.controllerType !== 'adapter') return { ok: false, reason: 'adapter-seat-not-found' };
  actor.adapterConsent = false; actor.input = {}; actor.inputHeld = {}; actor.pendingPulses = {}; actor.pendingTacticalAction = null;
  return { ok: true, seatId, status: 'paused', replacementCreated: false };
}

module.exports = { ALLOWED_INPUT_FIELDS, consumePulse, inspectFields, revokeAdapterConsent, routeInput, tokensEqual };
