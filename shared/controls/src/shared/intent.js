'use strict';

const DEFAULT_INTENT_SPEC = Object.freeze({
  vectorPairs: Object.freeze([
    Object.freeze({ xField: 'moveX', yField: 'moveY' }),
    Object.freeze({ xField: 'aimX', yField: 'aimY' }),
  ]),
  booleanFields: Object.freeze([
    'aimActive', 'action', 'attack', 'fire', 'sprint', 'brake',
  ]),
  pulseFields: Object.freeze(['action', 'fire']),
});

function isPlainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function clamp(value, minimum, maximum) {
  const number = Number(value);
  if (!Number.isFinite(number)) return Math.min(maximum, Math.max(minimum, 0));
  return Math.min(maximum, Math.max(minimum, number));
}

function safeFieldName(value) {
  return typeof value === 'string' && /^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(value);
}

function normalizeVector(xValue, yValue) {
  const x = clamp(xValue, -1, 1);
  const y = clamp(yValue, -1, 1);
  const magnitude = Math.hypot(x, y);
  if (magnitude <= 1) return { x, y };
  return { x: x / magnitude, y: y / magnitude };
}

function normalizeIntentSpec(spec = DEFAULT_INTENT_SPEC) {
  const vectorPairs = (Array.isArray(spec.vectorPairs) ? spec.vectorPairs : DEFAULT_INTENT_SPEC.vectorPairs)
    .filter((pair) => pair && safeFieldName(pair.xField) && safeFieldName(pair.yField))
    .map((pair) => ({ xField: pair.xField, yField: pair.yField }));
  const booleanFields = [...new Set(
    (Array.isArray(spec.booleanFields) ? spec.booleanFields : DEFAULT_INTENT_SPEC.booleanFields)
      .filter(safeFieldName),
  )];
  const pulseFields = [...new Set(
    (Array.isArray(spec.pulseFields) ? spec.pulseFields : DEFAULT_INTENT_SPEC.pulseFields)
      .filter((field) => booleanFields.includes(field)),
  )];
  if (!vectorPairs.length) throw new Error('At least one valid vector pair is required.');
  return { vectorPairs, booleanFields, pulseFields };
}

function createIntentSanitizer(spec = DEFAULT_INTENT_SPEC) {
  const normalizedSpec = normalizeIntentSpec(spec);
  const sanitize = (raw = {}) => {
    if (!isPlainObject(raw)) raw = {};
    const clean = {};
    for (const pair of normalizedSpec.vectorPairs) {
      const vector = normalizeVector(raw[pair.xField], raw[pair.yField]);
      clean[pair.xField] = vector.x;
      clean[pair.yField] = vector.y;
    }
    for (const field of normalizedSpec.booleanFields) clean[field] = raw[field] === true;
    return clean;
  };
  sanitize.spec = normalizedSpec;
  return sanitize;
}

const sanitizeDefaultIntent = createIntentSanitizer(DEFAULT_INTENT_SPEC);

function validateInputPacket(packet, options = {}) {
  const errors = [];
  if (!isPlainObject(packet)) return { ok: false, errors: ['packet-object-required'] };
  const maxIdentityLength = Number.isSafeInteger(options.maxIdentityLength) ? options.maxIdentityLength : 160;
  const identity = (value) => typeof value === 'string' && value.length > 0 && value.length <= maxIdentityLength;
  if (!identity(packet.roomCode ?? packet.room)) errors.push('invalid-room');
  if (!identity(packet.sessionId)) errors.push('invalid-session');
  if (!identity(packet.seatId)) errors.push('invalid-seat');
  if (!identity(packet.token)) errors.push('invalid-token');
  if (!Number.isSafeInteger(packet.seq) || packet.seq < 0) errors.push('invalid-sequence');
  if (!isPlainObject(packet.input)) errors.push('invalid-input');
  return { ok: errors.length === 0, errors };
}

module.exports = {
  DEFAULT_INTENT_SPEC,
  clamp,
  createIntentSanitizer,
  isPlainObject,
  normalizeIntentSpec,
  normalizeVector,
  sanitizeDefaultIntent,
  validateInputPacket,
};
