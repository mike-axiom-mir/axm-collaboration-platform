'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const test = require('node:test');
const { createEvidenceHarness } = require('./disconnect-recovery-browser-harness');

const client = fs.readFileSync(path.join(__dirname, '..', 'runtime', 'relaybound-client.html'), 'utf8');

function stableState(state) {
  return {
    phase: state.phase,
    event: state.event,
    eventAt: state.eventAt,
    players: Object.fromEntries(Object.entries(state.players).map(([id, player]) => [id, {
      name: player.name,
      kind: player.kind,
      role: player.role,
      health: player.health
    }])),
    upgrades: state.upgrades
  };
}

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
    setTimeout(() => { request.destroy(); reject(new Error('timed out waiting for Relaybound event')); }, 2500).unref();
  });
}

test('production client exposes retry state and resumes accepting authoritative packets', () => {
  assert.match(client, /const es=new EventSource\(url\('events'\+suffix\)\)/);
  assert.match(client, /es\.onmessage=e=>\{try\{accept\(JSON\.parse\(e\.data\)\)\}/);
  assert.match(client, /es\.onerror=\(\)=>connection\.textContent='RECONNECTING'/);
  assert.match(client, /Date\.now\(\)-lastPacket>1700[\s\S]*fetch\(url\(stateRoute\)\)[\s\S]*catch\(\(\)=>connection\.textContent='RUNTIME OFFLINE'\)/);
});

test('transport interruption recovers to the same authoritative Relaybound state', async t => {
  const harness = await createEvidenceHarness();
  t.after(() => harness.close());

  const baselineResponse = await fetch(harness.url + '/state');
  assert.equal(baselineResponse.status, 200);
  const baseline = await baselineResponse.json();
  assert.equal(baseline.phase, 'ready');
  assert.equal(baseline.players.p1.name, 'Mike');
  assert.equal(baseline.players.p2.name, 'Errol');

  const streamed = await firstEvent(harness.url);
  assert.deepEqual(stableState(streamed), stableState(baseline));

  harness.drop();
  assert.equal(harness.isOffline(), true);
  await assert.rejects(fetch(harness.url + '/state'));

  const authoritativeResponse = await fetch(harness.origin + '/state');
  assert.equal(authoritativeResponse.status, 200);
  const authoritativeWhileOffline = await authoritativeResponse.json();
  assert.deepEqual(stableState(authoritativeWhileOffline), stableState(baseline));

  harness.restore();
  assert.equal(harness.isOffline(), false);
  const recoveredResponse = await fetch(harness.url + '/state');
  assert.equal(recoveredResponse.status, 200);
  const recovered = await recoveredResponse.json();
  assert.deepEqual(stableState(recovered), stableState(baseline));

  const reconnectedStream = await firstEvent(harness.url);
  assert.deepEqual(stableState(reconnectedStream), stableState(baseline));
});
