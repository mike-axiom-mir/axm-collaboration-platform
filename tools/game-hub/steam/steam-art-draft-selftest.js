#!/usr/bin/env node
'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const Readiness = require('./steam-readiness');

const root = path.resolve(__dirname, '..', '..', '..');
const candidateDir = path.join(__dirname, 'assets', 'draft', 'candidate');
const manifestPath = path.join(candidateDir, 'candidate-manifest.json');
const plan = Readiness.readPlan();
const audit = Readiness.auditAssets(root, plan, 'tools/game-hub/steam/assets/draft/candidate');

assert.strictEqual(audit.images.length, 10);
assert.strictEqual(audit.images.filter(item => item.verdict === 'PASS').length, 10);
assert.strictEqual(audit.screenshot_count, 5, 'gameplay screenshots must remain separate from generated concept art');
assert.strictEqual(audit.screenshots.filter(item => item.verdict === 'PASS').length, 5);
const logo = audit.images.find(item => item.id === 'library_logo');
assert.ok(logo && logo.dimensions.hasAlpha === true, 'library logo must carry a PNG alpha channel');

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
assert.strictEqual(manifest.schema, 'axm.steam-art-draft/v1');
assert.strictEqual(manifest.status, 'TEST');
assert.strictEqual(manifest.human_approval, false);
assert.strictEqual(manifest.steam_upload_performed, false);
assert.strictEqual(manifest.assets.length, 10);
for (const asset of manifest.assets) {
  const bytes = fs.readFileSync(path.join(candidateDir, asset.file));
  assert.strictEqual(crypto.createHash('sha256').update(bytes).digest('hex'), asset.sha256, asset.file + ' hash must match the draft manifest');
}

console.log('steam art draft selftest: PASS · 10/10 image dimensions · transparent logo · 5 separate gameplay screenshots');
