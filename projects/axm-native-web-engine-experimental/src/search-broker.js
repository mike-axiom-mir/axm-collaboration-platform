'use strict';

const Digest = require('./digest');

const SEARCH_QUERY_SCHEMA = 'axm.web.search-query/v1';
const SEARCH_PLAN_SCHEMA = 'axm.web.search-plan/v1';
const SEARCH_RESULT_SET_SCHEMA = 'axm.web.search-result-set/v1';
const DEFAULT_PROVIDER_PRIORITY = Object.freeze(['searxng', 'brave', 'kagi']);
const PROVIDER_NAMES = new Set(DEFAULT_PROVIDER_PRIORITY);
const TRACKING_KEYS = new Set(['fbclid', 'gclid', 'dclid', 'mc_cid', 'mc_eid']);
const SAFE_SEARCH = new Set(['off', 'moderate', 'strict']);
const FRESHNESS = new Set([null, 'day', 'week', 'month', 'year']);
const MODES = new Set(['single', 'federated']);
const RRF_K = 60;

const PROVIDERS = Object.freeze({
  searxng: Object.freeze({
    provider: 'searxng',
    label: 'SearXNG',
    indexModel: 'META_SEARCH',
    selfHostable: true,
    credentialRequired: false,
    endpointMode: 'CONFIGURED',
    strengths: Object.freeze(['self-hostable', 'multi-engine', 'privacy-control', 'categories'])
  }),
  brave: Object.freeze({
    provider: 'brave',
    label: 'Brave Search API',
    indexModel: 'INDEPENDENT_INDEX',
    selfHostable: false,
    credentialRequired: true,
    endpointMode: 'FIXED',
    strengths: Object.freeze(['independent-index', 'freshness', 'country-language', 'web-search'])
  }),
  kagi: Object.freeze({
    provider: 'kagi',
    label: 'Kagi Search API',
    indexModel: 'PREMIUM_SEARCH',
    selfHostable: false,
    credentialRequired: true,
    endpointMode: 'FIXED',
    strengths: Object.freeze(['premium-ranking', 'account-lenses', 'low-noise', 'web-search'])
  })
});

class AxmSearchBrokerError extends Error {
  constructor(code, message, details) {
    super(message);
    this.name = 'AxmSearchBrokerError';
    this.code = code;
    this.details = details || {};
  }
}

function boundedInteger(value, fallback, min, max, name) {
  if (value == null) return fallback;
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new AxmSearchBrokerError('SEARCH_INVALID_QUERY', name + ' must be an integer from ' + min + ' to ' + max, { name, value });
  }
  return value;
}

function normalizeLanguage(value) {
  if (value == null || value === '' || value === 'all') return 'all';
  const language = String(value);
  if (!/^[A-Za-z]{2,3}(?:-[A-Za-z]{2})?$/.test(language)) {
    throw new AxmSearchBrokerError('SEARCH_INVALID_QUERY', 'language must be all, ISO-like language, or language-region', { language });
  }
  const parts = language.split('-');
  return parts.length === 1 ? parts[0].toLowerCase() : parts[0].toLowerCase() + '-' + parts[1].toUpperCase();
}

function normalizeCountry(value) {
  if (value == null || value === '') return null;
  const country = String(value).toUpperCase();
  if (!/^[A-Z]{2}$/.test(country)) {
    throw new AxmSearchBrokerError('SEARCH_INVALID_QUERY', 'country must be a two-letter code', { country });
  }
  return country;
}

function normalizeStringArray(value, name, maxItems) {
  if (value == null) return [];
  if (!Array.isArray(value)) throw new AxmSearchBrokerError('SEARCH_INVALID_QUERY', name + ' must be an array');
  const seen = new Set();
  const out = [];
  value.forEach(function (item) {
    const text = String(item).trim();
    if (!text || text.length > 64 || !/^[A-Za-z0-9._:+-]+$/.test(text)) {
      throw new AxmSearchBrokerError('SEARCH_INVALID_QUERY', name + ' contains an invalid item', { item });
    }
    if (!seen.has(text)) {
      seen.add(text);
      out.push(text);
    }
  });
  if (out.length > maxItems) {
    throw new AxmSearchBrokerError('SEARCH_INVALID_QUERY', name + ' exceeds the configured item bound', { maxItems, count: out.length });
  }
  return out;
}

function normalizeSearchQuery(input) {
  const source = typeof input === 'string' ? { query: input } : input;
  if (!source || typeof source !== 'object' || Array.isArray(source)) {
    throw new AxmSearchBrokerError('SEARCH_INVALID_QUERY', 'search query must be a string or object');
  }
  const query = String(source.query == null ? '' : source.query).trim().replace(/\s+/g, ' ');
  const words = query ? query.split(' ') : [];
  if (!query) throw new AxmSearchBrokerError('SEARCH_INVALID_QUERY', 'query may not be empty');
  if (query.length > 400 || words.length > 50) {
    throw new AxmSearchBrokerError('SEARCH_QUERY_LIMIT', 'query exceeds the shared 400-character / 50-word bound', {
      characters: query.length,
      words: words.length
    });
  }
  const safeSearch = String(source.safeSearch || 'moderate').toLowerCase();
  if (!SAFE_SEARCH.has(safeSearch)) {
    throw new AxmSearchBrokerError('SEARCH_INVALID_QUERY', 'safeSearch must be off, moderate, or strict', { safeSearch });
  }
  const freshness = source.freshness == null ? null : String(source.freshness).toLowerCase();
  if (!FRESHNESS.has(freshness)) {
    throw new AxmSearchBrokerError('SEARCH_INVALID_QUERY', 'freshness must be day, week, month, year, or null', { freshness });
  }
  const mode = String(source.mode || 'single').toLowerCase();
  if (!MODES.has(mode)) throw new AxmSearchBrokerError('SEARCH_INVALID_QUERY', 'mode must be single or federated', { mode });
  const provider = source.provider == null ? 'auto' : String(source.provider).toLowerCase();
  if (provider !== 'auto' && !PROVIDER_NAMES.has(provider)) {
    throw new AxmSearchBrokerError('SEARCH_PROVIDER_UNKNOWN', 'unsupported search provider', { provider });
  }
  const providers = source.providers == null ? [] : normalizeStringArray(source.providers, 'providers', PROVIDER_NAMES.size).map(function (name) {
    const lowered = name.toLowerCase();
    if (!PROVIDER_NAMES.has(lowered)) throw new AxmSearchBrokerError('SEARCH_PROVIDER_UNKNOWN', 'unsupported search provider', { provider: lowered });
    return lowered;
  });
  return {
    schema: SEARCH_QUERY_SCHEMA,
    version: 1,
    query,
    count: boundedInteger(source.count, 10, 1, 20, 'count'),
    page: boundedInteger(source.page, 1, 1, 10, 'page'),
    language: normalizeLanguage(source.language),
    country: normalizeCountry(source.country),
    freshness,
    safeSearch,
    categories: normalizeStringArray(source.categories, 'categories', 8),
    engines: normalizeStringArray(source.engines, 'engines', 12),
    mode,
    provider,
    providers
  };
}

function validateEndpoint(value, name) {
  let endpoint;
  try { endpoint = new URL(String(value)); }
  catch (_error) { throw new AxmSearchBrokerError('SEARCH_PROVIDER_UNCONFIGURED', name + ' endpoint must be an absolute HTTP(S) URL'); }
  if (!['http:', 'https:'].includes(endpoint.protocol) || endpoint.username || endpoint.password || endpoint.hash || endpoint.search) {
    throw new AxmSearchBrokerError('SEARCH_PROVIDER_UNCONFIGURED', name + ' endpoint must be a clean HTTP(S) URL without credentials/query/fragment', { endpoint: String(value) });
  }
  return endpoint;
}

function providerConfigured(name, config) {
  const item = config && config[name];
  if (name === 'searxng') return Boolean(item && item.endpoint);
  return Boolean(item && item.enabled === true);
}

function configuredProviders(config) {
  const priority = Array.isArray(config && config.priority) && config.priority.length
    ? config.priority.map(function (name) { return String(name).toLowerCase(); })
    : DEFAULT_PROVIDER_PRIORITY.slice();
  const seen = new Set();
  return priority.filter(function (name) {
    if (!PROVIDER_NAMES.has(name)) throw new AxmSearchBrokerError('SEARCH_PROVIDER_UNKNOWN', 'priority contains unsupported provider', { provider: name });
    if (seen.has(name)) return false;
    seen.add(name);
    return providerConfigured(name, config || {});
  });
}

function selectProviders(query, config) {
  const available = configuredProviders(config || {});
  let requested;
  if (query.providers.length) requested = query.providers.slice();
  else if (query.provider !== 'auto') requested = [query.provider];
  else requested = query.mode === 'federated' ? available.slice() : available.slice(0, 1);
  if (query.mode === 'single' && requested.length > 1) requested = requested.slice(0, 1);
  if (!requested.length) {
    throw new AxmSearchBrokerError('SEARCH_PROVIDER_UNCONFIGURED', 'no search provider is configured', { available });
  }
  requested.forEach(function (name) {
    if (!providerConfigured(name, config || {})) {
      throw new AxmSearchBrokerError('SEARCH_PROVIDER_UNCONFIGURED', 'requested provider is not configured', { provider: name });
    }
  });
  return requested;
}

function safeSecretRef(provider, item, fallbackEnv, header, prefix) {
  const env = String(item.secretEnv || fallbackEnv);
  if (!/^[A-Z][A-Z0-9_]{2,63}$/.test(env)) {
    throw new AxmSearchBrokerError('SEARCH_PROVIDER_UNCONFIGURED', provider + ' secretEnv is invalid', { secretEnv: env });
  }
  return { type: 'ENV_HEADER_SECRET', header, prefix: prefix || '', secretEnv: env };
}

function mapFreshnessForBrave(value) {
  return { day: 'pd', week: 'pw', month: 'pm', year: 'py' }[value] || null;
}

function mapSafeSearchForSearxng(value) {
  return { off: '0', moderate: '1', strict: '2' }[value];
}

function buildSearxngRequest(query, config) {
  const item = config.searxng || {};
  const url = validateEndpoint(item.endpoint, 'SearXNG');
  url.searchParams.set('q', query.query);
  url.searchParams.set('format', 'json');
  url.searchParams.set('pageno', String(query.page));
  url.searchParams.set('safesearch', mapSafeSearchForSearxng(query.safeSearch));
  if (query.language !== 'all') url.searchParams.set('language', query.language);
  if (query.freshness) url.searchParams.set('time_range', query.freshness);
  if (query.categories.length) url.searchParams.set('categories', query.categories.join(','));
  if (query.engines.length) url.searchParams.set('engines', query.engines.join(','));
  return {
    provider: 'searxng', method: 'GET', url: url.toString(), headers: { Accept: 'application/json' }, auth: null,
    transportAuthority: 'REQUIRES_EXPLICIT_NETWORK_EXECUTOR'
  };
}

function buildBraveRequest(query, config) {
  const item = config.brave || {};
  const url = new URL('https://api.search.brave.com/res/v1/web/search');
  url.searchParams.set('q', query.query);
  url.searchParams.set('count', String(query.count));
  url.searchParams.set('offset', String(query.page - 1));
  url.searchParams.set('safesearch', query.safeSearch);
  url.searchParams.set('text_decorations', 'false');
  url.searchParams.set('result_filter', 'web');
  if (query.country) url.searchParams.set('country', query.country);
  if (query.language !== 'all') url.searchParams.set('search_lang', query.language.split('-')[0]);
  const freshness = mapFreshnessForBrave(query.freshness);
  if (freshness) url.searchParams.set('freshness', freshness);
  return {
    provider: 'brave', method: 'GET', url: url.toString(), headers: { Accept: 'application/json' },
    auth: safeSecretRef('brave', item, 'BRAVE_SEARCH_API_KEY', 'X-Subscription-Token'),
    transportAuthority: 'REQUIRES_EXPLICIT_NETWORK_EXECUTOR'
  };
}

function buildKagiRequest(query, config) {
  const item = config.kagi || {};
  const url = new URL('https://kagi.com/api/v1/search');
  url.searchParams.set('q', query.query);
  return {
    provider: 'kagi', method: 'GET', url: url.toString(), headers: { Accept: 'application/json' },
    auth: safeSecretRef('kagi', item, 'KAGI_API_TOKEN', 'Authorization', 'Bot '),
    transportAuthority: 'REQUIRES_EXPLICIT_NETWORK_EXECUTOR'
  };
}

function buildProviderRequest(provider, query, config) {
  if (provider === 'searxng') return buildSearxngRequest(query, config);
  if (provider === 'brave') return buildBraveRequest(query, config);
  if (provider === 'kagi') return buildKagiRequest(query, config);
  throw new AxmSearchBrokerError('SEARCH_PROVIDER_UNKNOWN', 'unsupported search provider', { provider });
}

function buildSearchPlan(input, config) {
  const query = normalizeSearchQuery(input);
  const providers = selectProviders(query, config || {});
  const material = {
    schema: SEARCH_PLAN_SCHEMA,
    version: 1,
    status: 'EXPERIMENTAL',
    query,
    providers,
    requests: providers.map(function (provider) { return buildProviderRequest(provider, query, config || {}); }),
    merge: query.mode === 'federated' ? { method: 'RECIPROCAL_RANK_FUSION', k: RRF_K, maxPerDomain: 3 } : null,
    authority: {
      networkExecutionGranted: false,
      arbitraryNavigationGranted: false,
      installAllowed: false,
      promotionAllowed: false,
      canonAllowed: false
    }
  };
  return Object.assign({}, material, { planDigest: Digest.canonicalDigest(material) });
}

function plainText(value) {
  return String(value == null ? '' : value)
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizedHttpUrl(value) {
  let url;
  try { url = new URL(String(value)); } catch (_error) { return null; }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return null;
  url.hash = '';
  Array.from(url.searchParams.keys()).forEach(function (key) {
    if (/^utm_/i.test(key) || TRACKING_KEYS.has(key.toLowerCase())) url.searchParams.delete(key);
  });
  if (url.protocol === 'http:' && url.port === '80') url.port = '';
  if (url.protocol === 'https:' && url.port === '443') url.port = '';
  url.hostname = url.hostname.toLowerCase();
  return url.toString();
}

function resultFrom(provider, item, rank) {
  const rawUrl = item && (item.url || item.link);
  const url = normalizedHttpUrl(rawUrl);
  if (!url) return null;
  return {
    rank,
    title: plainText(item.title || item.name || url),
    url,
    snippet: plainText(item.content || item.description || item.snippet || ''),
    publishedAt: item.publishedDate || item.published_date || item.published || item.age || null,
    provider,
    providerEngines: Array.isArray(item.engines) ? item.engines.map(String).sort() : []
  };
}

function parseSearxng(body) {
  return Array.isArray(body && body.results) ? body.results : [];
}

function parseBrave(body) {
  return Array.isArray(body && body.web && body.web.results) ? body.web.results : [];
}

function parseKagi(body) {
  const data = Array.isArray(body && body.data) ? body.data : [];
  return data.filter(function (item) { return item && item.t === 0; });
}

function parseProviderResponse(provider, body, queryInput) {
  if (!PROVIDER_NAMES.has(provider)) throw new AxmSearchBrokerError('SEARCH_PROVIDER_UNKNOWN', 'unsupported search provider', { provider });
  const query = normalizeSearchQuery(queryInput);
  let raw;
  if (provider === 'searxng') raw = parseSearxng(body);
  else if (provider === 'brave') raw = parseBrave(body);
  else raw = parseKagi(body);
  const results = raw.map(function (item, index) { return resultFrom(provider, item, index + 1); }).filter(Boolean).slice(0, query.count);
  const material = {
    schema: SEARCH_RESULT_SET_SCHEMA,
    version: 1,
    status: 'EXPERIMENTAL',
    query: query.query,
    provider,
    providers: [provider],
    resultCount: results.length,
    results: results.map(function (result) {
      return Object.assign({}, result, { agreementCount: 1, providerRanks: { [provider]: result.rank } });
    }),
    merge: null,
    authority: { navigationGranted: false, contentTrusted: false }
  };
  return Object.assign({}, material, { resultSetDigest: Digest.canonicalDigest(material) });
}

function canonicalResultKey(url) {
  const normalized = normalizedHttpUrl(url);
  if (!normalized) return null;
  const parsed = new URL(normalized);
  if (parsed.pathname !== '/' && parsed.pathname.endsWith('/')) parsed.pathname = parsed.pathname.slice(0, -1);
  return parsed.toString();
}

function domainOf(url) {
  try { return new URL(url).hostname.toLowerCase(); } catch (_error) { return ''; }
}

function mergeResultSets(resultSets, options) {
  options = options || {};
  if (!Array.isArray(resultSets) || resultSets.length < 2) {
    throw new AxmSearchBrokerError('SEARCH_MERGE_INPUT', 'federated merge requires at least two result sets');
  }
  const query = String(resultSets[0].query || '');
  resultSets.forEach(function (set) {
    if (!set || set.schema !== SEARCH_RESULT_SET_SCHEMA || set.query !== query) {
      throw new AxmSearchBrokerError('SEARCH_MERGE_INPUT', 'all result sets must be normalized and share one query');
    }
  });
  const k = boundedInteger(options.k, RRF_K, 1, 1000, 'k');
  const maxPerDomain = boundedInteger(options.maxPerDomain, 3, 1, 20, 'maxPerDomain');
  const maxResults = boundedInteger(options.maxResults, 20, 1, 100, 'maxResults');
  const merged = new Map();
  resultSets.forEach(function (set, setIndex) {
    set.results.forEach(function (result) {
      const key = canonicalResultKey(result.url);
      if (!key) return;
      let item = merged.get(key);
      if (!item) {
        item = {
          title: result.title,
          url: key,
          snippet: result.snippet,
          publishedAt: result.publishedAt,
          score: 0,
          providers: [],
          providerRanks: {},
          firstSeen: [setIndex, result.rank]
        };
        merged.set(key, item);
      }
      item.score += 1 / (k + result.rank);
      if (!item.providers.includes(set.provider)) item.providers.push(set.provider);
      item.providerRanks[set.provider] = result.rank;
      if (!item.snippet && result.snippet) item.snippet = result.snippet;
      if (!item.publishedAt && result.publishedAt) item.publishedAt = result.publishedAt;
    });
  });
  const sorted = Array.from(merged.values()).sort(function (a, b) {
    if (b.score !== a.score) return b.score - a.score;
    if (b.providers.length !== a.providers.length) return b.providers.length - a.providers.length;
    if (a.firstSeen[0] !== b.firstSeen[0]) return a.firstSeen[0] - b.firstSeen[0];
    if (a.firstSeen[1] !== b.firstSeen[1]) return a.firstSeen[1] - b.firstSeen[1];
    return a.url.localeCompare(b.url);
  });
  const domainCounts = new Map();
  const results = [];
  sorted.forEach(function (item) {
    if (results.length >= maxResults) return;
    const domain = domainOf(item.url);
    const count = domainCounts.get(domain) || 0;
    if (count >= maxPerDomain) return;
    domainCounts.set(domain, count + 1);
    results.push({
      rank: results.length + 1,
      title: item.title,
      url: item.url,
      snippet: item.snippet,
      publishedAt: item.publishedAt,
      provider: item.providers.length > 1 ? 'federated' : item.providers[0],
      providers: item.providers.slice().sort(),
      agreementCount: item.providers.length,
      providerRanks: item.providerRanks,
      fusionScore: Number(item.score.toFixed(12))
    });
  });
  const providers = Array.from(new Set(resultSets.map(function (set) { return set.provider; }))).sort();
  const material = {
    schema: SEARCH_RESULT_SET_SCHEMA,
    version: 1,
    status: 'EXPERIMENTAL',
    query,
    provider: 'federated',
    providers,
    resultCount: results.length,
    results,
    merge: { method: 'RECIPROCAL_RANK_FUSION', k, maxPerDomain },
    authority: { navigationGranted: false, contentTrusted: false }
  };
  return Object.assign({}, material, { resultSetDigest: Digest.canonicalDigest(material) });
}

function providerCatalog(config) {
  config = config || {};
  return DEFAULT_PROVIDER_PRIORITY.map(function (name) {
    return Object.assign({}, PROVIDERS[name], { configured: providerConfigured(name, config) });
  });
}

module.exports = {
  SEARCH_QUERY_SCHEMA,
  SEARCH_PLAN_SCHEMA,
  SEARCH_RESULT_SET_SCHEMA,
  PROVIDERS,
  DEFAULT_PROVIDER_PRIORITY,
  RRF_K,
  AxmSearchBrokerError,
  normalizeSearchQuery,
  configuredProviders,
  selectProviders,
  buildProviderRequest,
  buildSearchPlan,
  parseProviderResponse,
  normalizedHttpUrl,
  canonicalResultKey,
  mergeResultSets,
  providerCatalog
};
