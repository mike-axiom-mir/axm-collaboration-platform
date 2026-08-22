'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { createEvidenceHarness } = require('./disconnect-recovery-browser-harness.js');

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

async function getJson(url) {
  const response = await fetch(url);
  const value = await response.json();
  assert.equal(response.ok, true, 'GET ' + url + ' should succeed: ' + JSON.stringify(value));
  return value;
}

async function postJson(url, body) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
  });
  const value = await response.json();
  assert.equal(response.ok, true, 'POST ' + url + ' should succeed: ' + JSON.stringify(value));
  return value;
}

async function waitFor(url, predicate, label, timeoutMs = 6000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const value = await getJson(url);
    if (predicate(value)) return value;
    await wait(80);
  }
  throw new Error('timed out waiting for ' + label);
}

function runIdentity(state) {
  return {
    createdAt: state.createdAt,
    startedAt: state.startedAt,
    endsAt: state.endsAt,
    map: state.map.id
  };
}

test('production phone controller reports transport loss, disables input, and keeps polling', () => {
  const client = fs.readFileSync(path.resolve(__dirname, '..', 'runtime', 'lumenwake-client.html'), 'utf8');
  const core = fs.readFileSync(path.resolve(__dirname, '..', 'runtime', 'lumenwake-core.cjs'), 'utf8');

  assert.match(client, /id="phoneLink" role="status" aria-live="polite"/);
  assert.match(client, /function setLink\(ok,detail\)\{connected=ok;[\s\S]*\$\('stick'\)\.setAttribute\('aria-disabled',String\(!ok\)\)/);
  assert.match(client, /LOCAL LINK · LOST · RETRYING/);
  assert.match(client, /if\(!connected\|\|!state\.player\|\|state\.player\.kind!==\'human\'\)return/);
  assert.match(client, /setInterval\(function\(\)\{if\(Date\.now\(\)-lastPacketAt>1500\)poll\(\);\},900\)/);
  assert.match(core, /now-input\.updatedAt>700/);
});

test('Lumenwake expires held input, preserves the run across a proxy cut, and accepts fresh input after recovery', async t => {
  const harness = await createEvidenceHarness();
  t.after(() => harness.close());

  const bootstrap = await getJson(harness.url + '/api/host/bootstrap');
  assert.deepEqual(bootstrap.launch.controllers.map(controller => controller.playerId), ['p1', 'p2']);

  const initial = await getJson(harness.url + '/state');
  assert.equal(initial.phase, 'ready');
  await postJson(harness.url + '/start', {});
  const running = await waitFor(harness.url + '/state', value => value.phase === 'running', 'running phase');
  const identity = runIdentity(running);

  await postJson(harness.url + '/input?player=p2', { moveX: 1, moveY: 0, action: false, dash: false });
  const moving = await waitFor(harness.url + '/state', value => value.players.p2.x > running.players.p2.x + 0.15, 'first recovered move');

  harness.drop();
  await assert.rejects(fetch(harness.url + '/state'), 'the proxy must reject controller traffic while cut');
  await wait(1050);
  const settledA = await getJson(harness.origin + '/state');
  await wait(350);
  const settledB = await getJson(harness.origin + '/state');
  assert.deepEqual(runIdentity(settledA), identity);
  assert.deepEqual(runIdentity(settledB), identity);
  assert.ok(settledA.players.p2.x >= moving.players.p2.x, 'the last accepted movement may continue only until the server TTL expires');
  assert.ok(Math.abs(settledB.players.p2.x - settledA.players.p2.x) < 0.08, 'held horizontal input must expire while the controller is offline');
  assert.ok(Math.abs(settledB.players.p2.y - settledA.players.p2.y) < 0.08, 'offline controller must not introduce vertical drift');

  harness.restore();
  const recovered = await getJson(harness.url + '/state');
  assert.deepEqual(runIdentity(recovered), identity);
  await postJson(harness.url + '/input?player=p2', { moveX: 0, moveY: -1, action: false, dash: false });
  const movedAgain = await waitFor(harness.url + '/state', value => value.players.p2.y < recovered.players.p2.y - 0.15, 'fresh move after recovery');
  await postJson(harness.url + '/input?player=p2', { moveX: 0, moveY: 0, action: false, dash: false });
  assert.deepEqual(runIdentity(movedAgain), identity);
});
