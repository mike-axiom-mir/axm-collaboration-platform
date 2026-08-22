#!/usr/bin/env node
'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Core = require('./core/storage-namespace-core');

let checks = 0;
function check(label, action) {
  action();
  checks += 1;
  process.stdout.write('PASS ' + label + '\n');
}

const publishedManifest = require('./manifest.json');
check('published manifest declares the modern schema', () => assert.equal(publishedManifest.schema, 'axm.tool-manifest/v1'));
check('published manifest classifies the observatory as a product', () => assert.equal(publishedManifest.kind, 'product'));

function write(file, body) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, body);
}

function digest(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function node(root, relative, kind = 'JAVASCRIPT') {
  const file = path.join(root, relative);
  return {
    path: relative,
    kind,
    state: 'PRESENT',
    bytes: fs.statSync(file).size,
    sha256: digest(file),
    bodyRead: true,
    depth: 1
  };
}

function graph(root) {
  const shared = node(root, 'shared/storage-helper.js');
  return {
    schema: Core.GRAPH_SCHEMA,
    version: 'v0.2',
    measuredAt: '2026-07-27T00:00:00Z',
    freshnessTtlMs: 7200000,
    source: { label: 'fixture', fingerprint: 'graph-fixture-fingerprint' },
    summary: { modules: 2 },
    modules: [
      {
        id: 'alpha',
        folder: 'alpha',
        nodes: [node(root, 'tools/alpha/app.js'), shared],
        edges: []
      },
      {
        id: 'beta',
        folder: 'beta',
        nodes: [node(root, 'tools/beta/app.js'), shared],
        edges: []
      }
    ]
  };
}

function treeReceipt(root) {
  const rows = [];
  function visit(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(absolute);
      else rows.push(path.relative(root, absolute) + ':' + fs.statSync(absolute).size + ':' + digest(absolute));
    }
  }
  visit(root);
  return rows;
}

function argValue(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
}

const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'axm-storage-namespace-'));
try {
  write(path.join(fixtureRoot, 'tools/alpha/app.js'), [
    "const STORE = 'shared-key';",
    "localStorage.setItem(STORE, 'alpha-value');",
    'sessionStorage.getItem(dynamicKey);',
    'indexedDB.open("alpha-db");',
    "localStorage.alphaOwn = 'x';",
    'localStorage.clear();'
  ].join('\n'));
  write(path.join(fixtureRoot, 'tools/beta/app.js'), [
    "localStorage.getItem('shared-key');",
    "sessionStorage.removeItem('beta-session');",
    "caches.open('cache-v1');"
  ].join('\n'));
  write(path.join(fixtureRoot, 'shared/storage-helper.js'), "localStorage.getItem('shared-helper');\n");

  const fixtureGraph = graph(fixtureRoot);
  const before = treeReceipt(fixtureRoot);
  const first = Core.analyzeWorkshop(fixtureRoot, fixtureGraph, { now: '2026-07-27T00:10:00Z' });
  const second = Core.analyzeWorkshop(fixtureRoot, fixtureGraph, { now: '2026-07-27T01:10:00Z' });
  const after = treeReceipt(fixtureRoot);
  const occurrence = (kind, namespace) => first.occurrences.find(item => item.storageKind === kind && item.namespace === namespace);
  const group = first.collisionGroups.find(item => item.namespace === 'shared-key');
  const request = Core.createReviewRequest(first, group.id, { now: '2026-07-27T00:20:00Z' });
  const laterRequest = Core.createReviewRequest(second, group.id, { now: '2026-07-27T01:20:00Z' });

  check('map declares exact schema and graph source', () => {
    assert.equal(first.schema, 'axm.storage-namespace-map/v1');
    assert.equal(first.source.graphSchema, 'axm.entry-resource-graph/v1');
    assert.equal(first.source.graphFingerprint, 'graph-fixture-fingerprint');
  });
  check('unique graph sources are hash-verified before reading', () => {
    assert.equal(first.summary.uniqueTextSources, 3);
    assert.equal(first.summary.verifiedSources, 3);
    assert(first.sourceReceipts.every(item => item.state === 'VERIFIED_GRAPH_SOURCE'));
  });
  check('same-file string constant resolves one exact localStorage namespace', () => {
    const item = occurrence('LOCALSTORAGE', 'shared-key');
    assert.equal(item.resolution, 'CONST_RESOLVED');
    assert.equal(item.identifier, 'STORE');
  });
  check('literal session storage namespace is preserved', () => {
    assert.equal(occurrence('SESSIONSTORAGE', 'beta-session').resolution, 'LITERAL');
  });
  check('dynamic key remains unresolved', () => {
    const item = first.occurrences.find(entry => entry.storageKind === 'SESSIONSTORAGE' && entry.resolution === 'DYNAMIC_NOT_RESOLVED');
    assert(item);
    assert.equal(item.namespace, null);
  });
  check('IndexedDB and Cache Storage names remain distinct kinds', () => {
    assert.equal(occurrence('INDEXED_DB', 'alpha-db').operation, 'OPEN');
    assert.equal(occurrence('CACHE_STORAGE', 'cache-v1').operation, 'OPEN');
  });
  check('property access is mapped as an exact namespace pattern', () => {
    assert.equal(occurrence('LOCALSTORAGE', 'alphaOwn').resolution, 'PROPERTY_LITERAL');
  });
  check('whole-store clear remains visible without inventing a key', () => {
    const clear = first.occurrences.find(item => item.operation === 'CLEAR_ALL');
    assert(clear);
    assert.equal(clear.namespace, null);
    assert.equal(clear.resolution, 'WHOLE_STORE_OPERATION');
  });
  check('shared source is analyzed once with two consumers', () => {
    const shared = occurrence('LOCALSTORAGE', 'shared-helper');
    assert.equal(shared.sourceOwner, null);
    assert.deepEqual(shared.consumingModules, ['alpha', 'beta']);
    assert.equal(first.occurrences.filter(item => item.namespace === 'shared-helper').length, 1);
  });
  check('same namespace across two module owners forms one review group', () => {
    assert(group);
    assert.deepEqual(group.ownershipScopes, ['alpha', 'beta']);
    assert.equal(group.state, 'SHARED_EXACT_NAMESPACE_REVIEW');
  });
  check('repeated namespace is not labeled harmful', () => {
    assert.equal(first.truth.collisionHarmProven, false);
    assert.equal(first.truth.namespaceOwnershipProven, false);
  });
  check('analysis performs no source writes', () => assert.deepEqual(after, before));
  check('measurement time does not alter map fingerprint', () => {
    assert.equal(first.source.fingerprint, second.source.fingerprint);
    assert.notEqual(first.measuredAt, second.measuredAt);
  });
  check('map leaks no absolute fixture root', () => assert.equal(JSON.stringify(first).includes(fixtureRoot), false));
  check('hash drift blocks source parsing and stays explicit', () => {
    const betaFile = path.join(fixtureRoot, 'tools/beta/app.js');
    const original = fs.readFileSync(betaFile, 'utf8');
    write(betaFile, original + '\n// drift');
    const drifted = Core.analyzeWorkshop(fixtureRoot, fixtureGraph);
    assert(drifted.readIssues.some(item => item.path === 'tools/beta/app.js' && item.code === 'SOURCE_HASH_DRIFT'));
    assert.equal(drifted.sourceReceipts.find(item => item.path === 'tools/beta/app.js').state, 'SOURCE_HASH_DRIFT');
    write(betaFile, original);
  });
  check('review request selects one exact group and four questions', () => {
    assert.equal(request.schema, 'axm.storage-namespace-review-request/v1');
    assert.equal(request.selectedGroup.id, group.id);
    assert.equal(request.questions.length, 4);
    assert(request.questions.every(item => item.state === 'REQUEST_NOT_RUN'));
    assert.equal(request.summary.questionsAnswered, 0);
  });
  check('review request fingerprint ignores generation time', () => {
    assert.equal(request.fingerprint, laterRequest.fingerprint);
    assert.notEqual(request.generatedAt, laterRequest.generatedAt);
  });
  check('review request refuses unknown group', () => {
    assert.throws(() => Core.createReviewRequest(first, 'unknown'), /not present/);
  });
  check('request contains no values migration rename browser or authority claim', () => {
    assert.equal(request.truth.storedValuesIncluded, false);
    assert.equal(request.truth.migrationPerformed, false);
    assert.equal(request.truth.namespaceRenamed, false);
    assert.equal(request.truth.browserLoaded, false);
    assert.equal(request.truth.permissionChanged, false);
    assert.equal(request.truth.canonChanged, false);
  });
  check('map truth refuses live storage values execution grants and CANON', () => {
    for (const field of [
      'liveStorageRead', 'liveStorageWritten', 'storedValuesRead', 'namespaceOwnershipProven',
      'collisionHarmProven', 'browserLoaded', 'scriptsExecuted', 'permissionGranted',
      'readinessProven', 'sourceMutationPerformed', 'installerStagingPerformed',
      'installationPerformed', 'promotionPerformed', 'canonChanged'
    ]) assert.equal(first.truth[field], false);
  });
  check('manifest contract identity version permissions and handoffs align', () => {
    const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, 'manifest.json'), 'utf8'));
    const contract = JSON.parse(fs.readFileSync(path.join(__dirname, 'module.contract.json'), 'utf8'));
    assert.equal(manifest.id, contract.id);
    assert.equal(manifest.version, contract.version);
    assert.deepEqual(manifest.permissions, contract.permissions);
    assert(contract.handoffs.emits.includes('axm.storage-namespace-map/v1'));
    assert(contract.handoffs.accepts.includes('axm.entry-resource-graph/v1'));
  });
  check('contract preserves runtime data migration permission and CANON owners', () => {
    const contract = JSON.parse(fs.readFileSync(path.join(__dirname, 'module.contract.json'), 'utf8'));
    for (const boundary of [
      'live-storage-reading', 'live-storage-writing', 'stored-value-reading',
      'namespace-ownership-proof', 'collision-harm-proof', 'automatic-key-renaming',
      'automatic-data-migration', 'browser-loading', 'script-execution',
      'permission-grant', 'installation', 'canon-change'
    ]) assert(contract.boundaries.refuses.includes(boundary));
  });
  check('browser surface references only local candidate files', () => {
    const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
    for (const name of [
      'styles.css', 'current-storage-namespace-map.js',
      'current-storage-namespace-review-request.js', 'app.js'
    ]) assert(html.includes(name));
    assert.equal(/https?:\/\//.test(html), false);
  });
  check('bundle builder is self-contained and excludes output', () => {
    const source = fs.readFileSync(path.join(__dirname, 'build-bundle.js'), 'utf8');
    assert(source.includes('absolute === output'));
    assert(source.includes("'axm.module-bundle/v1'"));
  });

  const workshopRoot = argValue('--workshop-root');
  const graphFile = argValue('--graph');
  if (workshopRoot && graphFile) {
    const liveGraph = JSON.parse(fs.readFileSync(graphFile, 'utf8'));
    const live = Core.analyzeWorkshop(workshopRoot, liveGraph);
    check('live graph-bound analysis verifies sources and finds storage patterns', () => {
      assert.equal(live.summary.modulesInGraph, 81);
      assert(live.summary.verifiedSources > 0);
      assert(live.summary.occurrences > 0);
      assert.equal(live.summary.readIssues, 0);
    });
    check('live storage analysis remains static and non-authoritative', () => {
      assert.equal(live.truth.liveStorageRead, false);
      assert.equal(live.truth.storedValuesRead, false);
      assert.equal(live.truth.scriptsExecuted, false);
      assert.equal(live.truth.canonChanged, false);
    });
  }
} finally {
  fs.rmSync(fixtureRoot, { recursive: true, force: true });
}

process.stdout.write('\nStorage Namespace Observatory selftest: PASS (' + checks + ' checks)\n');
