'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const Digest = require('../src/digest');
const Search = require('../src/search-broker');
const Executor = require('../src/search-executor');

function plan(provider) {
  const cfg = {
    searxng: { endpoint: 'http://127.0.0.1:8888/search' },
    brave: { enabled: true },
    kagi: { enabled: true }
  };
  return Search.buildSearchPlan({ query: 'AXM research', provider: provider || 'brave' }, cfg);
}

function jsonResponse(value, options) {
  options = options || {};
  const text = JSON.stringify(value);
  return new Response(text, {
    status: options.status || 200,
    headers: Object.assign({ 'Content-Type': 'application/json', 'Content-Length': String(Buffer.byteLength(text)) }, options.headers || {})
  });
}

test('executor refuses network unless the caller explicitly grants the execution authority', async function () {
  await assert.rejects(function () {
    return Executor.executeSearchPlan(plan('brave'), { fetchImpl: async function () { throw new Error('must not run'); } });
  }, function (error) { return error.code === 'SEARCH_NETWORK_NOT_AUTHORIZED'; });
});

test('Brave execution resolves the secret only into the outbound header and redacts it from receipts', async function () {
  let observed = null;
  const result = await Executor.executeSearchPlan(plan('brave'), {
    networkAuthority: 'EXPLICIT_ALLOW',
    env: { BRAVE_SEARCH_API_KEY: 'super-secret-value' },
    fetchImpl: async function (url, init) {
      observed = { url: String(url), init };
      return jsonResponse({ web: { results: [{ title: 'AXM result', url: 'https://example.com/a', description: 'grounded result' }] } });
    }
  });
  assert.equal(observed.init.headers['X-Subscription-Token'], 'super-secret-value');
  assert.equal(observed.init.redirect, 'error');
  assert.equal(observed.init.credentials, 'omit');
  assert.equal(result.status, 'PASS');
  assert.equal(result.resultSet.results[0].url, 'https://example.com/a');
  assert.equal(result.estimatedExternalApiUsd, 0.005);
  assert.doesNotMatch(JSON.stringify(result), /super-secret-value/);
  assert.equal(result.authority.arbitraryNavigationGranted, false);
  assert.equal(result.authority.resultContentTrusted, false);
});

test('SearXNG execution requires the exact configured endpoint allowlist', async function () {
  const searxPlan = plan('searxng');
  await assert.rejects(function () {
    return Executor.executeSearchPlan(searxPlan, {
      networkAuthority: 'EXPLICIT_ALLOW',
      fetchImpl: async function () { return jsonResponse({ results: [] }); }
    });
  }, function (error) { return error.code === 'SEARCH_PROVIDER_FAILED' && error.details.code === 'SEARCH_ENDPOINT_REFUSED'; });

  const result = await Executor.executeSearchPlan(searxPlan, {
    networkAuthority: 'EXPLICIT_ALLOW',
    allowedSearxngEndpoints: ['http://127.0.0.1:8888/search'],
    fetchImpl: async function () { return jsonResponse({ results: [{ title: 'Local meta', url: 'https://example.org/meta', content: 'meta' }] }); }
  });
  assert.equal(result.receipts[0].estimatedExternalApiUsd, 0);
  assert.equal(result.resultSet.results[0].provider, 'searxng');
});

test('executor rejects plan tampering before any transport call', async function () {
  const broken = plan('brave');
  broken.requests[0].url = 'https://example.invalid/search?q=AXM';
  let called = false;
  await assert.rejects(function () {
    return Executor.executeSearchPlan(broken, {
      networkAuthority: 'EXPLICIT_ALLOW',
      env: { BRAVE_SEARCH_API_KEY: 'secret' },
      fetchImpl: async function () { called = true; return jsonResponse({}); }
    });
  }, function (error) { return error.code === 'SEARCH_PLAN_DIGEST_MISMATCH'; });
  assert.equal(called, false);
});

test('executor refuses oversized, non-JSON, and provider HTTP responses', async function () {
  const brave = plan('brave');
  const common = { networkAuthority: 'EXPLICIT_ALLOW', env: { BRAVE_SEARCH_API_KEY: 'secret' } };
  await assert.rejects(function () {
    return Executor.executeSearchPlan(brave, Object.assign({}, common, {
      maxResponseBytes: 1024,
      fetchImpl: async function () { return jsonResponse({ web: { results: [] } }, { headers: { 'Content-Length': '4096' } }); }
    }));
  }, function (error) { return error.code === 'SEARCH_PROVIDER_FAILED' && error.details.code === 'SEARCH_RESPONSE_BYTES_LIMIT'; });

  await assert.rejects(function () {
    return Executor.executeSearchPlan(brave, Object.assign({}, common, {
      fetchImpl: async function () { return new Response('hello', { status: 200, headers: { 'Content-Type': 'text/plain' } }); }
    }));
  }, function (error) { return error.code === 'SEARCH_PROVIDER_FAILED' && error.details.code === 'SEARCH_RESPONSE_CONTENT_TYPE'; });

  await assert.rejects(function () {
    return Executor.executeSearchPlan(brave, Object.assign({}, common, {
      fetchImpl: async function () { return new Response('{}', { status: 429, headers: { 'Content-Type': 'application/json' } }); }
    }));
  }, function (error) { return error.code === 'SEARCH_PROVIDER_FAILED' && error.details.code === 'SEARCH_HTTP_STATUS'; });
});

test('best-effort federated execution preserves provider failure evidence and merges successes', async function () {
  const federated = Search.buildSearchPlan({ query: 'AXM research', mode: 'federated', providers: ['brave', 'kagi'] }, {
    brave: { enabled: true },
    kagi: { enabled: true }
  });
  const result = await Executor.executeSearchPlan(federated, {
    networkAuthority: 'EXPLICIT_ALLOW',
    failureMode: 'best-effort',
    env: { BRAVE_SEARCH_API_KEY: 'brave-secret', KAGI_API_TOKEN: 'kagi-secret' },
    fetchImpl: async function (url) {
      if (String(url).startsWith('https://api.search.brave.com/')) {
        return jsonResponse({ web: { results: [{ title: 'Brave', url: 'https://example.com/shared', description: 'one' }] } });
      }
      return new Response('{}', { status: 503, headers: { 'Content-Type': 'application/json' } });
    }
  });
  assert.equal(result.status, 'PARTIAL');
  assert.deepEqual(result.providersSucceeded, ['brave']);
  assert.deepEqual(result.providersFailed, ['kagi']);
  assert.equal(result.resultSet.resultCount, 1);
  assert.equal(result.estimatedExternalApiUsd, 0.017, 'receipt exposes maximum external API request cost for both attempted providers');
  assert.doesNotMatch(JSON.stringify(result), /brave-secret|kagi-secret/);
});

test('endpoint validation is pinned for fixed APIs even if a tampered plan is re-digested', async function () {
  const forged = plan('kagi');
  forged.requests[0].url = 'https://example.invalid/api/v1/search?q=AXM';
  forged.planDigest = Digest.canonicalDigest((function () { const copy = JSON.parse(JSON.stringify(forged)); delete copy.planDigest; return copy; }()));
  await assert.rejects(function () {
    return Executor.executeSearchPlan(forged, {
      networkAuthority: 'EXPLICIT_ALLOW',
      env: { KAGI_API_TOKEN: 'secret' },
      fetchImpl: async function () { return jsonResponse({ data: [] }); }
    });
  }, function (error) { return error.code === 'SEARCH_PROVIDER_FAILED' && error.details.code === 'SEARCH_ENDPOINT_REFUSED'; });
});
