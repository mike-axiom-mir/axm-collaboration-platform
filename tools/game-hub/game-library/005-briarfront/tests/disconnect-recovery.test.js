'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const test = require('node:test');
const { createEvidenceHarness } = require('./disconnect-recovery-browser-harness');

const client = fs.readFileSync(path.join(__dirname, '..', 'runtime', 'briarfront-client.html'), 'utf8');
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

function firstEvent(url) {
  return new Promise((resolve, reject) => {
    const request = http.get(url + '/events', response => {
      let buffer = '';
      response.setEncoding('utf8');
      response.on('data', chunk => {
        buffer += chunk;
        const match = buffer.match(/(?:^|\n)data: (\{.*\})\n\n/);
        if (!match) return;
        request.destroy();
        try { resolve(JSON.parse(match[1])); }
        catch (error) { reject(error); }
      });
    });
    request.on('error', reject);
    setTimeout(() => { request.destroy(); reject(new Error('timed out waiting for Briarfront event')); }, 2500).unref();
  });
}

async function state(url) {
  const response = await fetch(url + '/state');
  assert.equal(response.status, 200);
  return response.json();
}

async function input(url, value) {
  const response = await fetch(url + '/input?player=p1', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(value)
  });
  assert.equal(response.status, 200);
}

test('production client exposes EventSource retry, stale polling and visible offline state', () => {
  assert.match(client, /var es=new EventSource\(api\('\/events'\)\)/);
  assert.match(client, /es\.onmessage=function\(e\)\{try\{accept\(JSON\.parse\(e\.data\)\)/);
  assert.match(client, /es\.onerror=function\(\)\{stats\.textContent='RECONNECTING'/);
  assert.match(client, /Date\.now\(\)-lastPacket<1800[\s\S]*fetch\(api\('\/state'\)\)[\s\S]*stats\.textContent='OFFLINE'/);
});

test('same Briarfront authority advances while offline and accepts controller input after recovery', async t => {
  const harness = await createEvidenceHarness();
  t.after(() => harness.close());

  const baseline = await state(harness.url);
  assert.equal(baseline.game_id, '005-briarfront');
  assert.equal(baseline.phase, 'running');
  assert.deepEqual(Object.values(baseline.players).map(player => player.kind), ['human', 'human', 'human', 'human']);

  await input(harness.url, { moveX: 0, moveY: 0, lookX: 0, lookY: 0 });
  await wait(70);
  const connected = await state(harness.url);
  assert.equal(connected.players.p1.controllerConnected, true);
  const streamed = await firstEvent(harness.url);
  assert.ok(streamed.tick >= connected.tick);

  harness.drop();
  assert.equal(harness.isOffline(), true);
  await assert.rejects(fetch(harness.url + '/state'));
  await wait(1350);
  const authoritativeWhileOffline = await state(harness.origin);
  assert.ok(authoritativeWhileOffline.tick > connected.tick);
  assert.equal(authoritativeWhileOffline.players.p1.controllerConnected, false);

  harness.restore();
  assert.equal(harness.isOffline(), false);
  await input(harness.url, { moveX: 0, moveY: 0, lookX: 0, lookY: 0 });
  await wait(70);
  const recovered = await state(harness.url);
  assert.ok(recovered.tick > authoritativeWhileOffline.tick);
  assert.equal(recovered.players.p1.controllerConnected, true);
  const reconnectedStream = await firstEvent(harness.url);
  assert.ok(reconnectedStream.tick >= recovered.tick);
});
