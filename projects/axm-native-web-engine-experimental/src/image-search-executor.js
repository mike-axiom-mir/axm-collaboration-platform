'use strict';

const Digest = require('./digest');
const ImageSearch = require('./image-search-broker');

const IMAGE_SEARCH_EXECUTION_SCHEMA = 'axm.web.image-search-execution/v1';
const NETWORK_AUTHORITY = 'EXPLICIT_ALLOW';
const DEFAULT_TIMEOUT_MS = 10000;
const DEFAULT_MAX_RESPONSE_BYTES = 2 * 1024 * 1024;
const MAX_PROVIDER_REQUESTS = 2;
const FAILURE_MODES = new Set(['require-all', 'best-effort']);
const DEFAULT_SECRET_REFS = Object.freeze({
  brave: Object.freeze({ type: 'ENV_HEADER_SECRET', header: 'X-Subscription-Token', prefix: '', secretEnv: 'BRAVE_SEARCH_API_KEY' })
});

class AxmImageSearchExecutionError extends Error {
  constructor(code, message, details) {
    super(message);
    this.name = 'AxmImageSearchExecutionError';
    this.code = code;
    this.details = details || {};
  }
}

function planMaterial(plan) {
  const copy = JSON.parse(JSON.stringify(plan));
  delete copy.planDigest;
  return copy;
}

function validatePlan(plan) {
  if (!plan || plan.schema !== ImageSearch.IMAGE_SEARCH_PLAN_SCHEMA || typeof plan.planDigest !== 'string') throw new AxmImageSearchExecutionError('IMAGE_SEARCH_PLAN_INVALID', 'a sealed AXM image-search plan is required');
  const computed = Digest.canonicalDigest(planMaterial(plan));
  if (computed !== plan.planDigest) throw new AxmImageSearchExecutionError('IMAGE_SEARCH_PLAN_DIGEST_MISMATCH', 'image-search plan digest mismatch');
  if (!Array.isArray(plan.requests) || plan.requests.length < 1 || plan.requests.length > MAX_PROVIDER_REQUESTS) throw new AxmImageSearchExecutionError('IMAGE_SEARCH_PLAN_INVALID', 'image-search request count is outside executor bound');
  if (!plan.query || plan.query.schema !== ImageSearch.IMAGE_SEARCH_QUERY_SCHEMA || !Array.isArray(plan.providers)
      || plan.providers.length !== plan.requests.length || new Set(plan.providers).size !== plan.providers.length
      || plan.requests.some(function (request, index) { return !request || request.provider !== plan.providers[index]; })) throw new AxmImageSearchExecutionError('IMAGE_SEARCH_PLAN_INVALID', 'image-search query, provider order, and request order must agree exactly');
  if (!plan.authority || plan.authority.networkExecutionGranted !== false || plan.authority.imageFetchGranted !== false) throw new AxmImageSearchExecutionError('IMAGE_SEARCH_PLAN_INVALID', 'image-search plan must remain non-executing');
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

function validateRequestEnvelope(request, options) {
  if (!request || request.method !== 'GET' || request.transportAuthority !== 'REQUIRES_EXPLICIT_IMAGE_SEARCH_EXECUTOR'
      || !sameStringMap(request.headers, { Accept: 'application/json' })) throw new AxmImageSearchExecutionError('IMAGE_SEARCH_REQUEST_SHAPE_REFUSED', 'image-search request method, headers, or transport authority drifted', { provider: request && request.provider });
  if (request.provider === 'searxng') {
    if (request.auth !== null) throw new AxmImageSearchExecutionError('IMAGE_SEARCH_AUTH_REF_REFUSED', 'SearXNG image plans may not select an environment secret', { provider: request.provider });
    return;
  }
  const explicit = Array.isArray(options.allowedSecretRefs) ? options.allowedSecretRefs.filter(function (item) { return item && item.provider === request.provider; }) : [];
  const allowed = (DEFAULT_SECRET_REFS[request.provider] ? [DEFAULT_SECRET_REFS[request.provider]] : []).concat(explicit);
  if (!allowed.some(function (expected) { return sameSecretRef(request.auth, expected); })) throw new AxmImageSearchExecutionError('IMAGE_SEARCH_AUTH_REF_REFUSED', 'image-search credential reference is not the provider default or an explicit executor allowlist entry', { provider: request.provider, secretEnv: request.auth && request.auth.secretEnv });
}

function endpointIdentity(value) {
  const url = new URL(String(value));
  return url.protocol + '//' + url.host + url.pathname.replace(/\/+$/, '');
}

function validateRequestEndpoint(request, options) {
  const url = new URL(request.url);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.hash) throw new AxmImageSearchExecutionError('IMAGE_SEARCH_ENDPOINT_REFUSED', 'image-search endpoint has refused URL shape', { provider: request.provider });
  if (request.provider === 'brave') {
    if (url.protocol !== 'https:' || url.hostname !== 'api.search.brave.com' || url.pathname !== '/res/v1/images/search') throw new AxmImageSearchExecutionError('IMAGE_SEARCH_ENDPOINT_REFUSED', 'Brave image search is pinned to the official images endpoint');
    return;
  }
  if (request.provider === 'searxng') {
    const allowed = Array.isArray(options.allowedSearxngEndpoints) ? options.allowedSearxngEndpoints : [];
    const requested = endpointIdentity(url);
    if (!allowed.some(function (candidate) { try { return endpointIdentity(candidate) === requested; } catch (_error) { return false; } })) {
      throw new AxmImageSearchExecutionError('IMAGE_SEARCH_ENDPOINT_REFUSED', 'SearXNG image search requires exact endpoint allowlisting', { endpoint: requested });
    }
    return;
  }
  throw new AxmImageSearchExecutionError('IMAGE_SEARCH_ENDPOINT_REFUSED', 'unsupported image-search provider endpoint', { provider: request.provider });
}

function materializeHeaders(request, env) {
  const headers = Object.assign({}, request.headers || {});
  if (!request.auth) return headers;
  const secret = env && env[request.auth.secretEnv];
  if (typeof secret !== 'string' || !secret) throw new AxmImageSearchExecutionError('IMAGE_SEARCH_SECRET_MISSING', 'required image-search credential is unavailable', { provider: request.provider, secretEnv: request.auth.secretEnv });
  headers[request.auth.header] = String(request.auth.prefix || '') + secret;
  return headers;
}

function decodeJson(bytes) {
  let text;
  try { text = new TextDecoder('utf-8', { fatal: true }).decode(bytes); } catch (_error) { throw new AxmImageSearchExecutionError('IMAGE_SEARCH_RESPONSE_UTF8', 'image-search response is not UTF-8'); }
  let body;
  try { body = JSON.parse(text); } catch (_error) { throw new AxmImageSearchExecutionError('IMAGE_SEARCH_RESPONSE_JSON', 'image-search response is not valid JSON'); }
  return { body, bytes: bytes.length, digest: Digest.sha256Hex(bytes) };
}

async function readBoundedJson(response, maxBytes) {
  const contentType = String(response.headers.get('content-type') || '').toLowerCase();
  if (!/(?:^|;)\s*application\/(?:[a-z0-9.+-]+\+)?json(?:\s*;|$)/i.test(contentType)) throw new AxmImageSearchExecutionError('IMAGE_SEARCH_RESPONSE_CONTENT_TYPE', 'image-search response is not JSON', { contentType });
  const declared = Number(response.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > maxBytes) throw new AxmImageSearchExecutionError('IMAGE_SEARCH_RESPONSE_BYTES_LIMIT', 'declared image-search response exceeds byte bound', { declared, maxBytes });
  if (!response.body || typeof response.body.getReader !== 'function') {
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length > maxBytes) throw new AxmImageSearchExecutionError('IMAGE_SEARCH_RESPONSE_BYTES_LIMIT', 'image-search response exceeds byte bound', { bytes: bytes.length, maxBytes });
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
        throw new AxmImageSearchExecutionError('IMAGE_SEARCH_RESPONSE_BYTES_LIMIT', 'image-search response exceeds byte bound', { bytes: total, maxBytes });
      }
      chunks.push(chunk);
    }
  } finally {
    try { reader.releaseLock(); } catch (_error) {}
  }
  return decodeJson(Buffer.concat(chunks, total));
}

function boundedInteger(value, fallback, min, max, name) {
  if (value == null) return fallback;
  if (!Number.isInteger(value) || value < min || value > max) throw new AxmImageSearchExecutionError('IMAGE_SEARCH_EXECUTION_OPTIONS', name + ' out of range', { name, value });
  return value;
}

async function executeOne(request, query, options) {
  validateRequestEnvelope(request, options);
  validateRequestEndpoint(request, options);
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  if (typeof fetchImpl !== 'function') throw new AxmImageSearchExecutionError('IMAGE_SEARCH_FETCH_UNAVAILABLE', 'no fetch implementation is available');
  const timeoutMs = boundedInteger(options.timeoutMs, DEFAULT_TIMEOUT_MS, 100, 60000, 'timeoutMs');
  const maxResponseBytes = boundedInteger(options.maxResponseBytes, DEFAULT_MAX_RESPONSE_BYTES, 1024, 8 * 1024 * 1024, 'maxResponseBytes');
  const controller = new AbortController();
  const timer = setTimeout(function () { controller.abort(); }, timeoutMs);
  let response;
  try {
    response = await fetchImpl(request.url, { method: 'GET', headers: materializeHeaders(request, options.env || process.env), redirect: 'error', cache: 'no-store', credentials: 'omit', signal: controller.signal });
  } catch (error) {
    if (controller.signal.aborted) throw new AxmImageSearchExecutionError('IMAGE_SEARCH_TIMEOUT', 'image-search request timed out', { provider: request.provider, timeoutMs });
    throw new AxmImageSearchExecutionError('IMAGE_SEARCH_TRANSPORT_ERROR', 'image-search request failed', { provider: request.provider, cause: String(error && error.message || error) });
  } finally { clearTimeout(timer); }
  if (!response || !response.ok) throw new AxmImageSearchExecutionError('IMAGE_SEARCH_HTTP_STATUS', 'image-search provider returned HTTP ' + (response && response.status), { provider: request.provider, httpStatus: response && response.status });
  const decoded = await readBoundedJson(response, maxResponseBytes);
  const resultSet = ImageSearch.parseProviderResponse(request.provider, decoded.body, query);
  return { receipt: { provider: request.provider, status: 'PASS', httpStatus: response.status, responseBytes: decoded.bytes, responseBodyDigest: decoded.digest, resultCount: resultSet.resultCount }, resultSet };
}

async function executeImageSearchPlan(plan, options) {
  options = options || {};
  validatePlan(plan);
  if (options.networkAuthority !== NETWORK_AUTHORITY) throw new AxmImageSearchExecutionError('IMAGE_SEARCH_NETWORK_NOT_AUTHORIZED', 'image search requires networkAuthority=EXPLICIT_ALLOW');
  const failureMode = String(options.failureMode || 'require-all');
  if (!FAILURE_MODES.has(failureMode)) throw new AxmImageSearchExecutionError('IMAGE_SEARCH_EXECUTION_OPTIONS', 'failureMode must be require-all or best-effort');
  const receipts = [], sets = [], failures = [];
  for (const request of plan.requests) {
    try {
      const run = await executeOne(request, plan.query, options);
      receipts.push(run.receipt); sets.push(run.resultSet);
    } catch (error) {
      const failure = { provider: request.provider, status: 'FAIL', code: String(error && error.code || 'IMAGE_SEARCH_PROVIDER_ERROR'), message: String(error && error.message || error) };
      receipts.push(failure); failures.push(failure);
      if (failureMode === 'require-all') throw new AxmImageSearchExecutionError('IMAGE_SEARCH_PROVIDER_FAILED', 'image search stopped because a required provider failed', { provider: request.provider, code: failure.code, receipts });
    }
  }
  if (!sets.length) throw new AxmImageSearchExecutionError('IMAGE_SEARCH_NO_PROVIDER_SUCCEEDED', 'no image-search provider succeeded', { receipts });
  const resultSet = sets.length === 1 ? sets[0] : ImageSearch.mergeResultSets(sets, { k: plan.merge ? plan.merge.k : ImageSearch.RRF_K, maxResults: Math.min(100, plan.query.count * sets.length) });
  const material = {
    schema: IMAGE_SEARCH_EXECUTION_SCHEMA,
    version: 1,
    status: failures.length ? 'PARTIAL' : 'PASS',
    planDigest: plan.planDigest,
    failureMode,
    providersRequested: plan.providers.slice(),
    providersSucceeded: receipts.filter(function (item) { return item.status === 'PASS'; }).map(function (item) { return item.provider; }),
    providersFailed: failures.map(function (item) { return item.provider; }),
    receipts,
    resultSet,
    authority: { networkExecutionUsed: true, imageBytesFetched: false, arbitraryNavigationGranted: false, resultContentTrusted: false, installAllowed: false, promotionAllowed: false, canonAllowed: false }
  };
  return Object.assign({}, material, { executionDigest: Digest.canonicalDigest(material) });
}

module.exports = { IMAGE_SEARCH_EXECUTION_SCHEMA, NETWORK_AUTHORITY, DEFAULT_TIMEOUT_MS, DEFAULT_MAX_RESPONSE_BYTES, MAX_PROVIDER_REQUESTS, AxmImageSearchExecutionError, validatePlan, validateRequestEnvelope, validateRequestEndpoint, materializeHeaders, readBoundedJson, executeImageSearchPlan };
