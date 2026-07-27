#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Core = require('./core/footprint-core');

let checks = 0;
function check(label, action) {
  action();
  checks += 1;
  process.stdout.write('PASS ' + label + '\n');
}

function writeJson(file, value, bom = false) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, (bom ? '\uFEFF' : '') + JSON.stringify(value, null, 2) + '\n');
}

function writeSized(file, size, byte = 65) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, Buffer.alloc(size, byte));
}

function treeReceipt(root) {
  const rows = [];
  function visit(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const absolute = path.join(directory, entry.name);
      const relative = path.relative(root, absolute);
      if (entry.isSymbolicLink()) rows.push('SYMLINK:' + relative);
      else if (entry.isDirectory()) visit(absolute);
      else rows.push(relative + ':' + fs.statSync(absolute).size);
    }
  }
  visit(root);
  return rows;
}

function argValue(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
}

const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'axm-footprint-'));
try {
  writeJson(path.join(fixtureRoot, 'tools', 'alpha', 'manifest.json'), {
    id: 'alpha', name: 'Alpha', version: 'v0.1', status: 'TEST'
  });
  writeSized(path.join(fixtureRoot, 'tools', 'alpha', 'index.html'), 20);
  writeSized(path.join(fixtureRoot, 'tools', 'alpha', 'assets', 'large.BIN'), 100);
  writeSized(path.join(fixtureRoot, 'tools', 'alpha', 'node_modules', 'ignored.js'), 500);
  writeSized(path.join(fixtureRoot, 'tools', 'alpha', 'state', 'ignored.json'), 700);
  writeJson(path.join(fixtureRoot, 'tools', 'beta', 'manifest.json'), {
    id: 'beta', name: 'Beta', version: 'v0.2', status: 'WORKING'
  }, true);
  writeSized(path.join(fixtureRoot, 'tools', 'beta', 'README'), 30);
  writeJson(path.join(fixtureRoot, 'tools', '_template', 'manifest.json'), { id: 'template' });
  fs.symlinkSync(path.join(fixtureRoot, 'tools', 'alpha', 'assets'), path.join(fixtureRoot, 'tools', 'alpha', 'linked-assets'), process.platform === 'win32' ? 'junction' : 'dir');
  fs.symlinkSync(path.join(fixtureRoot, 'tools', 'alpha'), path.join(fixtureRoot, 'tools', 'linked-alpha'), process.platform === 'win32' ? 'junction' : 'dir');

  const before = treeReceipt(fixtureRoot);
  const first = Core.scanWorkshop(fixtureRoot, { now: '2026-07-27T00:00:00Z' });
  const second = Core.scanWorkshop(fixtureRoot, { now: '2026-07-27T01:00:00Z' });
  const after = treeReceipt(fixtureRoot);
  const alpha = first.modules.find(module => module.id === 'alpha');
  const beta = first.modules.find(module => module.id === 'beta');

  check('footprint map declares its exact schema', () => assert.equal(first.schema, 'axm.module-footprint-map/v1'));
  check('underscore templates and top-level symlinks are excluded from modules', () => {
    assert.deepEqual(first.modules.map(module => module.id), ['alpha', 'beta']);
    assert.deepEqual(first.skippedTopLevelSymlinks, ['tools/linked-alpha']);
  });
  check('regular active files are counted per module', () => assert.equal(alpha.files, 3));
  check('active bytes are summed exactly', () => {
    const expected = fs.statSync(path.join(fixtureRoot, 'tools', 'alpha', 'manifest.json')).size + 120;
    assert.equal(alpha.bytes, expected);
  });
  check('largest observed file remains exact path and byte evidence', () => {
    assert.equal(alpha.largestFile.path, 'tools/alpha/assets/large.BIN');
    assert.equal(alpha.largestFile.bytes, 100);
  });
  check('extension grouping is lowercase without changing exact paths', () => {
    assert(alpha.extensions.some(group => group.extension === '.bin' && group.bytes === 100));
    assert.equal(alpha.largestFile.path.endsWith('.BIN'), true);
  });
  check('files without extensions remain explicit', () => {
    assert(beta.extensions.some(group => group.extension === '<none>' && group.files === 1));
  });
  check('UTF-8 BOM manifest identity parses without false invalid state', () => {
    assert.equal(beta.manifestState, 'PRESENT');
    assert.equal(beta.id, 'beta');
  });
  check('named generated and dependency directories are excluded', () => {
    assert.deepEqual(alpha.excludedDirectories, ['tools/alpha/node_modules', 'tools/alpha/state']);
  });
  check('nested filesystem symlinks are skipped and never followed', () => {
    assert.deepEqual(alpha.skippedSymlinks, ['tools/alpha/linked-assets']);
    assert.equal(first.source.symlinksFollowed, false);
  });
  check('scan performs no source writes', () => assert.deepEqual(after, before));
  check('measurement time does not alter footprint fingerprint', () => {
    assert.equal(first.source.footprintFingerprint, second.source.footprintFingerprint);
    assert.notEqual(first.measuredAt, second.measuredAt);
  });
  check('fingerprint is honestly metadata-only', () => assert.equal(first.source.fileContentsHashed, false));
  check('aggregate totals equal module totals', () => {
    assert.equal(first.summary.files, first.modules.reduce((sum, module) => sum + module.files, 0));
    assert.equal(first.summary.bytes, first.modules.reduce((sum, module) => sum + module.bytes, 0));
  });
  check('output leaks no absolute fixture path', () => assert.equal(JSON.stringify(first).includes(fixtureRoot), false));
  check('freshness is live inside TTL and stale after TTL', () => {
    const timed = Object.assign({}, first, { freshnessTtlMs: 1000 });
    assert.equal(Core.freshness(timed, { now: '2026-07-27T00:00:00.500Z' }).status, 'LIVE');
    assert.equal(Core.freshness(timed, { now: '2026-07-27T00:00:02Z' }).status, 'STALE');
  });
  check('unknown timing remains explicitly untimed', () => assert.equal(Core.freshness({}).status, 'UNTIMED'));
  check('truth refuses quality performance readiness deletion packaging and CANON', () => {
    for (const field of [
      'qualityInferred', 'complexityInferred', 'performanceInferred', 'readinessInferred',
      'deletionRecommended', 'packagingPerformed', 'sourceMutationPerformed',
      'installerStagingPerformed', 'installationPerformed', 'permissionChanged',
      'promotionPerformed', 'canonChanged'
    ]) assert.equal(first.truth[field], false);
  });
  check('manifest and contract identity version and permissions align', () => {
    const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, 'manifest.json'), 'utf8'));
    const contract = JSON.parse(fs.readFileSync(path.join(__dirname, 'module.contract.json'), 'utf8'));
    assert.equal(manifest.id, contract.id);
    assert.equal(manifest.version, contract.version);
    assert.deepEqual(manifest.permissions, contract.permissions);
  });
  check('contract preserves adjacent owners and refuses size judgments', () => {
    const contract = JSON.parse(fs.readFileSync(path.join(__dirname, 'module.contract.json'), 'utf8'));
    for (const boundary of [
      'quality-from-size', 'performance-from-size', 'readiness-from-size',
      'duplicate-content-inference', 'deletion-recommendation', 'packaging', 'canon-change'
    ]) assert(contract.boundaries.refuses.includes(boundary));
  });
  check('browser entry references only local candidate files', () => {
    const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
    for (const name of ['styles.css', 'current-footprint-map.js', 'app.js']) assert(html.includes(name));
    assert.equal(/https?:\/\//.test(html), false);
  });
  check('bundle builder is self-contained and excludes its output', () => {
    const source = fs.readFileSync(path.join(__dirname, 'build-bundle.js'), 'utf8');
    assert(source.includes('absolute === output'));
    assert(source.includes("'axm.module-bundle/v1'"));
  });

  const workshopRoot = argValue('--workshop-root');
  if (workshopRoot) {
    const live = Core.scanWorkshop(workshopRoot);
    check('live Workshop footprint finds active modules and files', () => {
      assert(live.summary.modules > 0);
      assert(live.summary.files > live.summary.modules);
      assert(live.summary.bytes > 0);
    });
    check('live Workshop footprint remains observation only', () => {
      assert.equal(live.truth.performanceInferred, false);
      assert.equal(live.truth.sourceMutationPerformed, false);
      assert.equal(live.truth.canonChanged, false);
    });
  }
} finally {
  fs.rmSync(fixtureRoot, { recursive: true, force: true });
}

process.stdout.write('\nModule Footprint Observatory selftest: PASS (' + checks + ' checks)\n');
