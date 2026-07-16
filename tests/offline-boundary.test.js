'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');

test('runtime source contains no external HTTP client imports or remote URLs', () => {
  const files = ['runtime/server.js', 'adapters/workshop/workshop-heartbeat.js', 'kernel/principle-cell.js', 'kernel/state-language.js'];
  const source = files.map(file => fs.readFileSync(path.join(ROOT, file), 'utf8')).join('\n');
  assert.doesNotMatch(source, /require\(['"]https['"]\)/);
  assert.doesNotMatch(source, /https:\/\//);
  assert.doesNotMatch(source, /0\.0\.0\.0/);
});

test('browser adapter never contains the runtime token path or a bearer literal', () => {
  const source = fs.readFileSync(path.join(ROOT, 'adapters/workshop/mirror-provider.js'), 'utf8');
  assert.doesNotMatch(source, /runtime-token/i);
  assert.doesNotMatch(source, /Bearer\s/i);
});
