'use strict';

const crypto = require('crypto');

const PACK_SCHEMA = 'axm.code-recipe-pack/v1';
const PACKET_SCHEMA = 'axm.code-recipe-evidence-packet/v1';
const QUERY_SCHEMA = 'axm.code-recipe-evidence-query/v1';
const MAX_RESULTS = 32;
const MAX_RECIPES = 5000;

function stableStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(stableStringify).join(',') + ']';
  return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + stableStringify(value[key])).join(',') + '}';
}

function sha256Object(value) {
  return 'sha256:' + crypto.createHash('sha256').update(stableStringify(value), 'utf8').digest('hex');
}

function sha256Text(value) {
  return 'sha256:' + crypto.createHash('sha256').update(String(value == null ? '' : value), 'utf8').digest('hex');
}

function normalizeText(value) {
  const text = String(value == null ? '' : value);
  return (text.normalize ? text.normalize('NFKD') : text)
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function tokens(value) {
  const normalized = normalizeText(value);
  return normalized ? Array.from(new Set(normalized.split(/\s+/).filter(Boolean))).sort() : [];
}

function normalizeList(value, limit, field) {
  if (value == null) return [];
  if (!Array.isArray(value)) throw new Error(field + ' must be an array.');
  if (value.length > limit) throw new Error(field + ' exceeds the bounded limit of ' + limit + '.');
  return Array.from(new Set(value.map(normalizeText).filter(Boolean))).sort();
}

function normalizeQuery(query) {
  if (!query || typeof query !== 'object' || Array.isArray(query)) throw new Error('Query must be an object.');
  if (query.schema != null && query.schema !== QUERY_SCHEMA) throw new Error('Unsupported query schema.');
  const termsValue = String(query.terms == null ? '' : query.terms);
  if (Buffer.byteLength(termsValue, 'utf8') > 1024) throw new Error('Query terms exceed 1 KiB.');
  const normalized = {
    schema: QUERY_SCHEMA,
    terms: tokens(termsValue),
    languages: normalizeList(query.languages, 16, 'languages'),
    domains: normalizeList(query.domains, 16, 'domains'),
    tags: normalizeList(query.tags, 32, 'tags'),
    familyKeys: normalizeList(query.familyKeys, 16, 'familyKeys'),
    maxResults: Number.isInteger(query.maxResults) ? query.maxResults : 12
  };
  if (normalized.maxResults < 1 || normalized.maxResults > MAX_RESULTS) throw new Error('maxResults must be between 1 and ' + MAX_RESULTS + '.');
  if (!normalized.terms.length && !normalized.languages.length && !normalized.domains.length && !normalized.tags.length && !normalized.familyKeys.length) {
    throw new Error('At least one bounded query criterion is required.');
  }
  return normalized;
}

function assertPack(pack) {
  if (!pack || typeof pack !== 'object' || Array.isArray(pack)) throw new Error('Recipe pack must be an object.');
  if (pack.schema !== PACK_SCHEMA) throw new Error('Recipe pack must use ' + PACK_SCHEMA + '.');
  if (!Array.isArray(pack.recipes)) throw new Error('Recipe pack recipes must be an array.');
  if (pack.recipes.length > MAX_RECIPES) throw new Error('Recipe pack exceeds the 5,000-recipe bound.');
  return pack;
}

function syntaxIndex(audit) {
  const index = new Map();
  if (!audit || typeof audit !== 'object' || !Array.isArray(audit.results)) return index;
  for (const result of audit.results) {
    if (!result || typeof result !== 'object') continue;
    const key = String(result.sourceId || result.recipeId || '').trim();
    if (!key || index.has(key)) continue;
    index.set(key, {
      status: String(result.status || 'NOT_PROVEN'),
      verifier: result.verifier ? String(result.verifier) : null,
      message: result.message ? String(result.message).slice(0, 400) : null
    });
  }
  return index;
}

function fieldTokenSet(recipe) {
  function set(value) { return new Set(tokens(value)); }
  return {
    title: set(recipe.title),
    family: set(recipe.familyKey),
    tags: set(Array.isArray(recipe.tags) ? recipe.tags.join(' ') : ''),
    description: set(recipe.description),
    domain: set(recipe.domain),
    language: set(recipe.primaryLanguage),
    platform: set(recipe.platform),
    sourceId: set(recipe.sourceId)
  };
}

function includesAll(haystackSet, needles) {
  return needles.every(item => haystackSet.has(item));
}

function matchesFilter(recipe, query) {
  const language = normalizeText(recipe.primaryLanguage);
  const domain = normalizeText(recipe.domain);
  const family = normalizeText(recipe.familyKey);
  const tagValues = new Set((Array.isArray(recipe.tags) ? recipe.tags : []).map(normalizeText).filter(Boolean));
  if (query.languages.length && !query.languages.includes(language)) return false;
  if (query.domains.length && !query.domains.includes(domain)) return false;
  if (query.familyKeys.length && !query.familyKeys.includes(family)) return false;
  if (query.tags.length && !query.tags.every(tag => tagValues.has(tag))) return false;
  return true;
}

function scoreRecipe(recipe, query) {
  const fields = fieldTokenSet(recipe);
  if (query.terms.length) {
    const all = new Set();
    Object.values(fields).forEach(set => set.forEach(token => all.add(token)));
    if (!includesAll(all, query.terms)) return null;
  }
  let score = 0;
  const evidence = [];
  const weights = { title: 8, family: 7, tags: 6, description: 4, domain: 3, language: 2, platform: 2, sourceId: 1 };
  for (const term of query.terms) {
    for (const [field, set] of Object.entries(fields)) {
      if (set.has(term)) {
        score += weights[field];
        evidence.push(field + ':' + term);
      }
    }
  }
  score += query.languages.length ? 4 : 0;
  score += query.domains.length ? 4 : 0;
  score += query.tags.length * 4;
  score += query.familyKeys.length ? 6 : 0;
  return { score, evidence: Array.from(new Set(evidence)).sort() };
}

function compactRecipeRef(recipe, syntax) {
  const reviewState = String(recipe.reviewState || 'SOURCE_REVIEW_REQUIRED');
  return {
    recipeId: String(recipe.id || ''),
    sourceId: recipe.sourceId == null ? null : String(recipe.sourceId),
    familyKey: String(recipe.familyKey || ''),
    title: String(recipe.title || ''),
    description: String(recipe.description || ''),
    primaryLanguage: String(recipe.primaryLanguage || ''),
    domain: recipe.domain == null ? null : String(recipe.domain),
    tags: Array.isArray(recipe.tags) ? recipe.tags.map(String) : [],
    difficulty: recipe.difficulty == null ? null : String(recipe.difficulty),
    platform: recipe.platform == null ? null : String(recipe.platform),
    versionBasis: recipe.versionBasis == null ? null : String(recipe.versionBasis),
    sourceUrl: recipe.sourceUrl == null ? null : String(recipe.sourceUrl),
    reviewState,
    holdReasons: Array.isArray(recipe.holdReasons) ? recipe.holdReasons.map(String) : [],
    safetyNotePresent: Boolean(recipe.notesSafety && String(recipe.notesSafety).trim()),
    snippetRef: {
      sha256: sha256Text(recipe.snippet),
      bytesIncluded: false
    },
    syntaxEvidence: syntax || { status: 'NOT_PROVEN', verifier: null, message: null },
    evidenceClass: reviewState === 'STRUCTURE_VALIDATED' ? 'STRUCTURE_VALIDATED_SOURCE_UNPROVEN' : 'SOURCE_REVIEW_REQUIRED'
  };
}

function buildEvidencePacket(pack, query, options) {
  assertPack(pack);
  const normalizedQuery = normalizeQuery(query);
  options = options || {};
  const auditMap = syntaxIndex(options.syntaxAudit);
  const matches = [];
  const heldMatches = [];

  for (const recipe of pack.recipes) {
    if (!recipe || typeof recipe !== 'object' || Array.isArray(recipe)) continue;
    if (!matchesFilter(recipe, normalizedQuery)) continue;
    const scored = scoreRecipe(recipe, normalizedQuery);
    if (!scored) continue;
    const syntaxKey = String(recipe.sourceId || recipe.id || '');
    const ref = compactRecipeRef(recipe, auditMap.get(syntaxKey));
    const record = {
      match: {
        mechanicalScore: scored.score,
        matchedFields: scored.evidence,
        popularityUsedForScoring: false,
        correctnessUsedForScoring: false,
        semanticInferenceUsed: false
      },
      recipe: ref
    };
    if (ref.reviewState === 'STRUCTURE_HOLD' || ref.holdReasons.length) heldMatches.push(record);
    else matches.push(record);
  }

  const sorter = (a, b) => b.match.mechanicalScore - a.match.mechanicalScore || a.recipe.title.localeCompare(b.recipe.title) || a.recipe.recipeId.localeCompare(b.recipe.recipeId);
  matches.sort(sorter);
  heldMatches.sort(sorter);

  const body = {
    schema: PACKET_SCHEMA,
    version: '0.1.0',
    status: 'EVIDENCE_ONLY',
    generatedAt: options.generatedAt == null ? null : String(options.generatedAt),
    query: normalizedQuery,
    sourcePackRef: {
      schema: PACK_SCHEMA,
      objectSha256: sha256Object(pack),
      recipeSetSha256: pack.truth && pack.truth.recipeSetSha256 ? String(pack.truth.recipeSetSha256) : null,
      sourceClaimsVerified: Boolean(pack.truth && pack.truth.sourceClaimsVerified === true),
      canon: Boolean(pack.truth && pack.truth.canon === true)
    },
    summary: {
      recipesScanned: pack.recipes.length,
      eligibleMatches: matches.length,
      heldMatches: heldMatches.length,
      returned: Math.min(matches.length, normalizedQuery.maxResults),
      truncated: matches.length > normalizedQuery.maxResults
    },
    candidates: matches.slice(0, normalizedQuery.maxResults),
    heldMatches: heldMatches.slice(0, normalizedQuery.maxResults),
    boundaries: {
      snippetBytesIncluded: false,
      snippetsExecuted: false,
      recipeIsCapability: false,
      recipeIsProvider: false,
      providerAuthorityGranted: false,
      semanticDeduplicationPerformed: false,
      syntaxPassIsRuntimeProof: false,
      syntaxPassIsCorrectnessProof: false,
      sourceUrlIsLicenseProof: false,
      popularityIsCorrectnessProof: false,
      automaticInstall: false,
      automaticPromotion: false,
      automaticCanon: false,
      intendedUse: 'bounded-knowledge-evidence-for-human-or-creation-fabric-review'
    }
  };
  body.querySha256 = sha256Object(normalizedQuery);
  body.packetSha256 = sha256Object(body);
  return body;
}

function verifyPacket(packet) {
  if (!packet || packet.schema !== PACKET_SCHEMA) return { pass: false, reason: 'SCHEMA' };
  const copy = JSON.parse(JSON.stringify(packet));
  const claimed = copy.packetSha256;
  delete copy.packetSha256;
  const actual = sha256Object(copy);
  return { pass: claimed === actual, claimed, actual };
}

module.exports = {
  PACK_SCHEMA,
  PACKET_SCHEMA,
  QUERY_SCHEMA,
  MAX_RESULTS,
  MAX_RECIPES,
  stableStringify,
  sha256Object,
  sha256Text,
  normalizeQuery,
  buildEvidencePacket,
  verifyPacket
};
