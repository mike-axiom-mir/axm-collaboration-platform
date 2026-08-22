/*
 * AXM Design Token Forge v7.1.0
 * Code-free visual token authoring with explicit approval and ownership-safe rollback.
 * It changes no DOM until apply() receives { approved: true }.
 */
(function attachAXMDesignTokenForge(global) {
  "use strict";

  const VERSION = "7.1.0";
  const NAME_PATTERN = /^[a-z0-9][a-z0-9-_]{1,63}$/i;
  const MAX_PACKS = 64;
  const TOKEN_MAP = Object.freeze({
    accentPrimary: "--axm-accent-1",
    accentSecondary: "--axm-accent-2",
    accentTertiary: "--axm-accent-3",
    luxury: "--axm-lux",
    positive: "--axm-positive",
    warning: "--axm-warning",
    danger: "--axm-danger",
    text: "--axm-text",
    textMuted: "--axm-muted",
    surfaceAlpha: "--axm-surface-alpha",
    surfaceAlphaStrong: "--axm-surface-alpha-strong",
    borderAlpha: "--axm-border-alpha",
    blur: "--axm-blur",
    radiusSmall: "--axm-radius-sm",
    radiusMedium: "--axm-radius-md",
    radiusLarge: "--axm-radius-lg",
    shadowDepth: "--axm-depth-strength",
    focusWidth: "--axm-focus-width",
    spacingScale: "--axm-gap-scale"
  });
  const COLOR_KEYS = new Set(["accentPrimary", "accentSecondary", "accentTertiary", "luxury", "positive", "warning", "danger", "text", "textMuted"]);

  const BUILT_INS = Object.freeze({
    "sovereign-aurora": {
      label: "Sovereign Aurora",
      description: "Cyan-violet aurora with restrained warm luxury highlights.",
      tokens: { accentPrimary: "#79f7ff", accentSecondary: "#a88cff", accentTertiary: "#ff7de8", luxury: "#ffd98a", positive: "#7dffc7", warning: "#ffc66f", danger: "#ff7d9f", text: "#f6f8ff", textMuted: "rgba(225,232,255,.72)", surfaceAlpha: ".54", surfaceAlphaStrong: ".76", borderAlpha: ".16", blur: "24px", radiusSmall: "12px", radiusMedium: "20px", radiusLarge: "32px", shadowDepth: "1", focusWidth: "3px", spacingScale: "1" }
    },
    "quiet-crystal": {
      label: "Quiet Crystal",
      description: "Cool, calm and highly readable for long platform sessions.",
      tokens: { accentPrimary: "#a9eaff", accentSecondary: "#c4b7ff", accentTertiary: "#9bd8ff", luxury: "#e8ddba", positive: "#9bf2cf", warning: "#ffd58b", danger: "#ff9bad", text: "#f7f9ff", textMuted: "rgba(231,237,255,.78)", surfaceAlpha: ".66", surfaceAlphaStrong: ".84", borderAlpha: ".20", blur: "18px", radiusSmall: "10px", radiusMedium: "17px", radiusLarge: "26px", shadowDepth: ".72", focusWidth: "3px", spacingScale: "1" }
    },
    "ember-forge": {
      label: "Ember Forge",
      description: "Creative warmth with violet counterlight and controlled ember energy.",
      tokens: { accentPrimary: "#ffad73", accentSecondary: "#ff6ccf", accentTertiary: "#9b8cff", luxury: "#ffe09b", positive: "#99f5c9", warning: "#ffc26b", danger: "#ff718f", text: "#fff8f4", textMuted: "rgba(255,229,216,.74)", surfaceAlpha: ".58", surfaceAlphaStrong: ".78", borderAlpha: ".17", blur: "22px", radiusSmall: "12px", radiusMedium: "21px", radiusLarge: "34px", shadowDepth: "1.12", focusWidth: "3px", spacingScale: "1.02" }
    },
    "phantom-cyan": {
      label: "Phantom Cyan",
      description: "Dark spectral glass with clean cyan signal hierarchy.",
      tokens: { accentPrimary: "#5ff6ff", accentSecondary: "#5ea2ff", accentTertiary: "#9f76ff", luxury: "#d8f5ff", positive: "#75ffc3", warning: "#f7cb73", danger: "#ff779f", text: "#f1fbff", textMuted: "rgba(205,238,248,.72)", surfaceAlpha: ".48", surfaceAlphaStrong: ".72", borderAlpha: ".14", blur: "28px", radiusSmall: "11px", radiusMedium: "19px", radiusLarge: "30px", shadowDepth: "1.08", focusWidth: "3px", spacingScale: ".98" }
    },
    "rose-gold-sanctum": {
      label: "Rose Gold Sanctum",
      description: "Soft rose, pearl and gold for a luxurious human-facing surface.",
      tokens: { accentPrimary: "#ff9fc9", accentSecondary: "#c8a7ff", accentTertiary: "#ffd0b0", luxury: "#ffe1a3", positive: "#9bf1cb", warning: "#ffd08a", danger: "#ff879f", text: "#fff8fb", textMuted: "rgba(255,228,239,.78)", surfaceAlpha: ".62", surfaceAlphaStrong: ".82", borderAlpha: ".20", blur: "23px", radiusSmall: "13px", radiusMedium: "22px", radiusLarge: "36px", shadowDepth: ".94", focusWidth: "3px", spacingScale: "1.04" }
    },
    "accessible-night": {
      label: "Accessible Night",
      description: "Opaque high-contrast night tokens with strong focus visibility.",
      tokens: { accentPrimary: "#8ff6ff", accentSecondary: "#d2c5ff", accentTertiary: "#ffd2f2", luxury: "#ffe29c", positive: "#a1ffd5", warning: "#ffdc92", danger: "#ff9bb2", text: "#ffffff", textMuted: "rgba(255,255,255,.84)", surfaceAlpha: ".96", surfaceAlphaStrong: ".99", borderAlpha: ".30", blur: "0px", radiusSmall: "10px", radiusMedium: "16px", radiusLarge: "24px", shadowDepth: ".5", focusWidth: "4px", spacingScale: "1.08" }
    }
  });

  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function safeString(value, max = 240) { return String(value ?? "").trim().slice(0, max); }
  function safeCssValue(value) {
    const text = String(value ?? "").trim();
    if (!text || text.length > 160 || /url\s*\(|expression\s*\(|javascript\s*:|[;{}]/i.test(text)) return null;
    return text;
  }
  function hexToRgb(value) {
    const text = String(value || "").trim().replace(/^#/, "");
    const expanded = text.length === 3 ? text.split("").map((x) => x + x).join("") : text;
    if (!/^[0-9a-f]{6}$/i.test(expanded)) return null;
    return { r: parseInt(expanded.slice(0, 2), 16), g: parseInt(expanded.slice(2, 4), 16), b: parseInt(expanded.slice(4, 6), 16) };
  }
  function toHex({ r, g, b }) {
    const part = (n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
    return `#${part(r)}${part(g)}${part(b)}`;
  }
  function mix(a, b, amount) {
    return toHex({ r: a.r + (b.r - a.r) * amount, g: a.g + (b.g - a.g) * amount, b: a.b + (b.b - a.b) * amount });
  }
  function luminance(rgb) {
    const c = [rgb.r, rgb.g, rgb.b].map((n) => {
      const v = n / 255;
      return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4);
    });
    return .2126 * c[0] + .7152 * c[1] + .0722 * c[2];
  }
  function resolveTargets(target, root) {
    if (!target) return [];
    if (typeof target === "string") return Array.from(root.querySelectorAll(target));
    if (target.nodeType === 1) return [target];
    if (target.nodeType === 9) return [target.documentElement];
    if (typeof target[Symbol.iterator] === "function") return Array.from(target).filter((item) => item?.nodeType === 1);
    return [];
  }
  function normalizeDefinition(name, definition = {}) {
    const key = safeString(name, 64).toLowerCase();
    if (!NAME_PATTERN.test(key)) throw new Error("Token pack names must be 2–64 letters, numbers, dashes, or underscores.");
    if (!definition || typeof definition !== "object" || Array.isArray(definition)) throw new Error("Token pack definition must be an object.");
    const unknown = Object.keys(definition).filter((item) => !["label", "description", "tokens", "tags"].includes(item));
    if (unknown.length) throw new Error(`Unsupported token pack key: ${unknown[0]}`);
    if (!definition.tokens || typeof definition.tokens !== "object" || Array.isArray(definition.tokens)) throw new Error("Token pack requires a tokens object.");
    const tokens = {};
    for (const [token, value] of Object.entries(definition.tokens)) {
      if (!Object.prototype.hasOwnProperty.call(TOKEN_MAP, token)) throw new Error(`Unsupported visual token: ${token}`);
      const safe = safeCssValue(value);
      if (safe === null) throw new Error(`Unsafe CSS token value for ${token}`);
      if (COLOR_KEYS.has(token) && !/^(#|rgb|hsl|oklch|color\(|var\(|transparent|currentColor)/i.test(safe)) throw new Error(`Color token ${token} must use a recognized local CSS color value.`);
      tokens[token] = safe;
    }
    if (!tokens.accentPrimary || !tokens.accentSecondary || !tokens.text) throw new Error("Token packs require accentPrimary, accentSecondary, and text.");
    return {
      label: safeString(definition.label || key, 100),
      description: safeString(definition.description || "Local Aetherglass design token pack.", 400),
      tags: Array.isArray(definition.tags) ? definition.tags.slice(0, 12).map((item) => safeString(item, 40)) : [],
      tokens
    };
  }

  class AXMDesignTokenForge {
    constructor(options = {}) {
      this.root = options.root || global.document || null;
      if (!this.root?.querySelectorAll) throw new Error("AXMDesignTokenForge requires a document or element root.");
      this.defaultTarget = options.target || (this.root.nodeType === 9 ? this.root.documentElement : this.root);
      this.packs = new Map(Object.entries(BUILT_INS).map(([name, value]) => [name, { ...clone(value), builtIn: true }]));
      this.records = new Map();
      this.active = new Map();
      this.destroyed = false;
    }

    static get version() { return VERSION; }
    static get builtIns() { return Object.keys(BUILT_INS); }
    static get tokenNames() { return Object.keys(TOKEN_MAP); }

    register(name, definition, options = {}) {
      if (this.destroyed) return false;
      const key = safeString(name, 64).toLowerCase();
      const normalized = normalizeDefinition(key, definition);
      if (this.packs.get(key)?.builtIn) return false;
      if (this.packs.has(key) && options.replace !== true) return false;
      if (!this.packs.has(key) && this.packs.size >= MAX_PACKS) throw new Error(`Token pack limit reached (${MAX_PACKS}).`);
      this.packs.set(key, { ...normalized, builtIn: false });
      this._emit("registered", { name: key });
      return true;
    }

    unregister(name) {
      const pack = this.packs.get(name);
      if (!pack || pack.builtIn) return false;
      const removed = this.packs.delete(name);
      if (removed) this._emit("unregistered", { name });
      return removed;
    }

    derive(name, anchors = {}, options = {}) {
      const primary = hexToRgb(anchors.primary);
      const secondary = hexToRgb(anchors.secondary);
      const luxury = hexToRgb(anchors.luxury || "#ffd98a");
      if (!primary || !secondary || !luxury) throw new Error("Derived token anchors must be three- or six-digit hex colors.");
      const white = { r: 255, g: 255, b: 255 };
      const text = luminance(primary) > .48 && luminance(secondary) > .48 ? "#081019" : "#f7f9ff";
      const definition = {
        label: options.label || safeString(name, 64).split("-").map((x) => x.charAt(0).toUpperCase() + x.slice(1)).join(" "),
        description: options.description || "Locally derived from three user-selected color anchors.",
        tags: ["derived", "local", "code-free"],
        tokens: {
          accentPrimary: toHex(primary),
          accentSecondary: toHex(secondary),
          accentTertiary: mix(primary, secondary, .5),
          luxury: toHex(luxury),
          positive: mix(primary, { r: 92, g: 255, b: 173 }, .58),
          warning: mix(luxury, { r: 255, g: 176, b: 80 }, .45),
          danger: mix(secondary, { r: 255, g: 78, b: 117 }, .55),
          text,
          textMuted: text === "#081019" ? "rgba(8,16,25,.72)" : "rgba(239,244,255,.76)",
          surfaceAlpha: ".58",
          surfaceAlphaStrong: ".80",
          borderAlpha: ".18",
          blur: "24px",
          radiusSmall: "12px",
          radiusMedium: "20px",
          radiusLarge: "32px",
          shadowDepth: "1",
          focusWidth: "3px",
          spacingScale: "1"
        }
      };
      this.register(name, definition, { replace: options.replace === true });
      return this.get(name);
    }

    get(name) {
      const pack = this.packs.get(name);
      return pack ? clone(pack) : null;
    }

    list() {
      return Array.from(this.packs.entries()).map(([name, pack]) => ({ name, label: pack.label, description: pack.description, tags: [...(pack.tags || [])], tokenCount: Object.keys(pack.tokens).length, builtIn: Boolean(pack.builtIn) }));
    }

    preview(name, target = this.defaultTarget) {
      const pack = this.packs.get(name);
      const targets = resolveTargets(target, this.root);
      return {
        version: VERSION,
        valid: Boolean(pack) && targets.length > 0,
        name: pack ? name : null,
        targetCount: targets.length,
        tokenCount: pack ? Object.keys(pack.tokens).length : 0,
        tokens: pack ? clone(pack.tokens) : {},
        mutations: 0,
        approvalRequired: true
      };
    }

    apply(name, target = this.defaultTarget, options = {}) {
      if (this.destroyed) return { applied: 0, rejected: "destroyed" };
      if (options.approved !== true) return { applied: 0, rejected: "approval-required", approvalRequired: true };
      const pack = this.packs.get(name);
      if (!pack) return { applied: 0, rejected: "unknown-pack" };
      const targets = resolveTargets(target, this.root);
      let applied = 0;
      for (const element of targets) {
        let record = this.records.get(element);
        if (!record) {
          record = { styles: new Map(), originalAttribute: element.getAttribute("data-axm-token-pack"), lastAttribute: null };
          this.records.set(element, record);
        }
        const variables = Object.fromEntries(Object.entries(pack.tokens).map(([token, value]) => [TOKEN_MAP[token], value]));
        for (const [property, styleRecord] of Array.from(record.styles.entries())) {
          if (Object.prototype.hasOwnProperty.call(variables, property)) continue;
          if (element.style.getPropertyValue(property) === styleRecord.lastApplied) {
            if (styleRecord.original) element.style.setProperty(property, styleRecord.original, styleRecord.priority || "");
            else element.style.removeProperty(property);
          }
          record.styles.delete(property);
        }
        for (const [property, value] of Object.entries(variables)) {
          let styleRecord = record.styles.get(property);
          if (!styleRecord) {
            styleRecord = { original: element.style.getPropertyValue(property), priority: element.style.getPropertyPriority(property), lastApplied: null };
            record.styles.set(property, styleRecord);
          }
          element.style.setProperty(property, value);
          styleRecord.lastApplied = value;
        }
        element.setAttribute("data-axm-token-pack", name);
        record.lastAttribute = name;
        this.active.set(element, name);
        applied += 1;
      }
      this._emit("applied", { name, applied });
      return { applied, name, targetCount: targets.length, approvalRequired: true };
    }

    capture(target = this.defaultTarget) {
      return resolveTargets(target, this.root).map((element) => ({
        element,
        attribute: element.getAttribute("data-axm-token-pack"),
        styles: Object.values(TOKEN_MAP).map((property) => ({ property, value: element.style.getPropertyValue(property), priority: element.style.getPropertyPriority(property) }))
      }));
    }

    restoreSnapshot(snapshot, options = {}) {
      if (!Array.isArray(snapshot)) return { restored: 0 };
      let restored = 0;
      for (const entry of snapshot) {
        const element = entry?.element;
        if (!element?.style) continue;
        const record = this.records.get(element);
        for (const saved of entry.styles || []) {
          const current = element.style.getPropertyValue(saved.property);
          const owned = record?.styles.get(saved.property);
          if (options.force !== true && owned && current !== owned.lastApplied) continue;
          if (saved.value) element.style.setProperty(saved.property, saved.value, saved.priority || "");
          else element.style.removeProperty(saved.property);
        }
        if (options.force === true || !record || element.getAttribute("data-axm-token-pack") === record.lastAttribute) {
          if (entry.attribute === null) element.removeAttribute("data-axm-token-pack");
          else element.setAttribute("data-axm-token-pack", entry.attribute);
        }
        this.records.delete(element);
        this.active.delete(element);
        restored += 1;
      }
      if (restored) this._emit("restored", { restored, snapshot: true });
      return { restored };
    }

    restore(target = this.defaultTarget) {
      const targets = resolveTargets(target, this.root);
      let restored = 0;
      for (const element of targets) {
        const record = this.records.get(element);
        if (!record) continue;
        for (const [property, styleRecord] of record.styles) {
          if (element.style.getPropertyValue(property) !== styleRecord.lastApplied) continue;
          if (styleRecord.original) element.style.setProperty(property, styleRecord.original, styleRecord.priority || "");
          else element.style.removeProperty(property);
        }
        if (element.getAttribute("data-axm-token-pack") === record.lastAttribute) {
          if (record.originalAttribute === null) element.removeAttribute("data-axm-token-pack");
          else element.setAttribute("data-axm-token-pack", record.originalAttribute);
        }
        this.records.delete(element);
        this.active.delete(element);
        restored += 1;
      }
      if (restored) this._emit("restored", { restored });
      return { restored };
    }

    restoreAll() {
      return this.restore(Array.from(this.records.keys()));
    }

    export(name, space = 2) {
      const pack = this.get(name);
      if (!pack) throw new Error(`Unknown token pack: ${name}`);
      delete pack.builtIn;
      return JSON.stringify({ module: "axm.visual.token-pack", version: VERSION, name, pack }, null, Math.max(0, Math.min(8, Number(space) || 2)));
    }

    import(input, options = {}) {
      let parsed = input;
      if (typeof input === "string") parsed = JSON.parse(input);
      if (!parsed || typeof parsed !== "object") throw new Error("Token pack import must be an object or JSON object string.");
      const name = safeString(parsed.name || options.name, 64).toLowerCase();
      const pack = parsed.pack || parsed;
      return this.register(name, pack, { replace: options.replace === true });
    }

    getState() {
      return {
        version: VERSION,
        packs: this.packs.size,
        builtIns: Object.keys(BUILT_INS).length,
        activeTargets: this.active.size,
        ownedTargets: this.records.size,
        tokenNames: Object.keys(TOKEN_MAP),
        approvalRequired: true,
        codeFreeDefinitions: true,
        localOnly: true,
        telemetry: false,
        destroyed: this.destroyed
      };
    }

    destroy(options = {}) {
      if (this.destroyed) return this;
      if (options.restore !== false) this.restoreAll();
      this.packs.clear();
      this.destroyed = true;
      this._emit("destroyed", { version: VERSION });
      return this;
    }

    _emit(name, detail) {
      const target = this.root.nodeType === 9 ? this.root.documentElement : this.root;
      if (!target || typeof global.CustomEvent !== "function") return;
      target.dispatchEvent(new global.CustomEvent(`axmtokens:${name}`, { detail }));
    }
  }

  global.AXMDesignTokenForge = AXMDesignTokenForge;
})(typeof window !== "undefined" ? window : globalThis);
