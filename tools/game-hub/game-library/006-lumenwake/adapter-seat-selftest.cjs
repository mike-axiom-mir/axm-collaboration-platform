#!/usr/bin/env node
'use strict';

const assert = require('assert');
const path = require('path');
const { spawn } = require('child_process');
const Core = require('./runtime/lumenwake-core.cjs');
const SeatInterface = require('./runtime/seat-interface.cjs');

const runtime = path.join(__dirname, 'runtime');
const serverFile = path.join(runtime, 'lumenwake-server.cjs');
const port = 18961;
const roster = [
  { seat_id: 'seat_1', display_name: 'HUMAN', type: 'human' },
  { seat_id: 'seat_2', display_name: 'NOVA', type: 'adapter', adapter_id: 'nova-local' },
  { seat_id: 'seat_3', display_name: 'AURORA BOT', type: 'ai' }
];

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function collectKeys(value, keys = new Set()) {
  if (!value || typeof value !== 'object') return keys;
  if (Array.isArray(value)) value.forEach(item => collectKeys(item, keys));
  else Object.entries(value).forEach(([key, item]) => { keys.add(key); collectKeys(item, keys); });
  return keys;
}

async function rawRequest(route, body, headers = {}) {
  const response = await fetch(`http://127.0.0.1:${port}${route}`, body === undefined ? { headers } : {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body)
  });
  const json = await response.json();
  return { response, status: response.status, json };
}

async function request(route, body, headers) {
  const result = await rawRequest(route, body, headers);
  if (!result.response.ok) throw new Error(`${route}: ${result.json.error || result.json.reason || result.status}`);
  return result.json;
}

async function waitForHealth() {
  const until = Date.now() + 6000;
  while (Date.now() < until) {
    try { return await request('/health'); }
    catch (error) { await new Promise(resolve => setTimeout(resolve, 80)); }
  }
  throw new Error(`server on ${port} did not become healthy`);
}

assert.equal(SeatInterface.INPUT_PROTOCOL, 'axm-semantic-input-v1');
assert.equal(SeatInterface.OBSERVATION_PROTOCOL, 'axm-seat-screen-semantics-v1');
assert.equal(SeatInterface.sanitizeIntent({ moveX: 2 }).reason, 'moveX-out-of-range');
assert.equal(SeatInterface.sanitizeIntent({ charge: 999 }).reason, 'machine-or-outcome-action-rejected');

const coreGame = Core.create(roster, 1000, { seed: 11 });
assert.equal(coreGame.players.p1.kind, 'human');
assert.equal(coreGame.players.p2.kind, 'adapter', 'Core preserves an external adapter seat');
assert.equal(coreGame.players.p3.kind, 'ai', 'Core preserves a built-in AI seat');
Core.start(coreGame, 1000);
Core.step(coreGame, {}, 0.05, 4600);
const coreAdapterStart = { ...coreGame.players.p2 };
Core.step(coreGame, { p2: { moveX: 1, updatedAt: 4650 } }, 0.05, 4650);
assert.ok(distance(coreAdapterStart, coreGame.players.p2) > 0.01, 'Core applies adapter semantic input without invoking AI');

(async () => {
  const child = spawn(process.execPath, [serverFile], {
    cwd: runtime,
    env: { ...process.env, AXM_LUMEN_HOST: '127.0.0.1', AXM_PLAYERS_JSON: JSON.stringify(roster), PORT: String(port) },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let output = '';
  child.stdout.on('data', chunk => { output += chunk; });
  child.stderr.on('data', chunk => { output += chunk; });

  try {
    let state = await waitForHealth();
    assert.equal(state.version, '0.3.1-semantic-seat');
    assert.equal(state.players.p1.kind, 'human');
    assert.equal(state.players.p2.kind, 'adapter');
    assert.equal(state.players.p3.kind, 'ai');

    const bootstrap = await request('/api/host/bootstrap');
    const adapter = bootstrap.launch.adapterBindings.find(binding => binding.seatId === 'seat_2');
    assert.ok(adapter && adapter.token, 'loopback host bootstrap issues an ephemeral adapter capability');
    assert.equal(adapter.adapterId, 'nova-local');
    assert.equal(adapter.protocol, SeatInterface.INPUT_PROTOCOL);
    assert.equal(adapter.observation, SeatInterface.OBSERVATION_PROTOCOL);
    const bootstrapKeys = collectKeys(bootstrap);
    assert.equal(bootstrapKeys.has('rateWindow'), false);
    assert.equal(bootstrapKeys.has('consent'), false);

    assert.equal(JSON.stringify(state).includes(adapter.token), false, 'public state does not expose adapter capabilities');
    const adapterBeforeStart = { ...state.players.p2 };
    await request('/start', {});
    await new Promise(resolve => setTimeout(resolve, 3800));
    state = await request('/state');
    assert.equal(state.phase, 'running');
    assert.ok(distance(adapterBeforeStart, state.players.p2) < 0.001, 'an idle adapter does not impersonate built-in AI');

    const wrongObservation = await rawRequest('/api/adapter-observation?room=AXM1&seat=seat_2', undefined, { 'x-axm-seat-token': 'wrong' });
    assert.equal(wrongObservation.status, 403);
    assert.equal(wrongObservation.json.reason, 'seat-token-rejected');
    const wrongRoomObservation = await rawRequest('/api/adapter-observation?room=OTHER&seat=seat_2', undefined, { 'x-axm-seat-token': adapter.token });
    assert.equal(wrongRoomObservation.status, 409);
    assert.equal(wrongRoomObservation.json.reason, 'room-binding-rejected');

    let observation = await request('/api/adapter-observation?room=AXM1&seat=seat_2', undefined, { 'x-axm-seat-token': adapter.token });
    assert.equal(observation.scope, 'seat-and-shared-screen-visible-only');
    assert.equal(observation.profile, 'axm.lumenwake-adapter-observation/v1');
    assert.equal(observation.self.seatId, 'seat_2');
    assert.equal(observation.visible.players.length, 3);
    assert.equal(observation.controls.nextSequenceMinimum, 0);
    const observationKeys = collectKeys(observation);
    for (const forbidden of ['token', 'adapterId', 'seed', 'nextId', 'nextShardAt', 'nextEnemyAt', 'timeline', 'inputs', 'rateWindow']) {
      assert.equal(observationKeys.has(forbidden), false, `adapter observation excludes ${forbidden}`);
    }

    const wrongToken = await rawRequest('/api/input', { roomCode: 'AXM1', seatId: 'seat_2', token: 'wrong', sequence: 0, intent: { moveX: 1 } });
    assert.equal(wrongToken.status, 403);
    assert.equal(wrongToken.json.reason, 'seat-token-rejected');
    const crossSeat = await rawRequest('/api/input', { roomCode: 'AXM1', seatId: 'seat_1', token: adapter.token, sequence: 0, intent: { moveX: 1 } });
    assert.equal(crossSeat.status, 403);
    assert.equal(crossSeat.json.reason, 'adapter-seat-required');
    const aiSeat = await rawRequest('/api/input', { roomCode: 'AXM1', seatId: 'seat_3', token: adapter.token, sequence: 0, intent: { moveX: 1 } });
    assert.equal(aiSeat.status, 403);
    assert.equal(aiSeat.json.reason, 'adapter-seat-required');
    const outcomeClaim = await rawRequest('/api/input', { roomCode: 'AXM1', seatId: 'seat_2', token: adapter.token, sequence: 0, intent: { x: 90, charge: 999 } });
    assert.equal(outcomeClaim.status, 400);
    assert.equal(outcomeClaim.json.reason, 'machine-or-outcome-action-rejected');
    const legacyAdapter = await rawRequest('/input?player=p2', { moveX: 1 });
    assert.equal(legacyAdapter.status, 403);
    assert.equal(legacyAdapter.json.reason, 'legacy-controller-human-only');

    state = await request('/state');
    const humanStart = { ...state.players.p1 };
    const adapterStart = { ...state.players.p2 };
    const aiStart = { ...state.players.p3 };
    const semantic = { moveX: 0.7, moveY: -0.2, action: false, dash: false };
    const adapterInput = await request('/api/input', { roomCode: 'AXM1', seatId: 'seat_2', token: adapter.token, sequence: 0, intent: semantic });
    const humanInput = await request('/input?player=p1', semantic);
    assert.equal(adapterInput.gate, SeatInterface.AUTHORITY_GATE);
    assert.equal(humanInput.gate, adapterInput.gate);
    assert.deepEqual(humanInput.sanitized, adapterInput.sanitized, 'human and adapter intentions share one sanitizer and authority gate');
    const replay = await rawRequest('/api/input', { roomCode: 'AXM1', seatId: 'seat_2', token: adapter.token, sequence: 0, intent: semantic });
    assert.equal(replay.status, 409);
    assert.equal(replay.json.reason, 'stale-sequence');

    await new Promise(resolve => setTimeout(resolve, 180));
    state = await request('/state');
    assert.ok(distance(humanStart, state.players.p1) > 0.01, 'human intention moves through authoritative live ticks');
    assert.ok(distance(adapterStart, state.players.p2) > 0.01, 'adapter intention moves through the same authoritative live ticks');
    assert.ok(distance(aiStart, state.players.p3) > 0.01, 'built-in AI remains a separate server-controlled seat');
    observation = await request('/api/adapter-observation?room=AXM1&seat=seat_2', undefined, { 'x-axm-seat-token': adapter.token });
    assert.equal(observation.controls.nextSequenceMinimum, 1);
  } catch (error) {
    error.message += `\n${output}`;
    throw error;
  } finally {
    child.kill('SIGTERM');
    await Promise.race([new Promise(resolve => child.once('exit', resolve)), new Promise(resolve => setTimeout(resolve, 1200))]);
  }

  console.log('PASS Lumenwake semantic adapter seat selftest');
})().catch(error => { console.error(error.stack || error.message); process.exitCode = 1; });
