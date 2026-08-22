#!/usr/bin/env node
'use strict';

const assert = require('assert');
const { createServer, resolveHost, GAME_ID } = require('../runtime/server');

function request(base, pathname, options) {
  return fetch(base + pathname, options).then(async response => ({ response, text: await response.text() }));
}

async function main() {
  assert.strictEqual(resolveHost({}), '127.0.0.1', 'manual runs stay local by default');
  assert.strictEqual(resolveHost({ AXM_MANAGED_BY_GAME_HUB: '1' }), '0.0.0.0', 'Game Hub launches must accept same-Wi-Fi phone connections');
  assert.strictEqual(resolveHost({ AXM_MANAGED_BY_GAME_HUB: '1', HOST: '127.0.0.1' }), '127.0.0.1', 'an explicit host override must win');
  const server = createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    let result = await request(base, '/health');
    assert.strictEqual(result.response.status, 200);
    assert.strictEqual(JSON.parse(result.text).gameId, GAME_ID);

    result = await request(base, '/api/launch-config');
    const launch = JSON.parse(result.text);
    assert.strictEqual(result.response.status, 200);
    assert.strictEqual(launch.controls.gamepadProfile, 'axm-universal-xbox-brawl-v0.2.1');
    assert.ok(Array.isArray(launch.players));

    result = await request(base, '/api/launcher-state');
    const metadata = JSON.parse(result.text);
    assert.strictEqual(metadata.controllerLinks.length, 1);
    assert.strictEqual(metadata.controllerLinks[0].url, '/controller.html?player=p1');
    assert.strictEqual(metadata.partyScreenLinks.all, '/');

    for (const route of ['/', '/games/021/', '/controller.html?player=p1', '/styles.css', '/game-core.js', '/app.js', '/control-profile.json']) {
      result = await request(base, route);
      assert.strictEqual(result.response.status, 200, `${route} must be served`);
    }

    result = await request(base, '/api/input', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ player: 'p1', sequence: 7, moveX: 0.75, moveY: -0.25, aimX: 1, fire: true, buildHeld: true, edges: { fire: true, upgrade: true, fortify: true, build: true } })
    });
    assert.strictEqual(result.response.status, 200);
    result = await request(base, '/api/input');
    const input = JSON.parse(result.text);
    assert.strictEqual(input.inputs.p1.protocol, 'axm-semantic-input-v1');
    assert.strictEqual(input.inputs.p1.moveX, 0.75);
    assert.strictEqual(input.inputs.p1.fire, true);
    assert.strictEqual(input.inputs.p1.buildHeld, true, 'QR relay must preserve held RB state while the thumb chooses a wheel direction');
    assert.strictEqual(input.inputs.p1.fireAimX, 1, 'fire edges must retain their release aim even after the live stick recenters');
    assert.strictEqual(input.inputs.p1.edges.fire, 1);
    assert.strictEqual(input.inputs.p1.edges.upgrade, 1);
    assert.strictEqual(input.inputs.p1.edges.fortify, 1);
    assert.strictEqual(input.inputs.p1.edges.build, 1);

    result = await request(base, '/api/input', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ player: 'p3' })
    });
    assert.strictEqual(result.response.status, 400, 'unknown phone seats must be rejected');
    result = await request(base, '/../package.json');
    assert.strictEqual(result.response.status, 404, 'path traversal must not escape the runtime directory');
    result = await request(base, '/api/nope');
    assert.strictEqual(result.response.status, 404);
    console.log('Hearthgate server HTTP test: PASS · health, QR controller relay, launch metadata, static routes, and traversal guard');
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
}

main().catch(error => {
  console.error('Hearthgate server HTTP test: FAIL');
  console.error(error);
  process.exit(1);
});
