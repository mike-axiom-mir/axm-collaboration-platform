#!/usr/bin/env node
'use strict';

const assert = require('assert');
const { createRuntime } = require('../runtime/server');

let now = 1000;
const runtime = createRuntime({
  manualTick: true,
  clock: () => now,
  roster: [{ seat_id: 'seat_1', display_name: 'HTTP Pippa', type: 'human' }]
});

function listen() {
  return new Promise((resolve, reject) => {
    runtime.server.once('error', reject);
    runtime.server.listen(0, '127.0.0.1', () => resolve(runtime.server.address().port));
  });
}
function close() {
  return new Promise(resolve => runtime.server.close(resolve));
}
async function json(base, route, options) {
  const response = await fetch(base + route, options);
  const value = await response.json();
  return { response, value };
}
async function action(base, body) {
  return json(base, '/api/action', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
}

(async () => {
  const port = await listen();
  const base = 'http://127.0.0.1:' + port;
  try {
    let result = await json(base, '/health');
    assert.strictEqual(result.response.status, 200);
    assert.strictEqual(result.value.ok, true);
    assert.strictEqual(result.value.humanSeats, 1);
    assert.strictEqual(result.value.aiCompanions, 1);
    assert.strictEqual(result.value.splitScreen, false);
    assert.strictEqual(result.response.headers.get('access-control-allow-origin'), null);
    assert.strictEqual(result.response.headers.get('cross-origin-resource-policy'), 'same-origin');
    console.log('PASS health publishes fixed team and authority truth');

    const preflight = await fetch(base + '/api/action', {
      method: 'OPTIONS',
      headers: { origin: 'https://example.invalid', 'access-control-request-method': 'POST' }
    });
    assert.strictEqual(preflight.status, 405);
    assert.strictEqual((await preflight.json()).code, 'cross-origin-disabled');
    console.log('PASS local runtime rejects cross-origin browser preflight');

    result = await json(base, '/api/launcher-state');
    assert.strictEqual(result.value.team.humanSeats, 1);
    assert.strictEqual(result.value.team.aiCompanions, 1);
    assert.strictEqual(result.value.controllerLinks.length, 0);
    assert.strictEqual(result.value.authority.combat, 'managed-server');
    console.log('PASS launcher state exposes local managed-server seams');

    result = await json(base, '/api/state');
    assert.strictEqual(result.value.state.phase, 'story');
    assert.strictEqual(result.value.story.length, 3);
    assert.strictEqual(result.value.authority, 'managed-local-server');
    console.log('PASS initial state carries all story scenes');

    let rejected = await fetch(base + '/api/action', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{'
    });
    assert.strictEqual(rejected.status, 400);
    let rejectedValue = await rejected.json();
    assert.strictEqual(rejectedValue.code, 'invalid-json');
    rejected = await fetch(base + '/api/action', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ padding: 'x'.repeat(25 * 1024) })
    });
    assert.strictEqual(rejected.status, 413);
    rejectedValue = await rejected.json();
    assert.strictEqual(rejectedValue.code, 'request-body-too-large');
    result = await json(base, '/api/state');
    assert.strictEqual(result.value.state.phase, 'story');
    console.log('PASS malformed and oversized requests return structured errors without harming the session');

    for (let index = 0; index < 3; index += 1) {
      now += 10;
      result = await action(base, { player: 'p1', action: { type: 'story-next' } });
      assert.strictEqual(result.response.status, 200);
    }
    assert.strictEqual(result.value.state.phase, 'briefing');
    now += 10;
    result = await action(base, { player: 'p1', action: { type: 'start' } });
    assert.strictEqual(result.value.state.phase, 'explore');
    assert.strictEqual(result.value.state.npcs.length, 5);
    assert.strictEqual(result.value.state.colorWisps.length, 10);
    now += 10;
    result = await action(base, { player: 'p1', action: { type: 'interact' } });
    assert.strictEqual(result.value.state.phase, 'wave');
    assert.strictEqual(result.value.state.wave, 1);
    console.log('PASS HTTP actions advance story, open exploration, and start combat by proximity');

    result = await json(base, '/api/action', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{"player":"p1","action":{"type":"input","seq":1e309,"moveX":1,"aimX":1}}'
    });
    assert.strictEqual(result.response.status, 409);
    assert.strictEqual(result.value.actionResult.reason, 'invalid-sequence');
    assert.strictEqual(result.value.state.lastInputSeq, 0);
    console.log('PASS exponent-form non-finite input cannot poison the authoritative sequence');

    now += 300;
    runtime.advance(now);
    result = await action(base, { player: 'p1', action: { type: 'input', seq: 1, moveX: 1, aimX: 1, firing: true } });
    assert.strictEqual(result.value.actionResult.ok, true);
    now += 50;
    runtime.advance(now);
    const activeX = result.value.state.player.x;
    result = await json(base, '/api/state');
    assert(result.value.state.player.x >= activeX);
    assert.strictEqual(result.value.state.phase, 'wave');
    console.log('PASS server advances semantic combat input');

    result = await json(base, '/api/observe');
    assert.strictEqual(result.value.observation.authority, 'observation-only');
    assert.strictEqual(result.value.observation.phase, 'wave');
    assert.strictEqual(result.value.observation.player.perfectDodges, 0);
    assert.strictEqual(result.value.observation.player.counter, null);
    assert.strictEqual((await json(base, '/api/state')).value.config.prismCounterMs, 2400);
    assert.strictEqual((await json(base, '/api/state')).value.config.prismCounterMultiplier, 2);
    console.log('PASS observation route is explicit and non-authoritative');

    result = await action(base, { player: 'p1', action: { type: 'input', seq: 2, moveY: -1, aimY: -1, firing: false } });
    assert.strictEqual(result.value.actionResult.ok, true);
    let windingState = null;
    let windingEnemy = null;
    for (let tick = 0; tick < 420 && !windingEnemy; tick += 1) {
      now += 50;
      runtime.advance(now);
      windingState = runtime.getState();
      windingEnemy = windingState.enemies.find(enemy => enemy.windupUntil > windingState.now) || null;
    }
    assert(windingEnemy, 'expected deterministic combat to expose an enemy windup');
    result = await json(base, '/api/observe');
    const observedWindup = result.value.observation.enemies.find(enemy => enemy.id === windingEnemy.id);
    assert(observedWindup && observedWindup.attack, 'observation must transport the active attack tell');
    assert.strictEqual(observedWindup.attack.targetId, windingEnemy.windupTargetId);
    assert.strictEqual(observedWindup.attack.resolvesAt, windingEnemy.windupUntil);
    assert(observedWindup.attack.remainingMs > 0);
    console.log('PASS observation transports authoritative windup target and resolve timing');

    now += 10;
    result = await action(base, { player: 'p1', action: { type: 'pause' } });
    assert.strictEqual(result.value.state.paused, true);
    const frozenNow = result.value.state.now;
    const frozenWindupUntil = result.value.state.enemies.find(enemy => enemy.id === windingEnemy.id).windupUntil;
    now += 4000;
    runtime.advance(now);
    result = await json(base, '/api/state');
    assert.strictEqual(result.value.state.now, frozenNow);
    assert.strictEqual(result.value.state.enemies.find(enemy => enemy.id === windingEnemy.id).windupUntil, frozenWindupUntil);
    result = await action(base, { player: 'p1', action: { type: 'input', seq: 3, firing: true } });
    assert.strictEqual(result.response.status, 409);
    assert.strictEqual(result.value.actionResult.reason, 'paused');
    assert.strictEqual(result.value.state.lastInputSeq, 2);
    result = await action(base, { player: 'p1', action: { type: 'pause' } });
    assert.strictEqual(result.value.state.paused, false);
    assert.strictEqual(result.value.state.now, frozenNow);
    now += 50;
    runtime.advance(now);
    assert.strictEqual(runtime.getState().now, frozenNow + 50);
    console.log('PASS HTTP pause freezes windups, mastery windows, and latent input');

    const html = await fetch(base + '/games/013/?room=AXM1&player=p1');
    assert.strictEqual(html.status, 200);
    assert.match(html.headers.get('content-security-policy'), /default-src 'self'/);
    assert.strictEqual(html.headers.get('cross-origin-resource-policy'), 'same-origin');
    assert.match(await html.text(), /Bloomvale: Gatewatch/);
    const traversal = await fetch(base + '/games/013/%2e%2e%2fserver.js');
    assert.strictEqual(traversal.status, 404);
    console.log('PASS static runtime has local CSP and blocks traversal');

    result = await json(base, '/api/state');
    assert.strictEqual(result.value.state.phase, 'wave');
    assert.strictEqual(result.value.state.wave, 1);
    console.log('PASS repeated state request preserves authoritative session');

    result = await json(base, '/api/telemetry');
    assert(result.value.sampleCount >= 2);
    assert.strictEqual(result.value.tickMs.budget, 50);
    console.log('PASS bounded runtime telemetry is available');

    result = await json(base, '/api/reset', { method: 'POST' });
    assert.strictEqual(result.value.state.phase, 'story');
    assert.strictEqual(result.value.state.wave, 0);
    console.log('PASS explicit reset returns to the first story scene');

    console.log('\nBloomvale HTTP test: PASS');
  } finally {
    await close();
  }
})().catch(error => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
