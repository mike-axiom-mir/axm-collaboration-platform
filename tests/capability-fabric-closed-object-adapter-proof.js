#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const childProcess = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const Fabric = require('../shared/capability-fabric');
const Registry = require('../shared/capability-fabric/builder-registry');

const EXPECTED = Object.freeze({
  builder: 'sha256:2b60372be00c2393b09a5f5d6543faf46c7a5064d6482036ecccc95e8317af23',
  recipe: 'sha256:6b324dfba5162dd6a588803d2539fa6cf16013b580569d8f99d51d5f1895eef8',
  catalog: 'sha256:d080e6b7ad16637e6019459930f0ebf6095f3dced3dfa7547781613bcbcc9b5f',
  package: 'sha256:99e8bd4ef8537737a1ed57ff8b244de53a9b342957e9f51e819813bf4b2a6a09'
});

let passed = 0;
function check(value, label) {
  assert(value, label);
  passed += 1;
  process.stdout.write('PASS ' + label + '\n');
}
function safeCleanup(root) {
  const resolved = path.resolve(root);
  if (path.dirname(resolved) !== path.resolve(os.tmpdir()) || !path.basename(resolved).startsWith('axm-strict-adapter-v2-proof-')) {
    throw new Error('temporary cleanup boundary refused');
  }
  fs.rmSync(resolved, { recursive: true, force: true });
}

function main() {
  const catalog = Fabric.loadCatalog();
  const recipe = catalog.recipes.find((row) => row.id === 'closed-object-contract-adapter');
  const builder = Registry.describe('closed-object-contract-adapter-v2');
  check(catalog.catalogDigest === EXPECTED.catalog && recipe.recipeDigest === EXPECTED.recipe && recipe.builderDigest === EXPECTED.builder, 'catalog, recipe, and builder lineage are exact');
  check(builder.status === Registry.ACTIVE && builder.implementationDigest === EXPECTED.builder, 'only the strict v2 builder is selected as active');
  check(Registry.describe('closed-object-contract-adapter-v1').status === Registry.REVIEW_CANDIDATE, 'historical v1 builder remains inactive review material');

  const request = Fabric.sealRequest(recipe.exampleRequest, true);
  const first = Fabric.build(request, catalog);
  const second = Fabric.build(request, catalog);
  const candidate = first.candidates[0];
  check(first.status === 'COMPLETE' && first.candidates.length === 1 && first.generatedCodeExecuted === false, 'one detached candidate is generated without execution');
  check(Fabric.canonicalJson(first) === Fabric.canonicalJson(second), 'identical input rebuild is byte-identical');
  check(Fabric.verifyCandidate(candidate).ok && candidate.package.packageDigest === EXPECTED.package, 'exact candidate bytes and package lineage verify');
  check(Object.values(candidate.package.authority).every((value) => value === false), 'candidate receives no permission or lifecycle authority');

  const source = candidate.files['capability.js'];
  const selftest = candidate.files['selftest.js'];
  check(source.includes('inspectRecord') && source.includes('SOURCE_PROPERTY_LIMIT_EXCEEDED') && source.includes('INPUT_BYTES_EXCEEDED') && source.includes('OUTPUT_BYTES_EXCEEDED'), 'runtime declares closed shape, property, and independent byte refusals');
  check(!source.includes('JSON.stringify(input)') && !source.includes('JSON.stringify(output)') && !/\bBuffer\b/.test(source), 'runtime does not delegate record measurement to host serializers');
  check(!/require\(['"](?:fs|node:fs|child_process|node:child_process|http|https|net|tls|dgram)['"]\)|\bfetch\s*\(|provider\.call|process\.(?:env|cwd)|Date\.now|Math\.random|new Function|\beval\s*\(/.test(source), 'runtime contains no filesystem, process, network, provider, environment, clock, randomness, or dynamic-code surface');
  check(['getterRead', 'const hidden=', 'const symbolRecord=', 'originalStringify', 'originalBuffer', "'SOURCE_PROPERTY_LIMIT_EXCEEDED'", "'INPUT_BYTES_EXCEEDED'", "'OUTPUT_BYTES_EXCEEDED'"].every((needle) => selftest.includes(needle)), 'emitted adversaries cover descriptors, host globals, property limits, and both byte budgets');

  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'axm-strict-adapter-v2-proof-'));
  try {
    const sourceRoot = path.join(root, 'detached-source');
    const executionRoot = path.join(root, 'trusted-execution-copy');
    fs.mkdirSync(sourceRoot);
    fs.mkdirSync(executionRoot);
    fs.writeFileSync(path.join(sourceRoot, 'capability.js'), source, { encoding: 'utf8', flag: 'wx' });
    fs.writeFileSync(path.join(sourceRoot, 'selftest.js'), selftest, { encoding: 'utf8', flag: 'wx' });
    fs.copyFileSync(path.join(sourceRoot, 'capability.js'), path.join(executionRoot, 'capability.js'), fs.constants.COPYFILE_EXCL);
    fs.copyFileSync(path.join(sourceRoot, 'selftest.js'), path.join(executionRoot, 'selftest.js'), fs.constants.COPYFILE_EXCL);
    check(path.relative(sourceRoot, executionRoot).startsWith('..' + path.sep), 'trusted execution copy is disjoint from detached source');
    check(Fabric.digest(fs.readFileSync(path.join(executionRoot, 'capability.js'), 'utf8')) === Fabric.digest(source) && Fabric.digest(fs.readFileSync(path.join(executionRoot, 'selftest.js'), 'utf8')) === Fabric.digest(selftest), 'execution-copy bytes match the exact candidate');
    const run = childProcess.spawnSync(process.execPath, [path.join(executionRoot, 'selftest.js')], {
      cwd: executionRoot,
      encoding: 'utf8',
      timeout: 10000,
      windowsHide: true,
      env: { AXM_TRUSTED_TEST_HOST: 'closed-object-contract-adapter-v2' }
    });
    check(run.status === 0 && run.signal === null && /PASS strict closed object contract adapter v2 capability/.test(run.stdout) && run.stderr === '', 'exact emitted adversarial selftest passes in the bounded trusted host');
  } finally {
    safeCleanup(root);
  }

  process.stdout.write('Strict closed-object adapter focused proof PASS · ' + passed + ' checks\n');
}

try { main(); }
catch (error) { process.stderr.write('Strict closed-object adapter focused proof FAIL\n' + (error.stack || error) + '\n'); process.exitCode = 1; }
