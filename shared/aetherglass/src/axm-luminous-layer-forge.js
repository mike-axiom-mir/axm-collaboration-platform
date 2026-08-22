/*
 * AXM Luminous Layer Forge v7.1.0
 * Optional compositable light planes with bounded motion, quality, and contrast policies.
 */
(function attachAXMLuminousLayerForge(global) {
  "use strict";

  const VERSION = "7.1.0";
  const LAYERS = Object.freeze(["halo", "crown", "aurora", "prism", "caustics", "refraction"]);
  const LAYER_SET = new Set(LAYERS);
  const COST = Object.freeze({ halo: 1, crown: 1, aurora: 2, prism: 2, caustics: 3, refraction: 1 });
  const PRESETS = Object.freeze({
    off: Object.freeze({
      label: "Off",
      description: "No forged light planes.",
      layers: Object.freeze([]), intensity: 0, depth: 0
    }),
    "quiet-aura": Object.freeze({
      label: "Quiet Aura",
      description: "A restrained focal halo and crystalline edge lift for daily screens.",
      layers: Object.freeze(["halo", "refraction"]), intensity: .42, depth: .48
    }),
    "sovereign-aurora": Object.freeze({
      label: "Sovereign Aurora",
      description: "Balanced crown light, responsive bloom, spectral ribbons, and edge refraction.",
      layers: Object.freeze(["halo", "crown", "aurora", "refraction"]), intensity: .74, depth: .82
    }),
    "prismatic-cathedral": Object.freeze({
      label: "Prismatic Cathedral",
      description: "The full six-plane cinematic stack for showcases and hero moments.",
      layers: Object.freeze(LAYERS), intensity: .92, depth: 1.08
    }),
    "neon-sanctum": Object.freeze({
      label: "Neon Sanctum",
      description: "Deeper spectral bloom with prismatic glass and restrained horizon light.",
      layers: Object.freeze(["halo", "aurora", "prism", "refraction"]), intensity: .84, depth: .94
    }),
    "event-horizon": Object.freeze({
      label: "Event Horizon",
      description: "Dark crown geometry, caustic energy, and a focused rim of light.",
      layers: Object.freeze(["halo", "crown", "caustics", "refraction"]), intensity: .78, depth: 1.18
    })
  });
  const DEFAULTS = Object.freeze({
    preset: "sovereign-aurora",
    intensity: null,
    depth: null,
    reactive: true,
    respectReducedMotion: true,
    policy: "adaptive"
  });

  function clamp(value, min, max, fallback = min) {
    const number = Number(value);
    return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
  }

  function uniqueLayers(values) {
    if (!Array.isArray(values)) return [];
    return Array.from(new Set(values.filter((value) => LAYER_SET.has(value))));
  }

  function resolveTarget(target, root, documentRef) {
    let element = target;
    if (typeof target === "string") {
      try { element = documentRef.querySelector(target); } catch (_) { return null; }
    }
    return element && root.contains(element) ? element : null;
  }

  class AXMLuminousLayerForge {
    constructor(engine, options = {}) {
      if (!engine?.root || !engine?.mounted) {
        throw new Error("AXMLuminousLayerForge requires a mounted AXMVisualEngine instance.");
      }
      this.engine = engine;
      this.root = engine.root;
      this.document = engine.document || global.document;
      this.options = { ...DEFAULTS, ...options };
      this.stage = null;
      this.nodes = new Map();
      this.layers = new Set();
      this.preset = "off";
      this.intensity = 0;
      this.depth = 0;
      this.reactive = Boolean(this.options.reactive);
      this.mounted = false;
      this.destroyed = false;
      this._timers = new Set();
      this._transients = new Set();
      this._priorRootAttributes = new Map();
      this._handlers = { policy: () => this._syncPolicy() };
    }

    static mount(engine, options = {}) {
      return new AXMLuminousLayerForge(engine, options).mount();
    }

    static get version() { return VERSION; }
    static get layers() { return [...LAYERS]; }
    static get presets() { return Object.keys(PRESETS); }

    mount() {
      if (this.mounted) return this;
      if (this.destroyed) throw new Error("A destroyed AXMLuminousLayerForge cannot be remounted.");

      const stage = this.document.createElement("div");
      stage.className = "axm-light-foundry";
      stage.dataset.axmOwned = "luminous-layer-forge";
      stage.setAttribute("aria-hidden", "true");
      for (const name of LAYERS) {
        const node = this.document.createElement("div");
        node.className = `axm-light-foundry__layer axm-light-foundry__${name}`;
        node.dataset.axmLightLayer = name;
        node.dataset.axmOwned = "luminous-layer-forge";
        stage.appendChild(node);
        this.nodes.set(name, node);
      }
      const atmosphere = this.root.querySelector(":scope > .axm-atmosphere[data-axm-owned='aetherglass']");
      if (atmosphere) atmosphere.after(stage);
      else this.root.prepend(stage);
      this.stage = stage;
      this.mounted = true;

      for (const eventName of ["axmvisual:motionchange", "axmvisual:qualitychange", "axmvisual:transparencychange", "axmvisual:contrastchange"]) {
        this.root.addEventListener(eventName, this._handlers.policy);
      }

      this.setPreset(PRESETS[this.options.preset] ? this.options.preset : DEFAULTS.preset, { emit: false });
      if (this.options.intensity !== null) this.setIntensity(this.options.intensity, { emit: false });
      if (this.options.depth !== null) this.setDepth(this.options.depth, { emit: false });
      this.setReactive(this.options.reactive, { emit: false });
      this._syncPolicy(false);
      this._emit("mounted", this.getState());
      return this;
    }

    listPresets() {
      return Object.entries(PRESETS).map(([name, preset]) => ({
        name,
        label: preset.label,
        description: preset.description,
        layers: [...preset.layers],
        intensity: preset.intensity,
        depth: preset.depth,
        estimatedCost: preset.layers.reduce((sum, layer) => sum + COST[layer], 0)
      }));
    }

    previewPreset(name) {
      const preset = PRESETS[name];
      if (!preset) return { valid: false, reason: "unknown-preset", mutations: 0 };
      const policy = this._policy();
      const effectiveLayers = this._effectiveLayers(preset.layers, policy);
      return {
        valid: true,
        version: VERSION,
        name,
        label: preset.label,
        description: preset.description,
        requestedLayers: [...preset.layers],
        effectiveLayers,
        intensity: preset.intensity,
        depth: preset.depth,
        policy,
        estimatedCost: effectiveLayers.reduce((sum, layer) => sum + COST[layer], 0),
        mutations: 0,
        contentRead: false,
        localOnly: true
      };
    }

    setPreset(name, options = {}) {
      const preset = PRESETS[name];
      if (!preset || !this.stage) return false;
      this.preset = name;
      this.layers = new Set(preset.layers);
      this.intensity = clamp(options.intensity, 0, 1.5, preset.intensity);
      this.depth = clamp(options.depth, 0, 1.5, preset.depth);
      this.stage.dataset.axmLightPreset = name;
      this._setRootAttribute("data-axm-light-preset", name);
      this._writeGains();
      this._renderLayers();
      if (options.emit !== false) this._emit("presetchange", this.getState());
      return true;
    }

    setLayer(name, enabled = true) {
      if (!LAYER_SET.has(name) || !this.stage) return false;
      if (enabled) this.layers.add(name);
      else this.layers.delete(name);
      this.preset = "custom";
      this.stage.dataset.axmLightPreset = "custom";
      this._setRootAttribute("data-axm-light-preset", "custom");
      this._renderLayers();
      this._emit("layerchange", { name, enabled: Boolean(enabled), state: this.getState() });
      return true;
    }

    setIntensity(value, options = {}) {
      this.intensity = clamp(value, 0, 1.5, this.intensity || .7);
      this._writeGains();
      if (options.emit !== false) this._emit("intensitychange", { intensity: this.intensity });
      return this;
    }

    setDepth(value, options = {}) {
      this.depth = clamp(value, 0, 1.5, this.depth || .8);
      this._writeGains();
      if (options.emit !== false) this._emit("depthchange", { depth: this.depth });
      return this;
    }

    setReactive(enabled, options = {}) {
      this.reactive = Boolean(enabled);
      if (this.stage) this.stage.dataset.axmLightReactive = this.reactive ? "true" : "false";
      if (options.emit !== false) this._emit("reactivechange", { reactive: this.reactive });
      return this;
    }

    applyConfig(config = {}, options = {}) {
      if (!config || typeof config !== "object") return false;
      if (config.preset !== undefined && config.preset !== "custom" && !PRESETS[config.preset]) return false;
      if (config.preset === "custom" && !Array.isArray(config.layers)) return false;
      if (config.preset !== undefined && config.preset !== "custom") this.setPreset(config.preset, { emit: false });
      if (Array.isArray(config.layers) && (config.preset === "custom" || config.preset === undefined)) {
        this.layers = new Set(uniqueLayers(config.layers));
        this.preset = "custom";
        this.stage.dataset.axmLightPreset = "custom";
        this._setRootAttribute("data-axm-light-preset", "custom");
      }
      if (config.intensity !== undefined) this.setIntensity(config.intensity, { emit: false });
      if (config.depth !== undefined) this.setDepth(config.depth, { emit: false });
      if (config.reactive !== undefined) this.setReactive(config.reactive, { emit: false });
      this._renderLayers();
      if (options.emit !== false) this._emit("configchange", this.getState());
      return true;
    }

    getConfig() {
      return {
        preset: this.preset,
        layers: [...this.layers],
        intensity: this.intensity,
        depth: this.depth,
        reactive: this.reactive
      };
    }

    radianceAt(target, options = {}) {
      if (!this.stage || this.destroyed || this.intensity <= 0) return false;
      const element = resolveTarget(target, this.root, this.document);
      if (!element) return false;
      const rect = element.getBoundingClientRect();
      const width = Math.max(global.innerWidth || 1, 1);
      const height = Math.max(global.innerHeight || 1, 1);
      const node = this.document.createElement("div");
      node.className = "axm-light-foundry__radiance";
      node.dataset.axmOwned = "luminous-layer-forge";
      node.dataset.axmLightMotion = this._policy().motion;
      node.style.setProperty("--axm-radiance-x", `${((rect.left + rect.width / 2) / width) * 100}%`);
      node.style.setProperty("--axm-radiance-y", `${((rect.top + rect.height / 2) / height) * 100}%`);
      node.style.setProperty("--axm-radiance-size", `${clamp(options.size, 160, 1800, Math.max(rect.width, rect.height) * 2.6)}px`);
      node.style.setProperty("--axm-radiance-strength", String(clamp(options.strength, .05, 1, .62)));
      node.style.setProperty("--axm-radiance-duration", `${clamp(options.duration, 220, 2600, 980)}ms`);
      node.style.setProperty("--axm-radiance-color", options.color || "var(--axm-accent-1)");
      this.stage.appendChild(node);
      this._trackTransient(node, clamp(options.duration, 220, 2600, 980) + 80);
      this._emit("radiance", { target: element, duration: clamp(options.duration, 220, 2600, 980) });
      return true;
    }

    getState() {
      const policy = this._policy();
      return {
        version: VERSION,
        mounted: this.mounted,
        destroyed: this.destroyed,
        preset: this.preset,
        layers: [...this.layers],
        effectiveLayers: this._effectiveLayers([...this.layers], policy),
        intensity: this.intensity,
        depth: this.depth,
        reactive: this.reactive,
        policy,
        transients: this._transients.size,
        contentRead: false,
        localOnly: true,
        telemetry: false
      };
    }

    destroy() {
      if (this.destroyed) return this;
      for (const eventName of ["axmvisual:motionchange", "axmvisual:qualitychange", "axmvisual:transparencychange", "axmvisual:contrastchange"]) {
        this.root.removeEventListener(eventName, this._handlers.policy);
      }
      for (const timer of this._timers) global.clearTimeout(timer);
      this._timers.clear();
      for (const node of this._transients) node.remove();
      this._transients.clear();
      this.stage?.remove();
      this.stage = null;
      this.nodes.clear();
      this._restoreRootAttributes();
      this.mounted = false;
      this.destroyed = true;
      this._emit("destroyed", { version: VERSION });
      return this;
    }

    _policy() {
      const state = this.engine.getState();
      const staticMotion = this.options.respectReducedMotion && (state.motion === "off" || state.motion === "reduced");
      return {
        quality: state.quality,
        transparency: state.transparency,
        contrast: state.contrast,
        motion: staticMotion ? "static" : "ambient"
      };
    }

    _effectiveLayers(layers, policy = this._policy()) {
      let allowed = new Set(LAYERS);
      if (policy.quality === "low") allowed = new Set(["halo", "crown", "refraction"]);
      if (policy.transparency === "off") allowed = new Set(["halo", "crown"]);
      if (policy.contrast === "high") allowed = new Set(["halo", "crown", "refraction"]);
      return uniqueLayers(layers).filter((name) => allowed.has(name));
    }

    _syncPolicy(emit = true) {
      if (!this.stage) return;
      const policy = this._policy();
      this.stage.dataset.axmLightQuality = policy.quality;
      this.stage.dataset.axmLightTransparency = policy.transparency;
      this.stage.dataset.axmLightContrast = policy.contrast;
      this.stage.dataset.axmLightMotion = policy.motion;
      this._renderLayers();
      if (emit) this._emit("policychange", { policy, effectiveLayers: this._effectiveLayers([...this.layers], policy) });
    }

    _renderLayers() {
      if (!this.stage) return;
      const effective = new Set(this._effectiveLayers([...this.layers]));
      for (const [name, node] of this.nodes) {
        const requested = this.layers.has(name);
        node.hidden = !effective.has(name);
        node.dataset.axmLightRequested = requested ? "true" : "false";
        node.dataset.axmLightEffective = effective.has(name) ? "true" : "false";
      }
      this.stage.dataset.axmLightEnabled = effective.size && this.intensity > 0 ? "true" : "false";
    }

    _writeGains() {
      if (!this.stage) return;
      this.stage.style.setProperty("--axm-light-layer-intensity", String(this.intensity));
      this.stage.style.setProperty("--axm-light-layer-depth", String(this.depth));
      this.stage.dataset.axmLightEnabled = this.layers.size && this.intensity > 0 ? "true" : "false";
    }

    _setRootAttribute(name, value) {
      if (!this._priorRootAttributes.has(name)) this._priorRootAttributes.set(name, this.root.getAttribute(name));
      this.root.setAttribute(name, value);
    }

    _restoreRootAttributes() {
      for (const [name, prior] of this._priorRootAttributes) {
        const owned = name === "data-axm-light-preset" && this.root.getAttribute(name) === this.preset;
        if (!owned) continue;
        if (prior === null) this.root.removeAttribute(name);
        else this.root.setAttribute(name, prior);
      }
      this._priorRootAttributes.clear();
    }

    _trackTransient(node, delay) {
      this._transients.add(node);
      const timer = global.setTimeout(() => {
        this._timers.delete(timer);
        this._transients.delete(node);
        node.remove();
      }, delay);
      this._timers.add(timer);
    }

    _emit(name, detail) {
      if (typeof global.CustomEvent !== "function") return;
      this.root.dispatchEvent(new global.CustomEvent(`axmlightlayers:${name}`, { detail }));
    }
  }

  global.AXMLuminousLayerForge = AXMLuminousLayerForge;
})(typeof window !== "undefined" ? window : globalThis);
