'use strict';
const assert = require('assert');
const crypto = require('crypto');
const api = require('./core.js');

const bytes = Buffer.from('hello\n');
const digest = crypto.createHash('sha256').update(bytes).digest('hex');
const capsule = {
  schema: api.SCHEMA,
  capsule_id: 'test-capsule',
  policy: {
    external_dependencies_allowed: false,
    automatic_install_allowed: false,
    automatic_registry_change_allowed: false,
    automatic_promotion_allowed: false
  },
  modules: [{
    id: 'hello', root: 'modules/hello', external_dependencies: [],
    file_paths: ['modules/hello/manifest.json', 'modules/hello/module.contract.json', 'modules/hello/index.js'],
    manifest: 'modules/hello/manifest.json', contract: 'modules/hello/module.contract.json', entry: 'modules/hello/index.js'
  }],
  files: {
    'modules/hello/manifest.json': { bytes: bytes.length, sha256: digest },
    'modules/hello/module.contract.json': { bytes: bytes.length, sha256: digest },
    'modules/hello/index.js': { bytes: bytes.length, sha256: digest }
  }
};

assert.strictEqual(api.validateCapsule(capsule).pass, true);
assert.throws(() => api.normalizeRelativePath('../escape'), /parent/);
const selected = {
  'modules/hello/manifest.json': { size: bytes.length, bytes },
  'modules/hello/module.contract.json': { size: bytes.length, bytes },
  'modules/hello/index.js': { size: bytes.length, bytes }
};
async function hash(file) { return crypto.createHash('sha256').update(file.bytes).digest('hex'); }

(async function () {
  const ready = await api.verifyInventory(capsule, selected, hash);
  assert.strictEqual(ready.verdict, 'READY_FOR_GRAFT');
  const tampered = Object.assign({}, selected, { 'modules/hello/index.js': { size: bytes.length, bytes: Buffer.from('HELLO\n') } });
  const held = await api.verifyInventory(capsule, tampered, hash);
  assert.strictEqual(held.verdict, 'HOLD');
  assert.ok(held.failures.some(item => item.indexOf('sha256 mismatch') >= 0));
  console.log('branch-backfeed-lab: PASS');
})().catch(function (error) { console.error(error); process.exitCode = 1; });
