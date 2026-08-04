'use strict';

const assert = require('assert');
const path = require('path');
const { spawn } = require('child_process');

const runtime = path.join(__dirname, 'runtime');
const serverFile = path.join(runtime, 'neon-pong-cross-server.cjs');

async function rawRequest(port, route, body, headers) {
  const response = await fetch(`http://127.0.0.1:${port}${route}`, body === undefined ? { headers: headers || {} } : {
    method: 'POST', headers: { 'content-type': 'application/json', ...(headers || {}) }, body: JSON.stringify(body)
  });
  const json = await response.json();
  return { ok: response.ok, status: response.status, json };
}
async function request(port, route, body, headers) {
  const response = await rawRequest(port, route, body, headers);
  if (!response.ok) throw new Error(`${route}: ${response.json.error || response.json.reason || response.status}`);
  return response.json;
}

async function waitForHealth(port) {
  const until = Date.now() + 6000;
  while (Date.now() < until) {
    try { return await request(port, '/health'); } catch (error) { await new Promise(resolve => setTimeout(resolve, 80)); }
  }
  throw new Error(`server on ${port} did not become healthy`);
}

async function withServer(port, mode, roster, run, extraEnv) {
  const child = spawn(process.execPath, [serverFile], {
    cwd: runtime,
    env: { ...process.env, ...(extraEnv || {}), PORT: String(port), AXM_GAME_PLAY_MODE: mode, AXM_PLAYERS_JSON: JSON.stringify(roster), AXM_TEST_MODE: '1' },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let output = '';
  child.stdout.on('data', chunk => { output += chunk; });
  child.stderr.on('data', chunk => { output += chunk; });
  try { await waitForHealth(port); await run(); }
  catch (error) { error.message += `\n${output}`; throw error; }
  finally {
    child.kill('SIGTERM');
    await Promise.race([new Promise(resolve => child.once('exit', resolve)), new Promise(resolve => setTimeout(resolve, 1200))]);
  }
}

const three = [
  { seat: 'p1', display_name: 'ALPHA', type: 'human', controller_id: 'p1' },
  { seat: 'p2', display_name: 'BETA', type: 'human', controller_id: 'p2' },
  { seat: 'p3', display_name: 'GAMMA', type: 'human', controller_id: 'p3' }
];

(async () => {
  await withServer(18944, 'cross_coop', three, async () => {
    const health = await request(18944, '/health');
    assert.equal(health.playMode, 'coop');
    assert.equal(health.seatCount, 3);
    let state = await request(18944, '/state');
    assert.equal(state.players.p4.role, 'warden');
    assert.equal(state.players.p4.kind, 'ai', 'the three-seat Warden is game-local AI, never an external adapter');
    assert.equal(state.arenas.length, 3);
    await request(18944, '/start', {});
    await request(18944, '/input?player=p1', { left: false, right: false, power: true });
    state = await request(18944, '/state');
    assert.ok(state.power.p1.readyIn > 6000, 'phone power input starts its cooldown');
    await request(18944, '/test/set', { phase: 'running', mission: { boss: 1, relayArmed: true }, ball: { x: 500, y: 500, vx: 220, vy: 180, serveAt: 0 } });
    await new Promise(resolve => setTimeout(resolve, 120));
    state = await request(18944, '/state');
    assert.equal(state.phase, 'gameover');
    assert.equal(state.winner, 'relay');
  });

  await withServer(18945, 'cross_versus', three, async () => {
    const state = await request(18945, '/state');
    assert.equal(state.playMode, 'versus');
    assert.equal(state.seatCount, 3);
    assert.equal(state.players.p4.participant, false);
    assert.equal(state.players.p4.alive, false);
    assert.equal(state.balls.length, 1);
  });

  await withServer(18946, 'cross_versus', [...three, { seat: 'p4', display_name: 'DELTA', type: 'human', controller_id: 'p4' }], async () => {
    await request(18946, '/start', {});
    for (const miss of [
      { id: 'p2', ball: { x: 500, y: -60, vx: 0, vy: -500, serveAt: 0 } },
      { id: 'p3', ball: { x: -60, y: 500, vx: -500, vy: 0, serveAt: 0 } },
      { id: 'p4', ball: { x: 1060, y: 500, vx: 500, vy: 0, serveAt: 0 } }
    ]) {
      await request(18946, '/test/set', { phase: 'running', lives: { [miss.id]: 1 }, ball: miss.ball });
      await new Promise(resolve => setTimeout(resolve, 120));
    }
    const state = await request(18946, '/state');
    assert.equal(state.seatCount, 4);
    assert.equal(state.phase, 'gameover');
    assert.equal(state.winner, 'p1');
  });

  await withServer(18947, 'cross_versus', three, async () => {
    await request(18947, '/start', {});
    let state = await request(18947, '/state');
    const startX = state.paddles.p1.x;
    await request(18947, '/input?player=p1', { left: false, right: true });
    await new Promise(resolve => setTimeout(resolve, 90));
    state = await request(18947, '/state');
    assert.equal(state.players.p1.controllerConnected, true, 'accepted controller input marks the seat connected');
    assert.ok(state.paddles.p1.x > startX, 'fresh held input moves the paddle');
    await new Promise(resolve => setTimeout(resolve, 170));
    state = await request(18947, '/state');
    assert.equal(state.players.p1.controllerConnected, false, 'expired controller lease becomes visibly disconnected');
    const expiredX = state.paddles.p1.x;
    await new Promise(resolve => setTimeout(resolve, 90));
    state = await request(18947, '/state');
    assert.ok(Math.abs(state.paddles.p1.x - expiredX) < 2, 'disconnect clears held movement instead of leaving a ghost input');
    const reconnectTick = state.tick;
    await request(18947, '/input?player=p1', { left: true, right: false });
    await new Promise(resolve => setTimeout(resolve, 90));
    state = await request(18947, '/state');
    assert.equal(state.players.p1.controllerConnected, true, 'the same seat reconnects on its next valid input');
    assert.ok(state.paddles.p1.x < expiredX, 'reconnected input resumes control without resetting the match');
    assert.ok(state.tick > reconnectTick && state.phase === 'running', 'authoritative match state continues across the reconnect');
  }, { AXM_CONTROLLER_DISCONNECT_MS: '140' });

  const mixed = [
    { seat_id: 'seat_1', slot: 1, display_name: 'HUMAN', type: 'human' },
    { seat_id: 'seat_2', slot: 2, display_name: 'NOVA', type: 'adapter', adapter_id: 'nova-local' },
    { seat_id: 'seat_3', slot: 3, display_name: 'HOST AI', type: 'ai' }
  ];
  await withServer(18948, 'cross_versus', mixed, async () => {
    const bootstrap = await request(18948, '/api/host/bootstrap');
    const adapter = bootstrap.launch.adapterBindings.find(binding => binding.seatId === 'seat_2');
    assert.ok(adapter && adapter.token, 'host-local bootstrap issues the adapter capability');
    assert.equal(adapter.protocol, 'axm-semantic-input-v1');
    assert.equal(adapter.observation, 'axm-seat-screen-semantics-v1');
    assert.ok(bootstrap.launch.controllers[0].url.includes('#seat=seat_1&token='), 'human controller capability stays in the URL fragment');

    let state = await request(18948, '/state');
    assert.equal(state.players.p1.kind, 'human');
    assert.equal(state.players.p2.kind, 'adapter');
    assert.equal(state.players.p3.kind, 'ai');
    assert.equal(JSON.stringify(state).includes(adapter.token), false, 'public match state never exposes seat capabilities');
    await request(18948, '/start', {});
    await request(18948, '/test/set', { phase: 'running', ball: { x: 800, y: 800, vx: 0, vy: 0, serveAt: 0 } });
    await new Promise(resolve => setTimeout(resolve, 100));
    state = await request(18948, '/state');
    assert.ok(Math.abs(state.paddles.p2.x - 500) < 2, 'an unconnected adapter stays still instead of running Host AI');
    assert.ok(state.paddles.p3.y > 500, 'the deliberately selected Host AI remains server-controlled');

    const wrongObservation = await rawRequest(18948, '/api/adapter-observation?room=AXM1&seat=seat_2', undefined, { 'x-axm-seat-token': 'wrong' });
    assert.equal(wrongObservation.status, 403);
    assert.equal(wrongObservation.json.reason, 'seat-token-rejected');
    let observation = await request(18948, '/api/adapter-observation?room=AXM1&seat=seat_2', undefined, { 'x-axm-seat-token': adapter.token });
    assert.equal(observation.scope, 'shared-arena-visible-only');
    assert.equal(observation.self.seatId, 'seat_2');
    assert.equal(observation.controls.nextSequenceMinimum, 0);
    const serialized = JSON.stringify(observation);
    assert.equal(serialized.includes(adapter.token), false);
    assert.equal(serialized.includes('lastSeenAt'), false);
    assert.equal(serialized.includes('rateWindow'), false);
    assert.equal(serialized.includes('"inputs"'), false);

    const wrongToken = await rawRequest(18948, '/api/input', { roomCode: 'AXM1', seatId: 'seat_2', token: 'wrong', sequence: 0, intent: { axis: 1 } });
    assert.equal(wrongToken.status, 403);
    assert.equal(wrongToken.json.reason, 'seat-token-rejected');
    const outcomeClaim = await rawRequest(18948, '/api/input', { roomCode: 'AXM1', seatId: 'seat_2', token: adapter.token, sequence: 0, intent: { winner: 'seat_2' } });
    assert.equal(outcomeClaim.status, 400);
    assert.equal(outcomeClaim.json.reason, 'machine-or-outcome-action-rejected');
    const hostAiInput = await rawRequest(18948, '/api/input', { roomCode: 'AXM1', seatId: 'seat_3', token: 'not-issued', sequence: 0, intent: { axis: 1 } });
    assert.equal(hostAiInput.status, 403);
    assert.equal(hostAiInput.json.reason, 'seat-cannot-send-input');

    const adapterInput = await request(18948, '/api/input', { roomCode: 'AXM1', seatId: 'seat_2', token: adapter.token, sequence: 0, intent: { axis: 1, power: false } });
    const humanInput = await request(18948, '/input?player=p1', { left: false, right: true, power: false });
    assert.equal(adapterInput.gate, 'cross-seat-authority-v1');
    assert.equal(humanInput.gate, adapterInput.gate);
    assert.deepEqual(humanInput.sanitized, adapterInput.sanitized, 'human and adapter intentions share one sanitizer and authority gate');
    const replay = await rawRequest(18948, '/api/input', { roomCode: 'AXM1', seatId: 'seat_2', token: adapter.token, sequence: 0, intent: { axis: 1 } });
    assert.equal(replay.status, 409);
    assert.equal(replay.json.reason, 'stale-sequence');
    await new Promise(resolve => setTimeout(resolve, 90));
    state = await request(18948, '/state');
    assert.ok(state.paddles.p2.x > 500, 'accepted adapter intent moves its authoritative paddle');
    assert.equal(state.players.p2.controllerConnected, true);
    observation = await request(18948, '/api/adapter-observation?room=AXM1&seat=seat_2', undefined, { 'x-axm-seat-token': adapter.token });
    assert.equal(observation.controls.nextSequenceMinimum, 1);
  });

  console.log('PASS AXM Pong: Cross selftest');
})().catch(error => { console.error(error.stack || error.message); process.exitCode = 1; });
