'use strict';

const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..', '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');
const json = relative => JSON.parse(read(relative));
const checks = [
  ['Manifest exposes the Atlas as a Play product', () => {
    const manifest = json('tools/game-capability-atlas/manifest.json');
    return manifest.kind === 'product' && manifest.layer === 'play' && manifest.audience === 'human-machine';
  }],
  ['Compact catalog retains 500 unique modules in 20 domains', () => {
    const catalog = json('shared/game-capability-atlas/catalog.json');
    return catalog.modules.length === 500 && catalog.categories.length === 20 && new Set(catalog.modules.map(row => row.id)).size === 500;
  }],
  ['First balanced wave covers all 20 domains', () => {
    const catalog = json('shared/game-capability-atlas/catalog.json');
    const ids = new Set(catalog.balancedWaves[0].moduleIds);
    const rows = catalog.modules.filter(row => ids.has(row.id));
    return rows.length === 20 && new Set(rows.map(row => row.category)).size === 20;
  }],
  ['Tool loads the shared runtime and catalog', () => {
    const html = read('tools/game-capability-atlas/index.html');
    const app = read('tools/game-capability-atlas/app.js');
    return /shared\/game-capability-atlas\/atlas\.js/.test(html) && /shared\/game-capability-atlas\/catalog\.json/.test(app);
  }],
  ['Game Forge owns the explicit project handoff', () => {
    const html = read('tools/game-forge/index.html');
    const forge = read('tools/game-forge/game-forge.js');
    return /game-capability-atlas\/index\.html/.test(html) && /AXM_GAME_CAPABILITY_PLAN_APPLY/.test(forge);
  }],
  ['Boundaries refuse runtime and automatic-promotion overclaims', () => {
    const contract = json('tools/game-capability-atlas/module.contract.json');
    return contract.boundaries.refuses.includes('claim-knowledge-is-runtime-behavior') && contract.boundaries.refuses.includes('automatic-installation');
  }]
];

let failures = 0;
for (const [label, check] of checks) {
  let pass = false;
  try { pass = Boolean(check()); } catch (error) {}
  console.log((pass ? 'PASS  ' : 'FAIL  ') + label);
  if (!pass) failures += 1;
}
console.log('GAME CAPABILITY ATLAS DISCOVERY seams=' + failures + ' verified=' + (checks.length - failures));
if (failures) process.exit(1);
