'use strict';

const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const Digest = require('../src/digest');
const BrowserSession = require('../src/browser-session');
const Visual = require('../src/browser-visual-state');
const Ai = require('../src/ai-broker');
const AiExecutor = require('../src/ai-executor');
const Search = require('../src/search-broker');
const Research = require('../src/research-mode');

const root = path.resolve(__dirname, '..');

function sessionSnapshot() {
  return new BrowserSession.LocalBrowserSession('fixtures/session-home.html', [
    'fixtures/session-about.html',
    'fixtures/session-details.html'
  ], { baseDirectory: root }).snapshot();
}

function visualState() {
  const snapshot = sessionSnapshot();
  const page = snapshot.bundle.pages.find(function (candidate) { return candidate.pageId === snapshot.state.current.pageId; });
  return Visual.buildVisualState(snapshot, {
    viewport: { width: 1200, height: 760, scrollX: 0, scrollY: 120, devicePixelRatio: 2 },
    theme: 'paper',
    density: 'compact',
    textScale: 'large',
    focusMode: 'reading',
    metadataVisible: false,
    filter: 'research',
    activeElementId: page.entries[0].entryId,
    focusedEntryRef: page.entries[0].entryId,
    visibleEntries: page.entries.slice(0, 2).map(function (entry, index) {
      return {
        entryRef: entry.entryId,
        rect: { x: 20, y: 80 + index * 180, width: 720, height: 160 },
        visibilityRatio: index === 0 ? 1 : 0.7
      };
    })
  }, { sequence: 7 });
}

function registry(options) {
  options = options || {};
  return Ai.createRegistry([
    {
      id: 'local-nova',
      label: 'Local Nova',
      adapter: 'openai-compatible-chat',
      endpoint: 'http://127.0.0.1:1234/v1/chat/completions',
      model: 'local-model',
      enabled: options.localEnabled !== false,
      visualStateAccess: options.localVisual !== false,
      researchAccess: true,
      local: true
    },
    {
      id: 'openai-cloud',
      label: 'OpenAI Cloud',
      adapter: 'openai-responses',
      model: 'configured-openai-model',
      enabled: options.openaiEnabled !== false,
      visualStateAccess: options.openaiVisual === true,
      researchAccess: true
    },
    {
      id: 'anthropic-cloud',
      label: 'Anthropic Cloud',
      adapter: 'anthropic-messages',
      model: 'configured-anthropic-model',
      enabled: options.anthropicEnabled === true,
      visualStateAccess: true,
      researchAccess: options.anthropicResearch !== false
    }
  ], {
    mode: options.mode || 'panel',
    researchModeEnabled: options.researchModeEnabled !== false,
    activeProviderId: 'local-nova'
  });
}

function fakeSearchResult(query) {
  return Search.parseProviderResponse('searxng', {
    results: [
      { title: 'Primary source', url: 'https://example.com/source?utm_source=test', content: 'Evidence summary' },
      { title: 'Second source', url: 'https://example.org/other', content: 'Second perspective' }
    ]
  }, { query, count: 10 });
}

test('browser visual state binds current screen options, geometry, and session lineage', function () {
  const state = visualState();
  assert.equal(state.schema, 'axm.web.browser-visual-state/v1');
  assert.equal(state.visualFidelity, 'DOM_GEOMETRY');
  assert.equal(state.sequence, 7);
  assert.equal(state.shell.theme, 'paper');
  assert.equal(state.shell.density, 'compact');
  assert.equal(state.shell.textScale, 'large');
  assert.equal(state.shell.focusMode, 'reading');
  assert.equal(state.visibleEntryCount, 2);
  assert.equal(state.visibleEntries[0].visibilityRatio, 1);
  assert.equal(state.authority.observationOnly, true);
  assert.equal(state.authority.browserMutationAllowed, false);
  const material = JSON.parse(JSON.stringify(state));
  delete material.visualDigest;
  assert.equal(state.visualDigest, Digest.canonicalDigest(material));
});

test('visual state refuses geometry for entries that are not on the current page', function () {
  const snapshot = sessionSnapshot();
  assert.throws(function () {
    Visual.buildVisualState(snapshot, { visibleEntries: [{ entryRef: 'entry-does-not-exist', rect: null }] });
  }, function (error) { return error && error.code === 'VISUAL_STATE_ENTRY_UNKNOWN'; });
});

test('AI registry can turn providers and visual access on and off independently', function () {
  const base = registry({ openaiVisual: false });
  const disabled = Ai.setProviderEnabled(base, 'openai-cloud', false);
  const hidden = Ai.setVisualStateAccess(disabled, 'local-nova', false);
  assert.equal(base.providers.find(function (item) { return item.id === 'openai-cloud'; }).enabled, true);
  assert.equal(disabled.providers.find(function (item) { return item.id === 'openai-cloud'; }).enabled, false);
  assert.equal(hidden.providers.find(function (item) { return item.id === 'local-nova'; }).visualStateAccess, false);
  assert.notEqual(base.registryDigest, disabled.registryDigest);
  assert.notEqual(disabled.registryDigest, hidden.registryDigest);
});

test('AI single mode swaps active provider without changing other provider configuration', function () {
  let current = Ai.setRegistryMode(registry({ mode: 'panel' }), 'single');
  current = Ai.setActiveProvider(current, 'openai-cloud');
  const plan = Ai.buildAiPlan('Summarize the visible page', current, { visualState: visualState() });
  assert.deepEqual(plan.providerIds, ['openai-cloud']);
  assert.equal(plan.requests[0].visualStateAttached, false);
});

test('panel AI plan sends visual state only to providers individually allowed to see it', function () {
  const state = visualState();
  const plan = Ai.buildAiPlan('Compare the visible page with research evidence', registry({ mode: 'panel', openaiVisual: false }), {
    visualState: state,
    searchResultSet: fakeSearchResult('browser research')
  });
  assert.deepEqual(plan.providerIds, ['local-nova', 'openai-cloud']);
  const local = plan.requests.find(function (request) { return request.providerId === 'local-nova'; });
  const cloud = plan.requests.find(function (request) { return request.providerId === 'openai-cloud'; });
  assert.equal(local.visualStateAttached, true);
  assert.equal(cloud.visualStateAttached, false);
  assert.equal(local.searchEvidenceAttached, true);
  assert.equal(cloud.searchEvidenceAttached, true);
  assert.match(JSON.stringify(local.body), new RegExp(state.visualDigest));
  assert.doesNotMatch(JSON.stringify(cloud.body), new RegExp(state.visualDigest));
});

test('AI plans contain credential references but never resolve secret values', function () {
  const plan = Ai.buildAiPlan('Research test', registry({ mode: 'panel' }), {});
  const text = JSON.stringify(plan);
  assert.match(text, /OPENAI_API_KEY/);
  assert.doesNotMatch(text, /super-secret-value/);
  assert.equal(plan.authority.networkExecutionGranted, false);
  assert.equal(plan.authority.toolExecutionGranted, false);
});

test('AI executor refuses every provider until explicit network authority is supplied', async function () {
  const plan = Ai.buildAiPlan('Local test', Ai.setRegistryMode(registry({ openaiEnabled: false }), 'single'), {});
  await assert.rejects(function () { return AiExecutor.executeAiPlan(plan, {}); }, function (error) {
    return error && error.code === 'AI_NETWORK_NOT_AUTHORIZED';
  });
});

test('loopback OpenAI-compatible AI executes only with explicit loopback permission', async function () {
  const reg = Ai.setRegistryMode(registry({ openaiEnabled: false }), 'single');
  const plan = Ai.buildAiPlan('Local test', reg, {});
  const result = await AiExecutor.executeAiPlan(plan, {
    networkAuthority: 'EXPLICIT_ALLOW',
    allowLoopbackCompatible: true,
    fetchImpl: async function (url, init) {
      assert.equal(url, 'http://127.0.0.1:1234/v1/chat/completions');
      assert.equal(init.credentials, 'omit');
      assert.equal(init.redirect, 'error');
      return new Response(JSON.stringify({ choices: [{ message: { content: 'local answer' } }] }), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      });
    }
  });
  assert.equal(result.status, 'PASS');
  assert.equal(result.outputs[0].output, 'local answer');
  assert.equal(result.outputs[0].visualStateUsed, false);
});

test('OpenAI secret is materialized only into the outbound header and redacted from execution output', async function () {
  let reg = Ai.setRegistryMode(registry({ localEnabled: false }), 'single');
  reg = Ai.setActiveProvider(reg, 'openai-cloud');
  const plan = Ai.buildAiPlan('Cloud test', reg, {});
  const result = await AiExecutor.executeAiPlan(plan, {
    networkAuthority: 'EXPLICIT_ALLOW',
    env: { OPENAI_API_KEY: 'super-secret-value' },
    fetchImpl: async function (url, init) {
      assert.equal(url, 'https://api.openai.com/v1/responses');
      assert.equal(init.headers.Authorization, 'Bearer super-secret-value');
      return new Response(JSON.stringify({ output_text: 'cloud answer' }), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      });
    }
  });
  assert.equal(result.outputs[0].output, 'cloud answer');
  assert.doesNotMatch(JSON.stringify(result), /super-secret-value/);
});

test('AI executor rejects re-digested endpoint tampering before transport', async function () {
  let reg = Ai.setRegistryMode(registry({ localEnabled: false }), 'single');
  reg = Ai.setActiveProvider(reg, 'openai-cloud');
  const plan = Ai.buildAiPlan('Cloud test', reg, {});
  const tampered = JSON.parse(JSON.stringify(plan));
  tampered.requests[0].url = 'https://example.com/v1/responses';
  delete tampered.planDigest;
  tampered.planDigest = Digest.canonicalDigest(tampered);
  let called = false;
  await assert.rejects(function () {
    return AiExecutor.executeAiPlan(tampered, {
      networkAuthority: 'EXPLICIT_ALLOW',
      env: { OPENAI_API_KEY: 'secret' },
      fetchImpl: async function () { called = true; throw new Error('must not execute'); }
    });
  }, function (error) { return error && error.code === 'AI_PROVIDER_FAILED'; });
  assert.equal(called, false);
});

test('AI executor independently binds body and credential references after re-digest', async function () {
  let reg = Ai.setRegistryMode(registry({ localEnabled: false }), 'single');
  reg = Ai.setActiveProvider(reg, 'openai-cloud');
  const plan = Ai.buildAiPlan('Cloud test', reg, {});

  const secretTamper = JSON.parse(JSON.stringify(plan));
  secretTamper.requests[0].auth.secretEnv = 'ANTHROPIC_API_KEY';
  delete secretTamper.planDigest;
  secretTamper.planDigest = Digest.canonicalDigest(secretTamper);
  let called = false;
  await assert.rejects(function () {
    return AiExecutor.executeAiPlan(secretTamper, {
      networkAuthority: 'EXPLICIT_ALLOW',
      env: { ANTHROPIC_API_KEY: 'must-not-leave-process' },
      fetchImpl: async function () { called = true; throw new Error('must not execute'); }
    });
  }, function (error) { return error.code === 'AI_PROVIDER_FAILED' && error.details.code === 'AI_AUTH_REF_REFUSED'; });
  assert.equal(called, false);

  const bodyTamper = JSON.parse(JSON.stringify(plan));
  bodyTamper.requests[0].body.model = 'changed-after-broker';
  delete bodyTamper.planDigest;
  bodyTamper.planDigest = Digest.canonicalDigest(bodyTamper);
  await assert.rejects(function () {
    return AiExecutor.executeAiPlan(bodyTamper, {
      networkAuthority: 'EXPLICIT_ALLOW',
      env: { OPENAI_API_KEY: 'secret' },
      fetchImpl: async function () { called = true; throw new Error('must not execute'); }
    });
  }, function (error) { return error.code === 'AI_PROVIDER_FAILED' && error.details.code === 'AI_REQUEST_SHAPE_REFUSED'; });
  assert.equal(called, false);
});

test('AI response byte limit cancels the stream before full buffering', async function () {
  let pulls = 0;
  let canceled = false;
  const stream = new ReadableStream({
    pull: function (controller) {
      pulls += 1;
      controller.enqueue(new Uint8Array(700));
      if (pulls >= 5) controller.close();
    },
    cancel: function () { canceled = true; }
  });
  const response = new Response(stream, { headers: { 'content-type': 'application/json' } });
  await assert.rejects(function () {
    return AiExecutor.readBoundedJson(response, 1024);
  }, function (error) { return error.code === 'AI_RESPONSE_BYTES_LIMIT'; });
  assert.equal(canceled, true);
  assert.ok(pulls < 5);
});

test('research mode is a real switch and cannot run while disabled', function () {
  const off = Ai.setResearchMode(registry(), false);
  assert.throws(function () {
    Research.buildResearchPlan({ question: 'What changed?', aiRegistry: off }, { searchConfig: { searxng: { endpoint: 'http://127.0.0.1:8888/search' } } });
  }, function (error) { return error && error.code === 'RESEARCH_MODE_DISABLED'; });
});

test('research plan selects only enabled research-capable AIs and keeps both network lanes ungranted', function () {
  const reg = registry({ mode: 'panel', anthropicEnabled: true, anthropicResearch: false });
  const plan = Research.buildResearchPlan({
    question: 'Compare the visible browser state with independent sources',
    aiRegistry: reg,
    visualState: visualState(),
    searchQuery: { mode: 'federated' }
  }, {
    searchConfig: {
      searxng: { endpoint: 'http://127.0.0.1:8888/search' },
      brave: { enabled: true },
      priority: ['searxng', 'brave']
    }
  });
  assert.deepEqual(plan.aiProviderIds, ['local-nova', 'openai-cloud']);
  assert.equal(plan.searchPlan.providers.length, 2);
  assert.equal(plan.authority.searchNetworkExecutionGranted, false);
  assert.equal(plan.authority.aiNetworkExecutionGranted, false);
});

test('research execution preserves separate AI panel outputs and visual-permission differences', async function () {
  const question = 'What does the current browser view suggest and what do sources add?';
  const state = visualState();
  const plan = Research.buildResearchPlan({
    question,
    aiRegistry: registry({ mode: 'panel', openaiVisual: false }),
    visualState: state,
    searchQuery: { provider: 'searxng' }
  }, { searchConfig: { searxng: { endpoint: 'http://127.0.0.1:8888/search' } } });
  const searchSet = fakeSearchResult(question);
  const run = await Research.executeResearchPlan(plan, {
    searchNetworkAuthority: 'EXPLICIT_ALLOW',
    aiNetworkAuthority: 'EXPLICIT_ALLOW',
    searchExecute: async function () {
      return {
        status: 'PASS',
        executionDigest: 'a'.repeat(64),
        providersSucceeded: ['searxng'],
        providersFailed: [],
        estimatedExternalApiUsd: 0,
        resultSet: searchSet
      };
    },
    aiExecute: async function (aiPlan) {
      const local = aiPlan.requests.find(function (request) { return request.providerId === 'local-nova'; });
      const cloud = aiPlan.requests.find(function (request) { return request.providerId === 'openai-cloud'; });
      assert.equal(local.visualStateAttached, true);
      assert.equal(cloud.visualStateAttached, false);
      return {
        status: 'PASS',
        executionDigest: 'b'.repeat(64),
        providerIdsSucceeded: ['local-nova', 'openai-cloud'],
        providerIdsFailed: [],
        outputs: [
          { providerId: 'local-nova', adapter: 'openai-compatible-chat', status: 'PASS', visualStateUsed: true, searchEvidenceUsed: true, output: 'local perspective' },
          { providerId: 'openai-cloud', adapter: 'openai-responses', status: 'PASS', visualStateUsed: false, searchEvidenceUsed: true, output: 'cloud perspective' }
        ]
      };
    }
  });
  assert.equal(run.schema, 'axm.web.research-run/v1');
  assert.equal(run.status, 'PASS');
  assert.equal(run.visualStateDigest, state.visualDigest);
  assert.equal(run.search.resultSet.resultCount, 2);
  assert.equal(run.ai.outputs.length, 2);
  assert.equal(run.ai.outputs[0].output, 'local perspective');
  assert.equal(run.ai.outputs[1].output, 'cloud perspective');
  assert.equal(run.authority.resultNavigationAllowed, false);
  assert.equal(run.authority.resultContentTrusted, false);
});
