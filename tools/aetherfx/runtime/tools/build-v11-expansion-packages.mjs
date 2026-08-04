import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { packageDigest } from './canonical.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const catalog = JSON.parse(fs.readFileSync(path.join(ROOT, 'catalog', 'default-catalog.json'), 'utf8'));
const modules = new Map(catalog.modules.map((module) => [module.id, module]));
const outDir = path.join(ROOT, 'packages', 'expansion-v1.1');
const entryIds = ['mold.cinematic-glass-stage', 'mold.prismatic-product-card'];

function dependencyIds(module) {
  const ids = [...(module.dependencies || [])];
  if (module.renderer?.type === 'derived' && module.renderer.baseModuleId) ids.push(module.renderer.baseModuleId);
  if (module.renderer?.type === 'composite') for (const layer of module.renderer.layers || []) ids.push(layer.moduleId);
  return [...new Set(ids)];
}
function closure(entryId) {
  const ordered = []; const visiting = new Set(); const visited = new Set();
  function visit(id, trail = []) {
    if (visited.has(id)) return;
    if (visiting.has(id)) throw new Error(`Expansion dependency cycle: ${[...trail, id].join(' -> ')}`);
    const module = modules.get(id); if (!module) throw new Error(`Missing expansion dependency ${id}.`);
    visiting.add(id); for (const dep of dependencyIds(module)) visit(dep, [...trail, id]); visiting.delete(id);
    visited.add(id); ordered.push(structuredClone(module));
  }
  visit(entryId); return ordered;
}
fs.mkdirSync(outDir, { recursive: true });
const keep = new Set(['README.md']);
for (const entryId of entryIds) {
  const entry = modules.get(entryId); if (!entry) throw new Error(`Unknown entry ${entryId}`);
  const filename = `${entryId}.axmfx.json`; keep.add(filename);
  const pkg = {
    schema: 'axm.visual-module-package/1', packageId: `package.${entryId}.v1.1`, name: entry.name,
    version: '1.1.0', entryModuleId: entryId, created: '2026-07-28', modules: closure(entryId),
    notes: 'AXM AetherFX v1.1 high-end illusion expansion. Declarative only; choose a public license before redistribution.'
  };
  pkg.integrity = { algorithm: 'sha256', value: packageDigest(pkg) };
  fs.writeFileSync(path.join(outDir, filename), `${JSON.stringify(pkg, null, 2)}\n`);
}
for (const file of fs.readdirSync(outDir)) if (!keep.has(file)) fs.rmSync(path.join(outDir, file), { recursive: true, force: true });
fs.writeFileSync(path.join(outDir, 'README.md'), `# AXM AetherFX v1.1 Expansion Packages\n\nTwo sealed declarative packages provide the new high-end illusion systems:\n\n- \`mold.cinematic-glass-stage.axmfx.json\` — liquid glass, aurora, fog, dust, guidance, and depth.\n- \`mold.prismatic-product-card.axmfx.json\` — crystal surface, spectral dispersion, edge light, spring response, and focus.\n\nEach package includes its full dependency closure and SHA-256 integrity metadata. Public licensing remains intentionally unset.\n`);
console.log(`Generated ${entryIds.length} v1.1 expansion packages.`);
