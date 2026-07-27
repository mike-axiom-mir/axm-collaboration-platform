#!/usr/bin/env node
'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Core = require('./core/browser-global-surface-core');

let checks = 0;
function check(name, body) {
  body();
  checks += 1;
  process.stdout.write('PASS ' + name + '\n');
}
const digest = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'axm-browser-global-'));
try {
  const files = {
    'tools/alpha/index.html': '<script src="app.js"></script>',
    'tools/alpha/app.js': [
      "const shared = 'AXM_SHARED';",
      'window.AXM_SHARED = { owner: "alpha" };',
      'window[shared] = 2;',
      'window[dynamicName] = 3;',
      'const seen = globalThis.AXM_SHARED;',
      "Object.defineProperty(window, 'AXM_ALPHA', { value: 1 });",
      'delete window.AXM_OLD;'
    ].join('\n'),
    'tools/beta/app.js': [
      'globalThis.AXM_SHARED = { owner: "beta" };',
      "window['AXM_BETA'] = 1;",
      'const again = window.AXM_SHARED;'
    ].join('\n'),
    'shared/runtime.js': 'window.AXM_SHARED = { owner: "shared" };'
  };
  for (const [relative, body] of Object.entries(files)) {
    const target = path.join(temporary, relative);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, body);
  }
  const node = relative => ({
    path: relative,
    kind: relative.endsWith('.html') ? 'HTML' : 'JAVASCRIPT',
    state: 'PRESENT',
    bytes: Buffer.byteLength(files[relative]),
    sha256: digest(Buffer.from(files[relative])),
    bodyRead: true,
    depth: 0
  });
  const graph = {
    schema: Core.GRAPH_SCHEMA,
    freshnessTtlMs: 300000,
    source: { label: 'fixture', fingerprint: 'fixture-graph' },
    summary: { modules: 2 },
    modules: [
      { id: 'alpha', folder: 'alpha', nodes: [node('tools/alpha/index.html'), node('tools/alpha/app.js'), node('shared/runtime.js')] },
      { id: 'beta', folder: 'beta', nodes: [node('tools/beta/app.js'), node('shared/runtime.js')] }
    ]
  };
  const map = Core.analyzeWorkshop(temporary, graph, { now: '2026-07-27T00:00:00.000Z' });

  check('map declares exact schema and graph fingerprint', () => {
    assert.equal(map.schema, Core.SCHEMA);
    assert.equal(map.source.graphFingerprint, 'fixture-graph');
  });
  check('every unique graph source is hash verified', () => {
    assert.equal(map.summary.uniqueTextSources, 4);
    assert.equal(map.summary.verifiedSources, 4);
  });
  check('dot assignment is a definition', () => assert(map.observations.some(item => item.operation === 'DEFINE' && item.symbol === 'AXM_SHARED')));
  check('literal bracket assignment resolves', () => assert(map.observations.some(item => item.operation === 'DEFINE' && item.symbol === 'AXM_BETA' && item.resolution === 'LITERAL')));
  check('same-file constant bracket assignment resolves', () => assert(map.observations.some(item => item.symbol === 'AXM_SHARED' && item.resolution === 'CONST_RESOLVED')));
  check('dynamic bracket definition remains unresolved', () => assert(map.observations.some(item => item.operation === 'DEFINE' && item.symbol === null && item.resolution === 'DYNAMIC_NOT_RESOLVED')));
  check('defineProperty remains distinct', () => assert(map.observations.some(item => item.operation === 'DEFINE_PROPERTY' && item.symbol === 'AXM_ALPHA')));
  check('dot references remain visible', () => assert(map.observations.some(item => item.operation === 'REFERENCE' && item.symbol === 'AXM_SHARED')));
  check('delete remains distinct', () => assert(map.observations.some(item => item.operation === 'DELETE' && item.symbol === 'AXM_OLD')));
  check('shared source is analyzed once', () => {
    const receipt = map.sourceReceipts.find(item => item.path === 'shared/runtime.js');
    assert(receipt);
    assert.equal(map.sourceReceipts.filter(item => item.path === 'shared/runtime.js').length, 1);
  });
  check('same exact definition across owners creates a review group', () => {
    const group = map.definitionGroups.find(item => item.symbol === 'AXM_SHARED');
    assert(group);
    assert(group.ownershipScopes.length >= 3);
  });
  check('group state does not claim harm', () => assert(map.definitionGroups.every(item => !item.state.includes('HARM'))));
  check('analysis writes no fixture source', () => assert.equal(fs.readFileSync(path.join(temporary, 'tools/alpha/app.js'), 'utf8'), files['tools/alpha/app.js']));
  check('measurement time does not alter fingerprint', () => {
    const second = Core.analyzeWorkshop(temporary, graph, { now: '2030-01-01T00:00:00.000Z' });
    assert.equal(second.source.fingerprint, map.source.fingerprint);
  });
  check('map leaks no absolute fixture root', () => assert(!JSON.stringify(map).includes(temporary)));
  check('hash drift blocks parsing and stays explicit', () => {
    fs.appendFileSync(path.join(temporary, 'tools/beta/app.js'), '\n// drift');
    const drift = Core.analyzeWorkshop(temporary, graph);
    assert(drift.readIssues.some(item => item.code === 'SOURCE_HASH_DRIFT'));
    assert(!drift.observations.some(item => item.path === 'tools/beta/app.js'));
    fs.writeFileSync(path.join(temporary, 'tools/beta/app.js'), files['tools/beta/app.js']);
  });
  const group = map.definitionGroups.find(item => item.symbol === 'AXM_SHARED');
  const request = Core.createReviewRequest(map, group.id, { now: '2026-07-27T00:00:00.000Z' });
  check('request selects one exact group', () => assert.equal(request.selectedGroup.id, group.id));
  check('request contains four unanswered questions', () => {
    assert.equal(request.questions.length, 4);
    assert(request.questions.every(item => item.state === 'REQUEST_NOT_RUN'));
  });
  check('request fingerprint ignores generation time', () => {
    const second = Core.createReviewRequest(map, group.id, { now: '2030-01-01T00:00:00.000Z' });
    assert.equal(second.fingerprint, request.fingerprint);
  });
  check('request refuses an unknown group', () => assert.throws(() => Core.createReviewRequest(map, 'missing')));
  check('truth refuses runtime mutation execution grant and CANON', () => {
    assert.equal(map.truth.browserGlobalsMutated, false);
    assert.equal(map.truth.scriptsExecuted, false);
    assert.equal(map.truth.permissionGranted, false);
    assert.equal(map.truth.canonChanged, false);
  });
  check('manifest contract identity version and permissions align', () => {
    const manifest = require('./manifest.json');
    const contract = require('./module.contract.json');
    assert.equal(manifest.id, contract.id);
    assert.equal(manifest.version, contract.version);
    assert.deepEqual(manifest.permissions, contract.permissions);
    assert.deepEqual(manifest.produces, contract.handoffs.emits);
  });
  check('browser surface references only local candidate files', () => {
    const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
    for (const expected of ['styles.css', 'current-browser-global-surface.js', 'current-browser-global-review-request.js', 'app.js']) assert(html.includes(expected));
    assert(!html.includes('http' + '://') && !html.includes('https' + '://'));
  });
  check('bundle builder is self-contained and excludes output', () => {
    const builder = fs.readFileSync(path.join(__dirname, 'build-bundle.js'), 'utf8');
    assert(builder.includes('axm.module-bundle/v1'));
    assert(builder.includes('absolute !== output'));
  });

  const args = process.argv.slice(2);
  const rootIndex = args.indexOf('--workshop-root');
  const graphIndex = args.indexOf('--graph');
  if (rootIndex >= 0 && graphIndex >= 0) {
    const liveGraph = JSON.parse(fs.readFileSync(path.resolve(args[graphIndex + 1]), 'utf8'));
    const live = Core.analyzeWorkshop(path.resolve(args[rootIndex + 1]), liveGraph);
    check('live graph-bound analysis verifies sources', () => assert.equal(live.summary.verifiedSources, live.summary.uniqueTextSources));
    check('live analysis remains static and non-authoritative', () => {
      assert.equal(live.truth.browserLoaded, false);
      assert.equal(live.truth.installationPerformed, false);
      assert.equal(live.truth.promotionPerformed, false);
    });
  }

  process.stdout.write('\nBrowser Global Surface Observatory selftest: PASS (' + checks + ' checks)\n');
} finally {
  fs.rmSync(temporary, { recursive: true, force: true });
}
