'use strict';

const KeySafeJson = require('../kernel/key-safe-json-transport-cell');
const Synthesis = require('../kernel/code-story-expression-synthesis-cell');

const ORGAN_ID = 'axm.mirror.organ/code-story-learning-challenger-v1';
const TRAINING_BATCH_SCHEMA = 'axm.mirror.code-story-challenger-training-batch/v1';
const REQUEST_SCHEMA = 'axm.mirror.code-story-learning-challenger-request/v1';
const RECEIPT_SCHEMA = 'axm.mirror.code-story-learning-challenger-receipt/v1';
const REQUIRED_PERMISSION_SCOPE = 'ONE_EXACT_IN_MEMORY_CODE_STORY_CHALLENGER_PROPOSAL';
const EXAMPLE_PERMISSION_SCOPE = 'ONE_EXACT_CODE_STORY_CHALLENGER_TRAINING_EXAMPLE';
const POSITIVE_UPDATE = 3;
const NEGATIVE_UPDATE = -4;
const SIMPLICITY_PENALTY = 1;
const AUTHORITY_KEYS = Object.freeze([
  'candidateExecution', 'checkpointPersistence', 'trainingDataPersistence',
  'evidenceAdmission', 'trainingAdmission', 'mirrorSourceWrite',
  'workshopSourceWrite', 'permissionGrant', 'installation', 'promotion',
  'canon', 'worldAction'
]);
const ZERO_AUTHORITY = Object.freeze(Object.fromEntries(AUTHORITY_KEYS.map(key => [key, false])));
const RECEIPT_STATES = Object.freeze([
  'PROPOSE_SYNTHETIC_UNSEEN_COMPOSITION_MECHANICS_ONLY',
  'PROPOSE_SYNTHETIC_LEARNED_CANDIDATE_MECHANICS_ONLY',
  'PROPOSE_DECLARED_CODE_STORY_CANDIDATE_REVIEW_ONLY',
  'HOLD_CHALLENGER_PERMISSION',
  'REFUSED_REQUESTED_AUTHORITY',
  'HOLD_TRAINING_LINEAGE',
  'HOLD_TRAINING_EVIDENCE',
  'HOLD_TARGET_TRACE',
  'HOLD_NO_FITTING_CANDIDATE',
  'HOLD_AMBIGUOUS_CANDIDATE'
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

function text(value, label, maximum = 4000) {
  if (typeof value !== 'string' || !value.trim() || value.length > maximum) throw new Error(`${label} must be bounded non-empty text`);
  return value;
}

function sha256(value, label) {
  if (typeof value !== 'string' || !/^[a-f0-9]{64}$/.test(value)) throw new Error(`${label} must be a lowercase SHA-256 digest`);
  return value;
}

function signedI32(value, label) {
  if (!Number.isInteger(value) || value < -2147483648 || value > 2147483647) throw new Error(`${label} must be a signed i32`);
  return value;
}

function featureTags(value, label) {
  if (!Array.isArray(value) || value.length < 1 || value.length > 8) throw new Error(`${label} must contain 1-8 feature tags`);
  const tags = value.map((item, index) => identity(item, `${label}[${index}]`, 80));
  if (new Set(tags).size !== tags.length) throw new Error(`${label} must be unique`);
  return tags.slice().sort();
}

function validateStoryTrace(value, label) {
  exactKeys(value, ['humanStory', 'storyAuthorId', 'storyDigest', 'storyId'], label);
  return {
    storyId: identity(value.storyId, `${label} story ID`),
    storyAuthorId: identity(value.storyAuthorId, `${label} story author ID`),
    humanStory: text(value.humanStory, `${label} human story`),
    storyDigest: sha256(value.storyDigest, `${label} story digest`)
  };
}

function storyTraceMatches(trace) {
  return trace.storyDigest === KeySafeJson.digest({ storyId: trace.storyId, storyAuthorId: trace.storyAuthorId, humanStory: trace.humanStory });
}

function validateExample(value, index) {
  const label = `training example ${index}`;
  exactKeys(value, ['boundary', 'candidateDigest', 'evidenceClass', 'exampleClass', 'exampleId', 'expression', 'featureTags', 'partition', 'permission', 'review', 'sourceGroupId', 'storyTrace'], label);
  if (!['POSITIVE_INNOVATION', 'NEGATIVE_COUNTEREXAMPLE'].includes(value.exampleClass)) throw new Error(`${label} class changed`);
  if (!['SYNTHETIC_TEST_HARNESS', 'DECLARED_REVIEW_CANDIDATE'].includes(value.evidenceClass)) throw new Error(`${label} evidence class changed`);
  if (!['TRAIN', 'VALIDATION', 'HELD_OUT'].includes(value.partition)) throw new Error(`${label} partition changed`);
  exactKeys(value.permission, ['basis', 'grantedById', 'grantedByKind', 'identityCertified', 'scope', 'state'], `${label} permission`);
  if (!['ALLOWED', 'NOT_ALLOWED', 'UNKNOWN'].includes(value.permission.state) || value.permission.scope !== EXAMPLE_PERMISSION_SCOPE || !['TEST_HARNESS', 'HUMAN_DECLARED_LOCAL'].includes(value.permission.grantedByKind) || value.permission.identityCertified !== false) throw new Error(`${label} permission fields changed`);
  identity(value.permission.grantedById, `${label} permission grantor`);
  text(value.permission.basis, `${label} permission basis`, 1600);
  exactKeys(value.review, ['basis', 'identityCertified', 'reviewerId', 'reviewerKind', 'state'], `${label} review`);
  if (!['PASS_SYNTHETIC_MECHANICS_ONLY', 'REVIEW_DECLARED_CANDIDATE_ONLY', 'NOT_REVIEWED', 'UNKNOWN'].includes(value.review.state) || !['TEST_HARNESS', 'HUMAN_REVIEWER_DECLARED'].includes(value.review.reviewerKind) || value.review.identityCertified !== false) throw new Error(`${label} review fields changed`);
  identity(value.review.reviewerId, `${label} reviewer ID`);
  text(value.review.basis, `${label} review basis`, 1600);
  return {
    exampleId: identity(value.exampleId, `${label} ID`),
    sourceGroupId: identity(value.sourceGroupId, `${label} source-group ID`),
    partition: value.partition,
    exampleClass: value.exampleClass,
    evidenceClass: value.evidenceClass,
    featureTags: featureTags(value.featureTags, `${label} feature tags`),
    storyTrace: validateStoryTrace(value.storyTrace, `${label} story trace`),
    expression: Synthesis.normalizeExpression(value.expression),
    candidateDigest: sha256(value.candidateDigest, `${label} candidate digest`),
    permission: KeySafeJson.stable(value.permission),
    review: KeySafeJson.stable(value.review),
    boundary: text(value.boundary, `${label} boundary`)
  };
}

function validateTrainingBatch(value) {
  exactKeys(value, ['batchId', 'boundary', 'examples', 'partitionHistory', 'schema', 'specialistId', 'status'], 'Code Story challenger training batch');
  if (value.schema !== TRAINING_BATCH_SCHEMA || value.status !== 'EXPERIMENTAL' || value.specialistId !== 'future-code-mirror') throw new Error('Code Story challenger training batch identity changed');
  if (!Array.isArray(value.examples) || value.examples.length < 2 || value.examples.length > 8) throw new Error('Code Story challenger training batch requires 2-8 examples');
  if (!Array.isArray(value.partitionHistory) || value.partitionHistory.length < 2 || value.partitionHistory.length > 24) throw new Error('Code Story challenger partition history requires 2-24 rows');
  const partitionHistory = value.partitionHistory.map((row, index) => {
    exactKeys(row, ['partition', 'sourceGroupId'], `partition history ${index}`);
    if (!['TRAIN', 'VALIDATION', 'HELD_OUT'].includes(row.partition)) throw new Error(`partition history ${index} partition changed`);
    return { sourceGroupId: identity(row.sourceGroupId, `partition history ${index} source-group ID`), partition: row.partition };
  });
  return {
    schema: value.schema,
    status: value.status,
    batchId: identity(value.batchId, 'Code Story challenger batch ID'),
    specialistId: value.specialistId,
    examples: value.examples.map(validateExample),
    partitionHistory,
    boundary: text(value.boundary, 'Code Story challenger training boundary')
  };
}

function validateTarget(value) {
  exactKeys(value, ['authoringProbes', 'boundary', 'featureTags', 'storyTrace', 'targetId'], 'Code Story challenger target');
  if (!Array.isArray(value.authoringProbes) || value.authoringProbes.length !== 3) throw new Error('Code Story challenger target requires exactly three visible authoring probes');
  return {
    targetId: identity(value.targetId, 'Code Story challenger target ID'),
    storyTrace: validateStoryTrace(value.storyTrace, 'Code Story challenger target story trace'),
    featureTags: featureTags(value.featureTags, 'Code Story challenger target feature tags'),
    authoringProbes: value.authoringProbes.map((probe, index) => {
      exactKeys(probe, ['expected', 'input', 'probeId', 'rationale'], `authoring probe ${index}`);
      exactKeys(probe.input, ['left', 'right'], `authoring probe ${index} input`);
      exactKeys(probe.expected, ['result'], `authoring probe ${index} expected`);
      return {
        probeId: identity(probe.probeId, `authoring probe ${index} ID`),
        input: { left: signedI32(probe.input.left, `authoring probe ${index} left`), right: signedI32(probe.input.right, `authoring probe ${index} right`) },
        expected: { result: signedI32(probe.expected.result, `authoring probe ${index} result`) },
        rationale: text(probe.rationale, `authoring probe ${index} rationale`, 1600)
      };
    }),
    boundary: text(value.boundary, 'Code Story challenger target boundary')
  };
}

function validateRequest(value) {
  const request = KeySafeJson.stable(value, { maxBytes: 768 * 1024, maxDepth: 56, maxNodes: 16384 });
  exactKeys(request, ['challengerId', 'limits', 'permission', 'requestedAuthority', 'schema', 'specialistId', 'status', 'target', 'trainingBatch'], 'Code Story learning challenger request');
  if (request.schema !== REQUEST_SCHEMA || request.status !== 'EXPERIMENTAL' || request.specialistId !== 'future-code-mirror') throw new Error('Code Story learning challenger request identity changed');
  request.challengerId = identity(request.challengerId, 'Code Story challenger ID');
  request.trainingBatch = validateTrainingBatch(request.trainingBatch);
  request.target = validateTarget(request.target);
  exactKeys(request.permission, ['basis', 'grantedById', 'grantedByKind', 'identityCertified', 'scope', 'state'], 'Code Story challenger permission');
  if (!['ALLOWED', 'NOT_ALLOWED', 'UNKNOWN'].includes(request.permission.state) || request.permission.scope !== REQUIRED_PERMISSION_SCOPE || !['TEST_HARNESS', 'HUMAN_DECLARED_LOCAL'].includes(request.permission.grantedByKind) || request.permission.identityCertified !== false) throw new Error('Code Story challenger permission fields changed');
  identity(request.permission.grantedById, 'Code Story challenger permission grantor');
  text(request.permission.basis, 'Code Story challenger permission basis', 1600);
  exactKeys(request.limits, ['authoringProbes', 'candidateBytes', 'candidateExpressions', 'childProcesses', 'expressionDepth', 'featureTagsPerExample', 'filesystemWrites', 'trainingExamples'], 'Code Story challenger limits');
  if (request.limits.trainingExamples !== 8 || request.limits.featureTagsPerExample !== 8 || request.limits.authoringProbes !== 3 || request.limits.candidateExpressions !== 150 || request.limits.expressionDepth !== 2 || request.limits.candidateBytes !== 65536 || request.limits.childProcesses !== 0 || request.limits.filesystemWrites !== 0) throw new Error('Code Story challenger fixed limits changed');
  exactKeys(request.requestedAuthority, ['fitInMemoryAndProposeBoundCandidate', ...AUTHORITY_KEYS], 'Code Story challenger requested authority');
  if (typeof request.requestedAuthority.fitInMemoryAndProposeBoundCandidate !== 'boolean' || AUTHORITY_KEYS.some(key => typeof request.requestedAuthority[key] !== 'boolean')) throw new Error('Code Story challenger authority values must be booleans');
  return request;
}

function authorityIsClosed(request) {
  return request.requestedAuthority.fitInMemoryAndProposeBoundCandidate === true && AUTHORITY_KEYS.every(key => request.requestedAuthority[key] === false);
}

function finding(code, verdict, message, detail = null) {
  return { code, verdict, message, detail };
}

function assessTraining(batch) {
  const lineageIssues = [];
  const evidenceIssues = [];
  const histories = new Map();
  for (const row of batch.partitionHistory) {
    if (!histories.has(row.sourceGroupId)) histories.set(row.sourceGroupId, new Set());
    histories.get(row.sourceGroupId).add(row.partition);
  }
  for (const [sourceGroupId, partitions] of histories.entries()) {
    if (partitions.size !== 1) lineageIssues.push({ code: 'SOURCE_GROUP_PARTITION_CONFLICT', sourceGroupId, partitions: Array.from(partitions).sort() });
  }
  const exampleIds = new Set();
  const sourceGroups = new Set();
  for (const example of batch.examples) {
    if (exampleIds.has(example.exampleId)) lineageIssues.push({ code: 'DUPLICATE_EXAMPLE_ID', exampleId: example.exampleId });
    exampleIds.add(example.exampleId);
    if (sourceGroups.has(example.sourceGroupId)) lineageIssues.push({ code: 'DUPLICATE_TRAINING_SOURCE_GROUP', sourceGroupId: example.sourceGroupId });
    sourceGroups.add(example.sourceGroupId);
    const partitions = histories.get(example.sourceGroupId);
    if (!partitions) lineageIssues.push({ code: 'SOURCE_GROUP_HISTORY_MISSING', sourceGroupId: example.sourceGroupId });
    else if (!partitions.has(example.partition)) lineageIssues.push({ code: 'EXAMPLE_HISTORY_PARTITION_MISMATCH', sourceGroupId: example.sourceGroupId, examplePartition: example.partition, historyPartitions: Array.from(partitions).sort() });
    if (example.partition !== 'TRAIN') lineageIssues.push({ code: 'NON_TRAIN_EXAMPLE_CONSUMPTION_DENIED', exampleId: example.exampleId, partition: example.partition });

    if (!storyTraceMatches(example.storyTrace)) evidenceIssues.push({ code: 'EXAMPLE_STORY_DIGEST_MISMATCH', exampleId: example.exampleId });
    const reconstructed = Synthesis.buildCandidate(example.expression);
    if (reconstructed.sha256 !== example.candidateDigest) evidenceIssues.push({ code: 'EXAMPLE_CANDIDATE_DIGEST_MISMATCH', exampleId: example.exampleId, declaredDigest: example.candidateDigest, reconstructedDigest: reconstructed.sha256 });
    if (example.permission.state !== 'ALLOWED') evidenceIssues.push({ code: 'EXAMPLE_TRAINING_PERMISSION_NOT_ALLOWED', exampleId: example.exampleId, permissionState: example.permission.state });
    const syntheticReview = example.evidenceClass === 'SYNTHETIC_TEST_HARNESS' && example.review.state === 'PASS_SYNTHETIC_MECHANICS_ONLY' && example.review.reviewerKind === 'TEST_HARNESS';
    const declaredReview = example.evidenceClass === 'DECLARED_REVIEW_CANDIDATE' && example.review.state === 'REVIEW_DECLARED_CANDIDATE_ONLY' && example.review.reviewerKind === 'HUMAN_REVIEWER_DECLARED';
    if (!syntheticReview && !declaredReview) evidenceIssues.push({ code: 'EXAMPLE_REVIEW_CLASS_MISMATCH', exampleId: example.exampleId, evidenceClass: example.evidenceClass, reviewState: example.review.state, reviewerKind: example.review.reviewerKind });
  }
  const positiveCount = batch.examples.filter(example => example.exampleClass === 'POSITIVE_INNOVATION').length;
  const negativeCount = batch.examples.filter(example => example.exampleClass === 'NEGATIVE_COUNTEREXAMPLE').length;
  if (positiveCount < 1 || negativeCount < 1) evidenceIssues.push({ code: 'CONTRASTIVE_EXAMPLE_CLASS_MISSING', positiveCount, negativeCount });
  return {
    lineagesAccepted: lineageIssues.length === 0,
    evidenceAcceptedForBoundedFit: evidenceIssues.length === 0,
    lineageIssues,
    evidenceIssues,
    exampleCount: batch.examples.length,
    positiveCount,
    negativeCount,
    trainExamplesConsumed: lineageIssues.length === 0 ? batch.examples.length : 0,
    validationExamplesConsumed: 0,
    heldOutExamplesConsumed: 0,
    realEvidenceAdmissionCertified: false,
    trainingAdmissionCertified: false
  };
}

function assessTarget(target) {
  const issues = [];
  if (!storyTraceMatches(target.storyTrace)) issues.push({ code: 'TARGET_STORY_DIGEST_MISMATCH' });
  if (new Set(target.authoringProbes.map(probe => probe.probeId)).size !== target.authoringProbes.length) issues.push({ code: 'DUPLICATE_AUTHORING_PROBE_ID' });
  const inputDigests = target.authoringProbes.map(probe => KeySafeJson.digest(probe.input));
  if (new Set(inputDigests).size !== inputDigests.length) issues.push({ code: 'DUPLICATE_AUTHORING_PROBE_INPUT' });
  return { accepted: issues.length === 0, issues, visibleAuthoringProbeCount: target.authoringProbes.length, heldOutCasesConsumed: 0 };
}

function fitModel(batch) {
  const weightMap = new Map();
  const updates = [];
  function weightsFor(featureTag) {
    if (!weightMap.has(featureTag)) weightMap.set(featureTag, Object.fromEntries(Synthesis.OPERATIONS.map(operation => [operation, 0])));
    return weightMap.get(featureTag);
  }
  for (const example of batch.examples) {
    const delta = example.exampleClass === 'POSITIVE_INNOVATION' ? POSITIVE_UPDATE : NEGATIVE_UPDATE;
    const counts = Synthesis.operationCounts(example.expression);
    for (const featureTag of example.featureTags) {
      const weights = weightsFor(featureTag);
      for (const operation of Synthesis.OPERATIONS) weights[operation] += delta * counts[operation];
    }
    updates.push({ exampleId: example.exampleId, sourceGroupId: example.sourceGroupId, exampleClass: example.exampleClass, featureTags: example.featureTags, delta, operationCounts: counts });
  }
  const weights = Array.from(weightMap.entries()).sort(([left], [right]) => left.localeCompare(right)).map(([featureTag, operationWeights]) => ({ featureTag, operationWeights }));
  const partitionDigest = KeySafeJson.digest({
    partitionHistory: batch.partitionHistory.slice().sort((a, b) => `${a.sourceGroupId}:${a.partition}`.localeCompare(`${b.sourceGroupId}:${b.partition}`)),
    examples: batch.examples.map(example => ({ exampleId: example.exampleId, sourceGroupId: example.sourceGroupId, partition: example.partition, exampleClass: example.exampleClass })).sort((a, b) => a.exampleId.localeCompare(b.exampleId))
  });
  const basis = {
    kind: 'DETERMINISTIC_DISPOSABLE_LINEAR_FEATURE_TO_OPERATION_WEIGHTS',
    positiveUpdate: POSITIVE_UPDATE,
    negativeUpdate: NEGATIVE_UPDATE,
    simplicityPenaltyPerOperation: SIMPLICITY_PENALTY,
    weights,
    updates,
    trainingExampleIds: batch.examples.map(example => example.exampleId).sort(),
    trainingSourceGroupIds: batch.examples.map(example => example.sourceGroupId).sort(),
    partitionDigest,
    learnedWeights: true,
    persisted: false,
    activeRuntime: false
  };
  return Object.assign({ modelDigest: KeySafeJson.digest(basis) }, basis);
}

function scoreExpression(expression, targetFeatureTags, model) {
  const counts = Synthesis.operationCounts(expression);
  const rows = new Map(model.weights.map(row => [row.featureTag, row.operationWeights]));
  let learnedScore = 0;
  const contributions = [];
  for (const featureTag of targetFeatureTags) {
    const weights = rows.get(featureTag) || Object.fromEntries(Synthesis.OPERATIONS.map(operation => [operation, 0]));
    let featureScore = 0;
    for (const operation of Synthesis.OPERATIONS) featureScore += weights[operation] * counts[operation];
    learnedScore += featureScore;
    contributions.push({ featureTag, score: featureScore });
  }
  const complexityPenalty = Synthesis.operationCount(expression) * SIMPLICITY_PENALTY;
  return { score: learnedScore - complexityPenalty, learnedScore, complexityPenalty, contributions, operationCounts: counts };
}

function searchCandidates(target, model) {
  const grammar = Synthesis.enumerateExpressions();
  const fitting = [];
  for (const expression of grammar) {
    const probeResults = target.authoringProbes.map(probe => {
      const actualResult = Synthesis.evaluateExpression(expression, probe.input);
      return { probeId: probe.probeId, input: probe.input, expectedResult: probe.expected.result, actualResult, exactMatch: actualResult === probe.expected.result };
    });
    if (probeResults.every(result => result.exactMatch)) {
      const candidate = Synthesis.buildCandidate(expression);
      const score = scoreExpression(expression, target.featureTags, model);
      fitting.push({ candidate, probeResults, ...score });
    }
  }
  fitting.sort((left, right) => right.score - left.score || left.candidate.operationCount - right.candidate.operationCount || left.candidate.expressionSignature.localeCompare(right.candidate.expressionSignature));
  const topScore = fitting.length ? fitting[0].score : null;
  const tied = fitting.filter(item => item.score === topScore);
  return {
    grammarCandidateCount: grammar.length,
    maximumCandidateExpressions: Synthesis.MAXIMUM_CANDIDATE_EXPRESSIONS,
    authoringProbeCount: target.authoringProbes.length,
    authoringProbesVisibleToGenerator: true,
    heldOutCasesVisibleToGenerator: 0,
    probeFittingCandidateCount: fitting.length,
    rejectedByAuthoringProbes: grammar.length - fitting.length,
    topScore,
    topScoreCandidateCount: tied.length,
    topScoreCandidates: tied.map(item => ({ expressionSignature: item.candidate.expressionSignature, candidateDigest: item.candidate.sha256, operationCount: item.candidate.operationCount, score: item.score })),
    selected: tied.length === 1 ? tied[0] : null
  };
}

function receipt({ request, state, findings, trainingAssessment, targetAssessment, model = null, search = null, proposal = null }) {
  const basis = {
    schema: RECEIPT_SCHEMA,
    status: 'TEST',
    state,
    organ: { id: ORGAN_ID, body: 'DETERMINISTIC_KERNEL_WITH_DISPOSABLE_IN_MEMORY_LEARNED_WEIGHTS', persistentLearnedWeights: false },
    verification: {
      challengerId: request.challengerId,
      requestDigest: KeySafeJson.digest(request),
      trainingBatchId: request.trainingBatch.batchId,
      targetId: request.target.targetId,
      targetStoryTrace: request.target.storyTrace,
      targetFeatureTags: request.target.featureTags,
      humanRenderingPreserved: true,
      humanRenderingParsedForDecision: false,
      machineFeatureTagsDriveWeights: true
    },
    findings,
    trainingAssessment,
    targetAssessment,
    model,
    search: search ? {
      grammarCandidateCount: search.grammarCandidateCount,
      maximumCandidateExpressions: search.maximumCandidateExpressions,
      authoringProbeCount: search.authoringProbeCount,
      authoringProbesVisibleToGenerator: search.authoringProbesVisibleToGenerator,
      heldOutCasesVisibleToGenerator: search.heldOutCasesVisibleToGenerator,
      probeFittingCandidateCount: search.probeFittingCandidateCount,
      rejectedByAuthoringProbes: search.rejectedByAuthoringProbes,
      topScore: search.topScore,
      topScoreCandidateCount: search.topScoreCandidateCount,
      topScoreCandidates: search.topScoreCandidates
    } : null,
    proposal,
    eligibility: {
      eligibleForSeparateHeldOutEvaluation: Boolean(proposal),
      eligibleForRealCodeStoryLearningClaim: false,
      evidenceAdmission: false,
      trainingAdmission: false,
      checkpointPersistence: false,
      runtimeActivation: false,
      installation: false,
      promotion: false,
      canon: false
    },
    sideEffects: {
      inMemoryModelFits: model ? 1 : 0,
      boundedExpressionSearches: search ? 1 : 0,
      candidateExecutions: 0,
      childProcesses: 0,
      filesystemWrites: 0,
      networkActions: 0,
      checkpointsPersisted: 0,
      trainingExamplesPersisted: 0,
      parentMirrorWrites: 0,
      workshopWrites: 0
    },
    authority: Object.assign({ fitOnlyBoundRequestInMemoryAndPropose: authorityIsClosed(request) }, ZERO_AUTHORITY),
    limitations: [
      'The challenger sees all three authoring probes while searching; they are requirements, not held-out evidence.',
      'Synthetic or declared TRAIN examples and temporary fitted weights do not establish improvement on unseen real work.',
      'Human story prose is preserved and digest-bound but is not parsed into decision authority; typed machine feature tags drive the fitted scores.',
      'A selected expression is one bounded pure-Wasm proposal. It has not been executed, behavior-certified, regression-tested, novelty-certified, installed, or promoted by this organ.',
      'No training example, learned weight, checkpoint, or candidate is persisted by this organ.'
    ],
    boundary: 'Fits one disposable in-memory feature-to-operation model from permissioned immutable-partition TRAIN examples and may propose one bounded pure-Wasm expression that matches three visible authoring probes. It grants no execution, held-out claim, real learning claim, evidence or training admission, persistence, source write, installation, promotion, CANON, or world authority.'
  };
  const receiptDigest = KeySafeJson.digest(basis);
  return Object.assign({ receiptId: `code-story-challenger-${receiptDigest.slice(0, 24)}`, receiptDigest }, basis);
}

function challenge(value) {
  const request = validateRequest(value);
  const trainingAssessment = assessTraining(request.trainingBatch);
  const targetAssessment = assessTarget(request.target);
  if (request.permission.state !== 'ALLOWED') return receipt({ request, state: 'HOLD_CHALLENGER_PERMISSION', findings: [finding('CHALLENGER_PERMISSION_NOT_ALLOWED', 'HOLD', 'The exact in-memory challenger permission is not ALLOWED; no model was fitted and no search ran.')], trainingAssessment, targetAssessment });
  if (!authorityIsClosed(request)) return receipt({ request, state: 'REFUSED_REQUESTED_AUTHORITY', findings: [finding('CHALLENGER_AUTHORITY_GROWTH', 'REFUSE', 'Only the exact in-memory fit and bound proposal may be requested; every other authority must remain false.')], trainingAssessment, targetAssessment });
  if (!trainingAssessment.lineagesAccepted) return receipt({ request, state: 'HOLD_TRAINING_LINEAGE', findings: [finding('TRAINING_PARTITION_OR_LINEAGE_INVALID', 'HOLD', 'Source-group partition history is conflicting, missing, duplicated, or attempts to consume a non-TRAIN example.', trainingAssessment.lineageIssues)], trainingAssessment, targetAssessment });
  if (!trainingAssessment.evidenceAcceptedForBoundedFit) return receipt({ request, state: 'HOLD_TRAINING_EVIDENCE', findings: [finding('TRAINING_EVIDENCE_NOT_FITTABLE', 'HOLD', 'At least one training trace, candidate digest, exact permission, review class, or contrastive example requirement failed.', trainingAssessment.evidenceIssues)], trainingAssessment, targetAssessment });
  if (!targetAssessment.accepted) return receipt({ request, state: 'HOLD_TARGET_TRACE', findings: [finding('TARGET_TRACE_INVALID', 'HOLD', 'The target story or visible authoring-probe trace is inconsistent.', targetAssessment.issues)], trainingAssessment, targetAssessment });

  const model = fitModel(request.trainingBatch);
  const search = searchCandidates(request.target, model);
  if (search.probeFittingCandidateCount === 0) return receipt({ request, state: 'HOLD_NO_FITTING_CANDIDATE', findings: [finding('BOUNDED_GRAMMAR_HAS_NO_PROBE_FIT', 'HOLD', 'None of the bounded grammar expressions matches all three visible authoring probes.')], trainingAssessment, targetAssessment, model, search });
  if (search.topScoreCandidateCount !== 1) return receipt({ request, state: 'HOLD_AMBIGUOUS_CANDIDATE', findings: [finding('EQUAL_TOP_SCORE_PRESERVED', 'HOLD', `${search.topScoreCandidateCount} fitting expressions share the exact top learned score; every tied digest is preserved and no proposal is selected.`, search.topScoreCandidates)], trainingAssessment, targetAssessment, model, search });

  const selected = search.selected;
  const positiveSignatures = new Set(request.trainingBatch.examples.filter(example => example.exampleClass === 'POSITIVE_INNOVATION').map(example => Synthesis.expressionSignature(example.expression)));
  const unseenComposition = !positiveSignatures.has(selected.candidate.expressionSignature);
  const proposalBasis = {
    authorId: 'future-code-mirror/disposable-learning-challenger-v1',
    format: selected.candidate.format,
    expression: selected.candidate.expression,
    expressionSignature: selected.candidate.expressionSignature,
    expressionDepth: selected.candidate.expressionDepth,
    operationCount: selected.candidate.operationCount,
    bytesBase64: selected.candidate.bytesBase64,
    bytes: selected.candidate.bytes,
    sha256: selected.candidate.sha256,
    profileId: selected.candidate.profileId,
    profileDigest: selected.candidate.profileDigest,
    score: selected.score,
    learnedScore: selected.learnedScore,
    complexityPenalty: selected.complexityPenalty,
    scoreContributions: selected.contributions,
    authoringProbeResults: selected.probeResults,
    unseenPositiveTrainingComposition: unseenComposition,
    candidateExecutedByChallenger: false,
    proposalOnly: true
  };
  const proposal = Object.assign({ proposalDigest: KeySafeJson.digest(proposalBasis) }, proposalBasis);
  const declaredExamples = request.trainingBatch.examples.some(example => example.evidenceClass === 'DECLARED_REVIEW_CANDIDATE');
  const state = declaredExamples
    ? 'PROPOSE_DECLARED_CODE_STORY_CANDIDATE_REVIEW_ONLY'
    : unseenComposition
      ? 'PROPOSE_SYNTHETIC_UNSEEN_COMPOSITION_MECHANICS_ONLY'
      : 'PROPOSE_SYNTHETIC_LEARNED_CANDIDATE_MECHANICS_ONLY';
  return receipt({
    request,
    state,
    findings: [finding(
      unseenComposition ? 'BOUNDED_UNSEEN_COMPOSITION_PROPOSED' : 'BOUNDED_LEARNED_EXPRESSION_PROPOSED',
      'INFO',
      unseenComposition
        ? 'Temporary weights selected an expression absent from every positive training expression and matching all three visible authoring probes; this is synthetic or declared proposal mechanics only.'
        : 'Temporary weights selected a learned expression matching all three visible authoring probes; this is synthetic or declared proposal mechanics only.'
    )],
    trainingAssessment,
    targetAssessment,
    model,
    search,
    proposal
  });
}

module.exports = {
  ORGAN_ID,
  TRAINING_BATCH_SCHEMA,
  REQUEST_SCHEMA,
  RECEIPT_SCHEMA,
  REQUIRED_PERMISSION_SCOPE,
  EXAMPLE_PERMISSION_SCOPE,
  POSITIVE_UPDATE,
  NEGATIVE_UPDATE,
  SIMPLICITY_PENALTY,
  AUTHORITY_KEYS,
  ZERO_AUTHORITY,
  RECEIPT_STATES,
  exactKeys,
  validateStoryTrace,
  storyTraceMatches,
  validateTrainingBatch,
  validateTarget,
  validateRequest,
  authorityIsClosed,
  assessTraining,
  assessTarget,
  fitModel,
  scoreExpression,
  searchCandidates,
  receipt,
  challenge
};
