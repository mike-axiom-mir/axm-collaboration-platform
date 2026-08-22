import { normalizeStick } from '../core/normalization.js';

export class VirtualStick {
  constructor(root, options = {}) {
    this.root = root;
    this.knob = root.querySelector('[data-stick-knob]');
    this.floating = options.floating ?? true;
    this.deadZone = options.deadZone ?? 0.12;
    this.sensitivity = options.sensitivity ?? 1;
    this.snapDirections = options.snapDirections ?? 0;
    this.onChange = options.onChange || (() => {});
    this.pointerId = null;
    this.origin = null;
    this.defaultCenter = null;
    this.enabled = true;

    root.addEventListener('pointerdown', event => this.#down(event));
    root.addEventListener('pointermove', event => this.#move(event));
    root.addEventListener('pointerup', event => this.#up(event));
    root.addEventListener('pointercancel', event => this.#up(event));
  }

  configure(options = {}) {
    if (Number.isFinite(options.deadZone)) this.deadZone = options.deadZone;
    if (Number.isFinite(options.sensitivity)) this.sensitivity = options.sensitivity;
    if (Number.isFinite(options.snapDirections)) this.snapDirections = options.snapDirections;
    if (typeof options.floating === 'boolean') this.floating = options.floating;
  }

  release() {
    this.pointerId = null;
    this.origin = null;
    this.knob.style.transform = 'translate(-50%, -50%)';
    this.root.classList.remove('active');
    this.onChange({ x: 0, y: 0, magnitude: 0 });
  }

  #down(event) {
    if (!this.enabled || this.pointerId !== null) return;
    event.preventDefault();
    this.pointerId = event.pointerId;
    this.root.setPointerCapture?.(event.pointerId);
    const rect = this.root.getBoundingClientRect();
    this.defaultCenter = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    this.origin = this.floating ? { x: event.clientX, y: event.clientY } : this.defaultCenter;
    this.root.classList.add('active');
    this.#apply(event);
  }

  #move(event) {
    if (event.pointerId !== this.pointerId) return;
    event.preventDefault();
    this.#apply(event);
  }

  #up(event) {
    if (event.pointerId !== this.pointerId) return;
    event.preventDefault();
    this.release();
  }

  #apply(event) {
    const rect = this.root.getBoundingClientRect();
    const radius = Math.max(20, rect.width * 0.38);
    const dx = event.clientX - this.origin.x;
    const dy = event.clientY - this.origin.y;
    const raw = { x: dx / radius, y: dy / radius };
    const normalized = normalizeStick(raw.x, raw.y, {
      inner: this.deadZone,
      sensitivity: this.sensitivity,
      snapDirections: this.snapDirections
    });
    const visualMagnitude = Math.min(1, Math.hypot(raw.x, raw.y));
    const angle = Math.atan2(raw.y, raw.x);
    this.knob.style.transform = `translate(calc(-50% + ${Math.cos(angle) * visualMagnitude * radius}px), calc(-50% + ${Math.sin(angle) * visualMagnitude * radius}px))`;
    this.onChange(normalized);
  }
}
