'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Atlas = require('./atlas.js');
const catalog = JSON.parse(fs.readFileSync(path.join(__dirname, 'catalog.json'), 'utf8'));

assert.deepStrictEqual(Atlas.validate(catalog), { pass: true, errors: [] });
assert.strictEqual(Atlas.balancedWave(catalog, 1).length, 20);
assert.strictEqual(new Set(Atlas.balancedWave(catalog, 1).map(row => row.category)).size, 20);
assert(Atlas.search(catalog, { query: 'camera framing', limit: 20 }).some(row => row.module.category === '05'));
assert(Atlas.search(catalog, { query: 'multiplayer prediction', limit: 20 }).some(row => row.module.category === '19'));
const plan = Atlas.buildPlan(catalog, {
  projectId: 'test-game',
  projectName: 'Test Game',
  goal: 'Playable vertical slice',
  wave: 1,
  createdAt: '2026-07-27T23:00:00.000Z'
});
assert.strictEqual(plan.schema, 'axm.game-capability-plan/v1');
assert.strictEqual(plan.items.length, 20);
assert.strictEqual(plan.coverage.coveredCategories, 20);
assert.strictEqual(plan.truth.automaticInstall, false);
assert.throws(() => Atlas.buildPlan(catalog, { moduleIds: ['MISSING'] }), /Unknown game capability/);

console.log('Game Capability Atlas selftest: PASS (500 unique modules, search, balanced wave, bounded project plan)');
