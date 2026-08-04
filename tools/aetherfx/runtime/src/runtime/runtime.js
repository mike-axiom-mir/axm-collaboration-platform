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
