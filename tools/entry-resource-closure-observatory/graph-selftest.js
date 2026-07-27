#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Graph = require('./core/entry-resource-graph-core');

const REMOTE_THEME = ['https', '://example.invalid/theme.css'].join('');

let checks = 0;
function check(label, action) {
  action();
  checks += 1;
  process.stdout.write('PASS ' + label + '\n');
}

function write(file, body = '') {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, body);
}

function writeJson(file, value) {
  write(file, JSON.stringify(value, null, 2) + '\n');
}

function addModule(root, id, entry = 'index.html') {
  const moduleRoot = path.join(root, 'tools', id);
  writeJson(path.join(moduleRoot, 'manifest.json'), {
    id,
    name: id,
    version: 'v0.1',
    status: 'EXPERIMENTAL',
    entry
  });
  return moduleRoot;
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

const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'axm-resource-graph-'));
try {
  fs.mkdirSync(path.join(fixtureRoot, 'tools'), { recursive: true });
  const alpha = addModule(fixtureRoot, 'alpha');
  write(path.join(alpha, 'index.html'), [
    '<!doctype html>',
    '<link rel="stylesheet" href="styles.css">',
    '<script src="app.js"></script>',
    '<script src="linked.js"></script>',
    '<img src="pic.png">'
  ].join('\n'));
  write(path.join(alpha, 'styles.css'), [
    '@import "theme.css";',
    '.hero { background-image: url("pic.png"); }'
  ].join('\n'));
  write(path.join(alpha, 'theme.css'), [
    '@import "styles.css";',
    '@import url("https' + '://example.invalid/theme.css");',
    '.missing { background: url("missing.png"); }'
  ].join('\n'));
  write(path.join(alpha, 'app.js'), [
    "import './lib';",
    "import pkg from 'fixture-package';",
    "import('./lazy.js');",
    "new Worker('./worker.js');"
  ].join('\n'));
  write(path.join(alpha, 'lib.js'), "export { value } from './app.js';\n");
  write(path.join(alpha, 'lazy.js'), 'export const lazy = true;\n');
  write(path.join(alpha, 'worker.js'), 'self.workerReady = true;\n');
  write(path.join(alpha, 'pic.png'), 'PNG');
  write(path.join(alpha, 'real.js'), 'window.real = true;\n');
  fs.symlinkSync(path.join(alpha, 'real.js'), path.join(alpha, 'linked.js'));

  const beta = addModule(fixtureRoot, 'beta');
  write(path.join(beta, 'index.html'), '<!doctype html><title>Beta</title>');

  const before = treeReceipt(fixtureRoot);
  const first = Graph.scanWorkshop(fixtureRoot, { now: '2026-07-27T00:00:00Z' });
  const second = Graph.scanWorkshop(fixtureRoot, { now: '2026-07-27T01:00:00Z' });
  const after = treeReceipt(fixtureRoot);
  const alphaGraph = first.modules.find(module => module.id === 'alpha');
  const edge = (fromSuffix, raw) => alphaGraph.edges.find(item => item.from.endsWith(fromSuffix) && item.raw === raw);
  const node = suffix => alphaGraph.nodes.find(item => item.path.endsWith(suffix));

  check('graph declares exact schema and v0.2', () => {
    assert.equal(first.schema, 'axm.entry-resource-graph/v1');
    assert.equal(first.version, 'v0.2');
  });
  check('graph starts from every present declared HTML entry', () => {
    assert.deepEqual(first.modules.map(module => module.id), ['alpha', 'beta']);
    assert.equal(node('alpha/index.html').kind, 'HTML');
    assert.equal(node('alpha/index.html').bodyRead, true);
  });
  check('HTML script style and image references become typed edges', () => {
    assert.equal(edge('index.html', 'styles.css').type, 'LINK_HREF');
    assert.equal(edge('index.html', 'app.js').type, 'SCRIPT_SRC');
    assert.equal(edge('index.html', 'pic.png').type, 'IMG_SRC');
  });
  check('CSS import and url patterns are followed without applying styles', () => {
    assert.equal(edge('styles.css', 'theme.css').state, 'STATIC_LOCAL_PRESENT');
    assert.equal(edge('styles.css', 'pic.png').state, 'STATIC_LOCAL_PRESENT');
    assert.equal(first.truth.stylesApplied, false);
  });
  check('extensionless JavaScript import resolves by explicit candidate list', () => {
    const resolved = edge('app.js', './lib');
    assert.equal(resolved.state, 'STATIC_LOCAL_PRESENT');
    assert.equal(resolved.targetPath, 'tools/alpha/lib.js');
    assert.match(resolved.resolutionStrategy, /STATIC_EXTENSION_CANDIDATE/);
  });
  check('literal dynamic import and Worker path remain static pattern evidence', () => {
    assert.equal(edge('app.js', './lazy.js').type, 'JS_LITERAL_DYNAMIC_IMPORT');
    assert.equal(edge('app.js', './worker.js').type, 'JS_LITERAL_WORKER');
    assert.equal(node('alpha/lazy.js').bodyRead, true);
    assert.equal(node('alpha/worker.js').bodyRead, true);
  });
  check('bare package remains unresolved rather than executed through Node', () => {
    assert.equal(edge('app.js', 'fixture-package').state, 'BARE_MODULE_SPECIFIER_NOT_RESOLVED');
    assert.equal(first.truth.barePackagesResolved, false);
  });
  check('remote CSS import and missing local asset remain separate', () => {
    assert.equal(edge('theme.css', REMOTE_THEME).state, 'REMOTE_REFERENCE_NOT_FETCHED');
    assert.equal(edge('theme.css', 'missing.png').state, 'STATIC_LOCAL_MISSING');
  });
  check('symlink target is refused rather than followed', () => {
    assert.equal(edge('index.html', 'linked.js').state, 'SYMLINK_REFUSED');
    assert.equal(first.source.symlinksFollowed, false);
  });
  check('directed CSS and JavaScript cycles are reported without judgment', () => {
    assert.equal(alphaGraph.cycles.length, 2);
    assert(alphaGraph.cycles.some(cycle => cycle.some(item => item.endsWith('styles.css'))));
    assert(alphaGraph.cycles.some(cycle => cycle.some(item => item.endsWith('app.js'))));
  });
  check('binary leaf receives metadata but its body is not read', () => {
    const image = node('alpha/pic.png');
    assert.equal(image.kind, 'ASSET');
    assert.equal(image.bodyRead, false);
    assert.equal(image.sha256, null);
    assert.equal(first.truth.binaryResourceBodiesRead, false);
  });
  check('graph reads local text only and executes nothing', () => {
    assert(first.summary.textBodiesRead > 0);
    assert.equal(first.truth.localTextResourceBodiesRead, true);
    assert.equal(first.truth.scriptsExecuted, false);
    assert.equal(first.truth.browserLoaded, false);
    assert.equal(first.truth.networkFetched, false);
  });
  check('graph scan performs no source writes', () => assert.deepEqual(after, before));
  check('measurement time does not alter graph fingerprint', () => {
    assert.equal(first.source.fingerprint, second.source.fingerprint);
    assert.notEqual(first.measuredAt, second.measuredAt);
  });
  check('graph output leaks no absolute fixture root', () => {
    assert.equal(JSON.stringify(first).includes(fixtureRoot), false);
  });
  check('depth limit creates an explicit text-body hold', () => {
    const limited = Graph.scanWorkshop(fixtureRoot, { maxDepth: 0 });
    assert(limited.summary.limitHolds > 0);
    assert(limited.modules.find(module => module.id === 'alpha').nodes.some(item => item.state === 'DEPTH_LIMIT_HOLD'));
  });
  check('text file size limit prevents body reading', () => {
    const limited = Graph.scanWorkshop(fixtureRoot, { maxTextBytes: 16 });
    assert(limited.summary.limitHolds > 0);
    assert.equal(limited.summary.edges, 0);
  });
  check('node limit is visible rather than silently truncating', () => {
    const limited = Graph.scanWorkshop(fixtureRoot, { maxNodesPerModule: 2 });
    assert(limited.summary.limitHolds > 0);
    assert(limited.modules.find(module => module.id === 'alpha').edges.some(item => item.state === 'NODE_LIMIT_HOLD'));
  });
  check('large no-import JavaScript text does not create false edges', () => {
    const text = 'const value = 1;\\n'.repeat(50000);
    assert.deepEqual(Graph.extractJavascriptReferences(text), []);
  });
  check('manifest and contract declare graph handoff and aligned version', () => {
    const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, 'manifest.json'), 'utf8'));
    const contract = JSON.parse(fs.readFileSync(path.join(__dirname, 'module.contract.json'), 'utf8'));
    assert.equal(manifest.version, 'v0.2');
    assert.equal(contract.version, 'v0.2');
    assert(manifest.produces.includes('axm.entry-resource-graph/v1'));
    assert(contract.handoffs.emits.includes('axm.entry-resource-graph/v1'));
  });
  check('contract preserves runtime syntax network visual and CANON owners', () => {
    const contract = JSON.parse(fs.readFileSync(path.join(__dirname, 'module.contract.json'), 'utf8'));
    for (const boundary of [
      'syntax-tree-proof', 'browser-resolution', 'network-fetch', 'browser-loading',
      'script-execution', 'style-application', 'media-decoding',
      'dynamic-reference-resolution', 'bare-package-resolution',
      'visual-quality-proof', 'readiness-proof', 'canon-change'
    ]) assert(contract.boundaries.refuses.includes(boundary));
  });
  check('browser surface references local graph data only', () => {
    const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
    assert(html.includes('current-entry-resource-graph.js'));
    assert.equal(/https?:\/\//.test(html), false);
  });

  const workshopRoot = argValue('--workshop-root');
  if (workshopRoot) {
    const live = Graph.scanWorkshop(workshopRoot);
    check('live graph covers all Workshop modules within explicit limits', () => {
      assert.equal(live.summary.modules, 81);
      assert(live.summary.nodes > live.summary.modules);
      assert(live.summary.textBodiesRead > live.summary.modules);
      assert.equal(live.summary.limitHolds, 0);
      assert.equal(live.summary.readIssues, 0);
    });
    check('live graph remains non-executing and non-authoritative', () => {
      assert.equal(live.truth.scriptsExecuted, false);
      assert.equal(live.truth.networkFetched, false);
      assert.equal(live.truth.browserLoaded, false);
      assert.equal(live.truth.readinessProven, false);
      assert.equal(live.truth.canonChanged, false);
    });
  }
} finally {
  fs.rmSync(fixtureRoot, { recursive: true, force: true });
}

process.stdout.write('\nEntry Resource Graph selftest: PASS (' + checks + ' checks)\n');
