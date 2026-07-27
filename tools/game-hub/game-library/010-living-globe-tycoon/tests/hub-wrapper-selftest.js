#!/usr/bin/env node
'use strict';

const assert = require('assert');
const http = require('http');
const fs = require('fs');
const path = require('path');
const Runtime = require('../runtime/server');

function request(port, route) {
  return new Promise((resolve, reject) => {
    http.get({hostname: '127.0.0.1', port, path: route}, response => {
      let body = '';
      response.on('data', chunk => { body += chunk; });
      response.on('end', () => resolve({status: response.statusCode, headers: response.headers, body}));
    }).on('error', reject);
  });
}

(async function main() {
  assert.equal(Runtime.selectedMode({AXM_GAME_PLAY_MODE: 'tycoon'}), 'rules-lab');
  assert.equal(Runtime.selectedMode({AXM_GAME_PLAY_MODE: 'rules-lab'}), 'rules-lab');
  assert.equal(Runtime.selectedMode({AXM_GAME_PLAY_MODE: 'walkable-globe'}), 'walkable-globe');
  assert.equal(Runtime.selectedMode({}), 'walkable-globe');
  assert.equal(Runtime.modeEntry('rules-lab'), '/games/010/game/tycoon-steward/');
  assert.ok(Runtime.safeFile('/games/010/game/tycoon-steward/index.html').startsWith(Runtime.GAME_ROOT));
  assert.equal(Runtime.safeFile('/games/010/../../server.js'), null);
  assert.ok(fs.existsSync(path.join(Runtime.GAME_ROOT, 'index.html')));
  assert.ok(fs.existsSync(path.join(Runtime.GAME_ROOT, 'game', 'tycoon-steward', 'index.html')));

  const server = Runtime.createServer({env: {}});
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  try {
    const port = server.address().port;
    const health = await request(port, '/health');
    assert.equal(health.status, 200);
    assert.equal(JSON.parse(health.body).mode, 'walkable-globe');
    const state = JSON.parse((await request(port, '/api/launcher-state')).body);
    assert.equal(state.partyScreenLinks.all, '/games/010/');
    assert.equal(state.authority.world, 'browser-local-game-package');
    assert.equal((await request(port, '/games/010/game/tycoon-steward/')).status, 200);
    assert.equal((await request(port, '/games/010/')).status, 200);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
  console.log('Living Globe Tycoon Game Hub wrapper: PASS');
})().catch(error => { console.error(error.stack || error); process.exitCode = 1; });
