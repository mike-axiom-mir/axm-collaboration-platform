'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const WorkshopRoot = require('../config/workshop-root');

test('Workshop root resolution has explicit, environment, config, and platform-aware lineage', t => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'mirror-workshop-root-'));
  const configured = path.join(base, 'configured-workshop');
  fs.mkdirSync(path.join(base, 'config'), { recursive: true });
  fs.writeFileSync(path.join(base, 'config', 'mirror.config.example.json'), JSON.stringify({ workshopRoot: configured }));
  t.after(() => fs.rmSync(base, { recursive: true, force: true }));
  const explicit = WorkshopRoot.resolveWithEvidence({ workshopRoot: path.join(base, 'explicit'), environment: {}, configRoot: base, platform: 'linux', homeDirectory: base });
  assert.equal(explicit.source, 'explicit-option');
  const environment = WorkshopRoot.resolveWithEvidence({ environment: { AXM_WORKSHOP_ROOT: path.join(base, 'environment') }, configRoot: base, platform: 'linux', homeDirectory: base });
  assert.equal(environment.source, 'AXM_WORKSHOP_ROOT');
  const config = WorkshopRoot.resolveWithEvidence({ environment: {}, configRoot: base, platform: 'linux', homeDirectory: base });
  assert.equal(config.source, 'config/mirror.config.example.json');
  assert.equal(config.root, path.resolve(configured));
  fs.writeFileSync(path.join(base, 'config', 'mirror.config.example.json'), '{}');
  const posix = WorkshopRoot.resolveWithEvidence({ environment: {}, configRoot: base, platform: 'linux', homeDirectory: base });
  assert.equal(posix.source, 'platform-default-posix-home');
  assert.equal(posix.root, path.join(base, 'axm-workshop'));
  const windows = WorkshopRoot.resolveWithEvidence({ environment: {}, configRoot: base, platform: 'win32', homeDirectory: base });
  assert.equal(windows.source, 'platform-default-windows');
});

test('absent Workshop is a typed hold rather than a mangled contract failure', t => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'mirror-workshop-absent-'));
  t.after(() => fs.rmSync(base, { recursive: true, force: true }));
  const observation = WorkshopRoot.inspect({ workshopRoot: path.join(base, 'missing'), environment: {}, configRoot: base });
  assert.equal(observation.schema, WorkshopRoot.SCHEMA);
  assert.equal(observation.state, 'WORKSHOP_ABSENT');
  assert.equal(observation.available, false);
  assert.match(observation.reason, /absent/);
});
