import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { ReconnectingJsonSocket } from '../src/network/reconnecting-websocket.js';

const require = createRequire(import.meta.url);
const { MessageInbox } = require('./helpers/message-inbox.cjs');

if (typeof globalThis.CustomEvent === 'undefined') {
  globalThis.CustomEvent = class CustomEvent extends Event {
    constructor(type, options = {}) { super(type); this.detail = options.detail; }
  };
}

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
    try { const response = await fetch(url); if (response.ok) return; } catch {}
    await new Promise(resolve => setTimeout(resolve, 60));
  }
  throw new Error('reference server did not become healthy');
}

function waitForSocketMessage(socket, predicate, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { cleanup(); reject(new Error('message-object timeout')); }, timeoutMs);
    const listener = event => {
      if (!predicate(event.detail)) return;
      cleanup();
      resolve(event.detail);
    };
    const cleanup = () => { clearTimeout(timer); socket.removeEventListener('message-object', listener); };
    socket.addEventListener('message-object', listener);
  });
}

test('real reconnecting client survives a watchdog stall and resumes the same player seat', async t => {
  const root = path.resolve(import.meta.dirname, '..');
  const port = 8801;
  const pairCode = '864210';
  const child = spawn(process.execPath, ['server/reference-server.cjs'], {
    cwd: root,
    env: { ...process.env, PORT: String(port), AXM_PAIR_CODE: pairCode, AXM_CONTROLLER_STALE_MS: '650' },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  t.after(() => { if (!child.killed) child.kill('SIGTERM'); });
  await waitForHealth(`http://127.0.0.1:${port}/health`);

  const screen = new WebSocket(`ws://127.0.0.1:${port}/ws?role=screen&code=${pairCode}&deviceId=screen-live-reconnect`);
  const screenInbox = new MessageInbox(screen);
  await waitForOpen(screen);
  await screenInbox.wait(message => message.type === 'welcome');
  t.after(() => screen.close());

  let resumeToken = '';
  const client = new ReconnectingJsonSocket(
    () => `ws://127.0.0.1:${port}/ws?role=controller&code=${pairCode}&deviceId=live-phone&player=p1&resumeToken=${encodeURIComponent(resumeToken)}`,
    { minDelay: 40, maxDelay: 100, jitter: 0, heartbeatIntervalMs: 100, heartbeatTimeoutMs: 500 }
  );
  client.addEventListener('message-object', event => {
    if (event.detail.type === 'welcome' && event.detail.resumeToken) resumeToken = event.detail.resumeToken;
  });
  client.connect();
  t.after(() => client.close());

  const firstWelcome = await waitForSocketMessage(client, message => message.type === 'welcome');
  assert.equal(firstWelcome.playerId, 'p1');
  assert.equal(firstWelcome.resumed, false);
  await screenInbox.wait(message => message.type === 'controller_connected' && message.deviceId === 'live-phone');

  client.send({
    protocol:'axm-input/0.1',type:'input_frame',deviceId:'live-phone',playerId:'p1',sequence:1,
    clientSentAt:Date.now(),fullState:true,context:'gameplay',actions:[{id:'MOVE',value:{x:1,y:0}}]
  });
  const held = await screenInbox.wait(message => message.type === 'input_frame' && message.context === 'gameplay');
  assert.deepEqual(held.actions[0].value, {x:1,y:0});

  const resumedWelcomePromise = waitForSocketMessage(client, message => message.type === 'welcome' && message.resumed === true, 6000);
  client.suspendOutbound(1200);

  const neutral = await screenInbox.wait(message => message.type === 'input_frame' && message.context === 'stale-timeout', 5000);
  assert.equal(neutral.playerId, 'p1');
  assert.ok(neutral.actions.some(action => action.id === 'MOVE' && action.value.x === 0 && action.value.y === 0));
  await screenInbox.wait(message => message.type === 'controller_disconnected' && message.reason === 'stale-timeout', 3000);
  const resumedWelcome = await resumedWelcomePromise;
  assert.equal(resumedWelcome.playerId, 'p1');
  await screenInbox.wait(message => message.type === 'controller_resumed' && message.playerId === 'p1', 3000);

  client.send({
    protocol:'axm-input/0.1',type:'input_frame',deviceId:'live-phone',playerId:'p1',sequence:2,
    clientSentAt:Date.now(),fullState:true,context:'gameplay',actions:[{id:'MOVE',value:{x:0,y:0}}]
  });
  const afterResume = await screenInbox.wait(message => message.type === 'input_frame' && message.context === 'gameplay' && message.sequence === 2, 3000);
  assert.deepEqual(afterResume.actions[0].value, {x:0,y:0});
});
