#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Core = require('./core/footprint-core');
const Pressure = require('./core/storage-pressure-core');

let checks = 0;
function check(label, action) {
  action();
  checks += 1;
  process.stdout.write('PASS ' + label + '\n');
}

const publishedManifest = require('./manifest.json');
check('published manifest declares the modern schema', () => assert.equal(publishedManifest.schema, 'axm.tool-manifest/v1'));
check('published manifest classifies the observatory as a product', () => assert.equal(publishedManifest.kind, 'product'));

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

  const pressureWorkshop = path.join(fixtureRoot, 'pressure-workshop');
  const pressureMirror = path.join(fixtureRoot, 'pressure-mirror');
  writeSized(path.join(pressureWorkshop, '.git', 'objects', 'canonical-copy'), 64, 65);
  writeSized(path.join(pressureMirror, 'state', 'sessions', 'session-1.json'), 64, 65);
  writeSized(path.join(pressureWorkshop, 'current-build.json'), 37, 66);
  writeSized(path.join(pressureMirror, 'logs', 'pulse.log'), 37, 66);
  writeSized(path.join(pressureWorkshop, 'projects', 'mike', 'site.html'), 101, 67);
  writeSized(path.join(pressureMirror, 'state', 'canonical.json'), 113, 68);
  writeSized(path.join(pressureMirror, 'tmp', 'captures', 'frame.tmp'), 119, 69);
  writeSized(path.join(pressureMirror, 'state', 'evidence', 'receipt.json'), 131, 70);
  writeSized(path.join(pressureWorkshop, 'src', 'code.js'), 127, 71);
  fs.symlinkSync(path.join(pressureMirror, 'state'), path.join(pressureMirror, 'linked-state'), process.platform === 'win32' ? 'junction' : 'dir');

  const before = treeReceipt(fixtureRoot);
  const first = Core.scanWorkshop(fixtureRoot, { now: '2026-07-27T00:00:00Z' });
  const second = Core.scanWorkshop(fixtureRoot, { now: '2026-07-27T01:00:00Z' });
  const pressureRoots = [
    { id: 'workshop', path: pressureWorkshop },
    { id: 'mirror', path: pressureMirror }
  ];
  const pressureFirst = Pressure.scanRoots(pressureRoots, { now: '2026-07-27T00:00:00Z', allocationUnit: 4096 });
  const pressureSecond = Pressure.scanRoots(pressureRoots, { now: '2026-07-28T00:00:00Z', allocationUnit: 4096, previous: pressureFirst });
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
      'duplicate-disposability-inference', 'deletion-target-selection', 'file-deletion',
      'unreviewed-retention-action', 'packaging', 'canon-change'
    ]) assert(contract.boundaries.refuses.includes(boundary));
  });
  check('browser entry references only local candidate files', () => {
    const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
    for (const name of ['styles.css', 'current-footprint-map.js', 'current-storage-pressure-map.js', 'app.js']) assert(html.includes(name));
    assert.equal(/https?:\/\//.test(html), false);
  });
  check('bundle builder is self-contained and excludes its output', () => {
    const source = fs.readFileSync(path.join(__dirname, 'build-bundle.js'), 'utf8');
    assert(source.includes('absolute === output'));
    assert(source.includes("'axm.module-bundle/v1'"));
  });
  check('whole-root pressure map covers both explicit roots without absolute path leakage', () => {
    assert.equal(pressureFirst.schema, 'axm.storage-pressure-map/v1');
    assert.equal(pressureFirst.summary.roots, 2);
    assert.equal(pressureFirst.summary.files, 9);
    assert.equal(JSON.stringify(pressureFirst).includes(fixtureRoot), false);
  });
  check('every operational retention class is represented and unclassified remains explicit', () => {
    assert.deepEqual(pressureFirst.retentionClasses.map(item => item.id), Pressure.CLASSES);
    assert(pressureFirst.retentionClasses.every(item => item.files > 0));
  });
  check('same-size SHA-256 scan proves exact groups across roots', () => {
    assert.equal(pressureFirst.summary.exactDuplicateGroups, 2);
    assert.equal(pressureFirst.summary.exactDuplicatePhysicalBytes, 101);
    assert.equal(pressureFirst.duplicateCoverage.coverageComplete, true);
    assert(pressureFirst.exactDuplicateGroups.every(group => group.sha256.length === 64));
  });
  check('duplicate review separates lower-risk repetition from protected or mixed paths', () => {
    assert(pressureFirst.exactDuplicateGroups.some(group => group.reviewState === 'LOWER_RISK_REVIEW'));
    assert(pressureFirst.exactDuplicateGroups.some(group => group.reviewState === 'PROTECTED_OR_MIXED_HOLD'));
    assert.equal(pressureFirst.truth.deletionTargetSelected, false);
  });
  check('allocation pressure is visibly estimated from the declared cluster size', () => {
    assert.equal(pressureFirst.source.allocationUnitBytes, 4096);
    assert.equal(pressureFirst.summary.allocatedBytesEstimate, 9 * 4096);
    assert.equal(pressureFirst.truth.allocatedBytesExact, false);
  });
  check('directory fan-out is measured and filesystem symlinks remain skipped', () => {
    assert(pressureFirst.directoryPressure.length > 0);
    assert.equal(pressureFirst.summary.skippedSymlinks, 1);
    assert.equal(pressureFirst.source.symlinksFollowed, false);
  });
  check('separately timed snapshots expose a measured zero-growth window', () => {
    assert.equal(pressureFirst.growth.state, 'BASELINE_ONLY');
    assert.equal(pressureSecond.growth.state, 'MEASURED_WINDOW');
    assert.equal(pressureSecond.growth.logicalBytes, 0);
    assert.equal(pressureSecond.growth.totalFiles, 0);
  });
  check('pressure scan performs no source writes or destructive action', () => {
    assert.deepEqual(after, before);
    const source = fs.readFileSync(path.join(__dirname, 'core', 'storage-pressure-core.js'), 'utf8');
    assert.equal(/\b(?:rmSync|unlinkSync|truncateSync|renameSync|linkSync)\b/.test(source), false);
    assert.equal(pressureFirst.truth.deletionPerformed, false);
    assert.equal(pressureFirst.truth.sourceMutationPerformed, false);
  });
  check('manifest and contract publish the pressure handoff with no permissions', () => {
    const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, 'manifest.json'), 'utf8'));
    const contract = JSON.parse(fs.readFileSync(path.join(__dirname, 'module.contract.json'), 'utf8'));
    assert(manifest.produces.includes('axm.storage-pressure-map/v1'));
    assert(contract.handoffs.emits.includes('axm.storage-pressure-map/v1'));
    assert.deepEqual(manifest.permissions, []);
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
