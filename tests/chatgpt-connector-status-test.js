'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Status = require('../hub/chatgpt-connector-status');

(async function () {
  let calls = 0;
  const ready = Status.createInspector({
    findCandidates: () => ['C:\\safe\\codex.exe'],
    runLoginStatus: async () => { calls++; return { accessible: true, loginVerified: true, raw: 'SECRET-MUST-NOT-LEAK' }; },
    chatAppOpen: () => true,
    now: () => 1000,
    cacheMs: 100
  });
  const first = await ready.inspect();
  const second = await ready.inspect();
  assert.equal(first.schema, Status.SCHEMA);
  assert.equal(first.codingSeat.state, 'ready');
  assert.equal(first.codingSeat.loginVerified, true);
  assert.equal(first.chatApp.appOpen, true);
  assert.deepEqual(first.platformMcp, {
    state: 'manual', connected: false, safeTunnel: false,
    note: 'No explicit safe tunnel status is configured.'
  });
  assert.equal(JSON.stringify(first).includes('SECRET-MUST-NOT-LEAK'), false);
  assert.deepEqual(second, first);
  assert.equal(calls, 1, 'login status result is cached');

  const npmVendor = Status.codexCandidates({ APPDATA: 'C:\\Users\\mike\\AppData\\Roaming' }, {
    existsSync: () => true,
    statSync: () => ({ isFile: () => true, mtimeMs: 0 }),
    readdirSync: () => []
  });
  assert.ok(npmVendor.some(file => /@openai[\\/]codex-win32-x64[\\/]vendor[\\/]x86_64-pc-windows-msvc[\\/]bin[\\/]codex\.exe$/i.test(file)), 'npm-installed Codex vendor executable is a candidate');
  const syncFailure = await Status.runLoginStatus('C:\\blocked\\codex.exe', { execFile: () => { const error = new Error('blocked'); error.code = 'EACCES'; throw error; } });
  assert.equal(syncFailure.accessible, false, 'synchronous CLI launch failure is sanitized');
  assert.equal(syncFailure.loginVerified, false);

  const appOnly = Status.createInspector({
    findCandidates: () => ['C:\\safe\\codex.exe'],
    runLoginStatus: async () => ({ accessible: true, loginVerified: false }),
    chatAppOpen: () => true
  });
  const app = await appOnly.inspect();
  assert.equal(app.codingSeat.state, 'login-required');
  assert.equal(app.chatApp.appOpen, true);
  assert.equal(app.platformMcp.connected, false);

  const missing = Status.createInspector({ findCandidates: () => [], chatAppOpen: () => false });
  const off = await missing.inspect();
  assert.equal(off.codingSeat.state, 'unavailable');
  assert.equal(off.chatApp.appOpen, false);

  const presence = fs.readFileSync(path.join(__dirname, '..', 'hub', 'ai-presence.js'), 'utf8');
  const chatgptBlock = presence.slice(presence.indexOf('async function loadChatGPT'), presence.indexOf('async function loadBridgeAndModels'));
  assert.ok(chatgptBlock.includes("id:'codex',name:'Codex'"), 'verified coding seat uses the Codex identity');
  assert.ok(chatgptBlock.includes('platform.connected===true&&platform.safeTunnel===true'), 'ChatGPT READY requires an explicit connected safe tunnel');
  assert.ok(chatgptBlock.includes("label:'APP'"), 'process-only ChatGPT state is labelled APP');
  assert.equal(chatgptBlock.includes("label:'ACTIVE'"), false, 'process-only state is never labelled ACTIVE');
  assert.ok(chatgptBlock.includes("state:'offline'"), 'app-only state is not rendered as a connected seat');
  console.log('PASS ChatGPT connector status: sanitized fixed probe, cache, app-only state, manual MCP');
})().catch(error => { console.error(error.stack || error); process.exit(1); });
