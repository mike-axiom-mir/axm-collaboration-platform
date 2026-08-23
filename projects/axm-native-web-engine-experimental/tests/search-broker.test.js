'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const Search = require('../src/search-broker');

function config() {
  return {
    priority: ['searxng', 'brave', 'kagi'],
    searxng: { endpoint: 'http://127.0.0.1:8888/search' },
    brave: { enabled: true },
    kagi: { enabled: true }
  };
}

test('search query normalization is shared and bounded across providers', function () {
  const query = Search.normalizeSearchQuery({
    query: '  native   AI browser research  ',
    count: 12,
    page: 2,
    language: 'en-us',
    country: 'nl',
    freshness: 'month',
    safeSearch: 'strict',
    categories: ['general', 'science'],
    engines: ['brave', 'mojeek']
  });
  assert.equal(query.query, 'native AI browser research');
  assert.equal(query.language, 'en-US');
  assert.equal(query.country, 'NL');
  assert.equal(query.count, 12);
  assert.equal(query.page, 2);
  assert.deepEqual(query.categories, ['general', 'science']);
  assert.throws(function () { Search.normalizeSearchQuery(''); }, function (error) { return error.code === 'SEARCH_INVALID_QUERY'; });
  assert.throws(function () { Search.normalizeSearchQuery('x '.repeat(51)); }, function (error) { return error.code === 'SEARCH_QUERY_LIMIT'; });
  assert.throws(function () { Search.normalizeSearchQuery({ query: 'x', count: 21 }); }, function (error) { return error.code === 'SEARCH_INVALID_QUERY'; });
});

test('single auto selection is deterministic and provider requests never contain secret values', function () {
  const plan = Search.buildSearchPlan({ query: 'AXM search', provider: 'auto' }, config());
  assert.deepEqual(plan.providers, ['searxng']);
  assert.equal(plan.authority.networkExecutionGranted, false);
  assert.equal(plan.requests[0].provider, 'searxng');
  assert.match(plan.requests[0].url, /^http:\/\/127\.0\.0\.1:8888\/search\?/);
  assert.match(plan.requests[0].url, /format=json/);
  assert.equal(plan.requests[0].auth, null);

  const brave = Search.buildSearchPlan({ query: 'AXM research', provider: 'brave', country: 'NL', freshness: 'week' }, config());
  assert.equal(brave.requests[0].auth.secretEnv, 'BRAVE_SEARCH_API_KEY');
  assert.equal(brave.requests[0].auth.header, 'X-Subscription-Token');
  assert.doesNotMatch(JSON.stringify(brave), /actual-secret-value/);
  assert.match(brave.requests[0].url, /freshness=pw/);
  assert.match(brave.requests[0].url, /country=NL/);

  const kagi = Search.buildSearchPlan({ query: 'AXM research', provider: 'kagi' }, config());
  assert.equal(kagi.requests[0].auth.secretEnv, 'KAGI_API_TOKEN');
  assert.equal(kagi.requests[0].auth.prefix, 'Bot ');
  assert.match(kagi.requests[0].url, /^https:\/\/kagi\.com\/api\/v1\/search\?/);
});

test('federated auto plan can fan out across configured providers without granting execution', function () {
  const plan = Search.buildSearchPlan({ query: 'deterministic browser', mode: 'federated', provider: 'auto' }, config());
  assert.deepEqual(plan.providers, ['searxng', 'brave', 'kagi']);
  assert.equal(plan.requests.length, 3);
  assert.equal(plan.merge.method, 'RECIPROCAL_RANK_FUSION');
  assert.equal(plan.merge.k, 60);
  assert.equal(plan.authority.networkExecutionGranted, false);
  assert.equal(plan.authority.arbitraryNavigationGranted, false);
});

test('provider parsers normalize SearXNG, Brave, and Kagi into one result contract', function () {
  const q = { query: 'AXM', count: 10 };
  const searx = Search.parseProviderResponse('searxng', {
    results: [
      { title: '<b>AXM</b> One', url: 'https://example.com/a?utm_source=x', content: 'first &amp; useful', engines: ['brave', 'mojeek'] },
      { title: 'Unsafe', url: 'javascript:alert(1)', content: 'drop me' }
    ]
  }, q);
  assert.equal(searx.resultCount, 1);
  assert.equal(searx.results[0].title, 'AXM One');
  assert.equal(searx.results[0].url, 'https://example.com/a');
  assert.deepEqual(searx.results[0].providerEngines, ['brave', 'mojeek']);

  const brave = Search.parseProviderResponse('brave', {
    web: { results: [{ title: 'AXM Two', url: 'https://example.org/b', description: 'second' }] }
  }, q);
  assert.equal(brave.results[0].snippet, 'second');

  const kagi = Search.parseProviderResponse('kagi', {
    data: [
      { t: 0, title: 'AXM Three', url: 'https://example.net/c', snippet: 'third', published: '2026-08-01T00:00:00Z' },
      { t: 1, list: ['related query'] }
    ]
  }, q);
  assert.equal(kagi.resultCount, 1);
  assert.equal(kagi.results[0].publishedAt, '2026-08-01T00:00:00Z');
});

test('federated merge deduplicates URLs, rewards provider agreement, and caps domain dominance', function () {
  const q = { query: 'AXM' };
  const first = Search.parseProviderResponse('searxng', {
    results: [
      { title: 'Shared result', url: 'https://example.com/shared?utm_campaign=x', content: 'from meta' },
      { title: 'Only meta', url: 'https://example.com/meta', content: 'meta' },
      { title: 'Meta third', url: 'https://example.com/third', content: 'third' }
    ]
  }, q);
  const second = Search.parseProviderResponse('brave', {
    web: { results: [
      { title: 'Shared result', url: 'https://example.com/shared', description: 'from independent' },
      { title: 'Independent', url: 'https://independent.example/item', description: 'independent' }
    ] }
  }, q);
  const merged = Search.mergeResultSets([first, second], { maxResults: 10, maxPerDomain: 2 });
  assert.equal(merged.provider, 'federated');
  assert.deepEqual(merged.providers, ['brave', 'searxng']);
  assert.equal(merged.results[0].url, 'https://example.com/shared');
  assert.equal(merged.results[0].agreementCount, 2);
  assert.deepEqual(merged.results[0].providers, ['brave', 'searxng']);
  assert.equal(merged.results.filter(function (item) { return new URL(item.url).hostname === 'example.com'; }).length, 2);
  assert.ok(merged.results.some(function (item) { return item.url === 'https://independent.example/item'; }));
});

test('provider catalog makes swap choices explicit and execution remains separate', function () {
  const catalog = Search.providerCatalog(config());
  assert.deepEqual(catalog.map(function (item) { return item.provider; }), ['searxng', 'brave', 'kagi']);
  assert.equal(catalog[0].selfHostable, true);
  assert.equal(catalog[1].indexModel, 'INDEPENDENT_INDEX');
  assert.equal(catalog[2].indexModel, 'PREMIUM_SEARCH');
  assert.ok(catalog.every(function (item) { return item.configured; }));
});
