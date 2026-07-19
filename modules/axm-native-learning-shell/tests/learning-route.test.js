'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const test = require('node:test');
const assert = require('node:assert/strict');
const Shell = require('../core/learning-shell');

test('bounded route emits inspectable artifacts without granting authority', t => {
  const stateDir = fs.mkdtempSync(path.join(os.tmpdir(), 'axm-learning-shell-'));
  t.after(() => fs.rmSync(stateDir, { recursive: true, force: true }));
  const options = { stateDir };
  const session = Shell.createSession({
    lessonId: 'studio-reversible-own-layer',
    modules: { lesson: false, training: false, judgement: false }
  }, options);
  const complete = Shell.runAll(session.id, {}, options);
  assert.equal(complete.status, 'COMPLETE');
  assert.deepEqual(complete.authority, {
    tools: false,
    externalNetwork: false,
    runtimePromotion: false,
    canonPromotion: false,
    identityMutation: false
  });
  for (const stage of ['context', 'analysis', 'reasoning', 'seam']) {
    assert.ok(complete.artifacts[stage], `${stage} artifact exists`);
    assert.ok(Shell.readArtifact(complete, stage, options));
  }
  const reasoning = Shell.readArtifact(complete, 'reasoning', options);
  assert.equal(reasoning.schema, 'axm.mirror.reasoning-session/v1');
  assert.equal(reasoning.authority.toolUse, false);
  assert.equal(reasoning.authority.memoryWrite, false);
  assert.equal(reasoning.memoryRoute.writesPerformed.length, 0);
  assert.equal(reasoning.principleTrace.schema, 'axm.mirror.trace/v1');
  assert.equal(complete.summaries.lesson.state, 'SKIPPED_BY_SESSION_CONFIGURATION');
  assert.equal(complete.summaries.training.state, 'SKIPPED_BY_SESSION_CONFIGURATION');
  assert.equal(complete.summaries.judgement.state, 'SKIPPED_BY_SESSION_CONFIGURATION');
});

test('training tuning is bounded and context cannot be disabled', () => {
  assert.deepEqual(Shell.normalizeTuning({ vocabSize: 1, order: 99, smoothingAlpha: 99 }), {
    vocabSize: 128,
    minFrequency: 2,
    order: 6,
    smoothingAlpha: 10
  });
  assert.equal(Shell.normalizeModules({ context: false }).context, true);
});

test('verified shell lessons append episodic reasoning receipts without claiming semantic truth', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'axm-learning-shell-experience-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const options = {
    stateDir: path.join(root, 'shell-state'),
    approvedEpisodesDir: path.join(root, 'episodes'),
    reasoningReceiptsRoot: root,
    reasoningReceiptsDir: path.join(root, 'reasoning-receipts')
  };
  const expected = [
    ['studio-reversible-own-layer', 'bounded-reversible-action'],
    ['publish-evidence-hold', 'ask-blocking-unknown']
  ];
  for (const [lessonId, strategyTag] of expected) {
    const session = Shell.createSession({ lessonId, modules: { training: false, judgement: false } }, options);
    const complete = Shell.runAll(session.id, {}, options);
    assert.equal(complete.status, 'COMPLETE');
    const lesson = Shell.readArtifact(complete, 'lesson', options);
    assert.ok(['APPENDED_PRIVATE_TRAINING_RECEIPT', 'REUSED_EQUIVALENT_SOURCE_GROUP_RECEIPT'].includes(lesson.reasoningExperience.state));
    assert.equal(lesson.reasoningExperience.outcome, 'WORKED');
    assert.equal(lesson.reasoningExperience.semanticConsolidation, false);
    assert.ok(lesson.reasoningExperience.strategyTags.includes(strategyTag));
  }
  const receipts = fs.readdirSync(options.reasoningReceiptsDir).filter(name => name.endsWith('.json'));
  assert.equal(receipts.length, 2);
});

test('training stage derives synthetic counterexamples before the next private reasoning cycle', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'axm-learning-shell-counterexamples-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const options = {
    stateDir: path.join(root, 'shell-state'),
    approvedEpisodesDir: path.join(root, 'episodes'),
    reasoningReceiptsRoot: root,
    reasoningReceiptsDir: path.join(root, 'reasoning-receipts'),
    tokenTrainingStateDir: path.join(root, 'token-runs'),
    reasoningSkillStateDir: path.join(root, 'reasoning-runs'),
    contractCurriculumStateDir: path.join(root, 'contract-curriculum-runs'),
    handoffGraphStateDir: path.join(root, 'handoff-graph-runs'),
    routeReadinessStateDir: path.join(root, 'route-readiness-runs'),
    readinessHandStateDir: path.join(root, 'readiness-hand-runs'),
    readinessProbeAffordanceStateDir: path.join(root, 'readiness-probe-affordance-runs'),
    providerDeclarationHandStateDir: path.join(root, 'provider-declaration-hand-runs'),
    providerDeclarationResearchExamStateDir: path.join(root, 'provider-declaration-research-exam-runs'),
    providerDeclarationArchitectureSurveyStateDir: path.join(root, 'provider-declaration-architecture-survey-runs'),
    providerDeclarationImplementationEvidenceSurveyStateDir: path.join(root, 'provider-declaration-implementation-evidence-survey-runs'),
    providerDeclarationBindingExperimentStateDir: path.join(root, 'provider-declaration-binding-experiment-runs'),
    providerDeclarationResearchExecutorBuilderStateDir: path.join(root, 'provider-declaration-research-executor-builder-runs'),
    readinessProbeBuilderStateDir: path.join(root, 'readiness-probe-builder-runs'),
    counterexampleStateDir: path.join(root, 'counterexample-runs'),
    metamorphicStateDir: path.join(root, 'metamorphic-runs')
  };
  const session = Shell.createSession({ lessonId: 'studio-reversible-own-layer' }, options);
  const complete = Shell.runAll(session.id, {}, options);
  assert.equal(complete.status, 'COMPLETE');
  const training = Shell.readArtifact(complete, 'training', options);
  assert.ok(training.reasoningContractCurriculumBatch.summary.eligibleContracts > 0);
  assert.ok(training.reasoningContractCurriculumBatch.summary.privateTrainingExams > 0);
  assert.ok(training.reasoningContractCurriculumBatch.summary.heldOutEvaluationExams > 0);
  assert.equal(training.reasoningContractCurriculumBatch.summary.boundaryMismatches, 0);
  assert.equal(training.reasoningContractHeldOutEvaluation.summary.challengerFailed, 0);
  assert.equal(training.reasoningContractHeldOutEvaluation.summary.trainingReceiptsCreated, 0);
  assert.equal(training.reasoningContractHeldOutEvaluation.splitLeakage, false);
  assert.equal(training.reasoningCounterexampleBatch.summary.sourceReceiptCount, 1);
  assert.equal(training.reasoningCounterexampleBatch.summary.interventions, 3);
  assert.equal(training.reasoningCounterexampleBatch.summary.worked, 3);
  assert.equal(training.reasoningCounterexampleBatch.summary.didNotWork, 0);
  assert.equal(training.reasoningMetamorphicBatch.summary.sourceReceiptCount, 1);
  assert.ok(training.reasoningHandoffGraphBatch.summary.exactCrossModuleEdges > 0);
  assert.equal(training.reasoningHandoffGraphBatch.summary.manifestBindingsPassed, training.reasoningHandoffGraphBatch.summary.eligibleContracts);
  assert.ok(training.reasoningHandoffGraphBatch.summary.undeclaredContractFiles > 0);
  assert.equal(training.reasoningHandoffGraphBatch.summary.exactRoutesSelected,
    training.reasoningHandoffGraphBatch.summary.directRoutes + training.reasoningHandoffGraphBatch.summary.composedDepthTwoRoutes);
  assert.equal(training.reasoningHandoffGraphBatch.summary.routeSelectionMismatches, 0);
  assert.equal(training.reasoningHandoffGraphBatch.summary.unboundDecoysRejected, training.reasoningHandoffGraphBatch.summary.exactRoutesSelected);
  assert.equal(training.reasoningHandoffGraphBatch.summary.trainingReceiptsCreated, 0);
  assert.equal(training.reasoningHandoffGraphBatch.summary.worldActionsExecuted, 0);
  assert.equal(training.reasoningRouteReadinessBatch.summary.graphRoutes, training.reasoningHandoffGraphBatch.summary.exactRoutesSelected);
  assert.equal(training.reasoningRouteReadinessBatch.summary.classificationsMatched, training.reasoningRouteReadinessBatch.summary.graphRoutes);
  assert.equal(training.reasoningRouteReadinessBatch.summary.classificationMismatches, 0);
  assert.equal(training.reasoningRouteReadinessBatch.summary.trainingReceiptsCreated, 0);
  assert.equal(training.reasoningRouteReadinessBatch.summary.worldActionsExecuted, 0);
  assert.ok(Object.entries(training.reasoningRouteReadinessBatch.authority).every(([key, value]) => key === 'privateEvaluationTraceWrite' ? value === true : value === false));
  assert.equal(training.reasoningReadinessHandBatch.summary.unknownRequirementIds, 6);
  assert.equal(training.reasoningReadinessHandBatch.summary.missingProbeHandRequests, 6);
  assert.equal(training.reasoningReadinessHandBatch.summary.unknownInspectionHolds, 0);
  assert.equal(training.reasoningReadinessHandBatch.summary.classificationMismatches, 0);
  assert.equal(training.reasoningReadinessHandBatch.summary.codeFilesGenerated, 0);
  assert.equal(training.reasoningReadinessHandBatch.summary.probesInstalled, 0);
  assert.equal(training.reasoningReadinessHandBatch.summary.servicesStartedOrRepaired, 0);
  assert.equal(training.reasoningReadinessHandBatch.summary.trainingReceiptsCreated, 0);
  assert.equal(training.reasoningReadinessHandBatch.summary.worldActionsExecuted, 0);
  assert.equal(training.reasoningReadinessProbeAffordanceBatch.summary.handRequestsAssessed, 6);
  assert.equal(training.reasoningReadinessProbeAffordanceBatch.summary.exactModuleReviewPackets, 3);
  assert.equal(training.reasoningReadinessProbeAffordanceBatch.summary.exactSharedServiceReviewPackets, 1);
  assert.equal(training.reasoningReadinessProbeAffordanceBatch.summary.exactFoundationServiceReviewPackets, 1);
  assert.equal(training.reasoningReadinessProbeAffordanceBatch.summary.reviewPacketsProposed, 5);
  assert.equal(training.reasoningReadinessProbeAffordanceBatch.summary.noProviderHolds, 1);
  assert.equal(training.reasoningReadinessProbeAffordanceBatch.summary.ambiguousProviderHolds, 0);
  assert.equal(training.reasoningReadinessProbeAffordanceBatch.summary.nameInferenceCandidatesRejected, 6);
  assert.equal(training.reasoningReadinessProbeAffordanceBatch.summary.falseReadyCandidatesRejected, 6);
  assert.equal(training.reasoningReadinessProbeAffordanceBatch.summary.humanReviewsCreated, 0);
  assert.equal(training.reasoningReadinessProbeAffordanceBatch.summary.recipesSealed, 0);
  assert.equal(training.reasoningReadinessProbeAffordanceBatch.summary.candidatesBuilt, 0);
  assert.equal(training.reasoningReadinessProbeAffordanceBatch.summary.liveProbesExecuted, 0);
  assert.equal(training.reasoningReadinessProbeAffordanceBatch.summary.workshopFilesChanged, 0);
  assert.equal(training.reasoningProviderDeclarationHandBatch.summary.affordanceAssessmentsEvaluated, 6);
  assert.equal(training.reasoningProviderDeclarationHandBatch.summary.providerDeclarationHandsProposed, 1);
  assert.equal(training.reasoningProviderDeclarationHandBatch.summary.declarationsPresentNoGap, 5);
  assert.equal(training.reasoningProviderDeclarationHandBatch.summary.noConsumerDemandHolds, 0);
  assert.equal(training.reasoningProviderDeclarationHandBatch.summary.ambiguousProviderHolds, 0);
  assert.equal(training.reasoningProviderDeclarationHandBatch.summary.reasoningDecisionsMatched, 6);
  assert.equal(training.reasoningProviderDeclarationHandBatch.summary.providerInferenceCandidatesRejected, 6);
  assert.equal(training.reasoningProviderDeclarationHandBatch.summary.falseAvailableCandidatesRejected, 6);
  assert.equal(training.reasoningProviderDeclarationHandBatch.summary.declarationCandidateFilesGenerated, 0);
  assert.equal(training.reasoningProviderDeclarationHandBatch.summary.providerDeclarationsWritten, 0);
  assert.equal(training.reasoningProviderDeclarationHandBatch.summary.liveProbesExecuted, 0);
  assert.equal(training.reasoningProviderDeclarationHandBatch.summary.workshopFilesChanged, 0);
  const declarationHand = training.reasoningProviderDeclarationHandBatch.results.find(item => item.handRequest);
  assert.equal(declarationHand.handRequest.requirementId, 'shared-physics');
  assert.deepEqual(declarationHand.handRequest.consumerDemand.providerSelectors, ['axm-physics-2d']);
  assert.equal(declarationHand.handRequest.proposedProviderDeclarationContract.providerIdentity, 'UNRESOLVED_NOT_INFERRED');
  assert.equal(training.reasoningProviderDeclarationResearchExamBatch.summary.providerDeclarationHandResultsEvaluated, 6);
  assert.equal(training.reasoningProviderDeclarationResearchExamBatch.summary.researchExamRequestsProposed, 1);
  assert.equal(training.reasoningProviderDeclarationResearchExamBatch.summary.declarationsPresentNoExam, 5);
  assert.equal(training.reasoningProviderDeclarationResearchExamBatch.summary.frontierExamRequired, 1);
  assert.equal(training.reasoningProviderDeclarationResearchExamBatch.summary.reasoningDecisionsMatched, 6);
  assert.equal(training.reasoningProviderDeclarationResearchExamBatch.summary.providerBuildCandidatesRejected, 6);
  assert.equal(training.reasoningProviderDeclarationResearchExamBatch.summary.falseResolutionCandidatesRejected, 6);
  assert.equal(training.reasoningProviderDeclarationResearchExamBatch.summary.architecturesSelected, 0);
  assert.equal(training.reasoningProviderDeclarationResearchExamBatch.summary.examExecutorsBuilt, 0);
  assert.equal(training.reasoningProviderDeclarationResearchExamBatch.summary.fixtureFilesGenerated, 0);
  assert.equal(training.reasoningProviderDeclarationResearchExamBatch.summary.providerCandidatesBuilt, 0);
  assert.equal(training.reasoningProviderDeclarationResearchExamBatch.summary.providerDeclarationsWritten, 0);
  assert.equal(training.reasoningProviderDeclarationResearchExamBatch.summary.liveExperimentsExecuted, 0);
  assert.equal(training.reasoningProviderDeclarationResearchExamBatch.summary.workshopFilesChanged, 0);
  const researchExam = training.reasoningProviderDeclarationResearchExamBatch.results.find(item => item.researchExamRequest);
  assert.equal(researchExam.researchExamRequest.sourceHand.requirementId, 'shared-physics');
  assert.equal(researchExam.researchExamRequest.architectureHypotheses.length, 4);
  assert.equal(researchExam.researchExamRequest.caseFamilies.length, 10);
  assert.equal(researchExam.researchExamRequest.architectureDecision, 'UNRESOLVED_REQUIRES_INDEPENDENT_EXPERIMENT');
  assert.equal(researchExam.researchExamRequest.examExecutorState, 'NOT_BUILT');
  assert.equal(researchExam.frontierAssessment.classification, 'FRONTIER_EXAM_REQUIRED');
  assert.equal(training.reasoningProviderDeclarationResearchExecutorBatch.summary.reviewedRecipes, 0);
  assert.equal(training.reasoningProviderDeclarationResearchExecutorBatch.summary.executorCandidatesBuilt, 0);
  assert.equal(training.reasoningProviderDeclarationResearchExecutorBatch.summary.candidateFilesGenerated, 0);
  assert.equal(training.reasoningProviderDeclarationResearchExecutorBatch.summary.fixtureCasesExecuted, 0);
  assert.equal(training.reasoningProviderDeclarationResearchExecutorBatch.summary.architecturesSelected, 0);
  assert.equal(training.reasoningProviderDeclarationResearchExecutorBatch.summary.architecturesEvaluated, 0);
  assert.equal(training.reasoningProviderDeclarationResearchExecutorBatch.summary.providerCandidatesBuilt, 0);
  assert.equal(training.reasoningProviderDeclarationResearchExecutorBatch.summary.workshopFilesChanged, 0);
  assert.equal(training.reasoningProviderDeclarationResearchExecutorBatch.summary.trainingReceiptsCreated, 0);
  assert.equal(training.reasoningProviderDeclarationArchitectureSurveyBatch.summary.researchExamResultsEvaluated, 6);
  assert.equal(training.reasoningProviderDeclarationArchitectureSurveyBatch.summary.surveysProposed, 1);
  assert.ok(training.reasoningProviderDeclarationArchitectureSurveyBatch.summary.inventoryDocuments > 0);
  assert.ok(training.reasoningProviderDeclarationArchitectureSurveyBatch.summary.relevantPatternAssessments > 0);
  assert.equal(training.reasoningProviderDeclarationArchitectureSurveyBatch.summary.completeCurrentRelationWitnesses, 0);
  assert.equal(training.reasoningProviderDeclarationArchitectureSurveyBatch.summary.hypothesesRemainingUntested, 4);
  assert.equal(training.reasoningProviderDeclarationArchitectureSurveyBatch.summary.frequencySelectionsRejected, 6);
  assert.equal(training.reasoningProviderDeclarationArchitectureSurveyBatch.summary.crossDocumentMergesRejected, 6);
  assert.equal(training.reasoningProviderDeclarationArchitectureSurveyBatch.summary.providerIdentitiesInferred, 0);
  assert.equal(training.reasoningProviderDeclarationArchitectureSurveyBatch.summary.architecturesSelected, 0);
  assert.equal(training.reasoningProviderDeclarationArchitectureSurveyBatch.summary.architecturesEvaluated, 0);
  assert.equal(training.reasoningProviderDeclarationArchitectureSurveyBatch.summary.providerCandidatesBuilt, 0);
  assert.equal(training.reasoningProviderDeclarationArchitectureSurveyBatch.summary.workshopFilesChanged, 0);
  assert.equal(training.reasoningProviderDeclarationArchitectureSurveyBatch.summary.trainingReceiptsCreated, 0);
  assert.equal(training.reasoningProviderDeclarationImplementationEvidenceSurveyBatch.summary.architectureSurveyResultsEvaluated, 6);
  assert.equal(training.reasoningProviderDeclarationImplementationEvidenceSurveyBatch.summary.evidenceSurveysProposed, 1);
  assert.equal(training.reasoningProviderDeclarationImplementationEvidenceSurveyBatch.summary.noArchitectureSurveyHolds, 5);
  assert.ok(training.reasoningProviderDeclarationImplementationEvidenceSurveyBatch.summary.inventorySources > 0);
  assert.ok(training.reasoningProviderDeclarationImplementationEvidenceSurveyBatch.summary.selectorBearingSources > 0);
  assert.equal(training.reasoningProviderDeclarationImplementationEvidenceSurveyBatch.summary.demandedSelectorsWitnessed, 1);
  assert.ok(training.reasoningProviderDeclarationImplementationEvidenceSurveyBatch.summary.exportAndRegistrationSources > 0);
  assert.ok(training.reasoningProviderDeclarationImplementationEvidenceSurveyBatch.summary.testSources > 0);
  assert.equal(training.reasoningProviderDeclarationImplementationEvidenceSurveyBatch.summary.reasoningDecisionsMatched, 6);
  assert.equal(training.reasoningProviderDeclarationImplementationEvidenceSurveyBatch.summary.providerInferencesRejected, 6);
  assert.equal(training.reasoningProviderDeclarationImplementationEvidenceSurveyBatch.summary.frequencySelectionsRejected, 6);
  assert.equal(training.reasoningProviderDeclarationImplementationEvidenceSurveyBatch.summary.providerIdentitiesInferred, 0);
  assert.equal(training.reasoningProviderDeclarationImplementationEvidenceSurveyBatch.summary.outerRequirementsBound, 0);
  assert.equal(training.reasoningProviderDeclarationImplementationEvidenceSurveyBatch.summary.implementationsSelected, 0);
  assert.equal(training.reasoningProviderDeclarationImplementationEvidenceSurveyBatch.summary.sourcesExecuted, 0);
  assert.equal(training.reasoningProviderDeclarationImplementationEvidenceSurveyBatch.summary.architecturesSelected, 0);
  assert.equal(training.reasoningProviderDeclarationImplementationEvidenceSurveyBatch.summary.architecturesEvaluated, 0);
  assert.equal(training.reasoningProviderDeclarationImplementationEvidenceSurveyBatch.summary.providerCandidatesBuilt, 0);
  assert.equal(training.reasoningProviderDeclarationImplementationEvidenceSurveyBatch.summary.providerDeclarationsWritten, 0);
  assert.equal(training.reasoningProviderDeclarationImplementationEvidenceSurveyBatch.summary.workshopFilesChanged, 0);
  assert.equal(training.reasoningProviderDeclarationImplementationEvidenceSurveyBatch.summary.trainingReceiptsCreated, 0);
  assert.equal(training.reasoningProviderDeclarationBindingExperimentBatch.summary.implementationEvidenceResultsEvaluated, 6);
  assert.equal(training.reasoningProviderDeclarationBindingExperimentBatch.summary.experimentMatricesProposed, 1);
  assert.equal(training.reasoningProviderDeclarationBindingExperimentBatch.summary.noImplementationEvidenceHolds, 5);
  assert.ok(training.reasoningProviderDeclarationBindingExperimentBatch.summary.candidateSourceWitnesses > 0);
  assert.ok(training.reasoningProviderDeclarationBindingExperimentBatch.summary.validationOnlyWitnesses > 0);
  assert.equal(training.reasoningProviderDeclarationBindingExperimentBatch.summary.architectureHypothesesRepresented, 3);
  assert.equal(training.reasoningProviderDeclarationBindingExperimentBatch.summary.experimentFramesProposed, training.reasoningProviderDeclarationBindingExperimentBatch.summary.candidateSourceWitnesses * 3);
  assert.equal(training.reasoningProviderDeclarationBindingExperimentBatch.summary.reasoningDecisionsMatched, 6);
  assert.equal(training.reasoningProviderDeclarationBindingExperimentBatch.summary.frameSelectionsRejected, 6);
  assert.equal(training.reasoningProviderDeclarationBindingExperimentBatch.summary.permissionCopiesRejected, 6);
  assert.equal(training.reasoningProviderDeclarationBindingExperimentBatch.summary.framesSelected, 0);
  assert.equal(training.reasoningProviderDeclarationBindingExperimentBatch.summary.providerIdentitiesInferred, 0);
  assert.equal(training.reasoningProviderDeclarationBindingExperimentBatch.summary.outerRequirementsBound, 0);
  assert.equal(training.reasoningProviderDeclarationBindingExperimentBatch.summary.permissionsInferred, 0);
  assert.equal(training.reasoningProviderDeclarationBindingExperimentBatch.summary.sourcesExecuted, 0);
  assert.equal(training.reasoningProviderDeclarationBindingExperimentBatch.summary.providerCandidatesBuilt, 0);
  assert.equal(training.reasoningProviderDeclarationBindingExperimentBatch.summary.providerDeclarationsWritten, 0);
  assert.equal(training.reasoningProviderDeclarationBindingExperimentBatch.summary.workshopFilesChanged, 0);
  assert.equal(training.reasoningProviderDeclarationBindingExperimentBatch.summary.trainingReceiptsCreated, 0);
  assert.equal(training.reasoningReadinessProbeCandidateBatch.summary.reviewedRecipes, 0);
  assert.equal(training.reasoningReadinessProbeCandidateBatch.summary.candidatesBuilt, 0);
  assert.equal(training.reasoningReadinessProbeCandidateBatch.summary.candidateCodeFilesGenerated, 0);
  assert.equal(training.reasoningReadinessProbeCandidateBatch.summary.fixtureSuitesPassed, 0);
  assert.equal(training.reasoningReadinessProbeCandidateBatch.summary.probesInstalled, 0);
  assert.equal(training.reasoningReadinessProbeCandidateBatch.summary.liveProbesExecuted, 0);
  assert.equal(training.reasoningReadinessProbeCandidateBatch.summary.workshopFilesChanged, 0);
  assert.equal(training.reasoningReadinessProbeCandidateBatch.summary.trainingReceiptsCreated, 0);
  assert.equal(training.reasoningReadinessProbeCandidateBatch.summary.worldActionsExecuted, 0);
  assert.equal(training.reasoningMetamorphicBatch.summary.probes, 15);
  assert.equal(training.reasoningMetamorphicBatch.summary.atomicProbes, 5);
  assert.equal(training.reasoningMetamorphicBatch.summary.composedProbes, 10);
  assert.equal(training.reasoningMetamorphicBatch.summary.maximumCompositionDepth, 2);
  assert.equal(training.reasoningMetamorphicBatch.summary.invariantConfirmed, 15);
  assert.equal(training.reasoningMetamorphicBatch.summary.counterexamplesFound, 0);
  assert.equal(training.reasoningMetamorphicBatch.summary.positiveTrainingReceiptsCreated, 0);
  assert.equal(training.reasoningMetamorphicBatch.frontier.state, 'NO_UNEXPECTED_SEAM');
  assert.equal(training.reasoningSkillCycle.corpus.realLocalReasoningExperienceReceiptCount, 1);
  assert.equal(training.reasoningSkillCycle.corpus.syntheticCounterexampleReceiptCount, 3);
  assert.equal(training.reasoningSkillCycle.corpus.contractDerivedExamReceiptCount, training.reasoningContractCurriculumBatch.summary.privateTrainingExams);
  assert.equal(training.reasoningSkillCycle.authority.activeRuntime, false);
  assert.equal(training.reasoningCounterexampleBatch.authority.worldAction, false);
  assert.equal(training.reasoningCounterexampleBatch.authority.semanticTruthWrite, false);
  assert.equal(training.reasoningMetamorphicBatch.authority.trainingOnMatchedProbe, false);
  assert.equal(training.reasoningMetamorphicBatch.supersedes.state, 'SUPERSEDED_ATOMIC_ONLY_VALID_EVIDENCE_PRESERVED');
});
