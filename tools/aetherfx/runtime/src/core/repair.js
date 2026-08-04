(function (root) {
  'use strict';
  const AXM = root.AXM;

  function same(a, b) {
    try { return AXM.Utils.canonicalJson(a) === AXM.Utils.canonicalJson(b); }
    catch { return false; }
  }

  AXM.RepairCenter = {
    analyzeRecipe(inputRecipe, registry, composer) {
      const source = AXM.Utils.clone(inputRecipe || {});
      const actions = [];
      const warnings = [];
      const repaired = AXM.Utils.clone(source);

      if (!registry.has(repaired.sceneId) || registry.get(repaired.sceneId)?.kind !== 'scene') {
        actions.push({ code: 'SCENE_RESTORED', message: `Unknown scene “${repaired.sceneId || 'missing'}” will become scene.dashboard.` });
        repaired.sceneId = 'scene.dashboard';
      }

      if (!Array.isArray(repaired.layers)) {
        actions.push({ code: 'LAYERS_REBUILT', message: 'Missing layer list will be replaced with the working foundation.' });
        repaired.layers = [];
      }

      const seenIds = new Set();
      const exclusive = new Map();
      const kept = [];
      for (const original of repaired.layers || []) {
        if (!original || typeof original.moduleId !== 'string' || !registry.has(original.moduleId)) {
          actions.push({ code: 'MISSING_MODULE_REMOVED', message: `Removed unresolved layer “${original?.moduleId || 'unknown'}”.` });
          continue;
        }
        const module = registry.get(original.moduleId);
        const layer = AXM.Utils.clone(original);
        if (!layer.instanceId || seenIds.has(layer.instanceId)) {
          const prior = layer.instanceId || 'missing';
          layer.instanceId = AXM.Utils.uid('layer');
          actions.push({ code: 'INSTANCE_ID_REPAIRED', message: `Regenerated duplicate or missing layer id “${prior}”.` });
        }
        seenIds.add(layer.instanceId);

        const beforeParams = AXM.Utils.clone(layer.params || {});
        layer.params = composer.sanitizeParams(module, layer.params || {});
        if (!same(beforeParams, layer.params)) actions.push({ code: 'PARAMETERS_NORMALIZED', message: `Clamped or removed unsupported parameters for ${module.name}.` });
        layer.enabled = layer.enabled !== false;

        if (layer.enabled && module.exclusiveGroup) {
          const priorIndex = exclusive.get(module.exclusiveGroup);
          if (priorIndex !== undefined) {
            kept[priorIndex].enabled = false;
            actions.push({ code: 'EXCLUSIVE_COLLISION_RESOLVED', message: `Disabled the earlier ${module.exclusiveGroup} layer so ${module.name} remains authoritative.` });
          }
          exclusive.set(module.exclusiveGroup, kept.length);
        }
        kept.push(layer);
      }
      repaired.layers = kept;

      if (!repaired.layers.length) {
        const fallback = composer.createDefaultRecipe();
        repaired.layers = fallback.layers;
        repaired.sceneId = fallback.sceneId;
        actions.push({ code: 'FOUNDATION_RESTORED', message: 'The empty or unrecoverable stack was replaced with the verified working foundation.' });
      }

      const priorGlobals = AXM.Utils.clone(repaired.globals || {});
      const normalized = composer.normalizeRecipe(repaired);
      if (!same(priorGlobals, normalized.globals)) actions.push({ code: 'GLOBALS_NORMALIZED', message: 'Global mood, quality, accessibility, or intensity settings were normalized.' });

      const beforeReport = AXM.Validator.validateRecipe(composer.normalizeRecipe(source), registry);
      const afterReport = AXM.Validator.validateRecipe(normalized, registry);
      if (!actions.length) warnings.push({ code: 'NO_REPAIR_NEEDED', message: 'No repairable drift was detected. The recipe is already normalized.' });

      return {
        repaired: normalized,
        changed: actions.length > 0,
        actions,
        warnings,
        before: { errors: beforeReport.errors, warnings: beforeReport.warnings },
        after: { errors: afterReport.errors, warnings: afterReport.warnings, valid: afterReport.valid }
      };
    },

    analyzeRegistry(registry) {
      const invalidCustom = [];
      const dependencyErrors = [];
      for (const module of registry.customModules()) {
        const report = AXM.Validator.validateModule(module, registry);
        if (!report.valid) invalidCustom.push({ moduleId: module.id, name: module.name, errors: report.errors });
        try { registry.dependencyClosure(module.id); }
        catch (error) { dependencyErrors.push({ moduleId: module.id, name: module.name, message: error.message }); }
      }
      return { invalidCustom, dependencyErrors, clean: !invalidCustom.length && !dependencyErrors.length };
    }
  };
})(typeof globalThis !== 'undefined' ? globalThis : window);
