'use strict';

const Executor = require('../organs/foundation-development-observation-executor-organ');
const FrontierRouter = require('../organs/foundation-development-frontier-router-organ');
const HandPlanner = require('../organs/foundation-development-hand-planner-organ');
const CapabilitySurvey = require('../organs/foundation-development-capability-survey-organ');
const CapabilityAffordanceExamPlanner = require('../organs/foundation-development-capability-affordance-exam-planner-organ');
const CapabilityOutputAdapterPlanner = require('../organs/foundation-development-capability-output-adapter-planner-organ');
const CapabilityOutputAdapterFixtureExam = require('../organs/foundation-capability-output-adapter-fixture-exam-organ');
const CapabilityNativeArtifactInventory = require('../organs/foundation-capability-native-artifact-inventory-organ');
const NativeEvidenceEligibility = require('../organs/foundation-native-evidence-eligibility-organ');

try {
  const preflightSources = NativeEvidenceEligibility.loadCurrentSources();
  const preflightNativeArtifacts = CapabilityNativeArtifactInventory.run({ adapterRequestBatch: preflightSources.adapterBatch });
  const preflightNativeEvidenceEligibility = NativeEvidenceEligibility.run({
    nativeBatch: preflightNativeArtifacts.batch,
    adapterBatch: preflightSources.adapterBatch,
    handBatch: preflightSources.handBatch
  });
  const result = Executor.run();
  const frontier = result.receipt ? FrontierRouter.run({ snapshot: result.snapshot, receipt: result.receipt }) : null;
  const handPlan = frontier ? HandPlanner.run({ frontierBatch: frontier.batch }) : null;
  const capabilitySurvey = handPlan ? CapabilitySurvey.run({ handBatch: handPlan.batch }) : null;
  const capabilityAffordanceExams = capabilitySurvey
    ? CapabilityAffordanceExamPlanner.run({ handBatch: handPlan.batch, surveyBatch: capabilitySurvey.batch })
    : null;
  const capabilityOutputAdapters = capabilitySurvey
    ? CapabilityOutputAdapterPlanner.run({ handBatch: handPlan.batch, surveyBatch: capabilitySurvey.batch })
    : null;
  const capabilityOutputAdapterFixtureExams = capabilityOutputAdapters
    ? CapabilityOutputAdapterFixtureExam.run({ handBatch: handPlan.batch, adapterRequestBatch: capabilityOutputAdapters.batch })
    : null;
  const capabilityNativeArtifacts = capabilityOutputAdapters
    ? CapabilityNativeArtifactInventory.run({ adapterRequestBatch: capabilityOutputAdapters.batch })
    : null;
  const capabilityNativeEvidenceEligibility = capabilityNativeArtifacts
    ? NativeEvidenceEligibility.run({
      nativeBatch: capabilityNativeArtifacts.batch,
      adapterBatch: capabilityOutputAdapters.batch,
      handBatch: handPlan.batch
    })
    : preflightNativeEvidenceEligibility;
  const output = {
    ok: true,
    state: result.state,
    requestId: result.request.requestId,
    observationExecuted: result.observationExecuted,
    requestWritten: result.requestWritten,
    snapshotId: result.snapshot ? result.snapshot.snapshotId : result.request.prior.exactSnapshotIds[0] || null,
    executionId: result.receipt ? result.receipt.executionId : null,
    dimensions: result.receipt ? result.receipt.observation.dimensions : null,
    trainingAdmissions: 0,
    repairs: 0,
    permissionGrants: 0,
    promotions: 0,
    worldActions: 0,
    receiptWritten: result.receiptWritten
  };
  output.frontier = frontier ? {
    batchId: frontier.batch.batchId,
    nonPassingDimensions: frontier.batch.summary.nonPassingDimensions,
    evidenceAcquisitionRequests: frontier.batch.summary.evidenceAcquisitionRequests,
    regressionInvestigationRequests: frontier.batch.summary.regressionInvestigationRequests,
    prioritySelections: 0,
    repairsSelected: 0
  } : null;
  output.handPlan = handPlan ? {
    batchId: handPlan.batch.batchId,
    evidenceHandRequests: handPlan.batch.summary.evidenceHandRequests,
    machineReadableNeedHolds: handPlan.batch.summary.machineReadableNeedHolds,
    capabilitiesClaimed: 0,
    organsRequired: 0,
    implementationsBuilt: 0
  } : null;
  output.capabilitySurvey = capabilitySurvey ? {
    batchId: capabilitySurvey.batch.batchId,
    declarationsInventoried: capabilitySurvey.batch.summary.declarationsInventoried,
    declaredCompatibilityWitnesses: capabilitySurvey.batch.summary.declaredCompatibilityWitnesses,
    declaredPartialCompatibilityWitnesses: capabilitySurvey.batch.summary.declaredPartialCompatibilityWitnesses,
    existingCapabilitiesSelected: 0,
    operationalFitsClaimed: 0,
    newOrgansRequired: 0
  } : null;
  output.capabilityAffordanceExams = capabilityAffordanceExams ? {
    batchId: capabilityAffordanceExams.batch.batchId,
    independentAffordanceExamRequests: capabilityAffordanceExams.batch.summary.independentAffordanceExamRequests,
    fixturesAuthored: 0,
    sourceExecutions: 0,
    examResults: 0,
    capabilitiesSelected: 0,
    operationalFitsClaimed: 0,
    newOrgansRequired: 0
  } : null;
  output.capabilityOutputAdapters = capabilityOutputAdapters ? {
    batchId: capabilityOutputAdapters.batch.batchId,
    partialOutputWitnesses: capabilityOutputAdapters.batch.summary.partialOutputWitnesses,
    outputAdapterRequests: capabilityOutputAdapters.batch.summary.outputAdapterRequests,
    adaptersBuilt: 0,
    adaptersSelected: 0,
    sourceExecutions: 0,
    capabilitiesSelected: 0,
    operationalFitsClaimed: 0,
    newOrgansRequired: 0,
    evidenceRelabelings: 0
  } : null;
  output.capabilityOutputAdapterFixtureExams = capabilityOutputAdapterFixtureExams ? {
    batchId: capabilityOutputAdapterFixtureExams.batch.batchId,
    adapterRequestsExamined: capabilityOutputAdapterFixtureExams.batch.summary.adapterRequestsExamined,
    independentFixtureCasesAuthored: capabilityOutputAdapterFixtureExams.batch.summary.independentFixtureCasesAuthored,
    syntheticAdapterExecutions: capabilityOutputAdapterFixtureExams.batch.summary.syntheticAdapterExecutions,
    passedFixtureCases: capabilityOutputAdapterFixtureExams.batch.summary.passedFixtureCases,
    failedFixtureCases: capabilityOutputAdapterFixtureExams.batch.summary.failedFixtureCases,
    realNativeArtifactsAdapted: 0,
    nativeSourcesExecuted: 0,
    adapterImplementationsSelected: 0,
    operationalFitsClaimed: 0,
    evidenceAdmissions: 0,
    evidenceRelabelings: 0
  } : null;
  output.capabilityNativeArtifacts = capabilityNativeArtifacts ? {
    batchId: capabilityNativeArtifacts.batch.batchId,
    inventoryDeclarationsRead: capabilityNativeArtifacts.batch.summary.inventoryDeclarationsRead,
    nativeArtifactRootSchemaWitnesses: capabilityNativeArtifacts.batch.summary.nativeArtifactRootSchemaWitnesses,
    genericEnvelopeCompatibleWitnesses: capabilityNativeArtifacts.batch.summary.genericEnvelopeCompatibleWitnesses,
    genericEnvelopeBoundaryRefusals: capabilityNativeArtifacts.batch.summary.genericEnvelopeBoundaryRefusals,
    refusedArtifactFiles: capabilityNativeArtifacts.batch.summary.refusedArtifactFiles,
    optionalRootsAbsent: capabilityNativeArtifacts.batch.summary.optionalRootsAbsent,
    artifactSelections: 0,
    permissionEvaluations: 0,
    evidenceEligibilityEvaluations: 0,
    adapterExecutions: 0,
    nativeSourceExecutions: 0,
    evidenceAdmissions: 0,
    evidenceRelabelings: 0,
    operationalFitsClaimed: 0,
    newOrgansRequired: 0
  } : null;
  output.capabilityNativeEvidenceEligibility = capabilityNativeEvidenceEligibility ? {
    batchId: capabilityNativeEvidenceEligibility.batch.batchId,
    artifactsExamined: capabilityNativeEvidenceEligibility.batch.summary.artifactsExamined,
    nativeReceiptsVerified: capabilityNativeEvidenceEligibility.batch.summary.nativeReceiptsVerified,
    realLocalArtifacts: capabilityNativeEvidenceEligibility.batch.summary.realLocalArtifacts,
    syntheticOrContractDerivedArtifacts: capabilityNativeEvidenceEligibility.batch.summary.syntheticOrContractDerivedArtifacts,
    negativeArtifacts: capabilityNativeEvidenceEligibility.batch.summary.negativeArtifacts,
    positiveArtifacts: capabilityNativeEvidenceEligibility.batch.summary.positiveArtifacts,
    eligibleEvidenceCandidates: capabilityNativeEvidenceEligibility.batch.summary.eligibleEvidenceCandidates,
    evidenceAdmissions: 0,
    eventInductions: 0,
    trainingAdmissions: 0,
    runtimePromotions: 0
  } : null;
  process.stdout.write(JSON.stringify(output, null, 2) + '\n');
} catch (error) {
  process.stderr.write(`FOUNDATION OBSERVATION EXECUTOR REFUSED: ${error.message}\n`);
  process.exitCode = 1;
}
