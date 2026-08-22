'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { createEvidenceHarness } = require('./disconnect-recovery-browser-harness.js');

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

async function getJson(url) {
  const response = await fetch(url);
  assert.equal(response.ok, true, 'GET ' + url + ' should succeed');
  return response.json();
}

async function postJson(url, body) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body || {})
  });
  const value = await response.json();
  assert.equal(response.ok, true, 'POST ' + url + ' should succeed: ' + JSON.stringify(value));
  return value;
}

async function waitFor(url, predicate, timeoutMs = 2400) {
  const deadline = Date.now() + timeoutMs;
  let value = null;
  while (Date.now() < deadline) {
    value = await getJson(url);
    if (predicate(value)) return value;
    await wait(35);
  }
  throw new Error('timed out waiting for state: ' + JSON.stringify(value));
}

async function firstSseState(url, timeoutMs = 1800) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url + '/events?room=AXM1', { signal: controller.signal });
    assert.equal(response.ok, true);
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let text = '';
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      text += decoder.decode(part.value, { stream: true });
      const match = text.match(/(?:^|\n)data: ([^\n]+)\n/);
      if (match) return JSON.parse(match[1]);
    }
    throw new Error('SSE stream ended before a state packet');
  } finally {
    clearTimeout(timer);
    controller.abort();
  }
}

test('production client exposes EventSource retry, stale polling and visible loss states', () => {
  const source = fs.readFileSync(path.resolve(__dirname, '..', 'runtime', 'neon-pong-duet.js'), 'utf8');
  assert.match(source, /new EventSource\(api\('\/events\?room=AXM1'\)\)/);
  assert.match(source, /connection\.textContent = 'RECONNECTING'/);
  assert.match(source, /Date\.now\(\) - lastPacket < 1800/);
  assert.match(source, /connection\.textContent = 'OFFLINE'/);
  assert.match(source, /fetch\(api\('\/state\?room=AXM1'\)\)/);
});

test('Robo-Pong authority advances through a proxy cut and accepts recovered control', async t => {
  const harness = await createEvidenceHarness();
  t.after(() => harness.close());

  const stateUrl = harness.url + '/state?room=AXM1';
  const originStateUrl = harness.origin + '/state?room=AXM1';
  const baseline = await getJson(stateUrl);
  assert.equal(baseline.phase, 'ready');
  assert.deepEqual(Object.values(baseline.players).map(player => player.kind), ['human', 'human']);

  await postJson(harness.url + '/start', { player: 'p1' });
  const running = await waitFor(stateUrl, state => state.phase === 'running');
  const initialX = running.paddles.p1.x;
  await postJson(harness.url + '/input?room=AXM1&player=p1', { right: true });
  await wait(150);
  await postJson(harness.url + '/input?room=AXM1&player=p1', { right: false });
  const movedRight = await getJson(stateUrl);
  assert.ok(movedRight.paddles.p1.x > initialX + 5, 'pre-cut P1 input should move the authoritative paddle right');
  assert.equal(movedRight.players.p1.controllerConnected, true);

  harness.drop();
  await assert.rejects(fetch(stateUrl), 'the proxy must reject client traffic while cut');
  await wait(180);
  const originDuringCut = await getJson(originStateUrl);
  assert.ok(originDuringCut.tick > movedRight.tick, 'the origin tick must continue while the client transport is cut');
  assert.equal(originDuringCut.phase, 'running');

  harness.restore();
  const beforeRecoveredInput = await getJson(stateUrl);
  await postJson(harness.url + '/input?room=AXM1&player=p1', { left: true });
  await wait(150);
  await postJson(harness.url + '/input?room=AXM1&player=p1', { left: false });
  const recovered = await getJson(stateUrl);
  assert.ok(recovered.paddles.p1.x < beforeRecoveredInput.paddles.p1.x - 5, 'recovered P1 input should move the authoritative paddle left');
  assert.equal(recovered.players.p1.controllerConnected, true);

  const streamed = await firstSseState(harness.url);
  assert.equal(streamed.room, 'AXM1');
  assert.equal(streamed.phase, 'running');
  assert.ok(streamed.tick >= recovered.tick, 'a restored SSE stream should deliver current authoritative state');
});
