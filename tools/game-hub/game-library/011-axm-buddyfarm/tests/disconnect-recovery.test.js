'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { createEvidenceHarness } = require('./disconnect-recovery-browser-harness.js');

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

function actorPosition(packet, player) {
  const actor = packet.state.actors[player];
  return { scene: actor.scene, x: actor.x, y: actor.y, steps: actor.steps, walkSequence: actor.walkState.sequence };
}

test('production controller fails closed, reports loss, and keeps polling', () => {
  const controller = fs.readFileSync(path.resolve(__dirname, '..', 'runtime', 'controller.html'), 'utf8');

  assert.match(controller, /let busy=false,connected=false/);
  assert.match(controller, /function setLink\(ok,detail\)[\s\S]*button\.disabled=!ok/);
  assert.match(controller, /LINK LOST · RETRYING/);
  assert.match(controller, /LINK LIVE/);
  assert.match(controller, /async function send\(action\)\{if\(busy\|\|!connected\)return/);
  assert.match(controller, /catch\(e\)\{setLink\(false,'LINK LOST · RETRYING · '\+e\.message\)\}finally\{busy=false\}/);
  assert.match(controller, /setInterval\(state,900\)/);
  assert.match(controller, /\.controls button:disabled\{opacity:\.42/);
});

test('BuddyFarm preserves authoritative farm state across a proxy cut and accepts a fresh move after restoration', async t => {
  const harness = await createEvidenceHarness();
  t.after(() => harness.close());

  const launch = await getJson(harness.url + '/api/launcher-state');
  assert.equal(launch.controllerLinks.length, 2);
  assert.deepEqual(launch.controllerLinks.map(link => link.player), ['p1', 'p2']);
  assert.equal(launch.authority.world, 'managed-server-shared-farm');

  const baseline = await getJson(harness.url + '/api/state');
  const first = await postJson(harness.url + '/api/action', { player: 'p2', action: { type: 'move', direction: 'right' } });
  assert.equal(first.result.ok, true);
  assert.equal(first.state.revision, baseline.state.revision + 1);
  assert.equal(first.state.actors.p2.x, baseline.state.actors.p2.x + 1);
  const beforeCut = actorPosition(first, 'p2');

  harness.drop();
  await assert.rejects(fetch(harness.url + '/api/state'), 'the proxy must reject controller traffic while cut');
  const duringCut = await getJson(harness.origin + '/api/state');
  assert.deepEqual(actorPosition(duringCut, 'p2'), beforeCut);

  harness.restore();
  const recovered = await getJson(harness.url + '/api/state');
  assert.deepEqual(actorPosition(recovered, 'p2'), beforeCut);
  const movedAgain = await postJson(harness.url + '/api/action', { player: 'p2', action: { type: 'move', direction: 'down' } });
  assert.equal(movedAgain.result.ok, true);
  assert.equal(movedAgain.state.revision, first.state.revision + 1);
  assert.equal(movedAgain.state.actors.p2.y, first.state.actors.p2.y + 1);
  assert.equal(movedAgain.state.actors.p2.steps, first.state.actors.p2.steps + 1);
});
