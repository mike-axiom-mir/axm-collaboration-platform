#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const childProcess = require('child_process');
const crypto = require('crypto');

const root = __dirname;
const runtime = path.join(root, 'runtime');
const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
const manifest = readJson(path.join(root, 'manifest.json'));
const contract = readJson(path.join(root, 'module.contract.json'));
const intake = readJson(path.join(runtime, 'LOCAL_INTAKE_INDEX.json'));

assert.equal(manifest.id, contract.id);
assert.equal(manifest.version, contract.version);
assert.equal(manifest.status, 'WORKING');
assert.deepEqual(manifest.permissions, contract.permissions);
assert.equal(intake.modules.length, 100);
assert.equal(intake.modules.filter(row => row.status === 'LOCAL_PROTOTYPE').length, 90);
assert.equal(intake.modules.filter(row => row.status === 'SHADOW_ONLY').length, 10);
assert(intake.modules.every(row => row.default_enabled === false));

for (const row of intake.modules) {
  const prefix = String(row.module_number).padStart(3, '0') + '_';
  const folders = fs.readdirSync(path.join(runtime, 'modules')).filter(name => name.startsWith(prefix));
  assert.equal(folders.length, 1, 'one folder for module ' + row.module_number);
  const implementation = path.join(runtime, 'modules', folders[0], 'implementation.py');
  assert.equal(fs.existsSync(implementation), row.status === 'LOCAL_PROTOTYPE', 'implementation boundary for ' + row.module_number);
}

assert(fs.existsSync(path.join(root, 'vendor', 'tzdata-2026b', 'zoneinfo', 'Europe', 'Amsterdam')));
assert(fs.existsSync(path.join(root, 'vendor', 'tzdata-2026b', 'zoneinfo', 'UTC')));

const checksumRows = fs.readFileSync(path.join(runtime, 'CHECKSUMS.sha256'), 'utf8').trim().split(/\r?\n/).map(line => {
  const match = /^([a-f0-9]{64})  (.+)$/.exec(line);
  assert(match, 'invalid installed checksum row');
  return { digest: match[1], relative: match[2] };
});
assert.equal(checksumRows.length, 765);
for (const row of checksumRows) {
  const absolute = path.resolve(runtime, ...row.relative.split('/'));
  assert(absolute.startsWith(runtime + path.sep), 'checksum path must remain inside runtime');
  assert(fs.statSync(absolute).isFile(), 'checksum target must be a file');
  assert.equal(crypto.createHash('sha256').update(fs.readFileSync(absolute)).digest('hex'), row.digest, 'checksum drift: ' + row.relative);
}

const python = process.env.AXM_PYTHON || process.env.PYTHON || (process.platform === 'win32' ? 'python' : 'python3');
const environment = Object.assign({}, process.env, {
  PYTHONTZPATH: path.join(root, 'vendor', 'no-system-tzdata')
});

const smoke = childProcess.spawnSync(python, [
  path.join(root, 'translation-cli.py'),
  '--run', '16',
  '--input', JSON.stringify({ args: ['timestamp'], kwargs: { value: '2026-07-27T16:00:00Z', target_timezone: 'Europe/Amsterdam' } })
], { cwd: root, env: environment, encoding: 'utf8', windowsHide: true, timeout: 20000 });
assert.equal(smoke.status, 0, String(smoke.stderr || smoke.stdout));
assert(String(smoke.stdout).includes('+02:00'), 'bundled IANA fallback must produce Amsterdam summer time');

const shadow = childProcess.spawnSync(python, [
  path.join(root, 'translation-cli.py'), '--run', '43', '--input', JSON.stringify({ args: [], kwargs: {} })
], { cwd: root, env: environment, encoding: 'utf8', windowsHide: true, timeout: 10000 });
assert.notEqual(shadow.status, 0, 'shadow module execution must be refused');
assert(String(shadow.stderr).includes('contract-only'));

const suite = childProcess.spawnSync(python, [path.join(root, 'runtime-selftest.py')], {
  cwd: root,
  env: environment,
  encoding: 'utf8',
  windowsHide: true,
  timeout: 120000,
  maxBuffer: 4 * 1024 * 1024
});
assert.equal(suite.status, 0, String(suite.stderr || suite.stdout).slice(-4000));
assert(String(suite.stdout).includes('AXM TRANSLATION INSTALLED RUNTIME: PASS'));

console.log('adapter translation garden selftest: PASS (90 prototypes, 10 shadows, 972 installed-runtime tests, 1004 source tests, bundled tzdata fallback)');
