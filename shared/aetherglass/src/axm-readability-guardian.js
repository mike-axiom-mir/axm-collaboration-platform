/*
 * AXM Readability Guardian v7.1.0
 * Local, explainable contrast/readability inspection for dynamic glass worlds.
 * It reads computed visual styles, never content meaning. Applying protection is
 * explicit and every class/attribute/style mutation is ownership-scoped.
 */
(function attachAXMReadabilityGuardian(global) {
  "use strict";

  const VERSION = "7.1.0";
  const DEFAULTS = Object.freeze({
    selector: "h1,h2,h3,h4,h5,h6,p,li,label,button,input,select,textarea,td,th,code,pre,[role='button'],[role='tab'],[data-axm-readable]",
    minimumNormal: 4.5,
    minimumLarge: 3,
    shieldBelow: 2.5,
    maxElements: 5000,
    watch: false,
    autoApply: false,
    debounce: 120
  });

  function clamp(value, min, max, fallback = min) {
    const number = Number(value);
    return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
  }

  function parseColor(value) {
    if (!value || value === "transparent") return [0, 0, 0, 0];
    const match = String(value).match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)/i);
    if (!match) return null;
    const alpha = match[4] === undefined ? 1 : (match[4].includes("%") ? Number(match[4].replace("%", "")) / 100 : Number(match[4]));
    return [clamp(match[1], 0, 255), clamp(match[2], 0, 255), clamp(match[3], 0, 255), clamp(alpha, 0, 1, 1)];
  }

  function blend(top, bottom) {
    const alpha = top[3] + bottom[3] * (1 - top[3]);
    if (alpha <= 0) return [0, 0, 0, 0];
    return [
      (top[0] * top[3] + bottom[0] * bottom[3] * (1 - top[3])) / alpha,
      (top[1] * top[3] + bottom[1] * bottom[3] * (1 - top[3])) / alpha,
      (top[2] * top[3] + bottom[2] * bottom[3] * (1 - top[3])) / alpha,
      alpha
    ];
  }

  function channel(value) {
    const normalized = value / 255;
    return normalized <= .04045 ? normalized / 12.92 : Math.pow((normalized + .055) / 1.055, 2.4);
  }

  function luminance(color) {
    return .2126 * channel(color[0]) + .7152 * channel(color[1]) + .0722 * channel(color[2]);
  }

  function contrast(a, b) {
    const lighter = Math.max(luminance(a), luminance(b));
    const darker = Math.min(luminance(a), luminance(b));
    return (lighter + .05) / (darker + .05);
  }

  function visible(element, style) {
    if (!element?.isConnected) return false;
    if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0) return false;
    const rect = element.getBoundingClientRect?.();
    return !rect || rect.width > 0 || rect.height > 0;
  }

  function isLarge(style) {
    const size = parseFloat(style.fontSize) || 16;
    const weight = parseInt(style.fontWeight, 10) || 400;
    return size >= 24 || (size >= 18.66 && weight >= 700);
  }

  function elementHasReadableSurface(element) {
    if (["INPUT", "SELECT", "TEXTAREA", "BUTTON"].includes(element.tagName)) return true;
    return Boolean(element.textContent?.trim());
  }

  class AXMReadabilityGuardian {
    constructor(options = {}) {
      this.root = options.root || global.document || null;
      this.options = { ...DEFAULTS, ...options };
      this.records = new Map();
      this.lastAudit = null;
      this._observer = null;
      this._timer = 0;
      this.destroyed = false;
      if (this.options.watch) this.startWatching({ autoApply: this.options.autoApply });
    }

    static get version() { return VERSION; }
    static contrastRatio(foreground, background) { return contrast(foreground, background); }

    audit(options = {}) {
      if (this.destroyed) return this._emptyReport("destroyed");
      if (!this.root?.querySelectorAll) throw new Error("AXMReadabilityGuardian requires a DOM root.");
      const settings = { ...this.options, ...options };
      let elements;
      try { elements = Array.from(this.root.querySelectorAll(settings.selector)); }
      catch (error) { throw new Error(`Invalid readability selector: ${error.message}`); }
      elements = elements.slice(0, Math.max(0, Number(settings.maxElements) || DEFAULTS.maxElements));
      const issues = [];
      let inspected = 0;
      for (const element of elements) {
        const style = global.getComputedStyle?.(element);
        if (!style || !visible(element, style) || !elementHasReadableSurface(element)) continue;
        const foreground = parseColor(style.color);
        if (!foreground) continue;
        const background = this._effectiveBackground(element);
        const ratio = contrast(foreground, background);
        const large = isLarge(style);
        const target = large ? Number(settings.minimumLarge) : Number(settings.minimumNormal);
        inspected += 1;
        if (ratio + .001 >= target) continue;
        const severity = ratio < 2 ? "critical" : ratio < 3 ? "high" : "medium";
        issues.push({
          element,
          ratio: Number(ratio.toFixed(2)),
          target,
          largeText: large,
          severity,
          foreground: `rgb(${Math.round(foreground[0])} ${Math.round(foreground[1])} ${Math.round(foreground[2])})`,
          background: `rgb(${Math.round(background[0])} ${Math.round(background[1])} ${Math.round(background[2])})`,
          recommendedInk: this._recommendedInk(background),
          recommendedMode: ratio < Number(settings.shieldBelow) ? "shield" : "text"
        });
      }
      this.lastAudit = {
        version: VERSION,
        inspected,
        issues,
        issueCount: issues.length,
        truncated: elements.length >= settings.maxElements,
        thresholds: { normal: settings.minimumNormal, large: settings.minimumLarge },
        visualStyleOnly: true,
        contentMeaningRead: false,
        localOnly: true,
        telemetry: false
      };
      return this.report(this.lastAudit);
    }

    report(audit = this.lastAudit) {
      if (!audit) return this._emptyReport("not-audited");
      return {
        version: VERSION,
        inspected: audit.inspected,
        issueCount: audit.issueCount,
        truncated: audit.truncated,
        thresholds: { ...audit.thresholds },
        visualStyleOnly: true,
        contentMeaningRead: false,
        localOnly: true,
        telemetry: false,
        issues: audit.issues.map((issue, index) => ({
          index,
          ratio: issue.ratio,
          target: issue.target,
          largeText: issue.largeText,
          severity: issue.severity,
          foreground: issue.foreground,
          background: issue.background,
          recommendedInk: issue.recommendedInk,
          recommendedMode: issue.recommendedMode,
          tag: issue.element?.tagName?.toLowerCase?.() || null,
          id: issue.element?.id || null
        }))
      };
    }

    apply(audit = this.lastAudit, options = {}) {
      if (this.destroyed) return { applied: 0, rejected: "destroyed" };
      if (!audit?.issues) {
        this.audit(options);
        audit = this.lastAudit;
      }
      const requestedMode = ["text", "shield"].includes(options.mode) ? options.mode : null;
      let applied = 0;
      for (const issue of audit.issues) {
        const element = issue.element;
        if (!element?.classList) continue;
        const mode = requestedMode || issue.recommendedMode;
        let record = this.records.get(element);
        if (!record) {
          record = {
            classOwned: !element.classList.contains("axm-readability-guard"),
            modeClassOwned: new Set(),
            attribute: { original: element.getAttribute("data-axm-readability"), lastApplied: null },
            styles: new Map()
          };
          this.records.set(element, record);
        }
        if (record.classOwned) element.classList.add("axm-readability-guard");
        for (const name of ["axm-readability-guard--text", "axm-readability-guard--shield"]) {
          if (element.classList.contains(name) && record.modeClassOwned.has(name)) element.classList.remove(name);
        }
        const modeClass = `axm-readability-guard--${mode}`;
        if (!element.classList.contains(modeClass)) {
          element.classList.add(modeClass);
          record.modeClassOwned.add(modeClass);
        }
        this._setOwnedStyle(element, record, "--axm-readability-ink", issue.recommendedInk);
        this._setOwnedStyle(element, record, "--axm-readability-shield", issue.recommendedInk === "#080b12" ? "rgba(244,248,255,.88)" : "rgba(3,5,11,.82)");
        element.setAttribute("data-axm-readability", mode);
        record.attribute.lastApplied = mode;
        applied += 1;
      }
      return { version: VERSION, applied, mode: requestedMode || "per-issue", ownershipScoped: true, reversible: true };
    }

    ensure(options = {}) {
      this.audit(options);
      const result = this.apply(this.lastAudit, options);
      return { ...result, audit: this.report(this.lastAudit) };
    }

    restore(target = null) {
      const elements = target ? this._resolve(target) : Array.from(this.records.keys());
      let restored = 0;
      for (const element of elements) {
        const record = this.records.get(element);
        if (!record) continue;
        for (const [property, styleRecord] of record.styles) {
          if (element.style.getPropertyValue(property) !== styleRecord.lastApplied) continue;
          if (styleRecord.original) element.style.setProperty(property, styleRecord.original, styleRecord.priority || "");
          else element.style.removeProperty(property);
        }
        for (const name of record.modeClassOwned) element.classList.remove(name);
        if (record.classOwned) element.classList.remove("axm-readability-guard");
        if (element.getAttribute("data-axm-readability") === record.attribute.lastApplied) {
          if (record.attribute.original === null) element.removeAttribute("data-axm-readability");
          else element.setAttribute("data-axm-readability", record.attribute.original);
        }
        this.records.delete(element);
        restored += 1;
      }
      return { version: VERSION, restored, ownershipScoped: true };
    }

    startWatching(options = {}) {
      if (this.destroyed || this._observer || !global.MutationObserver || !this.root) return false;
      const autoApply = Boolean(options.autoApply);
      const delay = clamp(options.debounce, 20, 2000, this.options.debounce);
      const target = this.root.nodeType === 9 ? this.root.documentElement : this.root;
      this._observer = new global.MutationObserver(() => {
        global.clearTimeout(this._timer);
        this._timer = global.setTimeout(() => {
          const report = this.audit();
          if (autoApply && report.issueCount) this.apply(this.lastAudit);
        }, delay);
      });
      this._observer.observe(target, { childList: true, subtree: true, attributes: true, attributeFilter: ["class", "style", "data-axm-theme", "data-axm-material", "data-axm-transparency"] });
      return true;
    }

    stopWatching() {
      if (!this._observer) return false;
      this._observer.disconnect();
      this._observer = null;
      global.clearTimeout(this._timer);
      this._timer = 0;
      return true;
    }

    getState() {
      return {
        version: VERSION,
        protectedElements: this.records.size,
        watching: Boolean(this._observer),
        lastIssueCount: this.lastAudit?.issueCount ?? null,
        destroyed: this.destroyed,
        localOnly: true,
        telemetry: false,
        contentMeaningRead: false
      };
    }

    destroy() {
      if (this.destroyed) return this;
      this.stopWatching();
      this.restore();
      this.lastAudit = null;
      this.destroyed = true;
      return this;
    }

    _effectiveBackground(element) {
      const layers = [];
      let current = element;
      while (current && current.nodeType === 1) {
        const style = global.getComputedStyle?.(current);
        const color = parseColor(style?.backgroundColor);
        if (color && color[3] > 0) layers.push(color);
        current = current.parentElement;
      }
      let result = [6, 8, 14, 1];
      for (let index = layers.length - 1; index >= 0; index -= 1) result = blend(layers[index], result);
      return result;
    }

    _recommendedInk(background) {
      const white = [248, 250, 255, 1];
      const dark = [8, 11, 18, 1];
      return contrast(white, background) >= contrast(dark, background) ? "#f8faff" : "#080b12";
    }

    _setOwnedStyle(element, record, property, value) {
      let styleRecord = record.styles.get(property);
      if (!styleRecord) {
        styleRecord = {
          original: element.style.getPropertyValue(property),
          priority: element.style.getPropertyPriority(property),
          lastApplied: null
        };
        record.styles.set(property, styleRecord);
      }
      element.style.setProperty(property, value);
      styleRecord.lastApplied = value;
    }

    _resolve(target) {
      if (typeof target === "string") return Array.from(this.root.querySelectorAll(target));
      if (target?.nodeType === 1) return [target];
      if (Array.isArray(target) || target?.[Symbol.iterator]) return Array.from(target).filter((item) => item?.nodeType === 1);
      return [];
    }

    _emptyReport(reason) {
      return { version: VERSION, inspected: 0, issueCount: 0, issues: [], reason, visualStyleOnly: true, contentMeaningRead: false };
    }
  }

  global.AXMReadabilityGuardian = AXMReadabilityGuardian;
})(typeof window !== "undefined" ? window : globalThis);
