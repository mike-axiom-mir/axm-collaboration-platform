'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { MessageInbox } = require('./helpers/message-inbox.cjs');

function waitForOpen(socket, timeoutMs = 3000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('WebSocket open timeout')), timeoutMs);
    socket.addEventListener('open', () => { clearTimeout(timer); resolve(); }, { once: true });
    socket.addEventListener('error', () => { clearTimeout(timer); reject(new Error('WebSocket error')); }, { once: true });
  });
}

async function waitForHealth(url, timeoutMs = 4000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 80));
  }
  throw new Error('reference server did not become healthy');
}

test('reference server pairs, forwards semantic frames, and neutralizes disconnect', async t => {
  const root = path.resolve(__dirname, '..');
  const port = 8799;
  const pairCode = '246810';
  const child = spawn(process.execPath, ['server/reference-server.cjs'], {
    cwd: root,
    env: { ...process.env, PORT: String(port), AXM_PAIR_CODE: pairCode, AXM_CONTROLLER_STALE_MS: '10000' },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  t.after(() => { if (!child.killed) child.kill('SIGTERM'); });
  await waitForHealth(`http://127.0.0.1:${port}/health`);

  const screen = new WebSocket(`ws://127.0.0.1:${port}/ws?role=screen&code=${pairCode}&deviceId=screen-test`);
  const screenInbox = new MessageInbox(screen);
  await waitForOpen(screen);
  const screenWelcome = await screenInbox.wait(message => message.type === 'welcome');
  assert.equal(screenWelcome.role, 'screen');

  const controller = new WebSocket(`ws://127.0.0.1:${port}/ws?role=controller&code=${pairCode}&deviceId=phone-test&player=p1`);
  const controllerInbox = new MessageInbox(controller);
  await waitForOpen(controller);
  const controllerWelcome = await controllerInbox.wait(message => message.type === 'welcome');
  assert.equal(controllerWelcome.playerId, 'p1');
  const connected = await screenInbox.wait(message => message.type === 'controller_connected');
  assert.equal(connected.type, 'controller_connected');

  controller.send(JSON.stringify({
    protocol: 'axm-input/0.1', type: 'input_frame', deviceId: 'phone-test', playerId: 'p1',
    sequence: 1, clientSentAt: 123, fullState: true, context: 'gameplay',
    actions: [{ id: 'MOVE', value: { x: 0.5, y: 0 } }, { id: 'PRIMARY_ACTION', value: 1 }]
  }));
  const forwarded = await screenInbox.wait(message => message.type === 'input_frame' && message.context === 'gameplay');
  assert.equal(forwarded.type, 'input_frame');
  assert.equal(forwarded.playerId, 'p1');
  assert.ok(Number.isFinite(forwarded.serverReceivedAt));
  assert.ok(Number.isFinite(forwarded.serverSentAt));

  controller.close();
  const neutral = await screenInbox.wait(message => message.type === 'input_frame' && message.context === 'disconnect');
  const disconnected = await screenInbox.wait(message => message.type === 'controller_disconnected');
  assert.equal(neutral.playerId, 'p1');
  assert.equal(disconnected.playerId, 'p1');
  screen.close();
});
