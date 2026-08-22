import { normalizeStick, applyDeadZone1D } from '../core/normalization.js';

const STANDARD_BUTTONS = Object.freeze({
  south: 0,
  east: 1,
  west: 2,
  north: 3,
  leftBumper: 4,
  rightBumper: 5,
  leftTrigger: 6,
  rightTrigger: 7,
  view: 8,
  menu: 9,
  leftStickButton: 10,
  rightStickButton: 11,
  dpadUp: 12,
  dpadDown: 13,
  dpadLeft: 14,
  dpadRight: 15,
  home: 16
});

export const STANDARD_GAMEPAD_CONTROLS = Object.freeze([
  'leftStick', 'rightStick', 'dpad', ...Object.keys(STANDARD_BUTTONS)
]);

export const DEFAULT_GAMEPAD_LAYOUT = Object.freeze({
  MOVE: 'leftStick',
  AIM: 'rightStick',
  PRIMARY_ACTION: 'south',
  DODGE: 'east',
  INTERACT: 'west',
  USE_ITEM: 'north',
  OPEN_MENU: 'menu',
  ACCELERATE: 'rightTrigger',
  BRAKE: 'leftTrigger'
});

function buttonValue(pad, index) {
  const button = pad.buttons?.[index];
  if (!button) return 0;
  if (Number.isFinite(button.value)) return Math.max(button.pressed ? 1 : 0, Math.max(0, Math.min(1, button.value)));
  return button.pressed ? 1 : 0;
}

function largerValue(a, b) {
  if ((a && typeof a === 'object') || (b && typeof b === 'object')) {
    const aMagnitude = a && typeof a === 'object' ? Math.hypot(a.x || 0, a.y || 0) : Math.abs(Number(a) || 0);
    const bMagnitude = b && typeof b === 'object' ? Math.hypot(b.x || 0, b.y || 0) : Math.abs(Number(b) || 0);
    return bMagnitude > aMagnitude ? b : a;
  }
  return Math.abs(Number(b) || 0) > Math.abs(Number(a) || 0) ? b : a;
}

/**
 * Browser Gamepad API -> semantic action adapter.
 *
 * The adapter consumes the same controllerLayout object stored in a game
 * profile. Games never inspect axes, button numbers, or controller brands.
 * String bindings use the W3C standard-gamepad layout; legacy numeric button
 * and [axisX, axisY] mappings remain supported for v0.2 integrations.
 */
export class GamepadAdapter {
  constructor(bus, options = {}) {
    this.bus = bus;
    this.sourceId = options.sourceId || `gamepad:${options.index ?? 0}`;
    this.index = options.index ?? 0;
    this.deadZone = options.deadZone ?? 0.14;
    this.outerDeadZone = options.outerDeadZone ?? 0.98;
    this.digitalThreshold = options.digitalThreshold ?? 0.5;
    this.allowNonStandard = options.allowNonStandard ?? false;
    this.onStatus = typeof options.onStatus === 'function' ? options.onStatus : null;
    this.mapping = structuredClone(options.controllerLayout || options.mapping || DEFAULT_GAMEPAD_LAYOUT);
    this.running = false;
    this.frameHandle = null;
    this.sequence = 0;
    this.statusKey = '';
    this.gestureState = new Map();
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.#poll();
  }

  stop() {
    this.running = false;
    if (this.frameHandle != null) globalThis.cancelAnimationFrame?.(this.frameHandle);
    this.frameHandle = null;
    this.gestureState.clear();
    this.bus.releaseSource(this.sourceId);
    this.#setStatus('stopped', null);
  }

  sample(pad) {
    if (!pad) {
      this.gestureState.clear();
      this.bus.releaseSource(this.sourceId);
      this.#setStatus('disconnected', null);
      return null;
    }
    if (pad.mapping !== 'standard' && !this.allowNonStandard) {
      this.gestureState.clear();
      this.bus.releaseSource(this.sourceId);
      this.#setStatus('unsupported', pad, 'Controller does not expose the standard browser mapping');
      return null;
    }

    const actions = [];
    for (const [actionId, binding] of Object.entries(this.mapping)) {
      const value = this.#readBinding(pad, binding, `${actionId}:root`);
      actions.push({ id: actionId, value: this.#coerceForAction(actionId, value) });
    }
    const frame = {
      sequence: this.sequence++,
      timestamp: pad.timestamp || globalThis.performance?.now?.() || Date.now(),
      fullState: true,
      actions
    };
    this.bus.applyFrame(this.sourceId, frame, {
      deviceType: 'gamepad',
      priority: 3,
      gamepadIndex: this.index,
      gamepadMapping: pad.mapping || 'none'
    });
    this.#setStatus('connected', pad);
    return frame;
  }

  #poll = () => {
    if (!this.running) return;
    let pad = null;
    try { pad = globalThis.navigator?.getGamepads?.()?.[this.index] || null; }
    catch (error) { this.#setStatus('error', null, error.message); }
    this.sample(pad);
    this.frameHandle = globalThis.requestAnimationFrame?.(this.#poll) ?? null;
  };

  #readBinding(pad, binding, stateKey) {
    if (Array.isArray(binding)) {
      if (binding.length === 2 && binding.every(Number.isInteger)) return this.#readStick(pad, binding[0], binding[1]);
      return binding.reduce((value, alternative, index) => {
        return largerValue(value, this.#readBinding(pad, alternative, `${stateKey}:${index}`));
      }, 0);
    }
    if (Number.isInteger(binding)) return buttonValue(pad, binding);
    if (typeof binding === 'string') return this.#readControl(pad, binding);
    if (!binding || typeof binding !== 'object') return 0;

    const control = binding.control || binding.input;
    const value = this.#readControl(pad, control);
    if (binding.gesture !== 'release') return value;

    const magnitude = value && typeof value === 'object'
      ? Math.hypot(value.x || 0, value.y || 0)
      : Math.abs(Number(value) || 0);
    const threshold = Number.isFinite(binding.threshold) ? binding.threshold : 0.55;
    const releaseThreshold = Number.isFinite(binding.releaseThreshold)
      ? Math.min(threshold, binding.releaseThreshold)
      : Math.max(this.deadZone, threshold * 0.55);
    const armed = this.gestureState.get(stateKey) === true;
    if (magnitude >= threshold) {
      this.gestureState.set(stateKey, true);
      return 0;
    }
    if (armed && magnitude <= releaseThreshold) {
      this.gestureState.set(stateKey, false);
      return 1;
    }
    return 0;
  }

  #readControl(pad, control) {
    if (control === 'leftStick') return this.#readStick(pad, 0, 1);
    if (control === 'rightStick') return this.#readStick(pad, 2, 3);
    if (control === 'dpad') {
      return {
        x: buttonValue(pad, STANDARD_BUTTONS.dpadRight) - buttonValue(pad, STANDARD_BUTTONS.dpadLeft),
        y: buttonValue(pad, STANDARD_BUTTONS.dpadDown) - buttonValue(pad, STANDARD_BUTTONS.dpadUp)
      };
    }
    const buttonMatch = /^button(\d+)$/.exec(String(control || ''));
    if (buttonMatch) return buttonValue(pad, Number(buttonMatch[1]));
    if (Object.hasOwn(STANDARD_BUTTONS, control)) return buttonValue(pad, STANDARD_BUTTONS[control]);
    return 0;
  }

  #readStick(pad, xIndex, yIndex) {
    return normalizeStick(pad.axes?.[xIndex] || 0, pad.axes?.[yIndex] || 0, {
      inner: this.deadZone,
      outer: this.outerDeadZone
    });
  }

  #coerceForAction(actionId, value) {
    const type = this.bus.registry?.get?.(actionId)?.type;
    if (type === 'digital') {
      if (value && typeof value === 'object') return Math.hypot(value.x || 0, value.y || 0) >= this.digitalThreshold ? 1 : 0;
      return Number(value) >= this.digitalThreshold ? 1 : 0;
    }
    if (type === 'trigger') return applyDeadZone1D(value, 0.05, 1);
    return value;
  }

  #setStatus(state, pad, reason = null) {
    const detail = {
      state,
      sourceId: this.sourceId,
      index: this.index,
      id: pad?.id || null,
      mapping: pad?.mapping || null,
      reason
    };
    const key = JSON.stringify(detail);
    if (key === this.statusKey) return;
    this.statusKey = key;
    this.onStatus?.(detail);
  }
}
