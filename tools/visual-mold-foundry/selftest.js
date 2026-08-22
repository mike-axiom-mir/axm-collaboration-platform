'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const UPSTREAM = path.join(ROOT, 'shared', 'visual-mold-foundry');
const read = file => fs.readFileSync(file, 'utf8');
const json = file => JSON.parse(read(file));
const sha256 = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const portable = file => path.relative(UPSTREAM, file).split(path.sep).join('/');

const manifest = json(path.join(__dirname, 'manifest.json'));
const contract = json(path.join(__dirname, 'module.contract.json'));
const entry = read(path.join(__dirname, 'index.html'));
const seal = json(path.join(UPSTREAM, 'RELEASE_SEAL.json'));

assert.equal(manifest.schema, 'axm.tool-manifest/v1');
assert.equal(manifest.id, 'visual-mold-foundry');
assert.equal(manifest.version, '0.9.1');
assert.equal(manifest.status, 'TEST');
assert.equal(contract.id, manifest.id);
assert.deepEqual(contract.permissions, manifest.permissions);
assert(contract.boundaries.refuses.includes('automatic-canon-merge'));
assert(contract.boundaries.refuses.includes('adapter-scaffold-as-engine-parity'));
assert(entry.includes('url=/shared/visual-mold-foundry/app/index.html'));

assert.equal(seal.package, 'AXM_VISUAL_MOLD_FOUNDRY_v0.9.1');
assert.equal(seal.version, '0.9.1');
assert.equal(seal.protected_baseline.molds, 32);
assert.equal(seal.protected_baseline.protected_themes, 6);
assert.equal(seal.protected_baseline.tokens, 148);
assert.equal(seal.protected_baseline.organ_contracts, 58);
assert.equal(seal.protected_baseline.starter_presets, 38);
assert.equal(seal.claims.telemetry, false);
assert.equal(seal.claims.engine_parity_claimed, false);
assert.equal(seal.claims.automatic_canon_merge, false);

const hashManifest = read(path.join(UPSTREAM, 'FILE_MANIFEST_SHA256.txt'));
const listed = new Map();
for (const line of hashManifest.split(/\r?\n/)) {
  if (!line || line.startsWith('#')) continue;
  const match = line.match(/^([a-f0-9]{64})  (.+)$/);
  assert(match, 'malformed upstream hash manifest line: ' + line.slice(0, 100));
  const relative = match[2];
  assert(!listed.has(relative), 'duplicate upstream manifest path: ' + relative);
  assert(!relative.includes('\\') && !relative.split('/').some(part => !part || part === '.' || part === '..'), 'unsafe upstream manifest path: ' + relative);
  listed.set(relative, match[1]);
}
assert.equal(listed.size, 149);
for (const [relative, expected] of listed) {
  const file = path.resolve(UPSTREAM, ...relative.split('/'));
  assert(file.startsWith(UPSTREAM + path.sep), 'manifest path escaped upstream root: ' + relative);
  assert(fs.statSync(file).isFile(), 'manifest file missing: ' + relative);
  assert.equal(sha256(file), expected, 'manifest hash mismatch: ' + relative);
}

function excluded(relative) {
  return relative === 'FILE_MANIFEST_SHA256.txt' ||
    relative.includes('/__pycache__/') || relative.startsWith('__pycache__/') || relative.endsWith('.pyc') ||
    relative.startsWith('exports/') ||
    relative.startsWith('foundry/approved/') ||
    relative.startsWith('foundry/candidate_molds/') ||
    (relative.startsWith('foundry/intake/') && !relative.startsWith('foundry/intake/examples/')) ||
    relative.startsWith('lineage/change_logs/') ||
    relative.startsWith('lineage/rollback_snapshots/');
}
function walk(folder, output) {
  for (const item of fs.readdirSync(folder, { withFileTypes: true })) {
    const file = path.join(folder, item.name);
    if (item.isDirectory()) walk(file, output);
    else if (item.isFile()) output.push(portable(file));
  }
}
const actual = [];
walk(UPSTREAM, actual);
const extras = actual.filter(relative => !excluded(relative) && !listed.has(relative));
assert.deepEqual(extras, [], 'unlisted protected upstream files: ' + extras.join(', '));

const adaptersRoot = path.join(UPSTREAM, 'registry', 'adapters');
const adapters = fs.readdirSync(adaptersRoot).filter(name => name.endsWith('.json'));
assert.deepEqual(adapters.sort(), ['blender.json', 'comfyui.json', 'godot.json', 'materialx.json', 'unity.json', 'unreal.json']);
for (const name of adapters) {
  const adapter = json(path.join(adaptersRoot, name));
  assert.equal(adapter.visual_parity_claim, false, name + ' must not claim visual parity');
}

console.log('Visual Mold Foundry Workshop selftest PASS (149 protected files hash-bound; 32 molds; 6 themes; 148 tokens; 58 organs; 38 presets; six adapters remain non-parity scaffolds)');
