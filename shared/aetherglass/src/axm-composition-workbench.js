/*
 * AXM Composition Workbench v7.1.0
 * Approval-first orchestration for code-free visual blueprints.
 * It coordinates existing visual organs without replacing their ownership boundaries.
 */
(function attachAXMCompositionWorkbench(global) {
  "use strict";

  const VERSION = "7.1.0";
  const NAME_PATTERN = /^[a-z0-9][a-z0-9-_]{1,63}$/i;
  const MAX_BLUEPRINTS = 64;
  const BUILT_INS = Object.freeze({
    "sovereign-command": {
      module: "axm.visual.composition", version: VERSION, label: "Sovereign Command", description: "A disciplined aurora command world with restrained luxury light.", policy: "production-safe", tokenPack: "sovereign-aurora", scene: "aether-command", budget: "balanced", transition: "prism",
      engine: { intensity: 1.08, atmosphereStrength: .92, glowStrength: .98, quality: "auto", motion: "auto", parallax: true },
      field: { preset: "constellation", density: .42, energy: .56, speed: .32, interactive: true },
      surfaces: [{ target: "#authoringSandbox .authoring-primary", recipe: "prism-vault", wake: true }, { target: "#authoringSandbox .authoring-secondary", recipe: "black-diamond" }],
      tags: ["command", "luxury", "balanced"]
    },
    "quiet-proof": {
      module: "axm.visual.composition", version: VERSION, label: "Quiet Proof", description: "High-readability proof and verification environment for long review sessions.", policy: "workspace", tokenPack: "quiet-crystal", scene: "quiet-operations", budget: "workspace", transition: "veil",
      engine: { intensity: .76, atmosphereStrength: .48, glowStrength: .48, quality: "auto", motion: "reduced", transparency: "auto", contrast: "auto", parallax: false },
      field: { preset: "off", density: 0, energy: 0, speed: 0, interactive: false },
      surfaces: [{ target: "#authoringSandbox .authoring-primary", recipe: "clean-room" }, { target: "#authoringSandbox .authoring-secondary", recipe: "moonstone" }],
      tags: ["review", "proof", "readable"]
    },
    "creation-forge": {
      module: "axm.visual.composition", version: VERSION, label: "Creation Forge", description: "Warm creative energy with controlled depth and finite embers.", policy: "showcase", tokenPack: "ember-forge", scene: "solar-forge", budget: "balanced", transition: "prism", cue: "awakening",
      engine: { intensity: 1.22, atmosphereStrength: 1.08, glowStrength: 1.18, quality: "high", motion: "full", parallax: true },
      field: { preset: "embers", density: .48, energy: .7, speed: .48, interactive: true },
      surfaces: [{ target: "#authoringSandbox .authoring-primary", recipe: "auric-glass", wake: true }, { target: "#authoringSandbox .authoring-secondary", recipe: "phantom-silk" }],
      tags: ["create", "forge", "warm"]
    },
    "living-library": {
      module: "axm.visual.composition", version: VERSION, label: "Living Library", description: "A calm knowledge-space with subtle biological light and minimal particle movement.", policy: "workspace", tokenPack: "phantom-cyan", scene: "living-network", budget: "workspace", transition: "bloom",
      engine: { intensity: .92, atmosphereStrength: .72, glowStrength: .76, quality: "auto", motion: "reduced", parallax: false },
      field: { preset: "fireflies", density: .24, energy: .34, speed: .18, interactive: false },
      surfaces: [{ target: "#authoringSandbox .authoring-primary", recipe: "liquid-neon" }, { target: "#authoringSandbox .authoring-secondary", recipe: "clean-room" }],
      tags: ["library", "living", "calm"]
    },
    "showcase-portal": {
      module: "axm.visual.composition", version: VERSION, label: "Showcase Portal", description: "A cinematic portal composition for presentations and public demonstrations.", policy: "showcase", tokenPack: "rose-gold-sanctum", scene: "auric-throne", budget: "showcase", transition: "prism", cue: "showcase",
      engine: { intensity: 1.42, atmosphereStrength: 1.28, glowStrength: 1.34, quality: "high", motion: "full", parallax: true },
      field: { preset: "orbitals", density: .62, energy: .76, speed: .52, interactive: true },
      surfaces: [{ target: "#authoringSandbox .authoring-primary", recipe: "auric-glass", wake: true }, { target: "#authoringSandbox .authoring-secondary", recipe: "prism-vault", wake: true }],
      tags: ["showcase", "portal", "cinematic"]
    },
    "accessible-night": {
      module: "axm.visual.composition", version: VERSION, label: "Accessible Night", description: "Opaque, high-contrast, motion-reduced composition for accessibility-first operation.", policy: "accessibility", tokenPack: "accessible-night", scene: "quiet-operations", budget: "accessibility", transition: "none",
      engine: { intensity: .68, atmosphereStrength: .34, glowStrength: .30, quality: "low", motion: "off", transparency: "off", contrast: "high", pointerLighting: false, reactivePanels: false, parallax: false },
      field: { preset: "off", density: 0, energy: 0, speed: 0, interactive: false },
      surfaces: [{ target: "#authoringSandbox .authoring-primary", recipe: "clean-room" }, { target: "#authoringSandbox .authoring-secondary", recipe: "clean-room" }],
      tags: ["accessible", "opaque", "quiet"]
    }
  });

  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function resolveElements(root, selector) {
    try { return Array.from(root.querySelectorAll(selector)); } catch (_) { return []; }
  }
  function fieldSnapshot(field) {
    const state = field?.getState?.();
    return state ? { preset: state.preset, density: state.density, energy: state.energy, speed: state.speed, interactive: state.interactive } : null;
  }
  function same(a, b) { return JSON.stringify(a) === JSON.stringify(b); }

  class AXMCompositionWorkbench {
    constructor(engine, options = {}) {
      if (!engine?.getConfig || !engine?.applyConfig) throw new Error("AXMCompositionWorkbench requires an AXMVisualEngine instance.");
      this.engine = engine;
      this.root = options.root || engine.document || global.document;
      this.field = options.field || null;
      this.scenes = options.scenes || null;
      this.transitions = options.transitions || null;
      this.surfaces = options.surfaces || null;
      this.tokens = options.tokens || null;
      this.contracts = options.contracts || null;
      this.cues = options.cues || null;
      this.blueprints = new Map(Object.entries(BUILT_INS).map(([name, value]) => [name, { ...clone(value), builtIn: true }]));
      this.snapshot = null;
      this.active = null;
      this.appliedSurfaceTargets = [];
      this.lastApplied = null;
      this.destroyed = false;
    }

    static get version() { return VERSION; }
    static get builtIns() { return Object.keys(BUILT_INS); }

    connect(parts = {}) {
      for (const key of ["field", "scenes", "transitions", "surfaces", "tokens", "contracts", "cues"]) if (parts[key] !== undefined) this[key] = parts[key];
      return this;
    }

    register(name, definition, options = {}) {
      if (this.destroyed) return false;
      const key = String(name || "").trim().toLowerCase();
      if (!NAME_PATTERN.test(key)) throw new Error("Blueprint names must be 2–64 letters, numbers, dashes, or underscores.");
      if (this.blueprints.get(key)?.builtIn) return false;
      if (this.blueprints.has(key) && options.replace !== true) return false;
      if (!this.blueprints.has(key) && this.blueprints.size >= MAX_BLUEPRINTS) throw new Error(`Blueprint limit reached (${MAX_BLUEPRINTS}).`);
      const report = this.contracts?.validate ? this.contracts.validate(definition, { policy: definition.policy }) : { valid: true, contract: clone(definition) };
      if (!report.valid) throw new Error(`Blueprint contract rejected: ${report.errors[0]?.message || "invalid contract"}`);
      this.blueprints.set(key, { ...clone(report.contract), builtIn: false });
      this._emit("registered", { name: key });
      return true;
    }

    unregister(name) {
      const blueprint = this.blueprints.get(name);
      if (!blueprint || blueprint.builtIn || this.active === name) return false;
      return this.blueprints.delete(name);
    }

    get(name) {
      const blueprint = this.blueprints.get(name);
      return blueprint ? clone(blueprint) : null;
    }

    list() {
      return Array.from(this.blueprints.entries()).map(([name, item]) => ({ name, label: item.label, description: item.description, policy: item.policy || "production-safe", tokenPack: item.tokenPack || null, scene: item.scene || null, budget: item.budget || "balanced", builtIn: Boolean(item.builtIn), tags: [...(item.tags || [])] }));
    }

    preview(nameOrDefinition, options = {}) {
      const blueprint = typeof nameOrDefinition === "string" ? this.blueprints.get(nameOrDefinition) : nameOrDefinition;
      if (!blueprint) return { valid: false, rejected: "unknown-blueprint", mutations: 0 };
      const contractDefinition = clone(blueprint);
      delete contractDefinition.builtIn;
      const report = this.contracts?.validate ? this.contracts.validate(contractDefinition, { policy: blueprint.policy }) : { valid: true, score: 100, grade: "A", fingerprint: null, warnings: [], errors: [], selectorImpact: [] };
      const surfaceImpact = (blueprint.surfaces || []).map((entry) => {
        const elements = resolveElements(this.root, entry.target);
        return { target: entry.target, recipe: entry.recipe, matched: elements.length, alreadyComposed: elements.filter((element) => element.classList.contains("axm-surface-composed")).length, wake: Boolean(entry.wake) };
      });
      const transitionNames = this.transitions?.constructor?.transitions || [];
      const cueNames = this.cues?.list?.().map((item) => item.name) || [];
      return {
        version: VERSION,
        name: typeof nameOrDefinition === "string" ? nameOrDefinition : null,
        label: blueprint.label,
        valid: report.valid,
        policy: report.policy,
        score: report.score,
        grade: report.grade,
        fingerprint: report.fingerprint,
        errors: report.errors,
        warnings: report.warnings,
        tokenPackAvailable: !blueprint.tokenPack || Boolean(this.tokens?.get?.(blueprint.tokenPack)),
        sceneAvailable: !blueprint.scene || Boolean(this.scenes?.get?.(blueprint.scene)),
        transitionAvailable: !blueprint.transition || blueprint.transition === "none" || !this.transitions || transitionNames.includes(blueprint.transition),
        cueAvailable: !blueprint.cue || !this.cues || cueNames.includes(blueprint.cue),
        surfaceImpact,
        totalMatchedSurfaces: surfaceImpact.reduce((sum, item) => sum + item.matched, 0),
        alreadyComposed: surfaceImpact.reduce((sum, item) => sum + item.alreadyComposed, 0),
        mutations: 0,
        approvalRequired: true,
        automaticRewrite: false,
        laterPlatformChangesPreserved: true
      };
    }

    async apply(name, options = {}) {
      if (this.destroyed) return { applied: false, reason: "destroyed" };
      if (options.approved !== true) return { applied: false, reason: "approval-required", approvalRequired: true };
      const blueprint = this.blueprints.get(name);
      if (!blueprint) return { applied: false, reason: "unknown-blueprint" };
      const preview = this.preview(name);
      if (!preview.valid) return { applied: false, reason: "contract-invalid", preview };
      if (!preview.tokenPackAvailable) return { applied: false, reason: "unknown-token-pack", preview };
      if (!preview.sceneAvailable) return { applied: false, reason: "unknown-scene", preview };
      if (!preview.transitionAvailable) return { applied: false, reason: "unknown-transition", preview };
      if (!preview.cueAvailable) return { applied: false, reason: "unknown-cue", preview };
      if (preview.alreadyComposed > 0 && options.replaceComposed !== true) return { applied: false, reason: "precomposed-surface-review-required", preview };

      if (this.snapshot) this.restore({ reason: "replace-composition" });
      this.snapshot = this._capture();
      const applyCore = () => {
        if (blueprint.tokenPack && this.tokens) this.tokens.apply(blueprint.tokenPack, this.engine.root, { approved: true });
        if (blueprint.scene && this.scenes?.apply) this.scenes.apply(blueprint.scene, { transitionDuration: 0, persist: false });
        if (blueprint.engine) this.engine.applyConfig(blueprint.engine, { persist: false });
        if (blueprint.field && this.field) this._applyField(blueprint.field);
        this._applyBudget(blueprint.budget || "balanced");
        this._applySurfaces(blueprint.surfaces || []);
        return { blueprint: name };
      };

      let transitionResult = null;
      const transitionName = options.transition === false ? null : (options.transition || blueprint.transition || null);
      if (transitionName && transitionName !== "none" && this.transitions?.run) transitionResult = await this.transitions.run(transitionName, applyCore, { duration: options.duration });
      else applyCore();
      if (blueprint.cue && options.cue !== false && this.cues?.play) this.cues.play(blueprint.cue, { target: options.target || this.engine.root });
      this.active = name;
      this.lastApplied = { engine: this.engine.getConfig(), field: fieldSnapshot(this.field), scene: this.scenes?.getState?.().active || null, budget: this.engine.root.getAttribute("data-axm-budget"), tokenPack: this.engine.root.getAttribute("data-axm-token-pack") };
      this._emit("applied", { name, transition: transitionName, fingerprint: preview.fingerprint });
      return { applied: true, name, transition: transitionResult, preview, state: this.getState() };
    }

    restore(options = {}) {
      if (!this.snapshot) return false;
      this.cues?.stop?.(options.reason || "workbench-restore");
      this.transitions?.cancel?.(options.reason || "workbench-restore");
      for (const target of this.appliedSurfaceTargets.splice(0)) {
        this.surfaces?.wake?.(target, false);
        this.surfaces?.restore?.(target);
      }
      const current = this.engine.getConfig();
      const currentField = fieldSnapshot(this.field);
      const currentScene = this.scenes?.getState?.().active || null;
      if (currentScene === this.lastApplied?.scene && this.scenes) {
        if (this.snapshot.scene && this.scenes.apply) this.scenes.apply(this.snapshot.scene, { transitionDuration: 0, persist: false });
        else if (this.scenes.getState?.().snapshotHeld && this.scenes.restore) this.scenes.restore({ transitionDuration: 0, persist: false });
      }
      const finalEngine = {};
      for (const [key, value] of Object.entries(this.snapshot.engine)) finalEngine[key] = same(current[key], this.lastApplied?.engine?.[key]) ? value : current[key];
      this.engine.applyConfig(finalEngine, { persist: false });
      if (this.field && this.snapshot.field && this.lastApplied?.field) {
        const finalField = {};
        for (const [key, value] of Object.entries(this.snapshot.field)) finalField[key] = same(currentField?.[key], this.lastApplied.field[key]) ? value : currentField?.[key];
        this._applyField(finalField);
      }
      this._restoreBudget();
      if (this.tokens && this.snapshot.tokens) this.tokens.restoreSnapshot(this.snapshot.tokens);
      const restoredName = this.active;
      this.snapshot = null;
      this.active = null;
      this.lastApplied = null;
      this._emit("restored", { name: restoredName });
      return true;
    }

    export(name, space = 2) {
      const blueprint = this.get(name);
      if (!blueprint) throw new Error(`Unknown blueprint: ${name}`);
      delete blueprint.builtIn;
      return JSON.stringify({ module: "axm.visual.composition", version: VERSION, name, blueprint }, null, Math.max(0, Math.min(8, Number(space) || 2)));
    }

    import(input, options = {}) {
      let parsed = input;
      if (typeof input === "string") parsed = JSON.parse(input);
      if (!parsed || typeof parsed !== "object") throw new Error("Blueprint import must be an object or JSON object string.");
      const name = String(parsed.name || options.name || "").trim().toLowerCase();
      return this.register(name, parsed.blueprint || parsed, { replace: options.replace === true });
    }

    getState() {
      return { version: VERSION, blueprints: this.blueprints.size, builtIns: Object.keys(BUILT_INS).length, active: this.active, snapshotHeld: Boolean(this.snapshot), appliedSurfaceTargets: this.appliedSurfaceTargets.length, approvalRequired: true, codeFreeBlueprints: true, automaticRewrite: false, localOnly: true, telemetry: false, destroyed: this.destroyed };
    }

    destroy(options = {}) {
      if (this.destroyed) return this;
      if (options.restore !== false) this.restore({ reason: "destroy" });
      this.blueprints.clear();
      this.destroyed = true;
      return this;
    }

    _capture() {
      return { engine: this.engine.getConfig(), field: fieldSnapshot(this.field), scene: this.scenes?.getState?.().active || null, budget: this.engine.root.getAttribute("data-axm-budget"), tokens: this.tokens?.capture?.(this.engine.root) || null };
    }

    _applyField(config = {}) {
      if (config.preset !== undefined) this.field.setPreset(config.preset);
      if (config.density !== undefined) this.field.setDensity(config.density);
      if (config.energy !== undefined) this.field.setEnergy(config.energy);
      if (config.speed !== undefined) this.field.setSpeed(config.speed);
      if (config.interactive !== undefined) this.field.setInteractive(config.interactive);
    }

    _applySurfaces(entries) {
      if (!this.surfaces) return;
      for (const item of entries) {
        const elements = resolveElements(this.root, item.target).filter((element) => !element.classList.contains("axm-surface-composed"));
        if (!elements.length) continue;
        const result = this.surfaces.apply(elements, item.recipe, item.overrides || {});
        if (result?.applied) {
          this.appliedSurfaceTargets.push(elements);
          if (item.wake) this.surfaces.wake(elements, true);
        }
      }
    }

    _applyBudget(value) {
      if (!this._budgetRecord) this._budgetRecord = { original: this.engine.root.getAttribute("data-axm-budget"), lastApplied: null };
      this.engine.root.setAttribute("data-axm-budget", value);
      this._budgetRecord.lastApplied = value;
    }

    _restoreBudget() {
      if (!this._budgetRecord) return;
      if (this.engine.root.getAttribute("data-axm-budget") === this._budgetRecord.lastApplied) {
        if (this._budgetRecord.original === null) this.engine.root.removeAttribute("data-axm-budget");
        else this.engine.root.setAttribute("data-axm-budget", this._budgetRecord.original);
      }
      this._budgetRecord = null;
    }

    _emit(name, detail) {
      if (!this.engine.root || typeof global.CustomEvent !== "function") return;
      this.engine.root.dispatchEvent(new global.CustomEvent(`axmworkbench:${name}`, { detail }));
    }
  }

  global.AXMCompositionWorkbench = AXMCompositionWorkbench;
})(typeof window !== "undefined" ? window : globalThis);
