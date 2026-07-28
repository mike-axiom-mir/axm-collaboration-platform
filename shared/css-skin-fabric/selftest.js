#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const root = __dirname;
const approvedWindowsValidatorDigest = '5010638c04f860d4b4966e817f32004a416eb93107c0a967d1e71d7ff3dd0d2f';
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'FILE_MANIFEST.json'), 'utf8'));
const info = JSON.parse(fs.readFileSync(path.join(root, 'PACK_INFO.json'), 'utf8'));
let failures = 0;
function test(condition, label) {
  if (condition) console.log('PASS ' + label);
  else { failures++; console.error('FAIL ' + label); }
}

for (const entry of manifest.files) {
  const target = path.join(root, ...entry.path.split('/'));
  const bytes = fs.existsSync(target) ? fs.readFileSync(target) : null;
  const digest = bytes ? crypto.createHash('sha256').update(bytes).digest('hex') : 'missing';
  if (entry.path === 'tools/validate_pack.py') {
    test(digest === approvedWindowsValidatorDigest, entry.path + ' matches the approved Windows portability repair');
  } else {
    test(digest === entry.sha256, entry.path + ' matches the upstream manifest');
  }
}

test(manifest.file_count === 98 && manifest.files.length === 98, 'upstream manifest covers 98 files');
test(info.version === '0.2.0' && info.organ_count === 18, 'pack identity and organ count are intact');
test(info.component_count === 16 && info.material_count === 11 && info.theme_count === 8, 'interface catalogs are intact');
test(info.external_runtime_dependencies.length === 0, 'interface runtime has no external dependency');
test(fs.existsSync(path.join(root, 'AXM_WORKSHOP_INTEGRATION.md')), 'Workshop integration receipt exists');

if (failures) process.exit(1);
console.log('AXM CSS Skin Fabric intake selftest: PASS');
