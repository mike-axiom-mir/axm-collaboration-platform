'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const root = path.resolve(__dirname, '..');
const bom = JSON.parse(fs.readFileSync(path.join(root, 'MODEL_BOM.json'), 'utf8'));
const status = JSON.parse(fs.readFileSync(path.join(root, 'STATUS.json'), 'utf8'));

function digest(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(path.join(root, file))).digest('hex');
}

test('every experimental learned artifact is present and hash-locked', () => {
  for (const component of bom.experimentalLearnedComponents) {
    assert.equal(digest(component.path), component.sha256);
    assert.equal(component.runtimeAuthority, false);
  }
  for (const run of bom.trainingRuns) {
    assert.equal(digest(run.report), run.reportSha256);
    assert.equal(run.promotedToRuntime, false);
  }
});

test('learned experiments cannot silently become the Seed-0 runtime', () => {
  assert.deepEqual(bom.runtimeLearnedComponents, []);
  assert.deepEqual(bom.externalWeights, []);
  assert.equal(bom.externalModelRuntimeRequired, false);
  assert.equal(status.learnedWeights, false);
  assert.equal(status.languageOrgan, false);
  assert.equal(bom.typedTraceLanguageShadow.state, 'TEST_SHADOW_NOT_RUNTIME');
  assert.equal(bom.typedTraceLanguageShadow.runtimeAuthority, false);
  assert.equal(bom.typedTraceLanguageShadow.factAuthority, false);
  assert.equal(bom.typedTraceLanguageShadow.decisionAuthority, false);
  assert.equal(bom.typedTraceLanguageShadow.permissionAuthority, false);
  assert.equal(status.typedTraceLanguageEvidence.acceptedAsRuntimeLanguageOrgan, false);
  assert.equal(bom.immutableBatchStore.learnedWeights, false);
  assert.equal(bom.immutableBatchStore.activeDirectoryWritersMigrated, 30);
  assert.equal(bom.immutableBatchStore.maximumTransientRenameAttempts, 4);
  assert.equal(bom.immutableBatchStore.persistentRenameFailureRetainsStage, true);
  assert.equal(bom.immutableBatchStore.destinationOverwriteAuthority, false);
  assert.equal(bom.immutableBatchStore.destinationDeleteAuthority, false);
  assert.equal(bom.immutableBatchStore.divergentStageDeleteAuthority, false);
  assert.equal(bom.foundationDevelopmentObservatory.singleIntelligenceScore, false);
  assert.equal(bom.foundationDevelopmentObservatory.learnedWeights, false);
  assert.equal(bom.foundationDevelopmentObservatory.trainingAdmissionAuthority, false);
  assert.equal(bom.foundationDevelopmentObservatory.automaticRepairAuthority, false);
  assert.equal(bom.foundationDevelopmentObservatory.runtimeAuthority, false);
  assert.equal(bom.foundationDevelopmentObservationRequest.automaticRequest, true);
  assert.equal(bom.foundationDevelopmentObservationRequest.automaticObservation, false);
  assert.equal(bom.foundationDevelopmentObservationRequest.growthGradeAuthority, false);
  assert.equal(bom.foundationDevelopmentObservationRequest.trainingAdmissionAuthority, false);
  assert.equal(bom.foundationDevelopmentObservationRequest.automaticRepairAuthority, false);
  assert.equal(bom.foundationDevelopmentObservationRequest.permissionGrantAuthority, false);
  assert.equal(bom.foundationDevelopmentObservationRequest.runtimeAuthority, false);
  assert.equal(bom.foundationDevelopmentObservationExecutor.automaticObservationExecution, true);
  assert.equal(bom.foundationDevelopmentObservationExecutor.singleEvidenceCapturePerExecution, true);
  assert.equal(bom.foundationDevelopmentObservationExecutor.singleIntelligenceScore, false);
  assert.equal(bom.foundationDevelopmentObservationExecutor.compositeGrowthGradeAuthority, false);
  assert.equal(bom.foundationDevelopmentObservationExecutor.trainingAdmissionAuthority, false);
  assert.equal(bom.foundationDevelopmentObservationExecutor.automaticRepairAuthority, false);
  assert.equal(bom.foundationDevelopmentObservationExecutor.modelChangeAuthority, false);
  assert.equal(bom.foundationDevelopmentObservationExecutor.permissionGrantAuthority, false);
  assert.equal(bom.foundationDevelopmentObservationExecutor.runtimeAuthority, false);
  assert.equal(bom.foundationDevelopmentFrontierRouter.nonPassingDimensions, 2);
  assert.equal(bom.foundationDevelopmentFrontierRouter.evidenceAcquisitionRequests, 2);
  assert.equal(bom.foundationDevelopmentFrontierRouter.prioritySelectionAuthority, false);
  assert.equal(bom.foundationDevelopmentFrontierRouter.evidenceFabricationAuthority, false);
  assert.equal(bom.foundationDevelopmentFrontierRouter.trainingAdmissionAuthority, false);
  assert.equal(bom.foundationDevelopmentFrontierRouter.repairSelectionAuthority, false);
  assert.equal(bom.foundationDevelopmentFrontierRouter.implementationBuildAuthority, false);
  assert.equal(bom.foundationDevelopmentFrontierRouter.permissionGrantAuthority, false);
  assert.equal(bom.foundationDevelopmentFrontierRouter.runtimeAuthority, false);
  assert.equal(bom.foundationDevelopmentHandPlanner.evidenceHandRequests, 2);
  assert.equal(bom.foundationDevelopmentHandPlanner.machineReadableNeedHolds, 0);
  assert.equal(bom.foundationDevelopmentHandPlanner.dimensionNameRules, false);
  assert.equal(bom.foundationDevelopmentHandPlanner.capabilitiesClaimed, 0);
  assert.equal(bom.foundationDevelopmentHandPlanner.organsRequired, 0);
  assert.equal(bom.foundationDevelopmentHandPlanner.evidenceAcquisitionAuthority, false);
  assert.equal(bom.foundationDevelopmentHandPlanner.eventInductionAuthority, false);
  assert.equal(bom.foundationDevelopmentHandPlanner.capabilityClaimAuthority, false);
  assert.equal(bom.foundationDevelopmentHandPlanner.organNeedClaimAuthority, false);
  assert.equal(bom.foundationDevelopmentHandPlanner.implementationBuildAuthority, false);
  assert.equal(bom.foundationDevelopmentHandPlanner.trainingAdmissionAuthority, false);
  assert.equal(bom.foundationDevelopmentHandPlanner.permissionGrantAuthority, false);
  assert.equal(bom.foundationDevelopmentHandPlanner.runtimeAuthority, false);
  assert.equal(bom.workshopTransferRegressionExam.state, 'TEST_BOUND_CURRENT_WORKSHOP_RELATIONAL_REVALIDATION_PASSED');
  const workshopExam = JSON.parse(fs.readFileSync(path.join(
    root,
    'state',
    'workshop-transfer-regression-exams',
    bom.workshopTransferRegressionExam.currentExamId,
    'exam.json'
  ), 'utf8'));
  assert.equal(workshopExam.examDigest, bom.workshopTransferRegressionExam.currentExamDigest);
  assert.equal(bom.workshopTransferRegressionExam.contractBoundariesPreserved, workshopExam.result.summary.eligibleContracts);
  assert.equal(bom.workshopTransferRegressionExam.manifestBoundContracts, workshopExam.result.summary.manifestBoundContracts);
  assert.equal(bom.workshopTransferRegressionExam.exactRoutesPreserved, workshopExam.result.summary.exactRoutes);
  assert.equal(bom.workshopTransferRegressionExam.authoritySeams, 0);
  assert.equal(bom.workshopTransferRegressionExam.workshopJavascriptExecutionAuthority, false);
  assert.equal(bom.workshopTransferRegressionExam.workshopModuleInvocationAuthority, false);
  assert.equal(bom.workshopTransferRegressionExam.outsideIndependenceCertificationAuthority, false);
  assert.equal(bom.workshopTransferRegressionExam.trainingAdmissionAuthority, false);
  assert.equal(bom.workshopTransferRegressionExam.repairSelectionAuthority, false);
  assert.equal(bom.workshopTransferRegressionExam.permissionGrantAuthority, false);
  assert.equal(bom.workshopTransferRegressionExam.runtimeAuthority, false);
  assert.equal(bom.workshopTransferRegressionExam.canonAuthority, false);
  assert.equal(bom.foundationDevelopmentCapabilitySurvey.declarationsInventoried, 2);
  assert.equal(bom.foundationDevelopmentCapabilitySurvey.verifiedDeclarations, 2);
  assert.equal(bom.foundationDevelopmentCapabilitySurvey.declaredCompatibilityWitnesses, 0);
  assert.equal(bom.foundationDevelopmentCapabilitySurvey.declaredPartialCompatibilityWitnesses, 2);
  assert.equal(bom.foundationDevelopmentCapabilitySurvey.existingCapabilitiesSelected, 0);
  assert.equal(bom.foundationDevelopmentCapabilitySurvey.operationalFitsClaimed, 0);
  assert.equal(bom.foundationDevelopmentCapabilitySurvey.newOrgansRequired, 0);
  assert.equal(bom.foundationDevelopmentCapabilitySurvey.sourceExecution, false);
  assert.equal(bom.foundationDevelopmentCapabilitySurvey.firstMatchSelection, false);
  assert.equal(bom.foundationDevelopmentCapabilitySurvey.frequencySelection, false);
  assert.equal(bom.foundationDevelopmentCapabilitySurvey.implementationBuildAuthority, false);
  assert.equal(bom.foundationDevelopmentCapabilitySurvey.trainingAdmissionAuthority, false);
  assert.equal(bom.foundationDevelopmentCapabilitySurvey.permissionGrantAuthority, false);
  assert.equal(bom.foundationDevelopmentCapabilitySurvey.runtimeAuthority, false);
  assert.equal(bom.foundationDevelopmentCapabilityAffordanceExamPlanner.independentAffordanceExamRequests, 0);
  assert.equal(bom.foundationDevelopmentCapabilityAffordanceExamPlanner.handsHeldForOutputAdapter, 2);
  assert.equal(bom.foundationDevelopmentCapabilityAffordanceExamPlanner.fixturesAuthored, 0);
  assert.equal(bom.foundationDevelopmentCapabilityAffordanceExamPlanner.expectedResultsAuthored, 0);
  assert.equal(bom.foundationDevelopmentCapabilityAffordanceExamPlanner.sourceExecutions, 0);
  assert.equal(bom.foundationDevelopmentCapabilityAffordanceExamPlanner.examResults, 0);
  assert.equal(bom.foundationDevelopmentCapabilityAffordanceExamPlanner.capabilitiesSelected, 0);
  assert.equal(bom.foundationDevelopmentCapabilityAffordanceExamPlanner.operationalFitsClaimed, 0);
  assert.equal(bom.foundationDevelopmentCapabilityAffordanceExamPlanner.newOrgansRequired, 0);
  assert.equal(bom.foundationDevelopmentCapabilityAffordanceExamPlanner.humanProseCaseAuthority, false);
  assert.equal(bom.foundationDevelopmentCapabilityAffordanceExamPlanner.fixtureAuthoringAuthority, false);
  assert.equal(bom.foundationDevelopmentCapabilityAffordanceExamPlanner.expectedResultAuthoringAuthority, false);
  assert.equal(bom.foundationDevelopmentCapabilityAffordanceExamPlanner.sourceExecutionAuthority, false);
  assert.equal(bom.foundationDevelopmentCapabilityAffordanceExamPlanner.capabilitySelectionAuthority, false);
  assert.equal(bom.foundationDevelopmentCapabilityAffordanceExamPlanner.operationalFitClaimAuthority, false);
  assert.equal(bom.foundationDevelopmentCapabilityAffordanceExamPlanner.newOrganNeedClaimAuthority, false);
  assert.equal(bom.foundationDevelopmentCapabilityAffordanceExamPlanner.implementationBuildAuthority, false);
  assert.equal(bom.foundationDevelopmentCapabilityAffordanceExamPlanner.trainingAdmissionAuthority, false);
  assert.equal(bom.foundationDevelopmentCapabilityAffordanceExamPlanner.permissionGrantAuthority, false);
  assert.equal(bom.foundationDevelopmentCapabilityAffordanceExamPlanner.runtimeAuthority, false);
  assert.equal(bom.foundationDevelopmentCapabilityOutputAdapterPlanner.partialOutputWitnesses, 2);
  assert.equal(bom.foundationDevelopmentCapabilityOutputAdapterPlanner.outputAdapterRequests, 2);
  assert.equal(bom.foundationDevelopmentCapabilityOutputAdapterPlanner.adaptersBuilt, 0);
  assert.equal(bom.foundationDevelopmentCapabilityOutputAdapterPlanner.adaptersSelected, 0);
  assert.equal(bom.foundationDevelopmentCapabilityOutputAdapterPlanner.sourceExecutions, 0);
  assert.equal(bom.foundationDevelopmentCapabilityOutputAdapterPlanner.evidenceRelabelings, 0);
  assert.equal(bom.foundationDevelopmentCapabilityOutputAdapterPlanner.operationalFitsClaimed, 0);
  assert.equal(bom.foundationDevelopmentCapabilityOutputAdapterPlanner.newOrgansRequired, 0);
  assert.equal(bom.foundationDevelopmentCapabilityOutputAdapterPlanner.adapterBuildAuthority, false);
  assert.equal(bom.foundationDevelopmentCapabilityOutputAdapterPlanner.adapterSelectionAuthority, false);
  assert.equal(bom.foundationDevelopmentCapabilityOutputAdapterPlanner.evidenceRelabelingAuthority, false);
  assert.equal(bom.foundationDevelopmentCapabilityOutputAdapterPlanner.runtimeAuthority, false);
  assert.equal(bom.foundationCapabilityOutputAdapterFixtureExam.transportCell, 'kernel/key-safe-json-transport-cell.js');
  assert.equal(bom.foundationCapabilityOutputAdapterFixtureExam.syntheticFixtureCasesPerRequest, 22);
  assert.equal(bom.foundationCapabilityOutputAdapterFixtureExam.independentFixtureCasesAuthored, 44);
  assert.equal(bom.foundationCapabilityOutputAdapterFixtureExam.syntheticAdapterExecutions, 46);
  assert.equal(bom.foundationCapabilityOutputAdapterFixtureExam.passedFixtureCases, 44);
  assert.equal(bom.foundationCapabilityOutputAdapterFixtureExam.failedFixtureCases, 0);
  assert.equal(bom.foundationCapabilityOutputAdapterFixtureExam.realNativeArtifactsAdapted, 0);
  assert.equal(bom.foundationCapabilityOutputAdapterFixtureExam.evidenceAdmissions, 0);
  const nativeInventory = JSON.parse(fs.readFileSync(path.join(
    root,
    'state',
    'foundation-capability-native-artifact-inventory-runs',
    bom.foundationCapabilityNativeArtifactInventory.currentBatchId,
    'batch.json'
  ), 'utf8'));
  assert.equal(nativeInventory.batchDigest, bom.foundationCapabilityNativeArtifactInventory.currentBatchDigest);
  for (const key of [
    'inventoryDeclarationsRead',
    'nativeArtifactRootSchemaWitnesses',
    'genericEnvelopeCompatibleWitnesses',
    'genericEnvelopeBoundaryRefusals',
    'refusedArtifactFiles'
  ]) assert.equal(bom.foundationCapabilityNativeArtifactInventory[key], nativeInventory.summary[key]);
  assert.equal(bom.foundationCapabilityNativeArtifactInventory.artifactSelections, 0);
  assert.equal(bom.foundationCapabilityNativeArtifactInventory.permissionEvaluations, 0);
  assert.equal(bom.foundationCapabilityNativeArtifactInventory.evidenceEligibilityEvaluations, 0);
  assert.equal(bom.foundationCapabilityNativeArtifactInventory.adapterExecutions, 0);
  assert.equal(bom.foundationCapabilityNativeArtifactInventory.nativeSourceExecutions, 0);
  assert.equal(bom.foundationCapabilityNativeArtifactInventory.evidenceAdmissions, 0);
  assert.equal(bom.foundationCapabilityNativeArtifactInventory.artifactContentPersistence, false);
  assert.equal(bom.foundationCapabilityNativeArtifactInventory.artifactSelectionAuthority, false);
  assert.equal(bom.foundationCapabilityNativeArtifactInventory.permissionInferenceAuthority, false);
  assert.equal(bom.foundationCapabilityNativeArtifactInventory.runtimeAuthority, false);
  assert.equal(bom.typedTraceLanguageShadowEvaluation.automaticRetrainingAuthority, false);
  assert.equal(bom.typedTraceLanguageShadowEvaluation.trainingAdmissionAuthority, false);
  assert.equal(bom.typedTraceLanguageShadowEvaluation.modelChangeAuthority, false);
  assert.equal(bom.typedTraceLanguageShadowEvaluation.runtimeAuthority, false);
  assert.equal(bom.typedTraceLanguageIndependentExam.outsideAuthoredPacksEvaluated, 0);
  assert.equal(bom.typedTraceLanguageIndependentExam.independenceCertificationAuthority, false);
  assert.equal(bom.typedTraceLanguageIndependentExam.trainingAdmissionAuthority, false);
  assert.equal(bom.typedTraceLanguageIndependentExam.thresholdChangeAuthority, false);
  assert.equal(bom.typedTraceLanguageIndependentExam.runtimeAuthority, false);
  for (const organ of bom.deterministicEvaluationOrgans || []) {
    assert.equal(organ.learnedWeights, false);
    assert.equal(organ.confirmedMatchTraining, false);
    assert.equal(organ.automaticPromotionAuthority, false);
    assert.equal(organ.toolAuthority, false);
    assert.equal(organ.worldActionAuthority, false);
  }
  for (const organ of bom.deterministicPrivateTrainingOrgans || []) {
    assert.equal(organ.learnedWeights, false);
    assert.equal(organ.typedContractFieldsOnly, true);
    assert.equal(organ.matchedPrivateEpisodicTraining, true);
    assert.equal(organ.heldOutTraining, false);
    assert.equal(organ.semanticTruthWriteAuthority, false);
    assert.equal(organ.automaticPromotionAuthority, false);
    assert.equal(organ.toolAuthority, false);
    assert.equal(organ.worldActionAuthority, false);
  }
});
