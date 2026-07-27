#!/usr/bin/env node
'use strict';

const assert = require('assert');
const childProcess = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');
const index = JSON.parse(read('tools-index.json'));
const modules = JSON.parse(read('registry/modules.json'));
const status = JSON.parse(read('registry/public-status.json'));
const proofs = JSON.parse(read('registry/proofs.json'));
const capabilities = read('registry/capabilities.jsonl').trim().split(/\r?\n/).filter(Boolean).map(line => JSON.parse(line));

assert.equal(modules.schema, 'axm.public-modules/v1');
assert.equal(modules.source.digest, index.sourceDigest);
assert.equal(modules.modules.length, index.tools.length);
assert.equal(new Set(modules.modules.map(row => row.id)).size, modules.modules.length);
assert(modules.modules.every(row => fs.existsSync(path.join(root, row.source_path))), 'every public module source path must exist');
assert.equal(capabilities.length, index.capabilities.length);
assert.equal(new Set(capabilities.map(row => row.id)).size, capabilities.length);
assert(capabilities.every(row => row.truth.declaration_is_runtime_proof === false && row.truth.grants_authority === false));
assert.equal(status.release_status, 'EXPERIMENTAL');
assert.equal(status.gates.bundled_runtime.state, 'NOT_INCLUDED');
assert.equal(status.gates.offline_first_launch.state, 'NOT_CLAIMED');
assert.equal(status.gates.first_time_human_test.state, 'NOT_RUN');
assert(proofs.claims.every(row => row.evidence.length && row.does_not_prove.length));
assert(read('AXM_DISCOVERY_ROOT.md').includes('registry/capabilities.jsonl'));
assert(read('AI_START_HERE.md').includes('registry/public-status.json'));
const attributes = read('.gitattributes');
assert(attributes.includes('registry/*.json text eol=lf'), 'generated JSON registries must be LF-stable on Windows');
assert(attributes.includes('registry/*.jsonl text eol=lf'), 'generated JSONL registries must be LF-stable on Windows');

const generated = childProcess.spawnSync(process.execPath, ['scripts/generate-public-discovery.js', '--verify'], {
  cwd: root,
  encoding: 'utf8',
  windowsHide: true
});
assert.equal(generated.status, 0, String(generated.stderr || generated.stdout));

console.log('public discovery selftest: PASS (' + modules.modules.length + ' modules, ' + capabilities.length + ' declared capabilities)');
