'use strict';

const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const BrowserSession = require('../src/browser-session');
const LocalBrowserHost = require('../src/local-browser-host');
const Ai = require('../src/ai-broker');
const Digest = require('../src/digest');

const root = path.resolve(__dirname, '..');

function makeSession() {
  return new BrowserSession.LocalBrowserSession('fixtures/session-home.html', [
    'fixtures/session-about.html',
    'fixtures/session-details.html'
  ], { baseDirectory: root });
}

function makeRegistry() {
  return Ai.createRegistry([
    {
      id: 'local-nova',
      label: 'Local Nova',
      adapter: 'openai-compatible-chat',
      endpoint: 'http://127.0.0.1:1234/v1/chat/completions',
      model: 'local-model',
      enabled: true,
      visualStateAccess: true,
      researchAccess: true,
      local: true
    },
    {
      id: 'cloud',
      label: 'Cloud AI',
      adapter: 'openai-responses',
      model: 'configured-cloud-model',
      enabled: true,
      visualStateAccess: false,
      researchAccess: true
    }
  ], { mode: 'panel', researchModeEnabled: true, activeProviderId: 'local-nova' });
}

function researchRun(input) {
  const material = {
    schema: 'axm.web.research-run/v1',
    version: 1,
    status: 'PASS',
    researchPlanDigest: 'a'.repeat(64),
    question: input.question,
    mode: input.mode,
    visualStateDigest: input.visualState ? input.visualState.visualDigest : null,
    search: null,
    ai: {
      executionDigest: 'b'.repeat(64),
      providerIdsSucceeded: ['local-nova'],
      providerIdsFailed: [],
      outputs: [{
        providerId: 'local-nova',
        adapter: 'openai-compatible-chat',
        status: 'PASS',
        visualStateUsed: Boolean(input.visualState),
        searchEvidenceUsed: false,
        output: 'Research answer from the local provider.'
      }]
    },
    authority: {
      browserMutationAllowed: false,
      resultNavigationAllowed: false,
      backgroundExecutionUsed: false,
      searchNetworkExecutionUsed: false,
      aiNetworkExecutionUsed: true,
      resultContentTrusted: false,
      installAllowed: false,
      promotionAllowed: false,
      canonAllowed: false
    }
  };
  return Object.assign({}, material, { runDigest: Digest.canonicalDigest(material) });
}

async function post(url, origin, body) {
  return fetch(url, {
    method: 'POST',
    headers: Object.assign({ 'Content-Type': 'application/json' }, origin ? { Origin: origin } : {}),
    body: JSON.stringify(body),
    redirect: 'error'
  });
}

test('AI configuration launches a separate loopback control console without changing the browser shell origin', async function () {
  const session = makeSession();
  const host = await LocalBrowserHost.createLocalBrowserHost(session, { aiRegistry: makeRegistry() });
  try {
    assert.ok(host.aiControlUrl);
    assert.ok(host.aiControlReceipt);
    assert.equal(host.aiControlReceipt.schema, 'axm.web.browser-ai-control-host-receipt/v1');
    assert.equal(host.aiControlReceipt.loopbackTransportUsed, true);
    assert.equal(host.aiControlReceipt.externalNetworkUsedByControlHost, false);
    assert.notEqual(new URL(host.aiControlUrl).origin, host.receipt.origin);
    assert.equal(host.receipt.shellUrl.startsWith(host.receipt.origin), true);
  } finally {
    await host.close();
  }
});

test('control console HTML is hash-bound, local-only, and contains visible AI/research controls', async function () {
  const host = await LocalBrowserHost.createLocalBrowserHost(makeSession(), { aiRegistry: makeRegistry() });
  try {
    const response = await fetch(host.aiControlUrl, { cache: 'no-store' });
    assert.equal(response.status, 200);
    const html = await response.text();
    assert.match(String(response.headers.get('content-security-policy')), /default-src 'none'/);
    assert.match(String(response.headers.get('content-security-policy')), /connect-src 'self'/);
    assert.equal(response.headers.get('x-frame-options'), 'DENY');
    assert.match(html, /Swappable AI, visible authority/);
    assert.match(html, /id="ai-mode"/);
    assert.match(html, /id="active-provider"/);
    assert.match(html, /id="research-enabled"/);
    assert.match(html, /id="research-question"/);
    assert.match(html, /id="research-run"/);
    assert.doesNotMatch(html, /OPENAI_API_KEY|ANTHROPIC_API_KEY/);
  } finally {
    await host.close();
  }
});

test('control state exposes structured current-screen state and no credential references', async function () {
  const host = await LocalBrowserHost.createLocalBrowserHost(makeSession(), { aiRegistry: makeRegistry() });
  try {
    const response = await fetch(new URL('state', host.aiControlUrl), { cache: 'no-store' });
    assert.equal(response.status, 200);
    const state = await response.json();
    assert.equal(state.visualState.fidelity, 'STRUCTURED_SCREEN_MODEL');
    assert.equal(state.visualState.page.title.length > 0, true);
    assert.equal(state.providers.length, 2);
    assert.equal(state.providers[0].visualStateAccess, true);
    assert.equal(state.providers[1].visualStateAccess, false);
    assert.doesNotMatch(JSON.stringify(state), /OPENAI_API_KEY|ANTHROPIC_API_KEY/);
  } finally {
    await host.close();
  }
});

test('control mutations require the exact console Origin and then change only AI state', async function () {
  const session = makeSession();
  const before = session.snapshot();
  const host = await LocalBrowserHost.createLocalBrowserHost(session, { aiRegistry: makeRegistry() });
  try {
    const actionUrl = new URL('action', host.aiControlUrl);
    const missing = await post(actionUrl, null, { type: 'ai-provider-enabled', providerId: 'cloud', enabled: false });
    assert.equal(missing.status, 403);
    assert.equal((await missing.json()).code, 'CONTROL_ORIGIN_REQUIRED');

    const wrong = await post(actionUrl, 'http://127.0.0.1:1', { type: 'ai-provider-enabled', providerId: 'cloud', enabled: false });
    assert.equal(wrong.status, 403);
    assert.equal((await wrong.json()).code, 'CONTROL_ORIGIN_REFUSED');

    const origin = new URL(host.aiControlUrl).origin;
    const ok = await post(actionUrl, origin, { type: 'ai-provider-enabled', providerId: 'cloud', enabled: false });
    assert.equal(ok.status, 200);
    const state = await ok.json();
    assert.equal(state.providers.find(function (item) { return item.id === 'cloud'; }).enabled, false);
    assert.equal(session.snapshot().sessionDigest, before.sessionDigest);
    assert.equal(session.snapshot().transitionTrace.length, before.transitionTrace.length);
  } finally {
    await host.close();
  }
});

test('Research Mode console action keeps model output attributable and visual state observation-only', async function () {
  const observed = [];
  const host = await LocalBrowserHost.createLocalBrowserHost(makeSession(), {
    aiRegistry: makeRegistry(),
    researchRunner: async function (input) {
      observed.push(input);
      return researchRun(input);
    }
  });
  try {
    const actionUrl = new URL('action', host.aiControlUrl);
    const origin = new URL(host.aiControlUrl).origin;
    const response = await post(actionUrl, origin, {
      type: 'research-run',
      question: 'What is on the current screen?',
      mode: 'ai-only'
    });
    assert.equal(response.status, 200);
    const state = await response.json();
    assert.equal(observed.length, 1);
    assert.equal(observed[0].visualState.visualFidelity, 'STRUCTURED_SCREEN_MODEL');
    assert.equal(state.lastResearchRun.question, 'What is on the current screen?');
    assert.equal(state.lastResearchRun.ai.outputs[0].providerId, 'local-nova');
    assert.equal(state.lastResearchRun.ai.outputs[0].output, 'Research answer from the local provider.');
    assert.equal(state.lastResearchRun.authority.browserMutationAllowed, false);
    assert.equal(state.lastResearchRun.authority.resultNavigationAllowed, false);
  } finally {
    await host.close();
  }
});
