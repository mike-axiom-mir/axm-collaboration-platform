#!/usr/bin/env node
'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Core = require('./core/lineage-core');

let checks = 0;
function check(label, action) {
  action();
  checks += 1;
  process.stdout.write('PASS ' + label + '\n');
}

function digest(value) {
  return crypto.createHash('sha256').update(Buffer.from(value)).digest('hex');
}

function json(value) {
  return JSON.stringify(value, null, 2) + '\n';
}

function manifest(id, version, extra = {}) {
  return Object.assign({
    id,
    name: 'Fixture ' + id,
    version,
    status: 'EXPERIMENTAL',
    entry: 'index.html',
    contract: 'module.contract.json',
    uses: ['storage'],
    permissions: [],
    actions: ['inspect'],
    accepts: ['axm.fixture.input/v1'],
    produces: ['axm.fixture.output/v1'],
    readiness: ['storage']
  }, extra);
}

function contract(id, version, extra = {}) {
  return Object.assign({
    schema: 'axm.module-contract/v1',
    id,
    version,
    provides: ['fixture-inspection'],
    consumes: ['axm.fixture.input/v1'],
    permissions: [],
    handoffs: { emits: ['axm.fixture.output/v1'], accepts: ['axm.fixture.input/v1'] },
    boundaries: { writes: [], refuses: ['automatic-apply'] },
    lifecycle: { state_owner: 'none', reload: 'reset', disconnect: 'not-applicable', cleanup: 'not-applicable' }
  }, extra);
}

function bundle(id, version, extraFiles = [], overrides = {}) {
  const manifestValue = manifest(id, version, overrides.manifest || {});
  const contractValue = contract(id, version, overrides.contract || {});
  const files = [
    ['manifest.json', json(manifestValue)],
    ['module.contract.json', json(contractValue)],
    ['index.html', '<!doctype html><title>Fixture</title>\n'],
    ['app.js', "'use strict';\nmodule.exports = 'baseline';\n"],
    ...extraFiles
  ].map(([relativePath, content]) => ({
    path: relativePath,
    encoding: 'utf8',
    content,
    sha256: digest(content)
  }));
  return { schema: Core.BUNDLE_SCHEMA, requiredSeats: 1, files };
}

check('safe relative paths accept normalized module paths', () => {
  assert.equal(Core.safeRelative('core/app.js'), 'core/app.js');
});
check('absolute traversal and backslash paths are refused', () => {
  for (const value of ['../escape', '/absolute', 'C:/drive', 'folder\\file']) {
    assert.throws(() => Core.safeRelative(value), /unsafe bundle path/);
  }
});
check('bundle schema is exact', () => {
  assert.throws(() => Core.decodeBundle({ schema: 'other', files: [{}] }), /bundle schema/);
});
check('bundle file count is bounded', () => {
  assert.throws(() => Core.decodeBundle({ schema: Core.BUNDLE_SCHEMA, files: [] }), /must contain/);
});
check('case-insensitive duplicate bundle paths are refused', () => {
  const input = bundle('alpha', 'v0.1');
  input.files.push({ path: 'APP.js', encoding: 'utf8', content: 'duplicate' });
  assert.throws(() => Core.decodeBundle(input), /duplicate bundle path/);
});
check('declared file digest drift is refused', () => {
  const input = bundle('alpha', 'v0.1');
  input.files[0].sha256 = '0'.repeat(64);
  assert.throws(() => Core.decodeBundle(input), /bundle digest mismatch/);
});
check('unsupported content encoding is refused', () => {
  const input = bundle('alpha', 'v0.1');
  input.files[0].encoding = 'hex';
  assert.throws(() => Core.decodeBundle(input), /unsupported bundle encoding/);
});
check('decoded bundle exposes no file content in its summary', () => {
  const decoded = Core.decodeBundle(bundle('alpha', 'v0.1'), 'alpha');
  const compared = Core.compareBundles(bundle('alpha', 'v0.1'), bundle('alpha', 'v0.1'));
  assert.equal(JSON.stringify(compared).includes("module.exports = 'baseline'"), false);
  assert.equal(decoded.moduleId, 'alpha');
});
check('identical bundles have an exact canonical relation', () => {
  const input = bundle('alpha', 'v0.1');
  const result = Core.compareBundles(input, JSON.parse(JSON.stringify(input)));
  assert.equal(result.relation, 'IDENTICAL_BUNDLE_BYTES_BY_CANONICAL_FILE_DIGEST');
  assert.equal(result.summary.unchangedFiles, 4);
  assert.equal(result.summary.changedFiles, 0);
});
check('file ordering does not change the canonical digest', () => {
  const left = bundle('alpha', 'v0.1');
  const right = JSON.parse(JSON.stringify(left));
  right.files.reverse();
  assert.equal(Core.compareBundles(left, right).relation, 'IDENTICAL_BUNDLE_BYTES_BY_CANONICAL_FILE_DIGEST');
});
check('added and removed paths preserve comparison direction', () => {
  const left = bundle('alpha', 'v0.1', [['retired.txt', 'retired']]);
  const right = bundle('alpha', 'v0.1', [['new.txt', 'new']]);
  const result = Core.compareBundles(left, right);
  assert.deepEqual(result.fileDelta.added.map(item => item.path), ['new.txt']);
  assert.deepEqual(result.fileDelta.removed.map(item => item.path), ['retired.txt']);
});
check('changed bytes at one path expose both digests', () => {
  const left = bundle('alpha', 'v0.1');
  const right = bundle('alpha', 'v0.1');
  right.files.find(item => item.path === 'app.js').content = "'use strict';\nmodule.exports = 'candidate';\n";
  delete right.files.find(item => item.path === 'app.js').sha256;
  const result = Core.compareBundles(left, right);
  assert.equal(result.summary.changedFiles, 1);
  assert.notEqual(result.fileDelta.changed[0].baselineSha256, result.fileDelta.changed[0].candidateSha256);
});
check('different module ids remain a visible identity hold', () => {
  assert.equal(Core.compareBundles(bundle('alpha', 'v0.1'), bundle('beta', 'v0.1')).relation, 'DIFFERENT_MODULE_IDS');
});
check('missing manifest becomes unknown identity rather than guessed identity', () => {
  const right = bundle('alpha', 'v0.1');
  right.files = right.files.filter(item => item.path !== 'manifest.json');
  const result = Core.compareBundles(bundle('alpha', 'v0.1'), right);
  assert.equal(result.relation, 'MODULE_ID_UNKNOWN');
  assert(result.direction.candidate.structuralIssues.includes('manifest.json is missing'));
});
check('malformed contract remains a structural issue', () => {
  const right = bundle('alpha', 'v0.1');
  const file = right.files.find(item => item.path === 'module.contract.json');
  file.content = '{broken';
  delete file.sha256;
  const result = Core.compareBundles(bundle('alpha', 'v0.1'), right);
  assert(result.direction.candidate.structuralIssues.some(issue => issue.includes('invalid JSON')));
});
check('manifest version status and arrays are compared exactly', () => {
  const result = Core.compareBundles(
    bundle('alpha', 'v0.1'),
    bundle('alpha', 'v0.2', [], { manifest: { actions: ['inspect', 'export'] } })
  );
  const version = result.declaredDelta.manifestFields.find(item => item.field === 'version');
  const actions = result.declaredDelta.manifestFields.find(item => item.field === 'actions');
  assert.equal(version.state, 'CHANGED');
  assert.deepEqual(actions.arrayDelta.added, ['export']);
});
check('array reordering is visible without calling it semantic change', () => {
  const left = bundle('alpha', 'v0.1', [], { manifest: { actions: ['inspect', 'export'] } });
  const right = bundle('alpha', 'v0.1', [], { manifest: { actions: ['export', 'inspect'] } });
  const actions = Core.compareBundles(left, right).declaredDelta.manifestFields.find(item => item.field === 'actions');
  assert.equal(actions.arrayDelta.orderChanged, true);
  assert.deepEqual(actions.arrayDelta.added, []);
  assert.deepEqual(actions.arrayDelta.removed, []);
});
check('contract handoffs boundaries and lifecycle are compared', () => {
  const right = bundle('alpha', 'v0.1', [], {
    contract: {
      handoffs: { emits: ['axm.fixture.output/v2'], accepts: [] },
      boundaries: { writes: ['explicit-output'], refuses: ['automatic-apply'] },
      lifecycle: { state_owner: 'filesystem', reload: 'reset', disconnect: 'not-applicable', cleanup: 'explicit' }
    }
  });
  const result = Core.compareBundles(bundle('alpha', 'v0.1'), right);
  assert.equal(result.declaredDelta.contractFields.find(item => item.field === 'handoffs').state, 'CHANGED');
  assert.equal(result.declaredDelta.contractFields.find(item => item.field === 'boundaries').state, 'CHANGED');
  assert.equal(result.declaredDelta.contractFields.find(item => item.field === 'lifecycle').state, 'CHANGED');
});
check('comparison fingerprint ignores measurement time', () => {
  const left = bundle('alpha', 'v0.1');
  const right = bundle('alpha', 'v0.2');
  const first = Core.compareBundles(left, right, { now: '2026-07-26T00:00:00Z' });
  const second = Core.compareBundles(left, right, { now: '2026-07-26T01:00:00Z' });
  assert.equal(first.fingerprint, second.fingerprint);
  assert.notEqual(first.measuredAt, second.measuredAt);
});
check('freshness is LIVE inside TTL and STALE after it', () => {
  const result = Core.compareBundles(bundle('alpha', 'v0.1'), bundle('alpha', 'v0.1'), {
    now: '2026-07-26T00:00:00Z',
    ttlMs: 1000
  });
  assert.equal(Core.freshness(result, { now: '2026-07-26T00:00:00.500Z' }).status, 'LIVE');
  assert.equal(Core.freshness(result, { now: '2026-07-26T00:00:02Z' }).status, 'STALE');
});
check('negative or nonnumeric TTL is refused', () => {
  assert.throws(() => Core.compareBundles(bundle('alpha', 'v0.1'), bundle('alpha', 'v0.1'), { ttlMs: -1 }), /ttlMs/);
});
check('truth block refuses every applying authority', () => {
  const truth = Core.compareBundles(bundle('alpha', 'v0.1'), bundle('alpha', 'v0.2')).truth;
  for (const field of [
    'bundleFilesExecuted',
    'archiveExtractionPerformed',
    'semanticEquivalenceInferred',
    'winnerSelected',
    'automaticMergePerformed',
    'sourceMutationPerformed',
    'installerStagingPerformed',
    'installationPerformed',
    'permissionChanged',
    'rollbackChanged',
    'promotionPerformed',
    'canonChanged'
  ]) assert.equal(truth[field], false);
});
check('the bundled demonstration proves additions removals changes and sameness', () => {
  const left = JSON.parse(fs.readFileSync(path.join(__dirname, 'examples', 'baseline.module-bundle.json'), 'utf8'));
  const right = JSON.parse(fs.readFileSync(path.join(__dirname, 'examples', 'candidate.module-bundle.json'), 'utf8'));
  const result = Core.compareBundles(left, right);
  assert.equal(result.summary.addedFiles, 1);
  assert.equal(result.summary.removedFiles, 1);
  assert.equal(result.summary.changedFiles, 3);
  assert.equal(result.summary.unchangedFiles, 1);
});
check('CLI input symlinks can be distinguished by the host probe', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'axm-lineage-'));
  try {
    const source = path.join(root, 'source.json');
    const link = path.join(root, 'link.json');
    fs.writeFileSync(source, json(bundle('alpha', 'v0.1')));
    fs.symlinkSync(source, link);
    assert.equal(fs.lstatSync(link).isSymbolicLink(), true);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
check('manifest and contract identity versions and permissions align', () => {
  const manifestValue = JSON.parse(fs.readFileSync(path.join(__dirname, 'manifest.json'), 'utf8'));
  const contractValue = JSON.parse(fs.readFileSync(path.join(__dirname, 'module.contract.json'), 'utf8'));
  assert.equal(manifestValue.id, contractValue.id);
  assert.equal(manifestValue.version, contractValue.version);
  assert.deepEqual(manifestValue.permissions, contractValue.permissions);
  assert(manifestValue.uses.includes('storage'));
});
check('contract refuses merge staging install permission rollback promotion and CANON', () => {
  const contractValue = JSON.parse(fs.readFileSync(path.join(__dirname, 'module.contract.json'), 'utf8'));
  for (const boundary of [
    'automatic-merge',
    'installer-staging',
    'module-installation',
    'permission-change',
    'rollback-change',
    'promotion',
    'canon-change'
  ]) assert(contractValue.boundaries.refuses.includes(boundary));
});

process.stdout.write('\nModule Lineage Comparator selftest: PASS (' + checks + ' checks)\n');
