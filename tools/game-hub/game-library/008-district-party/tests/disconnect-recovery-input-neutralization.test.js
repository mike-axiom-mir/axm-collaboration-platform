'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

test('offline keyboard and pulse input cannot queue work for a later reconnect', () => {
  const client = fs.readFileSync(path.resolve(__dirname, '..', 'client', 'controller', 'controller.js'), 'utf8');

  assert.match(client, /pulseKeys\.forEach\(\(key\) => \{\s*input\[key\] = false;\s*\$\(pulseButtonIds\[key\]\)\.classList\.remove\('pressed'\);/);
  assert.match(client, /function triggerPulse\(key\) \{\s*if \(!linkLive\) return;/);
  assert.match(client, /function applyKeys\(\) \{\s*if \(!linkLive\) \{ keys\.clear\(\); resetPlayInput\(\); return; \}/);
});
