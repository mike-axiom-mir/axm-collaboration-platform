'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const test = require('node:test');
const assert = require('node:assert/strict');
const { createMirrorRuntime } = require('../runtime/server');
const WorldGenomeOrgan = require('../organs/world-genome-organ');
const FrontierCell = require('../kernel/frontier-cell');
const ReasoningFoundation = require('../kernel/reasoning-foundation');
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
const ReasoningSkillCycle = require('../training/reasoning-skill-cycle');

async function json(url, options) {
  const response = await fetch(url, options);
  const body = await response.json();
  return { response, body };
}

test('runtime exposes public truth but protects reasoning with a token and explicit session', async t => {
  const experienceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'axm-runtime-experience-'));
  t.after(() => fs.rmSync(experienceRoot, { recursive: true, force: true }));
  const handoffWorkshopRoot = path.join(experienceRoot, 'workshop');
  const handoffContracts = [
    { id: 'alpha', emits: ['axm.test/x-v1'], accepts: [] },
    { id: 'beta', emits: ['axm.test/y-v1'], accepts: ['axm.test/x-v1'] },
    { id: 'gamma', emits: [], accepts: ['axm.test/y-v1'] },
    { id: 'decoy', emits: [], accepts: ['axm.test/z-v1'] },
    { id: 'omega', emits: ['axm.test/q-v1'], accepts: [] },
    { id: 'psi', emits: [], accepts: ['axm.test/q-v1'], consumes: ['service:provider-gap/adapter-v1'] }
  ];
  for (const item of handoffContracts) {
    const directory = path.join(handoffWorkshopRoot, 'tools', item.id);
    fs.mkdirSync(directory, { recursive: true });
    fs.writeFileSync(path.join(directory, 'module.contract.json'), JSON.stringify({
      schema: 'axm.module-contract/v1', id: item.id, version: '1.0.0', provides: [], consumes: item.consumes || [], permissions: [],
      handoffs: { emits: item.emits, accepts: item.accepts }, boundaries: { writes: [], refuses: ['automatic-world-action'] }
    }, null, 2) + '\n');
    fs.writeFileSync(path.join(directory, 'manifest.json'), JSON.stringify({
      schema: 'axm.tool-manifest/v1', id: item.id, version: '1.0.0', status: 'TEST', entry: 'index.html',
      uses: [], permissions: [], contract: 'module.contract.json'
    }, null, 2) + '\n');
  }
  const missingServiceContract = path.join(handoffWorkshopRoot, 'shared', 'missing-service', 'service.contract.json');
  fs.mkdirSync(path.dirname(missingServiceContract), { recursive: true });
  fs.writeFileSync(missingServiceContract, JSON.stringify({ schema: 'axm.shared-service-contract/v1', id: 'missing-service', version: '1.0.0', status: 'TEST', provides: [], accepts: [], produces: [], boundaries: { automaticWrites: [], refuses: [] } }, null, 2) + '\n');
  const implementationFixture = path.join(handoffWorkshopRoot, 'shared', 'provider-gap', 'adapter.js');
  fs.mkdirSync(path.dirname(implementationFixture), { recursive: true });
  fs.writeFileSync(implementationFixture, "const ID='adapter-v1'; function register(x){x.register(ID)} module.exports={ID,register};\n");
  const readinessSnapshot = {
    schema: 'axm.technical-glasses/v1', ok: true, compiledAt: new Date().toISOString(), freshness: { fingerprint: 'e'.repeat(64) },
    modules: handoffContracts.map(item => ({
      id: item.id,
      evidence: { manifest: `tools/${item.id}/manifest.json`, contract: `tools/${item.id}/module.contract.json`, contractDeclared: true, contractPass: true },
      readiness: item.id === 'psi'
        ? [{ id: 'missing-service', state: 'UNKNOWN', detail: 'No live readiness source declared' }, { id: 'provider-gap', state: 'UNKNOWN', detail: 'No live readiness source declared' }]
        : [{ id: 'fixture', state: 'READY', detail: 'Runtime contract test fixture.' }]
    }))
  };
  const runtime = createMirrorRuntime({
    config: { host: '127.0.0.1', port: 0, presenceEnabled: false },
    token: 't'.repeat(64), persist: false, presence: false,
    reasoningExperienceOptions: { root: experienceRoot, directory: path.join(experienceRoot, 'training', 'datasets', 'reasoning-receipts') },
    handoffGraphOptions: { root: experienceRoot, workshopRoot: handoffWorkshopRoot, stateDir: path.join(experienceRoot, 'state', 'reasoning-handoff-graph-runs') },
    routeReadinessOptions: { root: experienceRoot, workshopRoot: handoffWorkshopRoot, stateDir: path.join(experienceRoot, 'state', 'reasoning-route-readiness-runs'), snapshot: readinessSnapshot, refresh: false },
    readinessHandOptions: { root: experienceRoot, workshopRoot: handoffWorkshopRoot, stateDir: path.join(experienceRoot, 'state', 'reasoning-readiness-hand-runs') },
    readinessProbeAffordanceOptions: { root: experienceRoot, workshopRoot: handoffWorkshopRoot, stateDir: path.join(experienceRoot, 'state', 'reasoning-readiness-probe-affordance-runs') },
    providerDeclarationHandOptions: { root: experienceRoot, workshopRoot: handoffWorkshopRoot, stateDir: path.join(experienceRoot, 'state', 'provider-declaration-hand-runs') },
    providerDeclarationResearchExamOptions: { root: experienceRoot, workshopRoot: handoffWorkshopRoot, stateDir: path.join(experienceRoot, 'state', 'provider-declaration-research-exam-runs') },
    providerDeclarationArchitectureSurveyOptions: { root: experienceRoot, workshopRoot: handoffWorkshopRoot, stateDir: path.join(experienceRoot, 'state', 'provider-declaration-architecture-survey-runs') },
    providerDeclarationImplementationEvidenceSurveyOptions: { root: experienceRoot, workshopRoot: handoffWorkshopRoot, stateDir: path.join(experienceRoot, 'state', 'provider-declaration-implementation-evidence-survey-runs') },
    providerDeclarationBindingExperimentOptions: { root: experienceRoot, workshopRoot: handoffWorkshopRoot, stateDir: path.join(experienceRoot, 'state', 'provider-declaration-binding-experiment-runs') },
    providerDeclarationResearchExecutorBuilderOptions: { root: experienceRoot, workshopRoot: handoffWorkshopRoot, stateDir: path.join(experienceRoot, 'state', 'provider-declaration-research-executor-builder-runs') },
    readinessProbeBuilderOptions: { root: experienceRoot, workshopRoot: handoffWorkshopRoot, stateDir: path.join(experienceRoot, 'state', 'reasoning-readiness-probe-builder-runs') }
  });
  await runtime.start();
  t.after(() => runtime.stop());
  const base = `http://127.0.0.1:${runtime.port}`;
  const health = await json(base + '/health');
  assert.equal(health.body.learnedWeights, false);
  assert.equal(health.body.outsideNetworkCalls, false);
  assert.equal(health.body.worldGenomeOrgan.id, WorldGenomeOrgan.ORGAN_ID);
  assert.equal(health.body.worldGenomeOrgan.selfModification, 'DISPOSABLE_WORLD_GENOME_ONLY');
  assert.equal(health.body.frontierCell.id, FrontierCell.CELL_ID);
  assert.equal(health.body.frontierCell.automaticPromotion, false);
  assert.equal(health.body.reasoningFoundation.id, ReasoningFoundation.CELL_ID);
  assert.equal(health.body.reasoningFoundation.memoryWriteAuthority, false);
  assert.equal(health.body.reasoningStrategyOrgan.activeRuntime, false);
  assert.equal(health.body.reasoningExperienceOrgan.id, ReasoningExperienceOrgan.ORGAN_ID);
  assert.equal(health.body.reasoningExperienceOrgan.learnedSelfTraining, false);
  assert.equal(health.body.reasoningContractCurriculumOrgan.id, ReasoningContractCurriculumOrgan.ORGAN_ID);
  assert.equal(health.body.reasoningContractCurriculumOrgan.heldOutTrainingAuthority, false);
  assert.equal(health.body.reasoningContractCurriculumOrgan.generatedHumanWordingAuthority, false);
  assert.equal(health.body.reasoningContractCurriculumOrgan.maximumContracts, 64);
  assert.equal(health.body.contractHandoffCompatibilityCell.id, ContractHandoffCell.CELL_ID);
  assert.equal(health.body.contractHandoffCompatibilityCell.candidateGenerationAuthority, false);
  assert.equal(health.body.contractManifestBindingCell.id, ContractManifestBindingCell.CELL_ID);
  assert.equal(health.body.contractManifestBindingCell.permissionGrantAuthority, false);
  assert.equal(health.body.contractManifestBindingCell.runtimeReadinessClaimAuthority, false);
  assert.equal(health.body.reasoningHandoffGraphOrgan.id, ReasoningHandoffGraphOrgan.ORGAN_ID);
  assert.equal(health.body.reasoningHandoffGraphOrgan.maximumDepth, 2);
  assert.equal(health.body.reasoningHandoffGraphOrgan.trainingAdmissionAuthority, false);
  assert.equal(health.body.reasoningHandoffGraphOrgan.worldMutationAuthority, false);
  assert.equal(health.body.routeReadinessCell.id, RouteReadinessCell.CELL_ID);
  assert.equal(health.body.routeReadinessCell.automaticStartAuthority, false);
  assert.equal(health.body.reasoningRouteReadinessOrgan.id, ReasoningRouteReadinessOrgan.ORGAN_ID);
  assert.equal(health.body.reasoningRouteReadinessOrgan.maximumSnapshotAgeMs, ReasoningRouteReadinessOrgan.MAX_SNAPSHOT_AGE_MS);
  assert.equal(health.body.reasoningRouteReadinessOrgan.automaticRepairAuthority, false);
  assert.equal(health.body.reasoningRouteReadinessOrgan.trainingAdmissionAuthority, false);
  assert.equal(health.body.readinessGapCell.id, ReadinessGapCell.CELL_ID);
  assert.equal(health.body.readinessGapCell.probeCodeGenerationAuthority, false);
  assert.equal(health.body.reasoningReadinessHandOrgan.id, ReasoningReadinessHandOrgan.ORGAN_ID);
  assert.equal(health.body.reasoningReadinessHandOrgan.installAuthority, false);
  assert.equal(health.body.reasoningReadinessHandOrgan.trainingAdmissionAuthority, false);
  assert.equal(health.body.reasoningReadinessProbeAffordanceOrgan.id, ReasoningReadinessProbeAffordanceOrgan.ORGAN_ID);
  assert.equal(health.body.reasoningReadinessProbeAffordanceOrgan.positiveStateCeiling, 'AVAILABLE');
  assert.equal(health.body.reasoningReadinessProbeAffordanceOrgan.humanReviewAuthority, false);
  assert.equal(health.body.reasoningReadinessProbeAffordanceOrgan.candidateWriteAuthority, false);
  assert.equal(health.body.providerDeclarationGapCell.id, ProviderDeclarationGapCell.CELL_ID);
  assert.equal(health.body.providerDeclarationGapCell.providerIdentityInferenceAuthority, false);
  assert.equal(health.body.providerDeclarationHandOrgan.id, ProviderDeclarationHandOrgan.ORGAN_ID);
  assert.equal(health.body.providerDeclarationHandOrgan.providerContractWriteAuthority, false);
  assert.equal(health.body.providerDeclarationResearchExamOrgan.id, ProviderDeclarationResearchExamOrgan.ORGAN_ID);
  assert.equal(health.body.providerDeclarationResearchExamOrgan.architectureSelectionAuthority, false);
  assert.equal(health.body.providerDeclarationResearchExamOrgan.heldOutFixtureAuthoringByCandidateAuthority, false);
  assert.equal(health.body.providerDeclarationResearchExamOrgan.examExecutorBuildAuthority, false);
  assert.equal(health.body.providerDeclarationResearchExamOrgan.providerContractWriteAuthority, false);
  assert.equal(health.body.providerDeclarationResearchExecutorRecipeCell.id, ProviderDeclarationResearchExecutorRecipeCell.CELL_ID);
  assert.equal(health.body.providerDeclarationResearchExecutorRecipeCell.architectureSelectionAuthority, false);
  assert.equal(health.body.providerDeclarationResearchExecutorReviewOrgan.id, ProviderDeclarationResearchExecutorReviewOrgan.ORGAN_ID);
  assert.equal(health.body.providerDeclarationResearchExecutorReviewOrgan.executorBuildAuthority, false);
  assert.equal(health.body.providerDeclarationResearchExecutorBuilderOrgan.id, ProviderDeclarationResearchExecutorBuilderOrgan.ORGAN_ID);
  assert.equal(health.body.providerDeclarationResearchExecutorBuilderOrgan.positiveStateCeiling, 'STRUCTURALLY_DECLARED_AVAILABLE_AT_MOST');
  assert.equal(health.body.providerDeclarationResearchExecutorBuilderOrgan.liveArchitectureEvaluationAuthority, false);
  assert.equal(health.body.providerDeclarationArchitecturePatternCell.id, ProviderDeclarationArchitecturePatternCell.CELL_ID);
  assert.equal(health.body.providerDeclarationArchitecturePatternCell.crossDocumentRelationMergeAuthority, false);
  assert.equal(health.body.providerDeclarationArchitectureSurveyOrgan.id, ProviderDeclarationArchitectureSurveyOrgan.ORGAN_ID);
  assert.equal(health.body.providerDeclarationArchitectureSurveyOrgan.architectureSelectionAuthority, false);
  assert.equal(health.body.providerDeclarationArchitectureSurveyOrgan.providerBuildAuthority, false);
  assert.equal(health.body.providerImplementationEvidenceCell.id, ProviderImplementationEvidenceCell.CELL_ID);
  assert.equal(health.body.providerImplementationEvidenceCell.sourceExecutionAuthority, false);
  assert.equal(health.body.providerDeclarationImplementationEvidenceSurveyOrgan.id, ProviderDeclarationImplementationEvidenceSurveyOrgan.ORGAN_ID);
  assert.equal(health.body.providerDeclarationImplementationEvidenceSurveyOrgan.providerIdentityInferenceAuthority, false);
  assert.equal(health.body.providerDeclarationImplementationEvidenceSurveyOrgan.implementationSelectionAuthority, false);
  assert.equal(health.body.providerBindingExperimentCell.id, ProviderBindingExperimentCell.CELL_ID);
  assert.equal(health.body.providerBindingExperimentCell.experimentFrameSelectionAuthority, false);
  assert.equal(health.body.providerDeclarationBindingExperimentPlannerOrgan.id, ProviderDeclarationBindingExperimentPlannerOrgan.ORGAN_ID);
  assert.equal(health.body.providerDeclarationBindingExperimentPlannerOrgan.permissionInferenceAuthority, false);
  assert.equal(health.body.providerDeclarationBindingExperimentPlannerOrgan.sourceExecutionAuthority, false);
  assert.equal(health.body.readinessProbeRecipeCell.id, ReadinessProbeRecipeCell.CELL_ID);
  assert.equal(health.body.readinessProbeRecipeCell.liveExecutionAuthority, false);
  assert.equal(health.body.reasoningReadinessProbeBuilderOrgan.id, ReasoningReadinessProbeBuilderOrgan.ORGAN_ID);
  assert.equal(health.body.reasoningReadinessProbeBuilderOrgan.positiveStateCeiling, 'AVAILABLE');
  assert.equal(health.body.reasoningReadinessProbeBuilderOrgan.installAuthority, false);
  assert.equal(health.body.reasoningReadinessProbeReviewOrgan.id, ReasoningReadinessProbeReviewOrgan.ORGAN_ID);
  assert.equal(health.body.reasoningReadinessProbeReviewOrgan.candidateWriteAuthority, false);
  assert.equal(health.body.reasoningCounterexampleOrgan.id, ReasoningCounterexampleOrgan.ORGAN_ID);
  assert.equal(health.body.reasoningCounterexampleOrgan.realWorldOutcomeAuthority, false);
  assert.equal(health.body.reasoningCounterexampleOrgan.semanticTruthWriteAuthority, false);
  assert.equal(health.body.reasoningMetamorphicOrgan.id, ReasoningMetamorphicOrgan.ORGAN_ID);
  assert.equal(health.body.reasoningMetamorphicOrgan.confirmedInvariantTrainingAuthority, false);
  assert.equal(health.body.reasoningMetamorphicOrgan.negativeMismatchReceiptRoute, 'EXPERIENCE_ORGAN_GATED');
  assert.equal(health.body.reasoningMetamorphicOrgan.maximumCompositionDepth, 2);
  assert.equal(health.body.reasoningMetamorphicOrgan.semanticTruthWriteAuthority, false);
  assert.equal(health.body.organAdmissionCell.installAuthority, false);
  const denied = await json(base + '/axm/v1/session/open', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
  assert.equal(denied.response.status, 401);
  const headers = { authorization: `Bearer ${'t'.repeat(64)}`, 'content-type': 'application/json' };
  const opened = await json(base + '/axm/v1/session/open', { method: 'POST', headers, body: JSON.stringify({ actor: { id: 'test', kind: 'HUMAN' } }) });
  assert.equal(opened.response.status, 201);
  const sessionId = opened.body.session.id;
  const handoff = await json(base + '/axm/v1/reasoning/handoff-route', { method: 'POST', headers, body: JSON.stringify({
    sessionId,
    schema: ReasoningHandoffGraphOrgan.REQUEST_SCHEMA,
    sourceModuleId: 'alpha',
    targetModuleId: 'gamma',
    maximumDepth: 2
  }) });
  assert.equal(handoff.response.status, 200);
  assert.equal(handoff.body.response.state, 'PROPOSED_READY_MANIFEST_BOUND_EXACT_TYPED_ROUTES');
  assert.deepEqual(handoff.body.response.proposals[0].moduleIds, ['alpha', 'beta', 'gamma']);
  assert.equal(handoff.body.response.proposals[0].readinessState, 'READY');
  assert.equal(handoff.body.response.proposals[0].state, 'REVIEWABLE_READY_PROPOSAL_NOT_EXECUTED');
  assert.ok(Object.values(handoff.body.response.authority).every(value => value === false));
  assert.equal(handoff.body.response.humanRenderingAuthority, false);
  assert.equal(handoff.body.activeRuntimeChanged, false);
  const readinessHands = await json(base + '/axm/v1/growth/readiness-hands', { method: 'POST', headers, body: JSON.stringify({
    sessionId,
    schema: ReasoningReadinessHandOrgan.REQUEST_SCHEMA,
    limit: 10
  }) });
  assert.equal(readinessHands.response.status, 200);
  assert.equal(readinessHands.body.response.state, 'PROPOSED_READINESS_PROBE_HAND_REQUESTS');
  assert.equal(readinessHands.body.response.proposals.length, 2);
  const missingServiceHand = readinessHands.body.response.proposals.find(item => item.requirementId === 'missing-service');
  assert.ok(missingServiceHand);
  assert.equal(missingServiceHand.proposedProbeContract.implementationState, 'NOT_BUILT');
  assert.ok(Object.values(readinessHands.body.response.authority).every(value => value === false));
  assert.equal(readinessHands.body.codeFilesGenerated, 0);
  assert.equal(readinessHands.body.probesInstalled, 0);
  assert.equal(readinessHands.body.activeRuntimeChanged, false);
  const affordances = await json(base + '/axm/v1/growth/readiness-probe-affordances', { method: 'POST', headers, body: JSON.stringify({
    sessionId,
    schema: ReasoningReadinessProbeAffordanceOrgan.REQUEST_SCHEMA,
    requirementId: 'missing-service'
  }) });
  assert.equal(affordances.response.status, 200);
  assert.equal(affordances.body.response.state, 'PROPOSED_EXACT_DECLARATION_REVIEW_PACKETS');
  assert.equal(affordances.body.response.reviewPackets.length, 1);
  assert.equal(affordances.body.response.reviewPackets[0].recommendation.suggestedProbe.kind, 'DECLARED_SHARED_SERVICE_AVAILABLE');
  assert.equal(affordances.body.response.reviewPackets[0].recommendation.suggestedProbe.targetRelativePath, 'shared/missing-service/service.contract.json');
  assert.equal(affordances.body.response.humanReviewCreated, false);
  assert.equal(affordances.body.response.recipesSealed, false);
  assert.equal(affordances.body.response.candidatesBuilt, false);
  assert.equal(affordances.body.activeRuntimeChanged, false);
  assert.equal(affordances.body.workshopChanged, false);
  assert.equal(affordances.body.liveProbesExecuted, 0);
  const providerHands = await json(base + '/axm/v1/growth/provider-declaration-hands', { method: 'POST', headers, body: JSON.stringify({
    sessionId,
    schema: ProviderDeclarationHandOrgan.REQUEST_SCHEMA,
    requirementId: 'provider-gap'
  }) });
  assert.equal(providerHands.response.status, 200);
  assert.equal(providerHands.body.response.state, 'PROPOSED_PROVIDER_DECLARATION_GAP_HANDS');
  assert.equal(providerHands.body.response.proposals.length, 1);
  assert.deepEqual(providerHands.body.response.proposals[0].consumerDemand.providerSelectors, ['adapter-v1']);
  assert.equal(providerHands.body.response.proposals[0].proposedProviderDeclarationContract.providerIdentity, 'UNRESOLVED_NOT_INFERRED');
  assert.equal(providerHands.body.response.proposals[0].proposedProviderDeclarationContract.declarationSchema, 'UNRESOLVED_REQUIRES_STEWARD_SELECTION');
  assert.equal(providerHands.body.response.proposals[0].proposedProviderDeclarationContract.declarationTargetRelativePath, null);
  assert.equal(providerHands.body.response.proposals[0].proposedProviderDeclarationContract.implementationState, 'NOT_BUILT');
  assert.equal(providerHands.body.response.providerDeclarationsWritten, false);
  assert.equal(providerHands.body.declarationCandidatesBuilt, false);
  assert.equal(providerHands.body.workshopChanged, false);
  assert.equal(providerHands.body.liveProbesExecuted, 0);
  const providerResearch = await json(base + '/axm/v1/growth/provider-declaration-research-exams', { method: 'POST', headers, body: JSON.stringify({
    sessionId,
    schema: ProviderDeclarationResearchExamOrgan.REQUEST_SCHEMA,
    requirementId: 'provider-gap'
  }) });
  assert.equal(providerResearch.response.status, 200);
  assert.equal(providerResearch.body.response.state, 'PROPOSED_PROVIDER_DECLARATION_RESEARCH_EXAMS');
  assert.equal(providerResearch.body.response.examRequests.length, 1);
  const researchExam = providerResearch.body.response.examRequests[0];
  assert.equal(researchExam.examRequest.sourceHand.requirementId, 'provider-gap');
  assert.equal(researchExam.examRequest.architectureHypotheses.length, 4);
  assert.ok(researchExam.examRequest.architectureHypotheses.every(item => item.state === 'UNTESTED'));
  assert.equal(researchExam.examRequest.caseFamilies.length, 10);
  assert.equal(researchExam.examRequest.independence.futureCandidateMayAuthorExpectedOutcomes, false);
  assert.equal(researchExam.examRequest.independence.futureCandidateMayAuthorHeldOutFixtures, false);
  assert.equal(researchExam.examRequest.architectureDecision, 'UNRESOLVED_REQUIRES_INDEPENDENT_EXPERIMENT');
  assert.equal(researchExam.examRequest.examExecutorState, 'NOT_BUILT');
  assert.equal(researchExam.frontierAssessment.classification, 'FRONTIER_EXAM_REQUIRED');
  assert.equal(providerResearch.body.architectureSelected, false);
  assert.equal(providerResearch.body.examExecutorBuilt, false);
  assert.equal(providerResearch.body.fixtureFilesGenerated, 0);
  assert.equal(providerResearch.body.providerCandidatesBuilt, false);
  assert.equal(providerResearch.body.providerDeclarationsWritten, false);
  assert.equal(providerResearch.body.liveExperimentsExecuted, 0);
  assert.equal(providerResearch.body.workshopChanged, false);
  const architectureSurvey = await json(base + '/axm/v1/growth/provider-declaration-architecture-surveys', { method: 'POST', headers, body: JSON.stringify({
    sessionId,
    schema: ProviderDeclarationArchitectureSurveyOrgan.REQUEST_SCHEMA,
    requirementId: 'provider-gap',
    limit: 10
  }) });
  assert.equal(architectureSurvey.response.status, 200);
  assert.equal(architectureSurvey.body.response.state, 'PROPOSED_PROVIDER_DECLARATION_ARCHITECTURE_PATTERN_EVIDENCE');
  assert.equal(architectureSurvey.body.response.surveys.length, 1);
  assert.equal(architectureSurvey.body.response.surveys[0].requirementId, 'provider-gap');
  assert.equal(architectureSurvey.body.response.surveys[0].completePatternWitnesses, 0);
  assert.ok(architectureSurvey.body.response.surveys[0].hypothesisEvidence.every(item => item.state === 'UNTESTED'));
  assert.equal(architectureSurvey.body.providerIdentityInferred, false);
  assert.equal(architectureSurvey.body.crossDocumentRelationMergeUsed, false);
  assert.equal(architectureSurvey.body.architectureSelected, false);
  assert.equal(architectureSurvey.body.architectureEvaluated, false);
  assert.equal(architectureSurvey.body.providerCandidateBuilt, false);
  assert.equal(architectureSurvey.body.providerDeclarationWritten, false);
  assert.equal(architectureSurvey.body.workshopChanged, false);
  const implementationEvidenceSurvey = await json(base + '/axm/v1/growth/provider-declaration-implementation-evidence-surveys', { method: 'POST', headers, body: JSON.stringify({
    sessionId,
    schema: ProviderDeclarationImplementationEvidenceSurveyOrgan.REQUEST_SCHEMA,
    requirementId: 'provider-gap',
    limit: 10
  }) });
  assert.equal(implementationEvidenceSurvey.response.status, 200);
  assert.equal(implementationEvidenceSurvey.body.response.state, 'PROPOSED_PROVIDER_IMPLEMENTATION_SOURCE_EVIDENCE');
  assert.equal(implementationEvidenceSurvey.body.response.evidenceSurveys.length, 1);
  assert.equal(implementationEvidenceSurvey.body.response.evidenceSurveys[0].requirementId, 'provider-gap');
  assert.equal(implementationEvidenceSurvey.body.response.evidenceSurveys[0].selectorSources.length, 1);
  assert.deepEqual(implementationEvidenceSurvey.body.response.evidenceSurveys[0].selectorSources[0].exactSelectorLiterals, ['adapter-v1']);
  assert.equal(implementationEvidenceSurvey.body.providerIdentityInferred, false);
  assert.equal(implementationEvidenceSurvey.body.outerRequirementBound, false);
  assert.equal(implementationEvidenceSurvey.body.implementationSelected, false);
  assert.equal(implementationEvidenceSurvey.body.sourceExecuted, false);
  assert.equal(implementationEvidenceSurvey.body.architectureSelected, false);
  assert.equal(implementationEvidenceSurvey.body.architectureEvaluated, false);
  assert.equal(implementationEvidenceSurvey.body.providerCandidateBuilt, false);
  assert.equal(implementationEvidenceSurvey.body.providerDeclarationWritten, false);
  assert.equal(implementationEvidenceSurvey.body.workshopChanged, false);
  const bindingExperiments = await json(base + '/axm/v1/growth/provider-declaration-binding-experiments', { method: 'POST', headers, body: JSON.stringify({
    sessionId,
    schema: ProviderDeclarationBindingExperimentPlannerOrgan.REQUEST_SCHEMA,
    requirementId: 'provider-gap',
    limit: 10
  }) });
  assert.equal(bindingExperiments.response.status, 200);
  assert.equal(bindingExperiments.body.response.state, 'PROPOSED_PROVIDER_BINDING_EXPERIMENT_MATRICES_NOT_SELECTED');
  assert.equal(bindingExperiments.body.response.matrices.length, 1);
  assert.equal(bindingExperiments.body.response.matrices[0].requirementId, 'provider-gap');
  assert.equal(bindingExperiments.body.response.matrices[0].candidateSources.length, 1);
  assert.equal(bindingExperiments.body.response.matrices[0].hypothesesRepresented.length, 3);
  assert.equal(bindingExperiments.body.response.matrices[0].experimentFrames.length, 3);
  assert.equal(bindingExperiments.body.response.selectedFrameId, null);
  assert.equal(bindingExperiments.body.providerIdentityInferred, false);
  assert.equal(bindingExperiments.body.outerRequirementBound, false);
  assert.equal(bindingExperiments.body.permissionsInferred, false);
  assert.equal(bindingExperiments.body.implementationSelected, false);
  assert.equal(bindingExperiments.body.sourceExecuted, false);
  assert.equal(bindingExperiments.body.architectureSelected, false);
  assert.equal(bindingExperiments.body.architectureEvaluated, false);
  assert.equal(bindingExperiments.body.providerCandidateBuilt, false);
  assert.equal(bindingExperiments.body.providerDeclarationWritten, false);
  assert.equal(bindingExperiments.body.workshopChanged, false);
  const executorHoldReview = await json(base + '/axm/v1/growth/provider-declaration-research-executor-review', { method: 'POST', headers, body: JSON.stringify({
    sessionId,
    schema: ProviderDeclarationResearchExecutorReviewOrgan.REQUEST_SCHEMA,
    examRequestId: researchExam.examRequest.examRequestId,
    decision: 'HOLD',
    reason: 'Runtime contract verifies the attributed no-build path.',
    executor: null
  }) });
  assert.equal(executorHoldReview.response.status, 200);
  assert.equal(executorHoldReview.body.response.state, 'HOLD_RECORDED_WITH_NO_EXECUTOR');
  assert.equal(executorHoldReview.body.response.recipe.executor, null);
  assert.equal(executorHoldReview.body.response.admission.classification, 'HELD_EXECUTOR_NOT_APPROVED');
  assert.equal(executorHoldReview.body.executorBuilt, false);
  assert.equal(executorHoldReview.body.architectureSelected, false);
  assert.equal(executorHoldReview.body.architectureEvaluated, false);
  const heldResearchExecutor = await json(base + '/axm/v1/growth/provider-declaration-research-executors', { method: 'POST', headers, body: JSON.stringify({
    sessionId,
    schema: ProviderDeclarationResearchExecutorBuilderOrgan.REQUEST_SCHEMA,
    recipes: [executorHoldReview.body.response.recipe]
  }) });
  assert.equal(heldResearchExecutor.response.status, 200);
  assert.equal(heldResearchExecutor.body.response.state, 'REVIEWED_EXECUTOR_RECIPES_HELD_NO_CANDIDATES_BUILT');
  assert.equal(heldResearchExecutor.body.response.summary.executorCandidatesBuilt, 0);
  assert.equal(heldResearchExecutor.body.response.summary.candidateFilesGenerated, 0);
  assert.equal(heldResearchExecutor.body.response.summary.architecturesSelected, 0);
  assert.equal(heldResearchExecutor.body.response.summary.architecturesEvaluated, 0);
  assert.equal(heldResearchExecutor.body.providerCandidatesBuilt, false);
  assert.equal(heldResearchExecutor.body.providerDeclarationsWritten, false);
  assert.equal(heldResearchExecutor.body.workshopChanged, false);
  const emptyResearchExecutor = await json(base + '/axm/v1/growth/provider-declaration-research-executors', { method: 'POST', headers, body: JSON.stringify({
    sessionId,
    schema: ProviderDeclarationResearchExecutorBuilderOrgan.REQUEST_SCHEMA,
    recipes: []
  }) });
  assert.equal(emptyResearchExecutor.response.status, 200);
  assert.equal(emptyResearchExecutor.body.response.state, 'NO_REVIEWED_EXECUTOR_RECIPES_SUBMITTED');
  assert.equal(emptyResearchExecutor.body.response.summary.executorCandidatesBuilt, 0);
  const suggestedProbe = affordances.body.response.reviewPackets[0].recommendation.suggestedProbe;
  const reviewed = await json(base + '/axm/v1/growth/readiness-probe-review', { method: 'POST', headers, body: JSON.stringify({
    sessionId,
    schema: ReasoningReadinessProbeReviewOrgan.REQUEST_SCHEMA,
    handRequestId: missingServiceHand.requestId,
    decision: 'APPROVE_DISPOSABLE_CANDIDATE',
    reason: 'Runtime contract fixture review.',
    probe: suggestedProbe
  }) });
  assert.equal(reviewed.response.status, 200);
  assert.equal(reviewed.body.response.state, 'REVIEWED_RECIPE_SEALED_NOT_BUILT');
  assert.equal(reviewed.body.response.reviewProvenance.actorId, 'test');
  assert.equal(reviewed.body.candidateBuilt, false);
  assert.ok(Object.values(reviewed.body.response.authority).every(value => value === false));
  const reviewedRecipe = reviewed.body.response.recipe;
  const probeCandidates = await json(base + '/axm/v1/growth/readiness-probe-candidates', { method: 'POST', headers, body: JSON.stringify({
    sessionId,
    schema: ReasoningReadinessProbeBuilderOrgan.REQUEST_SCHEMA,
    recipes: [reviewedRecipe]
  }) });
  assert.equal(probeCandidates.response.status, 200);
  assert.equal(probeCandidates.body.response.state, 'DISPOSABLE_CANDIDATES_BUILT_AND_FIXTURE_TESTED_NOT_INSTALLED');
  assert.equal(probeCandidates.body.response.summary.candidatesBuilt, 1);
  assert.equal(probeCandidates.body.response.summary.fixtureSuitesPassed, 1);
  assert.equal(probeCandidates.body.response.summary.probesInstalled, 0);
  assert.equal(probeCandidates.body.response.summary.liveProbesExecuted, 0);
  assert.equal(probeCandidates.body.response.results[0].candidate.state, 'SANDBOX_FIXTURES_PASS_NEEDS_INDEPENDENT_LIVE_REVIEW_NOT_INSTALLED');
  assert.equal(probeCandidates.body.activeRuntimeChanged, false);
  assert.equal(probeCandidates.body.workshopChanged, false);
  const originated = await json(base + '/axm/v1/organs/studio-candidates', { method: 'POST', headers, body: JSON.stringify({
    sessionId,
    surface: 'axm-studio-bounded-proposal-layer',
    observation: { width: 600, height: 600, visiblePixels: 0, blank: true, layerCount: 1, signature: 'blank' }
  }) });
  assert.equal(originated.response.status, 200);
  assert.equal(originated.body.candidateSet.organ.toolAuthority, false);
  assert.ok(originated.body.candidateSet.candidates.length >= 3);
  const worldCandidates = await json(base + '/axm/v1/organs/world-genome-candidates', { method: 'POST', headers, body: JSON.stringify({
    sessionId,
    surface: 'axm-governed-evolution-disposable-globe',
    lineageSeed: 'runtime-contract-lineage',
    generation: 0,
    count: 4,
    parentGenome: WorldGenomeOrgan.BASELINE
  }) });
  assert.equal(worldCandidates.response.status, 200);
  assert.equal(worldCandidates.body.candidateSet.organ.selfModification, 'DISPOSABLE_WORLD_GENOME_ONLY');
  assert.equal(worldCandidates.body.candidateSet.candidates.length, 4);
  const frontier = await json(base + '/axm/v1/growth/frontier', { method: 'POST', headers, body: JSON.stringify({
    sessionId,
    subject: { id: 'runtime-frontier', domain: 'test', statement: 'Can a verified pattern transfer?' },
    observations: [
      { id: 'human-view', domain: 'collaboration', perspective: 'HUMAN_STEWARD', statement: 'A pattern was noticed.', patternTags: ['transfer-test'] },
      { id: 'machine-view', domain: 'world-genome', perspective: 'MACHINE_NATIVE', statement: 'The pattern also appeared in a world trace.', patternTags: ['transfer-test'] }
    ]
  }) });
  assert.equal(frontier.response.status, 200);
  assert.equal(frontier.body.assessment.classification, 'FRONTIER_EXAM_REQUIRED');
  assert.equal(frontier.body.assessment.authority.automaticPromotion, false);
  assert.deepEqual(frontier.body.assessment.perspectiveLedger.humanEvidenceIds, ['human-view']);
  assert.deepEqual(frontier.body.assessment.perspectiveLedger.machineEvidenceIds, ['machine-view']);
  const foundation = await json(base + '/axm/v1/reasoning/foundation', { method: 'POST', headers, body: JSON.stringify({
    sessionId,
    goal: 'Compare two bounded runtime paths.',
    evidence: [{ id: 'runtime-proof', kind: 'test', status: 'tested', statement: 'Both paths are local proposals.', source: { kind: 'test', id: 'runtime' } }],
    actions: [
      { id: 'repeat', kind: 'proposal', label: 'Repeat the first explanation', supportingEvidence: ['runtime-proof'], preconditionEvidence: ['runtime-proof'], risk: 'low', reversible: true, recovery: 'No mutation.' },
      { id: 'probe', kind: 'proposal', label: 'Run an independent bounded probe', supportingEvidence: ['runtime-proof'], preconditionEvidence: ['runtime-proof'], risk: 'low', reversible: true, recovery: 'No mutation.' }
    ],
    pathProfiles: [
      { actionId: 'repeat', approach: 'Repeat the same explanation.', estimatedCost: 'HIGH', informationValue: 0.1 },
      { actionId: 'probe', approach: 'Run an independent test.', estimatedCost: 'LOW', informationValue: 0.9 }
    ]
  }) });
  assert.equal(foundation.response.status, 200);
  assert.equal(foundation.body.reasoningSession.pathSet.selectedActionId, 'probe');
  assert.equal(foundation.body.reasoningSession.authority.toolUse, false);
  assert.equal(foundation.body.reasoningSession.authority.memoryWrite, false);
  assert.equal(foundation.body.reasoningSession.developmentProposal.architectureRoute.newHardcodedOrganAllowed, true);
  const organAdmission = await json(base + '/axm/v1/growth/organ-admission', { method: 'POST', headers, body: JSON.stringify({
    sessionId,
    reasoningSessions: [],
    evidenceBindings: [],
    proposedContract: {}
  }) });
  assert.equal(organAdmission.response.status, 200);
  assert.equal(organAdmission.body.assessment.classification, 'HOLD_EVIDENCE');
  assert.equal(organAdmission.body.assessment.authority.installOrgan, false);
  const experienceFixture = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'training', 'reasoning-strategy-train.json'), 'utf8'));
  const experienceRow = JSON.parse(JSON.stringify(experienceFixture.cases[0]));
  experienceRow.caseId = 'runtime-experience-case';
  experienceRow.sourceGroup = 'runtime/experience/independent-one';
  const verifiedExperience = ReasoningSkillCycle.buildVerifiedSession(experienceRow, {
    sha256: 'c'.repeat(64), value: { usePermission: 'allowed', permissionBasis: 'runtime contract test fixture' }
  }, { at: null });
  const experience = await json(base + '/axm/v1/reasoning/experience', { method: 'POST', headers, body: JSON.stringify({
    sessionId,
    reasoningSession: verifiedExperience,
    source: {
      provider: 'axm-workshop-local', sourceGroup: experienceRow.sourceGroup, experienceKind: 'REAL_LOCAL_LESSON', parentReceiptIds: [], interventionId: null, role: 'training', policyId: 'axm.mirror.standing-local-practice/v1', usePermission: 'allowed', permissionBasis: 'runtime contract test fixture',
      evaluator: { id: 'runtime-contract-independent-evaluator', kind: 'frozen-test-evaluator', independent: true, sourceRef: 'test://runtime/reasoning-experience', sourceDigest: 'e'.repeat(64) }
    },
    evaluation: {
      observedDecisionValue: verifiedExperience.principleTrace.decision.value,
      observedActionId: verifiedExperience.principleTrace.decision.selectedActionId,
      expectedDecisionValue: verifiedExperience.principleTrace.decision.value,
      expectedActionId: verifiedExperience.principleTrace.decision.selectedActionId,
      behaviorMatched: true,
      outcomeVerified: true,
      statement: 'Runtime contract evaluator observed the expected bounded behavior.',
      worldMutations: 0,
      runtimePointerChanged: false,
      unexpectedSeams: []
    }
  }) });
  assert.equal(experience.response.status, 201);
  assert.equal(experience.body.state, 'APPENDED_PRIVATE_TRAINING_RECEIPT');
  assert.equal(experience.body.receipt.authority.activeModelChange, false);
  assert.equal(experience.body.receipt.schema, ReasoningExperienceOrgan.SCHEMA);
  assert.equal(experience.body.receipt.source.experienceKind, 'REAL_LOCAL_LESSON');
  assert.equal(experience.body.activeRuntimeChanged, false);
  const traced = await json(base + '/axm/v1/reason', { method: 'POST', headers, body: JSON.stringify({
    sessionId, goal: 'Test one bounded candidate.',
    evidence: [{ id: 'proof', kind: 'test', statement: 'Passed.', source: { kind: 'test', id: 'runtime' } }],
    actions: [{ id: 'hold', kind: 'hold', label: 'Hold safely', supportingEvidence: ['proof'], risk: 'low', reversible: true, recovery: 'No mutation.' }]
  }) });
  assert.equal(traced.response.status, 200);
  assert.equal(traced.body.trace.identity, 'axm.machine.mirror/seed-0');
  const fetched = await json(base + `/axm/v1/trace/${traced.body.trace.traceId}`, { headers });
  assert.equal(fetched.body.trace.traceId, traced.body.trace.traceId);
  const closed = await json(base + '/axm/v1/session/close', { method: 'POST', headers, body: JSON.stringify({ sessionId }) });
  assert.deepEqual(closed.body.session.memoryWrites, []);
});

test('runtime refuses non-loopback binding', () => {
  assert.throws(() => createMirrorRuntime({ config: { host: '0.0.0.0', port: 0 }, token: 'x'.repeat(64), persist: false, presence: false }), /non-loopback/);
});
