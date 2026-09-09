'use strict';

const assert = require('assert');
const childProcess = require('child_process');
const fs = require('fs');
const http = require('http');
const net = require('net');
const os = require('os');
const path = require('path');

const root = path.resolve(__dirname, '..');

function availablePort() {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const port = probe.address().port;
      probe.close((error) => error ? reject(error) : resolve(port));
    });
  });
}

function request(port, method, route, headers, body) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: '127.0.0.1',
      port,
      method,
      path: route,
      headers: Object.assign({}, headers || {}, body == null ? {} : {
        'content-length': Buffer.byteLength(body),
      }),
      timeout: 3000,
    }, (res) => {
      let text = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { text += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, text }));
    });
    req.once('timeout', () => req.destroy(new Error('request timed out')));
    req.once('error', reject);
    if (body != null) req.write(body);
    req.end();
  });
}

async function waitForHealth(port, child, output) {
  const deadline = Date.now() + 20000;
  while (Date.now() < deadline) {
    if (child.exitCode != null) {
      throw new Error('Workshop exited before health check:\n' + output());
    }
    try {
      const response = await request(port, 'GET', '/api/health');
      if (response.status === 200) return;
    } catch (_) {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('Workshop health check timed out:\n' + output());
}

async function main() {
  const sessionHome = fs.mkdtempSync(path.join(os.tmpdir(), 'axm-origin-boundary-'));
  const port = await availablePort();
  let output = '';
  const child = childProcess.spawn(process.execPath, ['server.js'], {
    cwd: root,
    env: Object.assign({}, process.env, {
      AXM_NO_BROWSER: '1',
      AXM_PORT: String(port),
      AXM_PRODUCTION_SESSION_ID: 'origin-boundary-selftest',
      AXM_PRODUCTION_SESSION_HOME: sessionHome,
    }),
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.on('data', (chunk) => { output = (output + chunk).slice(-12000); });
  child.stderr.on('data', (chunk) => { output = (output + chunk).slice(-12000); });

  try {
    await waitForHealth(port, child, () => output);

    const attackBody = JSON.stringify({ filename: 'cross-site.txt', content: 'must-not-write' });
    const crossSite = await request(port, 'POST', '/api/export', {
      'content-type': 'text/plain',
      origin: 'https://attacker.invalid',
      'sec-fetch-site': 'cross-site',
    }, attackBody);
    assert.equal(crossSite.status, 403, 'cross-site simple POST must be refused');
    assert.equal(fs.existsSync(path.join(sessionHome, 'exports', 'cross-site.txt')), false,
      'refused cross-site POST must not reach local state');

    const rebound = await request(port, 'POST', '/api/export', {
      'content-type': 'text/plain',
      host: 'attacker.invalid:' + port,
      origin: 'http://attacker.invalid:' + port,
      'sec-fetch-site': 'same-origin',
    }, JSON.stringify({ filename: 'rebound.txt', content: 'must-not-write' }));
    assert.equal(rebound.status, 403, 'non-loopback origin must not gain authority through a rebound Host header');
    assert.equal(fs.existsSync(path.join(sessionHome, 'exports', 'rebound.txt')), false,
      'refused rebound POST must not reach local state');

    const opaque = await request(port, 'POST', '/api/export', {
      'content-type': 'text/plain',
      origin: 'null',
    }, JSON.stringify({ filename: 'opaque.txt', content: 'must-not-write' }));
    assert.equal(opaque.status, 403, 'opaque browser origin must be refused');

    const localBody = JSON.stringify({ filename: 'same-origin.txt', content: 'local-browser' });
    const sameOrigin = await request(port, 'POST', '/api/export', {
      'content-type': 'application/json',
      origin: 'http://127.0.0.1:' + port,
      'sec-fetch-site': 'same-origin',
    }, localBody);
    assert.equal(sameOrigin.status, 200, 'same-origin local browser POST must remain available');
    assert.equal(fs.readFileSync(path.join(sessionHome, 'exports', 'same-origin.txt'), 'utf8'), 'local-browser');

    const cli = await request(port, 'POST', '/api/export', {
      'content-type': 'application/json',
    }, JSON.stringify({ filename: 'local-cli.txt', content: 'local-cli' }));
    assert.equal(cli.status, 200, 'origin-less local CLI POST must remain available');
    assert.equal(fs.readFileSync(path.join(sessionHome, 'exports', 'local-cli.txt'), 'utf8'), 'local-cli');

    const crossSiteRead = await request(port, 'GET', '/api/health', {
      origin: 'https://attacker.invalid',
      'sec-fetch-site': 'cross-site',
    });
    assert.equal(crossSiteRead.status, 200, 'read-only health check remains non-mutating and available');

    console.log('PASS local browser authority: cross-site/opaque/rebinding writes refused; same-origin browser and local CLI writes retained');
  } finally {
    if (child.exitCode == null) child.kill('SIGTERM');
    await new Promise((resolve) => {
      if (child.exitCode != null) return resolve();
      child.once('exit', resolve);
      setTimeout(resolve, 3000);
    });
    fs.rmSync(sessionHome, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error('FAIL local browser authority: ' + error.stack);
  process.exitCode = 1;
});
