'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { INPUT_TTL_MS } = require('../runtime/server.js');
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
    body: JSON.stringify(body)
  });
  const value = await response.json();
  assert.equal(response.ok, true, 'POST ' + url + ' should succeed: ' + JSON.stringify(value));
  return value;
}

test('production controller and shared screen expose explicit loss and recovery paths', () => {
  const controller = fs.readFileSync(path.resolve(__dirname, '..', 'runtime', 'controller.html'), 'utf8');
  const app = fs.readFileSync(path.resolve(__dirname, '..', 'runtime', 'app.js'), 'utf8');
  const server = fs.readFileSync(path.resolve(__dirname, '..', 'runtime', 'server.js'), 'utf8');

  assert.match(controller, /setInterval\(sendInput, 50\)/);
  assert.match(controller, /LINK LOST · CHECK SAME WI-FI/);
  assert.match(controller, /LINK LIVE · P\$\{seatNumber\}/);
  assert.match(app, /Phone \$\{index \+ 1\} link lost - reconnecting\./);
  assert.match(app, /Phone \$\{index \+ 1\} linked to/);
  assert.match(server, /connected \? 'fresh' : 'disconnected'/);
  assert.match(server, /now - inputs\[player\]\.updatedAt <= INPUT_TTL_MS/);
});

test('Hearthgate phone relay expires during a proxy cut and accepts fresh input after restoration', async t => {
  const harness = await createEvidenceHarness();
  t.after(() => harness.close());

  const launch = await getJson(harness.url + '/api/launch-config');
  assert.equal(launch.players.length, 2);
  assert.deepEqual(launch.players.map(player => player.displayName), ['Mike', 'Nova']);
  assert.equal(launch.controls.protocol, 'axm-semantic-input-v1');

  const first = await postJson(harness.url + '/api/input', {
    protocol: 'axm-semantic-input-v1', player: 'p1', sequence: 5,
    moveX: 0.75, moveY: -0.25, aimX: 0.4, aimY: -0.6,
    fire: false, buildHeld: false, edges: { fire: true }
  });
  assert.equal(first.sequence, 5);
  const fresh = await getJson(harness.url + '/api/input');
  assert.equal(fresh.phoneStatus.p1, 'fresh');
  assert.equal(fresh.inputs.p1.moveX, 0.75);
  assert.equal(fresh.inputs.p1.edges.fire, 1);

  harness.drop();
  await assert.rejects(fetch(harness.url + '/api/input'), 'the proxy must reject controller and shared-screen traffic while cut');
  await wait(INPUT_TTL_MS + 140);
  const expired = await getJson(harness.origin + '/api/input');
  assert.equal(expired.phoneStatus.p1, 'disconnected');
  assert.equal(Object.hasOwn(expired.inputs, 'p1'), false);

  harness.restore();
  const recoveredPost = await postJson(harness.url + '/api/input', {
    protocol: 'axm-semantic-input-v1', player: 'p1', sequence: 6,
    moveX: -0.5, moveY: 0.2, aimX: -0.3, aimY: 0.8,
    fire: false, buildHeld: false, edges: {}
  });
  assert.equal(recoveredPost.sequence, 6);
  const recovered = await getJson(harness.url + '/api/input');
  assert.equal(recovered.phoneStatus.p1, 'fresh');
  assert.equal(recovered.inputs.p1.moveX, -0.5);
  assert.ok(recovered.inputs.p1.updatedAt > fresh.inputs.p1.updatedAt);
});
