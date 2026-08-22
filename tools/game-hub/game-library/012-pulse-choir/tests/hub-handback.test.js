#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');
const runtimeModule = require('../runtime/server');

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function listen(server) {
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  return server.address().port;
}

async function close(server) {
  if (!server || !server.listening) return;
  await new Promise(resolve => server.close(resolve));
}

async function request(base, pathname, options) {
  const response = await fetch(base + pathname, options);
  return { response, value: await response.json() };
}

async function main() {
  let resolveCallback;
  let rejectCallback;
  const callbackReceived = new Promise((resolve, reject) => {
    resolveCallback = resolve;
    rejectCallback = reject;
  });
  const callbackServer = http.createServer((request, response) => {
    let body = '';
    request.on('data', chunk => { body += chunk; });
    request.on('end', () => {
      try {
        const value = JSON.parse(body);
        response.writeHead(200, { 'content-type': 'application/json' });
        response.end(JSON.stringify({ ok: true }));
        resolveCallback({ method: request.method, url: request.url, value });
      } catch (error) {
        response.writeHead(400).end();
        rejectCallback(error);
      }
    });
  });
  const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'pulse-choir-handback-test-'));
  const stateFile = path.join(temporaryDirectory, 'checkpoint.json');
  let runtime;
  let freshRuntime;
  try {
    const callbackPort = await listen(callbackServer);
    let now = 1000;
    const env = {
      AXM_MANAGED_BY_GAME_HUB: '1',
      AXM_GAME_HUB_CALLBACK_URL: 'http://127.0.0.1:' + callbackPort,
      AXM_GAME_SESSION_ID: 'session-handback-test',
      PULSE_CHOIR_SEED: '12026'
    };
    runtime = runtimeModule.createRuntime({
      roster: [{ slot: 1, seatId: 'seat_1', name: 'Handback Player', type: 'human' }],
      clock: () => now,
      manualTick: true,
      env,
      checkpoint: { filePath: stateFile, saveIntervalMs: 1 }
    });
    const port = await listen(runtime.server);
    const base = 'http://127.0.0.1:' + port;

    let result = await request(base, '/health');
    assert.equal(result.value.handback.available, true);
    assert.equal(result.value.handback.status, 'ready');
    result = await request(base, '/api/finish-show', { method: 'POST' });
    assert.equal(result.response.status, 409);
    assert.equal(result.value.reason, 'no-completed-show');

    result = await request(base, '/api/start', { method: 'POST' });
    assert.equal(result.response.status, 200);
    now += 3000;
    runtime.advance(now);
    now += 75000;
    runtime.advance(now);
    const completed = runtime.getState();
    assert.equal(completed.phase, 'results');
    assert.equal(completed.show.completedRounds, 1);
    assert(fs.existsSync(stateFile));

    result = await request(base, '/api/finish-show', { method: 'POST' });
    assert.equal(result.response.status, 200);
    assert.equal(result.value.handback.status, 'scheduled');
    assert.equal(result.value.summary.schema, 'axm.pulse-choir-show-result/v1');
    assert.equal(result.value.summary.sessionId, 'session-handback-test');
    assert.equal(result.value.summary.completedRounds, 1);
    assert.equal(result.value.summary.nightTotal, completed.show.totalScore);
    assert.equal(result.value.summary.lastRound.seed, completed.seed);
    assert.equal(result.value.summary.lastRound.perfectSurges, completed.perfectSurges);
    assert.equal(result.value.summary.next.conductor.mode, 'reconnect');
    assert.equal(result.value.summary.next.conductor.cue, 'CLEARER HUMAN LINK');
    assert.equal(fs.existsSync(stateFile), false);

    const callback = await Promise.race([
      callbackReceived,
      delay(2500).then(() => { throw new Error('Game Hub callback was not received'); })
    ]);
    assert.equal(callback.method, 'POST');
    assert.equal(callback.url, '/game/end');
    assert.equal(callback.value.confirmed_finish, true);
    assert.equal(callback.value.reflect, false);
    assert.equal(callback.value.summary.source, '012-pulse-choir');
    assert.equal(callback.value.summary.completedRounds, 1);
    assert.equal(callback.value.summary.sessionId, 'session-handback-test');
    assert.equal(callback.value.summary.next.conductor.schema, 'axm.pulse-choir-conductor-plan/v1');

    result = await request(base, '/api/finish-show', { method: 'POST' });
    assert.equal(result.response.status, 409);
    assert(/^handback-already-(?:scheduled|sent)$/.test(result.value.reason));
    await close(runtime.server);
    runtime = null;
    assert.equal(fs.existsSync(stateFile), false);

    freshRuntime = runtimeModule.createRuntime({
      roster: [{ slot: 1, seatId: 'seat_1', name: 'Handback Player', type: 'human' }],
      clock: () => now,
      manualTick: true,
      env: { PULSE_CHOIR_SEED: '12026' },
      checkpoint: { filePath: stateFile, saveIntervalMs: 1 }
    });
    const freshPort = await listen(freshRuntime.server);
    const freshBase = 'http://127.0.0.1:' + freshPort;
    result = await request(freshBase, '/api/state');
    assert.equal(result.value.state.phase, 'lobby');
    assert.equal(result.value.state.show.completedRounds, 0);
    assert.equal(result.value.recovery.status, 'fresh');
    assert.equal(result.value.handback.available, false);
    result = await request(freshBase, '/api/finish-show', { method: 'POST' });
    assert.equal(result.response.status, 409);
    assert.equal(result.value.reason, 'managed-handback-unavailable');

    console.log('Pulse Choir Game Hub handback: PASS (availability, refusal, summary, receiver payload, single send, checkpoint retirement, fresh relaunch)');
  } finally {
    if (runtime) await close(runtime.server).catch(() => {});
    if (freshRuntime) await close(freshRuntime.server).catch(() => {});
    await close(callbackServer).catch(() => {});
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
  }
}

main().catch(error => {
  console.error(error.stack || error.message);
  process.exit(1);
});
