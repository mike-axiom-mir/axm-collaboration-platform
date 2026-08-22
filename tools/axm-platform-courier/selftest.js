#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Service = require('../../shared/operations/platform-courier-service');

function write(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive:true });
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n', 'utf8');
}
function read(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }
function request(id, action, payload, client) { return { schema:Service.REQUEST_SCHEMA, id, createdAt:'2026-08-04T00:00:00.000Z', action, payload:payload || {}, client:client || undefined }; }

(async function () {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'axm-platform-courier-'));
  const root = path.join(temporary, 'workshop');
  const stateRoot = path.join(root, 'state');
  write(path.join(root, 'registry', 'modules.json'), {
    schema:'axm.public-modules/v1', generated_at:'2026-08-04T00:00:00.000Z', summary:{ tools:1, capabilities:2 }, truth:{ capabilityCatalogGrantsAuthority:false },
    modules:[{ id:'test-animation', name:'Test Animation', status:'TEST', kind:'product', audience:'human-machine', source_path:'tools/test-animation', entry_path:'tools/test-animation/index.html', manifest:{ valid:true, sha256:'abc' }, contract:{ valid:true, path:'tools/test-animation/module.contract.json', provides:['animation.preview','animation.recipe'], consumes:[], permissions:[] } }]
  });
  let capturedState = null;
  const service = Service.create({ root, stateRoot, port:8788, searchService:{ search(query, options) { return { query, options, total:1, results:[{ path:'tools/test-animation' }] }; } }, evidenceRetentionService:{ status() { return { schema:'axm.evidence-retention-status/v1', healthy:true }; } }, holodeckVisualCapture:{ async capture(input) {
    capturedState = input;
    return { schema:'axm.platform-courier.holodeck-visual-capture/v1', artifact:{ mime:'image/png', file:path.join(root, 'state', 'capture.png'), courier_file:'holodeck-captures/capture.png', bytes:100, sha256:'a'.repeat(64), viewport:{ width:1280, height:720 } }, proof:{ schema:'axm.holodeck-screen-capture-proof/v1', sessionId:input.sessionId, stateDigest:input.state.stateDigest, renderer:{ renderer:'three-r160-webgl', drawCalls:12 } }, truth:{ actualBrowserPixels:true, arbitraryUrl:false } };
  } } });

  write(path.join(service.paths.inbox, 'denied.json'), request('denied', 'ping'));
  await service.processOnce();
  assert.equal(read(path.join(service.paths.outbox, 'denied.response.json')).ok, false);

  assert.equal(service.settings().providerProfile, 'anthropic-platform');
  service.configure({ providerProfile:'generic-sandbox', receiptRetention:50, allowHeartbeatStatus:true, allowHolodeck:true }, 'selftest');
  assert.equal(service.settings().receiptRetention, 50);
  assert.equal(read(service.paths.settingsFile).updatedBy, 'selftest');
  service.grantConsent({ subject:'selftest-platform', scopes:[Service.READ_SCOPE, Service.HAND_SCOPE] }, 'selftest');
  assert.equal(service.consent().granted, true);

  write(path.join(service.paths.inbox, 'discover.json'), request('discover', 'discover', { query:'animation' }, { id:'selftest-client', provider:'test-provider', surface:'test-sandbox', session_id:'test-session', label:'Selftest client' }));
  await service.processOnce();
  const discovery = read(path.join(service.paths.outbox, 'discover.response.json'));
  assert.equal(discovery.ok, true);
  assert.equal(discovery.result.total, 1);
  assert.equal(discovery.result.results[0].provides[0], 'animation.preview');
  assert.match(discovery.requestSha256, /^[a-f0-9]{64}$/);
  assert.match(discovery.receiptSha256, /^[a-f0-9]{64}$/);
  assert.equal(service.connections()[0].id, 'selftest-client');
  assert.equal(service.connections()[0].lastAction, 'discover');
  assert.equal(service.snapshot().providerProfiles.find(profile => profile.id === 'anthropic-platform').maturity, 'LIVE_PROVEN');

  const holodeckClient = { id:'sonnet-selftest', provider:'anthropic-platform', surface:'cowork', session_id:'sonnet-echo-test', label:'Sonnet selftest' };
  const deckCatalog = await service.execute(request('deck-catalog', 'holodeck.catalog', {}, holodeckClient));
  assert.equal(deckCatalog.world.id, 'world.holodeck.echo-atrium');
  assert.equal(deckCatalog.renderer.visualCaptureAction, 'holodeck.capture');
  const deckStart = await service.execute(request('deck-start', 'holodeck.session.start', {}, holodeckClient));
  assert.equal(deckStart.observation.schema, 'axm.holodeck-sensor-frame/v1');
  assert.equal(deckStart.observation.truth.cameraPixelsObserved, false);
  const deckMove = await service.execute(request('deck-move', 'holodeck.intent.dispatch', { kind:'MOVE', intent_payload:{ forward:1, meters:0.8 } }, holodeckClient));
  assert.equal(deckMove.receipt.status, 'APPLIED');
  assert.equal(deckMove.session.revision, 1);
  const deckObserve = await service.execute(request('deck-observe', 'holodeck.observe', {}, holodeckClient));
  assert.equal(deckObserve.frame.stateDigest, deckMove.session.stateDigest);
  const deckCapture = await service.execute(request('deck-capture', 'holodeck.capture', { viewport:{ width:1280, height:720 } }, holodeckClient));
  assert.equal(deckCapture.capture.truth.actualBrowserPixels, true);
  assert.equal(deckCapture.capture.proof.stateDigest, deckMove.session.stateDigest);
  assert.equal(capturedState.sessionId, holodeckClient.session_id);
  const deckSnapshot = await service.execute(request('deck-snapshot', 'holodeck.snapshot', { label:'Selftest snapshot' }, holodeckClient));
  assert.equal(deckSnapshot.snapshot.schema, 'axm.holodeck-state-snapshot/v1');
  const deckReset = await service.execute(request('deck-reset', 'holodeck.session.reset', {}, holodeckClient));
  assert.equal(deckReset.session.revision, 0);

  write(path.join(service.paths.inbox, 'search.json'), request('search', 'search', { query:'rigged animation', limit:7 }));
  await service.processOnce();
  const search = read(path.join(service.paths.outbox, 'search.response.json'));
  assert.equal(search.ok, true);
  assert.equal(search.result.options.limit, 7);

  write(path.join(service.paths.inbox, 'catalog.json'), request('catalog', 'hands.catalog', { query:'vector' }));
  await service.processOnce();
  const catalog = read(path.join(service.paths.outbox, 'catalog.response.json'));
  assert.equal(catalog.ok, true);
  assert(catalog.result.hands.some(hand => hand.id === 'vector-form'));

  await assert.rejects(
    service.execute(request('remote', 'api.call', { method:'GET', route:'https://example.com/api/status' })),
    /local \/api path/,
  );
  await assert.rejects(
    service.execute(request('mutation', 'api.call', { method:'POST', route:'/api/public-release/deploy', body:{} })),
    /only allows GET or a declared deterministic preview POST/,
  );

  const brief = { id:'courier-selftest', title:'Courier selftest icon', kind:'icon', width:32, height:32 };
  write(path.join(service.paths.inbox, 'invoke.json'), request('invoke', 'hands.invoke', { hand_id:'vector-form', seed:'courier-selftest', created_at:'2026-08-04T00:00:00.000Z', brief }));
  await service.processOnce();
  const invocation = read(path.join(service.paths.outbox, 'invoke.response.json'));
  assert.equal(invocation.ok, true, invocation.error);
  assert(invocation.result.artifacts.length > 0);
  const saved = invocation.result.artifacts.filter(item => item.courier_file);
  assert(saved.length > 0);
  saved.forEach(item => {
    const file = path.join(service.paths.stateRoot, ...item.courier_file.split('/'));
    assert(fs.existsSync(file));
    assert.match(item.sha256, /^[a-f0-9]{64}$/);
  });

  service.revokeConsent('selftest');
  await assert.rejects(service.execute(request('revoked', 'ping')), /local consent scope required/);
  service.grantConsent({ subject:'selftest-platform', scopes:[Service.READ_SCOPE, Service.HAND_SCOPE] }, 'selftest');
  service.configure({ enabled:false }, 'selftest');
  await assert.rejects(service.execute(request('disabled', 'ping')), /disabled by the local user/);
  service.configure({ enabled:true, allowSafePreviews:false }, 'selftest');
  await assert.rejects(service.execute(request('preview-disabled', 'api.call', { method:'POST', route:'/api/module-workbench/validate', body:{} })), /safe preview calls are disabled/);
  service.configure({ allowSafePreviews:true }, 'selftest');

  service.start();
  assert.equal(service.status().ready, true);
  assert.equal(service.status().consent.granted, true);
  service.stop();
  assert.equal(read(service.paths.statusFile).ready, false);

  const moduleRoot = __dirname;
  const html = fs.readFileSync(path.join(moduleRoot, 'index.html'), 'utf8');
  const app = fs.readFileSync(path.join(moduleRoot, 'app.js'), 'utf8');
  const css = fs.readFileSync(path.join(moduleRoot, 'styles.css'), 'utf8');
  assert(html.includes('data-module-id="axm-platform-courier"'));
  ['providerProfile','allowRead','allowHands','allowPreviews','allowHeartbeat','allowHolodeck','receiptRetention','grantButton','revokeButton','connections'].forEach(id => assert(html.includes('id="' + id + '"'), 'missing UI id ' + id));
  assert(app.includes("'/api/platform-connect/settings'"));
  assert(app.includes('SAVE PLATFORM CONNECT SETTINGS'));
  assert(app.includes('GRANT AXM PLATFORM ACCESS'));
  assert(app.includes('REVOKE AXM PLATFORM ACCESS'));
  assert(css.includes('@media(max-width:800px)'));

  fs.rmSync(temporary, { recursive:true, force:true });
  console.log('AXM Platform Courier selftest: PASS');
})().catch(error => { console.error(error.stack || error); process.exitCode = 1; });
