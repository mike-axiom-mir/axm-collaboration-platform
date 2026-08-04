#!/usr/bin/env node
'use strict';

const assert = require('assert');
const childProcess = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const Runner = require('./run-cli');
const ContractVerifier = require('../../hub/module-contract-verifier');

const root = __dirname;
const runtime = path.join(root, 'runtime');
const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
const sha256 = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');

function checksumMap(file) {
  const rows = fs.readFileSync(file, 'utf8').trim().split(/\r?\n/);
  const mapped = new Map();
  for (const row of rows) {
    const match = /^([a-f0-9]{64})  (.+)$/.exec(row);
    assert(match, 'invalid checksum row in ' + path.basename(file));
    assert(!mapped.has(match[2]), 'duplicate checksum path: ' + match[2]);
    mapped.set(match[2], match[1]);
  }
  return mapped;
}

function runPython(found, args, timeout) {
  return childProcess.spawnSync(found.command, found.prefix.concat(['-B']).concat(args), {
    cwd: runtime,
    env: Runner.pythonEnvironment(process.env),
    encoding: 'utf8',
    windowsHide: true,
    shell: false,
    timeout: timeout || 120000,
    maxBuffer: 8 * 1024 * 1024
  });
}

const manifest = readJson(path.join(root, 'manifest.json'));
const contract = readJson(path.join(root, 'module.contract.json'));
const integration = readJson(path.join(root, 'integration-map.json'));
const upstreamManifest = readJson(path.join(runtime, 'manifest.json'));
const intake = readJson(path.join(runtime, 'intake', 'AXM_LOCAL_INTAKE.json'));

assert.equal(manifest.id, 'text-fabric');
assert.equal(manifest.id, contract.id);
assert.equal(manifest.version, contract.version);
assert.equal(manifest.status, 'TEST');
assert.deepEqual(manifest.permissions, contract.permissions);
assert(ContractVerifier.validateContract(contract, manifest).pass);
assert.equal(upstreamManifest.id, 'axm.text.fabric');
assert.equal(upstreamManifest.version, '1.0.0');
assert.equal(upstreamManifest.organs, 30);
assert.equal(upstreamManifest.presets, 24);
assert.equal(intake.canonical_status, 'WORKING');
assert.equal(integration.source.sha256, 'c7c9b4a8030fc2e9289aa47cd6c939c76b2d6e3f4e763198b6e9f853e3eecd48');

const currentChecksums = checksumMap(path.join(runtime, 'SHA256SUMS.txt'));
const upstreamChecksums = checksumMap(path.join(root, 'UPSTREAM_SHA256SUMS.txt'));
assert.equal(currentChecksums.size, 281);
assert.equal(upstreamChecksums.size, 281);
assert.deepEqual(Array.from(currentChecksums.keys()), Array.from(upstreamChecksums.keys()));

for (const [relative, expected] of currentChecksums) {
  const absolute = path.resolve(runtime, ...relative.split('/'));
  assert(absolute.startsWith(runtime + path.sep), 'checksum path escapes runtime: ' + relative);
  assert(fs.statSync(absolute).isFile(), 'checksum target is missing: ' + relative);
  assert.equal(sha256(absolute), expected, 'integrated checksum drift: ' + relative);
}

const upstreamDifferences = Array.from(currentChecksums.keys()).filter(
  relative => currentChecksums.get(relative) !== upstreamChecksums.get(relative)
);
assert.deepEqual(upstreamDifferences, [
  'LAYOUT_STRESS_LAB.html',
  'axm_text_fabric/static_assets.py',
  'tests/test_layout_lab.py',
  'tests/test_static_assets.py'
]);

const generatedCaches = [];
function scanCaches(folder) {
  for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
    const absolute = path.join(folder, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === '__pycache__') generatedCaches.push(absolute);
      else scanCaches(absolute);
    } else if (/\.py[co]$/i.test(entry.name)) generatedCaches.push(absolute);
  }
}
scanCaches(runtime);
assert.deepEqual(generatedCaches, []);

const entry = fs.readFileSync(path.join(runtime, 'START_HERE.html'), 'utf8');
assert(entry.includes('AXM Text Fabric'));
assert(entry.includes('LAYOUT_STRESS_LAB.html'));
assert(!/\b(?:fetch|XMLHttpRequest|WebSocket)\s*\(/.test(entry), 'browser workshop must remain network-free');

const found = Runner.findPython(process.env);
assert(found, 'Python 3.10 or newer is required to verify AXM Text Fabric');

const suite = runPython(found, ['tests/run_all.py'], 120000);
assert.equal(suite.status, 0, String(suite.stderr || suite.stdout).slice(-5000));
assert(String(suite.stdout).includes('RESULT: 19 passed, 0 failed'));

const presets = runPython(found, ['-m', 'axm_text_fabric.cli', 'list-presets'], 20000);
assert.equal(presets.status, 0, String(presets.stderr || presets.stdout));
assert.equal(String(presets.stdout).trim().split(/\r?\n/).length, 24);

const resolved = runPython(found, [
  '-m', 'axm_text_fabric.cli', 'resolve-preset', 'axm_future_core',
  '--platform', 'web', '--quality-tier', 'balanced'
], 20000);
assert.equal(resolved.status, 0, String(resolved.stderr || resolved.stdout));
const plan = JSON.parse(resolved.stdout);
assert.equal(plan.preset_id, 'axm_future_core');
assert.equal(plan.adapter.kind, 'web_css_variables');
assert.equal(plan.resolved.layout_audit.status, 'pass');
assert(plan.resolved.contrast.passes);

const refused = runPython(found, [
  '-m', 'axm_text_fabric.cli', 'resolve-preset', '__missing_preset__'
], 20000);
assert.notEqual(refused.status, 0, 'unknown preset must be refused');
assert(!String(refused.stderr).includes('Traceback'), 'negative CLI path should remain friendly');

console.log(
  'text fabric selftest: PASS ' +
  '(281 runtime checksums, 4 recorded platform patches, 19 Python tests, ' +
  '24 presets, resolved Web handoff, negative CLI path; ' + found.source + ' ' + found.version + ')'
);
