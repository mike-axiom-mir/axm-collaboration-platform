#!/usr/bin/env node
'use strict';

const assert = require('assert');
const path = require('path');
const { spawn } = require('child_process');

const serverFile = path.resolve(__dirname, '..', 'runtime', 'relaybound-server.cjs');
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

async function start(port) {
  const child = spawn(process.execPath, [serverFile], {
    env: {
      ...process.env,
      PORT: String(port),
      AXM_RELAYBOUND_HOST: '127.0.0.1',
      AXM_PLAYERS_JSON: JSON.stringify([
        { seat_id: 'seat_1', display_name: 'Mike', type: 'human' },
        { seat_id: 'seat_2', display_name: 'Nova', type: 'human' }
      ]),
      AXM_TEST_MODE: '1',
      AXM_RELAYBOUND_COUNTDOWN_MS: '80'
    },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true
  });
  let stderr = '';
  child.stderr.on('data', chunk => { stderr += chunk; });
  const base = 'http://127.0.0.1:' + port;
  for (let attempt = 0; attempt < 60; attempt++) {
    if (child.exitCode != null) throw new Error('Relaybound exited early: ' + stderr);
    try { if ((await fetch(base + '/health')).ok) return { base, child }; } catch (_) {}
    await wait(50);
  }
  child.kill();
  throw new Error('Relaybound did not become ready: ' + stderr);
}

async function stop(child) {
  if (child.exitCode != null) return;
  child.kill('SIGTERM');
  await Promise.race([new Promise(resolve => child.once('exit', resolve)), wait(1500)]);
}

async function json(base, route, options) {
  const response = await fetch(base + route, options);
  return { response, body: await response.json() };
}

async function setTest(base, body) {
  const result = await json(base, '/api/test/set', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body)
  });
  assert.strictEqual(result.response.status, 200);
}

async function choose(base, type) {
  const result = await json(base, '/input?player=p1', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ upgrade: type })
  });
  assert.strictEqual(result.response.status, 200);
}

async function waitFor(base, predicate, label) {
  for (let attempt = 0; attempt < 80; attempt++) {
    const result = await json(base, '/state');
    if (predicate(result.body)) return result.body;
    await wait(40);
  }
  throw new Error('Timed out waiting for ' + label);
}

(async () => {
  const port = 19740 + Math.floor(Math.random() * 180);
  const running = await start(port);
  try {
    let result = await json(running.base, '/start', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}'
    });
    assert.strictEqual(result.response.status, 200);
    await waitFor(running.base, state => state.phase === 'combat' && state.stage === 1, 'first chamber');

    await setTest(running.base, { clearEnemies: true, players: { p2: { down: true, health: 0 } } });
    let state = await waitFor(running.base, value => value.phase === 'upgrade' && value.chambersCleared === 1, 'first relay shrine');
    assert.strictEqual(state.relayCount, 0);
    assert.strictEqual(state.players.p2.down, false, 'the relay shrine must revive a downed chooser');
    assert.ok(state.players.p2.health >= Math.ceil(state.players.p2.maxHealth * 0.55));

    await choose(running.base, 'attack');
    state = await waitFor(running.base, value => value.phase === 'combat' && value.stage === 2, 'Echo Chamber');
    assert.strictEqual(state.relayCount, 1);
    assert.strictEqual(state.enemies.filter(enemy => enemy.alive && enemy.kind === 'echo').length, 6);
    assert.ok(state.enemies.every(enemy => enemy.kind !== 'echo' || enemy.maxHealth === 54));

    await setTest(running.base, { clearEnemies: true });
    state = await waitFor(running.base, value => value.phase === 'upgrade' && value.chambersCleared === 2, 'second relay shrine');
    await choose(running.base, 'defense');
    state = await waitFor(running.base, value => value.phase === 'guardian' && value.stage === 3, 'guardian');
    assert.strictEqual(state.relayCount, 2);

    await setTest(running.base, { guardianHealth: 150 });
    await waitFor(running.base, value => value.phase === 'upgrade' && value.relayCount === 2, 'guardian counter relay');
    await choose(running.base, 'attack');
    state = await waitFor(running.base, value => value.phase === 'guardian' && value.stage === 4, 'guardian final phase');
    assert.strictEqual(state.relayCount, 3);

    await setTest(running.base, { clearEnemies: true });
    state = await waitFor(running.base, value => value.phase === 'won', 'completed expanded route');
    assert.strictEqual(state.result.chambers, 2);
    assert.strictEqual(state.result.relays, 3);
    assert.strictEqual(state.version, '0.4.0-echo-chamber');
    console.log('Relaybound Echo Chamber HTTP test: PASS');
  } finally {
    await stop(running.child);
  }
})().catch(error => { console.error(error.stack || error); process.exitCode = 1; });
