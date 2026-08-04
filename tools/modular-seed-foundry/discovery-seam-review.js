'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const manifest = require('./manifest.json');
const contract = require('./module.contract.json');

const expected = [
  'modular.seed.intent.normalize/v1',
  'modular.seed.family.compile/v1',
  'modular.seed.lane.balance/v1',
  'modular.seed.lineage.bind/v1',
  'modular.seed.growth-budget.bound/v1',
  'modular.seed.disconfirming-tests.compose/v1',
  'modular.seed.platform-brief.compose/v1',
  'modular.seed.integrity.digest/v1',
  'modular.seed.explicit-export/v1',
  'modular.seed.ui.compose/v1'
];

assert.equal(manifest.id, 'modular-seed-foundry');
assert.equal(manifest.layer, 'create');
assert.deepEqual(manifest.permissions, []);
assert.equal(contract.id, manifest.id);
assert.deepEqual(contract.permissions, []);
expected.forEach(capability => assert.ok(contract.provides.includes(capability), 'missing ' + capability));
assert.ok(contract.handoffs.emits.includes('axm.modular-growth-seed/v1'));
assert.ok(contract.boundaries.refuses.includes('automatic-platform-run'));
assert.ok(contract.boundaries.refuses.includes('automatic-intake'));
assert.ok(contract.boundaries.refuses.includes('automatic-promotion'));
for (const relative of ['index.html', 'styles.css', 'app.js', 'seed-core.js', 'selftest.js', 'README.md', 'schemas/modular-growth-seed.schema.json']) {
  assert.ok(fs.existsSync(path.join(__dirname, relative)), relative + ' must exist');
}
console.log('Modular Seed Foundry discovery seam: PASS - 10 capabilities, zero permissions, explicit platform handoff');
