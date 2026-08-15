'use strict';

const fs = require('fs');
const path = require('path');
const Outcome = require('../kernel/outcome-learning-cell');
const Foundation = require('../kernel/reasoning-foundation');
const ImmutableStore = require('../kernel/immutable-batch-store');

const ROOT = path.resolve(__dirname, '..');
const ORGAN_ID = 'axm.mirror.outcome-learning-organ/v1';
const BATCH_SCHEMA = 'axm.mirror.outcome-learning-batch/v1';
const DEFAULT_STATE_DIR = path.join(ROOT, 'state', 'outcome-learning-runs');

function clone(value) { return JSON.parse(JSON.stringify(value)); }
function exactKeys(value, keys, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || !Outcome.same(Object.keys(value).sort(), keys.slice().sort())) throw new Error(`${label} fields changed`);
}
function rejectHidden(value, trail = []) {
  if (!value || typeof value !== 'object') return;
  for (const key of Object.keys(value)) {
    if (/chain.?of.?thought|hidden.?reasoning|private.?reasoning|reasoning.?content/i.test(key)) throw new Error(`private hidden reasoning field refused at ${trail.concat(key).join('.')}`);
    rejectHidden(value[key], trail.concat(key));
  }
}
function stableRefs(records, idKey, digestKey) {
  return records.slice().sort((left, right) => left[idKey].localeCompare(right[idKey])).map(item => ({ id: item[idKey], digest: item[digestKey] }));
}
function outcomeResult(evaluation) {
  if (evaluation.summary.contradictoryObservationFields > 0) return 'CONFLICT';
  if (evaluation.summary.mismatchedFields > 0) return 'FAIL';
  if (evaluation.state === 'MATCH') return 'PASS';
  return 'HOLD';
}
function sourceEvidence(prediction, observation, evaluation) {
  const rows = [];
  const seen = new Set();
  const refs = prediction.fields.flatMap(item => item.evidenceRefs)
    .concat(prediction.questions.flatMap(item => item.evidenceRefs))
    .concat(prediction.permission.basisEvidenceRefs)
    .concat(observation.fields.flatMap(item => item.evidenceRefs.concat(item.alternatives.flatMap(alt => alt.evidenceRefs))))
    .concat(observation.permission.basisEvidenceRefs);
  for (const ref of refs.sort((left, right) => left.id.localeCompare(right.id))) {
    const key = `${ref.id}:${ref.digest}`;
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push({
      id: `outcome-source-${Outcome.digest(ref).slice(0, 24)}`,
      kind: 'rule',
      status: 'asserted',
      statement: `A content-digested source reference is bound to this outcome trace as ${ref.id}; the binding does not re-verify the opaque source claim.`,
      source: { kind: 'outcome-source-reference', id: ref.id, at: null }
    });
  }
  return rows.concat([
    {
      id: prediction.predictionId,
      kind: 'prediction',
      status: 'predicted',
      statement: `The content-sealed prediction ${prediction.predictionId} declared ${prediction.fields.length} scoped typed field expectations before the supplied local observation inventory.`,
      source: { kind: 'outcome-prediction', id: prediction.predictionId, at: null }
    },
    {
      id: observation.observationId,
      kind: 'observation',
      status: 'observed',
      statement: `The attributed outcome observation ${observation.observationId} preserves observed, missing, and contradictory typed fields without automatic truth promotion.`,
      source: { kind: 'outcome-observation', id: observation.observationId, at: null }
    },
    {
      id: evaluation.evaluationId,
      kind: 'test',
      status: 'tested',
      statement: `Exact typed comparison produced ${evaluation.state}: ${evaluation.summary.matchedFields} matched, ${evaluation.summary.mismatchedFields} mismatched, and ${evaluation.summary.unresolvedFields} unresolved fields.`,
      source: { kind: 'outcome-evaluation', id: evaluation.evaluationId, at: null }
    }
  ]);
}
function foundationSession(prediction, observation, evaluation, correction, options = {}) {
  const actionId = correction ? correction.correctionId : `preserve-${evaluation.evaluationId}`;
  const isCorrection = !!correction;
  const evidence = sourceEvidence(prediction, observation, evaluation);
  const questions = prediction.questions.map(item => ({
    id: item.questionId,
    question: item.statement,
    dependsOn: [],
    cheapestCheck: item.kind === 'PERMISSION'
      ? 'Ask the external permission steward for an explicit scoped decision and preserve its evidence receipt.'
      : 'Route the question through the deterministic roots and preserve the exact evidence used by the steward decision.',
    status: 'OPEN',
    answerEvidenceRefs: []
  }));
  const result = outcomeResult(evaluation);
  const action = {
    id: actionId,
    kind: isCorrection ? 'proposal' : evaluation.state === 'MATCH' ? 'observe' : 'hold',
    label: isCorrection
      ? 'Preserve the failed prediction and propose review of its method'
      : evaluation.state === 'MATCH'
        ? 'Preserve the exact scoped prediction match as evidence'
        : 'Hold interpretation until the unresolved outcome fields are observed or reconciled',
    requiredPermissions: [],
    supportingEvidence: [prediction.predictionId, observation.observationId, evaluation.evaluationId],
    preconditionEvidence: [prediction.predictionId, observation.observationId, evaluation.evaluationId],
    expectedEffects: [isCorrection ? 'A review proposal remains inspectable without mutating the prediction.' : 'The typed outcome record remains inspectable without external action.'],
    possibleSideEffects: ['A bounded fixture result may not transfer to another scope or external world.'],
    reversible: true,
    recovery: 'No external state, prediction record, evidence record, model, runtime, or canon entry was changed.',
    risk: 'low'
  };
  const reasoning = {
    schema: 'axm.mirror.reason/v1',
    requestId: `outcome-foundation-${evaluation.evaluationId}`,
    sessionId: `outcome-learning-${evaluation.evaluationId}`,
    actor: { id: 'mirror-outcome-learning-organ', kind: 'machine', displayName: 'Mirror Outcome Learning Organ' },
    goal: { id: 'interpret-scoped-outcome', statement: 'Compare the sealed prediction with the attributed observation, preserve uncertainty and contradiction, and propose only the smallest evidence-bound next step.' },
    evidence,
    unknowns: prediction.questions.map(item => ({ id: item.questionId, question: item.statement, blocking: true })),
    constraints: [{ id: 'outcome-proposal-only', type: 'max-risk', statement: 'Outcome interpretation is proposal-only and may not mutate an external world.', actionIds: [actionId], evidenceIds: [], permission: null, maxRisk: 'low', hard: true }],
    permissions: [],
    actions: [action],
    budget: { maxCandidates: 4, deadlineMs: 1000 },
    decomposition: questions,
    assumptions: [],
    pathProfiles: [{
      pathId: `path-${actionId}`,
      actionId,
      approach: action.label,
      questionIds: questions.map(item => item.id),
      requiredEvidence: action.preconditionEvidence,
      requiredPermissions: [],
      toolRequest: null,
      estimatedCost: 'LOW',
      informationValue: isCorrection ? 0.9 : 0.7,
      reversible: true,
      failureConditions: ['The prediction, observation, or evaluation digest does not verify.', 'An unresolved field is silently renamed failure or success.'],
      strategyTags: ['outcome', isCorrection ? 'correction-review' : 'preserve-evidence']
    }],
    verificationReceipts: [{
      id: `verify-${evaluation.evaluationId}`,
      actionId,
      claim: 'The supplied content-sealed prediction and observation reproduce this exact typed evaluation without changing unresolved states.',
      evidenceRefs: [prediction.predictionId, observation.observationId, evaluation.evaluationId],
      method: 'Re-run the deterministic Outcome Learning Cell verifier over the exact content-digested records.',
      result: 'PASS',
      limitations: ['typed scalar fields only', 'caller-supplied local append order is not external chronology', 'no external-world transfer claim']
    }],
    outcome: {
      result,
      statement: result === 'PASS'
        ? 'Every evaluable scoped field matched and no field remained unresolved.'
        : result === 'FAIL'
          ? 'At least one observed scoped field disagreed with the sealed prediction; the failed prediction remains preserved.'
          : result === 'CONFLICT'
            ? 'The attributed observation contains contradictory alternatives; no single outcome is inferred.'
            : 'The outcome remains unresolved because a prediction or observation field is unknown or missing.',
      evidenceRefs: [prediction.predictionId, observation.observationId, evaluation.evaluationId],
      transferEvidenceRefs: [],
      regressionEvidenceRefs: [],
      repairEvidenceRefs: correction ? [correction.correctionId] : [],
      resolvedSeams: [],
      observedAt: options.at || null,
      verified: true,
      repeatedVerifiedOutcomes: 1,
      usePermission: prediction.permission.status === 'ALLOWED' && observation.permission.status === 'ALLOWED' ? 'allowed' : 'unknown',
      permissionBasis: prediction.permission.status === 'ALLOWED' && observation.permission.status === 'ALLOWED' ? 'Exact content-digested bounded intake permission evidence is attached; this does not grant external action authority.' : null,
      worldMutations: 0,
      runtimePointerChanged: false,
      unexpectedSeams: []
    }
  };
  return Foundation.run(reasoning, { at: options.at });
}
function latestPriorCorrection(previousCorrections, prediction, observation, evaluation, validatedPriorIds) {
  const matching = previousCorrections.filter(item => item.source.predictionId === prediction.predictionId).sort((left, right) => left.lineage.sequence - right.lineage.sequence);
  for (let index = 0; index < matching.length; index += 1) {
    const row = matching[index];
    const previous = index === 0 ? null : matching[index - 1];
    Outcome.verifyCorrectionProposal(row, prediction, observation, evaluation, previous);
    if (row.lineage.sequence !== index) throw new Error(`previous correction sequence is discontinuous for ${prediction.predictionId}`);
    if (index === 0 && (row.lineage.priorCorrectionId !== null || row.lineage.priorCorrectionDigest !== null)) throw new Error(`first correction has a predecessor for ${prediction.predictionId}`);
    if (index > 0 && (row.lineage.priorCorrectionId !== previous.correctionId || row.lineage.priorCorrectionDigest !== previous.correctionDigest)) throw new Error(`previous correction lineage changed for ${prediction.predictionId}`);
    validatedPriorIds.add(row.correctionId);
  }
  return matching.length ? matching[matching.length - 1] : null;
}
function sealBatch(batch) {
  batch.batchId = `outcome-learning-${Outcome.digest(Object.assign({}, batch, { batchId: null, batchDigest: null })).slice(0, 24)}`;
  batch.batchDigest = Outcome.digest(Object.assign({}, batch, { batchDigest: null }));
  return Outcome.stable(batch);
}
function run(input, options = {}) {
  rejectHidden(input);
  exactKeys(input, ['predictions', 'observations', 'previousCorrections'], 'outcome learning request');
  if (!Array.isArray(input.predictions) || !Array.isArray(input.observations) || !Array.isArray(input.previousCorrections)) throw new Error('outcome learning request arrays are required');
  if (input.predictions.length > 1024 || input.observations.length > 1024 || input.previousCorrections.length > 1024) throw new Error('outcome learning request exceeds bounded record limits');
  const predictions = input.predictions.map(clone);
  const observations = input.observations.map(clone);
  const previousCorrections = input.previousCorrections.map(clone);
  const createdAt = String(options.at == null ? '' : options.at).trim() || new Date().toISOString();
  predictions.forEach(Outcome.verifyPredictionEnvelope);
  observations.forEach(Outcome.verifyObservation);
  previousCorrections.forEach(item => Outcome.verifyCorrectionProposal(item, null, null, null, null, true));
  if (new Set(predictions.map(item => item.predictionId)).size !== predictions.length) throw new Error('duplicate outcome prediction');
  if (new Set(observations.map(item => item.observationId)).size !== observations.length) throw new Error('duplicate outcome observation');
  if (new Set(previousCorrections.map(item => item.correctionId)).size !== previousCorrections.length) throw new Error('duplicate previous correction');

  const evaluations = [];
  const corrections = [];
  const foundationSessions = [];
  const validatedPriorIds = new Set();
  const assessments = predictions.slice().sort((left, right) => left.predictionId.localeCompare(right.predictionId)).map(prediction => {
    const matches = observations.filter(observation => observation.targetKey === prediction.targetKey).sort((left, right) => left.observationId.localeCompare(right.observationId));
    if (matches.length === 0) return { predictionId: prediction.predictionId, predictionDigest: prediction.predictionDigest, state: 'HOLD_NO_MATCHING_OBSERVATION', observationIds: [], evaluationId: null, correctionId: null, foundationSessionId: null };
    if (matches.length > 1) return { predictionId: prediction.predictionId, predictionDigest: prediction.predictionDigest, state: 'HOLD_AMBIGUOUS_MATCHING_OBSERVATIONS', observationIds: matches.map(item => item.observationId), evaluationId: null, correctionId: null, foundationSessionId: null };
    const observation = matches[0];
    const evaluation = Outcome.evaluate(prediction, observation);
    Outcome.verifyEvaluation(evaluation, prediction, observation);
    evaluations.push(evaluation);
    const previous = latestPriorCorrection(previousCorrections, prediction, observation, evaluation, validatedPriorIds);
    const correction = Outcome.buildCorrectionProposal(evaluation, prediction, observation, previous);
    if (correction) {
      Outcome.verifyCorrectionProposal(correction, prediction, observation, evaluation, previous);
      corrections.push(correction);
    }
    const session = foundationSession(prediction, observation, evaluation, correction, { at: createdAt });
    foundationSessions.push(session);
    return {
      predictionId: prediction.predictionId,
      predictionDigest: prediction.predictionDigest,
      state: evaluation.state,
      observationIds: [observation.observationId],
      evaluationId: evaluation.evaluationId,
      correctionId: correction && correction.correctionId || null,
      foundationSessionId: session.reasoningSessionId
    };
  });
  if (validatedPriorIds.size !== previousCorrections.length) throw new Error('a previous correction is not bound to one current exact prediction, observation, and evaluation lineage');
  const reports = Array.from(new Set(predictions.map(item => item.calibrationKey))).sort().map(calibrationKey => Outcome.buildCalibrationReport(predictions, observations, evaluations, calibrationKey));
  reports.forEach(report => Outcome.verifyCalibrationReport(report, predictions, observations, evaluations));
  const summary = {
    predictions: predictions.length,
    observations: observations.length,
    evaluated: evaluations.length,
    matched: evaluations.filter(item => item.state === 'MATCH').length,
    partialMatches: evaluations.filter(item => item.state === 'PARTIAL_MATCH').length,
    mismatched: evaluations.filter(item => item.state === 'MISMATCH').length,
    unresolved: evaluations.filter(item => ['MATCH_WITH_UNRESOLVED_FIELDS', 'HOLD_NO_EVALUABLE_FIELDS', 'HOLD_INELIGIBLE_PREDICTION_OR_OBSERVATION'].includes(item.state)).length,
    noMatchingObservation: assessments.filter(item => item.state === 'HOLD_NO_MATCHING_OBSERVATION').length,
    ambiguousMatchingObservations: assessments.filter(item => item.state === 'HOLD_AMBIGUOUS_MATCHING_OBSERVATIONS').length,
    correctionProposals: corrections.length,
    priorCorrectionsPreserved: previousCorrections.length,
    calibrationReports: reports.length,
    empiricallyScoredCohorts: reports.filter(item => item.state.startsWith('EMPIRICAL_')).length,
    foundationSessions: foundationSessions.length,
    externalWorldActions: 0,
    toolCalls: 0,
    permissionGrants: 0,
    predictionRewrites: 0,
    evidenceAdmissions: 0,
    trainingAdmissions: 0,
    runtimePromotions: 0,
    canonChanges: 0
  };
  return sealBatch({
    schema: BATCH_SCHEMA,
    batchId: null,
    batchDigest: null,
    createdAt,
    organ: { id: ORGAN_ID, status: 'TEST', learnedWeights: false, claimCeiling: 'TEST_TYPED_OUTCOME_COMPARISON_EMPIRICAL_SCORE_AND_PROPOSAL_ONLY_CORRECTION' },
    source: {
      predictions: stableRefs(predictions, 'predictionId', 'predictionDigest'),
      observations: stableRefs(observations, 'observationId', 'observationDigest'),
      priorCorrections: stableRefs(previousCorrections, 'correctionId', 'correctionDigest')
    },
    predictions: predictions.slice().sort((left, right) => left.predictionId.localeCompare(right.predictionId)),
    observations: observations.slice().sort((left, right) => left.observationId.localeCompare(right.observationId)),
    previousCorrections: previousCorrections.slice().sort((left, right) => left.correctionId.localeCompare(right.correctionId)),
    assessments,
    evaluations: evaluations.slice().sort((left, right) => left.evaluationId.localeCompare(right.evaluationId)),
    corrections: corrections.slice().sort((left, right) => left.correctionId.localeCompare(right.correctionId)),
    calibrationReports: reports,
    foundationSessions: foundationSessions.slice().sort((left, right) => left.reasoningSessionId.localeCompare(right.reasoningSessionId)),
    summary,
    authority: { predictionGeneration: false, probabilityGeneration: false, truthWrite: false, evidenceAdmission: false, permissionGrant: false, principleDecision: false, repairApply: false, toolUse: false, trainingAdmission: false, modelChange: false, runtimePromotion: false, canonChange: false, worldAction: false },
    boundary: 'This TEST organ compares caller-supplied content-sealed typed predictions with attributed observations, computes exact cohort score evidence, routes open permission and principle questions through the Reasoning Foundation, and appends proposal-only correction lineage. It does not invent predictions or probabilities, infer missing outcomes, rewrite failures, apply repairs, admit evidence, train, promote, canonize, or act.'
  });
}
function verify(batch) {
  exactKeys(batch, ['schema', 'batchId', 'batchDigest', 'createdAt', 'organ', 'source', 'predictions', 'observations', 'previousCorrections', 'assessments', 'evaluations', 'corrections', 'calibrationReports', 'foundationSessions', 'summary', 'authority', 'boundary'], 'outcome learning batch');
  if (batch.schema !== BATCH_SCHEMA || batch.organ.id !== ORGAN_ID || batch.organ.learnedWeights !== false || Object.values(batch.authority).some(Boolean)) throw new Error('outcome learning batch boundary changed');
  batch.predictions.forEach(Outcome.verifyPredictionEnvelope);
  batch.observations.forEach(Outcome.verifyObservation);
  const predictionById = new Map(batch.predictions.map(item => [item.predictionId, item]));
  const observationById = new Map(batch.observations.map(item => [item.observationId, item]));
  for (const evaluation of batch.evaluations) {
    const prediction = predictionById.get(evaluation.source.predictionId);
    const observation = observationById.get(evaluation.source.observationId);
    if (!prediction || !observation) throw new Error('outcome batch evaluation source is absent');
    Outcome.verifyEvaluation(evaluation, prediction, observation);
  }
  batch.calibrationReports.forEach(report => Outcome.verifyCalibrationReport(report, batch.predictions, batch.observations, batch.evaluations));
  for (const correction of batch.corrections) {
    const prediction = predictionById.get(correction.source.predictionId);
    const observation = observationById.get(correction.source.observationId);
    const evaluation = batch.evaluations.find(item => item.evaluationId === correction.source.evaluationId);
    if (!prediction || !observation || !evaluation) throw new Error('outcome batch correction source is absent');
    Outcome.verifyCorrectionProposal(correction, prediction, observation, evaluation, null, true);
  }
  if (batch.foundationSessions.some(session => session.authority.proposalOnly !== true || Object.entries(session.authority).some(([key, value]) => key !== 'proposalOnly' && value !== false))) throw new Error('outcome Foundation session gained authority');
  const expectedDigest = Outcome.digest(Object.assign({}, batch, { batchDigest: null }));
  const expectedId = `outcome-learning-${Outcome.digest(Object.assign({}, batch, { batchId: null, batchDigest: null })).slice(0, 24)}`;
  if (batch.batchDigest !== expectedDigest || batch.batchId !== expectedId) throw new Error('outcome learning batch identity changed');
  if (batch.summary.predictionRewrites !== 0 || batch.summary.externalWorldActions !== 0 || batch.summary.toolCalls !== 0 || batch.summary.permissionGrants !== 0 || batch.summary.evidenceAdmissions !== 0 || batch.summary.trainingAdmissions !== 0 || batch.summary.runtimePromotions !== 0 || batch.summary.canonChanges !== 0) throw new Error('outcome learning batch gained authority');
  const reconstructed = run({ predictions: batch.predictions, observations: batch.observations, previousCorrections: batch.previousCorrections }, { at: batch.createdAt });
  if (!Outcome.same(reconstructed, batch)) throw new Error('outcome learning batch does not replay from its sealed inputs');
  return true;
}
function ensureStateRoot(stateDir) {
  const root = path.resolve(stateDir || DEFAULT_STATE_DIR);
  fs.mkdirSync(root, { recursive: true });
  const stat = fs.lstatSync(root);
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('outcome learning state root must be a real directory');
  return root;
}
function record(input, options = {}) {
  const batch = run(input, options);
  verify(batch);
  if (options.write === false) return { batch, written: false, reused: false, runDir: null };
  const root = ensureStateRoot(options.stateDir);
  const finalDir = path.join(root, batch.batchId);
  const stageDir = path.join(root, `.${batch.batchId}-${process.pid}-${Date.now()}`);
  fs.mkdirSync(stageDir);
  fs.writeFileSync(path.join(stageDir, 'batch.json'), JSON.stringify(batch, null, 2) + '\n', 'utf8');
  const commit = ImmutableStore.commitDirectory(stageDir, finalDir);
  return { batch, written: !commit.reused, reused: commit.reused, runDir: commit.runDir, commit };
}

module.exports = { ROOT, ORGAN_ID, BATCH_SCHEMA, DEFAULT_STATE_DIR, run, verify, record, foundationSession };
