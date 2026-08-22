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

async function waitFor(url, predicate, label, timeoutMs = 3500) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const value = await getJson(url);
    if (predicate(value)) return value;
    await wait(70);
  }
  throw new Error('timed out waiting for ' + label);
}

function actor(packet, seatId = 'seat_2') {
  return packet.world.actors.find(value => value.seatId === seatId);
}

function position(packet) {
  const value = actor(packet);
  return { x: value.position.x, y: value.position.y };
}

test('production controller exposes a fail-closed local-link state and keeps polling', () => {
  const root = path.resolve(__dirname, '..');
  const html = fs.readFileSync(path.join(root, 'client', 'controller', 'controller.html'), 'utf8');
  const css = fs.readFileSync(path.join(root, 'client', 'controller', 'controller.css'), 'utf8');
  const client = fs.readFileSync(path.join(root, 'client', 'controller', 'controller.js'), 'utf8');
  const constants = fs.readFileSync(path.join(root, 'shared', 'constants.js'), 'utf8');

  assert.match(html, /id="connection" class="status-pill" role="status" aria-live="polite">LOCAL LINK · CONNECTING/);
  assert.match(css, /body\.link-lost \.twin-controls/);
  assert.match(css, /\.status-pill\.lost::before/);
  assert.match(client, /function setLink\(live, label = live \? 'LOCAL LINK · LIVE' : 'LOCAL LINK · LOST · RETRYING'\)/);
  assert.match(client, /if \(sending \|\| !identity\.sessionId \|\| !linkLive\) return/);
  assert.match(client, /\['inventory-toggle', 'inventory-prev', 'inventory-activate', 'inventory-next', 'action', 'attack', 'sprint', 'brake'\][\s\S]*disabled = true/);
  assert.match(client, /moveStick\?\.setEnabled\(false\)/);
  assert.match(client, /aimStick\?\.setEnabled\(false\)/);
  assert.match(client, /setInterval\(pollState, 250\)/);
  assert.match(constants, /INPUT_TIMEOUT_MS:\s*600/);
  assert.match(constants, /DISCONNECT_TIMEOUT_MS:\s*5000/);
});

test('District Party neutralizes held input, marks the seat disconnected, and accepts fresh input after proxy recovery', async t => {
  const harness = await createEvidenceHarness();
  t.after(() => harness.close());

  const { roomCode, sessionId } = harness.launcher;
  const link = harness.controller;
  const statePath = `/api/state?roomCode=${encodeURIComponent(roomCode)}&sessionId=${encodeURIComponent(sessionId)}&party=all`;
  const proxyState = harness.url + statePath;
  const originState = harness.origin + statePath;
  const baseline = await getJson(proxyState);
  assert.equal(baseline.sessionId, sessionId);
  assert.equal(actor(baseline).connected, false);

  const packet = (seq, input) => ({ roomCode, sessionId, seatId: link.seatId, token: link.token, seq, input });
  await postJson(harness.url + '/api/input', packet(1, { moveX: 1 }));
  const moving = await waitFor(proxyState, value => actor(value).position.x > actor(baseline).position.x + 0.1, 'P2 movement');

  harness.drop();
  await assert.rejects(fetch(proxyState), 'the fault proxy must reject controller traffic while cut');
  await wait(850);
  const settledA = await getJson(originState);
  await wait(320);
  const settledB = await getJson(originState);
  assert.equal(settledA.sessionId, sessionId);
  assert.ok(position(settledA).x >= position(moving).x, 'the last accepted direction may continue only to the server TTL');
  assert.ok(Math.abs(position(settledB).x - position(settledA).x) < 0.08, 'held horizontal input must be neutral after 600 ms');
  assert.ok(Math.abs(position(settledB).y - position(settledA).y) < 0.08, 'the offline seat must not introduce vertical drift');

  await wait(4200);
  const disconnected = await getJson(originState);
  assert.equal(actor(disconnected).connected, false, 'authoritative presence expires after the disconnect window');
  const launcherDuringCut = await getJson(harness.origin + '/api/launcher-state');
  assert.equal(launcherDuringCut.players.find(player => player.seatId === link.seatId).connected, false);

  harness.restore();
  const recovered = await getJson(proxyState);
  assert.equal(recovered.sessionId, sessionId);
  await postJson(harness.url + '/api/input', packet(2, { moveY: -1 }));
  const movedAgain = await waitFor(proxyState, value => actor(value).position.y < actor(recovered).position.y - 0.1, 'fresh P2 movement after recovery');
  await postJson(harness.url + '/api/input', packet(3, {}));
  assert.equal(actor(movedAgain).connected, true);
  assert.equal(movedAgain.sessionId, sessionId);
});
