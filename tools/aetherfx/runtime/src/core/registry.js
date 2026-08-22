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
