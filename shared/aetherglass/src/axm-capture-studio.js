/*
 * AXM Capture Studio v7.1.0
 * Explicit, deterministic visual preparation for screenshots, documentation and proof capture.
 * It does not capture the screen, read content, upload data, or claim GPU determinism.
 */
(function attachAXMCaptureStudio(global) {
  "use strict";

  const VERSION = "7.1.0";
  let INSTANCE = 0;
  const PROFILES = Object.freeze({
    "documentation": {
      label: "Documentation",
      description: "Quiet, readable, animation-free state for guides and technical records.",
      engine: { motion: "off", pointerLighting: false, reactivePanels: false, parallax: false, atmosphereStrength: .48, glowStrength: .5 },
      field: { preset: "off", density: 0, energy: 0, speed: 0, interactive: false },
      freezeAnimations: true,
      guides: false
    },
    "showcase-still": {
      label: "Showcase Still",
      description: "Preserves luxury depth while stopping interaction and movement for a deliberate hero frame.",
      engine: { motion: "off", quality: "high", pointerLighting: false, reactivePanels: false, parallax: false, atmosphereStrength: 1.05, glowStrength: 1.08 },
      field: { speed: 0, interactive: false },
      freezeAnimations: true,
      guides: false
    },
    "proof-record": {
      label: "Proof Record",
      description: "Opaque, high-contrast evidence state with minimal visual ambiguity.",
      engine: { motion: "off", quality: "low", transparency: "off", contrast: "high", pointerLighting: false, reactivePanels: false, parallax: false, atmosphereStrength: .24, glowStrength: .22 },
      field: { preset: "off", density: 0, energy: 0, speed: 0, interactive: false },
      freezeAnimations: true,
      guides: true
    },
    "device-frame": {
      label: "Device Frame",
      description: "Stable responsive capture with viewport guides and restrained effects.",
      engine: { motion: "off", pointerLighting: false, reactivePanels: false, parallax: false, atmosphereStrength: .62, glowStrength: .62 },
      field: { speed: 0, interactive: false },
      freezeAnimations: true,
      guides: true
    },
    "print-ready": {
      label: "Print Ready",
      description: "Opaque and animation-free preparation for browser print or PDF workflows.",
      engine: { motion: "off", quality: "low", transparency: "off", contrast: "high", pointerLighting: false, reactivePanels: false, parallax: false, atmosphereStrength: 0, glowStrength: 0 },
      field: { preset: "off", density: 0, energy: 0, speed: 0, interactive: false },
      freezeAnimations: true,
      guides: false
    }
  });

  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function same(a, b) { return JSON.stringify(a) === JSON.stringify(b); }
  function safeText(value, max = 120) { return String(value ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, max); }
  function resolve(root, selector) {
    if (!selector || typeof selector !== "string") return [];
    try { return Array.from(root.querySelectorAll(selector)); } catch (_) { return []; }
  }
  function fieldSnapshot(field) {
    const state = field?.getState?.();
    return state ? { preset: state.preset, density: state.density, energy: state.energy, speed: state.speed, interactive: state.interactive } : null;
  }

  class AXMCaptureStudio {
    constructor(engine, options = {}) {
      if (!engine?.getConfig || !engine?.applyConfig) throw new Error("AXMCaptureStudio requires a mounted AXMVisualEngine instance.");
      this.engine = engine;
      this.root = options.root || engine.document || global.document;
      this.field = options.field || null;
      this.cues = options.cues || null;
      this.transitions = options.transitions || null;
      this.focus = options.focus || null;
      this.active = null;
      this.snapshot = null;
      this.applied = null;
      this.hidden = [];
      this.overlay = null;
      this.destroyed = false;
      this.instanceId = `axm-capture-${++INSTANCE}`;
    }

    static get version() { return VERSION; }
    static get profiles() { return Object.keys(PROFILES); }

    connect(parts = {}) {
      for (const key of ["field", "cues", "transitions", "focus"]) if (parts[key] !== undefined) this[key] = parts[key];
      return this;
    }

    list() {
      return Object.entries(PROFILES).map(([name, value]) => ({ name, label: value.label, description: value.description, freezeAnimations: value.freezeAnimations, guides: value.guides }));
    }

    preview(profileName, options = {}) {
      const profile = PROFILES[profileName];
      if (!profile) return { valid: false, reason: "unknown-profile", mutations: 0 };
      const selectors = Array.isArray(options.hide) ? options.hide.filter((item) => typeof item === "string").slice(0, 24) : [];
      const hiddenImpact = selectors.map((selector) => ({ selector, matched: resolve(this.root, selector).length }));
      return {
        version: VERSION,
        valid: true,
        profile: profileName,
        label: profile.label,
        description: profile.description,
        engineChanges: clone(profile.engine),
        fieldChanges: clone(profile.field),
        hiddenImpact,
        totalHiddenTargets: hiddenImpact.reduce((sum, item) => sum + item.matched, 0),
        freezeAnimations: options.freezeAnimations ?? profile.freezeAnimations,
        guides: options.guides ?? profile.guides,
        mutations: 0,
        contentRead: false,
        screenshotTaken: false,
        approvalRequired: true,
        localOnly: true,
        telemetry: false
      };
    }

    enter(profileName, options = {}) {
      if (this.destroyed) return { entered: false, reason: "destroyed" };
      if (options.approved !== true) return { entered: false, reason: "approval-required", approvalRequired: true };
      const preview = this.preview(profileName, options);
      if (!preview.valid) return { entered: false, reason: preview.reason, preview };
      if (this.active) {
        if (options.replace !== true) return { entered: false, reason: "capture-already-active", active: this.active };
        this.exit({ reason: "replace-capture" });
      }
      const profile = PROFILES[profileName];
      this.cues?.stop?.("capture-enter");
      this.transitions?.cancel?.("capture-enter");
      this.focus?.clear?.("capture-enter");
      this.snapshot = {
        engine: this.engine.getConfig(),
        field: fieldSnapshot(this.field),
        captureProfile: this.engine.root.getAttribute("data-axm-capture-profile"),
        captureLabel: this.engine.root.getAttribute("data-axm-capture-label"),
        captureClass: this.engine.root.classList.contains("axm-capture-active"),
        freezeClass: this.engine.root.classList.contains("axm-capture-freeze")
      };
      this.engine.applyConfig(profile.engine, { persist: false });
      this._applyField(profile.field);
      this.engine.root.classList.add("axm-capture-active");
      this.engine.root.dataset.axmCaptureProfile = profileName;
      const label = safeText(options.label || profile.label);
      if (label) this.engine.root.dataset.axmCaptureLabel = label;
      if (options.freezeAnimations ?? profile.freezeAnimations) this.engine.root.classList.add("axm-capture-freeze");
      if (options.guides ?? profile.guides) this._mountOverlay(label, options);
      this._hide(Array.isArray(options.hide) ? options.hide : []);
      this.active = profileName;
      this.applied = { engine: this.engine.getConfig(), field: fieldSnapshot(this.field), label };
      const readiness = this.ready();
      this._emit("entered", { profile: profileName, readiness, contentRead: false, screenshotTaken: false });
      return { entered: true, profile: profileName, preview, readiness, state: this.getState() };
    }

    ready() {
      const documentRef = this.root;
      const rootElement = documentRef.documentElement;
      const animations = typeof documentRef.getAnimations === "function" ? documentRef.getAnimations().filter((animation) => animation.playState === "running").length : null;
      const images = Array.from(documentRef.images || []);
      const incompleteImages = images.filter((image) => !image.complete).length;
      const fonts = documentRef.fonts ? documentRef.fonts.status : "unknown";
      const client = rootElement?.clientWidth || global.innerWidth || 0;
      const scroll = rootElement?.scrollWidth || client;
      return {
        version: VERSION,
        active: this.active,
        ready: fonts !== "loading"
          && incompleteImages === 0
          && scroll <= client
          && (animations === null || animations === 0),
        fonts,
        images: images.length,
        incompleteImages,
        runningAnimations: animations,
        viewport: { width: global.innerWidth || 0, height: global.innerHeight || 0, devicePixelRatio: global.devicePixelRatio || 1 },
        horizontalOverflow: Math.max(0, scroll - client),
        contentRead: false,
        screenshotTaken: false,
        gpuDeterminismProven: false,
        localOnly: true,
        telemetry: false
      };
    }

    exportManifest(space = 2) {
      return JSON.stringify({
        module: "axm.visual.capture-manifest",
        version: VERSION,
        profile: this.active,
        readiness: this.ready(),
        engine: this.engine.getConfig(),
        field: fieldSnapshot(this.field),
        boundaries: { contentRead: false, screenshotTaken: false, upload: false, telemetry: false, gpuDeterminismProven: false }
      }, null, Math.max(0, Math.min(8, Number(space) || 2)));
    }

    exit(options = {}) {
      if (!this.snapshot) return false;
      const currentEngine = this.engine.getConfig();
      const currentField = fieldSnapshot(this.field);
      const finalEngine = {};
      for (const [key, value] of Object.entries(this.snapshot.engine)) finalEngine[key] = same(currentEngine[key], this.applied?.engine?.[key]) ? value : currentEngine[key];
      this.engine.applyConfig(finalEngine, { persist: false });
      if (this.field && this.snapshot.field && this.applied?.field) {
        const finalField = {};
        for (const [key, value] of Object.entries(this.snapshot.field)) finalField[key] = same(currentField?.[key], this.applied.field[key]) ? value : currentField?.[key];
        this._applyField(finalField);
      }
      this._restoreHidden();
      this.overlay?.remove();
      this.overlay = null;
      if (!this.snapshot.freezeClass) this.engine.root.classList.remove("axm-capture-freeze");
      if (!this.snapshot.captureClass) this.engine.root.classList.remove("axm-capture-active");
      if (this.engine.root.getAttribute("data-axm-capture-profile") === this.active) {
        if (this.snapshot.captureProfile === null) this.engine.root.removeAttribute("data-axm-capture-profile");
        else this.engine.root.setAttribute("data-axm-capture-profile", this.snapshot.captureProfile);
      }
      if (this.engine.root.getAttribute("data-axm-capture-label") === this.applied?.label) {
        if (this.snapshot.captureLabel === null) this.engine.root.removeAttribute("data-axm-capture-label");
        else this.engine.root.setAttribute("data-axm-capture-label", this.snapshot.captureLabel);
      }
      const previous = this.active;
      this.active = null;
      this.snapshot = null;
      this.applied = null;
      this._emit("exited", { profile: previous, reason: options.reason || "manual", laterPlatformChangesPreserved: true });
      return true;
    }

    getState() {
      return {
        version: VERSION,
        active: this.active,
        snapshotHeld: Boolean(this.snapshot),
        hiddenTargets: this.hidden.length,
        overlayMounted: Boolean(this.overlay?.isConnected),
        profiles: Object.keys(PROFILES).length,
        approvalRequired: true,
        contentRead: false,
        screenshotTaken: false,
        upload: false,
        gpuDeterminismProven: false,
        localOnly: true,
        telemetry: false,
        destroyed: this.destroyed
      };
    }

    destroy(options = {}) {
      if (this.destroyed) return this;
      if (options.restore !== false) this.exit({ reason: "destroyed" });
      this.destroyed = true;
      return this;
    }

    _applyField(config = {}) {
      if (!this.field) return;
      if (config.preset !== undefined) this.field.setPreset(config.preset);
      if (config.density !== undefined) this.field.setDensity(config.density);
      if (config.energy !== undefined) this.field.setEnergy(config.energy);
      if (config.speed !== undefined) this.field.setSpeed(config.speed);
      if (config.interactive !== undefined) this.field.setInteractive(config.interactive);
    }

    _hide(selectors) {
      const token = this.instanceId;
      for (const selector of selectors.slice(0, 24)) {
        for (const element of resolve(this.root, selector)) {
          if (element.hasAttribute("data-axm-capture-hidden")) continue;
          element.setAttribute("data-axm-capture-hidden", token);
          this.hidden.push(element);
        }
      }
    }

    _restoreHidden() {
      for (const element of this.hidden.splice(0)) {
        if (element.getAttribute("data-axm-capture-hidden") === this.instanceId) element.removeAttribute("data-axm-capture-hidden");
      }
    }

    _mountOverlay(label, options) {
      const overlay = this.root.createElement("div");
      overlay.className = "axm-capture-guides";
      overlay.setAttribute("aria-hidden", "true");
      overlay.innerHTML = `<span class="axm-capture-guide axm-capture-guide--h"></span><span class="axm-capture-guide axm-capture-guide--v"></span><span class="axm-capture-mark"></span>`;
      overlay.querySelector(".axm-capture-mark").textContent = safeText(options.mark || label, 80);
      (this.root.body || this.engine.root).appendChild(overlay);
      this.overlay = overlay;
    }

    _emit(name, detail) {
      if (!this.engine.root || typeof global.CustomEvent !== "function") return;
      this.engine.root.dispatchEvent(new global.CustomEvent(`axmcapture:${name}`, { detail }));
    }
  }

  global.AXMCaptureStudio = AXMCaptureStudio;
})(typeof window !== "undefined" ? window : globalThis);
