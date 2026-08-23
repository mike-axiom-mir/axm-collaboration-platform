'use strict';

const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const Exposure = require('../src/exposure-search-broker');
const Executor = require('../src/exposure-search-executor');
const ExposureLabHost = require('../src/exposure-lab-host');
const BrowserSession = require('../src/browser-session');
const LocalBrowserHost = require('../src/local-browser-host');

const root = path.resolve(__dirname, '..');
function local(name) { return path.join(root, 'fixtures', name); }

test('exposure plan is Shodan-only, bounded, scan-free, and keeps API key as a reference', function () {
  const plan = Exposure.buildExposurePlan(
    { query: 'apache country:NL', mode: 'search', resultLimit: 20, facets: ['country','org'] },
    { shodan: { enabled: true, secretEnv: 'SHODAN_API_KEY' } }
  );
  assert.equal(plan.provider, 'shodan');
  assert.equal(plan.requests.length, 1);
  assert.equal(plan.requests[0].url.startsWith('https://api.shodan.io/shodan/host/search?'), true);
  assert.equal(new URL(plan.requests[0].url).searchParams.get('page'), '1');
  assert.equal(new URL(plan.requests[0].url).searchParams.has('key'), false);
  assert.equal(plan.requests[0].auth.secretEnv, 'SHODAN_API_KEY');
  assert.equal(plan.authority.activeScanGranted, false);
  assert.equal(plan.authority.targetConnectionGranted, false);
});

test('exposure executor refuses network without explicit authority', async function () {
  const plan = Exposure.buildExposurePlan('apache', { shodan: { enabled: true } });
  await assert.rejects(
    function () { return Executor.executeExposurePlan(plan, {}); },
    function (error) { return error && error.code === 'EXPOSURE_NETWORK_NOT_AUTHORIZED'; }
  );
});

test('Shodan API key is materialized only in outbound URL and redacted from normalized output', async function () {
  const plan = Exposure.buildExposurePlan(
    { query: 'apache country:NL', mode: 'search', resultLimit: 5 },
    { shodan: { enabled: true, secretEnv: 'SHODAN_API_KEY' } }
  );
  let seenUrl = null;
  const result = await Executor.executeExposurePlan(plan, {
    networkAuthority: 'EXPLICIT_ALLOW',
    env: { SHODAN_API_KEY: 'super-secret-key' },
    fetchImpl: async function (url) {
      seenUrl = String(url);
      return new Response(JSON.stringify({
        total: 1,
        matches: [{
          ip_str: '203.0.113.7',
          port: 443,
          transport: 'tcp',
          product: 'nginx',
          version: '1.25',
          org: 'Example Network',
          data: 'RAW BANNER MUST NOT SURVIVE',
          location: { country_code: 'NL', city: 'Amsterdam' }
        }]
      }), { status: 200, headers: { 'content-type': 'application/json' } });
    }
  });
  assert.match(seenUrl, /key=super-secret-key/);
  assert.doesNotMatch(JSON.stringify(plan), /super-secret-key/);
  assert.doesNotMatch(JSON.stringify(result), /super-secret-key/);
  assert.doesNotMatch(JSON.stringify(result), /RAW BANNER MUST NOT SURVIVE/);
  assert.equal(result.resultSet.assets[0].ip, '203.0.113.7');
  assert.equal(result.authority.activeScanUsed, false);
  assert.equal(result.authority.targetConnectionUsed, false);
});

test('count mode returns totals and facets but no asset rows', function () {
  const result = Exposure.parseExposureResponse({
    total: 42,
    facets: { country: [{ value: 'NL', count: 30 }, { value: 'BE', count: 12 }] },
    matches: [{ ip_str: '203.0.113.9', port: 22 }]
  }, { query: 'port:22', mode: 'count', facets: ['country'] });
  assert.equal(result.total, 42);
  assert.equal(result.assetCount, 0);
  assert.deepEqual(result.assets, []);
  assert.equal(result.facets.country[0].value, 'NL');
});

test('Exposure Lab UI is loopback-only and exposes no active-scan or target-connect control', function () {
  const html = ExposureLabHost.renderExposureLabHtml();
  assert.match(html, /Exposure Search/);
  assert.match(html, /NO ACTIVE SCAN/);
  assert.match(html, /NO TARGET CONNECTION/);
  assert.doesNotMatch(html, /shodan\/scan/i);
  assert.doesNotMatch(html, /default password/i);
  assert.match(ExposureLabHost.contentSecurityPolicy(), /img-src 'none'/);
});

test('browser host can launch Exposure Lab on the same structured visual-state lineage', async function () {
  const session = new BrowserSession.LocalBrowserSession(local('session-home.html'), [local('session-about.html')]);
  const host = await LocalBrowserHost.createLocalBrowserHost(session, {
    exposureLab: true,
    exposureConfig: {
      searchConfig: { shodan: { enabled: true } },
      networkAuthority: 'EXPLICIT_ALLOW',
      executorOptions: {
        env: { SHODAN_API_KEY: 'test-key' },
        fetchImpl: async function () {
          return new Response(JSON.stringify({ total: 0, matches: [] }), { status: 200, headers: { 'content-type': 'application/json' } });
        }
      }
    }
  });
  try {
    assert.match(host.exposureLabUrl, /^http:\/\/127\.0\.0\.1:[0-9]+\/e\//);
    assert.equal(host.exposureLabReceipt.activeScanAvailable, false);
    assert.equal(host.exposureLabReceipt.targetConnectionAvailable, false);
    const state = host.exposureLabHost.state();
    assert.equal(state.browserVisualState.visualDigest, host.visualState().visualDigest);
    const noOrigin = await fetch(host.exposureLabUrl + 'search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: 'apache', mode: 'count' })
    });
    assert.equal(noOrigin.status, 403);
  } finally {
    await host.close();
  }
});
