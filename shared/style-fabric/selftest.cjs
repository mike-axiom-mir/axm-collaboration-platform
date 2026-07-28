#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const root = __dirname;
let failures = 0;
function test(condition, message) {
  if (condition) console.log('PASS ' + message);
  else { failures++; console.error('FAIL ' + message); }
}

const manifestLines = fs.readFileSync(path.join(root, 'FILE_MANIFEST.sha256'), 'utf8')
  .split(/\r?\n/)
  .filter(Boolean);
let checked = 0;
for (const line of manifestLines) {
  const match = line.match(/^([0-9a-f]{64})\s+\.\/(.+)$/i);
  if (!match) continue;
  checked++;
  const file = path.join(root, ...match[2].split('/'));
  const actual = fs.existsSync(file)
    ? crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')
    : 'missing';
  test(actual === match[1].toLowerCase(), match[2] + ' matches the Style Fabric 0.5.0 release');
}

const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
test(checked === 136, 'release manifest covers 136 upstream files');
test(manifest.id === 'axm.style-fabric' && manifest.version === '0.5.0', 'release identity is Style Fabric 0.5.0');
test(manifest.permissions.network === false, 'release declares no network permission');
test(Object.keys(pkg.dependencies || {}).length === 0, 'release has no third-party runtime dependencies');

if (failures) process.exit(1);
console.log('Style Fabric release selftest: PASS');
