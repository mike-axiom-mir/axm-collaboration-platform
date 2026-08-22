'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { spawn } = require('node:child_process');

async function waitForHealth(url, timeoutMs = 4000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try { const response = await fetch(url); if (response.ok) return; } catch {}
    await new Promise(resolve => setTimeout(resolve, 60));
  }
  throw new Error('reference server did not become healthy');
}

test('Saturday host, phone, session, and diagnostics surfaces are served locally', async t => {
  const root = path.resolve(__dirname, '..');
  const port = 8802;
  const pairCode = '112233';
  const child = spawn(process.execPath, ['server/reference-server.cjs'], {
    cwd: root,
    env: { ...process.env, PORT: String(port), AXM_PAIR_CODE: pairCode },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  t.after(() => { if (!child.killed) child.kill('SIGTERM'); });
  await waitForHealth(`http://127.0.0.1:${port}/health`);

  const [host, phone, session, diagnostics] = await Promise.all([
    fetch(`http://127.0.0.1:${port}/host`).then(response => response.text()),
    fetch(`http://127.0.0.1:${port}/phone?code=${pairCode}`).then(response => response.text()),
    fetch(`http://127.0.0.1:${port}/session`).then(response => response.json()),
    fetch(`http://127.0.0.1:${port}/diagnostics`).then(response => response.json())
  ]);

  assert.match(host, /DOWNLOAD TEST LOG/);
  assert.match(host, /Saturday fault test/);
  assert.match(phone, /SIMULATE 5s STALL/);
  assert.match(phone, /LIVE CONNECTION TEST/);
  assert.equal(session.version, '0.2.1-test-ready');
  assert.equal(session.pairCode, pairCode);
  assert.equal(diagnostics.version, '0.2.1-test-ready');
  assert.deepEqual(diagnostics.controllers, []);
});
