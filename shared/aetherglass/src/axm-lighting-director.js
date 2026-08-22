/*
 * AXM Lighting Director v7.1.0
 * Binds meaningful interface elements to global light, creates fixed lights,
 * pulses, sweeps, grouped emitters, and reversible lighting scenes.
 */
(function attachAXMLightingDirector(global) {
  "use strict";

  const VERSION = "7.1.0";
  const KINDS = new Set(["ambient", "spotlight", "lux", "ring"]);
  const DEFAULTS = Object.freeze({
    maxLights: 12,
    defaultStrength: .22,
    overflow: "reject",
    updateOnScroll: true,
    updateOnResize: true
  });

  const SCENES = Object.freeze({
    aether: {
      engine: { theme: "aether", atmosphere: "cosmos", luminosity: "balanced", intensity: 1 },
      lights: [
        { x: 24, y: 24, color: "var(--axm-accent-1)", strength: .18, size: 760 },
        { x: 78, y: 32, color: "var(--axm-accent-2)", strength: .17, size: 820 }
      ]
    },
    sanctuary: {
      engine: { theme: "frost", atmosphere: "sanctuary", material: "pearl", luminosity: "dim", intensity: .78 },
      lights: [
        { x: 50, y: 18, color: "var(--axm-accent-1)", strength: .14, sizeX: 920, sizeY: 620, kind: "spotlight" },
        { x: 50, y: 84, color: "var(--axm-lux)", strength: .08, size: 880 }
      ]
    },
    dream: {
      engine: { theme: "nebula", atmosphere: "dream", material: "holographic", luminosity: "radiant", intensity: 1.08 },
      lights: [
        { x: 18, y: 40, color: "var(--axm-accent-3)", strength: .20, size: 900 },
        { x: 76, y: 24, color: "var(--axm-accent-1)", strength: .22, size: 820 },
        { x: 64, y: 82, color: "var(--axm-accent-2)", strength: .16, size: 760 }
      ]
    },
    forge: {
      engine: { theme: "ember", atmosphere: "forge", material: "obsidian", luminosity: "radiant", intensity: 1.06 },
      lights: [
        { x: 50, y: 95, color: "var(--axm-accent-1)", strength: .28, sizeX: 1100, sizeY: 620 },
        { x: 18, y: 26, color: "var(--axm-accent-2)", strength: .12, size: 620 }
      ]
    },
    living: {
      engine: { theme: "verdant", atmosphere: "living", material: "crystal", luminosity: "balanced", intensity: .96 },
      lights: [
        { x: 23, y: 75, color: "var(--axm-accent-1)", strength: .19, size: 740 },
        { x: 77, y: 28, color: "var(--axm-accent-2)", strength: .15, size: 760 }
      ]
    },
    royal: {
      engine: { theme: "royal", atmosphere: "cathedral", material: "obsidian", depth: "cinematic", luminosity: "radiant", intensity: .92 },
      lights: [
        { x: 50, y: 8, color: "var(--axm-lux)", strength: .22, sizeX: 900, sizeY: 740, kind: "spotlight" },
        { x: 20, y: 44, color: "var(--axm-accent-2)", strength: .14, size: 720 },
        { x: 82, y: 52, color: "var(--axm-accent-1)", strength: .12, size: 700 }
      ]
    },

    portal: {
      engine: { theme: "phantom", atmosphere: "portal", material: "liquid", depth: "cinematic", luminosity: "radiant", intensity: 1.08 },
      lights: [
        { x: 50, y: 38, color: "var(--axm-accent-1)", strength: .28, sizeX: 980, sizeY: 760, kind: "ring" },
        { x: 22, y: 70, color: "var(--axm-accent-2)", strength: .14, size: 700 },
        { x: 80, y: 22, color: "var(--axm-lux)", strength: .10, size: 620 }
      ]
    },
    auric: {
      engine: { theme: "auric", atmosphere: "throne", material: "diamond", depth: "cinematic", luminosity: "radiant", intensity: .96 },
      lights: [
        { x: 50, y: 5, color: "var(--axm-lux)", strength: .30, sizeX: 880, sizeY: 760, kind: "spotlight" },
        { x: 17, y: 52, color: "var(--axm-accent-2)", strength: .12, size: 640 },
        { x: 84, y: 58, color: "var(--axm-accent-1)", strength: .14, size: 680 }
      ]
    },
    ocean: {
      engine: { theme: "oceanic", atmosphere: "ocean", material: "liquid", depth: "deep", luminosity: "balanced", intensity: .92 },
      lights: [
        { x: 36, y: 18, color: "var(--axm-accent-1)", strength: .18, size: 840 },
        { x: 72, y: 74, color: "var(--axm-accent-2)", strength: .17, size: 900 },
        { x: 52, y: 92, color: "var(--axm-lux)", strength: .07, sizeX: 980, sizeY: 520 }
      ]
    },
    ultraviolet: {
      engine: { theme: "ultraviolet", atmosphere: "horizon", material: "mirror", depth: "cinematic", luminosity: "radiant", intensity: 1.10 },
      lights: [
        { x: 18, y: 30, color: "var(--axm-accent-3)", strength: .22, size: 760 },
        { x: 78, y: 28, color: "var(--axm-accent-1)", strength: .22, size: 820 },
        { x: 50, y: 88, color: "var(--axm-accent-2)", strength: .20, sizeX: 1120, sizeY: 580 }
      ]
    },
    void: {
      engine: { theme: "eclipse", atmosphere: "quiet", material: "obsidian", luminosity: "dim", intensity: .42 },
      lights: [
        { x: 50, y: 35, color: "var(--axm-accent-1)", strength: .07, size: 680, kind: "ring" }
      ]
    }
  });

  function clamp(value, min, max, fallback = min) {
    const number = Number(value);
    return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
  }

  function resolveElement(target, root) {
    if (typeof target === "string") return root.querySelector(target);
    return target?.nodeType === 1 ? target : null;
  }

  function resolvePoint(target, documentRef) {
    const element = resolveElement(target, documentRef);
    if (element) {
      const rect = element.getBoundingClientRect();
      return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, rect, element };
    }
    if (target && Number.isFinite(target.x) && Number.isFinite(target.y)) return { x: target.x, y: target.y, rect: null, element: null };
    return null;
  }

  class AXMLightingDirector {
    constructor(engine, options = {}) {
      if (!engine?.root || !engine?.atmosphere) {
        throw new Error("AXMLightingDirector requires a mounted AXMVisualEngine instance.");
      }
      this.engine = engine;
      this.root = engine.root;
      this.document = engine.document || global.document;
      this.stage = engine.atmosphere.querySelector(".axm-atmosphere__lights");
      if (!this.stage) throw new Error("AXM atmosphere lights stage is missing.");
      this.options = { ...DEFAULTS, ...options };
      this.lights = new Map();
      this.groups = new Map();
      this.nextId = 1;
      this.sceneRestore = null;
      this.sceneName = null;
      this._raf = 0;
      this._destroyed = false;
      this._transients = new Set();
      this._timers = new Set();
      this._resizeObserver = global.ResizeObserver ? new global.ResizeObserver(() => this._scheduleLayout()) : null;
      this._handlers = {
        layout: () => this._scheduleLayout(),
        visibility: () => this._scheduleLayout()
      };
      if (this.options.updateOnScroll) global.addEventListener("scroll", this._handlers.layout, { passive: true, capture: true });
      if (this.options.updateOnResize) global.addEventListener("resize", this._handlers.layout, { passive: true });
      this.document.addEventListener("visibilitychange", this._handlers.visibility);
    }

    static get scenes() {
      return Object.keys(SCENES);
    }

    bind(target, options = {}) {
      const element = resolveElement(target, this.document);
      if (!element) return null;
      const id = this._createLight({ ...options, target: element, mode: "bound" });
      if (!id) return null;
      this._resizeObserver?.observe(element);
      this._positionLight(this.lights.get(id));
      return id;
    }

    addAt(x, y, options = {}) {
      return this._createLight({ ...options, x, y, mode: "fixed" });
    }

    update(id, patch = {}) {
      const light = this.lights.get(id);
      if (!light) return false;
      light.options = { ...light.options, ...patch };
      if (patch.target !== undefined) {
        const target = resolveElement(patch.target, this.document);
        if (target) {
          if (light.target && light.target !== target) this._resizeObserver?.unobserve(light.target);
          light.target = target;
          this._resizeObserver?.observe(target);
        }
      }
      if (patch.group && patch.group !== light.group) {
        this._removeFromGroup(light.group, id);
        light.group = patch.group;
        this._addToGroup(light.group, id);
      }
      this._styleLight(light);
      this._positionLight(light);
      return true;
    }

    remove(id) {
      const light = this.lights.get(id);
      if (!light) return false;
      if (light.target) this._resizeObserver?.unobserve(light.target);
      light.node.remove();
      this._removeFromGroup(light.group, id);
      this.lights.delete(id);
      this._emit("removed", { id });
      return true;
    }

    clear(group = null) {
      const ids = group ? Array.from(this.groups.get(group) || []) : Array.from(this.lights.keys());
      for (const id of ids) this.remove(id);
      return ids.length;
    }

    setGroupEnabled(group, enabled) {
      const ids = this.groups.get(group);
      if (!ids) return 0;
      let changed = 0;
      for (const id of ids) {
        const light = this.lights.get(id);
        if (!light) continue;
        light.enabled = Boolean(enabled);
        light.node.style.display = light.enabled ? "" : "none";
        changed += 1;
      }
      this._emit("groupchange", { group, enabled: Boolean(enabled), count: changed });
      return changed;
    }

    pulseAt(target, options = {}) {
      if (this._destroyed || !this._motionAllowed()) return null;
      const point = resolvePoint(target, this.document);
      if (!point) return null;
      const pulse = this.document.createElement("div");
      pulse.className = "axm-light-pulse";
      pulse.dataset.axmOwned = "lighting-director";
      const width = Math.max(global.innerWidth || 1, 1);
      const height = Math.max(global.innerHeight || 1, 1);
      const size = clamp(options.size, 80, 2200, 720);
      pulse.style.setProperty("--axm-light-x", `${(point.x / width) * 100}%`);
      pulse.style.setProperty("--axm-light-y", `${(point.y / height) * 100}%`);
      pulse.style.setProperty("--axm-light-size-x", `${size}px`);
      pulse.style.setProperty("--axm-light-size-y", `${clamp(options.sizeY, 80, 2200, size)}px`);
      pulse.style.setProperty("--axm-light-color", options.color || "var(--axm-accent-1)");
      pulse.style.setProperty("--axm-light-opacity", String(clamp(options.strength, 0, 1, .65)));
      pulse.style.setProperty("--axm-pulse-duration", `${clamp(options.duration, 120, 4000, 900)}ms`);
      this.stage.appendChild(pulse);
      const duration = clamp(options.duration, 120, 4000, 900);
      this._trackTransient(pulse, duration + 80);
      this._emit("pulse", { x: point.x, y: point.y, duration });
      return pulse;
    }

    sweep(options = {}) {
      if (this._destroyed || !this._motionAllowed()) return null;
      const node = this.document.createElement("div");
      node.className = "axm-light-sweep";
      node.dataset.axmOwned = "lighting-director";
      node.style.setProperty("--axm-light-x", `${clamp(options.x, 0, 100, 50)}%`);
      node.style.setProperty("--axm-light-y", `${clamp(options.y, 0, 100, 50)}%`);
      node.style.setProperty("--axm-light-color", options.color || "var(--axm-accent-1)");
      node.style.setProperty("--axm-light-opacity", String(clamp(options.strength, 0, 1, .42)));
      node.style.setProperty("--axm-sweep-duration", `${clamp(options.duration, 250, 5000, 1200)}ms`);
      this.stage.appendChild(node);
      const duration = clamp(options.duration, 250, 5000, 1200);
      this._trackTransient(node, duration + 80);
      this._emit("sweep", { duration });
      return node;
    }

    setScene(name, options = {}) {
      const scene = SCENES[name];
      if (!scene) return false;
      if (!this.sceneRestore) {
        this.sceneRestore = {
          engine: this.engine.getConfig(),
          scene: this.sceneName
        };
      }
      this.clear("__axm_scene__");
      if (options.applyEngine !== false) this.engine.applyConfig(scene.engine, { persist: false });
      for (const light of scene.lights) this.addAt(light.x, light.y, { ...light, group: "__axm_scene__" });
      this.sceneName = name;
      this._emit("scenechange", { scene: name, engine: options.applyEngine !== false });
      return true;
    }

    restoreScene() {
      if (!this.sceneRestore) return false;
      const restore = this.sceneRestore;
      this.clear("__axm_scene__");
      this.engine.applyConfig(restore.engine, { persist: false });
      this.sceneRestore = null;
      this.sceneName = null;
      this._emit("scenerestore", { restored: true });
      return true;
    }

    getState() {
      const groupState = {};
      for (const [group, ids] of this.groups) groupState[group] = ids.size;
      return {
        version: VERSION,
        lights: this.lights.size,
        maxLights: this.options.maxLights,
        groups: groupState,
        scene: this.sceneName,
        localOnly: true,
        telemetry: false
      };
    }

    destroy() {
      if (this._destroyed) return;
      if (this.sceneRestore) this.restoreScene();
      this.clear();
      for (const timer of this._timers) global.clearTimeout(timer);
      this._timers.clear();
      for (const node of this._transients) node.remove();
      this._transients.clear();
      if (this.options.updateOnScroll) global.removeEventListener("scroll", this._handlers.layout, true);
      if (this.options.updateOnResize) global.removeEventListener("resize", this._handlers.layout);
      this.document.removeEventListener("visibilitychange", this._handlers.visibility);
      if (this._raf) global.cancelAnimationFrame(this._raf);
      this._resizeObserver?.disconnect();
      this._destroyed = true;
      this._emit("destroyed", { version: VERSION });
    }

    _createLight(options) {
      if (this._destroyed) return null;
      if (this.lights.size >= this.options.maxLights) {
        if (this.options.overflow === "replace-lowest") {
          const candidate = Array.from(this.lights.values()).sort((a, b) => (a.options.priority || 0) - (b.options.priority || 0))[0];
          if (candidate) this.remove(candidate.id);
        } else {
          this._emit("limit", { maxLights: this.options.maxLights, rejected: true });
          return null;
        }
      }

      const id = `axm-light-${this.nextId++}`;
      const node = this.document.createElement("div");
      node.className = "axm-light-emitter";
      node.dataset.axmOwned = "lighting-director";
      node.dataset.axmLightId = id;
      this.stage.appendChild(node);

      const light = {
        id,
        node,
        target: options.target || null,
        mode: options.mode || "fixed",
        group: options.group || "default",
        enabled: true,
        options: { ...options }
      };
      this.lights.set(id, light);
      this._addToGroup(light.group, id);
      this._styleLight(light);
      this._positionLight(light);
      this._emit("created", { id, group: light.group, mode: light.mode });
      return id;
    }

    _styleLight(light) {
      const options = light.options;
      const kind = KINDS.has(options.kind) ? options.kind : "ambient";
      const size = clamp(options.size, 80, 2600, 560);
      const sizeX = clamp(options.sizeX, 80, 2800, size);
      const sizeY = clamp(options.sizeY, 80, 2800, size);
      const engineIntensity = clamp(this.engine.getState().intensity, 0, 1.8, 1);
      const strength = clamp(options.strength, 0, 1, this.options.defaultStrength) * engineIntensity;
      light.node.dataset.axmLightKind = kind;
      light.node.style.setProperty("--axm-light-color", options.color || "var(--axm-accent-1)");
      light.node.style.setProperty("--axm-light-opacity", String(clamp(strength, 0, 1, .2)));
      light.node.style.setProperty("--axm-light-size-x", `${sizeX}px`);
      light.node.style.setProperty("--axm-light-size-y", `${sizeY}px`);
      light.node.style.setProperty("--axm-light-rotation", `${clamp(options.rotation, -360, 360, 0)}deg`);
      light.node.style.setProperty("--axm-light-blur", `${clamp(options.blur, 0, 120, 0)}px`);
      light.node.style.mixBlendMode = options.blend || "screen";
      light.node.style.display = light.enabled ? "" : "none";
    }

    _positionLight(light) {
      if (!light?.node) return;
      const width = Math.max(global.innerWidth || 1, 1);
      const height = Math.max(global.innerHeight || 1, 1);
      const options = light.options;
      let x;
      let y;
      let rect = null;

      if (light.mode === "bound" && light.target?.isConnected) {
        rect = light.target.getBoundingClientRect();
        x = rect.left + rect.width / 2;
        y = rect.top + rect.height / 2;
        light.node.style.opacity = rect.bottom < 0 || rect.top > height || rect.right < 0 || rect.left > width ? "0" : "";
      } else if (light.mode === "fixed") {
        const units = options.units || "%";
        if (units === "px") {
          x = Number.isFinite(Number(options.x)) ? Number(options.x) : width / 2;
          y = Number.isFinite(Number(options.y)) ? Number(options.y) : height / 2;
        } else {
          x = width * clamp(options.x, 0, 100, 50) / 100;
          y = height * clamp(options.y, 0, 100, 50) / 100;
        }
      } else {
        return;
      }

      x += Number(options.offsetX) || 0;
      y += Number(options.offsetY) || 0;
      light.node.style.setProperty("--axm-light-x", `${clamp((x / width) * 100, -50, 150, 50)}%`);
      light.node.style.setProperty("--axm-light-y", `${clamp((y / height) * 100, -50, 150, 50)}%`);

      if (rect && options.scaleToTarget) {
        const scale = clamp(options.targetScale, .5, 10, 3.2);
        const sizeX = clamp(rect.width * scale, 120, 2600, 560);
        const sizeY = clamp(rect.height * scale, 120, 2600, 560);
        light.node.style.setProperty("--axm-light-size-x", `${sizeX}px`);
        light.node.style.setProperty("--axm-light-size-y", `${sizeY}px`);
      }
    }

    _scheduleLayout() {
      if (this._raf || this._destroyed) return;
      this._raf = global.requestAnimationFrame(() => {
        this._raf = 0;
        for (const light of this.lights.values()) {
          if (light.mode === "bound") this._positionLight(light);
        }
      });
    }

    _motionAllowed() {
      const motion = this.engine.getState?.().motion;
      return motion !== "off" && motion !== "reduced";
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

    _addToGroup(group, id) {
      if (!this.groups.has(group)) this.groups.set(group, new Set());
      this.groups.get(group).add(id);
    }

    _removeFromGroup(group, id) {
      const ids = this.groups.get(group);
      if (!ids) return;
      ids.delete(id);
      if (!ids.size) this.groups.delete(group);
    }

    _emit(name, detail) {
      if (!this.root || typeof global.CustomEvent !== "function") return;
      this.root.dispatchEvent(new global.CustomEvent(`axmlighting:${name}`, { detail }));
    }
  }

  global.AXMLightingDirector = AXMLightingDirector;
})(typeof window !== "undefined" ? window : globalThis);
