import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { packageDigest } from '../tools/canonical.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const readJson = rel => JSON.parse(read(rel));

test('example recipes reference existing modules, parameters, and scenes', () => {
  const catalog = readJson('catalog/default-catalog.json');
  const modules = new Map(catalog.modules.map(module => [module.id, module]));
  for (const file of fs.readdirSync(path.join(ROOT, 'examples/recipes'))
    .filter(name => name.endsWith('.json'))) {
    const recipe = readJson(`examples/recipes/${file}`);
    assert.equal(recipe.schema, 'axm.visual-recipe/1');
    assert.equal(modules.get(recipe.sceneId)?.kind, 'scene', `${file} missing scene`);
    for (const layer of recipe.layers) {
      const module = modules.get(layer.moduleId);
      assert.ok(module, `${file} missing ${layer.moduleId}`);
      const parameterIds = new Set((module.parameters || []).map(parameter => parameter.id));
      for (const key of Object.keys(layer.params || {})) {
        assert.ok(parameterIds.has(key), `${file} unknown parameter ${layer.moduleId}.${key}`);
      }
    }
  }
});

test('starter packages match canonical modules and current SHA-256 values', () => {
  const catalog = readJson('catalog/default-catalog.json');
  const modules = new Map(catalog.modules.map(module => [module.id, module]));
  const files = fs.readdirSync(path.join(ROOT, 'packages/starter'))
    .filter(file => file.endsWith('.json'));
  assert.equal(files.length, 12);
  for (const file of files) {
    const pkg = readJson(`packages/starter/${file}`);
    assert.equal(pkg.integrity.algorithm, 'sha256');
    assert.equal(pkg.integrity.value, packageDigest(pkg), file);
    assert.ok(pkg.modules.some(module => module.id === pkg.entryModuleId), `${file} entry missing`);
    for (const module of pkg.modules) {
      assert.deepEqual(module, modules.get(module.id), `${file} stale module ${module.id}`);
    }
  }
});

test('v1.3 single-file studio is local and fully bundled', () => {
  const rel = 'dist/AXM_AETHERFX_VISUAL_EFFECT_FABRIC_STUDIO_v1_3_0.html';
  assert.ok(fs.existsSync(path.join(ROOT, rel)));
  const html = read(rel);
  assert.doesNotMatch(html, /<script[^>]+src=/i);
  assert.doesNotMatch(html, /<link[^>]+rel=["']stylesheet/i);
  assert.doesNotMatch(html, /\b(?:src|href)=["']https?:\/\//i);
  assert.match(html, /AXM AetherFX Visual Effect Fabric Studio/);
  assert.match(html, /Visual Effect Fabric v1\.3\.0/);
});

test('standalone runtime CSS snapshot matches the canonical runtime stylesheet', () => {
  const context = vm.createContext({});
  context.globalThis = context;
  context.window = context;
  vm.runInContext(read('src/app/runtime-css.generated.js'), context);
  assert.equal(context.AXM_RUNTIME_CSS, read('styles/runtime.css'));
});

test('generated runtime catalog exactly matches the canonical JSON catalog', () => {
  const context = vm.createContext({});
  context.globalThis = context;
  context.window = context;
  vm.runInContext(read('src/catalog/catalog.generated.js'), context);
  const canonical = readJson('catalog/default-catalog.json');
  assert.deepEqual(JSON.parse(JSON.stringify(context.AXM_DEFAULT_CATALOG)), canonical);
  assert.equal(canonical.version, '1.3.0');
});

test('schemas and intake manifest are readable and track v1.3', () => {
  for (const file of fs.readdirSync(path.join(ROOT, 'schemas'))
    .filter(name => name.endsWith('.json'))) {
    const schema = readJson(`schemas/${file}`);
    assert.ok(schema.$schema, `${file} missing $schema`);
  }
  const intentSchema = readJson('schemas/resolved-visual-intent.schema.json');
  assert.equal(
    intentSchema.properties.schema.const,
    'axm.resolved-visual-intent/1'
  );
  const gameSchema = readJson('adapters/game/visual-intent.schema.json');
  assert.equal(gameSchema.$ref, '../../schemas/resolved-visual-intent.schema.json');

  const manifest = readJson('AXM_INTAKE_MANIFEST.json');
  assert.equal(manifest.version, '1.3.0');
  assert.equal(manifest.entrypoints.singleFileStudio,
    'dist/AXM_AETHERFX_VISUAL_EFFECT_FABRIC_STUDIO_v1_3_0.html');
  assert.equal(manifest.catalog.modules, 64);
  assert.equal(Object.values(manifest.catalog.byKind).reduce((sum, count) => sum + count, 0), 64);
});

test('inventory generation normalizes Windows paths before excluding generated reports', () => {
  const source = read('tools/build-inventory.mjs');
  assert.match(source, /path\.relative\(ROOT,file\)\.replaceAll\('\\\\','\/'\)/);
  assert.match(source, /generatedReports\.has\(relativePath\(file\)\)/);

  const checksumPaths = read('reports/SHA256SUMS.txt')
    .trim()
    .split(/\r?\n/)
    .map(line => line.slice(66));
  assert.equal(new Set(checksumPaths).size, checksumPaths.length);
  for (const generated of [
    'reports/INVENTORY.json',
    'reports/INVENTORY.md',
    'reports/SHA256SUMS.txt',
    'reports/BUILD_SUMMARY.json'
  ]) assert.ok(!checksumPaths.includes(generated), `${generated} must not hash itself`);
});

test('v1.1 expansion packages remain sealed with dependency closures', () => {
  const dir = path.join(ROOT, 'packages/expansion-v1.1');
  const files = fs.readdirSync(dir).filter(file => file.endsWith('.json'));
  assert.equal(files.length, 2);
  for (const file of files) {
    const pkg = readJson(`packages/expansion-v1.1/${file}`);
    assert.equal(pkg.version, '1.1.0');
    assert.equal(pkg.integrity.value, packageDigest(pkg), file);
    assert.ok(pkg.modules.some(module => module.id === pkg.entryModuleId));
    assert.ok(pkg.modules.length >= 8, `${file} closure too small`);
  }
});

test('generated module index and stable launchers track the v1.3 build', () => {
  assert.match(read('docs/MODULE_INDEX.md'), /Catalog: 64 modules · 5 moods/);
  const dist = read('dist/AXM_AETHERFX_VISUAL_EFFECT_FABRIC_STUDIO_v1_3_0.html');
  assert.deepEqual(read('OPEN_STUDIO.html'), dist);
  for (const launcher of ['START_STUDIO.bat', 'START_STUDIO.sh']) {
    assert.match(read(launcher), /OPEN_STUDIO\.html/);
  }
});

test('portable runtime kit is built as browser-global and ESM artifacts', () => {
  for (const rel of [
    'dist/runtime/axm-aether-runtime.js',
    'dist/runtime/axm-aether-runtime.mjs'
  ]) {
    const source = read(rel);
    assert.ok(source.length > 100_000, `${rel} unexpectedly small`);
    assert.match(source, /AXM AetherFX v1\.3\.0 portable headless runtime/);
    assert.match(source, /AXM\.AetherRuntime/);
    assert.match(source, /axm\.resolved-visual-intent\/1/);
    assert.doesNotMatch(source, /\bhttps?:\/\/(?!axm\.local\/schemas)/);
  }
});

test('adapter snapshots use canonical intent and explicit support reports', () => {
  for (const stem of ['cinematic-glass-stage', 'prismatic-product-card']) {
    const intent = readJson(`dist/adapters/${stem}.visual-intent.json`);
    const support = readJson(`dist/adapters/${stem}.support.json`);
    assert.equal(intent.schema, 'axm.resolved-visual-intent/1');
    assert.equal(intent.generatedBy, 'AXM AetherFX Visual Effect Fabric v1.3.0');
    assert.equal(intent.operations.length, intent.supportSummary.total);
    assert.equal(
      intent.supportSummary.total,
      intent.supportSummary.implemented
        + intent.supportSummary.approximated
        + intent.supportSummary.contract
        + intent.supportSummary.unsupported
    );
    assert.equal(support.schema, 'axm.adapter-support-report/1');
    assert.equal(support.summary.total, support.operations.length);
    assert.equal(support.target.id, intent.target.id);

    for (const ext of ['tokens.css', 'godot-theme.tres', 'unity-theme.uss']) {
      assert.ok(
        fs.statSync(path.join(ROOT, `dist/adapters/${stem}.${ext}`)).size > 100,
        `${stem}.${ext} too small`
      );
    }
    const svg = read(`dist/${stem}.svg`);
    assert.match(svg, /<svg\b/);
    assert.match(svg, /<\/svg>/);
    assert.match(svg, /\d+ resolved modules/);
    assert.match(svg, /interaction operations unsupported/);
  }
});
