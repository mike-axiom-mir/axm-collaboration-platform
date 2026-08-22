import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { packageDigest } from './canonical.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const catalog = JSON.parse(fs.readFileSync(path.join(ROOT, 'catalog', 'default-catalog.json'), 'utf8'));
const modules = new Map(catalog.modules.map((module) => [module.id, module]));
const outDir = path.join(ROOT, 'packages', 'starter');
const entryIds = [
  'material.aetherglass',
  'material.frosted-panel',
  'material.hologram-skin',
  'light.neon-edge-glow',
  'light.soft-bloom-halo',
  'light.reflection-streak',
  'motion.hover-lift',
  'motion.idle-pulse',
  'motion.loading-shimmer',
  'focus.halo',
  'depth.layered-shadow',
  'atmosphere.ambient-field'
];

function dependencyIds(module) {
  const ids = [...(module.dependencies || [])];
  if (module.renderer?.type === 'derived' && module.renderer.baseModuleId) ids.push(module.renderer.baseModuleId);
  if (module.renderer?.type === 'composite') {
    for (const layer of module.renderer.layers || []) ids.push(layer.moduleId);
  }
  return [...new Set(ids)];
}

function closure(entryId) {
  const resolved = [];
  const visiting = new Set();
  const visited = new Set();
  function visit(id, trail = []) {
    if (visited.has(id)) return;
    if (visiting.has(id)) throw new Error(`Starter package dependency cycle: ${[...trail, id].join(' -> ')}`);
    const module = modules.get(id);
    if (!module) throw new Error(`Starter package ${entryId} references missing module ${id}.`);
    visiting.add(id);
    for (const dependencyId of dependencyIds(module)) visit(dependencyId, [...trail, id]);
    visiting.delete(id);
    visited.add(id);
    resolved.push(structuredClone(module));
  }
  visit(entryId);
  return resolved;
}

fs.mkdirSync(outDir, { recursive: true });
const expectedFiles = new Set();
for (const entryId of entryIds) {
  const entry = modules.get(entryId);
  if (!entry) throw new Error(`Unknown starter package entry: ${entryId}`);
  const filename = `${entryId}.axmfx.json`;
  expectedFiles.add(filename);
  const pkg = {
    schema: 'axm.visual-module-package/1',
    packageId: `package.${entryId}`,
    name: entry.name,
    version: entry.version,
    entryModuleId: entryId,
    created: catalog.created || '2026-07-28',
    modules: closure(entryId),
    notes: 'Starter package. Set a public-sharing license before redistribution.'
  };
  pkg.integrity = { algorithm: 'sha256', value: packageDigest(pkg) };
  fs.writeFileSync(path.join(outDir, filename), `${JSON.stringify(pkg, null, 2)}\n`);
}

for (const file of fs.readdirSync(outDir).filter((name) => name.endsWith('.json'))) {
  if (!expectedFiles.has(file)) fs.rmSync(path.join(outDir, file));
}
console.log(`Generated ${entryIds.length} starter packages from the canonical catalog.`);
