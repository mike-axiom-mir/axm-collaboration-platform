/*
 * AXM Visual Drift Monitor v7.1.0
 * Read-only structural and computed-style signatures for explicit visual regression checks.
 * It reads no text content and makes no DOM changes.
 */
(function attachAXMVisualDriftMonitor(global) {
  "use strict";

  const VERSION = "7.1.0";
  const PROPERTIES = Object.freeze(["color", "backgroundColor", "borderColor", "boxShadow", "backdropFilter", "opacity", "fontSize", "fontWeight", "lineHeight", "borderRadius", "transform", "zIndex", "display", "visibility"]);
  const DYNAMIC_PROPERTIES = new Set(["transform"]);
  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function stableString(value) { return JSON.stringify(value, Object.keys(value).sort()); }
  function hash(value) {
    const text = JSON.stringify(value);
    let h = 5381;
    for (let i = 0; i < text.length; i += 1) h = ((h << 5) + h) ^ text.charCodeAt(i);
    return `djb2-${(h >>> 0).toString(16).padStart(8, "0")}`;
  }
  function resolve(root, target) {
    if (!target) return [];
    if (typeof target === "string") { try { return Array.from(root.querySelectorAll(target)); } catch (_) { return []; } }
    if (target.nodeType === 1) return [target];
    if (typeof target[Symbol.iterator] === "function") return Array.from(target).filter((item) => item?.nodeType === 1);
    return [];
  }
  function signatureFor(element, index) {
    const style = global.getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    const styles = {};
    for (const property of PROPERTIES) styles[property] = style[property] || "";
    const attributes = {};
    for (const attr of Array.from(element.attributes || [])) if (attr.name.startsWith("data-axm-")) attributes[attr.name] = attr.value;
    return {
      key: `${element.tagName.toLowerCase()}#${element.id || "_"}:${index}`,
      tag: element.tagName.toLowerCase(),
      id: element.id || null,
      axmClasses: Array.from(element.classList).filter((name) => name.startsWith("axm-")).sort(),
      attributes,
      styles,
      geometry: { width: Math.round(rect.width * 10) / 10, height: Math.round(rect.height * 10) / 10 },
      contentRead: false
    };
  }
  function compareEntries(before, after, options) {
    const changes = [];
    if (!before || !after) return [{ category: "structure", property: "presence", before: Boolean(before), after: Boolean(after), severity: "high" }];
    if (stableString(before.axmClasses) !== stableString(after.axmClasses)) changes.push({ category: "structure", property: "axmClasses", before: before.axmClasses, after: after.axmClasses, severity: "medium" });
    if (stableString(before.attributes) !== stableString(after.attributes)) changes.push({ category: "tokens", property: "dataAttributes", before: before.attributes, after: after.attributes, severity: "medium" });
    for (const property of PROPERTIES) {
      if (options.ignoreDynamic !== false && DYNAMIC_PROPERTIES.has(property)) continue;
      if (before.styles[property] !== after.styles[property]) changes.push({ category: "visual", property, before: before.styles[property], after: after.styles[property], severity: ["display", "visibility", "color", "backgroundColor"].includes(property) ? "high" : "low" });
    }
    const widthDelta = Math.abs(before.geometry.width - after.geometry.width);
    const heightDelta = Math.abs(before.geometry.height - after.geometry.height);
    if (widthDelta > (options.geometryTolerance ?? 2) || heightDelta > (options.geometryTolerance ?? 2)) changes.push({ category: "geometry", property: "size", before: before.geometry, after: after.geometry, severity: widthDelta > 20 || heightDelta > 20 ? "high" : "medium" });
    return changes;
  }

  class AXMVisualDriftMonitor {
    constructor(options = {}) {
      this.root = options.root || global.document || null;
      if (!this.root?.querySelectorAll) throw new Error("AXMVisualDriftMonitor requires a document or element root.");
      this.baselines = new Map();
      this.lastComparison = null;
    }

    static get version() { return VERSION; }

    capture(target, options = {}) {
      const elements = resolve(this.root, target);
      const entries = elements.slice(0, options.limit || 200).map(signatureFor);
      return { version: VERSION, selector: typeof target === "string" ? target : null, count: entries.length, entries, fingerprint: hash(entries), capturedAt: options.includeTime ? new Date().toISOString() : null, contentRead: false, mutations: 0, localOnly: true };
    }

    setBaseline(name, target, options = {}) {
      const key = String(name || "").trim();
      if (!key || key.length > 80) throw new Error("Baseline name must be 1–80 characters.");
      const capture = this.capture(target, options);
      if (!capture.count) return { saved: false, reason: "no-targets", capture };
      this.baselines.set(key, capture);
      return { saved: true, name: key, count: capture.count, fingerprint: capture.fingerprint, mutations: 0 };
    }

    compare(name, options = {}) {
      const baseline = this.baselines.get(name);
      if (!baseline) return { compared: false, reason: "unknown-baseline", mutations: 0 };
      const current = this.capture(options.target || baseline.selector, options);
      const beforeMap = new Map(baseline.entries.map((entry) => [entry.key, entry]));
      const afterMap = new Map(current.entries.map((entry) => [entry.key, entry]));
      const elementChanges = [];
      for (const key of new Set([...beforeMap.keys(), ...afterMap.keys()])) {
        const changes = compareEntries(beforeMap.get(key), afterMap.get(key), options);
        if (changes.length) elementChanges.push({ key, changes });
      }
      const counts = { high: 0, medium: 0, low: 0 };
      for (const item of elementChanges) for (const change of item.changes) counts[change.severity] += 1;
      const weighted = counts.high * 12 + counts.medium * 5 + counts.low * 1;
      const score = Math.max(0, 100 - weighted);
      const result = { version: VERSION, compared: true, name, drifted: elementChanges.length > 0, score, grade: score >= 95 ? "A" : score >= 85 ? "B" : score >= 70 ? "C" : score >= 50 ? "D" : "E", changeElements: elementChanges.length, changeCount: counts.high + counts.medium + counts.low, counts, changes: elementChanges, baselineFingerprint: baseline.fingerprint, currentFingerprint: current.fingerprint, contentRead: false, mutations: 0, localOnly: true };
      this.lastComparison = result;
      return clone(result);
    }

    removeBaseline(name) { return this.baselines.delete(name); }
    clear() { const count = this.baselines.size; this.baselines.clear(); this.lastComparison = null; return count; }
    exportBaseline(name, space = 2) { const baseline = this.baselines.get(name); if (!baseline) throw new Error(`Unknown baseline: ${name}`); return JSON.stringify({ module: "axm.visual.drift-baseline", version: VERSION, name, baseline }, null, Math.max(0, Math.min(8, Number(space) || 2))); }
    importBaseline(input, options = {}) { let parsed = input; if (typeof input === "string") parsed = JSON.parse(input); const name = String(parsed.name || options.name || "").trim(); const baseline = parsed.baseline || parsed; if (!name || !Array.isArray(baseline.entries)) throw new Error("Invalid visual drift baseline."); this.baselines.set(name, clone(baseline)); return true; }
    getState() { return { version: VERSION, baselines: this.baselines.size, lastComparison: this.lastComparison ? { score: this.lastComparison.score, changeCount: this.lastComparison.changeCount } : null, readOnly: true, contentRead: false, mutations: 0, localOnly: true, telemetry: false }; }
  }

  global.AXMVisualDriftMonitor = AXMVisualDriftMonitor;
})(typeof window !== "undefined" ? window : globalThis);
