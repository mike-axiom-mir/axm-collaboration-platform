import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const cssFiles = ['styles/runtime.css', 'styles/app.css'];
for (const rel of cssFiles) {
  const css = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  const escaped = rel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`<link[^>]+href=["']${escaped}["'][^>]*>\\s*`, 'i');
  html = html.replace(re, `<style data-source="${rel}">\n${css}\n</style>\n`);
}
const scriptFiles = [
  'src/core/namespace.js','src/catalog/catalog.generated.js','src/core/registry.js','src/core/validator.js','src/core/history.js','src/core/package-io.js','src/core/composer.js','src/core/intent.js','src/core/performance.js','src/core/repair.js','src/app/scenes.js','src/adapters/web-adapter.js','src/app/runtime-css.generated.js','src/app/app.js'
];
for (const rel of scriptFiles) {
  const js = fs.readFileSync(path.join(ROOT, rel), 'utf8').replaceAll('</script>', '<\\/script>');
  const escaped = rel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`<script[^>]+src=["']${escaped}["'][^>]*>\\s*</script>\\s*`, 'i');
  html = html.replace(re, `<script data-source="${rel}">\n${js}\n</script>\n`);
}
if (/\b(?:src|href)=["']https?:\/\//i.test(html)) throw new Error('External runtime URL remains in single-file build.');
if (/<script[^>]+src=|<link[^>]+rel=["']stylesheet/i.test(html)) throw new Error('Unbundled runtime reference remains.');
const outDir = path.join(ROOT,'dist'); fs.mkdirSync(outDir,{recursive:true});
const out = path.join(outDir,'AXM_AETHERFX_VISUAL_EFFECT_FABRIC_STUDIO_v1_3_0.html');
fs.writeFileSync(out, html);
fs.writeFileSync(path.join(ROOT,'OPEN_STUDIO.html'), html);
console.log(`Built ${path.relative(ROOT,out)} (${fs.statSync(out).size} bytes)`);
