'use strict';

const { MAX_SEATS, SEAT_TYPES, TACTICAL_ACTIONS, CHOICES } = require('./constants');

function boundedText(value, max = 80) {
  if (typeof value !== 'string') return null;
  const clean = value.replace(/[\u0000-\u001f\u007f]/g, '').trim();
  return clean ? clean.slice(0, max) : null;
}

function clamp(value, min, max) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(min, Math.min(max, number)) : 0;
}

function normalizedVector(x, y) {
  let nx = clamp(x, -1, 1), ny = clamp(y, -1, 1);
  const length = Math.hypot(nx, ny);
  if (length > 1) { nx /= length; ny /= length; }
  return { x: nx, y: ny };
}

function sanitizeIntent(raw) {
  const source = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const move = normalizedVector(source.moveX, source.moveY);
  const out = { moveX: move.x, moveY: move.y, moveActive: source.moveActive === true };
  for (const pulse of ['scan','connect','deploy','assist','recover','return','build','interact']) out[pulse] = source[pulse] === true;
  if (TACTICAL_ACTIONS.includes(source.tacticalAction)) out.tacticalAction = source.tacticalAction;
  if (CHOICES.includes(source.choice)) out.choice = source.choice;
  for (const field of ['targetId','recipeId','orderId','vote']) {
    const clean = boundedText(source[field], 80);
    if (clean) out[field] = clean;
  }
  return out;
}

function validateSeatRecord(record) {
  const errors = [];
  const slot = Number(record && (record.slot || String(record.seat_id || '').replace(/\D/g, '')));
  const type = record && (record.type || record.controllerType);
  if (!Number.isInteger(slot) || slot < 1 || slot > MAX_SEATS) errors.push('invalid-slot');
  if (!SEAT_TYPES.includes(type)) errors.push('invalid-seat-type');
  return { ok: !errors.length, errors, slot, type };
}

function validatePartyLayout(records) {
  const errors = [];
  if (!Array.isArray(records) || records.length < 1 || records.length > MAX_SEATS) return { ok: false, errors: ['occupied-seat-count-must-be-1-to-8'] };
  const seen = new Set();
  records.forEach(record => {
    const result = validateSeatRecord(record);
    errors.push(...result.errors);
    if (seen.has(result.slot)) errors.push('duplicate-slot-' + result.slot);
    seen.add(result.slot);
  });
  return { ok: !errors.length, errors };
}

function validateInputPacket(packet) {
  const errors = [];
  if (!packet || typeof packet !== 'object' || Array.isArray(packet)) return { ok: false, errors: ['packet-object-required'] };
  for (const key of ['roomCode','sessionId','seatId','token']) if (!boundedText(packet[key], 160)) errors.push('invalid-' + key);
  if (!Number.isSafeInteger(packet.seq) || packet.seq < 0) errors.push('invalid-sequence');
  if (!packet.input || typeof packet.input !== 'object' || Array.isArray(packet.input)) errors.push('invalid-input');
  const allowedTop = new Set(['roomCode','sessionId','seatId','token','seq','input']);
  for (const key of Object.keys(packet)) if (!allowedTop.has(key)) errors.push('unknown-packet-field-' + key);
  return { ok: !errors.length, errors };
}

module.exports = { boundedText, clamp, normalizedVector, sanitizeIntent, validateSeatRecord, validatePartyLayout, validateInputPacket };
