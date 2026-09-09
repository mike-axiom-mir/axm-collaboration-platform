'use strict';

const Digest = require('./digest');
const Reference = require('./reference-intake');
const Ai = require('./ai-broker');
const AiExecutor = require('./ai-executor');
const Search = require('./search-broker');
const SearchExecutor = require('./search-executor');
const ImageSearch = require('./image-search-broker');
const ImageSearchExecutor = require('./image-search-executor');

const REFERENCE_MATCH_RUN_SCHEMA = 'axm.web.reference-match-run/v1';
const VERTICALS = new Set(['web', 'images']);

class AxmReferenceLabError extends Error {
  constructor(code, message, details) {
    super(message);
    this.name = 'AxmReferenceLabError';
    this.code = code;
    this.details = details || {};
  }
}

function trimQuery(value) {
  const text = String(value == null ? '' : value).trim().replace(/^["'`]+|["'`]+$/g, '').replace(/\s+/g, ' ');
  if (!text) throw new AxmReferenceLabError('REFERENCE_INTERPRETATION_EMPTY', 'reference interpretation produced no search text');
  const words = text.split(' ').slice(0, 50);
  let query = words.join(' ');
  if (query.length > 400) query = query.slice(0, 400).replace(/\s+\S*$/, '').trim();
  if (!query) throw new AxmReferenceLabError('REFERENCE_INTERPRETATION_EMPTY', 'reference interpretation could not be bounded into a search query');
  return query;
}

function directQuery(reference) {
  Reference.validateReference(reference);
  if (reference.receipt.kind === 'query') return trimQuery(reference.runtime.text);
  if (reference.receipt.contentState === 'TEXT_AVAILABLE') {
    const hint = String(reference.receipt.userHint || '').trim();
    if (hint) return trimQuery(hint + ' ' + reference.runtime.text);
  }
  return null;
}

function eligibleProviders(registry, reference, requestedIds) {
  const providers = Ai.selectedProviders(registry, requestedIds);
  return providers.filter(function (provider) { return provider.referenceAccess && Ai.supportsReference(provider, reference); });
}

class ReferenceLab {
  constructor(options) {
    options = options || {};
    this.options = Object.assign({}, options);
    this.aiRegistry = options.aiRegistry ? Ai.validateRegistry(options.aiRegistry) : Ai.createRegistry([], { mode: 'single' });
    this.reference = null;
    this.lastRun = null;
    this.runSequence = 0;
    this.running = false;
  }

  registryNow() {
    if (typeof this.options.aiRegistryProvider === 'function') return Ai.validateRegistry(this.options.aiRegistryProvider());
    return Ai.validateRegistry(this.aiRegistry);
  }

  setAiRegistry(registry) { this.aiRegistry = Ai.validateRegistry(registry); }

  intakeQuery(query, metadata) { this.reference = Reference.createQueryReference(query, metadata); this.lastRun = null; return this.state(); }
  intakeText(text, metadata) { this.reference = Reference.createTextReference(text, metadata); this.lastRun = null; return this.state(); }
  intakeFile(bytes, metadata) { this.reference = Reference.createFileReference(bytes, metadata); this.lastRun = null; return this.state(); }
  clearReference() { this.reference = null; this.lastRun = null; return this.state(); }

  state() {
    const registry = this.registryNow();
    const visualState = typeof this.options.visualStateProvider === 'function' ? this.options.visualStateProvider() : this.options.visualState || null;
    const visualSummary = visualState ? { visualDigest: visualState.visualDigest, fidelity: visualState.visualFidelity, page: visualState.page, viewport: visualState.viewport, visibleEntryCount: visualState.visibleEntryCount } : null;
    const material = {
      schema: 'axm.web.reference-lab-state/v1', version: 1, status: 'EXPERIMENTAL', running: this.running,
      reference: this.reference ? this.reference.receipt : null,
      browserVisualState: visualSummary,
      lastRun: this.lastRun,
      adapters: registry.providers.map(function (provider) {
        return { id: provider.id, label: provider.label, adapter: provider.adapter, model: provider.model, enabled: provider.enabled, visualStateAccess: provider.visualStateAccess, referenceAccess: provider.referenceAccess, capabilities: provider.capabilities, local: provider.local };
      }),
      authority: { uploadExecutesContent: false, automaticNetworkAllowed: false, automaticProviderExecutionAllowed: false, browserMutationAllowed: false, navigationGranted: false, installAllowed: false, promotionAllowed: false, canonAllowed: false }
    };
    return Object.assign({}, material, { stateDigest: Digest.canonicalDigest(material) });
  }

  async interpretReference(options) {
    options = options || {};
    if (!this.reference) throw new AxmReferenceLabError('REFERENCE_REQUIRED', 'Reference Lab has no active reference');
    const direct = this.reference.receipt.kind === 'query' ? directQuery(this.reference) : null;
    if (direct) return { query: direct, interpretation: null, aiExecution: null };
    const requested = Array.isArray(options.providerIds) ? options.providerIds : null;
    const registry = this.registryNow();
    const eligible = eligibleProviders(registry, this.reference, requested);
    if (!eligible.length) {
      const deterministic = directQuery(this.reference);
      if (deterministic) return { query: deterministic, interpretation: { method: 'DETERMINISTIC_TEXT_FALLBACK', providerId: null, trusted: false, referenceReceiptDigest: this.reference.receipt.receiptDigest, text: deterministic }, aiExecution: null };
      throw new AxmReferenceLabError('REFERENCE_AI_REQUIRED', 'this reference requires an enabled AI adapter with reference access and matching media capability', { kind: this.reference.receipt.kind, mediaType: this.reference.receipt.mediaType });
    }
    const provider = eligible[0];
    const visualState = typeof this.options.visualStateProvider === 'function' ? this.options.visualStateProvider() : this.options.visualState || null;
    const plan = Ai.buildAiPlan(
      'Describe the attached reference as one concise search query for finding visually or semantically similar material. Return only the search query, no explanation. Do not claim identity or certainty you cannot observe.',
      registry,
      { reference: this.reference, visualState, notes: this.reference.receipt.userHint || null },
      { providerIds: [provider.id], maxOutputTokens: 180 }
    );
    const aiExecution = await AiExecutor.executeAiPlan(plan, Object.assign({}, this.options.aiOptions || {}, { networkAuthority: this.options.aiNetworkAuthority }));
    const output = aiExecution.outputs.find(function (item) { return item.status === 'PASS'; });
    if (!output) throw new AxmReferenceLabError('REFERENCE_AI_FAILED', 'no AI adapter returned a usable reference interpretation');
    const query = trimQuery(output.output);
    return { query, interpretation: { method: 'AI_REFERENCE_DESCRIPTION', providerId: output.providerId, adapter: output.adapter, trusted: false, referenceReceiptDigest: this.reference.receipt.receiptDigest, text: query, aiExecutionDigest: aiExecution.executionDigest }, aiExecution };
  }

  async findMatches(options) {
    options = options || {};
    if (this.running) throw new AxmReferenceLabError('REFERENCE_LAB_BUSY', 'Reference Lab is already running');
    if (!this.reference) throw new AxmReferenceLabError('REFERENCE_REQUIRED', 'Reference Lab has no active reference');
    const vertical = String(options.vertical || 'images').toLowerCase();
    if (!VERTICALS.has(vertical)) throw new AxmReferenceLabError('REFERENCE_VERTICAL_INVALID', 'vertical must be web or images', { vertical });
    const count = Number.isInteger(options.count) ? options.count : 20;
    if (count < 1 || count > 50) throw new AxmReferenceLabError('REFERENCE_LIMIT', 'match count must be 1..50');
    this.running = true;
    try {
      const interpreted = await this.interpretReference(options);
      let searchPlan, searchExecution;
      if (vertical === 'images') {
        searchPlan = ImageSearch.buildImageSearchPlan({ query: interpreted.query, count, mode: options.searchMode || 'single', provider: options.searchProvider || 'auto', providers: Array.isArray(options.searchProviders) ? options.searchProviders : [], safeSearch: options.safeSearch || 'strict', language: options.language || 'all', country: options.country || null }, this.options.imageSearchConfig || this.options.searchConfig || {});
        searchExecution = await ImageSearchExecutor.executeImageSearchPlan(searchPlan, Object.assign({}, this.options.imageSearchOptions || {}, { networkAuthority: this.options.searchNetworkAuthority }));
      } else {
        searchPlan = Search.buildSearchPlan({ query: interpreted.query, count: Math.min(20, count), mode: options.searchMode || 'single', provider: options.searchProvider || 'auto', providers: Array.isArray(options.searchProviders) ? options.searchProviders : [], safeSearch: options.safeSearch || 'moderate', language: options.language || 'all', country: options.country || null }, this.options.searchConfig || {});
        searchExecution = await SearchExecutor.executeSearchPlan(searchPlan, Object.assign({}, this.options.searchOptions || {}, { networkAuthority: this.options.searchNetworkAuthority }));
      }
      this.runSequence += 1;
      const material = {
        schema: REFERENCE_MATCH_RUN_SCHEMA, version: 1, status: searchExecution.status, sequence: this.runSequence,
        referenceReceiptDigest: this.reference.receipt.receiptDigest, referenceKind: this.reference.receipt.kind, referenceMediaType: this.reference.receipt.mediaType,
        vertical, query: interpreted.query, interpretation: interpreted.interpretation,
        aiExecutionDigest: interpreted.aiExecution ? interpreted.aiExecution.executionDigest : null,
        searchPlanDigest: searchPlan.planDigest, searchExecutionDigest: searchExecution.executionDigest, resultSet: searchExecution.resultSet,
        authority: { userInitiated: options.userInitiated === true, referenceContentExecuted: false, browserMutationAllowed: false, resultNavigationGranted: false, resultContentTrusted: false, interpretationTrusted: false, installAllowed: false, promotionAllowed: false, canonAllowed: false }
      };
      this.lastRun = Object.assign({}, material, { runDigest: Digest.canonicalDigest(material) });
      return this.lastRun;
    } finally { this.running = false; }
  }
}

module.exports = { REFERENCE_MATCH_RUN_SCHEMA, VERTICALS, AxmReferenceLabError, trimQuery, directQuery, eligibleProviders, ReferenceLab };
