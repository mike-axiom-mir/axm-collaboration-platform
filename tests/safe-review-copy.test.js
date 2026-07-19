'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const ReviewCopy = require('../scripts/make-safe-review-copy');

test('safe review copy includes source while refusing private state and secret classes', t => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'mirror-review-copy-'));
  const source = path.join(base, 'source');
  const destination = path.join(base, 'destination');
  fs.mkdirSync(path.join(source, 'src'), { recursive: true });
  fs.mkdirSync(path.join(source, 'state'), { recursive: true });
  fs.mkdirSync(path.join(source, 'config'), { recursive: true });
  fs.writeFileSync(path.join(source, 'src', 'organ.js'), 'module.exports={};\n');
  fs.writeFileSync(path.join(source, 'state', 'session.json'), '{}\n');
  fs.writeFileSync(path.join(source, 'config', 'mirror.config.local.json'), '{}\n');
  fs.writeFileSync(path.join(source, 'access.token'), 'secret');
  t.after(() => fs.rmSync(base, { recursive: true, force: true }));
  const result = ReviewCopy.copyListedFiles(source, destination, ['state/session.json', 'src/organ.js', 'config/mirror.config.local.json', 'access.token']);
  assert.deepEqual(result.copied.map(item => item.path), ['src/organ.js']);
  assert.equal(result.refused.length, 3);
  assert.equal(fs.existsSync(path.join(destination, 'src', 'organ.js')), true);
  assert.equal(fs.existsSync(path.join(destination, 'state', 'session.json')), false);
});
