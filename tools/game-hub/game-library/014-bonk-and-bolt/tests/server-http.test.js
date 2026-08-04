#!/usr/bin/env node
'use strict';

const assert = require('assert');
const test = require('node:test');
const runtimeModule = require('../runtime/server.js');

let runtime, base;
test.before(async () => {
  runtime = runtimeModule.createRuntime();
  await new Promise(resolve => runtime.server.listen(0, '127.0.0.1', resolve));
  base = 'http://127.0.0.1:' + runtime.server.address().port;
});
test.after(async () => { await new Promise(resolve => runtime.server.close(resolve)); });

test('health exposes honest authority and player scope', async () => {
  const response = await fetch(base + '/health');
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.gameId, '014-bonk-and-bolt');
  assert.equal(body.maxPlayers, 2);
  assert.equal(body.gameHubSessionAuthority, 'server');
  assert.equal(body.worldSaveAuthority, 'browser-local-persistent');
  assert.equal(body.realtimeSimulationAuthority, 'browser-local');
});

test('launcher state preserves one playable shared screen', async () => {
  const response = await fetch(base + '/api/launcher-state');
  const body = await response.json();
  assert.equal(body.playablePath, '/games/014/');
  assert.equal(body.team.humanSeats, 2);
  assert.equal(body.team.localSharedScreen, true);
  assert.equal(body.team.splitScreen, false);
});

test('game and local runtime assets are served', async () => {
  for (const route of ['/games/014/', '/games/014/app.js', '/games/014/motion-system.js', '/games/014/coop-camera.js', '/games/014/hero-rig-contract.js', '/games/014/vendor/three.module.js', '/games/014/vendor/GLTFLoader.js', '/games/014/vendor/BufferGeometryUtils.js', '/games/014/assets/bonk-bolt-key-art-v1.png', '/games/014/assets/characters/quaternius/animated-men/man-casual-a.glb']) {
    const response = await fetch(base + route);
    assert.equal(response.status, 200, route);
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  }
  assert.equal((await fetch(base + '/games/014/assets/characters/quaternius/animated-men/man-casual-a.glb')).headers.get('content-type'), 'model/gltf-binary');
});

test('path traversal and unrelated routes are refused', async () => {
  assert.equal((await fetch(base + '/games/014/%2e%2e/%2e%2e/package.json')).status, 404);
  assert.equal((await fetch(base + '/server.js')).status, 404);
});
