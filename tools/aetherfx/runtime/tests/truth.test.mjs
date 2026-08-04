import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import net from 'node:net';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const delay = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

async function availablePort() {
  const server = net.createServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const { port } = server.address();
  await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  return port;
}

function request(port, requestPath, method = 'GET') {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: '127.0.0.1',
      port,
      path: requestPath,
      method
    }, response => {
      const chunks = [];
      response.on('data', chunk => chunks.push(chunk));
      response.on('end', () => resolve({
        status: response.statusCode,
        headers: response.headers,
        body: Buffer.concat(chunks).toString('utf8')
      }));
    });
    req.on('error', reject);
    req.end();
  });
}

async function waitForServer(port, child, diagnostics) {
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`Server exited early (${child.exitCode}). ${diagnostics()}`);
    }
    try {
      const response = await request(port, '/');
      if (response.status === 200) return response;
    } catch {
      // The child has not bound the port yet.
    }
    await delay(25);
  }
  throw new Error(`Server did not become ready. ${diagnostics()}`);
}

async function stopChild(child) {
  if (child.exitCode !== null) return;
  child.kill('SIGTERM');
  await Promise.race([once(child, 'exit'), delay(1000)]);
  if (child.exitCode === null) child.kill('SIGKILL');
}

test('photosensitive mode stops the actual sweep and shimmer selectors', () => {
  const css = read('styles/runtime.css');
  assert.match(css, /\.axm-stage\.is-photosensitive-safe \.fx-overlay-sweep,/);
  assert.match(css, /\.axm-stage\.is-photosensitive-safe \.fx-loading-shimmer::after,/);
  assert.match(css, /\.axm-stage\.is-photosensitive-safe[\s\S]*animation:\s*none !important/);
  assert.doesNotMatch(css, /is-photosensitive-safe \.fx-sweep-overlay/);
  assert.doesNotMatch(css, /is-photosensitive-safe \.fx-shimmer-loading/);
});

test('recipe import validates raw input before normalization and snapshots custom modules', () => {
  const app = read('src/app/app.js');
  const rawValidation = app.indexOf('const rawReport = AXM.Validator.validateRecipe(data, registry)');
  const normalization = app.indexOf('const normalized = composer.normalizeRecipe(data)', rawValidation);
  assert.ok(rawValidation >= 0, 'raw recipe validation missing');
  assert.ok(normalization > rawValidation, 'recipe normalized before raw validation');
  assert.match(app, /customModules:\s*AXM\.Utils\.clone\(registry\.customModules\(\)\)/);
  assert.match(app, /snapshot\.customModules\.forEach/);
  assert.match(app, /registry\.replaceFrom\(stagedRegistry\)/);
});

test('local server serves only contained files and survives malformed paths', async () => {
  const port = await availablePort();
  const child = spawn(process.execPath, ['start.mjs'], {
    cwd: ROOT,
    env: { ...process.env, PORT: String(port) },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let stdout = '';
  let stderr = '';
  child.stdout.on('data', chunk => { stdout += chunk; });
  child.stderr.on('data', chunk => { stderr += chunk; });
  const diagnostics = () => `${stdout}\n${stderr}`.trim();

  try {
    const root = await waitForServer(port, child, diagnostics);
    assert.match(root.body, /AXM AetherFX Visual Effect Fabric Studio/);
    assert.match(root.headers['content-security-policy'], /connect-src 'none'/);
    assert.equal(root.headers['referrer-policy'], 'no-referrer');
    assert.equal(root.headers['x-content-type-options'], 'nosniff');

    const head = await request(port, '/index.html', 'HEAD');
    assert.equal(head.status, 200);
    assert.equal(head.body, '');
    assert.ok(Number(head.headers['content-length']) > 1000);

    assert.equal((await request(port, '/%2e%2e%2fpackage.json')).status, 403);
    assert.equal((await request(port, '/%00index.html')).status, 400);
    assert.equal((await request(port, '/%E0%A4%A')).status, 400);
    assert.equal((await request(port, '/', 'POST')).status, 405);

    const after = await request(port, '/');
    assert.equal(after.status, 200, diagnostics());
    assert.equal(child.exitCode, null);
  } finally {
    await stopChild(child);
  }
});
