/*
 * AXM Visual Adapter v7.1.0
 * Explicit selector-to-class decoration with dry-run, optional observation,
 * per-class ownership records, and complete rollback of only adapter-owned changes.
 */
(function attachAXMVisualAdapter(global) {
  "use strict";

  const VERSION = "7.1.0";
  const DEFAULT_MAP = Object.freeze({
    navigation: [], toolbars: [], panels: [], luminousPanels: [], quietPanels: [], solidPanels: [], prismaticPanels: [],
    tiltPanels: [], buttons: [], primaryButtons: [], secondaryButtons: [], luxuryButtons: [], ghostButtons: [], magneticButtons: [],
    inputs: [], selects: [], textareas: [], chips: [], tabs: [], progress: [], tables: [], commands: [], iconTiles: [], avatars: []
  });

  const DEFAULT_CLASS_MAP = Object.freeze({
    navigation: ["axm-glass", "axm-glass--quiet", "axm-navigation"],
    toolbars: ["axm-glass", "axm-glass--quiet", "axm-toolbar"],
    panels: ["axm-glass", "axm-elevate"],
    luminousPanels: ["axm-glass", "axm-glass--luminous", "axm-elevate"],
    quietPanels: ["axm-glass", "axm-glass--quiet"],
    solidPanels: ["axm-glass", "axm-glass--solid"],
    prismaticPanels: ["axm-glass", "axm-glass--prismatic", "axm-elevate"],
    tiltPanels: ["axm-glass", "axm-tilt"],
    buttons: ["axm-button"],
    primaryButtons: ["axm-button", "axm-button--primary"],
    secondaryButtons: ["axm-button", "axm-button--secondary"],
    luxuryButtons: ["axm-button", "axm-button--lux"],
    ghostButtons: ["axm-button", "axm-button--ghost"],
    magneticButtons: ["axm-button", "axm-button--magnetic"],
    inputs: ["axm-input"],
    selects: ["axm-select"],
    textareas: ["axm-textarea"],
    chips: ["axm-chip"],
    tabs: ["axm-tab"],
    progress: ["axm-progress"],
    tables: ["axm-table"],
    commands: ["axm-command"],
    iconTiles: ["axm-icon-tile"],
    avatars: ["axm-avatar"]
  });

  function normalizeSelectors(value) {
    if (!value) return [];
    return (Array.isArray(value) ? value : [value]).filter((item) => typeof item === "string" && item.trim()).map((item) => item.trim());
  }

  class AXMVisualAdapter {
    constructor(options = {}) {
      this.root = options.root || global.document || null;
      this.map = { ...DEFAULT_MAP, ...(options.map || options.selectors || options) };
      this.classMap = { ...DEFAULT_CLASS_MAP, ...(options.classMap || {}) };
      this.observe = Boolean(options.observe);
      this.records = [];
      this.invalidSelectors = [];
      this.applied = false;
      this.observer = null;
      this._owned = new WeakMap();
    }

    preview() {
      return this._scan({ apply: false });
    }

    apply(options = {}) {
      if (!this.root?.querySelectorAll) throw new Error("AXMVisualAdapter requires a DOM root.");
      if (this.applied && !options.rescan) return this.report();
      const result = this._scan({ apply: true });
      this.applied = true;
      if (this.observe || options.observe) this.startObserving();
      return { ...result, ...this.report() };
    }

    applyTo(element) {
      if (!element?.matches) return { matchedGroups: 0, addedClasses: 0 };
      let matchedGroups = 0;
      let addedClasses = 0;
      for (const [group, classes] of Object.entries(this.classMap)) {
        for (const selector of normalizeSelectors(this.map[group])) {
          let matches = false;
          try { matches = element.matches(selector); }
          catch (error) {
            this._recordInvalid(group, selector, error.message);
            continue;
          }
          if (!matches) continue;
          matchedGroups += 1;
          addedClasses += this._decorate(element, group, selector, classes);
        }
      }
      return { matchedGroups, addedClasses };
    }

    startObserving() {
      if (this.observer || !global.MutationObserver || !this.root) return false;
      const target = this.root.nodeType === 9 ? this.root.documentElement : this.root;
      this.observer = new global.MutationObserver((mutations) => {
        for (const mutation of mutations) {
          for (const node of mutation.addedNodes) {
            if (node.nodeType !== 1) continue;
            this.applyTo(node);
            node.querySelectorAll?.("*").forEach((child) => this.applyTo(child));
          }
        }
      });
      this.observer.observe(target, { childList: true, subtree: true });
      return true;
    }

    stopObserving() {
      if (!this.observer) return false;
      this.observer.disconnect();
      this.observer = null;
      return true;
    }

    rollback() {
      this.stopObserving();
      let removedClasses = 0;
      for (const record of this.records) {
        if (record.status !== "applied" || !record.element?.classList) continue;
        for (const className of record.added) {
          if (record.element.classList.contains(className)) {
            record.element.classList.remove(className);
            removedClasses += 1;
          }
        }
      }
      const before = this.report();
      this.records = [];
      this.invalidSelectors = [];
      this._owned = new WeakMap();
      this.applied = false;
      return { ...before, applied: false, rolledBack: true, removedClasses };
    }

    report() {
      const appliedRecords = this.records.filter((record) => record.status === "applied");
      return {
        version: VERSION,
        applied: this.applied,
        observing: Boolean(this.observer),
        matchedElements: new Set(appliedRecords.map((record) => record.element)).size,
        matchedRecords: appliedRecords.length,
        addedClasses: appliedRecords.reduce((sum, record) => sum + record.added.length, 0),
        invalidSelectors: [...this.invalidSelectors],
        reversible: true,
        ownershipScoped: true
      };
    }

    _scan({ apply }) {
      if (!this.root?.querySelectorAll) throw new Error("AXMVisualAdapter requires a DOM root.");
      const previewElements = new Set();
      let matches = 0;
      let additions = 0;

      for (const [group, classes] of Object.entries(this.classMap)) {
        for (const selector of normalizeSelectors(this.map[group])) {
          let elements;
          try { elements = this.root.querySelectorAll(selector); }
          catch (error) {
            this._recordInvalid(group, selector, error.message);
            continue;
          }
          for (const element of elements) {
            matches += 1;
            previewElements.add(element);
            const added = classes.filter((className) => !element.classList.contains(className));
            additions += added.length;
            if (apply) this._decorate(element, group, selector, classes);
          }
        }
      }

      return {
        mode: apply ? "apply" : "preview",
        matchedElements: previewElements.size,
        matchedRecords: matches,
        potentialAddedClasses: additions,
        invalidSelectors: [...this.invalidSelectors]
      };
    }

    _decorate(element, group, selector, classes) {
      let owned = this._owned.get(element);
      if (!owned) {
        owned = new Set();
        this._owned.set(element, owned);
      }
      const added = [];
      for (const className of classes || []) {
        if (!className || element.classList.contains(className)) continue;
        element.classList.add(className);
        owned.add(className);
        added.push(className);
      }
      if (added.length) this.records.push({ group, selector, element, added, status: "applied" });
      return added.length;
    }

    _recordInvalid(group, selector, message) {
      if (this.invalidSelectors.some((item) => item.group === group && item.selector === selector)) return;
      this.invalidSelectors.push({ group, selector, message });
    }
  }

  global.AXMVisualAdapter = AXMVisualAdapter;
})(typeof window !== "undefined" ? window : globalThis);
