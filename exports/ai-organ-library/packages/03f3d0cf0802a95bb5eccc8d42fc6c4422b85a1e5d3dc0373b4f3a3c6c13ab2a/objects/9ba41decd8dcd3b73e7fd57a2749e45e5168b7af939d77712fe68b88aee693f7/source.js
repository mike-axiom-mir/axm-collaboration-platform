'use strict';

const KeySafeJson = require('../kernel/key-safe-json-transport-cell');
const SuiteCell = require('../kernel/code-story-learning-robustness-suite-cell');
const Evaluator = require('./code-story-learning-heldout-evaluator-organ');

const ORGAN_ID = 'axm.mirror.organ/code-story-learning-robustness-exam-v1';
const RECEIPT_SCHEMA = 'axm.mirror.code-story-learning-robustness-receipt/v1';
const RECEIPT_STATES = Object.freeze([
  'PASS_SYNTHETIC_MULTI_FAMILY_REPEAT_CONFIGURATION_MECHANICS_ONLY',
  'HOLD_ROBUSTNESS_SUITE_PERMISSION',
  'REFUSED_ROBUSTNESS_AUTHORITY_GROWTH',
  'HOLD_CONFIGURATION_FAILURE'
]);

function finding(code, verdict, message, detail = null) {
  return { code, verdict, message, detail };
}

function summarizeConfiguration(config, evaluatorReceipt) {
  const baselineSignatures = evaluatorReceipt.generations.filter(item => item.baseline && item.baseline.proposal).map(item => item.baseline.proposal.expressionSignature);
  const challengerSignatures = evaluatorReceipt.generations.filter(item => item.challenger && item.challenger.proposal).map(item => item.challenger.proposal.expressionSignature);
  const modelDigests = evaluatorReceipt.generations.filter(item => item.challenger && item.challenger.modelDigest).map(item => item.challenger.modelDigest);
  const uniqueBaselineSignatures = Array.from(new Set(baselineSignatures)).sort();
  const uniqueChallengerSignatures = Array.from(new Set(challengerSignatures)).sort();
  const uniqueModelDigests = Array.from(new Set(modelDigests)).sort();
  const expectedState = 'PASS_SYNTHETIC_HELDOUT_LEARNING_COMPARISON_MECHANICS_ONLY';
  const pass = evaluatorReceipt.state === expectedState &&
    evaluatorReceipt.summary.baselinePasses === 0 &&
    evaluatorReceipt.summary.challengerPasses === 9 &&
    evaluatorReceipt.summary.observedFreshChildProcessReplays === 36 &&
    uniqueBaselineSignatures.length === 1 && uniqueBaselineSignatures[0] === config.expectedBaselineSignature &&
    uniqueChallengerSignatures.length === 1 && uniqueChallengerSignatures[0] === config.expectedChallengerSignature &&
    uniqueModelDigests.length === 1 &&
    evaluatorReceipt.separation.baselineExecutedBeforeChallenger === true &&
    evaluatorReceipt.separation.hiddenCaseObjectsInGeneratorInputs === 0 &&
    evaluatorReceipt.separation.hiddenInputObjectsInGeneratorInputs === 0 &&
    evaluatorReceipt.separation.forbiddenIdentifiersInGeneratorInputs === 0 &&
    evaluatorReceipt.learningEvidence.hiddenExpectedResultsSentToGenerators === false;
  return {
    configurationId: config.configurationId,
    capabilityFamily: config.capabilityFamily,
    state: pass ? 'PASS_BOUND_CONFIGURATION' : 'HOLD_BOUND_CONFIGURATION',
    expectedBaselineSignature: config.expectedBaselineSignature,
    observedBaselineSignatures: uniqueBaselineSignatures,
    expectedChallengerSignature: config.expectedChallengerSignature,
    observedChallengerSignatures: uniqueChallengerSignatures,
    observedModelDigests: uniqueModelDigests,
    baselinePasses: evaluatorReceipt.summary.baselinePasses,
    challengerPasses: evaluatorReceipt.summary.challengerPasses,
    observedFreshChildProcessReplays: evaluatorReceipt.summary.observedFreshChildProcessReplays,
    hiddenMaterialReachedGenerators: evaluatorReceipt.separation.hiddenCaseObjectsInGeneratorInputs + evaluatorReceipt.separation.hiddenInputObjectsInGeneratorInputs + evaluatorReceipt.separation.forbiddenIdentifiersInGeneratorInputs,
    baselineExecutedBeforeChallenger: evaluatorReceipt.separation.baselineExecutedBeforeChallenger,
    evaluatorState: evaluatorReceipt.state,
    evaluatorReceiptId: evaluatorReceipt.receiptId,
    evaluatorReceiptDigest: evaluatorReceipt.receiptDigest,
    evaluatorReceipt
  };
}

function exceptionConfiguration(config, error) {
  return {
    configurationId: config.configurationId,
    capabilityFamily: config.capabilityFamily,
    state: 'HOLD_BOUND_CONFIGURATION',
    expectedBaselineSignature: config.expectedBaselineSignature,
    observedBaselineSignatures: [],
    expectedChallengerSignature: config.expectedChallengerSignature,
    observedChallengerSignatures: [],
    observedModelDigests: [],
    baselinePasses: 0,
    challengerPasses: 0,
    observedFreshChildProcessReplays: 0,
    hiddenMaterialReachedGenerators: 0,
    baselineExecutedBeforeChallenger: false,
    evaluatorState: 'HOLD_UNEXPECTED_CONFIGURATION_EXCEPTION',
    evaluatorReceiptId: null,
    evaluatorReceiptDigest: null,
    evaluatorReceipt: null,
    preservedError: { name: error && error.name || 'Error', message: error && error.message || 'Unknown configuration error' }
  };
}

function buildReceipt(suite, state, findings, configurationReceipts) {
  const passed = configurationReceipts.filter(item => item.state === 'PASS_BOUND_CONFIGURATION').length;
  const allModelDigests = Array.from(new Set(configurationReceipts.flatMap(item => item.observedModelDigests))).sort();
  const allBaselineSignatures = Array.from(new Set(configurationReceipts.flatMap(item => item.observedBaselineSignatures))).sort();
  const allChallengerSignatures = Array.from(new Set(configurationReceipts.flatMap(item => item.observedChallengerSignatures))).sort();
  const baselinePasses = configurationReceipts.reduce((sum, item) => sum + item.baselinePasses, 0);
  const challengerPasses = configurationReceipts.reduce((sum, item) => sum + item.challengerPasses, 0);
  const replays = configurationReceipts.reduce((sum, item) => sum + item.observedFreshChildProcessReplays, 0);
  const pass = state === 'PASS_SYNTHETIC_MULTI_FAMILY_REPEAT_CONFIGURATION_MECHANICS_ONLY';
  const basis = {
    schema: RECEIPT_SCHEMA,
    status: 'TEST',
    state,
    organ: { id: ORGAN_ID, body: 'DETERMINISTIC_KERNEL_COMPOSING_THREE_DISPOSABLE_LEARNER_EVALUATIONS', persistentLearnedWeights: false },
    suite: { suiteId: suite.suiteId, suiteDigest: suite.suiteDigest, configurationClass: 'SYNTHETIC_DETERMINISTIC_REPEAT_CONFIGURATION_HARNESS', recordedAt: suite.recordedAt },
    findings,
    configurationReceipts,
    summary: {
      configurationsPlanned: suite.limits.configurations,
      configurationsRun: configurationReceipts.length,
      configurationsPassed: passed,
      targetStories: configurationReceipts.length * suite.limits.subjectsPerConfiguration,
      hiddenCasesPerCandidateKind: configurationReceipts.length * suite.limits.subjectsPerConfiguration * suite.limits.casesPerSubject,
      candidateKinds: suite.limits.candidateKinds,
      fixedBaselinePoliciesCompared: 1,
      deterministicTrainingConfigurationsCompared: configurationReceipts.length,
      randomSeedsCompared: 0,
      distinctBaselineCandidateSignatures: allBaselineSignatures.length,
      distinctChallengerCandidateSignatures: allChallengerSignatures.length,
      distinctTemporaryModelDigests: allModelDigests.length,
      baselinePasses,
      challengerPasses,
      observedPassImprovement: challengerPasses - baselinePasses,
      maximumFreshChildProcesses: suite.limits.maximumFreshChildProcesses,
      observedFreshChildProcessReplays: replays
    },
    learningEvidence: {
      machineState: pass ? 'PASS' : state.startsWith('REFUSED_') ? 'REFUSE' : 'HOLD',
      claimClass: 'SYNTHETIC_MULTI_FAMILY_REPEAT_CONFIGURATION_MECHANICS_ONLY',
      oneFixedNonlearningBaselinePolicy: true,
      baselineAdaptedAfterResults: false,
      configurationCount: configurationReceipts.length,
      distinctTaskFamilies: new Set(configurationReceipts.map(item => item.capabilityFamily)).size,
      distinctTrainingConfigurations: allModelDigests.length,
      randomSeedsCompared: 0,
      realPermissionedCodeStoryGroupsObserved: 0,
      outsideHeldoutPacksObserved: 0,
      humanQualityJudgmentsObserved: 0,
      eligibleForRealCodeStoryLearningClaim: false,
      eligibleForGeneralCodingClaim: false,
      evidenceAdmission: false,
      trainingAdmission: false
    },
    separation: {
      allSuitesFrozenBeforeEvaluation: configurationReceipts.length > 0 && configurationReceipts.every(item => item.evaluatorReceipt && item.evaluatorReceipt.separation.packFrozenBeforeFirstEvaluation === true),
      allTargetsExcludedFromWeightFit: configurationReceipts.length > 0 && configurationReceipts.every(item => item.evaluatorReceipt && item.evaluatorReceipt.separation.targetStoriesNotUsedForWeightFit === true),
      hiddenMaterialReachedGenerators: configurationReceipts.reduce((sum, item) => sum + item.hiddenMaterialReachedGenerators, 0),
      hiddenExpectedResultsSentToGenerators: false,
      everyBaselineExecutedBeforeItsChallenger: configurationReceipts.length > 0 && configurationReceipts.every(item => item.baselineExecutedBeforeChallenger),
      callerSuppliedChallengerReceiptsAccepted: false,
      callerSuppliedExecutorReceiptsAccepted: false
    },
    sideEffects: {
      temporaryModelFits: configurationReceipts.reduce((sum, item) => sum + (item.evaluatorReceipt ? item.evaluatorReceipt.sideEffects.temporaryModelFits : 0), 0),
      checkpointsPersisted: 0,
      trainingExamplesPersisted: 0,
      candidatesInstalled: 0,
      parentMirrorWrites: 0,
      workshopWrites: 0,
      networkActions: 0
    },
    eligibility: { realProjectCoding: false, supervisedProjectWork: false, unattendedParentWrites: false, runtimeActivation: false, evidenceAdmission: false, trainingAdmission: false, installation: false, promotion: false, canon: false },
    authority: Object.assign({ buildOnlyBoundSyntheticRequests: SuiteCell.authorityIsClosed(suite), executeOnlyBoundHiddenCases: SuiteCell.authorityIsClosed(suite) }, SuiteCell.ZERO_AUTHORITY),
    limitations: [
      'All three configurations, stories, probes, hidden cases, and training examples are synthetic and locally authored by the test harness.',
      'Three deterministic configurations test task-family variation but do not test random-seed stability, stochastic learning, real repositories, or outside-authored held-out exams.',
      'The exam compares one fixed lexical-simplicity baseline policy. Distinct baseline candidates do not represent distinct baseline policies.',
      'Exact integer behavior does not establish creativity, usefulness, story coherence, maintainability, safety, code review quality, or broad coding ability.',
      'Every learned model remains temporary and disposable; this receipt cannot admit evidence, persist training, write source, activate runtime code, install a candidate, promote, or accept CANON.'
    ],
    boundary: 'Runs three sealed synthetic learning configurations through the existing held-out evaluator and disposable pure-Wasm executor. A pass proves only repeatable multi-family lab mechanics under one fixed baseline policy; it grants no real learning, general coding, persistence, parent-write, installation, promotion, CANON, or world authority.'
  };
  const receiptDigest = KeySafeJson.digest(basis);
  return Object.assign({ receiptId: `code-story-learning-robustness-${receiptDigest.slice(0, 24)}`, receiptDigest }, basis);
}

function evaluate(value, options = {}) {
  const suite = SuiteCell.verifySuite(value);
  if (suite.permission.state !== 'ALLOWED') return buildReceipt(suite, 'HOLD_ROBUSTNESS_SUITE_PERMISSION', [finding('ROBUSTNESS_SUITE_PERMISSION_NOT_ALLOWED', 'HOLD', 'The exact synthetic robustness permission is not ALLOWED; no configuration was built or executed.')], []);
  if (!SuiteCell.authorityIsClosed(suite)) return buildReceipt(suite, 'REFUSED_ROBUSTNESS_AUTHORITY_GROWTH', [finding('ROBUSTNESS_SUITE_AUTHORITY_GROWTH', 'REFUSE', 'Only bound synthetic request construction and exact hidden-case execution may run; every other authority must remain false.')], []);
  const configurationReceipts = [];
  for (const config of suite.configurations) {
    try {
      const request = SuiteCell.buildConfigurationRequest(suite, config.configurationId);
      const evaluatorOptions = {};
      if (options.executorOptions) evaluatorOptions.executorOptions = options.executorOptions;
      if (options.execute) evaluatorOptions.execute = (executorRequest, context) => options.execute(executorRequest, Object.assign({ configurationId: config.configurationId }, context));
      const evaluatorReceipt = Evaluator.evaluate(request, evaluatorOptions);
      configurationReceipts.push(summarizeConfiguration(config, evaluatorReceipt));
    } catch (error) {
      configurationReceipts.push(exceptionConfiguration(config, error));
    }
  }
  const passed = configurationReceipts.filter(item => item.state === 'PASS_BOUND_CONFIGURATION').length;
  if (passed !== SuiteCell.CONFIGURATION_COUNT) return buildReceipt(suite, 'HOLD_CONFIGURATION_FAILURE', [finding('ONE_OR_MORE_ROBUSTNESS_CONFIGURATIONS_HELD', 'HOLD', `${SuiteCell.CONFIGURATION_COUNT - passed} of ${SuiteCell.CONFIGURATION_COUNT} configurations did not meet the exact synthetic robustness contract.`, { heldConfigurationIds: configurationReceipts.filter(item => item.state !== 'PASS_BOUND_CONFIGURATION').map(item => item.configurationId) })], configurationReceipts);
  const distinctModels = new Set(configurationReceipts.flatMap(item => item.observedModelDigests)).size;
  if (distinctModels !== SuiteCell.CONFIGURATION_COUNT) return buildReceipt(suite, 'HOLD_CONFIGURATION_FAILURE', [finding('ROBUSTNESS_CONFIGURATIONS_DID_NOT_PRODUCE_DISTINCT_MODELS', 'HOLD', 'The three configuration-local fits did not produce three distinct temporary model digests.')], configurationReceipts);
  return buildReceipt(suite, 'PASS_SYNTHETIC_MULTI_FAMILY_REPEAT_CONFIGURATION_MECHANICS_ONLY', [finding('SYNTHETIC_MULTI_FAMILY_REPEAT_CONFIGURATION_PASS', 'INFO', 'Three distinct synthetic task and training configurations each improved from zero of nine fixed-baseline hidden cases to nine of nine challenger hidden cases. This is repeat-configuration mechanics evidence only.')], configurationReceipts);
}

module.exports = {
  ORGAN_ID,
  RECEIPT_SCHEMA,
  RECEIPT_STATES,
  summarizeConfiguration,
  buildReceipt,
  evaluate
};
