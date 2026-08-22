/**
 * Deterministic interpretation of digital input timing.
 *
 * The ActionBus answers "is the action active?". This module answers timing
 * questions such as tap, hold, double-tap, toggle and assisted repeat without
 * tying those behaviors to a keyboard, phone or gamepad.
 */
export class InputBehaviorEngine {
  constructor(registry, options = {}) {
    this.registry = registry;
    this.defaults = {
      tapMaxMs: 260,
      doubleTapWindowMs: 360,
      holdThresholdMs: 420,
      repeatDelayMs: 500,
      repeatIntervalMs: 110,
      ...options.defaults
    };
    this.policies = new Map(Object.entries(options.policies || {}));
    this.states = new Map();
    this.listeners = new Set();
  }

  setPolicy(actionId, policy = {}) {
    if (!this.registry.has(actionId)) throw new Error(`Unknown action: ${actionId}`);
    this.policies.set(actionId, { ...policy });
    return this;
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  ingest(actionEvent, now = actionEvent?.timestamp ?? Date.now()) {
    if (!actionEvent?.id || !this.registry.has(actionEvent.id)) return [];
    const definition = this.registry.get(actionEvent.id);
    if (definition.type !== 'digital') return [];
    const policy = this.#policy(actionEvent.id, definition);
    const state = this.#state(actionEvent.id);
    const output = [];

    if (actionEvent.phase === 'pressed') {
      state.pressed = true;
      state.pressedAt = now;
      state.holdEmitted = false;
      state.nextRepeatAt = now + policy.repeatDelayMs;
      state.sourceId = actionEvent.sourceId;
      output.push(this.#event(actionEvent.id, 'pressed', now, state, actionEvent.sourceId));
      if (policy.toggle) {
        state.toggled = !state.toggled;
        output.push(this.#event(actionEvent.id, 'toggle', now, state, actionEvent.sourceId, { active: state.toggled }));
      }
    } else if (actionEvent.phase === 'released') {
      const heldMs = state.pressed ? Math.max(0, now - state.pressedAt) : 0;
      const sourceId = actionEvent.previousSourceId || state.sourceId || null;
      output.push(this.#event(actionEvent.id, 'released', now, state, sourceId, { heldMs }));
      if (state.pressed && heldMs <= policy.tapMaxMs) {
        const isDouble = Number.isFinite(state.lastTapAt) && now - state.lastTapAt <= policy.doubleTapWindowMs;
        output.push(this.#event(actionEvent.id, 'tap', now, state, sourceId, { heldMs }));
        if (isDouble) {
          output.push(this.#event(actionEvent.id, 'double-tap', now, state, sourceId, { intervalMs: now - state.lastTapAt }));
          state.lastTapAt = null;
        } else state.lastTapAt = now;
      }
      state.pressed = false;
      state.sourceId = null;
      state.nextRepeatAt = null;
    }

    return this.#publish(output);
  }

  tick(now = Date.now()) {
    const output = [];
    for (const [actionId, state] of this.states.entries()) {
      if (!state.pressed) continue;
      const definition = this.registry.get(actionId);
      const policy = this.#policy(actionId, definition);
      const heldMs = Math.max(0, now - state.pressedAt);

      if (policy.hold && !state.holdEmitted && heldMs >= policy.holdThresholdMs) {
        state.holdEmitted = true;
        output.push(this.#event(actionId, 'hold', now, state, state.sourceId, { heldMs }));
      }
      if (policy.repeat && Number.isFinite(state.nextRepeatAt) && now >= state.nextRepeatAt) {
        const due = 1 + Math.floor((now - state.nextRepeatAt) / policy.repeatIntervalMs);
        const capped = Math.min(due, policy.maxRepeatsPerTick);
        for (let index = 0; index < capped; index++) {
          output.push(this.#event(actionId, 'repeat', state.nextRepeatAt + index * policy.repeatIntervalMs, state, state.sourceId, { heldMs }));
        }
        state.nextRepeatAt += due * policy.repeatIntervalMs;
      }
    }
    return this.#publish(output);
  }

  getToggle(actionId) { return Boolean(this.#state(actionId).toggled); }

  reset(actionId = null) {
    if (actionId) this.states.delete(actionId);
    else this.states.clear();
  }

  #policy(actionId, definition) {
    const override = this.policies.get(actionId) || {};
    const declared = new Set(definition.behavior || []);
    return {
      ...this.defaults,
      hold: override.hold ?? declared.has('hold'),
      repeat: override.repeat ?? declared.has('repeat'),
      toggle: override.toggle ?? declared.has('toggle'),
      maxRepeatsPerTick: 4,
      ...override
    };
  }

  #state(actionId) {
    if (!this.states.has(actionId)) {
      this.states.set(actionId, {
        pressed: false,
        pressedAt: 0,
        holdEmitted: false,
        nextRepeatAt: null,
        lastTapAt: null,
        toggled: false,
        sourceId: null
      });
    }
    return this.states.get(actionId);
  }

  #event(id, behavior, timestamp, state, sourceId, extra = {}) {
    return { id, behavior, timestamp, sourceId, toggled: state.toggled, ...extra };
  }

  #publish(events) {
    for (const event of events) for (const listener of this.listeners) listener(event);
    return events;
  }
}
