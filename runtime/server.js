'use strict';

const crypto = require('crypto');
const fs = require('fs');
const http = require('http');
const path = require('path');
const { reason, rootHash } = require('../kernel/principle-cell');
const ReasoningFoundation = require('../kernel/reasoning-foundation');
const FrontierCell = require('../kernel/frontier-cell');
const OrganAdmission = require('../kernel/organ-admission-cell');
const ReasoningStrategyOrgan = require('../organs/reasoning-strategy-organ');
const ReasoningExperienceOrgan = require('../organs/reasoning-experience-organ');
const ReasoningContractCurriculumOrgan = require('../organs/reasoning-contract-curriculum-organ');
const ReasoningHandoffGraphOrgan = require('../organs/reasoning-handoff-graph-organ');
const ReasoningRouteReadinessOrgan = require('../organs/reasoning-route-readiness-organ');
const ReasoningReadinessHandOrgan = require('../organs/reasoning-readiness-hand-organ');
const ReasoningReadinessProbeAffordanceOrgan = require('../organs/reasoning-readiness-probe-affordance-organ');
const ProviderDeclarationGapCell = require('../kernel/provider-declaration-gap-cell');
const ProviderDeclarationHandOrgan = require('../organs/provider-declaration-hand-organ');
const ProviderDeclarationResearchExamOrgan = require('../organs/provider-declaration-research-exam-organ');
const ProviderDeclarationArchitecturePatternCell = require('../kernel/provider-declaration-architecture-pattern-cell');
const ProviderDeclarationArchitectureSurveyOrgan = require('../organs/provider-declaration-architecture-survey-organ');
const ProviderImplementationEvidenceCell = require('../kernel/provider-implementation-evidence-cell');
const ProviderDeclarationImplementationEvidenceSurveyOrgan = require('../organs/provider-declaration-implementation-evidence-survey-organ');
const ProviderBindingExperimentCell = require('../kernel/provider-binding-experiment-cell');
const ProviderDeclarationBindingExperimentPlannerOrgan = require('../organs/provider-declaration-binding-experiment-planner-organ');
const ProviderDeclarationResearchExecutorRecipeCell = require('../kernel/provider-declaration-research-executor-recipe-cell');
const ProviderDeclarationResearchExecutorReviewOrgan = require('../organs/provider-declaration-research-executor-review-organ');
const ProviderDeclarationResearchExecutorBuilderOrgan = require('../organs/provider-declaration-research-executor-builder-organ');
const ReasoningReadinessProbeReviewOrgan = require('../organs/reasoning-readiness-probe-review-organ');
const ReasoningReadinessProbeBuilderOrgan = require('../organs/reasoning-readiness-probe-builder-organ');
const ContractHandoffCell = require('../kernel/contract-handoff-cell');
const ContractManifestBindingCell = require('../kernel/contract-manifest-binding-cell');
const RouteReadinessCell = require('../kernel/route-readiness-cell');
const ReadinessGapCell = require('../kernel/readiness-gap-cell');
const ReadinessProbeRecipeCell = require('../kernel/readiness-probe-recipe-cell');
const ReasoningCounterexampleOrgan = require('../organs/reasoning-counterexample-organ');
const ReasoningMetamorphicOrgan = require('../organs/reasoning-metamorphic-organ');
const StudioCandidateOrgan = require('../organs/studio-candidate-organ');
const WorldGenomeOrgan = require('../organs/world-genome-organ');
const WorkshopActionFeed = require('../training/workshop-action-feed');
const WorkshopRoot = require('../config/workshop-root');
const { createTraceStore } = require('./trace-store');
const { startWorkshopHeartbeat } = require('../adapters/workshop/workshop-heartbeat');
const TechnicalGlasses = require('../adapters/workshop/technical-glasses-reader');

const ROOT = path.resolve(__dirname, '..');

function readConfig() {
  const defaults = JSON.parse(fs.readFileSync(path.join(ROOT, 'config', 'mirror.config.example.json'), 'utf8'));
  const local = path.join(ROOT, 'config', 'mirror.config.local.json');
  let override = {};
  try { override = JSON.parse(fs.readFileSync(local, 'utf8')); } catch (_) {}
  return Object.assign({}, defaults, override, {
    host: process.env.AXM_MIRROR_HOST || override.host || defaults.host,
    port: Number(process.env.AXM_MIRROR_PORT || override.port || defaults.port),
    workshopUrl: process.env.AXM_WORKSHOP_URL || override.workshopUrl || defaults.workshopUrl
  });
}

function ensureToken(file, supplied) {
  if (supplied) return String(supplied);
  try {
    const existing = fs.readFileSync(file, 'utf8').trim();
    if (existing.length >= 32) return existing;
  } catch (_) {}
  const token = crypto.randomBytes(32).toString('hex');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, token + '\n', { encoding: 'utf8', mode: 0o600 });
  return token;
}

function safeEqual(a, b) {
  const left = Buffer.from(String(a || ''));
  const right = Buffer.from(String(b || ''));
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function createMirrorRuntime(options = {}) {
  const config = Object.assign(readConfig(), options.config || {});
  if (!['127.0.0.1', 'localhost', '::1'].includes(config.host)) throw new Error('Mirror Seed-0 refuses a non-loopback bind');
  if (!Number.isInteger(Number(config.port)) || Number(config.port) < 0 || Number(config.port) > 65535) throw new Error('AXM_MIRROR_PORT must be an integer from 0 through 65535');
  const tokenFile = options.tokenFile || path.join(ROOT, 'state', 'runtime-token.txt');
  const token = ensureToken(tokenFile, options.token);
  const traceStore = createTraceStore({ file: options.persist === false ? null : path.join(ROOT, 'state', 'traces.jsonl') });
  const sessions = new Map();
  const rate = new Map();
  let heartbeat = null;
  let server = null;
  let practiceTimer = null;
  let practiceStatus = {
    enabled: config.automaticPracticeOnStart !== false,
    state: config.automaticPracticeOnStart !== false ? 'PENDING_START' : 'DISABLED',
    lastReportId: null,
    lastCycleId: null,
    lastReasoningCycleId: null,
    lastHandoffGraphBatchId: null,
    handoffGraphEligibleContracts: 0,
    handoffGraphManifestBindingsPassed: 0,
    handoffGraphManifestBindingsFailed: 0,
    handoffGraphUndeclaredContractFiles: 0,
    handoffGraphExactEdges: 0,
    handoffGraphDirectRoutes: 0,
    handoffGraphComposedRoutes: 0,
    handoffGraphExactRoutesSelected: 0,
    handoffGraphUnboundDecoysRejected: 0,
    handoffGraphRouteMismatches: 0,
    handoffGraphTrainingReceipts: 0,
    handoffGraphWorldActions: 0,
    lastRouteReadinessBatchId: null,
    routeReadinessGraphRoutes: 0,
    routeReadinessGraphModules: 0,
    routeReadinessRequirements: 0,
    routeReadinessReadyRoutes: 0,
    routeReadinessAvailableRoutes: 0,
    routeReadinessNeedsActionRoutes: 0,
    routeReadinessBlockedRoutes: 0,
    routeReadinessClassificationMismatches: 0,
    routeReadinessTrainingReceipts: 0,
    routeReadinessWorldActions: 0,
    lastReadinessHandBatchId: null,
    readinessHandUnknownRequirements: 0,
    readinessHandRequests: 0,
    readinessHandInspectionHolds: 0,
    readinessHandImpactedRoutes: 0,
    readinessHandClassificationMismatches: 0,
    readinessHandCodeFilesGenerated: 0,
    readinessHandProbesInstalled: 0,
    readinessHandServicesStartedOrRepaired: 0,
    readinessHandTrainingReceipts: 0,
    readinessHandWorldActions: 0,
    lastReadinessProbeAffordanceBatchId: null,
    readinessProbeAffordanceHandsAssessed: 0,
    readinessProbeAffordanceReviewPackets: 0,
    readinessProbeAffordanceHolds: 0,
    readinessProbeAffordanceNameInferencesRejected: 0,
    readinessProbeAffordanceFalseReadyRejected: 0,
    readinessProbeAffordanceHumanReviews: 0,
    readinessProbeAffordanceRecipesSealed: 0,
    readinessProbeAffordanceCandidatesBuilt: 0,
    readinessProbeAffordanceLiveExecutions: 0,
    readinessProbeAffordanceWorkshopFilesChanged: 0,
    lastProviderDeclarationHandBatchId: null,
    providerDeclarationAffordanceAssessments: 0,
    providerDeclarationHandsProposed: 0,
    providerDeclarationsPresentNoGap: 0,
    providerDeclarationHolds: 0,
    providerDeclarationInferencesRejected: 0,
    providerDeclarationFalseAvailableRejected: 0,
    providerDeclarationCandidateFiles: 0,
    providerDeclarationsWritten: 0,
    providerDeclarationLiveExecutions: 0,
    providerDeclarationWorkshopFilesChanged: 0,
    lastProviderDeclarationResearchExamBatchId: null,
    providerDeclarationResearchHandResults: 0,
    providerDeclarationResearchExamsProposed: 0,
    providerDeclarationResearchFrontierExamRequired: 0,
    providerDeclarationResearchProviderBuildsRejected: 0,
    providerDeclarationResearchFalseResolutionsRejected: 0,
    providerDeclarationResearchArchitecturesSelected: 0,
    providerDeclarationResearchExecutorsBuilt: 0,
    providerDeclarationResearchFixtureFiles: 0,
    providerDeclarationResearchProviderCandidates: 0,
    providerDeclarationResearchDeclarationsWritten: 0,
    providerDeclarationResearchLiveExperiments: 0,
    providerDeclarationResearchWorkshopFilesChanged: 0,
    lastProviderDeclarationResearchExecutorBatchId: null,
    providerDeclarationResearchExecutorReviewedRecipes: 0,
    providerDeclarationResearchExecutorCandidatesBuilt: 0,
    providerDeclarationResearchExecutorCandidateFiles: 0,
    providerDeclarationResearchExecutorFixtureCases: 0,
    providerDeclarationResearchExecutorArchitecturesSelected: 0,
    providerDeclarationResearchExecutorArchitecturesEvaluated: 0,
    providerDeclarationResearchExecutorProviderCandidates: 0,
    providerDeclarationResearchExecutorWorkshopFilesChanged: 0,
    providerDeclarationResearchExecutorTrainingReceipts: 0,
    lastProviderDeclarationArchitectureSurveyBatchId: null,
    providerDeclarationArchitectureSurveyResearchResults: 0,
    providerDeclarationArchitectureSurveysProposed: 0,
    providerDeclarationArchitectureSurveyDocuments: 0,
    providerDeclarationArchitectureSurveyRelevantPatterns: 0,
    providerDeclarationArchitectureSurveyCompleteWitnesses: 0,
    providerDeclarationArchitectureSurveyHypothesesUntested: 0,
    providerDeclarationArchitectureSurveyFrequencySelectionsRejected: 0,
    providerDeclarationArchitectureSurveyCrossDocumentMergesRejected: 0,
    providerDeclarationArchitectureSurveyArchitecturesSelected: 0,
    providerDeclarationArchitectureSurveyArchitecturesEvaluated: 0,
    providerDeclarationArchitectureSurveyProviderCandidates: 0,
    providerDeclarationArchitectureSurveyWorkshopFilesChanged: 0,
    providerDeclarationArchitectureSurveyTrainingReceipts: 0,
    lastProviderDeclarationImplementationEvidenceSurveyBatchId: null,
    providerDeclarationImplementationEvidenceArchitectureResults: 0,
    providerDeclarationImplementationEvidenceSurveysProposed: 0,
    providerDeclarationImplementationEvidenceSources: 0,
    providerDeclarationImplementationEvidenceSelectorSources: 0,
    providerDeclarationImplementationEvidenceSelectorsWitnessed: 0,
    providerDeclarationImplementationEvidenceProviderInferencesRejected: 0,
    providerDeclarationImplementationEvidenceFrequencySelectionsRejected: 0,
    providerDeclarationImplementationEvidenceProvidersInferred: 0,
    providerDeclarationImplementationEvidenceOuterRequirementsBound: 0,
    providerDeclarationImplementationEvidenceImplementationsSelected: 0,
    providerDeclarationImplementationEvidenceSourcesExecuted: 0,
    providerDeclarationImplementationEvidenceArchitecturesSelected: 0,
    providerDeclarationImplementationEvidenceArchitecturesEvaluated: 0,
    providerDeclarationImplementationEvidenceProviderCandidates: 0,
    providerDeclarationImplementationEvidenceWorkshopFilesChanged: 0,
    providerDeclarationImplementationEvidenceTrainingReceipts: 0,
    lastProviderDeclarationBindingExperimentBatchId: null,
    providerDeclarationBindingExperimentImplementationResults: 0,
    providerDeclarationBindingExperimentMatrices: 0,
    providerDeclarationBindingExperimentCandidateSources: 0,
    providerDeclarationBindingExperimentValidationWitnesses: 0,
    providerDeclarationBindingExperimentHypotheses: 0,
    providerDeclarationBindingExperimentFrames: 0,
    providerDeclarationBindingExperimentFrameSelectionsRejected: 0,
    providerDeclarationBindingExperimentPermissionCopiesRejected: 0,
    providerDeclarationBindingExperimentFramesSelected: 0,
    providerDeclarationBindingExperimentProvidersInferred: 0,
    providerDeclarationBindingExperimentPermissionsInferred: 0,
    providerDeclarationBindingExperimentSourcesExecuted: 0,
    providerDeclarationBindingExperimentProviderCandidates: 0,
    providerDeclarationBindingExperimentWorkshopFilesChanged: 0,
    providerDeclarationBindingExperimentTrainingReceipts: 0,
    lastReadinessProbeCandidateBatchId: null,
    readinessProbeReviewedRecipes: 0,
    readinessProbeCandidatesBuilt: 0,
    readinessProbeCandidateCodeFiles: 0,
    readinessProbeFixtureSuitesPassed: 0,
    readinessProbeFixtureSuitesFailed: 0,
    readinessProbeProbesInstalled: 0,
    readinessProbeLiveExecutions: 0,
    readinessProbeWorkshopFilesChanged: 0,
    readinessProbeTrainingReceipts: 0,
    readinessProbeWorldActions: 0,
    lastContractCurriculumBatchId: null,
    contractEligibleContracts: 0,
    contractPrivateTrainingExams: 0,
    contractHeldOutExams: 0,
    contractBoundariesPreserved: 0,
    contractBoundaryMismatches: 0,
    contractHeldOutChallengerPassed: 0,
    contractHeldOutChallengerFailed: 0,
    contractHeldOutTrainingReceipts: 0,
    lastCounterexampleBatchId: null,
    lastMetamorphicBatchId: null,
    metamorphicProbes: 0,
    metamorphicAtomicProbes: 0,
    metamorphicComposedProbes: 0,
    metamorphicInvariantConfirmed: 0,
    metamorphicCounterexamplesFound: 0,
    metamorphicNegativeReceipts: 0,
    lastFailureCurriculumBatchId: null,
    failureCurriculumRealPositiveReceipts: 0,
    failureCurriculumRealNegativeReceipts: 0,
    failureCurriculumDistinctSignatures: 0,
    failureCurriculumRecurrentSignatures: 0,
    failureCurriculumRequests: 0,
    failureCurriculumRecurrenceHolds: 0,
    failureCurriculumTrainingAdmissions: 0,
    failureCurriculumCodeBuilds: 0,
    failureCurriculumOrgansInstalled: 0,
    realLocalReasoningReceipts: 0,
    syntheticCounterexampleReceipts: 0,
    contractDerivedExamReceipts: 0,
    excludedKnownFailReceipts: 0,
    lastError: null
  };
  let actualPort = Number(config.port);
  const startedAt = new Date().toISOString();
  const allowedOrigins = new Set(Array.isArray(config.allowedOrigins) ? config.allowedOrigins : []);
  const actionFeedOptions = options.actionFeedOptions || {};
  const reasoningExperienceOptions = options.reasoningExperienceOptions || {};
  const handoffGraphOptions = Object.assign({ root: ROOT, workshopRoot: WorkshopRoot.resolve({ config, configRoot: ROOT }) }, options.handoffGraphOptions || {});
  const routeReadinessOptions = Object.assign({
    root: handoffGraphOptions.root,
    workshopRoot: handoffGraphOptions.workshopRoot,
    stateDir: path.join(path.resolve(handoffGraphOptions.root), 'state', 'reasoning-route-readiness-runs')
  }, options.routeReadinessOptions || {});
  const readinessHandOptions = Object.assign({
    root: handoffGraphOptions.root,
    workshopRoot: handoffGraphOptions.workshopRoot,
    stateDir: path.join(path.resolve(handoffGraphOptions.root), 'state', 'reasoning-readiness-hand-runs')
  }, options.readinessHandOptions || {});
  const readinessProbeBuilderOptions = Object.assign({
    root: handoffGraphOptions.root,
    workshopRoot: handoffGraphOptions.workshopRoot,
    stateDir: path.join(path.resolve(handoffGraphOptions.root), 'state', 'reasoning-readiness-probe-builder-runs')
  }, options.readinessProbeBuilderOptions || {});
  const readinessProbeAffordanceOptions = Object.assign({
    root: handoffGraphOptions.root,
    workshopRoot: handoffGraphOptions.workshopRoot,
    stateDir: path.join(path.resolve(handoffGraphOptions.root), 'state', 'reasoning-readiness-probe-affordance-runs')
  }, options.readinessProbeAffordanceOptions || {});
  const providerDeclarationHandOptions = Object.assign({
    root: handoffGraphOptions.root,
    workshopRoot: handoffGraphOptions.workshopRoot,
    stateDir: path.join(path.resolve(handoffGraphOptions.root), 'state', 'provider-declaration-hand-runs')
  }, options.providerDeclarationHandOptions || {});
  const providerDeclarationResearchExamOptions = Object.assign({
    root: handoffGraphOptions.root,
    workshopRoot: handoffGraphOptions.workshopRoot,
    stateDir: path.join(path.resolve(handoffGraphOptions.root), 'state', 'provider-declaration-research-exam-runs')
  }, options.providerDeclarationResearchExamOptions || {});
  const providerDeclarationResearchExecutorBuilderOptions = Object.assign({
    root: handoffGraphOptions.root,
    workshopRoot: handoffGraphOptions.workshopRoot,
    stateDir: path.join(path.resolve(handoffGraphOptions.root), 'state', 'provider-declaration-research-executor-builder-runs')
  }, options.providerDeclarationResearchExecutorBuilderOptions || {});
  const providerDeclarationArchitectureSurveyOptions = Object.assign({
    root: handoffGraphOptions.root,
    workshopRoot: handoffGraphOptions.workshopRoot,
    stateDir: path.join(path.resolve(handoffGraphOptions.root), 'state', 'provider-declaration-architecture-survey-runs')
  }, options.providerDeclarationArchitectureSurveyOptions || {});
  const providerDeclarationImplementationEvidenceSurveyOptions = Object.assign({
    root: handoffGraphOptions.root,
    workshopRoot: handoffGraphOptions.workshopRoot,
    stateDir: path.join(path.resolve(handoffGraphOptions.root), 'state', 'provider-declaration-implementation-evidence-survey-runs')
  }, options.providerDeclarationImplementationEvidenceSurveyOptions || {});
  const providerDeclarationBindingExperimentOptions = Object.assign({
    root: handoffGraphOptions.root,
    workshopRoot: handoffGraphOptions.workshopRoot,
    stateDir: path.join(path.resolve(handoffGraphOptions.root), 'state', 'provider-declaration-binding-experiment-runs')
  }, options.providerDeclarationBindingExperimentOptions || {});

  function corsHeaders(req) {
    const origin = String(req.headers.origin || '');
    return origin && allowedOrigins.has(origin) ? {
      'access-control-allow-origin': origin,
      'vary': 'Origin',
      'access-control-allow-headers': 'authorization, content-type, x-axm-mirror-action',
      'access-control-allow-methods': 'GET, POST, OPTIONS'
    } : {};
  }

  function send(req, res, status, body) {
    res.writeHead(status, Object.assign({
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
      'x-frame-options': 'DENY'
    }, corsHeaders(req)));
    res.end(body == null ? '' : JSON.stringify(body));
  }

  function limited(req) {
    const key = req.socket.remoteAddress || 'local';
    const minute = Math.floor(Date.now() / 60000);
    const entry = rate.get(key);
    const next = !entry || entry.minute !== minute ? { minute, count: 1 } : { minute, count: entry.count + 1 };
    rate.set(key, next);
    return next.count > Math.max(10, Number(config.requestsPerMinute) || 120);
  }

  function authorized(req) {
    const header = String(req.headers.authorization || '');
    return header.startsWith('Bearer ') && safeEqual(header.slice(7), token);
  }

  function readJson(req) {
    return new Promise((resolve, reject) => {
      let body = '';
      let ended = false;
      req.setEncoding('utf8');
      req.on('data', chunk => {
        if (ended) return;
        body += chunk;
        if (Buffer.byteLength(body) > (Number(config.requestBodyLimitBytes) || 262144)) {
          ended = true;
          reject(Object.assign(new Error('request body too large'), { status: 413 }));
          req.destroy();
        }
      });
      req.on('end', () => {
        if (ended) return;
        try { resolve(JSON.parse(body || '{}')); }
        catch (_) { reject(Object.assign(new Error('invalid JSON body'), { status: 400 })); }
      });
      req.on('error', error => { if (!ended) reject(error); });
    });
  }

  async function deriveCurrentReadiness() {
    const handoffDerived = ReasoningHandoffGraphOrgan.derive(handoffGraphOptions);
    let snapshot = routeReadinessOptions.snapshot || null;
    let observationRefresh = { state: snapshot ? 'INJECTED_TYPED_SNAPSHOT' : 'FILE_SNAPSHOT_FALLBACK', source: null, error: null };
    if (!snapshot && routeReadinessOptions.refresh !== false) {
      try {
        const observed = await TechnicalGlasses.observe({ baseUrl: config.workshopUrl, focus: 'mirror-route-readiness' });
        snapshot = observed.snapshot;
        observationRefresh = { state: 'REFRESHED_READ_ONLY_TECHNICAL_GLASSES', source: observed.source, error: null };
      } catch (error) {
        observationRefresh.error = String(error.message || error).slice(0, 500);
      }
    }
    const readinessDerived = ReasoningRouteReadinessOrgan.derive(Object.assign({}, routeReadinessOptions, { handoffDerived, snapshot }));
    return { handoffDerived, readinessDerived, observationRefresh };
  }

  function publicHealth() {
    return {
      ok: true,
      schema: 'axm.mirror.health/v1',
      identity: 'axm.machine.mirror/seed-0',
      displayName: 'Mirror',
      providerId: 'mirror-kernel',
      version: '0.0.0-seed',
      body: 'DETERMINISTIC_KERNEL',
      learnedWeights: false,
      languageOrgan: false,
      candidateOrgan: {
        id: StudioCandidateOrgan.ORGAN_ID,
        status: 'EXPERIMENTAL',
        scope: 'bounded-studio-proposals',
        learnedWeights: false,
        toolAuthority: false
      },
      worldGenomeOrgan: {
        id: WorldGenomeOrgan.ORGAN_ID,
        status: 'EXPERIMENTAL',
        scope: 'disposable-grafthold-world-genome',
        learnedWeights: false,
        toolAuthority: false,
        selfModification: 'DISPOSABLE_WORLD_GENOME_ONLY'
      },
      frontierCell: {
        id: FrontierCell.CELL_ID,
        status: 'EXPERIMENTAL',
        scope: 'evidence-linked-capability-and-exam-proposals',
        automaticPromotion: false,
        toolAuthority: false
      },
      reasoningFoundation: {
        id: ReasoningFoundation.CELL_ID,
        status: 'EXPERIMENTAL',
        scope: 'inspectable-problem-decomposition-path-comparison-verification-memory-routing-and-development-proposals',
        learnedWeights: false,
        automaticPromotion: false,
        toolAuthority: false,
        memoryWriteAuthority: false
      },
      reasoningStrategyOrgan: {
        id: ReasoningStrategyOrgan.ORGAN_ID,
        status: 'PRIVATE_CHALLENGER_NOT_LOADED',
        scope: 'learned-non-mutating-epistemic-candidate-origination',
        activeRuntime: false,
        toolAuthority: false,
        worldMutationAuthority: false
      },
      reasoningExperienceOrgan: {
        id: ReasoningExperienceOrgan.ORGAN_ID,
        status: 'WORKING_PRIVATE_APPEND_ONLY',
        scope: 'verified-deterministic-real-synthetic-and-contract-derived-positive-and-negative-episodic-reasoning-receipt-intake',
        automaticShellCapture: true,
        semanticTruthWriteAuthority: false,
        positiveAndNegativeEpisodicEvidence: true,
        learnedSelfTraining: false,
        overwriteAuthority: false,
        heldOutMutationAuthority: false,
        activeModelChangeAuthority: false,
        runtimePromotionAuthority: false
      },
      reasoningContractCurriculumOrgan: {
        id: ReasoningContractCurriculumOrgan.ORGAN_ID,
        status: 'TEST_PRIVATE_TYPED_CONTRACT_CURRICULUM_V2',
        scope: 'typed-boundaries-refuses-discovery-private-training-and-stable-contract-level-held-out-transfer',
        learnedWeights: false,
        generatedHumanWordingAuthority: false,
        heldOutTrainingAuthority: false,
        learnedSelfGrading: false,
        maximumContracts: ReasoningContractCurriculumOrgan.MAX_CONTRACTS,
        realWorldOutcomeAuthority: false,
        semanticTruthWriteAuthority: false,
        toolAuthority: false,
        worldMutationAuthority: false,
        runtimePromotionAuthority: false
      },
      contractHandoffCompatibilityCell: {
        id: ContractHandoffCell.CELL_ID,
        status: 'WORKING_EXACT_TYPED_MEMBERSHIP',
        scope: 'producer-handoffs-emits-to-consumer-handoffs-accepts-exact-equality',
        learnedWeights: false,
        candidateGenerationAuthority: false,
        toolAuthority: false,
        worldMutationAuthority: false
      },
      contractManifestBindingCell: {
        id: ContractManifestBindingCell.CELL_ID,
        status: 'WORKING_EXACT_MANIFEST_TO_CONTRACT_BINDING',
        scope: 'content-digested-manifest-declaration-id-and-permission-declaration-coverage',
        learnedWeights: false,
        candidateGenerationAuthority: false,
        permissionGrantAuthority: false,
        runtimeReadinessClaimAuthority: false,
        contractWriteAuthority: false,
        manifestWriteAuthority: false,
        toolAuthority: false,
        worldMutationAuthority: false
      },
      reasoningHandoffGraphOrgan: {
        id: ReasoningHandoffGraphOrgan.ORGAN_ID,
        status: 'TEST_MANIFEST_BOUND_PROPOSAL_ONLY_TYPED_HANDOFF_GRAPH',
        scope: 'automatic-manifest-bound-exact-one-hop-and-depth-two-workshop-module-route-proposals',
        learnedWeights: false,
        maximumContracts: ReasoningHandoffGraphOrgan.MAX_CONTRACTS,
        maximumEdges: ReasoningHandoffGraphOrgan.MAX_EDGES,
        maximumRoutes: ReasoningHandoffGraphOrgan.MAX_ROUTES,
        maximumDepth: ReasoningHandoffGraphOrgan.MAX_DEPTH,
        consumesRequiredInputInference: false,
        runtimeReadinessClaimAuthority: false,
        permissionGrantAuthority: false,
        trainingAdmissionAuthority: false,
        realWorldOutcomeAuthority: false,
        semanticTruthWriteAuthority: false,
        toolAuthority: false,
        worldMutationAuthority: false,
        runtimePromotionAuthority: false
      },
      routeReadinessCell: {
        id: RouteReadinessCell.CELL_ID,
        status: 'WORKING_EXACT_TECHNICAL_GLASSES_READINESS_ORDERING',
        scope: 'typed-route-requirements-with-unknown-offline-tripped-blocking-before-user-action-and-availability',
        learnedWeights: false,
        automaticStartAuthority: false,
        automaticRepairAuthority: false,
        permissionGrantAuthority: false,
        trainingAdmissionAuthority: false,
        toolAuthority: false,
        worldMutationAuthority: false
      },
      reasoningRouteReadinessOrgan: {
        id: ReasoningRouteReadinessOrgan.ORGAN_ID,
        status: 'TEST_DYNAMIC_TYPED_READINESS_OVERLAY',
        scope: 'fresh-technical-glasses-readiness-over-manifest-bound-static-routes',
        learnedWeights: false,
        maximumRoutes: ReasoningRouteReadinessOrgan.MAX_ROUTES,
        maximumModules: ReasoningRouteReadinessOrgan.MAX_MODULES,
        maximumSnapshotAgeMs: ReasoningRouteReadinessOrgan.MAX_SNAPSHOT_AGE_MS,
        automaticStartAuthority: false,
        automaticRepairAuthority: false,
        permissionGrantAuthority: false,
        readinessMutationAuthority: false,
        trainingAdmissionAuthority: false,
        toolAuthority: false,
        worldMutationAuthority: false,
        runtimePromotionAuthority: false
      },
      readinessGapCell: {
        id: ReadinessGapCell.CELL_ID,
        status: 'WORKING_MISSING_PROBE_VERSUS_OTHER_UNKNOWN_DISTINCTION',
        scope: 'manifest-bound-unknown-readiness-gap-assessment-and-route-impact-only',
        learnedWeights: false,
        readinessClaimAuthority: false,
        probeCodeGenerationAuthority: false,
        installAuthority: false,
        automaticRepairAuthority: false,
        permissionGrantAuthority: false,
        trainingAdmissionAuthority: false,
        toolAuthority: false,
        worldMutationAuthority: false
      },
      reasoningReadinessHandOrgan: {
        id: ReasoningReadinessHandOrgan.ORGAN_ID,
        status: 'TEST_AUTOMATIC_MISSING_READINESS_HAND_PLANNER',
        scope: 'unknown-readiness-gap-aggregation-to-reviewable-nonbuilt-probe-contract-requests',
        learnedWeights: false,
        maximumGaps: ReasoningReadinessHandOrgan.MAX_GAPS,
        maximumProposals: ReasoningReadinessHandOrgan.MAX_PROPOSALS,
        readinessClaimAuthority: false,
        probeCodeGenerationAuthority: false,
        fileWriteAuthority: false,
        installAuthority: false,
        automaticStartAuthority: false,
        automaticRepairAuthority: false,
        permissionGrantAuthority: false,
        trainingAdmissionAuthority: false,
        toolAuthority: false,
        worldMutationAuthority: false,
        runtimePromotionAuthority: false
      },
      reasoningReadinessProbeAffordanceOrgan: {
        id: ReasoningReadinessProbeAffordanceOrgan.ORGAN_ID,
        status: 'TEST_EXACT_PROVIDER_DECLARATION_AFFORDANCE_PLANNER',
        scope: 'exact-manifest-bound-module-shared-service-or-foundation-service-plane-provider-declaration-to-human-review-packet',
        learnedWeights: false,
        maximumHands: ReasoningReadinessProbeAffordanceOrgan.MAX_HANDS,
        positiveStateCeiling: 'AVAILABLE',
        humanReviewAuthority: false,
        recipeSealAuthority: false,
        candidateWriteAuthority: false,
        readinessClaimAuthority: false,
        workshopWriteAuthority: false,
        liveExecutionAuthority: false,
        installAuthority: false,
        automaticStartAuthority: false,
        automaticRepairAuthority: false,
        permissionGrantAuthority: false,
        trainingAdmissionAuthority: false,
        runtimePromotionAuthority: false
      },
      providerDeclarationGapCell: {
        id: ProviderDeclarationGapCell.CELL_ID,
        status: 'WORKING_EXACT_CONSUMER_PROVIDER_RELATION_CLASSIFIER',
        scope: 'exact-consumer-bound-zero-provider-declaration-gap-classification',
        learnedWeights: false,
        providerIdentityInferenceAuthority: false,
        declarationSchemaSelectionAuthority: false,
        declarationPathSelectionAuthority: false,
        readinessClaimAuthority: false,
        workshopWriteAuthority: false
      },
      providerDeclarationHandOrgan: {
        id: ProviderDeclarationHandOrgan.ORGAN_ID,
        status: 'TEST_AUTOMATIC_NONBUILT_PROVIDER_DECLARATION_GAP_HAND_PLANNER',
        scope: 'consumer-bound-zero-provider-hold-to-nonbuilt-steward-declaration-hand',
        learnedWeights: false,
        maximumAssessments: ProviderDeclarationHandOrgan.MAX_ASSESSMENTS,
        providerIdentityInferenceAuthority: false,
        declarationSchemaSelectionAuthority: false,
        declarationPathSelectionAuthority: false,
        declarationCandidateWriteAuthority: false,
        providerContractWriteAuthority: false,
        workshopWriteAuthority: false,
        readinessClaimAuthority: false,
        permissionGrantAuthority: false,
        liveExecutionAuthority: false,
        trainingAdmissionAuthority: false,
        runtimePromotionAuthority: false
      },
      providerDeclarationResearchExamOrgan: {
        id: ProviderDeclarationResearchExamOrgan.ORGAN_ID,
        status: 'TEST_AUTOMATIC_INDEPENDENT_PROVIDER_DECLARATION_RESEARCH_EXAM_PLANNER',
        scope: 'verified-nonbuilt-provider-declaration-hand-to-independent-architecture-research-exam-request',
        learnedWeights: false,
        maximumResults: ProviderDeclarationResearchExamOrgan.MAX_RESULTS,
        architectureSelectionAuthority: false,
        expectedOutcomeMutationAuthority: false,
        heldOutFixtureAuthoringByCandidateAuthority: false,
        examExecutorBuildAuthority: false,
        fixtureFileGenerationAuthority: false,
        providerCandidateBuildAuthority: false,
        providerContractWriteAuthority: false,
        workshopWriteAuthority: false,
        readinessClaimAuthority: false,
        liveExecutionAuthority: false,
        trainingAdmissionAuthority: false,
        runtimePromotionAuthority: false
      },
      providerDeclarationResearchExecutorRecipeCell: {
        id: ProviderDeclarationResearchExecutorRecipeCell.CELL_ID,
        status: 'WORKING_FIXED_REVIEW_BOUND_RESEARCH_EXECUTOR_RECIPE_ADMISSION',
        scope: 'exact-exam-digest-attributed-human-review-to-fixed-ignored-state-relation-executor-admission',
        learnedWeights: false,
        architectureSelectionAuthority: false,
        candidateWriteAuthority: false,
        sandboxFixtureExecutionAuthority: false,
        liveArchitectureEvaluationAuthority: false,
        providerBuildAuthority: false,
        workshopWriteAuthority: false,
        installAuthority: false,
        trainingAdmissionAuthority: false,
        runtimePromotionAuthority: false
      },
      providerDeclarationResearchExecutorReviewOrgan: {
        id: ProviderDeclarationResearchExecutorReviewOrgan.ORGAN_ID,
        status: 'TEST_CURRENT_EXAM_HUMAN_REVIEW_DIGEST_BRIDGE',
        scope: 'attributed-human-decision-to-current-exam-bound-fixed-executor-recipe-without-build',
        learnedWeights: false,
        humanDecisionAuthority: false,
        architectureSelectionAuthority: false,
        executorBuildAuthority: false,
        candidateWriteAuthority: false,
        liveArchitectureEvaluationAuthority: false,
        providerBuildAuthority: false,
        workshopWriteAuthority: false,
        installAuthority: false,
        trainingAdmissionAuthority: false,
        runtimePromotionAuthority: false
      },
      providerDeclarationResearchExecutorBuilderOrgan: {
        id: ProviderDeclarationResearchExecutorBuilderOrgan.ORGAN_ID,
        status: 'TEST_REVIEW_BOUND_DISPOSABLE_PROVIDER_DECLARATION_RESEARCH_EXECUTOR_BUILDER',
        scope: 'reviewed-fixed-relation-executor-to-ignored-state-candidate-and-ten-preauthored-synthetic-fixtures',
        learnedWeights: false,
        maximumRecipes: ProviderDeclarationResearchExecutorBuilderOrgan.MAX_RECIPES,
        positiveStateCeiling: 'STRUCTURALLY_DECLARED_AVAILABLE_AT_MOST',
        disposableCandidateWriteAuthority: true,
        sandboxFixtureExecutionAuthority: true,
        architectureSelectionAuthority: false,
        liveArchitectureEvaluationAuthority: false,
        providerBuildAuthority: false,
        workshopWriteAuthority: false,
        liveExecutionAuthority: false,
        installAuthority: false,
        trainingAdmissionAuthority: false,
        runtimePromotionAuthority: false
      },
      providerDeclarationArchitecturePatternCell: {
        id: ProviderDeclarationArchitecturePatternCell.CELL_ID,
        status: 'WORKING_INDEPENDENT_PER_DOCUMENT_DECLARATION_PATTERN_ASSESSMENT',
        scope: 'bounded-content-digested-typed-declaration-pattern-to-current-exam-relation-gaps-without-cross-document-merge',
        learnedWeights: false,
        providerIdentityInferenceAuthority: false,
        crossDocumentRelationMergeAuthority: false,
        architectureSelectionAuthority: false,
        architectureEvaluationAuthority: false,
        providerBuildAuthority: false,
        workshopWriteAuthority: false,
        trainingAdmissionAuthority: false,
        runtimePromotionAuthority: false
      },
      providerDeclarationArchitectureSurveyOrgan: {
        id: ProviderDeclarationArchitectureSurveyOrgan.ORGAN_ID,
        status: 'TEST_AUTOMATIC_READ_ONLY_PROVIDER_DECLARATION_ARCHITECTURE_PATTERN_SURVEY',
        scope: 'current-research-exam-plus-bounded-read-only-Workshop-shared-json-inventory-to-source-separated-pattern-evidence',
        learnedWeights: false,
        maximumResults: ProviderDeclarationArchitectureSurveyOrgan.MAX_RESULTS,
        maximumDocuments: ProviderDeclarationArchitectureSurveyOrgan.MAX_DOCUMENTS,
        maximumDocumentBytes: ProviderDeclarationArchitectureSurveyOrgan.MAX_DOCUMENT_BYTES,
        providerIdentityInferenceAuthority: false,
        crossDocumentRelationMergeAuthority: false,
        architectureSelectionAuthority: false,
        architectureEvaluationAuthority: false,
        providerBuildAuthority: false,
        declarationWriteAuthority: false,
        workshopWriteAuthority: false,
        readinessClaimAuthority: false,
        liveExecutionAuthority: false,
        trainingAdmissionAuthority: false,
        runtimePromotionAuthority: false
      },
      providerImplementationEvidenceCell: {
        id: ProviderImplementationEvidenceCell.CELL_ID,
        status: 'WORKING_STATIC_EXACT_SELECTOR_SOURCE_EVIDENCE',
        scope: 'bounded-content-digested-JavaScript-selector-literals-and-conservative-export-registration-test-signals',
        learnedWeights: false,
        providerIdentityInferenceAuthority: false,
        outerRequirementBindingAuthority: false,
        implementationSelectionAuthority: false,
        sourceExecutionAuthority: false,
        architectureSelectionAuthority: false,
        providerBuildAuthority: false,
        workshopWriteAuthority: false,
        trainingAdmissionAuthority: false,
        runtimePromotionAuthority: false
      },
      providerDeclarationImplementationEvidenceSurveyOrgan: {
        id: ProviderDeclarationImplementationEvidenceSurveyOrgan.ORGAN_ID,
        status: 'TEST_AUTOMATIC_STATIC_PROVIDER_IMPLEMENTATION_EVIDENCE_SURVEY',
        scope: 'current-architecture-survey-plus-bounded-read-only-Workshop-shared-JavaScript-to-exact-selector-source-evidence',
        learnedWeights: false,
        maximumResults: ProviderDeclarationImplementationEvidenceSurveyOrgan.MAX_RESULTS,
        maximumDocuments: ProviderDeclarationImplementationEvidenceSurveyOrgan.MAX_DOCUMENTS,
        maximumDocumentBytes: ProviderDeclarationImplementationEvidenceSurveyOrgan.MAX_DOCUMENT_BYTES,
        providerIdentityInferenceAuthority: false,
        outerRequirementBindingAuthority: false,
        implementationSelectionAuthority: false,
        sourceExecutionAuthority: false,
        architectureSelectionAuthority: false,
        architectureEvaluationAuthority: false,
        providerBuildAuthority: false,
        declarationWriteAuthority: false,
        workshopWriteAuthority: false,
        readinessClaimAuthority: false,
        liveExecutionAuthority: false,
        trainingAdmissionAuthority: false,
        runtimePromotionAuthority: false
      },
      providerBindingExperimentCell: {
        id: ProviderBindingExperimentCell.CELL_ID,
        status: 'WORKING_BALANCED_PROVIDER_BINDING_EXPERIMENT_FRAME_ORIGINATION',
        scope: 'complete-exported-selector-source-by-positive-untested-architecture-hypothesis-cross-product',
        learnedWeights: false,
        providerIdentityInferenceAuthority: false,
        outerRequirementBindingAuthority: false,
        permissionInferenceAuthority: false,
        experimentFrameSelectionAuthority: false,
        sourceExecutionAuthority: false,
        architectureSelectionAuthority: false,
        providerBuildAuthority: false,
        declarationWriteAuthority: false,
        workshopWriteAuthority: false,
        trainingAdmissionAuthority: false,
        runtimePromotionAuthority: false
      },
      providerDeclarationBindingExperimentPlannerOrgan: {
        id: ProviderDeclarationBindingExperimentPlannerOrgan.ORGAN_ID,
        status: 'TEST_AUTOMATIC_BALANCED_PROVIDER_BINDING_EXPERIMENT_PLANNER',
        scope: 'implementation-evidence-plus-independent-research-exam-to-unselected-balanced-experiment-matrix',
        learnedWeights: false,
        maximumResults: ProviderDeclarationBindingExperimentPlannerOrgan.MAX_RESULTS,
        maximumFramesPerMatrix: ProviderDeclarationBindingExperimentPlannerOrgan.MAX_FRAMES_PER_MATRIX,
        providerIdentityInferenceAuthority: false,
        outerRequirementBindingAuthority: false,
        permissionInferenceAuthority: false,
        experimentFrameSelectionAuthority: false,
        sourceExecutionAuthority: false,
        architectureSelectionAuthority: false,
        architectureEvaluationAuthority: false,
        providerBuildAuthority: false,
        declarationWriteAuthority: false,
        workshopWriteAuthority: false,
        trainingAdmissionAuthority: false,
        runtimePromotionAuthority: false
      },
      readinessProbeRecipeCell: {
        id: ReadinessProbeRecipeCell.CELL_ID,
        status: 'WORKING_REVIEW_BOUND_STRUCTURAL_PROBE_RECIPE_ADMISSION',
        scope: 'digest-bound-human-reviewed-file-directory-bound-module-shared-service-or-foundation-service-plane-structural-recipes-only',
        learnedWeights: false,
        readinessClaimAuthority: false,
        candidateWriteAuthority: false,
        liveExecutionAuthority: false,
        installAuthority: false,
        permissionGrantAuthority: false,
        runtimePromotionAuthority: false
      },
      reasoningReadinessProbeBuilderOrgan: {
        id: ReasoningReadinessProbeBuilderOrgan.ORGAN_ID,
        status: 'TEST_REVIEW_BOUND_DISPOSABLE_PROBE_CANDIDATE_BUILDER',
        scope: 'reviewed-structural-recipe-to-ignored-state-candidate-and-disposable-fixtures',
        learnedWeights: false,
        maximumRecipes: ReasoningReadinessProbeBuilderOrgan.MAX_RECIPES,
        positiveStateCeiling: 'AVAILABLE',
        disposableCandidateWriteAuthority: true,
        sandboxFixtureExecutionAuthority: true,
        workshopWriteAuthority: false,
        liveExecutionAuthority: false,
        installAuthority: false,
        automaticStartAuthority: false,
        automaticRepairAuthority: false,
        permissionGrantAuthority: false,
        trainingAdmissionAuthority: false,
        worldMutationAuthority: false,
        runtimePromotionAuthority: false
      },
      reasoningReadinessProbeReviewOrgan: {
        id: ReasoningReadinessProbeReviewOrgan.ORGAN_ID,
        status: 'TEST_CURRENT_HAND_HUMAN_REVIEW_DIGEST_BRIDGE',
        scope: 'attributed-human-decision-to-current-hand-bound-sealed-recipe-without-build',
        learnedWeights: false,
        humanDecisionAuthority: false,
        candidateWriteAuthority: false,
        readinessClaimAuthority: false,
        liveExecutionAuthority: false,
        installAuthority: false,
        trainingAdmissionAuthority: false,
        runtimePromotionAuthority: false
      },
      reasoningCounterexampleOrgan: {
        id: ReasoningCounterexampleOrgan.ORGAN_ID,
        status: 'TEST_PRIVATE_COUNTEREXAMPLE_LAB',
        scope: 'parent-linked-synthetic-structural-interventions-from-verified-real-local-receipts',
        learnedWeights: false,
        realWorldOutcomeAuthority: false,
        heldOutMutationAuthority: false,
        semanticTruthWriteAuthority: false,
        toolAuthority: false,
        worldMutationAuthority: false,
        runtimePromotionAuthority: false
      },
      reasoningMetamorphicOrgan: {
        id: ReasoningMetamorphicOrgan.ORGAN_ID,
        status: 'TEST_PRIVATE_COMPOSITIONAL_METAMORPHIC_LAB',
        scope: 'evaluation-only-atomic-and-generated-depth-two-decision-invariance-probes-over-verified-real-local-receipts',
        learnedWeights: false,
        confirmedInvariantTrainingAuthority: false,
        maximumCompositionDepth: 2,
        negativeMismatchReceiptRoute: 'EXPERIENCE_ORGAN_GATED',
        realWorldOutcomeAuthority: false,
        heldOutMutationAuthority: false,
        semanticTruthWriteAuthority: false,
        toolAuthority: false,
        worldMutationAuthority: false,
        runtimePromotionAuthority: false
      },
      organAdmissionCell: {
        id: OrganAdmission.CELL_ID,
        status: 'EXPERIMENTAL',
        scope: 'repeated-verified-gap-to-isolated-build-proposal',
        writeCodeAuthority: false,
        installAuthority: false,
        runtimePromotionAuthority: false
      },
      rootHash,
      host: config.host,
      port: actualPort,
      offlineCapable: true,
      outsideNetworkCalls: false,
      writePermissions: ['ignored-private-reasoning-receipt-append-only', 'ignored-private-contract-curriculum-and-held-out-traces', 'ignored-private-handoff-graph-evaluation-traces', 'ignored-private-route-readiness-evaluation-traces', 'ignored-private-readiness-hand-evaluation-traces', 'ignored-private-readiness-probe-affordance-evaluation-traces', 'ignored-private-provider-declaration-hand-evaluation-traces', 'ignored-private-provider-declaration-research-exam-evaluation-traces', 'ignored-private-provider-declaration-architecture-pattern-survey-traces', 'ignored-private-provider-implementation-evidence-survey-traces', 'ignored-private-provider-binding-experiment-matrix-traces', 'ignored-private-reviewed-provider-declaration-research-executors-and-synthetic-fixtures', 'ignored-private-reviewed-readiness-probe-candidates-and-disposable-fixtures', 'ignored-private-metamorphic-evaluation-traces', 'ignored-private-reasoning-failure-curriculum-proposals'],
      toolPermissions: [],
      startedAt,
      sessions: sessions.size,
      inMemoryTraces: traceStore.count(),
      workshopPresence: heartbeat ? heartbeat.status() : { state: 'disabled', ok: false },
      automaticPractice: practiceStatus,
      workshopActionLessons: WorkshopActionFeed.status(actionFeedOptions)
    };
  }

  async function handle(req, res) {
    if (limited(req)) return send(req, res, 429, { ok: false, error: 'local rate limit exceeded' });
    const parsed = new URL(req.url, 'http://mirror.local');
    const route = parsed.pathname;
    if (req.method === 'OPTIONS') {
      if (req.headers.origin && !allowedOrigins.has(String(req.headers.origin))) return send(req, res, 403, { ok: false, error: 'origin not allowed' });
      return send(req, res, 204, null);
    }
    if (route === '/health' && req.method === 'GET') return send(req, res, 200, publicHealth());
    if (route === '/capabilities' && req.method === 'GET') return send(req, res, 200, {
      ok: true,
      schema: 'axm.mirror.capabilities/v1',
      supported: ['explicit-sessions', 'typed-evidence', 'unknown-preservation', 'contradiction-preservation', 'supplied-candidate-evaluation', 'inspectable-native-reasoning-foundation', 'dependency-visible-decomposition', 'input-order-independent-path-comparison', 'verification-and-metacognition-receipts', 'proposal-only-memory-routing', 'private-reusable-reasoning-strategy-learning', 'private-learned-epistemic-candidate-origination', 'append-only-verified-reasoning-experience-intake', 'decision-match-and-outcome-success-separated', 'recurrent-real-failure-curriculum-proposals', 'typed-contract-derived-private-curriculum-with-stable-held-out-module-split', 'proposal-only-exact-typed-handoff-graph-routing-depth-two', 'fresh-typed-technical-glasses-route-readiness-overlay', 'automatic-missing-readiness-probe-hand-contract-proposals', 'exact-provider-declaration-readiness-probe-affordance-review-packets', 'automatic-consumer-bound-provider-declaration-gap-hand-proposals', 'automatic-independent-provider-declaration-research-exam-proposals', 'automatic-read-only-source-separated-provider-declaration-architecture-pattern-surveys', 'automatic-static-exact-selector-provider-implementation-evidence-surveys', 'automatic-balanced-provider-binding-experiment-matrix-planning', 'current-exam-attributed-human-fixed-research-executor-recipe-sealing', 'review-bound-disposable-provider-declaration-research-executor-fixtures', 'current-hand-attributed-human-readiness-probe-recipe-sealing', 'review-bound-disposable-structural-readiness-probe-candidate-builds', 'parent-linked-private-synthetic-counterexample-practice', 'evaluation-only-metamorphic-invariance-probes', 'negative-metamorphic-mismatch-intake', 'reasoning-development-and-organ-candidates', 'evidence-gated-organ-build-proposals', 'bounded-rule-studio-candidate-generation', 'bounded-world-genome-candidate-generation', 'cross-domain-frontier-proposals', 'novel-capability-exam-proposals', 'permission-holds', 'ternary-decisions', 'machine-trace', 'human-trace-rendering', 'automatic-bounded-local-practice', 'private-challenger-training', 'opt-in-workshop-action-lessons'],
      unsupported: ['unbounded-open-ended-candidate-generation', 'automatic-frontier-promotion', 'automatic-organ-code-application', 'automatic-readiness-probe-recipe-inference', 'automatic-provider-declaration-research-executor-approval-or-recipe-inference', 'automatic-provider-architecture-selection-or-live-evaluation', 'automatic-readiness-probe-installation-or-live-execution', 'automatic-metamorphic-repair-code-generation', 'learned-runtime-reasoning', 'open-ended-language', 'vision', 'tool-use', 'runtime-weight-mutation', 'external-network'],
      authority: { files: false, tools: false, network: false, canon: false }
    });
    if (route === '/v1/models' && req.method === 'GET') return send(req, res, 200, {
      object: 'list', data: [{ id: 'mirror-kernel', object: 'model', owned_by: 'axm-local', status: 'deterministic-seed-no-weights' }]
    });
    if (!authorized(req)) return send(req, res, 401, { ok: false, error: 'local bearer token required' });

    if (route === '/axm/v1/learning/action-feed/status' && req.method === 'GET') {
      return send(req, res, 200, WorkshopActionFeed.status(actionFeedOptions));
    }

    if (route === '/axm/v1/learning/action-feed/settings' && req.method === 'POST') {
      const body = await readJson(req);
      WorkshopActionFeed.configure(body, actionFeedOptions);
      return send(req, res, 200, WorkshopActionFeed.status(actionFeedOptions));
    }

    if (route === '/axm/v1/learning/action-feed/ingest' && req.method === 'POST') {
      const body = await readJson(req);
      const result = WorkshopActionFeed.ingest(body.action || body, actionFeedOptions);
      return send(req, res, result.accepted ? 201 : 200, result);
    }

    if (route === '/axm/v1/session/open' && req.method === 'POST') {
      const body = await readJson(req);
      const sessionId = `session-${crypto.randomBytes(12).toString('hex')}`;
      const session = {
        id: sessionId,
        actor: body.actor && typeof body.actor === 'object' ? body.actor : { id: 'anonymous', kind: 'unknown' },
        purpose: String(body.purpose || 'bounded reasoning session').slice(0, 500),
        openedAt: new Date().toISOString(),
        traceIds: [],
        reasoningSessionIds: [],
        reasoningExperienceReceiptIds: [],
        handoffRouteResponseIds: [],
        readinessHandResponseIds: [],
        readinessProbeAffordanceResponseIds: [],
        providerDeclarationHandResponseIds: [],
        providerDeclarationResearchExamResponseIds: [],
        providerDeclarationResearchExecutorReviewResponseIds: [],
        providerDeclarationResearchExecutorBuilderResponseIds: [],
        providerDeclarationArchitectureSurveyResponseIds: [],
        providerDeclarationImplementationEvidenceSurveyResponseIds: [],
        providerDeclarationBindingExperimentResponseIds: [],
        readinessProbeReviewResponseIds: [],
        readinessProbeBuilderResponseIds: [],
        organAdmissionAssessmentIds: [],
        candidateSetIds: [],
        frontierProposalIds: []
      };
      sessions.set(sessionId, session);
      if (heartbeat) heartbeat.beat('active');
      return send(req, res, 201, { ok: true, schema: 'axm.mirror.session/v1', session });
    }

    if (route === '/axm/v1/organs/studio-candidates' && req.method === 'POST') {
      const body = await readJson(req);
      if (!body.sessionId || !sessions.has(String(body.sessionId))) return send(req, res, 409, { ok: false, error: 'an open explicit sessionId is required' });
      if (body.surface && body.surface !== 'axm-studio-bounded-proposal-layer') return send(req, res, 400, { ok: false, error: 'candidate organ is scoped only to the bounded AXM Studio proposal layer' });
      if (heartbeat) heartbeat.beat('thinking');
      const candidateSet = StudioCandidateOrgan.originate({ observation: body.observation });
      const candidateSetId = `candidate-set-${candidateSet.observationDigest}`;
      candidateSet.candidateSetId = candidateSetId;
      sessions.get(String(body.sessionId)).candidateSetIds.push(candidateSetId);
      if (heartbeat) heartbeat.beat('idle');
      return send(req, res, 200, { ok: true, candidateSet });
    }

    if (route === '/axm/v1/organs/world-genome-candidates' && req.method === 'POST') {
      const body = await readJson(req);
      if (!body.sessionId || !sessions.has(String(body.sessionId))) return send(req, res, 409, { ok: false, error: 'an open explicit sessionId is required' });
      if (body.surface !== 'axm-governed-evolution-disposable-globe') return send(req, res, 400, { ok: false, error: 'world genome organ is scoped only to Mirror\'s disposable governed-evolution globe' });
      if (heartbeat) heartbeat.beat('thinking');
      const candidateSet = WorldGenomeOrgan.originate({ parentGenome: body.parentGenome, generation: body.generation, count: body.count, lineageSeed: body.lineageSeed });
      const candidateSetId = `candidate-set-${candidateSet.parentDigest || crypto.randomBytes(8).toString('hex')}-g${candidateSet.generation || 0}`;
      candidateSet.candidateSetId = candidateSetId;
      sessions.get(String(body.sessionId)).candidateSetIds.push(candidateSetId);
      if (heartbeat) heartbeat.beat('idle');
      return send(req, res, candidateSet.ok ? 200 : 422, { ok: candidateSet.ok, candidateSet, error: candidateSet.ok ? undefined : 'parent genome or candidate set failed the executable-structure boundary' });
    }

    if (route === '/axm/v1/growth/frontier' && req.method === 'POST') {
      const body = await readJson(req);
      const session = sessions.get(String(body.sessionId || ''));
      if (!session) return send(req, res, 409, { ok: false, error: 'an open explicit sessionId is required' });
      if (heartbeat) heartbeat.beat('thinking');
      const assessment = FrontierCell.inspect(body);
      if (assessment.proposal) session.frontierProposalIds.push(assessment.proposal.proposalId);
      if (heartbeat) heartbeat.beat('idle');
      return send(req, res, 200, { ok: true, assessment });
    }

    if (route === '/axm/v1/reasoning/foundation' && req.method === 'POST') {
      const body = await readJson(req);
      const session = sessions.get(String(body.sessionId || ''));
      if (!session) return send(req, res, 409, { ok: false, error: 'an open explicit sessionId is required' });
      if (heartbeat) heartbeat.beat('thinking');
      const reasoningSession = ReasoningFoundation.run(body, { onTrace: item => traceStore.save(item) });
      session.traceIds.push(reasoningSession.principleTrace.traceId);
      session.reasoningSessionIds.push(reasoningSession.reasoningSessionId);
      if (heartbeat) heartbeat.beat('idle');
      return send(req, res, 200, { ok: true, reasoningSession });
    }

    if (route === '/axm/v1/reasoning/handoff-route' && req.method === 'POST') {
      const body = await readJson(req);
      const session = sessions.get(String(body.sessionId || ''));
      if (!session) return send(req, res, 409, { ok: false, error: 'an open explicit sessionId is required' });
      if (heartbeat) heartbeat.beat('thinking');
      const { handoffDerived, readinessDerived: derived, observationRefresh } = await deriveCurrentReadiness();
      const request = Object.assign({}, body);
      delete request.sessionId;
      const response = ReasoningRouteReadinessOrgan.plan(derived, request);
      session.handoffRouteResponseIds.push(response.responseDigest);
      if (heartbeat) heartbeat.beat('idle');
      return send(req, res, 200, { ok: true, response, batchReused: derived.reused, staticGraphBatchReused: handoffDerived.reused, observationRefresh, activeRuntimeChanged: false });
    }

    if (route === '/axm/v1/growth/readiness-hands' && req.method === 'POST') {
      const body = await readJson(req);
      const session = sessions.get(String(body.sessionId || ''));
      if (!session) return send(req, res, 409, { ok: false, error: 'an open explicit sessionId is required' });
      if (heartbeat) heartbeat.beat('thinking');
      const { handoffDerived, readinessDerived, observationRefresh } = await deriveCurrentReadiness();
      const derived = ReasoningReadinessHandOrgan.derive(Object.assign({}, readinessHandOptions, { handoffDerived, readinessDerived }));
      const request = Object.assign({}, body);
      delete request.sessionId;
      const response = ReasoningReadinessHandOrgan.plan(derived, request);
      session.readinessHandResponseIds.push(response.responseDigest);
      if (heartbeat) heartbeat.beat('idle');
      return send(req, res, 200, {
        ok: true,
        response,
        batchReused: derived.reused,
        readinessBatchReused: readinessDerived.reused,
        staticGraphBatchReused: handoffDerived.reused,
        observationRefresh,
        codeFilesGenerated: 0,
        probesInstalled: 0,
        activeRuntimeChanged: false
      });
    }

    if (route === '/axm/v1/growth/readiness-probe-affordances' && req.method === 'POST') {
      const body = await readJson(req);
      const session = sessions.get(String(body.sessionId || ''));
      if (!session) return send(req, res, 409, { ok: false, error: 'an open explicit sessionId is required' });
      if (heartbeat) heartbeat.beat('thinking');
      const { handoffDerived, readinessDerived, observationRefresh } = await deriveCurrentReadiness();
      const handDerived = ReasoningReadinessHandOrgan.derive(Object.assign({}, readinessHandOptions, { handoffDerived, readinessDerived }));
      const derived = ReasoningReadinessProbeAffordanceOrgan.derive(Object.assign({}, readinessProbeAffordanceOptions, { handDerived }));
      const request = Object.assign({}, body);
      delete request.sessionId;
      const response = ReasoningReadinessProbeAffordanceOrgan.respond(derived, request);
      session.readinessProbeAffordanceResponseIds.push(response.responseDigest);
      if (heartbeat) heartbeat.beat('idle');
      return send(req, res, 200, {
        ok: true,
        response,
        batchReused: derived.reused,
        readinessHandBatchReused: handDerived.reused,
        readinessBatchReused: readinessDerived.reused,
        staticGraphBatchReused: handoffDerived.reused,
        observationRefresh,
        humanReviewCreated: false,
        recipeSealed: false,
        candidateBuilt: false,
        activeRuntimeChanged: false,
        workshopChanged: false,
        probesInstalled: 0,
        liveProbesExecuted: 0
      });
    }

    if (route === '/axm/v1/growth/provider-declaration-hands' && req.method === 'POST') {
      const body = await readJson(req);
      const session = sessions.get(String(body.sessionId || ''));
      if (!session) return send(req, res, 409, { ok: false, error: 'an open explicit sessionId is required' });
      if (heartbeat) heartbeat.beat('thinking');
      const { handoffDerived, readinessDerived, observationRefresh } = await deriveCurrentReadiness();
      const handDerived = ReasoningReadinessHandOrgan.derive(Object.assign({}, readinessHandOptions, { handoffDerived, readinessDerived }));
      const affordanceDerived = ReasoningReadinessProbeAffordanceOrgan.derive(Object.assign({}, readinessProbeAffordanceOptions, { handDerived }));
      const derived = ProviderDeclarationHandOrgan.derive(Object.assign({}, providerDeclarationHandOptions, { affordanceDerived }));
      const request = Object.assign({}, body);
      delete request.sessionId;
      const response = ProviderDeclarationHandOrgan.respond(derived, request);
      session.providerDeclarationHandResponseIds.push(response.responseDigest);
      if (heartbeat) heartbeat.beat('idle');
      return send(req, res, 200, {
        ok: true,
        response,
        batchReused: derived.reused,
        sourceAffordanceBatchReused: affordanceDerived.reused,
        readinessHandBatchReused: handDerived.reused,
        readinessBatchReused: readinessDerived.reused,
        staticGraphBatchReused: handoffDerived.reused,
        observationRefresh,
        declarationCandidatesBuilt: false,
        providerDeclarationsWritten: false,
        activeRuntimeChanged: false,
        workshopChanged: false,
        liveProbesExecuted: 0
      });
    }

    if (route === '/axm/v1/growth/provider-declaration-research-exams' && req.method === 'POST') {
      const body = await readJson(req);
      const session = sessions.get(String(body.sessionId || ''));
      if (!session) return send(req, res, 409, { ok: false, error: 'an open explicit sessionId is required' });
      if (heartbeat) heartbeat.beat('thinking');
      const { handoffDerived, readinessDerived, observationRefresh } = await deriveCurrentReadiness();
      const handDerived = ReasoningReadinessHandOrgan.derive(Object.assign({}, readinessHandOptions, { handoffDerived, readinessDerived }));
      const affordanceDerived = ReasoningReadinessProbeAffordanceOrgan.derive(Object.assign({}, readinessProbeAffordanceOptions, { handDerived }));
      const providerDerived = ProviderDeclarationHandOrgan.derive(Object.assign({}, providerDeclarationHandOptions, { affordanceDerived }));
      const derived = ProviderDeclarationResearchExamOrgan.derive(Object.assign({}, providerDeclarationResearchExamOptions, { providerDerived }));
      const request = Object.assign({}, body);
      delete request.sessionId;
      const response = ProviderDeclarationResearchExamOrgan.respond(derived, request);
      session.providerDeclarationResearchExamResponseIds.push(response.responseDigest);
      if (heartbeat) heartbeat.beat('idle');
      return send(req, res, 200, {
        ok: true,
        response,
        batchReused: derived.reused,
        providerDeclarationHandBatchReused: providerDerived.reused,
        sourceAffordanceBatchReused: affordanceDerived.reused,
        readinessHandBatchReused: handDerived.reused,
        readinessBatchReused: readinessDerived.reused,
        staticGraphBatchReused: handoffDerived.reused,
        observationRefresh,
        architectureSelected: false,
        examExecutorBuilt: false,
        fixtureFilesGenerated: 0,
        providerCandidatesBuilt: false,
        providerDeclarationsWritten: false,
        liveExperimentsExecuted: 0,
        activeRuntimeChanged: false,
        workshopChanged: false
      });
    }

    if (route === '/axm/v1/growth/provider-declaration-research-executor-review' && req.method === 'POST') {
      const body = await readJson(req);
      const session = sessions.get(String(body.sessionId || ''));
      if (!session) return send(req, res, 409, { ok: false, error: 'an open explicit sessionId is required' });
      if (!session.actor || String(session.actor.kind || '').toUpperCase() !== 'HUMAN' || !String(session.actor.id || '')) return send(req, res, 403, { ok: false, error: 'provider declaration research executor review requires an attributed HUMAN session actor' });
      if (heartbeat) heartbeat.beat('thinking');
      const { handoffDerived, readinessDerived, observationRefresh } = await deriveCurrentReadiness();
      const handDerived = ReasoningReadinessHandOrgan.derive(Object.assign({}, readinessHandOptions, { handoffDerived, readinessDerived }));
      const affordanceDerived = ReasoningReadinessProbeAffordanceOrgan.derive(Object.assign({}, readinessProbeAffordanceOptions, { handDerived }));
      const providerDerived = ProviderDeclarationHandOrgan.derive(Object.assign({}, providerDeclarationHandOptions, { affordanceDerived }));
      const researchDerived = ProviderDeclarationResearchExamOrgan.derive(Object.assign({}, providerDeclarationResearchExamOptions, { providerDerived }));
      const request = Object.assign({}, body);
      delete request.sessionId;
      const response = ProviderDeclarationResearchExecutorReviewOrgan.review(researchDerived, request, session.actor);
      session.providerDeclarationResearchExecutorReviewResponseIds.push(response.responseDigest);
      if (heartbeat) heartbeat.beat('idle');
      return send(req, res, 200, {
        ok: true,
        response,
        researchExamBatchReused: researchDerived.reused,
        providerDeclarationHandBatchReused: providerDerived.reused,
        sourceAffordanceBatchReused: affordanceDerived.reused,
        readinessHandBatchReused: handDerived.reused,
        readinessBatchReused: readinessDerived.reused,
        staticGraphBatchReused: handoffDerived.reused,
        observationRefresh,
        executorBuilt: false,
        architectureSelected: false,
        architectureEvaluated: false,
        activeRuntimeChanged: false,
        workshopChanged: false
      });
    }

    if (route === '/axm/v1/growth/provider-declaration-architecture-surveys' && req.method === 'POST') {
      const body = await readJson(req);
      const session = sessions.get(String(body.sessionId || ''));
      if (!session) return send(req, res, 409, { ok: false, error: 'an open explicit sessionId is required' });
      if (heartbeat) heartbeat.beat('thinking');
      const { handoffDerived, readinessDerived, observationRefresh } = await deriveCurrentReadiness();
      const handDerived = ReasoningReadinessHandOrgan.derive(Object.assign({}, readinessHandOptions, { handoffDerived, readinessDerived }));
      const affordanceDerived = ReasoningReadinessProbeAffordanceOrgan.derive(Object.assign({}, readinessProbeAffordanceOptions, { handDerived }));
      const providerDerived = ProviderDeclarationHandOrgan.derive(Object.assign({}, providerDeclarationHandOptions, { affordanceDerived }));
      const researchDerived = ProviderDeclarationResearchExamOrgan.derive(Object.assign({}, providerDeclarationResearchExamOptions, { providerDerived }));
      const derived = ProviderDeclarationArchitectureSurveyOrgan.derive(Object.assign({}, providerDeclarationArchitectureSurveyOptions, { researchDerived }));
      const request = Object.assign({}, body);
      delete request.sessionId;
      const response = ProviderDeclarationArchitectureSurveyOrgan.respond(derived, request);
      session.providerDeclarationArchitectureSurveyResponseIds.push(response.responseDigest);
      if (heartbeat) heartbeat.beat('idle');
      return send(req, res, 200, {
        ok: true,
        response,
        batchReused: derived.reused,
        researchExamBatchReused: researchDerived.reused,
        providerDeclarationHandBatchReused: providerDerived.reused,
        sourceAffordanceBatchReused: affordanceDerived.reused,
        readinessHandBatchReused: handDerived.reused,
        readinessBatchReused: readinessDerived.reused,
        staticGraphBatchReused: handoffDerived.reused,
        observationRefresh,
        providerIdentityInferred: false,
        crossDocumentRelationMergeUsed: false,
        architectureSelected: false,
        architectureEvaluated: false,
        providerCandidateBuilt: false,
        providerDeclarationWritten: false,
        liveExperimentsExecuted: 0,
        activeRuntimeChanged: false,
        workshopChanged: false
      });
    }

    if (route === '/axm/v1/growth/provider-declaration-implementation-evidence-surveys' && req.method === 'POST') {
      const body = await readJson(req);
      const session = sessions.get(String(body.sessionId || ''));
      if (!session) return send(req, res, 409, { ok: false, error: 'an open explicit sessionId is required' });
      if (heartbeat) heartbeat.beat('thinking');
      const { handoffDerived, readinessDerived, observationRefresh } = await deriveCurrentReadiness();
      const handDerived = ReasoningReadinessHandOrgan.derive(Object.assign({}, readinessHandOptions, { handoffDerived, readinessDerived }));
      const affordanceDerived = ReasoningReadinessProbeAffordanceOrgan.derive(Object.assign({}, readinessProbeAffordanceOptions, { handDerived }));
      const providerDerived = ProviderDeclarationHandOrgan.derive(Object.assign({}, providerDeclarationHandOptions, { affordanceDerived }));
      const researchDerived = ProviderDeclarationResearchExamOrgan.derive(Object.assign({}, providerDeclarationResearchExamOptions, { providerDerived }));
      const architectureDerived = ProviderDeclarationArchitectureSurveyOrgan.derive(Object.assign({}, providerDeclarationArchitectureSurveyOptions, { researchDerived }));
      const derived = ProviderDeclarationImplementationEvidenceSurveyOrgan.derive(Object.assign({}, providerDeclarationImplementationEvidenceSurveyOptions, { architectureDerived }));
      const request = Object.assign({}, body);
      delete request.sessionId;
      const response = ProviderDeclarationImplementationEvidenceSurveyOrgan.respond(derived, request);
      session.providerDeclarationImplementationEvidenceSurveyResponseIds.push(response.responseDigest);
      if (heartbeat) heartbeat.beat('idle');
      return send(req, res, 200, {
        ok: true,
        response,
        batchReused: derived.reused,
        architectureSurveyBatchReused: architectureDerived.reused,
        researchExamBatchReused: researchDerived.reused,
        providerDeclarationHandBatchReused: providerDerived.reused,
        sourceAffordanceBatchReused: affordanceDerived.reused,
        readinessHandBatchReused: handDerived.reused,
        readinessBatchReused: readinessDerived.reused,
        staticGraphBatchReused: handoffDerived.reused,
        observationRefresh,
        providerIdentityInferred: false,
        outerRequirementBound: false,
        implementationSelected: false,
        sourceExecuted: false,
        architectureSelected: false,
        architectureEvaluated: false,
        providerCandidateBuilt: false,
        providerDeclarationWritten: false,
        activeRuntimeChanged: false,
        workshopChanged: false
      });
    }

    if (route === '/axm/v1/growth/provider-declaration-binding-experiments' && req.method === 'POST') {
      const body = await readJson(req);
      const session = sessions.get(String(body.sessionId || ''));
      if (!session) return send(req, res, 409, { ok: false, error: 'an open explicit sessionId is required' });
      if (heartbeat) heartbeat.beat('thinking');
      const { handoffDerived, readinessDerived, observationRefresh } = await deriveCurrentReadiness();
      const handDerived = ReasoningReadinessHandOrgan.derive(Object.assign({}, readinessHandOptions, { handoffDerived, readinessDerived }));
      const affordanceDerived = ReasoningReadinessProbeAffordanceOrgan.derive(Object.assign({}, readinessProbeAffordanceOptions, { handDerived }));
      const providerDerived = ProviderDeclarationHandOrgan.derive(Object.assign({}, providerDeclarationHandOptions, { affordanceDerived }));
      const researchDerived = ProviderDeclarationResearchExamOrgan.derive(Object.assign({}, providerDeclarationResearchExamOptions, { providerDerived }));
      const architectureDerived = ProviderDeclarationArchitectureSurveyOrgan.derive(Object.assign({}, providerDeclarationArchitectureSurveyOptions, { researchDerived }));
      const implementationDerived = ProviderDeclarationImplementationEvidenceSurveyOrgan.derive(Object.assign({}, providerDeclarationImplementationEvidenceSurveyOptions, { architectureDerived }));
      const derived = ProviderDeclarationBindingExperimentPlannerOrgan.derive(Object.assign({}, providerDeclarationBindingExperimentOptions, { implementationDerived }));
      const request = Object.assign({}, body);
      delete request.sessionId;
      const response = ProviderDeclarationBindingExperimentPlannerOrgan.respond(derived, request);
      session.providerDeclarationBindingExperimentResponseIds.push(response.responseDigest);
      if (heartbeat) heartbeat.beat('idle');
      return send(req, res, 200, {
        ok: true,
        response,
        batchReused: derived.reused,
        implementationEvidenceBatchReused: implementationDerived.reused,
        architectureSurveyBatchReused: architectureDerived.reused,
        researchExamBatchReused: researchDerived.reused,
        providerDeclarationHandBatchReused: providerDerived.reused,
        sourceAffordanceBatchReused: affordanceDerived.reused,
        readinessHandBatchReused: handDerived.reused,
        readinessBatchReused: readinessDerived.reused,
        staticGraphBatchReused: handoffDerived.reused,
        observationRefresh,
        selectedFrameId: null,
        providerIdentityInferred: false,
        outerRequirementBound: false,
        permissionsInferred: false,
        implementationSelected: false,
        sourceExecuted: false,
        architectureSelected: false,
        architectureEvaluated: false,
        providerCandidateBuilt: false,
        providerDeclarationWritten: false,
        activeRuntimeChanged: false,
        workshopChanged: false
      });
    }

    if (route === '/axm/v1/growth/provider-declaration-research-executors' && req.method === 'POST') {
      const body = await readJson(req);
      const session = sessions.get(String(body.sessionId || ''));
      if (!session) return send(req, res, 409, { ok: false, error: 'an open explicit sessionId is required' });
      if (body.schema !== ProviderDeclarationResearchExecutorBuilderOrgan.REQUEST_SCHEMA || !Array.isArray(body.recipes)) return send(req, res, 400, { ok: false, error: `request must use ${ProviderDeclarationResearchExecutorBuilderOrgan.REQUEST_SCHEMA} with a recipes array` });
      const unexpected = Object.keys(body).filter(key => !['sessionId', 'schema', 'recipes'].includes(key));
      if (unexpected.length) return send(req, res, 400, { ok: false, error: `unknown critical provider declaration research executor request fields: ${unexpected.join(', ')}` });
      const humanSession = session.actor && String(session.actor.kind || '').toUpperCase() === 'HUMAN' && String(session.actor.id || '');
      if (body.recipes.length && (!humanSession || body.recipes.some(recipe => !recipe || !recipe.review || String(recipe.review.actorId || '') !== String(session.actor.id)))) return send(req, res, 403, { ok: false, error: 'non-empty research executor builds require a HUMAN session whose actor ID matches every reviewed recipe' });
      if (heartbeat) heartbeat.beat('thinking');
      const { handoffDerived, readinessDerived, observationRefresh } = await deriveCurrentReadiness();
      const handDerived = ReasoningReadinessHandOrgan.derive(Object.assign({}, readinessHandOptions, { handoffDerived, readinessDerived }));
      const affordanceDerived = ReasoningReadinessProbeAffordanceOrgan.derive(Object.assign({}, readinessProbeAffordanceOptions, { handDerived }));
      const providerDerived = ProviderDeclarationHandOrgan.derive(Object.assign({}, providerDeclarationHandOptions, { affordanceDerived }));
      const researchDerived = ProviderDeclarationResearchExamOrgan.derive(Object.assign({}, providerDeclarationResearchExamOptions, { providerDerived }));
      const derived = ProviderDeclarationResearchExecutorBuilderOrgan.derive(Object.assign({}, providerDeclarationResearchExecutorBuilderOptions, { researchDerived, recipes: body.recipes }));
      const response = ProviderDeclarationResearchExecutorBuilderOrgan.respond(derived);
      session.providerDeclarationResearchExecutorBuilderResponseIds.push(response.responseDigest);
      if (heartbeat) heartbeat.beat('idle');
      return send(req, res, 200, {
        ok: true,
        response,
        batchReused: derived.reused,
        researchExamBatchReused: researchDerived.reused,
        providerDeclarationHandBatchReused: providerDerived.reused,
        sourceAffordanceBatchReused: affordanceDerived.reused,
        readinessHandBatchReused: handDerived.reused,
        readinessBatchReused: readinessDerived.reused,
        staticGraphBatchReused: handoffDerived.reused,
        observationRefresh,
        architectureSelected: false,
        architectureEvaluated: false,
        providerCandidatesBuilt: false,
        providerDeclarationsWritten: false,
        liveExperimentsExecuted: 0,
        activeRuntimeChanged: false,
        workshopChanged: false
      });
    }

    if (route === '/axm/v1/growth/readiness-probe-review' && req.method === 'POST') {
      const body = await readJson(req);
      const session = sessions.get(String(body.sessionId || ''));
      if (!session) return send(req, res, 409, { ok: false, error: 'an open explicit sessionId is required' });
      if (!session.actor || String(session.actor.kind || '').toUpperCase() !== 'HUMAN' || !String(session.actor.id || '')) return send(req, res, 403, { ok: false, error: 'probe recipe review requires an attributed HUMAN session actor' });
      if (heartbeat) heartbeat.beat('thinking');
      const { handoffDerived, readinessDerived, observationRefresh } = await deriveCurrentReadiness();
      const handDerived = ReasoningReadinessHandOrgan.derive(Object.assign({}, readinessHandOptions, { handoffDerived, readinessDerived }));
      const request = Object.assign({}, body);
      delete request.sessionId;
      const response = ReasoningReadinessProbeReviewOrgan.review(handDerived, request, session.actor);
      session.readinessProbeReviewResponseIds.push(response.responseDigest);
      if (heartbeat) heartbeat.beat('idle');
      return send(req, res, 200, {
        ok: true,
        response,
        readinessHandBatchReused: handDerived.reused,
        readinessBatchReused: readinessDerived.reused,
        staticGraphBatchReused: handoffDerived.reused,
        observationRefresh,
        candidateBuilt: false,
        activeRuntimeChanged: false,
        workshopChanged: false
      });
    }

    if (route === '/axm/v1/growth/readiness-probe-candidates' && req.method === 'POST') {
      const body = await readJson(req);
      const session = sessions.get(String(body.sessionId || ''));
      if (!session) return send(req, res, 409, { ok: false, error: 'an open explicit sessionId is required' });
      if (body.schema !== ReasoningReadinessProbeBuilderOrgan.REQUEST_SCHEMA || !Array.isArray(body.recipes)) return send(req, res, 400, { ok: false, error: `request must use ${ReasoningReadinessProbeBuilderOrgan.REQUEST_SCHEMA} with a recipes array` });
      const unexpected = Object.keys(body).filter(key => !['sessionId', 'schema', 'recipes'].includes(key));
      if (unexpected.length) return send(req, res, 400, { ok: false, error: `unknown critical readiness probe candidate request fields: ${unexpected.join(', ')}` });
      const humanSession = session.actor && String(session.actor.kind || '').toUpperCase() === 'HUMAN' && String(session.actor.id || '');
      if (body.recipes.length && (!humanSession || body.recipes.some(recipe => !recipe || !recipe.review || String(recipe.review.actorId || '') !== String(session.actor.id)))) return send(req, res, 403, { ok: false, error: 'non-empty candidate builds require a HUMAN session whose actor ID matches every reviewed recipe' });
      if (heartbeat) heartbeat.beat('thinking');
      const { handoffDerived, readinessDerived, observationRefresh } = await deriveCurrentReadiness();
      const handDerived = ReasoningReadinessHandOrgan.derive(Object.assign({}, readinessHandOptions, { handoffDerived, readinessDerived }));
      const derived = ReasoningReadinessProbeBuilderOrgan.derive(Object.assign({}, readinessProbeBuilderOptions, { handDerived, recipes: body.recipes }));
      const response = ReasoningReadinessProbeBuilderOrgan.respond(derived);
      session.readinessProbeBuilderResponseIds.push(response.responseDigest);
      if (heartbeat) heartbeat.beat('idle');
      return send(req, res, 200, {
        ok: true,
        response,
        batchReused: derived.reused,
        readinessHandBatchReused: handDerived.reused,
        readinessBatchReused: readinessDerived.reused,
        staticGraphBatchReused: handoffDerived.reused,
        observationRefresh,
        activeRuntimeChanged: false,
        workshopChanged: false,
        probesInstalled: 0,
        liveProbesExecuted: 0
      });
    }

    if (route === '/axm/v1/reasoning/experience' && req.method === 'POST') {
      const body = await readJson(req);
      const session = sessions.get(String(body.sessionId || ''));
      if (!session) return send(req, res, 409, { ok: false, error: 'an open explicit sessionId is required' });
      if (heartbeat) heartbeat.beat('thinking');
      const receipt = ReasoningExperienceOrgan.create(body.reasoningSession, body.source, body.evaluation, { at: null });
      const stored = ReasoningExperienceOrgan.store(receipt, reasoningExperienceOptions);
      session.reasoningExperienceReceiptIds.push(receipt.receiptId);
      if (heartbeat) heartbeat.beat('idle');
      return send(req, res, stored.state === 'APPENDED_PRIVATE_TRAINING_RECEIPT' ? 201 : 200, {
        ok: true,
        state: stored.state,
        receipt,
        privateReceiptFile: path.basename(stored.file),
        activeRuntimeChanged: false
      });
    }

    if (route === '/axm/v1/growth/organ-admission' && req.method === 'POST') {
      const body = await readJson(req);
      const session = sessions.get(String(body.sessionId || ''));
      if (!session) return send(req, res, 409, { ok: false, error: 'an open explicit sessionId is required' });
      if (heartbeat) heartbeat.beat('thinking');
      const assessment = OrganAdmission.assess(body);
      session.organAdmissionAssessmentIds.push(assessment.assessmentId);
      if (heartbeat) heartbeat.beat('idle');
      return send(req, res, 200, { ok: true, assessment });
    }

    if (route === '/axm/v1/reason' && req.method === 'POST') {
      const body = await readJson(req);
      if (!body.sessionId || !sessions.has(String(body.sessionId))) return send(req, res, 409, { ok: false, error: 'an open explicit sessionId is required' });
      if (heartbeat) heartbeat.beat('thinking');
      const trace = reason(body, { onTrace: item => traceStore.save(item) });
      sessions.get(String(body.sessionId)).traceIds.push(trace.traceId);
      if (heartbeat) heartbeat.beat('idle');
      return send(req, res, 200, { ok: true, trace });
    }

    if (route.startsWith('/axm/v1/trace/') && req.method === 'GET') {
      const traceId = decodeURIComponent(route.slice('/axm/v1/trace/'.length));
      const trace = traceStore.get(traceId);
      return trace ? send(req, res, 200, { ok: true, trace }) : send(req, res, 404, { ok: false, error: 'trace not found in this runtime window' });
    }

    if (route === '/axm/v1/session/close' && req.method === 'POST') {
      const body = await readJson(req);
      const session = sessions.get(String(body.sessionId || ''));
      if (!session) return send(req, res, 404, { ok: false, error: 'open session not found' });
      sessions.delete(session.id);
      session.closedAt = new Date().toISOString();
      session.memoryWrites = [];
      session.truth = 'Closing Seed-0 proposes no implicit memory writes.';
      return send(req, res, 200, { ok: true, session });
    }

    if (route === '/v1/responses' && req.method === 'POST') {
      const body = await readJson(req);
      const sessionId = String(body.sessionId || '');
      if (!sessions.has(sessionId)) return send(req, res, 409, { ok: false, error: 'an open explicit sessionId is required' });
      const raw = typeof body.input === 'string' ? body.input : JSON.stringify(body.input || '');
      const trace = reason({
        schema: 'axm.mirror.reason/v1',
        sessionId,
        actor: body.actor || { id: 'compatibility-client', kind: 'unknown' },
        goal: 'Interpret the supplied message without inventing an answer or promoting unsupported claims.',
        evidence: [{ id: 'input-message', kind: 'human-assertion', status: 'asserted', statement: raw.slice(0, 4000), source: { kind: 'compatibility-input', id: 'v1-responses' } }],
        unknowns: [{ id: 'language-organ', question: 'A native learned language organ has not been trained.', blocking: true }],
        constraints: [], permissions: [],
        actions: [{ id: 'hold-language', kind: 'hold', label: 'Preserve the message and hold for a capable collaborator', supportingEvidence: ['input-message'], risk: 'low', reversible: true, recovery: 'No world mutation occurred.' }]
      }, { onTrace: item => traceStore.save(item) });
      sessions.get(sessionId).traceIds.push(trace.traceId);
      return send(req, res, 200, {
        id: `response-${trace.traceId}`,
        object: 'response',
        model: 'mirror-kernel',
        output_text: trace.human.summary + ' ' + trace.human.boundary,
        trace
      });
    }

    if (route === '/axm/v1/runtime/stop' && req.method === 'POST') {
      if (String(req.headers['x-axm-mirror-action'] || '') !== 'explicit-stop') return send(req, res, 403, { ok: false, error: 'explicit stop header required' });
      send(req, res, 200, { ok: true, stopping: true, sessionsClosed: sessions.size });
      setTimeout(() => runtime.stop().then(() => process.exit(0)), 50);
      return;
    }
    return send(req, res, 404, { ok: false, error: 'route not found' });
  }

  const runtime = {
    config,
    tokenFile,
    token,
    get server() { return server; },
    get port() { return actualPort; },
    start() {
      if (server) return Promise.resolve(runtime);
      server = http.createServer((req, res) => handle(req, res).catch(error => {
        if (!res.headersSent) send(req, res, Number(error.status) || 400, { ok: false, error: String(error.message || error).slice(0, 500) });
        else res.end();
      }));
      return new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(Number(config.port), config.host, () => {
          actualPort = server.address().port;
          if (options.presence !== false && config.presenceEnabled !== false) heartbeat = startWorkshopHeartbeat({ workshopUrl: config.workshopUrl, intervalMs: config.presenceIntervalMs });
          if (options.persist !== false) {
            fs.mkdirSync(path.join(ROOT, 'state'), { recursive: true });
            fs.writeFileSync(path.join(ROOT, 'state', 'runtime.pid'), String(process.pid) + '\n', 'utf8');
            fs.appendFileSync(path.join(ROOT, 'logs', 'mirror-events.jsonl'), JSON.stringify({ at: new Date().toISOString(), event: 'runtime-start', identity: 'axm.machine.mirror/seed-0', port: actualPort }) + '\n');
          }
          if (options.persist !== false && config.automaticPracticeOnStart !== false) {
            const delay = Math.max(250, Math.min(30000, Number(config.automaticPracticeDelayMs) || 1500));
            practiceTimer = setTimeout(() => {
              practiceTimer = null;
              practiceStatus = Object.assign({}, practiceStatus, { state: 'RUNNING', lastError: null });
              const Curriculum = require('../training/workshop-steward-curriculum');
              Curriculum.run({ root: ROOT, baseUrl: `http://${config.host === '::1' ? '[::1]' : config.host}:${actualPort}`, workshopUrl: config.workshopUrl }).then(result => {
                practiceStatus = Object.assign({}, practiceStatus, {
                  state: result.report.learning && result.report.learning.state || 'COMPLETE',
                  lastReportId: result.report.reportId,
                  lastCycleId: result.report.learning && result.report.learning.cycleId || null,
                  lastReasoningCycleId: result.report.reasoningLearning && result.report.reasoningLearning.cycleId || null,
                  lastHandoffGraphBatchId: result.report.reasoningLearning && result.report.reasoningLearning.handoffGraphBatchId || null,
                  handoffGraphEligibleContracts: result.report.reasoningLearning && result.report.reasoningLearning.handoffGraph && result.report.reasoningLearning.handoffGraph.eligibleContracts || 0,
                  handoffGraphManifestBindingsPassed: result.report.reasoningLearning && result.report.reasoningLearning.handoffGraph && result.report.reasoningLearning.handoffGraph.manifestBindingsPassed || 0,
                  handoffGraphManifestBindingsFailed: result.report.reasoningLearning && result.report.reasoningLearning.handoffGraph && result.report.reasoningLearning.handoffGraph.manifestBindingsFailed || 0,
                  handoffGraphUndeclaredContractFiles: result.report.reasoningLearning && result.report.reasoningLearning.handoffGraph && result.report.reasoningLearning.handoffGraph.undeclaredContractFiles || 0,
                  handoffGraphExactEdges: result.report.reasoningLearning && result.report.reasoningLearning.handoffGraph && result.report.reasoningLearning.handoffGraph.exactCrossModuleEdges || 0,
                  handoffGraphDirectRoutes: result.report.reasoningLearning && result.report.reasoningLearning.handoffGraph && result.report.reasoningLearning.handoffGraph.directRoutes || 0,
                  handoffGraphComposedRoutes: result.report.reasoningLearning && result.report.reasoningLearning.handoffGraph && result.report.reasoningLearning.handoffGraph.composedDepthTwoRoutes || 0,
                  handoffGraphExactRoutesSelected: result.report.reasoningLearning && result.report.reasoningLearning.handoffGraph && result.report.reasoningLearning.handoffGraph.exactRoutesSelected || 0,
                  handoffGraphUnboundDecoysRejected: result.report.reasoningLearning && result.report.reasoningLearning.handoffGraph && result.report.reasoningLearning.handoffGraph.unboundDecoysRejected || 0,
                  handoffGraphRouteMismatches: result.report.reasoningLearning && result.report.reasoningLearning.handoffGraph && result.report.reasoningLearning.handoffGraph.routeSelectionMismatches || 0,
                  handoffGraphTrainingReceipts: result.report.reasoningLearning && result.report.reasoningLearning.handoffGraph && result.report.reasoningLearning.handoffGraph.trainingReceiptsCreated || 0,
                  handoffGraphWorldActions: result.report.reasoningLearning && result.report.reasoningLearning.handoffGraph && result.report.reasoningLearning.handoffGraph.worldActionsExecuted || 0,
                  lastRouteReadinessBatchId: result.report.reasoningLearning && result.report.reasoningLearning.routeReadinessBatchId || null,
                  routeReadinessGraphRoutes: result.report.reasoningLearning && result.report.reasoningLearning.routeReadiness && result.report.reasoningLearning.routeReadiness.graphRoutes || 0,
                  routeReadinessGraphModules: result.report.reasoningLearning && result.report.reasoningLearning.routeReadiness && result.report.reasoningLearning.routeReadiness.graphModules || 0,
                  routeReadinessRequirements: result.report.reasoningLearning && result.report.reasoningLearning.routeReadiness && result.report.reasoningLearning.routeReadiness.readinessRequirements || 0,
                  routeReadinessReadyRoutes: result.report.reasoningLearning && result.report.reasoningLearning.routeReadiness && result.report.reasoningLearning.routeReadiness.readyRoutes || 0,
                  routeReadinessAvailableRoutes: result.report.reasoningLearning && result.report.reasoningLearning.routeReadiness && result.report.reasoningLearning.routeReadiness.availableRoutes || 0,
                  routeReadinessNeedsActionRoutes: result.report.reasoningLearning && result.report.reasoningLearning.routeReadiness && result.report.reasoningLearning.routeReadiness.needsActionRoutes || 0,
                  routeReadinessBlockedRoutes: result.report.reasoningLearning && result.report.reasoningLearning.routeReadiness && result.report.reasoningLearning.routeReadiness.blockedRoutes || 0,
                  routeReadinessClassificationMismatches: result.report.reasoningLearning && result.report.reasoningLearning.routeReadiness && result.report.reasoningLearning.routeReadiness.classificationMismatches || 0,
                  routeReadinessTrainingReceipts: result.report.reasoningLearning && result.report.reasoningLearning.routeReadiness && result.report.reasoningLearning.routeReadiness.trainingReceiptsCreated || 0,
                  routeReadinessWorldActions: result.report.reasoningLearning && result.report.reasoningLearning.routeReadiness && result.report.reasoningLearning.routeReadiness.worldActionsExecuted || 0,
                  lastReadinessHandBatchId: result.report.reasoningLearning && result.report.reasoningLearning.readinessHandBatchId || null,
                  readinessHandUnknownRequirements: result.report.reasoningLearning && result.report.reasoningLearning.readinessHands && result.report.reasoningLearning.readinessHands.unknownRequirementIds || 0,
                  readinessHandRequests: result.report.reasoningLearning && result.report.reasoningLearning.readinessHands && result.report.reasoningLearning.readinessHands.missingProbeHandRequests || 0,
                  readinessHandInspectionHolds: result.report.reasoningLearning && result.report.reasoningLearning.readinessHands && result.report.reasoningLearning.readinessHands.unknownInspectionHolds || 0,
                  readinessHandImpactedRoutes: result.report.reasoningLearning && result.report.reasoningLearning.readinessHands && result.report.reasoningLearning.readinessHands.impactedManifestBoundRoutes || 0,
                  readinessHandClassificationMismatches: result.report.reasoningLearning && result.report.reasoningLearning.readinessHands && result.report.reasoningLearning.readinessHands.classificationMismatches || 0,
                  readinessHandCodeFilesGenerated: result.report.reasoningLearning && result.report.reasoningLearning.readinessHands && result.report.reasoningLearning.readinessHands.codeFilesGenerated || 0,
                  readinessHandProbesInstalled: result.report.reasoningLearning && result.report.reasoningLearning.readinessHands && result.report.reasoningLearning.readinessHands.probesInstalled || 0,
                  readinessHandServicesStartedOrRepaired: result.report.reasoningLearning && result.report.reasoningLearning.readinessHands && result.report.reasoningLearning.readinessHands.servicesStartedOrRepaired || 0,
                  readinessHandTrainingReceipts: result.report.reasoningLearning && result.report.reasoningLearning.readinessHands && result.report.reasoningLearning.readinessHands.trainingReceiptsCreated || 0,
                  readinessHandWorldActions: result.report.reasoningLearning && result.report.reasoningLearning.readinessHands && result.report.reasoningLearning.readinessHands.worldActionsExecuted || 0,
                  lastReadinessProbeAffordanceBatchId: result.report.reasoningLearning && result.report.reasoningLearning.readinessProbeAffordanceBatchId || null,
                  readinessProbeAffordanceHandsAssessed: result.report.reasoningLearning && result.report.reasoningLearning.readinessProbeAffordances && result.report.reasoningLearning.readinessProbeAffordances.handRequestsAssessed || 0,
                  readinessProbeAffordanceFoundationServiceReviewPackets: result.report.reasoningLearning && result.report.reasoningLearning.readinessProbeAffordances && result.report.reasoningLearning.readinessProbeAffordances.exactFoundationServiceReviewPackets || 0,
                  readinessProbeAffordanceReviewPackets: result.report.reasoningLearning && result.report.reasoningLearning.readinessProbeAffordances && result.report.reasoningLearning.readinessProbeAffordances.reviewPacketsProposed || 0,
                  readinessProbeAffordanceHolds: result.report.reasoningLearning && result.report.reasoningLearning.readinessProbeAffordances && ((result.report.reasoningLearning.readinessProbeAffordances.noProviderHolds || 0) + (result.report.reasoningLearning.readinessProbeAffordances.ambiguousProviderHolds || 0)) || 0,
                  readinessProbeAffordanceNameInferencesRejected: result.report.reasoningLearning && result.report.reasoningLearning.readinessProbeAffordances && result.report.reasoningLearning.readinessProbeAffordances.nameInferenceCandidatesRejected || 0,
                  readinessProbeAffordanceFalseReadyRejected: result.report.reasoningLearning && result.report.reasoningLearning.readinessProbeAffordances && result.report.reasoningLearning.readinessProbeAffordances.falseReadyCandidatesRejected || 0,
                  readinessProbeAffordanceHumanReviews: result.report.reasoningLearning && result.report.reasoningLearning.readinessProbeAffordances && result.report.reasoningLearning.readinessProbeAffordances.humanReviewsCreated || 0,
                  readinessProbeAffordanceRecipesSealed: result.report.reasoningLearning && result.report.reasoningLearning.readinessProbeAffordances && result.report.reasoningLearning.readinessProbeAffordances.recipesSealed || 0,
                  readinessProbeAffordanceCandidatesBuilt: result.report.reasoningLearning && result.report.reasoningLearning.readinessProbeAffordances && result.report.reasoningLearning.readinessProbeAffordances.candidatesBuilt || 0,
                  readinessProbeAffordanceLiveExecutions: result.report.reasoningLearning && result.report.reasoningLearning.readinessProbeAffordances && result.report.reasoningLearning.readinessProbeAffordances.liveProbesExecuted || 0,
                  readinessProbeAffordanceWorkshopFilesChanged: result.report.reasoningLearning && result.report.reasoningLearning.readinessProbeAffordances && result.report.reasoningLearning.readinessProbeAffordances.workshopFilesChanged || 0,
                  lastProviderDeclarationHandBatchId: result.report.reasoningLearning && result.report.reasoningLearning.providerDeclarationHandBatchId || null,
                  providerDeclarationAffordanceAssessments: result.report.reasoningLearning && result.report.reasoningLearning.providerDeclarationHands && result.report.reasoningLearning.providerDeclarationHands.affordanceAssessmentsEvaluated || 0,
                  providerDeclarationHandsProposed: result.report.reasoningLearning && result.report.reasoningLearning.providerDeclarationHands && result.report.reasoningLearning.providerDeclarationHands.providerDeclarationHandsProposed || 0,
                  providerDeclarationsPresentNoGap: result.report.reasoningLearning && result.report.reasoningLearning.providerDeclarationHands && result.report.reasoningLearning.providerDeclarationHands.declarationsPresentNoGap || 0,
                  providerDeclarationHolds: result.report.reasoningLearning && result.report.reasoningLearning.providerDeclarationHands && ((result.report.reasoningLearning.providerDeclarationHands.noConsumerDemandHolds || 0) + (result.report.reasoningLearning.providerDeclarationHands.ambiguousProviderHolds || 0)) || 0,
                  providerDeclarationInferencesRejected: result.report.reasoningLearning && result.report.reasoningLearning.providerDeclarationHands && result.report.reasoningLearning.providerDeclarationHands.providerInferenceCandidatesRejected || 0,
                  providerDeclarationFalseAvailableRejected: result.report.reasoningLearning && result.report.reasoningLearning.providerDeclarationHands && result.report.reasoningLearning.providerDeclarationHands.falseAvailableCandidatesRejected || 0,
                  providerDeclarationCandidateFiles: result.report.reasoningLearning && result.report.reasoningLearning.providerDeclarationHands && result.report.reasoningLearning.providerDeclarationHands.declarationCandidateFilesGenerated || 0,
                  providerDeclarationsWritten: result.report.reasoningLearning && result.report.reasoningLearning.providerDeclarationHands && result.report.reasoningLearning.providerDeclarationHands.providerDeclarationsWritten || 0,
                  providerDeclarationLiveExecutions: result.report.reasoningLearning && result.report.reasoningLearning.providerDeclarationHands && result.report.reasoningLearning.providerDeclarationHands.liveProbesExecuted || 0,
                  providerDeclarationWorkshopFilesChanged: result.report.reasoningLearning && result.report.reasoningLearning.providerDeclarationHands && result.report.reasoningLearning.providerDeclarationHands.workshopFilesChanged || 0,
                  lastProviderDeclarationResearchExamBatchId: result.report.reasoningLearning && result.report.reasoningLearning.providerDeclarationResearchExamBatchId || null,
                  providerDeclarationResearchHandResults: result.report.reasoningLearning && result.report.reasoningLearning.providerDeclarationResearchExams && result.report.reasoningLearning.providerDeclarationResearchExams.providerDeclarationHandResultsEvaluated || 0,
                  providerDeclarationResearchExamsProposed: result.report.reasoningLearning && result.report.reasoningLearning.providerDeclarationResearchExams && result.report.reasoningLearning.providerDeclarationResearchExams.researchExamRequestsProposed || 0,
                  providerDeclarationResearchFrontierExamRequired: result.report.reasoningLearning && result.report.reasoningLearning.providerDeclarationResearchExams && result.report.reasoningLearning.providerDeclarationResearchExams.frontierExamRequired || 0,
                  providerDeclarationResearchProviderBuildsRejected: result.report.reasoningLearning && result.report.reasoningLearning.providerDeclarationResearchExams && result.report.reasoningLearning.providerDeclarationResearchExams.providerBuildCandidatesRejected || 0,
                  providerDeclarationResearchFalseResolutionsRejected: result.report.reasoningLearning && result.report.reasoningLearning.providerDeclarationResearchExams && result.report.reasoningLearning.providerDeclarationResearchExams.falseResolutionCandidatesRejected || 0,
                  providerDeclarationResearchArchitecturesSelected: result.report.reasoningLearning && result.report.reasoningLearning.providerDeclarationResearchExams && result.report.reasoningLearning.providerDeclarationResearchExams.architecturesSelected || 0,
                  providerDeclarationResearchExecutorsBuilt: result.report.reasoningLearning && result.report.reasoningLearning.providerDeclarationResearchExams && result.report.reasoningLearning.providerDeclarationResearchExams.examExecutorsBuilt || 0,
                  providerDeclarationResearchFixtureFiles: result.report.reasoningLearning && result.report.reasoningLearning.providerDeclarationResearchExams && result.report.reasoningLearning.providerDeclarationResearchExams.fixtureFilesGenerated || 0,
                  providerDeclarationResearchProviderCandidates: result.report.reasoningLearning && result.report.reasoningLearning.providerDeclarationResearchExams && result.report.reasoningLearning.providerDeclarationResearchExams.providerCandidatesBuilt || 0,
                  providerDeclarationResearchDeclarationsWritten: result.report.reasoningLearning && result.report.reasoningLearning.providerDeclarationResearchExams && result.report.reasoningLearning.providerDeclarationResearchExams.providerDeclarationsWritten || 0,
                  providerDeclarationResearchLiveExperiments: result.report.reasoningLearning && result.report.reasoningLearning.providerDeclarationResearchExams && result.report.reasoningLearning.providerDeclarationResearchExams.liveExperimentsExecuted || 0,
                   providerDeclarationResearchWorkshopFilesChanged: result.report.reasoningLearning && result.report.reasoningLearning.providerDeclarationResearchExams && result.report.reasoningLearning.providerDeclarationResearchExams.workshopFilesChanged || 0,
                   lastProviderDeclarationResearchExecutorBatchId: result.report.reasoningLearning && result.report.reasoningLearning.providerDeclarationResearchExecutorBatchId || null,
                   providerDeclarationResearchExecutorReviewedRecipes: result.report.reasoningLearning && result.report.reasoningLearning.providerDeclarationResearchExecutors && result.report.reasoningLearning.providerDeclarationResearchExecutors.reviewedRecipes || 0,
                   providerDeclarationResearchExecutorCandidatesBuilt: result.report.reasoningLearning && result.report.reasoningLearning.providerDeclarationResearchExecutors && result.report.reasoningLearning.providerDeclarationResearchExecutors.executorCandidatesBuilt || 0,
                   providerDeclarationResearchExecutorCandidateFiles: result.report.reasoningLearning && result.report.reasoningLearning.providerDeclarationResearchExecutors && result.report.reasoningLearning.providerDeclarationResearchExecutors.candidateFilesGenerated || 0,
                   providerDeclarationResearchExecutorFixtureCases: result.report.reasoningLearning && result.report.reasoningLearning.providerDeclarationResearchExecutors && result.report.reasoningLearning.providerDeclarationResearchExecutors.fixtureCasesExecuted || 0,
                   providerDeclarationResearchExecutorArchitecturesSelected: result.report.reasoningLearning && result.report.reasoningLearning.providerDeclarationResearchExecutors && result.report.reasoningLearning.providerDeclarationResearchExecutors.architecturesSelected || 0,
                   providerDeclarationResearchExecutorArchitecturesEvaluated: result.report.reasoningLearning && result.report.reasoningLearning.providerDeclarationResearchExecutors && result.report.reasoningLearning.providerDeclarationResearchExecutors.architecturesEvaluated || 0,
                   providerDeclarationResearchExecutorProviderCandidates: result.report.reasoningLearning && result.report.reasoningLearning.providerDeclarationResearchExecutors && result.report.reasoningLearning.providerDeclarationResearchExecutors.providerCandidatesBuilt || 0,
                   providerDeclarationResearchExecutorWorkshopFilesChanged: result.report.reasoningLearning && result.report.reasoningLearning.providerDeclarationResearchExecutors && result.report.reasoningLearning.providerDeclarationResearchExecutors.workshopFilesChanged || 0,
                   providerDeclarationResearchExecutorTrainingReceipts: result.report.reasoningLearning && result.report.reasoningLearning.providerDeclarationResearchExecutors && result.report.reasoningLearning.providerDeclarationResearchExecutors.trainingReceiptsCreated || 0,
                   lastProviderDeclarationArchitectureSurveyBatchId: result.report.reasoningLearning && result.report.reasoningLearning.providerDeclarationArchitectureSurveyBatchId || null,
                   providerDeclarationArchitectureSurveyResearchResults: result.report.reasoningLearning && result.report.reasoningLearning.providerDeclarationArchitectureSurveys && result.report.reasoningLearning.providerDeclarationArchitectureSurveys.researchExamResultsEvaluated || 0,
                   providerDeclarationArchitectureSurveysProposed: result.report.reasoningLearning && result.report.reasoningLearning.providerDeclarationArchitectureSurveys && result.report.reasoningLearning.providerDeclarationArchitectureSurveys.surveysProposed || 0,
                   providerDeclarationArchitectureSurveyDocuments: result.report.reasoningLearning && result.report.reasoningLearning.providerDeclarationArchitectureSurveys && result.report.reasoningLearning.providerDeclarationArchitectureSurveys.inventoryDocuments || 0,
                   providerDeclarationArchitectureSurveyRelevantPatterns: result.report.reasoningLearning && result.report.reasoningLearning.providerDeclarationArchitectureSurveys && result.report.reasoningLearning.providerDeclarationArchitectureSurveys.relevantPatternAssessments || 0,
                   providerDeclarationArchitectureSurveyCompleteWitnesses: result.report.reasoningLearning && result.report.reasoningLearning.providerDeclarationArchitectureSurveys && result.report.reasoningLearning.providerDeclarationArchitectureSurveys.completeCurrentRelationWitnesses || 0,
                   providerDeclarationArchitectureSurveyHypothesesUntested: result.report.reasoningLearning && result.report.reasoningLearning.providerDeclarationArchitectureSurveys && result.report.reasoningLearning.providerDeclarationArchitectureSurveys.hypothesesRemainingUntested || 0,
                   providerDeclarationArchitectureSurveyFrequencySelectionsRejected: result.report.reasoningLearning && result.report.reasoningLearning.providerDeclarationArchitectureSurveys && result.report.reasoningLearning.providerDeclarationArchitectureSurveys.frequencySelectionsRejected || 0,
                   providerDeclarationArchitectureSurveyCrossDocumentMergesRejected: result.report.reasoningLearning && result.report.reasoningLearning.providerDeclarationArchitectureSurveys && result.report.reasoningLearning.providerDeclarationArchitectureSurveys.crossDocumentMergesRejected || 0,
                   providerDeclarationArchitectureSurveyArchitecturesSelected: result.report.reasoningLearning && result.report.reasoningLearning.providerDeclarationArchitectureSurveys && result.report.reasoningLearning.providerDeclarationArchitectureSurveys.architecturesSelected || 0,
                   providerDeclarationArchitectureSurveyArchitecturesEvaluated: result.report.reasoningLearning && result.report.reasoningLearning.providerDeclarationArchitectureSurveys && result.report.reasoningLearning.providerDeclarationArchitectureSurveys.architecturesEvaluated || 0,
                   providerDeclarationArchitectureSurveyProviderCandidates: result.report.reasoningLearning && result.report.reasoningLearning.providerDeclarationArchitectureSurveys && result.report.reasoningLearning.providerDeclarationArchitectureSurveys.providerCandidatesBuilt || 0,
                   providerDeclarationArchitectureSurveyWorkshopFilesChanged: result.report.reasoningLearning && result.report.reasoningLearning.providerDeclarationArchitectureSurveys && result.report.reasoningLearning.providerDeclarationArchitectureSurveys.workshopFilesChanged || 0,
                   providerDeclarationArchitectureSurveyTrainingReceipts: result.report.reasoningLearning && result.report.reasoningLearning.providerDeclarationArchitectureSurveys && result.report.reasoningLearning.providerDeclarationArchitectureSurveys.trainingReceiptsCreated || 0,
                   lastProviderDeclarationImplementationEvidenceSurveyBatchId: result.report.reasoningLearning && result.report.reasoningLearning.providerDeclarationImplementationEvidenceSurveyBatchId || null,
                   providerDeclarationImplementationEvidenceArchitectureResults: result.report.reasoningLearning && result.report.reasoningLearning.providerDeclarationImplementationEvidenceSurveys && result.report.reasoningLearning.providerDeclarationImplementationEvidenceSurveys.architectureSurveyResultsEvaluated || 0,
                   providerDeclarationImplementationEvidenceSurveysProposed: result.report.reasoningLearning && result.report.reasoningLearning.providerDeclarationImplementationEvidenceSurveys && result.report.reasoningLearning.providerDeclarationImplementationEvidenceSurveys.evidenceSurveysProposed || 0,
                   providerDeclarationImplementationEvidenceSources: result.report.reasoningLearning && result.report.reasoningLearning.providerDeclarationImplementationEvidenceSurveys && result.report.reasoningLearning.providerDeclarationImplementationEvidenceSurveys.inventorySources || 0,
                   providerDeclarationImplementationEvidenceSelectorSources: result.report.reasoningLearning && result.report.reasoningLearning.providerDeclarationImplementationEvidenceSurveys && result.report.reasoningLearning.providerDeclarationImplementationEvidenceSurveys.selectorBearingSources || 0,
                   providerDeclarationImplementationEvidenceSelectorsWitnessed: result.report.reasoningLearning && result.report.reasoningLearning.providerDeclarationImplementationEvidenceSurveys && result.report.reasoningLearning.providerDeclarationImplementationEvidenceSurveys.demandedSelectorsWitnessed || 0,
                   providerDeclarationImplementationEvidenceProviderInferencesRejected: result.report.reasoningLearning && result.report.reasoningLearning.providerDeclarationImplementationEvidenceSurveys && result.report.reasoningLearning.providerDeclarationImplementationEvidenceSurveys.providerInferencesRejected || 0,
                   providerDeclarationImplementationEvidenceFrequencySelectionsRejected: result.report.reasoningLearning && result.report.reasoningLearning.providerDeclarationImplementationEvidenceSurveys && result.report.reasoningLearning.providerDeclarationImplementationEvidenceSurveys.frequencySelectionsRejected || 0,
                   providerDeclarationImplementationEvidenceProvidersInferred: result.report.reasoningLearning && result.report.reasoningLearning.providerDeclarationImplementationEvidenceSurveys && result.report.reasoningLearning.providerDeclarationImplementationEvidenceSurveys.providerIdentitiesInferred || 0,
                   providerDeclarationImplementationEvidenceOuterRequirementsBound: result.report.reasoningLearning && result.report.reasoningLearning.providerDeclarationImplementationEvidenceSurveys && result.report.reasoningLearning.providerDeclarationImplementationEvidenceSurveys.outerRequirementsBound || 0,
                   providerDeclarationImplementationEvidenceImplementationsSelected: result.report.reasoningLearning && result.report.reasoningLearning.providerDeclarationImplementationEvidenceSurveys && result.report.reasoningLearning.providerDeclarationImplementationEvidenceSurveys.implementationsSelected || 0,
                   providerDeclarationImplementationEvidenceSourcesExecuted: result.report.reasoningLearning && result.report.reasoningLearning.providerDeclarationImplementationEvidenceSurveys && result.report.reasoningLearning.providerDeclarationImplementationEvidenceSurveys.sourcesExecuted || 0,
                   providerDeclarationImplementationEvidenceArchitecturesSelected: result.report.reasoningLearning && result.report.reasoningLearning.providerDeclarationImplementationEvidenceSurveys && result.report.reasoningLearning.providerDeclarationImplementationEvidenceSurveys.architecturesSelected || 0,
                   providerDeclarationImplementationEvidenceArchitecturesEvaluated: result.report.reasoningLearning && result.report.reasoningLearning.providerDeclarationImplementationEvidenceSurveys && result.report.reasoningLearning.providerDeclarationImplementationEvidenceSurveys.architecturesEvaluated || 0,
                   providerDeclarationImplementationEvidenceProviderCandidates: result.report.reasoningLearning && result.report.reasoningLearning.providerDeclarationImplementationEvidenceSurveys && result.report.reasoningLearning.providerDeclarationImplementationEvidenceSurveys.providerCandidatesBuilt || 0,
                   providerDeclarationImplementationEvidenceWorkshopFilesChanged: result.report.reasoningLearning && result.report.reasoningLearning.providerDeclarationImplementationEvidenceSurveys && result.report.reasoningLearning.providerDeclarationImplementationEvidenceSurveys.workshopFilesChanged || 0,
                   providerDeclarationImplementationEvidenceTrainingReceipts: result.report.reasoningLearning && result.report.reasoningLearning.providerDeclarationImplementationEvidenceSurveys && result.report.reasoningLearning.providerDeclarationImplementationEvidenceSurveys.trainingReceiptsCreated || 0,
                   lastProviderDeclarationBindingExperimentBatchId: result.report.reasoningLearning && result.report.reasoningLearning.providerDeclarationBindingExperimentBatchId || null,
                   providerDeclarationBindingExperimentImplementationResults: result.report.reasoningLearning && result.report.reasoningLearning.providerDeclarationBindingExperiments && result.report.reasoningLearning.providerDeclarationBindingExperiments.implementationEvidenceResultsEvaluated || 0,
                   providerDeclarationBindingExperimentMatrices: result.report.reasoningLearning && result.report.reasoningLearning.providerDeclarationBindingExperiments && result.report.reasoningLearning.providerDeclarationBindingExperiments.experimentMatricesProposed || 0,
                   providerDeclarationBindingExperimentCandidateSources: result.report.reasoningLearning && result.report.reasoningLearning.providerDeclarationBindingExperiments && result.report.reasoningLearning.providerDeclarationBindingExperiments.candidateSourceWitnesses || 0,
                   providerDeclarationBindingExperimentValidationWitnesses: result.report.reasoningLearning && result.report.reasoningLearning.providerDeclarationBindingExperiments && result.report.reasoningLearning.providerDeclarationBindingExperiments.validationOnlyWitnesses || 0,
                   providerDeclarationBindingExperimentHypotheses: result.report.reasoningLearning && result.report.reasoningLearning.providerDeclarationBindingExperiments && result.report.reasoningLearning.providerDeclarationBindingExperiments.architectureHypothesesRepresented || 0,
                   providerDeclarationBindingExperimentFrames: result.report.reasoningLearning && result.report.reasoningLearning.providerDeclarationBindingExperiments && result.report.reasoningLearning.providerDeclarationBindingExperiments.experimentFramesProposed || 0,
                   providerDeclarationBindingExperimentFrameSelectionsRejected: result.report.reasoningLearning && result.report.reasoningLearning.providerDeclarationBindingExperiments && result.report.reasoningLearning.providerDeclarationBindingExperiments.frameSelectionsRejected || 0,
                   providerDeclarationBindingExperimentPermissionCopiesRejected: result.report.reasoningLearning && result.report.reasoningLearning.providerDeclarationBindingExperiments && result.report.reasoningLearning.providerDeclarationBindingExperiments.permissionCopiesRejected || 0,
                   providerDeclarationBindingExperimentFramesSelected: result.report.reasoningLearning && result.report.reasoningLearning.providerDeclarationBindingExperiments && result.report.reasoningLearning.providerDeclarationBindingExperiments.framesSelected || 0,
                   providerDeclarationBindingExperimentProvidersInferred: result.report.reasoningLearning && result.report.reasoningLearning.providerDeclarationBindingExperiments && result.report.reasoningLearning.providerDeclarationBindingExperiments.providerIdentitiesInferred || 0,
                   providerDeclarationBindingExperimentPermissionsInferred: result.report.reasoningLearning && result.report.reasoningLearning.providerDeclarationBindingExperiments && result.report.reasoningLearning.providerDeclarationBindingExperiments.permissionsInferred || 0,
                   providerDeclarationBindingExperimentSourcesExecuted: result.report.reasoningLearning && result.report.reasoningLearning.providerDeclarationBindingExperiments && result.report.reasoningLearning.providerDeclarationBindingExperiments.sourcesExecuted || 0,
                   providerDeclarationBindingExperimentProviderCandidates: result.report.reasoningLearning && result.report.reasoningLearning.providerDeclarationBindingExperiments && result.report.reasoningLearning.providerDeclarationBindingExperiments.providerCandidatesBuilt || 0,
                   providerDeclarationBindingExperimentWorkshopFilesChanged: result.report.reasoningLearning && result.report.reasoningLearning.providerDeclarationBindingExperiments && result.report.reasoningLearning.providerDeclarationBindingExperiments.workshopFilesChanged || 0,
                   providerDeclarationBindingExperimentTrainingReceipts: result.report.reasoningLearning && result.report.reasoningLearning.providerDeclarationBindingExperiments && result.report.reasoningLearning.providerDeclarationBindingExperiments.trainingReceiptsCreated || 0,
                  lastReadinessProbeCandidateBatchId: result.report.reasoningLearning && result.report.reasoningLearning.readinessProbeCandidateBatchId || null,
                  readinessProbeReviewedRecipes: result.report.reasoningLearning && result.report.reasoningLearning.readinessProbeCandidates && result.report.reasoningLearning.readinessProbeCandidates.reviewedRecipes || 0,
                  readinessProbeCandidatesBuilt: result.report.reasoningLearning && result.report.reasoningLearning.readinessProbeCandidates && result.report.reasoningLearning.readinessProbeCandidates.candidatesBuilt || 0,
                  readinessProbeCandidateCodeFiles: result.report.reasoningLearning && result.report.reasoningLearning.readinessProbeCandidates && result.report.reasoningLearning.readinessProbeCandidates.candidateCodeFilesGenerated || 0,
                  readinessProbeFixtureSuitesPassed: result.report.reasoningLearning && result.report.reasoningLearning.readinessProbeCandidates && result.report.reasoningLearning.readinessProbeCandidates.fixtureSuitesPassed || 0,
                  readinessProbeFixtureSuitesFailed: result.report.reasoningLearning && result.report.reasoningLearning.readinessProbeCandidates && result.report.reasoningLearning.readinessProbeCandidates.fixtureSuitesFailed || 0,
                  readinessProbeProbesInstalled: result.report.reasoningLearning && result.report.reasoningLearning.readinessProbeCandidates && result.report.reasoningLearning.readinessProbeCandidates.probesInstalled || 0,
                  readinessProbeLiveExecutions: result.report.reasoningLearning && result.report.reasoningLearning.readinessProbeCandidates && result.report.reasoningLearning.readinessProbeCandidates.liveProbesExecuted || 0,
                  readinessProbeWorkshopFilesChanged: result.report.reasoningLearning && result.report.reasoningLearning.readinessProbeCandidates && result.report.reasoningLearning.readinessProbeCandidates.workshopFilesChanged || 0,
                  readinessProbeTrainingReceipts: result.report.reasoningLearning && result.report.reasoningLearning.readinessProbeCandidates && result.report.reasoningLearning.readinessProbeCandidates.trainingReceiptsCreated || 0,
                  readinessProbeWorldActions: result.report.reasoningLearning && result.report.reasoningLearning.readinessProbeCandidates && result.report.reasoningLearning.readinessProbeCandidates.worldActionsExecuted || 0,
                  lastContractCurriculumBatchId: result.report.reasoningLearning && result.report.reasoningLearning.contractCurriculumBatchId || null,
                  contractEligibleContracts: result.report.reasoningLearning && result.report.reasoningLearning.contractCurriculum && result.report.reasoningLearning.contractCurriculum.eligibleContracts || 0,
                  contractPrivateTrainingExams: result.report.reasoningLearning && result.report.reasoningLearning.contractCurriculum && result.report.reasoningLearning.contractCurriculum.privateTrainingExams || 0,
                  contractHeldOutExams: result.report.reasoningLearning && result.report.reasoningLearning.contractCurriculum && result.report.reasoningLearning.contractCurriculum.heldOutEvaluationExams || 0,
                  contractBoundariesPreserved: result.report.reasoningLearning && result.report.reasoningLearning.contractCurriculum && result.report.reasoningLearning.contractCurriculum.boundaryPreserved || 0,
                  contractBoundaryMismatches: result.report.reasoningLearning && result.report.reasoningLearning.contractCurriculum && result.report.reasoningLearning.contractCurriculum.boundaryMismatches || 0,
                  contractHeldOutChallengerPassed: result.report.reasoningLearning && result.report.reasoningLearning.contractCurriculum && result.report.reasoningLearning.contractCurriculum.heldOutChallengerPassed || 0,
                  contractHeldOutChallengerFailed: result.report.reasoningLearning && result.report.reasoningLearning.contractCurriculum && result.report.reasoningLearning.contractCurriculum.heldOutChallengerFailed || 0,
                  contractHeldOutTrainingReceipts: result.report.reasoningLearning && result.report.reasoningLearning.contractCurriculum && result.report.reasoningLearning.contractCurriculum.heldOutTrainingReceiptsCreated || 0,
                  lastCounterexampleBatchId: result.report.reasoningLearning && result.report.reasoningLearning.counterexampleBatchId || null,
                  lastMetamorphicBatchId: result.report.reasoningLearning && result.report.reasoningLearning.metamorphicBatchId || null,
                  metamorphicProbes: result.report.reasoningLearning && result.report.reasoningLearning.metamorphic && result.report.reasoningLearning.metamorphic.probes || 0,
                  metamorphicAtomicProbes: result.report.reasoningLearning && result.report.reasoningLearning.metamorphic && result.report.reasoningLearning.metamorphic.atomicProbes || 0,
                  metamorphicComposedProbes: result.report.reasoningLearning && result.report.reasoningLearning.metamorphic && result.report.reasoningLearning.metamorphic.composedProbes || 0,
                  metamorphicInvariantConfirmed: result.report.reasoningLearning && result.report.reasoningLearning.metamorphic && result.report.reasoningLearning.metamorphic.invariantConfirmed || 0,
                  metamorphicCounterexamplesFound: result.report.reasoningLearning && result.report.reasoningLearning.metamorphic && result.report.reasoningLearning.metamorphic.counterexamplesFound || 0,
                  metamorphicNegativeReceipts: result.report.reasoningLearning && result.report.reasoningLearning.metamorphic &&
                    ((result.report.reasoningLearning.metamorphic.negativeReceiptsAppended || 0) + (result.report.reasoningLearning.metamorphic.negativeReceiptsReused || 0)) || 0,
                  lastFailureCurriculumBatchId: result.report.reasoningLearning && result.report.reasoningLearning.failureCurriculumBatchId || null,
                  failureCurriculumRealPositiveReceipts: result.report.reasoningLearning && result.report.reasoningLearning.failureCurriculum && result.report.reasoningLearning.failureCurriculum.realLocalPositiveReceipts || 0,
                  failureCurriculumRealNegativeReceipts: result.report.reasoningLearning && result.report.reasoningLearning.failureCurriculum && result.report.reasoningLearning.failureCurriculum.realLocalNegativeReceipts || 0,
                  failureCurriculumDistinctSignatures: result.report.reasoningLearning && result.report.reasoningLearning.failureCurriculum && result.report.reasoningLearning.failureCurriculum.distinctFailureSignatures || 0,
                  failureCurriculumRecurrentSignatures: result.report.reasoningLearning && result.report.reasoningLearning.failureCurriculum && result.report.reasoningLearning.failureCurriculum.recurrentFailureSignatures || 0,
                  failureCurriculumRequests: result.report.reasoningLearning && result.report.reasoningLearning.failureCurriculum && result.report.reasoningLearning.failureCurriculum.curriculumRequestsProposed || 0,
                  failureCurriculumRecurrenceHolds: result.report.reasoningLearning && result.report.reasoningLearning.failureCurriculum && result.report.reasoningLearning.failureCurriculum.insufficientRecurrenceHolds || 0,
                  failureCurriculumTrainingAdmissions: result.report.reasoningLearning && result.report.reasoningLearning.failureCurriculum && result.report.reasoningLearning.failureCurriculum.trainingAdmissions || 0,
                  failureCurriculumCodeBuilds: result.report.reasoningLearning && result.report.reasoningLearning.failureCurriculum && result.report.reasoningLearning.failureCurriculum.codeBuilds || 0,
                  failureCurriculumOrgansInstalled: result.report.reasoningLearning && result.report.reasoningLearning.failureCurriculum && result.report.reasoningLearning.failureCurriculum.organsInstalled || 0,
                  realLocalReasoningReceipts: result.report.reasoningLearning && result.report.reasoningLearning.realLocalReceipts || 0,
                  syntheticCounterexampleReceipts: result.report.reasoningLearning && result.report.reasoningLearning.syntheticCounterexampleReceipts || 0,
                  contractDerivedExamReceipts: result.report.reasoningLearning && result.report.reasoningLearning.contractDerivedExamReceipts || 0,
                  excludedKnownFailReceipts: result.report.reasoningLearning && result.report.reasoningLearning.counterexamples && result.report.reasoningLearning.counterexamples.knownFailReceiptsExcluded || 0,
                  lastError: null
                });
                fs.appendFileSync(path.join(ROOT, 'logs', 'mirror-events.jsonl'), JSON.stringify({
                  at: new Date().toISOString(), event: 'automatic-practice-complete', reportId: practiceStatus.lastReportId,
                  cycleId: practiceStatus.lastCycleId, reasoningCycleId: practiceStatus.lastReasoningCycleId,
                  handoffGraphBatchId: practiceStatus.lastHandoffGraphBatchId,
                   routeReadinessBatchId: practiceStatus.lastRouteReadinessBatchId,
                   readinessHandBatchId: practiceStatus.lastReadinessHandBatchId,
                    readinessProbeAffordanceBatchId: practiceStatus.lastReadinessProbeAffordanceBatchId,
                     providerDeclarationHandBatchId: practiceStatus.lastProviderDeclarationHandBatchId,
                    providerDeclarationResearchExamBatchId: practiceStatus.lastProviderDeclarationResearchExamBatchId,
                    providerDeclarationResearchExecutorBatchId: practiceStatus.lastProviderDeclarationResearchExecutorBatchId,
                    providerDeclarationArchitectureSurveyBatchId: practiceStatus.lastProviderDeclarationArchitectureSurveyBatchId,
                    providerDeclarationImplementationEvidenceSurveyBatchId: practiceStatus.lastProviderDeclarationImplementationEvidenceSurveyBatchId,
                    providerDeclarationBindingExperimentBatchId: practiceStatus.lastProviderDeclarationBindingExperimentBatchId,
                    readinessProbeCandidateBatchId: practiceStatus.lastReadinessProbeCandidateBatchId,
                  contractCurriculumBatchId: practiceStatus.lastContractCurriculumBatchId,
                  counterexampleBatchId: practiceStatus.lastCounterexampleBatchId,
                  metamorphicBatchId: practiceStatus.lastMetamorphicBatchId,
                  failureCurriculumBatchId: practiceStatus.lastFailureCurriculumBatchId, state: practiceStatus.state
                }) + '\n');
              }).catch(error => {
                practiceStatus = Object.assign({}, practiceStatus, { state: 'HELD', lastError: String(error.message || error).slice(0, 500) });
                fs.appendFileSync(path.join(ROOT, 'logs', 'mirror-events.jsonl'), JSON.stringify({
                  at: new Date().toISOString(), event: 'automatic-practice-held', error: practiceStatus.lastError
                }) + '\n');
              });
            }, delay);
          }
          resolve(runtime);
        });
      });
    },
    stop() {
      if (practiceTimer) clearTimeout(practiceTimer);
      practiceTimer = null;
      if (heartbeat) heartbeat.stop();
      heartbeat = null;
      sessions.clear();
      if (!server) return Promise.resolve();
      const closing = server;
      server = null;
      return new Promise(resolve => closing.close(() => {
        if (options.persist !== false) {
          try { fs.unlinkSync(path.join(ROOT, 'state', 'runtime.pid')); } catch (_) {}
          fs.appendFileSync(path.join(ROOT, 'logs', 'mirror-events.jsonl'), JSON.stringify({ at: new Date().toISOString(), event: 'runtime-stop', identity: 'axm.machine.mirror/seed-0' }) + '\n');
        }
        resolve();
      }));
    },
    health: publicHealth
  };
  return runtime;
}

if (require.main === module) {
  let runtime;
  try { runtime = createMirrorRuntime(); }
  catch (error) { console.error(`Mirror refused to start: ${error.message}`); process.exit(1); }
  runtime.start().then(() => {
    console.log('AXM Mirror Seed-0');
    console.log(`Identity: axm.machine.mirror/seed-0`);
    console.log(`Runtime:  http://127.0.0.1:${runtime.port}`);
    console.log('Truth: deterministic kernel · no learned weights · no tool authority');
  }).catch(error => { console.error(`Mirror could not start: ${error.message}`); process.exit(1); });
  const stop = () => runtime.stop().then(() => process.exit(0));
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
}

module.exports = { createMirrorRuntime };
