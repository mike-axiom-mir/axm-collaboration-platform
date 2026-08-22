#!/usr/bin/env node
'use strict';

const assert = require('assert');
const { createServer } = require('../runtime/server');

async function request(base, pathname, init) {
  const response = await fetch(base + pathname, init);
  const contentType = response.headers.get('content-type') || '';
  const value = contentType.includes('application/json') ? await response.json() : await response.text();
  return { response, value };
}

async function main() {
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const port = server.address().port;
  const base = `http://127.0.0.1:${port}`;

  try {
    let result = await request(base, '/health');
    assert.strictEqual(result.response.status, 200);
    assert.strictEqual(result.value.gameId, '019-brace-room');
    assert.strictEqual(result.value.stateAuthority, 'browser-local');

    result = await request(base, '/');
    assert.strictEqual(result.response.status, 200);
    assert.ok(String(result.value).includes('BRACE ROOM'));

    result = await request(base, '/styles.css');
    assert.strictEqual(result.response.status, 200);

    result = await request(base, '/game-core.js');
    assert.strictEqual(result.response.status, 200);
    assert.ok(String(result.value).includes('BraceRoomCore'));

    result = await request(base, '/app.js');
    assert.strictEqual(result.response.status, 200);

    result = await request(base, '/universal-gamepad.js');
    assert.strictEqual(result.response.status, 200);
    assert.ok(String(result.value).includes('axm-universal-xbox-brawl-v0.2.1'));

    result = await request(base, '/controller.html');
    assert.strictEqual(result.response.status, 200);
    assert.ok(String(result.value).includes('Brace Room'));

    result = await request(base, '/does-not-exist.html');
    assert.strictEqual(result.response.status, 404);

    // Use a percent-encoded traversal so the fetch client doesn't collapse
    // the ".." itself before the request ever reaches the server — this
    // exercises the server's own safeFile() containment, not the URL parser.
    result = await request(base, '/%2e%2e/game.manifest.json');
    assert.notStrictEqual(result.response.status, 200, 'path traversal must not escape the runtime/ dir');

    // Phone input relay: this is the seam Game Hub's QR/lobby join redirects
    // a joined phone's controller.html into.
    result = await request(base, '/api/input');
    assert.strictEqual(result.response.status, 200);
    assert.deepStrictEqual(result.value.inputs, {}, 'no phone has posted yet');

    result = await request(base, '/api/input', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ player: 'p2', moveX: 1, moveY: -1, action: true, actionEdge: true })
    });
    assert.strictEqual(result.response.status, 200);

    result = await request(base, '/api/input');
    assert.strictEqual(result.response.status, 200);
    assert.strictEqual(result.value.inputs.p2.moveX, 1);
    assert.strictEqual(result.value.inputs.p2.moveY, -1);
    assert.strictEqual(result.value.inputs.p2.action, true);
    assert.strictEqual(result.value.phoneStatus.p2, 'fresh', 'a seat that just posted should read as fresh');
    assert.strictEqual(result.value.phoneStatus.p1, undefined, 'a seat that never posted should be absent, not "disconnected"');

    // A seat that posted once and then goes quiet past the TTL must be
    // reported as 'disconnected' (not silently dropped from phoneStatus
    // the way it already correctly drops from `inputs`) — this is the
    // signal the shared-screen client uses to show a real "P2 lost
    // connection" toast instead of a teammate just mysteriously freezing.
    await new Promise(resolve => setTimeout(resolve, 450));
    result = await request(base, '/api/input');
    assert.strictEqual(result.response.status, 200);
    assert.strictEqual(result.value.inputs.p2, undefined, 'a stale phone must not appear in inputs (unchanged behavior)');
    assert.strictEqual(result.value.phoneStatus.p2, 'disconnected', 'but it must still be reported as disconnected, not absent');

    result = await request(base, '/api/input', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ player: 'not-a-seat', moveX: 1, moveY: 0, action: false, actionEdge: false })
    });
    assert.strictEqual(result.response.status, 400, 'an unknown seat id must be rejected');

    // AI-native adapter seat interface: an external agent should be able to
    // see the running session (GET /api/adapter-observation) even before
    // anyone has pushed anything, and after the shared-screen tab starts
    // pushing via POST /api/state.
    result = await request(base, '/api/adapter-observation');
    assert.strictEqual(result.response.status, 200);
    assert.strictEqual(result.value.sessionActive, false, 'no /api/state push yet means no active session');
    assert.strictEqual(result.value.schema, 'axm.brace-room-observation/v1');

    result = await request(base, '/api/state', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        elapsedMs: 1000, sessionLengthMs: 540000, wave: 1, hull: 95, status: 'running', playerCount: 2,
        players: { p1: { x: 100, y: 100, active: true }, p2: { x: 200, y: 200, active: true } },
        faults: [{ id: 1, stationId: 'engine-bay', verb: 'mash', kind: 'real', effort: 20, effortTarget: 100, ringMs: 7000, remainingMs: 6000 }]
      })
    });
    assert.strictEqual(result.response.status, 200);
    assert.strictEqual(result.value.sequence, 1);

    result = await request(base, '/api/adapter-observation?seat=p2');
    assert.strictEqual(result.response.status, 200);
    assert.strictEqual(result.value.sessionActive, true);
    assert.strictEqual(result.value.hull, 95);
    assert.strictEqual(result.value.faults.length, 1);
    assert.strictEqual(result.value.seat.id, 'p2');
    assert.strictEqual(result.value.seat.x, 200, 'the seat convenience field should mirror that player\'s own position');

    result = await request(base, '/api/adapter-observation?seat=not-a-seat');
    assert.strictEqual(result.response.status, 400, 'an unknown seat id must be rejected on the observation channel too');

    console.log('  PASS  server-http.test.js (25 checks)');
  } finally {
    server.close();
  }
}

main().catch(err => {
  console.error('  FAIL  server-http.test.js');
  console.error(err);
  process.exit(1);
});
