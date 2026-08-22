#!/usr/bin/env node
'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const root = path.resolve(__dirname, '..');
const serverFile = path.join(root, 'runtime', 'relaybound-server.cjs');
const atlasFile = path.join(root, 'runtime', 'assets', 'world', 'Textures', 'colormap.png');
const expectedHash = 'FC9E729B10296CCCC9466ECBB4DAC7EA0575E2A0798A72ED94D41B0B8A73D824';
const expectedBytes = 28309;
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

function sha256(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex').toUpperCase();
}

async function start(port) {
  const child = spawn(process.execPath, [serverFile], {
    env: {
      ...process.env,
      PORT: String(port),
      AXM_RELAYBOUND_HOST: '127.0.0.1',
      AXM_TEST_MODE: '1'
    },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true
  });
  let stderr = '';
  child.stderr.on('data', chunk => { stderr += chunk; });
  const base = 'http://127.0.0.1:' + port;
  for (let attempt = 0; attempt < 60; attempt++) {
    if (child.exitCode != null) throw new Error('Relaybound exited early: ' + stderr);
    try { if ((await fetch(base + '/health')).ok) return { base, child }; } catch (_) {}
    await wait(50);
  }
  child.kill();
  throw new Error('Relaybound did not become ready: ' + stderr);
}

async function stop(child) {
  if (child.exitCode != null) return;
  child.kill('SIGTERM');
  await Promise.race([new Promise(resolve => child.once('exit', resolve)), wait(1500)]);
}

(async () => {
  const atlas = fs.readFileSync(atlasFile);
  assert.strictEqual(atlas.length, expectedBytes, 'the official dungeon atlas byte count changed');
  assert.strictEqual(sha256(atlas), expectedHash, 'the official dungeon atlas hash changed');
  assert.deepStrictEqual([...atlas.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10], 'atlas must be a PNG');

  const worldDir = path.join(root, 'runtime', 'assets', 'world');
  const glbs = fs.readdirSync(worldDir).filter(name => name.endsWith('.glb'));
  assert.ok(glbs.length >= 8, 'expected the packaged Kenney dungeon GLBs');
  for (const name of glbs) {
    const bytes = fs.readFileSync(path.join(worldDir, name));
    assert.ok(bytes.includes(Buffer.from('Textures/colormap.png')), name + ' must reference the shared atlas');
  }

  const source = fs.readFileSync(serverFile, 'utf8');
  assert.ok(source.indexOf("fs.existsSync(file)") < source.indexOf("if (/\\/Textures\\/colormap"), 'packaged files must be checked before the fallback');
  const client = fs.readFileSync(path.join(root, 'runtime', 'relaybound-client.html'), 'utf8');
  assert.ok(client.includes("assetManager.setURLModifier(resource=>/Textures\\/colormap\\.png$/i.test(resource)?resource+'?atlas=fc9e729b':resource)"), 'the browser must bypass the obsolete fallback cache key');

  const running = await start(19920 + Math.floor(Math.random() * 160));
  try {
    const response = await fetch(running.base + '/assets/world/Textures/colormap.png');
    const delivered = Buffer.from(await response.arrayBuffer());
    assert.strictEqual(response.status, 200);
    assert.strictEqual(response.headers.get('content-type'), 'image/png');
    assert.strictEqual(response.headers.get('x-axm-asset-authority'), 'packaged');
    assert.match(response.headers.get('cache-control') || '', /max-age=0/);
    assert.strictEqual(delivered.length, expectedBytes);
    assert.strictEqual(sha256(delivered), expectedHash);
    console.log('Relaybound visual assets test: PASS');
  } finally {
    await stop(running.child);
  }
})().catch(error => { console.error(error.stack || error); process.exitCode = 1; });
