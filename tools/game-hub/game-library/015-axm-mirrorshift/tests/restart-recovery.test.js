#!/usr/bin/env node
'use strict';

const assert = require('assert');
const http = require('http');
const { createRuntime } = require('../runtime/server');

const SESSION_ID = 'restart-recovery-p1-session';
let stage = 'boot';

function request(port, pathname, body) {
  return new Promise((resolve, reject) => {
    const payload = body == null ? null : JSON.stringify(body);
    const req = http.request({
      agent: false,
      host: '127.0.0.1', port, path: pathname, method: body == null ? 'GET' : 'POST',
      headers: payload ? { 'content-type': 'application/json', 'content-length': Buffer.byteLength(payload), connection: 'close' } : { connection: 'close' }
    }, response => {
      let text = '';
      response.on('error', error => { error.message += ' at ' + pathname; reject(error); });
      response.on('data', chunk => { text += chunk; });
      response.on('end', () => resolve({ status: response.statusCode, body: JSON.parse(text) }));
    });
    req.on('error', error => { error.message += ' at ' + pathname; reject(error); });
    if (payload) req.write(payload);
    req.end();
  });
}

function runtimeAt(nowRef) {
  return createRuntime({
    manualTick: true,
    clock: () => nowRef.value,
    roster: [
      { id: 'p1', seatId: 'seat_1', displayName: 'Mike', type: 'human' },
      { id: 'p2', seatId: 'seat_2', displayName: 'Axiom/Mir', type: 'ai' },
      { id: 'p3', seatId: 'seat_3', displayName: 'Codex', type: 'ai' },
      { id: 'p4', seatId: 'seat_4', displayName: 'Mirror', type: 'ai' }
    ],
    env: { MIRRORSHIFT_SEED: '270728' }
  });
}

(async function () {
  const nowRef = { value: 1000 };
  let runtime = runtimeAt(nowRef);
  await new Promise(resolve => runtime.server.listen(0, '127.0.0.1', resolve));
  const port = runtime.server.address().port;
  try {
    stage = 'first join';
    const firstJoin = await request(port, '/api/session', { player: 'p1', sessionId: SESSION_ID });
    assert.equal(firstJoin.status, 200);
    assert.equal(firstJoin.body.session.resumed, false);
    stage = 'first action';
    const firstAction = await request(port, '/api/action', {
      player: 'p1', sessionId: SESSION_ID, requestId: 'before-restart',
      action: { type: 'drive', throttle: 1, steer: .2, seq: 1 }
    });
    assert.equal(firstAction.status, 200);
    assert.equal(firstAction.body.receipt.nextSeq, 2);

    stage = 'first close';
    await new Promise(resolve => runtime.server.close(resolve));
    nowRef.value += 5000;
    runtime = runtimeAt(nowRef);
    stage = 'replacement listen';
    await new Promise(resolve => runtime.server.listen(port, '127.0.0.1', resolve));

    stage = 'pre-handshake rejection';
    const preHandshake = await request(port, '/api/action', {
      player: 'p1', sessionId: SESSION_ID, requestId: 'rejected-before-handshake',
      action: { type: 'drive', throttle: 1, steer: -.2, seq: 2 }
    });
    assert.equal(preHandshake.status, 409);
    assert.equal(preHandshake.body.error, 'session-required');

    stage = 'replacement join';
    const replacementJoin = await request(port, '/api/session', { player: 'p1', sessionId: SESSION_ID });
    assert.equal(replacementJoin.status, 200);
    assert.equal(replacementJoin.body.session.resumed, false);
    assert.equal(replacementJoin.body.session.nextSeq, 1);
    const clientNextSeq = Math.max(2, replacementJoin.body.session.nextSeq);
    stage = 'recovered action';
    const recoveredAction = await request(port, '/api/action', {
      player: 'p1', sessionId: SESSION_ID, requestId: 'after-restart',
      action: { type: 'drive', throttle: .8, steer: -.2, seq: clientNextSeq }
    });
    assert.equal(recoveredAction.status, 200);
    assert.equal(recoveredAction.body.receipt.sequence, 2);
    assert.equal(recoveredAction.body.receipt.nextSeq, 3);

    stage = 'observation';
    const observation = await request(port, '/api/observe?player=p1');
    assert.equal(observation.body.observation.self.character, 'Mike');
    assert.equal(observation.body.observation.phase, 'lobby');
    stage = 'telemetry';
    const telemetry = await request(port, '/api/telemetry');
    assert.equal(telemetry.body.transport.sessions[0].acceptedActions, 1);
    assert.equal(telemetry.body.transport.sessions[0].nextSeq, 3);
    console.log('MIRRORSHIFT RESTART RECOVERY PASS · stable p1 identity · session-required rejection · handshake resync · seq 2 acknowledged · match-state persistence intentionally not claimed');
  } finally {
    if (runtime.server.listening) await new Promise(resolve => runtime.server.close(resolve));
  }
})().catch(error => {
  console.error('stage=' + stage + '\n' + error.stack);
  process.exitCode = 1;
});
