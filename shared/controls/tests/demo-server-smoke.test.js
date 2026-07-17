'use strict';

const path = require('node:path');
const { spawn } = require('node:child_process');
const test = require('node:test');
const assert = require('node:assert/strict');

const root = path.join(__dirname, '..');

function waitForReady(child, timeoutMs = 4000) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Demo server readiness timed out.')), timeoutMs);
    let output = '';
    child.stdout.on('data', (chunk) => {
      output += chunk;
      if (output.includes('AXM control feel demo:')) {
        clearTimeout(timeout);
        resolve(output);
      }
    });
    child.once('exit', (code) => {
      clearTimeout(timeout);
      reject(new Error(`Demo server exited early with ${code}: ${output}`));
    });
  });
}

test('loopback demo serves HTML, profile, and bundled module', async () => {
  const port = 18000 + (process.pid % 1000);
  const child = spawn(process.execPath, [path.join(root, 'scripts', 'serve-demo.js')], {
    cwd: root,
    env: { ...process.env, PORT: String(port) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  try {
    await waitForReady(child);
    const html = await fetch(`http://127.0.0.1:${port}/`);
    assert.equal(html.status, 200);
    assert.match(await html.text(), /AXM Shared Controls/);
    const profile = await fetch(`http://127.0.0.1:${port}/profiles/top-down-twin-stick.json`);
    assert.equal((await profile.json()).profileId, 'axm-top-down-twin-stick-v1');
    const module = await fetch(`http://127.0.0.1:${port}/src/browser/axm-controller-runtime.mjs`);
    assert.equal(module.status, 200);
    assert.match(module.headers.get('content-type'), /text\/javascript/);
  } finally {
    if (child.exitCode === null) {
      child.kill('SIGTERM');
      await new Promise((resolve) => child.once('exit', resolve));
    }
  }
});
