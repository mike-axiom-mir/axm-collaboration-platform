import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');

test('v1.3 integration kit contains web, runtime, Godot, Unity, and static bridges', () => {
  const required = [
    'integration/README.md',
    'integration/web/axm-aether-surface.js',
    'integration/web/example.html',
    'integration/runtime/README.md',
    'integration/runtime/example.mjs',
    'integration/godot/AXMAetherTheme.gd',
    'integration/godot/README.md',
    'integration/unity/AXMAetherThemeLoader.cs',
    'integration/unity/README.md',
    'integration/static/README.md',
    'dist/runtime/axm-aether-runtime.js',
    'dist/runtime/axm-aether-runtime.mjs'
  ];
  for (const rel of required) {
    assert.ok(fs.statSync(path.join(ROOT, rel)).size > 180, `${rel} too small`);
  }
  assert.match(read('integration/web/axm-aether-surface.js'),
    /customElements\.define\('axm-aether-surface'/);
  assert.match(read('integration/web/axm-aether-surface.js'), /photosensitive-safe/);
  assert.doesNotMatch(read('integration/web/example.html'), /https?:\/\//i);
  assert.match(read('integration/runtime/README.md'), /canonical visual-intent contract/);
  assert.match(read('integration/godot/AXMAetherTheme.gd'), /extends Node/);
  assert.match(read('integration/unity/AXMAetherThemeLoader.cs'), /UIDocument/);
  assert.match(read('integration/static/README.md'), /render_recipe_to_svg\.py/);
});

test('portable ESM runtime compiles, reports support, and snapshots full state', async () => {
  const runtimeUrl = pathToFileURL(
    path.join(ROOT, 'dist/runtime/axm-aether-runtime.mjs')
  ).href;
  const { default: AXM } = await import(`${runtimeUrl}?test=${Date.now()}`);
  assert.equal(AXM.version, '1.3.0');

  const runtime = new AXM.AetherRuntime();
  const compiled = runtime.compile();
  assert.equal(compiled.report.valid, true);
  assert.ok(compiled.plan.length >= 10);

  const web = runtime.targetReport('web-css');
  assert.equal(web.schema, 'axm.adapter-support-report/1');
  assert.equal(web.summary.implemented, web.summary.total);
  assert.equal(web.summary.unsupported, 0);

  const game = runtime.intent({ target: 'generic-game-contract' });
  assert.equal(game.schema, 'axm.resolved-visual-intent/1');
  assert.equal(game.supportSummary.contract, game.supportSummary.total);

  const snapshot = runtime.snapshot();
  assert.equal(snapshot.schema, 'axm.runtime-snapshot/1');
  assert.equal(snapshot.fabricVersion, '1.3.0');
  assert.deepEqual(snapshot.customModules, []);
  assert.equal(runtime.restore(snapshot).recipe.id, snapshot.recipe.id);
});

test('studio exposes review, safety, canonical intent, and adapter support controls', () => {
  const html = read('index.html');
  const app = read('src/app/app.js');
  const runtimeCss = read('styles/runtime.css');
  const ids = [
    'guideDialog',
    'performanceDialog',
    'graphDialog',
    'repairDialog',
    'importReviewDialog',
    'performanceBiasSelect',
    'togglePhotosensitiveSafe',
    'exportWebComponent',
    'exportVisualIntent',
    'exportTargetProfile',
    'exportTargetReport'
  ];
  for (const id of ids) {
    assert.match(html, new RegExp(`id=["']${id}["']`));
  }
  assert.match(app, /previewPackage/);
  assert.match(app, /AXM\.RepairCenter\.analyzeRecipe/);
  assert.match(app, /PerformanceGovernor\.estimatePlan/);
  assert.match(app, /AXM\.Intent\.create/);
  assert.match(app, /AXM\.Intent\.targetReport/);
  assert.match(app, /customModules:\s*AXM\.Utils\.clone\(registry\.customModules\(\)\)/);
  assert.match(runtimeCss, /is-photosensitive-safe/);
});
