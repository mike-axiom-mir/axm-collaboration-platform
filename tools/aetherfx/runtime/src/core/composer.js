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
