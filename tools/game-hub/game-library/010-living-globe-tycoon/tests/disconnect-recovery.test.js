#!/usr/bin/env node
'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const http = require('http');
const path = require('path');
const Runtime = require('../runtime/server');

const packageRoot = path.resolve(__dirname, '..');
const gameRoot = path.join(packageRoot, 'runtime', 'game');
const manifest = JSON.parse(fs.readFileSync(path.join(packageRoot, 'game.manifest.json'), 'utf8'));
const walkable = fs.readFileSync(path.join(gameRoot, 'index.html'), 'utf8');

function request(port, route) {
  return new Promise((resolve, reject) => {
    const call = http.get({hostname: '127.0.0.1', port, path: route}, response => {
      const chunks = [];
      response.on('data', chunk => chunks.push(chunk));
      response.on('end', () => resolve({
        status: response.statusCode,
        headers: response.headers,
        body: Buffer.concat(chunks)
      }));
    });
    call.setTimeout(2000, () => call.destroy(new Error('request timed out')));
    call.on('error', reject);
  });
}

function listen(server, port) {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port || 0, '127.0.0.1', resolve);
  });
}

function close(server) {
  return new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
}

function firstPartyRuntimeFiles(directory) {
  const files = [];
  for (const entry of fs.readdirSync(directory, {withFileTypes: true})) {
    if (entry.name === 'vendor' || entry.name === 'source') continue;
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...firstPartyRuntimeFiles(target));
    else if (/\.(?:html|js)$/i.test(entry.name)) files.push(target);
  }
  return files;
}

(async function main() {
  assert.equal(manifest.max_players, 1);
  assert.deepEqual(manifest.allowed_seat_types, ['human']);
  assert.equal(manifest.join.supports_qr, false);
  assert.equal(manifest.join.supports_lan_link, false);
  assert.equal(manifest.join.supports_room_code, false);
  assert.equal(manifest.controls.phone_controller, false);

  const firstPartySource = firstPartyRuntimeFiles(gameRoot)
    .map(file => fs.readFileSync(file, 'utf8'))
    .join('\n');
  assert.doesNotMatch(firstPartySource, /\bnew\s+WebSocket\s*\(|\bEventSource\s*\(|\bXMLHttpRequest\s*\(|\bnavigator\.sendBeacon\s*\(|\bfetch\s*\(/,
    'first-party gameplay code must not silently add a live transport');

  assert.match(walkable, /localStorage\.setItem\(SAVE_KEY,JSON\.stringify\(saveObject\(\)\)\)/);
  assert.match(walkable, /setInterval\(saveNow,5000\)/);
  assert.match(walkable, /addEventListener\('pagehide',saveNow\)/);
  assert.match(walkable, /restoreFrom\(_save\)/);
  assert.match(walkable, /continue · world age/);

  const original = Runtime.createServer({env: {}});
  await listen(original);
  const port = original.address().port;
  const before = await request(port, '/games/010/');
  const launcher = JSON.parse((await request(port, '/api/launcher-state')).body.toString('utf8'));
  assert.equal(before.status, 200);
  assert.deepEqual(launcher.controllerLinks, []);
  assert.equal(launcher.authority.session, 'managed-server');
  assert.equal(launcher.authority.world, 'browser-local-game-package');

  await close(original);
  await assert.rejects(request(port, '/health'),
    'a stopped static server must be observably unavailable');

  const restarted = Runtime.createServer({env: {}});
  await listen(restarted, port);
  try {
    const after = await request(port, '/games/010/');
    assert.equal(after.status, 200);
    assert.equal(
      crypto.createHash('sha256').update(after.body).digest('hex'),
      crypto.createHash('sha256').update(before.body).digest('hex'),
      'restart must serve the same production entry bytes'
    );
  } finally {
    await close(restarted);
  }

  console.log('Living Globe Tycoon disconnect boundary and static-server restart test: PASS');
})().catch(error => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
