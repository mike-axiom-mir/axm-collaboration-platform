'use strict';

const Digest = require('./digest');

const EXPOSURE_QUERY_SCHEMA = 'axm.web.exposure-query/v1';
const EXPOSURE_PLAN_SCHEMA = 'axm.web.exposure-plan/v1';
const EXPOSURE_RESULT_SET_SCHEMA = 'axm.web.exposure-result-set/v1';
const MODES = new Set(['count', 'search']);
const SAFE_FIELDS = Object.freeze([
  'ip_str','port','transport','product','version','org','isp','asn',
  'hostnames','domains','location.country_code','location.city',
  'timestamp','os','cpe','tags'
]);

class AxmExposureSearchError extends Error {
  constructor(code, message, details) {
    super(message);
    this.name = 'AxmExposureSearchError';
    this.code = code;
    this.details = details || {};
  }
}

function cleanQuery(value) {
  const query = String(value == null ? '' : value).trim().replace(/\s+/g, ' ');
  if (!query) throw new AxmExposureSearchError('EXPOSURE_QUERY_INVALID', 'exposure query may not be empty');
  if (query.length > 400) throw new AxmExposureSearchError('EXPOSURE_QUERY_LIMIT', 'exposure query exceeds 400 characters', { length: query.length });
  if (query.split(' ').length > 50) throw new AxmExposureSearchError('EXPOSURE_QUERY_LIMIT', 'exposure query exceeds 50 words');
  return query;
}

function cleanFacets(value) {
  const allowed = new Set(['port','org','asn','country','product','os']);
  const items = Array.isArray(value) ? value : [];
  const out = [];
  for (const item of items) {
    const facet = String(item || '').trim().toLowerCase();
    if (!facet || !allowed.has(facet)) throw new AxmExposureSearchError('EXPOSURE_FACET_INVALID', 'unsupported exposure facet', { facet });
    if (!out.includes(facet)) out.push(facet);
  }
  if (out.length > 3) throw new AxmExposureSearchError('EXPOSURE_FACET_LIMIT', 'at most 3 facets are allowed');
  return out;
}

function normalizeExposureQuery(input) {
  const source = typeof input === 'string' ? { query: input } : input;
  if (!source || typeof source !== 'object' || Array.isArray(source)) {
    throw new AxmExposureSearchError('EXPOSURE_QUERY_INVALID', 'exposure query must be a string or object');
  }
  const mode = String(source.mode || 'count').toLowerCase();
  if (!MODES.has(mode)) throw new AxmExposureSearchError('EXPOSURE_QUERY_INVALID', 'mode must be count or search', { mode });
  return {
    schema: EXPOSURE_QUERY_SCHEMA,
    version: 1,
    query: cleanQuery(source.query),
    mode,
    resultLimit: Number.isInteger(source.resultLimit) ? source.resultLimit : 20,
    facets: cleanFacets(source.facets)
  };
}

function validateNormalizedQuery(query) {
  if (!query || query.schema !== EXPOSURE_QUERY_SCHEMA) throw new AxmExposureSearchError('EXPOSURE_QUERY_INVALID', 'normalized AXM exposure query required');
  if (!Number.isInteger(query.resultLimit) || query.resultLimit < 1 || query.resultLimit > 20) {
    throw new AxmExposureSearchError('EXPOSURE_RESULT_LIMIT', 'resultLimit must be 1..20', { resultLimit: query.resultLimit });
  }
  return query;
}

function secretRef(config) {
  const secretEnv = String(config && config.secretEnv || 'SHODAN_API_KEY');
  if (!/^[A-Z][A-Z0-9_]{2,63}$/.test(secretEnv)) {
    throw new AxmExposureSearchError('EXPOSURE_CONFIG_INVALID', 'Shodan secretEnv must be an uppercase environment-variable name', { secretEnv });
  }
  return { type: 'QUERY_PARAMETER_SECRET', secretEnv, parameter: 'key' };
}

function buildExposurePlan(input, config) {
  config = config || {};
  if (!config.shodan || config.shodan.enabled !== true) {
    throw new AxmExposureSearchError('EXPOSURE_PROVIDER_UNCONFIGURED', 'Shodan exposure provider is not enabled');
  }
  const query = validateNormalizedQuery(normalizeExposureQuery(input));
  const base = query.mode === 'count'
    ? 'https://api.shodan.io/shodan/host/count'
    : 'https://api.shodan.io/shodan/host/search';
  const url = new URL(base);
  url.searchParams.set('query', query.query);
  if (query.facets.length) url.searchParams.set('facets', query.facets.join(','));
  if (query.mode === 'search') {
    url.searchParams.set('page', '1');
    url.searchParams.set('minify', 'true');
    url.searchParams.set('fields', SAFE_FIELDS.join(','));
  }
  const request = {
    provider: 'shodan',
    mode: query.mode,
    method: 'GET',
    url: url.toString(),
    headers: { Accept: 'application/json' },
    auth: secretRef(config.shodan),
    transportAuthority: 'REQUIRES_EXPLICIT_EXPOSURE_EXECUTOR'
  };
  const material = {
    schema: EXPOSURE_PLAN_SCHEMA,
    version: 1,
    status: 'EXPERIMENTAL',
    query,
    provider: 'shodan',
    requests: [request],
    authority: {
      networkExecutionGranted: false,
      activeScanGranted: false,
      targetConnectionGranted: false,
      credentialTestingGranted: false,
      exploitExecutionGranted: false,
      resultContentTrusted: false,
      installAllowed: false,
      promotionAllowed: false,
      canonAllowed: false
    }
  };
  return Object.assign({}, material, { planDigest: Digest.canonicalDigest(material) });
}

function text(value, max) {
  const out = String(value == null ? '' : value).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
  return out.slice(0, max);
}

function strings(value, maxItems, maxChars) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, maxItems).map(function (item) { return text(item, maxChars); }).filter(Boolean);
}

function integer(value, min, max) {
  return Number.isInteger(value) && value >= min && value <= max ? value : null;
}

function normalizeFacetBody(facets) {
  if (!facets || typeof facets !== 'object' || Array.isArray(facets)) return {};
  const out = {};
  Object.keys(facets).slice(0, 6).sort().forEach(function (name) {
    const rows = Array.isArray(facets[name]) ? facets[name] : [];
    out[name] = rows.slice(0, 20).map(function (row) {
      return { value: text(row && row.value, 160), count: Number.isFinite(Number(row && row.count)) ? Number(row.count) : 0 };
    }).filter(function (row) { return row.value; });
  });
  return out;
}

function normalizeAsset(match, rank) {
  const location = match && match.location && typeof match.location === 'object' ? match.location : {};
  const asset = {
    rank,
    ip: text(match && match.ip_str, 80),
    port: integer(match && match.port, 1, 65535),
    transport: text(match && match.transport, 16) || null,
    product: text(match && match.product, 160) || null,
    version: text(match && match.version, 120) || null,
    org: text(match && match.org, 200) || null,
    isp: text(match && match.isp, 200) || null,
    asn: text(match && match.asn, 40) || null,
    hostnames: strings(match && match.hostnames, 12, 253),
    domains: strings(match && match.domains, 12, 253),
    countryCode: text(location.country_code, 8) || null,
    city: text(location.city, 120) || null,
    timestamp: text(match && match.timestamp, 80) || null,
    os: text(match && match.os, 160) || null,
    cpe: strings(match && match.cpe, 16, 300),
    tags: strings(match && match.tags, 16, 100)
  };
  if (!asset.ip || asset.port == null) return null;
  return asset;
}

function parseExposureResponse(body, queryInput) {
  const query = validateNormalizedQuery(normalizeExposureQuery(queryInput));
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new AxmExposureSearchError('EXPOSURE_RESPONSE_INVALID', 'Shodan response must be a JSON object');
  const total = Number.isFinite(Number(body.total)) ? Math.max(0, Number(body.total)) : 0;
  const assets = query.mode === 'search'
    ? (Array.isArray(body.matches) ? body.matches : []).map(function (match, index) { return normalizeAsset(match, index + 1); }).filter(Boolean).slice(0, query.resultLimit)
    : [];
  const material = {
    schema: EXPOSURE_RESULT_SET_SCHEMA,
    version: 1,
    status: 'EXPERIMENTAL',
    provider: 'shodan',
    query: query.query,
    mode: query.mode,
    total,
    facets: normalizeFacetBody(body.facets),
    assetCount: assets.length,
    assets,
    authority: {
      metadataOnly: true,
      rawBannerReturned: false,
      activeScanUsed: false,
      targetConnectionGranted: false,
      credentialTestingGranted: false,
      exploitExecutionGranted: false,
      contentTrusted: false
    }
  };
  return Object.assign({}, material, { resultSetDigest: Digest.canonicalDigest(material) });
}

module.exports = {
  EXPOSURE_QUERY_SCHEMA,
  EXPOSURE_PLAN_SCHEMA,
  EXPOSURE_RESULT_SET_SCHEMA,
  SAFE_FIELDS,
  AxmExposureSearchError,
  normalizeExposureQuery,
  buildExposurePlan,
  parseExposureResponse
};
