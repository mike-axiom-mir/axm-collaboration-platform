#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const runtimePath = path.join(ROOT, 'dist', 'runtime', 'axm-aether-runtime.mjs');

function usage() {
  console.log(`AXM AetherFX CLI

Usage:
  npm run cli -- validate <recipe-or-package.json>
  npm run cli -- compile <recipe-or-package.json> [--target=engine-neutral] [--out=file.json]
  npm run cli -- inspect <recipe-or-package.json> [--target=generic-game-contract]

Targets:
  engine-neutral, web-css, static-svg, godot-theme,
  unity-uitoolkit, generic-game-contract`);
}

function flag(name, fallback = null) {
  const prefix = `--${name}=`;
  return process.argv.find((item) => item.startsWith(prefix))?.slice(prefix.length) || fallback;
}

function writeResult(value) {
  const text = `${JSON.stringify(value, null, 2)}\n`;
  const out = flag('out');
  if (out) {
    fs.writeFileSync(path.resolve(process.cwd(), out), text);
    console.error(`Wrote ${path.resolve(process.cwd(), out)}`);
  } else process.stdout.write(text);
}

const [, , command, input] = process.argv;
if (!command || ['help', '--help', '-h'].includes(command)) {
  usage();
  process.exit(0);
}
if (!input) {
  usage();
  process.exit(2);
}
if (!fs.existsSync(runtimePath)) {
  console.error('Portable runtime is missing. Run: npm run runtime:build');
  process.exit(2);
}

try {
  const { AXM } = await import(`${pathToFileURL(runtimePath).href}?v=${Date.now()}`);
  const runtime = new AXM.AetherRuntime();
  const document = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), input), 'utf8'));
  const isPackage = ['axm.visual-module-package/1', 'axm.visual-recipe-package/1'].includes(document.schema);

  if (command === 'validate') {
    if (isPackage) {
      const review = await runtime.reviewPackage(document);
      writeResult(review);
      if (review.blocked) process.exitCode = 1;
    } else {
      const report = runtime.validate(document);
      writeResult(report);
      if (!report.valid) process.exitCode = 1;
    }
  } else if (command === 'compile' || command === 'inspect') {
    if (isPackage) {
      const imported = await runtime.importPackage(document);
      if (imported.type !== 'recipe') throw new Error('Compile/inspect requires a raw recipe or recipe package, not a module-only package.');
    } else runtime.setRecipe(document);
    const target = flag('target', command === 'compile' ? 'engine-neutral' : 'generic-game-contract');
    if (command === 'compile') writeResult(runtime.intent({ target }));
    else {
      const compiled = runtime.compile();
      writeResult({
        schema: 'axm.recipe-inspection/1',
        valid: compiled.report.valid,
        scene: compiled.recipe.sceneId,
        quality: compiled.resolvedQuality,
        sourceLayers: compiled.recipe.layers.length,
        resolvedOperations: compiled.plan.length,
        warnings: compiled.report.warnings,
        estimatedLoad: runtime.estimate(),
        targetSupport: runtime.targetReport(target)
      });
    }
  } else {
    usage();
    process.exitCode = 2;
  }
} catch (error) {
  console.error(`AXM AetherFX CLI: ${error.message}`);
  process.exitCode = 1;
}
