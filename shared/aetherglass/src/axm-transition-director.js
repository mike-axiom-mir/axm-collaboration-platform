/*
 * AXM Transition Director v7.1.0
 * Finite cinematic scene morphs with queue, replace, and reject policies.
 * No route interception, no content inspection, no network access.
 */
(function attachAXMTransitionDirector(global) {
  "use strict";

  const VERSION = "7.1.0";
  const BUILT_INS = new Set(["veil", "prism", "eclipse", "gate", "bloom", "silence"]);
  const DEFAULTS = Object.freeze({
    duration: 900,
    policy: "replace",
    respectMotion: true,
    maxQueue: 8
  });

  function clamp(value, min, max, fallback = min) {
    const number = Number(value);
    return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
  }

  function wait(ms) {
    return new Promise((resolve) => global.setTimeout(resolve, Math.max(0, ms)));
  }

  class AXMTransitionDirector {
    constructor(engine, options = {}) {
      if (!engine?.root || !engine?.document) throw new Error("AXMTransitionDirector requires a mounted AXMVisualEngine instance.");
      this.engine = engine;
      this.root = engine.root;
      this.document = engine.document;
      this.options = { ...DEFAULTS, ...options };
      this.stage = null;
      this.layer = null;
      this.active = null;
      this.queue = [];
      this.destroyed = false;
      this._token = 0;
      this._runningPromise = null;
      this._mount();
    }

    static mount(engine, options = {}) { return new AXMTransitionDirector(engine, options); }
    static get version() { return VERSION; }
    static get transitions() { return Array.from(BUILT_INS); }

    run(name, action, options = {}) {
      if (this.destroyed) return Promise.resolve({ completed: false, reason: "destroyed" });
      const transition = BUILT_INS.has(name) ? name : "veil";
      const policy = ["replace", "queue", "reject"].includes(options.policy) ? options.policy : this.options.policy;
      const request = { transition, action, options };

      if (this.active) {
        if (policy === "reject") return Promise.resolve({ completed: false, reason: "busy", active: this.active });
        if (policy === "queue") {
          if (this.queue.length >= clamp(this.options.maxQueue, 0, 32, 8)) {
            return Promise.resolve({ completed: false, reason: "queue-full", active: this.active });
          }
          return new Promise((resolve, reject) => this.queue.push({ ...request, resolve, reject }));
        }
        this.cancel("replaced");
      }

      return this._execute(request);
    }

    transitionScene(sceneName, sceneDirector, options = {}) {
      if (!sceneDirector?.apply) return Promise.resolve({ completed: false, reason: "missing-scene-director" });
      return this.run(options.transition || "veil", () => {
        const applied = sceneDirector.apply(sceneName, {
          persist: Boolean(options.persist),
          transitionDuration: 0
        });
        if (!applied) throw new Error(`Unknown Aetherglass scene: ${sceneName}`);
        return { scene: sceneName };
      }, options);
    }

    cancel(reason = "cancelled") {
      if (!this.active) return false;
      this._token += 1;
      const cancelled = this.active;
      this.active = null;
      this._hide();
      this._emit("cancelled", { transition: cancelled, reason });
      return true;
    }

    clearQueue(reason = "cleared") {
      const queued = this.queue.splice(0);
      for (const item of queued) item.resolve?.({ completed: false, reason });
      this._emit("queuecleared", { count: queued.length, reason });
      return queued.length;
    }

    getState() {
      return {
        version: VERSION,
        active: this.active,
        queued: this.queue.length,
        mounted: Boolean(this.stage?.isConnected),
        destroyed: this.destroyed,
        transitions: Array.from(BUILT_INS),
        localOnly: true,
        telemetry: false
      };
    }

    destroy() {
      if (this.destroyed) return this;
      this.cancel("destroyed");
      this.clearQueue("destroyed");
      this.stage?.remove();
      this.stage = null;
      this.layer = null;
      this.destroyed = true;
      this._emit("destroyed", { version: VERSION });
      return this;
    }

    async _execute(request) {
      const token = ++this._token;
      const transition = request.transition;
      const options = request.options || {};
      const requestedDuration = clamp(options.duration, 0, 5000, this.options.duration);
      const motion = this.engine.getState?.().motion;
      const reduced = this.options.respectMotion && (motion === "off" || motion === "reduced");
      const duration = motion === "off" ? 0 : (reduced ? Math.min(requestedDuration, 180) : requestedDuration);
      const coverTime = Math.round(duration * .46);
      const revealTime = Math.max(0, duration - coverTime);

      this.active = transition;
      this.stage.style.setProperty("--axm-transition-duration", `${duration}ms`);
      this.stage.style.setProperty("--axm-transition-fade-duration", `${coverTime}ms`);
      this.stage.dataset.axmTransition = transition;
      this.stage.dataset.axmTransitionActive = "true";
      this.stage.dataset.axmTransitionPhase = "cover";
      this._emit("started", { transition, duration });

      try {
        await wait(coverTime);
        if (token !== this._token || this.destroyed) return { completed: false, reason: "cancelled" };

        let actionResult;
        if (typeof request.action === "function") actionResult = await request.action();
        else actionResult = request.action;

        if (token !== this._token || this.destroyed) return { completed: false, reason: "cancelled", actionResult };
        this.stage.dataset.axmTransitionPhase = "reveal";
        await wait(revealTime + 34);
        if (token !== this._token || this.destroyed) return { completed: false, reason: "cancelled", actionResult };

        this.active = null;
        this._hide();
        const result = { completed: true, transition, duration, actionResult };
        this._emit("completed", result);
        this._drainQueue();
        return result;
      } catch (error) {
        if (token === this._token) {
          this.active = null;
          this._hide();
          this._emit("error", { transition, message: error?.message || String(error) });
          this._drainQueue();
        }
        throw error;
      }
    }

    _drainQueue() {
      if (this.active || this.destroyed || !this.queue.length) return;
      const next = this.queue.shift();
      this._execute(next).then(next.resolve, next.reject);
    }

    _mount() {
      this.stage = this.document.createElement("div");
      this.stage.className = "axm-transition-stage";
      this.stage.dataset.axmOwned = "transition-director";
      this.stage.setAttribute("aria-hidden", "true");
      this.layer = this.document.createElement("div");
      this.layer.className = "axm-transition-layer";
      this.stage.appendChild(this.layer);
      (this.document.body || this.root).appendChild(this.stage);
    }

    _hide() {
      if (!this.stage) return;
      this.stage.dataset.axmTransitionActive = "false";
      delete this.stage.dataset.axmTransitionPhase;
      delete this.stage.dataset.axmTransition;
    }

    _emit(name, detail) {
      if (!this.root || typeof global.CustomEvent !== "function") return;
      this.root.dispatchEvent(new global.CustomEvent(`axmtransition:${name}`, { detail }));
    }
  }

  global.AXMTransitionDirector = AXMTransitionDirector;
})(typeof window !== "undefined" ? window : globalThis);
