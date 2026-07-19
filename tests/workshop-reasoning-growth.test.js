'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const test = require('node:test');
const assert = require('node:assert/strict');
const { createMirrorRuntime } = require('../runtime/server');
const Curriculum = require('../training/workshop-steward-curriculum');
const Experience = require('../organs/reasoning-experience-organ');
const WorkshopRoot = require('../config/workshop-root');

const ROOT = path.resolve(__dirname, '..');

test('automatic Workshop practice captures real receipts, derives counterexamples, and retrains privately', async t => {
  const workshop = WorkshopRoot.inspect({ configRoot: ROOT });
  if (!workshop.available) {
    t.skip(`WORKSHOP_ABSENT: ${workshop.reason} Set AXM_WORKSHOP_ROOT or config/mirror.config.local.json workshopRoot to run this live-integration test.`);
    return;
  }
  const privateRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'axm-automatic-reasoning-growth-'));
  const token = 'g'.repeat(64);
  const runtime = createMirrorRuntime({
    config: { host: '127.0.0.1', port: 0, presenceEnabled: false, automaticPracticeOnStart: false },
    token,
    persist: false,
    presence: false
  });
  await runtime.start();
  t.after(async () => {
    await runtime.stop();
    fs.rmSync(privateRoot, { recursive: true, force: true });
  });
  const receiptDirectory = path.join(privateRoot, 'reasoning-receipts');
  const result = await Curriculum.run({
    root: privateRoot,
    reasoningCycleRoot: ROOT,
    baseUrl: `http://127.0.0.1:${runtime.port}`,
    token,
    policyFile: path.join(ROOT, 'training', 'TRAINING_POLICY.json'),
    episodeDir: path.join(privateRoot, 'episodes'),
    reportDir: path.join(privateRoot, 'reports'),
    reasoningReceiptsDir: receiptDirectory,
    contractCurriculumStateDir: path.join(privateRoot, 'contract-curriculum-runs'),
    handoffGraphStateDir: path.join(privateRoot, 'handoff-graph-runs'),
    readinessProbeAffordanceStateDir: path.join(privateRoot, 'readiness-probe-affordance-runs'),
    providerDeclarationHandStateDir: path.join(privateRoot, 'provider-declaration-hand-runs'),
    providerDeclarationResearchExamStateDir: path.join(privateRoot, 'provider-declaration-research-exam-runs'),
    providerDeclarationResearchExecutorBuilderStateDir: path.join(privateRoot, 'provider-declaration-research-executor-builder-runs'),
    providerDeclarationArchitectureSurveyStateDir: path.join(privateRoot, 'provider-declaration-architecture-survey-runs'),
    providerDeclarationImplementationEvidenceSurveyStateDir: path.join(privateRoot, 'provider-declaration-implementation-evidence-survey-runs'),
    providerDeclarationBindingExperimentStateDir: path.join(privateRoot, 'provider-declaration-binding-experiment-runs'),
    readinessProbeBuilderStateDir: path.join(privateRoot, 'readiness-probe-builder-runs'),
    counterexampleStateDir: path.join(privateRoot, 'counterexample-runs'),
    metamorphicStateDir: path.join(privateRoot, 'metamorphic-runs'),
    failureCurriculumStateDir: path.join(privateRoot, 'failure-curriculum-runs'),
    reasoningStateDir: path.join(privateRoot, 'reasoning-runs'),
    runLearning: false,
    runReasoningLearning: true
  });
  assert.equal(result.report.lessons.length, 5);
  assert.ok(result.report.lessons.every(item => item.reasoningExperience.outcome === 'WORKED'));
  assert.ok(result.report.lessons.every(item => item.reasoningExperience.experienceKind === 'REAL_LOCAL_LESSON'));
  assert.ok(result.report.reasoningLearning.contractCurriculum.eligibleContracts > 0);
  assert.ok(result.report.reasoningLearning.contractCurriculum.privateTrainingExams > 0);
  assert.ok(result.report.reasoningLearning.contractCurriculum.heldOutEvaluationExams > 0);
  assert.equal(result.report.reasoningLearning.contractCurriculum.boundaryMismatches, 0);
  assert.equal(result.report.reasoningLearning.failureCurriculum.state, 'NO_VERIFIED_REAL_LOCAL_NEGATIVE_EXPERIENCE');
  assert.equal(result.report.reasoningLearning.failureCurriculum.realLocalNegativeReceipts, 0);
  assert.equal(result.report.reasoningLearning.failureCurriculum.curriculumRequestsProposed, 0);
  assert.equal(result.report.reasoningLearning.failureCurriculum.trainingAdmissions, 0);
  assert.equal(result.report.reasoningLearning.failureCurriculum.codeBuilds, 0);
  assert.equal(result.report.reasoningLearning.failureCurriculum.organsInstalled, 0);
  assert.equal(result.report.reasoningLearning.contractCurriculum.heldOutChallengerFailed, 0);
  assert.equal(result.report.reasoningLearning.contractCurriculum.heldOutTrainingReceiptsCreated, 0);
  assert.equal(result.report.reasoningLearning.contractCurriculum.splitLeakage, false);
  assert.ok(result.report.reasoningLearning.handoffGraph.eligibleContracts > 0);
  assert.equal(result.report.reasoningLearning.handoffGraph.manifestBindingsPassed, result.report.reasoningLearning.handoffGraph.eligibleContracts);
  assert.ok(result.report.reasoningLearning.handoffGraph.undeclaredContractFiles > 0);
  assert.ok(result.report.reasoningLearning.handoffGraph.exactCrossModuleEdges > 0);
  assert.ok(result.report.reasoningLearning.handoffGraph.directRoutes > 0);
  assert.ok(result.report.reasoningLearning.handoffGraph.composedDepthTwoRoutes > 0);
  assert.equal(result.report.reasoningLearning.handoffGraph.exactRoutesSelected,
    result.report.reasoningLearning.handoffGraph.directRoutes + result.report.reasoningLearning.handoffGraph.composedDepthTwoRoutes);
  assert.equal(result.report.reasoningLearning.handoffGraph.routeSelectionMismatches, 0);
  assert.equal(result.report.reasoningLearning.handoffGraph.unboundDecoysRejected, result.report.reasoningLearning.handoffGraph.exactRoutesSelected);
  assert.equal(result.report.reasoningLearning.handoffGraph.trainingReceiptsCreated, 0);
  assert.equal(result.report.reasoningLearning.handoffGraph.worldActionsExecuted, 0);
  const affordances = result.report.reasoningLearning.readinessProbeAffordances;
  assert.ok(affordances.handRequestsAssessed > 0);
  assert.equal(affordances.reviewPacketsProposed,
    affordances.exactModuleReviewPackets + affordances.exactSharedServiceReviewPackets + affordances.exactFoundationServiceReviewPackets);
  assert.equal(affordances.handRequestsAssessed,
    affordances.reviewPacketsProposed + affordances.noProviderHolds + affordances.ambiguousProviderHolds);
  assert.equal(affordances.reasoningDecisionsMatched, affordances.handRequestsAssessed);
  assert.equal(affordances.nameInferenceCandidatesRejected, affordances.handRequestsAssessed);
  assert.equal(affordances.falseReadyCandidatesRejected, affordances.handRequestsAssessed);
  assert.equal(result.report.reasoningLearning.readinessProbeAffordances.humanReviewsCreated, 0);
  assert.equal(result.report.reasoningLearning.readinessProbeAffordances.recipesSealed, 0);
  assert.equal(result.report.reasoningLearning.readinessProbeAffordances.candidatesBuilt, 0);
  assert.equal(result.report.reasoningLearning.readinessProbeAffordances.liveProbesExecuted, 0);
  assert.equal(result.report.reasoningLearning.readinessProbeAffordances.workshopFilesChanged, 0);
  assert.equal(result.report.automatic.exactDeclarationReadinessProbeAffordancePlanning, true);
  assert.equal(result.report.reasoningLearning.providerDeclarationHands.state, 'PROPOSED_PROVIDER_DECLARATION_GAP_HANDS');
  const declarationHands = result.report.reasoningLearning.providerDeclarationHands;
  assert.equal(declarationHands.affordanceAssessmentsEvaluated, affordances.handRequestsAssessed);
  assert.equal(declarationHands.affordanceAssessmentsEvaluated,
    declarationHands.providerDeclarationHandsProposed + declarationHands.declarationsPresentNoGap + declarationHands.noConsumerDemandHolds + declarationHands.ambiguousProviderHolds);
  assert.equal(declarationHands.reasoningDecisionsMatched, declarationHands.affordanceAssessmentsEvaluated);
  assert.equal(declarationHands.providerInferenceCandidatesRejected, declarationHands.affordanceAssessmentsEvaluated);
  assert.equal(declarationHands.falseAvailableCandidatesRejected, declarationHands.affordanceAssessmentsEvaluated);
  assert.equal(result.report.reasoningLearning.providerDeclarationHands.declarationCandidateFilesGenerated, 0);
  assert.equal(result.report.reasoningLearning.providerDeclarationHands.providerDeclarationsWritten, 0);
  assert.equal(result.report.reasoningLearning.providerDeclarationHands.liveProbesExecuted, 0);
  assert.equal(result.report.reasoningLearning.providerDeclarationHands.workshopFilesChanged, 0);
  assert.equal(result.report.reasoningLearning.providerDeclarationHands.trainingReceiptsCreated, 0);
  assert.equal(result.report.reasoningLearning.providerDeclarationHands.worldActionsExecuted, 0);
  assert.equal(result.report.automatic.nonbuiltProviderDeclarationGapHandPlanning, true);
  assert.equal(result.report.reasoningLearning.providerDeclarationResearchExams.state, 'PROPOSED_PROVIDER_DECLARATION_RESEARCH_EXAMS');
  const researchExams = result.report.reasoningLearning.providerDeclarationResearchExams;
  assert.equal(researchExams.providerDeclarationHandResultsEvaluated, declarationHands.affordanceAssessmentsEvaluated);
  assert.equal(researchExams.researchExamRequestsProposed, declarationHands.providerDeclarationHandsProposed);
  assert.equal(researchExams.providerDeclarationHandResultsEvaluated,
    researchExams.researchExamRequestsProposed + researchExams.declarationsPresentNoExam + researchExams.noConsumerDemandResearchHolds + researchExams.ambiguousProviderResearchHolds);
  assert.equal(researchExams.frontierExamRequired, researchExams.researchExamRequestsProposed);
  assert.equal(researchExams.reasoningDecisionsMatched, researchExams.providerDeclarationHandResultsEvaluated);
  assert.equal(researchExams.providerBuildCandidatesRejected, researchExams.providerDeclarationHandResultsEvaluated);
  assert.equal(researchExams.falseResolutionCandidatesRejected, researchExams.providerDeclarationHandResultsEvaluated);
  assert.equal(result.report.reasoningLearning.providerDeclarationResearchExams.architecturesSelected, 0);
  assert.equal(result.report.reasoningLearning.providerDeclarationResearchExams.examExecutorsBuilt, 0);
  assert.equal(result.report.reasoningLearning.providerDeclarationResearchExams.fixtureFilesGenerated, 0);
  assert.equal(result.report.reasoningLearning.providerDeclarationResearchExams.providerCandidatesBuilt, 0);
  assert.equal(result.report.reasoningLearning.providerDeclarationResearchExams.providerDeclarationsWritten, 0);
  assert.equal(result.report.reasoningLearning.providerDeclarationResearchExams.liveExperimentsExecuted, 0);
  assert.equal(result.report.reasoningLearning.providerDeclarationResearchExams.workshopFilesChanged, 0);
  assert.equal(result.report.reasoningLearning.providerDeclarationResearchExams.trainingReceiptsCreated, 0);
  assert.equal(result.report.reasoningLearning.providerDeclarationResearchExecutors.state, 'NO_REVIEWED_EXECUTOR_RECIPES_SUBMITTED');
  assert.equal(result.report.reasoningLearning.providerDeclarationResearchExecutors.reviewedRecipes, 0);
  assert.equal(result.report.reasoningLearning.providerDeclarationResearchExecutors.executorCandidatesBuilt, 0);
  assert.equal(result.report.reasoningLearning.providerDeclarationResearchExecutors.candidateFilesGenerated, 0);
  assert.equal(result.report.reasoningLearning.providerDeclarationResearchExecutors.fixtureCasesExecuted, 0);
  assert.equal(result.report.reasoningLearning.providerDeclarationResearchExecutors.architecturesSelected, 0);
  assert.equal(result.report.reasoningLearning.providerDeclarationResearchExecutors.architecturesEvaluated, 0);
  assert.equal(result.report.reasoningLearning.providerDeclarationResearchExecutors.providerCandidatesBuilt, 0);
  assert.equal(result.report.reasoningLearning.providerDeclarationResearchExecutors.providerDeclarationsWritten, 0);
  assert.equal(result.report.reasoningLearning.providerDeclarationResearchExecutors.liveExperimentsExecuted, 0);
  assert.equal(result.report.reasoningLearning.providerDeclarationResearchExecutors.workshopFilesChanged, 0);
  assert.equal(result.report.reasoningLearning.providerDeclarationResearchExecutors.trainingReceiptsCreated, 0);
  assert.equal(result.report.reasoningLearning.providerDeclarationArchitectureSurveys.state, 'PROPOSED_PROVIDER_DECLARATION_ARCHITECTURE_PATTERN_EVIDENCE');
  const architectureSurveys = result.report.reasoningLearning.providerDeclarationArchitectureSurveys;
  assert.equal(architectureSurveys.researchExamResultsEvaluated, researchExams.providerDeclarationHandResultsEvaluated);
  assert.equal(architectureSurveys.surveysProposed, researchExams.researchExamRequestsProposed);
  assert.equal(architectureSurveys.noExamHolds, architectureSurveys.researchExamResultsEvaluated - architectureSurveys.surveysProposed);
  assert.ok(result.report.reasoningLearning.providerDeclarationArchitectureSurveys.inventoryDocuments > 0);
  assert.ok(result.report.reasoningLearning.providerDeclarationArchitectureSurveys.relevantPatternAssessments > 0);
  assert.equal(result.report.reasoningLearning.providerDeclarationArchitectureSurveys.completeCurrentRelationWitnesses, 0);
  assert.equal(architectureSurveys.hypothesesRemainingUntested, architectureSurveys.surveysProposed * 4);
  assert.equal(architectureSurveys.reasoningDecisionsMatched, architectureSurveys.researchExamResultsEvaluated);
  assert.equal(architectureSurveys.frequencySelectionsRejected, architectureSurveys.researchExamResultsEvaluated);
  assert.equal(architectureSurveys.crossDocumentMergesRejected, architectureSurveys.researchExamResultsEvaluated);
  assert.equal(result.report.reasoningLearning.providerDeclarationArchitectureSurveys.providerIdentitiesInferred, 0);
  assert.equal(result.report.reasoningLearning.providerDeclarationArchitectureSurveys.architecturesSelected, 0);
  assert.equal(result.report.reasoningLearning.providerDeclarationArchitectureSurveys.architecturesEvaluated, 0);
  assert.equal(result.report.reasoningLearning.providerDeclarationArchitectureSurveys.providerCandidatesBuilt, 0);
  assert.equal(result.report.reasoningLearning.providerDeclarationArchitectureSurveys.providerDeclarationsWritten, 0);
  assert.equal(result.report.reasoningLearning.providerDeclarationArchitectureSurveys.liveExperimentsExecuted, 0);
  assert.equal(result.report.reasoningLearning.providerDeclarationArchitectureSurveys.workshopFilesChanged, 0);
  assert.equal(result.report.reasoningLearning.providerDeclarationArchitectureSurveys.trainingReceiptsCreated, 0);
  assert.equal(result.report.reasoningLearning.providerDeclarationImplementationEvidenceSurveys.state, 'PROPOSED_PROVIDER_IMPLEMENTATION_SOURCE_EVIDENCE');
  const implementationEvidence = result.report.reasoningLearning.providerDeclarationImplementationEvidenceSurveys;
  assert.equal(implementationEvidence.architectureSurveyResultsEvaluated, architectureSurveys.researchExamResultsEvaluated);
  assert.equal(implementationEvidence.evidenceSurveysProposed, architectureSurveys.surveysProposed);
  assert.equal(implementationEvidence.noArchitectureSurveyHolds, implementationEvidence.architectureSurveyResultsEvaluated - implementationEvidence.evidenceSurveysProposed);
  assert.ok(result.report.reasoningLearning.providerDeclarationImplementationEvidenceSurveys.inventorySources > 0);
  assert.ok(result.report.reasoningLearning.providerDeclarationImplementationEvidenceSurveys.selectorBearingSources > 0);
  assert.equal(implementationEvidence.demandedSelectorsWitnessed, implementationEvidence.evidenceSurveysProposed);
  assert.ok(result.report.reasoningLearning.providerDeclarationImplementationEvidenceSurveys.exportAndRegistrationSources > 0);
  assert.ok(result.report.reasoningLearning.providerDeclarationImplementationEvidenceSurveys.testSources > 0);
  assert.equal(implementationEvidence.reasoningDecisionsMatched, implementationEvidence.architectureSurveyResultsEvaluated);
  assert.equal(implementationEvidence.providerInferencesRejected, implementationEvidence.architectureSurveyResultsEvaluated);
  assert.equal(implementationEvidence.frequencySelectionsRejected, implementationEvidence.architectureSurveyResultsEvaluated);
  assert.equal(result.report.reasoningLearning.providerDeclarationImplementationEvidenceSurveys.providerIdentitiesInferred, 0);
  assert.equal(result.report.reasoningLearning.providerDeclarationImplementationEvidenceSurveys.outerRequirementsBound, 0);
  assert.equal(result.report.reasoningLearning.providerDeclarationImplementationEvidenceSurveys.implementationsSelected, 0);
  assert.equal(result.report.reasoningLearning.providerDeclarationImplementationEvidenceSurveys.sourcesExecuted, 0);
  assert.equal(result.report.reasoningLearning.providerDeclarationImplementationEvidenceSurveys.architecturesSelected, 0);
  assert.equal(result.report.reasoningLearning.providerDeclarationImplementationEvidenceSurveys.architecturesEvaluated, 0);
  assert.equal(result.report.reasoningLearning.providerDeclarationImplementationEvidenceSurveys.providerCandidatesBuilt, 0);
  assert.equal(result.report.reasoningLearning.providerDeclarationImplementationEvidenceSurveys.providerDeclarationsWritten, 0);
  assert.equal(result.report.reasoningLearning.providerDeclarationImplementationEvidenceSurveys.workshopFilesChanged, 0);
  assert.equal(result.report.reasoningLearning.providerDeclarationImplementationEvidenceSurveys.trainingReceiptsCreated, 0);
  assert.equal(result.report.automatic.staticProviderImplementationEvidenceSurvey, true);
  assert.equal(result.report.reasoningLearning.providerDeclarationBindingExperiments.state, 'PROPOSED_PROVIDER_BINDING_EXPERIMENT_MATRICES_NOT_SELECTED');
  const bindingExperiments = result.report.reasoningLearning.providerDeclarationBindingExperiments;
  assert.equal(bindingExperiments.implementationEvidenceResultsEvaluated, implementationEvidence.architectureSurveyResultsEvaluated);
  assert.equal(bindingExperiments.experimentMatricesProposed, implementationEvidence.evidenceSurveysProposed);
  assert.equal(bindingExperiments.noImplementationEvidenceHolds, bindingExperiments.implementationEvidenceResultsEvaluated - bindingExperiments.experimentMatricesProposed);
  assert.ok(result.report.reasoningLearning.providerDeclarationBindingExperiments.candidateSourceWitnesses > 0);
  assert.ok(result.report.reasoningLearning.providerDeclarationBindingExperiments.validationOnlyWitnesses > 0);
  assert.equal(bindingExperiments.architectureHypothesesRepresented, bindingExperiments.experimentMatricesProposed * 3);
  assert.equal(bindingExperiments.experimentFramesProposed, bindingExperiments.candidateSourceWitnesses * 3);
  assert.equal(bindingExperiments.reasoningDecisionsMatched, bindingExperiments.implementationEvidenceResultsEvaluated);
  assert.equal(bindingExperiments.frameSelectionsRejected, bindingExperiments.implementationEvidenceResultsEvaluated);
  assert.equal(bindingExperiments.permissionCopiesRejected, bindingExperiments.implementationEvidenceResultsEvaluated);
  assert.equal(result.report.reasoningLearning.providerDeclarationBindingExperiments.framesSelected, 0);
  assert.equal(result.report.reasoningLearning.providerDeclarationBindingExperiments.providerIdentitiesInferred, 0);
  assert.equal(result.report.reasoningLearning.providerDeclarationBindingExperiments.outerRequirementsBound, 0);
  assert.equal(result.report.reasoningLearning.providerDeclarationBindingExperiments.permissionsInferred, 0);
  assert.equal(result.report.reasoningLearning.providerDeclarationBindingExperiments.sourcesExecuted, 0);
  assert.equal(result.report.reasoningLearning.providerDeclarationBindingExperiments.providerCandidatesBuilt, 0);
  assert.equal(result.report.reasoningLearning.providerDeclarationBindingExperiments.providerDeclarationsWritten, 0);
  assert.equal(result.report.reasoningLearning.providerDeclarationBindingExperiments.workshopFilesChanged, 0);
  assert.equal(result.report.reasoningLearning.providerDeclarationBindingExperiments.trainingReceiptsCreated, 0);
  assert.equal(result.report.automatic.balancedProviderBindingExperimentPlanning, true);
  assert.equal(result.report.automatic.independentProviderDeclarationResearchExamPlanning, true);
  assert.equal(result.report.reasoningLearning.readinessProbeCandidates.state, 'NO_REVIEWED_RECIPES_SUBMITTED');
  assert.equal(result.report.reasoningLearning.readinessProbeCandidates.reviewedRecipes, 0);
  assert.equal(result.report.reasoningLearning.readinessProbeCandidates.candidatesBuilt, 0);
  assert.equal(result.report.reasoningLearning.readinessProbeCandidates.candidateCodeFilesGenerated, 0);
  assert.equal(result.report.reasoningLearning.readinessProbeCandidates.probesInstalled, 0);
  assert.equal(result.report.reasoningLearning.readinessProbeCandidates.liveProbesExecuted, 0);
  assert.equal(result.report.reasoningLearning.readinessProbeCandidates.trainingReceiptsCreated, 0);
  assert.equal(result.report.reasoningLearning.readinessProbeCandidates.worldActionsExecuted, 0);
  assert.equal(result.report.automatic.reviewedReadinessProbeCandidateBuilds, false);
  assert.equal(result.report.reasoningLearning.counterexamples.sourceReceiptCount, 5);
  assert.equal(result.report.reasoningLearning.counterexamples.interventions, 7);
  assert.equal(result.report.reasoningLearning.counterexamples.worked, 7);
  assert.equal(result.report.reasoningLearning.counterexamples.didNotWork, 0);
  assert.equal(result.report.reasoningLearning.metamorphic.sourceReceiptCount, 5);
  assert.equal(result.report.reasoningLearning.metamorphic.probes, 60);
  assert.equal(result.report.reasoningLearning.metamorphic.atomicProbes, 22);
  assert.equal(result.report.reasoningLearning.metamorphic.composedProbes, 38);
  assert.equal(result.report.reasoningLearning.metamorphic.maximumCompositionDepth, 2);
  assert.equal(result.report.reasoningLearning.metamorphic.invariantConfirmed, 60);
  assert.equal(result.report.reasoningLearning.metamorphic.counterexamplesFound, 0);
  assert.equal(result.report.reasoningLearning.metamorphic.positiveTrainingReceiptsCreated, 0);
  assert.equal(result.report.reasoningLearning.metamorphic.frontierState, 'NO_UNEXPECTED_SEAM');
  assert.equal(result.report.automatic.privateReasoningMetamorphicProbes, true);
  assert.equal(result.report.automatic.proposalOnlyManifestBoundTypedHandoffGraph, true);
  assert.equal(result.report.reasoningLearning.realLocalReceipts, 5);
  assert.equal(result.report.reasoningLearning.syntheticCounterexampleReceipts, 7);
  assert.equal(result.report.reasoningLearning.contractDerivedExamReceipts, result.report.reasoningLearning.contractCurriculum.privateTrainingExams);
  assert.equal(result.report.reasoningLearning.candidateFreeObservableAccuracy, 1);
  assert.deepEqual(result.report.reasoningLearning.openSeams, []);
  assert.equal(result.report.reasoningLearning.state, 'PROPOSE_HUMAN_REVIEW');
  assert.equal(result.report.reasoningLearning.runtimePointerChanged, false);
  const receipts = Experience.loadDirectory(receiptDirectory);
  assert.equal(receipts.filter(item => (item.receipt.source.experienceKind || 'REAL_LOCAL_LESSON') === 'REAL_LOCAL_LESSON').length, 5);
  assert.equal(receipts.filter(item => item.receipt.source.experienceKind === 'SYNTHETIC_COUNTEREXAMPLE').length, 7);
  assert.equal(receipts.filter(item => item.receipt.source.experienceKind === 'CONTRACT_DERIVED_EXAM').length, result.report.reasoningLearning.contractCurriculum.privateTrainingExams);
  assert.ok(receipts.every(item => item.receipt.admission.semanticConsolidation === false));
});
