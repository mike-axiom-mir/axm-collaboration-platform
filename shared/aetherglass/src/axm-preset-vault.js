/*
 * AXM Production Preset Vault v7.1.0
 * Schema-checked, code-free visual presets for repeatable platform states.
 * In-memory by default. Persistence is optional, local, explicit, and namespaced.
 */
(function attachAXMPresetVault(global) {
  "use strict";

  const VERSION = "7.1.0";
  const NAME_PATTERN = /^[a-z0-9][a-z0-9-_]{1,63}$/i;
  const TOP_KEYS = new Set(["label", "description", "scene", "engine", "field", "lighting", "transition", "cue", "surfaces", "budget", "tags", "builtIn"]);
  const ENGINE_KEYS = new Set(["theme", "atmosphere", "material", "depth", "luminosity", "density", "shape", "transparency", "contrast", "quality", "motion", "intensity", "atmosphereStrength", "glowStrength", "pointerLighting", "reactivePanels", "parallax", "trackScroll", "palette"]);
  const FIELD_KEYS = new Set(["preset", "density", "energy", "speed", "interactive"]);
  const BUDGETS = new Set(["showcase", "balanced", "workspace", "low-power", "accessibility"]);

  const BUILT_INS = Object.freeze({
    "daily-workspace": {
      label: "Daily Workspace",
      description: "Professional, calm, readable, and restrained for ordinary platform use.",
      scene: "quiet-operations",
      engine: { quality: "auto", motion: "auto", transparency: "auto", contrast: "auto", pointerLighting: true, reactivePanels: true, parallax: false, glowStrength: .62, atmosphereStrength: .58 },
      field: { preset: "off", density: 0, energy: 0, speed: 0, interactive: false },
      budget: "workspace"
    },
    "deep-focus": {
      label: "Deep Focus",
      description: "Black-diamond clarity with minimal orbit motion and strong hierarchy.",
      scene: "black-diamond-focus",
      engine: { motion: "reduced", pointerLighting: false, parallax: false, contrast: "high" },
      field: { preset: "orbitals", density: .12, energy: .22, speed: .12, interactive: false },
      budget: "workspace"
    },
    "creation-flow": {
      label: "Creation Flow",
      description: "Warm forge energy without overwhelming working controls.",
      scene: "solar-forge",
      engine: { quality: "high", motion: "full", pointerLighting: true, parallax: true, glowStrength: 1.04 },
      field: { preset: "embers", density: .48, energy: .72, speed: .5, interactive: true },
      budget: "balanced"
    },
    "review-proof": {
      label: "Review & Proof",
      description: "Frosted sanctuary for verification, comparison, reading, and evidence review.",
      scene: "frost-sanctuary",
      engine: { contrast: "high", motion: "reduced", pointerLighting: false, parallax: false, glowStrength: .56, atmosphereStrength: .58 },
      field: { preset: "snow", density: .16, energy: .22, speed: .14, interactive: false },
      budget: "accessibility"
    },
    "live-command": {
      label: "Live Command",
      description: "Balanced luminous command space for active platform operation.",
      scene: "aether-command",
      engine: { quality: "high", motion: "full", transparency: "full", contrast: "normal", pointerLighting: true, reactivePanels: true, parallax: true },
      field: { preset: "constellation", density: .48, energy: .62, speed: .38, interactive: true },
      budget: "balanced"
    },
    "presentation-showcase": {
      label: "Presentation Showcase",
      description: "Auric flagship composition for demonstrations, launches, and public presentation.",
      scene: "auric-throne",
      transition: "gate",
      engine: { quality: "high", motion: "full", transparency: "full", glowStrength: 1.12, atmosphereStrength: 1.02 },
      field: { preset: "orbitals", density: .54, energy: .68, speed: .42, interactive: true },
      budget: "showcase"
    },
    "celebration": {
      label: "Celebration",
      description: "Finite high-spectrum celebration for verified completion and reveals.",
      scene: "nebula-celebration",
      transition: "bloom",
      cue: "showcase",
      engine: { quality: "high", motion: "full", glowStrength: 1.22, atmosphereStrength: 1.12 },
      field: { preset: "stardust", density: .82, energy: .96, speed: .62, interactive: true },
      budget: "showcase"
    },
    "low-power": {
      label: "Low Power",
      description: "Opaque, static, low-cost fallback that keeps the design language coherent.",
      scene: "quiet-operations",
      engine: { quality: "low", motion: "off", transparency: "off", contrast: "high", pointerLighting: false, reactivePanels: false, parallax: false, trackScroll: false, intensity: .42, glowStrength: .28, atmosphereStrength: .25 },
      field: { preset: "off", density: 0, energy: 0, speed: 0, interactive: false },
      budget: "low-power"
    }
  });

  function clone(value) { return JSON.parse(JSON.stringify(value)); }

  function assertObject(value, label) {
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be an object.`);
  }

  function safeString(value, max = 500) {
    const text = String(value ?? "").trim();
    if (text.length > max) throw new Error(`Text exceeds ${max} characters.`);
    return text;
  }

  class AXMPresetVault {
    constructor(engine, options = {}) {
      if (!engine?.root) throw new Error("AXMPresetVault requires a mounted AXMVisualEngine instance.");
      this.engine = engine;
      this.root = engine.root;
      this.field = options.field || null;
      this.lighting = options.lighting || null;
      this.scenes = options.scenes || null;
      this.transitions = options.transitions || null;
      this.surfaces = options.surfaces || null;
      this.cues = options.cues || null;
      this.storageKey = options.storageKey || "axm.aetherglass.presets.v7";
      this.persistence = Boolean(options.persistence);
      this.presets = new Map(Object.entries(BUILT_INS).map(([name, preset]) => [name, { ...clone(preset), builtIn: true }]));
      this.active = null;
      this.snapshot = null;
      this.appliedSurfaces = [];
      this._budgetRecord = null;
      this.destroyed = false;
      if (this.persistence) this.load();
    }

    static get version() { return VERSION; }
    static get builtIns() { return Object.keys(BUILT_INS); }

    connect(parts = {}) {
      for (const key of ["field", "lighting", "scenes", "transitions", "surfaces", "cues"]) {
        if (parts[key] !== undefined) this[key] = parts[key];
      }
      return this;
    }

    register(name, definition, options = {}) {
      if (this.destroyed) return false;
      const key = String(name || "").trim();
      if (!NAME_PATTERN.test(key)) throw new Error("Preset names must be 2–64 letters, numbers, dashes, or underscores.");
      if (this.presets.has(key) && !options.replace) return false;
      if (this.presets.get(key)?.builtIn) return false;
      const normalized = this._validate(definition);
      this.presets.set(key, { ...normalized, builtIn: false });
      if (this.persistence && options.persist !== false) this.save();
      return true;
    }

    unregister(name, options = {}) {
      const preset = this.presets.get(name);
      if (!preset || preset.builtIn) return false;
      const removed = this.presets.delete(name);
      if (removed && this.persistence && options.persist !== false) this.save();
      return removed;
    }

    get(name) {
      const preset = this.presets.get(name);
      return preset ? clone(preset) : null;
    }

    list() {
      return Array.from(this.presets.entries()).map(([name, preset]) => ({
        name,
        label: preset.label,
        description: preset.description,
        scene: preset.scene || null,
        budget: preset.budget || "balanced",
        builtIn: Boolean(preset.builtIn),
        tags: [...(preset.tags || [])]
      }));
    }

    async apply(name, options = {}) {
      if (this.destroyed) return { applied: false, reason: "destroyed" };
      const preset = this.presets.get(name);
      if (!preset) return { applied: false, reason: "unknown-preset" };
      if (!this.snapshot) this.snapshot = this._capture();

      const transitionName = options.transition === false ? null : (options.transition || preset.transition || null);
      const applyCore = () => {
        if (preset.scene && this.scenes?.apply) {
          const okay = this.scenes.apply(preset.scene, { transitionDuration: 0, persist: false });
          if (!okay) throw new Error(`Unknown scene in production preset: ${preset.scene}`);
        }
        if (preset.engine) this.engine.applyConfig(preset.engine, { persist: false });
        if (preset.field && this.field) this._applyField(preset.field);
        if (preset.lighting && this.lighting?.setScene) this.lighting.setScene(preset.lighting, { applyEngine: false });
        this._applyBudget(preset.budget || "balanced");
        this._applySurfaces(preset.surfaces || []);
        return { preset: name };
      };

      let transitionResult = null;
      if (transitionName && this.transitions?.run) transitionResult = await this.transitions.run(transitionName, applyCore, { duration: options.duration });
      else applyCore();

      if (preset.cue && options.cue !== false && this.cues?.play) {
        this.cues.play(preset.cue, { target: options.target || this.root });
      }
      this.active = name;
      this._emit("applied", { preset: name, budget: preset.budget || "balanced", transition: transitionName });
      return { applied: true, preset: name, transition: transitionResult, state: this.getState() };
    }

    restore(options = {}) {
      if (!this.snapshot) return false;
      this.cues?.stop?.("preset-restore");
      this.transitions?.cancel?.("preset-restore");
      for (const target of this.appliedSurfaces.splice(0)) this.surfaces?.restore?.(target);
      if (this.scenes?.getState?.().snapshotHeld) this.scenes.restore({ transitionDuration: 0, persist: false });
      if (this.lighting?.sceneRestore) this.lighting.restoreScene();
      const snapshot = this.snapshot;
      if (snapshot.activeScene && this.scenes?.apply) this.scenes.apply(snapshot.activeScene, { transitionDuration: 0, persist: false });
      if (snapshot.lightingScene && this.lighting?.setScene) this.lighting.setScene(snapshot.lightingScene, { applyEngine: false });
      this.engine.applyConfig(snapshot.engine, { persist: false });
      if (snapshot.field && this.field) this._applyField(snapshot.field);
      this._restoreBudget();
      const previous = this.active;
      this.active = null;
      this.snapshot = null;
      this._emit("restored", { previous });
      if (options.persist && this.engine._persistPreferences) this.engine._persistPreferences();
      return true;
    }

    export(name = null) {
      if (name) {
        const preset = this.presets.get(name);
        if (!preset) return null;
        return JSON.stringify({ module: "axm.visual.production-preset", version: VERSION, name, preset: clone(preset) }, null, 2);
      }
      const custom = {};
      for (const [key, preset] of this.presets) if (!preset.builtIn) custom[key] = clone(preset);
      return JSON.stringify({ module: "axm.visual.production-preset-vault", version: VERSION, presets: custom }, null, 2);
    }

    import(input, options = {}) {
      let parsed = input;
      if (typeof input === "string") parsed = JSON.parse(input);
      assertObject(parsed, "Preset import");
      const entries = parsed.presets ? Object.entries(parsed.presets) : [[options.name || parsed.name, parsed.preset || parsed]];
      const result = { imported: [], rejected: [] };
      for (const [name, definition] of entries) {
        try {
          const okay = this.register(name, definition, { replace: Boolean(options.replace), persist: false });
          if (okay) result.imported.push(name);
          else result.rejected.push({ name, reason: "exists-or-built-in" });
        } catch (error) {
          result.rejected.push({ name, reason: error.message });
        }
      }
      if (this.persistence && options.persist !== false) this.save();
      return result;
    }

    save() {
      if (!this.persistence || !global.localStorage) return false;
      global.localStorage.setItem(this.storageKey, this.export());
      return true;
    }

    load() {
      if (!this.persistence || !global.localStorage) return { imported: [], rejected: [], reason: "persistence-disabled" };
      const raw = global.localStorage.getItem(this.storageKey);
      if (!raw) return { imported: [], rejected: [], reason: "empty" };
      return this.import(raw, { replace: true, persist: false });
    }

    clearPersisted() {
      if (!global.localStorage) return false;
      global.localStorage.removeItem(this.storageKey);
      return true;
    }

    getState() {
      return {
        version: VERSION,
        active: this.active,
        presetCount: this.presets.size,
        customCount: Array.from(this.presets.values()).filter((preset) => !preset.builtIn).length,
        snapshotHeld: Boolean(this.snapshot),
        persistence: this.persistence,
        budget: this.root.getAttribute("data-axm-budget"),
        destroyed: this.destroyed,
        codeFreeDefinitions: true,
        localOnly: true,
        telemetry: false
      };
    }

    destroy(options = {}) {
      if (this.destroyed) return this;
      if (options.restore !== false) this.restore();
      this.presets.clear();
      this.destroyed = true;
      return this;
    }

    _validate(definition) {
      assertObject(definition, "Preset definition");
      for (const key of Object.keys(definition)) if (!TOP_KEYS.has(key)) throw new Error(`Unsupported preset key: ${key}`);
      const preset = {
        label: safeString(definition.label || "Custom Preset", 100),
        description: safeString(definition.description || "Local custom visual preset.", 500),
        tags: Array.isArray(definition.tags) ? definition.tags.slice(0, 12).map((item) => safeString(item, 40)) : []
      };
      if (definition.scene !== undefined) preset.scene = safeString(definition.scene, 64);
      if (definition.transition !== undefined) preset.transition = safeString(definition.transition, 32);
      if (definition.cue !== undefined) preset.cue = safeString(definition.cue, 64);
      if (definition.lighting !== undefined) preset.lighting = safeString(definition.lighting, 64);
      if (definition.budget !== undefined) {
        if (!BUDGETS.has(definition.budget)) throw new Error(`Unknown production budget: ${definition.budget}`);
        preset.budget = definition.budget;
      }
      if (definition.engine !== undefined) {
        assertObject(definition.engine, "Preset engine config");
        for (const key of Object.keys(definition.engine)) if (!ENGINE_KEYS.has(key)) throw new Error(`Unsupported engine key: ${key}`);
        preset.engine = clone(definition.engine);
      }
      if (definition.field !== undefined) {
        assertObject(definition.field, "Preset field config");
        for (const key of Object.keys(definition.field)) if (!FIELD_KEYS.has(key)) throw new Error(`Unsupported field key: ${key}`);
        preset.field = clone(definition.field);
      }
      if (definition.surfaces !== undefined) {
        if (!Array.isArray(definition.surfaces) || definition.surfaces.length > 24) throw new Error("Preset surfaces must be an array of at most 24 entries.");
        preset.surfaces = definition.surfaces.map((item) => {
          assertObject(item, "Surface preset entry");
          const target = safeString(item.target, 300);
          const recipe = safeString(item.recipe, 64);
          if (!target || !recipe) throw new Error("Surface entries require target and recipe.");
          return { target, recipe, overrides: item.overrides ? clone(item.overrides) : {} };
        });
      }
      return preset;
    }

    _capture() {
      const field = this.field?.getState?.();
      return {
        engine: this.engine.getConfig(),
        field: field ? { preset: field.preset, density: field.density, energy: field.energy, speed: field.speed, interactive: field.interactive } : null,
        lightingScene: this.lighting?.getState?.().scene || null,
        activeScene: this.scenes?.getState?.().active || null,
        budget: this.root.getAttribute("data-axm-budget")
      };
    }

    _applyField(config) {
      if (config.preset !== undefined) this.field.setPreset(config.preset);
      if (config.density !== undefined) this.field.setDensity(config.density);
      if (config.energy !== undefined) this.field.setEnergy(config.energy);
      if (config.speed !== undefined) this.field.setSpeed(config.speed);
      if (config.interactive !== undefined) this.field.setInteractive(config.interactive);
    }

    _applySurfaces(entries) {
      if (!this.surfaces) return;
      for (const item of entries) {
        const result = this.surfaces.apply(item.target, item.recipe, item.overrides || {});
        if (result?.applied) this.appliedSurfaces.push(item.target);
      }
    }

    _applyBudget(value) {
      const budget = BUDGETS.has(value) ? value : "balanced";
      if (!this._budgetRecord) this._budgetRecord = { original: this.root.getAttribute("data-axm-budget"), lastApplied: null };
      this.root.setAttribute("data-axm-budget", budget);
      this._budgetRecord.lastApplied = budget;
    }

    _restoreBudget() {
      if (!this._budgetRecord) return;
      if (this.root.getAttribute("data-axm-budget") === this._budgetRecord.lastApplied) {
        if (this._budgetRecord.original === null) this.root.removeAttribute("data-axm-budget");
        else this.root.setAttribute("data-axm-budget", this._budgetRecord.original);
      }
      this._budgetRecord = null;
    }

    _emit(name, detail) {
      if (!this.root || typeof global.CustomEvent !== "function") return;
      this.root.dispatchEvent(new global.CustomEvent(`axmpreset:${name}`, { detail }));
    }
  }

  global.AXMPresetVault = AXMPresetVault;
})(typeof window !== "undefined" ? window : globalThis);
