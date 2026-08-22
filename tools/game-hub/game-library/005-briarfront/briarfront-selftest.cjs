#!/usr/bin/env node
'use strict';

const assert = require('assert');
const path = require('path');
const { spawn } = require('child_process');
const SeatInterface = require('./runtime/seat-interface.cjs');

const runtime = path.join(__dirname, 'runtime');
const serverFile = path.join(runtime, 'briarfront-server.cjs');

async function rawRequest(port, route, body, headers = {}) {
  const response = await fetch(`http://127.0.0.1:${port}${route}`, body === undefined ? { headers } : {
    method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body)
  });
  const json = await response.json();
  return { response, status: response.status, json };
}
async function request(port, route, body, headers) {
  const result = await rawRequest(port, route, body, headers);
  if (!result.response.ok) throw new Error(`${route}: ${result.json.error || result.status}`);
  return result.json;
}
async function textRequest(port, route) {
  const response = await fetch(`http://127.0.0.1:${port}${route}`);
  return { status: response.status, contentType: response.headers.get('content-type') || '', body: await response.text() };
}
async function waitForHealth(port) {
  const until = Date.now() + 6000;
  while (Date.now() < until) {
    try { return await request(port, '/health'); }
    catch (error) { await new Promise(resolve => setTimeout(resolve, 80)); }
  }
  throw new Error(`server on ${port} did not become healthy`);
}
async function withServer(port, roster, run) {
  const child = spawn(process.execPath, [serverFile], {
    cwd: runtime,
    env: { ...process.env, PORT: String(port), AXM_PLAYERS_JSON: JSON.stringify(roster || []) },
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
function distance(a, b) { return Math.hypot(a.x - b.x, a.z - b.z); }

assert.equal(SeatInterface.INPUT_PROTOCOL, 'axm-semantic-input-v1');
assert.equal(SeatInterface.OBSERVATION_PROTOCOL, 'axm-seat-screen-semantics-v1');
assert.equal(SeatInterface.sanitizeIntent({ moveX: 2 }).reason, 'moveX-out-of-range');
assert.equal(SeatInterface.sanitizeIntent({ winner: 'west' }).reason, 'machine-or-outcome-action-rejected');

(async () => {
  await withServer(18951, [], async () => {
    const client = await textRequest(18951, '/?player=screen');
    assert.equal(client.status, 200);
    assert.ok(client.body.includes("import(api('/vendor/three.module.js'))"), 'launch client imports the pinned local renderer route');
    assert.equal(/https?:\/\//.test(client.body), false, 'launch client must not depend on an outside network asset');
    assert.equal(/id=["']start["']|class=["'][^"']*\bstart\b/i.test(client.body), false, 'production launch client must not inherit the preserved source start overlay');
    const preservedSource = await textRequest(18951, '/source');
    assert.equal(preservedSource.status, 200);
    assert.match(preservedSource.body, /id=["']start["']/, 'the original source overlay remains preserved only on its separate source route');
    const renderer = await textRequest(18951, '/vendor/three.module.js');
    assert.equal(renderer.status, 200);
    assert.ok(renderer.contentType.startsWith('text/javascript'));
    assert.ok(renderer.body.length > 1000000 && renderer.body.includes('WebGLRenderer'), 'runtime serves a substantive pinned Three.js module');
    let state = await request(18951, '/state');
    assert.equal(Object.keys(state.players).length, 4, 'direct local launch fills the declared 2v2 roster');
    assert.equal(state.players.p1.kind, 'human');
    assert.equal(state.players.p2.kind, 'ai', 'an unassigned teammate is built-in AI, not an external adapter');
    const before = { ...state.players.p2 };
    await new Promise(resolve => setTimeout(resolve, 140));
    state = await request(18951, '/state');
    assert.ok(distance(before, state.players.p2) > 0.01, 'built-in AI moves under server control');
  });

  const mixedRoster = [
    { seat_id: 'seat_1', slot: 1, display_name: 'HUMAN', type: 'human' },
    { seat_id: 'seat_2', slot: 2, display_name: 'NOVA', type: 'adapter', adapter_id: 'nova-local' },
    { seat_id: 'seat_3', slot: 3, display_name: 'GROVE BOT', type: 'ai' },
    { seat_id: 'seat_4', slot: 4, display_name: 'ALLY', type: 'human' }
  ];
  await withServer(18952, mixedRoster, async () => {
    const bootstrap = await request(18952, '/api/host/bootstrap');
    const adapter = bootstrap.launch.adapterBindings.find(binding => binding.seatId === 'seat_2');
    assert.ok(adapter && adapter.token, 'loopback host bootstrap issues the external collaborator capability');
    assert.equal(adapter.protocol, SeatInterface.INPUT_PROTOCOL);
    assert.equal(adapter.observation, SeatInterface.OBSERVATION_PROTOCOL);

    let state = await request(18952, '/state');
    assert.equal(state.players.p2.kind, 'adapter');
    assert.equal(state.players.p3.kind, 'ai');
    assert.equal(JSON.stringify(state).includes(adapter.token), false, 'public state never exposes capability tokens');
    const adapterBefore = { ...state.players.p2 };
    const aiBefore = { ...state.players.p3 };
    await new Promise(resolve => setTimeout(resolve, 140));
    state = await request(18952, '/state');
    assert.ok(distance(adapterBefore, state.players.p2) < 0.001, 'an unconnected adapter stays still instead of impersonating built-in AI');
    assert.ok(distance(aiBefore, state.players.p3) > 0.01, 'the explicitly assigned AI remains server-controlled');

    const wrongObservation = await rawRequest(18952, '/api/adapter-observation?room=AXM1&seat=seat_2', undefined, { 'x-axm-seat-token': 'wrong' });
    assert.equal(wrongObservation.status, 403);
    assert.equal(wrongObservation.json.reason, 'seat-token-rejected');
    let observation = await request(18952, '/api/adapter-observation?room=AXM1&seat=seat_2', undefined, { 'x-axm-seat-token': adapter.token });
    assert.equal(observation.scope, 'seat-and-shared-screen-visible-only');
    assert.equal(observation.self.seatId, 'seat_2');
    assert.equal(observation.visible.players.length, 4);
    assert.equal(observation.controls.nextSequenceMinimum, 0);
    const serialized = JSON.stringify(observation);
    assert.equal(serialized.includes(adapter.token), false);
    assert.equal(serialized.includes('rateWindow'), false);
    assert.equal(serialized.includes('lastSeenAt'), false);
    assert.equal(serialized.includes('adapterConsent'), false);

    const wrongToken = await rawRequest(18952, '/api/input', { roomCode: 'AXM1', seatId: 'seat_2', token: 'wrong', sequence: 0, intent: { moveY: 1 } });
    assert.equal(wrongToken.status, 403);
    assert.equal(wrongToken.json.reason, 'seat-token-rejected');
    const outcomeClaim = await rawRequest(18952, '/api/input', { roomCode: 'AXM1', seatId: 'seat_2', token: adapter.token, sequence: 0, intent: { healthJar: { west: 999 } } });
    assert.equal(outcomeClaim.status, 400);
    assert.equal(outcomeClaim.json.reason, 'machine-or-outcome-action-rejected');
    const aiInput = await rawRequest(18952, '/api/input', { roomCode: 'AXM1', seatId: 'seat_3', token: adapter.token, sequence: 0, intent: { moveY: 1 } });
    assert.equal(aiInput.status, 403);
    assert.equal(aiInput.json.reason, 'seat-cannot-send-input');

    state = await request(18952, '/state');
    const humanStart = { ...state.players.p1 };
    const adapterStart = { ...state.players.p2 };
    const semantic = { moveX: 0, moveY: 1, lookX: 0, lookY: 0, fire: false, special: false, buy: null };
    const adapterInput = await request(18952, '/api/input', { roomCode: 'AXM1', seatId: 'seat_2', token: adapter.token, sequence: 0, intent: semantic });
    const humanInput = await request(18952, '/input?player=p1', semantic);
    assert.equal(adapterInput.gate, 'briarfront-seat-authority-v1');
    assert.equal(humanInput.gate, adapterInput.gate);
    assert.deepEqual(humanInput.sanitized, adapterInput.sanitized, 'human and adapter intentions share one sanitizer and authority gate');
    const replay = await rawRequest(18952, '/api/input', { roomCode: 'AXM1', seatId: 'seat_2', token: adapter.token, sequence: 0, intent: semantic });
    assert.equal(replay.status, 409);
    assert.equal(replay.json.reason, 'stale-sequence');
    await new Promise(resolve => setTimeout(resolve, 140));
    state = await request(18952, '/state');
    assert.ok(distance(humanStart, state.players.p1) > 0.01, 'human semantic input moves through authoritative simulation');
    assert.ok(distance(adapterStart, state.players.p2) > 0.01, 'adapter semantic input moves through the same authoritative simulation');
    observation = await request(18952, '/api/adapter-observation?room=AXM1&seat=seat_2', undefined, { 'x-axm-seat-token': adapter.token });
    assert.equal(observation.controls.nextSequenceMinimum, 1);
  });

  console.log('PASS Briarfront semantic seat selftest');
})().catch(error => { console.error(error.stack || error.message); process.exitCode = 1; });
