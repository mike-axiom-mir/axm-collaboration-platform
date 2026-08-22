import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const catalog = JSON.parse(fs.readFileSync(path.join(ROOT, 'catalog/default-catalog.json'), 'utf8'));
const sourceFiles = [
  'src/core/namespace.js',
  'src/core/registry.js',
  'src/core/validator.js',
  'src/core/package-io.js',
  'src/core/composer.js',
  'src/core/intent.js',
  'src/core/performance.js',
  'src/runtime/runtime.js'
];
const sourceBlocks = sourceFiles.map((rel) => `/* ${rel} */\n${fs.readFileSync(path.join(ROOT, rel), 'utf8')}`);
const catalogSource = `globalThis.AXM_DEFAULT_CATALOG = ${JSON.stringify(catalog)};`;
const banner = `/* AXM AetherFX v${catalog.version} portable headless runtime.
   Declarative compile, validation, package review/import, performance estimate,
   canonical visual intent, adapter support reports, and full snapshots.
   No account, telemetry, network dependency, or renderer side effect. */`;
const [namespaceSource, ...remainingSources] = sourceBlocks;
const globalBundle = `${banner}\n${namespaceSource}\n${catalogSource}\n${remainingSources.join('\n\n')}\n`;
const esmBundle = `${globalBundle}\nexport const AXM = globalThis.AXM;\nexport default globalThis.AXM;\n`;
const outDir = path.join(ROOT, 'dist', 'runtime');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'axm-aether-runtime.js'), globalBundle);
fs.writeFileSync(path.join(outDir, 'axm-aether-runtime.mjs'), esmBundle);
console.log(`Built portable runtime kit (${sourceFiles.length} source modules, ${catalog.modules.length} catalog modules).`);
