/*
 * AXM Surface Composer v7.1.0
 * Applies explicit, reversible local material recipes to selected elements.
 * It never scans or skins the platform unless selectors are supplied by the caller.
 */
(function attachAXMSurfaceComposer(global) {
  "use strict";

  const VERSION = "7.1.0";
  const CLASS_NAME = "axm-surface-composed";
  const ATTRIBUTE = "data-axm-surface-recipe";
  const MAX_RECIPES = 64;
  const SAFE_VARIABLES = new Set([
    "--axm-local-surface-alpha",
    "--axm-local-surface-alpha-strong",
    "--axm-local-border-alpha",
    "--axm-local-highlight-alpha",
    "--axm-local-blur",
    "--axm-local-saturation",
    "--axm-local-glow",
    "--axm-local-accent",
    "--axm-local-secondary",
    "--axm-local-radius",
    "--axm-local-sheen-angle"
  ]);

  const BUILT_INS = Object.freeze({
    "black-diamond": { label: "Black Diamond", variables: {} },
    moonstone: { label: "Moonstone", variables: {} },
    "liquid-neon": { label: "Liquid Neon", variables: {} },
    "auric-glass": { label: "Auric Glass", variables: {} },
    "phantom-silk": { label: "Phantom Silk", variables: {} },
    "prism-vault": { label: "Prism Vault", variables: {} },
    "clean-room": { label: "Clean Room", variables: {} }
  });

  function resolveElements(target, root) {
    if (!target) return [];
    if (typeof target === "string") return Array.from(root.querySelectorAll(target));
    if (target.nodeType === 1) return [target];
    if (typeof target[Symbol.iterator] === "function") {
      return Array.from(target).filter((item) => item?.nodeType === 1);
    }
    return [];
  }

  function safeCssValue(value) {
    const text = String(value ?? "").trim();
    if (!text || text.length > 160 || /url\s*\(|expression\s*\(|[;{}]/i.test(text)) return null;
    return text;
  }

  function normalizeRecipe(name, definition = {}) {
    const key = String(name || "").trim().toLowerCase();
    if (!/^[a-z0-9][a-z0-9-_]{1,63}$/.test(key)) {
      throw new Error("Surface recipe names must be 2–64 lowercase letters, numbers, dashes, or underscores.");
    }
    if (!definition || typeof definition !== "object" || Array.isArray(definition)) {
      throw new Error("Surface recipe definition must be an object.");
    }
    const variables = {};
    for (const [property, value] of Object.entries(definition.variables || {})) {
      if (!SAFE_VARIABLES.has(property)) throw new Error(`Unsupported surface variable: ${property}`);
      const safe = safeCssValue(value);
      if (safe === null) throw new Error(`Unsafe surface value for ${property}`);
      variables[property] = safe;
    }
    return {
      label: String(definition.label || key).slice(0, 80),
      description: String(definition.description || "Local Aetherglass surface recipe.").slice(0, 240),
      variables
    };
  }

  class AXMSurfaceComposer {
    constructor(options = {}) {
      this.root = options.root || global.document || null;
      if (!this.root?.querySelectorAll) throw new Error("AXMSurfaceComposer requires a document or element root.");
      this.recipes = new Map(Object.entries(BUILT_INS).map(([name, recipe]) => [name, { ...recipe, variables: { ...recipe.variables }, builtIn: true }]));
      this.records = new Map();
      this.wakeRecords = new Map();
      this.destroyed = false;
    }

    static get version() { return VERSION; }
    static get recipes() { return Object.keys(BUILT_INS); }

    register(name, definition, options = {}) {
      if (this.destroyed) return false;
      const recipe = normalizeRecipe(name, definition);
      const key = String(name).trim().toLowerCase();
      if (this.recipes.has(key) && options.replace !== true) throw new Error(`Surface recipe already exists: ${key}`);
      if (!this.recipes.has(key) && this.recipes.size >= MAX_RECIPES) throw new Error(`Surface recipe limit reached (${MAX_RECIPES}).`);
      this.recipes.set(key, { ...recipe, builtIn: false });
      this._emit("registered", { name: key });
      return key;
    }

    unregister(name) {
      const recipe = this.recipes.get(name);
      if (!recipe || recipe.builtIn) return false;
      const removed = this.recipes.delete(name);
      if (removed) this._emit("unregistered", { name });
      return removed;
    }

    list() {
      return Array.from(this.recipes.entries()).map(([name, recipe]) => ({
        name,
        label: recipe.label,
        description: recipe.description || "Local Aetherglass surface recipe.",
        builtIn: Boolean(recipe.builtIn),
        variables: { ...recipe.variables }
      }));
    }

    preview(target, recipeName) {
      const elements = resolveElements(target, this.root);
      return {
        recipe: this.recipes.has(recipeName) ? recipeName : null,
        matched: elements.length,
        alreadyComposed: elements.filter((element) => this.records.has(element)).length,
        valid: this.recipes.has(recipeName) && elements.length > 0
      };
    }

    apply(target, recipeName, overrides = {}) {
      if (this.destroyed) return { applied: 0, rejected: "destroyed" };
      const recipe = this.recipes.get(recipeName);
      if (!recipe) return { applied: 0, rejected: "unknown-recipe" };
      const elements = resolveElements(target, this.root);
      const variables = { ...recipe.variables };
      for (const [property, value] of Object.entries(overrides || {})) {
        if (!SAFE_VARIABLES.has(property)) throw new Error(`Unsupported surface variable: ${property}`);
        const safe = safeCssValue(value);
        if (safe === null) throw new Error(`Unsafe surface value for ${property}`);
        variables[property] = safe;
      }

      let applied = 0;
      for (const element of elements) {
        let record = this.records.get(element);
        if (!record) {
          record = {
            classOwned: !element.classList.contains(CLASS_NAME),
            originalAttribute: element.getAttribute(ATTRIBUTE),
            lastAttribute: null,
            styles: new Map()
          };
          this.records.set(element, record);
        }
        if (record.classOwned) element.classList.add(CLASS_NAME);
        element.setAttribute(ATTRIBUTE, recipeName);
        record.lastAttribute = recipeName;

        for (const [property, styleRecord] of Array.from(record.styles.entries())) {
          if (Object.prototype.hasOwnProperty.call(variables, property)) continue;
          const current = element.style.getPropertyValue(property);
          if (current === styleRecord.lastApplied) {
            if (styleRecord.original) element.style.setProperty(property, styleRecord.original, styleRecord.priority || "");
            else element.style.removeProperty(property);
          }
          record.styles.delete(property);
        }

        for (const [property, value] of Object.entries(variables)) {
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
        applied += 1;
      }
      this._emit("applied", { recipe: recipeName, applied });
      return { applied, recipe: recipeName, matched: elements.length };
    }

    wake(target, enabled = true) {
      const elements = resolveElements(target, this.root);
      for (const element of elements) {
        let record = this.wakeRecords.get(element);
        if (!record) {
          record = { original: element.getAttribute("data-axm-awake"), lastApplied: null };
          this.wakeRecords.set(element, record);
        }
        if (enabled) {
          element.setAttribute("data-axm-awake", "true");
          record.lastApplied = "true";
        } else {
          if (element.getAttribute("data-axm-awake") === record.lastApplied) {
            if (record.original === null) element.removeAttribute("data-axm-awake");
            else element.setAttribute("data-axm-awake", record.original);
          }
          this.wakeRecords.delete(element);
        }
      }
      return elements.length;
    }

    restore(target) {
      const elements = resolveElements(target, this.root);
      let restored = 0;
      for (const element of elements) {
        if (this._restoreElement(element)) restored += 1;
      }
      if (restored) this._emit("restored", { restored });
      return { restored };
    }

    restoreAll() {
      let restored = 0;
      for (const element of Array.from(this.records.keys())) {
        if (this._restoreElement(element)) restored += 1;
      }
      if (restored) this._emit("restored", { restored, all: true });
      return { restored };
    }

    getState() {
      return {
        version: VERSION,
        activeSurfaces: this.records.size,
        awakeSurfaces: this.wakeRecords.size,
        recipes: this.recipes.size,
        builtIns: Object.keys(BUILT_INS).length,
        destroyed: this.destroyed,
        localOnly: true,
        telemetry: false
      };
    }

    destroy() {
      if (this.destroyed) return this;
      this.restoreAll();
      for (const [element, record] of this.wakeRecords) {
        if (element.getAttribute("data-axm-awake") !== record.lastApplied) continue;
        if (record.original === null) element.removeAttribute("data-axm-awake");
        else element.setAttribute("data-axm-awake", record.original);
      }
      this.wakeRecords.clear();
      this.destroyed = true;
      this._emit("destroyed", { version: VERSION });
      return this;
    }

    _restoreElement(element) {
      const record = this.records.get(element);
      if (!record) return false;

      for (const [property, styleRecord] of record.styles) {
        if (element.style.getPropertyValue(property) !== styleRecord.lastApplied) continue;
        if (styleRecord.original) element.style.setProperty(property, styleRecord.original, styleRecord.priority || "");
        else element.style.removeProperty(property);
      }

      if (element.getAttribute(ATTRIBUTE) === record.lastAttribute) {
        if (record.originalAttribute === null) element.removeAttribute(ATTRIBUTE);
        else element.setAttribute(ATTRIBUTE, record.originalAttribute);
      }
      if (record.classOwned) element.classList.remove(CLASS_NAME);
      this.records.delete(element);
      return true;
    }

    _emit(name, detail) {
      const target = this.root.nodeType === 9 ? this.root.documentElement : this.root;
      if (!target || typeof global.CustomEvent !== "function") return;
      target.dispatchEvent(new global.CustomEvent(`axmsurface:${name}`, { detail }));
    }
  }

  global.AXMSurfaceComposer = AXMSurfaceComposer;
})(typeof window !== "undefined" ? window : globalThis);
