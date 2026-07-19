'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Inventory = require('../scripts/measure-workshop-inventory');

test('Workshop inventory is content-digested, order-stable, and extension-scoped', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mirror-workshop-inventory-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, 'z'), { recursive: true });
  fs.writeFileSync(path.join(root, 'z', 'b.js'), 'module.exports=2;\n');
  fs.writeFileSync(path.join(root, 'a.js'), 'module.exports=1;\n');
  fs.writeFileSync(path.join(root, 'ignored.json'), '{}\n');
  const first = Inventory.measure(root, 'js');
  const second = Inventory.measure(root, '.js');
  assert.deepEqual(second, first);
  assert.equal(first.files, 2);
  assert.equal(first.bytes, 36);
  fs.writeFileSync(path.join(root, 'z', 'b.js'), 'module.exports=3;\n');
  const changed = Inventory.measure(root, 'js');
  assert.equal(changed.files, first.files);
  assert.equal(changed.bytes, first.bytes);
  assert.notEqual(changed.digest, first.digest);
});
