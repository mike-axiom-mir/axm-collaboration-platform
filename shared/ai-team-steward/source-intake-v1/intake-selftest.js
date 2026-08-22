#!/usr/bin/env node
'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const HARNESS = path.join(ROOT, 'proof-harness-v7');
const PROVENANCE = path.join(ROOT, 'provenance');
const sumsText = fs.readFileSync(path.join(PROVENANCE, 'source-SHA256SUMS.txt'), 'utf8');
const sourceSums = new Map();

for (const line of sumsText.split(/\r?\n/)) {
  const match = line.match(/^([0-9a-f]{64})\s+\*?(.+)$/i);
  if (match) sourceSums.set(match[2], match[1].toLowerCase());
}

function walk(folder) {
  return fs.readdirSync(folder, { withFileTypes: true }).flatMap(entry => {
    const target = path.join(folder, entry.name);
    return entry.isDirectory() ? walk(target) : [target];
  });
}

function digest(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

const provenanceMap = {
  'source-seeds.txt': 'RUN_01_AND_SOURCE/AXM_AI_TEAM_COLLABORATION_COMPLETE_100_SEEDS.txt',
  'run-101.local-intake.jsonl': 'RUNS_92_101/RUN_101/AXM_AI_TEAM_COLLABORATION_STEWARD_RUN_101_LOCAL_INTAKE.jsonl',
  'run-101.manifest.json': 'RUNS_92_101/RUN_101/AXM_AI_TEAM_COLLABORATION_STEWARD_RUN_101_MANIFEST.json',
  'seed-coverage-matrix.jsonl': 'FINAL_HANDOFF/AXM_AI_TEAM_COLLABORATION_100_SEED_COVERAGE_MATRIX.jsonl',
  'runs-01-101-coverage.json': 'FINAL_HANDOFF/AXM_AI_TEAM_COLLABORATION_RUNS_01_101_COVERAGE.json',
  'final-action-report.txt': 'FINAL_HANDOFF/AXM_AI_TEAM_COLLABORATION_FINAL_ACTION_REPORT.txt',
  'source-archive-audit.json': 'FINAL_HANDOFF/AXM_AI_TEAM_COLLABORATION_FINAL_ARCHIVE_AUDIT.json',
  'source-master-index.json': 'FINAL_HANDOFF/AXM_AI_TEAM_COLLABORATION_FINAL_MASTER_INDEX.json',
  'source-SHA256SUMS.txt': 'FINAL_HANDOFF/SHA256SUMS.txt'
};

const harnessFiles = walk(HARNESS);
const provenanceFiles = walk(PROVENANCE);
assert.equal(harnessFiles.length, 386);
assert.equal(provenanceFiles.length, 9);
assert.equal(sourceSums.size, 2579);

const retained = [];
for (const file of harnessFiles) {
  const rel = path.relative(HARNESS, file).split(path.sep).join('/');
  const sourcePath = `RUNS_92_101/PROOF_HARNESS_V7/${rel}`;
  assert.ok(sourceSums.has(sourcePath), `missing source checksum: ${sourcePath}`);
  const hash = digest(file);
  assert.equal(hash, sourceSums.get(sourcePath), `checksum mismatch: ${rel}`);
  retained.push({ file, hash, bytes: fs.statSync(file).size });
}
for (const file of provenanceFiles) {
  const name = path.basename(file);
  const sourcePath = provenanceMap[name];
  assert.ok(sourcePath, `unexpected provenance file: ${name}`);
  const hash = digest(file);
  if (name !== 'source-SHA256SUMS.txt') {
    assert.ok(sourceSums.has(sourcePath), `missing source checksum: ${sourcePath}`);
    assert.equal(hash, sourceSums.get(sourcePath), `checksum mismatch: ${name}`);
  }
  retained.push({ file, hash, bytes: fs.statSync(file).size });
}

assert.equal(retained.length, 395);
assert.equal(retained.reduce((sum, row) => sum + row.bytes, 0), 9533583);
assert.equal(new Set(retained.map(row => row.hash)).size, 385);
assert.equal(retained.filter(row => /\.(?:zip|pyc)$/i.test(row.file)).length, 0);

const registry = JSON.parse(fs.readFileSync(path.join(HARNESS, 'registry', 'seed_registry_v7.json'), 'utf8'));
assert.equal(registry.registry_version, '7.0.0');
assert.equal(registry.seed_count, 100);
assert.equal(registry.entries.length, 100);
assert.equal(new Set(registry.entries.map(row => row.seed_number)).size, 100);
assert.equal(new Set(registry.entries.map(row => row.module_id)).size, 100);
assert.equal(new Set(registry.entries.map(row => row.family)).size, 10);
assert.deepEqual(
  Object.fromEntries([...registry.entries.reduce((map, row) => map.set(row.risk_tier, (map.get(row.risk_tier) || 0) + 1), new Map()).entries()].sort()),
  { CRITICAL: 6, HIGH: 38, LOW: 15, MEDIUM: 41 }
);
assert.equal(registry.canon, false);
assert.equal(registry.axm_runtime_integrated, false);
assert.ok(registry.entries.every(row => row.canon_status === 'WORKING_CANDIDATE_NOT_CANON'));
assert.ok(registry.entries.every(row => row.runtime_status === 'DETERMINISTIC_HARNESS_TARGET_NOT_AXM_RUNTIME'));

const run101 = fs.readFileSync(path.join(PROVENANCE, 'run-101.local-intake.jsonl'), 'utf8').trim().split(/\r?\n/).map(JSON.parse);
assert.equal(run101.length, 100);
assert.ok(run101.every(row => row.steward_run === 101));
assert.deepEqual(new Set(run101.map(row => row.module_id)), new Set(registry.entries.map(row => row.module_id)));

console.log('AI Team Collaboration curated intake: PASS (100 seed contracts, 395 retained source files, 154 source tests recorded)');
