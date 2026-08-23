'use strict';

const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const BrowserSession = require('../src/browser-session');
const Visual = require('../src/browser-visual-state');
const Ai = require('../src/ai-broker');
const BrowserAiChat = require('../src/browser-ai-chat');
const LocalBrowserHost = require('../src/local-browser-host');

const root = path.resolve(__dirname, '..');

function makeSession() {
  return new BrowserSession.LocalBrowserSession('fixtures/session-home.html', [
    'fixtures/session-about.html',
    'fixtures/session-details.html'
  ], { baseDirectory: root });
}

function makeVisual(session) {
  return Visual.buildVisualState(session.snapshot(), {}, { sequence: 1 });
}

function makeRegistry() {
  return Ai.createRegistry([
    {
      id: 'local-one',
      label: 'Local One',
      adapter: 'openai-compatible-chat',
      endpoint: 'http://127.0.0.1:1234/v1/chat/completions',
      model: 'model-one',
      enabled: true,
      visualStateAccess: true,
      local: true
    },
    {
      id: 'local-two',
      label: 'Local Two',
      adapter: 'openai-compatible-chat',
      endpoint: 'http://127.0.0.1:1235/v1/chat/completions',
      model: 'model-two',
      enabled: true,
      visualStateAccess: false,
      local: true
    }
  ], { mode: 'single', activeProviderId: 'local-one' });
}

function fakeFetch() {
  return async function (url, init) {
    const body = JSON.parse(init.body);
    const prompt = body.messages[0].content;
    const answer = String(url).includes(':1235/')
      ? 'Second AI answer.'
      : (prompt.includes('Earlier question') ? 'Follow-up answer with thread context.' : 'First AI answer.');
    return new Response(JSON.stringify({ choices: [{ message: { content: answer } }] }), {
      status: 200,
      headers: { 'content-type': 'application/json' }
    });
  };
}

async function post(url, origin, body) {
  return fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: origin },
    body: JSON.stringify(body),
    redirect: 'error'
  });
}

test('browser AI chat keeps provider threads separate and obeys per-provider screen permission', async function () {
  const session = makeSession();
  const chat = new BrowserAiChat.LocalBrowserAiChat({
    aiRegistry: makeRegistry(),
    visualStateProvider: function () { return makeVisual(session); },
    aiNetworkAuthority: 'EXPLICIT_ALLOW',
    aiOptions: { allowLoopbackCompatible: true, fetchImpl: fakeFetch() }
  });

  let state = chat.state();
  assert.equal(state.selectedProviderId, 'local-one');
  assert.equal(state.available, true);
  assert.equal(state.executionConfigured, true);
  assert.equal(state.messages.length, 0);

  state = await chat.apply({ type: 'ai-chat-send', message: 'Earlier question' });
  assert.equal(state.messages.length, 2);
  assert.equal(state.messages[1].text, 'First AI answer.');
  assert.equal(state.messages[1].visualStateUsed, true);

  state = await chat.apply({ type: 'ai-chat-send', message: 'Continue that' });
  assert.equal(state.messages.length, 4);
  assert.equal(state.messages[3].text, 'Follow-up answer with thread context.');

  state = await chat.apply({ type: 'ai-chat-select', providerId: 'local-two' });
  assert.equal(state.messages.length, 0, 'switching AI changes to that AI-specific thread');
  state = await chat.apply({ type: 'ai-chat-send', message: 'What do you see?' });
  assert.equal(state.messages[1].text, 'Second AI answer.');
  assert.equal(state.messages[1].visualStateUsed, false, 'provider without screen permission never receives visual state');

  state = await chat.apply({ type: 'ai-chat-select', providerId: 'local-one' });
  assert.equal(state.messages.length, 4, 'switching back restores the first AI thread');
  assert.equal(state.authority.browserMutationAllowed, false);
  assert.equal(state.authority.searchExecutionGranted, false);
  assert.equal(state.authority.historyPersistenceAllowed, false);
});

test('browser AI chat refuses execution without explicit AI network authority', async function () {
  const session = makeSession();
  const chat = new BrowserAiChat.LocalBrowserAiChat({
    aiRegistry: makeRegistry(),
    visualStateProvider: function () { return makeVisual(session); },
    aiOptions: { allowLoopbackCompatible: true, fetchImpl: fakeFetch() }
  });
  await assert.rejects(
    function () { return chat.apply({ type: 'ai-chat-send', message: 'hello' }); },
    function (error) { return error && error.code === 'AI_NETWORK_NOT_AUTHORIZED'; }
  );
  const state = chat.state();
  assert.equal(state.executionConfigured, false);
  assert.equal(state.messages.length, 0);
  assert.equal(state.lastError.code, 'AI_NETWORK_NOT_AUTHORIZED');
});

test('AI-configured browser exposes a slide-up chat drawer and a separate frame-bounded chat origin', async function () {
  const session = makeSession();
  const before = session.snapshot();
  const host = await LocalBrowserHost.createLocalBrowserHost(session, {
    aiRegistry: makeRegistry(),
    aiChatConfig: {
      aiNetworkAuthority: 'EXPLICIT_ALLOW',
      aiOptions: { allowLoopbackCompatible: true, fetchImpl: fakeFetch() }
    }
  });
  try {
    assert.ok(host.aiChatUrl);
    assert.ok(host.aiChatReceipt);
    assert.equal(host.aiChatReceipt.schema, 'axm.web.browser-ai-chat-host-receipt/v1');
    assert.notEqual(new URL(host.aiChatUrl).origin, host.receipt.origin);
    assert.equal(host.receipt.externalNetworkUsed, false, 'main browser host remains external-network free');
    assert.equal(host.aiChatReceipt.authority.providerExecutionImplicit, false);
    assert.equal(host.aiChatReceipt.conversationPersistence, 'MEMORY_ONLY');

    const shellResponse = await fetch(host.receipt.shellUrl);
    const shell = await shellResponse.text();
    assert.equal(shellResponse.status, 200);
    assert.match(shell, /id="ai-chat-toggle"/);
    assert.match(shell, /id="ai-chat-drawer"/);
    assert.match(shell, /id="ai-chat-popout"/);
    assert.match(shell, /sandbox="allow-scripts allow-same-origin"/);
    assert.equal((shell.match(/<script>/g) || []).length, 1);
    const shellCsp = String(shellResponse.headers.get('content-security-policy'));
    assert.match(shellCsp, new RegExp('frame-src ' + new URL(host.aiChatUrl).origin.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    assert.match(shellCsp, /frame-ancestors 'none'/);

    const chatResponse = await fetch(host.aiChatUrl);
    const chatHtml = await chatResponse.text();
    assert.equal(chatResponse.status, 200);
    assert.match(chatHtml, /AXM Browser AI Chat/);
    assert.match(chatHtml, /MEMORY ONLY/);
    assert.equal(chatResponse.headers.get('x-frame-options'), null);
    assert.match(String(chatResponse.headers.get('content-security-policy')), new RegExp('frame-ancestors ' + host.receipt.origin.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));

    const origin = new URL(host.aiChatUrl).origin;
    const stateResponse = await fetch(new URL('state', host.aiChatUrl));
    assert.equal(stateResponse.status, 200);
    const state = await stateResponse.json();
    assert.equal(state.selectedProviderId, 'local-one');

    const sendResponse = await post(new URL('action', host.aiChatUrl), origin, {
      type: 'ai-chat-send',
      message: 'What is on this browser page?'
    });
    assert.equal(sendResponse.status, 200);
    const afterChat = await sendResponse.json();
    assert.equal(afterChat.messages[1].visualStateUsed, true);
    assert.equal(session.snapshot().sessionDigest, before.sessionDigest, 'chat cannot mutate Browser Session state');
    assert.equal(session.snapshot().transitionTrace.length, before.transitionTrace.length);
  } finally {
    await host.close();
  }
});

test('chat host mutations require the exact chat origin', async function () {
  const host = await LocalBrowserHost.createLocalBrowserHost(makeSession(), {
    aiRegistry: makeRegistry(),
    aiChatConfig: { aiNetworkAuthority: 'EXPLICIT_ALLOW', aiOptions: { allowLoopbackCompatible: true, fetchImpl: fakeFetch() } }
  });
  try {
    const actionUrl = new URL('action', host.aiChatUrl);
    const missing = await fetch(actionUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'ai-chat-clear' })
    });
    assert.equal(missing.status, 403);
    assert.equal((await missing.json()).code, 'AI_CHAT_ORIGIN_REQUIRED');

    const wrong = await post(actionUrl, host.receipt.origin, { type: 'ai-chat-clear' });
    assert.equal(wrong.status, 403);
    assert.equal((await wrong.json()).code, 'AI_CHAT_ORIGIN_REFUSED');
  } finally {
    await host.close();
  }
});
