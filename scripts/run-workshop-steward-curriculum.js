'use strict';

const path = require('path');
const Curriculum = require('../training/workshop-steward-curriculum');
const FoundationObservationExecutor = require('../organs/foundation-development-observation-executor-organ');
const FoundationFrontierRouter = require('../organs/foundation-development-frontier-router-organ');
const FoundationHandPlanner = require('../organs/foundation-development-hand-planner-organ');
const FoundationCapabilitySurvey = require('../organs/foundation-development-capability-survey-organ');
const FoundationCapabilityAffordanceExamPlanner = require('../organs/foundation-development-capability-affordance-exam-planner-organ');
const FoundationCapabilityOutputAdapterPlanner = require('../organs/foundation-development-capability-output-adapter-planner-organ');
const FoundationCapabilityOutputAdapterFixtureExam = require('../organs/foundation-capability-output-adapter-fixture-exam-organ');
const FoundationCapabilityNativeArtifactInventory = require('../organs/foundation-capability-native-artifact-inventory-organ');
const FoundationNativeEvidenceEligibility = require('../organs/foundation-native-evidence-eligibility-organ');
const WorkshopTransferRegressionExam = require('../organs/workshop-transfer-regression-exam-organ');

Curriculum.run().then(result => {
  const preflightSources = FoundationNativeEvidenceEligibility.loadCurrentSources();
  const preflightNativeArtifacts = FoundationCapabilityNativeArtifactInventory.run({ adapterRequestBatch: preflightSources.adapterBatch });
  const preflightNativeEvidenceEligibility = FoundationNativeEvidenceEligibility.run({
    nativeBatch: preflightNativeArtifacts.batch,
    adapterBatch: preflightSources.adapterBatch,
    handBatch: preflightSources.handBatch
  });
  const workshopTransferRegressionExam = result.report.reasoningLearning
    ? WorkshopTransferRegressionExam.run()
    : null;
  const foundationObservation = result.report.reasoningLearning
    ? FoundationObservationExecutor.run({ reasoningCycleId: result.report.reasoningLearning.cycleId })
    : null;
  const developmentFrontier = foundationObservation && foundationObservation.receipt
    ? FoundationFrontierRouter.run({ snapshot: foundationObservation.snapshot, receipt: foundationObservation.receipt })
    : null;
  const developmentHands = developmentFrontier
    ? FoundationHandPlanner.run({ frontierBatch: developmentFrontier.batch })
    : null;
  const developmentCapabilities = developmentHands
    ? FoundationCapabilitySurvey.run({ handBatch: developmentHands.batch })
    : null;
  const developmentCapabilityExams = developmentCapabilities
    ? FoundationCapabilityAffordanceExamPlanner.run({ handBatch: developmentHands.batch, surveyBatch: developmentCapabilities.batch })
    : null;
  const developmentCapabilityOutputAdapters = developmentCapabilities
    ? FoundationCapabilityOutputAdapterPlanner.run({ handBatch: developmentHands.batch, surveyBatch: developmentCapabilities.batch })
    : null;
  const developmentCapabilityOutputAdapterFixtureExams = developmentCapabilityOutputAdapters
    ? FoundationCapabilityOutputAdapterFixtureExam.run({ handBatch: developmentHands.batch, adapterRequestBatch: developmentCapabilityOutputAdapters.batch })
    : null;
  const developmentCapabilityNativeArtifacts = developmentCapabilityOutputAdapters
    ? FoundationCapabilityNativeArtifactInventory.run({ adapterRequestBatch: developmentCapabilityOutputAdapters.batch })
    : null;
  const developmentNativeEvidenceEligibility = developmentCapabilityNativeArtifacts
    ? FoundationNativeEvidenceEligibility.run({
      nativeBatch: developmentCapabilityNativeArtifacts.batch,
      adapterBatch: developmentCapabilityOutputAdapters.batch,
      handBatch: developmentHands.batch
    })
    : preflightNativeEvidenceEligibility;
  console.log('Mirror automatic Workshop practice');
  for (const lesson of result.report.lessons) {
    console.log(`- ${lesson.module}: ${lesson.behavior} (${lesson.selectedActionId}) · ${lesson.episodeState}`);
  }
  if (result.report.learning) {
    console.log(`Private challenger: ${result.report.learning.state}`);
    console.log(`Learning cycle: ${result.report.learning.cycleId}`);
    console.log(`Open learning seams: ${result.report.learning.openSeams.join(', ') || 'none'}`);
  }
  if (result.report.reasoningLearning) {
    const handoff = result.report.reasoningLearning.handoffGraph;
    const readiness = result.report.reasoningLearning.routeReadiness;
    const hands = result.report.reasoningLearning.readinessHands;
    const affordances = result.report.reasoningLearning.readinessProbeAffordances;
    const declarationHands = result.report.reasoningLearning.providerDeclarationHands;
    const declarationResearch = result.report.reasoningLearning.providerDeclarationResearchExams;
    const declarationResearchExecutors = result.report.reasoningLearning.providerDeclarationResearchExecutors;
    const declarationArchitectureSurveys = result.report.reasoningLearning.providerDeclarationArchitectureSurveys;
    const declarationImplementationEvidenceSurveys = result.report.reasoningLearning.providerDeclarationImplementationEvidenceSurveys;
    const declarationBindingExperiments = result.report.reasoningLearning.providerDeclarationBindingExperiments;
    const contract = result.report.reasoningLearning.contractCurriculum;
    const failureCurriculum = result.report.reasoningLearning.failureCurriculum;
    console.log(`Handoff graph: ${handoff.manifestBindingsPassed} manifest-bound contracts; ${handoff.undeclaredContractFiles} undeclared files refused; ${handoff.exactCrossModuleEdges} exact edges; ${handoff.directRoutes} direct + ${handoff.composedDepthTwoRoutes} depth-two routes; ${handoff.routeSelectionMismatches} mismatches; ${handoff.worldActionsExecuted} executions`);
    console.log(`Route readiness: ${readiness.readyRoutes} READY; ${readiness.availableRoutes} AVAILABLE; ${readiness.needsActionRoutes} NEEDS_ACTION; ${readiness.blockedRoutes} BLOCKED; ${readiness.classificationMismatches} mismatches; ${readiness.worldActionsExecuted} executions`);
    console.log(`Readiness hands: ${hands.missingProbeHandRequests} missing-probe requests; ${hands.unknownInspectionHolds} inspection holds; ${hands.impactedManifestBoundRoutes} impacted routes; ${hands.codeFilesGenerated} code files; ${hands.probesInstalled} installs`);
    console.log(`Readiness affordances: ${affordances.reviewPacketsProposed} exact-declaration review packets; ${affordances.noProviderHolds + affordances.ambiguousProviderHolds} holds; ${affordances.humanReviewsCreated} reviews; ${affordances.candidatesBuilt} candidates; ${affordances.liveProbesExecuted} live probes`);
    console.log(`Provider declaration hands: ${declarationHands.providerDeclarationHandsProposed} nonbuilt hands; ${declarationHands.declarationsPresentNoGap} declarations present; ${declarationHands.providerInferenceCandidatesRejected} provider inferences rejected; ${declarationHands.providerDeclarationsWritten} declarations written`);
    console.log(`Provider declaration research: ${declarationResearch.researchExamRequestsProposed} independent exam requests; ${declarationResearch.frontierExamRequired} Frontier exam gates; ${declarationResearch.providerBuildCandidatesRejected} premature builds rejected; ${declarationResearch.architecturesSelected} architectures selected; ${declarationResearch.examExecutorsBuilt} executors built`);
    console.log(`Provider declaration research executors: ${declarationResearchExecutors.reviewedRecipes} reviewed recipes; ${declarationResearchExecutors.executorCandidatesBuilt} disposable executors; ${declarationResearchExecutors.fixtureCasesExecuted} synthetic fixture cases; ${declarationResearchExecutors.architecturesEvaluated} architectures evaluated`);
    console.log(`Provider declaration architecture survey: ${declarationArchitectureSurveys.inventoryDocuments} JSON documents; ${declarationArchitectureSurveys.relevantPatternAssessments} relevant pattern assessments; ${declarationArchitectureSurveys.completeCurrentRelationWitnesses} complete current witnesses; ${declarationArchitectureSurveys.architecturesSelected} architectures selected`);
    console.log(`Provider implementation evidence survey: ${declarationImplementationEvidenceSurveys.inventorySources} JavaScript sources; ${declarationImplementationEvidenceSurveys.selectorBearingSources} selector-bearing sources; ${declarationImplementationEvidenceSurveys.demandedSelectorsWitnessed} demanded selectors witnessed; ${declarationImplementationEvidenceSurveys.implementationsSelected} implementations selected; ${declarationImplementationEvidenceSurveys.sourcesExecuted} sources executed`);
    console.log(`Provider binding experiments: ${declarationBindingExperiments.candidateSourceWitnesses} candidate sources × ${declarationBindingExperiments.architectureHypothesesRepresented} represented hypotheses = ${declarationBindingExperiments.experimentFramesProposed} frames; ${declarationBindingExperiments.framesSelected} selected; ${declarationBindingExperiments.permissionsInferred} permissions inferred; ${declarationBindingExperiments.sourcesExecuted} sources executed`);
    console.log(`Contract curriculum: ${contract.boundaryPreserved}/${contract.eligibleContracts} boundaries; ${contract.privateTrainingExams} training + ${contract.heldOutEvaluationExams} held-out; transfer ${contract.heldOutChallengerPassed}/${contract.heldOutEvaluationExams}`);
    console.log(`Failure curriculum: ${failureCurriculum.realLocalNegativeReceipts} real negative receipts; ${failureCurriculum.distinctFailureSignatures} signatures; ${failureCurriculum.curriculumRequestsProposed} recurrent requests; training 0; builds 0; installs 0`);
    console.log(`Private reasoning cycle: ${result.report.reasoningLearning.cycleId} · ${result.report.reasoningLearning.state}`);
  }
  if (foundationObservation) {
    console.log(`Foundation observation: ${foundationObservation.state} · ${foundationObservation.request.requestId} · observation executed ${foundationObservation.observationExecuted ? 1 : 0} · repairs 0 · promotions 0`);
  }
  if (workshopTransferRegressionExam) {
    console.log(`Workshop transfer regression revalidation: ${workshopTransferRegressionExam.state} · evidence written ${workshopTransferRegressionExam.written ? 1 : 0} · repairs 0 · promotions 0`);
  }
  if (developmentFrontier) {
    console.log(`Foundation development frontier: ${developmentFrontier.batch.summary.evidenceAcquisitionRequests} evidence requests · ${developmentFrontier.batch.summary.regressionInvestigationRequests} regression requests · priorities selected 0 · repairs 0`);
  }
  if (developmentHands) {
    console.log(`Foundation evidence hands: ${developmentHands.batch.summary.evidenceHandRequests} interface requests · ${developmentHands.batch.summary.machineReadableNeedHolds} typed-need holds · capabilities claimed 0 · organs required 0 · implementations 0`);
  }
  if (developmentCapabilities) {
    console.log(`Foundation capability survey: ${developmentCapabilities.batch.summary.declarationsInventoried} declarations · ${developmentCapabilities.batch.summary.declaredCompatibilityWitnesses} compatibility witnesses · selections 0 · operational fits 0 · new organs required 0`);
  }
  if (developmentCapabilityExams) {
    console.log(`Foundation capability affordance exams: ${developmentCapabilityExams.batch.summary.independentAffordanceExamRequests} independent requests; fixtures 0; executions 0; results 0; selections 0; new organs required 0`);
  }
  if (developmentCapabilityOutputAdapters) {
    console.log(`Foundation capability output adapters: ${developmentCapabilityOutputAdapters.batch.summary.outputAdapterRequests} modular requests; builds 0; executions 0; selections 0; evidence relabelings 0; new organs required 0`);
  }
  if (developmentCapabilityOutputAdapterFixtureExams) {
    console.log(`Foundation output-adapter fixture exams: ${developmentCapabilityOutputAdapterFixtureExams.batch.summary.independentFixtureCasesAuthored} independent synthetic cases; ${developmentCapabilityOutputAdapterFixtureExams.batch.summary.passedFixtureCases} passed; real artifacts 0; native source executions 0; selections 0; fit claims 0; evidence admissions 0`);
  }
  if (developmentCapabilityNativeArtifacts) {
    console.log(`Foundation native-artifact inventory: ${developmentCapabilityNativeArtifacts.batch.summary.nativeArtifactRootSchemaWitnesses} root-schema witnesses; ${developmentCapabilityNativeArtifacts.batch.summary.genericEnvelopeCompatibleWitnesses} generic-envelope compatible; ${developmentCapabilityNativeArtifacts.batch.summary.genericEnvelopeBoundaryRefusals} envelope-boundary refusals; ${developmentCapabilityNativeArtifacts.batch.summary.refusedArtifactFiles} file refusals; ${developmentCapabilityNativeArtifacts.batch.summary.optionalRootsAbsent} optional roots absent; selections 0; permissions evaluated 0; evidence admissions 0`);
  }
  if (developmentNativeEvidenceEligibility) {
    console.log(`Foundation native-evidence eligibility: ${developmentNativeEvidenceEligibility.batch.summary.nativeReceiptsVerified} native receipts verified; ${developmentNativeEvidenceEligibility.batch.summary.realLocalArtifacts} real local; ${developmentNativeEvidenceEligibility.batch.summary.negativeArtifacts} negative; ${developmentNativeEvidenceEligibility.batch.summary.eligibleEvidenceCandidates} candidates; evidence admissions 0; event inductions 0; training admissions 0`);
  }
  console.log(`Report: ${path.resolve(result.reportFile)}`);
  console.log('Stable runtime, canon, identity, permissions, and tool authority were unchanged.');
}).catch(error => {
  console.error(`REFUSED: ${error.message}`);
  process.exitCode = 1;
});
