'use strict';

const PROTOCOL_VERSION = 'axm-input/0.1';
const LIMITS = Object.freeze({ maxActions: 64, maxDeviceIdLength: 80, maxPlayerIdLength: 20, maxContextLength: 60 });

function validateInputFrame(frame, options = {}) {
  const errors = [];
  if (!frame || typeof frame !== 'object' || Array.isArray(frame)) return ['frame must be an object'];
  if (frame.protocol !== PROTOCOL_VERSION) errors.push('unsupported protocol');
  if (frame.type !== 'input_frame') errors.push('type must be input_frame');
  if (!bounded(frame.deviceId, 1, LIMITS.maxDeviceIdLength)) errors.push('deviceId is invalid');
  if (frame.playerId != null && !bounded(frame.playerId, 1, LIMITS.maxPlayerIdLength)) errors.push('playerId is invalid');
  if (!Number.isSafeInteger(frame.sequence) || frame.sequence < 0) errors.push('sequence is invalid');
  if (!Number.isFinite(frame.clientSentAt) || frame.clientSentAt < 0) errors.push('clientSentAt is invalid');
  if (typeof frame.fullState !== 'boolean') errors.push('fullState must be boolean');
  if (!bounded(frame.context, 1, LIMITS.maxContextLength)) errors.push('context is invalid');
  if (!Array.isArray(frame.actions)) return [...errors, 'actions must be an array'];
  if (frame.actions.length > LIMITS.maxActions) errors.push(`actions exceeds ${LIMITS.maxActions}`);
  const seen = new Set();
  for (const action of frame.actions) {
    const id = String(action?.id || '');
    if (!/^[A-Z][A-Z0-9_]*$/.test(id)) errors.push(`invalid action id ${id || '<empty>'}`);
    if (seen.has(id)) errors.push(`duplicate action id ${id}`);
    seen.add(id);
    if (options.allowedActionIds && id && !options.allowedActionIds.has(id)) errors.push(`unknown action id ${id}`);
    const valueError = validateValue(action?.value);
    if (valueError) errors.push(`action ${id || '<empty>'}: ${valueError}`);
  }
  return errors;
}

function validateValue(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? null : 'number must be finite';
  if (typeof value === 'boolean') return null;
  if (typeof value === 'string') return value.length <= 256 ? null : 'text value is too long';
  if (!value || typeof value !== 'object' || Array.isArray(value)) return 'invalid value';
  const keys = Object.keys(value);
  if (!keys.length || keys.some(key => !['x','y'].includes(key))) return 'axis object only supports x and y';
  if ('x' in value && !Number.isFinite(value.x)) return 'axis x must be finite';
  if ('y' in value && !Number.isFinite(value.y)) return 'axis y must be finite';
  return null;
}
function bounded(value,min,max){ return typeof value === 'string' && value.length >= min && value.length <= max; }

module.exports = { PROTOCOL_VERSION, LIMITS, validateInputFrame };
