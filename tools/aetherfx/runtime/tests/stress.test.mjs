import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
function runtime() {
  const context = vm.createContext({ console, crypto: webcrypto, TextEncoder, structuredClone, setTimeout, clearTimeout, performance: { now: () => Date.now() } });
  context.globalThis = context; context.window = context;
  for (const rel of ['src/core/namespace.js','src/catalog/catalog.generated.js','src/core/registry.js','src/core/validator.js','src/core/history.js','src/core/package-io.js','src/core/composer.js','src/core/performance.js','src/core/repair.js']) {
    vm.runInContext(fs.readFileSync(path.join(ROOT, rel), 'utf8'), context, { filename: rel });
  }
  return context;
}

test('large 320-layer composition compiles deterministically without recursion failure', () => {
  const c = runtime();
  const registry = new c.AXM.ModuleRegistry(c.AXM_DEFAULT_CATALOG);
  const composer = new c.AXM.Composer(registry, { render() {} });
  const ids = ['atmosphere.vignette','light.neon-edge-glow','light.soft-bloom-halo','light.prismatic-dispersion','atmosphere.depth-fog','atmosphere.dust-motes','motion.hover-lift','focus.halo'];
  const recipe = composer.createDefaultRecipe();
  recipe.layers = Array.from({ length: 320 }, (_, index) => composer.instance(ids[index % ids.length]));
  const started = Date.now();
  const compiled = composer.compile(recipe);
  const elapsed = Date.now() - started;
  assert.equal(compiled.report.errors.length, 0, JSON.stringify(compiled.report.errors));
  assert.equal(compiled.plan.length, 320);
  assert.ok(elapsed < 2500, `compile took ${elapsed}ms`);
  const again = composer.compile(recipe);
  assert.deepEqual(compiled.plan.map(item => item.moduleId), again.plan.map(item => item.moduleId));
});

test('performance estimator stays transparent and recommends fallback for heavy plans', () => {
  const c = runtime();
  const registry = new c.AXM.ModuleRegistry(c.AXM_DEFAULT_CATALOG);
  const composer = new c.AXM.Composer(registry, { render() {} });
  const recipe = composer.createDefaultRecipe();
  recipe.globals.quality = 'cinematic';
  recipe.layers = Array.from({ length: 48 }, (_, index) => composer.instance(index % 2 ? 'light.godray-fan' : 'atmosphere.dust-motes'));
  const compiled = composer.compile(recipe);
  const load = c.AXM.PerformanceGovernor.estimatePlan(compiled.plan, compiled.resolvedQuality, recipe.globals);
  assert.ok(load.score > 90, `score ${load.score}`);
  assert.ok(['low','medium'].includes(load.recommendedQuality));
  assert.equal(load.topContributors.length, 8);
  assert.match(load.note, /Estimated visual load/);
});

test('repair center removes missing layers, fixes ids, clamps values, and preserves rollback-safe validity', () => {
  const c = runtime();
  const registry = new c.AXM.ModuleRegistry(c.AXM_DEFAULT_CATALOG);
  const composer = new c.AXM.Composer(registry, { render() {} });
  const recipe = composer.createDefaultRecipe();
  recipe.sceneId = 'scene.does-not-exist';
  recipe.layers = [
    { instanceId: 'duplicate', moduleId: 'missing.module', enabled: true, params: {} },
    { instanceId: 'duplicate', moduleId: 'light.neon-edge-glow', enabled: true, params: { intensity: 99, spread: -500, unknown: true } },
    { instanceId: 'duplicate', moduleId: 'light.neon-edge-glow', enabled: true, params: { intensity: -4 } }
  ];
  const report = c.AXM.RepairCenter.analyzeRecipe(recipe, registry, composer);
  assert.equal(report.changed, true);
  assert.equal(report.after.valid, true, JSON.stringify(report.after.errors));
  assert.ok(report.actions.some(item => item.code === 'MISSING_MODULE_REMOVED'));
  assert.ok(report.actions.some(item => item.code === 'INSTANCE_ID_REPAIRED'));
  assert.ok(report.actions.some(item => item.code === 'PARAMETERS_NORMALIZED'));
  assert.equal(new Set(report.repaired.layers.map(layer => layer.instanceId)).size, report.repaired.layers.length);
  assert.ok(report.repaired.layers.every(layer => registry.has(layer.moduleId)));
});

test('package preview is non-mutating and blocks altered built-ins before import', async () => {
  const c = runtime();
  const registry = new c.AXM.ModuleRegistry(c.AXM_DEFAULT_CATALOG);
  const before = registry.list({ includeHidden: true }).length;
  const valid = await c.AXM.PackageIO.createModulePackage('light.neon-edge-glow', registry, { packageId: 'preview.valid' });
  const preview = await c.AXM.PackageIO.previewPackage(valid, registry);
  assert.equal(preview.blocked, false);
  assert.equal(preview.integrity.verified, true);
  assert.equal(registry.list({ includeHidden: true }).length, before);
  const tampered = structuredClone(valid);
  delete tampered.integrity;
  tampered.modules.find(module => module.id === 'light.neon-edge-glow').name = 'Silent replacement';
  const blocked = await c.AXM.PackageIO.previewPackage(tampered, registry);
  assert.equal(blocked.blocked, true);
  assert.ok(blocked.builtInCollisions.some(item => item.blocked));
  assert.equal(registry.get('light.neon-edge-glow').name, 'Neon Edge Glow');
});
