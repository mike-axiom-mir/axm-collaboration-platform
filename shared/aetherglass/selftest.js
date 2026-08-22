#!/usr/bin/env node
'use strict';
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const Skin = require('../../hub/skin-core.js');
const Bridge = require('./axm-skin-bridge.js');

let failures = 0;
function test(condition, message) {
  if (condition) console.log('PASS ' + message);
  else { failures++; console.error('FAIL ' + message); }
}

const expected = {
  'MODULE_MANIFEST.json': '09484a3dbe2ee9d6af5d11063dcd72afcd9baf45b80a3f1f73f0c23f4a65197a',
  'src/axm-aetherglass.css': 'd72ec75e2259345cd056e591ff20f3c7e1179964d9556d9020fd2011dc06c993',
  'src/axm-aetherglass.js': '5dc839090fcea94f83daa310dc93c1c9686e0d181e95ea495da881ef90ff55fd',
  'src/axm-luminous-layer-forge.css': '21f0e0bfb002f724feb0fd58e481e8430a327bf212848e5b9ca8962ebdc3a528',
  'src/axm-luminous-layer-forge.js': '8076b18ec9c9a936c485a5f45c95ea08ce87d1dd848770956113f128d0f5e2f1'
};
Object.keys(expected).forEach(function (relative) {
  const bytes = fs.readFileSync(path.join(__dirname, relative));
  const actual = crypto.createHash('sha256').update(bytes).digest('hex');
  test(actual === expected[relative], relative + ' matches the verified v7.1.0 release');
});

const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, 'MODULE_MANIFEST.json'), 'utf8'));
Object.entries(manifest.entrypoints || {}).forEach(function ([name, relative]) {
  test(fs.existsSync(path.join(__dirname, relative)), 'declared entrypoint exists: ' + name);
});

const skin = Skin.newSkin('Bridge proof', 'axm');
skin.tokens = { '--cy':'#12d6ee', '--purple':'#ab78ff', '--blue':'#356fff', '--gold':'#efbd57' };
skin.visuals = { enabled:true, theme:'royal', lightPreset:'quiet-aura' };
const resolved = Skin.resolve(skin);
const runtime = Bridge.runtimeConfig(resolved);
test(runtime.theme === 'royal', 'bridge carries the accepted core visual config');
test(runtime.palette.accent1 === '#12d6ee' && runtime.palette.lux === '#efbd57', 'bridge derives Aetherglass accents from accepted skin colours');
test(!('enabled' in runtime) && !('lightPreset' in runtime), 'bridge keeps non-core controls out of the core runtime payload');
test(typeof Bridge.apply === 'function' && typeof Bridge.destroy === 'function', 'bridge exposes owned mount and teardown seams');

if (failures) process.exit(1);
console.log('Aetherglass skin bridge selftest: PASS');
