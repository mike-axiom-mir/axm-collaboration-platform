/*
 * AXM Cue Sequencer v7.1.0
 * Explicit finite visual choreography for lights, fields, scenes, and interactions.
 * No arbitrary code execution, no background monitoring, no hidden state inference.
 */
(function attachAXMCueSequencer(global) {
  "use strict";

  const VERSION = "7.1.0";
  const MAX_CUES = 48;
  const MAX_DURATION = 30000;
  const ACTIONS = new Set(["pulse", "sweep", "burst", "scene", "attention", "field", "engine", "group"]);

  const BUILT_INS = Object.freeze({
    awakening: {
      label: "Awakening",
      duration: 2800,
      cues: [
        { at: 0, action: "field", preset: "motes", density: .34, energy: .42, speed: .24 },
        { at: 120, action: "sweep", duration: 1100, strength: .24 },
        { at: 520, action: "pulse", target: "$target", size: 760, strength: .42, duration: 1100 },
        { at: 900, action: "burst", target: "$target", count: 24, strength: .72 },
        { at: 1500, action: "attention", target: "$target", duration: 900, particles: 14 }
      ]
    },
    verification: {
      label: "Verification",
      duration: 1800,
      cues: [
        { at: 0, action: "pulse", target: "$target", color: "var(--axm-positive)", size: 620, strength: .52, duration: 900 },
        { at: 120, action: "burst", target: "$target", count: 18, strength: .62, colorIndex: 0 },
        { at: 540, action: "sweep", color: "var(--axm-positive)", duration: 850, strength: .22 }
      ]
    },
    showcase: {
      label: "Showcase",
      duration: 4200,
      cues: [
        { at: 0, action: "scene", name: "celestial-orbit" },
        { at: 360, action: "sweep", color: "var(--axm-lux)", duration: 1300, strength: .35 },
        { at: 900, action: "pulse", target: "$target", color: "var(--axm-accent-1)", size: 980, strength: .48, duration: 1300 },
        { at: 1250, action: "burst", target: "$target", count: 34, strength: 1.0 },
        { at: 2100, action: "pulse", target: "$target", color: "var(--axm-lux)", size: 720, strength: .38, duration: 1200 }
      ]
    },
    "portal-open": {
      label: "Portal Open",
      duration: 3200,
      cues: [
        { at: 0, action: "scene", name: "phantom-portal" },
        { at: 240, action: "field", preset: "warp", density: .62, energy: .74, speed: .78 },
        { at: 520, action: "pulse", target: "$target", size: 1100, strength: .54, duration: 1400 },
        { at: 900, action: "sweep", duration: 1500, strength: .32 },
        { at: 1450, action: "burst", target: "$target", count: 38, strength: 1.12 }
      ]
    },
    "quiet-reset": {
      label: "Quiet Reset",
      duration: 900,
      cues: [
        { at: 0, action: "field", preset: "off", density: 0, energy: 0, speed: 0 },
        { at: 40, action: "scene", name: "quiet-operations" }
      ]
    }
  });

  function clamp(value, min, max, fallback = min) {
    const number = Number(value);
    return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function validateSequence(name, sequence) {
    const key = String(name || "").trim().toLowerCase();
    if (!/^[a-z0-9][a-z0-9-_]{1,63}$/.test(key)) throw new Error("Cue sequence names must be 2–64 lowercase letters, numbers, dashes, or underscores.");
    if (!sequence || typeof sequence !== "object" || Array.isArray(sequence)) throw new Error("Cue sequence must be an object.");
    const cues = Array.isArray(sequence.cues) ? sequence.cues : [];
    if (!cues.length || cues.length > MAX_CUES) throw new Error(`Cue sequence must contain 1–${MAX_CUES} cues.`);
    const normalized = cues.map((cue, index) => {
      if (!cue || typeof cue !== "object" || Array.isArray(cue)) throw new Error(`Cue ${index + 1} must be an object.`);
      if (!ACTIONS.has(cue.action)) throw new Error(`Unsupported cue action: ${cue.action}`);
      return { ...clone(cue), at: clamp(cue.at, 0, MAX_DURATION, 0) };
    }).sort((a, b) => a.at - b.at);
    const duration = clamp(sequence.duration, normalized.at(-1).at, MAX_DURATION, normalized.at(-1).at + 500);
    return {
      label: String(sequence.label || key).slice(0, 80),
      description: String(sequence.description || "Finite Aetherglass cue sequence.").slice(0, 240),
      duration,
      cues: normalized
    };
  }

  class AXMCueSequencer {
    constructor(engine, options = {}) {
      if (!engine?.root) throw new Error("AXMCueSequencer requires a mounted AXMVisualEngine instance.");
      this.engine = engine;
      this.root = engine.root;
      this.field = options.field || null;
      this.lighting = options.lighting || null;
      this.scenes = options.scenes || null;
      this.interactions = options.interactions || null;
      this.sequences = new Map(Object.entries(BUILT_INS).map(([name, sequence]) => [name, { ...clone(sequence), builtIn: true }]));
      this.active = null;
      this.timers = [];
      this.token = 0;
      this.destroyed = false;
      this._completion = null;
      this._resolveCompletion = null;
    }

    static get version() { return VERSION; }
    static get sequences() { return Object.keys(BUILT_INS); }

    connect(options = {}) {
      if (options.field !== undefined) this.field = options.field;
      if (options.lighting !== undefined) this.lighting = options.lighting;
      if (options.scenes !== undefined) this.scenes = options.scenes;
      if (options.interactions !== undefined) this.interactions = options.interactions;
      return this;
    }

    register(name, sequence, options = {}) {
      const normalized = validateSequence(name, sequence);
      const key = String(name).trim().toLowerCase();
      if (this.sequences.has(key) && options.replace !== true) throw new Error(`Cue sequence already exists: ${key}`);
      this.sequences.set(key, { ...normalized, builtIn: false });
      this._emit("registered", { name: key });
      return key;
    }

    unregister(name) {
      const sequence = this.sequences.get(name);
      if (!sequence || sequence.builtIn) return false;
      const removed = this.sequences.delete(name);
      if (removed) this._emit("unregistered", { name });
      return removed;
    }

    list() {
      return Array.from(this.sequences.entries()).map(([name, sequence]) => ({
        name,
        label: sequence.label,
        description: sequence.description || "Finite Aetherglass cue sequence.",
        duration: sequence.duration,
        cues: sequence.cues.length,
        builtIn: Boolean(sequence.builtIn)
      }));
    }

    play(name, options = {}) {
      if (this.destroyed) return Promise.resolve({ completed: false, reason: "destroyed" });
      const sequence = this.sequences.get(name);
      if (!sequence) return Promise.resolve({ completed: false, reason: "unknown-sequence" });
      this.stop("replaced");

      const token = ++this.token;
      const state = this.engine.getState?.() || {};
      const speed = clamp(options.speed, .2, 4, 1);
      const motionFactor = state.motion === "off" ? 0 : (state.motion === "reduced" ? .25 : 1);
      const factor = motionFactor / speed;
      const target = options.target || null;
      this.active = name;
      this.root.classList.add("axm-choreography-active");
      this._emit("started", { name, duration: sequence.duration * factor, cues: sequence.cues.length });

      this._completion = new Promise((resolve) => {
        this._resolveCompletion = resolve;
        for (const cue of sequence.cues) {
          const timer = global.setTimeout(() => {
            if (this.destroyed || token !== this.token || this.active !== name) return;
            const report = this._executeCue(cue, target);
            this._emit("cue", { name, cue: clone(cue), report });
          }, Math.round(cue.at * factor));
          this.timers.push(timer);
        }

        const finishTimer = global.setTimeout(() => {
          if (token !== this.token || this.destroyed) return resolve({ completed: false, reason: "cancelled", name });
          this.active = null;
          this.timers = [];
          this.root.classList.remove("axm-choreography-active");
          const result = { completed: true, name, cues: sequence.cues.length };
          this._emit("completed", result);
          this._resolveCompletion = null;
          resolve(result);
        }, Math.round(sequence.duration * factor) + 34);
        this.timers.push(finishTimer);
      });
      return this._completion;
    }

    stop(reason = "stopped") {
      if (!this.active && !this.timers.length) return false;
      const previous = this.active;
      this.token += 1;
      for (const timer of this.timers) global.clearTimeout(timer);
      this.timers = [];
      this.active = null;
      this.root.classList.remove("axm-choreography-active");
      const resolve = this._resolveCompletion;
      this._resolveCompletion = null;
      resolve?.({ completed: false, reason, name: previous });
      this._emit("stopped", { name: previous, reason });
      return true;
    }

    getState() {
      return {
        version: VERSION,
        active: this.active,
        timers: this.timers.length,
        sequences: this.sequences.size,
        connected: {
          field: Boolean(this.field),
          lighting: Boolean(this.lighting),
          scenes: Boolean(this.scenes),
          interactions: Boolean(this.interactions)
        },
        destroyed: this.destroyed,
        localOnly: true,
        telemetry: false
      };
    }

    destroy() {
      if (this.destroyed) return this;
      this.stop("destroyed");
      this.destroyed = true;
      this._emit("destroyed", { version: VERSION });
      return this;
    }

    _executeCue(cue, defaultTarget) {
      const target = cue.target === "$target" ? defaultTarget : (cue.target || defaultTarget);
      switch (cue.action) {
        case "pulse":
          return Boolean(this.lighting?.pulseAt?.(target || { x: global.innerWidth / 2, y: global.innerHeight / 2 }, cue));
        case "sweep":
          return Boolean(this.lighting?.sweep?.(cue));
        case "burst":
          return this.field?.burstAt?.(target, cue) || 0;
        case "scene":
          return Boolean(this.scenes?.apply?.(cue.name, { persist: false, transitionDuration: cue.transitionDuration ?? 0 }));
        case "attention":
          return Boolean(this.interactions?.attention?.(target, cue));
        case "field":
          if (!this.field) return false;
          if (cue.preset !== undefined) this.field.setPreset(cue.preset);
          if (cue.density !== undefined) this.field.setDensity(cue.density);
          if (cue.energy !== undefined) this.field.setEnergy(cue.energy);
          if (cue.speed !== undefined) this.field.setSpeed(cue.speed);
          return true;
        case "engine":
          return Boolean(this.engine.applyConfig?.(cue.config || {}, { persist: false }));
        case "group":
          return Boolean(this.lighting?.setGroupEnabled?.(cue.group || "default", cue.enabled !== false));
        default:
          return false;
      }
    }

    _emit(name, detail) {
      if (!this.root || typeof global.CustomEvent !== "function") return;
      this.root.dispatchEvent(new global.CustomEvent(`axmcues:${name}`, { detail }));
    }
  }

  global.AXMCueSequencer = AXMCueSequencer;
})(typeof window !== "undefined" ? window : globalThis);
