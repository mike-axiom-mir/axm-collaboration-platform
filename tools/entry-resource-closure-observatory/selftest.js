#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Core = require('./core/entry-resource-closure-core');

const REMOTE_URL = ['https', '://example.invalid/pic.png'].join('');

let checks = 0;
function check(label, action) {
  action();
  checks += 1;
  process.stdout.write('PASS ' + label + '\n');
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n');
}

function write(file, value = '') {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, value);
}

function addModule(root, id, fields = {}) {
  const directory = path.join(root, 'tools', id);
  const manifest = Object.assign({
    id, name: id, version: 'v0.1', status: 'EXPERIMENTAL', entry: 'index.html'
  }, fields);
  writeJson(path.join(directory, 'manifest.json'), manifest);
  return directory;
}

function treeReceipt(root) {
  const rows = [];
  function visit(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const absolute = path.join(directory, entry.name);
      const relative = path.relative(root, absolute);
      if (entry.isSymbolicLink()) rows.push('SYMLINK:' + relative + '->' + fs.readlinkSync(absolute));
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

const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'axm-entry-resource-'));
try {
  fs.mkdirSync(path.join(fixtureRoot, 'tools'), { recursive: true });
  write(path.join(fixtureRoot, 'shared', 'common.js'), 'window.common = true;\n');

  const alpha = addModule(fixtureRoot, 'alpha');
  write(path.join(alpha, 'styles.css'), 'body { color: white; }\n');
  write(path.join(alpha, 'scripts', 'app.js'), 'window.app = true;\n');
  write(path.join(alpha, 'images', 'pic.png'), 'PNG');
  write(path.join(alpha, 'poster.png'), 'POSTER');
  write(path.join(alpha, 'movie.mp4'), 'MOVIE');
  write(path.join(alpha, 'doc.bin'), 'DOC');
  fs.symlinkSync(path.join(alpha, 'scripts', 'app.js'), path.join(alpha, 'linked.js'));
  write(path.join(alpha, 'index.html'), [
    '<!doctype html>',
    '<link rel="stylesheet" href="styles.css?theme=dark">',
    '<script src="scripts/app.js#v1"></script>',
    '<script src="/shared/common.js"></script>',
    '<img src="images/pic.png">',
    '<video poster="poster.png"><source src="movie.mp4"></video>',
    '<object data="doc.bin"></object>',
    '<script src="linked.js"></script>',
    '<script src="missing.js"></script>',
    '<script src="../../../outside.js"></script>',
    '<img src="' + REMOTE_URL + '">',
    '<img src="data:image/png;base64,AAAA">',
    '<img src="#sprite">',
    '<script src="${asset}"></script>',
    '<img src="encoded%20asset.png">',
    '<object data="mailto:test@example.invalid"></object>',
    '<link href="?mode=preview">',
    '<link href="">',
    '<img srcset="one.png 1x, two.png 2x">',
    '<script src=unquoted.js></script>'
  ].join('\n'));

  addModule(fixtureRoot, 'beta', { entry: 'missing.html' });
  const gamma = addModule(fixtureRoot, 'gamma', { entry: 'linked.html' });
  write(path.join(gamma, 'real.html'), '<!doctype html>');
  fs.symlinkSync(path.join(gamma, 'real.html'), path.join(gamma, 'linked.html'));
  const delta = addModule(fixtureRoot, 'delta');
  write(path.join(delta, 'index.html'), '<!doctype html><title>No static resources</title>');
  addModule(fixtureRoot, 'epsilon', { entry: '../outside.html' });
  const template = addModule(fixtureRoot, '_template');
  write(path.join(template, 'index.html'), '<script src="ignored.js"></script>');
  fs.symlinkSync(alpha, path.join(fixtureRoot, 'tools', 'linked-alpha'));

  const before = treeReceipt(fixtureRoot);
  const first = Core.scanWorkshop(fixtureRoot, { now: '2026-07-27T00:00:00Z' });
  const second = Core.scanWorkshop(fixtureRoot, { now: '2026-07-27T01:00:00Z' });
  const after = treeReceipt(fixtureRoot);
  const module = id => first.modules.find(item => item.id === id);
  const alphaReferences = module('alpha').references;
  const reference = raw => alphaReferences.find(item => item.raw === raw);

  check('resource closure map declares its exact schema and version', () => {
    assert.equal(first.schema, 'axm.entry-resource-closure-map/v1');
    assert.equal(first.version, 'v0.1');
  });
  check('underscore template and top-level module symlink are excluded', () => {
    assert.deepEqual(first.modules.map(item => item.id), ['alpha', 'beta', 'delta', 'epsilon', 'gamma']);
    assert.deepEqual(first.source.skippedSymlinks, ['tools/linked-alpha']);
  });
  check('declared regular HTML entry is hashed and statically parsed', () => {
    assert.equal(module('alpha').entry.state, 'PRESENT_HTML');
    assert.equal(module('alpha').entry.markupParsed, true);
    assert.match(module('alpha').entry.sha256, /^[a-f0-9]{64}$/);
  });
  check('query and fragment suffixes do not prevent local presence closure', () => {
    assert.equal(reference('styles.css?theme=dark').state, 'STATIC_LOCAL_PRESENT');
    assert.equal(reference('styles.css?theme=dark').resolvedPath, 'tools/alpha/styles.css');
    assert.equal(reference('scripts/app.js#v1').state, 'STATIC_LOCAL_PRESENT');
  });
  check('Workshop-root-relative local target is presence-checked', () => {
    assert.equal(reference('/shared/common.js').state, 'STATIC_LOCAL_PRESENT');
    assert.equal(reference('/shared/common.js').resolvedPath, 'shared/common.js');
  });
  check('script style image video source and object references stay distinct', () => {
    assert.equal(reference('images/pic.png').tag, 'img');
    assert.equal(reference('poster.png').attribute, 'poster');
    assert.equal(reference('movie.mp4').tag, 'source');
    assert.equal(reference('doc.bin').attribute, 'data');
    for (const raw of ['images/pic.png', 'poster.png', 'movie.mp4', 'doc.bin']) {
      assert.equal(reference(raw).state, 'STATIC_LOCAL_PRESENT');
    }
  });
  check('missing local static target remains explicit', () => {
    assert.equal(reference('missing.js').state, 'STATIC_LOCAL_MISSING');
    assert.equal(reference('missing.js').resolvedPath, 'tools/alpha/missing.js');
  });
  check('unsafe traversal outside Workshop is refused', () => {
    assert.equal(reference('../../../outside.js').state, 'UNSAFE_LOCAL_PATH');
    assert.equal(reference('../../../outside.js').resolvedPath, null);
  });
  check('referenced symlink is refused rather than followed', () => {
    assert.equal(reference('linked.js').state, 'SYMLINK_REFUSED');
    assert.equal(first.source.symlinksFollowed, false);
  });
  check('remote inline fragment dynamic encoded and non-file schemes remain unresolved', () => {
    assert.equal(reference(REMOTE_URL).state, 'REMOTE_REFERENCE_NOT_FETCHED');
    assert.equal(reference('data:image/png;base64,AAAA').state, 'INLINE_OR_RUNTIME_SCHEME');
    assert.equal(reference('#sprite').state, 'FRAGMENT_REFERENCE');
    assert.equal(reference('${asset}').state, 'DYNAMIC_REFERENCE_NOT_RESOLVED');
    assert.equal(reference('encoded%20asset.png').state, 'ENCODED_REFERENCE_NOT_RESOLVED');
    assert.equal(reference('mailto:test@example.invalid').state, 'NON_FILE_SCHEME');
  });
  check('document-self and empty references remain explicit', () => {
    assert.equal(reference('?mode=preview').state, 'DOCUMENT_SELF_REFERENCE');
    assert.equal(reference('').state, 'EMPTY_REFERENCE');
  });
  check('srcset and unquoted attributes stay outside the parser boundary', () => {
    assert.equal(alphaReferences.some(item => item.raw.includes('one.png')), false);
    assert.equal(alphaReferences.some(item => item.raw === 'unquoted.js'), false);
  });
  check('missing unsafe and symlinked declared entries remain separate', () => {
    assert.equal(module('beta').entry.state, 'MISSING');
    assert.equal(module('epsilon').entry.state, 'UNSAFE_PATH');
    assert.equal(module('gamma').entry.state, 'SYMLINK_REFUSED');
  });
  check('HTML entry without static references remains an honest empty closure', () => {
    assert.equal(module('delta').entry.state, 'PRESENT_HTML');
    assert.equal(module('delta').references.length, 0);
    assert.equal(module('delta').summary.hasLocalIssues, false);
  });
  check('summary separates local issues from unresolved external or runtime references', () => {
    assert.equal(module('alpha').summary.localMissing, 1);
    assert.equal(module('alpha').summary.localSafetyHolds, 2);
    assert(module('alpha').summary.unresolvedExternalOrRuntime >= 7);
    assert.equal(first.summary.modulesWithLocalIssues, 1);
  });
  check('scan performs no source writes or resource execution', () => assert.deepEqual(after, before));
  check('measurement time does not alter source fingerprint', () => {
    assert.equal(first.source.fingerprint, second.source.fingerprint);
    assert.notEqual(first.measuredAt, second.measuredAt);
  });
  check('output leaks no absolute fixture root', () => assert.equal(JSON.stringify(first).includes(fixtureRoot), false));
  check('freshness is live inside TTL and stale after TTL', () => {
    const timed = Object.assign({}, first, { freshnessTtlMs: 1000 });
    assert.equal(Core.freshness(timed, { now: '2026-07-27T00:00:00.500Z' }).status, 'LIVE');
    assert.equal(Core.freshness(timed, { now: '2026-07-27T00:00:02Z' }).status, 'STALE');
  });
  check('unknown timing remains explicitly untimed', () => assert.equal(Core.freshness({}).status, 'UNTIMED'));
  check('truth refuses loading rendering execution decoding network readiness and CANON', () => {
    for (const field of [
      'localResourceBodiesRead', 'networkFetched', 'browserLoaded', 'markupRendered',
      'scriptsExecuted', 'stylesApplied', 'mediaDecoded', 'cssImportsTraversed',
      'srcsetParsed', 'dynamicReferencesResolved', 'runtimeRouteFallbackExcluded',
      'visualQualityProven', 'readinessProven', 'sourceMutationPerformed',
      'installerStagingPerformed', 'installationPerformed', 'promotionPerformed', 'canonChanged'
    ]) assert.equal(first.truth[field], false);
  });
  check('manifest and contract identity version and permissions align', () => {
    const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, 'manifest.json'), 'utf8'));
    const contract = JSON.parse(fs.readFileSync(path.join(__dirname, 'module.contract.json'), 'utf8'));
    assert.equal(manifest.id, contract.id);
    assert.equal(manifest.version, contract.version);
    assert.deepEqual(manifest.permissions, contract.permissions);
    assert(contract.handoffs.emits.includes('axm.entry-resource-closure-map/v1'));
  });
  check('contract preserves browser network syntax runtime and readiness owners', () => {
    const contract = JSON.parse(fs.readFileSync(path.join(__dirname, 'module.contract.json'), 'utf8'));
    for (const boundary of [
      'binary-resource-body-reading', 'network-fetch', 'browser-loading', 'markup-rendering',
      'script-execution', 'style-application', 'media-decoding', 'css-import-traversal',
      'srcset-parsing', 'dynamic-reference-resolution', 'runtime-route-fallback-exclusion',
      'visual-quality-proof', 'readiness-proof', 'canon-change'
    ]) assert(contract.boundaries.refuses.includes(boundary));
  });
  check('browser entry references only local candidate files', () => {
    const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
    for (const name of ['styles.css', 'current-entry-resource-closure-map.js', 'app.js']) assert(html.includes(name));
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
    check('live Workshop closure scan finds HTML entries and static references', () => {
      assert(live.summary.modules > 0);
      assert(live.summary.entriesPresentHtml > 0);
      assert(live.summary.totalReferences > 0);
      assert(live.summary.localPresent > 0);
    });
    check('live Workshop scan remains static and non-authoritative', () => {
      assert.equal(live.truth.localResourceBodiesRead, false);
      assert.equal(live.truth.networkFetched, false);
      assert.equal(live.truth.browserLoaded, false);
      assert.equal(live.truth.scriptsExecuted, false);
      assert.equal(live.truth.canonChanged, false);
    });
  }
} finally {
  fs.rmSync(fixtureRoot, { recursive: true, force: true });
}

process.stdout.write('\nEntry Resource Closure Observatory selftest: PASS (' + checks + ' checks)\n');
