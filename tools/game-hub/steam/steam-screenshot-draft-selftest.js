#!/usr/bin/env node
'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const Readiness = require('./steam-readiness');

const root = path.resolve(__dirname, '..', '..', '..');
const draftDir = path.join(__dirname, 'assets', 'draft');
const candidateDir = path.join(__dirname, 'assets', 'draft', 'candidate');
const screenshotDir = path.join(candidateDir, 'screenshots');
const manifest = JSON.parse(fs.readFileSync(path.join(screenshotDir, 'screenshot-manifest.json'), 'utf8'));
const audit = Readiness.auditAssets(root, Readiness.readPlan(), 'tools/game-hub/steam/assets/draft/candidate');

assert.strictEqual(manifest.schema, 'axm.steam-gameplay-screenshot-draft/v1');
assert.strictEqual(manifest.status, 'TEST');
assert.strictEqual(manifest.human_approval, false);
assert.strictEqual(manifest.steam_upload_performed, false);
assert.strictEqual(manifest.source_frames_are_live_gameplay, true);
assert.strictEqual(manifest.only_deterministic_resize_applied, true);
assert.strictEqual(manifest.content_editing_performed, false);
assert.strictEqual(manifest.screenshots.length, 5);
assert.strictEqual(new Set(manifest.screenshots.map(item => item.game_id)).size, 5);
assert.strictEqual(audit.screenshot_count, 5);
assert.strictEqual(audit.screenshots.filter(item => item.verdict === 'PASS').length, 5);

for (const screenshot of manifest.screenshots) {
  assert.strictEqual(screenshot.generated_image, false, screenshot.file + ' must be recorded as live gameplay');
  assert.ok(screenshot.observed_interaction, screenshot.file + ' must record an observed interaction');
  const source = fs.readFileSync(path.join(draftDir, screenshot.source.file));
  const output = fs.readFileSync(path.join(screenshotDir, screenshot.file));
  assert.strictEqual(crypto.createHash('sha256').update(source).digest('hex'), screenshot.source.sha256);
  assert.strictEqual(crypto.createHash('sha256').update(output).digest('hex'), screenshot.candidate.sha256);
  assert.strictEqual(screenshot.candidate.width, 1920);
  assert.strictEqual(screenshot.candidate.height, 1080);
}

console.log('steam screenshot draft selftest: PASS · 5 live gameplay frames · 1920x1080 · hashes and interactions recorded');
