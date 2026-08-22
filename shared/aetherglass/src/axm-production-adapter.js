/*
 * AXM Production Adapter v7.1.0
 * Conservative DOM-structure mapper for integrating Aetherglass into an existing
 * platform without reading content meaning or rewriting application logic.
 * Analysis is read-only. Decoration requires an explicit apply() call and is
 * fully ownership-scoped for rollback.
 */
(function attachAXMProductionAdapter(global) {
  "use strict";

  const VERSION = "7.1.0";
  const DEFAULTS = Object.freeze({
    minimumConfidence: 0.78,
    maxElements: 6000,
    includeStructuralPanels: false,
    observe: false,
    autoApproveObserved: false
  });

  const CLASS_MAP = Object.freeze({
    navigation: ["axm-glass", "axm-glass--quiet", "axm-navigation"],
    toolbar: ["axm-glass", "axm-glass--quiet", "axm-toolbar"],
    panel: ["axm-glass", "axm-elevate"],
    quietPanel: ["axm-glass", "axm-glass--quiet"],
    luminousPanel: ["axm-glass", "axm-glass--luminous", "axm-elevate"],
    dialog: ["axm-glass", "axm-glass--solid", "axm-modal"],
    button: ["axm-button"],
    primaryButton: ["axm-button", "axm-button--primary"],
    secondaryButton: ["axm-button", "axm-button--secondary"],
    input: ["axm-input"],
    select: ["axm-select"],
    textarea: ["axm-textarea"],
    tab: ["axm-tab"],
    progress: ["axm-progress"],
    table: ["axm-table"],
    command: ["axm-command"],
    avatar: ["axm-avatar"],
    chip: ["axm-chip"]
  });

  const PANEL_TOKENS = new Set(["panel", "card", "workspace", "surface", "pane", "module", "widget", "console", "dashboard"]);
  const QUIET_TOKENS = new Set(["quiet", "muted", "secondary", "sidebar", "rail", "drawer"]);
  const LUMINOUS_TOKENS = new Set(["hero", "featured", "active", "spotlight", "portal", "showcase", "primary"]);
  const PRIMARY_TOKENS = new Set(["primary", "main", "submit", "confirm", "create", "save"]);
  const SECONDARY_TOKENS = new Set(["secondary", "cancel", "back", "ghost", "subtle"]);

  function tokensOf(element) {
    const tokens = new Set();
    const raw = typeof element.className === "string" ? element.className : "";
    raw.toLowerCase().split(/[^a-z0-9_-]+/).filter(Boolean).forEach((token) => {
      tokens.add(token);
      token.split(/[-_]+/).filter(Boolean).forEach((part) => tokens.add(part));
    });
    return tokens;
  }

  function intersects(tokens, dictionary) {
    for (const token of tokens) if (dictionary.has(token)) return true;
    return false;
  }

  function isIgnored(element) {
    if (!element?.matches) return true;
    if (element.matches("script, style, link, meta, title, template, svg, path, defs, stop, canvas")) return true;
    if (element.closest?.("[data-axm-ignore], [data-axm-owned]")) return true;
    return false;
  }

  function confidence(value) {
    return Math.max(0, Math.min(1, Number(value) || 0));
  }

  class AXMProductionAdapter {
    constructor(options = {}) {
      this.root = options.root || global.document || null;
      this.options = { ...DEFAULTS, ...options };
      this.classMap = { ...CLASS_MAP, ...(options.classMap || {}) };
      this.plan = [];
      this.records = [];
      this._owned = new WeakMap();
      this._attributeRecords = new WeakMap();
      this._observer = null;
      this._pending = new Set();
      this._planSequence = 0;
      this.destroyed = false;
    }

    static get version() { return VERSION; }
    static get types() { return Object.keys(CLASS_MAP); }

    analyze(options = {}) {
      if (this.destroyed) return this._emptyReport("destroyed");
      if (!this.root?.querySelectorAll) throw new Error("AXMProductionAdapter requires a DOM root.");
      const settings = { ...this.options, ...options };
      const candidates = [];
      const nodes = this.root.nodeType === 1 ? [this.root, ...this.root.querySelectorAll("*")] : Array.from(this.root.querySelectorAll("*"));
      const limited = nodes.slice(0, Math.max(0, Number(settings.maxElements) || DEFAULTS.maxElements));
      for (const element of limited) {
        if (isIgnored(element)) continue;
        const candidate = this._classify(element, settings);
        if (!candidate) continue;
        candidates.push({
          id: `axm-map-${++this._planSequence}`,
          element,
          type: candidate.type,
          confidence: confidence(candidate.confidence),
          reason: candidate.reason,
          classes: [...(this.classMap[candidate.type] || [])],
          alreadyDecorated: (this.classMap[candidate.type] || []).every((name) => element.classList.contains(name))
        });
      }
      this.plan = candidates;
      const byType = {};
      for (const item of candidates) byType[item.type] = (byType[item.type] || 0) + 1;
      return {
        version: VERSION,
        mode: "analysis",
        scannedElements: limited.length,
        truncated: nodes.length > limited.length,
        candidates: candidates.length,
        applicable: candidates.filter((item) => item.confidence >= settings.minimumConfidence && !item.alreadyDecorated).length,
        byType,
        minimumConfidence: settings.minimumConfidence,
        contentMeaningRead: false,
        mutations: 0,
        localOnly: true,
        telemetry: false,
        plan: this.exportPlan()
      };
    }

    exportPlan() {
      return this.plan.map((item) => ({
        id: item.id,
        type: item.type,
        confidence: item.confidence,
        reason: item.reason,
        classes: [...item.classes],
        alreadyDecorated: item.alreadyDecorated,
        tag: item.element?.tagName?.toLowerCase?.() || null,
        role: item.element?.getAttribute?.("role") || null,
        idAttribute: item.element?.id || null
      }));
    }

    apply(options = {}) {
      if (this.destroyed) return { applied: 0, rejected: "destroyed" };
      if (!this.plan.length || options.rescan) this.analyze(options);
      const minimum = confidence(options.minimumConfidence ?? this.options.minimumConfidence);
      const approvedTypes = options.types ? new Set(Array.isArray(options.types) ? options.types : [options.types]) : null;
      const approvedIds = options.ids ? new Set(Array.isArray(options.ids) ? options.ids : [options.ids]) : null;
      let appliedElements = 0;
      let addedClasses = 0;
      const rejected = [];

      for (const item of this.plan) {
        if (!item.element?.isConnected && this.root.nodeType === 9) continue;
        if (item.confidence < minimum) { rejected.push({ id: item.id, reason: "below-confidence" }); continue; }
        if (approvedTypes && !approvedTypes.has(item.type)) { rejected.push({ id: item.id, reason: "type-not-approved" }); continue; }
        if (approvedIds && !approvedIds.has(item.id)) { rejected.push({ id: item.id, reason: "id-not-approved" }); continue; }
        const result = this.decorate(item.element, item.type, { source: item.id });
        if (result.addedClasses || result.attributeApplied) appliedElements += 1;
        addedClasses += result.addedClasses;
      }
      if (this.options.observe || options.observe) this.startObserving({ autoApprove: Boolean(options.autoApproveObserved ?? this.options.autoApproveObserved) });
      return {
        version: VERSION,
        applied: appliedElements,
        addedClasses,
        rejected,
        reversible: true,
        ownershipScoped: true,
        contentMeaningRead: false
      };
    }

    decorate(element, type, options = {}) {
      if (this.destroyed || !element?.classList) return { addedClasses: 0, attributeApplied: false, rejected: "invalid-element" };
      const classes = this.classMap[type];
      if (!classes) return { addedClasses: 0, attributeApplied: false, rejected: "unknown-type" };
      let owned = this._owned.get(element);
      if (!owned) { owned = new Set(); this._owned.set(element, owned); }
      const added = [];
      for (const className of classes) {
        if (!className || element.classList.contains(className)) continue;
        element.classList.add(className);
        owned.add(className);
        added.push(className);
      }

      let attributeApplied = false;
      let attributeRecord = this._attributeRecords.get(element);
      if (!attributeRecord) {
        attributeRecord = { original: element.getAttribute("data-axm-production-type"), lastApplied: null };
        this._attributeRecords.set(element, attributeRecord);
      }
      if (!element.hasAttribute("data-axm-production-type") || element.getAttribute("data-axm-production-type") === attributeRecord.lastApplied) {
        element.setAttribute("data-axm-production-type", type);
        attributeRecord.lastApplied = type;
        attributeApplied = true;
      }

      if (added.length || attributeApplied) {
        this.records.push({ element, type, added, source: options.source || "explicit", attributeApplied });
      }
      return { addedClasses: added.length, added, attributeApplied, type };
    }

    startObserving(options = {}) {
      if (this.destroyed || this._observer || !global.MutationObserver || !this.root) return false;
      const autoApprove = Boolean(options.autoApprove);
      const target = this.root.nodeType === 9 ? this.root.documentElement : this.root;
      this._observer = new global.MutationObserver((mutations) => {
        for (const mutation of mutations) {
          for (const node of mutation.addedNodes) {
            if (node.nodeType !== 1) continue;
            const elements = [node, ...(node.querySelectorAll?.("*") || [])];
            for (const element of elements) {
              if (isIgnored(element)) continue;
              const candidate = this._classify(element, this.options);
              if (!candidate) continue;
              if (autoApprove && candidate.confidence >= this.options.minimumConfidence) this.decorate(element, candidate.type, { source: "observer" });
              else this._pending.add(element);
            }
          }
        }
      });
      this._observer.observe(target, { childList: true, subtree: true });
      return true;
    }

    stopObserving() {
      if (!this._observer) return false;
      this._observer.disconnect();
      this._observer = null;
      return true;
    }

    analyzePending() {
      const pending = Array.from(this._pending).filter((element) => element?.isConnected !== false);
      this._pending.clear();
      const previousPlan = this.plan;
      this.plan = [];
      for (const element of pending) {
        const candidate = this._classify(element, this.options);
        if (!candidate) continue;
        this.plan.push({
          id: `axm-map-${++this._planSequence}`,
          element,
          type: candidate.type,
          confidence: confidence(candidate.confidence),
          reason: candidate.reason,
          classes: [...(this.classMap[candidate.type] || [])],
          alreadyDecorated: (this.classMap[candidate.type] || []).every((name) => element.classList.contains(name))
        });
      }
      const report = { version: VERSION, candidates: this.plan.length, plan: this.exportPlan(), mutations: 0 };
      this.plan = [...previousPlan, ...this.plan];
      return report;
    }

    rollback() {
      this.stopObserving();
      let removedClasses = 0;
      const touched = new Set();
      for (const record of this.records) {
        if (!record.element?.classList) continue;
        touched.add(record.element);
        for (const className of record.added) {
          if (!record.element.classList.contains(className)) continue;
          record.element.classList.remove(className);
          removedClasses += 1;
        }
      }
      let restoredAttributes = 0;
      for (const element of touched) {
        const record = this._attributeRecords.get(element);
        if (!record || element.getAttribute("data-axm-production-type") !== record.lastApplied) continue;
        if (record.original === null) element.removeAttribute("data-axm-production-type");
        else element.setAttribute("data-axm-production-type", record.original);
        restoredAttributes += 1;
      }
      this.records = [];
      this.plan = [];
      this._pending.clear();
      this._owned = new WeakMap();
      this._attributeRecords = new WeakMap();
      return { version: VERSION, rolledBack: true, removedClasses, restoredAttributes, ownershipScoped: true };
    }

    getState() {
      return {
        version: VERSION,
        candidates: this.plan.length,
        records: this.records.length,
        observing: Boolean(this._observer),
        pending: this._pending.size,
        destroyed: this.destroyed,
        localOnly: true,
        telemetry: false,
        contentMeaningRead: false
      };
    }

    destroy() {
      if (this.destroyed) return this;
      this.rollback();
      this.destroyed = true;
      return this;
    }

    _classify(element, settings) {
      const tag = element.tagName?.toLowerCase?.() || "";
      const role = (element.getAttribute?.("role") || "").toLowerCase();
      const inputType = (element.getAttribute?.("type") || "").toLowerCase();
      const tokens = tokensOf(element);
      if (tag === "nav" || role === "navigation") return { type: "navigation", confidence: .99, reason: "semantic-navigation" };
      if (role === "toolbar" || tokens.has("toolbar")) return { type: "toolbar", confidence: .96, reason: "toolbar-role-or-token" };
      if (tag === "dialog" || role === "dialog" || role === "alertdialog") return { type: "dialog", confidence: .99, reason: "semantic-dialog" };
      if (role === "tab") return { type: "tab", confidence: .99, reason: "semantic-tab" };
      if (role === "progressbar" || tag === "progress") return { type: "progress", confidence: .99, reason: "semantic-progress" };
      if (tag === "table") return { type: "table", confidence: .99, reason: "semantic-table" };
      if (tag === "select") return { type: "select", confidence: .99, reason: "native-select" };
      if (tag === "textarea") return { type: "textarea", confidence: .99, reason: "native-textarea" };
      if (tag === "input") {
        if (["button", "submit", "reset"].includes(inputType)) {
          if (intersects(tokens, PRIMARY_TOKENS) || inputType === "submit") return { type: "primaryButton", confidence: .95, reason: "native-primary-action" };
          return { type: "button", confidence: .92, reason: "native-button-input" };
        }
        if (["checkbox", "radio", "range", "color", "file", "hidden"].includes(inputType)) return null;
        return { type: "input", confidence: .99, reason: "native-input" };
      }
      if (tag === "button" || role === "button") {
        if (intersects(tokens, PRIMARY_TOKENS)) return { type: "primaryButton", confidence: .94, reason: "button-primary-token" };
        if (intersects(tokens, SECONDARY_TOKENS)) return { type: "secondaryButton", confidence: .9, reason: "button-secondary-token" };
        return { type: "button", confidence: .96, reason: "semantic-button" };
      }
      if (tokens.has("command") || tokens.has("terminal") || tokens.has("prompt")) return { type: "command", confidence: .86, reason: "command-surface-token" };
      if (tokens.has("avatar") || element.hasAttribute?.("data-avatar")) return { type: "avatar", confidence: .9, reason: "avatar-token" };
      if (tokens.has("chip") || tokens.has("badge") || role === "status") return { type: "chip", confidence: .84, reason: "status-token" };
      if (intersects(tokens, PANEL_TOKENS)) {
        if (intersects(tokens, LUMINOUS_TOKENS)) return { type: "luminousPanel", confidence: .88, reason: "panel-and-luminous-token" };
        if (intersects(tokens, QUIET_TOKENS)) return { type: "quietPanel", confidence: .86, reason: "panel-and-quiet-token" };
        return { type: "panel", confidence: .84, reason: "panel-token" };
      }
      if (settings.includeStructuralPanels && ["section", "article", "aside"].includes(tag)) {
        return { type: tag === "aside" ? "quietPanel" : "panel", confidence: .68, reason: "structural-container" };
      }
      return null;
    }

    _emptyReport(reason) {
      return { version: VERSION, mode: "analysis", scannedElements: 0, candidates: 0, applicable: 0, reason, mutations: 0 };
    }
  }

  global.AXMProductionAdapter = AXMProductionAdapter;
})(typeof window !== "undefined" ? window : globalThis);
