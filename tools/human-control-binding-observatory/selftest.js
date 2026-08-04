#!/usr/bin/env node
'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Core = require('./core/human-control-binding-core');

let checks = 0;
function check(name, body) {
  body();
  checks += 1;
  process.stdout.write('PASS ' + name + '\n');
}

const publishedManifest = require('./manifest.json');
check('published manifest declares the modern schema', () => assert.equal(publishedManifest.schema, 'axm.tool-manifest/v1'));
check('published manifest classifies the observatory as a product', () => assert.equal(publishedManifest.kind, 'product'));

const digest = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'axm-human-controls-'));

try {
  const files = {
    'tools/alpha/index.html': [
      '<button id="run">Run now</button>',
      '<button id="inline" onclick="go()">Inline</button>',
      '<button id="referenced">Referenced only</button>',
      '<button id="missing"></button>',
      '<a href="/next">Next room</a>',
      '<input id="query" aria-label="Search">',
      '<input type="submit" value="Save">',
      '<button id="disabled" disabled>Later</button>',
      '<div id="dupe"></div><span id="dupe"></span>'
    ].join('\n'),
    'tools/alpha/app.js': [
      "document.getElementById('run').addEventListener('click', go);",
      "const reference = document.querySelector('#referenced');",
      "document.getElementById('query').oninput = search;"
    ].join('\n'),
    'shared/host.js': "document.getElementById('host').addEventListener('click', host);",
    'tools/beta/index.html': '<details><summary>More</summary><p>Text</p></details><button id="host">Host</button>'
  };
  for (const [relative, body] of Object.entries(files)) {
    const target = path.join(temporary, relative);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, body);
  }
  const node = (relative, depth = 0) => ({
    path: relative,
    kind: relative.endsWith('.html') ? 'HTML' : 'JAVASCRIPT',
    bytes: Buffer.byteLength(files[relative]),
    sha256: digest(Buffer.from(files[relative])),
    bodyRead: true,
    depth
  });
  const graph = {
    schema: Core.GRAPH_SCHEMA,
    freshnessTtlMs: 300000,
    source: { label: 'fixture', fingerprint: 'fixture-graph' },
    summary: { modules: 2 },
    modules: [
      {
        id: 'alpha', folder: 'alpha',
        entry: { state: 'PRESENT_HTML', sha256: digest(Buffer.from(files['tools/alpha/index.html'])) },
        nodes: [node('tools/alpha/index.html'), node('tools/alpha/app.js', 1), node('shared/host.js', 1)]
      },
      {
        id: 'beta', folder: 'beta',
        entry: { state: 'PRESENT_HTML', sha256: digest(Buffer.from(files['tools/beta/index.html'])) },
        nodes: [node('tools/beta/index.html'), node('shared/host.js', 1)]
      }
    ]
  };
  const map = Core.analyzeWorkshop(temporary, graph, { now: '2026-07-27T00:00:00.000Z' });
  const alpha = map.modules.find(module => module.id === 'alpha');
  const beta = map.modules.find(module => module.id === 'beta');
  const control = id => alpha.controls.find(item => item.id === id);

  check('map declares exact schema and graph fingerprint', () => {
    assert.equal(map.schema, Core.SCHEMA);
    assert.equal(map.source.graphFingerprint, 'fixture-graph');
  });
  check('unique graph sources are hash verified once', () => {
    assert.equal(map.source.uniqueTextSources, 4);
    assert.equal(map.source.sourceBodiesReadAfterHashMatch, 4);
  });
  check('both entry modules are analyzed', () => assert.equal(map.summary.modulesAnalyzed, 2));
  check('button text is observed as a name', () => assert.equal(control('run').accessibleNameObservation, 'Run now'));
  check('aria-label is observed as a name', () => assert.equal(control('query').accessibleNameObservation, 'Search'));
  check('exact selector plus listener is binding evidence', () => assert.equal(control('run').bindingState, 'STATIC_BINDING_EVIDENCE'));
  check('inline handler is binding evidence', () => assert(control('inline').evidence.some(item => item.kind === 'INLINE_HANDLER_DECLARED')));
  check('handler property assignment is binding evidence', () => assert(control('query').evidence.some(item => item.kind === 'STATIC_HANDLER_ASSIGNMENT_EVIDENCE')));
  check('selector without handler remains selector-only', () => assert.equal(control('referenced').bindingState, 'SELECTOR_REFERENCE_ONLY'));
  check('id with no evidence remains no-static-evidence', () => assert.equal(control('missing').bindingState, 'NO_STATIC_BINDING_EVIDENCE'));
  check('link destination remains a native semantic action', () => assert(alpha.controls.some(item => item.tag === 'a' && item.bindingState === 'NATIVE_SEMANTIC_ACTION')));
  check('submit input remains a native semantic action', () => assert(alpha.controls.some(item => item.tag === 'input' && item.type === 'submit' && item.bindingState === 'NATIVE_SEMANTIC_ACTION')));
  check('disabled declaration stays explicit', () => assert.equal(control('disabled').bindingState, 'DECLARED_NON_INTERACTIVE_STATE'));
  check('details and summary are observed as native disclosure controls', () => assert(beta.controls.filter(item => ['details', 'summary'].includes(item.tag)).every(item => item.bindingState === 'NATIVE_SEMANTIC_ACTION')));
  check('shared source can provide bounded static evidence to a consuming module', () => assert(beta.controls.find(item => item.id === 'host').evidence.some(item => item.path === 'shared/host.js')));
  check('duplicate ids are grouped without DOM construction', () => {
    assert.equal(alpha.duplicateIds.length, 1);
    assert.equal(alpha.duplicateIds[0].id, 'dupe');
  });
  check('unnamed visible control remains an observation not verdict', () => assert(map.summary.unnamedControlObservations >= 1));
  check('review modules are bounded to modules with observations', () => assert(map.reviewModules.some(item => item.moduleId === 'alpha')));
  check('analysis writes no fixture source', () => assert.equal(fs.readFileSync(path.join(temporary, 'tools/alpha/index.html'), 'utf8'), files['tools/alpha/index.html']));
  check('measurement time does not alter fingerprint', () => assert.equal(map.source.fingerprint, Core.analyzeWorkshop(temporary, graph, { now: '2030-01-01T00:00:00.000Z' }).source.fingerprint));
  check('map leaks no absolute fixture root', () => assert(!JSON.stringify(map).includes(temporary)));
  check('hash drift blocks source use and stays explicit', () => {
    fs.appendFileSync(path.join(temporary, 'tools/alpha/app.js'), '\n// drift');
    const drift = Core.analyzeWorkshop(temporary, graph);
    assert(drift.readIssues.some(item => item.code === 'SOURCE_HASH_DRIFT'));
    fs.writeFileSync(path.join(temporary, 'tools/alpha/app.js'), files['tools/alpha/app.js']);
  });
  const review = map.reviewModules.find(item => item.moduleId === 'alpha');
  const request = Core.createReviewRequest(map, review.id, { now: '2026-07-27T00:00:00.000Z' });
  check('review request selects one module and bounded controls', () => {
    assert.equal(request.selectedModule.moduleId, 'alpha');
    assert(request.selectedControls.length >= 1);
  });
  check('review request contains four unanswered questions', () => {
    assert.equal(request.questions.length, 4);
    assert(request.questions.every(item => item.state === 'REQUEST_NOT_RUN'));
  });
  check('review fingerprint ignores generation time', () => assert.equal(request.fingerprint, Core.createReviewRequest(map, review.id, { now: '2030-01-01T00:00:00.000Z' }).fingerprint));
  check('review refuses unknown module seam', () => assert.throws(() => Core.createReviewRequest(map, 'missing')));
  check('truth refuses DOM click accessibility verdict grants and CANON', () => {
    assert.equal(map.truth.domConstructed, false);
    assert.equal(map.truth.controlClicked, false);
    assert.equal(map.truth.accessibilityAdequacyProven, false);
    assert.equal(map.truth.permissionGranted, false);
    assert.equal(map.truth.canonChanged, false);
  });
  check('manifest contract identity version permissions and handoffs align', () => {
    const manifest = require('./manifest.json');
    const contract = require('./module.contract.json');
    assert.equal(manifest.id, contract.id);
    assert.equal(manifest.version, contract.version);
    assert.deepEqual(manifest.permissions, contract.permissions);
    assert.deepEqual(manifest.produces, contract.handoffs.emits);
  });
  check('browser surface references local candidate files only', () => {
    const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
    for (const file of ['styles.css', 'current-human-control-binding-map.js', 'current-human-control-binding-review-request.js', 'app.js']) assert(html.includes(file));
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
    check('live graph-bound analysis verifies all unique sources', () => assert.equal(live.source.sourceBodiesReadAfterHashMatch, live.source.uniqueTextSources));
    check('live analysis leaves controls unclicked and authority unchanged', () => {
      assert.equal(live.truth.controlClicked, false);
      assert.equal(live.truth.installationPerformed, false);
      assert.equal(live.truth.promotionPerformed, false);
    });
  }
  process.stdout.write('\nHuman Control Binding Observatory selftest: PASS (' + checks + ' checks)\n');
} finally {
  fs.rmSync(temporary, { recursive: true, force: true });
}
