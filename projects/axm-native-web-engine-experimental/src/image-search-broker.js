'use strict';

const Digest = require('./digest');
const Search = require('./search-broker');

const IMAGE_SEARCH_QUERY_SCHEMA = 'axm.web.image-search-query/v1';
const IMAGE_SEARCH_PLAN_SCHEMA = 'axm.web.image-search-plan/v1';
const IMAGE_SEARCH_RESULT_SET_SCHEMA = 'axm.web.image-search-result-set/v1';
const PROVIDER_NAMES = new Set(['searxng', 'brave']);
const DEFAULT_PROVIDER_PRIORITY = Object.freeze(['searxng', 'brave']);
const MODES = new Set(['single', 'federated']);
const SAFE_SEARCH = new Set(['off', 'moderate', 'strict']);
const RRF_K = 60;

class AxmImageSearchError extends Error {
  constructor(code, message, details) {
    super(message);
    this.name = 'AxmImageSearchError';
    this.code = code;
    this.details = details || {};
  }
}

function boundedInteger(value, fallback, min, max, name) {
  if (value == null) return fallback;
  if (!Number.isInteger(value) || value < min || value > max) throw new AxmImageSearchError('IMAGE_SEARCH_INVALID', name + ' must be ' + min + '..' + max, { name, value });
  return value;
}

function normalizeLanguage(value) {
  if (value == null || value === '' || value === 'all') return 'all';
  const language = String(value);
  if (!/^[A-Za-z]{2,3}(?:-[A-Za-z]{2})?$/.test(language)) throw new AxmImageSearchError('IMAGE_SEARCH_INVALID', 'invalid language', { language });
  const parts = language.split('-');
  return parts.length === 1 ? parts[0].toLowerCase() : parts[0].toLowerCase() + '-' + parts[1].toUpperCase();
}

function normalizeCountry(value) {
  if (value == null || value === '') return null;
  const country = String(value).toUpperCase();
  if (!/^[A-Z]{2}$/.test(country)) throw new AxmImageSearchError('IMAGE_SEARCH_INVALID', 'country must be a two-letter code', { country });
  return country;
}

function normalizeImageSearchQuery(input) {
  const source = typeof input === 'string' ? { query: input } : input;
  if (!source || typeof source !== 'object' || Array.isArray(source)) throw new AxmImageSearchError('IMAGE_SEARCH_INVALID', 'image search query must be string or object');
  const query = String(source.query == null ? '' : source.query).trim().replace(/\s+/g, ' ');
  if (!query) throw new AxmImageSearchError('IMAGE_SEARCH_INVALID', 'query may not be empty');
  if (query.length > 400 || query.split(' ').length > 50) throw new AxmImageSearchError('IMAGE_SEARCH_LIMIT', 'query exceeds 400 characters or 50 words');
  const safeSearch = String(source.safeSearch || 'strict').toLowerCase();
  if (!SAFE_SEARCH.has(safeSearch)) throw new AxmImageSearchError('IMAGE_SEARCH_INVALID', 'safeSearch must be off, moderate, or strict', { safeSearch });
  const mode = String(source.mode || 'single').toLowerCase();
  if (!MODES.has(mode)) throw new AxmImageSearchError('IMAGE_SEARCH_INVALID', 'mode must be single or federated');
  const provider = source.provider == null ? 'auto' : String(source.provider).toLowerCase();
  if (provider !== 'auto' && !PROVIDER_NAMES.has(provider)) throw new AxmImageSearchError('IMAGE_SEARCH_PROVIDER_UNKNOWN', 'unsupported image search provider', { provider });
  const providers = Array.isArray(source.providers) ? source.providers.map(function (item) { return String(item).toLowerCase(); }) : [];
  providers.forEach(function (item) { if (!PROVIDER_NAMES.has(item)) throw new AxmImageSearchError('IMAGE_SEARCH_PROVIDER_UNKNOWN', 'unsupported image search provider', { provider: item }); });
  return {
    schema: IMAGE_SEARCH_QUERY_SCHEMA,
    version: 1,
    query,
    count: boundedInteger(source.count, 20, 1, 50, 'count'),
    language: normalizeLanguage(source.language),
    country: normalizeCountry(source.country),
    safeSearch,
    mode,
    provider,
    providers: Array.from(new Set(providers))
  };
}

function providerConfigured(name, config) {
  const item = config && config[name];
  if (name === 'searxng') return Boolean(item && item.endpoint);
  if (name === 'brave') return Boolean(item && item.enabled === true);
  return false;
}

function configuredProviders(config) {
  const priority = Array.isArray(config && config.priority) && config.priority.length ? config.priority : DEFAULT_PROVIDER_PRIORITY;
  return Array.from(new Set(priority.map(function (name) { return String(name).toLowerCase(); }))).filter(function (name) {
    if (!PROVIDER_NAMES.has(name)) throw new AxmImageSearchError('IMAGE_SEARCH_PROVIDER_UNKNOWN', 'priority contains unsupported provider', { provider: name });
    return providerConfigured(name, config || {});
  });
}

function selectProviders(query, config) {
  const available = configuredProviders(config || {});
  let requested = query.providers.length ? query.providers.slice() : query.provider !== 'auto' ? [query.provider] : query.mode === 'federated' ? available.slice() : available.slice(0, 1);
  if (query.mode === 'single' && requested.length > 1) requested = requested.slice(0, 1);
  if (!requested.length) throw new AxmImageSearchError('IMAGE_SEARCH_PROVIDER_UNCONFIGURED', 'no image-search provider is configured');
  requested.forEach(function (provider) {
    if (!providerConfigured(provider, config || {})) throw new AxmImageSearchError('IMAGE_SEARCH_PROVIDER_UNCONFIGURED', 'requested image-search provider is not configured', { provider });
  });
  return requested;
}

function endpoint(value, label) {
  let url;
  try { url = new URL(String(value || '')); } catch (_error) { throw new AxmImageSearchError('IMAGE_SEARCH_PROVIDER_UNCONFIGURED', label + ' endpoint must be absolute'); }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.hash || url.search) throw new AxmImageSearchError('IMAGE_SEARCH_PROVIDER_UNCONFIGURED', label + ' endpoint has a refused URL shape');
  return url;
}

function secretRef(item) {
  const env = String(item && item.secretEnv || 'BRAVE_SEARCH_API_KEY');
  if (!/^[A-Z][A-Z0-9_]{2,63}$/.test(env)) throw new AxmImageSearchError('IMAGE_SEARCH_PROVIDER_UNCONFIGURED', 'Brave secretEnv is invalid', { secretEnv: env });
  return { type: 'ENV_HEADER_SECRET', header: 'X-Subscription-Token', prefix: '', secretEnv: env };
}

function buildRequest(provider, query, config) {
  if (provider === 'searxng') {
    const url = endpoint(config.searxng.endpoint, 'SearXNG');
    url.searchParams.set('q', query.query);
    url.searchParams.set('format', 'json');
    url.searchParams.set('categories', 'images');
    url.searchParams.set('safesearch', query.safeSearch === 'off' ? '0' : query.safeSearch === 'moderate' ? '1' : '2');
    if (query.language !== 'all') url.searchParams.set('language', query.language);
    return { provider, method: 'GET', url: url.toString(), headers: { Accept: 'application/json' }, auth: null, transportAuthority: 'REQUIRES_EXPLICIT_IMAGE_SEARCH_EXECUTOR' };
  }
  if (provider === 'brave') {
    const url = new URL('https://api.search.brave.com/res/v1/images/search');
    url.searchParams.set('q', query.query);
    url.searchParams.set('count', String(query.count));
    url.searchParams.set('safesearch', query.safeSearch === 'off' ? 'off' : 'strict');
    if (query.country) url.searchParams.set('country', query.country);
    if (query.language !== 'all') url.searchParams.set('search_lang', query.language.split('-')[0]);
    return { provider, method: 'GET', url: url.toString(), headers: { Accept: 'application/json' }, auth: secretRef(config.brave || {}), transportAuthority: 'REQUIRES_EXPLICIT_IMAGE_SEARCH_EXECUTOR' };
  }
  throw new AxmImageSearchError('IMAGE_SEARCH_PROVIDER_UNKNOWN', 'unsupported image-search provider', { provider });
}

function buildImageSearchPlan(input, config) {
  const query = normalizeImageSearchQuery(input);
  const providers = selectProviders(query, config || {});
  const material = {
    schema: IMAGE_SEARCH_PLAN_SCHEMA,
    version: 1,
    status: 'EXPERIMENTAL',
    query,
    providers,
    requests: providers.map(function (provider) { return buildRequest(provider, query, config || {}); }),
    merge: query.mode === 'federated' ? { method: 'RECIPROCAL_RANK_FUSION', k: RRF_K } : null,
    authority: {
      networkExecutionGranted: false,
      imageFetchGranted: false,
      arbitraryNavigationGranted: false,
      installAllowed: false,
      promotionAllowed: false,
      canonAllowed: false
    }
  };
  return Object.assign({}, material, { planDigest: Digest.canonicalDigest(material) });
}

function plainText(value) {
  return String(value == null ? '' : value).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function dimensions(item) {
  if (item && item.properties) {
    return {
      width: Number.isInteger(item.properties.width) ? item.properties.width : null,
      height: Number.isInteger(item.properties.height) ? item.properties.height : null
    };
  }
  if (Array.isArray(item && item.resolution) && item.resolution.length >= 2) return { width: Number(item.resolution[0]) || null, height: Number(item.resolution[1]) || null };
  if (typeof (item && item.resolution) === 'string') {
    const m = item.resolution.match(/(\d+)\s*[x×]\s*(\d+)/i);
    if (m) return { width: Number(m[1]), height: Number(m[2]) };
  }
  return { width: null, height: null };
}

function imageResult(provider, item, rank) {
  let sourcePageUrl;
  let imageUrl;
  let thumbnailUrl;
  if (provider === 'brave') {
    sourcePageUrl = Search.normalizedHttpUrl(item && (item.url || item.source_url || item.page_url));
    imageUrl = Search.normalizedHttpUrl(item && item.properties && (item.properties.url || item.properties.src) || item && (item.image_url || item.imageUrl));
    thumbnailUrl = Search.normalizedHttpUrl(item && item.thumbnail && (item.thumbnail.src || item.thumbnail.url) || item && (item.thumbnail_url || item.thumbnailUrl));
  } else {
    sourcePageUrl = Search.normalizedHttpUrl(item && item.url);
    imageUrl = Search.normalizedHttpUrl(item && (item.img_src || item.image_src || item.image));
    thumbnailUrl = Search.normalizedHttpUrl(item && (item.thumbnail_src || item.thumbnail));
  }
  if (!imageUrl || !sourcePageUrl) return null;
  const size = dimensions(item);
  return {
    rank,
    title: plainText(item && (item.title || item.name || 'image result')),
    description: plainText(item && (item.description || item.content || '')),
    sourcePageUrl,
    imageUrl,
    thumbnailUrl,
    width: size.width,
    height: size.height,
    provider,
    providerEngines: Array.isArray(item && item.engines) ? item.engines.map(String).sort() : [],
    sourceLabel: plainText(item && (item.source || item.publisher || '')) || null
  };
}

function parseProviderResponse(provider, body, queryInput) {
  if (!PROVIDER_NAMES.has(provider)) throw new AxmImageSearchError('IMAGE_SEARCH_PROVIDER_UNKNOWN', 'unsupported image-search provider', { provider });
  const query = normalizeImageSearchQuery(queryInput);
  const raw = Array.isArray(body && body.results) ? body.results : [];
  const results = raw.map(function (item, index) { return imageResult(provider, item, index + 1); }).filter(Boolean).slice(0, query.count);
  const material = {
    schema: IMAGE_SEARCH_RESULT_SET_SCHEMA,
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
    authority: { imageFetchGranted: false, navigationGranted: false, contentTrusted: false }
  };
  return Object.assign({}, material, { resultSetDigest: Digest.canonicalDigest(material) });
}

function keyFor(result) {
  return result.imageUrl || result.sourcePageUrl;
}

function mergeResultSets(resultSets, options) {
  options = options || {};
  if (!Array.isArray(resultSets) || resultSets.length < 2) throw new AxmImageSearchError('IMAGE_SEARCH_MERGE_INPUT', 'federated image merge requires at least two result sets');
  const query = resultSets[0].query;
  const k = boundedInteger(options.k, RRF_K, 1, 1000, 'k');
  const maxResults = boundedInteger(options.maxResults, 50, 1, 100, 'maxResults');
  const merged = new Map();
  resultSets.forEach(function (set, setIndex) {
    if (!set || set.schema !== IMAGE_SEARCH_RESULT_SET_SCHEMA || set.query !== query) throw new AxmImageSearchError('IMAGE_SEARCH_MERGE_INPUT', 'all image result sets must share one normalized query');
    set.results.forEach(function (result) {
      const key = keyFor(result);
      if (!key) return;
      let item = merged.get(key);
      if (!item) {
        item = Object.assign({}, result, { score: 0, providers: [], providerRanks: {}, firstSeen: [setIndex, result.rank] });
        delete item.provider;
        delete item.agreementCount;
        merged.set(key, item);
      }
      item.score += 1 / (k + result.rank);
      if (!item.providers.includes(set.provider)) item.providers.push(set.provider);
      item.providerRanks[set.provider] = result.rank;
    });
  });
  const sorted = Array.from(merged.values()).sort(function (a, b) {
    if (b.score !== a.score) return b.score - a.score;
    if (b.providers.length !== a.providers.length) return b.providers.length - a.providers.length;
    if (a.firstSeen[0] !== b.firstSeen[0]) return a.firstSeen[0] - b.firstSeen[0];
    if (a.firstSeen[1] !== b.firstSeen[1]) return a.firstSeen[1] - b.firstSeen[1];
    return keyFor(a).localeCompare(keyFor(b));
  }).slice(0, maxResults);
  const results = sorted.map(function (item, index) {
    const out = Object.assign({}, item, {
      rank: index + 1,
      provider: item.providers.length > 1 ? 'federated' : item.providers[0],
      providers: item.providers.slice().sort(),
      agreementCount: item.providers.length,
      fusionScore: Number(item.score.toFixed(12))
    });
    delete out.score;
    delete out.firstSeen;
    return out;
  });
  const providers = Array.from(new Set(resultSets.map(function (set) { return set.provider; }))).sort();
  const material = {
    schema: IMAGE_SEARCH_RESULT_SET_SCHEMA,
    version: 1,
    status: 'EXPERIMENTAL',
    query,
    provider: 'federated',
    providers,
    resultCount: results.length,
    results,
    merge: { method: 'RECIPROCAL_RANK_FUSION', k },
    authority: { imageFetchGranted: false, navigationGranted: false, contentTrusted: false }
  };
  return Object.assign({}, material, { resultSetDigest: Digest.canonicalDigest(material) });
}

module.exports = {
  IMAGE_SEARCH_QUERY_SCHEMA,
  IMAGE_SEARCH_PLAN_SCHEMA,
  IMAGE_SEARCH_RESULT_SET_SCHEMA,
  DEFAULT_PROVIDER_PRIORITY,
  RRF_K,
  AxmImageSearchError,
  normalizeImageSearchQuery,
  configuredProviders,
  selectProviders,
  buildImageSearchPlan,
  parseProviderResponse,
  mergeResultSets
};
