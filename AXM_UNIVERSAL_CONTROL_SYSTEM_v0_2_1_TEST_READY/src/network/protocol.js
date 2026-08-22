export const PROTOCOL_VERSION = 'axm-input/0.1';
export const INPUT_FRAME_LIMITS = Object.freeze({
  maxActions: 64,
  maxDeviceIdLength: 80,
  maxPlayerIdLength: 20,
  maxContextLength: 60,
  maxSequence: Number.MAX_SAFE_INTEGER
});

export function createInputFrame({ deviceId, playerId, sequence, actions, fullState = true, context = 'gameplay', clientSentAt = Date.now() }) {
  const frame = {
    protocol: PROTOCOL_VERSION,
    type: 'input_frame',
    deviceId,
    playerId: playerId || null,
    sequence,
    clientSentAt,
    context,
    fullState: Boolean(fullState),
    actions: Array.isArray(actions) ? actions.map(action => ({ id: action.id, value: structuredClone(action.value) })) : actions
  };
  const errors = validateInputFrame(frame);
  if (errors.length) throw new Error(`Invalid input frame: ${errors.join('; ')}`);
  return frame;
}

export function validateInputFrame(frame, options = {}) {
  const limits = { ...INPUT_FRAME_LIMITS, ...(options.limits || {}) };
  const errors = [];
  if (!frame || typeof frame !== 'object' || Array.isArray(frame)) return ['frame must be an object'];
  if (frame.protocol !== PROTOCOL_VERSION) errors.push('unsupported protocol');
  if (frame.type !== 'input_frame') errors.push('type must be input_frame');
  if (!isBoundedString(frame.deviceId, 1, limits.maxDeviceIdLength)) errors.push('deviceId is invalid');
  if (frame.playerId !== null && frame.playerId !== undefined && !isBoundedString(frame.playerId, 1, limits.maxPlayerIdLength)) errors.push('playerId is invalid');
  if (!Number.isSafeInteger(frame.sequence) || frame.sequence < 0 || frame.sequence > limits.maxSequence) errors.push('sequence is invalid');
  if (!Number.isFinite(frame.clientSentAt) || frame.clientSentAt < 0) errors.push('clientSentAt is invalid');
  if (typeof frame.fullState !== 'boolean') errors.push('fullState must be boolean');
  if (!isBoundedString(frame.context, 1, limits.maxContextLength)) errors.push('context is invalid');
  if (!Array.isArray(frame.actions)) return [...errors, 'actions must be an array'];
  if (frame.actions.length > limits.maxActions) errors.push(`actions exceeds ${limits.maxActions}`);

  const seen = new Set();
  for (const [index, action] of frame.actions.entries()) {
    if (!action || typeof action !== 'object' || Array.isArray(action)) {
      errors.push(`action ${index} must be an object`);
      continue;
    }
    const id = String(action.id || '');
    if (!/^[A-Z][A-Z0-9_]*$/.test(id)) errors.push(`invalid action id ${id || '<empty>'}`);
    if (seen.has(id)) errors.push(`duplicate action id ${id}`);
    seen.add(id);
    const valueError = validateActionValue(action.value);
    if (valueError) errors.push(`action ${id || index}: ${valueError}`);
    if (options.registry?.has && id && !options.registry.has(id)) errors.push(`unknown action id ${id}`);
  }
  return errors;
}

export function validateActionValue(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? null : 'number must be finite';
  if (typeof value === 'boolean') return null;
  if (typeof value === 'string') return value.length <= 256 ? null : 'text value is too long';
  if (!value || typeof value !== 'object' || Array.isArray(value)) return 'value must be a number, boolean, short string, or axis object';
  const keys = Object.keys(value);
  if (!keys.length || keys.some(key => !['x', 'y'].includes(key))) return 'axis object only supports x and y';
  if ('x' in value && !Number.isFinite(value.x)) return 'axis x must be finite';
  if ('y' in value && !Number.isFinite(value.y)) return 'axis y must be finite';
  return null;
}

function isBoundedString(value, min, max) {
  return typeof value === 'string' && value.length >= min && value.length <= max;
}
