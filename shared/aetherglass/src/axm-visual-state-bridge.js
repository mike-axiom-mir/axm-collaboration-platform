/*
 * AXM Visual State Bridge v7.1.0
 * Explicitly maps semantic platform events to scenes, light, field, or interaction
 * responses. It never inspects platform content and does nothing until start(),
 * dispatch(), or apply() is called.
 */
(function attachAXMVisualStateBridge(global) {
  "use strict";

  const VERSION = "7.1.0";
  const NAME_PATTERN = /^[a-z0-9][a-z0-9-_]{0,63}$/i;
  const DEFAULTS = Object.freeze({
    prefix: "axmvisualstate:",
    useDefaults: true,
    autoStart: false,
    scenes: null,
    lighting: null,
    interactions: null,
    field: null,
    mappings: null
  });

  const DEFAULT_MAPPINGS = Object.freeze({
    command: { scene: "aether-command" },
    focus: { scene: "eclipse-focus" },
    create: { scene: "solar-forge" },
    review: { scene: "frost-sanctuary" },
    live: { scene: "living-network" },
    showcase: { scene: "celestial-orbit" },
    portal: { scene: "phantom-portal" },
    luxury: { scene: "auric-throne" },
    immersive: { scene: "oceanic-depths" },
    spectacle: { scene: "ultraviolet-horizon" },
    quiet: { scene: "quiet-operations" },
    success: {
      temporaryScene: "nebula-celebration",
      duration: 2200,
      celebrate: { particles: 32, size: 920, strength: .78 }
    },
    warning: {
      pulse: { color: "var(--axm-warning)", strength: .52, size: 720, duration: 820 }
    },
    error: {
      pulse: { color: "var(--axm-danger)", strength: .62, size: 760, duration: 900 }
    },
    restore: { restore: true }
  });

  function clonePlain(value) {
    if (!value || typeof value !== "object") return value;
    if (value.nodeType === 1) return value;
    if (Array.isArray(value)) return value.map(clonePlain);
    const output = {};
    for (const [key, item] of Object.entries(value)) output[key] = clonePlain(item);
    return output;
  }

  function normalizeName(value) {
    const name = String(value || "").trim();
    if (!NAME_PATTERN.test(name)) throw new Error("Visual state names must be 1–64 letters, numbers, dashes, or underscores.");
    return name;
  }

  function resolveElement(target, root, documentRef) {
    if (target?.nodeType === 1) return target;
    if (typeof target === "string") {
      try { return root.querySelector?.(target) || documentRef.querySelector?.(target) || null; }
      catch (_) { return null; }
    }
    return null;
  }

  class AXMVisualStateBridge {
    constructor(engine, options = {}) {
      if (!engine?.root) throw new Error("AXMVisualStateBridge requires a mounted AXMVisualEngine instance.");
      this.engine = engine;
      this.root = options.root || engine.root;
      this.document = engine.document || global.document;
      this.options = { ...DEFAULTS, ...options };
      this.prefix = String(this.options.prefix || DEFAULTS.prefix);
      this.scenes = this.options.scenes || null;
      this.lighting = this.options.lighting || null;
      this.interactions = this.options.interactions || null;
      this.field = this.options.field || null;
      this.mappings = new Map();
      this.listeners = new Map();
      this.started = false;
      this.last = null;

      if (this.options.useDefaults !== false) {
        for (const [name, definition] of Object.entries(DEFAULT_MAPPINGS)) {
          this.mappings.set(name, clonePlain(definition));
        }
      }
      if (this.options.mappings && typeof this.options.mappings === "object") {
        for (const [name, definition] of Object.entries(this.options.mappings)) {
          this.register(name, definition, { replace: true });
        }
      }
      if (this.options.autoStart) this.start();
    }

    static mount(engine, options = {}) {
      return new AXMVisualStateBridge(engine, { ...options, autoStart: false }).start();
    }

    static get defaults() {
      return Object.keys(DEFAULT_MAPPINGS);
    }

    connect({ scenes, lighting, interactions, field } = {}) {
      if (scenes !== undefined) this.scenes = scenes;
      if (lighting !== undefined) this.lighting = lighting;
      if (interactions !== undefined) this.interactions = interactions;
      if (field !== undefined) this.field = field;
      return this;
    }

    register(name, definition, options = {}) {
      const key = normalizeName(name);
      if (!definition || typeof definition !== "object" || Array.isArray(definition)) {
        throw new Error("A visual state mapping must be an object.");
      }
      if (this.mappings.has(key) && options.replace !== true) throw new Error(`Visual state already exists: ${key}`);
      this.mappings.set(key, clonePlain(definition));
      if (this.started) this._attach(key);
      this._emit("registered", { state: key });
      return key;
    }

    unregister(name) {
      const key = String(name || "");
      this._detach(key);
      const removed = this.mappings.delete(key);
      if (removed) this._emit("unregistered", { state: key });
      return removed;
    }

    list() {
      return Array.from(this.mappings.entries()).map(([name, definition]) => ({
        name,
        definition: clonePlain(definition),
        default: Object.prototype.hasOwnProperty.call(DEFAULT_MAPPINGS, name)
      }));
    }

    start() {
      if (this.started) return this;
      this.started = true;
      for (const name of this.mappings.keys()) this._attach(name);
      this._emit("started", this.getState());
      return this;
    }

    stop() {
      if (!this.started) return this;
      for (const name of Array.from(this.listeners.keys())) this._detach(name);
      this.started = false;
      this._emit("stopped", this.getState());
      return this;
    }

    dispatch(name, detail = {}) {
      const key = normalizeName(name);
      const event = new global.CustomEvent(`${this.prefix}${key}`, { detail });
      this.root.dispatchEvent(event);
      return event;
    }

    apply(name, detail = {}) {
      const key = String(name || "");
      const definition = this.mappings.get(key);
      if (!definition) return { applied: false, state: key, actions: [], reason: "unknown-state" };

      const actions = [];
      const target = resolveElement(detail.target || definition.target, this.root, this.document) || this.root;

      if (definition.restore && this.scenes?.restore) {
        actions.push({ type: "restore", applied: Boolean(this.scenes.restore({ transitionDuration: definition.transitionDuration })) });
      }

      if (definition.temporaryScene && this.scenes?.applyTemporary) {
        const duration = Number(detail.duration ?? definition.duration ?? 2200);
        actions.push({
          type: "temporary-scene",
          name: definition.temporaryScene,
          applied: Boolean(this.scenes.applyTemporary(definition.temporaryScene, duration, { transitionDuration: definition.transitionDuration }))
        });
      } else if (definition.scene && this.scenes?.apply) {
        actions.push({
          type: "scene",
          name: definition.scene,
          applied: Boolean(this.scenes.apply(definition.scene, { transitionDuration: definition.transitionDuration }))
        });
      }

      if (definition.engine && this.engine?.applyConfig) {
        const result = this.engine.applyConfig(definition.engine, { persist: false });
        actions.push({ type: "engine", applied: true, rejected: result.rejected });
      }

      if (definition.field && this.field) {
        const fieldConfig = definition.field;
        if (fieldConfig.preset !== undefined) this.field.setPreset(fieldConfig.preset);
        if (fieldConfig.density !== undefined) this.field.setDensity(fieldConfig.density);
        if (fieldConfig.energy !== undefined) this.field.setEnergy(fieldConfig.energy);
        if (fieldConfig.speed !== undefined) this.field.setSpeed(fieldConfig.speed);
        if (fieldConfig.interactive !== undefined) this.field.setInteractive(fieldConfig.interactive);
        actions.push({ type: "field", applied: true });
      }

      if (definition.group && this.lighting?.setGroupEnabled) {
        const enabled = detail.enabled ?? definition.enabled ?? true;
        const count = this.lighting.setGroupEnabled(definition.group, enabled);
        actions.push({ type: "light-group", group: definition.group, enabled: Boolean(enabled), count });
      }

      if (definition.pulse && this.lighting?.pulseAt) {
        const pulse = definition.pulse === true ? {} : definition.pulse;
        actions.push({ type: "pulse", applied: Boolean(this.lighting.pulseAt(target, { ...pulse, ...(detail.pulse || {}) })) });
      }

      if (definition.celebrate && this.interactions?.celebrate) {
        const celebrate = definition.celebrate === true ? {} : definition.celebrate;
        actions.push({ type: "celebrate", applied: Boolean(this.interactions.celebrate(target, { ...celebrate, ...(detail.celebrate || {}) })) });
      } else if (definition.attention && this.interactions?.attention) {
        const attention = definition.attention === true ? {} : definition.attention;
        actions.push({ type: "attention", applied: Boolean(this.interactions.attention(target, { ...attention, ...(detail.attention || {}) })) });
      }

      if (definition.burst && this.field?.burstAt) {
        const burst = definition.burst === true ? {} : definition.burst;
        const count = this.field.burstAt(target, { ...burst, ...(detail.burst || {}) });
        actions.push({ type: "burst", applied: Boolean(count), count: count || 0 });
      }

      const applied = actions.some((action) => action.applied !== false);
      const report = { applied, state: key, actions, localOnly: true, telemetry: false };
      this.last = report;
      this._emit("applied", report);
      return report;
    }

    getState() {
      return {
        version: VERSION,
        started: this.started,
        prefix: this.prefix,
        mappings: this.mappings.size,
        connected: {
          scenes: Boolean(this.scenes),
          lighting: Boolean(this.lighting),
          interactions: Boolean(this.interactions),
          field: Boolean(this.field)
        },
        lastState: this.last?.state || null,
        localOnly: true,
        telemetry: false
      };
    }

    destroy() {
      this.stop();
      this.mappings.clear();
      this.last = null;
      this._emit("destroyed", { version: VERSION });
    }

    _attach(name) {
      if (this.listeners.has(name)) return;
      const handler = (event) => this.apply(name, event.detail || {});
      this.listeners.set(name, handler);
      this.root.addEventListener(`${this.prefix}${name}`, handler);
    }

    _detach(name) {
      const handler = this.listeners.get(name);
      if (!handler) return;
      this.root.removeEventListener(`${this.prefix}${name}`, handler);
      this.listeners.delete(name);
    }

    _emit(name, detail) {
      if (!this.root || typeof global.CustomEvent !== "function") return;
      this.root.dispatchEvent(new global.CustomEvent(`axmvisualbridge:${name}`, { detail }));
    }
  }

  global.AXMVisualStateBridge = AXMVisualStateBridge;
})(typeof window !== "undefined" ? window : globalThis);
