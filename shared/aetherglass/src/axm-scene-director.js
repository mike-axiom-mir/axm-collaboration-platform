/*
 * AXM Scene Director v7.1.0
 * Coordinates the core visual engine, Aetherfield, and Lighting Director into
 * named, reversible moods. Nothing changes until apply() is called.
 */
(function attachAXMSceneDirector(global) {
  "use strict";

  const VERSION = "7.1.0";
  const BUILT_INS = Object.freeze({
    "aether-command": {
      label: "Aether Command",
      description: "Balanced cyan-violet command architecture with restrained cosmic depth.",
      engine: { theme: "aether", atmosphere: "cosmos", material: "crystal", depth: "deep", luminosity: "balanced", density: "comfortable", shape: "sculpted", intensity: 1 },
      field: { preset: "constellation", density: .64, energy: .72, speed: .48 },
      lighting: "aether"
    },
    "royal-void": {
      label: "Royal Void",
      description: "Sapphire, gold, obsidian, and cathedral light for premium focal screens.",
      engine: { theme: "royal", atmosphere: "cathedral", material: "obsidian", depth: "cinematic", luminosity: "radiant", density: "airy", shape: "sculpted", intensity: .96 },
      field: { preset: "stardust", density: .48, energy: .60, speed: .34 },
      lighting: "royal"
    },
    "arcane-dream": {
      label: "Arcane Dream",
      description: "Soft magical violet and rose light with holographic glass and drifting nebula.",
      engine: { theme: "arcane", atmosphere: "dream", material: "holographic", depth: "deep", luminosity: "radiant", density: "airy", shape: "soft", intensity: 1.05 },
      field: { preset: "nebula", density: .60, energy: .92, speed: .30 },
      lighting: "dream"
    },
    "eclipse-focus": {
      label: "Eclipse Focus",
      description: "Near-monochrome black and white clarity with one precise orientation light.",
      engine: { theme: "eclipse", atmosphere: "eclipse", material: "smoked", depth: "soft", luminosity: "dim", density: "comfortable", shape: "sculpted", intensity: .68 },
      field: { preset: "off", density: 0, energy: 0, speed: 0 },
      lighting: "void"
    },
    "frost-sanctuary": {
      label: "Frost Sanctuary",
      description: "Quiet crystalline clarity for reading, review, recovery, and long sessions.",
      engine: { theme: "frost", atmosphere: "sanctuary", material: "pearl", depth: "soft", luminosity: "dim", density: "airy", shape: "soft", intensity: .76 },
      field: { preset: "snow", density: .34, energy: .40, speed: .24 },
      lighting: "sanctuary"
    },
    "solar-forge": {
      label: "Solar Forge",
      description: "Warm creation energy with ember motion, deep material, and active horizon light.",
      engine: { theme: "ember", atmosphere: "forge", material: "obsidian", depth: "cinematic", luminosity: "radiant", density: "comfortable", shape: "sharp", intensity: 1.08 },
      field: { preset: "embers", density: .72, energy: .92, speed: .72 },
      lighting: "forge"
    },
    "living-network": {
      label: "Living Network",
      description: "Organic machine intelligence expressed through verdant light and firefly motion.",
      engine: { theme: "verdant", atmosphere: "living", material: "crystal", depth: "deep", luminosity: "balanced", density: "comfortable", shape: "soft", intensity: .96 },
      field: { preset: "fireflies", density: .70, energy: .78, speed: .46 },
      lighting: "living"
    },
    "nebula-celebration": {
      label: "Nebula Celebration",
      description: "High-spectrum fantasy light reserved for launches, reveals, and completed creation.",
      engine: { theme: "nebula", atmosphere: "prism", material: "holographic", depth: "cinematic", luminosity: "radiant", density: "airy", shape: "soft", intensity: 1.18 },
      field: { preset: "stardust", density: 1.0, energy: 1.10, speed: .70 },
      lighting: "dream"
    },
    "pearl-gallery": {
      label: "Pearl Gallery",
      description: "Dark-light luxury for media, portfolios, showcases, and visual libraries.",
      engine: { theme: "pearl", atmosphere: "cathedral", material: "pearl", depth: "deep", luminosity: "balanced", density: "airy", shape: "sculpted", intensity: .84 },
      field: { preset: "crystal", density: .36, energy: .46, speed: .26 },
      lighting: "sanctuary"
    },
    "quiet-operations": {
      label: "Quiet Operations",
      description: "Professional low-distraction state with minimal effects and strong readability.",
      engine: { theme: "aether", atmosphere: "quiet", material: "smoked", depth: "flat", luminosity: "dim", density: "compact", shape: "sharp", intensity: .48 },
      field: { preset: "off", density: 0, energy: 0, speed: 0 },
      lighting: "void"
    },
    "data-temple": {
      label: "Data Temple",
      description: "Monolithic technical mode with ordered data rain and luminous machine geometry.",
      engine: { theme: "aether", atmosphere: "monolith", material: "clear", depth: "deep", luminosity: "balanced", density: "compact", shape: "sharp", intensity: .90 },
      field: { preset: "data-rain", density: .58, energy: .66, speed: .64 },
      lighting: "aether"
    },
    "phantom-portal": {
      label: "Phantom Portal",
      description: "Pale spectral architecture, liquid glass, and radial warp motion for entrances and reveals.",
      engine: { theme: "phantom", atmosphere: "portal", material: "liquid", depth: "cinematic", luminosity: "radiant", density: "airy", shape: "soft", intensity: 1.08, atmosphereStrength: 1.12, glowStrength: 1.18 },
      field: { preset: "warp", density: .66, energy: .78, speed: .78 },
      lighting: "portal"
    },
    "auric-throne": {
      label: "Auric Throne",
      description: "Gold, pearl, and blue authority expressed with diamond glass and high cathedral beams.",
      engine: { theme: "auric", atmosphere: "throne", material: "diamond", depth: "cinematic", luminosity: "radiant", density: "airy", shape: "sculpted", intensity: .98, atmosphereStrength: .94, glowStrength: 1.06 },
      field: { preset: "orbitals", density: .46, energy: .58, speed: .34 },
      lighting: "auric"
    },
    "oceanic-depths": {
      label: "Oceanic Depths",
      description: "Submerged teal-blue light, liquid surfaces, caustics, and slow drifting motes.",
      engine: { theme: "oceanic", atmosphere: "ocean", material: "liquid", depth: "deep", luminosity: "balanced", density: "comfortable", shape: "soft", intensity: .92, atmosphereStrength: 1.04, glowStrength: .88 },
      field: { preset: "motes", density: .56, energy: .54, speed: .28 },
      lighting: "ocean"
    },
    "rose-gold-sanctum": {
      label: "Rose Gold Sanctum",
      description: "Warm human luxury for welcome screens, stories, galleries, and calm celebration.",
      engine: { theme: "rose-gold", atmosphere: "sanctum", material: "velvet", depth: "deep", luminosity: "radiant", density: "airy", shape: "soft", intensity: .88, atmosphereStrength: .90, glowStrength: .94 },
      field: { preset: "stardust", density: .40, energy: .46, speed: .26 },
      lighting: "dream"
    },
    "ultraviolet-horizon": {
      label: "Ultraviolet Horizon",
      description: "Electric cyan, purple, and magenta for futuristic control rooms and live experiences.",
      engine: { theme: "ultraviolet", atmosphere: "horizon", material: "mirror", depth: "cinematic", luminosity: "radiant", density: "comfortable", shape: "sharp", intensity: 1.12, atmosphereStrength: 1.12, glowStrength: 1.28 },
      field: { preset: "warp", density: .54, energy: .82, speed: .88 },
      lighting: "ultraviolet"
    },
    "black-diamond-focus": {
      label: "Black Diamond Focus",
      description: "Restrained premium concentration with hard clarity, dark material, and minimal orbit light.",
      engine: { theme: "eclipse", atmosphere: "throne", material: "diamond", depth: "deep", luminosity: "dim", density: "compact", shape: "sharp", intensity: .60, atmosphereStrength: .54, glowStrength: .66 },
      field: { preset: "orbitals", density: .18, energy: .30, speed: .18 },
      lighting: "void"
    },
    "celestial-orbit": {
      label: "Celestial Orbit",
      description: "A bright spectral system of orbiting particles for flagship moments and visual showcases.",
      engine: { theme: "phantom", atmosphere: "cosmos", material: "mirror", depth: "cinematic", luminosity: "radiant", density: "airy", shape: "sculpted", intensity: 1.06, atmosphereStrength: 1.08, glowStrength: 1.20 },
      field: { preset: "orbitals", density: .72, energy: .86, speed: .52 },
      lighting: "portal"
    }
  });

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function clamp(value, min, max, fallback = min) {
    const number = Number(value);
    return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
  }

  class AXMSceneDirector {
    constructor(engine, options = {}) {
      if (!engine?.root) throw new Error("AXMSceneDirector requires a mounted AXMVisualEngine instance.");
      this.engine = engine;
      this.root = engine.root;
      this.field = options.field || null;
      this.lighting = options.lighting || null;
      this.transitionDuration = clamp(options.transitionDuration, 0, 5000, 760);
      this.scenes = new Map(Object.entries(BUILT_INS).map(([name, scene]) => [name, clone(scene)]));
      this.active = null;
      this.snapshot = null;
      this._transitionTimer = 0;
      this._temporaryTimer = 0;
      this._temporaryToken = 0;
      this._destroyed = false;
    }

    static get presets() {
      return Object.keys(BUILT_INS);
    }

    connect({ field, lighting } = {}) {
      if (field !== undefined) this.field = field;
      if (lighting !== undefined) this.lighting = lighting;
      return this;
    }

    register(name, scene, options = {}) {
      const key = String(name || "").trim();
      if (!/^[a-z0-9][a-z0-9-_]{1,63}$/i.test(key)) throw new Error("Scene names must be 2–64 letters, numbers, dashes, or underscores.");
      if (!scene || typeof scene !== "object" || Array.isArray(scene)) throw new Error("Scene definition must be an object.");
      if (this.scenes.has(key) && options.replace !== true) throw new Error(`Scene already exists: ${key}`);
      this.scenes.set(key, clone({
        label: scene.label || key,
        description: scene.description || "Custom Aetherglass scene.",
        engine: scene.engine || {},
        field: scene.field || null,
        lighting: scene.lighting || null
      }));
      this._emit("registered", { name: key });
      return key;
    }

    unregister(name) {
      if (BUILT_INS[name]) return false;
      const removed = this.scenes.delete(name);
      if (removed) this._emit("unregistered", { name });
      return removed;
    }

    list() {
      return Array.from(this.scenes.entries()).map(([name, scene]) => ({
        name,
        label: scene.label,
        description: scene.description,
        builtIn: Boolean(BUILT_INS[name])
      }));
    }

    get(name) {
      const scene = this.scenes.get(name);
      return scene ? clone(scene) : null;
    }

    apply(name, options = {}) {
      if (this._destroyed) return false;
      const scene = this.scenes.get(name);
      if (!scene) return false;
      if (this._temporaryTimer) {
        global.clearTimeout(this._temporaryTimer);
        this._temporaryTimer = 0;
        this._temporaryToken += 1;
      }
      if (!this.snapshot) this.snapshot = this._capture();

      const duration = clamp(options.transitionDuration, 0, 5000, this.transitionDuration);
      this._beginTransition(duration);
      this.engine.applyConfig(scene.engine || {}, { persist: Boolean(options.persist) });

      if (this.field && scene.field) {
        this.field.setPreset(scene.field.preset || "off");
        if (scene.field.density !== undefined) this.field.setDensity(scene.field.density);
        if (scene.field.energy !== undefined) this.field.setEnergy(scene.field.energy);
        if (scene.field.speed !== undefined) this.field.setSpeed(scene.field.speed);
      }

      if (this.lighting) {
        if (scene.lighting) this.lighting.setScene(scene.lighting, { applyEngine: false });
        else this.lighting.clear("__axm_scene__");
      }

      this.active = name;
      this._emit("change", { name, scene: clone(scene), duration });
      return true;
    }

    applyTemporary(name, duration = 3000, options = {}) {
      if (this._destroyed || !this.scenes.has(name)) return false;
      if (this._temporaryTimer) global.clearTimeout(this._temporaryTimer);
      this._temporaryTimer = 0;
      this._temporaryToken += 1;

      const previous = {
        active: this.active,
        state: this._capture(),
        sessionSnapshot: this.snapshot ? clone(this.snapshot) : null,
        lightingScene: this.lighting?.getState?.().scene || null
      };
      const token = ++this._temporaryToken;
      if (!this.apply(name, options)) return false;

      this._temporaryTimer = global.setTimeout(() => {
        this._temporaryTimer = 0;
        if (this._destroyed || token !== this._temporaryToken || this.active !== name) return;

        const transitionDuration = clamp(options.transitionDuration, 0, 5000, this.transitionDuration);
        this._beginTransition(transitionDuration);
        this.engine.applyConfig(previous.state.engine, { persist: Boolean(options.persist) });
        if (this.field && previous.state.field) {
          this.field.setPreset(previous.state.field.preset || "off");
          this.field.setDensity(previous.state.field.density);
          this.field.setEnergy(previous.state.field.energy);
          this.field.setSpeed(previous.state.field.speed);
          this.field.setInteractive(previous.state.field.interactive);
        }
        if (this.lighting) {
          if (previous.lightingScene) this.lighting.setScene(previous.lightingScene, { applyEngine: false });
          else this.lighting.clear("__axm_scene__");
        }

        const temporary = this.active;
        this.active = previous.active;
        this.snapshot = previous.sessionSnapshot;
        this._emit("temporaryrestore", { temporary, restored: previous.active, duration: transitionDuration });
      }, clamp(duration, 250, 120000, 3000));
      return true;
    }

    restore(options = {}) {
      if (!this.snapshot) return false;
      if (this._temporaryTimer) global.clearTimeout(this._temporaryTimer);
      this._temporaryTimer = 0;
      this._temporaryToken += 1;
      const snapshot = this.snapshot;
      const duration = clamp(options.transitionDuration, 0, 5000, this.transitionDuration);
      this._beginTransition(duration);

      if (this.lighting?.sceneRestore) this.lighting.restoreScene();
      this.engine.applyConfig(snapshot.engine, { persist: Boolean(options.persist) });
      if (this.field && snapshot.field) {
        this.field.setPreset(snapshot.field.preset || "off");
        this.field.setDensity(snapshot.field.density);
        this.field.setEnergy(snapshot.field.energy);
        this.field.setSpeed(snapshot.field.speed);
        this.field.setInteractive(snapshot.field.interactive);
      }

      const previous = this.active;
      this.active = null;
      this.snapshot = null;
      this._emit("restore", { previous, duration });
      return true;
    }

    export(name = this.active) {
      const scene = name ? this.scenes.get(name) : null;
      if (!scene) return null;
      return JSON.stringify({ module: "axm.visual.scene", version: VERSION, name, scene }, null, 2);
    }

    import(input, options = {}) {
      let parsed = input;
      if (typeof input === "string") parsed = JSON.parse(input);
      const name = options.name || parsed.name;
      const scene = parsed.scene || parsed;
      return this.register(name, scene, { replace: Boolean(options.replace) });
    }

    getState() {
      return {
        version: VERSION,
        active: this.active,
        sceneCount: this.scenes.size,
        snapshotHeld: Boolean(this.snapshot),
        fieldConnected: Boolean(this.field),
        lightingConnected: Boolean(this.lighting),
        localOnly: true,
        telemetry: false
      };
    }

    destroy(options = {}) {
      if (this._destroyed) return;
      if (options.restore !== false && this.snapshot) this.restore({ transitionDuration: 0 });
      if (this._transitionTimer) global.clearTimeout(this._transitionTimer);
      if (this._temporaryTimer) global.clearTimeout(this._temporaryTimer);
      this._temporaryTimer = 0;
      this._temporaryToken += 1;
      this.root.classList.remove("axm-scene-transition");
      this._destroyed = true;
      this._emit("destroyed", { version: VERSION });
    }

    _capture() {
      return {
        engine: this.engine.getConfig(),
        field: this.field?.getState ? {
          preset: this.field.getState().preset,
          density: this.field.getState().density,
          energy: this.field.getState().energy,
          speed: this.field.getState().speed,
          interactive: this.field.getState().interactive
        } : null
      };
    }

    _beginTransition(duration) {
      if (this._transitionTimer) global.clearTimeout(this._transitionTimer);
      if (duration <= 0 || this.engine.getState().motion === "off") {
        this.root.classList.remove("axm-scene-transition");
        return;
      }
      this.root.classList.add("axm-scene-transition");
      this._transitionTimer = global.setTimeout(() => {
        this.root.classList.remove("axm-scene-transition");
        this._transitionTimer = 0;
      }, duration + 80);
    }

    _emit(name, detail) {
      if (!this.root || typeof global.CustomEvent !== "function") return;
      this.root.dispatchEvent(new global.CustomEvent(`axmscene:${name}`, { detail }));
    }
  }

  global.AXMSceneDirector = AXMSceneDirector;
})(typeof window !== "undefined" ? window : globalThis);
