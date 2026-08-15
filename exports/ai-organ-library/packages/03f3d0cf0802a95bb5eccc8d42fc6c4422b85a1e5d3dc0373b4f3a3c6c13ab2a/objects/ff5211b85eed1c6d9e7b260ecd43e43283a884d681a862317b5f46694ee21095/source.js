'use strict';

const fs = require('fs');
const path = require('path');
const Shadow = require('../kernel/outcome-method-private-shadow-cell');
const WatchOrgan = require('./outcome-method-prospective-watch-organ');
const Outcome = require('../kernel/outcome-learning-cell');
const OutcomeOrgan = require('./outcome-learning-organ');
const Planner = require('./outcome-curriculum-planner-organ');
const Foundation = require('../kernel/reasoning-foundation');
const ImmutableStore = require('../kernel/immutable-batch-store');

const ROOT = path.resolve(__dirname, '..');
const ORGAN_ID = 'axm.mirror.outcome-method-private-shadow-organ/v1';
const ENROLLMENT_BATCH_SCHEMA = 'axm.mirror.outcome-method-private-shadow-enrollment-batch/v1';
const PREDICTION_BATCH_SCHEMA = 'axm.mirror.outcome-method-private-shadow-prediction-batch/v1';
const EVALUATION_BATCH_SCHEMA = 'axm.mirror.outcome-method-private-shadow-evaluation-batch/v1';
const DEFAULT_ENROLLMENT_STATE_DIR = path.join(ROOT, 'state', 'outcome-method-private-shadow-enrollments');
const DEFAULT_PREDICTION_STATE_DIR = path.join(ROOT, 'state', 'outcome-method-private-shadow-predictions');
const DEFAULT_EVALUATION_STATE_DIR = path.join(ROOT, 'state', 'outcome-method-private-shadow-evaluations');
const DEFAULT_OUTCOME_STATE_DIR = Planner.DEFAULT_OUTCOME_STATE_DIR;
const MAX_OUTCOME_BATCHES = 256;
const MAX_SOURCE_BYTES = 128 * 1024 * 1024;

function clone(value) { return JSON.parse(JSON.stringify(value)); }
function exactKeys(value, keys, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || !Shadow.same(Object.keys(value).sort(), keys.slice().sort())) throw new Error(`${label} fields changed`);
}
function rejectHidden(value, trail = []) {
  if (!value || typeof value !== 'object') return;
  for (const key of Object.keys(value)) {
    if (/chain.?of.?thought|hidden.?reasoning|private.?reasoning|reasoning.?content/i.test(key)) throw new Error(`private hidden reasoning field refused at ${trail.concat(key).join('.')}`);
    rejectHidden(value[key], trail.concat(key));
  }
}
function ensureDirectory(directory, label) {
  const target = path.resolve(directory);
  fs.mkdirSync(target, { recursive: true });
  const stat = fs.lstatSync(target);
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error(`${label} must be a real directory`);
  return target;
}
function validateOutcomeBatches(batches) {
  if (!Array.isArray(batches) || batches.length > MAX_OUTCOME_BATCHES) throw new Error('private shadow Outcome inventory exceeds its bound');
  const rows = batches.map(clone).sort((left, right) => left.batchId.localeCompare(right.batchId));
  if (new Set(rows.map(item => item.batchId)).size !== rows.length || new Set(rows.map(item => item.batchDigest)).size !== rows.length) throw new Error('private shadow Outcome inventory contains duplicate batch identity');
  rows.forEach(OutcomeOrgan.verify);
  return rows;
}
function sourceBytes(value, label) {
  if (Buffer.byteLength(JSON.stringify(value), 'utf8') > MAX_SOURCE_BYTES) throw new Error(`${label} source bytes exceed the hard bound`);
}
function outcomeRefs(batches) {
  return batches.map(item => ({ batchId: item.batchId, batchDigest: item.batchDigest })).sort((left, right) => left.batchId.localeCompare(right.batchId));
}
function uniqueObservations(batches) {
  const map = new Map();
  for (const observation of batches.flatMap(item => item.observations)) {
    const existing = map.get(observation.observationId);
    if (existing && existing.observationDigest !== observation.observationDigest) throw new Error('private shadow observation identity has conflicting content');
    if (!existing) map.set(observation.observationId, clone(observation));
  }
  return Array.from(map.values()).sort((left, right) => left.observationId.localeCompare(right.observationId));
}
function foundationAuthoritySafe(session) {
  return session.authority.proposalOnly === true && Object.entries(session.authority).every(([key, value]) => key === 'proposalOnly' ? value === true : value === false);
}
function foundationSession(input) {
  const evidence = input.evidence.map(item => ({
    id: item.id,
    kind: item.kind || 'artifact',
    status: item.status || 'observed',
    statement: item.statement,
    source: { kind: item.sourceKind || 'outcome-method-private-shadow', id: item.id, at: null }
  }));
  const evidenceIds = evidence.map(item => item.id);
  const unknowns = input.unknowns.map((question, index) => ({ id: `${input.phase}-unknown-${index}-${input.subjectId.slice(-16)}`, question, blocking: true }));
  const actionId = `${input.phase}-proposal-${input.subjectId}`;
  return Foundation.run({
    schema: 'axm.mirror.reason/v1',
    requestId: `private-shadow-foundation-${input.phase}-${input.subjectId}`,
    sessionId: `private-shadow-${input.phase}-${input.subjectId}`,
    actor: { id: 'mirror-outcome-method-private-shadow-organ', kind: 'machine', displayName: 'Mirror Outcome Method Private Shadow Organ' },
    goal: { id: `private-shadow-${input.phase}`, statement: input.goal },
    evidence,
    unknowns,
    constraints: [{ id: `private-shadow-${input.phase}-evaluation-only`, type: 'max-risk', statement: 'The route is private evaluation only and may not replace live predictions, select an operative method, train, grant permission, enter runtime, promote, change CANON, or act.', actionIds: [actionId], evidenceIds: [], permission: null, maxRisk: 'low', hard: true }],
    permissions: [],
    actions: [{
      id: actionId,
      kind: input.positive ? 'proposal' : 'hold',
      label: input.actionLabel,
      requiredPermissions: [],
      supportingEvidence: evidenceIds,
      preconditionEvidence: evidenceIds,
      expectedEffects: [input.expectedEffect],
      possibleSideEffects: ['Local append order may share authorship or fixture dependence and must not be relabelled independent evidence.'],
      reversible: true,
      recovery: 'Ignore the evaluation interpretation while preserving the sealed source, trace, holds, and result.',
      risk: 'low'
    }],
    budget: { maxCandidates: 2, deadlineMs: 1000 },
    decomposition: unknowns.map((item, index) => ({ id: item.id, question: item.question, dependsOn: [], cheapestCheck: input.checks[index] || 'Collect separately attributed evidence without changing the sealed candidate.', status: 'OPEN', answerEvidenceRefs: [] })),
    assumptions: [],
    pathProfiles: [{
      pathId: `path-${actionId}`,
      actionId,
      approach: input.actionLabel,
      questionIds: unknowns.map(item => item.id),
      requiredEvidence: evidenceIds,
      requiredPermissions: [],
      toolRequest: null,
      estimatedCost: 'LOW',
      informationValue: input.positive ? 0.9 : 0.4,
      reversible: true,
      failureConditions: ['A target observation was available before the shadow prediction was sealed.', 'Conflicting target evidence was selected rather than held.', 'An evaluation record became live method authority.'],
      strategyTags: ['outcome-method-private-shadow', input.phase, input.positive ? 'review-evidence' : 'preserve-hold']
    }],
    verificationReceipts: [{
      id: `verify-${input.phase}-${input.subjectId}`,
      actionId,
      claim: input.verificationClaim,
      evidenceRefs: evidenceIds,
      method: input.verificationMethod,
      result: 'PASS',
      limitations: ['bounded caller-supplied local inventory', 'no external chronology or independent authorship certificate', 'no live method or runtime authority']
    }],
    outcome: {
      result: 'HOLD',
      statement: input.outcomeStatement,
      evidenceRefs: evidenceIds,
      transferEvidenceRefs: [],
      regressionEvidenceRefs: [],
      repairEvidenceRefs: [],
      resolvedSeams: [],
      observedAt: input.at || null,
      verified: true,
      repeatedVerifiedOutcomes: input.repeatedVerifiedOutcomes || 0,
      usePermission: 'unknown',
      permissionBasis: null,
      worldMutations: 0,
      runtimePointerChanged: false,
      unexpectedSeams: []
    }
  }, { at: input.at });
}
function batchIdentity(body, prefix) {
  body.batchId = `${prefix}-${Shadow.digest(Object.assign({}, body, { batchId: null, batchDigest: null })).slice(0, 24)}`;
  body.batchDigest = Shadow.digest(Object.assign({}, body, { batchDigest: null }));
  return Shadow.stable(body);
}
function batchAuthority() { return Object.assign({ privateEvaluationTraceWrite: true }, Shadow.falseAuthority()); }

function normalizeEnrollment(input) {
  rejectHidden(input);
  exactKeys(input, ['watchObservationBatch', 'watchObservationSource'], 'private shadow enrollment input');
  const source = { watchObservationBatch: clone(input.watchObservationBatch), watchObservationSource: clone(input.watchObservationSource) };
  WatchOrgan.verifyObservation(source.watchObservationBatch, source.watchObservationSource);
  sourceBytes(source, 'private shadow enrollment');
  return source;
}
function enrollmentSourceRefs(source) {
  return { watchObservationBatch: { batchId: source.watchObservationBatch.batchId, batchDigest: source.watchObservationBatch.batchDigest } };
}
function runEnrollmentFromSource(source, options = {}) {
  const createdAt = String(options.at == null ? '' : options.at).trim() || source.watchObservationBatch.createdAt;
  const watches = new Map(source.watchObservationSource.registrationBatch.watches.map(item => [item.watchId, item]));
  const enrollments = [];
  const holds = [];
  for (const result of source.watchObservationBatch.results.slice().sort((left, right) => left.resultId.localeCompare(right.resultId))) {
    const watch = watches.get(result.watch.watchId);
    if (!watch) throw new Error('private shadow enrollment result references an unknown watch');
    if (result.proposal.state !== 'PROPOSE_PRIVATE_SHADOW_METHOD_REVIEW') {
      holds.push({ resultId: result.resultId, resultDigest: result.resultDigest, watchId: watch.watchId, watchDigest: watch.watchDigest, candidateId: watch.candidate.candidateId, candidateDigest: watch.candidate.candidateDigest, state: 'HOLD_WATCH_RESULT_NOT_POSITIVE' });
      continue;
    }
    enrollments.push(Shadow.enroll({ watch, result, watchObservationBatchId: source.watchObservationBatch.batchId, watchObservationBatchDigest: source.watchObservationBatch.batchDigest }));
  }
  enrollments.sort((left, right) => left.enrollmentId.localeCompare(right.enrollmentId));
  holds.sort((left, right) => left.resultId.localeCompare(right.resultId));
  const foundationSessions = enrollments.map(item => foundationSession({
    phase: 'enrollment',
    subjectId: item.enrollmentId,
    at: createdAt,
    positive: true,
    goal: 'Record an exact positive prospective-watch candidate as eligible only for private pre-observation evaluation.',
    evidence: [{ id: item.source.resultId, kind: 'test', status: 'tested', statement: `Positive watch result ${item.source.resultId} passed target, source-diversity, improvement, mismatch, and historical veto gates.` }, { id: item.enrollmentId, statement: `Enrollment ${item.enrollmentId} closes every operative method authority while allowing private evaluation prediction records.` }],
    unknowns: ['Can an external anchor establish chronology for future target observations?', 'Will the candidate preserve broader scopes and counterpatterns?', 'What separate human-reviewed evidence would ever justify live method consideration?'],
    checks: ['Seal a target prediction and external timestamp before its observation exists.', 'Repeat against new scopes without changing the candidate.', 'Keep live admission outside this organ and require a separate explicit gate.'],
    actionLabel: 'Preserve a private evaluation-only shadow enrollment',
    expectedEffect: 'The candidate can originate separate ignored shadow prediction records but cannot replace the baseline or enter runtime.',
    verificationClaim: 'The exact positive Watch result reconstructs this enrollment and all operative authorities remain false.',
    verificationMethod: 'Replay the Watch observation source and deterministic private-shadow enrollment cell.',
    outcomeStatement: 'The candidate is recorded for private evaluation only; no operative shadow or runtime method was admitted.'
  })).sort((left, right) => left.reasoningSessionId.localeCompare(right.reasoningSessionId));
  return batchIdentity({
    schema: ENROLLMENT_BATCH_SCHEMA,
    batchId: null,
    batchDigest: null,
    createdAt,
    organ: { id: ORGAN_ID, status: 'TEST', learnedWeights: false, claimCeiling: 'TEST_POSITIVE_WATCH_TO_PRIVATE_EVALUATION_ONLY_ENROLLMENT' },
    source: enrollmentSourceRefs(source),
    enrollments,
    holds,
    foundationSessions,
    summary: {
      watchResults: source.watchObservationBatch.results.length,
      positiveWatchResults: enrollments.length,
      evaluationOnlyEnrollments: enrollments.length,
      heldResults: holds.length,
      foundationSessions: foundationSessions.length,
      targetObservationsReadForFuturePredictions: 0,
      operativeShadowAdmissions: 0,
      livePredictionReplacements: 0,
      trainingAdmissions: 0,
      permissionGrants: 0,
      toolCalls: 0,
      runtimeSelections: 0,
      runtimeAdmissions: 0,
      runtimePromotions: 0,
      canonChanges: 0,
      worldActions: 0
    },
    state: enrollments.length ? 'PRIVATE_EVALUATION_ONLY_SHADOW_ENROLLED' : 'NO_POSITIVE_WATCH_RESULT_TO_ENROLL',
    authority: batchAuthority(),
    boundary: 'This TEST organ automatically records only exact positive Prospective Watch results in an ignored private evaluation registry. Enrollment authorizes separate pre-observation evaluation records only; it is not operative shadow admission, live prediction replacement, training, permission, tool, runtime, promotion, CANON, or world authority.'
  }, 'outcome-method-private-shadow-enrollment-batch');
}
function runEnrollment(input, options = {}) { return runEnrollmentFromSource(normalizeEnrollment(input), options); }
function verifyEnrollmentBatch(batch, input, runDir) {
  exactKeys(batch, ['schema', 'batchId', 'batchDigest', 'createdAt', 'organ', 'source', 'enrollments', 'holds', 'foundationSessions', 'summary', 'state', 'authority', 'boundary'], 'private shadow enrollment batch');
  if (batch.schema !== ENROLLMENT_BATCH_SCHEMA || batch.organ.id !== ORGAN_ID || batch.organ.status !== 'TEST' || batch.organ.learnedWeights !== false || batch.organ.claimCeiling !== 'TEST_POSITIVE_WATCH_TO_PRIVATE_EVALUATION_ONLY_ENROLLMENT') throw new Error('private shadow enrollment batch boundary changed');
  batch.enrollments.forEach(Shadow.verifyEnrollment);
  if (!batch.foundationSessions.every(foundationAuthoritySafe)) throw new Error('private shadow enrollment Foundation session gained authority');
  const trueAuthority = new Set(['privateEvaluationTraceWrite']);
  if (!batch.authority || Object.entries(batch.authority).some(([key, value]) => trueAuthority.has(key) ? value !== true : value !== false)) throw new Error('private shadow enrollment batch gained authority');
  const zeros = ['targetObservationsReadForFuturePredictions', 'operativeShadowAdmissions', 'livePredictionReplacements', 'trainingAdmissions', 'permissionGrants', 'toolCalls', 'runtimeSelections', 'runtimeAdmissions', 'runtimePromotions', 'canonChanges', 'worldActions'];
  if (zeros.some(key => batch.summary[key] !== 0)) throw new Error('private shadow enrollment batch claim ceiling changed');
  const source = normalizeEnrollment(input);
  if (!Shadow.same(batch.source, enrollmentSourceRefs(source))) throw new Error('private shadow enrollment source refs changed');
  const reconstructed = runEnrollmentFromSource(source, { at: batch.createdAt });
  if (!Shadow.same(reconstructed, batch)) throw new Error('private shadow enrollment batch does not replay from its complete source');
  const expectedDigest = Shadow.digest(Object.assign({}, batch, { batchDigest: null }));
  const expectedId = `outcome-method-private-shadow-enrollment-batch-${Shadow.digest(Object.assign({}, batch, { batchId: null, batchDigest: null })).slice(0, 24)}`;
  if (batch.batchDigest !== expectedDigest || batch.batchId !== expectedId) throw new Error('private shadow enrollment batch identity changed');
  verifyDisk(runDir, batch, source, verifyEnrollmentBatch, 'private shadow enrollment');
  return true;
}

function normalizePrediction(input) {
  rejectHidden(input);
  exactKeys(input, ['enrollmentBatch', 'enrollmentSource', 'outcomeBatches'], 'private shadow prediction input');
  const enrollmentBatch = clone(input.enrollmentBatch);
  const enrollmentSource = clone(input.enrollmentSource);
  verifyEnrollmentBatch(enrollmentBatch, enrollmentSource);
  const outcomeBatches = validateOutcomeBatches(input.outcomeBatches);
  const byId = new Map(outcomeBatches.map(item => [item.batchId, item]));
  for (const ref of enrollmentSource.watchObservationBatch.source.outcomeBatches) {
    const current = byId.get(ref.batchId);
    if (!current || current.batchDigest !== ref.batchDigest) throw new Error('private shadow prediction inventory omits or changes a Watch source Outcome batch');
  }
  const source = { enrollmentBatch, enrollmentSource, outcomeBatches };
  sourceBytes(source, 'private shadow prediction');
  return source;
}
function predictionSourceRefs(source) {
  return {
    enrollmentBatch: { batchId: source.enrollmentBatch.batchId, batchDigest: source.enrollmentBatch.batchDigest },
    outcomeBatches: outcomeRefs(source.outcomeBatches)
  };
}
function predictionHold(enrollment, prediction, state) {
  return {
    enrollmentId: enrollment.enrollmentId,
    enrollmentDigest: enrollment.enrollmentDigest,
    predictionId: prediction ? prediction.predictionId : null,
    predictionDigest: prediction ? prediction.predictionDigest : null,
    targetKey: prediction ? prediction.targetKey : null,
    state
  };
}
function runPredictionFromSource(source, options = {}) {
  const createdAt = String(options.at == null ? '' : options.at).trim() || source.outcomeBatches.map(item => item.createdAt).concat(source.enrollmentBatch.createdAt).sort().at(-1);
  const observations = uniqueObservations(source.outcomeBatches);
  const observationTargets = new Set(observations.map(item => item.targetKey));
  const allPredictions = source.outcomeBatches.flatMap(item => item.predictions);
  const shadowPredictions = [];
  const holds = [];
  let duplicateBaselineCopiesExcluded = 0;
  let notApplicableBaselinePredictions = 0;
  for (const enrollment of source.enrollmentBatch.enrollments) {
    const exactPredictions = new Map();
    for (const prediction of allPredictions) {
      const applicable = Shadow.same(prediction.method, enrollment.scope.baselineMethod) && prediction.scope.fieldSchemaId === enrollment.scope.fieldSchemaId && prediction.scope.fieldSchemaDigest === enrollment.scope.fieldSchemaDigest;
      if (!applicable) { notApplicableBaselinePredictions += 1; continue; }
      const key = `${prediction.predictionId}:${prediction.predictionDigest}`;
      if (exactPredictions.has(key)) { duplicateBaselineCopiesExcluded += 1; continue; }
      exactPredictions.set(key, prediction);
    }
    const byTarget = new Map();
    for (const prediction of exactPredictions.values()) {
      if (!byTarget.has(prediction.targetKey)) byTarget.set(prediction.targetKey, []);
      byTarget.get(prediction.targetKey).push(prediction);
    }
    for (const targetPredictions of Array.from(byTarget.values()).sort((left, right) => left[0].targetKey.localeCompare(right[0].targetKey))) {
      if (targetPredictions.length !== 1) {
        targetPredictions.forEach(item => holds.push(predictionHold(enrollment, item, 'HOLD_CONFLICTING_BASELINE_PREDICTIONS_FOR_TARGET')));
        continue;
      }
      const prediction = targetPredictions[0];
      if (observationTargets.has(prediction.targetKey)) { holds.push(predictionHold(enrollment, prediction, 'HOLD_TARGET_OBSERVATION_ALREADY_PRESENT')); continue; }
      if (!enrollment.scope.requiredFieldIds.every(fieldId => prediction.fields.some(item => item.fieldId === fieldId))) { holds.push(predictionHold(enrollment, prediction, 'HOLD_REQUIRED_CANDIDATE_FIELD_ABSENT')); continue; }
      if (prediction.permission.status !== 'ALLOWED' || !prediction.assessment.evaluationEligible) { holds.push(predictionHold(enrollment, prediction, 'HOLD_BASELINE_PREDICTION_NOT_EVALUATION_ELIGIBLE')); continue; }
      try { Outcome.verifyPrediction(prediction, observations); } catch (_) { holds.push(predictionHold(enrollment, prediction, 'HOLD_BASELINE_PRESEAL_INVENTORY_INCOMPLETE')); continue; }
      shadowPredictions.push(Shadow.sealShadowPrediction({ enrollment, baselinePrediction: prediction, observationsBeforeSeal: observations }));
    }
  }
  shadowPredictions.sort((left, right) => left.shadowPredictionId.localeCompare(right.shadowPredictionId));
  holds.sort((left, right) => left.enrollmentId.localeCompare(right.enrollmentId) || String(left.targetKey).localeCompare(String(right.targetKey)) || left.state.localeCompare(right.state));
  const foundationSessions = shadowPredictions.map(item => foundationSession({
    phase: 'prediction',
    subjectId: item.shadowPredictionId,
    at: createdAt,
    positive: true,
    goal: 'Preserve a separate candidate prediction before the supplied local inventory contains that target observation.',
    evidence: [{ id: item.enrollment.enrollmentId, statement: `Evaluation-only enrollment ${item.enrollment.enrollmentId} binds the closed candidate.` }, { id: item.baselinePrediction.predictionId, statement: `Baseline prediction ${item.baselinePrediction.predictionId} is sealed, permission eligible, and has no target observation in the supplied inventory.` }, { id: item.shadowPredictionId, statement: `Shadow prediction ${item.shadowPredictionId} preserves the candidate output separately with zero generated probability and zero live replacement authority.` }],
    unknowns: ['Will the target later receive one unambiguous permission-eligible observation?', 'Can external evidence establish that the observation did not exist before this prediction?', 'Does the candidate remain safe outside this bounded field schema?'],
    checks: ['Wait for a later exact target observation without changing this prediction.', 'Anchor the prediction digest outside the local append-only store before observation.', 'Repeat against separate scopes and preserved counterpatterns.'],
    actionLabel: 'Preserve the pre-observation private shadow prediction',
    expectedEffect: 'A later evaluator can compare the unchanged baseline and challenger records without hindsight.',
    verificationClaim: 'The candidate output reconstructs through the closed interpreter and the bound pre-seal inventory contains no target observation.',
    verificationMethod: 'Replay the enrollment, baseline Outcome prediction, observation inventory, and deterministic shadow-prediction cell.',
    outcomeStatement: 'One separate private prediction is preserved for later evaluation; no live prediction or method changed.'
  })).sort((left, right) => left.reasoningSessionId.localeCompare(right.reasoningSessionId));
  return batchIdentity({
    schema: PREDICTION_BATCH_SCHEMA,
    batchId: null,
    batchDigest: null,
    createdAt,
    organ: { id: ORGAN_ID, status: 'TEST', learnedWeights: false, claimCeiling: 'TEST_PERMISSION_BOUND_PRIVATE_SHADOW_PREDICTIONS_WITH_ZERO_TARGET_OBSERVATION_READS' },
    source: predictionSourceRefs(source),
    shadowPredictions,
    holds,
    foundationSessions,
    summary: {
      enrollments: source.enrollmentBatch.enrollments.length,
      suppliedOutcomeBatches: source.outcomeBatches.length,
      uniqueObservationsBeforeSeal: observations.length,
      baselinePredictionCopiesInspected: allPredictions.length * source.enrollmentBatch.enrollments.length,
      duplicateBaselineCopiesExcluded,
      notApplicableBaselinePredictions,
      shadowPredictions: shadowPredictions.length,
      heldBaselinePredictions: holds.length,
      targetObservationsRead: 0,
      generatedProbabilityValues: 0,
      livePredictionReplacements: 0,
      operativeShadowAdmissions: 0,
      trainingAdmissions: 0,
      permissionGrants: 0,
      toolCalls: 0,
      runtimeSelections: 0,
      runtimeAdmissions: 0,
      runtimePromotions: 0,
      canonChanges: 0,
      worldActions: 0
    },
    state: shadowPredictions.length ? 'PRIVATE_SHADOW_PREDICTIONS_SEALED_PRE_OBSERVATION' : 'NO_ELIGIBLE_PRE_OBSERVATION_BASELINE_PREDICTIONS',
    authority: batchAuthority(),
    boundary: 'This TEST organ discovers candidate-compatible permission-eligible baseline predictions in a complete bounded Outcome inventory and seals separate private challenger predictions only when the target observation is absent. It preserves duplicate and conflicting targets as exclusions or holds and cannot read target answers, generate probability, replace live predictions, admit an operative method, train, grant permission, use tools, enter runtime, promote, change CANON, or act.'
  }, 'outcome-method-private-shadow-prediction-batch');
}
function runPrediction(input, options = {}) { return runPredictionFromSource(normalizePrediction(input), options); }
function verifyPredictionBatch(batch, input, runDir) {
  exactKeys(batch, ['schema', 'batchId', 'batchDigest', 'createdAt', 'organ', 'source', 'shadowPredictions', 'holds', 'foundationSessions', 'summary', 'state', 'authority', 'boundary'], 'private shadow prediction batch');
  if (batch.schema !== PREDICTION_BATCH_SCHEMA || batch.organ.id !== ORGAN_ID || batch.organ.status !== 'TEST' || batch.organ.learnedWeights !== false || batch.organ.claimCeiling !== 'TEST_PERMISSION_BOUND_PRIVATE_SHADOW_PREDICTIONS_WITH_ZERO_TARGET_OBSERVATION_READS') throw new Error('private shadow prediction batch boundary changed');
  const source = normalizePrediction(input);
  const observations = uniqueObservations(source.outcomeBatches);
  const enrollments = new Map(source.enrollmentBatch.enrollments.map(item => [item.enrollmentId, item]));
  batch.shadowPredictions.forEach(item => {
    const enrollment = enrollments.get(item.enrollment.enrollmentId);
    if (!enrollment) throw new Error('private shadow prediction references an unknown enrollment');
    Shadow.verifyShadowPrediction(item, observations, enrollment);
  });
  if (!batch.foundationSessions.every(foundationAuthoritySafe)) throw new Error('private shadow prediction Foundation session gained authority');
  const trueAuthority = new Set(['privateEvaluationTraceWrite']);
  if (!batch.authority || Object.entries(batch.authority).some(([key, value]) => trueAuthority.has(key) ? value !== true : value !== false)) throw new Error('private shadow prediction batch gained authority');
  const zeros = ['targetObservationsRead', 'generatedProbabilityValues', 'livePredictionReplacements', 'operativeShadowAdmissions', 'trainingAdmissions', 'permissionGrants', 'toolCalls', 'runtimeSelections', 'runtimeAdmissions', 'runtimePromotions', 'canonChanges', 'worldActions'];
  if (zeros.some(key => batch.summary[key] !== 0)) throw new Error('private shadow prediction batch claim ceiling changed');
  if (!Shadow.same(batch.source, predictionSourceRefs(source))) throw new Error('private shadow prediction source refs changed');
  const reconstructed = runPredictionFromSource(source, { at: batch.createdAt });
  if (!Shadow.same(reconstructed, batch)) throw new Error('private shadow prediction batch does not replay from its complete source');
  const expectedDigest = Shadow.digest(Object.assign({}, batch, { batchDigest: null }));
  const expectedId = `outcome-method-private-shadow-prediction-batch-${Shadow.digest(Object.assign({}, batch, { batchId: null, batchDigest: null })).slice(0, 24)}`;
  if (batch.batchDigest !== expectedDigest || batch.batchId !== expectedId) throw new Error('private shadow prediction batch identity changed');
  verifyDisk(runDir, batch, source, verifyPredictionBatch, 'private shadow prediction');
  return true;
}

function normalizeEvaluation(input) {
  rejectHidden(input);
  exactKeys(input, ['predictionBatch', 'predictionSource', 'outcomeBatches'], 'private shadow evaluation input');
  const predictionBatch = clone(input.predictionBatch);
  const predictionSource = clone(input.predictionSource);
  verifyPredictionBatch(predictionBatch, predictionSource);
  const outcomeBatches = validateOutcomeBatches(input.outcomeBatches);
  const byId = new Map(outcomeBatches.map(item => [item.batchId, item]));
  for (const ref of predictionBatch.source.outcomeBatches) {
    const current = byId.get(ref.batchId);
    if (!current || current.batchDigest !== ref.batchDigest) throw new Error('private shadow evaluation inventory omits or changes a prediction-phase Outcome batch');
  }
  const source = { predictionBatch, predictionSource, outcomeBatches };
  sourceBytes(source, 'private shadow evaluation');
  return source;
}
function evaluationSourceRefs(source) {
  return {
    predictionBatch: { batchId: source.predictionBatch.batchId, batchDigest: source.predictionBatch.batchDigest },
    outcomeBatches: outcomeRefs(source.outcomeBatches)
  };
}
function evaluationHold(record, state, observationIds = []) {
  return {
    enrollmentId: record.enrollment.enrollmentId,
    enrollmentDigest: record.enrollment.enrollmentDigest,
    shadowPredictionId: record.shadowPredictionId,
    shadowPredictionDigest: record.shadowPredictionDigest,
    targetKey: record.baselinePrediction.targetKey,
    observationIds: observationIds.slice().sort(),
    state
  };
}
function runEvaluationFromSource(source, options = {}) {
  const createdAt = String(options.at == null ? '' : options.at).trim() || source.outcomeBatches.map(item => item.createdAt).concat(source.predictionBatch.createdAt).sort().at(-1);
  const currentObservations = uniqueObservations(source.outcomeBatches);
  const preSealObservations = uniqueObservations(source.predictionSource.outcomeBatches);
  const observationsByTarget = new Map();
  for (const observation of currentObservations) {
    if (!observationsByTarget.has(observation.targetKey)) observationsByTarget.set(observation.targetKey, []);
    observationsByTarget.get(observation.targetKey).push(observation);
  }
  const enrollments = new Map(source.predictionSource.enrollmentBatch.enrollments.map(item => [item.enrollmentId, item]));
  const evaluations = [];
  const holds = [];
  for (const record of source.predictionBatch.shadowPredictions) {
    const enrollment = enrollments.get(record.enrollment.enrollmentId);
    if (!enrollment) throw new Error('private shadow evaluation prediction references an unknown enrollment');
    Shadow.verifyShadowPrediction(record, preSealObservations, enrollment);
    const observations = (observationsByTarget.get(record.baselinePrediction.targetKey) || []).slice().sort((left, right) => left.observationId.localeCompare(right.observationId));
    if (!observations.length) { holds.push(evaluationHold(record, 'HOLD_NO_LATER_TARGET_OBSERVATION')); continue; }
    if (observations.length > 1) { holds.push(evaluationHold(record, 'HOLD_CONFLICTING_LATER_TARGET_OBSERVATIONS', observations.map(item => item.observationId))); continue; }
    const evaluation = Shadow.evaluateShadow({ enrollment, shadowPrediction: record, observationsBeforeSeal: preSealObservations, observation: observations[0] });
    Shadow.verifyShadowEvaluation(evaluation, { enrollment, shadowPrediction: record, observationsBeforeSeal: preSealObservations, observation: observations[0] });
    evaluations.push(evaluation);
  }
  evaluations.sort((left, right) => left.evaluationId.localeCompare(right.evaluationId));
  holds.sort((left, right) => left.enrollmentId.localeCompare(right.enrollmentId) || left.targetKey.localeCompare(right.targetKey));
  const results = [];
  for (const enrollment of source.predictionSource.enrollmentBatch.enrollments) {
    const relevantEvaluations = evaluations.filter(item => item.enrollment.enrollmentId === enrollment.enrollmentId);
    const relevantHolds = holds.filter(item => item.enrollmentId === enrollment.enrollmentId);
    const pending = relevantHolds.filter(item => item.state === 'HOLD_NO_LATER_TARGET_OBSERVATION').map(item => item.targetKey);
    const conflicts = relevantHolds.filter(item => item.state === 'HOLD_CONFLICTING_LATER_TARGET_OBSERVATIONS').map(item => item.targetKey);
    results.push(Shadow.buildStabilityResult(enrollment, relevantEvaluations, pending, conflicts));
  }
  results.sort((left, right) => left.resultId.localeCompare(right.resultId));
  const resultByEnrollment = new Map(results.map(item => [item.enrollment.enrollmentId, item]));
  const foundationSessions = results.map(item => foundationSession({
    phase: 'evaluation',
    subjectId: item.resultId,
    at: createdAt,
    positive: item.proposal.state === 'PROPOSE_PRIVATE_SHADOW_STABILITY_REVIEW',
    repeatedVerifiedOutcomes: item.metrics.fullyEvaluableTargets,
    goal: 'Compare unchanged pre-observation baseline and challenger predictions with later supplied observations while preserving uncertainty, conflicts, and runtime exclusion.',
    evidence: [{ id: item.enrollment.enrollmentId, statement: `Evaluation-only enrollment ${item.enrollment.enrollmentId} remains the candidate governance root.` }].concat(item.evaluations.map(ref => ({ id: ref.evaluationId, kind: 'test', status: 'tested', statement: `Private shadow evaluation ${ref.evaluationId} compares one unchanged baseline and challenger prediction with one exact observation.` }))).concat([{ id: item.resultId, kind: 'test', status: 'tested', statement: `Stability result ${item.resultId} is ${item.proposal.state} with ${item.metrics.candidateMatches} candidate match(es), ${item.metrics.baselineMatches} baseline match(es), and ${item.metrics.candidateMismatches} candidate mismatch(es).` }]),
    unknowns: ['Can external anchors certify the prediction-before-observation ordering?', 'Are target authors and evaluators independent of the candidate-building route?', 'Does the method preserve broader transfer, safety, and long-horizon behavior?', 'What separate human gate would be required before any live method trial?'],
    checks: ['Anchor prediction digests externally before outcome creation.', 'Use separately attributed target and observation producers.', 'Repeat unchanged against new scopes and counterpatterns.', 'Design a separate reversible live-trial contract; this organ cannot provide it.'],
    actionLabel: item.proposal.state === 'PROPOSE_PRIVATE_SHADOW_STABILITY_REVIEW' ? 'Propose human review of stable private shadow evidence' : `Preserve private shadow hold ${item.proposal.state}`,
    expectedEffect: item.proposal.state === 'PROPOSE_PRIVATE_SHADOW_STABILITY_REVIEW' ? 'A steward can inspect genuine pre-observation local evidence without any live method change.' : 'The exact insufficiency or contradiction remains visible without selecting the candidate.',
    verificationClaim: 'All evaluation identities reconstruct from the enrollment, unchanged shadow predictions, pre-seal inventory, and exact later observations.',
    verificationMethod: 'Replay all three private-shadow phases from their complete content-addressed source bundles.',
    outcomeStatement: item.proposal.state === 'PROPOSE_PRIVATE_SHADOW_STABILITY_REVIEW' ? 'Private evaluation supports review only; no live method or runtime role changed.' : `Private evaluation remains held at ${item.proposal.state}; no live method or runtime role changed.`
  })).sort((left, right) => left.reasoningSessionId.localeCompare(right.reasoningSessionId));
  const proposals = results.filter(item => item.proposal.state === 'PROPOSE_PRIVATE_SHADOW_STABILITY_REVIEW').length;
  return batchIdentity({
    schema: EVALUATION_BATCH_SCHEMA,
    batchId: null,
    batchDigest: null,
    createdAt,
    organ: { id: ORGAN_ID, status: 'TEST', learnedWeights: false, claimCeiling: 'TEST_LATER_OUTCOME_PRIVATE_SHADOW_COMPARISON_TO_STABILITY_REVIEW_PROPOSAL_ONLY' },
    source: evaluationSourceRefs(source),
    evaluations,
    holds,
    results,
    foundationSessions,
    summary: {
      enrollments: source.predictionSource.enrollmentBatch.enrollments.length,
      shadowPredictions: source.predictionBatch.shadowPredictions.length,
      suppliedOutcomeBatches: source.outcomeBatches.length,
      currentUniqueObservations: currentObservations.length,
      evaluatedTargets: evaluations.length,
      pendingTargets: holds.filter(item => item.state === 'HOLD_NO_LATER_TARGET_OBSERVATION').length,
      conflictingTargets: holds.filter(item => item.state === 'HOLD_CONFLICTING_LATER_TARGET_OBSERVATIONS').length,
      fullyEvaluableTargets: results.reduce((sum, item) => sum + item.metrics.fullyEvaluableTargets, 0),
      baselineMatches: results.reduce((sum, item) => sum + item.metrics.baselineMatches, 0),
      candidateMatches: results.reduce((sum, item) => sum + item.metrics.candidateMatches, 0),
      candidateMismatches: results.reduce((sum, item) => sum + item.metrics.candidateMismatches, 0),
      stabilityReviewProposals: proposals,
      holds: results.length - proposals,
      foundationSessions: foundationSessions.length,
      livePredictionReplacements: 0,
      operativeShadowAdmissions: 0,
      trainingAdmissions: 0,
      permissionGrants: 0,
      toolCalls: 0,
      runtimeSelections: 0,
      runtimeAdmissions: 0,
      runtimePromotions: 0,
      canonChanges: 0,
      worldActions: 0
    },
    state: proposals ? 'PRIVATE_SHADOW_STABILITY_REVIEW_PROPOSED' : results.length ? 'PRIVATE_SHADOW_EVIDENCE_HELD' : 'NO_PRIVATE_SHADOW_ENROLLMENTS',
    authority: batchAuthority(),
    boundary: 'This TEST organ evaluates unchanged private shadow and baseline predictions only after later verified local observations are supplied, preserves missing and conflicting targets, and may propose human review after bounded target and source diversity, improvement, and zero mismatch gates. It cannot replace live predictions, admit an operative method, certify external chronology or independence, train, grant permission, use tools, enter runtime, promote, change CANON, or act.'
  }, 'outcome-method-private-shadow-evaluation-batch');
}
function runEvaluation(input, options = {}) { return runEvaluationFromSource(normalizeEvaluation(input), options); }
function verifyEvaluationBatch(batch, input, runDir) {
  exactKeys(batch, ['schema', 'batchId', 'batchDigest', 'createdAt', 'organ', 'source', 'evaluations', 'holds', 'results', 'foundationSessions', 'summary', 'state', 'authority', 'boundary'], 'private shadow evaluation batch');
  if (batch.schema !== EVALUATION_BATCH_SCHEMA || batch.organ.id !== ORGAN_ID || batch.organ.status !== 'TEST' || batch.organ.learnedWeights !== false || batch.organ.claimCeiling !== 'TEST_LATER_OUTCOME_PRIVATE_SHADOW_COMPARISON_TO_STABILITY_REVIEW_PROPOSAL_ONLY') throw new Error('private shadow evaluation batch boundary changed');
  const source = normalizeEvaluation(input);
  const currentObservations = uniqueObservations(source.outcomeBatches);
  const preSealObservations = uniqueObservations(source.predictionSource.outcomeBatches);
  const observationsById = new Map(currentObservations.map(item => [item.observationId, item]));
  const enrollments = new Map(source.predictionSource.enrollmentBatch.enrollments.map(item => [item.enrollmentId, item]));
  const predictions = new Map(source.predictionBatch.shadowPredictions.map(item => [item.shadowPredictionId, item]));
  batch.evaluations.forEach(item => {
    const enrollment = enrollments.get(item.enrollment.enrollmentId);
    const prediction = predictions.get(item.prediction.shadowPredictionId);
    const observation = observationsById.get(item.observation.observationId);
    if (!enrollment || !prediction || !observation) throw new Error('private shadow evaluation source chain is incomplete');
    Shadow.verifyShadowEvaluation(item, { enrollment, shadowPrediction: prediction, observationsBeforeSeal: preSealObservations, observation });
  });
  batch.results.forEach(item => {
    const enrollment = enrollments.get(item.enrollment.enrollmentId);
    if (!enrollment) throw new Error('private shadow stability result references an unknown enrollment');
    Shadow.verifyStabilityResult(item, enrollment, batch.evaluations.filter(row => row.enrollment.enrollmentId === enrollment.enrollmentId));
  });
  if (!batch.foundationSessions.every(foundationAuthoritySafe)) throw new Error('private shadow evaluation Foundation session gained authority');
  const trueAuthority = new Set(['privateEvaluationTraceWrite']);
  if (!batch.authority || Object.entries(batch.authority).some(([key, value]) => trueAuthority.has(key) ? value !== true : value !== false)) throw new Error('private shadow evaluation batch gained authority');
  const zeros = ['livePredictionReplacements', 'operativeShadowAdmissions', 'trainingAdmissions', 'permissionGrants', 'toolCalls', 'runtimeSelections', 'runtimeAdmissions', 'runtimePromotions', 'canonChanges', 'worldActions'];
  if (zeros.some(key => batch.summary[key] !== 0)) throw new Error('private shadow evaluation batch claim ceiling changed');
  if (!Shadow.same(batch.source, evaluationSourceRefs(source))) throw new Error('private shadow evaluation source refs changed');
  const reconstructed = runEvaluationFromSource(source, { at: batch.createdAt });
  if (!Shadow.same(reconstructed, batch)) throw new Error('private shadow evaluation batch does not replay from its complete source');
  const expectedDigest = Shadow.digest(Object.assign({}, batch, { batchDigest: null }));
  const expectedId = `outcome-method-private-shadow-evaluation-batch-${Shadow.digest(Object.assign({}, batch, { batchId: null, batchDigest: null })).slice(0, 24)}`;
  if (batch.batchDigest !== expectedDigest || batch.batchId !== expectedId) throw new Error('private shadow evaluation batch identity changed');
  verifyDisk(runDir, batch, source, verifyEvaluationBatch, 'private shadow evaluation');
  return true;
}

function verifyDisk(runDir, batch, source, verifier, label) {
  if (!runDir) return;
  const diskBatch = JSON.parse(fs.readFileSync(path.join(runDir, 'batch.json'), 'utf8'));
  const diskSource = JSON.parse(fs.readFileSync(path.join(runDir, 'source.json'), 'utf8'));
  if (!Shadow.same(diskBatch, batch) || !Shadow.same(diskSource, source)) throw new Error(`${label} stored files changed`);
}
function recordImmutable(batch, source, options, stateDir, verifier, label) {
  verifier(batch, source);
  if (options.write === false) return { batch, written: false, reused: false, runDir: null };
  const root = ensureDirectory(options.stateDir || stateDir, `${label} state root`);
  const finalDir = path.join(root, batch.batchId);
  if (fs.existsSync(finalDir)) {
    const existing = JSON.parse(fs.readFileSync(path.join(finalDir, 'batch.json'), 'utf8'));
    const existingSource = JSON.parse(fs.readFileSync(path.join(finalDir, 'source.json'), 'utf8'));
    verifier(existing, existingSource, finalDir);
    if (!Shadow.same(existing, batch)) throw new Error(`${label} immutable identity collision`);
    return { batch: existing, written: false, reused: true, runDir: finalDir };
  }
  const stageDir = path.join(root, `.${batch.batchId}-${process.pid}-${Date.now()}`);
  fs.mkdirSync(stageDir);
  fs.writeFileSync(path.join(stageDir, 'batch.json'), JSON.stringify(batch, null, 2) + '\n', { flag: 'wx' });
  fs.writeFileSync(path.join(stageDir, 'source.json'), JSON.stringify(source, null, 2) + '\n', { flag: 'wx' });
  verifier(batch, source, stageDir);
  const commit = ImmutableStore.commitDirectory(stageDir, finalDir);
  return { batch, written: !commit.reused, reused: commit.reused, runDir: commit.runDir };
}
function recordEnrollment(input, options = {}) {
  const source = normalizeEnrollment(input);
  return recordImmutable(runEnrollmentFromSource(source, options), source, options, DEFAULT_ENROLLMENT_STATE_DIR, verifyEnrollmentBatch, 'private shadow enrollment');
}
function recordPrediction(input, options = {}) {
  const source = normalizePrediction(input);
  return recordImmutable(runPredictionFromSource(source, options), source, options, DEFAULT_PREDICTION_STATE_DIR, verifyPredictionBatch, 'private shadow prediction');
}
function recordEvaluation(input, options = {}) {
  const source = normalizeEvaluation(input);
  return recordImmutable(runEvaluationFromSource(source, options), source, options, DEFAULT_EVALUATION_STATE_DIR, verifyEvaluationBatch, 'private shadow evaluation');
}

function loadLatest(rootPath, regex, verifier, batchKey, sourceKey, options = {}) {
  const root = path.resolve(options.stateDir || rootPath);
  if (!fs.existsSync(root)) return null;
  const stat = fs.lstatSync(root);
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('private shadow state root must be a real directory');
  const rows = fs.readdirSync(root, { withFileTypes: true }).filter(item => item.isDirectory() && regex.test(item.name)).map(entry => {
    const runDir = path.join(root, entry.name);
    const batch = JSON.parse(fs.readFileSync(path.join(runDir, 'batch.json'), 'utf8'));
    const source = JSON.parse(fs.readFileSync(path.join(runDir, 'source.json'), 'utf8'));
    verifier(batch, source, runDir);
    return { [batchKey]: batch, [sourceKey]: source };
  }).sort((left, right) => left[batchKey].createdAt.localeCompare(right[batchKey].createdAt) || left[batchKey].batchId.localeCompare(right[batchKey].batchId));
  return rows.length ? rows.at(-1) : null;
}
function loadLatestWatchObservation(options = {}) {
  return loadLatest(options.stateDir || WatchOrgan.DEFAULT_STATE_DIR, /^outcome-method-watch-observation-[a-f0-9]{24}$/, WatchOrgan.verifyObservation, 'watchObservationBatch', 'watchObservationSource', { stateDir: options.stateDir || WatchOrgan.DEFAULT_STATE_DIR });
}
function loadLatestEnrollment(options = {}) {
  return loadLatest(DEFAULT_ENROLLMENT_STATE_DIR, /^outcome-method-private-shadow-enrollment-batch-[a-f0-9]{24}$/, verifyEnrollmentBatch, 'enrollmentBatch', 'enrollmentSource', options);
}
function loadLatestPrediction(options = {}) {
  return loadLatest(DEFAULT_PREDICTION_STATE_DIR, /^outcome-method-private-shadow-prediction-batch-[a-f0-9]{24}$/, verifyPredictionBatch, 'predictionBatch', 'predictionSource', options);
}
function loadLatestEvaluation(options = {}) {
  return loadLatest(DEFAULT_EVALUATION_STATE_DIR, /^outcome-method-private-shadow-evaluation-batch-[a-f0-9]{24}$/, verifyEvaluationBatch, 'evaluationBatch', 'evaluationSource', options);
}

module.exports = {
  ROOT,
  ORGAN_ID,
  ENROLLMENT_BATCH_SCHEMA,
  PREDICTION_BATCH_SCHEMA,
  EVALUATION_BATCH_SCHEMA,
  DEFAULT_ENROLLMENT_STATE_DIR,
  DEFAULT_PREDICTION_STATE_DIR,
  DEFAULT_EVALUATION_STATE_DIR,
  DEFAULT_OUTCOME_STATE_DIR,
  MAX_OUTCOME_BATCHES,
  MAX_SOURCE_BYTES,
  normalizeEnrollment,
  runEnrollment,
  verifyEnrollmentBatch,
  normalizePrediction,
  runPrediction,
  verifyPredictionBatch,
  normalizeEvaluation,
  runEvaluation,
  verifyEvaluationBatch,
  recordEnrollment,
  recordPrediction,
  recordEvaluation,
  loadLatestWatchObservation,
  loadLatestEnrollment,
  loadLatestPrediction,
  loadLatestEvaluation
};
