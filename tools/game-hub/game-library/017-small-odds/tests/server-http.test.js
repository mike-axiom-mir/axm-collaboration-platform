'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const { createServer, safeRuntimePath } = require('../runtime/server.cjs');

function request(port, pathname) {
  return new Promise((resolve, reject) => {
    const call = http.get({ host:'127.0.0.1', port, path:pathname }, response => {
      const chunks = [];
      response.on('data', chunk => chunks.push(chunk));
      response.on('end', () => resolve({ status:response.statusCode, headers:response.headers, body:Buffer.concat(chunks).toString('utf8') }));
    });
    call.on('error', reject);
  });
}

test('safe path refuses traversal outside runtime', () => {
  assert.equal(safeRuntimePath('/games/017/../../game.manifest.json'), null);
  assert.match(safeRuntimePath('/games/017/app.js'), /runtime[\\/]app\.js$/);
});

test('local server serves health, launch authority, HTML, modules, and key art', async t => {
  const server = createServer({ nonce:'test-nonce', startedAt:'2026-07-28T00:00:00.000Z' });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const port = server.address().port;
  const health = await request(port, '/health');
  assert.equal(health.status, 200);
  assert.equal(JSON.parse(health.body).gameId, '017-small-odds');
  const session = await request(port, '/api/session');
  assert.equal(JSON.parse(session.body).nonce, 'test-nonce');
  const html = await request(port, '/games/017/');
  assert.equal(html.status, 200);
  assert.match(html.body, /SMALL ODDS/);
  assert.match(html.headers['content-security-policy'], /default-src 'self'/);
  const module = await request(port, '/games/017/systems.js');
  assert.equal(module.status, 200);
  assert.match(module.headers['content-type'], /text\/javascript/);
  const art = await request(port, '/games/017/assets/small-odds-key-art-v1.png');
  assert.equal(art.status, 200);
  assert.equal(art.headers['content-type'], 'image/png');
  assert.ok(Number(art.headers['content-length']) > 2_000_000);
  const foreign = await request(port, '/server.js');
  assert.equal(foreign.status, 404);
});
