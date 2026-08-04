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
