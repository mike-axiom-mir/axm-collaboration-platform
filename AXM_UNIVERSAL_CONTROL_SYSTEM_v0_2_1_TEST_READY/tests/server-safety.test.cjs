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
    try { const response = await fetch(url); if (response.ok) return; } catch {}
    await new Promise(resolve => setTimeout(resolve, 60));
  }
  throw new Error('reference server did not become healthy');
}
test('server rejects poison frames, resumes the same seat, and neutralizes stale phones', async t => {
  const root = path.resolve(__dirname, '..');
  const port = 8800;
  const pairCode = '135790';
  const child = spawn(process.execPath, ['server/reference-server.cjs'], {
    cwd: root,
    env: { ...process.env, PORT: String(port), AXM_PAIR_CODE: pairCode, AXM_CONTROLLER_STALE_MS: '1500' },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  t.after(() => { if (!child.killed) child.kill('SIGTERM'); });
  await waitForHealth(`http://127.0.0.1:${port}/health`);

  const screen = new WebSocket(`ws://127.0.0.1:${port}/ws?role=screen&code=${pairCode}&deviceId=screen-safety`);
  const screenInbox = new MessageInbox(screen);
  await waitForOpen(screen);
  await screenInbox.wait(message => message.type === 'welcome');

  const first = new WebSocket(`ws://127.0.0.1:${port}/ws?role=controller&code=${pairCode}&deviceId=stable-phone&player=p1`);
  const firstInbox = new MessageInbox(first);
  await waitForOpen(first);
  const welcome1 = await firstInbox.wait(message => message.type === 'welcome');
  assert.equal(welcome1.playerId,'p1');
  assert.ok(welcome1.resumeToken);
  await screenInbox.wait(message=>message.type==='controller_connected');

  first.send(JSON.stringify({
    protocol:'axm-input/0.1',type:'input_frame',deviceId:'stable-phone',playerId:'p1',sequence:1,
    clientSentAt:1,fullState:true,context:'gameplay',
    actions:[{id:'MOVE',value:{x:0,y:0}},{id:'MOVE',value:{x:1,y:0}}]
  }));
  const rejected=await firstInbox.wait(message=>message.type==='input_rejected');
  assert.ok(rejected.errors.some(error=>error.includes('duplicate')));

  first.send(JSON.stringify({
    protocol:'axm-input/0.1',type:'input_frame',deviceId:'stable-phone',playerId:'p1',sequence:2,
    clientSentAt:2,fullState:true,context:'gameplay',actions:[{id:'INVENTED_ACTION',value:1}]
  }));
  const unknownRejected=await firstInbox.wait(message=>message.type==='input_rejected' && message.sequence===2);
  assert.ok(unknownRejected.errors.some(error=>error.includes('unknown action')));

  first.close();
  await screenInbox.wait(message=>message.type==='controller_disconnected');

  const resumed = new WebSocket(`ws://127.0.0.1:${port}/ws?role=controller&code=${pairCode}&deviceId=stable-phone&player=p2&resumeToken=${encodeURIComponent(welcome1.resumeToken)}`);
  const resumedInbox = new MessageInbox(resumed);
  await waitForOpen(resumed);
  const welcome2=await resumedInbox.wait(message => message.type === 'welcome');
  assert.equal(welcome2.resumed,true);
  assert.equal(welcome2.playerId,'p1','valid resume token must preserve the previous player seat');
  await screenInbox.wait(message=>message.type==='controller_resumed');

  const neutral=await screenInbox.wait(message=>message.type==='input_frame' && message.context==='stale-timeout',5000);
  assert.equal(neutral.playerId,'p1');
  const disconnected=await screenInbox.wait(message=>message.type==='controller_disconnected' && message.reason==='stale-timeout',3000);
  assert.equal(disconnected.reason,'stale-timeout');

  const diagnosticsResponse = await fetch(`http://127.0.0.1:${port}/diagnostics`);
  assert.equal(diagnosticsResponse.ok,true);
  const diagnostics = await diagnosticsResponse.json();
  assert.equal(diagnostics.version,'0.2.1-test-ready');
  assert.ok(diagnostics.totals.resumes >= 1);
  assert.ok(diagnostics.totals.staleTimeouts >= 1);
  assert.ok(diagnostics.totals.rejectedFrames >= 2);
  assert.ok(diagnostics.recentEvents.some(event=>event.type==='controller_resumed'));
  assert.ok(diagnostics.recentEvents.some(event=>event.type==='controller_disconnected' && event.reason==='stale-timeout'));
  screen.close();
});
