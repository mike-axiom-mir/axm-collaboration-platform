/*
 * AXM Adaptive Orchestrator v7.1.0
 * Transparent recommendation engine for visual budgets and compositions.
 * Recommendation-only by default; applying any result requires explicit approval.
 */
(function attachAXMAdaptiveOrchestrator(global) {
  "use strict";

  const VERSION = "7.1.0";
  const INTENTS = new Set(["work", "focus", "create", "review", "present", "celebrate", "accessible", "quiet"]);
  const PRESET_BY_INTENT = Object.freeze({ work: "daily-workspace", focus: "deep-focus", create: "creation-flow", review: "review-proof", present: "presentation-showcase", celebrate: "celebration", accessible: "low-power", quiet: "daily-workspace" });
  const BLUEPRINT_BY_INTENT = Object.freeze({ work: "quiet-proof", focus: "quiet-proof", create: "creation-forge", review: "quiet-proof", present: "showcase-portal", celebrate: "showcase-portal", accessible: "accessible-night", quiet: "quiet-proof" });

  class AXMAdaptiveOrchestrator {
    constructor(options = {}) {
      this.engine = options.engine || null;
      this.workbench = options.workbench || null;
      this.vault = options.vault || null;
      this.mode = options.mode === "apply" ? "apply" : "recommend";
      this.lastRecommendation = null;
      this.appliedBy = null;
      this.destroyed = false;
    }

    static get version() { return VERSION; }
    static get intents() { return Array.from(INTENTS); }

    observe(overrides = {}) {
      const match = (query) => {
        try { return Boolean(global.matchMedia?.(query).matches); } catch (_) { return false; }
      };
      return {
        viewportWidth: Number(overrides.viewportWidth ?? global.innerWidth ?? 1280),
        viewportHeight: Number(overrides.viewportHeight ?? global.innerHeight ?? 720),
        coarsePointer: overrides.coarsePointer ?? match("(pointer: coarse)"),
        reducedMotion: overrides.reducedMotion ?? match("(prefers-reduced-motion: reduce)"),
        highContrast: overrides.highContrast ?? match("(prefers-contrast: more)"),
        forcedColors: overrides.forcedColors ?? match("(forced-colors: active)"),
        deviceMemory: Number(overrides.deviceMemory ?? global.navigator?.deviceMemory ?? 0) || null,
        hardwareConcurrency: Number(overrides.hardwareConcurrency ?? global.navigator?.hardwareConcurrency ?? 0) || null,
        saveData: Boolean(overrides.saveData ?? global.navigator?.connection?.saveData ?? false),
        visibility: overrides.visibility || global.document?.visibilityState || "visible",
        batteryRead: false,
        contentRead: false,
        localOnly: true
      };
    }

    recommend(input = {}) {
      if (this.destroyed) return { valid: false, reason: "destroyed" };
      const intent = INTENTS.has(input.intent) ? input.intent : "work";
      const signals = this.observe(input.signals || {});
      const reasons = [];
      let budget = "workspace";
      let blueprint = BLUEPRINT_BY_INTENT[intent];
      let preset = PRESET_BY_INTENT[intent];

      if (intent === "present" || intent === "celebrate") { budget = "showcase"; reasons.push({ code: "intent-showcase", message: "The explicit user intent favors a presentation-grade composition." }); }
      if (intent === "create") { budget = "balanced"; reasons.push({ code: "intent-create", message: "The explicit user intent allows controlled creative motion and glow." }); }
      if (intent === "accessible" || signals.forcedColors || signals.highContrast) { budget = "accessibility"; blueprint = "accessible-night"; preset = "low-power"; reasons.push({ code: "accessibility-signal", message: "Accessibility intent or system contrast signals take priority over spectacle." }); }
      if (signals.reducedMotion) { reasons.push({ code: "reduced-motion", message: "System reduced-motion preference recommends a quiet composition." }); if (budget === "showcase") budget = "balanced"; if (intent !== "accessible") blueprint = "quiet-proof"; }
      if (signals.saveData || (signals.deviceMemory !== null && signals.deviceMemory <= 4) || (signals.hardwareConcurrency !== null && signals.hardwareConcurrency <= 4)) { budget = "low-power"; preset = "low-power"; if (intent !== "accessible") blueprint = "quiet-proof"; reasons.push({ code: "resource-restraint", message: "Explicitly observable device or data-saving signals recommend the low-power budget." }); }
      if (signals.viewportWidth <= 520 || signals.coarsePointer) { if (budget === "showcase") budget = "balanced"; reasons.push({ code: "compact-interface", message: "Compact or coarse-pointer interfaces benefit from less atmospheric competition and larger controls." }); }
      if (signals.visibility === "hidden") { budget = "low-power"; reasons.push({ code: "hidden-document", message: "A hidden document should not spend resources on spectacle." }); }
      if (!reasons.length) reasons.push({ code: "default-workspace", message: "No constraint signal displaced the calm workspace baseline." });

      const recommendation = {
        version: VERSION,
        valid: true,
        intent,
        budget,
        blueprint,
        preset,
        reasons,
        signals,
        mode: this.mode,
        automaticApply: false,
        approvalRequired: true,
        contentMeaningRead: false,
        semanticInference: false,
        localOnly: true,
        telemetry: false
      };
      this.lastRecommendation = recommendation;
      return JSON.parse(JSON.stringify(recommendation));
    }

    async applyRecommendation(recommendation = this.lastRecommendation, options = {}) {
      if (options.approved !== true) return { applied: false, reason: "approval-required", approvalRequired: true };
      if (!recommendation?.valid) return { applied: false, reason: "invalid-recommendation" };
      let result = null;
      if (options.route === "preset" && this.vault?.apply) {
        result = await this.vault.apply(recommendation.preset, { transition: options.transition !== false, cue: options.cue !== false });
        this.appliedBy = "preset";
      } else if (this.workbench?.apply) {
        result = await this.workbench.apply(recommendation.blueprint, { approved: true, transition: options.transition !== false, cue: options.cue !== false });
        this.appliedBy = "blueprint";
      } else return { applied: false, reason: "no-application-route" };
      return { applied: Boolean(result?.applied), route: this.appliedBy, recommendation, result };
    }

    restore() {
      let restored = false;
      if (this.appliedBy === "blueprint") restored = Boolean(this.workbench?.restore?.({ reason: "orchestrator-restore" }));
      if (this.appliedBy === "preset") restored = Boolean(this.vault?.restore?.());
      this.appliedBy = null;
      return restored;
    }

    getState() { return { version: VERSION, mode: this.mode, lastRecommendation: this.lastRecommendation, appliedBy: this.appliedBy, recommendationOnlyDefault: true, approvalRequired: true, contentMeaningRead: false, semanticInference: false, localOnly: true, telemetry: false, destroyed: this.destroyed }; }
    destroy(options = {}) { if (options.restore !== false) this.restore(); this.lastRecommendation = null; this.destroyed = true; return this; }
  }

  global.AXMAdaptiveOrchestrator = AXMAdaptiveOrchestrator;
})(typeof window !== "undefined" ? window : globalThis);
