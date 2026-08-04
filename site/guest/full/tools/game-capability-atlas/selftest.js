'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const root = __dirname;
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
const contract = JSON.parse(fs.readFileSync(path.join(root, 'module.contract.json'), 'utf8'));
const Atlas = require('../../shared/game-capability-atlas/atlas.js');
const catalog = JSON.parse(fs.readFileSync(path.join(root, '../../shared/game-capability-atlas/catalog.json'), 'utf8'));

assert.strictEqual(manifest.id, 'game-capability-atlas');
assert.strictEqual(contract.id, manifest.id);
assert.strictEqual(manifest.schema, 'axm.tool-manifest/v1');
assert.strictEqual(manifest.kind, 'product');
assert.deepStrictEqual(manifest.permissions, contract.permissions);
assert.deepStrictEqual(contract.lifecycle, { state_owner: 'browser', reload: 'resume', disconnect: 'graceful-degrade', cleanup: 'explicit' });
assert(Atlas.validate(catalog).pass);
assert(/id="query"/.test(html) && /id="category"/.test(html));
assert(/responsive-fix\.css/.test(html));
assert(/loadWave\(1\)/.test(app));
assert(/rows\.slice\(0, 80\)/.test(app));
assert(/AXM_GAME_CAPABILITY_PLAN_APPLY/.test(app));
assert(/automatic-game-code-generation/.test(JSON.stringify(contract)));
assert.strictEqual(Atlas.buildPlan(catalog, { wave: 1, createdAt: '2026-07-27T00:00:00Z' }).items.length, 20);

console.log('Game Production Atlas tool selftest: PASS (search UI, balanced plan, explicit Game Forge handoff)');
