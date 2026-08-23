'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createServer, safeStaticFile } = require('../runtime/server');

async function call(base, pathname, init) {
  const response = await fetch(base + pathname, init);
  const type = response.headers.get('content-type') || '';
  const value = type.includes('application/json') ? await response.json() : await response.text();
  return { response, value };
}

async function main() {
  const dataRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'axm-four-roots-http-'));
  const server = createServer({ dataRoot });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const base = 'http://127.0.0.1:' + server.address().port;
  try {
    let result = await call(base, '/health');
    assert.strictEqual(result.response.status, 200);
    assert.strictEqual(result.value.gameId, '020-four-roots-adventure');
    assert.strictEqual(result.value.stateAuthority, 'server');
    assert.strictEqual(result.value.persistence, 'server-file');
    assert.strictEqual(result.value.outboundNetwork, false);
    assert.match(result.value.contentDigest, /^sha256:[0-9a-f]{64}$/);

    result = await call(base, '/games/020/');
    assert.strictEqual(result.response.status, 200);
    assert.ok(result.value.includes('Four Roots'));
    assert.match(result.response.headers.get('content-security-policy'), /connect-src 'self'/);
    assert.strictEqual(result.response.headers.get('x-content-type-options'), 'nosniff');

    for (const asset of ['/styles.css', '/app.js']) {
      result = await call(base, asset); assert.strictEqual(result.response.status, 200, asset);
    }
    result = await call(base, '/games/020/trailer/');
    assert.strictEqual(result.response.status, 200);
    assert.ok(result.value.includes('One adventure'));
    assert.match(result.value, /public release/i);
    let mediaResponse = await fetch(base + '/games/020/trailer/rendered/four-roots-adventure-trailer.webm', { method: 'HEAD' });
    assert.strictEqual(mediaResponse.status, 200);
    assert.strictEqual(mediaResponse.headers.get('content-type'), 'video/webm');
    assert.ok(Number(mediaResponse.headers.get('content-length')) > 1000000);
    mediaResponse = await fetch(base + '/games/020/trailer/rendered/verification-receipt.json');
    assert.strictEqual(mediaResponse.status, 200);
    assert.match(mediaResponse.headers.get('content-type'), /^application\/json/);
    const mediaReceipt = await mediaResponse.json();
    assert.strictEqual(mediaReceipt.status, 'PASS');
    assert.strictEqual(mediaReceipt.truth.gameplayReplayRendered, true);
    assert.strictEqual(mediaReceipt.truth.nativeGameEngineExecuted, true);
    assert.strictEqual(mediaReceipt.truth.browserCapture, false);
    assert.strictEqual(mediaReceipt.truth.livePlayerInput, false);
    assert.strictEqual(mediaReceipt.truth.published, false);
    assert.strictEqual(mediaReceipt.rights.publicDistribution, 'HOLD');
    mediaResponse = await fetch(base + '/games/020/trailer/rendered/gameplay-replay.json');
    assert.strictEqual(mediaResponse.status, 200);
    assert.match(mediaResponse.headers.get('content-type'), /^application\/json/);
    const gameplayReplayBytes = await mediaResponse.text();
    const gameplayReplay = JSON.parse(gameplayReplayBytes);
    assert.strictEqual(gameplayReplay.schema, 'axm.four-roots-adventure-gameplay-replay/v1');
    assert.strictEqual(gameplayReplay.summary.actions, 228);
    assert.strictEqual(gameplayReplay.checkpoints.length, 40);
    assert.strictEqual(gameplayReplay.truth.browserCapture, false);
    assert.strictEqual('sha256:' + crypto.createHash('sha256').update(gameplayReplayBytes).digest('hex'), mediaReceipt.replayRef.sha256);
    for (const blocked of ['/%2e%2e/game.manifest.json', '/C:/Windows/win.ini', '/content/adventure-content.v0.2.json', '/missing.js']) {
      result = await call(base, blocked); assert.strictEqual(result.response.status, 404, blocked);
    }
    for (const blocked of ['/games/020/trailer/build-trailer.js', '/games/020/trailer/%2e%2e/game.manifest.json', '/games/020/trailer/rendered/missing.webm']) {
      result = await call(base, blocked); assert.strictEqual(result.response.status, 404, blocked);
    }
    assert.strictEqual(safeStaticFile('/%2e%2e/game.manifest.json'), null);
    assert.strictEqual(safeStaticFile('//host/share/file.js'), null);
    assert.strictEqual(safeStaticFile('/games/020/trailer/build-trailer.js'), null);

    result = await call(base, '/api/bootstrap');
    assert.strictEqual(result.response.status, 200);
    assert.strictEqual(result.value.schema, 'axm.four-roots-adventure-view/v1');
    assert.strictEqual(result.value.zone.id, 'crossroads');
    assert.strictEqual(result.value.revision, 0);
    assert.strictEqual(result.value.persistence.restart, 'RESUME');
    assert.strictEqual(result.value.authority.runtimeCanUseOutboundNetwork, false);
    assert.strictEqual(result.value.authority.runtimeCanModifyFoundation, false);

    result = await call(base, '/api/action', { method: 'POST', body: '{}' });
    assert.strictEqual(result.response.status, 415);

    result = await call(base, '/api/action', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{broken' });
    assert.strictEqual(result.response.status, 400);

    result = await call(base, '/api/action', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'move', direction: 'up', expectedRevision: 0, injectedAuthority: true }) });
    assert.strictEqual(result.response.status, 400);

    result = await call(base, '/api/action', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'move', direction: 'up', expectedRevision: 0 }) });
    assert.strictEqual(result.response.status, 200);
    assert.strictEqual(result.value.player.y, 4);
    assert.strictEqual(result.value.revision, 1);
    assert.strictEqual(result.value.interaction.actorId, 'archivist-luma');
    assert.ok(fs.existsSync(server.runtime.stateFile));

    result = await call(base, '/api/action', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'interact', expectedRevision: 0 }) });
    assert.strictEqual(result.response.status, 409);
    assert.strictEqual(result.value.error, 'stale revision');
    assert.strictEqual(result.value.view.revision, 1);

    result = await call(base, '/api/action', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'interact', expectedRevision: 1 }) });
    assert.strictEqual(result.response.status, 200);
    assert.strictEqual(result.value.revision, 2);
    assert.strictEqual(result.value.progress.quests[0].complete, true);

    result = await call(base, '/api/reset', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ confirm: false, expectedRevision: 2 }) });
    assert.strictEqual(result.response.status, 400);
    result = await call(base, '/api/reset', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ confirm: true, expectedRevision: 2 }) });
    assert.strictEqual(result.response.status, 200);
    assert.strictEqual(result.value.revision, 3);
    assert.strictEqual(result.value.progress.roots.filter((root) => root.acquired).length, 0);

    result = await call(base, '/api/unknown');
    assert.strictEqual(result.response.status, 404);
    console.log('PASS Four Roots Adventure HTTP boundary (69 assertions)');
  } finally {
    await new Promise((resolve) => server.close(resolve));
    fs.rmSync(dataRoot, { recursive: true, force: true });
  }
}

main().catch((error) => { console.error(error.stack || error); process.exit(1); });
