'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Inventory = require('../kernel/foundation-public-source-inventory-cell');
const Observatory = require('../organs/foundation-development-observatory-organ');

const ROOT = path.resolve(__dirname, '..');

function write(root, relative, content = '') {
  const file = path.join(root, relative);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

function fixtureRoot(order = 'forward') {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mirror-public-source-'));
  const entries = [
    ['package.json', '{"private":true}\n'],
    ['roots/AXM_ROOTS_v1.json', '{"roots":[]}\n'],
    ['runtime/server.js', "'use strict';\n"],
    ['training/TRAINING_POLICY.json', '{"schema":"fixture"}\n'],
    ['kernel/base-cell.js', "module.exports = { safe: true };\n"],
    ['organs/base-organ.js', "module.exports = { authority: false };\n"],
    ['contracts/base.schema.json', '{"type":"object"}\n']
  ];
  for (const [relative, content] of order === 'reverse' ? entries.slice().reverse() : entries) write(root, relative, content);
  return root;
}

test('current public-source inventory discovers new Foundation code without private material or authority', () => {
  const inventory = Inventory.collect(ROOT);
  assert.equal(inventory.schema, Inventory.INVENTORY_SCHEMA);
  assert.ok(inventory.summary.files > 400);
  assert.ok(inventory.files.some(item => item.path === 'kernel/foundation-public-source-inventory-cell.js'));
  assert.ok(inventory.files.some(item => item.path === 'organs/cognitive-resource-calibration-stewardship-organ.js'));
  assert.ok(inventory.files.some(item => item.path === 'contracts/cognitive-resource-calibration-report.schema.json'));
  assert.ok(inventory.files.some(item => item.path === 'modules/axm-native-learning-shell/manifest.json'));
  assert.ok(inventory.files.every(item => !item.path.startsWith('training/datasets/')));
  assert.ok(inventory.files.every(item => !item.path.startsWith('training/candidates/')));
  assert.ok(inventory.files.every(item => !item.path.includes('/storage/runtime/')));
  assert.ok(Object.values(inventory.authority).every(value => value === false));
  assert.equal(Inventory.verify(inventory, ROOT), true);
  const subject = Observatory.coreSubject(ROOT);
  assert.deepEqual(subject, inventory);
});

test('a future organ is automatically observed and creation order cannot change the inventory', t => {
  const firstRoot = fixtureRoot('forward');
  const secondRoot = fixtureRoot('reverse');
  t.after(() => fs.rmSync(firstRoot, { recursive: true, force: true }));
  t.after(() => fs.rmSync(secondRoot, { recursive: true, force: true }));
  const before = Inventory.collect(firstRoot);
  write(firstRoot, 'organs/future-unseen-organ.js', "module.exports = { learnedWeights: false };\n");
  const after = Inventory.collect(firstRoot);
  assert.notEqual(after.digest, before.digest);
  assert.ok(after.files.some(item => item.path === 'organs/future-unseen-organ.js'));
  fs.rmSync(path.join(firstRoot, 'organs', 'future-unseen-organ.js'));
  assert.deepEqual(Inventory.collect(firstRoot), Inventory.collect(secondRoot));
});

test('private datasets and runtime storage remain outside the digest even when their contents change', t => {
  const root = fixtureRoot();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  write(root, 'training/datasets/private-receipt.json', '{"private":"first"}\n');
  write(root, 'training/candidates/proposal.json', '{"candidate":true}\n');
  write(root, 'modules/demo/storage/runtime/session.json', '{"runtime":"first"}\n');
  const before = Inventory.collect(root);
  write(root, 'training/datasets/private-receipt.json', '{"private":"second"}\n');
  write(root, 'modules/demo/storage/runtime/session.json', '{"runtime":"second"}\n');
  const after = Inventory.collect(root);
  assert.equal(after.digest, before.digest);
  assert.ok(after.files.every(item => !/datasets|candidates|storage\/runtime/.test(item.path)));
});

test('symlinks, local configuration, hidden entries, absent anchors, and raised limits are refused', t => {
  const root = fixtureRoot();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'mirror-public-source-link-target-'));
  t.after(() => fs.rmSync(outside, { recursive: true, force: true }));
  write(outside, 'bait.js', 'module.exports = true;\n');
  fs.symlinkSync(outside, path.join(root, 'organs', 'linked-source'), 'junction');
  assert.throws(() => Inventory.collect(root), /symbolic link/);
  fs.rmSync(path.join(root, 'organs', 'linked-source'));

  write(root, 'config/mirror.config.local.json', '{"private":true}\n');
  assert.throws(() => Inventory.collect(root), /local configuration/);
  fs.rmSync(path.join(root, 'config', 'mirror.config.local.json'));
  write(root, 'kernel/.hidden-source.js', 'module.exports = true;\n');
  assert.throws(() => Inventory.collect(root), /hidden entry/);
  fs.rmSync(path.join(root, 'kernel', '.hidden-source.js'));
  fs.rmSync(path.join(root, 'runtime', 'server.js'));
  assert.throws(() => Inventory.collect(root), /server\.js|real file/);
  assert.throws(() => Inventory.collect(root, { maxFiles: Inventory.MAX_FILES + 1 }), /lower the hard limit/);
});

test('bounded file count, file bytes, total bytes, and depth fail closed', t => {
  const root = fixtureRoot();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  assert.throws(() => Inventory.collect(root, { maxFiles: 4 }), /file-count limit/);
  assert.throws(() => Inventory.collect(root, { maxFileBytes: 8 }), /file limit/);
  assert.throws(() => Inventory.collect(root, { maxTotalBytes: 16 }), /total byte limit/);
  write(root, 'kernel/a/b/c/deep.js', 'module.exports = true;\n');
  assert.throws(() => Inventory.collect(root, { maxDepth: 2 }), /depth limit/);
});

test('inventory and contract tampering are visible and runtime remains separate', () => {
  const inventory = Inventory.collect(ROOT);
  const forged = JSON.parse(JSON.stringify(inventory));
  forged.authority.capabilityClaim = true;
  forged.digest = Inventory.digest(Object.assign({}, forged, { digest: null }));
  assert.throws(() => Inventory.verify(forged, ROOT), /authority changed/);
  const contract = JSON.parse(fs.readFileSync(path.join(ROOT, 'contracts', 'foundation-public-source-inventory.schema.json'), 'utf8'));
  assert.equal(contract.$id, Inventory.INVENTORY_SCHEMA);
  assert.equal(contract.additionalProperties, false);
  const runtime = fs.readFileSync(path.join(ROOT, 'runtime', 'server.js'), 'utf8');
  assert.doesNotMatch(runtime, /foundation-public-source-inventory-cell/);
});
