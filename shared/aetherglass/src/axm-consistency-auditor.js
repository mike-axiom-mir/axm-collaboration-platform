/*
 * AXM Visual Consistency Auditor v7.1.0
 * Read-only by default. Detects untreated interface regions, readability risks,
 * touch-size problems, excessive luminous density, nesting, duplicate IDs,
 * extreme z-index values, and page-level overflow. Safe repairs are explicit,
 * narrow, and ownership-scoped.
 */
(function attachAXMConsistencyAuditor(global) {
  "use strict";

  const VERSION = "7.1.0";
  const DEFAULTS = Object.freeze({
    maxGlowSources: 12,
    maxGlassDepth: 3,
    minimumTouchSize: 40,
    maximumZIndex: 2000,
    overflowTolerance: 1,
    includeReadability: true
  });

  const WEIGHTS = Object.freeze({ critical: 16, high: 9, medium: 4, low: 1 });

  function issue(code, severity, element, detail, repair = null) {
    return { code, severity, element, detail, repair };
  }

  function isVisible(element) {
    const style = global.getComputedStyle?.(element);
    if (!style || style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0) return false;
    const rect = element.getBoundingClientRect?.();
    return !rect || rect.width > 0 || rect.height > 0;
  }

  function hasAnyClass(element, names) {
    return names.some((name) => element.classList?.contains(name));
  }

  class AXMConsistencyAuditor {
    constructor(options = {}) {
      this.root = options.root || global.document || null;
      this.guardian = options.guardian || null;
      this.adapter = options.adapter || null;
      this.options = { ...DEFAULTS, ...options };
      this.lastAudit = null;
      this.records = new Map();
      this.destroyed = false;
    }

    static get version() { return VERSION; }

    audit(options = {}) {
      if (this.destroyed) return this._empty("destroyed");
      if (!this.root?.querySelectorAll) throw new Error("AXMConsistencyAuditor requires a DOM root.");
      const settings = { ...this.options, ...options };
      const issues = [];
      const documentRoot = this.root.nodeType === 9 ? this.root.documentElement : this.root;

      const interactive = Array.from(this.root.querySelectorAll("button,input:not([type='hidden']),select,textarea,[role='button'],[role='tab']"));
      for (const element of interactive) {
        if (!isVisible(element) || element.closest?.("[data-axm-ignore]")) continue;
        if (!hasAnyClass(element, ["axm-button", "axm-input", "axm-select", "axm-textarea", "axm-tab", "axm-switch"])) {
          issues.push(issue("untreated-interactive", "medium", element, "Interactive control has no Aetherglass component class.", "decorate-control"));
        }
        const rect = element.getBoundingClientRect?.();
        if (rect && (rect.width < settings.minimumTouchSize || rect.height < settings.minimumTouchSize)) {
          issues.push(issue("small-touch-target", "medium", element, `${Math.round(rect.width)}×${Math.round(rect.height)}px is below the ${settings.minimumTouchSize}px target.`, "touch-safe"));
        }
      }

      const likelySurfaces = Array.from(this.root.querySelectorAll("[class*='panel'],[class*='card'],[class*='workspace'],[class*='surface'],article,aside,[role='dialog']"));
      for (const element of likelySurfaces) {
        if (!isVisible(element) || element.closest?.("[data-axm-ignore]") || element.hasAttribute("data-axm-owned")) continue;
        if (!hasAnyClass(element, ["axm-glass", "axm-modal", "axm-surface-composed"])) {
          issues.push(issue("untreated-surface", "low", element, "Likely platform surface is outside the shared visual language.", "decorate-surface"));
        }
      }

      const luminous = Array.from(this.root.querySelectorAll(".axm-glass--luminous,.axm-glass--prismatic,[data-axm-awake='true'],.axm-energy-orb,.axm-portal-ring"));
      if (luminous.length > settings.maxGlowSources) {
        issues.push(issue("glow-budget-exceeded", "medium", documentRoot, `${luminous.length} luminous sources exceed the recommended budget of ${settings.maxGlowSources}.`, "glow-budget"));
      }

      const glass = Array.from(this.root.querySelectorAll(".axm-glass,.axm-surface-composed"));
      for (const element of glass) {
        let depth = 0;
        let current = element.parentElement;
        while (current) {
          if (hasAnyClass(current, ["axm-glass", "axm-surface-composed"])) depth += 1;
          current = current.parentElement;
        }
        if (depth > settings.maxGlassDepth) issues.push(issue("glass-nesting-depth", "low", element, `Glass nesting depth ${depth} exceeds ${settings.maxGlassDepth}.`, "flatten-depth"));
      }

      const ids = new Map();
      for (const element of this.root.querySelectorAll("[id]")) {
        const id = element.id;
        if (!id) continue;
        if (!ids.has(id)) ids.set(id, []);
        ids.get(id).push(element);
      }
      for (const [id, elements] of ids) {
        if (elements.length < 2) continue;
        for (const element of elements) issues.push(issue("duplicate-id", "high", element, `ID “${id}” appears ${elements.length} times.`, null));
      }

      for (const element of this.root.querySelectorAll("*")) {
        if (!isVisible(element)) continue;
        const style = global.getComputedStyle?.(element);
        const z = Number(style?.zIndex);
        if (Number.isFinite(z) && z > settings.maximumZIndex && !element.hasAttribute("data-axm-owned")) {
          issues.push(issue("extreme-z-index", "low", element, `z-index ${z} exceeds the platform budget ${settings.maximumZIndex}.`, null));
        }
      }

      if (documentRoot && documentRoot.scrollWidth > documentRoot.clientWidth + settings.overflowTolerance) {
        issues.push(issue("page-horizontal-overflow", "high", documentRoot, `${documentRoot.scrollWidth - documentRoot.clientWidth}px page-level horizontal overflow detected.`, "overflow-contain"));
      }

      let readabilityReport = null;
      if (settings.includeReadability && this.guardian?.audit) {
        readabilityReport = this.guardian.audit();
        for (const item of this.guardian.lastAudit?.issues || []) {
          issues.push(issue("readability-contrast", item.severity === "critical" ? "critical" : item.severity, item.element, `Contrast ${item.ratio}:1 is below ${item.target}:1.`, "readability"));
        }
      }

      const penalty = issues.reduce((sum, item) => sum + (WEIGHTS[item.severity] || 1), 0);
      const score = Math.max(0, 100 - penalty);
      const grade = score >= 92 ? "A" : score >= 82 ? "B" : score >= 68 ? "C" : score >= 50 ? "D" : "E";
      const byCode = {};
      const bySeverity = {};
      for (const item of issues) {
        byCode[item.code] = (byCode[item.code] || 0) + 1;
        bySeverity[item.severity] = (bySeverity[item.severity] || 0) + 1;
      }

      this.lastAudit = { version: VERSION, score, grade, issues, byCode, bySeverity, readabilityReport, localOnly: true, telemetry: false, mutations: 0 };
      return this.report(this.lastAudit);
    }

    report(audit = this.lastAudit) {
      if (!audit) return this._empty("not-audited");
      return {
        version: VERSION,
        score: audit.score,
        grade: audit.grade,
        issueCount: audit.issues.length,
        byCode: { ...audit.byCode },
        bySeverity: { ...audit.bySeverity },
        localOnly: true,
        telemetry: false,
        mutations: 0,
        issues: audit.issues.map((item, index) => ({
          index,
          code: item.code,
          severity: item.severity,
          detail: item.detail,
          repair: item.repair,
          tag: item.element?.tagName?.toLowerCase?.() || null,
          id: item.element?.id || null
        }))
      };
    }

    createRepairPlan(audit = this.lastAudit) {
      if (!audit) return { version: VERSION, repairs: [], reason: "not-audited" };
      const repairs = [];
      for (const item of audit.issues) {
        if (!item.repair) continue;
        repairs.push({ code: item.code, action: item.repair, element: item.element, detail: item.detail, safe: ["touch-safe", "overflow-contain", "readability"].includes(item.repair) });
      }
      return {
        version: VERSION,
        repairs,
        safeCount: repairs.filter((item) => item.safe).length,
        reviewCount: repairs.filter((item) => !item.safe).length,
        automatic: false
      };
    }

    applySafeRepairs(options = {}) {
      if (this.destroyed) return { applied: 0, rejected: "destroyed" };
      if (!this.lastAudit || options.rescan) this.audit(options);
      const allowDecoration = Boolean(options.decorate);
      const allowReadability = options.readability !== false;
      let applied = 0;
      const skipped = [];
      for (const item of this.lastAudit.issues) {
        if (!item.element?.classList) continue;
        if (item.repair === "touch-safe") {
          applied += this._ownClass(item.element, "axm-touch-safe") ? 1 : 0;
        } else if (item.repair === "overflow-contain") {
          applied += this._ownClass(item.element, "axm-overflow-contained") ? 1 : 0;
        } else if (item.repair === "readability" && allowReadability && this.guardian?.apply) {
          // Guardian applies all of its audited contrast issues once, below.
        } else if (["decorate-control", "decorate-surface"].includes(item.repair) && allowDecoration && this.adapter?.decorate) {
          const type = item.repair === "decorate-surface" ? "panel" : this._controlType(item.element);
          const result = this.adapter.decorate(item.element, type, { source: "consistency-auditor" });
          if (result.addedClasses || result.attributeApplied) applied += 1;
        } else {
          skipped.push({ code: item.code, reason: "review-required" });
        }
      }
      if (allowReadability && this.guardian?.lastAudit?.issueCount) applied += this.guardian.apply(this.guardian.lastAudit).applied;
      return { version: VERSION, applied, skipped, automatic: false, ownershipScoped: true };
    }

    rollback() {
      let removedClasses = 0;
      for (const [element, classes] of this.records) {
        for (const className of classes) {
          if (!element.classList.contains(className)) continue;
          element.classList.remove(className);
          removedClasses += 1;
        }
      }
      this.records.clear();
      return { version: VERSION, rolledBack: true, removedClasses, ownershipScoped: true };
    }

    getState() {
      return {
        version: VERSION,
        lastScore: this.lastAudit?.score ?? null,
        lastGrade: this.lastAudit?.grade ?? null,
        lastIssueCount: this.lastAudit?.issues?.length ?? null,
        ownedRepairs: this.records.size,
        destroyed: this.destroyed,
        localOnly: true,
        telemetry: false
      };
    }

    destroy() {
      if (this.destroyed) return this;
      this.rollback();
      this.lastAudit = null;
      this.destroyed = true;
      return this;
    }

    _ownClass(element, className) {
      if (element.classList.contains(className)) return false;
      element.classList.add(className);
      let classes = this.records.get(element);
      if (!classes) { classes = new Set(); this.records.set(element, classes); }
      classes.add(className);
      return true;
    }

    _controlType(element) {
      const tag = element.tagName?.toLowerCase?.();
      if (tag === "select") return "select";
      if (tag === "textarea") return "textarea";
      if (tag === "input" && !["button", "submit", "reset"].includes((element.type || "").toLowerCase())) return "input";
      if ((element.getAttribute("role") || "").toLowerCase() === "tab") return "tab";
      return "button";
    }

    _empty(reason) {
      return { version: VERSION, score: null, grade: null, issueCount: 0, issues: [], reason, mutations: 0, localOnly: true, telemetry: false };
    }
  }

  global.AXMConsistencyAuditor = AXMConsistencyAuditor;
})(typeof window !== "undefined" ? window : globalThis);
