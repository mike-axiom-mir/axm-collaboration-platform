#!/usr/bin/env node
'use strict';

const assert = require('assert');
const http = require('http');
const { performance } = require('perf_hooks');
const { createRuntime } = require('../runtime/server');

const ROTATIONS = 12;
const ROTATION_MS = 150000;
const STEP_MS = 40;
const INPUT_EVERY_MS = 1000;
const RESUME_EVERY_MS = 30000;
const SESSION_ID = 'reliability-soak-p1-session';

function request(agent, port, pathname, options) {
  const settings = options || {};
  return new Promise((resolve, reject) => {
    const payload = settings.body == null ? null : JSON.stringify(settings.body);
    const req = http.request({
      agent,
      host: '127.0.0.1', port, path: pathname, method: settings.method || 'GET',
      headers: payload ? { 'content-type': 'application/json', 'content-length': Buffer.byteLength(payload) } : {}
    }, response => {
      let body = '';
      response.on('data', chunk => { body += chunk; });
      response.on('end', () => resolve({ status: response.statusCode, body: body ? JSON.parse(body) : {} }));
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

(async function () {
  let now = 100000;
  let sequence = 1;
  let actionCount = 0;
  let resumeCount = 0;
  let rttReportCount = 0;
  let resultStates = 0;
  const heapStart = process.memoryUsage().heapUsed;
  const runtime = createRuntime({
    manualTick: true,
    clock: () => now,
    roster: [
      { id: 'p1', seatId: 'seat_1', displayName: 'Mike', type: 'human' },
      { id: 'p2', seatId: 'seat_2', displayName: 'Axiom/Mir', type: 'ai' },
      { id: 'p3', seatId: 'seat_3', displayName: 'Codex', type: 'ai' },
      { id: 'p4', seatId: 'seat_4', displayName: 'Mirror', type: 'ai' }
    ],
    env: { MIRRORSHIFT_SEED: '260728' }
  });
  await new Promise(resolve => runtime.server.listen(0, '127.0.0.1', resolve));
  const port = runtime.server.address().port;
  const agent = new http.Agent({ keepAlive: true, maxSockets: 4 });
  try {
    for (let rotation = 0; rotation < ROTATIONS; rotation += 1) {
      const mode = rotation % 4 === 3 ? 'battle' : 'race';
      const trackId = ['mirror-forge', 'splitglass-gardens', 'null-foundry'][rotation % 3];
      const reset = await request(agent, port, '/api/reset', { method: 'POST', body: { mode, trackId } });
      assert.equal(reset.status, 200);
      assert.equal(reset.body.state.mode, mode);
      assert.equal(reset.body.state.trackId, trackId);

      const joined = await request(agent, port, '/api/session', { method: 'POST', body: { player: 'p1', sessionId: SESSION_ID } });
      assert.equal(joined.status, 200);
      if (rotation === 0) assert.equal(joined.body.session.resumed, false);
      else { assert.equal(joined.body.session.resumed, true); resumeCount += 1; }
      sequence = Math.max(sequence, joined.body.session.nextSeq);

      if (rotation === 0) {
        const assist = await request(agent, port, '/api/assist', { method: 'POST', body: { player: 'p1', assists: { autoAccelerate: true, steering: true } } });
        assert.equal(assist.status, 200);
      }
      const start = await request(agent, port, '/api/start', { method: 'POST' });
      assert.equal(start.status, 200);

      for (let elapsed = STEP_MS; elapsed <= ROTATION_MS; elapsed += STEP_MS) {
        now += STEP_MS;
        runtime.advance(now);
        if (elapsed % RESUME_EVERY_MS === 0 && elapsed < ROTATION_MS) {
          const resumed = await request(agent, port, '/api/session', { method: 'POST', body: { player: 'p1', sessionId: SESSION_ID } });
          assert.equal(resumed.status, 200);
          assert.equal(resumed.body.session.resumed, true);
          assert.equal(resumed.body.session.nextSeq, sequence);
          resumeCount += 1;
        }
        if (elapsed % INPUT_EVERY_MS !== 0) continue;
        const requestId = 'rotation-' + rotation + '-action-' + actionCount;
        const sentAt = performance.now();
        const action = await request(agent, port, '/api/action', { method: 'POST', body: {
          player: 'p1', sessionId: SESSION_ID, requestId,
          action: { type: 'drive', throttle: 1, brake: rotation % 3 === 2 ? .08 : 0, steer: Math.sin(elapsed / 3400) * .42, seq: sequence }
        } });
        const rttMs = performance.now() - sentAt;
        assert.equal(action.status, 200);
        assert.equal(action.body.receipt.accepted, true);
        assert.equal(action.body.receipt.sequence, sequence);
        sequence += 1;
        actionCount += 1;
        if (actionCount % 10 === 0) {
          const report = await request(agent, port, '/api/client-telemetry', { method: 'POST', body: {
            player: 'p1', sessionId: SESSION_ID, requestId, rttMs
          } });
          assert.equal(report.status, 200);
          rttReportCount += 1;
        }
      }
      const state = (await request(agent, port, '/api/state')).body.state;
      assert(['racing', 'results'].includes(state.phase));
      if (state.phase === 'results') resultStates += 1;
      assert.equal(Object.keys(state.racers).length, 4);
    }

    const telemetry = (await request(agent, port, '/api/telemetry')).body;
    const session = telemetry.transport.sessions.find(item => item.player === 'p1');
    const heapEnd = process.memoryUsage().heapUsed;
    assert.equal(telemetry.ok, true);
    assert.equal(telemetry.transport.sessionCount, 1);
    assert.equal(telemetry.transport.resumeCount, resumeCount);
    assert.equal(session.acceptedActions, actionCount);
    assert.equal(session.rejectedActions, 0);
    assert.equal(session.nextSeq, sequence);
    assert(rttReportCount >= 100);
    assert(telemetry.transport.clientReportedRoundTripMs.sampleCount > 0);
    assert(telemetry.tickMs.p95 <= telemetry.tickMs.budget);
    assert(heapEnd - heapStart < 96 * 1024 * 1024);

    console.log('MIRRORSHIFT RELIABILITY SOAK PASS · ' + (ROTATIONS * ROTATION_MS / 60000) + ' virtual minutes · ' + ROTATIONS + ' rotations · ' + actionCount + ' acknowledged actions · ' + resumeCount + ' resumes · ' + resultStates + ' settled results · heap delta ' + Math.round((heapEnd - heapStart) / 1024 / 1024 * 10) / 10 + 'MB');
  } finally {
    agent.destroy();
    await new Promise(resolve => runtime.server.close(resolve));
  }
})().catch(error => {
  console.error(error.stack);
  process.exitCode = 1;
});
