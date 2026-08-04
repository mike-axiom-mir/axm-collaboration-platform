#!/usr/bin/env node
'use strict';

const assert = require('assert');
const childProcess = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

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

function walk(folder, prefix = '') {
  return fs.readdirSync(folder, { withFileTypes: true }).flatMap(entry => {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    return entry.isDirectory()
      ? walk(path.join(folder, entry.name), relative)
      : [relative];
  });
}

function runNode(args, timeout = 120000) {
  return childProcess.spawnSync(process.execPath, args, {
    cwd: runtime,
    encoding: 'utf8',
    windowsHide: true,
    shell: false,
    timeout,
    maxBuffer: 12 * 1024 * 1024
  });
}

const manifest = readJson(path.join(root, 'manifest.json'));
const contract = readJson(path.join(root, 'module.contract.json'));
const integration = readJson(path.join(root, 'integration-map.json'));
const intake = readJson(path.join(runtime, 'AXM_INTAKE_MANIFEST.json'));
const catalog = readJson(path.join(runtime, 'catalog', 'default-catalog.json'));
const sourcePackage = readJson(path.join(runtime, 'package.json'));

assert.equal(manifest.id, 'aetherfx');
assert.equal(manifest.id, contract.id);
assert.equal(manifest.version, contract.version);
assert.equal(manifest.status, 'TEST');
assert.deepEqual(manifest.permissions, contract.permissions);
assert(ContractVerifier.validateContract(contract, manifest).pass);
assert.equal(intake.projectId, 'axm.visual-effect-fabric');
assert.equal(intake.version, '1.3.0');
assert.equal(sourcePackage.name, 'axm-visual-effect-fabric');
assert.equal(sourcePackage.version, '1.3.0');
assert.equal(catalog.modules.length, 64);
assert.equal(new Set(catalog.modules.map(module => module.id)).size, 64);
assert.equal(integration.source.sha256, 'dd841fe2ad2425034c510f002602e43312f502748b195769bdcc91f3fb65a56c');
assert.equal(integration.source.files, 174);

const upstreamFile = path.join(root, 'UPSTREAM_SHA256SUMS.txt');
const integratedFile = path.join(runtime, 'reports', 'SHA256SUMS.txt');
assert.equal(sha256(upstreamFile), '25590ba0a81f188770119f65c9a3983980cd31da5b05fe041ec25d1701355af8');
const upstream = checksumMap(upstreamFile);
const integrated = checksumMap(integratedFile);
assert.equal(upstream.size, 170);
assert.equal(integrated.size, 170);
assert.deepEqual(Array.from(integrated.keys()), Array.from(upstream.keys()));

const generatedReports = new Set([
  'reports/INVENTORY.json',
  'reports/INVENTORY.md',
  'reports/SHA256SUMS.txt',
  'reports/BUILD_SUMMARY.json'
]);
for (const generated of generatedReports) assert(!integrated.has(generated));

const runtimeFiles = walk(runtime).filter(relative => !generatedReports.has(relative)).sort();
assert.deepEqual(runtimeFiles, Array.from(integrated.keys()).sort());
for (const [relative, expected] of integrated) {
  const absolute = path.resolve(runtime, ...relative.split('/'));
  assert(absolute.startsWith(runtime + path.sep), 'checksum path escapes runtime: ' + relative);
  assert(fs.statSync(absolute).isFile(), 'checksum target is missing: ' + relative);
  assert.equal(sha256(absolute), expected, 'integrated checksum drift: ' + relative);
}

const upstreamDifferences = Array.from(integrated.keys()).filter(
  relative => integrated.get(relative) !== upstream.get(relative)
);
assert.deepEqual(upstreamDifferences, [
  'tests/artifacts.test.mjs',
  'tools/build-inventory.mjs'
]);

const inventoryBuilder = fs.readFileSync(path.join(runtime, 'tools', 'build-inventory.mjs'), 'utf8');
assert(inventoryBuilder.includes("replaceAll('\\\\','/')"));
assert(inventoryBuilder.includes('generatedReports.has(relativePath(file))'));

const generatedCaches = walk(runtime).filter(relative =>
  relative.split('/').includes('__pycache__') || /\.py[co]$/i.test(relative)
);
assert.deepEqual(generatedCaches, []);

const entry = fs.readFileSync(path.join(runtime, 'OPEN_STUDIO.html'), 'utf8');
assert(entry.includes('AXM AetherFX Visual Effect Fabric Studio'));
assert(!/<script[^>]+src=/i.test(entry), 'bundled Studio must not load scripts');
assert(!/<link[^>]+rel=["']stylesheet/i.test(entry), 'bundled Studio must not load stylesheets');
assert(!/\b(?:src|href)=["']https?:\/\//i.test(entry), 'bundled Studio must not load remote assets');

const testFiles = fs.readdirSync(path.join(runtime, 'tests'))
  .filter(file => file.endsWith('.test.mjs'))
  .sort()
  .map(file => path.join('tests', file));
const suite = runNode(['--test', ...testFiles]);
assert.equal(suite.status, 0, String(suite.stderr || suite.stdout).slice(-6000));
assert.match(String(suite.stdout), /tests 36\b/);
assert.match(String(suite.stdout), /pass 36\b/);
assert.match(String(suite.stdout), /fail 0\b/);

const example = runNode([path.join('integration', 'runtime', 'example.mjs')], 30000);
assert.equal(example.status, 0, String(example.stderr || example.stdout));
const runtimeProof = JSON.parse(example.stdout);
assert.equal(runtimeProof.fabricVersion, '1.3.0');
assert.equal(runtimeProof.valid, true);
assert.equal(runtimeProof.resolvedOperations, 11);
assert.equal(runtimeProof.webSupport.implemented, 11);

const cli = path.join('tools', 'axmfx-cli.mjs');
const valid = runNode([cli, 'validate', path.join('examples', 'recipes', 'command-dashboard.axmrecipe.json')], 30000);
assert.equal(valid.status, 0, String(valid.stderr || valid.stdout));
assert.equal(JSON.parse(valid.stdout).valid, true);

const inspected = runNode([
  cli,
  'inspect',
  path.join('examples', 'recipes', 'cinematic-glass-stage.axmrecipe.json'),
  '--target=static-svg'
], 30000);
assert.equal(inspected.status, 0, String(inspected.stderr || inspected.stdout));
const inspection = JSON.parse(inspected.stdout);
assert.equal(inspection.valid, true);
assert.equal(inspection.resolvedOperations, 6);
assert.equal(inspection.targetSupport.summary.approximated, 6);
assert.equal(inspection.targetSupport.summary.unsupported, 0);

const refused = runNode([cli, 'validate', '__missing_recipe__.json'], 30000);
assert.notEqual(refused.status, 0, 'missing CLI input must be refused');
assert(!String(refused.stderr).includes('node:internal'), 'negative CLI path should remain friendly');

console.log(
  'aetherfx selftest: PASS ' +
  '(170 runtime checksums, 2 recorded platform patches, 36 Node tests, ' +
  '64 modules, runtime compile, static-SVG support report, positive and negative CLI paths)'
);
