'use strict';

const { TextDecoder } = require('node:util');
const Digest = require('./digest');
const Exposure = require('./exposure-search-broker');

const EXPOSURE_EXECUTION_SCHEMA = 'axm.web.exposure-execution/v1';
const NETWORK_AUTHORITY = 'EXPLICIT_ALLOW';
const DEFAULT_TIMEOUT_MS = 10000;
const DEFAULT_MAX_RESPONSE_BYTES = 2 * 1024 * 1024;

class AxmExposureExecutionError extends Error {
  constructor(code, message, details) {
    super(message);
    this.name = 'AxmExposureExecutionError';
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
  if (!plan || plan.schema !== Exposure.EXPOSURE_PLAN_SCHEMA || typeof plan.planDigest !== 'string') {
    throw new AxmExposureExecutionError('EXPOSURE_PLAN_INVALID', 'a sealed AXM exposure plan is required');
  }
  const computed = Digest.canonicalDigest(planMaterial(plan));
  if (computed !== plan.planDigest) throw new AxmExposureExecutionError('EXPOSURE_PLAN_DIGEST_MISMATCH', 'exposure plan digest mismatch');
  if (!Array.isArray(plan.requests) || plan.requests.length !== 1) throw new AxmExposureExecutionError('EXPOSURE_PLAN_INVALID', 'exposure executor requires exactly one provider request');
  if (!plan.authority || plan.authority.networkExecutionGranted !== false || plan.authority.activeScanGranted !== false) {
    throw new AxmExposureExecutionError('EXPOSURE_PLAN_INVALID', 'exposure plan must remain non-executing and scan-free');
  }
  return plan;
}

function validateEndpoint(request) {
  let url;
  try { url = new URL(String(request.url)); }
  catch (_error) { throw new AxmExposureExecutionError('EXPOSURE_ENDPOINT_REFUSED', 'Shodan request URL is invalid'); }
  const allowedPath = request.mode === 'count' ? '/shodan/host/count' : '/shodan/host/search';
  if (url.protocol !== 'https:' || url.hostname !== 'api.shodan.io' || url.pathname !== allowedPath || url.username || url.password || url.hash) {
    throw new AxmExposureExecutionError('EXPOSURE_ENDPOINT_REFUSED', 'exposure search is pinned to the Shodan host search/count API');
  }
  if (url.searchParams.has('key')) throw new AxmExposureExecutionError('EXPOSURE_PLAN_INVALID', 'Shodan key must not be embedded in a plan URL');
  if (request.mode === 'search' && url.searchParams.get('page') !== '1') {
    throw new AxmExposureExecutionError('EXPOSURE_PAGE_REFUSED', 'exposure search is bounded to the first Shodan result page');
  }
  return url;
}

function materializeUrl(request, env) {
  const url = validateEndpoint(request);
  const auth = request.auth;
  if (!auth || auth.type !== 'QUERY_PARAMETER_SECRET' || auth.parameter !== 'key') {
    throw new AxmExposureExecutionError('EXPOSURE_AUTH_INVALID', 'Shodan query-secret reference is required');
  }
  const secret = env && env[auth.secretEnv];
  if (typeof secret !== 'string' || !secret) {
    throw new AxmExposureExecutionError('EXPOSURE_SECRET_MISSING', 'required Shodan API key is unavailable', { secretEnv: auth.secretEnv });
  }
  url.searchParams.set('key', secret);
  return url.toString();
}

function boundedInteger(value, fallback, min, max, name) {
  if (value == null) return fallback;
  if (!Number.isInteger(value) || value < min || value > max) throw new AxmExposureExecutionError('EXPOSURE_EXECUTION_OPTIONS', name + ' is outside its bound', { name, value });
  return value;
}

async function readBoundedJson(response, maxBytes) {
  const contentType = String(response.headers.get('content-type') || '').toLowerCase();
  if (!/(?:^|;)\s*application\/(?:[a-z0-9.+-]+\+)?json(?:\s*;|$)/i.test(contentType)) {
    throw new AxmExposureExecutionError('EXPOSURE_RESPONSE_CONTENT_TYPE', 'Shodan response is not JSON', { contentType });
  }
  const declared = Number(response.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > maxBytes) throw new AxmExposureExecutionError('EXPOSURE_RESPONSE_BYTES_LIMIT', 'declared Shodan response exceeds byte bound', { declared, maxBytes });
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length > maxBytes) throw new AxmExposureExecutionError('EXPOSURE_RESPONSE_BYTES_LIMIT', 'Shodan response exceeds byte bound', { bytes: bytes.length, maxBytes });
  let text;
  try { text = new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
  catch (_error) { throw new AxmExposureExecutionError('EXPOSURE_RESPONSE_UTF8', 'Shodan response is not valid UTF-8'); }
  let body;
  try { body = JSON.parse(text); }
  catch (_error) { throw new AxmExposureExecutionError('EXPOSURE_RESPONSE_JSON', 'Shodan response is not valid JSON'); }
  return { body, bytes: bytes.length, digest: Digest.sha256Hex(bytes) };
}

async function executeExposurePlan(plan, options) {
  options = options || {};
  validatePlan(plan);
  if (options.networkAuthority !== NETWORK_AUTHORITY) {
    throw new AxmExposureExecutionError('EXPOSURE_NETWORK_NOT_AUTHORIZED', 'exposure search requires networkAuthority=EXPLICIT_ALLOW');
  }
  const request = plan.requests[0];
  const outboundUrl = materializeUrl(request, options.env || process.env);
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  if (typeof fetchImpl !== 'function') throw new AxmExposureExecutionError('EXPOSURE_FETCH_UNAVAILABLE', 'no fetch implementation is available');
  const timeoutMs = boundedInteger(options.timeoutMs, DEFAULT_TIMEOUT_MS, 100, 60000, 'timeoutMs');
  const maxResponseBytes = boundedInteger(options.maxResponseBytes, DEFAULT_MAX_RESPONSE_BYTES, 1024, 8 * 1024 * 1024, 'maxResponseBytes');
  const controller = new AbortController();
  const timer = setTimeout(function () { controller.abort(); }, timeoutMs);
  let response;
  try {
    response = await fetchImpl(outboundUrl, {
      method: 'GET',
      headers: request.headers || { Accept: 'application/json' },
      redirect: 'error',
      cache: 'no-store',
      credentials: 'omit',
      signal: controller.signal
    });
  } catch (error) {
    if (controller.signal.aborted) throw new AxmExposureExecutionError('EXPOSURE_TIMEOUT', 'Shodan request exceeded timeout', { timeoutMs });
    throw new AxmExposureExecutionError('EXPOSURE_TRANSPORT_ERROR', 'Shodan request failed', { cause: String(error && error.message || error) });
  } finally {
    clearTimeout(timer);
  }
  if (!response || !Number.isInteger(response.status)) throw new AxmExposureExecutionError('EXPOSURE_TRANSPORT_ERROR', 'Shodan returned no valid HTTP response');
  if (!response.ok) throw new AxmExposureExecutionError('EXPOSURE_HTTP_STATUS', 'Shodan returned HTTP ' + response.status, { httpStatus: response.status });
  const decoded = await readBoundedJson(response, maxResponseBytes);
  const resultSet = Exposure.parseExposureResponse(decoded.body, plan.query);
  const material = {
    schema: EXPOSURE_EXECUTION_SCHEMA,
    version: 1,
    status: 'PASS',
    planDigest: plan.planDigest,
    provider: 'shodan',
    mode: plan.query.mode,
    responseBytes: decoded.bytes,
    responseBodyDigest: decoded.digest,
    resultSet,
    authority: {
      networkExecutionUsed: true,
      apiKeyMaterializedInOutboundQueryOnly: true,
      activeScanUsed: false,
      targetConnectionUsed: false,
      credentialTestingUsed: false,
      exploitExecutionUsed: false,
      resultContentTrusted: false,
      installAllowed: false,
      promotionAllowed: false,
      canonAllowed: false
    }
  };
  return Object.assign({}, material, { executionDigest: Digest.canonicalDigest(material) });
}

module.exports = {
  EXPOSURE_EXECUTION_SCHEMA,
  NETWORK_AUTHORITY,
  DEFAULT_TIMEOUT_MS,
  DEFAULT_MAX_RESPONSE_BYTES,
  AxmExposureExecutionError,
  validatePlan,
  validateEndpoint,
  materializeUrl,
  readBoundedJson,
  executeExposurePlan
};
