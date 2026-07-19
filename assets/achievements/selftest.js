#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const Core = require('../../shared/profile/axm-profile-core');

const ROOT = __dirname;
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.json'), 'utf8'));
const source = JSON.parse(fs.readFileSync(path.join(ROOT, manifest.activePack.sourceManifest), 'utf8'));
const failures = [];
function check(value, message) { if (!value) failures.push(message); }
function pngInfo(file) {
  const b = fs.readFileSync(file);
  check(b.length > 33 && b.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])), path.basename(file) + ': PNG signature');
  return { width: b.readUInt32BE(16), height: b.readUInt32BE(20), colorType: b[25] };
}

check(manifest.schema === 'axm.achievement-emblem-set/v2', 'manifest schema');
check(manifest.catalogMode === 'appendable', 'catalog remains appendable');
check(manifest.metricFamilies.length === 8, 'eight progressive metric families');
check(source.transparent_background === true, 'source declares transparent background');
check(source.items.length === 30, 'source pack has 24 emblems and 6 templates');

const referenced = [];
for (const family of manifest.metricFamilies) {
  const definitions = family.ids.map(id => Core.ACHIEVEMENTS.find(item => item.id === id));
  check(definitions.every(Boolean), family.stat + ': every catalog id exists');
  check(definitions.every(item => item && item.stat === family.stat), family.stat + ': catalog stat matches');
  const thresholds = definitions.filter(Boolean).map(item => item.threshold);
  check(thresholds.every((value, index) => index === 0 || value > thresholds[index - 1]), family.stat + ': thresholds increase');
  definitions.filter(Boolean).forEach(item => referenced.push(item.asset.replace(/^\/assets\/achievements\//, '')));
}
check(new Set(Core.ACHIEVEMENTS.map(item => item.stat + ':' + item.threshold)).size === Core.ACHIEVEMENTS.length, 'no duplicate stat/threshold unlocks');
check(referenced.length === 24 && new Set(referenced).size === 24, '24 unique progressive catalog assets');

const files = referenced.concat(manifest.templates);
for (const relative of files) {
  const file = path.join(ROOT, relative);
  check(fs.existsSync(file), relative + ': file exists');
  if (!fs.existsSync(file)) continue;
  const info = pngInfo(file);
  check(info.width === 512 && info.height === 512, relative + ': 512 x 512');
  check(info.colorType === 4 || info.colorType === 6, relative + ': PNG has alpha channel');
}

if (failures.length) {
  console.error('achievement artwork selftest: FAIL');
  failures.forEach(item => console.error('  - ' + item));
  process.exit(1);
}
console.log('achievement artwork selftest: PASS (24 emblems + 6 templates, alpha verified)');
