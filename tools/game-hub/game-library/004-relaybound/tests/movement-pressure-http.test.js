#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const root = path.resolve(__dirname, '..');
const serverFile = path.join(root, 'runtime', 'relaybound-server.cjs');
const clientFile = path.join(root, 'runtime', 'relaybound-client.html');
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

async function start(port) {
  const child = spawn(process.execPath, [serverFile], {
    env: {
      ...process.env,
      PORT: String(port),
      AXM_RELAYBOUND_HOST: '127.0.0.1',
      AXM_PLAYERS_JSON: JSON.stringify([
        { seat_id: 'seat_1', display_name: 'Mike', type: 'human' },
        { seat_id: 'seat_2', display_name: 'Errol', type: 'human' }
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

async function state(base, route = '/state') {
  const response = await fetch(base + route);
  assert.strictEqual(response.status, 200);
  return response.json();
}

async function input(base, player, value) {
  const response = await fetch(base + '/input?player=' + player, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(value)
  });
  assert.strictEqual(response.status, 200);
}

(async () => {
  const client = fs.readFileSync(clientFile, 'utf8');
  assert.doesNotMatch(client, /^\s*import .*three\.module/m, 'phone route must not statically import Three.js');
  assert.match(client, /if\(screen\)\{const modules=await Promise\.all/, '3D modules must be screen-only');
  assert.match(client, /lane\.inFlight/, 'input transport must coalesce while a request is in flight');
  assert.match(client, /view=controller/, 'phones must request compact controller state');
  assert.match(client, /Date\.now\(\)<keyboardActiveUntil/, 'idle shared-screen keyboard must not overwrite phone input');
  assert.match(client, /},80\);/, 'input sampling should be capped near 12.5 Hz');

  const port = 19480 + Math.floor(Math.random() * 250);
  const running = await start(port);
  try {
    const full = await state(running.base);
    const compact = await state(running.base, '/state?view=controller&player=p1');
    assert.ok(Array.isArray(full.enemies) && Array.isArray(full.timeline));
    assert.strictEqual(compact.enemies, undefined);
    assert.strictEqual(compact.bolts, undefined);
    assert.strictEqual(compact.timeline, undefined);
    assert.ok(JSON.stringify(compact).length < JSON.stringify(full).length * 0.7, 'controller packet should be materially smaller');

    let response = await fetch(running.base + '/start', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
    assert.strictEqual(response.status, 200);
    await wait(140);

    // Bring the ward alongside the edge, then keep both humans moving while the
    // ward holds its shield. This crosses enemy range and exercises combat input.
    for (let i = 0; i < 13; i++) {
      await Promise.all([
        input(running.base, 'p1', { moveX: 0, moveY: 0, aimX: 1, aimY: 0, action: false }),
        input(running.base, 'p2', { moveX: 0, moveY: -1, aimX: 1, aimY: 0, action: true })
      ]);
      await wait(80);
    }
    const before = await state(running.base);
    for (let i = 0; i < 55; i++) {
      await Promise.all([
        input(running.base, 'p1', { moveX: 1, moveY: 0, aimX: 1, aimY: 0, action: false }),
        input(running.base, 'p2', { moveX: 1, moveY: 0, aimX: 1, aimY: 0, action: true })
      ]);
      await wait(80);
    }
    const after = await state(running.base);
    assert.ok(after.players.p1.x - before.players.p1.x > 22, 'p1 must sustain forward movement under pressure');
    assert.ok(after.players.p2.x - before.players.p2.x > 18, 'p2 must sustain forward movement under pressure');
    assert.strictEqual(after.players.p1.down, false);
    assert.strictEqual(after.players.p2.down, false);
    assert.ok(after.players.p1.x >= 3 && after.players.p1.x <= after.arena.width - 3);
    assert.ok(after.players.p2.z >= 3 && after.players.p2.z <= after.arena.depth - 3);

    const alive = after.enemies.filter(enemy => enemy.alive);
    for (let i = 0; i < alive.length; i++) {
      for (let j = i + 1; j < alive.length; j++) {
        assert.ok(Math.hypot(alive[i].x - alive[j].x, alive[i].z - alive[j].z) > 1.8, 'enemies must not collapse into one stack');
      }
    }
    const shotTimes = alive.map(enemy => enemy.lastShotAt).filter(Number.isFinite);
    assert.ok(Math.max(...shotTimes) - Math.min(...shotTimes) > 150, 'enemy shots must remain staggered');

    await Promise.all([
      input(running.base, 'p1', { moveX: 0, moveY: 0, aimX: 1, aimY: 0, action: false }),
      input(running.base, 'p2', { moveX: 0, moveY: 0, aimX: 1, aimY: 0, action: false })
    ]);
    const stoppedAt = (await state(running.base)).players.p1.x;
    await wait(300);
    const settled = await state(running.base);
    assert.ok(settled.players.p1.x - stoppedAt < 0.5, 'movement must stop without a queued-input tail');
    console.log('Relaybound movement-under-pressure HTTP test: PASS');
  } finally {
    await stop(running.child);
  }
})().catch(error => { console.error(error.stack || error); process.exitCode = 1; });
