'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const DeterministicJson = require('../../tools/deterministic-json-core');

const VERSION = '1.0.0';
const REQUEST_SCHEMA = 'axm.code-recipe-selection-request/v1';
const PACKET_SCHEMA = 'axm.code-recipe-selection-packet/v1';
const FOUNDRY_PACK_SCHEMA = 'axm.code-recipe-pack/v1';
const AUDIT_SCHEMA = 'axm.code-recipe-syntax-audit/v1';
const CONTRACT_SCHEMA = 'axm.module-contract/v1';
const MODES = Object.freeze(['REFERENCE_ONLY', 'DETACHED_RESEARCH_CONTEXT']);
const ROOTS = Object.freeze(['truth', 'agency-non-domination', 'continuity', 'wisdom-over-speed']);
const MAX_SELECTED_RECIPES = 16;
const MAX_SELECTED_SNIPPET_BYTES = 65536;
const MAX_PACKET_BYTES = 131072;
const ID = /^[a-z0-9][a-z0-9._-]{1,127}$/;
const SOURCE_ID = /^CC-[0-9]{4}$/;
const RECIPE_ID = /^recipe-[a-f0-9]{16}$/;
const DIGEST = /^sha256:[0-9a-f]{64}$/;
const HEX = /^[0-9a-f]{64}$/;
const LIMITATIONS = Object.freeze([
  'ACTUAL_RECIPE_COMPOSITION_NOT_IMPLEMENTED',
  'CANDIDATE_EXECUTION_NOT_AUTHORIZED',
  'DIRECT_REUSE_NOT_AUTHORIZED',
  'LICENSES_UNVERIFIED',
  'RUNTIME_BEHAVIOR_UNPROVEN',
  'SECURITY_AND_SUITABILITY_UNPROVEN',
  'SOURCE_CLAIMS_UNVERIFIED',
  'SYNTAX_PASS_IS_PARSE_ONLY'
]);
const RECIPE_KEYS = Object.freeze([
  'id', 'rank', 'title', 'snippet', 'description', 'primaryLanguage', 'domain', 'tags',
  'sourceUrl', 'popularityIndicator', 'popularityScope', 'rankingBasis', 'familyKey',
  'familyKeySource', 'reviewState', 'holdReasons', 'sourceId', 'categoryRank',
  'notesSafety', 'difficulty', 'platform', 'versionBasis', 'researchDate', 'verification'
]);
const AUDIT_RESULT_KEYS = Object.freeze([
  'sourceId', 'recipeId', 'category', 'title', 'reviewState', 'status', 'verifier', 'message'
]);
const INSTALLED_PACK = path.join(__dirname, '..', '..', 'tools', 'code-recipe-foundry', 'catalog', 'code-cheats-1000.code-recipes.json');
const INSTALLED_AUDIT = path.join(__dirname, '..', '..', 'tools', 'code-recipe-foundry', 'catalog', 'code-cheats-1000.syntax-audit.json');
const FOUNDRY_CONTRACT = require('../../tools/code-recipe-foundry/module.contract.json');

function clone(value) { return JSON.parse(JSON.stringify(value)); }
function canonicalJson(value) { return DeterministicJson.canonicalJson(value); }
function hexDigest(value) { return crypto.createHash('sha256').update(canonicalJson(value), 'utf8').digest('hex'); }
function digestValue(value) { return 'sha256:' + hexDigest(value); }
function digestBytes(value) { return 'sha256:' + crypto.createHash('sha256').update(value).digest('hex'); }
function jsonBytes(value) { return Buffer.from(JSON.stringify(value, null, 2) + '\n', 'utf8'); }
function compareText(left, right) { return left < right ? -1 : left > right ? 1 : 0; }

function fail(message) { throw new Error(message); }
function plain(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null)) fail(label + ' must be a plain object');
  return value;
}
function exact(value, keys, label) {
  plain(value, label);
  const actual = Object.keys(value).sort();
  const expected = keys.slice().sort();
  if (canonicalJson(actual) !== canonicalJson(expected)) fail(label + ' fields must be exactly ' + expected.join(', '));
  return value;
}
function text(value, label, max) {
  if (typeof value !== 'string' || !value.length || Buffer.byteLength(value, 'utf8') > max) fail(label + ' must be bounded non-empty text');
  return value;
}
function nullableText(value, label, max) { return value == null ? null : text(value, label, max); }
function integer(value, label, min, max) {
  if (!Number.isSafeInteger(value) || value < min || value > max) fail(label + ' must be an integer from ' + min + ' to ' + max);
  return value;
}
function boolean(value, label) { if (typeof value !== 'boolean') fail(label + ' must be boolean'); return value; }
function array(value, label, min, max) {
  if (!Array.isArray(value) || value.length < min || value.length > max) fail(label + ' must be a bounded array');
  return value;
}
function uniqueStrings(value, label, min, max, pattern) {
  const rows = array(value, label, min, max).map((item, index) => {
    if (typeof item !== 'string' || !pattern.test(item)) fail(label + '[' + index + '] has invalid identity');
    return item;
  });
  if (new Set(rows).size !== rows.length) fail(label + ' contains duplicates');
  return rows;
}
function digest(value, label) { if (typeof value !== 'string' || !DIGEST.test(value)) fail(label + ' must be a SHA-256 digest'); return value; }
function hex(value, label) { if (typeof value !== 'string' || !HEX.test(value)) fail(label + ' must be a SHA-256 hex digest'); return value; }
function id(value, label) { if (typeof value !== 'string' || !ID.test(value)) fail(label + ' has invalid identity'); return value; }

function normalizeRef(value, label) {
  exact(value, ['id', 'schema', 'sha256'], label);
  return { id: id(value.id, label + '.id'), schema: text(value.schema, label + '.schema', 220), sha256: digest(value.sha256, label + '.sha256') };
}
function ref(idValue, schema, value) { return { id: idValue, schema, sha256: digestValue(value) }; }
function foundryContractRef() { return ref('code-recipe-foundry-v0.3', CONTRACT_SCHEMA, FOUNDRY_CONTRACT); }
function catalogRef(pack) { return ref('code-cheats-1000-installed', FOUNDRY_PACK_SCHEMA, pack); }
function auditRef(audit) { return ref('code-cheats-1000-syntax-audit', AUDIT_SCHEMA, audit); }
function selectionPacketRef(packet) {
  const normalized = normalizeSelectionPacket(packet);
  return { id: normalized.id, schema: PACKET_SCHEMA, sha256: normalized.packetDigest };
}

function normalizeRootGate(value) {
  const rows = array(value, 'rootsGate', 4, 4).map((item, index) => {
    exact(item, ['root', 'verdict', 'evidenceRefs'], 'rootsGate[' + index + ']');
    if (item.root !== ROOTS[index]) fail('rootsGate must use the exact AXM root order');
    if (item.verdict !== 'PASS') fail('ROOTS_GATE_HOLD:' + item.root + '=' + item.verdict);
    return { root: item.root, verdict: 'PASS', evidenceRefs: array(item.evidenceRefs, 'rootsGate[' + index + '].evidenceRefs', 1, 16).map((entry, refIndex) => normalizeRef(entry, 'rootsGate[' + index + '].evidenceRefs[' + refIndex + ']')) };
  });
  return rows;
}

function normalizeResources(value) {
  exact(value, ['maxSelectedRecipes', 'maxSelectedSnippetBytes', 'maxPacketBytes', 'maxAttempts', 'maxProcesses', 'maxCostMinorUnits'], 'resourceEnvelope');
  const out = {
    maxSelectedRecipes: integer(value.maxSelectedRecipes, 'resourceEnvelope.maxSelectedRecipes', 1, MAX_SELECTED_RECIPES),
    maxSelectedSnippetBytes: integer(value.maxSelectedSnippetBytes, 'resourceEnvelope.maxSelectedSnippetBytes', 1, MAX_SELECTED_SNIPPET_BYTES),
    maxPacketBytes: integer(value.maxPacketBytes, 'resourceEnvelope.maxPacketBytes', 1, MAX_PACKET_BYTES),
    maxAttempts: value.maxAttempts,
    maxProcesses: value.maxProcesses,
    maxCostMinorUnits: value.maxCostMinorUnits
  };
  if (out.maxAttempts !== 1 || out.maxProcesses !== 0 || out.maxCostMinorUnits !== 0) fail('recipe selection allows one zero-process zero-cost attempt only');
  return out;
}

function normalizeRecipe(value, label) {
  exact(value, RECIPE_KEYS, label);
  if (!RECIPE_ID.test(value.id) || !SOURCE_ID.test(value.sourceId)) fail(label + ' recipe or source identity is invalid');
  integer(value.rank, label + '.rank', 1, 1000000);
  integer(value.categoryRank, label + '.categoryRank', 1, 1000000);
  text(value.title, label + '.title', 160);
  text(value.snippet, label + '.snippet', 4000);
  text(value.description, label + '.description', 600);
  text(value.primaryLanguage, label + '.primaryLanguage', 80);
  nullableText(value.domain, label + '.domain', 80);
  uniqueStrings(value.tags, label + '.tags', 0, 20, /^.{1,60}$/u);
  if (typeof value.sourceUrl !== 'string' || !/^https?:\/\//.test(value.sourceUrl) || value.sourceUrl.length > 1000) fail(label + '.sourceUrl is invalid');
  text(value.popularityIndicator, label + '.popularityIndicator', 240);
  if (!['snippet', 'repository', 'ecosystem', 'source', 'not-measured', 'unknown'].includes(value.popularityScope)) fail(label + '.popularityScope is invalid');
  if (!['DECLARED_POPULARITY_CONTEXT', 'EDITORIAL_NOT_POPULARITY_MEASURED'].includes(value.rankingBasis)) fail(label + '.rankingBasis is invalid');
  text(value.familyKey, label + '.familyKey', 120);
  if (!['DECLARED', 'DERIVED_TITLE', 'DERIVED_CATEGORY_TITLE'].includes(value.familyKeySource)) fail(label + '.familyKeySource is invalid');
  if (!['SOURCE_REVIEW_REQUIRED', 'STRUCTURE_HOLD'].includes(value.reviewState)) fail(label + '.reviewState is invalid');
  uniqueStrings(value.holdReasons, label + '.holdReasons', 0, 20, /^[A-Z0-9_]+$/);
  nullableText(value.notesSafety, label + '.notesSafety', 1200);
  nullableText(value.difficulty, label + '.difficulty', 80);
  nullableText(value.platform, label + '.platform', 160);
  nullableText(value.versionBasis, label + '.versionBasis', 240);
  nullableText(value.researchDate, label + '.researchDate', 40);
  nullableText(value.verification, label + '.verification', 600);
  return clone(value);
}

function normalizeAuditResult(value, label) {
  exact(value, AUDIT_RESULT_KEYS, label);
  if (!SOURCE_ID.test(value.sourceId) || !RECIPE_ID.test(value.recipeId)) fail(label + ' identity is invalid');
  ['category', 'title', 'verifier', 'message'].forEach((field) => text(value[field], label + '.' + field, field === 'message' ? 500 : 160));
  if (!['SOURCE_REVIEW_REQUIRED', 'STRUCTURE_HOLD'].includes(value.reviewState)) fail(label + '.reviewState is invalid');
  if (!['SYNTAX_PASS', 'REVIEW_HOLD', 'CONTEXT_UNSUPPORTED', 'VERIFIER_UNAVAILABLE'].includes(value.status)) fail(label + '.status is invalid');
  return clone(value);
}

function verifyCatalog(packValue, auditValue) {
  const pack = clone(packValue);
  const audit = clone(auditValue);
  exact(pack, ['schema', 'generatedAt', 'source', 'summary', 'recipes', 'families', 'truth'], 'Foundry pack');
  if (pack.schema !== FOUNDRY_PACK_SCHEMA) fail('Foundry pack schema mismatch');
  const recipes = array(pack.recipes, 'Foundry pack.recipes', 1000, 1000).map((recipe, index) => normalizeRecipe(recipe, 'Foundry pack.recipes[' + index + ']'));
  if (new Set(recipes.map((item) => item.sourceId)).size !== recipes.length || new Set(recipes.map((item) => item.id)).size !== recipes.length) fail('Foundry pack recipe identities are ambiguous');
  plain(pack.truth, 'Foundry pack.truth');
  if (pack.truth.snippetsExecuted !== false || pack.truth.structuralValidationCompleted !== true || pack.truth.sourceClaimsVerified !== false || pack.truth.licensesVerified !== false || pack.truth.automaticPromotion !== false || pack.truth.canon !== false) fail('Foundry pack truth boundary drifted');
  if (hex(pack.truth.recipeSetSha256, 'Foundry pack.truth.recipeSetSha256') !== hexDigest(recipes)) fail('Foundry recipe-set digest mismatch');
  exact(audit, ['schema', 'generatedAt', 'source', 'host', 'summary', 'results', 'truth', 'resultSetSha256'], 'Foundry audit');
  if (audit.schema !== AUDIT_SCHEMA) fail('Foundry audit schema mismatch');
  const results = array(audit.results, 'Foundry audit.results', 1000, 1000).map((result, index) => normalizeAuditResult(result, 'Foundry audit.results[' + index + ']'));
  if (new Set(results.map((item) => item.sourceId)).size !== results.length || new Set(results.map((item) => item.recipeId)).size !== results.length) fail('Foundry audit identities are ambiguous');
  plain(audit.source, 'Foundry audit.source');
  if (hex(audit.source.recipeSetSha256, 'Foundry audit.source.recipeSetSha256') !== pack.truth.recipeSetSha256) fail('Foundry audit recipe-set lineage mismatch');
  if (hex(audit.source.packSha256, 'Foundry audit.source.packSha256') !== hexDigest(pack)) fail('Foundry audit pack digest mismatch');
  if (hex(audit.resultSetSha256, 'Foundry audit.resultSetSha256') !== hexDigest(results)) fail('Foundry audit result-set digest mismatch');
  plain(audit.truth, 'Foundry audit.truth');
  if (audit.truth.snippetsExecuted !== false || audit.truth.parseOnly !== true || audit.truth.syntaxPassIsRuntimeProof !== false || audit.truth.syntaxPassIsCorrectnessProof !== false || audit.truth.syntaxPassIsSafetyProof !== false || audit.truth.automaticPromotion !== false || audit.truth.canon !== false) fail('Foundry audit truth boundary drifted');
  const recipeMap = new Map(recipes.map((recipe) => [recipe.sourceId, recipe]));
  const auditMap = new Map(results.map((result) => [result.sourceId, result]));
  for (const recipe of recipes) {
    const result = auditMap.get(recipe.sourceId);
    if (!result || result.recipeId !== recipe.id || result.title !== recipe.title || result.reviewState !== recipe.reviewState) fail('Foundry audit record does not match recipe ' + recipe.sourceId);
  }
  return { pack, audit, recipes, results, recipeMap, auditMap, catalogRef: catalogRef(pack), auditRef: auditRef(audit), foundryContractRef: foundryContractRef() };
}

function loadInstalledCatalog() {
  return verifyCatalog(JSON.parse(fs.readFileSync(INSTALLED_PACK, 'utf8')), JSON.parse(fs.readFileSync(INSTALLED_AUDIT, 'utf8')));
}

function normalizeRequestCore(value) {
  exact(value, ['schema', 'id', 'mode', 'purposeRef', 'selectedSourceIds', 'catalogRef', 'auditRef', 'foundryContractRef', 'resourceEnvelope', 'rootsGate', 'authority'], 'recipe selection request');
  if (value.schema !== REQUEST_SCHEMA || value.authority !== 'NONE') fail('recipe selection request identity or authority mismatch');
  if (!MODES.includes(value.mode)) fail('recipe selection mode is unsupported');
  const resources = normalizeResources(value.resourceEnvelope);
  const selectedSourceIds = uniqueStrings(value.selectedSourceIds, 'selectedSourceIds', 1, resources.maxSelectedRecipes, SOURCE_ID).sort(compareText);
  return {
    schema: REQUEST_SCHEMA,
    id: id(value.id, 'request.id'),
    mode: value.mode,
    purposeRef: normalizeRef(value.purposeRef, 'request.purposeRef'),
    selectedSourceIds,
    catalogRef: normalizeRef(value.catalogRef, 'request.catalogRef'),
    auditRef: normalizeRef(value.auditRef, 'request.auditRef'),
    foundryContractRef: normalizeRef(value.foundryContractRef, 'request.foundryContractRef'),
    resourceEnvelope: resources,
    rootsGate: normalizeRootGate(value.rootsGate),
    authority: 'NONE'
  };
}

function sealRequest(value) {
  const core = normalizeRequestCore(value);
  return { ...core, requestDigest: digestValue(core) };
}

function normalizeRequest(value) {
  exact(value, ['schema', 'id', 'mode', 'purposeRef', 'selectedSourceIds', 'catalogRef', 'auditRef', 'foundryContractRef', 'resourceEnvelope', 'rootsGate', 'authority', 'requestDigest'], 'recipe selection request');
  const { requestDigest, ...core } = value;
  const sealed = sealRequest(core);
  if (digest(requestDigest, 'request.requestDigest') !== sealed.requestDigest || canonicalJson(value) !== canonicalJson(sealed)) fail('recipe selection request digest or canonical form mismatch');
  return sealed;
}

function buildExampleInstalledRequest(selectedSourceIds, mode = 'REFERENCE_ONLY') {
  const installed = loadInstalledCatalog();
  const rootsGate = ROOTS.map((root) => ({ root, verdict: 'PASS', evidenceRefs: [ref('recipe-bridge-' + root, 'axm.four-root-technical-review/v1', 'recipe-bridge-' + root)] }));
  return sealRequest({
    schema: REQUEST_SCHEMA,
    id: 'select-installed-code-recipes',
    mode,
    purposeRef: ref('fabric-code-recipe-context', 'axm.declared-purpose/v1', 'Fabric code recipe context'),
    selectedSourceIds,
    catalogRef: installed.catalogRef,
    auditRef: installed.auditRef,
    foundryContractRef: installed.foundryContractRef,
    resourceEnvelope: { maxSelectedRecipes: MAX_SELECTED_RECIPES, maxSelectedSnippetBytes: MAX_SELECTED_SNIPPET_BYTES, maxPacketBytes: MAX_PACKET_BYTES, maxAttempts: 1, maxProcesses: 0, maxCostMinorUnits: 0 },
    rootsGate,
    authority: 'NONE'
  });
}

function selectedRecipe(recipe, audit, mode, position) {
  const snippetBuffer = Buffer.from(recipe.snippet, 'utf8');
  const research = mode === 'DETACHED_RESEARCH_CONTEXT';
  if (research && (recipe.reviewState === 'STRUCTURE_HOLD' || recipe.holdReasons.length)) fail('RECIPE_REVIEW_HOLD:' + recipe.sourceId);
  if (research && audit.status !== 'SYNTAX_PASS') fail('RECIPE_SYNTAX_EVIDENCE_HOLD:' + recipe.sourceId + '=' + audit.status);
  return {
    sourceId: recipe.sourceId,
    recipeId: recipe.id,
    title: recipe.title,
    primaryLanguage: recipe.primaryLanguage,
    domain: recipe.domain,
    tags: clone(recipe.tags),
    sourceUrl: recipe.sourceUrl,
    versionBasis: recipe.versionBasis,
    reviewState: recipe.reviewState,
    holdReasons: clone(recipe.holdReasons),
    selectionPosition: position,
    eligibility: research ? 'DETACHED_RESEARCH_CONTEXT_ONLY' : 'REFERENCE_ONLY',
    snippetRef: { sha256: digestBytes(snippetBuffer), byteLength: snippetBuffer.length },
    snippet: research ? recipe.snippet : null,
    syntaxEvidence: {
      status: audit.status,
      verifier: audit.verifier,
      message: audit.message,
      parseOnly: true,
      runtimeProof: false,
      correctnessProof: false,
      safetyProof: false
    }
  };
}

function packetCore(value) {
  exact(value, ['schema', 'version', 'id', 'status', 'mode', 'selectionRequest', 'requestRef', 'catalogRef', 'auditRef', 'foundryContractRef', 'selectedRecipes', 'resourceObservation', 'reuseRights', 'lineageRefs', 'limitations', 'truth', 'authority'], 'recipe selection packet');
  if (value.schema !== PACKET_SCHEMA || value.version !== VERSION || value.authority !== 'NONE' || !MODES.includes(value.mode) || value.status !== 'TEST') fail('recipe selection packet identity or status mismatch');
  const selectionRequest = normalizeRequest(value.selectionRequest);
  if (selectionRequest.mode !== value.mode) fail('recipe selection packet mode does not match its byte-bound request');
  const selectedRecipes = array(value.selectedRecipes, 'packet.selectedRecipes', 1, MAX_SELECTED_RECIPES).map((entry, index) => {
    exact(entry, ['sourceId', 'recipeId', 'title', 'primaryLanguage', 'domain', 'tags', 'sourceUrl', 'versionBasis', 'reviewState', 'holdReasons', 'selectionPosition', 'eligibility', 'snippetRef', 'snippet', 'syntaxEvidence'], 'packet.selectedRecipes[' + index + ']');
    if (!SOURCE_ID.test(entry.sourceId) || !RECIPE_ID.test(entry.recipeId) || entry.selectionPosition !== index) fail('selected recipe identity or order mismatch');
    text(entry.title, 'selected recipe title', 160); text(entry.primaryLanguage, 'selected recipe language', 80); nullableText(entry.domain, 'selected recipe domain', 80);
    uniqueStrings(entry.tags, 'selected recipe tags', 0, 20, /^.{1,60}$/u); if (typeof entry.sourceUrl !== 'string' || !/^https?:\/\//.test(entry.sourceUrl) || entry.sourceUrl.length > 1000) fail('selected recipe source URL is invalid'); nullableText(entry.versionBasis, 'selected recipe version basis', 240);
    if (!['SOURCE_REVIEW_REQUIRED', 'STRUCTURE_HOLD'].includes(entry.reviewState)) fail('selected recipe review state is invalid'); uniqueStrings(entry.holdReasons, 'selected recipe holds', 0, 20, /^[A-Z0-9_]+$/);
    exact(entry.snippetRef, ['sha256', 'byteLength'], 'selected recipe snippetRef'); digest(entry.snippetRef.sha256, 'selected recipe snippetRef.sha256'); integer(entry.snippetRef.byteLength, 'selected recipe snippetRef.byteLength', 1, 4000);
    exact(entry.syntaxEvidence, ['status', 'verifier', 'message', 'parseOnly', 'runtimeProof', 'correctnessProof', 'safetyProof'], 'selected recipe syntaxEvidence');
    if (!['SYNTAX_PASS', 'REVIEW_HOLD', 'CONTEXT_UNSUPPORTED', 'VERIFIER_UNAVAILABLE'].includes(entry.syntaxEvidence.status)) fail('selected recipe syntax status is invalid');
    text(entry.syntaxEvidence.verifier, 'selected recipe verifier', 100); text(entry.syntaxEvidence.message, 'selected recipe syntax message', 500);
    if (entry.syntaxEvidence.parseOnly !== true || entry.syntaxEvidence.runtimeProof !== false || entry.syntaxEvidence.correctnessProof !== false || entry.syntaxEvidence.safetyProof !== false) fail('selected recipe syntax truth ceiling drifted');
    const research = value.mode === 'DETACHED_RESEARCH_CONTEXT';
    if (research) {
      if (entry.eligibility !== 'DETACHED_RESEARCH_CONTEXT_ONLY' || typeof entry.snippet !== 'string' || entry.reviewState === 'STRUCTURE_HOLD' || entry.holdReasons.length || entry.syntaxEvidence.status !== 'SYNTAX_PASS') fail('research-context recipe is ineligible');
      const bytes = Buffer.from(entry.snippet, 'utf8');
      if (bytes.length !== entry.snippetRef.byteLength || digestBytes(bytes) !== entry.snippetRef.sha256) fail('selected recipe snippet digest mismatch');
    } else if (entry.eligibility !== 'REFERENCE_ONLY' || entry.snippet !== null) fail('reference-only packet cannot emit snippet text');
    return clone(entry);
  });
  if (new Set(selectedRecipes.map((entry) => entry.sourceId)).size !== selectedRecipes.length || selectedRecipes.some((entry, index) => index && selectedRecipes[index - 1].sourceId >= entry.sourceId)) fail('selected recipe identities must be unique and sorted');
  if (canonicalJson(selectionRequest.selectedSourceIds) !== canonicalJson(selectedRecipes.map((entry) => entry.sourceId))) fail('selected recipes do not match the byte-bound request');
  exact(value.resourceObservation, ['catalogRecipeCount', 'selectedRecipeCount', 'selectedSnippetBytes', 'emittedSnippetBytes', 'packetBytes', 'selectionCountEnforced', 'snippetByteCeilingEnforced', 'packetByteCeilingEnforced', 'attemptCountEnforced', 'processesSpawned', 'networkUsed'], 'packet.resourceObservation');
  const observed = value.resourceObservation;
  if (observed.catalogRecipeCount !== 1000 || observed.selectedRecipeCount !== selectedRecipes.length || observed.selectionCountEnforced !== true || observed.snippetByteCeilingEnforced !== true || observed.packetByteCeilingEnforced !== true || observed.attemptCountEnforced !== true || observed.processesSpawned !== 0 || observed.networkUsed !== false) fail('recipe selection resource observation drifted');
  const selectedBytes = selectedRecipes.reduce((total, entry) => total + entry.snippetRef.byteLength, 0);
  const emittedBytes = selectedRecipes.reduce((total, entry) => total + (entry.snippet == null ? 0 : Buffer.byteLength(entry.snippet, 'utf8')), 0);
  if (observed.selectedSnippetBytes !== selectedBytes || observed.emittedSnippetBytes !== emittedBytes) fail('recipe selection byte observation drifted');
  exact(value.reuseRights, ['state', 'directReuseAllowed', 'sourceClaimsVerified', 'licensesVerified', 'authorityRef'], 'packet.reuseRights');
  if (value.reuseRights.state !== 'RESEARCH_ONLY_HOLD' || value.reuseRights.directReuseAllowed !== false || value.reuseRights.sourceClaimsVerified !== false || value.reuseRights.licensesVerified !== false || value.reuseRights.authorityRef !== null) fail('recipe selection reuse-rights ceiling drifted');
  const lineageRefs = array(value.lineageRefs, 'packet.lineageRefs', 3, 3).map((entry, index) => normalizeRef(entry, 'packet.lineageRefs[' + index + ']'));
  const limitations = uniqueStrings(value.limitations, 'packet.limitations', LIMITATIONS.length, 16, /^[A-Z0-9_]+$/).slice().sort(compareText);
  if (LIMITATIONS.some((item) => !limitations.includes(item))) fail('recipe selection limitations are incomplete');
  exact(value.truth, ['catalogDigestVerified', 'recipeSetDigestVerified', 'auditDigestVerified', 'auditRecipeSetMatched', 'recipesSelectedAutomatically', 'editorialRankTreatedAsQuality', 'snippetsIncluded', 'snippetsExecuted', 'syntaxPassIsRuntimeProof', 'syntaxPassIsCorrectnessProof', 'syntaxPassIsSafetyProof', 'sourceClaimsVerified', 'licensesVerified', 'directReuseAuthorized', 'candidateGenerated', 'candidateExecuted', 'installed', 'integrated', 'promoted', 'canonChanged'], 'packet.truth');
  const truth = value.truth;
  if (truth.catalogDigestVerified !== true || truth.recipeSetDigestVerified !== true || truth.auditDigestVerified !== true || truth.auditRecipeSetMatched !== true || truth.recipesSelectedAutomatically !== false || truth.editorialRankTreatedAsQuality !== false || truth.snippetsIncluded !== (value.mode === 'DETACHED_RESEARCH_CONTEXT') || truth.snippetsExecuted !== false || truth.syntaxPassIsRuntimeProof !== false || truth.syntaxPassIsCorrectnessProof !== false || truth.syntaxPassIsSafetyProof !== false || truth.sourceClaimsVerified !== false || truth.licensesVerified !== false || truth.directReuseAuthorized !== false || truth.candidateGenerated !== false || truth.candidateExecuted !== false || truth.installed !== false || truth.integrated !== false || truth.promoted !== false || truth.canonChanged !== false) fail('recipe selection truth ceiling drifted');
  const requestRefValue = normalizeRef(value.requestRef, 'packet.requestRef');
  const expectedRequestRef = { id: selectionRequest.id, schema: REQUEST_SCHEMA, sha256: selectionRequest.requestDigest };
  if (canonicalJson(requestRefValue) !== canonicalJson(expectedRequestRef)) fail('recipe selection request reference drifted');
  const catalogRefValue = normalizeRef(value.catalogRef, 'packet.catalogRef');
  const auditRefValue = normalizeRef(value.auditRef, 'packet.auditRef');
  const foundryContractRefValue = normalizeRef(value.foundryContractRef, 'packet.foundryContractRef');
  if (canonicalJson(catalogRefValue) !== canonicalJson(selectionRequest.catalogRef) || canonicalJson(auditRefValue) !== canonicalJson(selectionRequest.auditRef) || canonicalJson(foundryContractRefValue) !== canonicalJson(selectionRequest.foundryContractRef)) fail('recipe selection packet source refs do not match its byte-bound request');
  if (observed.selectedRecipeCount > selectionRequest.resourceEnvelope.maxSelectedRecipes || observed.selectedSnippetBytes > selectionRequest.resourceEnvelope.maxSelectedSnippetBytes || observed.packetBytes > selectionRequest.resourceEnvelope.maxPacketBytes) fail('recipe selection packet exceeds its byte-bound request resources');
  return {
    schema: PACKET_SCHEMA, version: VERSION, id: id(value.id, 'packet.id'), status: value.status, mode: value.mode,
    selectionRequest, requestRef: requestRefValue, catalogRef: catalogRefValue, auditRef: auditRefValue, foundryContractRef: foundryContractRefValue,
    selectedRecipes, resourceObservation: clone(observed), reuseRights: clone(value.reuseRights), lineageRefs, limitations, truth: clone(truth), authority: 'NONE'
  };
}

function normalizeSelectionPacket(value) {
  exact(value, ['schema', 'version', 'id', 'status', 'mode', 'selectionRequest', 'requestRef', 'catalogRef', 'auditRef', 'foundryContractRef', 'selectedRecipes', 'resourceObservation', 'reuseRights', 'lineageRefs', 'limitations', 'truth', 'authority', 'packetDigest'], 'recipe selection packet');
  const { packetDigest, ...withoutDigest } = value;
  const core = packetCore(withoutDigest);
  const expected = digestValue(core);
  if (digest(packetDigest, 'packet.packetDigest') !== expected || canonicalJson(value) !== canonicalJson({ ...core, packetDigest: expected })) fail('recipe selection packet digest or canonical form mismatch');
  if (jsonBytes(value).length !== value.resourceObservation.packetBytes) fail('recipe selection packet byte observation mismatch');
  return { ...core, packetDigest: expected };
}

function normalizeInstalledSelectionPacket(value) {
  const packet = normalizeSelectionPacket(value);
  const installed = loadInstalledCatalog();
  if (canonicalJson(packet.catalogRef) !== canonicalJson(installed.catalogRef) ||
      canonicalJson(packet.auditRef) !== canonicalJson(installed.auditRef) ||
      canonicalJson(packet.foundryContractRef) !== canonicalJson(installed.foundryContractRef)) {
    fail('installed Foundry contract, catalog, or audit lineage drifted');
  }
  const expectedLineage = [installed.catalogRef, installed.auditRef, installed.foundryContractRef];
  if (canonicalJson(packet.lineageRefs) !== canonicalJson(expectedLineage)) fail('installed Foundry lineage order or bytes drifted');
  packet.selectedRecipes.forEach((entry, index) => {
    const recipe = installed.recipeMap.get(entry.sourceId);
    const audit = installed.auditMap.get(entry.sourceId);
    if (!recipe || !audit) fail('installed Foundry recipe or audit record is missing: ' + entry.sourceId);
    const expected = selectedRecipe(recipe, audit, packet.mode, index);
    if (canonicalJson(entry) !== canonicalJson(expected)) fail('selected recipe does not match installed Foundry bytes: ' + entry.sourceId);
  });
  return packet;
}

function buildSelection(packValue, auditValue, requestValue) {
  const request = normalizeRequest(requestValue);
  const verified = verifyCatalog(packValue, auditValue);
  if (canonicalJson(request.catalogRef) !== canonicalJson(verified.catalogRef) || canonicalJson(request.auditRef) !== canonicalJson(verified.auditRef) || canonicalJson(request.foundryContractRef) !== canonicalJson(verified.foundryContractRef)) fail('recipe selection source contract or catalog digest drifted');
  const selected = request.selectedSourceIds.map((sourceId, index) => {
    const recipe = verified.recipeMap.get(sourceId);
    const audit = verified.auditMap.get(sourceId);
    if (!recipe || !audit) fail('selected recipe is missing: ' + sourceId);
    return selectedRecipe(recipe, audit, request.mode, index);
  });
  const selectedSnippetBytes = selected.reduce((total, entry) => total + entry.snippetRef.byteLength, 0);
  if (selectedSnippetBytes > request.resourceEnvelope.maxSelectedSnippetBytes) fail('selected recipe snippet bytes exceed the request ceiling');
  const emittedSnippetBytes = selected.reduce((total, entry) => total + (entry.snippet == null ? 0 : Buffer.byteLength(entry.snippet, 'utf8')), 0);
  const requestRef = { id: request.id, schema: REQUEST_SCHEMA, sha256: request.requestDigest };
  const base = {
    schema: PACKET_SCHEMA, version: VERSION, id: request.id + '-packet', status: 'TEST', mode: request.mode,
    selectionRequest: request, requestRef, catalogRef: verified.catalogRef, auditRef: verified.auditRef, foundryContractRef: verified.foundryContractRef,
    selectedRecipes: selected,
    resourceObservation: { catalogRecipeCount: 1000, selectedRecipeCount: selected.length, selectedSnippetBytes, emittedSnippetBytes, packetBytes: 1, selectionCountEnforced: true, snippetByteCeilingEnforced: true, packetByteCeilingEnforced: true, attemptCountEnforced: true, processesSpawned: 0, networkUsed: false },
    reuseRights: { state: 'RESEARCH_ONLY_HOLD', directReuseAllowed: false, sourceClaimsVerified: false, licensesVerified: false, authorityRef: null },
    lineageRefs: [verified.catalogRef, verified.auditRef, verified.foundryContractRef],
    limitations: LIMITATIONS.slice().sort(compareText),
    truth: { catalogDigestVerified: true, recipeSetDigestVerified: true, auditDigestVerified: true, auditRecipeSetMatched: true, recipesSelectedAutomatically: false, editorialRankTreatedAsQuality: false, snippetsIncluded: request.mode === 'DETACHED_RESEARCH_CONTEXT', snippetsExecuted: false, syntaxPassIsRuntimeProof: false, syntaxPassIsCorrectnessProof: false, syntaxPassIsSafetyProof: false, sourceClaimsVerified: false, licensesVerified: false, directReuseAuthorized: false, candidateGenerated: false, candidateExecuted: false, installed: false, integrated: false, promoted: false, canonChanged: false },
    authority: 'NONE'
  };
  let packet = null;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const core = packetCore(base);
    packet = { ...core, packetDigest: digestValue(core) };
    const bytes = jsonBytes(packet).length;
    if (bytes === base.resourceObservation.packetBytes) break;
    base.resourceObservation.packetBytes = bytes;
  }
  if (!packet || jsonBytes(packet).length !== base.resourceObservation.packetBytes) fail('recipe selection packet byte measurement did not converge');
  if (base.resourceObservation.packetBytes > request.resourceEnvelope.maxPacketBytes) fail('recipe selection packet exceeds the request byte ceiling');
  return normalizeSelectionPacket(packet);
}

function selectInstalled(requestValue) {
  const installed = loadInstalledCatalog();
  const request = normalizeRequest(requestValue);
  return { request, packet: buildSelection(installed.pack, installed.audit, request) };
}

function selectInstalledForTest(selectedSourceIds, mode = 'REFERENCE_ONLY') {
  return selectInstalled(buildExampleInstalledRequest(selectedSourceIds, mode));
}

module.exports = {
  VERSION, REQUEST_SCHEMA, PACKET_SCHEMA, FOUNDRY_PACK_SCHEMA, AUDIT_SCHEMA, MODES, ROOTS,
  MAX_SELECTED_RECIPES, MAX_SELECTED_SNIPPET_BYTES, MAX_PACKET_BYTES, LIMITATIONS,
  canonicalJson, digestValue, jsonBytes, foundryContractRef, catalogRef, auditRef,
  selectionPacketRef, verifyCatalog, loadInstalledCatalog, sealRequest, normalizeRequest,
  buildExampleInstalledRequest, buildSelection, normalizeSelectionPacket, normalizeInstalledSelectionPacket,
  selectInstalled, selectInstalledForTest, clone
};
