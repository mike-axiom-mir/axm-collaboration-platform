'use strict';

const http = require('http');
const test = require('node:test');
const assert = require('node:assert/strict');
const Server = require('../server/server');

function get(port, route, headers = {}) {
  return new Promise((resolve, reject) => {
    const request = http.request({ host: '127.0.0.1', port, path: route, headers }, response => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', chunk => { body += chunk; });
      response.on('end', () => resolve({ status: response.statusCode, body }));
    });
    request.on('error', reject);
    request.end();
  });
}

test('health is public while learning state requires the local token', async t => {
  const server = Server.createServer({ port: 0 });
  await new Promise((resolve, reject) => server.listen(0, '127.0.0.1', error => error ? reject(error) : resolve()));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const port = server.address().port;
  assert.equal((await get(port, '/api/health')).status, 200);
  assert.equal((await get(port, '/api/catalog')).status, 401);
  const page = await get(port, '/');
  const match = page.body.match(/name="axm-learning-shell-token" content="([a-f0-9]{64})"/);
  assert.ok(match, 'same-origin UI receives the local token');
  assert.equal((await get(port, '/api/catalog', { authorization: `Bearer ${match[1]}` })).status, 200);
});
