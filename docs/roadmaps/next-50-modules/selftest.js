'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../../..');
const roadmap = JSON.parse(fs.readFileSync(path.join(__dirname, 'next-50-modules.json'), 'utf8'));
const markdown = fs.readFileSync(path.join(__dirname, 'NEXT_50_MODULES.md'), 'utf8');

function manifestIds(folder, fileName) {
  const base = path.join(root, folder);
  if (!fs.existsSync(base)) return [];
  return fs.readdirSync(base, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && fs.existsSync(path.join(base, entry.name, fileName)))
    .map((entry) => JSON.parse(fs.readFileSync(path.join(base, entry.name, fileName), 'utf8').replace(/^\uFEFF/, '')).id);
}

const existingIds = new Set([
  ...manifestIds('tools', 'manifest.json'),
  ...manifestIds('worlds', 'world.manifest.json')
]);
const modules = roadmap.modules;
const plannedIds = new Set(modules.map((module) => module.id));
const capabilityIds = new Set(modules.map((module) => module.capabilityId));
const expectedParents = { Create: 15, Build: 13, Play: 10, 'AI Team': 6, Publish: 6 };
const validGapTypes = new Set(['HAND', 'SKILL', 'AUTHORITY', 'SUBSTRATE', 'EVIDENCE', 'CONTRACT']);
const validPhases = new Set(['P0', 'P1', 'P2', 'P3', 'P4']);

assert.strictEqual(roadmap.schema, 'axm.module-roadmap/v1');
assert.strictEqual(modules.length, 50, 'roadmap must contain exactly 50 modules');
assert.strictEqual(plannedIds.size, 50, 'module ids must be unique');
assert.strictEqual(capabilityIds.size, 50, 'primary capability ids must be unique');
assert.deepStrictEqual(modules.map((module) => module.rank), Array.from({ length: 50 }, (_, index) => index + 1), 'ranks must be continuous 1..50');

const parentCounts = modules.reduce((counts, module) => {
  counts[module.parent] = (counts[module.parent] || 0) + 1;
  return counts;
}, {});
assert.deepStrictEqual(parentCounts, expectedParents, 'parent distribution must match the declared ranked roadmap');
assert.deepStrictEqual(roadmap.parentCounts, expectedParents, 'declared parent counts must match actual entries');

for (const module of modules) {
  assert(/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(module.id), `${module.id}: stable kebab id required`);
  assert(existingIds.has(module.id), `${module.id}: built module manifest is missing`);
  assert(validGapTypes.has(module.gapType), `${module.id}: invalid gap type`);
  assert(validPhases.has(module.phase), `${module.id}: invalid phase`);
  for (const field of ['name', 'capabilityId', 'purpose', 'whyNow', 'firstBuild']) {
    assert(typeof module[field] === 'string' && module[field].trim().length >= 8, `${module.id}: ${field} is too weak`);
  }
  assert(Object.prototype.hasOwnProperty.call(expectedParents, module.parent), `${module.id}: unknown parent`);
  assert(Array.isArray(module.reuse) && module.reuse.length >= 2, `${module.id}: reuse route must name existing or earlier planned capabilities`);
  for (const id of module.reuse) assert(existingIds.has(id) || plannedIds.has(id), `${module.id}: unknown reuse route ${id}`);
  assert(Array.isArray(module.acceptance) && module.acceptance.length >= 4, `${module.id}: four proof obligations required`);
  assert(module.acceptance.every((item) => typeof item === 'string' && item.length >= 16), `${module.id}: acceptance evidence is underspecified`);
  assert(markdown.includes(`| ${module.rank} | ${module.name} | ${module.parent} |`), `${module.id}: human roadmap table row missing`);
}

for (const phase of roadmap.phases) {
  const [first, last] = phase.ranks;
  const phaseModules = modules.filter((module) => module.rank >= first && module.rank <= last);
  assert(phaseModules.length === last - first + 1, `${phase.id}: rank coverage has a hole`);
  assert(phaseModules.every((module) => module.phase === phase.id), `${phase.id}: module phase disagrees with rank band`);
  assert(typeof phase.exit === 'string' && phase.exit.length >= 80, `${phase.id}: exit gate is too weak`);
}

assert(roadmap.constraints.some((rule) => /No mandatory cloud, CDN, paid service, proprietary runtime, or third-party package/.test(rule)));
assert(roadmap.constraints.some((rule) => /Human approval remains required/.test(rule)));
assert(roadmap.constraints.some((rule) => /do not create duplicate replacement Hubs/.test(rule)));
assert.strictEqual((markdown.match(/^\|\s*\d+\s*\|/gm) || []).length, 50, 'human roadmap must expose exactly 50 numbered rows');

console.log(`NEXT_50_MODULES_SELFTEST: PASS (50 ranked modules are present; Create 15, Build 13, Play 10, AI Team 6, Publish 6)`);
