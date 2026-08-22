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

async function postJson(url, body, expectedStatus = 200) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
  });
  const value = await response.json();
  assert.equal(response.status, expectedStatus, 'POST ' + url + ' should return ' + expectedStatus + ': ' + JSON.stringify(value));
  return value;
}

async function waitFor(check, timeoutMs, label) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await check()) return;
    await wait(100);
  }
  assert.fail('timed out waiting for ' + label);
}

test('production controller visibly fails closed and keeps polling for automatic recovery', () => {
  const controller = fs.readFileSync(path.resolve(__dirname, '..', 'runtime', 'controller.js'), 'utf8');
  const server = fs.readFileSync(path.resolve(__dirname, '..', 'runtime', 'server.js'), 'utf8');

  assert.match(controller, /connection\('online','SEAT LINKED'\);poll\(\)/);
  assert.match(controller, /connection\('error',error\.message\.toUpperCase\(\)\)/);
  assert.match(controller, /state\.timer=setTimeout\(poll,900\)/);
  assert.match(controller, /button\.disabled=!state\.connected/);
  assert.match(server, /connected:clock\(\)-seat\.lastSeen<6500/);
  assert.match(server, /seat\.lastSeen = clock\(\)/);
});

test('Hexbound quartermaster relay expires across a proxy cut and accepts a command after restoration', async t => {
  const harness = await createEvidenceHarness();
  t.after(() => harness.close());

  await postJson(harness.origin + '/api/coop/host-state', {
    phase: 'battle', matchId: 'hexbound-disconnect-evidence', mode: 'coop',
    faction: 'Temporal Mischief', map: 'Neverafter Rooftops', stance: 'PROBE',
    resources: { glow: 200, scrap: 180, essence: 60 }
  });
  const joined = await postJson(harness.url + '/api/coop/join', { player: 'Quartermaster' });
  assert.equal(joined.schema, 'hexbound.coop-command/v2');
  assert.equal(joined.seat.connected, true);

  const baseline = await getJson(harness.url + '/api/coop/state?token=' + encodeURIComponent(joined.token));
  assert.equal(baseline.host.matchId, 'hexbound-disconnect-evidence');
  assert.equal(baseline.seat.connected, true);

  harness.drop();
  await assert.rejects(fetch(harness.url + '/api/coop/state?token=' + encodeURIComponent(joined.token)), 'the proxy must reject controller traffic while cut');
  await waitFor(async () => {
    const health = await getJson(harness.origin + '/health');
    return health.coop.seat.connected === false;
  }, 8500, 'the 6500 ms server relay TTL to expire');

  harness.restore();
  const recovered = await getJson(harness.url + '/api/coop/state?token=' + encodeURIComponent(joined.token));
  assert.equal(recovered.seat.connected, true);
  assert.equal(recovered.host.matchId, 'hexbound-disconnect-evidence');

  const command = await postJson(harness.url + '/api/coop/command', {
    token: joined.token, type: 'macro', value: 'guard'
  }, 202);
  assert.equal(command.command.status, 'queued');
  const drained = await getJson(harness.origin + '/api/coop/commands?after=0');
  assert.equal(drained.commands.length, 1);
  assert.equal(drained.commands[0].value, 'guard');
  assert.equal(drained.seat.connected, true);
});
