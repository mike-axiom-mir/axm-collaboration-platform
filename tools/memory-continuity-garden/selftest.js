#!/usr/bin/env node
'use strict';

const assert = require('assert');
const childProcess = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const root = __dirname;
const runtime = path.join(root, 'runtime');
const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
const manifest = readJson(path.join(root, 'manifest.json'));
const contract = readJson(path.join(root, 'module.contract.json'));
const catalog = readJson(path.join(root, 'catalog.json'));

assert.equal(manifest.id, contract.id);
assert.equal(manifest.version, contract.version);
assert.deepEqual(manifest.permissions, contract.permissions);
assert(['EXPERIMENTAL', 'WORKING'].includes(manifest.status));
assert.equal(catalog.counts.candidates, 100);
assert.equal(catalog.counts.unique_stable_ids, 100);
assert.equal(catalog.counts.semantic_executables, 0);
assert.equal(catalog.counts.reference_available, 86);
assert.equal(catalog.counts.governance_holds, 14);
assert(catalog.candidates.every(row => row.semantic_executable === false));

const checksumRows = fs.readFileSync(path.join(runtime, 'CHECKSUMS.sha256'), 'utf8').trim().split(/\r?\n/).map(line => {
  const match = /^([a-f0-9]{64})  (.+)$/.exec(line);
  assert(match, 'invalid installed checksum row');
  return { digest: match[1], relative: match[2] };
});
assert(checksumRows.length > 2200);
for (const row of checksumRows) {
  const absolute = path.resolve(runtime, ...row.relative.split('/'));
  assert(absolute.startsWith(runtime + path.sep), 'checksum path escaped runtime');
  assert(fs.statSync(absolute).isFile(), 'checksum target missing: ' + row.relative);
  assert.equal(crypto.createHash('sha256').update(fs.readFileSync(absolute)).digest('hex'), row.digest, 'checksum drift: ' + row.relative);
}

const python = process.env.AXM_PYTHON || process.env.PYTHON || (process.platform === 'win32' ? 'python' : 'python3');
const validation = childProcess.spawnSync(python, [path.join(root, 'memory-cli.py'), '--validate'], {
  cwd: root, encoding: 'utf8', windowsHide: true, timeout: 60000, maxBuffer: 4 * 1024 * 1024
});
assert.equal(validation.status, 0, String(validation.stderr || validation.stdout));
const validationResult = JSON.parse(validation.stdout);
assert.equal(validationResult.status, 'PASS');
assert.equal(validationResult.candidates, 100);

const describe = childProcess.spawnSync(python, [path.join(root, 'memory-cli.py'), '--describe', 'axm.memory.session-handoff-packet'], {
  cwd: root, encoding: 'utf8', windowsHide: true, timeout: 10000
});
assert.equal(describe.status, 0, String(describe.stderr || describe.stdout));
const described = JSON.parse(describe.stdout);
assert.equal(described.semantic_executable, false);
assert.equal(described.integration_status, 'REFERENCE_AVAILABLE');

console.log('memory continuity garden selftest: PASS (100 unique reference contracts, 86 reviewable, 14 governance holds, 0 semantic-execution claims)');
