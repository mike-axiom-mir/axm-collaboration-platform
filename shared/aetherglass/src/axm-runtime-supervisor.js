/*
 * AXM Runtime Supervisor v7.1.0
 * Local health, finite stress, snapshot, and teardown coordination for the
 * Aetherglass module family. It reports observable signals only; it never claims
 * proof of memory safety from DOM counts alone.
 */
(function attachAXMRuntimeSupervisor(global) {
  "use strict";

  const VERSION = "7.1.0";
  const MODULE_KEYS = [
    "field", "lighting", "lightLayers", "scenes", "interactions", "governor", "bridge", "adapter",
    "surfaces", "transitions", "cues", "productionAdapter", "guardian", "auditor",
    "vault", "tokens", "contracts", "workbench", "orchestrator", "drift", "focus",
    "capture", "journeys"
  ];

  function wait(ms) { return new Promise((resolve) => global.setTimeout(resolve, Math.max(0, Number(ms) || 0))); }

  function safeState(module) {
    if (!module) return null;
    try { return typeof module.getState === "function" ? module.getState() : { connected: true }; }
    catch (error) { return { connected: true, stateError: error?.message || String(error) }; }
  }

  class AXMRuntimeSupervisor {
    constructor(engine, modules = {}, options = {}) {
      if (!engine?.root || !engine?.document) throw new Error("AXMRuntimeSupervisor requires a mounted AXMVisualEngine instance.");
      this.engine = engine;
      this.root = engine.root;
      this.document = engine.document;
      this.modules = {};
      this.options = { historyLimit: 120, watchInterval: 5000, ...options };
      this.history = [];
      this._watchTimer = 0;
      this._stressToken = 0;
      this.runningStress = false;
      this.destroyed = false;
      this.connect(modules);
    }

    static get version() { return VERSION; }

    connect(modules = {}) {
      for (const key of MODULE_KEYS) if (modules[key] !== undefined) this.modules[key] = modules[key];
      return this;
    }

    snapshot() {
      const field = this.modules.field?.getState?.();
      return {
        version: VERSION,
        capturedAt: Date.now(),
        engine: this.engine.getConfig(),
        field: field ? { preset: field.preset, density: field.density, energy: field.energy, speed: field.speed, interactive: field.interactive } : null,
        lightingScene: this.modules.lighting?.getState?.().scene || null,
        lightLayers: this.modules.lightLayers?.getConfig?.() || null,
        activeScene: this.modules.scenes?.getState?.().active || null,
        budget: this.root.getAttribute("data-axm-budget"),
        ownedNodes: this._ownedNodeCounts()
      };
    }

    restore(snapshot, options = {}) {
      if (!snapshot?.engine) return false;
      if (options.cancelStress !== false) this.stopStress("restore");
      this.modules.cues?.stop?.("supervisor-restore");
      this.modules.transitions?.cancel?.("supervisor-restore");
      if (this.modules.scenes?.getState?.().snapshotHeld) this.modules.scenes.restore({ transitionDuration: 0, persist: false });
      if (this.modules.lighting?.sceneRestore) this.modules.lighting.restoreScene();
      if (snapshot.lightingScene && this.modules.lighting?.setScene) this.modules.lighting.setScene(snapshot.lightingScene, { applyEngine: false });
      if (snapshot.lightLayers && this.modules.lightLayers?.applyConfig) this.modules.lightLayers.applyConfig(snapshot.lightLayers, { emit: false });
      this.engine.applyConfig(snapshot.engine, { persist: false });
      if (snapshot.field && this.modules.field) {
        this.modules.field.setPreset(snapshot.field.preset);
        this.modules.field.setDensity(snapshot.field.density);
        this.modules.field.setEnergy(snapshot.field.energy);
        this.modules.field.setSpeed(snapshot.field.speed);
        this.modules.field.setInteractive(snapshot.field.interactive);
      }
      if (snapshot.budget === null || snapshot.budget === undefined) this.root.removeAttribute("data-axm-budget");
      else this.root.setAttribute("data-axm-budget", snapshot.budget);
      return true;
    }

    health() {
      const ownedNodes = this._ownedNodeCounts();
      const duplicates = {
        atmospheres: Math.max(0, (ownedNodes.aetherglass || 0) - 1),
        fields: Math.max(0, (ownedNodes.aetherfield || 0) - (this.modules.field ? 1 : 0)),
        transitionStages: Math.max(0, (ownedNodes["transition-director"] || 0) - (this.modules.transitions ? 1 : 0))
      };
      const pageRoot = this.document.documentElement;
      const issues = [];
      if (duplicates.atmospheres) issues.push({ code: "duplicate-atmosphere", severity: "high", count: duplicates.atmospheres });
      if (duplicates.fields) issues.push({ code: "duplicate-field", severity: "high", count: duplicates.fields });
      if (duplicates.transitionStages) issues.push({ code: "duplicate-transition-stage", severity: "medium", count: duplicates.transitionStages });
      if (pageRoot.scrollWidth > pageRoot.clientWidth + 1) issues.push({ code: "horizontal-overflow", severity: "medium", pixels: pageRoot.scrollWidth - pageRoot.clientWidth });
      if (!this.engine.getState?.().mounted) issues.push({ code: "engine-not-mounted", severity: "critical" });
      const moduleStates = {};
      for (const key of MODULE_KEYS) if (this.modules[key]) moduleStates[key] = safeState(this.modules[key]);
      const result = {
        version: VERSION,
        healthy: issues.length === 0,
        issues,
        duplicates,
        ownedNodes,
        moduleStates,
        visualState: this.engine.getState(),
        page: { clientWidth: pageRoot.clientWidth, scrollWidth: pageRoot.scrollWidth },
        observableSignalsOnly: true,
        memorySafetyProven: false,
        localOnly: true,
        telemetry: false,
        capturedAt: Date.now()
      };
      return result;
    }

    async stress(options = {}) {
      if (this.destroyed) return { completed: false, reason: "destroyed" };
      if (this.runningStress) return { completed: false, reason: "busy" };
      const iterations = Math.max(1, Math.min(500, Math.round(Number(options.iterations) || 40)));
      const delay = Math.max(0, Math.min(2000, Number(options.delay) || 0));
      const restore = options.restore !== false;
      const scenes = options.scenes || this.modules.scenes?.list?.().slice(0, 8).map((item) => item.name) || [];
      const presets = options.presets || this.modules.vault?.list?.().map((item) => item.name) || [];
      if (!scenes.length && !presets.length) return { completed: false, reason: "no-switch-source" };

      const token = ++this._stressToken;
      const snapshot = this.snapshot();
      const before = this.health();
      const started = global.performance?.now?.() || Date.now();
      const errors = [];
      let completedIterations = 0;
      this.runningStress = true;

      try {
        for (let index = 0; index < iterations; index += 1) {
          if (token !== this._stressToken || this.destroyed) break;
          try {
            if (presets.length && this.modules.vault) {
              const name = presets[index % presets.length];
              const result = await this.modules.vault.apply(name, { transition: false, cue: false });
              if (!result.applied) throw new Error(result.reason || `Preset failed: ${name}`);
            } else {
              const name = scenes[index % scenes.length];
              const applied = this.modules.scenes.apply(name, { transitionDuration: 0, persist: false });
              if (!applied) throw new Error(`Scene failed: ${name}`);
            }
            if (options.fieldCycle && this.modules.field) {
              const fields = this.modules.field.constructor?.presets || ["off", "stardust"];
              this.modules.field.setPreset(fields[index % fields.length]);
            }
            completedIterations += 1;
          } catch (error) {
            errors.push({ iteration: index, message: error?.message || String(error) });
            if (options.stopOnError) break;
          }
          if (delay) await wait(delay);
          else if (index % 10 === 0) await wait(0);
        }
      } finally {
        if (restore) {
          if (this.modules.vault?.getState?.().snapshotHeld) this.modules.vault.restore();
          this.restore(snapshot, { cancelStress: false });
        }
        this.runningStress = false;
      }

      const ended = global.performance?.now?.() || Date.now();
      const after = this.health();
      const nodeDelta = {};
      const keys = new Set([...Object.keys(before.ownedNodes), ...Object.keys(after.ownedNodes)]);
      for (const key of keys) nodeDelta[key] = (after.ownedNodes[key] || 0) - (before.ownedNodes[key] || 0);
      const positiveDeltas = Object.entries(nodeDelta).filter(([, value]) => value > 0);
      const result = {
        version: VERSION,
        completed: completedIterations === iterations && errors.length === 0,
        cancelled: token !== this._stressToken,
        requestedIterations: iterations,
        completedIterations,
        durationMs: Number((ended - started).toFixed(2)),
        errors,
        before,
        after,
        nodeDelta,
        leakSignals: positiveDeltas.map(([owner, count]) => ({ owner, count, signal: "owned-dom-growth" })),
        observableSignalsOnly: true,
        memorySafetyProven: false,
        restored: restore,
        localOnly: true,
        telemetry: false
      };
      this._record({ type: "stress", ...result });
      return result;
    }

    stopStress(reason = "stopped") {
      if (!this.runningStress) return false;
      this._stressToken += 1;
      this.runningStress = false;
      this._record({ type: "stress-stop", reason, capturedAt: Date.now() });
      return true;
    }

    startWatch(options = {}) {
      if (this.destroyed || this._watchTimer) return false;
      const interval = Math.max(1000, Math.min(3600000, Number(options.interval) || this.options.watchInterval));
      this._watchTimer = global.setInterval(() => this._record({ type: "health", ...this.health() }), interval);
      this._record({ type: "watch-start", interval, capturedAt: Date.now() });
      return true;
    }

    stopWatch() {
      if (!this._watchTimer) return false;
      global.clearInterval(this._watchTimer);
      this._watchTimer = 0;
      this._record({ type: "watch-stop", capturedAt: Date.now() });
      return true;
    }

    exportHistory() {
      return JSON.stringify({ module: "axm.visual.runtime-supervisor", version: VERSION, history: this.history }, null, 2);
    }

    getState() {
      return {
        version: VERSION,
        connectedModules: Object.keys(this.modules).filter((key) => Boolean(this.modules[key])),
        watching: Boolean(this._watchTimer),
        runningStress: this.runningStress,
        historyEntries: this.history.length,
        destroyed: this.destroyed,
        observableSignalsOnly: true,
        localOnly: true,
        telemetry: false
      };
    }

    destroy() {
      if (this.destroyed) return this;
      this.stopStress("destroyed");
      this.stopWatch();
      this.modules.cues?.stop?.("supervisor-destroy");
      this.modules.transitions?.cancel?.("supervisor-destroy");
      this.modules.governor?.stop?.();
      this.modules = {};
      this.destroyed = true;
      return this;
    }

    _ownedNodeCounts() {
      const counts = {};
      for (const element of this.document.querySelectorAll("[data-axm-owned]")) {
        const owner = element.getAttribute("data-axm-owned") || "unknown";
        counts[owner] = (counts[owner] || 0) + 1;
      }
      return counts;
    }

    _record(entry) {
      this.history.push(entry);
      const limit = Math.max(1, Math.min(1000, Number(this.options.historyLimit) || 120));
      if (this.history.length > limit) this.history.splice(0, this.history.length - limit);
    }
  }

  global.AXMRuntimeSupervisor = AXMRuntimeSupervisor;
})(typeof window !== "undefined" ? window : globalThis);
