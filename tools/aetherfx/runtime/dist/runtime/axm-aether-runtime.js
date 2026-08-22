/* AXM AetherFX v1.3.0 portable headless runtime.
   Declarative compile, validation, package review/import, performance estimate,
   canonical visual intent, adapter support reports, and full snapshots.
   No account, telemetry, network dependency, or renderer side effect. */
/* src/core/namespace.js */
(function (root) {
  'use strict';

  const AXM = root.AXM = root.AXM || {};
  AXM.version = '1.3.0';
  AXM.status = 'WORKING';

  const toString = Object.prototype.toString;

  AXM.Utils = {
    uid(prefix = 'id') {
      if (root.crypto && typeof root.crypto.randomUUID === 'function') {
        return `${prefix}-${root.crypto.randomUUID()}`;
      }
      return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    },

    clone(value) {
      if (typeof structuredClone === 'function') return structuredClone(value);
      return JSON.parse(JSON.stringify(value));
    },

    clamp(value, min, max) {
      const number = Number(value);
      if (!Number.isFinite(number)) return min;
      return Math.min(max, Math.max(min, number));
    },

    escapeHtml(value) {
      return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
    },

    slugify(value) {
      return String(value || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'untitled';
    },

    canonicalJson(value) {
      const seen = new WeakSet();
      const normalize = (input) => {
        if (input === null || typeof input !== 'object') return input;
        if (seen.has(input)) throw new TypeError('Cannot canonicalize circular data.');
        seen.add(input);
        if (Array.isArray(input)) return input.map(normalize);
        return Object.keys(input).sort().reduce((out, key) => {
          out[key] = normalize(input[key]);
          return out;
        }, {});
      };
      return JSON.stringify(normalize(value));
    },

    downloadText(filename, text, mime = 'text/plain;charset=utf-8') {
      const blob = new Blob([text], { type: mime });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.rel = 'noopener';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    },

    downloadJson(filename, value) {
      this.downloadText(filename, `${JSON.stringify(value, null, 2)}\n`, 'application/json;charset=utf-8');
    },

    readJsonFile(file) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(reader.error || new Error('Unable to read file.'));
        reader.onload = () => {
          try {
            resolve(JSON.parse(String(reader.result || '')));
          } catch (error) {
            reject(new Error(`Invalid JSON: ${error.message}`));
          }
        };
        reader.readAsText(file);
      });
    },

    setByPath(target, path, value) {
      const parts = String(path).split('.').filter(Boolean);
      let current = target;
      while (parts.length > 1) {
        const key = parts.shift();
        if (toString.call(current[key]) !== '[object Object]') current[key] = {};
        current = current[key];
      }
      current[parts[0]] = value;
      return target;
    },

    getByPath(target, path, fallback) {
      const result = String(path).split('.').filter(Boolean).reduce((value, key) => {
        if (value === null || value === undefined) return undefined;
        return value[key];
      }, target);
      return result === undefined ? fallback : result;
    },

    debounce(fn, wait = 100) {
      let timer = null;
      return function debounced(...args) {
        clearTimeout(timer);
        timer = setTimeout(() => fn.apply(this, args), wait);
      };
    },

    formatBytes(bytes) {
      if (!Number.isFinite(bytes) || bytes < 1) return '0 B';
      const units = ['B', 'KB', 'MB', 'GB'];
      const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
      return `${(bytes / (1024 ** exponent)).toFixed(exponent === 0 ? 0 : 1)} ${units[exponent]}`;
    }
  };

  AXM.EventBus = class EventBus {
    constructor() {
      this.listeners = new Map();
    }

    on(eventName, listener) {
      if (!this.listeners.has(eventName)) this.listeners.set(eventName, new Set());
      this.listeners.get(eventName).add(listener);
      return () => this.off(eventName, listener);
    }

    off(eventName, listener) {
      this.listeners.get(eventName)?.delete(listener);
    }

    emit(eventName, detail) {
      this.listeners.get(eventName)?.forEach((listener) => {
        try {
          listener(detail);
        } catch (error) {
          console.error(`[AXM EventBus] ${eventName}`, error);
        }
      });
    }
  };
})(typeof globalThis !== 'undefined' ? globalThis : window);

globalThis.AXM_DEFAULT_CATALOG = {"schema":"axm.visual-catalog/1","id":"axm.visual-effect-fabric.default-catalog","name":"AXM AetherFX Visual Effect Fabric Catalog","version":"1.3.0","status":"WORKING","created":"2026-07-28","principles":["Fully modular underneath; simple controls on top.","Build once, compose many times, share safely.","No silent rewrite: recipes and packages remain inspectable.","Quality tiers, accessibility behavior, provenance, and fallbacks are first-class metadata.","Custom modules can derive from or compose existing modules without mutating their sources."],"modules":[{"id":"primitive.blur","name":"Blur","version":"1.1.0","schema":"axm.visual-module/1","kind":"primitive","category":"Foundation","status":"WORKING","description":"Softens and diffuses a rendered layer.","tags":["primitive","foundation"],"dependencies":[],"exclusiveGroup":null,"shareable":true,"ui":{"icon":"blur"},"parameters":[],"renderer":{"type":"capability"},"quality":{"low":{"enabled":true},"medium":{"enabled":true},"high":{"enabled":true},"cinematic":{"enabled":true}},"accessibility":{"reducedMotionSafe":true,"highContrastSafe":true,"notes":"","photosensitiveSafe":true},"provenance":{"author":"Mike — Axiom/Mir","origin":"AXM AetherFX Visual Effect Fabric v1.1.0 working foundation","license":"UNSET — choose before public sharing","created":"2026-07-28","sourceIntegrity":"Generated locally from this package; no external runtime dependency."}},{"id":"primitive.glow","name":"Glow","version":"1.1.0","schema":"axm.visual-module/1","kind":"primitive","category":"Foundation","status":"WORKING","description":"Creates emissive-looking light spill.","tags":["primitive","foundation"],"dependencies":[],"exclusiveGroup":null,"shareable":true,"ui":{"icon":"sun"},"parameters":[],"renderer":{"type":"capability"},"quality":{"low":{"enabled":true},"medium":{"enabled":true},"high":{"enabled":true},"cinematic":{"enabled":true}},"accessibility":{"reducedMotionSafe":true,"highContrastSafe":true,"notes":"","photosensitiveSafe":true},"provenance":{"author":"Mike — Axiom/Mir","origin":"AXM AetherFX Visual Effect Fabric v1.1.0 working foundation","license":"UNSET — choose before public sharing","created":"2026-07-28","sourceIntegrity":"Generated locally from this package; no external runtime dependency."}},{"id":"primitive.gradient","name":"Gradient","version":"1.1.0","schema":"axm.visual-module/1","kind":"primitive","category":"Foundation","status":"WORKING","description":"Interpolates color, light, and opacity.","tags":["primitive","foundation"],"dependencies":[],"exclusiveGroup":null,"shareable":true,"ui":{"icon":"gradient"},"parameters":[],"renderer":{"type":"capability"},"quality":{"low":{"enabled":true},"medium":{"enabled":true},"high":{"enabled":true},"cinematic":{"enabled":true}},"accessibility":{"reducedMotionSafe":true,"highContrastSafe":true,"notes":"","photosensitiveSafe":true},"provenance":{"author":"Mike — Axiom/Mir","origin":"AXM AetherFX Visual Effect Fabric v1.1.0 working foundation","license":"UNSET — choose before public sharing","created":"2026-07-28","sourceIntegrity":"Generated locally from this package; no external runtime dependency."}},{"id":"primitive.noise","name":"Noise","version":"1.1.0","schema":"axm.visual-module/1","kind":"primitive","category":"Foundation","status":"WORKING","description":"Adds controlled irregularity and material breakup.","tags":["primitive","foundation"],"dependencies":[],"exclusiveGroup":null,"shareable":true,"ui":{"icon":"noise"},"parameters":[],"renderer":{"type":"capability"},"quality":{"low":{"enabled":true},"medium":{"enabled":true},"high":{"enabled":true},"cinematic":{"enabled":true}},"accessibility":{"reducedMotionSafe":true,"highContrastSafe":true,"notes":"","photosensitiveSafe":true},"provenance":{"author":"Mike — Axiom/Mir","origin":"AXM AetherFX Visual Effect Fabric v1.1.0 working foundation","license":"UNSET — choose before public sharing","created":"2026-07-28","sourceIntegrity":"Generated locally from this package; no external runtime dependency."}},{"id":"primitive.mask","name":"Mask","version":"1.1.0","schema":"axm.visual-module/1","kind":"primitive","category":"Foundation","status":"WORKING","description":"Restricts an effect to a selected region.","tags":["primitive","foundation"],"dependencies":[],"exclusiveGroup":null,"shareable":true,"ui":{"icon":"mask"},"parameters":[],"renderer":{"type":"capability"},"quality":{"low":{"enabled":true},"medium":{"enabled":true},"high":{"enabled":true},"cinematic":{"enabled":true}},"accessibility":{"reducedMotionSafe":true,"highContrastSafe":true,"notes":"","photosensitiveSafe":true},"provenance":{"author":"Mike — Axiom/Mir","origin":"AXM AetherFX Visual Effect Fabric v1.1.0 working foundation","license":"UNSET — choose before public sharing","created":"2026-07-28","sourceIntegrity":"Generated locally from this package; no external runtime dependency."}},{"id":"primitive.shadow","name":"Shadow","version":"1.1.0","schema":"axm.visual-module/1","kind":"primitive","category":"Foundation","status":"WORKING","description":"Creates separation and perceived elevation.","tags":["primitive","foundation"],"dependencies":[],"exclusiveGroup":null,"shareable":true,"ui":{"icon":"layers"},"parameters":[],"renderer":{"type":"capability"},"quality":{"low":{"enabled":true},"medium":{"enabled":true},"high":{"enabled":true},"cinematic":{"enabled":true}},"accessibility":{"reducedMotionSafe":true,"highContrastSafe":true,"notes":"","photosensitiveSafe":true},"provenance":{"author":"Mike — Axiom/Mir","origin":"AXM AetherFX Visual Effect Fabric v1.1.0 working foundation","license":"UNSET — choose before public sharing","created":"2026-07-28","sourceIntegrity":"Generated locally from this package; no external runtime dependency."}},{"id":"primitive.motion-curve","name":"Motion Curve","version":"1.1.0","schema":"axm.visual-module/1","kind":"primitive","category":"Foundation","status":"WORKING","description":"Defines easing and temporal behavior.","tags":["primitive","foundation"],"dependencies":[],"exclusiveGroup":null,"shareable":true,"ui":{"icon":"wave"},"parameters":[],"renderer":{"type":"capability"},"quality":{"low":{"enabled":true},"medium":{"enabled":true},"high":{"enabled":true},"cinematic":{"enabled":true}},"accessibility":{"reducedMotionSafe":true,"highContrastSafe":true,"notes":"","photosensitiveSafe":true},"provenance":{"author":"Mike — Axiom/Mir","origin":"AXM AetherFX Visual Effect Fabric v1.1.0 working foundation","license":"UNSET — choose before public sharing","created":"2026-07-28","sourceIntegrity":"Generated locally from this package; no external runtime dependency."}},{"id":"primitive.transform","name":"Transform","version":"1.1.0","schema":"axm.visual-module/1","kind":"primitive","category":"Foundation","status":"WORKING","description":"Moves, scales, tilts, and rotates a layer.","tags":["primitive","foundation"],"dependencies":[],"exclusiveGroup":null,"shareable":true,"ui":{"icon":"move"},"parameters":[],"renderer":{"type":"capability"},"quality":{"low":{"enabled":true},"medium":{"enabled":true},"high":{"enabled":true},"cinematic":{"enabled":true}},"accessibility":{"reducedMotionSafe":true,"highContrastSafe":true,"notes":"","photosensitiveSafe":true},"provenance":{"author":"Mike — Axiom/Mir","origin":"AXM AetherFX Visual Effect Fabric v1.1.0 working foundation","license":"UNSET — choose before public sharing","created":"2026-07-28","sourceIntegrity":"Generated locally from this package; no external runtime dependency."}},{"id":"primitive.opacity","name":"Opacity","version":"1.1.0","schema":"axm.visual-module/1","kind":"primitive","category":"Foundation","status":"WORKING","description":"Controls visibility and layer mixing.","tags":["primitive","foundation"],"dependencies":[],"exclusiveGroup":null,"shareable":true,"ui":{"icon":"opacity"},"parameters":[],"renderer":{"type":"capability"},"quality":{"low":{"enabled":true},"medium":{"enabled":true},"high":{"enabled":true},"cinematic":{"enabled":true}},"accessibility":{"reducedMotionSafe":true,"highContrastSafe":true,"notes":"","photosensitiveSafe":true},"provenance":{"author":"Mike — Axiom/Mir","origin":"AXM AetherFX Visual Effect Fabric v1.1.0 working foundation","license":"UNSET — choose before public sharing","created":"2026-07-28","sourceIntegrity":"Generated locally from this package; no external runtime dependency."}},{"id":"primitive.blend","name":"Blend","version":"1.1.0","schema":"axm.visual-module/1","kind":"primitive","category":"Foundation","status":"WORKING","description":"Combines layers through controlled compositing.","tags":["primitive","foundation"],"dependencies":[],"exclusiveGroup":null,"shareable":true,"ui":{"icon":"blend"},"parameters":[],"renderer":{"type":"capability"},"quality":{"low":{"enabled":true},"medium":{"enabled":true},"high":{"enabled":true},"cinematic":{"enabled":true}},"accessibility":{"reducedMotionSafe":true,"highContrastSafe":true,"notes":"","photosensitiveSafe":true},"provenance":{"author":"Mike — Axiom/Mir","origin":"AXM AetherFX Visual Effect Fabric v1.1.0 working foundation","license":"UNSET — choose before public sharing","created":"2026-07-28","sourceIntegrity":"Generated locally from this package; no external runtime dependency."}},{"id":"primitive.filter","name":"Filter","version":"1.1.0","schema":"axm.visual-module/1","kind":"primitive","category":"Foundation","status":"WORKING","description":"Applies color and image-space adjustments.","tags":["primitive","foundation"],"dependencies":[],"exclusiveGroup":null,"shareable":true,"ui":{"icon":"filter"},"parameters":[],"renderer":{"type":"capability"},"quality":{"low":{"enabled":true},"medium":{"enabled":true},"high":{"enabled":true},"cinematic":{"enabled":true}},"accessibility":{"reducedMotionSafe":true,"highContrastSafe":true,"notes":"","photosensitiveSafe":true},"provenance":{"author":"Mike — Axiom/Mir","origin":"AXM AetherFX Visual Effect Fabric v1.1.0 working foundation","license":"UNSET — choose before public sharing","created":"2026-07-28","sourceIntegrity":"Generated locally from this package; no external runtime dependency."}},{"id":"material.aetherglass","name":"Aetherglass Panel","version":"1.1.0","schema":"axm.visual-module/1","kind":"organ","category":"Materials","status":"WORKING","description":"Clear luminous glass with controlled frost, tint, and internal energy edge.","tags":["glass","surface","premium"],"dependencies":["primitive.blur","primitive.gradient","primitive.shadow","primitive.opacity"],"exclusiveGroup":"material","shareable":true,"ui":{"icon":"cube"},"parameters":[{"id":"opacity","label":"Opacity","type":"number","default":0.76,"description":"","min":0.25,"max":1,"step":0.01,"cssVar":"--fx-glass-opacity"},{"id":"blur","label":"Frost blur","type":"number","default":18,"description":"","min":0,"max":42,"step":1,"unit":"px","cssVar":"--fx-glass-blur"},{"id":"edge","label":"Edge energy","type":"number","default":0.62,"description":"","min":0,"max":1,"step":0.01,"cssVar":"--fx-edge-energy"},{"id":"roughness","label":"Roughness","type":"number","default":0.18,"description":"","min":0,"max":1,"step":0.01,"cssVar":"--fx-surface-roughness"}],"renderer":{"type":"class","scope":"surface","className":"fx-material-aetherglass"},"quality":{"low":{"enabled":true},"medium":{"enabled":true},"high":{"enabled":true},"cinematic":{"enabled":true}},"accessibility":{"reducedMotionSafe":true,"highContrastSafe":true,"notes":"","photosensitiveSafe":true},"provenance":{"author":"Mike — Axiom/Mir","origin":"AXM AetherFX Visual Effect Fabric v1.1.0 working foundation","license":"UNSET — choose before public sharing","created":"2026-07-28","sourceIntegrity":"Generated locally from this package; no external runtime dependency."}},{"id":"material.frosted-panel","name":"Frosted Panel","version":"1.1.0","schema":"axm.visual-module/1","kind":"organ","category":"Materials","status":"WORKING","description":"Diffused glass surface for calm separation and readable layering.","tags":["glass","frost","surface"],"dependencies":["primitive.blur","primitive.opacity","primitive.shadow"],"exclusiveGroup":"material","shareable":true,"ui":{"icon":"snow"},"parameters":[{"id":"opacity","label":"Opacity","type":"number","default":0.84,"description":"","min":0.35,"max":1,"step":0.01,"cssVar":"--fx-frost-opacity"},{"id":"frost","label":"Frost","type":"number","default":0.72,"description":"","min":0,"max":1,"step":0.01,"cssVar":"--fx-frost-strength"},{"id":"blur","label":"Blur","type":"number","default":24,"description":"","min":0,"max":48,"step":1,"unit":"px","cssVar":"--fx-glass-blur"}],"renderer":{"type":"class","scope":"surface","className":"fx-material-frosted"},"quality":{"low":{"enabled":true},"medium":{"enabled":true},"high":{"enabled":true},"cinematic":{"enabled":true}},"accessibility":{"reducedMotionSafe":true,"highContrastSafe":true,"notes":"","photosensitiveSafe":true},"provenance":{"author":"Mike — Axiom/Mir","origin":"AXM AetherFX Visual Effect Fabric v1.1.0 working foundation","license":"UNSET — choose before public sharing","created":"2026-07-28","sourceIntegrity":"Generated locally from this package; no external runtime dependency."}},{"id":"material.hologram-skin","name":"Hologram Skin","version":"1.1.0","schema":"axm.visual-module/1","kind":"organ","category":"Materials","status":"WORKING","description":"Holographic overlay with scanline depth, spectral tint, and low-cost shimmer.","tags":["hologram","surface","scanlines"],"dependencies":["primitive.gradient","primitive.noise","primitive.mask","primitive.opacity"],"exclusiveGroup":"material","shareable":true,"ui":{"icon":"scan"},"parameters":[{"id":"intensity","label":"Intensity","type":"number","default":0.58,"description":"","min":0,"max":1,"step":0.01,"cssVar":"--fx-holo-intensity"},{"id":"scanlines","label":"Scanlines","type":"number","default":0.36,"description":"","min":0,"max":1,"step":0.01,"cssVar":"--fx-scanline-opacity"},{"id":"noise","label":"Noise","type":"number","default":0.15,"description":"","min":0,"max":0.6,"step":0.01,"cssVar":"--fx-noise-opacity"}],"renderer":{"type":"class","scope":"surface","className":"fx-material-hologram"},"quality":{"low":{"enabled":true},"medium":{"enabled":true},"high":{"enabled":true},"cinematic":{"enabled":true}},"accessibility":{"reducedMotionSafe":true,"highContrastSafe":true,"notes":"","photosensitiveSafe":true},"provenance":{"author":"Mike — Axiom/Mir","origin":"AXM AetherFX Visual Effect Fabric v1.1.0 working foundation","license":"UNSET — choose before public sharing","created":"2026-07-28","sourceIntegrity":"Generated locally from this package; no external runtime dependency."}},{"id":"material.dark-shell","name":"Dark Composite Shell","version":"1.1.0","schema":"axm.visual-module/1","kind":"organ","category":"Materials","status":"WORKING","description":"Dense matte shell with crisp separation, restrained highlights, and high readability.","tags":["dark","matte","surface"],"dependencies":["primitive.gradient","primitive.shadow"],"exclusiveGroup":"material","shareable":true,"ui":{"icon":"shield"},"parameters":[{"id":"depth","label":"Depth","type":"number","default":0.66,"description":"","min":0,"max":1,"step":0.01,"cssVar":"--fx-shell-depth"},{"id":"sheen","label":"Sheen","type":"number","default":0.16,"description":"","min":0,"max":0.7,"step":0.01,"cssVar":"--fx-shell-sheen"},{"id":"edge","label":"Edge","type":"number","default":0.32,"description":"","min":0,"max":1,"step":0.01,"cssVar":"--fx-edge-energy"}],"renderer":{"type":"class","scope":"surface","className":"fx-material-dark-shell"},"quality":{"low":{"enabled":true},"medium":{"enabled":true},"high":{"enabled":true},"cinematic":{"enabled":true}},"accessibility":{"reducedMotionSafe":true,"highContrastSafe":true,"notes":"","photosensitiveSafe":true},"provenance":{"author":"Mike — Axiom/Mir","origin":"AXM AetherFX Visual Effect Fabric v1.1.0 working foundation","license":"UNSET — choose before public sharing","created":"2026-07-28","sourceIntegrity":"Generated locally from this package; no external runtime dependency."}},{"id":"material.neon-acrylic","name":"Neon Acrylic","version":"1.1.0","schema":"axm.visual-module/1","kind":"organ","category":"Materials","status":"WORKING","description":"Semi-solid luminous acrylic with crisp edges and saturated inner glow.","tags":["neon","acrylic","surface"],"dependencies":["primitive.glow","primitive.gradient","primitive.shadow"],"exclusiveGroup":"material","shareable":true,"ui":{"icon":"rectangle"},"parameters":[{"id":"opacity","label":"Opacity","type":"number","default":0.88,"description":"","min":0.4,"max":1,"step":0.01,"cssVar":"--fx-acrylic-opacity"},{"id":"saturation","label":"Saturation","type":"number","default":1.1,"description":"","min":0.5,"max":1.6,"step":0.01,"cssVar":"--fx-acrylic-saturation"},{"id":"edge","label":"Edge glow","type":"number","default":0.76,"description":"","min":0,"max":1,"step":0.01,"cssVar":"--fx-edge-energy"}],"renderer":{"type":"class","scope":"surface","className":"fx-material-acrylic"},"quality":{"low":{"enabled":true},"medium":{"enabled":true},"high":{"enabled":true},"cinematic":{"enabled":true}},"accessibility":{"reducedMotionSafe":true,"highContrastSafe":true,"notes":"","photosensitiveSafe":true},"provenance":{"author":"Mike — Axiom/Mir","origin":"AXM AetherFX Visual Effect Fabric v1.1.0 working foundation","license":"UNSET — choose before public sharing","created":"2026-07-28","sourceIntegrity":"Generated locally from this package; no external runtime dependency."}},{"id":"material.metal-trim","name":"Polished Metal Trim","version":"1.1.0","schema":"axm.visual-module/1","kind":"effect","category":"Materials","status":"WORKING","description":"Narrow reflective trim that can sit on top of any selected surface material.","tags":["metal","trim","reflection"],"dependencies":["primitive.gradient","primitive.mask","primitive.shadow"],"exclusiveGroup":null,"shareable":true,"ui":{"icon":"slash"},"parameters":[{"id":"brightness","label":"Brightness","type":"number","default":0.54,"description":"","min":0,"max":1,"step":0.01,"cssVar":"--fx-metal-brightness"},{"id":"width","label":"Width","type":"number","default":1.25,"description":"","min":0.5,"max":4,"step":0.25,"unit":"px","cssVar":"--fx-metal-width"},{"id":"angle","label":"Reflection angle","type":"number","default":118,"description":"","min":0,"max":360,"step":1,"unit":"deg","cssVar":"--fx-metal-angle"}],"renderer":{"type":"class","scope":"surface","className":"fx-metal-trim"},"quality":{"low":{"enabled":true},"medium":{"enabled":true},"high":{"enabled":true},"cinematic":{"enabled":true}},"accessibility":{"reducedMotionSafe":true,"highContrastSafe":true,"notes":"","photosensitiveSafe":true},"provenance":{"author":"Mike — Axiom/Mir","origin":"AXM AetherFX Visual Effect Fabric v1.1.0 working foundation","license":"UNSET — choose before public sharing","created":"2026-07-28","sourceIntegrity":"Generated locally from this package; no external runtime dependency."}},{"id":"light.neon-edge-glow","name":"Neon Edge Glow","version":"1.1.0","schema":"axm.visual-module/1","kind":"effect","category":"Light","status":"WORKING","description":"A crisp emissive rim around panels, controls, and selected scene elements.","tags":["light","edge","neon"],"dependencies":["primitive.glow","primitive.mask","primitive.shadow"],"exclusiveGroup":null,"shareable":true,"ui":{"icon":"frame"},"parameters":[{"id":"intensity","label":"Intensity","type":"number","default":0.68,"description":"","min":0,"max":1,"step":0.01,"cssVar":"--fx-edge-energy"},{"id":"width","label":"Width","type":"number","default":2,"description":"","min":0.5,"max":8,"step":0.5,"unit":"px","cssVar":"--fx-edge-width"},{"id":"spread","label":"Spread","type":"number","default":16,"description":"","min":0,"max":48,"step":1,"unit":"px","cssVar":"--fx-glow-spread"}],"renderer":{"type":"class","scope":"surface","className":"fx-neon-edge"},"quality":{"low":{"enabled":true},"medium":{"enabled":true},"high":{"enabled":true},"cinematic":{"enabled":true}},"accessibility":{"reducedMotionSafe":true,"highContrastSafe":true,"notes":"","photosensitiveSafe":true},"provenance":{"author":"Mike — Axiom/Mir","origin":"AXM AetherFX Visual Effect Fabric v1.1.0 working foundation","license":"UNSET — choose before public sharing","created":"2026-07-28","sourceIntegrity":"Generated locally from this package; no external runtime dependency."}},{"id":"light.soft-bloom-halo","name":"Soft Bloom Halo","version":"1.1.0","schema":"axm.visual-module/1","kind":"effect","category":"Light","status":"WORKING","description":"A gentle bloom field that wraps focal surfaces without flattening text.","tags":["light","bloom","halo"],"dependencies":["primitive.blur","primitive.glow","primitive.opacity"],"exclusiveGroup":null,"shareable":true,"ui":{"icon":"halo"},"parameters":[{"id":"intensity","label":"Intensity","type":"number","default":0.48,"description":"","min":0,"max":1,"step":0.01,"cssVar":"--fx-bloom-intensity"},{"id":"radius","label":"Radius","type":"number","default":34,"description":"","min":8,"max":110,"step":1,"unit":"px","cssVar":"--fx-bloom-radius"},{"id":"threshold","label":"Threshold","type":"number","default":0.58,"description":"","min":0,"max":1,"step":0.01,"cssVar":"--fx-bloom-threshold"}],"renderer":{"type":"overlay","scope":"light","className":"fx-overlay-bloom"},"quality":{"low":{"enabled":true},"medium":{"enabled":true},"high":{"enabled":true},"cinematic":{"enabled":true}},"accessibility":{"reducedMotionSafe":true,"highContrastSafe":true,"notes":"","photosensitiveSafe":true},"provenance":{"author":"Mike — Axiom/Mir","origin":"AXM AetherFX Visual Effect Fabric v1.1.0 working foundation","license":"UNSET — choose before public sharing","created":"2026-07-28","sourceIntegrity":"Generated locally from this package; no external runtime dependency."}},{"id":"light.reflection-streak","name":"Reflection Streak","version":"1.1.0","schema":"axm.visual-module/1","kind":"effect","category":"Light","status":"WORKING","description":"A moving specular streak for glass, acrylic, metal, and cinematic highlights.","tags":["light","reflection","motion"],"dependencies":["primitive.gradient","primitive.mask","primitive.motion-curve"],"exclusiveGroup":null,"shareable":true,"ui":{"icon":"slash"},"parameters":[{"id":"intensity","label":"Intensity","type":"number","default":0.52,"description":"","min":0,"max":1,"step":0.01,"cssVar":"--fx-reflection-intensity"},{"id":"length","label":"Length","type":"number","default":42,"description":"","min":10,"max":90,"step":1,"unit":"%","cssVar":"--fx-reflection-length"},{"id":"angle","label":"Angle","type":"number","default":118,"description":"","min":0,"max":360,"step":1,"unit":"deg","cssVar":"--fx-reflection-angle"},{"id":"speed","label":"Speed","type":"number","default":7,"description":"","min":2,"max":20,"step":0.5,"unit":"s","cssVar":"--fx-reflection-speed"}],"renderer":{"type":"class","scope":"surface","className":"fx-reflection-streak"},"quality":{"low":{"enabled":true},"medium":{"enabled":true},"high":{"enabled":true},"cinematic":{"enabled":true}},"accessibility":{"reducedMotionSafe":true,"highContrastSafe":true,"notes":"Animation becomes a static highlight when reduced motion is enabled.","photosensitiveSafe":true},"provenance":{"author":"Mike — Axiom/Mir","origin":"AXM AetherFX Visual Effect Fabric v1.1.0 working foundation","license":"UNSET — choose before public sharing","created":"2026-07-28","sourceIntegrity":"Generated locally from this package; no external runtime dependency."}},{"id":"light.sweep","name":"Scanning Light Sweep","version":"1.1.0","schema":"axm.visual-module/1","kind":"effect","category":"Light","status":"WORKING","description":"A controlled travelling light pass that can reveal structure or signal activity.","tags":["light","scan","motion"],"dependencies":["primitive.gradient","primitive.mask","primitive.motion-curve"],"exclusiveGroup":null,"shareable":true,"ui":{"icon":"scan"},"parameters":[{"id":"intensity","label":"Intensity","type":"number","default":0.42,"description":"","min":0,"max":1,"step":0.01,"cssVar":"--fx-sweep-intensity"},{"id":"width","label":"Width","type":"number","default":18,"description":"","min":4,"max":50,"step":1,"unit":"%","cssVar":"--fx-sweep-width"},{"id":"speed","label":"Speed","type":"number","default":5.5,"description":"","min":1.5,"max":18,"step":0.5,"unit":"s","cssVar":"--fx-sweep-speed"}],"renderer":{"type":"overlay","scope":"light","className":"fx-overlay-sweep"},"quality":{"low":{"enabled":true},"medium":{"enabled":true},"high":{"enabled":true},"cinematic":{"enabled":true}},"accessibility":{"reducedMotionSafe":true,"highContrastSafe":true,"notes":"","photosensitiveSafe":true},"provenance":{"author":"Mike — Axiom/Mir","origin":"AXM AetherFX Visual Effect Fabric v1.1.0 working foundation","license":"UNSET — choose before public sharing","created":"2026-07-28","sourceIntegrity":"Generated locally from this package; no external runtime dependency."}},{"id":"light.rim","name":"Scene Rim Light","version":"1.1.0","schema":"axm.visual-module/1","kind":"effect","category":"Light","status":"WORKING","description":"Adds a directional rim around the central scene and raises the perceived silhouette.","tags":["light","rim","focus"],"dependencies":["primitive.glow","primitive.gradient","primitive.mask"],"exclusiveGroup":null,"shareable":true,"ui":{"icon":"circle"},"parameters":[{"id":"intensity","label":"Intensity","type":"number","default":0.58,"description":"","min":0,"max":1,"step":0.01,"cssVar":"--fx-rim-intensity"},{"id":"softness","label":"Softness","type":"number","default":0.62,"description":"","min":0,"max":1,"step":0.01,"cssVar":"--fx-rim-softness"},{"id":"direction","label":"Direction","type":"number","default":315,"description":"","min":0,"max":360,"step":1,"unit":"deg","cssVar":"--fx-rim-direction"}],"renderer":{"type":"class","scope":"scene","className":"fx-scene-rim"},"quality":{"low":{"enabled":true},"medium":{"enabled":true},"high":{"enabled":true},"cinematic":{"enabled":true}},"accessibility":{"reducedMotionSafe":true,"highContrastSafe":true,"notes":"","photosensitiveSafe":true},"provenance":{"author":"Mike — Axiom/Mir","origin":"AXM AetherFX Visual Effect Fabric v1.1.0 working foundation","license":"UNSET — choose before public sharing","created":"2026-07-28","sourceIntegrity":"Generated locally from this package; no external runtime dependency."}},{"id":"light.volumetric-beam","name":"Volumetric Beam Illusion","version":"1.1.0","schema":"axm.visual-module/1","kind":"effect","category":"Light","status":"WORKING","description":"A lightweight layered beam that suggests volumetric lighting without a 3D renderer.","tags":["light","beam","atmosphere"],"dependencies":["primitive.gradient","primitive.blur","primitive.mask"],"exclusiveGroup":null,"shareable":true,"ui":{"icon":"triangle"},"parameters":[{"id":"intensity","label":"Intensity","type":"number","default":0.28,"description":"","min":0,"max":0.8,"step":0.01,"cssVar":"--fx-beam-intensity"},{"id":"width","label":"Width","type":"number","default":36,"description":"","min":8,"max":80,"step":1,"unit":"%","cssVar":"--fx-beam-width"},{"id":"angle","label":"Angle","type":"number","default":18,"description":"","min":-80,"max":80,"step":1,"unit":"deg","cssVar":"--fx-beam-angle"}],"renderer":{"type":"overlay","scope":"ambient","className":"fx-overlay-beam"},"quality":{"low":{"enabled":false,"fallbackModuleId":"light.ambient-backwash"},"medium":{"enabled":true},"high":{"enabled":true},"cinematic":{"enabled":true}},"accessibility":{"reducedMotionSafe":true,"highContrastSafe":true,"notes":"","photosensitiveSafe":true},"provenance":{"author":"Mike — Axiom/Mir","origin":"AXM AetherFX Visual Effect Fabric v1.1.0 working foundation","license":"UNSET — choose before public sharing","created":"2026-07-28","sourceIntegrity":"Generated locally from this package; no external runtime dependency."}},{"id":"light.reactive-spotlight","name":"Pointer Reactive Spotlight","version":"1.1.0","schema":"axm.visual-module/1","kind":"effect","category":"Light","status":"WORKING","description":"A spotlight that follows pointer position inside the preview while staying locally bounded.","tags":["light","interactive","spotlight"],"dependencies":["primitive.gradient","primitive.mask","primitive.opacity"],"exclusiveGroup":null,"shareable":true,"ui":{"icon":"target"},"parameters":[{"id":"intensity","label":"Intensity","type":"number","default":0.36,"description":"","min":0,"max":0.9,"step":0.01,"cssVar":"--fx-spot-intensity"},{"id":"radius","label":"Radius","type":"number","default":230,"description":"","min":80,"max":520,"step":10,"unit":"px","cssVar":"--fx-spot-radius"},{"id":"softness","label":"Softness","type":"number","default":0.72,"description":"","min":0.2,"max":1,"step":0.01,"cssVar":"--fx-spot-softness"}],"renderer":{"type":"overlay","scope":"light","className":"fx-overlay-spotlight","interactive":"pointer"},"quality":{"low":{"enabled":false,"fallbackModuleId":"light.ambient-backwash"},"medium":{"enabled":true},"high":{"enabled":true},"cinematic":{"enabled":true}},"accessibility":{"reducedMotionSafe":true,"highContrastSafe":true,"notes":"","photosensitiveSafe":true},"provenance":{"author":"Mike — Axiom/Mir","origin":"AXM AetherFX Visual Effect Fabric v1.1.0 working foundation","license":"UNSET — choose before public sharing","created":"2026-07-28","sourceIntegrity":"Generated locally from this package; no external runtime dependency."}},{"id":"light.ambient-backwash","name":"Ambient Backwash","version":"1.1.0","schema":"axm.visual-module/1","kind":"effect","category":"Light","status":"WORKING","description":"A broad colored light wash behind the scene for separation and mood continuity.","tags":["light","ambient","backlight"],"dependencies":["primitive.gradient","primitive.blur","primitive.opacity"],"exclusiveGroup":null,"shareable":true,"ui":{"icon":"sun"},"parameters":[{"id":"intensity","label":"Intensity","type":"number","default":0.34,"description":"","min":0,"max":1,"step":0.01,"cssVar":"--fx-backwash-intensity"},{"id":"spread","label":"Spread","type":"number","default":72,"description":"","min":20,"max":160,"step":2,"unit":"%","cssVar":"--fx-backwash-spread"},{"id":"vertical","label":"Vertical position","type":"number","default":45,"description":"","min":0,"max":100,"step":1,"unit":"%","cssVar":"--fx-backwash-y"}],"renderer":{"type":"overlay","scope":"ambient","className":"fx-overlay-backwash"},"quality":{"low":{"enabled":true},"medium":{"enabled":true},"high":{"enabled":true},"cinematic":{"enabled":true}},"accessibility":{"reducedMotionSafe":true,"highContrastSafe":true,"notes":"","photosensitiveSafe":true},"provenance":{"author":"Mike — Axiom/Mir","origin":"AXM AetherFX Visual Effect Fabric v1.1.0 working foundation","license":"UNSET — choose before public sharing","created":"2026-07-28","sourceIntegrity":"Generated locally from this package; no external runtime dependency."}},{"id":"light.corner-flares","name":"Corner Flares","version":"1.1.0","schema":"axm.visual-module/1","kind":"effect","category":"Light","status":"WORKING","description":"Small restrained corner emitters that make a frame feel powered without flooding it.","tags":["light","corners","frame"],"dependencies":["primitive.glow","primitive.mask"],"exclusiveGroup":null,"shareable":true,"ui":{"icon":"corners"},"parameters":[{"id":"intensity","label":"Intensity","type":"number","default":0.38,"description":"","min":0,"max":1,"step":0.01,"cssVar":"--fx-corner-intensity"},{"id":"size","label":"Size","type":"number","default":42,"description":"","min":10,"max":100,"step":2,"unit":"px","cssVar":"--fx-corner-size"}],"renderer":{"type":"class","scope":"scene","className":"fx-corner-flares"},"quality":{"low":{"enabled":true},"medium":{"enabled":true},"high":{"enabled":true},"cinematic":{"enabled":true}},"accessibility":{"reducedMotionSafe":true,"highContrastSafe":true,"notes":"","photosensitiveSafe":true},"provenance":{"author":"Mike — Axiom/Mir","origin":"AXM AetherFX Visual Effect Fabric v1.1.0 working foundation","license":"UNSET — choose before public sharing","created":"2026-07-28","sourceIntegrity":"Generated locally from this package; no external runtime dependency."}},{"id":"motion.hover-lift","name":"Hover Lift","version":"1.1.0","schema":"axm.visual-module/1","kind":"effect","category":"Motion","status":"WORKING","description":"Subtle lift, tilt, and shadow response for selectable surfaces.","tags":["motion","hover","interaction"],"dependencies":["primitive.transform","primitive.shadow","primitive.motion-curve"],"exclusiveGroup":null,"shareable":true,"ui":{"icon":"up"},"parameters":[{"id":"height","label":"Height","type":"number","default":6,"description":"","min":0,"max":18,"step":1,"unit":"px","cssVar":"--fx-hover-height"},{"id":"tilt","label":"Tilt","type":"number","default":0.8,"description":"","min":0,"max":3,"step":0.1,"unit":"deg","cssVar":"--fx-hover-tilt"},{"id":"duration","label":"Duration","type":"number","default":240,"description":"","min":80,"max":700,"step":10,"unit":"ms","cssVar":"--fx-hover-duration"}],"renderer":{"type":"class","scope":"surface","className":"fx-hover-lift"},"quality":{"low":{"enabled":true},"medium":{"enabled":true},"high":{"enabled":true},"cinematic":{"enabled":true}},"accessibility":{"reducedMotionSafe":true,"highContrastSafe":true,"notes":"","photosensitiveSafe":true},"provenance":{"author":"Mike — Axiom/Mir","origin":"AXM AetherFX Visual Effect Fabric v1.1.0 working foundation","license":"UNSET — choose before public sharing","created":"2026-07-28","sourceIntegrity":"Generated locally from this package; no external runtime dependency."}},{"id":"motion.idle-pulse","name":"Idle Pulse","version":"1.1.0","schema":"axm.visual-module/1","kind":"effect","category":"Motion","status":"WORKING","description":"Low-amplitude breathing motion for powered or waiting elements.","tags":["motion","idle","pulse"],"dependencies":["primitive.transform","primitive.opacity","primitive.motion-curve"],"exclusiveGroup":null,"shareable":true,"ui":{"icon":"pulse"},"parameters":[{"id":"speed","label":"Speed","type":"number","default":4.8,"description":"","min":1.5,"max":14,"step":0.1,"unit":"s","cssVar":"--fx-pulse-speed"},{"id":"scale","label":"Scale","type":"number","default":1.014,"description":"","min":1,"max":1.06,"step":0.001,"cssVar":"--fx-pulse-scale"},{"id":"intensity","label":"Intensity","type":"number","default":0.34,"description":"","min":0,"max":1,"step":0.01,"cssVar":"--fx-pulse-intensity"}],"renderer":{"type":"class","scope":"active","className":"fx-idle-pulse"},"quality":{"low":{"enabled":true},"medium":{"enabled":true},"high":{"enabled":true},"cinematic":{"enabled":true}},"accessibility":{"reducedMotionSafe":true,"highContrastSafe":true,"notes":"","photosensitiveSafe":true},"provenance":{"author":"Mike — Axiom/Mir","origin":"AXM AetherFX Visual Effect Fabric v1.1.0 working foundation","license":"UNSET — choose before public sharing","created":"2026-07-28","sourceIntegrity":"Generated locally from this package; no external runtime dependency."}},{"id":"motion.loading-shimmer","name":"Loading Shimmer","version":"1.1.0","schema":"axm.visual-module/1","kind":"effect","category":"Motion","status":"WORKING","description":"A readable shimmer pass for loading, generation, and progress surfaces.","tags":["motion","loading","shimmer"],"dependencies":["primitive.gradient","primitive.mask","primitive.motion-curve"],"exclusiveGroup":null,"shareable":true,"ui":{"icon":"progress"},"parameters":[{"id":"speed","label":"Speed","type":"number","default":2.6,"description":"","min":0.8,"max":10,"step":0.1,"unit":"s","cssVar":"--fx-shimmer-speed"},{"id":"width","label":"Width","type":"number","default":28,"description":"","min":8,"max":70,"step":1,"unit":"%","cssVar":"--fx-shimmer-width"},{"id":"opacity","label":"Opacity","type":"number","default":0.42,"description":"","min":0,"max":0.9,"step":0.01,"cssVar":"--fx-shimmer-opacity"}],"renderer":{"type":"class","scope":"loading","className":"fx-loading-shimmer"},"quality":{"low":{"enabled":true},"medium":{"enabled":true},"high":{"enabled":true},"cinematic":{"enabled":true}},"accessibility":{"reducedMotionSafe":true,"highContrastSafe":true,"notes":"","photosensitiveSafe":true},"provenance":{"author":"Mike — Axiom/Mir","origin":"AXM AetherFX Visual Effect Fabric v1.1.0 working foundation","license":"UNSET — choose before public sharing","created":"2026-07-28","sourceIntegrity":"Generated locally from this package; no external runtime dependency."}},{"id":"motion.float-drift","name":"Ambient Float Drift","version":"1.1.0","schema":"axm.visual-module/1","kind":"effect","category":"Motion","status":"WORKING","description":"Slow parallax-like drift for ambient particles and decorative layers.","tags":["motion","ambient","parallax"],"dependencies":["primitive.transform","primitive.motion-curve"],"exclusiveGroup":null,"shareable":true,"ui":{"icon":"wind"},"parameters":[{"id":"speed","label":"Speed","type":"number","default":13,"description":"","min":4,"max":30,"step":0.5,"unit":"s","cssVar":"--fx-drift-speed"},{"id":"distance","label":"Distance","type":"number","default":10,"description":"","min":0,"max":34,"step":1,"unit":"px","cssVar":"--fx-drift-distance"},{"id":"rotation","label":"Rotation","type":"number","default":1.5,"description":"","min":0,"max":8,"step":0.1,"unit":"deg","cssVar":"--fx-drift-rotation"}],"renderer":{"type":"class","scope":"ambient","className":"fx-float-drift"},"quality":{"low":{"enabled":true},"medium":{"enabled":true},"high":{"enabled":true},"cinematic":{"enabled":true}},"accessibility":{"reducedMotionSafe":true,"highContrastSafe":true,"notes":"","photosensitiveSafe":true},"provenance":{"author":"Mike — Axiom/Mir","origin":"AXM AetherFX Visual Effect Fabric v1.1.0 working foundation","license":"UNSET — choose before public sharing","created":"2026-07-28","sourceIntegrity":"Generated locally from this package; no external runtime dependency."}},{"id":"motion.click-ripple","name":"Click Ripple","version":"1.1.0","schema":"axm.visual-module/1","kind":"effect","category":"Motion","status":"WORKING","description":"Creates a bounded visual ripple at the click point, without intercepting input.","tags":["motion","click","feedback"],"dependencies":["primitive.transform","primitive.opacity","primitive.motion-curve"],"exclusiveGroup":null,"shareable":true,"ui":{"icon":"ripple"},"parameters":[{"id":"size","label":"Size","type":"number","default":150,"description":"","min":40,"max":320,"step":10,"unit":"px","cssVar":"--fx-ripple-size"},{"id":"duration","label":"Duration","type":"number","default":620,"description":"","min":180,"max":1400,"step":20,"unit":"ms","cssVar":"--fx-ripple-duration"},{"id":"intensity","label":"Intensity","type":"number","default":0.46,"description":"","min":0,"max":1,"step":0.01,"cssVar":"--fx-ripple-intensity"}],"renderer":{"type":"interaction","scope":"stage","className":"fx-click-ripple","interactive":"click"},"quality":{"low":{"enabled":true},"medium":{"enabled":true},"high":{"enabled":true},"cinematic":{"enabled":true}},"accessibility":{"reducedMotionSafe":true,"highContrastSafe":true,"notes":"","photosensitiveSafe":true},"provenance":{"author":"Mike — Axiom/Mir","origin":"AXM AetherFX Visual Effect Fabric v1.1.0 working foundation","license":"UNSET — choose before public sharing","created":"2026-07-28","sourceIntegrity":"Generated locally from this package; no external runtime dependency."}},{"id":"motion.entry-reveal","name":"Layered Entry Reveal","version":"1.1.0","schema":"axm.visual-module/1","kind":"effect","category":"Motion","status":"WORKING","description":"Staggers scene elements into place using restrained opacity and vertical motion.","tags":["motion","entry","reveal"],"dependencies":["primitive.transform","primitive.opacity","primitive.motion-curve"],"exclusiveGroup":null,"shareable":true,"ui":{"icon":"enter"},"parameters":[{"id":"distance","label":"Distance","type":"number","default":16,"description":"","min":0,"max":60,"step":1,"unit":"px","cssVar":"--fx-entry-distance"},{"id":"duration","label":"Duration","type":"number","default":620,"description":"","min":120,"max":1800,"step":20,"unit":"ms","cssVar":"--fx-entry-duration"},{"id":"stagger","label":"Stagger","type":"number","default":70,"description":"","min":0,"max":240,"step":10,"unit":"ms","cssVar":"--fx-entry-stagger"}],"renderer":{"type":"class","scope":"scene","className":"fx-entry-reveal"},"quality":{"low":{"enabled":true},"medium":{"enabled":true},"high":{"enabled":true},"cinematic":{"enabled":true}},"accessibility":{"reducedMotionSafe":true,"highContrastSafe":true,"notes":"","photosensitiveSafe":true},"provenance":{"author":"Mike — Axiom/Mir","origin":"AXM AetherFX Visual Effect Fabric v1.1.0 working foundation","license":"UNSET — choose before public sharing","created":"2026-07-28","sourceIntegrity":"Generated locally from this package; no external runtime dependency."}},{"id":"focus.halo","name":"Focus Halo","version":"1.1.0","schema":"axm.visual-module/1","kind":"effect","category":"Focus + Depth","status":"WORKING","description":"A halo ring around active controls and current points of attention.","tags":["focus","halo","accessibility"],"dependencies":["primitive.glow","primitive.mask","primitive.opacity"],"exclusiveGroup":null,"shareable":true,"ui":{"icon":"target"},"parameters":[{"id":"intensity","label":"Intensity","type":"number","default":0.58,"description":"","min":0,"max":1,"step":0.01,"cssVar":"--fx-focus-intensity"},{"id":"spread","label":"Spread","type":"number","default":10,"description":"","min":0,"max":30,"step":1,"unit":"px","cssVar":"--fx-focus-spread"},{"id":"softness","label":"Softness","type":"number","default":0.62,"description":"","min":0,"max":1,"step":0.01,"cssVar":"--fx-focus-softness"}],"renderer":{"type":"class","scope":"active","className":"fx-focus-halo"},"quality":{"low":{"enabled":true},"medium":{"enabled":true},"high":{"enabled":true},"cinematic":{"enabled":true}},"accessibility":{"reducedMotionSafe":true,"highContrastSafe":true,"notes":"","photosensitiveSafe":true},"provenance":{"author":"Mike — Axiom/Mir","origin":"AXM AetherFX Visual Effect Fabric v1.1.0 working foundation","license":"UNSET — choose before public sharing","created":"2026-07-28","sourceIntegrity":"Generated locally from this package; no external runtime dependency."}},{"id":"depth.layered-shadow","name":"Layered Depth Shadow","version":"1.1.0","schema":"axm.visual-module/1","kind":"effect","category":"Focus + Depth","status":"WORKING","description":"Multi-band shadow treatment for perceived depth without excessive darkness.","tags":["depth","shadow","elevation"],"dependencies":["primitive.shadow","primitive.opacity"],"exclusiveGroup":null,"shareable":true,"ui":{"icon":"layers"},"parameters":[{"id":"distance","label":"Distance","type":"number","default":18,"description":"","min":0,"max":52,"step":1,"unit":"px","cssVar":"--fx-shadow-distance"},{"id":"softness","label":"Softness","type":"number","default":34,"description":"","min":4,"max":90,"step":1,"unit":"px","cssVar":"--fx-shadow-softness"},{"id":"opacity","label":"Opacity","type":"number","default":0.46,"description":"","min":0,"max":0.9,"step":0.01,"cssVar":"--fx-shadow-opacity"}],"renderer":{"type":"class","scope":"surface","className":"fx-depth-shadow"},"quality":{"low":{"enabled":true},"medium":{"enabled":true},"high":{"enabled":true},"cinematic":{"enabled":true}},"accessibility":{"reducedMotionSafe":true,"highContrastSafe":true,"notes":"","photosensitiveSafe":true},"provenance":{"author":"Mike — Axiom/Mir","origin":"AXM AetherFX Visual Effect Fabric v1.1.0 working foundation","license":"UNSET — choose before public sharing","created":"2026-07-28","sourceIntegrity":"Generated locally from this package; no external runtime dependency."}},{"id":"depth.multi-plane","name":"Multi-plane Parallax","version":"1.1.0","schema":"axm.visual-module/1","kind":"effect","category":"Focus + Depth","status":"WORKING","description":"Separates foreground, interface, and ambient planes with bounded pointer parallax.","tags":["depth","parallax","interactive"],"dependencies":["primitive.transform","primitive.motion-curve"],"exclusiveGroup":null,"shareable":true,"ui":{"icon":"stack"},"parameters":[{"id":"distance","label":"Distance","type":"number","default":10,"description":"","min":0,"max":26,"step":1,"unit":"px","cssVar":"--fx-parallax-distance"},{"id":"damping","label":"Damping","type":"number","default":0.12,"description":"","min":0.03,"max":0.4,"step":0.01,"cssVar":"--fx-parallax-damping"}],"renderer":{"type":"interaction","scope":"stage","className":"fx-multi-plane","interactive":"parallax"},"quality":{"low":{"enabled":false,"fallbackModuleId":"depth.layered-shadow"},"medium":{"enabled":true},"high":{"enabled":true},"cinematic":{"enabled":true}},"accessibility":{"reducedMotionSafe":true,"highContrastSafe":true,"notes":"","photosensitiveSafe":true},"provenance":{"author":"Mike — Axiom/Mir","origin":"AXM AetherFX Visual Effect Fabric v1.1.0 working foundation","license":"UNSET — choose before public sharing","created":"2026-07-28","sourceIntegrity":"Generated locally from this package; no external runtime dependency."}},{"id":"depth.inner-inset","name":"Inner Inset Depth","version":"1.1.0","schema":"axm.visual-module/1","kind":"effect","category":"Focus + Depth","status":"WORKING","description":"A subtle inner shadow and highlight pair that makes controls feel machined.","tags":["depth","inset","surface"],"dependencies":["primitive.shadow","primitive.gradient"],"exclusiveGroup":null,"shareable":true,"ui":{"icon":"inset"},"parameters":[{"id":"intensity","label":"Intensity","type":"number","default":0.34,"description":"","min":0,"max":1,"step":0.01,"cssVar":"--fx-inset-intensity"},{"id":"size","label":"Size","type":"number","default":12,"description":"","min":2,"max":28,"step":1,"unit":"px","cssVar":"--fx-inset-size"}],"renderer":{"type":"class","scope":"surface","className":"fx-inner-inset"},"quality":{"low":{"enabled":true},"medium":{"enabled":true},"high":{"enabled":true},"cinematic":{"enabled":true}},"accessibility":{"reducedMotionSafe":true,"highContrastSafe":true,"notes":"","photosensitiveSafe":true},"provenance":{"author":"Mike — Axiom/Mir","origin":"AXM AetherFX Visual Effect Fabric v1.1.0 working foundation","license":"UNSET — choose before public sharing","created":"2026-07-28","sourceIntegrity":"Generated locally from this package; no external runtime dependency."}},{"id":"focus.attention-beacon","name":"Attention Beacon","version":"1.1.0","schema":"axm.visual-module/1","kind":"effect","category":"Focus + Depth","status":"WORKING","description":"A restrained beacon for important active states; never flashes rapidly.","tags":["focus","attention","signal"],"dependencies":["primitive.glow","primitive.opacity","primitive.motion-curve"],"exclusiveGroup":null,"shareable":true,"ui":{"icon":"beacon"},"parameters":[{"id":"intensity","label":"Intensity","type":"number","default":0.46,"description":"","min":0,"max":1,"step":0.01,"cssVar":"--fx-beacon-intensity"},{"id":"speed","label":"Speed","type":"number","default":3.8,"description":"","min":2.5,"max":12,"step":0.1,"unit":"s","cssVar":"--fx-beacon-speed"}],"renderer":{"type":"class","scope":"active","className":"fx-attention-beacon"},"quality":{"low":{"enabled":true},"medium":{"enabled":true},"high":{"enabled":true},"cinematic":{"enabled":true}},"accessibility":{"reducedMotionSafe":true,"highContrastSafe":true,"notes":"Speed is clamped above 2.5 seconds and becomes static under reduced motion.","photosensitiveSafe":true},"provenance":{"author":"Mike — Axiom/Mir","origin":"AXM AetherFX Visual Effect Fabric v1.1.0 working foundation","license":"UNSET — choose before public sharing","created":"2026-07-28","sourceIntegrity":"Generated locally from this package; no external runtime dependency."}},{"id":"atmosphere.ambient-field","name":"Ambient Atmosphere Field","version":"1.1.0","schema":"axm.visual-module/1","kind":"effect","category":"Atmosphere","status":"WORKING","description":"A low-density field of luminous particles and blurred depth motes.","tags":["atmosphere","particles","ambient"],"dependencies":["primitive.noise","primitive.glow","primitive.opacity","primitive.transform"],"exclusiveGroup":null,"shareable":true,"ui":{"icon":"stars"},"parameters":[{"id":"density","label":"Density","type":"number","default":0.46,"description":"","min":0,"max":1,"step":0.01,"cssVar":"--fx-particle-density"},{"id":"intensity","label":"Intensity","type":"number","default":0.36,"description":"","min":0,"max":1,"step":0.01,"cssVar":"--fx-particle-intensity"},{"id":"parallax","label":"Parallax","type":"number","default":0.38,"description":"","min":0,"max":1,"step":0.01,"cssVar":"--fx-particle-parallax"}],"renderer":{"type":"overlay","scope":"ambient","className":"fx-overlay-particles","generatedCount":24},"quality":{"low":{"enabled":true,"parameterOverrides":{"density":0.16,"parallax":0}},"medium":{"enabled":true,"parameterOverrides":{"density":0.34}},"high":{"enabled":true},"cinematic":{"enabled":true,"parameterOverrides":{"density":0.7}}},"accessibility":{"reducedMotionSafe":true,"highContrastSafe":true,"notes":"","photosensitiveSafe":true},"provenance":{"author":"Mike — Axiom/Mir","origin":"AXM AetherFX Visual Effect Fabric v1.1.0 working foundation","license":"UNSET — choose before public sharing","created":"2026-07-28","sourceIntegrity":"Generated locally from this package; no external runtime dependency."}},{"id":"atmosphere.scanlines","name":"Soft Scanlines","version":"1.1.0","schema":"axm.visual-module/1","kind":"effect","category":"Atmosphere","status":"WORKING","description":"Very fine scanline texture for holographic or display-surface character.","tags":["atmosphere","scanlines","texture"],"dependencies":["primitive.mask","primitive.opacity"],"exclusiveGroup":null,"shareable":true,"ui":{"icon":"scan"},"parameters":[{"id":"opacity","label":"Opacity","type":"number","default":0.12,"description":"","min":0,"max":0.45,"step":0.01,"cssVar":"--fx-scanline-opacity"},{"id":"spacing","label":"Spacing","type":"number","default":4,"description":"","min":2,"max":12,"step":1,"unit":"px","cssVar":"--fx-scanline-spacing"}],"renderer":{"type":"overlay","scope":"atmosphere","className":"fx-overlay-scanlines"},"quality":{"low":{"enabled":false},"medium":{"enabled":true},"high":{"enabled":true},"cinematic":{"enabled":true}},"accessibility":{"reducedMotionSafe":true,"highContrastSafe":true,"notes":"","photosensitiveSafe":true},"provenance":{"author":"Mike — Axiom/Mir","origin":"AXM AetherFX Visual Effect Fabric v1.1.0 working foundation","license":"UNSET — choose before public sharing","created":"2026-07-28","sourceIntegrity":"Generated locally from this package; no external runtime dependency."}},{"id":"atmosphere.vignette","name":"Cinematic Vignette","version":"1.1.0","schema":"axm.visual-module/1","kind":"effect","category":"Atmosphere","status":"WORKING","description":"Darkens the outer frame to preserve focal hierarchy and light contrast.","tags":["atmosphere","vignette","focus"],"dependencies":["primitive.gradient","primitive.mask","primitive.opacity"],"exclusiveGroup":null,"shareable":true,"ui":{"icon":"vignette"},"parameters":[{"id":"intensity","label":"Intensity","type":"number","default":0.38,"description":"","min":0,"max":0.85,"step":0.01,"cssVar":"--fx-vignette-intensity"},{"id":"size","label":"Size","type":"number","default":68,"description":"","min":35,"max":95,"step":1,"unit":"%","cssVar":"--fx-vignette-size"}],"renderer":{"type":"overlay","scope":"atmosphere","className":"fx-overlay-vignette"},"quality":{"low":{"enabled":true},"medium":{"enabled":true},"high":{"enabled":true},"cinematic":{"enabled":true}},"accessibility":{"reducedMotionSafe":true,"highContrastSafe":true,"notes":"","photosensitiveSafe":true},"provenance":{"author":"Mike — Axiom/Mir","origin":"AXM AetherFX Visual Effect Fabric v1.1.0 working foundation","license":"UNSET — choose before public sharing","created":"2026-07-28","sourceIntegrity":"Generated locally from this package; no external runtime dependency."}},{"id":"atmosphere.film-noise","name":"Controlled Film Noise","version":"1.1.0","schema":"axm.visual-module/1","kind":"effect","category":"Atmosphere","status":"WORKING","description":"Fine monochrome grain that prevents large gradients from feeling sterile.","tags":["atmosphere","grain","texture"],"dependencies":["primitive.noise","primitive.opacity","primitive.blend"],"exclusiveGroup":null,"shareable":true,"ui":{"icon":"noise"},"parameters":[{"id":"opacity","label":"Opacity","type":"number","default":0.055,"description":"","min":0,"max":0.25,"step":0.005,"cssVar":"--fx-noise-opacity"},{"id":"scale","label":"Scale","type":"number","default":1,"description":"","min":0.5,"max":3,"step":0.1,"cssVar":"--fx-noise-scale"}],"renderer":{"type":"overlay","scope":"atmosphere","className":"fx-overlay-noise"},"quality":{"low":{"enabled":false},"medium":{"enabled":true},"high":{"enabled":true},"cinematic":{"enabled":true}},"accessibility":{"reducedMotionSafe":true,"highContrastSafe":true,"notes":"","photosensitiveSafe":true},"provenance":{"author":"Mike — Axiom/Mir","origin":"AXM AetherFX Visual Effect Fabric v1.1.0 working foundation","license":"UNSET — choose before public sharing","created":"2026-07-28","sourceIntegrity":"Generated locally from this package; no external runtime dependency."}},{"id":"atmosphere.light-leak","name":"Edge Light Leak","version":"1.1.0","schema":"axm.visual-module/1","kind":"effect","category":"Atmosphere","status":"WORKING","description":"Soft off-axis light leak for cinematic transitions and warmer scene edges.","tags":["atmosphere","light-leak","cinematic"],"dependencies":["primitive.gradient","primitive.blur","primitive.opacity"],"exclusiveGroup":null,"shareable":true,"ui":{"icon":"flare"},"parameters":[{"id":"intensity","label":"Intensity","type":"number","default":0.22,"description":"","min":0,"max":0.7,"step":0.01,"cssVar":"--fx-leak-intensity"},{"id":"position","label":"Position","type":"number","default":22,"description":"","min":0,"max":100,"step":1,"unit":"%","cssVar":"--fx-leak-position"}],"renderer":{"type":"overlay","scope":"atmosphere","className":"fx-overlay-light-leak"},"quality":{"low":{"enabled":true},"medium":{"enabled":true},"high":{"enabled":true},"cinematic":{"enabled":true}},"accessibility":{"reducedMotionSafe":true,"highContrastSafe":true,"notes":"","photosensitiveSafe":true},"provenance":{"author":"Mike — Axiom/Mir","origin":"AXM AetherFX Visual Effect Fabric v1.1.0 working foundation","license":"UNSET — choose before public sharing","created":"2026-07-28","sourceIntegrity":"Generated locally from this package; no external runtime dependency."}},{"id":"mold.command-dashboard","name":"Command Dashboard Mold","version":"1.1.0","schema":"axm.visual-module/1","kind":"mold","category":"Scene Molds","status":"WORKING","description":"Balanced premium dashboard stack with material, depth, focus, and ambient light.","tags":["mold","dashboard","composite"],"dependencies":["material.aetherglass","light.neon-edge-glow","light.ambient-backwash","depth.layered-shadow","motion.hover-lift","focus.halo","atmosphere.vignette","atmosphere.ambient-field"],"exclusiveGroup":null,"shareable":true,"ui":{"icon":"dashboard"},"parameters":[],"renderer":{"type":"composite","layers":[{"moduleId":"material.aetherglass","params":{"opacity":0.78,"blur":18,"edge":0.56}},{"moduleId":"light.neon-edge-glow","params":{"intensity":0.54,"spread":15}},{"moduleId":"light.ambient-backwash","params":{"intensity":0.34}},{"moduleId":"depth.layered-shadow","params":{"distance":18,"softness":36}},{"moduleId":"motion.hover-lift","params":{"height":5}},{"moduleId":"focus.halo","params":{"intensity":0.5}},{"moduleId":"atmosphere.vignette","params":{"intensity":0.34}},{"moduleId":"atmosphere.ambient-field","params":{"density":0.38}}]},"quality":{"low":{"enabled":true},"medium":{"enabled":true},"high":{"enabled":true},"cinematic":{"enabled":true}},"accessibility":{"reducedMotionSafe":true,"highContrastSafe":true,"notes":"","photosensitiveSafe":true},"provenance":{"author":"Mike — Axiom/Mir","origin":"AXM AetherFX Visual Effect Fabric v1.1.0 working foundation","license":"UNSET — choose before public sharing","created":"2026-07-28","sourceIntegrity":"Generated locally from this package; no external runtime dependency."}},{"id":"mold.luminous-hero","name":"Luminous Hero Mold","version":"1.1.0","schema":"axm.visual-module/1","kind":"mold","category":"Scene Molds","status":"WORKING","description":"Cinematic hero presentation with backwash, beam illusion, reflection, and restrained atmosphere.","tags":["mold","hero","composite"],"dependencies":["material.dark-shell","light.ambient-backwash","light.volumetric-beam","light.reflection-streak","light.rim","motion.entry-reveal","atmosphere.film-noise","atmosphere.vignette"],"exclusiveGroup":null,"shareable":true,"ui":{"icon":"hero"},"parameters":[],"renderer":{"type":"composite","layers":[{"moduleId":"material.dark-shell","params":{"depth":0.72}},{"moduleId":"light.ambient-backwash","params":{"intensity":0.5,"spread":94}},{"moduleId":"light.volumetric-beam","params":{"intensity":0.26,"angle":16}},{"moduleId":"light.reflection-streak","params":{"intensity":0.38,"speed":8}},{"moduleId":"light.rim","params":{"intensity":0.62}},{"moduleId":"motion.entry-reveal","params":{"duration":720}},{"moduleId":"atmosphere.film-noise","params":{"opacity":0.045}},{"moduleId":"atmosphere.vignette","params":{"intensity":0.42}}]},"quality":{"low":{"enabled":true},"medium":{"enabled":true},"high":{"enabled":true},"cinematic":{"enabled":true}},"accessibility":{"reducedMotionSafe":true,"highContrastSafe":true,"notes":"","photosensitiveSafe":true},"provenance":{"author":"Mike — Axiom/Mir","origin":"AXM AetherFX Visual Effect Fabric v1.1.0 working foundation","license":"UNSET — choose before public sharing","created":"2026-07-28","sourceIntegrity":"Generated locally from this package; no external runtime dependency."}},{"id":"mold.game-hud","name":"Game HUD Mold","version":"1.1.0","schema":"axm.visual-module/1","kind":"mold","category":"Scene Molds","status":"WORKING","description":"Readable game HUD stack with acrylic surfaces, focus beacons, scan texture, and responsive feedback.","tags":["mold","hud","game","composite"],"dependencies":["material.neon-acrylic","light.neon-edge-glow","motion.idle-pulse","motion.click-ripple","focus.attention-beacon","depth.inner-inset","atmosphere.scanlines"],"exclusiveGroup":null,"shareable":true,"ui":{"icon":"gamepad"},"parameters":[],"renderer":{"type":"composite","layers":[{"moduleId":"material.neon-acrylic","params":{"opacity":0.9,"edge":0.7}},{"moduleId":"light.neon-edge-glow","params":{"intensity":0.66,"width":1.5}},{"moduleId":"motion.idle-pulse","params":{"speed":5.4,"scale":1.01}},{"moduleId":"motion.click-ripple","params":{"intensity":0.42}},{"moduleId":"focus.attention-beacon","params":{"intensity":0.38}},{"moduleId":"depth.inner-inset","params":{"intensity":0.42}},{"moduleId":"atmosphere.scanlines","params":{"opacity":0.09}}]},"quality":{"low":{"enabled":true},"medium":{"enabled":true},"high":{"enabled":true},"cinematic":{"enabled":true}},"accessibility":{"reducedMotionSafe":true,"highContrastSafe":true,"notes":"","photosensitiveSafe":true},"provenance":{"author":"Mike — Axiom/Mir","origin":"AXM AetherFX Visual Effect Fabric v1.1.0 working foundation","license":"UNSET — choose before public sharing","created":"2026-07-28","sourceIntegrity":"Generated locally from this package; no external runtime dependency."}},{"id":"mold.launcher-shell","name":"Launcher Shell Mold","version":"1.1.0","schema":"axm.visual-module/1","kind":"mold","category":"Scene Molds","status":"WORKING","description":"Calm high-clarity launcher with frosted surfaces, loading shimmer, and low-cost depth.","tags":["mold","launcher","composite"],"dependencies":["material.frosted-panel","material.metal-trim","light.corner-flares","motion.loading-shimmer","motion.hover-lift","depth.layered-shadow","atmosphere.film-noise"],"exclusiveGroup":null,"shareable":true,"ui":{"icon":"launcher"},"parameters":[],"renderer":{"type":"composite","layers":[{"moduleId":"material.frosted-panel","params":{"opacity":0.86,"blur":22}},{"moduleId":"material.metal-trim","params":{"brightness":0.4,"width":1}},{"moduleId":"light.corner-flares","params":{"intensity":0.32}},{"moduleId":"motion.loading-shimmer","params":{"speed":3.2,"opacity":0.34}},{"moduleId":"motion.hover-lift","params":{"height":4}},{"moduleId":"depth.layered-shadow","params":{"distance":14,"softness":30}},{"moduleId":"atmosphere.film-noise","params":{"opacity":0.035}}]},"quality":{"low":{"enabled":true},"medium":{"enabled":true},"high":{"enabled":true},"cinematic":{"enabled":true}},"accessibility":{"reducedMotionSafe":true,"highContrastSafe":true,"notes":"","photosensitiveSafe":true},"provenance":{"author":"Mike — Axiom/Mir","origin":"AXM AetherFX Visual Effect Fabric v1.1.0 working foundation","license":"UNSET — choose before public sharing","created":"2026-07-28","sourceIntegrity":"Generated locally from this package; no external runtime dependency."}},{"id":"scene.dashboard","name":"Command Dashboard","version":"1.1.0","schema":"axm.visual-module/1","kind":"scene","category":"Scenes","status":"WORKING","description":"Dashboard preview with metrics, navigation, cards, and active status.","tags":["scene","dashboard"],"dependencies":[],"exclusiveGroup":null,"shareable":true,"ui":{"icon":"dashboard"},"parameters":[],"renderer":{"type":"scene","sceneRenderer":"dashboard"},"quality":{"low":{"enabled":true},"medium":{"enabled":true},"high":{"enabled":true},"cinematic":{"enabled":true}},"accessibility":{"reducedMotionSafe":true,"highContrastSafe":true,"notes":"","photosensitiveSafe":true},"provenance":{"author":"Mike — Axiom/Mir","origin":"AXM AetherFX Visual Effect Fabric v1.1.0 working foundation","license":"UNSET — choose before public sharing","created":"2026-07-28","sourceIntegrity":"Generated locally from this package; no external runtime dependency."}},{"id":"scene.hero","name":"Luminous Website Hero","version":"1.1.0","schema":"axm.visual-module/1","kind":"scene","category":"Scenes","status":"WORKING","description":"Marketing hero preview with focal copy, call-to-action, and visual object.","tags":["scene","hero","website"],"dependencies":[],"exclusiveGroup":null,"shareable":true,"ui":{"icon":"hero"},"parameters":[],"renderer":{"type":"scene","sceneRenderer":"hero"},"quality":{"low":{"enabled":true},"medium":{"enabled":true},"high":{"enabled":true},"cinematic":{"enabled":true}},"accessibility":{"reducedMotionSafe":true,"highContrastSafe":true,"notes":"","photosensitiveSafe":true},"provenance":{"author":"Mike — Axiom/Mir","origin":"AXM AetherFX Visual Effect Fabric v1.1.0 working foundation","license":"UNSET — choose before public sharing","created":"2026-07-28","sourceIntegrity":"Generated locally from this package; no external runtime dependency."}},{"id":"scene.hud","name":"Game HUD","version":"1.1.0","schema":"axm.visual-module/1","kind":"scene","category":"Scenes","status":"WORKING","description":"Game interface preview with score, health, radar, and mission status.","tags":["scene","hud","game"],"dependencies":[],"exclusiveGroup":null,"shareable":true,"ui":{"icon":"gamepad"},"parameters":[],"renderer":{"type":"scene","sceneRenderer":"hud"},"quality":{"low":{"enabled":true},"medium":{"enabled":true},"high":{"enabled":true},"cinematic":{"enabled":true}},"accessibility":{"reducedMotionSafe":true,"highContrastSafe":true,"notes":"","photosensitiveSafe":true},"provenance":{"author":"Mike — Axiom/Mir","origin":"AXM AetherFX Visual Effect Fabric v1.1.0 working foundation","license":"UNSET — choose before public sharing","created":"2026-07-28","sourceIntegrity":"Generated locally from this package; no external runtime dependency."}},{"id":"scene.launcher","name":"Local Launcher","version":"1.1.0","schema":"axm.visual-module/1","kind":"scene","category":"Scenes","status":"WORKING","description":"Local-first launcher preview with module cards, progress, and status.","tags":["scene","launcher","local"],"dependencies":[],"exclusiveGroup":null,"shareable":true,"ui":{"icon":"launcher"},"parameters":[],"renderer":{"type":"scene","sceneRenderer":"launcher"},"quality":{"low":{"enabled":true},"medium":{"enabled":true},"high":{"enabled":true},"cinematic":{"enabled":true}},"accessibility":{"reducedMotionSafe":true,"highContrastSafe":true,"notes":"","photosensitiveSafe":true},"provenance":{"author":"Mike — Axiom/Mir","origin":"AXM AetherFX Visual Effect Fabric v1.1.0 working foundation","license":"UNSET — choose before public sharing","created":"2026-07-28","sourceIntegrity":"Generated locally from this package; no external runtime dependency."}},{"id":"material.liquid-glass","name":"Liquid Glass Surface","version":"1.1.0","schema":"axm.visual-module/1","kind":"organ","category":"Materials","status":"WORKING","description":"A layered glass surface with soft refraction-like highlights and controlled internal depth.","tags":["material","glass","liquid","surface"],"dependencies":["primitive.blur","primitive.gradient","primitive.filter","primitive.shadow"],"exclusiveGroup":"material","shareable":true,"ui":{"icon":"droplet"},"parameters":[{"id":"opacity","label":"Opacity","type":"number","default":0.72,"description":"","min":0,"max":1,"step":0.01,"cssVar":"--fx-liquid-opacity"},{"id":"blur","label":"Refraction blur","type":"number","default":24,"description":"","min":0,"max":64,"step":1,"unit":"px","cssVar":"--fx-liquid-blur"},{"id":"distortion","label":"Distortion","type":"number","default":0.32,"description":"","min":0,"max":1,"step":0.01,"cssVar":"--fx-liquid-distortion"},{"id":"edge","label":"Edge energy","type":"number","default":0.48,"description":"","min":0,"max":1,"step":0.01,"cssVar":"--fx-liquid-edge"}],"renderer":{"type":"class","scope":"surface","className":"fx-material-liquid-glass"},"quality":{"low":{"enabled":true,"parameterOverrides":{"blur":8,"distortion":0}},"medium":{"enabled":true,"parameterOverrides":{"blur":16}},"high":{"enabled":true},"cinematic":{"enabled":true,"parameterOverrides":{"distortion":0.46}}},"accessibility":{"reducedMotionSafe":true,"highContrastSafe":true,"notes":"","photosensitiveSafe":true},"provenance":{"author":"Mike — Axiom/Mir","origin":"AXM AetherFX Visual Effect Fabric v1.1.0 steward upgrade","license":"UNSET — choose before public sharing","created":"2026-07-28","sourceIntegrity":"Generated locally from this package; no external runtime dependency."}},{"id":"material.crystal-prism","name":"Crystal Prism Surface","version":"1.1.0","schema":"axm.visual-module/1","kind":"organ","category":"Materials","status":"WORKING","description":"A restrained crystalline surface that separates edge light into prismatic spectral hints.","tags":["material","crystal","prism","surface"],"dependencies":["primitive.gradient","primitive.glow","primitive.blend"],"exclusiveGroup":"material","shareable":true,"ui":{"icon":"diamond"},"parameters":[{"id":"intensity","label":"Prism intensity","type":"number","default":0.34,"description":"","min":0,"max":1,"step":0.01,"cssVar":"--fx-crystal-intensity"},{"id":"facet","label":"Facet scale","type":"number","default":42,"description":"","min":12,"max":120,"step":1,"unit":"px","cssVar":"--fx-crystal-facet"},{"id":"edge","label":"Edge clarity","type":"number","default":0.58,"description":"","min":0,"max":1,"step":0.01,"cssVar":"--fx-crystal-edge"},{"id":"tint","label":"Crystal tint","type":"color","default":"#a9efff","description":"","cssVar":"--fx-crystal-tint"}],"renderer":{"type":"class","scope":"surface","className":"fx-material-crystal-prism"},"quality":{"low":{"enabled":true,"fallbackModuleId":"material.aetherglass"},"medium":{"enabled":true,"parameterOverrides":{"intensity":0.2}},"high":{"enabled":true},"cinematic":{"enabled":true,"parameterOverrides":{"intensity":0.48}}},"accessibility":{"reducedMotionSafe":true,"highContrastSafe":true,"notes":"","photosensitiveSafe":true},"provenance":{"author":"Mike — Axiom/Mir","origin":"AXM AetherFX Visual Effect Fabric v1.1.0 steward upgrade","license":"UNSET — choose before public sharing","created":"2026-07-28","sourceIntegrity":"Generated locally from this package; no external runtime dependency."}},{"id":"light.prismatic-dispersion","name":"Prismatic Dispersion","version":"1.1.0","schema":"axm.visual-module/1","kind":"effect","category":"Light","status":"WORKING","description":"A spectral light split that suggests glass dispersion without heavy shader code.","tags":["light","prism","dispersion","spectral"],"dependencies":["primitive.gradient","primitive.blur","primitive.blend"],"exclusiveGroup":null,"shareable":true,"ui":{"icon":"rainbow"},"parameters":[{"id":"intensity","label":"Intensity","type":"number","default":0.28,"description":"","min":0,"max":0.8,"step":0.01,"cssVar":"--fx-prism-intensity"},{"id":"spread","label":"Spread","type":"number","default":22,"description":"","min":4,"max":80,"step":1,"unit":"px","cssVar":"--fx-prism-spread"},{"id":"angle","label":"Angle","type":"number","default":18,"description":"","min":-180,"max":180,"step":1,"unit":"deg","cssVar":"--fx-prism-angle"},{"id":"position","label":"Position","type":"number","default":58,"description":"","min":0,"max":100,"step":1,"unit":"%","cssVar":"--fx-prism-position"}],"renderer":{"type":"overlay","scope":"light","className":"fx-overlay-prism"},"quality":{"low":{"enabled":false,"fallbackModuleId":"light.neon-edge-glow"},"medium":{"enabled":true,"parameterOverrides":{"intensity":0.16}},"high":{"enabled":true},"cinematic":{"enabled":true,"parameterOverrides":{"intensity":0.4}}},"accessibility":{"reducedMotionSafe":true,"highContrastSafe":true,"notes":"","photosensitiveSafe":true},"provenance":{"author":"Mike — Axiom/Mir","origin":"AXM AetherFX Visual Effect Fabric v1.1.0 steward upgrade","license":"UNSET — choose before public sharing","created":"2026-07-28","sourceIntegrity":"Generated locally from this package; no external runtime dependency."}},{"id":"light.caustic-ripples","name":"Caustic Light Ripples","version":"1.1.0","schema":"axm.visual-module/1","kind":"effect","category":"Light","status":"WORKING","description":"Animated soft light interference that mimics reflections from water or curved glass.","tags":["light","caustics","water","glass"],"dependencies":["primitive.gradient","primitive.blur","primitive.motion-curve"],"exclusiveGroup":null,"shareable":true,"ui":{"icon":"waves"},"parameters":[{"id":"intensity","label":"Intensity","type":"number","default":0.22,"description":"","min":0,"max":0.7,"step":0.01,"cssVar":"--fx-caustic-intensity"},{"id":"scale","label":"Scale","type":"number","default":86,"description":"","min":30,"max":180,"step":1,"unit":"px","cssVar":"--fx-caustic-scale"},{"id":"speed","label":"Speed","type":"number","default":12,"description":"","min":3,"max":30,"step":0.5,"unit":"s","cssVar":"--fx-caustic-speed"},{"id":"softness","label":"Softness","type":"number","default":10,"description":"","min":0,"max":30,"step":1,"unit":"px","cssVar":"--fx-caustic-softness"}],"renderer":{"type":"overlay","scope":"light","className":"fx-overlay-caustics"},"quality":{"low":{"enabled":false,"fallbackModuleId":"light.ambient-backwash"},"medium":{"enabled":true,"parameterOverrides":{"intensity":0.12}},"high":{"enabled":true},"cinematic":{"enabled":true,"parameterOverrides":{"intensity":0.34}}},"accessibility":{"reducedMotionSafe":false,"highContrastSafe":true,"notes":"Reduced-motion mode freezes the pattern.","photosensitiveSafe":false},"provenance":{"author":"Mike — Axiom/Mir","origin":"AXM AetherFX Visual Effect Fabric v1.1.0 steward upgrade","license":"UNSET — choose before public sharing","created":"2026-07-28","sourceIntegrity":"Generated locally from this package; no external runtime dependency."}},{"id":"light.godray-fan","name":"God-Ray Fan Illusion","version":"1.1.0","schema":"axm.visual-module/1","kind":"effect","category":"Light","status":"WORKING","description":"A controlled fan of soft beams for cinematic hierarchy without a volumetric renderer.","tags":["light","godrays","beam","cinematic"],"dependencies":["primitive.gradient","primitive.mask","primitive.blur"],"exclusiveGroup":null,"shareable":true,"ui":{"icon":"sunrays"},"parameters":[{"id":"intensity","label":"Intensity","type":"number","default":0.24,"description":"","min":0,"max":0.75,"step":0.01,"cssVar":"--fx-godray-intensity"},{"id":"angle","label":"Fan angle","type":"number","default":18,"description":"","min":-90,"max":90,"step":1,"unit":"deg","cssVar":"--fx-godray-angle"},{"id":"spread","label":"Fan spread","type":"number","default":58,"description":"","min":20,"max":100,"step":1,"unit":"%","cssVar":"--fx-godray-spread"},{"id":"softness","label":"Softness","type":"number","default":18,"description":"","min":0,"max":40,"step":1,"unit":"px","cssVar":"--fx-godray-softness"}],"renderer":{"type":"overlay","scope":"light","className":"fx-overlay-godrays"},"quality":{"low":{"enabled":false,"fallbackModuleId":"light.volumetric-beam"},"medium":{"enabled":true,"parameterOverrides":{"intensity":0.14}},"high":{"enabled":true},"cinematic":{"enabled":true,"parameterOverrides":{"intensity":0.36}}},"accessibility":{"reducedMotionSafe":true,"highContrastSafe":true,"notes":"","photosensitiveSafe":true},"provenance":{"author":"Mike — Axiom/Mir","origin":"AXM AetherFX Visual Effect Fabric v1.1.0 steward upgrade","license":"UNSET — choose before public sharing","created":"2026-07-28","sourceIntegrity":"Generated locally from this package; no external runtime dependency."}},{"id":"light.aurora-wash","name":"Aurora Light Wash","version":"1.1.0","schema":"axm.visual-module/1","kind":"effect","category":"Light","status":"WORKING","description":"Layered blurred color fields that create an aurora-like ambient light wash.","tags":["light","aurora","ambient","gradient"],"dependencies":["primitive.gradient","primitive.blur","primitive.motion-curve"],"exclusiveGroup":null,"shareable":true,"ui":{"icon":"aurora"},"parameters":[{"id":"intensity","label":"Intensity","type":"number","default":0.28,"description":"","min":0,"max":0.8,"step":0.01,"cssVar":"--fx-aurora-intensity"},{"id":"scale","label":"Scale","type":"number","default":110,"description":"","min":50,"max":180,"step":1,"unit":"%","cssVar":"--fx-aurora-scale"},{"id":"speed","label":"Drift speed","type":"number","default":18,"description":"","min":6,"max":40,"step":0.5,"unit":"s","cssVar":"--fx-aurora-speed"},{"id":"softness","label":"Softness","type":"number","default":32,"description":"","min":8,"max":80,"step":1,"unit":"px","cssVar":"--fx-aurora-softness"}],"renderer":{"type":"overlay","scope":"ambient","className":"fx-overlay-aurora"},"quality":{"low":{"enabled":false,"fallbackModuleId":"light.ambient-backwash"},"medium":{"enabled":true,"parameterOverrides":{"intensity":0.16}},"high":{"enabled":true},"cinematic":{"enabled":true,"parameterOverrides":{"intensity":0.42}}},"accessibility":{"reducedMotionSafe":false,"highContrastSafe":true,"notes":"Reduced-motion mode freezes the aurora wash.","photosensitiveSafe":false},"provenance":{"author":"Mike — Axiom/Mir","origin":"AXM AetherFX Visual Effect Fabric v1.1.0 steward upgrade","license":"UNSET — choose before public sharing","created":"2026-07-28","sourceIntegrity":"Generated locally from this package; no external runtime dependency."}},{"id":"atmosphere.depth-fog","name":"Depth Fog Layers","version":"1.1.0","schema":"axm.visual-module/1","kind":"effect","category":"Atmosphere","status":"WORKING","description":"A multi-band fog field that separates foreground, interface, and background depth.","tags":["atmosphere","fog","depth","layering"],"dependencies":["primitive.gradient","primitive.blur","primitive.opacity"],"exclusiveGroup":null,"shareable":true,"ui":{"icon":"fog"},"parameters":[{"id":"density","label":"Density","type":"number","default":0.3,"description":"","min":0,"max":0.8,"step":0.01,"cssVar":"--fx-fog-density"},{"id":"height","label":"Fog height","type":"number","default":54,"description":"","min":10,"max":100,"step":1,"unit":"%","cssVar":"--fx-fog-height"},{"id":"softness","label":"Softness","type":"number","default":36,"description":"","min":8,"max":90,"step":1,"unit":"px","cssVar":"--fx-fog-softness"},{"id":"color","label":"Fog tint","type":"color","default":"#6d7cff","description":"","cssVar":"--fx-fog-color"}],"renderer":{"type":"overlay","scope":"atmosphere","className":"fx-overlay-depth-fog"},"quality":{"low":{"enabled":true,"parameterOverrides":{"density":0.14,"softness":18}},"medium":{"enabled":true,"parameterOverrides":{"density":0.22}},"high":{"enabled":true},"cinematic":{"enabled":true,"parameterOverrides":{"density":0.42}}},"accessibility":{"reducedMotionSafe":true,"highContrastSafe":true,"notes":"","photosensitiveSafe":true},"provenance":{"author":"Mike — Axiom/Mir","origin":"AXM AetherFX Visual Effect Fabric v1.1.0 steward upgrade","license":"UNSET — choose before public sharing","created":"2026-07-28","sourceIntegrity":"Generated locally from this package; no external runtime dependency."}},{"id":"atmosphere.dust-motes","name":"Cinematic Dust Motes","version":"1.1.0","schema":"axm.visual-module/1","kind":"effect","category":"Atmosphere","status":"WORKING","description":"Sparse depth motes for scale and atmosphere, generated locally without image assets.","tags":["atmosphere","dust","particles","cinematic"],"dependencies":["primitive.noise","primitive.opacity","primitive.transform"],"exclusiveGroup":null,"shareable":true,"ui":{"icon":"dust"},"parameters":[{"id":"density","label":"Density","type":"number","default":0.34,"description":"","min":0,"max":1,"step":0.01,"cssVar":"--fx-dust-density"},{"id":"intensity","label":"Intensity","type":"number","default":0.28,"description":"","min":0,"max":1,"step":0.01,"cssVar":"--fx-dust-intensity"},{"id":"size","label":"Mote size","type":"number","default":1.4,"description":"","min":0.5,"max":4,"step":0.1,"unit":"px","cssVar":"--fx-dust-size"},{"id":"speed","label":"Drift speed","type":"number","default":16,"description":"","min":6,"max":40,"step":0.5,"unit":"s","cssVar":"--fx-dust-speed"}],"renderer":{"type":"overlay","scope":"atmosphere","className":"fx-overlay-dust","generatedCount":34,"particleMode":"dust"},"quality":{"low":{"enabled":false,"fallbackModuleId":"atmosphere.ambient-field"},"medium":{"enabled":true,"parameterOverrides":{"density":0.18}},"high":{"enabled":true},"cinematic":{"enabled":true,"parameterOverrides":{"density":0.6}}},"accessibility":{"reducedMotionSafe":false,"highContrastSafe":true,"notes":"Reduced-motion mode freezes the motes.","photosensitiveSafe":false},"provenance":{"author":"Mike — Axiom/Mir","origin":"AXM AetherFX Visual Effect Fabric v1.1.0 steward upgrade","license":"UNSET — choose before public sharing","created":"2026-07-28","sourceIntegrity":"Generated locally from this package; no external runtime dependency."}},{"id":"atmosphere.rain-glass","name":"Rain on Glass","version":"1.1.0","schema":"axm.visual-module/1","kind":"effect","category":"Atmosphere","status":"WORKING","description":"A subtle rain-on-glass overlay for moody screens, narrative scenes, and game menus.","tags":["atmosphere","rain","glass","narrative"],"dependencies":["primitive.gradient","primitive.blur","primitive.motion-curve"],"exclusiveGroup":null,"shareable":true,"ui":{"icon":"rain"},"parameters":[{"id":"intensity","label":"Intensity","type":"number","default":0.2,"description":"","min":0,"max":0.65,"step":0.01,"cssVar":"--fx-rain-intensity"},{"id":"density","label":"Density","type":"number","default":26,"description":"","min":8,"max":70,"step":1,"unit":"px","cssVar":"--fx-rain-density"},{"id":"angle","label":"Angle","type":"number","default":-14,"description":"","min":-45,"max":45,"step":1,"unit":"deg","cssVar":"--fx-rain-angle"},{"id":"speed","label":"Speed","type":"number","default":1.8,"description":"","min":0.6,"max":6,"step":0.1,"unit":"s","cssVar":"--fx-rain-speed"}],"renderer":{"type":"overlay","scope":"atmosphere","className":"fx-overlay-rain-glass"},"quality":{"low":{"enabled":false,"fallbackModuleId":"atmosphere.vignette"},"medium":{"enabled":true,"parameterOverrides":{"intensity":0.1}},"high":{"enabled":true},"cinematic":{"enabled":true,"parameterOverrides":{"intensity":0.32}}},"accessibility":{"reducedMotionSafe":false,"highContrastSafe":true,"notes":"Reduced-motion mode freezes the rain streaks.","photosensitiveSafe":false},"provenance":{"author":"Mike — Axiom/Mir","origin":"AXM AetherFX Visual Effect Fabric v1.1.0 steward upgrade","license":"UNSET — choose before public sharing","created":"2026-07-28","sourceIntegrity":"Generated locally from this package; no external runtime dependency."}},{"id":"motion.magnetic-response","name":"Magnetic Pointer Response","version":"1.1.0","schema":"axm.visual-module/1","kind":"effect","category":"Motion","status":"WORKING","description":"Subtle pointer-following offset that makes selected surfaces feel physically responsive.","tags":["motion","pointer","magnetic","interaction"],"dependencies":["primitive.transform","primitive.motion-curve"],"exclusiveGroup":null,"shareable":true,"ui":{"icon":"magnet"},"parameters":[{"id":"distance","label":"Response distance","type":"number","default":6,"description":"","min":0,"max":18,"step":0.5,"unit":"px","cssVar":"--fx-magnetic-distance"},{"id":"damping","label":"Damping","type":"number","default":0.16,"description":"","min":0.04,"max":0.4,"step":0.01,"cssVar":"--fx-magnetic-damping"},{"id":"tilt","label":"Tilt","type":"number","default":1.2,"description":"","min":0,"max":4,"step":0.1,"unit":"deg","cssVar":"--fx-magnetic-tilt"}],"renderer":{"type":"interaction","scope":"active","className":"fx-magnetic-response","interactive":"parallax"},"quality":{"low":{"enabled":false,"fallbackModuleId":"motion.hover-lift"},"medium":{"enabled":true,"parameterOverrides":{"distance":3}},"high":{"enabled":true},"cinematic":{"enabled":true}},"accessibility":{"reducedMotionSafe":false,"highContrastSafe":true,"notes":"Disabled in reduced-motion mode.","photosensitiveSafe":false},"provenance":{"author":"Mike — Axiom/Mir","origin":"AXM AetherFX Visual Effect Fabric v1.1.0 steward upgrade","license":"UNSET — choose before public sharing","created":"2026-07-28","sourceIntegrity":"Generated locally from this package; no external runtime dependency."}},{"id":"motion.spring-settle","name":"Spring Settle","version":"1.1.0","schema":"axm.visual-module/1","kind":"effect","category":"Motion","status":"WORKING","description":"A restrained spring-like settle on hover or focus, designed to feel tactile rather than bouncy.","tags":["motion","spring","hover","tactile"],"dependencies":["primitive.transform","primitive.motion-curve"],"exclusiveGroup":null,"shareable":true,"ui":{"icon":"spring"},"parameters":[{"id":"distance","label":"Lift distance","type":"number","default":4,"description":"","min":0,"max":12,"step":0.5,"unit":"px","cssVar":"--fx-spring-distance"},{"id":"duration","label":"Settle duration","type":"number","default":0.62,"description":"","min":0.2,"max":1.5,"step":0.01,"unit":"s","cssVar":"--fx-spring-duration"},{"id":"overshoot","label":"Overshoot","type":"number","default":1.018,"description":"","min":1,"max":1.08,"step":0.001,"cssVar":"--fx-spring-overshoot"}],"renderer":{"type":"class","scope":"active","className":"fx-spring-settle"},"quality":{"low":{"enabled":false,"fallbackModuleId":"motion.hover-lift"},"medium":{"enabled":true,"parameterOverrides":{"distance":2}},"high":{"enabled":true},"cinematic":{"enabled":true}},"accessibility":{"reducedMotionSafe":false,"highContrastSafe":true,"notes":"Disabled in reduced-motion mode.","photosensitiveSafe":false},"provenance":{"author":"Mike — Axiom/Mir","origin":"AXM AetherFX Visual Effect Fabric v1.1.0 steward upgrade","license":"UNSET — choose before public sharing","created":"2026-07-28","sourceIntegrity":"Generated locally from this package; no external runtime dependency."}},{"id":"focus.guidance-trail","name":"Guidance Light Trail","version":"1.1.0","schema":"axm.visual-module/1","kind":"effect","category":"Focus + Depth","status":"WORKING","description":"A soft directional highlight that guides attention toward an active control or focal area.","tags":["focus","guidance","trail","attention"],"dependencies":["primitive.gradient","primitive.blur","primitive.mask"],"exclusiveGroup":null,"shareable":true,"ui":{"icon":"trail"},"parameters":[{"id":"intensity","label":"Intensity","type":"number","default":0.3,"description":"","min":0,"max":0.8,"step":0.01,"cssVar":"--fx-guide-intensity"},{"id":"width","label":"Trail width","type":"number","default":38,"description":"","min":10,"max":90,"step":1,"unit":"%","cssVar":"--fx-guide-width"},{"id":"angle","label":"Angle","type":"number","default":-18,"description":"","min":-180,"max":180,"step":1,"unit":"deg","cssVar":"--fx-guide-angle"},{"id":"position","label":"Position","type":"number","default":64,"description":"","min":0,"max":100,"step":1,"unit":"%","cssVar":"--fx-guide-position"}],"renderer":{"type":"overlay","scope":"light","className":"fx-overlay-guidance"},"quality":{"low":{"enabled":false,"fallbackModuleId":"focus.halo"},"medium":{"enabled":true,"parameterOverrides":{"intensity":0.18}},"high":{"enabled":true},"cinematic":{"enabled":true,"parameterOverrides":{"intensity":0.42}}},"accessibility":{"reducedMotionSafe":true,"highContrastSafe":true,"notes":"","photosensitiveSafe":true},"provenance":{"author":"Mike — Axiom/Mir","origin":"AXM AetherFX Visual Effect Fabric v1.1.0 steward upgrade","license":"UNSET — choose before public sharing","created":"2026-07-28","sourceIntegrity":"Generated locally from this package; no external runtime dependency."}},{"id":"mold.cinematic-glass-stage","name":"Cinematic Glass Stage","version":"1.1.0","schema":"axm.visual-module/1","kind":"mold","category":"Scene Molds","status":"WORKING","description":"A reusable cinematic stage combining liquid glass, aurora light, depth fog, dust, and restrained guidance.","tags":["mold","cinematic","glass","atmosphere"],"dependencies":["material.liquid-glass","light.aurora-wash","atmosphere.depth-fog","atmosphere.dust-motes","focus.guidance-trail","depth.layered-shadow"],"exclusiveGroup":null,"shareable":true,"ui":{"icon":"stack"},"parameters":[],"renderer":{"type":"composite","layers":[{"moduleId":"material.liquid-glass","params":{"opacity":0.7,"blur":22,"distortion":0.28,"edge":0.46}},{"moduleId":"light.aurora-wash","params":{"intensity":0.24,"scale":118,"speed":22,"softness":38}},{"moduleId":"atmosphere.depth-fog","params":{"density":0.28,"height":58,"softness":42,"color":"#6576ff"}},{"moduleId":"atmosphere.dust-motes","params":{"density":0.28,"intensity":0.22,"size":1.3,"speed":20}},{"moduleId":"focus.guidance-trail","params":{"intensity":0.26,"width":42,"angle":-16,"position":66}},{"moduleId":"depth.layered-shadow","params":{"distance":20,"softness":42}}]},"quality":{"low":{"enabled":true},"medium":{"enabled":true},"high":{"enabled":true},"cinematic":{"enabled":true}},"accessibility":{"reducedMotionSafe":true,"highContrastSafe":true,"notes":"","photosensitiveSafe":true},"provenance":{"author":"Mike — Axiom/Mir","origin":"AXM AetherFX Visual Effect Fabric v1.1.0 steward upgrade","license":"UNSET — choose before public sharing","created":"2026-07-28","sourceIntegrity":"Generated locally from this package; no external runtime dependency."}},{"id":"mold.prismatic-product-card","name":"Prismatic Product Card","version":"1.1.0","schema":"axm.visual-module/1","kind":"mold","category":"Scene Molds","status":"WORKING","description":"A premium product-card mold built from crystal surface, prismatic dispersion, edge light, and tactile spring response.","tags":["mold","product","prism","card"],"dependencies":["material.crystal-prism","light.prismatic-dispersion","light.neon-edge-glow","motion.spring-settle","focus.halo"],"exclusiveGroup":null,"shareable":true,"ui":{"icon":"stack"},"parameters":[],"renderer":{"type":"composite","layers":[{"moduleId":"material.crystal-prism","params":{"intensity":0.3,"facet":46,"edge":0.62,"tint":"#b7f2ff"}},{"moduleId":"light.prismatic-dispersion","params":{"intensity":0.24,"spread":20,"angle":14,"position":60}},{"moduleId":"light.neon-edge-glow","params":{"intensity":0.42,"spread":12}},{"moduleId":"motion.spring-settle","params":{"distance":4,"duration":0.58,"overshoot":1.016}},{"moduleId":"focus.halo","params":{"intensity":0.38}}]},"quality":{"low":{"enabled":true},"medium":{"enabled":true},"high":{"enabled":true},"cinematic":{"enabled":true}},"accessibility":{"reducedMotionSafe":true,"highContrastSafe":true,"notes":"","photosensitiveSafe":true},"provenance":{"author":"Mike — Axiom/Mir","origin":"AXM AetherFX Visual Effect Fabric v1.1.0 steward upgrade","license":"UNSET — choose before public sharing","created":"2026-07-28","sourceIntegrity":"Generated locally from this package; no external runtime dependency."}}],"moods":[{"id":"nocturne","name":"Nocturne Cyan","accent":"#58e6ff","accent2":"#a56cff","warm":"#ff75d8","bg":"#050814"},{"id":"aurora","name":"Aurora Teal","accent":"#54ffd2","accent2":"#63a7ff","warm":"#c784ff","bg":"#03100f"},{"id":"ember","name":"Ember Violet","accent":"#ff9a5a","accent2":"#b26cff","warm":"#ffd166","bg":"#100609"},{"id":"arctic","name":"Arctic Blue","accent":"#9ee8ff","accent2":"#6b8cff","warm":"#d7f8ff","bg":"#050914"},{"id":"mono","name":"Monochrome Glass","accent":"#f2f7ff","accent2":"#96a2b8","warm":"#ffffff","bg":"#07090d"}]};
/* src/core/registry.js */
(function (root) {
  'use strict';
  const AXM = root.AXM;

  AXM.ModuleRegistry = class ModuleRegistry {
    constructor(catalog) {
      if (!catalog || !Array.isArray(catalog.modules)) {
        throw new TypeError('A catalog with a modules array is required.');
      }
      this.catalogMeta = AXM.Utils.clone({ ...catalog, modules: undefined });
      this.moods = AXM.Utils.clone(catalog.moods || []);
      this.modules = new Map();
      this.sources = new Map();
      catalog.modules.forEach((module) => this.register(module, { source: 'builtin', overwrite: true }));
    }

    register(module, options = {}) {
      const { source = 'custom', overwrite = false } = options;
      if (!module || typeof module.id !== 'string') throw new TypeError('Module requires an id.');
      const existing = this.modules.get(module.id);
      if (existing && !overwrite) {
        throw new Error(`Module already exists: ${module.id}`);
      }
      const cloned = AXM.Utils.clone(module);
      this.modules.set(cloned.id, cloned);
      this.sources.set(cloned.id, source);
      return cloned;
    }

    unregister(moduleId) {
      if (this.sources.get(moduleId) === 'builtin') {
        throw new Error('Built-in modules cannot be deleted. Clone or disable them instead.');
      }
      this.sources.delete(moduleId);
      return this.modules.delete(moduleId);
    }

    has(moduleId) { return this.modules.has(moduleId); }
    get(moduleId) { return this.modules.get(moduleId) || null; }
    sourceOf(moduleId) { return this.sources.get(moduleId) || null; }

    list(filter = {}) {
      const { kind, category, search, source, includeHidden = false } = filter;
      const needle = String(search || '').trim().toLowerCase();
      return [...this.modules.values()].filter((module) => {
        if (kind && (Array.isArray(kind) ? !kind.includes(module.kind) : module.kind !== kind)) return false;
        if (category && module.category !== category) return false;
        if (source && this.sourceOf(module.id) !== source) return false;
        if (!includeHidden && module.kind === 'primitive') return false;
        if (needle) {
          const haystack = [module.name, module.id, module.category, module.description, ...(module.tags || [])]
            .join(' ').toLowerCase();
          if (!haystack.includes(needle)) return false;
        }
        return true;
      }).sort((a, b) => {
        const categoryCompare = String(a.category).localeCompare(String(b.category));
        return categoryCompare || String(a.name).localeCompare(String(b.name));
      });
    }

    categories(options = {}) {
      const kinds = options.kinds || ['effect', 'organ', 'mold'];
      return [...new Set(this.list({ kind: kinds }).map((module) => module.category))];
    }

    sceneModules() {
      return this.list({ kind: 'scene', includeHidden: true });
    }

    mood(moodId) {
      return this.moods.find((mood) => mood.id === moodId) || this.moods[0] || null;
    }

    defaultParams(moduleOrId) {
      const module = typeof moduleOrId === 'string' ? this.get(moduleOrId) : moduleOrId;
      if (!module) return {};
      return (module.parameters || []).reduce((out, parameter) => {
        out[parameter.id] = AXM.Utils.clone(parameter.default);
        return out;
      }, {});
    }

    mergedParams(moduleOrId, overrides = {}) {
      return { ...this.defaultParams(moduleOrId), ...(overrides || {}) };
    }

    dependencyClosure(moduleId, options = {}) {
      const {
        includeEntry = true,
        includeCompositeChildren = true,
        maxDepth = 128,
        maxModules = 2048
      } = options;
      const ordered = [];
      const visiting = new Set();
      const visited = new Set();

      const walk = (id, depth = 0) => {
        if (visited.has(id)) return;
        if (visiting.has(id)) throw new Error(`Dependency cycle detected at ${id}`);
        if (depth > maxDepth) throw new Error(`Dependency depth exceeds the ${maxDepth}-module safety limit at ${id}`);
        if (visited.size + visiting.size >= maxModules) throw new Error(`Dependency closure exceeds the ${maxModules}-module safety budget`);
        const module = this.get(id);
        if (!module) throw new Error(`Missing dependency: ${id}`);
        visiting.add(id);
        (module.dependencies || []).forEach((dependency) => walk(dependency, depth + 1));
        if (includeCompositeChildren && module.renderer?.type === 'composite') {
          (module.renderer.layers || []).forEach((layer) => walk(layer.moduleId, depth + 1));
        }
        if (module.renderer?.type === 'derived' && module.renderer.baseModuleId) {
          walk(module.renderer.baseModuleId, depth + 1);
        }
        visiting.delete(id);
        visited.add(id);
        ordered.push(module);
      };

      walk(moduleId);
      return includeEntry ? ordered : ordered.filter((module) => module.id !== moduleId);
    }

    customModules() {
      return [...this.modules.values()].filter((module) => this.sourceOf(module.id) === 'custom');
    }

    exportCatalog() {
      return {
        ...AXM.Utils.clone(this.catalogMeta),
        modules: [...this.modules.values()].map((module) => AXM.Utils.clone(module)),
        moods: AXM.Utils.clone(this.moods)
      };
    }

    loadCustomModules(modules, options = {}) {
      const registered = [];
      (modules || []).forEach((module) => {
        const source = options.source || 'custom';
        const overwrite = options.overwrite === true || this.sourceOf(module.id) === 'custom';
        registered.push(this.register(module, { source, overwrite }));
      });
      return registered;
    }

    clone() {
      const builtins = [...this.modules.values()]
        .filter((module) => this.sourceOf(module.id) === 'builtin')
        .map((module) => AXM.Utils.clone(module));
      const copy = new AXM.ModuleRegistry({
        ...AXM.Utils.clone(this.catalogMeta),
        moods: AXM.Utils.clone(this.moods),
        modules: builtins
      });
      this.customModules().forEach((module) => copy.register(module, { source: 'custom' }));
      return copy;
    }

    replaceFrom(other) {
      if (!(other instanceof AXM.ModuleRegistry)) throw new TypeError('replaceFrom requires another ModuleRegistry.');
      this.catalogMeta = AXM.Utils.clone(other.catalogMeta);
      this.moods = AXM.Utils.clone(other.moods);
      this.modules = new Map([...other.modules.entries()].map(([id, module]) => [id, AXM.Utils.clone(module)]));
      this.sources = new Map(other.sources);
      return this;
    }
  };
})(typeof globalThis !== 'undefined' ? globalThis : window);


/* src/core/validator.js */
(function (root) {
  'use strict';
  const AXM = root.AXM;

  const ID_PATTERN = /^[a-z0-9]+(?:[._-][a-z0-9]+)*$/;
  const SEMVER_PATTERN = /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/;
  const CLASS_PATTERN = /^fx-[a-z0-9_-]+$/;
  const CSS_VAR_PATTERN = /^--(?:fx|axm)-[a-z0-9-]+$/;
  const HEX_COLOR_PATTERN = /^#[0-9a-f]{3}(?:[0-9a-f]{3})?(?:[0-9a-f]{2})?$/i;
  const RENDERER_TYPES = new Set(['capability', 'class', 'overlay', 'interaction', 'derived', 'composite', 'scene']);
  const RENDER_SCOPES = new Set(['stage', 'scene', 'surface', 'active', 'loading', 'ambient', 'light', 'atmosphere']);
  const INTERACTIONS = new Set(['click', 'parallax', 'pointer']);
  const MAX_PACKAGE_MODULES = 512;
  const MAX_RECIPE_LAYERS = 2048;

  function result() {
    return {
      errors: [],
      warnings: [],
      notes: [],
      get valid() { return this.errors.length === 0; }
    };
  }

  function push(report, severity, code, message, path = '') {
    report[severity].push({ code, message, path });
  }

  function moduleReferences(module) {
    const refs = [...(module?.dependencies || [])];
    if (module?.renderer?.type === 'derived' && module.renderer.baseModuleId) refs.push(module.renderer.baseModuleId);
    if (module?.renderer?.type === 'composite') {
      (module.renderer.layers || []).forEach((layer) => { if (layer?.moduleId) refs.push(layer.moduleId); });
    }
    for (const tier of ['low', 'medium', 'high', 'cinematic']) {
      const fallback = module?.quality?.[tier]?.fallbackModuleId;
      if (fallback) refs.push(fallback);
    }
    return [...new Set(refs)];
  }

  function validateModuleGraph(report, modules, registry, pathPrefix) {
    const local = new Map();
    (modules || []).forEach((module, index) => {
      if (!module?.id) return;
      if (local.has(module.id)) {
        push(report, 'errors', 'DUPLICATE_PACKAGE_MODULE', `Package contains duplicate module id: ${module.id}`, `${pathPrefix}[${index}].id`);
      } else local.set(module.id, module);
    });
    const get = (id) => local.get(id) || registry?.get?.(id) || null;
    const state = new Map();
    const visit = (id, trail = []) => {
      if (state.get(id) === 2) return;
      if (state.get(id) === 1) {
        const start = trail.indexOf(id);
        const cycle = [...trail.slice(Math.max(0, start)), id];
        push(report, 'errors', 'PACKAGE_DEPENDENCY_CYCLE', `Package dependency cycle: ${cycle.join(' → ')}`, pathPrefix);
        return;
      }
      const module = get(id);
      if (!module) return;
      state.set(id, 1);
      moduleReferences(module).forEach((ref) => visit(ref, [...trail, id]));
      state.set(id, 2);
    };
    local.forEach((_, id) => visit(id));
  }

  AXM.Validator = {
    validateModule(module, registry = null) {
      const report = result();
      if (!module || typeof module !== 'object') {
        push(report, 'errors', 'MODULE_NOT_OBJECT', 'Module must be an object.');
        return report;
      }
      if (!module.id || !ID_PATTERN.test(module.id)) {
        push(report, 'errors', 'INVALID_ID', 'Module id must use lowercase letters, numbers, dots, dashes, or underscores.', 'id');
      }
      if (!module.name || String(module.name).trim().length < 2) {
        push(report, 'errors', 'MISSING_NAME', 'Module requires a readable name.', 'name');
      }
      if (!SEMVER_PATTERN.test(String(module.version || ''))) {
        push(report, 'errors', 'INVALID_VERSION', 'Module version must be semantic versioning such as 1.0.0.', 'version');
      }
      if (!['primitive', 'effect', 'organ', 'mold', 'scene'].includes(module.kind)) {
        push(report, 'errors', 'INVALID_KIND', 'Unsupported module kind.', 'kind');
      }
      if (!module.category) push(report, 'errors', 'MISSING_CATEGORY', 'Module category is required.', 'category');
      if (!module.renderer || typeof module.renderer.type !== 'string') {
        push(report, 'errors', 'MISSING_RENDERER', 'Module requires a renderer declaration.', 'renderer');
      } else if (!RENDERER_TYPES.has(module.renderer.type)) {
        push(report, 'errors', 'UNSUPPORTED_RENDERER', `Unsupported renderer type: ${module.renderer.type}`, 'renderer.type');
      } else {
        const renderer = module.renderer;
        if (['class', 'overlay', 'interaction'].includes(renderer.type)) {
          if (!RENDER_SCOPES.has(renderer.scope)) {
            push(report, 'errors', 'INVALID_RENDER_SCOPE', `Unsupported render scope: ${renderer.scope}`, 'renderer.scope');
          }
          if (!CLASS_PATTERN.test(String(renderer.className || ''))) {
            push(report, 'errors', 'INVALID_RENDER_CLASS', 'Renderer className must be one namespaced fx-* CSS class token.', 'renderer.className');
          }
        }
        if (renderer.interactive !== undefined && !INTERACTIONS.has(renderer.interactive)) {
          push(report, 'errors', 'INVALID_INTERACTION', `Unsupported interaction: ${renderer.interactive}`, 'renderer.interactive');
        }
        if (renderer.generatedCount !== undefined) {
          const count = Number(renderer.generatedCount);
          if (!Number.isInteger(count) || count < 0 || count > 256) {
            push(report, 'errors', 'INVALID_GENERATED_COUNT', 'generatedCount must be an integer from 0 to 256.', 'renderer.generatedCount');
          }
        }
      }
      const parameterIds = new Set();
      if (!Array.isArray(module.parameters)) {
        push(report, 'errors', 'INVALID_PARAMETERS', 'Parameters must be an array.', 'parameters');
      } else {
        module.parameters.forEach((parameter, index) => {
          const path = `parameters[${index}]`;
          if (!parameter.id || !ID_PATTERN.test(parameter.id)) push(report, 'errors', 'INVALID_PARAMETER_ID', 'Parameter id is invalid.', `${path}.id`);
          if (parameterIds.has(parameter.id)) push(report, 'errors', 'DUPLICATE_PARAMETER', `Duplicate parameter: ${parameter.id}`, path);
          parameterIds.add(parameter.id);
          if (!['number', 'boolean', 'select', 'color', 'text'].includes(parameter.type)) {
            push(report, 'errors', 'INVALID_PARAMETER_TYPE', `Unsupported parameter type: ${parameter.type}`, `${path}.type`);
          }
          if (!parameter.label && !parameter.name) {
            push(report, 'errors', 'MISSING_PARAMETER_LABEL', 'Parameter requires a readable label.', `${path}.label`);
          }
          if (parameter.cssVar !== undefined) {
            if (!CSS_VAR_PATTERN.test(String(parameter.cssVar))) {
              push(report, 'errors', 'UNSAFE_CSS_VARIABLE', 'CSS bindings must use a namespaced --fx-* or --axm-* custom property.', `${path}.cssVar`);
            }
            if (!['number', 'color'].includes(parameter.type)) {
              push(report, 'errors', 'UNSAFE_CSS_VALUE_TYPE', 'Only numeric and color parameters may bind to renderer CSS variables.', `${path}.type`);
            }
          }
          if (parameter.type === 'number') {
            const value = Number(parameter.default);
            if (!Number.isFinite(value)) push(report, 'errors', 'INVALID_DEFAULT', 'Numeric parameter requires a numeric default.', `${path}.default`);
            if (Number.isFinite(parameter.min) && value < parameter.min) push(report, 'errors', 'DEFAULT_BELOW_MIN', 'Default is below minimum.', `${path}.default`);
            if (Number.isFinite(parameter.max) && value > parameter.max) push(report, 'errors', 'DEFAULT_ABOVE_MAX', 'Default is above maximum.', `${path}.default`);
            if (Number.isFinite(parameter.min) && Number.isFinite(parameter.max) && parameter.min > parameter.max) {
              push(report, 'errors', 'MIN_ABOVE_MAX', 'Minimum cannot exceed maximum.', path);
            }
          }
          if (parameter.type === 'boolean' && typeof parameter.default !== 'boolean') {
            push(report, 'errors', 'INVALID_BOOLEAN_DEFAULT', 'Boolean parameter requires a boolean default.', `${path}.default`);
          }
          if (parameter.type === 'color' && !HEX_COLOR_PATTERN.test(String(parameter.default || ''))) {
            push(report, 'errors', 'INVALID_COLOR_DEFAULT', 'Color defaults must be local hexadecimal colors.', `${path}.default`);
          }
          if (parameter.type === 'select') {
            if (!Array.isArray(parameter.options) || parameter.options.length === 0) {
              push(report, 'errors', 'INVALID_SELECT_OPTIONS', 'Select parameters require a non-empty options list.', `${path}.options`);
            } else if (!parameter.options.includes(parameter.default)) {
              push(report, 'errors', 'INVALID_SELECT_DEFAULT', 'Select default must be one of its declared options.', `${path}.default`);
            }
          }
        });
      }
      if (!Array.isArray(module.dependencies)) {
        push(report, 'errors', 'INVALID_DEPENDENCIES', 'Dependencies must be an array.', 'dependencies');
      } else {
        const dependencies = new Set();
        module.dependencies.forEach((dependency, index) => {
          if (!ID_PATTERN.test(String(dependency || ''))) push(report, 'errors', 'INVALID_DEPENDENCY_ID', `Invalid dependency id: ${dependency}`, `dependencies[${index}]`);
          if (dependency === module.id) push(report, 'errors', 'SELF_DEPENDENCY', 'A module cannot depend on itself.', `dependencies[${index}]`);
          if (dependencies.has(dependency)) push(report, 'errors', 'DUPLICATE_DEPENDENCY', `Duplicate dependency: ${dependency}`, `dependencies[${index}]`);
          dependencies.add(dependency);
        });
      }
      if (registry) {
        (module.dependencies || []).forEach((dependency, index) => {
          if (!registry.has(dependency)) push(report, 'errors', 'MISSING_DEPENDENCY', `Dependency does not exist: ${dependency}`, `dependencies[${index}]`);
        });
        if (module.renderer?.type === 'composite') {
          if (!Array.isArray(module.renderer.layers) || module.renderer.layers.length === 0) {
            push(report, 'errors', 'EMPTY_COMPOSITE', 'Composite modules require at least one layer.', 'renderer.layers');
          } else {
            module.renderer.layers.forEach((layer, index) => {
              if (!registry.has(layer.moduleId)) {
                push(report, 'errors', 'MISSING_COMPOSITE_LAYER', `Composite layer does not exist: ${layer.moduleId}`, `renderer.layers[${index}]`);
                return;
              }
              const child = registry.get(layer.moduleId);
              const childParameterIds = new Set((child?.parameters || []).map((parameter) => parameter.id));
              Object.entries(layer.bindings || {}).forEach(([childParamId, parentParamId]) => {
                if (!childParameterIds.has(childParamId)) push(report, 'errors', 'INVALID_COMPOSITE_BINDING_CHILD', `Composite binding targets unknown child parameter ${childParamId} on ${layer.moduleId}.`, `renderer.layers[${index}].bindings.${childParamId}`);
                if (!parameterIds.has(parentParamId)) push(report, 'errors', 'INVALID_COMPOSITE_BINDING_PARENT', `Composite binding references unknown exposed parameter ${parentParamId}.`, `renderer.layers[${index}].bindings.${childParamId}`);
              });
            });
          }
        }
        if (module.renderer?.type === 'derived' && !registry.has(module.renderer.baseModuleId)) {
          push(report, 'errors', 'MISSING_BASE_MODULE', `Derived base does not exist: ${module.renderer.baseModuleId}`, 'renderer.baseModuleId');
        }
        if (module.renderer?.type === 'derived' && module.renderer.baseModuleId === module.id) {
          push(report, 'errors', 'SELF_DERIVED_BASE', 'A derived module cannot use itself as its base.', 'renderer.baseModuleId');
        }
        for (const tier of ['low', 'medium', 'high', 'cinematic']) {
          const fallback = module.quality?.[tier]?.fallbackModuleId;
          if (fallback && !registry.has(fallback)) push(report, 'errors', 'MISSING_QUALITY_FALLBACK', `Quality fallback does not exist: ${fallback}`, `quality.${tier}.fallbackModuleId`);
          if (fallback === module.id) push(report, 'errors', 'SELF_QUALITY_FALLBACK', 'A module cannot fall back to itself.', `quality.${tier}.fallbackModuleId`);
        }
      }
      const license = module.provenance?.license;
      if (!license || /unset|unknown/i.test(license)) {
        push(report, 'warnings', 'LICENSE_UNSET', 'Choose an explicit license before public sharing.', 'provenance.license');
      }
      if (!module.quality || !['low', 'medium', 'high', 'cinematic'].every((tier) => module.quality[tier])) {
        push(report, 'warnings', 'INCOMPLETE_QUALITY_TIERS', 'Declare behavior for low, medium, high, and cinematic quality tiers.', 'quality');
      }
      if (!module.accessibility) {
        push(report, 'warnings', 'MISSING_ACCESSIBILITY', 'Declare reduced-motion and high-contrast behavior.', 'accessibility');
      }
      if (!module.description) push(report, 'notes', 'DESCRIPTION_EMPTY', 'A short description improves package discovery.', 'description');
      return report;
    },

    validateCatalog(registry) {
      const report = result();
      const ids = new Set();
      registry.list({ includeHidden: true }).forEach((module) => {
        if (ids.has(module.id)) push(report, 'errors', 'DUPLICATE_MODULE_ID', `Duplicate module id: ${module.id}`, module.id);
        ids.add(module.id);
        const child = this.validateModule(module, registry);
        child.errors.forEach((item) => report.errors.push({ ...item, path: `${module.id}.${item.path}` }));
        child.warnings.forEach((item) => report.warnings.push({ ...item, path: `${module.id}.${item.path}` }));
      });
      registry.list({ includeHidden: true }).forEach((module) => {
        try {
          registry.dependencyClosure(module.id);
        } catch (error) {
          push(report, 'errors', 'DEPENDENCY_CYCLE', error.message, module.id);
        }
      });
      return report;
    },

    validateRecipe(recipe, registry) {
      const report = result();
      if (!recipe || typeof recipe !== 'object') {
        push(report, 'errors', 'RECIPE_NOT_OBJECT', 'Recipe must be an object.');
        return report;
      }
      if (recipe.schema !== 'axm.visual-recipe/1') push(report, 'errors', 'INVALID_RECIPE_SCHEMA', 'Unsupported recipe schema.', 'schema');
      if (!registry.has(recipe.sceneId) || registry.get(recipe.sceneId)?.kind !== 'scene') {
        push(report, 'errors', 'INVALID_SCENE', `Unknown scene: ${recipe.sceneId}`, 'sceneId');
      }
      if (!Array.isArray(recipe.layers)) {
        push(report, 'errors', 'INVALID_LAYERS', 'Recipe layers must be an array.', 'layers');
        return report;
      }
      if (recipe.layers.length > MAX_RECIPE_LAYERS) {
        push(report, 'errors', 'RECIPE_LAYER_BUDGET', `Recipe exceeds the ${MAX_RECIPE_LAYERS}-layer safety budget.`, 'layers');
      }
      const instanceIds = new Set();
      const exclusiveGroups = new Map();
      recipe.layers.forEach((layer, index) => {
        const path = `layers[${index}]`;
        if (!layer || typeof layer !== 'object') {
          push(report, 'errors', 'INVALID_LAYER', 'Each recipe layer must be an object.', path);
          return;
        }
        if (!layer.instanceId) push(report, 'errors', 'MISSING_INSTANCE_ID', 'Layer requires an instance id.', `${path}.instanceId`);
        else if (!ID_PATTERN.test(String(layer.instanceId))) push(report, 'errors', 'INVALID_INSTANCE_ID', 'Layer instance id is invalid.', `${path}.instanceId`);
        if (instanceIds.has(layer.instanceId)) push(report, 'errors', 'DUPLICATE_INSTANCE_ID', `Duplicate instance id: ${layer.instanceId}`, path);
        instanceIds.add(layer.instanceId);
        if (layer.enabled !== undefined && typeof layer.enabled !== 'boolean') {
          push(report, 'errors', 'INVALID_ENABLED_STATE', 'Layer enabled state must be boolean.', `${path}.enabled`);
        }
        if (layer.targetRole !== undefined && !ID_PATTERN.test(String(layer.targetRole))) {
          push(report, 'errors', 'INVALID_TARGET_ROLE', 'Layer targetRole must use a safe role id.', `${path}.targetRole`);
        }
        const module = registry.get(layer.moduleId);
        if (!module) {
          push(report, 'errors', 'UNKNOWN_MODULE', `Unknown module: ${layer.moduleId}`, `${path}.moduleId`);
          return;
        }
        if (module.kind === 'primitive' || module.kind === 'scene') {
          push(report, 'errors', 'INVALID_ACTIVE_KIND', `${module.kind} modules cannot be direct active layers.`, `${path}.moduleId`);
        }
        if (module.exclusiveGroup && layer.enabled !== false) {
          const prior = exclusiveGroups.get(module.exclusiveGroup);
          if (prior) push(report, 'warnings', 'EXCLUSIVE_CONFLICT', `${module.name} conflicts with ${prior.name} in group ${module.exclusiveGroup}. The later layer wins.`, path);
          exclusiveGroups.set(module.exclusiveGroup, module);
        }
        const definitions = new Map((module.parameters || []).map((parameter) => [parameter.id, parameter]));
        Object.entries(layer.params || {}).forEach(([key, value]) => {
          const definition = definitions.get(key);
          if (!definition) {
            push(report, 'warnings', 'UNKNOWN_PARAMETER', `Unknown parameter ${key} for ${module.id}.`, `${path}.params.${key}`);
            return;
          }
          if (definition.type === 'number') {
            const number = Number(value);
            if (!Number.isFinite(number)) push(report, 'errors', 'NON_NUMERIC_PARAMETER', `${key} must be numeric.`, `${path}.params.${key}`);
            if (Number.isFinite(definition.min) && number < definition.min) push(report, 'warnings', 'PARAMETER_CLAMPED_LOW', `${key} will be clamped to ${definition.min}.`, `${path}.params.${key}`);
            if (Number.isFinite(definition.max) && number > definition.max) push(report, 'warnings', 'PARAMETER_CLAMPED_HIGH', `${key} will be clamped to ${definition.max}.`, `${path}.params.${key}`);
          }
          if (definition.type === 'boolean' && typeof value !== 'boolean') push(report, 'errors', 'NON_BOOLEAN_PARAMETER', `${key} must be boolean.`, `${path}.params.${key}`);
          if (definition.type === 'select' && !definition.options?.includes(value)) push(report, 'errors', 'INVALID_SELECT_VALUE', `${key} must be one of its declared options.`, `${path}.params.${key}`);
          if (definition.type === 'color' && !HEX_COLOR_PATTERN.test(String(value || ''))) push(report, 'errors', 'INVALID_COLOR_VALUE', `${key} must be a local hexadecimal color.`, `${path}.params.${key}`);
        });
      });
      const globals = recipe.globals || {};
      if (!['auto', 'low', 'medium', 'high', 'cinematic'].includes(globals.quality)) {
        push(report, 'errors', 'INVALID_QUALITY', 'Quality must be auto, low, medium, high, or cinematic.', 'globals.quality');
      }
      if (globals.resolvedQuality !== undefined && !['low', 'medium', 'high', 'cinematic'].includes(globals.resolvedQuality)) {
        push(report, 'errors', 'INVALID_RESOLVED_QUALITY', 'Resolved quality must be low, medium, high, or cinematic.', 'globals.resolvedQuality');
      }
      if (globals.performanceBias !== undefined && !['battery', 'balanced', 'quality'].includes(globals.performanceBias)) {
        push(report, 'errors', 'INVALID_PERFORMANCE_BIAS', 'Performance bias must be battery, balanced, or quality.', 'globals.performanceBias');
      }
      for (const key of ['intensity', 'depth', 'motion']) {
        const value = Number(globals[key]);
        if (!Number.isFinite(value) || value < 0 || value > 1) push(report, 'errors', 'INVALID_GLOBAL_RANGE', `${key} must be a number from 0 to 1.`, `globals.${key}`);
      }
      for (const key of ['reducedMotion', 'photosensitiveSafe', 'highContrast', 'largeText']) {
        if (globals[key] !== undefined && typeof globals[key] !== 'boolean') push(report, 'errors', 'INVALID_GLOBAL_BOOLEAN', `${key} must be boolean.`, `globals.${key}`);
      }
      return report;
    },

    validatePackage(pkg, registry = null) {
      const report = result();
      if (!pkg || typeof pkg !== 'object') {
        push(report, 'errors', 'PACKAGE_NOT_OBJECT', 'Package must be an object.');
        return report;
      }
      if (!['axm.visual-module-package/1', 'axm.visual-recipe-package/1'].includes(pkg.schema)) {
        push(report, 'errors', 'INVALID_PACKAGE_SCHEMA', 'Unsupported AXM package schema.', 'schema');
      }
      if (pkg.integrity?.algorithm !== 'sha256' || !/^[0-9a-f]{64}$/i.test(String(pkg.integrity?.value || ''))) {
        push(report, 'errors', 'MISSING_PACKAGE_INTEGRITY', 'Packages require a sealed SHA-256 integrity value before import.', 'integrity');
      }
      if (pkg.schema === 'axm.visual-module-package/1') {
        if (!Array.isArray(pkg.modules) || !pkg.modules.length) push(report, 'errors', 'EMPTY_PACKAGE', 'Module package contains no modules.', 'modules');
        if ((pkg.modules || []).length > MAX_PACKAGE_MODULES) push(report, 'errors', 'PACKAGE_MODULE_BUDGET', `Module package exceeds the ${MAX_PACKAGE_MODULES}-module safety budget.`, 'modules');
        const localMap = new Map((pkg.modules || []).map((module) => [module.id, module]));
        const shadowRegistry = {
          has(id) { return localMap.has(id) || Boolean(registry?.has(id)); },
          get(id) { return localMap.get(id) || registry?.get(id) || null; }
        };
        (pkg.modules || []).forEach((module, index) => {
          const child = this.validateModule(module, shadowRegistry);
          child.errors.forEach((item) => report.errors.push({ ...item, path: `modules[${index}].${item.path}` }));
          child.warnings.forEach((item) => report.warnings.push({ ...item, path: `modules[${index}].${item.path}` }));
        });
        validateModuleGraph(report, pkg.modules || [], registry, 'modules');
        if (!localMap.has(pkg.entryModuleId)) push(report, 'errors', 'MISSING_ENTRY', 'Entry module is not bundled.', 'entryModuleId');
      }
      if (pkg.schema === 'axm.visual-recipe-package/1') {
        if (!pkg.recipe) push(report, 'errors', 'MISSING_RECIPE', 'Recipe package has no recipe.', 'recipe');
        if (!Array.isArray(pkg.bundledCustomModules)) push(report, 'errors', 'INVALID_BUNDLED_MODULES', 'bundledCustomModules must be an array.', 'bundledCustomModules');
        if ((pkg.bundledCustomModules || []).length > MAX_PACKAGE_MODULES) push(report, 'errors', 'PACKAGE_MODULE_BUDGET', `Recipe package exceeds the ${MAX_PACKAGE_MODULES}-module safety budget.`, 'bundledCustomModules');
        const bundledMap = new Map((pkg.bundledCustomModules || []).map((module) => [module.id, module]));
        const shadowRegistry = {
          has(id) { return bundledMap.has(id) || Boolean(registry?.has(id)); },
          get(id) { return bundledMap.get(id) || registry?.get(id) || null; }
        };
        (pkg.bundledCustomModules || []).forEach((module, index) => {
          const child = this.validateModule(module, shadowRegistry);
          child.errors.forEach((item) => report.errors.push({ ...item, path: `bundledCustomModules[${index}].${item.path}` }));
          child.warnings.forEach((item) => report.warnings.push({ ...item, path: `bundledCustomModules[${index}].${item.path}` }));
        });
        validateModuleGraph(report, pkg.bundledCustomModules || [], registry, 'bundledCustomModules');
        if (registry && pkg.recipe) {
          const child = this.validateRecipe(pkg.recipe, shadowRegistry);
          child.errors.forEach((item) => report.errors.push({ ...item, path: `recipe.${item.path}` }));
          child.warnings.forEach((item) => report.warnings.push({ ...item, path: `recipe.${item.path}` }));
        }
      }
      return report;
    }
  };
})(typeof globalThis !== 'undefined' ? globalThis : window);


/* src/core/package-io.js */
(function (root) {
  'use strict';
  const AXM = root.AXM;

  function utf8Bytes(text) {
    if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(text);
    const encoded = unescape(encodeURIComponent(text));
    return Uint8Array.from(encoded, (character) => character.charCodeAt(0));
  }

  // Dependency-free SHA-256 for local/file/about:blank contexts where Web Crypto is
  // unavailable. This produces the same digest as crypto.subtle and Node crypto;
  // integrity never silently degrades to a non-cryptographic checksum.
  function sha256Portable(text) {
    const bytes = utf8Bytes(text);
    const bitLength = bytes.length * 8;
    const paddedLength = Math.ceil((bytes.length + 9) / 64) * 64;
    const padded = new Uint8Array(paddedLength);
    padded.set(bytes);
    padded[bytes.length] = 0x80;
    const view = new DataView(padded.buffer);
    view.setUint32(paddedLength - 8, Math.floor(bitLength / 0x100000000), false);
    view.setUint32(paddedLength - 4, bitLength >>> 0, false);

    const constants = new Uint32Array([
      0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
      0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
      0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
      0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
      0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
      0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
      0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
      0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2
    ]);
    const state = new Uint32Array([
      0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,
      0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19
    ]);
    const words = new Uint32Array(64);
    const rotateRight = (value, amount) => (value >>> amount) | (value << (32 - amount));

    for (let offset = 0; offset < paddedLength; offset += 64) {
      for (let index = 0; index < 16; index += 1) words[index] = view.getUint32(offset + index * 4, false);
      for (let index = 16; index < 64; index += 1) {
        const x = words[index - 15];
        const y = words[index - 2];
        const sigma0 = rotateRight(x, 7) ^ rotateRight(x, 18) ^ (x >>> 3);
        const sigma1 = rotateRight(y, 17) ^ rotateRight(y, 19) ^ (y >>> 10);
        words[index] = (words[index - 16] + sigma0 + words[index - 7] + sigma1) >>> 0;
      }

      let [a,b,c,d,e,f,g,h] = state;
      for (let index = 0; index < 64; index += 1) {
        const sum1 = rotateRight(e, 6) ^ rotateRight(e, 11) ^ rotateRight(e, 25);
        const choice = (e & f) ^ (~e & g);
        const temp1 = (h + sum1 + choice + constants[index] + words[index]) >>> 0;
        const sum0 = rotateRight(a, 2) ^ rotateRight(a, 13) ^ rotateRight(a, 22);
        const majority = (a & b) ^ (a & c) ^ (b & c);
        const temp2 = (sum0 + majority) >>> 0;
        h = g; g = f; f = e; e = (d + temp1) >>> 0;
        d = c; c = b; b = a; a = (temp1 + temp2) >>> 0;
      }
      state[0] = (state[0] + a) >>> 0; state[1] = (state[1] + b) >>> 0;
      state[2] = (state[2] + c) >>> 0; state[3] = (state[3] + d) >>> 0;
      state[4] = (state[4] + e) >>> 0; state[5] = (state[5] + f) >>> 0;
      state[6] = (state[6] + g) >>> 0; state[7] = (state[7] + h) >>> 0;
    }
    return [...state].map((word) => word.toString(16).padStart(8, '0')).join('');
  }

  async function sha256(text) {
    if (root.crypto?.subtle && typeof TextEncoder !== 'undefined') {
      const digest = await root.crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
      return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
    }
    return sha256Portable(text);
  }

  function integrityPayload(pkg) {
    const clone = AXM.Utils.clone(pkg);
    delete clone.integrity;
    return AXM.Utils.canonicalJson(clone);
  }

  AXM.PackageIO = {
    async createModulePackage(moduleId, registry, metadata = {}) {
      const entry = registry.get(moduleId);
      if (!entry) throw new Error(`Cannot package unknown module: ${moduleId}`);
      const modules = registry.dependencyClosure(moduleId).map((module) => AXM.Utils.clone(module));
      const pkg = {
        schema: 'axm.visual-module-package/1',
        packageId: metadata.packageId || `package.${moduleId}.${Date.now()}`,
        name: metadata.name || entry.name,
        version: metadata.version || entry.version,
        entryModuleId: moduleId,
        created: new Date().toISOString(),
        creator: metadata.creator || 'Mike — Axiom/Mir',
        description: metadata.description || entry.description,
        modules,
        compatibility: {
          minimumFabricVersion: '1.0.0',
          adapters: ['web'],
          declaredFutureAdapters: ['static-svg', 'generic-game-contract']
        },
        sharing: {
          consentChecked: false,
          licenseChecked: !/unset|unknown/i.test(entry.provenance?.license || ''),
          note: 'Public sharing remains blocked by policy until license and consent are reviewed.'
        }
      };
      pkg.integrity = { algorithm: 'sha256', value: await sha256(integrityPayload(pkg)) };
      return pkg;
    },

    async createRecipePackage(recipe, registry, metadata = {}) {
      const dependencyIds = new Set();
      (recipe.layers || []).forEach((layer) => {
        if (!registry.has(layer.moduleId)) return;
        registry.dependencyClosure(layer.moduleId).forEach((module) => dependencyIds.add(module.id));
      });
      const customModules = [...dependencyIds]
        .filter((id) => registry.sourceOf(id) === 'custom')
        .map((id) => AXM.Utils.clone(registry.get(id)));
      const pkg = {
        schema: 'axm.visual-recipe-package/1',
        packageId: metadata.packageId || `recipe-package.${AXM.Utils.slugify(recipe.name)}.${Date.now()}`,
        name: metadata.name || recipe.name,
        version: metadata.version || recipe.version || '1.0.0',
        created: new Date().toISOString(),
        recipe: AXM.Utils.clone(recipe),
        bundledCustomModules: customModules,
        requiredBuiltins: [...dependencyIds].filter((id) => registry.sourceOf(id) === 'builtin'),
        sharing: {
          consentChecked: false,
          note: 'Review provenance and license fields before public sharing.'
        }
      };
      pkg.integrity = { algorithm: 'sha256', value: await sha256(integrityPayload(pkg)) };
      return pkg;
    },

    async verifyIntegrity(pkg) {
      if (!pkg?.integrity?.value) return { verified: false, reason: 'No integrity value.' };
      const actual = await sha256(integrityPayload(pkg));
      return {
        verified: actual === pkg.integrity.value,
        expected: pkg.integrity.value,
        actual,
        algorithm: pkg.integrity.algorithm || 'unknown'
      };
    },

    async previewPackage(pkg, registry) {
      const report = AXM.Validator.validatePackage(pkg, registry);
      const integrity = pkg?.integrity?.value ? await this.verifyIntegrity(pkg) : { verified: false, reason: 'No integrity value.' };
      const modules = pkg?.schema === 'axm.visual-module-package/1' ? (pkg.modules || []) : (pkg.bundledCustomModules || []);
      const builtInCollisions = [];
      const customUpdates = [];
      const newCustom = [];
      for (const module of modules) {
        const existing = registry.get(module.id);
        if (!existing) newCustom.push(module.id);
        else if (registry.sourceOf(module.id) === 'builtin') {
          const identical = AXM.Utils.canonicalJson(existing) === AXM.Utils.canonicalJson(module);
          builtInCollisions.push({ moduleId: module.id, identical, blocked: !identical });
        } else customUpdates.push(module.id);
      }
      const provenanceItems = modules.map((module) => module.provenance || {});
      const unresolvedLicenses = provenanceItems.filter((item) => /unset|unknown|pending/i.test(item.license || '')).length;
      const blocked = !report.valid || Boolean(pkg?.integrity?.value && !integrity.verified) || builtInCollisions.some((item) => item.blocked);
      return {
        schema: pkg?.schema || 'unknown',
        name: pkg?.name || pkg?.packageId || 'Unnamed package',
        version: pkg?.version || 'unknown',
        valid: report.valid,
        blocked,
        report,
        integrity,
        counts: { modules: modules.length, newCustom: newCustom.length, customUpdates: customUpdates.length, builtInMatches: builtInCollisions.filter((item) => item.identical).length },
        newCustom, customUpdates, builtInCollisions, unresolvedLicenses,
        sharing: AXM.Utils.clone(pkg?.sharing || null)
      };
    },

    async importPackage(pkg, registry) {
      const report = AXM.Validator.validatePackage(pkg, registry);
      if (!report.valid) {
        const message = report.errors.map((item) => item.message).join(' ');
        throw new Error(`Package rejected: ${message}`);
      }
      const integrity = await this.verifyIntegrity(pkg);
      if (pkg.integrity?.value && !integrity.verified) {
        throw new Error('Package integrity verification failed. No modules were imported.');
      }
      const staging = registry.clone();
      const imported = [];
      if (pkg.schema === 'axm.visual-module-package/1') {
        for (const module of pkg.modules) {
          const existing = staging.get(module.id);
          if (existing && staging.sourceOf(module.id) === 'builtin') {
            if (AXM.Utils.canonicalJson(existing) !== AXM.Utils.canonicalJson(module)) {
              throw new Error(`Package attempts to replace built-in module ${module.id}. Import stopped.`);
            }
            continue;
          }
          staging.register(module, { source: 'custom', overwrite: Boolean(existing) });
          imported.push(module.id);
        }
        const stagedReport = AXM.Validator.validateCatalog(staging);
        if (!stagedReport.valid) throw new Error(`Package rejected after staged closure validation: ${stagedReport.errors.map((item) => item.message).join(' ')}`);
        registry.replaceFrom(staging);
        return { type: 'module', imported, entryModuleId: pkg.entryModuleId, integrity };
      }
      if (pkg.schema === 'axm.visual-recipe-package/1') {
        for (const module of pkg.bundledCustomModules || []) {
          const existing = staging.get(module.id);
          if (existing && staging.sourceOf(module.id) === 'builtin') {
            throw new Error(`Recipe package attempts to replace built-in module ${module.id}.`);
          }
          staging.register(module, { source: 'custom', overwrite: Boolean(existing) });
          imported.push(module.id);
        }
        const stagedReport = AXM.Validator.validateCatalog(staging);
        if (!stagedReport.valid) throw new Error(`Recipe package rejected after staged closure validation: ${stagedReport.errors.map((item) => item.message).join(' ')}`);
        const recipeReport = AXM.Validator.validateRecipe(pkg.recipe, staging);
        if (!recipeReport.valid) {
          throw new Error(`Bundled recipe is invalid after dependency import: ${recipeReport.errors.map((item) => item.message).join(' ')}`);
        }
        registry.replaceFrom(staging);
        return { type: 'recipe', imported, recipe: AXM.Utils.clone(pkg.recipe), integrity };
      }
      throw new Error('Unsupported package schema.');
    }
  };
})(typeof globalThis !== 'undefined' ? globalThis : window);


/* src/core/composer.js */
(function (root) {
  'use strict';
  const AXM = root.AXM;

  const DEFAULT_GLOBALS = {
    mood: 'nocturne',
    intensity: 0.72,
    depth: 0.64,
    motion: 0.68,
    quality: 'auto',
    resolvedQuality: 'high',
    performanceBias: 'balanced',
    reducedMotion: false,
    photosensitiveSafe: false,
    highContrast: false,
    largeText: false
  };
  const MAX_COMPOSITE_DEPTH = 64;
  const MAX_RENDER_ITEMS = 2048;

  function clampParam(definition, value) {
    if (definition.type === 'number') {
      let number = Number(value);
      if (!Number.isFinite(number)) number = Number(definition.default);
      if (Number.isFinite(definition.min)) number = Math.max(definition.min, number);
      if (Number.isFinite(definition.max)) number = Math.min(definition.max, number);
      return number;
    }
    if (definition.type === 'boolean') return Boolean(value);
    if (definition.type === 'select' && Array.isArray(definition.options)) {
      return definition.options.includes(value) ? value : definition.default;
    }
    return value ?? definition.default;
  }

  AXM.Composer = class Composer {
    constructor(registry, adapter) {
      this.registry = registry;
      this.adapter = adapter;
    }

    createDefaultRecipe() {
      return {
        schema: 'axm.visual-recipe/1',
        id: AXM.Utils.uid('recipe'),
        name: 'AXM Command Surface',
        version: '1.0.0',
        status: 'WORKING',
        sceneId: 'scene.dashboard',
        globals: AXM.Utils.clone(DEFAULT_GLOBALS),
        layers: [
          this.instance('material.aetherglass', { opacity: 0.78, blur: 18, edge: 0.58 }),
          this.instance('light.neon-edge-glow', { intensity: 0.58, spread: 16 }),
          this.instance('light.ambient-backwash', { intensity: 0.38 }),
          this.instance('light.soft-bloom-halo', { intensity: 0.34, radius: 42 }),
          this.instance('light.reflection-streak', { intensity: 0.32, speed: 8 }),
          this.instance('depth.layered-shadow', { distance: 18, softness: 38 }),
          this.instance('motion.hover-lift', { height: 5 }),
          this.instance('focus.halo', { intensity: 0.52 }),
          this.instance('atmosphere.ambient-field', { density: 0.38, intensity: 0.3 }),
          this.instance('atmosphere.vignette', { intensity: 0.32 }),
          this.instance('motion.click-ripple', { intensity: 0.32 })
        ],
        provenance: {
          creator: 'Mike — Axiom/Mir',
          created: new Date().toISOString(),
          lastModified: new Date().toISOString(),
          source: 'AXM AetherFX Visual Effect Fabric local studio',
          license: 'UNSET — choose before public sharing'
        }
      };
    }

    instance(moduleId, params = {}, enabled = true) {
      const module = this.registry.get(moduleId);
      if (!module) throw new Error(`Unknown module: ${moduleId}`);
      return {
        instanceId: AXM.Utils.uid('layer'),
        moduleId,
        enabled,
        params: { ...this.registry.defaultParams(module), ...params }
      };
    }

    normalizeRecipe(recipe) {
      const normalized = AXM.Utils.clone(recipe || this.createDefaultRecipe());
      normalized.schema = 'axm.visual-recipe/1';
      normalized.id ||= AXM.Utils.uid('recipe');
      normalized.name ||= 'Untitled AXM Recipe';
      normalized.version ||= '1.0.0';
      normalized.sceneId = this.registry.has(normalized.sceneId) ? normalized.sceneId : 'scene.dashboard';
      normalized.globals = { ...DEFAULT_GLOBALS, ...(normalized.globals || {}) };
      normalized.layers = Array.isArray(normalized.layers) ? normalized.layers : [];
      normalized.layers = normalized.layers.map((layer) => {
        const module = this.registry.get(layer.moduleId);
        return {
          instanceId: layer.instanceId || AXM.Utils.uid('layer'),
          moduleId: layer.moduleId,
          enabled: layer.enabled !== false,
          ...(layer.targetRole ? { targetRole: layer.targetRole } : {}),
          params: module ? this.sanitizeParams(module, layer.params || {}) : (layer.params || {})
        };
      });
      normalized.provenance = {
        creator: 'Mike — Axiom/Mir',
        created: new Date().toISOString(),
        source: 'AXM AetherFX Visual Effect Fabric local studio',
        license: 'UNSET — choose before public sharing',
        ...(normalized.provenance || {}),
        lastModified: new Date().toISOString()
      };
      return normalized;
    }

    sanitizeParams(module, params) {
      const definitions = new Map((module.parameters || []).map((definition) => [definition.id, definition]));
      const merged = { ...this.registry.defaultParams(module), ...(params || {}) };
      return Object.fromEntries([...definitions.entries()].map(([id, definition]) => [id, clampParam(definition, merged[id])]));
    }

    resolveQuality(module, quality) {
      const tier = module.quality?.[quality] || { enabled: true };
      if (tier.enabled === false) {
        return {
          enabled: false,
          fallbackModuleId: tier.fallbackModuleId || null,
          parameterOverrides: tier.parameterOverrides || {}
        };
      }
      return { enabled: true, fallbackModuleId: null, parameterOverrides: tier.parameterOverrides || {} };
    }

    compile(recipe) {
      const normalized = this.normalizeRecipe(recipe);
      const report = AXM.Validator.validateRecipe(normalized, this.registry);
      const plan = [];
      const resolvedQuality = normalized.globals.quality === 'auto'
        ? (normalized.globals.resolvedQuality || 'high')
        : normalized.globals.quality;
      const exclusiveSeen = new Map();
      const warnings = [...report.warnings];

      const expand = (moduleId, inputParams, context, stack = []) => {
        if (stack.includes(moduleId)) {
          report.errors.push({ code: 'COMPOSITE_CYCLE', message: `Composite cycle: ${[...stack, moduleId].join(' → ')}`, path: context.path });
          return;
        }
        if (stack.length >= MAX_COMPOSITE_DEPTH) {
          report.errors.push({ code: 'COMPOSITE_DEPTH_BUDGET', message: `Composition exceeds the ${MAX_COMPOSITE_DEPTH}-level safety depth.`, path: context.path });
          return;
        }
        if (plan.length >= MAX_RENDER_ITEMS) {
          report.errors.push({ code: 'RENDER_PLAN_BUDGET', message: `Resolved plan exceeds the ${MAX_RENDER_ITEMS}-item safety budget.`, path: context.path });
          return;
        }
        let module = this.registry.get(moduleId);
        if (!module) {
          report.errors.push({ code: 'UNKNOWN_MODULE', message: `Unknown module: ${moduleId}`, path: context.path });
          return;
        }

        const qualityDecision = this.resolveQuality(module, resolvedQuality);
        if (!qualityDecision.enabled) {
          if (qualityDecision.fallbackModuleId) {
            warnings.push({ code: 'QUALITY_FALLBACK', message: `${module.name} became ${qualityDecision.fallbackModuleId} at ${resolvedQuality} quality.`, path: context.path });
            expand(qualityDecision.fallbackModuleId, {}, { ...context, source: 'fallback', fallbackOf: module.id }, [...stack, moduleId]);
          } else {
            warnings.push({ code: 'QUALITY_DISABLED', message: `${module.name} is disabled at ${resolvedQuality} quality.`, path: context.path });
          }
          return;
        }

        let params = this.sanitizeParams(module, { ...(inputParams || {}), ...qualityDecision.parameterOverrides });

        if (module.renderer?.type === 'derived') {
          const inherited = { ...params, ...(module.renderer.parameterOverrides || {}) };
          expand(module.renderer.baseModuleId, inherited, { ...context, source: `derived:${module.id}` }, [...stack, moduleId]);
          return;
        }

        if (module.renderer?.type === 'composite') {
          (module.renderer.layers || []).forEach((layer, index) => {
            const childParams = { ...(layer.params || {}) };
            Object.entries(layer.bindings || {}).forEach(([childParamId, parentParamId]) => {
              if (Object.prototype.hasOwnProperty.call(params, parentParamId)) childParams[childParamId] = params[parentParamId];
            });
            expand(layer.moduleId, childParams, {
              ...context,
              targetRole: layer.targetRole || context.targetRole || null,
              path: `${context.path}.composite[${index}]`,
              source: `composite:${module.id}`
            }, [...stack, moduleId]);
          });
          return;
        }

        if (module.exclusiveGroup) {
          const priorIndex = exclusiveSeen.get(module.exclusiveGroup);
          if (priorIndex !== undefined) {
            plan[priorIndex].superseded = true;
            warnings.push({ code: 'EXCLUSIVE_REPLACED', message: `${module.name} replaced another ${module.exclusiveGroup} module.`, path: context.path });
          }
          exclusiveSeen.set(module.exclusiveGroup, plan.length);
        }

        plan.push({
          instanceId: context.instanceId,
          moduleId: module.id,
          module,
          params,
          source: context.source,
          targetRole: context.targetRole || null,
          fallbackOf: context.fallbackOf || null,
          path: context.path,
          superseded: false
        });
      };

      normalized.layers.forEach((layer, index) => {
        if (layer.enabled === false) return;
        expand(layer.moduleId, layer.params || {}, {
          instanceId: layer.instanceId,
          source: 'recipe',
          targetRole: layer.targetRole || null,
          path: `layers[${index}]`
        });
      });

      return {
        recipe: normalized,
        plan: plan.filter((item) => !item.superseded),
        report: { errors: report.errors, warnings, notes: report.notes, valid: report.errors.length === 0 },
        resolvedQuality
      };
    }

    render(recipe) {
      const compiled = this.compile(recipe);
      if (!compiled.report.valid) return compiled;
      this.adapter.render(compiled, this.registry);
      return compiled;
    }
  };
})(typeof globalThis !== 'undefined' ? globalThis : window);


/* src/core/intent.js */
(function (root) {
  'use strict';
  const AXM = root.AXM;

  const TARGET_PROFILES = {
    'engine-neutral': {
      name: 'Engine-neutral contract',
      support: { class: 'contract', overlay: 'contract', interaction: 'contract' },
      note: 'Intent only. A target adapter must explicitly implement or approximate every operation.'
    },
    'web-css': {
      name: 'AXM web/CSS runtime',
      support: { class: 'implemented', overlay: 'implemented', interaction: 'implemented' },
      note: 'Implemented by the bundled AXM web adapter.'
    },
    'static-svg': {
      name: 'Static SVG approximation',
      support: { class: 'approximated', overlay: 'approximated', interaction: 'unsupported' },
      note: 'Motion and pointer behavior cannot survive a static SVG export.'
    },
    'godot-theme': {
      name: 'Godot 4 theme bridge',
      support: { class: 'approximated', overlay: 'contract', interaction: 'unsupported' },
      note: 'Theme tokens are generated; shaders, particles, and interactions require native implementation.'
    },
    'unity-uitoolkit': {
      name: 'Unity UI Toolkit bridge',
      support: { class: 'approximated', overlay: 'contract', interaction: 'unsupported' },
      note: 'USS tokens are generated; materials, particles, and interactions require native implementation.'
    },
    'generic-game-contract': {
      name: 'Generic game renderer contract',
      support: { class: 'contract', overlay: 'contract', interaction: 'contract' },
      note: 'Portable intent only; no native engine parity is claimed.'
    }
  };

  function profileFor(target) {
    return TARGET_PROFILES[target] || TARGET_PROFILES['engine-neutral'];
  }

  function supportFor(item, target) {
    const profile = profileFor(target);
    const rendererType = item.module?.renderer?.type || 'unknown';
    return {
      target,
      status: profile.support[rendererType] || 'unsupported',
      note: profile.note
    };
  }

  function create(compiled, registry, options = {}) {
    if (!compiled?.report?.valid) throw new Error('Cannot create visual intent from an invalid composition.');
    const target = options.target || 'engine-neutral';
    const sceneModule = registry.get(compiled.recipe.sceneId);
    const operations = compiled.plan.map((item, index) => ({
      order: index,
      instanceId: item.instanceId,
      moduleId: item.moduleId,
      version: item.module.version,
      kind: item.module.kind,
      category: item.module.category,
      role: item.module.role || item.module.category,
      targetRole: item.targetRole || null,
      renderer: AXM.Utils.clone(item.module.renderer),
      parameters: AXM.Utils.clone(item.params),
      source: item.source,
      fallbackOf: item.fallbackOf || null,
      quality: AXM.Utils.clone(item.module.quality),
      accessibility: AXM.Utils.clone(item.module.accessibility),
      support: supportFor(item, target)
    }));
    const counts = operations.reduce((result, operation) => {
      result[operation.support.status] = (result[operation.support.status] || 0) + 1;
      return result;
    }, {});
    return {
      schema: 'axm.resolved-visual-intent/1',
      contractVersion: '1.0.0',
      generatedBy: `AXM AetherFX Visual Effect Fabric v${AXM.version}`,
      generatedAt: options.generatedAt || new Date().toISOString(),
      target: {
        id: target,
        name: profileFor(target).name,
        boundary: profileFor(target).note
      },
      scene: {
        id: compiled.recipe.sceneId,
        name: sceneModule?.name || compiled.recipe.sceneId,
        renderer: sceneModule?.renderer?.sceneRenderer || null
      },
      quality: compiled.resolvedQuality,
      globals: AXM.Utils.clone(compiled.recipe.globals),
      accessibility: {
        reducedMotion: Boolean(compiled.recipe.globals.reducedMotion),
        photosensitiveSafe: Boolean(compiled.recipe.globals.photosensitiveSafe),
        highContrast: Boolean(compiled.recipe.globals.highContrast),
        largeText: Boolean(compiled.recipe.globals.largeText)
      },
      operations,
      supportSummary: {
        total: operations.length,
        implemented: counts.implemented || 0,
        approximated: counts.approximated || 0,
        contract: counts.contract || 0,
        unsupported: counts.unsupported || 0
      },
      provenance: AXM.Utils.clone(compiled.recipe.provenance)
    };
  }

  function targetReport(compiled, registry, target, options = {}) {
    const intent = create(compiled, registry, { target, generatedAt: options.generatedAt });
    return {
      schema: 'axm.adapter-support-report/1',
      generatedBy: intent.generatedBy,
      generatedAt: intent.generatedAt,
      target: intent.target,
      scene: intent.scene,
      quality: intent.quality,
      accessibility: intent.accessibility,
      summary: intent.supportSummary,
      operations: intent.operations.map((operation) => ({
        order: operation.order,
        moduleId: operation.moduleId,
        rendererType: operation.renderer.type,
        scope: operation.renderer.scope || 'scene',
        status: operation.support.status,
        fallbackOf: operation.fallbackOf
      }))
    };
  }

  AXM.Intent = {
    schema: 'axm.resolved-visual-intent/1',
    targetProfiles: AXM.Utils.clone(TARGET_PROFILES),
    create,
    targetReport
  };
})(typeof globalThis !== 'undefined' ? globalThis : window);


/* src/core/performance.js */
(function (root) {
  'use strict';
  const AXM = root.AXM;

  const QUALITY_ORDER = ['low', 'medium', 'high'];
  const QUALITY_MULTIPLIER = { low: 0.48, medium: 0.72, high: 1, cinematic: 1.35 };
  const BIAS = {
    battery: { target: 48, upgrade: 59, initialCap: 'medium', costCap: 48 },
    balanced: { target: 54, upgrade: 59, initialCap: 'high', costCap: 70 },
    quality: { target: 48, upgrade: 57, initialCap: 'high', costCap: 92 }
  };

  function clampQuality(quality, cap) {
    const qualityIndex = QUALITY_ORDER.indexOf(quality);
    const capIndex = QUALITY_ORDER.indexOf(cap);
    if (qualityIndex < 0) return cap;
    return QUALITY_ORDER[Math.min(qualityIndex, capIndex)];
  }

  function baseModuleCost(item) {
    const id = String(item?.moduleId || '');
    const renderer = item?.module?.renderer || {};
    let cost = renderer.type === 'overlay' ? 3 : renderer.type === 'interaction' ? 2 : 1.2;
    if (/blur|bloom|frost|liquid|crystal|reflection|prism|dispersion|caustic|godray|volumetric|aurora|fog/i.test(id)) cost += 3.4;
    if (/particle|dust|rain|atmosphere|field/i.test(id)) cost += 2.8;
    if (/shimmer|sweep|scanline|pulse|ripple|parallax|magnetic|spring|trail/i.test(id)) cost += 1.8;
    if (/shadow|vignette|focus|edge|rim|halo/i.test(id)) cost += 0.9;
    if (renderer.generatedCount) cost += Math.min(4, Number(renderer.generatedCount || 0) / 10);
    return cost;
  }

  function percentile(values, fraction) {
    if (!values.length) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    return sorted[Math.max(0, Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * fraction)))];
  }

  AXM.PerformanceGovernor = class PerformanceGovernor {
    constructor(options = {}) {
      this.onChange = options.onChange || (() => {});
      this.samples = [];
      this.running = false;
      this.last = 0;
      this.bias = options.bias || 'balanced';
      this.lastDecision = this.detectInitialQuality();
      this.stableSince = (root.performance?.now?.() || Date.now());
      this.frame = null;
      this.lastEvaluation = null;
      this.transitions = [];
    }

    static estimatePlan(plan = [], quality = 'high', globals = {}) {
      const effectiveQuality = quality === 'auto' ? (globals.resolvedQuality || 'high') : quality;
      const qualityMultiplier = QUALITY_MULTIPLIER[effectiveQuality] || 1;
      const motionMultiplier = globals.reducedMotion ? 0.72 : 0.82 + Number(globals.motion ?? 0.68) * 0.38;
      const safetyMultiplier = globals.photosensitiveSafe ? 0.86 : 1;
      const items = plan.map((item) => ({
        moduleId: item.moduleId,
        name: item.module?.name || item.moduleId,
        score: Number((baseModuleCost(item) * qualityMultiplier * motionMultiplier * safetyMultiplier).toFixed(2))
      })).sort((a, b) => b.score - a.score);
      const score = Number(items.reduce((sum, item) => sum + item.score, 0).toFixed(2));
      const tier = score < 30 ? 'light' : score < 58 ? 'balanced' : score < 88 ? 'heavy' : 'extreme';
      const recommendedQuality = score > 95 ? 'low' : score > 66 ? 'medium' : 'high';
      return {
        score,
        tier,
        recommendedQuality,
        resolvedQuality: effectiveQuality,
        activeModules: plan.length,
        topContributors: items.slice(0, 8),
        note: 'Estimated visual load from declared effect behavior. Actual device performance is measured separately in FPS.'
      };
    }

    detectInitialQuality() {
      const nav = root.navigator || {};
      const memory = Number(nav.deviceMemory || 0);
      const cores = Number(nav.hardwareConcurrency || 0);
      const reduced = Boolean(root.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches);
      let quality = 'high';
      if ((memory && memory <= 2) || (cores && cores <= 2)) quality = 'low';
      else if ((memory && memory <= 4) || (cores && cores <= 4) || reduced) quality = 'medium';
      return clampQuality(quality, (BIAS[this.bias] || BIAS.balanced).initialCap);
    }

    setBias(bias) {
      if (!BIAS[bias]) return;
      this.bias = bias;
      this.lastDecision = clampQuality(this.lastDecision, BIAS[bias].initialCap);
      this.stableSince = root.performance?.now?.() || Date.now();
    }

    start() {
      if (this.running || typeof root.requestAnimationFrame !== 'function') return;
      this.running = true;
      this.last = root.performance?.now?.() || Date.now();
      const tick = (now) => {
        if (!this.running) return;
        const delta = now - this.last;
        this.last = now;
        if (delta > 0 && delta < 1000) this.samples.push(1000 / delta);
        if (this.samples.length > 180) this.samples.shift();
        if (this.samples.length >= 75) this.evaluate(now);
        this.frame = root.requestAnimationFrame(tick);
      };
      this.frame = root.requestAnimationFrame(tick);
    }

    stop() {
      this.running = false;
      if (this.frame && typeof root.cancelAnimationFrame === 'function') root.cancelAnimationFrame(this.frame);
      this.frame = null;
    }

    evaluate(now) {
      const average = this.averageFps;
      const lowPercentile = percentile(this.samples, 0.1);
      const profile = BIAS[this.bias] || BIAS.balanced;
      const currentIndex = QUALITY_ORDER.indexOf(this.lastDecision);
      let decision = this.lastDecision;
      let reason = 'stable';

      const severeDrop = average < profile.target - 12 || lowPercentile < profile.target - 20;
      const belowTarget = average < profile.target || lowPercentile < profile.target - 10;
      const strongHeadroom = average > profile.upgrade && lowPercentile > profile.target;
      const timeStable = now - this.stableSince;

      if (severeDrop && currentIndex > 0 && timeStable > 1600) {
        decision = QUALITY_ORDER[Math.max(0, currentIndex - 1)];
        reason = 'sustained frame loss';
      } else if (belowTarget && currentIndex > 0 && timeStable > 3000) {
        decision = QUALITY_ORDER[currentIndex - 1];
        reason = 'below target';
      } else if (strongHeadroom && currentIndex < QUALITY_ORDER.length - 1 && timeStable > 9000) {
        decision = QUALITY_ORDER[currentIndex + 1];
        decision = clampQuality(decision, profile.initialCap);
        reason = 'stable headroom';
      }

      this.lastEvaluation = { average, lowPercentile, decision, reason, bias: this.bias, at: new Date().toISOString() };
      if (decision !== this.lastDecision) {
        const prior = this.lastDecision;
        this.lastDecision = decision;
        this.stableSince = now;
        this.transitions.push({ from: prior, to: decision, reason, fps: average, lowPercentile, at: new Date().toISOString() });
        if (this.transitions.length > 20) this.transitions.shift();
        this.onChange({ quality: decision, fps: average, lowPercentile, reason, bias: this.bias });
      }
    }

    get averageFps() {
      if (!this.samples.length) return 0;
      return this.samples.reduce((sum, value) => sum + value, 0) / this.samples.length;
    }

    get lowPercentileFps() {
      return percentile(this.samples, 0.1);
    }

    snapshot() {
      const nav = root.navigator || {};
      return {
        bias: this.bias,
        decision: this.lastDecision,
        averageFps: Number(this.averageFps.toFixed(1)),
        lowPercentileFps: Number(this.lowPercentileFps.toFixed(1)),
        sampleCount: this.samples.length,
        hardware: {
          logicalProcessors: Number(nav.hardwareConcurrency || 0) || null,
          deviceMemoryGb: Number(nav.deviceMemory || 0) || null,
          reducedMotionPreference: Boolean(root.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches)
        },
        lastEvaluation: this.lastEvaluation,
        transitions: [...this.transitions]
      };
    }
  };
})(typeof globalThis !== 'undefined' ? globalThis : window);


/* src/runtime/runtime.js */
(function (root) {
  'use strict';
  const AXM = root.AXM;

  AXM.AetherRuntime = class AetherRuntime {
    constructor(options = {}) {
      const catalog = options.catalog || root.AXM_DEFAULT_CATALOG;
      if (!catalog) throw new Error('AetherRuntime requires an AXM catalog.');
      this.baseCatalog = AXM.Utils.clone(catalog);
      this.adapter = options.adapter || { render() {} };
      this.registry = new AXM.ModuleRegistry(this.baseCatalog);
      this.composer = new AXM.Composer(this.registry, this.adapter);
      if (options.customModules?.length) this.registerModules(options.customModules);
      this.recipe = options.recipe ? this.acceptRecipe(options.recipe) : this.composer.createDefaultRecipe();
    }

    acceptRecipe(rawRecipe) {
      const rawReport = AXM.Validator.validateRecipe(rawRecipe, this.registry);
      if (!rawReport.valid) {
        throw new Error(`Raw recipe rejected before normalization: ${rawReport.errors.map((item) => item.message).join(' ')}`);
      }
      const normalized = this.composer.normalizeRecipe(rawRecipe);
      const normalizedReport = AXM.Validator.validateRecipe(normalized, this.registry);
      if (!normalizedReport.valid) {
        throw new Error(`Normalized recipe rejected: ${normalizedReport.errors.map((item) => item.message).join(' ')}`);
      }
      return normalized;
    }

    setRecipe(rawRecipe) {
      this.recipe = this.acceptRecipe(rawRecipe);
      return AXM.Utils.clone(this.recipe);
    }

    validate(rawRecipe = this.recipe) {
      return AXM.Validator.validateRecipe(rawRecipe, this.registry);
    }

    compile(rawRecipe = this.recipe) {
      return this.composer.compile(rawRecipe);
    }

    render(rawRecipe = this.recipe) {
      const accepted = rawRecipe === this.recipe ? this.recipe : this.acceptRecipe(rawRecipe);
      const compiled = this.composer.render(accepted);
      if (!compiled.report.valid) throw new Error(compiled.report.errors.map((item) => item.message).join(' '));
      return compiled;
    }

    intent(options = {}) {
      const compiled = this.compile(options.recipe || this.recipe);
      return AXM.Intent.create(compiled, this.registry, { target: options.target || 'engine-neutral' });
    }

    targetReport(target, recipe = this.recipe) {
      return AXM.Intent.targetReport(this.compile(recipe), this.registry, target);
    }

    estimate(recipe = this.recipe) {
      const compiled = this.compile(recipe);
      return AXM.PerformanceGovernor.estimatePlan(compiled.plan, compiled.resolvedQuality, compiled.recipe.globals);
    }

    registerModules(modules) {
      if (!Array.isArray(modules)) throw new TypeError('registerModules requires an array.');
      const staging = this.registry.clone();
      for (const module of modules) {
        if (staging.sourceOf(module?.id) === 'builtin') throw new Error(`Custom module collides with built-in ${module.id}.`);
        staging.register(module, { source: 'custom', overwrite: staging.sourceOf(module.id) === 'custom' });
      }
      const report = AXM.Validator.validateCatalog(staging);
      if (!report.valid) throw new Error(`Custom module transaction rejected: ${report.errors.map((item) => item.message).join(' ')}`);
      this.registry.replaceFrom(staging);
      return this.registry.customModules().map((module) => module.id);
    }

    async reviewPackage(pkg) {
      return AXM.PackageIO.previewPackage(pkg, this.registry);
    }

    async importPackage(pkg) {
      const result = await AXM.PackageIO.importPackage(pkg, this.registry);
      if (result.type === 'recipe') this.recipe = this.acceptRecipe(result.recipe);
      return result;
    }

    snapshot() {
      return {
        schema: 'axm.runtime-snapshot/1',
        fabricVersion: AXM.version,
        created: new Date().toISOString(),
        recipe: AXM.Utils.clone(this.recipe),
        customModules: AXM.Utils.clone(this.registry.customModules())
      };
    }

    restore(snapshot) {
      if (snapshot?.schema !== 'axm.runtime-snapshot/1' || !snapshot.recipe || !Array.isArray(snapshot.customModules)) {
        throw new Error('Invalid AXM runtime snapshot.');
      }
      const candidate = new AXM.ModuleRegistry(this.baseCatalog);
      for (const module of snapshot.customModules) {
        if (candidate.has(module.id)) throw new Error(`Snapshot module collides with built-in ${module.id}.`);
        candidate.register(module, { source: 'custom' });
      }
      const catalogReport = AXM.Validator.validateCatalog(candidate);
      if (!catalogReport.valid) throw new Error(`Snapshot registry rejected: ${catalogReport.errors.map((item) => item.message).join(' ')}`);
      const recipeReport = AXM.Validator.validateRecipe(snapshot.recipe, candidate);
      if (!recipeReport.valid) throw new Error(`Snapshot recipe rejected: ${recipeReport.errors.map((item) => item.message).join(' ')}`);
      this.registry.replaceFrom(candidate);
      this.recipe = this.composer.normalizeRecipe(snapshot.recipe);
      return this.snapshot();
    }

    exportCatalog() {
      return this.registry.exportCatalog();
    }
  };
})(typeof globalThis !== 'undefined' ? globalThis : window);

