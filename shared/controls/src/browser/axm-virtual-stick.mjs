const DEFAULT_STICK_PROFILE = Object.freeze({
  deadZone: 0.14,
  responseExponent: 1.12,
  minimumRadius: 34,
  radiusRatio: 0.32,
  tapThreshold: 0.18,
});

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

export function normalizeRadialInput(rawX, rawY, profile = DEFAULT_STICK_PROFILE) {
  const deadZone = clamp(Number(profile.deadZone) || 0, 0, 0.9);
  const exponent = Math.max(0.25, Number(profile.responseExponent) || 1);
  const x = Number.isFinite(Number(rawX)) ? Number(rawX) : 0;
  const y = Number.isFinite(Number(rawY)) ? Number(rawY) : 0;
  const rawMagnitude = Math.hypot(x, y);
  if (rawMagnitude <= deadZone) return { x: 0, y: 0, magnitude: 0, rawMagnitude };
  const directionX = x / rawMagnitude;
  const directionY = y / rawMagnitude;
  const normalizedMagnitude = clamp(
    (Math.min(1, rawMagnitude) - deadZone) / (1 - deadZone),
    0,
    1,
  );
  const magnitude = Math.pow(normalizedMagnitude, exponent);
  return {
    x: directionX * magnitude,
    y: directionY * magnitude,
    magnitude,
    rawMagnitude,
  };
}

export class AxmVirtualStick {
  constructor(options = {}) {
    if (!options.element || !options.base || !options.knob) {
      throw new TypeError('element, base, and knob are required.');
    }
    this.element = options.element;
    this.base = options.base;
    this.knob = options.knob;
    this.profile = { ...DEFAULT_STICK_PROFILE, ...(options.profile || {}) };
    this.floating = options.floating !== false;
    this.onChange = options.onChange || (() => {});
    this.onRelease = options.onRelease || (() => {});
    this.pointerId = null;
    this.enabled = true;
    this.origin = null;
    this.lastState = { x: 0, y: 0, magnitude: 0, rawMagnitude: 0, active: false };
    this.handlers = {
      down: (event) => this.pointerDown(event),
      move: (event) => this.pointerMove(event),
      up: (event) => this.pointerUp(event),
      cancel: (event) => this.pointerUp(event, true),
    };
    this.element.addEventListener('pointerdown', this.handlers.down);
    this.element.addEventListener('pointermove', this.handlers.move);
    this.element.addEventListener('pointerup', this.handlers.up);
    this.element.addEventListener('pointercancel', this.handlers.cancel);
  }

  radius() {
    const bounds = this.element.getBoundingClientRect();
    return Math.max(
      this.profile.minimumRadius,
      Math.min(bounds.width, bounds.height) * this.profile.radiusRatio,
    );
  }

  localPoint(event) {
    const bounds = this.element.getBoundingClientRect();
    return { x: event.clientX - bounds.left, y: event.clientY - bounds.top, bounds };
  }

  setBasePosition(point = null) {
    if (!point) {
      this.base.style.left = '50%';
      this.base.style.top = '50%';
      return null;
    }
    const x = clamp(point.x, 0, point.bounds.width);
    const y = clamp(point.y, 0, point.bounds.height);
    this.base.style.left = `${x}px`;
    this.base.style.top = `${y}px`;
    return { x, y };
  }

  pointerDown(event) {
    if (!this.enabled || this.pointerId !== null || event.button > 0) return;
    event.preventDefault();
    this.pointerId = event.pointerId;
    const point = this.localPoint(event);
    this.origin = this.floating
      ? this.setBasePosition(point)
      : { x: point.bounds.width / 2, y: point.bounds.height / 2 };
    this.element.classList.add('active');
    this.element.setPointerCapture?.(event.pointerId);
    this.updateFromPointer(event);
  }

  pointerMove(event) {
    if (event.pointerId !== this.pointerId) return;
    event.preventDefault();
    this.updateFromPointer(event);
  }

  updateFromPointer(event) {
    const point = this.localPoint(event);
    const radius = this.radius();
    const dx = point.x - this.origin.x;
    const dy = point.y - this.origin.y;
    const rawLength = Math.hypot(dx, dy);
    const visualScale = rawLength > radius ? radius / rawLength : 1;
    this.knob.style.transform = `translate(${dx * visualScale}px, ${dy * visualScale}px)`;
    const normalized = normalizeRadialInput(dx / radius, dy / radius, this.profile);
    this.lastState = { ...normalized, active: true };
    this.onChange(this.lastState);
  }

  pointerUp(event, cancelled = false) {
    if (event.pointerId !== this.pointerId) return;
    event.preventDefault();
    const released = {
      ...this.lastState,
      active: false,
      cancelled,
      tapped: !cancelled && this.lastState.rawMagnitude <= this.profile.tapThreshold,
    };
    this.pointerId = null;
    this.origin = null;
    this.knob.style.transform = 'translate(0, 0)';
    if (this.floating) this.setBasePosition();
    this.element.classList.remove('active');
    this.onRelease(released);
    this.lastState = { x: 0, y: 0, magnitude: 0, rawMagnitude: 0, active: false };
    this.onChange(this.lastState);
  }

  reset() {
    this.pointerId = null;
    this.origin = null;
    this.lastState = { x: 0, y: 0, magnitude: 0, rawMagnitude: 0, active: false };
    this.knob.style.transform = 'translate(0, 0)';
    this.setBasePosition();
    this.element.classList.remove('active');
    this.onChange(this.lastState);
  }

  setEnabled(enabled) {
    const nextEnabled = enabled === true;
    if (this.enabled === nextEnabled) return;
    this.enabled = nextEnabled;
    this.element.classList.toggle('axm-disabled', !this.enabled);
    this.element.setAttribute('aria-disabled', String(!this.enabled));
    if (!this.enabled) this.reset();
  }

  destroy() {
    this.element.removeEventListener('pointerdown', this.handlers.down);
    this.element.removeEventListener('pointermove', this.handlers.move);
    this.element.removeEventListener('pointerup', this.handlers.up);
    this.element.removeEventListener('pointercancel', this.handlers.cancel);
    this.reset();
  }
}

export const AXM_GAME_NIGHT_CONTROL_PROFILE = DEFAULT_STICK_PROFILE;

