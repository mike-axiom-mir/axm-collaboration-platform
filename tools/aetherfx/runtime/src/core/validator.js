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
