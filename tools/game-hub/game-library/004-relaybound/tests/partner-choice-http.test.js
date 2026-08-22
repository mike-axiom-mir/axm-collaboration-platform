#!/usr/bin/env node
'use strict';

const assert = require('assert');
const path = require('path');
const { spawn } = require('child_process');

const serverFile = path.resolve(__dirname, '..', 'runtime', 'relaybound-server.cjs');

async function start(roster, port) {
  const child = spawn(process.execPath, [serverFile], {
    env: { ...process.env, PORT: String(port), AXM_RELAYBOUND_HOST: '127.0.0.1', AXM_PLAYERS_JSON: JSON.stringify(roster), AXM_TEST_MODE: '1', AXM_RELAYBOUND_COUNTDOWN_MS: '80', AXM_RELAYBOUND_BEACON_HOLD_MS: '120' },
    stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true
  });
  let stderr = '';
  child.stderr.on('data', chunk => { stderr += chunk; });
  const base = 'http://127.0.0.1:' + port;
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (child.exitCode != null) throw new Error('Relaybound exited early: ' + stderr);
    try { const response = await fetch(base + '/state'); if (response.ok) return { base, child }; } catch (_) {}
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  child.kill();
  throw new Error('Relaybound did not become ready: ' + stderr);
}

async function stop(child) {
  if (child.exitCode != null) return;
  child.kill('SIGTERM');
  await Promise.race([
    new Promise(resolve => child.once('exit', resolve)),
    new Promise(resolve => setTimeout(resolve, 1500))
  ]);
}

async function json(base, route, options) {
  const response = await fetch(base + route, options);
  return { response, body: await response.json() };
}

(async () => {
  const port = 19140 + Math.floor(Math.random() * 300);
  let running = await start([
    { seat_id: 'seat_1', display_name: 'Mike', type: 'human' },
    { seat_id: 'seat_2', display_name: 'Nova', type: 'adapter', adapter_id: 'nova' }
  ], port);
  try {
    let result = await json(running.base, '/state');
    assert.strictEqual(result.body.players.p1.kind, 'human');
    assert.strictEqual(result.body.players.p2.kind, 'adapter');
    assert.strictEqual(result.body.phase, 'ready');
    assert.strictEqual(result.body.beacons.length, 2);
    result = await json(running.base, '/start', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
    assert.strictEqual(result.body.state.phase, 'countdown');
    await new Promise(resolve => setTimeout(resolve, 130));
    result = await json(running.base, '/state');
    assert.strictEqual(result.body.phase, 'combat');
    const firstBeacon = result.body.beacons[0];
    result = await json(running.base, '/api/test/set', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ players: { p1: { x: firstBeacon.x, z: firstBeacon.z, health: 20 }, p2: { x: firstBeacon.x, z: firstBeacon.z, health: 40 } } })
    });
    await new Promise(resolve => setTimeout(resolve, 180));
    result = await json(running.base, '/state');
    assert.strictEqual(result.body.beacons[0].complete, true);
    assert.ok(result.body.resonanceRemaining > 10000);
    assert.ok(result.body.players.p1.health > 20 && result.body.players.p2.health > 40);
    result = await json(running.base, '/api/launcher-state');
    assert.strictEqual(result.body.adapterBindings.length, 1);
    const binding = result.body.adapterBindings[0];
    result = await json(running.base, '/api/adapter-observation?seat=seat_2');
    assert.strictEqual(result.response.status, 403);
    result = await json(running.base, '/api/adapter-observation?seat=seat_2', { headers: { 'x-axm-seat-token': binding.token } });
    assert.strictEqual(result.response.status, 200);
    assert.strictEqual(result.body.actorId, 'p2');
    assert.strictEqual(result.body.beacons[0].complete, true);
    result = await json(running.base, '/input', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ seatId: binding.seatId, token: binding.token, seq: 1, input: { moveX: 1, aimX: 1, action: true } })
    });
    assert.strictEqual(result.response.status, 200);
    result = await json(running.base, '/input', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ seatId: binding.seatId, token: binding.token, seq: 1, input: { moveX: -1 } })
    });
    assert.strictEqual(result.response.status, 409);
    await json(running.base, '/api/test/set', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ phase: 'won' }) });
    result = await json(running.base, '/restart', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
    assert.strictEqual(result.body.state.phase, 'ready');
    assert.strictEqual(result.body.state.beacons.filter(beacon => beacon.complete).length, 0);
  } finally { await stop(running.child); }

  running = await start([
    { seat_id: 'seat_1', display_name: 'Mike', type: 'human' },
    { seat_id: 'seat_2', display_name: 'Moxie', type: 'ai' }
  ], port + 1);
  try {
    const result = await json(running.base, '/input?player=p2', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ moveX: 1 })
    });
    assert.strictEqual(result.response.status, 403);
    assert.match(result.body.error, /in-game AI/);
    console.log('Relaybound partner-choice HTTP test: PASS');
  } finally { await stop(running.child); }
})().catch(error => { console.error(error.stack || error); process.exitCode = 1; });
