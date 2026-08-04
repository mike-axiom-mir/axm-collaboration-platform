import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const catalog = JSON.parse(fs.readFileSync(path.join(ROOT, 'catalog/default-catalog.json'), 'utf8'));
const byCategory = new Map();
for (const module of catalog.modules) {
  const category = module.category || 'Uncategorized';
  if (!byCategory.has(category)) byCategory.set(category, []);
  byCategory.get(category).push(module);
}
const lines = [
  '# Module Index',
  '',
  `Catalog: ${catalog.modules.length} modules · ${catalog.moods.length} moods`,
  '',
  '> Generated from `catalog/default-catalog.json`. Edit the catalog, not this file.',
  ''
];
for (const category of [...byCategory.keys()].sort((a, b) => a.localeCompare(b))) {
  lines.push(`## ${category}`, '');
  const modules = byCategory.get(category).sort((a, b) => a.name.localeCompare(b.name));
  for (const module of modules) {
    const deps = (module.dependencies || []).length;
    const controls = (module.parameters || []).length;
    lines.push(`- **${module.name}** — \`${module.id}\` · ${module.kind} · v${module.version} · ${deps} dependencies · ${controls} controls`);
  }
  lines.push('');
}
fs.writeFileSync(path.join(ROOT, 'docs/MODULE_INDEX.md'), lines.join('\n'));
console.log(`Generated docs/MODULE_INDEX.md (${catalog.modules.length} modules).`);
