#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const auditRoot = __dirname;
const workshop = path.resolve(auditRoot, '..', '..', '..');
const roadmap = readJson(path.join(auditRoot, 'next-50-modules.json'));
const runTests = process.argv.includes('--run-tests');
const hubArgument = process.argv.find((argument) => argument.startsWith('--hub='));
const hubBase = hubArgument ? hubArgument.slice('--hub='.length).replace(/\/$/, '') : null;

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  return value;
}

function sha256(value) {
  return crypto.createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex').toUpperCase();
}

function runSelftest(file) {
  const result = spawnSync(process.execPath, [file], { cwd: workshop, encoding: 'utf8', timeout: 120000, windowsHide: true });
  const output = `${result.stdout || ''}\n${result.stderr || ''}`.trim();
  assert.equal(result.status, 0, `${path.relative(workshop, file)} failed:\n${output}`);
  const match = output.match(/passed\s+(\d+)\s+checks/i);
  assert(match, `${path.relative(workshop, file)} did not report an exact check count:\n${output}`);
  return Number(match[1]);
}

async function main() {
  assert.equal(roadmap.schema, 'axm.module-roadmap/v1');
  assert.equal(roadmap.modules.length, 50, 'Roadmap must contain exactly 50 modules');
  assert.deepEqual(roadmap.modules.map((module) => module.rank), Array.from({ length: 50 }, (_, index) => index + 1), 'Ranks must be continuous');
  assert.equal(new Set(roadmap.modules.map((module) => module.id)).size, 50, 'Module IDs must be unique');

  const phaseCounts = {};
  const parentCounts = {};
  let automaticWrites = 0;
  let automaticApplyClaims = 0;
  let automaticPublishClaims = 0;
  const moduleTests = [];

  for (const expected of roadmap.modules) {
    const moduleRoot = path.join(workshop, 'tools', expected.id);
    const manifestFile = path.join(moduleRoot, 'manifest.json');
    const contractFile = path.join(moduleRoot, 'module.contract.json');
    const selftestFile = path.join(moduleRoot, 'selftest.js');
    for (const file of [manifestFile, contractFile, selftestFile]) assert(fs.existsSync(file), `${expected.id}: missing ${path.basename(file)}`);
    const manifest = readJson(manifestFile);
    const contract = readJson(contractFile);
    const entryFile = path.join(moduleRoot, manifest.entry || 'index.html');
    assert(fs.existsSync(entryFile), `${expected.id}: missing entry ${manifest.entry}`);
    assert.equal(manifest.id, expected.id, `${expected.id}: manifest identity drift`);
    assert.equal(manifest.rank, expected.rank, `${expected.id}: rank drift`);
    assert.equal(manifest.phase, expected.phase, `${expected.id}: phase drift`);
    assert.equal(manifest.category, expected.parent, `${expected.id}: parent/category drift`);
    assert.equal(contract.id, manifest.id, `${expected.id}: contract identity drift`);
    assert.equal(contract.version, manifest.version, `${expected.id}: contract version drift`);
    assert(Array.isArray(manifest.actions) && manifest.actions.length >= 3, `${expected.id}: weak Hub action metadata`);
    assert(Array.isArray(manifest.produces) && manifest.produces.length >= 1, `${expected.id}: missing typed output metadata`);
    assert(Array.isArray(contract.boundaries?.automaticWrites), `${expected.id}: automaticWrites boundary missing`);
    automaticWrites += contract.boundaries.automaticWrites.length;
    const refusals = contract.boundaries?.refuses || [];
    assert(refusals.length >= 5, `${expected.id}: refusal boundary is underspecified`);
    phaseCounts[expected.phase] = (phaseCounts[expected.phase] || 0) + 1;
    parentCounts[expected.parent] = (parentCounts[expected.parent] || 0) + 1;
    moduleTests.push(selftestFile);
  }

  assert.equal(automaticWrites, 0, 'A module declares automatic writes');
  assert.deepEqual(phaseCounts, { P0: 10, P1: 15, P2: 12, P3: 7, P4: 6 });
  assert.deepEqual(parentCounts, { Play: 10, Build: 13, Create: 15, 'AI Team': 6, Publish: 6 });

  const cells = [
    ['P0', 'tools/local-3d-game-runtime/p0-production-cell.json', 10],
    ['P1', 'tools/p1-production-foundation/p1-production-cell.json', 15],
    ['P2', 'tools/p2-experience-foundation/p2-experience-cell.json', 12],
    ['P3/P4', 'tools/p34-release-foundation/p34-release-cell.json', 13]
  ].map(([phase, relative, expectedCount]) => {
    const cell = readJson(path.join(workshop, relative));
    assert.equal(cell.modules.length, expectedCount, `${phase}: production-cell count drift`);
    assert.equal(new Set(cell.modules.map((module) => module.id)).size, expectedCount, `${phase}: duplicate production-cell identity`);
    assert.equal(cell.libraryPromotion, 'off', `${phase}: library promotion must remain off`);
    assert.equal(cell.automaticWrites || 0, 0, `${phase}: automatic writes must remain zero`);
    automaticApplyClaims += Number(cell.automaticApply === true);
    automaticPublishClaims += Number(cell.automaticPublish === true);
    return { phase, modules: expectedCount, receiptSha256: cell.receiptSha256 || sha256(cell) };
  });
  assert.equal(automaticApplyClaims, 0, 'A production cell enables automatic apply');
  assert.equal(automaticPublishClaims, 0, 'A production cell enables automatic publish');

  const testSummary = { mode: runTests ? 'executed' : 'not-run', programs: 0, moduleChecks: 0, foundationChecks: 0, totalChecks: 0 };
  if (runTests) {
    for (const testFile of moduleTests) testSummary.moduleChecks += runSelftest(testFile);
    const foundationTests = [
      'tools/p1-production-foundation/selftest.js',
      'tools/p1-production-foundation/cell-selftest.js',
      'tools/p2-experience-foundation/selftest.js',
      'tools/p2-experience-foundation/cell-selftest.js',
      'tools/p34-release-foundation/selftest.js',
      'tools/p34-release-foundation/cell-selftest.js'
    ];
    for (const relative of foundationTests) testSummary.foundationChecks += runSelftest(path.join(workshop, relative));
    testSummary.programs = moduleTests.length + foundationTests.length;
    testSummary.totalChecks = testSummary.moduleChecks + testSummary.foundationChecks;
    assert(testSummary.moduleChecks >= 1124, 'Module check coverage fell below the sealed baseline');
    assert(testSummary.foundationChecks >= 332, 'Foundation/cell check coverage fell below the sealed baseline');
  }

  const hub = { checked: false, discovered: 0, ranked: 0, phased: 0 };
  if (hubBase) {
    const response = await fetch(`${hubBase}/api/tools`);
    assert(response.ok, `Hub discovery failed with HTTP ${response.status}`);
    const payload = await response.json();
    const tools = Array.isArray(payload) ? payload : payload.tools;
    assert(Array.isArray(tools), 'Hub /api/tools response has no tool list');
    const byId = new Map(tools.map((tool) => [tool.id, tool]));
    const discovered = roadmap.modules.map((module) => byId.get(module.id)).filter(Boolean);
    hub.checked = true;
    hub.discovered = discovered.length;
    hub.ranked = discovered.filter((tool) => Number.isInteger(tool.rank)).length;
    hub.phased = discovered.filter((tool) => /^P[0-4]$/.test(tool.phase || '')).length;
    assert.deepEqual([hub.discovered, hub.ranked, hub.phased], [50, 50, 50], 'Hub does not expose all 50 roadmap identities/ranks/phases');
  }

  const evidence = {
    schema: 'axm.next-50-full-audit/v1',
    status: 'pass',
    roadmap: { modules: 50, ranks: '1..50', phaseCounts, parentCounts },
    artifacts: { manifests: 50, contracts: 50, entrypoints: 50, selftests: 50 },
    safety: { automaticWrites, automaticApply: automaticApplyClaims, automaticPublish: automaticPublishClaims, libraryPromotion: 'off' },
    cells,
    tests: testSummary,
    hub
  };
  const receiptSha256 = sha256(evidence);
  const sealed = { ...evidence, receiptSha256 };
  const sealedFile = path.join(auditRoot, '50_MODULE_ACCEPTANCE.json');
  if (runTests && hubBase && fs.existsSync(sealedFile)) assert.deepEqual(readJson(sealedFile), sealed, 'Sealed acceptance artifact drifted from the live audit');
  console.log(JSON.stringify(sealed, null, 2));
}

main().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
