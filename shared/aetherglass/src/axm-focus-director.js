/*
 * AXM Focus Director v7.1.0
 * Explicit, content-blind visual focus for guided demonstrations and proof reviews.
 * The target element is never rewritten; all visual emphasis lives in an owned overlay.
 */
(function attachAXMFocusDirector(global) {
  "use strict";

  const VERSION = "7.1.0";
  const STYLES = new Set(["portal", "proof", "quiet", "luxury", "warning"]);
  const ALIGNMENTS = new Set(["auto", "top", "right", "bottom", "left"]);
  let INSTANCE = 0;

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, Number(value) || 0));
  }

  function safeText(value, max = 240) {
    return String(value ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, max);
  }

  function resolve(root, target) {
    if (!target) return [];
    if (target instanceof global.Element) return [target];
    if (Array.isArray(target)) return target.filter((item) => item instanceof global.Element);
    if (typeof target === "string") {
      try { return Array.from(root.querySelectorAll(target)); } catch (_) { return []; }
    }
    return [];
  }

  function rectPayload(rect) {
    return {
      x: Math.round(rect.x), y: Math.round(rect.y), width: Math.round(rect.width), height: Math.round(rect.height),
      top: Math.round(rect.top), right: Math.round(rect.right), bottom: Math.round(rect.bottom), left: Math.round(rect.left)
    };
  }

  class AXMFocusDirector {
    constructor(engine, options = {}) {
      if (!engine?.root) throw new Error("AXMFocusDirector requires a mounted AXMVisualEngine instance.");
      this.engine = engine;
      this.root = options.root || engine.document || global.document;
      this.host = options.host || this.root.body || engine.root;
      this.padding = clamp(options.padding ?? 16, 0, 80);
      this.overlay = null;
      this.frame = null;
      this.callout = null;
      this.announcer = null;
      this.target = null;
      this.options = null;
      this.active = false;
      this.destroyed = false;
      this.instanceId = `axm-focus-${++INSTANCE}`;
      this._raf = 0;
      this._pulseTimer = 0;
      this._handlers = {
        update: () => this._scheduleUpdate(),
        keydown: (event) => { if (event.key === "Escape" && this.options?.escapeClears !== false) this.clear("escape"); }
      };
      this._resizeObserver = typeof global.ResizeObserver === "function" ? new global.ResizeObserver(() => this._scheduleUpdate()) : null;
    }

    static get version() { return VERSION; }
    static get styles() { return Array.from(STYLES); }

    preview(target, options = {}) {
      const elements = resolve(this.root, target);
      const padding = clamp(options.padding ?? this.padding, 0, 80);
      const style = STYLES.has(options.style) ? options.style : "portal";
      const alignment = ALIGNMENTS.has(options.align) ? options.align : "auto";
      return {
        version: VERSION,
        valid: elements.length > 0,
        matched: elements.length,
        selected: elements[0] ? rectPayload(elements[0].getBoundingClientRect()) : null,
        padding,
        style,
        alignment,
        suppliedTitle: Boolean(safeText(options.title, 90)),
        suppliedCopy: Boolean(safeText(options.copy, 280)),
        mutations: 0,
        targetMutations: 0,
        contentRead: false,
        semanticInference: false,
        approvalRequired: true,
        localOnly: true,
        telemetry: false
      };
    }

    focus(target, options = {}) {
      if (this.destroyed) return { focused: false, reason: "destroyed" };
      if (options.approved !== true) return { focused: false, reason: "approval-required", approvalRequired: true };
      const preview = this.preview(target, options);
      if (!preview.valid) return { focused: false, reason: "target-not-found", preview };
      this.clear("replace");
      this.target = resolve(this.root, target)[0];
      this.options = {
        style: STYLES.has(options.style) ? options.style : "portal",
        align: ALIGNMENTS.has(options.align) ? options.align : "auto",
        padding: preview.padding,
        title: safeText(options.title, 90),
        copy: safeText(options.copy, 280),
        eyebrow: safeText(options.eyebrow || "Guided focus", 48),
        step: safeText(options.step, 32),
        escapeClears: options.escapeClears !== false,
        scrollIntoView: options.scrollIntoView === true
      };
      if (this.options.scrollIntoView) {
        const motion = this.engine.getState?.().motion;
        try { this.target.scrollIntoView({ block: "center", inline: "nearest", behavior: motion === "off" || motion === "reduced" ? "auto" : "smooth" }); } catch (_) {}
      }
      this._mountOverlay();
      this.active = true;
      this._bind();
      this._update();
      this._emit("focused", { style: this.options.style, preview, targetMutations: 0, contentRead: false });
      return { focused: true, preview, state: this.getState() };
    }

    pulse(options = {}) {
      if (!this.active || !this.overlay) return false;
      const motion = this.engine.getState?.().motion;
      if (motion === "off" || motion === "reduced") {
        this._emit("pulseskipped", { reason: `motion-${motion}` });
        return false;
      }
      const duration = clamp(options.duration ?? 640, 80, 4000);
      global.clearTimeout(this._pulseTimer);
      this.overlay.classList.remove("axm-focus-pulse");
      void this.overlay.offsetWidth;
      this.overlay.classList.add("axm-focus-pulse");
      this._pulseTimer = global.setTimeout(() => this.overlay?.classList.remove("axm-focus-pulse"), duration);
      this._emit("pulse", { duration });
      return true;
    }

    clear(reason = "cleared") {
      if (!this.active && !this.overlay) return false;
      global.clearTimeout(this._pulseTimer);
      global.cancelAnimationFrame(this._raf);
      this._raf = 0;
      this._unbind();
      this.overlay?.remove();
      this.overlay = null;
      this.frame = null;
      this.callout = null;
      this.announcer = null;
      this.target = null;
      this.options = null;
      this.active = false;
      this._emit("cleared", { reason });
      return true;
    }

    getState() {
      return {
        version: VERSION,
        active: this.active,
        style: this.options?.style || null,
        alignment: this.options?.align || null,
        targetConnected: Boolean(this.target?.isConnected),
        overlayMounted: Boolean(this.overlay?.isConnected),
        targetMutations: 0,
        contentRead: false,
        semanticInference: false,
        accessibleNarration: true,
        approvalRequired: true,
        localOnly: true,
        telemetry: false,
        destroyed: this.destroyed
      };
    }

    destroy() {
      if (this.destroyed) return this;
      this.clear("destroyed");
      this._resizeObserver?.disconnect();
      this.destroyed = true;
      return this;
    }

    _mountOverlay() {
      const overlay = this.root.createElement("div");
      overlay.className = "axm-focus-director";
      overlay.id = this.instanceId;
      overlay.dataset.axmFocusStyle = this.options.style;
      overlay.innerHTML = `
        <div class="axm-focus-frame" aria-hidden="true"><span class="axm-focus-corner axm-focus-corner--a"></span><span class="axm-focus-corner axm-focus-corner--b"></span><span class="axm-focus-corner axm-focus-corner--c"></span><span class="axm-focus-corner axm-focus-corner--d"></span></div>
        <div class="axm-focus-callout" data-align="${this.options.align}" aria-hidden="true">
          <span class="axm-focus-eyebrow"></span>
          <strong class="axm-focus-title"></strong>
          <p class="axm-focus-copy"></p>
          <span class="axm-focus-step"></span>
        </div>
        <div class="axm-focus-announcer" role="status" aria-live="polite" aria-atomic="true"></div>`;
      this.host.appendChild(overlay);
      this.overlay = overlay;
      this.frame = overlay.querySelector(".axm-focus-frame");
      this.callout = overlay.querySelector(".axm-focus-callout");
      this.announcer = overlay.querySelector(".axm-focus-announcer");
      overlay.querySelector(".axm-focus-eyebrow").textContent = this.options.eyebrow;
      overlay.querySelector(".axm-focus-title").textContent = this.options.title;
      overlay.querySelector(".axm-focus-copy").textContent = this.options.copy;
      overlay.querySelector(".axm-focus-step").textContent = this.options.step;
      this.announcer.textContent = [this.options.eyebrow, this.options.title, this.options.copy, this.options.step].filter(Boolean).join(". ");
      this.callout.hidden = !(this.options.title || this.options.copy || this.options.step);
    }

    _bind() {
      global.addEventListener("resize", this._handlers.update, { passive: true });
      global.addEventListener("scroll", this._handlers.update, { passive: true, capture: true });
      this.root.addEventListener("keydown", this._handlers.keydown);
      if (this.target) this._resizeObserver?.observe(this.target);
    }

    _unbind() {
      global.removeEventListener("resize", this._handlers.update);
      global.removeEventListener("scroll", this._handlers.update, true);
      this.root.removeEventListener("keydown", this._handlers.keydown);
      this._resizeObserver?.disconnect();
    }

    _scheduleUpdate() {
      if (!this.active || this._raf) return;
      this._raf = global.requestAnimationFrame(() => { this._raf = 0; this._update(); });
    }

    _update() {
      if (!this.active || !this.target?.isConnected || !this.overlay) {
        if (this.active) this.clear("target-disconnected");
        return;
      }
      const rect = this.target.getBoundingClientRect();
      const padding = this.options.padding;
      const viewportWidth = Math.max(1, global.innerWidth || this.root.documentElement?.clientWidth || 1);
      const viewportHeight = Math.max(1, global.innerHeight || this.root.documentElement?.clientHeight || 1);
      const x = clamp(rect.left - padding, 8, viewportWidth - 24);
      const y = clamp(rect.top - padding, 8, viewportHeight - 24);
      const width = clamp(rect.width + padding * 2, 16, viewportWidth - x - 8);
      const height = clamp(rect.height + padding * 2, 16, viewportHeight - y - 8);
      this.overlay.style.setProperty("--axm-focus-x", `${x}px`);
      this.overlay.style.setProperty("--axm-focus-y", `${y}px`);
      this.overlay.style.setProperty("--axm-focus-w", `${width}px`);
      this.overlay.style.setProperty("--axm-focus-h", `${height}px`);
      this._positionCallout({ x, y, width, height, viewportWidth, viewportHeight });
    }

    _positionCallout(box) {
      if (!this.callout || this.callout.hidden) return;
      const margin = 18;
      const calloutWidth = Math.min(360, Math.max(220, box.viewportWidth - 24));
      let align = this.options.align;
      if (align === "auto") {
        const below = box.viewportHeight - (box.y + box.height);
        const right = box.viewportWidth - (box.x + box.width);
        if (below >= 170) align = "bottom";
        else if (right >= calloutWidth + margin) align = "right";
        else if (box.y >= 170) align = "top";
        else align = "left";
      }
      let left = box.x;
      let top = box.y + box.height + margin;
      if (align === "top") top = box.y - margin;
      if (align === "right") { left = box.x + box.width + margin; top = box.y; }
      if (align === "left") { left = box.x - calloutWidth - margin; top = box.y; }
      if (align === "top") top -= Math.min(170, this.callout.offsetHeight || 130);
      left = clamp(left, 12, Math.max(12, box.viewportWidth - calloutWidth - 12));
      top = clamp(top, 12, Math.max(12, box.viewportHeight - Math.min(220, this.callout.offsetHeight || 150) - 12));
      this.callout.dataset.align = align;
      this.callout.style.width = `${calloutWidth}px`;
      this.callout.style.transform = `translate3d(${Math.round(left)}px,${Math.round(top)}px,0)`;
    }

    _emit(name, detail) {
      if (!this.engine.root || typeof global.CustomEvent !== "function") return;
      this.engine.root.dispatchEvent(new global.CustomEvent(`axmfocus:${name}`, { detail }));
    }
  }

  global.AXMFocusDirector = AXMFocusDirector;
})(typeof window !== "undefined" ? window : globalThis);
