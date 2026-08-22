/*
 * AXM Performance Governor v7.1.0
 * Transparent local frame sampler and explicit visual-budget controller.
 * Recommendation mode changes nothing. Adaptive mode must be explicitly chosen
 * and may only reduce visual cost; it never silently upgrades spectacle.
 */
(function attachAXMPerformanceGovernor(global) {
  "use strict";

  const VERSION = "7.1.0";
  const DEFAULTS = Object.freeze({
    mode: "recommend",
    sampleFrames: 120,
    warmupFrames: 20,
    targetFps: 45,
    minimumFps: 28,
    autoStop: true,
    field: null
  });

  const PROFILES = Object.freeze({
    showcase: {
      label: "Showcase",
      engine: { quality: "high", motion: "full", transparency: "full", contrast: "normal", pointerLighting: true, reactivePanels: true, parallax: true, glowStrength: 1.12, atmosphereStrength: 1.02 },
      field: { preset: "stardust", density: .72, energy: .82, speed: .56, interactive: true }
    },
    balanced: {
      label: "Balanced",
      engine: { quality: "balanced", motion: "auto", transparency: "auto", contrast: "auto", pointerLighting: true, reactivePanels: true, parallax: true, glowStrength: .88, atmosphereStrength: .82 },
      field: { density: .48, energy: .62, speed: .40, interactive: true }
    },
    workspace: {
      label: "Workspace",
      engine: { quality: "balanced", motion: "reduced", transparency: "auto", contrast: "auto", pointerLighting: true, reactivePanels: true, parallax: false, glowStrength: .58, atmosphereStrength: .52 },
      field: { density: .20, energy: .30, speed: .18, interactive: false }
    },
    "low-power": {
      label: "Low Power",
      engine: { quality: "low", motion: "off", transparency: "off", contrast: "high", pointerLighting: false, reactivePanels: false, parallax: false, trackScroll: false, glowStrength: .25, atmosphereStrength: .22 },
      field: { preset: "off", density: 0, energy: 0, speed: 0, interactive: false }
    },
    accessibility: {
      label: "Accessibility",
      engine: { quality: "balanced", motion: "reduced", transparency: "off", contrast: "high", pointerLighting: false, reactivePanels: false, parallax: false, glowStrength: .38, atmosphereStrength: .34 },
      field: { preset: "off", density: 0, energy: 0, speed: 0, interactive: false }
    }
  });

  function clamp(value, min, max, fallback = min) {
    const number = Number(value);
    return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
  }

  function percentile(values, value) {
    if (!values.length) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(value * sorted.length) - 1));
    return sorted[index];
  }

  class AXMPerformanceGovernor {
    constructor(engine, options = {}) {
      if (!engine?.root) throw new Error("AXMPerformanceGovernor requires a mounted AXMVisualEngine instance.");
      this.engine = engine;
      this.root = engine.root;
      this.options = { ...DEFAULTS, ...options };
      this.field = this.options.field || null;
      this.running = false;
      this.frames = [];
      this.totalFrames = 0;
      this._lastTime = 0;
      this._raf = 0;
      this.report = null;
      this.applied = null;
      this._budgetRecord = null;
    }

    static get version() { return VERSION; }
    static get profiles() { return Object.keys(PROFILES); }

    start() {
      if (this.running) return this;
      this.frames = [];
      this.totalFrames = 0;
      this.report = null;
      this.running = true;
      this._lastTime = global.performance?.now?.() || Date.now();
      this._raf = global.requestAnimationFrame((time) => this._frame(time));
      this._emit("started", this.getState());
      return this;
    }

    stop() {
      if (!this.running) return this;
      this.running = false;
      if (this._raf) global.cancelAnimationFrame(this._raf);
      this._raf = 0;
      this.report = this._buildReport();
      this._emit("report", this.report);
      if (this.options.mode === "adaptive" && this.report.recommendation.action === "reduce") this.applyRecommendation();
      return this;
    }

    recommendDeviceProfile() {
      const environment = this._environment();
      if (environment.reducedMotion) return { profile: "accessibility", reason: "The operating system requests reduced motion." };
      if (environment.saveData) return { profile: "low-power", reason: "The device requests reduced data/energy use." };
      if ((environment.deviceMemory && environment.deviceMemory <= 4) || (environment.hardwareConcurrency && environment.hardwareConcurrency <= 4)) {
        return { profile: "workspace", reason: "Conservative device capacity signals favor the workspace budget." };
      }
      if (environment.devicePixelRatio > 2.25 && (environment.deviceMemory || 8) <= 8) {
        return { profile: "workspace", reason: "High pixel density increases rendering cost on a moderate device." };
      }
      return { profile: "balanced", reason: "No strong device pressure signal was detected." };
    }

    applyRecommendation() {
      if (!this.report) this.report = this._buildReport();
      const recommendation = this.report.recommendation;
      if (!recommendation || recommendation.action !== "reduce") return false;
      return this.applyProfile(recommendation.profile || (recommendation.quality === "low" ? "low-power" : "workspace"), { source: "frame-recommendation", recommendation });
    }

    applyProfile(name, options = {}) {
      const profile = PROFILES[name];
      if (!profile) return false;
      if (this.applied && options.replace !== true) return false;
      if (this.applied && options.replace === true) this.restoreApplied();
      const fieldState = this.field?.getState?.();
      const before = {
        engine: this.engine.getConfig(),
        field: fieldState ? { preset: fieldState.preset, density: fieldState.density, energy: fieldState.energy, speed: fieldState.speed, interactive: fieldState.interactive } : null,
        budget: this.root.getAttribute("data-axm-budget")
      };
      this.engine.applyConfig(profile.engine, { persist: false });
      if (this.field && profile.field) this._applyField(profile.field);
      this._setBudget(name);
      this.applied = {
        profile: name,
        source: options.source || "explicit",
        recommendation: options.recommendation || null,
        before,
        after: { engine: this.engine.getConfig(), field: this.field?.getState?.() || null, budget: this.root.getAttribute("data-axm-budget") }
      };
      this._emit("applied", this.applied);
      return true;
    }

    restoreApplied() {
      if (!this.applied) return false;
      const before = this.applied.before;
      this.engine.applyConfig(before.engine, { persist: false });
      if (before.field && this.field) this._applyField(before.field);
      this._restoreBudget(before.budget);
      const restoredProfile = this.applied.profile;
      this.applied = null;
      this._emit("restored", { restored: true, profile: restoredProfile });
      return true;
    }

    getReport() {
      return this.report || this._buildReport();
    }

    getState() {
      return {
        version: VERSION,
        running: this.running,
        mode: this.options.mode,
        sampledFrames: this.frames.length,
        totalFrames: this.totalFrames,
        reportReady: Boolean(this.report),
        recommendationApplied: Boolean(this.applied),
        appliedProfile: this.applied?.profile || null,
        budget: this.root.getAttribute("data-axm-budget"),
        profiles: Object.keys(PROFILES),
        localOnly: true,
        telemetry: false
      };
    }

    destroy(options = {}) {
      this.stop();
      if (options.restore === true) this.restoreApplied();
      this._emit("destroyed", { version: VERSION });
    }

    _frame(time) {
      if (!this.running) return;
      const delta = time - this._lastTime;
      this._lastTime = time;
      this.totalFrames += 1;
      if (this.totalFrames > this.options.warmupFrames && delta > 0 && delta < 500) this.frames.push(delta);
      const sampleFrames = Math.round(clamp(this.options.sampleFrames, 30, 600, 120));
      if (this.frames.length >= sampleFrames && this.options.autoStop) {
        this.stop();
        return;
      }
      this._raf = global.requestAnimationFrame((next) => this._frame(next));
    }

    _buildReport() {
      const frames = this.frames;
      const averageMs = frames.length ? frames.reduce((sum, value) => sum + value, 0) / frames.length : 0;
      const averageFps = averageMs ? 1000 / averageMs : 0;
      const p95Ms = percentile(frames, .95);
      const p99Ms = percentile(frames, .99);
      const longFrames = frames.filter((value) => value > 33.4).length;
      const longFrameRate = frames.length ? longFrames / frames.length : 0;
      const recommendation = this._recommend({ averageFps, p95Ms, longFrameRate });
      return {
        version: VERSION,
        sampledFrames: frames.length,
        averageFrameMs: Number(averageMs.toFixed(2)),
        averageFps: Number(averageFps.toFixed(1)),
        p95FrameMs: Number(p95Ms.toFixed(2)),
        p99FrameMs: Number(p99Ms.toFixed(2)),
        longFrameRate: Number(longFrameRate.toFixed(3)),
        environment: this._environment(),
        deviceProfileRecommendation: this.recommendDeviceProfile(),
        recommendation,
        automaticChange: this.options.mode === "adaptive",
        automaticUpgrades: false,
        localOnly: true,
        telemetry: false
      };
    }

    _recommend(metrics) {
      const current = this.engine.getState().quality;
      const target = clamp(this.options.targetFps, 24, 120, 45);
      const minimum = clamp(this.options.minimumFps, 15, target, 28);
      if (!metrics.averageFps) return { action: "insufficient-data", quality: current, profile: null, reason: "No stable frame sample was available." };
      if (metrics.averageFps < minimum || metrics.p95Ms > 58 || metrics.longFrameRate > .38) {
        return { action: "reduce", quality: "low", profile: "low-power", fieldDensity: 0, reason: "Sustained frame pressure exceeded the safe visual budget." };
      }
      if (metrics.averageFps < target || metrics.p95Ms > 38 || metrics.longFrameRate > .18) {
        return { action: "reduce", quality: "balanced", profile: "workspace", fieldDensity: .20, reason: "Workspace mode should retain identity with steadier interaction." };
      }
      return { action: "keep", quality: current, profile: null, reason: "Measured frame pacing is inside the selected target." };
    }

    _environment() {
      return {
        deviceMemory: global.navigator?.deviceMemory || null,
        hardwareConcurrency: global.navigator?.hardwareConcurrency || null,
        devicePixelRatio: global.devicePixelRatio || 1,
        saveData: Boolean(global.navigator?.connection?.saveData),
        reducedMotion: Boolean(global.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches),
        viewport: { width: global.innerWidth || null, height: global.innerHeight || null }
      };
    }

    _applyField(config) {
      if (config.preset !== undefined) this.field.setPreset(config.preset);
      if (config.density !== undefined) this.field.setDensity(config.density);
      if (config.energy !== undefined) this.field.setEnergy(config.energy);
      if (config.speed !== undefined) this.field.setSpeed(config.speed);
      if (config.interactive !== undefined) this.field.setInteractive(config.interactive);
    }

    _setBudget(name) {
      if (!this._budgetRecord) this._budgetRecord = { original: this.root.getAttribute("data-axm-budget"), lastApplied: null };
      this.root.setAttribute("data-axm-budget", name);
      this._budgetRecord.lastApplied = name;
    }

    _restoreBudget(fallback) {
      if (this._budgetRecord && this.root.getAttribute("data-axm-budget") === this._budgetRecord.lastApplied) {
        const value = this._budgetRecord.original ?? fallback;
        if (value === null || value === undefined) this.root.removeAttribute("data-axm-budget");
        else this.root.setAttribute("data-axm-budget", value);
      }
      this._budgetRecord = null;
    }

    _emit(name, detail) {
      if (!this.root || typeof global.CustomEvent !== "function") return;
      this.root.dispatchEvent(new global.CustomEvent(`axmperformance:${name}`, { detail }));
    }
  }

  global.AXMPerformanceGovernor = AXMPerformanceGovernor;
})(typeof window !== "undefined" ? window : globalThis);
