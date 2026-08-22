/*
 * AXM Journey Director v7.1.0
 * Finite, approval-first visual storytelling built from code-free journey contracts.
 * It coordinates existing visual organs without reading target content or controlling navigation.
 */
(function attachAXMJourneyDirector(global) {
  "use strict";

  const VERSION = "7.1.0";
  const NAME_PATTERN = /^[a-z0-9][a-z0-9-_]{1,63}$/;
  const MAX_JOURNEYS = 48;
  const MAX_STEPS = 24;
  const MAX_DURATION = 30000;
  const STYLES = new Set(["portal", "proof", "quiet", "luxury", "warning"]);
  const ALIGNMENTS = new Set(["auto", "top", "right", "bottom", "left"]);
  const TOP_KEYS = new Set(["label", "description", "policy", "steps", "tags"]);
  const STEP_KEYS = new Set(["target", "title", "copy", "eyebrow", "blueprint", "cue", "transition", "duration", "style", "align"]);

  const BUILT_INS = Object.freeze({
    "axiom-awakening": {
      label: "Axiom Awakening",
      description: "A guided reveal of orientation, meaningful light, governed authorship and reversible platform stewardship.",
      policy: "showcase",
      tags: ["orientation", "showcase", "axm"],
      steps: [
        { target: ".demo-hero-copy", eyebrow: "01 · Orientation", title: "Begin with direction, not decoration", copy: "The world opens from a disciplined void so every later light has meaning.", blueprint: "sovereign-command", style: "portal", align: "bottom", duration: 2800 },
        { target: "#networkTarget", eyebrow: "02 · Relationship", title: "Systems illuminate one another", copy: "Selected organs can cast global light without turning every surface into noise.", blueprint: "living-library", cue: "awakening", style: "luxury", align: "left", duration: 3000 },
        { target: "#authoringLab", eyebrow: "03 · Authorship", title: "Beauty becomes an inspectable contract", copy: "Tokens, blueprints and selector impact remain reviewable before the platform changes.", blueprint: "quiet-proof", style: "proof", align: "top", duration: 3200 },
        { target: "#productionLab", eyebrow: "04 · Restraint", title: "Production safety protects the spectacle", copy: "Readability, performance, rollback and explicit approval stay stronger than visual ambition.", blueprint: "accessible-night", style: "quiet", align: "top", duration: 3200 },
        { target: "#portalTarget", eyebrow: "05 · Possibility", title: "Then the portal can fully open", copy: "Once the roots hold, cinematic light can become extraordinary without becoming manipulative.", blueprint: "showcase-portal", cue: "portal-open", style: "portal", align: "left", duration: 3400 },
        { target: ".demo-command-panel", eyebrow: "06 · Return", title: "Local, reversible and still yours", copy: "The journey stops cleanly and restores the prior visual world instead of claiming permanent control.", blueprint: "quiet-proof", style: "proof", align: "top", duration: 2800 }
      ]
    },
    "proof-path": {
      label: "Proof Path",
      description: "A restrained route through contracts, production guardrails and local evidence.",
      policy: "workspace",
      tags: ["proof", "review", "governance"],
      steps: [
        { target: "#authoringLab", eyebrow: "Contract", title: "Preview before mutation", copy: "A composition exposes policy, target impact and fingerprint before approval.", blueprint: "quiet-proof", style: "proof", duration: 2600 },
        { target: "#productionSandbox", eyebrow: "Legacy intake", title: "Map cautiously", copy: "Unknown platform surfaces remain untouched until a reviewed mapping is approved.", blueprint: "accessible-night", style: "quiet", duration: 2800 },
        { target: "#productionLab", eyebrow: "Verification", title: "Audit the result", copy: "Readability, hierarchy and rollback remain visible acceptance gates.", blueprint: "quiet-proof", style: "proof", duration: 2600 }
      ]
    },
    "living-workshop": {
      label: "Living Workshop",
      description: "A calmer creative journey through a connected, growing visual environment.",
      policy: "workspace",
      tags: ["living", "creation", "calm"],
      steps: [
        { target: "#networkTarget", eyebrow: "Living graph", title: "A workshop is a relationship", copy: "Capabilities remain modular while their light and meaning can still compound.", blueprint: "living-library", style: "luxury", duration: 2800 },
        { target: ".demo-conductor", eyebrow: "Stewardship", title: "Humans keep the conductor", copy: "The platform exposes controls and recommendations instead of hiding adaptation.", blueprint: "sovereign-command", style: "portal", duration: 2800 },
        { target: "#authoringSandbox", eyebrow: "Local making", title: "Compose inside a contained space", copy: "New visual language can be tested without silently rewriting the surrounding platform.", blueprint: "creation-forge", cue: "awakening", style: "luxury", duration: 3000 }
      ]
    },
    "public-showcase": {
      label: "Public Showcase",
      description: "A cinematic but finite route for a public demonstration or launch moment.",
      policy: "showcase",
      tags: ["public", "cinematic", "launch"],
      steps: [
        { target: ".demo-hero-copy", eyebrow: "Arrival", title: "Enter the Aetherglass world", copy: "Darkness, glass and spectral light establish a luxurious visual identity.", blueprint: "showcase-portal", cue: "portal-open", style: "portal", duration: 3000 },
        { target: "#portalTarget", eyebrow: "Energy", title: "A protected center of gravity", copy: "The strongest light belongs to the moment that matters.", blueprint: "creation-forge", cue: "showcase", style: "luxury", duration: 3200 },
        { target: "#networkTarget", eyebrow: "System", title: "The spectacle still has architecture", copy: "Visual impact is connected to real platform organs, not pasted over them.", blueprint: "sovereign-command", style: "portal", duration: 3000 }
      ]
    },
    "quiet-onboarding": {
      label: "Quiet Onboarding",
      description: "A motion-reduced introduction for first-time users and accessible operation.",
      policy: "accessibility",
      tags: ["onboarding", "accessible", "quiet"],
      steps: [
        { target: ".demo-conductor", eyebrow: "Welcome", title: "Start with a few clear controls", copy: "The visual world can remain calm while the user learns what each choice does.", blueprint: "accessible-night", style: "quiet", duration: 2600 },
        { target: "#authoringLab", eyebrow: "Choice", title: "Preview every authored change", copy: "Nothing needs to be accepted blindly or all at once.", blueprint: "quiet-proof", style: "proof", duration: 2600 },
        { target: "#productionLab", eyebrow: "Safety", title: "Fallbacks are part of the design", copy: "Motion, transparency and performance routes preserve use instead of removing identity.", blueprint: "accessible-night", style: "quiet", duration: 2600 }
      ]
    }
  });

  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function clamp(value, min, max, fallback = min) {
    const number = Number(value);
    return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
  }
  function safeText(value, max) { return String(value ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, max); }
  function selectorValid(root, selector) {
    if (typeof selector !== "string" || !selector.trim()) return false;
    try { root.querySelector(selector); return true; } catch (_) { return false; }
  }
  function selectorCount(root, selector) {
    try { return root.querySelectorAll(selector).length; } catch (_) { return 0; }
  }

  function normalize(name, definition) {
    const key = String(name || "").trim().toLowerCase();
    if (!NAME_PATTERN.test(key)) throw new Error("Journey names must be 2–64 lowercase letters, numbers, dashes, or underscores.");
    if (!definition || typeof definition !== "object" || Array.isArray(definition)) throw new Error("Journey definition must be an object.");
    for (const candidate of Object.keys(definition)) if (!TOP_KEYS.has(candidate)) throw new Error(`Unsupported journey key: ${candidate}`);
    const steps = Array.isArray(definition.steps) ? definition.steps : [];
    if (!steps.length || steps.length > MAX_STEPS) throw new Error(`Journey must contain 1–${MAX_STEPS} steps.`);
    const normalizedSteps = steps.map((step, index) => {
      if (!step || typeof step !== "object" || Array.isArray(step)) throw new Error(`Journey step ${index + 1} must be an object.`);
      for (const candidate of Object.keys(step)) if (!STEP_KEYS.has(candidate)) throw new Error(`Unsupported journey step key: ${candidate}`);
      if (typeof step.target !== "string" || !step.target.trim()) throw new Error(`Journey step ${index + 1} requires a target selector.`);
      return {
        target: step.target.trim().slice(0, 240),
        title: safeText(step.title, 96),
        copy: safeText(step.copy, 320),
        eyebrow: safeText(step.eyebrow || `Step ${index + 1}`, 64),
        blueprint: step.blueprint ? safeText(step.blueprint, 64).toLowerCase() : null,
        cue: step.cue ? safeText(step.cue, 64).toLowerCase() : null,
        transition: step.transition ? safeText(step.transition, 32).toLowerCase() : null,
        duration: clamp(step.duration, 120, MAX_DURATION, 2600),
        style: STYLES.has(step.style) ? step.style : "portal",
        align: ALIGNMENTS.has(step.align) ? step.align : "auto"
      };
    });
    return {
      label: safeText(definition.label || key, 96),
      description: safeText(definition.description || "Finite Aetherglass visual journey.", 320),
      policy: safeText(definition.policy || "production-safe", 32).toLowerCase(),
      steps: normalizedSteps,
      tags: Array.isArray(definition.tags) ? definition.tags.map((tag) => safeText(tag, 32).toLowerCase()).filter(Boolean).slice(0, 12) : []
    };
  }

  class AXMJourneyDirector {
    constructor(engine, options = {}) {
      if (!engine?.root) throw new Error("AXMJourneyDirector requires a mounted AXMVisualEngine instance.");
      this.engine = engine;
      this.root = options.root || engine.document || global.document;
      this.focus = options.focus || null;
      this.workbench = options.workbench || null;
      this.cues = options.cues || null;
      this.capture = options.capture || null;
      this.journeys = new Map(Object.entries(BUILT_INS).map(([name, item]) => [name, { ...clone(item), builtIn: true }]));
      this.active = null;
      this.index = -1;
      this.playing = false;
      this.paused = false;
      this.timer = 0;
      this.token = 0;
      this.speed = 1;
      this.destroyed = false;
      this._completion = null;
      this._resolveCompletion = null;
      this._journeyOwnsComposition = false;
    }

    static get version() { return VERSION; }
    static get builtIns() { return Object.keys(BUILT_INS); }

    connect(parts = {}) {
      for (const key of ["focus", "workbench", "cues", "capture"]) if (parts[key] !== undefined) this[key] = parts[key];
      return this;
    }

    register(name, definition, options = {}) {
      if (this.destroyed) return false;
      const key = String(name || "").trim().toLowerCase();
      if (this.journeys.get(key)?.builtIn) return false;
      if (this.journeys.has(key) && options.replace !== true) return false;
      if (!this.journeys.has(key) && this.journeys.size >= MAX_JOURNEYS) throw new Error(`Journey limit reached (${MAX_JOURNEYS}).`);
      const normalized = normalize(key, definition);
      this.journeys.set(key, { ...normalized, builtIn: false });
      this._emit("registered", { name: key });
      return true;
    }

    unregister(name) {
      const journey = this.journeys.get(name);
      if (!journey || journey.builtIn || this.active === name) return false;
      return this.journeys.delete(name);
    }

    get(name) {
      const journey = this.journeys.get(name);
      return journey ? clone(journey) : null;
    }

    list() {
      return Array.from(this.journeys.entries()).map(([name, item]) => ({ name, label: item.label, description: item.description, policy: item.policy, steps: item.steps.length, builtIn: Boolean(item.builtIn), tags: [...(item.tags || [])] }));
    }

    preview(nameOrDefinition) {
      let journey;
      let name = null;
      try {
        if (typeof nameOrDefinition === "string") { name = nameOrDefinition; journey = this.journeys.get(nameOrDefinition); }
        else journey = normalize("preview-journey", nameOrDefinition);
      } catch (error) {
        return { valid: false, reason: "invalid-contract", errors: [error.message], mutations: 0, contentRead: false };
      }
      if (!journey) return { valid: false, reason: "unknown-journey", errors: ["Unknown journey."], mutations: 0, contentRead: false };
      const stepImpact = journey.steps.map((step, index) => {
        const selectorIsValid = selectorValid(this.root, step.target);
        const matched = selectorIsValid ? selectorCount(this.root, step.target) : 0;
        const blueprintAvailable = !step.blueprint || Boolean(this.workbench?.get?.(step.blueprint));
        const cueAvailable = !step.cue || Boolean(this.cues?.list?.().some((item) => item.name === step.cue));
        return { index, target: step.target, matched, selectorValid: selectorIsValid, blueprint: step.blueprint, blueprintAvailable, cue: step.cue, cueAvailable, duration: step.duration, style: step.style };
      });
      const errors = [];
      for (const step of stepImpact) {
        if (!step.selectorValid) errors.push(`Step ${step.index + 1} has an invalid selector.`);
        else if (step.matched === 0) errors.push(`Step ${step.index + 1} target matches no elements.`);
        if (!step.blueprintAvailable) errors.push(`Step ${step.index + 1} references an unavailable blueprint.`);
        if (!step.cueAvailable) errors.push(`Step ${step.index + 1} references an unavailable cue.`);
      }
      return {
        version: VERSION,
        name,
        label: journey.label,
        description: journey.description,
        policy: journey.policy,
        valid: errors.length === 0,
        errors,
        stepImpact,
        steps: journey.steps.length,
        totalDuration: journey.steps.reduce((sum, step) => sum + step.duration, 0),
        matchedTargets: stepImpact.reduce((sum, step) => sum + step.matched, 0),
        mutations: 0,
        targetMutations: 0,
        contentRead: false,
        semanticInference: false,
        codeFree: true,
        approvalRequired: true,
        localOnly: true,
        telemetry: false
      };
    }

    async start(name, options = {}) {
      if (this.destroyed) return { started: false, reason: "destroyed" };
      if (options.approved !== true) return { started: false, reason: "approval-required", approvalRequired: true };
      const preview = this.preview(name);
      if (!preview.valid) return { started: false, reason: "journey-invalid", preview };
      if (this.active) this.stop("replaced", { restore: true });
      if (this.capture?.getState?.().active) return { started: false, reason: "capture-mode-active" };
      if (this.workbench?.getState?.().active && options.replaceComposition !== true) return { started: false, reason: "active-composition-review-required" };
      if (this.workbench?.getState?.().active) this.workbench.restore({ reason: "journey-start-replace" });
      this.active = name;
      this.index = -1;
      this.playing = options.autoplay !== false;
      this.paused = false;
      this.speed = clamp(options.speed, .2, 20, 1);
      this._journeyOwnsComposition = false;
      const token = ++this.token;
      this._completion = new Promise((resolve) => { this._resolveCompletion = resolve; });
      this.engine.root.classList.add("axm-journey-active");
      this._emit("started", { name, steps: preview.steps, autoplay: this.playing, contentRead: false });
      const result = await this.goTo(0, { token, schedule: this.playing });
      if (!result.entered) this.stop(result.reason || "step-failed", { restore: true });
      return { started: result.entered, name, preview, completion: this._completion, state: this.getState() };
    }

    async goTo(index, options = {}) {
      const journey = this.journeys.get(this.active);
      if (!journey) return { entered: false, reason: "no-active-journey" };
      const nextIndex = Math.trunc(Number(index));
      if (nextIndex < 0 || nextIndex >= journey.steps.length) return { entered: false, reason: "step-out-of-range" };
      const token = options.token ?? ++this.token;
      global.clearTimeout(this.timer);
      this.timer = 0;
      const step = journey.steps[nextIndex];
      if (step.blueprint && this.workbench) {
        if (this.workbench.getState?.().active) this.workbench.restore({ reason: "journey-step-change" });
        const applied = await this.workbench.apply(step.blueprint, { approved: true, replaceComposed: true, transition: step.transition || undefined, cue: false });
        if (token !== this.token || this.active === null) return { entered: false, reason: "cancelled" };
        if (!applied.applied) return { entered: false, reason: applied.reason || "blueprint-failed", detail: applied };
        this._journeyOwnsComposition = true;
      }
      const focusResult = this.focus?.focus?.(step.target, {
        approved: true,
        title: step.title,
        copy: step.copy,
        eyebrow: step.eyebrow,
        step: `${nextIndex + 1} / ${journey.steps.length}`,
        style: step.style,
        align: step.align,
        padding: nextIndex === 0 ? 18 : 14,
        scrollIntoView: true,
        escapeClears: false
      });
      if (this.focus && !focusResult?.focused) return { entered: false, reason: focusResult?.reason || "focus-failed" };
      if (step.cue && this.cues) this.cues.play(step.cue, { target: step.target, speed: this.speed });
      this.index = nextIndex;
      this._emit("step", { name: this.active, index: nextIndex, step: clone(step), contentRead: false });
      if ((options.schedule ?? this.playing) && !this.paused) this._schedule(step.duration, token);
      return { entered: true, index: nextIndex, step: clone(step), state: this.getState() };
    }

    async next() {
      const journey = this.journeys.get(this.active);
      if (!journey) return { entered: false, reason: "no-active-journey" };
      if (this.index >= journey.steps.length - 1) {
        this.stop("completed", { restore: true, completed: true });
        return { entered: false, reason: "completed" };
      }
      return this.goTo(this.index + 1, { schedule: this.playing });
    }

    previous() {
      if (!this.active) return Promise.resolve({ entered: false, reason: "no-active-journey" });
      return this.goTo(Math.max(0, this.index - 1), { schedule: this.playing });
    }

    pause() {
      if (!this.active || this.paused) return false;
      global.clearTimeout(this.timer);
      this.timer = 0;
      this.paused = true;
      this._emit("paused", { name: this.active, index: this.index });
      return true;
    }

    resume() {
      if (!this.active || !this.paused) return false;
      this.paused = false;
      this.playing = true;
      const journey = this.journeys.get(this.active);
      const step = journey?.steps[this.index];
      if (step) this._schedule(step.duration, this.token);
      this._emit("resumed", { name: this.active, index: this.index });
      return true;
    }

    stop(reason = "stopped", options = {}) {
      if (!this.active && !this._completion) return false;
      const name = this.active;
      const index = this.index;
      ++this.token;
      global.clearTimeout(this.timer);
      this.timer = 0;
      this.cues?.stop?.(`journey-${reason}`);
      this.focus?.clear?.(`journey-${reason}`);
      if (options.restore !== false && this._journeyOwnsComposition) this.workbench?.restore?.({ reason: `journey-${reason}` });
      this.engine.root.classList.remove("axm-journey-active");
      this.active = null;
      this.index = -1;
      this.playing = false;
      this.paused = false;
      this._journeyOwnsComposition = false;
      const result = { completed: options.completed === true || reason === "completed", reason, name, index };
      const resolve = this._resolveCompletion;
      this._resolveCompletion = null;
      this._completion = null;
      resolve?.(result);
      this._emit(result.completed ? "completed" : "stopped", result);
      return true;
    }

    export(name, space = 2) {
      const journey = this.get(name);
      if (!journey) throw new Error(`Unknown journey: ${name}`);
      delete journey.builtIn;
      return JSON.stringify({ module: "axm.visual.journey", version: VERSION, name, journey }, null, Math.max(0, Math.min(8, Number(space) || 2)));
    }

    import(input, options = {}) {
      let parsed = input;
      if (typeof input === "string") parsed = JSON.parse(input);
      if (!parsed || typeof parsed !== "object") throw new Error("Journey import must be an object or JSON object string.");
      const name = String(parsed.name || options.name || "").trim().toLowerCase();
      return this.register(name, parsed.journey || parsed, { replace: options.replace === true });
    }

    getState() {
      const journey = this.journeys.get(this.active);
      return {
        version: VERSION,
        journeys: this.journeys.size,
        builtIns: Object.keys(BUILT_INS).length,
        active: this.active,
        index: this.index,
        steps: journey?.steps.length || 0,
        playing: this.playing,
        paused: this.paused,
        timerActive: Boolean(this.timer),
        speed: this.speed,
        approvalRequired: true,
        codeFreeJourneys: true,
        targetMutations: 0,
        contentRead: false,
        semanticInference: false,
        navigationControl: false,
        localOnly: true,
        telemetry: false,
        destroyed: this.destroyed
      };
    }

    destroy(options = {}) {
      if (this.destroyed) return this;
      this.stop("destroyed", { restore: options.restore !== false });
      this.journeys.clear();
      this.destroyed = true;
      return this;
    }

    _schedule(duration, token) {
      global.clearTimeout(this.timer);
      const wait = Math.max(30, Math.round(duration / this.speed));
      this.timer = global.setTimeout(() => {
        this.timer = 0;
        if (token !== this.token || !this.active || this.paused) return;
        this.next();
      }, wait);
    }

    _emit(name, detail) {
      if (!this.engine.root || typeof global.CustomEvent !== "function") return;
      this.engine.root.dispatchEvent(new global.CustomEvent(`axmjourney:${name}`, { detail }));
    }
  }

  global.AXMJourneyDirector = AXMJourneyDirector;
})(typeof window !== "undefined" ? window : globalThis);
