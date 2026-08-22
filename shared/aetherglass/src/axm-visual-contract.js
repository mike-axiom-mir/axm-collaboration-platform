/*
 * AXM Visual Contract v7.1.0
 * Read-only schema and policy validation for portable, code-free visual blueprints.
 * Fingerprints are deterministic change identifiers, not cryptographic signatures.
 */
(function attachAXMVisualContract(global) {
  "use strict";

  const VERSION = "7.1.0";
  const TOP_KEYS = new Set(["module", "version", "label", "description", "policy", "tokenPack", "scene", "engine", "field", "surfaces", "budget", "transition", "cue", "tags", "provenance"]);
  const ENGINE_KEYS = new Set(["theme", "atmosphere", "material", "depth", "luminosity", "density", "shape", "transparency", "contrast", "quality", "motion", "intensity", "atmosphereStrength", "glowStrength", "pointerLighting", "reactivePanels", "parallax", "trackScroll", "palette"]);
  const FIELD_KEYS = new Set(["preset", "density", "energy", "speed", "interactive"]);
  const SURFACE_KEYS = new Set(["target", "recipe", "overrides", "wake"]);
  const POLICIES = new Set(["production-safe", "workspace", "showcase", "low-power", "accessibility"]);
  const BUDGETS = new Set(["showcase", "balanced", "workspace", "low-power", "accessibility"]);
  const MAX_SURFACES = 32;

  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function stable(value) {
    if (Array.isArray(value)) return value.map(stable);
    if (value && typeof value === "object") return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
    return value;
  }
  function canonical(value) { return JSON.stringify(stable(value)); }
  function fingerprint(value) {
    const text = canonical(value);
    let hash = 2166136261;
    for (let i = 0; i < text.length; i += 1) {
      hash ^= text.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return `fnv1a32-${(hash >>> 0).toString(16).padStart(8, "0")}`;
  }
  function finite(value) { return typeof value === "number" && Number.isFinite(value); }
  function safeText(value, max = 400) { return typeof value === "string" && value.length <= max && !/[{};]/.test(value); }
  function push(list, code, path, message, severity = "error") { list.push({ code, path, message, severity }); }
  function unknownKeys(object, allowed, path, issues) {
    if (!object || typeof object !== "object" || Array.isArray(object)) return;
    for (const key of Object.keys(object)) if (!allowed.has(key)) push(issues, "unknown-key", `${path}.${key}`, `Unsupported key: ${key}`);
  }
  function selectorIsValid(root, selector) {
    if (!safeText(selector, 300) || !selector.trim()) return false;
    try { root.querySelector(selector); return true; } catch (_) { return false; }
  }
  function diffValues(a, b, path = "", output = []) {
    if (Object.is(a, b)) return output;
    if (Array.isArray(a) && Array.isArray(b)) {
      const max = Math.max(a.length, b.length);
      for (let i = 0; i < max; i += 1) diffValues(a[i], b[i], `${path}[${i}]`, output);
      return output;
    }
    if (a && b && typeof a === "object" && typeof b === "object" && !Array.isArray(a) && !Array.isArray(b)) {
      for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) diffValues(a[key], b[key], path ? `${path}.${key}` : key, output);
      return output;
    }
    output.push({ path: path || "$", before: clone(a), after: clone(b) });
    return output;
  }

  class AXMVisualContract {
    constructor(options = {}) {
      this.root = options.root || global.document || null;
      if (!this.root?.querySelector) throw new Error("AXMVisualContract requires a document or element root.");
      this.engine = options.engine || null;
      this.lastReport = null;
    }

    static get version() { return VERSION; }
    static get policies() { return Array.from(POLICIES); }

    normalize(input) {
      let parsed = input;
      if (typeof input === "string") parsed = JSON.parse(input);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Visual contract must be an object or JSON object string.");
      return stable(clone(parsed));
    }

    validate(input, options = {}) {
      const contract = this.normalize(input);
      const issues = [];
      const warnings = [];
      unknownKeys(contract, TOP_KEYS, "$", issues);
      const policy = options.policy || contract.policy || "production-safe";
      if (!POLICIES.has(policy)) push(issues, "unknown-policy", "$.policy", `Unknown policy: ${policy}`);
      if (contract.module !== undefined && contract.module !== "axm.visual.composition") push(issues, "module-mismatch", "$.module", "Expected module axm.visual.composition.");
      if (contract.label !== undefined && !safeText(contract.label, 100)) push(issues, "unsafe-label", "$.label", "Label is too long or contains unsupported delimiters.");
      if (contract.description !== undefined && !safeText(contract.description, 600)) push(issues, "unsafe-description", "$.description", "Description is too long or contains unsupported delimiters.");
      if (contract.tokenPack !== undefined && !safeText(contract.tokenPack, 64)) push(issues, "unsafe-token-pack", "$.tokenPack", "Token pack name is invalid.");
      if (contract.scene !== undefined && !safeText(contract.scene, 64)) push(issues, "unsafe-scene", "$.scene", "Scene name is invalid.");
      if (contract.transition !== undefined && !safeText(contract.transition, 32)) push(issues, "unsafe-transition", "$.transition", "Transition name is invalid.");
      if (contract.cue !== undefined && !safeText(contract.cue, 64)) push(issues, "unsafe-cue", "$.cue", "Cue name is invalid.");
      if (contract.budget !== undefined && !BUDGETS.has(contract.budget)) push(issues, "unknown-budget", "$.budget", `Unknown performance budget: ${contract.budget}`);

      if (contract.engine !== undefined) {
        if (!contract.engine || typeof contract.engine !== "object" || Array.isArray(contract.engine)) push(issues, "invalid-engine", "$.engine", "Engine configuration must be an object.");
        else {
          unknownKeys(contract.engine, ENGINE_KEYS, "$.engine", issues);
          for (const key of ["intensity", "atmosphereStrength", "glowStrength"]) {
            if (contract.engine[key] !== undefined && (!finite(contract.engine[key]) || contract.engine[key] < 0 || contract.engine[key] > 2)) push(issues, "range", `$.engine.${key}`, `${key} must be a finite number from 0 to 2.`);
          }
          if (contract.engine.palette !== undefined && (!contract.engine.palette || typeof contract.engine.palette !== "object" || Array.isArray(contract.engine.palette))) push(issues, "invalid-palette", "$.engine.palette", "Palette must be an object.");
        }
      }

      if (contract.field !== undefined) {
        if (!contract.field || typeof contract.field !== "object" || Array.isArray(contract.field)) push(issues, "invalid-field", "$.field", "Field configuration must be an object.");
        else {
          unknownKeys(contract.field, FIELD_KEYS, "$.field", issues);
          for (const key of ["density", "energy", "speed"]) {
            if (contract.field[key] !== undefined && (!finite(contract.field[key]) || contract.field[key] < 0 || contract.field[key] > 1)) push(issues, "range", `$.field.${key}`, `${key} must be a finite number from 0 to 1.`);
          }
        }
      }

      if (contract.surfaces !== undefined) {
        if (!Array.isArray(contract.surfaces) || contract.surfaces.length > MAX_SURFACES) push(issues, "invalid-surfaces", "$.surfaces", `Surfaces must be an array of at most ${MAX_SURFACES} entries.`);
        else contract.surfaces.forEach((surface, index) => {
          const path = `$.surfaces[${index}]`;
          if (!surface || typeof surface !== "object" || Array.isArray(surface)) return push(issues, "invalid-surface", path, "Surface entry must be an object.");
          unknownKeys(surface, SURFACE_KEYS, path, issues);
          if (!selectorIsValid(this.root, surface.target)) push(issues, "invalid-selector", `${path}.target`, "Surface target is not a valid local selector.");
          if (!safeText(surface.recipe, 64) || !surface.recipe) push(issues, "invalid-recipe", `${path}.recipe`, "Surface recipe is required.");
          if (surface.overrides !== undefined && (!surface.overrides || typeof surface.overrides !== "object" || Array.isArray(surface.overrides))) push(issues, "invalid-overrides", `${path}.overrides`, "Surface overrides must be an object.");
          if (surface.wake !== undefined && typeof surface.wake !== "boolean") push(issues, "invalid-wake", `${path}.wake`, "Surface wake must be boolean.");
        });
      }

      const engine = contract.engine || {};
      const field = contract.field || {};
      const budget = contract.budget || "balanced";
      if (policy === "production-safe") {
        if ((engine.intensity ?? 1) > 1.35) push(warnings, "high-intensity", "$.engine.intensity", "Production-safe compositions should normally stay at or below 1.35.", "warning");
        if ((engine.glowStrength ?? 1) > 1.25) push(warnings, "high-glow", "$.engine.glowStrength", "Production-safe compositions should normally stay at or below 1.25.", "warning");
        if ((field.density ?? 0) > .78) push(warnings, "dense-field", "$.field.density", "Dense particle fields can compete with platform content.", "warning");
      }
      if (policy === "workspace") {
        if ((engine.intensity ?? 1) > 1.05) push(issues, "workspace-intensity", "$.engine.intensity", "Workspace policy limits intensity to 1.05.");
        if ((engine.glowStrength ?? 1) > .9) push(issues, "workspace-glow", "$.engine.glowStrength", "Workspace policy limits glow strength to .90.");
        if ((field.density ?? 0) > .4) push(issues, "workspace-density", "$.field.density", "Workspace policy limits particle density to .40.");
      }
      if (policy === "low-power" || budget === "low-power") {
        if (field.preset && field.preset !== "off") push(issues, "low-power-field", "$.field.preset", "Low-power contracts require the particle field to be off.");
        if (engine.quality && !["low", "auto"].includes(engine.quality)) push(issues, "low-power-quality", "$.engine.quality", "Low-power contracts allow only low or auto quality.");
        if (engine.motion && !["off", "reduced", "auto"].includes(engine.motion)) push(issues, "low-power-motion", "$.engine.motion", "Low-power contracts require off, reduced, or auto motion.");
      }
      if (policy === "accessibility" || budget === "accessibility") {
        if (engine.motion && !["off", "reduced"].includes(engine.motion)) push(issues, "accessibility-motion", "$.engine.motion", "Accessibility contracts require off or reduced motion.");
        if (engine.transparency && engine.transparency !== "off") push(issues, "accessibility-transparency", "$.engine.transparency", "Accessibility contracts require opaque surfaces.");
        if (engine.contrast && engine.contrast !== "high") push(issues, "accessibility-contrast", "$.engine.contrast", "Accessibility contracts require high contrast.");
        if (field.preset && field.preset !== "off") push(issues, "accessibility-field", "$.field.preset", "Accessibility contracts require the particle field to be off.");
      }
      if (policy === "showcase" && budget === "low-power") push(warnings, "policy-budget-tension", "$.budget", "Showcase policy and low-power budget pull in opposite visual directions.", "warning");

      const selectorImpact = Array.isArray(contract.surfaces) ? contract.surfaces.map((surface) => {
        let matched = 0;
        try { matched = this.root.querySelectorAll(surface.target).length; } catch (_) { matched = 0; }
        return { target: surface.target, matched };
      }) : [];
      const allIssues = [...issues, ...warnings];
      const score = Math.max(0, 100 - issues.length * 18 - warnings.length * 5);
      const report = {
        version: VERSION,
        valid: issues.length === 0,
        policy,
        score,
        grade: score >= 92 ? "A" : score >= 80 ? "B" : score >= 65 ? "C" : score >= 45 ? "D" : "E",
        errors: issues,
        warnings,
        issueCount: allIssues.length,
        selectorImpact,
        fingerprint: fingerprint(contract),
        deterministicFingerprintNotSignature: true,
        mutations: 0,
        contentRead: false,
        codeFree: true,
        localOnly: true,
        contract
      };
      this.lastReport = report;
      return clone(report);
    }

    compare(before, after) {
      const a = this.normalize(before);
      const b = this.normalize(after);
      const changes = diffValues(a, b);
      return { version: VERSION, changed: changes.length > 0, changeCount: changes.length, changes, beforeFingerprint: fingerprint(a), afterFingerprint: fingerprint(b), mutations: 0 };
    }

    fingerprint(input) { return fingerprint(this.normalize(input)); }
    exportReport(space = 2) {
      if (!this.lastReport) throw new Error("No visual contract report is available.");
      return JSON.stringify(this.lastReport, null, Math.max(0, Math.min(8, Number(space) || 2)));
    }
    getState() { return { version: VERSION, policies: Array.from(POLICIES), lastFingerprint: this.lastReport?.fingerprint || null, lastValid: this.lastReport?.valid ?? null, readOnly: true, codeFree: true, localOnly: true, telemetry: false, contentRead: false }; }
  }

  global.AXMVisualContract = AXMVisualContract;
})(typeof window !== "undefined" ? window : globalThis);
