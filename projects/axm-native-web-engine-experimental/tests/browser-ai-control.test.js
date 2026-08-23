'use strict';

const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const BrowserSession = require('../src/browser-session');
const LocalBrowserHost = require('../src/local-browser-host');
const Ai = require('../src/ai-broker');
const BrowserAiControl = require('../src/browser-ai-control');

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

test('browser AI control state exposes switches without secret references or execution authority', function () {
  const control = new BrowserAiControl.LocalBrowserAiControl({ aiRegistry: makeRegistry() });
  const state = control.state();
  assert.equal(state.schema, 'axm.web.browser-ai-control-state/v1');
  assert.equal(state.providers.length, 2);
  assert.equal(state.providers[0].enabled, true);
  assert.equal(state.providers[0].visualStateAccess, true);
  assert.equal(state.providers[1].visualStateAccess, false);
  assert.equal(state.authority.providerExecutionGranted, false);
  assert.equal(state.authority.searchExecutionGranted, false);
  assert.doesNotMatch(JSON.stringify(state), /OPENAI_API_KEY|ANTHROPIC_API_KEY/);
});

test('provider and visual switches do not mutate Browser Session navigation state', async function () {
  const session = makeSession();
  const before = session.snapshot();
  const control = new BrowserAiControl.LocalBrowserAiControl({ aiRegistry: makeRegistry() });
  await control.apply({ type: 'ai-provider-enabled', providerId: 'cloud', enabled: false }, session.snapshot());
  await control.apply({ type: 'ai-visual-access', providerId: 'local-nova', enabled: false }, session.snapshot());
  const after = session.snapshot();
  assert.equal(after.sessionDigest, before.sessionDigest);
  assert.equal(after.transitionTrace.length, before.transitionTrace.length);
  const state = control.state();
  assert.equal(state.providers.find(function (item) { return item.id === 'cloud'; }).enabled, false);
  assert.equal(state.providers.find(function (item) { return item.id === 'local-nova'; }).visualStateAccess, false);
});

test('visual-report binds DOM geometry to the current browser session without page mutation', async function () {
  const session = makeSession();
  const before = session.snapshot();
  const page = before.bundle.pages.find(function (candidate) { return candidate.pageId === before.state.current.pageId; });
  const control = new BrowserAiControl.LocalBrowserAiControl({ aiRegistry: makeRegistry() });
  const state = await control.apply({
    type: 'visual-report',
    report: {
      viewport: { width: 900, height: 700, scrollX: 0, scrollY: 90, devicePixelRatio: 1.5 },
      theme: 'midnight',
      density: 'comfortable',
      textScale: 'normal',
      focusMode: 'full',
      metadataVisible: true,
      filter: '',
      focusedEntryRef: page.entries[0].entryId,
      visibleEntries: [{
        entryRef: page.entries[0].entryId,
        rect: { x: 12, y: 72, width: 700, height: 130 },
        visibilityRatio: 1
      }]
    }
  }, session.snapshot());
  assert.equal(state.visualState.fidelity, 'DOM_GEOMETRY');
  assert.equal(state.visualState.visibleEntryCount, 1);
  assert.equal(session.snapshot().sessionDigest, before.sessionDigest);
});

test('Research Mode control refuses execution when the host has no configured runner', async function () {
  const control = new BrowserAiControl.LocalBrowserAiControl({ aiRegistry: makeRegistry() });
  await assert.rejects(function () {
    return control.apply({ type: 'research-run', question: 'research this' }, makeSession().snapshot());
  }, function (error) { return error && error.code === 'BROWSER_RESEARCH_EXECUTION_UNCONFIGURED'; });
});

test('Research Mode runner gets current AI registry and visual state and returns an attributable run', async function () {
  const session = makeSession();
  const page = session.snapshot().bundle.pages.find(function (candidate) { return candidate.pageId === session.snapshot().state.current.pageId; });
  let observed = null;
  const control = new BrowserAiControl.LocalBrowserAiControl({
    aiRegistry: makeRegistry(),
    researchRunner: async function (input) {
      observed = input;
      return {
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
          outputs: [{ providerId: 'local-nova', status: 'PASS', output: 'answer' }]
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
        },
        runDigest: 'c'.repeat(64)
      };
    }
  });
  await control.apply({
    type: 'visual-report',
    report: { visibleEntries: [{ entryRef: page.entries[0].entryId, rect: null }] }
  }, session.snapshot());
  const state = await control.apply({ type: 'research-run', question: 'What is visible?', mode: 'ai-only' }, session.snapshot());
  assert.ok(observed);
  assert.equal(observed.question, 'What is visible?');
  assert.equal(observed.aiRegistry.registryDigest, control.registry.registryDigest);
  assert.equal(observed.visualState.visualDigest, control.visualState.visualDigest);
  assert.equal(state.lastResearchRun.question, 'What is visible?');
  assert.equal(state.researchRunning, false);
});

test('local browser host exposes one shared AI control plane and a structured visual fallback', async function () {
  const session = makeSession();
  const host = await LocalBrowserHost.createLocalBrowserHost(session, { aiRegistry: makeRegistry() });
  try {
    assert.ok(host.aiControl);
    const controlState = host.controlState();
    assert.equal(controlState.registryDigest, makeRegistry().registryDigest);
    assert.equal(controlState.visualState.fidelity, 'STRUCTURED_SCREEN_MODEL');
    assert.equal(controlState.visualState.page.pageId, session.snapshot().state.current.pageId);
    assert.equal(host.visualState().visualDigest, host.aiControl.visualState.visualDigest);
    await host.aiControl.apply({ type: 'ai-provider-enabled', providerId: 'cloud', enabled: false }, session.snapshot());
    assert.equal(host.controlState().providers.find(function (item) { return item.id === 'cloud'; }).enabled, false);
  } finally {
    await host.close();
  }
});
