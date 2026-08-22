/*
 * AXM Interaction FX v7.1.0
 * Optional explicit tilt, magnetic controls, ripples, focus light, and event flourishes.
 */
(function attachAXMInteractionFX(global) {
  "use strict";

  const VERSION = "7.1.0";
  const DEFAULTS = Object.freeze({
    tiltSelector: ".axm-tilt, [data-axm-tilt]",
    magneticSelector: ".axm-button--magnetic, [data-axm-magnetic]",
    rippleSelector: ".axm-button, [data-axm-ripple]",
    tiltDegrees: 5,
    magneticStrength: .16,
    ripple: true,
    focusPulse: true,
    respectReducedMotion: true,
    disableOnCoarsePointer: true,
    lighting: null,
    field: null
  });

  function clamp(value, min, max, fallback = min) {
    const number = Number(value);
    return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
  }

  function matchesWithin(target, selector, root) {
    const element = target?.closest?.(selector);
    return element && root.contains(element) ? element : null;
  }

  class AXMInteractionFX {
    constructor(engine, options = {}) {
      if (!engine?.root) throw new Error("AXMInteractionFX requires a mounted AXMVisualEngine instance.");
      this.engine = engine;
      this.root = engine.root;
      this.document = engine.document || global.document;
      this.options = { ...DEFAULTS, ...options };
      this.lighting = this.options.lighting || null;
      this.field = this.options.field || null;
      this.mounted = false;
      this.activeTilt = null;
      this.activeMagnetic = null;
      this._ownedStyles = new Map();
      this._ownedAttributes = new Map();
      this._timers = new Set();
      this._handlers = {
        pointerMove: (event) => this._onPointerMove(event),
        pointerOut: (event) => this._onPointerOut(event),
        pointerDown: (event) => this._onPointerDown(event),
        focusIn: (event) => this._onFocusIn(event),
        state: () => this._onEngineState()
      };
    }

    static mount(engine, options = {}) {
      return new AXMInteractionFX(engine, options).mount();
    }

    mount() {
      if (this.mounted) return this;
      this.mounted = true;
      this.root.addEventListener("pointermove", this._handlers.pointerMove, { passive: true });
      this.root.addEventListener("pointerout", this._handlers.pointerOut, { passive: true });
      this.root.addEventListener("pointerdown", this._handlers.pointerDown, { passive: true });
      this.root.addEventListener("focusin", this._handlers.focusIn);
      this.root.addEventListener("axmvisual:motionchange", this._handlers.state);
      this._emit("mounted", this.getState());
      return this;
    }

    setLighting(director) {
      this.lighting = director || null;
      return this;
    }

    setField(field) {
      this.field = field || null;
      return this;
    }

    attention(target, options = {}) {
      const element = typeof target === "string" ? this.document.querySelector(target) : target;
      if (!element) return false;
      if (!this._motionAllowed()) {
        this._emit("attentionskipped", { target: element, reason: "motion-preference" });
        return false;
      }
      const color = options.color || "var(--axm-accent-1)";
      this.lighting?.pulseAt(element, {
        color,
        strength: clamp(options.strength, .1, 1, .62),
        size: clamp(options.size, 140, 1600, 760),
        duration: clamp(options.duration, 250, 3000, 900)
      });
      this.field?.burstAt(element, {
        count: clamp(options.particles, 4, 60, 18),
        strength: clamp(options.particleStrength, .1, 3, 1),
        colorIndex: clamp(options.colorIndex, 0, 3, 0)
      });
      element.animate?.([
        { filter: "brightness(1)", offset: 0 },
        { filter: "brightness(1.18)", offset: .35 },
        { filter: "brightness(1)", offset: 1 }
      ], { duration: clamp(options.duration, 250, 3000, 900), easing: "cubic-bezier(.2,.8,.2,1)" });
      this._emit("attention", { target: element, options });
      return true;
    }

    celebrate(target, options = {}) {
      const element = typeof target === "string" ? this.document.querySelector(target) : target;
      if (!element) return false;
      if (!this._motionAllowed()) {
        this._emit("celebrateskipped", { target: element, reason: "motion-preference" });
        return false;
      }
      this.attention(element, { ...options, strength: options.strength ?? .82, particles: options.particles ?? 32, size: options.size ?? 980 });
      this._schedule(() => this.lighting?.pulseAt(element, {
        color: options.secondaryColor || "var(--axm-lux)",
        strength: .52,
        size: 720,
        duration: 780
      }), 150);
      this._schedule(() => this.field?.burstAt(element, { count: 20, strength: 1.35, colorIndex: 3 }), 180);
      this._emit("celebrate", { target: element });
      return true;
    }

    scan(options = {}) {
      if (!this._motionAllowed()) {
        this._emit("scanskipped", { reason: "motion-preference" });
        return false;
      }
      this.lighting?.sweep(options);
      this._emit("scan", options);
      return this;
    }

    getState() {
      return {
        version: VERSION,
        mounted: this.mounted,
        tiltEnabled: this._motionAllowed(),
        ripple: Boolean(this.options.ripple && this._motionAllowed()),
        focusPulse: Boolean(this.options.focusPulse && this._motionAllowed()),
        lightingConnected: Boolean(this.lighting),
        fieldConnected: Boolean(this.field),
        localOnly: true,
        telemetry: false
      };
    }

    destroy() {
      if (!this.mounted) return this;
      this.root.removeEventListener("pointermove", this._handlers.pointerMove);
      this.root.removeEventListener("pointerout", this._handlers.pointerOut);
      this.root.removeEventListener("pointerdown", this._handlers.pointerDown);
      this.root.removeEventListener("focusin", this._handlers.focusIn);
      this.root.removeEventListener("axmvisual:motionchange", this._handlers.state);
      this._clearTilt();
      this._clearMagnetic();
      for (const timer of this._timers) global.clearTimeout(timer);
      this._timers.clear();
      this.root.querySelectorAll('.axm-ripple-node[data-axm-owned="interaction-fx"]').forEach((node) => node.remove());
      this._restoreOwnedStyles();
      this._restoreOwnedAttributes();
      this.mounted = false;
      this._emit("destroyed", { version: VERSION });
      return this;
    }

    _motionAllowed() {
      const state = this.engine.getState();
      if (this.options.respectReducedMotion && (state.motion === "reduced" || state.motion === "off")) return false;
      if (this.options.disableOnCoarsePointer && global.matchMedia?.("(pointer: coarse)")?.matches) return false;
      return true;
    }

    _onEngineState() {
      if (!this._motionAllowed()) {
        this._clearTilt();
        this._clearMagnetic();
      }
    }

    _onPointerMove(event) {
      if (!this._motionAllowed()) return;
      if (event.target?.closest?.('[data-axm-interaction="off"]')) return;

      const tilt = matchesWithin(event.target, this.options.tiltSelector, this.root);
      if (tilt) this._applyTilt(tilt, event);
      else this._clearTilt();

      const magnetic = matchesWithin(event.target, this.options.magneticSelector, this.root);
      if (magnetic) this._applyMagnetic(magnetic, event);
      else this._clearMagnetic();
    }

    _onPointerOut(event) {
      if (this.activeTilt && !this.activeTilt.contains(event.relatedTarget)) this._clearTilt();
      if (this.activeMagnetic && !this.activeMagnetic.contains(event.relatedTarget)) this._clearMagnetic();
    }

    _onPointerDown(event) {
      if (!this.options.ripple || !this._motionAllowed()) return;
      if (event.target?.closest?.('[data-axm-interaction="off"]')) return;
      const control = matchesWithin(event.target, this.options.rippleSelector, this.root);
      if (!control || control.matches("[disabled], [aria-disabled='true']")) return;
      const rect = control.getBoundingClientRect();
      const node = this.document.createElement("span");
      node.className = "axm-ripple-node";
      node.dataset.axmOwned = "interaction-fx";
      node.style.left = `${event.clientX - rect.left}px`;
      node.style.top = `${event.clientY - rect.top}px`;
      control.appendChild(node);
      this._schedule(() => node.remove(), 720);
    }

    _onFocusIn(event) {
      if (!this.options.focusPulse || !this.lighting || !this._motionAllowed()) return;
      const focusable = matchesWithin(event.target, ".axm-button, .axm-input, .axm-select, .axm-textarea, [data-axm-focus-light]", this.root);
      if (!focusable) return;
      this.lighting.pulseAt(focusable, { strength: .20, size: 320, duration: 520 });
    }

    _schedule(callback, delay) {
      const timer = global.setTimeout(() => {
        this._timers.delete(timer);
        callback();
      }, delay);
      this._timers.add(timer);
      return timer;
    }

    _applyTilt(element, event) {
      if (this.activeTilt && this.activeTilt !== element) this._clearTilt();
      const rect = element.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const nx = clamp((event.clientX - rect.left) / rect.width, 0, 1, .5);
      const ny = clamp((event.clientY - rect.top) / rect.height, 0, 1, .5);
      const max = clamp(element.dataset.axmTilt || this.options.tiltDegrees, 0, 12, 5);
      this._setStyle(element, "--axm-tilt-y", `${((nx - .5) * max * 2).toFixed(2)}deg`);
      this._setStyle(element, "--axm-tilt-x", `${((.5 - ny) * max * 2).toFixed(2)}deg`);
      this._setStyle(element, "--axm-panel-x", `${(nx * 100).toFixed(2)}%`);
      this._setStyle(element, "--axm-panel-y", `${(ny * 100).toFixed(2)}%`);
      this._setAttribute(element, "data-axm-tilt-active", "true");
      this.activeTilt = element;
    }

    _clearTilt() {
      const element = this.activeTilt;
      if (!element) return;
      element.style.setProperty("--axm-tilt-x", "0deg");
      element.style.setProperty("--axm-tilt-y", "0deg");
      element.removeAttribute("data-axm-tilt-active");
      this.activeTilt = null;
    }

    _applyMagnetic(element, event) {
      if (this.activeMagnetic && this.activeMagnetic !== element) this._clearMagnetic();
      const rect = element.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const strength = clamp(element.dataset.axmMagnetic || this.options.magneticStrength, 0, .5, .16);
      const x = (event.clientX - (rect.left + rect.width / 2)) * strength;
      const y = (event.clientY - (rect.top + rect.height / 2)) * strength;
      this._setStyle(element, "--axm-magnetic-x", `${x.toFixed(2)}px`);
      this._setStyle(element, "--axm-magnetic-y", `${y.toFixed(2)}px`);
      this._setAttribute(element, "data-axm-magnetic-active", "true");
      this.activeMagnetic = element;
    }

    _clearMagnetic() {
      const element = this.activeMagnetic;
      if (!element) return;
      element.style.setProperty("--axm-magnetic-x", "0px");
      element.style.setProperty("--axm-magnetic-y", "0px");
      element.removeAttribute("data-axm-magnetic-active");
      this.activeMagnetic = null;
    }

    _setStyle(element, name, value) {
      let records = this._ownedStyles.get(element);
      if (!records) {
        records = new Map();
        this._ownedStyles.set(element, records);
      }
      if (!records.has(name)) records.set(name, element.style.getPropertyValue(name));
      element.style.setProperty(name, value);
    }

    _setAttribute(element, name, value) {
      let records = this._ownedAttributes.get(element);
      if (!records) {
        records = new Map();
        this._ownedAttributes.set(element, records);
      }
      if (!records.has(name)) records.set(name, element.getAttribute(name));
      element.setAttribute(name, value);
    }

    _restoreOwnedStyles() {
      for (const [element, records] of this._ownedStyles) {
        for (const [name, value] of records) {
          if (value) element.style.setProperty(name, value);
          else element.style.removeProperty(name);
        }
      }
      this._ownedStyles.clear();
    }

    _restoreOwnedAttributes() {
      for (const [element, records] of this._ownedAttributes) {
        for (const [name, value] of records) {
          if (value === null) element.removeAttribute(name);
          else element.setAttribute(name, value);
        }
      }
      this._ownedAttributes.clear();
    }

    _emit(name, detail) {
      if (!this.root || typeof global.CustomEvent !== "function") return;
      this.root.dispatchEvent(new global.CustomEvent(`axminteraction:${name}`, { detail }));
    }
  }

  global.AXMInteractionFX = AXMInteractionFX;
})(typeof window !== "undefined" ? window : globalThis);
