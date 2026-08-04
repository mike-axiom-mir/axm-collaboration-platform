#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const readJson = name => JSON.parse(fs.readFileSync(path.join(__dirname, name), 'utf8'));
const manifest = readJson('manifest.json');
const contract = readJson('module.contract.json');

assert.equal(manifest.id, 'claude-connector');
assert.equal(manifest.schema, 'axm.tool-manifest/v1');
assert.equal(manifest.kind, 'service');
assert.equal(manifest.contract, 'module.contract.json');
assert.ok(fs.existsSync(path.join(__dirname, manifest.entry)));
assert.ok(fs.existsSync(path.join(__dirname, manifest.contract)));
assert.equal(contract.schema, 'axm.module-contract/v1');
assert.equal(contract.id, manifest.id);
assert.equal(contract.version, manifest.version);
assert.deepEqual([...manifest.permissions].sort(), [...contract.permissions].sort());
assert.deepEqual([...contract.permissions].sort(), [...manifest.uses].sort());
assert.deepEqual(contract.lifecycle, { state_owner: 'service', reload: 'resume', disconnect: 'graceful-degrade', cleanup: 'explicit' });
assert.ok(contract.provides.includes('connector-presence-heartbeat'));
assert.ok(contract.provides.includes('severe-trigger-pre-tool-gate'));
assert.ok(contract.boundaries.writes.includes('state/claude-guardian'));
assert.ok(contract.boundaries.refuses.includes('silent-hook-install'));
assert.ok(contract.boundaries.refuses.includes('credential-content-read'));
assert.ok(contract.boundaries.refuses.includes('merged-identity-memory'));

for (const source of [
  'claude-guardian.js',
  'claude-guardian-control.js',
  'claude-process-cutoff.js',
  'claude-guardian-selftest.js',
  'settings.local.template.json',
  'axm-claude-guardian.cmd.template'
]) assert.ok(fs.existsSync(path.join(__dirname, source)), source + ' is required');

console.log('Claude Connector selftest: PASS (declared contract, authority parity, portable source set)');
