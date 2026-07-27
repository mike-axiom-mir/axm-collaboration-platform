'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = __dirname;
const workshop = path.resolve(root, '../..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
const contract = JSON.parse(fs.readFileSync(path.join(root, 'module.contract.json'), 'utf8'));
assert.equal(manifest.id, contract.id, 'manifest and contract identity must match');
assert.equal(manifest.contract, 'module.contract.json');
['axm.modular-element/v1', 'axm.element-category-registry/v1', 'axm.universal-component/v1'].forEach(schema => {
  assert.ok(contract.consumes.includes(schema), 'missing consumed schema ' + schema);
});
['axm.element-composition/v1', 'axm.element-composition-receipt/v1', 'axm.universal-component/v1'].forEach(schema => {
  assert.ok(contract.handoffs.emits.includes(schema), 'missing emitted schema ' + schema);
});
[
  'shared/elements/element.schema.json',
  'shared/elements/element-composition.schema.json',
  'shared/elements/element-receipt.schema.json',
  'shared/elements/category-registry.json',
  'shared/elements/element-protocol.js',
  'shared/verification-spine/category-packs/element.json'
].forEach(file => assert.ok(fs.existsSync(path.join(workshop, file)), 'missing seam ' + file));
assert.deepEqual(manifest.permissions, []);
assert.ok(contract.boundaries.refuses.includes('preview-as-runtime-proof'));
console.log('element-foundry discovery seam: PASS / shared schemas present / receipts explicit / zero permissions');
