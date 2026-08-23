'use strict';

const Digest = require('./digest');
const Search = require('./search-broker');

const SEARCH_EXECUTION_SCHEMA = 'axm.web.search-execution/v1';
const DEFAULT_TIMEOUT_MS = 8000;
const DEFAULT_MAX_RESPONSE_BYTES = 1024 * 1024;
const MAX_PROVIDER_REQUESTS = 3;
const NETWORK_AUTHORITY = 'EXPLICIT_ALLOW';
const FAILURE_MODES = new Set(['require-all', 'best-effort']);

const PROVIDER_COST_USD = Object.freeze({
  searxng: 0,
  brave: 0.005,
  kagi: 0.012
});

const DEFAULT_SECRET_REFS = Object.freeze({
  brave: Object.freeze({ type: 'ENV_HEADER_SECRET', header: 'X-Subscription-Token', prefix: '', secretEnv: 'BRAVE_SEARCH_API_KEY' }),
  kagi: Object.freeze({ type: 'ENV_HEADER_SECRET', header: 'Authorization', prefix: 'Bot ', secretEnv: 'KAGI_API_TOKEN' })
});

class AxmSearchExecutionError extends Error {
  constructor(code, message, details) {
    super(message);
    this.name = 'AxmSearchExecutionError';
    this.code = code;
    this.details = details || {};
  }
}

function positiveInteger(value, fallback, min, max, name) {
  if (value == null) return fallback;
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new AxmSearchExecutionError('SEARCH_EXECUTION_OPTIONS', name + ' must be an integer from ' + min + ' to ' + max, { name, value });
  }
  return value;
}

function planMaterial(plan) {
  const copy = JSON.parse(JSON.stringify(plan));
  delete copy.planDigest;
  return copy;
}

function validatePlan(plan) {
  if (!plan || plan.schema !== Search.SEARCH_PLAN_SCHEMA || typeof plan.planDigest !== 'string') {
    throw new AxmSearchExecutionError('SEARCH_PLAN_INVALID', 'a normalized AXM search plan is required');
  }
  const computed = Digest.canonicalDigest(planMaterial(plan));
  if (computed !== plan.planDigest) {
    throw new AxmSearchExecutionError('SEARCH_PLAN_DIGEST_MISMATCH', 'search plan digest does not match its material', {
      declared: plan.planDigest,
      computed
    });
  }
  if (!Array.isArray(plan.requests) || plan.requests.length < 1 || plan.requests.length > MAX_PROVIDER_REQUESTS) {
    throw new AxmSearchExecutionError('SEARCH_PLAN_INVALID', 'search plan provider request count is outside the executor bound', {
      count: Array.isArray(plan.requests) ? plan.requests.length : null,
      max: MAX_PROVIDER_REQUESTS
    });
  }
  if (!plan.query || plan.query.schema !== Search.SEARCH_QUERY_SCHEMA || !Array.isArray(plan.providers)
      || plan.providers.length !== plan.requests.length || new Set(plan.providers).size !== plan.providers.length
      || plan.requests.some(function (request, index) { return !request || request.provider !== plan.providers[index]; })) {
    throw new AxmSearchExecutionError('SEARCH_PLAN_INVALID', 'search query, provider order, and request order must agree exactly');
  }
  if (!plan.authority || plan.authority.networkExecutionGranted !== false) {
    throw new AxmSearchExecutionError('SEARCH_PLAN_INVALID', 'search plan must remain non-executing; authority is granted only to this executor call');
  }
  return plan;
}

function sameStringMap(actual, expected) {
  if (!actual || typeof actual !== 'object' || Array.isArray(actual)) return false;
  const actualKeys = Object.keys(actual).sort();
  const expectedKeys = Object.keys(expected).sort();
  return actualKeys.length === expectedKeys.length && actualKeys.every(function (key, index) {
    return key === expectedKeys[index] && typeof actual[key] === 'string' && actual[key] === expected[key];
  });
}

function sameSecretRef(actual, expected) {
  return Boolean(actual && expected && actual.type === 'ENV_HEADER_SECRET'
    && actual.header === expected.header && actual.prefix === expected.prefix && actual.secretEnv === expected.secretEnv);
}

function allowedSecretRefs(provider, options) {
  const defaults = DEFAULT_SECRET_REFS[provider] ? [DEFAULT_SECRET_REFS[provider]] : [];
  const explicit = Array.isArray(options.allowedSecretRefs) ? options.allowedSecretRefs.filter(function (item) {
    return item && item.provider === provider;
  }) : [];
  return defaults.concat(explicit);
}

function validateRequestEnvelope(request, options) {
  if (!request || request.method !== 'GET' || request.transportAuthority !== 'REQUIRES_EXPLICIT_NETWORK_EXECUTOR'
      || !sameStringMap(request.headers, { Accept: 'application/json' })) {
    throw new AxmSearchExecutionError('SEARCH_REQUEST_SHAPE_REFUSED', 'search request method, headers, or transport authority drifted', { provider: request && request.provider });
  }
  if (request.provider === 'searxng') {
    if (request.auth !== null) throw new AxmSearchExecutionError('SEARCH_AUTH_REF_REFUSED', 'SearXNG plans may not select an environment secret', { provider: request.provider });
    return;
  }
  if (!allowedSecretRefs(request.provider, options).some(function (expected) { return sameSecretRef(request.auth, expected); })) {
    throw new AxmSearchExecutionError('SEARCH_AUTH_REF_REFUSED', 'search credential reference is not the provider default or an explicit executor allowlist entry', { provider: request.provider, secretEnv: request.auth && request.auth.secretEnv });
  }
}

function endpointIdentity(value) {
  const url = new URL(String(value));
  return url.protocol + '//' + url.host + url.pathname.replace(/\/+$/, '');
}

function validateRequestEndpoint(request, options) {
  const url = new URL(request.url);
  if (url.username || url.password || url.hash || !['http:', 'https:'].includes(url.protocol)) {
    throw new AxmSearchExecutionError('SEARCH_ENDPOINT_REFUSED', 'search request endpoint has a refused URL shape', { provider: request.provider });
  }
  if (request.provider === 'brave') {
    if (url.protocol !== 'https:' || url.hostname !== 'api.search.brave.com' || url.pathname !== '/res/v1/web/search') {
      throw new AxmSearchExecutionError('SEARCH_ENDPOINT_REFUSED', 'Brave search execution is pinned to the documented web-search endpoint');
    }
    return;
  }
  if (request.provider === 'kagi') {
    if (url.protocol !== 'https:' || url.hostname !== 'kagi.com' || url.pathname !== '/api/v1/search') {
      throw new AxmSearchExecutionError('SEARCH_ENDPOINT_REFUSED', 'Kagi search execution is pinned to the documented v1 search endpoint');
    }
    return;
  }
  if (request.provider === 'searxng') {
    const allowed = Array.isArray(options.allowedSearxngEndpoints) ? options.allowedSearxngEndpoints : [];
    if (!allowed.length) {
      throw new AxmSearchExecutionError('SEARCH_ENDPOINT_REFUSED', 'SearXNG execution requires an explicit allowedSearxngEndpoints list');
    }
    const requested = endpointIdentity(url);
    const match = allowed.some(function (candidate) {
      try { return endpointIdentity(candidate) === requested; } catch (_error) { return false; }
    });
    if (!match) {
      throw new AxmSearchExecutionError('SEARCH_ENDPOINT_REFUSED', 'SearXNG request endpoint is not in the exact configured endpoint allowlist', { endpoint: requested });
    }
    return;
  }
  throw new AxmSearchExecutionError('SEARCH_ENDPOINT_REFUSED', 'unknown provider endpoint refused', { provider: request.provider });
}

function materializeHeaders(request, env) {
  const headers = Object.assign({}, request.headers || {});
  if (!request.auth) return headers;
  const secret = env && env[request.auth.secretEnv];
  if (typeof secret !== 'string' || !secret) {
    throw new AxmSearchExecutionError('SEARCH_SECRET_MISSING', 'required search credential is not available', {
      provider: request.provider,
      secretEnv: request.auth.secretEnv
    });
  }
  headers[request.auth.header] = String(request.auth.prefix || '') + secret;
  return headers;
}

async function readBoundedJson(response, maxBytes) {
  const contentType = String(response.headers.get('content-type') || '').toLowerCase();
  if (!/(?:^|;)\s*application\/(?:[a-z0-9.+-]+\+)?json(?:\s*;|$)/i.test(contentType)) {
    throw new AxmSearchExecutionError('SEARCH_RESPONSE_CONTENT_TYPE', 'search provider response is not JSON', { contentType });
  }
  const declared = Number(response.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > maxBytes) {
    throw new AxmSearchExecutionError('SEARCH_RESPONSE_BYTES_LIMIT', 'declared provider response exceeds the configured byte bound', {
      declared,
      maxBytes
    });
  }
  if (!response.body || typeof response.body.getReader !== 'function') {
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length > maxBytes) throw new AxmSearchExecutionError('SEARCH_RESPONSE_BYTES_LIMIT', 'provider response exceeds the configured byte bound', { bytes: bytes.length, maxBytes });
    return decodeJson(bytes);
  }
  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  try {
    while (true) {
      const item = await reader.read();
      if (item.done) break;
      const chunk = Buffer.from(item.value);
      total += chunk.length;
      if (total > maxBytes) {
        await reader.cancel();
        throw new AxmSearchExecutionError('SEARCH_RESPONSE_BYTES_LIMIT', 'provider response exceeds the configured byte bound', { bytes: total, maxBytes });
      }
      chunks.push(chunk);
    }
  } finally {
    try { reader.releaseLock(); } catch (_error) {}
  }
  return decodeJson(Buffer.concat(chunks, total));
}

function decodeJson(bytes) {
  let text;
  try { text = new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
  catch (_error) { throw new AxmSearchExecutionError('SEARCH_RESPONSE_UTF8', 'provider response is not valid UTF-8'); }
  try { return { body: JSON.parse(text), bytes: bytes.length, bodyDigest: Digest.sha256Hex(bytes) }; }
  catch (_error) { throw new AxmSearchExecutionError('SEARCH_RESPONSE_JSON', 'provider response is not valid JSON'); }
}

function safeFailure(provider, error) {
  return {
    provider,
    status: 'FAIL',
    code: String(error && error.code || 'SEARCH_PROVIDER_ERROR'),
    message: String(error && error.message || error),
    estimatedExternalApiUsd: PROVIDER_COST_USD[provider] || 0
  };
}

async function executeOne(request, query, options) {
  validateRequestEnvelope(request, options);
  validateRequestEndpoint(request, options);
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  if (typeof fetchImpl !== 'function') throw new AxmSearchExecutionError('SEARCH_FETCH_UNAVAILABLE', 'no fetch implementation is available');
  const timeoutMs = positiveInteger(options.timeoutMs, DEFAULT_TIMEOUT_MS, 100, 60000, 'timeoutMs');
  const maxResponseBytes = positiveInteger(options.maxResponseBytes, DEFAULT_MAX_RESPONSE_BYTES, 1024, 8 * 1024 * 1024, 'maxResponseBytes');
  const controller = new AbortController();
  const timer = setTimeout(function () { controller.abort(); }, timeoutMs);
  let response;
  try {
    response = await fetchImpl(request.url, {
      method: 'GET',
      headers: materializeHeaders(request, options.env || process.env),
      redirect: 'error',
      cache: 'no-store',
      credentials: 'omit',
      signal: controller.signal
    });
  } catch (error) {
    if (controller.signal.aborted) throw new AxmSearchExecutionError('SEARCH_TIMEOUT', 'search provider request exceeded the timeout', { provider: request.provider, timeoutMs });
    throw new AxmSearchExecutionError('SEARCH_TRANSPORT_ERROR', 'search provider request failed', { provider: request.provider, cause: String(error && error.message || error) });
  } finally {
    clearTimeout(timer);
  }
  if (!response || !Number.isInteger(response.status)) throw new AxmSearchExecutionError('SEARCH_TRANSPORT_ERROR', 'search provider returned no valid HTTP response', { provider: request.provider });
  if (!response.ok) {
    throw new AxmSearchExecutionError('SEARCH_HTTP_STATUS', 'search provider returned HTTP ' + response.status, {
      provider: request.provider,
      httpStatus: response.status
    });
  }
  const decoded = await readBoundedJson(response, maxResponseBytes);
  const resultSet = Search.parseProviderResponse(request.provider, decoded.body, query);
  return {
    receipt: {
      provider: request.provider,
      status: 'PASS',
      httpStatus: response.status,
      responseBytes: decoded.bytes,
      responseBodyDigest: decoded.bodyDigest,
      resultCount: resultSet.resultCount,
      estimatedExternalApiUsd: PROVIDER_COST_USD[request.provider] || 0
    },
    resultSet
  };
}

async function executeSearchPlan(plan, options) {
  options = options || {};
  validatePlan(plan);
  if (options.networkAuthority !== NETWORK_AUTHORITY) {
    throw new AxmSearchExecutionError('SEARCH_NETWORK_NOT_AUTHORIZED', 'search execution requires networkAuthority=EXPLICIT_ALLOW');
  }
  const failureMode = String(options.failureMode || 'require-all');
  if (!FAILURE_MODES.has(failureMode)) throw new AxmSearchExecutionError('SEARCH_EXECUTION_OPTIONS', 'failureMode must be require-all or best-effort');
  const receipts = [];
  const resultSets = [];
  const failures = [];

  for (const request of plan.requests) {
    try {
      const executed = await executeOne(request, plan.query, options);
      receipts.push(executed.receipt);
      resultSets.push(executed.resultSet);
    } catch (error) {
      const failure = safeFailure(request.provider, error);
      receipts.push(failure);
      failures.push(failure);
      if (failureMode === 'require-all') {
        throw new AxmSearchExecutionError('SEARCH_PROVIDER_FAILED', 'search execution stopped because a required provider failed', {
          provider: request.provider,
          code: failure.code,
          receipts
        });
      }
    }
  }
  if (!resultSets.length) throw new AxmSearchExecutionError('SEARCH_NO_PROVIDER_SUCCEEDED', 'no configured search provider completed successfully', { receipts });
  const resultSet = resultSets.length === 1 ? resultSets[0] : Search.mergeResultSets(resultSets, {
    k: plan.merge ? plan.merge.k : Search.RRF_K,
    maxPerDomain: plan.merge ? plan.merge.maxPerDomain : 3,
    maxResults: Math.min(100, Math.max(plan.query.count, plan.query.count * resultSets.length))
  });
  const succeeded = receipts.filter(function (receipt) { return receipt.status === 'PASS'; }).map(function (receipt) { return receipt.provider; });
  const failed = failures.map(function (receipt) { return receipt.provider; });
  const material = {
    schema: SEARCH_EXECUTION_SCHEMA,
    version: 1,
    status: failed.length ? 'PARTIAL' : 'PASS',
    planDigest: plan.planDigest,
    failureMode,
    providersRequested: plan.providers.slice(),
    providersSucceeded: succeeded,
    providersFailed: failed,
    receipts,
    resultSet,
    estimatedExternalApiUsd: Number(receipts.reduce(function (sum, receipt) { return sum + receipt.estimatedExternalApiUsd; }, 0).toFixed(6)),
    authority: {
      networkExecutionUsed: true,
      arbitraryNavigationGranted: false,
      resultContentTrusted: false,
      installAllowed: false,
      promotionAllowed: false,
      canonAllowed: false
    }
  };
  return Object.assign({}, material, { executionDigest: Digest.canonicalDigest(material) });
}

module.exports = {
  SEARCH_EXECUTION_SCHEMA,
  DEFAULT_TIMEOUT_MS,
  DEFAULT_MAX_RESPONSE_BYTES,
  MAX_PROVIDER_REQUESTS,
  NETWORK_AUTHORITY,
  PROVIDER_COST_USD,
  AxmSearchExecutionError,
  validatePlan,
  validateRequestEnvelope,
  validateRequestEndpoint,
  materializeHeaders,
  readBoundedJson,
  executeSearchPlan
};
