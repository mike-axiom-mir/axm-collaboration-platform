'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createRuntime, safeFile } = require('../runtime/server.cjs');

test('safeFile confines game routes to the runtime directory', () => {
  assert.match(safeFile('/games/018/'), /index\.html$/);
  assert.equal(safeFile('/games/018/../../server.cjs'), null);
  assert.equal(safeFile('/other/place'), null);
});

test('local server exposes health, observation, and playable HTML', async t => {
  const runtime = createRuntime();
  await new Promise(resolve => runtime.server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => runtime.server.close(resolve)));
  const address = runtime.server.address();
  const base = `http://127.0.0.1:${address.port}`;
  const healthResponse = await fetch(`${base}/health`);
  const health = await healthResponse.json();
  assert.equal(healthResponse.status, 200);
  assert.equal(health.gameId, '018-last-stop-nebula');
  assert.equal(health.renderer, 'Three.js r160 WebGL');
  assert.equal(health.version, '0.26.0-beta');
  const observation = await (await fetch(`${base}/api/observation`)).json();
  assert.equal(observation.ok, true);
  assert.match(observation.balanceLedgerLocation, /last 24 compact run summaries/i);
  assert.match(observation.limitation, /not rendered WebGL/i);
  const page = await fetch(`${base}/games/018/`);
  const html = await page.text();
  assert.equal(page.status, 200);
  assert.match(html, /LAST STOP/);
  assert.match(html, /app\.mjs/);
  const moduleResponse = await fetch(`${base}/games/018/game-core.mjs`);
  assert.match(moduleResponse.headers.get('content-type'), /text\/javascript/);
});
