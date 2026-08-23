'use strict';

const crypto = require('crypto');
const DeterministicJson = require('../../tools/deterministic-json-core');
const Bridge = require('./code-recipe-fabric-bridge-v1');

const VERSION = '1.1.0';
const REQUEST_SCHEMA = 'axm.code-recipe-discovery-request/v1';
const PACKET_SCHEMA = 'axm.code-recipe-discovery-evidence-packet/v1';
const ROOTS = Bridge.ROOTS.slice();
const MAX_TERMS = 32;
const MAX_RESULTS = 32;
const MAX_REQUEST_BYTES = 65536;
const MAX_PACKET_BYTES = 262144;
const ID = /^[a-z0-9][a-z0-9._-]{1,127}$/;
const TOKEN = /^[a-z0-9]+$/;
const FILTER = /^[a-z0-9]+(?: [a-z0-9]+)*$/;
const DIGEST = /^sha256:[0-9a-f]{64}$/;
const LIMITATIONS = Object.freeze([
  'AUTOMATIC_SELECTION_NOT_PERFORMED',
  'CORRECTNESS_NOT_PROVEN',
  'LICENSES_UNVERIFIED',
  'MECHANICAL_ORDER_IS_NOT_QUALITY_RANK',
  'RUNTIME_BEHAVIOR_NOT_PROVEN',
  'SAFETY_NOT_PROVEN',
  'SEMANTIC_INFERENCE_NOT_PERFORMED',
  'SNIPPET_BYTES_NOT_INCLUDED',
  'SOURCE_CLAIMS_UNVERIFIED',
  'SYNTAX_PASS_IS_PARSE_ONLY'
]);
const FIELD_WEIGHTS = Object.freeze({
  title: 8,
  family: 7,
  tags: 6,
  description: 4,
  domain: 3,
  language: 2,
  platform: 2,
  source: 1
});

function clone(value) { return JSON.parse(JSON.stringify(value)); }
function canonicalJson(value) { return DeterministicJson.canonicalJson(value); }
function digestValue(value) { return 'sha256:' + crypto.createHash('sha256').update(canonicalJson(value), 'utf8').digest('hex'); }
function digestBytes(value) { return 'sha256:' + crypto.createHash('sha256').update(value).digest('hex'); }
function jsonBytes(value) { return Buffer.from(JSON.stringify(value, null, 2) + '\n', 'utf8'); }
function compareText(left, right) { return left < right ? -1 : left > right ? 1 : 0; }
function fail(message) { throw new Error(message); }
function plain(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null)) fail(label + ' must be a plain object');
  return value;
}
function exact(value, keys, label) {
  plain(value, label);
  if (canonicalJson(Object.keys(value).sort()) !== canonicalJson(keys.slice().sort())) fail(label + ' fields must be exactly ' + keys.slice().sort().join(', '));
  return value;
}
function text(value, label, max) {
  if (typeof value !== 'string' || !value.length || Buffer.byteLength(value, 'utf8') > max) fail(label + ' must be bounded non-empty text');
  return value;
}
function integer(value, label, min, max) {
  if (!Number.isSafeInteger(value) || value < min || value > max) fail(label + ' must be an integer from ' + min + ' to ' + max);
  return value;
}
function normalizeRef(value, label) {
  exact(value, ['id', 'schema', 'sha256'], label);
  if (!ID.test(value.id) || typeof value.schema !== 'string' || !value.schema.length || value.schema.length > 220 || !DIGEST.test(value.sha256)) fail(label + ' is invalid');
  return clone(value);
}
function ref(id, schema, value) { return { id, schema, sha256: digestValue(value) }; }

function normalizedTokens(value) {
  if (typeof value !== 'string') fail('query terms must be text or an array of text');
  const ascii = value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  return ascii.match(/[a-z0-9]+/g) || [];
}

function normalizeTerms(value) {
  const raw = Array.isArray(value) ? value : [value];
  if (raw.length > MAX_TERMS) fail('query terms exceed the bounded input count');
  const terms = [];
  raw.forEach((item, index) => {
    if (typeof item !== 'string' || Buffer.byteLength(item, 'utf8') > 1024) fail('query term input[' + index + '] is invalid');
    normalizedTokens(item).forEach((token) => terms.push(token));
  });
  const out = Array.from(new Set(terms)).sort(compareText);
  if (out.length > MAX_TERMS || out.some((item) => !TOKEN.test(item) || item.length > 80)) fail('normalized query terms exceed their deterministic boundary');
  return out;
}

function normalizeFilters(value, label, maxItems) {
  if (value == null) return [];
  if (!Array.isArray(value) || value.length > maxItems) fail(label + ' must be a bounded array');
  const out = value.map((item, index) => {
    if (typeof item !== 'string' || Buffer.byteLength(item, 'utf8') > 160) fail(label + '[' + index + '] must be bounded text');
    const normalized = normalizedTokens(item).join(' ');
    if (!normalized || !FILTER.test(normalized)) fail(label + '[' + index + '] normalizes to an invalid filter');
    return normalized;
  });
  return Array.from(new Set(out)).sort(compareText);
}

function normalizeCriteria(value) {
  exact(value, ['terms', 'languages', 'domains', 'tags', 'familyKeys', 'maxResults'], 'discovery criteria');
  const criteria = {
    terms: normalizeTerms(value.terms == null ? [] : value.terms),
    languages: normalizeFilters(value.languages, 'languages', 16),
    domains: normalizeFilters(value.domains, 'domains', 16),
    tags: normalizeFilters(value.tags, 'tags', 32),
    familyKeys: normalizeFilters(value.familyKeys, 'familyKeys', 16),
    maxResults: integer(value.maxResults, 'maxResults', 1, MAX_RESULTS)
  };
  if (!criteria.terms.length && !criteria.languages.length && !criteria.domains.length && !criteria.tags.length && !criteria.familyKeys.length) fail('at least one bounded discovery criterion is required');
  return criteria;
}

function normalizeResources(value) {
  exact(value, ['maxRequestBytes', 'maxPacketBytes', 'maxRecipesScanned', 'maxReturnedPerClass', 'maxAttempts', 'maxProcesses', 'maxCostMinorUnits'], 'resourceEnvelope');
  const out = {
    maxRequestBytes: integer(value.maxRequestBytes, 'resourceEnvelope.maxRequestBytes', 1, MAX_REQUEST_BYTES),
    maxPacketBytes: integer(value.maxPacketBytes, 'resourceEnvelope.maxPacketBytes', 1, MAX_PACKET_BYTES),
    maxRecipesScanned: value.maxRecipesScanned,
    maxReturnedPerClass: integer(value.maxReturnedPerClass, 'resourceEnvelope.maxReturnedPerClass', 1, MAX_RESULTS),
    maxAttempts: value.maxAttempts,
    maxProcesses: value.maxProcesses,
    maxCostMinorUnits: value.maxCostMinorUnits
  };
  if (out.maxRecipesScanned !== 1000 || out.maxAttempts !== 1 || out.maxProcesses !== 0 || out.maxCostMinorUnits !== 0) fail('discovery supports one exact zero-process zero-cost scan of the installed 1,000 recipes only');
  return out;
}

function normalizeRoots(value) {
  if (!Array.isArray(value) || value.length !== ROOTS.length) fail('rootsGate must contain four decisions');
  return value.map((entry, index) => {
    exact(entry, ['root', 'verdict', 'evidenceRefs'], 'rootsGate[' + index + ']');
    if (entry.root !== ROOTS[index]) fail('rootsGate must use the exact AXM root order');
    if (entry.verdict !== 'PASS') fail('ROOTS_GATE_HOLD:' + entry.root + '=' + entry.verdict);
    if (!Array.isArray(entry.evidenceRefs) || entry.evidenceRefs.length < 1 || entry.evidenceRefs.length > 8) fail('root PASS requires bounded evidence references');
    return { root: entry.root, verdict: 'PASS', evidenceRefs: entry.evidenceRefs.map((item, refIndex) => normalizeRef(item, 'rootsGate[' + index + '].evidenceRefs[' + refIndex + ']')) };
  });
}

function requestCore(value) {
  exact(value, ['schema', 'id', 'purposeRef', 'terms', 'languages', 'domains', 'tags', 'familyKeys', 'maxResults', 'catalogRef', 'auditRef', 'foundryContractRef', 'resourceEnvelope', 'rootsGate', 'authority'], 'discovery request');
  if (value.schema !== REQUEST_SCHEMA || value.authority !== 'NONE') fail('discovery request identity or authority mismatch');
  const criteria = normalizeCriteria({
    terms: value.terms,
    languages: value.languages,
    domains: value.domains,
    tags: value.tags,
    familyKeys: value.familyKeys,
    maxResults: value.maxResults
  });
  const resources = normalizeResources(value.resourceEnvelope);
  if (criteria.maxResults > resources.maxReturnedPerClass) fail('discovery result count exceeds the request resource ceiling');
  const core = {
    schema: REQUEST_SCHEMA,
    id: text(value.id, 'request.id', 119),
    purposeRef: normalizeRef(value.purposeRef, 'request.purposeRef'),
    ...criteria,
    catalogRef: normalizeRef(value.catalogRef, 'request.catalogRef'),
    auditRef: normalizeRef(value.auditRef, 'request.auditRef'),
    foundryContractRef: normalizeRef(value.foundryContractRef, 'request.foundryContractRef'),
    resourceEnvelope: resources,
    rootsGate: normalizeRoots(value.rootsGate),
    authority: 'NONE'
  };
  if (!ID.test(core.id)) fail('request.id is invalid');
  if (jsonBytes(core).length > resources.maxRequestBytes) fail('discovery request exceeds its exact byte ceiling');
  return core;
}

function sealRequest(value) {
  const core = requestCore(value);
  const sealed = { ...core, requestDigest: digestValue(core) };
  if (jsonBytes(sealed).length > sealed.resourceEnvelope.maxRequestBytes) fail('sealed discovery request exceeds its exact byte ceiling');
  return sealed;
}

function normalizeRequest(value) {
  exact(value, ['schema', 'id', 'purposeRef', 'terms', 'languages', 'domains', 'tags', 'familyKeys', 'maxResults', 'catalogRef', 'auditRef', 'foundryContractRef', 'resourceEnvelope', 'rootsGate', 'authority', 'requestDigest'], 'discovery request');
  const copy = clone(value);
  delete copy.requestDigest;
  const sealed = sealRequest(copy);
  if (value.requestDigest !== sealed.requestDigest || canonicalJson(value) !== canonicalJson(sealed)) fail('discovery request digest or canonical form mismatch');
  return sealed;
}

function buildInstalledDiscoveryRequest(value) {
  exact(value, ['schema', 'id', 'purposeRef', 'terms', 'languages', 'domains', 'tags', 'familyKeys', 'maxResults', 'resourceEnvelope', 'rootsGate', 'authority'], 'installed discovery request input');
  const installed = Bridge.loadInstalledCatalog();
  return sealRequest({
    ...value,
    ...normalizeCriteria({
      terms: value.terms,
      languages: value.languages,
      domains: value.domains,
      tags: value.tags,
      familyKeys: value.familyKeys,
      maxResults: value.maxResults
    }),
    catalogRef: installed.catalogRef,
    auditRef: installed.auditRef,
    foundryContractRef: installed.foundryContractRef
  });
}

function buildExampleInstalledDiscoveryRequest(criteria) {
  const rootsGate = ROOTS.map((root) => ({ root, verdict: 'PASS', evidenceRefs: [ref('recipe-discovery-' + root, 'axm.four-root-technical-review/v1', root)] }));
  return buildInstalledDiscoveryRequest({
    schema: REQUEST_SCHEMA,
    id: 'discover-installed-code-recipes',
    purposeRef: ref('recipe-discovery-example-purpose', 'axm.declared-purpose/v1', 'bounded recipe metadata discovery example'),
    ...normalizeCriteria(criteria),
    resourceEnvelope: { maxRequestBytes: MAX_REQUEST_BYTES, maxPacketBytes: MAX_PACKET_BYTES, maxRecipesScanned: 1000, maxReturnedPerClass: MAX_RESULTS, maxAttempts: 1, maxProcesses: 0, maxCostMinorUnits: 0 },
    rootsGate,
    authority: 'NONE'
  });
}

function fieldTokens(recipe) {
  function set(value) { return new Set(normalizedTokens(value == null ? '' : String(value))); }
  return {
    title: set(recipe.title),
    family: set(recipe.familyKey),
    tags: set(recipe.tags.join(' ')),
    description: set(recipe.description),
    domain: set(recipe.domain),
    language: set(recipe.primaryLanguage),
    platform: set(recipe.platform),
    source: set(recipe.sourceId)
  };
}

function matchesFilters(recipe, request) {
  const language = normalizedTokens(recipe.primaryLanguage).join(' ');
  const domain = normalizedTokens(recipe.domain == null ? '' : recipe.domain).join(' ');
  const family = normalizedTokens(recipe.familyKey).join(' ');
  const tags = new Set(recipe.tags.map((item) => normalizedTokens(item).join(' ')));
  if (request.languages.length && !request.languages.includes(language)) return false;
  if (request.domains.length && !request.domains.includes(domain)) return false;
  if (request.familyKeys.length && !request.familyKeys.includes(family)) return false;
  if (request.tags.length && !request.tags.every((item) => tags.has(item))) return false;
  return true;
}

function mechanicalMatch(recipe, request) {
  if (!matchesFilters(recipe, request)) return null;
  const fields = fieldTokens(recipe);
  const all = new Set();
  Object.values(fields).forEach((values) => values.forEach((item) => all.add(item)));
  if (!request.terms.every((term) => all.has(term))) return null;
  let score = 0;
  const matchedFields = [];
  request.terms.forEach((term) => {
    Object.entries(fields).forEach(([field, values]) => {
      if (values.has(term)) {
        score += FIELD_WEIGHTS[field];
        matchedFields.push(field + ':' + term);
      }
    });
  });
  return {
    score,
    matchedFields: Array.from(new Set(matchedFields)).sort(compareText),
    qualityRank: false,
    semanticInference: false,
    popularityUsed: false
  };
}

function resultFor(recipe, audit, match, held) {
  const snippet = Buffer.from(recipe.snippet, 'utf8');
  return {
    sourceId: recipe.sourceId,
    recipeId: recipe.id,
    title: recipe.title,
    description: recipe.description,
    primaryLanguage: recipe.primaryLanguage,
    domain: recipe.domain,
    tags: clone(recipe.tags),
    familyKey: recipe.familyKey,
    versionBasis: recipe.versionBasis,
    sourceUrl: recipe.sourceUrl,
    reviewState: recipe.reviewState,
    holdReasons: clone(recipe.holdReasons),
    eligibility: held ? 'HELD_UNSELECTED_EVIDENCE_ONLY' : 'UNSELECTED_EVIDENCE_ONLY',
    snippetRef: { sha256: digestBytes(snippet), byteLength: snippet.length, bytesIncluded: false },
    syntaxEvidence: {
      status: audit.status,
      verifier: audit.verifier,
      message: audit.message,
      parseOnly: true,
      runtimeProof: false,
      correctnessProof: false,
      safetyProof: false
    },
    mechanicalMatch: match
  };
}

function buildDiscoveryEvidence(packValue, auditValue, requestValue) {
  const request = normalizeRequest(requestValue);
  const verified = Bridge.verifyCatalog(packValue, auditValue);
  const installed = Bridge.loadInstalledCatalog();
  if (canonicalJson(verified.catalogRef) !== canonicalJson(installed.catalogRef) ||
      canonicalJson(verified.auditRef) !== canonicalJson(installed.auditRef) ||
      canonicalJson(verified.foundryContractRef) !== canonicalJson(installed.foundryContractRef)) {
    fail('discovery accepts the exact installed Foundry bytes only');
  }
  if (canonicalJson(request.catalogRef) !== canonicalJson(verified.catalogRef) || canonicalJson(request.auditRef) !== canonicalJson(verified.auditRef) || canonicalJson(request.foundryContractRef) !== canonicalJson(verified.foundryContractRef)) fail('discovery source contract, catalog, or audit digest drifted');
  const eligible = [];
  const held = [];
  verified.recipes.forEach((recipe) => {
    const match = mechanicalMatch(recipe, request);
    if (!match) return;
    const audit = verified.auditMap.get(recipe.sourceId);
    const isHeld = recipe.reviewState === 'STRUCTURE_HOLD' || recipe.holdReasons.length > 0;
    (isHeld ? held : eligible).push(resultFor(recipe, audit, match, isHeld));
  });
  const order = (left, right) => right.mechanicalMatch.score - left.mechanicalMatch.score || compareText(left.sourceId, right.sourceId);
  eligible.sort(order);
  held.sort(order);
  const eligibleResults = eligible.slice(0, request.maxResults);
  const heldResults = held.slice(0, request.maxResults);
  const requestRef = { id: request.id, schema: REQUEST_SCHEMA, sha256: request.requestDigest };
  const base = {
    schema: PACKET_SCHEMA,
    version: VERSION,
    id: request.id + '-evidence',
    status: 'TEST',
    discoveryRequest: request,
    requestRef,
    catalogRef: verified.catalogRef,
    auditRef: verified.auditRef,
    foundryContractRef: verified.foundryContractRef,
    summary: {
      recipesScanned: verified.recipes.length,
      eligibleMatches: eligible.length,
      heldMatches: held.length,
      returnedEligible: eligibleResults.length,
      returnedHeld: heldResults.length,
      eligibleTruncated: eligible.length > eligibleResults.length,
      heldTruncated: held.length > heldResults.length
    },
    eligibleResults,
    heldResults,
    selection: null,
    reuseRights: {
      state: 'RESEARCH_ONLY_HOLD',
      directReuseAllowed: false,
      reason: 'SOURCE_AND_LICENSE_CLAIMS_UNVERIFIED'
    },
    resourceObservation: {
      requestBytes: jsonBytes(request).length,
      packetBytes: 1,
      recipesScanned: verified.recipes.length,
      eligibleReturned: eligibleResults.length,
      heldReturned: heldResults.length,
      requestByteCeilingEnforced: true,
      packetByteCeilingEnforced: true,
      scanCeilingEnforced: true,
      resultCeilingEnforced: true,
      attemptCountEnforced: true,
      processesSpawned: 0,
      networkUsed: false
    },
    lineageRefs: [verified.catalogRef, verified.auditRef, verified.foundryContractRef],
    limitations: LIMITATIONS.slice().sort(compareText),
    truth: {
      installedCatalogVerified: true,
      installedAuditVerified: true,
      recipeSetDigestVerified: true,
      foundryContractVerified: true,
      metadataOnly: true,
      snippetBytesIncluded: false,
      snippetsExecuted: false,
      mechanicalOrderingUsed: true,
      qualityRankingPerformed: false,
      semanticInferencePerformed: false,
      automaticSelectionMade: false,
      sourceClaimsVerified: false,
      licensesVerified: false,
      runtimeBehaviorProven: false,
      correctnessProven: false,
      safetyProven: false,
      candidateGenerated: false,
      installed: false,
      integrated: false,
      promoted: false,
      canonChanged: false
    },
    authority: 'NONE'
  };
  let packet = null;
  for (let attempt = 0; attempt < 8; attempt += 1) {
    packet = { ...base, packetDigest: digestValue(base) };
    const bytes = jsonBytes(packet).length;
    if (bytes === base.resourceObservation.packetBytes) break;
    base.resourceObservation.packetBytes = bytes;
  }
  if (!packet || jsonBytes(packet).length !== base.resourceObservation.packetBytes) fail('discovery packet byte measurement did not converge');
  if (packet.resourceObservation.requestBytes > request.resourceEnvelope.maxRequestBytes || packet.resourceObservation.packetBytes > request.resourceEnvelope.maxPacketBytes) fail('discovery evidence exceeds its request byte ceiling');
  return packet;
}

function discoverInstalled(requestValue) {
  const installed = Bridge.loadInstalledCatalog();
  return buildDiscoveryEvidence(installed.pack, installed.audit, requestValue);
}

function normalizeDiscoveryPacket(value) {
  plain(value, 'discovery packet');
  if (value.schema !== PACKET_SCHEMA || value.version !== VERSION || value.status !== 'TEST' || value.authority !== 'NONE') fail('discovery packet identity or authority mismatch');
  const expected = discoverInstalled(value.discoveryRequest);
  if (canonicalJson(value) !== canonicalJson(expected)) fail('discovery packet differs from deterministic installed-catalog rebuild');
  return expected;
}

function packetRef(packetValue) {
  const packet = normalizeDiscoveryPacket(packetValue);
  return { id: packet.id, schema: PACKET_SCHEMA, sha256: packet.packetDigest };
}

module.exports = {
  VERSION,
  REQUEST_SCHEMA,
  PACKET_SCHEMA,
  ROOTS,
  MAX_TERMS,
  MAX_RESULTS,
  MAX_REQUEST_BYTES,
  MAX_PACKET_BYTES,
  LIMITATIONS,
  FIELD_WEIGHTS,
  canonicalJson,
  digestValue,
  jsonBytes,
  normalizedTokens,
  normalizeCriteria,
  sealRequest,
  normalizeRequest,
  buildInstalledDiscoveryRequest,
  buildExampleInstalledDiscoveryRequest,
  buildDiscoveryEvidence,
  discoverInstalled,
  normalizeDiscoveryPacket,
  packetRef,
  clone
};
