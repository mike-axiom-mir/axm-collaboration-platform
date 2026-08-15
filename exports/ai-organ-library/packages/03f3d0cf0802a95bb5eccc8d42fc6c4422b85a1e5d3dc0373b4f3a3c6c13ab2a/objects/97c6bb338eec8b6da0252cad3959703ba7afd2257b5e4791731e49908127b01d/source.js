'use strict';

const KeySafeJson = require('../kernel/key-safe-json-transport-cell');
const Synthesis = require('../kernel/code-story-expression-synthesis-cell');
const Baseline = require('../kernel/code-story-nonlearning-baseline-cell');
const PackCell = require('../kernel/code-story-learning-heldout-pack-cell');
const Challenger = require('./code-story-learning-challenger-organ');
const Executor = require('./disposable-pure-wasm-code-executor-organ');
const BehaviorVerifier = require('./pure-wasm-independent-behavior-verifier-organ');

const ORGAN_ID = PackCell.EVALUATOR_ID;
const EVALUATOR_AUTHOR_ID = 'code-story-learning-heldout-evaluator/v1';
const REQUEST_SCHEMA = 'axm.mirror.code-story-learning-heldout-evaluation-request/v1';
const RECEIPT_SCHEMA = 'axm.mirror.code-story-learning-heldout-evaluation-receipt/v1';
const REQUIRED_PERMISSION_SCOPE = 'ONE_EXACT_CODE_STORY_LEARNING_HELDOUT_EVALUATION';
const MINIMUM_PASS_IMPROVEMENT = 3;
const REQUIRED_CHALLENGER_PASSES = PackCell.SUBJECT_COUNT * PackCell.CASES_PER_SUBJECT;
const AUTHORITY_KEYS = Object.freeze([
  'packAuthorship', 'trainingMutation', 'checkpointPersistence',
  'trainingDataPersistence', 'behaviorCertification',
  'learningImprovementCertification', 'evidenceAdmission', 'trainingAdmission',
  'mirrorSourceWrite', 'workshopSourceWrite', 'permissionGrant', 'installation',
  'promotion', 'canon', 'worldAction'
]);
const ZERO_AUTHORITY = Object.freeze(Object.fromEntries(AUTHORITY_KEYS.map(key => [key, false])));
const RECEIPT_STATES = Object.freeze([
  'PASS_SYNTHETIC_HELDOUT_LEARNING_COMPARISON_MECHANICS_ONLY',
  'PASS_DECLARED_HELDOUT_LEARNING_COMPARISON_PROPOSAL_ONLY',
  'HOLD_HELDOUT_EVALUATION_PERMISSION',
  'REFUSED_REQUESTED_AUTHORITY',
  'HOLD_TRAINING_BATCH',
  'HOLD_PACK_TRACE',
  'HOLD_GENERATOR_INFORMATION_LEAK',
  'HOLD_BASELINE_GENERATION',
  'HOLD_CHALLENGER_GENERATION',
  'HOLD_BASELINE_EXECUTOR',
  'HOLD_CHALLENGER_EXECUTOR',
  'HOLD_CHALLENGER_REGRESSION',
  'HOLD_NO_HELDOUT_IMPROVEMENT'
]);

function exactKeys(value, keys, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} must be an object`);
  const actual = Object.keys(value).sort();
  const expected = keys.slice().sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) throw new Error(`${label} fields changed`);
}

function identity(value, label, maximum = 160) {
  if (typeof value !== 'string' || !value || value.length > maximum || !/^[A-Za-z0-9][A-Za-z0-9._:/-]*$/.test(value)) throw new Error(`${label} must be a bounded identity`);
  return value;
}

function text(value, label, maximum = 1600) {
  if (typeof value !== 'string' || !value.trim() || value.length > maximum) throw new Error(`${label} must be bounded non-empty text`);
  return value;
}

function validateRequest(value) {
  const request = KeySafeJson.stable(value, { maxBytes: 1024 * 1024, maxDepth: 64, maxNodes: 32768 });
  exactKeys(request, ['evaluationId', 'limits', 'pack', 'permission', 'requestedAuthority', 'schema', 'specialistId', 'status', 'trainingBatch'], 'Code Story learning held-out evaluation request');
  if (request.schema !== REQUEST_SCHEMA || request.status !== 'EXPERIMENTAL' || request.specialistId !== 'future-code-mirror') throw new Error('Code Story learning held-out evaluation request identity changed');
  request.evaluationId = identity(request.evaluationId, 'Code Story learning held-out evaluation ID');
  request.trainingBatch = Challenger.validateTrainingBatch(request.trainingBatch);
  request.pack = PackCell.verifyPack(request.pack);

  exactKeys(request.permission, ['basis', 'grantedById', 'grantedByKind', 'identityCertified', 'scope', 'state'], 'held-out evaluation permission');
  if (!['ALLOWED', 'NOT_ALLOWED', 'UNKNOWN'].includes(request.permission.state) || request.permission.scope !== REQUIRED_PERMISSION_SCOPE || !['TEST_HARNESS', 'HUMAN_DECLARED_LOCAL'].includes(request.permission.grantedByKind) || request.permission.identityCertified !== false) throw new Error('held-out evaluation permission fields changed');
  identity(request.permission.grantedById, 'held-out evaluation permission grantor');
  text(request.permission.basis, 'held-out evaluation permission basis');

  exactKeys(request.limits, ['candidateBytes', 'candidateKinds', 'casesPerSubject', 'executorReplaysPerCase', 'maximumFreshChildProcesses', 'stdoutBytesPerReplay', 'subjects', 'wallTimeMsPerReplay'], 'held-out evaluation limits');
  if (request.limits.subjects !== 3 || request.limits.casesPerSubject !== 3 || request.limits.candidateKinds !== 2 || request.limits.executorReplaysPerCase !== 2 || request.limits.maximumFreshChildProcesses !== 36) throw new Error('held-out evaluation fixed topology changed');
  if (!Number.isInteger(request.limits.candidateBytes) || request.limits.candidateBytes < 256 || request.limits.candidateBytes > 65536) throw new Error('held-out evaluation candidate-byte limit changed');
  if (!Number.isInteger(request.limits.stdoutBytesPerReplay) || request.limits.stdoutBytesPerReplay < 1024 || request.limits.stdoutBytesPerReplay > 16384) throw new Error('held-out evaluation stdout limit changed');
  if (!Number.isInteger(request.limits.wallTimeMsPerReplay) || request.limits.wallTimeMsPerReplay < 100 || request.limits.wallTimeMsPerReplay > 2000) throw new Error('held-out evaluation wall-time limit changed');

  exactKeys(request.requestedAuthority, ['executeOnlyBoundHiddenCases', 'generateBoundBaselineAndChallenger', ...AUTHORITY_KEYS], 'held-out evaluation requested authority');
  if (typeof request.requestedAuthority.executeOnlyBoundHiddenCases !== 'boolean' || typeof request.requestedAuthority.generateBoundBaselineAndChallenger !== 'boolean' || AUTHORITY_KEYS.some(key => typeof request.requestedAuthority[key] !== 'boolean')) throw new Error('held-out evaluation authority values must be booleans');
  return request;
}

function authorityIsClosed(request) {
  return request.requestedAuthority.generateBoundBaselineAndChallenger === true && request.requestedAuthority.executeOnlyBoundHiddenCases === true && AUTHORITY_KEYS.every(key => request.requestedAuthority[key] === false);
}

function finding(code, verdict, message, detail = null) {
  return { code, verdict, message, detail };
}

function packTraceMatches(request) {
  const batch = request.trainingBatch;
  const binding = request.pack.trainingBinding;
  const sourceGroups = batch.examples.map(example => example.sourceGroupId).sort();
  return request.pack.evaluationBinding.evaluatorAuthorId === EVALUATOR_AUTHOR_ID &&
    binding.trainingBatchId === batch.batchId &&
    binding.trainingBatchDigest === KeySafeJson.digest(batch) &&
    binding.exampleCount === batch.examples.length &&
    KeySafeJson.same(binding.trainingSourceGroupIds, sourceGroups);
}

function buildChallengerRequest(request, subject) {
  const identityDigest = KeySafeJson.digest({ evaluationId: request.evaluationId, packDigest: request.pack.packDigest, subjectId: subject.subjectId });
  return {
    schema: Challenger.REQUEST_SCHEMA,
    status: 'EXPERIMENTAL',
    challengerId: `heldout-challenger/${identityDigest.slice(0, 24)}`,
    specialistId: 'future-code-mirror',
    trainingBatch: request.trainingBatch,
    target: subject.target,
    permission: {
      state: request.permission.state,
      scope: Challenger.REQUIRED_PERMISSION_SCOPE,
      grantedByKind: request.permission.grantedByKind,
      grantedById: request.permission.grantedById,
      identityCertified: false,
      basis: request.permission.basis
    },
    limits: { trainingExamples: 8, featureTagsPerExample: 8, authoringProbes: 3, candidateExpressions: 150, expressionDepth: 2, candidateBytes: 65536, childProcesses: 0, filesystemWrites: 0 },
    requestedAuthority: { fitInMemoryAndProposeBoundCandidate: true, ...Object.fromEntries(Challenger.AUTHORITY_KEYS.map(key => [key, false])) }
  };
}

function visitObjects(value, visitor) {
  if (!value || typeof value !== 'object') return;
  visitor(value);
  if (Array.isArray(value)) value.forEach(item => visitObjects(item, visitor));
  else Object.values(value).forEach(item => visitObjects(item, visitor));
}

function generatorLeakAssessment(generatorInput, subject, pack) {
  const canonical = KeySafeJson.canonicalize(generatorInput, { maxBytes: 1024 * 1024, maxDepth: 64, maxNodes: 32768 });
  const hiddenCases = subject.hiddenCases;
  const forbiddenIdentifiers = [pack.packId, pack.packDigest, ...hiddenCases.flatMap(item => [item.caseId, item.sourceGroupId, item.rationale, KeySafeJson.digest(item)])];
  const identifierMatches = forbiddenIdentifiers.filter(value => canonical.encoded.includes(JSON.stringify(value))).length;
  let hiddenCaseObjectMatches = 0;
  let hiddenInputObjectMatches = 0;
  let forbiddenKeyCount = 0;
  visitObjects(canonical.canonical, current => {
    if (!Array.isArray(current)) {
      for (const key of Object.keys(current)) if (/hiddenCases|sealedExpected|heldoutExpected|packDigest|packId/i.test(key)) forbiddenKeyCount += 1;
    }
    for (const hidden of hiddenCases) {
      if (KeySafeJson.same(current, hidden)) hiddenCaseObjectMatches += 1;
      if (KeySafeJson.same(current, hidden.input)) hiddenInputObjectMatches += 1;
    }
  });
  return {
    generatorInputDigest: canonical.digest,
    forbiddenIdentifierMatches: identifierMatches,
    forbiddenKeyCount,
    hiddenCaseObjectMatches,
    hiddenInputObjectMatches,
    hiddenExpectedResultsSent: false,
    clean: identifierMatches === 0 && forbiddenKeyCount === 0 && hiddenCaseObjectMatches === 0 && hiddenInputObjectMatches === 0
  };
}

function generateSubject(request, subject) {
  const baselineInput = subject.target;
  const challengerInput = buildChallengerRequest(request, subject);
  const baselineLeak = generatorLeakAssessment(baselineInput, subject, request.pack);
  const challengerLeak = generatorLeakAssessment(challengerInput, subject, request.pack);
  const record = {
    subjectId: subject.subjectId,
    sourceGroupId: subject.sourceGroupId,
    family: subject.family,
    targetDigest: KeySafeJson.digest(subject.target),
    targetStoryDigest: subject.target.storyTrace.storyDigest,
    baselineInputDigest: KeySafeJson.digest(baselineInput),
    challengerInputDigest: KeySafeJson.digest(challengerInput.target),
    exactSameVisibleTarget: KeySafeJson.same(baselineInput, challengerInput.target),
    baselineLeakAssessment: baselineLeak,
    challengerLeakAssessment: challengerLeak,
    baseline: null,
    challenger: null,
    state: 'NOT_GENERATED'
  };
  if (!baselineLeak.clean || !challengerLeak.clean || !record.exactSameVisibleTarget) {
    record.state = 'HOLD_GENERATOR_INFORMATION_LEAK';
    return record;
  }
  const baseline = Baseline.propose(baselineInput);
  record.baseline = {
    state: baseline.state,
    resultDigest: baseline.resultDigest,
    baselineId: baseline.baselineId,
    baselineDigest: baseline.baselineDigest,
    fittingCandidateCount: baseline.fittingCandidateCount,
    proposal: baseline.proposal
  };
  if (baseline.state !== 'PROPOSE_FIXED_NONLEARNING_BASELINE' || !baseline.proposal) {
    record.state = 'HOLD_BASELINE_GENERATION';
    return record;
  }
  const challenger = Challenger.challenge(challengerInput);
  record.challenger = {
    state: challenger.state,
    receiptId: challenger.receiptId,
    receiptDigest: challenger.receiptDigest,
    modelDigest: challenger.model && challenger.model.modelDigest || null,
    trainingExamplesConsumed: challenger.trainingAssessment.trainExamplesConsumed,
    validationExamplesConsumed: challenger.trainingAssessment.validationExamplesConsumed,
    heldOutExamplesConsumed: challenger.trainingAssessment.heldOutExamplesConsumed,
    proposal: challenger.proposal
  };
  if (!challenger.state.startsWith('PROPOSE_') || !challenger.proposal) {
    record.state = 'HOLD_CHALLENGER_GENERATION';
    return record;
  }
  const reconstructedBaseline = Synthesis.buildCandidate(baseline.proposal.expression);
  const reconstructedChallenger = Synthesis.buildCandidate(challenger.proposal.expression);
  if (reconstructedBaseline.sha256 !== baseline.proposal.sha256 || reconstructedChallenger.sha256 !== challenger.proposal.sha256) {
    record.state = 'HOLD_GENERATOR_TRACE';
    return record;
  }
  record.state = 'GENERATED_BOUND_CANDIDATES';
  return record;
}

function proposalFor(record, candidateKind) {
  return candidateKind === 'FIXED_NONLEARNING_BASELINE' ? record.baseline.proposal : record.challenger.proposal;
}

function buildExecutorRequest(request, generation, hiddenCase, candidateKind) {
  const proposal = proposalFor(generation, candidateKind);
  const requestDigest = KeySafeJson.digest({ evaluationId: request.evaluationId, packDigest: request.pack.packDigest, subjectId: generation.subjectId, caseId: hiddenCase.caseId, candidateKind });
  return {
    schema: Executor.REQUEST_SCHEMA,
    status: 'EXPERIMENTAL',
    requestId: `heldout-execution/${requestDigest.slice(0, 24)}`,
    specialistId: 'future-code-mirror',
    candidate: { format: proposal.format, bytesBase64: proposal.bytesBase64, sha256: proposal.sha256 },
    input: hiddenCase.input,
    permission: {
      state: request.permission.state,
      scope: 'ONE_EXACT_PURE_WASM_CANDIDATE_EXECUTION',
      grantedByKind: request.permission.grantedByKind,
      grantedById: request.permission.grantedById,
      identityCertified: false,
      basis: request.permission.basis
    },
    limits: { candidateBytes: request.limits.candidateBytes, stdoutBytes: request.limits.stdoutBytesPerReplay, wallTimeMs: request.limits.wallTimeMsPerReplay, replays: request.limits.executorReplaysPerCase },
    requestedAuthority: { executeExactCandidate: true, ...Object.fromEntries(Executor.AUTHORITY_KEYS.map(key => [key, false])) }
  };
}

function baseCaseRecord(subject, hiddenCase, candidateKind) {
  return {
    candidateKind,
    subjectId: subject.subjectId,
    subjectSourceGroupId: subject.sourceGroupId,
    caseId: hiddenCase.caseId,
    caseSourceGroupId: hiddenCase.sourceGroupId,
    family: hiddenCase.family,
    inputDigest: KeySafeJson.digest(hiddenCase.input),
    sealedExpectedDigest: KeySafeJson.digest(hiddenCase.expected),
    sealedExpectedResult: hiddenCase.expected.result,
    executorRequestId: null,
    executorRequestDigest: null,
    executorReceiptId: null,
    executorReceiptDigest: null,
    executorState: 'NOT_RUN',
    expectedAnswerFieldsInExecutorRequest: 0,
    actualResult: null,
    exactMatch: false,
    state: 'NOT_RUN'
  };
}

function emptyCaseRecords(request, candidateKind, state = 'NOT_RUN_PREEXECUTION_HOLD') {
  return request.pack.subjects.flatMap(subject => subject.hiddenCases.map(hidden => Object.assign(baseCaseRecord(subject, hidden, candidateKind), { state })));
}

function executeCandidateKind(request, generations, candidateKind, options = {}) {
  const records = [];
  let stopped = false;
  for (const subject of request.pack.subjects) {
    const generation = generations.find(item => item.subjectId === subject.subjectId);
    for (const hiddenCase of subject.hiddenCases) {
      const record = baseCaseRecord(subject, hiddenCase, candidateKind);
      if (stopped) {
        record.state = 'NOT_RUN_AFTER_EXECUTOR_HOLD';
        records.push(record);
        continue;
      }
      const executorRequest = buildExecutorRequest(request, generation, hiddenCase, candidateKind);
      record.executorRequestId = executorRequest.requestId;
      record.executorRequestDigest = KeySafeJson.digest(Executor.validateRequest(executorRequest));
      record.expectedAnswerFieldsInExecutorRequest = BehaviorVerifier.forbiddenAnswerKeys(executorRequest);
      let rawReceipt;
      try {
        rawReceipt = options.execute ? options.execute(executorRequest, { candidateKind, subject, hiddenCase }) : Executor.execute(executorRequest, options.executorOptions || {});
        const verified = BehaviorVerifier.validateExecutorReceipt(rawReceipt, executorRequest);
        record.executorReceiptId = verified.receiptId;
        record.executorReceiptDigest = verified.receiptDigest;
        record.executorState = verified.state;
        record.actualResult = verified.result;
        record.exactMatch = verified.result === hiddenCase.expected.result;
        record.state = record.exactMatch ? 'PASS_EXACT_HIDDEN_CASE' : 'FAIL_HIDDEN_CASE_MISMATCH';
      } catch (error) {
        record.executorReceiptId = rawReceipt && rawReceipt.receiptId || null;
        record.executorReceiptDigest = rawReceipt && rawReceipt.receiptDigest || null;
        record.executorState = rawReceipt && rawReceipt.state || 'INVALID_EXECUTOR_RECEIPT';
        record.state = 'HOLD_EXECUTOR_RESULT';
        stopped = true;
      }
      records.push(record);
    }
  }
  return records;
}

function receipt({ request, state, findings, trainingAssessment, generations, baselineCases, challengerCases }) {
  const allCases = baselineCases.concat(challengerCases);
  const baselineRuns = baselineCases.filter(item => !item.state.startsWith('NOT_RUN')).length;
  const challengerRuns = challengerCases.filter(item => !item.state.startsWith('NOT_RUN')).length;
  const baselinePasses = baselineCases.filter(item => item.exactMatch).length;
  const challengerPasses = challengerCases.filter(item => item.exactMatch).length;
  const improvement = challengerPasses - baselinePasses;
  const pass = state.startsWith('PASS_');
  const basis = {
    schema: RECEIPT_SCHEMA,
    status: 'TEST',
    state,
    organ: { id: ORGAN_ID, body: 'DETERMINISTIC_KERNEL_COMPOSING_DISPOSABLE_LEARNER_AND_EXECUTOR', persistentLearnedWeights: false },
    verification: {
      evaluationId: request.evaluationId,
      requestDigest: KeySafeJson.digest(request),
      packId: request.pack.packId,
      packDigest: request.pack.packDigest,
      packClass: request.pack.packClass,
      trainingBatchId: request.trainingBatch.batchId,
      trainingBatchDigest: KeySafeJson.digest(request.trainingBatch),
      baselineId: Baseline.BASELINE_ID,
      baselineDigest: Baseline.BASELINE_DIGEST,
      challengerId: Challenger.ORGAN_ID,
      executorId: Executor.ORGAN_ID
    },
    findings,
    trainingAssessment,
    generations,
    baselineCases,
    challengerCases,
    summary: {
      targetStories: request.pack.subjects.length,
      hiddenCasesPerCandidateKind: REQUIRED_CHALLENGER_PASSES,
      candidateKinds: 2,
      executorReplaysPerRunCase: request.limits.executorReplaysPerCase,
      baselineCasesRun: baselineRuns,
      baselinePasses,
      challengerCasesRun: challengerRuns,
      challengerPasses,
      observedPassImprovement: improvement,
      minimumPassImprovement: MINIMUM_PASS_IMPROVEMENT,
      requiredChallengerPasses: REQUIRED_CHALLENGER_PASSES,
      maximumFreshChildProcesses: request.limits.maximumFreshChildProcesses,
      observedFreshChildProcessReplays: (baselineRuns + challengerRuns) * request.limits.executorReplaysPerCase,
      expectedAnswerFieldsInExecutorRequests: allCases.reduce((sum, item) => sum + item.expectedAnswerFieldsInExecutorRequest, 0)
    },
    learningEvidence: {
      machineState: pass ? 'PASS' : state.includes('REGRESSION') || state.includes('NO_HELDOUT_IMPROVEMENT') ? 'FAIL' : 'HOLD',
      claimClass: request.pack.packClass === 'SYNTHETIC_TEST_HARNESS' ? 'SYNTHETIC_COMPARATIVE_MECHANICS_ONLY' : 'DECLARED_OUTSIDE_PACK_PROPOSAL_ONLY',
      fixedNonlearningBaseline: true,
      baselineAdaptedAfterResults: false,
      challengerUsedTrainingWeights: generations.length === PackCell.SUBJECT_COUNT && generations.every(item => item.challenger && item.challenger.modelDigest),
      targetGroupsUsedForWeightFit: 0,
      hiddenCasesUsedForWeightFit: 0,
      hiddenExpectedResultsSentToGenerators: false,
      allChallengerHiddenCasesPassed: challengerPasses === REQUIRED_CHALLENGER_PASSES,
      minimumComparativeImprovementObserved: improvement >= MINIMUM_PASS_IMPROVEMENT,
      oneSyntheticSeedOnly: true,
      realPermissionedCodeStoryGroupsObserved: 0,
      outsideAuthorshipCertified: false,
      independenceExternallyVerified: false,
      eligibleForRealCodeStoryLearningClaim: false,
      evidenceAdmission: false,
      trainingAdmission: false
    },
    separation: {
      packFrozenBeforeFirstEvaluation: request.pack.frozenBeforeFirstEvaluation,
      targetStoriesNotUsedForWeightFit: request.pack.independence.targetStoriesNotUsedForWeightFit,
      exactSameVisibleTargetForBaselineAndChallenger: generations.length === PackCell.SUBJECT_COUNT && generations.every(item => item.exactSameVisibleTarget),
      hiddenCaseObjectsInGeneratorInputs: generations.reduce((sum, item) => sum + item.baselineLeakAssessment.hiddenCaseObjectMatches + item.challengerLeakAssessment.hiddenCaseObjectMatches, 0),
      hiddenInputObjectsInGeneratorInputs: generations.reduce((sum, item) => sum + item.baselineLeakAssessment.hiddenInputObjectMatches + item.challengerLeakAssessment.hiddenInputObjectMatches, 0),
      forbiddenIdentifiersInGeneratorInputs: generations.reduce((sum, item) => sum + item.baselineLeakAssessment.forbiddenIdentifierMatches + item.challengerLeakAssessment.forbiddenIdentifierMatches, 0),
      baselineExecutedBeforeChallenger: challengerRuns === 0 || baselineRuns === REQUIRED_CHALLENGER_PASSES,
      directCurrentChallengerInvocation: generations.some(item => item.challenger !== null),
      directCurrentExecutorInvocation: baselineRuns + challengerRuns > 0,
      callerSuppliedChallengerReceiptsAccepted: false,
      callerSuppliedExecutorReceiptsAccepted: false
    },
    sideEffects: {
      temporaryModelFits: generations.filter(item => item.challenger && item.challenger.modelDigest).length,
      baselineProposals: generations.filter(item => item.baseline && item.baseline.proposal).length,
      challengerProposals: generations.filter(item => item.challenger && item.challenger.proposal).length,
      evaluatorDirectFilesystemWrites: 0,
      downstreamDisposableExecutorReplays: (baselineRuns + challengerRuns) * request.limits.executorReplaysPerCase,
      checkpointsPersisted: 0,
      trainingExamplesPersisted: 0,
      candidatesInstalled: 0,
      parentMirrorWrites: 0,
      workshopWrites: 0,
      networkActions: 0
    },
    eligibility: {
      eligibleForRealCodeStoryLearningClaim: false,
      evidenceAdmission: false,
      trainingAdmission: false,
      checkpointPersistence: false,
      runtimeActivation: false,
      installation: false,
      promotion: false,
      canon: false
    },
    authority: Object.assign({ generateOnlyBoundBaselineAndChallenger: authorityIsClosed(request), executeOnlyBoundHiddenCases: authorityIsClosed(request) }, ZERO_AUTHORITY),
    limitations: [
      'The passing pack is synthetic or merely declared. Author identity, chronology, and generator separation are not externally certified.',
      'Three closely related target stories, nine hidden integer cases, and one deterministic training seed cannot establish broad Code Story generalization.',
      'The target feature tags and three authoring probes per story are visible to both generators. Only the nine hidden behavior cases remain evaluator-only.',
      'A fixed weak lexical-simplicity baseline is useful for mechanics but does not represent every credible non-learning or prior-system baseline.',
      'Comparative hidden-case success does not establish creativity, usefulness, story coherence, maintainability, safety, evidence admission, training admission, runtime readiness, installation, or promotion.'
    ],
    boundary: 'Compares one fixed non-learning baseline and the disposable Code Story challenger over three source-group-separated target stories and nine pack-only hidden pure-Wasm behavior cases, with baseline-first direct execution. A pass is synthetic or declared comparative mechanics only and grants no real learning certification, persistence, admission, source write, installation, promotion, CANON, or world authority.'
  };
  const receiptDigest = KeySafeJson.digest(basis);
  return Object.assign({ receiptId: `code-story-learning-heldout-${receiptDigest.slice(0, 24)}`, receiptDigest }, basis);
}

function evaluate(value, options = {}) {
  const request = validateRequest(value);
  const trainingAssessment = Challenger.assessTraining(request.trainingBatch);
  const emptyGenerations = [];
  const emptyBaseline = emptyCaseRecords(request, 'FIXED_NONLEARNING_BASELINE');
  const emptyChallenger = emptyCaseRecords(request, 'LEARNED_CHALLENGER');
  if (request.permission.state !== 'ALLOWED') return receipt({ request, state: 'HOLD_HELDOUT_EVALUATION_PERMISSION', findings: [finding('HELDOUT_EVALUATION_PERMISSION_NOT_ALLOWED', 'HOLD', 'The exact held-out evaluation permission is not ALLOWED; no generator or executor ran.')], trainingAssessment, generations: emptyGenerations, baselineCases: emptyBaseline, challengerCases: emptyChallenger });
  if (!authorityIsClosed(request)) return receipt({ request, state: 'REFUSED_REQUESTED_AUTHORITY', findings: [finding('HELDOUT_EVALUATION_AUTHORITY_GROWTH', 'REFUSE', 'Only the bound baseline/challenger generation and exact hidden-case executions may run; every other authority must remain false.')], trainingAssessment, generations: emptyGenerations, baselineCases: emptyBaseline, challengerCases: emptyChallenger });
  if (!trainingAssessment.lineagesAccepted || !trainingAssessment.evidenceAcceptedForBoundedFit) return receipt({ request, state: 'HOLD_TRAINING_BATCH', findings: [finding('HELDOUT_TRAINING_BATCH_NOT_FITTABLE', 'HOLD', 'Training lineage or bounded-fit evidence failed before target generation.', { lineageIssues: trainingAssessment.lineageIssues, evidenceIssues: trainingAssessment.evidenceIssues })], trainingAssessment, generations: emptyGenerations, baselineCases: emptyBaseline, challengerCases: emptyChallenger });
  if (!packTraceMatches(request)) return receipt({ request, state: 'HOLD_PACK_TRACE', findings: [finding('HELDOUT_PACK_TRAINING_OR_EVALUATOR_BINDING_MISMATCH', 'HOLD', 'The sealed pack does not bind the exact current training batch and evaluator seat; no generator or executor ran.')], trainingAssessment, generations: emptyGenerations, baselineCases: emptyBaseline, challengerCases: emptyChallenger });

  const generations = request.pack.subjects.map(subject => generateSubject(request, subject));
  if (generations.some(item => item.state === 'HOLD_GENERATOR_INFORMATION_LEAK')) return receipt({ request, state: 'HOLD_GENERATOR_INFORMATION_LEAK', findings: [finding('PACK_ONLY_MATERIAL_REACHED_GENERATOR_INPUT', 'HOLD', 'A baseline or challenger input contains pack-only identifiers, hidden inputs, hidden objects, or an unequal visible target.')], trainingAssessment, generations, baselineCases: emptyBaseline, challengerCases: emptyChallenger });
  if (generations.some(item => item.state === 'HOLD_BASELINE_GENERATION' || item.state === 'HOLD_GENERATOR_TRACE')) return receipt({ request, state: 'HOLD_BASELINE_GENERATION', findings: [finding('FIXED_BASELINE_DID_NOT_PRODUCE_BOUND_PROPOSAL', 'HOLD', 'The fixed non-learning baseline did not return one reconstructable probe-fitting proposal; no candidate ran.')], trainingAssessment, generations, baselineCases: emptyBaseline, challengerCases: emptyChallenger });
  if (generations.some(item => item.state === 'HOLD_CHALLENGER_GENERATION')) return receipt({ request, state: 'HOLD_CHALLENGER_GENERATION', findings: [finding('LEARNED_CHALLENGER_DID_NOT_PRODUCE_BOUND_PROPOSAL', 'HOLD', 'The current challenger did not return one reconstructable proposal for every target story; no candidate ran.')], trainingAssessment, generations, baselineCases: emptyBaseline, challengerCases: emptyChallenger });

  const baselineCases = executeCandidateKind(request, generations, 'FIXED_NONLEARNING_BASELINE', options);
  if (baselineCases.some(item => item.state === 'HOLD_EXECUTOR_RESULT')) return receipt({ request, state: 'HOLD_BASELINE_EXECUTOR', findings: [finding('BASELINE_EXECUTOR_DID_NOT_RETURN_PASS', 'HOLD', 'A fixed-baseline case did not complete its exact disposable executor boundary; later baseline cases and all challenger cases remained unrun.')], trainingAssessment, generations, baselineCases, challengerCases: emptyCaseRecords(request, 'LEARNED_CHALLENGER', 'NOT_RUN_AFTER_BASELINE_EXECUTOR_HOLD') });

  const challengerCases = executeCandidateKind(request, generations, 'LEARNED_CHALLENGER', options);
  if (challengerCases.some(item => item.state === 'HOLD_EXECUTOR_RESULT')) return receipt({ request, state: 'HOLD_CHALLENGER_EXECUTOR', findings: [finding('CHALLENGER_EXECUTOR_DID_NOT_RETURN_PASS', 'HOLD', 'A learned-challenger case did not complete its exact disposable executor boundary; all baseline observations and completed challenger observations remain visible.')], trainingAssessment, generations, baselineCases, challengerCases });

  const challengerPasses = challengerCases.filter(item => item.exactMatch).length;
  const baselinePasses = baselineCases.filter(item => item.exactMatch).length;
  if (challengerPasses !== REQUIRED_CHALLENGER_PASSES) return receipt({ request, state: 'HOLD_CHALLENGER_REGRESSION', findings: [finding('CHALLENGER_MISSED_FROZEN_HIDDEN_CASES', 'FAIL', `${REQUIRED_CHALLENGER_PASSES - challengerPasses} of ${REQUIRED_CHALLENGER_PASSES} learned-challenger hidden cases mismatched.`, { mismatches: challengerCases.filter(item => !item.exactMatch).map(item => `${item.subjectId}:${item.caseId}`) })], trainingAssessment, generations, baselineCases, challengerCases });
  if (challengerPasses - baselinePasses < MINIMUM_PASS_IMPROVEMENT) return receipt({ request, state: 'HOLD_NO_HELDOUT_IMPROVEMENT', findings: [finding('COMPARATIVE_PASS_DELTA_BELOW_MINIMUM', 'FAIL', `The observed hidden-case pass improvement ${challengerPasses - baselinePasses} is below the fixed minimum ${MINIMUM_PASS_IMPROVEMENT}.`)], trainingAssessment, generations, baselineCases, challengerCases });
  const state = request.pack.packClass === 'SYNTHETIC_TEST_HARNESS' ? 'PASS_SYNTHETIC_HELDOUT_LEARNING_COMPARISON_MECHANICS_ONLY' : 'PASS_DECLARED_HELDOUT_LEARNING_COMPARISON_PROPOSAL_ONLY';
  return receipt({
    request,
    state,
    findings: [finding(
      state === 'PASS_SYNTHETIC_HELDOUT_LEARNING_COMPARISON_MECHANICS_ONLY' ? 'SYNTHETIC_BASELINE_CHALLENGER_HIDDEN_COMPARISON_PASS' : 'DECLARED_BASELINE_CHALLENGER_HIDDEN_COMPARISON_PASS',
      'INFO',
      `The fixed baseline passed ${baselinePasses} of ${REQUIRED_CHALLENGER_PASSES} hidden cases and the challenger passed ${challengerPasses}; the ${challengerPasses - baselinePasses}-case delta is ${state === 'PASS_SYNTHETIC_HELDOUT_LEARNING_COMPARISON_MECHANICS_ONLY' ? 'synthetic mechanics evidence only' : 'declared proposal-only evidence'}.`
    )],
    trainingAssessment,
    generations,
    baselineCases,
    challengerCases
  });
}

module.exports = {
  ORGAN_ID,
  EVALUATOR_AUTHOR_ID,
  REQUEST_SCHEMA,
  RECEIPT_SCHEMA,
  REQUIRED_PERMISSION_SCOPE,
  MINIMUM_PASS_IMPROVEMENT,
  REQUIRED_CHALLENGER_PASSES,
  AUTHORITY_KEYS,
  ZERO_AUTHORITY,
  RECEIPT_STATES,
  exactKeys,
  validateRequest,
  authorityIsClosed,
  packTraceMatches,
  buildChallengerRequest,
  generatorLeakAssessment,
  generateSubject,
  buildExecutorRequest,
  baseCaseRecord,
  emptyCaseRecords,
  executeCandidateKind,
  receipt,
  evaluate
};
