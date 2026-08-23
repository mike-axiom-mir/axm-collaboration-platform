'use strict';

const Digest = require('./digest');
const Ai = require('./ai-broker');
const AiExecutor = require('./ai-executor');
const Search = require('./search-broker');
const SearchExecutor = require('./search-executor');
const Visual = require('./browser-visual-state');

const RESEARCH_PLAN_SCHEMA = 'axm.web.research-plan/v1';
const RESEARCH_RUN_SCHEMA = 'axm.web.research-run/v1';
const RESEARCH_MODES = new Set(['search+ai', 'search-only', 'ai-only']);

class AxmResearchModeError extends Error {
  constructor(code, message, details) {
    super(message);
    this.name = 'AxmResearchModeError';
    this.code = code;
    this.details = details || {};
  }
}

function cleanQuestion(value) {
  const question = String(value == null ? '' : value).trim().replace(/\s+/g, ' ');
  if (!question) throw new AxmResearchModeError('RESEARCH_QUESTION_REQUIRED', 'research question is required');
  if (question.length > 4000) throw new AxmResearchModeError('RESEARCH_QUESTION_LIMIT', 'research question exceeds the 4000-character bound', { length: question.length });
  return question;
}

function planMaterial(plan) {
  const copy = JSON.parse(JSON.stringify(plan));
  delete copy.planDigest;
  return copy;
}

function validateResearchPlan(plan) {
  if (!plan || plan.schema !== RESEARCH_PLAN_SCHEMA || typeof plan.planDigest !== 'string') {
    throw new AxmResearchModeError('RESEARCH_PLAN_INVALID', 'a sealed AXM research plan is required');
  }
  const computed = Digest.canonicalDigest(planMaterial(plan));
  if (computed !== plan.planDigest) throw new AxmResearchModeError('RESEARCH_PLAN_DIGEST_MISMATCH', 'research plan digest does not match its material', { declared: plan.planDigest, computed });
  return plan;
}

function buildResearchPlan(input, options) {
  input = input || {};
  options = options || {};
  const question = cleanQuestion(input.question);
  const registry = Ai.validateRegistry(input.aiRegistry);
  if (!registry.researchModeEnabled) throw new AxmResearchModeError('RESEARCH_MODE_DISABLED', 'AI registry research mode is turned off');
  const mode = String(input.mode || 'search+ai').toLowerCase();
  if (!RESEARCH_MODES.has(mode)) throw new AxmResearchModeError('RESEARCH_MODE_INVALID', 'research mode must be search+ai, search-only, or ai-only', { mode });
  const visualState = input.visualState || null;
  if (visualState && visualState.schema !== Visual.VISUAL_STATE_SCHEMA) throw new AxmResearchModeError('RESEARCH_VISUAL_STATE_INVALID', 'research visual state must use the AXM visual-state schema');
  const selected = mode === 'search-only' ? [] : Ai.selectedProviders(registry, input.providerIds).filter(function (provider) { return provider.researchAccess; });
  if (mode !== 'search-only' && !selected.length) throw new AxmResearchModeError('RESEARCH_NO_AI_PROVIDER', 'no enabled research-capable AI provider is selected');
  const searchPlan = mode === 'ai-only' ? null : Search.buildSearchPlan(Object.assign({}, input.searchQuery || {}, {
    query: input.searchQuery && input.searchQuery.query ? input.searchQuery.query : question
  }), options.searchConfig || {});
  const material = {
    schema: RESEARCH_PLAN_SCHEMA,
    version: 1,
    status: 'EXPERIMENTAL',
    question,
    mode,
    aiRegistry: registry,
    aiProviderIds: selected.map(function (provider) { return provider.id; }),
    visualState,
    searchPlan,
    authority: {
      searchNetworkExecutionGranted: false,
      aiNetworkExecutionGranted: false,
      browserMutationAllowed: false,
      resultNavigationAllowed: false,
      backgroundExecutionAllowed: false,
      installAllowed: false,
      promotionAllowed: false,
      canonAllowed: false
    }
  };
  return Object.assign({}, material, { planDigest: Digest.canonicalDigest(material) });
}

function researchNotes(plan, searchExecution) {
  const searchSummary = searchExecution ? {
    status: searchExecution.status,
    providersSucceeded: searchExecution.providersSucceeded,
    providersFailed: searchExecution.providersFailed,
    estimatedExternalApiUsd: searchExecution.estimatedExternalApiUsd,
    resultCount: searchExecution.resultSet.resultCount
  } : null;
  return [
    'Research mode is bounded and source-discovery oriented.',
    'Do not treat provider ranking, snippets, agreement, or another model output as verified truth.',
    'Browser visual state is observation-only and may represent a structured screen model rather than pixels.',
    'Search execution summary: ' + JSON.stringify(searchSummary)
  ].join(' ');
}

async function executeResearchPlan(plan, options) {
  options = options || {};
  validateResearchPlan(plan);
  let searchExecution = null;
  let aiExecution = null;
  if (plan.mode !== 'ai-only') {
    const searchExecute = options.searchExecute || SearchExecutor.executeSearchPlan;
    searchExecution = await searchExecute(plan.searchPlan, Object.assign({}, options.searchOptions || {}, {
      networkAuthority: options.searchNetworkAuthority
    }));
  }
  if (plan.mode !== 'search-only') {
    const aiPlan = Ai.buildAiPlan(plan.question, plan.aiRegistry, {
      visualState: plan.visualState,
      searchResultSet: searchExecution ? searchExecution.resultSet : null,
      notes: researchNotes(plan, searchExecution)
    }, {
      providerIds: plan.aiProviderIds,
      maxOutputTokens: options.maxOutputTokens
    });
    const aiExecute = options.aiExecute || AiExecutor.executeAiPlan;
    aiExecution = await aiExecute(aiPlan, Object.assign({}, options.aiOptions || {}, {
      networkAuthority: options.aiNetworkAuthority
    }));
  }
  const material = {
    schema: RESEARCH_RUN_SCHEMA,
    version: 1,
    status: (searchExecution && searchExecution.status === 'PARTIAL') || (aiExecution && aiExecution.status === 'PARTIAL') ? 'PARTIAL' : 'PASS',
    researchPlanDigest: plan.planDigest,
    question: plan.question,
    mode: plan.mode,
    visualStateDigest: plan.visualState ? plan.visualState.visualDigest : null,
    search: searchExecution ? {
      executionDigest: searchExecution.executionDigest,
      providersSucceeded: searchExecution.providersSucceeded,
      providersFailed: searchExecution.providersFailed,
      estimatedExternalApiUsd: searchExecution.estimatedExternalApiUsd,
      resultSet: searchExecution.resultSet
    } : null,
    ai: aiExecution ? {
      executionDigest: aiExecution.executionDigest,
      providerIdsSucceeded: aiExecution.providerIdsSucceeded,
      providerIdsFailed: aiExecution.providerIdsFailed,
      outputs: aiExecution.outputs
    } : null,
    authority: {
      browserMutationAllowed: false,
      resultNavigationAllowed: false,
      backgroundExecutionUsed: false,
      searchNetworkExecutionUsed: Boolean(searchExecution),
      aiNetworkExecutionUsed: Boolean(aiExecution),
      resultContentTrusted: false,
      installAllowed: false,
      promotionAllowed: false,
      canonAllowed: false
    }
  };
  return Object.assign({}, material, { runDigest: Digest.canonicalDigest(material) });
}

module.exports = {
  RESEARCH_PLAN_SCHEMA,
  RESEARCH_RUN_SCHEMA,
  RESEARCH_MODES,
  AxmResearchModeError,
  buildResearchPlan,
  validateResearchPlan,
  executeResearchPlan
};
