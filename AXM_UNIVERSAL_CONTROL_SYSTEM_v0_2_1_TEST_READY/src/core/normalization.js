export function clamp(value, min = -1, max = 1) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.max(min, Math.min(max, number));
}

export function applyDeadZone1D(value, inner = 0.12, outer = 1, curve = 1) {
  const sign = Math.sign(value);
  const magnitude = Math.abs(clamp(value));
  if (magnitude <= inner) return 0;
  const usable = Math.max(0.0001, outer - inner);
  const normalized = clamp((magnitude - inner) / usable, 0, 1);
  return sign * Math.pow(normalized, Math.max(0.1, curve));
}

export function normalizeStick(x, y, options = {}) {
  const inner = Number.isFinite(options.inner) ? options.inner : 0.12;
  const outer = Number.isFinite(options.outer) ? options.outer : 1;
  const sensitivity = Number.isFinite(options.sensitivity) ? options.sensitivity : 1;
  const curve = Number.isFinite(options.curve) ? options.curve : 1;
  const snap = Number.isFinite(options.snapDirections) ? Math.max(0, Math.floor(options.snapDirections)) : 0;

  let nx = clamp(x);
  let ny = clamp(y);
  const rawMagnitude = Math.hypot(nx, ny);
  if (rawMagnitude <= inner) return { x: 0, y: 0, magnitude: 0 };

  const direction = Math.atan2(ny, nx);
  const usable = Math.max(0.0001, outer - inner);
  let magnitude = clamp((Math.min(rawMagnitude, outer) - inner) / usable, 0, 1);
  magnitude = clamp(Math.pow(magnitude, Math.max(0.1, curve)) * sensitivity, 0, 1);

  let angle = direction;
  if (snap >= 2 && magnitude > 0) {
    const step = (Math.PI * 2) / snap;
    angle = Math.round(direction / step) * step;
  }
  nx = Math.cos(angle) * magnitude;
  ny = Math.sin(angle) * magnitude;
  return { x: nx, y: ny, magnitude };
}

export function valuesEqual(a, b, epsilon = 0.0005) {
  if (typeof a === 'number' && typeof b === 'number') return Math.abs(a - b) <= epsilon;
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    return Math.abs((a.x || 0) - (b.x || 0)) <= epsilon &&
      Math.abs((a.y || 0) - (b.y || 0)) <= epsilon;
  }
  return a === b;
}

export function neutralValue(type) {
  if (type === 'axis2' || type === 'pointer') return { x: 0, y: 0 };
  return 0;
}

export function sanitizeValue(definition, value) {
  const type = definition?.type || 'digital';
  if (type === 'axis2' || type === 'pointer') {
    const input = value && typeof value === 'object' ? value : {};
    return { x: clamp(input.x), y: clamp(input.y) };
  }
  if (type === 'digital') return value ? 1 : 0;
  if (type === 'trigger') return clamp(value, 0, 1);
  if (type === 'axis1') return clamp(value, -1, 1);
  if (type === 'text') return String(value ?? '');
  return value;
}
