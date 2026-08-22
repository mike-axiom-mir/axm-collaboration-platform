#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const http = require('http');
const path = require('path');
const Shell = require('./steam-shell-server');

function request(port, route, options = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({ hostname: '127.0.0.1', port, path: route, method: options.method || 'GET' }, response => {
      let body = '';
      response.on('data', chunk => { body += chunk; });
      response.on('end', () => resolve({ statusCode: response.statusCode, headers: response.headers, body }));
    });
    req.on('error', reject);
    if (options.body) req.write(options.body);
    req.end();
  });
}

async function main() {
  const index = Shell.resolvePublicFile(Shell.ROOT, '/tools/game-hub/index.html');
  assert.ok(index && fs.existsSync(index));
  assert.strictEqual(Shell.resolvePublicFile(Shell.ROOT, '/server.js'), null);
  assert.strictEqual(Shell.resolvePublicFile(Shell.ROOT, '/hub/index.html'), null);
  assert.strictEqual(Shell.resolvePublicFile(Shell.ROOT, '/tools/game-hub/asset-inbox/example/asset.png'), null);
  assert.strictEqual(Shell.safeInside(path.join(Shell.ROOT, 'tools', 'game-hub'), '..\\..\\server.js'), null);

  const server = Shell.createSteamShellServer({ gameHubPort: 1 });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const port = server.address().port;
  try {
    const health = await request(port, '/health');
    assert.strictEqual(health.statusCode, 200);
    assert.strictEqual(JSON.parse(health.body).name, 'AXM Steam GameHub Shell');
    const home = await request(port, '/?distribution=steam');
    assert.strictEqual(home.statusCode, 200);
    assert.match(home.body, /AXM Game Night/);
    assert.match(home.headers['content-security-policy'], /default-src/);
    const worlds = await request(port, '/worlds/world-registry.json');
    assert.deepStrictEqual(JSON.parse(worlds.body).worlds, []);
    const inbox = await request(port, '/game-api/assets/inbox');
    assert.deepStrictEqual(JSON.parse(inbox.body).handoffs, []);
    const accept = await request(port, '/game-api/assets/accept', { method: 'POST', body: '{}' });
    assert.strictEqual(accept.statusCode, 403);
    const workshop = await request(port, '/hub/index.html');
    assert.strictEqual(workshop.statusCode, 404);
    const traversal = await request(port, '/tools/game-hub/%2e%2e/%2e%2e/server.js');
    assert.strictEqual(traversal.statusCode, 404);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
  console.log('steam shell server selftest: PASS · dedicated GameHub surface · Workshop routes blocked');
}

if (require.main === module) main().catch(error => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});

module.exports = { main, request };
