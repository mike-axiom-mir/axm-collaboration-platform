/*
 * AXM Aetherglass Visual Engine v7.1.0
 * Local-first, dependency-free, no telemetry, reversible mounting.
 * v7 preserves the production-safe visual-world and authoring architecture and adds explicit Storycraft,
 * readability protection, consistency auditing, operating presets, visual budgets,
 * and finite runtime supervision without changing the platform underneath it.
 */
(function attachAXMAetherglass(global) {
  "use strict";

  const VERSION = "7.1.0";
  const REGISTRY = new WeakMap();
  let INSTANCE_COUNTER = 0;

  const VALUES = Object.freeze({
    theme: new Set(["aether", "arcane", "frost", "solar", "verdant", "nebula", "eclipse", "royal", "ember", "pearl", "phantom", "auric", "oceanic", "rose-gold", "ultraviolet"]),
    atmosphere: new Set(["cosmos", "cathedral", "dream", "eclipse", "monolith", "sanctuary", "forge", "living", "prism", "quiet", "portal", "throne", "ocean", "sanctum", "horizon"]),
    material: new Set(["clear", "smoked", "crystal", "obsidian", "pearl", "holographic", "liquid", "diamond", "velvet", "mirror"]),
    depth: new Set(["flat", "soft", "deep", "cinematic"]),
    luminosity: new Set(["dim", "balanced", "radiant"]),
    density: new Set(["airy", "comfortable", "compact"]),
    shape: new Set(["soft", "sculpted", "sharp"]),
    transparency: new Set(["auto", "full", "reduced", "off"]),
    contrast: new Set(["auto", "normal", "high"]),
    quality: new Set(["auto", "high", "balanced", "low"]),
    motion: new Set(["auto", "full", "reduced", "off"])
  });

  const DEFAULTS = Object.freeze({
    root: null,
    applyToDocument: true,
    duplicate: "reuse",
    theme: "aether",
    atmosphere: "cosmos",
    material: "crystal",
    depth: "deep",
    luminosity: "balanced",
    density: "comfortable",
    shape: "sculpted",
    transparency: "auto",
    contrast: "auto",
    quality: "auto",
    motion: "auto",
    intensity: 1,
    atmosphereStrength: 1,
    glowStrength: 1,
    pointerLighting: true,
    reactivePanels: true,
    parallax: true,
    trackScroll: true,
    palette: null,
    pauseWhenHidden: true,
    respondToPreferences: true,
    persist: false,
    storageKey: "axm-aetherglass-v7-preferences"
  });

  const DATA_ATTRIBUTES = Object.freeze({
    theme: "data-axm-theme",
    atmosphere: "data-axm-atmosphere",
    material: "data-axm-material",
    depth: "data-axm-depth",
    luminosity: "data-axm-luminosity",
    density: "data-axm-density",
    shape: "data-axm-shape",
    transparency: "data-axm-transparency",
    contrast: "data-axm-contrast",
    quality: "data-axm-quality",
    motion: "data-axm-motion",
    paused: "data-axm-paused"
  });

  const CONFIG_KEYS = Object.freeze([
    "theme", "atmosphere", "material", "depth", "luminosity", "density", "shape",
    "transparency", "contrast", "quality", "motion", "intensity", "atmosphereStrength", "glowStrength",
    "pointerLighting", "reactivePanels", "parallax", "trackScroll"
  ]);

  const ATMOSPHERE_LAYERS = Object.freeze([
    "base", "nebula", "aurora", "caustics", "beams", "horizon", "mist",
    "stars", "grid", "lights", "grain", "vignette"
  ]);

  function clamp(value, min, max, fallback = min) {
    const number = Number(value);
    return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
  }

  function safeMatchMedia(query) {
    try {
      return global.matchMedia ? global.matchMedia(query) : null;
    } catch (_) {
      return null;
    }
  }

  function uniqueElements(elements) {
    return Array.from(new Set(elements.filter(Boolean)));
  }

  function createAtmosphere(documentRef, instanceId) {
    const atmosphere = documentRef.createElement("div");
    atmosphere.className = "axm-atmosphere";
    atmosphere.setAttribute("aria-hidden", "true");
    atmosphere.dataset.axmOwned = "aetherglass";
    atmosphere.dataset.axmInstance = instanceId;

    for (const layer of ATMOSPHERE_LAYERS) {
      const element = documentRef.createElement("div");
      element.className = `axm-atmosphere__${layer}`;
      element.dataset.axmLayer = layer;
      atmosphere.appendChild(element);
    }
    return atmosphere;
  }

  function safeColor(value) {
    const color = String(value || "").trim();
    if (!color || /url\s*\(|[;{}]/i.test(color)) return null;
    try {
      if (global.CSS?.supports?.("color", color)) return color;
    } catch (_) {
      // Continue to conservative fallback below.
    }
    if (/^(#[0-9a-f]{3,8}|rgba?\([^)]*\)|hsla?\([^)]*\)|oklch\([^)]*\)|var\(--[\w-]+\))$/i.test(color)) {
      return color;
    }
    return null;
  }

  class AXMVisualEngine {
    constructor(options = {}) {
      this.options = { ...DEFAULTS, ...options };
      this.root = this.options.root || global.document?.body || null;
      this.document = this.root?.ownerDocument || global.document || null;
      this.instanceId = `axm-visual-${++INSTANCE_COUNTER}`;
      this.atmosphere = null;
      this.mounted = false;
      this._raf = 0;
      this._targetX = 50;
      this._targetY = 32;
      this._currentX = 50;
      this._currentY = 32;
      this._lastPanel = null;
      this._ownedClasses = [];
      this._ownedAttributes = new Map();
      this._ownedStyles = new Map();
      this._palette = {};
      this._media = [];
      this._listenerState = {
        pointer: false,
        panels: false,
        scroll: false,
        visibility: false,
        resize: false
      };
      this._requested = {
        quality: this.options.quality,
        motion: this.options.motion,
        transparency: this.options.transparency,
        contrast: this.options.contrast
      };
      this._defaultsSnapshot = null;
      this._handlers = {
        pointerMove: (event) => this._onPointerMove(event),
        panelPointerMove: (event) => this._onPanelPointerMove(event),
        pointerOut: (event) => this._onPointerOut(event),
        visibility: () => this._onVisibilityChange(),
        resize: () => this._onResize(),
        scroll: () => this._onScroll(),
        preference: () => this._onPreferenceChange()
      };
    }

    static mount(options = {}) {
      const root = options.root || global.document?.body || null;
      if (!root) {
        throw new Error("AXMVisualEngine requires a browser document and a valid root element.");
      }

      const existing = REGISTRY.get(root);
      const duplicate = options.duplicate || DEFAULTS.duplicate;
      if (existing?.mounted) {
        if (duplicate === "replace") {
          existing.destroy();
        } else if (duplicate === "error") {
          throw new Error("An AXMVisualEngine is already mounted on this root.");
        } else {
          return existing;
        }
      }

      const engine = new AXMVisualEngine({ ...options, root });
      return engine.mount();
    }

    static getMounted(root = global.document?.body || null) {
      return root ? REGISTRY.get(root) || null : null;
    }

    static get version() {
      return VERSION;
    }

    mount() {
      if (this.mounted) return this;
      if (!this.root || !this.document) {
        throw new Error("AXMVisualEngine requires a browser document and a valid root element.");
      }

      const existing = REGISTRY.get(this.root);
      if (existing?.mounted && existing !== this) {
        if (this.options.duplicate === "replace") existing.destroy();
        else if (this.options.duplicate === "error") throw new Error("An AXMVisualEngine is already mounted on this root.");
        else return existing;
      }

      this._defaultsSnapshot = { ...this.options };
      this._loadPreferences();
      this._addOwnedClass(this.root, "axm-visual-root");
      this._addOwnedClass(this.root, "axm-scrollbars");

      if (this.options.applyToDocument) {
        this._addOwnedClass(this.document.documentElement, "axm-visual-root");
        this._addOwnedClass(this.document.documentElement, "axm-scrollbars");
      }

      this.atmosphere = createAtmosphere(this.document, this.instanceId);
      this.root.prepend(this.atmosphere);

      this.mounted = true;
      REGISTRY.set(this.root, this);

      this.applyConfig(this.options, { persist: false, emit: false });
      this._syncListeners();
      this._setupPreferenceListeners();
      this._onVisibilityChange();
      this._onScroll();
      this._writePointerFrame(true);

      this._emit("mounted", this.getState());
      return this;
    }

    setTheme(value, persist = true) { return this._setEnumerated("theme", value, "aether", persist); }
    setAtmosphere(value, persist = true) { return this._setEnumerated("atmosphere", value, "cosmos", persist); }
    setMaterial(value, persist = true) { return this._setEnumerated("material", value, "crystal", persist); }
    setDepth(value, persist = true) { return this._setEnumerated("depth", value, "deep", persist); }
    setLuminosity(value, persist = true) { return this._setEnumerated("luminosity", value, "balanced", persist); }
    setDensity(value, persist = true) { return this._setEnumerated("density", value, "comfortable", persist); }
    setShape(value, persist = true) { return this._setEnumerated("shape", value, "sculpted", persist); }

    setTransparency(value, persist = true) {
      const requested = VALUES.transparency.has(value) ? value : "auto";
      this._requested.transparency = requested;
      this.options.transparency = requested;
      const resolved = requested === "auto" ? this._detectTransparency() : requested;
      this._setData("transparency", resolved);
      if (persist) this._persistPreferences();
      this._emit("transparencychange", { requested, transparency: resolved });
      return this;
    }

    setContrast(value, persist = true) {
      const requested = VALUES.contrast.has(value) ? value : "auto";
      this._requested.contrast = requested;
      this.options.contrast = requested;
      const resolved = requested === "auto" ? (safeMatchMedia("(prefers-contrast: more)")?.matches ? "high" : "normal") : requested;
      this._setData("contrast", resolved);
      if (persist) this._persistPreferences();
      this._emit("contrastchange", { requested, contrast: resolved });
      return this;
    }

    setQuality(value, persist = true) {
      const requested = VALUES.quality.has(value) ? value : "auto";
      this._requested.quality = requested;
      this.options.quality = requested;
      const resolved = requested === "auto" ? this._detectQuality() : requested;
      this._setData("quality", resolved);
      if (persist) this._persistPreferences();
      this._emit("qualitychange", { requested, quality: resolved });
      return this;
    }

    setMotion(value, persist = true) {
      const requested = VALUES.motion.has(value) ? value : "auto";
      this._requested.motion = requested;
      this.options.motion = requested;
      const reduced = safeMatchMedia("(prefers-reduced-motion: reduce)")?.matches;
      const resolved = requested === "auto" ? (reduced ? "reduced" : "full") : requested;
      this._setData("motion", resolved);
      if (persist) this._persistPreferences();
      this._emit("motionchange", { requested, motion: resolved });
      return this;
    }

    setIntensity(value, persist = true) {
      const intensity = clamp(value, 0, 1.8, 1);
      this.options.intensity = intensity;
      this._setStyle(this.root, "--axm-intensity", String(intensity));
      if (this.options.applyToDocument) this._setStyle(this.document.documentElement, "--axm-intensity", String(intensity));
      if (persist) this._persistPreferences();
      this._emit("intensitychange", { intensity });
      return this;
    }

    setAtmosphereStrength(value, persist = true) {
      const strength = clamp(value, 0, 1.6, 1);
      this.options.atmosphereStrength = strength;
      for (const target of this._targets()) this._setStyle(target, "--axm-atmosphere-strength", String(strength));
      if (persist) this._persistPreferences();
      this._emit("atmospherestrengthchange", { atmosphereStrength: strength });
      return this;
    }

    setGlowStrength(value, persist = true) {
      const strength = clamp(value, 0, 2, 1);
      this.options.glowStrength = strength;
      for (const target of this._targets()) this._setStyle(target, "--axm-glow-strength", String(strength));
      if (persist) this._persistPreferences();
      this._emit("glowstrengthchange", { glowStrength: strength });
      return this;
    }

    setPointerLighting(enabled, persist = true) {
      this.options.pointerLighting = Boolean(enabled);
      this._syncListeners();
      if (!this.options.pointerLighting) this._centerPointer();
      if (persist) this._persistPreferences();
      this._emit("effectchange", { effect: "pointerLighting", enabled: this.options.pointerLighting });
      return this;
    }

    setReactivePanels(enabled, persist = true) {
      this.options.reactivePanels = Boolean(enabled);
      this._syncListeners();
      if (!this.options.reactivePanels) this._clearLastPanel();
      if (persist) this._persistPreferences();
      this._emit("effectchange", { effect: "reactivePanels", enabled: this.options.reactivePanels });
      return this;
    }

    setParallax(enabled, persist = true) {
      this.options.parallax = Boolean(enabled);
      if (!this.options.parallax) this._writeParallax(0, 0);
      if (persist) this._persistPreferences();
      this._emit("effectchange", { effect: "parallax", enabled: this.options.parallax });
      return this;
    }

    setTrackScroll(enabled, persist = true) {
      this.options.trackScroll = Boolean(enabled);
      this._syncListeners();
      if (!this.options.trackScroll) this._setStyle(this.root, "--axm-scroll-progress", "0");
      if (persist) this._persistPreferences();
      this._emit("effectchange", { effect: "trackScroll", enabled: this.options.trackScroll });
      return this;
    }

    setAccent(slot, color) {
      const names = {
        "accent-1": "--axm-accent-1",
        "accent-2": "--axm-accent-2",
        "accent-3": "--axm-accent-3",
        lux: "--axm-lux"
      };
      if (!names[slot]) throw new Error(`Unknown AXM accent slot: ${slot}`);
      const resolved = safeColor(color);
      if (!resolved) throw new Error("Accent must be a valid local CSS color value.");
      this._setStyle(this.root, names[slot], resolved);
      if (this.options.applyToDocument) this._setStyle(this.document.documentElement, names[slot], resolved);
      const paletteKey = { "accent-1": "accent1", "accent-2": "accent2", "accent-3": "accent3", lux: "lux" }[slot];
      this._palette[paletteKey] = resolved;
      this._emit("accentchange", { slot, color: resolved });
      return this;
    }

    setPalette(palette = {}, options = {}) {
      const keyMap = {
        accent1: ["accent-1", "--axm-accent-1"],
        accent2: ["accent-2", "--axm-accent-2"],
        accent3: ["accent-3", "--axm-accent-3"],
        lux: ["lux", "--axm-lux"]
      };
      if (options.replace === true) {
        for (const [key, [, property]] of Object.entries(keyMap)) {
          if (palette[key] !== undefined || this._palette[key] === undefined) continue;
          for (const target of this._targets()) this._restoreOwnedStyleProperty(target, property);
          delete this._palette[key];
        }
      }
      const applied = {};
      for (const [key, [slot]] of Object.entries(keyMap)) {
        if (palette[key] === undefined) continue;
        this.setAccent(slot, palette[key]);
        applied[key] = this._palette[key];
      }
      this._emit("palettechange", { palette: applied });
      return this;
    }

    getPalette() {
      return { ...this._palette };
    }

    clearPalette() {
      return this.setPalette({}, { replace: true });
    }

    applyConfig(config = {}, options = {}) {
      const persist = options.persist !== false;
      const emit = options.emit !== false;
      const applied = {};
      const rejected = [];

      for (const key of Object.keys(config || {})) {
        if (!CONFIG_KEYS.includes(key) && key !== "palette") rejected.push(key);
      }

      const calls = [
        ["theme", "setTheme"],
        ["atmosphere", "setAtmosphere"],
        ["material", "setMaterial"],
        ["depth", "setDepth"],
        ["luminosity", "setLuminosity"],
        ["density", "setDensity"],
        ["shape", "setShape"],
        ["transparency", "setTransparency"],
        ["contrast", "setContrast"],
        ["quality", "setQuality"],
        ["motion", "setMotion"],
        ["intensity", "setIntensity"],
        ["atmosphereStrength", "setAtmosphereStrength"],
        ["glowStrength", "setGlowStrength"],
        ["pointerLighting", "setPointerLighting"],
        ["reactivePanels", "setReactivePanels"],
        ["parallax", "setParallax"],
        ["trackScroll", "setTrackScroll"]
      ];

      for (const [key, method] of calls) {
        if (config[key] === undefined) continue;
        this[method](config[key], false);
        applied[key] = this.getConfig()[key];
      }

      if (config.palette && typeof config.palette === "object") {
        this.setPalette(config.palette, { replace: true });
        applied.palette = this.getPalette();
      }

      if (persist) this._persistPreferences();
      if (emit) this._emit("configchange", { applied, rejected });
      return { applied, rejected, state: this.getState() };
    }

    getConfig() {
      return {
        theme: this.root?.dataset.axmTheme || this.options.theme,
        atmosphere: this.root?.dataset.axmAtmosphere || this.options.atmosphere,
        material: this.root?.dataset.axmMaterial || this.options.material,
        depth: this.root?.dataset.axmDepth || this.options.depth,
        luminosity: this.root?.dataset.axmLuminosity || this.options.luminosity,
        density: this.root?.dataset.axmDensity || this.options.density,
        shape: this.root?.dataset.axmShape || this.options.shape,
        transparency: this._requested.transparency,
        contrast: this._requested.contrast,
        quality: this._requested.quality,
        motion: this._requested.motion,
        intensity: Number(this.root?.style.getPropertyValue("--axm-intensity") || this.options.intensity),
        atmosphereStrength: Number(this.root?.style.getPropertyValue("--axm-atmosphere-strength") || this.options.atmosphereStrength),
        glowStrength: Number(this.root?.style.getPropertyValue("--axm-glow-strength") || this.options.glowStrength),
        pointerLighting: Boolean(this.options.pointerLighting),
        reactivePanels: Boolean(this.options.reactivePanels),
        parallax: Boolean(this.options.parallax),
        trackScroll: Boolean(this.options.trackScroll),
        palette: this.getPalette()
      };
    }

    exportConfig(space = 2) {
      return JSON.stringify({
        module: "axm.visual.aetherglass",
        version: VERSION,
        config: this.getConfig()
      }, null, clamp(space, 0, 8, 2));
    }

    importConfig(input, options = {}) {
      let parsed = input;
      if (typeof input === "string") {
        try {
          parsed = JSON.parse(input);
        } catch (error) {
          throw new Error(`Invalid Aetherglass configuration JSON: ${error.message}`);
        }
      }
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new Error("Aetherglass configuration must be an object or JSON object string.");
      }
      const config = parsed.config && typeof parsed.config === "object" ? parsed.config : parsed;
      return this.applyConfig(config, options);
    }

    reset(options = {}) {
      const defaults = { ...DEFAULTS, ...this._defaultsSnapshot, root: undefined, applyToDocument: undefined, duplicate: undefined, persist: undefined, storageKey: undefined };
      defaults.palette = this._defaultsSnapshot?.palette && typeof this._defaultsSnapshot.palette === "object"
        ? { ...this._defaultsSnapshot.palette }
        : {};
      for (const key of Object.keys(defaults)) {
        if (defaults[key] === undefined) delete defaults[key];
      }
      const result = this.applyConfig(defaults, { persist: options.persist !== false });
      this._emit("reset", this.getState());
      return result;
    }

    clearPreferences() {
      try { global.localStorage?.removeItem(this.options.storageKey); } catch (_) { /* local storage may be unavailable */ }
      return this;
    }

    getCapabilities() {
      return {
        themes: Array.from(VALUES.theme),
        atmospheres: Array.from(VALUES.atmosphere),
        materials: Array.from(VALUES.material),
        depths: Array.from(VALUES.depth),
        luminosities: Array.from(VALUES.luminosity),
        densities: Array.from(VALUES.density),
        shapes: Array.from(VALUES.shape),
        transparencies: Array.from(VALUES.transparency),
        contrasts: Array.from(VALUES.contrast),
        qualities: Array.from(VALUES.quality),
        motions: Array.from(VALUES.motion),
        configImportExport: true,
        scopedRollback: true,
        duplicateMountProtection: true,
        independentAtmosphereAndGlowGain: true,
        paletteState: true,
        localOnly: true,
        telemetry: false
      };
    }

    getState() {
      const configured = this.getConfig();
      return {
        version: VERSION,
        instanceId: this.instanceId,
        mounted: this.mounted,
        ...configured,
        quality: this.root?.dataset.axmQuality || configured.quality,
        motion: this.root?.dataset.axmMotion || configured.motion,
        transparency: this.root?.dataset.axmTransparency || configured.transparency,
        contrast: this.root?.dataset.axmContrast || configured.contrast,
        requested: { ...this._requested },
        configured,
        localOnly: true,
        networkAccess: false,
        telemetry: false
      };
    }

    destroy() {
      if (!this.mounted) return this;

      this._teardownPreferenceListeners();
      this._removeAllListeners();
      if (this._raf) global.cancelAnimationFrame(this._raf);
      this._raf = 0;
      this._clearLastPanel();
      this.atmosphere?.remove();
      this.atmosphere = null;

      this._restoreOwnedStyles();
      this._restoreOwnedAttributes();
      this._restoreOwnedClasses();

      this.mounted = false;
      if (REGISTRY.get(this.root) === this) REGISTRY.delete(this.root);
      this._emit("destroyed", { version: VERSION, instanceId: this.instanceId });
      return this;
    }

    _setEnumerated(key, value, fallback, persist) {
      const resolved = VALUES[key].has(value) ? value : fallback;
      this.options[key] = resolved;
      this._setData(key, resolved);
      if (persist) this._persistPreferences();
      this._emit(`${key}change`, { [key]: resolved });
      return this;
    }

    _targets() {
      return uniqueElements([this.root, this.options.applyToDocument ? this.document.documentElement : null]);
    }

    _setData(key, value) {
      const attribute = DATA_ATTRIBUTES[key];
      if (!attribute) return;
      for (const target of this._targets()) this._setAttribute(target, attribute, value);
    }

    _addOwnedClass(element, className) {
      if (!element || element.classList.contains(className)) return;
      element.classList.add(className);
      this._ownedClasses.push({ element, className });
    }

    _setAttribute(element, name, value) {
      if (!element) return;
      let records = this._ownedAttributes.get(element);
      if (!records) {
        records = new Map();
        this._ownedAttributes.set(element, records);
      }
      let record = records.get(name);
      if (!record) {
        record = { original: element.getAttribute(name), lastApplied: null };
        records.set(name, record);
      }
      const stringValue = String(value);
      element.setAttribute(name, stringValue);
      record.lastApplied = stringValue;
    }

    _setStyle(element, name, value) {
      if (!element) return;
      let records = this._ownedStyles.get(element);
      if (!records) {
        records = new Map();
        this._ownedStyles.set(element, records);
      }
      let record = records.get(name);
      if (!record) {
        record = { original: element.style.getPropertyValue(name), priority: element.style.getPropertyPriority(name), lastApplied: null };
        records.set(name, record);
      }
      const stringValue = String(value);
      element.style.setProperty(name, stringValue);
      record.lastApplied = stringValue;
    }

    _restoreOwnedStyleProperty(element, name) {
      const records = this._ownedStyles.get(element);
      const record = records?.get(name);
      if (!record) return;
      if (element.style.getPropertyValue(name) === record.lastApplied) {
        if (record.original) element.style.setProperty(name, record.original, record.priority || "");
        else element.style.removeProperty(name);
      }
      records.delete(name);
      if (!records.size) this._ownedStyles.delete(element);
    }

    _restoreOwnedClasses() {
      for (const { element, className } of this._ownedClasses.reverse()) {
        element?.classList?.remove(className);
      }
      this._ownedClasses = [];
    }

    _restoreOwnedAttributes() {
      for (const [element, records] of this._ownedAttributes) {
        for (const [name, record] of records) {
          if (element.getAttribute(name) !== record.lastApplied) continue;
          if (record.original === null) element.removeAttribute(name);
          else element.setAttribute(name, record.original);
        }
      }
      this._ownedAttributes.clear();
    }

    _restoreOwnedStyles() {
      for (const [element, records] of this._ownedStyles) {
        for (const [name, record] of records) {
          if (element.style.getPropertyValue(name) !== record.lastApplied) continue;
          if (record.original) element.style.setProperty(name, record.original, record.priority || "");
          else element.style.removeProperty(name);
        }
      }
      this._ownedStyles.clear();
    }

    _detectQuality() {
      const memory = Number(global.navigator?.deviceMemory || 8);
      const cores = Number(global.navigator?.hardwareConcurrency || 8);
      const dpr = Number(global.devicePixelRatio || 1);
      const compact = Math.min(global.innerWidth || 1920, global.innerHeight || 1080) < 620;
      const saveData = Boolean(global.navigator?.connection?.saveData);
      if (saveData || memory <= 2 || cores <= 2) return "low";
      if (memory <= 4 || cores <= 4 || (compact && dpr > 2.5)) return "balanced";
      return "high";
    }

    _detectTransparency() {
      if (safeMatchMedia("(forced-colors: active)")?.matches) return "off";
      if (safeMatchMedia("(prefers-contrast: more)")?.matches) return "reduced";
      if (global.navigator?.connection?.saveData) return "reduced";
      return "full";
    }

    _syncListeners() {
      if (!this.mounted) return;
      const needPointer = Boolean(this.options.pointerLighting || this.options.parallax);
      if (needPointer && !this._listenerState.pointer) {
        global.addEventListener("pointermove", this._handlers.pointerMove, { passive: true });
        this._listenerState.pointer = true;
      } else if (!needPointer && this._listenerState.pointer) {
        global.removeEventListener("pointermove", this._handlers.pointerMove);
        this._listenerState.pointer = false;
      }

      if (this.options.reactivePanels && !this._listenerState.panels) {
        this.root.addEventListener("pointermove", this._handlers.panelPointerMove, { passive: true });
        this.root.addEventListener("pointerout", this._handlers.pointerOut, { passive: true });
        this._listenerState.panels = true;
      } else if (!this.options.reactivePanels && this._listenerState.panels) {
        this.root.removeEventListener("pointermove", this._handlers.panelPointerMove);
        this.root.removeEventListener("pointerout", this._handlers.pointerOut);
        this._listenerState.panels = false;
      }

      if (this.options.trackScroll && !this._listenerState.scroll) {
        global.addEventListener("scroll", this._handlers.scroll, { passive: true });
        this._listenerState.scroll = true;
      } else if (!this.options.trackScroll && this._listenerState.scroll) {
        global.removeEventListener("scroll", this._handlers.scroll);
        this._listenerState.scroll = false;
      }

      if (this.options.pauseWhenHidden && !this._listenerState.visibility) {
        this.document.addEventListener("visibilitychange", this._handlers.visibility);
        this._listenerState.visibility = true;
      }

      if (!this._listenerState.resize) {
        global.addEventListener("resize", this._handlers.resize, { passive: true });
        this._listenerState.resize = true;
      }
    }

    _removeAllListeners() {
      if (this._listenerState.pointer) global.removeEventListener("pointermove", this._handlers.pointerMove);
      if (this._listenerState.panels) {
        this.root.removeEventListener("pointermove", this._handlers.panelPointerMove);
        this.root.removeEventListener("pointerout", this._handlers.pointerOut);
      }
      if (this._listenerState.scroll) global.removeEventListener("scroll", this._handlers.scroll);
      if (this._listenerState.visibility) this.document.removeEventListener("visibilitychange", this._handlers.visibility);
      if (this._listenerState.resize) global.removeEventListener("resize", this._handlers.resize);
      for (const key of Object.keys(this._listenerState)) this._listenerState[key] = false;
    }

    _setupPreferenceListeners() {
      if (!this.options.respondToPreferences) return;
      for (const query of ["(prefers-reduced-motion: reduce)", "(prefers-contrast: more)", "(forced-colors: active)"]) {
        const media = safeMatchMedia(query);
        if (!media) continue;
        try { media.addEventListener("change", this._handlers.preference); }
        catch (_) { try { media.addListener(this._handlers.preference); } catch (_) { /* old browser */ } }
        this._media.push(media);
      }
    }

    _teardownPreferenceListeners() {
      for (const media of this._media) {
        try { media.removeEventListener("change", this._handlers.preference); }
        catch (_) { try { media.removeListener(this._handlers.preference); } catch (_) { /* old browser */ } }
      }
      this._media = [];
    }

    _onPreferenceChange() {
      if (this._requested.motion === "auto") this.setMotion("auto", false);
      if (this._requested.transparency === "auto") this.setTransparency("auto", false);
      if (this._requested.contrast === "auto") this.setContrast("auto", false);
      if (this._requested.quality === "auto") this.setQuality("auto", false);
      this._emit("preferencechange", this.getState());
    }

    _onPointerMove(event) {
      const width = Math.max(global.innerWidth || 1, 1);
      const height = Math.max(global.innerHeight || 1, 1);
      this._targetX = clamp((event.clientX / width) * 100, 0, 100, 50);
      this._targetY = clamp((event.clientY / height) * 100, 0, 100, 32);
      if (!this._raf) this._raf = global.requestAnimationFrame(() => this._writePointerFrame(false));
    }

    _writePointerFrame(immediate) {
      this._raf = 0;
      const motion = this.root?.dataset.axmMotion;
      const easing = immediate || motion === "off" ? 1 : (motion === "reduced" ? .35 : .16);
      this._currentX += (this._targetX - this._currentX) * easing;
      this._currentY += (this._targetY - this._currentY) * easing;

      if (this.options.pointerLighting) {
        this._setStyle(this.root, "--axm-pointer-x", this._currentX.toFixed(2));
        this._setStyle(this.root, "--axm-pointer-y", this._currentY.toFixed(2));
        if (this.options.applyToDocument) {
          this._setStyle(this.document.documentElement, "--axm-pointer-x", this._currentX.toFixed(2));
          this._setStyle(this.document.documentElement, "--axm-pointer-y", this._currentY.toFixed(2));
        }
      }

      if (this.options.parallax) {
        const nx = (this._currentX - 50) / 50;
        const ny = (this._currentY - 50) / 50;
        this._writeParallax(nx, ny);
      }

      const moving = Math.abs(this._targetX - this._currentX) > .05 || Math.abs(this._targetY - this._currentY) > .05;
      if (moving) this._raf = global.requestAnimationFrame(() => this._writePointerFrame(false));
    }

    _writeParallax(nx, ny) {
      const values = {
        "--axm-parallax-x": `${(nx * 10).toFixed(2)}px`,
        "--axm-parallax-y": `${(ny * 8).toFixed(2)}px`,
        "--axm-parallax-x-far": `${(nx * 20).toFixed(2)}px`,
        "--axm-parallax-y-far": `${(ny * 14).toFixed(2)}px`,
        "--axm-parallax-x-reverse": `${(-nx * 14).toFixed(2)}px`,
        "--axm-parallax-y-reverse": `${(-ny * 10).toFixed(2)}px`
      };
      for (const target of this._targets()) {
        for (const [name, value] of Object.entries(values)) this._setStyle(target, name, value);
      }
    }

    _centerPointer() {
      this._targetX = this._currentX = 50;
      this._targetY = this._currentY = 32;
      for (const target of this._targets()) {
        this._setStyle(target, "--axm-pointer-x", "50");
        this._setStyle(target, "--axm-pointer-y", "32");
      }
    }

    _onPanelPointerMove(event) {
      const panel = event.target?.closest?.(".axm-glass, .axm-surface, [data-axm-reactive]");
      if (!panel || !this.root.contains(panel)) return;
      const rect = panel.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      if (this._lastPanel && this._lastPanel !== panel) this._clearPanel(this._lastPanel);
      const x = clamp(((event.clientX - rect.left) / rect.width) * 100, 0, 100, 50);
      const y = clamp(((event.clientY - rect.top) / rect.height) * 100, 0, 100, 30);
      panel.style.setProperty("--axm-panel-x", `${x.toFixed(2)}%`);
      panel.style.setProperty("--axm-panel-y", `${y.toFixed(2)}%`);
      panel.dataset.axmPointerActive = "true";
      this._lastPanel = panel;
    }

    _onPointerOut(event) {
      if (!this._lastPanel) return;
      const related = event.relatedTarget;
      if (related && this._lastPanel.contains(related)) return;
      if (!related || !this._lastPanel.contains(related)) this._clearLastPanel();
    }

    _clearPanel(panel) {
      if (!panel) return;
      panel.style.removeProperty("--axm-panel-x");
      panel.style.removeProperty("--axm-panel-y");
      delete panel.dataset.axmPointerActive;
    }

    _clearLastPanel() {
      this._clearPanel(this._lastPanel);
      this._lastPanel = null;
    }

    _onVisibilityChange() {
      if (!this.mounted) return;
      const paused = this.options.pauseWhenHidden && this.document.hidden ? "true" : "false";
      this._setData("paused", paused);
      this._emit("visibilitychange", { paused: paused === "true" });
    }

    _onResize() {
      if (this._requested.quality === "auto") this.setQuality("auto", false);
      this._onScroll();
      this._emit("resize", { width: global.innerWidth, height: global.innerHeight });
    }

    _onScroll() {
      if (!this.options.trackScroll) return;
      const doc = this.document.documentElement;
      const body = this.document.body;
      const top = global.scrollY || doc.scrollTop || body?.scrollTop || 0;
      const height = Math.max(doc.scrollHeight, body?.scrollHeight || 0) - (global.innerHeight || doc.clientHeight || 1);
      const progress = height > 0 ? clamp(top / height, 0, 1, 0) : 0;
      for (const target of this._targets()) this._setStyle(target, "--axm-scroll-progress", progress.toFixed(4));
    }

    _loadPreferences() {
      if (!this.options.persist) return;
      try {
        const raw = global.localStorage?.getItem(this.options.storageKey);
        if (!raw) return;
        const parsed = JSON.parse(raw);
        const config = parsed?.config && typeof parsed.config === "object" ? parsed.config : parsed;
        for (const key of CONFIG_KEYS) {
          if (config[key] !== undefined) this.options[key] = config[key];
        }
        if (config.palette && typeof config.palette === "object") this.options.palette = { ...config.palette };
      } catch (_) {
        // Corrupt or unavailable storage never blocks the visual engine.
      }
    }

    _persistPreferences() {
      if (!this.options.persist) return;
      try {
        global.localStorage?.setItem(this.options.storageKey, JSON.stringify({ version: VERSION, config: this.getConfig() }));
      } catch (_) {
        // Storage quota/private mode failures remain non-fatal.
      }
    }

    _emit(name, detail) {
      if (!this.root || typeof global.CustomEvent !== "function") return;
      this.root.dispatchEvent(new global.CustomEvent(`axmvisual:${name}`, { detail }));
    }
  }

  global.AXMVisualEngine = AXMVisualEngine;
})(typeof window !== "undefined" ? window : globalThis);
