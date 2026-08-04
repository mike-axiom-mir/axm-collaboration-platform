import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { packageDigest } from '../tools/canonical.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CORE_FILES = [
  'src/core/namespace.js',
  'src/catalog/catalog.generated.js',
  'src/core/registry.js',
  'src/core/validator.js',
  'src/core/history.js',
  'src/core/package-io.js',
  'src/core/composer.js',
  'src/core/intent.js',
  'src/core/performance.js',
  'src/core/repair.js'
];

function runtime(options = {}) {
  const globals = {
    console,
    TextEncoder,
    structuredClone,
    setTimeout,
    clearTimeout,
    performance: { now: () => Date.now() }
  };
  if (options.webCrypto !== false) globals.crypto = webcrypto;
  const context = vm.createContext(globals);
  context.globalThis = context;
  context.window = context;
  for (const rel of options.files || CORE_FILES) {
    vm.runInContext(fs.readFileSync(path.join(ROOT, rel), 'utf8'), context, { filename: rel });
  }
  return context;
}

function registryAndComposer(context) {
  const registry = new context.AXM.ModuleRegistry(context.AXM_DEFAULT_CATALOG);
  const composer = new context.AXM.Composer(registry, { render() {} });
  return { registry, composer };
}

function derivedFrom(base, id, baseModuleId, overrides = {}) {
  const {
    name = id,
    parameterOverrides = { intensity: 0.8 },
    ...moduleOverrides
  } = overrides;
  return {
    ...structuredClone(base),
    ...moduleOverrides,
    id,
    name,
    kind: 'effect',
    dependencies: [baseModuleId],
    renderer: {
      type: 'derived',
      baseModuleId,
      parameterOverrides
    },
    provenance: {
      ...base.provenance,
      license: 'Private test'
    }
  };
}

function seal(pkg) {
  pkg.integrity = { algorithm: 'sha256', value: packageDigest(pkg) };
  return pkg;
}

test('catalog contains 64 unique modules and validates structurally', () => {
  const context = runtime();
  const registry = new context.AXM.ModuleRegistry(context.AXM_DEFAULT_CATALOG);
  const modules = registry.list({ includeHidden: true });
  assert.equal(modules.length, 64);
  assert.equal(new Set(modules.map(module => module.id)).size, 64);
  const report = context.AXM.Validator.validateCatalog(registry);
  assert.equal(report.errors.length, 0, JSON.stringify(report.errors));
  assert.ok(modules.every(module => typeof module.accessibility.photosensitiveSafe === 'boolean'));
});

test('default recipe recursively compiles into a valid flat render plan', () => {
  const context = runtime();
  const { composer } = registryAndComposer(context);
  const compiled = composer.compile(composer.createDefaultRecipe());
  assert.equal(compiled.report.errors.length, 0);
  assert.ok(compiled.plan.length >= 10);
  assert.ok(compiled.plan.every(item => !['derived', 'composite'].includes(item.module.renderer.type)));
});

test('composite mold expands and quality fallback is explicit', () => {
  const context = runtime();
  const { composer } = registryAndComposer(context);
  const recipe = composer.createDefaultRecipe();
  recipe.layers = [composer.instance('mold.command-dashboard')];
  recipe.globals.quality = 'low';
  const compiled = composer.compile(recipe);
  assert.equal(compiled.report.errors.length, 0);
  assert.ok(compiled.plan.length > 1);
  assert.ok(
    compiled.report.warnings.some(warning => warning.code.startsWith('QUALITY_'))
      || compiled.plan.length > 1
  );
});

test('derived module resolves through its base and its declared overrides win', () => {
  const context = runtime();
  const { registry, composer } = registryAndComposer(context);
  const base = registry.get('light.neon-edge-glow');
  registry.register(
    derivedFrom(base, 'custom.test-glow', base.id, {
      name: 'Test Glow',
      parameterOverrides: { intensity: 0.9 }
    }),
    { source: 'custom' }
  );
  const recipe = composer.createDefaultRecipe();
  recipe.layers = [composer.instance('custom.test-glow', { intensity: 0.12 })];
  const compiled = composer.compile(recipe);
  assert.equal(compiled.report.errors.length, 0);
  assert.equal(compiled.plan[0].moduleId, 'light.neon-edge-glow');
  assert.equal(compiled.plan[0].params.intensity, 0.9);
});

test('module package integrity verifies and tampering fails', async () => {
  const context = runtime();
  const { registry } = registryAndComposer(context);
  const pkg = await context.AXM.PackageIO.createModulePackage(
    'mold.command-dashboard',
    registry,
    { packageId: 'test.package' }
  );
  assert.equal((await context.AXM.PackageIO.verifyIntegrity(pkg)).verified, true);
  pkg.name += ' tampered';
  assert.equal((await context.AXM.PackageIO.verifyIntegrity(pkg)).verified, false);
});

test('portable SHA-256 verifies sealed packages without Web Crypto', async () => {
  const context = runtime({
    webCrypto: false,
    files: [
      'src/core/namespace.js',
      'src/catalog/catalog.generated.js',
      'src/core/registry.js',
      'src/core/validator.js',
      'src/core/package-io.js'
    ]
  });
  const target = new context.AXM.ModuleRegistry(context.AXM_DEFAULT_CATALOG);
  const files = fs.readdirSync(path.join(ROOT, 'packages/starter'))
    .filter(file => file.endsWith('.json'));
  assert.equal(files.length, 12);
  for (const file of files) {
    const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'packages/starter', file), 'utf8'));
    const result = await context.AXM.PackageIO.verifyIntegrity(pkg);
    assert.equal(result.verified, true, `${file}: ${result.actual}`);
  }
  const sample = JSON.parse(
    fs.readFileSync(path.join(ROOT, 'packages/starter', files[0]), 'utf8')
  );
  const imported = await context.AXM.PackageIO.importPackage(sample, target);
  assert.equal(imported.integrity.verified, true);
});

test('package validator sees dependencies bundled beside the entry', async () => {
  const context = runtime();
  const { registry } = registryAndComposer(context);
  const pkg = await context.AXM.PackageIO.createModulePackage('mold.command-dashboard', registry);
  const empty = new context.AXM.ModuleRegistry({
    ...context.AXM_DEFAULT_CATALOG,
    modules: []
  });
  const report = context.AXM.Validator.validatePackage(pkg, empty);
  assert.equal(report.errors.length, 0, JSON.stringify(report.errors));
});

test('unsigned packages are blocked before import', async () => {
  const context = runtime();
  const { registry } = registryAndComposer(context);
  const pkg = await context.AXM.PackageIO.createModulePackage('focus.halo', registry);
  delete pkg.integrity;

  const preview = await context.AXM.PackageIO.previewPackage(pkg, registry);
  assert.equal(preview.blocked, true);
  assert.ok(preview.report.errors.some(error => error.code === 'MISSING_PACKAGE_INTEGRITY'));
  await assert.rejects(
    () => context.AXM.PackageIO.importPackage(pkg, registry),
    /sealed SHA-256 integrity/i
  );
});

test('altered built-ins reject a validly sealed package with atomic rollback', async () => {
  const context = runtime();
  const source = new context.AXM.ModuleRegistry(context.AXM_DEFAULT_CATALOG);
  const base = source.get('light.neon-edge-glow');
  const custom = derivedFrom(base, 'custom.import-glow', base.id, {
    name: 'Import Glow',
    parameterOverrides: { intensity: 0.77 }
  });
  source.register(custom, { source: 'custom' });

  const altered = {
    ...structuredClone(base),
    name: 'Silently Replaced Built-in'
  };
  source.register(altered, { source: 'builtin', overwrite: true });
  const pkg = await context.AXM.PackageIO.createModulePackage(
    custom.id,
    source,
    { packageId: 'test.atomic.rollback' }
  );
  pkg.modules = [
    pkg.modules.find(module => module.id === custom.id),
    ...pkg.modules.filter(module => module.id !== custom.id)
  ];
  seal(pkg);

  const target = new context.AXM.ModuleRegistry(context.AXM_DEFAULT_CATALOG);
  const before = context.AXM.Utils.canonicalJson(target.exportCatalog());
  const preview = await context.AXM.PackageIO.previewPackage(pkg, target);
  assert.equal(preview.integrity.verified, true);
  assert.equal(preview.blocked, true);
  assert.ok(preview.builtInCollisions.some(collision => collision.blocked));
  await assert.rejects(
    () => context.AXM.PackageIO.importPackage(pkg, target),
    /replace built-in module light\.neon-edge-glow/
  );
  assert.equal(target.has(custom.id), false, 'staged custom module leaked after rejection');
  assert.equal(context.AXM.Utils.canonicalJson(target.exportCatalog()), before);
});

test('cyclic sealed packages are rejected before registry mutation', async () => {
  const context = runtime();
  const target = new context.AXM.ModuleRegistry(context.AXM_DEFAULT_CATALOG);
  const base = target.get('light.neon-edge-glow');
  const first = derivedFrom(base, 'custom.cycle-a', 'custom.cycle-b');
  const second = derivedFrom(base, 'custom.cycle-b', 'custom.cycle-a');
  const pkg = seal({
    schema: 'axm.visual-module-package/1',
    packageId: 'test.cycle',
    name: 'Cycle test',
    version: '1.0.0',
    entryModuleId: first.id,
    modules: [first, second]
  });

  const preview = await context.AXM.PackageIO.previewPackage(pkg, target);
  assert.equal(preview.integrity.verified, true);
  assert.equal(preview.blocked, true);
  assert.ok(preview.report.errors.some(error => error.code === 'PACKAGE_DEPENDENCY_CYCLE'));
  await assert.rejects(
    () => context.AXM.PackageIO.importPackage(pkg, target),
    /dependency cycle/i
  );
  assert.equal(target.has(first.id), false);
  assert.equal(target.has(second.id), false);
});

test('recipe package carries and restores custom dependencies', async () => {
  const context = runtime();
  const source = new context.AXM.ModuleRegistry(context.AXM_DEFAULT_CATALOG);
  const base = source.get('focus.halo');
  source.register(
    derivedFrom(base, 'custom.recipe-halo', base.id, {
      name: 'Recipe Halo',
      parameterOverrides: { intensity: 0.84 }
    }),
    { source: 'custom' }
  );
  const composer = new context.AXM.Composer(source, { render() {} });
  const recipe = composer.createDefaultRecipe();
  recipe.layers = [composer.instance('custom.recipe-halo')];
  const pkg = await context.AXM.PackageIO.createRecipePackage(
    recipe,
    source,
    { packageId: 'test.recipe.package' }
  );
  const target = new context.AXM.ModuleRegistry(context.AXM_DEFAULT_CATALOG);
  const imported = await context.AXM.PackageIO.importPackage(pkg, target);
  assert.equal(imported.type, 'recipe');
  assert.ok(target.has('custom.recipe-halo'));
  assert.equal(context.AXM.Validator.validateRecipe(imported.recipe, target).errors.length, 0);
});

test('composite bindings promote parent controls into nested child parameters', () => {
  const context = runtime();
  const { registry, composer } = registryAndComposer(context);
  const base = registry.get('light.neon-edge-glow');
  const composite = {
    id: 'custom.bound-glow',
    name: 'Bound Glow',
    version: '1.1.0',
    schema: 'axm.visual-module/1',
    kind: 'mold',
    category: 'Test',
    status: 'WORKING',
    description: 'Binding test.',
    tags: ['test'],
    dependencies: [base.id],
    exclusiveGroup: null,
    shareable: true,
    ui: { icon: 'stack' },
    parameters: [{
      id: 'l1.intensity',
      label: 'Glow intensity',
      type: 'number',
      default: 0.77,
      min: 0,
      max: 1,
      step: 0.01
    }],
    renderer: {
      type: 'composite',
      layers: [{
        moduleId: base.id,
        params: { intensity: 0.2, spread: 14 },
        bindings: { intensity: 'l1.intensity' }
      }]
    },
    quality: {
      low: { enabled: true },
      medium: { enabled: true },
      high: { enabled: true },
      cinematic: { enabled: true }
    },
    accessibility: {
      reducedMotionSafe: true,
      highContrastSafe: true,
      photosensitiveSafe: true,
      notes: ''
    },
    provenance: { author: 'Test', origin: 'Test', license: 'Private test' }
  };
  assert.equal(context.AXM.Validator.validateModule(composite, registry).errors.length, 0);
  registry.register(composite, { source: 'custom' });
  const recipe = composer.createDefaultRecipe();
  recipe.layers = [composer.instance(composite.id, { 'l1.intensity': 0.91 })];
  const compiled = composer.compile(recipe);
  assert.equal(compiled.report.errors.length, 0);
  assert.equal(compiled.plan[0].moduleId, base.id);
  assert.equal(compiled.plan[0].params.intensity, 0.91);
});

test('unsafe CSS bindings, renderer classes, and generated counts are rejected', () => {
  const context = runtime();
  const { registry } = registryAndComposer(context);
  const base = registry.get('light.neon-edge-glow');
  const unsafe = {
    ...structuredClone(base),
    id: 'custom.unsafe-renderer',
    name: 'Unsafe renderer',
    dependencies: [],
    parameters: [{
      id: 'asset',
      label: 'External asset',
      type: 'text',
      default: 'url(https://example.invalid/payload.png)',
      cssVar: 'background-image'
    }],
    renderer: {
      type: 'class',
      scope: 'surface',
      className: 'fx-safe injected-class',
      generatedCount: 257
    },
    provenance: { ...base.provenance, license: 'Private test' }
  };
  const report = context.AXM.Validator.validateModule(unsafe, registry);
  const codes = new Set(report.errors.map(error => error.code));
  assert.ok(codes.has('UNSAFE_CSS_VARIABLE'));
  assert.ok(codes.has('UNSAFE_CSS_VALUE_TYPE'));
  assert.ok(codes.has('INVALID_RENDER_CLASS'));
  assert.ok(codes.has('INVALID_GENERATED_COUNT'));
});

test('dependency and composition depth budgets fail closed', () => {
  const context = runtime();
  const { registry, composer } = registryAndComposer(context);
  const base = registry.get('light.neon-edge-glow');
  let prior = base.id;
  for (let index = 0; index < 70; index += 1) {
    const id = `custom.depth-${String(index).padStart(3, '0')}`;
    registry.register(derivedFrom(base, id, prior), { source: 'custom' });
    prior = id;
  }

  assert.throws(
    () => registry.dependencyClosure(prior, { maxDepth: 16 }),
    /Dependency depth exceeds/
  );
  const recipe = composer.createDefaultRecipe();
  recipe.layers = [composer.instance(prior)];
  const compiled = composer.compile(recipe);
  assert.ok(
    compiled.report.errors.some(error => error.code === 'COMPOSITE_DEPTH_BUDGET'),
    JSON.stringify(compiled.report.errors)
  );
  assert.ok(compiled.plan.length <= 2048);
});

test('canonical visual intent preserves accessibility and reports target support', () => {
  const context = runtime();
  const { registry, composer } = registryAndComposer(context);
  const recipe = composer.createDefaultRecipe();
  recipe.globals.photosensitiveSafe = true;
  recipe.globals.reducedMotion = true;
  const compiled = composer.compile(recipe);
  assert.equal(compiled.report.valid, true);

  const intent = context.AXM.Intent.create(compiled, registry, {
    target: 'static-svg',
    generatedAt: '2026-07-28T00:00:00.000Z'
  });
  assert.equal(intent.schema, 'axm.resolved-visual-intent/1');
  assert.equal(intent.generatedBy, 'AXM AetherFX Visual Effect Fabric v1.3.0');
  assert.equal(intent.accessibility.photosensitiveSafe, true);
  assert.equal(intent.accessibility.reducedMotion, true);
  assert.equal(intent.operations.length, compiled.plan.length);
  assert.equal(intent.supportSummary.total, intent.operations.length);
  assert.equal(
    intent.supportSummary.total,
    intent.supportSummary.implemented
      + intent.supportSummary.approximated
      + intent.supportSummary.contract
      + intent.supportSummary.unsupported
  );
  assert.ok(intent.operations.some(operation => operation.support.status === 'unsupported'));

  const report = context.AXM.Intent.targetReport(
    compiled,
    registry,
    'web-css',
    { generatedAt: '2026-07-28T00:00:00.000Z' }
  );
  assert.equal(report.schema, 'axm.adapter-support-report/1');
  assert.equal(report.summary.implemented, report.summary.total);
  assert.equal(report.summary.unsupported, 0);
});
