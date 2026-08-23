#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Discovery = require('./code-recipe-discovery-v1');
const Bridge = require('./code-recipe-fabric-bridge-v1');

let checks = 0;

function check(value, message) {
  assert.ok(value, message);
  checks += 1;
  process.stdout.write('PASS ' + message + '\n');
}

function rejects(fn, pattern, message) {
  assert.throws(fn, pattern);
  checks += 1;
  process.stdout.write('PASS ' + message + '\n');
}

function clone(value) { return JSON.parse(JSON.stringify(value)); }
function hexDigest(value) { return Bridge.digestValue(value).slice('sha256:'.length); }
function criteria(overrides = {}) {
  return {
    terms: [],
    languages: [],
    domains: [],
    tags: [],
    familyKeys: [],
    maxResults: 8,
    ...overrides
  };
}

function requestCore(request, mutate) {
  const value = clone(request);
  delete value.requestDigest;
  mutate(value);
  return value;
}

function resealPacket(value, mutate) {
  const packet = clone(value);
  delete packet.packetDigest;
  mutate(packet);
  for (let attempt = 0; attempt < 8; attempt += 1) {
    packet.packetDigest = Discovery.digestValue(packet);
    const bytes = Discovery.jsonBytes(packet).length;
    if (bytes === packet.resourceObservation.packetBytes) return packet;
    delete packet.packetDigest;
    packet.resourceObservation.packetBytes = bytes;
  }
  throw new Error('test packet byte measurement did not converge');
}

function schemaObjectNodesAreClosed(value) {
  if (!value || typeof value !== 'object') return true;
  if (Array.isArray(value)) return value.every(schemaObjectNodesAreClosed);
  if (value.type === 'object' && value.additionalProperties !== false) return false;
  return Object.values(value).every(schemaObjectNodesAreClosed);
}

function schemaRefsResolve(file) {
  const cache = new Map();
  function read(name) {
    if (!cache.has(name)) cache.set(name, JSON.parse(fs.readFileSync(path.join(__dirname, name), 'utf8')));
    return cache.get(name);
  }
  function visit(value, current, seen) {
    if (!value || typeof value !== 'object') return true;
    if (Array.isArray(value)) return value.every((item) => visit(item, current, seen));
    if (typeof value.$ref === 'string') {
      const parts = value.$ref.split('#');
      const targetName = parts[0] || current;
      const fragment = parts[1] || '';
      const key = targetName + '#' + fragment;
      if (!seen.has(key)) {
        let cursor = read(targetName);
        if (fragment) {
          for (const part of fragment.replace(/^\//, '').split('/').filter(Boolean)) {
            cursor = cursor && cursor[part.replace(/~1/g, '/').replace(/~0/g, '~')];
          }
          if (cursor === undefined) return false;
        }
        const next = new Set(seen);
        next.add(key);
        if (!visit(cursor, targetName, next)) return false;
      }
    }
    return Object.values(value).every((item) => visit(item, current, seen));
  }
  return visit(read(file), file, new Set([file + '#']));
}

const schemaFiles = [
  ['code-recipe-discovery-request.schema.json', Discovery.REQUEST_SCHEMA],
  ['code-recipe-discovery-evidence-packet.schema.json', Discovery.PACKET_SCHEMA]
];
check(schemaFiles.every(([file, id]) => JSON.parse(fs.readFileSync(path.join(__dirname, file), 'utf8')).$id === id),
  'discovery schemas bind their exact public identities');
check(schemaFiles.every(([file]) => schemaObjectNodesAreClosed(JSON.parse(fs.readFileSync(path.join(__dirname, file), 'utf8')))),
  'discovery schema object nodes are closed');
check(schemaFiles.every(([file]) => schemaRefsResolve(file)), 'discovery local schema references resolve');

const contract = JSON.parse(fs.readFileSync(path.join(__dirname, 'module-code-recipe-discovery-v1.contract.json'), 'utf8'));
check(contract.status === 'TEST' && contract.permissions.length === 0 && contract.boundaries.writes.length === 0 &&
  Discovery.canonicalJson(contract.rootsGate) === Discovery.canonicalJson(Discovery.ROOTS),
  'discovery contract is permissionless, write-free TEST');
check(!contract.consumes.includes(Bridge.REQUEST_SCHEMA), 'discovery does not pretend to consume the later exact-selection request');
check(['arbitrary-recipe-pack', 'snippet-byte-emission', 'snippet-execution', 'provider-call', 'network-use',
  'workspace-read', 'workspace-write', 'locale-dependent-ordering', 'mechanical-score-as-quality-rank', 'direct-reuse-authorization',
  'automatic-recipe-selection', 'candidate-generation', 'installation', 'integration', 'promotion', 'canon-change']
  .every((item) => contract.boundaries.refuses.includes(item)),
  'discovery contract preserves source, authority, quality, and lifecycle holds');

const source = fs.readFileSync(path.join(__dirname, 'code-recipe-discovery-v1.js'), 'utf8');
check(!/child_process|execSync|spawnSync|\beval\s*\(|new\s+Function|\bfetch\s*\(|XMLHttpRequest|require\(['"](?:https?|net|tls|vm)['"]\)/.test(source),
  'discovery source exposes no execution, dynamic-code, or network entry point');
check(!/process\.env|process\.cwd|os\.homedir/.test(source), 'discovery source does not inherit host environment or workspace location');
check(!/localeCompare/.test(source) && /function compareText/.test(source), 'discovery ordering is binary and not host-locale dependent');

const installed = Bridge.loadInstalledCatalog();
const printRequest = Discovery.buildExampleInstalledDiscoveryRequest(criteria({ terms: 'Print, VALUE', maxResults: 5 }));
const printPacket = Discovery.discoverInstalled(printRequest);
const printAgain = Discovery.discoverInstalled(clone(printRequest));
check(Discovery.canonicalJson(printPacket) === Discovery.canonicalJson(printAgain), 'identical discovery input produces byte-identical evidence');
check(printRequest.terms.join(',') === 'print,value', 'free-form query text becomes sorted deduplicated ASCII metadata tokens');
check(printPacket.summary.recipesScanned === 1000 && printPacket.summary.eligibleMatches === 1 && printPacket.summary.heldMatches === 0,
  'discovery scans the exact installed 1,000-entry catalog and reports both result classes');
check(printPacket.eligibleResults.length === 1 && printPacket.eligibleResults[0].sourceId === 'CC-0001',
  'mechanical all-term matching finds the expected installed recipe');
check(printPacket.selection === null && printPacket.truth.automaticSelectionMade === false && printPacket.truth.qualityRankingPerformed === false,
  'ordered discovery evidence never becomes selection or a quality rank');
check(printPacket.reuseRights.state === 'RESEARCH_ONLY_HOLD' && printPacket.reuseRights.directReuseAllowed === false,
  'discovery evidence cannot turn unverified source metadata into direct-reuse permission');
check(printPacket.truth.semanticInferencePerformed === false && printPacket.eligibleResults[0].mechanicalMatch.semanticInference === false,
  'discovery makes no semantic-inference claim');
check(printPacket.truth.snippetBytesIncluded === false && printPacket.truth.snippetsExecuted === false &&
  !printPacket.eligibleResults.some((item) => Object.prototype.hasOwnProperty.call(item, 'snippet')),
  'result records omit snippet source and keep execution false');
const installedPrint = installed.recipeMap.get('CC-0001');
check(printPacket.eligibleResults[0].snippetRef.sha256 === 'sha256:' + require('crypto').createHash('sha256').update(installedPrint.snippet, 'utf8').digest('hex') &&
  printPacket.eligibleResults[0].snippetRef.byteLength === Buffer.byteLength(installedPrint.snippet, 'utf8') &&
  printPacket.eligibleResults[0].snippetRef.bytesIncluded === false,
  'omitted snippet bytes remain exactly digest and byte-length bound');
check(Discovery.canonicalJson(printPacket.catalogRef) === Discovery.canonicalJson(installed.catalogRef) &&
  Discovery.canonicalJson(printPacket.auditRef) === Discovery.canonicalJson(installed.auditRef) &&
  Discovery.canonicalJson(printPacket.foundryContractRef) === Discovery.canonicalJson(installed.foundryContractRef),
  'evidence binds the exact installed catalog, audit, and Foundry contract');
check(printPacket.requestRef.sha256 === printRequest.requestDigest && printPacket.lineageRefs.length === 3,
  'evidence binds its sealed request and three installed lineage records');
check(printPacket.resourceObservation.requestBytes === Discovery.jsonBytes(printRequest).length &&
  printPacket.resourceObservation.packetBytes === Discovery.jsonBytes(printPacket).length,
  'request and packet byte observations measure the exact emitted records');
check(printPacket.resourceObservation.processesSpawned === 0 && printPacket.resourceObservation.networkUsed === false,
  'discovery observes zero spawned processes and zero network use');
check(printPacket.truth.candidateGenerated === false && printPacket.truth.installed === false &&
  printPacket.truth.integrated === false && printPacket.truth.promoted === false && printPacket.truth.canonChanged === false,
  'discovery grants no candidate or lifecycle authority');
check(Discovery.canonicalJson(Discovery.normalizeDiscoveryPacket(printPacket)) === Discovery.canonicalJson(printPacket),
  'installed discovery packet survives strict deterministic installed-byte rebuild');
check(Discovery.canonicalJson(Discovery.packetRef(printPacket)) === Discovery.canonicalJson({
  id: printPacket.id, schema: Discovery.PACKET_SCHEMA, sha256: printPacket.packetDigest
}), 'packet reference binds the exact discovery evidence digest');

const heldPacket = Discovery.discoverInstalled(Discovery.buildExampleInstalledDiscoveryRequest(criteria({ terms: 'write formatted json' })));
check(heldPacket.eligibleResults.length === 0 && heldPacket.heldResults.length === 1 && heldPacket.heldResults[0].sourceId === 'CC-0031',
  'structurally held matches stay visible only in the separate held result class');
check(heldPacket.heldResults[0].eligibility === 'HELD_UNSELECTED_EVIDENCE_ONLY' &&
  heldPacket.heldResults[0].syntaxEvidence.status === 'REVIEW_HOLD',
  'held evidence cannot impersonate an eligible unselected result');

const unsupported = Discovery.discoverInstalled(Discovery.buildExampleInstalledDiscoveryRequest(criteria({ terms: 'create activate virtual environment' })));
check(unsupported.eligibleResults[0].sourceId === 'CC-0037' && unsupported.eligibleResults[0].syntaxEvidence.status === 'CONTEXT_UNSUPPORTED',
  'unsupported parse context remains visible rather than becoming a syntax pass');
const unavailable = Discovery.discoverInstalled(Discovery.buildExampleInstalledDiscoveryRequest(criteria({ terms: 'annotate variable' })));
check(unavailable.eligibleResults[0].sourceId === 'CC-0081' && unavailable.eligibleResults[0].syntaxEvidence.status === 'VERIFIER_UNAVAILABLE',
  'unavailable verifier remains visible rather than becoming a syntax pass');

const pythonByLanguage = Discovery.discoverInstalled(Discovery.buildExampleInstalledDiscoveryRequest(criteria({ languages: ['PYTHON'], maxResults: 5 })));
check(pythonByLanguage.eligibleResults.length === 5 && pythonByLanguage.eligibleResults.every((item) => item.primaryLanguage === 'Python'),
  'exact normalized language filter limits returned metadata');
check(pythonByLanguage.eligibleResults.map((item) => item.sourceId).join(',') ===
  pythonByLanguage.eligibleResults.map((item) => item.sourceId).slice().sort().join(','),
  'equal-score results use stable binary source-identity order');
const jsonTag = Discovery.discoverInstalled(Discovery.buildExampleInstalledDiscoveryRequest(criteria({ tags: ['JSON'], maxResults: 6 })));
check(jsonTag.eligibleResults.concat(jsonTag.heldResults).every((item) => item.tags.map((tag) => tag.toLowerCase()).includes('json')),
  'exact tag filter applies to eligible and held result classes');
const family = Discovery.discoverInstalled(Discovery.buildExampleInstalledDiscoveryRequest(criteria({ familyKeys: ['Python Print A Value'] })));
check(family.eligibleResults.length === 1 && family.eligibleResults[0].familyKey === 'python_print_a_value',
  'family filter normalizes separators and binds one exact family key');
const domain = Discovery.discoverInstalled(Discovery.buildExampleInstalledDiscoveryRequest(criteria({ domains: ['python'], maxResults: 3 })));
check(domain.eligibleResults.concat(domain.heldResults).every((item) => item.domain === 'Python'), 'domain filter is exact after normalization');
const none = Discovery.discoverInstalled(Discovery.buildExampleInstalledDiscoveryRequest(criteria({ terms: 'term-that-does-not-exist' })));
check(none.summary.eligibleMatches === 0 && none.summary.heldMatches === 0 && none.eligibleResults.length === 0 && none.heldResults.length === 0,
  'unsupported metadata query returns an honest empty result, not a guessed recipe');
const capped = Discovery.discoverInstalled(Discovery.buildExampleInstalledDiscoveryRequest(criteria({ languages: ['python'], maxResults: 1 })));
check(capped.eligibleResults.length === 1 && capped.heldResults.length <= 1 && capped.summary.eligibleTruncated === true,
  'per-class result ceiling is enforced and truncation remains explicit');
const maxReturned = Discovery.discoverInstalled(Discovery.buildExampleInstalledDiscoveryRequest(criteria({ languages: ['python'], maxResults: 32 })));
check(maxReturned.eligibleResults.length === 32 && maxReturned.resourceObservation.packetBytes === Discovery.jsonBytes(maxReturned).length &&
  maxReturned.resourceObservation.packetBytes <= maxReturned.discoveryRequest.resourceEnvelope.maxPacketBytes,
  'maximum returned-result packet remains exact and within its declared byte budget');

const normalizedA = Discovery.buildExampleInstalledDiscoveryRequest(criteria({ terms: ['value', 'PRINT', 'value'], languages: ['Pythón'] }));
const normalizedB = Discovery.buildExampleInstalledDiscoveryRequest(criteria({ terms: 'print value', languages: ['python'] }));
check(Discovery.canonicalJson(normalizedA) === Discovery.canonicalJson(normalizedB),
  'case, punctuation, accents, duplicates, and input grouping cannot alter normalized request bytes');
const pathLike = Discovery.buildExampleInstalledDiscoveryRequest(criteria({ terms: 'C:\\Temp\\Widget:stream \\\\server\\share' }));
check(pathLike.terms.join(',') === 'c,server,share,stream,temp,widget' && pathLike.authority === 'NONE',
  'Windows drive, stream, and UNC-looking query text stays inert metadata tokens with no path authority');

rejects(() => Discovery.normalizeCriteria(criteria()), /at least one bounded discovery criterion/i,
  'empty discovery criteria fail closed');
rejects(() => Discovery.normalizeCriteria(criteria({ terms: Array.from({ length: 33 }, (_, index) => 't' + index) })), /bounded input count/i,
  'query input count above the fixed ceiling is rejected');
rejects(() => Discovery.normalizeCriteria(criteria({ terms: Array.from({ length: 33 }, (_, index) => 'word' + index).join(' ') })), /normalized query terms exceed/i,
  'normalized token count above the fixed ceiling is rejected');
rejects(() => Discovery.normalizeCriteria(criteria({ terms: 'x'.repeat(1025) })), /query term input/i,
  'oversized query text is rejected before matching');
rejects(() => Discovery.normalizeCriteria(criteria({ terms: 'x'.repeat(81) })), /deterministic boundary/i,
  'oversized normalized token is rejected');
rejects(() => Discovery.normalizeCriteria(criteria({ terms: [], tags: ['!!!'] })), /invalid filter/i,
  'filter text that normalizes to nothing is rejected');
rejects(() => Discovery.normalizeCriteria(criteria({ terms: 'print', maxResults: 0 })), /integer from 1 to 32/i,
  'zero result budget is rejected');
rejects(() => Discovery.normalizeCriteria(criteria({ terms: 'print', maxResults: 33 })), /integer from 1 to 32/i,
  'result budget above the fixed ceiling is rejected');
rejects(() => Discovery.normalizeCriteria({ ...criteria({ terms: 'print' }), surprise: true }), /fields must be exactly/i,
  'unknown criteria fields are rejected');

for (const verdict of ['HOLD', 'FAIL']) {
  rejects(() => Discovery.sealRequest(requestCore(printRequest, (value) => { value.rootsGate[0].verdict = verdict; })), /ROOTS_GATE_HOLD/i,
    'four-root ' + verdict + ' stops recipe discovery');
}
rejects(() => Discovery.sealRequest(requestCore(printRequest, (value) => { value.rootsGate.reverse(); })), /exact AXM root order/i,
  'four-root order drift is rejected');
rejects(() => Discovery.sealRequest(requestCore(printRequest, (value) => { value.rootsGate[0].evidenceRefs = []; })), /root PASS requires bounded evidence/i,
  'root PASS without evidence is rejected');
rejects(() => Discovery.sealRequest(requestCore(printRequest, (value) => { value.authority = 'INSTALL'; })), /authority mismatch/i,
  'discovery request cannot grant itself install authority');
rejects(() => Discovery.sealRequest(requestCore(printRequest, (value) => { value.resourceEnvelope.maxProcesses = 1; })), /zero-process zero-cost/i,
  'discovery request cannot inherit a process');
rejects(() => Discovery.sealRequest(requestCore(printRequest, (value) => { value.resourceEnvelope.maxCostMinorUnits = 1; })), /zero-process zero-cost/i,
  'discovery request cannot add a spend budget');
rejects(() => Discovery.sealRequest(requestCore(printRequest, (value) => { value.resourceEnvelope.maxRecipesScanned = 999; })), /installed 1,000 recipes/i,
  'partial or expanded catalog scan declarations are rejected');
rejects(() => Discovery.sealRequest(requestCore(printRequest, (value) => { value.resourceEnvelope.maxReturnedPerClass = 1; value.maxResults = 2; })), /result count exceeds/i,
  'requested result count cannot exceed the declared per-class budget');
rejects(() => Discovery.sealRequest(requestCore(printRequest, (value) => { value.id = 'x'.repeat(120); })), /bounded non-empty text/i,
  'request identity leaves room for the bounded evidence-packet suffix');

const requestDigestDrift = clone(printRequest);
requestDigestDrift.requestDigest = 'sha256:' + 'f'.repeat(64);
rejects(() => Discovery.discoverInstalled(requestDigestDrift), /digest or canonical form mismatch/i,
  'request digest drift is rejected');
const requestUnknown = clone(printRequest);
requestUnknown.preapproved = true;
rejects(() => Discovery.discoverInstalled(requestUnknown), /fields must be exactly/i,
  'unknown request fields cannot smuggle approval state');
const forgedRef = requestCore(printRequest, (value) => { value.catalogRef.sha256 = 'sha256:' + 'f'.repeat(64); });
rejects(() => Discovery.discoverInstalled(Discovery.sealRequest(forgedRef)), /catalog.*digest drifted/i,
  'forged catalog reference fails against installed lineage');

const forgedPack = clone(installed.pack);
forgedPack.recipes[0].snippet += '\n';
forgedPack.truth.recipeSetSha256 = hexDigest(forgedPack.recipes);
const forgedAudit = clone(installed.audit);
forgedAudit.source.recipeSetSha256 = forgedPack.truth.recipeSetSha256;
forgedAudit.source.packSha256 = hexDigest(forgedPack);
const forgedVerified = Bridge.verifyCatalog(forgedPack, forgedAudit);
const forgedRequest = Discovery.sealRequest(requestCore(printRequest, (value) => {
  value.catalogRef = forgedVerified.catalogRef;
  value.auditRef = forgedVerified.auditRef;
  value.foundryContractRef = forgedVerified.foundryContractRef;
}));
rejects(() => Discovery.buildDiscoveryEvidence(forgedPack, forgedAudit, forgedRequest), /exact installed Foundry bytes only/i,
  'internally consistent re-digested catalog drift cannot become the installed catalog');

rejects(() => Discovery.normalizeDiscoveryPacket(resealPacket(printPacket, (value) => { value.selection = { sourceId: 'CC-0001' }; })), /deterministic installed-catalog rebuild/i,
  're-digested packet cannot create an automatic selection');
rejects(() => Discovery.normalizeDiscoveryPacket(resealPacket(printPacket, (value) => { value.eligibleResults[0].snippet = installedPrint.snippet; })), /deterministic installed-catalog rebuild/i,
  're-digested packet cannot add private snippet bytes');
rejects(() => Discovery.normalizeDiscoveryPacket(resealPacket(printPacket, (value) => { value.truth.correctnessProven = true; })), /deterministic installed-catalog rebuild/i,
  're-digested packet cannot inflate correctness evidence');
rejects(() => Discovery.normalizeDiscoveryPacket(resealPacket(printPacket, (value) => { value.truth.installed = true; })), /deterministic installed-catalog rebuild/i,
  're-digested packet cannot claim installation');
rejects(() => Discovery.normalizeDiscoveryPacket(resealPacket(printPacket, (value) => { value.reuseRights.directReuseAllowed = true; })), /deterministic installed-catalog rebuild/i,
  're-digested packet cannot self-authorize direct reuse');
rejects(() => Discovery.normalizeDiscoveryPacket(resealPacket(printPacket, (value) => { value.eligibleResults[0].eligibility = 'HELD_UNSELECTED_EVIDENCE_ONLY'; })), /deterministic installed-catalog rebuild/i,
  're-digested packet cannot swap eligible and held meaning');
rejects(() => Discovery.normalizeDiscoveryPacket(resealPacket(printPacket, (value) => { value.eligibleResults[0].snippetRef.sha256 = 'sha256:' + '0'.repeat(64); })), /deterministic installed-catalog rebuild/i,
  're-digested packet cannot drift byte-bound snippet lineage');
rejects(() => Discovery.normalizeDiscoveryPacket(resealPacket(printPacket, (value) => { value.catalogRef.sha256 = 'sha256:' + '0'.repeat(64); })), /deterministic installed-catalog rebuild/i,
  're-digested packet cannot forge installed catalog lineage');
const packetByteDrift = clone(printPacket);
packetByteDrift.resourceObservation.packetBytes += 1;
rejects(() => Discovery.normalizeDiscoveryPacket(packetByteDrift), /deterministic installed-catalog rebuild/i,
  'packet byte-observation drift is rejected');
const packetUnknown = clone(printPacket);
packetUnknown.approved = true;
rejects(() => Discovery.normalizeDiscoveryPacket(packetUnknown), /deterministic installed-catalog rebuild/i,
  'unknown packet fields cannot smuggle approval state');

const exactSelection = Bridge.buildExampleInstalledRequest([printPacket.eligibleResults[0].sourceId], 'REFERENCE_ONLY');
check(exactSelection.schema === Bridge.REQUEST_SCHEMA && exactSelection.requestDigest !== printRequest.requestDigest &&
  exactSelection.selectedSourceIds.join(',') === 'CC-0001',
  'using discovered evidence requires a new separate exact selection request');

process.stdout.write('Code recipe discovery v1.1 selftest passed: ' + checks + ' checks.\n');
