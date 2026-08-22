export class LayoutEditor {
  constructor(container, options = {}) {
    this.container = container;
    this.enabled = false;
    this.onSave = options.onSave || (() => {});
    this.active = null;
    this.pointerId = null;
    this.offset = null;
    container.addEventListener('pointerdown', event => this.#down(event));
    container.addEventListener('pointermove', event => this.#move(event));
    container.addEventListener('pointerup', event => this.#up(event));
    container.addEventListener('pointercancel', event => this.#up(event));
  }

  setEnabled(value) {
    this.enabled = Boolean(value);
    this.container.classList.toggle('layout-editing', this.enabled);
  }

  apply(layout = {}) {
    for (const [id, position] of Object.entries(layout)) {
      const control = this.container.querySelector(`[data-control-id="${CSS.escape(id)}"]`);
      if (!control) continue;
      control.style.left = `${position.x}%`;
      control.style.top = `${position.y}%`;
      control.style.right = 'auto';
      control.style.bottom = 'auto';
      control.style.transform = 'translate(-50%, -50%)';
    }
  }

  snapshot() {
    const containerRect = this.container.getBoundingClientRect();
    const layout = {};
    for (const control of this.container.querySelectorAll('[data-control-id]')) {
      const rect = control.getBoundingClientRect();
      layout[control.dataset.controlId] = {
        x: ((rect.left + rect.width / 2 - containerRect.left) / containerRect.width) * 100,
        y: ((rect.top + rect.height / 2 - containerRect.top) / containerRect.height) * 100
      };
    }
    return layout;
  }

  #down(event) {
    if (!this.enabled) return;
    const control = event.target.closest('[data-control-id]');
    if (!control) return;
    event.preventDefault();
    this.active = control;
    this.pointerId = event.pointerId;
    control.setPointerCapture?.(event.pointerId);
    const rect = control.getBoundingClientRect();
    this.offset = { x: event.clientX - rect.left - rect.width / 2, y: event.clientY - rect.top - rect.height / 2 };
  }

  #move(event) {
    if (!this.enabled || event.pointerId !== this.pointerId || !this.active) return;
    event.preventDefault();
    const rect = this.container.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width, event.clientX - rect.left - this.offset.x));
    const y = Math.max(0, Math.min(rect.height, event.clientY - rect.top - this.offset.y));
    this.active.style.left = `${(x / rect.width) * 100}%`;
    this.active.style.top = `${(y / rect.height) * 100}%`;
    this.active.style.right = 'auto';
    this.active.style.bottom = 'auto';
    this.active.style.transform = 'translate(-50%, -50%)';
  }

  #up(event) {
    if (event.pointerId !== this.pointerId) return;
    this.active = null;
    this.pointerId = null;
    this.onSave(this.snapshot());
  }
}
