#!/usr/bin/env node
'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Core = require('./core/runtime-channel-core');

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
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'axm-runtime-channel-'));

try {
  const files = {
    'tools/alpha/app.js': [
      "const bus = 'axm.bus';",
      'const channel = new BroadcastChannel(bus);',
      "dispatchEvent(new CustomEvent('axm:ready'));",
      "window.addEventListener('axm:ready', receive);",
      "window.addEventListener('message', receive);",
      "window.addEventListener('click', receive);",
      "parent.postMessage({ ok: true }, '*');",
      'new MessageChannel();',
      "new WebSocket('wss:' + '//example.invalid/ws');"
    ].join('\n'),
    'tools/beta/app.js': [
      "new BroadcastChannel('axm.bus');",
      "new CustomEvent('axm:orphan');",
      'new BroadcastChannel(dynamicName);',
      "new EventSource('/events');"
    ].join('\n'),
    'shared/runtime.js': "window.addEventListener('storage', receive);"
  };
  for (const [relative, body] of Object.entries(files)) {
    const target = path.join(temporary, relative);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, body);
  }
  const node = relative => ({
    path: relative,
    kind: 'JAVASCRIPT',
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
      { id: 'alpha', folder: 'alpha', nodes: [node('tools/alpha/app.js'), node('shared/runtime.js')] },
      { id: 'beta', folder: 'beta', nodes: [node('tools/beta/app.js'), node('shared/runtime.js')] }
    ]
  };
  const map = Core.analyzeWorkshop(temporary, graph, { now: '2026-07-27T00:00:00.000Z' });

  check('map declares exact schema and graph fingerprint', () => {
    assert.equal(map.schema, Core.SCHEMA);
    assert.equal(map.source.graphFingerprint, 'fixture-graph');
  });
  check('unique graph sources are hash verified', () => {
    assert.equal(map.summary.uniqueTextSources, 3);
    assert.equal(map.summary.verifiedSources, 3);
  });
  check('same-file constant BroadcastChannel resolves', () => assert(map.observations.some(item => item.family === 'BROADCAST_CHANNEL' && item.name === 'axm.bus' && item.resolution === 'CONST_RESOLVED')));
  check('literal BroadcastChannel resolves', () => assert(map.observations.some(item => item.family === 'BROADCAST_CHANNEL' && item.name === 'axm.bus' && item.resolution === 'LITERAL')));
  check('dynamic BroadcastChannel stays unresolved', () => assert(map.observations.some(item => item.family === 'BROADCAST_CHANNEL' && item.resolution === 'DYNAMIC_NOT_RESOLVED')));
  check('CustomEvent producer is recorded', () => assert(map.observations.some(item => item.family === 'CUSTOM_EVENT' && item.name === 'axm:ready' && item.role === 'PRODUCER_CONSTRUCTED')));
  check('matching custom listener is recorded', () => assert(map.observations.some(item => item.family === 'CUSTOM_EVENT' && item.name === 'axm:ready' && item.role === 'CONSUMER_REGISTERED')));
  check('ordinary click handler is outside channel scope', () => assert(!map.observations.some(item => item.name === 'click')));
  check('selected environment event listeners remain visible', () => assert(map.observations.some(item => item.family === 'ENVIRONMENT_EVENT' && item.name === 'message')));
  check('postMessage is visible without payload capture', () => assert(map.observations.some(item => item.family === 'POST_MESSAGE' && item.name === null)));
  check('MessageChannel declaration is anonymous', () => assert(map.observations.some(item => item.family === 'MESSAGE_CHANNEL' && item.resolution === 'UNNAMED')));
  check('WebSocket and EventSource remain endpoint text only', () => {
    assert(map.observations.some(item => item.family === 'WEB_SOCKET' && item.role === 'ENDPOINT_TEXT_DECLARATION'));
    assert(map.observations.some(item => item.family === 'EVENT_SOURCE' && item.role === 'ENDPOINT_TEXT_DECLARATION'));
  });
  check('cross-owner BroadcastChannel creates review seam', () => {
    const channel = map.channels.find(item => item.family === 'BROADCAST_CHANNEL' && item.name === 'axm.bus');
    assert(channel);
    assert.equal(channel.state, 'MULTI_OWNER_NAMED_CHANNEL_REVIEW');
  });
  check('paired CustomEvent has producer and consumer', () => {
    const channel = map.channels.find(item => item.family === 'CUSTOM_EVENT' && item.name === 'axm:ready');
    assert.equal(channel.producerCount, 1);
    assert.equal(channel.consumerCount, 1);
  });
  check('orphan CustomEvent remains a review not a defect verdict', () => {
    const channel = map.channels.find(item => item.name === 'axm:orphan');
    assert.equal(channel.state, 'PRODUCER_WITHOUT_STATIC_CONSUMER_REVIEW');
  });
  check('shared source is analyzed only once', () => assert.equal(map.sourceReceipts.filter(item => item.path === 'shared/runtime.js').length, 1));
  check('analysis writes no fixture source', () => assert.equal(fs.readFileSync(path.join(temporary, 'tools/alpha/app.js'), 'utf8'), files['tools/alpha/app.js']));
  check('measurement time does not alter fingerprint', () => {
    const second = Core.analyzeWorkshop(temporary, graph, { now: '2030-01-01T00:00:00.000Z' });
    assert.equal(second.source.fingerprint, map.source.fingerprint);
  });
  check('map leaks no absolute fixture root', () => assert(!JSON.stringify(map).includes(temporary)));
  check('hash drift blocks parsing', () => {
    fs.appendFileSync(path.join(temporary, 'tools/beta/app.js'), '\n// drift');
    const drift = Core.analyzeWorkshop(temporary, graph);
    assert(drift.readIssues.some(item => item.code === 'SOURCE_HASH_DRIFT'));
    assert(!drift.observations.some(item => item.path === 'tools/beta/app.js'));
    fs.writeFileSync(path.join(temporary, 'tools/beta/app.js'), files['tools/beta/app.js']);
  });
  const channel = map.channels.find(item => item.name === 'axm.bus');
  const request = Core.createReviewRequest(map, channel.id, { now: '2026-07-27T00:00:00.000Z' });
  check('review request selects one exact channel and four questions', () => {
    assert.equal(request.selectedChannel.id, channel.id);
    assert.equal(request.questions.length, 4);
    assert(request.questions.every(item => item.state === 'REQUEST_NOT_RUN'));
  });
  check('review fingerprint ignores generation time', () => assert.equal(request.fingerprint, Core.createReviewRequest(map, channel.id, { now: '2030-01-01T00:00:00.000Z' }).fingerprint));
  check('review refuses unknown channel', () => assert.throws(() => Core.createReviewRequest(map, 'missing')));
  check('truth refuses execution connection delivery grant and CANON', () => {
    assert.equal(map.truth.scriptsExecuted, false);
    assert.equal(map.truth.socketOpened, false);
    assert.equal(map.truth.messageSent, false);
    assert.equal(map.truth.deliveryProven, false);
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
    for (const file of ['styles.css', 'current-runtime-channel-map.js', 'current-runtime-channel-review-request.js', 'app.js']) assert(html.includes(file));
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
    check('live graph-bound analysis verifies all sources', () => assert.equal(live.summary.verifiedSources, live.summary.uniqueTextSources));
    check('live analysis remains stopped and non-authoritative', () => {
      assert.equal(live.truth.channelOpened, false);
      assert.equal(live.truth.installationPerformed, false);
      assert.equal(live.truth.promotionPerformed, false);
    });
  }
  process.stdout.write('\nRuntime Channel Observatory selftest: PASS (' + checks + ' checks)\n');
} finally {
  fs.rmSync(temporary, { recursive: true, force: true });
}
