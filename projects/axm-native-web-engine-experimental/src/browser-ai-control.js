'use strict';

const Digest = require('./digest');
const Ai = require('./ai-broker');
const Research = require('./research-mode');
const Visual = require('./browser-visual-state');

const BROWSER_AI_CONTROL_SCHEMA = 'axm.web.browser-ai-control-state/v1';
const CONTROL_ACTIONS = new Set([
  'shell-control-snapshot',
  'ai-provider-enabled',
  'ai-visual-access',
  'ai-active-provider',
  'ai-mode',
  'research-mode-enabled',
  'visual-report',
  'research-run'
]);
const RESEARCH_MODES = new Set(['search+ai', 'search-only', 'ai-only']);

class AxmBrowserAiControlError extends Error {
  constructor(code, message, details) {
    super(message);
    this.name = 'AxmBrowserAiControlError';
    this.code = code;
    this.details = details || {};
  }
}

function cleanMode(value, fallback) {
  const mode = String(value == null ? fallback : value).toLowerCase();
  if (!RESEARCH_MODES.has(mode)) throw new AxmBrowserAiControlError('BROWSER_RESEARCH_MODE_INVALID', 'research run mode must be search+ai, search-only, or ai-only', { mode });
  return mode;
}

function safeProviders(registry) {
  return registry.providers.map(function (provider) {
    return {
      id: provider.id,
      label: provider.label,
      adapter: provider.adapter,
      model: provider.model,
      enabled: provider.enabled,
      visualStateAccess: provider.visualStateAccess,
      researchAccess: provider.researchAccess,
      local: provider.local
    };
  });
}

class LocalBrowserAiControl {
  constructor(options) {
    options = options || {};
    this.options = Object.assign({}, options);
    this.registry = options.aiRegistry
      ? Ai.validateRegistry(options.aiRegistry)
      : Ai.createRegistry([], { mode: 'single', researchModeEnabled: false });
    this.visualState = null;
    this.visualSequence = 0;
    this.lastResearchRun = null;
    this.researchRunning = false;
  }

  canHandle(action) {
    return Boolean(action && typeof action === 'object' && CONTROL_ACTIONS.has(String(action.type || '')));
  }

  state() {
    const material = {
      schema: BROWSER_AI_CONTROL_SCHEMA,
      version: 1,
      status: 'EXPERIMENTAL',
      registryDigest: this.registry.registryDigest,
      mode: this.registry.mode,
      researchModeEnabled: this.registry.researchModeEnabled,
      activeProviderId: this.registry.activeProviderId,
      providers: safeProviders(this.registry),
      visualState: this.visualState ? {
        visualDigest: this.visualState.visualDigest,
        fidelity: this.visualState.visualFidelity,
        page: this.visualState.page,
        viewport: this.visualState.viewport,
        shell: this.visualState.shell,
        visibleEntryCount: this.visualState.visibleEntryCount
      } : null,
      researchRunning: this.researchRunning,
      lastResearchRun: this.lastResearchRun,
      authority: {
        settingsMutationLocalOnly: true,
        providerExecutionGranted: false,
        searchExecutionGranted: false,
        browserNavigationGranted: false,
        pageCodeExecuted: false,
        installAllowed: false,
        promotionAllowed: false,
        canonAllowed: false
      }
    };
    return Object.assign({}, material, { controlDigest: Digest.canonicalDigest(material) });
  }

  async apply(action, sessionSnapshot) {
    if (!this.canHandle(action)) throw new AxmBrowserAiControlError('BROWSER_AI_CONTROL_ACTION_UNKNOWN', 'unsupported browser AI control action', { type: action && action.type });
    if (action.type === 'shell-control-snapshot') return this.state();
    if (action.type === 'ai-provider-enabled') {
      this.registry = Ai.setProviderEnabled(this.registry, action.providerId, action.enabled === true);
      return this.state();
    }
    if (action.type === 'ai-visual-access') {
      this.registry = Ai.setVisualStateAccess(this.registry, action.providerId, action.enabled === true);
      return this.state();
    }
    if (action.type === 'ai-active-provider') {
      this.registry = Ai.setActiveProvider(this.registry, action.providerId);
      return this.state();
    }
    if (action.type === 'ai-mode') {
      this.registry = Ai.setRegistryMode(this.registry, action.mode);
      return this.state();
    }
    if (action.type === 'research-mode-enabled') {
      this.registry = Ai.setResearchMode(this.registry, action.enabled === true);
      return this.state();
    }
    if (action.type === 'visual-report') {
      this.visualSequence += 1;
      this.visualState = Visual.buildVisualState(sessionSnapshot, action.report || {}, { sequence: this.visualSequence });
      return this.state();
    }
    if (action.type === 'research-run') return this.runResearch(action);
    throw new AxmBrowserAiControlError('BROWSER_AI_CONTROL_ACTION_UNKNOWN', 'unsupported browser AI control action', { type: action.type });
  }

  async runResearch(action) {
    if (this.researchRunning) throw new AxmBrowserAiControlError('BROWSER_RESEARCH_BUSY', 'a browser Research Mode run is already active');
    if (!this.registry.researchModeEnabled) throw new AxmBrowserAiControlError('BROWSER_RESEARCH_DISABLED', 'Research Mode is turned off');
    const question = String(action.question == null ? '' : action.question).trim();
    if (!question) throw new AxmBrowserAiControlError('BROWSER_RESEARCH_QUESTION_REQUIRED', 'Research Mode requires a question');
    if (question.length > 4000) throw new AxmBrowserAiControlError('BROWSER_RESEARCH_QUESTION_LIMIT', 'Research Mode question exceeds the 4000-character bound');
    const mode = cleanMode(action.mode, 'search+ai');
    if (typeof this.options.researchRunner !== 'function' && !this.options.researchConfig) {
      throw new AxmBrowserAiControlError('BROWSER_RESEARCH_EXECUTION_UNCONFIGURED', 'browser Research Mode execution is not configured on this host');
    }
    this.researchRunning = true;
    try {
      let result;
      if (typeof this.options.researchRunner === 'function') {
        result = await this.options.researchRunner({
          question,
          mode,
          aiRegistry: this.registry,
          visualState: this.visualState
        });
      } else {
        const config = this.options.researchConfig || {};
        const plan = Research.buildResearchPlan({
          question,
          mode,
          aiRegistry: this.registry,
          visualState: this.visualState,
          searchQuery: action.searchQuery || null,
          providerIds: Array.isArray(action.providerIds) ? action.providerIds : null
        }, { searchConfig: config.searchConfig || {} });
        result = await Research.executeResearchPlan(plan, {
          searchNetworkAuthority: config.searchNetworkAuthority,
          aiNetworkAuthority: config.aiNetworkAuthority,
          searchOptions: config.searchOptions || {},
          aiOptions: config.aiOptions || {},
          maxOutputTokens: config.maxOutputTokens
        });
      }
      if (!result || result.schema !== Research.RESEARCH_RUN_SCHEMA) {
        throw new AxmBrowserAiControlError('BROWSER_RESEARCH_RESULT_INVALID', 'Research Mode runner returned no valid AXM research run');
      }
      this.lastResearchRun = result;
    } finally {
      this.researchRunning = false;
    }
    return this.state();
  }
}

module.exports = {
  BROWSER_AI_CONTROL_SCHEMA,
  CONTROL_ACTIONS,
  AxmBrowserAiControlError,
  LocalBrowserAiControl
};
